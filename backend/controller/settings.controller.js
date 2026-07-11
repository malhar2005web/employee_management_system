import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

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
        host: "smtp.mailtrap.io",
        port: 2525,
        user: "smtpuser",
        pass: "",
        sender: "noreply@pcscorp.com"
    },
    preferences: {
        standardHours: 8,
        gracePeriod: 15,
        workingDays: [1, 2, 3, 4, 5]
    },
    ipWhitelist: "127.0.0.1, ::1, 173.249.59.181"
};

async function readSettingsFile() {
    try {
        const data = await fs.readFile(settingsPath, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        // Create settings.json with default options if missing
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
        const { company, smtp, preferences, ipWhitelist } = req.body;

        if (!company || !smtp || !preferences) {
            return res.status(400).json({ success: false, message: "Invalid settings payload" });
        }

        const newSettings = {
            company: {
                name: company.name || "",
                email: company.email || "",
                address: company.address || "",
                timezone: company.timezone || "UTC",
                currency: company.currency || "USD"
            },
            smtp: {
                host: smtp.host || "",
                port: parseInt(smtp.port, 10) || 25,
                user: smtp.user || "",
                pass: smtp.pass || "",
                sender: smtp.sender || ""
            },
            preferences: {
                standardHours: parseInt(preferences.standardHours, 10) || 8,
                gracePeriod: parseInt(preferences.gracePeriod, 10) || 15,
                workingDays: Array.isArray(preferences.workingDays) ? preferences.workingDays.map(Number) : [1, 2, 3, 4, 5]
            },
            ipWhitelist: ipWhitelist || ""
        };

        await fs.writeFile(settingsPath, JSON.stringify(newSettings, null, 2), 'utf-8');
        res.status(200).json({ success: true, message: "Settings configuration saved successfully", data: newSettings });
    } catch (error) {
        console.log("Error in updateSettings:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}
