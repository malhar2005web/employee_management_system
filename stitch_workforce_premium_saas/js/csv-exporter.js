/**
 * 📊 UNIVERSAL CSV EXPORTER UTILITY FOR ENTERPRISE EMS MODULES
 * Enables instant one-click CSV Data Export across all admin sidebar pages.
 */

window.exportTableToCSV = function(tableId, filename = 'EMS_Export.csv') {
    const table = document.getElementById(tableId);
    if (!table) {
        console.warn(`Table #${tableId} not found for CSV export.`);
        // Try falling back to any visible table on page
        const altTable = document.querySelector('table');
        if (altTable) {
            if (!altTable.id) altTable.id = 'temp-export-table';
            return exportTableToCSV(altTable.id, filename);
        }
        alert(`No data table found to export for ${filename}`);
        return;
    }

    const rows = Array.from(table.querySelectorAll('tr'));
    if (rows.length === 0) {
        alert("Table is empty.");
        return;
    }

    const csvData = [];

    rows.forEach(row => {
        if (row.style.display === 'none') return; // Skip hidden search rows

        const cells = Array.from(row.querySelectorAll('th, td'));
        if (cells.length === 0) return;

        const rowData = [];
        cells.forEach((cell, idx) => {
            // Strip HTML tags and normalize text
            let text = cell.innerText.replace(/\n/g, ' ').replace(/"/g, '""').trim();

            // Ignore action column buttons if last cell
            if (idx === cells.length - 1 && (text.includes('Action') || text.includes('Edit') || text.includes('View Logs') || text.includes('Delete'))) {
                return;
            }
            rowData.push(`"${text}"`);
        });

        if (rowData.length > 0) {
            csvData.push(rowData.join(','));
        }
    });

    if (csvData.length === 0) {
        alert("No data rows found to export.");
        return;
    }

    const csvContent = csvData.join('\n');
    downloadCSVFile(csvContent, filename);
};

window.exportDataToCSV = function(headers, rowsData, filename = 'EMS_Data_Export.csv') {
    const csvLines = [];
    csvLines.push(headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(','));

    rowsData.forEach(row => {
        const line = row.map(val => `"${String(val !== null && val !== undefined ? val : '').replace(/"/g, '""')}"`).join(',');
        csvLines.push(line);
    });

    const csvContent = csvLines.join('\n');
    downloadCSVFile(csvContent, filename);
};

function downloadCSVFile(csvContent, filename) {
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

window.exportModuleCSV = async function(moduleName) {
    const todayStr = new Date().toISOString().split('T')[0];

    switch (moduleName) {
        case 'monitoring':
        case 'workstations': {
            const rangeSelect = document.getElementById('date-range-select');
            const selectedRange = rangeSelect ? rangeSelect.value : 'Today';
            await downloadTelemetryCSV(selectedRange);
            break;
        }

        case 'organization':
        case 'employees':
            if (document.getElementById('table-employees')) {
                exportTableToCSV('table-employees', `Employee_Directory_${todayStr}.csv`);
            } else {
                exportAPIModuleCSV('/api/v1/admin/employees', `Employee_Directory_${todayStr}.csv`);
            }
            break;

        case 'customers':
            if (document.getElementById('table-customers')) {
                exportTableToCSV('table-customers', `Customer_Directory_${todayStr}.csv`);
            } else {
                exportAPIModuleCSV('/api/v1/admin/customers', `Customer_Directory_${todayStr}.csv`);
            }
            break;

        case 'tasks':
        case 'audit_logs':
            if (document.getElementById('table-tasks')) {
                exportTableToCSV('table-tasks', `Tasks_and_Audit_Logs_${todayStr}.csv`);
            } else if (document.getElementById('table-audit-logs')) {
                exportTableToCSV('table-audit-logs', `Audit_Logs_${todayStr}.csv`);
            } else {
                exportAPIModuleCSV('/api/v1/admin/tasks', `Tasks_and_Audit_Logs_${todayStr}.csv`);
            }
            break;

        case 'attendance':
        case 'leaves':
            if (document.getElementById('table-attendance')) {
                exportTableToCSV('table-attendance', `Attendance_Leave_Report_${todayStr}.csv`);
            } else {
                exportAPIModuleCSV('/api/v1/admin/attendance', `Attendance_Leave_Report_${todayStr}.csv`);
            }
            break;

        case 'communication':
        case 'inbox':
            if (document.getElementById('table-communication')) {
                exportTableToCSV('table-communication', `Communication_Logs_${todayStr}.csv`);
            } else {
                exportAPIModuleCSV('/api/v1/admin/communication', `Communication_Logs_${todayStr}.csv`);
            }
            break;

        case 'workload':
            if (document.getElementById('table-workload')) {
                exportTableToCSV('table-workload', `Workload_Analytics_${todayStr}.csv`);
            } else {
                exportAPIModuleCSV('/api/v1/admin/workload', `Workload_Analytics_${todayStr}.csv`);
            }
            break;

        case 'reports':
            if (document.getElementById('table-reports')) {
                exportTableToCSV('table-reports', `Executive_Reports_${todayStr}.csv`);
            } else {
                exportAPIModuleCSV('/api/v1/admin/reports/summary', `Executive_Reports_${todayStr}.csv`);
            }
            break;

        case 'dashboard':
            exportDashboardCSV();
            break;

        default:
            const firstTable = document.querySelector('table');
            if (firstTable) {
                if (!firstTable.id) firstTable.id = 'export-target-table';
                exportTableToCSV(firstTable.id, `${moduleName}_Export_${todayStr}.csv`);
            } else {
                alert(`Exporting CSV for ${moduleName}...`);
            }
            break;
    }
};

async function exportAPIModuleCSV(endpoint, filename) {
    try {
        const res = await fetch(endpoint);
        const json = await res.json();

        let data = [];
        if (json.success && Array.isArray(json.data)) {
            data = json.data;
        } else if (json.data && Array.isArray(json.data.employees)) {
            data = json.data.employees;
        } else if (json.data && Array.isArray(json.data.customers)) {
            data = json.data.customers;
        } else if (json.data && Array.isArray(json.data.tasks)) {
            data = json.data.tasks;
        }

        if (!data || data.length === 0) {
            // Fallback to table scraping
            const table = document.querySelector('table');
            if (table) {
                if (!table.id) table.id = 'export-fallback-table';
                exportTableToCSV(table.id, filename);
                return;
            }
            alert("No records available to export.");
            return;
        }

        const headers = Object.keys(data[0]);
        const rows = data.map(item => headers.map(h => (item[h] !== null && item[h] !== undefined ? item[h] : '')));

        exportDataToCSV(headers, rows, filename);
    } catch (e) {
        console.error("API CSV Export Error:", e);
        const table = document.querySelector('table');
        if (table) {
            if (!table.id) table.id = 'export-fallback-table';
            exportTableToCSV(table.id, filename);
        } else {
            alert("Error exporting CSV: " + e.message);
        }
    }
}

function exportDashboardCSV() {
    const headers = ["Metric Name", "Value", "Status / Trend"];
    const rows = [];

    document.querySelectorAll('.kpi-card, .stat-card, .metric-card, .data-card').forEach(card => {
        const title = card.querySelector('.kpi-title, .stat-title, h3, h4, span')?.innerText || 'Metric';
        const value = card.querySelector('.kpi-value, .stat-value, h2, strong')?.innerText || '0';
        const trend = card.querySelector('.kpi-trend, .stat-change, .badge-status')?.innerText || 'Normal';
        if (title && value && title !== 'Metric') {
            rows.push([title.trim(), value.trim(), trend.trim()]);
        }
    });

    const todayStr = new Date().toISOString().split('T')[0];
    if (rows.length > 0) {
        exportDataToCSV(headers, rows, `Dashboard_KPI_Summary_${todayStr}.csv`);
    } else {
        exportModuleCSV('monitoring');
    }
}

async function downloadTelemetryCSV(selectedRange) {
    const todayStr = new Date().toISOString().split('T')[0];
    const token = localStorage.getItem('token') || '';

    try {
        const res = await fetch(`/api/v1/admin/monitoring/export-telemetry?range=${encodeURIComponent(selectedRange)}&format=csv`, {
            credentials: 'include',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (res.ok) {
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Telemetry_Activity_Logs_${selectedRange}_${todayStr}.csv`;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 500);
            return;
        }
    } catch (e) {
        console.warn("API direct telemetry export failed, falling back to table:", e);
    }

    // Fallback if API fails
    if (document.getElementById('table-workstations')) {
        exportTableToCSV('table-workstations', `Workstation_Monitoring_${todayStr}.csv`);
    } else {
        exportAPIModuleCSV('/api/v1/admin/monitoring/dashboard', `Workstation_Monitoring_${todayStr}.csv`);
    }
}
