import { pool } from '../config/db.js';

export async function getCustomers(req, res) {
    try {
        const { search, industry } = req.query;
        let query = `
            SELECT c.*,
                   COALESCE(
                       JSON_AGG(
                           JSON_BUILD_OBJECT(
                               'id', p.id,
                               'name', p.name,
                               'description', p.description,
                               'branch_name', p.branch_name,
                               'status', p.status
                           )
                       ) FILTER (WHERE p.id IS NOT NULL), '[]'
                   ) AS customer_projects,
                   COALESCE(
                       CASE 
                           WHEN c.assigned_employees IS NOT NULL AND jsonb_array_length(c.assigned_employees) > 0 THEN c.assigned_employees
                           ELSE (
                               SELECT JSONB_AGG(JSONB_BUILD_OBJECT('id', e.id, 'full_name', e.full_name))
                               FROM employees e
                               WHERE e.id IN (
                                   SELECT DISTINCT UNNEST(t.assigned_to)
                                   FROM tasks t
                                   JOIN projects p2 ON t.project_id = p2.id
                                   WHERE p2.customer_id = c.id
                               )
                           )
                       END, '[]'::jsonb
                   ) AS assigned_employees
            FROM customers c
            LEFT JOIN projects p ON c.id = p.customer_id
            WHERE 1=1
        `;
        const values = [];
        let filterCount = 1;

        if (search) {
            query += ` AND (c.name ILIKE $${filterCount} OR c.branch ILIKE $${filterCount})`;
            values.push(`%${search}%`);
            filterCount++;
        }

        if (industry) {
            query += ` AND c.industry = $${filterCount}`;
            values.push(industry);
            filterCount++;
        }

        query += ` GROUP BY c.id ORDER BY c.id DESC;`;

        const result = await pool.query(query, values);
        res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        console.log("Error in getCustomers:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function createCustomer(req, res) {
    const client = await pool.connect();
    try {
        const { name, branches, contactPersons, slaType, slaResponseTime, slaResolutionTime, contractStartDate, contractEndDate, deadline, industry, assigned_employees } = req.body;
        const createdBy = req.user ? req.user.id : null;

        if (!name) {
            return res.status(400).json({ success: false, message: "Customer name is required" });
        }

        await client.query("BEGIN");

        const query = `
            INSERT INTO customers (name, branches, contact_persons, sla_type, sla_response_time, sla_resolution_time, contract_start_date, contract_end_date, deadline, industry, created_by, assigned_employees)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *;
        `;
        const values = [
            name,
            branches ? JSON.stringify(branches) : '[]',
            contactPersons ? JSON.stringify(contactPersons) : null,
            slaType || null,
            slaResponseTime || null,
            slaResolutionTime || null,
            contractStartDate || null,
            contractEndDate || null,
            deadline || null,
            industry || null,
            createdBy,
            assigned_employees ? JSON.stringify(assigned_employees) : '[]'
        ];

        const result = await client.query(query, values);
        const customer = result.rows[0];

        // Insert projects from branches
        if (branches && Array.isArray(branches)) {
            for (const b of branches) {
                if (b.projects && Array.isArray(b.projects)) {
                    for (const p of b.projects) {
                        if (p.name) {
                            await client.query(
                                `INSERT INTO projects (name, description, customer_id, branch_name, status)
                                 VALUES ($1, $2, $3, $4, $5)`,
                                [p.name, p.description || null, customer.id, b.branch || null, 'In Progress']
                            );
                        }
                    }
                }
            }
        }

        // Sync Chat Group & Inbox Notifications for assigned employees
        await syncCustomerAssignmentsAndChat(client, customer, assigned_employees);

        await client.query("COMMIT");
        res.status(201).json({ success: true, message: "Customer created successfully", data: customer });
    } catch (error) {
        await client.query("ROLLBACK");
        console.log("Error in createCustomer:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    } finally {
        client.release();
    }
}

async function syncCustomerAssignmentsAndChat(client, customer, assigned_employees) {
    if (!customer || !customer.id) return;

    let empList = assigned_employees;
    if (typeof empList === 'string') {
        try { empList = JSON.parse(empList); } catch (e) { empList = []; }
    }
    if (!Array.isArray(empList) || empList.length === 0) return;

    // 1. Create or retrieve TaskGroup Chat Channel for this Customer Account / Project
    const channelName = `Project: ${customer.name}`;
    let chanRes = await client.query(
        `SELECT id FROM chat_channels WHERE customer_id = $1 OR name = $2 LIMIT 1`,
        [customer.id, channelName]
    );

    let channelId = null;
    if (chanRes.rows.length > 0) {
        channelId = chanRes.rows[0].id;
        await client.query(
            `UPDATE chat_channels SET name = $1, customer_id = $2 WHERE id = $3`,
            [channelName, customer.id, channelId]
        );
    } else {
        const newChan = await client.query(
            `INSERT INTO chat_channels (channel_type, name, customer_id) VALUES ('TaskGroup', $1, $2) RETURNING id`,
            [channelName, customer.id]
        );
        channelId = newChan.rows[0].id;
    }

    // 2. Add each assigned employee to chat_channel_members & send Inbox notification
    for (const emp of empList) {
        const empId = typeof emp === 'object' ? (emp.id || emp.employee_id) : emp;
        if (!empId) continue;

        // A. Add to Chat Group Members
        await client.query(
            `INSERT INTO chat_channel_members (channel_id, employee_id, role)
             VALUES ($1, $2, 'Member')
             ON CONFLICT (channel_id, employee_id) DO NOTHING`,
            [channelId, empId]
        );

        // B. Push Inbox Notification
        const notifTitle = `Project & Account Assignment`;
        const notifMsg = `You have been added to Customer Project Team: ${customer.name}`;
        await client.query(
            `INSERT INTO notifications (title, message, type, recipient_id, channel_id, created_at)
             VALUES ($1, $2, 'Project Assignment', $3, $4, NOW())`,
            [notifTitle, notifMsg, empId, channelId]
        );
    }
}

export async function updateCustomer(req, res) {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { name, branches, contactPersons, slaType, slaResponseTime, slaResolutionTime, contractStartDate, contractEndDate, deadline, industry, assigned_employees } = req.body;

        if (!name) {
            return res.status(400).json({ success: false, message: "Customer name is required" });
        }

        await client.query("BEGIN");

        const query = `
            UPDATE customers
            SET name = $1, branches = $2, contact_persons = $3, sla_type = $4, sla_response_time = $5, sla_resolution_time = $6, contract_start_date = $7, contract_end_date = $8, deadline = $9, industry = $10, assigned_employees = $11, updated_at = CURRENT_TIMESTAMP
            WHERE id = $12 RETURNING *;
        `;
        const values = [
            name,
            branches ? JSON.stringify(branches) : '[]',
            contactPersons ? JSON.stringify(contactPersons) : null,
            slaType || null,
            slaResponseTime || null,
            slaResolutionTime || null,
            contractStartDate || null,
            contractEndDate || null,
            deadline || null,
            industry || null,
            assigned_employees ? JSON.stringify(assigned_employees) : '[]',
            id
        ];

        const result = await client.query(query, values);
        if (result.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ success: false, message: "Customer not found" });
        }

        const customer = result.rows[0];

        // Gather all submitted projects from branches
        const submittedProjects = [];
        if (branches && Array.isArray(branches)) {
            for (const b of branches) {
                if (b.projects && Array.isArray(b.projects)) {
                    for (const p of b.projects) {
                        if (p.name) {
                            submittedProjects.push({
                                id: p.id || null,
                                name: p.name,
                                description: p.description,
                                branch_name: b.branch
                            });
                        }
                    }
                }
            }
        }

        // Get all current projects for this customer
        const currentProjectsRes = await client.query("SELECT id FROM projects WHERE customer_id = $1", [id]);
        const currentProjectIds = currentProjectsRes.rows.map(row => row.id);

        const submittedProjectIds = [];

        for (const p of submittedProjects) {
            if (p.id) {
                // Update existing
                await client.query(
                    `UPDATE projects 
                     SET name = $1, description = $2, branch_name = $3, updated_at = CURRENT_TIMESTAMP
                     WHERE id = $4 AND customer_id = $5`,
                    [p.name, p.description || null, p.branch_name || null, p.id, id]
                );
                submittedProjectIds.push(parseInt(p.id, 10));
            } else {
                // Insert new
                const newProjRes = await client.query(
                    `INSERT INTO projects (name, description, customer_id, branch_name, status)
                     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
                    [p.name, p.description || null, id, p.branch_name || null, 'In Progress']
                );
                submittedProjectIds.push(newProjRes.rows[0].id);
            }
        }

        // Delete projects not in the submitted list
        const projectsToDelete = currentProjectIds.filter(pid => !submittedProjectIds.includes(pid));
        if (projectsToDelete.length > 0) {
            await client.query("DELETE FROM projects WHERE id = ANY($1)", [projectsToDelete]);
        }

        // Sync Chat Group & Inbox Notifications for assigned employees
        await syncCustomerAssignmentsAndChat(client, customer, assigned_employees);

        await client.query("COMMIT");
        res.status(200).json({ success: true, message: "Customer updated successfully", data: customer });
    } catch (error) {
        await client.query("ROLLBACK");
        console.log("Error in updateCustomer:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    } finally {
        client.release();
    }
}

export async function deleteCustomer(req, res) {
    try {
        const { id } = req.params;
        const result = await pool.query("DELETE FROM customers WHERE id = $1 RETURNING *;", [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Customer not found" });
        }

        res.status(200).json({ success: true, message: "Customer deleted successfully" });
    } catch (error) {
        console.log("Error in deleteCustomer:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}
