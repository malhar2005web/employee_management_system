// Renders the productivity bar+line combo chart used on both dashboards,
// styled so the bars read as translucent glass columns rather than flat fills.
function renderProductivityChart(canvasId, dataValues, lineValues){
  const ctx = document.getElementById(canvasId).getContext('2d');

  // Glass bar gradient: bright frosted highlight at the top fading into a
  // deeper translucent teal, mimicking light passing through glass.
  const barGradient = ctx.createLinearGradient(0, 0, 0, 280);
  barGradient.addColorStop(0, 'rgba(255, 255, 255, 0.42)');
  barGradient.addColorStop(0.18, 'rgba(150, 214, 200, 0.36)');
  barGradient.addColorStop(1, 'rgba(15, 139, 115, 0.26)');

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul'],
      datasets: [
        {
          type: 'bar',
          data: dataValues,
          backgroundColor: barGradient,
          borderColor: 'rgba(255,255,255,0.6)',
          borderWidth: 1.25,
          borderRadius: 8,
          barThickness: 34,
          order: 2
        },
        {
          type: 'line',
          data: lineValues,
          borderColor: '#a9d94c',
          backgroundColor: '#a9d94c',
          borderWidth: 2.5,
          tension: 0.45,
          pointRadius: 4,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#a9d94c',
          pointBorderWidth: 2,
          order: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        y: {
          min: 0, max: 100,
          ticks: { stepSize: 25, callback: v => v + '%', color: '#7d857c', font: { size: 12 } },
          grid: { color: 'rgba(255,255,255,0.5)' },
          border: { display: false }
        },
        x: {
          ticks: { color: '#7d857c', font: { size: 12 } },
          grid: { display: false },
          border: { display: false }
        }
      }
    }
  });
}

// Generic pill toggle group (Weekly / Monthly, All / In Progress / Completed, etc.)
function wireToggleGroup(selector){
  document.querySelectorAll(selector + ' button').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

window.applyGlobalFontSize = function(scalePercent) {
    const scaleVal = parseFloat(scalePercent || 112);
    const scaleFactor = scaleVal / 100;
    document.documentElement.style.setProperty('--app-font-scale', scaleFactor);
    document.documentElement.style.fontSize = (15 * scaleFactor) + 'px';
    localStorage.setItem('app_font_scale', scaleVal);
};

window.syncAllTopbarAvatars = function() {
    const savedProfilePic = localStorage.getItem('admin_profile_pic') || localStorage.getItem('user_profile_pic');
    if (savedProfilePic) {
        const selectors = [
            '.topbar-user img',
            '.sidebar-profile img',
            '#hdr-avatar-img',
            '.profile-avatar-circle img',
            '.profile-avatar img',
            '.user-avatar img',
            '.admin-avatar img',
            '#emp-log-avatar',
            '#chat-header-avatar',
            '#call-avatar'
        ];
        document.querySelectorAll(selectors.join(',')).forEach(img => {
            if (img && img.src !== savedProfilePic) {
                img.src = savedProfilePic;
                img.style.display = 'block';
            }
        });

        // Sync div-based avatar containers like #hdr-avatar
        document.querySelectorAll('#hdr-avatar, .profile-avatar-circle').forEach(circle => {
            if (circle) {
                const hdrText = circle.querySelector('#hdr-avatar-text') || circle.querySelector('span');
                let hdrImg = circle.querySelector('#hdr-avatar-img') || circle.querySelector('img');
                if (hdrImg) {
                    if (hdrImg.src !== savedProfilePic) {
                        hdrImg.src = savedProfilePic;
                    }
                    hdrImg.style.display = 'block';
                    if (hdrText) hdrText.style.display = 'none';
                } else if (!circle.querySelector('img')) {
                    const img = document.createElement('img');
                    img.id = 'hdr-avatar-img';
                    img.src = savedProfilePic;
                    img.style.cssText = 'width:100%; height:100%; object-fit:cover; border-radius:50%; display:block;';
                    circle.innerHTML = '';
                    circle.appendChild(img);
                }
            }
        });
    }
};

// Immediate & Listener-based sync
(function initAvatarSync() {
    window.syncAllTopbarAvatars();
    window.addEventListener('load', window.syncAllTopbarAvatars);
    window.addEventListener('storage', (e) => {
        if (e.key === 'admin_profile_pic' || e.key === 'user_profile_pic') {
            window.syncAllTopbarAvatars();
        }
    });
    setInterval(window.syncAllTopbarAvatars, 800);
})();

document.addEventListener('DOMContentLoaded', () => {
  let favicon = document.querySelector("link[rel*='icon']");
  if (!favicon) {
    favicon = document.createElement('link');
    favicon.rel = 'shortcut icon';
    document.head.appendChild(favicon);
  }
  favicon.href = '/assets/logo.jpg';

  wireToggleGroup('.toggle-group');
  wireToggleGroup('.tab-group');
  const savedScale = localStorage.getItem('app_font_scale') || '112';
  window.applyGlobalFontSize(savedScale);
  window.syncAllTopbarAvatars();

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' });
        window.location.href = '/login.html';
      } catch (err) {
        console.error("Logout failed:", err);
        window.location.href = '/login.html';
      }
    });
  }

  // ── Global session guard: if authCheck fails redirect to login ──────────────
  // Only on protected pages (not on login.html itself)
  if (!window.location.pathname.includes('login.html')) {
    fetch('/api/v1/auth/me', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (!data.success) {
          window.location.href = '/login.html';
        } else {
          const localPic = localStorage.getItem('admin_profile_pic') || localStorage.getItem('user_profile_pic');
          // Only overwrite local profile pic if DB has a custom non-pravatar image
          if (data.data && data.data.profile_picture && !data.data.profile_picture.includes('pravatar.cc')) {
            localStorage.setItem('admin_profile_pic', data.data.profile_picture);
            localStorage.setItem('user_profile_pic', data.data.profile_picture);
            window.syncAllTopbarAvatars();
          } else if (localPic) {
            // Auto sync local pic to DB if DB is missing it or has default pravatar
            fetch('/api/v1/employee/profile', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ profile_picture: localPic })
            }).catch(() => {});
            window.syncAllTopbarAvatars();
          }
        }
      })
      .catch(() => {
        // network error — don't redirect, let user see error naturally
      });
  }

  // ── Employee Topbar & Polling Adjustments ──
  if (window.location.pathname.includes('employee-') || window.location.pathname === '/') {
    // Hide dark mode button
    const darkBtn = document.querySelector('.topbar-actions .fa-moon')?.closest('.icon-btn');
    if (darkBtn) darkBtn.remove();

    // Hide envelope message button
    const mailBtn = document.querySelector('.topbar-actions .fa-envelope')?.closest('.icon-btn');
    if (mailBtn) mailBtn.remove();

    // Make bell icon redirect to inbox
    const bellBtn = document.querySelector('.topbar-actions .fa-bell')?.closest('.icon-btn');
    if (bellBtn) {
      bellBtn.style.cursor = 'pointer';
      bellBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.location.href = '/employee-inbox.html';
      });
    }

    // Make profile picture redirect to profile
    const topbarUser = document.querySelector('.topbar-user');
    if (topbarUser) {
      topbarUser.style.cursor = 'pointer';
      topbarUser.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.location.href = '/employee-profile.html';
      });
    }

    // Synthesized chime player
    function playNotificationSound() {
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const now = audioCtx.currentTime;

        // First tone (A5)
        const osc1 = audioCtx.createOscillator();
        const gain1 = audioCtx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(880, now);
        gain1.gain.setValueAtTime(0, now);
        gain1.gain.linearRampToValueAtTime(0.1, now + 0.05);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc1.connect(gain1);
        gain1.connect(audioCtx.destination);
        osc1.start(now);
        osc1.stop(now + 0.3);

        // Second tone (E6)
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1320, now + 0.12);
        gain2.gain.setValueAtTime(0, now + 0.12);
        gain2.gain.linearRampToValueAtTime(0.1, now + 0.17);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.start(now + 0.12);
        osc2.stop(now + 0.45);
      } catch (err) {
        console.error("Audio error:", err);
      }
    }

    // Polling unread notifications count
    let lastUnreadCount = null;
    async function checkNotifications() {
      try {
        const res = await fetch('/api/v1/employee/inbox', { credentials: 'include' });
        const data = await res.json();
        if (!data.success || !Array.isArray(data.data)) return;

        const unreadCount = data.data.filter(n => !n.is_read).length;

        // Update topbar bell badge
        const bellBadge = document.querySelector('.topbar-actions .fa-bell')?.parentNode.querySelector('.badge');
        if (bellBadge) {
          if (unreadCount > 0) {
            bellBadge.textContent = unreadCount;
            bellBadge.style.display = 'flex';
          } else {
            bellBadge.style.display = 'none';
          }
        }

        // Play chime if count has increased (and it's not the first load check)
        if (lastUnreadCount !== null && unreadCount > lastUnreadCount) {
          playNotificationSound();
        }
        lastUnreadCount = unreadCount;
      } catch (e) {
        console.error("Notification check error:", e);
      }
    }

    // Run first check and set interval (10 seconds)
    checkNotifications();
    setInterval(checkNotifications, 10000);

  } else if (window.location.pathname.includes('admin-')) {
    // Hide dark mode button
    const darkBtn = document.querySelector('.topbar-actions .fa-moon')?.closest('.icon-btn');
    if (darkBtn) darkBtn.remove();

    // Hide envelope message button
    const mailBtn = document.querySelector('.topbar-actions .fa-envelope')?.closest('.icon-btn');
    if (mailBtn) mailBtn.remove();

    // Make profile picture redirect to admin profile
    document.querySelectorAll('.topbar-user').forEach(el => {
      el.style.cursor = 'pointer';
      el.onclick = () => { window.location.href = '/admin-profile.html'; };
    });
  }

  // Universal Topbar User Avatar click handler (delegation fallback)
  document.addEventListener('click', (e) => {
    const userBtn = e.target.closest('.topbar-user');
    if (userBtn) {
      e.preventDefault();
      const isEmployeePage = window.location.pathname.includes('employee-');
      window.location.href = isEmployeePage ? '/employee-profile.html' : '/admin-profile.html';
    }
  });

  // ── Hide removed modules from sidebar (Timesheets, Goals, Training, Workload/Activity Summary, Reports) ──
  const removedPages = [
    'employee-timesheets', 'employee-goals', 'employee-trainings',
    'admin-timesheets', 'admin-goals', 'admin-trainings', 'admin-workload', 'admin-reports',
    'admin-employees', 'admin-shifts', 'admin-projects', 'admin-screenshots',
    'admin-leaves', 'admin-audit-logs'
  ];
  document.querySelectorAll('.nav-list .nav-item').forEach(item => {
    const onclick = item.getAttribute('onclick') || '';
    if (removedPages.some(p => onclick.includes(p))) {
      item.style.display = 'none';
    }
  });

  // ── Combine Attendance and Leave for Sidebar dynamically ──
  const navList = document.querySelector('.nav-list');
  if (navList) {
    let attItem = null;
    let leaveItem = null;
    navList.querySelectorAll('.nav-item').forEach(item => {
      const onclick = item.getAttribute('onclick') || '';
      if (onclick.includes('attendance')) attItem = item;
      if (onclick.includes('leave')) leaveItem = item;
    });

    if (attItem && leaveItem) {
      attItem.innerHTML = '<i class="fa-solid fa-calendar-check"></i> Attendance &amp; Leave';
      if (window.location.pathname.includes('admin-')) {
        attItem.setAttribute('onclick', "window.location.href='/admin-attendance.html'");
      } else {
        attItem.setAttribute('onclick', "window.location.href='/employee-attendance.html'");
      }
      leaveItem.remove();
    } else if (attItem) {
      attItem.innerHTML = '<i class="fa-solid fa-calendar-check"></i> Attendance &amp; Leave';
      if (window.location.pathname.includes('admin-')) {
        attItem.setAttribute('onclick', "window.location.href='/admin-attendance.html'");
      } else {
        attItem.setAttribute('onclick', "window.location.href='/employee-attendance.html'");
      }
    }
  }

    // ── Global profile info loader for all employee pages ──
    if (!window.location.pathname.includes('login.html')) {
      fetch('/api/v1/auth/me', { credentials: 'include' })
        .then(r => r.json())
        .then(data => {
          if (data.success && data.data) {
            const me = data.data;
            const nameEl = document.getElementById('profile-name');
            const roleEl = document.getElementById('profile-role');
            if (nameEl) nameEl.textContent = me.full_name || me.username || 'Employee';
            if (roleEl) roleEl.textContent = me.designation_name || 'Staff';
          }
        })
        .catch(err => console.error("Error loading user profile:", err));
    }
});

// ── Global toast helper (usable from any page) ────────────────────────────────
window.showToast = function(msg, type = 'success') {
  const t = document.createElement('div');
  const bg = type === 'success' ? '#23b899' : type === 'warning' ? '#f59e0b' : '#e05252';
  t.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:9999;padding:12px 22px;border-radius:12px;font-weight:700;font-size:13.5px;color:#fff;background:${bg};box-shadow:0 4px 24px rgba(0,0,0,0.18);transition:opacity 0.4s;font-family:inherit;`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, 3200);
};

// ── Global Chat Unread Red Dot Badge Checker ────────────────
window.checkChatUnreadBadge = function() {
  const btnChat = document.getElementById('btn-chat');
  if (!btnChat) return;

  fetch('/api/v1/employee/inbox', { credentials: 'include' })
    .then(r => r.json())
    .then(data => {
      if (data.success && Array.isArray(data.data)) {
        const unreadChatNotifs = data.data.filter(n => (!n.is_read) && (n.type === 'Chat' || n.type === 'Mention Alert'));
        let dot = document.getElementById('chat-red-dot-badge');
        
        if (unreadChatNotifs.length > 0) {
          if (!dot) {
            dot = document.createElement('span');
            dot.id = 'chat-red-dot-badge';
            dot.style.cssText = 'width:9px; height:9px; border-radius:50%; background:#ef4444; display:inline-block; margin-left:6px; box-shadow:0 0 6px rgba(239,68,68,0.8); vertical-align:middle;';
            btnChat.appendChild(dot);
          }
        } else if (dot) {
          dot.remove();
        }
      }
    })
    .catch(e => console.error("Error checking chat unread badge:", e));
};

// Auto check unread badge every 5 seconds
setInterval(() => {
  if (typeof window.checkChatUnreadBadge === 'function') {
    window.checkChatUnreadBadge();
  }
}, 5000);
setTimeout(() => {
  if (typeof window.checkChatUnreadBadge === 'function') {
    window.checkChatUnreadBadge();
  }
}, 800);

// ── Global Modal Open/Close & Scroll Lock Helper ─────────────────────────────
window.openModal = function(modalEl) {
  if (typeof modalEl === 'string') modalEl = document.getElementById(modalEl);
  if (!modalEl) return;
  document.body.classList.add('modal-open');
  modalEl.style.display = 'flex';
  setTimeout(() => {
    modalEl.classList.add('active');
    modalEl.style.opacity = '1';
  }, 10);
};

window.closeModal = function(modalEl) {
  if (typeof modalEl === 'string') modalEl = document.getElementById(modalEl);
  if (!modalEl) return;
  modalEl.style.opacity = '0';
  modalEl.classList.remove('active');
  setTimeout(() => {
    modalEl.style.display = 'none';
    if (!document.querySelector('.modal-overlay.active')) {
      document.body.classList.remove('modal-open');
    }
  }, 250);
};

// Global click delegate for all close buttons and overlay backdrop clicks
document.addEventListener('click', (e) => {
  // Check if click target is a modal close button or icon
  if (e.target.classList.contains('modal-close') || 
      e.target.closest('.modal-close') || 
      e.target.closest('.modal-close-btn') || 
      e.target.id === 'emp-modal-close' || 
      e.target.id === 'emp-modal-cancel' || 
      e.target.id === 'create-ticket-close' || 
      e.target.id === 'create-ticket-cancel' || 
      e.target.id === 'edit-ticket-close' || 
      e.target.id === 'edit-ticket-cancel' || 
      e.target.id === 'ticket-workspace-close') {
    const overlay = e.target.closest('.modal-overlay');
    if (overlay) window.closeModal(overlay);
  }
  // Check if clicked directly on overlay background backdrop
  if (e.target.classList.contains('modal-overlay')) {
    window.closeModal(e.target);
  }
});

// ── GLOBAL RECTANGULAR CARD SPOTLIGHT POP-UP & BACKGROUND BLUR ENGINE ───────
(function initGlobalRowSpotlight() {
  let hoverTimer = null;
  let activeSpotlightRow = null;
  let backdropEl = null;
  let popupCardEl = null;

  function ensureSpotlightElements() {
    backdropEl = document.getElementById('spotlight-backdrop');
    if (!backdropEl) {
      backdropEl = document.createElement('div');
      backdropEl.id = 'spotlight-backdrop';
      document.body.appendChild(backdropEl);
      backdropEl.addEventListener('click', clearSpotlight);
    }

    popupCardEl = document.getElementById('spotlight-card-popup');
    if (!popupCardEl) {
      popupCardEl = document.createElement('div');
      popupCardEl.id = 'spotlight-card-popup';
      popupCardEl.style.cssText = 'display:none; position:fixed; top:50%; left:50%; transform:translate(-50%, -50%) scale(0.96); z-index:999999; width:95%; max-width:1420px; background:rgba(255, 255, 255, 0.98); border:1px solid rgba(255, 255, 255, 0.9); backdrop-filter:blur(32px); -webkit-backdrop-filter:blur(32px); border-radius:20px; box-shadow:0 25px 70px rgba(0, 0, 0, 0.35); opacity:0; transition:all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1); padding:18px 24px; box-sizing:border-box; overflow:hidden;';
      document.body.appendChild(popupCardEl);

      popupCardEl.addEventListener('mouseleave', () => {
        clearSpotlight();
      });
    }
  }

  function activateSpotlight(tr) {
    ensureSpotlightElements();
    if (activeSpotlightRow) clearSpotlight();

    activeSpotlightRow = tr;
    const tds = Array.from(tr.querySelectorAll('td'));
    if (tds.length === 0) return;

    const table = tr.closest('table');
    
    // Clone exact table headers & row structure for SAME TO SAME presentation
    let theadHtml = table && table.querySelector('thead') ? table.querySelector('thead').outerHTML : '';
    
    const trClone = tr.cloneNode(true);
    // Remove inline hover effects or active classes from clone
    trClone.classList.remove('spotlight-focused-row', 'row-hover-expanding');
    trClone.style.background = 'transparent';
    trClone.style.transform = 'none';
    trClone.style.boxShadow = 'none';

    // Ensure last cell (Actions) is formatted with whitespace nowrap & right alignment so buttons never cut off
    const lastTd = trClone.querySelector('td:last-child');
    if (lastTd) {
      lastTd.style.whiteSpace = 'nowrap';
      lastTd.style.textAlign = 'right';
      lastTd.style.minWidth = '160px';
      lastTd.style.paddingRight = '8px';
    }

    popupCardEl.style.maxWidth = '1420px';

    popupCardEl.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; padding-bottom:8px; border-bottom:1px solid rgba(15,118,110,0.15);">
        <div style="font-size:13px; font-weight:800; color:#0F766E; text-transform:uppercase; letter-spacing:0.5px; display:flex; align-items:center; gap:6px;">
          <i class="fa-solid fa-expand"></i> Focused Record Inspector
        </div>
        <button type="button" onclick="window.clearSpotlightCard()" style="background:rgba(0,0,0,0.06); border:none; width:28px; height:28px; border-radius:50%; font-size:13px; cursor:pointer; color:#475569; display:flex; align-items:center; justify-content:center;" title="Close Inspector">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div style="width:100%; box-sizing:border-box;">
        <table style="width:100%; border-collapse:separate; border-spacing:0; table-layout:auto;">
          ${theadHtml}
          <tbody>
            ${trClone.outerHTML}
          </tbody>
        </table>
      </div>
    `;

    // Close spotlight immediately when any action button inside the card is clicked
    popupCardEl.onclick = (e) => {
      const btn = e.target.closest('button');
      if (btn) {
        clearSpotlight();
      }
    };

    // Show Backdrop & Pop up Card
    backdropEl.classList.add('active');
    popupCardEl.style.display = 'block';
    setTimeout(() => {
      popupCardEl.style.opacity = '1';
      popupCardEl.style.transform = 'translate(-50%, -50%) scale(1)';
    }, 10);
  }

  function clearSpotlight() {
    clearTimeout(hoverTimer);
    activeSpotlightRow = null;
    if (backdropEl) backdropEl.classList.remove('active');
    if (popupCardEl) {
      popupCardEl.style.opacity = '0';
      popupCardEl.style.transform = 'translate(-50%, -50%) scale(0.95)';
      setTimeout(() => {
        popupCardEl.style.display = 'none';
      }, 250);
    }
  }
  window.clearSpotlightCard = clearSpotlight;

  // Escape key clears spotlight
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') clearSpotlight();
  });

  // Long-hover detection on table rows
  document.addEventListener('mouseover', (e) => {
    const tr = e.target.closest('tbody tr');
    if (!tr || tr === activeSpotlightRow) return;
    if (tr.closest('.modal-box') || tr.closest('#spotlight-card-popup') || tr.closest('#view-logs') || tr.closest('#logs-list') || tr.closest('#table-emp-hist') || window.location.pathname.includes('attendance')) return;

    clearTimeout(hoverTimer);

    // 1000ms (1 second) hold timer
    hoverTimer = setTimeout(() => {
      activateSpotlight(tr);
    }, 1000);
  });

  document.addEventListener('mouseout', (e) => {
    const tr = e.target.closest('tbody tr');
    if (!tr) return;

    const related = e.relatedTarget;
    if (related && (tr.contains(related) || (popupCardEl && popupCardEl.contains(related)))) return;

    clearTimeout(hoverTimer);
  });
})();
