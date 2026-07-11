// employee-timesheets.js — View/Submit Weekly Timesheets

(async function () {
    document.getElementById('logout-btn').addEventListener('click', async () => {
        await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' });
        window.location.href = '/login.html';
    });

    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    function showToast(msg, type = 'success') {
        const t = document.createElement('div');
        t.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:9999;padding:12px 20px;border-radius:10px;font-weight:700;font-size:13.5px;color:#fff;background:${type === 'success' ? '#23b899' : '#e05252'};box-shadow:0 4px 20px rgba(0,0,0,0.15);transition:opacity 0.4s;`;
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, 3000);
    }

    // Set defaults
    const now = new Date();
    document.getElementById('ts-month').value = now.getMonth() + 1;
    document.getElementById('ts-year').value = now.getFullYear();

    // Build daily entries
    function buildDailyEntries() {
        const container = document.getElementById('daily-entries');
        container.innerHTML = DAYS.map(day => `
            <div style="display:grid;grid-template-columns:100px 1fr 80px;align-items:center;gap:10px;">
                <span style="font-size:13px;font-weight:700;color:var(--text-dark);">${day}</span>
                <input type="text" data-day="${day}" class="ts-task-input" placeholder="Task / Project description" style="padding:8px 12px;border-radius:var(--radius-sm);border:1px solid rgba(255,255,255,0.45);background:rgba(255,255,255,0.25);color:var(--text-dark);font-family:inherit;font-size:12.5px;outline:none;">
                <input type="number" data-day="${day}" class="ts-hours-input" placeholder="Hrs" min="0" max="24" step="0.5" style="padding:8px;border-radius:var(--radius-sm);border:1px solid rgba(255,255,255,0.45);background:rgba(255,255,255,0.25);color:var(--text-dark);font-family:inherit;font-size:12.5px;outline:none;text-align:center;">
            </div>
        `).join('');

        // Auto-calculate total from daily entries
        container.querySelectorAll('.ts-hours-input').forEach(inp => {
            inp.addEventListener('input', () => {
                let total = 0;
                container.querySelectorAll('.ts-hours-input').forEach(i => { total += parseFloat(i.value) || 0; });
                document.getElementById('ts-total-preview').textContent = total.toFixed(1);
            });
        });
    }

    buildDailyEntries();

    // --- Load Timesheets ---
    async function loadTimesheets() {
        try {
            const res = await fetch('/api/v1/employee/timesheets', { credentials: 'include' });
            const data = await res.json();
            const tbody = document.getElementById('timesheets-tbody');

            if (!data.success || !data.data.length) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:32px;">No timesheets submitted yet. Submit your first timesheet!</td></tr>';
                return;
            }

            let totalHours = 0;
            let billable = 0;
            let pending = 0;
            let approved = 0;

            data.data.forEach(ts => {
                totalHours += parseFloat(ts.total_hours) || 0;
                billable += parseFloat(ts.billable_hours) || 0;
                if (ts.status === 'Pending') pending++;
                if (ts.status === 'Approved') approved++;
            });

            document.getElementById('total-hours').textContent = totalHours.toFixed(1) + ' hrs';
            document.getElementById('billable-hours').textContent = billable.toFixed(1) + ' hrs';
            document.getElementById('pending-count').textContent = pending;
            document.getElementById('approved-count').textContent = approved;

            const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            tbody.innerHTML = data.data.map(ts => {
                const submitted = ts.created_at ? new Date(ts.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—';
                const statusClass = ts.status === 'Approved' ? 'done' : ts.status === 'Rejected' ? 'rejected' : 'pending';
                return `<tr>
                    <td>${monthNames[ts.month] || ts.month} ${ts.year}</td>
                    <td>Week ${ts.week_number}</td>
                    <td>${parseFloat(ts.total_hours || 0).toFixed(1)} hrs</td>
                    <td>${parseFloat(ts.billable_hours || 0).toFixed(1)} hrs</td>
                    <td>${parseFloat(ts.non_billable_hours || 0).toFixed(1)} hrs</td>
                    <td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${ts.remarks || '—'}</td>
                    <td>${submitted}</td>
                    <td><span class="status-pill ${statusClass}">${ts.status}</span></td>
                </tr>`;
            }).join('');
        } catch (e) {
            console.error(e);
        }
    }

    // --- Modal Open/Close ---
    document.getElementById('btn-new-timesheet').addEventListener('click', () => {
        buildDailyEntries();
        document.getElementById('modal-timesheet').style.display = 'flex';
    });

    ['close-ts-modal', 'close-ts-2'].forEach(id => {
        document.getElementById(id).addEventListener('click', () => {
            document.getElementById('modal-timesheet').style.display = 'none';
        });
    });

    // --- Submit Timesheet ---
    document.getElementById('submit-timesheet').addEventListener('click', async () => {
        const weekNumber = parseInt(document.getElementById('ts-week').value);
        const month = parseInt(document.getElementById('ts-month').value);
        const year = parseInt(document.getElementById('ts-year').value);
        const billableHours = parseFloat(document.getElementById('ts-billable').value) || 0;
        const nonBillableHours = parseFloat(document.getElementById('ts-nonbillable').value) || 0;
        const remarks = document.getElementById('ts-remarks').value.trim();

        // Collect daily entries
        const entries = [];
        DAYS.forEach(day => {
            const task = document.querySelector(`.ts-task-input[data-day="${day}"]`).value.trim();
            const hours = parseFloat(document.querySelector(`.ts-hours-input[data-day="${day}"]`).value) || 0;
            if (task || hours) entries.push({ day, task, hours });
        });

        const totalHours = entries.reduce((sum, e) => sum + e.hours, 0) || (billableHours + nonBillableHours);

        if (!weekNumber || !month || !year) {
            showToast('Please fill in week and period details', 'error'); return;
        }

        try {
            const res = await fetch('/api/v1/employee/timesheets', {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ weekNumber, month, year, totalHours, billableHours, nonBillableHours, entries, remarks })
            });
            const data = await res.json();
            if (data.success) {
                showToast('Timesheet submitted for approval!', 'success');
                document.getElementById('modal-timesheet').style.display = 'none';
                await loadTimesheets();
            } else {
                showToast(data.message || 'Submission failed', 'error');
            }
        } catch (e) {
            showToast('Network error', 'error');
        }
    });

    await loadTimesheets();
})();
