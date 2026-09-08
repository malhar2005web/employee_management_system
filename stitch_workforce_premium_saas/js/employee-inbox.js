// employee-inbox.js — Retrieve and filter notifications, clickable detail modal & attachment viewer

(async function () {
    // --- Logout ---
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' });
            window.location.href = '/login.html';
        });
    }

    let allMessages = [];
    let currentFilter = 'all';

    function showToast(msg, type = 'success') {
        const t = document.createElement('div');
        const bg = type === 'success' ? '#23b899' : '#e05252';
        t.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:999999;padding:12px 20px;border-radius:10px;font-weight:700;font-size:13.5px;color:#fff;background:${bg};box-shadow:0 4px 20px rgba(0,0,0,0.15);transition:opacity 0.4s;`;
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, 3000);
    }

    // --- Load Profile header ---
    async function loadProfileHeader() {
        try {
            const res = await fetch('/api/v1/auth/me', { credentials: 'include' });
            const data = await res.json();
            if (data.success && data.data) {
                const profileElem = document.getElementById('profile-name');
                if (profileElem) {
                    profileElem.textContent = data.data.full_name || data.data.username || 'Employee';
                }
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
            console.error("Failed to load inbox:", e);
        }
    }

    // --- Render Messages ---
    function renderMessages() {
        const container = document.getElementById('inbox-list');
        if (!container) return;

        let filtered = allMessages;
        if (currentFilter === 'unread') {
            filtered = allMessages.filter(m => !m.is_read);
        } else if (currentFilter === 'support') {
            filtered = allMessages.filter(m => m.type === 'Support Ticket' || (m.title && m.title.toLowerCase().includes('ticket')));
        } else if (currentFilter === 'broadcast') {
            filtered = allMessages.filter(m => m.recipient_id === null);
        }

        if (!filtered.length) {
            container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 48px;"><i class="fa-regular fa-folder-open" style="font-size:32px; margin-bottom:10px; display:block; opacity:0.5;"></i>No notifications found.</div>';
            return;
        }

        container.innerHTML = filtered.map(m => {
            const date = new Date(m.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
            const unreadDot = !m.is_read ? '<span style="width: 8px; height: 8px; border-radius: 50%; background: #fb923c; display: inline-block; margin-right: 8px; flex-shrink:0;" title="Unread"></span>' : '';
            
            let typeIcon = '<i class="fa-regular fa-bell" style="color: var(--teal-700);"></i>';
            let typeBadge = '';
            
            if (m.type === 'Support Ticket' || (m.title && m.title.includes('SUP-'))) {
                typeIcon = '<i class="fa-solid fa-headset" style="color: #0284c7;"></i>';
                typeBadge = '<span style="font-size:10.5px; font-weight:700; background:rgba(2,132,199,0.12); color:#0284c7; padding:2px 6px; border-radius:4px; margin-left:6px;">SUPPORT</span>';
            } else if (m.recipient_id === null) {
                typeIcon = '<i class="fa-solid fa-bullhorn" style="color: #ea580c;"></i>';
                typeBadge = '<span style="font-size:10.5px; font-weight:700; background:rgba(234,88,12,0.12); color:#ea580c; padding:2px 6px; border-radius:4px; margin-left:6px;">BROADCAST</span>';
            } else if (m.type === 'Chat') {
                typeIcon = '<i class="fa-regular fa-comments" style="color: var(--teal-600);"></i>';
                typeBadge = '<span style="font-size:10.5px; font-weight:700; background:rgba(35,184,153,0.12); color:var(--teal-700); padding:2px 6px; border-radius:4px; margin-left:6px;">CHAT</span>';
            }

            // Extract snippet for display
            let cleanSnippet = (m.message || '').replace(/\*\*/g, '').replace(/\\n/g, ' ').substring(0, 140);
            if ((m.message || '').length > 140) cleanSnippet += '...';

            // Check attachments in metadata
            let meta = m.metadata;
            if (typeof meta === 'string') {
                try { meta = JSON.parse(meta); } catch(e) { meta = {}; }
            }
            meta = meta || {};

            const attachments = meta.attachments || [];
            let attachmentBadge = '';
            if (attachments.length > 0) {
                attachmentBadge = `<span style="font-size:12.5px; font-weight:700; color:#0369a1; background:rgba(2,132,199,0.12); padding:3px 10px; border-radius:6px; display:inline-flex; align-items:center; gap:5px; margin-top:6px;"><i class="fa-solid fa-paperclip"></i> ${attachments.length} attachment${attachments.length > 1 ? 's' : ''}</span>`;
            }

            return `
                <div class="card inbox-card-hover" onclick="openMessageDetail(${m.id})" style="padding: 18px 20px; background: ${!m.is_read ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.45)'}; display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; border-left: 5px solid ${!m.is_read ? '#fb923c' : 'rgba(35,184,153,0.35)'};">
                    <div style="display: flex; align-items: flex-start; gap: 14px; flex:1;">
                        <div style="margin-top: 2px; display:flex; align-items:center;">
                            ${unreadDot}
                            <div style="width:36px; height:36px; border-radius:10px; background:rgba(0,0,0,0.05); display:flex; align-items:center; justify-content:center; font-size:16px;">
                                ${typeIcon}
                            </div>
                        </div>
                        <div style="flex:1;">
                            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                                <span style="font-weight: 800; color: var(--teal-900); font-size: 15.5px;">${m.title || 'Notification'}</span>
                                ${typeBadge}
                            </div>
                            <div style="font-size: 14px; color: var(--text-body); margin-top: 5px; line-height: 1.5;">${cleanSnippet}</div>
                            ${attachmentBadge}
                        </div>
                    </div>
                    <div style="font-size: 13px; font-weight:600; color: var(--text-muted); white-space: nowrap; margin-top:3px;">${date}</div>
                </div>
            `;
        }).join('');
    }

    // --- Tab Filtering ---
    const filterTabs = document.getElementById('inbox-filter-tabs');
    if (filterTabs) {
        filterTabs.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-filter]');
            if (!btn) return;
            document.querySelectorAll('#inbox-filter-tabs button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderMessages();
        });
    }

    // --- Mark All Read ---
    const markAllBtn = document.getElementById('btn-mark-all-read');
    if (markAllBtn) {
        markAllBtn.addEventListener('click', async () => {
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
    }

    // --- OPEN MESSAGE DETAIL MODAL ---
    window.openMessageDetail = async function (messageId) {
        const msg = allMessages.find(m => m.id === messageId);
        if (!msg) return;

        // Auto mark as read in background
        if (!msg.is_read) {
            msg.is_read = true;
            renderMessages();
            try {
                await fetch(`/api/v1/employee/inbox/${messageId}/read`, {
                    method: 'POST',
                    credentials: 'include'
                });
            } catch (e) {
                console.warn("Failed to mark single read:", e);
            }
        }

        // Parse metadata
        let meta = msg.metadata;
        if (typeof meta === 'string') {
            try { meta = JSON.parse(meta); } catch(e) { meta = {}; }
        }
        meta = meta || {};

        const modal = document.getElementById('message-detail-modal');
        const modalTitle = document.getElementById('modal-title');
        const modalTypeBadge = document.getElementById('modal-type-badge');
        const modalTicketCode = document.getElementById('modal-ticket-code');
        const modalPriorityBadge = document.getElementById('modal-priority-badge');
        const modalCustomer = document.getElementById('modal-customer');
        const modalProject = document.getElementById('modal-project');
        const modalDate = document.getElementById('modal-date');
        const modalDescription = document.getElementById('modal-description');
        const modalOpenSupportBtn = document.getElementById('modal-open-support-btn');
        const modalAttachmentsSection = document.getElementById('modal-attachments-section');
        const modalAttachmentCount = document.getElementById('modal-attachment-count');
        const modalImagesGallery = document.getElementById('modal-images-gallery');
        const modalFilesList = document.getElementById('modal-files-list');

        // Populate basic headers
        modalTitle.textContent = meta.title || msg.title || 'Notification Details';
        modalDate.textContent = new Date(msg.created_at).toLocaleString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        // Type badge & icon
        const isSupport = msg.type === 'Support Ticket' || (meta && meta.ticket_code) || (msg.title && msg.title.includes('SUP-'));
        modalTypeBadge.textContent = isSupport ? 'Support Ticket' : (msg.recipient_id === null ? 'Broadcast' : 'Direct Notice');

        // Ticket code
        const ticketCode = meta.ticket_code || (msg.title && msg.title.match(/SUP-\d+/)?.[0]) || '';
        if (ticketCode) {
            modalTicketCode.style.display = 'inline-block';
            modalTicketCode.textContent = ticketCode;
        } else {
            modalTicketCode.style.display = 'none';
        }

        // Priority badge
        const priority = meta.priority || 'Medium';
        if (isSupport) {
            modalPriorityBadge.style.display = 'inline-block';
            modalPriorityBadge.textContent = priority.toUpperCase();
            if (priority.toLowerCase() === 'critical') {
                modalPriorityBadge.style.background = '#fee2e2';
                modalPriorityBadge.style.color = '#dc2626';
            } else if (priority.toLowerCase() === 'high') {
                modalPriorityBadge.style.background = '#ffedd5';
                modalPriorityBadge.style.color = '#ea580c';
            } else {
                modalPriorityBadge.style.background = '#e0f2fe';
                modalPriorityBadge.style.color = '#0284c7';
            }
        } else {
            modalPriorityBadge.style.display = 'none';
        }

        // Customer & Project
        modalCustomer.textContent = meta.customer_name || 'Valued Client';
        modalProject.textContent = meta.project_name || 'General Project';

        // Full Description
        let fullDesc = meta.description || msg.message || 'No additional details provided.';
        // Clean markdown bold or raw escaped quotes
        fullDesc = fullDesc.replace(/\*\*/g, '').trim();
        modalDescription.textContent = fullDesc;

        // Support desk direct link
        if (isSupport) {
            modalOpenSupportBtn.style.display = 'inline-flex';
            modalOpenSupportBtn.href = ticketCode ? `/admin-support.html?ticket_code=${ticketCode}` : '/admin-support.html';
        } else {
            modalOpenSupportBtn.style.display = 'none';
        }

        // Attachments Gallery & File Lists
        let attachments = Array.isArray(meta.attachments) ? meta.attachments : [];
        if (attachments.length === 0 && Array.isArray(msg.attachments)) {
            attachments = msg.attachments;
        }

        modalImagesGallery.innerHTML = '';
        modalFilesList.innerHTML = '';

        if (attachments.length > 0) {
            modalAttachmentsSection.style.display = 'block';
            modalAttachmentCount.textContent = `${attachments.length} file${attachments.length > 1 ? 's' : ''}`;

            attachments.forEach((att, idx) => {
                let fileUrl = typeof att === 'string' ? att : (att.url || '');
                let fileName = typeof att === 'string' ? att.split('/').pop() : (att.name || att.filename || `Attachment-${idx+1}`);
                let fileType = typeof att === 'object' ? (att.type || '') : '';

                const isImage = fileType.includes('image') || /\.(png|jpg|jpeg|webp|gif)$/i.test(fileUrl) || /\.(png|jpg|jpeg|webp|gif)$/i.test(fileName);
                const isPdf = fileType.includes('pdf') || /\.pdf$/i.test(fileUrl) || /\.pdf$/i.test(fileName);

                if (isImage && fileUrl) {
                    // Render image thumbnail
                    const imgCard = document.createElement('div');
                    imgCard.className = 'attachment-img-card';
                    imgCard.innerHTML = `
                        <img src="${fileUrl}" alt="${fileName}" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='https://placehold.co/400x300?text=Preview+Unavailable'">
                        <div style="position:absolute; bottom:0; left:0; width:100%; background:linear-gradient(to top, rgba(0,0,0,0.75), transparent); padding:8px 10px; color:#fff; font-size:13px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                            <i class="fa-solid fa-magnifying-glass-plus" style="margin-right:5px;"></i>${fileName}
                        </div>
                    `;
                    imgCard.onclick = () => openLightbox(fileUrl, fileName);
                    modalImagesGallery.appendChild(imgCard);
                } else {
                    // Render downloadable document / file card
                    const fileCard = document.createElement('div');
                    fileCard.className = 'attachment-file-card';
                    let iconClass = isPdf ? 'fa-solid fa-file-pdf' : 'fa-solid fa-file';
                    let iconColor = isPdf ? '#e11d48' : 'var(--teal-600)';

                    fileCard.innerHTML = `
                        <div style="display:flex; align-items:center; gap:12px;">
                            <i class="${iconClass}" style="font-size:28px; color:${iconColor}; flex-shrink:0;"></i>
                            <div>
                                <div style="font-size:15.5px; font-weight:800; color:#0f172a;">${fileName}</div>
                                <div style="font-size:13px; font-weight:500; color:#64748b; margin-top:2px;">${isPdf ? 'PDF Document' : 'Attachment file'}</div>
                            </div>
                        </div>
                        ${fileUrl ? `
                            <a href="${fileUrl}" target="_blank" download="${fileName}" style="padding:8px 16px; border-radius:10px; font-size:13.5px; font-weight:700; color:var(--teal-700); background:rgba(35,184,153,0.15); text-decoration:none; display:inline-flex; align-items:center; gap:7px; transition:all 0.2s;" onmouseover="this.style.background='var(--teal-600)'; this.style.color='#fff'" onmouseout="this.style.background='rgba(35,184,153,0.15)'; this.style.color='var(--teal-700)'">
                                <i class="fa-solid fa-download"></i> Download / View
                            </a>
                        ` : '<span style="font-size:12.5px; color:#94a3b8; font-weight:600;">Uploaded via WhatsApp</span>'}
                    `;
                    modalFilesList.appendChild(fileCard);
                }
            });
        } else {
            modalAttachmentsSection.style.display = 'none';
        }

        modal.style.display = 'flex';
    };

    // --- CLOSE MODAL HANDLERS ---
    function closeModal() {
        const modal = document.getElementById('message-detail-modal');
        if (modal) modal.style.display = 'none';
    }

    document.getElementById('modal-close-btn')?.addEventListener('click', closeModal);
    document.getElementById('modal-close-footer-btn')?.addEventListener('click', closeModal);
    document.getElementById('message-detail-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'message-detail-modal') closeModal();
    });

    // --- LIGHTBOX PREVIEW ---
    function openLightbox(url, caption) {
        const lb = document.getElementById('image-lightbox-modal');
        const lbImg = document.getElementById('lightbox-img');
        const lbCaption = document.getElementById('lightbox-caption');
        const lbDownload = document.getElementById('lightbox-download-link');

        lbImg.src = url;
        lbCaption.textContent = caption || 'Attachment Photo';
        lbDownload.href = url;
        lbDownload.download = caption || 'attachment.png';
        lb.style.display = 'flex';
    }

    function closeLightbox() {
        const lb = document.getElementById('image-lightbox-modal');
        if (lb) lb.style.display = 'none';
    }

    document.getElementById('lightbox-close-btn')?.addEventListener('click', closeLightbox);
    document.getElementById('image-lightbox-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'image-lightbox-modal') closeLightbox();
    });

    // Close on Escape key
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeLightbox();
            closeModal();
        }
    });

    await Promise.all([loadProfileHeader(), loadInbox()]);
})();
