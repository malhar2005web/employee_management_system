import { pool } from '../config/db.js';

// Default standard holiday seeds for 2026 & 2025
const DEFAULT_HOLIDAYS_2026 = [
    { name: "New Year's Day", date: "2026-01-01", type: "Gazetted", is_optional: false, year: 2026 },
    { name: "Makar Sankranti / Pongal", date: "2026-01-14", type: "Festival", is_optional: false, year: 2026 },
    { name: "Republic Day", date: "2026-01-26", type: "National", is_optional: false, year: 2026 },
    { name: "Maha Shivratri", date: "2026-02-15", type: "Festival", is_optional: false, year: 2026 },
    { name: "Holi (Rangpanchami)", date: "2026-03-04", type: "Gazetted", is_optional: false, year: 2026 },
    { name: "Gudi Padwa / Ugadi", date: "2026-03-20", type: "Festival", is_optional: false, year: 2026 },
    { name: "Id-ul-Fitr (Ramadan Eid)", date: "2026-03-21", type: "Gazetted", is_optional: false, year: 2026 },
    { name: "Good Friday", date: "2026-04-03", type: "Gazetted", is_optional: false, year: 2026 },
    { name: "Dr. B.R. Ambedkar Jayanti", date: "2026-04-14", type: "National", is_optional: false, year: 2026 },
    { name: "Maharashtra Day / Labour Day", date: "2026-05-01", type: "Gazetted", is_optional: false, year: 2026 },
    { name: "Bakrid / Eid al-Adha", date: "2026-05-28", type: "Gazetted", is_optional: false, year: 2026 },
    { name: "Independence Day", date: "2026-08-15", type: "National", is_optional: false, year: 2026 },
    { name: "Raksha Bandhan", date: "2026-08-28", type: "Restricted", is_optional: true, year: 2026 },
    { name: "Ganesh Chaturthi", date: "2026-09-14", type: "Gazetted", is_optional: false, year: 2026 },
    { name: "Mahatma Gandhi Jayanti", date: "2026-10-02", type: "National", is_optional: false, year: 2026 },
    { name: "Dussehra (Vijayadashami)", date: "2026-10-20", type: "Gazetted", is_optional: false, year: 2026 },
    { name: "Diwali (Laxmi Pujan)", date: "2026-11-08", type: "Gazetted", is_optional: false, year: 2026 },
    { name: "Diwali (Balipratipada / New Year)", date: "2026-11-10", type: "Gazetted", is_optional: false, year: 2026 },
    { name: "Guru Nanak Jayanti", date: "2026-11-24", type: "Gazetted", is_optional: false, year: 2026 },
    { name: "Christmas", date: "2026-12-25", type: "Gazetted", is_optional: false, year: 2026 }
];

/**
 * Ensure holidays table is seeded if empty
 */
async function ensureHolidaysSeeded() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS holidays (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                date DATE NOT NULL,
                type VARCHAR(100) DEFAULT 'Gazetted',
                is_optional BOOLEAN DEFAULT false,
                year INT NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            ALTER TABLE holidays ADD COLUMN IF NOT EXISTS description TEXT;
        `);

        const countRes = await pool.query("SELECT COUNT(*) FROM holidays;");
        if (parseInt(countRes.rows[0].count, 10) === 0) {
            for (const h of DEFAULT_HOLIDAYS_2026) {
                await pool.query(
                    `INSERT INTO holidays (name, date, type, is_optional, year) VALUES ($1, $2, $3, $4, $5);`,
                    [h.name, h.date, h.type, h.is_optional, h.year]
                );
            }
        }
    } catch (err) {
        console.error("Error ensuring holidays seeded:", err.message);
    }
}

/**
 * Get Holidays list with filters & live statistics
 * GET /api/v1/holidays?year=2026&type=All&search=...
 */
export async function getHolidays(req, res) {
    try {
        await ensureHolidaysSeeded();

        const { year, type, search } = req.query;
        const now = new Date();
        const todayIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
        const currentYear = parseInt(todayIST.slice(0, 4), 10);
        const targetYear = year ? (year === 'All' ? null : parseInt(year, 10)) : currentYear;

        let whereClauses = [];
        let params = [];
        let pIdx = 1;

        if (targetYear) {
            whereClauses.push(`(EXTRACT(YEAR FROM date) = $${pIdx} OR year = $${pIdx})`);
            params.push(targetYear);
            pIdx++;
        }

        if (type && type !== 'All') {
            whereClauses.push(`type = $${pIdx++}`);
            params.push(type);
        }

        if (search) {
            whereClauses.push(`name ILIKE $${pIdx++}`);
            params.push(`%${search}%`);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const query = `
            SELECT 
                id,
                name,
                date,
                type,
                COALESCE(is_optional, false) as is_optional,
                COALESCE(year, EXTRACT(YEAR FROM date)::INT) as year,
                description,
                created_at,
                TRIM(TO_CHAR(date, 'Day')) as day_of_week
            FROM holidays
            ${whereSql}
            ORDER BY date ASC;
        `;

        const { rows } = await pool.query(query, params);

        // Format dates and determine upcoming vs past
        const formattedRows = rows.map(r => {
            const dStr = r.date instanceof Date 
                ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(r.date)
                : String(r.date).slice(0, 10);
            
            const isUpcoming = dStr >= todayIST;
            return {
                ...r,
                date: dStr,
                is_upcoming: isUpcoming,
                status: isUpcoming ? (dStr === todayIST ? 'Today' : 'Upcoming') : 'Past'
            };
        });

        // Compute metrics
        const allHolidaysYear = rows.map(r => r.date instanceof Date ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(r.date) : String(r.date).slice(0, 10));
        const upcomingList = formattedRows.filter(r => r.is_upcoming);
        const nextHoliday = upcomingList.length > 0 ? upcomingList[0] : null;

        const totalHolidays = formattedRows.length;
        const mandatoryCount = formattedRows.filter(r => !r.is_optional).length;
        const optionalCount = formattedRows.filter(r => r.is_optional).length;

        res.status(200).json({
            success: true,
            year: targetYear || 'All',
            stats: {
                total_holidays: totalHolidays,
                mandatory_count: mandatoryCount,
                optional_count: optionalCount,
                upcoming_count: upcomingList.length,
                next_holiday: nextHoliday ? {
                    name: nextHoliday.name,
                    date: nextHoliday.date,
                    day_of_week: nextHoliday.day_of_week,
                    type: nextHoliday.type
                } : null
            },
            data: formattedRows
        });
    } catch (error) {
        console.error("Error in getHolidays:", error);
        res.status(500).json({ success: false, message: "Failed to fetch holidays", error: error.message });
    }
}

/**
 * Create a new Holiday
 * POST /api/v1/holidays
 */
export async function createHoliday(req, res) {
    try {
        const { name, date, type, isOptional, description } = req.body;

        if (!name || !date) {
            return res.status(400).json({ success: false, message: "Holiday Name and Date are required" });
        }

        const holidayDate = String(date).slice(0, 10);
        const holidayYear = parseInt(holidayDate.slice(0, 4), 10);
        const holidayType = type || 'Gazetted';
        const isOpt = isOptional === true || isOptional === 'true';

        const insertRes = await pool.query(`
            INSERT INTO holidays (name, date, type, is_optional, year, description)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *;
        `, [name, holidayDate, holidayType, isOpt, holidayYear, description || null]);

        res.status(201).json({
            success: true,
            message: "Holiday added successfully",
            data: insertRes.rows[0]
        });
    } catch (error) {
        console.error("Error in createHoliday:", error);
        res.status(500).json({ success: false, message: "Failed to create holiday", error: error.message });
    }
}

/**
 * Update an existing Holiday
 * PUT /api/v1/holidays/:id
 */
export async function updateHoliday(req, res) {
    try {
        const { id } = req.params;
        const { name, date, type, isOptional, description } = req.body;

        if (!name || !date) {
            return res.status(400).json({ success: false, message: "Holiday Name and Date are required" });
        }

        const holidayDate = String(date).slice(0, 10);
        const holidayYear = parseInt(holidayDate.slice(0, 4), 10);
        const holidayType = type || 'Gazetted';
        const isOpt = isOptional === true || isOptional === 'true';

        const updateRes = await pool.query(`
            UPDATE holidays
            SET name = $1, date = $2, type = $3, is_optional = $4, year = $5, description = $6
            WHERE id = $7
            RETURNING *;
        `, [name, holidayDate, holidayType, isOpt, holidayYear, description || null, id]);

        if (updateRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Holiday not found" });
        }

        res.status(200).json({
            success: true,
            message: "Holiday updated successfully",
            data: updateRes.rows[0]
        });
    } catch (error) {
        console.error("Error in updateHoliday:", error);
        res.status(500).json({ success: false, message: "Failed to update holiday", error: error.message });
    }
}

/**
 * Delete a Holiday
 * DELETE /api/v1/holidays/:id
 */
export async function deleteHoliday(req, res) {
    try {
        const { id } = req.params;
        const delRes = await pool.query("DELETE FROM holidays WHERE id = $1 RETURNING *;", [id]);
        if (delRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Holiday not found" });
        }
        res.status(200).json({ success: true, message: "Holiday deleted successfully" });
    } catch (error) {
        console.error("Error in deleteHoliday:", error);
        res.status(500).json({ success: false, message: "Failed to delete holiday", error: error.message });
    }
}
