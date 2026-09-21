const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// 1. Declare Controlled Tools for Gemini Function Calling
const AGENT_TOOLS = [
    {
        function_declarations: [
            {
                name: "create_support_ticket",
                description: "Create or register a technical support ticket when a client reports a bug, error, downtime, defect, or portal issue. If project is known or mentioned, include it.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        project: { type: "STRING", description: "Affected project name (e.g. Workforce EMS, HR Portal, Custom Solution)" },
                        category: { type: "STRING", enum: ["Bug / Defect", "Server / Downtime", "Configuration / Setup", "Data / Report Issue", "Feature Request", "General Support"], description: "Category of issue" },
                        priority: { type: "STRING", enum: ["Low", "Medium", "High", "Critical"], description: "Urgency level" },
                        title: { type: "STRING", description: "Concise summary of the problem" },
                        description: { type: "STRING", description: "Full technical description of what is happening" },
                        is_urgent: { type: "BOOLEAN", description: "Whether client explicitly stated urgent or critical" }
                    },
                    required: ["description"]
                }
            },
            {
                name: "check_ticket_status",
                description: "Fetch live support ticket status, assigned engineer, SLA deadline, and latest progress from EMS backend when client asks for status, update, or ETA.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        ticket_code: { type: "STRING", description: "Optional ticket code like SUP-001142" },
                        project: { type: "STRING", description: "Optional project name" }
                    }
                }
            },
            {
                name: "resolve_support_ticket",
                description: "Close or mark a support ticket as resolved when the client confirms the issue is fixed, solved, or says 'RESOLVED' / 'TICKET END'.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        ticket_code: { type: "STRING", description: "Optional ticket code" },
                        resolution_note: { type: "STRING", description: "Confirmation note from client" }
                    }
                }
            },
            {
                name: "get_invoice_and_billing",
                description: "Retrieve tax invoice, GST breakdown, outstanding balance, and official bank/UPI details when client asks for invoice, bill, payment balance, or commercial quotation.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        project: { type: "STRING", description: "Specific project or general account" },
                        invoice_id: { type: "STRING", description: "Optional invoice number like INV-1028" }
                    }
                }
            },
            {
                name: "report_payment_evidence",
                description: "Acknowledge receipt of payment screenshot, UTR number, or transaction receipt and link it to invoice for EMS verification.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        utr_no: { type: "STRING", description: "UTR or reference number if mentioned" },
                        invoice_id: { type: "STRING", description: "Invoice number" },
                        amount: { type: "STRING", description: "Amount paid if stated" }
                    }
                }
            },
            {
                name: "apply_employee_leave",
                description: "Submit an official leave request for an internal employee when an employee requests leave via WhatsApp.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        leave_type: { type: "STRING", enum: ["Casual Leave", "Sick Leave", "Privilege Leave", "Half Day", "Other"], description: "Type of leave" },
                        start_date: { type: "STRING", description: "Date of leave (e.g. Tomorrow, 2026-09-19)" },
                        end_date: { type: "STRING", description: "Optional end date for multi-day leave" },
                        reason: { type: "STRING", description: "Reason for taking leave" }
                    },
                    required: ["leave_type"]
                }
            },
            {
                name: "modify_conversation_context",
                description: "Update a previously provided detail when the client corrects themselves mid-flow (e.g. 'Actually it is for EMS project, not HR portal').",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        field: { type: "STRING", enum: ["project", "priority", "category", "description"], description: "Field being corrected" },
                        new_value: { type: "STRING", description: "Corrected value" }
                    },
                    required: ["field", "new_value"]
                }
            },
            {
                name: "select_service",
                description: "Present detailed architecture modules and wireframe options when client selects or asks about Web Development, Mobile App, or Full-Stack Hybrid engineering.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        service_type: { type: "STRING", enum: ["Web", "App", "Hybrid"], description: "Package selected" }
                    },
                    required: ["service_type"]
                }
            },
            {
                name: "handover_to_team",
                description: "Provide direct escalation contact numbers (Lead Architect Shrirang Joshi +91 98210 27060, Project Manager Nitin Sir +91 87671 37790) when user demands a call, escalation, or human discussion.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        reason: { type: "STRING", description: "Reason for human handover or call request" },
                        department: { type: "STRING", enum: ["Sales", "Technical", "Accounts", "Management"], description: "Relevant department" }
                    }
                }
            },
            {
                name: "send_services_menu",
                description: "Send the main 3-option interactive service menu ONLY when user sends a basic greeting ('Hi', 'Hello', 'Start', 'Menu'). Do NOT call this if a specific question or issue was raised.",
                parameters: {
                    type: "OBJECT",
                    properties: {}
                }
            }
        ]
    }
];

/**
 * 2. Process Incoming Message with Grounded Gemini 4-Layer Architecture
 */
export async function processMessageWithAI({ senderPhone, userMessage, clientContext, conversationHistory = [] }) {
    if (!GEMINI_API_KEY) {
        return fallbackRuleEngine(userMessage, clientContext);
    }

    try {
        const systemInstruction = `
You are the Senior Technical Consultant & AI Assistant for "Planex Software / Pentasoft Consultancy".
We build and support Enterprise Web Applications, Mobile Apps (Android/iOS), Workforce EMS SaaS, and Industrial Automation.

Official Leadership & Contacts:
- Lead Solution Architect & Business Head: Shrirang Joshi (+91 98210 27060)
- Project Manager & Technical Delivery: Nitin RajGuru (+91 87671 37790)
- Accounts & Invoicing Desk: (+91 96645 40011)

Current Client Context from EMS Database:
- Client Name: ${clientContext.name || 'Valued Client'}
- User Type: ${clientContext.type} (${clientContext.company || 'Enterprise'})
- Active Projects: ${JSON.stringify(clientContext.projects || [])}
- Assigned Team: ${JSON.stringify(clientContext.assignedEmployees || [])}

CORE 4-LAYER RESPONSE RULES (Strictly Enforced):
1. Gemini interprets; EMS backend validates and executes; PostgreSQL is the single source of truth.
2. Never say vague phrases like "OK", "Done", "Checking", or "Will try".
3. Every completed action must return a structured confirmation with Ticket/Invoice ID, Project, Status, Assignee, SLA, or next step.
4. Ask ONLY for missing information (pending_fields). Never re-ask for details already provided by the customer.
5. If the client provides complete context in 1 message (e.g. "EMS portal slow, cannot login"), invoke 'create_support_ticket' immediately with project and priority without forcing a multi-step questionnaire.
6. Never fabricate a fake Ticket ID, resolution timestamp, or successful payment. Real IDs and balances come from EMS backend.
7. Tone: Crisp, professional, polite, reassuring. Clean corporate English/Hindi/Hinglish.
8. FORMATTING RULE: Do NOT use loud emojis or markdown asterisk bolding spam. Keep text clean and structured.

CANONICAL INTENTS & BEHAVIOR:
- GREETING: ("Hi", "Hello") -> Call 'send_services_menu'.
- TECH SUPPORT / BUG: ("Portal down", "Attendance not submitting") -> Call 'create_support_ticket'.
- STATUS CHECK: ("What is the status of my ticket?", "Any update?") -> Call 'check_ticket_status'.
- RESOLUTION: ("Issue is fixed", "Resolved", "Ticket end", "Kam ho gaya") -> Call 'resolve_support_ticket'.
- BILLING / INVOICE: ("Send invoice", "How much pending?") -> Call 'get_invoice_and_billing'.
- PAYMENT PROOF: ("I paid", "Here is UTR screenshot") -> Call 'report_payment_evidence'.
- LEAVE: ("Need leave tomorrow") -> Call 'apply_employee_leave' (if employee).
- CORRECTION: ("Actually for EMS project") -> Call 'modify_conversation_context'.
- CALL / ESCALATION: ("Want to speak to someone", "Nobody helping", "Call me") -> Call 'handover_to_team'.
- ARCHITECTURE / COMPLEX: Low confidence or architectural changes -> Call 'handover_to_team' rather than hallucinating answers.
        `.trim();

        const formattedContents = [];

        // Feed recent history
        for (const turn of conversationHistory.slice(-6)) {
            formattedContents.push({
                role: turn.role === 'user' ? 'user' : 'model',
                parts: [{ text: turn.text }]
            });
        }

        // Add current user input
        formattedContents.push({
            role: 'user',
            parts: [{ text: userMessage }]
        });

        const payload = {
            system_instruction: {
                parts: [{ text: systemInstruction }]
            },
            contents: formattedContents,
            tools: AGENT_TOOLS,
            tool_config: {
                function_calling_config: {
                    mode: "AUTO"
                }
            },
            generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 600
            }
        };

        const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || GEMINI_API_KEY;
        const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(15000)
        });

        const data = await response.json();
        const parts = data?.candidates?.[0]?.content?.parts || [];

        let functionCall = null;
        let replyText = '';

        for (const p of parts) {
            if (p.functionCall) {
                functionCall = p.functionCall;
                break;
            }
            if (p.text) {
                replyText += p.text;
            }
        }

        if (functionCall) {
            return {
                toolCall: {
                    name: functionCall.name,
                    args: functionCall.args || {}
                }
            };
        }

        if (replyText) {
            return {
                replyText: replyText.trim()
            };
        }

        return fallbackRuleEngine(userMessage, clientContext);
    } catch (error) {
        console.error("❌ processMessageWithAI Error:", error.message);
        return fallbackRuleEngine(userMessage, clientContext);
    }
}

/**
 * 3. Robust Deterministic Intent Normalizer & Fallback Engine
 */
export function fallbackRuleEngine(message, clientContext = {}) {
    const lower = (message || '').toLowerCase().trim();

    // 1. Ticket Resolution (Fixed / Close / Resolved / Solved)
    if (lower === 'resolved' || lower.includes('ticket end') || lower.includes('close ticket') || lower.includes('close it') ||
        lower.includes('issue fixed') || lower.includes('issue is fixed') || lower.includes('is fixed now') ||
        lower.includes('issue solved') || lower.includes('problem solved') || lower.includes('sab theek hai') || lower.includes('kam ho gaya')) {
        return {
            toolCall: {
                name: 'resolve_support_ticket',
                args: { resolution_note: message }
            }
        };
    }

    // 2. Direct Call / Human Handover / Escalation
    if (lower.includes('call me') || lower.includes('call karo') || lower.includes('phone') || lower.includes('talk to') || 
        lower.includes('speak to') || lower.includes('human') || lower.includes('manager') || lower.includes('nobody helping') || lower.includes('twice')) {
        return {
            toolCall: {
                name: 'handover_to_team',
                args: { reason: message, department: 'Technical' }
            }
        };
    }

    // 3. Mid-flow context correction
    if (lower.includes('actually') || lower.includes('nahi yeh') || lower.includes('change project') || lower.includes('not hr') || lower.includes('it is for')) {
        let correctedProject = 'Workforce EMS';
        if (lower.includes('ems')) correctedProject = 'Workforce EMS';
        else if (lower.includes('portal')) correctedProject = 'Enterprise Portal';
        return {
            toolCall: {
                name: 'modify_conversation_context',
                args: { field: 'project', new_value: correctedProject }
            }
        };
    }

    // 4. Ticket Status Check
    if (lower.includes('status of my ticket') || lower.includes('ticket status') || lower.includes('kaha tak pohocha') || lower.includes('any update') || lower.includes('check my ticket')) {
        return {
            toolCall: {
                name: 'check_ticket_status',
                args: {}
            }
        };
    }

    // 5. Payment Evidence / UTR
    if (lower.includes('utr') || lower.includes('paid the invoice') || lower.includes('payment done') || lower.includes('paid') || lower.includes('receipt')) {
        return {
            toolCall: {
                name: 'report_payment_evidence',
                args: { notes: message }
            }
        };
    }

    // 6. Invoice / Billing Query
    if (lower.includes('invoice') || lower.includes('bill') || lower.includes('pending amount') || lower.includes('how much pending') || lower.includes('bank details') || lower.includes('gstin')) {
        return {
            toolCall: {
                name: 'get_invoice_and_billing',
                args: {}
            }
        };
    }

    // 7. Employee Leave Application
    if (lower.includes('leave') || lower.includes('chutti') || lower.includes('sick leave') || lower.includes('casual leave')) {
        let lType = 'Casual Leave';
        if (lower.includes('sick')) lType = 'Sick Leave';
        return {
            toolCall: {
                name: 'apply_employee_leave',
                args: { leave_type: lType, start_date: 'Tomorrow', reason: message }
            }
        };
    }

    // 8. Technical Support / Bug / Downtime (HIGHER PRIORITY THAN GENERAL SALES KEYWORDS)
    if (lower.includes('issue') || lower.includes('problem') || lower.includes('error') || lower.includes('bug') || 
        lower.includes('not working') || lower.includes('unable to') || lower.includes('nahi chal raha') || lower.includes('slow') || lower.includes('crash') || lower.includes('server down') || lower.includes('down')) {
        
        let cat = 'Bug / Defect';
        if (lower.includes('server') || lower.includes('down') || lower.includes('slow') || lower.includes('downtime')) cat = 'Server / Downtime';
        
        let pri = 'Medium';
        if (lower.includes('urgent') || lower.includes('critical') || lower.includes('asap') || lower.includes('emergency')) pri = 'High';

        let detectedProject = null;
        if (lower.includes('ems')) detectedProject = 'Workforce EMS';
        else if (lower.includes('portal')) detectedProject = 'Workforce EMS';

        return {
            toolCall: {
                name: 'create_support_ticket',
                args: {
                    project: detectedProject,
                    category: cat,
                    priority: pri,
                    title: message.substring(0, 60),
                    description: message,
                    is_urgent: pri === 'High'
                }
            }
        };
    }

    // 9. Service Selection (Sales Desk - New Project Development)
    if (lower.includes('hybrid') || lower.includes('web + app') || lower.includes('full-stack') || lower.includes('full stack')) {
        return {
            toolCall: {
                name: 'select_service',
                args: { service_type: 'Hybrid' }
            }
        };
    }
    if (lower.includes('app development') || lower.includes('mobile app') || lower.includes('need an app') || lower.includes('build an app') || lower.includes('android') || lower.includes('ios')) {
        return {
            toolCall: {
                name: 'select_service',
                args: { service_type: 'App' }
            }
        };
    }
    if (lower.includes('web development') || lower.includes('web app') || lower.includes('need a website') || lower.includes('build a portal')) {
        return {
            toolCall: {
                name: 'select_service',
                args: { service_type: 'Web' }
            }
        };
    }

    // 10. Default: Welcome / Greeting Menu
    return {
        toolCall: {
            name: 'send_services_menu',
            args: {}
        }
    };
}
