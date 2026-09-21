import pg from 'pg';
import { ENV_VARS } from './envVars.js';
import { tenantStorage } from './tenantManager.js';

const { Pool } = pg;

// Parse timestamp without timezone (OID 1114) with Asia/Kolkata timezone (+05:30)
pg.types.setTypeParser(1114, function(stringValue) {
    if (!stringValue) return null;
    const hasTzOffset = stringValue.endsWith('Z') || /[+-]\d{2}(:\d{2})?$/.test(stringValue);
    if (!hasTzOffset && stringValue.length >= 10) {
        return new Date(stringValue.replace(' ', 'T') + '+05:30');
    }
    return new Date(stringValue);
});

// Parse DATE without timezone (OID 1082) as raw 'YYYY-MM-DD' string
pg.types.setTypeParser(1082, function(stringValue) {
    return stringValue;
});

export const defaultPool = new Pool({
    user: ENV_VARS.PGUSER,
    host: ENV_VARS.PGHOST,
    database: ENV_VARS.PGDATABASE || 'ems',
    password: ENV_VARS.PGPASSWORD,
    port: ENV_VARS.PGPORT,
    options: '-c timezone=Asia/Kolkata',
    ssl: false
});

/**
 * Smart Dynamic Pool Proxy:
 * Whenever ANY controller or service calls pool.query(...), pool.connect(...), etc.,
 * this proxy automatically forwards the call to the current tenant's database connection pool
 * resolved by tenantMiddleware via AsyncLocalStorage.
 * If called outside of an active HTTP request (e.g. background crons or initialization),
 * it seamlessly falls back to defaultPool (the default 'ems' database).
 */
export const pool = new Proxy(defaultPool, {
    get(target, prop) {
        const store = tenantStorage.getStore();
        const activePool = store?.pool || target;
        const value = activePool[prop];
        if (typeof value === 'function') {
            return value.bind(activePool);
        }
        return value;
    }
});

export const connectDB = async () => {
    try {
        const client = await defaultPool.connect();
        console.log(`🚀 PostgreSQL connected successfully to host: ${ENV_VARS.PGHOST} (Default DB: ${ENV_VARS.PGDATABASE || 'ems'})`);
        client.release();
    } catch (error) {
        console.error("❌ PostgreSQL connection failed:", error.message);
        console.error("Proceeding without database connection. Server running in degraded mode.");
    }
};
