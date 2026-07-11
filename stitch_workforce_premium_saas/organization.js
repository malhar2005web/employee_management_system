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
                empModal.style.display = 'flex';
                setTimeout(() => { empModal.style.opacity = '1'; }, 10);
            });
        }

        const closeModal = () => {
            empModal.style.opacity = '0';
            setTimeout(() => { empModal.style.display = 'none'; }, 250);
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

                const toggleActionPill = emp.status === 'Active' || emp.status === 'active'
                    ? `<button class="action-pill suspend" onclick="toggleStatus(${emp.id}, false)"><i class="fa-solid fa-ban"></i> Suspend</button>`
                    : `<button class="action-pill activate" onclick="toggleStatus(${emp.id}, true)"><i class="fa-solid fa-check"></i> Activate</button>`;

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
                            ${toggleActionPill}
                        </div>
                    </td>
                `;
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

    const loadChatContacts = async () => {
        try {
            const res = await fetch('/api/v1/employee/chat/contacts');
            const data = await res.json();
            if (res.ok && data.success) {
                chatContacts = data.data;
                renderChatContacts(chatContacts);
                
                // If URL has a chat_id query param, select it
                const params = new URLSearchParams(window.location.search);
                const chatId = params.get('chat_id');
                if (chatId) {
                    const c = chatContacts.find(x => x.id == chatId);
                    if (c) {
                        selectContact(c);
                        // Clean URL so refresh doesn't force switch
                        window.history.replaceState({}, document.title, window.location.pathname);
                    }
                }
            }
        } catch (e) {
            console.error("Error loading chat contacts:", e);
        }
    };

    const renderChatContacts = (contacts) => {
        const list = document.getElementById('chat-contacts-list');
        if (!list) return;
        
        list.innerHTML = '';
        if (contacts.length === 0) {
            list.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:12px;font-size:12px;">No contacts found</div>';
            return;
        }

        contacts.forEach(c => {
            const item = document.createElement('div');
            const avatarId = c.id + 10;
            const isSelected = selectedContact && selectedContact.id === c.id;
            const isActive = c.status === 'Active' || c.status === 'active';
            const statusDotColor = isActive ? '#22c55e' : '#9ca3af';

            item.style.cssText = `
                display:flex; align-items:center; gap:10px; padding:10px; border-radius:10px; cursor:pointer;
                background:${isSelected ? 'rgba(255,255,255,0.3)' : 'transparent'};
                transition: background 0.2s;
            `;
            item.innerHTML = `
                <div style="position:relative;">
                    <img src="https://i.pravatar.cc/80?img=${avatarId}" style="width:36px; height:36px; border-radius:50%; object-fit:cover;" />
                    <span style="position:absolute; bottom:0; right:0; width:9px; height:9px; border-radius:50%; background:${statusDotColor}; border:1.5px solid #fff;"></span>
                </div>
                <div style="flex:1; min-width:0;">
                    <div style="font-weight:700; font-size:13px; color:var(--teal-900); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${c.full_name}</div>
                    <div style="font-size:11px; color:var(--text-muted); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${c.designation_name || 'Staff'}</div>
                </div>
            `;
            item.addEventListener('click', () => selectContact(c));
            list.appendChild(item);
        });
    };

    const selectContact = (contact) => {
        selectedContact = contact;
        // Rerender contacts sidebar to show selection
        renderChatContacts(chatContacts);

        // Show active thread view
        document.getElementById('chat-thread-empty').style.display = 'none';
        document.getElementById('chat-thread-active').style.display = 'flex';

        // Header info
        const avatarId = contact.id + 10;
        document.getElementById('chat-header-avatar').src = `https://i.pravatar.cc/80?img=${avatarId}`;
        document.getElementById('chat-header-name').textContent = contact.full_name;
        document.getElementById('chat-header-status').textContent = `${contact.designation_name || 'Staff'} | ${contact.department_name || 'Department'}`;

        // Load messages
        loadMessages();

        // Start polling
        startMessagePolling();
    };

    const loadMessages = async () => {
        if (!selectedContact) return;
        try {
            const res = await fetch(`/api/v1/employee/chat/messages?contact_id=${selectedContact.id}`);
            const data = await res.json();
            if (res.ok && data.success) {
                renderMessages(data.data);
            }
        } catch (e) {
            console.error("Error loading chat messages:", e);
        }
    };

    const renderMessages = (messagesList) => {
        const container = document.getElementById('chat-messages-container');
        if (!container) return;

        // Save scroll position
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 80;

        container.innerHTML = '';
        if (messagesList.length === 0) {
            container.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:24px;font-size:12.5px;">No messages yet. Say hello!</div>';
            return;
        }

        messagesList.forEach(m => {
            const isMe = m.sender_id !== selectedContact.id;
            const time = new Date(m.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
            
            const outerDiv = document.createElement('div');
            outerDiv.style.cssText = `
                display:flex; flex-direction:column; align-items: ${isMe ? 'flex-end' : 'flex-start'}; width:100%;
            `;

            const bubble = document.createElement('div');
            bubble.style.cssText = `
                max-width:70%; padding:10px 14px; border-radius:16px; font-size:13px; line-height:1.4;
                background:${isMe ? 'var(--teal-600)' : 'rgba(255,255,255,0.7)'};
                color:${isMe ? '#fff' : 'var(--text-dark)'};
                border:1px solid ${isMe ? 'transparent' : 'rgba(0,0,0,0.06)'};
                box-shadow:0 1px 2px rgba(0,0,0,0.05);
                border-bottom-right-radius:${isMe ? '4px' : '16px'};
                border-bottom-left-radius:${isMe ? '16px' : '4px'};
                word-break: break-word;
            `;
            // Check for Meet links and make them clickable links
            let text = m.message;
            if (text.includes('https://meet.google.com/')) {
                text = text.replace(/(https:\/\/meet\.google\.com\/[a-z0-9-]+)/g, '<a href="$1" target="_blank" style="color:inherit;text-decoration:underline;font-weight:700;">$1</a>');
                bubble.innerHTML = text;
            } else {
                bubble.textContent = text;
            }

            const infoDiv = document.createElement('div');
            infoDiv.style.cssText = `
                font-size:10px; color:var(--text-muted); margin-top:4px; margin-left:4px; margin-right:4px;
            `;
            infoDiv.textContent = time;

            outerDiv.appendChild(bubble);
            outerDiv.appendChild(infoDiv);
            container.appendChild(outerDiv);
        });

        // Scroll to bottom
        if (isNearBottom || container.scrollTop === 0) {
            container.scrollTop = container.scrollHeight;
        }
    };

    const sendChatMessage = async () => {
        const input = document.getElementById('chat-message-input');
        if (!input || !selectedContact) return;
        const msg = input.value.trim();
        if (!msg) return;

        try {
            const res = await fetch('/api/v1/employee/chat/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recipient_id: selectedContact.id, message: msg }),
                credentials: 'include'
            });
            const data = await res.json();
            if (res.ok && data.success) {
                input.value = '';
                await loadMessages();
            }
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
    }

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
