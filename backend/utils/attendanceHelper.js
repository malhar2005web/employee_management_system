/**
 * attendanceHelper.js
 * Centralized utility for computing attendance, shifts, check-in window filters, and working hours.
 */

/**
 * Calculates check-in, check-out, and total active seconds for a given set of activity packets on targetDateStr.
 * 
 * Shift Window Filter Rule (9:00 AM to 7:00 PM IST):
 * Standard office shift starts at 10:00 AM IST.
 * Valid shift attendance window opens at 09:00 AM IST (earliest punch) and closes at 07:00 PM IST (19:00).
 * Any activity outside this 09:00 AM - 07:00 PM window (e.g. night gaming, late evening home activity) is off-hours.
 * 
 * - Check-in MUST fall within [09:00 AM, 07:00 PM] IST:
 *     checkInTs = minimum timestamp among packets where 09:00 <= timeOfDay <= 19:00 IST.
 * - If NO packets exist within [09:00 AM, 07:00 PM] IST:
 *     The employee did NOT attend office during the shift window.
 *     checkInTs = null, checkOutTs = null, totalActiveSecs = 0, isLate = false.
 * - If valid check-in exists:
 *     checkOutTs = latest activity timestamp (ts + dur) of the shift.
 *     Shift wrap-up activity up to 19:30 is included so normal 7 PM checkout (e.g. 19:10-19:20) is recorded.
 */
export function calculateShiftAttendanceTimes(packets, targetDateStr, options = {}) {
    const shiftStartHour = options.shiftStartHour ?? 10;
    const shiftGraceMins = options.shiftGraceMins ?? 15;
    const earliestPunchHour = options.earliestPunchHour ?? 9; // Shifted from 8 AM to 9 AM IST
    const latestPunchHour = options.latestPunchHour ?? 19;    // 7:00 PM IST (19:00)

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

    // Earliest valid shift punch window in IST (09:00:00 IST)
    const windowStartTs = Math.floor(new Date(`${targetDateStr}T${String(earliestPunchHour).padStart(2, '0')}:00:00+05:30`).getTime() / 1000);
    // Latest valid shift punch window in IST (19:00:00 IST)
    const windowEndTs = Math.floor(new Date(`${targetDateStr}T${String(latestPunchHour).padStart(2, '0')}:00:00+05:30`).getTime() / 1000);
    // Allow up to 30 mins wrap-up after 19:00 (19:30) for natural shift logouts
    const wrapUpEndTs = windowEndTs + 1800;

    let shiftMinTs = Infinity;
    let shiftMaxTs = 0;
    let totalActiveSecs = 0;

    packets.forEach(p => {
        const ts = p.ts;
        const dur = p.dur || 0;
        if (ts && ts > 0) {
            // Valid shift check-in MUST start between 09:00 AM and 07:00 PM (19:00)
            if (ts >= windowStartTs && ts <= windowEndTs) {
                if (ts < shiftMinTs) shiftMinTs = ts;
            }

            // Count shift activity within the 9 AM to 7 PM window (with wrap-up to 19:30)
            if (ts >= windowStartTs && ts <= wrapUpEndTs) {
                const end = Math.min(ts + dur, wrapUpEndTs);
                if (end > shiftMaxTs) shiftMaxTs = end;
                totalActiveSecs += dur;
            }
        }
    });

    // If NO activity exists between 09:00 AM and 07:00 PM, employee did not work during the shift
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
