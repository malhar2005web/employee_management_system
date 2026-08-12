document.addEventListener('DOMContentLoaded', () => {
  const tbody = document.getElementById('dashboard-workflow-tasks');
  if (!tbody) return;

  const employeeName = (employees, id) => {
    const emp = employees.find(e => parseInt(e.id, 10) === parseInt(id, 10));
    return emp ? emp.full_name : null;
  };

  const statusClass = status => {
    if (status === 'Completed') return 'progress';
    if (status === 'In Progress') return 'pending';
    if (status === 'Blocked') return 'delayed';
    return 'todo';
  };

  const isRunnable = (task, tasks) => {
    if (task.status === 'Completed') return false;
    if (task.status === 'In Progress' || task.status === 'Blocked') return true;
    const deps = Array.isArray(task.dependencies) ? task.dependencies : [];
    if (deps.length === 0) return true;
    return deps.every(depId => {
      const dep = tasks.find(t => parseInt(t.id, 10) === parseInt(depId, 10));
      return dep && dep.status === 'Completed';
    });
  };

  const render = (workflows, employees) => {
    const rows = [];

    workflows.forEach(workflow => {
      const activeTasks = (workflow.tasks || [])
        .filter(task => isRunnable(task, workflow.tasks || []))
        .sort((a, b) => (a.step_order || 0) - (b.step_order || 0));

      activeTasks.forEach(task => {
        const team = (workflow.teams || []).find(t => parseInt(t.id, 10) === parseInt(task.assigned_team_id, 10));
        const names = Array.isArray(task.assigned_employee_ids)
          ? task.assigned_employee_ids.map(id => employeeName(employees, id)).filter(Boolean)
          : [];
        const avatars = names.slice(0, 4).map((name, index) => {
          const img = (task.id + index + 10) % 70 || 12;
          return `<img src="https://i.pravatar.cc/60?img=${img}" alt="${name}" title="${name}">`;
        }).join('');
        const due = task.deadline ? new Date(task.deadline).toLocaleDateString() : '-';
        const progress = parseInt(task.completion_percentage, 10) || 0;
        const history = Array.isArray(task.status_history) ? task.status_history : [];
        const historyHtml = history.map(h => {
          const date = new Date(h.changed_at);
          const timeStr = isNaN(date.getTime()) ? '-' : date.toLocaleString(undefined, {month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'});
          return `<div style="font-size:11px;color:var(--text-muted);white-space:nowrap;margin-bottom:2px;">• <strong>${h.status}</strong>: ${timeStr}</div>`;
        }).join('') || '<span style="font-size:11px;color:var(--text-muted);">—</span>';

        rows.push(`
          <tr>
            <td class="task-name">
              <div style="font-weight:800;">${workflow.name}</div>
              <div style="font-size:12.5px;color:var(--text-muted);margin-top:3px;">Step ${task.step_order}: ${task.name}</div>
            </td>
            <td>
              <div style="font-weight:700;color:var(--teal-900);margin-bottom:5px;">${team ? team.name : '-'}</div>
              <div class="avatar-stack">${avatars || '<span style="font-size:12.5px;color:var(--text-muted);">No assignee</span>'}</div>
            </td>
            <td>${due}</td>
            <td><span class="status-pill ${statusClass(task.status)}">${task.status || 'Not Started'}</span></td>
            <td>
              <div class="row-progress">
                <div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div>
                <span>${progress}%</span>
              </div>
            </td>
            <td class="history-log-cell">
              ${historyHtml}
            </td>
            <td>
              <select class="dash-task-status" data-workflow-id="${workflow.id}" data-task-id="${task.id}"
                style="padding:4px 8px;border-radius:8px;font-size:11.5px;font-weight:700;border:1px solid var(--glass-border);background:rgba(255,255,255,0.55);color:var(--text-dark);cursor:pointer;min-width:120px;">
                ${['Not Started','In Progress','Completed','Blocked'].map(s => `<option value="${s}" ${s === (task.status || 'Not Started') ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
            </td>
          </tr>
        `);

      });
    });

    tbody.innerHTML = rows.length
      ? rows.slice(0, 8).join('')
      : '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted);">No active workflow tasks yet</td></tr>';

    // Wire status-change selects
    tbody.querySelectorAll('.dash-task-status').forEach(select => {
      select.addEventListener('change', async e => {
        const workflowId = select.dataset.workflowId;
        const taskId = select.dataset.taskId;
        const newStatus = select.value;
        try {
          const res = await fetch(`/api/v1/admin/tasks/workflows/${workflowId}/tasks/${taskId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ status: newStatus })
          });
          const data = await res.json();
          if (!data.success) throw new Error(data.message || 'Update failed');
          // Update pill beside select (optional visual refresh)
          const tr = select.closest('tr');
          const td = tr.querySelector('.status-pill');
          if (td) {
            const sc = newStatus === 'Completed' ? 'progress' : newStatus === 'In Progress' ? 'pending' : newStatus === 'Blocked' ? 'delayed' : 'todo';
            td.className = `status-pill ${sc}`;
            td.textContent = newStatus;
          }
          // Update status history log cell
          const historyTd = tr.querySelector('.history-log-cell');
          if (historyTd && data.data && Array.isArray(data.data.status_history)) {
            historyTd.innerHTML = data.data.status_history.map(h => {
              const date = new Date(h.changed_at);
              const timeStr = isNaN(date.getTime()) ? '-' : date.toLocaleString(undefined, {month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'});
              return `<div style="font-size:11px;color:var(--text-muted);white-space:nowrap;margin-bottom:2px;">• <strong>${h.status}</strong>: ${timeStr}</div>`;
            }).join('');
          }
        } catch (err) {
          console.error('Task status update error:', err);
          alert('Status update failed: ' + err.message);
        }
      });
    });

  };

  const renderPerformanceIntelligence = workflows => {
    const totalEl = document.getElementById('pi-total-workflows');
    const productivityEl = document.getElementById('pi-productivity');
    const onTimeEl = document.getElementById('pi-on-time');
    const healthEl = document.getElementById('pi-health');
    const teamList = document.getElementById('team-performance-list');
    if (!totalEl || !productivityEl || !onTimeEl || !healthEl || !teamList) return;

    const allTasks = workflows.flatMap(workflow => workflow.tasks || []);
    const completedTasks = allTasks.filter(task => task.status === 'Completed');
    const blockedTasks = allTasks.filter(task => task.status === 'Blocked');
    const overdueTasks = allTasks.filter(task => {
      if (!task.deadline || task.status === 'Completed') return false;
      return new Date(task.deadline) < new Date();
    });

    const avgWorkflowCompletion = workflows.length
      ? Math.round(workflows.reduce((sum, workflow) => sum + (parseInt(workflow.overall_completion, 10) || 0), 0) / workflows.length)
      : 0;
    const onTime = allTasks.length
      ? Math.round(((allTasks.length - overdueTasks.length) / allTasks.length) * 100)
      : 0;
    const healthScore = allTasks.length
      ? Math.max(0, Math.round(100 - ((blockedTasks.length + overdueTasks.length) / allTasks.length) * 100))
      : 0;

    totalEl.textContent = workflows.length;
    productivityEl.textContent = `${avgWorkflowCompletion}%`;
    onTimeEl.textContent = `${onTime}%`;
    healthEl.textContent = healthScore >= 85 ? 'Healthy' : healthScore >= 65 ? 'At Risk' : 'Delayed';
    healthEl.style.color = healthScore >= 85 ? 'var(--teal-900)' : healthScore >= 65 ? '#c98a12' : 'var(--red)';

    const teams = new Map();
    workflows.forEach(workflow => {
      (workflow.teams || []).forEach(team => {
        if (!teams.has(team.id)) {
          teams.set(team.id, { name: team.name, allocated: 0, completed: 0, estimated: 0, actualScore: 0 });
        }
      });
      (workflow.tasks || []).forEach(task => {
        const teamId = task.assigned_team_id;
        if (!teamId || !teams.has(teamId)) return;
        const row = teams.get(teamId);
        row.allocated += 1;
        row.estimated += parseFloat(task.estimated_hours || 0);
        row.actualScore += parseInt(task.completion_percentage || 0, 10);
        if (task.status === 'Completed') row.completed += 1;
      });
    });

    const rows = Array.from(teams.values())
      .filter(team => team.allocated > 0)
      .sort((a, b) => (b.completed / b.allocated) - (a.completed / a.allocated))
      .slice(0, 5);

    teamList.innerHTML = rows.length ? rows.map(team => {
      const efficiency = team.allocated ? Math.round(team.actualScore / team.allocated) : 0;
      return `
        <tr>
          <td class="task-name">${team.name}</td>
          <td>${team.allocated}</td>
          <td>${team.completed}</td>
          <td>
            <div class="row-progress">
              <div class="progress-track"><div class="progress-fill" style="width:${Math.min(efficiency, 100)}%"></div></div>
              <span>${efficiency}%</span>
            </div>
          </td>
        </tr>
      `;
    }).join('') : '<tr><td colspan="4" style="text-align:center;padding:18px;color:var(--text-muted);">No workflow team analytics yet</td></tr>';
  };

  fetch('/api/v1/admin/tasks/workflows', { credentials: 'include' })
    .then(res => res.json())
    .then(data => {
      if (!data.success) throw new Error(data.message || 'Workflow load failed');
      render(data.data.workflows || [], data.data.employees || []);
      renderPerformanceIntelligence(data.data.workflows || []);
    })
    .catch(error => {
      console.error('Dashboard workflow load failed:', error);
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted);">Unable to load workflow tasks</td></tr>';
    });

  // Load real KPI counts
  fetch('/api/v1/admin/employees/dashboard-summary', { credentials: 'include' })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        const totalEmp = document.getElementById('stat-total-employees');
        if (totalEmp) totalEmp.textContent = data.totalEmployees;
        const attRate = document.getElementById('stat-attendance-rate');
        if (attRate) attRate.textContent = `${data.attendanceRate}%`;
        const projComp = document.getElementById('stat-project-completion');
        if (projComp) projComp.textContent = `${data.projectCompletion}%`;
        const fill = document.getElementById('stat-project-completion-fill');
        if (fill) fill.style.width = `${data.projectCompletion}%`;
        const actLeave = document.getElementById('stat-active-leave');
        if (actLeave) actLeave.textContent = data.activeLeaves;
        const leaveSub = document.getElementById('stat-active-leave-sub');
        if (leaveSub) leaveSub.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${data.activeLeaves} pending approvals`;
      }
    })
    .catch(err => console.error("Error loading dashboard summary:", err));
});
