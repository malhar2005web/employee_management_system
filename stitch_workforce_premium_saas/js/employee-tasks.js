// employee-tasks.js — My Assigned Tasks, My Customers & Projects, Employee Support Desk & Ticket Creation

(async function () {
    // Logout button handler
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' });
            window.location.href = '/login.html';
        });
    }

    // State Variables
    let currentView = 'tasks'; // 'tasks' | 'customers' | 'support'
    let allTasks = [];
    let taskStatusFilter = 'all';
    let taskPriorityFilter = 'all';

    let myCustomers = [];
    let allAvailableCustomers = [];
    let custSearchQuery = '';

    let supportTickets = [];
    let supportStatusFilter = 'all';
    let supportPriorityFilter = 'all';
    let activeDetailTicketId = null;

    // Toast Utility
    function showToast(msg, type = 'success') {
        const t = document.createElement('div');
        t.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:9999999;padding:12px 20px;border-radius:10px;font-weight:700;font-size:13.5px;color:#fff;background:${type === 'success' ? '#23b899' : '#e05252'};box-shadow:0 4px 20px rgba(0,0,0,0.15);transition:opacity 0.4s;`;
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, 3000);
    }

    // =========================================================================
    // 1. PRIMARY VIEW SWITCHER (My Tasks / My Customers / Support Desk)
    // =========================================================================
    const viewTabs = document.getElementById('view-switcher-tabs');
    const viewTasksSec = document.getElementById('view-tasks-section');
    const viewCustSec = document.getElementById('view-customers-section');
    const viewSuppSec = document.getElementById('view-support-section');
    const pageHeadingTitle = document.getElementById('page-heading-title');
    const pageHeadingDesc = document.getElementById('page-heading-desc');

    window.switchView = function(viewName) {
        currentView = viewName;
        if (viewTabs) {
            viewTabs.querySelectorAll('button').forEach(btn => {
                if (btn.dataset.view === viewName) btn.classList.add('active');
                else btn.classList.remove('active');
            });
        }

        if (viewName === 'tasks') {
            viewTasksSec.style.display = 'block';
            viewCustSec.style.display = 'none';
            viewSuppSec.style.display = 'none';
            pageHeadingTitle.textContent = 'My Tasks';
            pageHeadingDesc.textContent = 'Review your assigned tasks, update progress, and manage deadlines.';
            loadTasks();
        } else if (viewName === 'customers') {
            viewTasksSec.style.display = 'none';
            viewCustSec.style.display = 'block';
            viewSuppSec.style.display = 'none';
            pageHeadingTitle.textContent = 'My Customers & Projects';
            pageHeadingDesc.textContent = 'All customer accounts & projects assigned to you for ongoing delivery and support.';
            loadMyCustomers();
        } else if (viewName === 'support') {
            viewTasksSec.style.display = 'none';
            viewCustSec.style.display = 'none';
            viewSuppSec.style.display = 'block';
            pageHeadingTitle.textContent = 'Support Tickets Desk';
            pageHeadingDesc.textContent = 'Track and resolve customer support issues, investigate defects, and manage SLAs.';
            loadSupportTickets();
        }
    };

    if (viewTabs) {
        viewTabs.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-view]');
            if (!btn) return;
            window.switchView(btn.dataset.view);
        });
    }

    // Check URL parameters for direct navigation
    const urlParams = new URLSearchParams(window.location.search);
    const viewParam = urlParams.get('tab') || urlParams.get('view');
    if (viewParam === 'customers' || viewParam === 'support') {
        window.switchView(viewParam);
    }

    // =========================================================================
    // 2. VIEW 1: MY TASKS LOGIC
    // =========================================================================
    window.loadTasks = loadTasks;
    window.loadEmployeeTasks = loadTasks;

    async function loadTasks() {
        try {
            const res = await fetch('/api/v1/employee/tasks', { credentials: 'include' });
            const data = await res.json();
            allTasks = data.success ? data.data : [];
            updateTaskCards();
            renderTasksTable();
        } catch (e) {
            console.error('Error loading tasks:', e);
        }
    }

    function updateTaskCards() {
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

    function renderTasksTable() {
        const tbody = document.getElementById('tasks-tbody');
        if (!tbody) return;

        let filtered = allTasks;
        if (taskStatusFilter !== 'all') filtered = filtered.filter(t => t.status === taskStatusFilter);
        if (taskPriorityFilter !== 'all') filtered = filtered.filter(t => t.priority === taskPriorityFilter);

        if (!filtered.length) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:32px;">No tasks found for selected filters.</td></tr>';
            return;
        }

        const now = new Date();
        tbody.innerHTML = filtered.map(t => {
            const due = t.due_date ? new Date(t.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
            const isOverdue = t.due_date && new Date(t.due_date) < now && t.status !== 'Completed';
            const priorityClass = (t.priority || '').toLowerCase();
            const pct = t.completion_percentage || 0;
            const statusClass = t.status === 'Completed' ? 'done' : t.status === 'In Progress' ? 'progress' : t.status === 'On Hold' ? 'pending' : 'to-do';
            const isCompleted = t.status === 'Completed';
            const isRunning = window.currentRunningTaskId && Number(window.currentRunningTaskId) === Number(t.id);

            let startBtn = "";
            if (isCompleted) {
                startBtn = `<button class="action-pill" disabled style="background:rgba(0,0,0,0.08);color:var(--text-muted);font-weight:700;border:1px solid rgba(0,0,0,0.1);padding:5px 10px;cursor:not-allowed;opacity:0.6;"><i class="fa-solid fa-check"></i> Completed</button>`;
            } else if (isRunning) {
                startBtn = `<button class="action-pill" disabled style="background:rgba(4,120,87,0.15);color:#047857;font-weight:800;border:1px solid #047857;padding:5px 10px;cursor:not-allowed;opacity:0.75;box-shadow:0 0 10px rgba(4,120,87,0.2);"><i class="fa-solid fa-spinner fa-spin"></i> Active Session</button>`;
            } else {
                startBtn = `<button class="action-pill" style="background:linear-gradient(135deg,var(--teal-600),var(--teal-900));color:#fff;font-weight:700;border:none;padding:5px 10px;cursor:pointer;" onclick="window.startTaskSession(${t.id}, ${t.project_id || 'null'})"><i class="fa-solid fa-play"></i> Start Work</button>`;
            }

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
                    <div style="display:flex;gap:6px;align-items:center;">
                        ${startBtn}
                        <button class="action-pill approve" onclick="window.openProgressModalById(${t.id})">
                            <i class="fa-solid fa-pen"></i> Update
                        </button>
                        <button class="action-pill" style="background:rgba(0,0,0,0.06);color:var(--teal-900);font-weight:700;border:1px solid rgba(0,0,0,0.1);padding:5px 10px;cursor:pointer;" onclick="window.openHandoverModal(${t.id}, '${(t.title||'').replace(/'/g,"\\'")}')">
                            <i class="fa-solid fa-arrow-right-arrow-left"></i> Handover
                        </button>
                    </div>
                </td>
            </tr>`;
        }).join('');
    }

    // Task Filter tabs
    const taskFilterTabs = document.getElementById('task-filter-tabs');
    if (taskFilterTabs) {
        taskFilterTabs.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-status]');
            if (!btn) return;
            taskFilterTabs.querySelectorAll('button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            taskStatusFilter = btn.dataset.status;
            renderTasksTable();
        });
    }

    const taskPriorityTabs = document.getElementById('task-priority-tabs');
    if (taskPriorityTabs) {
        taskPriorityTabs.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-priority]');
            if (!btn) return;
            taskPriorityTabs.querySelectorAll('button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            taskPriorityFilter = btn.dataset.priority;
            renderTasksTable();
        });
    }

    // Task Progress Modal
    const statusSelect = document.getElementById('progress-status');
    const workDoneGroup = document.getElementById('work-done-group');
    if (statusSelect && workDoneGroup) {
        statusSelect.addEventListener('change', () => {
            workDoneGroup.style.display = (statusSelect.value === 'In Progress') ? 'block' : 'none';
        });
    }

    const slider = document.getElementById('progress-slider');
    function updateSliderBackground() {
        if (!slider) return;
        const val = slider.value;
        slider.style.background = `linear-gradient(to right, var(--teal-600) 0%, var(--teal-600) ${val}%, rgba(0,0,0,0.08) ${val}%, rgba(0,0,0,0.08) 100%)`;
    }

    window.openProgressModalById = function (id) {
        const task = allTasks.find(t => t.id === Number(id));
        if (!task) return;
        document.getElementById('progress-task-id').value = task.id;
        document.getElementById('progress-task-name').textContent = task.title || `Task #${task.id}`;
        document.getElementById('progress-slider').value = task.completion_percentage || 0;
        document.getElementById('progress-val-label').textContent = task.completion_percentage || 0;
        document.getElementById('progress-status').value = task.status || 'To Do';
        document.getElementById('progress-work-done').value = task.work_done || '';
        
        updateSliderBackground();
        if (workDoneGroup) {
            workDoneGroup.style.display = (task.status === 'In Progress') ? 'block' : 'none';
        }
        const modal = document.getElementById('modal-progress');
        if (modal) modal.style.display = 'flex';
    };

    if (slider) {
        slider.addEventListener('input', function () {
            document.getElementById('progress-val-label').textContent = this.value;
            updateSliderBackground();
        });
    }

    ['close-progress-modal', 'close-progress-2'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', () => {
            document.getElementById('modal-progress').style.display = 'none';
        });
    });

    const submitProgressBtn = document.getElementById('submit-progress');
    if (submitProgressBtn) {
        submitProgressBtn.addEventListener('click', async () => {
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
    }

    // =========================================================================
    // 3. VIEW 2: MY CUSTOMERS & PROJECTS LOGIC
    // =========================================================================
    async function loadMyCustomers() {
        try {
            const res = await fetch('/api/v1/employee/my-customers', { credentials: 'include' });
            const data = await res.json();
            if (data.success) {
                myCustomers = data.data || [];
                allAvailableCustomers = data.allCustomers || [];
                updateCustomerCards();
                renderMyCustomersGrid();
                populateCreateTicketCustomerDropdown();
            }
        } catch (e) {
            console.error('Error loading my customers:', e);
        }
    }

    function updateCustomerCards() {
        const elClients = document.getElementById('count-my-clients');
        const elProjects = document.getElementById('count-my-projects');
        const elTickets = document.getElementById('count-my-tickets');
        const elTasks = document.getElementById('count-my-tasks-total');

        let totalProjCount = 0;
        let totalTicketCount = 0;
        let totalTaskCount = 0;

        myCustomers.forEach(c => {
            totalProjCount += (c.activeProjects || []).length;
            totalTicketCount += (c.activeTickets || 0);
            totalTaskCount += (c.totalTasks || 0);
        });

        if (elClients) elClients.textContent = myCustomers.length;
        if (elProjects) elProjects.textContent = totalProjCount;
        if (elTickets) elTickets.textContent = totalTicketCount;
        if (elTasks) elTasks.textContent = totalTaskCount;
    }

    function renderMyCustomersGrid() {
        const grid = document.getElementById('my-customers-grid');
        if (!grid) return;

        let filtered = myCustomers;
        if (custSearchQuery.trim()) {
            const q = custSearchQuery.toLowerCase();
            filtered = filtered.filter(c => {
                const nameMatch = c.name && c.name.toLowerCase().includes(q);
                const projMatch = (c.activeProjects || []).some(p => p.name && p.name.toLowerCase().includes(q));
                const branchMatch = (c.branches || []).some(b => b.branch && b.branch.toLowerCase().includes(q));
                return nameMatch || projMatch || branchMatch;
            });
        }

        if (!filtered.length) {
            grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:50px 20px; background:rgba(255,255,255,0.7); border-radius:16px; border:1px dashed rgba(0,0,0,0.15); color:var(--text-muted);">
                <i class="fa-regular fa-folder-open" style="font-size:32px; color:var(--teal-600); margin-bottom:12px; display:block;"></i>
                <h4 style="margin:0 0 6px 0; font-size:16px; font-weight:800; color:var(--teal-900);">No Assigned Customers Found</h4>
                <p style="margin:0; font-size:13px;">You have not been assigned to any client projects yet.</p>
            </div>`;
            return;
        }

        grid.innerHTML = filtered.map(c => {
            // Find key contacts
            let contactsList = [];
            if (Array.isArray(c.branches)) {
                c.branches.forEach(b => {
                    if (Array.isArray(b.contacts)) {
                        b.contacts.forEach(cnt => {
                            if (cnt.name && !contactsList.some(x => x.name === cnt.name)) {
                                contactsList.push({ name: cnt.name, phone: cnt.phone || '', email: cnt.email || '', branch: b.branch });
                            }
                        });
                    }
                });
            }

            const primaryContact = contactsList[0] || null;

            // Render project chips
            let projectChipsHtml = '';
            if (c.activeProjects && c.activeProjects.length > 0) {
                projectChipsHtml = c.activeProjects.map(p => {
                    return `<span class="proj-chip" title="Branch: ${p.branch || 'Main'}">
                        <i class="fa-solid fa-cubes" style="color:var(--teal-600);"></i>
                        ${p.name} ${p.branch ? `<small style="opacity:0.75;">(${p.branch})</small>` : ''}
                    </span>`;
                }).join(' ');
            } else {
                projectChipsHtml = '<span style="font-size:12px; color:var(--text-muted); font-style:italic;">General Maintenance</span>';
            }

            // SLA badge
            let slaClass = 'badge-medium';
            if (c.sla_type === 'Critical') slaClass = 'badge-critical';
            else if (c.sla_type === 'High') slaClass = 'badge-high';
            else if (c.sla_type === 'Low') slaClass = 'badge-low';

            return `
            <div class="customer-card">
                <div>
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
                        <div>
                            <h3 style="margin:0 0 4px 0; font-size:17px; font-weight:800; color:var(--teal-900);">
                                <i class="fa-solid fa-building" style="color:var(--teal-600); margin-right:6px;"></i> ${c.name}
                            </h3>
                            <span style="font-size:11.5px; font-weight:600; color:var(--text-muted); background:rgba(0,0,0,0.05); padding:2px 8px; border-radius:4px;">
                                ${c.industry || 'IT & Consulting'}
                            </span>
                        </div>
                        <span class="badge-sla ${slaClass}">${c.sla_type || 'Standard SLA'}</span>
                    </div>

                    <!-- Assigned Projects -->
                    <div style="margin-bottom:14px;">
                        <div style="font-size:11px; font-weight:800; color:var(--text-muted); text-transform:uppercase; margin-bottom:6px;">
                            Assigned Projects (${(c.activeProjects || []).length})
                        </div>
                        <div style="display:flex; flex-wrap:wrap; gap:6px;">
                            ${projectChipsHtml}
                        </div>
                    </div>

                    <!-- Primary Contact Person -->
                    ${primaryContact ? `
                    <div style="background:rgba(255,255,255,0.7); border:1px solid rgba(0,0,0,0.06); border-radius:8px; padding:8px 12px; margin-bottom:14px; font-size:12px;">
                        <div style="font-weight:700; color:var(--text-dark); display:flex; align-items:center; gap:6px;">
                            <i class="fa-regular fa-user" style="color:var(--teal-600);"></i> ${primaryContact.name}
                        </div>
                        <div style="margin-top:4px; display:flex; gap:12px; color:var(--text-muted);">
                            ${primaryContact.phone ? `<span><i class="fa-solid fa-phone"></i> ${primaryContact.phone}</span>` : ''}
                            ${primaryContact.email ? `<span><i class="fa-regular fa-envelope"></i> ${primaryContact.email}</span>` : ''}
                        </div>
                    </div>` : ''}

                    <!-- Stats Badges -->
                    <div style="display:flex; gap:10px; margin-bottom:16px;">
                        <div style="flex:1; background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.2); border-radius:8px; padding:6px 10px; text-align:center;">
                            <div style="font-size:16px; font-weight:800; color:#d97706;">${c.activeTickets || 0}</div>
                            <div style="font-size:10.5px; font-weight:700; color:#b45309;">Active Tickets</div>
                        </div>
                        <div style="flex:1; background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.2); border-radius:8px; padding:6px 10px; text-align:center;">
                            <div style="font-size:16px; font-weight:800; color:#059669;">${c.totalTasks || 0}</div>
                            <div style="font-size:10.5px; font-weight:700; color:#047857;">Tasks</div>
                        </div>
                    </div>
                </div>

                <!-- Action Buttons -->
                <div style="display:flex; gap:8px; padding-top:12px; border-top:1px solid rgba(0,0,0,0.06);">
                    <button class="btn-primary" style="flex:1; padding:8px 12px; font-size:12.5px; font-weight:700; display:inline-flex; align-items:center; justify-content:center; gap:6px; cursor:pointer;" onclick="window.openCreateTicketModalForCustomer(${c.id}, '${(c.name||'').replace(/'/g,"\\'")}')">
                        <i class="fa-solid fa-circle-plus"></i> Raise Ticket
                    </button>
                    <button class="btn-secondary" style="padding:8px 12px; font-size:12.5px; font-weight:700; display:inline-flex; align-items:center; gap:4px; cursor:pointer;" onclick="window.viewTicketsForCustomer(${c.id})">
                        <i class="fa-solid fa-headset"></i> Tickets
                    </button>
                </div>
            </div>`;
        }).join('');
    }

    const custSearchInput = document.getElementById('cust-search-input');
    if (custSearchInput) {
        custSearchInput.addEventListener('input', (e) => {
            custSearchQuery = e.target.value;
            renderMyCustomersGrid();
        });
    }

    const btnRefreshCust = document.getElementById('btn-refresh-customers');
    if (btnRefreshCust) {
        btnRefreshCust.addEventListener('click', () => loadMyCustomers());
    }

    window.viewTicketsForCustomer = function(customerId) {
        window.switchView('support');
    };

    // =========================================================================
    // 4. VIEW 3: SUPPORT TICKETS DESK LOGIC
    // =========================================================================
    async function loadSupportTickets() {
        try {
            const res = await fetch('/api/v1/employee/support-tickets', { credentials: 'include' });
            const data = await res.json();
            if (data.success) {
                supportTickets = data.data || [];
                updateSupportCards();
                renderSupportTable();
            }
        } catch (e) {
            console.error('Error loading support tickets:', e);
        }
    }

    function updateSupportCards() {
        const elTotal = document.getElementById('count-support-total');
        const elOpen = document.getElementById('count-support-open');
        const elInProg = document.getElementById('count-support-inprogress');
        const elResolved = document.getElementById('count-support-resolved');

        if (elTotal) elTotal.textContent = supportTickets.length;
        if (elOpen) elOpen.textContent = supportTickets.filter(t => t.status === 'Open' || t.status === 'Assigned').length;
        if (elInProg) elInProg.textContent = supportTickets.filter(t => t.status === 'In Progress').length;
        if (elResolved) elResolved.textContent = supportTickets.filter(t => t.status === 'Resolved' || t.status === 'Closed').length;
    }

    function getSlaElapsedTimerHtml(ticket) {
        if (ticket.status === 'Resolved' || ticket.status === 'Closed') {
            let resDateStr = '';
            const resTimeRaw = ticket.resolved_at || ticket.updated_at;
            if (resTimeRaw) {
                const resD = new Date(resTimeRaw);
                resDateStr = resD.toLocaleDateString('en-US', { day: '2-digit', month: 'short' }) + ', ' +
                             resD.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
            }

            let durText = '';
            if (ticket.resolved_at && ticket.created_at) {
                const diff = Math.abs(new Date(ticket.resolved_at).getTime() - new Date(ticket.created_at).getTime());
                const rH = Math.floor(diff / 3600000);
                const rM = Math.floor((diff % 3600000) / 60000);
                const rS = Math.floor((diff % 60000) / 1000);
                if (rH > 0) durText = `${rH}h ${rM}m`;
                else if (rM > 0) durText = `${rM} min`;
                else durText = `${Math.max(1, rS)}s`;
            }

            return `<div style="font-size:12px; line-height:1.4;">
                <span style="color:#16a34a; font-weight:700; display:flex; align-items:center; gap:4px;">
                    <i class="fa-solid fa-circle-check"></i> Resolved${durText ? ` (${durText})` : ''}
                </span>
                ${resDateStr ? `<span style="font-size:11px; color:#475569; font-weight:600; display:block; margin-top:2px;"><i class="fa-regular fa-calendar-check" style="color:#16a34a;"></i> ${resDateStr}</span>` : ''}
            </div>`;
        }

        const createdDate = ticket.created_at ? new Date(ticket.created_at) : new Date();
        const createdTimeStr = createdDate.toLocaleDateString('en-US', { day: '2-digit', month: 'short' }) + ', ' +
                               createdDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

        const createdMs = createdDate.getTime();
        const elapsedMs = Math.max(0, Date.now() - createdMs);
        const eH = String(Math.floor(elapsedMs / 3600000)).padStart(2, '0');
        const eM = String(Math.floor((elapsedMs % 3600000) / 60000)).padStart(2, '0');
        const eS = String(Math.floor((elapsedMs % 60000) / 1000)).padStart(2, '0');

        return `<div class="emp-live-timer" data-created="${ticket.created_at || ''}" data-status="${ticket.status}" style="font-size:12px; line-height:1.35;">
            <div style="font-weight:700; color:#0f766e; display:flex; align-items:center; gap:4px;">
                <i class="fa-solid fa-stopwatch" style="color:#0f766e;"></i>
                <span class="live-timer-text">${eH}:${eM}:${eS}</span>
                <span style="font-size:11px; font-weight:600; color:#0f766e;">elapsed</span>
            </div>
            <div style="font-size:11px; color:var(--text-muted); font-weight:500; margin-top:2px;">
                <i class="fa-regular fa-clock"></i> Logged: ${createdTimeStr}
            </div>
        </div>`;
    }

    function renderSupportTable() {
        const tbody = document.getElementById('support-tbody');
        if (!tbody) return;

        let filtered = supportTickets;
        if (supportStatusFilter !== 'all') {
            if (supportStatusFilter === 'Open') {
                filtered = filtered.filter(t => t.status === 'Open' || t.status === 'Assigned');
            } else {
                filtered = filtered.filter(t => t.status === supportStatusFilter);
            }
        }
        if (supportPriorityFilter !== 'all') {
            filtered = filtered.filter(t => t.priority === supportPriorityFilter);
        }

        if (!filtered.length) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:32px;">No support tickets found matching current filters.</td></tr>';
            return;
        }

        tbody.innerHTML = filtered.map(t => {
            let priorityBadge = '';
            if (t.priority === 'Critical') {
                priorityBadge = '<span class="badge-sla badge-critical"><i class="fa-solid fa-fire"></i> Critical</span>';
            } else if (t.priority === 'High') {
                priorityBadge = '<span class="badge-sla badge-high"><i class="fa-solid fa-angle-up"></i> High</span>';
            } else if (t.priority === 'Medium') {
                priorityBadge = '<span class="badge-sla badge-medium"><i class="fa-solid fa-minus"></i> Medium</span>';
            } else {
                priorityBadge = '<span class="badge-sla badge-low"><i class="fa-solid fa-angle-down"></i> Low</span>';
            }

            let statusBadge = '';
            if (t.status === 'Resolved') {
                statusBadge = '<span style="font-size:12px; font-weight:700; color:#16a34a; background:rgba(34,197,94,0.15); border:1px solid rgba(34,197,94,0.3); padding:3px 8px; border-radius:6px;"><i class="fa-solid fa-circle-check"></i> Resolved</span>';
            } else if (t.status === 'In Progress') {
                statusBadge = '<span style="font-size:12px; font-weight:700; color:#2563eb; background:rgba(37,99,235,0.15); border:1px solid rgba(37,99,235,0.3); padding:3px 8px; border-radius:6px;"><i class="fa-solid fa-spinner fa-spin"></i> In Progress</span>';
            } else if (t.status === 'Assigned') {
                statusBadge = '<span style="font-size:12px; font-weight:700; color:#0d9488; background:rgba(13,148,136,0.15); border:1px solid rgba(13,148,136,0.3); padding:3px 8px; border-radius:6px;"><i class="fa-solid fa-user-check"></i> Assigned</span>';
            } else {
                statusBadge = '<span style="font-size:12px; font-weight:700; color:#ea580c; background:rgba(234,88,12,0.15); border:1px solid rgba(234,88,12,0.3); padding:3px 8px; border-radius:6px;"><i class="fa-solid fa-envelope-open"></i> Open</span>';
            }

            return `<tr>
                <td>
                    <div style="font-weight:800; color:var(--teal-900); font-size:13px;">${t.ticket_code}</div>
                    <div style="font-size:11px; color:var(--text-muted);">${new Date(t.created_at).toLocaleDateString('en-US', { day: '2-digit', month: 'short' })}</div>
                </td>
                <td>
                    <div style="font-weight:700; color:var(--text-dark);">${t.customer_name || 'Customer'}</div>
                    <div style="font-size:11.5px; color:var(--text-muted);"><i class="fa-solid fa-diagram-project"></i> ${t.project_name || 'General Maintenance'}</div>
                </td>
                <td>
                    <div style="font-weight:700; color:var(--text-dark); max-width:280px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${t.title}">
                        ${t.title}
                    </div>
                    <div style="display:flex; gap:6px; margin-top:2px;">
                        <span style="font-size:11px; font-weight:700; background:rgba(14,165,233,0.12); color:#0284c7; padding:1px 6px; border-radius:4px;">
                            ${t.category || 'Bug'}
                        </span>
                        ${t.attachments && JSON.parse(typeof t.attachments === 'string' ? t.attachments : '[]').length > 0 ? `<span style="font-size:11px; color:var(--text-muted);"><i class="fa-solid fa-paperclip"></i></span>` : ''}
                    </div>
                </td>
                <td>
                    <div style="margin-bottom:3px;">${priorityBadge}</div>
                    ${getSlaElapsedTimerHtml(t)}
                </td>
                <td>${statusBadge}</td>
                <td style="font-size:12px; color:var(--text-dark); font-weight:600;">
                    ${t.reported_by || 'Staff'}
                </td>
                <td>
                    <div style="display:flex; gap:6px; align-items:center;">
                        <button class="btn-secondary" style="padding:5px 10px; font-size:12px; font-weight:700;" onclick="window.openTicketWorkspaceModal(${t.id})">
                            <i class="fa-regular fa-folder-open"></i> Open
                        </button>
                        ${t.status !== 'Resolved' && t.status !== 'Closed' ? `
                        <button class="btn-primary" style="padding:5px 10px; font-size:12px; font-weight:700; background:#16a34a; border-color:#16a34a;" onclick="window.quickResolveTicket(${t.id})">
                            <i class="fa-solid fa-check"></i> Resolve
                        </button>` : ''}
                    </div>
                </td>
            </tr>`;
        }).join('');
    }

    // Support Desk Filters
    const suppStatusTabs = document.getElementById('support-status-tabs');
    if (suppStatusTabs) {
        suppStatusTabs.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-status]');
            if (!btn) return;
            suppStatusTabs.querySelectorAll('button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            supportStatusFilter = btn.dataset.status;
            renderSupportTable();
        });
    }

    const suppPriorityTabs = document.getElementById('support-priority-tabs');
    if (suppPriorityTabs) {
        suppPriorityTabs.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-priority]');
            if (!btn) return;
            suppPriorityTabs.querySelectorAll('button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            supportPriorityFilter = btn.dataset.priority;
            renderSupportTable();
        });
    }

    const btnRefreshSupport = document.getElementById('btn-refresh-support');
    if (btnRefreshSupport) {
        btnRefreshSupport.addEventListener('click', () => loadSupportTickets());
    }

    // =========================================================================
    // 5. MODAL: CREATE SUPPORT TICKET
    // =========================================================================
    const createTicketModal = document.getElementById('create-ticket-modal');
    const btnOpenCreateTicket = document.getElementById('btn-open-create-ticket');
    const createTicketClose = document.getElementById('create-ticket-close');
    const createTicketCancel = document.getElementById('create-ticket-cancel');
    const createTicketForm = document.getElementById('create-ticket-form');

    const ticketCustSelect = document.getElementById('ticket-customer');
    const ticketProjSelect = document.getElementById('ticket-project');
    const ticketFileInput = document.getElementById('ticket-file-input');
    const ticketFileUrl = document.getElementById('ticket-file-url');
    const ticketFileName = document.getElementById('ticket-file-name');
    const btnUploadTicketFile = document.getElementById('btn-upload-ticket-file');

    function populateCreateTicketCustomerDropdown() {
        if (!ticketCustSelect) return;
        ticketCustSelect.innerHTML = '<option value="">Select Customer Account...</option>';

        const listToUse = myCustomers.length > 0 ? myCustomers : allAvailableCustomers;
        listToUse.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = `${c.name} (${c.industry || 'Client'})`;
            ticketCustSelect.appendChild(opt);
        });
    }

    if (ticketCustSelect) {
        ticketCustSelect.addEventListener('change', () => {
            const custId = ticketCustSelect.value;
            populateProjectOptionsForCustomer(custId);
        });
    }

    function populateProjectOptionsForCustomer(custId, selectedProjName = '') {
        if (!ticketProjSelect) return;
        ticketProjSelect.innerHTML = '<option value="">None / General Maintenance</option>';
        if (!custId) return;

        const cust = myCustomers.find(c => String(c.id) === String(custId)) || 
                     allAvailableCustomers.find(c => String(c.id) === String(custId));
        if (!cust) return;

        let projects = [];
        if (Array.isArray(cust.activeProjects)) {
            projects = cust.activeProjects;
        } else if (Array.isArray(cust.branches)) {
            cust.branches.forEach(b => {
                let bProjs = b.projects || [];
                if (typeof bProjs === 'string') {
                    try { bProjs = JSON.parse(bProjs); } catch(e) { bProjs = []; }
                }
                if (Array.isArray(bProjs)) {
                    bProjs.forEach(p => {
                        const pName = typeof p === 'string' ? p : (p.name || p.project_name);
                        if (pName && !projects.some(x => x.name === pName)) {
                            projects.push({ name: pName, branch: b.branch });
                        }
                    });
                }
            });
        }

        projects.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.name;
            opt.textContent = `${p.name} ${p.branch ? `(${p.branch} Branch)` : ''}`;
            if (selectedProjName && p.name === selectedProjName) opt.selected = true;
            ticketProjSelect.appendChild(opt);
        });
    }

    window.openCreateTicketModal = function() {
        if (createTicketForm) createTicketForm.reset();
        if (ticketFileUrl) ticketFileUrl.value = '';
        if (ticketFileName) ticketFileName.textContent = 'No file selected';
        populateCreateTicketCustomerDropdown();
        if (createTicketModal) {
            createTicketModal.style.display = 'flex';
            createTicketModal.classList.add('active');
            createTicketModal.style.opacity = '1';
            document.body.classList.add('modal-open');
        }
        if (typeof window.openModal === 'function') window.openModal('create-ticket-modal');
    };

    window.openCreateTicketModalForCustomer = function(customerId, customerName) {
        window.openCreateTicketModal();
        if (ticketCustSelect) {
            ticketCustSelect.value = customerId;
            populateProjectOptionsForCustomer(customerId);
        }
    };

    if (btnOpenCreateTicket) {
        btnOpenCreateTicket.addEventListener('click', () => window.openCreateTicketModal());
    }

    [createTicketClose, createTicketCancel].forEach(el => {
        if (el) el.addEventListener('click', () => {
            if (createTicketModal) {
                createTicketModal.classList.remove('active');
                createTicketModal.style.opacity = '0';
                setTimeout(() => { createTicketModal.style.display = 'none'; }, 200);
            }
            document.body.classList.remove('modal-open');
            if (typeof window.closeModal === 'function') window.closeModal('create-ticket-modal');
        });
    });

    // File Upload Handler for Attachment
    if (btnUploadTicketFile && ticketFileInput) {
        btnUploadTicketFile.addEventListener('click', () => ticketFileInput.click());
        ticketFileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            ticketFileName.textContent = `Uploading ${file.name}...`;
            const formData = new FormData();
            formData.append('attachment', file);

            try {
                const res = await fetch('/api/v1/support/upload-attachment', {
                    method: 'POST',
                    credentials: 'include',
                    body: formData
                });
                const data = await res.json();
                if (data.success && data.attachmentUrl) {
                    ticketFileUrl.value = data.attachmentUrl;
                    ticketFileName.innerHTML = `<i class="fa-solid fa-check" style="color:#16a34a;"></i> Attached: ${file.name}`;
                    showToast('Attachment uploaded successfully!', 'success');
                } else {
                    ticketFileName.textContent = 'Upload failed. Try again.';
                    showToast(data.message || 'File upload failed', 'error');
                }
            } catch (err) {
                ticketFileName.textContent = 'Upload error';
                showToast('Network error uploading file', 'error');
            }
        });
    }

    // Submit Create Ticket Form
    if (createTicketForm) {
        createTicketForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const customer_id = ticketCustSelect.value;
            const project_name = ticketProjSelect.value;
            const category = document.getElementById('ticket-category').value;
            const priority = document.getElementById('ticket-priority').value;
            const reported_by = document.getElementById('ticket-reported-by').value;
            const customer_phone = document.getElementById('ticket-phone').value;
            const title = document.getElementById('ticket-title').value;
            const description = document.getElementById('ticket-description').value;
            const fileUrl = ticketFileUrl.value;

            if (!customer_id || !title) {
                alert('Please select a customer and enter an issue summary.');
                return;
            }

            const payload = {
                customer_id: parseInt(customer_id, 10),
                project_name: project_name || null,
                category,
                priority,
                reported_by: reported_by || 'Staff',
                customer_phone: customer_phone || null,
                title,
                description,
                attachments: fileUrl ? [fileUrl] : []
            };

            const submitBtn = document.getElementById('btn-submit-create-ticket');
            if (submitBtn) submitBtn.disabled = true;

            try {
                const res = await fetch('/api/v1/support', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const data = await res.json();
                if (data.success) {
                    showToast(data.message || 'Support Ticket created successfully!', 'success');
                    if (createTicketModal) createTicketModal.style.display = 'none';
                    await loadSupportTickets();
                    await loadMyCustomers();
                    window.switchView('support');
                } else {
                    alert(data.message || 'Failed to create support ticket');
                }
            } catch (err) {
                alert('Server error creating support ticket');
            } finally {
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }

    // =========================================================================
    // 6. MODAL: TICKET WORKSPACE & DETAILS
    // =========================================================================
    const ticketWorkspaceModal = document.getElementById('ticket-workspace-modal');
    const ticketWorkspaceClose = document.getElementById('ticket-workspace-close');

    if (ticketWorkspaceClose && ticketWorkspaceModal) {
        ticketWorkspaceClose.addEventListener('click', () => {
            ticketWorkspaceModal.style.display = 'none';
        });
    }

    window.openTicketWorkspaceModal = async function(ticketId) {
        activeDetailTicketId = ticketId;
        try {
            const res = await fetch(`/api/v1/support/${ticketId}`, { credentials: 'include' });
            const data = await res.json();
            if (data.success && data.data) {
                const t = data.data;
                document.getElementById('view-ticket-code').textContent = t.ticket_code;
                document.getElementById('view-ticket-title').textContent = t.title;
                document.getElementById('view-ticket-sub').textContent = `${t.customer_name || 'Customer'} • Project: ${t.project_name || 'General'}`;
                document.getElementById('view-ticket-desc').textContent = t.description || 'No detailed reproduction steps provided.';
                document.getElementById('view-ticket-status-select').value = t.status || 'Open';

                // Timer & Meta
                document.getElementById('modal-sla-timer').innerHTML = getSlaElapsedTimerHtml(t);
                document.getElementById('modal-ticket-meta').innerHTML = `
                    <div><span style="color:var(--text-muted);">Category:</span> <strong>${t.category}</strong></div>
                    <div><span style="color:var(--text-muted);">Priority:</span> <strong>${t.priority}</strong></div>
                    <div><span style="color:var(--text-muted);">Reported By:</span> <strong>${t.reported_by || 'Staff'}</strong></div>
                `;

                // Attachment
                const attDiv = document.getElementById('view-ticket-attachment');
                let atts = [];
                if (t.attachments) {
                    try { atts = typeof t.attachments === 'string' ? JSON.parse(t.attachments) : t.attachments; } catch(e) { atts = []; }
                }
                if (Array.isArray(atts) && atts.length > 0) {
                    attDiv.style.display = 'block';
                    attDiv.innerHTML = `<div style="font-size:11px; font-weight:800; color:var(--text-muted); text-transform:uppercase; margin-bottom:4px;">Attachments</div>` +
                        atts.map(url => {
                            const isImg = /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
                            return isImg 
                                ? `<a href="${url}" target="_blank"><img src="${url}" style="max-width:180px; max-height:120px; border-radius:8px; border:1px solid rgba(0,0,0,0.15); margin-top:4px;"></a>`
                                : `<a href="${url}" target="_blank" class="btn-secondary" style="font-size:12px; padding:4px 8px; display:inline-flex; align-items:center; gap:4px;"><i class="fa-solid fa-file"></i> View Attachment</a>`;
                        }).join(' ');
                } else {
                    attDiv.style.display = 'none';
                }

                // Render Comments & History
                renderModalComments(t.comments || data.comments || []);
                renderModalHistory(t.history || data.history || []);

                const modalTarget = document.getElementById('ticket-workspace-modal');
                if (modalTarget) {
                    modalTarget.style.display = 'flex';
                    modalTarget.classList.add('active');
                    modalTarget.style.opacity = '1';
                    document.body.classList.add('modal-open');
                }
                if (typeof window.openModal === 'function') window.openModal('ticket-workspace-modal');
            }
        } catch (e) {
            console.error('Failed to load ticket details:', e);
            showToast('Failed to load ticket details: ' + e.message, 'error');
        }
    };

    function renderModalComments(comments) {
        const list = document.getElementById('ticket-comments-list');
        if (!list) return;
        if (!comments.length) {
            list.innerHTML = '<div style="font-size:12px; color:var(--text-muted); font-style:italic;">No work notes or comments logged yet.</div>';
            return;
        }
        list.innerHTML = comments.map(c => `
            <div style="background:rgba(255,255,255,0.8); border:1px solid rgba(0,0,0,0.08); border-radius:8px; padding:8px 12px; font-size:12.5px;">
                <div style="display:flex; justify-content:space-between; font-weight:700; color:var(--teal-900); margin-bottom:2px;">
                    <span>${c.author_name || 'Staff'}</span>
                    <span style="font-size:10.5px; font-weight:500; color:var(--text-muted);">${new Date(c.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                </div>
                <div style="color:var(--text-dark);">${c.comment}</div>
            </div>
        `).join('');
    }

    function renderModalHistory(history) {
        const list = document.getElementById('modal-ticket-history');
        if (!list) return;
        if (!history.length) {
            list.innerHTML = '<li class="timeline-item"><div class="timeline-dot"></div><div style="font-size:12px; font-weight:700;">Ticket Created</div></li>';
            return;
        }
        list.innerHTML = history.map(h => `
            <li class="timeline-item">
                <div class="timeline-dot"></div>
                <div style="font-size:12px; font-weight:700; color:var(--text-dark);">${h.action || 'Status Changed'}</div>
                <div style="font-size:11px; color:var(--text-muted);">${h.details || ''}</div>
                <div style="font-size:10.5px; color:var(--text-muted); margin-top:2px;">${new Date(h.created_at).toLocaleDateString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}</div>
            </li>
        `).join('');
    }

    // Update Status from Detail Modal
    const btnUpdateTicketStatus = document.getElementById('btn-update-ticket-status');
    if (btnUpdateTicketStatus) {
        btnUpdateTicketStatus.addEventListener('click', async () => {
            if (!activeDetailTicketId) return;
            const newStatus = document.getElementById('view-ticket-status-select').value;

            try {
                const res = await fetch(`/api/v1/support/${activeDetailTicketId}/status`, {
                    method: 'PUT',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: newStatus, notes: `Status updated to ${newStatus} by staff.` })
                });
                const data = await res.json();
                if (data.success) {
                    showToast(`Ticket status updated to ${newStatus}`, 'success');
                    await window.openTicketWorkspaceModal(activeDetailTicketId);
                    await loadSupportTickets();
                } else {
                    showToast(data.message || 'Status update failed', 'error');
                }
            } catch (e) {
                showToast('Network error updating status', 'error');
            }
        });
    }

    // Add Comment from Detail Modal
    const btnSendComment = document.getElementById('btn-send-comment');
    const inputNewComment = document.getElementById('ticket-new-comment');
    if (btnSendComment && inputNewComment) {
        const sendCommentHandler = async () => {
            if (!activeDetailTicketId) return;
            const comment = inputNewComment.value.trim();
            if (!comment) return;

            try {
                const res = await fetch(`/api/v1/support/${activeDetailTicketId}/comments`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ comment })
                });
                const data = await res.json();
                if (data.success) {
                    inputNewComment.value = '';
                    await window.openTicketWorkspaceModal(activeDetailTicketId);
                }
            } catch (e) {
                showToast('Failed to add comment', 'error');
            }
        };

        btnSendComment.addEventListener('click', sendCommentHandler);
        inputNewComment.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') sendCommentHandler();
        });
    }

    // Quick Resolve Ticket
    window.quickResolveTicket = async function(ticketId) {
        if (!confirm('Mark this support ticket as Resolved?')) return;
        try {
            const res = await fetch(`/api/v1/support/${ticketId}/status`, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'Resolved', notes: 'Ticket marked as resolved by assigned engineer.' })
            });
            const data = await res.json();
            if (data.success) {
                showToast('Ticket resolved successfully!', 'success');
                await loadSupportTickets();
                await loadMyCustomers();
            }
        } catch (e) {
            showToast('Error resolving ticket', 'error');
        }
    };

    // Live Ticking Stopwatch for Employee Support Table
    setInterval(() => {
        document.querySelectorAll('.emp-live-timer').forEach(el => {
            const status = el.getAttribute('data-status');
            if (status === 'Resolved' || status === 'Closed') return;

            const createdStr = el.getAttribute('data-created');
            if (!createdStr) return;

            const createdMs = new Date(createdStr).getTime();
            if (isNaN(createdMs)) return;

            const elapsedMs = Math.max(0, Date.now() - createdMs);
            const textEl = el.querySelector('.live-timer-text');
            if (!textEl) return;

            const eH = String(Math.floor(elapsedMs / 3600000)).padStart(2, '0');
            const eM = String(Math.floor((elapsedMs % 3600000) / 60000)).padStart(2, '0');
            const eS = String(Math.floor((elapsedMs % 60000) / 1000)).padStart(2, '0');
            textEl.textContent = `${eH}:${eM}:${eS}`;
        });
    }, 1000);

    // =========================================================================
    // INITIAL EXECUTION
    // =========================================================================
    await loadTasks();
    await loadMyCustomers();
    await loadSupportTickets();
})();
