import { pool } from '../config/db.js';

export async function getDirectory(req, res) {
    try {
        const { search, departmentId } = req.query;
        let query = `
            SELECT e.id, e.full_name, e.employee_code, e.status, e.joining_date, e.skills, e.whatsapp_no, e.anydesk_id,
                   e.phone, e.dob, e.citizenship, e.address, e.perm_address, 
                   e.bank_name, e.bank_acc_no, e.bank_ifsc,
                   e.doc_cv, e.doc_offer_letter, e.doc_adhar_card, e.doc_pan_card,
                   e.salary_grade, e.department_id, e.designation_id, e.reporting_manager_id,
                   u.email,
                   d.name AS department_name,
                   ds.title AS designation_name,
                   m.full_name AS manager_name
            FROM employees e
            LEFT JOIN users u ON e.user_id = u.id
            LEFT JOIN departments d ON e.department_id = d.id
            LEFT JOIN designations ds ON e.designation_id = ds.id
            LEFT JOIN employees m ON e.reporting_manager_id = m.id
            WHERE u.is_active = true
        `;

        const values = [];
        let filterCount = 1;

        if (search) {
            query += ` AND (e.full_name ILIKE $${filterCount} OR e.employee_code ILIKE $${filterCount} OR ds.title ILIKE $${filterCount})`;
            values.push(`%${search}%`);
            filterCount++;
        }

        if (departmentId) {
            query += ` AND e.department_id = $${filterCount}`;
            values.push(parseInt(departmentId, 10));
            filterCount++;
        }

        query += ` ORDER BY e.full_name ASC;`;

        const result = await pool.query(query, values);
        
        // Also fetch all departments to populate filter dropdowns
        const deptsResult = await pool.query("SELECT id, name FROM departments ORDER BY name ASC;");

        res.status(200).json({
            success: true,
            data: {
                employees: result.rows,
                departments: deptsResult.rows
            }
        });
    } catch (error) {
        console.log("Error in getDirectory:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function getOrgChart(req, res) {
    try {
        const query = `
            SELECT e.id, e.full_name, e.reporting_manager_id,
                   ds.title AS designation_name,
                   d.name AS department_name
            FROM employees e
            LEFT JOIN designations ds ON e.designation_id = ds.id
            LEFT JOIN departments d ON e.department_id = d.id
            WHERE e.status = 'Active' OR e.status IS NULL OR e.status = 'active'
            ORDER BY e.reporting_manager_id NULLS FIRST, e.full_name ASC;
        `;
        const result = await pool.query(query);

        res.status(200).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.log("Error in getOrgChart:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}
