import { pool } from '../config/db.js';
import { getWebPagesApplicationsGrid, syncTeramindDataToCache } from '../services/teramind.service.js';

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
            await syncTeramindDataToCache();
        } catch (sErr) {
            console.warn("syncTeramindDataToCache notice:", sErr.message);
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
        const yearMonth = `${y}-${String(m).padStart(2, '0')}`;
        const startOfMonth = `${yearMonth}-01`;
        
        const daysInMonth = new Date(y, m, 0).getDate();
        const endOfMonth = `${yearMonth}-${String(daysInMonth).padStart(2, '0')}`;

        const dateDisplay = (targetMonth === currentYYYYMM)
            ? `${todayIST.split('-')[2]}-${todayIST.split('-')[1]}-${todayIST.split('-')[0]}`
            : `${String(daysInMonth).padStart(2, '0')}-${String(m).padStart(2, '0')}-${y}`;

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
                const dStr = d.toISOString().split('T')[0];
                if (dStr >= startOfMonth && dStr <= endOfMonth) {
                    leaveMap.set(`${l.employee_id}_${dStr}`, l);
                }
            }
        });

        // 4. Fetch Attendance records from 'attendance' table
        const dbAttRes = await pool.query(`
            SELECT *, date::text as date_str FROM attendance 
            WHERE date >= $1 AND date <= $2;
        `, [startOfMonth, endOfMonth]);
        const dbAttMap = new Map();
        dbAttRes.rows.forEach(r => {
            const dStr = r.date_str ? r.date_str.split('T')[0] : String(r.date).slice(0, 10);
            const key = `${r.employee_id}_${dStr}`;
            dbAttMap.set(key, r);
        });

        // 5. Workstation Activity Telemetry (Live Teramind or Historical SQL Server dataset)
        const compActivityMap = new Map();
        if (startOfMonth < '2026-08-01') {
            try {
                const sheetRes = await pool.query(`
                    SELECT computer, rep_datetime::date as punch_date, duration
                    FROM pcs_attendance_sheet
                    WHERE rep_datetime >= $1::timestamp AND rep_datetime < ($2::timestamp + INTERVAL '1 day')
                    ORDER BY rep_datetime ASC;
                `, [startOfMonth, endOfMonth]);
                sheetRes.rows.forEach(r => {
                    const c = (r.computer || '').toLowerCase();
                    const dStr = String(r.punch_date).split('T')[0];
                    let durSecs = 0;
                    if (r.duration) {
                        const parts = String(r.duration).split(':');
                        if (parts.length >= 3) {
                            durSecs = (parseInt(parts[0], 10) * 3600) + (parseInt(parts[1], 10) * 60) + parseInt(parts[2], 10);
                        }
                    }
                    if (c) {
                        const key = `${c}_${dStr}`;
                        const prev = compActivityMap.get(key) || { totalSecs: 0, count: 0 };
                        compActivityMap.set(key, { totalSecs: prev.totalSecs + durSecs, count: prev.count + 1 });
                    }
                });
            } catch (sErr) {
                console.warn("Historical pcs_attendance_sheet warning:", sErr.message);
            }
        }

        if (endOfMonth >= '2026-08-01') {
            const allCompIds = empRes.rows.map(e => e.computer_id).filter(Boolean).map(id => parseInt(id, 10));
            const tmStart = Math.max(
                Math.floor(new Date(`${startOfMonth}T00:00:00+05:30`).getTime() / 1000),
                Math.floor(new Date('2026-08-01T00:00:00+05:30').getTime() / 1000)
            );
            const tmEnd = Math.floor(new Date(`${endOfMonth}T23:59:59+05:30`).getTime() / 1000);
            try {
                const gridPromise = getWebPagesApplicationsGrid({
                    periodStart: String(tmStart),
                    periodEnd: String(tmEnd),
                    pageSize: 10000,
                    computers: allCompIds.length > 0 ? allCompIds : undefined
                });
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Teramind grid fetch timeout')), 2500)
                );
                const gridRes = await Promise.race([gridPromise, timeoutPromise]);
                (gridRes?.rows || []).forEach(r => {
                    const cId = r.computer?.computer_id ? String(r.computer.computer_id) : null;
                    const cName = (r.computer?.name || '').toLowerCase();
                    const ts = r.time || (r.timestamp?.timestamp ? r.timestamp.timestamp : null);
                    const dur = r.duration || 0;
                    if (!ts) return;
                    const dObj = new Date(ts * 1000);
                    const dStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(dObj);
                    if (cId) {
                        const keyId = `${cId}_${dStr}`;
                        const prev = compActivityMap.get(keyId) || { totalSecs: 0, count: 0 };
                        compActivityMap.set(keyId, { totalSecs: prev.totalSecs + dur, count: prev.count + 1 });
                    }
                    if (cName) {
                        const keyName = `${cName}_${dStr}`;
                        const prev = compActivityMap.get(keyName) || { totalSecs: 0, count: 0 };
                        compActivityMap.set(keyName, { totalSecs: prev.totalSecs + dur, count: prev.count + 1 });
                    }
                });
            } catch (tmErr) {
                console.warn("Summary Teramind grid fetch warning (fallback to DB):", tmErr.message);
            }
        }

        // 6. Compute calendar working days in month (excluding Sundays)
        let totalWorkingDays = 0;
        for (let d = 1; d <= daysInMonth; d++) {
            const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
            if (dow !== 0) totalWorkingDays++;
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
            let countH = 0;
            let countA = 0;
            let countL = 0;
            let countLH = 0;
            let countLP = 0;
            let countHL = 0;
            let countW = 0;
            let totalOfficeSecs = 0;
            let totalLoginSecs = 0;
            let totalLateSecs = 0;
            let totalOtSecs = 0;
            let totalEarlyOutSecs = 0;

            const cId = emp.computer_id ? String(emp.computer_id) : null;
            const cName = (emp.computer_name || '').toLowerCase();

            for (let d = 1; d <= daysInMonth; d++) {
                const dayStr = String(d).padStart(2, '0');
                const dateStr = `${yearMonth}-${dayStr}`;
                // Timezone-safe day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
                const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
                const isFuture = dateStr > todayIST;

                const dbAtt = dbAttMap.get(`${emp.id}_${dateStr}`);
                const isLeave = leaveMap.get(`${emp.id}_${dateStr}`);
                const isHoliday = holidayMap.get(dateStr);

                // Telemetry activity check
                let actData = null;
                if (cId && compActivityMap.has(`${cId}_${dateStr}`)) {
                    actData = compActivityMap.get(`${cId}_${dateStr}`);
                } else if (cName && compActivityMap.has(`${cName}_${dateStr}`)) {
                    actData = compActivityMap.get(`${cName}_${dateStr}`);
                }
                const hasTelemetry = actData && (actData.totalSecs > 0 || actData.count > 0);

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
                        countLH++;
                    } else if (lType.includes('paid')) {
                        countLP++;
                    } else {
                        countL++;
                    }
                }
                // 4. Real DB Attendance
                else if (dbAtt) {
                    if (dbAtt.status === 'Present' || dbAtt.status === 'Late' || dbAtt.status === 'Auto-Synced') {
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

                        // Robust Overtime & Early Out calculation based on 19:00 (Mon-Fri) / 16:30 (Sat)
                        const outDateVal = dbAtt.logout_time || dbAtt.portal_check_out || dbAtt.manual_check_out;
                        if (outDateVal) {
                            try {
                                const outD = new Date(outDateVal);
                                if (!isNaN(outD.getTime())) {
                                    const outParts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).formatToParts(outD);
                                    const op = {};
                                    outParts.forEach(({ type, value }) => { op[type] = value; });
                                    const outH = parseInt(op.hour, 10);
                                    const outM = parseInt(op.minute, 10);
                                    const outS = parseInt(op.second, 10);

                                    const isSaturday = (dayOfWeek === 6);
                                    const isSunday = (dayOfWeek === 0);
                                    const cutoffMins = isSaturday ? (16 * 60 + 30) : (19 * 60);
                                    const cutoffSecs = cutoffMins * 60;
                                    const outTotalSecs = (outH * 3600) + (outM * 60) + outS;

                                    if (dbAtt.overtime_seconds && dbAtt.overtime_seconds > 0) {
                                        totalOtSecs += dbAtt.overtime_seconds;
                                    } else if (dbAtt.overtime && dbAtt.overtime > 0) {
                                        totalOtSecs += dbAtt.overtime * 60;
                                    } else if (isSunday) {
                                        totalOtSecs += Math.round(hrs * 3600);
                                    } else if (outTotalSecs > cutoffSecs) {
                                        totalOtSecs += (outTotalSecs - cutoffSecs);
                                    }

                                    if (dbAtt.early_logout_seconds && dbAtt.early_logout_seconds > 0) {
                                        totalEarlyOutSecs += dbAtt.early_logout_seconds;
                                    } else if (outTotalSecs < cutoffSecs && (dateStr < todayIST || dbAtt.is_early_logout || dbAtt.portal_check_out || dbAtt.manual_check_out)) {
                                        totalEarlyOutSecs += (cutoffSecs - outTotalSecs);
                                    }
                                }
                            } catch (e) {}
                        } else if (dbAtt.overtime) {
                            totalOtSecs += dbAtt.overtime * 60;
                        }
                    } else if (dbAtt.status === 'Half Day') {
                        countH++;
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
                // 5. Live Telemetry Activity Fallback
                else if (hasTelemetry) {
                    countP++;
                    totalOfficeSecs += actData.totalSecs;
                    totalLoginSecs += actData.totalSecs;
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

            // Calculations strictly matching Payroll Register & Book1.xlsx
            const presentDays = parseFloat((countP + (countH * 0.5) + (countLH * 0.5)).toFixed(1));
            const absentDays = parseFloat((countA + (countH * 0.5)).toFixed(1));
            const leaveDays = parseFloat((countL + (countLH * 0.5) + countLP).toFixed(1));

            summaryRows.push({
                USERNAME: emp.computer_name || emp.full_name,
                YYYYMM: targetMonth,
                DATE: dateDisplay,
                summaryDate: dateDisplay,
                EMPLOYEE_ID: emp.id,
                employee_id: emp.id,
                full_name: emp.full_name,
                employee_code: emp.employee_code || `EMP-${String(emp.id).padStart(4, '0')}`,
                phone: emp.phone,
                TOTALDAYS: String(totalWorkingDays),
                PRESENT: String(presentDays),
                ABSENT: String(absentDays),
                LEAVE: String(leaveDays),
                WEEKOFF: String(countW),
                HOLIDAY: String(countHL),
                TOTAL_LATE_SECONDS: String(totalLateSecs),
                TOTAL_EARLY_OUT_SECONDS: String(totalEarlyOutSecs),
                TOTAL_OFFICE_SECONDS: String(totalOfficeSecs),
                TOTAL_OVERTIME_SECONDS: String(totalOtSecs),
                TOTAL_LOGIN_SECONDS: String(totalLoginSecs),
                LATINTIME: formatSecs(totalLateSecs),
                PREOUTTIME: formatSecs(totalEarlyOutSecs),
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
