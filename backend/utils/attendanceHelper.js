/**
 * attendanceHelper.js
 * Centralized utility for computing attendance, shifts, check-in window filters, and working hours.
 * Supports dynamic company/tenant shift configurations saved from Admin Settings.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const settingsPath = path.join(__dirname, '../config/settings.json');

/**
 * Parses and computes concrete numeric minute markers for shift rules.
 * Default standard: Mon-Fri 09:30-19:00, Sat 09:30-16:30, 30m break, 15m grace (late after 09:45).
 */
export function parseShiftRules(prefs = {}) {
    const shiftStart = prefs.shiftStart || '09:30';
    const shiftEnd = prefs.shiftEnd || '19:00';
    const satShiftStart = prefs.satShiftStart || '09:30';
    const satShiftEnd = prefs.satShiftEnd || '16:30';
    const gracePeriod = prefs.gracePeriod !== undefined ? Number(prefs.gracePeriod) : 15;
    const allowedBreakMins = prefs.allowedBreakMins !== undefined ? Number(prefs.allowedBreakMins) : 30;
    const minOvertimeThreshold = prefs.minOvertimeThreshold !== undefined ? Number(prefs.minOvertimeThreshold) : 1;
    const halfDayHours = prefs.halfDayHours !== undefined ? Number(prefs.halfDayHours) : 4.5;
    const standardHours = prefs.standardHours !== undefined ? Number(prefs.standardHours) : 9.5;
    const workingDays = Array.isArray(prefs.workingDays) ? prefs.workingDays.map(Number) : [1, 2, 3, 4, 5, 6];

    const [wStartH, wStartM] = shiftStart.split(':').map(Number);
    const [wEndH, wEndM] = shiftEnd.split(':').map(Number);
    const [sStartH, sStartM] = satShiftStart.split(':').map(Number);
    const [sEndH, sEndM] = satShiftEnd.split(':').map(Number);

    const weekdayStartMins = (wStartH !== undefined && !isNaN(wStartH) ? wStartH : 9) * 60 + (wStartM || 30);      // 570 (09:30)
    const weekdayEndMins = (wEndH !== undefined && !isNaN(wEndH) ? wEndH : 19) * 60 + (wEndM || 0);            // 1140 (19:00)
    const satStartMins = (sStartH !== undefined && !isNaN(sStartH) ? sStartH : 9) * 60 + (sStartM || 30);          // 570 (09:30)
    const satEndMins = (sEndH !== undefined && !isNaN(sEndH) ? sEndH : 16) * 60 + (sEndM || 30);               // 990 (16:30)

    // Mark late after shift start + grace period (09:30 + 15 mins = 09:45 AM = 585 mins)
    const lateThresholdMins = weekdayStartMins + gracePeriod;
    const satLateThresholdMins = satStartMins + gracePeriod;

    return {
        shiftStart,
        shiftEnd,
        satShiftStart,
        satShiftEnd,
        gracePeriod,
        allowedBreakMins,
        minOvertimeThreshold,
        halfDayHours,
        standardHours,
        workingDays,
        weekdayStartMins,
        weekdayEndMins,
        satStartMins,
        satEndMins,
        lateThresholdMins,
        satLateThresholdMins
    };
}

/**
 * Loads company shift rules dynamically:
 * 1. Checks current tenant DB system_settings (company_preferences)
 * 2. Falls back to backend/config/settings.json
 * 3. Falls back to hardcoded corporate standard (09:30-19:00, Sat 09:30-16:30, Late after 09:45, Break 30m)
 */
export async function getCompanyShiftRules(tenantPoolOrClient = null) {
    if (tenantPoolOrClient) {
        try {
            const res = await tenantPoolOrClient.query(
                `SELECT value FROM system_settings WHERE key = 'company_preferences' LIMIT 1;`
            );
            if (res.rows.length > 0 && res.rows[0].value) {
                return parseShiftRules(res.rows[0].value);
            }
        } catch (e) {
            // Table might not exist yet or connection error
        }
    }

    try {
        const raw = await fs.readFile(settingsPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.preferences) {
            return parseShiftRules(parsed.preferences);
        }
    } catch (e) {}

    return parseShiftRules({});
}

/**
 * Calculates check-in, check-out, and total active seconds for a given set of activity packets on targetDateStr.
 */
export function calculateShiftAttendanceTimes(packets, targetDateStr, options = {}) {
    const rules = options.rules || parseShiftRules(options);
    const earliestPunchHour = options.earliestPunchHour ?? 8; // Earliest punch opens at 8:00 AM IST
    const latestPunchHour = options.latestPunchHour ?? Math.ceil(rules.weekdayEndMins / 60); // 19 (7:00 PM IST)

    if (!packets || packets.length === 0) {
        return {
            checkInTs: null,
            checkOutTs: null,
            checkInDate: null,
            checkOutDate: null,
            totalActiveSecs: 0,
            isLate: false
        };
    }

    // Earliest valid shift punch window in IST (08:00:00 IST)
    const windowStartTs = Math.floor(new Date(`${targetDateStr}T${String(earliestPunchHour).padStart(2, '0')}:00:00+05:30`).getTime() / 1000);
    // Latest valid shift punch window in IST (19:00:00 IST)
    const windowEndTs = Math.floor(new Date(`${targetDateStr}T${String(latestPunchHour).padStart(2, '0')}:00:00+05:30`).getTime() / 1000);
    // Allow up to 30 mins wrap-up after shift end for natural shift logouts
    const wrapUpEndTs = windowEndTs + 1800;

    let shiftMinTs = Infinity;
    let shiftMaxTs = 0;
    let totalActiveSecs = 0;

    packets.forEach(p => {
        const ts = p.ts;
        const dur = p.dur || 0;
        if (ts && ts > 0) {
            if (ts >= windowStartTs && ts <= windowEndTs) {
                if (ts < shiftMinTs) shiftMinTs = ts;
            }

            if (ts >= windowStartTs && ts <= wrapUpEndTs) {
                const end = Math.min(ts + dur, wrapUpEndTs);
                if (end > shiftMaxTs) shiftMaxTs = end;
                totalActiveSecs += dur;
            }
        }
    });

    if (shiftMinTs === Infinity) {
        return {
            checkInTs: null,
            checkOutTs: null,
            checkInDate: null,
            checkOutDate: null,
            totalActiveSecs: 0,
            isLate: false
        };
    }

    const checkInTs = shiftMinTs;
    const checkOutTs = (shiftMaxTs > 0) ? shiftMaxTs : null;

    const checkInDate = checkInTs ? new Date(checkInTs * 1000) : null;
    const checkOutDate = checkOutTs ? new Date(checkOutTs * 1000) : null;

    let isLate = false;
    if (checkInDate) {
        const checkInParts = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false
        }).formatToParts(checkInDate);
        const p = {};
        checkInParts.forEach(({ type, value }) => { p[type] = value; });
        const hh = parseInt(p.hour, 10);
        const mm = parseInt(p.minute, 10);
        const inMins = hh * 60 + mm;

        const dow = new Date(targetDateStr).getDay();
        const lateThreshold = (dow === 6) ? rules.satLateThresholdMins : rules.lateThresholdMins;

        // Mark late after 9:45 AM (or configured threshold)
        if (inMins > lateThreshold) {
            isLate = true;
        }
    }

    return {
        checkInTs,
        checkOutTs,
        checkInDate,
        checkOutDate,
        totalActiveSecs,
        isLate
    };
}

export function formatISTIso(d, withTz = false) {
    if (!d) return null;
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).formatToParts(d);
    const p = {};
    parts.forEach(({ type, value }) => { p[type] = value; });
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${withTz ? '+05:30' : ''}`;
}

export function formatISTTime(d) {
    if (!d) return '—';
    if (typeof d === 'string') {
        const trimmed = d.trim();
        if (/^\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
            return trimmed.slice(0, 5);
        }
    }
    const dateObj = (d instanceof Date) ? d : new Date(d);
    if (isNaN(dateObj.getTime())) {
        if (typeof d === 'string' && d.includes(' ')) {
            const timePart = d.split(' ')[1];
            if (timePart) return timePart.slice(0, 5);
        }
        return '—';
    }
    return dateObj.toLocaleTimeString('en-GB', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
}

/**
 * Calculates Overtime and Early Out based on dynamic company shift cutoff rules.
 * Mon-Fri shift cutoff: 19:00:00 (7:00 PM). Saturday: 16:30:00 (4:30 PM). Sunday: 100% Overtime.
 */
export function calculateOvertimeAndEarlyOut(logoutDate, targetDateStr, options = {}) {
    if (!logoutDate) {
        return {
            overtimeMins: 0,
            overtimeSeconds: 0,
            isEarlyLogout: false,
            earlyLogoutMins: 0,
            earlyLogoutSeconds: 0
        };
    }

    const d = (logoutDate instanceof Date) ? logoutDate : new Date(logoutDate);
    if (isNaN(d.getTime())) {
        return {
            overtimeMins: 0,
            overtimeSeconds: 0,
            isEarlyLogout: false,
            earlyLogoutMins: 0,
            earlyLogoutSeconds: 0
        };
    }

    const rules = options.rules || parseShiftRules(options);

    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).formatToParts(d);
    const p = {};
    parts.forEach(({ type, value }) => { p[type] = value; });
    const outH = parseInt(p.hour, 10);
    const outM = parseInt(p.minute, 10);
    const outS = parseInt(p.second, 10);

    const dateStr = targetDateStr || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
    const dayOfWeek = new Date(dateStr).getDay();
    const isSunday = (dayOfWeek === 0);
    const isSaturday = (dayOfWeek === 6);

    const cutoffMins = isSaturday ? rules.satEndMins : rules.weekdayEndMins;
    const cutoffSecs = cutoffMins * 60;
    const outTotalSecs = (outH * 3600) + (outM * 60) + outS;

    let overtimeSeconds = 0;
    let overtimeMins = 0;
    let isEarlyLogout = false;
    let earlyLogoutSeconds = 0;
    let earlyLogoutMins = 0;

    if (isSunday) {
        const totalWorkingSecs = options.totalWorkingSecs || (outTotalSecs > 0 ? outTotalSecs : 0);
        overtimeSeconds = totalWorkingSecs;
        overtimeMins = Math.round(overtimeSeconds / 60);
    } else if (outTotalSecs > cutoffSecs) {
        overtimeSeconds = outTotalSecs - cutoffSecs;
        overtimeMins = Math.round(overtimeSeconds / 60);
    } else if (outTotalSecs < cutoffSecs) {
        earlyLogoutSeconds = cutoffSecs - outTotalSecs;
        earlyLogoutMins = Math.round(earlyLogoutSeconds / 60);
        isEarlyLogout = true;
    }

    return {
        overtimeMins,
        overtimeSeconds,
        isEarlyLogout,
        earlyLogoutMins,
        earlyLogoutSeconds
    };
}
