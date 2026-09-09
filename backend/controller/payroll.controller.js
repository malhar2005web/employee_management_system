import { pool } from '../config/db.js';
import { getWebPagesApplicationsGrid } from '../services/teramind.service.js';

/**
 * Helper to get days in a given month (YYYY-MM)
 */
function getDaysInMonth(yearMonth) {
    const [year, month] = yearMonth.split('-').map(Number);
    return new Date(year, month, 0).getDate();
}

/**
 * GET /api/v1/payroll/monthly?yearMonth=YYYY-MM
 * Calculates and returns full monthly attendance matrix, salary & deductions matching Book1.xlsx
 * Resolves attendance using real DB data: Manual HR overrides, Portal Punches, Approved Leaves,
 * Company Holidays, and Workstation Telemetry Activity (Teramind / SQL Server).
 */
export async function getMonthlyPayroll(req, res) {
    try {
        const todayIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
        const currentYM = todayIST.substring(0, 7);
        const yearMonth = req.query.yearMonth || currentYM;

        const [yearStr, monthStr] = yearMonth.split('-');
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10);
        const daysInMonth = getDaysInMonth(yearMonth);

        const startDate = `${yearMonth}-01`;
        const endDate = `${yearMonth}-${String(daysInMonth).padStart(2, '0')}`;

        // 1. Fetch active employees with workstation mappings and salary parameters
        const empRes = await pool.query(`
            SELECT e.id, e.full_name, e.employee_code, 
                   COALESCE(m.computer_name, '—') as computer_name,
                   m.computer_id,
                   COALESCE(d.name, 'General') as department,
                   COALESCE(des.title, 'Staff') as designation,
                   COALESCE(e.base_salary, 30000.00) as base_salary,
                   COALESCE(e.hourly_rate, 1000.00) as hourly_rate,
                   COALESCE(e.advance_amount, 0.00) as advance_amount,
                   COALESCE(e.loan_amount, 0.00) as loan_amount,
                   COALESCE(e.loan_balance, 0.00) as loan_balance,
                   COALESCE(e.incentive_amount, 0.00) as incentive_amount,
                   COALESCE(e.mobile_deduction, 0.00) as mobile_deduction,
                   COALESCE(e.pt_misc_deduction, 200.00) as pt_misc_deduction
            FROM employees e
            LEFT JOIN employee_teramind_mapping m ON e.id = m.employee_id
            LEFT JOIN departments d ON e.department_id = d.id
            LEFT JOIN designations des ON e.designation_id = des.id
            WHERE (e.status != 'Terminated' AND e.status != 'Inactive') OR e.status IS NULL
            ORDER BY e.id ASC;
        `);
        const employees = empRes.rows;

        // 2. Fetch Attendance Records from 'attendance' table
        const attRes = await pool.query(`
            SELECT employee_id, date::text as date_str, status, punch_source, login_time, logout_time, 
                   total_working_hours, overtime, is_on_break, total_break_seconds,
                   manual_check_in, manual_check_out, portal_check_in, portal_check_out, approval_status
            FROM attendance
            WHERE date >= $1 AND date <= $2;
        `, [startDate, endDate]);
        const attendanceMap = new Map(); // key: `${empId}_${date_str}`
        attRes.rows.forEach(a => {
            const dStr = a.date_str.split('T')[0];
            attendanceMap.set(`${a.employee_id}_${dStr}`, a);
        });

        // 3. Fetch Approved Leaves for this month
        const leaveMap = new Map(); // key: `${empId}_${date_str}`
        try {
            const leaveRes = await pool.query(`
                SELECT lr.employee_id, lr.leave_type, lr.start_date, lr.end_date, lr.status
                FROM leave_requests lr
                WHERE lr.status = 'Approved' 
                  AND NOT (lr.end_date < $1::date OR lr.start_date > $2::date);
            `, [startDate, endDate]);

            leaveRes.rows.forEach(l => {
                const s = new Date(l.start_date);
                const e = new Date(l.end_date);
                for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
                    const dStr = d.toISOString().split('T')[0];
                    if (dStr >= startDate && dStr <= endDate) {
                        leaveMap.set(`${l.employee_id}_${dStr}`, l);
                    }
                }
            });
        } catch (lErr) {
            console.warn("Payroll leaves fetch warning:", lErr.message);
        }

        // 4. Fetch Company Holidays for this month
        const holidayMap = new Map(); // key: `YYYY-MM-DD`
        try {
            const holidayRes = await pool.query(`
                SELECT date::text as h_date, name, type 
                FROM holidays 
                WHERE date >= $1 AND date <= $2;
            `, [startDate, endDate]);
            holidayRes.rows.forEach(h => {
                const dStr = h.h_date.split('T')[0];
                holidayMap.set(dStr, h);
            });
        } catch (hErr) {
            console.warn("Payroll holidays fetch warning:", hErr.message);
        }

        // 5. Fetch Workstation Activity Telemetry (Live Teramind / Historical pcs_attendance_sheet / attendance_user_rtp)
        const compActivityMap = new Map(); // key: `${compKey}_${dateStr}` -> { totalSecs: number, count: number }

        // 5a. Historical SQL Server dataset (Jan-Jul 2026)
        if (startDate < '2026-08-01') {
            try {
                const sheetRes = await pool.query(`
                    SELECT computer, rep_datetime::date as punch_date, duration
                    FROM pcs_attendance_sheet
                    WHERE rep_datetime >= $1::timestamp AND rep_datetime < ($2::timestamp + INTERVAL '1 day')
                    ORDER BY rep_datetime ASC;
                `, [startDate, endDate]);

                sheetRes.rows.forEach(r => {
                    const cName = (r.computer || '').toLowerCase();
                    const dStr = String(r.punch_date).split('T')[0];
                    let durSecs = 0;
                    if (r.duration) {
                        const parts = String(r.duration).split(':');
                        if (parts.length >= 3) {
                            durSecs = (parseInt(parts[0], 10) * 3600) + (parseInt(parts[1], 10) * 60) + parseInt(parts[2], 10);
                        }
                    }
                    if (cName) {
                        const key = `${cName}_${dStr}`;
                        const prev = compActivityMap.get(key) || { totalSecs: 0, count: 0 };
                        compActivityMap.set(key, { totalSecs: prev.totalSecs + durSecs, count: prev.count + 1 });
                    }
                });
            } catch (sErr) {
                console.warn("Payroll historical pcs_attendance_sheet fetch warning:", sErr.message);
            }
        }

        // 5b. Live Teramind API dataset (Aug-Sep 2026+)
        if (endDate >= '2026-08-01') {
            const allCompIds = employees.map(e => e.computer_id).filter(Boolean).map(id => parseInt(id, 10));
            const tmStart = Math.max(
                Math.floor(new Date(`${startDate}T00:00:00+05:30`).getTime() / 1000),
                Math.floor(new Date('2026-08-01T00:00:00+05:30').getTime() / 1000)
            );
            const tmEnd = Math.floor(new Date(`${endDate}T23:59:59+05:30`).getTime() / 1000);

            try {
                const gridParams = {
                    periodStart: String(tmStart),
                    periodEnd: String(tmEnd),
                    pageSize: 10000
                };
                if (allCompIds.length > 0) gridParams.computers = allCompIds;

                const gridPromise = getWebPagesApplicationsGrid(gridParams);
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Teramind grid fetch timeout')), 2500)
                );
                const gridRes = await Promise.race([gridPromise, timeoutPromise]);
                const gridRows = gridRes?.rows || [];

                gridRows.forEach(r => {
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
                console.warn("Payroll Teramind grid fetch warning (fallback to DB):", tmErr.message);
            }
        }

        // 5c. Check attendance_user_rtp table if available
        const rtpMap = new Map(); // key: `${empId}_${date_str}`
        try {
            const rtpRes = await pool.query(`
                SELECT employee_id, date_times::text as d_str, is_present, total_seconds, total_hours
                FROM attendance_user_rtp
                WHERE date_times >= $1 AND date_times <= $2;
            `, [startDate, endDate]);
            rtpRes.rows.forEach(r => {
                const dStr = r.d_str.split('T')[0];
                rtpMap.set(`${r.employee_id}_${dStr}`, r);
            });
        } catch (rErr) {
            console.warn("Payroll attendance_user_rtp fetch warning:", rErr.message);
        }

        // 6. Fetch any manually saved/overridden payroll records for this month
        const savedPayrollRes = await pool.query(`
            SELECT * FROM monthly_payroll_records WHERE year_month = $1;
        `, [yearMonth]);
        const savedPayrollMap = new Map();
        savedPayrollRes.rows.forEach(r => savedPayrollMap.set(r.employee_id, r));

        // 7. Build Monthly Matrix and Financials per Employee
        const records = [];
        let totalGrossPayroll = 0;
        let totalNetPayroll = 0;
        let totalDeductions = 0;
        let totalIncentives = 0;

        for (const emp of employees) {
            const savedRec = savedPayrollMap.get(emp.id) || {};

            const baseSalary = parseFloat(savedRec.base_salary ?? emp.base_salary ?? 30000.00);
            const hourlyRate = parseFloat(savedRec.hourly_billing_rate ?? emp.hourly_rate ?? 1000.00);
            const advanceDeduction = parseFloat(savedRec.advance_deduction ?? emp.advance_amount ?? 0.00);
            const loanDeduction = parseFloat(savedRec.loan_deduction ?? emp.loan_amount ?? 0.00);
            const loanBalance = parseFloat(savedRec.loan_balance ?? emp.loan_balance ?? 0.00);
            const incentiveAddition = parseFloat(savedRec.incentive_addition ?? emp.incentive_amount ?? 0.00);
            const mobileDeduction = parseFloat(savedRec.mobile_deduction ?? emp.mobile_deduction ?? 0.00);
            const ptMiscDeduction = parseFloat(savedRec.pt_misc_deduction ?? emp.pt_misc_deduction ?? 200.00);
            let latePenalty = parseFloat(savedRec.late_hours_deduction ?? 0.00);

            const cId = emp.computer_id ? String(emp.computer_id) : null;
            const cName = (emp.computer_name || '').toLowerCase();

            const dailyMatrix = {};
            let countP = 0;
            let countW = 0;
            let countHL = 0;
            let countH = 0; // Half Day (0.5 Present, 0.5 Absent)
            let countL = 0;
            let countLH = 0;
            let countA = 0;
            let countLP = 0;
            let totalWorkedHours = 0;

            for (let d = 1; d <= daysInMonth; d++) {
                const dayStr = String(d).padStart(2, '0');
                const dateStr = `${yearMonth}-${dayStr}`;
                const curDateObj = new Date(year, month - 1, d);
                const dayOfWeek = curDateObj.getDay(); // 0 = Sunday
                const isFuture = dateStr > todayIST;

                const dbAtt = attendanceMap.get(`${emp.id}_${dateStr}`);
                const isLeave = leaveMap.get(`${emp.id}_${dateStr}`);
                const isHoliday = holidayMap.get(dateStr);
                const rtp = rtpMap.get(`${emp.id}_${dateStr}`);

                // Check telemetry activity
                let actData = null;
                if (cId && compActivityMap.has(`${cId}_${dateStr}`)) {
                    actData = compActivityMap.get(`${cId}_${dateStr}`);
                } else if (cName && compActivityMap.has(`${cName}_${dateStr}`)) {
                    actData = compActivityMap.get(`${cName}_${dateStr}`);
                }
                const hasTelemetry = actData && (actData.totalSecs > 0 || actData.count > 0);
                const hasRtpPresent = rtp && (rtp.is_present === 'P' || (rtp.total_seconds && rtp.total_seconds > 0));

                let code = 'A'; // default

                // 1. Sunday -> Weekly Off
                if (dayOfWeek === 0) {
                    code = 'W';
                    countW++;
                }
                // 2. Company Public Holiday -> HL (Paid Holiday)
                else if (isHoliday) {
                    code = 'HL';
                    countHL++;
                }
                // 3. Approved Leave
                else if (isLeave) {
                    const lType = (isLeave.leave_type || '').toLowerCase();
                    if (lType.includes('half')) {
                        code = 'LH';
                        countLH++;
                    } else if (lType.includes('paid')) {
                        code = 'LP';
                        countLP++;
                    } else {
                        code = 'L';
                        countL++;
                    }
                }
                // 4. Real Attendance from DB
                else if (dbAtt) {
                    if (dbAtt.status === 'Present' || dbAtt.status === 'Late' || dbAtt.status === 'Auto-Synced') {
                        code = 'P';
                        countP++;
                    } else if (dbAtt.status === 'Half Day') {
                        code = 'H';
                        countH++;
                    } else if (dbAtt.status === 'WeekOff' || dbAtt.status === 'Weekly Off') {
                        code = 'W';
                        countW++;
                    } else if (dbAtt.status === 'On Leave' || dbAtt.status === 'Leave') {
                        code = 'L';
                        countL++;
                    } else if (dbAtt.status === 'Absent') {
                        if (isFuture) {
                            code = '—';
                        } else {
                            code = 'A';
                            countA++;
                        }
                    } else {
                        if (isFuture) {
                            code = '—';
                        } else {
                            code = 'A';
                            countA++;
                        }
                    }

                    if (dbAtt.total_working_hours) {
                        totalWorkedHours += parseFloat(dbAtt.total_working_hours) || 0;
                    }
                }
                // 5. Workstation Telemetry Activity Fallback (if any)
                else if (hasTelemetry || hasRtpPresent) {
                    code = 'P';
                    countP++;

                    if (actData && actData.totalSecs > 0) {
                        totalWorkedHours += (actData.totalSecs / 3600);
                    } else if (rtp && rtp.total_seconds > 0) {
                        totalWorkedHours += (rtp.total_seconds / 3600);
                    }
                }
                // 6. Future Date (Not yet reached) -> Dash (—) (Zero deduction, not absent)
                else if (isFuture) {
                    code = '—';
                }
                // 7. Past Weekday with zero activity -> Absent
                else {
                    code = 'A';
                    countA++;
                }

                dailyMatrix[d] = code;
            }

            // Calculations strictly matching Book1.xlsx
            // Column AI: Total Present = COUNTIF(P) + COUNTIF(H)*0.5 + COUNTIF(LH)*0.5
            const presentDays = parseFloat((countP + (countH * 0.5) + (countLH * 0.5)).toFixed(1));

            // Column AK: Total Absent = COUNTIF(A) + COUNTIF(H)*0.5
            const absentDays = parseFloat((countA + (countH * 0.5)).toFixed(1));

            // Column AL: Total Leaves = COUNTIF(L) + COUNTIF(LH)*0.5 - COUNTIF(LP)
            const leaveDays = parseFloat((countL + (countLH * 0.5) - countLP).toFixed(1));

            // Column AV: Month Divisor (30 days standard from Book1.xlsx $AV$1)
            const monthDays = 30;
            const dailyRate = baseSalary / monthDays;

            // Column AW: Absent Amount = (Base Salary / 30) * Absent Days
            const absentDeduction = parseFloat((dailyRate * absentDays).toFixed(2));

            // Column AY: Gross Salary = Base Salary - Advance - Loan
            const grossSalary = parseFloat((baseSalary - advanceDeduction - loanDeduction).toFixed(2));

            // Column BA: Net Salary = Gross Salary + Incentive - Mobile - Absent Deduction - Late Hrs - PT/Misc
            const totalDeds = absentDeduction + advanceDeduction + loanDeduction + mobileDeduction + latePenalty + ptMiscDeduction;
            const netSalary = parseFloat((grossSalary + incentiveAddition - mobileDeduction - absentDeduction - latePenalty - ptMiscDeduction).toFixed(2));

            // Effective Hourly Cost to Company
            const effectiveHourlyCost = totalWorkedHours > 0 
                ? parseFloat((netSalary / totalWorkedHours).toFixed(2)) 
                : parseFloat((netSalary / 160.0).toFixed(2));

            totalGrossPayroll += grossSalary;
            totalNetPayroll += netSalary;
            totalDeductions += totalDeds;
            totalIncentives += incentiveAddition;

            const record = {
                employee_id: emp.id,
                employee_name: emp.full_name,
                employee_code: emp.employee_code || `EMP-${emp.id}`,
                workstation: emp.computer_name || '—',
                department: emp.department || 'General',
                designation: emp.designation || 'Staff',
                year_month: yearMonth,
                days_in_month: daysInMonth,
                daily_matrix: dailyMatrix,
                present_days: presentDays,
                absent_days: absentDays,
                leave_days: leaveDays,
                weekly_offs: countW,
                base_salary: baseSalary,
                hourly_billing_rate: hourlyRate,
                advance_deduction: advanceDeduction,
                loan_deduction: loanDeduction,
                loan_balance: loanBalance,
                incentive_addition: incentiveAddition,
                late_hours_deduction: latePenalty,
                mobile_deduction: mobileDeduction,
                pt_misc_deduction: ptMiscDeduction,
                absent_deduction: absentDeduction,
                gross_salary: grossSalary,
                net_salary: netSalary,
                total_working_hours: parseFloat(totalWorkedHours.toFixed(2)),
                effective_hourly_cost: effectiveHourlyCost
            };

            records.push(record);

            // Upsert snapshot into database
            try {
                await pool.query(`
                    INSERT INTO monthly_payroll_records (
                        employee_id, year_month, total_days, present_days, absent_days, leave_days,
                        base_salary, absent_deduction, advance_deduction, loan_deduction, loan_balance,
                        incentive_addition, late_hours_deduction, mobile_deduction, pt_misc_deduction,
                        gross_salary, net_salary, hourly_billing_rate, effective_hourly_cost, total_working_hours,
                        daily_matrix, updated_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, NOW())
                    ON CONFLICT (employee_id, year_month)
                    DO UPDATE SET
                        total_days = EXCLUDED.total_days,
                        present_days = EXCLUDED.present_days,
                        absent_days = EXCLUDED.absent_days,
                        leave_days = EXCLUDED.leave_days,
                        base_salary = EXCLUDED.base_salary,
                        absent_deduction = EXCLUDED.absent_deduction,
                        advance_deduction = EXCLUDED.advance_deduction,
                        loan_deduction = EXCLUDED.loan_deduction,
                        loan_balance = EXCLUDED.loan_balance,
                        incentive_addition = EXCLUDED.incentive_addition,
                        late_hours_deduction = EXCLUDED.late_hours_deduction,
                        mobile_deduction = EXCLUDED.mobile_deduction,
                        pt_misc_deduction = EXCLUDED.pt_misc_deduction,
                        gross_salary = EXCLUDED.gross_salary,
                        net_salary = EXCLUDED.net_salary,
                        hourly_billing_rate = EXCLUDED.hourly_billing_rate,
                        effective_hourly_cost = EXCLUDED.effective_hourly_cost,
                        total_working_hours = EXCLUDED.total_working_hours,
                        daily_matrix = EXCLUDED.daily_matrix,
                        updated_at = NOW();
                `, [
                    emp.id, yearMonth, daysInMonth, presentDays, absentDays, leaveDays,
                    baseSalary, absentDeduction, advanceDeduction, loanDeduction, loanBalance,
                    incentiveAddition, latePenalty, mobileDeduction, ptMiscDeduction,
                    grossSalary, netSalary, hourlyRate, effectiveHourlyCost, parseFloat(totalWorkedHours.toFixed(2)),
                    JSON.stringify(dailyMatrix)
                ]);
            } catch (saveErr) {
                console.warn(`Could not cache payroll record for emp ${emp.id}:`, saveErr.message);
            }
        }

        res.status(200).json({
            success: true,
            yearMonth,
            daysInMonth,
            summary: {
                totalEmployees: employees.length,
                totalGrossPayroll: parseFloat(totalGrossPayroll.toFixed(2)),
                totalNetPayroll: parseFloat(totalNetPayroll.toFixed(2)),
                totalDeductions: parseFloat(totalDeductions.toFixed(2)),
                totalIncentives: parseFloat(totalIncentives.toFixed(2)),
                avgHourlyRate: employees.length > 0 ? parseFloat((records.reduce((acc, r) => acc + r.hourly_billing_rate, 0) / employees.length).toFixed(2)) : 1000.00
            },
            data: records
        });

    } catch (error) {
        console.error("Error in getMonthlyPayroll:", error);
        res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
}

/**
 * PUT /api/v1/payroll/employee/:id/rates
 * Admin updates an employee's base salary, billing hourly rate, loan, advance, incentives, or deductions.
 */
export async function updateEmployeeRates(req, res) {
    try {
        const empId = parseInt(req.params.id, 10);
        const {
            base_salary,
            hourly_rate,
            advance_amount,
            loan_amount,
            loan_balance,
            incentive_amount,
            mobile_deduction,
            pt_misc_deduction,
            late_hours_deduction,
            year_month
        } = req.body;

        if (!empId || isNaN(empId)) {
            return res.status(400).json({ success: false, message: "Invalid employee ID" });
        }

        // 1. Update Master Employee Table
        await pool.query(`
            UPDATE employees
            SET base_salary = COALESCE($1, base_salary),
                hourly_rate = COALESCE($2, hourly_rate),
                advance_amount = COALESCE($3, advance_amount),
                loan_amount = COALESCE($4, loan_amount),
                loan_balance = COALESCE($5, loan_balance),
                incentive_amount = COALESCE($6, incentive_amount),
                mobile_deduction = COALESCE($7, mobile_deduction),
                pt_misc_deduction = COALESCE($8, pt_misc_deduction),
                updated_at = NOW()
            WHERE id = $9;
        `, [
            base_salary !== undefined ? parseFloat(base_salary) : null,
            hourly_rate !== undefined ? parseFloat(hourly_rate) : null,
            advance_amount !== undefined ? parseFloat(advance_amount) : null,
            loan_amount !== undefined ? parseFloat(loan_amount) : null,
            loan_balance !== undefined ? parseFloat(loan_balance) : null,
            incentive_amount !== undefined ? parseFloat(incentive_amount) : null,
            mobile_deduction !== undefined ? parseFloat(mobile_deduction) : null,
            pt_misc_deduction !== undefined ? parseFloat(pt_misc_deduction) : null,
            empId
        ]);

        // 2. If year_month is provided, also update current monthly record snapshot
        if (year_month) {
            await pool.query(`
                UPDATE monthly_payroll_records
                SET base_salary = COALESCE($1, base_salary),
                    hourly_billing_rate = COALESCE($2, hourly_billing_rate),
                    advance_deduction = COALESCE($3, advance_deduction),
                    loan_deduction = COALESCE($4, loan_deduction),
                    loan_balance = COALESCE($5, loan_balance),
                    incentive_addition = COALESCE($6, incentive_addition),
                    mobile_deduction = COALESCE($7, mobile_deduction),
                    pt_misc_deduction = COALESCE($8, pt_misc_deduction),
                    late_hours_deduction = COALESCE($9, late_hours_deduction),
                    updated_at = NOW()
                WHERE employee_id = $10 AND year_month = $11;
            `, [
                base_salary !== undefined ? parseFloat(base_salary) : null,
                hourly_rate !== undefined ? parseFloat(hourly_rate) : null,
                advance_amount !== undefined ? parseFloat(advance_amount) : null,
                loan_amount !== undefined ? parseFloat(loan_amount) : null,
                loan_balance !== undefined ? parseFloat(loan_balance) : null,
                incentive_amount !== undefined ? parseFloat(incentive_amount) : null,
                mobile_deduction !== undefined ? parseFloat(mobile_deduction) : null,
                pt_misc_deduction !== undefined ? parseFloat(pt_misc_deduction) : null,
                late_hours_deduction !== undefined ? parseFloat(late_hours_deduction) : null,
                empId,
                year_month
            ]);
        }

        res.status(200).json({
            success: true,
            message: "Employee pricing rates & salary parameters updated successfully",
            data: {
                employee_id: empId,
                base_salary: parseFloat(base_salary),
                hourly_rate: parseFloat(hourly_rate),
                advance_amount: parseFloat(advance_amount),
                loan_amount: parseFloat(loan_amount),
                incentive_amount: parseFloat(incentive_amount)
            }
        });
    } catch (error) {
        console.error("Error in updateEmployeeRates:", error);
        res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
}

/**
 * GET /api/v1/payroll/export-csv?yearMonth=YYYY-MM
 * Exports CSV structured identically to Book1.xlsx
 */
export async function exportPayrollCSV(req, res) {
    try {
        const todayIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
        const currentYM = todayIST.substring(0, 7);
        const yearMonth = req.query.yearMonth || currentYM;
        const daysInMonth = getDaysInMonth(yearMonth);

        // Fetch payroll records via helper logic
        const fakeReq = { query: { yearMonth } };
        let payload = null;
        const fakeRes = {
            status: () => ({
                json: (data) => { payload = data; }
            })
        };

        await getMonthlyPayroll(fakeReq, fakeRes);

        if (!payload || !payload.data) {
            return res.status(500).json({ success: false, message: "Could not generate payroll data" });
        }

        const records = payload.data;

        // Build CSV Header
        const headers = ["Employee Name", "Employee Code"];
        for (let d = 1; d <= 31; d++) {
            headers.push(String(d));
        }
        headers.push(
            "Total Present",
            "A (Absent)",
            "Leave",
            "LvCR",
            "lv Balance",
            "Salary (AO)",
            "Advance (AP)",
            "Loan (AR)",
            "LoanBalance (AS)",
            "Conv/Incentive (AT)",
            "Late Hrs (AU)",
            "Month Days (AV)",
            "AbsAmt (AW)",
            "Mobile (AX)",
            "Gross Sal (AY)",
            "PT/Misc (AZ)",
            "Net Salary (BA)",
            "Hourly Billing Rate (₹/hr)",
            "Effective Hourly Cost (₹/hr)"
        );

        const csvRows = [headers.join(',')];

        records.forEach(r => {
            const row = [
                `"${(r.employee_name || '').replace(/"/g, '""')}"`,
                `"${r.employee_code || ''}"`
            ];

            for (let d = 1; d <= 31; d++) {
                if (d <= daysInMonth) {
                    row.push(r.daily_matrix[d] || '—');
                } else {
                    row.push('—');
                }
            }

            row.push(
                r.present_days,
                r.absent_days,
                r.leave_days,
                0, // LvCR
                0, // lv Balance
                r.base_salary,
                r.advance_deduction,
                r.loan_deduction,
                r.loan_balance,
                r.incentive_addition,
                r.late_hours_deduction,
                30, // Month Days
                r.absent_deduction,
                r.mobile_deduction,
                r.gross_salary,
                r.pt_misc_deduction,
                r.net_salary,
                r.hourly_billing_rate,
                r.effective_hourly_cost
            );

            csvRows.push(row.join(','));
        });

        const csvContent = csvRows.join('\r\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="Employee_Payroll_Register_${yearMonth}.csv"`);
        res.status(200).send(csvContent);

    } catch (error) {
        console.error("Error in exportPayrollCSV:", error);
        res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
}
