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

function formatDateDMY(val) {
    if (!val) return '';
    try {
        const d = new Date(val);
        if (!isNaN(d.getTime())) {
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            return `${day}/${month}/${year}`;
        }
    } catch(e) {}
    return String(val).split('T')[0];
}

export async function createManualLeave(req, res) {
    try {
        const { employeeId, leaveType, startDate, endDate, reason } = req.body;
        const approvedBy = req.user ? req.user.id : null;

        if (!employeeId || !leaveType || !startDate || !endDate) {
            return res.status(400).json({ success: false, message: "Employee, Leave Type, Start Date, and End Date are required" });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);

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

        try {
            const ltRes = await pool.query(`
                SELECT id, default_balance FROM leave_types 
                WHERE LOWER(name) = LOWER($1) OR LOWER(code) = LOWER($1) LIMIT 1;
            `, [leaveType]);

            const leaveTypeId = ltRes.rows[0]?.id || 1;
            const defaultBal = parseFloat(ltRes.rows[0]?.default_balance || 15);

            await pool.query(`
                INSERT INTO leaves (employee_id, leave_type_id, start_date, end_date, total_days, reason, status, approved_by)
                VALUES ($1, $2, $3, $4, $5, $6, 'Approved', $7);
            `, [parseInt(employeeId, 10), leaveTypeId, startDate, endDate, diffDays, reason || "", approvedBy]);

            await pool.query(`
                INSERT INTO leave_balances (employee_id, leave_type_id, balance, used)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (employee_id, leave_type_id)
                DO UPDATE SET used = leave_balances.used + $4, updated_at = NOW();
            `, [parseInt(employeeId, 10), leaveTypeId, defaultBal, diffDays]);

            // Create notification in employee's inbox
            const startFmt = formatDateDMY(startDate);
            const endFmt = formatDateDMY(endDate);
            await pool.query(`
                INSERT INTO notifications (recipient_id, type, title, message, link, metadata, is_read)
                VALUES ($1, 'Leave', $2, $3, '/employee-attendance.html', $4, false);
            `, [
                parseInt(employeeId, 10),
                `Leave Approved: ${leaveType}`,
                `Your leave for ${leaveType} (${startFmt} to ${endFmt}, ${diffDays} day${diffDays > 1 ? 's' : ''}) has been approved by admin.\nReason: ${reason || 'Approved by Administrator'}`,
                JSON.stringify({ leave_type: leaveType, start_date: startDate, end_date: endDate, total_days: diffDays, status: 'Approved', reason: reason || "" })
            ]);
        } catch (syncErr) {
            console.warn("createManualLeave sync warning:", syncErr.message);
        }

        res.status(201).json({ success: true, message: "Leave record created successfully", data: result.rows[0] });
    } catch (error) {
        console.log("Error in createManualLeave:", error.message);
        res.status(500).json({ success: false, message: error.message || "Internal server error" });
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

        const lr = result.rows[0];
        const start = new Date(lr.start_date);
        const end = new Date(lr.end_date);
        const lTypeStr = (lr.leave_type || '').toLowerCase();
        const isHalfDay = lTypeStr.includes('half') || lTypeStr === 'lh' || lTypeStr === 'h' || lTypeStr === 'hd';
        const diffDays = isHalfDay ? 0.5 : Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);

        try {
            const ltRes = await pool.query(`
                SELECT id, default_balance FROM leave_types 
                WHERE LOWER(name) = LOWER($1) OR LOWER(code) = LOWER($1) LIMIT 1;
            `, [lr.leave_type]);

            let leaveTypeId = ltRes.rows[0]?.id || 1;
            const defaultBal = parseFloat(ltRes.rows[0]?.default_balance || 15);

            // 1. Update matching row in leaves table
            const updateLeavesRes = await pool.query(`
                UPDATE leaves
                SET status = 'Approved', approved_by = $1, updated_at = NOW()
                WHERE employee_id = $2 AND start_date::date = $3::date AND end_date::date = $4::date
                RETURNING *;
            `, [approvedBy, lr.employee_id, lr.start_date, lr.end_date]);

            if (updateLeavesRes.rows.length === 0) {
                await pool.query(`
                    INSERT INTO leaves (employee_id, leave_type_id, start_date, end_date, total_days, reason, status, approved_by)
                    VALUES ($1, $2, $3, $4, $5, $6, 'Approved', $7);
                `, [lr.employee_id, leaveTypeId, lr.start_date, lr.end_date, diffDays, lr.reason || "", approvedBy]);
            } else {
                leaveTypeId = updateLeavesRes.rows[0].leave_type_id || leaveTypeId;
            }

            // 2. Increment used days in leave_balances
            await pool.query(`
                INSERT INTO leave_balances (employee_id, leave_type_id, balance, used)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (employee_id, leave_type_id)
                DO UPDATE SET used = leave_balances.used + $4, updated_at = NOW();
            `, [lr.employee_id, leaveTypeId, defaultBal, diffDays]);

            // 3. Create notification in employee's inbox
            const startFmt = formatDateDMY(lr.start_date);
            const endFmt = formatDateDMY(lr.end_date);
            await pool.query(`
                INSERT INTO notifications (recipient_id, type, title, message, link, metadata, is_read)
                VALUES ($1, 'Leave', $2, $3, '/employee-attendance.html', $4, false);
            `, [
                lr.employee_id,
                `Leave Approved: ${lr.leave_type}`,
                `Your leave request for ${lr.leave_type} (${startFmt} to ${endFmt}, ${diffDays} day${diffDays > 1 ? 's' : ''}) has been APPROVED by the administrator.\nReason: ${lr.reason || 'N/A'}`,
                JSON.stringify({ leave_type: lr.leave_type, start_date: lr.start_date, end_date: lr.end_date, total_days: diffDays, status: 'Approved', reason: lr.reason || "" })
            ]);
        } catch (syncErr) {
            console.warn("approveLeave sync warning:", syncErr.message);
        }

        res.status(200).json({ success: true, message: "Leave request approved successfully", data: result.rows[0] });
    } catch (error) {
        console.log("Error in approveLeave:", error.message);
        res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
}

export async function rejectLeave(req, res) {
    try {
        const { id } = req.params;
        const approvedBy = req.user ? req.user.id : null;

        const oldRes = await pool.query("SELECT * FROM leave_requests WHERE id = $1;", [id]);
        if (oldRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Leave request not found" });
        }
        const prevStatus = oldRes.rows[0].status;

        const result = await pool.query(
            `UPDATE leave_requests
             SET status = 'Rejected', approved_by = $1
             WHERE id = $2 RETURNING *;`,
            [approvedBy, id]
        );

        const lr = result.rows[0];
        const start = new Date(lr.start_date);
        const end = new Date(lr.end_date);
        const lTypeStr = (lr.leave_type || '').toLowerCase();
        const isHalfDay = lTypeStr.includes('half') || lTypeStr === 'lh' || lTypeStr === 'h' || lTypeStr === 'hd';
        const diffDays = isHalfDay ? 0.5 : Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);

        try {
            await pool.query(`
                UPDATE leaves
                SET status = 'Rejected', approved_by = $1, updated_at = NOW()
                WHERE employee_id = $2 AND start_date::date = $3::date AND end_date::date = $4::date;
            `, [approvedBy, lr.employee_id, lr.start_date, lr.end_date]);

            if (prevStatus === 'Approved') {
                const ltRes = await pool.query(`SELECT id FROM leave_types WHERE LOWER(name) = LOWER($1) LIMIT 1;`, [lr.leave_type]);
                if (ltRes.rows.length > 0) {
                    await pool.query(`
                        UPDATE leave_balances
                        SET used = GREATEST(0, used - $1), updated_at = NOW()
                        WHERE employee_id = $2 AND leave_type_id = $3;
                    `, [diffDays, lr.employee_id, ltRes.rows[0].id]);
                }
            }

            // Create notification in employee's inbox
            const startFmt = formatDateDMY(lr.start_date);
            const endFmt = formatDateDMY(lr.end_date);
            await pool.query(`
                INSERT INTO notifications (recipient_id, type, title, message, link, metadata, is_read)
                VALUES ($1, 'Leave', $2, $3, '/employee-attendance.html', $4, false);
            `, [
                lr.employee_id,
                `Leave Request Declined: ${lr.leave_type}`,
                `Your leave request for ${lr.leave_type} (${startFmt} to ${endFmt}, ${diffDays} day${diffDays > 1 ? 's' : ''}) has been DECLINED by the administrator.`,
                JSON.stringify({ leave_type: lr.leave_type, start_date: lr.start_date, end_date: lr.end_date, total_days: diffDays, status: 'Rejected', reason: lr.reason || "" })
            ]);
        } catch (syncErr) {
            console.warn("rejectLeave sync warning:", syncErr.message);
        }

        res.status(200).json({ success: true, message: "Leave request rejected successfully", data: result.rows[0] });
    } catch (error) {
        console.log("Error in rejectLeave:", error.message);
        res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
}

export async function deleteLeave(req, res) {
    try {
        const { id } = req.params;
        const oldRes = await pool.query("SELECT * FROM leave_requests WHERE id = $1;", [id]);
        if (oldRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Leave request not found" });
        }
        const lr = oldRes.rows[0];
        const start = new Date(lr.start_date);
        const end = new Date(lr.end_date);
        const diffDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);

        await pool.query("DELETE FROM leave_requests WHERE id = $1;", [id]);

        try {
            await pool.query(`
                DELETE FROM leaves
                WHERE employee_id = $1 AND start_date::date = $2::date AND end_date::date = $3::date;
            `, [lr.employee_id, lr.start_date, lr.end_date]);

            if (lr.status === 'Approved') {
                const ltRes = await pool.query(`SELECT id FROM leave_types WHERE LOWER(name) = LOWER($1) LIMIT 1;`, [lr.leave_type]);
                if (ltRes.rows.length > 0) {
                    await pool.query(`
                        UPDATE leave_balances
                        SET used = GREATEST(0, used - $1), updated_at = NOW()
                        WHERE employee_id = $2 AND leave_type_id = $3;
                    `, [diffDays, lr.employee_id, ltRes.rows[0].id]);
                }
            }
        } catch (syncErr) {
            console.warn("deleteLeave sync warning:", syncErr.message);
        }

        res.status(200).json({ success: true, message: "Leave request deleted successfully" });
    } catch (error) {
        console.log("Error in deleteLeave:", error.message);
        res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
}
