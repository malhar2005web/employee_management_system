document.addEventListener('DOMContentLoaded', () => {
    const tabWorkflows = document.getElementById('tab-tasks');
    const tabTemplates = document.getElementById('tab-templates');
    const tabAuditLogs = document.getElementById('tab-audit-logs');
    const viewWorkflows = document.getElementById('view-tasks');
    const viewTemplates = document.getElementById('view-templates');
    const viewAuditLogs = document.getElementById('view-audit-logs');
    const viewTitle = document.getElementById('view-title');

    const modal = document.getElementById('task-modal');
    const openModalBtn = document.getElementById('btn-add-task-modal');
    const closeModalBtn = document.getElementById('task-modal-close');
    const cancelModalBtn = document.getElementById('task-modal-cancel');
    const workflowForm = document.getElementById('task-form');

    const workflowsList = document.getElementById('tasks-list');
    const customerSelect = document.getElementById('task-customer');
    const branchSelect = document.getElementById('task-branch');
    const projectSelect = document.getElementById('task-project');
    const accountManagerSelect = document.getElementById('project-account-manager');
    const teamList = document.getElementById('workflow-team-list');
    const builderList = document.getElementById('workflow-builder-list');
    const progressPreview = document.getElementById('workflow-progress-preview');
    const addTeamBtn = document.getElementById('btn-add-workflow-team');
    const addTaskBtn = document.getElementById('btn-add-workflow-task');
    const templatesList = document.getElementById('templates-list');
    const templateForm = document.getElementById('template-form');

    const actionAuditsList = document.getElementById('action-audits-list');
    const loginLogsList = document.getElementById('login-logs-list');
    const actFilterAction = document.getElementById('act-filter-action');
    const actFilterEntity = document.getElementById('act-filter-entity');
    const logoutBtn = document.getElementById('logout-btn');

    // Missing checkbox containers and aliases
    const taskAssigneeCheckboxes = document.getElementById('task-assignee-checkboxes');
    const tempAssigneeCheckboxes = document.getElementById('temp-assignee-checkboxes');
    const forwardAssigneeCheckboxes = document.getElementById('forward-assignee-checkboxes');
    const taskDependencyCheckboxes = document.getElementById('task-dependency-checkboxes');
    const taskCustomer = customerSelect;
    const taskBranch = branchSelect;
    const taskProject = projectSelect;
    const taskModal = modal;


    let employeesCache = [];
    let customersCache = [];
    let projectsCache = [];
    let workflowsCache = [];
    let templatesCache = [];
    let actionAuditsCache = [];
    let loginLogsCache = [];

    const defaultSteps = [
        'Requirement Gathering',
        'Database Design',
        'Backend APIs',
        'Frontend Development',
        'Authentication',
        'Testing',
        'Bug Fixing',
        'UAT',
        'Deployment',
        'Client Approval'
    ];

    const employeeName = id => {
        const employee = employeesCache.find(e => parseInt(e.id, 10) === parseInt(id, 10));
        return employee ? employee.full_name : '-';
    };

    const groupedEmployees = () => employeesCache.reduce((acc, emp) => {
        const dept = emp.department_name || 'General';
        if (!acc[dept]) acc[dept] = [];
        acc[dept].push(emp);
        return acc;
    }, {});

    const employeeOptions = (selected = '') => {
        return `<option value="">None Selected</option>` + employeesCache.map(emp => (
            `<option value="${emp.id}" ${parseInt(selected, 10) === parseInt(emp.id, 10) ? 'selected' : ''}>${emp.full_name}</option>`
        )).join('');
    };

    const teamOptions = (selected = '') => {
        return `<option value="">Select Team</option>` + Array.from(teamList.querySelectorAll('.workflow-team-card')).map(card => {
            const tempId = card.dataset.teamId;
            const name = card.querySelector('.team-name').value.trim() || 'Untitled Team';
            return `<option value="${tempId}" ${selected === tempId ? 'selected' : ''}>${name}</option>`;
        }).join('');
    };

    const switchTab = tab => {
        tabWorkflows.classList.remove('active');
        tabTemplates.classList.remove('active');
        if (tabAuditLogs) tabAuditLogs.classList.remove('active');
        viewWorkflows.style.display = 'none';
        viewTemplates.style.display = 'none';
        if (viewAuditLogs) viewAuditLogs.style.display = 'none';

        if (tab === 'workflows') {
            tabWorkflows.classList.add('active');
            viewWorkflows.style.display = 'block';
            viewTitle.textContent = 'Active Workflows';
            loadData();
        } else if (tab === 'templates') {
            tabTemplates.classList.add('active');
            viewTemplates.style.display = 'block';
            viewTitle.textContent = 'Auto Templates';
        } else {
            tabAuditLogs.classList.add('active');
            viewAuditLogs.style.display = 'block';
            viewTitle.textContent = 'Audit Trails';
            loadAuditLogs();
        }
    };

    tabWorkflows.addEventListener('click', () => switchTab('workflows'));
    tabTemplates.addEventListener('click', () => switchTab('templates'));
    if (tabAuditLogs) tabAuditLogs.addEventListener('click', () => switchTab('audit'));

    const loadData = async () => {
        try {
            const [workflowRes, taskRes] = await Promise.all([
                fetch('/api/v1/admin/tasks/workflows'),
                fetch('/api/v1/admin/tasks')
            ]);
            const workflowData = await workflowRes.json();
            const taskData = await taskRes.json();

            if (workflowRes.ok && workflowData.success) {
                employeesCache = workflowData.data.employees || [];
                customersCache = workflowData.data.customers || [];
                projectsCache = workflowData.data.projects || [];
                workflowsCache = workflowData.data.workflows || [];
            }
            if (taskRes.ok && taskData.success) {
                templatesCache = taskData.data.templates || [];
            }

            populateMetadata();
            renderWorkflows();
            renderTemplates();
        } catch (error) {
            console.error('Error loading workflow data:', error);
        }
    };

    const populateMetadata = () => {
        customerSelect.innerHTML = '<option value="">Select Customer</option>' + customersCache.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        accountManagerSelect.innerHTML = employeeOptions();
        populateProjects();
    };

    const populateBranches = () => {
        const customer = customersCache.find(c => parseInt(c.id, 10) === parseInt(customerSelect.value, 10));
        branchSelect.innerHTML = '<option value="">Select Branch</option>';
        if (customer && Array.isArray(customer.branches)) {
            customer.branches.forEach(branch => {
                branchSelect.insertAdjacentHTML('beforeend', `<option value="${branch.branch}">${branch.branch}</option>`);
            });
        }
    };

    const populateProjects = () => {
        const customerId = customerSelect.value;
        const branch = branchSelect.value;
        let filtered = projectsCache;
        if (customerId) filtered = filtered.filter(p => parseInt(p.customer_id, 10) === parseInt(customerId, 10));
        if (branch) filtered = filtered.filter(p => p.branch_name === branch);
        projectSelect.innerHTML = '<option value="">Select Project</option>' + filtered.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    };

    customerSelect.addEventListener('change', () => {
        populateBranches();
        populateProjects();
        accountManagerSelect.value = '';
    });

    branchSelect.addEventListener('change', () => {
        populateProjects();
        accountManagerSelect.value = '';
    });

    projectSelect.addEventListener('change', () => {
        const project = projectsCache.find(p => parseInt(p.id, 10) === parseInt(projectSelect.value, 10));
        accountManagerSelect.value = project && project.account_manager_id ? project.account_manager_id : '';
    });

    const renderEmployeeChecklist = (selectedIds = []) => {
        const groups = groupedEmployees();
        return Object.keys(groups).map(group => {
            const items = groups[group].map(emp => `
                <label style="display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:700;">
                    <input type="checkbox" class="member-checkbox" value="${emp.id}" ${selectedIds.includes(parseInt(emp.id, 10)) ? 'checked' : ''}>
                    ${emp.full_name}
                </label>
            `).join('');
            return `
                <div style="padding:8px;border:1px solid var(--glass-border);border-radius:var(--radius-sm);background:rgba(255,255,255,0.05);">
                    <label style="display:flex;align-items:center;gap:7px;color:var(--teal-900);font-size:12px;font-weight:900;margin-bottom:7px;">
                        <input type="checkbox" class="team-group-toggle" style="width:auto;"> ${group}
                    </label>
                    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;">${items}</div>
                </div>
            `;
        }).join('');
    };

    const bindGroupToggles = root => {
        root.querySelectorAll('.team-group-toggle').forEach(toggle => {
            const box = toggle.closest('div');
            toggle.addEventListener('change', () => {
                box.querySelectorAll('.member-checkbox').forEach(input => input.checked = toggle.checked);
            });
        });
    };

    const addTeamCard = (data = {}) => {
        const tempId = data.tempId || `team-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const card = document.createElement('div');
        card.className = 'workflow-team-card';
        card.dataset.teamId = tempId;
        card.style.cssText = 'padding:12px;border:1px solid var(--glass-border);border-radius:var(--radius-sm);background:rgba(255,255,255,0.08);';
        card.innerHTML = `
            <div class="grid-two-col">
                <div class="form-group">
                    <label>Team Name</label>
                    <input type="text" class="team-name" value="${data.name || ''}" placeholder="Development Team">
                </div>
                <div class="form-group">
                    <label>Team Lead</label>
                    <select class="team-lead">${employeeOptions(data.leadId || '')}</select>
                </div>
            </div>
            <div class="form-group">
                <label>Members</label>
                <div class="team-members" style="display:flex;flex-direction:column;gap:8px;">${renderEmployeeChecklist(data.memberIds || [])}</div>
            </div>
            <button type="button" class="action-pill delete btn-remove-team"><i class="fa-solid fa-trash"></i> Remove Team</button>
        `;
        teamList.appendChild(card);
        bindGroupToggles(card);
        card.querySelector('.btn-remove-team').addEventListener('click', () => {
            card.remove();
            refreshTaskTeamOptions();
        });
        card.querySelector('.team-name').addEventListener('input', refreshTaskTeamOptions);
        refreshTaskTeamOptions();
    };

    const refreshTaskTeamOptions = () => {
        builderList.querySelectorAll('.task-team').forEach(select => {
            const current = select.value;
            select.innerHTML = teamOptions(current);
        });
    };

    const refreshDependencyOptions = () => {
        const cards = Array.from(builderList.querySelectorAll('.workflow-task-card'));
        cards.forEach(card => {
            const currentId = card.dataset.taskId;
            const selected = Array.from(card.querySelectorAll('.task-dependency:checked')).map(input => input.value);
            const options = cards
                .filter(other => other.dataset.taskId !== currentId)
                .map(other => {
                    const label = other.querySelector('.task-name').value.trim() || 'Untitled Task';
                    const id = other.dataset.taskId;
                    return `<label style="display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:700;">
                        <input type="checkbox" class="task-dependency" value="${id}" ${selected.includes(id) ? 'checked' : ''}> ${label}
                    </label>`;
                }).join('');
            card.querySelector('.dependency-list').innerHTML = options || '<span style="font-size:12.5px;color:var(--text-muted);">No other task nodes yet</span>';
        });
        renderProgressPreview();
    };

    const addWorkflowTaskCard = (data = {}) => {
        const tempId = data.tempId || `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const order = builderList.querySelectorAll('.workflow-task-card').length + 1;
        const card = document.createElement('div');
        card.className = 'workflow-task-card';
        card.dataset.taskId = tempId;
        card.style.cssText = 'padding:12px;border:1px solid var(--glass-border);border-radius:var(--radius-sm);background:rgba(255,255,255,0.08);';
        card.innerHTML = `
            <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:10px;">
                <strong style="color:var(--teal-900);">Step <span class="step-no">${order}</span></strong>
                <button type="button" class="action-pill delete btn-remove-task"><i class="fa-solid fa-trash"></i> Remove</button>
            </div>
            <div class="grid-two-col">
                <div class="form-group">
                    <label>Task Name</label>
                    <input type="text" class="task-name" value="${data.name || ''}" placeholder="Backend APIs">
                </div>
                <div class="form-group">
                    <label>Assigned Team</label>
                    <select class="task-team">${teamOptions(data.teamTempId || '')}</select>
                </div>
                <div class="form-group">
                    <label>Assigned Employee(s)</label>
                    <div class="task-employees" style="display:flex;flex-direction:column;gap:8px;">${renderEmployeeChecklist(data.assignedEmployeeIds || [])}</div>
                </div>
                <div class="form-group">
                    <label>Depends On</label>
                    <div class="dependency-list" style="display:flex;flex-direction:column;gap:6px;"></div>
                </div>
                <div class="form-group">
                    <label>Estimated Hours</label>
                    <input type="number" step="0.5" class="task-hours" value="${data.estimatedHours || ''}" placeholder="8.0">
                </div>
                <div class="form-group">
                    <label>Deadline</label>
                    <input type="date" class="task-deadline" value="${data.deadline || ''}">
                </div>
                <div class="form-group">
                    <label>Status</label>
                    <select class="task-status">
                        <option value="Not Started">Not Started</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Blocked">Blocked</option>
                        <option value="Completed">Completed</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Priority</label>
                    <select class="task-priority">
                        <option value="Low">Low</option>
                        <option value="Medium" selected>Medium</option>
                        <option value="High">High</option>
                        <option value="Critical">Critical</option>
                    </select>
                </div>
            </div>
        `;
        builderList.appendChild(card);
        card.querySelector('.task-status').value = data.status || 'Not Started';
        card.querySelector('.task-priority').value = data.priority || 'Medium';
        bindGroupToggles(card);
        card.querySelector('.btn-remove-task').addEventListener('click', () => {
            card.remove();
            updateStepNumbers();
            refreshDependencyOptions();
        });
        card.querySelector('.task-name').addEventListener('input', refreshDependencyOptions);
        refreshDependencyOptions();
    };

    const updateStepNumbers = () => {
        builderList.querySelectorAll('.workflow-task-card').forEach((card, index) => {
            card.querySelector('.step-no').textContent = index + 1;
        });
    };

    const renderProgressPreview = () => {
        const cards = Array.from(builderList.querySelectorAll('.workflow-task-card'));
        progressPreview.innerHTML = '';
        cards.forEach((card, index) => {
            const name = card.querySelector('.task-name').value.trim() || `Step ${index + 1}`;
            progressPreview.insertAdjacentHTML('beforeend', `
                <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
                    <span class="status-pill ${index === 0 ? 'progress' : 'pending'}" style="white-space:nowrap;">${index + 1}. ${name}</span>
                    ${index < cards.length - 1 ? '<i class="fa-solid fa-arrow-right" style="color:var(--teal-700);"></i>' : ''}
                </div>
            `);
        });
    };

    const resetWorkflowModal = () => {
        workflowForm.reset();
        teamList.innerHTML = '';
        builderList.innerHTML = '';
        progressPreview.innerHTML = '';
        accountManagerSelect.innerHTML = employeeOptions();
        addTeamCard({ name: 'Development Team' });
        addTeamCard({ name: 'Testing Team' });
        addTeamCard({ name: 'Design Team' });
        defaultSteps.forEach(name => addWorkflowTaskCard({ name }));
        refreshDependencyOptions();
    };

    openModalBtn.addEventListener('click', () => {
        resetWorkflowModal();
        modal.classList.add('active');
    });

    const closeModal = () => modal.classList.remove('active');
    closeModalBtn.addEventListener('click', closeModal);
    cancelModalBtn.addEventListener('click', closeModal);
    addTeamBtn.addEventListener('click', () => addTeamCard());
    addTaskBtn.addEventListener('click', () => addWorkflowTaskCard());

    const collectCheckedIds = root => Array.from(root.querySelectorAll('.member-checkbox:checked')).map(input => parseInt(input.value, 10));

    workflowForm.addEventListener('submit', async e => {
        e.preventDefault();

        const teams = Array.from(teamList.querySelectorAll('.workflow-team-card')).map(card => ({
            tempId: card.dataset.teamId,
            name: card.querySelector('.team-name').value.trim(),
            leadId: card.querySelector('.team-lead').value || null,
            memberIds: collectCheckedIds(card.querySelector('.team-members'))
        })).filter(team => team.name);

        const tasks = Array.from(builderList.querySelectorAll('.workflow-task-card')).map((card, index) => ({
            tempId: card.dataset.taskId,
            stepOrder: index + 1,
            name: card.querySelector('.task-name').value.trim(),
            teamTempId: card.querySelector('.task-team').value || null,
            assignedEmployeeIds: collectCheckedIds(card.querySelector('.task-employees')),
            estimatedHours: card.querySelector('.task-hours').value || null,
            deadline: card.querySelector('.task-deadline').value || null,
            status: card.querySelector('.task-status').value,
            priority: card.querySelector('.task-priority').value,
            dependencies: Array.from(card.querySelectorAll('.task-dependency:checked')).map(input => input.value),
            completionPercentage: card.querySelector('.task-status').value === 'Completed' ? 100 : 0
        })).filter(task => task.name);

        const payload = {
            name: document.getElementById('task-title').value.trim(),
            customerId: customerSelect.value || null,
            branchName: branchSelect.value || null,
            projectId: projectSelect.value || null,
            accountManagerId: accountManagerSelect.value || null,
            description: document.getElementById('task-desc').value.trim(),
            startDate: document.getElementById('workflow-start-date').value || null,
            targetCompletion: document.getElementById('task-due-date').value || null,
            priority: document.getElementById('task-priority').value,
            status: document.getElementById('task-status').value,
            teams,
            tasks
        };

        try {
            const response = await fetch('/api/v1/admin/tasks/workflows', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                alert(data.message || 'Workflow save failed');
                return;
            }
            closeModal();
            loadData();
        } catch (error) {
            console.error('Error saving workflow:', error);
            alert('Workflow save failed');
        }
    });

    const statusOptions = ['Planning', 'In Progress', 'On Hold', 'Completed'];

    const statusClass = status => {
        if (status === 'Completed') return 'progress';
        if (status === 'In Progress') return 'pending';
        if (status === 'On Hold') return 'delayed';
        return 'todo';
    };

    const renderWorkflows = () => {
        workflowsList.innerHTML = '';
        if (workflowsCache.length === 0) {
            workflowsList.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--text-muted);">No workflows created yet</td></tr>';
            return;
        }

        workflowsCache.forEach(workflow => {
            const graph = workflow.tasks.map((task, index) => `
                <span class="status-pill ${task.status === 'Completed' ? 'progress' : (task.status === 'In Progress' ? 'pending' : 'todo')}" style="white-space:nowrap;margin:2px;">${index + 1}. ${task.name}</span>
            `).join('<i class="fa-solid fa-arrow-right" style="color:var(--teal-700);margin:0 4px;"></i>');

            const teams = workflow.teams.map(team => `<span class="skill-pill" style="font-size:11.5px;padding:3px 7px;margin:2px;">${team.name}${team.lead_name ? ` - ${team.lead_name}` : ''}</span>`).join('') || '-';
            const target = workflow.target_completion ? new Date(workflow.target_completion).toLocaleDateString() : '-';
            const wfStatus = workflow.status || 'Planning';

            const tr = document.createElement('tr');
            tr.dataset.workflowId = workflow.id;
            tr.innerHTML = `
                <td class="task-name">${workflow.name}</td>
                <td>${workflow.customer_name || '-'}</td>
                <td>${workflow.project_name || '-'}</td>
                <td style="font-weight:700;color:var(--teal-900);">${workflow.account_manager_name || '-'}</td>
                <td>${teams}</td>
                <td><div style="display:flex;align-items:center;overflow-x:auto;max-width:360px;padding-bottom:4px;">${graph || '-'}</div></td>
                <td style="font-weight:700;color:var(--teal-900);">${target}</td>
                <td>
                    <div class="row-progress">
                        <div class="progress-track"><div class="progress-fill" style="width:${workflow.overall_completion || 0}%"></div></div>
                        <span>${workflow.overall_completion || 0}%</span>
                    </div>
                </td>
                <td>
                    <select class="wf-status-select" data-id="${workflow.id}" style="padding:4px 8px;border-radius:8px;font-size:12px;font-weight:700;border:1px solid var(--glass-border);background:rgba(255,255,255,0.5);color:var(--text-dark);cursor:pointer;">
                        ${statusOptions.map(s => `<option value="${s}" ${s === wfStatus ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                </td>
                <td>
                    <div style="display:flex;gap:5px;align-items:center;flex-wrap:nowrap;">
                        <button class="action-pill edit wf-edit-btn" data-id="${workflow.id}" title="Edit workflow"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
                        <button class="action-pill delete wf-delete-btn" data-id="${workflow.id}" title="Delete workflow"><i class="fa-solid fa-trash"></i> Delete</button>
                    </div>
                </td>
            `;
            workflowsList.appendChild(tr);
        });
    };

    // Status change handler
    workflowsList.addEventListener('change', async e => {
        const select = e.target.closest('.wf-status-select');
        if (!select) return;
        const id = select.dataset.id;
        const newStatus = select.value;
        try {
            const res = await fetch(`/api/v1/admin/tasks/workflows/${id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ status: newStatus })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message || 'Status update failed');
            // Update cache
            const wf = workflowsCache.find(w => parseInt(w.id, 10) === parseInt(id, 10));
            if (wf) wf.status = newStatus;
        } catch (err) {
            console.error('Status update error:', err);
            alert('Failed to update status: ' + err.message);
            loadData(); // Revert by reloading
        }
    });

    // Delete handler
    workflowsList.addEventListener('click', async e => {
        const deleteBtn = e.target.closest('.wf-delete-btn');
        if (deleteBtn) {
            const id = deleteBtn.dataset.id;
            const wf = workflowsCache.find(w => parseInt(w.id, 10) === parseInt(id, 10));
            if (!confirm(`Delete workflow "${wf?.name || id}"? This cannot be undone.`)) return;
            try {
                const res = await fetch(`/api/v1/admin/tasks/workflows/${id}`, {
                    method: 'DELETE',
                    credentials: 'include'
                });
                const data = await res.json();
                if (!data.success) throw new Error(data.message || 'Delete failed');
                workflowsCache = workflowsCache.filter(w => parseInt(w.id, 10) !== parseInt(id, 10));
                renderWorkflows();
            } catch (err) {
                console.error('Delete error:', err);
                alert('Failed to delete: ' + err.message);
            }
            return;
        }

        // Edit handler — open modal pre-filled
        const editBtn = e.target.closest('.wf-edit-btn');
        if (editBtn) {
            const id = editBtn.dataset.id;
            const wf = workflowsCache.find(w => parseInt(w.id, 10) === parseInt(id, 10));
            if (!wf) return;
            // Open modal and pre-fill basic fields
            if (modal) {
                modal.classList.add('active');
                document.getElementById('workflow-name')?.setAttribute('data-edit-id', id);
                if (document.getElementById('workflow-name')) document.getElementById('workflow-name').value = wf.name || '';
                if (document.getElementById('workflow-description')) document.getElementById('workflow-description').value = wf.description || '';
                if (customerSelect) {
                    customerSelect.value = wf.customer_id || '';
                    populateBranches();
                    populateProjects();
                }
                if (projectSelect) projectSelect.value = wf.project_id || '';
                if (accountManagerSelect) accountManagerSelect.value = wf.account_manager_id || '';
                const targetEl = document.getElementById('workflow-target-completion');
                if (targetEl && wf.target_completion) targetEl.value = wf.target_completion.split('T')[0];
            }
        }
    });



    const renderTemplates = () => {
        if (!templatesList) return;
        templatesList.innerHTML = '';
        if (templatesCache.length === 0) {
            templatesList.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--text-muted);">No task templates created</td></tr>';
            return;
        }
        templatesCache.forEach(temp => {
            templatesList.insertAdjacentHTML('beforeend', `
                <tr>
                    <td class="task-name">${temp.title}</td>
                    <td>${temp.frequency}</td>
                    <td><span class="priority-pill medium">${temp.priority || 'Medium'}</span></td>
                    <td>-</td>
                </tr>
            `);
        });
    };

    if (templateForm) {
        templateForm.addEventListener('submit', e => {
            e.preventDefault();
            alert('Templates remain available, but workflow creation is now the primary task model.');
        });
    }

    const loadAuditLogs = async () => {
        try {
            const [actRes, logRes] = await Promise.all([
                fetch('/api/v1/admin/audit/actions'),
                fetch('/api/v1/admin/audit/logins')
            ]);
            const actData = await actRes.json();
            const logData = await logRes.json();
            actionAuditsCache = actData.success ? actData.data.audits : [];
            loginLogsCache = logData.success ? logData.data : [];
            renderActionAudits();
            renderLoginLogs();
        } catch (error) {
            console.error('Error loading audit logs:', error);
        }
    };

    const renderActionAudits = () => {
        if (!actionAuditsList) return;
        const actionFilter = actFilterAction ? actFilterAction.value : '';
        const entityFilter = actFilterEntity ? actFilterEntity.value : '';
        const rows = actionAuditsCache.filter(item => (!actionFilter || item.action === actionFilter) && (!entityFilter || item.entity === entityFilter));
        actionAuditsList.innerHTML = rows.length ? rows.map(item => `
            <tr>
                <td>${new Date(item.created_at).toLocaleString()}</td>
                <td class="task-name">${item.full_name || item.email || 'System'}</td>
                <td><span class="status-pill progress">${item.action}</span></td>
                <td>${item.entity}</td>
                <td>${item.description || '-'}</td>
                <td>${item.ip_address || '-'}</td>
            </tr>
        `).join('') : '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted);">No audit records</td></tr>';
    };

    const renderLoginLogs = () => {
        if (!loginLogsList) return;
        loginLogsList.innerHTML = loginLogsCache.length ? loginLogsCache.map(item => `
            <tr>
                <td>${new Date(item.login_time).toLocaleString()}</td>
                <td class="task-name">${item.full_name || 'Administrator'}</td>
                <td>${item.ip_address || '-'}</td>
                <td><span class="status-pill progress">${item.status}</span></td>
            </tr>
        `).join('') : '<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--text-muted);">No session logins recorded</td></tr>';
    };

    if (actFilterAction) actFilterAction.addEventListener('change', renderActionAudits);
    if (actFilterEntity) actFilterEntity.addEventListener('change', renderActionAudits);

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await fetch('/api/v1/auth/logout', { method: 'POST' });
            window.location.href = '/login.html';
        });
    }

    loadData();
});
