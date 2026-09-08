import fs from 'fs';
import path from 'path';

// WABA Credentials & System Constants
const WABA_CONFIG = {
    BASE_URL: 'https://messagingapi.charteredinfo.com',
    PHONE_NUMBER_ID: '1272160742648640',
    WABA_ID: '1799229541523265',
    USER_ID: 'joshi1@pentasoftconsultancy.com',
    PASSWORD: 'MALHAR@2005k',
    SENDER_PHONE: '919082270423'
};

// In-Memory Token Cache
let cachedToken = null;
let tokenExpiryTime = 0;

/**
 * 1. Automatically fetch & cache JWT Bearer Auth Token
 */
export async function getWabaAuthToken() {
    const now = Date.now();
    if (cachedToken && now < tokenExpiryTime) {
        return cachedToken;
    }

    try {
        const response = await fetch(`${WABA_CONFIG.BASE_URL}/AuthTokenV1/AuthToken`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: WABA_CONFIG.USER_ID,
                password: WABA_CONFIG.PASSWORD,
                authTokenValidityMins: "99999999"
            })
        });

        const data = await response.json();
        if (data && data.isSuccess && data.txnOutcome) {
            cachedToken = data.txnOutcome;
            // Cache for 24 hours (86,400,000 ms)
            tokenExpiryTime = now + (24 * 60 * 60 * 1000);
            console.log("✅ WABA Auth Token refreshed & cached successfully");
            return cachedToken;
        } else {
            throw new Error(data.message || "Failed to generate WABA Auth Token");
        }
    } catch (error) {
        console.error("❌ WABA getAuthToken Error:", error.message);
        throw error;
    }
}

/**
 * 2. AUTOMATIC IMAGE / DOCUMENT TO BASE64 UPLOADER (No Manual Converter Needed!)
 * Takes a file path or Buffer, automatically converts to Base64, uploads to WABA, and returns mediaId
 */
export async function uploadMediaToWaba(fileInput, originalFileName, mimeType) {
    try {
        const token = await getWabaAuthToken();
        let base64String = '';
        let fileName = originalFileName || 'attachment.png';
        let detectedMime = mimeType || 'image/png';

        if (Buffer.isBuffer(fileInput)) {
            base64String = fileInput.toString('base64');
        } else if (typeof fileInput === 'string' && fs.existsSync(fileInput)) {
            const fileBuffer = fs.readFileSync(fileInput);
            base64String = fileBuffer.toString('base64');
            fileName = path.basename(fileInput);
            const ext = path.extname(fileInput).toLowerCase();
            if (ext === '.pdf') detectedMime = 'application/pdf';
            else if (ext === '.jpg' || ext === '.jpeg') detectedMime = 'image/jpeg';
            else if (ext === '.png') detectedMime = 'image/png';
            else if (ext === '.xlsx') detectedMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        } else if (typeof fileInput === 'string' && fileInput.length > 500) {
            // Already base64 string
            base64String = fileInput.replace(/^data:([A-Za-z-+\/]+);base64,/, '');
        } else {
            throw new Error("Invalid fileInput provided for WABA media upload");
        }

        const payload = {
            fileName: fileName,
            mimeType: detectedMime,
            b64OfMedia: base64String
        };

        const response = await fetch(`${WABA_CONFIG.BASE_URL}/v19.0/${WABA_CONFIG.PHONE_NUMBER_ID}/Media/UploadB64`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (data && data.id) {
            console.log(`✅ Media uploaded automatically to WABA. Media ID: ${data.id}`);
            return data.id;
        } else {
            console.error("❌ WABA Media Upload Failed:", data);
            throw new Error(data.message || "WABA Media Upload Failed");
        }
    } catch (error) {
        console.error("❌ uploadMediaToWaba Error:", error.message);
        throw error;
    }
}

/**
 * 3. Send Image Message with Caption
 */
export async function sendWhatsAppImage(toPhone, fileInputOrMediaId, caption = '', fileName = 'image.png', mimeType = 'image/png') {
    try {
        const token = await getWabaAuthToken();
        const formattedPhone = sanitizePhoneNumber(toPhone);

        let mediaId = fileInputOrMediaId;
        // If file buffer or path is passed, upload first
        if (Buffer.isBuffer(fileInputOrMediaId) || (typeof fileInputOrMediaId === 'string' && fs.existsSync(fileInputOrMediaId))) {
            mediaId = await uploadMediaToWaba(fileInputOrMediaId, fileName, mimeType);
        }

        const payload = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: formattedPhone,
            type: "image",
            image: {
                id: mediaId,
                caption: caption
            }
        };

        const response = await fetch(`${WABA_CONFIG.BASE_URL}/v19.0/${WABA_CONFIG.PHONE_NUMBER_ID}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        return result;
    } catch (error) {
        console.error("❌ sendWhatsAppImage Error:", error.message);
        throw error;
    }
}

/**
 * 4. Send Document Message (PDF / Excel / Report)
 */
export async function sendWhatsAppDocument(toPhone, fileInputOrMediaId, fileName = 'report.pdf', caption = '') {
    try {
        const token = await getWabaAuthToken();
        const formattedPhone = sanitizePhoneNumber(toPhone);

        let mediaId = fileInputOrMediaId;
        if (Buffer.isBuffer(fileInputOrMediaId) || (typeof fileInputOrMediaId === 'string' && fs.existsSync(fileInputOrMediaId))) {
            mediaId = await uploadMediaToWaba(fileInputOrMediaId, fileName, 'application/pdf');
        }

        const payload = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: formattedPhone,
            type: "document",
            document: {
                id: mediaId,
                caption: caption,
                filename: fileName
            }
        };

        const response = await fetch(`${WABA_CONFIG.BASE_URL}/v19.0/${WABA_CONFIG.PHONE_NUMBER_ID}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        return await response.json();
    } catch (error) {
        console.error("❌ sendWhatsAppDocument Error:", error.message);
        throw error;
    }
}

/**
 * 5. Send Plain Text Message (24-Hour Service Window)
 */
export async function sendWhatsAppText(toPhone, messageBody) {
    try {
        const token = await getWabaAuthToken();
        const formattedPhone = sanitizePhoneNumber(toPhone);

        const payload = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: formattedPhone,
            type: "text",
            text: {
                preview_url: false,
                body: messageBody
            }
        };

        const response = await fetch(`${WABA_CONFIG.BASE_URL}/v19.0/${WABA_CONFIG.PHONE_NUMBER_ID}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        return await response.json();
    } catch (error) {
        console.error("❌ sendWhatsAppText Error:", error.message);
        throw error;
    }
}

/**
 * 6. Send Approved Template Message
 */
export async function sendWhatsAppTemplate(toPhone, templateName, languageCode = 'en', parameters = []) {
    try {
        const token = await getWabaAuthToken();
        const formattedPhone = sanitizePhoneNumber(toPhone);

        const payload = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: formattedPhone,
            type: "template",
            template: {
                name: templateName,
                language: { code: languageCode },
                components: [
                    {
                        type: "body",
                        parameters: parameters.map(p => ({ type: "text", text: String(p) }))
                    }
                ]
            }
        };

        const response = await fetch(`${WABA_CONFIG.BASE_URL}/v19.0/${WABA_CONFIG.PHONE_NUMBER_ID}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        return await response.json();
    } catch (error) {
        console.error("❌ sendWhatsAppTemplate Error:", error.message);
        throw error;
    }
}

/**
 * 7. Send Interactive List Menu Message (Bottom Sheet Drawer with Sections)
 */
export async function sendWhatsAppListMenu(toPhone, { headerText, bodyText, footerText = 'Pentasoft Consultancy', buttonText = 'View Options', sections = [] }) {
    try {
        const token = await getWabaAuthToken();
        const formattedPhone = sanitizePhoneNumber(toPhone);

        const interactiveObj = {
            type: "list",
            body: { text: bodyText },
            action: {
                button: buttonText,
                sections: sections
            }
        };

        if (headerText) {
            interactiveObj.header = { type: "text", text: headerText };
        }
        if (footerText) {
            interactiveObj.footer = { text: footerText };
        }

        const payload = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: formattedPhone,
            type: "interactive",
            interactive: interactiveObj
        };

        const response = await fetch(`${WABA_CONFIG.BASE_URL}/v19.0/${WABA_CONFIG.PHONE_NUMBER_ID}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        return await response.json();
    } catch (error) {
        console.error("❌ sendWhatsAppListMenu Error:", error.message);
        throw error;
    }
}

/**
 * 8. Send Interactive Reply Buttons (Up to 3 Instant Click Buttons)
 */
export async function sendWhatsAppButtons(toPhone, { headerText, bodyText, footerText = 'Pentasoft Consultancy', buttons = [] }) {
    try {
        const token = await getWabaAuthToken();
        const formattedPhone = sanitizePhoneNumber(toPhone);

        const interactiveObj = {
            type: "button",
            body: { text: bodyText },
            action: {
                buttons: buttons.map(b => ({
                    type: "reply",
                    reply: {
                        id: b.id,
                        title: b.title.substring(0, 20) // WABA allows max 20 chars for button title
                    }
                }))
            }
        };

        if (headerText) {
            interactiveObj.header = { type: "text", text: headerText };
        }
        if (footerText) {
            interactiveObj.footer = { text: footerText };
        }

        const payload = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: formattedPhone,
            type: "interactive",
            interactive: interactiveObj
        };

        const response = await fetch(`${WABA_CONFIG.BASE_URL}/v19.0/${WABA_CONFIG.PHONE_NUMBER_ID}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        return await response.json();
    } catch (error) {
        console.error("❌ sendWhatsAppButtons Error:", error.message);
        throw error;
    }
}

/**
 * 9. Send Interactive CTA URL Button (e.g. Visit Website / Staging Link)
 */
export async function sendWhatsAppCtaUrl(toPhone, { headerText, bodyText, footerText = 'Pentasoft Consultancy', displayText = 'Visit Website', url = 'https://planexsoftware.in/' }) {
    try {
        const token = await getWabaAuthToken();
        const formattedPhone = sanitizePhoneNumber(toPhone);

        const interactiveObj = {
            type: "cta_url",
            body: { text: bodyText },
            action: {
                name: "cta_url",
                parameters: {
                    display_text: displayText,
                    url: url
                }
            }
        };

        if (headerText) {
            interactiveObj.header = { type: "text", text: headerText };
        }
        if (footerText) {
            interactiveObj.footer = { text: footerText };
        }

        const payload = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: formattedPhone,
            type: "interactive",
            interactive: interactiveObj
        };

        const response = await fetch(`${WABA_CONFIG.BASE_URL}/v19.0/${WABA_CONFIG.PHONE_NUMBER_ID}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        return await response.json();
    } catch (error) {
        console.error("❌ sendWhatsAppCtaUrl Error:", error.message);
        throw error;
    }
}

/**
 * 7. HIGH-LEVEL WRAPPERS FOR EMS MODULES
 */

// A. Task Assignment Alert (Uses approved 'client_call' or 'task_assignment_alert')
export async function sendTaskAssignmentWhatsApp({ toPhone, clientName, location, employeeName, contactNo, taskDetails }) {
    return await sendWhatsAppTemplate(
        toPhone,
        'client_call',
        'en',
        [
            clientName || 'Client',
            location || 'Office',
            employeeName || 'Assigned Engineer',
            contactNo || '9082270423',
            taskDetails || 'New Task Assignment in EMS'
        ]
    );
}

// B. Leave Request Notification to Admin
export async function sendLeaveRequestWhatsApp({ adminPhone, employeeName, leaveType, dates, reason }) {
    const textMsg = `New Leave Application in EMS\nEmployee: ${employeeName}\nType: ${leaveType}\nDates: ${dates}\nReason: ${reason}\n\nPlease login to EMS Admin Portal to Approve or Reject.`;
    try {
        return await sendWhatsAppText(adminPhone, textMsg);
    } catch (e) {
        return await sendWhatsAppTemplate(adminPhone, 'client_call', 'en', [employeeName, 'EMS Portal', 'Admin', 'Leave Request', `${leaveType} (${dates})`]);
    }
}

// C. Out Entry Alert to Admin
export async function sendOutEntryWhatsApp({ adminPhone, employeeName, type, outTime, reason }) {
    const textMsg = `Out Entry Request\nEmployee: ${employeeName}\nType: ${type}\nOut Time: ${outTime}\nReason: ${reason}`;
    try {
        return await sendWhatsAppText(adminPhone, textMsg);
    } catch (e) {
        return await sendWhatsAppTemplate(adminPhone, 'client_call', 'en', [employeeName, 'Plant Office', employeeName, 'Out Entry', `${type} at ${outTime} (${reason})`]);
    }
}

// D. Workstation Inactivity / Idle Alert to Employee
export async function sendInactivityWhatsApp({ employeePhone, employeeName, idleMinutes }) {
    const textMsg = `EMS Workstation Alert\nHi ${employeeName}, your workstation has been inactive for ${idleMinutes} minutes.\nPlease resume your work or log your Out Entry/Break in EMS.`;
    try {
        return await sendWhatsAppText(employeePhone, textMsg);
    } catch (e) {
        return await sendWhatsAppTemplate(employeePhone, 'client_call', 'en', [employeeName, 'Workstation', 'HR Bot', 'Inactivity', `Idle > ${idleMinutes} mins`]);
    }
}

// Helper: Sanitize Phone Number (e.g. "+91 98765-43210" -> "919876543210")
export function sanitizePhoneNumber(phone) {
    if (!phone) return '918767137790';
    let cleaned = phone.replace(/[^0-9]/g, '');
    if (cleaned.length === 10) {
        cleaned = '91' + cleaned;
    }
    return cleaned;
}

/**
 * 8. Download Inbound WhatsApp Media to Local Disk
 * Fetches media information using mediaId, downloads binary, saves to /uploads/support, and returns web URL
 */
export async function downloadWabaMediaToDisk(mediaId, defaultName = 'attachment.png') {
    if (!mediaId) return null;
    try {
        const token = await getWabaAuthToken();
        const uploadDir = path.join(process.cwd(), 'uploads', 'support');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        // Step 1: Retrieve Media metadata from WABA
        const metaRes = await fetch(`${WABA_CONFIG.BASE_URL}/v19.0/${mediaId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const metaData = await metaRes.json();

        let downloadUrl = metaData?.url || `${WABA_CONFIG.BASE_URL}/v19.0/${mediaId}`;
        let mimeType = metaData?.mime_type || 'image/png';
        let ext = '.png';
        if (mimeType.includes('pdf')) ext = '.pdf';
        else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = '.jpg';
        else if (mimeType.includes('png')) ext = '.png';
        else if (mimeType.includes('excel') || mimeType.includes('sheet')) ext = '.xlsx';

        const safeFileName = `waba-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
        const filePath = path.join(uploadDir, safeFileName);

        // Step 2: Download Media Binary
        const fileRes = await fetch(downloadUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (fileRes.ok) {
            const arrayBuffer = await fileRes.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            fs.writeFileSync(filePath, buffer);
            console.log(`✅ Saved inbound WABA media to: ${filePath}`);
            return {
                url: `/uploads/support/${safeFileName}`,
                name: defaultName || safeFileName,
                type: mimeType,
                size: buffer.length
            };
        } else {
            console.warn(`⚠️ Could not download WABA media binary: status ${fileRes.status}`);
            return null;
        }
    } catch (err) {
        console.error("❌ downloadWabaMediaToDisk Error:", err.message);
        return null;
    }
}

