/**
 * PentaTEAMBRIDGE — Dynamic Executive Overview Deck Engine
 * Allows Admins to customize top Overview cards on the fly.
 * Supports up to 4 concurrent cards selected from an extensive metric catalog.
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'penta_overview_cards_v1';
  const DEFAULT_CARDS = ['total_employees', 'attendance_rate', 'project_completion', 'active_leave'];
  const MAX_CARDS = 4;

  let cachedSummaryData = null;
  let isDropdownOpen = false;

  // Complete Catalog of Overview Cards
  const CARD_CATALOG = [
    {
      id: 'total_employees',
      title: 'Total Employees',
      category: 'Human Resources',
      icon: 'fa-solid fa-people-group',
      iconColor: 'teal',
      link: '/admin-organization.html',
      description: 'Active employee directory',
      getValue: (data) => (data?.totalEmployees !== undefined ? data.totalEmployees : '—'),
      getSubHtml: (data) => `<span class="stat-sub up"><i class="fa-solid fa-arrow-trend-up"></i> active directory</span>`
    },
    {
      id: 'attendance_rate',
      title: 'Attendance Rate',
      category: 'Time & Attendance',
      icon: 'fa-solid fa-user-check',
      iconColor: 'teal',
      link: '/admin-attendance.html',
      description: "Today's presence percentage",
      getValue: (data) => (data?.attendanceRate !== undefined ? `${data.attendanceRate}%` : '—'),
      getSubHtml: (data) => `<span class="stat-sub flat">— today's presence</span>`
    },
    {
      id: 'attendance_check',
      title: 'Attendance Check',
      category: 'Time & Attendance',
      icon: 'fa-solid fa-clipboard-user',
      iconColor: 'emerald',
      link: '/admin-attendance.html',
      description: 'Logged-in vs total team today',
      getValue: (data) => {
        const present = data?.presentToday || 0;
        const total = data?.totalEmployees || 0;
        return `${present} / ${total}`;
      },
      getSubHtml: (data) => `<span class="stat-sub up"><i class="fa-solid fa-circle-check"></i> checked in today</span>`
    },
    {
      id: 'project_completion',
      title: 'Project Completion',
      category: 'Workflows & Tasks',
      icon: 'fa-solid fa-circle-check',
      iconColor: 'indigo',
      link: '/admin-tasks.html',
      description: 'Workflow tasks completion percentage',
      getValue: (data) => (data?.projectCompletion !== undefined ? `${data.projectCompletion}%` : '—'),
      getCustomHtml: (data) => {
        const pct = data?.projectCompletion || 0;
        return `
          <div class="progress-track" style="margin-top:6px; background:rgba(0,0,0,0.06); height:6px; border-radius:99px; overflow:hidden;">
            <div class="progress-fill" style="width:${pct}%; height:100%; border-radius:99px; background:linear-gradient(90deg, #6366f1, #3b82f6); transition:width 0.4s ease;"></div>
          </div>
        `;
      }
    },
    {
      id: 'active_leave',
      title: 'Active Leave',
      category: 'Time & Attendance',
      icon: 'fa-solid fa-person-walking-luggage',
      iconColor: 'amber',
      link: '/admin-attendance.html',
      description: 'Pending leave requests & absences',
      getValue: (data) => (data?.activeLeaves !== undefined ? data.activeLeaves : '—'),
      getSubHtml: (data) => {
        const leaves = data?.activeLeaves || 0;
        return `<span class="stat-sub warn"><i class="fa-solid fa-triangle-exclamation"></i> ${leaves} pending approvals</span>`;
      }
    },
    {
      id: 'support_desk',
      title: 'Support Desk',
      category: 'Support & Tickets',
      icon: 'fa-solid fa-headset',
      iconColor: 'blue',
      link: '/admin-support.html',
      description: 'Open customer & internal tickets',
      getValue: (data) => {
        const open = data?.supportTickets?.open !== undefined ? data.supportTickets.open : 0;
        return `${open} Open`;
      },
      getSubHtml: (data) => {
        const urgent = data?.supportTickets?.urgent || 0;
        if (urgent > 0) {
          return `<span class="stat-sub warn"><i class="fa-solid fa-bolt"></i> ${urgent} urgent priority</span>`;
        }
        return `<span class="stat-sub up"><i class="fa-solid fa-check"></i> desk under control</span>`;
      }
    },
    {
      id: 'notices',
      title: 'Notice & Broadcasts',
      category: 'Communication',
      icon: 'fa-solid fa-bullhorn',
      iconColor: 'purple',
      link: '/admin-communication.html',
      description: 'Company-wide active notices',
      getValue: (data) => {
        const notices = data?.activeNotices !== undefined ? data.activeNotices : 0;
        return `${notices} Active`;
      },
      getSubHtml: (data) => `<span class="stat-sub up"><i class="fa-solid fa-bell"></i> company bulletin</span>`
    },
    {
      id: 'active_tasks',
      title: 'Task Creation & Active',
      category: 'Workflows & Tasks',
      icon: 'fa-solid fa-list-check',
      iconColor: 'cyan',
      link: '/admin-tasks.html',
      description: 'In-progress workflow tasks',
      getValue: (data) => {
        const active = data?.tasks?.active !== undefined ? data.tasks.active : 0;
        return `${active} Active`;
      },
      getSubHtml: (data) => {
        const overdue = data?.tasks?.overdue || 0;
        if (overdue > 0) {
          return `<span class="stat-sub warn"><i class="fa-solid fa-triangle-exclamation"></i> ${overdue} overdue task(s)</span>`;
        }
        return `<span class="stat-sub up"><i class="fa-solid fa-circle-check"></i> on schedule</span>`;
      }
    },
    {
      id: 'workstation_monitoring',
      title: 'Workstations Online',
      category: 'Monitoring & Ops',
      icon: 'fa-solid fa-desktop',
      iconColor: 'emerald',
      link: '/admin-monitoring.html',
      description: 'Active live workstation sessions',
      getValue: (data) => {
        const online = data?.onlineWorkstations !== undefined ? data.onlineWorkstations : 0;
        return `${online} Live`;
      },
      getSubHtml: (data) => `
        <span class="stat-sub up">
          <span style="width:7px; height:7px; border-radius:50%; background:#10b981; display:inline-block; box-shadow:0 0 8px #10b981;"></span>
          real-time telemetry
        </span>`
    },
    {
      id: 'dsr_reports',
      title: 'Daily Reports (DSR)',
      category: 'Reports & Logs',
      icon: 'fa-solid fa-file-signature',
      iconColor: 'violet',
      link: '/admin-reports.html',
      description: 'Self-reports & DSR submissions today',
      getValue: (data) => {
        const filed = data?.dsrSubmittedToday !== undefined ? data.dsrSubmittedToday : 0;
        return `${filed} Filed`;
      },
      getSubHtml: (data) => `<span class="stat-sub flat">— filed for today</span>`
    },
    {
      id: 'customers',
      title: 'Customer Accounts',
      category: 'Client Relations',
      icon: 'fa-solid fa-building-user',
      iconColor: 'amber',
      link: '/admin-customers.html',
      description: 'Active client organizations',
      getValue: (data) => {
        const total = data?.totalCustomers !== undefined ? data.totalCustomers : 0;
        return `${total} Clients`;
      },
      getSubHtml: (data) => `<span class="stat-sub up"><i class="fa-solid fa-handshake"></i> CRM network</span>`
    },
    {
      id: 'task_handovers',
      title: 'Task Handovers',
      category: 'Workflows & Tasks',
      icon: 'fa-solid fa-arrow-right-arrow-left',
      iconColor: 'rose',
      link: '/admin-tasks.html',
      description: 'Pending task transfer requests',
      getValue: (data) => {
        const pending = data?.pendingHandovers !== undefined ? data.pendingHandovers : 0;
        return `${pending} Pending`;
      },
      getSubHtml: (data) => {
        const pending = data?.pendingHandovers || 0;
        if (pending > 0) {
          return `<span class="stat-sub warn"><i class="fa-solid fa-clock-rotate-left"></i> review required</span>`;
        }
        return `<span class="stat-sub up"><i class="fa-solid fa-check"></i> all transfers cleared</span>`;
      }
    }
  ];

  // Retrieve selected cards array from localStorage
  function getSelectedCardIds() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length === MAX_CARDS) {
          // Verify each id exists in catalog
          const valid = parsed.every(id => CARD_CATALOG.some(c => c.id === id));
          if (valid) return parsed;
        }
      }
    } catch (e) {
      console.warn('Error reading saved overview cards:', e);
    }
    return [...DEFAULT_CARDS];
  }

  // Save selection
  function saveSelectedCardIds(ids) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch (e) {
      console.warn('Error saving overview cards:', e);
    }
  }

  // Show a non-intrusive toast notification
  function showToast(message, type = 'info') {
    const existing = document.getElementById('overview-deck-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'overview-deck-toast';
    toast.style.cssText = `
      position: fixed;
      bottom: 28px;
      right: 28px;
      z-index: 99999;
      background: ${type === 'warn' ? 'rgba(217, 119, 6, 0.95)' : 'rgba(15, 118, 110, 0.95)'};
      color: #ffffff;
      padding: 12px 20px;
      border-radius: 12px;
      font-size: 13.5px;
      font-weight: 600;
      box-shadow: 0 16px 36px rgba(0,0,0,0.22);
      backdrop-filter: blur(12px);
      display: flex;
      align-items: center;
      gap: 10px;
      animation: fadeInUp 0.25s ease;
    `;
    toast.innerHTML = `
      <i class="fa-solid ${type === 'warn' ? 'fa-triangle-exclamation' : 'fa-circle-info'}" style="font-size:16px;"></i>
      <span>${message}</span>
    `;

    document.body.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
      }
    }, 3200);
  }

  // Render the selected cards inside .stat-grid
  function renderOverviewDeck(summaryData) {
    if (summaryData) cachedSummaryData = summaryData;
    const grid = document.getElementById('overview-stat-grid') || document.querySelector('.stat-grid');
    if (!grid) return;

    grid.id = 'overview-stat-grid';
    const selectedIds = getSelectedCardIds();

    grid.innerHTML = selectedIds.map(id => {
      const card = CARD_CATALOG.find(c => c.id === id);
      if (!card) return '';

      const val = card.getValue(cachedSummaryData);
      const sub = card.getSubHtml ? card.getSubHtml(cachedSummaryData) : '';
      const custom = card.getCustomHtml ? card.getCustomHtml(cachedSummaryData) : '';

      return `
        <div class="card stat-card overview-active-card" 
             onclick="window.location.href='${card.link}'" 
             style="cursor: pointer; position: relative; transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);" 
             title="Open ${card.title}">
          <div class="stat-card-top">
            <span class="label" style="font-weight:600; color:var(--text-dark);">${card.title}</span>
            <div class="stat-icon ${card.iconColor}"><i class="${card.icon}"></i></div>
          </div>
          <div class="stat-value" style="font-weight:800; color:var(--text-dark);">${val}</div>
          ${custom}
          ${sub}
          <div class="card-goto-hint" style="position: absolute; bottom: 8px; right: 12px; font-size: 11px; opacity: 0; color: var(--teal-600); transition: opacity 0.2s ease;">
            <i class="fa-solid fa-arrow-up-right-from-square"></i>
          </div>
        </div>
      `;
    }).join('');

    // Update active count label in header if present
    const countBadge = document.getElementById('overview-active-count-label');
    if (countBadge) {
      countBadge.textContent = `${selectedIds.length} Cards Active`;
    }
  }

  // Render options inside the Card Customizer Dropdown
  function renderDropdownOptions() {
    const optionsGrid = document.getElementById('overview-card-options-grid');
    if (!optionsGrid) return;

    const selectedIds = getSelectedCardIds();

    // Update Header Counter Badge
    const counterBadge = document.getElementById('card-selection-counter-badge');
    if (counterBadge) {
      counterBadge.textContent = `${selectedIds.length} / ${MAX_CARDS} Selected`;
      if (selectedIds.length === MAX_CARDS) {
        counterBadge.style.background = 'rgba(16, 185, 129, 0.15)';
        counterBadge.style.color = '#059669';
        counterBadge.style.borderColor = 'rgba(16, 185, 129, 0.35)';
      } else {
        counterBadge.style.background = 'rgba(217, 119, 6, 0.15)';
        counterBadge.style.color = '#d97706';
        counterBadge.style.borderColor = 'rgba(217, 119, 6, 0.35)';
      }
    }

    optionsGrid.innerHTML = CARD_CATALOG.map(card => {
      const isSelected = selectedIds.includes(card.id);
      const liveVal = card.getValue(cachedSummaryData);

      return `
        <div class="overview-option-item ${isSelected ? 'selected' : ''}" 
             data-card-id="${card.id}"
             style="
               display: flex;
               align-items: center;
               justify-content: space-between;
               gap: 12px;
               padding: 12px 14px;
               border-radius: 14px;
               cursor: pointer;
               user-select: none;
               transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
               background: ${isSelected ? 'rgba(204, 251, 241, 0.45)' : 'rgba(255, 255, 255, 0.65)'};
               border: ${isSelected ? '2px solid #0d9488' : '1.5px solid rgba(226, 232, 240, 0.8)'};
               box-shadow: ${isSelected ? '0 4px 14px rgba(13, 148, 136, 0.15)' : 'none'};
             ">
          <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
            <!-- Checkbox Visual -->
            <div class="option-check-circle" style="
              width: 22px;
              height: 22px;
              border-radius: 6px;
              border: 2px solid ${isSelected ? '#0d9488' : '#cbd5e1'};
              background: ${isSelected ? '#0d9488' : '#ffffff'};
              display: flex;
              align-items: center;
              justify-content: center;
              color: #ffffff;
              font-size: 11px;
              flex-shrink: 0;
              transition: all 0.2s ease;
            ">
              ${isSelected ? '<i class="fa-solid fa-check"></i>' : ''}
            </div>

            <!-- Card Icon -->
            <div class="stat-icon ${card.iconColor}" style="width: 34px; height: 34px; font-size: 13px; flex-shrink: 0;">
              <i class="${card.icon}"></i>
            </div>

            <!-- Title & Category Info -->
            <div style="min-width: 0;">
              <div style="font-size: 13.5px; font-weight: 700; color: var(--text-dark); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${card.title}
              </div>
              <div style="font-size: 11px; color: var(--text-muted); font-weight: 500;">
                ${card.category} · <span style="font-weight: 600; color: var(--teal-700);">${liveVal}</span>
              </div>
            </div>
          </div>

          <!-- Selection Indicator Tag -->
          ${isSelected ? `
            <span style="font-size: 11px; font-weight: 700; color: #0d9488; background: rgba(13, 148, 136, 0.12); padding: 2px 8px; border-radius: 99px; flex-shrink: 0;">
              Active
            </span>
          ` : `
            <span style="font-size: 11px; font-weight: 600; color: #94a3b8; flex-shrink: 0;">
              + Add
            </span>
          `}
        </div>
      `;
    }).join('');

    // Attach click events to each option item
    optionsGrid.querySelectorAll('.overview-option-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const cardId = item.getAttribute('data-card-id');
        toggleCardSelection(cardId);
      });
    });
  }

  // Toggle selection of a card
  function toggleCardSelection(cardId) {
    let selectedIds = getSelectedCardIds();
    const isCurrentlySelected = selectedIds.includes(cardId);

    if (isCurrentlySelected) {
      if (selectedIds.length <= 1) {
        showToast('At least 1 overview card must remain active.', 'warn');
        return;
      }
      selectedIds = selectedIds.filter(id => id !== cardId);
      saveSelectedCardIds(selectedIds);
      renderOverviewDeck();
      renderDropdownOptions();
    } else {
      if (selectedIds.length >= MAX_CARDS) {
        showToast(`You can choose up to ${MAX_CARDS} cards. Please uncheck one card first to choose this one.`, 'warn');
        return;
      }
      selectedIds.push(cardId);
      saveSelectedCardIds(selectedIds);
      renderOverviewDeck();
      renderDropdownOptions();
    }
  }

  // Reset to default 4 cards
  function resetToDefault() {
    saveSelectedCardIds([...DEFAULT_CARDS]);
    renderOverviewDeck();
    renderDropdownOptions();
    showToast('Overview cards reset to default layout.', 'info');
  }

  // Toggle Dropdown Visibility
  function toggleDropdown(forceState) {
    const dropdown = document.getElementById('overview-card-picker');
    const chevron = document.getElementById('overview-dropdown-chevron');
    if (!dropdown) return;

    if (typeof forceState === 'boolean') {
      isDropdownOpen = forceState;
    } else {
      isDropdownOpen = !isDropdownOpen;
    }

    if (isDropdownOpen) {
      renderDropdownOptions();
      dropdown.style.display = 'block';
      if (chevron) chevron.style.transform = 'rotate(180deg)';
    } else {
      dropdown.style.display = 'none';
      if (chevron) chevron.style.transform = 'rotate(0deg)';
    }
  }

  // Fetch KPI counts from backend and update deck
  function fetchDashboardStats() {
    fetch('/api/v1/admin/employees/dashboard-summary', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          cachedSummaryData = data;
          renderOverviewDeck(data);
          if (isDropdownOpen) {
            renderDropdownOptions();
          }
        }
      })
      .catch(err => console.error('Error fetching dashboard summary:', err));
  }

  // Setup Event Listeners and DOM Initialization
  function init() {
    const headerWrap = document.getElementById('overview-heading-wrap');
    const dropdown = document.getElementById('overview-card-picker');
    const resetBtn = document.getElementById('reset-overview-cards-btn');
    const closeBtn = document.getElementById('close-overview-picker-btn');

    if (headerWrap) {
      headerWrap.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDropdown();
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        resetToDefault();
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDropdown(false);
      });
    }

    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (isDropdownOpen && dropdown && headerWrap) {
        if (!dropdown.contains(e.target) && !headerWrap.contains(e.target)) {
          toggleDropdown(false);
        }
      }
    });

    // Prevent clicks inside dropdown from bubbling up
    if (dropdown) {
      dropdown.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    // Expose global methods
    window.renderOverviewDeck = renderOverviewDeck;
    window.refreshOverviewCards = fetchDashboardStats;

    // Initial fetch
    fetchDashboardStats();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
