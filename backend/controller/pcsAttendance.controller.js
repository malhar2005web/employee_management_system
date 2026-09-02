import { pool } from '../config/db.js';
import { getWebPagesApplicationsGrid } from '../services/teramind.service.js';

/**
 * Trigger PL/pgSQL Calculation Engine for a Month
 * POST /api/v1/attendance/pcs/calculate
 */
export async function calculateAttendance(req, res) {
    try {
        const { month, username } = req.body;
        const targetMonth = month || new Date().toISOString().slice(0, 10);
        const targetUser = username || 'All';

        const result = await pool.query(
            "SELECT generate_user_rtp($1, $2::date) AS affected",
            [targetUser, targetMonth]
        );

        res.status(200).json({
            success: true,
            message: `Attendance calculated successfully for ${targetUser} (${targetMonth})`,
            affected_days: parseInt(result.rows[0]?.affected || 0, 10)
        });
    } catch (error) {
        console.error("Error in calculateAttendance:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
}

/**
 * Get Monthly Attendance Summary (Dynamic Live Engine + Historical Support)
 * GET /api/v1/attendance/pcs/monthly-summary?month=202609&username=All
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
        
        // Calculate end of month (or today if current month)
        const daysInMonth = new Date(y, m, 0).getDate();
        const endOfMonth = `${y}-${String(m).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
        const queryEndDate = (targetMonth === currentYYYYMM) ? todayIST : endOfMonth;

        // If historical month before August 2026, use ATTENDANCE_SUM view if available
        if (targetMonth < '202608') {
            let query = `
                SELECT 
                    s.*,
                    COALESCE(e.full_name, s."USERNAME") as full_name,
                    e.employee_code,
                    COALESCE(e.id, s."EMPLOYEE_ID") as employee_id,
                    e.phone
                FROM "ATTENDANCE_SUM" s
                LEFT JOIN employee_teramind_mapping m ON LOWER(s."USERNAME") = LOWER(m.computer_name)
                LEFT JOIN employees e ON (s."EMPLOYEE_ID" = e.id OR m.employee_id = e.id)
                WHERE s."YYYYMM" = $1
            `;
            const params = [targetMonth];
            if (targetUser !== 'All') {
                query += ` AND s."USERNAME" = $2`;
                params.push(targetUser);
            }
            query += ` ORDER BY COALESCE(e.full_name, s."USERNAME") ASC;`;
            const result = await pool.query(query, params);
            if (result.rows.length > 0) {
                return res.status(200).json({
                    success: true,
                    month: targetMonth,
                    count: result.rows.length,
                    data: result.rows
                });
            }
        }

        // Live Aggregator for August 2026, September 2026, and all ongoing months
        const empRes = await pool.query(`
            SELECT e.id, e.full_name, e.employee_code, e.phone, m.computer_name, m.computer_id
            FROM employees e
            LEFT JOIN employee_teramind_mapping m ON e.id = m.employee_id
            WHERE (e.status = 'Active' OR e.status IS NULL OR e.status = 'active')
            ORDER BY e.full_name ASC;
        `);

        // Compute calendar working days in the month (up to queryEndDate for ongoing month)
        let totalWorkingDays = 0;
        let sundays = 0;
        const curD = new Date(`${startOfMonth}T00:00:00+05:30`);
        const maxD = new Date(`${queryEndDate}T00:00:00+05:30`);
        
        while (curD <= maxD) {
            const dayOfWeek = curD.getDay(); // 0 is Sunday
            if (dayOfWeek === 0) {
                sundays++;
            } else {
                totalWorkingDays++;
            }
            curD.setDate(curD.getDate() + 1);
        }

        // Fetch Teramind grid logs for the period
        const tmStart = Math.floor(new Date(`${startOfMonth}T00:00:00+05:30`).getTime() / 1000);
        const tmEnd = Math.floor(new Date(`${queryEndDate}T23:59:59+05:30`).getTime() / 1000);

        let teramindRows = [];
        try {
            const gridRes = await getWebPagesApplicationsGrid({
                periodStart: String(tmStart),
                periodEnd: String(tmEnd),
                pageSize: 10000
            });
            teramindRows = gridRes?.rows || [];
        } catch (tErr) {
            console.warn("Teramind grid fetch error in getMonthlySummary:", tErr.message);
        }

        // Map Teramind punches by computer_id / computer_name -> dateStr -> list of { ts, dur }
        const compDateMap = new Map();
        teramindRows.forEach(r => {
            const compId = r.computer?.computer_id || r.computer?.id;
            const compName = (r.computer?.name || '').toLowerCase();
            const ts = r.time || (r.timestamp?.timestamp ? r.timestamp.timestamp : null);
            const dur = r.duration || 0;
            if (!ts) return;

            const dObj = new Date(ts * 1000);
            const dStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(dObj);
            
            if (compId) {
                if (!compDateMap.has(String(compId))) compDateMap.set(String(compId), new Map());
                const dMap = compDateMap.get(String(compId));
                if (!dMap.has(dStr)) dMap.set(dStr, []);
                dMap.get(dStr).push({ ts, dur });
            }
            if (compName) {
                if (!compDateMap.has(compName)) compDateMap.set(compName, new Map());
                const dMap = compDateMap.get(compName);
                if (!dMap.has(dStr)) dMap.set(dStr, []);
                dMap.get(dStr).push({ ts, dur });
            }
        });

        // Fetch manual DB attendance for the month
        const dbAttRes = await pool.query(`
            SELECT * FROM attendance 
            WHERE date >= $1 AND date <= $2;
        `, [startOfMonth, queryEndDate]);

        const dbAttMap = new Map();
        dbAttRes.rows.forEach(r => {
            const dStr = r.date instanceof Date 
                ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(r.date)
                : String(r.date).slice(0, 10);
            const key = `${r.employee_id}_${dStr}`;
            dbAttMap.set(key, r);
        });

        // Fetch approved leaves for the month
        const leaveRes = await pool.query(`
            SELECT * FROM leave_requests 
            WHERE status = 'Approved' 
              AND NOT (end_date < $1::date OR start_date > $2::date);
        `, [startOfMonth, queryEndDate]);

        const leaveMap = new Map();
        leaveRes.rows.forEach(l => {
            const s = new Date(l.start_date);
            const e = new Date(l.end_date);
            for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
                const dStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
                if (dStr >= startOfMonth && dStr <= queryEndDate) {
                    leaveMap.set(`${l.employee_id}_${dStr}`, l);
                }
            }
        });

        const formatSecs = (sec) => {
            const h = Math.floor(sec / 3600);
            const min = Math.floor((sec % 3600) / 60);
            return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
        };

        const summaryRows = [];

        for (const emp of empRes.rows) {
            if (targetUser !== 'All' && emp.computer_name !== targetUser && emp.full_name !== targetUser) {
                continue;
            }

            let presentCount = 0;
            let lateCount = 0;
            let absentCount = 0;
            let leaveCount = 0;
            let totalOfficeSecs = 0;
            let totalLoginSecs = 0;
            let totalLateSecs = 0;
            let totalOtSecs = 0;

            const cIdStr = emp.computer_id ? String(emp.computer_id) : null;
            const cNameStr = (emp.computer_name || '').toLowerCase();
            const empTMap = (cIdStr && compDateMap.has(cIdStr)) 
                ? compDateMap.get(cIdStr) 
                : (cNameStr && compDateMap.has(cNameStr) ? compDateMap.get(cNameStr) : new Map());

            // Iterate through every working day up to queryEndDate
            const loopD = new Date(`${startOfMonth}T00:00:00+05:30`);
            while (loopD <= maxD) {
                const dayOfWeek = loopD.getDay();
                const dStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(loopD);

                if (dayOfWeek !== 0) { // Exclude Sunday
                    const leaveKey = `${emp.id}_${dStr}`;
                    const dbKey = `${emp.id}_${dStr}`;
                    const dbRec = dbAttMap.get(dbKey);
                    const isLeave = leaveMap.has(leaveKey);
                    const punches = empTMap.get(dStr);

                    if (isLeave) {
                        leaveCount++;
                    } else if (dbRec && (dbRec.login_time || dbRec.status === 'Present' || dbRec.status === 'Late')) {
                        if (dbRec.status === 'Late') lateCount++;
                        else presentCount++;
                        totalOfficeSecs += Math.round((parseFloat(dbRec.total_working_hours) || 0) * 3600);
                        totalLoginSecs += Math.round((parseFloat(dbRec.total_working_hours) || 0) * 3600);
                        if (dbRec.overtime) totalOtSecs += dbRec.overtime * 60;
                    } else if (punches && punches.length > 0) {
                        presentCount++;
                        let minTs = Infinity;
                        let maxTs = 0;
                        let durSum = 0;
                        punches.forEach(p => {
                            if (p.ts < minTs) minTs = p.ts;
                            const end = p.ts + p.dur;
                            if (end > maxTs) maxTs = end;
                            durSum += p.dur;
                        });

                        const inD = new Date(minTs * 1000);
                        const inParts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(inD);
                        const ip = {};
                        inParts.forEach(({ type, value }) => { ip[type] = value; });
                        const hh = parseInt(ip.hour, 10);
                        const mm = parseInt(ip.minute, 10);
                        if (hh > 10 || (hh === 10 && mm > 15)) {
                            lateCount++;
                            totalLateSecs += Math.max(0, ((hh * 60 + mm) - (9 * 60 + 45)) * 60);
                        }

                        totalOfficeSecs += durSum;
                        totalLoginSecs += (maxTs - minTs);
                    } else {
                        absentCount++;
                    }
                }
                loopD.setDate(loopD.getDate() + 1);
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
                PRESENT: String(presentCount),
                ABSENT: String(absentCount),
                LEAVE: String(leaveCount),
                WEEKOFF: String(sundays),
                HOLIDAY: '0',
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
