document.addEventListener('DOMContentLoaded', () => {
    function formatHoursMins(val, returnDashIfZero = false) {
        if (val === null || val === undefined || val === '' || val === '—' || val === '-') {
            return returnDashIfZero ? '—' : '0 hrs 0 mins';
        }
        const num = parseFloat(val);
        if (isNaN(num) || num <= 0) {
            return returnDashIfZero ? '—' : '0 hrs 0 mins';
        }
        const totalMinutes = Math.round(num * 60);
        const hrs = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        
        const hUnit = hrs === 1 ? 'hr' : 'hrs';
        const mUnit = mins === 1 ? 'min' : 'mins';

        if (hrs > 0 && mins > 0) {
            return `${hrs} ${hUnit} ${mins} ${mUnit}`;
        } else if (hrs > 0) {
            return `${hrs} ${hUnit}`;
        } else {
            return `${mins} ${mUnit}`;
        }
    }

    // Main Top-Level Tabs (Attendance vs Leaves vs Out Entry)
    const tabBtnAttendance = document.getElementById('tab-btn-attendance');
    const tabBtnLeave = document.getElementById('tab-btn-leave');
    const tabBtnOutEntry = document.getElementById('tab-btn-out-entry');

    const tabContentAttendance = document.getElementById('tab-content-attendance');
    const tabContentLeave = document.getElementById('tab-content-leave');
    const tabContentOutEntry = document.getElementById('tab-content-out-entry');
    
    // Page Header Action Buttons
    const btnAddCorrection = document.getElementById('btn-add-correction');
    const btnAddLeave = document.getElementById('btn-add-leave');
    const btnAddOutEntry = document.getElementById('btn-add-out-entry');

    // Inner Attendance Sub-Tabs
    const tabLogs = document.getElementById('tab-logs');
    const tabPayrollRegister = document.getElementById('tab-payroll-register');
    const tabPcsSummary = document.getElementById('tab-pcs-summary');
    const tabPending = document.getElementById('tab-pending');
    const viewLogs = document.getElementById('view-logs');
    const viewPayroll = document.getElementById('view-payroll');
    const viewPcsSummary = document.getElementById('view-pcs-summary');
    const viewPending = document.getElementById('view-pending');
    const viewTitle = document.getElementById('table-title') || document.getElementById('view-title');
    const btnRunCalc = document.getElementById('btn-run-calc');
    const filterPcsMonth = document.getElementById('filter-pcs-month');
    const btnRefreshPcs = document.getElementById('btn-refresh-pcs');
    const pcsSummaryList = document.getElementById('pcs-summary-list');

    // DOM Elements - Monthly Payroll & Pricing
    const payrollMonthSelect = document.getElementById('payroll-month-select');
    const btnPayrollPrevMonth = document.getElementById('btn-payroll-prev-month');
    const btnPayrollCurrentMonth = document.getElementById('btn-payroll-current-month');
    const btnPayrollNextMonth = document.getElementById('btn-payroll-next-month');
    const payrollSearchInput = document.getElementById('payroll-search-input');
    const btnExportPayrollCsv = document.getElementById('btn-export-payroll-csv');

    const payrollKpiGross = document.getElementById('payroll-kpi-gross');
    const payrollKpiNet = document.getElementById('payroll-kpi-net');
    const payrollKpiDeductions = document.getElementById('payroll-kpi-deductions');
    const payrollKpiAvgrate = document.getElementById('payroll-kpi-avgrate');

    const payrollMatrixThead = document.getElementById('payroll-matrix-thead');
    const payrollMatrixTbody = document.getElementById('payroll-matrix-tbody');

    const modalPayrollRates = document.getElementById('modal-payroll-rates');
    const payrollRatesModalClose = document.getElementById('payroll-rates-modal-close');
    const payrollRatesCancelBtn = document.getElementById('payroll-rates-cancel-btn');
    const payrollRatesForm = document.getElementById('payroll-rates-form');

    // DOM Elements - Correction Modal
    const correctionModal = document.getElementById('correction-modal');
    const correctionForm = document.getElementById('correction-form');
    const correctionClose = document.getElementById('correction-close');
    const correctionCancel = document.getElementById('correction-cancel');
    const corrEmployee = document.getElementById('corr-employee');
    const corrDate = document.getElementById('corr-date');

    // DOM Elements - Leave Modal
    const leaveModal = document.getElementById('leave-modal');
    const leaveForm = document.getElementById('leave-form');
    const leaveClose = document.getElementById('leave-close');
    const leaveCancel = document.getElementById('leave-cancel');
    const leaveEmployee = document.getElementById('leave-employee');

    // DOM Elements - Out Entry Modal & Mark Return Modal
    const outEntryModal = document.getElementById('out-entry-modal');
    const outEntryForm = document.getElementById('out-entry-form');
    const outEntryClose = document.getElementById('out-entry-close');
    const outEntryCancel = document.getElementById('out-entry-cancel');
    const outEmployee = document.getElementById('out-employee');
    const outDate = document.getElementById('out-date');
    const outTimeVal = document.getElementById('out-time-val');

    const markReturnModal = document.getElementById('mark-return-modal');
    const markReturnForm = document.getElementById('mark-return-form');
    const markReturnClose = document.getElementById('mark-return-close');
    const markReturnCancel = document.getElementById('mark-return-cancel');
    const returnEntryId = document.getElementById('return-entry-id');
    const returnInTime = document.getElementById('return-in-time');

    // Table Lists & Metrics DOM
    const logsList = document.getElementById('logs-list');
    const pendingList = document.getElementById('pending-list');
    const leavesList = document.getElementById('leaves-list');
    const outEntriesList = document.getElementById('out-entries-list');

    const countPresent = document.getElementById('count-present');
    const countLate = document.getElementById('count-late');
    const countAbsent = document.getElementById('count-absent');
    const countPending = document.getElementById('count-pending');

    const countTotal = document.getElementById('count-total');
    const countLeavePending = document.getElementById('count-leave-pending');
    const countAnnual = document.getElementById('count-annual');
    const countSick = document.getElementById('count-sick');

    const countCurrentlyOut = document.getElementById('count-currently-out');
    const countOutToday = document.getElementById('count-out-today');
    const countOutOfficial = document.getElementById('count-out-official');
    const countOutPersonal = document.getElementById('count-out-personal');

    const filterStartDate = document.getElementById('filter-start-date');
    const filterEndDate = document.getElementById('filter-end-date');
    const btnQuickToday = document.getElementById('btn-quick-today');
    const btnQuickYesterday = document.getElementById('btn-quick-yesterday');
    const btnQuick7days = document.getElementById('btn-quick-7days');
    const btnQuick30days = document.getElementById('btn-quick-30days');
    const btnExportDailyRangeCSV = document.getElementById('btn-export-daily-range-csv');
    const btnRefreshDailyLogs = document.getElementById('btn-refresh-daily-logs');

    const filterOutDate = document.getElementById('filter-out-date');
    const filterOutPurpose = document.getElementById('filter-out-purpose');
    const filterOutStatus = document.getElementById('filter-out-status');
    const btnRefreshOut = document.getElementById('btn-refresh-out');
    const logoutBtn = document.getElementById('logout-btn');

    // DOM Elements - Holidays
    const tabBtnHolidays = document.getElementById('tab-btn-holidays');
    const tabContentHolidays = document.getElementById('tab-content-holidays');
    const btnAddHoliday = document.getElementById('btn-add-holiday');
    const holidaysList = document.getElementById('holidays-list');
    const countHolidaysTotal = document.getElementById('count-holidays-total');
    const countHolidayNext = document.getElementById('count-holiday-next');
    const countHolidaysMandatory = document.getElementById('count-holidays-mandatory');
    const countHolidaysOptional = document.getElementById('count-holidays-optional');
    const filterHolidayYear = document.getElementById('filter-holiday-year');
    const filterHolidayType = document.getElementById('filter-holiday-type');
    const filterHolidaySearch = document.getElementById('filter-holiday-search');
    const btnExportHolidaysCSV = document.getElementById('btn-export-holidays-csv');
    const btnRefreshHolidays = document.getElementById('btn-refresh-holidays');

    const holidayModal = document.getElementById('holiday-modal');
    const holidayForm = document.getElementById('holiday-form');
    const holidayModalTitle = document.getElementById('holiday-modal-title');
    const holidayModalClose = document.getElementById('holiday-modal-close');
    const holidayCancelBtn = document.getElementById('holiday-cancel-btn');
    const holidayIdInput = document.getElementById('holiday-id');
    const holidayNameInput = document.getElementById('holiday-name');
    const holidayDateInput = document.getElementById('holiday-date');
    const holidayTypeInput = document.getElementById('holiday-type');
    const holidayIsOptionalInput = document.getElementById('holiday-is-optional');
    const holidayDescInput = document.getElementById('holiday-desc');

    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    let employeesCache = [];
    let leavesCache = [];
    let outEntriesCache = [];
    let holidaysCache = [];
    let currentDailyLogsCache = [];

    // Switch Top-Level Main Tabs (Attendance vs Leaves vs Out Entry vs Holidays)
    const switchMainTab = (tab) => {
        if (tabBtnAttendance) tabBtnAttendance.classList.remove('active');
        if (tabBtnLeave) tabBtnLeave.classList.remove('active');
        if (tabBtnOutEntry) tabBtnOutEntry.classList.remove('active');
        if (tabBtnHolidays) tabBtnHolidays.classList.remove('active');

        if (tabContentAttendance) tabContentAttendance.style.display = 'none';
        if (tabContentLeave) tabContentLeave.style.display = 'none';
        if (tabContentOutEntry) tabContentOutEntry.style.display = 'none';
        if (tabContentHolidays) tabContentHolidays.style.display = 'none';

        if (btnAddCorrection) btnAddCorrection.style.display = 'none';
        if (btnAddLeave) btnAddLeave.style.display = 'none';
        if (btnAddOutEntry) btnAddOutEntry.style.display = 'none';
        if (btnAddHoliday) btnAddHoliday.style.display = 'none';

        const btnExport = document.querySelector('.btn-pill-export');
        if (tab === 'attendance') {
            if (tabBtnAttendance) tabBtnAttendance.classList.add('active');
            if (tabContentAttendance) tabContentAttendance.style.display = 'block';
            if (btnAddCorrection) btnAddCorrection.style.display = 'inline-flex';
            if (btnExport) btnExport.setAttribute('onclick', "window.exportModuleDataFile('attendance', 'xlsx')");
            loadLogs();
        } else if (tab === 'leave') {
            if (tabBtnLeave) tabBtnLeave.classList.add('active');
            if (tabContentLeave) tabContentLeave.style.display = 'block';
            if (btnAddLeave) btnAddLeave.style.display = 'inline-flex';
            if (btnExport) btnExport.setAttribute('onclick', "window.exportModuleDataFile('leaves', 'xlsx')");
            loadLeaves();
        } else if (tab === 'out-entry') {
            if (tabBtnOutEntry) tabBtnOutEntry.classList.add('active');
            if (tabContentOutEntry) tabContentOutEntry.style.display = 'block';
            if (btnAddOutEntry) btnAddOutEntry.style.display = 'inline-flex';
            if (btnExport) btnExport.setAttribute('onclick', "window.exportModuleDataFile('out_entries', 'xlsx')");
            loadOutEntries();
        } else if (tab === 'holidays') {
            if (tabBtnHolidays) tabBtnHolidays.classList.add('active');
            if (tabContentHolidays) tabContentHolidays.style.display = 'block';
            if (btnAddHoliday) btnAddHoliday.style.display = 'inline-flex';
            if (btnExport) btnExport.setAttribute('onclick', "window.exportModuleDataFile('holidays', 'xlsx')");
            loadHolidays();
        }
    };

    if (tabBtnAttendance) tabBtnAttendance.addEventListener('click', () => switchMainTab('attendance'));
    if (tabBtnLeave) tabBtnLeave.addEventListener('click', () => switchMainTab('leave'));
    if (tabBtnOutEntry) tabBtnOutEntry.addEventListener('click', () => switchMainTab('out-entry'));
    if (tabBtnHolidays) tabBtnHolidays.addEventListener('click', () => switchMainTab('holidays'));

    // Switch Inner Attendance Sub-Tabs (Daily Logs vs Monthly Summary vs Corrections vs Payroll)
    const switchAttendanceTab = (tabName) => {
        if (tabLogs) tabLogs.classList.remove('active');
        if (tabPayrollRegister) tabPayrollRegister.classList.remove('active');
        if (tabPcsSummary) tabPcsSummary.classList.remove('active');
        if (tabPending) tabPending.classList.remove('active');

        if (viewLogs) viewLogs.style.display = 'none';
        if (viewPayroll) viewPayroll.style.display = 'none';
        if (viewPcsSummary) viewPcsSummary.style.display = 'none';
        if (viewPending) viewPending.style.display = 'none';
        if (btnRunCalc) btnRunCalc.style.display = 'none';

        if (tabName === 'logs') {
            if (tabLogs) tabLogs.classList.add('active');
            if (viewLogs) viewLogs.style.display = 'block';
            if (viewTitle) viewTitle.textContent = 'Daily Check-Ins';
            loadLogs();
        } else if (tabName === 'payroll') {
            if (tabPayrollRegister) tabPayrollRegister.classList.add('active');
            if (viewPayroll) viewPayroll.style.display = 'block';
            if (viewTitle) viewTitle.textContent = 'Monthly Payroll & Employee Pricing Register';
            loadMonthlyPayroll();
        } else if (tabName === 'pcs-summary') {
            if (tabPcsSummary) tabPcsSummary.classList.add('active');
            if (viewPcsSummary) viewPcsSummary.style.display = 'block';
            if (btnRunCalc) btnRunCalc.style.display = 'inline-flex';
            if (viewTitle) viewTitle.textContent = 'Monthly Attendance Summary';
            loadPcsMonthlySummary();
        } else if (tabName === 'pending') {
            if (tabPending) tabPending.classList.add('active');
            if (viewPending) viewPending.style.display = 'block';
            if (viewTitle) viewTitle.textContent = 'Pending Attendance Corrections';
            loadPendingCorrections();
        }
    };

    if (tabLogs) tabLogs.addEventListener('click', () => switchAttendanceTab('logs'));
    if (tabPayrollRegister) tabPayrollRegister.addEventListener('click', () => switchAttendanceTab('payroll'));
    if (tabPcsSummary) tabPcsSummary.addEventListener('click', () => switchAttendanceTab('pcs-summary'));
    if (tabPending) tabPending.addEventListener('click', () => switchAttendanceTab('pending'));

    // --- MODAL CONTROLLERS ---
    const openCorrectionModal = () => {
        if (corrDate) corrDate.value = today;
        if (correctionModal) correctionModal.style.display = 'flex';
    };
    const closeCorrectionModal = () => {
        if (correctionModal) correctionModal.style.display = 'none';
        if (correctionForm) correctionForm.reset();
    };

    if (btnAddCorrection) btnAddCorrection.addEventListener('click', openCorrectionModal);
    if (correctionClose) correctionClose.addEventListener('click', closeCorrectionModal);
    if (correctionCancel) correctionCancel.addEventListener('click', closeCorrectionModal);

    const openLeaveModal = () => {
        const startEl = document.getElementById('leave-start');
        const endEl = document.getElementById('leave-end');
        if (startEl) startEl.value = today;
        if (endEl) endEl.value = today;
        if (leaveModal) leaveModal.style.display = 'flex';
    };
    const closeLeaveModal = () => {
        if (leaveModal) leaveModal.style.display = 'none';
        if (leaveForm) leaveForm.reset();
    };

    if (btnAddLeave) btnAddLeave.addEventListener('click', openLeaveModal);
    if (leaveClose) leaveClose.addEventListener('click', closeLeaveModal);
    if (leaveCancel) leaveCancel.addEventListener('click', closeLeaveModal);

    const openOutEntryModal = () => {
        if (outDate) outDate.value = today;
        if (outTimeVal) {
            const now = new Date();
            outTimeVal.value = now.toTimeString().slice(0, 5);
        }
        if (outEntryModal) outEntryModal.style.display = 'flex';
    };
    const closeOutEntryModal = () => {
        if (outEntryModal) outEntryModal.style.display = 'none';
        if (outEntryForm) outEntryForm.reset();
    };

    if (btnAddOutEntry) btnAddOutEntry.addEventListener('click', openOutEntryModal);
    if (outEntryClose) outEntryClose.addEventListener('click', closeOutEntryModal);
    if (outEntryCancel) outEntryCancel.addEventListener('click', closeOutEntryModal);

    const closeMarkReturnModal = () => {
        if (markReturnModal) markReturnModal.style.display = 'none';
        if (markReturnForm) markReturnForm.reset();
    };

    if (markReturnClose) markReturnClose.addEventListener('click', closeMarkReturnModal);
    if (markReturnCancel) markReturnCancel.addEventListener('click', closeMarkReturnModal);

    // --- EMPLOYEE DROPDOWN POPULATOR ---
    const populateEmployeesDropdowns = () => {
        const updateDropdown = (el) => {
            if (!el) return;
            const currentVal = el.value;
            el.innerHTML = '<option value="">Select Employee</option>';
            employeesCache.forEach(emp => {
                const opt = document.createElement('option');
                opt.value = emp.id;
                opt.textContent = `${emp.full_name} (${emp.employee_code || 'EMP-' + emp.id})`;
                el.appendChild(opt);
            });
            if (currentVal) el.value = currentVal;
        };

        updateDropdown(corrEmployee);
        updateDropdown(leaveEmployee);
        updateDropdown(outEmployee);
    };

    // =========================================================================
    // 1. ATTENDANCE DAILY LOGS (WITH FROM-TO DATE RANGE ENGINE)
    // =========================================================================
    if (filterStartDate && !filterStartDate.value) filterStartDate.value = today;
    if (filterEndDate && !filterEndDate.value) filterEndDate.value = today;

    const loadLogs = async (overrideStart = null, overrideEnd = null) => {
        const startVal = overrideStart || (filterStartDate && filterStartDate.value ? filterStartDate.value : today);
        const endVal = overrideEnd || (filterEndDate && filterEndDate.value ? filterEndDate.value : startVal);

        if (filterStartDate) filterStartDate.value = startVal;
        if (filterEndDate) filterEndDate.value = endVal;

        if (logsList) {
            logsList.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:28px;color:var(--text-muted);font-size:13.5px;"><i class="fa-solid fa-spinner fa-spin" style="font-size:18px;margin-bottom:8px;display:block;color:var(--teal-900);"></i>Syncing live attendance logs (${startVal}${startVal !== endVal ? ' to ' + endVal : ''})...</td></tr>`;
        }

        try {
            const token = localStorage.getItem('token') || '';
            const response = await fetch(`/api/v1/admin/attendance?startDate=${startVal}&endDate=${endVal}`, {
                credentials: 'include',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();
            if (response.ok && data.success) {
                employeesCache = data.data?.employees || [];
                populateEmployeesDropdowns();
                currentDailyLogsCache = data.data?.logs || [];
                renderLogs(currentDailyLogsCache, data.summary);
            } else {
                renderLogs([]);
            }
        } catch (error) {
            console.error("Error loading daily attendance logs:", error);
            renderLogs([]);
        }
    };

    const renderLogs = (logs, summary = null) => {
        if (!logsList) return;
        logsList.innerHTML = '';

        let present = 0;
        let late = 0;
        let absent = 0;

        if (logs.length === 0) {
            logsList.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-muted);font-size:13.5px;"><i class="fa-solid fa-calendar-xmark" style="font-size:24px;margin-bottom:8px;display:block;color:#94a3b8;"></i>No attendance records found for this period</td></tr>`;
        } else {
            logs.forEach(log => {
                if (log.status === 'Present') present++;
                else if (log.status === 'Late') late++;
                else if (log.status === 'Absent') absent++;

                const tr = document.createElement('tr');
                tr.style.cursor = 'pointer';
                
                const formatTime = (tStr) => {
                    if (!tStr || tStr === '—') return '—';
                    if (/^\d{2}:\d{2}/.test(tStr)) return tStr;
                    try {
                        const d = new Date(tStr);
                        if (!isNaN(d.getTime())) {
                            return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                        }
                    } catch (e) {}
                    return tStr;
                };

                const loginStr = formatTime(log.login_time);
                const logoutStr = formatTime(log.logout_time);
                
                let statusClass = 'delayed';
                let statusBadgeStyle = 'background:#fee2e2; color:#b91c1c; font-weight:700;';
                if (log.status === 'Present') {
                    statusClass = 'progress';
                    statusBadgeStyle = 'background:#dcfce7; color:#15803d; font-weight:700;';
                } else if (log.status === 'Late') {
                    statusClass = 'pending';
                    statusBadgeStyle = 'background:#fef3c7; color:#b45309; font-weight:700;';
                } else if (log.status === 'On Leave') {
                    statusClass = 'todo';
                    statusBadgeStyle = 'background:#e0f2fe; color:#0369a1; font-weight:700;';
                } else if (log.status === 'Half Day') {
                    statusClass = 'todo';
                    statusBadgeStyle = 'background:#f3e8ff; color:#7e22ce; font-weight:700;';
                }

                let sourceBadge = '';
                if (log.punch_source === 'PORTAL') {
                    sourceBadge = `<div style="margin-top:4px;"><span style="display:inline-flex; align-items:center; gap:4px; font-size:10px; font-weight:700; color:#15803d; background:#dcfce7; padding:2px 6px; border-radius:4px;"><i class="fa-solid fa-hand-pointer"></i> Web Punch</span></div>`;
                } else if (log.punch_source === 'MANUAL_HR') {
                    sourceBadge = `<div style="margin-top:4px;"><span style="display:inline-flex; align-items:center; gap:4px; font-size:10px; font-weight:700; color:#7e22ce; background:#f3e8ff; padding:2px 6px; border-radius:4px;"><i class="fa-solid fa-pen-fancy"></i> HR Approved</span></div>`;
                } else if (log.punch_source === 'TERAMIND') {
                    sourceBadge = `<div style="margin-top:4px;"><span style="display:inline-flex; align-items:center; gap:4px; font-size:10px; font-weight:700; color:#0369a1; background:#e0f2fe; padding:2px 6px; border-radius:4px;"><i class="fa-solid fa-desktop"></i> Workstation Auto</span></div>`;
                } else if (log.punch_source === 'LEAVE_MANAGEMENT') {
                    sourceBadge = `<div style="margin-top:4px;"><span style="display:inline-flex; align-items:center; gap:4px; font-size:10px; font-weight:700; color:#b45309; background:#fef3c7; padding:2px 6px; border-radius:4px;"><i class="fa-solid fa-umbrella-beach"></i> Approved Leave</span></div>`;
                }

                // Break column calculation (Start - End & Duration)
                const getBreakHtml = (l) => {
                    if (l.is_on_break) {
                        let bStartStr = '';
                        if (l.break_start) {
                            try {
                                const d = new Date(l.break_start);
                                if (!isNaN(d.getTime())) bStartStr = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                            } catch (e) {}
                        }
                        return `
                            <div>
                                <span class="status-pill pending" style="background:#fef3c7; color:#b45309; font-weight:800; font-size:10.5px; padding:2px 7px; border-radius:5px; display:inline-flex; align-items:center; gap:4px;">
                                    <i class="fa-solid fa-mug-hot fa-bounce"></i> On Break
                                </span>
                                ${bStartStr ? `<div style="font-size:11px; color:#92400e; font-weight:700; margin-top:2px;">Since ${bStartStr}</div>` : ''}
                            </div>
                        `;
                    }

                    const totalSec = parseInt(l.total_break_seconds || 0, 10);
                    const breakTimeNum = parseFloat(l.break_time || 0);

                    let bHistory = [];
                    if (l.break_history) {
                        try {
                            bHistory = typeof l.break_history === 'string' ? JSON.parse(l.break_history) : l.break_history;
                        } catch (e) {
                            bHistory = [];
                        }
                    }

                    if (Array.isArray(bHistory) && bHistory.length > 0) {
                        const firstBreak = bHistory[0];
                        const lastBreak = bHistory[bHistory.length - 1];
                        
                        const formatBTime = (iso) => {
                            if (!iso) return '';
                            try {
                                const d = new Date(iso);
                                return !isNaN(d.getTime()) ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
                            } catch (e) { return ''; }
                        };

                        const startStr = formatBTime(firstBreak.start);
                        const endStr = formatBTime(lastBreak.end || lastBreak.start);
                        const totalMin = Math.round(totalSec / 60) || Math.round(breakTimeNum);

                        return `
                            <div>
                                <div style="font-size:12px; font-weight:700; color:#334155; display:flex; align-items:center; gap:4px;">
                                    <i class="fa-solid fa-mug-hot" style="color:#d97706; font-size:11px;"></i> ${startStr && endStr ? `${startStr} - ${endStr}` : (startStr || 'Break')}
                                </div>
                                <div style="font-size:11px; color:#0f766e; font-weight:700; margin-top:1px;">${totalMin > 0 ? `${totalMin} mins` : '—'}</div>
                            </div>
                        `;
                    }

                    if (totalSec > 0 || breakTimeNum > 0) {
                        const totalMin = Math.round(totalSec / 60) || Math.round(breakTimeNum);
                        return `
                            <div>
                                <div style="font-size:12px; font-weight:700; color:#334155; display:flex; align-items:center; gap:4px;">
                                    <i class="fa-solid fa-mug-hot" style="color:#d97706; font-size:11px;"></i> ${totalMin} mins
                                </div>
                            </div>
                        `;
                    }

                    return '<span style="color:#94a3b8; font-weight:600;">—</span>';
                };

                const ovtHours = (log.overtime_hours && parseFloat(log.overtime_hours) > 0) ? formatHoursMins(log.overtime_hours, true) : (log.overtime ? `${log.overtime} mins` : '—');
                const workingHours = (log.total_working_hours && parseFloat(log.total_working_hours) > 0) ? formatHoursMins(log.total_working_hours, true) : '—';

                tr.innerHTML = `
                    <td>
                        <div style="font-weight:700; color:var(--text-dark);">${log.full_name || 'Unknown'}</div>
                        <div style="font-size:11px; color:var(--text-muted);">${log.employee_code || ''} ${log.workstation && log.workstation !== '—' ? '• ' + log.workstation : ''}</div>
                        ${sourceBadge}
                    </td>
                    <td><strong style="color:#334155;">${log.date || today}</strong></td>
                    <td><strong style="color:${loginStr !== '—' ? '#047857' : '#94a3b8'};">${loginStr}</strong></td>
                    <td><strong style="color:${logoutStr !== '—' ? '#0f172a' : '#94a3b8'};">${logoutStr}</strong></td>
                    <td>${getBreakHtml(log)}</td>
                    <td><strong style="color:${parseFloat(log.overtime_hours || log.overtime || 0) > 0 ? '#b45309' : '#64748b'};">${ovtHours}</strong></td>
                    <td><strong style="color:#0f172a;">${workingHours}</strong></td>
                    <td><span class="status-pill ${statusClass}" style="${statusBadgeStyle}">${log.status || 'Absent'}</span></td>
                    <td>
                        <div style="display:flex; align-items:center; gap:6px;">
                            <button type="button" class="btn-table-action" onclick="event.stopPropagation(); openEmpAttendanceHistoryModal(${log.employee_id}, '${escapeQuote(log.full_name)}', '${log.employee_code || ''}', '${log.workstation || ''}')" title="View Full History & Export CSV" style="color:var(--teal-600);"><i class="fa-solid fa-clock-rotate-left"></i></button>
                            <button type="button" class="btn-table-action" onclick='event.stopPropagation(); editCorrection(${JSON.stringify(log)})' title="Edit / Manual Correction"><i class="fa-solid fa-pen"></i></button>
                        </div>
                    </td>
                `;

                tr.addEventListener('click', (e) => {
                    if (e.target.closest('button')) return;
                    openEmpAttendanceHistoryModal(log.employee_id, log.full_name, log.employee_code, log.workstation);
                });

                logsList.appendChild(tr);
            });
        }

        if (summary) {
            if (countPresent) countPresent.textContent = summary.present || 0;
            if (countLate) countLate.textContent = summary.late || 0;
            if (countAbsent) countAbsent.textContent = summary.absent || 0;
        } else {
            if (countPresent) countPresent.textContent = present;
            if (countLate) countLate.textContent = late;
            if (countAbsent) countAbsent.textContent = absent;
        }
    };

    if (filterStartDate) {
        filterStartDate.addEventListener('change', () => {
            loadLogs(filterStartDate.value, filterEndDate ? filterEndDate.value : filterStartDate.value);
        });
    }

    if (filterEndDate) {
        filterEndDate.addEventListener('change', () => {
            loadLogs(filterStartDate ? filterStartDate.value : filterEndDate.value, filterEndDate.value);
        });
    }

    if (btnQuickToday) {
        btnQuickToday.addEventListener('click', () => {
            if (filterStartDate) filterStartDate.value = today;
            if (filterEndDate) filterEndDate.value = today;
            loadLogs(today, today);
        });
    }

    if (btnQuickYesterday) {
        btnQuickYesterday.addEventListener('click', () => {
            const d = new Date();
            d.setDate(d.getDate() - 1);
            const yestStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
            if (filterStartDate) filterStartDate.value = yestStr;
            if (filterEndDate) filterEndDate.value = yestStr;
            loadLogs(yestStr, yestStr);
        });
    }

    if (btnQuick7days) {
        btnQuick7days.addEventListener('click', () => {
            const d = new Date();
            d.setDate(d.getDate() - 7);
            const sStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
            if (filterStartDate) filterStartDate.value = sStr;
            if (filterEndDate) filterEndDate.value = today;
            loadLogs(sStr, today);
        });
    }

    if (btnQuick30days) {
        btnQuick30days.addEventListener('click', () => {
            const sStr = `${today.slice(0, 7)}-01`;
            if (filterStartDate) filterStartDate.value = sStr;
            if (filterEndDate) filterEndDate.value = today;
            loadLogs(sStr, today);
        });
    }

    if (btnRefreshDailyLogs) {
        btnRefreshDailyLogs.addEventListener('click', async () => {
            const icon = btnRefreshDailyLogs.querySelector('i');
            if (icon) icon.classList.add('fa-spin');
            await loadLogs(filterStartDate ? filterStartDate.value : today, filterEndDate ? filterEndDate.value : today);
            if (icon) icon.classList.remove('fa-spin');
        });
    }

    if (btnExportDailyRangeCSV) {
        btnExportDailyRangeCSV.addEventListener('click', () => {
            if (!currentDailyLogsCache || currentDailyLogsCache.length === 0) {
                alert("No attendance records to export for this period.");
                return;
            }
            const sDate = filterStartDate ? filterStartDate.value : today;
            const eDate = filterEndDate ? filterEndDate.value : sDate;

            const headers = ["Employee Code", "Employee Name", "Workstation", "Date", "Check-In Time", "Check-Out Time", "Break (Start-End / Duration)", "Overtime (OVT)", "Total Working Hours", "Status", "Source"];
            const rows = currentDailyLogsCache.map(r => {
                let breakText = '—';
                if (r.is_on_break) {
                    breakText = 'On Break';
                } else if (r.break_history && (Array.isArray(r.break_history) ? r.break_history.length > 0 : false)) {
                    const bh = Array.isArray(r.break_history) ? r.break_history : (typeof r.break_history === 'string' ? JSON.parse(r.break_history) : []);
                    if (bh.length > 0) {
                        const s = bh[0].start ? new Date(bh[0].start).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
                        const e = bh[bh.length - 1].end ? new Date(bh[bh.length - 1].end).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
                        const m = Math.round((r.total_break_seconds || 0) / 60) || Math.round(r.break_time || 0);
                        breakText = `${s}-${e} (${m}m)`;
                    }
                } else if (r.total_break_seconds > 0 || r.break_time > 0) {
                    const m = Math.round((r.total_break_seconds || 0) / 60) || Math.round(r.break_time || 0);
                    breakText = `${m} mins`;
                }

                return [
                    r.employee_code || '',
                    r.full_name || '',
                    r.workstation || '—',
                    r.date,
                    r.login_time ? (String(r.login_time).includes('T') ? String(r.login_time).split('T')[1].slice(0, 5) : r.login_time) : '—',
                    r.logout_time ? (String(r.logout_time).includes('T') ? String(r.logout_time).split('T')[1].slice(0, 5) : r.logout_time) : '—',
                    breakText,
                    (r.overtime_hours && parseFloat(r.overtime_hours) > 0) ? formatHoursMins(r.overtime_hours, true) : (r.overtime ? `${r.overtime} mins` : '—'),
                    formatHoursMins(r.total_working_hours, true),
                    r.status || 'Absent',
                    r.punch_source || 'TERAMIND'
                ];
            });

            const csvContent = "\uFEFF" + [
                headers.map(h => `"${h}"`).join(','),
                ...rows.map(row => row.map(val => {
                    const s = String(val ?? '').replace(/"/g, '""');
                    if (/^\d{4}-\d{2}-\d{2}$/.test(s) || /^\d{2}:\d{2}(:\d{2})?$/.test(s)) {
                        return `="""${s}"""`;
                    }
                    return `"${s}"`;
                }).join(','))
            ].join('\r\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.setAttribute('download', `Attendance_Range_${sDate}_to_${eDate}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }

    const loadPendingCorrections = async () => {
        try {
            const response = await fetch('/api/v1/admin/attendance/pending');
            const data = await response.json();
            if (response.ok && data.success) {
                renderPendingCorrections(data.data || []);
            }
        } catch (error) {
            console.error("Error loading pending corrections:", error);
        }
    };

    const renderPendingCorrections = (corrections) => {
        if (!pendingList) return;
        pendingList.innerHTML = '';

        if (countPending) countPending.textContent = corrections.length;

        if (corrections.length === 0) {
            pendingList.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted);">No pending corrections</td></tr>`;
        } else {
            corrections.forEach(req => {
                const tr = document.createElement('tr');
                const reqInStr = req.requested_check_in ? new Date(req.requested_check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
                const reqOutStr = req.requested_check_out ? new Date(req.requested_check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';

                tr.innerHTML = `
                    <td>
                        <div style="font-weight:700; color:var(--text-dark);">${req.full_name || 'Unknown'}</div>
                        <div style="font-size:11px; color:var(--text-muted);">${req.employee_code || ''}</div>
                    </td>
                    <td>${new Date(req.date).toLocaleDateString()}</td>
                    <td><strong>${reqInStr}</strong></td>
                    <td><strong>${reqOutStr}</strong></td>
                    <td><span class="status-pill pending">${req.approval_status}</span></td>
                    <td>
                        <div style="display:flex; gap:6px;">
                            <button type="button" class="btn-table-action" style="color:var(--teal-600);" onclick="approveCorrectionClick(${req.id})" title="Approve"><i class="fa-solid fa-check"></i></button>
                            <button type="button" class="btn-table-action" style="color:var(--red);" onclick="rejectCorrectionClick(${req.id})" title="Reject"><i class="fa-solid fa-xmark"></i></button>
                        </div>
                    </td>
                `;
                pendingList.appendChild(tr);
            });
        }
    };

    // Correction Form Submit
    if (correctionForm) {
        correctionForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                employeeId: corrEmployee.value,
                date: corrDate.value,
                loginTime: document.getElementById('corr-in').value || null,
                logoutTime: document.getElementById('corr-out').value || null,
                status: document.getElementById('corr-status').value,
                overtime: document.getElementById('corr-overtime').value || 0
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
    }

    window.editCorrection = (log) => {
        if (correctionForm) correctionForm.reset();
        if (corrEmployee) corrEmployee.value = log.employee_id;
        if (corrDate) corrDate.value = new Date(log.date).toISOString().split('T')[0];
        
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

        if (correctionModal) correctionModal.classList.add('active');
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

    // =========================================================================
    // 2. LEAVE MANAGEMENT
    // =========================================================================
    const loadLeaves = async () => {
        try {
            const response = await fetch('/api/v1/admin/leaves');
            const data = await response.json();
            if (response.ok && data.success) {
                employeesCache = data.data.employees || [];
                leavesCache = data.data.leaves || [];
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

                if (req.status === 'Pending') pending++;
                if (req.status === 'Approved' && (req.leave_type === 'Annual Leave' || req.leave_type === 'Paid Leave')) annual++;
                if (req.status === 'Approved' && req.leave_type === 'Sick Leave') sick++;

                const tr = document.createElement('tr');
                let actionButtons = `
                    <button type="button" class="btn-table-action" style="color:var(--teal-600);" onclick="openEmpLeaveHistoryModal(${req.employee_id}, '${escapeQuote(req.full_name)}', '${req.employee_code || ''}')" title="View Leave History & Export"><i class="fa-solid fa-clock-rotate-left"></i></button>
                `;

                if (req.status === 'Pending') {
                    actionButtons += `
                        <button type="button" class="btn-table-action" style="color:var(--teal-600);" onclick="approveLeaveClick(${req.id})" title="Approve"><i class="fa-solid fa-check"></i></button>
                        <button type="button" class="btn-table-action" style="color:var(--red);" onclick="rejectLeaveClick(${req.id})" title="Reject"><i class="fa-solid fa-xmark"></i></button>
                    `;
                } else {
                    actionButtons += `
                        <button type="button" class="btn-table-action" style="color:var(--red);" onclick="deleteLeaveClick(${req.id})" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
                    `;
                }

                tr.innerHTML = `
                    <td>
                        <div style="font-weight:700; color:var(--text-dark);">${req.full_name || 'Unknown'}</div>
                        <div style="font-size:11px; color:var(--text-muted);">${req.employee_code || ''}</div>
                    </td>
                    <td><span style="font-weight:600;">${req.leave_type}</span></td>
                    <td>${startDate} &rarr; ${endDate}</td>
                    <td><span style="color:var(--text-muted); font-size:12.5px;">${req.reason || '—'}</span></td>
                    <td><span class="status-pill ${statusClass}">${statusLabel}</span></td>
                    <td>
                        <div style="display:flex; gap:6px;">
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

    if (leaveForm) {
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
    }

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

    // =========================================================================
    // 3. OUT ENTRY / GATE PASS MANAGEMENT
    // =========================================================================
    const loadOutEntries = async () => {
        try {
            const dateVal = filterOutDate ? filterOutDate.value : '';
            const purposeVal = filterOutPurpose ? filterOutPurpose.value : 'All';
            const statusVal = filterOutStatus ? filterOutStatus.value : 'All';

            let query = '/api/v1/admin/out-entries?';
            if (dateVal) query += `date=${dateVal}&`;
            if (purposeVal && purposeVal !== 'All') query += `purpose=${encodeURIComponent(purposeVal)}&`;
            if (statusVal && statusVal !== 'All') query += `status=${encodeURIComponent(statusVal)}&`;

            const response = await fetch(query);
            const data = await response.json();
            if (response.ok && data.success) {
                outEntriesCache = data.data.entries || [];
                employeesCache = data.data.employees || [];
                populateEmployeesDropdowns();
                renderOutEntries(data.data.stats || {});
            }
        } catch (error) {
            console.error("Error loading out entries:", error);
        }
    };

    const renderOutEntries = (stats) => {
        if (!outEntriesList) return;
        outEntriesList.innerHTML = '';

        if (countCurrentlyOut) countCurrentlyOut.textContent = stats.currently_out || 0;
        if (countOutToday) countOutToday.textContent = stats.total_today || 0;
        if (countOutOfficial) countOutOfficial.textContent = stats.official_today || 0;
        if (countOutPersonal) countOutPersonal.textContent = stats.personal_today || 0;

        if (outEntriesCache.length === 0) {
            outEntriesList.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--text-muted);">No out entry / gate pass records found</td></tr>`;
        } else {
            outEntriesCache.forEach(entry => {
                const tr = document.createElement('tr');
                const outDateFormatted = new Date(entry.date).toLocaleDateString();
                
                let durationStr = '—';
                if (entry.duration_minutes > 0) {
                    const hrs = Math.floor(entry.duration_minutes / 60);
                    const mins = entry.duration_minutes % 60;
                    durationStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins} mins`;
                }

                let statusBadge = '';
                if (entry.status === 'Out') {
                    statusBadge = `<span class="status-pill pending" style="background:#fef3c7; color:#b45309; font-weight:800;"><i class="fa-solid fa-person-walking-arrow-right"></i> OUT</span>`;
                } else if (entry.status === 'Returned') {
                    statusBadge = `<span class="status-pill progress" style="background:#dcfce7; color:#15803d; font-weight:800;"><i class="fa-solid fa-clock-rotate-left"></i> RETURNED</span>`;
                } else if (entry.status === 'Approved') {
                    statusBadge = `<span class="status-pill progress"><i class="fa-solid fa-circle-check"></i> APPROVED</span>`;
                } else if (entry.status === 'Rejected') {
                    statusBadge = `<span class="status-pill delayed"><i class="fa-solid fa-circle-xmark"></i> REJECTED</span>`;
                }

                let purposeBadge = '';
                if (entry.purpose === 'Official Duty' || entry.purpose === 'Client Visit' || entry.purpose === 'Bank Work') {
                    purposeBadge = `<span class="badge" style="background:rgba(59,130,246,0.15); color:#2563eb; font-weight:700; padding:3px 8px; border-radius:6px;"><i class="fa-solid fa-briefcase"></i> ${entry.purpose}</span>`;
                } else {
                    purposeBadge = `<span class="badge" style="background:rgba(168,85,247,0.15); color:#9333ea; font-weight:700; padding:3px 8px; border-radius:6px;"><i class="fa-solid fa-user"></i> ${entry.purpose}</span>`;
                }

                let actionBtns = `
                    <button type="button" class="btn-table-action" style="color:var(--teal-600);" onclick="openEmpOutHistoryModal(${entry.employee_id}, '${escapeQuote(entry.employee_name)}', '${entry.employee_code || ''}')" title="View Out Entry History & Export"><i class="fa-solid fa-clock-rotate-left"></i></button>
                `;
                if (entry.status === 'Out') {
                    actionBtns += `
                        <button type="button" class="btn-primary" style="padding:4px 10px; font-size:11px; border-radius:4px;" onclick="openMarkReturnModal(${entry.id}, '${entry.out_time}')" title="Mark In-Time"><i class="fa-solid fa-clock-rotate-left"></i> Return</button>
                        <button type="button" class="btn-table-action" style="color:var(--teal-600);" onclick="updateOutStatus(${entry.id}, 'Approved')" title="Approve"><i class="fa-solid fa-check"></i></button>
                        <button type="button" class="btn-table-action" style="color:var(--red);" onclick="updateOutStatus(${entry.id}, 'Rejected')" title="Reject"><i class="fa-solid fa-xmark"></i></button>
                    `;
                } else {
                    actionBtns += `
                        <button type="button" class="btn-table-action" style="color:var(--red);" onclick="deleteOutEntryClick(${entry.id})" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
                    `;
                }

                tr.innerHTML = `
                    <td>
                        <div style="font-weight:700; color:var(--text-dark);">${entry.employee_name || 'Unknown'}</div>
                        <div style="font-size:11px; color:var(--text-muted);">${entry.employee_code || ''} ${entry.department ? '• ' + entry.department : ''}</div>
                    </td>
                    <td>${outDateFormatted}</td>
                    <td><strong style="color:#d97706;">${entry.out_time || '—'}</strong></td>
                    <td><strong style="color:#059669;">${entry.in_time || '—'}</strong></td>
                    <td><strong>${durationStr}</strong></td>
                    <td>${purposeBadge}</td>
                    <td>
                        <div style="font-weight:600; font-size:12.5px;">${entry.destination || '—'}</div>
                        <div style="font-size:11px; color:var(--text-muted);">${entry.reason || ''}</div>
                    </td>
                    <td>${statusBadge}</td>
                    <td><span style="font-size:12px; color:var(--text-muted);">${entry.approver_name || '—'}</span></td>
                    <td>
                        <div style="display:flex; align-items:center; gap:6px;">
                            ${actionBtns}
                        </div>
                    </td>
                `;
                outEntriesList.appendChild(tr);
            });
        }
    };

    // Out Entry Form Submit
    if (outEntryForm) {
        outEntryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                employeeId: outEmployee.value,
                date: outDate.value,
                outTime: outTimeVal.value,
                inTime: document.getElementById('in-time-val').value || null,
                purpose: document.getElementById('out-purpose').value,
                destination: document.getElementById('out-destination').value.trim(),
                reason: document.getElementById('out-reason').value.trim()
            };

            try {
                const response = await fetch('/api/v1/admin/out-entries', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await response.json();
                if (response.ok && data.success) {
                    closeOutEntryModal();
                    loadOutEntries();
                } else {
                    alert(data.message || 'Error recording out entry');
                }
            } catch (error) {
                console.error("Error creating out entry:", error);
            }
        });
    }

    // Open Mark Return Modal
    window.openMarkReturnModal = (id, outTime) => {
        if (returnEntryId) returnEntryId.value = id;
        if (returnInTime) {
            const now = new Date();
            returnInTime.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        }
        if (markReturnModal) markReturnModal.classList.add('active');
    };

    // Mark Return Form Submit
    if (markReturnForm) {
        markReturnForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = returnEntryId.value;
            const payload = {
                inTime: returnInTime.value,
                remarks: document.getElementById('return-remarks').value.trim()
            };

            try {
                const response = await fetch(`/api/v1/admin/out-entries/${id}/return`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await response.json();
                if (response.ok && data.success) {
                    closeMarkReturnModal();
                    loadOutEntries();
                } else {
                    alert(data.message || 'Error recording return time');
                }
            } catch (error) {
                console.error("Error submitting return time:", error);
            }
        });
    }

    // Update Out Entry Status (Approve / Reject)
    window.updateOutStatus = async (id, status) => {
        if (!confirm(`Are you sure you want to mark this entry as ${status}?`)) return;
        try {
            const response = await fetch(`/api/v1/admin/out-entries/${id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });
            const data = await response.json();
            if (response.ok && data.success) {
                loadOutEntries();
            } else {
                alert(data.message || 'Status update failed');
            }
        } catch (error) {
            console.error("Error updating out entry status:", error);
        }
    };

    // Delete Out Entry
    window.deleteOutEntryClick = async (id) => {
        if (!confirm("Are you sure you want to delete this out entry record?")) return;
        try {
            const response = await fetch(`/api/v1/admin/out-entries/${id}`, { method: 'DELETE' });
            const data = await response.json();
            if (response.ok && data.success) {
                loadOutEntries();
            } else {
                alert(data.message || 'Deletion failed');
            }
        } catch (error) {
            console.error("Error deleting out entry:", error);
        }
    };

    if (filterOutDate) filterOutDate.addEventListener('change', loadOutEntries);
    if (filterOutPurpose) filterOutPurpose.addEventListener('change', loadOutEntries);
    if (filterOutStatus) filterOutStatus.addEventListener('change', loadOutEntries);
    if (btnRefreshOut) btnRefreshOut.addEventListener('click', loadOutEntries);

    // =========================================================================
    // 4. HOLIDAY CALENDAR MANAGEMENT
    // =========================================================================
    const loadHolidays = async () => {
        try {
            const yearVal = filterHolidayYear ? filterHolidayYear.value : '2026';
            const typeVal = filterHolidayType ? filterHolidayType.value : 'All';
            const searchVal = filterHolidaySearch ? filterHolidaySearch.value.trim() : '';

            let query = '/api/v1/holidays?';
            if (yearVal) query += `year=${yearVal}&`;
            if (typeVal && typeVal !== 'All') query += `type=${encodeURIComponent(typeVal)}&`;
            if (searchVal) query += `search=${encodeURIComponent(searchVal)}&`;

            if (holidaysList) {
                holidaysList.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading holidays...</td></tr>';
            }

            const response = await fetch(query);
            const data = await response.json();
            if (response.ok && data.success) {
                holidaysCache = data.data || [];
                renderHolidays(data.stats || {});
            } else {
                if (holidaysList) holidaysList.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--red);">${data.message || 'Error loading holidays'}</td></tr>`;
            }
        } catch (error) {
            console.error("Error loading holidays:", error);
            if (holidaysList) holidaysList.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--red);">Error connecting to holidays service.</td></tr>';
        }
    };

    const renderHolidays = (stats) => {
        if (!holidaysList) return;
        holidaysList.innerHTML = '';

        if (countHolidaysTotal) countHolidaysTotal.textContent = stats.total_holidays || 0;
        if (countHolidaysMandatory) countHolidaysMandatory.textContent = stats.mandatory_count || 0;
        if (countHolidaysOptional) countHolidaysOptional.textContent = stats.optional_count || 0;
        if (countHolidayNext) {
            if (stats.next_holiday) {
                countHolidayNext.innerHTML = `<span style="color:#b45309;">${stats.next_holiday.name}</span> <span style="font-size:12px; font-weight:600; color:var(--text-muted); display:block;">${stats.next_holiday.date} (${stats.next_holiday.day_of_week})</span>`;
            } else {
                countHolidayNext.textContent = 'None Remaining';
            }
        }

        if (holidaysCache.length === 0) {
            holidaysList.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:28px;color:var(--text-muted);">No holidays found matching selected filters.</td></tr>';
            return;
        }

        holidaysCache.forEach(h => {
            const tr = document.createElement('tr');

            // Type Badge (Clean text badges without icons)
            let typeBadge = '';
            if (h.type === 'National') {
                typeBadge = `<span class="badge" style="background:#fee2e2; color:#b91c1c; font-weight:700; padding:4px 10px; border-radius:6px;">National</span>`;
            } else if (h.type === 'Gazetted') {
                typeBadge = `<span class="badge" style="background:#e0f2fe; color:#0369a1; font-weight:700; padding:4px 10px; border-radius:6px;">Gazetted</span>`;
            } else if (h.type === 'Festival') {
                typeBadge = `<span class="badge" style="background:#fef3c7; color:#b45309; font-weight:700; padding:4px 10px; border-radius:6px;">Festival</span>`;
            } else if (h.type === 'Restricted') {
                typeBadge = `<span class="badge" style="background:#f3e8ff; color:#7e22ce; font-weight:700; padding:4px 10px; border-radius:6px;">Restricted</span>`;
            } else {
                typeBadge = `<span class="badge" style="background:#f1f5f9; color:#475569; font-weight:700; padding:4px 10px; border-radius:6px;">${h.type || 'Holiday'}</span>`;
            }

            // Status Badge
            let statusBadge = '';
            if (h.status === 'Today') {
                statusBadge = `<span class="status-pill progress" style="background:#dcfce7; color:#15803d; font-weight:800;"><i class="fa-solid fa-bell"></i> TODAY</span>`;
            } else if (h.status === 'Upcoming') {
                statusBadge = `<span class="status-pill pending" style="background:#ecfdf5; color:#047857; font-weight:700;"><i class="fa-solid fa-clock"></i> Upcoming</span>`;
            } else {
                statusBadge = `<span class="status-pill" style="background:#f1f5f9; color:#64748b;"><i class="fa-solid fa-check"></i> Past</span>`;
            }

            // Nature
            let natureBadge = h.is_optional 
                ? `<span style="color:#7e22ce; font-weight:700; font-size:12px;"><i class="fa-solid fa-circle-question"></i> Optional</span>`
                : `<span style="color:#059669; font-weight:700; font-size:12px;"><i class="fa-solid fa-circle-check"></i> Mandatory</span>`;

            tr.innerHTML = `
                <td>
                    <div style="font-weight:700; color:var(--text-dark); font-size:13.5px;">${h.name}</div>
                    <div style="font-size:11px; color:var(--text-muted);">Year ${h.year}</div>
                </td>
                <td><strong style="color:#334155;">${h.date}</strong></td>
                <td><span style="font-weight:600; color:#475569;">${h.day_of_week}</span></td>
                <td>${typeBadge}</td>
                <td>${statusBadge}</td>
                <td>${natureBadge}</td>
                <td><span style="font-size:12px; color:var(--text-muted);">${h.description || '—'}</span></td>
                <td style="text-align:right;">
                    <div style="display:inline-flex; align-items:center; gap:6px;">
                        <button type="button" class="btn-table-action" style="color:var(--teal-600);" onclick="editHolidayClick(${h.id})" title="Edit Holiday"><i class="fa-solid fa-pen-to-square"></i></button>
                        <button type="button" class="btn-table-action" style="color:var(--red);" onclick="deleteHolidayClick(${h.id})" title="Delete Holiday"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                </td>
            `;
            holidaysList.appendChild(tr);
        });
    };

    // Open/Close Add/Edit Holiday Modal
    const openAddHolidayModal = () => {
        if (holidayForm) holidayForm.reset();
        if (holidayIdInput) holidayIdInput.value = '';
        if (holidayModalTitle) holidayModalTitle.innerHTML = '<i class="fa-solid fa-calendar-plus" style="color:var(--teal-600); margin-right:6px;"></i> Add Official Holiday';
        if (holidayDateInput) holidayDateInput.value = today;
        if (holidayModal) holidayModal.classList.add('active');
    };

    const closeHolidayModalFunc = () => {
        if (holidayModal) holidayModal.classList.remove('active');
    };

    if (btnAddHoliday) btnAddHoliday.addEventListener('click', openAddHolidayModal);
    if (holidayModalClose) holidayModalClose.addEventListener('click', closeHolidayModalFunc);
    if (holidayCancelBtn) holidayCancelBtn.addEventListener('click', closeHolidayModalFunc);

    if (holidayForm) {
        holidayForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = holidayIdInput ? holidayIdInput.value : '';
            const payload = {
                name: holidayNameInput.value.trim(),
                date: holidayDateInput.value,
                type: holidayTypeInput.value,
                isOptional: holidayIsOptionalInput.checked,
                description: holidayDescInput.value.trim()
            };

            const url = id ? `/api/v1/holidays/${id}` : '/api/v1/holidays';
            const method = id ? 'PUT' : 'POST';

            try {
                const response = await fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await response.json();
                if (response.ok && data.success) {
                    closeHolidayModalFunc();
                    loadHolidays();
                } else {
                    alert(data.message || 'Failed to save holiday');
                }
            } catch (err) {
                console.error("Error saving holiday:", err);
                alert("Error saving holiday: " + err.message);
            }
        });
    }

    window.editHolidayClick = (id) => {
        const holiday = holidaysCache.find(h => h.id === id);
        if (!holiday) return;
        if (holidayIdInput) holidayIdInput.value = holiday.id;
        if (holidayNameInput) holidayNameInput.value = holiday.name;
        if (holidayDateInput) holidayDateInput.value = holiday.date;
        if (holidayTypeInput) holidayTypeInput.value = holiday.type;
        if (holidayIsOptionalInput) holidayIsOptionalInput.checked = Boolean(holiday.is_optional);
        if (holidayDescInput) holidayDescInput.value = holiday.description || '';
        if (holidayModalTitle) holidayModalTitle.innerHTML = '<i class="fa-solid fa-pen-to-square" style="color:var(--teal-600); margin-right:6px;"></i> Edit Holiday';
        if (holidayModal) holidayModal.classList.add('active');
    };

    window.deleteHolidayClick = async (id) => {
        if (!confirm("Are you sure you want to delete this holiday record?")) return;
        try {
            const response = await fetch(`/api/v1/holidays/${id}`, { method: 'DELETE' });
            const data = await response.json();
            if (response.ok && data.success) {
                loadHolidays();
            } else {
                alert(data.message || 'Failed to delete holiday');
            }
        } catch (err) {
            console.error("Error deleting holiday:", err);
        }
    };

    if (filterHolidayYear) filterHolidayYear.addEventListener('change', loadHolidays);
    if (filterHolidayType) filterHolidayType.addEventListener('change', loadHolidays);
    if (filterHolidaySearch) {
        let hSearchTimer;
        filterHolidaySearch.addEventListener('input', () => {
            clearTimeout(hSearchTimer);
            hSearchTimer = setTimeout(loadHolidays, 300);
        });
    }
    if (btnRefreshHolidays) btnRefreshHolidays.addEventListener('click', loadHolidays);

    if (btnExportHolidaysCSV) {
        btnExportHolidaysCSV.addEventListener('click', () => {
            if (!holidaysCache || holidaysCache.length === 0) {
                alert("No holidays to export.");
                return;
            }
            const headers = ["Holiday Name", "Date", "Day of Week", "Category", "Status", "Is Optional", "Description", "Year"];
            const rows = holidaysCache.map(h => [
                h.name,
                h.date,
                h.day_of_week,
                h.type,
                h.status,
                h.is_optional ? 'Yes' : 'No',
                h.description || '',
                h.year
            ]);

            const csvContent = "\uFEFF" + [
                headers.map(h => `"${h}"`).join(','),
                ...rows.map(row => row.map(val => `"${String(val ?? '').replace(/"/g, '""')}"`).join(','))
            ].join('\r\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.setAttribute('download', `Official_Holidays_${filterHolidayYear ? filterHolidayYear.value : '2026'}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }

    // =========================================================================
    // 5. MONTHLY PCS ATTENDANCE SUMMARY (STORED PROCEDURE ENGINE)
    // =========================================================================
    const loadPcsMonthlySummary = async () => {
        if (!pcsSummaryList) return;
        pcsSummaryList.innerHTML = '<tr><td colspan="12" style="text-align:center; padding:24px; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading monthly summary...</td></tr>';

        try {
            const selectedMonth = (filterPcsMonth && filterPcsMonth.value) ? filterPcsMonth.value.replace('-', '') : new Date().toISOString().slice(0, 7).replace('-', '');
            const response = await fetch(`/api/v1/attendance/pcs/monthly-summary?month=${selectedMonth}`);
            const data = await response.json();
            
            if (!response.ok || !data.success) {
                pcsSummaryList.innerHTML = `<tr><td colspan="12" style="text-align:center; padding:24px; color:var(--red);">${data.message || 'Failed to load summary'}</td></tr>`;
                return;
            }

            const rows = data.data || [];
            if (rows.length === 0) {
                pcsSummaryList.innerHTML = '<tr><td colspan="12" style="text-align:center; padding:24px; color:var(--text-muted);">No PCS calculated records for this month. Click "Calculate Attendance" to run rule engine.</td></tr>';
                return;
            }

            pcsSummaryList.innerHTML = '';
            rows.forEach(row => {
                const tr = document.createElement('tr');
                const empDisplayName = row.full_name || row.USERNAME;
                const empSub = row.employee_code ? `${row.employee_code} • ${row.USERNAME}` : row.USERNAME;
                const empId = row.employee_id || row.EMPLOYEE_ID;

                tr.innerHTML = `
                    <td>
                        <div style="font-weight:700; color:var(--text-dark);">${empDisplayName}</div>
                        <div style="font-size:11px; color:var(--text-muted);">${empSub}</div>
                    </td>
                    <td><strong style="color:#334155;">${row.YYYYMM}</strong></td>
                    <td>${row.TOTALDAYS}</td>
                    <td><span class="badge" style="background:rgba(16,185,129,0.15); color:#059669; font-weight:700; padding:3px 8px; border-radius:6px;">${row.PRESENT || 0}</span></td>
                    <td><span class="badge" style="background:rgba(239,68,68,0.15); color:#dc2626; font-weight:700; padding:3px 8px; border-radius:6px;">${row.ABSENT || 0}</span></td>
                    <td><span class="badge" style="background:rgba(59,130,246,0.15); color:#2563eb; font-weight:700; padding:3px 8px; border-radius:6px;">${row.LEAVE || 0}</span></td>
                    <td style="color:${row.LATINTIME && row.LATINTIME !== '00:00' ? '#d97706' : 'inherit'}; font-weight:${row.LATINTIME && row.LATINTIME !== '00:00' ? '700' : 'normal'};">${row.LATINTIME || '00:00'}</td>
                    <td style="color:${row.PREOUTTIME && row.PREOUTTIME !== '00:00' ? '#dc2626' : 'inherit'}; font-weight:${row.PREOUTTIME && row.PREOUTTIME !== '00:00' ? '700' : 'normal'};">${row.PREOUTTIME || '00:00'}</td>
                    <td><strong>${row.WORKIMGHR || '00:00'}</strong></td>
                    <td style="color:#059669; font-weight:700;">${row.OTHOURS || '00:00'}</td>
                    <td><strong>${row.LOGIMHOURS || '00:00'}</strong></td>
                    <td>
                        <button type="button" class="btn-table-action" onclick="event.stopPropagation(); openEmpAttendanceHistoryModal(${empId}, '${escapeQuote(empDisplayName)}', '${row.employee_code || ''}', '${row.USERNAME}')" title="View Full History & Export CSV" style="color:var(--teal-600);"><i class="fa-solid fa-clock-rotate-left"></i></button>
                    </td>
                `;
                tr.style.cursor = 'pointer';
                tr.addEventListener('click', (e) => {
                    if (e.target.closest('button')) return;
                    openEmpAttendanceHistoryModal(empId, empDisplayName, row.employee_code, row.USERNAME);
                });
                pcsSummaryList.appendChild(tr);
            });
        } catch (error) {
            console.error("Error loading PCS monthly summary:", error);
            pcsSummaryList.innerHTML = '<tr><td colspan="12" style="text-align:center; padding:24px; color:var(--red);">Failed to load monthly summary.</td></tr>';
        }
    };

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

    // =========================================================================
    // 5. EMPLOYEE HISTORY & CSV / EXCEL EXPORT MODAL CONTROLLER
    // =========================================================================
    let currentModalType = 'attendance'; // 'attendance' | 'leave' | 'out_entry'
    let currentEmpId = null;
    let currentEmpName = '';
    let currentEmpCode = '';
    let currentEmpWorkstation = '';
    let currentHistoryData = [];

    const empHistoryModal = document.getElementById('emp-history-modal');
    const empHistoryClose = document.getElementById('emp-history-close');
    const histEmpName = document.getElementById('hist-emp-name');
    const histEmpSub = document.getElementById('hist-emp-sub');
    const histRangeSelect = document.getElementById('hist-range-select');
    const histSearchInput = document.getElementById('hist-search-input');
    const btnExportEmpHistory = document.getElementById('btn-export-emp-history');
    const histTableHead = document.getElementById('hist-table-head');
    const histTableBody = document.getElementById('hist-table-body');
    const histKpiBar = document.getElementById('hist-kpi-bar');
    const histKpiTotal = document.getElementById('hist-kpi-total');
    const histKpiPresent = document.getElementById('hist-kpi-present');
    const histKpiLate = document.getElementById('hist-kpi-late');
    const histKpiAbsent = document.getElementById('hist-kpi-absent');
    const histKpiHours = document.getElementById('hist-kpi-hours');

    function escapeQuote(str) {
        return String(str || '').replace(/'/g, "\\'");
    }

    const closeEmpHistoryModal = () => {
        if (empHistoryModal) {
            empHistoryModal.classList.remove('active');
            empHistoryModal.style.display = 'none';
        }
        currentHistoryData = [];
    };
    window.closeEmpHistoryModal = closeEmpHistoryModal;
    window.closeEmployeeLogsModal = closeEmpHistoryModal;

    if (empHistoryClose) empHistoryClose.addEventListener('click', closeEmpHistoryModal);
    if (empHistoryModal) {
        empHistoryModal.addEventListener('click', (e) => {
            if (e.target === empHistoryModal) closeEmpHistoryModal();
        });
    }

    const histEmpAvatar = document.getElementById('hist-emp-avatar');
    const histEmpCode = document.getElementById('hist-emp-code');
    const histEmpWorkstation = document.getElementById('hist-emp-workstation');
    const histEmpOs = document.getElementById('hist-emp-os');
    const histEmpIp = document.getElementById('hist-emp-ip');
    const histEmpAgent = document.getElementById('hist-emp-agent');
    const histEmpStatus = document.getElementById('hist-emp-status');

    window.openEmpAttendanceHistoryModal = async (empId, empName, empCode, workstation) => {
        if (!empId) {
            alert("No employee record linked.");
            return;
        }
        currentModalType = 'attendance';
        currentEmpId = empId;
        currentEmpName = empName || 'Employee';
        currentEmpCode = empCode || `EMP-${String(empId).padStart(4, '0')}`;
        currentEmpWorkstation = workstation && workstation !== '—' ? workstation : 'PC-WORKSTATION';

        if (histEmpAvatar) histEmpAvatar.src = `https://i.pravatar.cc/80?img=${(empId % 65) + 1}`;
        if (histEmpName) histEmpName.textContent = currentEmpName;
        if (histEmpCode) histEmpCode.textContent = currentEmpCode;
        if (histEmpWorkstation) histEmpWorkstation.innerHTML = `<i class="fa-solid fa-desktop" style="color:#047857; margin-right:4px;"></i> ${currentEmpWorkstation}`;
        if (histEmpOs) histEmpOs.innerHTML = `<i class="fa-brands fa-windows" style="color:#0284c7; margin-right:4px;"></i> Microsoft Windows 11 Pro 64-bit`;
        if (histEmpIp) histEmpIp.textContent = `192.168.1.${100 + (empId % 100)}`;
        if (histEmpAgent) histEmpAgent.textContent = `v26.27.4174`;
        if (histEmpStatus) {
            histEmpStatus.innerHTML = `<span style="width:8px; height:8px; border-radius:50%; background:#16a34a; display:inline-block;"></span> Online (Active)`;
            histEmpStatus.style.background = '#dcfce7';
            histEmpStatus.style.color = '#15803d';
        }

        if (histRangeSelect) {
            histRangeSelect.style.display = 'inline-block';
            histRangeSelect.value = '30days';
        }
        if (histCustomDates) histCustomDates.style.display = 'none';
        if (histStartDate) histStartDate.value = today;
        if (histEndDate) histEndDate.value = today;
        if (histSearchInput) histSearchInput.value = '';
        if (histKpiBar) histKpiBar.style.display = 'grid';

        if (empHistoryModal) {
            empHistoryModal.style.display = 'flex';
            empHistoryModal.classList.add('active');
        }
        await loadModalHistoryData();
    };

    window.openEmpLeaveHistoryModal = (empId, empName, empCode) => {
        currentModalType = 'leave';
        currentEmpId = empId;
        currentEmpName = empName || 'Employee';
        currentEmpCode = empCode || `EMP-${String(empId).padStart(4, '0')}`;

        if (histEmpAvatar) histEmpAvatar.src = `https://i.pravatar.cc/80?img=${(empId % 65) + 1}`;
        if (histEmpName) histEmpName.textContent = `${currentEmpName} — Leave Records`;
        if (histEmpCode) histEmpCode.textContent = currentEmpCode;
        if (histEmpWorkstation) histEmpWorkstation.innerHTML = `<i class="fa-solid fa-umbrella-beach" style="color:#0284c7; margin-right:4px;"></i> Leave Register`;
        if (histRangeSelect) histRangeSelect.style.display = 'none';
        if (histCustomDates) histCustomDates.style.display = 'none';
        if (histSearchInput) histSearchInput.value = '';
        if (histKpiBar) histKpiBar.style.display = 'none';

        if (empHistoryModal) {
            empHistoryModal.style.display = 'flex';
            empHistoryModal.classList.add('active');
        }
        renderModalLeaveData();
    };

    window.openEmpOutHistoryModal = (empId, empName, empCode) => {
        currentModalType = 'out_entry';
        currentEmpId = empId;
        currentEmpName = empName || 'Employee';
        currentEmpCode = empCode || `EMP-${String(empId).padStart(4, '0')}`;

        if (histEmpAvatar) histEmpAvatar.src = `https://i.pravatar.cc/80?img=${(empId % 65) + 1}`;
        if (histEmpName) histEmpName.textContent = `${currentEmpName} — Gate Pass / Out Entries`;
        if (histEmpCode) histEmpCode.textContent = currentEmpCode;
        if (histEmpWorkstation) histEmpWorkstation.innerHTML = `<i class="fa-solid fa-person-walking-arrow-right" style="color:#ea580c; margin-right:4px;"></i> Duty Movement Logs`;
        if (histRangeSelect) histRangeSelect.style.display = 'none';
        if (histCustomDates) histCustomDates.style.display = 'none';
        if (histSearchInput) histSearchInput.value = '';
        if (histKpiBar) histKpiBar.style.display = 'none';

        if (empHistoryModal) {
            empHistoryModal.style.display = 'flex';
            empHistoryModal.classList.add('active');
        }
        renderModalOutData();
    };

    const histCustomDates = document.getElementById('hist-custom-dates');
    const histStartDate = document.getElementById('hist-start-date');
    const histEndDate = document.getElementById('hist-end-date');

    async function loadModalHistoryData() {
        if (!histTableBody) return;
        histTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:32px; color:var(--text-muted); font-size:14px;"><i class="fa-solid fa-spinner fa-spin" style="font-size:20px; display:block; margin-bottom:10px; color:var(--teal-900);"></i>Fetching telemetry attendance logs...</td></tr>';

        try {
            const range = histRangeSelect ? histRangeSelect.value : '30days';
            let url = `/api/v1/admin/attendance/employee/${currentEmpId}/history?range=${range}`;
            if (range === 'custom') {
                const s = histStartDate && histStartDate.value ? histStartDate.value : today;
                const e = histEndDate && histEndDate.value ? histEndDate.value : s;
                url = `/api/v1/admin/attendance/employee/${currentEmpId}/history?startDate=${s}&endDate=${e}`;
            }

            const resp = await fetch(url);
            const data = await resp.json();

            if (!resp.ok || !data.success) {
                histTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:32px; color:var(--red); font-size:14px;">${data.message || 'Error loading history'}</td></tr>`;
                return;
            }

            currentHistoryData = data.data || [];
            const summary = data.summary || {};

            if (histKpiTotal) histKpiTotal.textContent = summary.totalDays || currentHistoryData.length;
            if (histKpiPresent) histKpiPresent.textContent = summary.present || 0;
            if (histKpiLate) histKpiLate.textContent = summary.late || 0;
            if (histKpiAbsent) histKpiAbsent.textContent = summary.absent || 0;
            if (histKpiHours) histKpiHours.textContent = formatHoursMins(summary.totalHours, false);

            renderModalAttendanceTable();
        } catch (e) {
            console.error("Modal history load error:", e);
            histTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:32px; color:var(--red); font-size:14px;">Failed to load telemetry history.</td></tr>';
        }
    }

    function renderModalAttendanceTable(filterQuery = '') {
        if (!histTableHead || !histTableBody) return;
        histTableHead.innerHTML = `
            <th style="padding:12px 16px; white-space:nowrap; width:130px;">Date</th>
            <th style="padding:12px 16px; white-space:nowrap; width:120px;">Check-In</th>
            <th style="padding:12px 16px; white-space:nowrap; width:120px;">Check-Out</th>
            <th style="padding:12px 16px; white-space:nowrap; width:140px;">Break (Start-End)</th>
            <th style="padding:12px 16px; white-space:nowrap; width:130px;">Overtime (OVT)</th>
            <th style="padding:12px 16px; white-space:nowrap; width:130px;">Working Hours</th>
            <th style="padding:12px 16px; white-space:nowrap; text-align:center; width:110px;">Status</th>
            <th style="padding:12px 16px; white-space:nowrap; text-align:center; width:130px;">Punch Source</th>
        `;

        let list = currentHistoryData;
        if (filterQuery) {
            const q = filterQuery.toLowerCase();
            list = list.filter(r => (r.date && r.date.toLowerCase().includes(q)) || (r.status && r.status.toLowerCase().includes(q)) || (r.source && r.source.toLowerCase().includes(q)));
        }

        if (list.length === 0) {
            histTableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:32px; color:var(--text-muted); font-size:14px;"><i class="fa-solid fa-calendar-xmark" style="font-size:24px; display:block; margin-bottom:8px; color:#94a3b8;"></i>No attendance records found for this period.</td></tr>';
            return;
        }

        histTableBody.innerHTML = '';
        list.forEach(r => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #f1f5f9';
            tr.style.fontSize = '13px';

            let statusBadge = '<span class="status-pill delayed" style="background:#fee2e2; color:#b91c1c; font-weight:800; padding:4px 10px; border-radius:6px;">Absent</span>';
            if (r.status === 'Present') {
                statusBadge = '<span class="status-pill progress" style="background:#dcfce7; color:#15803d; font-weight:800; padding:4px 10px; border-radius:6px;">Present</span>';
            } else if (r.status === 'Late') {
                statusBadge = '<span class="status-pill pending" style="background:#fef3c7; color:#b45309; font-weight:800; padding:4px 10px; border-radius:6px;">Late</span>';
            } else if (r.status === 'On Leave' || r.status === 'Half Day') {
                statusBadge = `<span class="status-pill todo" style="background:#e0f2fe; color:#0369a1; font-weight:800; padding:4px 10px; border-radius:6px;">${r.status}</span>`;
            }

            let srcBadge = '<span style="font-size:11px; background:#e0f2fe; color:#0369a1; padding:3px 8px; border-radius:6px; font-weight:700;"><i class="fa-solid fa-desktop"></i> Workstation</span>';
            if (r.source === 'PORTAL') {
                srcBadge = '<span style="font-size:11px; background:#dcfce7; color:#15803d; padding:3px 8px; border-radius:6px; font-weight:700;"><i class="fa-solid fa-hand-pointer"></i> Web Punch</span>';
            } else if (r.source === 'MANUAL_HR') {
                srcBadge = '<span style="font-size:11px; background:#f3e8ff; color:#7e22ce; padding:3px 8px; border-radius:6px; font-weight:700;"><i class="fa-solid fa-pen-fancy"></i> HR Approved</span>';
            } else if (r.source === 'LEAVE_MANAGEMENT') {
                srcBadge = '<span style="font-size:11px; background:#fef3c7; color:#b45309; padding:3px 8px; border-radius:6px; font-weight:700;"><i class="fa-solid fa-umbrella-beach"></i> Leave</span>';
            }

            const getModalBreakHtml = (l) => {
                if (l.is_on_break) {
                    let bStartStr = '';
                    if (l.break_start) {
                        try {
                            const d = new Date(l.break_start);
                            if (!isNaN(d.getTime())) bStartStr = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                        } catch (e) {}
                    }
                    return `
                        <div>
                            <span class="status-pill pending" style="background:#fef3c7; color:#b45309; font-weight:800; font-size:10.5px; padding:2px 7px; border-radius:5px; display:inline-flex; align-items:center; gap:4px;">
                                <i class="fa-solid fa-mug-hot"></i> On Break
                            </span>
                            ${bStartStr ? `<div style="font-size:11px; color:#92400e; font-weight:700; margin-top:2px;">Since ${bStartStr}</div>` : ''}
                        </div>
                    `;
                }

                const totalSec = parseInt(l.total_break_seconds || 0, 10);
                const breakTimeNum = parseFloat(l.break_time || 0);

                let bHistory = [];
                if (l.break_history) {
                    try {
                        bHistory = typeof l.break_history === 'string' ? JSON.parse(l.break_history) : l.break_history;
                    } catch (e) {
                        bHistory = [];
                    }
                }

                if (Array.isArray(bHistory) && bHistory.length > 0) {
                    const firstBreak = bHistory[0];
                    const lastBreak = bHistory[bHistory.length - 1];
                    
                    const formatBTime = (iso) => {
                        if (!iso) return '';
                        try {
                            const d = new Date(iso);
                            return !isNaN(d.getTime()) ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
                        } catch (e) { return ''; }
                    };

                    const startStr = formatBTime(firstBreak.start);
                    const endStr = formatBTime(lastBreak.end || lastBreak.start);
                    const totalMin = Math.round(totalSec / 60) || Math.round(breakTimeNum);

                    return `
                        <div>
                            <div style="font-size:12px; font-weight:700; color:#334155; display:flex; align-items:center; gap:4px;">
                                <i class="fa-solid fa-mug-hot" style="color:#d97706; font-size:11px;"></i> ${startStr && endStr ? `${startStr} - ${endStr}` : (startStr || 'Break')}
                            </div>
                            <div style="font-size:11px; color:#0f766e; font-weight:700; margin-top:1px;">${totalMin > 0 ? `${totalMin} mins` : '—'}</div>
                        </div>
                    `;
                }

                if (totalSec > 0 || breakTimeNum > 0) {
                    const totalMin = Math.round(totalSec / 60) || Math.round(breakTimeNum);
                    return `
                        <div>
                            <div style="font-size:12px; font-weight:700; color:#334155; display:flex; align-items:center; gap:4px;">
                                <i class="fa-solid fa-mug-hot" style="color:#d97706; font-size:11px;"></i> ${totalMin} mins
                            </div>
                        </div>
                    `;
                }

                return '<span style="color:#94a3b8; font-weight:600;">—</span>';
            };

            const ovtHours = (r.overtime_hours && parseFloat(r.overtime_hours) > 0) ? formatHoursMins(r.overtime_hours, true) : (r.overtime ? `${r.overtime} mins` : '—');
            const workingHours = (r.working_hours && parseFloat(r.working_hours) > 0) ? formatHoursMins(r.working_hours, true) : '—';

            tr.innerHTML = `
                <td style="padding:12px 16px; font-weight:800; color:#334155;">${r.date}</td>
                <td style="padding:12px 16px; font-weight:800; color:${r.check_in !== '—' ? '#047857' : '#94a3b8'};">${r.check_in || '—'}</td>
                <td style="padding:12px 16px; font-weight:800; color:${r.check_out !== '—' ? '#0f172a' : '#94a3b8'};">${r.check_out || '—'}</td>
                <td style="padding:12px 16px;">${getModalBreakHtml(r)}</td>
                <td style="padding:12px 16px; font-weight:700; color:${parseFloat(r.overtime_hours || r.overtime || 0) > 0 ? '#b45309' : '#64748b'};">${ovtHours}</td>
                <td style="padding:12px 16px; font-weight:700; color:#0f172a;">${workingHours}</td>
                <td style="padding:12px 16px; text-align:center;">${statusBadge}</td>
                <td style="padding:12px 16px; text-align:center;">${srcBadge}</td>
            `;
            histTableBody.appendChild(tr);
        });
    }

    function renderModalLeaveData() {
        if (!histTableHead || !histTableBody) return;
        histTableHead.innerHTML = `
            <th style="padding:10px 12px; text-align:left;">Leave Type</th>
            <th style="padding:10px 12px; text-align:left;">Duration</th>
            <th style="padding:10px 12px; text-align:left;">Reason</th>
            <th style="padding:10px 12px; text-align:left;">Status</th>
        `;

        currentHistoryData = leavesCache.filter(l => l.employee_id == currentEmpId);

        if (currentHistoryData.length === 0) {
            histTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:24px; color:var(--text-muted);">No leave records found for this employee.</td></tr>';
            return;
        }

        histTableBody.innerHTML = '';
        currentHistoryData.forEach(l => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #f1f5f9';
            const sDate = new Date(l.start_date).toLocaleDateString();
            const eDate = new Date(l.end_date).toLocaleDateString();
            const statusClass = l.status === 'Approved' ? 'progress' : (l.status === 'Rejected' ? 'todo' : 'pending');

            tr.innerHTML = `
                <td style="padding:8px 12px; font-weight:700; color:var(--teal-900);">${l.leave_type}</td>
                <td style="padding:8px 12px;">${sDate} &rarr; ${eDate}</td>
                <td style="padding:8px 12px; color:var(--text-muted);">${l.reason || '—'}</td>
                <td style="padding:8px 12px;"><span class="status-pill ${statusClass}">${l.status}</span></td>
            `;
            histTableBody.appendChild(tr);
        });
    }

    function renderModalOutData() {
        if (!histTableHead || !histTableBody) return;
        histTableHead.innerHTML = `
            <th style="padding:10px 12px; text-align:left;">Date</th>
            <th style="padding:10px 12px; text-align:left;">Out Time</th>
            <th style="padding:10px 12px; text-align:left;">In Time</th>
            <th style="padding:10px 12px; text-align:left;">Duration</th>
            <th style="padding:10px 12px; text-align:left;">Purpose</th>
            <th style="padding:10px 12px; text-align:left;">Destination / Reason</th>
            <th style="padding:10px 12px; text-align:left;">Status</th>
        `;

        currentHistoryData = outEntriesCache.filter(o => o.employee_id == currentEmpId);

        if (currentHistoryData.length === 0) {
            histTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:24px; color:var(--text-muted);">No out entry records found for this employee.</td></tr>';
            return;
        }

        histTableBody.innerHTML = '';
        currentHistoryData.forEach(o => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #f1f5f9';
            const dStr = new Date(o.date).toLocaleDateString();
            let durStr = '—';
            if (o.duration_minutes > 0) {
                const hrs = Math.floor(o.duration_minutes / 60);
                const mins = o.duration_minutes % 60;
                durStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins} mins`;
            }

            tr.innerHTML = `
                <td style="padding:8px 12px; font-weight:700;">${dStr}</td>
                <td style="padding:8px 12px; font-weight:700; color:#d97706;">${o.out_time || '—'}</td>
                <td style="padding:8px 12px; font-weight:700; color:#059669;">${o.in_time || '—'}</td>
                <td style="padding:8px 12px;">${durStr}</td>
                <td style="padding:8px 12px;"><span style="font-weight:700; color:#2563eb;">${o.purpose}</span></td>
                <td style="padding:8px 12px;">${o.destination || o.reason || '—'}</td>
                <td style="padding:8px 12px;"><span class="badge" style="background:#f1f5f9; color:#334155; font-weight:700; padding:2px 6px; border-radius:4px;">${o.status}</span></td>
            `;
            histTableBody.appendChild(tr);
        });
    }

    if (histRangeSelect) {
        histRangeSelect.addEventListener('change', () => {
            if (histRangeSelect.value === 'custom') {
                if (histCustomDates) histCustomDates.style.display = 'inline-flex';
            } else {
                if (histCustomDates) histCustomDates.style.display = 'none';
            }
            if (currentModalType === 'attendance') loadModalHistoryData();
        });
    }

    if (histStartDate) {
        histStartDate.addEventListener('change', () => {
            if (currentModalType === 'attendance') loadModalHistoryData();
        });
    }

    if (histEndDate) {
        histEndDate.addEventListener('change', () => {
            if (currentModalType === 'attendance') loadModalHistoryData();
        });
    }

    if (histSearchInput) {
        histSearchInput.addEventListener('input', () => {
            if (currentModalType === 'attendance') renderModalAttendanceTable(histSearchInput.value);
        });
    }

    // Modal Export Button
    if (btnExportEmpHistory) {
        btnExportEmpHistory.addEventListener('click', () => {
            if (!currentHistoryData || currentHistoryData.length === 0) {
                alert("No data available to export.");
                return;
            }

            let headers = [];
            let rows = [];
            let filename = '';

            if (currentModalType === 'attendance') {
                headers = ["Employee Code", "Employee Name", "Workstation", "Date", "Check-In Time", "Check-Out Time", "Break (Start-End / Duration)", "Overtime (OVT)", "Total Working Hours", "Status", "Punch Source"];
                rows = currentHistoryData.map(r => {
                    let breakSummary = '—';
                    if (r.is_on_break) {
                        breakSummary = 'Currently on break';
                    } else {
                        let bHist = [];
                        try {
                            bHist = typeof r.break_history === 'string' ? JSON.parse(r.break_history) : (r.break_history || []);
                        } catch(e) {}
                        const bTotalMin = Math.round(parseInt(r.total_break_seconds || 0, 10) / 60) || Math.round(parseFloat(r.break_time || 0));
                        if (Array.isArray(bHist) && bHist.length > 0) {
                            const sTime = bHist[0].start ? new Date(bHist[0].start).toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'}) : '';
                            const eTime = bHist[bHist.length - 1].end ? new Date(bHist[bHist.length - 1].end).toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'}) : '';
                            breakSummary = `${sTime && eTime ? `${sTime} - ${eTime} ` : ''}(${bTotalMin} mins)`.trim();
                        } else if (bTotalMin > 0) {
                            breakSummary = `${bTotalMin} mins`;
                        }
                    }

                    return [
                        r.employee_code || currentEmpCode,
                        r.full_name || currentEmpName,
                        r.workstation || currentEmpWorkstation || '—',
                        r.date,
                        r.check_in || '—',
                        r.check_out || '—',
                        breakSummary,
                        (r.overtime_hours && parseFloat(r.overtime_hours) > 0) ? formatHoursMins(r.overtime_hours, true) : (r.overtime ? `${r.overtime} mins` : '—'),
                        formatHoursMins(r.working_hours, true),
                        r.status || 'Present',
                        r.source || 'TERAMIND'
                    ];
                });
                const safeName = (currentEmpName || 'Employee').replace(/[^a-zA-Z0-9]/g, '_');
                filename = `Attendance_History_${safeName}_${histRangeSelect ? histRangeSelect.value : '30days'}.csv`;
            } else if (currentModalType === 'leave') {
                headers = ["Employee Code", "Employee Name", "Leave Type", "Start Date", "End Date", "Reason", "Status"];
                rows = currentHistoryData.map(r => [
                    r.employee_code || currentEmpCode,
                    r.full_name || currentEmpName,
                    r.leave_type || 'Leave',
                    r.start_date ? String(r.start_date).split('T')[0] : '—',
                    r.end_date ? String(r.end_date).split('T')[0] : '—',
                    r.reason || '—',
                    r.status || 'Approved'
                ]);
                const safeName = (currentEmpName || 'Employee').replace(/[^a-zA-Z0-9]/g, '_');
                filename = `Leave_History_${safeName}.csv`;
            } else if (currentModalType === 'out_entry') {
                headers = ["Employee Code", "Employee Name", "Date", "Out Time", "In Time", "Duration", "Purpose", "Destination / Reason", "Status", "Approver"];
                rows = currentHistoryData.map(r => [
                    r.employee_code || currentEmpCode,
                    r.employee_name || currentEmpName,
                    r.date ? String(r.date).split('T')[0] : '—',
                    r.out_time || '—',
                    r.in_time || '—',
                    r.duration_minutes ? `${r.duration_minutes} mins` : '—',
                    r.purpose || 'Official Duty',
                    r.destination || r.reason || '—',
                    r.status || 'Out',
                    r.approver_name || '—'
                ]);
                const safeName = (currentEmpName || 'Employee').replace(/[^a-zA-Z0-9]/g, '_');
                filename = `OutEntry_History_${safeName}.csv`;
            }

            // UTF-8 BOM and literal formatting so Excel NEVER shows ####
            const csvContent = "\uFEFF" + [
                headers.map(h => `"${h}"`).join(','),
                ...rows.map(row => row.map(val => {
                    const s = String(val ?? '').replace(/"/g, '""');
                    if (/^\d{4}-\d{2}-\d{2}$/.test(s) || /^\d{2}:\d{2}(:\d{2})?$/.test(s)) {
                        return `="""${s}"""`;
                    }
                    return `"${s}"`;
                }).join(','))
            ].join('\r\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }

    // =========================================================================
    // 💼 MONTHLY PAYROLL & PRICING REGISTER (Matching Book1.xlsx Model)
    // =========================================================================
    let currentPayrollData = [];
    let currentPayrollMonth = today.substring(0, 7); // e.g. "2026-09"
    let currentPayrollDaysInMonth = 30;

    async function loadMonthlyPayroll() {
        if (!payrollMatrixTbody) return;
        payrollMatrixTbody.innerHTML = '<tr><td colspan="50" style="text-align:center; padding:36px;"><i class="fa-solid fa-spinner fa-spin" style="font-size:24px; color:var(--teal-600);"></i><div style="margin-top:10px; font-weight:700; color:#64748b; font-size:13.5px;">Calculating monthly attendance matrix & payroll formulas...</div></td></tr>';

        if (payrollMonthSelect && !payrollMonthSelect.value) {
            payrollMonthSelect.value = currentPayrollMonth;
        }
        const ym = (payrollMonthSelect && payrollMonthSelect.value) ? payrollMonthSelect.value : currentPayrollMonth;
        currentPayrollMonth = ym;

        try {
            const resp = await fetch(`/api/v1/payroll/monthly?yearMonth=${ym}`);
            const resData = await resp.json();
            if (!resp.ok || !resData.success) {
                payrollMatrixTbody.innerHTML = `<tr><td colspan="50" style="text-align:center; padding:32px; color:var(--red); font-weight:700;">${resData.message || 'Failed to load payroll records'}</td></tr>`;
                return;
            }

            currentPayrollData = resData.data || [];
            currentPayrollDaysInMonth = resData.daysInMonth || 30;
            const summary = resData.summary || {};

            if (payrollKpiGross) payrollKpiGross.textContent = `₹${(summary.totalGrossPayroll || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
            if (payrollKpiNet) payrollKpiNet.textContent = `₹${(summary.totalNetPayroll || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
            if (payrollKpiDeductions) payrollKpiDeductions.textContent = `₹${(summary.totalDeductions || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
            if (payrollKpiAvgrate) payrollKpiAvgrate.textContent = `₹${(summary.avgHourlyRate || 1000).toLocaleString('en-IN')}/hr`;

            renderPayrollMatrixTable(currentPayrollDaysInMonth);

        } catch (e) {
            console.error("Error loading payroll data:", e);
            payrollMatrixTbody.innerHTML = '<tr><td colspan="50" style="text-align:center; padding:32px; color:var(--red); font-weight:700;">Network error loading payroll records.</td></tr>';
        }
    }

    function renderPayrollMatrixTable(daysInMonth = 30) {
        if (!payrollMatrixThead || !payrollMatrixTbody) return;

        let searchFilter = (payrollSearchInput && payrollSearchInput.value) ? payrollSearchInput.value.toLowerCase().trim() : '';
        let filteredList = currentPayrollData;
        if (searchFilter) {
            filteredList = filteredList.filter(r => 
                (r.employee_name && r.employee_name.toLowerCase().includes(searchFilter)) ||
                (r.employee_code && r.employee_code.toLowerCase().includes(searchFilter)) ||
                (r.department && r.department.toLowerCase().includes(searchFilter))
            );
        }

        const [yStr, mStr] = (currentPayrollMonth || '2026-09').split('-');
        const selYear = parseInt(yStr, 10);
        const selMonth = parseInt(mStr, 10);

        // Build thead with modern light aesthetic matching the dashboard
        let thHtml = `
            <th style="padding:12px 16px; position:sticky; left:0; background:#f1f5f9; z-index:6; min-width:200px; text-align:left; color:#0f172a; border-right:1.5px solid #cbd5e1; border-bottom:2px solid #cbd5e1;">Employee</th>
            <th style="padding:12px 10px; min-width:110px; background:#f8fafc; color:#475569; border-right:1px solid #e2e8f0; border-bottom:2px solid #cbd5e1;">Salary (AO)</th>
        `;
        for (let d = 1; d <= daysInMonth; d++) {
            const dateObj = new Date(selYear, selMonth - 1, d);
            const isSunday = dateObj.getDay() === 0;
            const bgCol = isSunday ? '#fef3c7' : '#f8fafc';
            const textCol = isSunday ? '#b45309' : '#334155';
            const borderR = isSunday ? '#fde68a' : '#e2e8f0';
            thHtml += `<th style="padding:10px 2px; min-width:32px; width:32px; font-weight:800; text-align:center; color:${textCol}; background:${bgCol}; border-right:1px solid ${borderR}; border-bottom:2px solid #cbd5e1;" title="${isSunday ? 'Sunday / Week Off' : `Day ${d}`}">${d}</th>`;
        }
        thHtml += `
            <th style="padding:12px 8px; min-width:68px; background:#dcfce7; color:#15803d; border-left:1.5px solid #bbf7d0; border-right:1px solid #bbf7d0; border-bottom:2px solid #22c55e;">Present (AI)</th>
            <th style="padding:12px 8px; min-width:68px; background:#fee2e2; color:#b91c1c; border-right:1px solid #fecaca; border-bottom:2px solid #ef4444;">Absent (AK)</th>
            <th style="padding:12px 8px; min-width:68px; background:#e0f2fe; color:#0369a1; border-right:1px solid #bae6fd; border-bottom:2px solid #0ea5e9;">Leave (AL)</th>
            <th style="padding:12px 8px; min-width:85px; background:#f8fafc; color:#475569; border-right:1px solid #e2e8f0; border-bottom:2px solid #cbd5e1;">Advance (AP)</th>
            <th style="padding:12px 8px; min-width:85px; background:#f8fafc; color:#475569; border-right:1px solid #e2e8f0; border-bottom:2px solid #cbd5e1;">Loan (AR)</th>
            <th style="padding:12px 8px; min-width:85px; background:#f8fafc; color:#475569; border-right:1px solid #e2e8f0; border-bottom:2px solid #cbd5e1;">Loan Bal (AS)</th>
            <th style="padding:12px 8px; min-width:90px; background:#ecfdf5; color:#047857; border-right:1px solid #a7f3d0; border-bottom:2px solid #10b981;">Incentive (AT)</th>
            <th style="padding:12px 8px; min-width:80px; background:#f8fafc; color:#475569; border-right:1px solid #e2e8f0; border-bottom:2px solid #cbd5e1;">Late (AU)</th>
            <th style="padding:12px 8px; min-width:90px; background:#fee2e2; color:#dc2626; border-right:1px solid #fecaca; border-bottom:2px solid #ef4444;">AbsAmt (AW)</th>
            <th style="padding:12px 8px; min-width:80px; background:#f8fafc; color:#475569; border-right:1px solid #e2e8f0; border-bottom:2px solid #cbd5e1;">Mobile (AX)</th>
            <th style="padding:12px 10px; min-width:115px; background:#fefce8; font-weight:800; color:#854d0e; border-right:1px solid #fef08a; border-bottom:2px solid #eab308;">Gross Sal (AY)</th>
            <th style="padding:12px 8px; min-width:80px; background:#f8fafc; color:#475569; border-right:1px solid #e2e8f0; border-bottom:2px solid #cbd5e1;">PT/Misc (AZ)</th>
            <th style="padding:12px 14px; min-width:130px; background:#dcfce7; color:#166534; font-weight:900; border-right:1px solid #bbf7d0; border-bottom:2px solid #16a34a;">Net Salary (BA)</th>
            <th style="padding:12px 10px; min-width:115px; background:#eff6ff; color:#1e40af; font-weight:900; border-right:1px solid #bfdbfe; border-bottom:2px solid #3b82f6;">Rate (₹/hr)</th>
            <th style="padding:12px 10px; min-width:75px; background:#f8fafc; color:#475569; border-bottom:2px solid #cbd5e1;">Action</th>
        `;
        payrollMatrixThead.innerHTML = thHtml;

        if (filteredList.length === 0) {
            payrollMatrixTbody.innerHTML = `<tr><td colspan="50" style="text-align:center; padding:40px; color:#94a3b8; font-weight:700; font-size:14px;"><i class="fa-solid fa-folder-open" style="font-size:24px; margin-bottom:8px; display:block; color:#cbd5e1;"></i>No employee records found for this period.</td></tr>`;
            return;
        }

        payrollMatrixTbody.innerHTML = '';
        filteredList.forEach((r, idx) => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #e2e8f0';
            const isAlt = idx % 2 !== 0;
            tr.style.background = isAlt ? '#fafaf9' : 'white';

            const initials = (r.employee_name || 'EM').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

            let rowHtml = `
                <td class="col-sticky-emp" style="padding:12px 16px; background:${isAlt ? '#fafaf9' : 'white'};">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="width:34px; height:34px; border-radius:10px; background:linear-gradient(135deg, #0f766e, #0d9488); color:white; font-weight:800; font-size:12px; display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:0 2px 5px rgba(13,148,136,0.2);">
                            ${initials}
                        </div>
                        <div>
                            <div style="font-weight:800; color:#0f172a; font-size:13.5px; line-height:1.2;">${r.employee_name}</div>
                            <div style="font-size:11px; color:#64748b; font-weight:600; margin-top:2px;">
                                <span style="background:#e2e8f0; color:#334155; padding:1px 5px; border-radius:4px; font-weight:700;">${r.employee_code}</span> • ${r.designation || 'Staff'}
                            </div>
                        </div>
                    </div>
                </td>
                <td style="padding:10px 12px; font-weight:800; color:#1e293b; background:${isAlt ? '#f5f5f4' : '#f8fafc'}; border-right:1px solid #e2e8f0; font-feature-settings:'tnum';">
                    ₹${Number(r.base_salary || 0).toLocaleString('en-IN')}
                </td>
            `;

            for (let d = 1; d <= daysInMonth; d++) {
                const code = r.daily_matrix[d] || '—';
                const dateObj = new Date(selYear, selMonth - 1, d);
                const isSunday = dateObj.getDay() === 0;

                let badgeClass = 'status-empty';
                if (code === 'P') badgeClass = 'status-P';
                else if (code === 'W') badgeClass = 'status-W';
                else if (code === 'HL') badgeClass = 'status-HL';
                else if (code === 'H') badgeClass = 'status-H';
                else if (code === 'L') badgeClass = 'status-L';
                else if (code === 'LH') badgeClass = 'status-LH';
                else if (code === 'LP') badgeClass = 'status-LP';
                else if (code === 'A') badgeClass = 'status-A';

                rowHtml += `
                    <td style="padding:3px 1px; border-right:1px solid ${isSunday ? '#e2e8f0' : '#f1f5f9'}; background:${isSunday ? 'rgba(241, 245, 249, 0.5)' : 'transparent'};">
                        <span class="matrix-badge ${badgeClass}" title="Day ${d}: ${code}">
                            ${code}
                        </span>
                    </td>
                `;
            }

            rowHtml += `
                <td style="padding:8px 6px; font-weight:800; color:#15803d; background:#ecfdf5; border-left:1.5px solid #a7f3d0; font-size:13px;">${r.present_days}</td>
                <td style="padding:8px 6px; font-weight:800; color:#b91c1c; background:#fee2e2; font-size:13px;">${r.absent_days}</td>
                <td style="padding:8px 6px; font-weight:800; color:#0369a1; background:#e0f2fe; font-size:13px;">${r.leave_days}</td>
                <td style="padding:8px 6px; font-weight:700; color:#475569; font-feature-settings:'tnum';">${r.advance_deduction > 0 ? `₹${r.advance_deduction.toLocaleString('en-IN')}` : '<span style="color:#cbd5e1;">—</span>'}</td>
                <td style="padding:8px 6px; font-weight:700; color:#475569; font-feature-settings:'tnum';">${r.loan_deduction > 0 ? `₹${r.loan_deduction.toLocaleString('en-IN')}` : '<span style="color:#cbd5e1;">—</span>'}</td>
                <td style="padding:8px 6px; font-weight:600; color:#64748b; font-feature-settings:'tnum';">${r.loan_balance > 0 ? `₹${r.loan_balance.toLocaleString('en-IN')}` : '<span style="color:#cbd5e1;">—</span>'}</td>
                <td style="padding:8px 6px; font-weight:800; color:#059669; background:#f0fdf4; font-feature-settings:'tnum';">${r.incentive_addition > 0 ? `+₹${r.incentive_addition.toLocaleString('en-IN')}` : '<span style="color:#cbd5e1;">—</span>'}</td>
                <td style="padding:8px 6px; font-weight:700; color:#b45309; font-feature-settings:'tnum';">${r.late_hours_deduction > 0 ? `₹${r.late_hours_deduction.toLocaleString('en-IN')}` : '<span style="color:#cbd5e1;">—</span>'}</td>
                <td style="padding:8px 6px; font-weight:800; color:#dc2626; background:#fff1f2; font-feature-settings:'tnum';">${r.absent_deduction > 0 ? `₹${Number(r.absent_deduction).toLocaleString('en-IN')}` : '<span style="color:#10b981; font-weight:700;">₹0</span>'}</td>
                <td style="padding:8px 6px; font-weight:700; color:#475569; font-feature-settings:'tnum';">${r.mobile_deduction > 0 ? `₹${r.mobile_deduction.toLocaleString('en-IN')}` : '<span style="color:#cbd5e1;">—</span>'}</td>
                <td style="padding:8px 10px; font-weight:800; color:#0f172a; background:#fefce8; font-feature-settings:'tnum';">₹${Number(r.gross_salary || 0).toLocaleString('en-IN')}</td>
                <td style="padding:8px 6px; font-weight:700; color:#475569; font-feature-settings:'tnum';">${r.pt_misc_deduction > 0 ? `₹${r.pt_misc_deduction.toLocaleString('en-IN')}` : '<span style="color:#cbd5e1;">—</span>'}</td>
                <td style="padding:8px 12px; background:#ecfdf5;">
                    <span class="pill-net-salary">₹${Number(r.net_salary || 0).toLocaleString('en-IN')}</span>
                </td>
                <td style="padding:8px 10px; background:#f5f7ff;">
                    <span class="pill-hourly-rate">₹${Number(r.hourly_billing_rate || 1000).toLocaleString('en-IN')}/hr</span>
                </td>
                <td style="padding:8px 10px;">
                    <button type="button" class="btn-payroll-edit-action" onclick='openEditPayrollRatesModal(${JSON.stringify(r)})' title="Edit Rates & Financials">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                </td>
            `;

            tr.innerHTML = rowHtml;
            payrollMatrixTbody.appendChild(tr);
        });
    }

    // Modal Rates Editor
    window.openEditPayrollRatesModal = (empRecord) => {
        if (!modalPayrollRates) return;
        document.getElementById('rate-emp-id').value = empRecord.employee_id;
        document.getElementById('rate-emp-name').textContent = empRecord.employee_name;
        document.getElementById('rate-emp-code').textContent = `${empRecord.employee_code} • ${empRecord.designation || 'Staff'}`;
        document.getElementById('rate-emp-month').textContent = currentPayrollMonth;

        const initials = (empRecord.employee_name || 'EM').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
        const avEl = document.getElementById('rate-emp-avatar');
        if (avEl) avEl.textContent = initials;

        document.getElementById('rate-base-salary').value = empRecord.base_salary || 30000;
        document.getElementById('rate-hourly-billing').value = empRecord.hourly_billing_rate || 1000;
        document.getElementById('rate-advance').value = empRecord.advance_deduction || 0;
        document.getElementById('rate-loan').value = empRecord.loan_deduction || 0;
        document.getElementById('rate-loan-balance').value = empRecord.loan_balance || 0;
        document.getElementById('rate-incentive').value = empRecord.incentive_addition || 0;
        document.getElementById('rate-mobile').value = empRecord.mobile_deduction || 0;
        document.getElementById('rate-pt-misc').value = empRecord.pt_misc_deduction || 200;

        const recalcLive = () => {
            const sal = parseFloat(document.getElementById('rate-base-salary').value || 0);
            const adv = parseFloat(document.getElementById('rate-advance').value || 0);
            const loan = parseFloat(document.getElementById('rate-loan').value || 0);
            const inc = parseFloat(document.getElementById('rate-incentive').value || 0);
            const mob = parseFloat(document.getElementById('rate-mobile').value || 0);
            const pt = parseFloat(document.getElementById('rate-pt-misc').value || 0);
            const absDays = empRecord.absent_days || 0;
            const absAmt = (sal / 30) * absDays;

            const gross = sal - adv - loan;
            const net = gross + inc - mob - absAmt - pt;

            document.getElementById('preview-gross').textContent = `₹${gross.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
            document.getElementById('preview-net').textContent = `₹${net.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
        };

        ['rate-base-salary', 'rate-advance', 'rate-loan', 'rate-incentive', 'rate-mobile', 'rate-pt-misc'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.oninput = recalcLive;
        });

        recalcLive();
        modalPayrollRates.style.display = 'flex';
    };

    if (payrollRatesModalClose) {
        payrollRatesModalClose.addEventListener('click', () => {
            if (modalPayrollRates) modalPayrollRates.style.display = 'none';
        });
    }

    if (payrollRatesCancelBtn) {
        payrollRatesCancelBtn.addEventListener('click', () => {
            if (modalPayrollRates) modalPayrollRates.style.display = 'none';
        });
    }

    if (payrollRatesForm) {
        payrollRatesForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const empId = document.getElementById('rate-emp-id').value;
            const payload = {
                year_month: currentPayrollMonth,
                base_salary: parseFloat(document.getElementById('rate-base-salary').value || 0),
                hourly_rate: parseFloat(document.getElementById('rate-hourly-billing').value || 1000),
                advance_amount: parseFloat(document.getElementById('rate-advance').value || 0),
                loan_amount: parseFloat(document.getElementById('rate-loan').value || 0),
                loan_balance: parseFloat(document.getElementById('rate-loan-balance').value || 0),
                incentive_amount: parseFloat(document.getElementById('rate-incentive').value || 0),
                mobile_deduction: parseFloat(document.getElementById('rate-mobile').value || 0),
                pt_misc_deduction: parseFloat(document.getElementById('rate-pt-misc').value || 0)
            };

            const submitBtn = document.getElementById('payroll-rates-save-btn');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
            }

            try {
                const resp = await fetch(`/api/v1/payroll/employee/${empId}/rates`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const resData = await resp.json();

                if (resp.ok && resData.success) {
                    if (modalPayrollRates) modalPayrollRates.style.display = 'none';
                    if (typeof showToast === 'function') {
                        showToast("✅ Employee salary & billing rates updated successfully!", "success");
                    } else {
                        alert("Employee salary & billing rates updated successfully!");
                    }
                    loadMonthlyPayroll();
                } else {
                    alert(resData.message || "Failed to update employee rates");
                }
            } catch (err) {
                console.error("Error saving rates:", err);
                alert("Network error updating employee rates");
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save & Apply Pricing';
                }
            }
        });
    }

    // Month Select & Navigation
    if (payrollMonthSelect) {
        payrollMonthSelect.addEventListener('change', () => {
            currentPayrollMonth = payrollMonthSelect.value;
            loadMonthlyPayroll();
        });
    }

    if (btnPayrollCurrentMonth) {
        btnPayrollCurrentMonth.addEventListener('click', () => {
            currentPayrollMonth = today.substring(0, 7);
            if (payrollMonthSelect) payrollMonthSelect.value = currentPayrollMonth;
            loadMonthlyPayroll();
        });
    }

    if (btnPayrollPrevMonth) {
        btnPayrollPrevMonth.addEventListener('click', () => {
            const [y, m] = currentPayrollMonth.split('-').map(Number);
            const prevD = new Date(y, m - 2, 1);
            currentPayrollMonth = `${prevD.getFullYear()}-${String(prevD.getMonth() + 1).padStart(2, '0')}`;
            if (payrollMonthSelect) payrollMonthSelect.value = currentPayrollMonth;
            loadMonthlyPayroll();
        });
    }

    if (btnPayrollNextMonth) {
        btnPayrollNextMonth.addEventListener('click', () => {
            const [y, m] = currentPayrollMonth.split('-').map(Number);
            const nextD = new Date(y, m, 1);
            currentPayrollMonth = `${nextD.getFullYear()}-${String(nextD.getMonth() + 1).padStart(2, '0')}`;
            if (payrollMonthSelect) payrollMonthSelect.value = currentPayrollMonth;
            loadMonthlyPayroll();
        });
    }

    if (payrollSearchInput) {
        payrollSearchInput.addEventListener('input', () => {
            renderPayrollMatrixTable(currentPayrollDaysInMonth);
        });
    }

    if (btnExportPayrollCsv) {
        btnExportPayrollCsv.addEventListener('click', () => {
            window.location.href = `/api/v1/payroll/export-csv?yearMonth=${currentPayrollMonth}`;
        });
    }

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
