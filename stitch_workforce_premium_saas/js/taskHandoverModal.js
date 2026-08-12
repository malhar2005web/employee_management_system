/**
 * Enterprise Task Handover & Ownership Engine (Frontend Glass Module)
 * Features:
 * - Employee Handover Request (Mode, Reason Category, Mandatory Rationale)
 * - Admin Approval Inbox Glass Modal (Evaluate, Select Target Assignee, Approve / Reject)
 * - Zero Browser Native Dialogs (Pure Liquid Glass UI & Toasts)
 * - Immutable Audit Timeline Visualizer
 */
(function() {
    let currentTaskId = null;
    let currentTaskName = '';
    let employeesList = [];

    const init = async () => {
        await fetchEmployees();
        createModalContainers();
    };

    const fetchEmployees = async () => {
        try {
            let res = await fetch('/api/v1/admin/employees');
            let data = await res.json();
            if (data.success && Array.isArray(data.data) && data.data.length > 0) {
                employeesList = data.data.map(e => ({
                    id: e.id,
                    full_name: e.full_name || `${e.first_name || ''} ${e.last_name || ''}`.trim(),
                    designation_name: e.designation_name || e.designation || e.role || 'Employee'
                }));
                return;
            }

            res = await fetch('/api/v1/employee/chat/contacts');
            data = await res.json();
            if (data.success && Array.isArray(data.data)) {
                employeesList = data.data;
            }
        } catch (e) {
            console.error('Failed to load employees for handover modal:', e);
        }
    };

    // Custom Glass Toast Notification
    const showToast = (message, type = 'info') => {
        let toastContainer = document.getElementById('glass-toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'glass-toast-container';
            toastContainer.style.cssText = 'position:fixed; bottom:24px; right:24px; z-index:999999; display:flex; flex-direction:column; gap:10px; pointer-events:none;';
            document.body.appendChild(toastContainer);
        }

        const toast = document.createElement('div');
        const isSuccess = type === 'success';
        const isError = type === 'error';

        toast.style.cssText = `
            pointer-events:auto;
            padding:14px 20px;
            border-radius:16px;
            background:${isSuccess ? 'rgba(16, 185, 129, 0.95)' : isError ? 'rgba(239, 68, 68, 0.95)' : 'rgba(15, 23, 42, 0.95)'};
            color:#fff;
            font-size:13.5px;
            font-weight:700;
            backdrop-filter:blur(12px);
            box-shadow:0 10px 30px rgba(0,0,0,0.25);
            border:1px solid rgba(255,255,255,0.3);
            display:flex;
            align-items:center;
            gap:10px;
            animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        `;

        const icon = isSuccess ? '<i class="fa-solid fa-circle-check"></i>' : isError ? '<i class="fa-solid fa-circle-xmark"></i>' : '<i class="fa-solid fa-circle-info"></i>';
        toast.innerHTML = `${icon} <span>${message}</span>`;
        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    };

    const createModalContainers = () => {
        // 1. Employee Handover Modal Container
        if (!document.getElementById('handover-modal-overlay')) {
            const overlay = document.createElement('div');
            overlay.id = 'handover-modal-overlay';
            overlay.style.cssText = 'display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); backdrop-filter:blur(12px); z-index:99999; align-items:center; justify-content:center; padding:20px;';

            overlay.innerHTML = `
                <div class="modal-card glass" style="width:100%; max-width:580px; background:rgba(255,255,255,0.92); border-radius:24px; border:1px solid rgba(255,255,255,0.6); box-shadow:0 16px 48px rgba(0,0,0,0.2); overflow:hidden; display:flex; flex-direction:column; max-height:90vh;">
                    
                    <!-- Modal Header -->
                    <div style="padding:20px 24px; background:linear-gradient(135deg, rgba(22,160,133,0.1), rgba(12,74,64,0.15)); border-bottom:1px solid rgba(0,0,0,0.06); display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <div style="display:flex; align-items:center; gap:8px;">
                                <span class="status-pill progress" style="font-weight:900; font-size:10px; padding:3px 8px;">HANDOVER REQUEST</span>
                                <span id="handover-task-id-badge" style="font-size:12px; font-weight:700; color:var(--text-muted);">Task #--</span>
                            </div>
                            <h3 style="margin:4px 0 0 0; font-size:18px; font-weight:800; color:var(--teal-900);" id="handover-modal-title">Request Handover / Transfer</h3>
                        </div>
                        <i class="fa-solid fa-xmark" onclick="window.closeHandoverModal()" style="font-size:20px; cursor:pointer; color:var(--text-muted); padding:6px;"></i>
                    </div>

                    <!-- Step 1: Configuration Form (NO target employee select - Admin decides) -->
                    <div id="handover-step-1" style="padding:24px; overflow-y:auto; flex:1;">
                        <input type="hidden" id="handover-task-id">

                        <!-- Handover Mode Selector -->
                        <div class="form-group" style="margin-bottom:18px;">
                            <label style="font-size:12px; font-weight:800; color:var(--text-muted); text-transform:uppercase; display:block; margin-bottom:8px;">Handover Mode</label>
                            <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:8px;">
                                <button type="button" class="handover-mode-btn active" data-mode="Reassignment" style="padding:10px; border-radius:12px; font-weight:700; font-size:12px; border:1px solid var(--teal-600); background:linear-gradient(135deg, var(--teal-600), var(--teal-900)); color:#fff; cursor:pointer;">
                                    <i class="fa-solid fa-arrow-right-arrow-left"></i> Reassign
                                </button>
                                <button type="button" class="handover-mode-btn" data-mode="Delegation" style="padding:10px; border-radius:12px; font-weight:700; font-size:12px; border:1px solid rgba(0,0,0,0.1); background:rgba(0,0,0,0.03); color:var(--text-dark); cursor:pointer;">
                                    <i class="fa-solid fa-user-clock"></i> Delegate
                                </button>
                                <button type="button" class="handover-mode-btn" data-mode="Return" style="padding:10px; border-radius:12px; font-weight:700; font-size:12px; border:1px solid rgba(0,0,0,0.1); background:rgba(0,0,0,0.03); color:var(--text-dark); cursor:pointer;">
                                    <i class="fa-solid fa-rotate-left"></i> Return
                                </button>
                                <button type="button" class="handover-mode-btn" data-mode="Escalation" style="padding:10px; border-radius:12px; font-weight:700; font-size:12px; border:1px solid rgba(0,0,0,0.1); background:rgba(0,0,0,0.03); color:var(--text-dark); cursor:pointer;">
                                    <i class="fa-solid fa-bolt"></i> Escalate
                                </button>
                            </div>
                        </div>

                        <!-- Reason Category Grid -->
                        <div class="form-group" style="margin-bottom:18px;">
                            <label style="font-size:12px; font-weight:800; color:var(--text-muted); text-transform:uppercase; display:block; margin-bottom:8px;">Reason Category</label>
                            <select id="handover-reason-code" class="form-control" style="width:100%; padding:10px 14px; border-radius:12px; border:1px solid rgba(0,0,0,0.15); font-weight:700; font-size:13.5px; background:#fff;">
                                <option value="WORKLOAD">⚖️ Workload Balancing</option>
                                <option value="LEAVE">🌴 Employee Leave</option>
                                <option value="SKILL">💡 Skill Alignment / Expertise</option>
                                <option value="PROJECT_CHANGE">📌 Project Re-alignment</option>
                                <option value="CUSTOMER">🤝 Customer Request</option>
                                <option value="EMERGENCY">🚨 Urgent Emergency</option>
                                <option value="WRONG_ASSIGNMENT">❌ Incorrect Initial Assignment</option>
                                <option value="OTHER">📁 Other Rationale</option>
                            </select>
                        </div>

                        <!-- Detailed Description -->
                        <div class="form-group" style="margin-bottom:18px;">
                            <label style="font-size:12px; font-weight:800; color:var(--text-muted); text-transform:uppercase; display:block; margin-bottom:6px;">Mandatory Rationale Description</label>
                            <textarea id="handover-description" rows="3" class="form-control" style="width:100%; padding:10px 14px; border-radius:12px; border:1px solid rgba(0,0,0,0.15); font-family:inherit; font-size:13px; background:#fff;" placeholder="Explain why you are requesting handover for this task..."></textarea>
                        </div>

                        <!-- Delegation Expiry -->
                        <div class="form-group" id="delegation-expiry-group" style="display:none; margin-bottom:18px;">
                            <label style="font-size:12px; font-weight:800; color:var(--text-muted); text-transform:uppercase; display:block; margin-bottom:6px;">Delegation Expiry Date & Time</label>
                            <input type="datetime-local" id="handover-expiry-at" class="form-control" style="width:100%; padding:10px 14px; border-radius:12px; border:1px solid rgba(0,0,0,0.15); font-weight:600; font-size:13px; background:#fff;">
                        </div>

                        <!-- Admin Approval Notice -->
                        <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-radius:14px; background:rgba(22,160,133,0.08); border:1px solid rgba(22,160,133,0.25);">
                            <div>
                                <div style="font-size:13px; font-weight:800; color:var(--teal-900);">Admin Review & Selection Enforced</div>
                                <div style="font-size:11px; color:var(--text-muted);">Request is sent to Admin. Admin evaluates & selects the new assignee.</div>
                            </div>
                            <i class="fa-solid fa-user-shield" style="font-size:20px; color:var(--teal-600);"></i>
                        </div>
                    </div>

                    <!-- Step 2: Transfer Preview Card -->
                    <div id="handover-step-2" style="display:none; padding:24px; flex:1;">
                        <div style="padding:16px; border-radius:16px; background:linear-gradient(135deg, rgba(22,160,133,0.08), rgba(12,74,64,0.12)); border:1px solid rgba(22,160,133,0.3); margin-bottom:16px;">
                            <div style="font-size:12px; font-weight:800; color:var(--teal-900); text-transform:uppercase; margin-bottom:12px;">🔍 Request Preview</div>
                            
                            <div style="display:grid; grid-template-columns:1fr auto 1fr; align-items:center; gap:12px; text-align:center; background:#fff; padding:16px; border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.05); margin-bottom:14px;">
                                <div>
                                    <div style="font-size:11px; color:var(--text-muted); font-weight:700;">REQUESTER</div>
                                    <div style="font-size:14px; font-weight:800; color:var(--text-dark); margin-top:2px;">You</div>
                                </div>
                                <div style="color:var(--teal-600); font-size:18px;"><i class="fa-solid fa-arrow-right"></i></div>
                                <div>
                                    <div style="font-size:11px; color:var(--text-muted); font-weight:700;">NEW ASSIGNEE</div>
                                    <div style="font-size:13px; font-weight:800; color:var(--teal-900); margin-top:2px;">Pending Admin Assignment</div>
                                </div>
                            </div>

                            <div style="display:flex; flex-direction:column; gap:8px; font-size:12.5px;">
                                <div style="display:flex; justify-content:space-between;"><span style="color:var(--text-muted);">Handover Mode:</span><strong id="preview-mode">Reassignment</strong></div>
                                <div style="display:flex; justify-content:space-between;"><span style="color:var(--text-muted);">Reason Category:</span><strong id="preview-reason">Workload Balancing</strong></div>
                                <div style="display:flex; justify-content:space-between;"><span style="color:var(--text-muted);">Approval Workflow:</span><strong style="color:var(--teal-700);">Admin Evaluation & Reassignment</strong></div>
                            </div>
                        </div>

                        <div style="font-size:12px; color:var(--text-muted); background:rgba(0,0,0,0.03); padding:10px 14px; border-radius:10px;">
                            <i class="fa-solid fa-shield-halved"></i> Admin will review your request details and assign the task to an available employee.
                        </div>
                    </div>

                    <!-- Modal Footer -->
                    <div style="padding:16px 24px; background:rgba(0,0,0,0.02); border-top:1px solid rgba(0,0,0,0.06); display:flex; justify-content:space-between; align-items:center;">
                        <button type="button" id="btn-handover-back" onclick="window.prevHandoverStep()" style="display:none; padding:9px 18px; border-radius:20px; font-size:13px; font-weight:700; background:rgba(0,0,0,0.06); border:none; color:var(--text-dark); cursor:pointer;">
                            <i class="fa-solid fa-arrow-left"></i> Back
                        </button>

                        <div style="display:flex; gap:10px; margin-left:auto;">
                            <button type="button" onclick="window.closeHandoverModal()" style="padding:9px 18px; border-radius:20px; font-size:13px; font-weight:700; background:rgba(0,0,0,0.06); border:none; color:var(--text-dark); cursor:pointer;">Cancel</button>
                            <button type="button" id="btn-handover-next" onclick="window.nextHandoverStep()" style="padding:9px 22px; border-radius:20px; font-size:13px; font-weight:800; background:linear-gradient(135deg, var(--teal-600), var(--teal-900)); border:none; color:#fff; cursor:pointer; box-shadow:0 4px 12px rgba(12,74,64,0.25);">
                                Preview Request <i class="fa-solid fa-arrow-right"></i>
                            </button>
                            <button type="button" id="btn-handover-submit" onclick="window.submitHandover()" style="display:none; padding:9px 24px; border-radius:20px; font-size:13px; font-weight:800; background:linear-gradient(135deg, var(--teal-600), var(--teal-900)); border:none; color:#fff; cursor:pointer; box-shadow:0 4px 12px rgba(12,74,64,0.3);">
                                <i class="fa-solid fa-paper-plane"></i> Submit to Admin
                            </button>
                        </div>
                    </div>

                </div>
            `;
            document.body.appendChild(overlay);

            // Bind Mode Clicks
            document.querySelectorAll('.handover-mode-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    document.querySelectorAll('.handover-mode-btn').forEach(b => {
                        b.classList.remove('active');
                        b.style.background = 'rgba(0,0,0,0.03)';
                        b.style.color = 'var(--text-dark)';
                        b.style.borderColor = 'rgba(0,0,0,0.1)';
                    });

                    const target = e.currentTarget;
                    target.classList.add('active');
                    target.style.background = 'linear-gradient(135deg, var(--teal-600), var(--teal-900))';
                    target.style.color = '#fff';
                    target.style.borderColor = 'var(--teal-600)';

                    const mode = target.dataset.mode;
                    const expiryGroup = document.getElementById('delegation-expiry-group');
                    if (expiryGroup) {
                        expiryGroup.style.display = mode === 'Delegation' ? 'block' : 'none';
                    }
                });
            });
        }

        // 2. Admin Handover Approvals Glass Modal Container
        if (!document.getElementById('admin-approvals-modal-overlay')) {
            const adminOverlay = document.createElement('div');
            adminOverlay.id = 'admin-approvals-modal-overlay';
            adminOverlay.style.cssText = 'display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); backdrop-filter:blur(14px); z-index:99999; align-items:center; justify-content:center; padding:20px;';

            adminOverlay.innerHTML = `
                <div class="modal-card glass" style="width:100%; max-width:760px; background:rgba(255,255,255,0.94); border-radius:24px; border:1px solid rgba(255,255,255,0.6); box-shadow:0 20px 60px rgba(0,0,0,0.3); overflow:hidden; display:flex; flex-direction:column; max-height:90vh;">
                    
                    <!-- Admin Header -->
                    <div style="padding:20px 24px; background:linear-gradient(135deg, rgba(22,160,133,0.15), rgba(12,74,64,0.2)); border-bottom:1px solid rgba(0,0,0,0.08); display:flex; justify-content:space-between; align-items:center;">
                        <div style="display:flex; align-items:center; gap:12px;">
                            <div style="width:40px; height:40px; border-radius:12px; background:linear-gradient(135deg, var(--teal-600), var(--teal-900)); color:#fff; display:flex; align-items:center; justify-content:center; font-size:18px; box-shadow:0 4px 12px rgba(12,74,64,0.3);">
                                <i class="fa-solid fa-user-shield"></i>
                            </div>
                            <div>
                                <h3 style="margin:0; font-size:18px; font-weight:800; color:var(--teal-900);">Handover Approvals & Task Reassignment</h3>
                                <p style="margin:2px 0 0 0; font-size:12px; color:var(--text-muted);">Evaluate employee requests, verify rationale, and reassign tasks.</p>
                            </div>
                        </div>
                        <i class="fa-solid fa-xmark" onclick="window.closeAdminApprovalsModal()" style="font-size:20px; cursor:pointer; color:var(--text-muted); padding:6px;"></i>
                    </div>

                    <!-- Admin Content Area -->
                    <div id="admin-approvals-content" style="padding:24px; overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:16px;">
                        <div style="text-align:center; padding:40px; color:var(--text-muted);">
                            <i class="fa-solid fa-spinner fa-spin" style="font-size:24px; color:var(--teal-600);"></i>
                            <div style="margin-top:10px; font-weight:600;">Loading pending handover requests...</div>
                        </div>
                    </div>

                </div>
            `;
            document.body.appendChild(adminOverlay);
        }
    };

    window.openHandoverModal = (taskId, taskTitle = '') => {
        currentTaskId = taskId;
        currentTaskName = taskTitle;

        createModalContainers();

        document.getElementById('handover-task-id').value = taskId;
        document.getElementById('handover-task-id-badge').textContent = `Task #${taskId}`;

        window.prevHandoverStep();

        const overlay = document.getElementById('handover-modal-overlay');
        if (overlay) overlay.style.display = 'flex';
    };

    window.closeHandoverModal = () => {
        const overlay = document.getElementById('handover-modal-overlay');
        if (overlay) overlay.style.display = 'none';
    };

    window.closeAdminApprovalsModal = () => {
        const overlay = document.getElementById('admin-approvals-modal-overlay');
        if (overlay) overlay.style.display = 'none';
    };

    window.nextHandoverStep = () => {
        const descText = document.getElementById('handover-description');

        if (!descText.value.trim()) {
            showToast('Please provide a mandatory handover rationale description.', 'error');
            return;
        }

        const modeBtn = document.querySelector('.handover-mode-btn.active');
        const mode = modeBtn ? modeBtn.dataset.mode : 'Reassignment';
        const reasonSelect = document.getElementById('handover-reason-code');
        const reasonText = reasonSelect.options[reasonSelect.selectedIndex].text;

        document.getElementById('preview-mode').textContent = mode;
        document.getElementById('preview-reason').textContent = reasonText;

        document.getElementById('handover-step-1').style.display = 'none';
        document.getElementById('handover-step-2').style.display = 'block';
        document.getElementById('btn-handover-back').style.display = 'block';
        document.getElementById('btn-handover-next').style.display = 'none';
        document.getElementById('btn-handover-submit').style.display = 'block';
    };

    window.prevHandoverStep = () => {
        document.getElementById('handover-step-1').style.display = 'block';
        document.getElementById('handover-step-2').style.display = 'none';
        document.getElementById('btn-handover-back').style.display = 'none';
        document.getElementById('btn-handover-next').style.display = 'block';
        document.getElementById('btn-handover-submit').style.display = 'none';
    };

    window.submitHandover = async () => {
        const modeBtn = document.querySelector('.handover-mode-btn.active');
        const transferType = modeBtn ? modeBtn.dataset.mode : 'Reassignment';
        const reasonCode = document.getElementById('handover-reason-code').value;
        const reasonDescription = document.getElementById('handover-description').value.trim();
        const expiryAt = document.getElementById('handover-expiry-at').value || null;

        try {
            const res = await fetch('/api/v1/task-handover/transfer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    taskId: currentTaskId,
                    transferType,
                    reasonCode,
                    reasonDescription,
                    expiryAt
                })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                showToast(data.message || 'Handover request submitted to Admin!', 'success');
                window.closeHandoverModal();

                if (typeof loadEmployeeTasks === 'function') loadEmployeeTasks();
                if (typeof loadDashboardTasks === 'function') loadDashboardTasks();
            } else {
                showToast(data.message || 'Failed to submit handover', 'error');
            }
        } catch (e) {
            console.error('Error submitting handover:', e);
            showToast('Handover submission failed', 'error');
        }
    };

    // Admin Handover Approvals Inbox Glass Modal Function (NO alert/prompt dialogs)
    window.openAdminApprovalsInbox = async () => {
        createModalContainers();

        const adminOverlay = document.getElementById('admin-approvals-modal-overlay');
        const contentContainer = document.getElementById('admin-approvals-content');

        if (!adminOverlay || !contentContainer) return;

        adminOverlay.style.display = 'flex';
        contentContainer.innerHTML = `
            <div style="text-align:center; padding:40px; color:var(--text-muted);">
                <i class="fa-solid fa-spinner fa-spin" style="font-size:24px; color:var(--teal-600);"></i>
                <div style="margin-top:10px; font-weight:600;">Loading pending handover requests...</div>
            </div>
        `;

        await fetchEmployees();

        try {
            const res = await fetch('/api/v1/task-handover/approvals/pending');
            const data = await res.json();

            if (!data.success || !Array.isArray(data.data) || data.data.length === 0) {
                contentContainer.innerHTML = `
                    <div style="text-align:center; padding:48px 20px; color:var(--text-muted);">
                        <i class="fa-solid fa-circle-check" style="font-size:48px; color:var(--teal-600); margin-bottom:12px;"></i>
                        <h4 style="margin:0; font-size:16px; font-weight:800; color:var(--teal-900);">All Handover Requests Cleared!</h4>
                        <p style="margin:4px 0 0 0; font-size:13px;">There are currently no pending task transfer requests requiring Admin action.</p>
                    </div>
                `;
                return;
            }

            const items = data.data;
            contentContainer.innerHTML = items.map(item => `
                <div class="approval-card" id="transfer-card-${item.transfer_id}" style="background:#fff; border-radius:18px; border:1px solid rgba(0,0,0,0.08); padding:20px; box-shadow:0 4px 16px rgba(0,0,0,0.04); display:flex; flex-direction:column; gap:14px;">
                    
                    <!-- Card Header -->
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid rgba(0,0,0,0.05); padding-bottom:12px;">
                        <div>
                            <div style="display:flex; align-items:center; gap:8px;">
                                <span class="status-pill progress" style="font-size:10px; font-weight:800; padding:2px 8px;">REQUEST #${item.transfer_id}</span>
                                <span style="font-size:12px; font-weight:700; color:var(--text-muted);">${new Date(item.created_at).toLocaleString('en-IN', { dateStyle:'short', timeStyle:'short' })}</span>
                            </div>
                            <h4 style="margin:6px 0 0 0; font-size:15px; font-weight:800; color:var(--text-dark);">${item.task_title} (Task #${item.task_id})</h4>
                        </div>
                        <span class="status-pill warning" style="font-weight:800; font-size:11px;">${item.reason_code}</span>
                    </div>

                    <!-- Details Grid -->
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; font-size:13px; background:rgba(0,0,0,0.02); padding:12px 14px; border-radius:12px;">
                        <div>
                            <span style="color:var(--text-muted); font-size:11px; font-weight:700; display:block;">REQUESTED BY (CURRENT OWNER)</span>
                            <strong style="color:var(--text-dark);">${item.requested_by_name}</strong>
                        </div>
                        <div>
                            <span style="color:var(--text-muted); font-size:11px; font-weight:700; display:block;">PROJECT / DEPT HEAD</span>
                            <strong style="color:var(--teal-900);">${item.project_head_name || 'Project Lead'}</strong>
                        </div>
                    </div>

                    <!-- Rationale Description -->
                    <div style="font-size:13px; color:var(--text-dark); line-height:1.4; background:rgba(22,160,133,0.05); padding:10px 14px; border-radius:10px; border-left:3px solid var(--teal-600);">
                        <span style="font-weight:800; color:var(--teal-900);">Rationale:</span> "${item.reason_description}"
                    </div>

                    <!-- Admin Decision Form Area -->
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; border-top:1px solid rgba(0,0,0,0.06); padding-top:14px; align-items:center;">
                        <div>
                            <label style="font-size:11px; font-weight:800; color:var(--teal-900); text-transform:uppercase; display:block; margin-bottom:4px;">Select New Assignee *</label>
                            <select id="admin-assignee-select-${item.transfer_id}" style="width:100%; padding:8px 12px; border-radius:10px; border:1px solid rgba(0,0,0,0.15); font-weight:700; font-size:12.5px; background:#fff;">
                                <option value="">-- Choose Employee --</option>
                                ${employeesList.map(e => `<option value="${e.id}">${e.full_name} (${e.designation_name || 'Employee'})</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label style="font-size:11px; font-weight:800; color:var(--text-muted); text-transform:uppercase; display:block; margin-bottom:4px;">Admin Notes / Reason</label>
                            <input type="text" id="admin-comments-${item.transfer_id}" placeholder="Optional admin note..." style="width:100%; padding:8px 12px; border-radius:10px; border:1px solid rgba(0,0,0,0.15); font-size:12.5px; background:#fff;">
                        </div>
                    </div>

                    <!-- Action Buttons -->
                    <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:4px;">
                        <button type="button" onclick="window.respondToAdminTransfer(${item.transfer_id}, 'Rejected')" style="padding:8px 16px; border-radius:18px; font-weight:800; font-size:12px; background:rgba(239, 68, 68, 0.1); color:#dc2626; border:1px solid rgba(239, 68, 68, 0.3); cursor:pointer;">
                            <i class="fa-solid fa-xmark"></i> Reject Request
                        </button>
                        <button type="button" onclick="window.respondToAdminTransfer(${item.transfer_id}, 'Approved')" style="padding:8px 20px; border-radius:18px; font-weight:800; font-size:12px; background:linear-gradient(135deg, var(--teal-600), var(--teal-900)); color:#fff; border:none; cursor:pointer; box-shadow:0 4px 12px rgba(12,74,64,0.25);">
                            <i class="fa-solid fa-check"></i> Approve & Reassign
                        </button>
                    </div>

                </div>
            `).join('');

        } catch (e) {
            console.error('Error fetching admin approvals:', e);
            contentContainer.innerHTML = `<div style="text-align:center; padding:30px; color:#ef4444; font-weight:700;">Failed to load handover requests.</div>`;
        }
    };

    // Execute Admin Approval / Rejection Response
    window.respondToAdminTransfer = async (transferId, status) => {
        const select = document.getElementById(`admin-assignee-select-${transferId}`);
        const commentsInput = document.getElementById(`admin-comments-${transferId}`);

        const newAssigneeId = select ? parseInt(select.value, 10) : null;
        const comments = commentsInput ? commentsInput.value.trim() : '';

        if (status === 'Approved' && !newAssigneeId) {
            showToast('Please select a target employee to reassign the task to.', 'error');
            return;
        }

        try {
            const resp = await fetch('/api/v1/task-handover/approvals/respond', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transferId,
                    status,
                    newAssigneeId,
                    comments: comments || (status === 'Approved' ? 'Approved & Reassigned by Admin' : 'Rejected by Admin')
                })
            });

            const respData = await resp.json();
            if (resp.ok && respData.success) {
                showToast(status === 'Approved' ? 'Task reassigned successfully!' : 'Handover request rejected.', 'success');

                // Animate card removal
                const card = document.getElementById(`transfer-card-${transferId}`);
                if (card) {
                    card.style.opacity = '0';
                    card.style.transform = 'scale(0.95)';
                    card.style.transition = 'all 0.3s ease';
                    setTimeout(() => {
                        card.remove();
                        const content = document.getElementById('admin-approvals-content');
                        if (content && content.children.length === 0) {
                            window.openAdminApprovalsInbox();
                        }
                    }, 300);
                }

                if (typeof loadEmployeeTasks === 'function') loadEmployeeTasks();
                if (typeof loadDashboardTasks === 'function') loadDashboardTasks();
            } else {
                showToast(respData.message || 'Failed to update handover status', 'error');
            }

        } catch (e) {
            console.error('Error responding to transfer:', e);
            showToast('Response submission failed', 'error');
        }
    };

    // Timeline Visualizer Function
    window.viewTaskTimeline = async (taskId) => {
        try {
            const res = await fetch(`/api/v1/task-handover/${taskId}/timeline`);
            const data = await res.json();

            if (!data.success || !Array.isArray(data.data) || data.data.length === 0) {
                showToast('No timeline history found for this task.', 'info');
                return;
            }

            const events = data.data;
            let timelineHtml = events.map(e => `${e.action} at ${new Date(e.created_at).toLocaleTimeString()}: ${e.comments || e.reason_code || ''}`).join('\n');
            showToast(`Task Timeline Audit:\n${timelineHtml.substring(0, 100)}...`, 'info');

        } catch (e) {
            console.error('Error loading timeline:', e);
        }
    };

    document.addEventListener('DOMContentLoaded', init);
})();
