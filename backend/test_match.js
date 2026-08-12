import { pool } from './config/db.js';
import { getWebPagesApplicationsGrid } from './services/teramind.service.js';

async function testMatch() {
    const now = Math.floor(Date.now() / 1000);
    const start = now - (365 * 24 * 3600);
    const gridData = await getWebPagesApplicationsGrid({
        periodStart: String(start),
        periodEnd: String(now)
    });
    const gridRows = gridData?.rows || [];
    console.log('GRID ROWS TOTAL:', gridRows.length);

    const emps = await pool.query('SELECT e.id, e.full_name, m.computer_id, m.computer_name FROM employees e LEFT JOIN employee_teramind_mapping m ON e.id=m.employee_id ORDER BY e.id');
    for (const e of emps.rows) {
        const compId = e.computer_id;
        const compName = (e.computer_name || '').toLowerCase();
        const empName = (e.full_name || '').toLowerCase();

        const match = gridRows.find(r => 
            r.computer?.computer_id == compId ||
            (r.computer?.name && r.computer.name.toLowerCase() === compName) ||
            (r.agent?.name && empName && r.agent.name.toLowerCase().includes(empName.split(' ')[0]))
        );

        if (match) {
            console.log(`EMP ${e.id} (${e.full_name}) -> PC ${e.computer_name} (ID:${e.computer_id}) | MATCH: process=${match.process_host}, title=${match.title}, url=${match.url}`);
        } else {
            console.log(`EMP ${e.id} (${e.full_name}) -> PC ${e.computer_name} (ID:${e.computer_id}) | NO MATCH`);
        }
    }
    pool.end();
}

testMatch();
