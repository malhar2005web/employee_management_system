import { pool } from '../config/db.js';
import { logActivityEvent } from '../services/eventLogger.service.js';

/**
 * 📊 1. GET WORKLOAD HEATMAP & CAPACITY DASHBOARD
 */
export const getWorkloadHeatmap = async (req, res) => {
    try {
        const query = `
            SELECT 
                e.id AS employee_id,
                e.full_name,
                d.name AS department_name,
                ds.title AS designation,
                COALESCE(ecs.weekly_capacity_hours, 40.00) AS weekly_capacity_hours,
                COALESCE(SUM(t.estimated_hours), 0)::NUMERIC(10,2) AS total_estimated_hours,
                COALESCE(SUM(ts_sum.actual_hours), 0)::NUMERIC(10,2) AS total_actual_hours,
                GREATEST(0, COALESCE(SUM(t.estimated_hours), 0) - COALESCE(SUM(ts_sum.actual_hours), 0))::NUMERIC(10,2) AS remaining_hours,
                CASE WHEN ts_active.id IS NOT NULL THEN true ELSE false END AS is_active_session,
                t_active.title AS active_task_title
            FROM employees e
            LEFT JOIN departments d ON e.department_id = d.id
            LEFT JOIN designations ds ON e.designation_id = ds.id
            LEFT JOIN employee_capacity_settings ecs ON e.id = ecs.employee_id
            LEFT JOIN tasks t ON (e.id = ANY(t.assigned_to) AND t.status != 'Completed' AND t.status != 'Cancelled')
            LEFT JOIN (
                SELECT employee_id, task_id, (SUM(duration_seconds)/3600.0)::NUMERIC(10,2) AS actual_hours
                FROM task_sessions WHERE status != 'Running' GROUP BY employee_id, task_id
            ) ts_sum ON (e.id = ts_sum.employee_id AND t.id = ts_sum.task_id)
            LEFT JOIN task_sessions ts_active ON (e.id = ts_active.employee_id AND ts_active.status = 'Running')
            LEFT JOIN tasks t_active ON ts_active.task_id = t_active.id
            WHERE e.status = 'Active' OR e.status = 'active' OR e.status IS NULL
            GROUP BY e.id, e.full_name, d.name, ds.title, ecs.weekly_capacity_hours, ts_active.id, t_active.title
            ORDER BY d.name ASC, e.full_name ASC
        `;

        const result = await pool.query(query);

        const heatmapData = result.rows.map(row => {
            const cap = parseFloat(row.weekly_capacity_hours) || 40.00;
            const rem = parseFloat(row.remaining_hours) || 0.00;
            const workloadPct = Math.round((rem / cap) * 100);

            let statusBadge = 'Available';
            let statusColor = '#10b981'; // Green

            if (workloadPct > 120) {
                statusBadge = 'Overloaded';
                statusColor = '#ef4444'; // Red
            } else if (workloadPct > 100) {
                statusBadge = 'Busy';
                statusColor = '#f97316'; // Orange
            } else if (workloadPct >= 80) {
                statusBadge = 'Optimal';
                statusColor = '#eab308'; // Gold
            }

            return {
                ...row,
                workloadPercentage: workloadPct,
                statusBadge,
                statusColor
            };
        });

        return res.json({
            success: true,
            count: heatmapData.length,
            data: heatmapData
        });

    } catch (error) {
        console.error('Error fetching workload heatmap:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch workload heatmap: ' + error.message });
    }
};

/**
 * ⚖️ 2. PREVIEW SMART AUTO-REBALANCE (Safe Eligibility Rules)
 */
export const previewAutoRebalance = async (req, res) => {
    try {
        // Find overloaded employees (> 120%)
        const heatmapRes = await getWorkloadHeatmapInternal();
        const overloadedEmps = heatmapRes.filter(e => e.workloadPercentage > 120);

        if (overloadedEmps.length === 0) {
            return res.json({
                success: true,
                message: 'All employees are within optimal capacity limits (< 120%). No rebalancing needed.',
                recommendations: []
            });
        }

        let recommendations = [];

        for (const emp of overloadedEmps) {
            // Find eligible tasks (Not Started, No Active Session)
            const eligibleTasksRes = await pool.query(`
                SELECT t.id, t.title, t.estimated_hours, t.project_id
                FROM tasks t
                LEFT JOIN task_sessions ts ON (t.id = ts.task_id AND ts.status = 'Running')
                WHERE $1 = ANY(t.assigned_to)
                  AND t.status = 'To Do'
                  AND ts.id IS NULL
                ORDER BY t.estimated_hours DESC
                LIMIT 3
            `, [emp.employee_id]);

            // Find available employee in same department (< 80%)
            const candidateEmps = heatmapRes.filter(c => 
                c.department_name === emp.department_name &&
                c.employee_id !== emp.employee_id &&
                c.workloadPercentage < 80
            );

            if (eligibleTasksRes.rows.length > 0 && candidateEmps.length > 0) {
                const targetCandidate = candidateEmps[0];
                const taskToMove = eligibleTasksRes.rows[0];

                recommendations.push({
                    task: taskToMove,
                    overloadedEmployee: { id: emp.employee_id, name: emp.full_name, currentWorkload: emp.workloadPercentage },
                    targetEmployee: { id: targetCandidate.employee_id, name: targetCandidate.full_name, currentWorkload: targetCandidate.workloadPercentage },
                    remainingHours: taskToMove.estimated_hours,
                    impactDescription: `Reassigning Task "${taskToMove.title}" will reduce ${emp.full_name}'s workload from ${emp.workloadPercentage}% ➔ ${Math.round(emp.workloadPercentage - (taskToMove.estimated_hours / emp.weekly_capacity_hours * 100))}%`
                });
            }
        }

        return res.json({
            success: true,
            recommendations
        });

    } catch (error) {
        console.error('Error previewing auto-rebalance:', error);
        return res.status(500).json({ success: false, message: 'Failed to preview rebalance' });
    }
};

/**
 * Helper internal query
 */
async function getWorkloadHeatmapInternal() {
    const query = `
        SELECT 
            e.id AS employee_id, e.full_name, d.name AS department_name,
            COALESCE(ecs.weekly_capacity_hours, 40.00) AS weekly_capacity_hours,
            COALESCE(SUM(t.estimated_hours), 0)::NUMERIC(10,2) AS total_estimated_hours
        FROM employees e
        LEFT JOIN departments d ON e.department_id = d.id
        LEFT JOIN employee_capacity_settings ecs ON e.id = ecs.employee_id
        LEFT JOIN tasks t ON (e.id = ANY(t.assigned_to) AND t.status != 'Completed')
        GROUP BY e.id, e.full_name, d.name, ecs.weekly_capacity_hours
    `;
    const res = await pool.query(query);
    return res.rows.map(r => ({
        ...r,
        workloadPercentage: Math.round(((r.total_estimated_hours || 0) / r.weekly_capacity_hours) * 100)
    }));
}
