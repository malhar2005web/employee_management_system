/**
 * Enterprise Activity Timeline & Performance Intelligence Engine (Frontend Glass Widget)
 * Features:
 * - Compact Workflow Step Performance Card (Estimated vs Actual, Variance, Efficiency %, Status Badge)
 * - Global Business Impact Audit Timeline Visualizer (Severity, Correlation ID, Category filters, CSV Export)
 * - Interactive Timeline Story Replay Visualizer (▶ Playback)
 */

(function() {
    // 1. Render Compact Performance Card on Workflow Step Cards
    window.renderStepPerformanceCard = async (stepId, containerElementId) => {
        const container = document.getElementById(containerElementId);
        if (!container) return;

        try {
            const res = await fetch(`/api/v1/timeline/step-performance/${stepId}`);
            const data = await res.json();

            if (!data.success || !data.data) {
                container.innerHTML = `<div style="font-size:11px; color:var(--text-muted);">No session tracking data yet.</div>`;
                return;
            }

            const p = data.data;
            const isAhead = p.varianceSeconds <= 0;
            const statusColor = isAhead ? '#10b981' : '#ef4444';
            const statusBg = isAhead ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)';

            container.innerHTML = `
                <div class="compact-perf-card glass" style="margin-top:10px; padding:12px 14px; border-radius:14px; background:rgba(255,255,255,0.85); border:1px solid rgba(0,0,0,0.08); box-shadow:0 2px 10px rgba(0,0,0,0.03); font-size:12px;">
                    <!-- Top Line metrics -->
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <span class="status-pill" style="font-size:10px; font-weight:800; background:${statusBg}; color:${statusColor}; border:1px solid ${statusColor}44; padding:3px 8px;">
                            ${isAhead ? '🟢' : '🔴'} ${p.statusBadge} (${p.efficiencyPercentage}% Eff)
                        </span>
                        <span style="font-size:11px; font-weight:700; color:var(--text-muted);">Sessions: ${p.totalSessions}</span>
                    </div>

                    <!-- Metrics Grid -->
                    <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; text-align:center; background:rgba(0,0,0,0.03); padding:8px; border-radius:10px; margin-bottom:8px;">
                        <div>
                            <div style="font-size:10px; color:var(--text-muted); font-weight:700;">ESTIMATED</div>
                            <div style="font-weight:800; color:var(--text-dark);">${p.formattedEstimated}</div>
                        </div>
                        <div>
                            <div style="font-size:10px; color:var(--text-muted); font-weight:700;">ACTUAL</div>
                            <div style="font-weight:800; color:var(--teal-900);">${p.formattedActual}</div>
                        </div>
                        <div>
                            <div style="font-size:10px; color:var(--text-muted); font-weight:700;">VARIANCE</div>
                            <div style="font-weight:800; color:${statusColor};">${p.formattedVariance}</div>
                        </div>
                    </div>

                    <!-- Live Running State or Active Assignee -->
                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; color:var(--text-muted);">
                        <span>${p.isRunning ? `⚡ Active: <strong style="color:var(--teal-900);">${p.activeEmployeeName}</strong>` : `Risk Level: <strong style="color:${statusColor};">${p.riskLevel}</strong>`}</span>
                        <button type="button" onclick="window.startPlaybackReplay(${stepId})" style="background:transparent; border:none; color:var(--teal-600); font-weight:800; cursor:pointer; font-size:11px;">
                            <i class="fa-solid fa-play"></i> Replay
                        </button>
                    </div>
                </div>
            `;
        } catch (e) {
            console.error('Error rendering step performance card:', e);
        }
    };

    // 2. Global Audit & Activity Timeline Stream Renderer
    window.renderGlobalAuditTimeline = async (containerId, filters = {}) => {
        const container = document.getElementById(containerId);
        if (!container) return;

        try {
            const queryParams = new URLSearchParams(filters).toString();
            const res = await fetch(`/api/v1/timeline/events?${queryParams}`);
            const data = await res.json();

            if (!data.success || !Array.isArray(data.data) || data.data.length === 0) {
                container.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-muted); font-weight:600;">No activity events recorded for the selected filter.</div>`;
                return;
            }

            const events = data.data;
            container.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                    <div style="font-size:13px; font-weight:800; color:var(--teal-900);"><i class="fa-solid fa-stream"></i> Audit Log Stream (${events.length} Events)</div>
                    <button type="button" onclick="window.exportTimelineCSV()" style="padding:6px 14px; border-radius:14px; font-size:12px; font-weight:800; background:linear-gradient(135deg, var(--teal-600), var(--teal-900)); color:#fff; border:none; cursor:pointer;">
                        <i class="fa-solid fa-file-csv"></i> Export CSV
                    </button>
                </div>
                <div class="timeline-stream" style="display:flex; flex-direction:column; gap:12px;">
                    ${events.map(e => {
                        const timeStr = new Date(e.created_at).toLocaleString('en-IN', { dateStyle:'short', timeStyle:'short' });
                        const isCritical = e.severity === 'CRITICAL' || e.severity === 'WARNING';
                        const badgeClass = isCritical ? 'warning' : 'progress';

                        return `
                            <div class="timeline-item glass" style="padding:14px 18px; border-radius:16px; background:rgba(255,255,255,0.9); border:1px solid rgba(0,0,0,0.06); display:flex; justify-content:space-between; align-items:center;">
                                <div style="display:flex; gap:14px; align-items:center;">
                                    <div style="width:36px; height:36px; border-radius:10px; background:linear-gradient(135deg, rgba(22,160,133,0.1), rgba(12,74,64,0.15)); display:flex; align-items:center; justify-content:center; color:var(--teal-900); font-size:15px;">
                                        <i class="fa-solid fa-bolt"></i>
                                    </div>
                                    <div>
                                        <div style="display:flex; align-items:center; gap:8px;">
                                            <span class="status-pill ${badgeClass}" style="font-size:10px; font-weight:800; padding:2px 6px;">${e.category.toUpperCase()}</span>
                                            <strong style="font-size:13.5px; color:var(--text-dark);">${e.action}</strong>
                                            <span style="font-size:11px; color:var(--text-muted); font-family:monospace;">(${e.correlation_id})</span>
                                        </div>
                                        <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">
                                            ${e.performed_by_name ? `Performed by <strong>${e.performed_by_name}</strong>` : 'System Action'} ${e.entity_name ? `• ${e.entity_name}` : ''}
                                        </div>
                                        ${e.impact_description ? `<div style="font-size:12px; color:var(--teal-900); margin-top:4px; font-weight:600;"><i class="fa-solid fa-circle-dot" style="font-size:8px;"></i> ${e.impact_description}</div>` : ''}
                                    </div>
                                </div>
                                <div style="text-align:right;">
                                    <div style="font-size:11.5px; font-weight:700; color:var(--text-muted);">${timeStr}</div>
                                    <div style="font-size:10.5px; color:var(--text-muted); font-family:monospace;">${e.ip_address || '127.0.0.1'}</div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;

        } catch (e) {
            console.error('Error rendering global audit timeline:', e);
        }
    };

    // 3. Story Replay Visualizer (▶ Playback)
    window.startPlaybackReplay = async (taskId) => {
        try {
            const res = await fetch(`/api/v1/timeline/playback/${taskId}`);
            const data = await res.json();

            if (!data.success || !Array.isArray(data.data) || data.data.length === 0) {
                alert('No story playback events found for this item.');
                return;
            }

            const events = data.data;
            let currentStepIndex = 0;

            const modal = document.createElement('div');
            modal.id = 'playback-modal-overlay';
            modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); backdrop-filter:blur(14px); z-index:999999; display:flex; align-items:center; justify-content:center; padding:20px;';

            modal.innerHTML = `
                <div class="modal-card glass" style="width:100%; max-width:540px; background:rgba(255,255,255,0.95); border-radius:24px; padding:24px; box-shadow:0 20px 60px rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.6);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                        <h3 style="margin:0; font-size:18px; font-weight:800; color:var(--teal-900);"><i class="fa-solid fa-play"></i> Timeline Story Replay</h3>
                        <i class="fa-solid fa-xmark" onclick="document.getElementById('playback-modal-overlay').remove()" style="cursor:pointer; font-size:18px; color:var(--text-muted);"></i>
                    </div>

                    <div id="playback-card" style="padding:20px; border-radius:18px; background:linear-gradient(135deg, rgba(22,160,133,0.1), rgba(12,74,64,0.15)); border:1px solid rgba(22,160,133,0.25); text-align:center; min-height:140px; display:flex; flex-direction:column; justify-content:center;">
                        <!-- Dynamic Playback Step Content -->
                    </div>

                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:20px;">
                        <button type="button" id="btn-play-prev" style="padding:8px 16px; border-radius:16px; border:none; font-weight:700; background:rgba(0,0,0,0.06); cursor:pointer;">Previous</button>
                        <span id="playback-step-counter" style="font-weight:800; font-size:13px; color:var(--text-dark);">Step 1 / ${events.length}</span>
                        <button type="button" id="btn-play-next" style="padding:8px 20px; border-radius:16px; border:none; font-weight:800; background:linear-gradient(135deg, var(--teal-600), var(--teal-900)); color:#fff; cursor:pointer;">Next Step <i class="fa-solid fa-arrow-right"></i></button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            const updateCard = () => {
                const item = events[currentStepIndex];
                const card = document.getElementById('playback-card');
                const counter = document.getElementById('playback-step-counter');

                if (card) {
                    card.innerHTML = `
                        <div style="font-size:11px; font-weight:800; color:var(--teal-700); text-transform:uppercase;">${new Date(item.created_at).toLocaleString()}</div>
                        <h4 style="margin:8px 0 4px 0; font-size:16px; font-weight:800; color:var(--text-dark);">${item.action}</h4>
                        <div style="font-size:13px; color:var(--text-muted);">${item.performed_by_name || 'System'}</div>
                        ${item.impact_description ? `<div style="margin-top:10px; font-weight:700; font-size:12.5px; color:var(--teal-900);">${item.impact_description}</div>` : ''}
                    `;
                }
                if (counter) counter.textContent = `Step ${currentStepIndex + 1} of ${events.length}`;
            };

            updateCard();

            document.getElementById('btn-play-prev').onclick = () => {
                if (currentStepIndex > 0) {
                    currentStepIndex--;
                    updateCard();
                }
            };

            document.getElementById('btn-play-next').onclick = () => {
                if (currentStepIndex < events.length - 1) {
                    currentStepIndex++;
                    updateCard();
                }
            };

        } catch (e) {
            console.error('Error starting playback replay:', e);
        }
    };

    window.exportTimelineCSV = () => {
        window.location.href = '/api/v1/timeline/export?format=csv';
    };
})();
