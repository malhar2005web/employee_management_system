import { pool } from '../config/db.js';
import { initEmailTicketWorker } from '../services/emailTicket.service.js';

export async function getAnnouncements(req, res) {
    try {
        const result = await pool.query(`
            SELECT n.*, e.full_name, e.employee_code
            FROM notifications n
            LEFT JOIN employees e ON (n.recipient_id = e.user_id OR n.recipient_id = e.id)
            WHERE n.type = 'Announcement'
            ORDER BY n.created_at DESC;
        `);

        const employeesRes = await pool.query(
            "SELECT id, full_name FROM employees WHERE status = 'Active' OR status IS NULL OR status = 'active' ORDER BY full_name ASC;"
        );

        res.status(200).json({
            success: true,
            data: {
                announcements: result.rows,
                employees: employeesRes.rows
            }
        });
    } catch (error) {
        console.log("Error in getAnnouncements:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function getInboxAlerts(req, res) {
    try {
        const ticketsRes = await pool.query(`
            SELECT st.*, 
                   COALESCE(c.name, st.customer_email, 'Email Customer') as customer_name,
                   e.full_name as assigned_to_name
            FROM support_tickets st
            LEFT JOIN customers c ON st.customer_id = c.id
            LEFT JOIN employees e ON st.assigned_to = e.id
            ORDER BY st.created_at DESC
            LIMIT 50;
        `);

        const notifRes = await pool.query(`
            SELECT n.*, e.full_name as recipient_name, e.employee_code
            FROM notifications n
            LEFT JOIN employees e ON n.recipient_id = e.id
            WHERE (n.type != 'Announcement' OR n.type IS NULL)
            ORDER BY n.created_at DESC
            LIMIT 100;
        `);

        res.status(200).json({
            success: true,
            data: {
                tickets: ticketsRes.rows,
                notifications: notifRes.rows
            }
        });
    } catch (error) {
        console.error("Error in getInboxAlerts:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function syncMailboxNow(req, res) {
    try {
        await initEmailTicketWorker();
        res.status(200).json({ success: true, message: "Mailbox sync cycle triggered successfully!" });
    } catch (err) {
        console.error("Error syncing mailbox:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
}

export async function broadcastNotice(req, res) {
    try {
        const { title, message, targetType, employeeId } = req.body;

        if (!title || !message || !targetType) {
            return res.status(400).json({ success: false, message: "Title, message, and targetType are required" });
        }

        let recipientId = null;
        if (targetType === 'Individual' && employeeId) {
            const parsedId = parseInt(employeeId, 10);
            if (!isNaN(parsedId)) {
                const empRes = await pool.query("SELECT id, user_id FROM employees WHERE id = $1", [parsedId]);
                if (empRes.rows.length > 0) {
                    recipientId = empRes.rows[0].user_id || empRes.rows[0].id;
                } else {
                    recipientId = parsedId;
                }
            }
        }

        const query = `
            INSERT INTO notifications (recipient_id, type, title, message, is_read, created_at)
            VALUES ($1, 'Announcement', $2, $3, false, CURRENT_TIMESTAMP) RETURNING *;
        `;
        const values = [recipientId, title, message];

        const result = await pool.query(query, values);
        res.status(201).json({ success: true, message: "Notice published successfully", data: result.rows[0] });
    } catch (error) {
        console.log("Error in broadcastNotice:", error.message);
        res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
}
