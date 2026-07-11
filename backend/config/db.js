import pg from 'pg';
import { ENV_VARS } from './envVars.js';

const { Pool } = pg;

// Parse timestamp without timezone (OID 1114) as UTC Date
pg.types.setTypeParser(1114, function(stringValue) {
    return new Date(stringValue + 'Z');
});

export const pool = new Pool({
    user: ENV_VARS.PGUSER,
    host: ENV_VARS.PGHOST,
    database: ENV_VARS.PGDATABASE,
    password: ENV_VARS.PGPASSWORD,
    port: ENV_VARS.PGPORT,
    ssl: {
        rejectUnauthorized: false
    }
});

export const connectDB = async () => {
    try {
        const client = await pool.connect();
        console.log(`🚀 PostgreSQL connected successfully to host: ${ENV_VARS.PGHOST}`);
        client.release();
    } catch (error) {
        console.error("❌ PostgreSQL connection failed:", error.message);
        console.error("Proceeding without database connection. Server running in degraded mode.");
    }
};
