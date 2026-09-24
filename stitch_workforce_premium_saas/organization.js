/**
 * PCS Enterprise Suite — Organization Module (Admin & Employee)
 * Comprehensive directory, org chart, departments, designations, modal handlers & team chat.
 */

// ================= GLOBAL MODAL HELPERS =================
window.openEmployeeModal = function() {
    const empModal = document.getElementById('emp-modal');
    const empForm = document.getElementById('emp-form');
    const empEditId = document.getElementById('emp-edit-id');
    const modalTitleText = document.getElementById('modal-title-text');
    const submitBtn = document.getElementById('emp-modal-submit');

    if (empForm) {
        empForm.reset();
        // Ensure all fields are fully editable
        empForm.querySelectorAll('input, select, textarea').forEach(el => {
            el.disabled = false;
            el.readOnly = false;
        });
    }
    if (empEditId) empEditId.value = '';
    if (modalTitleText) modalTitleText.textContent = 'Add New Employee';
    if (submitBtn) submitBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Employee';

    if (typeof window.resetEmpDocumentViews === 'function') {
        window.resetEmpDocumentViews();
    }
    const empGenderInit = document.getElementById('emp-gender');
    if (empGenderInit) empGenderInit.value = 'Male';

    if (typeof window.updateDesignationOptions === 'function') {
        window.updateDesignationOptions('', '');
    }

    // Reset password fields for new employee
    const empPwd = document.getElementById('emp-password');
    const empConfPwd = document.getElementById('emp-confirm-password');
    const empPwdReq = document.getElementById('emp-pwd-req');
    const empConfPwdReq = document.getElementById('emp-conf-pwd-req');
    const empPwdHint = document.getElementById('emp-pwd-hint');
    const empPwdMatchError = document.getElementById('emp-pwd-match-error');
    const toggleEmpPwd = document.getElementById('toggle-emp-pwd');
    const toggleEmpConfPwd = document.getElementById('toggle-emp-conf-pwd');

    if (empPwd) {
        empPwd.value = '';
        empPwd.type = 'password';
        empPwd.required = true;
    }
    if (empConfPwd) {
        empConfPwd.value = '';
        empConfPwd.type = 'password';
        empConfPwd.required = true;
    }
    if (empPwdReq) empPwdReq.style.display = 'inline';
    if (empConfPwdReq) empConfPwdReq.style.display = 'inline';
    if (empPwdHint) empPwdHint.textContent = 'Admin-assigned password for employee portal login (min 6 chars).';
    if (empPwdMatchError) empPwdMatchError.style.display = 'none';
    if (toggleEmpPwd) toggleEmpPwd.className = 'fa-solid fa-eye';
    if (toggleEmpConfPwd) toggleEmpConfPwd.className = 'fa-solid fa-eye';

    if (empModal) {
        empModal.style.display = 'flex';
        document.body.classList.add('modal-open');
        requestAnimationFrame(() => {
            empModal.classList.add('active');
            empModal.style.opacity = '1';
        });
    }
};

window.closeEmployeeModal = function() {
    const empModal = document.getElementById('emp-modal');
    if (empModal) {
        empModal.style.opacity = '0';
        empModal.classList.remove('active');
        setTimeout(() => {
            empModal.style.display = 'none';
            if (!document.querySelector('.modal-overlay.active')) {
                document.body.classList.remove('modal-open');
            }
        }, 150);
    }
    const empForm = document.getElementById('emp-form');
    if (empForm) empForm.reset();
    const empEditId = document.getElementById('emp-edit-id');
    if (empEditId) empEditId.value = '';
    if (typeof window.resetEmpDocumentViews === 'function') {
        window.resetEmpDocumentViews();
    }
};

window.openQuickAddDeptModal = function() {
    const form = document.getElementById('quick-dept-form');
    const modal = document.getElementById('quick-dept-modal');
    if (form) form.reset();
    if (modal) {
        modal.style.display = 'flex';
        requestAnimationFrame(() => {
            modal.classList.add('active');
            modal.style.opacity = '1';
            const nameInp = document.getElementById('quick-dept-name');
            if (nameInp) nameInp.focus();
        });
    }
};

window.closeQuickAddDeptModal = function() {
    const modal = document.getElementById('quick-dept-modal');
    if (modal) {
        modal.style.opacity = '0';
        modal.classList.remove('active');
        setTimeout(() => { modal.style.display = 'none'; }, 150);
    }
    const form = document.getElementById('quick-dept-form');
    if (form) form.reset();
};

window.openQuickAddDesigModal = function() {
    const form = document.getElementById('quick-desig-form');
    const modal = document.getElementById('quick-desig-modal');
    const quickDesigDept = document.getElementById('quick-desig-dept');
    const empDept = document.getElementById('emp-dept');
    if (form) form.reset();
    if (quickDesigDept && empDept && empDept.value) {
        quickDesigDept.value = empDept.value;
    }
    if (modal) {
        modal.style.display = 'flex';
        requestAnimationFrame(() => {
            modal.classList.add('active');
            modal.style.opacity = '1';
            const titleInp = document.getElementById('quick-desig-title');
            if (titleInp) titleInp.focus();
        });
    }
};

window.closeQuickAddDesigModal = function() {
    const modal = document.getElementById('quick-desig-modal');
    if (modal) {
        modal.style.opacity = '0';
        modal.classList.remove('active');
        setTimeout(() => { modal.style.display = 'none'; }, 150);
    }
    const form = document.getElementById('quick-desig-form');
    if (form) form.reset();
};

// ================= DOM CONTENT LOADED =================
document.addEventListener('DOMContentLoaded', () => {
    // Logout Handler
    const logoutBtn = document.getElementById('logout-btn');
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

    // Identify if Admin or Employee view
    const isAdmin = !!document.getElementById('table-employees') || window.location.pathname.includes('admin-');

    // Shared filter elements
    const dirSearch = document.getElementById('dir-search');
    const dirDeptFilter = document.getElementById('dir-dept-filter');

    function debounce(func, delay) {
        let timer;
        return function(...args) {
            clearTimeout(timer);
            timer = setTimeout(() => func.apply(this, args), delay);
        };
    }

    // Wire global close buttons on modal elements
    document.querySelectorAll('#emp-modal-close, #emp-modal-cancel, .emp-modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            window.closeEmployeeModal();
        });
    });

    const empModalEl = document.getElementById('emp-modal');
    const quickDeptModalEl = document.getElementById('quick-dept-modal');
    const quickDesigModalEl = document.getElementById('quick-desig-modal');

    // Backdrop click to close modals
    [empModalEl, quickDeptModalEl, quickDesigModalEl].forEach(modalEl => {
        if (modalEl) {
            modalEl.addEventListener('click', (e) => {
                if (e.target === modalEl) {
                    if (modalEl === empModalEl) window.closeEmployeeModal();
                    else if (modalEl === quickDeptModalEl) window.closeQuickAddDeptModal();
                    else if (modalEl === quickDesigModalEl) window.closeQuickAddDesigModal();
                }
            });
        }
    });

    // Escape key listener
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (quickDesigModalEl && quickDesigModalEl.style.display === 'flex') {
                window.closeQuickAddDesigModal();
            } else if (quickDeptModalEl && quickDeptModalEl.style.display === 'flex') {
                window.closeQuickAddDeptModal();
            } else if (empModalEl && empModalEl.style.display === 'flex') {
                window.closeEmployeeModal();
            }
        }
    });

    // =========================================================================
    // ADMIN SECTION
    // =========================================================================
    if (isAdmin) {
        // Tab elements
        const tabEmployees = document.getElementById('tab-employees');
        const btnChart = document.getElementById('btn-chart');
        const tabDepts = document.getElementById('tab-depts');
        const tabDesigs = document.getElementById('tab-desigs');

        const viewEmployees = document.getElementById('view-employees');
        const chartView = document.getElementById('chart-view');
        const viewDepts = document.getElementById('view-depts');
        const viewDesigs = document.getElementById('view-desigs');
        const viewTitle = document.getElementById('view-title');

        const btnAddEmpModal = document.getElementById('btn-add-emp-modal');

        // Form elements
        const empModal = document.getElementById('emp-modal');
        const empForm = document.getElementById('emp-form');
        const empEditId = document.getElementById('emp-edit-id');
        const modalTitleText = document.getElementById('modal-title-text');
        const submitBtn = document.getElementById('emp-modal-submit');

        const empFullName = document.getElementById('emp-fullname');
        const empEmail = document.getElementById('emp-email');
        const empCode = document.getElementById('emp-code');
        const empGrade = document.getElementById('emp-grade');
        const empDept = document.getElementById('emp-dept');
        const empDesig = document.getElementById('emp-desig');
        const empManager = document.getElementById('emp-manager');
        const empJoinDate = document.getElementById('emp-join-date');

        const empGender = document.getElementById('emp-gender');
        const empPhone = document.getElementById('emp-phone');
        const empDob = document.getElementById('emp-dob');
        const empWhatsappNo = document.getElementById('emp-whatsapp-no');
        const empAnydeskId = document.getElementById('emp-anydesk-id');
        const empCitizenship = document.getElementById('emp-citizenship');
        const empAddress = document.getElementById('emp-address');
        const empPermAddress = document.getElementById('emp-perm-address');
        const empBankName = document.getElementById('emp-bank-name');
        const empBankAccNo = document.getElementById('emp-bank-acc-no');
        const empBankIfsc = document.getElementById('emp-bank-ifsc');

        const quickDeptForm = document.getElementById('quick-dept-form');
        const quickDesigForm = document.getElementById('quick-desig-form');
        const quickDesigDept = document.getElementById('quick-desig-dept');

        const deptForm = document.getElementById('dept-form');
        const deptEditId = document.getElementById('dept-edit-id');
        const deptFormTitle = document.getElementById('dept-form-title');
        const deptSubmitText = document.getElementById('dept-submit-text');
        const deptCancelEditBtn = document.getElementById('dept-cancel-edit-btn');

        const desigForm = document.getElementById('desig-form');
        const desigEditId = document.getElementById('desig-edit-id');
        const desigDept = document.getElementById('desig-dept');
        const desigFormTitle = document.getElementById('desig-form-title');
        const desigSubmitText = document.getElementById('desig-submit-text');
        const desigCancelEditBtn = document.getElementById('desig-cancel-edit-btn');

        const employeesList = document.getElementById('employees-list');
        const deptsList = document.getElementById('depts-list');
        const desigsList = document.getElementById('desigs-list');

        let docCv = null;
        let docOffer = null;
        let docAdhar = null;
        let docPan = null;
        let cachedMetadata = { departments: [], designations: [] };
        let activeEmployeesList = [];

        // Tab Switching
        const switchTab = (tabName) => {
            if (tabEmployees) tabEmployees.classList.remove('active');
            if (btnChart) btnChart.classList.remove('active');
            if (tabDepts) tabDepts.classList.remove('active');
            if (tabDesigs) tabDesigs.classList.remove('active');

            if (viewEmployees) viewEmployees.style.display = 'none';
            if (chartView) chartView.style.display = 'none';
            if (viewDepts) viewDepts.style.display = 'none';
            if (viewDesigs) viewDesigs.style.display = 'none';

            if (btnAddEmpModal) btnAddEmpModal.style.display = 'none';

            if (tabName === 'employees') {
                if (tabEmployees) tabEmployees.classList.add('active');
                if (viewEmployees) viewEmployees.style.display = 'block';
                if (viewTitle) viewTitle.textContent = 'Active Directory';
                if (btnAddEmpModal) btnAddEmpModal.style.display = 'inline-flex';
                loadAdminEmployees();
            } else if (tabName === 'chart') {
                if (btnChart) btnChart.classList.add('active');
                if (chartView) chartView.style.display = 'block';
                if (viewTitle) viewTitle.textContent = 'Organization Chart';
                loadOrgChart();
            } else if (tabName === 'depts') {
                if (tabDepts) tabDepts.classList.add('active');
                if (viewDepts) viewDepts.style.display = 'block';
                if (viewTitle) viewTitle.textContent = 'Departments Board';
                loadMetadata();
            } else if (tabName === 'desigs') {
                if (tabDesigs) tabDesigs.classList.add('active');
                if (viewDesigs) viewDesigs.style.display = 'block';
                if (viewTitle) viewTitle.textContent = 'Designation Matrices';
                loadMetadata();
            }
        };

        if (tabEmployees) tabEmployees.addEventListener('click', () => switchTab('employees'));
        if (btnChart) btnChart.addEventListener('click', () => switchTab('chart'));
        if (tabDepts) tabDepts.addEventListener('click', () => switchTab('depts'));
        if (tabDesigs) tabDesigs.addEventListener('click', () => switchTab('desigs'));

        if (btnAddEmpModal) {
            btnAddEmpModal.addEventListener('click', window.openEmployeeModal);
        }

        // Password visibility toggles
        const toggleEmpPwd = document.getElementById('toggle-emp-pwd');
        const empPwdInput = document.getElementById('emp-password');
        if (toggleEmpPwd && empPwdInput) {
            toggleEmpPwd.addEventListener('click', () => {
                const isPwd = empPwdInput.type === 'password';
                empPwdInput.type = isPwd ? 'text' : 'password';
                toggleEmpPwd.className = isPwd ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
            });
        }
        const toggleEmpConfPwd = document.getElementById('toggle-emp-conf-pwd');
        const empConfPwdInput = document.getElementById('emp-confirm-password');
        if (toggleEmpConfPwd && empConfPwdInput) {
            toggleEmpConfPwd.addEventListener('click', () => {
                const isPwd = empConfPwdInput.type === 'password';
                empConfPwdInput.type = isPwd ? 'text' : 'password';
                toggleEmpConfPwd.className = isPwd ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
            });
        }

        // Document Upload Handlers
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
                        const fnEl = document.getElementById(filenameId);
                        if (fnEl) fnEl.textContent = file.name;
                        const link = document.getElementById(linkId);
                        if (link) {
                            link.href = reader.result;
                            link.style.display = 'inline-flex';
                        }
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

        window.resetEmpDocumentViews = function() {
            docCv = null;
            docOffer = null;
            docAdhar = null;
            docPan = null;
            const cvFn = document.getElementById('cv-filename'); if (cvFn) cvFn.textContent = 'No file';
            const cvLnk = document.getElementById('cv-download-link'); if (cvLnk) cvLnk.style.display = 'none';
            const ofFn = document.getElementById('offer-filename'); if (ofFn) ofFn.textContent = 'No file';
            const ofLnk = document.getElementById('offer-download-link'); if (ofLnk) ofLnk.style.display = 'none';
            const adFn = document.getElementById('adhar-filename'); if (adFn) adFn.textContent = 'No file';
            const adLnk = document.getElementById('adhar-download-link'); if (adLnk) adLnk.style.display = 'none';
            const pnFn = document.getElementById('pan-filename'); if (pnFn) pnFn.textContent = 'No file';
            const pnLnk = document.getElementById('pan-download-link'); if (pnLnk) pnLnk.style.display = 'none';
            
            ['emp-doc-cv', 'emp-doc-offer', 'emp-doc-adhar', 'emp-doc-pan'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
        };

        // ================= METADATA (DEPTS & DESIGS) =================
        const loadMetadata = async () => {
            try {
                const response = await fetch('/api/v1/admin/employees/metadata');
                const data = await response.json();
                if (response.ok && data.success) {
                    cachedMetadata = data.data;
                    renderMetadata(data.data);
                }
            } catch (error) {
                console.error("Error loading metadata:", error);
            }
        };

        // Dynamic helper to populate designation options based on selected department
        window.updateDesignationOptions = function(selectedDeptId, selectedDesigId) {
            if (!empDesig) return;
            const targetDesigVal = selectedDesigId !== undefined ? String(selectedDesigId) : String(empDesig.value || '');
            empDesig.innerHTML = '<option value="">Select Designation</option>';

            const allDesigs = cachedMetadata.designations || [];
            const depts = cachedMetadata.departments || [];

            if (!selectedDeptId) {
                // Show all designations with department tag
                allDesigs.forEach(d => {
                    const dept = depts.find(deptObj => deptObj.id === d.department_id);
                    const opt = document.createElement('option');
                    opt.value = d.id;
                    opt.textContent = dept ? `${d.title} — [${dept.name}]` : d.title;
                    empDesig.appendChild(opt);
                });
            } else {
                const deptIdNum = parseInt(selectedDeptId, 10);
                const matchingDesigs = allDesigs.filter(d => d.department_id === deptIdNum);
                const otherDesigs = allDesigs.filter(d => d.department_id !== deptIdNum);

                if (matchingDesigs.length > 0) {
                    const groupMatch = document.createElement('optgroup');
                    const deptObj = depts.find(d => d.id === deptIdNum);
                    groupMatch.label = deptObj ? `${deptObj.name} Designations` : 'Department Designations';
                    matchingDesigs.forEach(d => {
                        const opt = document.createElement('option');
                        opt.value = d.id;
                        opt.textContent = d.title;
                        groupMatch.appendChild(opt);
                    });
                    empDesig.appendChild(groupMatch);
                }

                if (otherDesigs.length > 0) {
                    const groupOther = document.createElement('optgroup');
                    groupOther.label = 'Other Designations';
                    otherDesigs.forEach(d => {
                        const dept = depts.find(deptObj => deptObj.id === d.department_id);
                        const opt = document.createElement('option');
                        opt.value = d.id;
                        opt.textContent = dept ? `${d.title} — [${dept.name}]` : d.title;
                        groupOther.appendChild(opt);
                    });
                    empDesig.appendChild(groupOther);
                }
            }

            if (targetDesigVal) {
                empDesig.value = targetDesigVal;
            }
        };

        const renderMetadata = (meta) => {
            // 1. Populate Employee Modal Department Select
            if (empDept) {
                const curVal = empDept.value;
                empDept.innerHTML = '<option value="">Select Department</option>';
                meta.departments.forEach(d => {
                    const opt = document.createElement('option');
                    opt.value = d.id;
                    opt.textContent = `${d.name} (${d.code})`;
                    empDept.appendChild(opt);
                });
                if (curVal) empDept.value = curVal;
            }

            // 2. Populate Employee Modal Designation Select
            window.updateDesignationOptions(empDept ? empDept.value : '', empDesig ? empDesig.value : '');

            // 3. Populate Designation Tab Dept Select
            if (desigDept) {
                const curVal = desigDept.value;
                desigDept.innerHTML = '<option value="">Select Department</option>';
                meta.departments.forEach(d => {
                    const opt = document.createElement('option');
                    opt.value = d.id;
                    opt.textContent = `${d.name} (${d.code})`;
                    desigDept.appendChild(opt);
                });
                if (curVal) desigDept.value = curVal;
            }

            // 4. Populate Quick Desig Modal Dept Select
            if (quickDesigDept) {
                const curVal = quickDesigDept.value;
                quickDesigDept.innerHTML = '<option value="">Select Department</option>';
                meta.departments.forEach(d => {
                    const opt = document.createElement('option');
                    opt.value = d.id;
                    opt.textContent = `${d.name} (${d.code})`;
                    quickDesigDept.appendChild(opt);
                });
                if (curVal) quickDesigDept.value = curVal;
            }

            // 5. Populate Directory Filter Dropdown
            populateDepartments(meta.departments);

            // 6. Render Departments Table
            if (deptsList) {
                deptsList.innerHTML = '';
                if (meta.departments.length === 0) {
                    deptsList.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--text-muted);">No departments configured.</td></tr>`;
                } else {
                    meta.departments.forEach(d => {
                        const tr = document.createElement('tr');
                        const safeDeptJson = JSON.stringify(d).replace(/"/g, '&quot;');
                        tr.innerHTML = `
                            <td class="task-name" style="font-weight:700;color:var(--teal-900);">${d.name}</td>
                            <td style="font-weight:700;color:var(--teal-600);">${d.code}</td>
                            <td style="color:#64748b;font-size:12.5px;">${d.description || '—'}</td>
                            <td style="text-align:right; white-space:nowrap;">
                                <div style="display:inline-flex;gap:6px;">
                                    <button type="button" class="action-pill edit btn-edit-dept" data-dept="${safeDeptJson}"><i class="fa-solid fa-pen"></i> Edit</button>
                                    <button type="button" class="action-pill delete btn-del-dept" data-id="${d.id}" data-name="${(d.name || '').replace(/"/g, '&quot;')}"><i class="fa-solid fa-trash"></i></button>
                                </div>
                            </td>
                        `;
                        tr.querySelector('.btn-edit-dept').addEventListener('click', (e) => {
                            e.preventDefault();
                            const deptData = JSON.parse(e.currentTarget.getAttribute('data-dept'));
                            window.editDepartment(deptData);
                        });
                        tr.querySelector('.btn-del-dept').addEventListener('click', (e) => {
                            e.preventDefault();
                            const id = e.currentTarget.dataset.id;
                            const name = e.currentTarget.dataset.name;
                            window.deleteDepartment(id, name);
                        });
                        deptsList.appendChild(tr);
                    });
                }
            }

            // 7. Render Designations Table
            if (desigsList) {
                desigsList.innerHTML = '';
                if (meta.designations.length === 0) {
                    desigsList.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--text-muted);">No designations configured.</td></tr>`;
                } else {
                    meta.designations.forEach(d => {
                        const tr = document.createElement('tr');
                        const dept = meta.departments.find(deptObj => deptObj.id === d.department_id);
                        const safeDesigJson = JSON.stringify(d).replace(/"/g, '&quot;');
                        tr.innerHTML = `
                            <td class="task-name" style="font-weight:700;color:var(--teal-900);">${d.title}</td>
                            <td><span style="background:rgba(15,118,110,0.08);color:var(--teal-800);padding:2px 8px;border-radius:6px;font-size:12px;font-weight:600;">${dept ? dept.name : 'Unassigned'}</span></td>
                            <td style="font-weight:600;color:#64748b;">${d.level || '—'}</td>
                            <td style="text-align:right; white-space:nowrap;">
                                <div style="display:inline-flex;gap:6px;">
                                    <button type="button" class="action-pill edit btn-edit-desig" data-desig="${safeDesigJson}"><i class="fa-solid fa-pen"></i> Edit</button>
                                    <button type="button" class="action-pill delete btn-del-desig" data-id="${d.id}" data-title="${(d.title || '').replace(/"/g, '&quot;')}"><i class="fa-solid fa-trash"></i></button>
                                </div>
                            </td>
                        `;
                        tr.querySelector('.btn-edit-desig').addEventListener('click', (e) => {
                            e.preventDefault();
                            const desigData = JSON.parse(e.currentTarget.getAttribute('data-desig'));
                            window.editDesignation(desigData);
                        });
                        tr.querySelector('.btn-del-desig').addEventListener('click', (e) => {
                            e.preventDefault();
                            const id = e.currentTarget.dataset.id;
                            const title = e.currentTarget.dataset.title;
                            window.deleteDesignation(id, title);
                        });
                        desigsList.appendChild(tr);
                    });
                }
            }
        };

        const populateDepartments = (departments) => {
            if (!dirDeptFilter) return;
            const curVal = dirDeptFilter.value;
            dirDeptFilter.innerHTML = '<option value="">All Departments</option>';
            departments.forEach(dept => {
                const opt = document.createElement('option');
                opt.value = dept.id;
                opt.textContent = dept.name;
                dirDeptFilter.appendChild(opt);
            });
            if (curVal) dirDeptFilter.value = curVal;
        };

        // When Department changes in Employee modal, dynamically adjust designations
        if (empDept) {
            empDept.addEventListener('change', () => {
                window.updateDesignationOptions(empDept.value, empDesig ? empDesig.value : '');
            });
        }

        // When Designation changes in Employee modal, if that designation belongs to a department, auto-select it if empty
        if (empDesig) {
            empDesig.addEventListener('change', () => {
                const selectedDesigId = parseInt(empDesig.value, 10);
                if (selectedDesigId && cachedMetadata.designations) {
                    const match = cachedMetadata.designations.find(d => d.id === selectedDesigId);
                    if (match && match.department_id && (!empDept.value || empDept.value != match.department_id)) {
                        empDept.value = match.department_id;
                    }
                }
            });
        }

        // ================= LOAD & RENDER DIRECTORY EMPLOYEES =================
        const loadAdminEmployees = async () => {
            const search = dirSearch ? dirSearch.value.trim() : '';
            const deptId = dirDeptFilter ? dirDeptFilter.value : '';
            try {
                const response = await fetch(`/api/v1/organization/directory?search=${encodeURIComponent(search)}&departmentId=${deptId}`);
                const resData = await response.json();
                if (response.ok && resData.success) {
                    activeEmployeesList = resData.data.employees || [];
                    renderAdminEmployees(activeEmployeesList);
                    if (dirDeptFilter && dirDeptFilter.options.length <= 1 && resData.data.departments) {
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
                employeesList.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:24px;color:var(--text-muted);">No employees registered yet.</td></tr>`;
                return;
            }

            // Populate Reporting Manager select
            if (empManager) {
                const curVal = empManager.value;
                empManager.innerHTML = '<option value="">None</option>';
                employees.forEach(e => {
                    const opt = document.createElement('option');
                    opt.value = e.id;
                    opt.textContent = e.full_name;
                    empManager.appendChild(opt);
                });
                if (curVal) empManager.value = curVal;
            }

            employees.forEach(emp => {
                const tr = document.createElement('tr');
                const avatarId = (emp.id % 70) + 1;
                const statusClass = emp.status === 'Active' || emp.status === 'active' ? 'progress' : 'todo';
                const statusLabel = emp.status || 'Active';

                const whatsapp = emp.whatsapp_no || '';
                const anydesk = emp.anydesk_id || '';
                const waLink = whatsapp ? `<a href="https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}" target="_blank" style="color:#059669;font-weight:600;text-decoration:none;display:flex;align-items:center;gap:6px;"><i class="fa-brands fa-whatsapp" style="font-size:16px;color:#25D366;"></i>${whatsapp}</a>` : '<span style="color:var(--text-muted);">—</span>';
                const adDisplay = anydesk ? `<span style="font-weight:600;color:var(--text-dark);"><i class="fa-solid fa-desktop" style="margin-right:5px;color:var(--teal-600);"></i>${anydesk}</span>` : '<span style="color:var(--text-muted);">—</span>';
                const plainPwd = emp.plain_password || 'Penta@123';

                const safeEmpJson = JSON.stringify(emp).replace(/"/g, '&quot;');

                tr.innerHTML = `
                    <td class="task-name" style="display:flex;align-items:center;gap:12px;">
                        <img src="https://i.pravatar.cc/80?img=${avatarId}" alt="" style="width:34px;height:34px;border-radius:50%;object-fit:cover;border:2px solid #fff;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                        <span style="font-weight:700;color:var(--teal-900);">${emp.full_name}</span>
                    </td>
                    <td style="font-weight:600;color:var(--teal-700);">${emp.employee_code || '-'}</td>
                    <td>${emp.email || '-'}</td>
                    <td class="emp-pwd-cell" style="white-space:nowrap;">
                        <div style="display:inline-flex; align-items:center; gap:6px; background:rgba(255,255,255,0.7); padding:4px 8px; border-radius:6px; border:1px solid rgba(0,0,0,0.08); font-family:monospace; font-size:12.5px; font-weight:700; color:var(--teal-900);">
                            <span class="pwd-val-text">${plainPwd}</span>
                            <button type="button" class="btn-copy-emp-pwd" title="Copy Password" style="background:none; border:none; color:var(--teal-600); cursor:pointer; padding:2px; font-size:12px; display:inline-flex; align-items:center;">
                                <i class="fa-regular fa-copy"></i>
                            </button>
                        </div>
                    </td>
                    <td><span style="background:rgba(15,118,110,0.08);color:var(--teal-800);padding:3px 8px;border-radius:6px;font-size:12px;font-weight:600;">${emp.department_name || '-'}</span></td>
                    <td style="font-weight:600;">${emp.designation_name || '-'}</td>
                    <td>${emp.manager_name || 'None'}</td>
                    <td><span class="status-pill ${statusClass}">${statusLabel}</span></td>
                    <td>${waLink}</td>
                    <td>${adDisplay}</td>
                    <td style="text-align:right; white-space:nowrap; padding-right:16px;">
                        <div style="display:inline-flex;gap:6px;">
                            <button type="button" class="action-pill edit btn-edit-emp" data-emp="${safeEmpJson}"><i class="fa-solid fa-pen"></i> Edit</button>
                            <button type="button" class="action-pill delete btn-offboard-emp" data-id="${emp.id}" data-name="${(emp.full_name || '').replace(/"/g, '&quot;')}"><i class="fa-solid fa-user-xmark"></i> Offboard</button>
                        </div>
                    </td>
                `;

                // Wire up copy password button
                const copyBtn = tr.querySelector('.btn-copy-emp-pwd');
                if (copyBtn) {
                    copyBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        navigator.clipboard.writeText(plainPwd).then(() => {
                            copyBtn.innerHTML = '<i class="fa-solid fa-check" style="color:#059669;"></i>';
                            setTimeout(() => {
                                copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i>';
                            }, 1800);
                        }).catch(() => {});
                    });
                }

                // Wire up edit button
                tr.querySelector('.btn-edit-emp').addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const empData = JSON.parse(e.currentTarget.getAttribute('data-emp'));
                    window.editEmployee(empData);
                });

                // Wire up offboard button
                tr.querySelector('.btn-offboard-emp').addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const id = e.currentTarget.dataset.id;
                    const name = e.currentTarget.dataset.name;
                    if (typeof window.openDeletionWizard === 'function') {
                        window.openDeletionWizard('employee', id, name);
                    } else if (confirm(`Are you sure you want to offboard ${name}?`)) {
                        window.toggleStatus(id, false);
                    }
                });

                employeesList.appendChild(tr);
            });
        };

        // ================= EDIT EMPLOYEE ACTION =================
        window.editEmployee = async (emp) => {
            if (!emp) return;

            // Ensure metadata is loaded
            if (!cachedMetadata.departments || cachedMetadata.departments.length === 0) {
                await loadMetadata();
            }

            // Populate all manager options
            if (empManager && activeEmployeesList.length > 0) {
                empManager.innerHTML = '<option value="">None</option>';
                activeEmployeesList.forEach(e => {
                    if (e.id !== emp.id) { // Don't allow reporting to oneself
                        const opt = document.createElement('option');
                        opt.value = e.id;
                        opt.textContent = e.full_name;
                        empManager.appendChild(opt);
                    }
                });
            }

            // Unlock and reset form
            if (empForm) {
                empForm.reset();
                empForm.querySelectorAll('input, select, textarea').forEach(el => {
                    el.disabled = false;
                    el.readOnly = false;
                });
            }

            // Populate Work Profile
            if (empEditId) empEditId.value = emp.id;
            if (empFullName) empFullName.value = emp.full_name || '';
            if (empEmail) empEmail.value = emp.email || '';
            if (empCode) empCode.value = emp.employee_code || '';
            if (empGrade) empGrade.value = emp.salary_grade || '';
            if (empDept) empDept.value = emp.department_id || '';
            
            // Populate and link designation dropdown
            window.updateDesignationOptions(emp.department_id || '', emp.designation_id || '');

            if (empManager) empManager.value = emp.reporting_manager_id || '';
            if (empJoinDate) empJoinDate.value = emp.joining_date ? emp.joining_date.split('T')[0] : '';

            // Populate Personal & Contact Details
            if (empGender) empGender.value = emp.gender || 'Male';
            if (empPhone) empPhone.value = emp.phone || '';
            if (empDob) empDob.value = emp.dob ? emp.dob.split('T')[0] : '';
            if (empWhatsappNo) empWhatsappNo.value = emp.whatsapp_no || '';
            if (empAnydeskId) empAnydeskId.value = emp.anydesk_id || '';
            if (empCitizenship) empCitizenship.value = emp.citizenship || '';
            if (empAddress) empAddress.value = emp.address || '';
            if (empPermAddress) empPermAddress.value = emp.perm_address || '';
            if (empBankName) empBankName.value = emp.bank_name || '';
            if (empBankAccNo) empBankAccNo.value = emp.bank_acc_no || '';
            if (empBankIfsc) empBankIfsc.value = emp.bank_ifsc || '';

            // Render existing documents
            window.resetEmpDocumentViews();
            const setDoc = (docField, filenameId, linkId) => {
                if (!docField) return;
                try {
                    const docObj = typeof docField === 'string' ? JSON.parse(docField) : docField;
                    if (docObj && docObj.fileName) {
                        const fnEl = document.getElementById(filenameId);
                        if (fnEl) fnEl.textContent = docObj.fileName;
                        const linkEl = document.getElementById(linkId);
                        if (linkEl && docObj.fileData) {
                            linkEl.href = docObj.fileData;
                            linkEl.style.display = 'inline-flex';
                        }
                    }
                } catch (e) {}
            };

            setDoc(emp.doc_cv, 'cv-filename', 'cv-download-link');
            setDoc(emp.doc_offer_letter, 'offer-filename', 'offer-download-link');
            setDoc(emp.doc_adhar_card, 'adhar-filename', 'adhar-download-link');
            setDoc(emp.doc_pan_card, 'pan-filename', 'pan-download-link');

            // Update modal headers & button text
            if (modalTitleText) modalTitleText.textContent = `Edit Employee: ${emp.full_name}`;
            if (submitBtn) submitBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Changes';

            // Password fields in edit mode (optional)
            const empPwdEdit = document.getElementById('emp-password');
            const empConfPwdEdit = document.getElementById('emp-confirm-password');
            const empPwdReq = document.getElementById('emp-pwd-req');
            const empConfPwdReq = document.getElementById('emp-conf-pwd-req');
            const empPwdHint = document.getElementById('emp-pwd-hint');
            const empPwdMatchError = document.getElementById('emp-pwd-match-error');
            const toggleEmpPwd = document.getElementById('toggle-emp-pwd');
            const toggleEmpConfPwd = document.getElementById('toggle-emp-conf-pwd');

            if (empPwdEdit) {
                empPwdEdit.value = '';
                empPwdEdit.type = 'password';
                empPwdEdit.required = false;
            }
            if (empConfPwdEdit) {
                empConfPwdEdit.value = '';
                empConfPwdEdit.type = 'password';
                empConfPwdEdit.required = false;
            }
            if (empPwdReq) empPwdReq.style.display = 'none';
            if (empConfPwdReq) empConfPwdReq.style.display = 'none';
            if (empPwdHint) empPwdHint.textContent = 'Leave blank to keep existing password, or enter new password to reset credentials.';
            if (empPwdMatchError) empPwdMatchError.style.display = 'none';
            if (toggleEmpPwd) toggleEmpPwd.className = 'fa-solid fa-eye';
            if (toggleEmpConfPwd) toggleEmpConfPwd.className = 'fa-solid fa-eye';

            // Show modal
            if (empModal) {
                empModal.style.display = 'flex';
                document.body.classList.add('modal-open');
                requestAnimationFrame(() => {
                    empModal.classList.add('active');
                    empModal.style.opacity = '1';
                });
            }
        };

        // ================= EMPLOYEE FORM SUBMIT =================
        if (empForm) {
            empForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const isEdit = empEditId && empEditId.value.trim() !== '';
                const employeeId = isEdit ? empEditId.value.trim() : null;

                const payload = {
                    fullName: empFullName ? empFullName.value.trim() : '',
                    email: empEmail ? empEmail.value.trim() : '',
                    employeeCode: empCode ? empCode.value.trim() : '',
                    salaryGrade: empGrade ? empGrade.value.trim() : null,
                    departmentId: empDept && empDept.value ? parseInt(empDept.value, 10) : null,
                    designationId: empDesig && empDesig.value ? parseInt(empDesig.value, 10) : null,
                    reportingManagerId: empManager && empManager.value ? parseInt(empManager.value, 10) : null,
                    joiningDate: empJoinDate && empJoinDate.value ? empJoinDate.value : null,
                    gender: empGender ? empGender.value : null,
                    phone: empPhone ? empPhone.value.trim() : null,
                    dob: empDob && empDob.value ? empDob.value : null,
                    whatsappNo: empWhatsappNo ? empWhatsappNo.value.trim() : null,
                    anydeskId: empAnydeskId ? empAnydeskId.value.trim() : null,
                    citizenship: empCitizenship ? empCitizenship.value.trim() : null,
                    address: empAddress ? empAddress.value.trim() : null,
                    permAddress: empPermAddress ? empPermAddress.value.trim() : null,
                    bankName: empBankName ? empBankName.value.trim() : null,
                    bankAccNo: empBankAccNo ? empBankAccNo.value.trim() : null,
                    bankIfsc: empBankIfsc ? empBankIfsc.value.trim() : null,
                    docCv: docCv,
                    docOfferLetter: docOffer,
                    docAdharCard: docAdhar,
                    docPanCard: docPan
                };

                if (!payload.fullName || !payload.email || !payload.employeeCode) {
                    alert("Please fill in Full Name, Email Address, and Employee Code.");
                    return;
                }

                // Validate Password
                const empPwdEl = document.getElementById('emp-password');
                const empConfPwdEl = document.getElementById('emp-confirm-password');
                const empPwdMatchErr = document.getElementById('emp-pwd-match-error');
                const pwdVal = empPwdEl ? empPwdEl.value.trim() : '';
                const confPwdVal = empConfPwdEl ? empConfPwdEl.value.trim() : '';

                if (!isEdit) {
                    if (!pwdVal || pwdVal.length < 6) {
                        alert("Please enter a secure login password (minimum 6 characters) for this employee.");
                        if (empPwdEl) empPwdEl.focus();
                        return;
                    }
                    if (pwdVal !== confPwdVal) {
                        if (empPwdMatchErr) empPwdMatchErr.style.display = 'block';
                        alert("Password and Confirm Password do not match.");
                        if (empConfPwdEl) empConfPwdEl.focus();
                        return;
                    }
                    payload.password = pwdVal;
                } else {
                    if (pwdVal) {
                        if (pwdVal.length < 6) {
                            alert("New password must be at least 6 characters long.");
                            if (empPwdEl) empPwdEl.focus();
                            return;
                        }
                        if (pwdVal !== confPwdVal) {
                            if (empPwdMatchErr) empPwdMatchErr.style.display = 'block';
                            alert("Password and Confirm Password do not match.");
                            if (empConfPwdEl) empConfPwdEl.focus();
                            return;
                        }
                        payload.password = pwdVal;
                    }
                }

                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
                }

                try {
                    const url = isEdit ? `/api/v1/admin/employees/${employeeId}` : '/api/v1/admin/employees';
                    const method = isEdit ? 'PUT' : 'POST';

                    const response = await fetch(url, {
                        method,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    const resData = await response.json();
                    if (response.ok && resData.success) {
                        window.closeEmployeeModal();
                        loadAdminEmployees();
                        loadMetadata();
                    } else {
                        alert(resData.message || "Failed to save employee");
                    }
                } catch (error) {
                    console.error("Error saving employee:", error);
                    alert("Network or server error occurred while saving employee.");
                } finally {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = isEdit ? '<i class="fa-solid fa-floppy-disk"></i> Save Changes' : '<i class="fa-solid fa-floppy-disk"></i> Save Employee';
                    }
                }
            });
        }

        // ================= STATUS TOGGLE (OFFBOARD) =================
        window.toggleStatus = async (id, isActive) => {
            try {
                const response = await fetch(`/api/v1/admin/employees/${id}/status`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ is_active: isActive })
                });
                const data = await response.json();
                if (response.ok && data.success) {
                    loadAdminEmployees();
                } else {
                    alert(data.message || "Failed to update employee status");
                }
            } catch (e) {
                console.error("Error toggling employee status:", e);
            }
        };

        // ================= DEPARTMENT CRUD =================
        window.editDepartment = (dept) => {
            if (deptEditId) deptEditId.value = dept.id;
            const nameInp = document.getElementById('dept-name'); if (nameInp) nameInp.value = dept.name || '';
            const codeInp = document.getElementById('dept-code'); if (codeInp) codeInp.value = dept.code || '';
            const descInp = document.getElementById('dept-desc'); if (descInp) descInp.value = dept.description || '';
            if (deptFormTitle) deptFormTitle.innerHTML = '<i class="fa-solid fa-pen" style="color:var(--teal-600);"></i> Edit Department';
            if (deptSubmitText) deptSubmitText.textContent = 'Update Department';
            if (deptCancelEditBtn) deptCancelEditBtn.style.display = 'inline-block';
        };

        const resetDeptForm = () => {
            if (deptForm) deptForm.reset();
            if (deptEditId) deptEditId.value = '';
            if (deptFormTitle) deptFormTitle.innerHTML = '<i class="fa-solid fa-building" style="color:var(--teal-600);"></i> Add Department';
            if (deptSubmitText) deptSubmitText.textContent = 'Create Department';
            if (deptCancelEditBtn) deptCancelEditBtn.style.display = 'none';
        };

        if (deptCancelEditBtn) deptCancelEditBtn.addEventListener('click', resetDeptForm);

        if (deptForm) {
            deptForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const isEdit = deptEditId && deptEditId.value.trim() !== '';
                const id = isEdit ? deptEditId.value.trim() : null;
                const name = document.getElementById('dept-name').value.trim();
                const code = document.getElementById('dept-code').value.trim().toUpperCase();
                const description = document.getElementById('dept-desc').value.trim();

                try {
                    const url = isEdit ? `/api/v1/admin/employees/departments/${id}` : '/api/v1/admin/employees/departments';
                    const method = isEdit ? 'PUT' : 'POST';
                    const res = await fetch(url, {
                        method,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name, code, description })
                    });
                    const data = await res.json();
                    if (res.ok && data.success) {
                        resetDeptForm();
                        loadMetadata();
                    } else {
                        alert(data.message || "Failed to save department");
                    }
                } catch (err) {
                    console.error("Error saving department:", err);
                }
            });
        }

        window.deleteDepartment = async (id, name) => {
            if (confirm(`Are you sure you want to delete department "${name}"? Any linked designations will be deleted, and employees will be unassigned.`)) {
                try {
                    const res = await fetch(`/api/v1/admin/employees/departments/${id}`, { method: 'DELETE' });
                    const data = await res.json();
                    if (res.ok && data.success) {
                        loadMetadata();
                    } else {
                        alert(data.message || "Failed to delete department");
                    }
                } catch (err) {
                    console.error("Error deleting department:", err);
                }
            }
        };

        // Quick Add Department Form
        if (quickDeptForm) {
            quickDeptForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = document.getElementById('quick-dept-name').value.trim();
                const code = document.getElementById('quick-dept-code').value.trim().toUpperCase();
                const description = document.getElementById('quick-dept-desc').value.trim();

                try {
                    const res = await fetch('/api/v1/admin/employees/departments', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name, code, description })
                    });
                    const data = await res.json();
                    if (res.ok && data.success) {
                        await loadMetadata();
                        if (empDept && data.data && data.data.id) {
                            empDept.value = data.data.id;
                            window.updateDesignationOptions(data.data.id, empDesig ? empDesig.value : '');
                        }
                        window.closeQuickAddDeptModal();
                    } else {
                        alert(data.message || "Failed to create department");
                    }
                } catch (err) {
                    console.error("Error creating quick department:", err);
                }
            });
        }

        // ================= DESIGNATION CRUD =================
        window.editDesignation = (desig) => {
            if (desigEditId) desigEditId.value = desig.id;
            const titleInp = document.getElementById('desig-title'); if (titleInp) titleInp.value = desig.title || '';
            if (desigDept) desigDept.value = desig.department_id || '';
            const levelInp = document.getElementById('desig-level'); if (levelInp) levelInp.value = desig.level || '';
            if (desigFormTitle) desigFormTitle.innerHTML = '<i class="fa-solid fa-pen" style="color:var(--teal-600);"></i> Edit Designation';
            if (desigSubmitText) desigSubmitText.textContent = 'Update Designation';
            if (desigCancelEditBtn) desigCancelEditBtn.style.display = 'inline-block';
        };

        const resetDesigForm = () => {
            if (desigForm) desigForm.reset();
            if (desigEditId) desigEditId.value = '';
            if (desigFormTitle) desigFormTitle.innerHTML = '<i class="fa-solid fa-id-badge" style="color:var(--teal-600);"></i> Add Designation';
            if (desigSubmitText) desigSubmitText.textContent = 'Create Designation';
            if (desigCancelEditBtn) desigCancelEditBtn.style.display = 'none';
        };

        if (desigCancelEditBtn) desigCancelEditBtn.addEventListener('click', resetDesigForm);

        if (desigForm) {
            desigForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const isEdit = desigEditId && desigEditId.value.trim() !== '';
                const id = isEdit ? desigEditId.value.trim() : null;
                const title = document.getElementById('desig-title').value.trim();
                const departmentId = desigDept ? desigDept.value : '';
                const level = document.getElementById('desig-level').value.trim();

                try {
                    const url = isEdit ? `/api/v1/admin/employees/designations/${id}` : '/api/v1/admin/employees/designations';
                    const method = isEdit ? 'PUT' : 'POST';
                    const res = await fetch(url, {
                        method,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ title, departmentId, level: level ? parseInt(level, 10) : null })
                    });
                    const data = await res.json();
                    if (res.ok && data.success) {
                        resetDesigForm();
                        loadMetadata();
                    } else {
                        alert(data.message || "Failed to save designation");
                    }
                } catch (err) {
                    console.error("Error saving designation:", err);
                }
            });
        }

        window.deleteDesignation = async (id, title) => {
            if (confirm(`Are you sure you want to delete designation "${title}"?`)) {
                try {
                    const res = await fetch(`/api/v1/admin/employees/designations/${id}`, { method: 'DELETE' });
                    const data = await res.json();
                    if (res.ok && data.success) {
                        loadMetadata();
                    } else {
                        alert(data.message || "Failed to delete designation");
                    }
                } catch (err) {
                    console.error("Error deleting designation:", err);
                }
            }
        };

        // Quick Add Designation Form
        if (quickDesigForm) {
            quickDesigForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const title = document.getElementById('quick-desig-title').value.trim();
                const departmentId = quickDesigDept ? quickDesigDept.value : '';
                const level = document.getElementById('quick-desig-level').value.trim();

                if (!departmentId) {
                    alert("Please select a department for this designation.");
                    return;
                }

                try {
                    const res = await fetch('/api/v1/admin/employees/designations', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ title, departmentId, level: level ? parseInt(level, 10) : null })
                    });
                    const data = await res.json();
                    if (res.ok && data.success) {
                        await loadMetadata();
                        if (empDesig && data.data && data.data.id) {
                            window.updateDesignationOptions(departmentId, data.data.id);
                        }
                        window.closeQuickAddDesigModal();
                    } else {
                        alert(data.message || "Failed to create designation");
                    }
                } catch (err) {
                    console.error("Error creating quick designation:", err);
                }
            });
        }

        // ================= ORG CHART LOADING =================
        const loadOrgChart = async () => {
            const orgChartTree = document.getElementById('org-chart-tree');
            if (!orgChartTree) return;
            orgChartTree.innerHTML = '<div style="color:var(--text-muted);padding:10px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading hierarchy...</div>';

            try {
                const response = await fetch('/api/v1/organization/directory');
                const resData = await response.json();
                if (response.ok && resData.success) {
                    renderOrgChartTree(resData.data.employees);
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
                map[emp.id] = { ...emp, children: [] };
            });

            employees.forEach(emp => {
                if (emp.reporting_manager_id && map[emp.reporting_manager_id]) {
                    map[emp.reporting_manager_id].children.push(map[emp.id]);
                } else {
                    roots.push(map[emp.id]);
                }
            });

            if (roots.length === 0) {
                orgChartTree.innerHTML = '<div style="color:var(--text-muted);padding:10px;">No organization records found.</div>';
                return;
            }

            const buildHTML = (node) => {
                const avatarId = (node.id % 70) + 1;
                let childrenContainer = '';
                if (node.children && node.children.length > 0) {
                    childrenContainer = `
                        <div class="org-tree">
                            ${node.children.map(buildHTML).join('')}
                        </div>
                    `;
                }

                return `
                    <div class="org-tree-item">
                        <div class="org-node">
                            <img src="https://i.pravatar.cc/80?img=${avatarId}" alt="" class="org-node-avatar">
                            <div class="org-node-info">
                                <div class="name">${node.full_name}</div>
                                <div class="role">${node.designation_name || 'Team Member'}</div>
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

        // Filter listeners
        if (dirSearch) {
            dirSearch.addEventListener('input', debounce(loadAdminEmployees, 300));
        }
        if (dirDeptFilter) {
            dirDeptFilter.addEventListener('change', loadAdminEmployees);
        }

        // Initial Load on Admin
        loadMetadata();
        loadAdminEmployees();

    } else {
        // =========================================================================
        // EMPLOYEE SECTION & DIRECTORY VIEW
        // =========================================================================
        const directoryList = document.getElementById('directory-list');
        const btnDirectory = document.getElementById('btn-directory');
        const btnChat = document.getElementById('btn-chat');
        const directoryView = document.getElementById('directory-view');
        const chatView = document.getElementById('chat-view');
        const viewTitle = document.getElementById('view-title');

        if (btnDirectory && btnChat) {
            btnDirectory.addEventListener('click', () => {
                btnDirectory.classList.add('active');
                btnChat.classList.remove('active');
                if (directoryView) directoryView.style.display = 'block';
                if (chatView) chatView.style.display = 'none';
                if (viewTitle) viewTitle.textContent = 'Employee Directory';
                stopMessagePolling();
            });

            btnChat.addEventListener('click', () => {
                btnChat.classList.add('active');
                btnDirectory.classList.remove('active');
                if (directoryView) directoryView.style.display = 'none';
                if (chatView) chatView.style.display = 'block';
                if (viewTitle) viewTitle.textContent = 'Chat Room';
                loadChatContacts();

                fetch('/api/v1/employee/inbox/mark-read', { method: 'POST', credentials: 'include' })
                    .then(() => { if (typeof window.checkChatUnreadBadge === 'function') window.checkChatUnreadBadge(); })
                    .catch(() => {});
            });
        }

        const loadDirectory = async () => {
            const search = dirSearch ? dirSearch.value.trim() : '';
            const deptId = dirDeptFilter ? dirDeptFilter.value : '';
            
            try {
                const response = await fetch(`/api/v1/organization/directory?search=${encodeURIComponent(search)}&departmentId=${deptId}`);
                const resData = await response.json();
                
                if (response.ok && resData.success) {
                    renderDirectoryTable(resData.data.employees);
                    if (dirDeptFilter && dirDeptFilter.options.length === 1 && resData.data.departments) {
                        resData.data.departments.forEach(dept => {
                            const opt = document.createElement('option');
                            opt.value = dept.id;
                            opt.textContent = dept.name;
                            dirDeptFilter.appendChild(opt);
                        });
                    }
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

        if (dirSearch) {
            dirSearch.addEventListener('input', debounce(loadDirectory, 300));
        }
        if (dirDeptFilter) {
            dirDeptFilter.addEventListener('change', loadDirectory);
        }

        loadDirectory();
    }

    // =========================================================================
    // CHAT SYSTEM (FOR CHAT ROOM IF APPLICABLE)
    // =========================================================================
    let chatContacts = [];
    let selectedContact = null;
    let chatInterval = null;
    let currentUserId = null;

    async function fetchCurrentUser() {
        try {
            const res = await fetch('/api/v1/auth/me');
            const data = await res.json();
            if (data.success && data.data) {
                currentUserId = data.data.employee_id || data.data.id;
            }
        } catch (e) {}
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

        // Direct Messages
        const dmHeader = document.createElement('div');
        dmHeader.style.cssText = 'font-size:11px; font-weight:800; color:var(--teal-900); text-transform:uppercase; margin:10px 0 6px 4px;';
        dmHeader.innerHTML = '<i class="fa-solid fa-user"></i> Direct Messages';
        list.appendChild(dmHeader);

        (chatChannels.directMessages || []).forEach(c => {
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

        // Task Groups
        if (chatChannels.taskGroups && chatChannels.taskGroups.length > 0) {
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

        // Department Channels
        if (chatChannels.departmentChannels && chatChannels.departmentChannels.length > 0) {
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

        const emptyEl = document.getElementById('chat-thread-empty'); if (emptyEl) emptyEl.style.display = 'none';
        const activeEl = document.getElementById('chat-thread-active'); if (activeEl) activeEl.style.display = 'flex';

        const nameEl = document.getElementById('chat-header-name'); if (nameEl) nameEl.textContent = title;
        const statusEl = document.getElementById('chat-header-status'); if (statusEl) statusEl.textContent = subtitle;

        loadMessages();
        startMessagePolling();

        try {
            const readUrl = type === 'DM' ? `/api/v1/chat/channels/0/read?contactId=${id}` : `/api/v1/chat/channels/${id}/read`;
            await fetch(readUrl, { method: 'POST' });
            if (typeof window.checkChatUnreadBadge === 'function') window.checkChatUnreadBadge();
        } catch (e) {}
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

    const formatFileSize = (bytes) => {
        if (!bytes) return '';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    };

    const getFileIcon = (type, name) => {
        if (!type && !name) return 'fa-solid fa-file';
        const ext = (name || '').split('.').pop().toLowerCase();
        if (/^image\//.test(type) || ['jpg','jpeg','png','gif','webp','svg'].includes(ext)) return 'fa-solid fa-image';
        if (type === 'application/pdf' || ext === 'pdf') return 'fa-solid fa-file-pdf';
        if (/zip|rar|7z|tar|gz/.test(ext)) return 'fa-solid fa-file-zipper';
        if (/doc|docx/.test(ext)) return 'fa-solid fa-file-word';
        if (/xls|xlsx/.test(ext)) return 'fa-solid fa-file-excel';
        if (/ppt|pptx/.test(ext)) return 'fa-solid fa-file-powerpoint';
        return 'fa-solid fa-file';
    };

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
            outerDiv.style.cssText = `display:flex; flex-direction:column; align-items: ${isMe ? 'flex-end' : 'flex-start'}; width:100%; margin-bottom:10px;`;

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

            let bubbleContent = senderHeader + `<span>${text}</span>`;
            bubble.innerHTML = bubbleContent;

            const infoDiv = document.createElement('div');
            infoDiv.style.cssText = `font-size:10px; color:var(--text-muted); margin-top:3px; margin-left:4px; margin-right:4px;`;
            infoDiv.textContent = time;

            outerDiv.appendChild(bubble);
            outerDiv.appendChild(infoDiv);
            container.appendChild(outerDiv);
        });

        if (isNearBottom || container.scrollTop === 0) {
            container.scrollTop = container.scrollHeight;
        }
    };

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

    const sendBtn = document.getElementById('btn-chat-send');
    const msgInput = document.getElementById('chat-message-input');
    if (sendBtn) sendBtn.addEventListener('click', sendChatMessage);
    if (msgInput) {
        msgInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') sendChatMessage();
        });
    }
});
