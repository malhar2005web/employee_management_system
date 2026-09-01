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

        // 4. Fetch Teramind activity telemetry for this target date (00:00:00 to 23:59:59 IST)
        const dayStart = new Date(`${targetDateStr}T00:00:00+05:30`);
        const dayEnd = new Date(`${targetDateStr}T23:59:59+05:30`);
        const startUnix = Math.floor(dayStart.getTime() / 1000);
        const endUnix = Math.floor(dayEnd.getTime() / 1000);

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

        // Map Teramind activity by computer_id / computer_name
        const compActivityMap = new Map();
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

        // 5. Build consolidated daily logs for all employees
        let logs = [];
        let presentCount = 0;
        let lateCount = 0;
        let absentCount = 0;
        let leaveCount = 0;

        for (const emp of employees) {
            const empId = emp.id;
            const cId = emp.computer_id ? String(emp.computer_id) : null;
            const cName = (emp.computer_name || '').toLowerCase();

            // Check manual database correction first
            const dbRecord = dbAttMap.get(empId);
            const onLeave = leaveMap.get(empId);

            let empRows = [];
            if (cId && compActivityMap.has(cId)) empRows = compActivityMap.get(cId);
            else if (cName && compActivityMap.has(cName)) empRows = compActivityMap.get(cName);

            let finalRecord = null;

            if (dbRecord && dbRecord.approval_status === 'Approved') {
                // Manual correction priority
                finalRecord = {
                    id: dbRecord.id,
                    employee_id: empId,
                    full_name: emp.full_name,
                    employee_code: emp.employee_code,
                    workstation: emp.computer_name || '—',
                    date: targetDateStr,
                    login_time: dbRecord.login_time,
                    logout_time: dbRecord.logout_time,
                    total_working_hours: dbRecord.total_working_hours ? parseFloat(dbRecord.total_working_hours).toFixed(2) : '0.00',
                    overtime: dbRecord.overtime || null,
                    status: dbRecord.status || 'Present',
                    approval_status: 'Approved',
                    is_manual: true
                };
            } else if (onLeave) {
                // On Approved Leave
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
                    approval_status: 'Approved'
                };
                leaveCount++;
            } else if (empRows.length > 0) {
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
                    approval_status: 'Auto-Synced'
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
                    approval_status: 'Auto-Synced'
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
