import { pool } from '../config/db.js';

function getWeekNumber(d) {
    const target = new Date(d.valueOf());
    const dayNr = (d.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
        target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }
    return 1 + Math.ceil((firstThursday - target) / 604800000);
}

export async function getTimesheets(req, res) {
    try {
        const result = await pool.query(`
            SELECT t.*, e.full_name, e.employee_code
            FROM timesheets t
            LEFT JOIN employees e ON t.employee_id = e.id
            ORDER BY t.date DESC, e.full_name ASC;
        `);

        const employeesRes = await pool.query(
            "SELECT id, full_name FROM employees WHERE status = 'Active' OR status IS NULL OR status = 'active' ORDER BY full_name ASC;"
        );

        res.status(200).json({
            success: true,
            data: {
                timesheets: result.rows,
                employees: employeesRes.rows
            }
        });
    } catch (error) {
        console.log("Error in getTimesheets:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function createManualTimesheet(req, res) {
    try {
        const { employeeId, date, remarks, entries } = req.body;
        const approvedBy = req.user ? req.user.id : null;

        if (!employeeId || !date || !entries || !Array.isArray(entries) || entries.length === 0) {
            return res.status(400).json({ success: false, message: "Employee, Date, and at least one task entry are required" });
        }

        const dateObj = new Date(date);
        const year = dateObj.getFullYear();
        const month = dateObj.getMonth() + 1;
        const weekNumber = getWeekNumber(dateObj);

        let totalHours = 0;
        let billableHours = 0;
        let nonBillableHours = 0;

        entries.forEach(e => {
            const h = parseFloat(e.hours) || 0;
            totalHours += h;
            if (e.isBillable) {
                billableHours += h;
            } else {
                nonBillableHours += h;
            }
        });

        const query = `
            INSERT INTO timesheets (
                employee_id, date, total_hours, billable_hours, non_billable_hours, 
                entries, status, remarks, submitted_at, approved_by, week_number, month, year
            )
            VALUES ($1, $2, $3, $4, $5, $6, 'Approved', $7, CURRENT_TIMESTAMP, $8, $9, $10, $11) 
            RETURNING *;
        `;
        const values = [
            parseInt(employeeId, 10),
            date,
            totalHours,
            billableHours,
            nonBillableHours,
            JSON.stringify(entries),
            remarks || null,
            approvedBy,
            weekNumber,
            month,
            year
        ];

        const result = await pool.query(query, values);
        res.status(201).json({ success: true, message: "Timesheet record created successfully", data: result.rows[0] });
    } catch (error) {
        console.log("Error in createManualTimesheet:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function approveTimesheet(req, res) {
    try {
        const { id } = req.params;
        const approvedBy = req.user ? req.user.id : null;

        const result = await pool.query(
            `UPDATE timesheets
             SET status = 'Approved', approved_by = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2 RETURNING *;`,
            [approvedBy, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Timesheet not found" });
        }

        res.status(200).json({ success: true, message: "Timesheet approved successfully", data: result.rows[0] });
    } catch (error) {
        console.log("Error in approveTimesheet:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function rejectTimesheet(req, res) {
    try {
        const { id } = req.params;
        const approvedBy = req.user ? req.user.id : null;

        const result = await pool.query(
            `UPDATE timesheets
             SET status = 'Rejected', approved_by = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2 RETURNING *;`,
            [approvedBy, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Timesheet not found" });
        }

        res.status(200).json({ success: true, message: "Timesheet rejected successfully", data: result.rows[0] });
    } catch (error) {
        console.log("Error in rejectTimesheet:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function deleteTimesheet(req, res) {
    try {
        const { id } = req.params;
        const result = await pool.query("DELETE FROM timesheets WHERE id = $1 RETURNING *;", [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Timesheet record not found" });
        }

        res.status(200).json({ success: true, message: "Timesheet record deleted successfully" });
    } catch (error) {
        console.log("Error in deleteTimesheet:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}
