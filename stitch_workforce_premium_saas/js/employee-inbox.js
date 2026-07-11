// employee-inbox.js — Retrieve and filter notifications, mark all read

(async function () {
    // --- Logout ---
    document.getElementById('logout-btn').addEventListener('click', async () => {
        await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' });
        window.location.href = '/login.html';
    });

    let allMessages = [];
    let currentFilter = 'all';

    function showToast(msg, type = 'success') {
        const t = document.createElement('div');
        const bg = type === 'success' ? '#23b899' : '#e05252';
        t.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:9999;padding:12px 20px;border-radius:10px;font-weight:700;font-size:13.5px;color:#fff;background:${bg};box-shadow:0 4px 20px rgba(0,0,0,0.15);transition:opacity 0.4s;`;
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, 3000);
    }

    // --- Load Profile name ---
    async function loadProfileHeader() {
        try {
            const res = await fetch('/api/v1/auth/me', { credentials: 'include' });
            const data = await res.json();
            if (data.success && data.data) {
                document.getElementById('profile-name').textContent = data.data.full_name || data.data.username || 'Employee';
            }
        } catch(e) {}
    }

    // --- Load Inbox Items ---
    async function loadInbox() {
        try {
            const res = await fetch('/api/v1/employee/inbox', { credentials: 'include' });
            const data = await res.json();
            allMessages = data.success ? data.data : [];
            renderMessages();
        } catch (e) {
            console.error(e);
        }
    }

    function renderMessages() {
        const container = document.getElementById('inbox-list');
        
        let filtered = allMessages;
        if (currentFilter === 'unread') {
            filtered = allMessages.filter(m => !m.is_read);
        } else if (currentFilter === 'broadcast') {
            filtered = allMessages.filter(m => m.recipient_id === null);
        }

        if (!filtered.length) {
            container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 48px;">No messages found.</div>';
            return;
        }

        container.innerHTML = filtered.map(m => {
            const date = new Date(m.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
            const unreadDot = !m.is_read ? '<span style="width: 8px; height: 8px; border-radius: 50%; background: #fb923c; display: inline-block; margin-right: 8px;" title="Unread"></span>' : '';
            
            let broadcastIcon = '<i class="fa-regular fa-bell" style="color: var(--text-muted); margin-right: 6px;"></i>';
            let cardClickAttr = '';
            let cursorStyle = '';

            if (m.recipient_id === null) {
                broadcastIcon = '<i class="fa-solid fa-bullhorn" style="color: var(--teal-600); margin-right: 6px;" title="Broadcast Announcement"></i>';
            } else if (m.type === 'Chat') {
                broadcastIcon = '<i class="fa-regular fa-comments" style="color: var(--teal-600); margin-right: 6px;" title="Direct Message"></i>';
                cardClickAttr = `onclick="window.location.href='/employee-organization.html?chat_id=${m.sender_id}'"`;
                cursorStyle = 'cursor: pointer;';
            }

            return `
                <div class="card" ${cardClickAttr} style="padding: 16px; background: ${!m.is_read ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.18)'}; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; border-left: 4px solid ${!m.is_read ? '#fb923c' : 'rgba(255,255,255,0.3)'}; ${cursorStyle}">
                    <div style="display: flex; align-items: flex-start; gap: 10px;">
                        <div style="margin-top: 2px;">${unreadDot}${broadcastIcon}</div>
                        <div>
                            <div style="font-weight: 700; color: var(--teal-900); font-size: 13.5px;">${m.title || 'Notification'}</div>
                            <div style="font-size: 13px; color: var(--text-body); margin-top: 4px; line-height: 1.4;">${m.message || ''}</div>
                        </div>
                    </div>
                    <div style="font-size: 11.5px; color: var(--text-muted); white-space: nowrap;">${date}</div>
                </div>
            `;
        }).join('');
    }

    // --- Tab Filtering ---
    document.getElementById('inbox-filter-tabs').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-filter]');
        if (!btn) return;
        document.querySelectorAll('#inbox-filter-tabs button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderMessages();
    });

    // --- Mark All Read ---
    document.getElementById('btn-mark-all-read').addEventListener('click', async () => {
        try {
            const res = await fetch('/api/v1/employee/inbox/mark-all-read', {
                method: 'POST',
                credentials: 'include'
            });
            const data = await res.json();
            if (data.success) {
                showToast("All messages marked as read", "success");
                await loadInbox();
            } else {
                showToast("Failed to update status", "error");
            }
        } catch (e) {
            showToast("Network error", "error");
        }
    });

    await Promise.all([loadProfileHeader(), loadInbox()]);
})();
