document.addEventListener('DOMContentLoaded', () => {
    // Modals
    const createTicketModal = document.getElementById('create-ticket-modal');
    const btnOpenCreateTicket = document.getElementById('btn-open-create-ticket');
    const createTicketClose = document.getElementById('create-ticket-close');
    const createTicketCancel = document.getElementById('create-ticket-cancel');
    const createTicketForm = document.getElementById('create-ticket-form');

    const ticketWorkspaceModal = document.getElementById('ticket-workspace-modal');
    const ticketWorkspaceClose = document.getElementById('ticket-workspace-close');

    // Controls
    const ticketSearch = document.getElementById('ticket-search');
    const filterCustomer = document.getElementById('filter-customer');
    const filterEmployee = document.getElementById('filter-employee');
    const filterCategory = document.getElementById('filter-category');
    const filterPriority = document.getElementById('filter-priority');
    const filterStatus = document.getElementById('filter-status');
    const filterFromDate = document.getElementById('filter-from-date');
    const filterToDate = document.getElementById('filter-to-date');
    const btnClearDates = document.getElementById('btn-clear-dates');
    const btnRefreshTickets = document.getElementById('btn-refresh-tickets');
    const ticketsList = document.getElementById('tickets-list');
    const logoutBtn = document.getElementById('logout-btn');

    // File Upload Controls
    const btnUploadTicketFile = document.getElementById('btn-upload-ticket-file');
    const inputTicketFile = document.getElementById('ticket-file-input');
    const ticketFileName = document.getElementById('ticket-file-name');
    const ticketFileUrl = document.getElementById('ticket-file-url');

    // Workspace Controls
    const workspaceStatusSelect = document.getElementById('workspace-status-select');
    const btnConvertTask = document.getElementById('btn-convert-task');
    const btnConvertWorkflow = document.getElementById('btn-convert-workflow');
    const metaAssigneeSelect = document.getElementById('meta-assignee-select');
    const btnPostComment = document.getElementById('btn-post-comment');
    const newCommentText = document.getElementById('new-comment-text');
    const chkInternalNote = document.getElementById('chk-internal-note');

    let currentActiveTicketId = null;
    let customersCache = [];
    let projectsCache = [];
    let employeesCache = [];

    // Helper: Escaping quotes
    const esc = (str) => (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');

    // Helper: Ticket Transfer Trail Formatter
    // Helper: Format Duration in human-readable string (Xh Ym or Z min or S s)
    function formatDurationMs(ms) {
        if (!ms || ms < 1000) return '0 min';
        const totalSec = Math.round(ms / 1000);
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        if (h > 0 && m > 0) return `${h}h ${m}m`;
        if (h > 0) return `${h}h`;
        if (m > 0) return `${m} min`;
        return `${s}s`;
    }

    // Helper: Compute exact time spent by each employee on ticket with 100% total duration match
    function calculateEmployeeTimeBreakdown(ticket) {
        let list = ticket.transfer_history;
        if (typeof list === 'string') {
            try { list = JSON.parse(list); } catch (e) { list = []; }
        }
        if (!Array.isArray(list)) list = [];

        const isDone = ticket.status === 'Resolved' || ticket.status === 'Closed';

        // 1. Authoritative Resolution/End Time: perfectly sync with timeline audit stream event if present
        let endTimeRaw = isDone ? (ticket.resolved_at || ticket.updated_at) : new Date().toISOString();
        if (isDone && ticket.history && Array.isArray(ticket.history) && ticket.history.length > 0) {
            const resEvent = ticket.history.find(h => {
                const act = (h.action || '').toLowerCase();
                const det = (h.details || '').toLowerCase();
                const st = (h.new_status || '').toLowerCase();
                return st === 'resolved' || st === 'closed' || act.includes('resolv') || act.includes('close') || det.includes('resolved') || det.includes('closed');
            });
            if (resEvent && resEvent.created_at) {
                endTimeRaw = resEvent.created_at;
            }
        }

        const endMs = endTimeRaw ? new Date(endTimeRaw).getTime() : Date.now();

        // 2. Authoritative Resolution Start Time: perfectly sync with first In Progress timeline event if present
        let startTimeRaw = ticket.started_resolving_at || ticket.created_at;
        if (ticket.history && Array.isArray(ticket.history) && ticket.history.length > 0) {
            const progEvent = [...ticket.history].reverse().find(h => {
                const act = (h.action || '').toLowerCase();
                const det = (h.details || '').toLowerCase();
                const st = (h.new_status || '').toLowerCase();
                return st === 'in progress' || det.includes('in progress') || act.includes('progress');
            });
            if (progEvent && progEvent.created_at) {
                startTimeRaw = progEvent.created_at;
            }
        }

        let startMs = startTimeRaw ? new Date(startTimeRaw).getTime() : endMs;
        if (isNaN(startMs) || startMs > endMs) {
            if (ticket.history && Array.isArray(ticket.history) && ticket.history.length > 0) {
                const earliest = ticket.history[ticket.history.length - 1];
                if (earliest && earliest.created_at) {
                    startMs = new Date(earliest.created_at).getTime();
                }
            }
            if (isNaN(startMs) || startMs > endMs) {
                startMs = endMs;
            }
        }

        // If ticket is Open/Assigned and never started resolving, actual work time is 0
        if (!ticket.started_resolving_at && (ticket.status === 'Open' || ticket.status === 'Assigned')) {
            return {
                totalMs: 0,
                totalFormatted: '0 min',
                isStarted: false,
                breakdown: [{
                    name: ticket.assigned_to_name || 'Assigned Staff',
                    timeMs: 0,
                    formatted: '0 min',
                    percent: 100
                }]
            };
        }

        const totalMs = Math.max(1000, endMs - startMs);

        // If no transfers, 100% of the duration belongs to the assigned staff
        if (list.length === 0) {
            const empName = ticket.assigned_to_name || ticket.reported_by || 'Assigned Staff';
            return {
                totalMs,
                totalFormatted: formatDurationMs(totalMs),
                isStarted: true,
                breakdown: [{
                    name: empName,
                    timeMs: totalMs,
                    formatted: formatDurationMs(totalMs),
                    percent: 100
                }]
            };
        }

        // Multi-employee transfer chain
        const empChain = [];
        empChain.push(list[0].from_name || 'Initial Assignee');
        for (const tr of list) {
            const toName = tr.to_name || 'Staff';
            if (empChain[empChain.length - 1] !== toName) {
                empChain.push(toName);
            }
        }

        let segments = [];
        let prevMs = startMs;
        let allValid = true;

        for (let i = 0; i < list.length; i++) {
            const trMs = new Date(list[i].transferred_at).getTime();
            const diff = trMs - prevMs;
            if (isNaN(trMs) || diff < 0 || trMs > endMs) {
                allValid = false;
                break;
            }
            segments.push({
                name: list[i].from_name || empChain[i] || 'Staff',
                timeMs: diff
            });
            prevMs = trMs;
        }

        if (allValid) {
            const finalDiff = Math.max(0, endMs - prevMs);
            const finalName = list[list.length - 1].to_name || ticket.assigned_to_name || 'Final Assignee';
            segments.push({
                name: finalName,
                timeMs: finalDiff
            });
        }

        // If timestamps were invalid/mocked (e.g. seeded with future dates), apportion totalMs proportionally
        if (!allValid || segments.length === 0) {
            segments = [];
            const count = empChain.length;
            const eachMs = Math.floor(totalMs / count);
            let rem = totalMs - (eachMs * count);

            empChain.forEach((name, idx) => {
                const segMs = eachMs + (idx === count - 1 ? rem : 0);
                segments.push({
                    name,
                    timeMs: segMs
                });
            });
        }

        // Aggregate by employee name
        const empMap = new Map();
        for (const seg of segments) {
            const current = empMap.get(seg.name) || 0;
            empMap.set(seg.name, current + seg.timeMs);
        }

        let sumMs = 0;
        const breakdown = [];
        for (const [name, ms] of empMap.entries()) {
            sumMs += ms;
            const pct = totalMs > 0 ? Math.round((ms / totalMs) * 100) : 0;
            breakdown.push({
                name,
                timeMs: ms,
                formatted: formatDurationMs(ms),
                percent: pct
            });
        }

        // Normalize percentage sum to 100%
        const pctSum = breakdown.reduce((acc, b) => acc + b.percent, 0);
        if (pctSum !== 100 && breakdown.length > 0) {
            breakdown[breakdown.length - 1].percent += (100 - pctSum);
        }

        return {
            totalMs,
            totalFormatted: formatDurationMs(totalMs),
            isStarted: true,
            breakdown
        };
    }

    function formatTicketTransferTrail(transferHistory, options = {}) {
        let list = transferHistory;
        if (typeof list === 'string') {
            try { list = JSON.parse(list); } catch (e) { list = []; }
        }
        if (!Array.isArray(list) || list.length === 0) return '';

        const tb = options.ticket ? calculateEmployeeTimeBreakdown(options.ticket) : null;
        const empTimeMap = {};
        if (tb && Array.isArray(tb.breakdown)) {
            tb.breakdown.forEach(b => {
                empTimeMap[b.name.toLowerCase()] = b.formatted;
            });
        }

        const chainNodes = [];
        const tooltipParts = [];

        list.forEach((item, idx) => {
            const fromFullName = item.from_name || 'Staff';
            const toFullName = item.to_name || 'Staff';
            const fromShort = options.fullName ? fromFullName : (item.from_name ? item.from_name.trim().split(' ')[0] : 'Staff');
            const toShort = options.fullName ? toFullName : (item.to_name ? item.to_name.trim().split(' ')[0] : 'Staff');

            const fromTime = empTimeMap[fromFullName.toLowerCase()] ? ` (${empTimeMap[fromFullName.toLowerCase()]})` : '';
            const toTime = (idx === list.length - 1 && empTimeMap[toFullName.toLowerCase()]) ? ` (${empTimeMap[toFullName.toLowerCase()]})` : '';

            if (idx === 0) {
                chainNodes.push(fromShort + fromTime);
            } else if (chainNodes[chainNodes.length - 1] && !chainNodes[chainNodes.length - 1].startsWith(fromShort)) {
                chainNodes.push(fromShort + fromTime);
            }
            chainNodes.push(toShort + toTime);

            const timeStr = item.transferred_at ? new Date(item.transferred_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
            const reasonStr = item.reason ? `[${item.reason}]` : '';
            const spentStr = item.time_spent_formatted ? `• Spent: ${item.time_spent_formatted}` : '';
            tooltipParts.push(`Transfer #${idx + 1}: ${fromFullName} ➔ ${toFullName} ${reasonStr} ${spentStr} ${timeStr ? '(' + timeStr + ')' : ''}`);
        });

        const chainHtml = chainNodes.join(` <i class="fa-solid fa-arrow-right" style="font-size:${options.arrowSize || '8px'}; color:#6366f1; opacity:0.85; margin:0 2px;"></i> `);
        const tooltipText = tooltipParts.join('\n');

        if (options.layout === 'details') {
            let detailsHtml = `
                <div style="display:flex; flex-direction:column; gap:6px;">
                    <div style="font-size:12px; font-weight:700; color:#4338ca; display:flex; align-items:center; gap:5px;">
                        <i class="fa-solid fa-shuffle"></i> <span>${chainHtml}</span>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:5px; border-left:2px solid #a5b4fc; padding-left:8px; margin-left:2px;">
            `;
            list.forEach((item, idx) => {
                const timeStr = item.transferred_at ? new Date(item.transferred_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
                const spentBadge = item.time_spent_formatted ? `<span style="background:rgba(13,148,136,0.12); color:#0f766e; font-weight:800; font-size:10.5px; padding:1px 6px; border-radius:4px; margin-left:4px;"><i class="fa-regular fa-clock"></i> Spent: ${item.time_spent_formatted}</span>` : '';
                detailsHtml += `
                    <div style="font-size:11.5px; color:#475569; line-height:1.4;">
                        <span style="font-weight:700; color:#1e293b;">${item.from_name || 'Staff'}</span>
                        <i class="fa-solid fa-arrow-right" style="font-size:8.5px; color:#6366f1; margin:0 3px;"></i>
                        <span style="font-weight:700; color:#0f766e;">${item.to_name || 'Staff'}</span>
                        ${spentBadge}
                        ${item.reason ? `<span style="background:rgba(99,102,241,0.12); color:#4338ca; font-weight:700; font-size:10.5px; padding:1px 5px; border-radius:4px; margin-left:4px;">${item.reason}</span>` : ''}
                        ${timeStr ? `<span style="color:#94a3b8; font-size:10.5px; margin-left:4px;"><i class="fa-regular fa-calendar"></i> ${timeStr}</span>` : ''}
                        ${item.notes ? `<div style="font-size:11px; color:#64748b; font-style:italic; margin-top:2px;">Note: "${item.notes}"</div>` : ''}
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

    // Helper: Priority Badge
    const getPriorityBadge = (priority) => {
        const pri = (priority || 'Medium').toLowerCase();
        if (pri === 'critical') return '<span class="badge badge-critical"><i class="fa-solid fa-fire"></i> Critical</span>';
        if (pri === 'high') return '<span class="badge badge-high"><i class="fa-solid fa-angles-up"></i> High</span>';
        if (pri === 'medium') return '<span class="badge badge-medium"><i class="fa-solid fa-angle-up"></i> Medium</span>';
        return '<span class="badge badge-low"><i class="fa-solid fa-minus"></i> Low</span>';
    };

    // Helper: Status Badge
    const getStatusBadge = (status) => {
        const st = status || 'Open';
        if (st === 'Open') return '<span class="badge" style="background:rgba(245,158,11,0.15); color:#d97706; border:1px solid rgba(245,158,11,0.3); font-weight:700;"><i class="fa-solid fa-circle-dot"></i> Open</span>';
        if (st === 'Assigned') return '<span class="badge" style="background:rgba(14,165,233,0.15); color:#0284c7; border:1px solid rgba(14,165,233,0.3); font-weight:700;"><i class="fa-solid fa-user-check"></i> Assigned</span>';
        if (st === 'In Progress') return '<span class="badge" style="background:rgba(168,85,247,0.15); color:#9333ea; border:1px solid rgba(168,85,247,0.3); font-weight:700;"><i class="fa-solid fa-gears"></i> In Progress</span>';
        if (st === 'Waiting Customer') return '<span class="badge" style="background:rgba(234,179,8,0.15); color:#ca8a04; border:1px solid rgba(234,179,8,0.3); font-weight:700;"><i class="fa-solid fa-user-clock"></i> Waiting Customer</span>';
        if (st === 'Resolved') return '<span class="badge" style="background:rgba(34,197,94,0.15); color:#16a34a; border:1px solid rgba(34,197,94,0.3); font-weight:700;"><i class="fa-solid fa-circle-check"></i> Resolved</span>';
        return '<span class="badge" style="background:rgba(100,116,139,0.15); color:#475569; border:1px solid rgba(100,116,139,0.3); font-weight:700;"><i class="fa-solid fa-lock"></i> Closed</span>';
    };

    // Helper: Compute SLA & Elapsed Live Timer display
    const getSlaTimerHtml = (ticket) => {
        const tb = calculateEmployeeTimeBreakdown(ticket);

        if (ticket.status === 'Resolved' || ticket.status === 'Closed') {
            let resDateStr = '';
            let resTimeRaw = ticket.resolved_at;
            if (ticket.history && Array.isArray(ticket.history) && ticket.history.length > 0) {
                const resEvent = ticket.history.find(h => {
                    const act = (h.action || '').toLowerCase();
                    const det = (h.details || '').toLowerCase();
                    const st = (h.new_status || '').toLowerCase();
                    return st === 'resolved' || st === 'closed' || act.includes('resolv') || act.includes('close') || det.includes('resolved') || det.includes('closed');
                });
                if (resEvent && resEvent.created_at) {
                    resTimeRaw = resEvent.created_at;
                }
            }
            if (!resTimeRaw) resTimeRaw = ticket.updated_at;

            if (resTimeRaw) {
                const resD = new Date(resTimeRaw);
                resDateStr = resD.toLocaleDateString('en-US', { day: '2-digit', month: 'short' }) + ', ' +
                    resD.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
            }

            let breakdownBadges = '';
            if (tb.breakdown && tb.breakdown.length > 1) {
                breakdownBadges = `
                    <div style="font-size:10.5px; color:#4338ca; font-weight:700; margin-top:3px; display:flex; flex-wrap:wrap; gap:3px;">
                        ${tb.breakdown.map(b => `<span style="background:rgba(99,102,241,0.08); border:1px solid rgba(99,102,241,0.2); padding:1px 5px; border-radius:4px;" title="${b.name}: ${b.formatted} (${b.percent}%)">${b.name.trim().split(' ')[0]}: ${b.formatted}</span>`).join('')}
                    </div>
                `;
            }

            return `<div style="font-size:12px; line-height:1.4;">
                <span style="color:#16a34a; font-weight:700; display:flex; align-items:center; gap:4px;">
                    <i class="fa-solid fa-circle-check"></i> Resolved (${tb.totalFormatted})
                </span>
                ${resDateStr ? `<span style="font-size:11px; color:#475569; font-weight:600; display:block; margin-top:2px;"><i class="fa-regular fa-calendar-check" style="color:#16a34a;"></i> ${resDateStr}</span>` : ''}
                ${breakdownBadges}
            </div>`;
        }

        const createdDate = ticket.created_at ? new Date(ticket.created_at) : new Date();
        const createdTimeStr = createdDate.toLocaleDateString('en-US', { day: '2-digit', month: 'short' }) + ', ' +
            createdDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

        // BEFORE START: Do not run active timer! Show Ready to Start
        if (ticket.status !== 'In Progress' && !ticket.started_resolving_at) {
            return `<div class="live-ticket-timer" data-started="" data-created="${ticket.created_at || ''}" data-status="${ticket.status}" style="font-size:12px; line-height:1.35;">
                <div style="font-weight:700; color:#64748b; display:flex; align-items:center; gap:5px;">
                    <span class="badge" style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1; font-weight:700; font-size:11px; padding:2px 7px; border-radius:6px; display:inline-flex; align-items:center; gap:4px;">
                        <i class="fa-regular fa-clock" style="color:#64748b;"></i> Ready to Start
                    </span>
                    <span style="font-size:11.5px; font-weight:700; color:#64748b;">00:00:00</span>
                </div>
                <div style="font-size:11px; color:var(--text-muted); font-weight:500; margin-top:2px;">
                    <i class="fa-regular fa-calendar"></i> Logged: ${createdTimeStr}
                </div>
            </div>`;
        }

        // IN PROGRESS: Resolution timer is actively ticking
        const startMs = new Date(ticket.started_resolving_at || ticket.created_at).getTime();
        const elapsedMs = Math.max(0, Date.now() - (isNaN(startMs) ? Date.now() : startMs));
        const eH = String(Math.floor(elapsedMs / 3600000)).padStart(2, '0');
        const eM = String(Math.floor((elapsedMs % 3600000) / 60000)).padStart(2, '0');
        const eS = String(Math.floor((elapsedMs % 60000) / 1000)).padStart(2, '0');

        return `<div class="live-ticket-timer" data-started="${ticket.started_resolving_at || ticket.created_at || ''}" data-created="${ticket.created_at || ''}" data-status="${ticket.status}" style="font-size:12px; line-height:1.35;">
            <div style="font-weight:700; color:#2563eb; display:flex; align-items:center; gap:4px;">
                <i class="fa-solid fa-stopwatch fa-spin" style="--fa-animation-duration: 3s; color:#2563eb;"></i>
                <span class="live-timer-text">${eH}:${eM}:${eS}</span>
                <span style="font-size:11px; font-weight:700; color:#2563eb;">active</span>
            </div>
            <div style="font-size:11px; color:var(--text-muted); font-weight:500; margin-top:2px;">
                <i class="fa-regular fa-clock"></i> Logged: ${createdTimeStr}
            </div>
        </div>`;
    };

    // Helper to dynamically render project options based on chosen Customer Account
    const renderProjectOptions = (selectEl, customerId, selectedProjectId = '', selectedProjectName = '') => {
        if (!selectEl) return;
        selectEl.innerHTML = '<option value="">None / General Maintenance</option>';

        let availableProjects = [];
        if (customerId) {
            const cust = customersCache.find(c => String(c.id) === String(customerId));
            if (cust) {
                // 1. From branches projects (e.g. Dahisar -> PentaRMC, Miraroad -> Pentarmc)
                let branches = cust.branches;
                if (typeof branches === 'string') {
                    try { branches = JSON.parse(branches); } catch (e) { branches = []; }
                }
                if (Array.isArray(branches)) {
                    branches.forEach((b, bIdx) => {
                        const bName = b.branch || `Branch ${bIdx + 1}`;
                        let bProjs = b.projects;
                        if (typeof bProjs === 'string') {
                            try { bProjs = JSON.parse(bProjs); } catch (e) { bProjs = []; }
                        }
                        if (Array.isArray(bProjs)) {
                            bProjs.forEach(p => {
                                const pName = typeof p === 'string' ? p : (p.name || p.project_name || 'Module');
                                if (pName && !availableProjects.some(x => x.name.toLowerCase() === pName.toLowerCase() && x.branch_name === bName)) {
                                    // Match exact project from projectsCache (by customer_id and branch or name)
                                    const matchingProj = projectsCache.find(mp =>
                                        String(mp.customer_id) === String(customerId) &&
                                        ((mp.branch_name && mp.branch_name.toLowerCase() === bName.toLowerCase()) || mp.name.toLowerCase() === pName.toLowerCase())
                                    );
                                    availableProjects.push({
                                        id: matchingProj ? matchingProj.id : (p.id || `branch_${bIdx}_${pName}`),
                                        name: pName,
                                        branch_name: bName,
                                        assignedEmployees: b.assignedEmployees || []
                                    });
                                }
                            });
                        }
                    });
                }
                // 2. From cust.projects array
                let custProjs = cust.projects;
                if (typeof custProjs === 'string') {
                    try { custProjs = JSON.parse(custProjs); } catch (e) { custProjs = []; }
                }
                if (Array.isArray(custProjs)) {
                    custProjs.forEach(p => {
                        const pName = typeof p === 'string' ? p : (p.name || p.project_name);
                        if (pName && !availableProjects.some(x => x.name.toLowerCase() === pName.toLowerCase())) {
                            const matchingProj = projectsCache.find(mp => String(mp.customer_id) === String(customerId) && mp.name.toLowerCase() === pName.toLowerCase());
                            availableProjects.push({
                                id: matchingProj ? matchingProj.id : (p.id || `cust_${pName}`),
                                name: pName,
                                branch_name: ''
                            });
                        }
                    });
                }
                // 3. From customer_projects if any
                let custDirectProjs = cust.customer_projects;
                if (typeof custDirectProjs === 'string') {
                    try { custDirectProjs = JSON.parse(custDirectProjs); } catch (e) { custDirectProjs = []; }
                }
                if (Array.isArray(custDirectProjs)) {
                    custDirectProjs.forEach(p => {
                        const pName = p.name || p.project_name;
                        if (pName && !availableProjects.some(x => (String(x.id) === String(p.id) || x.name.toLowerCase() === pName.toLowerCase()))) {
                            availableProjects.push({
                                id: p.id,
                                name: pName,
                                branch_name: p.branch_name || ''
                            });
                        }
                    });
                }
                // 4. From global projectsCache matching customer_id
                const dbProjs = projectsCache.filter(p => String(p.customer_id) === String(customerId));
                dbProjs.forEach(p => {
                    if (!availableProjects.some(x => String(x.id) === String(p.id) || (x.name.toLowerCase() === (p.name || '').toLowerCase() && x.branch_name === (p.branch_name || '')))) {
                        availableProjects.push({
                            id: p.id,
                            name: p.name,
                            branch_name: p.branch_name || ''
                        });
                    }
                });
            }
        } else {
            availableProjects = projectsCache;
        }

        if (availableProjects.length > 0) {
            availableProjects.forEach((p, idx) => {
                const pName = p.name || p.project_name || 'Project';
                const branchInfo = p.branch_name ? ` (${p.branch_name} Branch)` : '';
                const opt = document.createElement('option');
                opt.value = p.id || pName;
                opt.setAttribute('data-project-name', pName);
                opt.setAttribute('data-branch-name', p.branch_name || '');
                opt.textContent = `${pName}${branchInfo}`;
                if (selectedProjectId && String(p.id) === String(selectedProjectId)) {
                    opt.selected = true;
                } else if (selectedProjectName && pName.toLowerCase() === selectedProjectName.toLowerCase()) {
                    opt.selected = true;
                }
                selectEl.appendChild(opt);
            });

            // If no project explicitly preselected and creating new ticket, automatically select the first project!
            if (!selectedProjectId && !selectedProjectName && availableProjects.length > 0 && customerId) {
                selectEl.value = availableProjects[0].id || availableProjects[0].name;
            }
        }
    };

    // Auto-select assignee staff based on Customer / Project assignment
    const autoSelectAssignee = (customerId, assigneeSelectId, chosenProjectId = null) => {
        if (!customerId) return;
        const selectEl = document.getElementById(assigneeSelectId);
        if (!selectEl) return;
        const cust = customersCache.find(c => String(c.id) === String(customerId));
        if (!cust) return;

        let assignedEmps = [];

        // Check if project has specific assigned employees
        let branches = cust.branches;
        if (typeof branches === 'string') {
            try { branches = JSON.parse(branches); } catch (e) { branches = []; }
        }
        if (Array.isArray(branches)) {
            for (const b of branches) {
                const bProjs = Array.isArray(b.projects) ? b.projects : [];
                const matchesProj = chosenProjectId ? bProjs.some(p => String(p.id) === String(chosenProjectId) || (p.name && p.name.toLowerCase().includes(String(chosenProjectId).toLowerCase()))) : false;
                if (matchesProj && Array.isArray(b.assignedEmployees) && b.assignedEmployees.length > 0) {
                    assignedEmps = b.assignedEmployees;
                    break;
                } else if (!assignedEmps.length && Array.isArray(b.assignedEmployees) && b.assignedEmployees.length > 0) {
                    assignedEmps = b.assignedEmployees;
                }
            }
        }

        if (assignedEmps.length === 0 && Array.isArray(cust.assigned_employees) && cust.assigned_employees.length > 0) {
            assignedEmps = cust.assigned_employees;
        }

        if (assignedEmps.length > 0) {
            const firstId = assignedEmps[0].id || assignedEmps[0];
            if (firstId) {
                selectEl.value = firstId;
            }
        }
    };

    // Auto-fill reported by contact person when customer is selected
    const autoFillContact = (customerId, inputId) => {
        if (!customerId) return;
        const inputEl = document.getElementById(inputId);
        if (!inputEl) return;
        const cust = customersCache.find(c => String(c.id) === String(customerId));
        if (!cust) return;

        let contactStr = '';
        let contactPersons = cust.contact_persons;
        if (typeof contactPersons === 'string') {
            try { contactPersons = JSON.parse(contactPersons); } catch (e) { contactPersons = []; }
        }
        if (Array.isArray(contactPersons) && contactPersons.length > 0) {
            const cp = contactPersons[0];
            contactStr = cp.name ? `${cp.name}${cp.email ? ' (' + cp.email + ')' : (cp.phone ? ' (' + cp.phone + ')' : '')}` : '';
        } else {
            let branches = cust.branches;
            if (typeof branches === 'string') {
                try { branches = JSON.parse(branches); } catch (e) { branches = []; }
            }
            if (Array.isArray(branches)) {
                for (const b of branches) {
                    if (b.contacts && Array.isArray(b.contacts) && b.contacts.length > 0) {
                        const cp = b.contacts[0];
                        contactStr = cp.name ? `${cp.name}${cp.email ? ' (' + cp.email + ')' : (cp.phone ? ' (' + cp.phone + ')' : '')}` : '';
                        break;
                    }
                }
            }
        }

        if (contactStr) {
            inputEl.value = contactStr;
        }
    };

    // Populate Initial Dropdowns (Customers, Projects, Employees)
    const loadDropdownData = async () => {
        try {
            const [custRes, projRes, empRes] = await Promise.all([
                fetch('/api/v1/admin/customers'),
                fetch('/api/v1/admin/projects'),
                fetch('/api/v1/admin/employees')
            ]);

            const custData = await custRes.json();
            const projData = await projRes.json();
            const empData = await empRes.json();

            customersCache = custData.success ? (custData.data || []) : [];
            projectsCache = projData.success ? (Array.isArray(projData.data) ? projData.data : (projData.data?.projects || [])) : [];
            employeesCache = empData.success ? (Array.isArray(empData.data) ? empData.data : (empData.data?.employees || empData.data || [])) : [];

            // Populate Customer Filter & Modal Selects
            const ticketCustSelect = document.getElementById('ticket-customer');
            const editCustSelect = document.getElementById('edit-ticket-customer');
            if (filterCustomer && filterCustomer.tagName === 'SELECT') filterCustomer.innerHTML = '<option value="all">All Customers</option>';
            if (ticketCustSelect) ticketCustSelect.innerHTML = '<option value="">Select Customer...</option>';
            if (editCustSelect) editCustSelect.innerHTML = '<option value="">Select Customer...</option>';

            customersCache.forEach(c => {
                const cName = c.company_name || c.name || 'Customer';
                const opt = `<option value="${c.id}">${cName}</option>`;
                if (filterCustomer && filterCustomer.tagName === 'SELECT') filterCustomer.innerHTML += opt;
                if (ticketCustSelect) ticketCustSelect.innerHTML += opt;
                if (editCustSelect) editCustSelect.innerHTML += opt;
            });

            // Populate Multi-Select Customer Checkboxes
            populateCustomerCheckboxes(customersCache);

            // Initial population of Project Modal Selects
            const ticketProjSelect = document.getElementById('ticket-project');
            const editProjSelect = document.getElementById('edit-ticket-project');
            renderProjectOptions(ticketProjSelect, '');
            renderProjectOptions(editProjSelect, '');

            // Global Handler for Create Modal Customer change
            window.handleCustomerSelectChange = (chosenCustId) => {
                const projEl = document.getElementById('ticket-project');
                renderProjectOptions(projEl, chosenCustId);
                autoFillContact(chosenCustId, 'ticket-reported-by');
                const selectedProjVal = projEl ? projEl.value : null;
                autoSelectAssignee(chosenCustId, 'ticket-assignee', selectedProjVal);
            };

            // Global Handler for Edit Modal Customer change
            window.handleEditCustomerSelectChange = (chosenCustId) => {
                const projEl = document.getElementById('edit-ticket-project');
                renderProjectOptions(projEl, chosenCustId);
                const selectedProjVal = projEl ? projEl.value : null;
                autoSelectAssignee(chosenCustId, 'edit-ticket-assignee', selectedProjVal);
            };

            // Global Handler for Project change -> auto-select engineer
            window.handleProjectSelectChange = (projId, assigneeSelectId = 'ticket-assignee', custSelectId = 'ticket-customer') => {
                const custEl = document.getElementById(custSelectId);
                const custId = custEl ? custEl.value : null;
                if (custId) {
                    autoSelectAssignee(custId, assigneeSelectId, projId);
                }
            };

            // Attach dynamic change & input listeners for Customer -> Projects in Create Modal
            if (ticketCustSelect) {
                ticketCustSelect.addEventListener('change', (e) => window.handleCustomerSelectChange(e.target.value));
                ticketCustSelect.addEventListener('input', (e) => window.handleCustomerSelectChange(e.target.value));
            }

            // Attach dynamic change & input listeners for Customer -> Projects in Edit Modal
            if (editCustSelect) {
                editCustSelect.addEventListener('change', (e) => window.handleEditCustomerSelectChange(e.target.value));
                editCustSelect.addEventListener('input', (e) => window.handleEditCustomerSelectChange(e.target.value));
            }

            // Attach project select change listeners
            if (ticketProjSelect) {
                ticketProjSelect.addEventListener('change', (e) => window.handleProjectSelectChange(e.target.value, 'ticket-assignee', 'ticket-customer'));
            }
            if (editProjSelect) {
                editProjSelect.addEventListener('change', (e) => window.handleProjectSelectChange(e.target.value, 'edit-ticket-assignee', 'edit-ticket-customer'));
            }

            // Populate Staff Modal, Filter & Workspace Selects
            const ticketAssigneeSelect = document.getElementById('ticket-assignee');
            const editAssigneeSelect = document.getElementById('edit-ticket-assignee');
            if (filterEmployee && filterEmployee.tagName === 'SELECT') filterEmployee.innerHTML = '<option value="all">All Employees</option>';
            if (ticketAssigneeSelect) ticketAssigneeSelect.innerHTML = '<option value="">Unassigned</option>';
            if (editAssigneeSelect) editAssigneeSelect.innerHTML = '<option value="">Unassigned</option>';
            if (metaAssigneeSelect) metaAssigneeSelect.innerHTML = '<option value="">Unassigned</option>';

            employeesCache.forEach(e => {
                const opt = `<option value="${e.id}">${e.full_name} (${e.role || 'Staff'})</option>`;
                if (filterEmployee && filterEmployee.tagName === 'SELECT') filterEmployee.innerHTML += `<option value="${e.id}">${e.full_name}</option>`;
                if (ticketAssigneeSelect) ticketAssigneeSelect.innerHTML += opt;
                if (editAssigneeSelect) editAssigneeSelect.innerHTML += opt;
                if (metaAssigneeSelect) metaAssigneeSelect.innerHTML += opt;
            });

            // Populate Multi-Select Employee Checkboxes
            populateEmployeeCheckboxes(employeesCache);
        } catch (err) {
            console.error("Error loading dropdown data:", err);
        }

    };

    // Load & Render Tickets Table
    const loadTickets = async () => {
        const search = ticketSearch ? ticketSearch.value.trim() : '';
        const customer = filterCustomer ? filterCustomer.value : 'all';
        const employee = filterEmployee ? filterEmployee.value : 'all';
        const category = filterCategory ? filterCategory.value : 'all';
        const priority = filterPriority ? filterPriority.value : 'all';
        const status = filterStatus ? filterStatus.value : 'all';
        const fromDate = filterFromDate ? filterFromDate.value : '';
        const toDate = filterToDate ? filterToDate.value : '';

        try {
            const queryParams = new URLSearchParams({
                search,
                customer_id: customer,
                employee_id: employee,
                category,
                priority,
                status,
                from_date: fromDate,
                to_date: toDate
            });

            const res = await fetch(`/api/v1/support?${queryParams.toString()}`);
            const data = await res.json();

            if (!data.success) {
                if (typeof showToast === 'function') showToast("Failed to fetch tickets", "error");
                return;
            }

            // Update Metrics Cards (Safely with null checks)
            const m = data.metrics || {};
            const elTotal = document.getElementById('metric-total-tickets');
            const elOpen = document.getElementById('metric-open-tickets');
            const elWaiting = document.getElementById('metric-waiting-customer');
            const elSla = document.getElementById('metric-sla-breaches');
            const elResolved = document.getElementById('metric-resolved-today');

            if (elTotal) elTotal.textContent = m.total || 0;
            if (elOpen) elOpen.textContent = m.active_open || 0;
            if (elWaiting) elWaiting.textContent = m.waiting_customer || 0;
            if (elSla) elSla.textContent = m.sla_breaches || 0;
            if (elResolved) elResolved.textContent = m.resolved_today || 0;

            // Render Rows
            if (!data.data || data.data.length === 0) {
                ticketsList.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align:center; padding:30px; color:var(--text-muted);">
                            <i class="fa-solid fa-folder-open" style="font-size:24px; color:var(--text-muted); margin-bottom:8px;"></i><br>
                            No support tickets found matching current filters.
                        </td>
                    </tr>
                `;
                return;
            }

            let html = '';
            data.data.forEach(t => {
                const createdDate = new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                const customerName = t.customer_name || 'Customer';
                const projName = t.project_name ? `<span style="font-size:11px; color:var(--text-muted); display:block;"><i class="fa-solid fa-diagram-project"></i> ${t.project_name}</span>` : '';
                const transferTrailBadge = formatTicketTransferTrail(t.transfer_history, { ticket: t });
                const assigneeColHtml = `
                    <div style="display:flex; flex-direction:column; gap:3px; align-items:flex-start;">
                        ${t.assigned_to_name 
                            ? `<span style="font-weight:700; font-size:12.5px; color:#1e293b; display:inline-flex; align-items:center; gap:4px;">
                                 <i class="fa-solid fa-user-gear" style="color:#0d9488; font-size:11px;"></i> ${t.assigned_to_name}
                               </span>`
                            : `<span style="color:var(--text-muted); font-size:12px; font-weight:500;">Unassigned</span>`
                        }
                        ${transferTrailBadge}
                    </div>
                `;

                const attList = Array.isArray(t.attachments) ? t.attachments : (t.attachments ? [t.attachments] : []);
                const attBadge = attList.length > 0 ? `<span class="badge" style="background:rgba(14,165,233,0.12); color:#0284c7; font-size:10.5px; border:1px solid rgba(14,165,233,0.25); margin-left:4px;"><i class="fa-solid fa-paperclip"></i> ${attList.length} attachment${attList.length > 1 ? 's' : ''}</span>` : '';
                const sourceBadge = t.source === 'Email' ? `<span class="badge" style="background:rgba(234,88,12,0.12); color:#ea580c; font-size:10.5px; border:1px solid rgba(234,88,12,0.3); margin-left:4px;"><i class="fa-solid fa-envelope"></i> Email</span>` : '';

                const totalChunks = parseInt(t.total_subtasks || 0, 10);
                const doneChunks = parseInt(t.completed_subtasks || 0, 10);
                let chunkBadge = '';
                if (totalChunks > 0) {
                    const isAllDone = totalChunks === doneChunks;
                    const badgeBg = isAllDone ? 'rgba(34,197,94,0.15)' : 'rgba(99,102,241,0.15)';
                    const badgeColor = isAllDone ? '#16a34a' : '#4f46e5';
                    const badgeBorder = isAllDone ? 'rgba(34,197,94,0.3)' : 'rgba(99,102,241,0.3)';
                    chunkBadge = `<span class="badge" style="background:${badgeBg}; color:${badgeColor}; font-size:10.5px; border:1px solid ${badgeBorder}; margin-left:4px; font-weight:700;"><i class="fa-solid fa-layer-group"></i> ${doneChunks}/${totalChunks} Chunks</span>`;
                }
                let statusActionBtn = '';
                if (t.status === 'Open' || t.status === 'Assigned') {
                    statusActionBtn = `
                        <button type="button" class="support-tbl-btn tbl-btn-start" onclick="window.startResolvingTicket(${t.id})" title="Start Resolving Ticket">
                            <i class="fa-solid fa-play"></i> Start
                        </button>
                    `;
                } else if (t.status === 'In Progress') {
                    statusActionBtn = `
                        <button type="button" class="support-tbl-btn tbl-btn-resolve" onclick="window.quickResolveTicket(${t.id})" title="Mark Ticket as Resolved">
                            <i class="fa-solid fa-circle-check"></i> Resolve
                        </button>
                    `;
                } else if (t.status === 'Resolved' || t.status === 'Closed') {
                    statusActionBtn = `
                        <button type="button" class="support-tbl-btn tbl-btn-reopen" onclick="window.reopenTicket(${t.id})" title="Reopen Support Ticket">
                            <i class="fa-solid fa-rotate-left"></i> Reopen
                        </button>
                    `;
                }

                html += `
                    <tr>
                        <td style="white-space:nowrap;">
                            <strong style="color:var(--teal-700); font-weight:800; font-size:13px;">${t.ticket_code}</strong>
                            <div style="font-size:11px; color:var(--text-muted);">${createdDate}</div>
                        </td>
                        <td>
                            <strong style="color:var(--teal-950); font-size:13px;">${customerName}</strong>
                            ${projName}
                        </td>
                        <td>
                            <div style="font-weight:700; color:var(--teal-950); font-size:13px; margin-bottom:3px; max-width:240px; word-break:break-word;">${t.title}</div>
                            <span class="badge" style="background:rgba(6,182,212,0.12); color:#0891b2; font-size:10.5px; border:1px solid rgba(6,182,212,0.25);">${t.category || 'Bug'}</span>
                            ${sourceBadge}
                            ${attBadge}
                            ${chunkBadge}
                        </td>
                        <td>
                            <div style="margin-bottom:4px;">${getPriorityBadge(t.priority)}</div>
                            <div>${getSlaTimerHtml(t)}</div>
                        </td>
                        <td>${getStatusBadge(t.status)}</td>
                        <td>${assigneeColHtml}</td>
                        <td style="white-space:nowrap; text-align:right;">
                            <div style="display:inline-flex; gap:4px; align-items:center; justify-content:flex-end;">
                                <button type="button" class="support-tbl-btn tbl-btn-open" onclick="window.openTicketWorkspace(${t.id})" title="Open Ticket Workspace">
                                    <i class="fa-solid fa-folder-open"></i> Open
                                </button>
                                <button type="button" class="support-tbl-btn tbl-btn-transfer" onclick="window.openTransferTicketModal(${t.id})" title="Transfer / Handover Ticket">
                                    <i class="fa-solid fa-share-nodes"></i> Transfer
                                </button>
                                ${statusActionBtn}
                                <button type="button" class="support-tbl-btn support-tbl-btn-icon tbl-btn-edit" onclick="window.openEditTicketModal(${t.id})" title="Edit Support Ticket">
                                    <i class="fa-solid fa-pen-to-square"></i>
                                </button>
                                <button type="button" class="support-tbl-btn support-tbl-btn-icon tbl-btn-delete" onclick="window.deleteSupportTicket(${t.id}, '${t.ticket_code}')" title="Delete Ticket">
                                    <i class="fa-solid fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;

            });

            ticketsList.innerHTML = html;
        } catch (err) {
            console.error("Error loading tickets:", err);
            ticketsList.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:#ef4444;">Error loading tickets</td></tr>';
        }
    };

    // Single Ticket Delete Handler
    window.deleteSupportTicket = async function(id, code) {
        if (!confirm(`Are you sure you want to permanently delete ticket ${code}? This will remove all associated comments, subtasks, and files.`)) {
            return;
        }
        try {
            const res = await fetch(`/api/v1/support/${id}`, { method: 'DELETE' });
            const json = await res.json();
            if (res.ok && json.success) {
                if (typeof showToast === 'function') showToast(`Ticket ${code} deleted successfully`, "success");
                else alert(`Ticket ${code} deleted successfully`);
                loadTickets();
            } else {
                alert(json.message || "Failed to delete ticket");
            }
        } catch (e) {
            console.error("Error deleting ticket:", e);
            alert("Network error deleting ticket");
        }
    };

    // Bulk Purge Inbound Email Tickets Handler
    window.purgeAllEmailTickets = async function() {
        if (!confirm("Are you sure you want to PURGE & DELETE all auto-created Inbound Email tickets from the database?")) {
            return;
        }
        try {
            const res = await fetch('/api/v1/support/bulk-delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ onlyEmailInbound: true })
            });
            const json = await res.json();
            if (res.ok && json.success) {
                if (typeof showToast === 'function') showToast(json.message, "success");
                else alert(json.message);
                loadTickets();
            } else {
                alert(json.message || "Failed to purge email tickets");
            }
        } catch (e) {
            console.error("Error purging email tickets:", e);
            alert("Network error deleting tickets");
        }
    };

    // =========================================================================
    // UNIVERSAL MULTI-SELECT DROPDOWN SYSTEM
    // =========================================================================
    const multiSelectInstances = {};

    function initMultiSelectDropdown({
        containerId,
        btnId,
        labelId,
        menuId,
        chevronId,
        checkboxClass,
        selectAllId,
        clearAllId,
        hiddenInputId,
        defaultText,
        iconHtml,
        onChange
    }) {
        const container = document.getElementById(containerId);
        const btn = document.getElementById(btnId);
        const label = document.getElementById(labelId);
        const menu = document.getElementById(menuId);
        const chevron = document.getElementById(chevronId);
        const hiddenInput = document.getElementById(hiddenInputId);
        const selectAllBtn = document.getElementById(selectAllId);
        const clearAllBtn = document.getElementById(clearAllId);

        if (!container || !btn || !menu) return null;

        const updateState = () => {
            const checkboxes = Array.from(container.querySelectorAll(`.${checkboxClass}`));
            const checked = Array.from(container.querySelectorAll(`.${checkboxClass}:checked`)).map(cb => {
                const textSpan = cb.closest('label')?.querySelector('span:not([style*="border-radius:50%"])') || cb.closest('label');
                const labelText = (textSpan ? textSpan.textContent.trim() : cb.value) || cb.value;
                return { value: cb.value, label: labelText };
            });
            const total = checkboxes.length;

            if (checked.length === 0 || checked.length === total) {
                if (hiddenInput) hiddenInput.value = 'all';
                if (label) label.innerHTML = `${iconHtml} ${defaultText}`;
            } else if (checked.length === 1) {
                if (hiddenInput) hiddenInput.value = checked[0].value;
                if (label) label.innerHTML = `<i class="fa-solid fa-check" style="color:#0F766E;"></i> ${checked[0].label}`;
            } else if (checked.length === 2) {
                if (hiddenInput) hiddenInput.value = checked.map(c => c.value).join(',');
                if (label) label.innerHTML = `<i class="fa-solid fa-check-double" style="color:#0F766E;"></i> ${checked.map(c => c.label).join(', ')}`;
            } else {
                if (hiddenInput) hiddenInput.value = checked.map(c => c.value).join(',');
                if (label) label.innerHTML = `<span class="badge" style="background:rgba(15,118,110,0.15); color:#0F766E; font-size:11px; padding:2px 7px; border-radius:6px; font-weight:800;">${checked.length} Selected</span>`;
            }
        };

        // Open/Close toggle (and close any other open multi-selects)
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = menu.style.display === 'block';

            // Close all custom multi-select menus first
            document.querySelectorAll('.custom-multiselect-menu').forEach(m => m.style.display = 'none');
            document.querySelectorAll('.custom-multiselect-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.custom-multiselect-container i.fa-chevron-down').forEach(ch => ch.style.transform = 'none');

            if (!isOpen) {
                menu.style.display = 'block';
                btn.classList.add('active');
                if (chevron) chevron.style.transform = 'rotate(180deg)';
            }
        });

        // Delegate checkbox changes
        menu.addEventListener('change', (e) => {
            if (e.target.classList.contains(checkboxClass)) {
                updateState();
                if (typeof onChange === 'function') onChange();
            }
        });

        // Select All
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                container.querySelectorAll(`.${checkboxClass}`).forEach(cb => cb.checked = true);
                updateState();
                if (typeof onChange === 'function') onChange();
            });
        }

        // Clear All
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                container.querySelectorAll(`.${checkboxClass}`).forEach(cb => cb.checked = false);
                updateState();
                if (typeof onChange === 'function') onChange();
            });
        }

        return { updateState };
    }

    // Global Click Handler to close any open multi-select dropdown menu
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.custom-multiselect-container')) {
            document.querySelectorAll('.custom-multiselect-menu').forEach(m => m.style.display = 'none');
            document.querySelectorAll('.custom-multiselect-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.custom-multiselect-container i.fa-chevron-down').forEach(ch => ch.style.transform = 'none');
        }
    });

    // Populate Dynamic Customer Checkboxes in Dropdown Menu
    function populateCustomerCheckboxes(customers) {
        const listEl = document.getElementById('customer-checkboxes-list');
        if (!listEl) return;
        if (!customers || customers.length === 0) {
            listEl.innerHTML = '<span style="color:#94a3b8; font-size:12px; padding:6px;">No customers found</span>';
            return;
        }
        let html = '';
        customers.forEach(c => {
            const cName = c.company_name || c.name || 'Customer';
            html += `
                <label class="multiselect-item customer-item-label" style="display:flex; align-items:center; gap:10px; padding:7px 9px; border-radius:8px; cursor:pointer; font-size:13.5px; font-weight:600; color:#334155; user-select:none;">
                  <input type="checkbox" class="customer-checkbox" value="${c.id}" style="width:16px; height:16px; accent-color:#0F766E; cursor:pointer;">
                  <span class="cust-name-text">${cName}</span>
                </label>
            `;
        });
        listEl.innerHTML = html;

        // Quick filter search inside customer menu
        const searchInput = document.getElementById('search-customer-filter');
        if (searchInput) {
            searchInput.oninput = (e) => {
                const term = e.target.value.toLowerCase();
                listEl.querySelectorAll('.customer-item-label').forEach(item => {
                    const text = item.textContent.toLowerCase();
                    item.style.display = text.includes(term) ? 'flex' : 'none';
                });
            };
        }

        if (multiSelectInstances.customer) multiSelectInstances.customer.updateState();
    }

    // Populate Dynamic Employee Checkboxes in Dropdown Menu
    function populateEmployeeCheckboxes(employees) {
        const listEl = document.getElementById('employee-checkboxes-list');
        if (!listEl) return;
        if (!employees || employees.length === 0) {
            listEl.innerHTML = '<span style="color:#94a3b8; font-size:12px; padding:6px;">No employees found</span>';
            return;
        }
        let html = '';
        employees.forEach(emp => {
            html += `
                <label class="multiselect-item employee-item-label" style="display:flex; align-items:center; gap:10px; padding:7px 9px; border-radius:8px; cursor:pointer; font-size:13.5px; font-weight:600; color:#334155; user-select:none;">
                  <input type="checkbox" class="employee-checkbox" value="${emp.id}" style="width:16px; height:16px; accent-color:#0F766E; cursor:pointer;">
                  <span class="emp-name-text">${emp.full_name}</span>
                </label>
            `;
        });
        listEl.innerHTML = html;

        // Quick filter search inside employee menu
        const searchInput = document.getElementById('search-employee-filter');
        if (searchInput) {
            searchInput.oninput = (e) => {
                const term = e.target.value.toLowerCase();
                listEl.querySelectorAll('.employee-item-label').forEach(item => {
                    const text = item.textContent.toLowerCase();
                    item.style.display = text.includes(term) ? 'flex' : 'none';
                });
            };
        }

        if (multiSelectInstances.employee) multiSelectInstances.employee.updateState();
    }

    // Initialize all 5 multi-select instances
    multiSelectInstances.customer = initMultiSelectDropdown({
        containerId: 'customer-multiselect-container',
        btnId: 'filter-customer-btn',
        labelId: 'filter-customer-label',
        menuId: 'filter-customer-menu',
        chevronId: 'filter-customer-chevron',
        checkboxClass: 'customer-checkbox',
        selectAllId: 'btn-customer-select-all',
        clearAllId: 'btn-customer-clear-all',
        hiddenInputId: 'filter-customer',
        defaultText: 'All Customers',
        iconHtml: '<i class="fa-solid fa-building" style="color:#0F766E;"></i>',
        onChange: loadTickets
    });

    multiSelectInstances.employee = initMultiSelectDropdown({
        containerId: 'employee-multiselect-container',
        btnId: 'filter-employee-btn',
        labelId: 'filter-employee-label',
        menuId: 'filter-employee-menu',
        chevronId: 'filter-employee-chevron',
        checkboxClass: 'employee-checkbox',
        selectAllId: 'btn-employee-select-all',
        clearAllId: 'btn-employee-clear-all',
        hiddenInputId: 'filter-employee',
        defaultText: 'All Employees',
        iconHtml: '<i class="fa-solid fa-user-gear" style="color:#0F766E;"></i>',
        onChange: loadTickets
    });

    multiSelectInstances.category = initMultiSelectDropdown({
        containerId: 'category-multiselect-container',
        btnId: 'filter-category-btn',
        labelId: 'filter-category-label',
        menuId: 'filter-category-menu',
        chevronId: 'filter-category-chevron',
        checkboxClass: 'category-checkbox',
        selectAllId: 'btn-category-select-all',
        clearAllId: 'btn-category-clear-all',
        hiddenInputId: 'filter-category',
        defaultText: 'All Categories',
        iconHtml: '<i class="fa-solid fa-tags" style="color:#0F766E;"></i>',
        onChange: loadTickets
    });

    multiSelectInstances.priority = initMultiSelectDropdown({
        containerId: 'priority-multiselect-container',
        btnId: 'filter-priority-btn',
        labelId: 'filter-priority-label',
        menuId: 'filter-priority-menu',
        chevronId: 'filter-priority-chevron',
        checkboxClass: 'priority-checkbox',
        selectAllId: 'btn-priority-select-all',
        clearAllId: 'btn-priority-clear-all',
        hiddenInputId: 'filter-priority',
        defaultText: 'All Priorities',
        iconHtml: '<i class="fa-solid fa-layer-group" style="color:#0F766E;"></i>',
        onChange: loadTickets
    });

    multiSelectInstances.status = initMultiSelectDropdown({
        containerId: 'status-multiselect-container',
        btnId: 'filter-status-btn',
        labelId: 'filter-status-label',
        menuId: 'filter-status-menu',
        chevronId: 'filter-status-chevron',
        checkboxClass: 'status-checkbox',
        selectAllId: 'btn-status-select-all',
        clearAllId: 'btn-status-clear-all',
        hiddenInputId: 'filter-status',
        defaultText: 'All Statuses',
        iconHtml: '<i class="fa-solid fa-list-check" style="color:#0F766E;"></i>',
        onChange: loadTickets
    });

    // Wire Search & Date Filter Listeners
    if (ticketSearch) ticketSearch.addEventListener('input', loadTickets);
    if (filterFromDate) filterFromDate.addEventListener('change', loadTickets);
    if (filterToDate) filterToDate.addEventListener('change', loadTickets);
    if (btnClearDates) btnClearDates.addEventListener('click', () => {
        if (filterFromDate) filterFromDate.value = '';
        if (filterToDate) filterToDate.value = '';
        loadTickets();
    });
    if (btnRefreshTickets) btnRefreshTickets.addEventListener('click', loadTickets);

    // Modal 1: Create Ticket Modal Handlers
    const closeCreateModal = () => {
        if (typeof window.closeModal === 'function') window.closeModal(createTicketModal);
        else if (createTicketModal) createTicketModal.classList.remove('active');
        if (createTicketForm) createTicketForm.reset();
        if (ticketFileName) ticketFileName.textContent = 'No file attached';
        if (ticketFileUrl) ticketFileUrl.value = '';
    };

    if (btnOpenCreateTicket) btnOpenCreateTicket.addEventListener('click', () => {
        const ticketCust = document.getElementById('ticket-customer');
        const ticketProj = document.getElementById('ticket-project');
        if (ticketCust) ticketCust.value = '';
        if (ticketProj) renderProjectOptions(ticketProj, '');
        if (typeof window.openModal === 'function') window.openModal(createTicketModal);
        else if (createTicketModal) createTicketModal.classList.add('active');
    });
    if (createTicketClose) createTicketClose.addEventListener('click', closeCreateModal);
    if (createTicketCancel) createTicketCancel.addEventListener('click', closeCreateModal);

    // Ticket File Upload Handler
    if (btnUploadTicketFile && inputTicketFile) {
        btnUploadTicketFile.addEventListener('click', () => inputTicketFile.click());

        inputTicketFile.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append('attachment', file);

            try {
                const res = await fetch('/api/v1/support/upload-attachment', {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    if (ticketFileUrl) ticketFileUrl.value = data.attachmentUrl;
                    if (ticketFileName) ticketFileName.innerHTML = `<a href="${data.attachmentUrl}" target="_blank" style="color:var(--teal-600); font-weight:700;"><i class="fa-solid fa-paperclip"></i> ${data.attachmentName}</a>`;
                    if (typeof showToast === 'function') showToast("File attached successfully!");
                } else {
                    alert(data.message || "Failed to upload attachment");
                }
            } catch (err) {
                console.error("File upload error:", err);
                alert("Error uploading file attachment");
            }
        });
    }

    // Submit Create Ticket Form
    if (createTicketForm) {
        createTicketForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const projSelect = document.getElementById('ticket-project');
            const selectedOption = projSelect ? projSelect.options[projSelect.selectedIndex] : null;
            const projectName = selectedOption ? (selectedOption.getAttribute('data-project-name') || selectedOption.textContent) : null;
            const isNumericId = projSelect && /^\d+$/.test(projSelect.value);

            const payload = {
                customer_id: parseInt(document.getElementById('ticket-customer').value, 10),
                project_id: isNumericId ? parseInt(projSelect.value, 10) : null,
                project_name: projectName && projectName !== 'None / General Maintenance' ? projectName : null,
                category: document.getElementById('ticket-category').value,
                priority: document.getElementById('ticket-priority').value,
                assigned_to: document.getElementById('ticket-assignee').value ? parseInt(document.getElementById('ticket-assignee').value, 10) : null,
                reported_by: document.getElementById('ticket-reported-by').value.trim() || 'Customer Contact',
                title: document.getElementById('ticket-title').value.trim(),
                description: document.getElementById('ticket-description').value.trim(),
                attachments: ticketFileUrl.value ? [{ url: ticketFileUrl.value, name: ticketFileName.textContent }] : []
            };

            try {
                const res = await fetch('/api/v1/support', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    if (typeof showToast === 'function') showToast(data.message || "Support Ticket created successfully!", "success");
                    closeCreateModal();
                    loadTickets();
                } else {
                    alert(data.message || "Failed to create support ticket");
                }
            } catch (err) {
                console.error("Error creating ticket:", err);
                alert("Error creating support ticket");
            }
        });
    }

    // ============ Ticket Workspace Modal ============
    window.openTicketWorkspace = async (ticketId) => {
        currentActiveTicketId = ticketId;

        try {
            const res = await fetch(`/api/v1/support/${ticketId}`);
            const data = await res.json();

            if (!data.success || !data.data) {
                alert(data.message || "Failed to load ticket details");
                return;
            }

            const t = data.data;

            // Header info & Contact Person extraction
            const codeEl = document.getElementById('view-ticket-code');
            const titleEl = document.getElementById('view-ticket-title');
            const subEl = document.getElementById('view-ticket-sub');
            if (codeEl) codeEl.textContent = t.ticket_code;
            if (titleEl) titleEl.textContent = t.title;

            const cp = t.contact_person || {};
            const contactName = cp.name || t.reported_by || 'Customer Representative';
            const contactPhone = cp.phone || t.customer_phone || '';
            const contactEmail = cp.email || t.customer_email || '';
            const contactBranch = cp.branch || '';
            const contactSource = cp.source || t.source || 'Web';
            const contactRole = cp.designation || 'Client Representative';

            if (subEl) {
                let subHtml = `Reported by <strong style="color:#0f172a;">${contactName}</strong>`;
                if (contactPhone) {
                    subHtml += ` • <i class="fa-solid fa-phone" style="font-size:11px; color:#0d9488;"></i> <a href="tel:${contactPhone}" style="color:#0f172a; text-decoration:none; font-weight:700;">${contactPhone}</a>`;
                }
                if (contactEmail) {
                    subHtml += ` • <i class="fa-solid fa-envelope" style="font-size:11px; color:#0284c7;"></i> <a href="mailto:${contactEmail}" style="color:#0284c7; text-decoration:none; font-weight:700;">${contactEmail}</a>`;
                }
                subHtml += ` on ${new Date(t.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
                subEl.innerHTML = subHtml;
            }

            // Details & Attachments
            const descEl = document.getElementById('view-ticket-description');
            if (descEl) descEl.textContent = t.description || 'No detailed description provided.';

            const attArea = document.getElementById('view-ticket-attachments-area');
            const attList = document.getElementById('view-ticket-attachments-list');
            let atts = [];
            if (t.attachments) {
                try {
                    atts = typeof t.attachments === 'string' ? JSON.parse(t.attachments) : t.attachments;
                } catch (e) {
                    atts = typeof t.attachments === 'string' && t.attachments.trim() ? [t.attachments] : [];
                }
            }
            if (Array.isArray(atts) && atts.length > 0) {
                if (attArea) attArea.style.display = 'block';
                if (attList) {
                    attList.innerHTML = atts.map(att => {
                        let url = '';
                        let name = 'Attachment';
                        let isImage = false;

                        if (typeof att === 'string') {
                            url = att.trim();
                            name = url.split('/').pop() || 'Attachment';
                            isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url);
                        } else if (typeof att === 'object' && att !== null) {
                            url = att.url || (att.mediaId ? `/api/v1/whatsapp/media/${att.mediaId}` : '');
                            name = att.name || att.filename || att.caption || 'Attachment';
                            isImage = att.type === 'image' || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(name) || /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
                        }

                        // Fallback to universal attachment streaming route if url is empty
                        if (!url && name && name !== 'Attachment') {
                            url = `/api/v1/support/attachment/${encodeURIComponent(name)}`;
                        }

                        if (url && url !== '#' && url !== '[object Object]') {
                            if (isImage) {
                                return `
                                    <div style="display:inline-block; margin:6px; background:rgba(255,255,255,0.95); border:1.5px solid #cbd5e1; border-radius:10px; padding:8px; text-align:center; vertical-align:top; box-shadow:0 2px 8px rgba(0,0,0,0.06); max-width:240px;">
                                        <a href="${url}" target="_blank" rel="noopener noreferrer" title="Click to view full image" style="display:block; overflow:hidden; border-radius:6px; background:#f8fafc;">
                                            <img src="${url}" alt="${name}" style="max-width:220px; max-height:160px; border-radius:6px; display:block; margin:0 auto; object-fit:contain;" onerror="this.onerror=null; this.parentElement.innerHTML='<div style=\\'padding:20px; color:#64748b; font-size:12px;\\'><i class=\\'fa-solid fa-image\\' style=\\'font-size:24px; color:#94a3b8; display:block; margin-bottom:4px;\\'></i>${name}</div>';">
                                        </a>
                                        <a href="${url}" target="_blank" rel="noopener noreferrer" style="font-size:12px; font-weight:700; color:var(--teal-700); text-decoration:none; display:inline-flex; align-items:center; gap:4px; margin-top:8px; word-break:break-all;">
                                            <i class="fa-solid fa-arrow-up-right-from-square"></i> ${name}
                                        </a>
                                    </div>
                                `;
                            } else {
                                return `
                                    <a href="${url}" target="_blank" rel="noopener noreferrer" class="badge" style="background:rgba(255,255,255,0.95); border:1.5px solid #cbd5e1; color:var(--teal-800); font-weight:700; padding:8px 14px; margin:4px; font-size:12.5px; text-decoration:none; display:inline-flex; align-items:center; gap:6px; border-radius:8px; box-shadow:0 1px 4px rgba(0,0,0,0.05);">
                                        <i class="fa-solid fa-paperclip" style="color:var(--teal-600); font-size:14px;"></i> ${name}
                                        <i class="fa-solid fa-arrow-up-right-from-square" style="margin-left:4px; font-size:11px; color:var(--text-muted);"></i>
                                    </a>
                                `;
                            }
                        } else {
                            const fallbackUrl = `/api/v1/support/attachment/${encodeURIComponent(name)}`;
                            return `
                                <a href="${fallbackUrl}" target="_blank" rel="noopener noreferrer" class="badge" style="background:rgba(255,255,255,0.95); border:1.5px solid #cbd5e1; color:var(--teal-800); font-weight:700; padding:8px 14px; margin:4px; font-size:12.5px; text-decoration:none; display:inline-flex; align-items:center; gap:6px; border-radius:8px; box-shadow:0 1px 4px rgba(0,0,0,0.05);">
                                    <i class="fa-solid fa-paperclip" style="color:var(--teal-600); font-size:14px;"></i> ${name}
                                    <i class="fa-solid fa-arrow-up-right-from-square" style="margin-left:4px; font-size:11px; color:var(--text-muted);"></i>
                                </a>
                            `;
                        }
                    }).join('');
                }
            } else {
                if (attArea) attArea.style.display = 'none';
            }

            // Controls
            if (workspaceStatusSelect) workspaceStatusSelect.value = t.status || 'Open';
            if (metaAssigneeSelect) metaAssigneeSelect.value = t.assigned_to || '';

            // Transfer Trail Box in Metadata Card
            const trailBox = document.getElementById('meta-transfer-trail-box');
            const trailContent = document.getElementById('meta-transfer-trail-content');
            const trailCountBadge = document.getElementById('meta-transfer-count-badge');
            
            let thList = t.transfer_history;
            if (typeof thList === 'string') {
                try { thList = JSON.parse(thList); } catch (e) { thList = []; }
            }
            if (trailBox && trailContent) {
                if (Array.isArray(thList) && thList.length > 0) {
                    trailBox.style.display = 'block';
                    if (trailCountBadge) trailCountBadge.textContent = `${thList.length} transfer${thList.length > 1 ? 's' : ''}`;
                    trailContent.innerHTML = formatTicketTransferTrail(thList, { layout: 'details', ticket: t });
                } else {
                    trailBox.style.display = 'none';
                }
            }

            // Metadata Card
            const metaCust = document.getElementById('meta-customer-name');
            const metaProj = document.getElementById('meta-project-name');
            const metaCat = document.getElementById('meta-category-badge');
            const metaPri = document.getElementById('meta-priority-badge');
            if (metaCust) metaCust.textContent = t.customer_name || 'Customer';
            if (metaProj) metaProj.textContent = t.project_name || 'None / General';
            if (metaCat) metaCat.innerHTML = `<span class="badge" style="background:#f0fdfa; color:#0f766e; border:1.5px solid #99f6e4; font-weight:700; font-size:12px; padding:3px 8px; border-radius:6px;">${t.category || 'Bug'}</span>`;
            if (metaPri) metaPri.innerHTML = getPriorityBadge(t.priority);

            // Populate Raised By / Contact Person Card
            const cNameEl = document.getElementById('meta-contact-name');
            const cRoleEl = document.getElementById('meta-contact-role');
            const cAvatarEl = document.getElementById('meta-contact-avatar');
            const cBranchWrap = document.getElementById('meta-contact-branch-wrap');
            const cBranchVal = document.getElementById('meta-contact-branch-val');
            const cPhoneLink = document.getElementById('meta-contact-phone-link');
            const cWaLink = document.getElementById('meta-contact-wa-link');
            const cEmailLink = document.getElementById('meta-contact-email-link');
            const cSourceBadge = document.getElementById('meta-contact-source-badge');

            if (cNameEl) cNameEl.textContent = contactName;
            if (cRoleEl) cRoleEl.textContent = contactRole;
            if (cAvatarEl) cAvatarEl.textContent = (contactName.trim().charAt(0) || 'C').toUpperCase();

            if (cBranchWrap && cBranchVal) {
                if (contactBranch) {
                    cBranchWrap.style.display = 'flex';
                    cBranchVal.textContent = contactBranch;
                } else {
                    cBranchWrap.style.display = 'none';
                }
            }

            if (cPhoneLink) {
                if (contactPhone) {
                    cPhoneLink.textContent = contactPhone;
                    cPhoneLink.href = `tel:${contactPhone}`;
                    cPhoneLink.style.pointerEvents = 'auto';
                } else {
                    cPhoneLink.textContent = 'Not Provided';
                    cPhoneLink.href = '#';
                    cPhoneLink.style.pointerEvents = 'none';
                }
            }

            if (cWaLink) {
                const cleanDigits = String(contactPhone).replace(/\D/g, '');
                if (cleanDigits && cleanDigits.length >= 10) {
                    let waNumber = cleanDigits;
                    if (waNumber.length === 10) waNumber = '91' + waNumber;
                    else if (waNumber.startsWith('0')) waNumber = '91' + waNumber.substring(1);
                    cWaLink.href = `https://wa.me/${waNumber}`;
                    cWaLink.style.display = 'inline-flex';
                } else {
                    cWaLink.style.display = 'none';
                }
            }

            if (cEmailLink) {
                if (contactEmail) {
                    cEmailLink.textContent = contactEmail;
                    cEmailLink.href = `mailto:${contactEmail}`;
                    cEmailLink.style.pointerEvents = 'auto';
                } else {
                    cEmailLink.textContent = 'Not Provided';
                    cEmailLink.href = '#';
                    cEmailLink.style.pointerEvents = 'none';
                }
            }

            if (cSourceBadge) {
                const srcUpper = String(contactSource || 'Web').toUpperCase();
                if (srcUpper.includes('WHATSAPP')) {
                    cSourceBadge.innerHTML = '<i class="fa-brands fa-whatsapp"></i> WhatsApp';
                    cSourceBadge.style.background = '#dcfce7';
                    cSourceBadge.style.color = '#15803d';
                    cSourceBadge.style.borderColor = '#86efac';
                } else if (srcUpper.includes('EMAIL') || srcUpper.includes('MAIL')) {
                    cSourceBadge.innerHTML = '<i class="fa-regular fa-envelope"></i> Email';
                    cSourceBadge.style.background = '#e0f2fe';
                    cSourceBadge.style.color = '#0369a1';
                    cSourceBadge.style.borderColor = '#7dd3fc';
                } else {
                    cSourceBadge.innerHTML = '<i class="fa-solid fa-globe"></i> Web Portal';
                    cSourceBadge.style.background = '#f0fdfa';
                    cSourceBadge.style.color = '#0f766e';
                    cSourceBadge.style.borderColor = '#99f6e4';
                }
            }

            // Wire up Admin Transfer Ticket buttons
            const btnTransferAdmin = document.getElementById('btn-transfer-ticket-admin');
            if (btnTransferAdmin) {
                btnTransferAdmin.onclick = () => window.openTransferTicketModal(t.id);
            }
            const btnMetaTransfer = document.getElementById('btn-meta-transfer-link');
            if (btnMetaTransfer) {
                btnMetaTransfer.onclick = () => window.openTransferTicketModal(t.id);
            }

            // Linked Task / Workflow Badges
            const linkedTaskEl = document.getElementById('meta-linked-task');
            const linkedWorkflowEl = document.getElementById('meta-linked-workflow');

            if (linkedTaskEl) {
                if (t.task_id) {
                    linkedTaskEl.style.display = 'block';
                    const ltid = document.getElementById('meta-linked-task-id');
                    if (ltid) ltid.textContent = `Task #${t.task_id} (${t.task_name || 'Linked Task'})`;
                } else {
                    linkedTaskEl.style.display = 'none';
                }
            }

            if (linkedWorkflowEl) {
                if (t.workflow_id) {
                    linkedWorkflowEl.style.display = 'block';
                    const lwid = document.getElementById('meta-linked-workflow-id');
                    if (lwid) lwid.textContent = `Workflow #${t.workflow_id} (${t.workflow_title || 'Linked Workflow'})`;
                } else {
                    linkedWorkflowEl.style.display = 'none';
                }
            }

            // SLA Timer Display
            const slaEl = document.getElementById('meta-sla-countdown');
            if (slaEl) slaEl.innerHTML = getSlaTimerHtml(t);

            // Assignee Work Time Breakdown Display
            const empTimeBox = document.getElementById('meta-employee-time-box');
            const empTimeTotal = document.getElementById('meta-employee-time-total');
            const empTimeList = document.getElementById('meta-employee-time-list');

            if (empTimeBox && empTimeList) {
                const tb = calculateEmployeeTimeBreakdown(t);
                if (tb && Array.isArray(tb.breakdown) && tb.breakdown.length > 0) {
                    empTimeBox.style.display = 'block';
                    if (empTimeTotal) empTimeTotal.textContent = `Total: ${tb.totalFormatted}`;
                    empTimeList.innerHTML = tb.breakdown.map(b => `
                        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; padding:7px 10px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                                <span style="font-weight:800; font-size:12px; color:#0f172a; display:flex; align-items:center; gap:5px;">
                                    <i class="fa-solid fa-user-gear" style="font-size:11px; color:#0d9488;"></i> ${b.name}
                                </span>
                                <span style="font-weight:800; font-size:12px; color:#0d9488;">
                                    ${b.formatted} <span style="font-size:10.5px; color:#64748b; font-weight:600;">(${b.percent}%)</span>
                                </span>
                            </div>
                            <div style="width:100%; height:5px; background:#f1f5f9; border-radius:3px; overflow:hidden;">
                                <div style="width:${b.percent}%; height:100%; background:linear-gradient(90deg, #0d9488, #10b981); border-radius:3px;"></div>
                            </div>
                        </div>
                    `).join('');
                } else {
                    empTimeBox.style.display = 'none';
                }
            }

            // Render Conversation Thread
            const commentsContainer = document.getElementById('workspace-comments-list');
            const commentsList = t.comments || data.comments || [];
            if (commentsContainer) {
                if (commentsList.length > 0) {
                    let commHtml = '';
                    commentsList.forEach(c => {
                        const cDate = new Date(c.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                        const isInternal = c.is_internal_note;
                        const internalClass = isInternal ? 'internal-note' : '';
                        const noteBadge = isInternal ? '<span class="badge" style="background:#fef3c7; color:#d97706; border:1px solid rgba(245,158,11,0.3); font-size:10px; margin-left:6px;"><i class="fa-solid fa-lock"></i> Internal Note</span>' : '';

                        commHtml += `
                            <div class="chat-msg-item ${internalClass}" style="background:#ffffff; border:1.5px solid #e2e8f0; border-radius:10px; padding:12px; margin-bottom:10px; box-shadow:0 1px 3px rgba(0,0,0,0.03);">
                                <div class="chat-msg-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                                    <span class="chat-msg-author" style="font-weight:800; font-size:13px; color:#0f172a;">${c.author_name || 'Staff'} ${noteBadge}</span>
                                    <span style="color:#64748b; font-size:11.5px; font-weight:600;"><i class="fa-regular fa-clock" style="font-size:10.5px;"></i> ${cDate}</span>
                                </div>
                                <div style="font-size:13.5px; color:#1e293b; line-height:1.5; white-space:pre-wrap; word-break:break-word;">${c.comment_text || c.comment || ''}</div>
                            </div>
                        `;
                    });
                    commentsContainer.innerHTML = commHtml;
                } else {
                    commentsContainer.innerHTML = '<div style="text-align:center; padding:20px; color:#64748b; font-size:13px;">No comments yet. Start the conversation below.</div>';
                }
            }

            // Render Timeline Audit Stream (High Contrast, Bold, Ultra-Readable)
            const historyContainer = document.getElementById('workspace-history-list');
            const historyList = t.history || data.history || [];
            if (historyContainer) {
                if (historyList.length > 0) {
                    let histHtml = '';
                    historyList.forEach(h => {
                        const hDate = new Date(h.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                        
                        // Action Icon determination
                        const act = (h.action || '').toLowerCase();
                        let actionIcon = '<i class="fa-solid fa-circle-dot" style="color:#0d9488;"></i>';
                        if (act.includes('transfer')) {
                            actionIcon = '<i class="fa-solid fa-share-nodes" style="color:#0d9488;"></i>';
                        } else if (act.includes('assign')) {
                            actionIcon = '<i class="fa-solid fa-user-check" style="color:#0284c7;"></i>';
                        } else if (act.includes('resolv') || act.includes('close')) {
                            actionIcon = '<i class="fa-solid fa-circle-check" style="color:#16a34a;"></i>';
                        } else if (act.includes('reopen')) {
                            actionIcon = '<i class="fa-solid fa-rotate-left" style="color:#ea580c;"></i>';
                        } else if (act.includes('creat') || act.includes('register')) {
                            actionIcon = '<i class="fa-solid fa-circle-plus" style="color:#0f766e;"></i>';
                        } else if (act.includes('subtask') || act.includes('chunk')) {
                            actionIcon = '<i class="fa-solid fa-layer-group" style="color:#0d9488;"></i>';
                        }

                        histHtml += `
                            <li class="timeline-item">
                                <div class="timeline-dot"></div>
                                <div style="background:#ffffff; border:1.5px solid #e2e8f0; border-radius:10px; padding:10px 14px; box-shadow:0 1px 4px rgba(0,0,0,0.04);">
                                    <div style="font-weight:800; font-size:13.5px; color:#0f172a; display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                                        ${actionIcon} <span>${h.action || 'Activity Logged'}</span>
                                    </div>
                                    ${h.details ? `<div style="color:#334155; font-size:13px; font-weight:500; line-height:1.5; margin-bottom:6px; word-break:break-word;">${h.details}</div>` : ''}
                                    <div style="font-size:12px; font-weight:700; color:#475569; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                                        <span style="display:inline-flex; align-items:center; gap:4px; color:#1e293b;">
                                            <i class="fa-regular fa-user" style="font-size:11px; color:#64748b;"></i>
                                            ${h.performed_by || 'System'}
                                        </span>
                                        <span style="color:#cbd5e1;">•</span>
                                        <span style="display:inline-flex; align-items:center; gap:4px; color:#64748b;">
                                            <i class="fa-regular fa-clock" style="font-size:11px;"></i>
                                            ${hDate}
                                        </span>
                                    </div>
                                </div>
                            </li>
                        `;
                    });
                    historyContainer.innerHTML = histHtml;
                } else {
                    historyContainer.innerHTML = '<li class="timeline-item"><div class="timeline-dot"></div><div style="font-weight:700; color:#0f172a;">Ticket Created</div></li>';
                }
            }

            // Subtasks rendering
            renderTicketSubtasks(t.subtasks || []);

            const modalTarget = document.getElementById('ticket-workspace-modal');
            if (modalTarget) {
                modalTarget.style.display = 'flex';
                modalTarget.classList.add('active');
                modalTarget.style.opacity = '1';
                document.body.classList.add('modal-open');
            }
            if (typeof window.openModal === 'function') window.openModal('ticket-workspace-modal');
        } catch (err) {
            console.error("Error opening ticket workspace:", err);
            alert("Error loading ticket workspace: " + err.message);
        }
    };

    if (ticketWorkspaceClose) {
        ticketWorkspaceClose.addEventListener('click', () => {
            const modalTarget = document.getElementById('ticket-workspace-modal');
            if (modalTarget) {
                modalTarget.classList.remove('active');
                modalTarget.style.opacity = '0';
                setTimeout(() => { modalTarget.style.display = 'none'; }, 200);
            }
            document.body.classList.remove('modal-open');
            if (typeof window.closeModal === 'function') window.closeModal('ticket-workspace-modal');
            currentActiveTicketId = null;
            currentTicketSubtasksCache = [];
        });
    }

    // =========================================================================
    // SUB-TASKS & WORK CHUNKING LOGIC
    // =========================================================================
    let currentTicketSubtasksCache = [];

    // Helper: Render Sub-tasks in Workspace
    const renderTicketSubtasks = (subtasks = []) => {
        currentTicketSubtasksCache = subtasks || [];
        const container = document.getElementById('workspace-subtasks-list');
        const progressLabel = document.getElementById('subtask-progress-label');
        const totalHoursLabel = document.getElementById('subtask-total-hours');
        const progressBar = document.getElementById('subtask-progress-bar');

        const totalCount = subtasks.length;
        const doneCount = subtasks.filter(s => s.status === 'Completed').length;
        const percent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
        const totalHours = subtasks.reduce((sum, s) => sum + (parseFloat(s.time_spent_hours) || 0), 0).toFixed(1);

        if (progressLabel) progressLabel.textContent = `${doneCount} of ${totalCount} Chunks Done (${percent}%)`;
        if (totalHoursLabel) totalHoursLabel.textContent = `Total Time: ${totalHours} hrs`;
        if (progressBar) progressBar.style.width = `${percent}%`;

        if (!container) return;

        if (totalCount === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding:15px; color:var(--text-muted); font-size:12px; background:rgba(0,0,0,0.02); border-radius:8px; border:1px dashed rgba(0,0,0,0.1);">
                    <i class="fa-solid fa-layer-group" style="font-size:18px; color:var(--teal-600); margin-bottom:4px; display:block;"></i>
                    No work chunks yet. Click "<strong>+ Add Sub-Task / Chunk</strong>" above to divide this ticket among team members.
                </div>
            `;
            return;
        }

        let html = '';
        subtasks.forEach((s, idx) => {
            const isDone = s.status === 'Completed';
            const isWaiting = s.status === 'Waiting';
            const isInProgress = s.status === 'In Progress';

            let statusBadge = '';
            let cardBg = '#ffffff';
            let cardBorder = '#e2e8f0';

            if (isDone) {
                statusBadge = '<span class="badge" style="background:rgba(34,197,94,0.15); color:#16a34a; border:1px solid rgba(34,197,94,0.3); font-size:11px; font-weight:700;"><i class="fa-solid fa-circle-check"></i> Completed</span>';
                cardBg = 'rgba(240,253,244,0.7)';
                cardBorder = 'rgba(34,197,94,0.3)';
            } else if (isInProgress) {
                statusBadge = '<span class="badge" style="background:rgba(168,85,247,0.15); color:#9333ea; border:1px solid rgba(168,85,247,0.3); font-size:11px; font-weight:700;"><i class="fa-solid fa-gears fa-spin" style="--fa-animation-duration:4s;"></i> In Progress</span>';
                cardBg = 'rgba(250,245,255,0.85)';
                cardBorder = 'rgba(168,85,247,0.35)';
            } else if (isWaiting) {
                statusBadge = `<span class="badge" style="background:rgba(245,158,11,0.15); color:#d97706; border:1px solid rgba(245,158,11,0.3); font-size:11px; font-weight:700;"><i class="fa-solid fa-hourglass-half"></i> Waiting for Dependency</span>`;
                cardBg = 'rgba(255,251,235,0.7)';
                cardBorder = 'rgba(245,158,11,0.3)';
            } else {
                statusBadge = '<span class="badge" style="background:rgba(100,116,139,0.12); color:#475569; border:1px solid rgba(100,116,139,0.25); font-size:11px; font-weight:700;"><i class="fa-solid fa-clock"></i> Ready / Pending</span>';
            }

            const assigneeName = s.assigned_to_name ? s.assigned_to_name : 'Unassigned';
            const hoursLogged = parseFloat(s.time_spent_hours || 0).toFixed(1);

            let depHtml = '';
            if (s.depends_on_subtask_id) {
                if (s.depends_on_status === 'Completed') {
                    depHtml = `<div style="font-size:11px; color:#059669; margin-top:4px; font-weight:600;"><i class="fa-solid fa-unlock"></i> Prerequisite done: <strong>${s.depends_on_title || 'Previous Chunk'}</strong></div>`;
                } else {
                    depHtml = `<div style="font-size:11px; color:#d97706; margin-top:4px; font-weight:600;"><i class="fa-solid fa-lock"></i> Locked until: <strong>${s.depends_on_title || 'Previous Chunk'}</strong> is completed & handed over</div>`;
                }
            }

            let handoverHtml = '';
            if (s.handover_notes) {
                handoverHtml = `
                    <div style="margin-top:8px; padding:8px 12px; background:#f0fdfa; border-left:3px solid #0d9488; border-radius:4px; font-size:11.5px; color:#134e4a; line-height:1.45;">
                        <strong style="display:flex; align-items:center; gap:5px; color:#0f766e; margin-bottom:2px;">
                            <i class="fa-solid fa-handshake-simple"></i> Handover Notes by ${s.completed_by_name || assigneeName}:
                        </strong>
                        <div style="white-space:pre-wrap;">${esc(s.handover_notes)}</div>
                    </div>
                `;
            }

            html += `
                <div class="subtask-card" style="background:${cardBg}; border:1px solid ${cardBorder}; border-radius:8px; padding:10px 12px; transition:all 0.2s ease;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
                        <div style="flex:1;">
                            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                                <span style="background:var(--teal-700); color:#fff; font-size:10px; font-weight:800; padding:2px 6px; border-radius:4px;">#${s.sequence_order || (idx + 1)}</span>
                                <strong style="font-size:13px; color:var(--teal-950);">${s.title}</strong>
                                ${statusBadge}
                            </div>
                            ${s.description ? `<div style="font-size:11.5px; color:var(--text-muted); margin-top:3px; line-height:1.35;">${s.description}</div>` : ''}
                            <div style="display:flex; align-items:center; gap:12px; margin-top:5px; font-size:11.5px; color:var(--text-dark); flex-wrap:wrap;">
                                <span><i class="fa-solid fa-user-gear" style="color:var(--teal-600); margin-right:3px;"></i> <strong>${assigneeName}</strong></span>
                                <span style="color:#0f766e; font-weight:700;"><i class="fa-solid fa-stopwatch" style="margin-right:3px;"></i> ${hoursLogged} hrs</span>
                            </div>
                            ${depHtml}
                            ${handoverHtml}
                        </div>
                        <div style="display:flex; align-items:center; gap:4px; flex-shrink:0;">
                            ${!isDone ? `
                                <button type="button" class="btn-primary" onclick="window.openSubtaskHandoverModal(${s.id})" style="padding:4px 8px; font-size:11px; font-weight:800; background:linear-gradient(135deg, #059669, #047857); border:none; border-radius:5px; display:inline-flex; align-items:center; gap:4px;" title="Complete Chunk & Provide Handover Notes">
                                    <i class="fa-solid fa-handshake-simple"></i> Handover
                                </button>
                            ` : ''}
                            ${!isDone && s.status !== 'In Progress' ? `
                                <button type="button" class="btn-secondary" onclick="window.startSubtaskAction(${s.id})" style="padding:4px 8px; font-size:11px; font-weight:700; background:rgba(14,165,233,0.12); color:#0284c7; border:1px solid rgba(14,165,233,0.3); border-radius:5px; display:inline-flex; align-items:center; gap:3px;" title="Start Working on this Chunk">
                                    <i class="fa-solid fa-play" style="font-size:10px;"></i> Start
                                </button>
                            ` : ''}
                            <button type="button" class="btn-secondary" onclick="window.openEditSubtaskModal(${s.id})" style="padding:4px 7px; font-size:11px; font-weight:700; background:rgba(217,119,6,0.1); color:#d97706; border:1px solid rgba(217,119,6,0.3); border-radius:5px;" title="Edit Chunk">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button type="button" class="btn-secondary" onclick="window.deleteSubtaskAction(${s.id})" style="padding:4px 7px; font-size:11px; font-weight:700; background:rgba(239,68,68,0.1); color:#ef4444; border:1px solid rgba(239,68,68,0.3); border-radius:5px;" title="Delete Chunk">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    };

    // Sub-task Modals & Handlers
    const modalAddSubtask = document.getElementById('modal-add-subtask');
    const formAddSubtask = document.getElementById('form-add-subtask');
    const btnAddSubtask = document.getElementById('btn-add-subtask');
    const modalAddSubtaskClose = document.getElementById('modal-add-subtask-close');
    const modalAddSubtaskCancel = document.getElementById('modal-add-subtask-cancel');

    const modalSubtaskHandover = document.getElementById('modal-subtask-handover');
    const formSubtaskHandover = document.getElementById('form-subtask-handover');
    const modalSubtaskHandoverClose = document.getElementById('modal-subtask-handover-close');
    const modalSubtaskHandoverCancel = document.getElementById('modal-subtask-handover-cancel');

    const closeAddSubtaskModal = () => {
        const m = document.getElementById('modal-add-subtask');
        if (m) {
            m.classList.remove('active');
            m.style.opacity = '0';
            m.style.pointerEvents = 'none';
            setTimeout(() => { m.style.display = 'none'; }, 150);
        }
        if (formAddSubtask) formAddSubtask.reset();
        const editIdEl = document.getElementById('subtask-edit-id');
        if (editIdEl) editIdEl.value = '';
    };
    window.closeAddSubtaskModal = closeAddSubtaskModal;

    const closeSubtaskHandoverModal = () => {
        const m = document.getElementById('modal-subtask-handover');
        if (m) {
            m.classList.remove('active');
            m.style.opacity = '0';
            m.style.pointerEvents = 'none';
            setTimeout(() => { m.style.display = 'none'; }, 150);
        }
        if (formSubtaskHandover) formSubtaskHandover.reset();
        const hidEl = document.getElementById('handover-subtask-id');
        if (hidEl) hidEl.value = '';
    };
    window.closeSubtaskHandoverModal = closeSubtaskHandoverModal;

    if (modalAddSubtaskClose) modalAddSubtaskClose.addEventListener('click', closeAddSubtaskModal);
    if (modalAddSubtaskCancel) modalAddSubtaskCancel.addEventListener('click', closeAddSubtaskModal);
    if (modalSubtaskHandoverClose) modalSubtaskHandoverClose.addEventListener('click', closeSubtaskHandoverModal);
    if (modalSubtaskHandoverCancel) modalSubtaskHandoverCancel.addEventListener('click', closeSubtaskHandoverModal);

    window.openAddSubtaskModal = async (editId = null) => {
        if (!currentActiveTicketId) {
            console.warn("No active ticket selected when opening subtask modal");
            return;
        }

        const titleEl = document.getElementById('subtask-modal-title');
        const editIdInput = document.getElementById('subtask-edit-id');
        const titleInput = document.getElementById('subtask-title-input');
        const descInput = document.getElementById('subtask-desc-input');
        const assigneeSelect = document.getElementById('subtask-assignee-select');
        const depSelect = document.getElementById('subtask-dependency-select');
        const seqInput = document.getElementById('subtask-seq-input');
        const hoursInput = document.getElementById('subtask-hours-input');

        // Ensure employeesCache is populated
        if (!employeesCache || employeesCache.length === 0) {
            try {
                const empRes = await fetch('/api/v1/admin/employees');
                const empData = await empRes.json();
                if (empData.success) {
                    employeesCache = Array.isArray(empData.data) ? empData.data : (empData.data?.employees || []);
                }
            } catch (e) {
                console.warn("Could not fetch employees for subtasks:", e);
            }
        }

        // Populate Assignees
        if (assigneeSelect) {
            assigneeSelect.innerHTML = '<option value="">Select Employee...</option>';
            (employeesCache || []).forEach(e => {
                const empName = e.full_name || e.name || 'Staff';
                const empRole = e.role || e.designation || 'Staff';
                assigneeSelect.innerHTML += `<option value="${e.id}">${empName} (${empRole})</option>`;
            });
        }

        // Populate Dependencies (exclude self if editing)
        if (depSelect) {
            depSelect.innerHTML = '<option value="">⚡ None (Parallel / Start Immediately)</option>';
            (currentTicketSubtasksCache || []).forEach(s => {
                if (!editId || String(s.id) !== String(editId)) {
                    depSelect.innerHTML += `<option value="${s.id}">🔗 #${s.sequence_order} - ${s.title} (${s.assigned_to_name || 'Staff'})</option>`;
                }
            });
        }

        if (editId) {
            const st = (currentTicketSubtasksCache || []).find(s => String(s.id) === String(editId));
            if (!st) return;
            if (titleEl) titleEl.textContent = "Edit Work Chunk / Sub-Task";
            if (editIdInput) editIdInput.value = st.id;
            if (titleInput) titleInput.value = st.title || '';
            if (descInput) descInput.value = st.description || '';
            if (assigneeSelect) assigneeSelect.value = st.assigned_to || '';
            if (depSelect) depSelect.value = st.depends_on_subtask_id || '';
            if (seqInput) seqInput.value = st.sequence_order || 1;
            if (hoursInput) hoursInput.value = st.time_spent_hours || 0;
        } else {
            if (titleEl) titleEl.textContent = "Add Work Chunk / Sub-Task";
            if (editIdInput) editIdInput.value = '';
            if (titleInput) titleInput.value = '';
            if (descInput) descInput.value = '';
            if (assigneeSelect) assigneeSelect.value = '';
            if (depSelect) depSelect.value = '';
            if (seqInput) seqInput.value = (currentTicketSubtasksCache || []).length + 1;
            if (hoursInput) hoursInput.value = '0.0';
        }

        const m = document.getElementById('modal-add-subtask');
        if (m) {
            m.style.display = 'flex';
            m.classList.add('active');
            m.style.opacity = '1';
            m.style.pointerEvents = 'auto';
            m.style.zIndex = '9999999';
        }
    };

    window.openEditSubtaskModal = (subtaskId) => {
        window.openAddSubtaskModal(subtaskId);
    };

    if (btnAddSubtask) {
        btnAddSubtask.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.openAddSubtaskModal();
        });
    }

    if (formAddSubtask) {
        formAddSubtask.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentActiveTicketId) return;

            const editId = document.getElementById('subtask-edit-id').value;
            const payload = {
                title: document.getElementById('subtask-title-input').value.trim(),
                description: document.getElementById('subtask-desc-input').value.trim(),
                assigned_to: document.getElementById('subtask-assignee-select').value ? parseInt(document.getElementById('subtask-assignee-select').value, 10) : null,
                depends_on_subtask_id: document.getElementById('subtask-dependency-select').value ? parseInt(document.getElementById('subtask-dependency-select').value, 10) : null,
                sequence_order: parseInt(document.getElementById('subtask-seq-input').value, 10) || 1,
                time_spent_hours: parseFloat(document.getElementById('subtask-hours-input').value) || 0
            };

            try {
                const url = editId
                    ? `/api/v1/support/${currentActiveTicketId}/subtasks/${editId}`
                    : `/api/v1/support/${currentActiveTicketId}/subtasks`;
                const method = editId ? 'PUT' : 'POST';

                const res = await fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();

                if (res.ok && data.success) {
                    if (typeof showToast === 'function') showToast(data.message || "Subtask saved successfully!", "success");
                    closeAddSubtaskModal();
                    // Refresh subtasks and main list
                    await refreshActiveTicketSubtasks();
                    loadTickets();
                } else {
                    alert(data.message || "Failed to save subtask");
                }
            } catch (err) {
                console.error("Error saving subtask:", err);
                alert("Error saving subtask");
            }
        });
    }

    window.openSubtaskHandoverModal = (subtaskId) => {
        const st = (currentTicketSubtasksCache || []).find(s => String(s.id) === String(subtaskId));
        if (!st) return;

        const hidEl = document.getElementById('handover-subtask-id');
        const hTitleEl = document.getElementById('handover-subtask-title');
        const hHoursEl = document.getElementById('handover-hours-input');
        const hNotesEl = document.getElementById('handover-notes-input');

        if (hidEl) hidEl.value = st.id;
        if (hTitleEl) hTitleEl.textContent = `#${st.sequence_order || ''} - ${st.title}`;
        if (hHoursEl) hHoursEl.value = st.time_spent_hours || '1.0';
        if (hNotesEl) hNotesEl.value = st.handover_notes || '';

        const m = document.getElementById('modal-subtask-handover');
        if (m) {
            m.style.display = 'flex';
            m.classList.add('active');
            m.style.opacity = '1';
            m.style.pointerEvents = 'auto';
            m.style.zIndex = '9999999';
        }
    };

    if (formSubtaskHandover) {
        formSubtaskHandover.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentActiveTicketId) return;

            const subtaskId = document.getElementById('handover-subtask-id').value;
            const hours = parseFloat(document.getElementById('handover-hours-input').value) || 0;
            const notes = document.getElementById('handover-notes-input').value.trim();

            try {
                const res = await fetch(`/api/v1/support/${currentActiveTicketId}/subtasks/${subtaskId}/handover`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        time_spent_hours: hours,
                        handover_notes: notes
                    })
                });
                const data = await res.json();

                if (res.ok && data.success) {
                    if (typeof showToast === 'function') showToast(data.message || "Chunk completed and handover logged!", "success");
                    closeSubtaskHandoverModal();
                    await refreshActiveTicketSubtasks();
                    // Also reload workspace conversation & tickets list
                    window.openTicketWorkspace(currentActiveTicketId);
                    loadTickets();
                } else {
                    alert(data.message || "Failed to complete handover");
                }
            } catch (err) {
                console.error("Error completing handover:", err);
                alert("Error submitting handover");
            }
        });
    }

    window.startSubtaskAction = async (subtaskId) => {
        if (!currentActiveTicketId) return;
        try {
            const res = await fetch(`/api/v1/support/${currentActiveTicketId}/subtasks/${subtaskId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'In Progress' })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                if (typeof showToast === 'function') showToast("Work chunk started!", "success");
                await refreshActiveTicketSubtasks();
            } else {
                alert(data.message || "Failed to start subtask");
            }
        } catch (err) {
            console.error("Error starting subtask:", err);
        }
    };

    window.deleteSubtaskAction = async (subtaskId) => {
        if (!currentActiveTicketId) return;
        if (!confirm("Are you sure you want to delete this work chunk?")) return;

        try {
            const res = await fetch(`/api/v1/support/${currentActiveTicketId}/subtasks/${subtaskId}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (res.ok && data.success) {
                if (typeof showToast === 'function') showToast("Subtask deleted", "success");
                await refreshActiveTicketSubtasks();
                loadTickets();
            } else {
                alert(data.message || "Failed to delete subtask");
            }
        } catch (err) {
            console.error("Error deleting subtask:", err);
        }
    };

    const refreshActiveTicketSubtasks = async () => {
        if (!currentActiveTicketId) return;
        try {
            const res = await fetch(`/api/v1/support/${currentActiveTicketId}/subtasks`);
            const data = await res.json();
            if (data.success) {
                renderTicketSubtasks(data.data || []);
            }
        } catch (err) {
            console.error("Error refreshing subtasks:", err);
        }
    };

    // Status Change Listener in Workspace
    if (workspaceStatusSelect) {
        workspaceStatusSelect.addEventListener('change', async (e) => {
            if (!currentActiveTicketId) return;
            const newStatus = e.target.value;

            try {
                const res = await fetch(`/api/v1/support/${currentActiveTicketId}/status`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: newStatus })
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    if (typeof showToast === 'function') showToast(`Status updated to ${newStatus}!`, "success");
                    window.openTicketWorkspace(currentActiveTicketId);
                    loadTickets();
                } else {
                    alert(data.message || "Failed to update status");
                }
            } catch (err) {
                console.error("Error updating status:", err);
            }
        });
    }

    // Quick Start Resolving Ticket from Admin Table or Modal
    window.startResolvingTicket = async function (ticketId) {
        try {
            const res = await fetch(`/api/v1/support/${ticketId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'In Progress', notes: 'Resolution work started.' })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                if (typeof showToast === 'function') showToast("Resolution started! Live SLA timer active.", "success");
                if (currentActiveTicketId && String(currentActiveTicketId) === String(ticketId)) {
                    window.openTicketWorkspace(ticketId);
                }
                loadTickets();
            } else {
                alert(data.message || "Failed to start resolution");
            }
        } catch (err) {
            console.error("Error starting resolution:", err);
        }
    };

    // Quick Resolve Ticket from Admin Table
    window.quickResolveTicket = async function (ticketId) {
        if (!confirm("Mark this support ticket as Resolved?")) return;
        try {
            const res = await fetch(`/api/v1/support/${ticketId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'Resolved', notes: 'Marked as resolved.' })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                if (typeof showToast === 'function') showToast("Ticket marked as Resolved!", "success");
                if (currentActiveTicketId && String(currentActiveTicketId) === String(ticketId)) {
                    window.openTicketWorkspace(ticketId);
                }
                loadTickets();
            } else {
                alert(data.message || "Failed to resolve ticket");
            }
        } catch (err) {
            console.error("Error resolving ticket:", err);
        }
    };

    // Reopen Ticket from Admin Desk
    window.reopenTicket = async function (ticketId) {
        const reason = prompt("Enter reason for reopening ticket (or customer feedback):", "Further resolution work required.");
        if (reason === null) return;

        try {
            const res = await fetch(`/api/v1/support/${ticketId}/reopen`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: reason || 'Reopened by Admin' })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                if (typeof showToast === 'function') showToast("Ticket reopened successfully!", "success");
                if (currentActiveTicketId && String(currentActiveTicketId) === String(ticketId)) {
                    window.openTicketWorkspace(ticketId);
                }
                loadTickets();
            } else {
                alert(data.message || "Failed to reopen ticket");
            }
        } catch (err) {
            console.error("Error reopening ticket:", err);
        }
    };

    // Assignee Change Listener in Workspace
    if (metaAssigneeSelect) {
        metaAssigneeSelect.addEventListener('change', async (e) => {
            if (!currentActiveTicketId) return;
            const assignedTo = e.target.value ? parseInt(e.target.value, 10) : null;

            try {
                const res = await fetch(`/api/v1/support/${currentActiveTicketId}/assign`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ assigned_to: assignedTo })
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    if (typeof showToast === 'function') showToast(data.message || "Ticket assigned!", "success");
                    window.openTicketWorkspace(currentActiveTicketId);
                    loadTickets();
                } else {
                    alert(data.message || "Failed to assign ticket");
                }
            } catch (err) {
                console.error("Error assigning ticket:", err);
            }
        });
    }

    // Post Comment Listener
    if (btnPostComment && newCommentText) {
        btnPostComment.addEventListener('click', async () => {
            if (!currentActiveTicketId) return;
            const text = newCommentText.value.trim();
            if (!text) {
                alert("Please enter a comment or note.");
                return;
            }

            const isInternal = chkInternalNote ? chkInternalNote.checked : false;

            try {
                const res = await fetch(`/api/v1/support/${currentActiveTicketId}/comments`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        comment_text: text,
                        is_internal_note: isInternal
                    })
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    newCommentText.value = '';
                    if (chkInternalNote) chkInternalNote.checked = false;
                    if (typeof showToast === 'function') showToast("Comment posted!", "success");
                    window.openTicketWorkspace(currentActiveTicketId);
                } else {
                    alert(data.message || "Failed to post comment");
                }
            } catch (err) {
                console.error("Error posting comment:", err);
            }
        });
    }

    // Convert to Task Listener
    if (btnConvertTask) {
        btnConvertTask.addEventListener('click', async () => {
            if (!currentActiveTicketId) return;

            if (!confirm("Convert this support issue into a new Task in the Workflow module?")) return;

            try {
                const res = await fetch(`/api/v1/support/${currentActiveTicketId}/convert-to-task`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ estimated_hours: 4 })
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    if (typeof showToast === 'function') showToast(data.message || "Ticket converted to Task!", "success");
                    window.openTicketWorkspace(currentActiveTicketId);
                    loadTickets();
                } else {
                    alert(data.message || "Failed to convert ticket to task");
                }
            } catch (err) {
                console.error("Error converting ticket to task:", err);
            }
        });
    }

    // Convert to Workflow Listener
    if (btnConvertWorkflow) {
        btnConvertWorkflow.addEventListener('click', async () => {
            if (!currentActiveTicketId) return;

            if (!confirm("Convert this major support request into a brand new Workflow?")) return;

            try {
                const res = await fetch(`/api/v1/support/${currentActiveTicketId}/convert-to-workflow`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({})
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    if (typeof showToast === 'function') showToast(data.message || "Ticket converted to Workflow!", "success");
                    window.openTicketWorkspace(currentActiveTicketId);
                    loadTickets();
                } else {
                    alert(data.message || "Failed to convert ticket to workflow");
                }
            } catch (err) {
                console.error("Error converting ticket to workflow:", err);
            }
        });
    }

    // Modal 3: Edit Ticket Modal Handlers
    const editTicketModal = document.getElementById('edit-ticket-modal');
    const editTicketForm = document.getElementById('edit-ticket-form');
    const editTicketClose = document.getElementById('edit-ticket-close');
    const editTicketCancel = document.getElementById('edit-ticket-cancel');

    const closeEditTicketModal = () => {
        if (typeof window.closeModal === 'function') window.closeModal(editTicketModal);
        else if (editTicketModal) editTicketModal.classList.remove('active');
        if (editTicketForm) editTicketForm.reset();
    };

    if (editTicketClose) editTicketClose.addEventListener('click', closeEditTicketModal);
    if (editTicketCancel) editTicketCancel.addEventListener('click', closeEditTicketModal);

    window.openEditTicketModal = async (ticketId) => {
        try {
            const res = await fetch(`/api/v1/support/${ticketId}`);
            const data = await res.json();

            if (!res.ok || !data.success) {
                alert(data.message || "Failed to load ticket for editing");
                return;
            }

            const t = data.data;
            document.getElementById('edit-ticket-id').value = t.id;
            document.getElementById('edit-ticket-code-badge').textContent = t.ticket_code;
            document.getElementById('edit-ticket-title').value = t.title || '';
            document.getElementById('edit-ticket-description').value = t.description || '';
            document.getElementById('edit-ticket-category').value = t.category || 'Bug';
            document.getElementById('edit-ticket-priority').value = t.priority || 'Medium';
            document.getElementById('edit-ticket-status').value = t.status || 'Open';

            const custSelect = document.getElementById('edit-ticket-customer');
            if (custSelect) custSelect.value = t.customer_id || '';

            const projSelect = document.getElementById('edit-ticket-project');
            renderProjectOptions(projSelect, t.customer_id, t.project_id);

            const assSelect = document.getElementById('edit-ticket-assignee');
            if (assSelect) assSelect.value = t.assigned_to || '';

            if (typeof window.openModal === 'function') window.openModal(editTicketModal);
            else if (editTicketModal) editTicketModal.classList.add('active');
        } catch (err) {
            console.error("Error fetching ticket for edit:", err);
            alert("Error fetching ticket details");
        }
    };

    if (editTicketForm) {
        editTicketForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const ticketId = document.getElementById('edit-ticket-id').value;
            if (!ticketId) return;

            const editProjSelect = document.getElementById('edit-ticket-project');
            const selectedEditOption = editProjSelect ? editProjSelect.options[editProjSelect.selectedIndex] : null;
            const editProjectName = selectedEditOption ? (selectedEditOption.getAttribute('data-project-name') || selectedEditOption.textContent) : null;
            const isNumericEditId = editProjSelect && /^\d+$/.test(editProjSelect.value);

            const payload = {
                title: document.getElementById('edit-ticket-title').value.trim(),
                description: document.getElementById('edit-ticket-description').value.trim(),
                category: document.getElementById('edit-ticket-category').value,
                priority: document.getElementById('edit-ticket-priority').value,
                status: document.getElementById('edit-ticket-status').value,
                customer_id: document.getElementById('edit-ticket-customer').value || null,
                project_id: isNumericEditId ? parseInt(editProjSelect.value, 10) : null,
                project_name: editProjectName && editProjectName !== 'None / General Maintenance' ? editProjectName : null,
                assigned_to: document.getElementById('edit-ticket-assignee').value || null
            };

            try {
                const res = await fetch(`/api/v1/support/${ticketId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();

                if (res.ok && data.success) {
                    if (typeof showToast === 'function') showToast(data.message || "Ticket updated successfully!", "success");
                    closeEditTicketModal();
                    loadTickets();
                } else {
                    alert(data.message || "Failed to update ticket");
                }
            } catch (err) {
                console.error("Error updating ticket:", err);
                alert("Error saving ticket changes");
            }
        });
    }

    // =========================================================================
    // ADMIN TICKET TRANSFER MODAL HANDLERS
    // =========================================================================
    function populateTransferEmployeeDropdown(currentAssigneeId) {
        const select = document.getElementById('transfer-ticket-target-emp');
        if (!select) return;
        select.innerHTML = '<option value="">Select Team Member...</option>';
        employeesCache.forEach(m => {
            if (currentAssigneeId && String(m.id) === String(currentAssigneeId)) return;
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = `${m.full_name} (${m.role || m.designation || 'Staff'})`;
            select.appendChild(opt);
        });
    }

    const closeTransferModal = () => {
        const modal = document.getElementById('modal-ticket-transfer');
        if (modal) {
            modal.classList.remove('active');
            modal.style.opacity = '0';
            setTimeout(() => { modal.style.display = 'none'; }, 200);
        }
        document.body.classList.remove('modal-open');
    };

    window.openTransferTicketModal = async function(ticketId) {
        if (!ticketId) ticketId = currentActiveTicketId;
        if (!ticketId) return;

        let ticket = null;
        try {
            const res = await fetch(`/api/v1/support/${ticketId}`);
            const json = await res.json();
            if (json.success && json.data) ticket = json.data;
        } catch (e) {
            console.warn("Could not fetch ticket for transfer:", e);
        }

        if (!ticket) {
            alert("Could not load ticket details for transfer.");
            return;
        }

        populateTransferEmployeeDropdown(ticket.assigned_to);

        const idEl = document.getElementById('transfer-ticket-id');
        const titleEl = document.getElementById('transfer-ticket-banner-title');
        const subEl = document.getElementById('transfer-ticket-banner-sub');
        const notesEl = document.getElementById('transfer-ticket-notes');

        if (idEl) idEl.value = ticket.id;
        if (titleEl) titleEl.textContent = `${ticket.ticket_code} • ${ticket.title}`;
        if (subEl) subEl.textContent = `${ticket.customer_name || 'Customer'} • Project: ${ticket.project_name || 'General'}`;
        if (notesEl) notesEl.value = '';

        const modal = document.getElementById('modal-ticket-transfer');
        if (modal) {
            modal.style.display = 'flex';
            modal.classList.add('active');
            modal.style.opacity = '1';
            document.body.classList.add('modal-open');
        }
    };

    const closeTransferBtn = document.getElementById('close-ticket-transfer-modal');
    const cancelTransferBtn = document.getElementById('btn-cancel-ticket-transfer');
    if (closeTransferBtn) closeTransferBtn.addEventListener('click', closeTransferModal);
    if (cancelTransferBtn) cancelTransferBtn.addEventListener('click', closeTransferModal);

    const formTransfer = document.getElementById('form-ticket-transfer');
    if (formTransfer) {
        formTransfer.addEventListener('submit', async (e) => {
            e.preventDefault();
            const ticketId = document.getElementById('transfer-ticket-id').value;
            const targetEmpId = document.getElementById('transfer-ticket-target-emp').value;
            const reasonCat = document.getElementById('transfer-ticket-reason-cat').value;
            const notes = document.getElementById('transfer-ticket-notes').value.trim();

            if (!targetEmpId || !notes) {
                alert('Please select an employee and enter handover notes.');
                return;
            }

            const submitBtn = document.getElementById('btn-submit-ticket-transfer');
            if (submitBtn) submitBtn.disabled = true;

            try {
                const res = await fetch(`/api/v1/support/${ticketId}/transfer`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        target_employee_id: parseInt(targetEmpId, 10),
                        reason_category: reasonCat,
                        notes: notes
                    })
                });
                const data = await res.json();
                if (data.success) {
                    if (typeof showToast === 'function') showToast(data.message || 'Ticket transferred successfully!', 'success');
                    else alert(data.message || 'Ticket transferred successfully!');
                    closeTransferModal();

                    // If workspace modal is open with this ticket, refresh workspace details
                    if (currentActiveTicketId && String(currentActiveTicketId) === String(ticketId)) {
                        await window.openTicketWorkspace(ticketId);
                    }
                    await loadTickets();
                } else {
                    alert(data.message || 'Transfer failed');
                }
            } catch (err) {
                console.error("Transfer ticket error:", err);
                alert('Network error transferring ticket');
            } finally {
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }

    // Live Ticking Timer Function
    const startLiveTicketTimers = () => {
        setInterval(() => {
            document.querySelectorAll('.live-ticket-timer').forEach(el => {
                const status = el.getAttribute('data-status');
                // Only tick live for active In Progress tickets
                if (status !== 'In Progress') return;

                const startedStr = el.getAttribute('data-started');
                if (!startedStr) return;

                const startMs = new Date(startedStr).getTime();
                if (isNaN(startMs)) return;

                const elapsedMs = Math.max(0, Date.now() - startMs);
                const textEl = el.querySelector('.live-timer-text');
                if (!textEl) return;

                const eH = String(Math.floor(elapsedMs / 3600000)).padStart(2, '0');
                const eM = String(Math.floor((elapsedMs % 3600000) / 60000)).padStart(2, '0');
                const eS = String(Math.floor((elapsedMs % 60000) / 1000)).padStart(2, '0');
                textEl.textContent = `${eH}:${eM}:${eS}`;
            });
        }, 1000);
    };

    // Logout button handler
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                const response = await fetch('/api/v1/auth/logout', { method: 'POST' });
                if (response.ok) {
                    window.location.href = '/login.html';
                }
            } catch (error) {
                console.error('Logout error:', error);
            }
        });
    }

    // Initial Execution
    loadDropdownData().then(() => {
        loadTickets();
        startLiveTicketTimers();
    });
});
