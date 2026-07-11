import { pool } from '../config/db.js';

export async function getMonitoringLogs(req, res) {
    try {
        const result = await pool.query(`
            SELECT ml.*, e.full_name, e.employee_code
            FROM monitoring_logs ml
            LEFT JOIN employees e ON ml.employee_id = e.id
            ORDER BY ml.log_time DESC
            LIMIT 100;
        `);
        res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        console.log("Error in getMonitoringLogs:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function getActivityLogs(req, res) {
    try {
        const result = await pool.query(`
            SELECT al.*, e.full_name, e.employee_code
            FROM activity_logs al
            LEFT JOIN employees e ON al.employee_id = e.id
            ORDER BY al.date DESC;
        `);
        res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        console.log("Error in getActivityLogs:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function categorizeProductivity(req, res) {
    try {
        const { name, type, category } = req.body; // type = 'app' or 'url', category = 'Productive' / 'Unproductive' / 'Neutral'
        if (!name || !type || !category) {
            return res.status(400).json({ success: false, message: "Name, type, and category are required" });
        }

        const logsRes = await pool.query("SELECT id, application_usage, browser_usage FROM activity_logs");
        
        for (let row of logsRes.rows) {
            let updated = false;
            let appUsage = row.application_usage;
            let browserUsage = row.browser_usage;

            if (type === 'app' && appUsage && Array.isArray(appUsage)) {
                appUsage.forEach(item => {
                    const appName = item.appName || item.name;
                    if (appName === name) {
                        item.category = category;
                        updated = true;
                    }
                });
            } else if (type === 'url' && browserUsage && Array.isArray(browserUsage)) {
                browserUsage.forEach(item => {
                    const urlVal = item.url || item.domain;
                    if (urlVal === name) {
                        item.category = category;
                        updated = true;
                    }
                });
            }

            if (updated) {
                await pool.query(
                    `UPDATE activity_logs 
                     SET application_usage = $1, browser_usage = $2, updated_at = CURRENT_TIMESTAMP 
                     WHERE id = $3`,
                    [JSON.stringify(appUsage), JSON.stringify(browserUsage), row.id]
                );
            }
        }

        res.status(200).json({ success: true, message: "Productivity category updated successfully" });
    } catch (error) {
        console.log("Error in categorizeProductivity:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}
