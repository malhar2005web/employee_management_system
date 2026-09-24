document.addEventListener('DOMContentLoaded', () => {
    let allCompanies = [];
    let currentFilter = 'all';

    // DOM Elements
    const kpiTotal = document.getElementById('kpi-total-companies');
    const kpiActive = document.getElementById('kpi-active-companies');
    const kpiDbs = document.getElementById('kpi-provisioned-dbs');
    const tableBody = document.getElementById('companies-table-body');
    const searchInput = document.getElementById('input-search-companies');
    const filterBtns = document.querySelectorAll('.filter-btn');

    // Modals
    const modalProvision = document.getElementById('modal-provision');
    const btnOpenProvision = document.getElementById('btn-open-provision');
    const formProvision = document.getElementById('form-provision-company');
    const inputCompCode = document.getElementById('new-comp-code');
    const previewDbName = document.getElementById('preview-db-name');
    const btnGenPass = document.getElementById('btn-generate-password');
    const inputAdmPass = document.getElementById('new-adm-pass');
    const provisionProgress = document.getElementById('provision-progress-box');
    const provisionError = document.getElementById('provision-alert-error');
    const provisionSuccess = document.getElementById('provision-alert-success');
    const btnSubmitProvision = document.getElementById('btn-submit-provision');

    // Edit Modal
    const modalEdit = document.getElementById('modal-edit-modules');
    const formEdit = document.getElementById('form-edit-modules');
    const editCompTitle = document.getElementById('edit-comp-title');
    const editCompId = document.getElementById('edit-company-id');
    const editError = document.getElementById('edit-alert-error');
    const editSuccess = document.getElementById('edit-alert-success');
    const btnSaveModules = document.getElementById('btn-save-modules');

    // ================= 1. FETCH & RENDER STATS =================
    async function fetchStats() {
        try {
            const res = await fetch('/api/v1/super-admin/stats');
            const data = await res.json();
            if (data.success && data.stats) {
                if (kpiTotal) kpiTotal.textContent = data.stats.totalCompanies || 0;
                if (kpiActive) kpiActive.textContent = data.stats.activeCompanies || 0;
                if (kpiDbs) kpiDbs.textContent = data.stats.provisionedDbs || 0;
            }
        } catch (err) {
            console.error('Failed to load stats:', err);
        }
    }

    // ================= 2. FETCH & RENDER COMPANIES =================
    async function fetchCompanies() {
        try {
            const res = await fetch('/api/v1/super-admin/companies');
            const data = await res.json();
            if (data.success && Array.isArray(data.companies)) {
                allCompanies = data.companies;
                renderCompaniesTable();
            } else {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align:center; padding: 30px; color:#fca5a5;">
                            Failed to load companies: ${data.message || 'Unknown error'}
                        </td>
                    </tr>
                `;
            }
        } catch (err) {
            console.error('Failed to load companies:', err);
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align:center; padding: 30px; color:#fca5a5;">
                        Failed to connect to server. Please try again.
                    </td>
                </tr>
            `;
        }
    }

    function renderCompaniesTable() {
        const query = (searchInput?.value || '').toLowerCase().trim();

        const filtered = allCompanies.filter(comp => {
            const matchesStatus = 
                currentFilter === 'all' ? true :
                currentFilter === 'active' ? comp.status === 'ACTIVE' :
                currentFilter === 'suspended' ? comp.status === 'SUSPENDED' : true;

            const name = (comp.company_name || '').toLowerCase();
            const code = (comp.company_code || '').toLowerCase();
            const email = (comp.admin_email || '').toLowerCase();
            const db = (comp.db_name || '').toLowerCase();

            const matchesSearch = !query || name.includes(query) || code.includes(query) || email.includes(query) || db.includes(query);

            return matchesStatus && matchesSearch;
        });

        if (filtered.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-muted);">
                        <i class="fa-solid fa-folder-open" style="font-size: 26px; margin-bottom: 8px; opacity: 0.5;"></i>
                        <div>No companies matching the current filter.</div>
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = filtered.map(comp => {
            const adminMods = Array.isArray(comp.admin_modules) ? comp.admin_modules : [];
            const empMods = Array.isArray(comp.employee_modules) ? comp.employee_modules : [];
            const initials = (comp.company_name || 'EM').slice(0, 2).toUpperCase();
            const tempPass = comp.admin_temp_password || 'Penta@123';
            const isActive = comp.status === 'ACTIVE';

            return `
                <tr>
                    <td>
                        <div class="comp-avatar-pill">
                            <div class="avatar-circ">${initials}</div>
                            <div class="comp-meta">
                                <div class="c-title">${escapeHtml(comp.company_name)}</div>
                                <div class="c-slug">
                                    <i class="fa-solid fa-hashtag" style="font-size:10px;"></i> ${escapeHtml(comp.company_code)}
                                    <span style="opacity:0.4;">•</span>
                                    <span>${escapeHtml(comp.subdomain || comp.company_code)}.ems</span>
                                </div>
                            </div>
                        </div>
                    </td>
                    <td>
                        <span class="db-code-badge">
                            <i class="fa-solid fa-database"></i> ${escapeHtml(comp.db_name)}
                        </span>
                    </td>
                    <td>
                        <div class="admin-info-col">
                            <div class="adm-head">${escapeHtml(comp.admin_name || 'Master Admin')}</div>
                            <div class="adm-mail">${escapeHtml(comp.admin_email || '—')}</div>
                            <div class="pass-pill-box" title="Temporary Password">
                                <i class="fa-solid fa-key" style="font-size:10px;"></i>
                                <span class="pass-val">${escapeHtml(tempPass)}</span>
                                <button type="button" class="pass-copy-btn" data-copy="${escapeHtml(tempPass)}" title="Copy password">
                                    <i class="fa-regular fa-copy"></i>
                                </button>
                            </div>
                            <div style="margin-top: 6px; display: flex; gap: 6px; align-items: center;">
                                <span style="font-size: 11px; font-weight: 700; color: #0f766e; background: rgba(15, 118, 110, 0.1); border: 1px solid rgba(15, 118, 110, 0.2); padding: 2px 7px; border-radius: 4px;" title="Admins">
                                    <i class="fa-solid fa-user-shield"></i> Admin: ${comp.admin_count !== undefined ? comp.admin_count : 1}
                                </span>
                                <span style="font-size: 11px; font-weight: 700; color: #475569; background: rgba(100, 116, 139, 0.1); border: 1px solid rgba(100, 116, 139, 0.2); padding: 2px 7px; border-radius: 4px;" title="Created Employees">
                                    <i class="fa-solid fa-users"></i> Employees: ${comp.employee_count !== undefined ? comp.employee_count : 0}
                                </span>
                            </div>
                        </div>
                    </td>
                    <td>
                        <div class="mod-pill-group">
                            <span class="mod-pill admin-badge" title="Enabled Admin Features">
                                <i class="fa-solid fa-sliders"></i> Admin: ${adminMods.length}/8 active
                            </span>
                            <span class="mod-pill emp-badge" title="Enabled Employee Features">
                                <i class="fa-solid fa-cubes"></i> Staff: ${empMods.length}/6 active
                            </span>
                        </div>
                    </td>
                    <td>
                        <span class="stat-pill ${isActive ? 'active' : 'suspended'}">
                            <span class="status-dot"></span>
                            ${isActive ? 'Active' : 'Suspended'}
                        </span>
                    </td>
                    <td style="text-align: right;">
                        <div class="row-actions">
                            <button type="button" class="btn-action-icon btn-edit-modules" data-id="${comp.id}" title="Manage Modules">
                                <i class="fa-solid fa-sliders"></i>
                            </button>
                            <button type="button" class="btn-action-icon ${isActive ? 'danger' : ''} btn-toggle-status" data-id="${comp.id}" data-status="${isActive ? 'SUSPENDED' : 'ACTIVE'}" title="${isActive ? 'Suspend Organization' : 'Activate Organization'}">
                                <i class="fa-solid ${isActive ? 'fa-pause' : 'fa-play'}"></i>
                            </button>
                            <button type="button" class="btn-action-icon danger btn-delete-company" data-id="${comp.id}" data-name="${escapeHtml(comp.company_name)}" data-code="${escapeHtml(comp.company_code)}" data-db="${escapeHtml(comp.db_name)}" title="${(comp.company_code || '').toLowerCase() === 'pcs' ? 'Protected Root Tenant' : 'Delete Organization & Database'}" ${(comp.company_code || '').toLowerCase() === 'pcs' ? 'disabled style="opacity:0.35; cursor:not-allowed;"' : ''}>
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                            <a href="/login.html" target="_blank" class="btn-action-icon" title="Open Tenant Portal">
                                <i class="fa-solid fa-arrow-up-right-from-square"></i>
                            </a>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Wire copy password buttons
        document.querySelectorAll('.pass-copy-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const pass = btn.getAttribute('data-copy');
                if (pass) {
                    navigator.clipboard.writeText(pass);
                    const originalIcon = btn.innerHTML;
                    btn.innerHTML = `<i class="fa-solid fa-check" style="color:#10b981;"></i>`;
                    setTimeout(() => { btn.innerHTML = originalIcon; }, 1500);
                }
            });
        });

        // Wire Edit Modules buttons
        document.querySelectorAll('.btn-edit-modules').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const comp = allCompanies.find(c => String(c.id) === String(id));
                if (comp) openEditModulesModal(comp);
            });
        });

        // Wire Toggle Status buttons
        document.querySelectorAll('.btn-toggle-status').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                const nextStatus = btn.getAttribute('data-status');
                const comp = allCompanies.find(c => String(c.id) === String(id));
                const confirmMsg = nextStatus === 'SUSPENDED' 
                    ? `Are you sure you want to suspend organization '${comp?.company_name}'? Users will not be able to log in.`
                    : `Activate organization '${comp?.company_name}'?`;

                if (confirm(confirmMsg)) {
                    await toggleCompanyStatus(id, nextStatus);
                }
            });
        });

        // Wire Delete Organization buttons
        document.querySelectorAll('.btn-delete-company').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = btn.getAttribute('data-id');
                const name = btn.getAttribute('data-name');
                const code = btn.getAttribute('data-code');
                const db = btn.getAttribute('data-db');

                if ((code || '').toLowerCase() === 'pcs') {
                    alert('PCS Enterprise is the protected root tenant and cannot be deleted.');
                    return;
                }

                const confirmed = confirm(
                    `⚠️ PERMANENT DELETION WARNING\n\n` +
                    `Are you sure you want to permanently delete '${name}' [${code}]?\n\n` +
                    `• PostgreSQL Database '${db}' will be completely DROPPED.\n` +
                    `• All employee records, attendance, tasks, and credentials will be permanently wiped.\n\n` +
                    `This action CANNOT be undone.\n\nClick OK to permanently delete.`
                );

                if (!confirmed) return;

                const origHtml = btn.innerHTML;
                btn.disabled = true;
                btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;

                try {
                    const res = await fetch(`/api/v1/super-admin/companies/${id}`, {
                        method: 'DELETE'
                    });
                    const data = await res.json();

                    if (res.ok && data.success) {
                        alert(`✅ ${data.message}`);
                        await fetchStats();
                        await fetchCompanies();
                    } else {
                        alert(data.message || 'Failed to delete company.');
                        btn.disabled = false;
                        btn.innerHTML = origHtml;
                    }
                } catch (err) {
                    console.error('Delete company error:', err);
                    alert('Network error while deleting company. Please try again.');
                    btn.disabled = false;
                    btn.innerHTML = origHtml;
                }
            });
        });
    }

    // ================= 3. FILTER & SEARCH HANDLERS =================
    if (searchInput) {
        searchInput.addEventListener('input', renderCompaniesTable);
    }

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.getAttribute('data-filter') || 'all';
            renderCompaniesTable();
        });
    });

    // ================= 4. TOGGLE ALL CHECKBOXES =================
    document.querySelectorAll('.matrix-toggle-all').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-target');
            let checkboxes = [];
            if (target === 'admin-modules') checkboxes = document.querySelectorAll('input[name="admin_mod"]');
            else if (target === 'employee-modules') checkboxes = document.querySelectorAll('input[name="emp_mod"]');
            else if (target === 'edit-admin-modules') checkboxes = document.querySelectorAll('input[name="edit_admin_mod"]');
            else if (target === 'edit-employee-modules') checkboxes = document.querySelectorAll('input[name="edit_emp_mod"]');

            const allChecked = Array.from(checkboxes).every(cb => cb.checked);
            checkboxes.forEach(cb => cb.checked = !allChecked);
        });
    });

    // ================= 5. LIVE CODE / DB PREVIEW & PASS GENERATOR =================
    if (inputCompCode) {
        inputCompCode.addEventListener('input', () => {
            const clean = inputCompCode.value.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
            inputCompCode.value = clean;
            if (previewDbName) {
                previewDbName.textContent = clean ? `Database will be: ems_${clean}` : 'Database will be: ems_...';
            }
        });
    }

    if (btnGenPass) {
        btnGenPass.addEventListener('click', () => {
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
            let pass = 'Penta@';
            for (let i = 0; i < 6; i++) {
                pass += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            if (inputAdmPass) inputAdmPass.value = pass;
        });
    }

    // Auto-generate on load if empty
    if (btnGenPass && inputAdmPass && !inputAdmPass.value) {
        btnGenPass.click();
    }

    // ================= 6. PROVISION FORM SUBMIT =================
    if (btnOpenProvision) {
        btnOpenProvision.addEventListener('click', () => {
            if (formProvision) formProvision.reset();
            if (btnGenPass) btnGenPass.click();
            if (provisionError) provisionError.style.display = 'none';
            if (provisionSuccess) provisionSuccess.style.display = 'none';
            if (provisionProgress) provisionProgress.classList.remove('active');
            if (btnSubmitProvision) {
                btnSubmitProvision.disabled = false;
                btnSubmitProvision.innerHTML = `<i class="fa-solid fa-database"></i> Provision Tenant`;
            }
            modalProvision.classList.add('active');
        });
    }

    if (formProvision) {
        formProvision.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (provisionError) provisionError.style.display = 'none';
            if (provisionSuccess) provisionSuccess.style.display = 'none';

            const companyName = document.getElementById('new-comp-name').value.trim();
            const companyCode = document.getElementById('new-comp-code').value.trim();
            const adminFullName = document.getElementById('new-adm-name').value.trim();
            const email = document.getElementById('new-adm-email').value.trim();
            const password = document.getElementById('new-adm-pass').value.trim();

            const adminModules = Array.from(document.querySelectorAll('input[name="admin_mod"]:checked')).map(cb => cb.value);
            const employeeModules = Array.from(document.querySelectorAll('input[name="emp_mod"]:checked')).map(cb => cb.value);

            if (!companyName || !companyCode || !adminFullName || !email || !password) {
                showModalAlert(provisionError, 'Please fill in all required fields.');
                return;
            }

            // Start live provisioning indicator
            if (provisionProgress) provisionProgress.classList.add('active');
            if (btnSubmitProvision) {
                btnSubmitProvision.disabled = true;
                btnSubmitProvision.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Provisioning...`;
            }

            try {
                const res = await fetch('/api/v1/super-admin/companies', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        companyName,
                        companyCode,
                        adminFullName,
                        email,
                        password,
                        adminModules,
                        employeeModules
                    })
                });

                const data = await res.json();

                if (res.ok && data.success) {
                    showModalAlert(provisionSuccess, `🎉 ${data.message}`);
                    setTimeout(async () => {
                        modalProvision.classList.remove('active');
                        await fetchStats();
                        await fetchCompanies();
                    }, 1800);
                } else {
                    showModalAlert(provisionError, data.message || 'Failed to provision company.');
                }
            } catch (err) {
                console.error('Provisioning error:', err);
                showModalAlert(provisionError, 'Server communication error. Please check backend logs.');
            } finally {
                if (provisionProgress) provisionProgress.classList.remove('active');
                if (btnSubmitProvision) {
                    btnSubmitProvision.disabled = false;
                    btnSubmitProvision.innerHTML = `<i class="fa-solid fa-database"></i> Provision Tenant`;
                }
            }
        });
    }

    // ================= 7. EDIT MODULES MODAL =================
    function openEditModulesModal(comp) {
        if (!modalEdit) return;
        if (editError) editError.style.display = 'none';
        if (editSuccess) editSuccess.style.display = 'none';

        if (editCompTitle) editCompTitle.textContent = comp.company_name;
        if (editCompId) editCompId.value = comp.id;

        const adminMods = Array.isArray(comp.admin_modules) ? comp.admin_modules : [];
        const empMods = Array.isArray(comp.employee_modules) ? comp.employee_modules : [];

        document.querySelectorAll('input[name="edit_admin_mod"]').forEach(cb => {
            cb.checked = adminMods.includes(cb.value);
        });

        document.querySelectorAll('input[name="edit_emp_mod"]').forEach(cb => {
            cb.checked = empMods.includes(cb.value);
        });

        modalEdit.classList.add('active');
    }

    if (formEdit) {
        formEdit.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (editError) editError.style.display = 'none';
            if (editSuccess) editSuccess.style.display = 'none';

            const id = editCompId.value;
            const adminModules = Array.from(document.querySelectorAll('input[name="edit_admin_mod"]:checked')).map(cb => cb.value);
            const employeeModules = Array.from(document.querySelectorAll('input[name="edit_emp_mod"]:checked')).map(cb => cb.value);

            if (btnSaveModules) {
                btnSaveModules.disabled = true;
                btnSaveModules.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving...`;
            }

            try {
                const res = await fetch(`/api/v1/super-admin/companies/${id}/modules`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ adminModules, employeeModules })
                });

                const data = await res.json();

                if (res.ok && data.success) {
                    showModalAlert(editSuccess, 'Modules updated successfully!');
                    // Update local cache
                    const idx = allCompanies.findIndex(c => String(c.id) === String(id));
                    if (idx !== -1) {
                        allCompanies[idx].admin_modules = adminModules;
                        allCompanies[idx].employee_modules = employeeModules;
                    }
                    renderCompaniesTable();

                    setTimeout(() => {
                        modalEdit.classList.remove('active');
                    }, 1200);
                } else {
                    showModalAlert(editError, data.message || 'Failed to update modules.');
                }
            } catch (err) {
                console.error('Update modules error:', err);
                showModalAlert(editError, 'Network error. Please try again.');
            } finally {
                if (btnSaveModules) {
                    btnSaveModules.disabled = false;
                    btnSaveModules.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Save Module Changes`;
                }
            }
        });
    }

    // ================= 8. TOGGLE STATUS (ACTIVE / SUSPENDED) =================
    async function toggleCompanyStatus(id, newStatus) {
        try {
            const res = await fetch(`/api/v1/super-admin/companies/${id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                const idx = allCompanies.findIndex(c => String(c.id) === String(id));
                if (idx !== -1) {
                    allCompanies[idx].status = newStatus;
                }
                await fetchStats();
                renderCompaniesTable();
            } else {
                alert(data.message || 'Failed to update status.');
            }
        } catch (err) {
            console.error('Status toggle error:', err);
            alert('Failed to connect to server.');
        }
    }

    // ================= 9. CLOSE MODALS =================
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', () => {
            const modalId = btn.getAttribute('data-close-modal');
            const target = document.getElementById(modalId);
            if (target) target.classList.remove('active');
        });
    });

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.classList.remove('active');
        });
    });

    // ================= 10. LOGOUT =================
    const btnSuperLogout = document.getElementById('btn-super-logout');
    if (btnSuperLogout) {
        btnSuperLogout.addEventListener('click', () => {
            window.location.href = '/login.html';
        });
    }

    // Helper functions
    function showModalAlert(elem, msg) {
        if (!elem) return;
        elem.textContent = msg;
        elem.style.display = 'block';
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Initial Load
    fetchStats();
    fetchCompanies();
});
