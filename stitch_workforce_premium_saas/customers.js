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

    // ============ Ticket Transfer Trail Formatter ============
    function formatTicketTransferTrail(transferHistory, options = {}) {
        let list = transferHistory;
        if (typeof list === 'string') {
            try { list = JSON.parse(list); } catch (e) { list = []; }
        }
        if (!Array.isArray(list) || list.length === 0) return '';

        const chainNodes = [];
        const tooltipParts = [];

        list.forEach((item, idx) => {
            const fromFullName = item.from_name || 'Staff';
            const toFullName = item.to_name || 'Staff';
            const fromShort = options.fullName ? fromFullName : (item.from_name ? item.from_name.trim().split(' ')[0] : 'Staff');
            const toShort = options.fullName ? toFullName : (item.to_name ? item.to_name.trim().split(' ')[0] : 'Staff');

            if (idx === 0) {
                chainNodes.push(fromShort);
            } else if (chainNodes[chainNodes.length - 1] !== fromShort) {
                chainNodes.push(fromShort);
            }
            chainNodes.push(toShort);

            const timeStr = item.transferred_at ? new Date(item.transferred_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
            const reasonStr = item.reason ? `[${item.reason}]` : '';
            tooltipParts.push(`Transfer #${idx + 1}: ${fromFullName} ➔ ${toFullName} ${reasonStr} ${timeStr ? '(' + timeStr + ')' : ''}`);
        });

        const chainHtml = chainNodes.join(` <i class="fa-solid fa-arrow-right" style="font-size:${options.arrowSize || '8px'}; color:#6366f1; opacity:0.85; margin:0 2px;"></i> `);
        const tooltipText = tooltipParts.join('\n');

        if (options.layout === 'details') {
            let detailsHtml = `
                <div style="margin-top:6px; padding:8px 10px; background:rgba(99,102,241,0.06); border:1px solid rgba(99,102,241,0.2); border-radius:8px;">
                    <div style="font-size:11px; font-weight:800; color:#4338ca; text-transform:uppercase; letter-spacing:0.5px; display:flex; align-items:center; gap:5px; margin-bottom:4px;">
                        <i class="fa-solid fa-shuffle"></i> Transfer History (${list.length})
                    </div>
                    <div style="font-size:12px; font-weight:700; color:#1e1b4b; margin-bottom:6px;">
                        ${chainHtml}
                    </div>
                    <div style="display:flex; flex-direction:column; gap:4px; border-left:2px solid #a5b4fc; padding-left:8px; margin-left:2px;">
            `;
            list.forEach((item, idx) => {
                const timeStr = item.transferred_at ? new Date(item.transferred_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
                detailsHtml += `
                    <div style="font-size:11.5px; color:#475569; line-height:1.4;">
                        <span style="font-weight:700; color:#1e293b;">${item.from_name || 'Staff'}</span>
                        <i class="fa-solid fa-arrow-right" style="font-size:8.5px; color:#6366f1; margin:0 3px;"></i>
                        <span style="font-weight:700; color:#0f766e;">${item.to_name || 'Staff'}</span>
                        ${item.reason ? `<span style="background:rgba(99,102,241,0.12); color:#4338ca; font-weight:700; font-size:10.5px; padding:1px 5px; border-radius:4px; margin-left:4px;">${item.reason}</span>` : ''}
                        ${timeStr ? `<span style="color:#94a3b8; font-size:10.5px; margin-left:4px;"><i class="fa-regular fa-clock" style="font-size:9.5px;"></i> ${timeStr}</span>` : ''}
                        ${item.notes ? `<div style="font-size:11px; color:#64748b; font-style:italic; margin-top:1px;">Note: "${item.notes}"</div>` : ''}
                    </div>
                `;
            });
            detailsHtml += `</div></div>`;
            return detailsHtml;
        }

        return `
            <span class="ticket-transfer-chain-badge" title="${tooltipText.replace(/"/g, '&quot;')}" style="display:inline-flex; align-items:center; gap:3px; font-size:10.5px; font-weight:700; color:#4338ca; background:rgba(99,102,241,0.1); border:1px solid rgba(99,102,241,0.28); padding:1px 6px; border-radius:6px; cursor:help; max-width:100%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                <i class="fa-solid fa-shuffle" style="font-size:9px; color:#6366f1;"></i>
                <span>${chainHtml}</span>
            </span>
        `;
    }

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
                message: "Hello {customer_name},\n\nThis is an official communication from PentaTEAMBRIDGE regarding {company_name}.\n\nPlease find the requested information attached.\n\nBest regards,\nPentaTEAMBRIDGE Admin Team",
                attachmentUrl: "",
                attachmentName: ""
            };
        }

        let msg = waTemplate.message || "Hello {customer_name},\n\nThis is an official communication from PentaTEAMBRIDGE regarding {company_name}.";

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
    const createBranchRowElement = (branch = '', gstNo = '', contacts = [], projects = [], assignedEmployees = [], address = '', latitude = '', longitude = '') => {
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

            <!-- Branch Office Address & GPS for Geofencing -->
            <div style="display:grid; grid-template-columns: 2fr 1fr 1fr auto; gap:8px; align-items: center; background:rgba(15,118,110,0.06); padding:8px 10px; border-radius:6px; border:1px dashed rgba(15,118,110,0.3);">
                <div>
                    <label style="font-size:10.5px; font-weight:800; color:#0f766e; text-transform:uppercase; display:block; margin-bottom:2px;"><i class="fa-solid fa-map-location-dot"></i> Address (For Branch)</label>
                    <input type="text" placeholder="e.g. 5th Floor, Trade Star, Andheri East, Mumbai" class="branch-address" value="${address || ''}" style="padding:6px 8px; font-size:12.5px; width:100%; box-sizing:border-box;">
                </div>
                <div>
                    <label style="font-size:10.5px; font-weight:800; color:#0f766e; text-transform:uppercase; display:block; margin-bottom:2px;">Latitude</label>
                    <input type="number" step="any" placeholder="19.1136" class="branch-lat" value="${latitude || ''}" style="padding:6px 8px; font-size:12px; width:100%; box-sizing:border-box;">
                </div>
                <div>
                    <label style="font-size:10.5px; font-weight:800; color:#0f766e; text-transform:uppercase; display:block; margin-bottom:2px;">Longitude</label>
                    <input type="number" step="any" placeholder="72.8697" class="branch-lng" value="${longitude || ''}" style="padding:6px 8px; font-size:12px; width:100%; box-sizing:border-box;">
                </div>
                <div style="display:flex; flex-direction:column; justify-content:flex-end;">
                    <button type="button" class="btn-secondary btn-geocode-branch" title="Auto-fetch Lat/Lng from Address" style="padding:6px 8px; font-size:11px; white-space:nowrap; margin-top:14px; background:#fff; border:1px solid #0f766e; color:#0f766e; cursor:pointer;"><i class="fa-solid fa-crosshairs"></i> Fetch GPS</button>
                </div>
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

        // Geocoding button helper
        const geocodeBtn = card.querySelector('.btn-geocode-branch');
        if (geocodeBtn) {
            geocodeBtn.addEventListener('click', async () => {
                const addrInput = card.querySelector('.branch-address');
                const latInput = card.querySelector('.branch-lat');
                const lngInput = card.querySelector('.branch-lng');
                const query = (addrInput?.value || '').trim();
                if (!query) {
                    alert("Please enter a branch address first to fetch GPS coordinates.");
                    return;
                }
                geocodeBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                try {
                    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
                    const data = await res.json();
                    if (data && data.length > 0) {
                        latInput.value = parseFloat(data[0].lat).toFixed(6);
                        lngInput.value = parseFloat(data[0].lon).toFixed(6);
                        if (typeof showToast === 'function') showToast("GPS coordinates fetched successfully!", "success");
                    } else {
                        alert("Could not automatically locate coordinates for this address. You can manually enter Latitude and Longitude if known.");
                    }
                } catch (e) {
                    console.error("Geocoding error:", e);
                    alert("Geocoding service unavailable. You may manually enter Latitude & Longitude.");
                } finally {
                    geocodeBtn.innerHTML = '<i class="fa-solid fa-crosshairs"></i> Fetch GPS';
                }
            });
        }

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

        const addNestedProject = (pId = '', pName = '', pDesc = '', pDeadline = '', pContractStart = '', pContractEnd = '') => {
            const row = document.createElement('div');
            row.className = 'project-entry-row-nested';
            row.style.background = 'rgba(255,255,255,0.75)';
            row.style.border = '1px solid #cbd5e1';
            row.style.borderRadius = '8px';
            row.style.padding = '8px 10px';
            row.style.marginBottom = '8px';
            row.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';

            row.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                    <span style="font-size:11.5px; font-weight:800; color:#0f766e; display:inline-flex; align-items:center; gap:4px;">
                        <i class="fa-solid fa-diagram-project"></i> Project / Module
                    </span>
                    <i class="fa-regular fa-trash-can btn-remove-nested-item" style="color:var(--red); cursor:pointer; font-size:13px; padding:2px;" title="Remove Project"></i>
                </div>
                <input type="hidden" class="project-id" value="${pId}">
                <div style="display:grid; grid-template-columns: 1.2fr 1.5fr; gap:6px; margin-bottom:6px;">
                    <div>
                        <label style="font-size:10.5px; font-weight:700; color:#475569; display:block; margin-bottom:2px;">Project Name *</label>
                        <input type="text" placeholder="e.g. ERP System" class="project-name" value="${pName}" required style="padding:6px 8px; font-size:12.5px; width:100%; box-sizing:border-box; border:1px solid #cbd5e1; border-radius:5px; background:#fff;">
                    </div>
                    <div>
                        <label style="font-size:10.5px; font-weight:700; color:#475569; display:block; margin-bottom:2px;">Description</label>
                        <input type="text" placeholder="Scope / Deliverables (optional)" class="project-desc" value="${pDesc}" style="padding:6px 8px; font-size:12.5px; width:100%; box-sizing:border-box; border:1px solid #cbd5e1; border-radius:5px; background:#fff;">
                    </div>
                </div>
                <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:6px;">
                    <div>
                        <label style="font-size:10px; font-weight:700; color:#0f766e; display:block; margin-bottom:2px;" title="Start date of project contract"><i class="fa-regular fa-calendar-check"></i> Contract Start</label>
                        <input type="date" class="project-contract-start" value="${pContractStart}" style="padding:4px 6px; font-size:11.5px; width:100%; box-sizing:border-box; border:1px solid #cbd5e1; border-radius:5px; background:#fff;">
                    </div>
                    <div>
                        <label style="font-size:10px; font-weight:700; color:#b91c1c; display:block; margin-bottom:2px;" title="End date of project contract"><i class="fa-regular fa-calendar-xmark"></i> Contract End</label>
                        <input type="date" class="project-contract-end" value="${pContractEnd}" style="padding:4px 6px; font-size:11.5px; width:100%; box-sizing:border-box; border:1px solid #cbd5e1; border-radius:5px; background:#fff;">
                    </div>
                    <div>
                        <label style="font-size:10px; font-weight:700; color:#d97706; display:block; margin-bottom:2px;" title="Target project completion deadline"><i class="fa-solid fa-flag-checkered"></i> Deadline</label>
                        <input type="date" class="project-deadline" value="${pDeadline}" style="padding:4px 6px; font-size:11.5px; width:100%; box-sizing:border-box; border:1px solid #cbd5e1; border-radius:5px; background:#fff;">
                    </div>
                </div>
            `;
            row.querySelector('.btn-remove-nested-item').addEventListener('click', () => row.remove());

            // Auto-sync top-level deadline when project deadline is picked
            const dlInput = row.querySelector('.project-deadline');
            dlInput.addEventListener('change', () => {
                const topDl = document.getElementById('cust-deadline');
                if (topDl && (!topDl.value || dlInput.value > topDl.value)) {
                    topDl.value = dlInput.value;
                }
            });

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
            projects.forEach(p => {
                const pDl = p.deadline ? (typeof p.deadline === 'string' ? p.deadline.slice(0, 10) : new Date(p.deadline).toISOString().split('T')[0]) : '';
                const pStart = (p.contract_start_date || p.contractStartDate) ? (typeof (p.contract_start_date || p.contractStartDate) === 'string' ? (p.contract_start_date || p.contractStartDate).slice(0, 10) : new Date(p.contract_start_date || p.contractStartDate).toISOString().split('T')[0]) : '';
                const pEnd = (p.contract_end_date || p.contractEndDate) ? (typeof (p.contract_end_date || p.contractEndDate) === 'string' ? (p.contract_end_date || p.contractEndDate).slice(0, 10) : new Date(p.contract_end_date || p.contractEndDate).toISOString().split('T')[0]) : '';
                addNestedProject(p.id, p.name, p.description, pDl, pStart, pEnd);
            });
        } else {
            addNestedProject(); // Add 1 empty row initially
        }

        renderBranchEmployees(assignedEmployees);

        return card;
    };

    const addBranchRow = (branch = '', gstNo = '', contacts = [], projects = [], assignedEmployees = [], address = '', latitude = '', longitude = '') => {
        if (branchEntryContainer) {
            branchEntryContainer.appendChild(createBranchRowElement(branch, gstNo, contacts, projects, assignedEmployees, address, latitude, longitude));
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
        window.currentCustomersData = customers;

        if (customers.length === 0) {
            customersList.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text-muted);">No customer records found</td></tr>`;
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
                            ${b.address ? `<span style="color:#0f766e; font-size:11.5px; font-weight:600; margin-top:2px; display:inline-flex; align-items:center; gap:4px;" title="${b.address}"><i class="fa-solid fa-location-dot"></i> ${b.address}</span>` : ''}
                        </div>
                    `;

                    // 2. Projects for this branch
                    const branchProjects = (cust.customer_projects || []).filter(p => p.branch_name === b.branch);
                    const effectiveProjects = branchProjects.length > 0 ? branchProjects : (b.projects || []);
                    let bProjHtml = '<div style="display:flex; flex-direction:column; gap:6px; width:100%; min-width:220px;">';
                    if (effectiveProjects.length > 0) {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);

                        effectiveProjects.forEach(p => {
                            let contractBadge = '';
                            let waBtn = '';

                            const pStart = p.contract_start_date || p.contractStartDate;
                            const pEnd = p.contract_end_date || p.contractEndDate;
                            const pDl = p.deadline;

                            if (pEnd) {
                                const end = new Date(pEnd);
                                end.setHours(0, 0, 0, 0);
                                const diffDays = Math.round((end - today) / (1000 * 60 * 60 * 24));
                                const formattedEnd = end.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

                                if (diffDays < 0) {
                                    contractBadge = `<span style="background:rgba(239,68,68,0.14); color:#b91c1c; border:1px solid rgba(239,68,68,0.35); font-size:10.5px; font-weight:800; padding:1px 6px; border-radius:8px; display:inline-flex; align-items:center; gap:3px;" title="Contract expired on ${formattedEnd}"><i class="fa-solid fa-triangle-exclamation"></i> Expired (${Math.abs(diffDays)}d ago)</span>`;
                                } else if (diffDays <= 7) {
                                    contractBadge = `<span style="background:rgba(245,158,11,0.2); color:#b45309; border:1px solid rgba(245,158,11,0.5); font-size:10.5px; font-weight:800; padding:1px 6px; border-radius:8px; display:inline-flex; align-items:center; gap:3px;" title="Contract ends on ${formattedEnd}"><i class="fa-solid fa-hourglass-half"></i> Ending in ${diffDays}d</span>`;
                                } else {
                                    contractBadge = `<span style="background:rgba(16,185,129,0.12); color:#047857; border:1px solid rgba(16,185,129,0.3); font-size:10.5px; font-weight:700; padding:1px 6px; border-radius:8px; display:inline-flex; align-items:center; gap:3px;" title="Contract ends on ${formattedEnd}"><i class="fa-regular fa-calendar-check"></i> ${diffDays}d left</span>`;
                                }

                                if (p.id) {
                                    const escCust = (cust.name || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
                                    const escProj = (p.name || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
                                    const lastRem = p.last_contract_reminder_at 
                                        ? `Last reminder: ${new Date(p.last_contract_reminder_at).toLocaleDateString('en-GB')}` 
                                        : 'Send WhatsApp contract expiry reminder to client';

                                    waBtn = `
                                        <button type="button" onclick="window.triggerProjectContractWhatsapp(event, ${p.id}, '${escCust}', '${escProj}')" style="background:rgba(37,211,102,0.14); color:#065F46; border:1px solid rgba(37,211,102,0.38); padding:2px 7px; border-radius:6px; font-weight:700; font-size:10.5px; cursor:pointer; display:inline-flex; align-items:center; gap:3px; transition:all 0.2s;" title="${lastRem}">
                                            <i class="fa-brands fa-whatsapp" style="color:#25D366; font-size:11.5px;"></i> Remind
                                        </button>
                                    `;
                                }
                            }

                            const startFormatted = pStart ? new Date(pStart).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : null;
                            const endFormatted = pEnd ? new Date(pEnd).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : null;
                            const dlFormatted = pDl ? new Date(pDl).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : null;

                            let datesInfo = [];
                            if (startFormatted && endFormatted) {
                                datesInfo.push(`<span title="Contract: ${startFormatted} to ${endFormatted}"><i class="fa-regular fa-calendar" style="font-size:9.5px; color:#0f766e;"></i> ${startFormatted} – ${endFormatted}</span>`);
                            } else if (endFormatted) {
                                datesInfo.push(`<span title="Contract End: ${endFormatted}"><i class="fa-regular fa-calendar-xmark" style="font-size:9.5px; color:#b91c1c;"></i> End: ${endFormatted}</span>`);
                            }
                            if (dlFormatted) {
                                datesInfo.push(`<span title="Deadline: ${dlFormatted}" style="color:#d97706; font-weight:700;"><i class="fa-solid fa-flag-checkered" style="font-size:9.5px;"></i> Due: ${dlFormatted}</span>`);
                            }

                            bProjHtml += `
                                <div style="background:rgba(255,255,255,0.7); border:1px solid rgba(203,213,225,0.85); border-radius:6px; padding:5px 8px; display:flex; flex-direction:column; gap:4px; box-shadow:0 1px 2px rgba(0,0,0,0.02);">
                                    <div style="display:flex; align-items:center; justify-content:space-between; gap:6px;">
                                        <span class="skill-pill" style="font-size:12px; font-weight:800; padding:2px 7px; margin:0; cursor:default; background:rgba(15,118,110,0.08); color:#0f766e; border:1px solid rgba(15,118,110,0.25);" title="${p.description || ''}">${p.name}</span>
                                        ${contractBadge}
                                    </div>
                                    ${(datesInfo.length > 0 || waBtn) ? `
                                        <div style="display:flex; align-items:center; justify-content:space-between; gap:6px; font-size:11px; color:#64748B;">
                                            <div style="display:flex; flex-direction:column; gap:1px;">${datesInfo.join('')}</div>
                                            ${waBtn}
                                        </div>
                                    ` : ''}
                                </div>
                            `;
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

            // Deadline & Delivery
            const deadlineText = cust.deadline ? new Date(cust.deadline).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
            const deliveryText = cust.delivery_date ? new Date(cust.delivery_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

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
                slaHtml += `<div style="font-size:12px; font-weight:700; color:#059669; margin-top:2px;" title="Project Target Deadline"><i class="fa-regular fa-calendar-check"></i> DL: ${deadlineText}</div>`;
            }
            if (deliveryText) {
                slaHtml += `<div style="font-size:11.5px; font-weight:700; color:#2563EB; margin-top:1px;" title="App Handover / Delivery Date"><i class="fa-solid fa-truck-ramp-box"></i> Handover: ${deliveryText}</div>`;
            }
            slaHtml += '</div>';

            // ============ SUPPORT TICKETS COLUMN ============
            const tickets = cust.support_tickets && Array.isArray(cust.support_tickets) ? cust.support_tickets : [];
            const totalTickets = tickets.length;
            let ticketsHtml = '';

            if (totalTickets === 0) {
                ticketsHtml = `
                    <div style="display:flex; align-items:center; gap:6px; color:#94A3B8; font-size:12.5px; font-weight:600; padding:4px 0;">
                        <i class="fa-regular fa-circle-check" style="color:#10B981; font-size:13.5px;"></i> 0 Tickets
                    </div>
                `;
            } else {
                ticketsHtml = '<div style="display:flex; flex-direction:column; gap:6px; min-width:170px;">';
                
                // Count header with View All trigger
                ticketsHtml += `
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:2px;">
                        <span style="font-size:12px; font-weight:800; color:#1E293B; display:inline-flex; align-items:center; gap:5px;">
                            <i class="fa-solid fa-headset" style="color:#0d9488;"></i> ${totalTickets} Ticket${totalTickets > 1 ? 's' : ''}
                        </span>
                        <a href="javascript:void(0)" onclick="event.preventDefault(); event.stopPropagation(); window.viewCustomerTicketsModal('${cust.id}')" style="font-size:11px; font-weight:700; color:#2563EB; text-decoration:none; cursor:pointer;" title="View all tickets">View All &rarr;</a>
                    </div>
                `;

                // Render clean, clickable buttons: Ticket 1, Ticket 2, etc.
                ticketsHtml += '<div style="display:flex; flex-wrap:wrap; gap:5px;">';
                tickets.forEach((t, idx) => {
                    const stLower = (t.status || '').toLowerCase();
                    let dotColor = '#EF4444';
                    let borderColor = 'rgba(239,68,68,0.35)';
                    let bgColor = 'rgba(239,68,68,0.06)';
                    let statusLabel = 'Open';

                    if (stLower.includes('resolve')) {
                        dotColor = '#10B981';
                        borderColor = 'rgba(16,185,129,0.35)';
                        bgColor = 'rgba(16,185,129,0.06)';
                        statusLabel = 'Resolved';
                    } else if (stLower.includes('progress')) {
                        dotColor = '#F59E0B';
                        borderColor = 'rgba(245,158,11,0.4)';
                        bgColor = 'rgba(245,158,11,0.06)';
                        statusLabel = 'In Progress';
                    } else if (stLower.includes('assign')) {
                        dotColor = '#6366F1';
                        borderColor = 'rgba(99,102,241,0.35)';
                        bgColor = 'rgba(99,102,241,0.06)';
                        statusLabel = 'Assigned';
                    } else if (stLower.includes('close')) {
                        dotColor = '#64748B';
                        borderColor = 'rgba(100,116,139,0.35)';
                        bgColor = 'rgba(100,116,139,0.06)';
                        statusLabel = 'Closed';
                    }

                    const safeTitle = (t.title || 'Support Ticket').replace(/"/g, '&quot;');
                    const tCode = t.ticket_code || `TK-${t.id}`;

                    ticketsHtml += `
                        <button type="button" onclick="event.preventDefault(); event.stopPropagation(); window.viewCustomerTicketsModal('${cust.id}', '${tCode}')"
                            style="background:${bgColor}; border:1.5px solid ${borderColor}; padding:3.5px 8px; border-radius:8px; font-size:11.5px; font-weight:700; color:#1e293b; cursor:pointer; display:inline-flex; align-items:center; gap:5px; transition:all 0.15s ease; box-shadow:0 1px 2px rgba(0,0,0,0.03);"
                            onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 3px 6px rgba(0,0,0,0.08)';"
                            onmouseout="this.style.transform='none'; this.style.boxShadow='0 1px 2px rgba(0,0,0,0.03)';"
                            title="Ticket ${idx + 1}: ${tCode} (${statusLabel})\n${safeTitle}\nClick to view full details">
                            <span style="width:7px; height:7px; border-radius:50%; background:${dotColor}; flex-shrink:0;"></span>
                            <span style="color:#0f766e; font-weight:800;">Ticket ${idx + 1}</span>
                            <span style="font-family:monospace; font-size:10px; color:#64748b; font-weight:600;">${tCode}</span>
                        </button>
                    `;
                });
                ticketsHtml += '</div>';

                ticketsHtml += '</div>';
            }

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
                <td style="padding:16px 12px; vertical-align:top;">${ticketsHtml}</td>
                <td style="padding:16px 12px; vertical-align:top;">${industryHtml}</td>
                <td style="padding:16px 12px; vertical-align:top;">${teamHtml}</td>
                <td style="padding:16px 12px; vertical-align:top; text-align:right;">
                    <div style="display:flex; gap:6px; justify-content:flex-end;">
                        <button class="action-pill edit" style="padding:6px 12px; font-weight:700; font-size:12.5px;" onclick="editCustomer(${JSON.stringify(cust).replace(/"/g, '&quot;')})"><i class="fa-solid fa-pen"></i> Edit</button>
                        <button type="button" class="action-pill delete btn-close-customer" data-id="${cust.id}" data-name="${(cust.name || '').replace(/"/g, '&quot;')}" style="padding:6px 12px; background:rgba(239,68,68,0.12); color:#dc2626; border:1px solid rgba(239,68,68,0.25); font-weight:700; font-size:12.5px; cursor:pointer;" title="Close Customer Account"><i class="fa-solid fa-building-circle-xmark"></i> Close</button>
                    </div>
                </td>
            `;

            const closeBtn = tr.querySelector('.btn-close-customer');
            if (closeBtn) {
                closeBtn.addEventListener('click', (e) => {
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
            }

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

            // Extract nested projects with deadlines and contract dates
            const projectRows = card.querySelectorAll('.project-entry-row-nested');
            const projects = [];
            projectRows.forEach(row => {
                const pId = row.querySelector('.project-id').value || null;
                const pName = row.querySelector('.project-name').value.trim();
                const pDesc = row.querySelector('.project-desc').value.trim();
                const pDlInput = row.querySelector('.project-deadline');
                const pDeadline = pDlInput && pDlInput.value ? pDlInput.value : null;
                const pStartInput = row.querySelector('.project-contract-start');
                const pContractStart = pStartInput && pStartInput.value ? pStartInput.value : null;
                const pEndInput = row.querySelector('.project-contract-end');
                const pContractEnd = pEndInput && pEndInput.value ? pEndInput.value : null;

                if (pName) {
                    projects.push({ 
                        id: pId, 
                        name: pName, 
                        description: pDesc, 
                        deadline: pDeadline,
                        contract_start_date: pContractStart,
                        contract_end_date: pContractEnd
                    });
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

            const branchAddress = card.querySelector('.branch-address') ? card.querySelector('.branch-address').value.trim() : '';
            const branchLat = card.querySelector('.branch-lat') ? card.querySelector('.branch-lat').value.trim() : '';
            const branchLng = card.querySelector('.branch-lng') ? card.querySelector('.branch-lng').value.trim() : '';

            branches.push({
                branch: branchName,
                gstNo: branchGst,
                address: branchAddress,
                latitude: branchLat ? parseFloat(branchLat) : null,
                longitude: branchLng ? parseFloat(branchLng) : null,
                contacts,
                projects,
                assignedEmployees
            });
        });

        // Collect all unique assigned employees across all branches
        const assigned_employees = Array.from(allAssignedEmpMap.values());

        // Derive overall deadline from projects if top-level input not explicitly set
        let topDeadline = document.getElementById('cust-deadline').value || null;
        if (!topDeadline && branches.length > 0) {
            for (const b of branches) {
                for (const p of b.projects) {
                    if (p.deadline) {
                        if (!topDeadline || p.deadline > topDeadline) {
                            topDeadline = p.deadline;
                        }
                    }
                }
            }
        }

        const payload = {
            name: document.getElementById('cust-name').value.trim(),
            branches,
            deadline: topDeadline,
            delivery_date: document.getElementById('cust-delivery-date') ? document.getElementById('cust-delivery-date').value || null : null,
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
        } else {
            document.getElementById('cust-deadline').value = '';
        }

        if (cust.delivery_date) {
            const deliv = new Date(cust.delivery_date);
            const delivEl = document.getElementById('cust-delivery-date');
            if (delivEl) delivEl.value = deliv.toISOString().split('T')[0];
        } else {
            const delivEl = document.getElementById('cust-delivery-date');
            if (delivEl) delivEl.value = '';
        }

        document.getElementById('cust-industry').value = cust.industry || '';

        // Populate nested branches structure with Branch-Wise Assigned Employees
        if (cust.branches && Array.isArray(cust.branches) && cust.branches.length > 0) {
            cust.branches.forEach(b => {
                // Find projects belonging to this branch from customer_projects list, fallback to b.projects
                const branchProjects = (cust.customer_projects || []).filter(p => p.branch_name === b.branch);
                const finalProjects = branchProjects.length > 0 ? branchProjects : (b.projects || []);
                const branchAssignedEmps = b.assignedEmployees || b.assigned_employees || [];
                addBranchRow(b.branch, b.gstNo, b.contacts || [], finalProjects, branchAssignedEmps, b.address || '', b.latitude || '', b.longitude || '');
            });
        } else {
            addBranchRow();
        }

        custModal.classList.add('active');
    };

    // ============ Customer Support Tickets Modal ============
    window.closeCustomerTicketsModal = () => {
        const modal = document.getElementById('modal-customer-tickets');
        if (!modal) return;
        modal.classList.remove('active');
        modal.style.opacity = '0';
        modal.style.pointerEvents = 'none';
        setTimeout(() => {
            modal.style.display = 'none';
            if (!document.querySelector('.modal-overlay.active')) {
                document.body.classList.remove('modal-open');
            }
        }, 220);
    };

    window.viewCustomerTicketsModal = async (customerId, focusedTicketCode = null) => {
        let cust = (window.currentCustomersData || []).find(c => String(c.id) === String(customerId));
        
        // Fallback: If customer not found in memory, fetch fresh from server
        if (!cust) {
            try {
                const resp = await fetch('/api/v1/admin/customers');
                const resData = await resp.json();
                if (resData.success && Array.isArray(resData.data)) {
                    window.currentCustomersData = resData.data;
                    cust = window.currentCustomersData.find(c => String(c.id) === String(customerId));
                }
            } catch (err) {
                console.error("Fallback customer fetch error:", err);
            }
        }

        if (!cust) {
            console.error("Customer record not found for id:", customerId);
            return;
        }

        const modal = document.getElementById('modal-customer-tickets');
        const title = document.getElementById('cust-tickets-modal-title');
        const subtitle = document.getElementById('cust-tickets-modal-subtitle');
        const body = document.getElementById('cust-tickets-modal-body');
        if (!modal || !body) {
            console.error("Customer tickets modal element missing!");
            return;
        }

        // Attach backdrop dismiss click if not already attached
        if (!modal.dataset.backdropBound) {
            modal.dataset.backdropBound = 'true';
            modal.addEventListener('click', (e) => {
                if (e.target === modal) window.closeCustomerTicketsModal();
            });
        }

        const tickets = cust.support_tickets && Array.isArray(cust.support_tickets) ? cust.support_tickets : [];
        if (title) title.innerHTML = `<i class="fa-solid fa-headset" style="color:#0d9488;"></i> ${cust.name} &bull; Support Tickets (${tickets.length})`;
        
        const dlStr = cust.deadline ? new Date(cust.deadline).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '<span style="color:#94A3B8;">None</span>';
        const delivStr = cust.delivery_date ? new Date(cust.delivery_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '<span style="color:#94A3B8;">None</span>';
        if (subtitle) {
            subtitle.innerHTML = `<span><strong>Target Deadline:</strong> ${dlStr}</span> &nbsp;&bull;&nbsp; <span><strong>App Handover Date:</strong> ${delivStr}</span>`;
        }

        if (tickets.length === 0) {
            body.innerHTML = `
                <div style="text-align:center; padding:48px 20px; color:#64748B;">
                    <i class="fa-regular fa-circle-check" style="font-size:42px; color:#10B981; margin-bottom:12px; display:block;"></i>
                    <div style="font-weight:800; font-size:16px; color:#1E293B;">0 Support Tickets Raised</div>
                    <div style="font-size:13px; margin-top:6px;">No issues or support requests have been reported for this customer.</div>
                </div>
            `;
        } else {
            let html = '';
            tickets.forEach((t, idx) => {
                let statusBadge = '';
                const stLower = (t.status || '').toLowerCase();
                if (stLower.includes('resolve')) {
                    statusBadge = `<span style="background:rgba(16,185,129,0.12); color:#059669; border:1px solid rgba(16,185,129,0.25); font-size:11.5px; font-weight:800; padding:3px 9px; border-radius:12px; display:inline-flex; align-items:center; gap:4px;"><i class="fa-solid fa-circle-check" style="font-size:10px;"></i> Resolved</span>`;
                } else if (stLower.includes('progress')) {
                    statusBadge = `<span style="background:rgba(245,158,11,0.14); color:#b45309; border:1px solid rgba(245,158,11,0.28); font-size:11.5px; font-weight:800; padding:3px 9px; border-radius:12px; display:inline-flex; align-items:center; gap:4px;"><i class="fa-solid fa-spinner fa-spin" style="font-size:10px;"></i> In Progress</span>`;
                } else if (stLower.includes('assign')) {
                    statusBadge = `<span style="background:rgba(99,102,241,0.12); color:#4f46e5; border:1px solid rgba(99,102,241,0.25); font-size:11.5px; font-weight:800; padding:3px 9px; border-radius:12px; display:inline-flex; align-items:center; gap:4px;"><i class="fa-solid fa-user-check" style="font-size:10px;"></i> Assigned</span>`;
                } else if (stLower.includes('close')) {
                    statusBadge = `<span style="background:rgba(100,116,139,0.12); color:#475569; border:1px solid rgba(100,116,139,0.25); font-size:11.5px; font-weight:800; padding:3px 9px; border-radius:12px; display:inline-flex; align-items:center; gap:4px;"><i class="fa-solid fa-lock" style="font-size:10px;"></i> Closed</span>`;
                } else {
                    statusBadge = `<span style="background:rgba(239,68,68,0.12); color:#dc2626; border:1px solid rgba(239,68,68,0.25); font-size:11.5px; font-weight:800; padding:3px 9px; border-radius:12px; display:inline-flex; align-items:center; gap:4px;"><i class="fa-solid fa-circle-dot" style="font-size:10px;"></i> Open</span>`;
                }

                const raisedDateObj = t.created_at ? new Date(t.created_at) : null;
                const raisedDateStr = raisedDateObj && !isNaN(raisedDateObj.getTime())
                    ? raisedDateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : '-';

                let deadlineBadge = '';
                const targetDeadline = cust.deadline;
                if (targetDeadline && raisedDateObj) {
                    const rDate = new Date(t.created_at);
                    const dDate = new Date(targetDeadline);
                    rDate.setHours(0,0,0,0);
                    dDate.setHours(0,0,0,0);
                    const diffDays = Math.round((rDate - dDate) / (1000 * 60 * 60 * 24));
                    if (diffDays < 0) {
                        deadlineBadge = `<span style="font-size:11.5px; font-weight:700; color:#065f46; background:rgba(16,185,129,0.12); border:1px solid rgba(16,185,129,0.28); padding:3px 8px; border-radius:6px; display:inline-flex; align-items:center; gap:4px;" title="Raised ${Math.abs(diffDays)} day(s) before target deadline (${new Date(targetDeadline).toLocaleDateString()})"><i class="fa-solid fa-clock-rotate-left"></i> Raised Pre-Deadline (${Math.abs(diffDays)} day${Math.abs(diffDays) > 1 ? 's' : ''} early)</span>`;
                    } else if (diffDays === 0) {
                        deadlineBadge = `<span style="font-size:11.5px; font-weight:700; color:#b45309; background:rgba(245,158,11,0.14); border:1px solid rgba(245,158,11,0.28); padding:3px 8px; border-radius:6px; display:inline-flex; align-items:center; gap:4px;"><i class="fa-solid fa-calendar-day"></i> Raised on Deadline Day</span>`;
                    } else {
                        deadlineBadge = `<span style="font-size:11.5px; font-weight:700; color:#b91c1c; background:rgba(239,68,68,0.12); border:1px solid rgba(239,68,68,0.28); padding:3px 8px; border-radius:6px; display:inline-flex; align-items:center; gap:4px;" title="Raised ${diffDays} day(s) after target deadline (${new Date(targetDeadline).toLocaleDateString()})"><i class="fa-solid fa-triangle-exclamation"></i> Raised Post-Deadline (+${diffDays} day${diffDays > 1 ? 's' : ''} late)</span>`;
                    }
                }

                let handoverText = '';
                if (cust.delivery_date && raisedDateObj) {
                    const rDate = new Date(t.created_at);
                    const delivDate = new Date(cust.delivery_date);
                    rDate.setHours(0,0,0,0);
                    delivDate.setHours(0,0,0,0);
                    const diffDeliv = Math.round((rDate - delivDate) / (1000 * 60 * 60 * 24));
                    if (diffDeliv > 0) {
                        handoverText = `<span style="font-size:11.5px; color:#475569; font-weight:600; background:#f1f5f9; padding:2px 7px; border-radius:5px;">+${diffDeliv}d post-handover</span>`;
                    } else if (diffDeliv === 0) {
                        handoverText = `<span style="font-size:11.5px; color:#475569; font-weight:600; background:#f1f5f9; padding:2px 7px; border-radius:5px;">On handover date</span>`;
                    } else {
                        handoverText = `<span style="font-size:11.5px; color:#475569; font-weight:600; background:#f1f5f9; padding:2px 7px; border-radius:5px;">${Math.abs(diffDeliv)}d pre-handover</span>`;
                    }
                }

                let resolvedHtml = '';
                if (t.resolved_at) {
                    const resDate = new Date(t.resolved_at);
                    resolvedHtml = `
                        <div style="font-size:12px; color:#059669; font-weight:700; display:inline-flex; align-items:center; gap:4px;">
                            <i class="fa-solid fa-check-double"></i> Resolved on: ${resDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                    `;
                }

                const isFocused = focusedTicketCode && String(t.ticket_code).toUpperCase() === String(focusedTicketCode).toUpperCase();
                const cardBorder = isFocused ? '2px solid #0d9488' : '1px solid #e2e8f0';
                const cardBg = isFocused ? '#f0fdfa' : '#ffffff';
                const cardShadow = isFocused ? '0 4px 14px rgba(13,148,136,0.18)' : '0 1px 3px rgba(0,0,0,0.04)';

                html += `
                    <div id="ticket-card-${t.ticket_code}" style="border:${cardBorder}; border-radius:12px; padding:14px 16px; background:${cardBg}; box-shadow:${cardShadow}; display:flex; flex-direction:column; gap:8px; transition:all 0.2s;">
                        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
                            <div style="display:flex; align-items:center; gap:8px;">
                                <span style="font-size:12px; font-weight:800; color:#0f766e; background:rgba(15,118,110,0.1); padding:2px 8px; border-radius:6px;">Ticket ${idx + 1}</span>
                                <span style="font-family:monospace; font-weight:800; font-size:13px; color:#0f172a; background:#f1f5f9; padding:3px 8px; border-radius:6px; border:1px solid #cbd5e1;">${t.ticket_code}</span>
                                ${statusBadge}
                                ${t.priority ? `<span class="priority-pill ${String(t.priority).toLowerCase()}" style="font-size:11px; padding:2px 7px;">${t.priority}</span>` : ''}
                                ${isFocused ? `<span style="background:#0d9488; color:#fff; font-size:10.5px; font-weight:800; padding:2px 7px; border-radius:4px;"><i class="fa-solid fa-arrow-pointer"></i> Selected</span>` : ''}
                            </div>
                            <a href="admin-support.html?search=${encodeURIComponent(t.ticket_code)}" target="_blank" style="font-size:12px; font-weight:700; color:#2563EB; text-decoration:none; display:inline-flex; align-items:center; gap:4px; padding:4px 10px; border-radius:6px; background:rgba(37,99,235,0.08); border:1px solid rgba(37,99,235,0.2);">
                                Open in Support Desk <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:10px;"></i>
                            </a>
                        </div>
                        <div style="font-size:13.5px; font-weight:700; color:#1E293B;">${t.title || 'Support Ticket'}</div>
                        <div style="display:flex; flex-wrap:wrap; align-items:center; gap:10px; font-size:12px; color:#64748B;">
                            <span><i class="fa-regular fa-clock" style="color:#94A3B8;"></i> <strong>Raised:</strong> ${raisedDateStr}</span>
                            ${handoverText}
                            ${resolvedHtml}
                        </div>
                        <div style="display:flex; flex-wrap:wrap; align-items:center; gap:8px; font-size:12px; padding:6px 10px; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0; margin-top:2px;">
                            <span style="font-weight:700; color:#1e293b; display:inline-flex; align-items:center; gap:4px;">
                                <i class="fa-solid fa-user-gear" style="color:#0d9488;"></i> <strong>Assigned:</strong> ${t.assigned_to_name || 'Unassigned'}
                            </span>
                            ${formatTicketTransferTrail(t.transfer_history, { layout: 'badge' })}
                        </div>
                        ${t.transfer_history && (Array.isArray(t.transfer_history) ? t.transfer_history.length > 0 : (typeof t.transfer_history === 'string' && t.transfer_history !== '[]')) ? formatTicketTransferTrail(t.transfer_history, { layout: 'details' }) : ''}
                        ${deadlineBadge ? `<div style="margin-top:2px;">${deadlineBadge}</div>` : ''}
                    </div>
                `;
            });
            body.innerHTML = html;

            if (focusedTicketCode) {
                setTimeout(() => {
                    const el = document.getElementById('ticket-card-' + focusedTicketCode);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 150);
            }
        }

        document.body.classList.add('modal-open');
        modal.style.display = 'flex';
        modal.style.opacity = '1';
        modal.style.pointerEvents = 'auto';
        modal.classList.add('active');
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

    // =========================================================================
    // ============ CUSTOMER & PLANT BILLING & COSTING REPORT LOGIC ============
    // =========================================================================

    const tabBtnMaster = document.getElementById('tab-btn-master');
    const tabBtnBillingReport = document.getElementById('tab-btn-billing-report');
    const tabContentMaster = document.getElementById('tab-content-master');
    const tabContentBillingReport = document.getElementById('tab-content-billing-report');

    const reportFilterStart = document.getElementById('report-filter-start');
    const reportFilterEnd = document.getElementById('report-filter-end');
    const btnQuickThisMonth = document.getElementById('btn-quick-report-this-month');
    const btnQuickLastMonth = document.getElementById('btn-quick-report-last-month');
    const btnQuick2026 = document.getElementById('btn-quick-report-2026');
    const btnQuickAll = document.getElementById('btn-quick-report-all');
    const reportSearch = document.getElementById('report-search');
    const btnRefreshReport = document.getElementById('btn-refresh-report');
    const btnToggleExpandAll = document.getElementById('btn-toggle-expand-all');
    const btnExportBillingCSV = document.getElementById('btn-export-billing-csv');

    // Rate modal elements
    const rateModal = document.getElementById('rate-modal');
    const rateModalClose = document.getElementById('rate-modal-close');
    const rateModalCancel = document.getElementById('rate-modal-cancel');
    const rateEditForm = document.getElementById('rate-edit-form');

    let isAllExpanded = false;
    let cachedBillingReportData = [];

    function escapeHtml(str) {
        if (!str && str !== 0) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function getInitials(name) {
        if (!name) return '??';
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    // Tab Switching
    if (tabBtnMaster && tabBtnBillingReport) {
        tabBtnMaster.addEventListener('click', () => {
            tabBtnMaster.classList.add('active');
            tabBtnBillingReport.classList.remove('active');
            if (tabContentMaster) tabContentMaster.style.display = 'block';
            if (tabContentBillingReport) tabContentBillingReport.style.display = 'none';
        });

        tabBtnBillingReport.addEventListener('click', () => {
            tabBtnBillingReport.classList.add('active');
            tabBtnMaster.classList.remove('active');
            if (tabContentMaster) tabContentMaster.style.display = 'none';
            if (tabContentBillingReport) tabContentBillingReport.style.display = 'block';
            loadCustomerBillingReport();
        });
    }

    // Quick Date Filters
    function setQuickFilterActive(activeBtn) {
        [btnQuickThisMonth, btnQuickLastMonth, btnQuick2026, btnQuickAll].forEach(btn => {
            if (!btn) return;
            if (btn === activeBtn) {
                btn.style.background = 'var(--teal-900)';
                btn.style.color = '#ffffff';
                btn.style.border = 'none';
            } else {
                btn.style.background = '#f1f5f9';
                btn.style.color = '#334155';
                btn.style.border = '1px solid #e2e8f0';
            }
        });
    }

    if (btnQuickThisMonth) {
        btnQuickThisMonth.addEventListener('click', () => {
            setQuickFilterActive(btnQuickThisMonth);
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            if (reportFilterStart) reportFilterStart.value = `${year}-${month}-01`;
            if (reportFilterEnd) reportFilterEnd.value = `${year}-${month}-${day}`;
            loadCustomerBillingReport();
        });
    }

    if (btnQuickLastMonth) {
        btnQuickLastMonth.addEventListener('click', () => {
            setQuickFilterActive(btnQuickLastMonth);
            const now = new Date();
            const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
            const formatD = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            if (reportFilterStart) reportFilterStart.value = formatD(firstDayLastMonth);
            if (reportFilterEnd) reportFilterEnd.value = formatD(lastDayLastMonth);
            loadCustomerBillingReport();
        });
    }

    if (btnQuick2026) {
        btnQuick2026.addEventListener('click', () => {
            setQuickFilterActive(btnQuick2026);
            if (reportFilterStart) reportFilterStart.value = '2026-01-01';
            if (reportFilterEnd) reportFilterEnd.value = '2026-12-31';
            loadCustomerBillingReport();
        });
    }

    if (btnQuickAll) {
        btnQuickAll.addEventListener('click', () => {
            setQuickFilterActive(btnQuickAll);
            if (reportFilterStart) reportFilterStart.value = '';
            if (reportFilterEnd) reportFilterEnd.value = '';
            loadCustomerBillingReport();
        });
    }

    if (reportSearch) {
        reportSearch.addEventListener('input', debounce(() => {
            loadCustomerBillingReport();
        }, 300));
    }

    if (reportFilterStart) {
        reportFilterStart.addEventListener('change', () => {
            loadCustomerBillingReport();
        });
    }

    if (reportFilterEnd) {
        reportFilterEnd.addEventListener('change', () => {
            loadCustomerBillingReport();
        });
    }

    if (btnRefreshReport) {
        btnRefreshReport.addEventListener('click', () => {
            loadCustomerBillingReport();
        });
    }

    // Load Billing Report Data
    async function loadCustomerBillingReport() {
        const tbody = document.getElementById('billing-report-tbody');
        if (!tbody) return;

        const startDate = reportFilterStart ? reportFilterStart.value : '';
        const endDate = reportFilterEnd ? reportFilterEnd.value : '';
        const search = reportSearch ? reportSearch.value.trim() : '';

        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center; padding:40px; color:var(--text-muted); font-size:14px;">
                    <i class="fa-solid fa-spinner fa-spin" style="font-size:22px; display:block; margin-bottom:10px; color:var(--teal-600);"></i>
                    Calculating Customer &amp; Plant Billing, Time, Tickets &amp; Costing rollups...
                </td>
            </tr>
        `;

        try {
            const params = new URLSearchParams();
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);
            if (search) params.append('search', search);

            const token = localStorage.getItem('token') || '';
            const headers = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`/api/v1/customers/billing-report?${params.toString()}`, {
                headers,
                credentials: 'include'
            });
            const result = await res.json();

            if (!res.ok || !result.success) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align:center; padding:30px; color:#ef4444; font-weight:700;">
                            <i class="fa-solid fa-circle-exclamation" style="font-size:20px; display:block; margin-bottom:8px;"></i>
                            Failed to load billing report: ${result.message || 'Unknown error'}
                        </td>
                    </tr>
                `;
                return;
            }

            const data = result.data || [];
            cachedBillingReportData = data;

            // Update KPI Metric Cards
            updateBillingReportKPIs(data);

            // Render Table Rows
            renderBillingReportTable(data);
        } catch (err) {
            console.error('Error loading billing report:', err);
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align:center; padding:30px; color:#ef4444; font-weight:700;">
                        <i class="fa-solid fa-circle-exclamation" style="font-size:20px; display:block; margin-bottom:8px;"></i>
                        Error connecting to server. Please try again.
                    </td>
                </tr>
            `;
        }
    }

    function updateBillingReportKPIs(data) {
        let totalClients = (data || []).length;
        let totalPlants = 0;
        let totalTickets = 0;
        let totalHours = 0;
        let totalPayable = 0;

        (data || []).forEach(cust => {
            const plants = cust.plants || [];
            totalPlants += plants.length;
            totalTickets += parseInt(cust.total_tickets || cust.totalTickets || 0, 10);
            totalHours += parseFloat(cust.total_hours || cust.totalHours || 0);
            totalPayable += parseFloat(cust.total_payable || cust.totalPayable || 0);
        });

        const kpiClients = document.getElementById('kpi-report-clients');
        const kpiPlants = document.getElementById('kpi-report-plants');
        const kpiTickets = document.getElementById('kpi-report-tickets');
        const kpiHours = document.getElementById('kpi-report-hours');
        const kpiPayable = document.getElementById('kpi-report-payable');

        if (kpiClients) kpiClients.textContent = totalClients.toLocaleString('en-IN');
        if (kpiPlants) kpiPlants.textContent = totalPlants.toLocaleString('en-IN');
        if (kpiTickets) kpiTickets.textContent = totalTickets.toLocaleString('en-IN');
        if (kpiHours) kpiHours.textContent = `${totalHours.toFixed(2)} hrs`;
        if (kpiPayable) kpiPayable.textContent = `₹${Math.round(totalPayable).toLocaleString('en-IN')}`;
    }

    // Render Table Rows with 4 Tiers
    function renderBillingReportTable(data) {
        const tbody = document.getElementById('billing-report-tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!data || data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align:center; padding:40px; color:var(--text-muted); font-size:14px;">
                        <i class="fa-solid fa-folder-open" style="font-size:24px; display:block; margin-bottom:8px;"></i>
                        No customer or plant records found for selected filters.
                    </td>
                </tr>
            `;
            return;
        }

        data.forEach((cust) => {
            const custId = cust.customer_id || cust.id;
            const custName = cust.customer_name || cust.name || 'Unnamed Customer';
            const custRate = parseFloat(cust.billing_rate || cust.billingRate || 1000);
            const custHours = parseFloat(cust.total_hours || cust.totalHours || 0);
            const custTickets = parseInt(cust.total_tickets || cust.totalTickets || 0, 10);
            const custPayable = parseFloat(cust.total_payable || cust.totalPayable || 0);
            const custIndustry = cust.industry || 'IT / Engineering';

            // Status Dot logic
            let statusClass = 'both-inactive';
            let statusTooltip = 'Both Inactive';
            const statusLower = (cust.status || '').toLowerCase();
            const isPlantActive = cust.plant_active || statusLower.includes('plant');
            const isBillingActive = cust.billing_active || statusLower.includes('billing');

            if (statusLower.includes('both') || (isPlantActive && isBillingActive)) {
                statusClass = 'both-active';
                statusTooltip = 'Plant + Billing Active';
            } else if (isBillingActive) {
                statusClass = 'billing-active';
                statusTooltip = 'Billing Active';
            } else if (isPlantActive) {
                statusClass = 'plant-active';
                statusTooltip = 'Plant Active';
            }

            const plants = cust.plants || [];
            const plantCount = plants.length;

            // Level 1: Customer Row
            const custTr = document.createElement('tr');
            custTr.className = 'report-row-cust';
            custTr.dataset.custId = custId;
            custTr.style.cursor = 'pointer';
            custTr.style.background = 'rgba(248, 250, 252, 0.95)';
            custTr.style.borderBottom = '1.5px solid #cbd5e1';
            custTr.style.fontWeight = '700';

            custTr.innerHTML = `
                <td style="padding:14px 16px;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <i class="fa-solid fa-chevron-right cust-chevron" id="cust-chevron-${custId}" style="color:var(--teal-600); width:14px; font-size:13px; transition:transform 0.2s;"></i>
                        <span class="cust-status-dot ${statusClass}" style="animation:none;" title="${statusTooltip}"></span>
                        <span style="font-size:14.5px; font-weight:800; color:#0f172a;">${escapeHtml(custName)}</span>
                    </div>
                </td>
                <td style="padding:14px 12px;">
                    <span class="badge" style="background:#e0f2fe; color:#0284c7; font-weight:700; font-size:11.5px; padding:3px 8px; border-radius:6px;">${plantCount} ${plantCount === 1 ? 'Plant' : 'Plants'}</span>
                    ${custIndustry ? `<span style="font-size:11.5px; color:#64748b; margin-left:6px; font-weight:600;">${escapeHtml(custIndustry)}</span>` : ''}
                </td>
                <td style="padding:14px 12px; text-align:center;">
                    <span class="badge" style="background:#fef3c7; color:#b45309; font-weight:800; padding:3px 10px; border-radius:12px; font-size:12px;">${custTickets}</span>
                </td>
                <td style="padding:14px 12px;">
                    <span style="font-weight:700; color:#0f172a; font-size:13px;"><i class="fa-regular fa-clock" style="color:#0f766e; margin-right:4px;"></i>${custHours.toFixed(2)} hrs</span>
                </td>
                <td style="padding:14px 12px;">
                    <div style="display:flex; align-items:center; gap:6px;">
                        <span style="color:#0f766e; font-weight:800; font-size:13px;">₹${Number(custRate).toLocaleString('en-IN')}/hr</span>
                        <span style="font-size:10px; color:#64748b; background:#f1f5f9; padding:1px 5px; border-radius:4px; font-weight:600;">Default</span>
                    </div>
                </td>
                <td style="padding:14px 16px; text-align:right;">
                    <span style="font-weight:900; font-size:14px; color:#047857; background:rgba(16,185,129,0.15); padding:4px 10px; border-radius:6px; border:1px solid rgba(16,185,129,0.3); display:inline-block;">₹${Math.round(custPayable).toLocaleString('en-IN')}</span>
                </td>
                <td style="padding:14px 16px; text-align:center;">
                    <button type="button" class="icon-btn btn-edit-rate" onclick="event.stopPropagation(); window.openRateModal('customer', ${custId}, '', '${escapeHtml(custName)}', ${custRate})" title="Edit Default Billing Rate" style="color:#0f766e; background:#f0fdfa; border:1px solid #99f6e4; padding:5px 9px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:700;">
                        <i class="fa-solid fa-pen-to-square"></i> Rate
                    </button>
                </td>
            `;

            custTr.addEventListener('click', () => {
                window.toggleCustomerRow(custId);
            });

            tbody.appendChild(custTr);

            // Level 2: Plant / Branch Rows
            plants.forEach((plant, plantIdx) => {
                const plantKey = `${custId}_${plantIdx}`;
                const plantName = plant.plant_name || plant.branchName || plant.branch || 'Main Plant';
                const plantGst = plant.gst_no || plant.gstNo || plant.gst || 'No GST';
                const plantRate = parseFloat(plant.hourly_rate || plant.billingRate || custRate);
                const plantHours = parseFloat(plant.total_hours || plant.totalHours || 0);
                const plantTickets = parseInt(plant.total_tickets || plant.totalTickets || 0, 10);
                const plantPayable = parseFloat(plant.total_payable || plant.totalPayable || 0);
                const projects = plant.projects || [];
                const projCount = projects.length;

                const plantTr = document.createElement('tr');
                plantTr.className = `report-row-plant cust-child-${custId}`;
                plantTr.dataset.plantKey = plantKey;
                plantTr.style.display = 'none';
                plantTr.style.cursor = 'pointer';
                plantTr.style.background = '#ffffff';
                plantTr.style.borderBottom = '1px solid #f1f5f9';

                plantTr.innerHTML = `
                    <td style="padding:12px 16px;">
                        <div style="display:flex; align-items:center; gap:8px; padding-left:26px;">
                            <i class="fa-solid fa-chevron-right plant-chevron" id="plant-chevron-${plantKey}" style="color:#0284c7; width:12px; font-size:11px; transition:transform 0.2s;"></i>
                            <i class="fa-solid fa-industry" style="color:#0284c7; font-size:13px;"></i>
                            <span style="font-size:13.5px; font-weight:700; color:#1e293b;">${escapeHtml(plantName)}</span>
                            ${plant.isActivePlant ? '<span style="width:7px; height:7px; border-radius:50%; background:#22c55e; display:inline-block;" title="Active Plant"></span>' : ''}
                        </div>
                    </td>
                    <td style="padding:12px 12px;">
                        <span style="font-family:monospace; font-size:11.5px; font-weight:600; color:#475569; background:#f8fafc; padding:2px 6px; border-radius:4px; border:1px solid #e2e8f0;">${escapeHtml(plantGst)}</span>
                        <span style="font-size:11px; color:#64748b; margin-left:4px;">(${projCount} ${projCount === 1 ? 'proj' : 'projs'})</span>
                    </td>
                    <td style="padding:12px 12px; text-align:center;">
                        <span style="font-weight:700; color:#475569; font-size:12px;">${plantTickets}</span>
                    </td>
                    <td style="padding:12px 12px;">
                        <span style="font-weight:700; color:#334155; font-size:12.5px;">${plantHours.toFixed(2)} hrs</span>
                    </td>
                    <td style="padding:12px 12px;">
                        <div style="display:flex; align-items:center; gap:5px;">
                            <span style="color:#0284c7; font-weight:800; font-size:12.5px;">₹${Number(plantRate).toLocaleString('en-IN')}/hr</span>
                            <span style="font-size:9.5px; color:#64748b; background:#f0f9ff; padding:1px 4px; border-radius:3px; font-weight:600;">Plant</span>
                        </div>
                    </td>
                    <td style="padding:12px 16px; text-align:right;">
                        <span style="font-weight:800; font-size:13px; color:#0f766e;">₹${Math.round(plantPayable).toLocaleString('en-IN')}</span>
                    </td>
                    <td style="padding:12px 16px; text-align:center;">
                        <button type="button" class="icon-btn btn-edit-rate" onclick="event.stopPropagation(); window.openRateModal('plant', ${custId}, '${escapeHtml(plantName)}', '${escapeHtml(custName + ' - ' + plantName)}', ${plantRate})" title="Edit Plant Rate" style="color:#0284c7; background:#f0f9ff; border:1px solid #bae6fd; padding:3px 7px; border-radius:5px; font-size:11.5px; cursor:pointer;">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                    </td>
                `;

                plantTr.addEventListener('click', () => {
                    window.togglePlantRow(plantKey);
                });

                tbody.appendChild(plantTr);

                // Level 3: Project Rows
                projects.forEach(proj => {
                    const projId = proj.project_id || proj.projectId || proj.id;
                    const projKey = `${plantKey}_${projId || 'gen'}`;
                    const projName = proj.project_name || proj.projectName || proj.name || 'Core Operations';
                    const projRate = parseFloat(proj.hourly_rate || proj.billingRate || plantRate);
                    const projHours = parseFloat(proj.total_hours || proj.totalHours || 0);
                    const projTickets = parseInt(proj.total_tickets || proj.totalTickets || 0, 10);
                    const projCost = parseFloat(proj.total_cost || proj.totalCost || proj.totalPayable || 0);
                    const projStatus = proj.status || 'Active';
                    const employees = proj.employees || [];
                    const empCount = employees.length;

                    const projTr = document.createElement('tr');
                    projTr.className = `report-row-project plant-child-${plantKey}`;
                    projTr.dataset.projKey = projKey;
                    projTr.style.display = 'none';
                    projTr.style.cursor = 'pointer';
                    projTr.style.background = '#f8fafc';
                    projTr.style.borderBottom = '1px solid #e2e8f0';

                    projTr.innerHTML = `
                        <td style="padding:10px 16px;">
                            <div style="display:flex; align-items:center; gap:8px; padding-left:52px;">
                                <i class="fa-solid fa-chevron-right proj-chevron" id="proj-chevron-${projKey}" style="color:#6366f1; width:11px; font-size:10.5px; transition:transform 0.2s;"></i>
                                <i class="fa-solid fa-folder-tree" style="color:#6366f1; font-size:12px;"></i>
                                <span style="font-size:13px; font-weight:700; color:#334155;">${escapeHtml(projName)}</span>
                                <span class="badge" style="background:${projStatus === 'Completed' ? '#dcfce7' : '#e0e7ff'}; color:${projStatus === 'Completed' ? '#15803d' : '#4338ca'}; font-size:10px; padding:2px 6px; border-radius:4px; font-weight:700;">${escapeHtml(projStatus)}</span>
                            </div>
                        </td>
                        <td style="padding:10px 12px;">
                            <span style="font-size:11px; color:#64748b; font-weight:600;">${escapeHtml(proj.project_code || proj.projectCode || '-')}</span>
                            <span style="font-size:11px; color:#64748b; margin-left:4px;">(${empCount} ${empCount === 1 ? 'emp' : 'emps'})</span>
                        </td>
                        <td style="padding:10px 12px; text-align:center;">
                            <span style="font-weight:600; color:#64748b; font-size:11.5px;">${projTickets}</span>
                        </td>
                        <td style="padding:10px 12px;">
                            <span style="font-weight:600; color:#334155; font-size:12px;">${projHours.toFixed(2)} hrs</span>
                        </td>
                        <td style="padding:10px 12px;">
                            <div style="display:flex; align-items:center; gap:5px;">
                                <span style="color:#6366f1; font-weight:800; font-size:12px;">₹${Number(projRate).toLocaleString('en-IN')}/hr</span>
                                <span style="font-size:9px; color:#64748b; background:#eef2ff; padding:1px 4px; border-radius:3px; font-weight:600;">Proj</span>
                            </div>
                        </td>
                        <td style="padding:10px 16px; text-align:right;">
                            <span style="font-weight:800; font-size:12.5px; color:#334155;">₹${Math.round(projCost).toLocaleString('en-IN')}</span>
                        </td>
                        <td style="padding:10px 16px; text-align:center;">
                            ${projId ? `
                                <button type="button" class="icon-btn btn-edit-rate" onclick="event.stopPropagation(); window.openRateModal('project', ${projId}, '', '${escapeHtml(projName)}', ${projRate})" title="Edit Project Rate" style="color:#6366f1; background:#eef2ff; border:1px solid #c7d2fe; padding:2px 6px; border-radius:4px; font-size:11px; cursor:pointer;">
                                    <i class="fa-solid fa-pen-to-square"></i>
                                </button>
                            ` : ''}
                        </td>
                    `;

                    projTr.addEventListener('click', () => {
                        window.toggleProjectRow(projKey);
                    });

                    tbody.appendChild(projTr);

                    // Level 4: Employee Rows
                    employees.forEach(emp => {
                        const empId = emp.employee_id || emp.employeeId || emp.id;
                        const empName = emp.employee_name || emp.employeeName || emp.full_name || 'Assigned Staff';
                        const empCode = emp.employee_code || emp.employeeCode || `EMP-${empId || '000'}`;
                        const empRate = parseFloat(emp.hourly_rate || emp.hourlyRate || projRate);
                        const empHours = parseFloat(emp.total_hours || emp.totalHours || emp.hours || 0);
                        const empCost = parseFloat(emp.total_cost || emp.totalCost || (empHours * empRate));
                        const tasks = emp.tasks_done || emp.tickets || [];
                        const taskCount = tasks.length;

                        const empTr = document.createElement('tr');
                        empTr.className = `report-row-emp proj-child-${projKey}`;
                        empTr.style.display = 'none';
                        empTr.style.background = '#ffffff';
                        empTr.style.borderBottom = '1px solid #f1f5f9';

                        const initials = getInitials(empName);

                        empTr.innerHTML = `
                            <td style="padding:9px 16px;">
                                <div style="padding-left:78px; display:flex; align-items:center; gap:8px;">
                                    <div style="width:24px; height:24px; border-radius:50%; background:linear-gradient(135deg, #0d9488, #0f766e); color:white; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:800; flex-shrink:0;">${initials}</div>
                                    <div>
                                        <div style="font-size:12.5px; font-weight:800; color:#0f172a;">${escapeHtml(empName)}</div>
                                        <div style="font-size:10.5px; color:#64748b; font-weight:600;">${escapeHtml(empCode)} • ${escapeHtml(emp.role || 'Staff')}</div>
                                    </div>
                                </div>
                            </td>
                            <td style="padding:9px 12px;">
                                <span style="font-size:11px; color:#64748b;">${taskCount} ${taskCount === 1 ? 'task/ticket' : 'tasks/tickets'}</span>
                            </td>
                            <td style="padding:9px 12px; text-align:center;">
                                <span style="font-weight:600; font-size:11.5px; color:#475569;">${taskCount}</span>
                            </td>
                            <td style="padding:9px 12px;">
                                <span style="font-weight:700; color:#0f172a; font-size:12px;">${empHours.toFixed(2)} hrs</span>
                            </td>
                            <td style="padding:9px 12px;">
                                <div style="display:flex; align-items:center; gap:5px;">
                                    <span style="color:#0d9488; font-weight:800; font-size:12px;">₹${Number(empRate).toLocaleString('en-IN')}/hr</span>
                                    <span style="font-size:9px; color:#64748b; background:#f0fdfa; padding:1px 4px; border-radius:3px; font-weight:600;">Emp</span>
                                </div>
                            </td>
                            <td style="padding:9px 16px; text-align:right;">
                                <div style="font-weight:800; font-size:12.5px; color:#047857;">₹${Math.round(empCost).toLocaleString('en-IN')}</div>
                                <div style="font-size:10px; color:#64748b;">${empHours.toFixed(1)}h × ₹${Number(empRate).toLocaleString('en-IN')}</div>
                            </td>
                            <td style="padding:9px 16px; text-align:center;">
                                ${empId ? `
                                    <button type="button" class="icon-btn btn-edit-rate" onclick="event.stopPropagation(); window.openRateModal('employee', ${empId}, '', '${escapeHtml(empName)}', ${empRate})" title="Edit Employee Rate" style="color:#0d9488; background:#f0fdfa; border:1px solid #99f6e4; padding:2px 6px; border-radius:4px; font-size:11px; cursor:pointer;">
                                        <i class="fa-solid fa-pen-to-square"></i>
                                    </button>
                                ` : ''}
                            </td>
                        `;

                        tbody.appendChild(empTr);

                        // If employee has specific tickets/tasks, render task item rows
                        if (taskCount > 0) {
                            tasks.forEach(ticket => {
                                const taskTr = document.createElement('tr');
                                taskTr.className = `report-row-emp proj-child-${projKey}`;
                                taskTr.style.display = 'none';
                                taskTr.style.background = '#fcfdfe';
                                taskTr.style.borderBottom = '1px dashed #e2e8f0';

                                const tCode = ticket.code || ticket.ticket_code || ticket.ticket_number || 'TASK';
                                const tTitle = ticket.title || ticket.description || 'Support Task';
                                const tStatus = ticket.status || 'Completed';
                                const durHours = parseFloat(ticket.hours || ticket.duration_hours || 0);
                                const tRate = parseFloat(ticket.rate || empRate);
                                const tCost = parseFloat(ticket.cost || (durHours * tRate));

                                taskTr.innerHTML = `
                                    <td style="padding:6px 16px;">
                                        <div style="padding-left:106px; display:flex; align-items:center; gap:6px;">
                                            <i class="fa-solid fa-circle-check" style="color:#10b981; font-size:10px;"></i>
                                            <span style="font-family:monospace; font-size:11px; font-weight:700; color:#0284c7;">${escapeHtml(tCode)}</span>
                                            <span style="font-size:11.5px; color:#475569; max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(tTitle)}">${escapeHtml(tTitle)}</span>
                                        </div>
                                    </td>
                                    <td style="padding:6px 12px;">
                                        <span style="font-size:10.5px; color:#64748b;">${escapeHtml(tStatus)}</span>
                                    </td>
                                    <td style="padding:6px 12px; text-align:center;">
                                        <span style="font-size:10.5px; color:#94a3b8;">1</span>
                                    </td>
                                    <td style="padding:6px 12px;">
                                        <span style="font-size:11.5px; color:#475569; font-weight:600;">${durHours.toFixed(2)} hrs</span>
                                    </td>
                                    <td style="padding:6px 12px;">
                                        <span style="font-size:11px; color:#64748b;">₹${tRate.toLocaleString('en-IN')}/hr</span>
                                    </td>
                                    <td style="padding:6px 16px; text-align:right;">
                                        <span style="font-size:11.5px; color:#059669; font-weight:700;">₹${Math.round(tCost).toLocaleString('en-IN')}</span>
                                    </td>
                                    <td style="padding:6px 16px; text-align:center;">
                                        <span style="font-size:10px; color:#94a3b8;"><i class="fa-solid fa-lock" title="Calculated from employee rate"></i></span>
                                    </td>
                                `;
                                tbody.appendChild(taskTr);
                            });
                        }
                    });
                });
            });
        });
    }

    // Drill-Down Toggle Functions
    window.toggleCustomerRow = function(custId) {
        const custChevron = document.getElementById(`cust-chevron-${custId}`);
        const plantRows = document.querySelectorAll(`.cust-child-${custId}`);
        
        const isExpanded = custChevron && custChevron.style.transform === 'rotate(90deg)';

        if (isExpanded) {
            if (custChevron) custChevron.style.transform = 'rotate(0deg)';
            plantRows.forEach(row => {
                row.style.display = 'none';
                const plantKey = row.dataset.plantKey;
                if (plantKey) {
                    const plantChevron = document.getElementById(`plant-chevron-${plantKey}`);
                    if (plantChevron) plantChevron.style.transform = 'rotate(0deg)';
                    const projRows = document.querySelectorAll(`.plant-child-${plantKey}`);
                    projRows.forEach(pRow => {
                        pRow.style.display = 'none';
                        const projKey = pRow.dataset.projKey;
                        if (projKey) {
                            const projChevron = document.getElementById(`proj-chevron-${projKey}`);
                            if (projChevron) projChevron.style.transform = 'rotate(0deg)';
                            const empRows = document.querySelectorAll(`.proj-child-${projKey}`);
                            empRows.forEach(eRow => eRow.style.display = 'none');
                        }
                    });
                }
            });
        } else {
            if (custChevron) custChevron.style.transform = 'rotate(90deg)';
            plantRows.forEach(row => {
                row.style.display = 'table-row';
            });
        }
    };

    window.togglePlantRow = function(plantKey) {
        const plantChevron = document.getElementById(`plant-chevron-${plantKey}`);
        const projRows = document.querySelectorAll(`.plant-child-${plantKey}`);
        
        const isExpanded = plantChevron && plantChevron.style.transform === 'rotate(90deg)';

        if (isExpanded) {
            if (plantChevron) plantChevron.style.transform = 'rotate(0deg)';
            projRows.forEach(pRow => {
                pRow.style.display = 'none';
                const projKey = pRow.dataset.projKey;
                if (projKey) {
                    const projChevron = document.getElementById(`proj-chevron-${projKey}`);
                    if (projChevron) projChevron.style.transform = 'rotate(0deg)';
                    const empRows = document.querySelectorAll(`.proj-child-${projKey}`);
                    empRows.forEach(eRow => eRow.style.display = 'none');
                }
            });
        } else {
            if (plantChevron) plantChevron.style.transform = 'rotate(90deg)';
            projRows.forEach(pRow => {
                pRow.style.display = 'table-row';
            });
        }
    };

    window.toggleProjectRow = function(projKey) {
        const projChevron = document.getElementById(`proj-chevron-${projKey}`);
        const empRows = document.querySelectorAll(`.proj-child-${projKey}`);
        
        const isExpanded = projChevron && projChevron.style.transform === 'rotate(90deg)';

        if (isExpanded) {
            if (projChevron) projChevron.style.transform = 'rotate(0deg)';
            empRows.forEach(eRow => {
                eRow.style.display = 'none';
            });
        } else {
            if (projChevron) projChevron.style.transform = 'rotate(90deg)';
            empRows.forEach(eRow => {
                eRow.style.display = 'table-row';
            });
        }
    };

    // Expand All / Collapse All Toggle
    if (btnToggleExpandAll) {
        btnToggleExpandAll.addEventListener('click', () => {
            isAllExpanded = !isAllExpanded;
            const allPlantRows = document.querySelectorAll('.report-row-plant');
            const allProjRows = document.querySelectorAll('.report-row-project');
            const allEmpRows = document.querySelectorAll('.report-row-emp');
            const allChevrons = document.querySelectorAll('.cust-chevron, .plant-chevron, .proj-chevron');

            const displayStyle = isAllExpanded ? 'table-row' : 'none';
            const rotateStyle = isAllExpanded ? 'rotate(90deg)' : 'rotate(0deg)';

            allPlantRows.forEach(r => r.style.display = displayStyle);
            allProjRows.forEach(r => r.style.display = displayStyle);
            allEmpRows.forEach(r => r.style.display = displayStyle);
            allChevrons.forEach(c => c.style.transform = rotateStyle);

            btnToggleExpandAll.innerHTML = isAllExpanded
                ? '<i class="fa-solid fa-compress"></i> Collapse All'
                : '<i class="fa-solid fa-up-down-left-right"></i> Expand All';
        });
    }

    // Rate Modal Logic
    window.openRateModal = function(entityType, entityId, branchName, entityLabel, currentRate) {
        if (!rateModal) return;

        const entityTypeInput = document.getElementById('rate-entity-type');
        const entityIdInput = document.getElementById('rate-entity-id');
        const branchNameInput = document.getElementById('rate-branch-name');
        const entityLabelInput = document.getElementById('rate-entity-label');
        const inputValue = document.getElementById('rate-input-value');

        if (entityTypeInput) entityTypeInput.value = entityType || '';
        if (entityIdInput) entityIdInput.value = entityId || '';
        if (branchNameInput) branchNameInput.value = branchName || '';
        if (entityLabelInput) entityLabelInput.value = entityLabel || '';
        if (inputValue) inputValue.value = currentRate || 1000;

        rateModal.style.display = 'flex';
    };

    window.closeRateModal = function() {
        if (rateModal) rateModal.style.display = 'none';
    };

    if (rateModalClose) rateModalClose.addEventListener('click', closeRateModal);
    if (rateModalCancel) rateModalCancel.addEventListener('click', closeRateModal);

    if (rateEditForm) {
        rateEditForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const entityType = document.getElementById('rate-entity-type').value;
            const entityId = document.getElementById('rate-entity-id').value;
            const branchName = document.getElementById('rate-branch-name').value;
            const hourlyRate = parseFloat(document.getElementById('rate-input-value').value);

            if (isNaN(hourlyRate) || hourlyRate < 0) {
                alert('Please enter a valid hourly rate.');
                return;
            }

            try {
                const token = localStorage.getItem('token') || '';
                const headers = { 'Content-Type': 'application/json' };
                if (token) headers['Authorization'] = `Bearer ${token}`;

                const res = await fetch('/api/v1/customers/billing-rate', {
                    method: 'PUT',
                    headers,
                    credentials: 'include',
                    body: JSON.stringify({
                        entityType,
                        entityId: entityId ? parseInt(entityId, 10) : null,
                        branchName,
                        hourlyRate
                    })
                });

                const result = await res.json();
                if (res.ok && result.success) {
                    closeRateModal();
                    loadCustomerBillingReport();
                    if (typeof showToast === 'function') {
                        showToast('Hourly billing rate updated & payable amounts recalculated!', 'success');
                    }
                } else {
                    alert(result.message || 'Failed to update billing rate.');
                }
            } catch (err) {
                console.error('Error updating billing rate:', err);
                alert('Network error updating billing rate.');
            }
        });
    }

    // CSV / Excel Export
    if (btnExportBillingCSV) {
        btnExportBillingCSV.addEventListener('click', async () => {
            const originalHTML = btnExportBillingCSV.innerHTML;
            btnExportBillingCSV.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Exporting Report...';
            btnExportBillingCSV.disabled = true;

            const safeStr = (v) => `"${String(v !== undefined && v !== null ? v : '').replace(/"/g, '""')}"`;
            const dateStr = new Date().toISOString().split('T')[0];

            try {
                // Ensure data is loaded first
                if (!cachedBillingReportData || cachedBillingReportData.length === 0) {
                    if (typeof loadCustomerBillingReport === 'function') {
                        await loadCustomerBillingReport();
                    }
                }

                const startDate = reportFilterStart ? reportFilterStart.value : '';
                const endDate = reportFilterEnd ? reportFilterEnd.value : '';
                const search = reportSearch ? reportSearch.value.trim() : '';

                const token = localStorage.getItem('token') || '';
                const headers = {};
                if (token && token !== 'null' && token !== 'undefined') {
                    headers['Authorization'] = `Bearer ${token}`;
                }

                const params = new URLSearchParams({ format: 'xlsx' });
                if (startDate) params.append('startDate', startDate);
                if (endDate) params.append('endDate', endDate);
                if (search) params.append('search', search);
                if (token && token !== 'null' && token !== 'undefined') params.append('token', token);

                let downloaded = false;
                try {
                    const res = await fetch(`/api/v1/customers/billing-report/export?${params.toString()}`, {
                        headers,
                        credentials: 'include'
                    });

                    if (res.ok) {
                        const blob = await res.blob();
                        const blobUrl = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = blobUrl;
                        a.download = `Customer_Plant_Billing_Report_${dateStr}.xlsx`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(blobUrl);
                        downloaded = true;
                    }
                } catch (fetchErr) {
                    console.warn('[Export] Server-side XLSX export failed, fallback to client CSV:', fetchErr);
                }

                // Client-side CSV Fallback if server export didn't complete
                if (!downloaded) {
                    if (!cachedBillingReportData || cachedBillingReportData.length === 0) {
                        alert('No billing report data available to export.');
                        return;
                    }

                    const rows = [
                        [
                            'Customer Name',
                            'Industry',
                            'Customer Hourly Rate (INR)',
                            'Customer Total Hours',
                            'Customer Total Tickets',
                            'Customer Total Payable (INR)',
                            'Plant / Branch Name',
                            'Plant GST',
                            'Plant Hourly Rate (INR)',
                            'Plant Total Hours',
                            'Plant Total Tickets',
                            'Plant Total Payable (INR)',
                            'Project Name',
                            'Project Status',
                            'Project Hourly Rate (INR)',
                            'Project Total Hours',
                            'Project Total Cost (INR)',
                            'Employee Name',
                            'Employee Code / Role',
                            'Employee Hourly Rate (INR)',
                            'Employee Hours Logged',
                            'Employee Total Cost (INR)',
                            'Tickets / Tasks Handled'
                        ]
                    ];

                    cachedBillingReportData.forEach(cust => {
                        const custName = cust.customer_name || cust.name || 'Customer';
                        const custIndustry = cust.industry || 'IT / Engineering';
                        const custRate = parseFloat(cust.billing_rate || cust.billingRate || 1000);
                        const custHours = parseFloat(cust.total_hours || cust.totalHours || 0);
                        const custTickets = parseInt(cust.total_tickets || cust.totalTickets || 0, 10);
                        const custPayable = parseFloat(cust.total_payable || cust.totalPayable || 0);

                        const plants = (cust.plants && cust.plants.length > 0)
                            ? cust.plants
                            : [{ plant_name: 'General / Main', gst_no: cust.gst_no || '', hourly_rate: custRate, total_hours: custHours, total_tickets: custTickets, total_payable: custPayable, projects: [] }];

                        plants.forEach(plant => {
                            const plantName = plant.plant_name || plant.branchName || plant.name || 'General';
                            const plantGst = plant.gst_no || plant.gstNo || '';
                            const plantRate = parseFloat(plant.hourly_rate || plant.billingRate || custRate);
                            const plantHours = parseFloat(plant.total_hours || plant.totalHours || 0);
                            const plantTickets = parseInt(plant.total_tickets || plant.totalTickets || 0, 10);
                            const plantPayable = parseFloat(plant.total_payable || plant.totalPayable || 0);

                            const projects = (plant.projects && plant.projects.length > 0)
                                ? plant.projects
                                : [{ project_name: 'Support & General Scope', status: 'Active', hourly_rate: plantRate, total_hours: plantHours, total_cost: plantPayable, employees: [] }];

                            projects.forEach(proj => {
                                const projName = proj.project_name || proj.projectName || 'General Maintenance';
                                const projStatus = proj.status || 'Active';
                                const projRate = parseFloat(proj.hourly_rate || proj.billingRate || plantRate);
                                const projHours = parseFloat(proj.total_hours || proj.totalHours || 0);
                                const projCost = parseFloat(proj.total_cost || proj.totalCost || 0);

                                const employees = (proj.employees && proj.employees.length > 0)
                                    ? proj.employees
                                    : [{ employee_name: 'Support Staff / Team', employee_code: 'Staff', hourly_rate: projRate, total_hours: projHours, total_cost: projCost, tasks_done: [] }];

                                employees.forEach(emp => {
                                    const empName = emp.employee_name || emp.employeeName || 'Staff';
                                    const empRole = emp.employee_code || emp.role || 'Staff';
                                    const empRate = parseFloat(emp.hourly_rate || emp.hourlyRate || projRate);
                                    const empHours = parseFloat(emp.total_hours || emp.totalHours || 0);
                                    const empCost = parseFloat(emp.total_cost || emp.totalCost || 0);

                                    let tasksSummary = '';
                                    if (Array.isArray(emp.tasks_done) && emp.tasks_done.length > 0) {
                                        tasksSummary = emp.tasks_done.map(t => `${t.code || t.task_name || t.title || 'Task'} (${t.hours || 0}h)`).join('; ');
                                    } else if (Array.isArray(emp.tickets) && emp.tickets.length > 0) {
                                        tasksSummary = emp.tickets.map(t => `${t.ticket_number || ''}: ${t.title || ''} (${t.duration_hours || 0}h)`).join('; ');
                                    } else {
                                        tasksSummary = `${projName} (${empHours.toFixed(2)} hrs)`;
                                    }

                                    rows.push([
                                        safeStr(custName),
                                        safeStr(custIndustry),
                                        custRate,
                                        custHours.toFixed(2),
                                        custTickets,
                                        Math.round(custPayable),
                                        safeStr(plantName),
                                        safeStr(plantGst),
                                        plantRate,
                                        plantHours.toFixed(2),
                                        plantTickets,
                                        Math.round(plantPayable),
                                        safeStr(projName),
                                        safeStr(projStatus),
                                        projRate,
                                        projHours.toFixed(2),
                                        Math.round(projCost),
                                        safeStr(empName),
                                        safeStr(empRole),
                                        empRate,
                                        empHours.toFixed(2),
                                        Math.round(empCost),
                                        safeStr(tasksSummary)
                                    ]);
                                });
                            });
                        });
                    });

                    const csvContent = '\uFEFF' + rows.map(e => e.join(',')).join('\n');
                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.setAttribute('href', url);
                    link.setAttribute('download', `Customer_Plant_Billing_Report_${dateStr}.csv`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                }
            } catch (err) {
                console.error('Error exporting billing report:', err);
                alert('Export failed: ' + (err.message || 'Unknown error'));
            } finally {
                btnExportBillingCSV.innerHTML = originalHTML;
                btnExportBillingCSV.disabled = false;
            }
        });
    }

    // ============ WhatsApp Project Contract Expiry Reminders ============
    window.triggerProjectContractWhatsapp = async (event, projectId, customerName, projectName) => {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        if (!projectId) return;

        const confirmMsg = `Send WhatsApp Contract Expiry Reminder to client for:\n\n• Customer: ${customerName}\n• Project: ${projectName}\n\nProceed?`;
        if (!confirm(confirmMsg)) return;

        const btn = event?.currentTarget;
        const origHtml = btn ? btn.innerHTML : '';
        if (btn) {
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            btn.disabled = true;
        }

        try {
            const res = await fetch(`/api/v1/admin/customers/projects/${projectId}/send-contract-reminder`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            const data = await res.json();

            if (res.ok && data.success) {
                if (typeof showToast === 'function') {
                    showToast(data.message || "Contract reminder sent via WhatsApp!", "success");
                } else {
                    alert(data.message || "Contract reminder sent via WhatsApp!");
                }
                loadCustomers();
            } else {
                alert(data.message || "Failed to send WhatsApp reminder.");
            }
        } catch (err) {
            console.error("Error sending project contract reminder:", err);
            alert("Error sending contract reminder: " + (err.message || 'Network error'));
        } finally {
            if (btn) {
                btn.innerHTML = origHtml;
                btn.disabled = false;
            }
        }
    };

    window.triggerAllContractReminders = async () => {
        if (!confirm("Run Contract Expiry Check now?\n\nThis will scan all active projects ending within 7 days and send WhatsApp reminders to client contact persons.")) {
            return;
        }

        const btn = document.getElementById('btn-contract-expiry-check');
        const origText = btn ? btn.innerHTML : '';
        if (btn) {
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking...';
            btn.disabled = true;
        }

        try {
            const res = await fetch(`/api/v1/admin/customers/projects/contract-expiry-check`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (res.ok && data.success) {
                const msg = `Contract Expiry Check Completed!\n\nProcessed: ${data.processed} project(s)\nReminders Sent: ${data.sent} WhatsApp message(s)`;
                alert(msg);
                loadCustomers();
            } else {
                alert("Contract check error: " + (data.message || data.error || 'Unknown error'));
            }
        } catch (err) {
            console.error("Error triggering contract expiry check:", err);
            alert("Network error running contract check: " + err.message);
        } finally {
            if (btn) {
                btn.innerHTML = origText;
                btn.disabled = false;
            }
        }
    };
});


