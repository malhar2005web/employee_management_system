// employee-goals.js — View Goals, Update Self Assessment

(async function () {
    document.getElementById('logout-btn').addEventListener('click', async () => {
        await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' });
        window.location.href = '/login.html';
    });

    let allGoals = [];
    let activeFilter = 'all';

    function showToast(msg, type = 'success') {
        const t = document.createElement('div');
        t.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:9999;padding:12px 20px;border-radius:10px;font-weight:700;font-size:13.5px;color:#fff;background:${type === 'success' ? '#23b899' : '#e05252'};box-shadow:0 4px 20px rgba(0,0,0,0.15);transition:opacity 0.4s;`;
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, 3000);
    }

    async function loadGoals() {
        try {
            const res = await fetch('/api/v1/employee/goals', { credentials: 'include' });
            const data = await res.json();
            allGoals = data.success ? data.data : [];
            updateCards();
            renderGrid();
        } catch (e) {
            console.error(e);
        }
    }

    function updateCards() {
        const now = new Date();
        const thisMonth = now.getMonth();
        const thisYear = now.getFullYear();
        const active = allGoals.filter(g => g.status !== 'Achieved');
        const achieved = allGoals.filter(g => g.status === 'Achieved');
        const avgPct = allGoals.length ? Math.round(allGoals.reduce((s, g) => s + (parseFloat(g.progress) || 0), 0) / allGoals.length) : 0;
        const dueThisMonth = allGoals.filter(g => {
            if (!g.end_date) return false;
            const d = new Date(g.end_date);
            return d.getMonth() === thisMonth && d.getFullYear() === thisYear && g.status !== 'Achieved';
        });

        document.getElementById('count-active').textContent = active.length;
        document.getElementById('count-achieved').textContent = achieved.length;
        document.getElementById('avg-progress').textContent = avgPct + '%';
        document.getElementById('count-due').textContent = dueThisMonth.length;
    }

    function renderGrid() {
        const grid = document.getElementById('goals-grid');
        const filtered = activeFilter === 'all' ? allGoals : allGoals.filter(g => {
            if (activeFilter === 'active') return g.status !== 'Achieved';
            if (activeFilter === 'achieved') return g.status === 'Achieved';
            return true;
        });

        if (!filtered.length) {
            grid.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:48px;grid-column:1/-1;">No goals assigned yet. Your manager will set goals for you.</div>';
            return;
        }

        grid.innerHTML = filtered.map(g => {
            const pct = parseFloat(g.progress) || 0;
            const endDate = g.end_date ? new Date(g.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
            const isAchieved = g.status === 'Achieved';
            const isOverdue = g.end_date && new Date(g.end_date) < new Date() && !isAchieved;
            const statusColor = isAchieved ? '#4ade80' : isOverdue ? '#f87171' : 'var(--teal-600)';
            return `
                <div class="card" style="padding:20px;display:flex;flex-direction:column;gap:14px;">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
                        <div>
                            <div style="font-size:15px;font-weight:800;color:var(--teal-900);">${g.title || 'Goal'}</div>
                            <div style="font-size:12px;color:var(--text-muted);margin-top:3px;">${g.category || 'Performance'} · Due: ${endDate}</div>
                        </div>
                        <span class="status-pill ${isAchieved ? 'done' : isOverdue ? 'rejected' : 'progress'}" style="white-space:nowrap;">${g.status || 'Active'}</span>
                    </div>
                    ${g.description ? `<div style="font-size:13px;color:var(--text-body);line-height:1.5;">${g.description}</div>` : ''}
                    <div>
                        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                            <span style="font-size:12.5px;font-weight:700;color:var(--text-muted);">Progress</span>
                            <span style="font-size:12.5px;font-weight:800;color:${statusColor};">${pct.toFixed(0)}%</span>
                        </div>
                        <div class="progress-track" style="height:8px;"><div class="progress-fill" style="width:${pct}%;background:${statusColor};"></div></div>
                    </div>
                    ${g.self_assessment ? `<div style="background:rgba(255,255,255,0.25);border-radius:8px;padding:10px;font-size:12.5px;color:var(--text-body);border-left:3px solid var(--teal-600);"><strong>Self Assessment:</strong> ${g.self_assessment}</div>` : ''}
                    ${!isAchieved ? `<button class="btn-primary" style="font-size:12.5px;padding:8px 14px;" onclick="openAssessment(${g.id}, '${(g.title||'').replace(/'/g,"\\'")}', ${pct}, '${g.self_assessment||''}')"><i class="fa-solid fa-pen-to-square"></i> Update Assessment</button>` : `<div style="text-align:center;font-size:12.5px;font-weight:700;color:#4ade80;"><i class="fa-solid fa-trophy"></i> Goal Achieved!</div>`}
                </div>
            `;
        }).join('');
    }

    // --- Self Assessment Modal ---
    window.openAssessment = function (id, title, pct, existing) {
        document.getElementById('assessment-goal-id').value = id;
        document.getElementById('assessment-goal-name').textContent = title;
        document.getElementById('assess-progress-slider').value = pct;
        document.getElementById('assess-progress-label').textContent = Math.round(pct);
        document.getElementById('assess-text').value = existing || '';
        document.getElementById('modal-assessment').style.display = 'flex';
    };

    document.getElementById('assess-progress-slider').addEventListener('input', function () {
        document.getElementById('assess-progress-label').textContent = this.value;
    });

    ['close-assessment-modal', 'close-assessment-2'].forEach(id => {
        document.getElementById(id).addEventListener('click', () => {
            document.getElementById('modal-assessment').style.display = 'none';
        });
    });

    document.getElementById('submit-assessment').addEventListener('click', async () => {
        const id = document.getElementById('assessment-goal-id').value;
        const selfAssessment = document.getElementById('assess-text').value.trim();
        const progress = document.getElementById('assess-progress-slider').value;

        try {
            const res = await fetch(`/api/v1/employee/goals/${id}/self-assessment`, {
                method: 'PUT', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ selfAssessment, progress })
            });
            const data = await res.json();
            if (data.success) {
                showToast('Assessment saved!', 'success');
                document.getElementById('modal-assessment').style.display = 'none';
                await loadGoals();
            } else {
                showToast(data.message || 'Failed to save', 'error');
            }
        } catch (e) {
            showToast('Network error', 'error');
        }
    });

    await loadGoals();
})();
