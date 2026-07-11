import { pool } from '../config/db.js';

export async function getScreenshots(req, res) {
    try {
        const result = await pool.query(`
            SELECT s.*, e.full_name, e.employee_code
            FROM screenshots s
            LEFT JOIN employees e ON s.employee_id = e.id
            ORDER BY s.timestamp DESC
            LIMIT 60;
        `);

        const employeesRes = await pool.query(
            "SELECT id, full_name FROM employees WHERE status = 'Active' OR status IS NULL OR status = 'active' ORDER BY full_name ASC;"
        );

        // Fetch current active capture frequency settings
        const settingsRes = await pool.query("SELECT interval_minutes, is_random FROM screenshots LIMIT 1");
        const settings = settingsRes.rows.length > 0 ? settingsRes.rows[0] : { interval_minutes: 10, is_random: false };

        res.status(200).json({
            success: true,
            data: {
                screenshots: result.rows,
                employees: employeesRes.rows,
                settings
            }
        });
    } catch (error) {
        console.log("Error in getScreenshots:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function createManualScreenshot(req, res) {
    try {
        const { employeeId, intervalMinutes, isRandom } = req.body;
        if (!employeeId) {
            return res.status(400).json({ success: false, message: "Employee ID is required" });
        }

        const query = `
            INSERT INTO screenshots (employee_id, image_path, is_random, interval_minutes, timestamp, created_at)
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *;
        `;
        const values = [
            parseInt(employeeId, 10),
            '/mock_desktop.png', // Standard generated mockup path
            isRandom === true,
            parseInt(intervalMinutes, 10) || 10
        ];

        const result = await pool.query(query, values);
        res.status(201).json({ success: true, message: "Screenshot mock captured successfully", data: result.rows[0] });
    } catch (error) {
        console.log("Error in createManualScreenshot:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function updateScreenshotSettings(req, res) {
    try {
        const { intervalMinutes, isRandom } = req.body;

        // Update all existing records to mirror current active settings parameters
        await pool.query(
            `UPDATE screenshots 
             SET interval_minutes = $1, is_random = $2;`,
            [parseInt(intervalMinutes, 10) || 10, isRandom === true]
        );

        res.status(200).json({ success: true, message: "Screenshot configuration settings updated successfully" });
    } catch (error) {
        console.log("Error in updateScreenshotSettings:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}
