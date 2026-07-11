// employee-attendance.js — Clock In/Out, Live Clock, Attendance History

(async function () {
    // --- Logout ---
    document.getElementById('logout-btn').addEventListener('click', async () => {
        await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' });
        window.location.href = '/login.html';
    });

    // --- Live Clock ---
    function updateClock() {
        const now = new Date();
        document.getElementById('live-clock').textContent =
            now.toLocaleTimeString('en-IN', { hour12: false });
        document.getElementById('live-date').textContent =
            now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }
    updateClock();
    setInterval(updateClock, 1000);

    // --- Month filter default ---
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    document.getElementById('filter-month').value = `${today.getFullYear()}-${mm}`;

    // --- Load today's status ---
    async function loadTodayStatus() {
        try {
            const res = await fetch('/api/v1/employee/attendance/status', { credentials: 'include' });
            const data = await res.json();
            if (!data.success) return;

            const rec = data.data;
            if (!rec) {
                document.getElementById('today-status').textContent = 'Not Checked In';
                return;
            }

            // Clock In button state
            if (rec.login_time && !rec.logout_time) {
                setClockInState(true, rec.login_time);
            } else if (rec.login_time && rec.logout_time) {
                setClockInState(false, rec.login_time, true);
                document.getElementById('btn-clock-out').disabled = true;
                document.getElementById('btn-clock-in').disabled = true;
            }

            document.getElementById('today-status').textContent = rec.status || 'Present';
            if (rec.total_hours) {
                document.getElementById('today-hours').textContent = parseFloat(rec.total_hours).toFixed(2);
            }
            if (rec.login_time) {
                document.getElementById('today-checkin-label').textContent =
                    'Checked in at ' + new Date(rec.login_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
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
            badge.className = 'status-pill done';
            badge.textContent = 'Clocked Out';
            inBtn.disabled = true;
            outBtn.disabled = true;
            label.textContent = 'Session completed for today.';
            return;
        }

        if (isIn) {
            badge.className = 'status-pill progress';
            badge.textContent = 'Clocked In';
            inBtn.disabled = true;
            outBtn.disabled = false;
            const t = new Date(loginTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
            label.textContent = `Clocked in at ${t}`;
        } else {
            badge.className = 'status-pill pending';
            badge.textContent = 'Not Clocked In';
            inBtn.disabled = false;
            outBtn.disabled = true;
            label.textContent = '';
        }
    }

    // --- Clock In ---
    document.getElementById('btn-clock-in').addEventListener('click', async () => {
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

    // --- Clock Out ---
    document.getElementById('btn-clock-out').addEventListener('click', async () => {
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

    // --- Load Attendance History ---
    async function loadHistory() {
        try {
            const res = await fetch('/api/v1/employee/attendance/logs', { credentials: 'include' });
            const data = await res.json();
            const tbody = document.getElementById('attendance-tbody');

            if (!data.success || !data.data.length) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:32px;">No attendance records found.</td></tr>';
                // Update month cards
                document.getElementById('month-present').textContent = '0';
                document.getElementById('month-late').textContent = '0';
                return;
            }

            const filterVal = document.getElementById('filter-month').value;
            const [fy, fm] = filterVal ? filterVal.split('-').map(Number) : [today.getFullYear(), today.getMonth() + 1];

            const filtered = data.data.filter(r => {
                const d = new Date(r.date);
                return d.getFullYear() === fy && (d.getMonth() + 1) === fm;
            });

            // Update month counters
            document.getElementById('month-present').textContent = filtered.filter(r => r.status === 'Present').length;
            document.getElementById('month-late').textContent = filtered.filter(r => r.is_late_login).length;

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

    document.getElementById('filter-month').addEventListener('change', loadHistory);

    // --- Correction Modal ---
    document.getElementById('btn-correction').addEventListener('click', () => {
        document.getElementById('modal-correction').style.display = 'flex';
    });
    ['close-correction', 'close-correction-2'].forEach(id => {
        document.getElementById(id).addEventListener('click', () => {
            document.getElementById('modal-correction').style.display = 'none';
        });
    });

    document.getElementById('submit-correction').addEventListener('click', async () => {
        const workDate = document.getElementById('corr-date').value;
        const clockIn = document.getElementById('corr-in').value;
        const clockOut = document.getElementById('corr-out').value;
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

    function showToast(msg, type = 'success') {
        const t = document.createElement('div');
        t.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:9999;padding:12px 20px;border-radius:10px;font-weight:700;font-size:13.5px;color:#fff;background:${type === 'success' ? '#23b899' : '#e05252'};box-shadow:0 4px 20px rgba(0,0,0,0.15);transition:opacity 0.4s;`;
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, 3000);
    }

    await loadTodayStatus();
    await loadHistory();
})();
