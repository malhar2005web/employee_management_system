import { pool } from '../config/db.js';
import { sendWhatsAppTemplate, sendWhatsAppText, sanitizePhoneNumber } from '../services/whatsapp.service.js';

async function notifyOutEntryWhatsApp(employeeId, purpose, outTime, reason, destination) {
    try {
        const empRes = await pool.query(
            "SELECT id, full_name, phone, whatsapp_no FROM employees WHERE id = $1;",
            [employeeId]
        );
        if (empRes.rows.length === 0) return;
        const emp = empRes.rows[0];
        const targetPhone = emp.whatsapp_no || emp.phone;
        if (targetPhone) {
            await sendWhatsAppTemplate(
                targetPhone,
                'out_entry_alert',
                'en',
                [
                    emp.full_name || 'Employee',
                    purpose || 'Official Duty',
                    outTime || 'Current Time',
                    reason || destination || 'Office Movement'
                ]
            );
            console.log(`✅ WhatsApp Out Entry alert sent to ${emp.full_name} (${targetPhone})`);
        }
    } catch (err) {
        console.error("WhatsApp Out Entry alert error:", err.message);
    }
}

/**
 * Get out entries / gate passes with filtering, live metrics and location tracking
 */
export async function getOutEntries(req, res) {
    try {
        const { date, employeeId, purpose, status, startDate, endDate } = req.query;
        const user = req.user;

        let whereClauses = [];
        let params = [];
        let pIdx = 1;

        // If employee role (and not Admin/HR), restrict to self
        if (user && user.role !== 'Admin' && user.role !== 'HR' && user.employee_id) {
            whereClauses.push(`oe.employee_id = $${pIdx++}`);
            params.push(user.employee_id);
        } else if (employeeId) {
            whereClauses.push(`oe.employee_id = $${pIdx++}`);
            params.push(parseInt(employeeId, 10));
        }

        if (date) {
            whereClauses.push(`oe.date = $${pIdx++}`);
            params.push(date);
        } else if (startDate && endDate) {
            whereClauses.push(`oe.date BETWEEN $${pIdx++} AND $${pIdx++}`);
            params.push(startDate);
            params.push(endDate);
        }

        if (purpose && purpose !== 'All') {
            whereClauses.push(`oe.purpose = $${pIdx++}`);
            params.push(purpose);
        }

        if (status && status !== 'All') {
            whereClauses.push(`oe.status = $${pIdx++}`);
            params.push(status);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const query = `
            SELECT 
                oe.id,
                oe.employee_id,
                oe.date,
                TO_CHAR(oe.out_time, 'HH24:MI') as out_time,
                TO_CHAR(oe.in_time, 'HH24:MI') as in_time,
                oe.duration_minutes,
                oe.purpose,
                oe.destination,
                oe.reason,
                oe.status,
                oe.approved_by,
                oe.remarks,
                oe.created_at,
                oe.visit_otp,
                oe.otp_sent_to,
                oe.otp_verified_at,
                oe.visit_started_at,
                oe.customer_id,
                oe.branch_name,
                oe.target_latitude,
                oe.target_longitude,
                oe.target_address,
                oe.last_latitude,
                oe.last_longitude,
                oe.last_location_address,
                oe.last_tracked_at,
                COALESCE(c.name, '') as customer_name,
                COALESCE(e.full_name, 'Unknown') as employee_name,
                e.employee_code,
                COALESCE(d.name, 'General') as department,
                COALESCE(des.title, 'Staff') as designation,
                app.full_name as approver_name
            FROM out_entries oe
            LEFT JOIN employees e ON oe.employee_id = e.id
            LEFT JOIN departments d ON e.department_id = d.id
            LEFT JOIN designations des ON e.designation_id = des.id
            LEFT JOIN employees app ON oe.approved_by = app.id
            LEFT JOIN customers c ON oe.customer_id = c.id
            ${whereSql}
            ORDER BY oe.date DESC, oe.out_time DESC, oe.id DESC;
        `;

        const { rows } = await pool.query(query, params);

        // Calculate live metrics for today
        const statsRes = await pool.query(`
            SELECT 
                COUNT(*) FILTER (WHERE status = 'Out' AND date = CURRENT_DATE) as currently_out,
                COUNT(*) FILTER (WHERE date = CURRENT_DATE) as total_today,
                COUNT(*) FILTER (WHERE date = CURRENT_DATE AND purpose IN ('Official Duty', 'Client Visit', 'Bank Work')) as official_today,
                COUNT(*) FILTER (WHERE date = CURRENT_DATE AND purpose IN ('Personal Work', 'Emergency / Medical', 'Personal')) as personal_today
            FROM out_entries;
        `);

        // Get active employee list for selection dropdown
        const empListRes = await pool.query(`
            SELECT e.id, e.full_name, e.employee_code, COALESCE(d.name, 'General') as department 
            FROM employees e
            LEFT JOIN departments d ON e.department_id = d.id
            WHERE e.status = 'Active' OR e.status IS NULL OR e.status = 'active'
            ORDER BY e.full_name ASC;
        `);

        res.status(200).json({
            success: true,
            data: {
                entries: rows,
                stats: statsRes.rows[0] || {
                    currently_out: 0,
                    total_today: 0,
                    official_today: 0,
                    personal_today: 0
                },
                employees: empListRes.rows
            }
        });
    } catch (error) {
        console.error("Error in getOutEntries:", error);
        res.status(500).json({ success: false, message: "Failed to fetch out entries", error: error.message });
    }
}

/**
 * Record a new Out Entry / Gate Pass
 */
export async function createOutEntry(req, res) {
    try {
        const { 
            employeeId, date, outTime, inTime, purpose, destination, reason, remarks,
            customerId, branchName, targetLatitude, targetLongitude, targetAddress 
        } = req.body;
        const user = req.user;

        let targetEmployeeId = employeeId ? parseInt(employeeId, 10) : null;
        if (!targetEmployeeId && user && user.employee_id) {
            targetEmployeeId = user.employee_id;
        }

        if (!targetEmployeeId) {
            return res.status(400).json({ success: false, message: "Employee ID is required" });
        }

        if (!outTime || !purpose) {
            return res.status(400).json({ success: false, message: "Out Time and Purpose are required" });
        }

        const entryDate = date || new Date().toISOString().split('T')[0];
        const status = inTime ? 'Returned' : 'Out';
        const approvedBy = (user && (user.role === 'Admin' || user.role === 'HR')) ? user.id : null;

        let durationMinutes = 0;
        if (outTime && inTime) {
            const [outH, outM] = outTime.split(':').map(Number);
            const [inH, inM] = inTime.split(':').map(Number);
            durationMinutes = (inH * 60 + inM) - (outH * 60 + outM);
            if (durationMinutes < 0) durationMinutes = 0;
        }

        const query = `
            INSERT INTO out_entries (
                employee_id, date, out_time, in_time, duration_minutes,
                purpose, destination, reason, status, approved_by, remarks,
                customer_id, branch_name, target_latitude, target_longitude, target_address
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            RETURNING *;
        `;

        const values = [
            targetEmployeeId,
            entryDate,
            outTime,
            inTime || null,
            durationMinutes,
            purpose,
            destination || null,
            reason || null,
            status,
            approvedBy,
            remarks || null,
            customerId ? parseInt(customerId, 10) : null,
            branchName || null,
            targetLatitude ? parseFloat(targetLatitude) : null,
            targetLongitude ? parseFloat(targetLongitude) : null,
            targetAddress || null
        ];

        const { rows } = await pool.query(query, values);

        // Asynchronously notify employee via WhatsApp
        notifyOutEntryWhatsApp(targetEmployeeId, purpose, outTime, reason, destination);

        res.status(201).json({
            success: true,
            message: "Out entry recorded successfully",
            data: rows[0]
        });
    } catch (error) {
        console.error("Error in createOutEntry:", error);
        res.status(500).json({ success: false, message: "Failed to record out entry", error: error.message });
    }
}

/**
 * Mark return in-time for an active Out Entry
 */
export async function markReturnInTime(req, res) {
    try {
        const { id } = req.params;
        const { inTime, remarks } = req.body;

        if (!inTime) {
            return res.status(400).json({ success: false, message: "Return in-time is required" });
        }

        // Fetch existing out entry
        const existing = await pool.query("SELECT * FROM out_entries WHERE id = $1;", [id]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Out entry not found" });
        }

        const outEntry = existing.rows[0];
        const outTimeStr = String(outEntry.out_time).substring(0, 5);
        const [outH, outM] = outTimeStr.split(':').map(Number);
        const [inH, inM] = inTime.split(':').map(Number);
        let durationMinutes = (inH * 60 + inM) - (outH * 60 + outM);
        if (durationMinutes < 0) durationMinutes = 0;

        const updateRes = await pool.query(`
            UPDATE out_entries 
            SET 
                in_time = $1,
                duration_minutes = $2,
                status = 'Returned',
                remarks = COALESCE($3, remarks),
                updated_at = NOW()
            WHERE id = $4
            RETURNING *;
        `, [inTime, durationMinutes, remarks || null, id]);

        res.status(200).json({
            success: true,
            message: "Return time recorded successfully",
            data: updateRes.rows[0]
        });
    } catch (error) {
        console.error("Error in markReturnInTime:", error);
        res.status(500).json({ success: false, message: "Failed to update return time", error: error.message });
    }
}

/**
 * Approve or Reject Out Entry (Generates Visit OTP on Approval & dispatches WhatsApp to Customer)
 */
export async function updateOutEntryStatus(req, res) {
    try {
        const { id } = req.params;
        const { status, remarks } = req.body;
        const user = req.user;

        if (!['Approved', 'Rejected', 'Returned', 'Out'].includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid status value" });
        }

        const approverId = (user && user.employee_id) ? user.employee_id : (user ? user.id : null);

        // Fetch existing entry details
        const currEntryRes = await pool.query(`
            SELECT oe.*, e.full_name as employee_name 
            FROM out_entries oe 
            LEFT JOIN employees e ON oe.employee_id = e.id 
            WHERE oe.id = $1
        `, [id]);
        
        if (currEntryRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Out entry not found" });
        }
        const currEntry = currEntryRes.rows[0];

        let visitOtp = currEntry.visit_otp;
        let otpSentTo = currEntry.otp_sent_to;

        // Generate 4-digit OTP if status is Approved (or Out) and no OTP generated yet
        if (status === 'Approved' && !visitOtp) {
            visitOtp = String(Math.floor(1000 + Math.random() * 9000));

            // If entry is linked to a customer, look up contact person for WhatsApp notification
            if (currEntry.customer_id) {
                try {
                    const custRes = await pool.query(
                        `SELECT id, name, branches, contact_persons FROM customers WHERE id = $1`, 
                        [currEntry.customer_id]
                    );
                    if (custRes.rows.length > 0) {
                        const cust = custRes.rows[0];
                        let contactPhone = null;
                        let contactName = null;

                        // 1. Check matching branch contact first
                        if (cust.branches && Array.isArray(cust.branches)) {
                            const bMatch = cust.branches.find(b => b.branch === currEntry.branch_name);
                            if (bMatch && bMatch.contacts && bMatch.contacts.length > 0) {
                                contactPhone = bMatch.contacts[0].phone;
                                contactName = bMatch.contacts[0].name;
                            }
                        }

                        // 2. Fallback to top-level contact persons
                        if (!contactPhone && cust.contact_persons && Array.isArray(cust.contact_persons) && cust.contact_persons.length > 0) {
                            contactPhone = cust.contact_persons[0].phone;
                            contactName = cust.contact_persons[0].name;
                        }

                        if (contactPhone) {
                            otpSentTo = contactPhone;
                            const empName = currEntry.employee_name || 'Our Representative';
                            const msg = `Hello ${contactName || 'Customer'},\n\nOur representative *${empName}* from PCS Enterprise is visiting your office for *${currEntry.purpose}*.\n\nYour 4-Digit Visit Verification OTP is: *${visitOtp}*\n\nPlease share this OTP with our representative upon arrival to start the visit.\n\nBest regards,\nPCS Admin Team`;
                            
                            // Send WhatsApp message asynchronously
                            sendWhatsAppText(contactPhone, msg)
                                .then(() => console.log(`✅ Visit OTP ${visitOtp} sent to client ${contactPhone}`))
                                .catch(err => console.warn(`⚠️ Failed to send OTP to WhatsApp (${contactPhone}):`, err.message));
                        }
                    }
                } catch (cErr) {
                    console.error("Error finding customer contact for OTP:", cErr);
                }
            }
        }

        const updateRes = await pool.query(`
            UPDATE out_entries
            SET 
                status = $1,
                approved_by = $2,
                remarks = COALESCE($3, remarks),
                visit_otp = COALESCE($4, visit_otp),
                otp_sent_to = COALESCE($5, otp_sent_to),
                updated_at = NOW()
            WHERE id = $6
            RETURNING *;
        `, [status, approverId, remarks || null, visitOtp, otpSentTo, id]);

        res.status(200).json({
            success: true,
            message: `Out entry ${status.toLowerCase()} successfully`,
            data: updateRes.rows[0]
        });
    } catch (error) {
        console.error("Error in updateOutEntryStatus:", error);
        res.status(500).json({ success: false, message: "Failed to update status", error: error.message });
    }
}

/**
 * Track live employee location (called periodically every 5 minutes from mobile/web)
 */
export async function trackLocation(req, res) {
    try {
        const { id } = req.params;
        const { latitude, longitude, address } = req.body;

        if (latitude === undefined || longitude === undefined) {
            return res.status(400).json({ success: false, message: "Latitude and longitude are required" });
        }

        const updateRes = await pool.query(`
            UPDATE out_entries
            SET 
                last_latitude = $1,
                last_longitude = $2,
                last_location_address = COALESCE($3, last_location_address),
                last_tracked_at = NOW(),
                updated_at = NOW()
            WHERE id = $4
            RETURNING id, employee_id, last_latitude, last_longitude, last_location_address, last_tracked_at;
        `, [latitude, longitude, address || null, id]);

        if (updateRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Out entry not found" });
        }

        res.status(200).json({
            success: true,
            message: "Location tracked successfully",
            data: updateRes.rows[0]
        });
    } catch (error) {
        console.error("Error in trackLocation:", error);
        res.status(500).json({ success: false, message: "Failed to track location", error: error.message });
    }
}

/**
 * Verify 4-Digit Visit OTP upon arriving at client location
 */
export async function verifyVisitOtp(req, res) {
    try {
        const { id } = req.params;
        const { otp } = req.body;

        if (!otp) {
            return res.status(400).json({ success: false, message: "4-Digit OTP is required" });
        }

        const existingRes = await pool.query("SELECT * FROM out_entries WHERE id = $1;", [id]);
        if (existingRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Out entry not found" });
        }

        const entry = existingRes.rows[0];

        // Verify OTP
        const cleanInputOtp = String(otp).trim();
        const expectedOtp = String(entry.visit_otp || '').trim();

        if (!expectedOtp || cleanInputOtp !== expectedOtp) {
            return res.status(400).json({ success: false, message: "Invalid OTP. Please check the code provided by the client." });
        }

        const updateRes = await pool.query(`
            UPDATE out_entries
            SET 
                otp_verified_at = NOW(),
                visit_started_at = COALESCE(visit_started_at, NOW()),
                updated_at = NOW()
            WHERE id = $1
            RETURNING *;
        `, [id]);

        res.status(200).json({
            success: true,
            message: "Visit OTP verified successfully! Duration timer started.",
            data: updateRes.rows[0]
        });
    } catch (error) {
        console.error("Error in verifyVisitOtp:", error);
        res.status(500).json({ success: false, message: "Failed to verify visit OTP", error: error.message });
    }
}

/**
 * Delete Out Entry
 */
export async function deleteOutEntry(req, res) {
    try {
        const { id } = req.params;
        await pool.query("DELETE FROM out_entries WHERE id = $1;", [id]);
        res.status(200).json({ success: true, message: "Out entry deleted successfully" });
    } catch (error) {
        console.error("Error in deleteOutEntry:", error);
        res.status(500).json({ success: false, message: "Failed to delete out entry", error: error.message });
    }
}
