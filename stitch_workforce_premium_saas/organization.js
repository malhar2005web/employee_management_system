document.addEventListener('DOMContentLoaded', () => {
    // Tabs Toggles
    const btnDirectory = document.getElementById('btn-directory');
    const btnChat = document.getElementById('btn-chat');
    const directoryView = document.getElementById('directory-view');
    const chatView = document.getElementById('chat-view');
    const viewTitle = document.getElementById('view-title');

    // Filters & Tables
    const dirSearch = document.getElementById('dir-search');
    const dirDeptFilter = document.getElementById('dir-dept-filter');
    const directoryList = document.getElementById('directory-list');

    // Logout
    const logoutBtn = document.getElementById('logout-btn');

    if (btnDirectory && btnChat) {
        btnDirectory.addEventListener('click', () => {
            btnDirectory.classList.add('active');
            btnChat.classList.remove('active');
            directoryView.style.display = 'block';
            chatView.style.display = 'none';
            viewTitle.textContent = 'Employee Directory';
            stopMessagePolling();
        });

        btnChat.addEventListener('click', () => {
            btnChat.classList.add('active');
            btnDirectory.classList.remove('active');
            directoryView.style.display = 'none';
            chatView.style.display = 'block';
            viewTitle.textContent = 'Chat Room';
            loadChatContacts();

            // Mark chat notifications read & update badge
            fetch('/api/v1/employee/inbox/mark-read', { method: 'POST', credentials: 'include' })
                .then(() => { if (typeof window.checkChatUnreadBadge === 'function') window.checkChatUnreadBadge(); })
                .catch(() => {});
        });
    }

    const isAdmin = window.location.pathname.includes('admin-');

    if (isAdmin) {
        // Admin tab switches
        const tabEmployees = document.getElementById('tab-employees');
        const btnChart = document.getElementById('btn-chart');
        const tabDepts = document.getElementById('tab-depts');
        const tabDesigs = document.getElementById('tab-desigs');

        const viewEmployees = document.getElementById('view-employees');
        const chartView = document.getElementById('chart-view');
        const viewDepts = document.getElementById('view-depts');
        const viewDesigs = document.getElementById('view-desigs');

        const btnAddEmpModal = document.getElementById('btn-add-emp-modal');
        const viewTitle = document.getElementById('view-title');

        const switchTab = (tabName) => {
            tabEmployees.classList.remove('active');
            btnChart.classList.remove('active');
            tabDepts.classList.remove('active');
            tabDesigs.classList.remove('active');

            viewEmployees.style.display = 'none';
            chartView.style.display = 'none';
            viewDepts.style.display = 'none';
            viewDesigs.style.display = 'none';

            if (btnAddEmpModal) btnAddEmpModal.style.display = 'none';

            if (tabName === 'employees') {
                tabEmployees.classList.add('active');
                viewEmployees.style.display = 'block';
                viewTitle.textContent = 'Active Directory';
                if (btnAddEmpModal) btnAddEmpModal.style.display = 'inline-flex';
                loadAdminEmployees();
            } else if (tabName === 'chart') {
                btnChart.classList.add('active');
                chartView.style.display = 'block';
                viewTitle.textContent = 'Organization Chart';
                loadOrgChart();
            } else if (tabName === 'depts') {
                tabDepts.classList.add('active');
                viewDepts.style.display = 'block';
                viewTitle.textContent = 'Departments Board';
                loadMetadata();
            } else if (tabName === 'desigs') {
                tabDesigs.classList.add('active');
                viewDesigs.style.display = 'block';
                viewTitle.textContent = 'Designation Matrices';
                loadMetadata();
            }
        };

        if (tabEmployees) tabEmployees.addEventListener('click', () => switchTab('employees'));
        if (btnChart) btnChart.addEventListener('click', () => switchTab('chart'));
        if (tabDepts) tabDepts.addEventListener('click', () => switchTab('depts'));
        if (tabDesigs) tabDesigs.addEventListener('click', () => switchTab('desigs'));

        // Modals & form elements
        const empModal = document.getElementById('emp-modal');
        const empModalClose = document.getElementById('emp-modal-close');
        const empModalCancel = document.getElementById('emp-modal-cancel');
        const empForm = document.getElementById('emp-form');
        const empEditId = document.getElementById('emp-edit-id');
        const modalTitle = document.getElementById('modal-title');

        let docCv = null;
        let docOffer = null;
        let docAdhar = null;
        let docPan = null;

        function handleDocUpload(inputId, filenameId, linkId, onLoaded) {
            const inputEl = document.getElementById(inputId);
            if (!inputEl) return;
            inputEl.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = () => {
                        const docObj = {
                            fileName: file.name,
                            fileData: reader.result
                        };
                        document.getElementById(filenameId).textContent = file.name;
                        const link = document.getElementById(linkId);
                        link.href = reader.result;
                        link.style.display = 'inline-flex';
                        onLoaded(docObj);
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        handleDocUpload('emp-doc-cv', 'cv-filename', 'cv-download-link', (obj) => { docCv = obj; });
        handleDocUpload('emp-doc-offer', 'offer-filename', 'offer-download-link', (obj) => { docOffer = obj; });
        handleDocUpload('emp-doc-adhar', 'adhar-filename', 'adhar-download-link', (obj) => { docAdhar = obj; });
        handleDocUpload('emp-doc-pan', 'pan-filename', 'pan-download-link', (obj) => { docPan = obj; });

        function resetDocumentViews() {
            docCv = null;
            docOffer = null;
            docAdhar = null;
            docPan = null;
            document.getElementById('cv-filename').textContent = 'No file';
            document.getElementById('cv-download-link').style.display = 'none';
            document.getElementById('offer-filename').textContent = 'No file';
            document.getElementById('offer-download-link').style.display = 'none';
            document.getElementById('adhar-filename').textContent = 'No file';
            document.getElementById('adhar-download-link').style.display = 'none';
            document.getElementById('pan-filename').textContent = 'No file';
            document.getElementById('pan-download-link').style.display = 'none';
        }

        const employeesList = document.getElementById('employees-list');
        const deptsList = document.getElementById('depts-list');
        const desigsList = document.getElementById('desigs-list');

        const empDept = document.getElementById('emp-dept');
        const empDesig = document.getElementById('emp-desig');
        const empManager = document.getElementById('emp-manager');
        const desigDept = document.getElementById('desig-dept');

        const deptForm = document.getElementById('dept-form');
        const desigForm = document.getElementById('desig-form');

        if (btnAddEmpModal) {
            btnAddEmpModal.addEventListener('click', () => {
                empForm.reset();
                empEditId.value = '';
                resetDocumentViews();
                modalTitle.textContent = 'Add New Employee';
                if (typeof window.openModal === 'function') {
                    window.openModal(empModal);
                } else {
                    empModal.style.display = 'flex';
                    setTimeout(() => { empModal.style.opacity = '1'; }, 10);
                }
            });
        }

        const closeModal = () => {
            if (typeof window.closeModal === 'function') {
                window.closeModal(empModal);
            } else {
                empModal.style.opacity = '0';
                setTimeout(() => { empModal.style.display = 'none'; }, 250);
            }
            empForm.reset();
            empEditId.value = '';
            resetDocumentViews();
        };

        if (empModalClose) empModalClose.addEventListener('click', closeModal);
        if (empModalCancel) empModalCancel.addEventListener('click', closeModal);

        // Fetch employee data (Admin view with Actions)
        const loadAdminEmployees = async () => {
            const search = dirSearch ? dirSearch.value.trim() : '';
            const deptId = dirDeptFilter ? dirDeptFilter.value : '';
            try {
                const response = await fetch(`/api/v1/organization/directory?search=${encodeURIComponent(search)}&departmentId=${deptId}`);
                const resData = await response.json();
                if (response.ok && resData.success) {
                    renderAdminEmployees(resData.data.employees);
                    if (dirDeptFilter && dirDeptFilter.options.length === 1) {
                        populateDepartments(resData.data.departments);
                    }
                }
            } catch (error) {
                console.error("Error loading employees:", error);
            }
        };

        const renderAdminEmployees = (employees) => {
            if (!employeesList) return;
            employeesList.innerHTML = '';

            if (employees.length === 0) {
                employeesList.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:20px;color:var(--text-muted);">No employees registered yet.</td></tr>`;
                return;
            }

            // Populate manager dropdown inside employee form using active employees
            if (empManager) {
                empManager.innerHTML = '<option value="">None</option>';
                employees.forEach(e => {
                    const opt = document.createElement('option');
                    opt.value = e.id;
                    opt.textContent = e.full_name;
                    empManager.appendChild(opt);
                });
            }

            employees.forEach(emp => {
                const tr = document.createElement('tr');
                const avatarId = emp.id + 10;
                const statusClass = emp.status === 'Active' || emp.status === 'active' ? 'progress' : 'todo';
                const statusLabel = emp.status || 'Active';

                const whatsapp = emp.whatsapp_no || '';
                const anydesk = emp.anydesk_id || '';
                const waLink = whatsapp ? `<a href="https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}" target="_blank" style="color:var(--teal-600);font-weight:600;text-decoration:none;display:flex;align-items:center;gap:6px;"><i class="fa-brands fa-whatsapp" style="font-size:16px;color:#25D366;"></i>${whatsapp}</a>` : '<span style="color:var(--text-muted);">—</span>';
                const adDisplay = anydesk ? `<span style="font-weight:600;color:var(--text-dark);"><i class="fa-solid fa-desktop" style="margin-right:5px;color:var(--teal-600);"></i>${anydesk}</span>` : '<span style="color:var(--text-muted);">—</span>';

                tr.innerHTML = `
                    <td class="task-name" style="display:flex;align-items:center;gap:12px;">
                        <img src="https://i.pravatar.cc/80?img=${avatarId}" alt="" style="width:32px;height:32px;border-radius:50%;object-fit:cover;border:2px solid #fff;">
                        <span>${emp.full_name}</span>
                    </td>
                    <td style="font-weight:600;color:var(--teal-700);">${emp.employee_code || '-'}</td>
                    <td>${emp.email || '-'}</td>
                    <td>${emp.department_name || '-'}</td>
                    <td>${emp.designation_name || '-'}</td>
                    <td>${emp.manager_name || 'None'}</td>
                    <td><span class="status-pill ${statusClass}">${statusLabel}</span></td>
                    <td>${waLink}</td>
                    <td>${adDisplay}</td>
                    <td>
                        <div style="display:flex;gap:8px;">
                            <button class="action-pill edit" onclick="editEmployee(${JSON.stringify(emp).replace(/"/g, '&quot;')})"><i class="fa-solid fa-pen"></i> Edit</button>
                            <button type="button" class="action-pill delete btn-offboard-emp" data-id="${emp.id}" data-name="${(emp.full_name || '').replace(/"/g, '&quot;')}" style="background:rgba(239,68,68,0.15); color:#ef4444; border:1px solid rgba(239,68,68,0.3); font-weight:700; border-radius:12px; padding:4px 10px; cursor:pointer;"><i class="fa-solid fa-user-xmark"></i> Offboard</button>
                        </div>
                    </td>
                `;

                tr.querySelector('.btn-offboard-emp').addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const id = e.currentTarget.dataset.id;
                    const name = e.currentTarget.dataset.name;
                    if (typeof window.openDeletionWizard === 'function') {
                        window.openDeletionWizard('employee', id, name);
                    }
                });

                employeesList.appendChild(tr);
            });
        };

        // Org Chart loading & rendering
        const loadOrgChart = async () => {
            const orgChartTree = document.getElementById('org-chart-tree');
            if (!orgChartTree) return;
            orgChartTree.innerHTML = '<div style="color:var(--text-muted);padding:10px;">Loading tree hierarchy...</div>';

            try {
                const response = await fetch('/api/v1/organization/directory');
                const resData = await response.json();
                if (response.ok && resData.success) {
                    const employees = resData.data.employees;
                    renderOrgChartTree(employees);
                } else {
                    orgChartTree.innerHTML = '<div style="color:var(--red);padding:10px;">Failed to load structure</div>';
                }
            } catch (error) {
                console.error("Error loading org chart:", error);
                orgChartTree.innerHTML = '<div style="color:var(--red);padding:10px;">Error loading structure</div>';
            }
        };

        const renderOrgChartTree = (employees) => {
            const orgChartTree = document.getElementById('org-chart-tree');
            if (!orgChartTree) return;
            orgChartTree.innerHTML = '';

            const map = {};
            const roots = [];

            employees.forEach(emp => {
                map[emp.id] = {
                    ...emp,
                    children: []
                };
            });

            employees.forEach(emp => {
                const node = map[emp.id];
                const managerId = emp.reporting_manager_id || emp.manager_id;
                if (managerId && map[managerId]) {
                    map[managerId].children.push(node);
                } else {
                    roots.push(node);
                }
            });

            if (roots.length === 0 && employees.length > 0) {
                roots.push(map[employees[0].id]);
            }

            const buildHTML = (node) => {
                const avatarId = node.id + 10;
                const childHTMLs = node.children.map(buildHTML).join('');
                
                let childrenContainer = '';
                if (node.children.length > 0) {
                    childrenContainer = `<div class="org-tree">${childHTMLs}</div>`;
                }

                return `
                    <div class="org-tree-item">
                        <div class="org-node">
                            <img class="org-node-avatar" src="https://i.pravatar.cc/80?img=${avatarId}" alt="${node.full_name}">
                            <div class="org-node-info">
                                <div class="name">${node.full_name}</div>
                                <div class="role">${node.designation_name || 'Staff'}</div>
                                <div class="dept">${node.department_name || 'General'}</div>
                            </div>
                        </div>
                        ${childrenContainer}
                    </div>
                `;
            };

            const html = roots.map(buildHTML).join('');
            orgChartTree.innerHTML = html;
        };

        // Load departments & designations metadata
        const loadMetadata = async () => {
            try {
                const response = await fetch('/api/v1/admin/employees/metadata');
                const data = await response.json();
                if (response.ok && data.success) {
                    renderMetadata(data.data);
                }
            } catch (error) {
                console.error("Error loading metadata:", error);
            }
        };

        const renderMetadata = (meta) => {
            if (empDept) {
                empDept.innerHTML = '<option value="">Select Department</option>';
                meta.departments.forEach(d => {
                    const opt = document.createElement('option');
                    opt.value = d.id;
                    opt.textContent = d.name;
                    empDept.appendChild(opt);
                });
            }
            if (desigDept) {
                desigDept.innerHTML = '<option value="">Select Department</option>';
                meta.departments.forEach(d => {
                    const opt = document.createElement('option');
                    opt.value = d.id;
                    opt.textContent = d.name;
                    desigDept.appendChild(opt);
                });
            }
            if (empDesig) {
                empDesig.innerHTML = '<option value="">Select Designation</option>';
                meta.designations.forEach(d => {
                    const opt = document.createElement('option');
                    opt.value = d.id;
                    opt.textContent = d.title;
                    empDesig.appendChild(opt);
                });
            }

            // Render departments table
            if (deptsList) {
                deptsList.innerHTML = '';
                meta.departments.forEach(d => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td class="task-name">${d.name}</td>
                        <td style="font-weight:700;color:var(--teal-600);">${d.code}</td>
                    `;
                    deptsList.appendChild(tr);
                });
            }

            // Render designations table
            if (desigsList) {
                desigsList.innerHTML = '';
                meta.designations.forEach(d => {
                    const tr = document.createElement('tr');
                    const dept = meta.departments.find(deptObj => deptObj.id === d.department_id);
                    tr.innerHTML = `
                        <td class="task-name">${d.title}</td>
                        <td>${dept ? dept.name : 'Unknown'}</td>
                    `;
                    desigsList.appendChild(tr);
                });
            }
        };

        const populateDepartments = (departments) => {
            if (!dirDeptFilter) return;
            departments.forEach(dept => {
                const opt = document.createElement('option');
                opt.value = dept.id;
                opt.textContent = dept.name;
                dirDeptFilter.appendChild(opt);
            });
        };

        // Form submits
        if (empForm) {
            empForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const id = empEditId.value;
                const payload = {
                    fullName: document.getElementById('emp-fullname').value.trim(),
                    email: document.getElementById('emp-email').value.trim(),
                    employeeCode: document.getElementById('emp-code').value.trim(),
                    salaryGrade: document.getElementById('emp-grade').value.trim(),
                    departmentId: empDept.value || null,
                    designationId: empDesig.value || null,
                    reportingManagerId: empManager.value || null,
                    joiningDate: document.getElementById('emp-join-date').value || null,
                    phone: document.getElementById('emp-phone').value.trim(),
                    dob: document.getElementById('emp-dob').value || null,
                    citizenship: document.getElementById('emp-citizenship').value.trim(),
                    address: document.getElementById('emp-address').value.trim(),
                    permAddress: document.getElementById('emp-perm-address').value.trim(),
                    anydeskId: document.getElementById('emp-anydesk-id').value.trim(),
                    whatsappNo: document.getElementById('emp-whatsapp-no').value.trim(),
                    bankName: document.getElementById('emp-bank-name').value.trim(),
                    bankAccNo: document.getElementById('emp-bank-acc-no').value.trim(),
                    bankIfsc: document.getElementById('emp-bank-ifsc').value.trim(),
                    docCv,
                    docOfferLetter: docOffer,
                    docAdharCard: docAdhar,
                    docPanCard: docPan
                };

                const method = id ? 'PUT' : 'POST';
                const url = id ? `/api/v1/admin/employees/${id}` : '/api/v1/admin/employees';

                try {
                    const response = await fetch(url, {
                        method,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const data = await response.json();
                    if (response.ok && data.success) {
                        closeModal();
                        loadAdminEmployees();
                    } else {
                        alert(data.message || 'Error occurred');
                    }
                } catch (error) {
                    console.error("Error saving employee:", error);
                }
            });
        }

        if (deptForm) {
            deptForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const payload = {
                    name: document.getElementById('dept-name').value.trim(),
                    code: document.getElementById('dept-code').value.trim().toUpperCase(),
                    description: document.getElementById('dept-desc').value.trim()
                };

                try {
                    const response = await fetch('/api/v1/admin/employees/departments', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const data = await response.json();
                    if (response.ok && data.success) {
                        deptForm.reset();
                        loadMetadata();
                    } else {
                        alert(data.message || 'Error occurred');
                    }
                } catch (error) {
                    console.error("Error creating department:", error);
                }
            });
        }

        if (desigForm) {
            desigForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const payload = {
                    title: document.getElementById('desig-title').value.trim(),
                    departmentId: desigDept.value,
                    level: document.getElementById('desig-level').value || null
                };

                try {
                    const response = await fetch('/api/v1/admin/employees/designations', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const data = await response.json();
                    if (response.ok && data.success) {
                        desigForm.reset();
                        loadMetadata();
                    } else {
                        alert(data.message || 'Error occurred');
                    }
                } catch (error) {
                    console.error("Error creating designation:", error);
                }
            });
        }

        window.editEmployee = (emp) => {
            empForm.reset();
            empEditId.value = emp.id;
            modalTitle.textContent = 'Edit Employee';
            
            document.getElementById('emp-fullname').value = emp.full_name;
            document.getElementById('emp-email').value = emp.email;
            document.getElementById('emp-code').value = emp.employee_code;
            document.getElementById('emp-grade').value = emp.salary_grade || '';
            
            empDept.value = emp.department_id || '';
            empDesig.value = emp.designation_id || '';
            empManager.value = emp.reporting_manager_id || emp.manager_id || '';

            document.getElementById('emp-phone').value = emp.phone || '';
            document.getElementById('emp-whatsapp-no').value = emp.whatsapp_no || '';
            document.getElementById('emp-anydesk-id').value = emp.anydesk_id || '';
            document.getElementById('emp-dob').value = emp.dob ? new Date(emp.dob).toISOString().split('T')[0] : '';
            document.getElementById('emp-citizenship').value = emp.citizenship || '';
            document.getElementById('emp-address').value = emp.address || '';
            document.getElementById('emp-perm-address').value = emp.perm_address || '';
            document.getElementById('emp-bank-name').value = emp.bank_name || '';
            document.getElementById('emp-bank-acc-no').value = emp.bank_acc_no || '';
            document.getElementById('emp-bank-ifsc').value = emp.bank_ifsc || '';

            // Handle documents
            if (emp.doc_cv && emp.doc_cv.fileName) {
                docCv = emp.doc_cv;
                document.getElementById('cv-filename').textContent = emp.doc_cv.fileName;
                const link = document.getElementById('cv-download-link');
                link.href = emp.doc_cv.fileData;
                link.style.display = 'inline-flex';
            } else {
                docCv = null;
                document.getElementById('cv-filename').textContent = 'No file';
                document.getElementById('cv-download-link').style.display = 'none';
            }

            if (emp.doc_offer_letter && emp.doc_offer_letter.fileName) {
                docOffer = emp.doc_offer_letter;
                document.getElementById('offer-filename').textContent = emp.doc_offer_letter.fileName;
                const link = document.getElementById('offer-download-link');
                link.href = emp.doc_offer_letter.fileData;
                link.style.display = 'inline-flex';
            } else {
                docOffer = null;
                document.getElementById('offer-filename').textContent = 'No file';
                document.getElementById('offer-download-link').style.display = 'none';
            }

            if (emp.doc_adhar_card && emp.doc_adhar_card.fileName) {
                docAdhar = emp.doc_adhar_card;
                document.getElementById('adhar-filename').textContent = emp.doc_adhar_card.fileName;
                const link = document.getElementById('adhar-download-link');
                link.href = emp.doc_adhar_card.fileData;
                link.style.display = 'inline-flex';
            } else {
                docAdhar = null;
                document.getElementById('adhar-filename').textContent = 'No file';
                document.getElementById('adhar-download-link').style.display = 'none';
            }

            if (emp.doc_pan_card && emp.doc_pan_card.fileName) {
                docPan = emp.doc_pan_card;
                document.getElementById('pan-filename').textContent = emp.doc_pan_card.fileName;
                const link = document.getElementById('pan-download-link');
                link.href = emp.doc_pan_card.fileData;
                link.style.display = 'inline-flex';
            } else {
                docPan = null;
                document.getElementById('pan-filename').textContent = 'No file';
                document.getElementById('pan-download-link').style.display = 'none';
            }

            if (emp.joining_date) {
                const d = new Date(emp.joining_date);
                const dateStr = d.toISOString().split('T')[0];
                document.getElementById('emp-join-date').value = dateStr;
            }

            empModal.style.display = 'flex';
            setTimeout(() => { empModal.style.opacity = '1'; }, 10);
        };

        window.toggleStatus = async (id, activate) => {
            try {
                const response = await fetch(`/api/v1/admin/employees/${id}/status`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ is_active: activate })
                });
                const data = await response.json();
                if (response.ok && data.success) {
                    loadAdminEmployees();
                } else {
                    alert(data.message);
                }
            } catch (error) {
                console.error("Error toggling status:", error);
            }
        };

        // Hook up search filter listener
        if (dirSearch) {
            dirSearch.addEventListener('input', debounce(loadAdminEmployees, 300));
        }
        if (dirDeptFilter) {
            dirDeptFilter.addEventListener('change', loadAdminEmployees);
        }

        // Initial load for admin
        loadAdminEmployees();
        loadMetadata();
    } else {
        // Employee-side initialization
        const loadDirectory = async () => {
            const search = dirSearch ? dirSearch.value.trim() : '';
            const deptId = dirDeptFilter ? dirDeptFilter.value : '';
            
            try {
                const response = await fetch(`/api/v1/organization/directory?search=${encodeURIComponent(search)}&departmentId=${deptId}`);
                const resData = await response.json();
                
                if (response.ok && resData.success) {
                    renderDirectoryTable(resData.data.employees);
                    if (dirDeptFilter && dirDeptFilter.options.length === 1) {
                        populateDepartments(resData.data.departments);
                    }
                } else {
                    console.error("Failed to load directory:", resData.message);
                }
            } catch (error) {
                console.error("Error loading directory:", error);
            }
        };

        const renderDirectoryTable = (employees) => {
            if (!directoryList) return;
            directoryList.innerHTML = '';

            if (employees.length === 0) {
                directoryList.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:24px;">No employees found</td></tr>`;
                return;
            }

            employees.forEach(emp => {
                const avatarId = emp.id + 10;
                const statusClass = emp.status === 'Active' || emp.status === 'active' ? 'progress' : 'todo';
                const statusLabel = emp.status || 'Active';
                
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="task-name" style="display:flex;align-items:center;gap:12px;">
                        <img src="https://i.pravatar.cc/80?img=${avatarId}" alt="" style="width:32px;height:32px;border-radius:50%;object-fit:cover;border:2px solid #fff;">
                        <span>${emp.full_name}</span>
                    </td>
                    <td style="font-weight:600;color:var(--teal-900);">${emp.employee_code || '-'}</td>
                    <td>${emp.email || '-'}</td>
                    <td>${emp.department_name || '-'}</td>
                    <td style="font-weight:600;color:var(--text-dark);">${emp.designation_name || '-'}</td>
                    <td>${emp.manager_name || 'None'}</td>
                    <td><span class="status-pill ${statusClass}">${statusLabel}</span></td>
                `;
                directoryList.appendChild(tr);
            });
        };

        const populateDepartments = (departments) => {
            if (!dirDeptFilter) return;
            departments.forEach(dept => {
                const opt = document.createElement('option');
                opt.value = dept.id;
                opt.textContent = dept.name;
                dirDeptFilter.appendChild(opt);
            });
        };

        // Filter listeners
        if (dirSearch) {
            dirSearch.addEventListener('input', debounce(loadDirectory, 300));
        }
        if (dirDeptFilter) {
            dirDeptFilter.addEventListener('change', loadDirectory);
        }

        loadDirectory();
    } 

    // Chat State variables
    let chatContacts = [];
    let selectedContact = null;
    let chatInterval = null;
    let currentUserId = null; // We will retrieve this from /api/v1/auth/me

    // Retrieve current user ID on load
    async function fetchCurrentUser() {
        try {
            const res = await fetch('/api/v1/auth/me');
            const data = await res.json();
            if (data.success && data.data) {
                // If it returns user profile, we find user's employee ID
                // Let's store current user info
                currentUserId = data.data.employee_id || data.data.id;
            }
        } catch (e) {
            console.error("Error fetching current user for chat:", e);
        }
    }
    fetchCurrentUser();

    let chatChannels = { directMessages: [], taskGroups: [], departmentChannels: [] };
    let selectedChannel = null;

    const loadChatContacts = async () => {
        try {
            const res = await fetch('/api/v1/chat/channels');
            const data = await res.json();
            if (res.ok && data.success) {
                chatChannels = data.data;
                renderChatChannels();
            }
        } catch (e) {
            console.error("Error loading chat channels:", e);
        }
    };

    const renderChatChannels = () => {
        const list = document.getElementById('chat-contacts-list');
        if (!list) return;
        list.innerHTML = '';

        // 💬 Section 1: Direct Messages
        const dmHeader = document.createElement('div');
        dmHeader.style.cssText = 'font-size:11px; font-weight:800; color:var(--teal-900); text-transform:uppercase; margin:10px 0 6px 4px;';
        dmHeader.innerHTML = '<i class="fa-solid fa-user"></i> Direct Messages';
        list.appendChild(dmHeader);

        chatChannels.directMessages.forEach(c => {
            const item = document.createElement('div');
            const isSelected = selectedChannel && selectedChannel.id === c.employee_id && selectedChannel.type === 'DM';
            const isBusy = c.presence_status === 'Busy';
            const statusDotColor = isBusy ? '#ef4444' : '#22c55e';
            const hasUnread = c.unread_count > 0;

            item.style.cssText = `
                display:flex; align-items:center; gap:10px; padding:10px; border-radius:12px; cursor:pointer;
                background:${isSelected ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.1)'};
                margin-bottom:6px; border:1px solid rgba(0,0,0,0.04); transition: background 0.2s;
            `;
            item.innerHTML = `
                <div style="position:relative;">
                    <img src="https://i.pravatar.cc/80?img=${c.employee_id + 10}" style="width:34px; height:34px; border-radius:50%; object-fit:cover;" />
                    <span style="position:absolute; bottom:0; right:0; width:9px; height:9px; border-radius:50%; background:${statusDotColor}; border:1.5px solid #fff;"></span>
                </div>
                <div style="flex:1; min-width:0;">
                    <div style="font-weight:700; font-size:13px; color:var(--teal-900); text-overflow:ellipsis; overflow:hidden; white-space:nowrap; display:flex; align-items:center; justify-content:space-between;">
                        <span>${c.full_name}</span>
                        ${hasUnread ? `<span style="width:8px; height:8px; border-radius:50%; background:#ef4444; display:inline-block; box-shadow:0 0 6px rgba(239,68,68,0.8);"></span>` : ''}
                    </div>
                    <div style="font-size:11px; color:var(--text-muted); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${c.designation || c.department_name || 'Staff'}</div>
                </div>
                <span class="status-pill" style="font-size:9.5px; font-weight:800; padding:2px 6px; background:${statusDotColor}22; color:${statusDotColor};">
                    ${isBusy ? '🔴 Busy' : '🟢 Online'}
                </span>
            `;
            item.addEventListener('click', () => selectChannelItem('DM', c.employee_id, c.full_name, c.designation || c.department_name));
            list.appendChild(item);
        });

        // 👥 Section 2: Task Groups
        if (chatChannels.taskGroups.length > 0) {
            const tgHeader = document.createElement('div');
            tgHeader.style.cssText = 'font-size:11px; font-weight:800; color:var(--teal-900); text-transform:uppercase; margin:16px 0 6px 4px;';
            tgHeader.innerHTML = '<i class="fa-solid fa-users"></i> Task Groups';
            list.appendChild(tgHeader);

            chatChannels.taskGroups.forEach(g => {
                const item = document.createElement('div');
                const isSelected = selectedChannel && selectedChannel.id === g.id && selectedChannel.type === 'TaskGroup';
                const hasUnread = g.unread_count > 0;

                item.style.cssText = `
                    padding:10px; border-radius:12px; cursor:pointer; background:${isSelected ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.1)'};
                    margin-bottom:6px; border:1px solid rgba(0,0,0,0.04);
                `;
                item.innerHTML = `
                    <div style="font-weight:700; font-size:13px; color:var(--teal-900); display:flex; justify-content:space-between; align-items:center;">
                        <span><i class="fa-solid fa-list-check" style="color:var(--teal-600);"></i> ${g.name}</span>
                        ${hasUnread ? `<span style="width:8px; height:8px; border-radius:50%; background:#ef4444; display:inline-block; box-shadow:0 0 6px rgba(239,68,68,0.8);"></span>` : ''}
                    </div>
                    <div style="font-size:11px; color:var(--text-muted);">${g.task_title || 'Task Group'}</div>
                `;
                item.addEventListener('click', () => selectChannelItem('TaskGroup', g.id, g.name, g.task_title || 'Task Group'));
                list.appendChild(item);
            });
        }

        // 🏢 Section 3: Department Channels
        if (chatChannels.departmentChannels.length > 0) {
            const deptHeader = document.createElement('div');
            deptHeader.style.cssText = 'font-size:11px; font-weight:800; color:var(--teal-900); text-transform:uppercase; margin:16px 0 6px 4px;';
            deptHeader.innerHTML = '<i class="fa-solid fa-building"></i> Department Channels';
            list.appendChild(deptHeader);

            chatChannels.departmentChannels.forEach(d => {
                const item = document.createElement('div');
                const isSelected = selectedChannel && selectedChannel.id === d.id && selectedChannel.type === 'Department';
                const hasUnread = d.unread_count > 0;

                item.style.cssText = `
                    padding:10px; border-radius:12px; cursor:pointer; background:${isSelected ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.1)'};
                    margin-bottom:6px; border:1px solid rgba(0,0,0,0.04);
                `;
                item.innerHTML = `
                    <div style="font-weight:700; font-size:13px; color:var(--teal-900); display:flex; justify-content:space-between; align-items:center;">
                        <span><i class="fa-solid fa-hashtag" style="color:var(--teal-600);"></i> ${d.name}</span>
                        ${hasUnread ? `<span style="width:8px; height:8px; border-radius:50%; background:#ef4444; display:inline-block; box-shadow:0 0 6px rgba(239,68,68,0.8);"></span>` : ''}
                    </div>
                    <div style="font-size:11px; color:var(--text-muted);">${d.department_name} Channel</div>
                `;
                item.addEventListener('click', () => selectChannelItem('Department', d.id, d.name, `${d.department_name} Channel`));
                list.appendChild(item);
            });
        }
    };

    const selectChannelItem = async (type, id, title, subtitle) => {
        selectedChannel = { type, id, title, subtitle };

        document.getElementById('chat-thread-empty').style.display = 'none';
        document.getElementById('chat-thread-active').style.display = 'flex';

        document.getElementById('chat-header-name').textContent = title;
        document.getElementById('chat-header-status').textContent = subtitle;

        loadMessages();
        startMessagePolling();

        // Mark channel notifications read
        try {
            const readUrl = type === 'DM' ? `/api/v1/chat/channels/0/read?contactId=${id}` : `/api/v1/chat/channels/${id}/read`;
            await fetch(readUrl, { method: 'POST' });
            if (typeof window.checkChatUnreadBadge === 'function') window.checkChatUnreadBadge();
            // Refresh channel list to update unread badge dots
            const res = await fetch('/api/v1/chat/channels');
            const data = await res.json();
            if (res.ok && data.success) {
                chatChannels = data.data;
                renderChatChannels();
            }
        } catch (e) {
            console.error("Error marking channel read:", e);
        }
    };

    const loadMessages = async () => {
        if (!selectedChannel) return;
        try {
            const url = selectedChannel.type === 'DM' 
                ? `/api/v1/employee/chat/messages?contact_id=${selectedChannel.id}`
                : `/api/v1/chat/messages/${selectedChannel.id}`;
            const res = await fetch(url);
            const data = await res.json();
            if (res.ok && data.success) {
                renderMessages(data.data);
            }
        } catch (e) {
            console.error("Error loading chat messages:", e);
        }
    };

    // ── File Attachment Helpers ──
    const getFileIcon = (type, name) => {
        if (!type && !name) return 'fa-solid fa-file';
        const ext = (name || '').split('.').pop().toLowerCase();
        if (/^image\//.test(type) || ['jpg','jpeg','png','gif','webp','svg'].includes(ext)) return 'fa-solid fa-image';
        if (type === 'application/pdf' || ext === 'pdf') return 'fa-solid fa-file-pdf';
        if (/zip|rar|7z|tar|gz/.test(ext)) return 'fa-solid fa-file-zipper';
        if (/doc|docx/.test(ext)) return 'fa-solid fa-file-word';
        if (/xls|xlsx/.test(ext)) return 'fa-solid fa-file-excel';
        if (/ppt|pptx/.test(ext)) return 'fa-solid fa-file-powerpoint';
        if (ext === 'txt') return 'fa-solid fa-file-lines';
        return 'fa-solid fa-file';
    };

    const formatFileSize = (bytes) => {
        if (!bytes) return '';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    };

    const isImageFile = (type, name) => {
        if (/^image\//.test(type)) return true;
        const ext = (name || '').split('.').pop().toLowerCase();
        return ['jpg','jpeg','png','gif','webp','svg'].includes(ext);
    };

    const buildAttachmentHTML = (fileUrl, fileName, fileType, fileSize, isMe) => {
        if (!fileUrl) return '';
        const linkColor = isMe ? '#a9d94c' : 'var(--teal-700)';
        if (isImageFile(fileType, fileName)) {
            return `<div style="margin-top:6px;"><a href="${fileUrl}" target="_blank"><img src="${fileUrl}" alt="${fileName}" style="max-width:220px; max-height:180px; border-radius:10px; border:1px solid rgba(255,255,255,0.2); cursor:pointer;" /></a><div style="font-size:10px; margin-top:3px; opacity:0.8;">📎 ${fileName} ${fileSize ? '(' + formatFileSize(fileSize) + ')' : ''}</div></div>`;
        }
        const icon = getFileIcon(fileType, fileName);
        return `<div style="margin-top:8px; padding:10px 12px; border-radius:10px; background:${isMe ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.04)'}; display:flex; align-items:center; gap:10px;">
            <i class="${icon}" style="font-size:22px; color:${linkColor};"></i>
            <div style="flex:1; min-width:0;">
                <a href="${fileUrl}" download="${fileName}" target="_blank" style="color:${linkColor}; font-weight:700; font-size:12.5px; text-decoration:underline; display:block; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${fileName}</a>
                <span style="font-size:10px; opacity:0.7;">${formatFileSize(fileSize)}</span>
            </div>
            <a href="${fileUrl}" download="${fileName}" style="color:${linkColor}; font-size:14px;" title="Download"><i class="fa-solid fa-download"></i></a>
        </div>`;
    };

    // ── File Input State ──
    let pendingFile = null;
    const fileInput = document.getElementById('chat-file-input');
    const attachBtn = document.getElementById('btn-chat-attach');
    const filePreview = document.getElementById('chat-file-preview');
    const filePreviewName = document.getElementById('chat-file-preview-name');
    const filePreviewSize = document.getElementById('chat-file-preview-size');
    const filePreviewIcon = document.getElementById('chat-file-preview-icon');
    const fileCancelBtn = document.getElementById('chat-file-cancel');

    if (attachBtn && fileInput) {
        attachBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                pendingFile = fileInput.files[0];
                if (filePreview) {
                    filePreviewName.textContent = pendingFile.name;
                    filePreviewSize.textContent = formatFileSize(pendingFile.size);
                    filePreviewIcon.className = getFileIcon(pendingFile.type, pendingFile.name);
                    filePreview.style.display = 'flex';
                }
            }
        });
    }
    if (fileCancelBtn) {
        fileCancelBtn.addEventListener('click', () => {
            pendingFile = null;
            if (fileInput) fileInput.value = '';
            if (filePreview) filePreview.style.display = 'none';
        });
    }

    const renderMessages = (messagesList) => {
        const container = document.getElementById('chat-messages-container');
        if (!container) return;

        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 80;

        container.innerHTML = '';
        if (messagesList.length === 0) {
            container.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:24px;font-size:12.5px;">No messages yet. Start the conversation!</div>';
            return;
        }

        messagesList.forEach(m => {
            const isMe = currentUserId && (m.sender_id === currentUserId);
            const senderName = m.sender_name || 'Staff';
            const time = new Date(m.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
            
            const outerDiv = document.createElement('div');
            outerDiv.style.cssText = `
                display:flex; flex-direction:column; align-items: ${isMe ? 'flex-end' : 'flex-start'}; width:100%; margin-bottom:10px;
            `;

            const bubble = document.createElement('div');
            bubble.style.cssText = `
                max-width:75%; padding:10px 14px; border-radius:16px; font-size:13px; line-height:1.4;
                background:${isMe ? 'linear-gradient(135deg, var(--teal-600), var(--teal-900))' : 'rgba(255,255,255,0.9)'};
                color:${isMe ? '#ffffff' : 'var(--text-dark)'};
                border:1px solid ${isMe ? 'transparent' : 'rgba(0,0,0,0.06)'};
                box-shadow:0 2px 6px rgba(0,0,0,0.06);
                border-bottom-right-radius:${isMe ? '4px' : '16px'};
                border-bottom-left-radius:${isMe ? '16px' : '4px'};
                word-break: break-word;
            `;
            let text = m.message_text || m.message || '';
            const senderHeader = `<strong style="font-size:11px; color:${isMe ? '#a9d94c' : 'var(--teal-900)'}; display:block; margin-bottom:2px;">${isMe ? 'You' : senderName}</strong>`;

            // Detect file attachment (DM: file_url, Channel: attachments array)
            let fileUrl = m.file_url || null;
            let fileName = m.file_name || null;
            let fileType = m.file_type || null;
            let fileSize = m.file_size || null;

            // Channel messages use attachments JSONB array
            if (!fileUrl && m.attachments) {
                const atts = typeof m.attachments === 'string' ? JSON.parse(m.attachments) : m.attachments;
                if (Array.isArray(atts) && atts.length > 0) {
                    fileUrl = atts[0].url;
                    fileName = atts[0].name;
                    fileType = atts[0].type;
                    fileSize = atts[0].size;
                }
            }

            // Text content (hide auto-generated 📎 text if we have actual file to show)
            let displayText = text;
            if (fileUrl && text.startsWith('📎')) displayText = '';

            let bubbleContent = senderHeader;
            if (displayText) {
                if (displayText.includes('https://meet.google.com/')) {
                    displayText = displayText.replace(/(https:\/\/meet\.google\.com\/[a-z0-9-]+)/g, `<a href="$1" target="_blank" style="color:${isMe ? '#a9d94c' : 'var(--teal-700)'};text-decoration:underline;font-weight:700;">$1</a>`);
                }
                bubbleContent += `<span>${displayText}</span>`;
            }
            if (fileUrl) {
                bubbleContent += buildAttachmentHTML(fileUrl, fileName, fileType, fileSize, isMe);
            }
            bubble.innerHTML = bubbleContent;

            const infoDiv = document.createElement('div');
            infoDiv.style.cssText = `
                font-size:10px; color:var(--text-muted); margin-top:3px; margin-left:4px; margin-right:4px;
            `;
            infoDiv.textContent = time;

            outerDiv.appendChild(bubble);
            outerDiv.appendChild(infoDiv);
            container.appendChild(outerDiv);
        });

        if (isNearBottom || container.scrollTop === 0) {
            container.scrollTop = container.scrollHeight;
        }
    };

    const sendChatMessage = async () => {
        const input = document.getElementById('chat-message-input');
        if (!input || !selectedChannel) return;
        const msg = input.value.trim();
        if (!msg && !pendingFile) return;

        try {
            const formData = new FormData();
            if (pendingFile) formData.append('file', pendingFile);

            if (selectedChannel.type === 'DM') {
                formData.append('recipient_id', selectedChannel.id);
                if (msg) formData.append('message', msg);
                await fetch('/api/v1/employee/chat/send', {
                    method: 'POST',
                    body: formData
                });
            } else {
                formData.append('channelId', selectedChannel.id);
                if (msg) formData.append('messageText', msg);
                await fetch('/api/v1/chat/messages', {
                    method: 'POST',
                    body: formData
                });
            }
            input.value = '';
            pendingFile = null;
            if (fileInput) fileInput.value = '';
            if (filePreview) filePreview.style.display = 'none';
            loadMessages();
        } catch (e) {
            console.error("Error sending message:", e);
        }
    };

    const startMessagePolling = () => {
        stopMessagePolling();
        chatInterval = setInterval(loadMessages, 3000);
    };

    const stopMessagePolling = () => {
        if (chatInterval) {
            clearInterval(chatInterval);
            chatInterval = null;
        }
    };

    // Attach sending triggers
    const sendBtn = document.getElementById('btn-chat-send');
    const msgInput = document.getElementById('chat-message-input');
    if (sendBtn) sendBtn.addEventListener('click', sendChatMessage);
    if (msgInput) {
        msgInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') sendChatMessage();
        });

        // `@mention` Auto-Complete suggestion popup
        msgInput.addEventListener('keyup', (e) => {
            const val = msgInput.value;
            const lastAtPos = val.lastIndexOf('@');
            if (lastAtPos !== -1 && lastAtPos === val.length - 1) {
                let popup = document.getElementById('mention-suggestion-popup-org');
                if (!popup) {
                    popup = document.createElement('div');
                    popup.id = 'mention-suggestion-popup-org';
                    popup.style.cssText = 'position:absolute; bottom:60px; left:20px; background:rgba(255,255,255,0.95); backdrop-filter:blur(10px); border-radius:14px; padding:10px; box-shadow:0 10px 30px rgba(0,0,0,0.2); border:1px solid rgba(0,0,0,0.1); z-index:99999;';
                    msgInput.parentElement.appendChild(popup);
                }

                popup.innerHTML = `
                    <div style="font-size:10px; font-weight:800; color:var(--teal-900); margin-bottom:6px;">MENTION TEAM MEMBER</div>
                    ${(chatChannels.directMessages || []).slice(0, 4).map(e => `
                        <div onclick="window.insertMentionOrg('${e.full_name}')" style="padding:6px 10px; border-radius:8px; cursor:pointer; font-size:12px; font-weight:700; color:var(--text-dark);">
                            @${e.full_name}
                        </div>
                    `).join('')}
                `;
            }
        });
    }

    window.insertMentionOrg = (name) => {
        if (!msgInput) return;
        const val = msgInput.value;
        const lastAtPos = val.lastIndexOf('@');
        msgInput.value = val.substring(0, lastAtPos) + `@${name} `;
        const popup = document.getElementById('mention-suggestion-popup-org');
        if (popup) popup.remove();
        msgInput.focus();
    };

    // Contact Search Listener
    const contactSearchInput = document.getElementById('chat-contact-search');
    if (contactSearchInput) {
        contactSearchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const filtered = chatContacts.filter(c => 
                c.full_name.toLowerCase().includes(query) || 
                (c.designation_name && c.designation_name.toLowerCase().includes(query))
            );
            renderChatContacts(filtered);
        });
    }

    // Call Feature Handlers
    let callTimerInterval = null;
    const btnCall = document.getElementById('btn-chat-call');
    const btnMeet = document.getElementById('btn-chat-meet');
    const callModal = document.getElementById('call-modal');
    
    if (btnCall) {
        btnCall.addEventListener('click', () => {
            if (!selectedContact) return;
            // Open modal
            callModal.style.display = 'flex';
            setTimeout(() => { callModal.style.opacity = '1'; }, 10);
            
            // Set details
            const avatarId = selectedContact.id + 10;
            document.getElementById('call-avatar').src = `https://i.pravatar.cc/120?img=${avatarId}`;
            document.getElementById('call-name').textContent = selectedContact.full_name;
            document.getElementById('call-status').textContent = 'Ringing...';
            document.getElementById('btn-call-mute').style.background = '#e5e7eb';
            document.getElementById('btn-call-mute').innerHTML = '<i class="fa-solid fa-microphone"></i>';

            // Simulate call connection after 3 seconds
            let seconds = 0;
            if (callTimerInterval) clearInterval(callTimerInterval);
            
            setTimeout(() => {
                if (callModal.style.display === 'flex') {
                    document.getElementById('call-status').textContent = 'Connected (00:00)';
                    callTimerInterval = setInterval(() => {
                        seconds++;
                        const m = String(Math.floor(seconds / 60)).padStart(2, '0');
                        const s = String(seconds % 60).padStart(2, '0');
                        document.getElementById('call-status').textContent = `Connected (${m}:${s})`;
                    }, 1000);
                }
            }, 3000);
        });
    }

    // Google Meet Link Generator
    if (btnMeet) {
        btnMeet.addEventListener('click', async () => {
            if (!selectedContact) return;
            // Generate a random meet code
            const code = Math.random().toString(36).substring(2, 5) + '-' + Math.random().toString(36).substring(2, 6) + '-' + Math.random().toString(36).substring(2, 5);
            const meetUrl = `https://meet.google.com/${code}`;
            const msg = `Let's join a Voice Call / Google Meet here: ${meetUrl}`;
            
            // Post as a message
            try {
                const res = await fetch('/api/v1/employee/chat/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ recipient_id: selectedContact.id, message: msg }),
                    credentials: 'include'
                });
                if (res.ok) {
                    await loadMessages();
                }
            } catch (e) {
                console.error("Error sending Google Meet link:", e);
            }
        });
    }

    // Call End/Mute Handler
    const btnHangup = document.getElementById('btn-call-hangup');
    const btnMute = document.getElementById('btn-call-mute');
    
    if (btnHangup) {
        btnHangup.addEventListener('click', () => {
            if (callTimerInterval) clearInterval(callTimerInterval);
            callModal.style.opacity = '0';
            setTimeout(() => { callModal.style.display = 'none'; }, 250);
        });
    }

    if (btnMute) {
        btnMute.addEventListener('click', () => {
            const currentBg = btnMute.style.background;
            if (currentBg === 'rgb(243, 244, 246)' || btnMute.style.background === 'rgba(0, 0, 0, 0.05)' || btnMute.style.background === '') {
                // Mute
                btnMute.style.background = '#f87171';
                btnMute.style.color = '#fff';
                btnMute.innerHTML = '<i class="fa-solid fa-microphone-slash"></i>';
            } else {
                // Unmute
                btnMute.style.background = '#e5e7eb';
                btnMute.style.color = '#374151';
                btnMute.innerHTML = '<i class="fa-solid fa-microphone"></i>';
            }
        });
    }

    // Filter listeners
    if (dirSearch) {
        dirSearch.addEventListener('input', debounce(loadDirectory, 300));
    }
    if (dirDeptFilter) {
        dirDeptFilter.addEventListener('change', loadDirectory);
    }

    // Logout implementation
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

    function debounce(func, delay) {
        let timer;
        return function(...args) {
            clearTimeout(timer);
            timer = setTimeout(() => func.apply(this, args), delay);
        };
    }

    // Initial load
    loadDirectory();
});
