import { pool } from '../config/db.js';
import {
    sendWhatsAppText,
    sendWhatsAppTemplate,
    sendWhatsAppImage,
    sendWhatsAppDocument,
    sendWhatsAppListMenu,
    sendWhatsAppButtons,
    sendWhatsAppCtaUrl,
    uploadMediaToWaba,
    downloadWabaMediaToDisk,
    sanitizePhoneNumber
} from '../services/whatsapp.service.js';
import {
    identifyClient,
    getConversationContext,
    saveMessage,
    getConversationState,
    updateConversationState,
    clearConversationState,
    getActiveSupportTicket,
    getProjectStatusDetails,
    getClientInvoiceDetails
} from '../services/conversation.service.js';
import { processMessageWithAI } from '../services/ai.service.js';
import { notifyTicketWhatsApp, formatTurnaroundTime } from './support.controller.js';

// Official Department Contacts
export const SALES_HEAD_PHONE = '919821027060';
export const ACCOUNTS_HEAD_PHONE_1 = '919821027060';
export const ACCOUNTS_HEAD_PHONE_2 = '919664540011';
export const SUPPORT_ESCALATION_PHONE = '919821027060';

export const KNOWN_ENGINEER_PHONES = {
    9: { name: 'Malhar Kulkarni', phone: '+91 90822 70423', raw: '919082270423' },
    10: { name: 'Nitin RajGuru', phone: '+91 87671 37790', raw: '918767137790' },
    15: { name: 'Vijay Mourya', phone: '+91 98765 43210', raw: '919876543210' }
};

export async function resolveEngineerContacts(assignedEmployees) {
    const list = [];
    const seenIds = new Set();

    if (Array.isArray(assignedEmployees)) {
        for (const emp of assignedEmployees) {
            const empId = typeof emp === 'object' && emp ? emp.id : emp;
            const empName = typeof emp === 'object' && emp ? (emp.full_name || emp.name) : '';

            if (empId && seenIds.has(empId)) continue;
            if (empId) seenIds.add(empId);

            if (empId && KNOWN_ENGINEER_PHONES[empId]) {
                list.push(KNOWN_ENGINEER_PHONES[empId]);
                continue;
            }

            if (empName) {
                const lower = empName.toLowerCase();
                if (lower.includes('malhar')) {
                    list.push(KNOWN_ENGINEER_PHONES[9]);
                    continue;
                }
                if (lower.includes('nitin')) {
                    list.push(KNOWN_ENGINEER_PHONES[10]);
                    continue;
                }
                if (lower.includes('vijay')) {
                    list.push(KNOWN_ENGINEER_PHONES[15]);
                    continue;
                }
            }

            if (empId) {
                try {
                    const res = await pool.query('SELECT id, full_name, phone, whatsapp_no FROM employees WHERE id = $1', [empId]);
                    if (res.rows.length > 0) {
                        const r = res.rows[0];
                        const ph = r.whatsapp_no || r.phone;
                        list.push({
                            name: r.full_name || empName || 'Project Engineer',
                            phone: ph ? (ph.startsWith('+') ? ph : `+${ph}`) : '+91 87671 37790',
                            raw: ph ? sanitizePhoneNumber(ph) : '918767137790'
                        });
                        continue;
                    }
                } catch (e) {}
            }

            list.push({
                name: empName || 'Project Engineer',
                phone: '+91 87671 37790',
                raw: '918767137790'
            });
        }
    }

    if (list.length === 0) {
        list.push(KNOWN_ENGINEER_PHONES[10]); // Nitin RajGuru
        list.push(KNOWN_ENGINEER_PHONES[9]);  // Malhar Kulkarni
    }

    return list;
}

/**
 * Parse structured customer onboarding text (Company, Branch, GST, Contact, Project)
 */
export function parseCustomerInput(rawText) {
    if (!rawText) return {};
    const text = String(rawText).trim();
    const result = {
        companyName: '',
        branchName: '',
        gstNo: '',
        contactName: '',
        email: '',
        projectName: '',
        projectDesc: ''
    };

    const lines = text.split('\n');
    let matchedKV = false;
    for (const line of lines) {
        const lower = line.toLowerCase();
        if (lower.includes('company:') || lower.includes('company name:')) {
            result.companyName = line.split(/:\s*/)[1]?.trim() || '';
            matchedKV = true;
        } else if (lower.includes('gst:') || lower.includes('gstin:') || lower.includes('gst number:')) {
            result.gstNo = line.split(/:\s*/)[1]?.trim() || '';
            matchedKV = true;
        } else if (lower.includes('branch:') || lower.includes('location:')) {
            result.branchName = line.split(/:\s*/)[1]?.trim() || '';
            matchedKV = true;
        } else if (lower.includes('contact:') || lower.includes('name:') || lower.includes('person:')) {
            result.contactName = line.split(/:\s*/)[1]?.trim() || '';
            matchedKV = true;
        } else if (lower.includes('email:')) {
            result.email = line.split(/:\s*/)[1]?.trim() || '';
            matchedKV = true;
        } else if (lower.includes('project:') || lower.includes('module:') || lower.includes('app:')) {
            result.projectName = line.split(/:\s*/)[1]?.trim() || '';
            matchedKV = true;
        }
    }

    if (!matchedKV || !result.companyName) {
        const parts = text.split(/[-,\n]/).map(p => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
            result.companyName = parts[0];
            result.projectName = parts.slice(1).join(' - ');
        } else {
            result.companyName = text;
            result.projectName = text;
        }
    }

    const gstMatch = text.match(/\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}\b/i);
    if (gstMatch && !result.gstNo) {
        result.gstNo = gstMatch[0].toUpperCase();
    }

    const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
    if (emailMatch && !result.email) {
        result.email = emailMatch[0];
    }

    return result;
}

/**
 * Automatically Persist Customer & Projects in Database
 */
export async function persistCustomerInfo({ senderPhone, companyName, gstNo, branchName, contactName, email, projectName, projectDesc }) {
    try {
        const cleanedPhone = sanitizePhoneNumber(senderPhone);
        const rawDigits = senderPhone.replace(/[^0-9]/g, '');
        const last10 = rawDigits.slice(-10);

        const compName = (companyName || '').trim();
        if (!compName || compName.toLowerCase() === 'valued client' || compName.toLowerCase() === 'valued customer' || compName.toLowerCase() === 'client') {
            return null;
        }

        const existRes = await pool.query(`
            SELECT id, name, branches, contact_persons, gst_no FROM customers
            WHERE name ILIKE $1 OR contact_persons::text ILIKE $2 OR branches::text ILIKE $2
            LIMIT 1;
        `, [`%${compName}%`, `%${last10}%`]);

        let customerId;
        if (existRes.rows.length > 0) {
            customerId = existRes.rows[0].id;
            const existing = existRes.rows[0];

            let branches = existing.branches;
            if (typeof branches === 'string') { try { branches = JSON.parse(branches); } catch(e){} }
            if (!Array.isArray(branches)) branches = [];

            let contacts = existing.contact_persons;
            if (typeof contacts === 'string') { try { contacts = JSON.parse(contacts); } catch(e){} }
            if (!Array.isArray(contacts)) contacts = [];

            const branch = branchName || 'Main';
            const bIndex = branches.findIndex(b => b.branch && b.branch.toLowerCase() === branch.toLowerCase());
            const newProjObj = projectName ? { name: projectName, description: projectDesc || 'Active Module' } : null;

            if (bIndex >= 0) {
                if (gstNo) branches[bIndex].gstNo = gstNo;
                if (newProjObj && Array.isArray(branches[bIndex].projects)) {
                    if (!branches[bIndex].projects.some(p => (typeof p === 'string' ? p : p.name).toLowerCase() === projectName.toLowerCase())) {
                        branches[bIndex].projects.push(newProjObj);
                    }
                }
            } else {
                branches.push({
                    branch: branch,
                    gstNo: gstNo || existing.gst_no || '',
                    projects: newProjObj ? [newProjObj] : [],
                    assignedEmployees: [
                        { id: 10, full_name: 'Nitin RajGuru' },
                        { id: 9, full_name: 'Malhar Kulkarni' }
                    ]
                });
            }

            if (!contacts.some(c => c.phone && c.phone.includes(last10))) {
                contacts.push({
                    name: contactName || compName,
                    email: email || '',
                    phone: cleanedPhone
                });
            }

            await pool.query(`
                UPDATE customers
                SET name = COALESCE(NULLIF($1, ''), name),
                    gst_no = COALESCE(NULLIF($2, ''), gst_no),
                    branches = $3,
                    contact_persons = $4,
                    updated_at = NOW()
                WHERE id = $5;
            `, [compName, gstNo || existing.gst_no || '', JSON.stringify(branches), JSON.stringify(contacts), customerId]);

        } else {
            const branch = branchName || 'Main';
            const branches = [
                {
                    branch: branch,
                    gstNo: gstNo || '',
                    projects: projectName ? [{ name: projectName, description: projectDesc || 'Initial Scope' }] : [],
                    assignedEmployees: [
                        { id: 10, full_name: 'Nitin RajGuru' },
                        { id: 9, full_name: 'Malhar Kulkarni' }
                    ]
                }
            ];
            const contacts = [
                {
                    name: contactName || compName,
                    email: email || '',
                    phone: cleanedPhone
                }
            ];

            const insertRes = await pool.query(`
                INSERT INTO customers (
                    name, branch, gst_no, branches, contact_persons, status, priority_level, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, 'Active', 'High', NOW(), NOW())
                RETURNING id;
            `, [compName, branch, gstNo || '', JSON.stringify(branches), JSON.stringify(contacts)]);

            customerId = insertRes.rows[0].id;
        }

        if (projectName && customerId) {
            const pRes = await pool.query(`
                SELECT id FROM projects WHERE customer_id = $1 AND name ILIKE $2 LIMIT 1;
            `, [customerId, `%${projectName}%`]);

            if (pRes.rows.length === 0) {
                await pool.query(`
                    INSERT INTO projects (
                        name, customer_id, branch_name, description, status, created_at, updated_at
                    ) VALUES ($1, $2, $3, $4, 'In Progress', NOW(), NOW());
                `, [projectName, customerId, branchName || 'Main', projectDesc || 'Project managed via WhatsApp']);
            }
        }

        return customerId;
    } catch (err) {
        console.error("❌ Error in persistCustomerInfo:", err.message);
        return null;
    }
}

/**
 * Check if message expresses a direct phone call intent
 */
export function isCallIntent(text) {
    if (!text) return false;
    const lower = String(text).toLowerCase().trim();
    return lower === 'btn_call_shrirang' ||
           lower === 'call_shrirang' ||
           lower === 'call_lead' ||
           lower === 'call_sales' ||
           lower === 'call' ||
           lower === 'phone' ||
           lower.includes('call karo') ||
           lower.includes('call me') ||
           lower.includes('phone karo') ||
           lower.includes('phone pe') ||
           lower.includes('talk on call') ||
           lower.includes('talk on phone') ||
           lower.includes('direct call') ||
           lower.includes('call please') ||
           lower.includes('nobody is helping') ||
           lower.includes('already explained') ||
           lower.includes('speak to someone');
}

/**
 * Send Direct Consultation & Call Card (Section 10 & 19 of DOCX)
 */
export async function sendDirectCallCard(senderPhone, clientContext, note = '') {
    const callCard = `Direct Consultation — Planex Support Leadership

Lead Architect & Business Head:
• Shrirang Joshi: +91 98210 27060
• Direct WhatsApp: https://wa.me/919821027060

Technical Delivery Lead:
• Nitin RajGuru: +91 87671 37790

Accounts & Invoicing Desk:
• Phone: +91 96645 40011

You are welcome to connect anytime. Your conversation context and existing tickets remain linked.`;

    await sendWhatsAppText(senderPhone, callCard);

    await sendWhatsAppButtons(senderPhone, {
        headerText: "Direct Support Consultation",
        bodyText: "Tap below to connect directly with our technical leadership:",
        footerText: "Planex Support Desk",
        buttons: [
            { id: "btn_call_shrirang", title: "Call Shrirang Joshi" }
        ]
    });

    const notif = `[Direct Call Request from WhatsApp]\n\nClient: ${clientContext.name}\nPhone: ${senderPhone}\nNote: ${note || 'Client requested direct call/escalation.'}`;
    sendWhatsAppText(SALES_HEAD_PHONE, notif).catch(() => {});
}

/**
 * Send Full Commercial Proposal & Tax Invoice Ledger (Section 14 of DOCX)
 */
export async function sendProjectInvoiceDetails(senderPhone, clientContext, projectName = 'Workforce EMS', companyName = '') {
    const finalComp = companyName || clientContext.name || 'Valued Client';
    const inv = await getClientInvoiceDetails(clientContext.id);

    const invoiceMsg = `Invoice: ${inv.invoiceNumber}
Project: ${projectName}
Invoice Status: ${inv.status || 'Active GST Invoice Issued'}
Total: ₹70,800
Paid: ₹40,000
Outstanding: ₹30,800

Official Payment Account:
• Beneficiary: Pentasoft Consultancy
• Bank: HDFC Bank
• Account No: 50200063819231
• IFSC Code: HDFC0000290
• UPI ID: joshi.shrirang@hdfcbank
• GSTIN: 27AABPJ2329N1ZB

You can view the complete invoice breakdown and payment details through the EMS portal.`;

    await sendWhatsAppText(senderPhone, invoiceMsg);

    await sendWhatsAppButtons(senderPhone, {
        headerText: "Accounts & Billing",
        bodyText: "Submit payment UTR screenshot or connect with Accounts Desk:",
        footerText: "Planex Accounts Desk",
        buttons: [
            { id: "btn_call_shrirang", title: "Talk to Accounts" }
        ]
    });

    const notif = `[Invoice & Billing Accessed]\nCompany: ${finalComp}\nProject: ${projectName}\nPhone: ${senderPhone}`;
    sendWhatsAppText(ACCOUNTS_HEAD_PHONE_1, notif).catch(() => {});
    sendWhatsAppText(ACCOUNTS_HEAD_PHONE_2, notif).catch(() => {});
}

/**
 * Webhook Receiver
 */
export async function handleWebhook(req, res) {
    try {
        const body = req.body;
        res.status(200).json({ success: true, message: "Webhook acknowledged" });
        await ensureWhatsAppTables();
        processIncomingWebhookAsync(body).catch(err => {
            console.error("❌ Background Webhook Processing Error:", err.message);
        });
    } catch (error) {
        console.error("❌ Webhook error:", error.message);
        if (!res.headersSent) {
            res.status(200).json({ success: true, message: error.message });
        }
    }
}

/**
 * Background Inbound Webhook Processor
 */
async function processIncomingWebhookAsync(body) {
    const messages = extractMessagesFromPayload(body);

    for (const msg of messages) {
        const { senderPhone, msgId, timestamp, msgType, textContent, selectedId, mediaId } = msg;

        // 1. Identify Client, Employee, or Prospect from Database
        const clientContext = await identifyClient(senderPhone);
        const displayBody = textContent || selectedId || `[${msgType}]`;

        // 2. Log Inbound Message
        await saveMessage({
            wabaMsgId: msgId,
            senderPhone: senderPhone,
            recipientPhone: '919082270423',
            direction: 'inbound',
            messageType: msgType,
            messageBody: displayBody,
            mediaId: mediaId,
            status: 'received'
        });

        // 3. Check for Direct Ticket Resolution Keywords ("RESOLVED" / "TICKET END")
        if (isResolutionKeyword(textContent || selectedId)) {
            clearConversationState(senderPhone);
            await handleTicketResolutionByClient(senderPhone, clientContext);
            continue;
        }

        // 4. Check Direct Call Intent
        if (isCallIntent(textContent || selectedId)) {
            clearConversationState(senderPhone);
            await sendDirectCallCard(senderPhone, clientContext, textContent || selectedId);
            continue;
        }

        // 5. Check Interactive Button Clicks
        if (msgType === 'interactive' || msgType === 'button' || selectedId) {
            await handleInteractiveClick(senderPhone, selectedId || textContent, clientContext);
            continue;
        }

        // 6. Handle Attachments (Image, Document, Audio / Voice Note)
        let mediaAttachment = null;
        if (msgType === 'image' || msgType === 'document' || msgType === 'audio' || msgType === 'voice') {
            const ext = msgType === 'image' ? 'png' : (msgType === 'audio' || msgType === 'voice' ? 'ogg' : 'pdf');
            const defaultName = `${msgType}-${Date.now()}.${ext}`;
            mediaAttachment = {
                name: textContent && !textContent.startsWith('[') ? textContent : defaultName,
                mediaId: mediaId,
                type: msgType,
                uploadedAt: new Date().toISOString()
            };
        }

        // 7. Check In-Memory Multi-Turn State Machine (e.g. pending project, category)
        const currentState = getConversationState(senderPhone);
        if (currentState && currentState.pending_fields && currentState.pending_fields.length > 0) {
            await handlePendingStateResponse(senderPhone, textContent || displayBody, clientContext, mediaAttachment, currentState);
            continue;
        }

        // 8. Process with Grounded AI Agent (Gemini Function Calling + Fallback)
        await handleTextMessageWithAI(senderPhone, textContent || displayBody, clientContext, mediaAttachment);
    }

    handleStatusReceipts(body);
}

/**
 * Handle Multi-Turn Responses for Missing Required Fields
 */
async function handlePendingStateResponse(senderPhone, textContent, clientContext, mediaAttachment, state) {
    const rawText = String(textContent || '').trim();

    // Check if client is providing the missing project
    if (state.pending_fields.includes('project')) {
        let projectName = rawText;
        if (rawText.toLowerCase().includes('ems')) projectName = 'Workforce EMS';
        
        state.entities.project = projectName;
        state.pending_fields = state.pending_fields.filter(f => f !== 'project');

        // Check if description is also provided or still missing
        if (!state.entities.description || state.entities.description.length < 5) {
            updateConversationState(senderPhone, { entities: state.entities });
            const askDesc = `Thank you. Please briefly describe what is happening. You can also attach a screenshot or PDF log if available.`;
            await sendWhatsAppText(senderPhone, askDesc);
            return;
        }
    }

    // Check if client is providing description
    if (state.pending_fields.includes('description')) {
        state.entities.description = rawText;
        state.pending_fields = state.pending_fields.filter(f => f !== 'description');
    }

    if (mediaAttachment) {
        state.attachments = state.attachments || [];
        state.attachments.push(mediaAttachment);
    }

    // If all required fields are now satisfied, execute the action!
    if (state.intent === 'TECHNICAL_SUPPORT' || state.intent === 'BUG_REPORT' || state.intent === 'SERVER_DOWNTIME') {
        const proj = state.entities.project || 'Workforce EMS';
        const desc = state.entities.description || rawText || 'Issue reported on WhatsApp';
        const pri = state.entities.priority || 'High';
        const cat = state.entities.category || 'Bug / Defect';

        clearConversationState(senderPhone);
        await executeTicketCreation(senderPhone, {
            project: proj,
            category: cat,
            priority: pri,
            title: desc.substring(0, 60),
            description: desc,
            attachments: state.attachments || (mediaAttachment ? [mediaAttachment] : [])
        }, clientContext);
        return;
    }

    // Default: update state
    updateConversationState(senderPhone, { entities: state.entities });
}

/**
 * Universal Payload Normalizer
 */
function extractMessagesFromPayload(body) {
    const messages = [];

    if (body && (body.from || body.phone_no_id || body.wamid || body.type)) {
        const from = body.from || body.sender || body.mobile || body.phone;
        if (!from) return messages;

        let text = '';
        let selectedId = null;
        let mediaId = null;
        const msgType = body.type || 'text';

        const interactiveObj = body.interactive || body.interactive_response || {};
        const listReply = interactiveObj.list_reply || body.list_reply || body.listReply;
        const btnReply = interactiveObj.button_reply || body.button_reply || body.buttonReply || body.button;

        if (listReply) {
            text = listReply.title || listReply.id || '';
            selectedId = listReply.id || listReply.title || '';
        } else if (btnReply) {
            text = btnReply.title || btnReply.text || btnReply.id || '';
            selectedId = btnReply.id || btnReply.title || '';
        } else if (msgType === 'text' || msgType === 'interactive' || body.text) {
            let rawBody = typeof body.text === 'object' ? (body.text?.body || '') : (body.text || body.message || body.body || '');
            if (typeof rawBody === 'string' && (rawBody.trim().startsWith('{') || rawBody.includes('list_reply') || rawBody.includes('button_reply'))) {
                try {
                    const parsed = JSON.parse(rawBody);
                    if (parsed.list_reply) {
                        selectedId = parsed.list_reply.id || parsed.list_reply.title || '';
                        text = parsed.list_reply.title || parsed.list_reply.id || '';
                    } else if (parsed.button_reply) {
                        selectedId = parsed.button_reply.id || parsed.button_reply.title || '';
                        text = parsed.button_reply.title || parsed.button_reply.id || '';
                    }
                } catch (e) {}
            }
            if (!text) text = rawBody;
        } else if (msgType === 'image') {
            mediaId = body.image?.id || body.media_id;
            text = body.image?.caption || '[Image]';
        } else if (msgType === 'document') {
            mediaId = body.document?.id || body.media_id;
            text = body.document?.filename || '[Document]';
        } else if (msgType === 'audio' || msgType === 'voice') {
            mediaId = body.audio?.id || body.voice?.id || body.media_id;
            text = '[Audio / Voice Note]';
        }

        if (!selectedId && body.selected_id) selectedId = body.selected_id;
        if (!text && body.message) text = body.message;
        if (!text && selectedId) text = selectedId;

        // Map text to known interactive IDs
        if (!selectedId && (msgType === 'interactive' || msgType === 'button' || text)) {
            const lower = (text || '').toLowerCase().trim();
            if (lower === 'btn_menu_sales' || lower.includes('sales & projects') || lower === 'sales' || lower === '1') selectedId = 'btn_menu_sales';
            else if (lower === 'btn_menu_accounts' || lower.includes('accounts & billing') || lower === 'accounts' || lower === 'billing' || lower === '2') selectedId = 'btn_menu_accounts';
            else if (lower === 'btn_menu_support' || lower.includes('technical support') || lower === 'support' || lower === '3') selectedId = 'btn_menu_support';
            else if (lower.includes('btn_call_shrirang') || lower.includes('call shrirang') || lower === 'call') selectedId = 'btn_call_shrirang';
            else if (lower.includes('check status') || lower.includes('ticket status')) selectedId = 'btn_check_status';
            else if (lower.includes('close ticket') || lower === 'close it') selectedId = 'btn_close_ticket';
        }

        messages.push({
            senderPhone: String(from),
            msgId: body.wamid || body.id || `MSG-${Date.now()}`,
            timestamp: body.timestamp ? new Date(parseInt(body.timestamp) * 1000) : new Date(),
            msgType: selectedId ? 'interactive' : msgType,
            textContent: text,
            selectedId: selectedId,
            mediaId: mediaId
        });
        return messages;
    }

    if (body?.entry && Array.isArray(body.entry)) {
        for (const entry of body.entry) {
            for (const change of (entry.changes || [])) {
                const value = change.value;
                if (!value?.messages) continue;
                for (const msg of value.messages) {
                    let text = '';
                    let selectedId = null;
                    let mediaId = null;

                    if (msg.type === 'text') {
                        text = msg.text?.body || '';
                    } else if (msg.type === 'interactive') {
                        if (msg.interactive?.type === 'button_reply') {
                            text = msg.interactive.button_reply.title || '';
                            selectedId = msg.interactive.button_reply.id;
                        } else if (msg.interactive?.type === 'list_reply') {
                            text = msg.interactive.list_reply.title || '';
                            selectedId = msg.interactive.list_reply.id;
                        }
                    } else if (msg.type === 'image') {
                        mediaId = msg.image?.id;
                        text = msg.image?.caption || '[Image]';
                    } else if (msg.type === 'document') {
                        mediaId = msg.document?.id;
                        text = msg.document?.filename || '[Document]';
                    } else if (msg.type === 'audio' || msg.type === 'voice') {
                        mediaId = msg.audio?.id || msg.voice?.id;
                        text = '[Audio / Voice Note]';
                    }

                    messages.push({
                        senderPhone: String(msg.from),
                        msgId: msg.id,
                        timestamp: new Date(parseInt(msg.timestamp) * 1000 || Date.now()),
                        msgType: selectedId ? 'interactive' : msg.type,
                        textContent: text,
                        selectedId: selectedId,
                        mediaId: mediaId
                    });
                }
            }
        }
    }

    return messages;
}

function handleStatusReceipts(body) {
    try {
        if (body?.statuses && Array.isArray(body.statuses)) {
            for (const statusObj of body.statuses) {
                pool.query(`
                    UPDATE whatsapp_messages 
                    SET status = $1, updated_at = NOW()
                    WHERE waba_message_id = $2;
                `, [statusObj.status, statusObj.id]).catch(() => {});
            }
        }
    } catch (e) {}
}

/**
 * Handle Interactive Buttons / List Menu selection
 */
async function handleInteractiveClick(senderPhone, selectedId, clientContext) {
    const key = String(selectedId || '').toLowerCase().trim();

    if (key === 'btn_call_shrirang' || key.includes('call_shrirang') || key === 'call_lead' || key.includes('talk to') || key.includes('call shrirang')) {
        await sendDirectCallCard(senderPhone, clientContext, 'User clicked Call Shrirang / Talk to Support button');
        return;
    }

    if (key === 'btn_check_status' || key.includes('check status') || key.includes('status')) {
        await handleTicketStatusQuery(senderPhone, clientContext);
        return;
    }

    if (key === 'btn_close_ticket' || key.includes('close ticket') || key.includes('close')) {
        await handleTicketResolutionByClient(senderPhone, clientContext);
        return;
    }

    if (key === 'btn_menu_sales' || key === 'srv_sales' || key.includes('sales')) {
        await sendSalesSubMenu(senderPhone, clientContext);
        return;
    }

    if (key === 'btn_menu_accounts' || key === 'srv_accounts' || key.includes('accounts') || key.includes('billing')) {
        await sendProjectInvoiceDetails(senderPhone, clientContext, 'Workforce EMS');
        return;
    }

    if (key === 'btn_menu_support' || key === 'srv_support' || key.includes('support') || key.includes('technical')) {
        await startSupportTicketFlow(senderPhone, clientContext);
        return;
    }

    // Sales Packages
    if (key === 'srv_web' || key.includes('web')) {
        const webCard = `Planex Software — Web Development Package

Core Capabilities:
• Responsive Web Portal & SaaS Architecture
• Backend API Engine (Node.js / PostgreSQL)
• Role-based Admin Control & Security
• Analytics, Live Reports & PDF Export

Would you like to share your requirements document or discuss the project with our team?`;
        await sendWhatsAppText(senderPhone, webCard);
        await sendWhatsAppButtons(senderPhone, {
            headerText: "Requirements & Scope",
            bodyText: "Share your requirements document or connect with our lead architect:",
            footerText: "Planex Enterprise Hub",
            buttons: [
                { id: "req_yes_excel", title: "Yes, Have Document" },
                { id: "req_no_excel", title: "Please Guide Me" },
                { id: "btn_call_shrirang", title: "Talk to Sales" }
            ]
        });
        return;
    }

    if (key === 'srv_app' || key.includes('app')) {
        const appCard = `Planex Software — Mobile App Development Package

Core Capabilities:
• Android & iOS Cross-Platform Applications
• Push Notifications & Background Sync
• Camera, Barcode / QR Scanner & Bluetooth Printers
• Offline Database Cache & Auto-Sync
• Biometric Authentication & Secure Auth

Would you like to share your requirements document or discuss the project with our team?`;
        await sendWhatsAppText(senderPhone, appCard);
        await sendWhatsAppButtons(senderPhone, {
            headerText: "Requirements & Scope",
            bodyText: "Share your requirements document or connect with our lead architect:",
            footerText: "Planex Mobile Engineering",
            buttons: [
                { id: "req_yes_excel", title: "Yes, Have Document" },
                { id: "req_no_excel", title: "Please Guide Me" },
                { id: "btn_call_shrirang", title: "Talk to Sales" }
            ]
        });
        return;
    }

    if (key === 'req_yes_excel') {
        const docPrompt = `Please attach the Excel, Word, or PDF document here. Once received, I will link it to your project inquiry for review.`;
        await sendWhatsAppText(senderPhone, docPrompt);
        return;
    }

    if (key === 'req_no_excel') {
        const guideMsg = `No problem. You can describe your project requirements in a few lines here, or connect directly with our Lead Architect Shrirang Joshi (+91 98210 27060).`;
        await sendWhatsAppText(senderPhone, guideMsg);
        return;
    }

    // Default fallback: send main menu
    await sendServicesMenu(senderPhone, clientContext);
}

/**
 * Start Technical Support Ticket Flow
 */
export async function startSupportTicketFlow(senderPhone, clientContext) {
    const activeTicket = await getActiveSupportTicket(senderPhone, clientContext.id);
    if (activeTicket) {
        const activeMsg = `Active Support Request Found\n\nTicket: ${activeTicket.ticket_code}\nProject: ${activeTicket.project_name || 'Workforce EMS'}\nPriority: ${activeTicket.priority || 'High'}\nStatus: ${activeTicket.status || 'Open'}\nAssigned To: ${activeTicket.assigned_engineer_name || 'Nitin RajGuru'}\n\nYou currently have an open ticket. You can track its live progress or send new issue details below.`;
        await sendWhatsAppText(senderPhone, activeMsg);
        await sendWhatsAppButtons(senderPhone, {
            headerText: "Support Options",
            bodyText: "Track existing ticket or talk to support:",
            footerText: "Planex Technical Support",
            buttons: [
                { id: "btn_check_status", title: "Check Status" },
                { id: "btn_close_ticket", title: "Close Ticket" },
                { id: "btn_call_shrirang", title: "Talk to Support" }
            ]
        });
        return;
    }

    const projName = clientContext.projects?.[0]?.name || 'Workforce EMS';
    updateConversationState(senderPhone, {
        intent: 'TECHNICAL_SUPPORT',
        pending_fields: ['description'],
        entities: { project: projName, priority: 'High', category: 'Bug / Defect' }
    });

    const promptText = `Planex Technical Support Desk\n\nClient: ${clientContext.name || 'Valued Client'}\nProject: ${projName}\n\nPlease describe the issue or error you are experiencing (e.g. login failed, server slow, report mismatch, or attach a screenshot/video).\n\nOur engineering team will immediately register a priority ticket and assign a dedicated engineer.`;
    await sendWhatsAppText(senderPhone, promptText);
    await sendWhatsAppButtons(senderPhone, {
        headerText: "Technical Support",
        bodyText: "Send your issue details or connect directly with our support team:",
        footerText: "Planex Technical Support",
        buttons: [
            { id: "btn_call_shrirang", title: "Talk to Support" }
        ]
    });
}

/**
 * Handle AI Tool Calls and Natural Text Message
 */
async function handleTextMessageWithAI(senderPhone, textContent, clientContext, mediaAttachment = null) {
    if (isGreeting(textContent)) {
        await sendServicesMenu(senderPhone, clientContext);
        return;
    }

    const history = await getConversationContext(senderPhone, 8);
    const aiResult = await processMessageWithAI({
        senderPhone,
        userMessage: textContent,
        clientContext,
        conversationHistory: history
    });

    console.log("🤖 AI Reasoning Result:", JSON.stringify(aiResult));

    if (aiResult.toolCall) {
        const { name, args } = aiResult.toolCall;

        // Tool: create_support_ticket
        if (name === 'create_support_ticket') {
            const project = args.project || (clientContext.projects?.[0]?.name) || null;
            const desc = args.description || textContent;
            const category = args.category || 'Bug / Defect';
            const priority = args.priority || (args.is_urgent ? 'High' : 'Medium');

            // If project is missing and customer has multiple/no projects, ask for project first (Section 4 DOCX)
            if (!project && (!clientContext.projects || clientContext.projects.length !== 1)) {
                updateConversationState(senderPhone, {
                    intent: 'TECHNICAL_SUPPORT',
                    entities: { category, priority, description: desc },
                    pending_fields: ['project'],
                    attachments: mediaAttachment ? [mediaAttachment] : []
                });

                const askProject = `I can help register this. I have the issue type, but I still need the affected project.\nWhich project is affected?`;
                await sendWhatsAppText(senderPhone, askProject);
                return;
            }

            // Execute ticket creation or duplicate prevention
            await executeTicketCreation(senderPhone, {
                project: project || clientContext.projects?.[0]?.name || 'Workforce EMS',
                category: category,
                priority: priority,
                title: desc.substring(0, 60),
                description: desc,
                attachments: mediaAttachment ? [mediaAttachment] : []
            }, clientContext);
            return;
        }

        // Tool: check_ticket_status
        if (name === 'check_ticket_status') {
            await handleTicketStatusQuery(senderPhone, clientContext, args.ticket_code);
            return;
        }

        // Tool: resolve_support_ticket
        if (name === 'resolve_support_ticket') {
            await handleTicketResolutionByClient(senderPhone, clientContext);
            return;
        }

        // Tool: get_invoice_and_billing
        if (name === 'get_invoice_and_billing') {
            await sendProjectInvoiceDetails(senderPhone, clientContext, args.project || 'Workforce EMS');
            return;
        }

        // Tool: report_payment_evidence (Section 15 DOCX)
        if (name === 'report_payment_evidence') {
            const receiptAck = `Payment Evidence Received\n\nI have attached your payment confirmation for verification.\nThe payment will be marked as received only after the payment record is verified in EMS by Accounts Desk.`;
            await sendWhatsAppText(senderPhone, receiptAck);

            const notif = `[Payment UTR Submitted on WhatsApp]\nClient: ${clientContext.name}\nPhone: ${senderPhone}\nDetails: ${args.notes || textContent}`;
            sendWhatsAppText(ACCOUNTS_HEAD_PHONE_1, notif).catch(() => {});
            sendWhatsAppText(ACCOUNTS_HEAD_PHONE_2, notif).catch(() => {});
            return;
        }

        // Tool: apply_employee_leave (Section 18 DOCX)
        if (name === 'apply_employee_leave') {
            await handleEmployeeLeaveRequest(senderPhone, clientContext, args);
            return;
        }

        // Tool: modify_conversation_context (Section 8 DOCX)
        if (name === 'modify_conversation_context') {
            const field = args.field || 'project';
            const val = args.new_value || 'Workforce EMS';
            updateConversationState(senderPhone, {
                entities: { [field]: val }
            });

            const ackMod = `Understood. I have updated the affected ${field} to ${val}. I will use the updated ${field} when creating the request.`;
            await sendWhatsAppText(senderPhone, ackMod);
            return;
        }

        // Tool: handover_to_team
        if (name === 'handover_to_team') {
            await sendDirectCallCard(senderPhone, clientContext, args.reason || textContent);
            return;
        }

        // Tool: select_service
        if (name === 'select_service') {
            const srv = (args.service_type || '').toLowerCase();
            if (srv.includes('app')) await handleInteractiveClick(senderPhone, 'srv_app', clientContext);
            else await handleInteractiveClick(senderPhone, 'srv_web', clientContext);
            return;
        }

        // Tool: send_services_menu
        if (name === 'send_services_menu') {
            await sendServicesMenu(senderPhone, clientContext);
            return;
        }
    }

    if (aiResult.replyText) {
        await sendWhatsAppText(senderPhone, aiResult.replyText);
    }
}

/**
 * Section 3 & 7: Execute Ticket Creation with Duplicate Prevention
 */
async function executeTicketCreation(senderPhone, { project, category, priority, title, description, attachments = [] }, clientContext) {
    try {
        const customerId = clientContext.id;
        const customerName = clientContext.name || 'Valued Client';
        const projectName = project || 'Workforce EMS';

        // Check for Existing Open Ticket (Duplicate Prevention - Section 7 DOCX)
        const activeTicket = await getActiveSupportTicket(senderPhone, customerId);
        if (activeTicket && (activeTicket.project_name?.toLowerCase() === projectName.toLowerCase() || !activeTicket.project_name)) {
            console.log(`🛡️ Duplicate Ticket Prevented! Appending to existing Ticket ${activeTicket.ticket_code}`);

            // Download media if attached
            if (attachments.length > 0 && attachments[0].mediaId) {
                const dl = await downloadWabaMediaToDisk(attachments[0].mediaId, attachments[0].name);
                if (dl && dl.url) {
                    attachments[0].url = dl.url;
                    attachments[0].size = dl.size;
                }
            }

            // Append to history
            await pool.query(`
                INSERT INTO support_ticket_history (ticket_id, performed_by, action, details)
                VALUES ($1, 'Customer (WhatsApp)', 'Additional Message Appended', $2)
            `, [activeTicket.id, `Customer message: ${description}`]);

            const dupMsg = `I understand this is urgent. You already have an active support request for this issue.

Ticket: ${activeTicket.ticket_code}
Project: ${activeTicket.project_name || projectName}
Priority: ${activeTicket.priority || 'High'}
Status: ${activeTicket.status || 'Open'}
Assigned To: ${activeTicket.assigned_engineer_name || 'Nitin RajGuru'}

I have added your latest message to the existing ticket instead of creating a duplicate.`;

            await sendWhatsAppText(senderPhone, dupMsg);

            await sendWhatsAppButtons(senderPhone, {
                headerText: "Existing Ticket Linked",
                bodyText: "View ticket progress or connect with support team:",
                footerText: "Planex Technical Support",
                buttons: [
                    { id: "btn_check_status", title: "Check Status" },
                    { id: "btn_call_shrirang", title: "Talk to Support" }
                ]
            });
            return;
        }

        // Download attachment if present
        if (attachments.length > 0 && attachments[0].mediaId) {
            const dl = await downloadWabaMediaToDisk(attachments[0].mediaId, attachments[0].name);
            if (dl && dl.url) {
                attachments[0].url = dl.url;
                attachments[0].size = dl.size;
            }
        }

        // Generate Ticket Code
        const tCountRes = await pool.query(`SELECT id FROM support_tickets ORDER BY id DESC LIMIT 1`);
        const nextId = (tCountRes.rows[0]?.id || 0) + 101;
        const ticketCode = `SUP-${String(nextId).padStart(6, '0')}`;

        // Determine Assignee (Nitin RajGuru ID 10 default)
        const assignedEmployees = [
            { id: 10, full_name: 'Nitin RajGuru' },
            { id: 9, full_name: 'Malhar Kulkarni' }
        ];

        // SLA Calculation (Section 3 & 9 DOCX)
        const now = new Date();
        let respMinutes = 120; // 2 hours
        let resoMinutes = 1440; // 24 hours
        let slaText = '24 hours';

        const pri = (priority || 'High').toLowerCase();
        if (pri.includes('critical')) {
            respMinutes = 30;
            resoMinutes = 240;
            slaText = '4 hours';
        } else if (pri.includes('high')) {
            respMinutes = 120;
            resoMinutes = 1440;
            slaText = '24 hours';
        } else if (pri.includes('medium')) {
            respMinutes = 480;
            resoMinutes = 4320;
            slaText = '3 days';
        }

        const responseDeadline = new Date(now.getTime() + respMinutes * 60000);
        const resolutionDeadline = new Date(now.getTime() + resoMinutes * 60000);

        // Insert into PostgreSQL support_tickets
        const insertRes = await pool.query(`
            INSERT INTO support_tickets (
                ticket_code, customer_id, project_name, reported_by, customer_phone, source,
                title, description, category, priority, status,
                assigned_to, assigned_team, attachments,
                response_deadline, resolution_deadline, created_at
            ) VALUES ($1, $2, $3, $4, $5, 'WHATSAPP', $6, $7, $8, $9, 'Open', $10, $11, $12, $13, $14, NOW())
            RETURNING *
        `, [
            ticketCode,
            customerId || null,
            projectName,
            customerName,
            sanitizePhoneNumber(senderPhone),
            title || description.substring(0, 60),
            description,
            category || 'Bug / Defect',
            priority || 'High',
            10, // Nitin RajGuru
            JSON.stringify(assignedEmployees),
            JSON.stringify(attachments),
            responseDeadline,
            resolutionDeadline
        ]);

        const newTicket = insertRes.rows[0];

        // History record
        await pool.query(`
            INSERT INTO support_ticket_history (ticket_id, performed_by, action, new_status, details)
            VALUES ($1, 'Customer (WhatsApp)', 'Ticket Registered', 'Open', $2)
        `, [newTicket.id, `Created from WhatsApp: ${title || description}`]);

        // Alert Engineers & Create Portal Inbox Notification
        notifyTicketWhatsApp({
            ticketCode,
            title: title || description,
            description,
            priority: priority || 'High',
            assignedToId: 10,
            assignedTeam: assignedEmployees,
            customerName,
            projectName,
            actionType: 'created',
            attachments
        });

        // Structured Receipt (Section 3 of DOCX)
        const ticketReceipt = `Support Request Registered

Ticket: ${ticketCode}
Project: ${projectName}
Category: ${category}
Priority: ${priority}
Assigned To: Nitin RajGuru
Response SLA: ${slaText}
Status: Open`;

        await sendWhatsAppText(senderPhone, ticketReceipt);

        await sendWhatsAppButtons(senderPhone, {
            headerText: "Ticket Actions",
            bodyText: "Track progress or connect with assigned engineer:",
            footerText: "Planex Technical Support",
            buttons: [
                { id: "btn_check_status", title: "Check Status" },
                { id: "btn_call_shrirang", title: "Talk to Support" }
            ]
        });

    } catch (err) {
        console.error("❌ executeTicketCreation Error:", err.message);
        const failMsg = `I’m unable to complete the ticket registration right now.\nYour request has not been registered yet, so I do not want to give you a false ticket number.\nPlease try again shortly or contact our support team directly.`;
        await sendWhatsAppText(senderPhone, failMsg);
    }
}

/**
 * Section 6: Live Ticket Status Query
 */
async function handleTicketStatusQuery(senderPhone, clientContext, ticketCode = null) {
    try {
        const ticket = await getActiveSupportTicket(senderPhone, clientContext.id);

        if (!ticket) {
            const noTicket = `No active open support ticket was found for your account.\nIf you are facing an issue, please send a message or screenshot to raise a request.`;
            await sendWhatsAppText(senderPhone, noTicket);
            return;
        }

        const statusMsg = `Support Request Status

Ticket: ${ticket.ticket_code}
Project: ${ticket.project_name || 'Workforce EMS'}
Category: ${ticket.category || 'Technical Support'}
Priority: ${ticket.priority || 'High'}
Status: ${ticket.status || 'In Progress'}
Assigned To: ${ticket.assigned_engineer_name || 'Nitin RajGuru'}
Response SLA: 24 hours

The latest status is based on the EMS system.`;

        await sendWhatsAppText(senderPhone, statusMsg);

        await sendWhatsAppButtons(senderPhone, {
            headerText: "Ticket Actions",
            bodyText: "If the issue has been resolved on your end:",
            footerText: "Planex Support Desk",
            buttons: [
                { id: "btn_close_ticket", title: "Close Ticket" },
                { id: "btn_call_shrirang", title: "Talk to Support" }
            ]
        });
    } catch (err) {
        console.error("❌ handleTicketStatusQuery Error:", err.message);
    }
}

/**
 * Section 17: Ticket Resolution Handler
 */
export async function handleTicketResolutionByClient(senderPhone, clientContext) {
    try {
        const ticket = await getActiveSupportTicket(senderPhone, clientContext.id);

        if (!ticket) {
            const noTicket = `Hello ${clientContext.name}, no active open support ticket was found under your account.`;
            await sendWhatsAppText(senderPhone, noTicket);
            return;
        }

        const updateRes = await pool.query(`
            UPDATE support_tickets 
            SET status = 'Closed', resolved_at = NOW(), updated_at = NOW()
            WHERE id = $1
            RETURNING *, EXTRACT(EPOCH FROM (NOW() - created_at)) AS elapsed_seconds;
        `, [ticket.id]);

        const elapsedSec = Number(updateRes.rows[0]?.elapsed_seconds);
        const durationStr = !isNaN(elapsedSec) ? formatTurnaroundTime(elapsedSec) : formatTurnaroundTime(ticket.created_at, new Date());

        await pool.query(`
            INSERT INTO support_ticket_history (ticket_id, performed_by, action, previous_status, new_status, details)
            VALUES ($1, 'Customer (WhatsApp)', 'Ticket Closed', $2, 'Closed', 'Ticket closed by customer confirmation.')
        `, [ticket.id, ticket.status]);

        const closeReceipt = `Ticket ${ticket.ticket_code} has been closed successfully.

Project: ${ticket.project_name || 'Workforce EMS'}
Resolution Status: Closed
Resolution Time: ${durationStr}

Thank you for confirming the resolution.`;

        await sendWhatsAppText(senderPhone, closeReceipt);

        notifyTicketWhatsApp({
            ticketCode: ticket.ticket_code,
            title: ticket.title,
            customerName: ticket.customer_name || clientContext.name,
            projectName: ticket.project_name || 'Workforce EMS',
            assignedToId: ticket.assigned_to,
            assignedTeam: ticket.assigned_team,
            actionType: 'resolved',
            turnaroundTime: durationStr
        });
    } catch (err) {
        console.error("❌ handleTicketResolutionByClient Error:", err.message);
    }
}

/**
 * Section 18: Employee Leave Request
 */
async function handleEmployeeLeaveRequest(senderPhone, clientContext, { leave_type, start_date, end_date, reason }) {
    try {
        const empName = clientContext.name || 'Employee';
        const lType = leave_type || 'Casual Leave';
        const dateStr = start_date || 'Tomorrow';

        // Insert leave request into database
        if (clientContext.id) {
            await pool.query(`
                INSERT INTO leaves (
                    employee_id, leave_type, start_date, end_date, total_days, reason, status, created_at
                ) VALUES ($1, $2, CURRENT_DATE + INTERVAL '1 day', CURRENT_DATE + INTERVAL '1 day', 1, $3, 'Pending', NOW())
            `, [clientContext.id, lType, reason || 'Applied via WhatsApp']);
        }

        const leaveReceipt = `Leave Application Submitted

Employee: ${empName}
Leave Type: ${lType}
Date: ${dateStr}
Status: Pending Manager Approval

Your leave application has been recorded in EMS and forwarded to Administration.`;

        await sendWhatsAppText(senderPhone, leaveReceipt);

        // Alert Admin
        sendWhatsAppText(SALES_HEAD_PHONE, `[New Leave Request via WhatsApp]\nEmployee: ${empName}\nType: ${lType}\nDate: ${dateStr}\nReason: ${reason || 'Personal'}`).catch(() => {});
    } catch (err) {
        console.error("❌ handleEmployeeLeaveRequest Error:", err.message);
    }
}

/**
 * Section 2: Welcome / Main Menu
 */
export async function sendServicesMenu(senderPhone, clientContext) {
    const custName = clientContext.name && clientContext.name !== 'Valued Client' ? clientContext.name : 'Valued Customer';
    return await sendWhatsAppButtons(senderPhone, {
        headerText: "Planex Software",
        bodyText: `Hello ${custName}, thank you for connecting with Planex Software.\n\nHow can we assist you today?`,
        footerText: "Planex Enterprise Hub",
        buttons: [
            { id: "btn_menu_sales", title: "Sales & Projects" },
            { id: "btn_menu_accounts", title: "Accounts & Billing" },
            { id: "btn_menu_support", title: "Technical Support" }
        ]
    });
}

/**
 * Sub-Menu: Sales
 */
export async function sendSalesSubMenu(senderPhone, clientContext) {
    const custName = clientContext.name || 'Valued Client';
    const salesIntro = `Planex Software — Enterprise Solutions

Hello ${custName}, we engineer high-performance software systems:
• Web Applications & Cloud SaaS Portals
• Mobile Apps (Android & iOS Cross-Platform)
• Full-Stack Enterprise Systems & IoT

Please choose an area of interest:`;

    await sendWhatsAppText(senderPhone, salesIntro);

    await sendWhatsAppButtons(senderPhone, {
        headerText: "Development Packages",
        bodyText: "Select your required technology package:",
        footerText: "Planex Enterprise Hub",
        buttons: [
            { id: "srv_web", title: "Web Application" },
            { id: "srv_app", title: "Mobile App" },
            { id: "btn_call_shrirang", title: "Talk to Sales" }
        ]
    });
}

/**
 * Helper: Identify Greeting
 */
function isGreeting(text) {
    if (!text) return false;
    const lower = String(text).toLowerCase().trim();
    if (lower.includes('slow') || lower.includes('issue') || lower.includes('error') || lower.includes('bug') || 
        lower.includes('invoice') || lower.includes('bill') || lower.includes('status') || lower.includes('leave') || lower.includes('utr')) {
        return false;
    }
    const clean = lower.replace(/[^a-z0-9\s]/g, '').trim();
    const greetings = ['hi', 'hello', 'hey', 'start', 'menu', 'namaste', 'halo', 'yo', 'good morning', 'good evening'];
    return greetings.includes(clean);
}

/**
 * Helper: Identify Resolution Keyword
 */
export function isResolutionKeyword(text) {
    if (!text) return false;
    const lower = String(text).toLowerCase().trim();
    return lower === 'resolved' || 
           lower.includes('ticket end') || 
           lower.includes('close ticket') || 
           lower.includes('issue solved') || 
           lower.includes('problem solved') || 
           lower.includes('kam ho gaya') ||
           lower.includes('sab theek hai') ||
           lower === 'close it';
}

/**
 * Send Direct Message from EMS Web Portal
 */
export async function sendDirectMessage(req, res) {
    try {
        const { toPhone, messageType, text, templateName, templateParams, caption } = req.body;
        if (!toPhone) {
            return res.status(400).json({ success: false, message: "Recipient phone number is required" });
        }

        const phone = sanitizePhoneNumber(toPhone);
        let result = null;

        if (req.file) {
            const filePath = req.file.path;
            const originalName = req.file.originalname;
            const mimeType = req.file.mimetype;

            if (mimeType.startsWith('image/')) {
                result = await sendWhatsAppImage(phone, filePath, caption || text || '', originalName, mimeType);
            } else {
                result = await sendWhatsAppDocument(phone, filePath, originalName, caption || text || '');
            }
        } else if (messageType === 'template') {
            const tplName = templateName || 'client_call';
            const params = templateParams ? (Array.isArray(templateParams) ? templateParams : JSON.parse(templateParams)) : ['Client', 'Office', 'Admin', '9082270423', text || 'EMS Notification'];
            result = await sendWhatsAppTemplate(phone, tplName, 'en', params);
        } else {
            result = await sendWhatsAppText(phone, text || 'Hello from Planex EMS!');
        }

        const wabaMsgId = result?.messages?.[0]?.id || `OUT-${Date.now()}`;
        await saveMessage({
            wabaMsgId,
            senderPhone: '919082270423',
            recipientPhone: phone,
            direction: 'outbound',
            messageType: req.file ? 'media' : (messageType || 'text'),
            messageBody: text || caption || 'Outbound Message',
            status: 'sent'
        });

        res.status(200).json({
            success: true,
            data: result,
            message: "WhatsApp message delivered successfully!"
        });
    } catch (error) {
        console.error("❌ sendDirectMessage Error:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
}

/**
 * Fetch WhatsApp Chat History
 */
export async function getChatHistory(req, res) {
    try {
        const { phone } = req.params;
        const cleanedPhone = sanitizePhoneNumber(phone);
        await ensureWhatsAppTables();

        const result = await pool.query(`
            SELECT * FROM whatsapp_messages 
            WHERE sender_phone = $1 OR recipient_phone = $1 
               OR sender_phone = $2 OR recipient_phone = $2
            ORDER BY created_at ASC;
        `, [cleanedPhone, phone]);

        res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        console.error("❌ getChatHistory Error:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
}

async function ensureWhatsAppTables() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS whatsapp_messages (
                id SERIAL PRIMARY KEY,
                waba_message_id VARCHAR(100),
                sender_phone VARCHAR(50) NOT NULL,
                recipient_phone VARCHAR(50) NOT NULL,
                direction VARCHAR(20) NOT NULL,
                message_type VARCHAR(50) DEFAULT 'text',
                message_body TEXT,
                media_id VARCHAR(100),
                status VARCHAR(50) DEFAULT 'sent',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
    } catch (e) {}
}

export async function getMediaStream(req, res) {
    try {
        const { mediaId } = req.params;
        if (!mediaId || mediaId === 'null' || mediaId === 'undefined') {
            return res.status(404).json({ success: false, message: 'Invalid or missing media ID' });
        }

        const downloaded = await downloadWabaMediaToDisk(mediaId);
        if (downloaded && downloaded.url) {
            return res.redirect(downloaded.url);
        }

        return res.status(404).json({ success: false, message: 'Media attachment could not be downloaded.' });
    } catch (err) {
        console.error("❌ getMediaStream Error:", err.message);
        return res.status(500).json({ success: false, message: err.message });
    }
}
