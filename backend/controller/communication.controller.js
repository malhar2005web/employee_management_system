import { pool } from '../config/db.js';

export async function getAnnouncements(req, res) {
    try {
        const result = await pool.query(`
            SELECT n.*, e.full_name, e.employee_code
            FROM notifications n
            LEFT JOIN employees e ON n.recipient_id = e.id
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

export async function broadcastNotice(req, res) {
    try {
        const { title, message, targetType, employeeId } = req.body;

        if (!title || !message || !targetType) {
            return res.status(400).json({ success: false, message: "Title, message, and targetType are required" });
        }

        const recipientId = targetType === 'All' ? null : parseInt(employeeId, 10);

        const query = `
            INSERT INTO notifications (recipient_id, type, title, message, is_read, created_at)
            VALUES ($1, 'Announcement', $2, $3, false, CURRENT_TIMESTAMP) RETURNING *;
        `;
        const values = [recipientId, title, message];

        const result = await pool.query(query, values);
        res.status(201).json({ success: true, message: "Notice published successfully", data: result.rows[0] });
    } catch (error) {
        console.log("Error in broadcastNotice:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}
