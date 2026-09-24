// employee-attendance.js — Clock In/Out, Live Clock, Attendance History, Out Entry / Gate Pass

(async function () {
    // --- Logout ---
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' });
            window.location.href = '/login.html';
        });
    }

    // --- Live Clock ---
    function updateClock() {
        const now = new Date();
        const clockEl = document.getElementById('live-clock');
        const dateEl = document.getElementById('live-date');
        if (clockEl) clockEl.textContent = now.toLocaleTimeString('en-IN', { hour12: false });
        if (dateEl) dateEl.textContent = now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }
    updateClock();
    setInterval(updateClock, 1000);

    function formatDateDMY(val) {
        if (!val || val === '—' || val === '-') return '—';
        if (typeof val === 'string') {
            const cleanStr = val.split('T')[0];
            if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) {
                const parts = cleanStr.split('-');
                return `${parts[2]}/${parts[1]}/${parts[0]}`;
            }
        }
        try {
            const d = new Date(val);
            if (!isNaN(d.getTime())) {
                const day = String(d.getDate()).padStart(2, '0');
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const year = d.getFullYear();
                return `${day}/${month}/${year}`;
            }
        } catch (e) {}
        return String(val);
    }

    // --- Month filter default ---
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const filterMonthEl = document.getElementById('filter-month');
    if (filterMonthEl) filterMonthEl.value = `${today.getFullYear()}-${mm}`;

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

    // --- Load today's status ---
    async function loadTodayStatus() {
        try {
            const res = await fetch('/api/v1/employee/attendance/status', { credentials: 'include' });
            const data = await res.json();
            if (!data.success) return;

            const rec = data.data;
            if (!rec || !rec.login_time) {
                setClockInState(false, null);
                const todayStatus = document.getElementById('today-status');
                if (todayStatus) todayStatus.textContent = 'Not Checked In';
                return;
            }

            // Clock In button state
            if (rec.logout_time) {
                setClockInState(false, null, true);
            } else {
                setClockInState(true, rec.login_time);
            }

            const todayStatus = document.getElementById('today-status');
            const todayHours = document.getElementById('today-hours');
            const todayCheckin = document.getElementById('today-checkin-label');

            if (todayStatus) todayStatus.textContent = rec.status || 'Present';
            if (todayHours && rec.total_hours) {
                todayHours.textContent = formatHoursMins(rec.total_hours, false);
            }
            if (todayCheckin && rec.login_time) {
                todayCheckin.textContent = 'Checked in at ' + new Date(rec.login_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
            }
        } catch (e) {
            console.error(e);
        }
    }

    function setClockInState(isIn, loginTime, isDone = false) {
        const badge = document.getElementById('clock-status-badge');
        const inBtn = document.getElementById('btn-clock-in');
        const outBtn = document.getElementById('btn-clock-out');
        const label = document.getElementById('clock-in-time');

        if (isDone) {
            if (badge) { badge.className = 'status-pill done'; badge.textContent = 'Clocked Out'; }
            if (inBtn) inBtn.disabled = true;
            if (outBtn) outBtn.disabled = true;
            if (label) label.textContent = 'Day completed';
        } else if (isIn) {
            if (badge) { badge.className = 'status-pill progress'; badge.textContent = 'Clocked In'; }
            if (inBtn) inBtn.disabled = true;
            if (outBtn) outBtn.disabled = false;
            if (label && loginTime) {
                const t = new Date(loginTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
                label.textContent = 'In: ' + t;
            }
        } else {
            if (badge) { badge.className = 'status-pill delayed'; badge.textContent = 'Not Clocked In'; }
            if (inBtn) inBtn.disabled = false;
            if (outBtn) outBtn.disabled = true;
            if (label) label.textContent = '—';
        }
    }

    // --- Clock In ---
    const btnClockIn = document.getElementById('btn-clock-in');
    if (btnClockIn) {
        btnClockIn.addEventListener('click', async () => {
            try {
                const res = await fetch('/api/v1/employee/attendance/clock-in', {
                    method: 'POST', credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({})
                });
                const data = await res.json();
                if (data.success) {
                    showToast('Clocked in successfully!', 'success');
                    await loadTodayStatus();
                    await loadAttendanceHistory();
                } else {
                    showToast(data.message || 'Clock-in failed', 'error');
                }
            } catch (e) {
                showToast('Network error', 'error');
            }
        });
    }

    // --- Clock Out ---
    const btnClockOut = document.getElementById('btn-clock-out');
    if (btnClockOut) {
        btnClockOut.addEventListener('click', async () => {
            try {
                const res = await fetch('/api/v1/employee/attendance/clock-out', {
                    method: 'POST', credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({})
                });
                const data = await res.json();
                if (data.success) {
                    showToast('Clocked out successfully!', 'success');
                    setClockInState(false, null, true);
                    await loadAttendanceHistory();
                } else {
                    showToast(data.message || 'Clock-out failed', 'error');
                }
            } catch (e) {
                showToast('Network error', 'error');
            }
        });
    }

    // --- Load Attendance History Logs ---
    async function loadAttendanceHistory(param) {
        const tbody = document.getElementById('attendance-tbody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:32px;"><i class="fa-solid fa-spinner fa-spin" style="margin-right:8px;"></i>Loading attendance records...</td></tr>';

        try {
            let url = '/api/v1/employee/attendance/history';
            if (typeof param === 'string' && param.includes('=')) {
                url += `?${param}`;
            } else if (typeof param === 'string' && param.length === 4) {
                url += `?year=${param}`;
            } else if (typeof param === 'string' && param.includes('-')) {
                const [y, m] = param.split('-');
                url += `?year=${y}&month=${m}`;
            } else if (filterMonthEl && filterMonthEl.value) {
                const [y, m] = filterMonthEl.value.split('-');
                url += `?year=${y}&month=${m}`;
            }

            const res = await fetch(url, { credentials: 'include' });
            const data = await res.json();
            if (!data.success) {
                tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--red);padding:24px;">${data.message || 'Error loading records'}</td></tr>`;
                return;
            }

            const logs = data.data || [];

            // Summary stats for present & late
            const presentCount = logs.filter(r => r.calculated_status === 'Present' || r.calculated_status === 'Late' || r.status === 'Present').length;
            const lateCount = logs.filter(r => r.calculated_status === 'Late' || r.is_late_login).length;

            const mPres = document.getElementById('month-present');
            const mLate = document.getElementById('month-late');
            if (mPres) mPres.textContent = presentCount;
            if (mLate) mLate.textContent = lateCount;

            if (!logs.length) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:32px;">No attendance records found.</td></tr>';
                return;
            }

            const todayIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

            tbody.innerHTML = logs.map(r => {
                const rawDate = typeof r.date === 'string' ? r.date.slice(0, 10) : '';
                const parts = rawDate.split('-').map(Number);
                const dateObj = parts.length === 3 ? new Date(parts[0], parts[1] - 1, parts[2]) : new Date(r.date);

                const day = dateObj.toLocaleDateString('en-IN', { weekday: 'short' });
                const dateStr = formatDateDMY(rawDate || r.date);
                const isToday = rawDate === todayIso;

                const loginStr = r.login_time ? new Date(r.login_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';
                const logoutStr = r.logout_time ? new Date(r.logout_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';
                const loginHours = (r.login_hours && parseFloat(r.login_hours) > 0) ? formatHoursMins(r.login_hours, true) : '—';
                const ovtHours = (r.overtime_hours && parseFloat(r.overtime_hours) > 0) ? formatHoursMins(r.overtime_hours, true) : '—';
                const hours = (r.total_working_hours && parseFloat(r.total_working_hours) > 0)
                    ? formatHoursMins(r.total_working_hours, true)
                    : '—';

                const status = r.calculated_status || r.status || 'Absent';
                let statusBadge = '';
                if (status === 'Present') {
                    statusBadge = '<span class="status-pill done" style="background:#dcfce7; color:#15803d; font-weight:800;"><i class="fa-solid fa-circle-check" style="font-size:10px;margin-right:4px;"></i>Present</span>';
                } else if (status === 'Late') {
                    statusBadge = '<span class="status-pill pending" style="background:#fef3c7; color:#b45309; font-weight:800;"><i class="fa-solid fa-business-time" style="font-size:10px;margin-right:4px;"></i>Late</span>';
                } else if (status === 'Holiday') {
                    statusBadge = '<span class="status-pill" style="background:#ede9fe; color:#7c3aed; font-weight:800;"><i class="fa-solid fa-umbrella-beach" style="font-size:10px;margin-right:4px;"></i>Holiday</span>';
                } else if (status === 'WeekOff') {
                    statusBadge = '<span class="status-pill" style="background:#f1f5f9; color:#64748b; font-weight:700;"><i class="fa-solid fa-bed" style="font-size:10px;margin-right:4px;"></i>WeekOff</span>';
                } else if (status === 'Upcoming') {
                    statusBadge = '<span class="status-pill" style="background:rgba(226,232,240,0.6); color:#94a3b8; font-weight:600;"><i class="fa-regular fa-clock" style="font-size:10px;margin-right:4px;"></i>Upcoming</span>';
                } else if (status === 'Out Entry' || r.punch_source === 'OUT_ENTRY' || status === 'Client Visit' || status === 'Official Duty') {
                    const label = r.out_entry?.purpose || status || 'Out Entry';
                    statusBadge = `<span class="status-pill" style="background:#ffedd5; color:#c2410c; font-weight:800;"><i class="fa-solid fa-person-walking-arrow-right" style="font-size:10px;margin-right:4px;"></i>${label}</span>`;
                } else {
                    statusBadge = '<span class="status-pill delayed" style="background:#fee2e2; color:#b91c1c; font-weight:700;"><i class="fa-solid fa-circle-xmark" style="font-size:10px;margin-right:4px;"></i>Absent</span>';
                }

                const rowHighlight = isToday ? 'style="background:rgba(16,185,129,0.07); border-left:3px solid var(--teal-600);"' : '';
                const todayTag = isToday ? '<span style="font-size:9.5px; background:var(--teal-900); color:#fff; padding:2px 6px; border-radius:4px; margin-left:6px; font-weight:800; letter-spacing:0.5px;">TODAY</span>' : '';
                const outTag = r.out_entry && r.out_entry.destination && r.out_entry.destination !== '-' 
                    ? `<div style="font-size:10.5px; color:#c2410c; font-weight:700; margin-top:2px;"><i class="fa-solid fa-location-dot"></i> ${r.out_entry.destination}</div>` 
                    : '';

                return `<tr ${rowHighlight}>
                    <td style="font-weight:700;">${dateStr}${todayTag}</td>
                    <td>${day}</td>
                    <td style="color:${r.login_time ? 'var(--teal-900)' : 'var(--text-muted)'}; font-weight:${r.login_time ? '700' : 'normal'};">${loginStr}</td>
                    <td style="color:${r.logout_time ? 'var(--teal-900)' : 'var(--text-muted)'}; font-weight:${r.logout_time ? '700' : 'normal'};">${logoutStr}</td>
                    <td style="font-weight:600; color:#334155;">${loginHours}</td>
                    <td style="font-weight:700; color:${parseFloat(r.overtime_hours || 0) > 0 ? '#b45309' : 'var(--text-muted)'};">${ovtHours}</td>
                    <td style="font-weight:700; color:var(--teal-900);">${hours}${outTag}</td>
                    <td>${statusBadge}</td>
                </tr>`;
            }).join('');
        } catch (e) {
            console.error("loadAttendanceHistory error:", e);
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--red);padding:24px;">Failed to load attendance records.</td></tr>`;
        }
    }

    window.loadAttendanceHistory = loadAttendanceHistory;
    const loadHistory = loadAttendanceHistory;

    // Quick filter toolbar actions
    const btnThisMonth = document.getElementById('btn-quick-this-month');
    const btnLastMonth = document.getElementById('btn-quick-last-month');
    const btnAll2026 = document.getElementById('btn-quick-all-2026');

    function setButtonActive(activeBtn) {
        [btnThisMonth, btnLastMonth, btnAll2026].forEach(b => {
            if (!b) return;
            if (b === activeBtn) {
                b.style.background = 'var(--teal-900)';
                b.style.color = '#ffffff';
                b.style.border = 'none';
            } else {
                b.style.background = '#f1f5f9';
                b.style.color = '#334155';
                b.style.border = '1px solid #e2e8f0';
            }
        });
    }

    if (filterMonthEl) {
        filterMonthEl.addEventListener('change', () => {
            setButtonActive(null);
            loadAttendanceHistory(filterMonthEl.value);
        });
    }

    if (btnThisMonth) {
        btnThisMonth.addEventListener('click', () => {
            const now = new Date();
            const curM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            if (filterMonthEl) filterMonthEl.value = curM;
            setButtonActive(btnThisMonth);
            loadAttendanceHistory(`year=${now.getFullYear()}&month=${String(now.getMonth() + 1).padStart(2, '0')}`);
        });
    }

    if (btnLastMonth) {
        btnLastMonth.addEventListener('click', () => {
            const now = new Date();
            now.setMonth(now.getMonth() - 1);
            const prevM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            if (filterMonthEl) filterMonthEl.value = prevM;
            setButtonActive(btnLastMonth);
            loadAttendanceHistory(`year=${now.getFullYear()}&month=${String(now.getMonth() + 1).padStart(2, '0')}`);
        });
    }

    if (btnAll2026) {
        btnAll2026.addEventListener('click', () => {
            if (filterMonthEl) filterMonthEl.value = '';
            setButtonActive(btnAll2026);
            loadAttendanceHistory('year=2026');
        });
    }

    // --- Attendance Correction Modal ---
    const btnCorrection = document.getElementById('btn-correction');
    if (btnCorrection) {
        btnCorrection.addEventListener('click', () => {
            if (window.openModal) {
                window.openModal('modal-correction');
            } else {
                const mod = document.getElementById('modal-correction');
                if (mod) {
                    mod.classList.add('active');
                    mod.style.display = 'flex';
                    mod.style.opacity = '1';
                    mod.style.pointerEvents = 'auto';
                }
            }
        });
    }

    ['close-correction', 'close-correction-2'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('click', () => {
                if (window.closeModal) {
                    window.closeModal('modal-correction');
                } else {
                    const mod = document.getElementById('modal-correction');
                    if (mod) {
                        mod.classList.remove('active');
                        mod.style.display = 'none';
                        mod.style.opacity = '0';
                    }
                }
            });
        }
    });

    const submitCorrectionBtn = document.getElementById('submit-correction');
    if (submitCorrectionBtn) {
        submitCorrectionBtn.addEventListener('click', async () => {
            const workDate = document.getElementById('correct-date').value;
            const clockIn = document.getElementById('correct-in').value;
            const clockOut = document.getElementById('correct-out').value;
            if (!workDate || !clockIn || !clockOut) {
                showToast('Please fill all fields', 'error'); return;
            }
            try {
                const res = await fetch('/api/v1/employee/attendance/correction', {
                    method: 'POST', credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ workDate, clockIn: `${workDate}T${clockIn}`, clockOut: `${workDate}T${clockOut}` })
                });
                const data = await res.json();
                if (data.success) {
                    showToast('Correction request submitted!', 'success');
                    if (window.closeModal) {
                        window.closeModal('modal-correction');
                    } else {
                        document.getElementById('modal-correction').style.display = 'none';
                    }
                } else {
                    showToast(data.message || 'Failed to submit', 'error');
                }
            } catch (e) {
                showToast('Network error', 'error');
            }
        });
    }

    // =========================================================================
    // OUT ENTRY / GATE PASS & LOCATION TRACKING PHASE 2 (EMPLOYEE SIDE)
    // =========================================================================
    const btnApplyOutEntry = document.getElementById('btn-apply-out-entry');
    const modalOutEntry = document.getElementById('modal-out-entry');
    const modalEmpReturn = document.getElementById('modal-emp-return');
    const modalVisitOtp = document.getElementById('modal-visit-otp');
    const empOutTbody = document.getElementById('emp-out-tbody');
    const btnRefreshEmpOut = document.getElementById('btn-refresh-emp-out');
    const activeVisitBanner = document.getElementById('active-visit-banner');
    const activeVisitTimer = document.getElementById('active-visit-timer');
    const activeVisitClientName = document.getElementById('active-visit-client-name');
    const activeVisitAddress = document.getElementById('active-visit-address');
    const btnActiveVisitReturn = document.getElementById('btn-active-visit-return');

    // Customer & Branch dropdowns in Out Entry modal
    const empOutPurpose = document.getElementById('emp-out-purpose');
    const clientVisitFields = document.getElementById('client-visit-fields');
    const empOutCustomer = document.getElementById('emp-out-customer');
    const empOutBranch = document.getElementById('emp-out-branch');
    const empBranchTargetInfo = document.getElementById('emp-branch-target-info');
    const empTargetAddressText = document.getElementById('emp-target-address-text');
    let customerDirectoryCache = [];

    // Periodic tracking & timer intervals
    let locationTrackingInterval = null;
    let visitDurationTimerInterval = null;
    let activeOutEntryCache = null;

    // Helper: Haversine distance in meters
    function getDistanceInMeters(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // metres
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }

    // Helper: Capture current GPS location (Native Bridge or Browser Geolocation)
    async function getCurrentGpsLocation() {
        return new Promise((resolve) => {
            // Check native MAUI bridge
            if (window.EMS && window.EMS.Native && typeof window.EMS.Native.invoke === 'function') {
                window.EMS.Native.invoke('location')
                    .then(res => {
                        if (res && res.latitude && res.longitude) {
                            resolve({ latitude: res.latitude, longitude: res.longitude });
                            return;
                        }
                    })
                    .catch(() => {});
            }

            // Standard HTML5 Geolocation
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    pos => {
                        resolve({
                            latitude: pos.coords.latitude,
                            longitude: pos.coords.longitude
                        });
                    },
                    err => {
                        console.warn("GPS Geolocation error:", err.message);
                        resolve(null);
                    },
                    { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
                );
            } else {
                resolve(null);
            }
        });
    }

    // Helper to get authentication headers
    function getAuthHeaders(customHeaders = {}) {
        const token = localStorage.getItem('token') || '';
        const headers = Object.assign({}, customHeaders);
        if (token && !headers['Authorization']) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
    }

    function parseBranches(cust) {
        if (!cust) return [];
        let branches = [];
        if (Array.isArray(cust.branches)) {
            branches = cust.branches;
        } else if (typeof cust.branches === 'string' && cust.branches.trim() !== '') {
            try {
                branches = JSON.parse(cust.branches);
            } catch (e) {
                branches = [];
            }
        }
        if ((!branches || branches.length === 0) && (cust.branch || cust.address)) {
            branches = [{
                branch: cust.branch || 'Main Office',
                address: cust.address || '',
                latitude: cust.latitude || null,
                longitude: cust.longitude || null
            }];
        }
        return Array.isArray(branches) ? branches : [];
    }

    // Fetch and cache customers for selection in Out Entry modal
    async function fetchCustomersForOutEntry() {
        if (customerDirectoryCache && customerDirectoryCache.length > 0) {
            renderCustomerDropdown();
            return;
        }

        if (empOutCustomer && (!empOutCustomer.options || empOutCustomer.options.length <= 1)) {
            empOutCustomer.innerHTML = '<option value="">Loading customers...</option>';
        }

        const headers = getAuthHeaders();
        const candidateEndpoints = [
            '/api/v1/customers',
            '/api/v1/employee/customers',
            '/api/v1/admin/customers'
        ];

        let fetchedList = null;
        for (const endpoint of candidateEndpoints) {
            try {
                const res = await fetch(endpoint, { headers, credentials: 'include' });
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.success && Array.isArray(data.data) && data.data.length > 0) {
                        fetchedList = data.data;
                        break;
                    }
                }
            } catch (err) {
                console.warn(`[OutEntry] Fetch failed for ${endpoint}:`, err.message);
            }
        }

        if (fetchedList && fetchedList.length > 0) {
            customerDirectoryCache = fetchedList;
            renderCustomerDropdown();
        } else {
            console.warn("[OutEntry] No customers returned from server.");
            if (empOutCustomer) {
                empOutCustomer.innerHTML = '<option value="">-- Choose Customer --</option>';
            }
        }
    }

    function renderCustomerDropdown() {
        if (!empOutCustomer) return;
        const currentVal = empOutCustomer.value;
        empOutCustomer.innerHTML = '<option value="">-- Choose Customer --</option>' +
            customerDirectoryCache.map(c => `<option value="${c.id}" ${String(c.id) === String(currentVal) ? 'selected' : ''}>${c.name}</option>`).join('');
    }

    // Pre-fetch customers immediately on load
    fetchCustomersForOutEntry();

    if (empOutPurpose) {
        empOutPurpose.addEventListener('change', () => {
            if (empOutPurpose.value === 'Client Visit') {
                if (clientVisitFields) clientVisitFields.style.display = 'block';
                fetchCustomersForOutEntry();
            } else {
                if (clientVisitFields) clientVisitFields.style.display = 'none';
                if (empBranchTargetInfo) empBranchTargetInfo.style.display = 'none';
            }
        });
    }

    if (empOutCustomer) {
        empOutCustomer.addEventListener('change', () => {
            const custId = empOutCustomer.value;
            if (!custId) {
                if (empOutBranch) empOutBranch.innerHTML = '<option value="">-- Choose Branch --</option>';
                if (empBranchTargetInfo) empBranchTargetInfo.style.display = 'none';
                return;
            }
            const cust = customerDirectoryCache.find(c => String(c.id) === String(custId));
            const branches = parseBranches(cust);

            if (branches.length > 0) {
                if (empOutBranch) {
                    empOutBranch.innerHTML = (branches.length > 1 ? '<option value="">-- Choose Branch --</option>' : '') +
                        branches.map((b, idx) => `<option value="${idx}">${b.branch || ('Branch ' + (idx + 1))}</option>`).join('');

                    // Automatically select if only 1 branch exists
                    if (branches.length === 1) {
                        empOutBranch.value = "0";
                        empOutBranch.dispatchEvent(new Event('change'));
                    } else {
                        if (empBranchTargetInfo) empBranchTargetInfo.style.display = 'none';
                    }
                }
            } else {
                if (empOutBranch) {
                    empOutBranch.innerHTML = '<option value="0">Main Office</option>';
                    empOutBranch.value = "0";
                    empOutBranch.dispatchEvent(new Event('change'));
                }
            }
        });
    }

    if (empOutBranch) {
        empOutBranch.addEventListener('change', () => {
            const custId = empOutCustomer.value;
            const branchIdx = empOutBranch.value;
            const cust = customerDirectoryCache.find(c => String(c.id) === String(custId));
            if (cust && branchIdx !== '') {
                const branches = parseBranches(cust);
                const b = branches[parseInt(branchIdx, 10)] || branches[0] || {};
                const branchName = b.branch || 'Main Office';
                const destInput = document.getElementById('emp-out-destination');
                if (destInput) destInput.value = `${cust.name} — ${branchName}`;
                if (b.address) {
                    if (empBranchTargetInfo) empBranchTargetInfo.style.display = 'block';
                    if (empTargetAddressText) empTargetAddressText.textContent = b.address;
                } else {
                    if (empBranchTargetInfo) empBranchTargetInfo.style.display = 'none';
                }
            }
        });
    }

    if (btnApplyOutEntry) {
        btnApplyOutEntry.addEventListener('click', () => {
            fetchCustomersForOutEntry();
            if (empOutPurpose && empOutPurpose.value === 'Client Visit' && clientVisitFields) {
                clientVisitFields.style.display = 'block';
            }
            const todayStr = new Date().toISOString().split('T')[0];
            const dateInput = document.getElementById('emp-out-date');
            const timeInput = document.getElementById('emp-out-time');
            if (dateInput) dateInput.value = todayStr;
            if (timeInput) {
                const now = new Date();
                timeInput.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            }
            if (window.openModal) {
                window.openModal('modal-out-entry');
            } else if (modalOutEntry) {
                modalOutEntry.classList.add('active');
                modalOutEntry.style.display = 'flex';
                modalOutEntry.style.opacity = '1';
                modalOutEntry.style.pointerEvents = 'auto';
            }
        });
    }

    ['close-out-modal', 'close-out-modal-2'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('click', () => {
                if (window.closeModal) {
                    window.closeModal('modal-out-entry');
                } else if (modalOutEntry) {
                    modalOutEntry.classList.remove('active');
                    modalOutEntry.style.display = 'none';
                    modalOutEntry.style.opacity = '0';
                }
            });
        }
    });

    ['close-emp-return-modal', 'close-emp-return-2'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('click', () => {
                if (window.closeModal) {
                    window.closeModal('modal-emp-return');
                } else if (modalEmpReturn) {
                    modalEmpReturn.classList.remove('active');
                    modalEmpReturn.style.display = 'none';
                    modalEmpReturn.style.opacity = '0';
                }
            });
        }
    });

    // Submit Out Entry
    const submitOutEntryBtn = document.getElementById('submit-out-entry');
    if (submitOutEntryBtn) {
        submitOutEntryBtn.addEventListener('click', async () => {
            const date = document.getElementById('emp-out-date').value;
            const purpose = document.getElementById('emp-out-purpose').value;
            const outTime = document.getElementById('emp-out-time').value;
            const inTime = document.getElementById('emp-expected-in').value;
            const destination = document.getElementById('emp-out-destination').value.trim();
            const reason = document.getElementById('emp-out-reason').value.trim();

            let customerId = null;
            let branchName = null;
            let targetLatitude = null;
            let targetLongitude = null;
            let targetAddress = null;

            if (purpose === 'Client Visit' && empOutCustomer && empOutCustomer.value) {
                customerId = empOutCustomer.value;
                const cust = customerDirectoryCache.find(c => String(c.id) === String(customerId));
                const branchIdx = empOutBranch ? empOutBranch.value : '';
                if (cust && branchIdx !== '') {
                    const branches = parseBranches(cust);
                    const b = branches[parseInt(branchIdx, 10)] || branches[0];
                    if (b) {
                        branchName = b.branch || null;
                        targetLatitude = b.latitude || null;
                        targetLongitude = b.longitude || null;
                        targetAddress = b.address || null;
                    }
                }
            }

            if (!date || !outTime || !purpose) {
                showToast('Please fill Date, Out Time and Purpose', 'error');
                return;
            }

            try {
                const res = await fetch('/api/v1/employee/out-entries', {
                    method: 'POST',
                    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
                    credentials: 'include',
                    body: JSON.stringify({ 
                        date, purpose, outTime, expectedInTime: inTime || null, destination, reason,
                        customerId, branchName, targetLatitude, targetLongitude, targetAddress 
                    })
                });
                const data = await res.json();
                if (data.success) {
                    showToast('Out entry submitted successfully!', 'success');
                    if (window.closeModal) {
                        window.closeModal('modal-out-entry');
                    } else if (modalOutEntry) {
                        modalOutEntry.style.display = 'none';
                    }
                    loadEmployeeOutEntries();
                } else {
                    showToast(data.message || 'Failed to submit', 'error');
                }
            } catch (e) {
                showToast('Network error', 'error');
            }
        });
    }

    // Push location update to server & evaluate geofence proximity
    async function trackAndEvaluateLocation(entry) {
        if (!entry || entry.status !== 'Out') return;
        const coords = await getCurrentGpsLocation();
        if (!coords) return;

        // 1. Post location to backend
        try {
            await fetch(`/api/v1/employee/out-entries/${entry.id}/track-location`, {
                method: 'POST',
                headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
                credentials: 'include',
                body: JSON.stringify({
                    latitude: coords.latitude,
                    longitude: coords.longitude
                })
            });
        } catch (e) {
            console.warn("Location tracking post error:", e);
        }

        // 2. Evaluate Geofence if client coordinates exist and OTP not verified yet
        if (entry.target_latitude && entry.target_longitude && !entry.otp_verified_at) {
            const distance = getDistanceInMeters(
                coords.latitude, coords.longitude,
                parseFloat(entry.target_latitude), parseFloat(entry.target_longitude)
            );

            // If within 150m geofence radius
            if (distance <= 150) {
                openVisitOtpModal(entry);
            }
        }
    }

    // Open Visit OTP Modal
    function openVisitOtpModal(entry) {
        const modal = document.getElementById('modal-visit-otp');
        const activeEntryIdInput = document.getElementById('visit-active-entry-id');
        const clientNameEl = document.getElementById('visit-modal-client-name');
        const errEl = document.getElementById('visit-otp-error');

        if (activeEntryIdInput) activeEntryIdInput.value = entry.id;
        if (clientNameEl) clientNameEl.textContent = `${entry.customer_name || 'Client'} (${entry.branch_name || 'Office'})`;
        if (errEl) {
            errEl.style.display = 'none';
            errEl.textContent = '';
        }

        // Clear inputs
        for (let i = 1; i <= 4; i++) {
            const box = document.getElementById(`otp-digit-${i}`);
            if (box) box.value = '';
        }

        if (modal) {
            modal.classList.add('active');
            modal.style.display = 'flex';
            setTimeout(() => document.getElementById('otp-digit-1')?.focus(), 100);
        }
    }

    function escapeQuote(str) {
        return String(str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
    }

    window.openVisitOtpModalDirect = function (entryId, customerName, branchName) {
        openVisitOtpModal({ id: entryId, customer_name: customerName, branch_name: branchName });
    };

    // Auto-advance across 4 OTP digit boxes
    for (let i = 1; i <= 4; i++) {
        const box = document.getElementById(`otp-digit-${i}`);
        if (box) {
            box.addEventListener('input', () => {
                if (box.value.length === 1 && i < 4) {
                    document.getElementById(`otp-digit-${i + 1}`)?.focus();
                }
            });
            box.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && !box.value && i > 1) {
                    document.getElementById(`otp-digit-${i - 1}`)?.focus();
                }
            });
        }
    }

    // Submit Visit OTP
    const btnSubmitVisitOtp = document.getElementById('btn-submit-visit-otp');
    if (btnSubmitVisitOtp) {
        btnSubmitVisitOtp.addEventListener('click', async () => {
            const entryId = document.getElementById('visit-active-entry-id')?.value;
            let otp = '';
            for (let i = 1; i <= 4; i++) {
                otp += (document.getElementById(`otp-digit-${i}`)?.value || '');
            }

            const errEl = document.getElementById('visit-otp-error');
            if (otp.length !== 4) {
                if (errEl) {
                    errEl.textContent = 'Please enter all 4 digits of the OTP.';
                    errEl.style.display = 'block';
                }
                return;
            }

            btnSubmitVisitOtp.disabled = true;
            btnSubmitVisitOtp.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying...';

            try {
                const res = await fetch(`/api/v1/employee/out-entries/${entryId}/verify-visit-otp`, {
                    method: 'POST',
                    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
                    credentials: 'include',
                    body: JSON.stringify({ otp })
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    showToast("Visit OTP verified! Duration timer started.", "success");
                    const modal = document.getElementById('modal-visit-otp');
                    if (modal) modal.style.display = 'none';
                    loadEmployeeOutEntries();
                } else {
                    if (errEl) {
                        errEl.textContent = data.message || 'Invalid OTP. Please verify with client.';
                        errEl.style.display = 'block';
                    }
                }
            } catch (e) {
                if (errEl) {
                    errEl.textContent = 'Network error during verification.';
                    errEl.style.display = 'block';
                }
            } finally {
                btnSubmitVisitOtp.disabled = false;
                btnSubmitVisitOtp.innerHTML = '<i class="fa-solid fa-stopwatch"></i> Verify &amp; Start Timer';
            }
        });
    }

    const btnCloseVisitOtp = document.getElementById('btn-close-visit-otp');
    if (btnCloseVisitOtp) {
        btnCloseVisitOtp.addEventListener('click', () => {
            const modal = document.getElementById('modal-visit-otp');
            if (modal) modal.style.display = 'none';
        });
    }

    // Load Employee Out Entries
    window.loadEmployeeOutEntries = async function () {
        if (!empOutTbody) return;
        empOutTbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:32px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading out entries...</td></tr>';

        try {
            const res = await fetch('/api/v1/employee/out-entries', {
                headers: getAuthHeaders(),
                credentials: 'include'
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                empOutTbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:32px;">No out entries recorded.</td></tr>';
                return;
            }

            const entries = data.data.entries || [];
            const stats = data.data.stats || {};
            const today = new Date();

            // Update stats cards
            const statusEl = document.getElementById('emp-out-status');
            const countEl = document.getElementById('emp-out-count-today');
            const offEl = document.getElementById('emp-out-official-today');
            const persEl = document.getElementById('emp-out-personal-today');

            const isCurrentlyOut = entries.some(e => e.status === 'Out' && e.date.startsWith(today.toISOString().split('T')[0]));
            if (statusEl) {
                statusEl.textContent = isCurrentlyOut ? 'Currently Out' : 'In Office';
                statusEl.style.color = isCurrentlyOut ? '#b45309' : '#059669';
            }

            if (countEl) countEl.textContent = entries.filter(e => e.date.startsWith(today.toISOString().split('T')[0])).length;
            if (offEl) offEl.textContent = entries.filter(e => ['Official Duty', 'Client Visit', 'Bank Work'].includes(e.purpose)).length;
            if (persEl) persEl.textContent = entries.filter(e => ['Personal Work', 'Emergency / Medical'].includes(e.purpose)).length;

            // Check active out entry for 5-minute tracking & live ticking timer
            const activeEntry = entries.find(e => (e.status === 'Out' || e.status === 'Approved') && !e.in_time);
            activeOutEntryCache = activeEntry || null;

            // Clear previous intervals
            if (locationTrackingInterval) clearInterval(locationTrackingInterval);
            if (visitDurationTimerInterval) clearInterval(visitDurationTimerInterval);

            if (activeEntry) {
                // 1. Run immediate location check & schedule every 5 minutes (300,000ms)
                trackAndEvaluateLocation(activeEntry);
                locationTrackingInterval = setInterval(() => {
                    trackAndEvaluateLocation(activeEntry);
                }, 5 * 60 * 1000);

                // 2. If visit is started, show active visit banner with live ticking duration
                if (activeEntry.visit_started_at && activeVisitBanner) {
                    activeVisitBanner.style.display = 'flex';
                    if (activeVisitClientName) {
                        activeVisitClientName.textContent = `${activeEntry.customer_name || 'Client Visit'}${activeEntry.branch_name ? ' — ' + activeEntry.branch_name : ''}`;
                    }
                    if (activeVisitAddress) {
                        activeVisitAddress.textContent = activeEntry.target_address || activeEntry.destination || 'Client Premises';
                    }

                    const startMs = new Date(activeEntry.visit_started_at).getTime();
                    const updateTimerDisplay = () => {
                        const elapsedSec = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
                        const hrs = String(Math.floor(elapsedSec / 3600)).padStart(2, '0');
                        const mins = String(Math.floor((elapsedSec % 3600) / 60)).padStart(2, '0');
                        const secs = String(elapsedSec % 60).padStart(2, '0');
                        if (activeVisitTimer) activeVisitTimer.textContent = `${hrs}:${mins}:${secs}`;
                    };
                    updateTimerDisplay();
                    visitDurationTimerInterval = setInterval(updateTimerDisplay, 1000);

                    if (btnActiveVisitReturn) {
                        btnActiveVisitReturn.onclick = () => window.openEmpReturnModal(activeEntry.id);
                    }
                } else if (activeVisitBanner) {
                    activeVisitBanner.style.display = 'none';
                }
            } else {
                if (activeVisitBanner) activeVisitBanner.style.display = 'none';
            }

            if (entries.length === 0) {
                empOutTbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:32px;">No out entry records found.</td></tr>';
                return;
            }

            empOutTbody.innerHTML = entries.map(entry => {
                const d = formatDateDMY(entry.date);
                
                let durationStr = '—';
                if (entry.duration_minutes > 0) {
                    const hrs = Math.floor(entry.duration_minutes / 60);
                    const mins = entry.duration_minutes % 60;
                    durationStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins} mins`;
                }

                let statusBadge = '';
                if (entry.status === 'Pending Approval') {
                    statusBadge = `<span class="status-pill pending" style="background:#fef3c7; color:#b45309; font-weight:800; border:1px solid #fde68a;"><i class="fa-solid fa-hourglass-half"></i> PENDING APPROVAL</span>`;
                } else if (entry.status === 'Out') {
                    statusBadge = `<span class="status-pill pending" style="background:#dbeafe; color:#1d4ed8; font-weight:800; border:1px solid #bfdbfe;"><i class="fa-solid fa-person-walking-arrow-right"></i> OUT</span>`;
                } else if (entry.status === 'Returned') {
                    statusBadge = `<span class="status-pill progress" style="background:#dcfce7; color:#15803d; font-weight:800;"><i class="fa-solid fa-clock-rotate-left"></i> RETURNED</span>`;
                } else if (entry.status === 'Approved') {
                    statusBadge = `<span class="status-pill progress" style="background:#ecfdf5; color:#047857; font-weight:800; border:1px solid #a7f3d0;"><i class="fa-solid fa-circle-check"></i> APPROVED</span>`;
                } else if (entry.status === 'Rejected') {
                    statusBadge = `<span class="status-pill delayed" style="background:#fee2e2; color:#b91c1c; font-weight:800;"><i class="fa-solid fa-circle-xmark"></i> REJECTED</span>`;
                }

                let actionBtn = '—';
                if (entry.status === 'Pending Approval') {
                    actionBtn = `<span style="color:#d97706; font-size:11.5px; font-weight:700;"><i class="fa-solid fa-clock"></i> Awaiting Admin</span>`;
                } else if (entry.status === 'Approved' && entry.purpose === 'Client Visit' && !entry.otp_verified_at) {
                    actionBtn = `<button type="button" class="btn-primary" style="padding:4px 10px; font-size:11px; background:#0284c7; border-radius:4px; font-weight:700;" onclick="window.openVisitOtpModalDirect(${entry.id}, '${escapeQuote(entry.customer_name || entry.destination || 'Client Visit')}', '${escapeQuote(entry.branch_name || '')}')"><i class="fa-solid fa-key"></i> Enter Client OTP</button>`;
                } else if (entry.status === 'Out' || (entry.status === 'Approved' && (entry.otp_verified_at || entry.purpose !== 'Client Visit'))) {
                    actionBtn = `<button type="button" class="btn-primary" style="padding:4px 10px; font-size:11px; border-radius:4px;" onclick="window.openEmpReturnModal(${entry.id})"><i class="fa-solid fa-clock-rotate-left"></i> Mark Return</button>`;
                }

                return `<tr>
                    <td>${d}</td>
                    <td><strong style="color:#d97706;">${entry.out_time || '—'}</strong></td>
                    <td><strong style="color:#059669;">${entry.in_time || '—'}</strong></td>
                    <td><strong>${durationStr}</strong></td>
                    <td><span class="badge" style="background:rgba(59,130,246,0.15); color:#2563eb; font-weight:700; padding:2px 6px; border-radius:4px;">${entry.purpose}</span></td>
                    <td>
                        <div style="font-weight:600; font-size:12.5px;">${entry.destination || '—'}</div>
                        <div style="font-size:11px; color:var(--text-muted);">${entry.reason || ''}</div>
                    </td>
                    <td>${statusBadge}</td>
                    <td><span style="font-size:12px; color:var(--text-muted);">${entry.approver_name || '—'}</span></td>
                    <td>${actionBtn}</td>
                </tr>`;
            }).join('');
        } catch (e) {
            console.error("Error loading employee out entries:", e);
        }
    };

    // Open Return Modal for Employee
    window.openEmpReturnModal = function (id) {
        const idInput = document.getElementById('emp-return-id');
        const timeInput = document.getElementById('emp-return-time');
        if (idInput) idInput.value = id;
        if (timeInput) {
            const now = new Date();
            timeInput.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        }
        if (window.openModal) {
            window.openModal('modal-emp-return');
        } else if (modalEmpReturn) {
            modalEmpReturn.classList.add('active');
            modalEmpReturn.style.display = 'flex';
            modalEmpReturn.style.opacity = '1';
            modalEmpReturn.style.pointerEvents = 'auto';
        }
    };

    // Confirm Return Action
    const submitEmpReturnBtn = document.getElementById('submit-emp-return');
    if (submitEmpReturnBtn) {
        submitEmpReturnBtn.addEventListener('click', async () => {
            const id = document.getElementById('emp-return-id').value;
            const inTime = document.getElementById('emp-return-time').value;
            const remarks = document.getElementById('emp-return-remarks').value.trim();

            if (!inTime) {
                showToast('Please enter return in-time', 'error');
                return;
            }

            try {
                const res = await fetch(`/api/v1/employee/out-entries/${id}/return`, {
                    method: 'PUT',
                    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
                    credentials: 'include',
                    body: JSON.stringify({ inTime, remarks })
                });
                const data = await res.json();
                if (data.success) {
                    showToast('Return time confirmed!', 'success');
                    if (window.closeModal) {
                        window.closeModal('modal-emp-return');
                    } else if (modalEmpReturn) {
                        modalEmpReturn.style.display = 'none';
                    }
                    loadEmployeeOutEntries();
                } else {
                    showToast(data.message || 'Failed to record return', 'error');
                }
            } catch (e) {
                showToast('Network error', 'error');
            }
        });
    }

    if (btnRefreshEmpOut) btnRefreshEmpOut.addEventListener('click', loadEmployeeOutEntries);

    function showToast(msg, type = 'success') {
        const t = document.createElement('div');
        t.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:9999;padding:12px 20px;border-radius:10px;font-weight:700;font-size:13.5px;color:#fff;background:${type === 'success' ? '#23b899' : '#e05252'};box-shadow:0 4px 20px rgba(0,0,0,0.15);transition:opacity 0.4s;`;
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, 3000);
    }

    window.loadTodayStatus = loadTodayStatus;
    window.loadAttendanceHistory = loadAttendanceHistory;

    try {
        await loadTodayStatus();
    } catch (e) {
        console.error("Initial loadTodayStatus error:", e);
    }

    try {
        await loadAttendanceHistory();
    } catch (e) {
        console.error("Initial loadAttendanceHistory error:", e);
    }

    try {
        loadEmployeeOutEntries();
    } catch (e) {
        console.error("Initial loadEmployeeOutEntries error:", e);
    }
})();
