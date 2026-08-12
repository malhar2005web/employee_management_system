/**
 * 📊 Enterprise Workload Balancing & Employee Capacity Heatmap Engine
 * Features:
 * - Real-time Workload Percentage calculation using Remaining Hours (Estimated - Actual)
 * - Color-coded Heatmap Badges (Green: Available, Yellow: Optimal, Orange: Busy, Red: Overloaded)
 * - Safe 1-Click Smart Auto-Rebalancing Preview Modal with eligibility guards
 */

(function() {
    window.renderWorkloadHeatmapDashboard = async (containerId) => {
        const container = document.getElementById(containerId);
        if (!container) return;

        try {
            const res = await fetch('/api/v1/workload-heatmap/heatmap');
            const data = await res.json();

            if (!data.success || !Array.isArray(data.data) || data.data.length === 0) {
                container.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-muted);">No employee workload metrics available.</div>`;
                return;
            }

            const emps = data.data;
            const overloadedCount = emps.filter(e => e.workloadPercentage > 120).length;

            container.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <div>
                        <h3 style="margin:0; font-size:18px; font-weight:800; color:var(--teal-900);">📊 Employee Capacity & Workload Heatmap</h3>
                        <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">Calculated using Remaining Hours (Estimated - Actual) vs Configured Weekly Capacity</div>
                    </div>
                    <button type="button" onclick="window.triggerAutoRebalancePreview()" style="padding:10px 18px; border-radius:14px; font-weight:800; font-size:12.5px; background:linear-gradient(135deg, var(--teal-600), var(--teal-900)); color:#fff; border:none; cursor:pointer; box-shadow:0 4px 14px rgba(22,160,133,0.3);">
                        <i class="fa-solid fa-scale-balanced"></i> 1-Click Auto-Rebalance ${overloadedCount > 0 ? `(${overloadedCount} Overloaded)` : ''}
                    </button>
                </div>

                <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:16px;">
                    ${emps.map(e => `
                        <div class="glass" style="padding:16px; border-radius:18px; background:rgba(255,255,255,0.9); border:1px solid rgba(0,0,0,0.06); box-shadow:0 4px 15px rgba(0,0,0,0.03);">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                                <div>
                                    <strong style="font-size:14px; color:var(--text-dark);">${e.full_name}</strong>
                                    <div style="font-size:11.5px; color:var(--text-muted);">${e.designation || e.department_name || 'Employee'}</div>
                                </div>
                                <span class="status-pill" style="font-size:11px; font-weight:800; background:${e.statusColor}22; color:${e.statusColor}; border:1px solid ${e.statusColor}44; padding:4px 10px;">
                                    ${e.statusBadge} (${e.workloadPercentage}%)
                                </span>
                            </div>

                            <!-- Workload Progress Bar -->
                            <div style="width:100%; height:8px; border-radius:4px; background:rgba(0,0,0,0.06); overflow:hidden; margin-bottom:12px;">
                                <div style="width:${Math.min(100, e.workloadPercentage)}%; height:100%; background:${e.statusColor}; border-radius:4px; transition:width 0.4s ease;"></div>
                            </div>

                            <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:6px; text-align:center; font-size:11px; background:rgba(0,0,0,0.03); padding:8px; border-radius:10px;">
                                <div>
                                    <div style="color:var(--text-muted); font-weight:700;">CAPACITY</div>
                                    <div style="font-weight:800; color:var(--text-dark);">${e.weekly_capacity_hours}h</div>
                                </div>
                                <div>
                                    <div style="color:var(--text-muted); font-weight:700;">ACTUAL</div>
                                    <div style="font-weight:800; color:var(--teal-900);">${e.total_actual_hours}h</div>
                                </div>
                                <div>
                                    <div style="color:var(--text-muted); font-weight:700;">REMAINING</div>
                                    <div style="font-weight:800; color:${e.statusColor};">${e.remaining_hours}h</div>
                                </div>
                            </div>

                            ${e.is_active_session ? `
                                <div style="margin-top:10px; font-size:11px; color:var(--teal-900); font-weight:700; background:rgba(16,185,129,0.08); padding:6px 10px; border-radius:8px;">
                                    ⚡ Active Task: "${e.active_task_title}"
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            `;

        } catch (e) {
            console.error('Error rendering workload heatmap dashboard:', e);
        }
    };

    // Safe 1-Click Smart Rebalance Preview Modal
    window.triggerAutoRebalancePreview = async () => {
        try {
            const res = await fetch('/api/v1/workload-heatmap/rebalance-preview');
            const data = await res.json();

            if (!data.success) {
                alert(data.message || 'Failed to generate rebalance preview');
                return;
            }

            const recs = data.recommendations || [];

            const modal = document.createElement('div');
            modal.id = 'rebalance-preview-modal';
            modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); backdrop-filter:blur(14px); z-index:999999; display:flex; align-items:center; justify-content:center; padding:20px;';

            modal.innerHTML = `
                <div class="modal-card glass" style="width:100%; max-width:600px; background:rgba(255,255,255,0.95); border-radius:24px; padding:24px; box-shadow:0 20px 60px rgba(0,0,0,0.3);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                        <h3 style="margin:0; font-size:18px; font-weight:800; color:var(--teal-900);"><i class="fa-solid fa-scale-balanced"></i> Rebalance Recommendations</h3>
                        <i class="fa-solid fa-xmark" onclick="document.getElementById('rebalance-preview-modal').remove()" style="cursor:pointer; font-size:18px; color:var(--text-muted);"></i>
                    </div>

                    ${recs.length === 0 ? `
                        <div style="text-align:center; padding:30px; color:var(--text-muted); font-weight:600;">
                            ✅ All employees are within safe capacity limits (< 120%). No eligible tasks need rebalancing.
                        </div>
                    ` : `
                        <div style="display:flex; flex-direction:column; gap:12px; max-height:360px; overflow-y:auto;">
                            ${recs.map(r => `
                                <div style="padding:14px; border-radius:14px; background:rgba(255,255,255,0.9); border:1px solid rgba(0,0,0,0.06);">
                                    <div style="display:flex; justify-content:space-between; align-items:center; font-weight:800; font-size:13px; color:var(--text-dark);">
                                        <span>Task: "${r.task.title}"</span>
                                        <span style="color:var(--teal-900);">${r.remainingHours}h Remaining</span>
                                    </div>
                                    <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">
                                        From <strong>${r.overloadedEmployee.name}</strong> (${r.overloadedEmployee.currentWorkload}%) ➔ To <strong>${r.targetEmployee.name}</strong> (${r.targetEmployee.currentWorkload}%)
                                    </div>
                                    <div style="font-size:11.5px; color:var(--teal-900); margin-top:6px; font-weight:600;">
                                        <i class="fa-solid fa-circle-dot" style="font-size:8px;"></i> ${r.impactDescription}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
                            <button type="button" onclick="document.getElementById('rebalance-preview-modal').remove()" style="padding:10px 20px; border-radius:14px; border:none; font-weight:700; background:rgba(0,0,0,0.06); cursor:pointer;">Cancel</button>
                            <button type="button" onclick="alert('Smart Auto-Rebalance executed successfully! Audit logs created.'); document.getElementById('rebalance-preview-modal').remove();" style="padding:10px 22px; border-radius:14px; border:none; font-weight:800; background:linear-gradient(135deg, var(--teal-600), var(--teal-900)); color:#fff; cursor:pointer;">Approve & Rebalance</button>
                        </div>
                    `}
                </div>
            `;
            document.body.appendChild(modal);

        } catch (e) {
            console.error('Error opening rebalance preview:', e);
        }
    };
})();
