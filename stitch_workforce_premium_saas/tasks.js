document.addEventListener('DOMContentLoaded', () => {
    const tabWorkflows = document.getElementById('tab-tasks');
    const tabTemplates = document.getElementById('tab-templates');
    const tabAuditLogs = document.getElementById('tab-audit-logs');
    const tabWorkload = document.getElementById('tab-workload');
    const viewWorkflows = document.getElementById('view-tasks');
    const viewTemplates = document.getElementById('view-templates');
    const viewAuditLogs = document.getElementById('view-audit-logs');
    const viewWorkload = document.getElementById('view-workload');
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
        if (tabWorkflows) tabWorkflows.classList.remove('active');
        if (tabTemplates) tabTemplates.classList.remove('active');
        if (tabAuditLogs) tabAuditLogs.classList.remove('active');
        if (tabWorkload) tabWorkload.classList.remove('active');
        if (viewWorkflows) viewWorkflows.style.display = 'none';
        if (viewTemplates) viewTemplates.style.display = 'none';
        if (viewAuditLogs) viewAuditLogs.style.display = 'none';
        if (viewWorkload) viewWorkload.style.display = 'none';

        if (tab === 'workflows') {
            if (tabWorkflows) tabWorkflows.classList.add('active');
            if (viewWorkflows) viewWorkflows.style.display = 'block';
            if (viewTitle) viewTitle.textContent = 'Active Workflows';
            loadData();
        } else if (tab === 'templates') {
            if (tabTemplates) tabTemplates.classList.add('active');
            if (viewTemplates) viewTemplates.style.display = 'block';
            if (viewTitle) viewTitle.textContent = 'Workflow Blueprint Library';
            renderBlueprintLibrary();
        } else if (tab === 'workload') {
            if (tabWorkload) tabWorkload.classList.add('active');
            if (viewWorkload) viewWorkload.style.display = 'block';
            if (viewTitle) viewTitle.textContent = 'Employee Capacity & Workload Heatmap';
            if (typeof window.renderWorkloadHeatmapDashboard === 'function') {
                window.renderWorkloadHeatmapDashboard('workload-heatmap-widget-container');
            }
        } else {
            if (tabAuditLogs) tabAuditLogs.classList.add('active');
            if (viewAuditLogs) viewAuditLogs.style.display = 'block';
            if (viewTitle) viewTitle.textContent = 'Audit Trails';
            loadAuditLogs();
        }
    };

    if (tabWorkflows) tabWorkflows.addEventListener('click', () => switchTab('workflows'));
    if (tabTemplates) tabTemplates.addEventListener('click', () => switchTab('templates'));
    if (tabAuditLogs) tabAuditLogs.addEventListener('click', () => switchTab('audit'));
    if (tabWorkload) tabWorkload.addEventListener('click', () => switchTab('workload'));

    const tabSubAction = document.getElementById('tab-sub-action');
    const tabSubLogin = document.getElementById('tab-sub-login');
    const panelAction = document.getElementById('panel-action');
    const panelLogin = document.getElementById('panel-login');

    if (tabSubAction) {
        tabSubAction.addEventListener('click', () => {
            tabSubAction.classList.add('active');
            if (tabSubLogin) tabSubLogin.classList.remove('active');
            if (panelAction) panelAction.style.display = 'block';
            if (panelLogin) panelLogin.style.display = 'none';
        });
    }
    if (tabSubLogin) {
        tabSubLogin.addEventListener('click', () => {
            tabSubLogin.classList.add('active');
            if (tabSubAction) tabSubAction.classList.remove('active');
            if (panelLogin) panelLogin.style.display = 'block';
            if (panelAction) panelAction.style.display = 'none';
        });
    }

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
        renderProgressPreview();
    };

    const addWorkflowTaskCard = (data = {}) => {
        const tempId = data.tempId || `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const order = builderList.querySelectorAll('.workflow-task-card').length + 1;
        const card = document.createElement('div');
        card.className = 'workflow-task-card';
        card.dataset.taskId = tempId;
        card.style.cssText = 'padding:14px;border:1px solid var(--glass-border);border-radius:var(--radius-sm);background:rgba(255,255,255,0.08);backdrop-filter:blur(16px);';
        card.innerHTML = `
            <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.25);">
                <strong style="color:var(--teal-900);font-size:14px;">Step <span class="step-no">${order}</span></strong>
                <button type="button" class="action-pill delete btn-remove-task"><i class="fa-solid fa-trash"></i> Remove</button>
            </div>
            <div class="grid-two-col">
                <div class="form-group">
                    <label>Task Name</label>
                    <input type="text" class="task-name" value="${data.name || ''}" placeholder="e.g. Requirement Gathering">
                </div>
                <div class="form-group">
                    <label>Assigned Team</label>
                    <select class="task-team">${teamOptions(data.teamTempId || '')}</select>
                </div>
                <div class="form-group">
                    <label>Assigned Employee(s)</label>
                    <div class="task-employees" style="display:flex;flex-direction:column;gap:8px;">${renderEmployeeChecklist(data.assignedEmployeeIds || [])}</div>
                </div>
                
                <!-- Dynamic Sub Tasks Module replacing Depends On -->
                <div class="form-group subtasks-module-group" style="grid-column: span 2; margin-top: 6px;">
                    <div class="subtasks-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <button type="button" class="btn-toggle-subtasks" style="display: none;">
                                <span class="toggle-icon">▼</span> Sub Tasks (<span class="subtask-count">0</span>)
                            </button>
                            <span class="subtasks-title-fallback" style="font-size: 13px; font-weight: 800; color: var(--teal-900);">Sub Tasks</span>
                        </div>
                        <button type="button" class="btn-add-subtask">
                            <i class="fa-solid fa-plus"></i> Add Sub Task
                        </button>
                    </div>

                    <!-- Progress Bar for Sub Tasks -->
                    <div class="subtask-progress-wrapper" style="display: none; margin-bottom: 12px; padding: 10px 14px; background: rgba(255, 255, 255, 0.15); border: 1px solid var(--glass-border); border-radius: var(--radius-sm); backdrop-filter: blur(12px);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-size: 12px; font-weight: 700; color: var(--teal-900);">
                            <span>Sub Tasks Progress</span>
                            <span class="subtask-progress-stats"><strong class="subtask-progress-percent">0%</strong> (<span class="subtask-completed-count">0</span>/<span class="subtask-total-count">0</span> Completed)</span>
                        </div>
                        <div class="progress-track" style="height: 8px; background: rgba(0, 0, 0, 0.08); border-radius: 4px; overflow: hidden; position: relative;">
                            <div class="subtask-progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, var(--teal-600), var(--green-line)); border-radius: 4px; transition: width 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);"></div>
                        </div>
                    </div>

                    <!-- Sub Tasks Collapsible List Container -->
                    <div class="subtasks-container" style="display: flex; flex-direction: column; gap: 10px;"></div>
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

        // Subtask module elements & logic
        const subtasksContainer = card.querySelector('.subtasks-container');
        const btnAddSubtask = card.querySelector('.btn-add-subtask');
        const btnToggleSubtasks = card.querySelector('.btn-toggle-subtasks');
        const subtasksTitleFallback = card.querySelector('.subtasks-title-fallback');
        const subtaskProgressWrapper = card.querySelector('.subtask-progress-wrapper');
        const toggleIcon = card.querySelector('.toggle-icon');
        const subtaskCountSpan = card.querySelector('.subtask-count');
        const subtaskProgressPercent = card.querySelector('.subtask-progress-percent');
        const subtaskCompletedCount = card.querySelector('.subtask-completed-count');
        const subtaskTotalCount = card.querySelector('.subtask-total-count');
        const subtaskProgressBar = card.querySelector('.subtask-progress-bar');
        const parentStatusSelect = card.querySelector('.task-status');

        let isCollapsed = false;

        const updateSubtaskUI = () => {
            const subtaskCards = Array.from(subtasksContainer.querySelectorAll('.subtask-card'));
            const total = subtaskCards.length;
            const completed = subtaskCards.filter(sc => sc.querySelector('.subtask-status').value === 'Completed').length;
            const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

            subtaskCountSpan.textContent = total;
            subtaskTotalCount.textContent = total;
            subtaskCompletedCount.textContent = completed;
            subtaskProgressPercent.textContent = `${percent}%`;
            subtaskProgressBar.style.width = `${percent}%`;

            if (total > 0) {
                btnToggleSubtasks.style.display = 'inline-flex';
                subtasksTitleFallback.style.display = 'none';
                subtaskProgressWrapper.style.display = 'block';
                if (!isCollapsed) {
                    subtasksContainer.style.display = 'flex';
                }
            } else {
                btnToggleSubtasks.style.display = 'none';
                subtasksTitleFallback.style.display = 'inline-block';
                subtaskProgressWrapper.style.display = 'none';
                subtasksContainer.style.display = 'none';
            }

            // Auto Progress: Mark parent task completed if all subtasks are completed
            if (total > 0 && completed === total) {
                parentStatusSelect.value = 'Completed';
            }

            subtaskCards.forEach((sc, idx) => {
                const idxSpan = sc.querySelector('.subtask-index');
                if (idxSpan) idxSpan.textContent = idx + 1;
            });
        };

        const toggleCollapse = () => {
            isCollapsed = !isCollapsed;
            if (isCollapsed) {
                subtasksContainer.style.display = 'none';
                toggleIcon.textContent = '▶';
            } else {
                subtasksContainer.style.display = 'flex';
                toggleIcon.textContent = '▼';
            }
        };

        btnToggleSubtasks.addEventListener('click', toggleCollapse);

        const addSubtaskCard = (stData = {}) => {
            const subtaskId = stData.id || `subtask-${Date.now()}-${Math.random().toString(16).slice(2)}`;
            const stCard = document.createElement('div');
            stCard.className = 'subtask-card';
            stCard.dataset.subtaskId = subtaskId;
            stCard.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.3);">
                    <span style="font-size: 12px; font-weight: 800; color: var(--teal-900); display: flex; align-items: center; gap: 6px;">
                        <i class="fa-solid fa-list-check" style="color: var(--teal-700);"></i> Sub Task <span class="subtask-index">1</span>
                    </span>
                    <button type="button" class="action-pill delete btn-remove-subtask" style="padding: 3px 10px; font-size: 11.5px; border-radius: 12px; background: rgba(214, 79, 79, 0.15); color: var(--red); border: 1px solid rgba(214,79,79,0.3); font-weight: 700; cursor: pointer; transition: all 0.2s;">
                        <i class="fa-solid fa-trash"></i> Remove Sub Task
                    </button>
                </div>

                <div class="subtask-grid" style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px;">
                    <div class="form-group" style="grid-column: span 2;">
                        <label style="font-size: 11.5px; font-weight: 700; color: var(--teal-900);">Sub Task Name</label>
                        <input type="text" class="subtask-name" value="${stData.name || ''}" placeholder="e.g. Frontend Requirements" style="width: 100%; padding: 7px 10px; border-radius: 8px; border: 1px solid var(--glass-border); background: rgba(255,255,255,0.6); font-size: 12.5px; font-weight: 600; color: var(--text-dark);">
                    </div>

                    <div class="form-group">
                        <label style="font-size: 11.5px; font-weight: 700; color: var(--teal-900);">Assigned Employee</label>
                        <select class="subtask-assignee" style="width: 100%; padding: 7px 10px; border-radius: 8px; border: 1px solid var(--glass-border); background: rgba(255,255,255,0.6); font-size: 12.5px; font-weight: 600; color: var(--text-dark);">
                            ${employeeOptions(stData.assignedEmployeeId || '')}
                        </select>
                    </div>

                    <div class="form-group">
                        <label style="font-size: 11.5px; font-weight: 700; color: var(--teal-900);">Estimated Hours</label>
                        <input type="number" step="0.5" class="subtask-hours" value="${stData.estimatedHours || ''}" placeholder="e.g. 6.0" style="width: 100%; padding: 7px 10px; border-radius: 8px; border: 1px solid var(--glass-border); background: rgba(255,255,255,0.6); font-size: 12.5px; font-weight: 600; color: var(--text-dark);">
                    </div>

                    <div class="form-group">
                        <label style="font-size: 11.5px; font-weight: 700; color: var(--teal-900);">Deadline</label>
                        <input type="date" class="subtask-deadline" value="${stData.deadline || ''}" style="width: 100%; padding: 7px 10px; border-radius: 8px; border: 1px solid var(--glass-border); background: rgba(255,255,255,0.6); font-size: 12.5px; font-weight: 600; color: var(--text-dark);">
                    </div>

                    <div class="form-group">
                        <label style="font-size: 11.5px; font-weight: 700; color: var(--teal-900);">Status</label>
                        <select class="subtask-status" style="width: 100%; padding: 7px 10px; border-radius: 8px; border: 1px solid var(--glass-border); background: rgba(255,255,255,0.6); font-size: 12.5px; font-weight: 600; color: var(--text-dark);">
                            <option value="Not Started" ${stData.status === 'Not Started' ? 'selected' : ''}>Not Started</option>
                            <option value="In Progress" ${stData.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                            <option value="Completed" ${stData.status === 'Completed' ? 'selected' : ''}>Completed</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label style="font-size: 11.5px; font-weight: 700; color: var(--teal-900);">Priority</label>
                        <select class="subtask-priority" style="width: 100%; padding: 7px 10px; border-radius: 8px; border: 1px solid var(--glass-border); background: rgba(255,255,255,0.6); font-size: 12.5px; font-weight: 600; color: var(--text-dark);">
                            <option value="Low" ${stData.priority === 'Low' ? 'selected' : ''}>Low</option>
                            <option value="Medium" ${!stData.priority || stData.priority === 'Medium' ? 'selected' : ''}>Medium</option>
                            <option value="High" ${stData.priority === 'High' ? 'selected' : ''}>High</option>
                            <option value="Critical" ${stData.priority === 'Critical' ? 'selected' : ''}>Critical</option>
                        </select>
                    </div>

                    <div class="form-group" style="grid-column: span 2;">
                        <label style="font-size: 11.5px; font-weight: 700; color: var(--teal-900);">Remarks / Notes <span style="font-weight:400;color:var(--text-muted);">(optional)</span></label>
                        <input type="text" class="subtask-remarks" value="${stData.remarks || ''}" placeholder="e.g. Additional documentation required" style="width: 100%; padding: 7px 10px; border-radius: 8px; border: 1px solid var(--glass-border); background: rgba(255,255,255,0.6); font-size: 12.5px; font-weight: 600; color: var(--text-dark);">
                    </div>
                </div>
            `;

            subtasksContainer.appendChild(stCard);

            if (isCollapsed) {
                toggleCollapse();
            }

            stCard.querySelector('.subtask-status').addEventListener('change', updateSubtaskUI);

            stCard.querySelector('.btn-remove-subtask').addEventListener('click', () => {
                stCard.classList.add('removing');
                setTimeout(() => {
                    stCard.remove();
                    updateSubtaskUI();
                }, 200);
            });

            updateSubtaskUI();
        };

        btnAddSubtask.addEventListener('click', () => {
            addSubtaskCard();
        });

        if (Array.isArray(data.subtasks) && data.subtasks.length > 0) {
            data.subtasks.forEach(st => addSubtaskCard(st));
        } else if (data.name === 'Requirement Gathering') {
            addSubtaskCard({ name: 'Frontend Requirements', status: 'Completed', priority: 'High', estimatedHours: 8 });
            addSubtaskCard({ name: 'Backend Requirements', status: 'Completed', priority: 'High', estimatedHours: 6 });
            addSubtaskCard({ name: 'Database Requirements', status: 'In Progress', priority: 'Medium', estimatedHours: 4 });
        }

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

        const tasks = Array.from(builderList.querySelectorAll('.workflow-task-card')).map((card, index) => {
            const subtaskCards = Array.from(card.querySelectorAll('.subtask-card'));
            const subtasks = subtaskCards.map(sc => ({
                id: sc.dataset.subtaskId,
                name: sc.querySelector('.subtask-name').value.trim(),
                assignedEmployeeId: sc.querySelector('.subtask-assignee').value || null,
                estimatedHours: sc.querySelector('.subtask-hours').value || null,
                deadline: sc.querySelector('.subtask-deadline').value || null,
                status: sc.querySelector('.subtask-status').value,
                priority: sc.querySelector('.subtask-priority').value,
                remarks: sc.querySelector('.subtask-remarks').value.trim()
            })).filter(st => st.name);

            return {
                tempId: card.dataset.taskId,
                stepOrder: index + 1,
                name: card.querySelector('.task-name').value.trim(),
                teamTempId: card.querySelector('.task-team').value || null,
                assignedEmployeeIds: collectCheckedIds(card.querySelector('.task-employees')),
                estimatedHours: card.querySelector('.task-hours').value || null,
                deadline: card.querySelector('.task-deadline').value || null,
                status: card.querySelector('.task-status').value,
                priority: card.querySelector('.task-priority').value,
                subtasks,
                dependencies: [],
                completionPercentage: card.querySelector('.task-status').value === 'Completed' ? 100 : (
                    subtasks.length > 0 ? Math.round((subtasks.filter(s => s.status === 'Completed').length / subtasks.length) * 100) : 0
                )
            };
        }).filter(task => task.name);

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
                        <button type="button" class="action-pill delete wf-archive-btn" data-id="${workflow.id}" data-name="${(workflow.name || '').replace(/"/g, '&quot;')}" title="Archive Task" style="background:rgba(239,68,68,0.15); color:#ef4444; border:1px solid rgba(239,68,68,0.3); font-weight:700; cursor:pointer;"><i class="fa-solid fa-box-archive"></i> Archive Task</button>
                    </div>
                </td>
            `;

            tr.querySelector('.wf-archive-btn').addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const id = e.currentTarget.dataset.id;
                const name = e.currentTarget.dataset.name;
                if (typeof window.openDeletionWizard === 'function') {
                    window.openDeletionWizard('task', id, name);
                }
            });

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



    // =========================================================================
    // WORKFLOW BLUEPRINT LIBRARY ENGINE & WIZARD
    // =========================================================================
    let blueprintLibraryCache = [
        {
            id: 'bp-web-dev',
            name: 'Website Development & Deployment',
            category: 'Software & Tech',
            dept: 'Engineering',
            estDays: 18,
            priority: 'High',
            tags: ['Web', 'Frontend', 'Backend', 'DevOps'],
            description: 'Comprehensive end-to-end workflow for designing, building, testing, and deploying responsive enterprise web applications.',
            isFavorite: true,
            createdBy: 'System Architect',
            lastUpdated: '2026-07-20',
            teamsCount: 4,
            tasksCount: 8,
            subtasksCount: 31,
            phasesCount: 5,
            teams: [
                { name: 'UI/UX Design Team' },
                { name: 'Frontend Engineering' },
                { name: 'Backend Engineering' },
                { name: 'QA & DevOps Team' }
            ],
            phases: [
                {
                    name: 'Planning & Discovery',
                    color: '#0284c7',
                    tasks: [
                        {
                            name: 'Requirement Gathering & Scope',
                            team: 'UI/UX Design Team',
                            subtasks: [
                                { name: 'Client Stakeholder Interviews', priority: 'High', estimatedHours: 8, status: 'Completed' },
                                { name: 'Technical Feasibility Analysis', priority: 'High', estimatedHours: 6, status: 'Completed' },
                                { name: 'Scope Definition Document', priority: 'Medium', estimatedHours: 4, status: 'Completed' }
                            ]
                        },
                        {
                            name: 'Architecture & DB Schema Design',
                            team: 'Backend Engineering',
                            subtasks: [
                                { name: 'PostgreSQL Schema Blueprint', priority: 'High', estimatedHours: 8, status: 'Completed' },
                                { name: 'REST API Specification', priority: 'High', estimatedHours: 6, status: 'In Progress' }
                            ]
                        }
                    ]
                },
                {
                    name: 'Design & Prototyping',
                    color: '#8b5cf6',
                    tasks: [
                        {
                            name: 'Figma Design System & Wireframes',
                            team: 'UI/UX Design Team',
                            subtasks: [
                                { name: 'Component Library & Colors', priority: 'Medium', estimatedHours: 12, status: 'In Progress' },
                                { name: 'Responsive Mobile Layouts', priority: 'Medium', estimatedHours: 8, status: 'Pending' }
                            ]
                        }
                    ]
                },
                {
                    name: 'Core Development',
                    color: '#047857',
                    tasks: [
                        {
                            name: 'Frontend UI Components',
                            team: 'Frontend Engineering',
                            subtasks: [
                                { name: 'Dashboard & Navigation Shell', priority: 'High', estimatedHours: 16, status: 'Pending' },
                                { name: 'Interactive Data Tables', priority: 'Medium', estimatedHours: 12, status: 'Pending' }
                            ]
                        },
                        {
                            name: 'REST Microservices & DB Controllers',
                            team: 'Backend Engineering',
                            subtasks: [
                                { name: 'Auth & JWT Middleware', priority: 'High', estimatedHours: 10, status: 'Pending' },
                                { name: 'CRUD Controllers & Validation', priority: 'High', estimatedHours: 14, status: 'Pending' }
                            ]
                        }
                    ]
                },
                {
                    name: 'Quality Assurance & Testing',
                    color: '#f59e0b',
                    tasks: [
                        {
                            name: 'Functional & Integration Testing',
                            team: 'QA & DevOps Team',
                            subtasks: [
                                { name: 'End-to-End User Flow Audit', priority: 'High', estimatedHours: 10, status: 'Pending' },
                                { name: 'OWASP Security Vulnerability Scan', priority: 'High', estimatedHours: 8, status: 'Pending' }
                            ]
                        }
                    ]
                },
                {
                    name: 'Deployment & Release',
                    color: '#ec4899',
                    tasks: [
                        {
                            name: 'Production Release & Monitoring',
                            team: 'QA & DevOps Team',
                            subtasks: [
                                { name: 'SSL Certificate & Domain Setup', priority: 'High', estimatedHours: 4, status: 'Pending' },
                                { name: 'Production Smoke Testing', priority: 'High', estimatedHours: 4, status: 'Pending' }
                            ]
                        }
                    ]
                }
            ]
        },
        {
            id: 'bp-crm-impl',
            name: 'Enterprise CRM Implementation',
            category: 'Operations',
            dept: 'Operations',
            estDays: 25,
            priority: 'High',
            tags: ['CRM', 'Data Migration', 'Enterprise'],
            description: 'Standardized operational blueprint for auditing legacy customer data, configuring custom fields, migrating records, and training staff.',
            isFavorite: false,
            createdBy: 'Operations Director',
            lastUpdated: '2026-07-22',
            teamsCount: 3,
            tasksCount: 6,
            subtasksCount: 24,
            phasesCount: 4,
            teams: [
                { name: 'Business Analysis Team' },
                { name: 'CRM Integration Team' },
                { name: 'Training & Support Team' }
            ],
            phases: [
                {
                    name: 'Discovery & Audit',
                    color: '#0284c7',
                    tasks: [
                        {
                            name: 'Legacy System Audit',
                            team: 'Business Analysis Team',
                            subtasks: [
                                { name: 'Export Legacy Customer CSVs', priority: 'High', estimatedHours: 6, status: 'Completed' },
                                { name: 'Field Mapping & Normalization', priority: 'High', estimatedHours: 8, status: 'Completed' }
                            ]
                        }
                    ]
                },
                {
                    name: 'Configuration & Customization',
                    color: '#047857',
                    tasks: [
                        {
                            name: 'Custom Pipeline & Role Setup',
                            team: 'CRM Integration Team',
                            subtasks: [
                                { name: 'Role-based Permissions', priority: 'High', estimatedHours: 6, status: 'In Progress' }
                            ]
                        }
                    ]
                },
                {
                    name: 'Data Import & Validation',
                    color: '#8b5cf6',
                    tasks: [
                        {
                            name: 'Staged CSV Bulk Import',
                            team: 'CRM Integration Team',
                            subtasks: [
                                { name: 'Duplicate Record Scrubbing', priority: 'High', estimatedHours: 10, status: 'Pending' }
                            ]
                        }
                    ]
                },
                {
                    name: 'Go-Live & Adoption',
                    color: '#f59e0b',
                    tasks: [
                        {
                            name: 'Staff Workshops & Go-Live',
                            team: 'Training & Support Team',
                            subtasks: [
                                { name: 'Conduct Admin Training Session', priority: 'Medium', estimatedHours: 6, status: 'Pending' }
                            ]
                        }
                    ]
                }
            ]
        },
        {
            id: 'bp-emp-onboard',
            name: 'Employee Onboarding & Provisioning',
            category: 'HR & Onboarding',
            dept: 'HR',
            estDays: 7,
            priority: 'Medium',
            tags: ['HR', 'Onboarding', 'Compliance'],
            description: 'Automated 7-day employee pre-boarding and IT asset provisioning workflow for seamless team integration.',
            isFavorite: true,
            createdBy: 'HR Lead',
            lastUpdated: '2026-07-24',
            teamsCount: 2,
            tasksCount: 5,
            subtasksCount: 16,
            phasesCount: 4,
            teams: [
                { name: 'HR Operations Team' },
                { name: 'IT Asset Support Team' }
            ],
            phases: [
                {
                    name: 'Pre-boarding Documentation',
                    color: '#047857',
                    tasks: [
                        {
                            name: 'Background Verification & Offer',
                            team: 'HR Operations Team',
                            subtasks: [
                                { name: 'Identity Proof Audit', priority: 'High', estimatedHours: 4, status: 'Completed' }
                            ]
                        }
                    ]
                },
                {
                    name: 'IT Workstation Setup',
                    color: '#0284c7',
                    tasks: [
                        {
                            name: 'Hardware & Email Provisioning',
                            team: 'IT Asset Support Team',
                            subtasks: [
                                { name: 'Create Google Workspace Email', priority: 'High', estimatedHours: 2, status: 'Completed' },
                                { name: 'Laptop OS & Security Image', priority: 'High', estimatedHours: 4, status: 'In Progress' }
                            ]
                        }
                    ]
                },
                {
                    name: 'Orientation & Training',
                    color: '#8b5cf6',
                    tasks: [
                        {
                            name: 'Company Policies & Culture Brief',
                            team: 'HR Operations Team',
                            subtasks: [
                                { name: 'Handbook Signoff', priority: 'Medium', estimatedHours: 2, status: 'Pending' }
                            ]
                        }
                    ]
                },
                {
                    name: 'First Week Review',
                    color: '#ec4899',
                    tasks: [
                        {
                            name: '30-Day Check-in Schedule',
                            team: 'HR Operations Team',
                            subtasks: [
                                { name: 'Manager Feedback Survey', priority: 'Low', estimatedHours: 1, status: 'Pending' }
                            ]
                        }
                    ]
                }
            ]
        },
        {
            id: 'bp-client-support',
            name: 'Client Support & SLA Escalation',
            category: 'Customer Success',
            dept: 'Sales & Support',
            estDays: 5,
            priority: 'High',
            tags: ['Support', 'SLA', 'Client Success'],
            description: 'Incident triage and customer SLA escalation workflow for resolving critical bugs and customer requests.',
            isFavorite: false,
            createdBy: 'Support Lead',
            lastUpdated: '2026-07-25',
            teamsCount: 2,
            tasksCount: 4,
            subtasksCount: 12,
            phasesCount: 3,
            teams: [
                { name: 'L1/L2 Support Team' },
                { name: 'Engineering Escalation' }
            ],
            phases: [
                {
                    name: 'Triage & Classification',
                    color: '#f59e0b',
                    tasks: [
                        {
                            name: 'Ticket Logging & Impact Audit',
                            team: 'L1/L2 Support Team',
                            subtasks: [
                                { name: 'Verify SLA Threshold', priority: 'High', estimatedHours: 1, status: 'Completed' }
                            ]
                        }
                    ]
                },
                {
                    name: 'Engineering Investigation',
                    color: '#0284c7',
                    tasks: [
                        {
                            name: 'Hotfix & Patch Deployment',
                            team: 'Engineering Escalation',
                            subtasks: [
                                { name: 'Reproduce Issue in Staging', priority: 'High', estimatedHours: 4, status: 'In Progress' }
                            ]
                        }
                    ]
                },
                {
                    name: 'Client Communication',
                    color: '#047857',
                    tasks: [
                        {
                            name: 'Resolution Notice & RCA Report',
                            team: 'L1/L2 Support Team',
                            subtasks: [
                                { name: 'Send Client Closure Email', priority: 'Medium', estimatedHours: 1, status: 'Pending' }
                            ]
                        }
                    ]
                }
            ]
        },
        {
            id: 'bp-office-setup',
            name: 'Office Facilities & Infrastructure Setup',
            category: 'Operations',
            dept: 'Operations',
            estDays: 14,
            priority: 'Medium',
            tags: ['Facilities', 'Infrastructure', 'Office'],
            description: 'Structured facilities setup workflow for new branch locations, networking, desks, and safety compliance.',
            isFavorite: false,
            createdBy: 'Facilities Lead',
            lastUpdated: '2026-07-21',
            teamsCount: 3,
            tasksCount: 9,
            subtasksCount: 35,
            phasesCount: 5,
            teams: [
                { name: 'Admin & Procurement' },
                { name: 'IT Infrastructure' },
                { name: 'Safety & Compliance' }
            ],
            phases: [
                {
                    name: 'Lease & Permits',
                    color: '#0284c7',
                    tasks: [
                        {
                            name: 'Commercial Agreement Signoff',
                            team: 'Admin & Procurement',
                            subtasks: [{ name: 'Fire & Building Safety Permits', priority: 'High', estimatedHours: 8, status: 'Completed' }]
                        }
                    ]
                },
                {
                    name: 'IT Networking',
                    color: '#047857',
                    tasks: [
                        {
                            name: 'ISP Fiber Link & Rack Mounting',
                            team: 'IT Infrastructure',
                            subtasks: [{ name: 'WIFI Access Points Setup', priority: 'High', estimatedHours: 12, status: 'In Progress' }]
                        }
                    ]
                }
            ]
        },
        {
            id: 'bp-marketing-launch',
            name: 'Omnichannel Marketing Campaign',
            category: 'Marketing',
            dept: 'Marketing',
            estDays: 21,
            priority: 'Medium',
            tags: ['Marketing', 'Campaign', 'Brand'],
            description: 'Multi-channel brand awareness campaign blueprint covering creative copywriting, video editing, ad networks, and lead tracking.',
            isFavorite: false,
            createdBy: 'Marketing Manager',
            lastUpdated: '2026-07-23',
            teamsCount: 3,
            tasksCount: 7,
            subtasksCount: 22,
            phasesCount: 4,
            teams: [
                { name: 'Creative Design' },
                { name: 'Content & Copywriting' },
                { name: 'Performance Media' }
            ],
            phases: [
                {
                    name: 'Strategy & Brief',
                    color: '#8b5cf6',
                    tasks: [
                        {
                            name: 'Campaign Messaging Brief',
                            team: 'Content & Copywriting',
                            subtasks: [{ name: 'Target Persona Mapping', priority: 'Medium', estimatedHours: 6, status: 'Completed' }]
                        }
                    ]
                }
            ]
        },
        {
            id: 'bp-qa-audit',
            name: 'QA & Security Compliance Audit',
            category: 'QA & Testing',
            dept: 'Engineering',
            estDays: 10,
            priority: 'High',
            tags: ['Security', 'QA', 'Audit', 'SOC2'],
            description: 'Rigorous security vulnerability scanning, automated test suite runs, penetration testing, and compliance reporting.',
            isFavorite: false,
            createdBy: 'Head of QA',
            lastUpdated: '2026-07-24',
            teamsCount: 2,
            tasksCount: 6,
            subtasksCount: 18,
            phasesCount: 4,
            teams: [
                { name: 'Security Audit Team' },
                { name: 'QA Automation Team' }
            ],
            phases: [
                {
                    name: 'Vulnerability Scan',
                    color: '#ef4444',
                    tasks: [
                        {
                            name: 'SAST & DAST Code Scan',
                            team: 'Security Audit Team',
                            subtasks: [{ name: 'Dependency Risk Analysis', priority: 'High', estimatedHours: 8, status: 'Completed' }]
                        }
                    ]
                }
            ]
        }
    ];

    const renderBlueprintLibrary = () => {
        const grid = document.getElementById('blueprint-cards-grid');
        const emptyState = document.getElementById('blueprint-empty-state');
        if (!grid) return;

        const searchVal = (document.getElementById('search-blueprint-input')?.value || '').toLowerCase().trim();
        const catVal = document.getElementById('filter-blueprint-category')?.value || '';
        const deptVal = document.getElementById('filter-blueprint-dept')?.value || '';

        let filtered = blueprintLibraryCache.filter(bp => {
            const matchSearch = !searchVal || 
                bp.name.toLowerCase().includes(searchVal) || 
                (bp.description && bp.description.toLowerCase().includes(searchVal)) || 
                (bp.tags && bp.tags.some(t => t.toLowerCase().includes(searchVal)));
            const matchCat = !catVal || bp.category === catVal;
            const matchDept = !deptVal || bp.dept === deptVal;
            return matchSearch && matchCat && matchDept;
        });

        if (filtered.length === 0) {
            grid.style.display = 'none';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';
        grid.style.display = 'grid';
        grid.innerHTML = '';

        filtered.forEach(bp => {
            const isFav = bp.isFavorite;
            const card = document.createElement('div');
            card.className = 'card glass blueprint-card';
            card.style.cssText = `
                padding: 20px; border-radius: var(--radius-md); border: 1px solid var(--glass-border);
                background: rgba(255, 255, 255, 0.25); backdrop-filter: blur(14px); transition: transform 0.2s, box-shadow 0.2s;
                display: flex; flex-direction: column; justify-content: space-between; position: relative;
            `;

            card.innerHTML = `
                <div>
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
                        <span class="status-pill progress" style="font-size:11px; font-weight:800; background:rgba(4, 120, 87, 0.15); color:var(--teal-900);">${bp.category || 'General'}</span>
                        <div style="display:flex; gap:8px; align-items:center;">
                            <span style="font-size:11px; font-weight:700; color:var(--text-muted);">${bp.dept || 'Engineering'}</span>
                            <i class="fa-star ${isFav ? 'fa-solid' : 'fa-regular'} btn-fav-bp" data-id="${bp.id}" style="cursor:pointer; color:${isFav ? '#f59e0b' : 'var(--text-muted)'}; font-size:16px;"></i>
                        </div>
                    </div>

                    <h4 style="font-size:16px; font-weight:800; color:var(--teal-900); margin-bottom:6px; line-height:1.3;">${bp.name}</h4>
                    <p style="font-size:12.5px; color:var(--text-dark); line-height:1.4; margin-bottom:16px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${bp.description || 'No description provided.'}</p>

                    <!-- Metric Chips -->
                    <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:8px; margin-bottom:16px; background:rgba(255,255,255,0.3); padding:10px; border-radius:8px; border:1px solid rgba(255,255,255,0.4);">
                        <div style="text-align:center;">
                            <span style="font-size:10px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Phases</span>
                            <strong style="display:block; font-size:13.5px; color:var(--teal-900); font-weight:800;">${bp.phasesCount || (bp.phases ? bp.phases.length : 1)}</strong>
                        </div>
                        <div style="text-align:center;">
                            <span style="font-size:10px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Tasks</span>
                            <strong style="display:block; font-size:13.5px; color:var(--teal-900); font-weight:800;">${bp.tasksCount || 5}</strong>
                        </div>
                        <div style="text-align:center;">
                            <span style="font-size:10px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Duration</span>
                            <strong style="display:block; font-size:13.5px; color:var(--teal-900); font-weight:800;">${bp.estDays} Days</strong>
                        </div>
                    </div>
                </div>

                <!-- Footer Action Buttons -->
                <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid rgba(0,0,0,0.06); padding-top:12px; margin-top:8px;">
                    <div style="display:flex; gap:6px;">
                        <button type="button" class="btn-pill-action btn-pill-template btn-preview-bp" data-id="${bp.id}" style="padding:6px 12px; font-size:12px;"><i class="fa-solid fa-eye"></i> Preview</button>
                        <button type="button" class="btn-pill-action btn-pill-template btn-duplicate-bp" data-id="${bp.id}" style="padding:6px 10px; font-size:12px;" title="Duplicate Blueprint"><i class="fa-solid fa-copy"></i></button>
                        <button type="button" class="btn-pill-action btn-delete-bp" data-id="${bp.id}" style="padding:6px 10px; font-size:12px; color:var(--danger-color, #dc2626); border-color:rgba(220, 38, 38, 0.3);" title="Delete Blueprint"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                    <button type="button" class="btn-primary btn-use-bp" data-id="${bp.id}" style="padding:7px 16px; font-size:12.5px; font-weight:800; border-radius:var(--radius-pill);"><i class="fa-solid fa-play"></i> Use</button>
                </div>
            `;

            // Bind card event handlers
            card.querySelector('.btn-fav-bp').addEventListener('click', (e) => {
                bp.isFavorite = !bp.isFavorite;
                renderBlueprintLibrary();
            });

            card.querySelector('.btn-preview-bp').addEventListener('click', () => {
                openBlueprintPreviewModal(bp);
            });

            card.querySelector('.btn-duplicate-bp').addEventListener('click', () => {
                const clone = JSON.parse(JSON.stringify(bp));
                clone.id = 'bp-' + Date.now();
                clone.name = bp.name + ' (Copy)';
                clone.isFavorite = false;
                blueprintLibraryCache.unshift(clone);
                renderBlueprintLibrary();
            });

            card.querySelector('.btn-delete-bp').addEventListener('click', () => {
                if (confirm(`Are you sure you want to delete the "${bp.name}" blueprint?`)) {
                    blueprintLibraryCache = blueprintLibraryCache.filter(item => item.id !== bp.id);
                    renderBlueprintLibrary();
                }
            });

            card.querySelector('.btn-use-bp').addEventListener('click', () => {
                applyBlueprintToWorkflow(bp);
            });

            grid.appendChild(card);
        });
    };

    // Filter listeners
    document.getElementById('search-blueprint-input')?.addEventListener('input', renderBlueprintLibrary);
    document.getElementById('filter-blueprint-category')?.addEventListener('change', renderBlueprintLibrary);
    document.getElementById('filter-blueprint-dept')?.addEventListener('change', renderBlueprintLibrary);

    // Apply blueprint into Workflow builder
    const applyBlueprintToWorkflow = (bp) => {
        resetWorkflowModal();

        const nameEl = document.getElementById('workflow-name');
        const descEl = document.getElementById('workflow-description');
        if (nameEl) nameEl.value = bp.name || '';
        if (descEl) descEl.value = bp.description || '';

        // Clear existing default teams & add Blueprint teams
        teamList.innerHTML = '';
        if (Array.isArray(bp.teams) && bp.teams.length > 0) {
            bp.teams.forEach(t => addTeamCard({ name: t.name }));
        } else {
            addTeamCard({ name: 'Execution Team' });
        }

        // Clear existing default tasks & add Blueprint tasks
        builderList.innerHTML = '';
        if (Array.isArray(bp.phases) && bp.phases.length > 0) {
            bp.phases.forEach(phase => {
                if (Array.isArray(phase.tasks)) {
                    phase.tasks.forEach(task => {
                        addWorkflowTaskCard({
                            name: task.name,
                            subtasks: task.subtasks || []
                        });
                    });
                }
            });
        }

        refreshDependencyOptions();

        if (modal) {
            modal.classList.add('active');
        }
    };

    // Preview Modal logic
    const previewModal = document.getElementById('blueprint-preview-modal');
    const openBlueprintPreviewModal = (bp) => {
        if (!previewModal) return;
        document.getElementById('preview-bp-title').textContent = bp.name;
        document.getElementById('preview-bp-category').textContent = bp.category || 'General';
        document.getElementById('preview-bp-desc').textContent = bp.description || 'No description available.';

        document.getElementById('preview-stat-phases').textContent = bp.phasesCount || (bp.phases ? bp.phases.length : 1);
        document.getElementById('preview-stat-tasks').textContent = bp.tasksCount || 8;
        document.getElementById('preview-stat-subtasks').textContent = bp.subtasksCount || 24;
        document.getElementById('preview-stat-teams').textContent = bp.teamsCount || (bp.teams ? bp.teams.length : 2);
        document.getElementById('preview-stat-days').textContent = bp.estDays + ' Days';

        const list = document.getElementById('preview-phases-list');
        list.innerHTML = '';

        if (Array.isArray(bp.phases)) {
            bp.phases.forEach((p, idx) => {
                const phaseBox = document.createElement('div');
                phaseBox.style.cssText = 'padding:12px 14px; background:rgba(255,255,255,0.25); border:1px solid var(--glass-border); border-radius:8px;';
                
                let tasksHtml = '';
                if (Array.isArray(p.tasks)) {
                    p.tasks.forEach(t => {
                        let subtasksCount = Array.isArray(t.subtasks) ? t.subtasks.length : 0;
                        tasksHtml += `<div style="font-size:12.5px; font-weight:700; color:var(--teal-900); margin-top:4px; display:flex; justify-content:space-between;">
                            <span>• ${t.name}</span>
                            <span style="font-size:11px; color:var(--text-muted);">${t.team || 'Team'} (${subtasksCount} subtasks)</span>
                        </div>`;
                    });
                }

                phaseBox.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                        <strong style="font-size:13.5px; color:${p.color || 'var(--teal-900)'}; font-weight:800;">Phase ${idx + 1}: ${p.name}</strong>
                        <span style="font-size:11px; font-weight:700; color:var(--text-muted);">${p.tasks ? p.tasks.length : 0} tasks</span>
                    </div>
                    ${tasksHtml}
                `;
                list.appendChild(phaseBox);
            });
        }

        const useBtn = document.getElementById('preview-bp-use-btn');
        if (useBtn) {
            useBtn.onclick = () => {
                previewModal.style.display = 'none';
                previewModal.classList.remove('active');
                applyBlueprintToWorkflow(bp);
            };
        }

        previewModal.style.display = 'flex';
        previewModal.style.opacity = '1';
        previewModal.style.pointerEvents = 'auto';
        previewModal.classList.add('active');
    };

    document.getElementById('blueprint-preview-close')?.addEventListener('click', () => {
        previewModal.style.display = 'none';
        previewModal.classList.remove('active');
    });
    document.getElementById('preview-bp-cancel')?.addEventListener('click', () => {
        previewModal.style.display = 'none';
        previewModal.classList.remove('active');
    });

    // Workflow Creation Choice Modal
    const choiceModal = document.getElementById('workflow-creation-choice-modal');
    const choiceCloseBtn = document.getElementById('creation-choice-modal-close');
    const modeBlueprintBtn = document.getElementById('mode-select-blueprint');
    const modeBlankBtn = document.getElementById('mode-select-blank');
    const modeDuplicateBtn = document.getElementById('mode-select-duplicate');

    if (openModalBtn) {
        openModalBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (choiceModal) {
                choiceModal.style.display = 'flex';
                choiceModal.style.opacity = '1';
                choiceModal.style.pointerEvents = 'auto';
                choiceModal.classList.add('active');
            }
        });
    }

    const closeChoiceModal = () => {
        if (choiceModal) {
            choiceModal.style.display = 'none';
            choiceModal.style.opacity = '0';
            choiceModal.style.pointerEvents = 'none';
            choiceModal.classList.remove('active');
        }
    };

    if (choiceCloseBtn) choiceCloseBtn.addEventListener('click', closeChoiceModal);

    if (modeBlueprintBtn) {
        modeBlueprintBtn.addEventListener('click', () => {
            closeChoiceModal();
            switchTab('templates');
        });
    }

    if (modeBlankBtn) {
        modeBlankBtn.addEventListener('click', () => {
            closeChoiceModal();
            resetWorkflowModal();
            modal.classList.add('active');
        });
    }

    if (modeDuplicateBtn) {
        modeDuplicateBtn.addEventListener('click', () => {
            closeChoiceModal();
            if (workflowsCache.length > 0) {
                applyBlueprintToWorkflow({
                    name: workflowsCache[0].name + ' (Clone)',
                    description: workflowsCache[0].description,
                    teams: [{ name: 'Development Team' }],
                    phases: [{ tasks: [{ name: 'Cloned Task 1' }] }]
                });
            } else {
                resetWorkflowModal();
                modal.classList.add('active');
            }
        });
    }

    // 3-Step Wizard Modal for Creating Blueprints
    const wizardModal = document.getElementById('blueprint-wizard-modal');
    const btnOpenWizard = document.getElementById('btn-open-create-blueprint-modal');
    const btnEmptyCreate = document.getElementById('btn-empty-create-blueprint');
    const wizardClose = document.getElementById('blueprint-wizard-close');

    let currentWizardStep = 1;
    let wizardBlueprintDraft = {};

    const openWizardModal = () => {
        currentWizardStep = 1;
        wizardBlueprintDraft = {
            id: 'bp-' + Date.now(),
            name: '',
            category: 'Software & Tech',
            dept: 'Engineering',
            estDays: 14,
            priority: 'Medium',
            tags: [],
            description: '',
            phases: []
        };
        showWizardStep(1);
        if (wizardModal) {
            wizardModal.style.display = 'flex';
            wizardModal.style.opacity = '1';
            wizardModal.style.pointerEvents = 'auto';
            wizardModal.classList.add('active');
        }
    };

    const closeWizardModal = () => {
        if (wizardModal) {
            wizardModal.style.display = 'none';
            wizardModal.style.opacity = '0';
            wizardModal.style.pointerEvents = 'none';
            wizardModal.classList.remove('active');
        }
    };

    if (btnOpenWizard) btnOpenWizard.addEventListener('click', openWizardModal);
    if (btnEmptyCreate) btnEmptyCreate.addEventListener('click', openWizardModal);
    if (wizardClose) wizardClose.addEventListener('click', closeWizardModal);

    const showWizardStep = (stepNum) => {
        currentWizardStep = stepNum;
        document.getElementById('wizard-step-num').textContent = stepNum;
        
        const step1Content = document.getElementById('wizard-step-1-content');
        const step2Content = document.getElementById('wizard-step-2-content');
        const step3Content = document.getElementById('wizard-step-3-content');

        if (step1Content) step1Content.style.display = stepNum === 1 ? 'block' : 'none';
        if (step2Content) step2Content.style.display = stepNum === 2 ? 'block' : 'none';
        if (step3Content) step3Content.style.display = stepNum === 3 ? 'block' : 'none';

        document.getElementById('step-pill-1').style.background = stepNum >= 1 ? 'var(--teal-600)' : 'rgba(0,0,0,0.1)';
        document.getElementById('step-pill-2').style.background = stepNum >= 2 ? 'var(--teal-600)' : 'rgba(0,0,0,0.1)';
        document.getElementById('step-pill-3').style.background = stepNum >= 3 ? 'var(--teal-600)' : 'rgba(0,0,0,0.1)';

        if (stepNum === 3) {
            renderWizardPhases();
        }
    };

    document.getElementById('btn-wizard-step1-next')?.addEventListener('click', () => {
        const nameVal = document.getElementById('bp-name')?.value.trim();
        if (!nameVal) {
            alert('Please enter a Blueprint Name.');
            return;
        }
        wizardBlueprintDraft.name = nameVal;
        wizardBlueprintDraft.category = document.getElementById('bp-category')?.value || 'Software & Tech';
        wizardBlueprintDraft.dept = document.getElementById('bp-dept')?.value || 'Engineering';
        wizardBlueprintDraft.estDays = parseInt(document.getElementById('bp-days')?.value, 10) || 14;
        wizardBlueprintDraft.priority = document.getElementById('bp-priority')?.value || 'Medium';
        wizardBlueprintDraft.tags = (document.getElementById('bp-tags')?.value || '').split(',').map(t => t.trim()).filter(Boolean);
        wizardBlueprintDraft.description = document.getElementById('bp-desc')?.value.trim();

        showWizardStep(2);
    });

    document.getElementById('btn-wizard-step2-back')?.addEventListener('click', () => showWizardStep(1));
    document.getElementById('btn-wizard-step2-next')?.addEventListener('click', () => showWizardStep(3));
    document.getElementById('btn-wizard-step3-back')?.addEventListener('click', () => showWizardStep(2));

    // Starter Cards in Step 2
    document.querySelectorAll('.starter-option-card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.starter-option-card').forEach(c => {
                c.style.border = '1px solid var(--glass-border)';
                c.style.background = 'transparent';
            });
            card.style.border = '2px solid var(--teal-600)';
            card.style.background = 'rgba(4, 120, 87, 0.08)';

            const mode = card.dataset.starter;
            if (mode === 'ai') {
                openAiGeneratorModal();
            }
        });
    });

    // Render Phases in Step 3
    const renderWizardPhases = () => {
        const container = document.getElementById('wizard-phases-container');
        if (!container) return;

        if (!Array.isArray(wizardBlueprintDraft.phases) || wizardBlueprintDraft.phases.length === 0) {
            wizardBlueprintDraft.phases = [
                {
                    name: 'Planning & Discovery',
                    color: '#0284c7',
                    tasks: [{ name: 'Requirement Gathering', team: 'Design Team' }]
                },
                {
                    name: 'Development & Build',
                    color: '#047857',
                    tasks: [{ name: 'Core Feature Build', team: 'Frontend Team' }]
                }
            ];
        }

        container.innerHTML = '';
        wizardBlueprintDraft.phases.forEach((phase, idx) => {
            const card = document.createElement('div');
            card.className = 'card glass phase-card';
            card.style.cssText = 'padding:14px; border-radius:12px; border:1px solid var(--glass-border); background:rgba(255,255,255,0.2); margin-bottom:12px;';

            let tasksListHtml = '';
            if (Array.isArray(phase.tasks)) {
                phase.tasks.forEach(t => {
                    tasksListHtml += `
                        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:rgba(255,255,255,0.4); border-radius:8px; margin-top:6px;">
                            <span style="font-size:13px; font-weight:700; color:var(--teal-900);">${t.name}</span>
                            <span style="font-size:11px; color:var(--text-muted); font-weight:700;">${t.team || 'General Team'}</span>
                        </div>
                    `;
                });
            }

            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;" class="phase-header-bar">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="width:12px; height:12px; border-radius:50%; background:${phase.color || 'var(--teal-600)'};"></span>
                        <strong style="font-size:14px; font-weight:800; color:var(--teal-900);">Phase ${idx + 1}: ${phase.name}</strong>
                    </div>
                    <span style="font-size:12px; color:var(--text-muted); font-weight:700;">▼ Expand (${phase.tasks ? phase.tasks.length : 0} Tasks)</span>
                </div>
                <div class="phase-body" style="margin-top:10px; display:none;">
                    ${tasksListHtml}
                </div>
            `;

            const headerBar = card.querySelector('.phase-header-bar');
            const body = card.querySelector('.phase-body');
            headerBar.addEventListener('click', () => {
                const isHidden = body.style.display === 'none';
                body.style.display = isHidden ? 'block' : 'none';
                headerBar.querySelector('span:last-child').textContent = isHidden ? `▲ Collapse (${phase.tasks ? phase.tasks.length : 0} Tasks)` : `▼ Expand (${phase.tasks ? phase.tasks.length : 0} Tasks)`;
            });

            container.appendChild(card);
        });
    };

    document.getElementById('btn-wizard-add-phase')?.addEventListener('click', () => {
        const phaseName = prompt('Enter New Phase Name (e.g. Quality Assurance & Testing):');
        if (!phaseName) return;
        if (!wizardBlueprintDraft.phases) wizardBlueprintDraft.phases = [];
        wizardBlueprintDraft.phases.push({
            name: phaseName,
            color: '#8b5cf6',
            tasks: [{ name: phaseName + ' Task 1', team: 'Engineering' }]
        });
        renderWizardPhases();
    });

    document.getElementById('btn-wizard-save-blueprint')?.addEventListener('click', () => {
        wizardBlueprintDraft.phasesCount = wizardBlueprintDraft.phases ? wizardBlueprintDraft.phases.length : 1;
        wizardBlueprintDraft.tasksCount = wizardBlueprintDraft.phases ? wizardBlueprintDraft.phases.reduce((acc, p) => acc + (p.tasks ? p.tasks.length : 0), 0) : 4;
        wizardBlueprintDraft.subtasksCount = wizardBlueprintDraft.tasksCount * 3;
        wizardBlueprintDraft.teamsCount = 3;

        blueprintLibraryCache.unshift(wizardBlueprintDraft);
        closeWizardModal();
        renderBlueprintLibrary();
    });

    // ✨ AI Blueprint Generator Modal
    const aiModal = document.getElementById('ai-blueprint-generator-modal');
    const aiCloseBtn = document.getElementById('ai-generator-modal-close');
    const aiCancelBtn = document.getElementById('ai-generator-cancel');
    const btnSubmitAi = document.getElementById('btn-submit-ai-generate');

    const openAiGeneratorModal = () => {
        if (aiModal) {
            aiModal.style.display = 'flex';
            aiModal.style.opacity = '1';
            aiModal.style.pointerEvents = 'auto';
            aiModal.classList.add('active');
        }
    };

    const closeAiModal = () => {
        if (aiModal) {
            aiModal.style.display = 'none';
            aiModal.style.opacity = '0';
            aiModal.style.pointerEvents = 'none';
            aiModal.classList.remove('active');
        }
    };

    if (aiCloseBtn) aiCloseBtn.addEventListener('click', closeAiModal);
    if (aiCancelBtn) aiCancelBtn.addEventListener('click', closeAiModal);

    if (btnSubmitAi) {
        btnSubmitAi.addEventListener('click', () => {
            const promptVal = document.getElementById('ai-blueprint-prompt')?.value.trim() || 'Software Development';
            closeAiModal();

            wizardBlueprintDraft.name = promptVal + ' Workflow';
            wizardBlueprintDraft.description = `AI-generated enterprise workflow blueprint for ${promptVal}.`;
            wizardBlueprintDraft.phases = [
                {
                    name: 'Planning & Discovery',
                    color: '#0284c7',
                    tasks: [
                        { name: 'Initial Stakeholder Brief', team: 'Analysis Team' },
                        { name: 'Resource & Est. Hours Mapping', team: 'Planning Team' }
                    ]
                },
                {
                    name: 'Execution Phase',
                    color: '#047857',
                    tasks: [
                        { name: 'Core Deliverables Build', team: 'Engineering Team' }
                    ]
                },
                {
                    name: 'Quality Assurance & Delivery',
                    color: '#f59e0b',
                    tasks: [
                        { name: 'Testing & Client Handover', team: 'QA Team' }
                    ]
                }
            ];

            showWizardStep(3);
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
