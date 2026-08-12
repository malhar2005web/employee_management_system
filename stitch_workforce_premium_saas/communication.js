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
            const response = await fetch('/api/v1/admin/communication');
            const data = await response.json();
            if (response.ok && data.success) {
                employeesCache = data.data.employees;
                announcementsCache = data.data.announcements;

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
                const response = await fetch('/api/v1/admin/communication', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
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
    const btnChat = document.getElementById('btn-chat');
    const announcementsView = document.getElementById('announcements-view');
    const chatView = document.getElementById('chat-view');
    const commTitle = document.getElementById('comm-title');
    const commDesc = document.getElementById('comm-desc');

    if (btnAnnouncements && btnChat) {
        btnAnnouncements.addEventListener('click', () => {
            btnAnnouncements.classList.add('active');
            btnChat.classList.remove('active');

            btnAnnouncements.style.color = 'var(--text-dark)';
            btnChat.style.color = 'var(--text-muted)';

            announcementsView.style.display = 'block';
            chatView.style.display = 'none';
            btnAddNotice.style.display = 'inline-flex';
            commTitle.textContent = 'Notice Board & Broadcasting';
            commDesc.textContent = 'Publish office-wide alerts, schedule team announcements, or direct target alerts to individual staff.';
            stopMessagePolling();
        });

        btnChat.addEventListener('click', () => {
            btnChat.classList.add('active');
            btnAnnouncements.classList.remove('active');

            btnChat.style.color = 'var(--text-dark)';
            btnAnnouncements.style.color = 'var(--text-muted)';

            announcementsView.style.display = 'none';
            chatView.style.display = 'block';
            btnAddNotice.style.display = 'none';
            commTitle.textContent = 'Direct Chat Room';
            commDesc.textContent = 'Chat in real-time with employee contacts or initiate a voice call.';
            loadChatContacts();
            
            // Mark chat notifications read & update badge
            fetch('/api/v1/employee/inbox/mark-read', { method: 'POST', credentials: 'include' })
                .then(() => { if (typeof window.checkChatUnreadBadge === 'function') window.checkChatUnreadBadge(); })
                .catch(() => {});
        });
    }

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
            callModal.style.display = 'flex';
            setTimeout(() => { callModal.style.opacity = '1'; }, 10);
            
            const avatarId = selectedContact.id + 10;
            document.getElementById('call-avatar').src = `https://i.pravatar.cc/120?img=${avatarId}`;
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

    // Check query params to auto-switch tab
    const params = new URLSearchParams(window.location.search);
    if (params.get('chat_id')) {
        if (btnChat) btnChat.click();
    }
});
