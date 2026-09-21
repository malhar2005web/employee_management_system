import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getEmailTicketConfig, saveEmailTicketConfig, testEmailConnection } from '../services/emailTicket.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const settingsPath = path.join(__dirname, '../config/settings.json');

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
        standardHours: 8,
        gracePeriod: 15,
        workingDays: [1, 2, 3, 4, 5]
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
                standardHours: parseInt(preferences?.standardHours, 10) || 8,
                gracePeriod: parseInt(preferences?.gracePeriod, 10) || 15,
                workingDays: Array.isArray(preferences?.workingDays) ? preferences.workingDays.map(Number) : [1, 2, 3, 4, 5]
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

        await fs.writeFile(settingsPath, JSON.stringify(newSettings, null, 2), 'utf-8');
        await saveEmailTicketConfig(newSettings.emailTicketing).catch(e => console.warn("saveEmailTicketConfig notice:", e.message));

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

