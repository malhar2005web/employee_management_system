const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
const GEMINI_MODEL = 'gemini-3.5-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// 1. Declare Controlled Tools for Gemini
const AGENT_TOOLS = [
    {
        function_declarations: [
            {
                name: "select_service",
                description: "Select and present detailed module breakdown, dedicated team, and design blueprints when client chooses or mentions Web, App, or Hybrid development.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        service_type: { type: "STRING", enum: ["Web", "App", "Hybrid"], description: "Selected development service package" }
                    },
                    required: ["service_type"]
                }
            },
            {
                name: "get_project_status",
                description: "Fetch live milestone, sprint progress, and demo link for a client's project when asked about progress, status, completion timeline, or demo.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        reason: { type: "STRING", description: "Reason for progress check" }
                    }
                }
            },
            {
                name: "get_invoice_details",
                description: "Fetch tax invoice, billing amount, bank details, and UPI payment info when client asks for invoice, bill, payment slip, or bank details.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        invoice_id: { type: "STRING", description: "Optional invoice identifier" }
                    }
                }
            },
            {
                name: "create_support_ticket",
                description: "Create an official engineering support ticket when client reports a bug, error, downtime, machine fault, or technical issue.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        title: { type: "STRING", description: "Brief title of the issue" },
                        description: { type: "STRING", description: "Detailed description of the issue" },
                        priority: { type: "STRING", enum: ["Low", "Medium", "High", "Critical"], description: "Severity of issue" }
                    },
                    required: ["title", "description"]
                }
            },
            {
                name: "send_services_menu",
                description: "Send the official interactive services list menu ONLY when user simply says a greeting like 'Hi', 'Hello', 'Hey', 'Menu', 'Start', or asks 'What services do you provide?'. Do NOT call this if the user is asking a specific technical or custom question.",
                parameters: {
                    type: "OBJECT",
                    properties: {}
                }
            },
            {
                name: "get_ui_catalogue",
                description: "Send UI/UX design catalogues and architecture options when user wants to browse pre-made design styles or wireframe layouts.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        service_type: { type: "STRING", enum: ["Web", "App", "Hybrid"], description: "Type of development service" }
                    }
                }
            },
            {
                name: "request_excel_doc",
                description: "Ask the client if they have an existing requirements Excel document or wireframe to incorporate into their project.",
                parameters: {
                    type: "OBJECT",
                    properties: {}
                }
            },
            {
                name: "handover_to_team",
                description: "Send dedicated contact numbers of lead engineers and project manager when client requests to speak with a human or finalize project terms.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        reason: { type: "STRING", description: "Why handover is needed" }
                    }
                }
            }
        ]
    }
];

/**
 * 2. Process Incoming Message with AI Agent
 */
export async function processMessageWithAI({ senderPhone, userMessage, clientContext, conversationHistory = [] }) {
    // If no Gemini API key configured, use deterministic intent resolver
    if (!GEMINI_API_KEY) {
        return fallbackRuleEngine(userMessage, clientContext);
    }

    try {
        const systemInstruction = `
You are the Senior Technical Consultant & AI Assistant for "Pentasoft Consultancy / Planex Software".
We engineer Enterprise Web Applications, Mobile Apps (Android/iOS), Cloud SaaS Dashboards, and Industrial/WhatsApp Automation.

Lead Solution Architect: Shrirang Joshi (+91 98210 27060)
Project Delivery Lead: Nitin Sir (+91 98765 43210)

Current Client Context:
- Name: ${clientContext.name || 'Valued Client'}
- Type: ${clientContext.type} (${clientContext.company || 'Enterprise'})
- Active Projects: ${JSON.stringify(clientContext.projects || [])}

Rules:
1. Speak in a helpful, polite, professional corporate tone. Support English, Hindi, and Hinglish seamlessly.
2. CRITICAL FORMATTING RULE: NEVER USE ANY EMOJIS (no rockets, no targets, no checks, no icons). NEVER USE BOLDING OR ASTERISKS (*...*). Keep all text plain, minimal, simple, clean, and clear. Nothing loud or flashy.
3. If the user only says a greeting ("Hi", "Hello", "Hey", "Menu", "Start"), call 'send_services_menu'.
4. If the user asks for project progress, status, or staging demo, call 'get_project_status'.
5. If the user asks for invoice, billing, or payment details, call 'get_invoice_details'.
6. If the user reports a bug, error, downtime, or technical issue, call 'create_support_ticket'.
7. If the user asks a technical question (e.g. tech stack, barcode scanners, Bluetooth printers, database scaling, timelines, architecture, custom features), answer directly in clean natural plain text like an expert software architect, explaining how we can build/integrate it.
8. Keep answers crisp, structured with plain hyphens (-), and avoid shouting or marketing buzzwords.
        `.trim();

        const formattedContents = [];

        // Add history
        for (const turn of conversationHistory.slice(-6)) {
            formattedContents.push({
                role: turn.role === 'user' ? 'user' : 'model',
                parts: [{ text: turn.text }]
            });
        }

        // Add latest user message
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
                temperature: 0.3,
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

        // Check if Gemini invoked a Tool/Function Call
        if (functionCall) {
            return {
                toolCall: {
                    name: functionCall.name,
                    args: functionCall.args || {}
                }
            };
        }

        // Natural text reply from AI
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
 * 3. Robust Deterministic Fallback Engine (Runs when AI Key is absent or offline)
 */
function fallbackRuleEngine(message, clientContext) {
    const lower = (message || '').toLowerCase().trim();

    // Service Selection
    if (lower.includes('hybrid') || lower.includes('web + app') || lower.includes('full-stack') || lower.includes('full stack')) {
        return {
            toolCall: {
                name: 'select_service',
                args: { service_type: 'Hybrid' }
            }
        };
    }
    if (lower.includes('app development') || lower.includes('mobile app') || lower.includes('android') || lower.includes('ios')) {
        return {
            toolCall: {
                name: 'select_service',
                args: { service_type: 'App' }
            }
        };
    }
    if (lower.includes('web development') || lower.includes('web app') || lower.includes('website') || lower.includes('portal')) {
        return {
            toolCall: {
                name: 'select_service',
                args: { service_type: 'Web' }
            }
        };
    }

    // Support / Bug / Issue
    if (lower.includes('issue') || lower.includes('problem') || lower.includes('error') || lower.includes('bug') || lower.includes('not working') || lower.includes('downtime')) {
        return {
            toolCall: {
                name: 'create_support_ticket',
                args: {
                    title: message.substring(0, 50),
                    description: message,
                    priority: lower.includes('urgent') || lower.includes('critical') ? 'High' : 'Medium'
                }
            }
        };
    }

    // Progress / Status / Demo
    if (lower.includes('progress') || lower.includes('status') || lower.includes('update') || lower.includes('demo') || lower.includes('kaha tak')) {
        return {
            toolCall: {
                name: 'get_project_status',
                args: { reason: 'Client requested progress update' }
            }
        };
    }

    // Invoice / Payment / Bill
    if (lower.includes('invoice') || lower.includes('bill') || lower.includes('payment') || lower.includes('bank') || lower.includes('tax') || lower.includes('upi')) {
        return {
            toolCall: {
                name: 'get_invoice_details',
                args: {}
            }
        };
    }

    // Design / Catalogue
    if (lower.includes('catalogue') || lower.includes('catalog') || lower.includes('design') || lower.includes('layout') || lower.includes('ui') || lower.includes('sample')) {
        return {
            toolCall: {
                name: 'get_ui_catalogue',
                args: { service_type: 'Web' }
            }
        };
    }

    // Human / Engineer Handover
    if (lower.includes('human') || lower.includes('agent') || lower.includes('call') || lower.includes('manager') || lower.includes('speak') || lower.includes('talk')) {
        return {
            toolCall: {
                name: 'handover_to_team',
                args: { reason: 'Direct human consultation requested' }
            }
        };
    }

    // Default Greeting / Menu
    return {
        toolCall: {
            name: 'send_services_menu',
            args: {}
        }
    };
}
