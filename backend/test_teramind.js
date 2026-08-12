import { pool } from './config/db.js';
import dotenv from 'dotenv';
dotenv.config();

async function testUserScenario() {
  const baseUrl = (process.env.TERAMIND_INSTANCE_URL || 'https://planexsoftwa.teramind.co').replace(/\/$/, "");
  const token = process.env.TERAMIND_API_TOKEN || '02182bf72232fb8749b499a78140356ddb1d5c4e';

  async function apiCall(endpoint, method = 'GET', body = null) {
    const url = `${baseUrl}${endpoint}`;
    const headers = { 'x-access-token': token, 'Content-Type': 'application/json', 'Accept': 'application/json' };
    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);
    try {
      const res = await fetch(url, opts);
      const text = await res.text();
      try { return { status: res.status, json: JSON.parse(text) }; }
      catch { return { status: res.status, text }; }
    } catch (err) { return { error: err.message }; }
  }

  const compId = 24;
  const agentId = 32;
  const start = 1785562278;
  const end = 1785562338;
  const email = "admin@ganpati-pcs.com";

  console.log(`=== TESTING EXPORT FOR COMP ${compId}, AGENT ${agentId}, EMAIL ${email} ===`);
  const exportRes = await apiCall('/tm-api/player/export-video', 'POST', {
    agents: [agentId],
    computer: compId,
    start: start,
    end: end,
    speed: 1,
    frameRate: 4,
    recipient: email,
    soundDisabled: true
  });
  console.log("Export Result:", exportRes.json);

  if (exportRes.json?.ids?.length > 0) {
    const exportId = exportRes.json.ids[0];
    console.log(`Polling status for export #${exportId}...`);
    for (let i = 1; i <= 10; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const stat = await apiCall(`/tm-api/player/export-video/status/${exportId}`);
      console.log(`Poll #${i}:`, stat.json);
      if (stat.json?.status === 1) {
        console.log("Ready! URL:", stat.json.url);
        break;
      }
    }
  }

  await pool.end();
}

testUserScenario();
