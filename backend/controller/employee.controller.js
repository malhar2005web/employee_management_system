import { pool } from '../config/db.js';
import bcryptjs from 'bcryptjs';

export async function getEmployees(req, res) {
    try {
        const result = await pool.query(`
            SELECT e.id, e.full_name, e.employee_code, e.status, e.joining_date, e.salary_grade,
                   e.phone, e.dob, e.citizenship, e.address, e.perm_address, 
                   e.bank_name, e.bank_acc_no, e.bank_ifsc,
                   e.doc_cv, e.doc_offer_letter, e.doc_adhar_card, e.doc_pan_card,
                   u.id AS user_id, u.email, u.is_active,
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
            fullName, email, employeeCode, departmentId, designationId, reportingManagerId, joiningDate, salaryGrade,
            phone, dob, citizenship, address, permAddress, bankName, bankAccNo, bankIfsc,
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
        const hashedPassword = await bcryptjs.hash("Welcome@123", salt);
        const username = email.split('@')[0];

        // Insert into users
        const userRes = await client.query(
            `INSERT INTO users (username, email, password, role, is_active)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [username, email, hashedPassword, 'Employee', true]
        );
        const userId = userRes.rows[0].id;

        // Insert into employees
        await client.query(
            `INSERT INTO employees (
                user_id, full_name, employee_code, department_id, designation_id, reporting_manager_id, joining_date, salary_grade, status,
                phone, dob, citizenship, address, perm_address, bank_name, bank_acc_no, bank_ifsc,
                doc_cv, doc_offer_letter, doc_adhar_card, doc_pan_card,
                anydesk_id, whatsapp_no
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)`,
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
                whatsappNo || req.body.whatsapp_no || null
            ]
        );

        await client.query("COMMIT");
        res.status(201).json({ success: true, message: "Employee created successfully with default password: Welcome@123" });
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
            phone, dob, citizenship, address, permAddress, bankName, bankAccNo, bankIfsc,
            docCv, docOfferLetter, docAdharCard, docPanCard,
            anydeskId, whatsappNo
        } = req.body;

        const empQuery = await client.query("SELECT user_id FROM employees WHERE id = $1", [id]);
        if (empQuery.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Employee not found" });
        }
        const userId = empQuery.rows[0].user_id;

        await client.query("BEGIN");

        // Update user email
        await client.query("UPDATE users SET email = $1 WHERE id = $2", [email, userId]);

        // Update employee details
        await client.query(
            `UPDATE employees 
             SET full_name = $1, employee_code = $2, department_id = $3, designation_id = $4, reporting_manager_id = $5, joining_date = $6, salary_grade = $7,
                 phone = $8, dob = $9, citizenship = $10, address = $11, perm_address = $12, bank_name = $13, bank_acc_no = $14, bank_ifsc = $15,
                 doc_cv = $16, doc_offer_letter = $17, doc_adhar_card = $18, doc_pan_card = $19,
                 anydesk_id = $20, whatsapp_no = $21
             WHERE id = $22`,
            [
                fullName,
                employeeCode,
                departmentId ? parseInt(departmentId, 10) : null,
                designationId ? parseInt(designationId, 10) : null,
                reportingManagerId ? parseInt(reportingManagerId, 10) : null,
                joiningDate || null,
                salaryGrade || null,
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
                id
            ]
        );

        await client.query("COMMIT");
        res.status(200).json({ success: true, message: "Employee updated successfully" });
    } catch (error) {
        await client.query("ROLLBACK");
        console.log("Error in updateEmployee:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
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
        const depts = await pool.query("SELECT id, name, code FROM departments ORDER BY name ASC;");
        const desigs = await pool.query("SELECT id, title, department_id FROM designations ORDER BY title ASC;");

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

        await pool.query(
            "INSERT INTO departments (name, code, description) VALUES ($1, $2, $3);",
            [name, code, description || null]
        );

        res.status(201).json({ success: true, message: "Department created successfully" });
    } catch (error) {
        console.log("Error in createDepartment:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function createDesignation(req, res) {
    try {
        const { title, departmentId, level } = req.body;
        if (!title || !departmentId) {
            return res.status(400).json({ success: false, message: "Title and Department ID are required" });
        }

        await pool.query(
            "INSERT INTO designations (title, department_id, level) VALUES ($1, $2, $3);",
            [title, parseInt(departmentId, 10), level ? parseInt(level, 10) : null]
        );

        res.status(201).json({ success: true, message: "Designation created successfully" });
    } catch (error) {
        console.log("Error in createDesignation:", error.message);
        res.status(501).json({ success: false, message: "Internal server error" });
    }
}

export async function getDashboardSummary(req, res) {
    try {
        // 1. Count actual employees
        const empCountRes = await pool.query("SELECT COUNT(*) FROM employees");
        const totalEmployees = parseInt(empCountRes.rows[0].count, 10);

        // 2. Count active leaves (Pending approval)
        const leaveCountRes = await pool.query("SELECT COUNT(*) FROM leave_requests WHERE status = 'Pending'");
        const activeLeaves = parseInt(leaveCountRes.rows[0].count, 10);

        // 3. Count total and completed workflow tasks to calculate progress rate
        const taskStatsRes = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN status = 'Completed' THEN 1 END) as completed
            FROM workflow_tasks
        `);
        const totalTasks = parseInt(taskStatsRes.rows[0].total, 10);
        const completedTasks = parseInt(taskStatsRes.rows[0].completed, 10);
        const projectCompletion = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        // 4. Attendance rate today (default to 100% if no employees exist, or calculate: present / total)
        let attendanceRate = 100.0;
        if (totalEmployees > 0) {
            const attendanceTodayRes = await pool.query(`
                SELECT COUNT(DISTINCT employee_id) 
                FROM attendance_logs 
                WHERE work_date = CURRENT_DATE
            `);
            const presentToday = parseInt(attendanceTodayRes.rows[0].count, 10);
            attendanceRate = Math.round((presentToday / totalEmployees) * 1000) / 10;
        }

        res.status(200).json({
            success: true,
            totalEmployees,
            activeLeaves,
            projectCompletion,
            attendanceRate
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
