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
    const completedValEl = document.getElementById('kpi-val-completed');
    const productivityValEl = document.getElementById('kpi-val-productivity');
    const healthValEl = document.getElementById('kpi-val-health');
    const leadTimeValEl = document.getElementById('kpi-val-leadtime');
    const totalWorkflowsEl = document.getElementById('kpi-val-total-workflows');
    const teamList = document.getElementById('team-performance-list');

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
    const healthScore = allTasks.length
      ? Math.max(0, Math.round(100 - ((blockedTasks.length + overdueTasks.length) / allTasks.length) * 100))
      : 100;

    if (completedValEl) completedValEl.textContent = completedTasks.length;
    if (productivityValEl) productivityValEl.textContent = `${avgWorkflowCompletion}%`;
    if (healthValEl) healthValEl.textContent = `${healthScore}%`;

    const piAiTextEl = document.getElementById('pi-ai-text');
    if (piAiTextEl) {
      if (workflows.length === 0) {
        piAiTextEl.textContent = 'No active workflows created yet. Click "+ Create Workflow" to begin tracking performance.';
      } else if (overdueTasks.length > 0) {
        piAiTextEl.textContent = `${overdueTasks.length} overdue task(s) detected across ${workflows.length} active workflow(s). Recommendation: Review task timelines and reassign if necessary.`;
      } else {
        piAiTextEl.textContent = `All ${workflows.length} active workflow(s) running efficiently with 0 overdue tasks. System status: Optimal.`;
      }
    }

    // 1. Avg Lead Time & Workflow Stats
    let totalLeadTime = 0;
    let completedLeadCount = 0;
    workflows.forEach(w => {
      (w.tasks || []).forEach(t => {
        if (t.status === 'Completed' && Array.isArray(t.status_history)) {
          const start = t.status_history.find(h => h.status === 'In Progress')?.changed_at;
          const end = t.status_history.find(h => h.status === 'Completed')?.changed_at;
          if (start && end) {
            const diffDays = (new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24);
            if (diffDays > 0) {
              totalLeadTime += diffDays;
              completedLeadCount++;
            }
          }
        }
      });
    });
    const avgLeadTime = completedLeadCount > 0 ? (totalLeadTime / completedLeadCount).toFixed(1) : '0.0';
    if (leadTimeValEl) leadTimeValEl.textContent = `${avgLeadTime}d`;
    if (totalWorkflowsEl) totalWorkflowsEl.textContent = `${workflows.length} Total Workflows`;

    // 2. Stacked status bars breakdown
    let running = 0, planning = 0, testing = 0, completed = 0, blocked = 0;
    workflows.forEach(w => {
      const status = w.status || 'Planning';
      if (status === 'In Progress' || status === 'Running') running++;
      else if (status === 'Planning') planning++;
      else if (status === 'Testing') testing++;
      else if (status === 'Completed') completed++;
      else if (status === 'Blocked') blocked++;
    });

    const totalWf = workflows.length;
    const runningPct = totalWf ? Math.round((running / totalWf) * 100) : 0;
    const planningPct = totalWf ? Math.round((planning / totalWf) * 100) : 0;
    const testingPct = totalWf ? Math.round((testing / totalWf) * 100) : 0;
    const completedPct = totalWf ? Math.round((completed / totalWf) * 100) : 0;
    const blockedPct = totalWf ? Math.round((blocked / totalWf) * 100) : 0;

    const setWfStatus = (stage, count, pct) => {
      const txt = document.getElementById(`wf-count-${stage}`);
      const fill = document.getElementById(`wf-fill-${stage}`);
      if (txt) txt.textContent = `${count} Workflows (${pct}%)`;
      if (fill) fill.style.width = `${pct}%`;
    };
    setWfStatus('running', running, runningPct);
    setWfStatus('planning', planning, planningPct);
    setWfStatus('testing', testing, testingPct);
    setWfStatus('completed', completed, completedPct);
    setWfStatus('blocked', blocked, blockedPct);

    // 3. Insight chips
    const insightAvgTime = document.getElementById('wf-insight-avg-time');
    if (insightAvgTime) insightAvgTime.textContent = `${avgLeadTime} Days`;

    const wTeamsMap = new Map();
    workflows.forEach(w => {
      (w.teams || []).forEach(team => {
        wTeamsMap.set(team.id, team.name);
      });
    });

    const stageDelays = { Development: 0, Testing: 0, Support: 0, Design: 0 };
    allTasks.forEach(t => {
      if (t.status === 'Blocked' || t.status === 'Delayed') {
        const teamName = wTeamsMap.get(t.assigned_team_id) || '';
        if (teamName.includes('Dev') || teamName.includes('Eng')) stageDelays.Development++;
        else if (teamName.includes('Test') || teamName.includes('QA')) stageDelays.Testing++;
        else if (teamName.includes('Support')) stageDelays.Support++;
        else if (teamName.includes('Design')) stageDelays.Design++;
      }
    });
    let bottleneck = 'None';
    let maxDelay = 0;
    for (const [stage, count] of Object.entries(stageDelays)) {
      if (count > maxDelay) {
        maxDelay = count;
        bottleneck = stage;
      }
    }
    const bottleneckEl = document.getElementById('wf-insight-bottleneck');
    if (bottleneckEl) bottleneckEl.textContent = bottleneck;

    let longestWfName = 'None';
    let maxDuration = 0;
    workflows.forEach(w => {
      const created = w.created_at ? new Date(w.created_at) : null;
      if (created) {
        let end = new Date();
        if (w.status === 'Completed' && w.updated_at) {
          end = new Date(w.updated_at);
        }
        const diffDays = Math.round((end - created) / (1000 * 60 * 60 * 24));
        if (diffDays > maxDuration) {
          maxDuration = diffDays;
          longestWfName = `${w.name} (${diffDays}d)`;
        }
      }
    });
    const longestWfEl = document.getElementById('wf-insight-longest');
    if (longestWfEl) longestWfEl.textContent = longestWfName;

    // 4. Team utilization table (Full 8 columns)
    const teams = new Map();
    workflows.forEach(workflow => {
      (workflow.teams || []).forEach(team => {
        if (!teams.has(team.id)) {
          teams.set(team.id, { 
            name: team.name, 
            allocated: 0, 
            completed: 0, 
            delayed: 0,
            actualScore: 0,
            durations: []
          });
        }
      });
      (workflow.tasks || []).forEach(task => {
        const teamId = task.assigned_team_id;
        if (!teamId || !teams.has(teamId)) return;
        const row = teams.get(teamId);
        row.allocated += 1;
        row.actualScore += parseInt(task.completion_percentage || 0, 10);
        if (task.status === 'Completed') {
          row.completed += 1;
        }
        if (task.deadline && task.status !== 'Completed') {
          if (new Date(task.deadline) < new Date()) {
            row.delayed += 1;
          }
        }
        if (Array.isArray(task.status_history)) {
          const start = task.status_history.find(h => h.status === 'In Progress')?.changed_at;
          const end = task.status_history.find(h => h.status === 'Completed')?.changed_at;
          if (start && end) {
            row.durations.push((new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24));
          }
        }
      });
    });

    const rows = Array.from(teams.values()).filter(team => team.allocated > 0);

    if (teamList) {
      teamList.innerHTML = rows.length ? rows.map(team => {
        const efficiency = team.allocated ? Math.round(team.actualScore / team.allocated) : 0;
        const delayed = team.delayed;
        const avgAge = team.durations.length ? (team.durations.reduce((sum, d) => sum + d, 0) / team.durations.length).toFixed(1) + 'd' : '0.0d';
        const utilization = team.allocated > 5 ? '92%' : team.allocated > 2 ? '74%' : '45%';
        const risk = team.delayed > 2 ? 'High' : team.delayed > 0 ? 'Medium' : 'Low';
        const riskColor = risk === 'High' ? '#ef4444' : risk === 'Medium' ? '#f59e0b' : '#10b981';
        
        return `
          <tr style="cursor: pointer; font-size: 12.5px; border-bottom: 1px solid rgba(0,0,0,0.04);" onclick="window.location.href='/admin-organization.html'">
            <td style="padding: 10px 8px; font-weight: 800; color: var(--teal-900);">${team.name}</td>
            <td style="padding: 10px 8px; font-weight: 700;">${team.allocated}</td>
            <td style="padding: 10px 8px; font-weight: 700; color: #10b981;">${team.completed}</td>
            <td style="padding: 10px 8px; font-weight: 700; color: #ef4444;">${delayed}</td>
            <td style="padding: 10px 8px; font-weight: 800;">${efficiency}%</td>
            <td style="padding: 10px 8px; font-weight: 700;">${utilization}</td>
            <td style="padding: 10px 8px;"><span class="status-pill" style="background: ${riskColor}20; color: ${riskColor}; font-size: 10.5px; font-weight: 800;">${risk}</span></td>
            <td style="padding: 10px 8px; font-weight: 700; color: var(--text-muted);">${avgAge}</td>
          </tr>
        `;
      }).join('') : '<tr><td colspan="8" style="text-align:center;padding:18px;color:var(--text-muted);">No workflow team analytics yet</td></tr>';
    }
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

  // Load Real Recent Activity Log
  const loadRecentActivity = () => {
    const listEl = document.getElementById('recent-activity-list');
    if (!listEl) return;

    fetch('/api/v1/admin/audit/actions', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (!data.success || !Array.isArray(data.data?.audits) || data.data.audits.length === 0) {
          listEl.innerHTML = `
            <div style="text-align:center; padding:24px 12px; color:var(--text-muted); font-size:13px;">
              <i class="fa-solid fa-clock-rotate-left" style="font-size:20px; opacity:0.4; display:block; margin-bottom:6px;"></i>
              No recent activity recorded yet.
            </div>`;
          return;
        }

        const audits = data.data.audits.slice(0, 5);
        listEl.innerHTML = audits.map(item => {
          const actionText = (item.action || 'SYSTEM_EVENT').replace(/_/g, ' ').toLowerCase();
          const desc = item.description || (item.full_name ? `Action by ${item.full_name}` : 'System action');
          const timeAgo = formatTimeAgo(item.created_at);
          
          let iconClass = 'grey';
          let iconFa = 'fa-file-lines';
          
          if (item.action?.includes('SESSION') || item.action?.includes('START')) {
            iconClass = 'green';
            iconFa = 'fa-play';
          } else if (item.action?.includes('PAUSE') || item.action?.includes('STOP')) {
            iconClass = 'yellow';
            iconFa = 'fa-pause';
          } else if (item.action?.includes('ALERT') || item.action?.includes('WARN')) {
            iconClass = 'red';
            iconFa = 'fa-triangle-exclamation';
          } else if (item.action?.includes('USER') || item.action?.includes('EMPLOYEE')) {
            iconClass = 'green';
            iconFa = 'fa-user-check';
          }

          return `
            <div class="activity-item">
              <div class="activity-icon ${iconClass}"><i class="fa-solid ${iconFa}"></i></div>
              <div>
                <div class="activity-title" style="text-transform: capitalize;">${actionText}</div>
                <div class="activity-desc">${desc}</div>
                <div class="activity-time">${timeAgo}</div>
              </div>
            </div>
          `;
        }).join('');
      })
      .catch(err => console.error('Error loading recent activity:', err));
  };

  function formatTimeAgo(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} mins ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hours ago`;
    if (diffSec < 172800) return 'Yesterday';
    return `${Math.floor(diffSec / 86400)} days ago`;
  }

  loadRecentActivity();
});
