import { masterPool, provisionNewCompanyDatabase } from "../config/tenantManager.js";

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

        return res.status(200).json({
            success: true,
            companies: result.rows
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
            WHERE LOWER(company_code) = LOWER($1) OR LOWER(subdomain) = LOWER($1)
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
