import { pool } from '../config/db.js';

export async function getSelfReports(req, res) {
    try {
        const result = await pool.query(`
            SELECT sr.*, e.full_name, e.employee_code
            FROM self_reports sr
            LEFT JOIN employees e ON sr.employee_id = e.id
            ORDER BY sr.date DESC, sr.id DESC;
        `);
        res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        console.log("Error in getSelfReports:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function getFieldVisits(req, res) {
    try {
        const result = await pool.query(`
            SELECT dr.*, e.full_name, e.employee_code
            FROM dsr_reports dr
            LEFT JOIN employees e ON dr.employee_id = e.id
            ORDER BY dr.created_at DESC, dr.id DESC;
        `);
        res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        console.log("Error in getFieldVisits:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function generateCustomReport(req, res) {
    try {
        const { employeeId, startDate, endDate, type } = req.query;

        if (!type) {
            return res.status(400).json({ success: false, message: "Report type is required" });
        }

        let query = "";
        let values = [];
        let paramCount = 1;

        if (type === 'attendance') {
            query = `
                SELECT a.*, e.full_name, e.employee_code 
                FROM attendance a
                LEFT JOIN employees e ON a.employee_id = e.id
                WHERE 1=1
            `;
            if (employeeId) {
                query += ` AND a.employee_id = $${paramCount++}`;
                values.push(parseInt(employeeId, 10));
            }
            if (startDate) {
                query += ` AND a.date >= $${paramCount++}`;
                values.push(startDate);
            }
            if (endDate) {
                query += ` AND a.date <= $${paramCount++}`;
                values.push(endDate);
            }
            query += " ORDER BY a.date DESC;";
        } else if (type === 'leave') {
            query = `
                SELECT lr.*, e.full_name, e.employee_code 
                FROM leave_requests lr
                LEFT JOIN employees e ON lr.employee_id = e.id
                WHERE 1=1
            `;
            if (employeeId) {
                query += ` AND lr.employee_id = $${paramCount++}`;
                values.push(parseInt(employeeId, 10));
            }
            if (startDate) {
                query += ` AND lr.start_date >= $${paramCount++}`;
                values.push(startDate);
            }
            if (endDate) {
                query += ` AND lr.end_date <= $${paramCount++}`;
                values.push(endDate);
            }
            query += " ORDER BY lr.start_date DESC;";
        } else if (type === 'timesheet') {
            query = `
                SELECT t.*, e.full_name, e.employee_code 
                FROM timesheets t
                LEFT JOIN employees e ON t.employee_id = e.id
                WHERE 1=1
            `;
            if (employeeId) {
                query += ` AND t.employee_id = $${paramCount++}`;
                values.push(parseInt(employeeId, 10));
            }
            if (startDate) {
                query += ` AND t.date >= $${paramCount++}`;
                values.push(startDate);
            }
            if (endDate) {
                query += ` AND t.date <= $${paramCount++}`;
                values.push(endDate);
            }
            query += " ORDER BY t.date DESC;";
        } else if (type === 'self-report') {
            query = `
                SELECT sr.*, e.full_name, e.employee_code 
                FROM self_reports sr
                LEFT JOIN employees e ON sr.employee_id = e.id
                WHERE 1=1
            `;
            if (employeeId) {
                query += ` AND sr.employee_id = $${paramCount++}`;
                values.push(parseInt(employeeId, 10));
            }
            if (startDate) {
                query += ` AND sr.date >= $${paramCount++}`;
                values.push(startDate);
            }
            if (endDate) {
                query += ` AND sr.date <= $${paramCount++}`;
                values.push(endDate);
            }
            query += " ORDER BY sr.date DESC;";
        } else {
            return res.status(400).json({ success: false, message: "Invalid report type specified" });
        }

        const result = await pool.query(query, values);
        res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        console.log("Error in generateCustomReport:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function exportModuleCSV(req, res) {
    try {
        const { module = 'employees' } = req.query;
        let query = "";
        let filename = `${module}_Export_${new Date().toISOString().split('T')[0]}.csv`;

        if (module === 'employees' || module === 'organization') {
            query = `SELECT e.employee_code, e.full_name, e.email, e.status, e.phone, e.whatsapp_no, e.anydesk_id, d.name as department_name, des.title as designation_title FROM employees e LEFT JOIN departments d ON e.department_id = d.id LEFT JOIN designations des ON e.designation_id = des.id ORDER BY e.id DESC;`;
        } else if (module === 'customers') {
            query = `SELECT c.company_name, c.branches_gst, c.projects_modules, c.contact_persons, c.sla_contract_settings, c.deadline, c.industry, c.assigned_team FROM customers c ORDER BY c.id DESC;`;
        } else if (module === 'tasks' || module === 'audit_logs') {
            query = `SELECT t.title as workflow_name, c.company_name as customer, t.project_module, t.account_manager, t.teams, t.progress, t.target_completion, t.status FROM tasks t LEFT JOIN customers c ON t.customer_id = c.id ORDER BY t.id DESC;`;
        } else if (module === 'attendance') {
            query = `SELECT a.date, e.full_name, e.employee_code, a.check_in, a.check_out, a.status FROM attendance a LEFT JOIN employees e ON a.employee_id = e.id ORDER BY a.date DESC;`;
        } else if (module === 'monitoring' || module === 'workstations') {
            query = `SELECT c.computer_name, c.os, c.user_name, c.is_online, c.agent_status, c.last_seen FROM teramind_computer_cache c ORDER BY c.id DESC;`;
        } else {
            query = `SELECT e.employee_code, e.full_name, e.email, e.status FROM employees e ORDER BY e.id DESC;`;
        }

        const result = await pool.query(query);
        const rows = result.rows;

        if (!rows || rows.length === 0) {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            return res.status(200).send("No records found");
        }

        const headers = Object.keys(rows[0]);
        const csvLines = [];
        csvLines.push(headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(','));

        rows.forEach(r => {
            const line = headers.map(h => `"${String(r[h] !== null && r[h] !== undefined ? r[h] : '').replace(/"/g, '""')}"`).join(',');
            csvLines.push(line);
        });

        const csvContent = "\ufeff" + csvLines.join('\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.status(200).send(csvContent);
    } catch (error) {
        console.log("Error in exportModuleCSV:", error.message);
        res.status(500).json({ success: false, message: "Error exporting CSV" });
    }
}
