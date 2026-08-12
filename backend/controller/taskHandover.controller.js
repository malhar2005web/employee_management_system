import { pool } from '../config/db.js';
import { logActivityEvent } from '../services/eventLogger.service.js';

// Helper to extract employee/user ID safely
const getEmpId = (req) => {
    if (!req.user) return null;
    return req.user.employee_id || req.user.id || req.user.userId;
};

/**
 * 🎯 1. ASSIGN TASK (Multi-Assignee & Roles)
 */
export const assignTask = async (req, res) => {
    const client = await pool.connect();
    try {
        const performedBy = getEmpId(req);
        const { taskId, assigneeType = 'Employee', assigneeId, role = 'Primary' } = req.body;

        if (!taskId || !assigneeId) {
            return res.status(400).json({ success: false, message: 'Missing required assignment fields' });
        }

        await client.query('BEGIN');

        if (role === 'Primary') {
            await client.query(
                `UPDATE task_assignments SET is_active = false, unassigned_at = NOW() WHERE task_id = $1 AND role = 'Primary' AND is_active = true`,
                [taskId]
            );
        }

        const assignRes = await client.query(
            `INSERT INTO task_assignments (task_id, assignee_type, assignee_id, role, assigned_by, assigned_at, is_active)
             VALUES ($1, $2, $3, $4, $5, NOW(), true)
             RETURNING *`,
            [taskId, assigneeType, assigneeId, role, performedBy]
        );

        if (assigneeType === 'Employee') {
            await client.query(
                `UPDATE tasks SET assigned_to = ARRAY(SELECT DISTINCT unnest(array_append(assigned_to, $2::int))) WHERE id = $1`,
                [taskId, assigneeId]
            );
        }

        await client.query(
            `INSERT INTO task_assignment_history (task_id, assignee_type, assignee_id, role, action, new_owner_id, performed_by)
             VALUES ($1, $2, $3, $4, 'ASSIGNED', $5, $6)`,
            [taskId, assigneeType, assigneeId, role, assigneeType === 'Employee' ? assigneeId : null, performedBy]
        );

        await client.query(
            `INSERT INTO audit_logs (user_id, action, entity, description)
             VALUES ($1, 'TASK_ASSIGNED', 'tasks', $2)`,
            [performedBy, `Assigned task #${taskId} to ${assigneeType} #${assigneeId} as ${role}`]
        );

        await client.query('COMMIT');

        return res.status(201).json({
            success: true,
            message: 'Task assigned successfully',
            data: assignRes.rows[0]
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error assigning task:', error);
        return res.status(500).json({ success: false, message: 'Failed to assign task: ' + error.message });
    } finally {
        client.release();
    }
};

/**
 * 🔄 2. TRANSFER TASK / REASSIGNMENT REQUEST (Employee Initiates Request for Admin Review)
 */
export const transferTask = async (req, res) => {
    const client = await pool.connect();
    try {
        const requestedBy = getEmpId(req);
        const isAdminUser = req.user && req.user.role === 'Admin';

        const {
            taskId,
            transferType = 'Reassignment',
            toEmployeeId,
            reasonCode, // 'WORKLOAD', 'LEAVE', 'SKILL', 'PROJECT_CHANGE', 'CUSTOMER', 'EMERGENCY', 'WRONG_ASSIGNMENT', 'OTHER'
            reasonDescription,
            attachments = [],
            expiryAt = null
        } = req.body;

        if (!taskId || !reasonCode || !reasonDescription) {
            return res.status(400).json({ success: false, message: 'Task ID, reason code, and description are mandatory for handover request' });
        }

        await client.query('BEGIN');

        // Fetch current primary owner
        const currentAssignRes = await client.query(
            `SELECT assignee_id FROM task_assignments WHERE task_id = $1 AND role = 'Primary' AND is_active = true LIMIT 1`,
            [taskId]
        );
        const fromEmployeeId = currentAssignRes.rows.length > 0 ? currentAssignRes.rows[0].assignee_id : requestedBy;

        // If regular employee initiates, ALWAYS require Admin Approval
        const requiresApproval = !isAdminUser;
        const initialStatus = requiresApproval ? 'Pending Approval' : 'Approved';

        // Insert transfer record
        const transferRes = await client.query(
            `INSERT INTO task_transfers (task_id, transfer_type, from_employee_id, to_employee_id, reason_code, reason_description, status, requires_approval, requested_by, expiry_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING *`,
            [taskId, transferType, fromEmployeeId, toEmployeeId || null, reasonCode, reasonDescription, initialStatus, requiresApproval, requestedBy, expiryAt ? new Date(expiryAt) : null]
        );

        const transfer = transferRes.rows[0];

        // Insert attachments if provided
        if (Array.isArray(attachments) && attachments.length > 0) {
            for (const att of attachments) {
                await client.query(
                    `INSERT INTO task_transfer_attachments (transfer_id, file_name, file_path, file_size, mime_type, uploaded_by)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [transfer.id, att.fileName || 'attachment', att.filePath || '', att.fileSize || 0, att.mimeType || 'application/octet-stream', requestedBy]
                );
            }
        }

        if (requiresApproval) {
            // Find Task Title, Project Head, and Reporting Manager
            const taskMetaRes = await client.query(
                `SELECT t.title AS task_title, p.account_manager_id AS project_head_id, e.reporting_manager_id
                 FROM tasks t
                 LEFT JOIN projects p ON t.project_id = p.id
                 LEFT JOIN employees e ON e.id = $1
                 WHERE t.id = $2`,
                [requestedBy, taskId]
            );
            const taskMeta = taskMetaRes.rows[0] || {};

            // Collect Admins
            const adminUsersRes = await client.query(
                `SELECT e.id FROM employees e JOIN users u ON e.user_id = u.id WHERE u.role = 'Admin'`
            );

            const approverSet = new Set(adminUsersRes.rows.map(r => r.id));
            if (taskMeta.project_head_id) approverSet.add(taskMeta.project_head_id);
            if (taskMeta.reporting_manager_id) approverSet.add(taskMeta.reporting_manager_id);
            if (approverSet.size === 0) approverSet.add(1);

            for (const approverEmpId of approverSet) {
                await client.query(
                    `INSERT INTO task_transfer_approvals (transfer_id, approver_id, approver_role, approval_order, status)
                     VALUES ($1, $2, 'Project Lead / Admin', 1, 'Pending')`,
                    [transfer.id, approverEmpId]
                );

                // Send Notification to Project Lead & Admins Inbox
                await client.query(
                    `INSERT INTO notifications (title, message, type, recipient_id, sender_id)
                     VALUES ($1, $2, 'Task Transfer Request', $3, $4)`,
                    ['Handover Approval Needed', `Handover request for task "${taskMeta.task_title || '#' + taskId}" (${reasonCode}) pending decision.`, approverEmpId, requestedBy]
                );
            }
        } else {
            // Direct Admin Reassignment
            if (toEmployeeId) {
                await client.query(
                    `UPDATE task_assignments SET is_active = false, unassigned_at = NOW() WHERE task_id = $1 AND role = 'Primary' AND is_active = true`,
                    [taskId]
                );

                await client.query(
                    `INSERT INTO task_assignments (task_id, assignee_type, assignee_id, role, assigned_by, assigned_at, is_active)
                     VALUES ($1, 'Employee', $2, 'Primary', $3, NOW(), true)`,
                    [taskId, toEmployeeId, requestedBy]
                );

                await client.query(
                    `UPDATE tasks SET assigned_to = ARRAY[$2::int] WHERE id = $1`,
                    [taskId, toEmployeeId]
                );
            }

            // IMMUTABLE History record
            await client.query(
                `INSERT INTO task_assignment_history (task_id, assignee_type, assignee_id, role, action, old_owner_id, new_owner_id, reason_code, comments, performed_by)
                 VALUES ($1, 'Employee', $2, 'Primary', $3, $4, $5, $6, $7, $8)`,
                [taskId, toEmployeeId || fromEmployeeId, transferType.toUpperCase(), fromEmployeeId, toEmployeeId || null, reasonCode, reasonDescription, requestedBy]
            );
        }

        // Audit Log
        await client.query(
            `INSERT INTO audit_logs (user_id, action, entity, description)
             VALUES ($1, 'TASK_TRANSFERRED', 'tasks', $2)`,
            [requestedBy, `Initiated ${transferType} for task #${taskId} (${reasonCode}). Status: ${initialStatus}`]
        );

        logActivityEvent(req, {
            eventType: 'Task Handover Requested',
            category: 'Workflow',
            module: 'Task Handover',
            severity: 'INFO',
            entityType: 'Task',
            entityId: taskId,
            action: 'Handover Requested',
            reason: reasonCode,
            impactType: 'Workload',
            impactDescription: `Handover requested (${reasonCode}): "${reasonDescription}"`,
            metadata: { transferType, requiresApproval, initialStatus }
        });

        await client.query('COMMIT');

        return res.status(201).json({
            success: true,
            message: requiresApproval ? 'Handover request submitted to Admin for review. Admin will evaluate and select new assignee.' : 'Task handover completed successfully',
            data: transfer
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error transferring task:', error);
        return res.status(500).json({ success: false, message: 'Failed to process task transfer: ' + error.message });
    } finally {
        client.release();
    }
};

/**
 * 👥 3. DELEGATE TASK
 */
export const delegateTask = async (req, res) => {
    req.body.transferType = 'Delegation';
    return transferTask(req, res);
};

/**
 * ↩️ 4. RETURN TASK
 */
export const returnTask = async (req, res) => {
    req.body.transferType = 'Return';
    if (!req.body.reasonCode) req.body.reasonCode = 'WORKLOAD';
    return transferTask(req, res);
};

/**
 * ⚡ 5. ESCALATE TASK
 */
export const escalateTask = async (req, res) => {
    const client = await pool.connect();
    try {
        const triggeredBy = getEmpId(req);
        const { taskId, escalationType = 'Manager', newPriority = 'High', escalatedToId = null, reason } = req.body;

        if (!taskId || !reason) {
            return res.status(400).json({ success: false, message: 'Task ID and escalation reason are required' });
        }

        await client.query('BEGIN');

        const taskRes = await client.query(`SELECT priority FROM tasks WHERE id = $1`, [taskId]);
        const oldPriority = taskRes.rows[0]?.priority || 'Medium';

        if (newPriority) {
            await client.query(`UPDATE tasks SET priority = $1, updated_at = NOW() WHERE id = $2`, [newPriority, taskId]);
        }

        const escRes = await client.query(
            `INSERT INTO task_escalations (task_id, escalation_type, triggered_by, old_priority, new_priority, escalated_to_id, reason)
             VALUES ($1, $2, 'Employee', $3, $4, $5, $6)
             RETURNING *`,
            [taskId, escalationType, oldPriority, newPriority, escalatedToId, reason]
        );

        await client.query(
            `INSERT INTO task_assignment_history (task_id, assignee_type, assignee_id, role, action, reason_code, comments, performed_by)
             VALUES ($1, 'Employee', $2, 'Primary', 'ESCALATED', 'EMERGENCY', $3, $4)`,
            [taskId, escalatedToId || triggeredBy, `Escalated to ${newPriority} priority: ${reason}`, triggeredBy]
        );

        await client.query('COMMIT');

        return res.status(201).json({
            success: true,
            message: `Task #${taskId} escalated to ${newPriority} priority successfully`,
            data: escRes.rows[0]
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error escalating task:', error);
        return res.status(500).json({ success: false, message: 'Failed to escalate task: ' + error.message });
    } finally {
        client.release();
    }
};

/**
 * ✅ 6. RESPOND TO TRANSFER APPROVAL (Admin Evaluates & Selects Target Assignee)
 */
export const respondToApproval = async (req, res) => {
    const client = await pool.connect();
    try {
        const approverId = getEmpId(req);
        const isAdminUser = req.user && req.user.role === 'Admin';
        const { approvalId, transferId, status, newAssigneeId, comments } = req.body; // status = 'Approved' or 'Rejected'

        if (!['Approved', 'Rejected'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid response status' });
        }

        if (status === 'Approved' && !newAssigneeId) {
            return res.status(400).json({ success: false, message: 'Admin must select a new assignee when approving a handover' });
        }

        await client.query('BEGIN');

        let targetTransferId = transferId;

        if (approvalId) {
            const appRes = await client.query(
                `UPDATE task_transfer_approvals 
                 SET status = $1, comments = $2, responded_at = NOW() 
                 WHERE id = $3 AND (approver_id = $4 OR $5 = true)
                 RETURNING transfer_id`,
                [status, comments || '', approvalId, approverId, isAdminUser]
            );
            if (appRes.rows.length > 0) {
                targetTransferId = appRes.rows[0].transfer_id;
            }
        }

        if (!targetTransferId) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Pending transfer request not found' });
        }

        // Update transfer record
        await client.query(
            `UPDATE task_transfers SET status = $1, to_employee_id = COALESCE($2, to_employee_id), updated_at = NOW() WHERE id = $3`,
            [status, newAssigneeId || null, targetTransferId]
        );

        const transferRes = await client.query(`SELECT * FROM task_transfers WHERE id = $1`, [targetTransferId]);
        const transfer = transferRes.rows[0];

        const targetEmployeeId = newAssigneeId || transfer.to_employee_id;

        if (status === 'Approved' && targetEmployeeId) {
            // EXECUTE ACTUAL HANDOVER TO ADMIN-SELECTED ASSIGNEE
            await client.query(
                `UPDATE task_assignments SET is_active = false, unassigned_at = NOW() WHERE task_id = $1 AND role = 'Primary' AND is_active = true`,
                [transfer.task_id]
            );

            await client.query(
                `INSERT INTO task_assignments (task_id, assignee_type, assignee_id, role, assigned_by, assigned_at, is_active)
                 VALUES ($1, 'Employee', $2, 'Primary', $3, NOW(), true)`,
                [transfer.task_id, targetEmployeeId, approverId]
            );

            await client.query(
                `UPDATE tasks SET assigned_to = ARRAY[$2::int] WHERE id = $1`,
                [transfer.task_id, targetEmployeeId]
            );

            // Fetch target employee name for audit
            const empRes = await client.query(`SELECT full_name FROM employees WHERE id = $1`, [targetEmployeeId]);
            const targetEmpName = empRes.rows[0]?.full_name || `#${targetEmployeeId}`;

            // IMMUTABLE History record
            await client.query(
                `INSERT INTO task_assignment_history (task_id, assignee_type, assignee_id, role, action, old_owner_id, new_owner_id, reason_code, comments, performed_by)
                 VALUES ($1, 'Employee', $2, 'Primary', 'TRANSFERRED', $3, $4, $5, $6, $7)`,
                [transfer.task_id, targetEmployeeId, transfer.from_employee_id, targetEmployeeId, transfer.reason_code, `Approved & Reassigned by Admin to ${targetEmpName}: ${comments || ''}`, approverId]
            );

            // Notify requester & new owner
            await client.query(
                `INSERT INTO notifications (title, message, type, recipient_id, sender_id)
                 VALUES ($1, $2, 'Handover Approved', $3, $4)`,
                ['Handover Request Approved', `Admin evaluated and approved handover for task #${transfer.task_id}, reassigned to ${targetEmpName}.`, transfer.requested_by, approverId]
            );

            await client.query(
                `INSERT INTO notifications (title, message, type, recipient_id, sender_id)
                 VALUES ($1, $2, 'New Task Assigned', $3, $4)`,
                ['New Task Assigned via Handover', `Admin assigned task #${transfer.task_id} to you after evaluating handover request.`, targetEmployeeId, approverId]
            );
        } else if (status === 'Rejected') {
            await client.query(
                `INSERT INTO notifications (title, message, type, recipient_id, sender_id)
                 VALUES ($1, $2, 'Handover Request Rejected', $3, $4)`,
                ['Handover Request Rejected', `Admin reviewed handover request for task #${transfer.task_id} and rejected it. Reason: ${comments || 'Not approved'}`, transfer.requested_by, approverId]
            );
        }

        await client.query('COMMIT');

        return res.json({
            success: true,
            message: status === 'Approved' ? `Handover approved! Task reassigned by Admin to Employee #${targetEmployeeId}.` : 'Handover request rejected.',
            data: transfer
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error responding to approval:', error);
        return res.status(500).json({ success: false, message: 'Failed to process approval: ' + error.message });
    } finally {
        client.release();
    }
};

/**
 * 📜 7. IMMUTABLE TASK TIMELINE
 */
export const getTaskTimeline = async (req, res) => {
    try {
        const { taskId } = req.params;

        const historyRes = await pool.query(
            `SELECT 
                h.id, h.action, h.reason_code, h.comments, h.created_at,
                h.role, h.assignee_type,
                old_emp.full_name AS old_owner_name,
                new_emp.full_name AS new_owner_name,
                by_emp.full_name AS performed_by_name
             FROM task_assignment_history h
             LEFT JOIN employees old_emp ON h.old_owner_id = old_emp.id
             LEFT JOIN employees new_emp ON h.new_owner_id = new_emp.id
             LEFT JOIN employees by_emp ON h.performed_by = by_emp.id
             WHERE h.task_id = $1
             ORDER BY h.created_at ASC`,
            [taskId]
        );

        return res.json({
            success: true,
            data: historyRes.rows
        });

    } catch (error) {
        console.error('Error fetching task timeline:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch timeline' });
    }
};

/**
 * 📊 8. HANDOVER & TRANSFER ANALYTICS
 */
export const getHandoverAnalytics = async (req, res) => {
    try {
        const reasonsRes = await pool.query(`
            SELECT reason_code, COUNT(*)::INT as count 
            FROM task_transfers 
            GROUP BY reason_code 
            ORDER BY count DESC
        `);

        const statusRes = await pool.query(`
            SELECT status, COUNT(*)::INT as count 
            FROM task_transfers 
            GROUP BY status
        `);

        const durationRes = await pool.query(`
            SELECT 
                COALESCE(AVG(EXTRACT(EPOCH FROM (COALESCE(unassigned_at, NOW()) - assigned_at)) / 3600), 0)::NUMERIC(10,2) as avg_ownership_hours
            FROM task_assignments
        `);

        const topDelegatedRes = await pool.query(`
            SELECT e.full_name, COUNT(tt.id)::INT as delegation_count
            FROM task_transfers tt
            JOIN employees e ON tt.to_employee_id = e.id
            WHERE tt.transfer_type = 'Delegation'
            GROUP BY e.full_name
            ORDER BY delegation_count DESC LIMIT 5
        `);

        return res.json({
            success: true,
            data: {
                reasonBreakdown: reasonsRes.rows,
                statusBreakdown: statusRes.rows,
                avgOwnershipHours: durationRes.rows[0]?.avg_ownership_hours || 0,
                topDelegatedEmployees: topDelegatedRes.rows
            }
        });

    } catch (error) {
        console.error('Analytics error:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch analytics' });
    }
};

/**
 * 📥 9. PENDING APPROVALS INBOX
 */
export const getPendingApprovals = async (req, res) => {
    try {
        const approverId = getEmpId(req);
        const isAdminUser = req.user && req.user.role === 'Admin';

        let pendingRes;
        if (isAdminUser) {
            pendingRes = await pool.query(`
                SELECT 
                    tt.id AS transfer_id, tta.id AS approval_id, tt.created_at,
                    tt.task_id, tt.transfer_type, tt.reason_code, tt.reason_description,
                    t.title AS task_title,
                    p.name AS project_name,
                    req_emp.full_name AS requested_by_name,
                    from_emp.full_name AS from_employee_name,
                    to_emp.full_name AS suggested_employee_name,
                    COALESCE(am.full_name, mgr_emp.full_name, 'Malhar (Admin / Lead)') AS project_head_name
                FROM task_transfers tt
                JOIN tasks t ON tt.task_id = t.id
                LEFT JOIN projects p ON t.project_id = p.id
                LEFT JOIN employees am ON p.account_manager_id = am.id
                JOIN employees req_emp ON tt.requested_by = req_emp.id
                LEFT JOIN employees from_emp ON tt.from_employee_id = from_emp.id
                LEFT JOIN employees to_emp ON tt.to_employee_id = to_emp.id
                LEFT JOIN employees mgr_emp ON req_emp.reporting_manager_id = mgr_emp.id
                LEFT JOIN task_transfer_approvals tta ON tt.id = tta.transfer_id
                WHERE tt.status = 'Pending Approval'
                ORDER BY tt.created_at DESC
            `);
        } else {
            pendingRes = await pool.query(`
                SELECT 
                    tta.id AS approval_id, tt.id AS transfer_id, tta.approval_order, tta.created_at,
                    tt.task_id, tt.transfer_type, tt.reason_code, tt.reason_description,
                    t.title AS task_title,
                    p.name AS project_name,
                    req_emp.full_name AS requested_by_name,
                    from_emp.full_name AS from_employee_name,
                    to_emp.full_name AS suggested_employee_name,
                    COALESCE(am.full_name, mgr_emp.full_name, 'Malhar (Admin / Lead)') AS project_head_name
                FROM task_transfer_approvals tta
                JOIN task_transfers tt ON tta.transfer_id = tt.id
                JOIN tasks t ON tt.task_id = t.id
                LEFT JOIN projects p ON t.project_id = p.id
                LEFT JOIN employees am ON p.account_manager_id = am.id
                JOIN employees req_emp ON tt.requested_by = req_emp.id
                LEFT JOIN employees from_emp ON tt.from_employee_id = from_emp.id
                LEFT JOIN employees to_emp ON tt.to_employee_id = to_emp.id
                LEFT JOIN employees mgr_emp ON req_emp.reporting_manager_id = mgr_emp.id
                WHERE tta.approver_id = $1 AND tta.status = 'Pending'
                ORDER BY tta.created_at DESC
            `, [approverId]);
        }

        return res.json({
            success: true,
            data: pendingRes.rows
        });

    } catch (error) {
        console.error('Pending approvals error:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch pending approvals' });
    }
};
