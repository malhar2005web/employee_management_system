import { pool } from '../config/db.js';

export async function getProjects(req, res) {
    try {
        const result = await pool.query(`
            SELECT p.id, p.name, p.description, p.milestones, p.timeline, p.status, p.created_at,
                   COALESCE(
                       JSON_AGG(
                           JSON_BUILD_OBJECT(
                               'member_id', pm.id,
                               'employee_id', pm.employee_id,
                               'full_name', e.full_name,
                               'role', pm.role
                           )
                       ) FILTER (WHERE pm.id IS NOT NULL), '[]'
                   ) AS members
            FROM projects p
            LEFT JOIN project_members pm ON p.id = pm.project_id
            LEFT JOIN employees e ON pm.employee_id = e.id
            GROUP BY p.id
            ORDER BY p.id DESC;
        `);

        // Also fetch active employees list for assigning members dropdown
        const employeesResult = await pool.query(
            "SELECT id, full_name FROM employees WHERE status = 'Active' OR status IS NULL OR status = 'active' ORDER BY full_name ASC;"
        );

        res.status(200).json({
            success: true,
            data: {
                projects: result.rows,
                employees: employeesResult.rows
            }
        });
    } catch (error) {
        console.log("Error in getProjects:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function createProject(req, res) {
    const client = await pool.connect();
    try {
        const { name, description, milestones, timeline, status, members } = req.body;
        
        if (!name) {
            return res.status(400).json({ success: false, message: "Project name is required" });
        }

        await client.query("BEGIN");

        const projectRes = await client.query(
            `INSERT INTO projects (name, description, milestones, timeline, status)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [
                name, 
                description || null, 
                milestones ? JSON.stringify(milestones) : '[]', 
                timeline ? JSON.stringify(timeline) : '{}', 
                status || 'In Progress'
            ]
        );
        const projectId = projectRes.rows[0].id;

        if (members && Array.isArray(members)) {
            for (const m of members) {
                if (m.employeeId) {
                    await client.query(
                        `INSERT INTO project_members (project_id, employee_id, role)
                         VALUES ($1, $2, $3)`,
                        [projectId, parseInt(m.employeeId, 10), m.role || 'Member']
                    );
                }
            }
        }

        await client.query("COMMIT");
        res.status(201).json({ success: true, message: "Project created successfully", projectId });
    } catch (error) {
        await client.query("ROLLBACK");
        console.log("Error in createProject:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    } finally {
        client.release();
    }
}

export async function updateProject(req, res) {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { name, description, milestones, timeline, status, members } = req.body;

        if (!name) {
            return res.status(400).json({ success: false, message: "Project name is required" });
        }

        const checkProject = await client.query("SELECT id FROM projects WHERE id = $1", [id]);
        if (checkProject.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Project not found" });
        }

        await client.query("BEGIN");

        await client.query(
            `UPDATE projects
             SET name = $1, description = $2, milestones = $3, timeline = $4, status = $5, updated_at = CURRENT_TIMESTAMP
             WHERE id = $6`,
            [
                name,
                description || null,
                milestones ? JSON.stringify(milestones) : '[]',
                timeline ? JSON.stringify(timeline) : '{}',
                status || 'In Progress',
                id
            ]
        );

        // Sync members
        await client.query("DELETE FROM project_members WHERE project_id = $1", [id]);

        if (members && Array.isArray(members)) {
            for (const m of members) {
                if (m.employeeId) {
                    await client.query(
                        `INSERT INTO project_members (project_id, employee_id, role)
                         VALUES ($1, $2, $3)`,
                        [id, parseInt(m.employeeId, 10), m.role || 'Member']
                    );
                }
            }
        }

        await client.query("COMMIT");
        res.status(200).json({ success: true, message: "Project updated successfully" });
    } catch (error) {
        await client.query("ROLLBACK");
        console.log("Error in updateProject:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    } finally {
        client.release();
    }
}

export async function deleteProject(req, res) {
    try {
        const { id } = req.params;
        const result = await pool.query("DELETE FROM projects WHERE id = $1 RETURNING *;", [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Project not found" });
        }

        res.status(200).json({ success: true, message: "Project deleted successfully" });
    } catch (error) {
        console.log("Error in deleteProject:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}
