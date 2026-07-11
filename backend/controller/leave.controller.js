import { pool } from '../config/db.js';

export async function getLeaves(req, res) {
    try {
        const leavesRes = await pool.query(`
            SELECT lr.*, e.full_name, e.employee_code
            FROM leave_requests lr
            LEFT JOIN employees e ON lr.employee_id = e.id
            ORDER BY lr.id DESC;
        `);

        const employeesRes = await pool.query(
            "SELECT id, full_name FROM employees WHERE status = 'Active' OR status IS NULL OR status = 'active' ORDER BY full_name ASC;"
        );

        res.status(200).json({
            success: true,
            data: {
                leaves: leavesRes.rows,
                employees: employeesRes.rows
            }
        });
    } catch (error) {
        console.log("Error in getLeaves:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function createManualLeave(req, res) {
    try {
        const { employeeId, leaveType, startDate, endDate, reason } = req.body;
        const approvedBy = req.user ? req.user.id : null;

        if (!employeeId || !leaveType || !startDate || !endDate) {
            return res.status(400).json({ success: false, message: "Employee, Leave Type, Start Date, and End Date are required" });
        }

        const query = `
            INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, reason, status, approved_by)
            VALUES ($1, $2, $3, $4, $5, 'Approved', $6) RETURNING *;
        `;
        const values = [
            parseInt(employeeId, 10),
            leaveType,
            startDate,
            endDate,
            reason || null,
            approvedBy
        ];

        const result = await pool.query(query, values);
        res.status(201).json({ success: true, message: "Leave record created successfully", data: result.rows[0] });
    } catch (error) {
        console.log("Error in createManualLeave:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function approveLeave(req, res) {
    try {
        const { id } = req.params;
        const approvedBy = req.user ? req.user.id : null;

        const result = await pool.query(
            `UPDATE leave_requests
             SET status = 'Approved', approved_by = $1
             WHERE id = $2 RETURNING *;`,
            [approvedBy, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Leave request not found" });
        }

        res.status(200).json({ success: true, message: "Leave request approved successfully", data: result.rows[0] });
    } catch (error) {
        console.log("Error in approveLeave:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function rejectLeave(req, res) {
    try {
        const { id } = req.params;
        const approvedBy = req.user ? req.user.id : null;

        const result = await pool.query(
            `UPDATE leave_requests
             SET status = 'Rejected', approved_by = $1
             WHERE id = $2 RETURNING *;`,
            [approvedBy, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Leave request not found" });
        }

        res.status(200).json({ success: true, message: "Leave request rejected successfully", data: result.rows[0] });
    } catch (error) {
        console.log("Error in rejectLeave:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function deleteLeave(req, res) {
    try {
        const { id } = req.params;
        const result = await pool.query("DELETE FROM leave_requests WHERE id = $1 RETURNING *;", [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Leave request not found" });
        }

        res.status(200).json({ success: true, message: "Leave request deleted successfully" });
    } catch (error) {
        console.log("Error in deleteLeave:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}
