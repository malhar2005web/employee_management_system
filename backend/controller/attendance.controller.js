import { pool } from '../config/db.js';

export async function getAttendanceLogs(req, res) {
    try {
        const { date, search, status } = req.query;
        let query = `
            SELECT a.*, e.full_name, e.employee_code
            FROM attendance a
            LEFT JOIN employees e ON a.employee_id = e.id
            WHERE 1=1
        `;
        const values = [];
        let filterCount = 1;

        if (date) {
            query += ` AND a.date = $${filterCount}`;
            values.push(date);
            filterCount++;
        } else {
            // Default to current date if no date is specified
            query += ` AND a.date = CURRENT_DATE`;
        }

        if (search) {
            query += ` AND (e.full_name ILIKE $${filterCount} OR e.employee_code ILIKE $${filterCount})`;
            values.push(`%${search}%`);
            filterCount++;
        }

        if (status) {
            query += ` AND a.status = $${filterCount}`;
            values.push(status);
            filterCount++;
        }

        query += ` ORDER BY e.full_name ASC;`;

        const result = await pool.query(query, values);
        
        // Also fetch active employees list for the select dropdown
        const employeesRes = await pool.query(
            "SELECT id, full_name FROM employees WHERE status = 'Active' OR status IS NULL OR status = 'active' ORDER BY full_name ASC;"
        );

        res.status(200).json({
            success: true,
            data: {
                logs: result.rows,
                employees: employeesRes.rows
            }
        });
    } catch (error) {
        console.log("Error in getAttendanceLogs:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function getPendingCorrections(req, res) {
    try {
        const query = `
            SELECT a.*, e.full_name, e.employee_code
            FROM attendance a
            LEFT JOIN employees e ON a.employee_id = e.id
            WHERE a.approval_status = 'Pending' OR a.approval_status = 'pending'
            ORDER BY a.date DESC, e.full_name ASC;
        `;
        const result = await pool.query(query);
        res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        console.log("Error in getPendingCorrections:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function createManualCorrection(req, res) {
    try {
        const { employeeId, date, clockIn, clockOut, status, overtime } = req.body;
        const approvedBy = req.user ? req.user.id : null;

        if (!employeeId || !date || !status) {
            return res.status(400).json({ success: false, message: "Employee, Date, and Status are required" });
        }

        // Calculate total hours
        let totalHours = null;
        let loginTime = null;
        let logoutTime = null;

        if (clockIn) {
            loginTime = `${date}T${clockIn}:00`;
        }
        if (clockOut) {
            logoutTime = `${date}T${clockOut}:00`;
        }

        if (loginTime && logoutTime) {
            const diffMs = new Date(logoutTime) - new Date(loginTime);
            totalHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
        }

        // Check if row already exists
        const checkQuery = await pool.query(
            "SELECT id FROM attendance WHERE employee_id = $1 AND date = $2",
            [employeeId, date]
        );

        if (checkQuery.rows.length > 0) {
            // UPDATE
            await pool.query(
                `UPDATE attendance
                 SET login_time = $1, logout_time = $2, total_working_hours = $3, status = $4, overtime = $5, approval_status = 'Approved', approved_by = $6, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $7`,
                [loginTime, logoutTime, totalHours, status, overtime ? parseInt(overtime, 10) : null, approvedBy, checkQuery.rows[0].id]
            );
        } else {
            // INSERT
            await pool.query(
                `INSERT INTO attendance (employee_id, date, login_time, logout_time, total_working_hours, status, overtime, approval_status, approved_by)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, 'Approved', $8)`,
                [employeeId, date, loginTime, logoutTime, totalHours, status, overtime ? parseInt(overtime, 10) : null, approvedBy]
            );
        }

        res.status(201).json({ success: true, message: "Attendance corrected successfully" });
    } catch (error) {
        console.log("Error in createManualCorrection:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function approveCorrection(req, res) {
    try {
        const { id } = req.params;
        const approvedBy = req.user ? req.user.id : null;

        const result = await pool.query(
            `UPDATE attendance
             SET approval_status = 'Approved', approved_by = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2 RETURNING *;`,
            [approvedBy, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Attendance record not found" });
        }

        res.status(200).json({ success: true, message: "Correction approved successfully", data: result.rows[0] });
    } catch (error) {
        console.log("Error in approveCorrection:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function rejectCorrection(req, res) {
    try {
        const { id } = req.params;
        const approvedBy = req.user ? req.user.id : null;

        const result = await pool.query(
            `UPDATE attendance
             SET approval_status = 'Rejected', approved_by = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2 RETURNING *;`,
            [approvedBy, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Attendance record not found" });
        }

        res.status(200).json({ success: true, message: "Correction request rejected", data: result.rows[0] });
    } catch (error) {
        console.log("Error in rejectCorrection:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}
