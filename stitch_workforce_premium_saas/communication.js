document.addEventListener('DOMContentLoaded', () => {
    // Modals
    const noticeModal = document.getElementById('notice-modal');
    const btnAddNotice = document.getElementById('btn-add-notice');
    const noticeClose = document.getElementById('notice-close') || document.getElementById('notice-modal-close');
    const noticeCancel = document.getElementById('notice-cancel') || document.getElementById('notice-modal-cancel');
    const noticeForm = document.getElementById('notice-form');

    // Controls
    const notTarget = document.getElementById('not-target') || document.getElementById('notice-target');
    const groupEmployeeSelect = document.getElementById('group-employee-select');
    const notEmployee = document.getElementById('not-employee');
    const noticesList = document.getElementById('notices-list');
    const logoutBtn = document.getElementById('logout-btn');

    // Cache
    let employeesCache = [];
    let announcementsCache = [];

    // Modal state open
    if (btnAddNotice) {
        btnAddNotice.addEventListener('click', () => {
            if (noticeForm) noticeForm.reset();
            if (groupEmployeeSelect) groupEmployeeSelect.style.display = 'none';
            if (noticeModal) {
                noticeModal.style.display = 'flex';
                noticeModal.style.opacity = '1';
                noticeModal.style.pointerEvents = 'auto';
                noticeModal.classList.add('active');
            }
        });
    }

    const closeModal = () => {
        if (noticeModal) {
            noticeModal.style.display = 'none';
            noticeModal.style.opacity = '0';
            noticeModal.style.pointerEvents = 'none';
            noticeModal.classList.remove('active');
        }
        if (noticeForm) noticeForm.reset();
    };

    window.closeNoticeModal = closeModal;

    if (noticeClose) noticeClose.addEventListener('click', closeModal);
    if (noticeCancel) noticeCancel.addEventListener('click', closeModal);
    if (noticeModal) {
        noticeModal.addEventListener('click', (e) => {
            if (e.target === noticeModal) closeModal();
        });
    }

    // Target audience selection toggle
    if (notTarget) {
        notTarget.addEventListener('change', () => {
            if (notTarget.value === 'Individual') {
                groupEmployeeSelect.style.display = 'flex';
                notEmployee.required = true;
            } else {
                groupEmployeeSelect.style.display = 'none';
                notEmployee.required = false;
                notEmployee.value = '';
            }
        });
    }

    // Fetch lists
    const loadCommunication = async () => {
        try {
            const token = localStorage.getItem('token') || (typeof getAuthToken === 'function' ? getAuthToken() : '');
            const headers = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const response = await fetch('/api/v1/admin/communication', {
                credentials: 'include',
                headers
            });
            const data = await response.json();
            if (response.ok && data.success) {
                employeesCache = data.data.employees || [];
                announcementsCache = data.data.announcements || [];

                populateEmployeesDropdown();
                renderAnnouncements();
            }
        } catch (error) {
            console.error("Error loading notices logs:", error);
        }
    };

    const populateEmployeesDropdown = () => {
        if (!notEmployee) return;
        notEmployee.innerHTML = '<option value="">Select Employee</option>';
        employeesCache.forEach(emp => {
            const opt = document.createElement('option');
            opt.value = emp.id;
            opt.textContent = emp.full_name;
            notEmployee.appendChild(opt);
        });
    };

    const renderAnnouncements = () => {
        if (!noticesList) return;
        noticesList.innerHTML = '';

        if (announcementsCache.length === 0) {
            noticesList.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--text-muted);">No announcements published yet</td></tr>`;
            return;
        }

        announcementsCache.forEach(not => {
            const dateStr = new Date(not.created_at).toLocaleString();
            const target = not.recipient_id ? `${not.full_name} (${not.employee_code})` : '<span class="status-pill progress">All Staff</span>';
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight:700;">${dateStr}</td>
                <td style="font-weight:800;color:var(--teal-900);">${not.title}</td>
                <td style="font-size:13px;max-width:320px;word-break:break-word;">${not.message}</td>
                <td>${target}</td>
            `;
            noticesList.appendChild(tr);
        });
    };

    // Form submit
    if (noticeForm) {
        noticeForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const titleEl = document.getElementById('not-title') || document.getElementById('notice-title');
            const messageEl = document.getElementById('not-message') || document.getElementById('notice-body');

            const payload = {
                title: titleEl ? titleEl.value.trim() : '',
                message: messageEl ? messageEl.value.trim() : '',
                targetType: notTarget ? notTarget.value : 'All Staff',
                employeeId: notEmployee ? notEmployee.value : ''
            };

            try {
                const token = localStorage.getItem('token') || (typeof getAuthToken === 'function' ? getAuthToken() : '');
                const headers = { 'Content-Type': 'application/json' };
                if (token) headers['Authorization'] = `Bearer ${token}`;
                const response = await fetch('/api/v1/admin/communication', {
                    method: 'POST',
                    credentials: 'include',
                    headers,
                    body: JSON.stringify(payload)
                });
                const data = await response.json();
                if (response.ok && data.success) {
                    closeModal();
                    loadCommunication();
                } else {
                    alert(data.message || 'Failed to broadcast announcement');
                }
            } catch (error) {
                console.error("Error publishing broadcast alert:", error);
            }
        });
    }

    // Tab selection
    const btnAnnouncements = document.getElementById('btn-announcements');
    const btnInboxTab = document.getElementById('btn-inbox-tab');
    const btnChat = document.getElementById('btn-chat');
    const btnSyncMailbox = document.getElementById('btn-sync-mailbox');
    const announcementsView = document.getElementById('announcements-view');
    const inboxView = document.getElementById('inbox-view');
    const chatView = document.getElementById('chat-view');
    const commTitle = document.getElementById('comm-title');
    const commDesc = document.getElementById('comm-desc');
    const inboxList = document.getElementById('inbox-list');
    const inboxCountBadge = document.getElementById('inbox-count-badge');

    let inboxCache = { tickets: [], notifications: [] };
    let currentInboxFilter = 'all';

    // Inbox Data Loader & Filter Handlers
    const loadInboxData = async () => {
        if (!inboxList) return;
        try {
            const token = localStorage.getItem('token') || (typeof getAuthToken === 'function' ? getAuthToken() : '');
            const headers = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const res = await fetch('/api/v1/admin/communication/inbox', {
                credentials: 'include',
                headers
            });
            const json = await res.json();
            if (res.ok && json.success) {
                inboxCache = json.data || { tickets: [], notifications: [] };
                updateInboxCounts();
                renderInboxStream();
            } else {
                inboxList.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:#dc2626;"><i class="fa-solid fa-triangle-exclamation"></i> Failed to load inbound mailbox: ${json.message || 'Error'}</td></tr>`;
            }
        } catch (e) {
            console.error("Error loading inbox stream:", e);
            inboxList.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:#dc2626;"><i class="fa-solid fa-circle-xmark"></i> Network error loading inbound items.</td></tr>`;
        }
    };

    window.switchCommTab = function(tabName) {
        const btnAnn = document.getElementById('btn-announcements');
        const btnInb = document.getElementById('btn-inbox-tab');
        const btnCh = document.getElementById('btn-chat');
        const btnSync = document.getElementById('btn-sync-mailbox');
        const btnAdd = document.getElementById('btn-add-notice');
        const annView = document.getElementById('announcements-view');
        const inbView = document.getElementById('inbox-view');
        const chView = document.getElementById('chat-view');
        const title = document.getElementById('comm-title');
        const desc = document.getElementById('comm-desc');

        [btnAnn, btnInb, btnCh].forEach(b => {
            if (b) {
                b.classList.remove('active');
                b.style.color = 'var(--text-muted)';
            }
        });

        if (tabName === 'notices') {
            if (btnAnn) { btnAnn.classList.add('active'); btnAnn.style.color = 'var(--text-dark)'; }
            if (annView) annView.style.display = 'block';
            if (inbView) inbView.style.display = 'none';
            if (chView) chView.style.display = 'none';
            if (btnAdd) btnAdd.style.display = 'inline-flex';
            if (btnSync) btnSync.style.display = 'none';
            if (title) title.textContent = 'Notice Board & Broadcasting';
            if (desc) desc.textContent = 'Publish office-wide alerts, schedule team announcements, or direct target alerts to individual staff.';
            if (typeof stopMessagePolling === 'function') stopMessagePolling();
        } else if (tabName === 'inbox') {
            if (btnInb) { btnInb.classList.add('active'); btnInb.style.color = 'var(--text-dark)'; }
            if (annView) annView.style.display = 'none';
            if (inbView) inbView.style.display = 'block';
            if (chView) chView.style.display = 'none';
            if (btnAdd) btnAdd.style.display = 'none';
            if (btnSync) btnSync.style.display = 'inline-flex';
            if (title) title.textContent = 'Inbound Mailbox & Alerts Inbox';
            if (desc) desc.textContent = 'Live stream of inbound customer emails, auto-created tickets, and internal staff CC notifications.';
            if (typeof stopMessagePolling === 'function') stopMessagePolling();
            if (typeof loadInboxData === 'function') loadInboxData();
        } else if (tabName === 'chat') {
            if (btnCh) { btnCh.classList.add('active'); btnCh.style.color = 'var(--text-dark)'; }
            if (annView) annView.style.display = 'none';
            if (inbView) inbView.style.display = 'none';
            if (chView) chView.style.display = 'block';
            if (btnAdd) btnAdd.style.display = 'none';
            if (btnSync) btnSync.style.display = 'none';
            if (title) title.textContent = 'Direct Chat Room';
            if (desc) desc.textContent = 'Chat in real-time with employee contacts or initiate a voice call.';
            if (typeof loadChatContacts === 'function') loadChatContacts();
            fetch('/api/v1/employee/inbox/mark-read', { method: 'POST', credentials: 'include' }).catch(() => {});
        }
    };

    if (btnAnnouncements) btnAnnouncements.addEventListener('click', () => window.switchCommTab('notices'));
    if (btnInboxTab) btnInboxTab.addEventListener('click', () => window.switchCommTab('inbox'));
    if (btnChat) btnChat.addEventListener('click', () => window.switchCommTab('chat'));

    const updateInboxCounts = () => {
        const tickets = inboxCache.tickets || [];
        const notifs = inboxCache.notifications || [];
        const emailTickets = tickets.filter(t => t.source === 'Email' || t.category === 'Email Inbound');
        
        const countAll = tickets.length + notifs.length;
        const countEmail = emailTickets.length;
        const countTickets = tickets.length;
        const countAlerts = notifs.length;

        const elAll = document.getElementById('count-all');
        const elEmail = document.getElementById('count-email');
        const elTickets = document.getElementById('count-tickets');
        const elAlerts = document.getElementById('count-alerts');

        if (elAll) elAll.textContent = countAll;
        if (elEmail) elEmail.textContent = countEmail;
        if (elTickets) elTickets.textContent = countTickets;
        if (elAlerts) elAlerts.textContent = countAlerts;

        if (inboxCountBadge) {
            if (countAll > 0) {
                inboxCountBadge.style.display = 'inline-block';
                inboxCountBadge.textContent = countAll;
            } else {
                inboxCountBadge.style.display = 'none';
            }
        }
    };

    const renderInboxStream = () => {
        if (!inboxList) return;
        const tickets = inboxCache.tickets || [];
        const notifs = inboxCache.notifications || [];

        let items = [];

        if (currentInboxFilter === 'all') {
            items = [
                ...tickets.map(t => ({ ...t, _kind: 'ticket' })),
                ...notifs.map(n => ({ ...n, _kind: 'notification' }))
            ];
        } else if (currentInboxFilter === 'email') {
            items = tickets.filter(t => t.source === 'Email' || t.category === 'Email Inbound').map(t => ({ ...t, _kind: 'ticket' }));
        } else if (currentInboxFilter === 'ticket') {
            items = tickets.map(t => ({ ...t, _kind: 'ticket' }));
        } else if (currentInboxFilter === 'alert') {
            items = notifs.map(n => ({ ...n, _kind: 'notification' }));
        }

        // Sort by created_at DESC
        items.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

        if (items.length === 0) {
            inboxList.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align:center; padding:45px 20px; color:var(--text-muted);">
                        <i class="fa-regular fa-envelope-open" style="font-size:36px; margin-bottom:12px; color:var(--teal-600); opacity:0.6; display:block;"></i>
                        <strong>No items found in this inbox filter</strong>
                        <p style="font-size:12.5px; margin-top:4px;">Incoming emails sent to support will automatically appear here.</p>
                    </td>
                </tr>
            `;
            return;
        }

        inboxList.innerHTML = items.map(item => {
            const isTicket = (item._kind === 'ticket');
            const isEmail = isTicket && (item.source === 'Email' || item.category === 'Email Inbound');
            const dateStr = item.created_at ? new Date(item.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recent';

            // Badge
            let badgeHtml = '';
            if (isEmail) {
                badgeHtml = `<span class="badge" style="background:rgba(2,132,199,0.15); color:#0284c7; border:1px solid rgba(2,132,199,0.3); font-weight:700;"><i class="fa-solid fa-envelope" style="margin-right:4px;"></i> Inbound Mail</span>`;
            } else if (isTicket) {
                badgeHtml = `<span class="badge" style="background:rgba(16,185,129,0.15); color:#059669; border:1px solid rgba(16,185,129,0.3); font-weight:700;"><i class="fa-solid fa-ticket" style="margin-right:4px;"></i> Portal Ticket</span>`;
            } else {
                badgeHtml = `<span class="badge" style="background:rgba(245,158,11,0.15); color:#d97706; border:1px solid rgba(245,158,11,0.3); font-weight:700;"><i class="fa-solid fa-bell" style="margin-right:4px;"></i> Alert / CC</span>`;
            }

            // Ticket code
            const tCode = item.ticket_code || (item.metadata && item.metadata.ticket_code) || '—';
            const tCodeHtml = (tCode && tCode !== '—') 
                ? `<a href="/admin-support.html?ticket_code=${encodeURIComponent(tCode)}" style="font-weight:800; color:var(--teal-700); text-decoration:none; font-family:monospace; background:rgba(255,255,255,0.4); padding:3px 7px; border-radius:4px; border:1px solid rgba(255,255,255,0.6);">${tCode}</a>`
                : `<span style="color:var(--text-muted); font-size:12px;">Notice</span>`;

            // Sender / Customer
            const senderName = isTicket ? (item.customer_name || 'Customer') : (item.recipient_name || 'Staff Member');
            const senderEmail = isTicket ? (item.customer_email || item.reported_by || '') : (item.employee_code || '');

            // Subject / Description
            const subject = item.title || item.subject || 'Support Request';
            const desc = item.description || item.message || '';
            const descSnippet = desc.length > 90 ? desc.substring(0, 90) + '...' : desc;

            // Attachments
            let atts = [];
            if (item.attachments) {
                try {
                    atts = typeof item.attachments === 'string' ? JSON.parse(item.attachments) : item.attachments;
                } catch(e) {}
            }
            const attBadge = (Array.isArray(atts) && atts.length > 0)
                ? `<span style="display:inline-flex; align-items:center; gap:3px; font-size:11px; background:rgba(2,132,199,0.1); color:#0284c7; padding:2px 6px; border-radius:4px; margin-top:4px; font-weight:700;"><i class="fa-solid fa-paperclip"></i> ${atts.length} Attachment${atts.length > 1 ? 's' : ''}</span>`
                : '';

            // Staff & CC
            const staffName = item.assigned_to_name || (isTicket ? 'Unassigned' : (item.recipient_name || 'All'));
            let ccHtml = '';
            if (item.cc_emails && Array.isArray(item.cc_emails) && item.cc_emails.length > 0) {
                ccHtml = `<div style="font-size:10.5px; color:var(--text-muted); margin-top:3px;"><strong>CC:</strong> ${item.cc_emails.slice(0, 2).join(', ')}${item.cc_emails.length > 2 ? ' +' + (item.cc_emails.length - 2) : ''}</div>`;
            }

            // Action button: Vibrant & clearly labeled
            let actionLink = '';
            if (tCode && tCode !== '—') {
                actionLink = `<a href="/admin-support.html?ticket_code=${encodeURIComponent(tCode)}" class="btn-inbox-action btn-ticket" title="Open Ticket ${tCode} in Support Desk"><i class="fa-solid fa-up-right-from-square" style="font-size:11px;"></i> View Ticket</a>`;
            } else if (isTicket) {
                actionLink = `<a href="/admin-support.html?id=${item.id}" class="btn-inbox-action btn-ticket" title="Open Ticket"><i class="fa-solid fa-ticket" style="font-size:11px;"></i> View Ticket</a>`;
            } else {
                actionLink = `<a href="/admin-support.html" class="btn-inbox-action btn-alert" title="Go to Support Desk"><i class="fa-solid fa-headset" style="font-size:11px;"></i> Support Desk</a>`;
            }

            return `
                <tr>
                    <td style="white-space:nowrap;">${badgeHtml}</td>
                    <td style="white-space:nowrap;">${tCodeHtml}</td>
                    <td style="overflow:hidden; text-overflow:ellipsis;">
                        <div style="font-weight:700; color:var(--text-dark); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${senderName}</div>
                        ${senderEmail ? `<div style="font-size:11px; color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${senderEmail}">${senderEmail}</div>` : ''}
                    </td>
                    <td style="word-break:break-word;">
                        <div style="font-weight:700; color:var(--teal-950); margin-bottom:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${subject}">${subject}</div>
                        <div style="font-size:12px; color:var(--text-muted); line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${descSnippet}</div>
                        ${attBadge}
                    </td>
                    <td style="overflow:hidden; text-overflow:ellipsis;">
                        <div style="font-weight:600; font-size:12px; color:var(--teal-900); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"><i class="fa-solid fa-user-check" style="margin-right:4px; font-size:10px;"></i>${staffName}</div>
                        ${ccHtml}
                    </td>
                    <td style="font-size:11.5px; color:var(--text-muted); white-space:nowrap;">${dateStr}</td>
                    <td style="text-align:right; white-space:nowrap; padding-right:16px;">${actionLink}</td>
                </tr>
            `;
        }).join('');
    };

    // Filter switcher
    window.setInboxFilter = function(filterType, clickedEl) {
        document.querySelectorAll('.inbox-filter-btn').forEach(b => {
            b.classList.remove('active');
            b.style.background = 'rgba(255,255,255,0.3)';
            b.style.color = 'var(--text-dark)';
            b.style.border = '1px solid rgba(255,255,255,0.5)';
        });
        if (clickedEl) {
            clickedEl.classList.add('active');
            clickedEl.style.background = 'var(--teal-700)';
            clickedEl.style.color = 'white';
            clickedEl.style.border = 'none';
        }

        currentInboxFilter = filterType || 'all';
        renderInboxStream();
    };

    // Filter Buttons wire
    document.querySelectorAll('.inbox-filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const filterType = e.currentTarget.getAttribute('data-filter') || 'all';
            window.setInboxFilter(filterType, e.currentTarget);
        });
    });

    // Wire Sync Mailbox Button
    window.triggerMailboxSync = async function() {
        const btn = document.getElementById('btn-sync-mailbox');
        const icon = btn ? btn.querySelector('i') : null;
        if (icon) icon.classList.add('fa-spin');
        if (btn) btn.disabled = true;

        try {
            const token = localStorage.getItem('token') || (typeof getAuthToken === 'function' ? getAuthToken() : '');
            const headers = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const res = await fetch('/api/v1/admin/communication/sync-mailbox', { 
                method: 'POST',
                credentials: 'include',
                headers
            });
            const json = await res.json();
            if (typeof showToast === 'function') {
                showToast(json.message || "Mailbox sync cycle initiated!", "success");
            }
            setTimeout(() => {
                loadInboxData();
                if (icon) icon.classList.remove('fa-spin');
                if (btn) btn.disabled = false;
            }, 2000);
        } catch (err) {
            console.error("Sync error:", err);
            if (icon) icon.classList.remove('fa-spin');
            if (btn) btn.disabled = false;
        }
    };

    if (btnSyncMailbox) {
        btnSyncMailbox.addEventListener('click', () => window.triggerMailboxSync());
    }

    window.loadInboxData = loadInboxData;

    // Auto-load inbox count badge on initial page open
    loadInboxData();

    // Chat State variables
    let chatChannels = { directMessages: [], taskGroups: [], departmentChannels: [] };
    let selectedChannel = null;
    let chatInterval = null;
    let currentUserId = null;

    // Fetch current user ID for message alignment
    fetch('/api/v1/auth/me', { credentials: 'include' })
        .then(r => r.json())
        .then(data => {
            if (data.success && data.data) {
                currentUserId = data.data.employee_id || data.data.id;
            }
        })
        .catch(e => console.error("Error loading me info:", e));

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

    const renderChatChannels = (filterQuery = '') => {
        const list = document.getElementById('chat-contacts-list');
        if (!list) return;
        list.innerHTML = '';

        const q = (filterQuery || '').toLowerCase().trim();

        // 💬 Section 1: Direct Messages
        const filteredDMs = (chatChannels.directMessages || []).filter(c => 
            !q || (c.full_name && c.full_name.toLowerCase().includes(q)) || 
            (c.designation && c.designation.toLowerCase().includes(q)) ||
            (c.department_name && c.department_name.toLowerCase().includes(q))
        );

        if (filteredDMs.length > 0) {
            const dmHeader = document.createElement('div');
            dmHeader.style.cssText = 'font-size:11px; font-weight:800; color:var(--teal-900); text-transform:uppercase; margin:10px 0 6px 4px;';
            dmHeader.innerHTML = '<i class="fa-solid fa-user"></i> Direct Messages';
            list.appendChild(dmHeader);

            filteredDMs.forEach(c => {
                const item = document.createElement('div');
                const isSelected = selectedChannel && selectedChannel.id === c.employee_id && selectedChannel.type === 'DM';
                const isBusy = c.presence_status === 'Busy';
                const statusDotColor = isBusy ? '#ef4444' : '#22c55e';
                const hasUnread = c.unread_count > 0;

                const avatarHtml = typeof window.renderEmpAvatar === 'function'
                    ? window.renderEmpAvatar(c.full_name, c.profile_picture, 36, 13)
                    : `<div style="width:36px;height:36px;border-radius:50%;background:#0d9488;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;border:2px solid #fff;">${(c.full_name||'').substring(0,2).toUpperCase()}</div>`;

                item.style.cssText = `
                    display:flex; align-items:center; gap:10px; padding:10px; border-radius:12px; cursor:pointer;
                    background:${isSelected ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.1)'};
                    margin-bottom:6px; border:1px solid rgba(0,0,0,0.04); transition: background 0.2s;
                `;
                item.innerHTML = `
                    <div style="position:relative; flex-shrink:0;">
                        ${avatarHtml}
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
        }

        // 👥 Section 2: Custom Groups
        const filteredGroups = (chatChannels.customGroups || []).filter(g => 
            !q || (g.name && g.name.toLowerCase().includes(q)) || 
            (g.description && g.description.toLowerCase().includes(q))
        );

        if (!q || filteredGroups.length > 0) {
            const grpHeader = document.createElement('div');
            grpHeader.style.cssText = 'font-size:11px; font-weight:800; color:var(--teal-900); text-transform:uppercase; margin:16px 0 6px 4px; display:flex; justify-content:space-between; align-items:center;';
            grpHeader.innerHTML = `
                <span><i class="fa-solid fa-user-group"></i> Groups (${(chatChannels.customGroups || []).length})</span>
                <button type="button" class="btn-create-group-trigger" title="Create New Group" style="background:none; border:none; color:var(--teal-600); cursor:pointer; font-size:11.5px; font-weight:800; padding:2px 6px; border-radius:4px; display:flex; align-items:center; gap:4px;">
                    <i class="fa-solid fa-plus"></i> New
                </button>
            `;
            list.appendChild(grpHeader);

            const btnTrigger = grpHeader.querySelector('.btn-create-group-trigger');
            if (btnTrigger) {
                btnTrigger.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (typeof window.openCreateGroupModal === 'function') {
                        window.openCreateGroupModal();
                    }
                });
            }

            if (filteredGroups.length === 0 && !q) {
                const noGrp = document.createElement('div');
                noGrp.style.cssText = 'font-size:11px; color:var(--text-muted); padding:6px 8px; font-style:italic;';
                noGrp.textContent = 'No groups yet. Click "+ New" to create one.';
                list.appendChild(noGrp);
            } else {
                filteredGroups.forEach(g => {
                    const item = document.createElement('div');
                    const isSelected = selectedChannel && selectedChannel.id === g.id && selectedChannel.type === 'Group';
                    const hasUnread = g.unread_count > 0;
                    const avatarHtml = typeof window.renderEmpAvatar === 'function'
                        ? window.renderEmpAvatar(g.name, null, 36, 13)
                        : `<div style="width:36px;height:36px;border-radius:50%;background:#0d9488;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;border:2px solid #fff;">${(g.name||'GP').substring(0,2).toUpperCase()}</div>`;

                    item.style.cssText = `
                        display:flex; align-items:center; gap:10px; padding:10px; border-radius:12px; cursor:pointer;
                        background:${isSelected ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.1)'};
                        margin-bottom:6px; border:1px solid rgba(0,0,0,0.04); transition: background 0.2s;
                    `;
                    item.innerHTML = `
                        <div style="flex-shrink:0;">${avatarHtml}</div>
                        <div style="flex:1; min-width:0;">
                            <div style="font-weight:700; font-size:13px; color:var(--teal-900); display:flex; justify-content:space-between; align-items:center;">
                                <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${g.name}</span>
                                ${hasUnread ? `<span style="width:8px; height:8px; border-radius:50%; background:#ef4444; display:inline-block; box-shadow:0 0 6px rgba(239,68,68,0.8);"></span>` : ''}
                            </div>
                            <div style="font-size:11px; color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                                ${g.member_count ? `${g.member_count} members` : 'Group'} ${g.description ? `• ${g.description}` : ''}
                            </div>
                        </div>
                    `;
                    item.addEventListener('click', () => selectChannelItem('Group', g.id, g.name, `${g.member_count || 1} members`));
                    list.appendChild(item);
                });
            }
        }

        // 👥 Section 3: Task Groups
        const filteredTasks = (chatChannels.taskGroups || []).filter(g => 
            !q || (g.name && g.name.toLowerCase().includes(q)) || 
            (g.task_title && g.task_title.toLowerCase().includes(q))
        );

        if (filteredTasks.length > 0) {
            const tgHeader = document.createElement('div');
            tgHeader.style.cssText = 'font-size:11px; font-weight:800; color:var(--teal-900); text-transform:uppercase; margin:16px 0 6px 4px;';
            tgHeader.innerHTML = '<i class="fa-solid fa-users"></i> Task Groups';
            list.appendChild(tgHeader);

            filteredTasks.forEach(g => {
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

        // 🏢 Section 4: Department Channels
        const filteredDepts = (chatChannels.departmentChannels || []).filter(d => 
            !q || (d.name && d.name.toLowerCase().includes(q)) || 
            (d.department_name && d.department_name.toLowerCase().includes(q))
        );

        if (filteredDepts.length > 0) {
            const deptHeader = document.createElement('div');
            deptHeader.style.cssText = 'font-size:11px; font-weight:800; color:var(--teal-900); text-transform:uppercase; margin:16px 0 6px 4px;';
            deptHeader.innerHTML = '<i class="fa-solid fa-building"></i> Department Channels';
            list.appendChild(deptHeader);

            filteredDepts.forEach(d => {
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

        const threadEmpty = document.getElementById('chat-thread-empty');
        const threadActive = document.getElementById('chat-thread-active');
        if (threadEmpty) threadEmpty.style.display = 'none';
        if (threadActive) threadActive.style.display = 'flex';

        const headerName = document.getElementById('chat-header-name') || document.getElementById('chat-active-header');
        if (headerName) headerName.textContent = title + (subtitle ? ` (${subtitle})` : '');
        const headerStatus = document.getElementById('chat-header-status');
        if (headerStatus) headerStatus.textContent = subtitle;

        const headerAvatarWrap = document.getElementById('chat-header-avatar-wrap');
        if (headerAvatarWrap) {
            headerAvatarWrap.innerHTML = typeof window.renderEmpAvatar === 'function'
                ? window.renderEmpAvatar(title, null, 36, 13)
                : `<div style="width:36px;height:36px;border-radius:50%;background:#0d9488;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;border:2px solid #fff;">${title.substring(0,2).toUpperCase()}</div>`;
            headerAvatarWrap.style.display = 'block';
        }

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

    // ── File Attachment Helpers & Rich Categorization ──
    const getFileInfo = (type, name) => {
        if (!type && !name) return { icon: 'fa-solid fa-file', color: '#64748b', badge: 'FILE' };
        const ext = (name || '').split('.').pop().toLowerCase();
        if (/^image\//.test(type) || ['jpg','jpeg','png','gif','webp','svg'].includes(ext)) {
            return { icon: 'fa-solid fa-file-image', color: '#0ea5e9', badge: 'IMAGE' };
        }
        if (type === 'application/pdf' || ext === 'pdf') {
            return { icon: 'fa-solid fa-file-pdf', color: '#ef4444', badge: 'PDF' };
        }
        if (['zip','rar','7z','tar','gz','bz2'].includes(ext)) {
            return { icon: 'fa-solid fa-file-zipper', color: '#f59e0b', badge: 'ZIP / FOLDER' };
        }
        if (['doc','docx','rtf','odt'].includes(ext)) {
            return { icon: 'fa-solid fa-file-word', color: '#2563eb', badge: 'DOC' };
        }
        if (['xls','xlsx','csv','ods'].includes(ext)) {
            return { icon: 'fa-solid fa-file-excel', color: '#10b981', badge: 'EXCEL / CSV' };
        }
        if (['ppt','pptx','odp'].includes(ext)) {
            return { icon: 'fa-solid fa-file-powerpoint', color: '#ea580c', badge: 'PPT' };
        }
        if (['txt','json','xml','html','css','js','ts','py','sql','md'].includes(ext)) {
            return { icon: 'fa-solid fa-file-lines', color: '#6366f1', badge: ext.toUpperCase() };
        }
        if (/^audio\//.test(type) || ['mp3','wav','ogg','m4a'].includes(ext)) {
            return { icon: 'fa-solid fa-file-audio', color: '#8b5cf6', badge: 'AUDIO' };
        }
        if (/^video\//.test(type) || ['mp4','webm','mov','avi','mkv'].includes(ext)) {
            return { icon: 'fa-solid fa-file-video', color: '#ec4899', badge: 'VIDEO' };
        }
        return { icon: 'fa-solid fa-file', color: '#64748b', badge: ext ? ext.toUpperCase() : 'FILE' };
    };

    const getFileIcon = (type, name) => getFileInfo(type, name).icon;

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
        const linkColor = isMe ? '#ffffff' : 'var(--teal-900)';
        const safeName = fileName || 'attachment';

        if (isImageFile(fileType, fileName)) {
            return `
            <div style="margin-top:8px;">
                <a href="${fileUrl}" target="_blank" style="display:inline-block; border-radius:10px; overflow:hidden; border:1px solid rgba(255,255,255,0.3); box-shadow:0 3px 10px rgba(0,0,0,0.12);">
                    <img src="${fileUrl}" alt="${safeName}" style="max-width:240px; max-height:200px; object-fit:cover; display:block;" />
                </a>
                <div style="display:flex; align-items:center; justify-content:space-between; margin-top:4px; font-size:11px; opacity:0.85;">
                    <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:180px;">📎 ${safeName}</span>
                    <a href="${fileUrl}" download="${safeName}" style="color:${isMe ? '#a9d94c' : 'var(--teal-700)'}; font-size:12px; margin-left:6px;" title="Download"><i class="fa-solid fa-download"></i></a>
                </div>
            </div>`;
        }

        const info = getFileInfo(fileType, fileName);

        return `
        <div style="margin-top:8px; padding:10px 12px; border-radius:12px; background:${isMe ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.04)'}; border:1px solid ${isMe ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.08)'}; display:flex; align-items:center; gap:10px; box-shadow:0 2px 6px rgba(0,0,0,0.04);">
            <div style="width:38px; height:38px; border-radius:10px; background:${info.color}1f; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                <i class="${info.icon}" style="font-size:20px; color:${info.color};"></i>
            </div>
            <div style="flex:1; min-width:0;">
                <div style="display:flex; align-items:center; gap:6px; margin-bottom:2px;">
                    <span style="font-size:9px; font-weight:800; padding:1px 5px; border-radius:4px; background:${info.color}22; color:${info.color}; text-transform:uppercase;">${info.badge}</span>
                    <span style="font-size:10.5px; opacity:0.75;">${formatFileSize(fileSize)}</span>
                </div>
                <a href="${fileUrl}" download="${safeName}" target="_blank" style="color:${linkColor}; font-weight:700; font-size:12.5px; text-decoration:none; display:block; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;" title="${safeName}">
                    ${safeName}
                </a>
            </div>
            <div style="display:flex; align-items:center; gap:6px;">
                <a href="${fileUrl}" target="_blank" style="width:28px; height:28px; border-radius:50%; background:${isMe ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.05)'}; color:${linkColor}; display:flex; align-items:center; justify-content:center; text-decoration:none; font-size:11px;" title="Open / Preview in New Tab">
                    <i class="fa-solid fa-arrow-up-right-from-square"></i>
                </a>
                <a href="${fileUrl}" download="${safeName}" style="width:28px; height:28px; border-radius:50%; background:${isMe ? 'rgba(255,255,255,0.25)' : 'var(--teal-600)'}; color:#ffffff; display:flex; align-items:center; justify-content:center; text-decoration:none; font-size:11px;" title="Download">
                    <i class="fa-solid fa-download"></i>
                </a>
            </div>
        </div>`;
    };

    // ── File & Folder Attachment State ──
    let pendingFile = null;
    const fileInput = document.getElementById('chat-file-input');
    const folderInput = document.getElementById('chat-folder-input');
    const attachBtn = document.getElementById('btn-chat-attach');
    const attachFolderBtn = document.getElementById('btn-chat-attach-folder');
    const filePreview = document.getElementById('chat-file-preview');
    const filePreviewName = document.getElementById('chat-file-preview-name');
    const filePreviewSize = document.getElementById('chat-file-preview-size');
    const filePreviewIcon = document.getElementById('chat-file-preview-icon');
    const fileCancelBtn = document.getElementById('chat-file-cancel');

    const stageSelectedFile = (file) => {
        if (!file) return;
        const blocked = /\.(exe|bat|cmd|sh|vbs|msi|scr|com|ps1)$/i;
        if (blocked.test(file.name || '')) {
            alert("Executable files (.exe, .bat, etc.) cannot be uploaded for security reasons.");
            return;
        }
        if (file.size > 50 * 1024 * 1024) {
            alert("File size exceeds 50MB limit.");
            return;
        }
        pendingFile = file;
        if (filePreview) {
            const info = getFileInfo(file.type, file.name);
            if (filePreviewName) filePreviewName.textContent = file.name;
            if (filePreviewSize) filePreviewSize.textContent = `${info.badge} • ${formatFileSize(file.size)}`;
            if (filePreviewIcon) {
                filePreviewIcon.className = info.icon;
                filePreviewIcon.style.color = info.color;
            }
            filePreview.style.display = 'flex';
        }
    };

    // Standard File Button Click (PDF, Docs, Images, Archives, etc.)
    if (attachBtn && fileInput) {
        attachBtn.addEventListener('click', () => {
            fileInput.value = '';
            fileInput.click();
        });
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                stageSelectedFile(fileInput.files[0]);
            }
        });
    }

    // Folder Button Click (Auto-ZIP entire selected folder)
    if (attachFolderBtn && folderInput) {
        attachFolderBtn.addEventListener('click', () => {
            folderInput.value = '';
            folderInput.click();
        });
        folderInput.addEventListener('change', async () => {
            const files = folderInput.files;
            if (!files || files.length === 0) return;

            const firstPath = files[0].webkitRelativePath || files[0].name;
            const folderName = firstPath.split('/')[0] || 'folder_archive';

            if (filePreview) {
                if (filePreviewName) filePreviewName.textContent = `Compressing folder "${folderName}" (${files.length} items)...`;
                if (filePreviewSize) filePreviewSize.textContent = 'Please wait...';
                if (filePreviewIcon) {
                    filePreviewIcon.className = 'fa-solid fa-spinner fa-spin';
                    filePreviewIcon.style.color = '#f59e0b';
                }
                filePreview.style.display = 'flex';
            }

            if (window.JSZip) {
                try {
                    const zip = new window.JSZip();
                    for (let i = 0; i < files.length; i++) {
                        const f = files[i];
                        const relPath = f.webkitRelativePath || f.name;
                        zip.file(relPath, f);
                    }
                    const zipBlob = await zip.generateAsync({
                        type: 'blob',
                        compression: 'DEFLATE',
                        compressionOptions: { level: 6 }
                    });
                    const zippedFile = new File([zipBlob], `${folderName}.zip`, { type: 'application/zip' });
                    stageSelectedFile(zippedFile);
                } catch (err) {
                    console.error("Folder compression error:", err);
                    alert("Could not compress folder: " + err.message);
                    pendingFile = null;
                    if (filePreview) filePreview.style.display = 'none';
                }
            } else {
                alert("JSZip library is still loading. Please try again or select a .zip file directly.");
                if (filePreview) filePreview.style.display = 'none';
            }
        });
    }

    // Remove staged file
    if (fileCancelBtn) {
        fileCancelBtn.addEventListener('click', () => {
            pendingFile = null;
            if (fileInput) fileInput.value = '';
            if (folderInput) folderInput.value = '';
            if (filePreview) filePreview.style.display = 'none';
        });
    }

    // Drag and Drop files onto chat container
    const messagesContainer = document.getElementById('chat-messages-container');
    if (messagesContainer) {
        ['dragenter', 'dragover'].forEach(eventName => {
            messagesContainer.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                messagesContainer.style.outline = '2px dashed var(--teal-600)';
                messagesContainer.style.outlineOffset = '-4px';
                messagesContainer.style.background = 'rgba(13, 148, 136, 0.08)';
            });
        });
        ['dragleave', 'drop'].forEach(eventName => {
            messagesContainer.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                messagesContainer.style.outline = '';
                messagesContainer.style.outlineOffset = '';
                messagesContainer.style.background = '';
            });
        });
        messagesContainer.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            if (dt && dt.files && dt.files.length > 0) {
                stageSelectedFile(dt.files[0]);
            }
        });
    }

    // Paste handler (Ctrl+V) for attachments and screenshot images
    document.addEventListener('paste', (e) => {
        const chatView = document.getElementById('chat-view');
        if (!chatView || chatView.style.display === 'none') return;
        const items = (e.clipboardData || window.clipboardData)?.items;
        if (!items) return;
        for (let i = 0; i < items.length; i++) {
            if (items[i].kind === 'file') {
                const pasted = items[i].getAsFile();
                if (pasted) {
                    const ext = pasted.type ? (pasted.type.split('/')[1] || 'png') : 'png';
                    const fileWithProperName = pasted.name && !pasted.name.startsWith('image')
                        ? pasted 
                        : new File([pasted], `clipboard_${Date.now()}.${ext}`, { type: pasted.type });
                    stageSelectedFile(fileWithProperName);
                    break;
                }
            }
        }
    });

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
        const input = document.getElementById('chat-message-input') || document.getElementById('chat-input');
        const sendBtn = document.getElementById('btn-chat-send') || document.getElementById('chat-send-btn');
        if (!input || !selectedChannel) return;
        const msg = input.value.trim();
        if (!msg && !pendingFile) return;

        const originalBtnHTML = sendBtn ? sendBtn.innerHTML : '';
        if (sendBtn) {
            sendBtn.disabled = true;
            sendBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        }

        try {
            const formData = new FormData();
            if (pendingFile) formData.append('file', pendingFile);

            if (selectedChannel.type === 'DM') {
                formData.append('recipient_id', selectedChannel.id);
                formData.append('message', msg || '');
                const res = await fetch('/api/v1/employee/chat/send', {
                    method: 'POST',
                    body: formData,
                    credentials: 'include'
                });
                const resData = await res.json();
                if (!res.ok || !resData.success) {
                    alert(resData.message || 'Failed to send message/file');
                }
            } else {
                formData.append('channelId', selectedChannel.id);
                formData.append('messageText', msg || '');
                const res = await fetch('/api/v1/chat/messages', {
                    method: 'POST',
                    body: formData,
                    credentials: 'include'
                });
                const resData = await res.json();
                if (!res.ok || !resData.success) {
                    alert(resData.message || 'Failed to send message/file');
                }
            }
            input.value = '';
            pendingFile = null;
            if (fileInput) fileInput.value = '';
            if (folderInput) folderInput.value = '';
            if (filePreview) filePreview.style.display = 'none';
            await loadMessages();
        } catch (e) {
            console.error("Error sending message:", e);
            alert("Error sending attachment/message: " + (e.message || e));
        } finally {
            if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.innerHTML = originalBtnHTML;
            }
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
    const sendBtn = document.getElementById('btn-chat-send') || document.getElementById('chat-send-btn');
    const msgInput = document.getElementById('chat-message-input') || document.getElementById('chat-input');
    if (sendBtn) sendBtn.addEventListener('click', sendChatMessage);
    if (msgInput) {
        msgInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') sendChatMessage();
        });
    }

    // Contact / Group Search Listener
    const contactSearchInput = document.getElementById('chat-contact-search');
    if (contactSearchInput) {
        contactSearchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            renderChatChannels(query);
        });
    }

    // ── Create Chat Group Modal Logic ──
    const groupModal = document.getElementById('create-group-modal');
    const groupForm = document.getElementById('create-group-form');
    const groupNameInput = document.getElementById('new-group-name');
    const groupDescInput = document.getElementById('new-group-desc');
    const groupMembersList = document.getElementById('group-members-checklist');
    const groupMemberFilter = document.getElementById('group-member-filter');
    const groupSelectedCount = document.getElementById('group-selected-count');
    const btnToggleAll = document.getElementById('btn-toggle-all-members');
    const btnOpenCreateGroup = document.getElementById('btn-open-create-group');
    const btnCloseCreateGroup = document.getElementById('create-group-close');
    const btnCancelCreateGroup = document.getElementById('create-group-cancel');
    const btnSubmitCreateGroup = document.getElementById('create-group-submit');

    let allAvailableMembers = [];
    let selectedMemberIds = new Set();

    const fetchAvailableMembers = async () => {
        try {
            if (employeesCache && employeesCache.length > 0) {
                allAvailableMembers = employeesCache.map(e => ({
                    id: e.id,
                    full_name: e.full_name,
                    role: e.designation_name || e.designation || e.department_name || 'Employee'
                }));
                return;
            }
            const res = await fetch('/api/v1/organization/directory');
            const data = await res.json();
            if (res.ok && data.success && data.data && data.data.employees) {
                allAvailableMembers = data.data.employees.map(e => ({
                    id: e.id,
                    full_name: e.full_name,
                    role: e.designation_name || e.department_name || 'Employee'
                }));
            } else if (chatChannels && chatChannels.directMessages && chatChannels.directMessages.length > 0) {
                allAvailableMembers = chatChannels.directMessages.map(e => ({
                    id: e.employee_id,
                    full_name: e.full_name,
                    role: e.designation || e.department_name || 'Staff'
                }));
            }
        } catch (err) {
            console.error("Error fetching group members list:", err);
            if (chatChannels && chatChannels.directMessages) {
                allAvailableMembers = chatChannels.directMessages.map(e => ({
                    id: e.employee_id,
                    full_name: e.full_name,
                    role: e.designation || e.department_name || 'Staff'
                }));
            }
        }
    };

    const renderGroupMembersChecklist = (filterText = '') => {
        if (!groupMembersList) return;
        groupMembersList.innerHTML = '';

        const query = (filterText || '').toLowerCase().trim();
        const filtered = allAvailableMembers.filter(m => {
            if (!query) return true;
            return (m.full_name && m.full_name.toLowerCase().includes(query)) ||
                   (m.role && m.role.toLowerCase().includes(query));
        });

        if (filtered.length === 0) {
            groupMembersList.innerHTML = `<div style="padding:15px; text-align:center; color:#94a3b8; font-size:12px;">No members found matching "${filterText}"</div>`;
            return;
        }

        filtered.forEach(m => {
            const isChecked = selectedMemberIds.has(m.id);
            const row = document.createElement('label');
            row.style.cssText = `
                display:flex; align-items:center; gap:10px; padding:6px 10px; border-radius:8px; cursor:pointer;
                background:${isChecked ? 'rgba(13,148,136,0.1)' : '#ffffff'};
                border:1px solid ${isChecked ? 'var(--teal-600)' : '#e2e8f0'};
                transition:all 0.15s; user-select:none;
            `;

            const avatarHtml = typeof window.renderEmpAvatar === 'function'
                ? window.renderEmpAvatar(m.full_name, null, 28, 11)
                : `<div style="width:28px;height:28px;border-radius:50%;background:#0d9488;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;">${(m.full_name||'').substring(0,2).toUpperCase()}</div>`;

            row.innerHTML = `
                <input type="checkbox" value="${m.id}" ${isChecked ? 'checked' : ''} style="width:16px; height:16px; accent-color:var(--teal-600); cursor:pointer;" />
                <div style="flex-shrink:0;">${avatarHtml}</div>
                <div style="flex:1; min-width:0;">
                    <div style="font-weight:700; font-size:12.5px; color:var(--teal-900); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${m.full_name}</div>
                    <div style="font-size:10.5px; color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${m.role}</div>
                </div>
            `;

            const chk = row.querySelector('input[type="checkbox"]');
            chk.addEventListener('change', (e) => {
                if (chk.checked) {
                    selectedMemberIds.add(m.id);
                } else {
                    selectedMemberIds.delete(m.id);
                }
                updateGroupSelectedCount();
                renderGroupMembersChecklist(groupMemberFilter ? groupMemberFilter.value : '');
            });

            groupMembersList.appendChild(row);
        });
    };

    const updateGroupSelectedCount = () => {
        if (groupSelectedCount) {
            groupSelectedCount.textContent = `${selectedMemberIds.size} selected`;
        }
        if (btnToggleAll) {
            btnToggleAll.textContent = selectedMemberIds.size === allAvailableMembers.length && allAvailableMembers.length > 0 
                ? 'Deselect All' 
                : 'Select All';
        }
    };

    const openCreateGroupModal = async () => {
        if (groupForm) groupForm.reset();
        selectedMemberIds.clear();
        updateGroupSelectedCount();

        if (groupModal) {
            groupModal.style.display = 'flex';
            setTimeout(() => {
                groupModal.style.opacity = '1';
                groupModal.style.pointerEvents = 'auto';
            }, 10);
        }

        if (allAvailableMembers.length === 0) {
            await fetchAvailableMembers();
        }
        renderGroupMembersChecklist();
        if (groupNameInput) groupNameInput.focus();
    };

    const closeCreateGroupModal = () => {
        if (groupModal) {
            groupModal.style.opacity = '0';
            groupModal.style.pointerEvents = 'none';
            setTimeout(() => {
                groupModal.style.display = 'none';
            }, 250);
        }
        if (groupForm) groupForm.reset();
        selectedMemberIds.clear();
    };

    window.openCreateGroupModal = openCreateGroupModal;
    window.closeCreateGroupModal = closeCreateGroupModal;

    if (btnOpenCreateGroup) btnOpenCreateGroup.addEventListener('click', openCreateGroupModal);
    if (btnCloseCreateGroup) btnCloseCreateGroup.addEventListener('click', closeCreateGroupModal);
    if (btnCancelCreateGroup) btnCancelCreateGroup.addEventListener('click', closeCreateGroupModal);
    if (groupModal) {
        groupModal.addEventListener('click', (e) => {
            if (e.target === groupModal) closeCreateGroupModal();
        });
    }

    if (groupMemberFilter) {
        groupMemberFilter.addEventListener('input', (e) => {
            renderGroupMembersChecklist(e.target.value);
        });
    }

    if (btnToggleAll) {
        btnToggleAll.addEventListener('click', () => {
            if (selectedMemberIds.size === allAvailableMembers.length && allAvailableMembers.length > 0) {
                selectedMemberIds.clear();
            } else {
                allAvailableMembers.forEach(m => selectedMemberIds.add(m.id));
            }
            updateGroupSelectedCount();
            renderGroupMembersChecklist(groupMemberFilter ? groupMemberFilter.value : '');
        });
    }

    if (groupForm) {
        groupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = groupNameInput ? groupNameInput.value.trim() : '';
            const description = groupDescInput ? groupDescInput.value.trim() : '';
            const memberIds = Array.from(selectedMemberIds);

            if (!name) {
                alert('Please enter a group name');
                return;
            }

            const originalBtnHTML = btnSubmitCreateGroup ? btnSubmitCreateGroup.innerHTML : '';
            if (btnSubmitCreateGroup) {
                btnSubmitCreateGroup.disabled = true;
                btnSubmitCreateGroup.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating...';
            }

            try {
                const res = await fetch('/api/v1/chat/groups', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ name, description, memberIds })
                });
                const data = await res.json();
                if (!res.ok || !data.success) {
                    alert(data.message || 'Failed to create group');
                    return;
                }

                closeCreateGroupModal();
                
                // Refresh channel list
                const chanRes = await fetch('/api/v1/chat/channels');
                const chanData = await chanRes.json();
                if (chanRes.ok && chanData.success) {
                    chatChannels = chanData.data;
                    renderChatChannels();
                }

                // Immediately focus on newly created group
                const newGroupId = data.data?.id;
                if (newGroupId) {
                    selectChannelItem('Group', newGroupId, name, `${(memberIds.length + 1)} members`);
                }

            } catch (err) {
                console.error('Error creating group:', err);
                alert('Error creating group: ' + (err.message || err));
            } finally {
                if (btnSubmitCreateGroup) {
                    btnSubmitCreateGroup.disabled = false;
                    btnSubmitCreateGroup.innerHTML = originalBtnHTML;
                }
            }
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
            callModal.style.display = 'flex';
            setTimeout(() => { callModal.style.opacity = '1'; }, 10);
            
            const callAvatarEl = document.getElementById('call-avatar');
            if (callAvatarEl) {
                callAvatarEl.src = typeof window.getInitialsAvatarDataUri === 'function'
                    ? window.getInitialsAvatarDataUri(selectedContact.full_name, 120)
                    : `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedContact.full_name)}&background=0d9488&color=fff&bold=true`;
            }
            document.getElementById('call-name').textContent = selectedContact.full_name;
            document.getElementById('call-status').textContent = 'Ringing...';
            document.getElementById('btn-call-mute').style.background = '#e5e7eb';
            document.getElementById('btn-call-mute').innerHTML = '<i class="fa-solid fa-microphone"></i>';

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

    if (btnMeet) {
        btnMeet.addEventListener('click', async () => {
            if (!selectedContact) return;
            const code = Math.random().toString(36).substring(2, 5) + '-' + Math.random().toString(36).substring(2, 6) + '-' + Math.random().toString(36).substring(2, 5);
            const meetUrl = `https://meet.google.com/${code}`;
            const msg = `Let's join a Voice Call / Google Meet here: ${meetUrl}`;
            
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
                btnMute.style.background = '#f87171';
                btnMute.style.color = '#fff';
                btnMute.innerHTML = '<i class="fa-solid fa-microphone-slash"></i>';
            } else {
                btnMute.style.background = '#e5e7eb';
                btnMute.style.color = '#374151';
                btnMute.innerHTML = '<i class="fa-solid fa-microphone"></i>';
            }
        });
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

    // Initial load
    loadCommunication();
    loadInboxData();

    // Check query params or hash to auto-switch tab
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash;
    if (params.get('chat_id') || hash === '#chat' || params.get('tab') === 'chat') {
        window.switchCommTab('chat');
    } else if (params.get('tab') === 'inbox' || hash === '#inbox') {
        window.switchCommTab('inbox');
    }
});
