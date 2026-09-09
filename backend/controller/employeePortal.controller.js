import { pool } from '../config/db.js';
import bcryptjs from 'bcryptjs';
import { getWebPagesApplicationsGrid } from '../services/teramind.service.js';

// Helper to get active employee ID from user session
async function getEmployeeId(userId) {
    const res = await pool.query("SELECT id FROM employees WHERE user_id = $1", [userId]);
    if (res.rows.length === 0) {
        // Fallback for Admin user without explicit employee record
        const unlinkedRes = await pool.query("SELECT id FROM employees WHERE user_id IS NULL ORDER BY id ASC LIMIT 1");
        if (unlinkedRes.rows.length > 0) {
            const empId = unlinkedRes.rows[0].id;
            await pool.query("UPDATE employees SET user_id = $1 WHERE id = $2", [userId, empId]).catch(() => {});
            return empId;
        }
        const fallbackRes = await pool.query("SELECT id FROM employees ORDER BY id ASC LIMIT 1");
        return fallbackRes.rows[0]?.id || userId;
    }
    return res.rows[0].id;
}

export async function getDashboardSummary(req, res) {
    try {
        const employeeId = await getEmployeeId(req.user.id);

        // 1. Work Hours Today
        const hoursRes = await pool.query(
            "SELECT COALESCE(total_working_hours, 0) as hours FROM attendance WHERE employee_id = $1 AND date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date;",
            [employeeId]
        );
        const hoursToday = hoursRes.rows.length > 0 ? parseFloat(hoursRes.rows[0].hours) : 0;

        // 2. Tasks Completed
        const tasksRes = await pool.query(
            "SELECT COUNT(*) as count FROM tasks WHERE $1 = ANY(assigned_to) AND status = 'Completed';",
            [employeeId]
        );
        const tasksCompleted = parseInt(tasksRes.rows[0].count, 10);

        // 3. Attendance Status
        const attRes = await pool.query(
            `SELECT status, 
                    COALESCE(login_time, portal_check_in) as login_time, 
                    COALESCE(logout_time, portal_check_out) as logout_time,
                    COALESCE(is_on_break, false) as is_on_break,
                    break_start,
                    COALESCE(total_break_seconds, 0) as total_break_seconds
             FROM attendance 
             WHERE employee_id = $1 AND date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date;`,
            [employeeId]
        );
        let attStatus = 'Absent';
        let checkInTime = null;
        let isOnBreak = false;
        let breakStart = null;
        let totalBreakSeconds = 0;
        if (attRes.rows.length > 0) {
            const r = attRes.rows[0];
            checkInTime = r.login_time;
            isOnBreak = r.is_on_break === true;
            breakStart = r.break_start;
            totalBreakSeconds = r.total_break_seconds || 0;
            if (checkInTime) {
                attStatus = isOnBreak ? 'On Break' : (r.status || 'Present');
            } else {
                attStatus = 'Not clocked in';
            }
        }

        // 4. Leave Balance (sum of all remaining balances)
        const leaveBalRes = await pool.query(
            "SELECT COALESCE(SUM(balance - used), 0) as balance FROM leave_balances WHERE employee_id = $1;",
            [employeeId]
        );
        const leaveBalance = parseFloat(leaveBalRes.rows[0].balance);

        // 5. Pending Approvals count (Leaves + Timesheets)
        const pendingLeavesRes = await pool.query(
            "SELECT COUNT(*) as count FROM leaves WHERE employee_id = $1 AND status = 'Pending';",
            [employeeId]
        ).catch(() => ({ rows: [{ count: 0 }] }));
        const pendingTimesheetsRes = await pool.query(
            "SELECT COUNT(*) as count FROM timesheets WHERE employee_id = $1 AND status = 'Pending';",
            [employeeId]
        ).catch(() => ({ rows: [{ count: 0 }] }));
        const pendingRequests = parseInt(pendingLeavesRes.rows[0].count, 10) + parseInt(pendingTimesheetsRes.rows[0].count, 10);

        // 6. Announcements Notice Board
        const noticesRes = await pool.query(`
            SELECT n.*, e.full_name, e.employee_code 
            FROM notifications n
            LEFT JOIN employees e ON n.recipient_id = e.id
            WHERE n.recipient_id IS NULL OR n.recipient_id = $1
            ORDER BY n.created_at DESC LIMIT 5;
        `, [employeeId]);

        // 7. Assigned Tasks list
        const activeTasksRes = await pool.query(
            "SELECT * FROM tasks WHERE $1 = ANY(assigned_to) AND status != 'Completed' ORDER BY due_date ASC LIMIT 5;",
            [employeeId]
        );

        res.status(200).json({
            success: true,
            server_time: new Date().toISOString(),
            data: {
                hoursToday,
                tasksCompleted,
                attStatus,
                checkInTime,
                isOnBreak,
                breakStart,
                totalBreakSeconds,
                leaveBalance,
                pendingRequests,
                announcements: noticesRes.rows,
                activeTasks: activeTasksRes.rows
            }
        });
    } catch (error) {
        console.log("Error in getDashboardSummary:", error.message);
        res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
}

export async function getAttendanceStatus(req, res) {
    try {
        const employeeId = await getEmployeeId(req.user.id);
        const attRes = await pool.query(
            `SELECT id, 
                    COALESCE(login_time, portal_check_in) as login_time, 
                    COALESCE(logout_time, portal_check_out) as logout_time, 
                    status, 
                    COALESCE(total_working_hours, 0) as total_hours,
                    COALESCE(is_on_break, false) as is_on_break,
                    break_start,
                    COALESCE(total_break_seconds, 0) as total_break_seconds
             FROM attendance 
             WHERE employee_id = $1 AND date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date;`,
            [employeeId]
        );
        res.status(200).json({
            success: true,
            server_time: new Date().toISOString(),
            data: attRes.rows.length > 0 ? attRes.rows[0] : null
        });
    } catch (error) {
        console.log("Error in getAttendanceStatus:", error.message);
        res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
}

export async function clockIn(req, res) {
    try {
        const employeeId = await getEmployeeId(req.user.id);
        const { lat, lng } = req.body;

        const now = new Date();
        const nowParts = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false
        }).formatToParts(now);
        const p = {};
        nowParts.forEach(({ type, value }) => { p[type] = value; });
        const hh = parseInt(p.hour, 10);
        const mm = parseInt(p.minute, 10);
        const isLate = (hh > 10 || (hh === 10 && mm > 15));
        const status = isLate ? 'Late' : 'Present';

        const checkRes = await pool.query(
            "SELECT id, login_time, logout_time, portal_check_in, portal_check_out FROM attendance WHERE employee_id = $1 AND date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date;",
            [employeeId]
        );

        if (checkRes.rows.length > 0) {
            const existing = checkRes.rows[0];
            const hasLoggedIn = !!(existing.login_time || existing.portal_check_in);
            const hasLoggedOut = !!(existing.logout_time || existing.portal_check_out);

            if (!hasLoggedIn) {
                // Pre-existing unpunched record (e.g. placeholder row) -> Clock In for the first time today!
                const result = await pool.query(`
                    UPDATE attendance 
                    SET login_time = CURRENT_TIMESTAMP, 
                        portal_check_in = CURRENT_TIMESTAMP,
                        login_lat = $2, 
                        login_lng = $3, 
                        punch_source = 'PORTAL',
                        status = $4,
                        is_late_login = $5,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $1
                    RETURNING *;
                `, [existing.id, lat || null, lng || null, status, isLate]);

                await pool.query(`
                    INSERT INTO attendance_logs (employee_id, work_date, clock_in, correction_status)
                    VALUES ($1, (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date, CURRENT_TIMESTAMP, 'Approved');
                `, [employeeId]);

                return res.status(200).json({ success: true, message: "Clocked in successfully", data: result.rows[0] });
            }

            if (hasLoggedIn && !hasLoggedOut) {
                return res.status(400).json({ success: false, message: "You are already clocked in for today" });
            }

            if (hasLoggedIn && hasLoggedOut) {
                // Already clocked out earlier today -> Allow resuming session!
                const result = await pool.query(`
                    UPDATE attendance 
                    SET logout_time = NULL, 
                        portal_check_out = NULL,
                        logout_lat = NULL, 
                        logout_lng = NULL,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $1
                    RETURNING *;
                `, [existing.id]);

                return res.status(200).json({ success: true, message: "Welcome back! Session resumed.", data: result.rows[0] });
            }
        }

        const result = await pool.query(`
            INSERT INTO attendance (employee_id, date, login_time, portal_check_in, login_lat, login_lng, status, is_late_login, punch_source)
            VALUES ($1, (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $2, $3, $4, $5, 'PORTAL')
            RETURNING *;
        `, [employeeId, lat || null, lng || null, status, isLate]);

        await pool.query(`
            INSERT INTO attendance_logs (employee_id, work_date, clock_in, correction_status)
            VALUES ($1, (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date, CURRENT_TIMESTAMP, 'Approved');
        `, [employeeId]);

        res.status(201).json({ success: true, message: "Clocked in successfully", data: result.rows[0] });
    } catch (error) {
        console.log("Error in clockIn:", error.message);
        res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
}

export async function startBreak(req, res) {
    try {
        const employeeId = await getEmployeeId(req.user.id);
        const checkRes = await pool.query(
            `SELECT id, login_time, logout_time, portal_check_in, portal_check_out, is_on_break, total_break_seconds 
             FROM attendance 
             WHERE employee_id = $1 AND date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date;`,
            [employeeId]
        );

        if (checkRes.rows.length === 0 || (!checkRes.rows[0].login_time && !checkRes.rows[0].portal_check_in) || checkRes.rows[0].logout_time) {
            return res.status(400).json({ success: false, message: "You must be actively clocked in to take a break" });
        }

        if (checkRes.rows[0].is_on_break) {
            return res.status(400).json({ success: false, message: "You are already on a break" });
        }

        // 1-hour max break policy (3600 seconds)
        const totalUsed = checkRes.rows[0].total_break_seconds || 0;
        if (totalUsed >= 3600) {
            return res.status(400).json({ success: false, message: "Daily 1-hour break limit (60 mins) already consumed" });
        }

        const result = await pool.query(`
            UPDATE attendance 
            SET is_on_break = true,
                break_start = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *;
        `, [checkRes.rows[0].id]);

        res.status(200).json({ success: true, message: "Break started. Enjoy your break!", data: result.rows[0] });
    } catch (error) {
        console.log("Error in startBreak:", error.message);
        res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
}

export async function endBreak(req, res) {
    try {
        const employeeId = await getEmployeeId(req.user.id);
        const checkRes = await pool.query(
            `SELECT id, break_start, is_on_break, total_break_seconds, break_history 
             FROM attendance 
             WHERE employee_id = $1 AND date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date;`,
            [employeeId]
        );

        if (checkRes.rows.length === 0 || !checkRes.rows[0].is_on_break) {
            return res.status(400).json({ success: false, message: "No active break session found" });
        }

        const breakStart = new Date(checkRes.rows[0].break_start);
        const now = new Date();
        const durationSec = Math.max(0, Math.floor((now - breakStart) / 1000));
        const newTotalSec = (checkRes.rows[0].total_break_seconds || 0) + durationSec;

        const history = Array.isArray(checkRes.rows[0].break_history) ? checkRes.rows[0].break_history : [];
        history.push({
            start: breakStart.toISOString(),
            end: now.toISOString(),
            duration_seconds: durationSec
        });

        const result = await pool.query(`
            UPDATE attendance 
            SET is_on_break = false,
                break_start = NULL,
                total_break_seconds = $2,
                break_history = $3::jsonb,
                break_time = $4,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *;
        `, [checkRes.rows[0].id, newTotalSec, JSON.stringify(history), Math.round((newTotalSec / 60) * 100) / 100]);

        res.status(200).json({ success: true, message: "Break ended. Welcome back to work!", data: result.rows[0] });
    } catch (error) {
        console.log("Error in endBreak:", error.message);
        res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
}

export async function clockOut(req, res) {
    try {
        const employeeId = await getEmployeeId(req.user.id);
        const { lat, lng } = req.body;

        const checkRes = await pool.query(
            "SELECT * FROM attendance WHERE employee_id = $1 AND date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date AND (login_time IS NOT NULL OR portal_check_in IS NOT NULL) AND logout_time IS NULL;",
            [employeeId]
        );

        if (checkRes.rows.length === 0) {
            return res.status(400).json({ success: false, message: "No active check-in found for today" });
        }

        // Enforce self report check before clock out
        const reportCheck = await pool.query(
            "SELECT id FROM self_reports WHERE employee_id = $1 AND date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date;",
            [employeeId]
        );
        if (reportCheck.rows.length === 0) {
            return res.status(400).json({
                success: false,
                code: "SELF_REPORT_REQUIRED",
                message: "Please submit your End-of-Day Self Report before clocking out."
            });
        }

        const loginTime = new Date(checkRes.rows[0].login_time || checkRes.rows[0].portal_check_in);
        const logoutTime = new Date();

        // Finalize break if clocking out during break
        let totalBreakSec = checkRes.rows[0].total_break_seconds || 0;
        if (checkRes.rows[0].is_on_break && checkRes.rows[0].break_start) {
            const extraBreak = Math.max(0, Math.floor((logoutTime - new Date(checkRes.rows[0].break_start)) / 1000));
            totalBreakSec += extraBreak;
        }

        const diffMs = Math.max(0, logoutTime - loginTime - (totalBreakSec * 1000));
        const totalWorkingHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;

        const result = await pool.query(`
            UPDATE attendance 
            SET logout_time = CURRENT_TIMESTAMP, 
                portal_check_out = CURRENT_TIMESTAMP,
                is_on_break = false,
                break_start = NULL,
                total_break_seconds = $4,
                logout_lat = $2, 
                logout_lng = $3, 
                total_working_hours = $5,
                punch_source = COALESCE(punch_source, 'PORTAL'),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *;
        `, [checkRes.rows[0].id, lat || null, lng || null, totalBreakSec, totalWorkingHours]);

        await pool.query(`
            UPDATE attendance_logs 
            SET clock_out = CURRENT_TIMESTAMP 
            WHERE employee_id = $1 AND work_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date AND clock_out IS NULL;
        `, [employeeId]);

        res.status(200).json({ success: true, message: "Clocked out successfully", data: result.rows[0] });
    } catch (error) {
        console.log("Error in clockOut:", error.message);
        res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
}

export async function requestCorrection(req, res) {
    try {
        const employeeId = await getEmployeeId(req.user.id);
        const { workDate, clockIn, clockOut } = req.body;

        if (!workDate || !clockIn || !clockOut) {
            return res.status(400).json({ success: false, message: "Missing correction parameters" });
        }

        const result = await pool.query(`
            INSERT INTO attendance_logs (employee_id, work_date, clock_in, clock_out, correction_status)
            VALUES ($1, $2, $3, $4, 'Pending')
            RETURNING *;
        `, [employeeId, workDate, clockIn, clockOut]);

        res.status(201).json({ success: true, message: "Correction request submitted", data: result.rows[0] });
    } catch (error) {
        console.log("Error in requestCorrection:", error.message);
        res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
}

export async function getAttendanceLogs(req, res) {
    try {
        const employeeId = await getEmployeeId(req.user.id);
        const { month, year, startDate, endDate } = req.query;

        const todayIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

        let startDateStr, endDateStr;
        if (startDate && endDate) {
            startDateStr = startDate;
            endDateStr = endDate;
        } else if (month && month !== 'all') {
            const cleanMonth = String(month).replace(/[^0-9]/g, '');
            let y = year ? parseInt(String(year).replace(/[^0-9]/g, ''), 10) : new Date().getFullYear();
            let m = 1;
            if (cleanMonth.length === 6) {
                y = parseInt(cleanMonth.slice(0, 4), 10);
                m = parseInt(cleanMonth.slice(4, 6), 10);
            } else if (cleanMonth.length <= 2) {
                m = parseInt(cleanMonth, 10);
            } else {
                const now = new Date();
                y = now.getFullYear();
                m = now.getMonth() + 1;
            }
            if (isNaN(y) || y < 2000 || y > 2100) y = new Date().getFullYear();
            if (isNaN(m) || m < 1 || m > 12) m = new Date().getMonth() + 1;

            startDateStr = `${y}-${String(m).padStart(2, '0')}-01`;
            const daysInM = new Date(y, m, 0).getDate();
            endDateStr = `${y}-${String(m).padStart(2, '0')}-${String(daysInM).padStart(2, '0')}`;
        } else if (year) {
            const cleanYear = parseInt(String(year).replace(/[^0-9]/g, ''), 10) || new Date().getFullYear();
            startDateStr = `${cleanYear}-01-01`;
            endDateStr = `${cleanYear}-12-31`;
        } else {
            const now = new Date();
            const y = now.getFullYear();
            const m = now.getMonth() + 1;
            startDateStr = `${y}-${String(m).padStart(2, '0')}-01`;
            const daysInM = new Date(y, m, 0).getDate();
            endDateStr = `${y}-${String(m).padStart(2, '0')}-${String(daysInM).padStart(2, '0')}`;
        }

        // 1. Fetch employee & workstation mapping
        const empRes = await pool.query(`
            SELECT e.id, e.full_name, e.employee_code, e.department_id,
                   m.computer_id, m.computer_name
            FROM employees e
            LEFT JOIN employee_teramind_mapping m ON e.id = m.employee_id
            WHERE e.id = $1;
        `, [employeeId]);

        if (empRes.rows.length === 0) {
            return res.status(200).json({ success: true, data: [] });
        }
        const emp = empRes.rows[0];

        // 2. Fetch manual corrections/records from attendance table
        const dbAttRes = await pool.query(
            "SELECT * FROM attendance WHERE employee_id = $1 AND date >= $2 AND date <= $3",
            [employeeId, startDateStr, endDateStr]
        );
        const dbAttMap = new Map();
        dbAttRes.rows.forEach(r => {
            const dStr = r.date instanceof Date
                ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(r.date)
                : String(r.date).slice(0, 10);
            dbAttMap.set(dStr, r);
        });

        // 3. Fetch approved leaves
        const leaveMap = new Map();
        try {
            const leaveRes = await pool.query(`
                SELECT lr.employee_id, lr.leave_type, lr.reason, lr.start_date, lr.end_date
                FROM leave_requests lr
                WHERE lr.employee_id = $1 AND lr.status = 'Approved'
                  AND NOT (lr.end_date < $2::date OR lr.start_date > $3::date);
            `, [employeeId, startDateStr, endDateStr]);

            leaveRes.rows.forEach(l => {
                const s = new Date(l.start_date);
                const e = new Date(l.end_date);
                for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
                    const dStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
                    if (dStr >= startDateStr && dStr <= endDateStr) {
                        leaveMap.set(dStr, l);
                    }
                }
            });
        } catch (lErr) {
            console.warn("Leave query warning:", lErr.message);
        }

        // 4. Fetch holidays
        const holidayMap = new Map();
        try {
            const holidayRes = await pool.query(`
                SELECT date, name FROM holidays WHERE date >= $1 AND date <= $2;
            `, [startDateStr, endDateStr]);
            holidayRes.rows.forEach(h => {
                const dStr = h.date instanceof Date
                    ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(h.date)
                    : String(h.date).slice(0, 10);
                holidayMap.set(dStr, h.name);
            });
        } catch (hErr) {
            console.warn("Holiday query warning:", hErr.message);
        }

        // 5. Fetch Workstation Activity Telemetry (Historical Jan-Jul vs Live Teramind Aug+)
        const compActivityMap = new Map();

        if (startDateStr < '2026-08-01' && emp.computer_name) {
            try {
                const cName = emp.computer_name.toLowerCase();
                const sheetRes = await pool.query(`
                    SELECT rep_datetime::date as punch_date, rep_datetime::text as rep_dt_txt, duration
                    FROM pcs_attendance_sheet
                    WHERE LOWER(computer) = $1
                      AND rep_datetime >= $2::timestamp AND rep_datetime < ($3::timestamp + INTERVAL '1 day')
                    ORDER BY rep_datetime ASC;
                `, [cName, startDateStr, endDateStr]);

                sheetRes.rows.forEach(r => {
                    const dStr = String(r.punch_date).split('T')[0];
                    const txt = (r.rep_dt_txt || '').split('.')[0];
                    const ts = txt ? Math.floor(new Date(txt.replace(' ', 'T') + '+05:30').getTime() / 1000) : 0;
                    let durSecs = 0;
                    if (r.duration) {
                        const parts = String(r.duration).split(':');
                        if (parts.length >= 3) {
                            durSecs = (parseInt(parts[0], 10) * 3600) + (parseInt(parts[1], 10) * 60) + parseInt(parts[2], 10);
                        }
                    }
                    if (ts > 0) {
                        if (!compActivityMap.has(dStr)) compActivityMap.set(dStr, []);
                        compActivityMap.get(dStr).push({ ts, dur: durSecs });
                    }
                });
            } catch (sErr) {
                console.warn("Historical sheet warning:", sErr.message);
            }
        }

        if (endDateStr >= '2026-08-01' && emp.computer_id) {
            const tmStart = Math.max(Math.floor(new Date(`${startDateStr}T00:00:00+05:30`).getTime() / 1000), Math.floor(new Date('2026-08-01T00:00:00+05:30').getTime() / 1000));
            const tmEnd = Math.floor(new Date(`${endDateStr}T23:59:59+05:30`).getTime() / 1000);

            try {
                const gridPromise = getWebPagesApplicationsGrid({
                    computers: [parseInt(emp.computer_id, 10)],
                    periodStart: String(tmStart),
                    periodEnd: String(tmEnd),
                    pageSize: 10000
                });
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Teramind grid fetch timeout')), 2500));
                const gridRes = await Promise.race([gridPromise, timeoutPromise]);
                const gridRows = gridRes?.rows || [];

                gridRows.forEach(r => {
                    const ts = r.time || (r.timestamp?.timestamp ? r.timestamp.timestamp : null);
                    const dur = r.duration || 0;
                    if (!ts) return;

                    const dObj = new Date(ts * 1000);
                    const dStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(dObj);
                    if (!compActivityMap.has(dStr)) compActivityMap.set(dStr, []);
                    compActivityMap.get(dStr).push({ ts, dur });
                });
            } catch (tErr) {
                console.warn("Teramind grid fetch warning (fallback to DB):", tErr.message);
            }
        }

        // 6. Generate date list ascending: startDateStr -> endDateStr
        const dateList = [];
        const curD = new Date(`${startDateStr}T00:00:00`);
        const endD = new Date(`${endDateStr}T00:00:00`);
        while (curD <= endD) {
            const parts = [
                curD.getFullYear(),
                String(curD.getMonth() + 1).padStart(2, '0'),
                String(curD.getDate()).padStart(2, '0')
            ];
            dateList.push(parts.join('-'));
            curD.setDate(curD.getDate() + 1);
        }

        const now = new Date();
        const nowParts = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false
        }).formatToParts(now);
        const nowP = {};
        nowParts.forEach(({ type, value }) => { nowP[type] = value; });
        const currentHourIST = parseInt(nowP.hour, 10);

        const logs = [];

        for (const targetDateStr of dateList) {
            const isToday = (targetDateStr === todayIST);
            const isFuture = (targetDateStr > todayIST);

            const targetDateObj = new Date(`${targetDateStr}T12:00:00+05:30`);
            const dayOfWeek = targetDateObj.getDay(); // 0 is Sunday, 6 is Sat
            const isSunday = (dayOfWeek === 0);
            const isSaturday = (dayOfWeek === 6);

            const dbRecord = dbAttMap.get(targetDateStr);
            const onLeave = leaveMap.get(targetDateStr);
            const holidayName = holidayMap.get(targetDateStr);
            const empRows = compActivityMap.get(targetDateStr) || [];

            let finalRecord = null;

            // Tier 1: Admin / HR Manual Approved Override
            if (dbRecord && (dbRecord.approval_status === 'Approved' || dbRecord.manual_check_in || dbRecord.punch_source === 'MANUAL_HR')) {
                const inTime = dbRecord.manual_check_in || dbRecord.login_time;
                const outTime = dbRecord.manual_check_out || dbRecord.logout_time;
                const status = dbRecord.status || 'Present';
                finalRecord = {
                    id: dbRecord.id,
                    employee_id: employeeId,
                    date: targetDateStr,
                    login_time: inTime,
                    logout_time: outTime,
                    total_working_hours: dbRecord.total_working_hours ? parseFloat(dbRecord.total_working_hours).toFixed(2) : '0.00',
                    overtime: dbRecord.overtime || null,
                    status: status,
                    calculated_status: status,
                    is_late_login: !!dbRecord.is_late_login,
                    punch_source: 'MANUAL_HR'
                };
            }
            // Tier 2: Employee Portal Web Punch with actual login_time
            else if (dbRecord && (dbRecord.portal_check_in || (dbRecord.login_time && dbRecord.punch_source === 'PORTAL'))) {
                const inTime = dbRecord.portal_check_in || dbRecord.login_time;
                const outTime = dbRecord.portal_check_out || dbRecord.logout_time;
                const isLate = !!dbRecord.is_late_login;
                const status = dbRecord.status || (isLate ? 'Late' : 'Present');
                finalRecord = {
                    id: dbRecord.id,
                    employee_id: employeeId,
                    date: targetDateStr,
                    login_time: inTime,
                    logout_time: outTime,
                    total_working_hours: dbRecord.total_working_hours ? parseFloat(dbRecord.total_working_hours).toFixed(2) : '0.00',
                    overtime: dbRecord.overtime || null,
                    status: status,
                    calculated_status: status,
                    is_late_login: isLate,
                    punch_source: 'PORTAL'
                };
            }
            // Tier 3: Approved Leave
            else if (onLeave) {
                const leaveTypeName = onLeave.leave_type || 'Leave';
                const isHalfDay = leaveTypeName.toLowerCase().includes('half');
                const status = isHalfDay ? 'Half Day' : 'On Leave';
                finalRecord = {
                    id: null,
                    employee_id: employeeId,
                    date: targetDateStr,
                    login_time: null,
                    logout_time: null,
                    total_working_hours: '0.00',
                    overtime: null,
                    status: status,
                    calculated_status: status,
                    is_late_login: false,
                    punch_source: 'LEAVE_MANAGEMENT'
                };
            }
            // Tier 4: Workstation Telemetry Activity (Teramind / Sheet)
            else if (empRows.length > 0) {
                let minTs = Infinity;
                let maxTs = 0;
                let totalActiveSecs = 0;

                empRows.forEach(r => {
                    if (r.ts && r.ts > 0) {
                        if (r.ts < minTs) minTs = r.ts;
                        const end = r.ts + (r.dur || 0);
                        if (end > maxTs) maxTs = end;
                    }
                    totalActiveSecs += (r.dur || 0);
                });

                const checkInDate = minTs !== Infinity ? new Date(minTs * 1000) : null;
                const checkOutDate = maxTs > 0 ? new Date(maxTs * 1000) : null;

                const formatISTIso = (d) => {
                    if (!d) return null;
                    const parts = new Intl.DateTimeFormat('en-GB', {
                        timeZone: 'Asia/Kolkata',
                        year: 'numeric', month: '2-digit', day: '2-digit',
                        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
                    }).formatToParts(d);
                    const p = {};
                    parts.forEach(({ type, value }) => { p[type] = value; });
                    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}+05:30`;
                };

                const loginTimeStr = formatISTIso(checkInDate);
                let logoutTimeStr = formatISTIso(checkOutDate);

                if (isToday && currentHourIST < 19) {
                    logoutTimeStr = null;
                }

                const totalHoursNum = (totalActiveSecs / 3600).toFixed(2);

                let isLate = false;
                if (checkInDate) {
                    const checkInParts = new Intl.DateTimeFormat('en-GB', {
                        timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false
                    }).formatToParts(checkInDate);
                    const p = {};
                    checkInParts.forEach(({ type, value }) => { p[type] = value; });
                    const hh = parseInt(p.hour, 10);
                    const mm = parseInt(p.minute, 10);
                    if (hh > 10 || (hh === 10 && mm > 15)) {
                        isLate = true;
                    }
                }

                const calculatedStatus = isLate ? 'Late' : 'Present';

                finalRecord = {
                    id: dbRecord?.id || null,
                    employee_id: employeeId,
                    date: targetDateStr,
                    login_time: loginTimeStr,
                    logout_time: logoutTimeStr,
                    total_working_hours: totalHoursNum,
                    overtime: null,
                    status: calculatedStatus,
                    calculated_status: calculatedStatus,
                    is_late_login: isLate,
                    punch_source: 'TERAMIND'
                };
            }
            // Tier 5: Holiday
            else if (holidayName || (dbRecord && dbRecord.status === 'Holiday')) {
                finalRecord = {
                    id: dbRecord?.id || null,
                    employee_id: employeeId,
                    date: targetDateStr,
                    login_time: null,
                    logout_time: null,
                    total_working_hours: '0.00',
                    overtime: null,
                    status: 'Holiday',
                    calculated_status: 'Holiday',
                    is_late_login: false,
                    punch_source: 'HOLIDAY'
                };
            }
            // Tier 6: Sunday / WeekOff
            else if (isSunday || (dbRecord && dbRecord.status === 'WeekOff')) {
                finalRecord = {
                    id: dbRecord?.id || null,
                    employee_id: employeeId,
                    date: targetDateStr,
                    login_time: null,
                    logout_time: null,
                    total_working_hours: '0.00',
                    overtime: null,
                    status: 'WeekOff',
                    calculated_status: 'WeekOff',
                    is_late_login: false,
                    punch_source: 'WEEKOFF'
                };
            }
            // Tier 7: Future date
            else if (isFuture) {
                finalRecord = {
                    id: dbRecord?.id || null,
                    employee_id: employeeId,
                    date: targetDateStr,
                    login_time: null,
                    logout_time: null,
                    total_working_hours: '0.00',
                    overtime: null,
                    status: 'Upcoming',
                    calculated_status: 'Upcoming',
                    is_late_login: false,
                    punch_source: 'UPCOMING'
                };
            }
            // Tier 8: Absent
            else {
                finalRecord = {
                    id: dbRecord?.id || null,
                    employee_id: employeeId,
                    date: targetDateStr,
                    login_time: null,
                    logout_time: null,
                    total_working_hours: '0.00',
                    overtime: null,
                    status: 'Absent',
                    calculated_status: 'Absent',
                    is_late_login: false,
                    punch_source: 'AUTO'
                };
            }

            // --- Robust Calculation of Total Login Time (loginHr) & Overtime (OvTHrs) ---
            const workingHoursNum = parseFloat(finalRecord.total_working_hours) || 0;
            let loginHoursNum = 0;
            let overtimeHoursNum = 0;

            if (dbRecord && dbRecord.login_seconds && dbRecord.login_seconds > 0) {
                loginHoursNum = dbRecord.login_seconds / 3600;
            } else if (finalRecord.login_time && finalRecord.logout_time) {
                const inD = new Date(finalRecord.login_time);
                const outD = new Date(finalRecord.logout_time);
                if (!isNaN(inD.getTime()) && !isNaN(outD.getTime()) && outD > inD) {
                    loginHoursNum = (outD.getTime() - inD.getTime()) / (1000 * 3600);
                }
            } else if (finalRecord.login_time && isToday) {
                const inD = new Date(finalRecord.login_time);
                if (!isNaN(inD.getTime())) {
                    loginHoursNum = Math.max(0, (Date.now() - inD.getTime()) / (1000 * 3600));
                }
            }
            if (loginHoursNum < workingHoursNum) {
                loginHoursNum = workingHoursNum;
            }

            if (dbRecord && dbRecord.overtime_seconds && dbRecord.overtime_seconds > 0) {
                overtimeHoursNum = dbRecord.overtime_seconds / 3600;
            } else if (dbRecord && dbRecord.overtime && typeof dbRecord.overtime === 'number' && dbRecord.overtime > 0) {
                overtimeHoursNum = dbRecord.overtime / 60;
            } else if ((isSunday || !!holidayName || finalRecord.status === 'Holiday') && workingHoursNum > 0) {
                overtimeHoursNum = workingHoursNum;
            } else if (finalRecord.logout_time) {
                const outD = new Date(finalRecord.logout_time);
                if (!isNaN(outD.getTime())) {
                    const outParts = new Intl.DateTimeFormat('en-GB', {
                        timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false
                    }).formatToParts(outD);
                    const p = {};
                    outParts.forEach(({ type, value }) => { p[type] = value; });
                    const outH = parseInt(p.hour, 10);
                    const outM = parseInt(p.minute, 10);
                    const cutoffTotalMins = isSaturday ? (16 * 60 + 30) : (19 * 60);
                    const currentTotalMins = outH * 60 + outM;
                    if (currentTotalMins > cutoffTotalMins) {
                        overtimeHoursNum = (currentTotalMins - cutoffTotalMins) / 60;
                    }
                }
            }

            finalRecord.login_hours = loginHoursNum > 0 ? loginHoursNum.toFixed(2) : '0.00';
            finalRecord.overtime_hours = overtimeHoursNum > 0 ? overtimeHoursNum.toFixed(2) : '0.00';

            logs.push(finalRecord);
        }

        res.status(200).json({ success: true, data: logs });
    } catch (error) {
        console.log("Error in getAttendanceLogs:", error.message);
        res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
}

export async function getReports(req, res) {
    try {
        const employeeId = await getEmployeeId(req.user.id);
        const { month, year, startDate, endDate } = req.query;

        let selfConditions = ["employee_id = $1"];
        let selfParams = [employeeId];
        let dsrConditions = ["employee_id = $1"];
        let dsrParams = [employeeId];
        let sIdx = 2;
        let dIdx = 2;

        if (startDate && endDate) {
            selfConditions.push(`date >= $${sIdx++} AND date <= $${sIdx++}`);
            selfParams.push(startDate, endDate);
            dsrConditions.push(`created_at::date >= $${dIdx++} AND created_at::date <= $${dIdx++}`);
            dsrParams.push(startDate, endDate);
        } else if (month && month !== 'all') {
            const cleanMonth = month.replace(/-/g, '').slice(0, 6);
            const y = parseInt(cleanMonth.slice(0, 4), 10);
            const m = parseInt(cleanMonth.slice(4, 6), 10);
            const startM = `${y}-${String(m).padStart(2, '0')}-01`;
            const daysInM = new Date(y, m, 0).getDate();
            const endM = `${y}-${String(m).padStart(2, '0')}-${String(daysInM).padStart(2, '0')}`;
            selfConditions.push(`date >= $${sIdx++} AND date <= $${sIdx++}`);
            selfParams.push(startM, endM);
            dsrConditions.push(`created_at::date >= $${dIdx++} AND created_at::date <= $${dIdx++}`);
            dsrParams.push(startM, endM);
        } else if (year) {
            const startY = `${year}-01-01`;
            const endY = `${year}-12-31`;
            selfConditions.push(`date >= $${sIdx++} AND date <= $${sIdx++}`);
            selfParams.push(startY, endY);
            dsrConditions.push(`created_at::date >= $${dIdx++} AND created_at::date <= $${dIdx++}`);
            dsrParams.push(startY, endY);
        }

        const selfReports = await pool.query(`
            SELECT id, employee_id, TO_CHAR(date, 'YYYY-MM-DD') as date, 
                   todays_work, tomorrows_plan, current_issues, 
                   work_capacity, percentage_complete, 
                   TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at
            FROM self_reports 
            WHERE ${selfConditions.join(' AND ')} 
            ORDER BY date DESC, id DESC;
        `, selfParams);

        const dsrReports = await pool.query(`
            SELECT id, employee_id, customer_name, office_address, 
                   site_name, contact_person, contact_no, last_remark, 
                   visited_for, followup, latitude, longitude, client_name,
                   TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at,
                   TO_CHAR(created_at, 'YYYY-MM-DD') as date
            FROM dsr_reports 
            WHERE ${dsrConditions.join(' AND ')} 
            ORDER BY created_at DESC, id DESC;
        `, dsrParams);

        res.status(200).json({
            success: true,
            data: {
                selfReports: selfReports.rows,
                dsrReports: dsrReports.rows
            }
        });
    } catch (error) {
        console.log("Error in getReports:", error.message);
        res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
}

export async function submitSelfReport(req, res) {
    try {
        const employeeId = await getEmployeeId(req.user.id);
        const { todaysWork, tomorrowsPlan, currentIssues, workCapacity, percentageComplete } = req.body;

        const result = await pool.query(`
            INSERT INTO self_reports (employee_id, date, todays_work, tomorrows_plan, current_issues, work_capacity, percentage_complete)
            VALUES ($1, (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date, $2, $3, $4, $5, $6)
            RETURNING *;
        `, [employeeId, todaysWork || "", tomorrowsPlan || "", currentIssues || "", parseInt(workCapacity, 10) || 100, parseInt(percentageComplete, 10) || 0]);

        res.status(201).json({ success: true, message: "Self-report DSR submitted successfully", data: result.rows[0] });
    } catch (error) {
        console.log("Error in submitSelfReport:", error.message);
        res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
}

export async function submitDsrReport(req, res) {
    try {
        const employeeId = await getEmployeeId(req.user.id);
        const { customerName, officeAddress, siteName, contactPerson, contactNo, visitedFor, followup } = req.body;

        const result = await pool.query(`
            INSERT INTO dsr_reports (employee_id, customer_name, office_address, site_name, contact_person, contact_no, visited_for, followup)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *;
        `, [employeeId, customerName, officeAddress || "", siteName || "", contactPerson || "", contactNo || "", visitedFor || "", followup || ""]);

        res.status(201).json({ success: true, message: "Field visit report logged successfully", data: result.rows[0] });
    } catch (error) {
        console.log("Error in submitDsrReport:", error.message);
        res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
}

export async function getLeaveBalances(req, res) {
    try {
        const employeeId = await getEmployeeId(req.user.id);
        const balances = await pool.query(`
            SELECT lb.id, lb.employee_id, lb.leave_type_id,
                   lb.balance as total_days,
                   lb.used as used_days,
                   (lb.balance - lb.used) as remaining_days,
                   lt.name as leave_type_name
            FROM leave_balances lb
            LEFT JOIN leave_types lt ON lb.leave_type_id = lt.id
            WHERE lb.employee_id = $1
            ORDER BY lt.name;
        `, [employeeId]);
        res.status(200).json({ success: true, data: balances.rows });
    } catch (error) {
        console.log("Error in getLeaveBalances:", error.message);
        res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
}

export async function applyLeave(req, res) {
    try {
        const employeeId = await getEmployeeId(req.user.id);
        const { leaveTypeId, startDate, endDate, reason } = req.body;

        if (!leaveTypeId || !startDate || !endDate) {
            return res.status(400).json({ success: false, message: "Missing leave registration parameters" });
        }

        const result = await pool.query(`
            INSERT INTO leaves (employee_id, leave_type_id, start_date, end_date, reason, status)
            VALUES ($1, $2, $3, $4, $5, 'Pending')
            RETURNING *;
        `, [employeeId, leaveTypeId, startDate, endDate, reason || ""]);

        res.status(201).json({ success: true, message: "Leave application submitted successfully", data: result.rows[0] });
    } catch (error) {
        console.log("Error in applyLeave:", error.message);
        res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
}

export async function getLeaveHistory(req, res) {
    try {
        const employeeId = await getEmployeeId(req.user.id);
        const history = await pool.query(`
            SELECT l.*, lt.name as leave_type_name 
            FROM leaves l
            LEFT JOIN leave_types lt ON l.leave_type_id = lt.id
            WHERE l.employee_id = $1
            ORDER BY l.start_date DESC;
        `, [employeeId]);
        res.status(200).json({ success: true, data: history.rows });
    } catch (error) {
        console.log("Error in getLeaveHistory:", error.message);
        res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
}

export async function getTasks(req, res) {
    try {
        const employeeId = await getEmployeeId(req.user.id);
        const result = await pool.query(
            "SELECT * FROM tasks WHERE $1 = ANY(assigned_to) ORDER BY due_date ASC;",
            [employeeId]
        );
        res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        console.log("Error in getTasks:", error.message);
        res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
}

export async function updateTaskProgress(req, res) {
    try {
        const employeeId = await getEmployeeId(req.user.id);
        const { id } = req.params;
        const { progress, status, work_done } = req.body;

        const result = await pool.query(`
            UPDATE tasks 
            SET completion_percentage = $1, status = $2, work_done = $3 
            WHERE id = $4 AND $5 = ANY(assigned_to)
            RETURNING *;
        `, [parseInt(progress, 10) || 0, status || "In Progress", work_done || null, id, employeeId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Task not found or unauthorized" });
        }

        res.status(200).json({ success: true, message: "Task progress saved", data: result.rows[0] });
    } catch (error) {
        console.log("Error in updateTaskProgress:", error.message);
        res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
}

export async function getTimesheets(req, res) {
    try {
        const employeeId = await getEmployeeId(req.user.id);
        const result = await pool.query(
            "SELECT * FROM timesheets WHERE employee_id = $1 ORDER BY year DESC, month DESC, week_number DESC;",
            [employeeId]
        );
        res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        console.log("Error in getTimesheets:", error.message);
        res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
}

export async function submitTimesheet(req, res) {
    try {
        const employeeId = await getEmployeeId(req.user.id);
        const { weekNumber, month, year, totalHours, billableHours, nonBillableHours, entries, remarks } = req.body;

        if (!weekNumber || !month || !year) {
            return res.status(400).json({ success: false, message: "Missing timesheet parameters" });
        }

        const result = await pool.query(`
            INSERT INTO timesheets (employee_id, week_number, month, year, total_hours, billable_hours, non_billable_hours, entries, remarks, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Pending')
            RETURNING *;
        `, [employeeId, weekNumber, month, year, parseFloat(totalHours) || 0, parseFloat(billableHours) || 0, parseFloat(nonBillableHours) || 0, JSON.stringify(entries || []), remarks || ""]);

        res.status(201).json({ success: true, message: "Timesheet submitted successfully for approval", data: result.rows[0] });
    } catch (error) {
        console.log("Error in submitTimesheet:", error.message);
        res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
}

export async function getGoals(req, res) {
    try {
        const employeeId = await getEmployeeId(req.user.id);
        const result = await pool.query(
            "SELECT * FROM goals WHERE employee_id = $1 ORDER BY created_at DESC;",
            [employeeId]
        );
        // Normalize field names for frontend
        const goals = result.rows.map(g => ({
            ...g,
            progress: parseFloat(g.percentage_achieved) || 0,
            end_date: g.timeline || null,
            category: g.type || 'Performance'
        }));
        res.status(200).json({ success: true, data: goals });
    } catch (error) {
        console.log("Error in getGoals:", error.message);
        res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
}

export async function submitGoalSelfAssessment(req, res) {
    try {
        const employeeId = await getEmployeeId(req.user.id);
        const { id } = req.params;
        const { selfAssessment, progress } = req.body;

        const result = await pool.query(`
            UPDATE goals 
            SET self_assessment = $1, percentage_achieved = $2 
            WHERE id = $3 AND employee_id = $4
            RETURNING *;
        `, [selfAssessment, parseFloat(progress) || 0, id, employeeId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Goal record not found" });
        }

        res.status(200).json({ success: true, message: "Goal self-assessment logged successfully", data: result.rows[0] });
    } catch (error) {
        console.log("Error in submitGoalSelfAssessment:", error.message);
        res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
}

export async function getTrainings(req, res) {
    try {
        const employeeId = await getEmployeeId(req.user.id);
        // assigned_to is an array column
        const result = await pool.query(
            "SELECT * FROM trainings WHERE $1 = ANY(assigned_to) ORDER BY created_at DESC;",
            [employeeId]
        );
        res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        console.log("Error in getTrainings:", error.message);
        res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
}

export async function completeTraining(req, res) {
    try {
        const employeeId = await getEmployeeId(req.user.id);
        const { id } = req.params;

        const result = await pool.query(`
            UPDATE trainings 
            SET status = 'Completed', completed_at = NOW() 
            WHERE id = $1 AND $2 = ANY(assigned_to)
            RETURNING *;
        `, [id, employeeId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Training course assignment not found" });
        }

        res.status(200).json({ success: true, message: "Training course completed!", data: result.rows[0] });
    } catch (error) {
        console.log("Error in completeTraining:", error.message);
        res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
}

export async function updateProfile(req, res) {
    try {
        const employeeId = await getEmployeeId(req.user.id);
        const {
            linkedin,
            phone,
            dob,
            citizenship,
            address,
            emergency_name,
            emergency_relationship,
            emergency_phone,
            degree,
            skills,
            edu_10th_school,
            edu_10th_marks,
            edu_12th_college,
            edu_12th_marks,
            edu_grad_college,
            edu_grad_cgpa,
            certifications,
            perm_address,
            bank_name,
            bank_acc_no,
            bank_ifsc,
            doc_cv,
            doc_offer_letter,
            doc_adhar_card,
            doc_pan_card,
            whatsapp_no,
            anydesk_id,
            profile_picture
        } = req.body;

        // Convert comma-separated string to array
        const skillsArray = typeof skills === 'string' 
            ? skills.split(',').map(s => s.trim()).filter(Boolean)
            : Array.isArray(skills) ? skills : [];

        if (profile_picture) {
            await pool.query("UPDATE users SET profile_picture = $1 WHERE id = $2", [profile_picture, req.user.id]).catch(() => {});
        }

        const result = await pool.query(
            `UPDATE employees 
             SET linkedin = $1, 
                 phone = $2, 
                 dob = $3, 
                 citizenship = $4, 
                 address = $5, 
                 emergency_name = $6, 
                 emergency_relationship = $7, 
                 emergency_phone = $8, 
                 degree = $9, 
                 skills = $10,
                 edu_10th_school = $11,
                 edu_10th_marks = $12,
                 edu_12th_college = $13,
                 edu_12th_marks = $14,
                 edu_grad_college = $15,
                 edu_grad_cgpa = $16,
                 certifications = $17,
                 perm_address = $18,
                 bank_name = $19,
                 bank_acc_no = $20,
                 bank_ifsc = $21,
                 doc_cv = $22,
                 doc_offer_letter = $23,
                 doc_adhar_card = $24,
                 doc_pan_card = $25,
                 whatsapp_no = $26,
                 anydesk_id = $27,
                 profile_picture = COALESCE($28, profile_picture),
                 updated_at = NOW() 
             WHERE id = $29 
             RETURNING *;`,
            [
                linkedin || null,
                phone || null,
                dob ? dob : null,
                citizenship || null,
                address || null,
                emergency_name || null,
                emergency_relationship || null,
                emergency_phone || null,
                degree || null,
                skillsArray,
                edu_10th_school || null,
                edu_10th_marks ? parseFloat(edu_10th_marks) : null,
                edu_12th_college || null,
                edu_12th_marks ? parseFloat(edu_12th_marks) : null,
                edu_grad_college || null,
                edu_grad_cgpa ? parseFloat(edu_grad_cgpa) : null,
                JSON.stringify(certifications || []),
                perm_address || null,
                bank_name || null,
                bank_acc_no || null,
                bank_ifsc || null,
                doc_cv ? (typeof doc_cv === 'object' ? JSON.stringify(doc_cv) : doc_cv) : '{}',
                doc_offer_letter ? (typeof doc_offer_letter === 'object' ? JSON.stringify(doc_offer_letter) : doc_offer_letter) : '{}',
                doc_adhar_card ? (typeof doc_adhar_card === 'object' ? JSON.stringify(doc_adhar_card) : doc_adhar_card) : '{}',
                doc_pan_card ? (typeof doc_pan_card === 'object' ? JSON.stringify(doc_pan_card) : doc_pan_card) : '{}',
                whatsapp_no || null,
                anydesk_id || null,
                profile_picture || null,
                employeeId
            ]
        );

        res.status(200).json({ success: true, message: "Profile updated successfully", data: result.rows[0] });
    } catch (error) {
        console.log("Error in updateProfile:", error.message);
        res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
}

export async function changePassword(req, res) {
    try {
        const userId = req.user.id;
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: "Missing current or new password" });
        }

        const userRes = await pool.query("SELECT password FROM users WHERE id = $1;", [userId]);
        const user = userRes.rows[0];

        const isMatch = await bcryptjs.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: "Incorrect current password" });
        }

        const salt = await bcryptjs.genSalt(10);
        const hashedPassword = await bcryptjs.hash(newPassword, salt);

        await pool.query("UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2;", [hashedPassword, userId]);

        res.status(200).json({ success: true, message: "Password updated successfully" });
    } catch (error) {
        console.log("Error in changePassword:", error.message);
        res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
}

export async function getInbox(req, res) {
    try {
        const employeeId = await getEmployeeId(req.user.id);
        const result = await pool.query(`
            SELECT * FROM notifications 
            WHERE recipient_id = $1 OR recipient_id IS NULL 
            ORDER BY created_at DESC;
        `, [employeeId]);

        res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        console.log("Error in getInbox:", error.message);
        res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
}

export async function markAllRead(req, res) {
    try {
        const employeeId = await getEmployeeId(req.user.id);
        await pool.query(
            "UPDATE notifications SET is_read = true WHERE recipient_id = $1 OR recipient_id IS NULL;",
            [employeeId]
        );

        res.status(200).json({ success: true, message: "All notifications marked as read" });
    } catch (error) {
        console.log("Error in markAllRead:", error.message);
        res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
}

export async function markOneRead(req, res) {
    try {
        const employeeId = await getEmployeeId(req.user.id);
        const { id } = req.params;
        await pool.query(
            "UPDATE notifications SET is_read = true WHERE id = $1 AND (recipient_id = $2 OR recipient_id IS NULL);",
            [id, employeeId]
        );

        res.status(200).json({ success: true, message: "Notification marked as read" });
    } catch (error) {
        console.log("Error in markOneRead:", error.message);
        res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
}

export async function getChatContacts(req, res) {
    try {
        const employeeId = await getEmployeeId(req.user.id);
        const result = await pool.query(`
            SELECT e.id, e.full_name, e.employee_code, e.status, e.whatsapp_no, e.anydesk_id,
                   u.email,
                   d.name AS department_name,
                   ds.title AS designation_name
            FROM employees e
            LEFT JOIN users u ON e.user_id = u.id
            LEFT JOIN departments d ON e.department_id = d.id
            LEFT JOIN designations ds ON e.designation_id = ds.id
            WHERE u.is_active = true AND e.id != $1
            ORDER BY e.full_name ASC;
        `, [employeeId]);

        res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        console.log("Error in getChatContacts:", error.message);
        res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
}

export async function getChatMessages(req, res) {
    try {
        const employeeId = await getEmployeeId(req.user.id);
        const { contact_id } = req.query;

        if (!contact_id) {
            return res.status(400).json({ success: false, message: "Missing contact_id query parameter" });
        }

        const result = await pool.query(`
            SELECT * FROM direct_messages 
            WHERE (sender_id = $1 AND recipient_id = $2) 
               OR (sender_id = $2 AND recipient_id = $1)
            ORDER BY created_at ASC;
        `, [employeeId, parseInt(contact_id, 10)]);

        res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        console.log("Error in getChatMessages:", error.message);
        res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
}

export async function sendChatMessage(req, res) {
    try {
        const employeeId = await getEmployeeId(req.user.id);
        const { recipient_id, message } = req.body;
        const file = req.file;

        if (!recipient_id || (!message && !file)) {
            return res.status(400).json({ success: false, message: "Missing recipient_id or message/file" });
        }

        // Build file metadata if file was uploaded
        let fileUrl = null, fileName = null, fileType = null, fileSize = null;
        if (file) {
            fileUrl = `/uploads/chat/${file.filename}`;
            fileName = file.originalname;
            fileType = file.mimetype;
            fileSize = file.size;
        }

        const msgText = message || (file ? `📎 ${file.originalname}` : '');

        // Insert message with file metadata
        const msgResult = await pool.query(`
            INSERT INTO direct_messages (sender_id, recipient_id, message, file_url, file_name, file_type, file_size)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *;
        `, [employeeId, parseInt(recipient_id, 10), msgText, fileUrl, fileName, fileType, fileSize]);

        // Get sender full name to construct notification title
        const senderRes = await pool.query("SELECT full_name FROM employees WHERE id = $1;", [employeeId]);
        const senderName = senderRes.rows[0]?.full_name || "Someone";

        // Build notification message
        const notifMessage = file 
            ? `📎 ${file.originalname}${message ? ' — ' + (message.length > 40 ? message.substring(0, 37) + '...' : message) : ''}`
            : (message.length > 60 ? message.substring(0, 57) + "..." : message);

        // Insert notification for recipient
        await pool.query(`
            INSERT INTO notifications (title, message, type, recipient_id, sender_id)
            VALUES ($1, $2, 'Chat', $3, $4);
        `, [
            `New message from ${senderName}`,
            notifMessage,
            parseInt(recipient_id, 10),
            employeeId
        ]);

        res.status(201).json({ success: true, message: "Message sent", data: msgResult.rows[0] });
    } catch (error) {
        console.log("Error in sendChatMessage:", error.message);
        res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
}

// GET /api/v1/employee/my-customers
export async function getMyCustomers(req, res) {
    try {
        const employeeId = await getEmployeeId(req.user.id);

        const allCusts = await pool.query(`
            SELECT c.*,
                   COALESCE(
                       JSON_AGG(
                           JSON_BUILD_OBJECT(
                               'id', p.id,
                               'name', p.name,
                               'description', p.description,
                               'branch_name', p.branch_name,
                               'status', p.status
                           )
                       ) FILTER (WHERE p.id IS NOT NULL), '[]'
                   ) AS customer_projects
            FROM customers c
            LEFT JOIN projects p ON c.id = p.customer_id
            GROUP BY c.id
            ORDER BY c.name ASC;
        `);

        const allTasks = await pool.query(
            "SELECT id, title, project_id, status, priority, due_date FROM tasks WHERE $1 = ANY(assigned_to);",
            [employeeId]
        );

        const allTickets = await pool.query(`
            SELECT t.*, c.name as customer_name, COALESCE(t.project_name, p.name, 'General') as project_name
            FROM support_tickets t
            LEFT JOIN customers c ON t.customer_id = c.id
            LEFT JOIN projects p ON t.project_id = p.id
            WHERE t.assigned_to = $1 OR t.assigned_team::text ILIKE $2
            ORDER BY t.created_at DESC;
        `, [employeeId, `%"id":${employeeId}%`]);

        const assignedCustomers = [];

        for (const c of allCusts.rows) {
            let isAssigned = false;
            let assignedBranches = [];
            let branches = c.branches;
            if (typeof branches === 'string') {
                try { branches = JSON.parse(branches); } catch(e) { branches = []; }
            }
            if (Array.isArray(branches)) {
                branches.forEach(b => {
                    let bEmps = b.assignedEmployees || [];
                    if (typeof bEmps === 'string') {
                        try { bEmps = JSON.parse(bEmps); } catch(e) { bEmps = []; }
                    }
                    const matchB = Array.isArray(bEmps) && bEmps.some(e => {
                        const eId = typeof e === 'object' && e ? e.id : e;
                        return Number(eId) === Number(employeeId);
                    });
                    if (matchB) {
                        isAssigned = true;
                        assignedBranches.push(b);
                    }
                });
            }

            let custEmps = c.assigned_employees;
            if (typeof custEmps === 'string') {
                try { custEmps = JSON.parse(custEmps); } catch(e) { custEmps = []; }
            }
            if (Array.isArray(custEmps)) {
                if (custEmps.some(e => {
                    const eId = typeof e === 'object' && e ? e.id : e;
                    return Number(eId) === Number(employeeId);
                })) {
                    isAssigned = true;
                }
            }

            let projs = Array.isArray(c.customer_projects) ? c.customer_projects : [];
            if (typeof projs === 'string') {
                try { projs = JSON.parse(projs); } catch(e) { projs = []; }
            }

            const relatedTasks = allTasks.rows.filter(t => {
                return projs.some(p => p.id === t.project_id);
            });
            if (relatedTasks.length > 0) isAssigned = true;

            const relatedTickets = allTickets.rows.filter(t => t.customer_id === c.id);
            if (relatedTickets.length > 0) isAssigned = true;

            if (isAssigned || req.user.role === 'Admin') {
                let activeProjects = [];
                if (assignedBranches.length > 0) {
                    assignedBranches.forEach(b => {
                        let bProjs = b.projects || [];
                        if (typeof bProjs === 'string') {
                            try { bProjs = JSON.parse(bProjs); } catch(e) { bProjs = []; }
                        }
                        if (Array.isArray(bProjs)) {
                            bProjs.forEach(p => {
                                const pName = typeof p === 'string' ? p : (p.name || p.project_name);
                                if (pName && !activeProjects.some(x => x.name === pName && x.branch === b.branch)) {
                                    activeProjects.push({ name: pName, branch: b.branch || '', description: p.description || '' });
                                }
                            });
                        }
                    });
                } else if (projs.length > 0) {
                    projs.forEach(p => {
                        activeProjects.push({ name: p.name, branch: p.branch_name || 'Main', description: p.description || '', id: p.id });
                    });
                }

                if (activeProjects.length === 0 && Array.isArray(branches)) {
                    branches.forEach(b => {
                        let bProjs = b.projects || [];
                        if (typeof bProjs === 'string') {
                            try { bProjs = JSON.parse(bProjs); } catch(e) { bProjs = []; }
                        }
                        if (Array.isArray(bProjs)) {
                            bProjs.forEach(p => {
                                const pName = typeof p === 'string' ? p : (p.name || p.project_name);
                                if (pName) activeProjects.push({ name: pName, branch: b.branch || '', description: p.description || '' });
                            });
                        }
                    });
                }

                assignedCustomers.push({
                    id: c.id,
                    name: c.name,
                    industry: c.industry || 'IT & Consulting',
                    sla_type: c.sla_type || 'Standard',
                    sla_response_time: c.sla_response_time,
                    sla_resolution_time: c.sla_resolution_time,
                    contract_start_date: c.contract_start_date,
                    contract_end_date: c.contract_end_date,
                    branches: assignedBranches.length > 0 ? assignedBranches : branches,
                    activeProjects: activeProjects,
                    totalTasks: relatedTasks.length,
                    activeTasks: relatedTasks.filter(t => t.status !== 'Completed').length,
                    totalTickets: relatedTickets.length,
                    activeTickets: relatedTickets.filter(t => t.status !== 'Resolved' && t.status !== 'Closed').length,
                    recentTickets: relatedTickets.slice(0, 5)
                });
            }
        }

        return res.status(200).json({
            success: true,
            data: assignedCustomers,
            allCustomers: allCusts.rows.map(c => ({ id: c.id, name: c.name, branches: c.branches }))
        });
    } catch (error) {
        console.error("Error in getMyCustomers:", error);
        return res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
}

// GET /api/v1/employee/support-tickets
export async function getEmployeeSupportTickets(req, res) {
    try {
        const employeeId = await getEmployeeId(req.user.id);
        const { status, priority, search } = req.query;

        let conditions = [`(t.assigned_to = $1 OR t.assigned_team::text ILIKE $2 OR t.reported_by ILIKE $3 OR EXISTS (SELECT 1 FROM ticket_subtasks ts_sub WHERE ts_sub.ticket_id = t.id AND ts_sub.assigned_to = $1))`];
        let params = [employeeId, `%"id":${employeeId}%`, `%${req.user.full_name || ''}%`];
        let idx = 4;

        if (status && status !== 'all') {
            conditions.push(`t.status = $${idx++}`);
            params.push(status);
        }
        if (priority && priority !== 'all') {
            conditions.push(`t.priority = $${idx++}`);
            params.push(priority);
        }
        if (search) {
            conditions.push(`(t.ticket_code ILIKE $${idx} OR t.title ILIKE $${idx} OR c.name ILIKE $${idx})`);
            params.push(`%${search}%`);
            idx++;
        }

        const query = `
            SELECT t.*,
                   c.name as customer_name,
                   COALESCE(t.project_name, p.name, 'General') as project_name,
                   e.full_name as assigned_to_name,
                   COUNT(DISTINCT ts.id) as total_subtasks,
                   COUNT(DISTINCT CASE WHEN ts.status = 'Completed' THEN ts.id END) as completed_subtasks
            FROM support_tickets t
            LEFT JOIN customers c ON t.customer_id = c.id
            LEFT JOIN projects p ON t.project_id = p.id
            LEFT JOIN employees e ON t.assigned_to = e.id
            LEFT JOIN ticket_subtasks ts ON t.id = ts.ticket_id
            WHERE ${conditions.join(' AND ')}
            GROUP BY t.id, c.name, p.name, e.full_name
            ORDER BY 
                CASE 
                    WHEN t.priority = 'Critical' THEN 1
                    WHEN t.priority = 'High' THEN 2
                    WHEN t.priority = 'Medium' THEN 3
                    ELSE 4
                END,
                t.created_at DESC;
        `;

        const result = await pool.query(query, params);
        return res.status(200).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error("Error in getEmployeeSupportTickets:", error);
        return res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
}

