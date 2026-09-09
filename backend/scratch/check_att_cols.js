import { pool } from '../config/db.js';

(async () => {
    try {
        const attCols = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'attendance'
            ORDER BY ordinal_position;
        `);
        console.log('--- ATTENDANCE COLUMNS ---');
        console.table(attCols.rows);

        const sheetCols = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'pcs_attendance_sheet'
            ORDER BY ordinal_position;
        `);
        console.log('--- PCS_ATTENDANCE_SHEET COLUMNS ---');
        console.table(sheetCols.rows);

        const sampleSheet = await pool.query(`SELECT * FROM pcs_attendance_sheet LIMIT 3;`);
        console.log('--- PCS_ATTENDANCE_SHEET SAMPLE ---', sampleSheet.rows);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
