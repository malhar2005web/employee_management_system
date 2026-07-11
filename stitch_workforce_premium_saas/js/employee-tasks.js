// employee-tasks.js — My Assigned Tasks, Update Progress

(async function () {
    document.getElementById('logout-btn').addEventListener('click', async () => {
        await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' });
        window.location.href = '/login.html';
    });

    let allTasks = [];
    let statusFilter = 'all';
    let priorityFilter = 'all';

    function showToast(msg, type = 'success') {
        const t = document.createElement('div');
        t.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:9999;padding:12px 20px;border-radius:10px;font-weight:700;font-size:13.5px;color:#fff;background:${type === 'success' ? '#23b899' : '#e05252'};box-shadow:0 4px 20px rgba(0,0,0,0.15);transition:opacity 0.4s;`;
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, 3000);
    }

    async function loadTasks() {
        try {
            const res = await fetch('/api/v1/employee/tasks', { credentials: 'include' });
            const data = await res.json();
            allTasks = data.success ? data.data : [];
            updateCards();
            renderTable();
        } catch (e) {
            console.error(e);
        }
    }

    function updateCards() {
        const now = new Date();
        const elTotal = document.getElementById('count-total');
        const elInProgress = document.getElementById('count-inprogress');
        const elCompleted = document.getElementById('count-completed');
        const elOverdue = document.getElementById('count-overdue');

        if (elTotal) elTotal.textContent = allTasks.length;
        if (elInProgress) elInProgress.textContent = allTasks.filter(t => t.status === 'In Progress').length;
        if (elCompleted) elCompleted.textContent = allTasks.filter(t => t.status === 'Completed').length;
        if (elOverdue) elOverdue.textContent = allTasks.filter(t => {
            return t.status !== 'Completed' && t.due_date && new Date(t.due_date) < now;
        }).length;
    }

    function renderTable() {
        const tbody = document.getElementById('tasks-tbody');
        let filtered = allTasks;
        if (statusFilter !== 'all') filtered = filtered.filter(t => t.status === statusFilter);
        if (priorityFilter !== 'all') filtered = filtered.filter(t => t.priority === priorityFilter);

        if (!filtered.length) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:32px;">No tasks found for selected filters.</td></tr>';
            return;
        }

        const now = new Date();
        tbody.innerHTML = filtered.map(t => {
            const due = t.due_date ? new Date(t.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
            const isOverdue = t.due_date && new Date(t.due_date) < now && t.status !== 'Completed';
            const priorityClass = (t.priority || '').toLowerCase();
            const statusClass = t.status === 'Completed' ? 'done' : t.status === 'In Progress' ? 'progress' : t.status === 'On Hold' ? 'pending' : 'to-do';
            const pct = t.completion_percentage || 0;
            return `<tr>
                <td><strong>${t.title || 'Untitled'}</strong></td>
                <td style="color:var(--text-muted);font-size:12.5px;">${t.project_id || '—'}</td>
                <td><span class="priority-pill ${priorityClass}">${t.priority || 'Normal'}</span></td>
                <td style="${isOverdue ? 'color:#f87171;font-weight:700;' : ''}">${isOverdue ? '⚠ ' : ''}${due}</td>
                <td>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <div class="progress-track" style="width:80px;"><div class="progress-fill" style="width:${pct}%;"></div></div>
                        <span style="font-size:12px;color:var(--text-muted);">${pct}%</span>
                    </div>
                </td>
                <td><span class="status-pill ${statusClass}">${t.status || 'To Do'}</span></td>
                <td>
                    <button class="action-pill approve" onclick="openProgressModal(${t.id}, '${(t.title||'').replace(/'/g,"\\'")}', ${pct}, '${t.status||'To Do'}', '${(t.work_done||'').replace(/'/g,"\\'")}')">
                        <i class="fa-solid fa-pen"></i> Update
                    </button>
                </td>
            </tr>`;
        }).join('');
    }

    // Status filter tabs
    document.getElementById('task-filter-tabs').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-status]');
        if (!btn) return;
        document.querySelectorAll('#task-filter-tabs button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        statusFilter = btn.dataset.status;
        renderTable();
    });

    // Priority filter tabs
    document.getElementById('task-priority-tabs').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-priority]');
        if (!btn) return;
        document.querySelectorAll('#task-priority-tabs button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        priorityFilter = btn.dataset.priority;
        renderTable();
    });

    // Toggle work_done textbox based on status
    const statusSelect = document.getElementById('progress-status');
    const workDoneGroup = document.getElementById('work-done-group');
    statusSelect.addEventListener('change', () => {
        if (statusSelect.value === 'In Progress') {
            workDoneGroup.style.display = 'block';
        } else {
            workDoneGroup.style.display = 'none';
        }
    });

    const slider = document.getElementById('progress-slider');
    function updateSliderBackground() {
        const val = slider.value;
        slider.style.background = `linear-gradient(to right, var(--teal-600) 0%, var(--teal-600) ${val}%, rgba(0,0,0,0.08) ${val}%, rgba(0,0,0,0.08) 100%)`;
    }

    // --- Progress Modal ---
    window.openProgressModal = function (id, title, pct, status, workDone) {
        document.getElementById('progress-task-id').value = id;
        document.getElementById('progress-task-name').textContent = title;
        document.getElementById('progress-slider').value = pct;
        document.getElementById('progress-val-label').textContent = pct;
        document.getElementById('progress-status').value = status;
        document.getElementById('progress-work-done').value = workDone || '';
        
        updateSliderBackground();
        
        if (status === 'In Progress') {
            workDoneGroup.style.display = 'block';
        } else {
            workDoneGroup.style.display = 'none';
        }
        document.getElementById('modal-progress').style.display = 'flex';
    };

    document.getElementById('progress-slider').addEventListener('input', function () {
        document.getElementById('progress-val-label').textContent = this.value;
        updateSliderBackground();
    });

    ['close-progress-modal', 'close-progress-2'].forEach(id => {
        document.getElementById(id).addEventListener('click', () => {
            document.getElementById('modal-progress').style.display = 'none';
        });
    });

    document.getElementById('submit-progress').addEventListener('click', async () => {
        const id = document.getElementById('progress-task-id').value;
        const progress = document.getElementById('progress-slider').value;
        const status = document.getElementById('progress-status').value;
        const work_done = document.getElementById('progress-work-done').value;

        try {
            const res = await fetch(`/api/v1/employee/tasks/${id}/progress`, {
                method: 'PUT', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ progress, status, work_done })
            });
            const data = await res.json();
            if (data.success) {
                showToast('Progress saved!', 'success');
                document.getElementById('modal-progress').style.display = 'none';
                await loadTasks();
            } else {
                showToast(data.message || 'Failed to save', 'error');
            }
        } catch (e) {
            showToast('Network error', 'error');
        }
    });

    await loadTasks();
})();
