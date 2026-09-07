import dotenv from 'dotenv';
dotenv.config();

const key = process.env.GEMINI_API_KEY;

async function listModels() {
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        const data = await res.json();
        console.log("v1beta Models:", data.models ? data.models.map(m => m.name) : data);
    } catch (e) {
        console.error("v1beta error:", e.message);
    }

    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${key}`);
        const data = await res.json();
        console.log("v1 Models:", data.models ? data.models.map(m => m.name) : data);
    } catch (e) {
        console.error("v1 error:", e.message);
    }
}

listModels();
