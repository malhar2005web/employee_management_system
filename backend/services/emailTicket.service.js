import dns from 'dns';
try { dns.setDefaultResultOrder('ipv4first'); } catch (e) {}

import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../config/db.js';
import { createTicketInboxNotifications, notifyTicketWhatsApp } from '../controller/support.controller.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const settingsPath = path.join(__dirname, '../config/settings.json');
const uploadDir = path.join(__dirname, '../uploads/support');

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

let imapClient = null;
let pollTimer = null;
let isPolling = false;

// ── 1. Read & Write Settings ────────────────────────────────────────────────
export async function getEmailTicketConfig() {
    try {
        // First try to check PostgreSQL system_settings table
        const dbRes = await pool.query("SELECT data FROM system_settings WHERE category = 'email_ticketing' LIMIT 1;").catch(() => ({ rows: [] }));
        if (dbRes.rows.length > 0 && dbRes.rows[0].data) {
            return dbRes.rows[0].data;
        }

        // Fallback to settings.json
        if (fs.existsSync(settingsPath)) {
            const raw = fs.readFileSync(settingsPath, 'utf-8');
            const data = JSON.parse(raw);
            if (data.emailTicketing) return data.emailTicketing;
        }
    } catch (e) {
        console.warn("Could not load email ticketing config:", e.message);
    }

    return {
        enabled: false,
        email: "joshi@pentasoftconsultancy.com",
        password: "",
        imapHost: "mail.pentasoftconsultancy.com",
        imapPort: 993,
        imapSecure: true,
        smtpHost: "mail.pentasoftconsultancy.com",
        smtpPort: 465,
        smtpSecure: true,
        autoReply: true,
        pollIntervalSeconds: 30
    };
}

export async function saveEmailTicketConfig(config) {
    try {
        // 1. Save in system_settings DB table
        await pool.query(`
            INSERT INTO system_settings (category, data, updated_at)
            VALUES ('email_ticketing', $1, NOW())
            ON CONFLICT (category)
            DO UPDATE SET data = $1, updated_at = NOW();
        `, [JSON.stringify(config)]);

        // 2. Also update settings.json
        if (fs.existsSync(settingsPath)) {
            const raw = fs.readFileSync(settingsPath, 'utf-8');
            const data = JSON.parse(raw);
            data.emailTicketing = config;
            // Also sync smtp section if needed
            if (config.smtpHost) {
                data.smtp = {
                    host: config.smtpHost,
                    port: config.smtpPort || 465,
                    user: config.email,
                    pass: config.password,
                    sender: config.email
                };
            }
            fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2), 'utf-8');
        }

        // 3. Restart background worker with new config
        await restartEmailTicketWorker();
        return true;
    } catch (err) {
        console.error("Error saving email ticket config:", err.message);
        throw err;
    }
}

// ── 2. Test Live IMAP & SMTP Connection ──────────────────────────────────────
export async function testEmailConnection(config) {
    const results = {
        imap: { success: false, message: '' },
        smtp: { success: false, message: '' }
    };

    // Test IMAP
    if (config.imapHost && config.email && config.password) {
        let client = null;
        try {
            const cleanPass = (config.password || '').trim();
            const imapPass = config.imapHost.includes('gmail') ? cleanPass.replace(/\s+/g, '') : cleanPass;

            client = new ImapFlow({
                host: config.imapHost.trim(),
                port: parseInt(config.imapPort, 10) || 993,
                secure: config.imapSecure !== false,
                auth: {
                    user: config.email.trim(),
                    pass: imapPass
                },
                tls: { rejectUnauthorized: false },
                logger: false
            });

            await client.connect();
            results.imap.success = true;
            results.imap.message = 'IMAP Connection & Authentication Successful!';
            await client.logout();
        } catch (imapErr) {
            results.imap.success = false;
            results.imap.message = imapErr.message || 'IMAP Connection Failed';
            if (client) { try { await client.logout(); } catch(e) {} }
        }
    } else {
        results.imap.message = 'Missing IMAP host, email, or password';
    }

    // Test SMTP
    if (config.smtpHost && config.email && config.password) {
        try {
            const transporter = nodemailer.createTransport({
                host: config.smtpHost,
                port: parseInt(config.smtpPort, 10) || (config.smtpSecure ? 465 : 587),
                secure: config.smtpSecure !== false,
                auth: {
                    user: config.email,
                    pass: config.password
                },
                tls: { rejectUnauthorized: false }
            });

            await transporter.verify();
            results.smtp.success = true;
            results.smtp.message = 'SMTP Connection & Authentication Successful!';
        } catch (smtpErr) {
            results.smtp.success = false;
            results.smtp.message = smtpErr.message || 'SMTP Connection Failed';
        }
    } else {
        results.smtp.message = 'Missing SMTP host, email, or password';
    }

    const overallSuccess = results.imap.success && results.smtp.success;
    return {
        success: overallSuccess,
        results,
        message: overallSuccess ? 'Both IMAP and SMTP connections verified successfully!' : 'Connection test completed with warnings/errors.'
    };
}

// ── 3. Send Auto-Acknowledgement Email ───────────────────────────────────────
export async function sendTicketAutoReply({ toEmail, customerName, ticketCode, subject, config }) {
    if (!config || !config.autoReply || !config.smtpHost || !config.email || !config.password) {
        return;
    }

    try {
        const transporter = nodemailer.createTransport({
            host: config.smtpHost,
            port: parseInt(config.smtpPort, 10) || 465,
            secure: config.smtpSecure !== false,
            auth: {
                user: config.email,
                pass: config.password
            },
            tls: { rejectUnauthorized: false }
        });

        const html = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
            <div style="background: linear-gradient(135deg, #0f766e 0%, #115e59 100%); padding: 24px; color: #ffffff;">
                <h2 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">Pentasoft Support Desk</h2>
                <div style="font-size: 13.5px; opacity: 0.9; margin-top: 4px;">Ticket Confirmation &amp; Acknowledgement</div>
            </div>
            <div style="padding: 24px; color: #334155; line-height: 1.6;">
                <p style="font-size: 15px; margin-top: 0;">Dear <strong>${customerName || 'Customer'}</strong>,</p>
                <p>Thank you for reaching out to our support team. We have received your request and a new support ticket has been generated:</p>
                
                <div style="background: #f8fafc; border-left: 4px solid #0d9488; padding: 14px 18px; border-radius: 6px; margin: 18px 0;">
                    <div style="font-size: 13px; color: #64748b; font-weight: 600;">TICKET REFERENCE ID</div>
                    <div style="font-size: 18px; font-weight: 800; color: #0f766e; margin-top: 2px;">#${ticketCode}</div>
                    <div style="font-size: 14px; font-weight: 600; color: #1e293b; margin-top: 6px;">Subject: ${subject}</div>
                </div>

                <p style="font-size: 14px;">Our engineering team has been assigned to investigate this matter. You will receive updates as progress is made.</p>
                <p style="font-size: 13px; color: #64748b; background: #f1f5f9; padding: 10px 14px; border-radius: 6px;">
                    💡 <strong>Tip:</strong> If you wish to provide additional details or screenshots, simply reply directly to this email without changing the subject line.
                </p>
                
                <p style="margin-top: 24px; font-size: 14px; color: #475569;">
                    Best regards,<br>
                    <strong>Support Team</strong><br>
                    Pentasoft Consultancy Services
                </p>
            </div>
            <div style="background: #f8fafc; padding: 14px 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
                © ${new Date().getFullYear()} Pentasoft Consultancy Services. All rights reserved.
            </div>
        </div>
        `;

        await transporter.sendMail({
            from: `"Pentasoft Support Desk" <${config.email}>`,
            to: toEmail,
            subject: `[${ticketCode}] Support Request Received: ${subject}`,
            html: html,
            inReplyTo: `<ticket-${ticketCode}@pentasoftconsultancy.com>`,
            references: `<ticket-${ticketCode}@pentasoftconsultancy.com>`
        });

        console.log(`✉️ Auto-acknowledgement email sent to ${toEmail} for ticket #${ticketCode}`);
    } catch (e) {
        console.warn(`Failed to send auto-reply to ${toEmail}:`, e.message);
    }
}

// ── 4. Core Email-to-Ticket Parsing & Creation Engine ────────────────────────
export async function processIncomingEmail({
    fromEmail,
    fromName,
    toEmails = [],
    ccEmails = [],
    subject = '',
    textBody = '',
    htmlBody = '',
    attachments = [],
    messageId = '',
    inReplyTo = ''
}) {
    try {
        console.log(`📩 Processing Inbound Email: From "${fromName}" <${fromEmail}> | Subject: "${subject}"`);

        const cleanSubject = (subject || 'Support Ticket from Email').trim();
        const cleanBody = (textBody || htmlBody?.replace(/<[^>]+>/g, ' ') || 'No content provided.').trim();

        // ── A0. Check if this exact email Message-ID was already processed ───
        if (messageId) {
            const dupRes = await pool.query("SELECT id, ticket_code FROM support_tickets WHERE email_message_id = $1 LIMIT 1;", [messageId]).catch(() => ({ rows: [] }));
            if (dupRes.rows.length > 0) {
                return {
                    success: true,
                    action: 'duplicate',
                    ticketId: dupRes.rows[0].id,
                    ticketCode: dupRes.rows[0].ticket_code,
                    message: `Email already processed as #${dupRes.rows[0].ticket_code}`
                };
            }
        }

        // ── A. Check for existing ticket code in subject (2-way threading) ───
        const ticketCodeMatch = cleanSubject.match(/SUP-\d+/i) || inReplyTo?.match(/SUP-\d+/i);
        if (ticketCodeMatch) {
            const existingCode = ticketCodeMatch[0].toUpperCase();
            const existingRes = await pool.query(
                "SELECT * FROM support_tickets WHERE UPPER(ticket_code) = $1 LIMIT 1;",
                [existingCode]
            );

            if (existingRes.rows.length > 0) {
                const ticket = existingRes.rows[0];
                console.log(`🔁 Found existing ticket #${ticket.ticket_code}. Appending comment...`);

                // Save attachments
                const savedAttachments = [];
                for (const att of attachments) {
                    if (att.content) {
                        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E6);
                        const cleanFileName = (att.filename || 'attachment').replace(/[^a-zA-Z0-9._-]/g, '_');
                        const saveFileName = `ticket-reply-${uniqueSuffix}-${cleanFileName}`;
                        const filePath = path.join(uploadDir, saveFileName);
                        fs.writeFileSync(filePath, att.content);
                        savedAttachments.push({
                            url: `/uploads/support/${saveFileName}`,
                            name: att.filename || cleanFileName,
                            size: att.size || att.content.length,
                            type: att.contentType || 'application/octet-stream'
                        });
                    } else if (att.url) {
                        savedAttachments.push(att);
                    }
                }

                // Add comment entry
                const commentText = `[Email Reply from ${fromName} <${fromEmail}>]\n\n${cleanBody}`;
                await pool.query(`
                    INSERT INTO support_ticket_comments (ticket_id, employee_id, comment, is_internal, attachments, created_at)
                    VALUES ($1, NULL, $2, false, $3, NOW());
                `, [ticket.id, commentText, JSON.stringify(savedAttachments)]).catch(() => {});

                // Notify assigned team
                await createTicketInboxNotifications({
                    ticketCode: ticket.ticket_code,
                    title: `New Email Reply on ${ticket.ticket_code}: ${ticket.title}`,
                    description: cleanBody,
                    priority: ticket.priority || 'High',
                    assignedToId: ticket.assigned_to_id,
                    assignedTeam: ticket.assigned_team || [],
                    customerName: ticket.customer_name || fromName,
                    projectName: 'Support Desk Reply',
                    actionType: 'comment',
                    attachments: savedAttachments
                });

                return {
                    success: true,
                    action: 'updated',
                    ticketId: ticket.id,
                    ticketCode: ticket.ticket_code,
                    message: `Reply appended to ticket #${ticket.ticket_code}`
                };
            }
        }

        // ── B. Generate Next Unique Ticket Code ──────────────────────────────
        const maxRes = await pool.query(`
            SELECT ticket_code FROM support_tickets 
            WHERE ticket_code ~ '^SUP-[0-9]+$' 
            ORDER BY CAST(SUBSTRING(ticket_code FROM 5) AS INTEGER) DESC 
            LIMIT 1;
        `).catch(() => ({ rows: [] }));
        let nextNum = 1;
        if (maxRes.rows && maxRes.rows.length > 0) {
            const match = maxRes.rows[0].ticket_code.match(/SUP-(\d+)/);
            if (match) {
                nextNum = parseInt(match[1], 10) + 1;
            }
        }
        let ticketCode = `SUP-${String(nextNum).padStart(6, '0')}`;
        // Extra check to prevent collisions
        const existsCheck = await pool.query("SELECT id FROM support_tickets WHERE ticket_code = $1", [ticketCode]).catch(() => ({ rows: [] }));
        if (existsCheck.rows && existsCheck.rows.length > 0) {
            ticketCode = `SUP-${Date.now().toString().slice(-6)}`;
        }

        // ── C. Match Customer ───────────────────────────────────────────────
        let customerId = null;
        let customerName = fromName || 'Customer';
        let projectName = 'General Support';

        if (fromEmail) {
            const domain = fromEmail.split('@')[1]?.toLowerCase() || '';
            const custRes = await pool.query(
                "SELECT id, name, branches FROM customers WHERE LOWER(name) LIKE $1 OR LOWER(branches::text) LIKE $2 LIMIT 1;",
                [`%${domain}%`, `%${fromEmail.toLowerCase()}%`]
            ).catch(() => ({ rows: [] }));
            if (custRes.rows.length > 0) {
                customerId = custRes.rows[0].id;
                customerName = custRes.rows[0].name || customerName;
            }
        }

        // ── D. Match CC & To Emails with Employees and Admin ─────────────────
        const allTargetEmails = new Set();
        [...toEmails, ...ccEmails].forEach(e => {
            if (typeof e === 'string' && e.includes('@')) {
                allTargetEmails.add(e.trim().toLowerCase());
            }
        });

        const targetEmployeeIds = new Set();

        if (allTargetEmails.size > 0) {
            const emailArray = Array.from(allTargetEmails);
            const matchedEmps = await pool.query(`
                SELECT e.id, e.full_name, e.email, u.email as user_email, u.role
                FROM employees e
                LEFT JOIN users u ON e.user_id = u.id
                WHERE LOWER(e.email) = ANY($1) 
                   OR LOWER(u.email) = ANY($1)
                   OR LOWER(e.full_name) = ANY($1);
            `, [emailArray]).catch(() => ({ rows: [] }));

            for (const emp of matchedEmps.rows) {
                targetEmployeeIds.add(emp.id);
            }
        }

        // Always include default lead support engineers: Malhar (9) & Nitin (10)
        targetEmployeeIds.add(9);
        targetEmployeeIds.add(10);

        const assignedTeamArray = Array.from(targetEmployeeIds);
        const assignedToId = assignedTeamArray[0] || 9;

        // ── E. Process & Save Attachments ────────────────────────────────────
        const savedAttachments = [];
        for (const att of attachments) {
            if (att.content) {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E6);
                const cleanFileName = (att.filename || 'attachment').replace(/[^a-zA-Z0-9._-]/g, '_');
                const saveFileName = `ticket-attachment-${uniqueSuffix}-${cleanFileName}`;
                const filePath = path.join(uploadDir, saveFileName);
                fs.writeFileSync(filePath, att.content);
                savedAttachments.push({
                    url: `/uploads/support/${saveFileName}`,
                    name: att.filename || cleanFileName,
                    size: att.size || att.content.length,
                    type: att.contentType || 'application/octet-stream'
                });
            } else if (att.url) {
                savedAttachments.push(att);
            }
        }

        // ── F. Calculate SLA Deadlines ───────────────────────────────────────
        const now = new Date();
        const respMinutes = 120; // 2 Hours for High priority
        const resoMinutes = 1440; // 24 Hours for High priority
        const respDeadline = new Date(now.getTime() + respMinutes * 60000);
        const resoDeadline = new Date(now.getTime() + resoMinutes * 60000);

        // ── G. Insert Support Ticket into Database ───────────────────────────
        const insertRes = await pool.query(`
            INSERT INTO support_tickets (
                ticket_code, title, description, category, priority, customer_id, reported_by,
                customer_email, cc_emails, source, status, assigned_to, assigned_team,
                attachments, response_deadline, resolution_deadline, email_message_id, created_at
            ) VALUES ($1, $2, $3, 'Email Inbound', $4, $5, $6, $7, $8, 'Email', 'Assigned', $9, $10, $11, $12, $13, $14, NOW())
            RETURNING *;
        `, [
            ticketCode,
            cleanSubject,
            cleanBody,
            'High',
            customerId,
            `${fromName || 'Customer'} (${fromEmail})`,
            fromEmail || null,
            Array.from(allTargetEmails),
            assignedToId,
            JSON.stringify(assignedTeamArray),
            JSON.stringify(savedAttachments),
            respDeadline,
            resoDeadline,
            messageId || null
        ]);

        const newTicket = insertRes.rows[0];
        console.log(`🎉 New Support Ticket #${ticketCode} successfully created from Email!`);

        // ── H. Push Instant Inbox Notifications to Admin & CC'd Employees ────
        await createTicketInboxNotifications({
            ticketCode: ticketCode,
            title: `New Support Ticket via Email: ${cleanSubject}`,
            description: cleanBody,
            priority: 'High',
            assignedToId: assignedToId,
            assignedTeam: assignedTeamArray,
            customerName: customerName,
            projectName: projectName,
            actionType: 'created',
            attachments: savedAttachments
        });

        // ── I. Trigger WhatsApp Notification ─────────────────────────────────
        try {
            await notifyTicketWhatsApp({
                ticketCode,
                title: cleanSubject,
                description: cleanBody,
                priority: 'High',
                assignedToId,
                assignedTeam: assignedTeamArray,
                customerName,
                projectName,
                actionType: 'created',
                attachments: savedAttachments
            });
        } catch (wErr) {
            console.warn("WhatsApp alert warning:", wErr.message);
        }

        // ── J. Send Auto-Acknowledgement Email to Customer ───────────────────
        const config = await getEmailTicketConfig();
        if (fromEmail) {
            await sendTicketAutoReply({
                toEmail: fromEmail,
                customerName: fromName || customerName,
                ticketCode: ticketCode,
                subject: cleanSubject,
                config: config
            });
        }

        return {
            success: true,
            action: 'created',
            ticketId: newTicket.id,
            ticketCode: newTicket.ticket_code,
            data: newTicket
        };

    } catch (err) {
        console.error("❌ Error in processIncomingEmail:", err);
        throw err;
    }
}

// ── 5. Background IMAP Polling Worker ────────────────────────────────────────
export async function pollImapMailbox() {
    if (isPolling) return;
    isPolling = true;

    const config = await getEmailTicketConfig();
    if (!config.enabled || !config.imapHost || !config.email || !config.password) {
        isPolling = false;
        return;
    }

    let client = null;
    try {
        const cleanPass = (config.password || '').trim();
        const imapPass = config.imapHost.includes('gmail') ? cleanPass.replace(/\s+/g, '') : cleanPass;

        client = new ImapFlow({
            host: config.imapHost.trim(),
            port: parseInt(config.imapPort, 10) || 993,
            secure: config.imapSecure !== false,
            auth: {
                user: config.email.trim(),
                pass: imapPass
            },
            tls: { rejectUnauthorized: false },
            logger: false
        });

        await client.connect();
        const lock = await client.getMailboxLock('INBOX');

        try {
            // Search for messages in the last 48 hours (unseen first, or all recent)
            const sinceDate = new Date(Date.now() - 48 * 60 * 60 * 1000);
            let messages = await client.search({ seen: false, since: sinceDate });
            if (!Array.isArray(messages) || messages.length === 0) {
                messages = await client.search({ since: sinceDate });
            }
            
            if (Array.isArray(messages) && messages.length > 0) {
                console.log(`📬 Found ${messages.length} recent email(s) in support mailbox.`);

                // Process up to 25 latest emails in order
                const recentBatch = messages.slice(-25);

                for (const seq of recentBatch) {
                    try {
                        const fetched = await client.fetchOne(seq.toString(), { source: true });
                        if (!fetched || !fetched.source) continue;

                        const parsed = await simpleParser(fetched.source);

                        const fromEmail = (parsed.from?.value?.[0]?.address || '').toLowerCase().trim();
                        const fromName = parsed.from?.value?.[0]?.name || fromEmail;

                        // Mark message as seen right away
                        await client.messageFlagsAdd(seq.toString(), ['\\Seen'], { uid: false }).catch(() => {});

                        // Ignore delivery failure daemon loops only
                        if (fromEmail.includes('mailer-daemon') || fromEmail.includes('postmaster')) {
                            continue;
                        }

                        const toList = (parsed.to?.value || []).map(t => t.address).filter(Boolean);
                        const ccList = (parsed.cc?.value || []).map(c => c.address).filter(Boolean);

                        const attachments = (parsed.attachments || []).map(att => ({
                            filename: att.filename,
                            contentType: att.contentType,
                            content: att.content,
                            size: att.size
                        }));

                        await processIncomingEmail({
                            fromEmail,
                            fromName,
                            toEmails: toList,
                            ccEmails: ccList,
                            subject: parsed.subject || '',
                            textBody: parsed.text || '',
                            htmlBody: parsed.html || '',
                            attachments,
                            messageId: parsed.messageId,
                            inReplyTo: parsed.inReplyTo
                        });
                    } catch (msgErr) {
                        console.error("Error processing single email sequence:", msgErr.message);
                    }
                }
            }
        } finally {
            lock.release();
        }

        await client.logout();
    } catch (err) {
        if (!err.message?.includes('AUTHENTICATE') && !err.message?.includes('ENOTFOUND')) {
            console.warn("IMAP Polling cycle notice:", err.message);
        }
    } finally {
        if (client) {
            try { await client.logout(); } catch(e) {}
        }
        isPolling = false;
    }
}

// ── 6. Worker Lifecycle Management ───────────────────────────────────────────
export async function initEmailTicketWorker() {
    const config = await getEmailTicketConfig();
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }

    if (config.enabled && config.imapHost && config.email && config.password) {
        const intervalSec = Math.max(15, parseInt(config.pollIntervalSeconds, 10) || 30);
        console.log(`📧 Email-to-Ticket Worker active (Polling ${config.email} every ${intervalSec}s)`);
        
        // Initial run
        pollImapMailbox().catch(() => {});
        pollTimer = setInterval(pollImapMailbox, intervalSec * 1000);
    } else {
        console.log("ℹ️ Email-to-Ticket Worker is in standby (disabled or pending credentials in Settings).");
    }
}

export async function restartEmailTicketWorker() {
    await initEmailTicketWorker();
}
