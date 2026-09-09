import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: 'd:/Desktop/New folder (103A)/backend/.env' });

const { Pool } = pg;
const pool = new Pool({
  host: process.env.DB_HOST || '173.249.59.181',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Malhar#1234',
  database: process.env.DB_NAME || 'employee_management'
});

async function run() {
  try {
    const custRes = await pool.query(`SELECT * FROM customers ORDER BY name ASC;`);
    console.log('Customers found:', custRes.rows.length);
    const customerIds = custRes.rows.map(c => c.id);

    const projRes = await pool.query(
      `SELECT * FROM projects WHERE customer_id = ANY($1) ORDER BY id ASC;`,
      [customerIds]
    );
    console.log('Projects found:', projRes.rows.length);
    const projectIds = projRes.rows.map(p => p.id);

    let taskSql = `SELECT * FROM tasks WHERE customer_id = ANY($1) OR project_id = ANY($2)`;
    const taskParams = [customerIds, projectIds.length ? projectIds : [-1]];
    const taskRes = await pool.query(taskSql, taskParams);
    console.log('Tasks found:', taskRes.rows.length);

    let ticketSql = `SELECT * FROM support_tickets WHERE customer_id = ANY($1) OR project_id = ANY($2)`;
    const ticketParams = [customerIds, projectIds.length ? projectIds : [-1]];
    const ticketRes = await pool.query(ticketSql, ticketParams);
    console.log('Tickets found:', ticketRes.rows.length);

    const empRes = await pool.query(`SELECT id, full_name, employee_code, hourly_rate FROM employees;`);
    console.log('Employees found:', empRes.rows.length);

    console.log('All DB queries succeeded without error!');
  } catch (err) {
    console.error('Error running query:', err);
  } finally {
    await pool.end();
  }
}

run();
