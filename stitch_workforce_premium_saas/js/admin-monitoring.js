// ── TERAMIND ADMIN MONITORING CONTROLLER ──────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    initMonitoringDashboard();
    setupEventListeners();
});

let autoRefreshTimer = null;

async function initMonitoringDashboard() {
    await Promise.all([
        loadHealthCards(),
        loadWorkstationsData(),
        loadAppsAnalytics(),
        loadWebAnalytics(),
        loadAlertsData(),
        loadTeramindConfig()
    ]);
    setupAutoRefresh();
}

function setupEventListeners() {
    // Auto refresh selector
    document.getElementById("auto-refresh-select")?.addEventListener("change", setupAutoRefresh);

    // Date range selector
    document.getElementById("date-range-select")?.addEventListener("change", () => {
        loadAppsAnalytics();
        loadWebAnalytics();
    });

    // Employee Modal Search & Time Filter listeners
    document.getElementById("emp-log-search")?.addEventListener("input", () => {
        if (window.applyEmpLogsFilters) window.applyEmpLogsFilters();
    });
    document.getElementById("emp-log-time-filter")?.addEventListener("change", () => {
        if (window.applyEmpLogsFilters) window.applyEmpLogsFilters();
    });

    // Manual sync button
    document.getElementById("sync-now-btn")?.addEventListener("click", async () => {
        const btn = document.getElementById("sync-now-btn");
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Syncing...`;
        try {
            const res = await fetch("/api/v1/admin/monitoring/sync", { method: "POST" });
            const data = await res.json();
            if (data.success) {
                await initMonitoringDashboard();
            }
        } catch (e) {
            console.error("Sync error:", e);
        } finally {
            btn.innerHTML = `<i class="fa-solid fa-cloud-arrow-down"></i> Sync Now`;
        }
    });

    // Test connection button in modal
    document.getElementById("btn-test-conn")?.addEventListener("click", async () => {
        const url = document.getElementById("cfg-url").value;
        const token = document.getElementById("cfg-token").value;
        const resBox = document.getElementById("connection-test-result");

        resBox.style.display = "block";
        resBox.className = "";
        resBox.style.background = "#f3f4f6";
        resBox.style.color = "#374151";
        resBox.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Testing connection to Teramind...`;

        try {
            const res = await fetch("/api/v1/admin/monitoring/test-connection", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ instance_url: url, api_token: token })
            });
            const data = await res.json();

            if (data.success) {
                resBox.style.background = "rgba(16, 185, 129, 0.15)";
                resBox.style.color = "#047857";
                resBox.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${data.message}`;
            } else {
                resBox.style.background = "rgba(239, 68, 68, 0.15)";
                resBox.style.color = "#b91c1c";
                resBox.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> ${data.message}`;
            }
        } catch (e) {
            resBox.style.background = "rgba(239, 68, 68, 0.15)";
            resBox.style.color = "#b91c1c";
            resBox.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> Test failed: ${e.message}`;
        }
    });

    // Config form submit
    document.getElementById("config-form")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const instance_url = document.getElementById("cfg-url").value;
        const api_token = document.getElementById("cfg-token").value;
        const sync_interval_minutes = parseInt(document.getElementById("cfg-interval").value, 10);
        const enable_input_rate = document.getElementById("cfg-input-rate").checked;

        try {
            const res = await fetch("/api/v1/admin/monitoring/config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    instance_url,
                    api_token,
                    sync_interval_minutes,
                    enable_input_rate,
                    is_enabled: true
                })
            });
            const data = await res.json();
            if (data.success) {
                document.getElementById("config-modal")?.classList.remove("active");
                initMonitoringDashboard();
            }
        } catch (e) {
            console.error("Save config error:", e);
        }
    });
}

function setupAutoRefresh() {
    if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
        autoRefreshTimer = null;
    }
    const val = document.getElementById("auto-refresh-select")?.value;
    if (val && val !== "manual") {
        const ms = parseInt(val, 10);
        autoRefreshTimer = setInterval(() => {
            loadHealthCards();
            loadWorkstationsData();
        }, ms);
    }
}

// Tab switcher
window.switchTab = function(tabId, btn) {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

    btn.classList.add("active");
    document.getElementById(tabId)?.classList.add("active");
};

// ── DATA LOADERS (ZERO FALLBACK DEFAULTS) ────────────────────────────────────

async function loadHealthCards() {
    try {
        const res = await fetch("/api/v1/admin/monitoring/health");
        const json = await res.json();
        if (json.success && json.data) {
            const d = json.data;
            document.getElementById("card-online-comp").innerText = d.online_computers;
            document.getElementById("card-offline-comp").innerText = d.offline_computers;
            document.getElementById("card-working-emp").innerText = d.employees_working;
            document.getElementById("card-idle-emp").innerText = d.employees_idle;
            document.getElementById("card-alerts").innerText = d.alerts_today;
            document.getElementById("card-avg-prod").innerText = `${d.avg_productivity}%`;
        }
    } catch (e) {
        console.error("Error loading health cards:", e);
    }
}

async function loadWorkstationsData() {
    try {
        const res = await fetch("/api/v1/admin/monitoring/dashboard");
        const json = await res.json();
        const tbody = document.getElementById("workstations-tbody");
        if (!tbody) return;

        const dataRows = (json.success && Array.isArray(json.data)) ? json.data : [];

        if (dataRows.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:32px; color:var(--text-muted); font-size:14px;"><i class="fa-solid fa-satellite-dish" style="font-size:24px; margin-bottom:8px; display:block; opacity:0.4;"></i>No workstation data yet — waiting for Teramind sync...</td></tr>`;
            return;
        }

        tbody.innerHTML = dataRows.map(row => {
            const hasWorkstation = !!(row.computer_name && row.computer_name !== '—');
            const isIdle = row.agent_status === 'Idle' || row.agent_status === 'Stopped';
            const isOnline = row.is_online === true;
            
            let dotColor = '#dc2626'; // Red (Offline)
            let dotTitle = 'Offline';
            if (!hasWorkstation) {
                dotColor = '#94a3b8'; // Grey (Unassigned)
                dotTitle = 'No Workstation Assigned';
            } else if (isOnline) {
                dotColor = isIdle ? '#d97706' : '#059669'; // Orange (Idle) or Green (Active)
                dotTitle = isIdle ? 'Online (Idle)' : 'Online (Active)';
            }

            const prodSec = row.productive_seconds || 0;
            const activeSec = row.active_seconds || 0;
            const prodHours = (prodSec / 3600).toFixed(1);
            const activeHours = (activeSec / 3600).toFixed(1);
            const safeName = (row.full_name || '').replace(/'/g, "\\'");
            const activeApp = row.active_app && row.active_app.trim() && row.active_app !== '—' ? row.active_app : '—';
            const activeWebsite = row.active_website && row.active_website.trim() && row.active_website !== '—' ? row.active_website : '—';
            const inputScore = (row.input_score != null && row.input_score > 0) ? `${row.input_score}%` : '—';
            const compName = row.computer_name || '—';
            const osLabel = row.os || '—';

            return `
                <tr class="workstation-row" 
                    data-emp-id="${row.employee_id}" 
                    data-emp-name="${safeName}"
                    style="border-bottom:1px solid rgba(0,0,0,0.04); font-size:13.5px; cursor:pointer; transition: background 0.15s ease;"
                    onclick="window.openEmployeeLogsModal(${row.employee_id}, '${safeName}')"
                    onmouseover="this.style.background='rgba(35, 184, 153, 0.08)'"
                    onmouseout="this.style.background='transparent'"
                    title="Click to view detailed activity logs for ${row.full_name}">
                    <td style="padding:12px; font-weight:700;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span class="status-dot" title="${dotTitle}" style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${dotColor}; box-shadow: 0 0 8px ${dotColor}; flex-shrink:0;"></span>
                            <div>
                                <div style="color:var(--teal-900); text-decoration:underline; font-size:14.5px; font-weight:800;">${row.full_name}</div>
                                <span style="font-size:11.5px; color:var(--text-muted); font-weight:600;">${row.designation || 'Staff'} (${row.employee_code})</span>
                            </div>
                        </div>
                    </td>
                    <td style="padding:12px;">
                        ${hasWorkstation ? `
                            <div style="font-weight:700; color:#0f172a;"><i class="fa-solid fa-desktop" style="color:var(--teal-900);"></i> ${compName}</div>
                            <span style="font-size:11.5px; color:var(--text-muted);">${osLabel}</span>
                        ` : `
                            <div style="color:var(--text-muted); font-size:12.5px; font-weight:600;"><i class="fa-solid fa-ban" style="opacity:0.4;"></i> Unassigned</div>
                            <span style="font-size:11px; color:var(--text-muted); opacity:0.8;">No hardware linked</span>
                        `}
                        <div style="margin-top:5px;">
                            <button type="button" class="btn-pill btn-select-pc" style="font-size:11px; padding:4px 10px; border:1px solid #cbd5e1; background:#f8fafc; color:#334155; display:inline-flex; align-items:center; gap:5px; font-weight:700; cursor:pointer; position:relative; z-index:5;" onclick="event.stopPropagation(); event.preventDefault(); window.openAssignModal(event, ${row.employee_id}, '${safeName}', ${row.computer_id || 'null'})" title="Assign or change workstation for ${safeName}">
                                <i class="fa-solid fa-pen-to-square" style="color:var(--teal-900);"></i> Select PC
                            </button>
                        </div>
                    </td>
                    <td style="padding:12px; font-weight:600; color:${activeApp === '—' ? 'var(--text-muted)' : 'var(--teal-900)'};">
                        <i class="fa-solid fa-window-maximize" style="color:var(--text-muted);"></i> ${activeApp}
                    </td>
                    <td style="padding:12px; font-weight:600; color:${activeWebsite === '—' ? 'var(--text-muted)' : '#2563eb'};">
                        <i class="fa-solid fa-globe" style="color:var(--text-muted);"></i> ${activeWebsite}
                    </td>
                    <td style="padding:12px;">
                        ${prodSec > 0 ? `<div><strong>${prodHours}h</strong> Productive</div><span style="font-size:11.5px; color:var(--text-muted);">${activeHours}h Total Active</span>` : `<span style="color:var(--text-muted); font-size:12px;">No data today</span>`}
                    </td>
                    <td style="padding:12px;">
                        ${inputScore !== '—' ? `<span style="font-weight:700; color:var(--teal-900);">${inputScore} Activity</span><div style="font-size:10.5px; color:var(--text-muted);">Mouse/Key score</div>` : `<span style="color:var(--text-muted); font-size:12px;">—</span>`}
                    </td>
                    <td style="padding:12px; text-align:right;">
                        <button type="button" class="btn-pill primary" style="font-size:12px; padding:6px 14px;" onclick="event.stopPropagation(); window.openEmployeeLogsModal(${row.employee_id}, '${safeName}')">
                            <i class="fa-solid fa-list-check"></i> View Logs
                        </button>
                    </td>
                </tr>
            `;
        }).join("");

        // Attach event delegation for robustness
        tbody.querySelectorAll('.workstation-row').forEach(row => {
            row.addEventListener('click', (e) => {
                const empId = row.getAttribute('data-emp-id');
                const empName = row.getAttribute('data-emp-name');
                if (empId) window.openEmployeeLogsModal(empId, empName);
            });
        });
    } catch (e) {
        console.error("Error loading workstations:", e);
    }
}

// ── CLOSE EMPLOYEE DETAILED LOGS MODAL ──────────────────────────────────────────
window.closeEmployeeLogsModal = function closeEmployeeLogsModal() {
    const modal = document.getElementById("emp-logs-modal");
    if (!modal) return;
    modal.classList.remove("active");
    modal.style.display = "none";
    modal.style.opacity = "0";
    modal.style.pointerEvents = "none";
};

// ── OPEN EMPLOYEE DETAILED LOGS MODAL (IMAGE 2 STYLE) ─────────────────────────
window.openEmployeeLogsModal = async function openEmployeeLogsModal(empId, empName = '') {
    window.currentActiveEmpId = empId;
    const modal = document.getElementById("emp-logs-modal");
    const tbody = document.getElementById("emp-logs-tbody");
    if (!modal || !tbody) {
        console.error("Modal element #emp-logs-modal not found!");
        return;
    }

    // Instantly show modal
    modal.style.display = "flex";
    modal.style.opacity = "1";
    modal.style.pointerEvents = "auto";
    modal.style.zIndex = "99999";
    modal.classList.add("active");

    // Set initial loading state in modal
    if (document.getElementById("emp-log-name")) document.getElementById("emp-log-name").innerText = empName || `Employee #${empId}`;
    tbody.innerHTML = `<tr><td colspan="6" style="padding:40px; text-align:center; color:var(--text-muted); font-size:14px;"><i class="fa-solid fa-satellite-dish" style="font-size:24px; margin-bottom:12px; display:block; color:var(--teal-900);"></i>No detailed activity logs recorded for this workstation.</td></tr>`;

    // Fetch live API employee details and logs
    try {
        const res = await fetch(`/api/v1/admin/monitoring/employee/${empId}/logs`);
        if (res.ok) {
            const json = await res.json();
            if (json.success && json.employee) {
                const emp = json.employee;
                if (document.getElementById("emp-log-name")) document.getElementById("emp-log-name").innerText = emp.full_name || empName;
                if (document.getElementById("emp-log-code")) document.getElementById("emp-log-code").innerText = emp.employee_code || `EMP-${empId}`;
                if (document.getElementById("emp-log-workstation")) document.getElementById("emp-log-workstation").innerHTML = `<i class="fa-solid fa-desktop" style="color:#047857; margin-right:4px;"></i> ${emp.computer_name || '—'}`;
                if (document.getElementById("emp-log-os")) document.getElementById("emp-log-os").innerHTML = `<i class="fa-brands fa-windows" style="color:#0284c7; margin-right:4px;"></i> ${emp.os || '—'}`;
                if (document.getElementById("emp-log-ip")) document.getElementById("emp-log-ip").innerText = emp.ip_address || '—';
                if (document.getElementById("emp-log-agent")) document.getElementById("emp-log-agent").innerText = emp.agent_version || '—';

                const statusEl = document.getElementById("emp-log-status");
                if (statusEl) {
                    const isOnline = emp.is_online === true;
                    const isIdle = emp.agent_status === 'Idle' || emp.agent_status === 'Stopped';
                    statusEl.className = `badge-status ${!isOnline ? 'offline' : (isIdle ? 'idle' : 'online')}`;
                    statusEl.innerText = isOnline ? (isIdle ? 'Online (Idle)' : 'Online (Active)') : 'Offline';
                }
            }

            const logs = (json.success && Array.isArray(json.logs)) ? json.logs : [];
            window.allCurrentEmpLogs = logs;
            window.activeEmployeeMeta = json.employee || { full_name: empName, employee_code: `EMP-${empId}` };
            window.currentEmpLogsData = logs;
            
            if (window.applyEmpLogsFilters) {
                window.applyEmpLogsFilters();
            } else {
                renderEmpLogsTable(logs);
            }
        }
    } catch (e) {
        console.error("Error fetching employee activity logs:", e);
        renderEmpLogsTable([]);
    }
};

// ── FILTER EMPLOYEE LOGS IN MODAL BY TIME & SEARCH ───────────────────────────
window.applyEmpLogsFilters = function applyEmpLogsFilters() {
    const rawLogs = window.allCurrentEmpLogs || [];
    const timeFilter = document.getElementById("emp-log-time-filter")?.value || 'today';
    const searchQuery = (document.getElementById("emp-log-search")?.value || '').toLowerCase().trim();

    const now = Math.floor(Date.now() / 1000);
    let startUnix = 0;
    let endUnix = now + 86400;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartUnix = Math.floor(todayStart.getTime() / 1000);

    switch (timeFilter) {
        case '1hr':
            startUnix = now - 3600;
            break;
        case '4hr':
            startUnix = now - (4 * 3600);
            break;
        case 'yesterday': {
            const yestStart = new Date(todayStart);
            yestStart.setDate(yestStart.getDate() - 1);
            startUnix = Math.floor(yestStart.getTime() / 1000);
            endUnix = todayStartUnix;
            break;
        }
        case '7days':
            startUnix = now - (7 * 86400);
            break;
        case '30days':
            startUnix = now - (30 * 86400);
            break;
        case 'today':
        default:
            startUnix = todayStartUnix;
            break;
    }

    let filtered = rawLogs.filter(row => {
        const rowUnix = row.start_unix || (row.start_time ? Math.floor(new Date(row.start_time).getTime() / 1000) : 0);
        if (rowUnix > 0) {
            if (rowUnix < startUnix || rowUnix > endUnix) return false;
        }
        if (searchQuery) {
            const proc = (row.process || '').toLowerCase();
            const title = (row.app_title || '').toLowerCase();
            const cat = (row.category || '').toLowerCase();
            const task = (row.task_title || '').toLowerCase();
            if (!proc.includes(searchQuery) && !title.includes(searchQuery) && !cat.includes(searchQuery) && !task.includes(searchQuery)) {
                return false;
            }
        }
        return true;
    });

    window.currentFilteredEmpLogs = filtered;
    renderEmpLogsTable(filtered);
};

// ── EXPORT INDIVIDUAL EMPLOYEE ACTIVITY LOGS AS EXCEL / CSV (BULLETPROOF) ───
window.exportCurrentEmployeeLogsCSV = async function exportCurrentEmployeeLogsCSV() {
    const emp = window.activeEmployeeMeta || {};
    const empId = window.currentActiveEmpId || emp.id || document.getElementById("assign-emp-id")?.value;
    const empName = emp.full_name || document.getElementById("emp-log-name")?.innerText || "Employee";
    const empCode = emp.employee_code || document.getElementById("emp-log-code")?.innerText || "EMP";
    const workstation = emp.computer_name || document.getElementById("emp-log-workstation")?.innerText?.replace(/DESKTOP-/g, '').trim() || "PC";
    const timeFilter = document.getElementById("emp-log-time-filter")?.value || 'Today';

    const clean = str => `"${String(str || '').replace(/"/g, '""').replace(/\r?\n|\r/g, ' ').trim()}"`;
    const cleanExcelText = str => `="` + String(str || '').replace(/"/g, '""').replace(/\r?\n|\r/g, ' ').trim() + `"`;
    const headers = [
        "Employee Code",
        "Employee Name",
        "Workstation",
        "Activity Date (DD-MM-YYYY)",
        "Start Time",
        "End Time",
        "Duration",
        "Application / Process",
        "App / Webpage Title",
        "Category",
        "Task Session / Context"
    ];

    const csvRows = [headers.join(",")];
    let rowsAdded = 0;

    function splitDT(dtStr) {
        if (!dtStr || dtStr === '—') return { date: '—', time: '—' };
        const parts = String(dtStr).trim().split(/\s+/);
        if (parts.length >= 2) {
            return { date: parts[0], time: parts.slice(1).join(' ') };
        }
        return { date: dtStr, time: '—' };
    }

    function formatExcelDate(dateStr) {
        if (!dateStr || dateStr === '—') return '—';
        const match = String(dateStr).trim().match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
        if (match) {
            const day = match[1];
            const monthNum = parseInt(match[2], 10);
            const year = match[3];
            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const monthName = months[monthNum - 1] || match[2];
            return `${day}-${monthName}-${year}`;
        }
        return dateStr;
    }

    // 1. Try from in-memory logs (filtered or all)
    let logs = (window.currentFilteredEmpLogs && window.currentFilteredEmpLogs.length > 0) 
        ? window.currentFilteredEmpLogs 
        : (window.allCurrentEmpLogs || []);

    if (logs && logs.length > 0) {
        logs.forEach(row => {
            const startRaw = formatLogDateTime(row.start_time || row.time || '—', row.start_unix);
            const endRaw = formatLogDateTime(row.end_time || row.time || '—', row.end_unix);
            
            const startParsed = splitDT(startRaw);
            const endParsed = splitDT(endRaw);

            const rawDate = startParsed.date !== '—' ? startParsed.date : (endParsed.date !== '—' ? endParsed.date : new Date().toLocaleDateString('en-GB').replace(/\//g, '-'));
            const logDate = formatExcelDate(rawDate);
            const startTime = startParsed.time;
            const endTime = endParsed.time;

            const dur = formatCompactDuration(row.duration);
            const process = row.process || '—';
            const title = row.app_title || '—';
            const cat = row.category || 'Productive';
            const task = row.task_title || (row.session_id ? `Task #${row.session_id}` : 'General Workstation Activity');

            csvRows.push([
                clean(empCode),
                clean(empName),
                clean(workstation),
                cleanExcelText(logDate),
                cleanExcelText(startTime),
                cleanExcelText(endTime),
                clean(dur),
                clean(process),
                clean(title),
                clean(cat),
                clean(task)
            ].join(","));
            rowsAdded++;
        });
    }

    // 2. If memory was empty, scrape the active DOM table directly
    if (rowsAdded === 0) {
        const tableRows = document.querySelectorAll("#emp-logs-tbody tr");
        tableRows.forEach(tr => {
            const cells = tr.querySelectorAll("td");
            if (cells.length >= 5 && !tr.innerText.includes("No activity logs") && !tr.innerText.includes("Loading")) {
                const startRaw = cells[0]?.innerText || '—';
                const endRaw = cells[1]?.innerText || '—';
                
                const startParsed = splitDT(startRaw);
                const endParsed = splitDT(endRaw);

                const rawDate = startParsed.date !== '—' ? startParsed.date : (endParsed.date !== '—' ? endParsed.date : new Date().toLocaleDateString('en-GB').replace(/\//g, '-'));
                const logDate = formatExcelDate(rawDate);
                const startTime = startParsed.time;
                const endTime = endParsed.time;

                const dur = cells[2]?.innerText || '—';
                const appTitle = cells[3]?.innerText || '—';
                const cat = cells[4]?.innerText || 'Productive';
                const task = 'General Workstation Activity';

                // Extract process name and title
                const parts = appTitle.split('—');
                const proc = parts[0]?.trim() || 'app.exe';
                const title = parts.slice(1).join('—')?.trim() || appTitle;

                csvRows.push([
                    clean(empCode),
                    clean(empName),
                    clean(workstation),
                    cleanExcelText(logDate),
                    cleanExcelText(startTime),
                    cleanExcelText(endTime),
                    clean(dur),
                    clean(proc),
                    clean(title),
                    clean(cat),
                    clean(task)
                ].join(","));
                rowsAdded++;
            }
        });
    }

    // 3. If still 0 rows, fetch from backend export-telemetry API directly
    if (rowsAdded === 0 && empId) {
        try {
            const token = localStorage.getItem("token") || "";
            const res = await fetch(`/api/v1/admin/monitoring/export-telemetry?employee_id=${empId}&range=${encodeURIComponent(timeFilter)}&format=csv`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `Activity_Logs_${empName.replace(/[^a-zA-Z0-9]/g, '_')}_${timeFilter}_${new Date().toISOString().split('T')[0]}.csv`;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
                return;
            }
        } catch (err) {
            console.warn("Backend direct telemetry fetch failed:", err);
        }
    }

    if (rowsAdded === 0) {
        alert("No activity logs recorded for this workstation yet.");
        return;
    }

    // Trigger instant download using standard UTF-8 BOM CSV Blob
    const csvString = "\uFEFF" + csvRows.join("\r\n");
    const safeEmpName = empName.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `Activity_Logs_${safeEmpName}_${timeFilter}_${new Date().toISOString().split('T')[0]}.csv`;

    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, 500);
};

function formatLogDateTime(dtStr, unixTs = null) {
    if (unixTs && !isNaN(unixTs) && unixTs > 0) {
        try {
            const d = new Date(unixTs * 1000);
            const parts = new Intl.DateTimeFormat('en-GB', {
                timeZone: 'Asia/Kolkata',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            }).formatToParts(d);
            const p = {};
            parts.forEach(({ type, value }) => { p[type] = value; });
            return `${p.day}-${p.month}-${p.year} ${p.hour}:${p.minute}:${p.second}`;
        } catch (e) {}
    }
    if (!dtStr || dtStr === '—') return '—';
    // If it's already in DD-MM-YYYY HH:mm:ss format, return as is
    if (/^\d{2}-\d{2}-\d{4}\s\d{2}:\d{2}:\d{2}$/.test(dtStr)) return dtStr;
    // If it's in YYYY-MM-DD HH:mm:ss format, reformat to DD-MM-YYYY HH:mm:ss
    const match = dtStr.match(/^(\d{4})-(\d{2})-(\d{2})\s(\d{2}:\d{2}:\d{2})$/);
    if (match) {
        return `${match[3]}-${match[2]}-${match[1]} ${match[4]}`;
    }
    // Try parsing as ISO or timestamp and format in Asia/Kolkata (IST)
    try {
        const d = new Date(dtStr);
        if (!isNaN(d.getTime())) {
            const parts = new Intl.DateTimeFormat('en-GB', {
                timeZone: 'Asia/Kolkata',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            }).formatToParts(d);
            const p = {};
            parts.forEach(({ type, value }) => { p[type] = value; });
            return `${p.day}-${p.month}-${p.year} ${p.hour}:${p.minute}:${p.second}`;
        }
    } catch (e) {}
    return dtStr;
}

function formatCompactDuration(dur) {
    if (!dur && dur !== 0) return '0s';
    let totalSecs = 0;
    if (typeof dur === 'number') {
        totalSecs = dur;
    } else if (typeof dur === 'string') {
        // If already formatted like "14m 11s" or "2h 15m" or "9s", return as is
        if (/[hms]/.test(dur) && !/^\d{2}:\d{2}/.test(dur)) return dur;
        // If it's HH:MM:SS format
        const parts = dur.split(':').map(p => parseInt(p, 10));
        if (parts.length === 3) {
            totalSecs = (parts[0] * 3600) + (parts[1] * 60) + parts[2];
        } else if (parts.length === 2) {
            totalSecs = (parts[0] * 60) + parts[1];
        } else {
            totalSecs = parseInt(dur, 10) || 0;
        }
    }
    if (totalSecs <= 0) return '0s';
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    if (hrs > 0) {
        return `${hrs}h ${mins}m ${secs > 0 ? secs + 's' : ''}`.trim();
    }
    if (mins > 0) {
        return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
    }
    return `${secs}s`;
}

function renderEmpLogsTable(logs) {
    const tbody = document.getElementById("emp-logs-tbody");
    if (!tbody) return;

    if (!logs || logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="padding:20px; text-align:center; color:var(--text-muted);">No activity logs recorded for this workstation.</td></tr>`;
        return;
    }

    // Group logs by task_title / session_id
    const groups = [];
    const groupMap = new Map();

    logs.forEach(row => {
        const groupKey = row.task_title || (row.session_id ? `Task Session #${row.session_id}` : 'General Workstation Activity');
        if (!groupMap.has(groupKey)) {
            const groupObj = {
                title: groupKey,
                session_id: row.session_id,
                task_priority: row.task_priority || 'Normal',
                task_status: row.task_status || 'In Progress',
                is_task_bound: row.is_task_bound || false,
                session_start_unix: row.session_start_unix || row.start_unix,
                session_end_unix: row.session_end_unix || row.end_unix,
                session_start_str: row.session_start_str || row.start_time,
                session_end_str: row.session_end_str || row.end_time,
                computer_id: row.computer_id || null,
                rows: []
            };
            groupMap.set(groupKey, groupObj);
            groups.push(groupObj);
        }
        groupMap.get(groupKey).rows.push(row);
    });

    let html = '';
    groups.forEach(group => {
        const prioClass = (group.task_priority || 'normal').toLowerCase();
        const headerBg = group.is_task_bound 
            ? 'linear-gradient(135deg, rgba(4,120,87,0.12), rgba(2,132,199,0.08))' 
            : 'rgba(241, 245, 249, 0.75)';
        const borderColor = group.is_task_bound ? '#047857' : '#94a3b8';
        const iconTag = group.is_task_bound ? 'fa-list-check' : 'fa-laptop';
        const badgeLabel = group.is_task_bound ? `TASK SESSION ${group.session_id ? '#' + group.session_id : ''}` : 'GENERAL WORKSTATION ACTIVITY';
        const cleanGroupTitle = (group.title || '').replace(/'/g, "\\'");
        const formattedSessStart = formatLogDateTime(group.session_start_str, group.session_start_unix);
        const formattedSessEnd = formatLogDateTime(group.session_end_str, group.session_end_unix);
        const startShort = formattedSessStart.split(' ')[1] || 'Start';
        const endShort = formattedSessEnd.split(' ')[1] || 'End';

        html += `
            <tr style="background:${headerBg}; border-left:4px solid ${borderColor}; border-bottom:1px solid rgba(0,0,0,0.08);">
                <td colspan="6" style="padding:10px 16px;">
                    <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span class="status-pill progress" style="font-size:10.5px; padding:3px 10px; font-weight:900; background:${group.is_task_bound ? '#047857' : '#64748b'}; color:#fff; border-radius:12px; letter-spacing:0.5px;">
                                <i class="fa-solid ${iconTag}" style="margin-right:4px;"></i> ${badgeLabel}
                            </span>
                            <span style="font-size:14px; font-weight:800; color:#0f172a;">${group.title}</span>
                            ${group.is_task_bound ? `<span class="priority-pill ${prioClass}" style="font-size:10.5px; font-weight:800;">${group.task_priority}</span>` : ''}
                        </div>
                        <div style="display:flex; align-items:center; gap:10px;">
                            ${group.is_task_bound ? `
                                <button onclick="window.playProcessRecording('${group.session_start_unix}', '${group.session_end_unix}', 'Task Session', '${group.computer_id}', '${cleanGroupTitle}', '${formattedSessStart}', '${formattedSessEnd}', 'Session Window')" style="background:linear-gradient(135deg, #047857, #065f46); color:white; border:none; padding:6px 12px; border-radius:8px; font-weight:800; font-size:12px; cursor:pointer; display:inline-flex; align-items:center; gap:6px; box-shadow:0 2px 6px rgba(4,120,87,0.35);" onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='none'">
                                    <i class="fa-solid fa-circle-play"></i> Play Task Session Video (${startShort} → ${endShort})
                                </button>
                            ` : ''}
                            <span style="font-size:12px; font-weight:800; color:${group.is_task_bound ? '#047857' : '#64748b'}; background:rgba(255,255,255,0.7); padding:4px 10px; border-radius:8px; border:1px solid rgba(0,0,0,0.05);">
                                <i class="fa-solid fa-link" style="margin-right:4px;"></i> ${group.rows.length} Linked ${group.rows.length === 1 ? 'Activity' : 'Activities'}
                            </span>
                        </div>
                    </div>
                </td>
            </tr>
        `;

        group.rows.forEach(row => {
            const catClass = row.category === "Productive" ? "productive" : (row.category === "Unproductive" ? "unproductive" : "neutral");
            let iconClass = "fa-window-maximize";
            if (row.process.includes("code") || row.process.includes("vs")) iconClass = "fa-code";
            else if (row.process.includes("chrome") || row.process.includes("google") || row.process.includes("drive")) iconClass = "fa-globe";
            else if (row.process.includes("pdf")) iconClass = "fa-file-pdf";
            else if (row.process.includes("explorer")) iconClass = "fa-folder-open";
            else if (row.process.includes("postman")) iconClass = "fa-paper-plane";
            else if (row.process.includes("cmd") || row.process.includes("terminal")) iconClass = "fa-terminal";
            else if (row.process.includes("slack")) iconClass = "fa-comments";
            else if (row.process.includes("outlook")) iconClass = "fa-envelope";

            const startTime = formatLogDateTime(row.start_time || row.time || '—', row.start_unix);
            const endTime = formatLogDateTime(row.end_time || row.time || '—', row.end_unix);
            const durDisplay = formatCompactDuration(row.duration);
            const cleanTitle = (row.app_title || '').replace(/'/g, "\\'");

            html += `
                <tr style="border-bottom:1px solid rgba(0,0,0,0.06); font-size:13px; background:#fff;">
                    <td style="padding:12px 16px; white-space:nowrap; font-weight:700; color:#334155;">${startTime}</td>
                    <td style="padding:12px 16px; white-space:nowrap; font-weight:700; color:#475569;">${endTime}</td>
                    <td style="padding:12px 16px; white-space:nowrap; font-weight:800; color:#047857;">${durDisplay}</td>
                    <td style="padding:12px 16px; font-weight:600; color:#0f172a;">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <i class="fa-solid ${iconClass}" style="color:#64748b; font-size:14px; flex-shrink:0;"></i>
                            <div>
                                <span style="font-weight:800; color:#047857; margin-right:6px;">${row.process}</span>
                                <span style="color:#475569; font-weight:600;">${row.app_title ? '— ' + row.app_title : ''}</span>
                            </div>
                        </div>
                    </td>
                    <td style="padding:12px 16px; white-space:nowrap; text-align:center;">
                        <span class="badge-status ${catClass}" style="font-weight:700;">${row.category}</span>
                    </td>
                    <td style="padding:12px 16px; white-space:nowrap; text-align:center;">
                        <button onclick="window.playProcessRecording('${row.start_unix || 0}', '${row.end_unix || 0}', '${row.process}', '${row.computer_id || ''}', '${cleanTitle}', '${startTime}', '${endTime}', '${durDisplay}')" style="background:linear-gradient(135deg, #047857, #065f46); color:white; border:none; padding:7px 14px; border-radius:8px; font-weight:800; font-size:12px; cursor:pointer; display:inline-flex; align-items:center; gap:6px; box-shadow:0 2px 6px rgba(4,120,87,0.3); transition:all 0.15s ease;" onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='none'">
                            <i class="fa-solid fa-circle-play" style="font-size:12px;"></i> View Recording
                        </button>
                    </td>
                </tr>
            `;
        });
    });

    tbody.innerHTML = html;
}

// ── VIDEO RECORDING PLAYER — STRICTLY 4 TERAMIND APIs, ZERO HARDCODING ────────
window.playProcessRecording = async function(startUnix, endUnix, processName, compId, appTitle, startTimeStr, endTimeStr, durStr) {
    const modal = document.getElementById("emp-video-player-modal");
    if (!modal) return;

    const processTitleEl = document.getElementById("video-process-title");
    const durationBadgeEl = document.getElementById("video-duration-badge");
    const empNameEl = document.getElementById("video-emp-name");
    const appTitleEl = document.getElementById("video-app-title");
    const timeRangeEl = document.getElementById("video-time-range");
    const videoEl = document.getElementById("process-video-element");
    const loadingState = document.getElementById("video-loading-state");
    const messageState = document.getElementById("video-message-state");
    const downloadBtn = document.getElementById("video-download-btn");

    const empName = document.getElementById("emp-log-name")?.innerText || 'Employee';

    if (processTitleEl) processTitleEl.innerText = processName;
    if (durationBadgeEl) durationBadgeEl.innerText = durStr || '—';
    if (empNameEl) empNameEl.innerText = empName;
    if (appTitleEl) appTitleEl.innerText = appTitle || 'Application Activity';
    if (timeRangeEl) timeRangeEl.innerHTML = `<i class="fa-regular fa-clock"></i> ${startTimeStr || startUnix} → ${endTimeStr || endUnix}`;

    modal.classList.add("active");
    modal.style.opacity = "1";
    modal.style.pointerEvents = "auto";

    if (loadingState) loadingState.style.display = "block";
    if (messageState) messageState.style.display = "none";
    if (videoEl) { videoEl.style.display = "none"; videoEl.pause(); }
    if (downloadBtn) downloadBtn.disabled = true;

    let currentPollInterval = null;

    function showVideoMessage(title, desc, iconClass = "fa-video-slash", iconColor = "#f87171", extraHtml = "") {
        const mState = document.getElementById("video-message-state");
        const mTitle = document.getElementById("video-message-title");
        const mDesc = document.getElementById("video-message-desc");
        const mIcon = document.getElementById("video-message-icon");

        if (mTitle) mTitle.innerText = title;
        if (mDesc) mDesc.innerHTML = desc + (extraHtml ? `<div style="margin-top:16px;">${extraHtml}</div>` : '');
        if (mIcon) mIcon.innerHTML = `<i class="fa-solid ${iconClass}" style="color:${iconColor}; font-size:48px;"></i>`;
        if (loadingState) loadingState.style.display = "none";
        if (mState) mState.style.display = "block";
    }

    try {
        const token = localStorage.getItem("token") || "";
        const baseUrl = (typeof API_BASE_URL !== 'undefined') ? API_BASE_URL : '/api/v1';
        
        const statusTextEl = document.getElementById("video-status-text");
        if (statusTextEl) statusTextEl.innerText = "Initiating Teramind Video Export...";

        // ── API 1+2: Backend calls available-video-data + export-video ──
        const res = await fetch(`${baseUrl}/admin/monitoring/process-video?computer_id=${compId}&start=${startUnix}&end=${endUnix}&process=${encodeURIComponent(processName)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.success && data.video_url && data.has_video) {
            const streamProxyUrl = `${baseUrl}/admin/monitoring/video-stream-proxy?export_id=${data.export_id}`;
            let pollAttempts = 0;
            const maxPolls = 120; // Up to 5 minutes max background polling

            if (currentPollInterval) clearInterval(currentPollInterval);

            // Manual check handler for user button
            window.manualCheckVideoStatus = async function(urlToCheck = streamProxyUrl) {
                const btn = document.getElementById("btn-manual-video-check");
                if (btn) btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Checking...`;
                try {
                    const cRes = await fetch(urlToCheck, { headers: { 'Authorization': `Bearer ${token}` } });
                    if (cRes.status === 200) {
                        if (currentPollInterval) clearInterval(currentPollInterval);
                        if (messageState) messageState.style.display = "none";
                        if (loadingState) loadingState.style.display = "none";

                        if (videoEl) {
                            videoEl.src = urlToCheck;
                            videoEl.muted = true;
                            videoEl.style.display = "block";
                            videoEl.play().catch(e => console.warn("Auto-play:", e.message));
                        }
                        if (downloadBtn) {
                            downloadBtn.disabled = false;
                            window.currentProcessVideoUrl = urlToCheck;
                        }
                    } else {
                        if (btn) btn.innerHTML = `<i class="fa-solid fa-arrows-rotate"></i> Still Compiling — Re-check Now`;
                    }
                } catch (e) {
                    if (btn) btn.innerHTML = `<i class="fa-solid fa-arrows-rotate"></i> Re-check Now`;
                }
            };

            // ── API 3+4: Poll backend proxy (status check → binary download) ──
            currentPollInterval = setInterval(async () => {
                pollAttempts++;
                try {
                    const checkRes = await fetch(streamProxyUrl, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    if (checkRes.status === 202) {
                        // Teramind status is 2 (compiling on cloud). Update loading overlay text inline
                        const elapsedSecs = Math.round(pollAttempts * 2.5);
                        const statusTextEl = document.getElementById("video-status-text");
                        if (statusTextEl) {
                            statusTextEl.innerHTML = `Teramind Cloud is compiling screen recording <strong>Export #${data.export_id}</strong> (${elapsedSecs}s)...<br><span style="font-size:12px; color:#10b981; font-weight:700; margin-top:8px; display:inline-block;"><i class="fa-solid fa-spinner fa-spin"></i> Checking status automatically in background...</span>`;
                        }
                    } else if (checkRes.ok) {
                        // MP4 binary ready!
                        if (currentPollInterval) clearInterval(currentPollInterval);
                        if (messageState) messageState.style.display = "none";
                        if (loadingState) loadingState.style.display = "none";

                        if (videoEl) {
                            videoEl.src = streamProxyUrl;
                            videoEl.muted = true;
                            videoEl.style.display = "block";
                            videoEl.onloadedmetadata = () => {
                                if (videoEl.duration && !isNaN(videoEl.duration) && isFinite(videoEl.duration)) {
                                    const totalSecs = Math.floor(videoEl.duration);
                                    if (durationBadgeEl) durationBadgeEl.innerText = formatCompactDuration(totalSecs);
                                }
                            };
                            videoEl.play().catch(e => console.warn("Auto-play:", e.message));
                        }
                        if (downloadBtn) {
                            downloadBtn.disabled = false;
                            window.currentProcessVideoUrl = streamProxyUrl;
                        }
                    } else {
                        if (currentPollInterval) clearInterval(currentPollInterval);
                        if (loadingState) loadingState.style.display = "none";
                        showVideoMessage("Screen Recording Unavailable", `Teramind video stream could not be compiled for '${processName}'.`, "fa-video-slash", "#f87171");
                    }

                    if (pollAttempts >= maxPolls) {
                        if (currentPollInterval) clearInterval(currentPollInterval);
                        if (loadingState) loadingState.style.display = "none";
                        showVideoMessage("Render Timeout", "Teramind cloud video rendering timed out. Please try again.", "fa-clock", "#f59e0b");
                    }
                } catch (pollErr) {
                    console.warn("Proxy poll error:", pollErr.message);
                }
            }, 2500);

        } else {
            if (loadingState) loadingState.style.display = "none";
            if (data.error_type === 'rate_limit') {
                showVideoMessage("Teramind Rate Limited", data.message || "Too many video export requests. Please wait 5 minutes and try again.", "fa-hourglass-half", "#f59e0b");
            } else {
                showVideoMessage("Screen Recording Unavailable", data.message || `No screen video recording captured by Teramind for '${processName}' during this activity timeframe.`, "fa-video-slash", "#f87171");
            }
        }
    } catch (e) {
        console.error("Error loading process video:", e);
        if (loadingState) loadingState.style.display = "none";
        if (videoEl) { videoEl.style.display = "none"; videoEl.pause(); }
        showVideoMessage("Network Error", "Unable to connect to Teramind API player. Please check network connectivity.", "fa-circle-exclamation", "#f87171");
    }
};

window.closeProcessVideoModal = function() {
    if (window.currentPollInterval) {
        clearInterval(window.currentPollInterval);
        window.currentPollInterval = null;
    }
    const modal = document.getElementById("emp-video-player-modal");
    const videoEl = document.getElementById("process-video-element");
    const loadingState = document.getElementById("video-loading-state");
    const messageState = document.getElementById("video-message-state");

    if (videoEl) { videoEl.pause(); videoEl.src = ""; videoEl.style.display = "none"; }
    if (loadingState) loadingState.style.display = "none";
    if (messageState) messageState.style.display = "none";
    if (modal) {
        modal.classList.remove("active");
        modal.style.opacity = "0";
        modal.style.pointerEvents = "none";
    }
};

window.downloadProcessVideo = function() {
    if (window.currentProcessVideoUrl) {
        window.open(window.currentProcessVideoUrl, '_blank');
    }
};

// Live Search & Time Filter inside Employee Logs Modal
document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("emp-log-search");
    const timeFilter = document.getElementById("emp-log-time-filter");

    function applyModalFilters() {
        if (!window.currentEmpLogsData) return;
        const query = searchInput?.value.toLowerCase().trim() || "";
        const timeVal = timeFilter?.value || "today";

        let filtered = [...window.currentEmpLogsData];

        // Time-based filtering using actual timestamps
        if (timeVal !== "today") {
            const now = Date.now();
            let cutoff;
            if (timeVal === "1hr") {
                cutoff = now - (1 * 60 * 60 * 1000);
            } else if (timeVal === "4hr") {
                cutoff = now - (4 * 60 * 60 * 1000);
            } else if (timeVal === "yesterday") {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                yesterday.setHours(0, 0, 0, 0);
                const yesterdayEnd = new Date(yesterday);
                yesterdayEnd.setHours(23, 59, 59, 999);
                filtered = filtered.filter(r => {
                    const ts = (r.start_unix || 0) * 1000;
                    return ts >= yesterday.getTime() && ts <= yesterdayEnd.getTime();
                });
                cutoff = null; // Already filtered
            }
            if (cutoff) {
                filtered = filtered.filter(r => {
                    const ts = (r.start_unix || 0) * 1000;
                    return ts >= cutoff;
                });
            }
        }

        if (query) {
            filtered = filtered.filter(r => 
                r.process.toLowerCase().includes(query) ||
                r.app_title.toLowerCase().includes(query) ||
                r.category.toLowerCase().includes(query)
            );
        }

        renderEmpLogsTable(filtered);
    }

    if (searchInput) searchInput.addEventListener("input", applyModalFilters);
    if (timeFilter) timeFilter.addEventListener("change", applyModalFilters);

    // Backdrop click listener to close modal
    const empModal = document.getElementById("emp-logs-modal");
    if (empModal) {
        empModal.addEventListener("click", (e) => {
            if (e.target === empModal) {
                window.closeEmployeeLogsModal();
            }
        });
    }
});

async function loadAppsAnalytics() {
    try {
        const range = document.getElementById("date-range-select")?.value || "Today";
        const res = await fetch(`/api/v1/admin/monitoring/analytics/apps?range=${range}`);
        const json = await res.json();

        const barsContainer = document.getElementById("apps-bars-container");
        const tableBody = document.getElementById("apps-detail-tbody");

        if (json.success && Array.isArray(json.data)) {
            if (json.data.length === 0) {
                if (barsContainer) barsContainer.innerHTML = `<div style="text-align:center; padding:24px; color:var(--text-muted); font-size:13px;"><i class="fa-solid fa-cube" style="font-size:20px; margin-bottom:8px; display:block; opacity:0.4;"></i>No application usage data for this period.</div>`;
                if (tableBody) tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-muted);">No data</td></tr>`;
                return;
            }

            if (barsContainer) {
                barsContainer.innerHTML = json.data.map(app => {
                    const fillClass = app.category === 'Productive' ? '' : (app.category === 'Neutral' ? 'neutral' : 'unproductive');
                    return `
                        <div class="usage-bar-row">
                            <div class="usage-bar-meta">
                                <span><i class="fa-solid fa-cube"></i> ${app.name}</span>
                                <span>${(app.duration / 3600).toFixed(1)} hrs (${app.usage_pct}%)</span>
                            </div>
                            <div class="usage-bar-track">
                                <div class="usage-bar-fill ${fillClass}" style="width:${app.usage_pct}%;"></div>
                            </div>
                        </div>
                    `;
                }).join("");
            }

            if (tableBody) {
                tableBody.innerHTML = json.data.map(app => `
                    <tr style="border-bottom:1px solid rgba(0,0,0,0.04); font-size:12.5px;">
                        <td style="padding:8px; font-weight:700;">${app.name}</td>
                        <td style="padding:8px;"><span class="badge-status ${app.category.toLowerCase()}">${app.category}</span></td>
                        <td style="padding:8px;">${(app.duration / 3600).toFixed(1)} hrs</td>
                        <td style="padding:8px; font-weight:700;">${app.usage_pct}%</td>
                    </tr>
                `).join("");
            }
        }
    } catch (e) {
        console.error("Error loading apps analytics:", e);
    }
}

async function loadWebAnalytics() {
    try {
        const range = document.getElementById("date-range-select")?.value || "Today";
        const res = await fetch(`/api/v1/admin/monitoring/analytics/websites?range=${range}`);
        const json = await res.json();

        const barsContainer = document.getElementById("web-bars-container");
        const tableBody = document.getElementById("web-detail-tbody");

        if (json.success && Array.isArray(json.data)) {
            if (json.data.length === 0) {
                if (barsContainer) barsContainer.innerHTML = `<div style="text-align:center; padding:24px; color:var(--text-muted); font-size:13px;"><i class="fa-solid fa-globe" style="font-size:20px; margin-bottom:8px; display:block; opacity:0.4;"></i>No website usage data for this period.</div>`;
                if (tableBody) tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-muted);">No data</td></tr>`;
                return;
            }

            if (barsContainer) {
                barsContainer.innerHTML = json.data.map(site => {
                    const fillClass = site.category === 'Productive' ? '' : (site.category === 'Neutral' ? 'neutral' : 'unproductive');
                    const pct = Math.min(100, Math.round((site.duration / 7200) * 100));
                    return `
                        <div class="usage-bar-row">
                            <div class="usage-bar-meta">
                                <span><i class="fa-solid fa-globe"></i> ${site.domain}</span>
                                <span>${(site.duration / 3600).toFixed(1)} hrs (${site.visits} visits)</span>
                            </div>
                            <div class="usage-bar-track">
                                <div class="usage-bar-fill ${fillClass}" style="width:${pct}%;"></div>
                            </div>
                        </div>
                    `;
                }).join("");
            }

            if (tableBody) {
                tableBody.innerHTML = json.data.map(site => `
                    <tr style="border-bottom:1px solid rgba(0,0,0,0.04); font-size:12.5px;">
                        <td style="padding:8px; font-weight:700; color:#2563eb;">${site.domain}</td>
                        <td style="padding:8px;"><span class="badge-status ${site.category.toLowerCase()}">${site.category}</span></td>
                        <td style="padding:8px;">${site.visits}</td>
                        <td style="padding:8px; font-weight:700;">${(site.duration / 3600).toFixed(1)} hrs</td>
                    </tr>
                `).join("");
            }
        }
    } catch (e) {
        console.error("Error loading web analytics:", e);
    }
}

async function loadAlertsData() {
    try {
        const res = await fetch("/api/v1/admin/monitoring/analytics/alerts");
        const json = await res.json();
        const tbody = document.getElementById("alerts-detail-tbody");

        if (json.success && Array.isArray(json.data) && tbody) {
            tbody.innerHTML = json.data.map(alt => {
                const sevClass = alt.severity === 'High' ? 'offline' : (alt.severity === 'Medium' ? 'neutral' : 'online');
                return `
                    <tr style="border-bottom:1px solid rgba(0,0,0,0.04); font-size:12.5px;">
                        <td style="padding:10px; font-weight:800; color:var(--teal-900);">${alt.alert_id}</td>
                        <td style="padding:10px;">
                            <div style="font-weight:700;">${alt.full_name || 'System User'}</div>
                            <span style="font-size:11px; color:var(--text-muted);">${alt.computer_name || '—'}</span>
                        </td>
                        <td style="padding:10px;"><span class="badge-status ${sevClass}">${alt.severity}</span></td>
                        <td style="padding:10px; font-weight:700;">${alt.title}</td>
                        <td style="padding:10px; color:var(--text-muted);">${alt.description}</td>
                        <td style="padding:10px;">${new Date(alt.triggered_at).toLocaleString()}</td>
                    </tr>
                `;
            }).join("");
        }
    } catch (e) {
        console.error("Error loading alerts data:", e);
    }
}

async function loadTeramindConfig() {
    try {
        const res = await fetch("/api/v1/admin/monitoring/config");
        const json = await res.json();
        if (json.success && json.data) {
            const cfg = json.data;
            if (document.getElementById("cfg-url")) document.getElementById("cfg-url").value = cfg.instance_url || "";
            if (document.getElementById("cfg-interval")) document.getElementById("cfg-interval").value = cfg.sync_interval_minutes || 5;
            if (document.getElementById("cfg-input-rate")) document.getElementById("cfg-input-rate").checked = !!cfg.enable_input_rate;
        }
    } catch (e) {
        console.error("Error loading config:", e);
    }
}

// ── WORKSTATION MANUAL ASSIGNMENT MODAL & LOGIC ─────────────────────────────
window.openAssignModal = async function(e, empId, empName, currentCompId) {
    if (e && e.stopPropagation) e.stopPropagation();
    if (e && e.preventDefault) e.preventDefault();

    // Support both signatures: openAssignModal(event, empId, empName, currentCompId) and openAssignModal(empId, empName, currentCompId)
    if (typeof e === 'number' || (typeof e === 'string' && !isNaN(e))) {
        currentCompId = empName;
        empName = empId;
        empId = e;
    }

    const modal = document.getElementById("assign-ws-modal");
    const empIdInput = document.getElementById("assign-emp-id");
    const empNameEl = document.getElementById("assign-emp-name");
    const selectEl = document.getElementById("assign-computer-select");

    if (!modal || !selectEl) return;

    empIdInput.value = empId;
    empNameEl.innerText = empName;
    selectEl.innerHTML = '<option value="" disabled selected>Loading available computers...</option>';
    
    modal.classList.add("active");
    modal.style.display = "flex";
    modal.style.opacity = "1";
    modal.style.pointerEvents = "auto";

    try {
        const res = await fetch("/api/v1/admin/monitoring/available-workstations");
        const json = await res.json();

        if (json.success && Array.isArray(json.data)) {
            let optionsHtml = '<option value="unassign">❌ Unassign (No Workstation Assigned)</option>';
            
            json.data.forEach(c => {
                const isCurrent = currentCompId && currentCompId == c.computer_id;
                const statusDot = c.is_online ? '🟢' : '🔴';
                const userLabel = c.user_name ? ` (User: ${c.user_name})` : '';
                const alreadyAssigned = (c.currently_assigned_to && c.currently_assigned_to != empId)
                    ? ` — [Currently with ${c.assigned_employee_name}]`
                    : '';

                optionsHtml += `
                    <option value="${c.computer_id}" data-name="${c.computer_name}" ${isCurrent ? 'selected' : ''}>
                        ${statusDot} ${c.computer_name}${userLabel}${alreadyAssigned}
                    </option>
                `;
            });

            selectEl.innerHTML = optionsHtml;

            // If employee had no computer mapped, select unassign by default
            if (!currentCompId) {
                selectEl.value = 'unassign';
            }
        } else {
            selectEl.innerHTML = '<option value="unassign">❌ Unassign (No Workstation Assigned)</option>';
        }
    } catch (e) {
        console.error("Error fetching available workstations:", e);
        selectEl.innerHTML = '<option value="unassign">❌ Unassign (No Workstation Assigned)</option>';
    }
};

window.closeAssignModal = function() {
    const modal = document.getElementById("assign-ws-modal");
    if (modal) {
        modal.classList.remove("active");
        modal.style.display = "none";
        modal.style.opacity = "0";
        modal.style.pointerEvents = "none";
    }
};

window.saveWorkstationAssignment = async function(event) {
    event.preventDefault();
    const btn = document.getElementById("btn-save-assign");
    const empId = document.getElementById("assign-emp-id").value;
    const selectEl = document.getElementById("assign-computer-select");
    const selectedOption = selectEl.options[selectEl.selectedIndex];
    const selectedCompId = selectEl.value;
    const selectedCompName = selectedOption ? selectedOption.getAttribute("data-name") : "";

    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

    try {
        const payload = {
            employee_id: empId,
            computer_id: selectedCompId === 'unassign' ? null : selectedCompId,
            computer_name: selectedCompId === 'unassign' ? null : selectedCompName
        };

        const res = await fetch("/api/v1/admin/monitoring/assign-workstation", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const json = await res.json();

        if (json.success) {
            window.closeAssignModal();
            if (typeof window.showToast === 'function') {
                window.showToast(json.message || "Workstation assigned successfully!", "success");
            } else {
                alert(json.message || "Workstation assigned successfully!");
            }
            await loadWorkstationsData();
            await loadHealthCards();
        } else {
            alert(json.message || "Failed to assign workstation.");
        }
    } catch (e) {
        console.error("Error saving workstation assignment:", e);
        alert("Failed to save assignment: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
};
