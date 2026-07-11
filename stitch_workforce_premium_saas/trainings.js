document.addEventListener('DOMContentLoaded', () => {
    // Modals
    const trainingModal = document.getElementById('training-modal');
    const btnAddTraining = document.getElementById('btn-add-training');
    const trainingClose = document.getElementById('training-close');
    const trainingCancel = document.getElementById('training-cancel');
    const trainingForm = document.getElementById('training-form');
    const trainingEditId = document.getElementById('training-edit-id');
    const trainingModalTitle = document.getElementById('training-modal-title');

    // Controls
    const trainEmployee = document.getElementById('train-employee');
    const trainingsList = document.getElementById('trainings-list');
    const logoutBtn = document.getElementById('logout-btn');

    // Cache
    let employeesCache = [];
    let trainingsCache = [];

    // Modal state open
    if (btnAddTraining) {
        btnAddTraining.addEventListener('click', () => {
            trainingForm.reset();
            trainingEditId.value = '';
            trainingModalTitle.textContent = 'Assign Training';
            trainingModal.classList.add('active');
        });
    }

    const closeModal = () => {
        trainingModal.classList.remove('active');
        trainingForm.reset();
        trainingEditId.value = '';
    };

    if (trainingClose) trainingClose.addEventListener('click', closeModal);
    if (trainingCancel) trainingCancel.addEventListener('click', closeModal);

    // Fetch lists
    const loadTrainings = async () => {
        try {
            const response = await fetch('/api/v1/admin/trainings');
            const data = await response.json();
            if (response.ok && data.success) {
                employeesCache = data.data.employees;
                trainingsCache = data.data.trainings;

                populateEmployeesDropdown();
                renderTrainings();
            }
        } catch (error) {
            console.error("Error loading trainings:", error);
        }
    };

    const populateEmployeesDropdown = () => {
        if (!trainEmployee) return;
        trainEmployee.innerHTML = '<option value="">Select Employee</option>';
        employeesCache.forEach(emp => {
            const opt = document.createElement('option');
            opt.value = emp.id;
            opt.textContent = emp.full_name;
            trainEmployee.appendChild(opt);
        });
    };

    const renderTrainings = () => {
        if (!trainingsList) return;
        trainingsList.innerHTML = '';

        if (trainingsCache.length === 0) {
            trainingsList.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted);">No training programs assigned</td></tr>`;
            return;
        }

        trainingsCache.forEach(t => {
            const completedDate = t.completed_at ? new Date(t.completed_at).toLocaleDateString() : '-';
            
            const statusClass = t.status === 'Completed' ? 'progress' : (t.status === 'In Progress' ? 'pending' : 'todo');
            const statusLabel = t.status || 'Pending';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight:700;color:var(--teal-900);">${t.title}</td>
                <td class="task-name">${t.full_name} <span style="font-size:12px;color:var(--text-muted);">(${t.employee_code})</span></td>
                <td style="font-size:13px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${t.description || ''}">${t.description || '-'}</td>
                <td style="font-weight:600;">${t.certification_name || '-'}</td>
                <td><span class="status-pill ${statusClass}">${statusLabel}</span></td>
                <td>${completedDate}</td>
                <td>
                    <div style="display:flex;gap:6px;">
                        <button class="action-pill edit" onclick="editTrainingClick(${JSON.stringify(t).replace(/"/g, '&quot;')})"><i class="fa-solid fa-pen"></i> Edit</button>
                        <button class="action-pill delete" onclick="deleteTrainingClick(${t.id})"><i class="fa-solid fa-trash"></i> Delete</button>
                    </div>
                </td>
            `;
            trainingsList.appendChild(tr);
        });
    };

    // Form submit
    trainingForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = trainingEditId.value;

        const payload = {
            title: document.getElementById('train-title').value.trim(),
            assignedTo: trainEmployee.value,
            description: document.getElementById('train-desc').value.trim(),
            certificationName: document.getElementById('train-cert').value.trim(),
            status: document.getElementById('train-status').value
        };

        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/v1/admin/trainings/${id}` : '/api/v1/admin/trainings';

        try {
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (response.ok && data.success) {
                closeModal();
                loadTrainings();
            } else {
                alert(data.message || 'Error saving training configuration');
            }
        } catch (error) {
            console.error("Error setting training course:", error);
        }
    });

    // Window action clicks
    window.editTrainingClick = (train) => {
        trainingForm.reset();
        trainingEditId.value = train.id;
        trainingModalTitle.textContent = 'Edit Training';

        document.getElementById('train-title').value = train.title;
        trainEmployee.value = train.assigned_to;
        document.getElementById('train-desc').value = train.description || '';
        document.getElementById('train-cert').value = train.certification_name || '';
        document.getElementById('train-status').value = train.status || 'Pending';

        trainingModal.classList.add('active');
    };

    window.deleteTrainingClick = async (id) => {
        if (!confirm("Are you sure you want to delete this training assignment?")) return;

        try {
            const response = await fetch(`/api/v1/admin/trainings/${id}`, { method: 'DELETE' });
            const data = await response.json();
            if (response.ok && data.success) {
                loadTrainings();
            } else {
                alert(data.message || 'Deletion failed');
            }
        } catch (error) {
            console.error("Error deleting training record:", error);
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
    loadTrainings();
});
