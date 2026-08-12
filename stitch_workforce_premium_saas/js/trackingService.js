/**
 * Enterprise Task Session Tracking Service (Frontend Engine)
 * Features:
 * - Single Active Task Enforcement
 * - Real-time Stopwatch Counter
 * - 30-Second Heartbeat Engine
 * - 5-Minute Idle Detection & Auto-Pause
 * - Auto-switch active task sessions
 */
(function() {
    let currentSession = null;
    let stopwatchInterval = null;
    let heartbeatInterval = null;
    let idleTimer = null;
    let lastActivityTime = Date.now();
    const IDLE_THRESHOLD_MS = 300 * 1000; // 5 minutes

    // DOM Elements for Active Task Banner
    let activeTaskBanner = null;

    const init = () => {
        setupIdleTracker();
        fetchActiveSession();
    };

    const setupIdleTracker = () => {
        const resetActivity = () => {
            lastActivityTime = Date.now();
        };

        window.addEventListener('mousemove', resetActivity, { passive: true });
        window.addEventListener('keydown', resetActivity, { passive: true });
        window.addEventListener('mousedown', resetActivity, { passive: true });
        window.addEventListener('touchstart', resetActivity, { passive: true });
        window.addEventListener('scroll', resetActivity, { passive: true });

        // Idle check loop every 10 seconds
        setInterval(() => {
            if (!currentSession || currentSession.status !== 'Running') return;
            const elapsedIdle = Date.now() - lastActivityTime;
            if (elapsedIdle >= IDLE_THRESHOLD_MS) {
                handleIdleTimeout();
            }
        }, 10000);
    };

    const handleIdleTimeout = async () => {
        if (!currentSession) return;
        try {
            await fetch('/api/v1/tracking/idle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idleSeconds: Math.floor(IDLE_THRESHOLD_MS / 1000) })
            });

            stopStopwatch();
            stopHeartbeat();
            currentSession = null;
            updateActiveBanner(null);

            if (typeof showToast === 'function') {
                showToast('Session auto-paused due to 5 minutes of inactivity.', 'warning');
            } else {
                alert('Session auto-paused due to 5 minutes of inactivity.');
            }
        } catch (e) {
            console.error('Failed to report idle timeout:', e);
        }
    };

    const fetchActiveSession = async () => {
        try {
            const res = await fetch('/api/v1/tracking/active');
            const data = await res.json();

            if (res.ok && data.success && data.data.active) {
                currentSession = data.data.session;
                window.currentRunningTaskId = currentSession ? (currentSession.task_id || currentSession.taskId) : null;
                startStopwatch(currentSession.elapsedSeconds);
                startHeartbeat();
                updateActiveBanner(currentSession);
            } else {
                currentSession = null;
                window.currentRunningTaskId = null;
                updateActiveBanner(null);
            }
        } catch (e) {
            console.error('Error fetching active session:', e);
        }
    };

    const startStopwatch = (initialSeconds = 0) => {
        stopStopwatch();
        let elapsed = initialSeconds;

        const updateTimerDisplay = () => {
            elapsed++;
            const hours = String(Math.floor(elapsed / 3600)).padStart(2, '0');
            const minutes = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
            const seconds = String(elapsed % 60).padStart(2, '0');
            const timeStr = `${hours}:${minutes}:${seconds}`;

            const timerElem = document.getElementById('active-task-timer');
            if (timerElem) {
                timerElem.textContent = timeStr;
            }
        };

        stopwatchInterval = setInterval(updateTimerDisplay, 1000);
    };

    const stopStopwatch = () => {
        if (stopwatchInterval) clearInterval(stopwatchInterval);
        stopwatchInterval = null;
    };

    const startHeartbeat = () => {
        stopHeartbeat();
        // Ping heartbeat every 30s
        heartbeatInterval = setInterval(async () => {
            if (!currentSession) return;
            try {
                await fetch('/api/v1/tracking/heartbeat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionId: currentSession.id,
                        platform: 'Web',
                        activeWindow: document.title
                    })
                });
            } catch (e) {
                console.error('Heartbeat ping failed:', e);
            }
        }, 30000);
    };

    const stopHeartbeat = () => {
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    };

    const updateActiveBanner = (session) => {
        let container = document.getElementById('active-task-banner-container');
        if (!container) return;

        if (!session) {
            container.innerHTML = `
                <div class="card glass" style="padding: 12px 18px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; border-radius: var(--radius-md); border: 1px solid var(--glass-border); background: rgba(255, 255, 255, 0.12); backdrop-filter: blur(16px);">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="font-size: 20px;">⏸️</span>
                        <div>
                            <div style="font-size: 13px; font-weight: 800; color: var(--teal-900);">No Active Task Session</div>
                            <div style="font-size: 11.5px; color: var(--text-muted);">Click ▶ Start Work on any task below to track your time.</div>
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        const hours = String(Math.floor(session.elapsedSeconds / 3600)).padStart(2, '0');
        const minutes = String(Math.floor((session.elapsedSeconds % 3600) / 60)).padStart(2, '0');
        const seconds = String(session.elapsedSeconds % 60).padStart(2, '0');
        const initialTime = `${hours}:${minutes}:${seconds}`;

        container.innerHTML = `
            <div class="card glass" style="padding: 14px 20px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; border-radius: var(--radius-md); border: 1px solid rgba(22, 160, 133, 0.4); background: linear-gradient(135deg, rgba(22, 160, 133, 0.12), rgba(12, 74, 64, 0.18)); backdrop-filter: blur(20px); box-shadow: 0 8px 24px rgba(12, 74, 64, 0.15); animation: pulseBorder 3s infinite;">
                <div style="display: flex; align-items: center; gap: 14px;">
                    <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 42px; height: 42px; border-radius: 50%; background: linear-gradient(135deg, var(--teal-600), var(--teal-900)); color: #fff; box-shadow: 0 4px 12px rgba(12,74,64,0.3);">
                        <i class="fa-solid fa-spinner fa-spin" style="font-size: 18px;"></i>
                    </div>
                    <div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span class="status-pill progress" style="font-size: 10.5px; padding: 2px 8px; font-weight: 900;">● RUNNING SESSION</span>
                            <span style="font-size: 12px; font-weight: 700; color: var(--teal-700);">${session.projectName || 'Project'}</span>
                        </div>
                        <div style="font-size: 15px; font-weight: 800; color: var(--teal-900); margin-top: 3px;">${session.taskName}</div>
                    </div>
                </div>

                <div style="display: flex; align-items: center; gap: 20px;">
                    <div style="text-align: right;">
                        <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Productive Time</div>
                        <div id="active-task-timer" style="font-size: 20px; font-weight: 900; font-family: 'Courier New', monospace; color: var(--teal-900); letter-spacing: 1px;">${initialTime}</div>
                    </div>

                    <div style="display: flex; gap: 8px;">
                        <button type="button" onclick="window.pauseTaskSession()" style="padding: 7px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; background: rgba(255,255,255,0.6); border: 1px solid var(--glass-border); color: var(--teal-900); cursor: pointer; transition: all 0.2s; backdrop-filter: blur(10px);">
                            <i class="fa-solid fa-pause"></i> Pause
                        </button>
                        <button type="button" onclick="window.completeTaskSession()" style="padding: 7px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; background: linear-gradient(135deg, var(--teal-600), var(--teal-900)); border: 1px solid rgba(255,255,255,0.4); color: #fff; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(12,74,64,0.25);">
                            <i class="fa-solid fa-check"></i> Complete
                        </button>
                    </div>
                </div>
            </div>
        `;
    };

    // Public API functions exposed on window object
    window.startTaskSession = async (taskId, projectId = null) => {
        if (typeof window.clearSpotlightCard === 'function') window.clearSpotlightCard();
        try {
            const res = await fetch('/api/v1/tracking/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ taskId, projectId, platform: 'Web' })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                currentSession = data.data.session;
                currentSession.taskName = data.data.taskName;
                currentSession.projectName = data.data.projectName;
                currentSession.elapsedSeconds = 0;
                window.currentRunningTaskId = Number(currentSession.task_id || currentSession.taskId || taskId);

                startStopwatch(0);
                startHeartbeat();
                updateActiveBanner(currentSession);

                if (typeof window.loadTasks === 'function') window.loadTasks();

                if (data.data.autoPausedPrevious) {
                    console.log('Previous active task session was auto-paused (Task Switched).');
                }
            } else {
                alert(data.message || 'Failed to start task session');
            }
        } catch (e) {
            console.error('Error starting session:', e);
            alert('Failed to start task session');
        }
    };

    window.pauseTaskSession = async (reason = 'Employee Paused') => {
        try {
            const res = await fetch('/api/v1/tracking/pause', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                stopStopwatch();
                stopHeartbeat();
                currentSession = null;
                window.currentRunningTaskId = null;
                updateActiveBanner(null);
                if (typeof window.loadTasks === 'function') window.loadTasks();
            } else {
                alert(data.message || 'Failed to pause session');
            }
        } catch (e) {
            console.error('Error pausing session:', e);
        }
    };

    window.completeTaskSession = async () => {
        try {
            const res = await fetch('/api/v1/tracking/stop', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ endReason: 'Task Completed', isTaskCompleted: true })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                stopStopwatch();
                stopHeartbeat();
                currentSession = null;
                window.currentRunningTaskId = null;
                updateActiveBanner(null);

                if (typeof window.loadTasks === 'function') window.loadTasks();
                if (typeof loadEmployeeTasks === 'function') loadEmployeeTasks();
            } else {
                alert(data.message || 'Failed to complete session');
            }
        } catch (e) {
            console.error('Error completing session:', e);
        }
    };

    document.addEventListener('DOMContentLoaded', init);
})();
