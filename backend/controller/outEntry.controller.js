import { pool } from '../config/db.js';

/**
 * Get out entries / gate passes with filtering and live metrics
 */
export async function getOutEntries(req, res) {
    try {
        const { date, employeeId, purpose, status, startDate, endDate } = req.query;
        const user = req.user;

        let whereClauses = [];
        let params = [];
        let pIdx = 1;

        // If employee role (and not Admin/HR), restrict to self
        if (user && user.role !== 'Admin' && user.role !== 'HR' && user.employee_id) {
            whereClauses.push(`oe.employee_id = $${pIdx++}`);
            params.push(user.employee_id);
        } else if (employeeId) {
            whereClauses.push(`oe.employee_id = $${pIdx++}`);
            params.push(parseInt(employeeId, 10));
        }

        if (date) {
            whereClauses.push(`oe.date = $${pIdx++}`);
            params.push(date);
        } else if (startDate && endDate) {
            whereClauses.push(`oe.date BETWEEN $${pIdx++} AND $${pIdx++}`);
            params.push(startDate);
            params.push(endDate);
        }

        if (purpose && purpose !== 'All') {
            whereClauses.push(`oe.purpose = $${pIdx++}`);
            params.push(purpose);
        }

        if (status && status !== 'All') {
            whereClauses.push(`oe.status = $${pIdx++}`);
            params.push(status);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const query = `
            SELECT 
                oe.id,
                oe.employee_id,
                oe.date,
                TO_CHAR(oe.out_time, 'HH24:MI') as out_time,
                TO_CHAR(oe.in_time, 'HH24:MI') as in_time,
                oe.duration_minutes,
                oe.purpose,
                oe.destination,
                oe.reason,
                oe.status,
                oe.approved_by,
                oe.remarks,
                oe.created_at,
                COALESCE(e.full_name, 'Unknown') as employee_name,
                e.employee_code,
                COALESCE(d.name, 'General') as department,
                COALESCE(des.title, 'Staff') as designation,
                app.full_name as approver_name
            FROM out_entries oe
            LEFT JOIN employees e ON oe.employee_id = e.id
            LEFT JOIN departments d ON e.department_id = d.id
            LEFT JOIN designations des ON e.designation_id = des.id
            LEFT JOIN employees app ON oe.approved_by = app.id
            ${whereSql}
            ORDER BY oe.date DESC, oe.out_time DESC, oe.id DESC;
        `;

        const { rows } = await pool.query(query, params);

        // Calculate live metrics for today
        const statsRes = await pool.query(`
            SELECT 
                COUNT(*) FILTER (WHERE status = 'Out' AND date = CURRENT_DATE) as currently_out,
                COUNT(*) FILTER (WHERE date = CURRENT_DATE) as total_today,
                COUNT(*) FILTER (WHERE date = CURRENT_DATE AND purpose IN ('Official Duty', 'Client Visit', 'Bank Work')) as official_today,
                COUNT(*) FILTER (WHERE date = CURRENT_DATE AND purpose IN ('Personal Work', 'Emergency / Medical', 'Personal')) as personal_today
            FROM out_entries;
        `);

        // Get active employee list for selection dropdown
        const empListRes = await pool.query(`
            SELECT e.id, e.full_name, e.employee_code, COALESCE(d.name, 'General') as department 
            FROM employees e
            LEFT JOIN departments d ON e.department_id = d.id
            WHERE e.status = 'Active' OR e.status IS NULL OR e.status = 'active'
            ORDER BY e.full_name ASC;
        `);

        res.status(200).json({
            success: true,
            data: {
                entries: rows,
                stats: statsRes.rows[0] || {
                    currently_out: 0,
                    total_today: 0,
                    official_today: 0,
                    personal_today: 0
                },
                employees: empListRes.rows
            }
        });
    } catch (error) {
        console.error("Error in getOutEntries:", error);
        res.status(500).json({ success: false, message: "Failed to fetch out entries", error: error.message });
    }
}

/**
 * Record a new Out Entry / Gate Pass
 */
export async function createOutEntry(req, res) {
    try {
        const { employeeId, date, outTime, inTime, purpose, destination, reason, remarks } = req.body;
        const user = req.user;

        let targetEmployeeId = employeeId ? parseInt(employeeId, 10) : null;
        if (!targetEmployeeId && user && user.employee_id) {
            targetEmployeeId = user.employee_id;
        }

        if (!targetEmployeeId) {
            return res.status(400).json({ success: false, message: "Employee ID is required" });
        }

        if (!outTime || !purpose) {
            return res.status(400).json({ success: false, message: "Out Time and Purpose are required" });
        }

        const entryDate = date || new Date().toISOString().split('T')[0];
        const status = inTime ? 'Returned' : 'Out';
        const approvedBy = (user && (user.role === 'Admin' || user.role === 'HR')) ? user.id : null;

        let durationMinutes = 0;
        if (outTime && inTime) {
            const [outH, outM] = outTime.split(':').map(Number);
            const [inH, inM] = inTime.split(':').map(Number);
            durationMinutes = (inH * 60 + inM) - (outH * 60 + outM);
            if (durationMinutes < 0) durationMinutes = 0;
        }

        const query = `
            INSERT INTO out_entries (
                employee_id, date, out_time, in_time, duration_minutes,
                purpose, destination, reason, status, approved_by, remarks
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *;
        `;

        const values = [
            targetEmployeeId,
            entryDate,
            outTime,
            inTime || null,
            durationMinutes,
            purpose,
            destination || null,
            reason || null,
            status,
            approvedBy,
            remarks || null
        ];

        const { rows } = await pool.query(query, values);

        res.status(201).json({
            success: true,
            message: "Out entry recorded successfully",
            data: rows[0]
        });
    } catch (error) {
        console.error("Error in createOutEntry:", error);
        res.status(500).json({ success: false, message: "Failed to record out entry", error: error.message });
    }
}

/**
 * Mark return in-time for an active Out Entry
 */
export async function markReturnInTime(req, res) {
    try {
        const { id } = req.params;
        const { inTime, remarks } = req.body;

        if (!inTime) {
            return res.status(400).json({ success: false, message: "Return in-time is required" });
        }

        // Fetch existing out entry
        const existing = await pool.query("SELECT * FROM out_entries WHERE id = $1;", [id]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Out entry not found" });
        }

        const outEntry = existing.rows[0];
        const outTimeStr = String(outEntry.out_time).substring(0, 5);
        const [outH, outM] = outTimeStr.split(':').map(Number);
        const [inH, inM] = inTime.split(':').map(Number);
        let durationMinutes = (inH * 60 + inM) - (outH * 60 + outM);
        if (durationMinutes < 0) durationMinutes = 0;

        const updateRes = await pool.query(`
            UPDATE out_entries 
            SET 
                in_time = $1,
                duration_minutes = $2,
                status = 'Returned',
                remarks = COALESCE($3, remarks),
                updated_at = NOW()
            WHERE id = $4
            RETURNING *;
        `, [inTime, durationMinutes, remarks || null, id]);

        res.status(200).json({
            success: true,
            message: "Return time recorded successfully",
            data: updateRes.rows[0]
        });
    } catch (error) {
        console.error("Error in markReturnInTime:", error);
        res.status(500).json({ success: false, message: "Failed to update return time", error: error.message });
    }
}

/**
 * Approve or Reject Out Entry
 */
export async function updateOutEntryStatus(req, res) {
    try {
        const { id } = req.params;
        const { status, remarks } = req.body;
        const user = req.user;

        if (!['Approved', 'Rejected', 'Returned', 'Out'].includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid status value" });
        }

        const approverId = (user && user.employee_id) ? user.employee_id : (user ? user.id : null);

        const updateRes = await pool.query(`
            UPDATE out_entries
            SET 
                status = $1,
                approved_by = $2,
                remarks = COALESCE($3, remarks),
                updated_at = NOW()
            WHERE id = $4
            RETURNING *;
        `, [status, approverId, remarks || null, id]);

        if (updateRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Out entry not found" });
        }

        res.status(200).json({
            success: true,
            message: `Out entry ${status.toLowerCase()} successfully`,
            data: updateRes.rows[0]
        });
    } catch (error) {
        console.error("Error in updateOutEntryStatus:", error);
        res.status(500).json({ success: false, message: "Failed to update status", error: error.message });
    }
}

/**
 * Delete Out Entry
 */
export async function deleteOutEntry(req, res) {
    try {
        const { id } = req.params;
        await pool.query("DELETE FROM out_entries WHERE id = $1;", [id]);
        res.status(200).json({ success: true, message: "Out entry deleted successfully" });
    } catch (error) {
        console.error("Error in deleteOutEntry:", error);
        res.status(500).json({ success: false, message: "Failed to delete out entry", error: error.message });
    }
}
