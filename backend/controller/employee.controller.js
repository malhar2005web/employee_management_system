import { pool } from '../config/db.js';
import bcryptjs from 'bcryptjs';

export async function getEmployees(req, res) {
    try {
        const result = await pool.query(`
            SELECT e.id, e.full_name, e.employee_code, e.status, e.joining_date, e.salary_grade,
                   e.gender, e.phone, e.dob, e.citizenship, e.address, e.perm_address, 
                   e.bank_name, e.bank_acc_no, e.bank_ifsc,
                   e.doc_cv, e.doc_offer_letter, e.doc_adhar_card, e.doc_pan_card,
                   e.anydesk_id, e.whatsapp_no,
                   COALESCE(NULLIF(TRIM(e.workstation), ''), NULLIF(TRIM(e.workplace), ''), 'Mumbai') AS workstation,
                   COALESCE(NULLIF(TRIM(e.workplace), ''), NULLIF(TRIM(e.workstation), ''), 'Mumbai Office') AS workplace,
                   u.id AS user_id, u.email, u.is_active,
                   COALESCE(e.plain_password, u.plain_password, 'Penta@123') AS plain_password,
                   d.name AS department_name, d.id AS department_id,
                   ds.title AS designation_name, ds.id AS designation_id,
                   m.full_name AS manager_name, m.id AS manager_id
            FROM employees e
            LEFT JOIN users u ON e.user_id = u.id
            LEFT JOIN departments d ON e.department_id = d.id
            LEFT JOIN designations ds ON e.designation_id = ds.id
            LEFT JOIN employees m ON e.reporting_manager_id = m.id
            ORDER BY e.id DESC;
        `);

        res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        console.log("Error in getEmployees:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function createEmployee(req, res) {
    const client = await pool.connect();
    try {
        const { 
            fullName, email, employeeCode, password, departmentId, designationId, reportingManagerId, joiningDate, salaryGrade,
            gender, phone, dob, citizenship, address, permAddress, bankName, bankAccNo, bankIfsc,
            docCv, docOfferLetter, docAdharCard, docPanCard,
            anydeskId, whatsappNo
        } = req.body;
        
        if (!fullName || !email || !employeeCode) {
            return res.status(400).json({ success: false, message: "Name, email, and employee code are required" });
        }

        // Check if email already exists
        const emailCheck = await client.query("SELECT id FROM users WHERE email = $1", [email]);
        if (emailCheck.rows.length > 0) {
            return res.status(400).json({ success: false, message: "User with this email already exists" });
        }

        // Check if employee code already exists
        const codeCheck = await client.query("SELECT id FROM employees WHERE employee_code = $1", [employeeCode]);
        if (codeCheck.rows.length > 0) {
            return res.status(400).json({ success: false, message: "Employee code already in use" });
        }

        await client.query("BEGIN");

        const salt = await bcryptjs.genSalt(10);
        const passToHash = (password && password.trim().length >= 6) ? password.trim() : "Welcome@123";
        const hashedPassword = await bcryptjs.hash(passToHash, salt);
        const username = email.split('@')[0];
        const companyId = req.user?.company_id || null;

        // Insert into users
        const userRes = await client.query(
            `INSERT INTO users (username, email, password, plain_password, role, is_active, company_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [username, email, hashedPassword, passToHash, 'Employee', true, companyId]
        );
        const userId = userRes.rows[0].id;

        // Insert into employees
        await client.query(
            `INSERT INTO employees (
                user_id, full_name, employee_code, department_id, designation_id, reporting_manager_id, joining_date, salary_grade, status,
                gender, phone, dob, citizenship, address, perm_address, bank_name, bank_acc_no, bank_ifsc,
                doc_cv, doc_offer_letter, doc_adhar_card, doc_pan_card,
                anydesk_id, whatsapp_no, company_id, plain_password
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)`,
            [
                userId, 
                fullName, 
                employeeCode, 
                departmentId ? parseInt(departmentId, 10) : null, 
                designationId ? parseInt(designationId, 10) : null, 
                reportingManagerId ? parseInt(reportingManagerId, 10) : null, 
                joiningDate || null, 
                salaryGrade || null, 
                'Active',
                gender || 'Male',
                phone || null,
                dob ? dob : null,
                citizenship || null,
                address || null,
                permAddress || null,
                bankName || null,
                bankAccNo || null,
                bankIfsc || null,
                docCv ? (typeof docCv === 'object' ? JSON.stringify(docCv) : docCv) : '{}',
                docOfferLetter ? (typeof docOfferLetter === 'object' ? JSON.stringify(docOfferLetter) : docOfferLetter) : '{}',
                docAdharCard ? (typeof docAdharCard === 'object' ? JSON.stringify(docAdharCard) : docAdharCard) : '{}',
                docPanCard ? (typeof docPanCard === 'object' ? JSON.stringify(docPanCard) : docPanCard) : '{}',
                anydeskId || req.body.anydesk_id || null,
                whatsappNo || req.body.whatsapp_no || null,
                companyId,
                passToHash
            ]
        );

        await client.query("COMMIT");
        res.status(201).json({ success: true, message: "Employee account created successfully" });
    } catch (error) {
        await client.query("ROLLBACK");
        console.log("Error in createEmployee:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    } finally {
        client.release();
    }
}

export async function updateEmployee(req, res) {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { 
            fullName, email, employeeCode, departmentId, designationId, reportingManagerId, joiningDate, salaryGrade,
            gender, phone, dob, citizenship, address, permAddress, bankName, bankAccNo, bankIfsc,
            docCv, docOfferLetter, docAdharCard, docPanCard,
            anydeskId, whatsappNo, password
        } = req.body;

        const empQuery = await client.query("SELECT * FROM employees WHERE id = $1", [id]);
        if (empQuery.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Employee not found" });
        }
        const existingEmp = empQuery.rows[0];
        const userId = existingEmp.user_id;

        await client.query("BEGIN");

        // Update user email if provided
        if (email && userId) {
            await client.query("UPDATE users SET email = $1 WHERE id = $2", [email, userId]);
        }

        // Update user password if provided
        if (password && password.trim().length >= 6 && userId) {
            const salt = await bcryptjs.genSalt(10);
            const hashedPassword = await bcryptjs.hash(password.trim(), salt);
            await client.query("UPDATE users SET password = $1, plain_password = $2 WHERE id = $3", [hashedPassword, password.trim(), userId]);
            await client.query("UPDATE employees SET plain_password = $1 WHERE user_id = $2", [password.trim(), userId]);
        }

        // Preserve documents if not uploaded anew
        const finalDocCv = docCv ? (typeof docCv === 'object' ? JSON.stringify(docCv) : docCv) : existingEmp.doc_cv;
        const finalDocOffer = docOfferLetter ? (typeof docOfferLetter === 'object' ? JSON.stringify(docOfferLetter) : docOfferLetter) : existingEmp.doc_offer_letter;
        const finalDocAdhar = docAdharCard ? (typeof docAdharCard === 'object' ? JSON.stringify(docAdharCard) : docAdharCard) : existingEmp.doc_adhar_card;
        const finalDocPan = docPanCard ? (typeof docPanCard === 'object' ? JSON.stringify(docPanCard) : docPanCard) : existingEmp.doc_pan_card;

        // Parse IDs safely
        const parsedDeptId = (departmentId !== undefined && departmentId !== "" && departmentId !== null) ? parseInt(departmentId, 10) : null;
        const parsedDesigId = (designationId !== undefined && designationId !== "" && designationId !== null) ? parseInt(designationId, 10) : null;
        const parsedManagerId = (reportingManagerId !== undefined && reportingManagerId !== "" && reportingManagerId !== null) ? parseInt(reportingManagerId, 10) : null;

        const locationVal = req.body.workstation || req.body.workplace || req.body.location || null;

        // Update employee details
        await client.query(
            `UPDATE employees 
             SET full_name = $1, employee_code = $2, department_id = $3, designation_id = $4, reporting_manager_id = $5, joining_date = $6, salary_grade = $7,
                 gender = $8, phone = $9, dob = $10, citizenship = $11, address = $12, perm_address = $13, bank_name = $14, bank_acc_no = $15, bank_ifsc = $16,
                 doc_cv = $17, doc_offer_letter = $18, doc_adhar_card = $19, doc_pan_card = $20,
                 anydesk_id = $21, whatsapp_no = $22,
                 workstation = COALESCE($23, workstation),
                 workplace = COALESCE($24, workplace)
             WHERE id = $25`,
            [
                fullName || existingEmp.full_name,
                employeeCode || existingEmp.employee_code,
                parsedDeptId,
                parsedDesigId,
                parsedManagerId,
                joiningDate || null,
                salaryGrade || null,
                gender !== undefined && gender !== null && gender !== '' ? gender : (existingEmp.gender || 'Male'),
                phone || null,
                dob ? dob : null,
                citizenship || null,
                address || null,
                permAddress || null,
                bankName || null,
                bankAccNo || null,
                bankIfsc || null,
                finalDocCv || '{}',
                finalDocOffer || '{}',
                finalDocAdhar || '{}',
                finalDocPan || '{}',
                anydeskId !== undefined ? anydeskId : (req.body.anydesk_id || existingEmp.anydesk_id),
                whatsappNo !== undefined ? whatsappNo : (req.body.whatsapp_no || existingEmp.whatsapp_no),
                locationVal ? locationVal.trim() : null,
                locationVal ? locationVal.trim() : null,
                id
            ]
        );

        await client.query("COMMIT");
        res.status(200).json({ success: true, message: "Employee updated successfully" });
    } catch (error) {
        await client.query("ROLLBACK");
        console.log("Error in updateEmployee:", error.message);
        res.status(500).json({ success: false, message: "Internal server error: " + error.message });
    } finally {
        client.release();
    }
}

export async function toggleEmployeeStatus(req, res) {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { is_active } = req.body; // boolean

        const empQuery = await client.query("SELECT user_id FROM employees WHERE id = $1", [id]);
        if (empQuery.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Employee not found" });
        }
        const userId = empQuery.rows[0].user_id;

        await client.query("BEGIN");

        await client.query("UPDATE users SET is_active = $1 WHERE id = $2", [is_active, userId]);
        
        const statusStr = is_active ? 'Active' : 'Suspended';
        await client.query("UPDATE employees SET status = $1 WHERE id = $2", [statusStr, id]);

        await client.query("COMMIT");
        res.status(200).json({ success: true, message: `Employee status set to ${statusStr}` });
    } catch (error) {
        await client.query("ROLLBACK");
        console.log("Error in toggleEmployeeStatus:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    } finally {
        client.release();
    }
}

export async function getDeptsAndDesigs(req, res) {
    try {
        const depts = await pool.query("SELECT id, name, code, description FROM departments ORDER BY name ASC;");
        const desigs = await pool.query("SELECT id, title, department_id, level FROM designations ORDER BY title ASC;");

        res.status(200).json({
            success: true,
            data: {
                departments: depts.rows,
                designations: desigs.rows
            }
        });
    } catch (error) {
        console.log("Error in getDeptsAndDesigs:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function createDepartment(req, res) {
    try {
        const { name, code, description } = req.body;
        if (!name || !code) {
            return res.status(400).json({ success: false, message: "Name and Code are required" });
        }

        const checkCode = await pool.query("SELECT id FROM departments WHERE code = $1", [code]);
        if (checkCode.rows.length > 0) {
            return res.status(400).json({ success: false, message: "Department code already exists" });
        }

        const insertRes = await pool.query(
            "INSERT INTO departments (name, code, description) VALUES ($1, $2, $3) RETURNING id, name, code, description;",
            [name, code, description || null]
        );

        res.status(201).json({ success: true, message: "Department created successfully", data: insertRes.rows[0] });
    } catch (error) {
        console.log("Error in createDepartment:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function updateDepartment(req, res) {
    try {
        const { id } = req.params;
        const { name, code, description } = req.body;
        if (!name || !code) {
            return res.status(400).json({ success: false, message: "Name and Code are required" });
        }

        const checkCode = await pool.query("SELECT id FROM departments WHERE code = $1 AND id != $2", [code, id]);
        if (checkCode.rows.length > 0) {
            return res.status(400).json({ success: false, message: "Department code already in use" });
        }

        const updateRes = await pool.query(
            "UPDATE departments SET name = $1, code = $2, description = $3 WHERE id = $4 RETURNING id, name, code, description;",
            [name, code.toUpperCase(), description || null, id]
        );

        if (updateRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Department not found" });
        }

        res.status(200).json({ success: true, message: "Department updated successfully", data: updateRes.rows[0] });
    } catch (error) {
        console.log("Error in updateDepartment:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function deleteDepartment(req, res) {
    try {
        const { id } = req.params;
        await pool.query("UPDATE employees SET department_id = NULL WHERE department_id = $1;", [id]);
        await pool.query("DELETE FROM designations WHERE department_id = $1;", [id]);
        await pool.query("DELETE FROM departments WHERE id = $1;", [id]);
        res.status(200).json({ success: true, message: "Department deleted successfully" });
    } catch (error) {
        console.log("Error in deleteDepartment:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function createDesignation(req, res) {
    try {
        const { title, departmentId, level } = req.body;
        if (!title || !departmentId) {
            return res.status(400).json({ success: false, message: "Title and Department ID are required" });
        }

        const insertRes = await pool.query(
            "INSERT INTO designations (title, department_id, level) VALUES ($1, $2, $3) RETURNING id, title, department_id, level;",
            [title, parseInt(departmentId, 10), level ? parseInt(level, 10) : null]
        );

        res.status(201).json({ success: true, message: "Designation created successfully", data: insertRes.rows[0] });
    } catch (error) {
        console.log("Error in createDesignation:", error.message);
        res.status(501).json({ success: false, message: "Internal server error" });
    }
}

export async function updateDesignation(req, res) {
    try {
        const { id } = req.params;
        const { title, departmentId, level } = req.body;
        if (!title || !departmentId) {
            return res.status(400).json({ success: false, message: "Title and Department are required" });
        }

        const updateRes = await pool.query(
            "UPDATE designations SET title = $1, department_id = $2, level = $3 WHERE id = $4 RETURNING id, title, department_id, level;",
            [title, parseInt(departmentId, 10), level ? parseInt(level, 10) : null, id]
        );

        if (updateRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Designation not found" });
        }

        res.status(200).json({ success: true, message: "Designation updated successfully", data: updateRes.rows[0] });
    } catch (error) {
        console.log("Error in updateDesignation:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function deleteDesignation(req, res) {
    try {
        const { id } = req.params;
        await pool.query("UPDATE employees SET designation_id = NULL WHERE designation_id = $1;", [id]);
        await pool.query("DELETE FROM designations WHERE id = $1;", [id]);
        res.status(200).json({ success: true, message: "Designation deleted successfully" });
    } catch (error) {
        console.log("Error in deleteDesignation:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function getDashboardSummary(req, res) {
    try {
        const [
            empRes,
            leaveRes,
            taskRes,
            attRes,
            ticketRes,
            noticeRes,
            custRes,
            sessRes,
            dsrRes,
            selfRes,
            handoverRes
        ] = await Promise.all([
            pool.query("SELECT COUNT(*) FROM employees WHERE status = 'Active' OR status IS NULL OR status = 'active'"),
            pool.query("SELECT COUNT(*) FROM leave_requests WHERE status = 'Pending'"),
            pool.query(`
                SELECT 
                    COUNT(*) as total,
                    COUNT(CASE WHEN status = 'Completed' THEN 1 END) as completed,
                    COUNT(CASE WHEN status = 'In Progress' OR status = 'Pending' OR status = 'Not Started' THEN 1 END) as active,
                    COUNT(CASE WHEN deadline < CURRENT_DATE AND (status IS NULL OR status != 'Completed') THEN 1 END) as overdue
                FROM workflow_tasks
            `),
            pool.query("SELECT COUNT(DISTINCT employee_id) FROM attendance_logs WHERE work_date = CURRENT_DATE"),
            pool.query(`
                SELECT 
                    COUNT(*) as total,
                    COUNT(CASE WHEN status != 'Resolved' AND status != 'Closed' THEN 1 END) as open,
                    COUNT(CASE WHEN priority = 'High' OR priority = 'Urgent' THEN 1 END) as urgent
                FROM support_tickets
            `),
            pool.query("SELECT COUNT(*) FROM notifications WHERE type = 'Announcement'"),
            pool.query("SELECT COUNT(*) FROM customers"),
            pool.query("SELECT COUNT(DISTINCT employee_id) FROM task_sessions WHERE status = 'Running'"),
            pool.query("SELECT COUNT(*) FROM dsr_reports WHERE DATE(created_at) = CURRENT_DATE"),
            pool.query("SELECT COUNT(*) FROM self_reports WHERE date = CURRENT_DATE"),
            pool.query("SELECT COUNT(*) FROM task_transfers WHERE status = 'Pending'")
        ]);

        const totalEmployees = parseInt(empRes.rows[0].count, 10) || 0;
        const activeLeaves = parseInt(leaveRes.rows[0].count, 10) || 0;
        const totalTasks = parseInt(taskRes.rows[0].total, 10) || 0;
        const completedTasks = parseInt(taskRes.rows[0].completed, 10) || 0;
        const activeTasks = parseInt(taskRes.rows[0].active, 10) || 0;
        const overdueTasks = parseInt(taskRes.rows[0].overdue, 10) || 0;
        const projectCompletion = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        const presentToday = parseInt(attRes.rows[0].count, 10) || 0;
        const attendanceRate = totalEmployees > 0 ? Math.round((presentToday / totalEmployees) * 1000) / 10 : 0;

        res.status(200).json({
            success: true,
            totalEmployees,
            activeLeaves,
            projectCompletion,
            attendanceRate,
            presentToday,
            supportTickets: {
                total: parseInt(ticketRes.rows[0].total, 10) || 0,
                open: parseInt(ticketRes.rows[0].open, 10) || 0,
                urgent: parseInt(ticketRes.rows[0].urgent, 10) || 0
            },
            activeNotices: parseInt(noticeRes.rows[0].count, 10) || 0,
            totalCustomers: parseInt(custRes.rows[0].count, 10) || 0,
            tasks: {
                total: totalTasks,
                completed: completedTasks,
                active: activeTasks,
                overdue: overdueTasks
            },
            onlineWorkstations: parseInt(sessRes.rows[0].count, 10) || 0,
            dsrSubmittedToday: (parseInt(dsrRes.rows[0].count, 10) || 0) + (parseInt(selfRes.rows[0].count, 10) || 0),
            pendingHandovers: parseInt(handoverRes.rows[0].count, 10) || 0
        });
    } catch (error) {
        console.error("Error in getDashboardSummary:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function getProductivityTrend(req, res) {
    try {
        const result = await pool.query(`
            SELECT 
                TO_CHAR(work_date, 'YYYY-MM-DD') as date_str,
                ROUND(SUM(productive_seconds)::numeric / 3600, 1) as productive_hours,
                ROUND(SUM(unproductive_seconds)::numeric / 3600, 1) as unproductive_hours,
                ROUND(SUM(idle_seconds)::numeric / 3600, 1) as idle_hours,
                ROUND(SUM(break_seconds)::numeric / 3600, 1) as break_hours
            FROM teramind_activity_cache
            WHERE work_date >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY work_date
            ORDER BY work_date ASC;
        `);

        res.status(200).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error("Error in getProductivityTrend:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}
