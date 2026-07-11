import { pool } from '../config/db.js';

export async function getWorkloadStats(req, res) {
    try {
        const empRes = await pool.query(
            "SELECT id, full_name, employee_code FROM employees WHERE status = 'Active' OR status IS NULL OR status = 'active' ORDER BY full_name ASC;"
        );
        const employees = empRes.rows;

        // Fetch project memberships counts
        const projRes = await pool.query(
            "SELECT employee_id, COUNT(*) AS project_count FROM project_members GROUP BY employee_id;"
        );
        const projMap = {};
        projRes.rows.forEach(r => {
            projMap[r.employee_id] = parseInt(r.project_count, 10);
        });

        // Fetch open tasks and map elements to array containment
        const tasksRes = await pool.query(
            "SELECT id, assigned_to, status FROM tasks WHERE status != 'Completed';"
        );
        const taskMap = {};
        employees.forEach(e => {
            taskMap[e.id] = 0;
        });
        tasksRes.rows.forEach(t => {
            if (t.assigned_to && Array.isArray(t.assigned_to)) {
                t.assigned_to.forEach(empId => {
                    if (taskMap[empId] !== undefined) {
                        taskMap[empId]++;
                    }
                });
            }
        });

        // Fetch approved timesheets averages
        const tsRes = await pool.query(
            "SELECT employee_id, SUM(total_hours) AS total_hours, COUNT(DISTINCT date) AS active_days FROM timesheets WHERE status = 'Approved' GROUP BY employee_id;"
        );
        const tsMap = {};
        tsRes.rows.forEach(r => {
            const tot = parseFloat(r.total_hours) || 0;
            const days = parseInt(r.active_days, 10) || 0;
            tsMap[r.employee_id] = days > 0 ? (tot / days) : 0;
        });

        // Map computed capacity states
        const workload = employees.map(emp => {
            const projectsCount = projMap[emp.id] || 0;
            const pendingTasks = taskMap[emp.id] || 0;
            const avgHours = tsMap[emp.id] || 0;

            let status = 'Optimal';
            if (pendingTasks > 5 || avgHours > 9) {
                status = 'Overloaded';
            } else if (pendingTasks === 0 && avgHours < 5) {
                status = 'Underutilized';
            }

            return {
                id: emp.id,
                full_name: emp.full_name,
                employee_code: emp.employee_code,
                projects_count: projectsCount,
                pending_tasks: pendingTasks,
                avg_hours: parseFloat(avgHours.toFixed(1)),
                status
            };
        });

        res.status(200).json({ success: true, data: workload });
    } catch (error) {
        console.log("Error in getWorkloadStats:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}
