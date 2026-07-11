document.addEventListener('DOMContentLoaded', () => {
    // Modals
    const noticeModal = document.getElementById('notice-modal');
    const btnAddNotice = document.getElementById('btn-add-notice');
    const noticeClose = document.getElementById('notice-close');
    const noticeCancel = document.getElementById('notice-cancel');
    const noticeForm = document.getElementById('notice-form');

    // Controls
    const notTarget = document.getElementById('not-target');
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
            noticeForm.reset();
            groupEmployeeSelect.style.display = 'none';
            noticeModal.classList.add('active');
        });
    }

    const closeModal = () => {
        noticeModal.classList.remove('active');
        noticeForm.reset();
    };

    if (noticeClose) noticeClose.addEventListener('click', closeModal);
    if (noticeCancel) noticeCancel.addEventListener('click', closeModal);

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
    noticeForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const payload = {
            title: document.getElementById('not-title').value.trim(),
            message: document.getElementById('not-message').value.trim(),
            targetType: notTarget.value,
            employeeId: notEmployee.value
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
        });
    }

    // Chat State variables
    let chatContacts = [];
    let selectedContact = null;
    let chatInterval = null;

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
        renderChatContacts(chatContacts);

        document.getElementById('chat-thread-empty').style.display = 'none';
        document.getElementById('chat-thread-active').style.display = 'flex';

        const avatarId = contact.id + 10;
        document.getElementById('chat-header-avatar').src = `https://i.pravatar.cc/80?img=${avatarId}`;
        document.getElementById('chat-header-name').textContent = contact.full_name;
        document.getElementById('chat-header-status').textContent = `${contact.designation_name || 'Staff'} | ${contact.department_name || 'Department'}`;

        loadMessages();
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
