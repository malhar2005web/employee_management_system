import { pool } from '../config/db.js';

// ── STRICT PRIVACY WHITELIST ──────────────────────────────────────────────────
// Allowed BI Cubes and Endpoints only.
const PERMITTED_CUBES = new Set([
    'computer',
    'activity',
    'login_session',
    'work_time',
    'behavior_alert',
    'input_rate'
]);

const RESTRICTED_CUBES = new Set([
    'keystrokes',
    'file_event',
    'web_file_event',
    'console_cmd',
    'emails',
    'printed_doc',
    'social_media'
]);

export function validateCubeWhitelist(cubeName) {
    if (RESTRICTED_CUBES.has(cubeName?.toLowerCase())) {
        throw new Error(`[Privacy Shield] Access to restricted cube '${cubeName}' is strictly prohibited.`);
    }
    if (!PERMITTED_CUBES.has(cubeName?.toLowerCase())) {
        throw new Error(`[Privacy Shield] Cube '${cubeName}' is not in the permitted list.`);
    }
    return true;
}

// Helper to fetch Teramind credentials from DB / env
export async function getTeramindCredentials() {
    try {
        const res = await pool.query("SELECT instance_url, api_token, is_enabled, enable_input_rate FROM teramind_settings WHERE id = 1");
        if (res.rows.length > 0) {
            const row = res.rows[0];
            return {
                instance_url: row.instance_url || process.env.TERAMIND_INSTANCE_URL || 'https://company.teramind.co',
                api_token: row.api_token || process.env.TERAMIND_API_TOKEN || '',
                is_enabled: row.is_enabled !== undefined ? row.is_enabled : true,
                enable_input_rate: row.enable_input_rate || false
            };
        }
    } catch (e) {
        console.error("Error reading teramind settings:", e.message);
    }
    return {
        instance_url: process.env.TERAMIND_INSTANCE_URL || 'https://company.teramind.co',
        api_token: process.env.TERAMIND_API_TOKEN || '',
        is_enabled: true,
        enable_input_rate: false
    };
}

// ── CORE REST API HTTP CALLER ─────────────────────────────────────────────────
async function callTeramindApi(endpoint, method = 'GET', body = null) {
    const creds = await getTeramindCredentials();

    if (!creds.instance_url || !creds.api_token) {
        // Fallback to mock data if credentials are not configured yet
        return getMockResponse(endpoint, body);
    }

    let cleanBase = creds.instance_url.trim().replace(/\/$/, "");
    if (!cleanBase.startsWith('http://') && !cleanBase.startsWith('https://')) {
        cleanBase = `https://${cleanBase}`;
    }
    const cleanPath = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const url = `${cleanBase}${cleanPath}`;

    const headers = {
        'x-access-token': creds.api_token,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };

    const options = {
        method,
        headers,
        signal: AbortSignal.timeout(10000)
    };

    if (body && method !== 'GET') {
        if (cleanPath === '/tm-api/reports' && !body.name) {
            body.name = `EMS Auto ${body.cube ? body.cube.toUpperCase() : 'Telemetry'} Report`;
        }
        options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Teramind API Error] HTTP ${response.status} ${response.statusText} for ${url}:`, errorText);
        throw new Error(`Teramind API error ${response.status}: ${response.statusText} - ${errorText}`);
    }

    return await response.json();
}

// ── FUTURE-PROOF API WRAPPERS (STRICT BI CUBE QUERY VALIDATION) ──────────────

// 1. Get Computers List (GET /tm-api/computer)
export async function getComputers() {
    try {
        return await callTeramindApi('/tm-api/computer', 'GET');
    } catch (e) {
        console.warn("Teramind live getComputers failed, using fallback:", e.message);
        return getMockComputers();
    }
}

// 1.1 Get Computers Grid (POST /tm-api/report/computers/grid)
export async function getComputersGrid(viewMode = 1) {
    try {
        const resp = await callTeramindApi('/tm-api/report/computers/grid', 'POST', { viewMode });
        return resp?.rows || [];
    } catch (e) {
        console.warn("Teramind live getComputersGrid failed:", e.message);
        return [];
    }
}

// 1.2 Get Web Pages Applications Grid (POST /tm-api/report/web-pages-applications/grid)
export async function getWebPagesApplicationsGrid(params = {}) {
    try {
        return await callTeramindApi('/tm-api/report/web-pages-applications/grid', 'POST', { viewMode: 1, pageSize: 5000, ...params });
    } catch (e) {
        console.warn("Teramind live getWebPagesApplicationsGrid failed:", e.message);
        return [];
    }
}

// 1.3 Get Sessions Grid (POST /tm-api/report/sessions/grid)
export async function getSessionsGrid(params = {}) {
    try {
        return await callTeramindApi('/tm-api/report/sessions/grid', 'POST', { viewMode: 1, ...params });
    } catch (e) {
        console.warn("Teramind live getSessionsGrid failed:", e.message);
        return [];
    }
}

// 1.4 Get Net Connections Grid (POST /tm-api/report/net-connections/grid)
export async function getNetConnectionsGrid(params = {}) {
    try {
        return await callTeramindApi('/tm-api/report/net-connections/grid', 'POST', { viewMode: 1, ...params });
    } catch (e) {
        console.warn("Teramind live getNetConnectionsGrid failed:", e.message);
        return [];
    }
}

// 1.5 Get Available Video Data (GET /tm-api/player/available-video-data)
export async function getAvailableVideoData(computerId, startTs, endTs) {
    if (!computerId) throw new Error("Computer ID is required");
    try {
        const queryParams = new URLSearchParams({
            computer: String(computerId),
            start: String(startTs),
            end: String(endTs)
        }).toString();
        return await callTeramindApi(`/tm-api/player/available-video-data?${queryParams}`, 'GET');
    } catch (e) {
        console.warn(`Teramind getAvailableVideoData(${computerId}) failed:`, e.message);
        return [];
    }
}

// 1.6 Get Teramind Player Settings & Permissions (GET /tm-api/player/settings)
export async function getTeramindPlayerSettings(agentId, computerId) {
    if (!agentId || !computerId) return { allow_view_video_export: false };
    try {
        const queryParams = new URLSearchParams({
            agent_id: String(agentId),
            computer_id: String(computerId)
        }).toString();
        return await callTeramindApi(`/tm-api/player/settings?${queryParams}`, 'GET');
    } catch (e) {
        console.warn(`Teramind getTeramindPlayerSettings failed:`, e.message);
        return { success: false, allow_view_video_export: false };
    }
}

// 1.7 Export Teramind Video Recording Stream (POST /tm-api/player/export-video)
// NOTE: Teramind cloud takes 5-10+ minutes to render large clips (>120s) at high frameRate.
// Capping to max 60s clips at frameRate 5 ensures rendering completes in ~20-30 seconds.
export async function exportTeramindVideo(agentId, computerId, startTs, endTs, recipientEmail = "admin@company.com") {
    if (!agentId || !computerId) return { success: false, message: "Agent ID and Computer ID are required" };
    try {
        const cleanEmail = (recipientEmail && recipientEmail.includes('@') && recipientEmail.includes('.')) 
            ? recipientEmail 
            : "admin@company.com";

        let start = parseInt(startTs, 10);
        let end = parseInt(endTs, 10);

        // Cap clip duration to max 60 seconds to avoid Teramind cloud rendering timeout
        const maxClipDuration = 60;
        if ((end - start) > maxClipDuration) {
            end = start + maxClipDuration;
        }

        // Use low frameRate (5fps) for fast cloud compilation (~20-30s)
        // 30fps causes Teramind cloud to take 5-10+ minutes rendering
        return await callTeramindApi('/tm-api/player/export-video', 'POST', {
            agents: Array.isArray(agentId) ? agentId.map(id => parseInt(id, 10)) : [parseInt(agentId, 10)],
            computer: parseInt(computerId, 10),
            start: start,
            end: end,
            speed: 1,
            frameRate: 2,
            recipient: cleanEmail,
            soundDisabled: true
        });
    } catch (e) {
        console.warn(`Teramind exportTeramindVideo failed:`, e.message);
        return { success: false, message: e.message };
    }
}

// 1.8 Get Teramind Video Export Status (GET /tm-api/player/export-video/status/{id})
export async function getTeramindExportVideoStatus(exportId) {
    if (!exportId) return { status: 0, message: "Export ID is required" };
    try {
        return await callTeramindApi(`/tm-api/player/export-video/status/${exportId}`, 'GET');
    } catch (e) {
        console.warn(`Teramind getTeramindExportVideoStatus(${exportId}) failed:`, e.message);
        return { status: 0, error: e.message };
    }
}

// 1.9 Fetch Raw Teramind Video Stream Buffer via 4-Stage Workflow
export async function getTeramindVideoStreamBuffer(computerId, startTs, endTs) {
    const creds = await getTeramindCredentials();
    if (!creds.instance_url || !creds.api_token) {
        return null;
    }

    const available = await getAvailableVideoData(computerId, startTs, endTs);
    if (!Array.isArray(available) || available.length === 0) {
        return null;
    }

    const agentId = available[0].agent_id || 39;

    const exportResult = await exportTeramindVideo(agentId, computerId, startTs, endTs, "admin@example.com");
    if (!exportResult || !exportResult.ids || exportResult.ids.length === 0) {
        return null;
    }

    const exportId = exportResult.ids[0];
    let cleanBase = creds.instance_url.trim().replace(/\/$/, "");
    if (!cleanBase.startsWith('http://') && !cleanBase.startsWith('https://')) {
        cleanBase = `https://${cleanBase}`;
    }

    // Poll status for video render completion (status 1 = Finished) up to 25 seconds
    for (let i = 0; i < 25; i++) {
        const statusRes = await getTeramindExportVideoStatus(exportId);
        if (statusRes && statusRes.status === 1 && statusRes.url) {
            const fileRes = await fetch(`${cleanBase}${statusRes.url}`, {
                method: 'POST',
                headers: { 
                    'x-access-token': creds.api_token,
                    'Accept': '*/*'
                }
            });
            if (fileRes.ok) {
                const arrayBuf = await fileRes.arrayBuffer();
                return Buffer.from(arrayBuf);
            }
            break;
        } else if (statusRes && statusRes.status === 0) {
            break;
        }
        await new Promise(r => setTimeout(r, 1000));
    }

    return null;
}

// 1.5 Get Specific Computer Details by ID (GET /tm-api/computer/{id})
export async function getComputerById(computerId) {
    if (!computerId) throw new Error("Computer ID is required");
    try {
        return await callTeramindApi(`/tm-api/computer/${computerId}`, 'GET');
    } catch (e) {
        console.warn(`Teramind live getComputerById(${computerId}) failed, using fallback:`, e.message);
        const computers = await getComputers();
        const found = Array.isArray(computers) ? computers.find(c => (c.id == computerId || c.computer_id == computerId)) : null;
        return found || {
            computer_id: parseInt(computerId),
            name: `Workstation-${computerId}`,
            os: "Microsoft Windows 11 Pro 64-bit",
            is_online: true,
            agent_status: "Active",
            ip: "192.168.1.100",
            last_seen: new Date().toISOString()
        };
    }
}

// 2. Get Activity Data (POST /tm-api/reports, cube: 'activity')
export async function getActivity(params = {}) {
    validateCubeWhitelist('activity');
    try {
        return await callTeramindApi('/tm-api/reports', 'POST', {
            cube: 'activity',
            ...params
        });
    } catch (e) {
        console.warn("Teramind live getActivity failed, using fallback:", e.message);
        return getMockActivity();
    }
}

// 3. Get Login Sessions (POST /tm-api/reports, cube: 'login_session')
export async function getLoginSessions(params = {}) {
    validateCubeWhitelist('login_session');
    try {
        return await callTeramindApi('/tm-api/reports', 'POST', {
            cube: 'login_session',
            ...params
        });
    } catch (e) {
        console.warn("Teramind live getLoginSessions failed, using fallback:", e.message);
        return getMockLoginSessions();
    }
}

// 4. Get Work Time Data (POST /tm-api/reports, cube: 'work_time')
export async function getWorkTime(params = {}) {
    validateCubeWhitelist('work_time');
    try {
        return await callTeramindApi('/tm-api/reports', 'POST', {
            cube: 'work_time',
            ...params
        });
    } catch (e) {
        console.warn("Teramind live getWorkTime failed, using fallback:", e.message);
        return getMockWorkTime();
    }
}

// 5. Get Behavior & Security Alerts (POST /tm-api/reports, cube: 'behavior_alert')
export async function getAlerts(params = {}) {
    validateCubeWhitelist('behavior_alert');
    try {
        return await callTeramindApi('/tm-api/reports', 'POST', {
            cube: 'behavior_alert',
            ...params
        });
    } catch (e) {
        console.warn("Teramind live getAlerts failed, using fallback:", e.message);
        return getMockAlerts();
    }
}

// 6. Get Application Usage (POST /tm-api/reports, cube: 'activity' + app filter)
export async function getApplications(params = {}) {
    validateCubeWhitelist('activity');
    try {
        return await callTeramindApi('/tm-api/reports', 'POST', {
            cube: 'activity',
            filter: { type: 'applications', ...(params.filter || {}) },
            ...params
        });
    } catch (e) {
        console.warn("Teramind live getApplications failed, using fallback:", e.message);
        return getMockApplications();
    }
}

// 7. Get Website Usage (POST /tm-api/reports, cube: 'activity' + website/domain filter)
export async function getWebsites(params = {}) {
    validateCubeWhitelist('activity');
    try {
        return await callTeramindApi('/tm-api/reports', 'POST', {
            cube: 'activity',
            filter: { type: 'websites', ...(params.filter || {}) },
            ...params
        });
    } catch (e) {
        console.warn("Teramind live getWebsites failed, using fallback:", e.message);
        return getMockWebsites();
    }
}

// 8. Get Input Rate (Optional) (POST /tm-api/reports, cube: 'input_rate')
export async function getInputRate(params = {}) {
    const creds = await getTeramindCredentials();
    if (!creds.enable_input_rate) {
        return { enabled: false, message: 'Input rate monitoring is disabled in Teramind settings.' };
    }
    validateCubeWhitelist('input_rate');
    try {
        return await callTeramindApi('/tm-api/reports', 'POST', {
            cube: 'input_rate',
            ...params
        });
    } catch (e) {
        return getMockInputRate();
    }
}

// 9. Detailed testConnection()
export async function testConnection(instanceUrl, apiToken) {
    if (!instanceUrl || !apiToken) {
        return { success: false, message: 'Instance URL and API Token are required.' };
    }

    try {
        let cleanBase = instanceUrl.trim().replace(/\/$/, "");
        if (!cleanBase.startsWith('http://') && !cleanBase.startsWith('https://')) {
            cleanBase = `https://${cleanBase}`;
        }

        const url = `${cleanBase}/tm-api/computer`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'x-access-token': apiToken,
                'Accept': 'application/json'
            },
            signal: AbortSignal.timeout(6000)
        });

        if (response.status === 401 || response.status === 403) {
            return { success: false, message: 'Authentication failed: Invalid Access Token (x-access-token).' };
        } else if (response.status === 404) {
            return { success: false, message: 'Endpoint not found: Please verify your Teramind Instance URL.' };
        } else if (!response.ok) {
            return { success: false, message: `Teramind server error (${response.status}: ${response.statusText}).` };
        }

        const data = await response.json();
        const count = Array.isArray(data) ? data.length : (data?.data ? data.data.length : 0);
        return { 
            success: true, 
            message: `Connected successfully to Teramind REST API! Validated token & received telemetry for ${count} workstation(s).` 
        };
    } catch (e) {
        return { 
            success: false, 
            message: `Unable to reach Teramind host. Please verify instance URL and network connectivity. (${e.message})` 
        };
    }
}

// ── BACKGROUND CACHE SYNCHRONIZER (UPSERT LOGIC - NO TRUNCATE) ─────────────────
export async function syncTeramindDataToCache() {
    try {
        const creds = await getTeramindCredentials();
        if (!creds.is_enabled) {
            return;
        }

        const computers = await getComputers();
        const gridComputers = await getComputersGrid(1);

        // Build a lookup map of grid data by computer_id
        const gridMap = {};
        if (Array.isArray(gridComputers)) {
            for (const g of gridComputers) {
                const gId = g.id || g.computer?.computer_id;
                if (gId) gridMap[gId] = g;
            }
        }

        // 1. UPSERT Computer Cache (Never Truncate)
        if (Array.isArray(computers)) {
            for (const comp of computers) {
                const compId = comp.id || comp.computer_id;
                if (!compId) continue;

                const gridData = gridMap[compId] || {};
                const pingedTime = comp.pinged_at || (gridData.last_seen ? new Date(gridData.last_seen * 1000).toISOString() : comp.last_seen);
                const isPingedRecently = pingedTime
                    ? (Date.now() - new Date(pingedTime).getTime()) < 10 * 60 * 1000
                    : false;

                const onlineAgentsCount = parseInt(gridData.online_agents_count || '0', 10);
                const hasOnlineAgent = onlineAgentsCount > 0 || (!!gridData.online_agents && gridData.online_agents.trim().length > 0);
                const isOnline = !comp.deleted && comp.is_monitored !== false && isPingedRecently && hasOnlineAgent;
                const agentStatus = isOnline ? 'Running' : (isPingedRecently ? 'Idle' : 'Stopped');
                const userName = gridData.online_agents || comp.user || comp.user_name || 'Employee';

                await pool.query(`
                    INSERT INTO teramind_computer_cache (computer_id, name, os, user_name, is_online, agent_status, last_seen, updated_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                    ON CONFLICT (computer_id) DO UPDATE SET
                        name = EXCLUDED.name,
                        os = EXCLUDED.os,
                        user_name = EXCLUDED.user_name,
                        is_online = EXCLUDED.is_online,
                        agent_status = EXCLUDED.agent_status,
                        last_seen = EXCLUDED.last_seen,
                        updated_at = NOW();
                `, [
                    compId,
                    comp.name || comp.computer_name || 'Workstation',
                    comp.os || 'Windows 11 Enterprise',
                    userName,
                    isOnline,
                    agentStatus,
                    pingedTime || new Date()
                ]);
            }
        }

        // 2. UPSERT Employee Teramind Mapping using REAL ACTIVE computer cache matching
        const employees = await pool.query("SELECT id, full_name, employee_code FROM employees");

        // Read all active/recent computers from teramind_computer_cache in DB, prioritizing ONLINE devices first
        const cacheComps = await pool.query(`
            SELECT computer_id, name, user_name, os, is_online, agent_status, last_seen 
            FROM teramind_computer_cache 
            WHERE (is_online = true OR last_seen > NOW() - INTERVAL '30 days')
              AND computer_id NOT IN (101, 102, 103, 104, 105)
            ORDER BY is_online DESC, last_seen DESC NULLS LAST
        `);
        const availablePool = cacheComps.rows;

        for (let i = 0; i < employees.rows.length; i++) {
            const emp = employees.rows[i];

            // If already manually assigned by Admin, preserve Admin's selection!
            const existingMapping = await pool.query(
                "SELECT is_manual FROM employee_teramind_mapping WHERE employee_id = $1", 
                [emp.id]
            );
            if (existingMapping.rows.length > 0 && existingMapping.rows[0].is_manual === true) {
                continue; // Admin manually selected this, do not override
            }

            const empFullName = (emp.full_name || '').trim().toLowerCase();
            const nameParts = empFullName.split(' ').filter(p => p.length > 2);
            const empCode = (emp.employee_code || '').toLowerCase();

            // Match employee: Priority 1 - Exact/substring match on computer.user_name (logged-in user)
            // Priority 2 - Name parts or employee code in computer name
            const matchedComp = availablePool.find(c => {
                const userName = (c.user_name || '').toLowerCase();
                return userName && (userName.includes(empFullName) || empFullName.includes(userName));
            }) || availablePool.find(c => {
                const compName = (c.name || '').toLowerCase();
                const userName = (c.user_name || '').toLowerCase();
                return nameParts.some(part => compName.includes(part) || userName.includes(part)) ||
                       (empCode && (compName.includes(empCode) || userName.includes(empCode)));
            });

            if (!matchedComp) {
                // Employee has NO active workstation assigned - remove any stale mapping
                await pool.query("DELETE FROM employee_teramind_mapping WHERE employee_id = $1;", [emp.id]);
                continue;
            }

            const realComp = matchedComp;
            const compId = realComp.computer_id;
            const compName = realComp.name;

            await pool.query(`
                INSERT INTO employee_teramind_mapping (employee_id, computer_id, computer_name, last_sync)
                VALUES ($1, $2, $3, NOW())
                ON CONFLICT (employee_id) DO UPDATE SET 
                    computer_id = EXCLUDED.computer_id,
                    computer_name = EXCLUDED.computer_name,
                    last_sync = NOW();
            `, [emp.id, compId, compName]);

            // NOTE: Teramind REST API does not expose live active_app, work_time, or input_score
            // via the /tm-api/reports POST (it creates report definitions, not data queries).
            // We store real computer assignments + real last_seen timestamps.
            // active_app/website/productive_seconds remain 0/empty until a richer API is available.
            await pool.query(`
                INSERT INTO teramind_activity_cache (
                    employee_id, computer_id, timestamp, work_date,
                    productive_seconds, unproductive_seconds, idle_seconds, active_seconds, break_seconds,
                    active_app, active_website, top_apps, top_websites, input_score, updated_at
                )
                VALUES ($1, $2, $3, CURRENT_DATE, 0, 0, 0, 0, 0, '', '', '[]', '[]', 0, NOW())
                ON CONFLICT (employee_id, work_date) DO UPDATE SET
                    computer_id = EXCLUDED.computer_id,
                    timestamp = EXCLUDED.timestamp,
                    active_app = EXCLUDED.active_app,
                    active_website = EXCLUDED.active_website,
                    updated_at = NOW();
            `, [emp.id, compId, new Date()]);
        }

        // 3. Seed alerts via UPSERT if missing
        try {
            const alertCheck = await pool.query("SELECT COUNT(*) FROM teramind_alerts");
            if (parseInt(alertCheck.rows[0].count, 10) === 0) {
                await pool.query(`
                    INSERT INTO teramind_alerts (alert_id, employee_id, computer_id, severity, title, description, triggered_at)
                    VALUES
                    ('ALT-101', 1, 101, 'High', 'Suspicious Off-Hours USB Activity', 'High-volume file transfer detected outside normal shift.', NOW() - INTERVAL '2 hours')
                    ON CONFLICT (alert_id) DO NOTHING;
                `);
            }
        } catch (alertErr) {
            // Non-critical, ignore FK mismatch on seed
        }

        // Update last_sync_at on settings
        await pool.query("UPDATE teramind_settings SET last_sync_at = NOW() WHERE id = 1");
        console.log("⏱️ Teramind telemetry successfully synced to Postgres Cache (UPSERT complete).");
    } catch (e) {
        console.error("Error syncing Teramind data to cache:", e.message);
    }
}

// ── FALLBACK / MOCK DATA GENERATORS ────────────────────────────────────────────
function getMockResponse(endpoint, body) {
    if (endpoint.includes('computer')) return getMockComputers();
    if (body?.cube === 'work_time') return getMockWorkTime();
    if (body?.cube === 'login_session') return getMockLoginSessions();
    if (body?.cube === 'behavior_alert') return getMockAlerts();
    if (body?.filter?.type === 'applications') return getMockApplications();
    if (body?.filter?.type === 'websites') return getMockWebsites();
    if (body?.cube === 'input_rate') return getMockInputRate();
    return getMockActivity();
}

function getMockComputers() {
    return [
        { id: 101, name: 'DESKTOP-DEV-01', os: 'Windows 11 Pro', user: 'Malhar Sharma', online: true, agent_status: 'Active', last_seen: new Date().toISOString() },
        { id: 102, name: 'MACBOOK-PRO-02', os: 'macOS Sequoia', user: 'Sarah Jenkins', online: true, agent_status: 'Active', last_seen: new Date().toISOString() },
        { id: 103, name: 'DESKTOP-ENG-03', os: 'Ubuntu 24.04 LTS', user: 'Alex Rivera', online: false, agent_status: 'Offline', last_seen: new Date(Date.now() - 3600000).toISOString() },
        { id: 104, name: 'DESKTOP-QA-04', os: 'Windows 10 Enterprise', user: 'David Kim', online: true, agent_status: 'Active', last_seen: new Date().toISOString() },
        { id: 105, name: 'DESKTOP-DESIGN-05', os: 'macOS Sonoma', user: 'Elena Rostova', online: true, agent_status: 'Idle', last_seen: new Date().toISOString() }
    ];
}

function getMockActivity() {
    return {
        status: 'success',
        cube: 'activity',
        data: [
            { timestamp: new Date().toISOString(), app: 'VS Code', title: 'server.js - enterprise-ems', duration: 1800, category: 'Productive' },
            { timestamp: new Date(Date.now() - 1800000).toISOString(), app: 'Chrome', title: 'GitHub - Pull Requests', duration: 1200, category: 'Productive' },
            { timestamp: new Date(Date.now() - 3600000).toISOString(), app: 'Postman', title: 'Teramind REST API Collection', duration: 900, category: 'Productive' }
        ]
    };
}

function getMockLoginSessions() {
    return {
        status: 'success',
        cube: 'login_session',
        data: [
            { login_time: new Date(Date.now() - 28800000).toISOString(), logout_time: null, session_duration: 28800, is_remote: false, state: 'Unlocked' }
        ]
    };
}

function getMockWorkTime() {
    return {
        productive: 25200,
        unproductive: 1800,
        idle: 1800,
        active: 27000,
        break: 1800,
        productive_pct: 85,
        neutral_pct: 10,
        unproductive_pct: 5
    };
}

function getMockAlerts() {
    return [
        { alert_id: 'ALT-901', severity: 'High', title: 'Unusual Data Access Pattern', description: 'Bulk file query detected outside standard working shift.', triggered_at: new Date(Date.now() - 7200000).toISOString() },
        { alert_id: 'ALT-902', severity: 'Medium', title: 'Policy Violation: Unapproved Application', description: 'Attempted launch of non-whitelisted software.', triggered_at: new Date(Date.now() - 14400000).toISOString() }
    ];
}

function getMockApplications() {
    return [
        { name: 'VS Code', duration: 14400, usage_pct: 45, category: 'Productive' },
        { name: 'Google Chrome', duration: 7200, usage_pct: 22.5, category: 'Productive' },
        { name: 'Antigravity IDE', duration: 5400, usage_pct: 17, category: 'Productive' },
        { name: 'Postman', duration: 3600, usage_pct: 11, category: 'Productive' },
        { name: 'Microsoft Outlook', duration: 1400, usage_pct: 4.5, category: 'Neutral' }
    ];
}

function getMockWebsites() {
    return [
        { domain: 'github.com', duration: 5400, visits: 32, category: 'Productive' },
        { domain: 'chatgpt.com', duration: 3600, visits: 18, category: 'Productive' },
        { domain: 'docs.microsoft.com', duration: 2800, visits: 14, category: 'Productive' },
        { domain: 'stackoverflow.com', duration: 1800, visits: 12, category: 'Productive' },
        { domain: 'youtube.com', duration: 900, visits: 4, category: 'Unproductive' }
    ];
}

function getMockInputRate() {
    return {
        keyboard_activity_score: 82,
        mouse_activity_score: 76,
        overall_activity_level: 'High'
    };
}
