import { pool } from '../config/db.js';
import { getWebPagesApplicationsGrid, syncTeramindAttendance } from '../services/teramind.service.js';

/**
 * Trigger PL/pgSQL Calculation Engine for a Month
 * POST /api/v1/attendance/pcs/calculate
 */
export async function calculateAttendance(req, res) {
    try {
        const { month, username } = req.body;
        const targetMonth = month || new Date().toISOString().slice(0, 10);
        const targetUser = username || 'All';

        let affected = 0;
        try {
            const result = await pool.query(
                "SELECT generate_user_rtp($1, $2::date) AS affected",
                [targetUser, targetMonth]
            );
            affected = parseInt(result.rows[0]?.affected || 0, 10);
        } catch (spErr) {
            console.warn("generate_user_rtp notice:", spErr.message);
        }

        try {
            await syncTeramindAttendance();
        } catch (sErr) {
            console.warn("syncTeramindAttendance notice:", sErr.message);
        }

        res.status(200).json({
            success: true,
            message: `Attendance calculated successfully for ${targetUser} (${targetMonth})`,
            affected_days: affected
        });
    } catch (error) {
        console.error("Error in calculateAttendance:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
}

/**
 * Get Monthly Attendance Summary (Dynamic Live Engine + Historical Support)
 * GET /api/v1/attendance/pcs/monthly-summary?month=202609&username=All
 * Aligned 100% with Monthly Payroll Register & Daily Logs
 */
export async function getMonthlySummary(req, res) {
    try {
        const { month, username } = req.query;
        const now = new Date();
        const currentYYYYMM = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now).replace(/-/g, '').slice(0, 6);
        const todayIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
        
        const targetMonth = month ? month.replace(/-/g, '').slice(0, 6) : currentYYYYMM;
        const targetUser = username || 'All';

        const y = parseInt(targetMonth.slice(0, 4), 10);
        const m = parseInt(targetMonth.slice(4, 6), 10);
        const startOfMonth = `${y}-${String(m).padStart(2, '0')}-01`;
        
        const daysInMonth = new Date(y, m, 0).getDate();
        const endOfMonth = `${y}-${String(m).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
        const queryEndDate = (targetMonth === currentYYYYMM) ? todayIST : endOfMonth;

        // 1. Fetch Employees
        const empRes = await pool.query(`
            SELECT e.id, e.full_name, e.employee_code, e.phone, m.computer_name, m.computer_id
            FROM employees e
            LEFT JOIN employee_teramind_mapping m ON e.id = m.employee_id
            WHERE (e.status != 'Terminated' AND e.status != 'Inactive') OR e.status IS NULL
            ORDER BY e.id ASC;
        `);

        // 2. Fetch Public Holidays
        const holidayRes = await pool.query(`
            SELECT date::text as h_date, name 
            FROM holidays 
            WHERE date >= $1 AND date <= $2;
        `, [startOfMonth, endOfMonth]);
        const holidayMap = new Map();
        holidayRes.rows.forEach(h => {
            holidayMap.set(h.h_date.split('T')[0], h);
        });

        // 3. Fetch Approved Leaves
        const leaveRes = await pool.query(`
            SELECT * FROM leave_requests 
            WHERE status = 'Approved' 
              AND NOT (end_date < $1::date OR start_date > $2::date);
        `, [startOfMonth, endOfMonth]);
        const leaveMap = new Map();
        leaveRes.rows.forEach(l => {
            const s = new Date(l.start_date);
            const e = new Date(l.end_date);
            for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
                const dStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
                if (dStr >= startOfMonth && dStr <= endOfMonth) {
                    leaveMap.set(`${l.employee_id}_${dStr}`, l);
                }
            }
        });

        // 4. Fetch Attendance records from 'attendance' table
        const dbAttRes = await pool.query(`
            SELECT * FROM attendance 
            WHERE date >= $1 AND date <= $2;
        `, [startOfMonth, endOfMonth]);
        const dbAttMap = new Map();
        dbAttRes.rows.forEach(r => {
            const dStr = r.date instanceof Date 
                ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(r.date)
                : String(r.date).slice(0, 10);
            const key = `${r.employee_id}_${dStr}`;
            dbAttMap.set(key, r);
        });

        // 5. Historical workstation telemetry fallback (pcs_attendance_sheet) if before Aug 2026
        const sheetMap = new Map();
        if (startOfMonth < '2026-08-01') {
            try {
                const sheetRes = await pool.query(`
                    SELECT computer, rep_datetime::date as punch_date, min(rep_datetime::text) as min_txt, max(rep_datetime::text) as max_txt,
                           sum(coalesce(extract(hour from duration)*3600 + extract(minute from duration)*60 + extract(second from duration), 0)) as total_secs
                    FROM pcs_attendance_sheet
                    WHERE rep_datetime >= $1::timestamp AND rep_datetime < ($2::timestamp + INTERVAL '1 day')
                    GROUP BY computer, rep_datetime::date;
                `, [startOfMonth, endOfMonth]);
                sheetRes.rows.forEach(r => {
                    const c = (r.computer || '').toLowerCase();
                    const dStr = String(r.punch_date).split('T')[0];
                    sheetMap.set(`${c}_${dStr}`, r);
                });
            } catch (sErr) {
                console.warn("Historical pcs_attendance_sheet warning:", sErr.message);
            }
        }

        // 6. Compute calendar working days in month (up to queryEndDate)
        let totalWorkingDays = 0;
        let totalSundays = 0;
        let totalHolidaysInPeriod = 0;
        const calD = new Date(`${startOfMonth}T00:00:00+05:30`);
        const maxD = new Date(`${queryEndDate}T00:00:00+05:30`);
        while (calD <= maxD) {
            const dow = calD.getDay();
            const dStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(calD);
            if (dow === 0) {
                totalSundays++;
            } else if (holidayMap.has(dStr)) {
                totalHolidaysInPeriod++;
            } else {
                totalWorkingDays++;
            }
            calD.setDate(calD.getDate() + 1);
        }

        const formatSecs = (sec) => {
            if (!sec || isNaN(sec) || sec <= 0) return '00:00';
            const h = Math.floor(sec / 3600);
            const min = Math.floor((sec % 3600) / 60);
            return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
        };

        const summaryRows = [];

        for (const emp of empRes.rows) {
            if (targetUser !== 'All' && emp.computer_name !== targetUser && emp.full_name !== targetUser) {
                continue;
            }

            let countP = 0;
            let countLate = 0;
            let countA = 0;
            let countL = 0;
            let countHL = 0;
            let countW = 0;
            let totalOfficeSecs = 0;
            let totalLoginSecs = 0;
            let totalLateSecs = 0;
            let totalOtSecs = 0;

            const cName = (emp.computer_name || '').toLowerCase();

            for (let d = 1; d <= daysInMonth; d++) {
                const dayStr = String(d).padStart(2, '0');
                const dateStr = `${y}-${String(m).padStart(2, '0')}-${dayStr}`;
                const curDateObj = new Date(`${dateStr}T00:00:00+05:30`);
                const dayOfWeek = curDateObj.getDay();
                const isFuture = dateStr > todayIST;

                const dbAtt = dbAttMap.get(`${emp.id}_${dateStr}`);
                const isLeave = leaveMap.get(`${emp.id}_${dateStr}`);
                const isHoliday = holidayMap.get(dateStr);
                const sheetPunch = cName ? sheetMap.get(`${cName}_${dateStr}`) : null;

                // 1. Sunday -> Weekly Off
                if (dayOfWeek === 0) {
                    countW++;
                }
                // 2. Public Holiday -> HL
                else if (isHoliday) {
                    countHL++;
                }
                // 3. Approved Leave
                else if (isLeave) {
                    const lType = (isLeave.leave_type || '').toLowerCase();
                    if (lType.includes('half')) {
                        countP += 0.5;
                        countA += 0.5;
                        countL += 0.5;
                    } else {
                        countL++;
                    }
                }
                // 4. Real DB Attendance
                else if (dbAtt) {
                    if (dbAtt.status === 'Present' || dbAtt.status === 'Late' || dbAtt.status === 'Auto-Synced') {
                        // Crucial: Employee is PRESENT (Late is still Present at work!)
                        countP++;
                        if (dbAtt.status === 'Late') {
                            countLate++;
                        }

                        const hrs = parseFloat(dbAtt.total_working_hours) || 0;
                        totalOfficeSecs += Math.round(hrs * 3600);
                        totalLoginSecs += Math.round(hrs * 3600);

                        // Calculate late arrival seconds
                        if (dbAtt.login_time) {
                            try {
                                const inD = new Date(dbAtt.login_time);
                                if (!isNaN(inD.getTime())) {
                                    const inParts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(inD);
                                    const ip = {};
                                    inParts.forEach(({ type, value }) => { ip[type] = value; });
                                    const hh = parseInt(ip.hour, 10);
                                    const mm = parseInt(ip.minute, 10);
                                    if (hh > 10 || (hh === 10 && mm > 15)) {
                                        totalLateSecs += Math.max(0, ((hh * 60 + mm) - (9 * 60 + 45)) * 60);
                                    }
                                }
                            } catch (e) {}
                        }

                        if (dbAtt.overtime) {
                            totalOtSecs += dbAtt.overtime * 60;
                        }
                    } else if (dbAtt.status === 'Half Day') {
                        countP += 0.5;
                        countA += 0.5;
                        const hrs = parseFloat(dbAtt.total_working_hours) || 0;
                        totalOfficeSecs += Math.round(hrs * 3600);
                        totalLoginSecs += Math.round(hrs * 3600);
                    } else if (dbAtt.status === 'WeekOff' || dbAtt.status === 'Weekly Off') {
                        countW++;
                    } else if (dbAtt.status === 'On Leave' || dbAtt.status === 'Leave') {
                        countL++;
                    } else if (dbAtt.status === 'Absent') {
                        if (!isFuture) countA++;
                    } else {
                        if (!isFuture) countA++;
                    }
                }
                // 5. Historical sheet punch fallback
                else if (sheetPunch) {
                    countP++;
                    const sSecs = parseFloat(sheetPunch.total_secs) || 0;
                    totalOfficeSecs += Math.round(sSecs);
                    totalLoginSecs += Math.round(sSecs);
                }
                // 6. Future Date -> Skip (Not absent)
                else if (isFuture) {
                    // Not reached yet
                }
                // 7. Past weekday without punch -> Absent
                else {
                    countA++;
                }
            }

            summaryRows.push({
                USERNAME: emp.computer_name || emp.full_name,
                YYYYMM: targetMonth,
                EMPLOYEE_ID: emp.id,
                employee_id: emp.id,
                full_name: emp.full_name,
                employee_code: emp.employee_code || `EMP-${String(emp.id).padStart(4, '0')}`,
                phone: emp.phone,
                TOTALDAYS: String(totalWorkingDays),
                PRESENT: String(countP),
                ABSENT: String(countA),
                LEAVE: String(countL),
                WEEKOFF: String(countW),
                HOLIDAY: String(countHL),
                TOTAL_LATE_SECONDS: String(totalLateSecs),
                TOTAL_EARLY_OUT_SECONDS: '0',
                TOTAL_OFFICE_SECONDS: String(totalOfficeSecs),
                TOTAL_OVERTIME_SECONDS: String(totalOtSecs),
                TOTAL_LOGIN_SECONDS: String(totalLoginSecs),
                LATINTIME: formatSecs(totalLateSecs),
                PREOUTTIME: '00:00',
                WORKIMGHR: formatSecs(totalOfficeSecs),
                OTHOURS: formatSecs(totalOtSecs),
                LOGIMHOURS: formatSecs(totalLoginSecs)
            });
        }

        res.status(200).json({
            success: true,
            month: targetMonth,
            count: summaryRows.length,
            data: summaryRows
        });
    } catch (error) {
        console.error("Error in getMonthlySummary:", error);
        res.status(500).json({ success: false, message: error.message });
    }
}

/**
 * Get Daily Detailed Attendance Sheet for an Employee/All
 * GET /api/v1/attendance/pcs/daily-sheet?month=2026-09-01&username=...
 */
export async function getDailyAttendanceSheet(req, res) {
    try {
        const { month, username } = req.query;
        const targetDate = month || new Date().toISOString().slice(0, 10);
        const targetUser = username || 'All';

        const result = await pool.query(
            "SELECT * FROM get_user_attendance2($1, $2::date)",
            [targetUser, targetDate]
        );

        res.status(200).json({
            success: true,
            month: targetDate,
            user: targetUser,
            count: result.rows.length,
            data: result.rows
        });
    } catch (error) {
        console.error("Error in getDailyAttendanceSheet:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
}

/**
 * Raw Activity Gap Analysis
 * GET /api/v1/attendance/pcs/gap-analysis?month=2026-09-01&username=...&diff=15
 */
export async function getGapAnalysis(req, res) {
    try {
        const { month, username, diff } = req.query;
        const targetDate = month || new Date().toISOString().slice(0, 10);
        const targetUser = username || 'All';
        const minDiff = parseInt(diff || 15, 10);

        const result = await pool.query(
            "SELECT * FROM check_diff_in_sheet($1::date, $2, $3)",
            [targetDate, targetUser, minDiff]
        );

        res.status(200).json({
            success: true,
            minDiffMinutes: minDiff,
            count: result.rows.length,
            data: result.rows
        });
    } catch (error) {
        console.error("Error in getGapAnalysis:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
}

/**
 * Ingest Raw Attendance Punches
 * POST /api/v1/attendance/pcs/import
 */
export async function importAttendancePunches(req, res) {
    try {
        const { punches } = req.body;
        if (!Array.isArray(punches) || punches.length === 0) {
            return res.status(400).json({ success: false, message: "Array of punch logs is required" });
        }

        let insertedCount = 0;
        for (const p of punches) {
            if (!p.computer || !p.rep_datetime) continue;
            const dt = new Date(p.rep_datetime);
            const yyyymm = `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, '0')}`;
            const mth = String(dt.getMonth() + 1).padStart(2, '0');
            const dayys = String(dt.getDate()).padStart(2, '0');
            const dur = p.duration || '00:00:00';

            await pool.query(`
                INSERT INTO pcs_attendance_sheet (computer, rep_datetime, duration, yearmth, mth, dayys, data_from, remark)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [p.computer, p.rep_datetime, dur, yyyymm, mth, dayys, p.data_from || 'API_INGESTION', p.remark || null]);
            insertedCount++;
        }

        res.status(200).json({
            success: true,
            message: `Successfully ingested ${insertedCount} punch records.`,
            inserted: insertedCount
        });
    } catch (error) {
        console.error("Error in importAttendancePunches:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
}
