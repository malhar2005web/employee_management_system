// employee-dsr.js — Daily Self Reports & Field Visit Reports

(async function () {
    document.getElementById('logout-btn').addEventListener('click', async () => {
        await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' });
        window.location.href = '/login.html';
    });

    function showToast(msg, type = 'success') {
        const t = document.createElement('div');
        t.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:9999;padding:12px 20px;border-radius:10px;font-weight:700;font-size:13.5px;color:#fff;background:${type === 'success' ? '#23b899' : '#e05252'};box-shadow:0 4px 20px rgba(0,0,0,0.15);transition:opacity 0.4s;`;
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, 3000);
    }

    // --- Tab switching ---
    document.getElementById('dsr-tabs').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-tab]');
        if (!btn) return;
        document.querySelectorAll('#dsr-tabs button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('panel-self').style.display = btn.dataset.tab === 'self' ? 'block' : 'none';
        document.getElementById('panel-field').style.display = btn.dataset.tab === 'field' ? 'block' : 'none';
    });

    // --- Load Reports ---
    async function loadReports() {
        try {
            const res = await fetch('/api/v1/employee/reports', { credentials: 'include' });
            const data = await res.json();

            if (!data.success) return;

            // Self Reports
            const selfTbody = document.getElementById('self-reports-tbody');
            const selfReports = data.data.selfReports || [];
            if (!selfReports.length) {
                selfTbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:32px;">No self reports submitted yet.</td></tr>';
            } else {
                selfTbody.innerHTML = selfReports.map(r => {
                    const date = new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                    return `<tr>
                        <td>${date}</td>
                        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.todays_work || '—'}</td>
                        <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.tomorrows_plan || '—'}</td>
                        <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.current_issues || '—'}</td>
                        <td>${r.work_capacity || 100}%</td>
                        <td>${r.percentage_complete || 0}%</td>
                    </tr>`;
                }).join('');
            }

            // Field Visit Reports
            const fieldTbody = document.getElementById('field-reports-tbody');
            const dsrReports = data.data.dsrReports || [];
            if (!dsrReports.length) {
                fieldTbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:32px;">No field visit reports logged yet.</td></tr>';
            } else {
                fieldTbody.innerHTML = dsrReports.map(r => {
                    const date = r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
                    return `<tr>
                        <td><strong>${r.customer_name || '—'}</strong></td>
                        <td>${r.site_name || '—'}</td>
                        <td>${r.contact_person || '—'}</td>
                        <td>${r.contact_no || '—'}</td>
                        <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.visited_for || '—'}</td>
                        <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.followup || '—'}</td>
                        <td>${date}</td>
                    </tr>`;
                }).join('');
            }
        } catch (e) {
            console.error(e);
        }
    }

    // --- Self Report Modal ---
    let todayTasks = [];
    async function fetchTodayTasks() {
        try {
            const res = await fetch('/api/v1/employee/tasks', { credentials: 'include' });
            const data = await res.json();
            todayTasks = data.success && Array.isArray(data.data) ? data.data : [];
        } catch (e) {
            console.error("Error fetching tasks:", e);
        }
    }

    document.getElementById('btn-self-report').addEventListener('click', async () => {
        await fetchTodayTasks();
        const container = document.getElementById('self-report-tasks-container');
        if (container) {
            if (todayTasks.length === 0) {
                container.innerHTML = `<div style="font-size:13px;color:var(--text-muted);padding:10px;background:rgba(0,0,0,0.03);border-radius:8px;text-align:center;">No active tasks assigned to describe.</div>`;
            } else {
                container.innerHTML = todayTasks.map((t, idx) => {
                    return `
                      <div class="form-group" style="margin-bottom:8px;text-align:left;">
                        <label style="font-size:13px;font-weight:700;color:var(--teal-900);display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                          <i class="fa-regular fa-square-check"></i> ${t.title || 'Untitled Task'} <span style="color:var(--red);">*</span>
                        </label>
                        <textarea class="sr-task-desc" data-task-id="${t.id}" data-task-title="${t.title}" rows="2" placeholder="Describe task progress (e.g. Done, pending testing...)" required style="width: 100%; box-sizing: border-box;"></textarea>
                      </div>
                    `;
                }).join('');
            }
        }
        document.getElementById('modal-self').style.display = 'flex';
    });

    ['close-self-modal', 'close-self-2'].forEach(id => {
        document.getElementById(id).addEventListener('click', () => {
            document.getElementById('modal-self').style.display = 'none';
        });
    });

    document.getElementById('submit-self').addEventListener('click', async () => {
        const taskTextareas = document.querySelectorAll('.sr-task-desc');
        let todaysWork = "";
        let missingDesc = false;

        taskTextareas.forEach((tx, idx) => {
            const title = tx.getAttribute('data-task-title');
            const val = tx.value.trim();
            if (!val) {
                missingDesc = true;
            }
            todaysWork += `Task ${idx + 1}: ${title}\nProgress: ${val}\n\n`;
        });

        const extraWorkVal = document.getElementById('sr-extra-work').value.trim();
        if (extraWorkVal) {
            todaysWork += `Extra Work / Other Tasks:\n${extraWorkVal}\n\n`;
        }

        if (todayTasks.length === 0 && !extraWorkVal) {
            showToast("Please describe today's work or extra work", "error");
            return;
        }
        if (todayTasks.length > 0 && missingDesc) {
            showToast("Please fill progress description for all tasks", "error");
            return;
        }

        const tomorrowsPlan = document.getElementById('sr-tomorrow').value.trim();
        const currentIssues = document.getElementById('sr-issues').value.trim();
        const workCapacity = document.getElementById('sr-capacity').value;
        const percentageComplete = document.getElementById('sr-percent').value;

        if (!tomorrowsPlan) {
            showToast("Please enter your plan for tomorrow", 'error'); return;
        }

        try {
            const res = await fetch('/api/v1/employee/reports/self', {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ todaysWork, tomorrowsPlan, currentIssues, workCapacity, percentageComplete })
            });
            const data = await res.json();
            if (data.success) {
                showToast('Daily report submitted!', 'success');
                document.getElementById('modal-self').style.display = 'none';
                document.getElementById('sr-extra-work').value = '';
                document.getElementById('sr-tomorrow').value = '';
                document.getElementById('sr-issues').value = '';
                document.getElementById('sr-capacity').value = '100';
                document.getElementById('sr-percent').value = '0';
                await loadReports();
            } else {
                showToast(data.message || 'Submission failed', 'error');
            }
        } catch (e) {
            showToast('Network error', 'error');
        }
    });

    // --- Field Visit Modal ---
    document.getElementById('btn-field-visit').addEventListener('click', () => {
        document.getElementById('modal-field').style.display = 'flex';
    });

    ['close-field-modal', 'close-field-2'].forEach(id => {
        document.getElementById(id).addEventListener('click', () => {
            document.getElementById('modal-field').style.display = 'none';
        });
    });

    document.getElementById('submit-field').addEventListener('click', async () => {
        const customerName = document.getElementById('fv-customer').value.trim();
        const officeAddress = document.getElementById('fv-address').value.trim();
        const siteName = document.getElementById('fv-site').value.trim();
        const contactPerson = document.getElementById('fv-contact').value.trim();
        const contactNo = document.getElementById('fv-phone').value.trim();
        const visitedFor = document.getElementById('fv-purpose').value.trim();
        const followup = document.getElementById('fv-followup').value.trim();

        if (!customerName) {
            showToast('Customer name is required', 'error'); return;
        }

        try {
            const res = await fetch('/api/v1/employee/reports/field', {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customerName, officeAddress, siteName, contactPerson, contactNo, visitedFor, followup })
            });
            const data = await res.json();
            if (data.success) {
                showToast('Field visit report logged!', 'success');
                document.getElementById('modal-field').style.display = 'none';
                document.getElementById('fv-customer').value = '';
                document.getElementById('fv-address').value = '';
                document.getElementById('fv-site').value = '';
                document.getElementById('fv-contact').value = '';
                document.getElementById('fv-phone').value = '';
                document.getElementById('fv-purpose').value = '';
                document.getElementById('fv-followup').value = '';
                // Switch to field tab
                document.querySelector('#dsr-tabs [data-tab="field"]').click();
                await loadReports();
            } else {
                showToast(data.message || 'Submission failed', 'error');
            }
        } catch (e) {
            showToast('Network error', 'error');
        }
    });

    await loadReports();
})();
