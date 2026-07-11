import { pool } from '../config/db.js';

export async function getShiftsData(req, res) {
    try {
        const shiftsRes = await pool.query("SELECT * FROM shifts ORDER BY id DESC;");
        
        const rosterRes = await pool.query(`
            SELECT es.*, e.full_name, e.employee_code, s.name AS shift_name, s.start_time, s.end_time
            FROM employee_shifts es
            LEFT JOIN employees e ON es.employee_id = e.id
            LEFT JOIN shifts s ON es.shift_id = s.id
            ORDER BY es.id DESC;
        `);

        const employeesRes = await pool.query(
            "SELECT id, full_name FROM employees WHERE status = 'Active' OR status IS NULL OR status = 'active' ORDER BY full_name ASC;"
        );

        res.status(200).json({
            success: true,
            data: {
                shifts: shiftsRes.rows,
                roster: rosterRes.rows,
                employees: employeesRes.rows
            }
        });
    } catch (error) {
        console.log("Error in getShiftsData:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function createShift(req, res) {
    try {
        const { name, code, startTime, endTime, gracePeriod } = req.body;

        if (!name || !code || !startTime || !endTime) {
            return res.status(400).json({ success: false, message: "Name, Code, Start Time, and End Time are required" });
        }

        const query = `
            INSERT INTO shifts (name, code, start_time, end_time, grace_period)
            VALUES ($1, $2, $3, $4, $5) RETURNING *;
        `;
        const values = [
            name,
            code,
            startTime,
            endTime,
            gracePeriod ? parseInt(gracePeriod, 10) : null
        ];

        const result = await pool.query(query, values);
        res.status(201).json({ success: true, message: "Shift created successfully", data: result.rows[0] });
    } catch (error) {
        console.log("Error in createShift:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function deleteShift(req, res) {
    try {
        const { id } = req.params;
        const result = await pool.query("DELETE FROM shifts WHERE id = $1 RETURNING *;", [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Shift not found" });
        }

        res.status(200).json({ success: true, message: "Shift deleted successfully" });
    } catch (error) {
        console.log("Error in deleteShift:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function assignShiftBulk(req, res) {
    const client = await pool.connect();
    try {
        const { shiftId, employeeIds, startDate, endDate } = req.body;

        if (!shiftId || !employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0 || !startDate) {
            return res.status(400).json({ success: false, message: "Shift, assigned employees, and Start Date are required" });
        }

        await client.query("BEGIN");

        for (const empId of employeeIds) {
            await client.query(
                `INSERT INTO employee_shifts (employee_id, shift_id, start_date, end_date)
                 VALUES ($1, $2, $3, $4)`,
                [parseInt(empId, 10), parseInt(shiftId, 10), startDate, endDate || null]
            );
        }

        await client.query("COMMIT");
        res.status(201).json({ success: true, message: "Shifts assigned bulk-wise successfully" });
    } catch (error) {
        await client.query("ROLLBACK");
        console.log("Error in assignShiftBulk:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    } finally {
        client.release();
    }
}

export async function deleteRosterAssignment(req, res) {
    try {
        const { id } = req.params;
        const result = await pool.query("DELETE FROM employee_shifts WHERE id = $1 RETURNING *;", [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Roster assignment not found" });
        }

        res.status(200).json({ success: true, message: "Roster assignment deleted successfully" });
    } catch (error) {
        console.log("Error in deleteRosterAssignment:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}
