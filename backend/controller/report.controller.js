import { pool } from '../config/db.js';

export async function getSelfReports(req, res) {
    try {
        const result = await pool.query(`
            SELECT sr.*, e.full_name, e.employee_code
            FROM self_reports sr
            LEFT JOIN employees e ON sr.employee_id = e.id
            ORDER BY sr.date DESC, sr.id DESC;
        `);
        res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        console.log("Error in getSelfReports:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function getFieldVisits(req, res) {
    try {
        const result = await pool.query(`
            SELECT dr.*, e.full_name, e.employee_code
            FROM dsr_reports dr
            LEFT JOIN employees e ON dr.employee_id = e.id
            ORDER BY dr.created_at DESC, dr.id DESC;
        `);
        res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        console.log("Error in getFieldVisits:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function generateCustomReport(req, res) {
    try {
        const { employeeId, startDate, endDate, type } = req.query;

        if (!type) {
            return res.status(400).json({ success: false, message: "Report type is required" });
        }

        let query = "";
        let values = [];
        let paramCount = 1;

        if (type === 'attendance') {
            query = `
                SELECT a.*, e.full_name, e.employee_code 
                FROM attendance a
                LEFT JOIN employees e ON a.employee_id = e.id
                WHERE 1=1
            `;
            if (employeeId) {
                query += ` AND a.employee_id = $${paramCount++}`;
                values.push(parseInt(employeeId, 10));
            }
            if (startDate) {
                query += ` AND a.date >= $${paramCount++}`;
                values.push(startDate);
            }
            if (endDate) {
                query += ` AND a.date <= $${paramCount++}`;
                values.push(endDate);
            }
            query += " ORDER BY a.date DESC;";
        } else if (type === 'leave') {
            query = `
                SELECT lr.*, e.full_name, e.employee_code 
                FROM leave_requests lr
                LEFT JOIN employees e ON lr.employee_id = e.id
                WHERE 1=1
            `;
            if (employeeId) {
                query += ` AND lr.employee_id = $${paramCount++}`;
                values.push(parseInt(employeeId, 10));
            }
            if (startDate) {
                query += ` AND lr.start_date >= $${paramCount++}`;
                values.push(startDate);
            }
            if (endDate) {
                query += ` AND lr.end_date <= $${paramCount++}`;
                values.push(endDate);
            }
            query += " ORDER BY lr.start_date DESC;";
        } else if (type === 'timesheet') {
            query = `
                SELECT t.*, e.full_name, e.employee_code 
                FROM timesheets t
                LEFT JOIN employees e ON t.employee_id = e.id
                WHERE 1=1
            `;
            if (employeeId) {
                query += ` AND t.employee_id = $${paramCount++}`;
                values.push(parseInt(employeeId, 10));
            }
            if (startDate) {
                query += ` AND t.date >= $${paramCount++}`;
                values.push(startDate);
            }
            if (endDate) {
                query += ` AND t.date <= $${paramCount++}`;
                values.push(endDate);
            }
            query += " ORDER BY t.date DESC;";
        } else if (type === 'self-report') {
            query = `
                SELECT sr.*, e.full_name, e.employee_code 
                FROM self_reports sr
                LEFT JOIN employees e ON sr.employee_id = e.id
                WHERE 1=1
            `;
            if (employeeId) {
                query += ` AND sr.employee_id = $${paramCount++}`;
                values.push(parseInt(employeeId, 10));
            }
            if (startDate) {
                query += ` AND sr.date >= $${paramCount++}`;
                values.push(startDate);
            }
            if (endDate) {
                query += ` AND sr.date <= $${paramCount++}`;
                values.push(endDate);
            }
            query += " ORDER BY sr.date DESC;";
        } else {
            return res.status(400).json({ success: false, message: "Invalid report type specified" });
        }

        const result = await pool.query(query, values);
        res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        console.log("Error in generateCustomReport:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}
