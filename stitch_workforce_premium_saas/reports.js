document.addEventListener('DOMContentLoaded', () => {
    // Tabs switcher
    const tabItems = document.querySelectorAll('.tab-item');
    const tabPanels = document.querySelectorAll('.tab-panel');

    // Select lists
    const repEmployee = document.getElementById('rep-employee');
    const selfReportsList = document.getElementById('self-reports-list');
    const dsrVisitsList = document.getElementById('dsr-visits-list');

    // Custom Builder
    const customBuilderForm = document.getElementById('custom-builder-form');
    const customTableHead = document.getElementById('custom-table-head');
    const customTableBody = document.getElementById('custom-table-body');
    const reportTitlePreview = document.getElementById('report-title-preview');
    const btnPrint = document.getElementById('btn-print');
    const logoutBtn = document.getElementById('logout-btn');

    let employeesCache = [];

    // Switch Tab Panels
    tabItems.forEach(tab => {
        tab.addEventListener('click', () => {
            tabItems.forEach(t => t.classList.remove('active'));
            tabPanels.forEach(p => p.classList.remove('active'));

            tab.classList.add('active');
            const targetId = tab.getAttribute('data-tab');
            document.getElementById(targetId).classList.add('active');
        });
    });

    // Load initial listings
    const loadReportTabInfo = async () => {
        try {
            // Self-Reports listing
            const selfRes = await fetch('/api/v1/admin/reports/self-reports');
            const selfData = await selfRes.json();
            if (selfRes.ok && selfData.success) {
                renderSelfReports(selfData.data);
            }

            // DSR Field visits listing
            const dsrRes = await fetch('/api/v1/admin/reports/dsr');
            const dsrData = await dsrRes.json();
            if (dsrRes.ok && dsrData.success) {
                renderFieldVisits(dsrData.data);
            }

            // Fetch Employees list for filters
            const empRes = await fetch('/api/v1/admin/employees');
            const empData = await empRes.json();
            if (empRes.ok && empData.success) {
                employeesCache = empData.data.employees;
                populateEmployeesFilter();
            }
        } catch (error) {
            console.error("Error loading reports logs:", error);
        }
    };

    const renderSelfReports = (list) => {
        if (!selfReportsList) return;
        selfReportsList.innerHTML = '';

        if (list.length === 0) {
            selfReportsList.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted);">No daily self-reports found</td></tr>`;
            return;
        }

        list.forEach(sr => {
            const dateStr = new Date(sr.date).toLocaleDateString();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight:700;">${dateStr}</td>
                <td class="task-name">${sr.full_name} <span style="font-size:12px;color:var(--text-muted);">(${sr.employee_code})</span></td>
                <td>${sr.todays_work || '-'}</td>
                <td>${sr.tomorrows_plan || '-'}</td>
                <td style="color:var(--red);font-weight:600;">${sr.current_issues || '-'}</td>
                <td><span class="status-pill progress">${sr.percentage_complete}%</span></td>
            `;
            selfReportsList.appendChild(tr);
        });
    };

    const renderFieldVisits = (list) => {
        if (!dsrVisitsList) return;
        dsrVisitsList.innerHTML = '';

        if (list.length === 0) {
            dsrVisitsList.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted);">No field visits logs found</td></tr>`;
            return;
        }

        list.forEach(dr => {
            const dateStr = new Date(dr.created_at).toLocaleDateString();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight:700;">${dateStr}</td>
                <td class="task-name">${dr.full_name} <span style="font-size:12px;color:var(--text-muted);">(${dr.employee_code})</span></td>
                <td style="font-weight:600;color:var(--teal-900);">${dr.customer_name || dr.client_name || '-'}</td>
                <td>${dr.visited_for || '-'}</td>
                <td>${dr.site_name || '-'} <br><span style="font-size:11px;color:var(--text-muted);">${dr.office_address || ''}</span></td>
                <td>${dr.contact_person || '-'} <br><span style="font-size:11px;color:var(--text-muted);">${dr.contact_no || ''}</span></td>
                <td>${dr.last_remark || dr.followup || '-'}</td>
            `;
            dsrVisitsList.appendChild(tr);
        });
    };

    const populateEmployeesFilter = () => {
        if (!repEmployee) return;
        repEmployee.innerHTML = '<option value="">All Employees</option>';
        employeesCache.forEach(emp => {
            const opt = document.createElement('option');
            opt.value = emp.id;
            opt.textContent = emp.full_name;
            repEmployee.appendChild(opt);
        });
    };

    // Custom report compiler
    if (customBuilderForm) {
        customBuilderForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const employeeId = repEmployee.value;
            const type = document.getElementById('rep-type').value;
            const startDate = document.getElementById('rep-start').value;
            const endDate = document.getElementById('rep-end').value;

            let queryUrl = `/api/v1/admin/reports/custom?type=${type}`;
            if (employeeId) queryUrl += `&employeeId=${employeeId}`;
            if (startDate) queryUrl += `&startDate=${startDate}`;
            if (endDate) queryUrl += `&endDate=${endDate}`;

            try {
                const response = await fetch(queryUrl);
                const data = await response.json();
                if (response.ok && data.success) {
                    renderCustomReportTable(type, data.data);
                } else {
                    alert(data.message || "Failed to generate report");
                }
            } catch (error) {
                console.error("Error generating custom report:", error);
            }
        });
    }

    const renderCustomReportTable = (type, list) => {
        customTableHead.innerHTML = '';
        customTableBody.innerHTML = '';

        reportTitlePreview.style.display = 'block';
        reportTitlePreview.textContent = `Custom Generated Audit Log — ${type.toUpperCase()} REPORTS`;

        if (list.length === 0) {
            customTableBody.innerHTML = `<tr><td colspan="100" style="text-align:center;padding:24px;color:var(--text-muted);">No records matched query criteria.</td></tr>`;
            return;
        }

        if (type === 'attendance') {
            customTableHead.innerHTML = `
                <tr>
                  <th>Date</th>
                  <th>Employee</th>
                  <th>Clock In</th>
                  <th>Clock Out</th>
                  <th>Status</th>
                  <th>Overtime (Mins)</th>
                </tr>
            `;
            list.forEach(item => {
                const tr = document.createElement('tr');
                const dateStr = new Date(item.date).toLocaleDateString();
                tr.innerHTML = `
                    <td style="font-weight:700;">${dateStr}</td>
                    <td class="task-name">${item.full_name} <span style="font-size:12px;color:var(--text-muted);">(${item.employee_code})</span></td>
                    <td>${item.clock_in || '-'}</td>
                    <td>${item.clock_out || '-'}</td>
                    <td><span class="status-pill ${item.status === 'Present' ? 'progress' : 'todo'}">${item.status}</span></td>
                    <td>${item.overtime_minutes || 0} mins</td>
                `;
                customTableBody.appendChild(tr);
            });
        } else if (type === 'leave') {
            customTableHead.innerHTML = `
                <tr>
                  <th>Employee</th>
                  <th>Leave Type</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Reason</th>
                  <th>Status</th>
                </tr>
            `;
            list.forEach(item => {
                const tr = document.createElement('tr');
                const startStr = new Date(item.start_date).toLocaleDateString();
                const endStr = new Date(item.end_date).toLocaleDateString();
                tr.innerHTML = `
                    <td class="task-name">${item.full_name} <span style="font-size:12px;color:var(--text-muted);">(${item.employee_code})</span></td>
                    <td style="font-weight:700;color:var(--teal-900);">${item.leave_type || 'Annual'}</td>
                    <td>${startStr}</td>
                    <td>${endStr}</td>
                    <td>${item.reason || '-'}</td>
                    <td><span class="status-pill ${item.status === 'Approved' ? 'progress' : 'pending'}">${item.status}</span></td>
                `;
                customTableBody.appendChild(tr);
            });
        } else if (type === 'timesheet') {
            customTableHead.innerHTML = `
                <tr>
                  <th>Date</th>
                  <th>Employee</th>
                  <th>Hours Logged</th>
                  <th>Billable</th>
                  <th>Non-Billable</th>
                  <th>Remarks</th>
                </tr>
            `;
            list.forEach(item => {
                const tr = document.createElement('tr');
                const dateStr = new Date(item.date).toLocaleDateString();
                tr.innerHTML = `
                    <td style="font-weight:700;">${dateStr}</td>
                    <td class="task-name">${item.full_name} <span style="font-size:12px;color:var(--text-muted);">(${item.employee_code})</span></td>
                    <td style="font-weight:600;color:var(--teal-900);">${item.total_hours} hrs</td>
                    <td>${item.billable_hours} hrs</td>
                    <td>${item.non_billable_hours} hrs</td>
                    <td>${item.remarks || '-'}</td>
                `;
                customTableBody.appendChild(tr);
            });
        } else if (type === 'self-report') {
            customTableHead.innerHTML = `
                <tr>
                  <th>Date</th>
                  <th>Employee</th>
                  <th>Today's Work</th>
                  <th>Tomorrow's Plan</th>
                  <th>Completion Rate</th>
                </tr>
            `;
            list.forEach(item => {
                const tr = document.createElement('tr');
                const dateStr = new Date(item.date).toLocaleDateString();
                tr.innerHTML = `
                    <td style="font-weight:700;">${dateStr}</td>
                    <td class="task-name">${item.full_name} <span style="font-size:12px;color:var(--text-muted);">(${item.employee_code})</span></td>
                    <td>${item.todays_work || '-'}</td>
                    <td>${item.tomorrows_plan || '-'}</td>
                    <td><span class="status-pill progress">${item.percentage_complete}%</span></td>
                `;
                customTableBody.appendChild(tr);
            });
        }
    };

    // Print functionality
    if (btnPrint) {
        btnPrint.addEventListener('click', () => {
            window.print();
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                const response = await fetch('/api/v1/auth/logout', { method: 'POST' });
                if (response.ok) {
                    window.location.href = '/login.html';
                }
            } catch (error) {
                console.error("Logout failed:", error);
            }
        });
    }

    // Initial load
    loadReportTabInfo();
});
