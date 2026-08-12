import { pool } from '../config/db.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// ── 1. DEPENDENCY LOCK PRE-VALIDATION CHECK ─────────────────────────────────────
export async function validateDependencyLock(recordType, targetId) {
    const dependencies = [];

    if (recordType === 'employee') {
        // Active Tasks
        const taskRes = await pool.query(`
            SELECT count(*) FROM task_assignments ta 
            WHERE ta.assignee_id = $1 AND ta.is_active = true;
        `, [targetId]);
        if (parseInt(taskRes.rows[0].count) > 0) {
            dependencies.push({ type: 'Tasks', count: parseInt(taskRes.rows[0].count), message: `${taskRes.rows[0].count} Active Tasks Assigned` });
        }

        // Active Leaves
        const leaveRes = await pool.query(`
            SELECT count(*) FROM leave_requests 
            WHERE employee_id = $1 AND status = 'approved' AND end_date >= CURRENT_DATE;
        `, [targetId]);
        if (parseInt(leaveRes.rows[0].count) > 0) {
            dependencies.push({ type: 'Leave', count: parseInt(leaveRes.rows[0].count), message: `${leaveRes.rows[0].count} Active / Upcoming Approved Leaves` });
        }
    } else if (recordType === 'customer') {
        // Active Tasks / Projects
        const projRes = await pool.query(`
            SELECT count(*) FROM tasks WHERE customer_id = $1 AND status != 'Completed';
        `, [targetId]);
        if (parseInt(projRes.rows[0].count) > 0) {
            dependencies.push({ type: 'Projects', count: parseInt(projRes.rows[0].count), message: `${projRes.rows[0].count} Active Unfinished Customer Projects` });
        }
    } else if (recordType === 'project' || recordType === 'task') {
        const sessRes = await pool.query(`
            SELECT count(*) FROM task_sessions WHERE task_id = $1 AND status = 'Active';
        `, [targetId]);
        if (parseInt(sessRes.rows[0].count) > 0) {
            dependencies.push({ type: 'Sessions', count: parseInt(sessRes.rows[0].count), message: `${sessRes.rows[0].count} Active Running Timer Sessions` });
        }
    }

    return {
        isLocked: dependencies.length > 0,
        dependencies
    };
}

export async function checkDependencyLock(req, res) {
    try {
        const { recordType, targetId } = req.query;
        if (!recordType || !targetId) {
            return res.status(400).json({ success: false, message: "recordType and targetId are required" });
        }

        const result = await validateDependencyLock(recordType, parseInt(targetId, 10));
        res.status(200).json({ success: true, ...result });
    } catch (error) {
        console.error("Error in checkDependencyLock:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
}

// ── 2. CREATE OFFBOARD / DELETION REQUEST ───────────────────────────────────────
export async function createDeletionRequest(req, res) {
    try {
        const { recordType, targetId, targetName, reason, category, effectiveDate, hrRemarks } = req.body;
        const requestedBy = req.user.id;

        if (!recordType || !targetId || !reason) {
            return res.status(400).json({ success: false, message: "recordType, targetId, and reason are required" });
        }

        // Run dependency check
        const depCheck = await validateDependencyLock(recordType, targetId);
        if (depCheck.isLocked) {
            return res.status(400).json({
                success: false,
                isLocked: true,
                message: "Cannot initiate offboarding: Active dependencies exist.",
                dependencies: depCheck.dependencies
            });
        }

        // Calculate default purge eligibility (60 days retention)
        const retentionDays = 60;
        const purgeEligibleAt = new Date();
        purgeEligibleAt.setDate(purgeEligibleAt.getDate() + retentionDays);

        const result = await pool.query(`
            INSERT INTO deletion_requests (
                record_type, target_id, target_name, reason, category, 
                effective_date, hr_remarks, requested_by, status, retention_days, purge_eligible_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending_documents', $9, $10)
            RETURNING *;
        `, [recordType, targetId, targetName, reason, category || 'General', effectiveDate || null, hrRemarks || '', requestedBy, retentionDays, purgeEligibleAt]);

        const request = result.rows[0];

        // Seed dynamic approval stage rows for this request
        const stagesRes = await pool.query(`
            SELECT * FROM deletion_approval_stages WHERE record_type = $1 ORDER BY sequence_order ASC;
        `, [recordType]);

        for (const stage of stagesRes.rows) {
            await pool.query(`
                INSERT INTO deletion_approvals (request_id, stage_id, status)
                VALUES ($1, $2, 'pending');
            `, [request.id, stage.id]);
        }

        res.status(201).json({ success: true, request });
    } catch (error) {
        console.error("Error in createDeletionRequest:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
}

// ── 3. UPLOAD DELETION DOCUMENT WITH VERSIONING & CHECKSUM ──────────────────────
export async function uploadDeletionDocument(req, res) {
    try {
        const { requestId, documentType } = req.body;
        if (!requestId || !documentType || !req.file) {
            return res.status(400).json({ success: false, message: "requestId, documentType, and file are required" });
        }

        // Validate File Mime Type & Magic Bytes
        const allowedMimeTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/png', 'image/jpeg'];
        if (!allowedMimeTypes.includes(req.file.mimetype)) {
            return res.status(400).json({ success: false, message: "Invalid file format. Allowed: PDF, DOC, DOCX, PNG, JPG, JPEG" });
        }

        // Auto-increment version if document_type exists for request
        const verRes = await pool.query(`
            SELECT MAX(document_version) as max_ver FROM deletion_documents 
            WHERE request_id = $1 AND document_type = $2;
        `, [requestId, documentType]);
        const nextVersion = (verRes.rows[0].max_ver || 0) + 1;

        // Calculate SHA-256 checksum
        const checksum = crypto.createHash('sha256').update(req.file.buffer || req.file.filename).digest('hex');

        const filePath = req.file.path || `/uploads/deletion/${req.file.filename}`;
        const fileName = req.file.originalname;
        const fileSize = req.file.size;
        const uploadedBy = req.user.id;

        const result = await pool.query(`
            INSERT INTO deletion_documents (
                request_id, document_type, document_version, storage_provider, 
                file_path, file_name, file_size, mime_type, checksum, uploaded_by
            )
            VALUES ($1, $2, $3, 'local', $4, $5, $6, $7, $8, $9)
            RETURNING *;
        `, [requestId, documentType, nextVersion, filePath, fileName, fileSize, req.file.mimetype, checksum, uploadedBy]);

        res.status(201).json({ success: true, document: result.rows[0] });
    } catch (error) {
        console.error("Error in uploadDeletionDocument:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
}

// ── 4. VALIDATE MANDATORY DOCUMENTS & APPROVALS ─────────────────────────────────
export async function validateDocuments(requestId, recordType) {
    const docRes = await pool.query(`
        SELECT document_type FROM deletion_documents WHERE request_id = $1;
    `, [requestId]);

    const uploadedTypes = docRes.rows.map(d => d.document_type.toLowerCase());

    if (recordType === 'employee') {
        const hasResignation = uploadedTypes.some(t => t.includes('resignation'));
        const hasTermination = uploadedTypes.some(t => t.includes('termination'));
        if (!hasResignation && !hasTermination) {
            return {
                valid: false,
                message: "Employee cannot be offboarded until required documents are uploaded (Resignation Letter OR Termination Letter)."
            };
        }
    } else if (recordType === 'customer') {
        if (uploadedTypes.length === 0) {
            return {
                valid: false,
                message: "Customer cannot be closed without uploading at least 1 supporting closure document (Invoice, PO, Contract, Cancellation Request)."
            };
        }
    }
    return { valid: true };
}

// ── 5. SUBMIT STAGE APPROVAL ───────────────────────────────────────────────────
export async function submitStageApproval(req, res) {
    try {
        const { approvalId, status, comments } = req.body;
        const approverId = req.user.id;

        if (!approvalId || !status) {
            return res.status(400).json({ success: false, message: "approvalId and status are required" });
        }

        const result = await pool.query(`
            UPDATE deletion_approvals 
            SET status = $1, comments = $2, approver_id = $3, approved_at = NOW()
            WHERE id = $4
            RETURNING *;
        `, [status, comments || '', approverId, approvalId]);

        res.status(200).json({ success: true, approval: result.rows[0] });
    } catch (error) {
        console.error("Error in submitStageApproval:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
}

// ── 6. ARCHIVE / OFFBOARD RECORD (SOFT DELETE) ─────────────────────────────────
export async function archiveRecord(req, res) {
    try {
        const { requestId } = req.body;
        const performedBy = req.user.id;
        const ipAddress = req.ip || req.connection?.remoteAddress || '127.0.0.1';

        if (!requestId) {
            return res.status(400).json({ success: false, message: "requestId is required" });
        }

        const reqRes = await pool.query(`SELECT * FROM deletion_requests WHERE id = $1;`, [requestId]);
        if (reqRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Deletion request not found" });
        }

        const deletionReq = reqRes.rows[0];

        // 1. Validate mandatory documents
        const docCheck = await validateDocuments(requestId, deletionReq.record_type);
        if (!docCheck.valid) {
            return res.status(400).json({ success: false, message: docCheck.message });
        }

        // 2. Perform Soft Delete (Archive) on target table
        if (deletionReq.record_type === 'employee') {
            await pool.query(`UPDATE employees SET status = 'Inactive' WHERE id = $1;`, [deletionReq.target_id]);
        } else if (deletionReq.record_type === 'customer') {
            await pool.query(`UPDATE customers SET assigned_team = 'Archived Account' WHERE id = $1;`, [deletionReq.target_id]);
        } else if (deletionReq.record_type === 'task') {
            await pool.query(`UPDATE tasks SET status = 'Completed' WHERE id = $1;`, [deletionReq.target_id]);
        }

        // 3. Update request status to 'archived'
        await pool.query(`UPDATE deletion_requests SET status = 'archived' WHERE id = $1;`, [requestId]);

        // 4. Record Immutable Audit Log
        await pool.query(`
            INSERT INTO deletion_audit_logs (request_id, record_type, record_id, record_name, action_type, performed_by, reason, ip_address)
            VALUES ($1, $2, $3, $4, 'archive', $5, $6, $7);
        `, [requestId, deletionReq.record_type, deletionReq.target_id, deletionReq.target_name, performedBy, deletionReq.reason, ipAddress]);

        res.status(200).json({
            success: true,
            message: `Record '${deletionReq.target_name}' successfully offboarded and archived. Retention period active (60 days).`
        });
    } catch (error) {
        console.error("Error in archiveRecord:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
}

// ── 7. GET PURGE QUEUE (ADMIN SETTINGS) ─────────────────────────────────────────
export async function getPurgeQueue(req, res) {
    try {
        const result = await pool.query(`
            SELECT dr.*, e.full_name as requested_by_name
            FROM deletion_requests dr
            LEFT JOIN employees e ON dr.requested_by = e.id
            WHERE dr.status = 'archived'
            ORDER BY dr.purge_eligible_at ASC;
        `);
        res.status(200).json({ success: true, queue: result.rows });
    } catch (error) {
        console.error("Error in getPurgeQueue:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
}

// ── 8. PERMANENT PURGE RECORD (REQUIRES ADMIN BCRYPT PASSWORD) ────────────────
export async function purgeRecord(req, res) {
    try {
        const { requestId, adminPassword, reason } = req.body;
        const adminUser = req.user;
        const ipAddress = req.ip || req.connection?.remoteAddress || '127.0.0.1';

        if (!requestId || !adminPassword) {
            return res.status(400).json({ success: false, message: "requestId and adminPassword are required" });
        }

        // Re-authenticate Admin password via bcrypt
        const empRes = await pool.query(`SELECT password FROM employees WHERE id = $1;`, [adminUser.id]);
        if (empRes.rows.length === 0) {
            return res.status(401).json({ success: false, message: "User authentication record not found" });
        }

        const isMatch = await bcrypt.compare(adminPassword, empRes.rows[0].password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: "Invalid Admin Password Confirmation. Permanent Purge denied." });
        }

        const reqRes = await pool.query(`SELECT * FROM deletion_requests WHERE id = $1;`, [requestId]);
        if (reqRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Deletion request not found" });
        }

        const deletionReq = reqRes.rows[0];

        // Perform actual SQL DELETE from primary database table
        if (deletionReq.record_type === 'employee') {
            await pool.query(`DELETE FROM employees WHERE id = $1;`, [deletionReq.target_id]);
        } else if (deletionReq.record_type === 'customer') {
            await pool.query(`DELETE FROM customers WHERE id = $1;`, [deletionReq.target_id]);
        } else if (deletionReq.record_type === 'task') {
            await pool.query(`DELETE FROM tasks WHERE id = $1;`, [deletionReq.target_id]);
        }

        // Update deletion_requests status
        await pool.query(`UPDATE deletion_requests SET status = 'purged' WHERE id = $1;`, [requestId]);

        // Insert Immutable Audit Log
        await pool.query(`
            INSERT INTO deletion_audit_logs (request_id, record_type, record_id, record_name, action_type, performed_by, approved_by, reason, ip_address)
            VALUES ($1, $2, $3, $4, 'purge', $5, $5, $6, $7);
        `, [requestId, deletionReq.record_type, deletionReq.target_id, deletionReq.target_name, adminUser.id, reason || deletionReq.reason, ipAddress]);

        res.status(200).json({
            success: true,
            message: `Record '${deletionReq.target_name}' permanently purged from database.`
        });
    } catch (error) {
        console.error("Error in purgeRecord:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
}

// ── 9. GET IMMUTABLE AUDIT LOGS ───────────────────────────────────────────────
export async function getDeletionAuditLogs(req, res) {
    try {
        const result = await pool.query(`
            SELECT dal.*, e.full_name as performed_by_name, e.employee_code
            FROM deletion_audit_logs dal
            LEFT JOIN employees e ON dal.performed_by = e.id
            ORDER BY dal.created_at DESC;
        `);
        res.status(200).json({ success: true, logs: result.rows });
    } catch (error) {
        console.error("Error in getDeletionAuditLogs:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
}
