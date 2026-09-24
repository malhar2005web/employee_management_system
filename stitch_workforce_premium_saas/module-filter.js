/**
 * PentaTEAMBRIDGE - Dynamic Tenant Module Filter
 * Automatically hides sidebar links for modules that are not permitted for this company
 */
(async function enforceTenantModules() {
    try {
        const companyCode = localStorage.getItem('company_code') || 'pcs';
        const res = await fetch(`/api/v1/super-admin/tenant-modules?code=${encodeURIComponent(companyCode)}`);
        const data = await res.json();
        if (!data.success) return;

        let role = 'Admin';
        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            if (user && user.role) role = user.role;
        } catch (err) {}

        if (role === 'Admin') {
            const adminMods = data.admin_modules || [];
            const moduleMap = [
                { key: 'monitoring', selector: 'li[onclick*="admin-monitoring"]' },
                { key: 'organization', selector: 'li[onclick*="admin-organization"]' },
                { key: 'customers', selector: 'li[onclick*="admin-customers"]' },
                { key: 'tasks', selector: 'li[onclick*="admin-tasks"]' },
                { key: 'support', selector: 'li[onclick*="admin-support"]' },
                { key: 'attendance', selector: 'li[onclick*="admin-attendance"]' },
                { key: 'communication', selector: 'li[onclick*="admin-communication"]' },
                { key: 'settings', selector: 'li[onclick*="admin-settings"]' }
            ];

            moduleMap.forEach(m => {
                if (!adminMods.includes(m.key)) {
                    document.querySelectorAll(m.selector).forEach(el => {
                        el.style.display = 'none';
                    });
                }
            });
        } else if (role === 'Employee') {
            const empMods = data.employee_modules || [];
            const empMap = [
                { key: 'attendance', selector: 'li[onclick*="employee-attendance"]' },
                { key: 'leave', selector: 'li[onclick*="employee-leave"]' },
                { key: 'tasks', selector: 'li[onclick*="employee-tasks"]' },
                { key: 'dsr', selector: 'li[onclick*="employee-dsr"]' },
                { key: 'inbox', selector: 'li[onclick*="employee-inbox"]' },
                { key: 'organization', selector: 'li[onclick*="employee-organization"]' }
            ];

            empMap.forEach(m => {
                if (!empMods.includes(m.key)) {
                    document.querySelectorAll(m.selector).forEach(el => {
                        el.style.display = 'none';
                    });
                }
            });
        }
    } catch (e) {
        console.warn('[ModuleFilter] Could not load tenant modules:', e);
    }
})();
