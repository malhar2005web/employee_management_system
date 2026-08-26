import { pool } from '../config/db.js';

/**
 * Trigger PL/pgSQL Calculation Engine for a Month
 * POST /api/v1/attendance/pcs/calculate
 */
export async function calculateAttendance(req, res) {
    try {
        const { month, username } = req.body;
        const targetMonth = month || new Date().toISOString().slice(0, 10);
        const targetUser = username || 'All';

        const result = await pool.query(
            "SELECT generate_user_rtp($1, $2::date) AS affected",
            [targetUser, targetMonth]
        );

        res.status(200).json({
            success: true,
            message: `Attendance calculated successfully for ${targetUser} (${targetMonth})`,
            affected_days: parseInt(result.rows[0]?.affected || 0, 10)
        });
    } catch (error) {
        console.error("Error in calculateAttendance:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
}

/**
 * Get Monthly Attendance Summary (powered by ATTENDANCE_SUM VIEW)
 * GET /api/v1/attendance/pcs/monthly-summary?month=202609&username=All
 */
export async function getMonthlySummary(req, res) {
    try {
        const { month, username } = req.query;
        const targetMonth = month ? month.replace(/-/g, '').slice(0, 6) : new Date().toISOString().slice(0, 7).replace('-', '');
        const targetUser = username || 'All';

        let query = `
            SELECT 
                s.*,
                e.full_name,
                e.employee_code,
                e.phone
            FROM "ATTENDANCE_SUM" s
            LEFT JOIN employee_teramind_mapping m ON s."USERNAME" = m.computer_name
            LEFT JOIN employees e ON (s."EMPLOYEE_ID" = e.id OR m.employee_id = e.id)
            WHERE s."YYYYMM" = $1
        `;
        const params = [targetMonth];

        if (targetUser !== 'All') {
            query += ` AND s."USERNAME" = $2`;
            params.push(targetUser);
        }

        query += ` ORDER BY s."USERNAME" ASC;`;

        const result = await pool.query(query, params);

        res.status(200).json({
            success: true,
            month: targetMonth,
            count: result.rows.length,
            data: result.rows
        });
    } catch (error) {
        console.error("Error in getMonthlySummary:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
}

/**
 * Get Daily Detailed Attendance Sheet for an Employee/All
 * GET /api/v1/attendance/pcs/daily-sheet?month=2026-09-01&username=...
 */
export async function getDailyAttendanceSheet(req, res) {
    try {
        const { month, username } = req.query;
        const targetDate = month || new Date().toISOString().slice(0, 10);
        const targetUser = username || 'All';

        const result = await pool.query(
            "SELECT * FROM get_user_attendance2($1, $2::date)",
            [targetUser, targetDate]
        );

        res.status(200).json({
            success: true,
            month: targetDate,
            user: targetUser,
            count: result.rows.length,
            data: result.rows
        });
    } catch (error) {
        console.error("Error in getDailyAttendanceSheet:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
}

/**
 * Raw Activity Gap Analysis
 * GET /api/v1/attendance/pcs/gap-analysis?month=2026-09-01&username=...&diff=15
 */
export async function getGapAnalysis(req, res) {
    try {
        const { month, username, diff } = req.query;
        const targetDate = month || new Date().toISOString().slice(0, 10);
        const targetUser = username || 'All';
        const minDiff = parseInt(diff || 15, 10);

        const result = await pool.query(
            "SELECT * FROM check_diff_in_sheet($1::date, $2, $3)",
            [targetDate, targetUser, minDiff]
        );

        res.status(200).json({
            success: true,
            minDiffMinutes: minDiff,
            count: result.rows.length,
            data: result.rows
        });
    } catch (error) {
        console.error("Error in getGapAnalysis:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
}

/**
 * Ingest Raw Attendance Punches
 * POST /api/v1/attendance/pcs/import
 */
export async function importAttendancePunches(req, res) {
    try {
        const { punches } = req.body;
        if (!Array.isArray(punches) || punches.length === 0) {
            return res.status(400).json({ success: false, message: "Array of punch logs is required" });
        }

        let insertedCount = 0;
        for (const p of punches) {
            if (!p.computer || !p.rep_datetime) continue;
            const dt = new Date(p.rep_datetime);
            const yyyymm = `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, '0')}`;
            const mth = String(dt.getMonth() + 1).padStart(2, '0');
            const dayys = String(dt.getDate()).padStart(2, '0');
            const dur = p.duration || '00:00:00';

            await pool.query(`
                INSERT INTO pcs_attendance_sheet (computer, rep_datetime, duration, yearmth, mth, dayys, data_from, remark)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [p.computer, p.rep_datetime, dur, yyyymm, mth, dayys, p.data_from || 'API_INGESTION', p.remark || null]);
            insertedCount++;
        }

        res.status(200).json({
            success: true,
            message: `Successfully ingested ${insertedCount} punch records.`,
            inserted: insertedCount
        });
    } catch (error) {
        console.error("Error in importAttendancePunches:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
}
