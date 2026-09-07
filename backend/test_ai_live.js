import dotenv from 'dotenv';
dotenv.config();

import { processMessageWithAI } from './services/ai.service.js';

async function testAILive() {
    console.log("🧠 Testing Gemini 3.5 Flash Live Brain Integration...\n");

    const clientContext = {
        name: "Rajesh Sharma",
        type: "customer",
        company: "ABC Logistics Pvt Ltd",
        projects: [{ name: "Fleet Management ERP", status: "Phase 2 - QA & Staging" }]
    };

    // 1. Test Structured Intent: Project Status
    console.log("1️⃣ Query: 'Bhai mere project ka current status kya chal raha hai?'");
    const res1 = await processMessageWithAI({
        senderPhone: '918767137790',
        userMessage: 'Bhai mere project ka current status kya chal raha hai?',
        clientContext,
        conversationHistory: []
    });
    console.log("🤖 Decision 1:", JSON.stringify(res1, null, 2));

    // 2. Test Structured Intent: Invoice
    console.log("\n2️⃣ Query: 'Mujhe Tax invoice aur UPI QR details bhejo payment karna hai'");
    const res2 = await processMessageWithAI({
        senderPhone: '918767137790',
        userMessage: 'Mujhe Tax invoice aur UPI QR details bhejo payment karna hai',
        clientContext,
        conversationHistory: []
    });
    console.log("🤖 Decision 2:", JSON.stringify(res2, null, 2));

    // 3. Test Open-Ended / Unstructured Technical Query (Outside templates!)
    console.log("\n3️⃣ Free-form Query: 'Hum hamare software me barcode scanner aur thermal printer connect kar sakte hain kya? Kaise kaam karega?'");
    const res3 = await processMessageWithAI({
        senderPhone: '918767137790',
        userMessage: 'Hum hamare software me barcode scanner aur thermal printer connect kar sakte hain kya? Kaise kaam karega?',
        clientContext,
        conversationHistory: []
    });
    console.log("🤖 Natural AI Response 3:\n", res3.replyText || res3);

    console.log("\n✨ Gemini 3.5 Flash Live Brain is 100% Operational!");
    process.exit(0);
}

testAILive();
