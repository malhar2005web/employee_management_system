import dotenv from 'dotenv';
dotenv.config();

const key = process.env.GEMINI_API_KEY;
console.log("Testing Key:", key ? `${key.substring(0, 8)}...` : 'NONE');

async function testGemini() {
    // Test 1: Standard Generative Language API
    try {
        console.log("1. Testing Google Generative Language API...");
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: 'Hello! What is Pentasoft Consultancy?' }] }]
            })
        });
        const data = await res.json();
        console.log("Response 1:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Error 1:", e.message);
    }

    // Test 2: Header Authorization Bearer
    try {
        console.log("\n2. Testing with Header Authorization...");
        const res2 = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-goog-api-key': key
            },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: 'Hello! What is Pentasoft Consultancy?' }] }]
            })
        });
        const data2 = await res2.json();
        console.log("Response 2:", JSON.stringify(data2, null, 2));
    } catch (e) {
        console.error("Error 2:", e.message);
    }
}

testGemini();
