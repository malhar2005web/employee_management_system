document.addEventListener('DOMContentLoaded', () => {
    // Modals
    const goalModal = document.getElementById('goal-modal');
    const btnAddGoal = document.getElementById('btn-add-goal');
    const goalClose = document.getElementById('goal-close');
    const goalCancel = document.getElementById('goal-cancel');
    const goalForm = document.getElementById('goal-form');
    const goalEditId = document.getElementById('goal-edit-id');
    const goalModalTitle = document.getElementById('goal-modal-title');

    // Evaluate Modal
    const evaluateModal = document.getElementById('evaluate-modal');
    const evaluateClose = document.getElementById('evaluate-close');
    const evaluateCancel = document.getElementById('evaluate-cancel');
    const evaluateForm = document.getElementById('evaluate-form');
    const evaluateId = document.getElementById('evaluate-id');

    // Selectors
    const goalEmployee = document.getElementById('goal-employee');
    const goalsList = document.getElementById('goals-list');
    const logoutBtn = document.getElementById('logout-btn');

    // Cache
    let employeesCache = [];
    let goalsCache = [];

    // Modal state open
    if (btnAddGoal) {
        btnAddGoal.addEventListener('click', () => {
            goalForm.reset();
            goalEditId.value = '';
            goalModalTitle.textContent = 'Set Goal';
            goalModal.classList.add('active');
        });
    }

    const closeGoalModal = () => {
        goalModal.classList.remove('active');
        goalForm.reset();
        goalEditId.value = '';
    };

    if (goalClose) goalClose.addEventListener('click', closeGoalModal);
    if (goalCancel) goalCancel.addEventListener('click', closeGoalModal);

    const closeEvaluateModal = () => {
        evaluateModal.classList.remove('active');
        evaluateForm.reset();
        evaluateId.value = '';
    };

    if (evaluateClose) evaluateClose.addEventListener('click', closeEvaluateModal);
    if (evaluateCancel) evaluateCancel.addEventListener('click', closeEvaluateModal);

    // Fetch lists
    const loadGoals = async () => {
        try {
            const response = await fetch('/api/v1/admin/goals');
            const data = await response.json();
            if (response.ok && data.success) {
                employeesCache = data.data.employees;
                goalsCache = data.data.goals;

                populateEmployeesDropdown();
                renderGoals();
            }
        } catch (error) {
            console.error("Error loading goals:", error);
        }
    };

    const populateEmployeesDropdown = () => {
        if (!goalEmployee) return;
        goalEmployee.innerHTML = '<option value="">Select Employee</option>';
        employeesCache.forEach(emp => {
            const opt = document.createElement('option');
            opt.value = emp.id;
            opt.textContent = emp.full_name;
            goalEmployee.appendChild(opt);
        });
    };

    const renderGoals = () => {
        if (!goalsList) return;
        goalsList.innerHTML = '';

        if (goalsCache.length === 0) {
            goalsList.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text-muted);">No employee performance goals set</td></tr>`;
            return;
        }

        goalsCache.forEach(g => {
            const target = parseFloat(g.target_value) || 0;
            const actual = parseFloat(g.actual_value) || 0;
            
            const statusClass = g.status === 'Achieved' ? 'progress' : (g.status === 'Not Achieved' ? 'todo' : 'pending');
            const statusLabel = g.status || 'In Progress';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="task-name">${g.full_name}</td>
                <td>
                    <div style="font-weight:700;color:var(--teal-900);">${g.title}</div>
                    <div style="font-size:11.5px;color:var(--text-muted);">${g.description || '-'}</div>
                </td>
                <td>${g.kpi || '-'}</td>
                <td style="font-weight:600;">${g.weightage}%</td>
                <td>${target} / ${actual}</td>
                <td>
                    <div class="row-progress">
                        <div class="progress-track"><div class="progress-fill" style="width:${g.percentage_achieved || 0}%"></div></div>
                        <span>${g.percentage_achieved || 0}%</span>
                    </div>
                </td>
                <td><span class="status-pill ${statusClass}">${statusLabel}</span></td>
                <td>
                    <div style="display:flex;gap:6px;">
                        <button class="action-pill edit" onclick="editGoalClick(${JSON.stringify(g).replace(/"/g, '&quot;')})"><i class="fa-solid fa-pen"></i> Edit</button>
                        <button class="action-pill evaluate" onclick="evaluateGoalClick(${JSON.stringify(g).replace(/"/g, '&quot;')})"><i class="fa-solid fa-stamp"></i> Evaluate</button>
                        <button class="action-pill delete" onclick="deleteGoalClick(${g.id})"><i class="fa-solid fa-trash"></i> Delete</button>
                    </div>
                </td>
            `;
            goalsList.appendChild(tr);
        });
    };

    // Goal set submit
    goalForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = goalEditId.value;

        const payload = {
            employeeId: goalEmployee.value,
            title: document.getElementById('goal-title').value.trim(),
            description: document.getElementById('goal-desc').value.trim(),
            type: document.getElementById('goal-type').value,
            weightage: document.getElementById('goal-weightage').value,
            targetValue: document.getElementById('goal-target').value || null,
            kpi: document.getElementById('goal-kpi').value.trim(),
            timeline: document.getElementById('goal-timeline').value.trim(),
            status: document.getElementById('goal-status').value
        };

        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/v1/admin/goals/${id}` : '/api/v1/admin/goals';

        try {
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (response.ok && data.success) {
                closeGoalModal();
                loadGoals();
            } else {
                alert(data.message || 'Error saving goal profile');
            }
        } catch (error) {
            console.error("Error setting employee goal:", error);
        }
    });

    // Evaluation submit
    evaluateForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = evaluateId.value;

        const payload = {
            status: document.getElementById('eval-status').value,
            managerFeedback: document.getElementById('eval-feedback').value.trim()
        };

        try {
            const response = await fetch(`/api/v1/admin/goals/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (response.ok && data.success) {
                closeEvaluateModal();
                loadGoals();
            } else {
                alert(data.message || 'Error occurred saving evaluation feedback');
            }
        } catch (error) {
            console.error("Error evaluating goal profile:", error);
        }
    });

    // Window action clicks
    window.editGoalClick = (goal) => {
        goalForm.reset();
        goalEditId.value = goal.id;
        goalModalTitle.textContent = 'Edit Goal';

        goalEmployee.value = goal.employee_id;
        document.getElementById('goal-title').value = goal.title;
        document.getElementById('goal-desc').value = goal.description || '';
        document.getElementById('goal-type').value = goal.type || 'Individual';
        document.getElementById('goal-weightage').value = goal.weightage;
        document.getElementById('goal-target').value = goal.target_value || '';
        document.getElementById('goal-kpi').value = goal.kpi || '';
        document.getElementById('goal-timeline').value = goal.timeline || '';
        document.getElementById('goal-status').value = goal.status || 'In Progress';

        goalModal.classList.add('active');
    };

    window.evaluateGoalClick = (goal) => {
        evaluateForm.reset();
        evaluateId.value = goal.id;

        document.getElementById('eval-goal-title').textContent = `${goal.title} (${goal.kpi || 'No KPI metric'}) - Target: ${goal.target_value || 0}`;
        document.getElementById('eval-self-assessment').textContent = goal.self_assessment || 'No employee self-assessment submitted yet.';
        
        document.getElementById('eval-actual-value').textContent = goal.actual_value || '0';
        document.getElementById('eval-percentage-value').textContent = (goal.percentage_achieved || '0') + '%';
        document.getElementById('eval-status').value = goal.status || 'In Progress';
        document.getElementById('eval-feedback').value = goal.manager_feedback || '';

        evaluateModal.classList.add('active');
    };

    window.deleteGoalClick = async (id) => {
        if (!confirm("Are you sure you want to delete this goal record?")) return;

        try {
            const response = await fetch(`/api/v1/admin/goals/${id}`, { method: 'DELETE' });
            const data = await response.json();
            if (response.ok && data.success) {
                loadGoals();
            } else {
                alert(data.message || 'Deletion failed');
            }
        } catch (error) {
            console.error("Error deleting goal request:", error);
        }
    };

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                const response = await fetch('/api/v1/auth/logout', { method: 'POST' });
                if (response.ok) {
                    window.location.href = '/login.html';
                }
            } catch (error) {
                console.error("Logout failed:", error);
            }
        });
    }

    // Initial load
    loadGoals();
});
