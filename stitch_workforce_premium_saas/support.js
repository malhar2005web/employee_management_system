document.addEventListener('DOMContentLoaded', () => {
    // Modals
    const createTicketModal = document.getElementById('create-ticket-modal');
    const btnOpenCreateTicket = document.getElementById('btn-open-create-ticket');
    const createTicketClose = document.getElementById('create-ticket-close');
    const createTicketCancel = document.getElementById('create-ticket-cancel');
    const createTicketForm = document.getElementById('create-ticket-form');

    const ticketWorkspaceModal = document.getElementById('ticket-workspace-modal');
    const ticketWorkspaceClose = document.getElementById('ticket-workspace-close');

    // Controls
    const ticketSearch = document.getElementById('ticket-search');
    const filterCustomer = document.getElementById('filter-customer');
    const filterEmployee = document.getElementById('filter-employee');
    const filterCategory = document.getElementById('filter-category');
    const filterPriority = document.getElementById('filter-priority');
    const filterStatus = document.getElementById('filter-status');
    const filterFromDate = document.getElementById('filter-from-date');
    const filterToDate = document.getElementById('filter-to-date');
    const btnClearDates = document.getElementById('btn-clear-dates');
    const btnRefreshTickets = document.getElementById('btn-refresh-tickets');
    const ticketsList = document.getElementById('tickets-list');
    const logoutBtn = document.getElementById('logout-btn');

    // File Upload Controls
    const btnUploadTicketFile = document.getElementById('btn-upload-ticket-file');
    const inputTicketFile = document.getElementById('ticket-file-input');
    const ticketFileName = document.getElementById('ticket-file-name');
    const ticketFileUrl = document.getElementById('ticket-file-url');

    // Workspace Controls
    const workspaceStatusSelect = document.getElementById('workspace-status-select');
    const btnConvertTask = document.getElementById('btn-convert-task');
    const btnConvertWorkflow = document.getElementById('btn-convert-workflow');
    const metaAssigneeSelect = document.getElementById('meta-assignee-select');
    const btnPostComment = document.getElementById('btn-post-comment');
    const newCommentText = document.getElementById('new-comment-text');
    const chkInternalNote = document.getElementById('chk-internal-note');

    let currentActiveTicketId = null;
    let customersCache = [];
    let projectsCache = [];
    let employeesCache = [];

    // Helper: Escaping quotes
    const esc = (str) => (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');

    // Helper: Format Priority Badge
    const getPriorityBadge = (priority) => {
        const pri = (priority || 'Medium').toLowerCase();
        if (pri === 'critical') return '<span class="badge badge-critical"><i class="fa-solid fa-fire"></i> Critical</span>';
        if (pri === 'high') return '<span class="badge badge-high"><i class="fa-solid fa-angles-up"></i> High</span>';
        if (pri === 'medium') return '<span class="badge badge-medium"><i class="fa-solid fa-angle-up"></i> Medium</span>';
        return '<span class="badge badge-low"><i class="fa-solid fa-minus"></i> Low</span>';
    };

    // Helper: Format Status Badge
    const getStatusBadge = (status) => {
        const st = status || 'Open';
        if (st === 'Open') return '<span class="badge" style="background:rgba(245,158,11,0.15); color:#d97706; border:1px solid rgba(245,158,11,0.3); font-weight:700;"><i class="fa-solid fa-circle-dot"></i> Open</span>';
        if (st === 'Assigned') return '<span class="badge" style="background:rgba(14,165,233,0.15); color:#0284c7; border:1px solid rgba(14,165,233,0.3); font-weight:700;"><i class="fa-solid fa-user-check"></i> Assigned</span>';
        if (st === 'In Progress') return '<span class="badge" style="background:rgba(168,85,247,0.15); color:#9333ea; border:1px solid rgba(168,85,247,0.3); font-weight:700;"><i class="fa-solid fa-gears"></i> In Progress</span>';
        if (st === 'Waiting Customer') return '<span class="badge" style="background:rgba(234,179,8,0.15); color:#ca8a04; border:1px solid rgba(234,179,8,0.3); font-weight:700;"><i class="fa-solid fa-user-clock"></i> Waiting Customer</span>';
        if (st === 'Resolved') return '<span class="badge" style="background:rgba(34,197,94,0.15); color:#16a34a; border:1px solid rgba(34,197,94,0.3); font-weight:700;"><i class="fa-solid fa-circle-check"></i> Resolved</span>';
        return '<span class="badge" style="background:rgba(100,116,139,0.15); color:#475569; border:1px solid rgba(100,116,139,0.3); font-weight:700;"><i class="fa-solid fa-lock"></i> Closed</span>';
    };

    // Helper: Compute SLA & Elapsed Live Timer display
    const getSlaTimerHtml = (ticket) => {
        if (ticket.status === 'Resolved' || ticket.status === 'Closed') {
            let resDateStr = '';
            const resTimeRaw = ticket.resolved_at || ticket.updated_at;
            if (resTimeRaw) {
                const resD = new Date(resTimeRaw);
                resDateStr = resD.toLocaleDateString('en-US', { day: '2-digit', month: 'short' }) + ', ' +
                             resD.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
            }

            let durText = '';
            const startMsRaw = ticket.started_resolving_at || ticket.created_at;
            if (ticket.resolved_at && startMsRaw) {
                const diff = Math.abs(new Date(ticket.resolved_at).getTime() - new Date(startMsRaw).getTime());
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

        // If Open or Assigned and resolution not started yet:
        if ((ticket.status === 'Open' || ticket.status === 'Assigned') && !ticket.started_resolving_at) {
            return `<div class="live-ticket-timer" data-started="" data-created="${ticket.created_at || ''}" data-status="${ticket.status}" style="font-size:12px; line-height:1.35;">
                <div style="font-weight:700; color:#0d9488; display:flex; align-items:center; gap:4px;">
                    <i class="fa-solid fa-stopwatch" style="color:#0d9488;"></i>
                    <span class="live-timer-text">00:00:00</span>
                    <span style="font-size:11px; font-weight:600; color:#0d9488;">elapsed</span>
                </div>
                <div style="font-size:11px; color:var(--text-muted); font-weight:500; margin-top:2px;">
                    <i class="fa-regular fa-clock"></i> Logged: ${createdTimeStr}
                </div>
            </div>`;
        }

        const startTimeRaw = ticket.started_resolving_at || ticket.created_at;
        const startMs = new Date(startTimeRaw).getTime();
        const elapsedMs = Math.max(0, Date.now() - startMs);
        const eH = String(Math.floor(elapsedMs / 3600000)).padStart(2, '0');
        const eM = String(Math.floor((elapsedMs % 3600000) / 60000)).padStart(2, '0');
        const eS = String(Math.floor((elapsedMs % 60000) / 1000)).padStart(2, '0');

        return `<div class="live-ticket-timer" data-started="${ticket.started_resolving_at || ticket.created_at || ''}" data-created="${ticket.created_at || ''}" data-status="${ticket.status}" style="font-size:12px; line-height:1.35;">
            <div style="font-weight:700; color:#2563eb; display:flex; align-items:center; gap:4px;">
                <i class="fa-solid fa-stopwatch fa-spin" style="--fa-animation-duration: 3s; color:#2563eb;"></i>
                <span class="live-timer-text">${eH}:${eM}:${eS}</span>
                <span style="font-size:11px; font-weight:700; color:#2563eb;">elapsed</span>
            </div>
            <div style="font-size:11px; color:var(--text-muted); font-weight:500; margin-top:2px;">
                <i class="fa-regular fa-clock"></i> Logged: ${createdTimeStr}
            </div>
        </div>`;
    };

    // Helper to dynamically render project options based on chosen Customer Account
    const renderProjectOptions = (selectEl, customerId, selectedProjectId = '', selectedProjectName = '') => {
        if (!selectEl) return;
        selectEl.innerHTML = '<option value="">None / General Maintenance</option>';

        let availableProjects = [];
        if (customerId) {
            const cust = customersCache.find(c => String(c.id) === String(customerId));
            if (cust) {
                // 1. From branches projects (e.g. Dahisar -> PentaRMC, Miraroad -> Pentarmc)
                let branches = cust.branches;
                if (typeof branches === 'string') {
                    try { branches = JSON.parse(branches); } catch (e) { branches = []; }
                }
                if (Array.isArray(branches)) {
                    branches.forEach((b, bIdx) => {
                        const bName = b.branch || `Branch ${bIdx + 1}`;
                        let bProjs = b.projects;
                        if (typeof bProjs === 'string') {
                            try { bProjs = JSON.parse(bProjs); } catch (e) { bProjs = []; }
                        }
                        if (Array.isArray(bProjs)) {
                            bProjs.forEach(p => {
                                const pName = typeof p === 'string' ? p : (p.name || p.project_name || 'Module');
                                if (pName && !availableProjects.some(x => x.name.toLowerCase() === pName.toLowerCase() && x.branch_name === bName)) {
                                    // Match exact project from projectsCache (by customer_id and branch or name)
                                    const matchingProj = projectsCache.find(mp => 
                                        String(mp.customer_id) === String(customerId) && 
                                        ((mp.branch_name && mp.branch_name.toLowerCase() === bName.toLowerCase()) || mp.name.toLowerCase() === pName.toLowerCase())
                                    );
                                    availableProjects.push({
                                        id: matchingProj ? matchingProj.id : (p.id || `branch_${bIdx}_${pName}`),
                                        name: pName,
                                        branch_name: bName,
                                        assignedEmployees: b.assignedEmployees || []
                                    });
                                }
                            });
                        }
                    });
                }
                // 2. From cust.projects array
                let custProjs = cust.projects;
                if (typeof custProjs === 'string') {
                    try { custProjs = JSON.parse(custProjs); } catch (e) { custProjs = []; }
                }
                if (Array.isArray(custProjs)) {
                    custProjs.forEach(p => {
                        const pName = typeof p === 'string' ? p : (p.name || p.project_name);
                        if (pName && !availableProjects.some(x => x.name.toLowerCase() === pName.toLowerCase())) {
                            const matchingProj = projectsCache.find(mp => String(mp.customer_id) === String(customerId) && mp.name.toLowerCase() === pName.toLowerCase());
                            availableProjects.push({
                                id: matchingProj ? matchingProj.id : (p.id || `cust_${pName}`),
                                name: pName,
                                branch_name: ''
                            });
                        }
                    });
                }
                // 3. From customer_projects if any
                let custDirectProjs = cust.customer_projects;
                if (typeof custDirectProjs === 'string') {
                    try { custDirectProjs = JSON.parse(custDirectProjs); } catch (e) { custDirectProjs = []; }
                }
                if (Array.isArray(custDirectProjs)) {
                    custDirectProjs.forEach(p => {
                        const pName = p.name || p.project_name;
                        if (pName && !availableProjects.some(x => (String(x.id) === String(p.id) || x.name.toLowerCase() === pName.toLowerCase()))) {
                            availableProjects.push({
                                id: p.id,
                                name: pName,
                                branch_name: p.branch_name || ''
                            });
                        }
                    });
                }
                // 4. From global projectsCache matching customer_id
                const dbProjs = projectsCache.filter(p => String(p.customer_id) === String(customerId));
                dbProjs.forEach(p => {
                    if (!availableProjects.some(x => String(x.id) === String(p.id) || (x.name.toLowerCase() === (p.name || '').toLowerCase() && x.branch_name === (p.branch_name || '')))) {
                        availableProjects.push({
                            id: p.id,
                            name: p.name,
                            branch_name: p.branch_name || ''
                        });
                    }
                });
            }
        } else {
            availableProjects = projectsCache;
        }

        if (availableProjects.length > 0) {
            availableProjects.forEach((p, idx) => {
                const pName = p.name || p.project_name || 'Project';
                const branchInfo = p.branch_name ? ` (${p.branch_name} Branch)` : '';
                const opt = document.createElement('option');
                opt.value = p.id || pName;
                opt.setAttribute('data-project-name', pName);
                opt.setAttribute('data-branch-name', p.branch_name || '');
                opt.textContent = `${pName}${branchInfo}`;
                if (selectedProjectId && String(p.id) === String(selectedProjectId)) {
                    opt.selected = true;
                } else if (selectedProjectName && pName.toLowerCase() === selectedProjectName.toLowerCase()) {
                    opt.selected = true;
                }
                selectEl.appendChild(opt);
            });

            // If no project explicitly preselected and creating new ticket, automatically select the first project!
            if (!selectedProjectId && !selectedProjectName && availableProjects.length > 0 && customerId) {
                selectEl.value = availableProjects[0].id || availableProjects[0].name;
            }
        }
    };

    // Auto-select assignee staff based on Customer / Project assignment
    const autoSelectAssignee = (customerId, assigneeSelectId, chosenProjectId = null) => {
        if (!customerId) return;
        const selectEl = document.getElementById(assigneeSelectId);
        if (!selectEl) return;
        const cust = customersCache.find(c => String(c.id) === String(customerId));
        if (!cust) return;

        let assignedEmps = [];

        // Check if project has specific assigned employees
        let branches = cust.branches;
        if (typeof branches === 'string') {
            try { branches = JSON.parse(branches); } catch (e) { branches = []; }
        }
        if (Array.isArray(branches)) {
            for (const b of branches) {
                const bProjs = Array.isArray(b.projects) ? b.projects : [];
                const matchesProj = chosenProjectId ? bProjs.some(p => String(p.id) === String(chosenProjectId) || (p.name && p.name.toLowerCase().includes(String(chosenProjectId).toLowerCase()))) : false;
                if (matchesProj && Array.isArray(b.assignedEmployees) && b.assignedEmployees.length > 0) {
                    assignedEmps = b.assignedEmployees;
                    break;
                } else if (!assignedEmps.length && Array.isArray(b.assignedEmployees) && b.assignedEmployees.length > 0) {
                    assignedEmps = b.assignedEmployees;
                }
            }
        }

        if (assignedEmps.length === 0 && Array.isArray(cust.assigned_employees) && cust.assigned_employees.length > 0) {
            assignedEmps = cust.assigned_employees;
        }

        if (assignedEmps.length > 0) {
            const firstId = assignedEmps[0].id || assignedEmps[0];
            if (firstId) {
                selectEl.value = firstId;
            }
        }
    };

    // Auto-fill reported by contact person when customer is selected
    const autoFillContact = (customerId, inputId) => {
        if (!customerId) return;
        const inputEl = document.getElementById(inputId);
        if (!inputEl) return;
        const cust = customersCache.find(c => String(c.id) === String(customerId));
        if (!cust) return;

        let contactStr = '';
        let contactPersons = cust.contact_persons;
        if (typeof contactPersons === 'string') {
            try { contactPersons = JSON.parse(contactPersons); } catch (e) { contactPersons = []; }
        }
        if (Array.isArray(contactPersons) && contactPersons.length > 0) {
            const cp = contactPersons[0];
            contactStr = cp.name ? `${cp.name}${cp.email ? ' (' + cp.email + ')' : (cp.phone ? ' (' + cp.phone + ')' : '')}` : '';
        } else {
            let branches = cust.branches;
            if (typeof branches === 'string') {
                try { branches = JSON.parse(branches); } catch (e) { branches = []; }
            }
            if (Array.isArray(branches)) {
                for (const b of branches) {
                    if (b.contacts && Array.isArray(b.contacts) && b.contacts.length > 0) {
                        const cp = b.contacts[0];
                        contactStr = cp.name ? `${cp.name}${cp.email ? ' (' + cp.email + ')' : (cp.phone ? ' (' + cp.phone + ')' : '')}` : '';
                        break;
                    }
                }
            }
        }

        if (contactStr) {
            inputEl.value = contactStr;
        }
    };

    // Populate Initial Dropdowns (Customers, Projects, Employees)
    const loadDropdownData = async () => {
        try {
            const [custRes, projRes, empRes] = await Promise.all([
                fetch('/api/v1/admin/customers'),
                fetch('/api/v1/admin/projects'),
                fetch('/api/v1/admin/employees')
            ]);

            const custData = await custRes.json();
            const projData = await projRes.json();
            const empData = await empRes.json();

            customersCache = custData.success ? (custData.data || []) : [];
            projectsCache = projData.success ? (Array.isArray(projData.data) ? projData.data : (projData.data?.projects || [])) : [];
            employeesCache = empData.success ? (Array.isArray(empData.data) ? empData.data : (empData.data?.employees || empData.data || [])) : [];

            // Populate Customer Filter & Modal Selects
            const ticketCustSelect = document.getElementById('ticket-customer');
            const editCustSelect = document.getElementById('edit-ticket-customer');
            if (filterCustomer) filterCustomer.innerHTML = '<option value="all">All Customers</option>';
            if (ticketCustSelect) ticketCustSelect.innerHTML = '<option value="">Select Customer...</option>';
            if (editCustSelect) editCustSelect.innerHTML = '<option value="">Select Customer...</option>';

            customersCache.forEach(c => {
                const cName = c.company_name || c.name || 'Customer';
                const opt = `<option value="${c.id}">${cName}</option>`;
                if (filterCustomer) filterCustomer.innerHTML += opt;
                if (ticketCustSelect) ticketCustSelect.innerHTML += opt;
                if (editCustSelect) editCustSelect.innerHTML += opt;
            });

            // Initial population of Project Modal Selects
            const ticketProjSelect = document.getElementById('ticket-project');
            const editProjSelect = document.getElementById('edit-ticket-project');
            renderProjectOptions(ticketProjSelect, '');
            renderProjectOptions(editProjSelect, '');

            // Global Handler for Create Modal Customer change
            window.handleCustomerSelectChange = (chosenCustId) => {
                const projEl = document.getElementById('ticket-project');
                renderProjectOptions(projEl, chosenCustId);
                autoFillContact(chosenCustId, 'ticket-reported-by');
                const selectedProjVal = projEl ? projEl.value : null;
                autoSelectAssignee(chosenCustId, 'ticket-assignee', selectedProjVal);
            };

            // Global Handler for Edit Modal Customer change
            window.handleEditCustomerSelectChange = (chosenCustId) => {
                const projEl = document.getElementById('edit-ticket-project');
                renderProjectOptions(projEl, chosenCustId);
                const selectedProjVal = projEl ? projEl.value : null;
                autoSelectAssignee(chosenCustId, 'edit-ticket-assignee', selectedProjVal);
            };

            // Global Handler for Project change -> auto-select engineer
            window.handleProjectSelectChange = (projId, assigneeSelectId = 'ticket-assignee', custSelectId = 'ticket-customer') => {
                const custEl = document.getElementById(custSelectId);
                const custId = custEl ? custEl.value : null;
                if (custId) {
                    autoSelectAssignee(custId, assigneeSelectId, projId);
                }
            };

            // Attach dynamic change & input listeners for Customer -> Projects in Create Modal
            if (ticketCustSelect) {
                ticketCustSelect.addEventListener('change', (e) => window.handleCustomerSelectChange(e.target.value));
                ticketCustSelect.addEventListener('input', (e) => window.handleCustomerSelectChange(e.target.value));
            }

            // Attach dynamic change & input listeners for Customer -> Projects in Edit Modal
            if (editCustSelect) {
                editCustSelect.addEventListener('change', (e) => window.handleEditCustomerSelectChange(e.target.value));
                editCustSelect.addEventListener('input', (e) => window.handleEditCustomerSelectChange(e.target.value));
            }

            // Attach project select change listeners
            if (ticketProjSelect) {
                ticketProjSelect.addEventListener('change', (e) => window.handleProjectSelectChange(e.target.value, 'ticket-assignee', 'ticket-customer'));
            }
            if (editProjSelect) {
                editProjSelect.addEventListener('change', (e) => window.handleProjectSelectChange(e.target.value, 'edit-ticket-assignee', 'edit-ticket-customer'));
            }

            // Populate Staff Modal, Filter & Workspace Selects
            const ticketAssigneeSelect = document.getElementById('ticket-assignee');
            const editAssigneeSelect = document.getElementById('edit-ticket-assignee');
            if (filterEmployee) filterEmployee.innerHTML = '<option value="all">All Employees</option>';
            if (ticketAssigneeSelect) ticketAssigneeSelect.innerHTML = '<option value="">Unassigned</option>';
            if (editAssigneeSelect) editAssigneeSelect.innerHTML = '<option value="">Unassigned</option>';
            if (metaAssigneeSelect) metaAssigneeSelect.innerHTML = '<option value="">Unassigned</option>';

            employeesCache.forEach(e => {
                const opt = `<option value="${e.id}">${e.full_name} (${e.role || 'Staff'})</option>`;
                if (filterEmployee) filterEmployee.innerHTML += `<option value="${e.id}">${e.full_name}</option>`;
                if (ticketAssigneeSelect) ticketAssigneeSelect.innerHTML += opt;
                if (editAssigneeSelect) editAssigneeSelect.innerHTML += opt;
                if (metaAssigneeSelect) metaAssigneeSelect.innerHTML += opt;
            });
        } catch (err) {
            console.error("Error loading dropdown data:", err);
        }

    };

    // Load & Render Tickets Table
    const loadTickets = async () => {
        const search = ticketSearch ? ticketSearch.value.trim() : '';
        const customer = filterCustomer ? filterCustomer.value : 'all';
        const employee = filterEmployee ? filterEmployee.value : 'all';
        const category = filterCategory ? filterCategory.value : 'all';
        const priority = filterPriority ? filterPriority.value : 'all';
        const status = filterStatus ? filterStatus.value : 'all';
        const fromDate = filterFromDate ? filterFromDate.value : '';
        const toDate = filterToDate ? filterToDate.value : '';

        try {
            const queryParams = new URLSearchParams({
                search,
                customer_id: customer,
                employee_id: employee,
                category,
                priority,
                status,
                from_date: fromDate,
                to_date: toDate
            });

            const res = await fetch(`/api/v1/support?${queryParams.toString()}`);
            const data = await res.json();

            if (!data.success) {
                if (typeof showToast === 'function') showToast("Failed to fetch tickets", "error");
                return;
            }

            // Update Metrics Cards (Safely with null checks)
            const m = data.metrics || {};
            const elTotal = document.getElementById('metric-total-tickets');
            const elOpen = document.getElementById('metric-open-tickets');
            const elWaiting = document.getElementById('metric-waiting-customer');
            const elSla = document.getElementById('metric-sla-breaches');
            const elResolved = document.getElementById('metric-resolved-today');

            if (elTotal) elTotal.textContent = m.total || 0;
            if (elOpen) elOpen.textContent = m.active_open || 0;
            if (elWaiting) elWaiting.textContent = m.waiting_customer || 0;
            if (elSla) elSla.textContent = m.sla_breaches || 0;
            if (elResolved) elResolved.textContent = m.resolved_today || 0;

            // Render Rows
            if (!data.data || data.data.length === 0) {
                ticketsList.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align:center; padding:30px; color:var(--text-muted);">
                            <i class="fa-solid fa-folder-open" style="font-size:24px; color:var(--text-muted); margin-bottom:8px;"></i><br>
                            No support tickets found matching current filters.
                        </td>
                    </tr>
                `;
                return;
            }

            let html = '';
            data.data.forEach(t => {
                const createdDate = new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                const customerName = t.customer_name || 'Customer';
                const projName = t.project_name ? `<span style="font-size:11px; color:var(--text-muted); display:block;"><i class="fa-solid fa-diagram-project"></i> ${t.project_name}</span>` : '';
                const assigneeName = t.assigned_to_name ? `<span style="font-weight:600; font-size:12.5px;"><i class="fa-solid fa-user-gear" style="color:var(--teal-600);"></i> ${t.assigned_to_name}</span>` : '<span style="color:var(--text-muted); font-size:12px;">Unassigned</span>';

                const attList = Array.isArray(t.attachments) ? t.attachments : (t.attachments ? [t.attachments] : []);
                const attBadge = attList.length > 0 ? `<span class="badge" style="background:rgba(14,165,233,0.12); color:#0284c7; font-size:10.5px; border:1px solid rgba(14,165,233,0.25); margin-left:4px;"><i class="fa-solid fa-paperclip"></i> ${attList.length} attachment${attList.length > 1 ? 's' : ''}</span>` : '';

                html += `
                    <tr>
                        <td>
                            <strong style="color:var(--teal-700); font-weight:800; font-size:13px;">${t.ticket_code}</strong>
                            <div style="font-size:11px; color:var(--text-muted);">${createdDate}</div>
                        </td>
                        <td>
                            <strong style="color:var(--teal-950); font-size:13px;">${customerName}</strong>
                            ${projName}
                        </td>
                        <td>
                            <div style="font-weight:700; color:var(--teal-950); font-size:13px; margin-bottom:3px;">${t.title}</div>
                            <span class="badge" style="background:rgba(6,182,212,0.12); color:#0891b2; font-size:10.5px; border:1px solid rgba(6,182,212,0.25);">${t.category || 'Bug'}</span>
                            ${attBadge}
                        </td>
                        <td>
                            <div style="margin-bottom:4px;">${getPriorityBadge(t.priority)}</div>
                            <div>${getSlaTimerHtml(t)}</div>
                        </td>
                        <td>${getStatusBadge(t.status)}</td>
                        <td>${assigneeName}</td>
                        <td style="white-space:nowrap;">
                            <div style="display:inline-flex; gap:4px; align-items:center; flex-wrap:nowrap;">
                                <button type="button" class="btn-secondary" onclick="window.openTicketWorkspace(${t.id})" style="padding:4px 8px; font-size:11px; font-weight:700; height:26px; display:inline-flex; align-items:center; gap:3.5px; border-radius:6px; line-height:1;" title="Open Ticket Workspace">
                                    <i class="fa-solid fa-folder-open" style="color:var(--teal-600); font-size:11px;"></i> Open
                                </button>
                                ${t.status === 'Open' || t.status === 'Assigned' ? `
                                <button type="button" class="btn-primary" style="padding:4px 8px; font-size:11px; font-weight:800; background:#0d9488; border-color:#0d9488; height:26px; display:inline-flex; align-items:center; gap:3.5px; border-radius:6px; line-height:1;" onclick="window.startResolvingTicket(${t.id})">
                                    <i class="fa-solid fa-play" style="font-size:10px;"></i> Start
                                </button>` : ''}
                                ${t.status === 'In Progress' ? `
                                <button type="button" class="btn-primary" style="padding:4px 8px; font-size:11px; font-weight:800; background:#16a34a; border-color:#16a34a; height:26px; display:inline-flex; align-items:center; gap:3.5px; border-radius:6px; line-height:1;" onclick="window.quickResolveTicket(${t.id})">
                                    <i class="fa-solid fa-circle-check" style="font-size:11px;"></i> Resolve
                                </button>` : ''}
                                ${t.status === 'Resolved' || t.status === 'Closed' ? `
                                <button type="button" class="btn-secondary" onclick="window.reopenTicket(${t.id})" style="padding:4px 8px; font-size:11px; font-weight:800; background:rgba(234,88,12,0.12); color:#ea580c; border:1px solid rgba(234,88,12,0.3); height:26px; display:inline-flex; align-items:center; gap:3.5px; border-radius:6px; line-height:1;" title="Reopen Support Ticket">
                                    <i class="fa-solid fa-rotate-left" style="font-size:10.5px;"></i> Reopen
                                </button>` : ''}
                                <button type="button" class="btn-secondary" onclick="window.openEditTicketModal(${t.id})" style="padding:4px 8px; font-size:11px; font-weight:700; background:rgba(217,119,6,0.1); color:#d97706; border:1px solid rgba(217,119,6,0.3); height:26px; display:inline-flex; align-items:center; gap:3.5px; border-radius:6px; line-height:1;" title="Edit Support Ticket">
                                    <i class="fa-solid fa-pen-to-square" style="font-size:10.5px;"></i> Edit
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            });

            ticketsList.innerHTML = html;
        } catch (err) {
            console.error("Error loading tickets:", err);
            ticketsList.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:#ef4444;">Error loading tickets</td></tr>';
        }
    };

    // Wire Filter Listeners
    if (ticketSearch) ticketSearch.addEventListener('input', loadTickets);
    if (filterCustomer) filterCustomer.addEventListener('change', loadTickets);
    if (filterEmployee) filterEmployee.addEventListener('change', loadTickets);
    if (filterCategory) filterCategory.addEventListener('change', loadTickets);
    if (filterPriority) filterPriority.addEventListener('change', loadTickets);
    if (filterStatus) filterStatus.addEventListener('change', loadTickets);
    if (filterFromDate) filterFromDate.addEventListener('change', loadTickets);
    if (filterToDate) filterToDate.addEventListener('change', loadTickets);
    if (btnClearDates) btnClearDates.addEventListener('click', () => {
        if (filterFromDate) filterFromDate.value = '';
        if (filterToDate) filterToDate.value = '';
        loadTickets();
    });
    if (btnRefreshTickets) btnRefreshTickets.addEventListener('click', loadTickets);

    // Modal 1: Create Ticket Modal Handlers
    const closeCreateModal = () => {
        if (typeof window.closeModal === 'function') window.closeModal(createTicketModal);
        else if (createTicketModal) createTicketModal.classList.remove('active');
        if (createTicketForm) createTicketForm.reset();
        if (ticketFileName) ticketFileName.textContent = 'No file attached';
        if (ticketFileUrl) ticketFileUrl.value = '';
    };

    if (btnOpenCreateTicket) btnOpenCreateTicket.addEventListener('click', () => {
        const ticketCust = document.getElementById('ticket-customer');
        const ticketProj = document.getElementById('ticket-project');
        if (ticketCust) ticketCust.value = '';
        if (ticketProj) renderProjectOptions(ticketProj, '');
        if (typeof window.openModal === 'function') window.openModal(createTicketModal);
        else if (createTicketModal) createTicketModal.classList.add('active');
    });
    if (createTicketClose) createTicketClose.addEventListener('click', closeCreateModal);
    if (createTicketCancel) createTicketCancel.addEventListener('click', closeCreateModal);

    // Ticket File Upload Handler
    if (btnUploadTicketFile && inputTicketFile) {
        btnUploadTicketFile.addEventListener('click', () => inputTicketFile.click());

        inputTicketFile.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append('attachment', file);

            try {
                const res = await fetch('/api/v1/support/upload-attachment', {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    if (ticketFileUrl) ticketFileUrl.value = data.attachmentUrl;
                    if (ticketFileName) ticketFileName.innerHTML = `<a href="${data.attachmentUrl}" target="_blank" style="color:var(--teal-600); font-weight:700;"><i class="fa-solid fa-paperclip"></i> ${data.attachmentName}</a>`;
                    if (typeof showToast === 'function') showToast("File attached successfully!");
                } else {
                    alert(data.message || "Failed to upload attachment");
                }
            } catch (err) {
                console.error("File upload error:", err);
                alert("Error uploading file attachment");
            }
        });
    }

    // Submit Create Ticket Form
    if (createTicketForm) {
        createTicketForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const projSelect = document.getElementById('ticket-project');
            const selectedOption = projSelect ? projSelect.options[projSelect.selectedIndex] : null;
            const projectName = selectedOption ? (selectedOption.getAttribute('data-project-name') || selectedOption.textContent) : null;
            const isNumericId = projSelect && /^\d+$/.test(projSelect.value);

            const payload = {
                customer_id: parseInt(document.getElementById('ticket-customer').value, 10),
                project_id: isNumericId ? parseInt(projSelect.value, 10) : null,
                project_name: projectName && projectName !== 'None / General Maintenance' ? projectName : null,
                category: document.getElementById('ticket-category').value,
                priority: document.getElementById('ticket-priority').value,
                assigned_to: document.getElementById('ticket-assignee').value ? parseInt(document.getElementById('ticket-assignee').value, 10) : null,
                reported_by: document.getElementById('ticket-reported-by').value.trim() || 'Customer Contact',
                title: document.getElementById('ticket-title').value.trim(),
                description: document.getElementById('ticket-description').value.trim(),
                attachments: ticketFileUrl.value ? [{ url: ticketFileUrl.value, name: ticketFileName.textContent }] : []
            };

            try {
                const res = await fetch('/api/v1/support', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    if (typeof showToast === 'function') showToast(data.message || "Support Ticket created successfully!", "success");
                    closeCreateModal();
                    loadTickets();
                } else {
                    alert(data.message || "Failed to create support ticket");
                }
            } catch (err) {
                console.error("Error creating ticket:", err);
                alert("Error creating support ticket");
            }
        });
    }

    // ============ Ticket Workspace Modal ============
    window.openTicketWorkspace = async (ticketId) => {
        currentActiveTicketId = ticketId;

        try {
            const res = await fetch(`/api/v1/support/${ticketId}`);
            const data = await res.json();

            if (!data.success || !data.data) {
                alert(data.message || "Failed to load ticket details");
                return;
            }

            const t = data.data;

            // Header info
            const codeEl = document.getElementById('view-ticket-code');
            const titleEl = document.getElementById('view-ticket-title');
            const subEl = document.getElementById('view-ticket-sub');
            if (codeEl) codeEl.textContent = t.ticket_code;
            if (titleEl) titleEl.textContent = t.title;
            if (subEl) subEl.textContent = `Reported by ${t.reported_by || 'Customer'} on ${new Date(t.created_at).toLocaleString()}`;

            // Details & Attachments
            const descEl = document.getElementById('view-ticket-description');
            if (descEl) descEl.textContent = t.description || 'No detailed description provided.';
            
            const attArea = document.getElementById('view-ticket-attachments-area');
            const attList = document.getElementById('view-ticket-attachments-list');
            let atts = [];
            if (t.attachments) {
                try {
                    atts = typeof t.attachments === 'string' ? JSON.parse(t.attachments) : t.attachments;
                } catch(e) {
                    atts = typeof t.attachments === 'string' && t.attachments.trim() ? [t.attachments] : [];
                }
            }
            if (Array.isArray(atts) && atts.length > 0) {
                if (attArea) attArea.style.display = 'block';
                if (attList) {
                    attList.innerHTML = atts.map(att => {
                        let url = '';
                        let name = 'Attachment';
                        let isImage = false;

                        if (typeof att === 'string') {
                            url = att.trim();
                            name = url.split('/').pop() || 'Attachment';
                            isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url);
                        } else if (typeof att === 'object' && att !== null) {
                            url = att.url || (att.mediaId ? `/api/v1/whatsapp/media/${att.mediaId}` : '');
                            name = att.name || att.filename || att.caption || 'Attachment';
                            isImage = att.type === 'image' || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(name) || /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
                        }

                        if (url && url !== '#' && url !== '[object Object]') {
                            if (isImage) {
                                return `
                                    <div style="display:inline-block; margin:6px; background:rgba(255,255,255,0.85); border:1px solid rgba(0,0,0,0.12); border-radius:8px; padding:6px; text-align:center; vertical-align:top;">
                                        <a href="${url}" target="_blank" title="Click to view full image">
                                            <img src="${url}" alt="${name}" style="max-width:200px; max-height:140px; border-radius:6px; display:block; object-fit:cover; margin-bottom:6px; box-shadow:0 2px 6px rgba(0,0,0,0.08);" onerror="this.style.display='none';">
                                        </a>
                                        <a href="${url}" target="_blank" style="font-size:12px; font-weight:700; color:var(--teal-700); text-decoration:none; display:inline-flex; align-items:center; gap:4px;">
                                            <i class="fa-solid fa-arrow-up-right-from-square"></i> ${name}
                                        </a>
                                    </div>
                                `;
                            } else {
                                return `
                                    <a href="${url}" target="_blank" class="badge" style="background:rgba(255,255,255,0.85); border:1px solid rgba(0,0,0,0.15); color:var(--teal-800); font-weight:700; padding:8px 14px; margin:4px; font-size:12.5px; text-decoration:none; display:inline-flex; align-items:center; gap:6px;">
                                        <i class="fa-solid fa-paperclip" style="color:var(--teal-600); font-size:14px;"></i> ${name}
                                        <i class="fa-solid fa-arrow-up-right-from-square" style="margin-left:4px; font-size:11px; color:var(--text-muted);"></i>
                                    </a>
                                `;
                            }
                        } else {
                            return `
                                <span class="badge" style="background:rgba(100,116,139,0.12); color:#475569; font-size:12px; font-weight:600; padding:6px 10px; border-radius:6px; display:inline-flex; align-items:center; gap:5px; margin:4px;">
                                    <i class="fa-solid fa-paperclip" style="color:#64748b;"></i> ${name}
                                </span>
                            `;
                        }
                    }).join('');
                }
            } else {
                if (attArea) attArea.style.display = 'none';
            }

            // Controls
            if (workspaceStatusSelect) workspaceStatusSelect.value = t.status || 'Open';
            if (metaAssigneeSelect) metaAssigneeSelect.value = t.assigned_to || '';

            // Metadata Card
            const metaCust = document.getElementById('meta-customer-name');
            const metaProj = document.getElementById('meta-project-name');
            const metaCat = document.getElementById('meta-category-badge');
            const metaPri = document.getElementById('meta-priority-badge');
            if (metaCust) metaCust.textContent = t.customer_name || 'Customer';
            if (metaProj) metaProj.textContent = t.project_name || 'None / General';
            if (metaCat) metaCat.innerHTML = `<span class="badge" style="background:rgba(6,182,212,0.15); color:#0891b2;">${t.category || 'Bug'}</span>`;
            if (metaPri) metaPri.innerHTML = getPriorityBadge(t.priority);

            // Linked Task / Workflow Badges
            const linkedTaskEl = document.getElementById('meta-linked-task');
            const linkedWorkflowEl = document.getElementById('meta-linked-workflow');

            if (linkedTaskEl) {
                if (t.task_id) {
                    linkedTaskEl.style.display = 'block';
                    const ltid = document.getElementById('meta-linked-task-id');
                    if (ltid) ltid.textContent = `Task #${t.task_id} (${t.task_name || 'Linked Task'})`;
                } else {
                    linkedTaskEl.style.display = 'none';
                }
            }

            if (linkedWorkflowEl) {
                if (t.workflow_id) {
                    linkedWorkflowEl.style.display = 'block';
                    const lwid = document.getElementById('meta-linked-workflow-id');
                    if (lwid) lwid.textContent = `Workflow #${t.workflow_id} (${t.workflow_title || 'Linked Workflow'})`;
                } else {
                    linkedWorkflowEl.style.display = 'none';
                }
            }

            // SLA Timer Display
            const slaEl = document.getElementById('meta-sla-countdown');
            if (slaEl) slaEl.innerHTML = getSlaTimerHtml(t);

            // Render Conversation Thread
            const commentsContainer = document.getElementById('workspace-comments-list');
            const commentsList = t.comments || data.comments || [];
            if (commentsContainer) {
                if (commentsList.length > 0) {
                    let commHtml = '';
                    commentsList.forEach(c => {
                        const cDate = new Date(c.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                        const isInternal = c.is_internal_note;
                        const internalClass = isInternal ? 'internal-note' : '';
                        const noteBadge = isInternal ? '<span class="badge" style="background:#fef3c7; color:#d97706; border:1px solid rgba(245,158,11,0.3); font-size:10px; margin-left:6px;"><i class="fa-solid fa-lock"></i> Internal Note</span>' : '';

                        commHtml += `
                            <div class="chat-msg-item ${internalClass}">
                                <div class="chat-msg-header">
                                    <span class="chat-msg-author">${c.author_name || 'Staff'} ${noteBadge}</span>
                                    <span style="color:var(--text-muted); font-size:11px;">${cDate}</span>
                                </div>
                                <div style="font-size:13px; color:var(--teal-950); line-height:1.4; white-space:pre-wrap;">${c.comment_text || c.comment || ''}</div>
                            </div>
                        `;
                    });
                    commentsContainer.innerHTML = commHtml;
                } else {
                    commentsContainer.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:12.5px;">No comments yet. Start the conversation below.</div>';
                }
            }

            // Render Timeline Audit Stream
            const historyContainer = document.getElementById('workspace-history-list');
            const historyList = t.history || data.history || [];
            if (historyContainer) {
                if (historyList.length > 0) {
                    let histHtml = '';
                    historyList.forEach(h => {
                        const hDate = new Date(h.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                        histHtml += `
                            <li class="timeline-item">
                                <div class="timeline-dot"></div>
                                <div style="font-weight:700; color:var(--teal-950);">${h.action || 'Status Changed'}</div>
                                <div style="color:var(--text-dark); font-size:11.5px;">${h.details || ''}</div>
                                <div style="font-size:10.5px; color:var(--text-muted);">${h.performed_by || 'System'} • ${hDate}</div>
                            </li>
                        `;
                    });
                    historyContainer.innerHTML = histHtml;
                } else {
                    historyContainer.innerHTML = '<li class="timeline-item"><div class="timeline-dot"></div><div>Ticket Created</div></li>';
                }
            }

            const modalTarget = document.getElementById('ticket-workspace-modal');
            if (modalTarget) {
                modalTarget.style.display = 'flex';
                modalTarget.classList.add('active');
                modalTarget.style.opacity = '1';
                document.body.classList.add('modal-open');
            }
            if (typeof window.openModal === 'function') window.openModal('ticket-workspace-modal');
        } catch (err) {
            console.error("Error opening ticket workspace:", err);
            alert("Error loading ticket workspace: " + err.message);
        }
    };

    if (ticketWorkspaceClose) {
        ticketWorkspaceClose.addEventListener('click', () => {
            const modalTarget = document.getElementById('ticket-workspace-modal');
            if (modalTarget) {
                modalTarget.classList.remove('active');
                modalTarget.style.opacity = '0';
                setTimeout(() => { modalTarget.style.display = 'none'; }, 200);
            }
            document.body.classList.remove('modal-open');
            if (typeof window.closeModal === 'function') window.closeModal('ticket-workspace-modal');
            currentActiveTicketId = null;
        });
    }

    // Status Change Listener in Workspace
    if (workspaceStatusSelect) {
        workspaceStatusSelect.addEventListener('change', async (e) => {
            if (!currentActiveTicketId) return;
            const newStatus = e.target.value;

            try {
                const res = await fetch(`/api/v1/support/${currentActiveTicketId}/status`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: newStatus })
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    if (typeof showToast === 'function') showToast(`Status updated to ${newStatus}!`, "success");
                    window.openTicketWorkspace(currentActiveTicketId);
                    loadTickets();
                } else {
                    alert(data.message || "Failed to update status");
                }
            } catch (err) {
                console.error("Error updating status:", err);
            }
        });
    }

    // Quick Start Resolving Ticket from Admin Table or Modal
    window.startResolvingTicket = async function(ticketId) {
        try {
            const res = await fetch(`/api/v1/support/${ticketId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'In Progress', notes: 'Resolution work started.' })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                if (typeof showToast === 'function') showToast("Resolution started! Live SLA timer active.", "success");
                if (currentActiveTicketId && String(currentActiveTicketId) === String(ticketId)) {
                    window.openTicketWorkspace(ticketId);
                }
                loadTickets();
            } else {
                alert(data.message || "Failed to start resolution");
            }
        } catch (err) {
            console.error("Error starting resolution:", err);
        }
    };

    // Quick Resolve Ticket from Admin Table
    window.quickResolveTicket = async function(ticketId) {
        if (!confirm("Mark this support ticket as Resolved?")) return;
        try {
            const res = await fetch(`/api/v1/support/${ticketId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'Resolved', notes: 'Marked as resolved.' })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                if (typeof showToast === 'function') showToast("Ticket marked as Resolved!", "success");
                if (currentActiveTicketId && String(currentActiveTicketId) === String(ticketId)) {
                    window.openTicketWorkspace(ticketId);
                }
                loadTickets();
            } else {
                alert(data.message || "Failed to resolve ticket");
            }
        } catch (err) {
            console.error("Error resolving ticket:", err);
        }
    };

    // Reopen Ticket from Admin Desk
    window.reopenTicket = async function(ticketId) {
        const reason = prompt("Enter reason for reopening ticket (or customer feedback):", "Further resolution work required.");
        if (reason === null) return;

        try {
            const res = await fetch(`/api/v1/support/${ticketId}/reopen`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: reason || 'Reopened by Admin' })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                if (typeof showToast === 'function') showToast("Ticket reopened successfully!", "success");
                if (currentActiveTicketId && String(currentActiveTicketId) === String(ticketId)) {
                    window.openTicketWorkspace(ticketId);
                }
                loadTickets();
            } else {
                alert(data.message || "Failed to reopen ticket");
            }
        } catch (err) {
            console.error("Error reopening ticket:", err);
        }
    };

    // Assignee Change Listener in Workspace
    if (metaAssigneeSelect) {
        metaAssigneeSelect.addEventListener('change', async (e) => {
            if (!currentActiveTicketId) return;
            const assignedTo = e.target.value ? parseInt(e.target.value, 10) : null;

            try {
                const res = await fetch(`/api/v1/support/${currentActiveTicketId}/assign`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ assigned_to: assignedTo })
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    if (typeof showToast === 'function') showToast(data.message || "Ticket assigned!", "success");
                    window.openTicketWorkspace(currentActiveTicketId);
                    loadTickets();
                } else {
                    alert(data.message || "Failed to assign ticket");
                }
            } catch (err) {
                console.error("Error assigning ticket:", err);
            }
        });
    }

    // Post Comment Listener
    if (btnPostComment && newCommentText) {
        btnPostComment.addEventListener('click', async () => {
            if (!currentActiveTicketId) return;
            const text = newCommentText.value.trim();
            if (!text) {
                alert("Please enter a comment or note.");
                return;
            }

            const isInternal = chkInternalNote ? chkInternalNote.checked : false;

            try {
                const res = await fetch(`/api/v1/support/${currentActiveTicketId}/comments`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        comment_text: text,
                        is_internal_note: isInternal
                    })
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    newCommentText.value = '';
                    if (chkInternalNote) chkInternalNote.checked = false;
                    if (typeof showToast === 'function') showToast("Comment posted!", "success");
                    window.openTicketWorkspace(currentActiveTicketId);
                } else {
                    alert(data.message || "Failed to post comment");
                }
            } catch (err) {
                console.error("Error posting comment:", err);
            }
        });
    }

    // Convert to Task Listener
    if (btnConvertTask) {
        btnConvertTask.addEventListener('click', async () => {
            if (!currentActiveTicketId) return;

            if (!confirm("Convert this support issue into a new Task in the Workflow module?")) return;

            try {
                const res = await fetch(`/api/v1/support/${currentActiveTicketId}/convert-to-task`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ estimated_hours: 4 })
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    if (typeof showToast === 'function') showToast(data.message || "Ticket converted to Task!", "success");
                    window.openTicketWorkspace(currentActiveTicketId);
                    loadTickets();
                } else {
                    alert(data.message || "Failed to convert ticket to task");
                }
            } catch (err) {
                console.error("Error converting ticket to task:", err);
            }
        });
    }

    // Convert to Workflow Listener
    if (btnConvertWorkflow) {
        btnConvertWorkflow.addEventListener('click', async () => {
            if (!currentActiveTicketId) return;

            if (!confirm("Convert this major support request into a brand new Workflow?")) return;

            try {
                const res = await fetch(`/api/v1/support/${currentActiveTicketId}/convert-to-workflow`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({})
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    if (typeof showToast === 'function') showToast(data.message || "Ticket converted to Workflow!", "success");
                    window.openTicketWorkspace(currentActiveTicketId);
                    loadTickets();
                } else {
                    alert(data.message || "Failed to convert ticket to workflow");
                }
            } catch (err) {
                console.error("Error converting ticket to workflow:", err);
            }
        });
    }

    // Modal 3: Edit Ticket Modal Handlers
    const editTicketModal = document.getElementById('edit-ticket-modal');
    const editTicketForm = document.getElementById('edit-ticket-form');
    const editTicketClose = document.getElementById('edit-ticket-close');
    const editTicketCancel = document.getElementById('edit-ticket-cancel');

    const closeEditTicketModal = () => {
        if (typeof window.closeModal === 'function') window.closeModal(editTicketModal);
        else if (editTicketModal) editTicketModal.classList.remove('active');
        if (editTicketForm) editTicketForm.reset();
    };

    if (editTicketClose) editTicketClose.addEventListener('click', closeEditTicketModal);
    if (editTicketCancel) editTicketCancel.addEventListener('click', closeEditTicketModal);

    window.openEditTicketModal = async (ticketId) => {
        try {
            const res = await fetch(`/api/v1/support/${ticketId}`);
            const data = await res.json();

            if (!res.ok || !data.success) {
                alert(data.message || "Failed to load ticket for editing");
                return;
            }

            const t = data.data;
            document.getElementById('edit-ticket-id').value = t.id;
            document.getElementById('edit-ticket-code-badge').textContent = t.ticket_code;
            document.getElementById('edit-ticket-title').value = t.title || '';
            document.getElementById('edit-ticket-description').value = t.description || '';
            document.getElementById('edit-ticket-category').value = t.category || 'Bug';
            document.getElementById('edit-ticket-priority').value = t.priority || 'Medium';
            document.getElementById('edit-ticket-status').value = t.status || 'Open';
            
            const custSelect = document.getElementById('edit-ticket-customer');
            if (custSelect) custSelect.value = t.customer_id || '';

            const projSelect = document.getElementById('edit-ticket-project');
            renderProjectOptions(projSelect, t.customer_id, t.project_id);

            const assSelect = document.getElementById('edit-ticket-assignee');
            if (assSelect) assSelect.value = t.assigned_to || '';

            if (typeof window.openModal === 'function') window.openModal(editTicketModal);
            else if (editTicketModal) editTicketModal.classList.add('active');
        } catch (err) {
            console.error("Error fetching ticket for edit:", err);
            alert("Error fetching ticket details");
        }
    };

    if (editTicketForm) {
        editTicketForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const ticketId = document.getElementById('edit-ticket-id').value;
            if (!ticketId) return;

            const editProjSelect = document.getElementById('edit-ticket-project');
            const selectedEditOption = editProjSelect ? editProjSelect.options[editProjSelect.selectedIndex] : null;
            const editProjectName = selectedEditOption ? (selectedEditOption.getAttribute('data-project-name') || selectedEditOption.textContent) : null;
            const isNumericEditId = editProjSelect && /^\d+$/.test(editProjSelect.value);

            const payload = {
                title: document.getElementById('edit-ticket-title').value.trim(),
                description: document.getElementById('edit-ticket-description').value.trim(),
                category: document.getElementById('edit-ticket-category').value,
                priority: document.getElementById('edit-ticket-priority').value,
                status: document.getElementById('edit-ticket-status').value,
                customer_id: document.getElementById('edit-ticket-customer').value || null,
                project_id: isNumericEditId ? parseInt(editProjSelect.value, 10) : null,
                project_name: editProjectName && editProjectName !== 'None / General Maintenance' ? editProjectName : null,
                assigned_to: document.getElementById('edit-ticket-assignee').value || null
            };

            try {
                const res = await fetch(`/api/v1/support/${ticketId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();

                if (res.ok && data.success) {
                    if (typeof showToast === 'function') showToast(data.message || "Ticket updated successfully!", "success");
                    closeEditTicketModal();
                    loadTickets();
                } else {
                    alert(data.message || "Failed to update ticket");
                }
            } catch (err) {
                console.error("Error updating ticket:", err);
                alert("Error saving ticket changes");
            }
        });
    }

    // Live Ticking Timer Function
    const startLiveTicketTimers = () => {
        setInterval(() => {
            document.querySelectorAll('.live-ticket-timer').forEach(el => {
                const status = el.getAttribute('data-status');
                if (status === 'Resolved' || status === 'Closed') return;

                const startedStr = el.getAttribute('data-started');
                if (!startedStr) return; // Stays 00:00:00 until Start Resolving is clicked!

                const startMs = new Date(startedStr).getTime();
                if (isNaN(startMs)) return;

                const elapsedMs = Math.max(0, Date.now() - startMs);
                const textEl = el.querySelector('.live-timer-text');
                if (!textEl) return;

                const eH = String(Math.floor(elapsedMs / 3600000)).padStart(2, '0');
                const eM = String(Math.floor((elapsedMs % 3600000) / 60000)).padStart(2, '0');
                const eS = String(Math.floor((elapsedMs % 60000) / 1000)).padStart(2, '0');
                textEl.textContent = `${eH}:${eM}:${eS}`;
            });
        }, 1000);
    };

    // Logout button handler
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                const response = await fetch('/api/v1/auth/logout', { method: 'POST' });
                if (response.ok) {
                    window.location.href = '/login.html';
                }
            } catch (error) {
                console.error('Logout error:', error);
            }
        });
    }

    // Initial Execution
    loadDropdownData().then(() => {
        loadTickets();
        startLiveTicketTimers();
    });
});
