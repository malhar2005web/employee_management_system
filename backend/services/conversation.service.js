import { pool } from '../config/db.js';
import { sanitizePhoneNumber } from './whatsapp.service.js';

// In-Memory Multi-Turn Conversation State Machine
export const conversationStates = new Map();

// Required entities for canonical intents
export const REQUIRED_ENTITIES = {
    TECHNICAL_SUPPORT: ['project', 'description'],
    BUG_REPORT: ['project', 'description'],
    SERVER_DOWNTIME: ['project'],
    FEATURE_REQUEST: ['project', 'description'],
    TICKET_STATUS: [], // can fetch latest active ticket for phone
    TICKET_RESOLVE: [], // can resolve latest active ticket
    BILLING_QUERY: [],
    INVOICE_REQUEST: [],
    PAYMENT_EVIDENCE: [],
    LEAVE_APPLICATION: ['leave_type', 'date'],
    SALES_INQUIRY: ['project_scope'],
    REQUIREMENT_DOC: [],
    HUMAN_HANDOVER: [],
    GREETING_MENU: []
};

/**
 * 1. Identify Client, Employee, or Guest from incoming phone number
 */
export async function identifyClient(phone) {
    const cleaned = sanitizePhoneNumber(phone);
    const rawDigits = phone.replace(/[^0-9]/g, '');
    const last10 = rawDigits.slice(-10);

    try {
        // A. Check if the sender is an existing Customer in PostgreSQL
        const custRes = await pool.query(`
            SELECT c.id, c.name, c.industry, c.branches, c.contact_persons, c.assigned_employees,
                   COALESCE(
                       JSON_AGG(
                           JSON_BUILD_OBJECT(
                               'id', p.id,
                               'name', p.name,
                               'status', p.status,
                               'description', p.description
                           )
                       ) FILTER (WHERE p.id IS NOT NULL), '[]'
                   ) AS projects
            FROM customers c
            LEFT JOIN projects p ON c.id = p.customer_id
            WHERE c.name ILIKE $1 OR c.contact_persons::text ILIKE $1 OR c.branches::text ILIKE $1
            GROUP BY c.id
            LIMIT 1;
        `, [`%${last10}%`]);

        if (custRes.rows.length > 0) {
            const customer = custRes.rows[0];
            let contactName = customer.name;
            try {
                let cp = customer.contact_persons;
                if (typeof cp === 'string') cp = JSON.parse(cp);
                if (Array.isArray(cp) && cp.length > 0) {
                    const match = cp.find(c => c.phone && c.phone.includes(last10));
                    if (match && match.name) contactName = match.name;
                    else if (cp[0].name) contactName = cp[0].name;
                }
            } catch (e) {}

            return {
                type: 'customer',
                id: customer.id,
                name: customer.name,
                contactName: contactName,
                company: customer.name,
                industry: customer.industry,
                projects: customer.projects || [],
                assignedEmployees: customer.assigned_employees || []
            };
        }

        // B. Check if the sender is an Employee
        const empRes = await pool.query(`
            SELECT e.id, e.full_name, e.employee_code, e.phone, e.whatsapp_no,
                   d.name AS department_name, ds.title AS designation
            FROM employees e
            LEFT JOIN departments d ON e.department_id = d.id
            LEFT JOIN designations ds ON e.designation_id = ds.id
            WHERE e.phone ILIKE $1 OR e.whatsapp_no ILIKE $1
            LIMIT 1;
        `, [`%${last10}%`]);

        if (empRes.rows.length > 0) {
            const emp = empRes.rows[0];
            return {
                type: 'employee',
                id: emp.id,
                name: emp.full_name,
                code: emp.employee_code,
                department: emp.department_name,
                designation: emp.designation,
                phone: emp.whatsapp_no || emp.phone
            };
        }

        // C. Default: New Prospective Client / Guest
        return {
            type: 'prospect',
            id: null,
            name: 'Valued Client',
            company: 'Prospective Client',
            projects: []
        };
    } catch (error) {
        console.error("❌ identifyClient Error:", error.message);
        return {
            type: 'prospect',
            id: null,
            name: 'Valued Client',
            company: 'Client',
            projects: []
        };
    }
}

/**
 * 2. Get / Update / Clear Conversation State Machine
 */
export function getConversationState(phone) {
    const cleaned = sanitizePhoneNumber(phone);
    let state = conversationStates.get(cleaned);
    
    // Auto-expire state older than 2 hours of inactivity
    if (state && Date.now() - state.lastUpdated > 2 * 60 * 60 * 1000) {
        conversationStates.delete(cleaned);
        return null;
    }
    return state || null;
}

export function updateConversationState(phone, updates = {}) {
    const cleaned = sanitizePhoneNumber(phone);
    let existing = conversationStates.get(cleaned) || {
        intent: null,
        entities: {},
        pending_fields: [],
        active_ticket_id: null,
        attachments: [],
        createdAt: Date.now()
    };

    const newEntities = { ...existing.entities, ...(updates.entities || {}) };
    const intent = updates.intent || existing.intent;

    // Calculate remaining missing required fields
    const required = REQUIRED_ENTITIES[intent] || [];
    const pending_fields = required.filter(field => {
        const val = newEntities[field];
        return !val || (typeof val === 'string' && !val.trim());
    });

    const merged = {
        ...existing,
        ...updates,
        intent,
        entities: newEntities,
        pending_fields,
        attachments: updates.attachments ? [...(existing.attachments || []), ...updates.attachments] : existing.attachments,
        lastUpdated: Date.now()
    };

    conversationStates.set(cleaned, merged);
    return merged;
}

export function clearConversationState(phone) {
    const cleaned = sanitizePhoneNumber(phone);
    conversationStates.delete(cleaned);
}

/**
 * 3. Calculate Pending Fields for an Intent
 */
export function calculatePendingFields(intent, entities = {}) {
    const required = REQUIRED_ENTITIES[intent] || [];
    return required.filter(field => !entities[field] || (typeof entities[field] === 'string' && !entities[field].trim()));
}

/**
 * 4. Get recent conversation transcript for LLM Context
 */
export async function getConversationContext(phone, limit = 8) {
    const cleaned = sanitizePhoneNumber(phone);
    try {
        const res = await pool.query(`
            SELECT direction, message_type, message_body, created_at
            FROM whatsapp_messages
            WHERE sender_phone = $1 OR recipient_phone = $1
            ORDER BY created_at DESC
            LIMIT $2;
        `, [cleaned, limit]);

        const history = res.rows.reverse();

        return history.map(msg => ({
            role: msg.direction === 'inbound' ? 'user' : 'model',
            text: msg.message_body || `[${msg.message_type}]`
        }));
    } catch (error) {
        console.error("❌ getConversationContext Error:", error.message);
        return [];
    }
}

/**
 * 5. Log a Message to the database
 */
export async function saveMessage({ wabaMsgId, senderPhone, recipientPhone, direction, messageType, messageBody, mediaId, status }) {
    try {
        await pool.query(`
            INSERT INTO whatsapp_messages (
                waba_message_id, sender_phone, recipient_phone, direction,
                message_type, message_body, media_id, status, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
            ON CONFLICT DO NOTHING;
        `, [
            wabaMsgId || `MSG-${Date.now()}`,
            sanitizePhoneNumber(senderPhone),
            sanitizePhoneNumber(recipientPhone),
            direction,
            messageType || 'text',
            messageBody || '',
            mediaId || null,
            status || 'sent'
        ]);
    } catch (error) {
        console.error("❌ saveMessage Error:", error.message);
    }
}

/**
 * 6. Fetch Active Support Ticket for a Customer / Phone Number
 */
export async function getActiveSupportTicket(phone, customerId = null) {
    const cleaned = sanitizePhoneNumber(phone);
    const last10 = cleaned.slice(-10);

    try {
        const res = await pool.query(`
            SELECT t.*, c.name AS customer_name,
                   e.full_name AS assigned_engineer_name, e.phone AS assigned_engineer_phone
            FROM support_tickets t
            LEFT JOIN customers c ON t.customer_id = c.id
            LEFT JOIN employees e ON t.assigned_to = e.id
            WHERE (t.customer_phone ILIKE $1 OR t.customer_id = $2)
              AND t.status NOT IN ('Resolved', 'Closed')
            ORDER BY t.created_at DESC
            LIMIT 1;
        `, [`%${last10}%`, customerId || 0]);

        return res.rows[0] || null;
    } catch (err) {
        console.error("❌ getActiveSupportTicket Error:", err.message);
        return null;
    }
}

/**
 * 7. Fetch Client Active Project Status Details
 */
export async function getProjectStatusDetails(customerId) {
    try {
        if (!customerId) {
            return {
                isProspect: true,
                projectName: "Custom Architecture Solution",
                status: "Requirement Discovery & Scope Planning",
                milestone: "Architecture & feature scope registered. SOW under preparation.",
                stagingUrl: null,
                leadArchitect: "Shrirang Joshi (+91 98210 27060)",
                projectManager: "Nitin Sir (+91 87671 37790)"
            };
        }

        const res = await pool.query(`
            SELECT p.id, p.name, p.status, p.description,
                   am.full_name AS account_manager_name, am.phone AS account_manager_phone
            FROM projects p
            LEFT JOIN employees am ON p.account_manager_id = am.id
            WHERE p.customer_id = $1
            ORDER BY p.id DESC
            LIMIT 1;
        `, [customerId]);

        if (res.rows.length === 0) {
            return {
                isProspect: true,
                projectName: "Custom Enterprise Portal",
                status: "Architecture Draft & Requirement Scoping",
                milestone: "Initial consultation recorded. Milestone roadmap being drafted.",
                stagingUrl: null,
                leadArchitect: "Shrirang Joshi (+91 98210 27060)",
                projectManager: "Nitin Sir (+91 87671 37790)"
            };
        }

        const p = res.rows[0];
        return {
            isProspect: false,
            projectName: p.name,
            status: p.status || "In Development (Active Sprint)",
            milestone: p.description || "Core module engineering and API integration in progress.",
            stagingUrl: "https://planexsoftware.in/",
            leadArchitect: "Shrirang Joshi (+91 98210 27060)",
            projectManager: p.account_manager_name ? `${p.account_manager_name} (${p.account_manager_phone || '+91 87671 37790'})` : "Nitin Sir (+91 87671 37790)"
        };
    } catch (e) {
        console.error("❌ getProjectStatusDetails Error:", e.message);
        return {
            isProspect: true,
            projectName: "Enterprise Architecture Solution",
            status: "Requirement Gathering",
            milestone: "Discovery & consulting phase.",
            stagingUrl: null,
            leadArchitect: "Shrirang Joshi (+91 98210 27060)",
            projectManager: "Nitin Sir (+91 87671 37790)"
        };
    }
}

/**
 * 8. Fetch Client Tax Invoice & Billing Details
 */
export async function getClientInvoiceDetails(customerId) {
    const isLive = Boolean(customerId);
    return {
        isProspect: !isLive,
        invoiceNumber: isLive ? `INV-2026-${String(customerId).padStart(3, '0')}` : "PROPOSAL-QUOTATION",
        status: isLive ? "Active GST Invoice Issued" : "Requirement Scoping / Pre-Invoice Stage",
        beneficiary: "Planex Software / Pentasoft Consultancy",
        gstin: "27AABPJ2329N1ZB",
        bankName: "HDFC Bank",
        accountNo: "50200063819231",
        ifsc: "HDFC0000290",
        upiId: "joshi.shrirang@hdfcbank",
        amountDue: isLive ? "₹ 75,000 + 18% GST" : "Milestone Quotation based on selected modules",
        paymentTerms: "50% Advance upon SOW Freeze | 50% upon UAT Sign-off & Delivery"
    };
}
