import { pool } from '../config/db.js';

export async function getGoals(req, res) {
    try {
        const goalsResult = await pool.query(`
            SELECT g.*, e.full_name, e.employee_code
            FROM goals g
            LEFT JOIN employees e ON g.employee_id = e.id
            ORDER BY g.id DESC;
        `);

        const goals = goalsResult.rows;

        // For each goal, fetch task completion stats for that employee
        for (let g of goals) {
            const taskStats = await pool.query(`
                SELECT 
                    COUNT(*) as total,
                    COUNT(CASE WHEN status = 'Completed' THEN 1 END) as completed
                FROM tasks
                WHERE $1 = ANY(assigned_to)
            `, [g.employee_id]);

            const total = parseInt(taskStats.rows[0].total, 10) || 0;
            const completed = parseInt(taskStats.rows[0].completed, 10) || 0;

            let target = parseFloat(g.target_value) || 0;
            let actual = completed;
            let percent = 0;

            if (target > 0) {
                percent = Math.min(100, Math.round((actual / target) * 100));
            } else if (total > 0) {
                target = total;
                percent = Math.round((completed / total) * 100);
            }

            g.target_value = target;
            g.actual_value = actual;
            g.percentage_achieved = percent;
            
            // Auto update status based on percentage
            if (percent === 100) {
                g.status = 'Achieved';
            } else if (percent > 0) {
                g.status = 'In Progress';
            } else {
                g.status = g.status || 'In Progress';
            }
        }

        const employeesRes = await pool.query(
            "SELECT id, full_name FROM employees WHERE status = 'Active' OR status IS NULL OR status = 'active' ORDER BY full_name ASC;"
        );

        res.status(200).json({
            success: true,
            data: {
                goals,
                employees: employeesRes.rows
            }
        });
    } catch (error) {
        console.log("Error in getGoals:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function createGoal(req, res) {
    try {
        const { employeeId, title, description, type, weightage, targetValue, kpi, timeline, status } = req.body;
        const createdBy = req.user ? req.user.id : null;

        if (!employeeId || !title || !weightage) {
            return res.status(400).json({ success: false, message: "Employee, Title, and Weightage are required" });
        }

        // Fetch task stats for initial values
        const taskStats = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN status = 'Completed' THEN 1 END) as completed
            FROM tasks
            WHERE $1 = ANY(assigned_to)
        `, [parseInt(employeeId, 10)]);

        const total = parseInt(taskStats.rows[0].total, 10) || 0;
        const completed = parseInt(taskStats.rows[0].completed, 10) || 0;

        let target = targetValue ? parseFloat(targetValue) : 0;
        let actual = completed;
        let percent = 0;

        if (target > 0) {
            percent = Math.min(100, Math.round((actual / target) * 100));
        } else if (total > 0) {
            target = total;
            percent = Math.round((completed / total) * 100);
        }

        let finalStatus = status || 'In Progress';
        if (percent === 100) {
            finalStatus = 'Achieved';
        } else if (percent > 0) {
            finalStatus = 'In Progress';
        }

        const query = `
            INSERT INTO goals (
                employee_id, title, description, type, weightage, target_value, 
                actual_value, percentage_achieved, kpi, timeline, status, created_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
            RETURNING *;
        `;
        const values = [
            parseInt(employeeId, 10),
            title,
            description || null,
            type || 'Individual',
            parseInt(weightage, 10),
            target,
            actual,
            percent,
            kpi || null,
            timeline || null,
            finalStatus,
            createdBy
        ];

        const result = await pool.query(query, values);
        res.status(201).json({ success: true, message: "Goal set successfully", data: result.rows[0] });
    } catch (error) {
        console.log("Error in createGoal:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function updateGoal(req, res) {
    try {
        const { id } = req.params;
        let { employeeId, title, description, type, weightage, targetValue, actualValue, percentageAchieved, kpi, timeline, status, selfAssessment, managerFeedback } = req.body;

        const checkGoal = await pool.query("SELECT * FROM goals WHERE id = $1", [id]);
        if (checkGoal.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Goal not found" });
        }
        const existingGoal = checkGoal.rows[0];

        // Auto calculate from task completion
        const empId = employeeId ? parseInt(employeeId, 10) : existingGoal.employee_id;
        const taskStats = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN status = 'Completed' THEN 1 END) as completed
            FROM tasks
            WHERE $1 = ANY(assigned_to)
        `, [empId]);

        const total = parseInt(taskStats.rows[0].total, 10) || 0;
        const completed = parseInt(taskStats.rows[0].completed, 10) || 0;

        let target = targetValue !== undefined ? parseFloat(targetValue) : parseFloat(existingGoal.target_value);
        let actual = completed;
        let percent = 0;

        if (target > 0) {
            percent = Math.min(100, Math.round((actual / target) * 100));
        } else if (total > 0) {
            target = total;
            percent = Math.round((completed / total) * 100);
        }

        actualValue = actual;
        percentageAchieved = percent;
        if (percent === 100) {
            status = 'Achieved';
        } else if (percent > 0) {
            status = 'In Progress';
        } else {
            status = status || existingGoal.status || 'In Progress';
        }

        const query = `
            UPDATE goals
            SET employee_id = $1, title = $2, description = $3, type = $4, weightage = $5, 
                target_value = $6, actual_value = $7, percentage_achieved = $8, kpi = $9, 
                timeline = $10, status = $11, self_assessment = $12, manager_feedback = $13, 
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $14 RETURNING *;
        `;
        const values = [
            empId,
            title !== undefined ? title : existingGoal.title,
            description !== undefined ? description : existingGoal.description,
            type !== undefined ? type : existingGoal.type,
            weightage !== undefined ? parseInt(weightage, 10) : existingGoal.weightage,
            target,
            actual,
            percent,
            kpi !== undefined ? kpi : existingGoal.kpi,
            timeline !== undefined ? timeline : existingGoal.timeline,
            status,
            selfAssessment !== undefined ? selfAssessment : existingGoal.self_assessment,
            managerFeedback !== undefined ? managerFeedback : existingGoal.manager_feedback,
            id
        ];

        const result = await pool.query(query, values);
        res.status(200).json({ success: true, message: "Goal updated successfully", data: result.rows[0] });
    } catch (error) {
        console.log("Error in updateGoal:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function deleteGoal(req, res) {
    try {
        const { id } = req.params;
        const result = await pool.query("DELETE FROM goals WHERE id = $1 RETURNING *;", [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Goal record not found" });
        }

        res.status(200).json({ success: true, message: "Goal record deleted successfully" });
    } catch (error) {
        console.log("Error in deleteGoal:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}
