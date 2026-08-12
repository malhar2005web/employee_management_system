import { pool } from '../config/db.js';
import { logActivityEvent } from '../services/eventLogger.service.js';

/**
 * Helper to safely extract Employee ID or User ID from authenticated session
 */
const getEmpId = (req) => {
    if (!req.user) return null;
    return req.user.employee_id || req.user.id || req.user.userId;
};

/**
 * 🚀 START / SWITCH TASK SESSION (Atomic Single Active Task Rule)
 * An employee can have ONLY ONE ACTIVE TASK at any given moment.
 * Automatically pauses any currently running session with reason 'Task Switched'.
 * Every start/resume creates a NEW Task Session record.
 */
export const startTaskSession = async (req, res) => {
    const client = await pool.connect();
    try {
        const employeeId = getEmpId(req);
        if (!employeeId) {
            return res.status(401).json({ success: false, message: 'Unauthorized - invalid employee ID' });
        }

        const { taskId, workflowTaskId, projectId, subtaskId, platform = 'Web' } = req.body;

        await client.query('BEGIN');

        // Check if task is already completed
        if (taskId) {
            const taskCheck = await client.query('SELECT status FROM tasks WHERE id = $1', [taskId]);
            if (taskCheck.rows.length > 0 && taskCheck.rows[0].status === 'Completed') {
                await client.query('ROLLBACK');
                return res.status(400).json({ success: false, message: 'Cannot start tracking work on an already completed task.' });
            }
        }

        // 1. Unconditionally clear any existing running/unclosed session for this employee to prevent duplicate key constraint error
        await client.query(
            `UPDATE task_sessions 
             SET status = 'Paused', ended_at = NOW(), end_reason = 'Task Switched', updated_at = NOW() 
             WHERE employee_id = $1 AND (status = 'Running' OR ended_at IS NULL)`,
            [employeeId]
        );

        // Lock and check for existing running session for this employee
        const activeRes = await client.query(
            `SELECT id, started_at, task_id, project_id FROM task_sessions 
             WHERE employee_id = $1 AND status = 'Running' FOR UPDATE`,
            [employeeId]
        );

        let autoPausedPrevious = false;
        let previousSessionId = null;

        if (activeRes.rows.length > 0) {
            const activeSession = activeRes.rows[0];
            previousSessionId = activeSession.id;
            autoPausedPrevious = true;

            // Calculate duration of the session being auto-paused
            const durationQuery = await client.query(
                `SELECT EXTRACT(EPOCH FROM (NOW() - $1))::INT as seconds`,
                [activeSession.started_at]
            );
            const durationSec = Math.max(1, durationQuery.rows[0].seconds || 0);

            // Update active session to Paused with end_reason 'Task Switched'
            await client.query(
                `UPDATE task_sessions 
                 SET status = 'Paused', ended_at = NOW(), duration_seconds = $1, end_reason = 'Task Switched', updated_at = NOW() 
                 WHERE id = $2`,
                [durationSec, activeSession.id]
            );

            // Log session transition event
            await client.query(
                `INSERT INTO task_session_events (session_id, employee_id, event_type, reason, details)
                 VALUES ($1, $2, 'Paused', 'Task Switched', $3::jsonb)`,
                [activeSession.id, employeeId, JSON.stringify({ autoSwitchedToTaskId: taskId || null })]
            );

            // Audit Log
            await client.query(
                `INSERT INTO audit_logs (user_id, action, entity, description)
                 VALUES ($1, 'TASK_SESSION_AUTO_PAUSED', 'task_sessions', $2)`,
                [employeeId, `Session #${activeSession.id} auto-paused (Task Switched to task #${taskId || 'N/A'})`]
            );
        }

        // 2. Insert NEW Task Session
        const newSessionRes = await client.query(
            `INSERT INTO task_sessions (employee_id, task_id, workflow_task_id, project_id, subtask_id, started_at, status, platform, last_heartbeat_at)
             VALUES ($1, $2, $3, $4, $5, NOW(), 'Running', $6, NOW())
             RETURNING *`,
            [employeeId, taskId || null, workflowTaskId || null, projectId || null, subtaskId || null, platform]
        );

        const newSession = newSessionRes.rows[0];

        // Update task status to 'In Progress' if starting a task
        if (taskId) {
            await client.query(`UPDATE tasks SET status = 'In Progress' WHERE id = $1 AND status != 'Completed'`, [taskId]);
        }

        // 3. Log 'Started' Event
        await client.query(
            `INSERT INTO task_session_events (session_id, employee_id, event_type, reason, details)
             VALUES ($1, $2, 'Started', 'Employee Started Work', $3::jsonb)`,
            [newSession.id, employeeId, JSON.stringify({ platform, previousSessionId })]
        );

        await client.query(
            `INSERT INTO audit_logs (user_id, action, entity, description)
             VALUES ($1, 'TASK_SESSION_STARTED', 'task_sessions', $2)`,
            [employeeId, `Started work on session #${newSession.id} (Task #${taskId || 'N/A'})`]
        );

        logActivityEvent(req, {
            eventType: 'Task Started',
            category: 'Work',
            module: 'Time Tracking',
            severity: 'INFO',
            entityType: 'Task',
            entityId: taskId || null,
            action: 'Started Work',
            reason: autoPausedPrevious ? 'Task Switched' : 'Manual Start',
            impactType: 'Time',
            impactDescription: `Started active tracking session #${newSession.id}`
        });

        await client.query('COMMIT');

        // Fetch task details for response
        let taskName = 'General Work Session';
        let projectName = 'Internal';
        if (taskId) {
            const taskInfo = await client.query(
                `SELECT t.title AS task_name, p.name AS project_name FROM tasks t LEFT JOIN projects p ON t.project_id = p.id WHERE t.id = $1`,
                [taskId]
            );
            if (taskInfo.rows.length > 0) {
                taskName = taskInfo.rows[0].task_name || 'General Work Session';
                projectName = taskInfo.rows[0].project_name || 'Internal';
            }
        }

        return res.status(201).json({
            success: true,
            message: autoPausedPrevious ? 'Previous task auto-paused & new task session started' : 'Task session started',
            data: {
                session: newSession,
                taskName,
                projectName,
                autoPausedPrevious
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error starting task session:', error);
        return res.status(500).json({ success: false, message: 'Failed to start task session: ' + error.message });
    } finally {
        client.release();
    }
};

/**
 * ⏸️ PAUSE TASK SESSION
 */
export const pauseTaskSession = async (req, res) => {
    const client = await pool.connect();
    try {
        const employeeId = getEmpId(req);
        const { sessionId, reason = 'Employee Paused' } = req.body;

        await client.query('BEGIN');

        const queryStr = sessionId 
            ? `SELECT * FROM task_sessions WHERE id = $1 AND employee_id = $2 AND status = 'Running' FOR UPDATE`
            : `SELECT * FROM task_sessions WHERE employee_id = $1 AND status = 'Running' FOR UPDATE`;

        const activeRes = await client.query(queryStr, sessionId ? [sessionId, employeeId] : [employeeId]);

        if (activeRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'No active running task session found to pause' });
        }

        const session = activeRes.rows[0];

        const durationQuery = await client.query(
            `SELECT EXTRACT(EPOCH FROM (NOW() - $1))::INT as seconds`,
            [session.started_at]
        );
        const durationSec = Math.max(1, durationQuery.rows[0].seconds || 0);

        await client.query(
            `UPDATE task_sessions 
             SET status = 'Paused', ended_at = NOW(), duration_seconds = $1, end_reason = $2, updated_at = NOW() 
             WHERE id = $3`,
            [durationSec, reason, session.id]
        );

        await client.query(
            `INSERT INTO task_session_events (session_id, employee_id, event_type, reason)
             VALUES ($1, $2, 'Paused', $3)`,
            [session.id, employeeId, reason]
        );

        await client.query(
            `INSERT INTO audit_logs (user_id, action, entity, description)
             VALUES ($1, 'TASK_SESSION_PAUSED', 'task_sessions', $2)`,
            [employeeId, `Paused task session #${session.id} (Reason: ${reason})`]
        );

        await client.query('COMMIT');

        return res.json({
            success: true,
            message: 'Task session paused',
            data: { sessionId: session.id, durationSeconds: durationSec, endReason: reason }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error pausing session:', error);
        return res.status(500).json({ success: false, message: 'Failed to pause session: ' + error.message });
    } finally {
        client.release();
    }
};

/**
 * ✔️ COMPLETE / STOP TASK SESSION
 */
export const stopTaskSession = async (req, res) => {
    const client = await pool.connect();
    try {
        const employeeId = getEmpId(req);
        const { sessionId, endReason = 'Task Completed', isTaskCompleted = true } = req.body;

        await client.query('BEGIN');

        const queryStr = sessionId 
            ? `SELECT * FROM task_sessions WHERE id = $1 AND employee_id = $2 AND status = 'Running' FOR UPDATE`
            : `SELECT * FROM task_sessions WHERE employee_id = $1 AND status = 'Running' FOR UPDATE`;

        const activeRes = await client.query(queryStr, sessionId ? [sessionId, employeeId] : [employeeId]);

        if (activeRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'No active running task session found' });
        }

        const session = activeRes.rows[0];

        const durationQuery = await client.query(
            `SELECT EXTRACT(EPOCH FROM (NOW() - $1))::INT as seconds`,
            [session.started_at]
        );
        const durationSec = Math.max(1, durationQuery.rows[0].seconds || 0);

        const newStatus = isTaskCompleted ? 'Completed' : 'Cancelled';

        await client.query(
            `UPDATE task_sessions 
             SET status = $1, ended_at = NOW(), duration_seconds = $2, end_reason = $3, updated_at = NOW() 
             WHERE id = $4`,
            [newStatus, durationSec, endReason, session.id]
        );

        if (session.task_id && isTaskCompleted) {
            await client.query(
                `UPDATE tasks SET status = 'Completed', completion_percentage = 100, updated_at = NOW() WHERE id = $1`,
                [session.task_id]
            );
        }

        await client.query(
            `INSERT INTO task_session_events (session_id, employee_id, event_type, reason)
             VALUES ($1, $2, $3, $4)`,
            [session.id, employeeId, newStatus, endReason]
        );

        await client.query(
            `INSERT INTO audit_logs (user_id, action, entity, description)
             VALUES ($1, 'TASK_SESSION_COMPLETED', 'task_sessions', $2)`,
            [employeeId, `Completed task session #${session.id} (Task #${session.task_id || 'N/A'})`]
        );

        await client.query('COMMIT');

        return res.json({
            success: true,
            message: `Task session ${newStatus.toLowerCase()}`,
            data: { sessionId: session.id, durationSeconds: durationSec, status: newStatus }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error stopping task session:', error);
        return res.status(500).json({ success: false, message: 'Failed to stop task session: ' + error.message });
    } finally {
        client.release();
    }
};

/**
 * 📡 CURRENT ACTIVE TASK SESSION
 */
export const getActiveTaskSession = async (req, res) => {
    try {
        const employeeId = getEmpId(req);
        if (!employeeId) return res.json({ success: true, data: { active: false, session: null } });

        const activeRes = await pool.query(
            `SELECT ts.*, t.title AS task_name, p.name AS project_name, 
                    EXTRACT(EPOCH FROM (NOW() - ts.started_at))::INT as elapsed_seconds
             FROM task_sessions ts
             LEFT JOIN tasks t ON ts.task_id = t.id
             LEFT JOIN projects p ON ts.project_id = p.id
             WHERE ts.employee_id = $1 AND ts.status = 'Running'
             ORDER BY ts.id DESC LIMIT 1`,
            [employeeId]
        );

        if (activeRes.rows.length === 0) {
            return res.json({
                success: true,
                data: { active: false, session: null }
            });
        }

        const session = activeRes.rows[0];

        return res.json({
            success: true,
            data: {
                active: true,
                session: {
                    id: session.id,
                    taskId: session.task_id,
                    taskName: session.task_name || 'General Task Work',
                    projectId: session.project_id,
                    projectName: session.project_name || 'Internal Project',
                    startedAt: session.started_at,
                    elapsedSeconds: Math.max(0, session.elapsed_seconds || 0),
                    status: session.status,
                    platform: session.platform
                }
            }
        });

    } catch (error) {
        console.error('Error fetching active session:', error);
        return res.status(500).json({ success: false, message: 'Error fetching active session' });
    }
};

/**
 * 💓 HEARTBEAT PING (Sent every 30s by Web, Mobile, Desktop)
 */
export const sendHeartbeat = async (req, res) => {
    try {
        const employeeId = getEmpId(req);
        const { sessionId, platform = 'Web', activeWindow } = req.body;

        const activeRes = await pool.query(
            `SELECT id FROM task_sessions WHERE employee_id = $1 AND status = 'Running'`,
            [employeeId]
        );

        if (activeRes.rows.length === 0) {
            return res.json({ success: true, active: false, message: 'No active session running' });
        }

        const currentSessionId = activeRes.rows[0].id;

        await pool.query(
            `UPDATE task_sessions SET last_heartbeat_at = NOW(), updated_at = NOW() WHERE id = $1`,
            [currentSessionId]
        );

        await pool.query(
            `INSERT INTO heartbeat_logs (session_id, employee_id, ping_time, platform, active_window)
             VALUES ($1, $2, NOW(), $3, $4)`,
            [currentSessionId, employeeId, platform, activeWindow || null]
        );

        return res.json({ success: true, active: true, sessionId: currentSessionId });

    } catch (error) {
        console.error('Heartbeat error:', error);
        return res.status(500).json({ success: false, message: 'Heartbeat ping failed' });
    }
};

/**
 * 💤 IDLE TIMEOUT NOTIFICATION
 */
export const reportIdle = async (req, res) => {
    try {
        const employeeId = getEmpId(req);
        const { idleSeconds = 300 } = req.body;

        const activeRes = await pool.query(
            `SELECT id, started_at FROM task_sessions WHERE employee_id = $1 AND status = 'Running'`,
            [employeeId]
        );

        if (activeRes.rows.length === 0) {
            return res.json({ success: true, message: 'No active session to pause' });
        }

        const session = activeRes.rows[0];

        const durationQuery = await pool.query(
            `SELECT EXTRACT(EPOCH FROM (NOW() - $1))::INT as seconds`,
            [session.started_at]
        );
        const durationSec = Math.max(1, (durationQuery.rows[0].seconds || 0) - idleSeconds);

        await pool.query(
            `UPDATE task_sessions 
             SET status = 'Auto Paused', ended_at = NOW(), duration_seconds = $1, end_reason = 'Idle Timeout', updated_at = NOW() 
             WHERE id = $2`,
            [durationSec, session.id]
        );

        await pool.query(
            `INSERT INTO idle_logs (session_id, employee_id, idle_seconds) VALUES ($1, $2, $3)`,
            [session.id, employeeId, idleSeconds]
        );

        await pool.query(
            `INSERT INTO task_session_events (session_id, employee_id, event_type, reason)
             VALUES ($1, $2, 'Auto Paused', 'Idle Timeout')`,
            [session.id, employeeId]
        );

        return res.json({ success: true, message: 'Session auto-paused due to idle timeout' });

    } catch (error) {
        console.error('Idle report error:', error);
        return res.status(500).json({ success: false, message: 'Failed to handle idle report' });
    }
};

/**
 * 📈 PRODUCTIVITY & TIMESHEET ANALYTICS
 */
export const getTrackingAnalytics = async (req, res) => {
    try {
        const employeeId = getEmpId(req);
        const { startDate, endDate } = req.query;

        let dateFilter = `AND started_at >= CURRENT_DATE - INTERVAL '30 days'`;
        if (startDate && endDate) {
            dateFilter = `AND started_at BETWEEN '${startDate}' AND '${endDate}'`;
        }

        // Aggregate total duration
        const summaryRes = await pool.query(`
            SELECT 
                COALESCE(SUM(duration_seconds), 0)::INT as total_productive_seconds,
                COUNT(id)::INT as total_sessions,
                COUNT(CASE WHEN end_reason = 'Task Switched' THEN 1 END)::INT as task_switches,
                COUNT(CASE WHEN end_reason = 'Idle Timeout' THEN 1 END)::INT as idle_timeouts,
                COUNT(CASE WHEN status = 'Completed' THEN 1 END)::INT as completed_sessions,
                COALESCE(AVG(duration_seconds), 0)::INT as avg_session_seconds
            FROM task_sessions
            WHERE employee_id = $1 ${dateFilter}
        `, [employeeId]);

        // Per-project breakdown
        const projectRes = await pool.query(`
            SELECT 
                p.name AS project_name,
                COALESCE(SUM(ts.duration_seconds), 0)::INT as total_seconds
            FROM task_sessions ts
            LEFT JOIN projects p ON ts.project_id = p.id
            WHERE ts.employee_id = $1 ${dateFilter}
            GROUP BY p.name
            ORDER BY total_seconds DESC
        `, [employeeId]);

        // Daily breakdown
        const dailyRes = await pool.query(`
            SELECT 
                DATE(started_at) as date,
                COALESCE(SUM(duration_seconds), 0)::INT as daily_seconds,
                COUNT(id)::INT as session_count
            FROM task_sessions
            WHERE employee_id = $1 ${dateFilter}
            GROUP BY DATE(started_at)
            ORDER BY date DESC LIMIT 7
        `, [employeeId]);

        const summary = summaryRes.rows[0];
        const productiveHours = (summary.total_productive_seconds / 3600).toFixed(2);

        return res.json({
            success: true,
            data: {
                summary: {
                    totalProductiveSeconds: summary.total_productive_seconds,
                    productiveHours: parseFloat(productiveHours),
                    totalSessions: summary.total_sessions,
                    taskSwitches: summary.task_switches,
                    idleTimeouts: summary.idle_timeouts,
                    completedSessions: summary.completed_sessions,
                    avgSessionSeconds: summary.avg_session_seconds
                },
                projects: projectRes.rows,
                dailyHistory: dailyRes.rows
            }
        });

    } catch (error) {
        console.error('Analytics error:', error);
        return res.status(500).json({ success: false, message: 'Analytics query failed' });
    }
};

/**
 * 📜 SESSION TIMELINE HISTORY
 */
export const getSessionHistory = async (req, res) => {
    try {
        const employeeId = getEmpId(req);

        const historyRes = await pool.query(`
            SELECT 
                ts.id,
                ts.started_at,
                ts.ended_at,
                ts.duration_seconds,
                ts.status,
                ts.end_reason,
                ts.platform,
                t.title AS task_name,
                p.name AS project_name
            FROM task_sessions ts
            LEFT JOIN tasks t ON ts.task_id = t.id
            LEFT JOIN projects p ON ts.project_id = p.id
            WHERE ts.employee_id = $1
            ORDER BY ts.started_at DESC LIMIT 20
        `, [employeeId]);

        return res.json({
            success: true,
            data: historyRes.rows
        });

    } catch (error) {
        console.error('Session history error:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch session history' });
    }
};
