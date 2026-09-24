// employee-leave.js — Leave Balances, Apply Leave, Leave History

(async function () {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' });
            window.location.href = '/login.html';
        });
    }

    let leaveTypes = [];
    let allLeaves = [];
    let activeFilter = 'all';

    function formatDateDMY(val) {
        if (!val || val === '—' || val === '-') return '—';
        if (typeof val === 'string') {
            const cleanStr = val.split('T')[0];
            if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) {
                const parts = cleanStr.split('-');
                return `${parts[2]}/${parts[1]}/${parts[0]}`;
            }
        }
        try {
            const d = new Date(val);
            if (!isNaN(d.getTime())) {
                const day = String(d.getDate()).padStart(2, '0');
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const year = d.getFullYear();
                return `${day}/${month}/${year}`;
            }
        } catch (e) {}
        return String(val);
    }

    function showToast(msg, type = 'success') {
        const t = document.createElement('div');
        t.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:99999;padding:12px 20px;border-radius:10px;font-weight:700;font-size:13.5px;color:#fff;background:${type === 'success' ? '#23b899' : '#e05252'};box-shadow:0 4px 20px rgba(0,0,0,0.15);transition:opacity 0.4s;`;
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

            if (!data.success || !data.data || !data.data.length) {
                if (grid) {
                    grid.innerHTML = '<div class="card stat-card"><div class="stat-card-top"><span class="label">No Leave Balance Data</span><div class="stat-icon teal"><i class="fa-solid fa-leaf"></i></div></div><div class="stat-value">—</div></div>';
                }
                return;
            }

            leaveTypes = data.data;
            const colors = ['teal', 'amber', 'blue', 'green'];
            if (grid) {
                grid.innerHTML = data.data.map((lb, i) => `
                    <div class="card stat-card">
                        <div class="stat-card-top">
                            <span class="label">${lb.leave_type_name || 'Leave'}</span>
                            <div class="stat-icon ${colors[i % colors.length]}"><i class="fa-solid fa-leaf"></i></div>
                        </div>
                        <div class="stat-value">${parseFloat(lb.remaining_days || 0).toFixed(1)}</div>
                        <div class="stat-sub flat">of ${parseFloat(lb.total_days || 0).toFixed(0)} days remaining</div>
                        <div class="progress-track"><div class="progress-fill" style="width:${Math.min(100, (parseFloat(lb.remaining_days || 0) / (parseFloat(lb.total_days) || 1)) * 100)}%"></div></div>
                    </div>
                `).join('');
            }

            if (typeSelect) {
                typeSelect.innerHTML = '<option value="">Select leave type...</option>' +
                    data.data.map(lb => `<option value="${lb.leave_type_id}">${lb.leave_type_name} (${parseFloat(lb.remaining_days || 0).toFixed(1)} days left)</option>`).join('');
            }
        } catch (e) {
            console.error("loadBalances error:", e);
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
            console.error("loadHistory error:", e);
        }
    }

    function renderTable() {
        const tbody = document.getElementById('leave-tbody');
        if (!tbody) return;
        const filtered = activeFilter === 'all' ? allLeaves : allLeaves.filter(l => l.status === activeFilter);

        if (!filtered.length) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:32px;">No leave records found.</td></tr>';
            return;
        }

        tbody.innerHTML = filtered.map(l => {
            const from = formatDateDMY(l.start_date);
            const to = formatDateDMY(l.end_date);
            const applied = formatDateDMY(l.created_at || l.start_date);
            const diffMs = new Date(l.end_date) - new Date(l.start_date);
            const days = l.total_days || Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);
            const statusClass = l.status === 'Approved' ? 'done' : l.status === 'Rejected' ? 'rejected' : 'pending';
            return `<tr>
                <td><strong>${l.leave_type_name || 'Leave'}</strong></td>
                <td><strong>${from}</strong></td>
                <td><strong>${to}</strong></td>
                <td>${days}</td>
                <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${l.reason || '—'}</td>
                <td>${applied}</td>
                <td><span class="status-pill ${statusClass}">${l.status}</span></td>
            </tr>`;
        }).join('');
    }

    // --- Tab Filters ---
    const leaveTabs = document.getElementById('leave-tabs');
    if (leaveTabs) {
        leaveTabs.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-filter]');
            if (!btn) return;
            document.querySelectorAll('#leave-tabs button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeFilter = btn.dataset.filter;
            renderTable();
        });
    }

    // --- Apply Leave Modal Open & Close Functions ---
    window.openLeaveModal = function () {
        const today = new Date().toISOString().split('T')[0];
        const fromInput = document.getElementById('leave-from');
        const toInput = document.getElementById('leave-to');
        if (fromInput) fromInput.min = today;
        if (toInput) toInput.min = today;

        const mod = document.getElementById('modal-leave');
        if (mod) {
            if (window.openModal) {
                window.openModal(mod);
            } else {
                mod.classList.add('active');
                mod.style.display = 'flex';
                mod.style.opacity = '1';
                mod.style.pointerEvents = 'auto';
            }
        }
    };

    window.closeLeaveModal = function () {
        const mod = document.getElementById('modal-leave');
        if (mod) {
            if (window.closeModal) {
                window.closeModal(mod);
            } else {
                mod.classList.remove('active');
                mod.style.display = 'none';
                mod.style.opacity = '0';
                mod.style.pointerEvents = 'none';
            }
        }
    };

    const btnApplyLeave = document.getElementById('btn-apply-leave');
    if (btnApplyLeave) {
        btnApplyLeave.addEventListener('click', window.openLeaveModal);
    }

    ['close-leave-modal', 'close-leave-2'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('click', window.closeLeaveModal);
        }
    });

    // Preview days
    function updateLeaveDaysPreview() {
        const from = document.getElementById('leave-from')?.value;
        const to = document.getElementById('leave-to')?.value;
        const typeSelect = document.getElementById('leave-type-select');
        const selectedId = typeSelect ? typeSelect.value : '';
        const preview = document.getElementById('leave-days-preview');
        if (!preview) return;

        if (from && to) {
            const selectedType = leaveTypes.find(lt => String(lt.leave_type_id) === String(selectedId));
            const isHalfDay = selectedType && (
                selectedType.leave_type_code === 'LH' || 
                selectedType.leave_type_code === 'H' || 
                (selectedType.leave_type_name && selectedType.leave_type_name.toLowerCase().includes('half'))
            );

            if (isHalfDay) {
                preview.textContent = '0.5 day will be applied (Half Day)';
            } else {
                const diff = Math.round((new Date(to) - new Date(from)) / (1000 * 60 * 60 * 24)) + 1;
                preview.textContent = diff > 0 ? `${diff} day(s) will be applied` : '';
            }
        } else {
            preview.textContent = '';
        }
    }

    ['leave-from', 'leave-to', 'leave-type-select'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', updateLeaveDaysPreview);
        }
    });

    const submitLeaveBtn = document.getElementById('submit-leave');
    if (submitLeaveBtn) {
        submitLeaveBtn.addEventListener('click', async () => {
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
                    showToast('Leave application submitted successfully!', 'success');
                    window.closeLeaveModal();
                    document.getElementById('leave-type-select').value = '';
                    document.getElementById('leave-from').value = '';
                    document.getElementById('leave-to').value = '';
                    document.getElementById('leave-reason').value = '';
                    const preview = document.getElementById('leave-days-preview');
                    if (preview) preview.textContent = '';
                    await loadBalances();
                    await loadHistory();
                } else {
                    showToast(data.message || 'Application failed', 'error');
                }
            } catch (e) {
                showToast('Network error', 'error');
            }
        });
    }

    window.loadBalances = loadBalances;
    window.loadHistory = loadHistory;

    await Promise.all([loadBalances(), loadHistory()]);
})();
