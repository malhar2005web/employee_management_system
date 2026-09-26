import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getEmailTicketConfig, saveEmailTicketConfig, testEmailConnection } from '../services/emailTicket.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const settingsPath = path.join(__dirname, '../config/settings.json');

import { pool as defaultPool } from '../config/db.js';

const defaultSettings = {
    company: {
        name: "PCS Corporation",
        email: "admin@pcscorp.com",
        address: "100 Innovation Way, Tech District",
        timezone: "UTC",
        currency: "USD"
    },
    smtp: {
        host: "mail.pentasoftconsultancy.com",
        port: 465,
        user: "joshi@pentasoftconsultancy.com",
        pass: "",
        sender: "joshi@pentasoftconsultancy.com"
    },
    emailTicketing: {
        enabled: true,
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
    },
    preferences: {
        standardHours: 9.5,
        shiftStart: "09:30",
        shiftEnd: "19:00",
        satShiftStart: "09:30",
        satShiftEnd: "16:30",
        allowedBreakMins: 30,
        gracePeriod: 15,
        minOvertimeThreshold: 1,
        halfDayHours: 4.5,
        workingDays: [1, 2, 3, 4, 5, 6]
    },
    ipWhitelist: "127.0.0.1, ::1, 173.249.59.181",
    whatsappTemplate: {
        message: "Hello {customer_name},\n\nThis is an official communication from PCS Enterprise Suite regarding {company_name}.\n\nPlease find the requested information attached.\n\nBest regards,\nPCS Admin Team",
        attachmentUrl: "",
        attachmentName: ""
    }
};

async function readSettingsFile() {
    try {
        const data = await fs.readFile(settingsPath, 'utf-8');
        const parsed = JSON.parse(data);
        const emailConfig = await getEmailTicketConfig().catch(() => defaultSettings.emailTicketing);
        return {
            ...defaultSettings,
            ...parsed,
            preferences: {
                ...defaultSettings.preferences,
                ...(parsed.preferences || {})
            },
            emailTicketing: emailConfig || parsed.emailTicketing || defaultSettings.emailTicketing
        };
    } catch (e) {
        await fs.writeFile(settingsPath, JSON.stringify(defaultSettings, null, 2), 'utf-8');
        return defaultSettings;
    }
}

export async function getSettings(req, res) {
    try {
        const settings = await readSettingsFile();
        const activePool = req.tenant?.pool || defaultPool;
        
        // Merge tenant-specific company_preferences if present in DB
        try {
            const dbPrefRes = await activePool.query(
                `SELECT COALESCE(value, data) AS value FROM system_settings WHERE key = 'company_preferences' OR category = 'company_preferences' LIMIT 1;`
            );
            if (dbPrefRes.rows.length > 0 && dbPrefRes.rows[0].value) {
                settings.preferences = {
                    ...settings.preferences,
                    ...dbPrefRes.rows[0].value
                };
            }
        } catch (dbErr) {
            // Table might not exist yet before Phase 30 migration runs
        }

        res.status(200).json({ success: true, data: settings });
    } catch (error) {
        console.log("Error in getSettings:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function updateSettings(req, res) {
    try {
        const { company, smtp, emailTicketing, preferences, ipWhitelist, whatsappTemplate } = req.body;

        if (!company) {
            return res.status(400).json({ success: false, message: "Invalid settings payload" });
        }

        const currentSettings = await readSettingsFile();

        const newSettings = {
            company: {
                name: company.name || "",
                email: company.email || "",
                address: company.address || "",
                timezone: company.timezone || "UTC",
                currency: company.currency || "USD"
            },
            smtp: {
                host: smtp?.host || emailTicketing?.smtpHost || "",
                port: parseInt(smtp?.port || emailTicketing?.smtpPort, 10) || 465,
                user: smtp?.user || emailTicketing?.email || "",
                pass: smtp?.pass !== undefined ? smtp.pass : (emailTicketing?.password || ""),
                sender: smtp?.sender || emailTicketing?.email || ""
            },
            emailTicketing: {
                enabled: emailTicketing ? Boolean(emailTicketing.enabled) : true,
                email: emailTicketing?.email || "joshi@pentasoftconsultancy.com",
                password: emailTicketing?.password !== undefined ? emailTicketing.password : (currentSettings.emailTicketing?.password || ""),
                imapHost: emailTicketing?.imapHost || "mail.pentasoftconsultancy.com",
                imapPort: parseInt(emailTicketing?.imapPort, 10) || 993,
                imapSecure: emailTicketing?.imapSecure !== false,
                smtpHost: emailTicketing?.smtpHost || "mail.pentasoftconsultancy.com",
                smtpPort: parseInt(emailTicketing?.smtpPort, 10) || 465,
                smtpSecure: emailTicketing?.smtpSecure !== false,
                autoReply: emailTicketing?.autoReply !== false,
                pollIntervalSeconds: parseInt(emailTicketing?.pollIntervalSeconds, 10) || 30
            },
            preferences: {
                standardHours: parseFloat(preferences?.standardHours) || 9.5,
                shiftStart: preferences?.shiftStart || "09:30",
                shiftEnd: preferences?.shiftEnd || "19:00",
                satShiftStart: preferences?.satShiftStart || "09:30",
                satShiftEnd: preferences?.satShiftEnd || "16:30",
                allowedBreakMins: parseInt(preferences?.allowedBreakMins, 10) || 30,
                gracePeriod: parseInt(preferences?.gracePeriod, 10) || 15,
                minOvertimeThreshold: parseInt(preferences?.minOvertimeThreshold, 10) || 1,
                halfDayHours: parseFloat(preferences?.halfDayHours) || 4.5,
                workingDays: Array.isArray(preferences?.workingDays) ? preferences.workingDays.map(Number) : [1, 2, 3, 4, 5, 6]
            },
            ipWhitelist: ipWhitelist || "",
            whatsappTemplate: {
                message: whatsappTemplate?.message || "",
                attachmentUrl: whatsappTemplate?.attachmentUrl || "",
                attachmentName: whatsappTemplate?.attachmentName || ""
            }
        };

        // If email password was omitted or empty, retain previous password
        if (!newSettings.emailTicketing.password && currentSettings.emailTicketing?.password) {
            newSettings.emailTicketing.password = currentSettings.emailTicketing.password;
        }

        // Save to physical settings.json file
        await fs.writeFile(settingsPath, JSON.stringify(newSettings, null, 2), 'utf-8');
        await saveEmailTicketConfig(newSettings.emailTicketing).catch(e => console.warn("saveEmailTicketConfig notice:", e.message));

        // Save to current tenant database system_settings table (allows multi-tenant custom company rules)
        const activePool = req.tenant?.pool || defaultPool;
        try {
            await activePool.query(`
                CREATE TABLE IF NOT EXISTS system_settings (
                    id SERIAL PRIMARY KEY,
                    category VARCHAR(100),
                    data JSONB DEFAULT '{}'::jsonb,
                    key VARCHAR(100),
                    value JSONB,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                ALTER TABLE system_settings ALTER COLUMN category DROP NOT NULL;
                ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS key VARCHAR(100);
                ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS value JSONB;
                ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS category VARCHAR(100);
                ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;
                CREATE UNIQUE INDEX IF NOT EXISTS system_settings_key_idx ON system_settings(key);
            `);
            const prefJson = JSON.stringify(newSettings.preferences);
            await activePool.query(`
                INSERT INTO system_settings (category, data, key, value, updated_at)
                VALUES ('company_preferences', $1::jsonb, 'company_preferences', $1::jsonb, NOW())
                ON CONFLICT (key) DO UPDATE SET 
                    value = EXCLUDED.value,
                    data = EXCLUDED.data,
                    category = 'company_preferences',
                    updated_at = NOW();
            `, [prefJson]);
        } catch (dbErr) {
            console.warn("[updateSettings] DB system_settings notice:", dbErr.message);
        }

        res.status(200).json({ success: true, message: "Settings configuration saved successfully", data: newSettings });
    } catch (error) {
        console.log("Error in updateSettings:", error.message);
        res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
}

export async function testEmailSettings(req, res) {
    try {
        const config = req.body;
        const currentSettings = await readSettingsFile();
        
        // If password is not supplied in test payload, use stored password
        if (!config.password && currentSettings.emailTicketing?.password) {
            config.password = currentSettings.emailTicketing.password;
        }

        const result = await testEmailConnection(config);
        res.status(200).json(result);
    } catch (error) {
        console.error("Error in testEmailSettings:", error);
        res.status(500).json({ success: false, message: error.message || "Server error testing email connection" });
    }
}

export async function uploadWhatsappAttachment(req, res) {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No attachment file uploaded" });
        }
        const fileUrl = `/uploads/whatsapp/${req.file.filename}`;
        const fileName = req.file.originalname;

        res.status(200).json({
            success: true,
            message: "Attachment uploaded successfully",
            attachmentUrl: fileUrl,
            attachmentName: fileName
        });
    } catch (error) {
        console.error("Error in uploadWhatsappAttachment:", error);
        res.status(500).json({ success: false, message: "Server error uploading attachment" });
    }
}

