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
    getProjectStatusDetails,
    getClientInvoiceDetails
} from '../services/conversation.service.js';
import { processMessageWithAI } from '../services/ai.service.js';
import { notifyTicketWhatsApp, formatTurnaroundTime } from './support.controller.js';

// In-Memory Interactive Ticket Drafts State Machine
export const clientTicketDrafts = new Map();

/**
 * 1. Webhook Receiver: Immediately responds with 200 OK, processes in background
 */
export async function handleWebhook(req, res) {
    try {
        const body = req.body;

        // Immediately acknowledge vendor WABA server with 200 OK
        res.status(200).json({ success: true, message: "Webhook acknowledged" });

        // Ensure database table exists
        await ensureWhatsAppTables();

        // Process message asynchronously
        processIncomingWebhookAsync(body).catch(err => {
            console.error("❌ Background Webhook Processing Error:", err.message);
        });
    } catch (error) {
        console.error("❌ Webhook error:", error.message);
        // Ensure response is returned even in unexpected catch
        if (!res.headersSent) {
            res.status(200).json({ success: true, message: error.message });
        }
    }
}

/**
 * Background Asynchronous Webhook Processor (AI Agent + Guardrails)
 */
/**
 * Universal Inbound Message Processor (Ultra-Resilient)
 */
async function processIncomingWebhookAsync(body) {
    console.log("📥 Raw Inbound Webhook Payload:", JSON.stringify(body));

    const messages = extractMessagesFromPayload(body);
    console.log(`📥 Webhook Parsed ${messages.length} incoming messages.`);

    for (const msg of messages) {
        const { senderPhone, msgId, timestamp, msgType, textContent, selectedId, mediaId } = msg;

        // 1. Identify Client & Active Projects from Database
        const clientContext = await identifyClient(senderPhone);
        console.log(`👤 Identified Sender (${senderPhone}):`, clientContext.name, `[${clientContext.type}]`);

        const displayBody = textContent || selectedId || `[${msgType}]`;

        // 2. Log Inbound Message to Database
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

        // ==========================================================
        // ROUTE 0: CLIENT TICKET RESOLUTION KEYWORDS ("RESOLVED" / "TICKET END")
        // ==========================================================
        if (isResolutionKeyword(textContent || selectedId)) {
            console.log(`🎯 Resolution keyword detected from ${senderPhone}: "${textContent || selectedId}"`);
            clientTicketDrafts.delete(senderPhone);
            await handleTicketResolutionByClient(senderPhone, clientContext);
            continue;
        }

        // ==========================================================
        // ROUTE 1: DETERMINISTIC BUTTON / LIST MENU CLICKS
        // ==========================================================
        if (msgType === 'interactive' || msgType === 'button' || selectedId) {
            await handleInteractiveClick(senderPhone, selectedId || textContent, clientContext);
            continue;
        }

        // ==========================================================
        // ROUTE 2: ACTIVE SUPPORT TICKET DRAFT FLOW HANDLER
        // ==========================================================
        const activeDraft = clientTicketDrafts.get(senderPhone);
        if (activeDraft) {
            console.log(`📋 Active Support Draft for ${senderPhone} at step: [${activeDraft.step}]`);

            if (activeDraft.step === 'awaiting_details') {
                if (msgType === 'document') {
                    const docName = textContent || 'Document.pdf';
                    const mediaAttachment = {
                        name: docName,
                        mediaId: mediaId,
                        type: 'document',
                        uploadedAt: new Date().toISOString()
                    };
                    await handleSupportTicketCreation(senderPhone, textContent || `Document Attachment: ${docName}`, clientContext, mediaAttachment, activeDraft);
                } else if (msgType === 'image') {
                    const caption = textContent && textContent !== '[Image]' ? textContent : 'Screenshot of error';
                    const mediaAttachment = {
                        name: 'Screenshot.png',
                        caption: caption,
                        mediaId: mediaId,
                        type: 'image',
                        uploadedAt: new Date().toISOString()
                    };
                    await handleSupportTicketCreation(senderPhone, caption, clientContext, mediaAttachment, activeDraft);
                } else {
                    await handleSupportTicketCreation(senderPhone, textContent || displayBody, clientContext, null, activeDraft);
                }
                clientTicketDrafts.delete(senderPhone);
                continue;
            } else if (activeDraft.step === 'awaiting_project') {
                activeDraft.projectName = textContent || displayBody;
                await sendCategorySelection(senderPhone, activeDraft);
                continue;
            } else if (activeDraft.step === 'awaiting_category') {
                activeDraft.category = textContent || displayBody;
                await sendPrioritySelection(senderPhone, activeDraft);
                continue;
            } else if (activeDraft.step === 'awaiting_priority') {
                activeDraft.priority = textContent || displayBody;
                await sendDetailsPrompt(senderPhone, activeDraft);
                continue;
            }
        }

        // ==========================================================
        // ROUTE 3: DOCUMENT / EXCEL / PDF FILE RECEIVED (WITHOUT PRIOR DRAFT)
        // ==========================================================
        if (msgType === 'document') {
            const docName = textContent || 'Document.pdf';
            const mediaAttachment = {
                name: docName,
                mediaId: mediaId,
                type: 'document',
                uploadedAt: new Date().toISOString()
            };

            await handleSupportTicketCreation(senderPhone, `Document Attachment: ${docName}`, clientContext, mediaAttachment);
        }

        // ==========================================================
        // ROUTE 4: IMAGE / SCREENSHOT RECEIVED (WITHOUT PRIOR DRAFT)
        // ==========================================================
        else if (msgType === 'image') {
            const caption = textContent && textContent !== '[Image]' ? textContent : 'Screenshot of error';
            const mediaAttachment = {
                name: 'Screenshot.png',
                caption: caption,
                mediaId: mediaId,
                type: 'image',
                uploadedAt: new Date().toISOString()
            };

            await handleSupportTicketCreation(senderPhone, `Issue Screenshot: ${caption}`, clientContext, mediaAttachment);
        }

        // ==========================================================
        // ROUTE 5: DIRECT ISSUE REPORTING OR GENERAL TEXT
        // ==========================================================
        else if (isSupportIssueIntent(textContent)) {
            console.log(`🚨 Support issue intent detected from ${senderPhone}: "${textContent}"`);
            await handleSupportTicketCreation(senderPhone, textContent, clientContext);
        }
        else {
            await handleTextMessageWithAI(senderPhone, textContent || displayBody, clientContext);
        }
    }

    // Handle Status Receipts (sent, delivered, read)
    handleStatusReceipts(body);
}

/**
 * Universal Payload Normalizer (Supports Chartered Info & Meta Cloud API)
 */
function extractMessagesFromPayload(body) {
    const messages = [];

    // 1. Chartered Info Flat Format
    if (body && (body.from || body.phone_no_id || body.wamid || body.type)) {
        const from = body.from || body.sender || body.mobile || body.phone;
        if (!from) return messages;

        let text = '';
        let selectedId = null;
        let mediaId = null;
        const msgType = body.type || 'text';

        // Deep inspect for interactive or list reply
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
            
            // Check if rawBody is a serialized JSON string from Chartered Info (e.g. {"type":"list_reply", ...})
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
        }

        // Fallback checks
        if (!selectedId && body.selected_id) selectedId = body.selected_id;
        if (!text && body.message) text = body.message;
        if (!text && selectedId) text = selectedId;

        // Auto-match text to known button IDs if interactive or matching keyword
        if (!selectedId && (msgType === 'interactive' || msgType === 'button' || text)) {
            const lower = (text || '').toLowerCase();
            if (lower.includes('srv_hybrid') || lower.includes('hybrid')) selectedId = 'srv_hybrid';
            else if (lower.includes('srv_app') || lower.includes('mobile') || (lower.includes('app') && !lower.includes('whatsapp'))) selectedId = 'srv_app';
            else if (lower.includes('srv_web') || (lower.includes('web') && !lower.includes('hybrid'))) selectedId = 'srv_web';
            else if (lower.includes('srv_progress') || lower.includes('progress') || lower.includes('status')) selectedId = 'srv_progress';
            else if (lower.includes('srv_invoice') || lower.includes('invoice') || lower.includes('bill')) selectedId = 'srv_invoice';
            else if (lower.includes('srv_support') || lower.includes('support') || lower.includes('ticket')) selectedId = 'srv_support';
            else if (lower.includes('req_yes_excel') || lower.includes('yes, have document') || lower.includes('have excel')) selectedId = 'req_yes_excel';
            else if (lower.includes('req_no_excel') || lower.includes('no, please guide') || lower.includes('no excel')) selectedId = 'req_no_excel';
            else if (lower.includes('opt_ui_saas') || lower.includes('modern saas') || lower.includes('saas portal')) selectedId = 'opt_ui_saas';
            else if (lower.includes('opt_ui_ecom') || lower.includes('e-commerce') || lower.includes('multi-vendor')) selectedId = 'opt_ui_ecom';
            else if (lower.includes('opt_ui_corp') || lower.includes('corporate portal')) selectedId = 'opt_ui_corp';
            else if (lower.includes('opt_app_react') || lower.includes('react native')) selectedId = 'opt_app_react';
            else if (lower.includes('opt_app_flutter') || lower.includes('flutter')) selectedId = 'opt_app_flutter';
            else if (lower.includes('opt_app_field') || lower.includes('field ops') || lower.includes('enterprise erp')) selectedId = 'opt_app_field';
            else if (lower.includes('opt_ui_custom') || lower.includes('custom architecture') || lower.includes('custom tailor-made')) selectedId = 'opt_ui_custom';
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

    // 2. Standard Meta Cloud API Nested Format
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
                    }

                    if (!selectedId && text) {
                        const lower = text.toLowerCase();
                        if (lower.includes('hybrid')) selectedId = 'srv_hybrid';
                        else if (lower.includes('app') || lower.includes('mobile')) selectedId = 'srv_app';
                        else if (lower.includes('web')) selectedId = 'srv_web';
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

    // =========================================================================
    // 1. SERVICE SELECTION: WEB / MOBILE APP / HYBRID
    // =========================================================================

    // Case 1A: Web Development
    if (key === 'srv_web' || (key.includes('web') && !key.includes('hybrid'))) {
        const webCard = `Planex Software — Web Development Package
Hello ${clientContext.name}, we have registered your preference for Enterprise Web Application.

Planned Core Modules:
1. Frontend User Interface (Responsive Web Portal)
2. Backend API Engine (Node.js / PostgreSQL Architecture)
3. Admin Control Portal (User Roles & Permissions)
4. Analytics & Reporting (Data Dashboards & PDF Export)
5. Security & Deployment (SSL Encryption & Cloud Hosting)`;

        await sendWhatsAppText(senderPhone, webCard);

        await sendWhatsAppListMenu(senderPhone, {
            headerText: "Web Design Catalogue",
            bodyText: "Please choose your preferred Web UI and layout theme:",
            footerText: "Planex UI/UX Design Hub",
            buttonText: "View Web Options",
            sections: [
                {
                    title: "Web UI Options",
                    rows: [
                        { id: "opt_ui_saas", title: "Option 1: Modern SaaS", description: "Glassmorphism, Live Charts & Dark Mode" },
                        { id: "opt_ui_ecom", title: "Option 2: E-Commerce", description: "Catalog, Cart, Checkout & Payment Gateway" },
                        { id: "opt_ui_corp", title: "Option 3: Corporate Portal", description: "Multi-page Business Showcase & Contact CRM" },
                        { id: "opt_ui_custom", title: "Option 4: Custom Architecture", description: "Tailor-made layout for your specific workflow" }
                    ]
                }
            ]
        });

        await sendWhatsAppButtons(senderPhone, {
            headerText: "Requirements & Scope Check",
            bodyText: `Data Incorporation:\nDo you have an existing requirements document, Excel sheet, or wireframe ready for this Web Application?`,
            footerText: "Pentasoft Consultancy",
            buttons: [
                { id: "req_yes_excel", title: "Yes, Have Document" },
                { id: "req_no_excel", title: "No, Please Guide" }
            ]
        });
    }

    // Case 1B: Mobile App Development
    else if (key === 'srv_app' || (key.includes('app') && !key.includes('hybrid')) || key.includes('mobile') || key.includes('android') || key.includes('ios')) {
        const appCard = `Planex Software — Mobile App Development Package
Hello ${clientContext.name}, we have registered your preference for Mobile App Development (Android & iOS).

Planned Core Modules:
1. Cross-Platform Native Apps (Android & iOS)
2. Push Notifications & Live Background Sync
3. Device Integrations (Camera, Barcode / QR Scanner, Thermal Printers)
4. Offline Database Cache with Auto-Sync
5. Authentication & Security (Biometrics & Secure Token Auth)`;

        await sendWhatsAppText(senderPhone, appCard);

        await sendWhatsAppListMenu(senderPhone, {
            headerText: "Mobile App Catalogue",
            bodyText: "Please choose your preferred Mobile App architecture layout:",
            footerText: "Planex Mobile Engineering",
            buttonText: "View App Options",
            sections: [
                {
                    title: "Mobile App Architecture Options",
                    rows: [
                        { id: "opt_app_react", title: "Option 1: React Native App", description: "Fluid animations, single codebase Android & iOS" },
                        { id: "opt_app_flutter", title: "Option 2: Flutter App", description: "Material 3 / Cupertino pixel-perfect UI" },
                        { id: "opt_app_field", title: "Option 3: Field Ops / POS", description: "Barcode scanning, Thermal Print & GPS tracking" },
                        { id: "opt_ui_custom", title: "Option 4: Custom Architecture", description: "Bespoke mobile solution for your workflow" }
                    ]
                }
            ]
        });

        await sendWhatsAppButtons(senderPhone, {
            headerText: "Requirements & Scope Check",
            bodyText: `Data Incorporation:\nDo you have an existing requirements document, Excel sheet, or wireframe ready for this Mobile App?`,
            footerText: "Pentasoft Consultancy",
            buttons: [
                { id: "req_yes_excel", title: "Yes, Have Document" },
                { id: "req_no_excel", title: "No, Please Guide" }
            ]
        });
    }

    // Case 1C: Hybrid (Web + App) Full-Stack Package
    else if (key === 'srv_hybrid' || key.includes('hybrid')) {
        const hybridCard = `Planex Software — Full-Stack Hybrid Package
Hello ${clientContext.name}, we have registered your preference for Hybrid Solution (Web Portal + Mobile Apps).

Planned Core Modules:
1. Master Web Admin Portal with Live Telemetry
2. Mobile Applications (Android & iOS)
3. Unified High-Performance REST API Gateway
4. Automated Workflow & Notification Engine
5. Business Intelligence & Consolidated Reporting`;

        await sendWhatsAppText(senderPhone, hybridCard);

        await sendWhatsAppListMenu(senderPhone, {
            headerText: "Hybrid Architecture Blueprints",
            bodyText: "Please choose your preferred Full-Stack layout option:",
            footerText: "Planex Enterprise Hub",
            buttonText: "View Hybrid Options",
            sections: [
                {
                    title: "Hybrid Full-Stack Options",
                    rows: [
                        { id: "opt_ui_saas", title: "Option 1: SaaS Portal + Mobile", description: "Web SaaS Dashboard with synchronized Mobile App" },
                        { id: "opt_ui_ecom", title: "Option 2: Multi-Vendor Platform", description: "Web Admin + Seller Portal + Buyer Mobile Apps" },
                        { id: "opt_app_field", title: "Option 3: Enterprise ERP & Field", description: "Web Management + Field Workforce Tracking App" },
                        { id: "opt_ui_custom", title: "Option 4: Custom Tailor-Made", description: "Complete custom architecture designed from scratch" }
                    ]
                }
            ]
        });

        await sendWhatsAppButtons(senderPhone, {
            headerText: "Requirements & Scope Check",
            bodyText: `Data Incorporation:\nDo you have an existing requirements document, Excel sheet, or wireframe ready for this project?`,
            footerText: "Pentasoft Consultancy",
            buttons: [
                { id: "req_yes_excel", title: "Yes, Have Document" },
                { id: "req_no_excel", title: "No, Please Guide" }
            ]
        });
    }

    // =========================================================================
    // 2. UI LAYOUT / ARCHITECTURE OPTION PICKED
    // =========================================================================
    else if (key.startsWith('opt_ui_') || key.startsWith('opt_app_') || key.startsWith('opt_')) {
        const optMap = {
            'opt_ui_saas': 'Option 1: Modern SaaS & Live Analytics Dashboard',
            'opt_ui_ecom': 'Option 2: E-Commerce & Multi-Vendor Platform',
            'opt_ui_corp': 'Option 3: Corporate Enterprise Portal',
            'opt_app_react': 'Option 1: React Native Android & iOS App',
            'opt_app_flutter': 'Option 2: Flutter Pixel-Perfect Material App',
            'opt_app_field': 'Option 3: Enterprise Field Ops & POS Hardware App',
            'opt_ui_custom': 'Option 4: Custom Tailor-Made Enterprise Architecture'
        };
        const chosen = optMap[selectedId] || optMap[key] || 'Custom Tailored Architecture';

        const teamConfirmation = `Layout Selected: ${chosen}

We have recorded your architecture layout.
Our technical architect will prepare the initial wireframe blueprint and milestone breakdown for your review.`;
        await sendWhatsAppText(senderPhone, teamConfirmation);
    }

    // =========================================================================
    // 3. EXCEL / WIREFRAME REQUIREMENT SELECTION
    // =========================================================================
    else if (key === 'req_yes_excel' || key.includes('yes_excel') || key.includes('have excel') || key.includes('have document')) {
        await sendWhatsAppText(
            senderPhone,
            `Please attach and send your Excel, Word, or PDF document directly here on WhatsApp.\n\nOur system will automatically parse and link your document to your project proposal directory.`
        );
    }
    else if (key === 'req_no_excel' || key.includes('no_excel') || key.includes('please guide')) {
        await sendWhatsAppText(
            senderPhone,
            `No problem at all.\nOur lead architect will prepare a custom Requirement Breakdown & Milestone Scope for you based on our consultation.\n\nYou can also call our lead directly at: +91 98210 27060.`
        );
    }

    // =========================================================================
    // 4. PROJECT PROGRESS INQUIRY
    // =========================================================================
    else if (key === 'srv_progress' || key.includes('progress') || key.includes('status')) {
        const proj = await getProjectStatusDetails(clientContext.id);
        if (proj.isProspect || !proj.stagingUrl) {
            const textMsg = `Project Progress for ${clientContext.name}:
- Current Status: ${proj.status}
- Stage: ${proj.milestone}
- Lead Architect: ${proj.leadArchitect}
- Delivery Lead: ${proj.projectManager}

Note: We are currently scoping your custom modules. Once requirements are frozen, your live staging demo link and sprint tracking dashboard will be activated here.`;
            await sendWhatsAppText(senderPhone, textMsg);
        } else {
            const textMsg = `Project Progress for ${clientContext.name}:
- Project: ${proj.projectName}
- Status: ${proj.status}
- Milestone: ${proj.milestone}
- Lead Architect: ${proj.leadArchitect}
- Manager: ${proj.projectManager}`;
            await sendWhatsAppText(senderPhone, textMsg);
            await sendWhatsAppCtaUrl(senderPhone, {
                headerText: "Live Project Preview",
                bodyText: "You can view the live staging preview and interactive demo here:",
                displayText: "Open Staging Demo",
                url: proj.stagingUrl
            });
        }
    }

    // =========================================================================
    // 5. PAYMENT & TAX INVOICE INQUIRY
    // =========================================================================
    else if (key === 'srv_invoice' || key.includes('invoice') || key.includes('payment') || key.includes('bill')) {
        const inv = await getClientInvoiceDetails(clientContext.id);
        if (inv.isProspect) {
            await sendWhatsAppText(
                senderPhone,
                `Commercial Proposal & Billing Details:
- Client: ${clientContext.name}
- Stage: ${inv.status}
- Billing Terms: ${inv.paymentTerms}
- Beneficiary: ${inv.beneficiary}
- Bank: ${inv.bankName}
- Account No: ${inv.accountNo}
- IFSC Code: ${inv.ifsc}
- UPI ID: ${inv.upiId} (Shrirang Joshi)
- GSTIN: ${inv.gstin}

Official Tax Invoice will be generated upon milestone approval.`
            );
        } else {
            await sendWhatsAppText(
                senderPhone,
                `Tax Invoice & Payment Details (${inv.invoiceNumber}):
- Beneficiary: ${inv.beneficiary}
- GSTIN: ${inv.gstin}
- Bank: ${inv.bankName}
- Account No: ${inv.accountNo}
- IFSC Code: ${inv.ifsc}
- UPI ID: ${inv.upiId}
- Amount: ${inv.amountDue}
- Terms: ${inv.paymentTerms}

Please send the payment screenshot or UTR number here once completed.`
            );
        }
    }

    // =========================================================================
    // 6. TECHNICAL SUPPORT INQUIRY / BUTTON CLICK
    // =========================================================================
    else if (key === 'srv_support' || key === 'support_ticket' || key === 'raise_ticket') {
        await startSupportTicketFlow(senderPhone, clientContext);
    }

    // =========================================================================
    // 7. INTERACTIVE PROJECT SELECTION (STEP 1 OF SUPPORT TICKET)
    // =========================================================================
    else if (key.startsWith('supproj_')) {
        let draft = clientTicketDrafts.get(senderPhone) || {
            step: 'awaiting_project',
            customerId: clientContext.id,
            customerName: clientContext.name,
            clientContactName: clientContext.name,
            timestamp: Date.now()
        };

        let chosenProj = null;
        if (Array.isArray(draft.availableProjects)) {
            chosenProj = draft.availableProjects.find(p => p.id === selectedId || p.id === key);
        }

        if (chosenProj) {
            draft.projectId = chosenProj.id;
            draft.projectName = `${chosenProj.name}${chosenProj.branchName ? ` (${chosenProj.branchName} Branch)` : ''}`;
            draft.branchName = chosenProj.branchName || '';
            draft.assignedEmployees = chosenProj.assignedEmployees || [];
        } else if (key.includes('general')) {
            draft.projectName = 'General Maintenance / Scope';
            draft.branchName = '';
        } else {
            draft.projectName = selectedId || 'Customer Project';
        }

        await sendCategorySelection(senderPhone, draft);
    }

    // =========================================================================
    // 8. INTERACTIVE ISSUE CATEGORY SELECTION (STEP 2 OF SUPPORT TICKET)
    // =========================================================================
    else if (key.startsWith('supcat_')) {
        let draft = clientTicketDrafts.get(senderPhone) || {
            step: 'awaiting_category',
            customerId: clientContext.id,
            customerName: clientContext.name,
            projectName: 'General Project',
            timestamp: Date.now()
        };

        const catMap = {
            'supcat_bug': 'Bug / Defect',
            'supcat_server': 'Server / Downtime',
            'supcat_config': 'Configuration / Setup',
            'supcat_data': 'Data / Report Issue',
            'supcat_feature': 'Feature Request',
            'supcat_general': 'General Support'
        };

        draft.category = catMap[key] || catMap[selectedId] || selectedId || 'Bug / Defect';
        await sendPrioritySelection(senderPhone, draft);
    }

    // =========================================================================
    // 9. INTERACTIVE PRIORITY & SLA MATRIX SELECTION (STEP 3 OF SUPPORT TICKET)
    // =========================================================================
    else if (key.startsWith('suppri_')) {
        let draft = clientTicketDrafts.get(senderPhone) || {
            step: 'awaiting_priority',
            customerId: clientContext.id,
            customerName: clientContext.name,
            projectName: 'General Project',
            category: 'Bug / Defect',
            timestamp: Date.now()
        };

        const priMap = {
            'suppri_critical': 'Critical',
            'suppri_high': 'High',
            'suppri_medium': 'Medium'
        };

        draft.priority = priMap[key] || priMap[selectedId] || 'High';
        await sendDetailsPrompt(senderPhone, draft);
    }

    // Fallback: If no interactive key matched, treat as text
    else {
        await handleTextMessageWithAI(senderPhone, selectedId, clientContext);
    }
}

/**
 * Step 1: Start Guided WhatsApp Support Ticket Session
 */
export async function startSupportTicketFlow(senderPhone, clientContext) {
    try {
        let customerId = clientContext.id;
        let customerName = clientContext.name || 'Valued Customer';
        let clientContactName = clientContext.contactName || customerName;

        let projectsList = [];
        if (customerId) {
            const custRes = await pool.query(`SELECT id, name, branches, contact_persons, assigned_employees FROM customers WHERE id = $1`, [customerId]);
            if (custRes.rows.length > 0) {
                const c = custRes.rows[0];
                customerName = c.name || customerName;

                let contactPersons = c.contact_persons;
                if (typeof contactPersons === 'string') {
                    try { contactPersons = JSON.parse(contactPersons); } catch(e){}
                }
                if (Array.isArray(contactPersons) && contactPersons.length > 0 && contactPersons[0].name) {
                    clientContactName = contactPersons[0].name;
                }

                let branches = c.branches;
                if (typeof branches === 'string') {
                    try { branches = JSON.parse(branches); } catch(e){}
                }
                if (Array.isArray(branches)) {
                    branches.forEach((b, bIdx) => {
                        const bName = b.branch || `Branch ${bIdx + 1}`;
                        let bProjs = b.projects;
                        if (typeof bProjs === 'string') {
                            try { bProjs = JSON.parse(bProjs); } catch(e){}
                        }
                        if (Array.isArray(bProjs)) {
                            bProjs.forEach((p, pIdx) => {
                                const pName = typeof p === 'string' ? p : (p.name || p.project_name || 'Module');
                                projectsList.push({
                                    id: `supproj_${bIdx}_${pIdx}`,
                                    name: pName,
                                    branchName: bName,
                                    assignedEmployees: b.assignedEmployees || []
                                });
                            });
                        }
                    });
                }
            }

            const dbProjRes = await pool.query(`SELECT id, name, branch_name FROM projects WHERE customer_id = $1`, [customerId]);
            for (const dp of dbProjRes.rows) {
                if (!projectsList.some(p => p.name.toLowerCase() === dp.name.toLowerCase() && p.branchName.toLowerCase() === (dp.branch_name || '').toLowerCase())) {
                    projectsList.push({
                        id: `supproj_db_${dp.id}`,
                        name: dp.name,
                        branchName: dp.branch_name || '',
                        assignedEmployees: []
                    });
                }
            }
        }

        const draft = {
            step: 'awaiting_project',
            customerId: customerId,
            customerName: customerName,
            clientContactName: clientContactName,
            availableProjects: projectsList,
            timestamp: Date.now()
        };
        clientTicketDrafts.set(senderPhone, draft);

        if (projectsList.length > 0) {
            const rows = projectsList.slice(0, 9).map(p => ({
                id: p.id,
                title: `${p.name}${p.branchName ? ` (${p.branchName})` : ''}`.slice(0, 24),
                description: `Branch: ${p.branchName || 'Main Project'}`.slice(0, 72)
            }));
            rows.push({
                id: 'supproj_general',
                title: 'General Maintenance',
                description: 'General system support or other issue'
            });

            await sendWhatsAppListMenu(senderPhone, {
                headerText: "Support Ticket Desk",
                bodyText: `Hello ${clientContactName},\n\nPlease select the project / branch where you are experiencing an issue:`,
                footerText: "Planex Technical Support",
                buttonText: "Select Project",
                sections: [
                    {
                        title: "Your Assigned Projects",
                        rows: rows
                    }
                ]
            });
        } else {
            draft.projectName = 'General Maintenance';
            draft.branchName = '';
            await sendCategorySelection(senderPhone, draft);
        }
    } catch (err) {
        console.error("❌ Error in startSupportTicketFlow:", err.message);
    }
}

/**
 * Step 2: Send Issue Category Selection List Menu
 */
export async function sendCategorySelection(senderPhone, draft) {
    try {
        draft.step = 'awaiting_category';
        clientTicketDrafts.set(senderPhone, draft);

        await sendWhatsAppListMenu(senderPhone, {
            headerText: "Select Issue Category",
            bodyText: `Project: ${draft.projectName || 'General Maintenance'}\n\nPlease select the category that best describes your issue:`,
            footerText: "Planex Technical Support",
            buttonText: "Choose Category",
            sections: [
                {
                    title: "Issue Categories",
                    rows: [
                        { id: "supcat_bug", title: "Bug / Defect", description: "System crash, button not working, UI glitch" },
                        { id: "supcat_server", title: "Server / Downtime", description: "Portal down, service unreachable, slow response" },
                        { id: "supcat_config", title: "Configuration / Setup", description: "User permission, setting change, setup help" },
                        { id: "supcat_data", title: "Data / Report Issue", description: "Data discrepancy, missing record, calculation" },
                        { id: "supcat_feature", title: "Feature Request", description: "New feature requirement or enhancement" },
                        { id: "supcat_general", title: "General Support", description: "Training, help, or general inquiry" }
                    ]
                }
            ]
        });
    } catch (err) {
        console.error("❌ Error in sendCategorySelection:", err.message);
    }
}

/**
 * Step 3: Send Priority & SLA Level Selection Buttons
 */
export async function sendPrioritySelection(senderPhone, draft) {
    try {
        draft.step = 'awaiting_priority';
        clientTicketDrafts.set(senderPhone, draft);

        await sendWhatsAppButtons(senderPhone, {
            headerText: "Priority & SLA Level",
            bodyText: `Project: ${draft.projectName}\nCategory: ${draft.category}\n\nPlease select the urgency / SLA priority level:`,
            footerText: "Planex Technical Support",
            buttons: [
                { id: "suppri_critical", title: "Critical (4h SLA)" },
                { id: "suppri_high", title: "High (24h SLA)" },
                { id: "suppri_medium", title: "Medium (3d SLA)" }
            ]
        });
    } catch (err) {
        console.error("❌ Error in sendPrioritySelection:", err.message);
    }
}

/**
 * Step 4: Prompt Client for Issue Description & Photo/PDF Upload
 */
export async function sendDetailsPrompt(senderPhone, draft) {
    try {
        draft.step = 'awaiting_details';

        let assignedEmployees = draft.assignedEmployees || [];
        if (!assignedEmployees.length) {
            if (draft.projectName && draft.projectName.toLowerCase().includes('dahisar')) {
                assignedEmployees = [
                    { id: 9, full_name: 'Malhar Kulkarni' },
                    { id: 10, full_name: 'Nitin RajGuru' }
                ];
            } else if (draft.projectName && draft.projectName.toLowerCase().includes('miraroad')) {
                assignedEmployees = [
                    { id: 15, full_name: 'Vijay Mourya' },
                    { id: 10, full_name: 'Nitin RajGuru' }
                ];
            } else {
                assignedEmployees = [
                    { id: 9, full_name: 'Malhar Kulkarni' },
                    { id: 10, full_name: 'Nitin RajGuru' }
                ];
            }
        }
        draft.assignedEmployees = assignedEmployees;
        clientTicketDrafts.set(senderPhone, draft);

        const engineerNames = assignedEmployees.map(e => e.full_name || e.name).join(', ') || 'Nitin RajGuru, Malhar Kulkarni';

        const promptText = `Support Ticket Form Configured\n\nCustomer: ${draft.customerName}\nProject: ${draft.projectName}\nCategory: ${draft.category}\nPriority: ${draft.priority}\nAssigned Engineers: ${engineerNames}\n\nPlease reply with your issue description and attach error screenshots or PDF logs if any.\n\nOnce received, our system will automatically create the ticket, start the SLA resolution timer, and notify the engineering team.`;

        await sendWhatsAppText(senderPhone, promptText);
        await saveMessage({
            senderPhone: '919082270423',
            recipientPhone: senderPhone,
            direction: 'outbound',
            messageType: 'text',
            messageBody: promptText
        });
    } catch (err) {
        console.error("❌ Error in sendDetailsPrompt:", err.message);
    }
}

/**
 * Check if text contains a client resolution trigger
 */
export function isResolutionKeyword(text) {
    if (!text) return false;
    const lower = String(text).toLowerCase().trim();
    return lower === 'resolved' || 
           lower.includes('ticket end') || 
           lower.includes('support ticket end') || 
           lower.includes('close ticket') || 
           lower.includes('issue solved') || 
           lower.includes('problem solved') || 
           lower.includes('ticket close') || 
           lower.includes('ticket resolved') || 
           lower.includes('sab theek hai') || 
           lower.includes('issue resolved') || 
           lower.includes('kam ho gaya') ||
           lower === 'ticket resolved' ||
           lower === 'ticket end';
}

/**
 * Check if text has explicit issue/bug reporting intent
 */
export function isSupportIssueIntent(text) {
    if (!text) return false;
    const lower = String(text).toLowerCase().trim();
    if (isGreeting(text) || isResolutionKeyword(text)) return false;
    return lower.includes('not working') || 
           lower.includes('button not working') || 
           lower.includes('nahi chal raha') || 
           lower.includes('error') || 
           lower.includes('bug') || 
           lower.includes('issue') || 
           lower.includes('problem') || 
           lower.includes('crash') || 
           lower.includes('fail') || 
           lower.includes('down') ||
           (lower.includes('ticket') && !lower.includes('view services'));
}

/**
 * Create Support Ticket from WhatsApp, Auto-Assign Customer Engineers, and Alert All Engineers
 */
export async function handleSupportTicketCreation(senderPhone, issueText, clientContext, mediaAttachment = null, options = {}) {
    try {
        let customerId = options.customerId || clientContext.id;
        let customerName = options.customerName || clientContext.name || 'Valued Customer';
        let projectName = options.projectName || 'General Project';
        let category = options.category || 'Bug';
        let priority = options.priority || 'High';
        let assignedEmployees = options.assignedEmployees || [];
        let reportedBy = options.clientContactName || customerName;

        // Query customer details if fields missing
        if (customerId && (!assignedEmployees.length || projectName === 'General Project')) {
            const cRes = await pool.query(`SELECT id, name, branches, assigned_employees, contact_persons FROM customers WHERE id = $1`, [customerId]);
            if (cRes.rows.length > 0) {
                const c = cRes.rows[0];
                customerName = c.name || customerName;

                let branches = c.branches;
                if (typeof branches === 'string') {
                    try { branches = JSON.parse(branches); } catch(e){}
                }

                if (Array.isArray(branches)) {
                    for (const b of branches) {
                        if (Array.isArray(b.projects) && b.projects.length > 0 && projectName === 'General Project') {
                            for (const p of b.projects) {
                                if (p.name) {
                                    projectName = `${p.name}${b.branch ? ` (${b.branch})` : ''}`;
                                }
                            }
                        }
                        if (Array.isArray(b.assignedEmployees)) {
                            for (const emp of b.assignedEmployees) {
                                if (emp.id && !assignedEmployees.some(e => e.id === emp.id)) {
                                    assignedEmployees.push(emp);
                                }
                            }
                        }
                    }
                }

                let custAssigned = c.assigned_employees;
                if (typeof custAssigned === 'string') {
                    try { custAssigned = JSON.parse(custAssigned); } catch(e){}
                }
                if (Array.isArray(custAssigned)) {
                    for (const emp of custAssigned) {
                        if (emp.id && !assignedEmployees.some(e => e.id === emp.id)) {
                            assignedEmployees.push(emp);
                        }
                    }
                }
            }
        }

        // Fallback default engineers (e.g. Nitin Sir ID 10, Malhar Kulkarni ID 9)
        if (assignedEmployees.length === 0) {
            assignedEmployees = [
                { id: 9, full_name: 'Malhar Kulkarni' },
                { id: 10, full_name: 'Nitin RajGuru' }
            ];
        }

        // Generate Ticket Code
        const tCountRes = await pool.query(`SELECT id FROM support_tickets ORDER BY id DESC LIMIT 1`);
        const nextId = (tCountRes.rows[0]?.id || 0) + 101;
        const ticketCode = `SUP-${String(nextId).padStart(6, '0')}`;

        // SLA deadline calculation
        const now = new Date();
        let respMinutes = 120;
        let resoMinutes = 1440;
        const pri = priority.toLowerCase();
        if (pri.includes('critical')) {
            respMinutes = 30;
            resoMinutes = 240;
        } else if (pri.includes('high')) {
            respMinutes = 120;
            resoMinutes = 1440;
        } else if (pri.includes('medium')) {
            respMinutes = 480;
            resoMinutes = 4320;
        } else if (pri.includes('low')) {
            respMinutes = 1440;
            resoMinutes = 10080;
        }

        const responseDeadline = new Date(now.getTime() + respMinutes * 60000);
        const resolutionDeadline = new Date(now.getTime() + resoMinutes * 60000);

        const titleSnippet = (issueText || 'Technical Issue reported on WhatsApp')
            .replace(/\n/g, ' ')
            .substring(0, 75);

        const attachments = [];
        if (mediaAttachment) {
            if (mediaAttachment.mediaId && !mediaAttachment.url) {
                try {
                    const downloaded = await downloadWabaMediaToDisk(mediaAttachment.mediaId, mediaAttachment.name);
                    if (downloaded && downloaded.url) {
                        mediaAttachment.url = downloaded.url;
                        mediaAttachment.size = downloaded.size;
                    }
                } catch (dlErr) {
                    console.error("Failed to download WABA media to disk:", dlErr.message);
                }
            }
            attachments.push(mediaAttachment);
        }

        const insertRes = await pool.query(`
            INSERT INTO support_tickets (
                ticket_code, customer_id, project_name, reported_by, customer_phone, source,
                title, description, category, priority, status,
                assigned_to, assigned_team, attachments,
                response_deadline, resolution_deadline, created_at
            ) VALUES ($1, $2, $3, $4, $5, 'WHATSAPP', $6, $7, $8, $9, 'Assigned', $10, $11, $12, $13, $14, NOW())
            RETURNING *
        `, [
            ticketCode,
            customerId || null,
            projectName,
            reportedBy,
            sanitizePhoneNumber(senderPhone),
            titleSnippet,
            issueText || 'Issue reported from WhatsApp with attachment.',
            category,
            priority,
            assignedEmployees[0]?.id || 9,
            JSON.stringify(assignedEmployees),
            JSON.stringify(attachments),
            responseDeadline,
            resolutionDeadline
        ]);

        const newTicket = insertRes.rows[0];

        // Log history
        await pool.query(`
            INSERT INTO support_ticket_history (ticket_id, performed_by, action, new_status, details)
            VALUES ($1, 'Customer (WhatsApp)', 'Ticket Created', 'Assigned', $2)
        `, [newTicket.id, `Ticket created from WhatsApp: ${titleSnippet}`]);

        // Send alert to ALL assigned engineers (e.g. Nitin Sir, Malhar Kulkarni) & create Inbox Notifications
        notifyTicketWhatsApp({
            ticketCode,
            title: titleSnippet,
            description: issueText || titleSnippet,
            priority,
            assignedToId: assignedEmployees[0]?.id || 9,
            assignedTeam: assignedEmployees,
            customerName,
            projectName,
            actionType: 'created',
            attachments: attachments
        });

        // Send clean confirmation to Client
        const engineerNames = assignedEmployees.map(e => e.full_name || e.name).join(', ') || 'Malhar Kulkarni, Nitin RajGuru';
        const attachmentSnippet = attachments.length > 0 ? `\nAttachment: ${attachments.map(a => a.name || 'File').join(', ')}` : '';
        const clientAck = `Support Ticket ${ticketCode} Registered\n\nHello ${customerName},\nYour support ticket has been logged and assigned to: ${engineerNames}\nProject: ${projectName}\nCategory: ${category}\nPriority: ${priority}\nIssue: ${titleSnippet}${attachmentSnippet}\n\nResolution timer has started. Our team is actively reviewing.\nReply with "RESOLVED" or "TICKET END" once the issue is solved.`;

        await sendWhatsAppText(senderPhone, clientAck);
        await saveMessage({
            senderPhone: '919082270423',
            recipientPhone: senderPhone,
            direction: 'outbound',
            messageType: 'text',
            messageBody: clientAck
        });

        return newTicket;
    } catch (err) {
        console.error("❌ Error in handleSupportTicketCreation:", err.message);
    }
}

/**
 * Handle Client Ticket Resolution ("RESOLVED" / "TICKET END")
 */
export async function handleTicketResolutionByClient(senderPhone, clientContext) {
    try {
        const cleanedPhone = sanitizePhoneNumber(senderPhone);
        const last10 = cleanedPhone.slice(-10);

        // Find active open ticket
        const ticketRes = await pool.query(`
            SELECT t.*, c.name AS customer_name 
            FROM support_tickets t
            LEFT JOIN customers c ON t.customer_id = c.id
            WHERE (t.customer_phone ILIKE $1 OR t.customer_id = $2 OR t.reported_by ILIKE $3)
              AND t.status NOT IN ('Resolved', 'Closed')
            ORDER BY t.created_at DESC
            LIMIT 1;
        `, [`%${last10}%`, clientContext.id || 0, `%${clientContext.name}%`]);

        if (ticketRes.rows.length === 0) {
            const noTicketMsg = `Hello ${clientContext.name}, no active open support ticket was found under your number.\n\nIf you are facing any new issue, please describe it here or attach a screenshot to raise a ticket.`;
            await sendWhatsAppText(senderPhone, noTicketMsg);
            await saveMessage({
                senderPhone: '919082270423',
                recipientPhone: senderPhone,
                direction: 'outbound',
                messageType: 'text',
                messageBody: noTicketMsg
            });
            return;
        }

        const ticket = ticketRes.rows[0];
        const durationStr = formatTurnaroundTime(ticket.created_at, new Date());

        // Update DB
        await pool.query(`
            UPDATE support_tickets 
            SET status = 'Resolved', resolved_at = NOW(), updated_at = NOW()
            WHERE id = $1;
        `, [ticket.id]);

        // Log history
        await pool.query(`
            INSERT INTO support_ticket_history (ticket_id, performed_by, action, previous_status, new_status, details)
            VALUES ($1, 'Customer (WhatsApp)', 'Ticket Resolved', $2, 'Resolved', 'Ticket closed by client keyword on WhatsApp.')
        `, [ticket.id, ticket.status]);

        // Notify client
        const clientMsg = `Support Ticket ${ticket.ticket_code} Resolved\n\nThank you ${clientContext.name}.\nTotal Resolution Time: ${durationStr}\nProject: ${ticket.project_name || 'General Project'}\n\nYour support ticket has been closed.`;
        await sendWhatsAppText(senderPhone, clientMsg);
        await saveMessage({
            senderPhone: '919082270423',
            recipientPhone: senderPhone,
            direction: 'outbound',
            messageType: 'text',
            messageBody: clientMsg
        });

        // Notify assigned engineers
        notifyTicketWhatsApp({
            ticketCode: ticket.ticket_code,
            title: ticket.title,
            customerName: ticket.customer_name || clientContext.name,
            projectName: ticket.project_name || 'General Project',
            assignedToId: ticket.assigned_to,
            assignedTeam: ticket.assigned_team,
            actionType: 'resolved',
            turnaroundTime: durationStr
        });

    } catch (err) {
        console.error("❌ Error in handleTicketResolutionByClient:", err.message);
    }
}

function isGreeting(text) {
    if (!text) return false;
    const lower = String(text).toLowerCase().trim();
    // If the message mentions specific actions, services, or packages, it's NOT just a greeting
    if (lower.includes('hybrid') || lower.includes('app') || lower.includes('web') || 
        lower.includes('progress') || lower.includes('status') || lower.includes('invoice') || 
        lower.includes('bill') || lower.includes('ticket') || lower.includes('support') || 
        lower.includes('excel') || lower.includes('document') || lower.includes('blueprint') ||
        lower.includes('opt_') || lower.includes('srv_') || lower.includes('req_') ||
        lower.includes('package') || lower.includes('saas') || lower.includes('flutter') || lower.includes('react') ||
        isResolutionKeyword(text) || isSupportIssueIntent(text)) {
        return false;
    }
    const clean = lower.replace(/[^a-z0-9\s]/g, '');
    const greetings = [
        'hi', 'hello', 'hey', 'start', 'menu', 'namaste', 'namaskar', 'halo', 'yo',
        'good morning', 'good evening', 'good afternoon', 'what services', 'kya services'
    ];
    if (greetings.includes(clean)) return true;
    const words = clean.split(/\s+/);
    if (words.length <= 2 && greetings.includes(words[0])) return true;
    return false;
}

export async function sendServicesMenu(senderPhone, clientContext) {
    return await sendWhatsAppListMenu(senderPhone, {
        headerText: "Planex Software",
        bodyText: `Hello ${clientContext.name},\n\nThank you for connecting with Planex Software. We specialize in enterprise software development, mobile apps, and workforce automation solutions.\n\nPlease choose a service or inquiry option from our menu below:`,
        footerText: "Pentasoft Consultancy",
        buttonText: "View Services",
        sections: [
            {
                title: "Software Solutions",
                rows: [
                    { id: "srv_web", title: "Web Development", description: "Custom Web Apps & Portals" },
                    { id: "srv_app", title: "Mobile App Development", description: "Android & iOS Native/Hybrid Apps" },
                    { id: "srv_hybrid", title: "Hybrid (Web + App)", description: "Complete Full-Stack Package" }
                ]
            },
            {
                title: "Client Portal & Billing",
                rows: [
                    { id: "srv_progress", title: "Project Progress", description: "Live Status, Scope & Staging" },
                    { id: "srv_invoice", title: "Payment & Tax Invoice", description: "Commercial Proposal & Bank Details" },
                    { id: "srv_support", title: "Raise Support Ticket", description: "Report Technical Bug or Issue" }
                ]
            }
        ]
    });
}

/**
 * Handle Text Message with AI Agent + Backend Guardrail Validations
 */
async function handleTextMessageWithAI(senderPhone, textContent, clientContext) {
    // 1. Instant Guardrail: Any greeting directly triggers the Services List Menu
    if (isGreeting(textContent)) {
        console.log(`✨ Greeting detected ("${textContent}"). Triggering View Services Menu.`);
        await sendServicesMenu(senderPhone, clientContext);
        await saveMessage({
            senderPhone: '919082270423',
            recipientPhone: senderPhone,
            direction: 'outbound',
            messageType: 'interactive',
            messageBody: '[Services List Menu with View Services Button]'
        });
        return;
    }

    const history = await getConversationContext(senderPhone, 8);

    const aiResult = await processMessageWithAI({
        senderPhone,
        userMessage: textContent,
        clientContext,
        conversationHistory: history
    });

    console.log("AI Reasoning Decision:", aiResult);

    if (aiResult.toolCall) {
        const { name, args } = aiResult.toolCall;

        // Tool: Service Selected via text (Web / App / Hybrid)
        if (name === 'select_service' || name === 'get_service_details') {
            const srv = (args.service_type || '').toLowerCase();
            if (srv.includes('app') || srv.includes('mobile') || srv.includes('android') || srv.includes('ios')) {
                await handleInteractiveClick(senderPhone, 'srv_app', clientContext);
            } else if (srv.includes('hybrid') || srv.includes('full') || srv.includes('both')) {
                await handleInteractiveClick(senderPhone, 'srv_hybrid', clientContext);
            } else {
                await handleInteractiveClick(senderPhone, 'srv_web', clientContext);
            }
        }

        // Tool: Send Services Menu
        else if (name === 'send_services_menu') {
            await sendServicesMenu(senderPhone, clientContext);
        }

        // Tool: Get Project Status
        else if (name === 'get_project_status') {
            await handleInteractiveClick(senderPhone, 'srv_progress', clientContext);
        }

        // Tool: Get Invoice Details
        else if (name === 'get_invoice_details') {
            await handleInteractiveClick(senderPhone, 'srv_invoice', clientContext);
        }

        // Tool: Create Support Ticket
        else if (name === 'create_support_ticket') {
            const title = args.title || textContent.substring(0, 50);
            const desc = args.description || textContent;
            await handleSupportTicketCreation(senderPhone, `${title}\n${desc}`, clientContext);
        }

        // Tool: UI Design Catalogue
        else if (name === 'get_ui_catalogue') {
            await handleInteractiveClick(senderPhone, 'srv_web', clientContext);
        }

        // Tool: Handover to Team
        else if (name === 'handover_to_team') {
            const teamCard = `Planex Engineering Team:
- Lead Architect: Shrirang Joshi (+91 98210 27060)
- Project Manager: Nitin Sir (+91 98765 43210)
- Support Email: support@pentasoftconsultancy.com

Feel free to call or message directly for project discussions.`;
            await sendWhatsAppText(senderPhone, teamCard);
            await saveMessage({ senderPhone: '919082270423', recipientPhone: senderPhone, direction: 'outbound', messageType: 'text', messageBody: teamCard });
        }
    }

    // If AI responded with natural text
    else if (aiResult.replyText) {
        await sendWhatsAppText(senderPhone, aiResult.replyText);
        await saveMessage({ senderPhone: '919082270423', recipientPhone: senderPhone, direction: 'outbound', messageType: 'text', messageBody: aiResult.replyText });
    }
}

/**
 * 2. Send Direct WhatsApp Message from EMS Web Portal (Supports Text, Image, Document, or Template)
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
            result = await sendWhatsAppText(phone, text || 'Hello from PCS Enterprise EMS!');
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
 * 3. Fetch WhatsApp Chat History for a Customer / Employee Phone Number
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

// Ensure whatsapp_messages table exists
async function ensureWhatsAppTables() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS whatsapp_messages (
                id SERIAL PRIMARY KEY,
                waba_message_id VARCHAR(100),
                sender_phone VARCHAR(50) NOT NULL,
                recipient_phone VARCHAR(50) NOT NULL,
                direction VARCHAR(20) NOT NULL, -- 'inbound' or 'outbound'
                message_type VARCHAR(50) DEFAULT 'text',
                message_body TEXT,
                media_id VARCHAR(100),
                status VARCHAR(50) DEFAULT 'sent', -- 'sent', 'delivered', 'read', 'received'
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
    } catch (e) {
        // Table exists
    }
}
