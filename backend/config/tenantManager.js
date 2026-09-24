import { AsyncLocalStorage } from 'async_hooks';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';
import { ENV_VARS } from './envVars.js';

const { Pool } = pg;

export const tenantStorage = new AsyncLocalStorage();

// Connection pool for ems_master (companies registry & central directory)
export const masterPool = new Pool({
    user: ENV_VARS.PGUSER,
    host: ENV_VARS.PGHOST,
    database: 'ems_master',
    password: ENV_VARS.PGPASSWORD,
    port: ENV_VARS.PGPORT || 5432,
    max: 5,
    idleTimeoutMillis: 15 * 60 * 1000,
    options: '-c timezone=Asia/Kolkata',
    ssl: false
});

masterPool.on('error', (err) => {
    console.error('[masterPool Error]:', err.message);
});

// Cache of active tenant connection pools: dbName -> Pool
const tenantPools = new Map();

// In-memory cache of companyCode/subdomain -> dbName
const companyCodeToDbMap = new Map();
companyCodeToDbMap.set('pcs', 'ems');
companyCodeToDbMap.set('default', 'ems');

/**
 * Get or create a lightweight connection pool for a specific tenant database
 */
export function getTenantPool(dbName) {
    if (!dbName) dbName = ENV_VARS.PGDATABASE || 'ems';
    const cleanDb = dbName.toLowerCase().trim();

    if (!tenantPools.has(cleanDb)) {
        const pool = new Pool({
            user: ENV_VARS.PGUSER,
            host: ENV_VARS.PGHOST,
            database: cleanDb,
            password: ENV_VARS.PGPASSWORD,
            port: ENV_VARS.PGPORT || 5432,
            max: 5, // Lightweight pool per tenant to avoid Postgres connection saturation
            idleTimeoutMillis: 15 * 60 * 1000, // Disconnect idle clients after 15 mins
            options: '-c timezone=Asia/Kolkata',
            ssl: false
        });

        pool.on('error', (err) => {
            console.error(`[TenantPool Error] DB ${cleanDb}:`, err.message);
        });

        tenantPools.set(cleanDb, pool);
    }

    return tenantPools.get(cleanDb);
}

/**
 * Resolve company code, slug, or subdomain into its physical PostgreSQL database name
 */
export async function resolveCompanyDb(codeOrSubdomain) {
    if (!codeOrSubdomain) return 'ems';
    const cleanCode = codeOrSubdomain.toLowerCase().trim();
    if (cleanCode === 'pcs' || cleanCode === 'default' || cleanCode === 'ems') return 'ems';

    if (companyCodeToDbMap.has(cleanCode)) {
        return companyCodeToDbMap.get(cleanCode);
    }

    try {
        const res = await masterPool.query(
            'SELECT db_name FROM companies WHERE LOWER(company_code) = $1 OR LOWER(subdomain) = $1 LIMIT 1',
            [cleanCode]
        );
        if (res.rows.length > 0) {
            const db = res.rows[0].db_name;
            companyCodeToDbMap.set(cleanCode, db);
            return db;
        }
    } catch (err) {
        console.error('[resolveCompanyDb] Error querying master registry:', err.message);
    }

    return 'ems';
}

/**
 * Express Middleware: Determines current tenant and scopes execution via AsyncLocalStorage
 */
export async function tenantMiddleware(req, res, next) {
    let tenantCode = null;

    // 1. Explicit HTTP header from frontend client (x-company-code or x-tenant-id)
    if (req.headers['x-company-code']) {
        tenantCode = req.headers['x-company-code'];
    } else if (req.headers['x-tenant-id']) {
        tenantCode = req.headers['x-tenant-id'];
    }

    // 2. Query parameters (?org=tata or ?company=tata)
    if (!tenantCode && (req.query?.org || req.query?.companyCode)) {
        tenantCode = req.query.org || req.query.companyCode;
    }

    // 3. JWT Token inspection (extract companyCode if encoded in token)
    if (!tenantCode) {
        let token = req.cookies?.["jwt-moma"];
        if (!token && req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
            token = req.headers.authorization.split(" ")[1];
        }
        if (token) {
            try {
                const decoded = jwt.decode(token);
                if (decoded && decoded.companyCode) {
                    tenantCode = decoded.companyCode;
                }
            } catch (e) {}
        }
    }

    // 4. Subdomain detection from Host / X-Forwarded-Host (e.g. tata.emscloud.com -> tata)
    if (!tenantCode) {
        const host = req.headers['x-forwarded-host'] || req.headers.host || '';
        const cleanHost = host.split(':')[0]; // Remove port if present
        // Ensure it's not a raw IP address or localhost
        if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(cleanHost) && cleanHost !== 'localhost') {
            const parts = cleanHost.split('.');
            if (parts.length > 2) {
                const sub = parts[0].toLowerCase();
                if (sub !== 'www' && sub !== 'app' && sub !== 'api') {
                    tenantCode = sub;
                }
            }
        }
    }

    // Default fallback
    if (!tenantCode) {
        tenantCode = 'pcs';
    }

    const dbName = await resolveCompanyDb(tenantCode);
    const tenantPool = getTenantPool(dbName);

    const tenantContext = {
        companyCode: tenantCode,
        dbName,
        pool: tenantPool
    };

    req.tenant = tenantContext;

    tenantStorage.run(tenantContext, () => {
        next();
    });
}

/**
 * Automatically provisions a brand-new database for a registered company
 * Clones all 95 tables and 21 functions/routines in <0.5 seconds using TEMPLATE ems_template
 */
export async function provisionNewCompanyDatabase({ companyName, companyCode, adminFullName, email, password, adminModules, employeeModules }) {
    const cleanCode = companyCode.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    if (!cleanCode || cleanCode.length < 2) {
        throw new Error("Company code must be at least 2 alphanumeric characters.");
    }

    const trimmedEmail = email.toLowerCase().trim();
    const dbName = `ems_${cleanCode}`;

    // 1. Check if company code already exists in master registry
    const checkRes = await masterPool.query(
        'SELECT id FROM companies WHERE LOWER(company_code) = $1 OR LOWER(subdomain) = $1 LIMIT 1',
        [cleanCode]
    );
    if (checkRes.rows.length > 0) {
        throw new Error(`Company code '${cleanCode}' is already registered. Please choose another code.`);
    }

    // 2. Clone database structure using PostgreSQL TEMPLATE feature
    const masterClient = await masterPool.connect();
    let dbCreated = false;
    try {
        console.log(`[Provisioning] Creating database ${dbName} from template ems_template...`);
        // Terminate any active sessions on ems_template just in case
        await masterClient.query(`
            SELECT pg_terminate_backend(pid) 
            FROM pg_stat_activity 
            WHERE datname = 'ems_template' AND pid <> pg_backend_pid();
        `);

        await masterClient.query(`CREATE DATABASE "${dbName}" TEMPLATE ems_template;`);
        dbCreated = true;
        console.log(`[Provisioning] Database ${dbName} successfully cloned with all tables & functions!`);
    } catch (err) {
        console.error(`[Provisioning] Failed to create database ${dbName}:`, err.message);
        throw new Error(`Failed to provision company database: ${err.message}`);
    } finally {
        masterClient.release();
    }

    // 3. Connect to the new database and initialize Master Admin user
    const newDbPool = getTenantPool(dbName);
    const newClient = await newDbPool.connect();

    try {
        await newClient.query("BEGIN");

        const salt = await bcryptjs.genSalt(10);
        const hashedPassword = await bcryptjs.hash(password.trim(), salt);
        const username = trimmedEmail.split('@')[0];
        const plainPass = password.trim();

        const defaultAdminModules = adminModules && Array.isArray(adminModules) && adminModules.length > 0 
            ? adminModules 
            : ["monitoring", "organization", "customers", "tasks", "support", "attendance", "communication", "settings"];

        const defaultEmployeeModules = employeeModules && Array.isArray(employeeModules) && employeeModules.length > 0
            ? employeeModules
            : ["attendance", "leave", "tasks", "dsr", "inbox", "organization"];

        // Create Admin user in users table with must_change_password and plain_password
        const userRes = await newClient.query(
            `INSERT INTO users (username, email, password, plain_password, must_change_password, role, is_active, created_at, updated_at)
             VALUES ($1, $2, $3, $4, true, 'Admin', true, NOW(), NOW())
             RETURNING id, username, email, role, is_active`,
            [username, trimmedEmail, hashedPassword, plainPass]
        );
        const newAdmin = userRes.rows[0];

        // Create Master Admin profile in employees table
        const empCode = `ADM-${cleanCode.toUpperCase().slice(0, 4)}-001`;
        await newClient.query(
            `INSERT INTO employees (
                user_id, full_name, employee_code, plain_password, status, joining_date, created_at, updated_at
             ) VALUES ($1, $2, $3, $4, 'Active', CURRENT_DATE, NOW(), NOW())`,
            [newAdmin.id, adminFullName.trim(), empCode, plainPass]
        );

        await newClient.query("COMMIT");

        // 4. Record company in ems_master registry with module lists and credentials
        const compRes = await masterPool.query(
            `INSERT INTO companies (
                company_name, company_code, subdomain, db_name, admin_email, admin_name, admin_temp_password, admin_modules, employee_modules, status, created_at, updated_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ACTIVE', NOW(), NOW())
             RETURNING id, company_name, company_code, subdomain, db_name, admin_email, admin_name, admin_temp_password, admin_modules, employee_modules, status`,
            [
                companyName.trim(), 
                cleanCode, 
                cleanCode, 
                dbName, 
                trimmedEmail, 
                adminFullName.trim(), 
                plainPass, 
                JSON.stringify(defaultAdminModules), 
                JSON.stringify(defaultEmployeeModules)
            ]
        );

        companyCodeToDbMap.set(cleanCode, dbName);

        console.log(`[Provisioning] Company '${companyName}' [${cleanCode}] successfully registered and ready!`);

        return {
            company: compRes.rows[0],
            adminUser: newAdmin,
            dbName,
            companyCode: cleanCode
        };

    } catch (err) {
        await newClient.query("ROLLBACK");
        // Automated Rollback: Drop newly created database if user seeding failed
        if (dbCreated) {
            console.warn(`[Provisioning Rollback] Dropping database ${dbName} due to error...`);
            try {
                await masterPool.query(`DROP DATABASE IF EXISTS "${dbName}";`);
                await masterPool.query(`DELETE FROM companies WHERE company_code = $1;`, [cleanCode]);
                tenantPools.delete(dbName);
            } catch (dropErr) {
                console.error(`[Provisioning Rollback Error]`, dropErr.message);
            }
        }
        throw err;
    } finally {
        newClient.release();
    }
}

/**
 * Permanently deletes a tenant company, drops its PostgreSQL database, and clears cached pools
 */
export async function deleteCompanyAndDatabase(companyId) {
    const compRes = await masterPool.query(
        'SELECT id, company_name, company_code, db_name FROM companies WHERE id = $1',
        [companyId]
    );

    if (compRes.rows.length === 0) {
        throw new Error('Company not found.');
    }

    const company = compRes.rows[0];
    const { company_code, db_name, company_name } = company;

    // Safety guard: Protect root default database
    if (['pcs', 'default'].includes(company_code.toLowerCase()) || ['ems', 'ems_master', 'ems_template', 'postgres'].includes(db_name.toLowerCase())) {
        throw new Error(`Company '${company_name}' [${company_code}] is a protected root system tenant and cannot be deleted.`);
    }

    const cleanDb = db_name.toLowerCase().trim();

    // 1. Close cached connection pool in Node.js
    if (tenantPools.has(cleanDb)) {
        try {
            const p = tenantPools.get(cleanDb);
            await p.end();
        } catch (e) {
            console.warn(`[DeleteTenant] Error closing pool for ${cleanDb}:`, e.message);
        }
        tenantPools.delete(cleanDb);
    }
    companyCodeToDbMap.delete(company_code.toLowerCase());

    // 2. Terminate any active Postgres connections to the database
    const masterClient = await masterPool.connect();
    try {
        await masterClient.query(`
            SELECT pg_terminate_backend(pid) 
            FROM pg_stat_activity 
            WHERE datname = $1 AND pid <> pg_backend_pid();
        `, [cleanDb]);

        // 3. Drop the PostgreSQL database
        await masterClient.query(`DROP DATABASE IF EXISTS "${cleanDb}";`);
        console.log(`[DeleteTenant] Database ${cleanDb} successfully dropped.`);

        // 4. Remove company from ems_master registry
        await masterClient.query('DELETE FROM companies WHERE id = $1;', [companyId]);
        console.log(`[DeleteTenant] Company '${company_name}' [${company_code}] removed from registry.`);

        return {
            companyId,
            companyName: company_name,
            companyCode: company_code,
            dbName: cleanDb
        };
    } finally {
        masterClient.release();
    }
}

