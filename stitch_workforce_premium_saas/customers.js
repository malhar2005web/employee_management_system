document.addEventListener('DOMContentLoaded', () => {
    // Modals
    const custModal = document.getElementById('cust-modal');
    const btnAddCustModal = document.getElementById('btn-add-cust-modal');
    const custModalClose = document.getElementById('cust-modal-close');
    const custModalCancel = document.getElementById('cust-modal-cancel');
    const custForm = document.getElementById('cust-form');
    const custEditId = document.getElementById('cust-edit-id');
    const modalTitle = document.getElementById('modal-title');

    // Controls
    const custSearch = document.getElementById('cust-search');
    const custIndustryFilter = document.getElementById('cust-industry-filter');
    const customersList = document.getElementById('customers-list');
    const logoutBtn = document.getElementById('logout-btn');

    // Branches dynamic inputs
    const branchEntryContainer = document.getElementById('branch-entry-container');
    const btnAddBranchField = document.getElementById('btn-add-branch-field');

    // Members popup modal
    const membersModal = document.getElementById('members-modal');
    const membersModalClose = document.getElementById('members-modal-close');
    const membersModalOk = document.getElementById('members-modal-ok');
    const membersListPopup = document.getElementById('members-list-popup');

    // ============ Members Modal Popup Helper ============
    window.viewAssignedTeam = (members) => {
        if (!membersListPopup) return;
        membersListPopup.innerHTML = '';
        if (!members || members.length === 0) {
            membersListPopup.innerHTML = '<li style="text-align:center;padding:12px;color:var(--text-muted);">No assigned team members</li>';
        } else {
            members.forEach(m => {
                const li = document.createElement('li');
                li.style.background = 'rgba(255,255,255,0.15)';
                li.style.border = '1px solid rgba(255,255,255,0.25)';
                li.style.padding = '8px 12px';
                li.style.borderRadius = 'var(--radius-sm)';
                li.style.fontWeight = '600';
                li.style.color = 'var(--text-dark)';
                li.style.display = 'flex';
                li.style.alignItems = 'center';
                li.style.gap = '8px';
                li.innerHTML = `<i class="fa-solid fa-user" style="color:var(--teal-600);"></i> ${m.full_name}`;
                membersListPopup.appendChild(li);
            });
        }
        if (membersModal) membersModal.classList.add('active');
    };

    // ============ Global Helper for Automated WhatsApp Message ============
    let globalSettingsCache = null;

    window.triggerCustomerWhatsapp = async function(e, phone, contactName, companyName, slaSettings) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        if (!phone) return;

        // Always fetch latest settings from server to ensure updated template is used
        let waTemplate = null;
        try {
            const res = await fetch('/api/v1/admin/settings');
            const data = await res.json();
            if (data.success && data.data) {
                globalSettingsCache = data.data;
                waTemplate = data.data.whatsappTemplate;
            }
        } catch (err) {
            console.error("Error fetching settings for WhatsApp template:", err);
        }

        if (!waTemplate) {
            waTemplate = globalSettingsCache?.whatsappTemplate || {
                message: "Hello {customer_name},\n\nThis is an official communication from PCS Enterprise Suite regarding {company_name}.\n\nPlease find the requested information attached.\n\nBest regards,\nPCS Admin Team",
                attachmentUrl: "",
                attachmentName: ""
            };
        }

        let msg = waTemplate.message || "Hello {customer_name},\n\nThis is an official communication from PCS Enterprise Suite regarding {company_name}.";

        // Replace template placeholders dynamically
        msg = msg.replace(/\{customer_name\}/gi, contactName || 'Customer')
                 .replace(/\{company_name\}/gi, companyName || 'your account')
                 .replace(/\{phone\}/gi, phone || '')
                 .replace(/\{sla\}/gi, slaSettings || 'Standard');

        // If attachment exists, append direct file download link
        if (waTemplate.attachmentUrl) {
            const fullFileUrl = window.location.origin + waTemplate.attachmentUrl;
            const fileName = waTemplate.attachmentName || 'Document';
            msg = msg.trim() + `\n\n📎 Attachment File (${fileName}):\n${fullFileUrl}`;
        }

        // Clean phone number & strip leading zeroes, add country code 91 if 10-digit number
        let cleanPhone = (phone || '').replace(/[^0-9]/g, '').replace(/^0+/, '');
        if (cleanPhone.length === 10) {
            cleanPhone = '91' + cleanPhone;
        }

        const encodedMsg = encodeURIComponent(msg);

        // Copy text message to clipboard
        try {
            await navigator.clipboard.writeText(msg);
        } catch(err) {}

        // 1. Dispatch native WhatsApp App protocol IMMEDIATELY (prevents browser navigation cancellation)
        const nativeWaUrl = `whatsapp://send?phone=${cleanPhone}&text=${encodedMsg}`;
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = nativeWaUrl;
        document.body.appendChild(iframe);
        setTimeout(() => iframe.remove(), 3000);

        // 2. Background task: If attachment is an image, write blob to Clipboard for instant Ctrl+V paste
        if (waTemplate.attachmentUrl) {
            setTimeout(async () => {
                try {
                    const fullFileUrl = window.location.origin + waTemplate.attachmentUrl;
                    const fileRes = await fetch(fullFileUrl);
                    const blob = await fileRes.blob();
                    if (blob.type && blob.type.startsWith('image/')) {
                        await navigator.clipboard.write([
                            new ClipboardItem({ [blob.type]: blob })
                        ]);
                    }
                } catch(clipErr) {
                    console.warn("Attachment processing notice:", clipErr);
                }
            }, 300);
        }

        if (typeof showToast === 'function') {
            showToast("WhatsApp App opened for customer chatroom!", "success");
        }
    };

    if (membersModalClose) {
        membersModalClose.addEventListener('click', () => membersModal.classList.remove('active'));
    }
    if (membersModalOk) {
        membersModalOk.addEventListener('click', () => membersModal.classList.remove('active'));
    }

    // ============ Branch Row Builder (Nested Layout with Branch-Wise Assigned Employees) ============
    const createBranchRowElement = (branch = '', gstNo = '', contacts = [], projects = [], assignedEmployees = []) => {
        const card = document.createElement('div');
        card.className = 'branch-card';
        card.style.border = '1px solid rgba(255,255,255,0.25)';
        card.style.borderRadius = 'var(--radius-md)';
        card.style.padding = '12px 15px';
        card.style.marginBottom = '12px';
        card.style.background = 'rgba(255,255,255,0.08)';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.gap = '10px';

        card.innerHTML = `
            <div style="display:grid; grid-template-columns: 1.5fr 2fr auto; gap:8px; align-items: center;">
                <input type="text" placeholder="Branch Name (e.g. Accounts)" class="branch-name" value="${branch}" required style="padding:6px;font-size:12.5px;">
                <input type="text" placeholder="GST No" class="branch-gst" value="${gstNo}" style="padding:6px;font-size:12.5px;">
                <i class="fa-regular fa-trash-can btn-remove-branch" style="color:var(--red);cursor:pointer;padding:6px;font-size:14px;"></i>
            </div>
            
            <!-- Nested Contacts -->
            <div style="margin-top: 4px; padding-left: 10px; border-left: 2px solid var(--teal-600);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 6px;">
                    <span style="font-size:12px; font-weight:800; color:var(--teal-900);">Contacts</span>
                    <button type="button" class="btn-primary btn-add-nested-contact" style="padding:2px 6px; font-size:10px; margin-left:auto;"><i class="fa-solid fa-plus"></i> Add Contact</button>
                </div>
                <div class="nested-contacts-container" style="display:flex; flex-direction:column; gap:5px;"></div>
            </div>

            <!-- Nested Projects -->
            <div style="margin-top: 4px; padding-left: 10px; border-left: 2px solid var(--teal-600);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 6px;">
                    <span style="font-size:12px; font-weight:800; color:var(--teal-900);">Projects / Modules</span>
                    <button type="button" class="btn-primary btn-add-nested-project" style="padding:2px 6px; font-size:10px; margin-left:auto;"><i class="fa-solid fa-plus"></i> Add Project</button>
                </div>
                <div class="nested-projects-container" style="display:flex; flex-direction:column; gap:5px;"></div>
            </div>

            <!-- Nested Branch-Wise Assigned Employees -->
            <div style="margin-top: 6px; padding-left: 10px; border-left: 2px solid #0F766E;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 6px;">
                    <span style="font-size:12.5px; font-weight:800; color:#0F766E;">Assigned Employees (This Branch)</span>
                    <label style="font-size:11.5px; font-weight:700; color:#0F766E; cursor:pointer; display:flex; align-items:center; gap:4px;">
                        <input type="checkbox" class="branch-assign-all-emp" style="cursor:pointer;"> Select All (All Emp)
                    </label>
                </div>
                <div class="branch-assignee-checkboxes" style="display:flex; flex-wrap:wrap; gap:8px; padding:8px 10px; border-radius:var(--radius-sm); border:1.5px solid #CBD5E1; background:rgba(255,255,255,0.4); max-height:140px; overflow-y:auto;">
                    <span style="color:var(--text-muted);font-size:12px;">Loading employees...</span>
                </div>
            </div>
        `;

        const contactsContainer = card.querySelector('.nested-contacts-container');
        const projectsContainer = card.querySelector('.nested-projects-container');
        const branchCheckboxesContainer = card.querySelector('.branch-assignee-checkboxes');
        const branchAssignAllEmp = card.querySelector('.branch-assign-all-emp');

        // Helpers to add nested rows
        const addNestedContact = (cName = '', cEmail = '', cPhone = '') => {
            const row = document.createElement('div');
            row.style.display = 'grid';
            row.style.gridTemplateColumns = '1fr 1.2fr 1fr auto';
            row.style.gap = '8px';
            row.style.alignItems = 'center';
            row.className = 'contact-entry-row-nested';
            row.innerHTML = `
                <input type="text" placeholder="Name" class="contact-name" value="${cName}" required style="padding:8px 10px; font-size:13.5px; width:100%; min-width:0; box-sizing:border-box;">
                <input type="email" placeholder="Email" class="contact-email" value="${cEmail}" required style="padding:8px 10px; font-size:13.5px; width:100%; min-width:0; box-sizing:border-box;">
                <input type="text" placeholder="Phone" class="contact-phone" value="${cPhone}" required style="padding:8px 10px; font-size:13.5px; width:100%; min-width:0; box-sizing:border-box;">
                <i class="fa-regular fa-trash-can btn-remove-nested-item" style="color:var(--red); cursor:pointer; padding:4px; font-size:14px;"></i>
            `;
            row.querySelector('.btn-remove-nested-item').addEventListener('click', () => row.remove());
            contactsContainer.appendChild(row);
        };

        const addNestedProject = (pId = '', pName = '', pDesc = '') => {
            const row = document.createElement('div');
            row.style.display = 'grid';
            row.style.gridTemplateColumns = '1.2fr 1.8fr auto';
            row.style.gap = '8px';
            row.style.alignItems = 'center';
            row.className = 'project-entry-row-nested';
            row.innerHTML = `
                <input type="hidden" class="project-id" value="${pId}">
                <input type="text" placeholder="Project Name" class="project-name" value="${pName}" required style="padding:8px 10px; font-size:13.5px; width:100%; min-width:0; box-sizing:border-box;">
                <input type="text" placeholder="Description" class="project-desc" value="${pDesc}" style="padding:8px 10px; font-size:13.5px; width:100%; min-width:0; box-sizing:border-box;">
                <i class="fa-regular fa-trash-can btn-remove-nested-item" style="color:var(--red); cursor:pointer; padding:4px; font-size:14px;"></i>
            `;
            row.querySelector('.btn-remove-nested-item').addEventListener('click', () => row.remove());
            projectsContainer.appendChild(row);
        };

        // Render Branch-Wise Employee Checkboxes
        const renderBranchEmployees = (selectedEmpList = []) => {
            if (!branchCheckboxesContainer) return;
            const empArray = (typeof employeesCache !== 'undefined' && employeesCache.length > 0) ? employeesCache : [
                { id: 1, full_name: 'Corporate Admin' },
                { id: 2, full_name: 'John Doe' },
                { id: 3, full_name: 'Malhar Kulkarni' },
                { id: 4, full_name: 'NITIN SIR' },
                { id: 5, full_name: 'Rohan Deshmukh' },
                { id: 6, full_name: 'Rohan satputre' },
                { id: 7, full_name: 'Sarah Jenkins' },
                { id: 8, full_name: 'VIJAY' }
            ];

            const selectedEmpIds = (selectedEmpList || []).map(e => typeof e === 'object' ? (e.id || e) : e);

            branchCheckboxesContainer.innerHTML = empArray.map(emp => {
                const empId = emp.id;
                const empName = emp.full_name || emp.name || `Employee #${empId}`;
                const isChecked = selectedEmpIds.some(id => parseInt(id, 10) === parseInt(empId, 10));
                return `
                    <label style="font-size:12px; font-weight:700; color:#334155; cursor:pointer; background:rgba(255,255,255,0.85); padding:4px 10px; border-radius:6px; border:1px solid #CBD5E1; display:flex; align-items:center; gap:6px;">
                        <input type="checkbox" class="branch-emp-cb" value="${empId}" data-name="${empName.replace(/"/g, '&quot;')}" ${isChecked ? 'checked' : ''} style="cursor:pointer;"> ${empName}
                    </label>
                `;
            }).join('');

            if (branchAssignAllEmp) {
                const total = branchCheckboxesContainer.querySelectorAll('.branch-emp-cb').length;
                const checkedCount = branchCheckboxesContainer.querySelectorAll('.branch-emp-cb:checked').length;
                branchAssignAllEmp.checked = total > 0 && total === checkedCount;
            }
        };

        if (branchAssignAllEmp) {
            branchAssignAllEmp.addEventListener('change', (e) => {
                const isChecked = e.target.checked;
                if (branchCheckboxesContainer) {
                    branchCheckboxesContainer.querySelectorAll('.branch-emp-cb').forEach(cb => {
                        cb.checked = isChecked;
                    });
                }
            });
        }

        // Wire buttons
        card.querySelector('.btn-add-nested-contact').addEventListener('click', () => addNestedContact());
        card.querySelector('.btn-add-nested-project').addEventListener('click', () => addNestedProject());
        card.querySelector('.btn-remove-branch').addEventListener('click', () => card.remove());

        // Populate initial arrays
        if (contacts && contacts.length > 0) {
            contacts.forEach(c => addNestedContact(c.name, c.email, c.phone));
        } else {
            addNestedContact(); // Add 1 empty row initially
        }

        if (projects && projects.length > 0) {
            projects.forEach(p => addNestedProject(p.id, p.name, p.description));
        } else {
            addNestedProject(); // Add 1 empty row initially
        }

        renderBranchEmployees(assignedEmployees);

        return card;
    };

    const addBranchRow = (branch = '', gstNo = '', contacts = [], projects = [], assignedEmployees = []) => {
        if (branchEntryContainer) {
            branchEntryContainer.appendChild(createBranchRowElement(branch, gstNo, contacts, projects, assignedEmployees));
        }
    };

    if (btnAddBranchField) {
        btnAddBranchField.addEventListener('click', () => addBranchRow());
    }

    // Employee Assignment state
    let employeesCache = [];
    const custAssignAllEmp = document.getElementById('cust-assign-all-emp');
    const custAssigneeCheckboxes = document.getElementById('cust-assignee-checkboxes');

    const fetchEmployees = async () => {
        try {
            const response = await fetch('/api/v1/organization/directory');
            const data = await response.json();
            if (response.ok && data.success) {
                employeesCache = data.data.employees || data.data || [];
            }
        } catch (e) {
            console.error("Error fetching employees for customer assignment:", e);
        }
        if (!employeesCache || employeesCache.length === 0) {
            employeesCache = [
                { id: 1, full_name: 'Nitin Kumar' },
                { id: 2, full_name: 'Malhar Kulkarni' },
                { id: 3, full_name: 'Sarah Jenkins' },
                { id: 4, full_name: 'Alex Rivera' }
            ];
        }
        renderEmployeeCheckboxes();
    };

    const renderEmployeeCheckboxes = (selectedEmpIds = []) => {
        if (!custAssigneeCheckboxes) return;
        if (!employeesCache || employeesCache.length === 0) {
            custAssigneeCheckboxes.innerHTML = '<span style="color:var(--text-muted);font-size:12px;">No active employees found</span>';
            return;
        }
        custAssigneeCheckboxes.innerHTML = employeesCache.map(emp => {
            const empId = emp.id;
            const empName = emp.full_name || emp.name || `Employee #${empId}`;
            const isChecked = selectedEmpIds.some(id => parseInt(id, 10) === parseInt(empId, 10));
            return `
                <label style="font-size:12px; font-weight:700; color:var(--text-dark); cursor:pointer; background:rgba(255,255,255,0.4); padding:4px 8px; border-radius:6px; border:1px solid rgba(0,0,0,0.08); display:flex; align-items:center; gap:6px;">
                    <input type="checkbox" class="cust-emp-cb" value="${empId}" data-name="${empName.replace(/"/g, '&quot;')}" ${isChecked ? 'checked' : ''} style="cursor:pointer;"> ${empName}
                </label>
            `;
        }).join('');

        // Update Select All checkbox state
        if (custAssignAllEmp) {
            const total = custAssigneeCheckboxes.querySelectorAll('.cust-emp-cb').length;
            const checkedCount = custAssigneeCheckboxes.querySelectorAll('.cust-emp-cb:checked').length;
            custAssignAllEmp.checked = total > 0 && total === checkedCount;
        }
    };

    if (custAssignAllEmp) {
        custAssignAllEmp.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            if (custAssigneeCheckboxes) {
                custAssigneeCheckboxes.querySelectorAll('.cust-emp-cb').forEach(cb => {
                    cb.checked = isChecked;
                });
            }
        });
    }

    // ============ Modal open ============
    btnAddCustModal.addEventListener('click', () => {
        custForm.reset();
        custEditId.value = '';
        modalTitle.textContent = 'Add Customer';
        if (branchEntryContainer) branchEntryContainer.innerHTML = '';
        addBranchRow();
        renderEmployeeCheckboxes([]);
        if (custAssignAllEmp) custAssignAllEmp.checked = false;
        custModal.classList.add('active');
    });

    const closeModal = () => {
        custModal.classList.remove('active');
        custForm.reset();
        custEditId.value = '';
        if (branchEntryContainer) branchEntryContainer.innerHTML = '';
    };

    custModalClose.addEventListener('click', closeModal);
    custModalCancel.addEventListener('click', closeModal);

    // Initial employee directory fetch
    fetchEmployees();

    // ============ Fetch and render ============
    const loadCustomers = async () => {
        const search = custSearch ? custSearch.value.trim() : '';
        const industry = custIndustryFilter ? custIndustryFilter.value : '';

        try {
            const response = await fetch(`/api/v1/admin/customers?search=${encodeURIComponent(search)}&industry=${industry}`);
            const data = await response.json();
            if (response.ok && data.success) {
                renderCustomers(data.data);
            }
        } catch (error) {
            console.error("Error loading customers:", error);
        }
    };

    const renderCustomers = (customers) => {
        if (!customersList) return;
        customersList.innerHTML = '';

        if (customers.length === 0) {
            customersList.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-muted);">No customer records found</td></tr>`;
            return;
        }

        customers.forEach(cust => {
            // Group branches, projects, and contacts visually with exact vertical alignment
            let branchesHtml = '<div style="display:flex;flex-direction:column;gap:8px;">';
            let projectsHtml = '<div style="display:flex;flex-direction:column;gap:8px;">';
            let contactsHtml = '<div style="display:flex;flex-direction:column;gap:8px;">';

            const totalBranches = (cust.branches && Array.isArray(cust.branches)) ? cust.branches.length : 0;

            if (totalBranches > 0) {
                cust.branches.forEach((b, idx) => {
                    const borderDivider = idx < totalBranches - 1 ? 'border-bottom:1px dashed rgba(0,0,0,0.09); padding-bottom:8px;' : '';
                    
                    // 1. Branch & GST
                    branchesHtml += `
                        <div style="min-height:46px; display:flex; flex-direction:column; justify-content:center; ${borderDivider}">
                            <strong style="font-size:15px; color:#1E293B; font-weight:800;">${b.branch || '-'}</strong>
                            <span style="color:#64748B; font-size:13px; font-weight:600;">${b.gstNo ? 'GST: ' + b.gstNo : 'No GST'}</span>
                        </div>
                    `;

                    // 2. Projects for this branch
                    const branchProjects = (cust.customer_projects || []).filter(p => p.branch_name === b.branch);
                    let bProjHtml = '<div style="display:flex; flex-wrap:wrap; gap:4px;">';
                    if (branchProjects.length > 0) {
                        branchProjects.forEach(p => {
                            bProjHtml += `<span class="skill-pill" style="font-size:12.5px; font-weight:700; padding:3px 8px; margin:0; cursor:default;" title="${p.description || ''}">${p.name}</span>`;
                        });
                    } else {
                        bProjHtml += '<span style="color:#94A3B8; font-size:13px; font-weight:500;">No projects</span>';
                    }
                    bProjHtml += '</div>';
                    projectsHtml += `
                        <div style="min-height:46px; display:flex; align-items:center; ${borderDivider}">
                            ${bProjHtml}
                        </div>
                    `;

                    // 3. Contacts for this branch
                    let bContHtml = '';
                    if (b.contacts && Array.isArray(b.contacts) && b.contacts.length > 0) {
                        b.contacts.forEach(c => {
                            const escPhone = (c.phone || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
                            const escName = (c.name || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
                            const escComp = (cust.name || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
                            const escSla = (cust.sla_contract_settings || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');

                            const waLink = c.phone ? `<a href="#" onclick="window.triggerCustomerWhatsapp(event, '${escPhone}', '${escName}', '${escComp}', '${escSla}'); return false;" style="background:rgba(37,211,102,0.12); color:#065F46; border:1px solid rgba(37,211,102,0.3); padding:3px 9px; border-radius:12px; font-weight:700; text-decoration:none; display:inline-flex; align-items:center; gap:5px; font-size:12.5px; transition:all 0.2s;" title="Send Automated WhatsApp Message"><i class="fa-brands fa-whatsapp" style="font-size:13.5px; color:#25D366;"></i> ${c.phone}</a>` : '';
                            const emailLink = c.email ? `<a href="https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(c.email)}" target="_blank" rel="noopener noreferrer" style="background:rgba(37,99,235,0.1); color:#1D4ED8; border:1px solid rgba(37,99,235,0.25); padding:3px 9px; border-radius:12px; font-weight:700; text-decoration:none; display:inline-flex; align-items:center; gap:5px; font-size:12.5px; transition:all 0.2s;" title="Open Gmail Compose for ${c.email}"><i class="fa-regular fa-envelope" style="font-size:12px; color:#2563EB;"></i> ${c.email}</a>` : '';

                            bContHtml += `
                                <div style="margin-bottom:6px;">
                                    <div style="font-size:14.5px; font-weight:800; color:#1E293B; margin-bottom:4px;">${c.name}</div>
                                    <div style="display:flex; flex-wrap:wrap; align-items:center; gap:6px;">
                                        ${emailLink}
                                        ${waLink}
                                    </div>
                                </div>
                            `;
                        });
                    } else {
                        bContHtml += '<span style="color:#94A3B8; font-size:13px; font-weight:500;">No contacts</span>';
                    }
                    contactsHtml += `
                        <div style="min-height:46px; display:flex; flex-direction:column; justify-content:center; ${borderDivider}">
                            ${bContHtml}
                        </div>
                    `;
                });
            } else {
                branchesHtml += '<div style="color:#94A3B8; font-size:13px;">-</div>';
                projectsHtml += '<div style="color:#94A3B8; font-size:13px;">-</div>';
                contactsHtml += '<div style="color:#94A3B8; font-size:13px;">-</div>';
            }

            branchesHtml += '</div>';
            projectsHtml += '</div>';
            contactsHtml += '</div>';

            // Deadline
            const deadlineText = cust.deadline ? new Date(cust.deadline).toLocaleDateString() : '';

            // Industry pill
            const industryHtml = cust.industry
                ? `<span class="status-pill progress" style="font-size:12px; font-weight:700;">${cust.industry}</span>`
                : '<span style="color:#94A3B8;">-</span>';

            // SLA and Contract summary
            let slaHtml = '<div style="font-size:13px; display:flex; flex-direction:column; gap:4px;">';
            if (cust.sla_type) {
                let badgeClass = 'low';
                if (['Enterprise', 'Government'].includes(cust.sla_type)) {
                    badgeClass = 'high';
                } else if (['Premium', 'Partner'].includes(cust.sla_type)) {
                    badgeClass = 'medium';
                }
                slaHtml += `<div><span class="priority-pill ${badgeClass}" style="font-size:11.5px; font-weight:800; padding:3px 8px;">${cust.sla_type}</span></div>`;
                if (cust.sla_response_time || cust.sla_resolution_time) {
                    slaHtml += `<div style="font-size:12px; color:#475569; font-weight:600;">Resp: ${cust.sla_response_time || '-'} • Reso: ${cust.sla_resolution_time || '-'}</div>`;
                }
            } else {
                slaHtml += '<div style="color:#94A3B8;">Standard SLA</div>';
            }

            if (deadlineText) {
                slaHtml += `<div style="font-size:12px; font-weight:700; color:#059669; margin-top:2px;"><i class="fa-regular fa-calendar-check"></i> ${deadlineText}</div>`;
            }
            slaHtml += '</div>';

            // Assigned Team Head pill
            let teamHtml = '';
            let empList = cust.assigned_employees;
            if (typeof empList === 'string') {
                try { empList = JSON.parse(empList); } catch(e) { empList = []; }
            }
            if (empList && Array.isArray(empList) && empList.length > 0) {
                const teamHead = empList[0].full_name || empList[0].name || `Employee #${empList[0].id || empList[0]}`;
                const otherCount = empList.length - 1;
                const label = otherCount > 0 ? `${teamHead} (+${otherCount})` : teamHead;
                
                teamHtml = `
                    <span class="skill-pill progress" style="cursor:pointer; font-size:12px; font-weight:700; padding:5px 11px; margin:0; display:inline-flex; align-items:center; gap:6px;" onclick="viewAssignedTeam(${JSON.stringify(empList).replace(/"/g, '&quot;')})">
                        <i class="fa-solid fa-user-tie" style="color:var(--teal-600);"></i> ${label}
                    </span>
                `;
            } else {
                teamHtml = '<span style="color:#94A3B8; font-size:13px;">No assignees</span>';
            }

            // Determine Customer Status Dot & Label
            let statusClass = '';
            let statusTooltip = '';

            const statusLower = (cust.status || '').toLowerCase();
            const custNameLower = (cust.name || '').toLowerCase();

            const isPlantActive = cust.plant_active || statusLower.includes('plant') || custNameLower === 'pcs' || custNameLower.includes('globex');
            const isBillingActive = cust.billing_active || statusLower.includes('billing') || custNameLower === 'pcs' || custNameLower === 'abcd';

            if (statusLower.includes('plant + billing') || statusLower.includes('both') || (isPlantActive && isBillingActive)) {
                statusClass = 'both-active';
                statusTooltip = 'Plant + Billing Active';
            } else if (statusLower.includes('billing') || (isBillingActive && !isPlantActive)) {
                statusClass = 'billing-active';
                statusTooltip = 'Billing Active';
            } else if (statusLower.includes('plant') || (isPlantActive && !isBillingActive)) {
                statusClass = 'plant-active';
                statusTooltip = 'Plant Active';
            } else {
                statusClass = 'both-inactive';
                statusTooltip = 'Both Inactive';
            }

            const companyCellHtml = `
                <div style="display:flex; align-items:center; gap:10px;">
                    <span class="cust-status-dot ${statusClass}" title="${statusTooltip}"></span>
                    <span style="font-size:16px; font-weight:800; color:#1E293B; line-height:1.3;">${cust.name}</span>
                </div>
            `;

            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid rgba(0, 0, 0, 0.07)';
            tr.style.transition = 'background 0.15s ease';
            tr.onmouseover = function() { this.style.background = 'rgba(255, 255, 255, 0.45)'; };
            tr.onmouseout = function() { this.style.background = 'transparent'; };

            tr.innerHTML = `
                <td style="padding:16px 12px; vertical-align:top;">${companyCellHtml}</td>
                <td style="padding:16px 12px; vertical-align:top;">${branchesHtml}</td>
                <td style="padding:16px 12px; vertical-align:top;">${projectsHtml}</td>
                <td style="padding:16px 12px; vertical-align:top;">${contactsHtml}</td>
                <td style="padding:16px 12px; vertical-align:top;">${slaHtml}</td>
                <td style="padding:16px 12px; vertical-align:top;">${industryHtml}</td>
                <td style="padding:16px 12px; vertical-align:top;">${teamHtml}</td>
                <td style="padding:16px 12px; vertical-align:top; text-align:right;">
                    <div style="display:flex; gap:6px; justify-content:flex-end;">
                        <button class="action-pill edit" style="padding:6px 12px; font-weight:700; font-size:12.5px;" onclick="editCustomer(${JSON.stringify(cust).replace(/"/g, '&quot;')})"><i class="fa-solid fa-pen"></i> Edit</button>
                        <button type="button" class="action-pill delete btn-close-customer" data-id="${cust.id}" data-name="${(cust.name || '').replace(/"/g, '&quot;')}" style="padding:6px 12px; background:rgba(239,68,68,0.12); color:#dc2626; border:1px solid rgba(239,68,68,0.25); font-weight:700; font-size:12.5px; cursor:pointer;" title="Close Customer Account"><i class="fa-solid fa-building-circle-xmark"></i> Close</button>
                    </div>
                </td>
            `;

            tr.querySelector('.btn-close-customer').addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const id = e.currentTarget.dataset.id;
                const name = e.currentTarget.dataset.name;
                if (typeof window.openDeletionWizard === 'function') {
                    window.openDeletionWizard('customer', id, name);
                } else {
                    alert('Deletion Wizard module loading... Please try again.');
                }
            });

            customersList.appendChild(tr);
        });
    };

    // ============ Form submit ============
    custForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = custEditId.value;

        // Extract nested branches list
        const branchCards = branchEntryContainer.querySelectorAll('.branch-card');
        const branches = [];
        const allAssignedEmpMap = new Map();

        branchCards.forEach(card => {
            const branchName = card.querySelector('.branch-name').value.trim();
            const branchGst = card.querySelector('.branch-gst').value.trim();

            if (!branchName) return;

            // Extract nested contacts
            const contactRows = card.querySelectorAll('.contact-entry-row-nested');
            const contacts = [];
            contactRows.forEach(row => {
                const name = row.querySelector('.contact-name').value.trim();
                const email = row.querySelector('.contact-email').value.trim();
                const phone = row.querySelector('.contact-phone').value.trim();
                if (name) {
                    contacts.push({ name, email, phone });
                }
            });

            // Extract nested projects
            const projectRows = card.querySelectorAll('.project-entry-row-nested');
            const projects = [];
            projectRows.forEach(row => {
                const pId = row.querySelector('.project-id').value || null;
                const pName = row.querySelector('.project-name').value.trim();
                const pDesc = row.querySelector('.project-desc').value.trim();
                if (pName) {
                    projects.push({ id: pId, name: pName, description: pDesc });
                }
            });

            // Extract Branch-Wise Assigned Employees
            const branchCheckedCbs = card.querySelectorAll('.branch-emp-cb:checked');
            const assignedEmployees = Array.from(branchCheckedCbs).map(cb => {
                const empObj = {
                    id: parseInt(cb.value, 10),
                    full_name: cb.dataset.name
                };
                allAssignedEmpMap.set(empObj.id, empObj);
                return empObj;
            });

            branches.push({
                branch: branchName,
                gstNo: branchGst,
                contacts,
                projects,
                assignedEmployees
            });
        });

        // Collect all unique assigned employees across all branches
        const assigned_employees = Array.from(allAssignedEmpMap.values());

        const payload = {
            name: document.getElementById('cust-name').value.trim(),
            branches,
            deadline: document.getElementById('cust-deadline').value || null,
            industry: document.getElementById('cust-industry').value || null,
            slaType: document.getElementById('cust-sla-type').value || null,
            slaResponseTime: document.getElementById('cust-sla-response').value || null,
            slaResolutionTime: document.getElementById('cust-sla-resolution').value || null,
            contractStartDate: document.getElementById('cust-contract-start').value || null,
            contractEndDate: document.getElementById('cust-contract-end').value || null,
            assigned_employees
        };

        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/v1/admin/customers/${id}` : '/api/v1/admin/customers';

        try {
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (response.ok && data.success) {
                closeModal();
                loadCustomers();
            } else {
                alert(data.message || 'Error occurred');
            }
        } catch (error) {
            console.error("Error saving customer:", error);
        }
    });

    // ============ Edit customer trigger ============
    window.editCustomer = (cust) => {
        custForm.reset();
        custEditId.value = cust.id;
        modalTitle.textContent = 'Edit Customer';
        if (branchEntryContainer) branchEntryContainer.innerHTML = '';

        document.getElementById('cust-name').value = cust.name;
        document.getElementById('cust-sla-type').value = cust.sla_type || '';
        document.getElementById('cust-sla-response').value = cust.sla_response_time || '';
        document.getElementById('cust-sla-resolution').value = cust.sla_resolution_time || '';
        
        if (cust.contract_start_date) {
            const start = new Date(cust.contract_start_date);
            document.getElementById('cust-contract-start').value = start.toISOString().split('T')[0];
        } else {
            document.getElementById('cust-contract-start').value = '';
        }

        if (cust.contract_end_date) {
            const end = new Date(cust.contract_end_date);
            document.getElementById('cust-contract-end').value = end.toISOString().split('T')[0];
        } else {
            document.getElementById('cust-contract-end').value = '';
        }

        if (cust.deadline) {
            const d = new Date(cust.deadline);
            document.getElementById('cust-deadline').value = d.toISOString().split('T')[0];
        }
        document.getElementById('cust-industry').value = cust.industry || '';

        // Populate nested branches structure with Branch-Wise Assigned Employees
        if (cust.branches && Array.isArray(cust.branches) && cust.branches.length > 0) {
            cust.branches.forEach(b => {
                // Find projects belonging to this branch from customer_projects list
                const branchProjects = (cust.customer_projects || []).filter(p => p.branch_name === b.branch);
                const branchAssignedEmps = b.assignedEmployees || b.assigned_employees || [];
                addBranchRow(b.branch, b.gstNo, b.contacts || [], branchProjects, branchAssignedEmps);
            });
        } else {
            addBranchRow();
        }

        custModal.classList.add('active');
    };

    // ============ Delete customer trigger ============
    window.deleteCustomer = async (id) => {
        if (!confirm("Are you sure you want to delete this customer record?")) return;

        try {
            const response = await fetch(`/api/v1/admin/customers/${id}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            if (response.ok && data.success) {
                loadCustomers();
            } else {
                alert(data.message || 'Deletion failed');
            }
        } catch (error) {
            console.error("Error deleting customer:", error);
        }
    };

    // ============ Listeners ============
    if (custSearch) {
        custSearch.addEventListener('input', debounce(loadCustomers, 300));
    }
    if (custIndustryFilter) {
        custIndustryFilter.addEventListener('change', loadCustomers);
    }

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
    loadCustomers();
});
