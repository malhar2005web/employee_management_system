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
    const filterCategory = document.getElementById('filter-category');
    const filterPriority = document.getElementById('filter-priority');
    const filterStatus = document.getElementById('filter-status');
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

    // Helper: Compute SLA Timer display
    const getSlaTimerHtml = (ticket) => {
        if (ticket.status === 'Resolved' || ticket.status === 'Closed') {
            return '<span style="color:#16a34a; font-weight:700; font-size:12px;"><i class="fa-solid fa-check-double"></i> Met SLA</span>';
        }
        if (!ticket.resolution_deadline) return '<span style="color:var(--text-muted); font-size:12px;">Standard</span>';

        const deadline = new Date(ticket.resolution_deadline).getTime();
        const now = Date.now();
        const diffMs = deadline - now;

        if (diffMs <= 0) {
            return '<span style="color:#dc2626; font-weight:800; font-size:12px;"><i class="fa-solid fa-skull"></i> SLA Breached</span>';
        }

        const hrs = Math.floor(diffMs / 3600000);
        const mins = Math.floor((diffMs % 3600000) / 60000);

        if (hrs < 2) {
            return `<span style="color:#dc2626; font-weight:800; font-size:12px;"><i class="fa-solid fa-clock"></i> ${hrs}h ${mins}m left</span>`;
        }
        return `<span style="color:var(--teal-900); font-weight:600; font-size:12px;"><i class="fa-regular fa-clock"></i> ${hrs}h ${mins}m left</span>`;
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
            projectsCache = projData.success ? (projData.data || []) : [];
            employeesCache = empData.success ? (empData.data || []) : [];

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

            // Populate Project Modal Selects
            const ticketProjSelect = document.getElementById('ticket-project');
            const editProjSelect = document.getElementById('edit-ticket-project');
            if (ticketProjSelect) ticketProjSelect.innerHTML = '<option value="">None / General</option>';
            if (editProjSelect) editProjSelect.innerHTML = '<option value="">None / General</option>';
            
            projectsCache.forEach(p => {
                const pName = p.project_name || p.name || 'Project';
                const opt = `<option value="${p.id}">${pName}</option>`;
                if (ticketProjSelect) ticketProjSelect.innerHTML += opt;
                if (editProjSelect) editProjSelect.innerHTML += opt;
            });

            // Populate Staff Modal & Workspace Selects
            const ticketAssigneeSelect = document.getElementById('ticket-assignee');
            const editAssigneeSelect = document.getElementById('edit-ticket-assignee');
            if (ticketAssigneeSelect) ticketAssigneeSelect.innerHTML = '<option value="">Unassigned</option>';
            if (editAssigneeSelect) editAssigneeSelect.innerHTML = '<option value="">Unassigned</option>';
            if (metaAssigneeSelect) metaAssigneeSelect.innerHTML = '<option value="">Unassigned</option>';

            employeesCache.forEach(e => {
                const opt = `<option value="${e.id}">${e.full_name} (${e.role || 'Staff'})</option>`;
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
        const category = filterCategory ? filterCategory.value : 'all';
        const priority = filterPriority ? filterPriority.value : 'all';
        const status = filterStatus ? filterStatus.value : 'all';

        try {
            const res = await fetch(`/api/v1/support?search=${encodeURIComponent(search)}&customer_id=${customer}&category=${category}&priority=${priority}&status=${status}`);
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
                        </td>
                        <td>
                            <div style="margin-bottom:4px;">${getPriorityBadge(t.priority)}</div>
                            <div>${getSlaTimerHtml(t)}</div>
                        </td>
                        <td>${getStatusBadge(t.status)}</td>
                        <td>${assigneeName}</td>
                        <td>
                            <div style="display:flex; gap:6px;">
                                <button type="button" class="btn-secondary" onclick="window.openTicketWorkspace(${t.id})" style="padding:5px 10px; font-size:12px; font-weight:700;" title="Open Ticket Workspace">
                                    <i class="fa-solid fa-folder-open" style="color:var(--teal-600);"></i> Open
                                </button>
                                <button type="button" class="btn-secondary" onclick="window.openEditTicketModal(${t.id})" style="padding:5px 10px; font-size:12px; font-weight:700; background:rgba(217,119,6,0.1); color:#d97706; border:1px solid rgba(217,119,6,0.3);" title="Edit Support Ticket">
                                    <i class="fa-solid fa-pen-to-square"></i> Edit
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
    if (filterCategory) filterCategory.addEventListener('change', loadTickets);
    if (filterPriority) filterPriority.addEventListener('change', loadTickets);
    if (filterStatus) filterStatus.addEventListener('change', loadTickets);
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

            const payload = {
                customer_id: parseInt(document.getElementById('ticket-customer').value, 10),
                project_id: document.getElementById('ticket-project').value ? parseInt(document.getElementById('ticket-project').value, 10) : null,
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
                alert("Failed to load ticket details");
                return;
            }

            const t = data.data;

            // Header info
            document.getElementById('view-ticket-code').textContent = t.ticket_code;
            document.getElementById('view-ticket-title').textContent = t.title;
            document.getElementById('view-ticket-sub').textContent = `Reported by ${t.reported_by || 'Customer'} on ${new Date(t.created_at).toLocaleString()}`;

            // Details & Attachments
            document.getElementById('view-ticket-description').textContent = t.description || 'No detailed description provided.';
            
            const attArea = document.getElementById('view-ticket-attachments-area');
            const attList = document.getElementById('view-ticket-attachments-list');
            if (t.attachments && Array.isArray(t.attachments) && t.attachments.length > 0) {
                attArea.style.display = 'block';
                attList.innerHTML = '';
                t.attachments.forEach(att => {
                    const url = typeof att === 'string' ? att : att.url;
                    const name = typeof att === 'string' ? 'Attachment' : (att.name || 'Attachment');
                    attList.innerHTML += `<a href="${url}" target="_blank" class="badge" style="background:rgba(255,255,255,0.4); border:1px solid rgba(0,0,0,0.1); color:var(--teal-700); font-weight:600;"><i class="fa-solid fa-paperclip"></i> ${name}</a>`;
                });
            } else {
                attArea.style.display = 'none';
            }

            // Controls
            if (workspaceStatusSelect) workspaceStatusSelect.value = t.status || 'Open';
            if (metaAssigneeSelect) metaAssigneeSelect.value = t.assigned_to || '';

            // Metadata Card
            document.getElementById('meta-customer-name').textContent = t.customer_name || 'Customer';
            document.getElementById('meta-project-name').textContent = t.project_name || 'None / General';
            document.getElementById('meta-category-badge').innerHTML = `<span class="badge" style="background:rgba(6,182,212,0.15); color:#0891b2;">${t.category || 'Bug'}</span>`;
            document.getElementById('meta-priority-badge').innerHTML = getPriorityBadge(t.priority);

            // Linked Task / Workflow Badges
            const linkedTaskEl = document.getElementById('meta-linked-task');
            const linkedWorkflowEl = document.getElementById('meta-linked-workflow');

            if (t.task_id) {
                linkedTaskEl.style.display = 'block';
                document.getElementById('meta-linked-task-id').textContent = `Task #${t.task_id} (${t.task_name || 'Linked Task'})`;
            } else {
                linkedTaskEl.style.display = 'none';
            }

            if (t.workflow_id) {
                linkedWorkflowEl.style.display = 'block';
                document.getElementById('meta-linked-workflow-id').textContent = `Workflow #${t.workflow_id} (${t.workflow_title || 'Linked Workflow'})`;
            } else {
                linkedWorkflowEl.style.display = 'none';
            }

            // SLA Timer Display
            document.getElementById('meta-sla-countdown').innerHTML = getSlaTimerHtml(t);

            // Render Conversation Thread
            const commentsContainer = document.getElementById('workspace-comments-list');
            if (t.comments && t.comments.length > 0) {
                let commHtml = '';
                t.comments.forEach(c => {
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
                            <div style="font-size:13px; color:var(--teal-950); line-height:1.4; white-space:pre-wrap;">${c.comment_text}</div>
                        </div>
                    `;
                });
                commentsContainer.innerHTML = commHtml;
            } else {
                commentsContainer.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:12.5px;">No comments yet. Start the conversation below.</div>';
            }

            // Render Timeline Audit Stream
            const historyContainer = document.getElementById('workspace-history-list');
            if (t.history && t.history.length > 0) {
                let histHtml = '';
                t.history.forEach(h => {
                    const hDate = new Date(h.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                    histHtml += `
                        <li class="timeline-item">
                            <div class="timeline-dot"></div>
                            <div style="font-weight:700; color:var(--teal-950);">${h.action}</div>
                            <div style="color:var(--text-dark); font-size:11.5px;">${h.details || ''}</div>
                            <div style="font-size:10.5px; color:var(--text-muted);">${h.performed_by || 'System'} • ${hDate}</div>
                        </li>
                    `;
                });
                historyContainer.innerHTML = histHtml;
            } else {
                historyContainer.innerHTML = '<li class="timeline-item"><div class="timeline-dot"></div><div>Ticket Created</div></li>';
            }

            if (typeof window.openModal === 'function') window.openModal(ticketWorkspaceModal);
            else if (ticketWorkspaceModal) ticketWorkspaceModal.classList.add('active');
        } catch (err) {
            console.error("Error opening ticket workspace:", err);
            alert("Error loading ticket workspace");
        }
    };

    if (ticketWorkspaceClose) {
        ticketWorkspaceClose.addEventListener('click', () => {
            if (typeof window.closeModal === 'function') window.closeModal(ticketWorkspaceModal);
            else if (ticketWorkspaceModal) ticketWorkspaceModal.classList.remove('active');
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
            if (projSelect) projSelect.value = t.project_id || '';

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

            const payload = {
                title: document.getElementById('edit-ticket-title').value.trim(),
                description: document.getElementById('edit-ticket-description').value.trim(),
                category: document.getElementById('edit-ticket-category').value,
                priority: document.getElementById('edit-ticket-priority').value,
                status: document.getElementById('edit-ticket-status').value,
                customer_id: document.getElementById('edit-ticket-customer').value || null,
                project_id: document.getElementById('edit-ticket-project').value || null,
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
    });
});
