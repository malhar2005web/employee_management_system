import { pool } from '../config/db.js';

/**
 * 🧮 PERFORMANCE INTELLIGENCE & ESTIMATED VS ACTUAL CALCULATION ENGINE
 * Automatically computes duration, variance, efficiency %, schedule accuracy %,
 * running timer projections, and risk levels without manual data entry.
 */

export const calculateStepPerformance = async (stepId) => {
    try {
        // 1. Fetch step estimated hours & details
        const stepRes = await pool.query(
            `SELECT wt.id, wt.title, wt.estimated_hours, wt.status, wt.assigned_team_id, wt.completion_percentage
             FROM workflow_tasks wt WHERE wt.id = $1`,
            [stepId]
        );

        if (stepRes.rows.length === 0) return null;
        const step = stepRes.rows[0];

        const estimatedHours = parseFloat(step.estimated_hours) || 0;
        const estimatedSeconds = Math.round(estimatedHours * 3600);

        // 2. Aggregate actual duration from completed task sessions
        const sessionsRes = await pool.query(
            `SELECT 
                COALESCE(SUM(duration_seconds), 0)::INT AS completed_seconds,
                COUNT(*)::INT AS total_sessions,
                MIN(started_at) AS first_started_at,
                MAX(ended_at) AS last_completed_at
             FROM task_sessions
             WHERE workflow_task_id = $1 AND status != 'Running'`,
            [stepId]
        );

        const sessData = sessionsRes.rows[0] || {};
        let actualSeconds = parseInt(sessData.completed_seconds, 10) || 0;

        // 3. Include live running timer if step is currently active
        const runningRes = await pool.query(
            `SELECT ts.id, ts.started_at, e.full_name AS active_employee_name
             FROM task_sessions ts
             JOIN employees e ON ts.employee_id = e.id
             WHERE ts.workflow_task_id = $1 AND ts.status = 'Running'
             LIMIT 1`,
            [stepId]
        );

        let isRunning = false;
        let activeEmployeeName = null;
        let runningSeconds = 0;

        if (runningRes.rows.length > 0) {
            isRunning = true;
            activeEmployeeName = runningRes.rows[0].active_employee_name;
            const startTime = new Date(runningRes.rows[0].started_at).getTime();
            runningSeconds = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
            actualSeconds += runningSeconds;
        }

        // 4. Calculate Variance & Performance Indicators
        const varianceSeconds = actualSeconds - estimatedSeconds;
        const safeActualSeconds = Math.max(1, actualSeconds);
        const safeEstimatedSeconds = Math.max(1, estimatedSeconds);

        const efficiencyPercentage = estimatedSeconds > 0 
            ? Math.round((estimatedSeconds / safeActualSeconds) * 100)
            : 100;

        const scheduleAccuracyPercentage = estimatedSeconds > 0
            ? Math.round((safeActualSeconds / safeEstimatedSeconds) * 100)
            : 100;

        // Risk Level determination
        let riskLevel = 'Low';
        let statusBadge = 'Ahead of Schedule';

        if (varianceSeconds > 0) {
            statusBadge = 'Behind Schedule';
            const overrunPct = (varianceSeconds / safeEstimatedSeconds) * 100;
            if (overrunPct > 30) riskLevel = 'Critical';
            else if (overrunPct > 15) riskLevel = 'High';
            else riskLevel = 'Medium';
        }

        const projectedSeconds = Math.max(estimatedSeconds, actualSeconds);

        return {
            stepId: step.id,
            title: step.title,
            estimatedHours,
            estimatedSeconds,
            actualHours: (actualSeconds / 3600).toFixed(2),
            actualSeconds,
            runningSeconds,
            varianceHours: (varianceSeconds / 3600).toFixed(2),
            varianceSeconds,
            efficiencyPercentage,
            scheduleAccuracyPercentage,
            statusBadge,
            riskLevel,
            projectedHours: (projectedSeconds / 3600).toFixed(2),
            totalSessions: sessData.total_sessions || 0,
            firstStartedAt: sessData.first_started_at,
            lastCompletedAt: sessData.last_completed_at,
            isRunning,
            activeEmployeeName,
            completionPercentage: step.completion_percentage || 0
        };

    } catch (error) {
        console.error('Error calculating step performance:', error.message);
        return null;
    }
};

/**
 * Helper to format seconds into human-readable hours & minutes string (e.g. "6h 45m")
 */
export const formatDurationString = (totalSeconds) => {
    const isNegative = totalSeconds < 0;
    const absSec = Math.abs(totalSeconds);
    const hours = Math.floor(absSec / 3600);
    const minutes = Math.floor((absSec % 3600) / 60);

    const sign = isNegative ? '-' : '';
    if (hours === 0 && minutes === 0) return '0m';
    if (hours === 0) return `${sign}${minutes}m`;
    if (minutes === 0) return `${sign}${hours}h`;
    return `${sign}${hours}h ${minutes}m`;
};
