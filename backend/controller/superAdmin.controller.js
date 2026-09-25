import { masterPool, provisionNewCompanyDatabase, deleteCompanyAndDatabase, getTenantPool } from "../config/tenantManager.js";
import bcryptjs from "bcryptjs";

/**
 * Super Admin Dashboard KPI Stats
 */
export async function getSuperAdminStats(req, res) {
    try {
        const totalCompaniesRes = await masterPool.query("SELECT COUNT(*) AS total FROM companies;");
        const activeCompaniesRes = await masterPool.query("SELECT COUNT(*) AS active FROM companies WHERE status = 'ACTIVE';");
        const provisionedDbsRes = await masterPool.query("SELECT COUNT(DISTINCT db_name) AS total_dbs FROM companies;");

        return res.status(200).json({
            success: true,
            stats: {
                totalCompanies: parseInt(totalCompaniesRes.rows[0]?.total || 0, 10),
                activeCompanies: parseInt(activeCompaniesRes.rows[0]?.active || 0, 10),
                provisionedDbs: parseInt(provisionedDbsRes.rows[0]?.total_dbs || 0, 10)
            }
        });
    } catch (error) {
        console.error("[SuperAdmin] getSuperAdminStats error:", error);
        return res.status(500).json({ success: false, message: "Failed to fetch Super Admin stats." });
    }
}

/**
 * List all registered companies with their database and module entitlements
 */
export async function getCompanies(req, res) {
    try {
        const query = `
            SELECT 
                id, 
                company_name, 
                company_code, 
                subdomain, 
                db_name, 
                admin_name, 
                admin_email, 
                admin_temp_password, 
                admin_modules, 
                employee_modules, 
                status, 
                created_at, 
                updated_at
            FROM companies
            ORDER BY id DESC;
        `;
        const result = await masterPool.query(query);

        // Fetch live counts for each tenant: Admin count & Employee count
        const companiesWithCounts = await Promise.all(result.rows.map(async (comp) => {
            let employeeCount = 0;
            let adminCount = 1;
            try {
                const tenantPool = getTenantPool(comp.db_name);
                const countRes = await tenantPool.query(
                    `SELECT 
                        COUNT(CASE WHEN u.role = 'Admin' THEN 1 END) AS admins,
                        COUNT(CASE WHEN u.role = 'Employee' OR (u.role IS NULL AND e.id IS NOT NULL AND e.employee_code NOT LIKE 'ADM-%') THEN 1 END) AS employees
                     FROM users u
                     FULL OUTER JOIN employees e ON e.user_id = u.id`
                );
                adminCount = parseInt(countRes.rows[0]?.admins || 1, 10);
                employeeCount = parseInt(countRes.rows[0]?.employees || 0, 10);
            } catch (err) {
                // fallback to defaults if DB sleeping
            }
            return {
                ...comp,
                admin_count: adminCount,
                employee_count: employeeCount
            };
        }));

        return res.status(200).json({
            success: true,
            companies: companiesWithCounts
        });
    } catch (error) {
        console.error("[SuperAdmin] getCompanies error:", error);
        return res.status(500).json({ success: false, message: "Failed to fetch companies." });
    }
}

/**
 * Provision a brand new company (creates tenant DB from template, sets modules & temp admin credentials)
 */
export async function provisionCompany(req, res) {
    try {
        const { companyName, companyCode, adminFullName, email, password, adminModules, employeeModules } = req.body;

        if (!companyName || !companyCode || !adminFullName || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "All fields are required: Company Name, Company Code, Admin Full Name, Email, Password."
            });
        }

        const result = await provisionNewCompanyDatabase({
            companyName: companyName.trim(),
            companyCode: companyCode.trim(),
            adminFullName: adminFullName.trim(),
            email: email.trim(),
            password: password.trim(),
            adminModules: adminModules || [],
            employeeModules: employeeModules || []
        });

        return res.status(201).json({
            success: true,
            message: `Tenant '${companyName}' successfully provisioned! Database '${result.dbName}' is ready.`,
            data: result
        });
    } catch (error) {
        console.error("[SuperAdmin] provisionCompany error:", error);
        return res.status(400).json({
            success: false,
            message: error.message || "Failed to provision new company."
        });
    }
}

/**
 * Update permitted Admin & Employee modules for an existing company
 */
export async function updateCompanyModules(req, res) {
    try {
        const { id } = req.params;
        const { adminModules, employeeModules } = req.body;

        if (!id) {
            return res.status(400).json({ success: false, message: "Company ID is required." });
        }

        const query = `
            UPDATE companies
            SET 
                admin_modules = $1,
                employee_modules = $2,
                updated_at = NOW()
            WHERE id = $3
            RETURNING id, company_name, company_code, admin_modules, employee_modules;
        `;

        const result = await masterPool.query(query, [
            JSON.stringify(adminModules || []),
            JSON.stringify(employeeModules || []),
            id
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Company not found." });
        }

        return res.status(200).json({
            success: true,
            message: "Company modules updated successfully.",
            company: result.rows[0]
        });
    } catch (error) {
        console.error("[SuperAdmin] updateCompanyModules error:", error);
        return res.status(500).json({ success: false, message: "Failed to update company modules." });
    }
}

/**
 * Toggle company status between ACTIVE and SUSPENDED
 */
export async function toggleCompanyStatus(req, res) {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!id || !status) {
            return res.status(400).json({ success: false, message: "Company ID and status are required." });
        }

        const validStatuses = ['ACTIVE', 'SUSPENDED'];
        if (!validStatuses.includes(status.toUpperCase())) {
            return res.status(400).json({ success: false, message: "Status must be ACTIVE or SUSPENDED." });
        }

        const query = `
            UPDATE companies
            SET status = $1, updated_at = NOW()
            WHERE id = $2
            RETURNING id, company_name, company_code, status;
        `;

        const result = await masterPool.query(query, [status.toUpperCase(), id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Company not found." });
        }

        return res.status(200).json({
            success: true,
            message: `Company status changed to ${status.toUpperCase()}.`,
            company: result.rows[0]
        });
    } catch (error) {
        console.error("[SuperAdmin] toggleCompanyStatus error:", error);
        return res.status(500).json({ success: false, message: "Failed to update company status." });
    }
}

/**
 * Fetch permitted modules for current tenant / company code
 * Used by frontend dashboards to filter sidebar tabs dynamically
 */
export async function getCompanyModulesForTenant(req, res) {
    try {
        const companyCode = req.query.code || req.tenant?.companyCode || 'pcs';

        const query = `
            SELECT company_name, company_code, status, admin_modules, employee_modules
            FROM companies
            WHERE LOWER(company_code) = LOWER($1) 
               OR LOWER(subdomain) = LOWER($1) 
               OR LOWER(company_name) = LOWER($1)
               OR LOWER(REPLACE(company_name, ' ', '')) = LOWER($1)
            LIMIT 1;
        `;
        const result = await masterPool.query(query, [companyCode]);

        if (result.rows.length === 0) {
            return res.status(200).json({
                success: true,
                admin_modules: ["monitoring", "organization", "customers", "tasks", "support", "attendance", "communication", "settings"],
                employee_modules: ["attendance", "leave", "tasks", "dsr", "inbox", "organization"]
            });
        }

        const company = result.rows[0];

        return res.status(200).json({
            success: true,
            companyName: company.company_name,
            companyCode: company.company_code,
            status: company.status,
            admin_modules: company.admin_modules || [],
            employee_modules: company.employee_modules || []
        });
    } catch (error) {
        console.error("[SuperAdmin] getCompanyModulesForTenant error:", error);
        return res.status(500).json({ success: false, message: "Failed to fetch company modules." });
    }
}

/**
 * Permanently delete a company and drop its isolated PostgreSQL database
 */
export async function deleteCompany(req, res) {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ success: false, message: "Company ID is required." });
        }

        const result = await deleteCompanyAndDatabase(id);

        return res.status(200).json({
            success: true,
            message: `Organization '${result.companyName}' and its database '${result.dbName}' have been permanently deleted.`,
            deleted: result
        });
    } catch (error) {
        console.error("[SuperAdmin] deleteCompany error:", error);
        return res.status(400).json({
            success: false,
            message: error.message || "Failed to delete organization."
        });
    }
}

/**
 * 1. Fetch all company admin credentials from Vault
 */
export async function getAdminCredentials(req, res) {
    try {
        await masterPool.query(`
            CREATE TABLE IF NOT EXISTS company_admin_credentials (
                id SERIAL PRIMARY KEY,
                company_id INTEGER,
                company_name VARCHAR(255) NOT NULL,
                company_code VARCHAR(100) NOT NULL,
                subdomain VARCHAR(100),
                db_name VARCHAR(100) NOT NULL,
                admin_name VARCHAR(255) NOT NULL,
                admin_email VARCHAR(255) NOT NULL,
                plain_password VARCHAR(255) NOT NULL,
                password_hash VARCHAR(255),
                role VARCHAR(50) DEFAULT 'Admin',
                status VARCHAR(50) DEFAULT 'ACTIVE',
                login_url VARCHAR(500),
                last_login_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                CONSTRAINT uq_comp_admin_email UNIQUE (company_code, admin_email)
            );
        `);

        // Check if root PCS admins are in table, if not add them
        await masterPool.query(`
            INSERT INTO company_admin_credentials (
                company_id, company_name, company_code, subdomain, db_name,
                admin_name, admin_email, plain_password, password_hash, role, status, login_url
            ) VALUES 
            (1, 'PCS Enterprise', 'pcs', 'pcs', 'ems', 'Master Admin', 'admin@ems.com', 'Admin@123', '$2a$10$w86H0x853g1Wffk/lR1eX.9v78iZ/sZ1R5xXm3K8P8ZzZzZzZzZzZ', 'Admin', 'ACTIVE', 'http://173.249.59.181:8080/login.html?org=pcs&switch=1'),
            (1, 'PCS Enterprise', 'pcs', 'pcs', 'ems', 'Nitin Rajguru', 'nitin.rajguru@ems.com', 'Admin@123', '$2a$10$w86H0x853g1Wffk/lR1eX.9v78iZ/sZ1R5xXm3K8P8ZzZzZzZzZzZ', 'Admin', 'ACTIVE', 'http://173.249.59.181:8080/login.html?org=pcs&switch=1')
            ON CONFLICT (company_code, admin_email) DO NOTHING;
        `);

        // Sync any companies in companies table that aren't yet in company_admin_credentials
        const comps = await masterPool.query('SELECT * FROM companies WHERE LOWER(company_code) != \'pcs\'');
        for (const c of comps.rows) {
            if (c.admin_email && c.admin_temp_password) {
                await masterPool.query(`
                    INSERT INTO company_admin_credentials (
                        company_id, company_name, company_code, subdomain, db_name,
                        admin_name, admin_email, plain_password, password_hash, role, status, login_url
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '', 'Admin', $9, $10)
                    ON CONFLICT (company_code, admin_email) DO UPDATE SET
                        plain_password = EXCLUDED.plain_password,
                        status = EXCLUDED.status,
                        updated_at = NOW();
                `, [
                    c.id,
                    c.company_name,
                    c.company_code,
                    c.subdomain || c.company_code,
                    c.db_name,
                    c.admin_name || 'Master Admin',
                    c.admin_email.toLowerCase().trim(),
                    c.admin_temp_password,
                    c.status || 'ACTIVE',
                    `http://173.249.59.181:8080/login.html?org=${c.company_code}&switch=1`
                ]);
            }
        }

        const result = await masterPool.query(`
            SELECT 
                c.id,
                c.company_id,
                c.company_name,
                c.company_code,
                c.subdomain,
                c.db_name,
                c.admin_name,
                c.admin_email,
                c.plain_password,
                c.role,
                c.status,
                c.login_url,
                c.last_login_at,
                c.created_at,
                c.updated_at
            FROM company_admin_credentials c
            ORDER BY c.id ASC;
        `);

        return res.status(200).json({
            success: true,
            credentials: result.rows
        });
    } catch (error) {
        console.error("[SuperAdmin] getAdminCredentials error:", error);
        return res.status(500).json({ success: false, message: "Failed to fetch admin credentials vault." });
    }
}

/**
 * 2. Reset / Update Admin Password from Super Admin Vault
 */
export async function resetAdminPassword(req, res) {
    try {
        const { id } = req.params;
        let { new_password } = req.body;

        if (!id) {
            return res.status(400).json({ success: false, message: "Admin credential ID is required." });
        }

        const credRes = await masterPool.query('SELECT * FROM company_admin_credentials WHERE id = $1', [id]);
        if (credRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Admin credential record not found." });
        }

        const cred = credRes.rows[0];

        if (!new_password || !new_password.trim()) {
            const randomPart = Math.random().toString(36).substring(2, 7);
            new_password = `Penta@${randomPart}`;
        } else {
            new_password = new_password.trim();
        }

        const salt = await bcryptjs.genSalt(10);
        const hashedPassword = await bcryptjs.hash(new_password, salt);

        // 1. Update Vault
        await masterPool.query(`
            UPDATE company_admin_credentials
            SET plain_password = $1, password_hash = $2, updated_at = NOW()
            WHERE id = $3;
        `, [new_password, hashedPassword, id]);

        // 2. Update companies table if company_id exists
        if (cred.company_id) {
            await masterPool.query(`
                UPDATE companies
                SET admin_temp_password = $1, updated_at = NOW()
                WHERE id = $2 OR LOWER(company_code) = LOWER($3);
            `, [new_password, cred.company_id, cred.company_code]);
        }

        // 3. Connect to tenant DB and update users table
        try {
            const tenantPool = getTenantPool(cred.db_name);
            await tenantPool.query(`
                UPDATE users
                SET password = $1, plain_password = $2, updated_at = NOW()
                WHERE LOWER(email) = LOWER($3);
            `, [hashedPassword, new_password, cred.admin_email]);
            console.log(`[SuperAdmin] Updated password for admin ${cred.admin_email} in database ${cred.db_name}`);
        } catch (dbErr) {
            console.warn(`[SuperAdmin] Warning updating user password in tenant db ${cred.db_name}:`, dbErr.message);
        }

        return res.status(200).json({
            success: true,
            message: `Password updated successfully for ${cred.admin_email}`,
            plain_password: new_password
        });
    } catch (error) {
        console.error("[SuperAdmin] resetAdminPassword error:", error);
        return res.status(500).json({ success: false, message: "Failed to reset admin password." });
    }
}

/**
 * 3. Force Sync Admin Credentials across all tenant databases
 */
export async function syncAdminCredentials(req, res) {
    try {
        const comps = await masterPool.query('SELECT * FROM companies');
        let syncedCount = 0;

        for (const c of comps.rows) {
            try {
                const tenantPool = getTenantPool(c.db_name);
                const adminsRes = await tenantPool.query(`
                    SELECT id, username, email, plain_password, password, role, is_active
                    FROM users
                    WHERE role = 'Admin' OR LOWER(email) = LOWER($1);
                `, [c.admin_email || '']);

                for (const u of adminsRes.rows) {
                    const plainPass = u.plain_password || c.admin_temp_password || 'Admin@123';
                    const loginUrl = `http://173.249.59.181:8080/login.html?org=${c.company_code}&switch=1`;

                    await masterPool.query(`
                        INSERT INTO company_admin_credentials (
                            company_id, company_name, company_code, subdomain, db_name,
                            admin_name, admin_email, plain_password, password_hash, role, status, login_url, updated_at
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Admin', $10, $11, NOW())
                        ON CONFLICT (company_code, admin_email) DO UPDATE SET
                            plain_password = EXCLUDED.plain_password,
                            admin_name = EXCLUDED.admin_name,
                            status = EXCLUDED.status,
                            login_url = EXCLUDED.login_url,
                            updated_at = NOW();
                    `, [
                        c.id,
                        c.company_name,
                        c.company_code,
                        c.subdomain || c.company_code,
                        c.db_name,
                        u.username || c.admin_name || 'Admin',
                        u.email.toLowerCase().trim(),
                        plainPass,
                        u.password,
                        c.status || 'ACTIVE',
                        loginUrl
                    ]);
                    syncedCount++;
                }
            } catch (tErr) {
                console.warn(`[Sync] Skipped ${c.db_name}:`, tErr.message);
            }
        }

        return res.status(200).json({
            success: true,
            message: `Synchronized ${syncedCount} admin credentials.`,
            syncedCount
        });
    } catch (error) {
        console.error("[SuperAdmin] syncAdminCredentials error:", error);
        return res.status(500).json({ success: false, message: "Failed to sync admin credentials." });
    }
}

