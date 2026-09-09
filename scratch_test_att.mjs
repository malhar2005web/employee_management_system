import { pool } from './backend/config/db.js';
import { getAttendanceLogs, getAttendanceStatus } from './backend/controller/employeePortal.controller.js';

async function test() {
  const userRes = await pool.query("SELECT id, username, role, email FROM users WHERE username ILIKE '%malhar%' OR email ILIKE '%malhar%'");
  const u = userRes.rows[0];

  const testCases = [
    { query: {} },
    { query: { year: '2026', month: '09' } },
    { query: { month: '2026-09' } },
    { query: { year: '2026' } }
  ];

  for (const tc of testCases) {
    const req = { user: { id: u.id }, query: tc.query };
    const res = {
      status: (code) => ({
        json: (data) => {
          console.log(`Query ${JSON.stringify(tc.query)} => count: ${data.data ? data.data.length : 'ERR: ' + data.message}`);
        }
      })
    };
    await getAttendanceLogs(req, res);
  }
  process.exit(0);
}

test().catch(e => {
  console.error("Test error:", e);
  process.exit(1);
});
