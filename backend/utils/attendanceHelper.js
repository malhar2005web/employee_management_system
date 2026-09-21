/**
 * attendanceHelper.js
 * Centralized utility for computing attendance, shifts, check-in window filters, and working hours.
 */

/**
 * Calculates check-in, check-out, and total active seconds for a given set of activity packets on targetDateStr.
 * 
 * Shift Window Filter Rule (Option 1):
 * Standard office shift starts at 10:00 AM IST.
 * Earliest valid shift punch window opens at 08:00 AM IST.
 * Any activity before 08:00 AM IST (e.g. 00:09 AM gaming, 04:30 AM random wake) is considered off-hours activity.
 * 
 * - If activity packets exist at or after 08:00 AM IST on targetDateStr:
 *     checkInTs = minimum timestamp among packets where timeOfDay >= 08:00 AM IST.
 * - If activity packets ONLY exist before 08:00 AM IST:
 *     checkInTs = minimum timestamp of all packets (fallback so overnight activity isn't lost).
 * - checkOutTs = maximum end timestamp (ts + dur) of all packets.
 * - totalActiveSecs = sum of all durations.
 */
export function calculateShiftAttendanceTimes(packets, targetDateStr, options = {}) {
    const shiftStartHour = options.shiftStartHour ?? 10;
    const shiftGraceMins = options.shiftGraceMins ?? 15;
    const earliestPunchHour = options.earliestPunchHour ?? 8;

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

    // Earliest valid shift punch window in IST (e.g. 08:00:00 IST)
    const windowStartTs = Math.floor(new Date(`${targetDateStr}T${String(earliestPunchHour).padStart(2, '0')}:00:00+05:30`).getTime() / 1000);

    let allMinTs = Infinity;
    let shiftMinTs = Infinity;
    let maxTs = 0;
    let totalActiveSecs = 0;

    packets.forEach(p => {
        const ts = p.ts;
        const dur = p.dur || 0;
        if (ts && ts > 0) {
            if (ts < allMinTs) allMinTs = ts;
            if (ts >= windowStartTs && ts < shiftMinTs) shiftMinTs = ts;

            const end = ts + dur;
            if (end > maxTs) maxTs = end;
        }
        totalActiveSecs += dur;
    });

    const checkInTs = (shiftMinTs !== Infinity) ? shiftMinTs : (allMinTs !== Infinity ? allMinTs : null);
    const checkOutTs = (maxTs > 0) ? maxTs : null;

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

        if (hh > shiftStartHour || (hh === shiftStartHour && mm > shiftGraceMins)) {
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
    return d.toLocaleTimeString('en-GB', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
}
