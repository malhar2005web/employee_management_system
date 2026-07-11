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

    if (membersModalClose) {
        membersModalClose.addEventListener('click', () => membersModal.classList.remove('active'));
    }
    if (membersModalOk) {
        membersModalOk.addEventListener('click', () => membersModal.classList.remove('active'));
    }

    // ============ Branch Row Builder (Nested Layout) ============
    const createBranchRowElement = (branch = '', gstNo = '', contacts = [], projects = []) => {
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
                    <span style="font-size:11.5px; font-weight:800; color:var(--teal-900);">Contacts</span>
                    <button type="button" class="btn-primary btn-add-nested-contact" style="padding:2px 6px; font-size:10px; margin-left:auto;"><i class="fa-solid fa-plus"></i> Add Contact</button>
                </div>
                <div class="nested-contacts-container" style="display:flex; flex-direction:column; gap:5px;"></div>
            </div>

            <!-- Nested Projects -->
            <div style="margin-top: 4px; padding-left: 10px; border-left: 2px solid var(--teal-600);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 6px;">
                    <span style="font-size:11.5px; font-weight:800; color:var(--teal-900);">Projects / Modules</span>
                    <button type="button" class="btn-primary btn-add-nested-project" style="padding:2px 6px; font-size:10px; margin-left:auto;"><i class="fa-solid fa-plus"></i> Add Project</button>
                </div>
                <div class="nested-projects-container" style="display:flex; flex-direction:column; gap:5px;"></div>
            </div>
        `;

        const contactsContainer = card.querySelector('.nested-contacts-container');
        const projectsContainer = card.querySelector('.nested-projects-container');

        // Helpers to add nested rows
        const addNestedContact = (cName = '', cEmail = '', cPhone = '') => {
            const row = document.createElement('div');
            row.style.display = 'grid';
            row.style.gridTemplateColumns = '1fr 1.2fr 1fr auto';
            row.style.gap = '5px';
            row.style.alignItems = 'center';
            row.className = 'contact-entry-row-nested';
            row.innerHTML = `
                <input type="text" placeholder="Name" class="contact-name" value="${cName}" required style="padding:4px 6px; font-size:12px;">
                <input type="email" placeholder="Email" class="contact-email" value="${cEmail}" required style="padding:4px 6px; font-size:12px;">
                <input type="text" placeholder="Phone" class="contact-phone" value="${cPhone}" required style="padding:4px 6px; font-size:12px;">
                <i class="fa-regular fa-trash-can btn-remove-nested-item" style="color:var(--red); cursor:pointer; padding:4px; font-size:13px;"></i>
            `;
            row.querySelector('.btn-remove-nested-item').addEventListener('click', () => row.remove());
            contactsContainer.appendChild(row);
        };

        const addNestedProject = (pId = '', pName = '', pDesc = '') => {
            const row = document.createElement('div');
            row.style.display = 'grid';
            row.style.gridTemplateColumns = '1.2fr 1.8fr auto';
            row.style.gap = '5px';
            row.style.alignItems = 'center';
            row.className = 'project-entry-row-nested';
            row.innerHTML = `
                <input type="hidden" class="project-id" value="${pId}">
                <input type="text" placeholder="Project Name" class="project-name" value="${pName}" required style="padding:4px 6px; font-size:12px;">
                <input type="text" placeholder="Description" class="project-desc" value="${pDesc}" style="padding:4px 6px; font-size:12px;">
                <i class="fa-regular fa-trash-can btn-remove-nested-item" style="color:var(--red); cursor:pointer; padding:4px; font-size:13px;"></i>
            `;
            row.querySelector('.btn-remove-nested-item').addEventListener('click', () => row.remove());
            projectsContainer.appendChild(row);
        };

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

        return card;
    };

    const addBranchRow = (branch = '', gstNo = '', contacts = [], projects = []) => {
        if (branchEntryContainer) {
            branchEntryContainer.appendChild(createBranchRowElement(branch, gstNo, contacts, projects));
        }
    };

    if (btnAddBranchField) {
        btnAddBranchField.addEventListener('click', () => addBranchRow());
    }

    // ============ Modal open ============
    btnAddCustModal.addEventListener('click', () => {
        custForm.reset();
        custEditId.value = '';
        modalTitle.textContent = 'Add Customer';
        if (branchEntryContainer) branchEntryContainer.innerHTML = '';
        addBranchRow();
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
            customersList.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--text-muted);">No customer records found</td></tr>`;
            return;
        }

        customers.forEach(cust => {
            // Group branches, projects, and contacts visually
            let branchesHtml = '<div style="font-size:13px;display:flex;flex-direction:column;gap:12px;">';
            let projectsHtml = '<div style="font-size:13px;display:flex;flex-direction:column;gap:12px;">';
            let contactsHtml = '<div style="font-size:13px;display:flex;flex-direction:column;gap:12px;">';

            if (cust.branches && Array.isArray(cust.branches) && cust.branches.length > 0) {
                cust.branches.forEach(b => {
                    // Branch & GST
                    branchesHtml += `<div style="padding-bottom:4px;border-bottom:1px solid rgba(0,0,0,0.05);"><strong>${b.branch || '-'}</strong><br/><span style="color:var(--text-muted);font-size:12px;">${b.gstNo || '-'}</span></div>`;

                    // Projects for this branch
                    const branchProjects = (cust.customer_projects || []).filter(p => p.branch_name === b.branch);
                    let bProjHtml = '<div style="display:flex;flex-wrap:wrap;gap:4px;">';
                    if (branchProjects.length > 0) {
                        branchProjects.forEach(p => {
                            bProjHtml += `<span class="skill-pill" style="font-size:11px;padding:2px 6px;margin:0;cursor:default;" title="${p.description || ''}">${p.name}</span>`;
                        });
                    } else {
                        bProjHtml += '<span style="color:var(--text-muted);font-size:12px;">No projects</span>';
                    }
                    bProjHtml += '</div>';
                    projectsHtml += `<div style="padding-bottom:4px;border-bottom:1px solid rgba(0,0,0,0.05);min-height:36px;">${bProjHtml}</div>`;

                    // Contacts for this branch
                    let bContHtml = '';
                    if (b.contacts && Array.isArray(b.contacts) && b.contacts.length > 0) {
                        b.contacts.forEach(c => {
                            const waLink = c.phone ? `<a href="https://wa.me/${c.phone.replace(/[^0-9]/g, '')}" target="_blank" style="color:var(--teal-600);font-weight:600;text-decoration:none;display:inline-flex;align-items:center;gap:4px;margin-left:4px;" title="WhatsApp Link"><i class="fa-brands fa-whatsapp" style="font-size:13px;color:#25D366;"></i>${c.phone}</a>` : '';
                            bContHtml += `<div style="font-size:12px;"><strong>${c.name}</strong> (${c.email}) ${waLink}</div>`;
                        });
                    } else {
                        bContHtml += '<span style="color:var(--text-muted);font-size:12px;">No contacts</span>';
                    }
                    contactsHtml += `<div style="padding-bottom:4px;border-bottom:1px solid rgba(0,0,0,0.05);min-height:36px;">${bContHtml}</div>`;
                });
            } else {
                branchesHtml += '<div>-</div>';
                projectsHtml += '<div>-</div>';
                contactsHtml += '<div>-</div>';
            }

            branchesHtml += '</div>';
            projectsHtml += '</div>';
            contactsHtml += '</div>';

            // Deadline
            const deadlineText = cust.deadline ? new Date(cust.deadline).toLocaleDateString() : '-';

            // Industry pill
            const industryHtml = cust.industry
                ? `<span class="status-pill progress" style="font-size:11.5px;">${cust.industry}</span>`
                : '<span style="color:var(--text-muted);">-</span>';

            // SLA and Contract summary
            let slaHtml = '<div style="font-size:13px;display:flex;flex-direction:column;gap:4px;">';
            if (cust.sla_type) {
                let badgeClass = 'low';
                if (['Enterprise', 'Government'].includes(cust.sla_type)) {
                    badgeClass = 'high';
                } else if (['Premium', 'Partner'].includes(cust.sla_type)) {
                    badgeClass = 'medium';
                }
                slaHtml += `<div><span class="priority-pill ${badgeClass}" style="font-size:11px;padding:2px 6px;">${cust.sla_type}</span></div>`;
                slaHtml += `<div style="font-size:11.5px;color:var(--text-dark);font-weight:500;">Resp: ${cust.sla_response_time || '-'}</div>`;
                slaHtml += `<div style="font-size:11.5px;color:var(--text-dark);font-weight:500;">Reso: ${cust.sla_resolution_time || '-'}</div>`;
            } else {
                slaHtml += '<div style="color:var(--text-muted);">-</div>';
            }
            if (cust.contract_start_date || cust.contract_end_date) {
                const startStr = cust.contract_start_date ? new Date(cust.contract_start_date).toLocaleDateString() : 'Start: -';
                const endStr = cust.contract_end_date ? new Date(cust.contract_end_date).toLocaleDateString() : 'End: -';
                slaHtml += `<div style="font-size:11px;font-weight:600;margin-top:2px;color:var(--teal-700);">${startStr} to ${endStr}</div>`;
            }
            slaHtml += '</div>';

            // Assigned Team Head pill
            let teamHtml = '';
            if (cust.assigned_employees && Array.isArray(cust.assigned_employees) && cust.assigned_employees.length > 0) {
                const teamHead = cust.assigned_employees[0].full_name;
                const otherCount = cust.assigned_employees.length - 1;
                const label = otherCount > 0 ? `${teamHead} (+${otherCount} more)` : teamHead;
                
                teamHtml = `
                    <span class="skill-pill progress" style="cursor:pointer;font-size:11.5px;font-weight:600;padding:4px 10px;margin:0;display:inline-flex;align-items:center;gap:6px;" onclick="viewAssignedTeam(${JSON.stringify(cust.assigned_employees).replace(/"/g, '&quot;')})">
                        <i class="fa-solid fa-user-tie" style="color:var(--teal-600);"></i> ${label}
                    </span>
                `;
            } else {
                teamHtml = '<span style="color:var(--text-muted);font-size:13px;">No assignees</span>';
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="task-name">${cust.name}</td>
                <td>${branchesHtml}</td>
                <td>${projectsHtml}</td>
                <td>${contactsHtml}</td>
                <td>${slaHtml}</td>
                <td style="font-size:13.5px;font-weight:600;color:var(--teal-900);">${deadlineText}</td>
                <td>${industryHtml}</td>
                <td>${teamHtml}</td>
                <td>
                    <div style="display:flex;gap:8px;">
                        <button class="action-pill edit" onclick="editCustomer(${JSON.stringify(cust).replace(/"/g, '&quot;')})"><i class="fa-solid fa-pen"></i> Edit</button>
                        <button class="action-pill delete" onclick="deleteCustomer(${cust.id})"><i class="fa-solid fa-trash"></i> Delete</button>
                    </div>
                </td>
            `;
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

            branches.push({
                branch: branchName,
                gstNo: branchGst,
                contacts,
                projects
            });
        });

        const payload = {
            name: document.getElementById('cust-name').value.trim(),
            branches,
            deadline: document.getElementById('cust-deadline').value || null,
            industry: document.getElementById('cust-industry').value || null,
            slaType: document.getElementById('cust-sla-type').value || null,
            slaResponseTime: document.getElementById('cust-sla-response').value || null,
            slaResolutionTime: document.getElementById('cust-sla-resolution').value || null,
            contractStartDate: document.getElementById('cust-contract-start').value || null,
            contractEndDate: document.getElementById('cust-contract-end').value || null
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

        // Populate nested branches structure
        if (cust.branches && Array.isArray(cust.branches) && cust.branches.length > 0) {
            cust.branches.forEach(b => {
                // Find projects belonging to this branch from customer_projects list
                const branchProjects = (cust.customer_projects || []).filter(p => p.branch_name === b.branch);
                addBranchRow(b.branch, b.gstNo, b.contacts || [], branchProjects);
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
