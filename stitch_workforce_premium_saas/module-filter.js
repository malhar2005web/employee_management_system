/**
 * PentaTEAMBRIDGE - Dynamic Tenant Module Filter & Route Guard
 * Automatically hides sidebar links and redirects away from disabled modules
 */
window.enforceTenantModules = async function() {
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

        const currentPath = window.location.pathname;

        if (role === 'Admin') {
            const adminMods = data.admin_modules || [];
            const moduleMap = [
                { key: 'monitoring', selector: 'li[onclick*="admin-monitoring"]', path: 'admin-monitoring.html' },
                { key: 'organization', selector: 'li[onclick*="admin-organization"]', path: 'admin-organization.html' },
                { key: 'customers', selector: 'li[onclick*="admin-customers"]', path: 'admin-customers.html' },
                { key: 'tasks', selector: 'li[onclick*="admin-tasks"]', path: 'admin-tasks.html' },
                { key: 'support', selector: 'li[onclick*="admin-support"]', path: 'admin-support.html' },
                { key: 'attendance', selector: 'li[onclick*="admin-attendance"]', path: 'admin-attendance.html' },
                { key: 'communication', selector: 'li[onclick*="admin-communication"]', path: 'admin-communication.html' },
                { key: 'settings', selector: 'li[onclick*="admin-settings"]', path: 'admin-settings.html' }
            ];

            // 1. Hide disabled sidebar links
            moduleMap.forEach(m => {
                if (!adminMods.includes(m.key)) {
                    document.querySelectorAll(m.selector).forEach(el => {
                        el.style.display = 'none';
                    });
                }
            });

            // 2. Route Guard: If user directly navigates to a disabled module page, redirect to dashboard
            const disabledMatch = moduleMap.find(m => currentPath.includes(m.path) && !adminMods.includes(m.key));
            if (disabledMatch) {
                console.warn(`[ModuleGuard] Module '${disabledMatch.key}' is disabled for tenant '${companyCode}'. Redirecting to dashboard.`);
                window.location.replace('/admin-dashboard.html');
                return;
            }

        } else if (role === 'Employee') {
            const empMods = data.employee_modules || [];
            const empMap = [
                { key: 'attendance', selector: 'li[onclick*="employee-attendance"]', path: 'employee-attendance.html' },
                { key: 'leave', selector: 'li[onclick*="employee-leave"]', path: 'employee-leave.html' },
                { key: 'tasks', selector: 'li[onclick*="employee-tasks"]', path: 'employee-tasks.html' },
                { key: 'dsr', selector: 'li[onclick*="employee-dsr"]', path: 'employee-dsr.html' },
                { key: 'inbox', selector: 'li[onclick*="employee-inbox"]', path: 'employee-inbox.html' },
                { key: 'organization', selector: 'li[onclick*="employee-organization"]', path: 'employee-organization.html' }
            ];

            empMap.forEach(m => {
                if (!empMods.includes(m.key)) {
                    document.querySelectorAll(m.selector).forEach(el => {
                        el.style.display = 'none';
                    });
                }
            });

            const disabledMatch = empMap.find(m => currentPath.includes(m.path) && !empMods.includes(m.key));
            if (disabledMatch) {
                console.warn(`[ModuleGuard] Employee module '${disabledMatch.key}' disabled for tenant. Redirecting.`);
                window.location.replace('/employee-dashboard.html');
                return;
            }
        }
    } catch (e) {
        console.warn('[ModuleFilter] Could not load tenant modules:', e);
    }
};

(function() {
    window.enforceTenantModules();
})();
