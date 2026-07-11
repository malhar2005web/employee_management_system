import { pool } from '../config/db.js';

export async function getActionAudits(req, res) {
    try {
        const result = await pool.query(`
            SELECT al.*, u.email, e.full_name, e.employee_code 
            FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.id
            LEFT JOIN employees e ON u.id = e.user_id
            ORDER BY al.created_at DESC;
        `);

        const employeesRes = await pool.query(
            "SELECT id, full_name FROM employees ORDER BY full_name ASC;"
        );

        res.status(200).json({
            success: true,
            data: {
                audits: result.rows,
                employees: employeesRes.rows
            }
        });
    } catch (error) {
        console.log("Error in getActionAudits:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function getLoginLogs(req, res) {
    try {
        const result = await pool.query(`
            SELECT ll.*, e.full_name, e.employee_code 
            FROM login_logs ll
            LEFT JOIN employees e ON ll.employee_id = e.id
            ORDER BY ll.login_time DESC;
        `);
        res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        console.log("Error in getLoginLogs:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}
