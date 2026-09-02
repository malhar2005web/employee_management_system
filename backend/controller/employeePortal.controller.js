import { pool } from '../config/db.js';
import bcryptjs from 'bcryptjs';

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
            "SELECT COALESCE(total_working_hours, 0) as hours FROM attendance WHERE employee_id = $1 AND date = CURRENT_DATE;",
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
            "SELECT status, login_time FROM attendance WHERE employee_id = $1 AND date = CURRENT_DATE;",
            [employeeId]
        );
        const attStatus = attRes.rows.length > 0 ? attRes.rows[0].status : 'Absent';
        const checkInTime = attRes.rows.length > 0 ? attRes.rows[0].login_time : null;

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
            data: {
                hoursToday,
                tasksCompleted,
                attStatus,
                checkInTime,
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
            "SELECT id, login_time, logout_time, status FROM attendance WHERE employee_id = $1 AND date = CURRENT_DATE;",
            [employeeId]
        );
        res.status(200).json({
            success: true,
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
            "SELECT id, logout_time FROM attendance WHERE employee_id = $1 AND date = CURRENT_DATE;",
            [employeeId]
        );

        if (checkRes.rows.length > 0) {
            const existing = checkRes.rows[0];
            if (existing.logout_time) {
                // Resuming clock in
                const result = await pool.query(`
                    UPDATE attendance
                    SET login_time = CURRENT_TIMESTAMP, 
                        portal_check_in = COALESCE(portal_check_in, CURRENT_TIMESTAMP),
                        logout_time = NULL,
                        portal_check_out = NULL,
                        punch_source = 'PORTAL',
                        status = $2,
                        is_late_login = $3
                    WHERE id = $1
                    RETURNING *;
                `, [existing.id, status, isLate]);

                await pool.query(`
                    INSERT INTO attendance_logs (employee_id, work_date, clock_in, correction_status)
                    VALUES ($1, CURRENT_DATE, CURRENT_TIMESTAMP, 'Approved');
                `, [employeeId]);

                return res.status(200).json({ success: true, message: "Clocked in successfully", data: result.rows[0] });
            } else {
                return res.status(400).json({ success: false, message: "Already clocked in today" });
            }
        }

        const result = await pool.query(`
            INSERT INTO attendance (employee_id, date, login_time, portal_check_in, login_lat, login_lng, status, is_late_login, punch_source)
            VALUES ($1, CURRENT_DATE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $2, $3, $4, $5, 'PORTAL')
            RETURNING *;
        `, [employeeId, lat || null, lng || null, status, isLate]);

        await pool.query(`
            INSERT INTO attendance_logs (employee_id, work_date, clock_in, correction_status)
            VALUES ($1, CURRENT_DATE, CURRENT_TIMESTAMP, 'Approved');
        `, [employeeId]);

        res.status(201).json({ success: true, message: "Clocked in successfully", data: result.rows[0] });
    } catch (error) {
        console.log("Error in clockIn:", error.message);
        res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
}

export async function clockOut(req, res) {
    try {
        const employeeId = await getEmployeeId(req.user.id);
        const { lat, lng } = req.body;

        const checkRes = await pool.query(
            "SELECT * FROM attendance WHERE employee_id = $1 AND date = CURRENT_DATE AND logout_time IS NULL;",
            [employeeId]
        );

        if (checkRes.rows.length === 0) {
            return res.status(400).json({ success: false, message: "No active check-in found for today" });
        }

        // Enforce self report check before clock out
        const reportCheck = await pool.query(
            "SELECT id FROM self_reports WHERE employee_id = $1 AND date = CURRENT_DATE;",
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
        const diffMs = logoutTime - loginTime;
        const totalWorkingHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;

        const result = await pool.query(`
            UPDATE attendance 
            SET logout_time = CURRENT_TIMESTAMP, 
                portal_check_out = CURRENT_TIMESTAMP,
                logout_lat = $2, 
                logout_lng = $3, 
                total_working_hours = COALESCE(total_working_hours, 0) + $4,
                punch_source = COALESCE(punch_source, 'PORTAL')
            WHERE employee_id = $1 AND date = CURRENT_DATE AND logout_time IS NULL
            RETURNING *;
        `, [employeeId, lat || null, lng || null, totalWorkingHours]);

        await pool.query(`
            UPDATE attendance_logs 
            SET clock_out = CURRENT_TIMESTAMP 
            WHERE employee_id = $1 AND work_date = CURRENT_DATE AND clock_out IS NULL;
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
        const result = await pool.query(
            "SELECT * FROM attendance WHERE employee_id = $1 ORDER BY date DESC;",
            [employeeId]
        );
        res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        console.log("Error in getAttendanceLogs:", error.message);
        res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
}

export async function getReports(req, res) {
    try {
        const employeeId = await getEmployeeId(req.user.id);
        const selfReports = await pool.query(
            "SELECT * FROM self_reports WHERE employee_id = $1 ORDER BY date DESC;",
            [employeeId]
        );
        const dsrReports = await pool.query(
            "SELECT * FROM dsr_reports WHERE employee_id = $1 ORDER BY id DESC;",
            [employeeId]
        );
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
            VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6)
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

