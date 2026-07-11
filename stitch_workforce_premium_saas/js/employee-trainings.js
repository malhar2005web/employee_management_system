// employee-trainings.js — View Assigned Training Programs, Mark Complete

(async function () {
    document.getElementById('logout-btn').addEventListener('click', async () => {
        await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' });
        window.location.href = '/login.html';
    });

    let allTrainings = [];
    let activeFilter = 'all';

    function showToast(msg, type = 'success') {
        const t = document.createElement('div');
        t.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:9999;padding:12px 20px;border-radius:10px;font-weight:700;font-size:13.5px;color:#fff;background:${type === 'success' ? '#23b899' : '#e05252'};box-shadow:0 4px 20px rgba(0,0,0,0.15);transition:opacity 0.4s;`;
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, 3000);
    }

    async function loadTrainings() {
        try {
            const res = await fetch('/api/v1/employee/trainings', { credentials: 'include' });
            const data = await res.json();
            allTrainings = data.success ? data.data : [];
            updateCards();
            renderGrid();
        } catch (e) {
            console.error(e);
        }
    }

    function updateCards() {
        const total = allTrainings.length;
        const done = allTrainings.filter(t => t.status === 'Completed').length;
        const pending = allTrainings.filter(t => t.status === 'Pending' || t.status === 'In Progress').length;
        const rate = total > 0 ? Math.round((done / total) * 100) : 0;

        document.getElementById('count-total-tr').textContent = total;
        document.getElementById('count-done-tr').textContent = done;
        document.getElementById('count-pending-tr').textContent = pending;
        document.getElementById('completion-rate').textContent = rate + '%';
    }

    function renderGrid() {
        const grid = document.getElementById('training-grid');
        const filtered = activeFilter === 'all' ? allTrainings : allTrainings.filter(t => t.status === activeFilter);

        if (!filtered.length) {
            grid.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:48px;grid-column:1/-1;">No training programs assigned yet.</div>';
            return;
        }

        const levelColors = { 'Beginner': '#4ade80', 'Intermediate': '#60a5fa', 'Advanced': '#f87171' };
        const statusClass = { 'Completed': 'done', 'In Progress': 'progress', 'Pending': 'pending', 'Overdue': 'rejected' };

        grid.innerHTML = filtered.map(t => {
            const dueStr = t.due_date ? new Date(t.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
            const completedStr = t.completed_at ? new Date(t.completed_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : null;
            const isCompleted = t.status === 'Completed';
            const level = t.level || 'Beginner';
            const levelColor = levelColors[level] || '#4ade80';
            const icon = t.training_type === 'Online' ? 'fa-laptop-code' : t.training_type === 'Classroom' ? 'fa-chalkboard-teacher' : 'fa-graduation-cap';
            return `
                <div class="card" style="padding:22px;display:flex;flex-direction:column;gap:14px;position:relative;overflow:hidden;">
                    ${isCompleted ? '<div style="position:absolute;top:12px;right:12px;background:rgba(74,222,128,0.15);border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;"><i class="fa-solid fa-circle-check" style="color:#4ade80;font-size:16px;"></i></div>' : ''}
                    <div style="display:flex;align-items:flex-start;gap:14px;">
                        <div style="width:46px;height:46px;border-radius:12px;background:rgba(99,102,241,0.15);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                            <i class="fa-solid ${icon}" style="color:#818cf8;font-size:18px;"></i>
                        </div>
                        <div>
                            <div style="font-size:15px;font-weight:800;color:var(--teal-900);">${t.title || 'Training Course'}</div>
                            <div style="font-size:12px;color:var(--text-muted);margin-top:3px;">${t.training_type || 'Self-Paced'} · ${t.duration_days || '—'} days</div>
                        </div>
                    </div>
                    ${t.description ? `<div style="font-size:13px;color:var(--text-body);line-height:1.5;">${t.description}</div>` : ''}
                    <div style="display:flex;gap:8px;flex-wrap:wrap;">
                        <span style="background:rgba(99,102,241,0.12);color:#818cf8;padding:3px 10px;border-radius:20px;font-size:11.5px;font-weight:700;">${t.category || 'General'}</span>
                        <span style="background:rgba(0,0,0,0.06);color:${levelColor};padding:3px 10px;border-radius:20px;font-size:11.5px;font-weight:700;">${level}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <div style="font-size:12px;color:var(--text-muted);">
                            ${isCompleted && completedStr ? `<i class="fa-regular fa-calendar-check"></i> Completed: ${completedStr}` : `<i class="fa-regular fa-clock"></i> Due: ${dueStr}`}
                        </div>
                        <span class="status-pill ${statusClass[t.status] || 'pending'}">${t.status || 'Pending'}</span>
                    </div>
                    ${!isCompleted ? `<button class="btn-primary" style="font-size:12.5px;padding:9px 14px;" onclick="markComplete(${t.id})"><i class="fa-solid fa-circle-check"></i> Mark as Completed</button>` : ''}
                </div>
            `;
        }).join('');
    }

    window.markComplete = async function (id) {
        if (!confirm('Mark this training as completed?')) return;
        try {
            const res = await fetch(`/api/v1/employee/trainings/${id}/complete`, {
                method: 'PUT', credentials: 'include',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (data.success) {
                showToast('Training marked as completed! 🎓', 'success');
                await loadTrainings();
            } else {
                showToast(data.message || 'Failed to update', 'error');
            }
        } catch (e) {
            showToast('Network error', 'error');
        }
    };

    // Filter tabs
    document.getElementById('training-filter-tabs').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-filter]');
        if (!btn) return;
        document.querySelectorAll('#training-filter-tabs button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeFilter = btn.dataset.filter;
        renderGrid();
    });

    await loadTrainings();
})();
