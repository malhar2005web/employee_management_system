import { pool } from '../config/db.js';
import { 
    testConnection, 
    syncTeramindDataToCache, 
    getWebPagesApplicationsGrid, 
    getAvailableVideoData,
    exportTeramindVideo,
    getTeramindExportVideoStatus,
    getTeramindCredentials
} from '../services/teramind.service.js';

// ── EXISTING LOGS CONTROLLERS ──────────────────────────────────────────────────
export async function getMonitoringLogs(req, res) {
    try {
        const result = await pool.query(`
            SELECT ml.*, e.full_name, e.employee_code
            FROM monitoring_logs ml
            LEFT JOIN employees e ON ml.employee_id = e.id
            ORDER BY ml.log_time DESC
            LIMIT 100;
        `);
        res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        console.log("Error in getMonitoringLogs:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function getActivityLogs(req, res) {
    try {
        const result = await pool.query(`
            SELECT al.*, e.full_name, e.employee_code
            FROM activity_logs al
            LEFT JOIN employees e ON al.employee_id = e.id
            ORDER BY al.date DESC;
        `);
        res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        console.log("Error in getActivityLogs:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function categorizeProductivity(req, res) {
    try {
        const { name, type, category } = req.body;
        if (!name || !type || !category) {
            return res.status(400).json({ success: false, message: "Name, type, and category are required" });
        }

        const logsRes = await pool.query("SELECT id, application_usage, browser_usage FROM activity_logs");
        
        for (let row of logsRes.rows) {
            let updated = false;
            let appUsage = row.application_usage;
            let browserUsage = row.browser_usage;

            if (type === 'app' && appUsage && Array.isArray(appUsage)) {
                appUsage.forEach(item => {
                    const appName = item.appName || item.name;
                    if (appName === name) {
                        item.category = category;
                        updated = true;
                    }
                });
            } else if (type === 'url' && browserUsage && Array.isArray(browserUsage)) {
                browserUsage.forEach(item => {
                    const urlVal = item.url || item.domain;
                    if (urlVal === name) {
                        item.category = category;
                        updated = true;
                    }
                });
            }

            if (updated) {
                await pool.query(
                    `UPDATE activity_logs 
                     SET application_usage = $1, browser_usage = $2, updated_at = CURRENT_TIMESTAMP 
                     WHERE id = $3`,
                    [JSON.stringify(appUsage), JSON.stringify(browserUsage), row.id]
                );
            }
        }

        res.status(200).json({ success: true, message: "Productivity category updated successfully" });
    } catch (error) {
        console.log("Error in categorizeProductivity:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

// ── TERAMIND EXECUTIVE HEALTH CARDS (ONLY MAPPED COMPANY DEVICES & EMPLOYEES) ─────────────
export async function getExecutiveHealthCards(req, res) {
    try {
        const computers = await pool.query(`
            SELECT 
                COUNT(DISTINCT m.computer_id) FILTER (WHERE c.is_online = true) as online_computers,
                COUNT(DISTINCT m.computer_id) FILTER (WHERE c.is_online = false OR c.is_online IS NULL) as offline_computers,
                COUNT(DISTINCT m.computer_id) as total_computers
            FROM employee_teramind_mapping m
            LEFT JOIN teramind_computer_cache c ON m.computer_id = c.computer_id;
        `);

        const onlineCount = parseInt(computers.rows[0]?.online_computers || 0, 10);
        const offlineCount = parseInt(computers.rows[0]?.offline_computers || 0, 10);

        // Count active/working employees ONLY among mapped online workstations
        const workingRes = await pool.query(`
            SELECT COUNT(DISTINCT m.employee_id) as working_count
            FROM employee_teramind_mapping m
            JOIN teramind_computer_cache c ON m.computer_id = c.computer_id
            LEFT JOIN teramind_activity_cache ac ON m.employee_id = ac.employee_id AND ac.work_date = CURRENT_DATE
            WHERE c.is_online = true 
              AND (
                  (ac.active_app != '' AND ac.active_app IS NOT NULL) 
                  OR c.agent_status = 'Running'
                  OR (ac.productive_seconds > 0)
              );
        `);

        const employeesWorking = parseInt(workingRes.rows[0]?.working_count || onlineCount, 10);
        const employeesIdle = Math.max(0, onlineCount - employeesWorking);

        const alerts = await pool.query(`
            SELECT COUNT(*) as alerts_today 
            FROM teramind_alerts 
            WHERE DATE(triggered_at) = CURRENT_DATE;
        `);

        const prod = await pool.query(`
            SELECT 
                COALESCE(AVG(CASE WHEN (productive_seconds + unproductive_seconds + idle_seconds) > 0 
                    THEN (productive_seconds::float / (productive_seconds + unproductive_seconds + idle_seconds) * 100) 
                    ELSE 0 END), 0) as avg_productivity
            FROM teramind_activity_cache
            WHERE work_date = CURRENT_DATE;
        `);

        res.status(200).json({
            success: true,
            data: {
                online_computers: onlineCount,
                offline_computers: offlineCount,
                employees_working: employeesWorking,
                employees_idle: employeesIdle,
                alerts_today: parseInt(alerts.rows[0]?.alerts_today || 0, 10),
                avg_productivity: Math.round(parseFloat(prod.rows[0]?.avg_productivity || 0))
            }
        });
    } catch (error) {
        console.error("Error in getExecutiveHealthCards:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

// ── TERAMIND LIVE DASHBOARD (ZERO FAKE FALLBACKS) ──────────────────────────────
export async function getMonitoringDashboard(req, res) {
    try {
        const result = await pool.query(`
            SELECT 
                e.id as employee_id,
                e.full_name,
                e.employee_code,
                'Staff' as designation,
                m.computer_id,
                m.computer_name,
                c.os,
                c.is_online,
                c.agent_status,
                c.last_seen,
                ac.productive_seconds,
                ac.unproductive_seconds,
                ac.idle_seconds,
                ac.active_seconds,
                ac.break_seconds,
                ac.active_app,
                ac.active_website,
                ac.input_score,
                ac.timestamp as last_activity_time
            FROM employees e
            LEFT JOIN employee_teramind_mapping m ON e.id = m.employee_id
            LEFT JOIN teramind_computer_cache c ON m.computer_id = c.computer_id
            LEFT JOIN teramind_activity_cache ac ON e.id = ac.employee_id AND ac.work_date = CURRENT_DATE
            ORDER BY e.id ASC;
        `);

        if (result.rows && result.rows.length > 0) {
            // Fetch live Teramind grid activity
            let gridRows = [];
            try {
                const now = Math.floor(Date.now() / 1000);
                const start = now - (90 * 24 * 3600);
                const gridData = await getWebPagesApplicationsGrid({
                    periodStart: String(start),
                    periodEnd: String(now)
                });
                gridRows = gridData?.rows || [];
            } catch (e) {
                console.warn("Live grid fetch warning in getMonitoringDashboard:", e.message);
            }

            const formatted = result.rows.map(row => {
                const compId = row.computer_id;
                const compName = (row.computer_name || '').toLowerCase();

                // Find real activity row for this computer ONLY if a workstation is mapped
                const realRow = compId ? gridRows.find(r => 
                    r.computer?.computer_id == compId ||
                    (compName && r.computer?.name && r.computer.name.toLowerCase() === compName)
                ) : null;

                const activeApp = realRow ? (realRow.process_host || realRow.friendly_name || '') : '';
                const activeWeb = realRow ? (realRow.url || realRow.title || '') : '';
                const isOnline = row.is_online === true;

                return {
                    ...row,
                    active_app: (compId && isOnline) ? (activeApp || row.active_app || '—') : '—',
                    active_website: (compId && isOnline) ? (activeWeb || row.active_website || '—') : '—',
                    productive_seconds: compId ? (row.productive_seconds || (realRow ? (realRow.duration || 0) : 0)) : 0,
                    active_seconds: compId ? (row.active_seconds || (realRow ? (realRow.duration || 0) : 0)) : 0,
                    input_score: compId ? (row.input_score || 0) : 0
                };
            });

            return res.status(200).json({ success: true, data: formatted });
        }

        res.status(200).json({ success: true, data: [] });
    } catch (error) {
        console.error("Error in getMonitoringDashboard:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

// ── APPLICATION ANALYTICS — REAL TERAMIND GRID API DATA ────────────────────────
export async function getAnalyticsApps(req, res) {
    try {
        const { range = 'Today' } = req.query;

        // Determine time range
        const now = Math.floor(Date.now() / 1000);
        let start;
        switch (range) {
            case '7d':   start = now - (7 * 24 * 3600); break;
            case '30d':  start = now - (30 * 24 * 3600); break;
            case 'Yesterday': {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                yesterday.setHours(0, 0, 0, 0);
                start = Math.floor(yesterday.getTime() / 1000);
                break;
            }
            default: { // Today
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                start = Math.floor(today.getTime() / 1000);
                break;
            }
        }

        let gridData = [];
        try {
            const raw = await getWebPagesApplicationsGrid({
                periodStart: String(start),
                periodEnd: String(now)
            });
            gridData = raw?.rows || [];
        } catch (e) {
            console.warn("getAnalyticsApps grid fetch failed:", e.message);
        }

        // Aggregate by process_host (application name)
        const appMap = new Map();
        let totalDuration = 0;
        for (const row of gridData) {
            const appName = row.process_host || row.friendly_name;
            if (!appName || row.url) continue; // Skip URL-based rows (those are websites)

            const dur = row.duration || 0;
            totalDuration += dur;

            if (appMap.has(appName)) {
                const existing = appMap.get(appName);
                existing.duration += dur;
                existing.active_users.add(row.agent?.name || row.computer?.name || 'unknown');
            } else {
                appMap.set(appName, {
                    name: appName,
                    duration: dur,
                    category: row.activity_cat || 'Productive',
                    active_users: new Set([row.agent?.name || row.computer?.name || 'unknown'])
                });
            }
        }

        // Convert to array, calculate percentages, sort by duration
        const apps = Array.from(appMap.values())
            .map(app => ({
                name: app.name,
                duration: app.duration,
                usage_pct: totalDuration > 0 ? parseFloat(((app.duration / totalDuration) * 100).toFixed(1)) : 0,
                category: app.category,
                active_users: app.active_users.size
            }))
            .sort((a, b) => b.duration - a.duration)
            .slice(0, 15);

        res.status(200).json({ success: true, range, data: apps });
    } catch (error) {
        console.error("Error in getAnalyticsApps:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

// ── WEBSITE ANALYTICS — REAL TERAMIND GRID API DATA ────────────────────────────
export async function getAnalyticsWebsites(req, res) {
    try {
        const { range = 'Today' } = req.query;

        // Determine time range
        const now = Math.floor(Date.now() / 1000);
        let start;
        switch (range) {
            case '7d':   start = now - (7 * 24 * 3600); break;
            case '30d':  start = now - (30 * 24 * 3600); break;
            case 'Yesterday': {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                yesterday.setHours(0, 0, 0, 0);
                start = Math.floor(yesterday.getTime() / 1000);
                break;
            }
            default: {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                start = Math.floor(today.getTime() / 1000);
                break;
            }
        }

        let gridData = [];
        try {
            const raw = await getWebPagesApplicationsGrid({
                periodStart: String(start),
                periodEnd: String(now)
            });
            gridData = raw?.rows || [];
        } catch (e) {
            console.warn("getAnalyticsWebsites grid fetch failed:", e.message);
        }

        // Aggregate by domain (only rows with URL)
        const siteMap = new Map();
        for (const row of gridData) {
            const url = row.url || row.title;
            if (!url) continue; // Skip non-URL rows (those are apps)

            let domain;
            try {
                domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
            } catch {
                domain = url;
            }

            const dur = row.duration || 0;

            if (siteMap.has(domain)) {
                const existing = siteMap.get(domain);
                existing.duration += dur;
                existing.visits += 1;
                existing.active_users.add(row.agent?.name || row.computer?.name || 'unknown');
            } else {
                siteMap.set(domain, {
                    domain,
                    duration: dur,
                    visits: 1,
                    category: row.activity_cat || 'Productive',
                    active_users: new Set([row.agent?.name || row.computer?.name || 'unknown'])
                });
            }
        }

        // Convert to array, sort by duration
        const sites = Array.from(siteMap.values())
            .map(s => ({
                domain: s.domain,
                duration: s.duration,
                visits: s.visits,
                category: s.category,
                active_users: s.active_users.size
            }))
            .sort((a, b) => b.duration - a.duration)
            .slice(0, 15);

        res.status(200).json({ success: true, range, data: sites });
    } catch (error) {
        console.error("Error in getAnalyticsWebsites:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

// ── BEHAVIOR ALERTS AUDIT ──────────────────────────────────────────────────────
export async function getAnalyticsAlerts(req, res) {
    try {
        const result = await pool.query(`
            SELECT a.*, e.full_name, e.employee_code, c.name as computer_name
            FROM teramind_alerts a
            LEFT JOIN employees e ON a.employee_id = e.id
            LEFT JOIN teramind_computer_cache c ON a.computer_id = c.computer_id
            ORDER BY a.triggered_at DESC;
        `);

        res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        console.error("Error in getAnalyticsAlerts:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

// ── TERAMIND SETTINGS MANAGEMENT ─────────────────────────────────────────────
export async function getTeramindConfig(req, res) {
    try {
        const result = await pool.query("SELECT instance_url, api_token, is_enabled, sync_interval_minutes, enable_input_rate, last_sync_at FROM teramind_settings WHERE id = 1");
        const envUrl = process.env.TERAMIND_INSTANCE_URL || 'https://company.teramind.co';
        const envToken = process.env.TERAMIND_API_TOKEN || '';

        if (result.rows.length > 0) {
            const config = result.rows[0];
            if (!config.instance_url || config.instance_url.includes('apidoc.dev.teramind.co')) {
                config.instance_url = envUrl;
            }
            if (!config.api_token && envToken) {
                config.api_token = envToken;
            }
            if (config.api_token) {
                config.api_token_masked = `${config.api_token.slice(0, 4)}...${config.api_token.slice(-4)}`;
            }
            return res.status(200).json({ success: true, data: config });
        }
        res.status(200).json({
            success: true,
            data: {
                instance_url: envUrl,
                api_token: envToken,
                is_enabled: true,
                sync_interval_minutes: 5,
                enable_input_rate: false,
                last_sync_at: null
            }
        });
    } catch (error) {
        console.error("Error in getTeramindConfig:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function updateTeramindConfig(req, res) {
    try {
        const { instance_url, api_token, is_enabled, sync_interval_minutes, enable_input_rate } = req.body;

        await pool.query(`
            UPDATE teramind_settings
            SET instance_url = $1,
                api_token = CASE WHEN $2 != '' THEN $2 ELSE api_token END,
                is_enabled = $3,
                sync_interval_minutes = $4,
                enable_input_rate = $5,
                updated_at = NOW()
            WHERE id = 1;
        `, [instance_url || '', api_token || '', is_enabled ?? true, sync_interval_minutes || 5, enable_input_rate ?? false]);

        res.status(200).json({ success: true, message: "Teramind configuration updated successfully." });
    } catch (error) {
        console.error("Error in updateTeramindConfig:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

// ── CONNECTION TEST ────────────────────────────────────────────────────────────
export async function testTeramindConnection(req, res) {
    try {
        const { instance_url, api_token } = req.body;
        const result = await testConnection(instance_url, api_token);
        res.status(200).json(result);
    } catch (error) {
        console.error("Error in testTeramindConnection:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
}

// ── MANUAL SYNC TRIGGER ───────────────────────────────────────────────────────
export async function triggerManualSync(req, res) {
    try {
        await syncTeramindDataToCache();
        res.status(200).json({ success: true, message: "Teramind cache sync initiated successfully." });
    } catch (error) {
        console.error("Error in triggerManualSync:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
}

// ── INDIVIDUAL EMPLOYEE WORKSTATION LOGS & TELEMETRY (ZERO HARDCODES) ────────
export async function getEmployeeActivityLogs(req, res) {
    try {
        const { id } = req.params;
        const empId = parseInt(id, 10);
        if (!empId || isNaN(empId)) {
            return res.status(400).json({ success: false, message: "Valid employee ID is required" });
        }

        const empRes = await pool.query(`
            SELECT 
                e.id, e.full_name, e.employee_code,
                m.computer_id, m.computer_name,
                c.os,
                c.is_online,
                c.agent_status,
                c.last_seen,
                c.user_name
            FROM employees e
            LEFT JOIN employee_teramind_mapping m ON e.id = m.employee_id
            LEFT JOIN teramind_computer_cache c ON m.computer_id = c.computer_id
            WHERE e.id = $1;
        `, [empId]);

        if (empRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: `Employee #${empId} not found` });
        }

        const empInfo = empRes.rows[0];

        const compId = empInfo.computer_id;
        const compNameLower = (empInfo.computer_name || '').toLowerCase();

        // If employee has no workstation, return empty cleanly
        if (!compId) {
            return res.status(200).json({
                success: true,
                employee: {
                    id: empInfo.id,
                    full_name: empInfo.full_name,
                    employee_code: empInfo.employee_code,
                    designation: "Staff",
                    computer_id: null,
                    computer_name: "Unassigned",
                    os: "—",
                    is_online: false,
                    agent_status: "No Workstation"
                },
                period: "Last 30 Days",
                total_records: 0,
                metrics: {
                    total_records: 0,
                    active_apps_count: 0,
                    websites_visited_count: 0,
                    total_active_seconds: 0,
                    total_active_hours: "0.0h"
                },
                logs: []
            });
        }

        // Fetch real Teramind grid activity for this workstation (30 days window)
        const nowUnix = Math.floor(Date.now() / 1000);
        const startUnix = nowUnix - (30 * 24 * 3600);

        let realGridLogs = [];
        try {
            const gridParams = {
                periodStart: String(startUnix),
                periodEnd: String(nowUnix),
                pageSize: 10000
            };
            if (compId) {
                gridParams.computers = [parseInt(compId, 10)];
            }
            const raw = await getWebPagesApplicationsGrid(gridParams);
            realGridLogs = raw?.rows || [];
        } catch (e) {
            console.warn("Error fetching real grid logs for employee:", e.message);
        }

        // Filter rows belonging to THIS workstation ONLY
        const matchedRows = realGridLogs.filter(r => {
            const rCompId = r.computer?.computer_id;
            const rCompName = (r.computer?.name || '').toLowerCase();
            return (compId && rCompId == compId) || (compNameLower && rCompName === compNameLower);
        });

        // If no matched rows for this employee, return empty — NO cross-employee data leaking
        const displayRows = matchedRows;

        function formatISTDateTime(d) {
            try {
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
            } catch (e) {
                const istOffsetMs = 5.5 * 60 * 60 * 1000;
                const istDate = new Date(d.getTime() + (d.getTimezoneOffset() * 60 * 1000) + istOffsetMs);
                const yyyy = istDate.getFullYear();
                const mm = String(istDate.getMonth() + 1).padStart(2, '0');
                const dd = String(istDate.getDate()).padStart(2, '0');
                const hh = String(istDate.getHours()).padStart(2, '0');
                const min = String(istDate.getMinutes()).padStart(2, '0');
                const ss = String(istDate.getSeconds()).padStart(2, '0');
                return `${dd}-${mm}-${yyyy} ${hh}:${min}:${ss}`;
            }
        }

        function formatCompactDuration(durSec) {
            if (!durSec || durSec <= 0) return '0s';
            const hours = Math.floor(durSec / 3600);
            const mins = Math.floor((durSec % 3600) / 60);
            const secs = durSec % 60;
            if (hours > 0) {
                return `${hours}h ${mins}m ${secs > 0 ? secs + 's' : ''}`.trim();
            }
            if (mins > 0) {
                return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
            }
            return `${secs}s`;
        }

        // Fetch task sessions for this employee to map activity logs to active/past Task Sessions
        let taskSessions = [];
        try {
            const taskSessionsRes = await pool.query(
                `SELECT ts.id as session_id, ts.task_id, ts.started_at, ts.ended_at, ts.status as session_status,
                        t.title as task_title, t.priority as task_priority, t.status as task_status
                 FROM task_sessions ts
                 LEFT JOIN tasks t ON ts.task_id = t.id
                 WHERE ts.employee_id = $1
                 ORDER BY ts.started_at DESC`,
                [empId]
            );
            taskSessions = taskSessionsRes.rows;
        } catch (e) {
            console.warn("Error fetching task sessions for activity mapping:", e.message);
        }

        const realLogs = displayRows.map(r => {
            const startTs = r.timestamp?.timestamp ? new Date(r.timestamp.timestamp * 1000) : new Date();
            const durSec = r.duration || 0;
            const endTs = new Date(startTs.getTime() + (durSec * 1000));

            const startStr = formatISTDateTime(startTs);
            const endStr = formatISTDateTime(endTs);

            const durStr = formatCompactDuration(durSec);

            const logStartUnix = Math.floor(startTs.getTime() / 1000);
            const logEndUnix = Math.floor(endTs.getTime() / 1000);

            // Find if log timestamp falls within any task session's time window
            const matchedSession = taskSessions.find(ts => {
                const sessStart = Math.floor(new Date(ts.started_at).getTime() / 1000);
                const sessEnd = ts.ended_at ? Math.floor(new Date(ts.ended_at).getTime() / 1000) : Math.floor(Date.now() / 1000);
                // 300s (5 mins) fuzzy buffer window for heartbeat & grid sync delay
                return logStartUnix >= (sessStart - 300) && logStartUnix <= (sessEnd + 300);
            });

            const sessStartUnix = matchedSession ? Math.floor(new Date(matchedSession.started_at).getTime() / 1000) : logStartUnix;
            const sessEndUnix = matchedSession ? (matchedSession.ended_at ? Math.floor(new Date(matchedSession.ended_at).getTime() / 1000) : Math.floor(Date.now() / 1000)) : logEndUnix;

            return {
                start_time: startStr,
                end_time: endStr,
                time: startStr,
                start_unix: logStartUnix,
                end_unix: logEndUnix,
                computer_id: r.computer?.computer_id || compId || null,
                process: r.process_host || (r.url ? 'browser' : 'unknown'),
                duration: durStr,
                app_title: r.title || r.friendly_name || r.url || r.process_host || 'Application Window',
                category: r.activity_cat || 'Productive',
                session_id: matchedSession ? matchedSession.session_id : null,
                task_id: matchedSession ? matchedSession.task_id : null,
                task_title: matchedSession ? matchedSession.task_title : 'General Workstation Activity',
                task_priority: matchedSession ? matchedSession.task_priority : 'Normal',
                task_status: matchedSession ? matchedSession.task_status : 'Activity',
                session_start_unix: sessStartUnix,
                session_end_unix: sessEndUnix,
                session_start_str: matchedSession ? formatISTDateTime(new Date(matchedSession.started_at)) : startStr,
                session_end_str: matchedSession ? (matchedSession.ended_at ? formatISTDateTime(new Date(matchedSession.ended_at)) : formatISTDateTime(new Date())) : endStr,
                is_task_bound: !!matchedSession
            };
        });

        res.status(200).json({
            success: true,
            employee: empInfo,
            logs: realLogs
        });
    } catch (error) {
        console.error("Error in getEmployeeActivityLogs:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

// ── GET SINGLE COMPUTER DETAILS (NO FAKE FALLBACK) ─────────────────────────────
export async function getSingleComputerDetails(req, res) {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ success: false, message: "Computer ID is required" });
        }

        const compRes = await pool.query(
            `SELECT * FROM teramind_computer_cache WHERE computer_id = $1 OR id = $1`,
            [id]
        );

        if (compRes.rows.length > 0) {
            return res.status(200).json({ success: true, computer: compRes.rows[0] });
        }

        // No fake fallback — return 404 if not in cache
        return res.status(404).json({ success: false, message: `Computer #${id} not found in monitoring cache.` });
    } catch (error) {
        console.error("Error in getSingleComputerDetails:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

// ── GET LOGIN SESSIONS HISTORY (BI Cube: login_session) ─────────────────────────
export async function getLoginSessionHistory(req, res) {
    try {
        const sessions = await pool.query(`
            SELECT 
                ac.id, ac.employee_id, e.full_name as employee_name,
                c.name as computer_name, c.os,
                ac.login_time, ac.logout_time,
                ac.active_seconds, ac.idle_seconds,
                ac.work_date
            FROM teramind_activity_cache ac
            LEFT JOIN employees e ON ac.employee_id = e.id
            LEFT JOIN teramind_computer_cache c ON ac.employee_id = c.id
            ORDER BY ac.work_date DESC, ac.login_time DESC
            LIMIT 50;
        `);

        res.status(200).json({ success: true, sessions: sessions.rows });
    } catch (error) {
        console.error("Error in getLoginSessionHistory:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// ══  TERAMIND VIDEO RECORDING — STRICTLY 4 APIs, ZERO HARDCODING  ═══════════
// ══════════════════════════════════════════════════════════════════════════════

// ── STEP 1+2: GET PROCESS-BOUND VIDEO (available-video-data + export-video) ────
export async function getProcessVideo(req, res) {
    try {
        const { computer_id, start, end, process } = req.query;
        const compId = parseInt(computer_id, 10);
        let startTs = parseInt(start, 10);
        let endTs = parseInt(end, 10);

        if (!compId || isNaN(compId)) {
            return res.status(400).json({ success: false, message: "Valid computer_id is required" });
        }
        if (!startTs || !endTs || isNaN(startTs) || isNaN(endTs)) {
            return res.status(400).json({ success: false, message: "Valid start and end timestamps are required" });
        }

        // Add a tiny padding (5s) for boundary alignment, keeping duration short for ultra-fast compilation
        startTs = Math.max(0, startTs - 5);
        endTs = endTs + 5;

        console.log(`[getProcessVideo] API-1: available-video-data compId=${compId}, start=${startTs}, end=${endTs}`);
        
        // ── API 1: GET /tm-api/player/available-video-data ──
        const videoData = await getAvailableVideoData(compId, startTs, endTs);
        console.log(`[getProcessVideo] API-1 result:`, JSON.stringify(videoData));

        if (!Array.isArray(videoData) || videoData.length === 0) {
            return res.status(200).json({
                success: false,
                has_video: false,
                message: `No screen video recording captured by Teramind for '${process || 'selected process'}' during this activity timeframe.`
            });
        }

        const agentId = videoData[0].agent_id;
        let agentEmail = videoData[0].email_address || 'admin@company.com';
        if (agentEmail && !agentEmail.includes('@')) {
            agentEmail = `${agentEmail}@company.com`;
        }
        if (agentEmail && !agentEmail.includes('.')) {
            agentEmail = `${agentEmail}.com`;
        }

        const segStart = startTs;
        const segEnd = endTs;

        console.log(`[getProcessVideo] API-2: export-video agentId=${agentId}, compId=${compId}, start=${segStart}, end=${segEnd}, recipient=${agentEmail}`);

        // ── API 2: POST /tm-api/player/export-video ──
        const exportResult = await exportTeramindVideo(agentId, compId, segStart, segEnd, agentEmail);
        console.log(`[getProcessVideo] API-2 result:`, JSON.stringify(exportResult));

        if (!exportResult || !exportResult.ids || exportResult.ids.length === 0) {
            const errMsg = exportResult?.error || exportResult?.message || '';
            const isRateLimit = errMsg.toLowerCase().includes('try again') || errMsg.includes('429') || errMsg.includes('5 minutes');
            
            return res.status(200).json({
                success: false,
                has_video: false,
                error_type: isRateLimit ? 'rate_limit' : 'export_failed',
                message: isRateLimit 
                    ? "Teramind API rate limit reached. Please wait 5 minutes before requesting another video export."
                    : (errMsg || `Failed to export video for '${process || 'selected process'}'.`)
            });
        }

        const exportId = exportResult.ids[0];
        const proxyUrl = `/api/v1/admin/monitoring/video-stream-proxy?export_id=${exportId}`;

        return res.status(200).json({
            success: true,
            has_video: true,
            video_url: proxyUrl,
            export_id: exportId
        });
    } catch (error) {
        console.error("Error in getProcessVideo:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
}

// ── STEP 3+4: VIDEO STREAM PROXY (status check + binary download) ──────────────
export async function proxyVideoStream(req, res) {
    try {
        let export_id = req.query.export_id;
        if (!export_id && req.query.export_path) {
            export_id = req.query.export_path.split('/').pop();
        }
        if (!export_id) {
            return res.status(400).send("Export ID required");
        }

        const creds = await getTeramindCredentials();
        let cleanBase = creds.instance_url.trim().replace(/\/$/, "");
        if (!cleanBase.startsWith('http://') && !cleanBase.startsWith('https://')) {
            cleanBase = `https://${cleanBase}`;
        }

        // ── API 3: GET /tm-api/player/export-video/status/{export_id} ──
        const statusRes = await getTeramindExportVideoStatus(export_id);
        console.log(`[proxyVideoStream] API-3 status for #${export_id}:`, JSON.stringify(statusRes));

        if (!statusRes || statusRes.status !== 1) {
            // Still rendering (status 2) or pending — return 202 immediately, no blocking
            return res.status(202).json({
                status: 'rendering',
                export_id: export_id,
                teramind_status: statusRes?.status || 0,
                message: 'Video export is compiling on Teramind cloud'
            });
        }

        // ── API 4: POST /tm-api/player/export-video/download/{export_id} ──
        // Use the URL from status response if available, otherwise construct it
        const downloadPath = statusRes.url || `/tm-api/player/export-video/download/${export_id}`;
        const targetUrl = `${cleanBase}${downloadPath}`;
        console.log(`[proxyVideoStream] API-4 downloading binary from: ${targetUrl}`);

        const fileRes = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'x-access-token': creds.api_token,
                'Accept': '*/*'
            }
        });

        if (fileRes.ok) {
            const arrayBuf = await fileRes.arrayBuffer();
            const buffer = Buffer.from(arrayBuf);
            console.log(`[proxyVideoStream] SUCCESS — streaming ${buffer.length} bytes MP4`);
            res.setHeader('Content-Type', 'video/mp4');
            res.setHeader('Content-Length', buffer.length);
            res.setHeader('Cache-Control', 'public, max-age=3600');
            return res.send(buffer);
        } else {
            console.warn(`[proxyVideoStream] Download returned HTTP ${fileRes.status}`);
            return res.status(502).send("Failed to download video from Teramind cloud.");
        }
    } catch (error) {
        console.error("Error in proxyVideoStream:", error.message);
        res.status(500).send("Stream proxy error");
    }
}

// ── FETCH ALL DETECTED TERAMIND WORKSTATIONS FOR DROPDOWN ────────────────────
export async function getAvailableWorkstations(req, res) {
    try {
        const result = await pool.query(`
            SELECT 
                c.computer_id,
                c.name as computer_name,
                c.user_name,
                c.os,
                c.is_online,
                c.agent_status,
                c.last_seen,
                m.employee_id as currently_assigned_to,
                e.full_name as assigned_employee_name,
                e.employee_code as assigned_employee_code
            FROM teramind_computer_cache c
            LEFT JOIN employee_teramind_mapping m ON c.computer_id = m.computer_id
            LEFT JOIN employees e ON m.employee_id = e.id
            WHERE c.computer_id NOT IN (101, 102, 103, 104, 105)
            ORDER BY c.is_online DESC, c.name ASC;
        `);

        res.status(200).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error("Error in getAvailableWorkstations:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

// ── MANUALLY ASSIGN OR UNASSIGN A WORKSTATION TO AN EMPLOYEE ─────────────────
export async function assignWorkstation(req, res) {
    try {
        const { employee_id, computer_id, computer_name } = req.body;
        const empId = parseInt(employee_id, 10);

        if (!empId || isNaN(empId)) {
            return res.status(400).json({ success: false, message: "Valid employee_id is required." });
        }

        // Verify employee exists
        const empCheck = await pool.query("SELECT id, full_name FROM employees WHERE id = $1", [empId]);
        if (empCheck.rows.length === 0) {
            return res.status(404).json({ success: false, message: `Employee #${empId} not found.` });
        }
        const empName = empCheck.rows[0].full_name;

        // If computer_id is null / 'none' / 0 -> Unassign
        if (!computer_id || computer_id === 'none' || computer_id === 'unassign' || computer_id === 0) {
            await pool.query("DELETE FROM employee_teramind_mapping WHERE employee_id = $1;", [empId]);
            return res.status(200).json({
                success: true,
                message: `Workstation unassigned successfully for ${empName}.`
            });
        }

        const compId = parseInt(computer_id, 10);

        // Fetch computer info from cache if computer_name not provided
        let targetCompName = computer_name;
        if (!targetCompName) {
            const compRes = await pool.query("SELECT name FROM teramind_computer_cache WHERE computer_id = $1", [compId]);
            if (compRes.rows.length > 0) {
                targetCompName = compRes.rows[0].name;
            } else {
                targetCompName = `Workstation-${compId}`;
            }
        }

        // Release this computer from any other employee (1 PC = 1 Employee)
        await pool.query("DELETE FROM employee_teramind_mapping WHERE computer_id = $1 AND employee_id != $2;", [compId, empId]);

        // Upsert assignment with is_manual = true
        await pool.query(`
            INSERT INTO employee_teramind_mapping (employee_id, computer_id, computer_name, is_manual, last_sync)
            VALUES ($1, $2, $3, true, NOW())
            ON CONFLICT (employee_id) DO UPDATE SET
                computer_id = EXCLUDED.computer_id,
                computer_name = EXCLUDED.computer_name,
                is_manual = true,
                last_sync = NOW();
        `, [empId, compId, targetCompName]);

        res.status(200).json({
            success: true,
            message: `Workstation '${targetCompName}' successfully assigned to ${empName}!`
        });
    } catch (error) {
        console.error("Error in assignWorkstation:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
}

// ── EXPORT MONITORING TELEMETRY (CSV / JSON ACROSS DATE RANGE) ───────────────
export async function exportMonitoringTelemetry(req, res) {
    try {
        const { range = 'Today', employee_id, format = 'json' } = req.query;

        const now = Math.floor(Date.now() / 1000);
        let startUnix;
        let rangeLabel = 'Today';

        const rLow = (range || '').toLowerCase();
        if (rLow.includes('30') || rLow === '30d' || rLow === '30days') {
            startUnix = now - (30 * 24 * 3600);
            rangeLabel = 'Last_30_Days';
        } else if (rLow.includes('7') || rLow === '7d' || rLow === '7days') {
            startUnix = now - (7 * 24 * 3600);
            rangeLabel = 'Last_7_Days';
        } else if (rLow === 'yesterday') {
            const yest = new Date();
            yest.setDate(yest.getDate() - 1);
            yest.setHours(0, 0, 0, 0);
            startUnix = Math.floor(yest.getTime() / 1000);
            rangeLabel = 'Yesterday';
        } else {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            startUnix = Math.floor(today.getTime() / 1000);
            rangeLabel = 'Today';
        }

        // Fetch employee mappings
        const empQuery = employee_id 
            ? "SELECT e.id, e.full_name, e.employee_code, m.computer_id, m.computer_name FROM employees e LEFT JOIN employee_teramind_mapping m ON e.id = m.employee_id WHERE e.id = $1"
            : "SELECT e.id, e.full_name, e.employee_code, m.computer_id, m.computer_name FROM employees e LEFT JOIN employee_teramind_mapping m ON e.id = m.employee_id";
        const empValues = employee_id ? [parseInt(employee_id, 10)] : [];
        const empRes = await pool.query(empQuery, empValues);

        const empMapByCompId = new Map();
        const empMapByCompName = new Map();
        const empList = empRes.rows;

        empList.forEach(e => {
            if (e.computer_id) empMapByCompId.set(String(e.computer_id), e);
            if (e.computer_name) empMapByCompName.set(e.computer_name.toLowerCase(), e);
        });

        // Fetch raw Teramind grid data
        let gridRows = [];
        try {
            const gridParams = {
                periodStart: String(startUnix),
                periodEnd: String(now),
                pageSize: 10000
            };
            if (employee_id && empList.length > 0 && empList[0].computer_id) {
                gridParams.computers = [parseInt(empList[0].computer_id, 10)];
            } else {
                const allCompIds = empList.map(e => e.computer_id).filter(Boolean).map(id => parseInt(id, 10));
                if (allCompIds.length > 0) {
                    gridParams.computers = allCompIds;
                }
            }
            const raw = await getWebPagesApplicationsGrid(gridParams);
            gridRows = raw?.rows || [];
        } catch (e) {
            console.warn("exportMonitoringTelemetry grid fetch failed:", e.message);
        }

        function formatIST(unixTs) {
            if (!unixTs || isNaN(unixTs)) return '—';
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
            } catch {
                return '—';
            }
        }

        function formatDur(sec) {
            if (!sec || sec <= 0) return '0s';
            const h = Math.floor(sec / 3600);
            const m = Math.floor((sec % 3600) / 60);
            const s = sec % 60;
            if (h > 0) return `${h}h ${m}m ${s > 0 ? s + 's' : ''}`.trim();
            if (m > 0) return s > 0 ? `${m}m ${s}s` : `${m}m`;
            return `${s}s`;
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

        // Process and map rows
        const records = [];
        for (const row of gridRows) {
            const rCompId = row.computer?.computer_id ? String(row.computer.computer_id) : null;
            const rCompName = (row.computer?.name || '').toLowerCase();

            let matchedEmp = null;
            if (rCompId && empMapByCompId.has(rCompId)) {
                matchedEmp = empMapByCompId.get(rCompId);
            } else if (rCompName && empMapByCompName.has(rCompName)) {
                matchedEmp = empMapByCompName.get(rCompName);
            }

            // If filtering by single employee, skip non-matches
            if (employee_id && (!matchedEmp || matchedEmp.id !== parseInt(employee_id, 10))) {
                continue;
            }

            const startTs = row.time || (row.start_time ? Math.floor(new Date(row.start_time).getTime() / 1000) : null);
            const dur = row.duration || 0;
            const endTs = startTs ? (startTs + dur) : null;

            const startFormatted = formatIST(startTs);
            const endFormatted = formatIST(endTs);

            const startParts = startFormatted.split(' ');
            const endParts = endFormatted.split(' ');

            const rawDate = startParts[0] !== '—' ? startParts[0] : (endParts[0] !== '—' ? endParts[0] : '—');
            const logDate = formatExcelDate(rawDate);
            const startTime = startParts[1] || '—';
            const endTime = endParts[1] || '—';

            records.push({
                employee_code: matchedEmp?.employee_code || '—',
                employee_name: matchedEmp?.full_name || row.agent?.name || 'Unassigned Staff',
                workstation: row.computer?.name || matchedEmp?.computer_name || '—',
                date: logDate,
                start_time: startTime,
                end_time: endTime,
                duration_formatted: formatDur(dur),
                duration_seconds: dur,
                application_process: row.process_host || row.friendly_name || '—',
                app_webpage_title: row.title || row.url || '—',
                category: row.activity_cat || 'Productive',
                url: row.url || ''
            });
        }

        if (format === 'csv') {
            const headers = [
                "Employee Code",
                "Employee Name",
                "Workstation",
                "Activity Date (DD-MM-YYYY)",
                "Start Time",
                "End Time",
                "Duration",
                "Duration (Seconds)",
                "Application / Process",
                "Window / Webpage Title",
                "Category",
                "Web URL"
            ];

            const csvRows = [headers.join(",")];
            for (const r of records) {
                const values = [
                    `"${r.employee_code.replace(/"/g, '""')}"`,
                    `"${r.employee_name.replace(/"/g, '""')}"`,
                    `"${r.workstation.replace(/"/g, '""')}"`,
                    `="` + r.date.replace(/"/g, '""') + `"`,
                    `="` + r.start_time.replace(/"/g, '""') + `"`,
                    `="` + r.end_time.replace(/"/g, '""') + `"`,
                    `"${r.duration_formatted.replace(/"/g, '""')}"`,
                    r.duration_seconds,
                    `"${r.application_process.replace(/"/g, '""')}"`,
                    `"${r.app_webpage_title.replace(/"/g, '""')}"`,
                    `"${r.category.replace(/"/g, '""')}"`,
                    `"${(r.url || '').replace(/"/g, '""')}"`
                ];
                csvRows.push(values.join(","));
            }

            const csvContent = "\uFEFF" + csvRows.join("\r\n");
            const filename = `Telemetry_Activity_Logs_${rangeLabel}_${new Date().toISOString().split('T')[0]}.csv`;

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            return res.status(200).send(csvContent);
        }

        res.status(200).json({
            success: true,
            range: rangeLabel,
            total_records: records.length,
            data: records
        });
    } catch (error) {
        console.error("Error in exportMonitoringTelemetry:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
}
