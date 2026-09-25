document.addEventListener('DOMContentLoaded', () => {
    let allCompanies = [];
    let currentFilter = 'all';
    let allCredentials = [];
    let currentCredFilter = 'all';

    // DOM Elements
    const kpiTotal = document.getElementById('kpi-total-companies');
    const kpiActive = document.getElementById('kpi-active-companies');
    const kpiDbs = document.getElementById('kpi-provisioned-dbs');
    const kpiVaultAdmins = document.getElementById('kpi-vault-admins');
    const badgeVaultCount = document.getElementById('badge-vault-count');
    const tableBody = document.getElementById('companies-table-body');
    const searchInput = document.getElementById('input-search-companies');
    const credTableBody = document.getElementById('credentials-table-body');
    const searchCredInput = document.getElementById('input-search-credentials');
    const tabNavCompanies = document.getElementById('tab-nav-companies');
    const tabNavCredentials = document.getElementById('tab-nav-credentials');
    const secCompanies = document.getElementById('section-companies-table');
    const secCredentials = document.getElementById('section-credentials-vault');
    const btnSyncVault = document.getElementById('btn-sync-vault');
    const filterBtns = document.querySelectorAll('.filter-tab-btn');
    const filterCredBtns = document.querySelectorAll('.filter-cred-tab');

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

    // Reset Password Modal
    const modalResetPassword = document.getElementById('modal-reset-password');
    const formResetPassword = document.getElementById('form-reset-password');
    const resetCredId = document.getElementById('reset-cred-id');
    const resetCompanyName = document.getElementById('reset-company-name');
    const resetAdminEmail = document.getElementById('reset-admin-email');
    const inputNewPassword = document.getElementById('input-new-password');
    const btnGenResetPass = document.getElementById('btn-gen-reset-password');
    const resetAlertError = document.getElementById('reset-alert-error');
    const resetAlertSuccess = document.getElementById('reset-alert-success');
    const btnSaveResetPass = document.getElementById('btn-save-reset-password');

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
                            <a href="/login.html?org=${encodeURIComponent(comp.company_code)}&switch=1" target="_blank" class="btn-action-icon" title="Open ${escapeHtml(comp.company_name)} Login Portal">
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
                        await fetchAdminCredentials();
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
                        await fetchAdminCredentials();
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

    // ================= 11. TAB VIEW SWITCHER =================
    if (tabNavCompanies && tabNavCredentials && secCompanies && secCredentials) {
        tabNavCompanies.addEventListener('click', () => {
            tabNavCompanies.style.background = 'var(--teal-900)';
            tabNavCompanies.style.color = '#ffffff';
            tabNavCompanies.style.borderColor = 'rgba(15,118,110,0.3)';

            tabNavCredentials.style.background = '#ffffff';
            tabNavCredentials.style.color = 'var(--text-dark)';
            tabNavCredentials.style.borderColor = 'rgba(203,213,225,0.8)';

            secCompanies.style.display = 'block';
            secCredentials.style.display = 'none';
        });

        tabNavCredentials.addEventListener('click', () => {
            tabNavCredentials.style.background = 'var(--teal-900)';
            tabNavCredentials.style.color = '#ffffff';
            tabNavCredentials.style.borderColor = 'rgba(15,118,110,0.3)';

            tabNavCompanies.style.background = '#ffffff';
            tabNavCompanies.style.color = 'var(--text-dark)';
            tabNavCompanies.style.borderColor = 'rgba(203,213,225,0.8)';

            secCompanies.style.display = 'none';
            secCredentials.style.display = 'block';

            if (allCredentials.length === 0) {
                fetchAdminCredentials();
            }
        });
    }

    // ================= 12. FETCH & RENDER ADMIN CREDENTIALS VAULT =================
    async function fetchAdminCredentials() {
        if (!credTableBody) return;
        try {
            const res = await fetch('/api/v1/super-admin/admin-credentials');
            const data = await res.json();
            if (data.success && Array.isArray(data.credentials)) {
                allCredentials = data.credentials;
                if (kpiVaultAdmins) kpiVaultAdmins.textContent = allCredentials.length;
                if (badgeVaultCount) badgeVaultCount.textContent = allCredentials.length;
                renderCredentialsTable();
            } else {
                credTableBody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align:center; padding: 30px; color:#fca5a5;">
                            Failed to load credentials: ${data.message || 'Unknown error'}
                        </td>
                    </tr>
                `;
            }
        } catch (err) {
            console.error('Failed to load credentials vault:', err);
            credTableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align:center; padding: 30px; color:#fca5a5;">
                        Failed to connect to server. Please try again.
                    </td>
                </tr>
            `;
        }
    }

    function renderCredentialsTable() {
        if (!credTableBody) return;
        const query = (searchCredInput?.value || '').toLowerCase().trim();

        const filtered = allCredentials.filter(cred => {
            const matchesStatus = 
                currentCredFilter === 'all' ? true :
                currentCredFilter === 'active' ? (cred.status || 'ACTIVE') === 'ACTIVE' : true;

            const compName = (cred.company_name || '').toLowerCase();
            const compCode = (cred.company_code || '').toLowerCase();
            const admName = (cred.admin_name || '').toLowerCase();
            const admEmail = (cred.admin_email || '').toLowerCase();
            const dbName = (cred.db_name || '').toLowerCase();

            const matchesSearch = !query || 
                compName.includes(query) || 
                compCode.includes(query) || 
                admName.includes(query) || 
                admEmail.includes(query) || 
                dbName.includes(query);

            return matchesStatus && matchesSearch;
        });

        if (filtered.length === 0) {
            credTableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">
                        <i class="fa-solid fa-key" style="font-size: 26px; margin-bottom: 8px; opacity: 0.5; color: #d97706;"></i>
                        <div>No admin credentials found matching the search.</div>
                    </td>
                </tr>
            `;
            return;
        }

        credTableBody.innerHTML = filtered.map(cred => {
            const initials = (cred.company_name || 'CO').slice(0, 2).toUpperCase();
            const pass = cred.plain_password || 'Admin@123';
            const portalUrl = cred.login_url || `/login.html?org=${encodeURIComponent(cred.company_code)}&switch=1`;

            return `
                <tr>
                    <td>
                        <div class="comp-avatar-pill">
                            <div class="avatar-circ">${initials}</div>
                            <div class="comp-meta">
                                <div class="c-title">${escapeHtml(cred.company_name)}</div>
                                <div class="c-slug">
                                    <i class="fa-solid fa-hashtag" style="font-size:10px;"></i> ${escapeHtml(cred.company_code)}
                                </div>
                            </div>
                        </div>
                    </td>
                    <td>
                        <span class="db-code-badge">
                            <i class="fa-solid fa-database"></i> ${escapeHtml(cred.db_name)}
                        </span>
                    </td>
                    <td>
                        <div style="font-weight: 700; color: var(--text-dark);">${escapeHtml(cred.admin_name || 'Admin')}</div>
                        <span style="font-size: 11px; font-weight: 700; color: #0f766e; background: rgba(15, 118, 110, 0.1); border: 1px solid rgba(15, 118, 110, 0.2); padding: 2px 6px; border-radius: 4px;">
                            ${escapeHtml(cred.role || 'Admin')}
                        </span>
                    </td>
                    <td>
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <span style="font-size: 13.5px; font-weight: 600; color: var(--text-dark);">${escapeHtml(cred.admin_email)}</span>
                            <button type="button" class="pass-copy-btn" data-copy="${escapeHtml(cred.admin_email)}" title="Copy Email" style="width:26px; height:26px; border-radius:6px; border:1px solid rgba(203,213,225,0.7); background:#fff; cursor:pointer;">
                                <i class="fa-regular fa-copy" style="font-size:11px;"></i>
                            </button>
                        </div>
                    </td>
                    <td>
                        <div class="pass-pill-box" style="display:inline-flex; align-items:center; gap:8px; background:rgba(255,255,255,0.85); border:1px solid rgba(203,213,225,0.9); padding:5px 10px; border-radius:8px;">
                            <i class="fa-solid fa-key" style="font-size:11px; color:#d97706;"></i>
                            <span class="vault-pass-val" data-raw-pass="${escapeHtml(pass)}" style="font-family: monospace; font-size: 13.5px; font-weight: 700; color: #1e293b; letter-spacing: 1px;">••••••••</span>
                            <button type="button" class="btn-toggle-eye" title="Show / Hide Password" style="background:none; border:none; color:var(--text-muted); cursor:pointer; padding:2px 4px;">
                                <i class="fa-regular fa-eye"></i>
                            </button>
                            <button type="button" class="pass-copy-btn" data-copy="${escapeHtml(pass)}" title="Copy Password" style="background:none; border:none; color:var(--teal-900); cursor:pointer; padding:2px 4px;">
                                <i class="fa-regular fa-copy"></i>
                            </button>
                        </div>
                    </td>
                    <td>
                        <a href="${escapeHtml(portalUrl)}" target="_blank" style="display:inline-flex; align-items:center; gap:6px; font-size:12.5px; font-weight:700; color:#0f766e; text-decoration:none; background:rgba(15,118,110,0.08); border:1px solid rgba(15,118,110,0.2); padding:5px 10px; border-radius:6px; transition:all 0.15s;">
                            <span>Open Login</span>
                            <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:10px;"></i>
                        </a>
                    </td>
                    <td style="text-align: right;">
                        <button type="button" class="btn-action-icon btn-open-reset-pass" data-id="${cred.id}" data-name="${escapeHtml(cred.admin_name)}" data-email="${escapeHtml(cred.admin_email)}" data-company="${escapeHtml(cred.company_name)}" title="Reset / Change Password" style="border-color:#d97706; color:#d97706;">
                            <i class="fa-solid fa-key"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        // Wire Eye Toggle buttons
        document.querySelectorAll('.btn-toggle-eye').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const container = btn.closest('.pass-pill-box');
                const span = container ? container.querySelector('.vault-pass-val') : null;
                const icon = btn.querySelector('i');
                if (span && icon) {
                    const raw = span.getAttribute('data-raw-pass');
                    if (span.textContent === '••••••••') {
                        span.textContent = raw;
                        icon.classList.remove('fa-eye');
                        icon.classList.add('fa-eye-slash');
                    } else {
                        span.textContent = '••••••••';
                        icon.classList.remove('fa-eye-slash');
                        icon.classList.add('fa-eye');
                    }
                }
            });
        });

        // Wire Copy buttons in Vault
        document.querySelectorAll('.pass-copy-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const val = btn.getAttribute('data-copy');
                if (val) {
                    navigator.clipboard.writeText(val);
                    const originalHtml = btn.innerHTML;
                    btn.innerHTML = '<i class="fa-solid fa-check" style="color:#059669;"></i>';
                    setTimeout(() => {
                        btn.innerHTML = originalHtml;
                    }, 1500);
                }
            });
        });

        // Wire Open Reset Password Modal buttons
        document.querySelectorAll('.btn-open-reset-pass').forEach(btn => {
            btn.addEventListener('click', () => {
                const credId = btn.getAttribute('data-id');
                const compName = btn.getAttribute('data-company');
                const email = btn.getAttribute('data-email');
                const name = btn.getAttribute('data-name');

                if (resetCredId) resetCredId.value = credId;
                if (resetCompanyName) resetCompanyName.textContent = `${compName} (${name})`;
                if (resetAdminEmail) resetAdminEmail.textContent = email;
                if (inputNewPassword) inputNewPassword.value = '';
                if (resetAlertError) resetAlertError.style.display = 'none';
                if (resetAlertSuccess) resetAlertSuccess.style.display = 'none';

                if (modalResetPassword) modalResetPassword.classList.add('active');
            });
        });
    }

    // ================= 13. RESET PASSWORD HANDLERS =================
    if (btnGenResetPass && inputNewPassword) {
        btnGenResetPass.addEventListener('click', () => {
            const randomSuffix = Math.random().toString(36).substring(2, 6);
            inputNewPassword.value = `Penta@${randomSuffix}9`;
        });
    }

    if (formResetPassword) {
        formResetPassword.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (resetAlertError) resetAlertError.style.display = 'none';
            if (resetAlertSuccess) resetAlertSuccess.style.display = 'none';

            const credId = resetCredId?.value;
            const newPassword = inputNewPassword?.value?.trim();

            if (!credId || !newPassword) {
                showModalAlert(resetAlertError, 'Please enter or generate a new password.');
                return;
            }

            if (btnSaveResetPass) {
                btnSaveResetPass.disabled = true;
                btnSaveResetPass.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating Password...';
            }

            try {
                const res = await fetch(`/api/v1/super-admin/admin-credentials/${credId}/reset-password`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ new_password: newPassword })
                });

                const data = await res.json();
                if (res.ok && data.success) {
                    showModalAlert(resetAlertSuccess, `Password successfully changed to: ${data.plain_password}`);
                    await fetchAdminCredentials();
                    await fetchCompanies();
                    setTimeout(() => {
                        modalResetPassword?.classList.remove('active');
                    }, 1400);
                } else {
                    showModalAlert(resetAlertError, data.message || 'Failed to reset password.');
                }
            } catch (err) {
                console.error('Reset password error:', err);
                showModalAlert(resetAlertError, 'Network error. Please try again.');
            } finally {
                if (btnSaveResetPass) {
                    btnSaveResetPass.disabled = false;
                    btnSaveResetPass.innerHTML = '<i class="fa-solid fa-check"></i> Save New Password';
                }
            }
        });
    }

    // ================= 14. SYNC ALL DB ADMINS HANDLER =================
    if (btnSyncVault) {
        btnSyncVault.addEventListener('click', async () => {
            const origHtml = btnSyncVault.innerHTML;
            btnSyncVault.disabled = true;
            btnSyncVault.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Syncing Admins...';

            try {
                const res = await fetch('/api/v1/super-admin/admin-credentials/sync', { method: 'POST' });
                const data = await res.json();
                if (res.ok && data.success) {
                    await fetchAdminCredentials();
                    await fetchCompanies();
                    await fetchStats();
                    alert(`✅ All database admins synchronized successfully! (${data.syncedCount || 0} admins verified)`);
                } else {
                    alert(data.message || 'Failed to sync admin credentials.');
                }
            } catch (err) {
                console.error('Sync admins error:', err);
                alert('Network error while syncing.');
            } finally {
                btnSyncVault.disabled = false;
                btnSyncVault.innerHTML = origHtml;
            }
        });
    }

    // Filter and Search for Credentials
    if (searchCredInput) {
        searchCredInput.addEventListener('input', () => {
            renderCredentialsTable();
        });
    }

    if (filterCredBtns) {
        filterCredBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterCredBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentCredFilter = btn.getAttribute('data-cred-filter') || 'all';
                renderCredentialsTable();
            });
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
    fetchAdminCredentials();
});
