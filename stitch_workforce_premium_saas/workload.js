document.addEventListener('DOMContentLoaded', () => {
    const workloadList = document.getElementById('workload-list');
    const countOverloaded = document.getElementById('count-overloaded');
    const countOptimal = document.getElementById('count-optimal');
    const countUnderutilized = document.getElementById('count-underutilized');
    const logoutBtn = document.getElementById('logout-btn');

    let workloadCache = [];

    const loadWorkload = async () => {
        try {
            const response = await fetch('/api/v1/admin/workload');
            const data = await response.json();
            if (response.ok && data.success) {
                workloadCache = data.data;
                renderWorkload();
            }
        } catch (error) {
            console.error("Error loading workload analytics:", error);
        }
    };

    const renderWorkload = () => {
        if (!workloadList) return;
        workloadList.innerHTML = '';

        let overloaded = 0;
        let optimal = 0;
        let underutilized = 0;

        if (workloadCache.length === 0) {
            workloadList.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted);">No employee workload metrics found</td></tr>`;
        } else {
            workloadCache.forEach(w => {
                // Class mapping
                let statusClass = 'progress'; // default green optimal
                let statusLabel = w.status;

                if (statusLabel === 'Overloaded') {
                    overloaded++;
                    statusClass = 'todo'; // red
                } else if (statusLabel === 'Underutilized') {
                    underutilized++;
                    statusClass = 'pending'; // blue/orange
                } else {
                    optimal++;
                }

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="task-name">${w.full_name} <span style="font-size:12px;color:var(--text-muted);">(${w.employee_code})</span></td>
                    <td style="font-weight:600;color:var(--teal-900);">${w.projects_count} Projects</td>
                    <td style="font-weight:600;">${w.pending_tasks} Tasks</td>
                    <td>${w.avg_hours} hrs/day</td>
                    <td><span class="status-pill ${statusClass}">${statusLabel}</span></td>
                `;
                workloadList.appendChild(tr);
            });
        }

        if (countOverloaded) countOverloaded.textContent = overloaded;
        if (countOptimal) countOptimal.textContent = optimal;
        if (countUnderutilized) countUnderutilized.textContent = underutilized;
    };

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                const response = await fetch('/api/v1/auth/logout', { method: 'POST' });
                if (response.ok) {
                    window.location.href = '/login.html';
                }
            } catch (error) {
                console.error("Logout failed:", error);
            }
        });
    }

    // Initial load
    loadWorkload();
});
