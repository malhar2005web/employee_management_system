// employee-dsr.js — Daily Self Reports & Field Visit Reports

(async function () {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' });
            window.location.href = '/login.html';
        });
    }

    function showToast(msg, type = 'success') {
        const t = document.createElement('div');
        t.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:9999;padding:12px 20px;border-radius:10px;font-weight:700;font-size:13.5px;color:#fff;background:${type === 'success' ? '#23b899' : '#e05252'};box-shadow:0 4px 20px rgba(0,0,0,0.15);transition:opacity 0.4s;`;
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, 3000);
    }

    // --- Tab switching ---
    const dsrTabs = document.getElementById('dsr-tabs');
    if (dsrTabs) {
        dsrTabs.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-tab]');
            if (!btn) return;
            document.querySelectorAll('#dsr-tabs button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const isSelf = btn.dataset.tab === 'self';
            document.getElementById('panel-self').style.display = isSelf ? 'block' : 'none';
            document.getElementById('panel-field').style.display = isSelf ? 'none' : 'block';
        });
    }

    // Default month initialization
    const now = new Date();
    const curMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const filterReportMonth = document.getElementById('filter-report-month');
    const filterFieldMonth = document.getElementById('filter-field-month');
    if (filterReportMonth) filterReportMonth.value = curMonthStr;
    if (filterFieldMonth) filterFieldMonth.value = curMonthStr;

    let cachedSelfReports = [];
    let cachedDsrReports = [];

    // --- Load Reports ---
    async function loadReports(queryOverride) {
        try {
            const selfTbody = document.getElementById('self-reports-tbody');
            const fieldTbody = document.getElementById('field-reports-tbody');

            if (selfTbody) {
                selfTbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:32px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading daily reports...</td></tr>';
            }
            if (fieldTbody) {
                fieldTbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:32px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading field visit reports...</td></tr>';
            }

            let queryString = queryOverride;
            if (!queryString) {
                const activeTab = document.querySelector('#dsr-tabs button.active');
                const isField = activeTab && activeTab.dataset.tab === 'field';
                const inputEl = isField ? filterFieldMonth : filterReportMonth;
                const filterVal = inputEl ? inputEl.value : '';
                if (filterVal) {
                    queryString = `month=${filterVal}`;
                } else {
                    queryString = `month=${curMonthStr}`;
                }
            }

            const res = await fetch(`/api/v1/employee/reports?${queryString}`, { credentials: 'include' });
            const data = await res.json();

            if (!data.success) return;

            cachedSelfReports = data.data.selfReports || [];
            cachedDsrReports = data.data.dsrReports || [];

            const todayIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

            // --- Render Self Reports ---
            if (selfTbody) {
                if (!cachedSelfReports.length) {
                    selfTbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:32px;"><i class="fa-regular fa-folder-open" style="font-size:24px;margin-bottom:8px;display:block;"></i>No self reports submitted for this period.</td></tr>';
                } else {
                    selfTbody.innerHTML = cachedSelfReports.map(r => {
                        const rawDate = typeof r.date === 'string' ? r.date.slice(0, 10) : '';
                        const parts = rawDate.split('-').map(Number);
                        const dateObj = parts.length === 3 ? new Date(parts[0], parts[1] - 1, parts[2]) : new Date(r.date);
                        const dateStr = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                        const isToday = rawDate === todayIso;

                        const rowHighlight = isToday ? 'style="background:rgba(16,185,129,0.07); border-left:3px solid var(--teal-600);"' : '';
                        const todayTag = isToday ? '<span style="font-size:9.5px; background:var(--teal-900); color:#fff; padding:2px 6px; border-radius:4px; margin-left:6px; font-weight:800; letter-spacing:0.5px;">TODAY</span>' : '';

                        const workPreview = r.todays_work ? r.todays_work.replace(/\n+/g, ' ').slice(0, 50) + (r.todays_work.length > 50 ? '...' : '') : '—';
                        const planPreview = r.tomorrows_plan ? r.tomorrows_plan.replace(/\n+/g, ' ').slice(0, 40) + (r.tomorrows_plan.length > 40 ? '...' : '') : '—';
                        const issuesPreview = r.current_issues ? `<span class="status-pill delayed" style="font-size:11px;">${r.current_issues.slice(0, 30)}...</span>` : '<span style="color:var(--text-muted);">None</span>';

                        return `<tr ${rowHighlight}>
                            <td style="font-weight:700; white-space:nowrap;">${dateStr}${todayTag}</td>
                            <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${(r.todays_work || '').replace(/"/g, '&quot;')}">${workPreview}</td>
                            <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${(r.tomorrows_plan || '').replace(/"/g, '&quot;')}">${planPreview}</td>
                            <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${issuesPreview}</td>
                            <td><span class="status-pill progress" style="font-size:11px; font-weight:800;">${r.work_capacity || 100}%</span></td>
                            <td><span class="status-pill done" style="background:#dcfce7; color:#15803d; font-size:11px; font-weight:800;">${r.percentage_complete || 0}%</span></td>
                            <td style="text-align:center;">
                                <button type="button" class="btn btn-view-self" data-id="${r.id}" style="padding:4px 10px; font-size:12px; font-weight:700; border-radius:6px; background:var(--teal-900); color:#fff; border:none; cursor:pointer;">
                                    <i class="fa-solid fa-eye"></i> View
                                </button>
                            </td>
                        </tr>`;
                    }).join('');
                }
            }

            // --- Render Field Visit Reports ---
            if (fieldTbody) {
                if (!cachedDsrReports.length) {
                    fieldTbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:32px;"><i class="fa-regular fa-folder-open" style="font-size:24px;margin-bottom:8px;display:block;"></i>No field visit reports logged for this period.</td></tr>';
                } else {
                    fieldTbody.innerHTML = cachedDsrReports.map(r => {
                        const rawDate = typeof r.date === 'string' ? r.date.slice(0, 10) : '';
                        const parts = rawDate.split('-').map(Number);
                        const dateObj = parts.length === 3 ? new Date(parts[0], parts[1] - 1, parts[2]) : (r.created_at ? new Date(r.created_at) : new Date());
                        const dateStr = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

                        return `<tr>
                            <td style="font-weight:700; white-space:nowrap;">${dateStr}</td>
                            <td><strong style="color:var(--teal-900);"><i class="fa-solid fa-building" style="margin-right:4px;color:var(--teal-600);"></i>${r.customer_name || '—'}</strong></td>
                            <td>${r.site_name || '—'}</td>
                            <td>${r.contact_person || '—'}</td>
                            <td>${r.contact_no ? `<a href="tel:${r.contact_no}" style="color:var(--teal-700); text-decoration:none; font-weight:700;"><i class="fa-solid fa-phone" style="font-size:11px;margin-right:4px;"></i>${r.contact_no}</a>` : '—'}</td>
                            <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.visited_for || '—'}</td>
                            <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.followup || '—'}</td>
                            <td style="text-align:center;">
                                <button type="button" class="btn btn-view-field" data-id="${r.id}" style="padding:4px 10px; font-size:12px; font-weight:700; border-radius:6px; background:var(--teal-900); color:#fff; border:none; cursor:pointer;">
                                    <i class="fa-solid fa-eye"></i> View
                                </button>
                            </td>
                        </tr>`;
                    }).join('');
                }
            }
        } catch (e) {
            console.error("Error in loadReports:", e);
        }
    }

    // --- Detail Modal Handling ---
    document.addEventListener('click', (e) => {
        const selfBtn = e.target.closest('.btn-view-self');
        if (selfBtn) {
            const id = parseInt(selfBtn.dataset.id, 10);
            const r = cachedSelfReports.find(x => x.id === id);
            if (!r) return;

            const modal = document.getElementById('modal-details');
            const titleEl = document.getElementById('details-modal-title');
            const bodyEl = document.getElementById('details-modal-body');

            if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-file-signature" style="color:var(--teal-600);"></i> Self Report Details — ${r.date}`;
            if (bodyEl) {
                bodyEl.innerHTML = `
                    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px;">
                        <div style="font-size:11px; text-transform:uppercase; font-weight:800; color:var(--text-muted); margin-bottom:4px;">Today's Work & Progress</div>
                        <div style="white-space:pre-wrap; font-weight:600; color:#0f172a;">${r.todays_work || 'None reported'}</div>
                    </div>
                    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px;">
                        <div style="font-size:11px; text-transform:uppercase; font-weight:800; color:var(--text-muted); margin-bottom:4px;">Tomorrow's Plan</div>
                        <div style="white-space:pre-wrap; font-weight:600; color:#0f172a;">${r.tomorrows_plan || 'None specified'}</div>
                    </div>
                    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px;">
                        <div style="font-size:11px; text-transform:uppercase; font-weight:800; color:var(--text-muted); margin-bottom:4px;">Issues / Blockers</div>
                        <div style="white-space:pre-wrap; color:${r.current_issues ? '#b91c1c' : '#0f172a'}; font-weight:600;">${r.current_issues || 'No blockers reported'}</div>
                    </div>
                    <div style="display:flex; gap:12px;">
                        <div style="flex:1; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px;">
                            <div style="font-size:11px; text-transform:uppercase; font-weight:800; color:var(--text-muted);">Work Capacity</div>
                            <div style="font-size:16px; font-weight:800; color:var(--teal-900);">${r.work_capacity || 100}%</div>
                        </div>
                        <div style="flex:1; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px;">
                            <div style="font-size:11px; text-transform:uppercase; font-weight:800; color:var(--text-muted);">Completion Rate</div>
                            <div style="font-size:16px; font-weight:800; color:#15803d;">${r.percentage_complete || 0}%</div>
                        </div>
                    </div>
                `;
            }
            if (modal) modal.style.display = 'flex';
        }

        const fieldBtn = e.target.closest('.btn-view-field');
        if (fieldBtn) {
            const id = parseInt(fieldBtn.dataset.id, 10);
            const r = cachedDsrReports.find(x => x.id === id);
            if (!r) return;

            const modal = document.getElementById('modal-details');
            const titleEl = document.getElementById('details-modal-title');
            const bodyEl = document.getElementById('details-modal-body');

            if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-map-location-dot" style="color:var(--teal-600);"></i> Field Visit Details — ${r.customer_name}`;
            if (bodyEl) {
                bodyEl.innerHTML = `
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px;">
                            <div style="font-size:11px; text-transform:uppercase; font-weight:800; color:var(--text-muted);">Customer</div>
                            <div style="font-weight:700; color:var(--teal-900);">${r.customer_name || '—'}</div>
                        </div>
                        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px;">
                            <div style="font-size:11px; text-transform:uppercase; font-weight:800; color:var(--text-muted);">Site / Plant</div>
                            <div style="font-weight:700;">${r.site_name || '—'}</div>
                        </div>
                        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px;">
                            <div style="font-size:11px; text-transform:uppercase; font-weight:800; color:var(--text-muted);">Contact Person</div>
                            <div style="font-weight:700;">${r.contact_person || '—'}</div>
                        </div>
                        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px;">
                            <div style="font-size:11px; text-transform:uppercase; font-weight:800; color:var(--text-muted);">Contact Phone</div>
                            <div style="font-weight:700;">${r.contact_no || '—'}</div>
                        </div>
                    </div>
                    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px;">
                        <div style="font-size:11px; text-transform:uppercase; font-weight:800; color:var(--text-muted); margin-bottom:4px;">Office Address</div>
                        <div style="font-weight:600; color:#0f172a;">${r.office_address || '—'}</div>
                    </div>
                    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px;">
                        <div style="font-size:11px; text-transform:uppercase; font-weight:800; color:var(--text-muted); margin-bottom:4px;">Purpose of Visit</div>
                        <div style="white-space:pre-wrap; font-weight:600; color:#0f172a;">${r.visited_for || '—'}</div>
                    </div>
                    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px;">
                        <div style="font-size:11px; text-transform:uppercase; font-weight:800; color:var(--text-muted); margin-bottom:4px;">Follow-up Notes & Next Steps</div>
                        <div style="white-space:pre-wrap; font-weight:600; color:#0f172a;">${r.followup || 'None'}</div>
                    </div>
                `;
            }
            if (modal) modal.style.display = 'flex';
        }
    });

    ['close-details-modal', 'close-details-btn'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('click', () => {
                const modal = document.getElementById('modal-details');
                if (modal) modal.style.display = 'none';
            });
        }
    });

    // --- Quick Buttons Toolbar Actions ---
    function setupQuickButtons(prefix, inputEl) {
        const btnThis = document.getElementById(`btn-quick-${prefix}-this-month`);
        const btnLast = document.getElementById(`btn-quick-${prefix}-last-month`);
        const btnAll = document.getElementById(`btn-quick-${prefix}-all-2026`);

        function setActive(active) {
            [btnThis, btnLast, btnAll].forEach(b => {
                if (!b) return;
                if (b === active) {
                    b.style.background = 'var(--teal-900)';
                    b.style.color = '#ffffff';
                    b.style.border = 'none';
                } else {
                    b.style.background = '#f1f5f9';
                    b.style.color = '#334155';
                    b.style.border = '1px solid #e2e8f0';
                }
            });
        }

        if (inputEl) {
            inputEl.addEventListener('change', () => {
                setActive(null);
                loadReports(`month=${inputEl.value}`);
            });
        }

        if (btnThis) {
            btnThis.addEventListener('click', () => {
                const d = new Date();
                const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                if (inputEl) inputEl.value = m;
                setActive(btnThis);
                loadReports(`month=${m}`);
            });
        }

        if (btnLast) {
            btnLast.addEventListener('click', () => {
                const d = new Date();
                d.setMonth(d.getMonth() - 1);
                const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                if (inputEl) inputEl.value = m;
                setActive(btnLast);
                loadReports(`month=${m}`);
            });
        }

        if (btnAll) {
            btnAll.addEventListener('click', () => {
                if (inputEl) inputEl.value = '';
                setActive(btnAll);
                loadReports('year=2026');
            });
        }
    }

    setupQuickButtons('report', filterReportMonth);
    setupQuickButtons('field', filterFieldMonth);

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

    const btnSelfReport = document.getElementById('btn-self-report');
    if (btnSelfReport) {
        btnSelfReport.addEventListener('click', async () => {
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
            const modalSelf = document.getElementById('modal-self');
            if (modalSelf) modalSelf.style.display = 'flex';
        });
    }

    ['close-self-modal', 'close-self-2'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('click', () => {
                const modal = document.getElementById('modal-self');
                if (modal) modal.style.display = 'none';
            });
        }
    });

    const submitSelfBtn = document.getElementById('submit-self');
    if (submitSelfBtn) {
        submitSelfBtn.addEventListener('click', async () => {
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
    }

    // --- Field Visit Modal ---
    const btnFieldVisit = document.getElementById('btn-field-visit');
    if (btnFieldVisit) {
        btnFieldVisit.addEventListener('click', () => {
            const modal = document.getElementById('modal-field');
            if (modal) modal.style.display = 'flex';
        });
    }

    ['close-field-modal', 'close-field-2'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('click', () => {
                const modal = document.getElementById('modal-field');
                if (modal) modal.style.display = 'none';
            });
        }
    });

    const submitFieldBtn = document.getElementById('submit-field');
    if (submitFieldBtn) {
        submitFieldBtn.addEventListener('click', async () => {
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
                    const fieldTabBtn = document.querySelector('#dsr-tabs [data-tab="field"]');
                    if (fieldTabBtn) fieldTabBtn.click();
                    await loadReports();
                } else {
                    showToast(data.message || 'Submission failed', 'error');
                }
            } catch (e) {
                showToast('Network error', 'error');
            }
        });
    }

    await loadReports();
})();
