import { pool } from '../config/db.js';
import { sendWhatsAppTemplate, sendWhatsAppText, sanitizePhoneNumber } from '../services/whatsapp.service.js';

export function formatTurnaroundTime(createdAt, resolvedAt = new Date()) {
    try {
        if (typeof createdAt === 'number') {
            const totalMinutes = Math.max(1, Math.round(createdAt / 60));
            const hours = Math.floor(totalMinutes / 60);
            const mins = totalMinutes % 60;
            if (hours > 0 && mins > 0) return `${hours} hr ${mins} min`;
            if (hours > 0) return `${hours} hr`;
            return `${mins} min`;
        }

        const start = new Date(createdAt).getTime();
        const end = new Date(resolvedAt).getTime();
        let diffMs = Math.abs(end - start);

        const totalMinutes = Math.max(1, Math.round(diffMs / 60000));
        const hours = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        if (hours > 0 && mins > 0) return `${hours} hr ${mins} min`;
        if (hours > 0) return `${hours} hr`;
        return `${mins} min`;
    } catch (e) {
        return 'Completed';
    }
}

export async function createTicketInboxNotifications({
    ticketCode,
    title,
    description = '',
    priority = 'High',
    assignedToId = null,
    assignedTeam = [],
    customerName = 'Valued Client',
    projectName = 'General Project',
    actionType = 'created',
    attachments = []
}) {
    try {
        const targetEmployeeIds = new Set();
        if (assignedToId) targetEmployeeIds.add(parseInt(assignedToId, 10));

        if (Array.isArray(assignedTeam)) {
            for (const item of assignedTeam) {
                if (typeof item === 'object' && item && item.id) targetEmployeeIds.add(parseInt(item.id, 10));
                else if (typeof item === 'number') targetEmployeeIds.add(item);
                else if (typeof item === 'string' && /^\d+$/.test(item)) targetEmployeeIds.add(parseInt(item, 10));
            }
        }

        // If no employee assigned, default to Malhar (9) & Nitin (10)
        if (targetEmployeeIds.size === 0) {
            targetEmployeeIds.add(9);
            targetEmployeeIds.add(10);
        }

        let notifTitle = `Assigned Support Ticket: ${ticketCode}`;
        if (actionType === 'resolved') {
            notifTitle = `Support Ticket Resolved: ${ticketCode}`;
        } else if (actionType === 'transferred') {
            notifTitle = `Support Ticket Transferred to You: ${ticketCode}`;
        } else if (actionType === 'reopened') {
            notifTitle = `Support Ticket Reopened: ${ticketCode}`;
        }
        
        const notifMessage = `Customer: ${customerName}\nProject: ${projectName}\nPriority: ${priority}\n\n${description || title}`;
        const notifLink = `/admin-support.html?ticket_code=${ticketCode}`;
        
        const metadata = {
            ticket_code: ticketCode,
            title: title,
            description: description || title,
            customer_name: customerName,
            project_name: projectName,
            priority: priority,
            action_type: actionType,
            attachments: Array.isArray(attachments) ? attachments : (attachments ? [attachments] : [])
        };

        for (const empId of targetEmployeeIds) {
            if (!empId) continue;
            await pool.query(`
                INSERT INTO notifications (
                    recipient_id, type, title, message, link, is_read, created_at, metadata
                ) VALUES ($1, 'Support Ticket', $2, $3, $4, false, NOW(), $5)
            `, [
                empId,
                notifTitle,
                notifMessage,
                notifLink,
                JSON.stringify(metadata)
            ]);
        }
        console.log(`✅ Inbox notifications created for employees: [${Array.from(targetEmployeeIds).join(', ')}] for ticket ${ticketCode}`);
    } catch (err) {
        console.error("❌ Error creating ticket inbox notifications:", err.message);
    }
}

export async function notifyTicketWhatsApp({
    ticketCode,
    title,
    description = '',
    priority = 'High',
    assignedToId = null,
    assignedTeam = [],
    customerName = 'Valued Client',
    projectName = 'General Project',
    actionType = 'created',
    turnaroundTime = '',
    attachments = []
}) {
    try {
        // Automatically ensure Employee Inbox notification is placed
        await createTicketInboxNotifications({
            ticketCode,
            title,
            description,
            priority,
            assignedToId,
            assignedTeam,
            customerName,
            projectName,
            actionType,
            attachments
        });

        const targetEmployeeIds = new Set();
        if (assignedToId) targetEmployeeIds.add(parseInt(assignedToId, 10));

        if (Array.isArray(assignedTeam)) {
            for (const item of assignedTeam) {
                if (typeof item === 'object' && item && item.id) targetEmployeeIds.add(parseInt(item.id, 10));
                else if (typeof item === 'number') targetEmployeeIds.add(item);
                else if (typeof item === 'string' && /^\d+$/.test(item)) targetEmployeeIds.add(parseInt(item, 10));
            }
        }

        const phoneList = [];

        if (targetEmployeeIds.size > 0) {
            const empRes = await pool.query(
                "SELECT id, full_name, phone, whatsapp_no FROM employees WHERE id = ANY($1::int[]);",
                [Array.from(targetEmployeeIds)]
            );
            for (const emp of empRes.rows) {
                const targetPhone = emp.whatsapp_no || emp.phone;
                if (targetPhone) {
                    phoneList.push({ name: emp.full_name, phone: sanitizePhoneNumber(targetPhone) });
                } else {
                    // Smart fallback for named team members
                    if (emp.full_name?.toLowerCase().includes('malhar') || emp.id === 9) {
                        phoneList.push({ name: emp.full_name || 'Malhar Kulkarni', phone: '919082270423' });
                    } else if (emp.full_name?.toLowerCase().includes('nitin') || emp.id === 10) {
                        phoneList.push({ name: emp.full_name || 'Nitin RajGuru', phone: '918767137790' });
                    } else if (emp.full_name?.toLowerCase().includes('vijay') || emp.id === 15) {
                        phoneList.push({ name: emp.full_name || 'Vijay Mourya', phone: '919876543210' });
                    }
                }
            }
        }

        // Always fallback to lead engineer if list is empty
        if (phoneList.length === 0) {
            phoneList.push({ name: 'Malhar Kulkarni', phone: '919082270423' });
            phoneList.push({ name: 'Nitin RajGuru', phone: '918767137790' });
        }

        // Always ensure Escalation Head (Shrirang Joshi) is alerted
        if (!phoneList.some(p => p.phone === '919821027060')) {
            phoneList.push({ name: 'Shrirang Joshi (Escalation Head)', phone: '919821027060' });
        }

        let attachmentText = '';
        if (Array.isArray(attachments) && attachments.length > 0) {
            const names = attachments.map(a => typeof a === 'string' ? a : (a.name || a.filename || 'Attachment')).join(', ');
            attachmentText = `\nAttachment: ${names}`;
        }

        for (const target of phoneList) {
            try {
                if (actionType === 'resolved') {
                    const resolveMsg = `Support Ticket Resolved\n\nTicket: ${ticketCode}\nCustomer: ${customerName}\nProject: ${projectName}\nTurnaround: ${turnaroundTime || 'Completed'}\n\nTicket marked resolved and client notified.`;
                    await sendWhatsAppText(target.phone, resolveMsg);
                } else if (actionType === 'transferred') {
                    const transferMsg = `Support Ticket Transferred\n\nTicket: ${ticketCode}\nCustomer: ${customerName}\nProject: ${projectName}\nPriority: ${priority}\nIssue: ${title}\n\nA colleague has transferred this ticket to you for resolution.\nPortal: https://planex.pentasoftconsultancy.com/admin-support.html`;
                    await sendWhatsAppText(target.phone, transferMsg);
                } else if (actionType === 'reopened') {
                    const reopenMsg = `Support Ticket Reopened\n\nTicket: ${ticketCode}\nCustomer: ${customerName}\nProject: ${projectName}\nPriority: ${priority}\nIssue: ${title}\n\nTicket has been reopened for additional resolution work.\nPortal: https://planex.pentasoftconsultancy.com/admin-support.html`;
                    await sendWhatsAppText(target.phone, reopenMsg);
                } else {
                    const alertMsg = `Support Ticket Assigned\n\nTicket: ${ticketCode}\nCustomer: ${customerName}\nProject: ${projectName}\nPriority: ${priority}\nIssue: ${title}${attachmentText}\n\nResolution Timer Started.\nPortal: https://planex.pentasoftconsultancy.com/admin-support.html`;
                    await sendWhatsAppText(target.phone, alertMsg);
                }
                console.log(`✅ WhatsApp support ticket notification (${actionType}) sent to ${target.name} (${target.phone})`);
            } catch (sendErr) {
                console.error(`❌ Failed to send WhatsApp ticket alert to ${target.phone}:`, sendErr.message);
            }
        }
    } catch (err) {
        console.error("WhatsApp Ticket alert error:", err.message);
    }
}

// Helper to calculate SLA deadlines based on Priority
function calculateSlaDeadlines(priority) {
    const now = new Date();
    let respMinutes = 480; // Default Medium: 8 hrs
    let resoMinutes = 4320; // Default Medium: 3 Days (72 hrs)

    const pri = (priority || 'Medium').toLowerCase();

    if (pri === 'critical') {
        respMinutes = 30; // 30 min
        resoMinutes = 240; // 4 hrs
    } else if (pri === 'high') {
        respMinutes = 120; // 2 hrs
        resoMinutes = 1440; // 24 hrs
    } else if (pri === 'medium') {
        respMinutes = 480; // 8 hrs
        resoMinutes = 4320; // 3 Days
    } else if (pri === 'low') {
        respMinutes = 1440; // 24 hrs
        resoMinutes = 10080; // 7 Days
    }

    const responseDeadline = new Date(now.getTime() + respMinutes * 60000);
    const resolutionDeadline = new Date(now.getTime() + resoMinutes * 60000);

    return { responseDeadline, resolutionDeadline };
}

// Generate next auto-incrementing Ticket Code (e.g. SUP-000101)
async function generateTicketCode() {
    try {
        const res = await pool.query(`SELECT id FROM support_tickets ORDER BY id DESC LIMIT 1`);
        const nextId = (res.rows[0]?.id || 0) + 101;
        return `SUP-${String(nextId).padStart(6, '0')}`;
    } catch (e) {
        return `SUP-${Date.now().toString().slice(-6)}`;
    }
}

// GET /api/v1/support - List tickets with filters & counts
export const getTickets = async (req, res) => {
    try {
        const { search, status, priority, category, customer_id, employee_id, assigned_to, from_date, to_date, from, to } = req.query;

        let conditions = [];
        let params = [];
        let idx = 1;

        if (status && status !== 'all') {
            conditions.push(`t.status = $${idx++}`);
            params.push(status);
        }
        if (priority && priority !== 'all') {
            conditions.push(`t.priority = $${idx++}`);
            params.push(priority);
        }
        if (category && category !== 'all') {
            conditions.push(`t.category = $${idx++}`);
            params.push(category);
        }
        if (customer_id && customer_id !== 'all') {
            conditions.push(`t.customer_id = $${idx++}`);
            params.push(customer_id);
        }

        const chosenEmp = employee_id || assigned_to;
        if (chosenEmp && chosenEmp !== 'all') {
            conditions.push(`(t.assigned_to = $${idx} OR t.assigned_team::text ILIKE $${idx + 1})`);
            params.push(parseInt(chosenEmp, 10) || 0);
            params.push(`%"id":${chosenEmp}%`);
            idx += 2;
        }

        const fromDateVal = from_date || from;
        if (fromDateVal) {
            conditions.push(`DATE(t.created_at) >= $${idx++}`);
            params.push(fromDateVal);
        }

        const toDateVal = to_date || to;
        if (toDateVal) {
            conditions.push(`DATE(t.created_at) <= $${idx++}`);
            params.push(toDateVal);
        }

        if (search) {
            conditions.push(`(t.ticket_code ILIKE $${idx} OR t.title ILIKE $${idx} OR t.reported_by ILIKE $${idx} OR c.name ILIKE $${idx} OR e.full_name ILIKE $${idx})`);
            params.push(`%${search}%`);
            idx++;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const queryText = `
            SELECT 
                t.*,
                c.name AS customer_name,
                COALESCE(t.project_name, p.name, 'General') AS project_name,
                w.name AS workflow_title,
                wt.title AS task_name,
                e.full_name AS assigned_to_name,
                COALESCE(st_agg.total_subtasks, 0)::int AS total_subtasks,
                COALESCE(st_agg.completed_subtasks, 0)::int AS completed_subtasks
            FROM support_tickets t
            LEFT JOIN customers c ON t.customer_id = c.id
            LEFT JOIN projects p ON t.project_id = p.id
            LEFT JOIN workflows w ON t.workflow_id = w.id
            LEFT JOIN tasks wt ON t.task_id = wt.id
            LEFT JOIN employees e ON t.assigned_to = e.id
            LEFT JOIN (
                SELECT 
                    ticket_id,
                    COUNT(*) AS total_subtasks,
                    COUNT(CASE WHEN status = 'Completed' THEN 1 END) AS completed_subtasks
                FROM ticket_subtasks
                GROUP BY ticket_id
            ) st_agg ON t.id = st_agg.ticket_id
            ${whereClause}
            ORDER BY 
                CASE 
                    WHEN t.priority = 'Critical' THEN 1
                    WHEN t.priority = 'High' THEN 2
                    WHEN t.priority = 'Medium' THEN 3
                    ELSE 4
                END,
                t.created_at DESC
        `;

        const result = await pool.query(queryText, params);

        // Compute metrics
        const metricsRes = await pool.query(`
            SELECT 
                COUNT(*)::int AS total,
                COUNT(CASE WHEN status IN ('Open', 'Assigned', 'In Progress') THEN 1 END)::int AS active_open,
                COUNT(CASE WHEN status = 'Waiting Customer' THEN 1 END)::int AS waiting_customer,
                COUNT(CASE WHEN status = 'Resolved' AND DATE(resolved_at) = CURRENT_DATE THEN 1 END)::int AS resolved_today,
                COUNT(CASE WHEN status NOT IN ('Resolved', 'Closed') AND NOW() > resolution_deadline THEN 1 END)::int AS sla_breaches
            FROM support_tickets
        `);

        return res.json({
            success: true,
            data: result.rows,
            metrics: metricsRes.rows[0] || { total: 0, active_open: 0, waiting_customer: 0, resolved_today: 0, sla_breaches: 0 }
        });
    } catch (error) {
        console.error('Error fetching support tickets:', error);
        return res.status(500).json({ success: false, message: 'Server error fetching support tickets' });
    }
};

// GET /api/v1/support/:id - Single ticket details, comments, history, subtasks
export const getTicketById = async (req, res) => {
    try {
        const { id } = req.params;

        const isNumeric = /^\d+$/.test(id);
        const whereCond = isNumeric ? `t.id = $1` : `t.ticket_code = $1`;

        const ticketRes = await pool.query(`
            SELECT 
                t.*,
                c.name AS customer_name,
                COALESCE(t.project_name, p.name, 'General') AS project_name,
                w.name AS workflow_title,
                wt.title AS task_name,
                e.full_name AS assigned_to_name,
                u.email AS assigned_to_email
            FROM support_tickets t
            LEFT JOIN customers c ON t.customer_id = c.id
            LEFT JOIN projects p ON t.project_id = p.id
            LEFT JOIN workflows w ON t.workflow_id = w.id
            LEFT JOIN tasks wt ON t.task_id = wt.id
            LEFT JOIN employees e ON t.assigned_to = e.id
            LEFT JOIN users u ON e.user_id = u.id
            WHERE ${whereCond}
        `, [id]);

        if (ticketRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Support ticket not found' });
        }

        const ticket = ticketRes.rows[0];

        // Fetch subtasks
        const subtasksRes = await pool.query(`
            SELECT 
                st.*,
                e.full_name AS assigned_to_name,
                e.role AS assigned_to_role,
                cb.full_name AS completed_by_name,
                dep.title AS depends_on_title,
                dep.status AS depends_on_status
            FROM ticket_subtasks st
            LEFT JOIN employees e ON st.assigned_to = e.id
            LEFT JOIN employees cb ON st.completed_by = cb.id
            LEFT JOIN ticket_subtasks dep ON st.depends_on_subtask_id = dep.id
            WHERE st.ticket_id = $1
            ORDER BY st.sequence_order ASC, st.created_at ASC
        `, [ticket.id]);

        // Fetch comments
        const commentsRes = await pool.query(`
            SELECT * FROM support_ticket_comments 
            WHERE ticket_id = $1 
            ORDER BY created_at ASC
        `, [ticket.id]);

        // Fetch history timeline
        const historyRes = await pool.query(`
            SELECT * FROM support_ticket_history 
            WHERE ticket_id = $1 
            ORDER BY created_at DESC
        `, [ticket.id]);

        return res.json({
            success: true,
            data: {
                ...ticket,
                subtasks: subtasksRes.rows,
                comments: commentsRes.rows,
                history: historyRes.rows
            }
        });
    } catch (error) {
        console.error('Error fetching ticket details:', error);
        return res.status(500).json({ success: false, message: 'Server error fetching ticket details' });
    }
};


// POST /api/v1/support - Create ticket
export const createTicket = async (req, res) => {
    try {
        const {
            customer_id,
            project_id,
            project_name,
            workflow_id,
            task_id,
            reported_by,
            title,
            description,
            category,
            priority,
            assigned_to,
            assigned_team,
            customer_phone,
            source,
            attachments
        } = req.body;

        if (!customer_id || !title) {
            return res.status(400).json({ success: false, message: 'Customer and Title are required fields' });
        }

        let customerName = 'Valued Customer';
        const custRes = await pool.query(`SELECT name, branches, assigned_employees FROM customers WHERE id = $1`, [customer_id]);
        if (custRes.rows.length > 0) {
            customerName = custRes.rows[0].name;
        }

        const ticket_code = await generateTicketCode();
        const { responseDeadline, resolutionDeadline } = calculateSlaDeadlines(priority);

        const assignedToVal = assigned_to ? parseInt(assigned_to, 10) : (req.user?.employee_id || null);
        const reportedByVal = reported_by || (req.user?.full_name ? `${req.user.full_name}` : 'Customer Admin');
        const initialStatus = (assignedToVal || (assigned_team && assigned_team.length > 0)) ? 'Assigned' : 'Open';
        const attachmentsJson = JSON.stringify(attachments || []);
        const assignedTeamJson = JSON.stringify(assigned_team || []);

        const insertQuery = `
            INSERT INTO support_tickets (
                ticket_code, customer_id, project_id, project_name, workflow_id, task_id,
                reported_by, title, description, category, priority,
                status, assigned_to, assigned_team, customer_phone, source,
                response_deadline, resolution_deadline, attachments
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
            RETURNING *
        `;

        const result = await pool.query(insertQuery, [
            ticket_code,
            customer_id,
            project_id || null,
            project_name || null,
            workflow_id || null,
            task_id || null,
            reportedByVal,
            title,
            description || '',
            category || 'Bug',
            priority || 'Medium',
            initialStatus,
            assignedToVal || null,
            assignedTeamJson,
            customer_phone || null,
            source || (req.user?.role === 'Employee' ? 'EMPLOYEE_PORTAL' : 'WEB'),
            responseDeadline,
            resolutionDeadline,
            attachmentsJson
        ]);

        const newTicket = result.rows[0];

        // Asynchronously notify assigned engineers on WhatsApp & Employee Inbox
        notifyTicketWhatsApp({
            ticketCode: ticket_code,
            title,
            description: description || '',
            priority: priority || 'Medium',
            assignedToId: assigned_to ? parseInt(assigned_to, 10) : null,
            assignedTeam: assigned_team || [],
            customerName,
            projectName: project_name || 'General Project',
            actionType: 'created',
            attachments: attachments || []
        });

        // Log initial timeline event
        await pool.query(`
            INSERT INTO support_ticket_history (ticket_id, performed_by, action, previous_status, new_status, details)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [
            newTicket.id,
            req.user?.full_name || 'System Admin',
            'Ticket Created',
            null,
            initialStatus,
            `Support Ticket ${ticket_code} logged for ${customerName}.`
        ]);

        return res.status(201).json({
            success: true,
            message: `Support Ticket ${ticket_code} created successfully!`,
            data: newTicket
        });
    } catch (error) {
        console.error('Error creating support ticket:', error);
        return res.status(500).json({ success: false, message: 'Server error creating support ticket' });
    }
};

// PUT /api/v1/support/:id - Edit / Update Ticket Details
export const updateTicket = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, category, priority, status, assigned_to, assigned_team, customer_id, project_id, project_name } = req.body;

        const ticketRes = await pool.query(`
            SELECT t.*, c.name AS customer_name 
            FROM support_tickets t
            LEFT JOIN customers c ON t.customer_id = c.id
            WHERE t.id = $1
        `, [id]);

        if (ticketRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Ticket not found' });
        }

        const ticket = ticketRes.rows[0];
        const oldPriority = ticket.priority;
        const oldStatus = ticket.status;

        let responseDeadline = ticket.response_deadline;
        let resolutionDeadline = ticket.resolution_deadline;

        // Recompute SLA deadlines if priority changed
        if (priority && priority !== oldPriority) {
            const sla = calculateSlaDeadlines(priority);
            responseDeadline = sla.responseDeadline;
            resolutionDeadline = sla.resolutionDeadline;
        }

        let respondedAt = ticket.responded_at;
        let resolvedAt = ticket.resolved_at;
        let startedResolvingAt = ticket.started_resolving_at;

        if (status && status !== 'Open' && !respondedAt) {
            respondedAt = new Date();
        }
        if (status === 'In Progress' && !startedResolvingAt) {
            startedResolvingAt = new Date();
        }
        if (status && (status === 'Resolved' || status === 'Closed') && !resolvedAt) {
            resolvedAt = new Date();
        }

        const newTitle = title || ticket.title;
        const newDesc = description !== undefined ? description : ticket.description;
        const newCat = category || ticket.category;
        const newPri = priority || ticket.priority;
        const newStat = status || ticket.status;
        const newAssigned = assigned_to !== undefined ? (assigned_to ? parseInt(assigned_to, 10) : null) : ticket.assigned_to;
        const newAssignedTeam = assigned_team !== undefined ? JSON.stringify(assigned_team) : JSON.stringify(ticket.assigned_team || []);
        const newCust = customer_id !== undefined ? (customer_id ? parseInt(customer_id, 10) : null) : ticket.customer_id;
        const newProj = project_id !== undefined ? (project_id ? parseInt(project_id, 10) : null) : ticket.project_id;
        const newProjName = project_name !== undefined ? project_name : ticket.project_name;

        const updateRes = await pool.query(`
            UPDATE support_tickets 
            SET title = $1, description = $2, category = $3, priority = $4, status = $5,
                assigned_to = $6, assigned_team = $7, customer_id = $8, project_id = $9, project_name = $10,
                response_deadline = $11, resolution_deadline = $12,
                responded_at = $13, resolved_at = $14, started_resolving_at = $15, updated_at = NOW()
            WHERE id = $16
            RETURNING *, EXTRACT(EPOCH FROM (NOW() - COALESCE(started_resolving_at, created_at))) AS elapsed_seconds
        `, [
            newTitle, newDesc, newCat, newPri, newStat,
            newAssigned, newAssignedTeam, newCust, newProj, newProjName,
            responseDeadline, resolutionDeadline,
            respondedAt, resolvedAt, startedResolvingAt, id
        ]);

        // If newly resolved, alert engineers
        if (newStat === 'Resolved' && oldStatus !== 'Resolved') {
            const elapsedSec = Number(updateRes.rows[0]?.elapsed_seconds);
            const turnaroundStr = !isNaN(elapsedSec) ? formatTurnaroundTime(elapsedSec) : formatTurnaroundTime(ticket.created_at, new Date());

            notifyTicketWhatsApp({
                ticketCode: ticket.ticket_code,
                title: newTitle,
                customerName: ticket.customer_name || 'Customer',
                projectName: newProjName || 'Project',
                assignedToId: newAssigned,
                assignedTeam: Array.isArray(assigned_team) ? assigned_team : ticket.assigned_team,
                actionType: 'resolved',
                turnaroundTime: turnaroundStr
            });
        }

        // Log history
        await pool.query(`
            INSERT INTO support_ticket_history (ticket_id, performed_by, action, previous_status, new_status, details)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [
            id,
            req.user?.full_name || 'System Admin',
            'Ticket Details Updated',
            oldStatus,
            newStat,
            `Ticket parameters updated by ${req.user?.full_name || 'System Admin'}.`
        ]);

        return res.json({
            success: true,
            message: 'Support ticket updated successfully!',
            data: updateRes.rows[0]
        });
    } catch (error) {
        console.error('Error updating support ticket:', error);
        return res.status(500).json({ success: false, message: 'Server error updating support ticket' });
    }
};

// PUT /api/v1/support/:id/status - Update Ticket Status
export const updateTicketStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const ticketRes = await pool.query(`
            SELECT t.*, c.name AS customer_name 
            FROM support_tickets t
            LEFT JOIN customers c ON t.customer_id = c.id
            WHERE t.id = $1
        `, [id]);
        if (ticketRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Ticket not found' });
        }

        const ticket = ticketRes.rows[0];
        const oldStatus = ticket.status;

        let respondedAt = ticket.responded_at;
        let resolvedAt = ticket.resolved_at;
        let startedResolvingAt = ticket.started_resolving_at;

        if (status !== 'Open' && !respondedAt) {
            respondedAt = new Date();
        }
        if (status === 'In Progress' && !startedResolvingAt) {
            startedResolvingAt = new Date();
        }
        if ((status === 'Resolved' || status === 'Closed') && !resolvedAt) {
            resolvedAt = new Date();
        }

        const updateRes = await pool.query(`
            UPDATE support_tickets 
            SET status = $1, responded_at = $2, resolved_at = $3, started_resolving_at = $4, updated_at = NOW()
            WHERE id = $5
            RETURNING *, EXTRACT(EPOCH FROM (NOW() - COALESCE(started_resolving_at, created_at))) AS elapsed_seconds
        `, [status, respondedAt, resolvedAt, startedResolvingAt, id]);

        if (status === 'Resolved' && oldStatus !== 'Resolved') {
            const elapsedSec = Number(updateRes.rows[0]?.elapsed_seconds);
            const turnaroundStr = !isNaN(elapsedSec) ? formatTurnaroundTime(elapsedSec) : formatTurnaroundTime(ticket.created_at, new Date());

            notifyTicketWhatsApp({
                ticketCode: ticket.ticket_code,
                title: ticket.title,
                customerName: ticket.customer_name || 'Customer',
                projectName: ticket.project_name || 'Project',
                assignedToId: ticket.assigned_to,
                assignedTeam: ticket.assigned_team,
                actionType: 'resolved',
                turnaroundTime: turnaroundStr
            });
        }

        // Log history
        await pool.query(`
            INSERT INTO support_ticket_history (ticket_id, performed_by, action, previous_status, new_status, details)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [
            id,
            req.user?.full_name || 'System Admin',
            'Status Changed',
            oldStatus,
            status,
            `Status updated from ${oldStatus} to ${status}.`
        ]);

        return res.json({
            success: true,
            message: `Ticket status updated to ${status}`,
            data: updateRes.rows[0]
        });
    } catch (error) {
        console.error('Error updating ticket status:', error);
        return res.status(500).json({ success: false, message: 'Server error updating ticket status' });
    }
};

// PUT /api/v1/support/:id/assign - Assign ticket to employee
export const assignTicket = async (req, res) => {
    try {
        const { id } = req.params;
        const { assigned_to } = req.body;

        const ticketRes = await pool.query(`SELECT * FROM support_tickets WHERE id = $1`, [id]);
        if (ticketRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Ticket not found' });
        }

        const ticket = ticketRes.rows[0];
        const newStatus = ticket.status === 'Open' ? 'Assigned' : ticket.status;

        const empRes = await pool.query(`SELECT full_name FROM employees WHERE id = $1`, [assigned_to]);
        const assigneeName = empRes.rows[0]?.full_name || 'Assigned Staff';

        await pool.query(`
            UPDATE support_tickets 
            SET assigned_to = $1, status = $2, updated_at = NOW()
            WHERE id = $3
        `, [assigned_to, newStatus, id]);

        // Trigger WhatsApp & Inbox Notification for the assigned employee
        const custRes = await pool.query(`SELECT name FROM customers WHERE id = $1`, [ticket.customer_id]);
        const customerName = custRes.rows[0]?.name || 'Valued Client';

        notifyTicketWhatsApp({
            ticketCode: ticket.ticket_code,
            title: ticket.title,
            description: ticket.description || '',
            priority: ticket.priority || 'Medium',
            assignedToId: parseInt(assigned_to, 10),
            assignedTeam: ticket.assigned_team || [],
            customerName: customerName,
            projectName: ticket.project_name || 'General Project',
            actionType: 'assigned',
            attachments: ticket.attachments || []
        });

        // Log history
        await pool.query(`
            INSERT INTO support_ticket_history (ticket_id, performed_by, action, previous_status, new_status, details)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [
            id,
            req.user?.full_name || 'System Admin',
            'Ticket Assigned',
            ticket.status,
            newStatus,
            `Ticket assigned to ${assigneeName}.`
        ]);

        return res.json({
            success: true,
            message: `Ticket assigned to ${assigneeName}`
        });
    } catch (error) {
        console.error('Error assigning ticket:', error);
        return res.status(500).json({ success: false, message: 'Server error assigning ticket' });
    }
};

// POST /api/v1/support/:id/comments - Add Comment or Internal Note
export const addComment = async (req, res) => {
    try {
        const { id } = req.params;
        const { comment_text, is_internal_note, attachments } = req.body;

        if (!comment_text || !comment_text.trim()) {
            return res.status(400).json({ success: false, message: 'Comment text is required' });
        }

        const authorName = req.user?.full_name || 'Admin';
        const authorId = req.user?.employee_id || null;
        const attJson = JSON.stringify(attachments || []);

        const insertRes = await pool.query(`
            INSERT INTO support_ticket_comments (ticket_id, author_id, author_name, comment_text, is_internal_note, attachments)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [id, authorId, authorName, comment_text.trim(), is_internal_note || false, attJson]);

        // Log history
        await pool.query(`
            INSERT INTO support_ticket_history (ticket_id, performed_by, action, previous_status, new_status, details)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [
            id,
            authorName,
            is_internal_note ? 'Internal Note Added' : 'Comment Added',
            null,
            null,
            is_internal_note ? 'Added an internal note.' : 'Added a public comment.'
        ]);

        return res.status(201).json({
            success: true,
            data: insertRes.rows[0]
        });
    } catch (error) {
        console.error('Error adding comment:', error);
        return res.status(500).json({ success: false, message: 'Server error adding comment' });
    }
};

// POST /api/v1/support/:id/convert-to-task - Convert ticket to a new Task in Workflow/Tasks module
export const convertToTask = async (req, res) => {
    try {
        const { id } = req.params;
        const { workflow_id, estimated_hours } = req.body;

        const ticketRes = await pool.query(`SELECT * FROM support_tickets WHERE id = $1`, [id]);
        if (ticketRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Ticket not found' });
        }

        const ticket = ticketRes.rows[0];

        // Find or fallback workflow_id
        let targetWorkflowId = workflow_id || ticket.workflow_id;
        if (!targetWorkflowId) {
            const wfRes = await pool.query(`SELECT id FROM workflows LIMIT 1`);
            targetWorkflowId = wfRes.rows[0]?.id || 1;
        }

        // Insert new task into tasks table
        const taskInsertRes = await pool.query(`
            INSERT INTO tasks (title, description, assigned_to, customer_id, project_id, priority, status, estimated_hours)
            VALUES ($1, $2, $3, $4, $5, $6, 'Not Started', $7)
            RETURNING id
        `, [
            `[From ${ticket.ticket_code}] ${ticket.title}`,
            `Converted from Support Ticket ${ticket.ticket_code}:\n\n${ticket.description}`,
            ticket.assigned_to ? [ticket.assigned_to] : [],
            ticket.customer_id,
            ticket.project_id || null,
            ticket.priority || 'Medium',
            estimated_hours || 4
        ]);

        const newTaskId = taskInsertRes.rows[0].id;

        // Link task_id to support_ticket and update status to In Progress
        await pool.query(`
            UPDATE support_tickets 
            SET task_id = $1, status = 'In Progress', updated_at = NOW()
            WHERE id = $2
        `, [newTaskId, id]);

        // Log history
        await pool.query(`
            INSERT INTO support_ticket_history (ticket_id, performed_by, action, previous_status, new_status, details)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [
            id,
            req.user?.full_name || 'System Admin',
            'Converted to Task',
            ticket.status,
            'In Progress',
            `Ticket converted into Task #${newTaskId} in Workflow #${targetWorkflowId}.`
        ]);

        return res.json({
            success: true,
            message: `Ticket converted successfully to Task #${newTaskId}!`,
            task_id: newTaskId
        });
    } catch (error) {
        console.error('Error converting ticket to task:', error);
        return res.status(500).json({ success: false, message: 'Server error converting ticket to task' });
    }
};

// POST /api/v1/support/:id/convert-to-workflow - Convert ticket to a new Workflow
export const convertToWorkflow = async (req, res) => {
    try {
        const { id } = req.params;
        const { project_id } = req.body;

        const ticketRes = await pool.query(`SELECT * FROM support_tickets WHERE id = $1`, [id]);
        if (ticketRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Ticket not found' });
        }

        const ticket = ticketRes.rows[0];

        let targetProjectId = project_id || ticket.project_id;
        if (!targetProjectId) {
            const pRes = await pool.query(`SELECT id FROM projects LIMIT 1`);
            targetProjectId = pRes.rows[0]?.id || 1;
        }

        // Insert new workflow
        const wfInsertRes = await pool.query(`
            INSERT INTO workflows (name, description, project_id, customer_id, status)
            VALUES ($1, $2, $3, $4, 'In Progress')
            RETURNING id
        `, [
            `[From ${ticket.ticket_code}] ${ticket.title}`,
            `Converted from Support Ticket ${ticket.ticket_code}:\n\n${ticket.description}`,
            targetProjectId,
            ticket.customer_id
        ]);

        const newWorkflowId = wfInsertRes.rows[0].id;

        // Link workflow_id to ticket & set status to In Progress
        await pool.query(`
            UPDATE support_tickets 
            SET workflow_id = $1, status = 'In Progress', updated_at = NOW()
            WHERE id = $2
        `, [newWorkflowId, id]);

        // Log history
        await pool.query(`
            INSERT INTO support_ticket_history (ticket_id, performed_by, action, previous_status, new_status, details)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [
            id,
            req.user?.full_name || 'System Admin',
            'Converted to Workflow',
            ticket.status,
            'In Progress',
            `Ticket converted into Workflow #${newWorkflowId} under Project #${targetProjectId}.`
        ]);

        return res.json({
            success: true,
            message: `Ticket converted successfully to Workflow #${newWorkflowId}!`,
            workflow_id: newWorkflowId
        });
    } catch (error) {
        console.error('Error converting ticket to workflow:', error);
        return res.status(500).json({ success: false, message: 'Server error converting ticket to workflow' });
    }
};

// PUT /api/v1/support/:id/transfer - Transfer / Share Ticket to another employee
export const transferTicket = async (req, res) => {
    try {
        const { id } = req.params;
        const { target_employee_id, reason_category, notes } = req.body;

        if (!target_employee_id) {
            return res.status(400).json({ success: false, message: 'Target employee is required for handover' });
        }

        const ticketRes = await pool.query(`
            SELECT t.*, c.name AS customer_name, e.full_name AS current_assignee_name
            FROM support_tickets t
            LEFT JOIN customers c ON t.customer_id = c.id
            LEFT JOIN employees e ON t.assigned_to = e.id
            WHERE t.id = $1
        `, [id]);

        if (ticketRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Ticket not found' });
        }

        const ticket = ticketRes.rows[0];
        const oldAssigneeName = ticket.current_assignee_name || (req.user?.full_name || 'Staff');

        const targetEmpRes = await pool.query(`SELECT id, full_name, phone, whatsapp_no FROM employees WHERE id = $1`, [target_employee_id]);
        if (targetEmpRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Target employee not found' });
        }
        const targetEmp = targetEmpRes.rows[0];
        const newAssigneeName = targetEmp.full_name;

        const newStatus = ticket.status === 'Resolved' || ticket.status === 'Closed' ? 'Assigned' : (ticket.status || 'Assigned');

        // Update ticket assignment and timestamp
        await pool.query(`
            UPDATE support_tickets
            SET assigned_to = $1, status = $2, updated_at = NOW()
            WHERE id = $3
        `, [target_employee_id, newStatus, id]);

        const senderName = req.user?.full_name || oldAssigneeName;
        const reasonCat = reason_category || 'Handover';
        const handoverNotes = notes || 'Transferred by colleague for resolution.';
        const historyDetail = `Transferred from ${senderName} to ${newAssigneeName}. Reason: [${reasonCat}] ${handoverNotes}`;

        // 1. Immutable Audit Timeline Entry
        await pool.query(`
            INSERT INTO support_ticket_history (ticket_id, performed_by, action, previous_status, new_status, details)
            VALUES ($1, $2, 'Ticket Transferred', $3, $4, $5)
        `, [id, senderName, ticket.status, newStatus, historyDetail]);

        // 2. Add as work note comment
        const authorEmpId = req.user?.employee_id || null;
        try {
            await pool.query(`
                INSERT INTO support_ticket_comments (ticket_id, author_id, author_name, comment_text, is_internal_note, attachments, created_at)
                VALUES ($1, $2, $3, $4, false, '[]'::jsonb, NOW())
            `, [id, authorEmpId, senderName, `🔄 [TICKET TRANSFER] Handover to ${newAssigneeName} (${reasonCat}): ${handoverNotes}`]);
        } catch (cErr) {
            console.warn("Transfer comment insert fallback:", cErr.message);
        }

        // 3. Dispatch Notification to target employee
        notifyTicketWhatsApp({
            ticketCode: ticket.ticket_code,
            title: ticket.title,
            description: `Ticket transferred to you by ${senderName}.\nReason: [${reasonCat}] ${handoverNotes}\n\n${ticket.description || ''}`,
            priority: ticket.priority || 'Medium',
            assignedToId: parseInt(target_employee_id, 10),
            assignedTeam: ticket.assigned_team || [],
            customerName: ticket.customer_name || 'Valued Customer',
            projectName: ticket.project_name || 'General Project',
            actionType: 'transferred',
            attachments: ticket.attachments || []
        });

        return res.json({
            success: true,
            message: `Ticket successfully transferred to ${newAssigneeName}!`,
            data: { new_assignee: newAssigneeName }
        });
    } catch (error) {
        console.error('Error transferring support ticket:', error);
        return res.status(500).json({ success: false, message: 'Server error transferring support ticket' });
    }
};

// PUT /api/v1/support/:id/reopen - Reopen a Resolved / Paused Ticket for Multi-Session Work
export const reopenTicket = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason, notes } = req.body;

        const ticketRes = await pool.query(`
            SELECT t.*, c.name AS customer_name 
            FROM support_tickets t
            LEFT JOIN customers c ON t.customer_id = c.id
            WHERE t.id = $1
        `, [id]);

        if (ticketRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Ticket not found' });
        }

        const ticket = ticketRes.rows[0];
        const oldStatus = ticket.status;
        const performer = req.user?.full_name || 'Staff';
        const reopenReason = reason || notes || 'Further work required by team/customer.';

        // Reopen ticket: set status to In Progress, clear resolved_at, keep or resume started_resolving_at
        const updateRes = await pool.query(`
            UPDATE support_tickets 
            SET status = 'In Progress', resolved_at = NULL, started_resolving_at = COALESCE(started_resolving_at, NOW()), updated_at = NOW()
            WHERE id = $1
            RETURNING *
        `, [id]);

        // Insert into history
        await pool.query(`
            INSERT INTO support_ticket_history (ticket_id, performed_by, action, previous_status, new_status, details)
            VALUES ($1, $2, 'Ticket Reopened', $3, 'In Progress', $4)
        `, [id, performer, oldStatus, `Ticket reopened by ${performer}. Reason: ${reopenReason}`]);

        // Add automated work comment
        const authorEmpId = req.user?.employee_id || null;
        try {
            await pool.query(`
                INSERT INTO support_ticket_comments (ticket_id, author_id, author_name, comment_text, is_internal_note, attachments, created_at)
                VALUES ($1, $2, $3, $4, false, '[]'::jsonb, NOW())
            `, [id, authorEmpId, performer, `🔁 [TICKET REOPENED] Reason: ${reopenReason}`]);
        } catch (cErr) {
            console.warn("Reopen comment insert fallback:", cErr.message);
        }

        // Notify engineers
        notifyTicketWhatsApp({
            ticketCode: ticket.ticket_code,
            title: ticket.title,
            description: `Ticket reopened for additional resolution.\nReason: ${reopenReason}`,
            priority: ticket.priority || 'Medium',
            assignedToId: ticket.assigned_to,
            assignedTeam: ticket.assigned_team || [],
            customerName: ticket.customer_name || 'Valued Customer',
            projectName: ticket.project_name || 'General Project',
            actionType: 'reopened',
            attachments: ticket.attachments || []
        });

        return res.json({
            success: true,
            message: `Ticket ${ticket.ticket_code} reopened successfully!`,
            data: updateRes.rows[0]
        });
    } catch (error) {
        console.error('Error reopening ticket:', error);
        return res.status(500).json({ success: false, message: 'Server error reopening ticket' });
    }
};

// =========================================================================
// ============ SUB-TASKS, WORK CHUNKS & MULTI-EMPLOYEE HANDOVER ============
// =========================================================================

// GET /api/v1/support/:id/subtasks - List subtasks for a ticket
export const getSubtasksByTicketId = async (req, res) => {
    try {
        const { id } = req.params;
        const isNumeric = /^\d+$/.test(id);
        
        let ticketId = id;
        if (!isNumeric) {
            const tRes = await pool.query(`SELECT id FROM support_tickets WHERE ticket_code = $1`, [id]);
            if (tRes.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Ticket not found' });
            }
            ticketId = tRes.rows[0].id;
        }

        const query = `
            SELECT 
                st.*,
                e.full_name AS assigned_to_name,
                e.role AS assigned_to_role,
                cb.full_name AS completed_by_name,
                dep.title AS depends_on_title,
                dep.status AS depends_on_status
            FROM ticket_subtasks st
            LEFT JOIN employees e ON st.assigned_to = e.id
            LEFT JOIN employees cb ON st.completed_by = cb.id
            LEFT JOIN ticket_subtasks dep ON st.depends_on_subtask_id = dep.id
            WHERE st.ticket_id = $1
            ORDER BY st.sequence_order ASC, st.created_at ASC
        `;

        const result = await pool.query(query, [ticketId]);

        return res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching ticket subtasks:', error);
        return res.status(500).json({ success: false, message: 'Server error fetching ticket subtasks' });
    }
};

// POST /api/v1/support/:id/subtasks - Add new subtask/chunk to ticket
export const createSubtask = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            title,
            description,
            assigned_to,
            sequence_order,
            depends_on_subtask_id,
            status,
            time_spent_hours
        } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ success: false, message: 'Sub-task title is required' });
        }

        const isNumeric = /^\d+$/.test(id);
        let ticketId = id;
        let ticketCode = '';
        let ticketTitle = '';
        let customerName = 'Valued Customer';
        let projectName = 'General Project';

        const tRes = await pool.query(`
            SELECT t.id, t.ticket_code, t.title, c.name AS customer_name, COALESCE(t.project_name, p.name, 'General') AS project_name
            FROM support_tickets t
            LEFT JOIN customers c ON t.customer_id = c.id
            LEFT JOIN projects p ON t.project_id = p.id
            WHERE ${isNumeric ? 't.id = $1' : 't.ticket_code = $1'}
        `, [id]);

        if (tRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Support ticket not found' });
        }

        ticketId = tRes.rows[0].id;
        ticketCode = tRes.rows[0].ticket_code;
        ticketTitle = tRes.rows[0].title;
        customerName = tRes.rows[0].customer_name;
        projectName = tRes.rows[0].project_name;

        // Determine default sequence order if not specified
        let seq = sequence_order;
        if (!seq) {
            const maxSeqRes = await pool.query(`SELECT COALESCE(MAX(sequence_order), 0) + 1 AS next_seq FROM ticket_subtasks WHERE ticket_id = $1`, [ticketId]);
            seq = maxSeqRes.rows[0].next_seq;
        }

        // Determine initial status based on dependency
        let initialStatus = status || 'Pending';
        if (depends_on_subtask_id && !status) {
            const depRes = await pool.query(`SELECT status FROM ticket_subtasks WHERE id = $1`, [depends_on_subtask_id]);
            if (depRes.rows.length > 0 && depRes.rows[0].status !== 'Completed') {
                initialStatus = 'Waiting';
            }
        }

        const insertRes = await pool.query(`
            INSERT INTO ticket_subtasks (
                ticket_id, title, description, assigned_to, sequence_order,
                status, depends_on_subtask_id, time_spent_hours, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
            RETURNING *
        `, [
            ticketId,
            title.trim(),
            description || '',
            assigned_to ? parseInt(assigned_to, 10) : null,
            parseInt(seq, 10) || 1,
            initialStatus,
            depends_on_subtask_id ? parseInt(depends_on_subtask_id, 10) : null,
            parseFloat(time_spent_hours) || 0.00
        ]);

        const newSubtask = insertRes.rows[0];

        // Also ensure ticket status is 'In Progress' or 'Assigned'
        await pool.query(`
            UPDATE support_tickets
            SET status = CASE WHEN status = 'Open' THEN 'In Progress' ELSE status END,
                started_resolving_at = COALESCE(started_resolving_at, NOW()),
                updated_at = NOW()
            WHERE id = $1
        `, [ticketId]);

        // Insert timeline history
        const performer = req.user?.full_name || 'Staff';
        await pool.query(`
            INSERT INTO support_ticket_history (ticket_id, performed_by, action, details)
            VALUES ($1, $2, 'Subtask Added', $3)
        `, [
            ticketId,
            performer,
            `Sub-task "${newSubtask.title}" added (#${newSubtask.sequence_order})`
        ]);

        // Send inbox notification to assigned employee
        if (newSubtask.assigned_to) {
            try {
                await pool.query(`
                    INSERT INTO notifications (
                        recipient_id, type, title, message, link, is_read, created_at, metadata
                    ) VALUES ($1, 'Support Ticket Subtask', $2, $3, $4, false, NOW(), $5)
                `, [
                    newSubtask.assigned_to,
                    `Assigned Chunk: ${newSubtask.title} (${ticketCode})`,
                    `You have been assigned chunk #${newSubtask.sequence_order} on Ticket ${ticketCode} (${ticketTitle}):\n${newSubtask.title}\nCustomer: ${customerName}`,
                    `/employee-tasks.html?ticket_code=${ticketCode}`,
                    JSON.stringify({
                        ticket_id: ticketId,
                        ticket_code: ticketCode,
                        subtask_id: newSubtask.id,
                        subtask_title: newSubtask.title,
                        customer_name: customerName,
                        project_name: projectName
                    })
                ]);
            } catch (nErr) {
                console.warn("Subtask notification error:", nErr.message);
            }
        }

        return res.json({
            success: true,
            message: `Sub-task "${newSubtask.title}" created successfully!`,
            data: newSubtask
        });
    } catch (error) {
        console.error('Error creating subtask:', error);
        return res.status(500).json({ success: false, message: 'Server error creating subtask' });
    }
};

// PUT /api/v1/support/:id/subtasks/:subtaskId - Update subtask
export const updateSubtask = async (req, res) => {
    try {
        const { id, subtaskId } = req.params;
        const {
            title,
            description,
            assigned_to,
            sequence_order,
            status,
            depends_on_subtask_id,
            handover_notes,
            time_spent_hours
        } = req.body;

        const updateRes = await pool.query(`
            UPDATE ticket_subtasks
            SET 
                title = COALESCE($1, title),
                description = COALESCE($2, description),
                assigned_to = CASE WHEN $3::int IS NOT NULL THEN $3::int ELSE assigned_to END,
                sequence_order = COALESCE($4, sequence_order),
                status = COALESCE($5, status),
                depends_on_subtask_id = $6,
                handover_notes = COALESCE($7, handover_notes),
                time_spent_hours = COALESCE($8, time_spent_hours),
                updated_at = NOW()
            WHERE id = $9
            RETURNING *
        `, [
            title ? title.trim() : null,
            description !== undefined ? description : null,
            assigned_to !== undefined ? (assigned_to ? parseInt(assigned_to, 10) : null) : null,
            sequence_order ? parseInt(sequence_order, 10) : null,
            status || null,
            depends_on_subtask_id ? parseInt(depends_on_subtask_id, 10) : null,
            handover_notes !== undefined ? handover_notes : null,
            time_spent_hours !== undefined ? parseFloat(time_spent_hours) : null,
            subtaskId
        ]);

        if (updateRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Sub-task not found' });
        }

        return res.json({
            success: true,
            message: 'Sub-task updated successfully!',
            data: updateRes.rows[0]
        });
    } catch (error) {
        console.error('Error updating subtask:', error);
        return res.status(500).json({ success: false, message: 'Server error updating subtask' });
    }
};

// PUT /api/v1/support/:id/subtasks/:subtaskId/handover - Mark completed & trigger handover
export const completeSubtaskWithHandover = async (req, res) => {
    try {
        const { id, subtaskId } = req.params;
        const { handover_notes, time_spent_hours } = req.body;
        const completedByEmpId = req.user?.employee_id || (req.user?.id && req.user.role !== 'admin' ? req.user.id : null);
        const performer = req.user?.full_name || 'Staff';

        // 1. Fetch current subtask and parent ticket
        const stRes = await pool.query(`
            SELECT 
                st.*,
                t.ticket_code,
                t.title AS ticket_title,
                c.name AS customer_name,
                COALESCE(t.project_name, p.name, 'General') AS project_name,
                e.full_name AS current_assignee_name
            FROM ticket_subtasks st
            JOIN support_tickets t ON st.ticket_id = t.id
            LEFT JOIN customers c ON t.customer_id = c.id
            LEFT JOIN projects p ON t.project_id = p.id
            LEFT JOIN employees e ON st.assigned_to = e.id
            WHERE st.id = $1
        `, [subtaskId]);

        if (stRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Sub-task not found' });
        }

        const currentSubtask = stRes.rows[0];
        const ticketId = currentSubtask.ticket_id;
        const ticketCode = currentSubtask.ticket_code;

        // 2. Mark this subtask Completed
        const hoursToAdd = parseFloat(time_spent_hours) || 0;
        const totalHours = (parseFloat(currentSubtask.time_spent_hours) || 0) + hoursToAdd;

        const updateRes = await pool.query(`
            UPDATE ticket_subtasks
            SET 
                status = 'Completed',
                handover_notes = $1,
                time_spent_hours = $2,
                completed_by = $3,
                completed_at = NOW(),
                updated_at = NOW()
            WHERE id = $4
            RETURNING *
        `, [
            handover_notes || currentSubtask.handover_notes || 'Chunk completed.',
            totalHours,
            completedByEmpId,
            subtaskId
        ]);

        const completedSubtask = updateRes.rows[0];

        // 3. Insert into Ticket Comments as a prominent Handover Note
        try {
            const handoverComment = `📦 **[SUB-TASK HANDOVER] Chunk #${completedSubtask.sequence_order}: ${completedSubtask.title}**\n` +
                `✅ Completed by: ${performer} (${totalHours.toFixed(1)} hrs logged)\n` +
                `📝 **Handover Notes for Next Assignee:**\n${handover_notes || 'No specific notes. Ready for next stage.'}`;

            await pool.query(`
                INSERT INTO support_ticket_comments (ticket_id, author_id, author_name, comment_text, is_internal_note, attachments, created_at)
                VALUES ($1, $2, $3, $4, false, '[]'::jsonb, NOW())
            `, [ticketId, completedByEmpId, performer, handoverComment]);
        } catch (cErr) {
            console.warn("Handover comment insert fallback:", cErr.message);
        }

        // 4. Insert timeline history
        await pool.query(`
            INSERT INTO support_ticket_history (ticket_id, performed_by, action, details)
            VALUES ($1, $2, 'Subtask Completed & Handed Over', $3)
        `, [
            ticketId,
            performer,
            `Chunk "${completedSubtask.title}" marked completed by ${performer}. Handover notes shared.`
        ]);

        // 5. Unlock any dependent subtasks & notify their assignees!
        const depSubtasksRes = await pool.query(`
            SELECT st.*, e.full_name AS next_emp_name
            FROM ticket_subtasks st
            LEFT JOIN employees e ON st.assigned_to = e.id
            WHERE st.depends_on_subtask_id = $1 AND st.status IN ('Waiting', 'Pending')
        `, [subtaskId]);

        for (const nextSubtask of depSubtasksRes.rows) {
            // Update next subtask status to 'Pending' (or keep in progress)
            await pool.query(`
                UPDATE ticket_subtasks
                SET status = 'Pending', updated_at = NOW()
                WHERE id = $1
            `, [nextSubtask.id]);

            // Notify next assignee (e.g., Malhar)
            if (nextSubtask.assigned_to) {
                try {
                    const notifTitle = `🚀 Handover Ready: ${nextSubtask.title} (${ticketCode})`;
                    const notifMsg = `${performer} has completed "${completedSubtask.title}".\n\n` +
                        `📝 Handover Note: "${handover_notes || 'Ready to start'}"\n\n` +
                        `You can now start working on your assigned chunk: "${nextSubtask.title}".`;

                    await pool.query(`
                        INSERT INTO notifications (
                            recipient_id, type, title, message, link, is_read, created_at, metadata
                        ) VALUES ($1, 'Handover Ready', $2, $3, $4, false, NOW(), $5)
                    `, [
                        nextSubtask.assigned_to,
                        notifTitle,
                        notifMsg,
                        `/employee-tasks.html?ticket_code=${ticketCode}`,
                        JSON.stringify({
                            ticket_id: ticketId,
                            ticket_code: ticketCode,
                            completed_chunk: completedSubtask.title,
                            next_chunk_id: nextSubtask.id,
                            next_chunk_title: nextSubtask.title,
                            handover_notes: handover_notes
                        })
                    ]);
                } catch (nErr) {
                    console.warn("Handover notification error:", nErr.message);
                }
            }
        }

        // 6. Check if ALL subtasks for this ticket are now complete
        const allStRes = await pool.query(`
            SELECT 
                COUNT(*)::int AS total,
                COUNT(CASE WHEN status = 'Completed' THEN 1 END)::int AS completed_count
            FROM ticket_subtasks
            WHERE ticket_id = $1
        `, [ticketId]);

        const totalChunks = allStRes.rows[0].total;
        const completedChunks = allStRes.rows[0].completed_count;
        const allChunksDone = totalChunks > 0 && totalChunks === completedChunks;

        return res.json({
            success: true,
            message: `Chunk "${completedSubtask.title}" completed and handed over successfully!`,
            data: {
                completedSubtask,
                allChunksDone,
                totalChunks,
                completedChunks
            }
        });
    } catch (error) {
        console.error('Error completing subtask with handover:', error);
        return res.status(500).json({ success: false, message: 'Server error completing subtask' });
    }
};

// DELETE /api/v1/support/:id/subtasks/:subtaskId - Delete subtask
export const deleteSubtask = async (req, res) => {
    try {
        const { subtaskId } = req.params;
        const delRes = await pool.query(`DELETE FROM ticket_subtasks WHERE id = $1 RETURNING *`, [subtaskId]);
        if (delRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Sub-task not found' });
        }
        return res.json({ success: true, message: 'Sub-task deleted successfully' });
    } catch (error) {
        console.error('Error deleting subtask:', error);
        return res.status(500).json({ success: false, message: 'Server error deleting subtask' });
    }
};

