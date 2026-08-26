document.addEventListener('DOMContentLoaded', () => {
    // Main Tabs (Attendance vs Leaves)
    const tabBtnAttendance = document.getElementById('tab-btn-attendance');
    const tabBtnLeave = document.getElementById('tab-btn-leave');
    const tabContentAttendance = document.getElementById('tab-content-attendance');
    const tabContentLeave = document.getElementById('tab-content-leave');
    
    // Page Header Action Buttons
    const btnAddCorrection = document.getElementById('btn-add-correction');
    const btnAddLeave = document.getElementById('btn-add-leave');

    // Inner Attendance Tabs
    const tabLogs = document.getElementById('tab-logs');
    const tabPcsSummary = document.getElementById('tab-pcs-summary');
    const tabPending = document.getElementById('tab-pending');
    const viewLogs = document.getElementById('view-logs');
    const viewPcsSummary = document.getElementById('view-pcs-summary');
    const viewPending = document.getElementById('view-pending');
    const viewTitle = document.getElementById('table-title') || document.getElementById('view-title');
    const btnRunCalc = document.getElementById('btn-run-calc');
    const filterPcsMonth = document.getElementById('filter-pcs-month');
    const btnRefreshPcs = document.getElementById('btn-refresh-pcs');
    const pcsSummaryList = document.getElementById('pcs-summary-list');

    // Switch Inner Attendance Tabs (Logs vs Monthly Summary vs Corrections)
    const switchAttendanceTab = (tabName) => {
        if (tabLogs) tabLogs.classList.remove('active');
        if (tabPcsSummary) tabPcsSummary.classList.remove('active');
        if (tabPending) tabPending.classList.remove('active');

        if (viewLogs) viewLogs.style.display = 'none';
        if (viewPcsSummary) viewPcsSummary.style.display = 'none';
        if (viewPending) viewPending.style.display = 'none';
        if (btnRunCalc) btnRunCalc.style.display = 'none';

        if (tabName === 'logs') {
            if (tabLogs) tabLogs.classList.add('active');
            if (viewLogs) viewLogs.style.display = 'block';
            if (viewTitle) viewTitle.textContent = 'Daily Check-Ins';
            loadLogs();
        } else if (tabName === 'pcs-summary') {
            if (tabPcsSummary) tabPcsSummary.classList.add('active');
            if (viewPcsSummary) viewPcsSummary.style.display = 'block';
            if (btnRunCalc) btnRunCalc.style.display = 'inline-flex';
            if (viewTitle) viewTitle.textContent = 'Monthly Attendance Summary';
            loadPcsMonthlySummary();
        } else {
            if (tabPending) tabPending.classList.add('active');
            if (viewPending) viewPending.style.display = 'block';
            if (viewTitle) viewTitle.textContent = 'Correction Requests';
            loadPendingCorrections();
        }
    };

    if (tabLogs) tabLogs.addEventListener('click', () => switchAttendanceTab('logs'));
    if (tabPcsSummary) tabPcsSummary.addEventListener('click', () => switchAttendanceTab('pcs-summary'));
    if (tabPending) tabPending.addEventListener('click', () => switchAttendanceTab('pending'));

    // Modal open (Correction)
    if (btnAddCorrection) {
        btnAddCorrection.addEventListener('click', () => {
            correctionForm.reset();
            corrDate.value = today;
            correctionModal.classList.add('active');
        });
    }

    const closeCorrectionModal = () => {
        correctionModal.classList.remove('active');
        correctionForm.reset();
    };

    if (correctionClose) correctionClose.addEventListener('click', closeCorrectionModal);
    if (correctionCancel) correctionCancel.addEventListener('click', closeCorrectionModal);

    // Modal open (Leave)
    if (btnAddLeave) {
        btnAddLeave.addEventListener('click', () => {
            leaveForm.reset();
            document.getElementById('leave-start').value = today;
            document.getElementById('leave-end').value = today;
            leaveModal.classList.add('active');
        });
    }

    const closeLeaveModal = () => {
        leaveModal.classList.remove('active');
        leaveForm.reset();
    };

    if (leaveClose) leaveClose.addEventListener('click', closeLeaveModal);
    if (leaveCancel) leaveCancel.addEventListener('click', closeLeaveModal);

    // Fetch and populate daily logs
    const loadLogs = async () => {
        const dateVal = filterDate ? filterDate.value : today;
        try {
            const response = await fetch(`/api/v1/admin/attendance?date=${dateVal}`);
            const data = await response.json();
            if (response.ok && data.success) {
                employeesCache = data.data.employees;
                populateEmployeesDropdowns();
                renderLogs(data.data.logs);
            }
        } catch (error) {
            console.error("Error loading daily attendance logs:", error);
        }
    };

    const populateEmployeesDropdowns = () => {
        // Populate correction dropdown
        if (corrEmployee) {
            corrEmployee.innerHTML = '<option value="">Select Employee</option>';
            employeesCache.forEach(emp => {
                const opt = document.createElement('option');
                opt.value = emp.id;
                opt.textContent = emp.full_name;
                corrEmployee.appendChild(opt);
            });
        }
        // Populate leave dropdown
        if (leaveEmployee) {
            leaveEmployee.innerHTML = '<option value="">Select Employee</option>';
            employeesCache.forEach(emp => {
                const opt = document.createElement('option');
                opt.value = emp.id;
                opt.textContent = emp.full_name;
                leaveEmployee.appendChild(opt);
            });
        }
    };

    const renderLogs = (logs) => {
        if (!logsList) return;
        logsList.innerHTML = '';

        // Update metrics counts
        let presentToday = 0;
        let lateToday = 0;
        let earlyToday = 0;

        if (logs.length === 0) {
            logsList.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text-muted);">No attendance records for selected date</td></tr>`;
        } else {
            logs.forEach(log => {
                const inTime = log.login_time ? new Date(log.login_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';
                const outTime = log.logout_time ? new Date(log.logout_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';
                
                const statusClass = log.status === 'Present' ? 'progress' : (log.status === 'Late' ? 'pending' : (log.status === 'Half Day' ? 'delayed' : 'todo'));
                
                // Counters
                if (log.status === 'Present' || log.status === 'Late' || log.status === 'Half Day') {
                    presentToday++;
                }
                if (log.is_late_login) {
                    lateToday++;
                }
                if (log.is_early_logout) {
                    earlyToday++;
                }

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="task-name">${log.full_name}</td>
                    <td>${new Date(log.date).toLocaleDateString()}</td>
                    <td>${inTime}</td>
                    <td>${outTime}</td>
                    <td style="font-weight:600;color:var(--teal-900);">${log.total_working_hours || '-'} hrs</td>
                    <td>${log.overtime || '0'} min</td>
                    <td><span class="status-pill ${statusClass}">${log.status || 'Absent'}</span></td>
                    <td>
                        <button class="action-pill edit" onclick="editCorrection(${JSON.stringify(log).replace(/"/g, '&quot;')})"><i class="fa-solid fa-clock"></i> Correct</button>
                    </td>
                `;
                logsList.appendChild(tr);
            });
        }

        if (countPresent) countPresent.textContent = presentToday;
        if (countLate) countLate.textContent = lateToday;
        if (countEarly) countEarly.textContent = earlyToday;
    };

    // Fetch and populate pending requests (Corrections)
    const loadPendingCorrections = async () => {
        try {
            const response = await fetch('/api/v1/admin/attendance/pending');
            const data = await response.json();
            if (response.ok && data.success) {
                renderPendingList(data.data);
            }
        } catch (error) {
            console.error("Error loading pending corrections:", error);
        }
    };

    const renderPendingList = (pending) => {
        if (!pendingList) return;
        pendingList.innerHTML = '';

        if (countPending) countPending.textContent = pending.length;

        if (pending.length === 0) {
            pendingList.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted);">No pending correction requests</td></tr>`;
            return;
        }

        pending.forEach(req => {
            const inTime = req.login_time ? new Date(req.login_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';
            const outTime = req.logout_time ? new Date(req.logout_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="task-name">${req.full_name}</td>
                <td>${new Date(req.date).toLocaleDateString()}</td>
                <td>${inTime}</td>
                <td>${outTime}</td>
                <td><span class="status-pill pending">${req.approval_status}</span></td>
                <td>
                    <div style="display:flex;gap:8px;">
                        <button class="action-pill approve" onclick="approveCorrectionClick(${req.id})"><i class="fa-solid fa-circle-check"></i> Approve</button>
                        <button class="action-pill reject" onclick="rejectCorrectionClick(${req.id})"><i class="fa-solid fa-circle-xmark"></i> Reject</button>
                    </div>
                </td>
            `;
            pendingList.appendChild(tr);
        });
    };

    // Correction Form Submit
    correctionForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const payload = {
            employeeId: corrEmployee.value,
            date: corrDate.value,
            clockIn: document.getElementById('corr-in').value || null,
            clockOut: document.getElementById('corr-out').value || null,
            status: document.getElementById('corr-status').value,
            overtime: document.getElementById('corr-overtime').value || null
        };

        try {
            const response = await fetch('/api/v1/admin/attendance/correction', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (response.ok && data.success) {
                closeCorrectionModal();
                loadLogs();
            } else {
                alert(data.message || 'Error saving correction');
            }
        } catch (error) {
            console.error("Error saving manual correction:", error);
        }
    });

    // Correction Actions
    window.editCorrection = (log) => {
        correctionForm.reset();
        corrEmployee.value = log.employee_id;
        corrDate.value = new Date(log.date).toISOString().split('T')[0];
        
        if (log.login_time) {
            const login = new Date(log.login_time);
            document.getElementById('corr-in').value = login.toTimeString().split(' ')[0].substring(0, 5);
        }
        if (log.logout_time) {
            const logout = new Date(log.logout_time);
            document.getElementById('corr-out').value = logout.toTimeString().split(' ')[0].substring(0, 5);
        }

        document.getElementById('corr-status').value = log.status || 'Present';
        document.getElementById('corr-overtime').value = log.overtime || '';

        correctionModal.classList.add('active');
    };

    window.approveCorrectionClick = async (id) => {
        if (!confirm("Are you sure you want to approve this correction?")) return;

        try {
            const response = await fetch(`/api/v1/admin/attendance/approve/${id}`, { method: 'POST' });
            const data = await response.json();
            if (response.ok && data.success) {
                loadPendingCorrections();
                loadLogs();
            } else {
                alert(data.message || 'Approval failed');
            }
        } catch (error) {
            console.error("Error approving correction:", error);
        }
    };

    window.rejectCorrectionClick = async (id) => {
        if (!confirm("Are you sure you want to reject this correction?")) return;

        try {
            const response = await fetch(`/api/v1/admin/attendance/reject/${id}`, { method: 'POST' });
            const data = await response.json();
            if (response.ok && data.success) {
                loadPendingCorrections();
                loadLogs();
            } else {
                alert(data.message || 'Rejection failed');
            }
        } catch (error) {
            console.error("Error rejecting correction:", error);
        }
    };

    // --- LEAVE MANAGEMENT LOGIC ---
    const loadLeaves = async () => {
        try {
            const response = await fetch('/api/v1/admin/leaves');
            const data = await response.json();
            if (response.ok && data.success) {
                employeesCache = data.data.employees;
                leavesCache = data.data.leaves;

                populateEmployeesDropdowns();
                renderLeaves();
            }
        } catch (error) {
            console.error("Error loading leave requests:", error);
        }
    };

    const renderLeaves = () => {
        if (!leavesList) return;
        leavesList.innerHTML = '';

        // Update metrics counts
        let total = leavesCache.length;
        let pending = 0;
        let annual = 0;
        let sick = 0;

        if (leavesCache.length === 0) {
            leavesList.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted);">No leave requests found</td></tr>`;
        } else {
            leavesCache.forEach(req => {
                const startDate = new Date(req.start_date).toLocaleDateString();
                const endDate = new Date(req.end_date).toLocaleDateString();
                
                const statusClass = req.status === 'Approved' ? 'progress' : (req.status === 'Rejected' ? 'todo' : 'pending');
                const statusLabel = req.status || 'Pending';

                // Counters
                if (statusLabel === 'Pending') pending++;
                if (statusLabel === 'Approved') {
                    if (req.leave_type === 'Annual Leave') annual++;
                    if (req.leave_type === 'Sick Leave') sick++;
                }

                // Actions: render Approve/Reject only if Pending
                let actionButtons = '';
                if (statusLabel === 'Pending') {
                    actionButtons = `
                        <button class="action-pill approve" onclick="approveLeaveClick(${req.id})"><i class="fa-solid fa-check"></i> Approve</button>
                        <button class="action-pill reject" onclick="rejectLeaveClick(${req.id})"><i class="fa-solid fa-xmark"></i> Reject</button>
                    `;
                } else {
                    actionButtons = `<button class="action-pill delete" onclick="deleteLeaveClick(${req.id})"><i class="fa-solid fa-trash-can"></i> Delete</button>`;
                }

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="task-name">${req.full_name}</td>
                    <td style="font-weight:600;color:var(--teal-900);">${req.leave_type}</td>
                    <td>${startDate} to ${endDate}</td>
                    <td style="font-size:13px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${req.reason || ''}">${req.reason || '-'}</td>
                    <td><span class="status-pill ${statusClass}">${statusLabel}</span></td>
                    <td>
                        <div style="display:flex;gap:8px;">
                            ${actionButtons}
                        </div>
                    </td>
                `;
                leavesList.appendChild(tr);
            });
        }

        if (countTotal) countTotal.textContent = total;
        if (countLeavePending) countLeavePending.textContent = pending;
        if (countAnnual) countAnnual.textContent = annual;
        if (countSick) countSick.textContent = sick;
    };

    // Leave Form Submit
    leaveForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const payload = {
            employeeId: leaveEmployee.value,
            leaveType: document.getElementById('leave-type').value,
            startDate: document.getElementById('leave-start').value,
            endDate: document.getElementById('leave-end').value,
            reason: document.getElementById('leave-reason').value.trim()
        };

        try {
            const response = await fetch('/api/v1/admin/leaves', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (response.ok && data.success) {
                closeLeaveModal();
                loadLeaves();
            } else {
                alert(data.message || 'Error saving leave request');
            }
        } catch (error) {
            console.error("Error creating manual leave entry:", error);
        }
    });

    // Leave Window Click Handlers
    window.approveLeaveClick = async (id) => {
        if (!confirm("Are you sure you want to approve this leave request?")) return;

        try {
            const response = await fetch(`/api/v1/admin/leaves/approve/${id}`, { method: 'POST' });
            const data = await response.json();
            if (response.ok && data.success) {
                loadLeaves();
            } else {
                alert(data.message || 'Approval failed');
            }
        } catch (error) {
            console.error("Error approving leave request:", error);
        }
    };

    window.rejectLeaveClick = async (id) => {
        if (!confirm("Are you sure you want to reject this leave request?")) return;

        try {
            const response = await fetch(`/api/v1/admin/leaves/reject/${id}`, { method: 'POST' });
            const data = await response.json();
            if (response.ok && data.success) {
                loadLeaves();
            } else {
                alert(data.message || 'Rejection failed');
            }
        } catch (error) {
            console.error("Error rejecting leave request:", error);
        }
    };

    window.deleteLeaveClick = async (id) => {
        if (!confirm("Are you sure you want to delete this leave record?")) return;

        try {
            const response = await fetch(`/api/v1/admin/leaves/${id}`, { method: 'DELETE' });
            const data = await response.json();
            if (response.ok && data.success) {
                loadLeaves();
            } else {
                alert(data.message || 'Deletion failed');
            }
        } catch (error) {
            console.error("Error deleting leave request:", error);
        }
    };

    // Load Monthly PCS Attendance Summary
    const loadPcsMonthlySummary = async () => {
        if (!pcsSummaryList) return;
        pcsSummaryList.innerHTML = '<tr><td colspan="11" style="text-align:center; padding:24px; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading monthly summary...</td></tr>';

        try {
            const selectedMonth = (filterPcsMonth && filterPcsMonth.value) ? filterPcsMonth.value.replace('-', '') : new Date().toISOString().slice(0, 7).replace('-', '');
            const response = await fetch(`/api/v1/attendance/pcs/monthly-summary?month=${selectedMonth}`);
            const result = await response.json();

            if (!response.ok || !result.success || !result.data || result.data.length === 0) {
                pcsSummaryList.innerHTML = `<tr><td colspan="11" style="text-align:center; padding:24px; color:var(--text-muted);">No attendance records found for ${selectedMonth}. Click "Calculate Attendance" to run calculations.</td></tr>`;
                return;
            }

            pcsSummaryList.innerHTML = '';
            result.data.forEach(row => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>
                        <div style="font-weight:700; color:var(--text-dark);">${row.full_name || row.USERNAME}</div>
                        <div style="font-size:11px; color:var(--text-muted);">${row.employee_code || row.USERNAME} ${row.department ? '• ' + row.department : ''}</div>
                    </td>
                    <td><strong>${row.YYYYMM}</strong></td>
                    <td>${row.TOTALDAYS || 0}</td>
                    <td><span class="badge" style="background:rgba(34,197,94,0.15); color:#16a34a; font-weight:700; padding:3px 8px; border-radius:6px;">${row.PRESENT || 0}</span></td>
                    <td><span class="badge" style="background:rgba(239,68,68,0.15); color:#dc2626; font-weight:700; padding:3px 8px; border-radius:6px;">${row.ABSENT || 0}</span></td>
                    <td><span class="badge" style="background:rgba(59,130,246,0.15); color:#2563eb; font-weight:700; padding:3px 8px; border-radius:6px;">${row.LEAVE || 0}</span></td>
                    <td style="color:${row.LATINTIME && row.LATINTIME !== '00:00' ? '#d97706' : 'inherit'}; font-weight:${row.LATINTIME && row.LATINTIME !== '00:00' ? '700' : 'normal'};">${row.LATINTIME || '00:00'}</td>
                    <td style="color:${row.PREOUTTIME && row.PREOUTTIME !== '00:00' ? '#dc2626' : 'inherit'}; font-weight:${row.PREOUTTIME && row.PREOUTTIME !== '00:00' ? '700' : 'normal'};">${row.PREOUTTIME || '00:00'}</td>
                    <td><strong>${row.WORKIMGHR || '00:00'}</strong></td>
                    <td style="color:#059669; font-weight:700;">${row.OTHOURS || '00:00'}</td>
                    <td><strong>${row.LOGIMHOURS || '00:00'}</strong></td>
                `;
                pcsSummaryList.appendChild(tr);
            });
        } catch (error) {
            console.error("Error loading PCS monthly summary:", error);
            pcsSummaryList.innerHTML = '<tr><td colspan="11" style="text-align:center; padding:24px; color:var(--red);">Failed to load monthly summary.</td></tr>';
        }
    };

    // Pre-fill current month in PCS filter
    if (filterPcsMonth) {
        filterPcsMonth.value = new Date().toISOString().slice(0, 7);
        filterPcsMonth.addEventListener('change', loadPcsMonthlySummary);
    }
    if (btnRefreshPcs) {
        btnRefreshPcs.addEventListener('click', loadPcsMonthlySummary);
    }

    // Run Calculation Trigger
    if (btnRunCalc) {
        btnRunCalc.addEventListener('click', async () => {
            const targetM = (filterPcsMonth && filterPcsMonth.value) ? `${filterPcsMonth.value}-01` : `${new Date().toISOString().slice(0, 7)}-01`;
            btnRunCalc.disabled = true;
            btnRunCalc.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Calculating...';

            try {
                const resp = await fetch('/api/v1/attendance/pcs/calculate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ month: targetM, username: 'All' })
                });
                const data = await resp.json();
                if (resp.ok && data.success) {
                    alert(`✅ Calculation Completed! ${data.affected_days} day records processed.`);
                    loadPcsMonthlySummary();
                } else {
                    alert(`❌ Calculation failed: ${data.message || 'Unknown error'}`);
                }
            } catch (e) {
                console.error("Calculation trigger error:", e);
                alert("Error triggering calculation: " + e.message);
            } finally {
                btnRunCalc.disabled = false;
                btnRunCalc.innerHTML = '<i class="fa-solid fa-bolt"></i> Calculate Attendance';
            }
        });
    }

    // Filter Listeners
    if (filterDate) {
        filterDate.addEventListener('change', loadLogs);
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
    loadLogs();
    loadPendingCorrections();
    loadLeaves();
});
