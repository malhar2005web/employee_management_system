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

document.addEventListener('DOMContentLoaded', () => {
  wireToggleGroup('.toggle-group');
  wireToggleGroup('.tab-group');

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
    fetch('/api/v1/auth/authCheck', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (!data.success) {
          window.location.href = '/login.html';
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
    const topbarUser = document.querySelector('.topbar-user');
    if (topbarUser) {
      topbarUser.style.cursor = 'pointer';
      topbarUser.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.location.href = '/admin-profile.html';
      });
    }
  }

  // ── Hide removed modules from sidebar (Timesheets, Goals, Training, Workload/Activity Summary, Reports) ──
  const removedPages = [
    'employee-timesheets', 'employee-goals', 'employee-trainings',
    'admin-timesheets', 'admin-goals', 'admin-trainings', 'admin-workload', 'admin-reports',
    'admin-employees', 'admin-shifts', 'admin-projects', 'admin-screenshots', 'admin-monitoring',
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
