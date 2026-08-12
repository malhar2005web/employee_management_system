import { pool } from '../config/db.js';
import { calculateStepPerformance, formatDurationString } from '../services/performanceIntelligence.service.js';

/**
 * 📜 1. GET TIMELINE EVENTS (Chronological Stream with Multi-Filtering)
 */
export const getTimelineEvents = async (req, res) => {
    try {
        const {
            category,
            module: moduleName,
            severity,
            entityType,
            entityId,
            performedBy,
            search,
            limit = 50,
            offset = 0
        } = req.query;

        let conditions = [];
        let params = [];
        let pIndex = 1;

        if (category) {
            conditions.push(`ae.category = $${pIndex++}`);
            params.push(category);
        }

        if (moduleName) {
            conditions.push(`ae.module = $${pIndex++}`);
            params.push(moduleName);
        }

        if (severity) {
            conditions.push(`ae.severity = $${pIndex++}`);
            params.push(severity);
        }

        if (entityType) {
            conditions.push(`ae.entity_type = $${pIndex++}`);
            params.push(entityType);
        }

        if (entityId) {
            conditions.push(`ae.entity_id = $${pIndex++}`);
            params.push(parseInt(entityId, 10));
        }

        if (performedBy) {
            conditions.push(`ae.performed_by = $${pIndex++}`);
            params.push(parseInt(performedBy, 10));
        }

        if (search) {
            conditions.push(`(ae.action ILIKE $${pIndex} OR ae.entity_name ILIKE $${pIndex} OR ae.reason ILIKE $${pIndex} OR ae.impact_description ILIKE $${pIndex})`);
            params.push(`%${search}%`);
            pIndex++;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const query = `
            SELECT 
                ae.event_id, ae.correlation_id, ae.event_type, ae.category, ae.module, ae.severity,
                ae.entity_type, ae.entity_id, ae.entity_name, ae.action, ae.created_at,
                ae.old_value, ae.new_value, ae.reason, ae.impact_type, ae.impact_description,
                ae.metadata, ae.ip_address, ae.platform, ae.browser,
                e.full_name AS performed_by_name,
                d.name AS department_name
            FROM activity_events ae
            LEFT JOIN employees e ON ae.performed_by = e.id
            LEFT JOIN departments d ON e.department_id = d.id
            ${whereClause}
            ORDER BY ae.created_at DESC
            LIMIT $${pIndex++} OFFSET $${pIndex++}
        `;

        params.push(parseInt(limit, 10), parseInt(offset, 10));

        const result = await pool.query(query, params);

        return res.json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });

    } catch (error) {
        console.error('Error fetching timeline events:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch timeline events: ' + error.message });
    }
};

/**
 * 📊 2. GET COMPACT STEP PERFORMANCE CARD METRICS
 */
export const getStepPerformance = async (req, res) => {
    try {
        const { stepId } = req.params;
        const metrics = await calculateStepPerformance(parseInt(stepId, 10));

        if (!metrics) {
            return res.status(404).json({ success: false, message: 'Workflow step not found' });
        }

        const formatted = {
            ...metrics,
            formattedEstimated: formatDurationString(metrics.estimatedSeconds),
            formattedActual: formatDurationString(metrics.actualSeconds),
            formattedVariance: formatDurationString(metrics.varianceSeconds),
            formattedProjected: formatDurationString(metrics.projectedSeconds)
        };

        return res.json({
            success: true,
            data: formatted
        });

    } catch (error) {
        console.error('Error fetching step performance:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch step performance' });
    }
};

/**
 * ▶ 3. TIMELINE STORY REPLAY ENGINE (Playback sequence for Task or Workflow)
 */
export const getTaskPlaybackTimeline = async (req, res) => {
    try {
        const { taskId } = req.params;

        const eventsRes = await pool.query(`
            SELECT 
                ae.event_id, ae.correlation_id, ae.event_type, ae.category, ae.action,
                ae.created_at, ae.reason, ae.impact_type, ae.impact_description,
                ae.metadata, e.full_name AS performed_by_name
            FROM activity_events ae
            LEFT JOIN employees e ON ae.performed_by = e.id
            WHERE (ae.entity_type = 'Task' AND ae.entity_id = $1)
               OR (ae.entity_type = 'WorkflowStep' AND ae.entity_id IN (SELECT id FROM workflow_tasks WHERE task_id = $1))
            ORDER BY ae.created_at ASC
        `, [taskId]);

        return res.json({
            success: true,
            data: eventsRes.rows
        });

    } catch (error) {
        console.error('Error fetching playback timeline:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch playback timeline' });
    }
};

/**
 * 📑 4. EXPORT TIMELINE REPORT (CSV / JSON)
 */
export const exportTimelineReport = async (req, res) => {
    try {
        const { format = 'json' } = req.query;

        const result = await pool.query(`
            SELECT 
                ae.event_id, ae.created_at, ae.category, ae.module, ae.action,
                ae.entity_name, e.full_name AS performed_by, ae.impact_description,
                ae.ip_address, ae.platform
            FROM activity_events ae
            LEFT JOIN employees e ON ae.performed_by = e.id
            ORDER BY ae.created_at DESC LIMIT 500
        `);

        if (format.toLowerCase() === 'csv') {
            const fields = ['event_id', 'created_at', 'category', 'module', 'action', 'entity_name', 'performed_by', 'impact_description', 'ip_address'];
            let csvLines = [fields.join(',')];

            for (const row of result.rows) {
                const line = fields.map(f => `"${(row[f] || '').toString().replace(/"/g, '""')}"`).join(',');
                csvLines.push(line);
            }

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="ems_activity_audit_report.csv"');
            return res.send(csvLines.join('\n'));
        }

        return res.json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error('Error exporting timeline:', error);
        return res.status(500).json({ success: false, message: 'Failed to export report' });
    }
};
