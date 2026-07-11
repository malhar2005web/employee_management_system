import { pool } from '../config/db.js';

async function getWorkflowMetadata() {
    const employeesRes = await pool.query(`
        SELECT e.id,
               e.full_name,
               ds.title AS designation,
               d.name AS department_name
        FROM employees e
        LEFT JOIN departments d ON e.department_id = d.id
        LEFT JOIN designations ds ON e.designation_id = ds.id
        WHERE e.status = 'Active' OR e.status = 'active' OR e.status IS NULL
        ORDER BY COALESCE(d.name, 'Other') ASC, e.full_name ASC;
    `);

    const projectsRes = await pool.query(`
        SELECT p.id,
               p.name,
               p.customer_id,
               p.branch_name,
               p.account_manager_id,
               am.full_name AS account_manager_name
        FROM projects p
        LEFT JOIN employees am ON p.account_manager_id = am.id
        ORDER BY p.name ASC;
    `);

    const customersRes = await pool.query(`
        SELECT id, name, branches FROM customers ORDER BY name ASC;
    `);

    return {
        employees: employeesRes.rows,
        projects: projectsRes.rows,
        customers: customersRes.rows
    };
}

function buildWorkflowRows(workflows, teams, tasks) {
    return workflows.map(workflow => {
        const workflowTeams = teams.filter(team => team.workflow_id === workflow.id);
        const workflowTasks = tasks.filter(task => task.workflow_id === workflow.id);
        const overall = workflowTasks.length
            ? Math.round(workflowTasks.reduce((sum, task) => sum + (parseInt(task.completion_percentage, 10) || 0), 0) / workflowTasks.length)
            : 0;

        return {
            ...workflow,
            overall_completion: overall,
            teams: workflowTeams,
            tasks: workflowTasks
        };
    });
}

export async function getWorkflows(req, res) {
    try {
        const metadata = await getWorkflowMetadata();

        const workflowsRes = await pool.query(`
            SELECT w.*,
                   c.name AS customer_name,
                   p.name AS project_name,
                   am.full_name AS account_manager_name
            FROM workflows w
            LEFT JOIN customers c ON w.customer_id = c.id
            LEFT JOIN projects p ON w.project_id = p.id
            LEFT JOIN employees am ON w.account_manager_id = am.id
            ORDER BY w.id DESC;
        `);

        const teamsRes = await pool.query(`
            SELECT wt.*, e.full_name AS lead_name
            FROM workflow_teams wt
            LEFT JOIN employees e ON wt.lead_id = e.id
            ORDER BY wt.id ASC;
        `);

        const tasksRes = await pool.query(`
            SELECT wt.*, team.name AS assigned_team_name
            FROM workflow_tasks wt
            LEFT JOIN workflow_teams team ON wt.assigned_team_id = team.id
            ORDER BY wt.step_order ASC, wt.id ASC;
        `);

        res.status(200).json({
            success: true,
            data: {
                ...metadata,
                workflows: buildWorkflowRows(workflowsRes.rows, teamsRes.rows, tasksRes.rows)
            }
        });
    } catch (error) {
        console.log("Error in getWorkflows:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function createWorkflow(req, res) {
    const client = await pool.connect();
    try {
        const {
            name,
            customerId,
            branchName,
            projectId,
            accountManagerId,
            description,
            startDate,
            targetCompletion,
            priority,
            status,
            teams,
            tasks
        } = req.body;

        if (!name || !projectId) {
            return res.status(400).json({ success: false, message: "Workflow name and project are required" });
        }

        await client.query("BEGIN");

        const workflowRes = await client.query(`
            INSERT INTO workflows (
                name, customer_id, branch_name, project_id, account_manager_id,
                description, start_date, target_completion, priority, status, created_by
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
            RETURNING *;
        `, [
            name,
            customerId ? parseInt(customerId, 10) : null,
            branchName || null,
            parseInt(projectId, 10),
            accountManagerId ? parseInt(accountManagerId, 10) : null,
            description || null,
            startDate || null,
            targetCompletion || null,
            priority || 'Medium',
            status || 'Planning',
            req.user ? req.user.id : null
        ]);

        const workflow = workflowRes.rows[0];
        const tempTeamMap = new Map();

        if (Array.isArray(teams)) {
            for (const team of teams) {
                if (!team.name) continue;
                const teamRes = await client.query(`
                    INSERT INTO workflow_teams (workflow_id, name, lead_id, member_ids)
                    VALUES ($1,$2,$3,$4)
                    RETURNING *;
                `, [
                    workflow.id,
                    team.name,
                    team.leadId ? parseInt(team.leadId, 10) : null,
                    Array.isArray(team.memberIds) ? team.memberIds.map(id => parseInt(id, 10)) : []
                ]);
                tempTeamMap.set(team.tempId || team.name, teamRes.rows[0].id);
            }
        }

        const tempTaskMap = new Map();
        if (Array.isArray(tasks)) {
            for (const task of tasks) {
                if (!task.name) continue;
                const assignedTeamId = task.teamTempId ? tempTeamMap.get(task.teamTempId) : null;
                const taskRes = await client.query(`
                    INSERT INTO workflow_tasks (
                        workflow_id, step_order, name, assigned_team_id, assigned_employee_ids,
                        estimated_hours, deadline, status, priority, dependencies, completion_percentage,
                        status_history
                    )
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, jsonb_build_array(jsonb_build_object('status', $8::text, 'changed_at', NOW()::text)))
                    RETURNING *;
                `, [
                    workflow.id,
                    task.stepOrder ? parseInt(task.stepOrder, 10) : 1,
                    task.name,
                    assignedTeamId || null,
                    Array.isArray(task.assignedEmployeeIds) ? task.assignedEmployeeIds.map(id => parseInt(id, 10)) : [],
                    task.estimatedHours ? parseFloat(task.estimatedHours) : null,
                    task.deadline || null,
                    task.status || 'Not Started',
                    task.priority || 'Medium',
                    [],
                    task.completionPercentage ? parseInt(task.completionPercentage, 10) : 0
                ]);
                tempTaskMap.set(task.tempId || task.name, taskRes.rows[0].id);
            }

            for (const task of tasks) {
                const savedTaskId = tempTaskMap.get(task.tempId || task.name);
                if (!savedTaskId) continue;
                const dependencyIds = Array.isArray(task.dependencies)
                    ? task.dependencies.map(dep => tempTaskMap.get(dep)).filter(Boolean)
                    : [];
                await client.query(
                    "UPDATE workflow_tasks SET dependencies = $1 WHERE id = $2;",
                    [dependencyIds, savedTaskId]
                );
            }
        }

        if (projectId) {
            await client.query(
                "UPDATE projects SET account_manager_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;",
                [accountManagerId ? parseInt(accountManagerId, 10) : null, parseInt(projectId, 10)]
            );
        }

        await client.query("COMMIT");
        res.status(201).json({ success: true, message: "Workflow created successfully", data: workflow });
    } catch (error) {
        await client.query("ROLLBACK");
        console.log("Error in createWorkflow:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    } finally {
        client.release();
    }
}

// ─── Update overall workflow status ───────────────────────────────────────────
export async function updateWorkflowStatus(req, res) {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const allowed = ['Planning', 'In Progress', 'On Hold', 'Completed'];
        if (!status || !allowed.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status value' });
        }
        const result = await pool.query(
            'UPDATE workflows SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, status;',
            [status, parseInt(id, 10)]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Workflow not found' });
        }
        res.status(200).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.log('Error in updateWorkflowStatus:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

// ─── Update individual workflow task status ───────────────────────────────────
export async function updateWorkflowTaskStatus(req, res) {
    try {
        const { id, taskId } = req.params;
        const { status } = req.body;
        const allowed = ['Not Started', 'In Progress', 'Completed', 'Blocked'];
        if (!status || !allowed.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status value' });
        }
        const completionPercentage = status === 'Completed' ? 100 : undefined;
        const result = await pool.query(
            `UPDATE workflow_tasks
             SET status = $1::varchar,
                 status_history = COALESCE(status_history, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('status', $1::varchar, 'changed_at', NOW()::text))::jsonb
                 ${completionPercentage !== undefined ? ', completion_percentage = $3' : ''}
             WHERE id = $2 AND workflow_id = ${completionPercentage !== undefined ? '$4' : '$3'}
             RETURNING id, status, completion_percentage, status_history;`,
            completionPercentage !== undefined
                ? [status, parseInt(taskId, 10), completionPercentage, parseInt(id, 10)]
                : [status, parseInt(taskId, 10), parseInt(id, 10)]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Task not found' });
        }
        res.status(200).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.log('Error in updateWorkflowTaskStatus:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

// ─── Delete a workflow (cascade handled by DB FK or done manually) ────────────
export async function deleteWorkflow(req, res) {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        await client.query('BEGIN');
        await client.query('DELETE FROM workflow_tasks WHERE workflow_id = $1;', [parseInt(id, 10)]);
        await client.query('DELETE FROM workflow_teams WHERE workflow_id = $1;', [parseInt(id, 10)]);
        const result = await client.query('DELETE FROM workflows WHERE id = $1 RETURNING id;', [parseInt(id, 10)]);
        if (result.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Workflow not found' });
        }
        await client.query('COMMIT');
        res.status(200).json({ success: true, message: 'Workflow deleted successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.log('Error in deleteWorkflow:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    } finally {
        client.release();
    }
}


export async function getTasks(req, res) {
    try {
        const tasksRes = await pool.query(`
            SELECT t.*, p.name AS project_name, c.name AS customer_name, m.full_name AS manager_name
            FROM tasks t
            LEFT JOIN projects p ON t.project_id = p.id
            LEFT JOIN customers c ON t.customer_id = c.id
            LEFT JOIN employees m ON t.task_manager_id = m.id
            ORDER BY t.id DESC;
        `);

        const templatesRes = await pool.query(`
            SELECT * FROM task_templates ORDER BY id DESC;
        `);

        // Metadata for dropdowns
        const employeesRes = await pool.query(`
            SELECT e.id,
                   e.full_name,
                   ds.title AS designation,
                   d.name AS department_name
            FROM employees e
            LEFT JOIN departments d ON e.department_id = d.id
            LEFT JOIN designations ds ON e.designation_id = ds.id
            WHERE e.status = 'Active' OR e.status = 'active' OR e.status IS NULL
            ORDER BY COALESCE(d.name, 'Other') ASC, e.full_name ASC;
        `);

        const projectsRes = await pool.query(`
            SELECT p.id,
                   p.name,
                   p.customer_id,
                   p.branch_name,
                   p.account_manager_id,
                   am.full_name AS account_manager_name
            FROM projects p
            LEFT JOIN employees am ON p.account_manager_id = am.id
            ORDER BY p.name ASC;
        `);

        const customersRes = await pool.query(`
            SELECT id, name, branches FROM customers ORDER BY name ASC;
        `);

        res.status(200).json({
            success: true,
            data: {
                tasks: tasksRes.rows,
                templates: templatesRes.rows,
                employees: employeesRes.rows,
                projects: projectsRes.rows,
                customers: customersRes.rows
            }
        });
    } catch (error) {
        console.log("Error in getTasks:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function createTask(req, res) {
    try {
        const { title, description, assignedTo, projectId, customerId, dueDate, priority, status, estimatedHours, dependencies, taskManagerId, accountManagerId } = req.body;
        const assignedBy = req.user ? req.user.id : null;

        if (!title) {
            return res.status(400).json({ success: false, message: "Task title is required" });
        }

        const query = `
            INSERT INTO tasks (title, description, assigned_to, assigned_by, project_id, customer_id, due_date, priority, status, estimated_hours, dependencies, completion_percentage, task_manager_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *;
        `;
        const values = [
            title,
            description || null,
            assignedTo || [], // integer array
            assignedBy,
            projectId ? parseInt(projectId, 10) : null,
            customerId ? parseInt(customerId, 10) : null,
            dueDate || null,
            priority || 'Medium',
            status || 'To Do',
            estimatedHours ? parseFloat(estimatedHours) : null,
            dependencies || [], // integer array
            0,
            taskManagerId ? parseInt(taskManagerId, 10) : null
        ];

        const result = await pool.query(query, values);
        if (projectId && accountManagerId) {
            await pool.query(
                "UPDATE projects SET account_manager_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;",
                [parseInt(accountManagerId, 10), parseInt(projectId, 10)]
            );
        }
        res.status(201).json({ success: true, message: "Task created successfully", data: result.rows[0] });
    } catch (error) {
        console.log("Error in createTask:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function updateTask(req, res) {
    try {
        const { id } = req.params;
        const { title, description, assignedTo, projectId, customerId, dueDate, priority, status, estimatedHours, dependencies, completionPercentage, taskManagerId, accountManagerId } = req.body;

        if (!title) {
            return res.status(400).json({ success: false, message: "Task title is required" });
        }

        const query = `
            UPDATE tasks
            SET title = $1, description = $2, assigned_to = $3, project_id = $4, customer_id = $5, due_date = $6, priority = $7, status = $8, estimated_hours = $9, dependencies = $10, completion_percentage = $11, task_manager_id = $12, updated_at = CURRENT_TIMESTAMP
            WHERE id = $13 RETURNING *;
        `;
        const values = [
            title,
            description || null,
            assignedTo || [],
            projectId ? parseInt(projectId, 10) : null,
            customerId ? parseInt(customerId, 10) : null,
            dueDate || null,
            priority || 'Medium',
            status || 'To Do',
            estimatedHours ? parseFloat(estimatedHours) : null,
            dependencies || [],
            completionPercentage ? parseInt(completionPercentage, 10) : 0,
            taskManagerId ? parseInt(taskManagerId, 10) : null,
            id
        ];

        const result = await pool.query(query, values);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Task not found" });
        }
        if (projectId) {
            await pool.query(
                "UPDATE projects SET account_manager_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;",
                [accountManagerId ? parseInt(accountManagerId, 10) : null, parseInt(projectId, 10)]
            );
        }

        res.status(200).json({ success: true, message: "Task updated successfully", data: result.rows[0] });
    } catch (error) {
        console.log("Error in updateTask:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function deleteTask(req, res) {
    try {
        const { id } = req.params;
        const result = await pool.query("DELETE FROM tasks WHERE id = $1 RETURNING *;", [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Task not found" });
        }
        res.status(200).json({ success: true, message: "Task deleted successfully" });
    } catch (error) {
        console.log("Error in deleteTask:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function forwardTask(req, res) {
    try {
        const { id } = req.params;
        const { assignedTo } = req.body; // array of employee IDs

        if (!assignedTo || !Array.isArray(assignedTo)) {
            return res.status(400).json({ success: false, message: "Assigned employee list is required" });
        }

        const query = `
            UPDATE tasks
            SET assigned_to = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2 RETURNING *;
        `;
        const result = await pool.query(query, [assignedTo, id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Task not found" });
        }

        res.status(200).json({ success: true, message: "Task forwarded successfully", data: result.rows[0] });
    } catch (error) {
        console.log("Error in forwardTask:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function approveTask(req, res) {
    try {
        const { id } = req.params;
        const approvedBy = req.user ? req.user.id : null;

        const query = `
            UPDATE tasks
            SET status = 'Completed', completion_percentage = 100, approved_by = $1, approval_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2 RETURNING *;
        `;
        const result = await pool.query(query, [approvedBy, id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Task not found" });
        }

        res.status(200).json({ success: true, message: "Task completion approved successfully", data: result.rows[0] });
    } catch (error) {
        console.log("Error in approveTask:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function createTemplate(req, res) {
    try {
        const { title, description, frequency, cronExpression, assignedTo, priority, estimatedHours } = req.body;
        const createdBy = req.user ? req.user.id : null;

        if (!title || !frequency) {
            return res.status(400).json({ success: false, message: "Title and frequency are required" });
        }

        const query = `
            INSERT INTO task_templates (title, description, frequency, cron_expression, assigned_to, priority, estimated_hours, is_active, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *;
        `;
        const values = [
            title,
            description || null,
            frequency,
            cronExpression || null,
            assignedTo || [],
            priority || 'Medium',
            estimatedHours ? parseFloat(estimatedHours) : null,
            true,
            createdBy
        ];

        const result = await pool.query(query, values);
        res.status(201).json({ success: true, message: "Task template created successfully", data: result.rows[0] });
    } catch (error) {
        console.log("Error in createTemplate:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}
