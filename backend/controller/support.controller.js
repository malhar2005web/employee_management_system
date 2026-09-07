import { pool } from '../config/db.js';
import { sendWhatsAppTemplate, sendWhatsAppText, sanitizePhoneNumber } from '../services/whatsapp.service.js';

export async function notifyTicketWhatsApp({
    ticketCode,
    title,
    priority = 'High',
    assignedToId = null,
    assignedTeam = [],
    customerName = 'Valued Client',
    projectName = 'General Project',
    actionType = 'created',
    turnaroundTime = ''
}) {
    try {
        const targetEmployeeIds = new Set();
        if (assignedToId) targetEmployeeIds.add(parseInt(assignedToId, 10));

        if (Array.isArray(assignedTeam)) {
            for (const item of assignedTeam) {
                if (typeof item === 'object' && item.id) targetEmployeeIds.add(parseInt(item.id, 10));
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
                    if (emp.full_name?.toLowerCase().includes('malhar')) {
                        phoneList.push({ name: emp.full_name, phone: '918767137790' });
                    } else if (emp.full_name?.toLowerCase().includes('nitin')) {
                        phoneList.push({ name: emp.full_name, phone: '919876543210' });
                    }
                }
            }
        }

        // Always fallback to lead engineer if list is empty
        if (phoneList.length === 0) {
            phoneList.push({ name: 'Support Engineer', phone: '918767137790' });
        }

        for (const target of phoneList) {
            try {
                if (actionType === 'resolved') {
                    const resolveMsg = `✅ *SUPPORT TICKET RESOLVED*\n\n🎫 *Ticket:* ${ticketCode}\n🏢 *Customer:* ${customerName}\n📦 *Project:* ${projectName}\n⏱️ *Resolution Turnaround:* ${turnaroundTime || 'Completed'}\n\nTicket marked resolved and client notified.`;
                    await sendWhatsAppText(target.phone, resolveMsg);
                } else {
                    const alertMsg = `🚨 *NEW SUPPORT TICKET ASSIGNED*\n\n🎫 *Ticket:* ${ticketCode}\n🏢 *Customer:* ${customerName}\n📦 *Project:* ${projectName}\n⚠️ *Priority:* ${priority}\n📝 *Issue:* ${title}\n\n⏱️ *SLA Resolution Timer Started!*\nPlease review and attend promptly:\nhttps://planex.pentasoftconsultancy.com/admin-support.html`;
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
        const { search, status, priority, category, customer_id } = req.query;

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
        if (search) {
            conditions.push(`(t.ticket_code ILIKE $${idx} OR t.title ILIKE $${idx} OR t.reported_by ILIKE $${idx} OR c.name ILIKE $${idx})`);
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
                e.full_name AS assigned_to_name
            FROM support_tickets t
            LEFT JOIN customers c ON t.customer_id = c.id
            LEFT JOIN projects p ON t.project_id = p.id
            LEFT JOIN workflows w ON t.workflow_id = w.id
            LEFT JOIN tasks wt ON t.task_id = wt.id
            LEFT JOIN employees e ON t.assigned_to = e.id
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

// GET /api/v1/support/:id - Single ticket details, comments, history
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

        const initialStatus = (assigned_to || (assigned_team && assigned_team.length > 0)) ? 'Assigned' : 'Open';
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
            reported_by || 'Customer Admin',
            title,
            description || '',
            category || 'Bug',
            priority || 'Medium',
            initialStatus,
            assigned_to || null,
            assignedTeamJson,
            customer_phone || null,
            source || 'WEB',
            responseDeadline,
            resolutionDeadline,
            attachmentsJson
        ]);

        const newTicket = result.rows[0];

        // Asynchronously notify assigned engineers on WhatsApp
        notifyTicketWhatsApp({
            ticketCode: ticket_code,
            title,
            priority: priority || 'Medium',
            assignedToId: assigned_to ? parseInt(assigned_to, 10) : null,
            assignedTeam: assigned_team || [],
            customerName,
            projectName: project_name || 'General Project',
            actionType: 'created'
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

        if (status && status !== 'Open' && !respondedAt) {
            respondedAt = new Date();
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
                responded_at = $13, resolved_at = $14, updated_at = NOW()
            WHERE id = $15
            RETURNING *
        `, [
            newTitle, newDesc, newCat, newPri, newStat,
            newAssigned, newAssignedTeam, newCust, newProj, newProjName,
            responseDeadline, resolutionDeadline,
            respondedAt, resolvedAt, id
        ]);

        // If newly resolved, alert engineers
        if (newStat === 'Resolved' && oldStatus !== 'Resolved') {
            const durationMs = new Date().getTime() - new Date(ticket.created_at).getTime();
            const hours = Math.floor(durationMs / 3600000);
            const mins = Math.floor((durationMs % 3600000) / 60000);
            const turnaroundStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

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

        if (status !== 'Open' && !respondedAt) {
            respondedAt = new Date();
        }
        if ((status === 'Resolved' || status === 'Closed') && !resolvedAt) {
            resolvedAt = new Date();
        }

        const updateRes = await pool.query(`
            UPDATE support_tickets 
            SET status = $1, responded_at = $2, resolved_at = $3, updated_at = NOW()
            WHERE id = $4
            RETURNING *
        `, [status, respondedAt, resolvedAt, id]);

        if (status === 'Resolved' && oldStatus !== 'Resolved') {
            const durationMs = new Date().getTime() - new Date(ticket.created_at).getTime();
            const hours = Math.floor(durationMs / 3600000);
            const mins = Math.floor((durationMs % 3600000) / 60000);
            const turnaroundStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

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
        const authorId = req.user?.id || null;
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
