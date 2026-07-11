// employee-leave.js — Leave Balances, Apply Leave, Leave History

(async function () {
    document.getElementById('logout-btn').addEventListener('click', async () => {
        await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' });
        window.location.href = '/login.html';
    });

    let leaveTypes = [];
    let allLeaves = [];
    let activeFilter = 'all';

    function showToast(msg, type = 'success') {
        const t = document.createElement('div');
        t.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:9999;padding:12px 20px;border-radius:10px;font-weight:700;font-size:13.5px;color:#fff;background:${type === 'success' ? '#23b899' : '#e05252'};box-shadow:0 4px 20px rgba(0,0,0,0.15);transition:opacity 0.4s;`;
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, 3000);
    }

    // --- Load Leave Balances ---
    async function loadBalances() {
        try {
            const res = await fetch('/api/v1/employee/leaves/balances', { credentials: 'include' });
            const data = await res.json();
            const grid = document.getElementById('leave-balance-grid');
            const typeSelect = document.getElementById('leave-type-select');

            if (!data.success || !data.data.length) {
                grid.innerHTML = '<div class="card stat-card"><div class="stat-card-top"><span class="label">No Leave Balance Data</span><div class="stat-icon teal"><i class="fa-solid fa-leaf"></i></div></div><div class="stat-value">—</div></div>';
                return;
            }

            leaveTypes = data.data;
            const colors = ['teal', 'amber', 'blue', 'green'];
            grid.innerHTML = data.data.map((lb, i) => `
                <div class="card stat-card">
                    <div class="stat-card-top">
                        <span class="label">${lb.leave_type_name || 'Leave'}</span>
                        <div class="stat-icon ${colors[i % colors.length]}"><i class="fa-solid fa-leaf"></i></div>
                    </div>
                    <div class="stat-value">${parseFloat(lb.remaining_days).toFixed(1)}</div>
                    <div class="stat-sub flat">of ${parseFloat(lb.total_days || 0).toFixed(0)} days remaining</div>
                    <div class="progress-track"><div class="progress-fill" style="width:${Math.min(100, (lb.remaining_days / (lb.total_days || 1)) * 100)}%"></div></div>
                </div>
            `).join('');

            typeSelect.innerHTML = '<option value="">Select leave type...</option>' +
                data.data.map(lb => `<option value="${lb.leave_type_id}">${lb.leave_type_name} (${parseFloat(lb.remaining_days).toFixed(1)} days left)</option>`).join('');
        } catch (e) {
            console.error(e);
        }
    }

    // --- Load Leave History ---
    async function loadHistory() {
        try {
            const res = await fetch('/api/v1/employee/leaves/history', { credentials: 'include' });
            const data = await res.json();
            allLeaves = data.success ? data.data : [];
            renderTable();
        } catch (e) {
            console.error(e);
        }
    }

    function renderTable() {
        const tbody = document.getElementById('leave-tbody');
        const filtered = activeFilter === 'all' ? allLeaves : allLeaves.filter(l => l.status === activeFilter);

        if (!filtered.length) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:32px;">No leave records found.</td></tr>';
            return;
        }

        tbody.innerHTML = filtered.map(l => {
            const from = new Date(l.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
            const to = new Date(l.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
            const applied = new Date(l.created_at || l.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
            const diffMs = new Date(l.end_date) - new Date(l.start_date);
            const days = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);
            const statusClass = l.status === 'Approved' ? 'done' : l.status === 'Rejected' ? 'rejected' : 'pending';
            return `<tr>
                <td><strong>${l.leave_type_name || 'Leave'}</strong></td>
                <td>${from}</td>
                <td>${to}</td>
                <td>${days}</td>
                <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${l.reason || '—'}</td>
                <td>${applied}</td>
                <td><span class="status-pill ${statusClass}">${l.status}</span></td>
            </tr>`;
        }).join('');
    }

    // --- Tab Filters ---
    document.getElementById('leave-tabs').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-filter]');
        if (!btn) return;
        document.querySelectorAll('#leave-tabs button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeFilter = btn.dataset.filter;
        renderTable();
    });

    // --- Apply Leave Modal ---
    document.getElementById('btn-apply-leave').addEventListener('click', () => {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('leave-from').min = today;
        document.getElementById('leave-to').min = today;
        document.getElementById('modal-leave').style.display = 'flex';
    });

    ['close-leave-modal', 'close-leave-2'].forEach(id => {
        document.getElementById(id).addEventListener('click', () => {
            document.getElementById('modal-leave').style.display = 'none';
        });
    });

    // Preview days
    ['leave-from', 'leave-to'].forEach(id => {
        document.getElementById(id).addEventListener('change', () => {
            const from = document.getElementById('leave-from').value;
            const to = document.getElementById('leave-to').value;
            if (from && to) {
                const diff = Math.round((new Date(to) - new Date(from)) / (1000 * 60 * 60 * 24)) + 1;
                document.getElementById('leave-days-preview').textContent = diff > 0 ? `${diff} day(s) will be applied` : '';
            }
        });
    });

    document.getElementById('submit-leave').addEventListener('click', async () => {
        const leaveTypeId = document.getElementById('leave-type-select').value;
        const startDate = document.getElementById('leave-from').value;
        const endDate = document.getElementById('leave-to').value;
        const reason = document.getElementById('leave-reason').value.trim();

        if (!leaveTypeId || !startDate || !endDate) {
            showToast('Please fill all required fields', 'error'); return;
        }
        if (new Date(endDate) < new Date(startDate)) {
            showToast('End date cannot be before start date', 'error'); return;
        }

        try {
            const res = await fetch('/api/v1/employee/leaves/apply', {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ leaveTypeId, startDate, endDate, reason })
            });
            const data = await res.json();
            if (data.success) {
                showToast('Leave application submitted!', 'success');
                document.getElementById('modal-leave').style.display = 'none';
                document.getElementById('leave-type-select').value = '';
                document.getElementById('leave-from').value = '';
                document.getElementById('leave-to').value = '';
                document.getElementById('leave-reason').value = '';
                await loadHistory();
            } else {
                showToast(data.message || 'Application failed', 'error');
            }
        } catch (e) {
            showToast('Network error', 'error');
        }
    });

    await Promise.all([loadBalances(), loadHistory()]);
})();
