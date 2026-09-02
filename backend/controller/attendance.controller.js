import { pool } from '../config/db.js';
import { getWebPagesApplicationsGrid } from '../services/teramind.service.js';

export async function getAttendanceLogs(req, res) {
    try {
        const { date, search, status } = req.query;
        const targetDateStr = date || new Date().toISOString().slice(0, 10);

        // 1. Fetch active employees with workstation mapping
        const empQuery = `
            SELECT e.id, e.full_name, e.employee_code, e.department_id, e.designation_id,
                   m.computer_id, m.computer_name
            FROM employees e
            LEFT JOIN employee_teramind_mapping m ON e.id = m.employee_id
            WHERE (e.status = 'Active' OR e.status IS NULL OR e.status = 'active')
            ORDER BY e.full_name ASC;
        `;
        const empRes = await pool.query(empQuery);
        const employees = empRes.rows;

        // 2. Fetch manual corrections/records from attendance table for targetDate
        const dbAttRes = await pool.query(
            "SELECT * FROM attendance WHERE date = $1",
            [targetDateStr]
        );
        const dbAttMap = new Map();
        dbAttRes.rows.forEach(r => dbAttMap.set(r.employee_id, r));

        // 3. Fetch approved leaves covering targetDate
        const leaveMap = new Map();
        try {
            const leaveRes = await pool.query(`
                SELECT lr.employee_id, lr.leave_type, lr.reason
                FROM leave_requests lr
                WHERE lr.status = 'Approved' 
                  AND $1::date >= lr.start_date AND $1::date <= lr.end_date
            `, [targetDateStr]);
            leaveRes.rows.forEach(l => leaveMap.set(l.employee_id, l));
        } catch (lErr) {
            console.warn("getAttendanceLogs leave query fallback:", lErr.message);
        }

        // 4. Fetch Workstation Activity Telemetry (Historical Jan-Jul 2026 from pcs_attendance_sheet vs Aug-Sep Live Teramind)
        const dayStart = new Date(`${targetDateStr}T00:00:00+05:30`);
        const dayEnd = new Date(`${targetDateStr}T23:59:59+05:30`);
        const startUnix = Math.floor(dayStart.getTime() / 1000);
        const endUnix = Math.floor(dayEnd.getTime() / 1000);

        const compActivityMap = new Map();

        if (targetDateStr < '2026-08-01') {
            // Fetch from Historical SQL Server dataset (pcs_attendance_sheet)
            try {
                const sheetRes = await pool.query(`
                    SELECT computer, rep_datetime::text as rep_dt_txt, duration
                    FROM pcs_attendance_sheet
                    WHERE rep_datetime >= $1::timestamp AND rep_datetime < ($1::timestamp + INTERVAL '1 day')
                    ORDER BY rep_datetime ASC;
                `, [targetDateStr]);

                sheetRes.rows.forEach(r => {
                    const cName = (r.computer || '').toLowerCase();
                    const txt = (r.rep_dt_txt || '').split('.')[0];
                    const ts = txt ? Math.floor(new Date(txt.replace(' ', 'T') + '+05:30').getTime() / 1000) : 0;
                    let durSecs = 0;
                    if (r.duration) {
                        const parts = String(r.duration).split(':');
                        if (parts.length >= 3) {
                            durSecs = (parseInt(parts[0], 10) * 3600) + (parseInt(parts[1], 10) * 60) + parseInt(parts[2], 10);
                        }
                    }
                    if (cName && ts > 0) {
                        if (!compActivityMap.has(cName)) compActivityMap.set(cName, []);
                        compActivityMap.get(cName).push({ ts, dur: durSecs });
                    }
                });
            } catch (sErr) {
                console.warn("getAttendanceLogs historical sheet fetch warning:", sErr.message);
            }
        } else {
            // Fetch from Teramind Live API (Aug-Sep 2026+)
            const allCompIds = employees.map(e => e.computer_id).filter(Boolean).map(id => parseInt(id, 10));
            let gridRows = [];
            try {
                const gridParams = {
                    periodStart: String(startUnix),
                    periodEnd: String(endUnix),
                    pageSize: 10000
                };
                if (allCompIds.length > 0) {
                    gridParams.computers = allCompIds;
                }
                const gridRes = await getWebPagesApplicationsGrid(gridParams);
                gridRows = gridRes?.rows || [];
            } catch (e) {
                console.warn("getAttendanceLogs Teramind grid fetch warning:", e.message);
            }

            gridRows.forEach(r => {
                const cId = r.computer?.computer_id ? String(r.computer.computer_id) : null;
                const cName = (r.computer?.name || '').toLowerCase();
                const ts = r.time || (r.timestamp?.timestamp ? r.timestamp.timestamp : null);
                const dur = r.duration || 0;

                if (cId) {
                    if (!compActivityMap.has(cId)) compActivityMap.set(cId, []);
                    compActivityMap.get(cId).push({ ts, dur });
                }
                if (cName) {
                    if (!compActivityMap.has(cName)) compActivityMap.set(cName, []);
                    compActivityMap.get(cName).push({ ts, dur });
                }
            });
        }

        // 5. Build consolidated daily logs for all employees using Smart Tiered Hierarchy
        let logs = [];
        let presentCount = 0;
        let lateCount = 0;
        let absentCount = 0;
        let leaveCount = 0;

        for (const emp of employees) {
            const empId = emp.id;
            const cId = emp.computer_id ? String(emp.computer_id) : null;
            const cName = (emp.computer_name || '').toLowerCase();

            const dbRecord = dbAttMap.get(empId);
            const onLeave = leaveMap.get(empId);

            let empRows = [];
            if (cId && compActivityMap.has(cId)) empRows = compActivityMap.get(cId);
            else if (cName && compActivityMap.has(cName)) empRows = compActivityMap.get(cName);

            let finalRecord = null;

            // Tier 1: Admin / HR Manual Approved Override
            if (dbRecord && (dbRecord.approval_status === 'Approved' || dbRecord.manual_check_in)) {
                finalRecord = {
                    id: dbRecord.id,
                    employee_id: empId,
                    full_name: emp.full_name,
                    employee_code: emp.employee_code,
                    workstation: emp.computer_name || '—',
                    date: targetDateStr,
                    login_time: dbRecord.login_time || dbRecord.manual_check_in,
                    logout_time: dbRecord.logout_time || dbRecord.manual_check_out,
                    total_working_hours: dbRecord.total_working_hours ? parseFloat(dbRecord.total_working_hours).toFixed(2) : '0.00',
                    overtime: dbRecord.overtime || null,
                    status: dbRecord.status || 'Present',
                    approval_status: 'Approved',
                    punch_source: 'MANUAL_HR',
                    is_manual: true
                };
            }
            // Tier 2: Employee Portal Web Punch
            else if (dbRecord && (dbRecord.portal_check_in || dbRecord.punch_source === 'PORTAL')) {
                finalRecord = {
                    id: dbRecord.id,
                    employee_id: empId,
                    full_name: emp.full_name,
                    employee_code: emp.employee_code,
                    workstation: emp.computer_name || '—',
                    date: targetDateStr,
                    login_time: dbRecord.portal_check_in || dbRecord.login_time,
                    logout_time: dbRecord.portal_check_out || dbRecord.logout_time,
                    total_working_hours: dbRecord.total_working_hours ? parseFloat(dbRecord.total_working_hours).toFixed(2) : '0.00',
                    overtime: dbRecord.overtime || null,
                    status: dbRecord.status || 'Present',
                    approval_status: 'Auto-Synced',
                    punch_source: 'PORTAL',
                    is_manual: false
                };
            }
            // Tier 4: Approved Leave Check
            else if (onLeave) {
                const leaveTypeName = onLeave.leave_type || 'Leave';
                const isHalfDay = leaveTypeName.toLowerCase().includes('half');
                finalRecord = {
                    id: null,
                    employee_id: empId,
                    full_name: emp.full_name,
                    employee_code: emp.employee_code,
                    workstation: emp.computer_name || '—',
                    date: targetDateStr,
                    login_time: null,
                    logout_time: null,
                    total_working_hours: '0.00',
                    overtime: null,
                    status: isHalfDay ? 'Half Day' : 'On Leave',
                    leave_type: leaveTypeName,
                    approval_status: 'Approved',
                    punch_source: 'LEAVE_MANAGEMENT'
                };
                leaveCount++;
            }
            // Tier 3: Workstation Telemetry Automatic Fallback (Teramind / SQL Server)
            else if (empRows.length > 0) {
                // Computed from live Teramind telemetry
                let minTs = Infinity;
                let maxTs = 0;
                let totalActiveSecs = 0;

                empRows.forEach(r => {
                    if (r.ts && r.ts > 0) {
                        if (r.ts < minTs) minTs = r.ts;
                        const end = r.ts + r.dur;
                        if (end > maxTs) maxTs = end;
                    }
                    totalActiveSecs += r.dur;
                });

                const checkInDate = minTs !== Infinity ? new Date(minTs * 1000) : null;
                const checkOutDate = maxTs > 0 ? new Date(maxTs * 1000) : null;

                // Format IST strings
                const formatISTIso = (d) => {
                    if (!d) return null;
                    const parts = new Intl.DateTimeFormat('en-GB', {
                        timeZone: 'Asia/Kolkata',
                        year: 'numeric', month: '2-digit', day: '2-digit',
                        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
                    }).formatToParts(d);
                    const p = {};
                    parts.forEach(({ type, value }) => { p[type] = value; });
                    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
                };

                const loginTimeStr = formatISTIso(checkInDate);
                const logoutTimeStr = formatISTIso(checkOutDate);
                const totalHoursNum = (totalActiveSecs / 3600).toFixed(2);

                // Rule Check: Grace period up to 10:15 AM (Present <= 10:15, Late > 10:15)
                let isLate = false;
                if (checkInDate) {
                    const checkInParts = new Intl.DateTimeFormat('en-GB', {
                        timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false
                    }).formatToParts(checkInDate);
                    const p = {};
                    checkInParts.forEach(({ type, value }) => { p[type] = value; });
                    const hh = parseInt(p.hour, 10);
                    const mm = parseInt(p.minute, 10);
                    // Check-in up to 10:15 AM is Present. After 10:15 AM (10:16+) is Late.
                    if (hh > 10 || (hh === 10 && mm > 15)) {
                        isLate = true;
                    }
                }

                // Check-out Time Rule:
                // For Today's logs, office working hours are till 7:00 PM (19:00).
                // Keep Check-Out as null ('—') while shift is in progress before 7:00 PM.
                const todayIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
                const isToday = targetDateStr === todayIST;
                
                const nowParts = new Intl.DateTimeFormat('en-GB', {
                    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false
                }).formatToParts(new Date());
                const nowP = {};
                nowParts.forEach(({ type, value }) => { nowP[type] = value; });
                const currentHourIST = parseInt(nowP.hour, 10);

                let finalLogoutTimeStr = logoutTimeStr;
                if (isToday) {
                    if (checkOutDate) {
                        const outParts = new Intl.DateTimeFormat('en-GB', {
                            timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false
                        }).formatToParts(checkOutDate);
                        const outP = {};
                        outParts.forEach(({ type, value }) => { outP[type] = value; });
                        const outH = parseInt(outP.hour, 10);

                        // If current time is before 7 PM (19:00) and last punch is before 19:00, show '-'
                        if (currentHourIST < 19 && outH < 19) {
                            finalLogoutTimeStr = null;
                        }
                    } else {
                        finalLogoutTimeStr = null;
                    }
                }

                // Rule Check: Overtime if logout > 19:00
                let overtimeMins = null;
                if (checkOutDate) {
                    const checkOutParts = new Intl.DateTimeFormat('en-GB', {
                        timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false
                    }).formatToParts(checkOutDate);
                    const p = {};
                    checkOutParts.forEach(({ type, value }) => { p[type] = value; });
                    const outH = parseInt(p.hour, 10);
                    const outM = parseInt(p.minute, 10);
                    if (outH > 19 || (outH === 19 && outM > 0)) {
                        overtimeMins = ((outH - 19) * 60) + outM;
                    }
                }

                const calculatedStatus = isLate ? 'Late' : 'Present';
                if (isLate) lateCount++;
                else presentCount++;

                finalRecord = {
                    id: dbRecord?.id || null,
                    employee_id: empId,
                    full_name: emp.full_name,
                    employee_code: emp.employee_code,
                    workstation: emp.computer_name || '—',
                    date: targetDateStr,
                    login_time: loginTimeStr,
                    logout_time: finalLogoutTimeStr,
                    total_working_hours: totalHoursNum,
                    overtime: overtimeMins,
                    status: calculatedStatus,
                    approval_status: 'Auto-Synced',
                    punch_source: 'TERAMIND'
                };
            } else {
                // Absent
                absentCount++;
                finalRecord = {
                    id: dbRecord?.id || null,
                    employee_id: empId,
                    full_name: emp.full_name,
                    employee_code: emp.employee_code,
                    workstation: emp.computer_name || '—',
                    date: targetDateStr,
                    login_time: null,
                    logout_time: null,
                    total_working_hours: '0.00',
                    overtime: null,
                    status: 'Absent',
                    approval_status: 'Auto-Synced',
                    punch_source: 'AUTO'
                };
            }

            logs.push(finalRecord);
        }

        // Apply search filter if provided
        if (search) {
            const sLow = search.toLowerCase();
            logs = logs.filter(l => (l.full_name && l.full_name.toLowerCase().includes(sLow)) || (l.employee_code && l.employee_code.toLowerCase().includes(sLow)));
        }

        // Apply status filter if provided
        if (status) {
            logs = logs.filter(l => l.status === status);
        }

        res.status(200).json({
            success: true,
            date: targetDateStr,
            summary: {
                present: presentCount,
                late: lateCount,
                absent: absentCount,
                leave: leaveCount,
                total: employees.length
            },
            data: {
                logs: logs,
                employees: employees.map(e => ({ id: e.id, full_name: e.full_name, employee_code: e.employee_code }))
            }
        });
    } catch (error) {
        console.error("Error in getAttendanceLogs:", error.message);
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

export async function getEmployeeAttendanceHistory(req, res) {
    try {
        const { id } = req.params;
        const { range = '30days' } = req.query;

        const empRes = await pool.query(`
            SELECT e.id, e.full_name, e.employee_code, e.department, e.designation,
                   m.computer_id, m.computer_name
            FROM employees e
            LEFT JOIN employee_teramind_mapping m ON e.id = m.employee_id
            WHERE e.id = $1;
        `, [id]);

        if (empRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Employee not found" });
        }
        const emp = empRes.rows[0];

        const now = new Date();
        let startDateStr = '2026-08-01';
        let endDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);

        if (range === 'today') {
            startDateStr = endDateStr;
        } else if (range === 'yesterday') {
            const y = new Date();
            y.setDate(y.getDate() - 1);
            startDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(y);
            endDateStr = startDateStr;
        } else if (range === '7days') {
            const d7 = new Date();
            d7.setDate(d7.getDate() - 7);
            startDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d7);
        } else if (range === '30days') {
            const d30 = new Date();
            d30.setDate(d30.getDate() - 30);
            startDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d30);
        } else if (range === 'all2026') {
            startDateStr = '2026-01-01';
        }

        const historyMap = new Map();

        // 1. Fetch from pcs_attendance_sheet (dates before 2026-08-01)
        if (startDateStr < '2026-08-01' && emp.computer_name) {
            const sheetRes = await pool.query(`
                SELECT rep_datetime::date as punch_date,
                       min(rep_datetime::text) as min_txt,
                       max(rep_datetime::text) as max_txt,
                       sum(coalesce(extract(hour from duration)*3600 + extract(minute from duration)*60 + extract(second from duration), 0)) as total_secs
                FROM pcs_attendance_sheet
                WHERE computer ILIKE $1 
                  AND rep_datetime >= $2::timestamp 
                  AND rep_datetime < ($3::timestamp + INTERVAL '1 day')
                GROUP BY rep_datetime::date
                ORDER BY punch_date DESC;
            `, [emp.computer_name, startDateStr, endDateStr]);

            sheetRes.rows.forEach(r => {
                const dStr = String(r.punch_date).split('T')[0];
                const inTxt = (r.min_txt || '').split(' ')[1]?.slice(0, 5) || '—';
                const outTxt = (r.max_txt || '').split(' ')[1]?.slice(0, 5) || '—';
                const hrs = (r.total_secs / 3600).toFixed(2);
                
                let isLate = false;
                if (inTxt !== '—') {
                    const [h, m] = inTxt.split(':').map(Number);
                    if (h > 10 || (h === 10 && m > 15)) isLate = true;
                }

                historyMap.set(dStr, {
                    date: dStr,
                    check_in: inTxt,
                    check_out: outTxt,
                    working_hours: hrs,
                    overtime: null,
                    status: isLate ? 'Late' : 'Present',
                    source: 'TERAMIND'
                });
            });
        }

        // 2. Fetch from Teramind API (dates on/after 2026-08-01)
        if (endDateStr >= '2026-08-01' && emp.computer_id) {
            const tmStart = Math.max(Math.floor(new Date(`${startDateStr}T00:00:00+05:30`).getTime() / 1000), Math.floor(new Date('2026-08-01T00:00:00+05:30').getTime() / 1000));
            const tmEnd = Math.floor(new Date(`${endDateStr}T23:59:59+05:30`).getTime() / 1000);

            try {
                const gridRes = await getWebPagesApplicationsGrid({
                    computers: [parseInt(emp.computer_id, 10)],
                    periodStart: String(tmStart),
                    periodEnd: String(tmEnd),
                    pageSize: 10000
                });
                const rows = gridRes?.rows || [];

                const tmDateMap = new Map();
                rows.forEach(r => {
                    const ts = r.time || (r.timestamp?.timestamp ? r.timestamp.timestamp : null);
                    const dur = r.duration || 0;
                    if (!ts) return;

                    const dObj = new Date(ts * 1000);
                    const dStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(dObj);
                    if (!tmDateMap.has(dStr)) tmDateMap.set(dStr, []);
                    tmDateMap.get(dStr).push({ ts, dur });
                });

                const todayIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
                const nowParts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now);
                const nowP = {};
                nowParts.forEach(({ type, value }) => { nowP[type] = value; });
                const curH = parseInt(nowP.hour, 10);

                tmDateMap.forEach((pList, dStr) => {
                    let minTs = Infinity;
                    let maxTs = 0;
                    let totalSecs = 0;
                    pList.forEach(p => {
                        if (p.ts < minTs) minTs = p.ts;
                        const end = p.ts + p.dur;
                        if (end > maxTs) maxTs = end;
                        totalSecs += p.dur;
                    });

                    const inD = new Date(minTs * 1000);
                    const outD = new Date(maxTs * 1000);

                    const inStr = inD.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
                    let outStr = outD.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });

                    if (dStr === todayIST && curH < 19) {
                        outStr = '—';
                    }

                    let isLate = false;
                    const inParts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(inD);
                    const ip = {};
                    inParts.forEach(({ type, value }) => { ip[type] = value; });
                    const hh = parseInt(ip.hour, 10);
                    const mm = parseInt(ip.minute, 10);
                    if (hh > 10 || (hh === 10 && mm > 15)) isLate = true;

                    historyMap.set(dStr, {
                        date: dStr,
                        check_in: inStr,
                        check_out: outStr,
                        working_hours: (totalSecs / 3600).toFixed(2),
                        overtime: null,
                        status: isLate ? 'Late' : 'Present',
                        source: 'TERAMIND'
                    });
                });
            } catch (tErr) {
                console.warn("Teramind history fetch error:", tErr.message);
            }
        }

        // 3. Merge Manual DB Corrections
        const dbAttRes = await pool.query(`
            SELECT * FROM attendance 
            WHERE employee_id = $1 AND date >= $2 AND date <= $3;
        `, [id, startDateStr, endDateStr]);

        dbAttRes.rows.forEach(r => {
            const dStr = String(r.date).split('T')[0];
            const inStr = r.login_time ? new Date(r.login_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—';
            const outStr = r.logout_time ? new Date(r.logout_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—';
            const hrs = r.total_working_hours ? parseFloat(r.total_working_hours).toFixed(2) : '0.00';
            
            historyMap.set(dStr, {
                date: dStr,
                check_in: inStr,
                check_out: outStr,
                working_hours: hrs,
                overtime: r.overtime || null,
                status: r.status || 'Present',
                source: r.punch_source || (r.approval_status === 'Approved' ? 'MANUAL_HR' : 'PORTAL')
            });
        });

        // 4. Merge Leaves
        const leaveRes = await pool.query(`
            SELECT * FROM leave_requests 
            WHERE employee_id = $1 AND status = 'Approved'
              AND NOT (end_date < $2::date OR start_date > $3::date);
        `, [id, startDateStr, endDateStr]);

        leaveRes.rows.forEach(l => {
            const s = new Date(l.start_date);
            const e = new Date(l.end_date);
            for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
                const dStr = d.toISOString().split('T')[0];
                if (dStr >= startDateStr && dStr <= endDateStr) {
                    const isHalf = (l.leave_type || '').toLowerCase().includes('half');
                    historyMap.set(dStr, {
                        date: dStr,
                        check_in: '—',
                        check_out: '—',
                        working_hours: '0.00',
                        overtime: null,
                        status: isHalf ? 'Half Day' : 'On Leave',
                        source: 'LEAVE_MANAGEMENT'
                    });
                }
            }
        });

        const sortedLogs = Array.from(historyMap.values()).sort((a, b) => b.date.localeCompare(a.date));

        let present = 0, late = 0, absent = 0, totalHours = 0;
        sortedLogs.forEach(l => {
            if (l.status === 'Present') present++;
            else if (l.status === 'Late') late++;
            else if (l.status === 'Absent') absent++;
            totalHours += parseFloat(l.working_hours || 0);
        });

        res.status(200).json({
            success: true,
            employee: {
                id: emp.id,
                full_name: emp.full_name,
                employee_code: emp.employee_code,
                department: emp.department || 'Operations',
                workstation: emp.computer_name || '—'
            },
            range: range,
            startDate: startDateStr,
            endDate: endDateStr,
            summary: {
                totalDays: sortedLogs.length,
                present: present,
                late: late,
                absent: absent,
                totalHours: totalHours.toFixed(2)
            },
            data: sortedLogs
        });
    } catch (error) {
        console.error("Error in getEmployeeAttendanceHistory:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}
