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

    // --- Month filter default ---
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const filterMonthEl = document.getElementById('filter-month');
    if (filterMonthEl) filterMonthEl.value = `${today.getFullYear()}-${mm}`;

    // --- Load today's status ---
    async function loadTodayStatus() {
        try {
            const res = await fetch('/api/v1/employee/attendance/status', { credentials: 'include' });
            const data = await res.json();
            if (!data.success) return;

            const rec = data.data;
            if (!rec) {
                const todayStatus = document.getElementById('today-status');
                if (todayStatus) todayStatus.textContent = 'Not Checked In';
                return;
            }

            // Clock In button state
            if (rec.login_time && !rec.logout_time) {
                setClockInState(true, rec.login_time);
            } else if (rec.login_time && rec.logout_time) {
                setClockInState(false, rec.login_time, true);
                const outBtn = document.getElementById('btn-clock-out');
                const inBtn = document.getElementById('btn-clock-in');
                if (outBtn) outBtn.disabled = true;
                if (inBtn) inBtn.disabled = true;
            }

            const todayStatus = document.getElementById('today-status');
            const todayHours = document.getElementById('today-hours');
            const todayCheckin = document.getElementById('today-checkin-label');

            if (todayStatus) todayStatus.textContent = rec.status || 'Present';
            if (todayHours && rec.total_hours) {
                todayHours.textContent = parseFloat(rec.total_hours).toFixed(2);
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
            if (label) label.textContent = 'Session completed for today.';
            return;
        }

        if (isIn) {
            if (badge) { badge.className = 'status-pill progress'; badge.textContent = 'Clocked In'; }
            if (inBtn) inBtn.disabled = true;
            if (outBtn) outBtn.disabled = false;
            const t = new Date(loginTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
            if (label) label.textContent = `Clocked in at ${t}`;
        } else {
            if (badge) { badge.className = 'status-pill pending'; badge.textContent = 'Not Clocked In'; }
            if (inBtn) inBtn.disabled = false;
            if (outBtn) outBtn.disabled = true;
            if (label) label.textContent = '';
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
                    await loadHistory();
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
                    await loadHistory();
                } else {
                    showToast(data.message || 'Clock-out failed', 'error');
                }
            } catch (e) {
                showToast('Network error', 'error');
            }
        });
    }

    // --- Load Attendance History ---
    async function loadHistory() {
        try {
            const res = await fetch('/api/v1/employee/attendance/logs', { credentials: 'include' });
            const data = await res.json();
            const tbody = document.getElementById('attendance-tbody');
            if (!tbody) return;

            if (!data.success || !data.data.length) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:32px;">No attendance records found.</td></tr>';
                const mPres = document.getElementById('month-present');
                const mLate = document.getElementById('month-late');
                if (mPres) mPres.textContent = '0';
                if (mLate) mLate.textContent = '0';
                return;
            }

            const filterVal = document.getElementById('filter-month').value;
            const [fy, fm] = filterVal ? filterVal.split('-').map(Number) : [today.getFullYear(), today.getMonth() + 1];

            const filtered = data.data.filter(r => {
                const d = new Date(r.date);
                return d.getFullYear() === fy && (d.getMonth() + 1) === fm;
            });

            const mPres = document.getElementById('month-present');
            const mLate = document.getElementById('month-late');
            if (mPres) mPres.textContent = filtered.filter(r => r.status === 'Present').length;
            if (mLate) mLate.textContent = filtered.filter(r => r.is_late_login).length;

            const displayData = filtered.length ? filtered : data.data.slice(0, 20);
            tbody.innerHTML = displayData.map(r => {
                const d = new Date(r.date);
                const day = d.toLocaleDateString('en-IN', { weekday: 'short' });
                const dateStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                const loginStr = r.login_time ? new Date(r.login_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';
                const logoutStr = r.logout_time ? new Date(r.logout_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';
                const hours = r.total_working_hours ? parseFloat(r.total_working_hours).toFixed(2) + ' hrs' : '—';
                const statusClass = r.status === 'Present' ? 'done' : r.status === 'Late' ? 'pending' : 'rejected';
                return `<tr>
                    <td>${dateStr}</td>
                    <td>${day}</td>
                    <td>${loginStr}</td>
                    <td>${logoutStr}</td>
                    <td>${hours}</td>
                    <td><span class="status-pill ${statusClass}">${r.status || 'Absent'}</span></td>
                </tr>`;
            }).join('');
        } catch (e) {
            console.error(e);
        }
    }

    if (filterMonthEl) filterMonthEl.addEventListener('change', loadHistory);

    // --- Attendance Correction Modal ---
    const btnCorrection = document.getElementById('btn-correction');
    if (btnCorrection) {
        btnCorrection.addEventListener('click', () => {
            const mod = document.getElementById('modal-correction');
            if (mod) mod.style.display = 'flex';
        });
    }

    ['close-correction', 'close-correction-2'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('click', () => {
                const mod = document.getElementById('modal-correction');
                if (mod) mod.style.display = 'none';
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
                    document.getElementById('modal-correction').style.display = 'none';
                } else {
                    showToast(data.message || 'Failed to submit', 'error');
                }
            } catch (e) {
                showToast('Network error', 'error');
            }
        });
    }

    // =========================================================================
    // OUT ENTRY / GATE PASS CLIENT MODULE (EMPLOYEE SIDE)
    // =========================================================================
    const btnApplyOutEntry = document.getElementById('btn-apply-out-entry');
    const modalOutEntry = document.getElementById('modal-out-entry');
    const modalEmpReturn = document.getElementById('modal-emp-return');
    const empOutTbody = document.getElementById('emp-out-tbody');
    const btnRefreshEmpOut = document.getElementById('btn-refresh-emp-out');

    if (btnApplyOutEntry) {
        btnApplyOutEntry.addEventListener('click', () => {
            const todayStr = new Date().toISOString().split('T')[0];
            const dateInput = document.getElementById('emp-out-date');
            const timeInput = document.getElementById('emp-out-time');
            if (dateInput) dateInput.value = todayStr;
            if (timeInput) {
                const now = new Date();
                timeInput.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            }
            if (modalOutEntry) modalOutEntry.style.display = 'flex';
        });
    }

    ['close-out-modal', 'close-out-modal-2'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('click', () => {
                if (modalOutEntry) modalOutEntry.style.display = 'none';
            });
        }
    });

    ['close-emp-return-modal', 'close-emp-return-2'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('click', () => {
                if (modalEmpReturn) modalEmpReturn.style.display = 'none';
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

            if (!date || !outTime || !purpose) {
                showToast('Please fill Date, Out Time and Purpose', 'error');
                return;
            }

            try {
                const res = await fetch('/api/v1/employee/out-entries', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ date, purpose, outTime, inTime: inTime || null, destination, reason })
                });
                const data = await res.json();
                if (data.success) {
                    showToast('Out entry submitted successfully!', 'success');
                    if (modalOutEntry) modalOutEntry.style.display = 'none';
                    loadEmployeeOutEntries();
                } else {
                    showToast(data.message || 'Failed to submit', 'error');
                }
            } catch (e) {
                showToast('Network error', 'error');
            }
        });
    }

    // Load Employee Out Entries
    window.loadEmployeeOutEntries = async function () {
        if (!empOutTbody) return;
        empOutTbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:32px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading out entries...</td></tr>';

        try {
            const res = await fetch('/api/v1/employee/out-entries');
            const data = await res.json();
            if (!res.ok || !data.success) {
                empOutTbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:32px;">No out entries recorded.</td></tr>';
                return;
            }

            const entries = data.data.entries || [];
            const stats = data.data.stats || {};

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

            if (entries.length === 0) {
                empOutTbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:32px;">No out entry records found.</td></tr>';
                return;
            }

            empOutTbody.innerHTML = entries.map(entry => {
                const d = new Date(entry.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                
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

                let actionBtn = '—';
                if (entry.status === 'Out') {
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
        if (modalEmpReturn) modalEmpReturn.style.display = 'flex';
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
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ inTime, remarks })
                });
                const data = await res.json();
                if (data.success) {
                    showToast('Return time confirmed!', 'success');
                    if (modalEmpReturn) modalEmpReturn.style.display = 'none';
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

    await loadTodayStatus();
    await loadHistory();
    loadEmployeeOutEntries();
})();
