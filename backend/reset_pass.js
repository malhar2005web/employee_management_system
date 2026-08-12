import { pool } from './config/db.js';
import bcryptjs from 'bcryptjs';

async function resetPass() {
    try {
        const hash = await bcryptjs.hash('employee123', 10);
        await pool.query('UPDATE users SET password = $1 WHERE id IN (2, 3)', [hash]);
        console.log('✅ Employee passwords updated to employee123');
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
resetPass();
