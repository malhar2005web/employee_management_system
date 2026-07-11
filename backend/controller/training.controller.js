import { pool } from '../config/db.js';

export async function getTrainings(req, res) {
    try {
        const result = await pool.query(`
            SELECT t.*, e.full_name, e.employee_code
            FROM trainings t
            LEFT JOIN employees e ON t.assigned_to = e.id
            ORDER BY t.id DESC;
        `);

        const employeesRes = await pool.query(
            "SELECT id, full_name FROM employees WHERE status = 'Active' OR status IS NULL OR status = 'active' ORDER BY full_name ASC;"
        );

        res.status(200).json({
            success: true,
            data: {
                trainings: result.rows,
                employees: employeesRes.rows
            }
        });
    } catch (error) {
        console.log("Error in getTrainings:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function createTraining(req, res) {
    try {
        const { title, description, assignedTo, status, certificationName } = req.body;

        if (!title || !assignedTo) {
            return res.status(400).json({ success: false, message: "Title and Assigned Employee are required" });
        }

        const completedAt = status === 'Completed' ? new Date() : null;

        const query = `
            INSERT INTO trainings (title, description, assigned_to, status, certification_name, completed_at, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *;
        `;
        const values = [
            title,
            description || null,
            parseInt(assignedTo, 10),
            status || 'Pending',
            certificationName || null,
            completedAt
        ];

        const result = await pool.query(query, values);
        res.status(201).json({ success: true, message: "Training course assigned successfully", data: result.rows[0] });
    } catch (error) {
        console.log("Error in createTraining:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function updateTraining(req, res) {
    try {
        const { id } = req.params;
        const { title, description, assignedTo, status, certificationName } = req.body;

        const checkTraining = await pool.query("SELECT id, status, completed_at FROM trainings WHERE id = $1", [id]);
        if (checkTraining.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Training record not found" });
        }

        const oldStatus = checkTraining.rows[0].status;
        let completedAt = checkTraining.rows[0].completed_at;

        if (status === 'Completed' && oldStatus !== 'Completed') {
            completedAt = new Date();
        } else if (status !== 'Completed') {
            completedAt = null;
        }

        const query = `
            UPDATE trainings
            SET title = $1, description = $2, assigned_to = $3, status = $4, 
                certification_name = $5, completed_at = $6, updated_at = CURRENT_TIMESTAMP
            WHERE id = $7 RETURNING *;
        `;
        const values = [
            title || null,
            description || null,
            assignedTo ? parseInt(assignedTo, 10) : null,
            status || 'Pending',
            certificationName || null,
            completedAt,
            id
        ];

        const result = await pool.query(query, values);
        res.status(200).json({ success: true, message: "Training record updated successfully", data: result.rows[0] });
    } catch (error) {
        console.log("Error in updateTraining:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function deleteTraining(req, res) {
    try {
        const { id } = req.params;
        const result = await pool.query("DELETE FROM trainings WHERE id = $1 RETURNING *;", [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Training record not found" });
        }

        res.status(200).json({ success: true, message: "Training record deleted successfully" });
    } catch (error) {
        console.log("Error in deleteTraining:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}
