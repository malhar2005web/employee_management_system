import pg from 'pg';
import { ENV_VARS } from './envVars.js';

const { Pool } = pg;

// Parse timestamp without timezone (OID 1114) with Asia/Kolkata timezone (+05:30)
pg.types.setTypeParser(1114, function(stringValue) {
    if (!stringValue) return null;
    if (!stringValue.includes('Z') && !stringValue.includes('+') && !stringValue.includes('-') && stringValue.length >= 10) {
        return new Date(stringValue.replace(' ', 'T') + '+05:30');
    }
    return new Date(stringValue);
});

// Parse DATE without timezone (OID 1082) as raw 'YYYY-MM-DD' string
pg.types.setTypeParser(1082, function(stringValue) {
    return stringValue;
});

export const pool = new Pool({
    user: ENV_VARS.PGUSER,
    host: ENV_VARS.PGHOST,
    database: ENV_VARS.PGDATABASE,
    password: ENV_VARS.PGPASSWORD,
    port: ENV_VARS.PGPORT,
    options: '-c timezone=Asia/Kolkata',
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
