// KRA & Performance Appraisal — Employee Self-Assessment Controller

let currentEmployeeId = 1; // Default or fetched from session
let currentCycleId = 1;
let currentMetrics = [];
let isFormLocked = false;

const CATEGORY_META = {
    'FINANCIAL': { name: 'Financial Perspective (Cost, Opex & CCPC)', icon: 'fa-coins', color: '#0d9488' },
    'CUSTOMER': { name: 'Customer Service Level (Plan Attainment & OTIF)', icon: 'fa-handshake', color: '#2563eb' },
    'OPERATIONS_QUALITY': { name: 'Operations, Maintenance & QMS (Quality, SOPs, Audits)', icon: 'fa-gears', color: '#7c3aed' },
    'SAFETY_EHS': { name: 'Learning, Growth & EHS (Zero Incidents & Training)', icon: 'fa-shield-halved', color: '#059669' },
    'CUSTOM': { name: 'Operational Role-Specific Deliverables', icon: 'fa-star', color: '#d97706' }
};

document.addEventListener('DOMContentLoaded', async () => {
    await fetchCurrentUser();
    await loadEmployeeAssessment();
    document.getElementById('btn-submit-self').addEventListener('click', handleSubmitSelfAssessment);
});

async function fetchCurrentUser() {
    try {
        const res = await fetch('/api/v1/employee/profile');
        if (res.ok) {
            const json = await res.json();
            if (json.success && json.data) {
                currentEmployeeId = json.data.id || json.data.employee_id || 1;
                document.getElementById('user-display-name').textContent = json.data.full_name || 'My Workspace';
                document.getElementById('user-designation').textContent = json.data.designation_name || 'Employee';
                if (document.getElementById('profile-name')) {
                    document.getElementById('profile-name').textContent = json.data.full_name || 'Employee';
                }
            }
        }
    } catch (e) {
        console.log('Using default employee session');
    }
}

async function loadEmployeeAssessment() {
    try {
        const res = await fetch(`/api/kra/assessments/${currentEmployeeId}?cycleId=${currentCycleId}`);
        const json = await res.json();

        if (json.success) {
            currentMetrics = json.data || [];
            const summary = json.summary || {};

            isFormLocked = (summary.overallStatus && summary.overallStatus !== 'draft');
            updateStatusUI(summary);
            renderTopStats(summary);
            renderAssessmentCards(currentMetrics);
        }
    } catch (err) {
        console.error('Error loading employee assessments:', err);
    }
}

function updateStatusUI(summary) {
    const badge = document.getElementById('workflow-status-badge');
    const lockBanner = document.getElementById('locked-status-banner');
    const submitBar = document.getElementById('bottom-submit-bar');

    const status = summary.overallStatus || 'draft';
    badge.textContent = status.toUpperCase().replace(/_/g, ' ');

    if (isFormLocked) {
        lockBanner.style.display = 'block';
        lockBanner.innerHTML = `<i class="fa-solid fa-lock"></i> Assessment Status: <strong>${status.toUpperCase().replace(/_/g, ' ')}</strong> (Locked for Review)`;
        submitBar.style.display = 'none';
    } else {
        lockBanner.style.display = 'none';
        submitBar.style.display = 'flex';
    }
}

function renderTopStats(summary) {
    document.getElementById('stat-count').textContent = currentMetrics.length;
    
    const categories = new Set(currentMetrics.map(m => m.category));
    document.getElementById('stat-cat').textContent = `${categories.size} Categories`;

    document.getElementById('stat-weightage').textContent = `${summary.totalWeightage || 0}%`;

    // Progress
    let completedCount = 0;
    currentMetrics.forEach(m => {
        if (m.self_rating !== null && m.self_rating !== undefined) completedCount++;
    });
    document.getElementById('stat-progress').textContent = `${completedCount} / ${currentMetrics.length}`;
    
    const progBadge = document.getElementById('stat-progress-badge');
    if (completedCount === currentMetrics.length && currentMetrics.length > 0) {
        progBadge.style.background = '#dcfce7';
        progBadge.style.color = '#15803d';
        progBadge.textContent = 'All Measures Evaluated';
    } else {
        progBadge.style.background = '#fef3c7';
        progBadge.style.color = '#b45309';
        progBadge.textContent = `${currentMetrics.length - completedCount} Measures Pending`;
    }

    const calcScore = summary.employeeWeightedScore || 0;
    document.getElementById('stat-calc-score').textContent = `${calcScore.toFixed(2)} / 6.00`;
}

function renderAssessmentCards(metrics) {
    const container = document.getElementById('kra-cards-container');
    if (metrics.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:60px; background:rgba(255,255,255,0.45); border-radius:16px; border:1px dashed #cbd5e1;">
                <i class="fa-solid fa-clipboard-check" style="font-size:42px; color:#94a3b8; margin-bottom:12px;"></i>
                <h3 style="margin:0 0 6px 0; font-size:17px; font-weight:800; color:var(--teal-900);">No KRAs Assigned Yet</h3>
                <p style="margin:0; font-size:13px; color:var(--text-muted);">Your reporting manager or HR will publish your performance measures for FY 2026-27 soon.</p>
            </div>
        `;
        return;
    }

    let html = '';
    metrics.forEach((m, idx) => {
        const meta = CATEGORY_META[m.category] || { name: m.category_display || m.category, icon: 'fa-tag', color: '#0d9488' };
        const actualVal = m.actual_achieved !== null ? m.actual_achieved : '';
        const suggested = m.suggested_score !== null ? m.suggested_score : 4;
        const selfRating = m.self_rating !== null ? m.self_rating : (m.suggested_score !== null ? m.suggested_score : 4);
        const reasoning = m.self_reasoning || '';

        // Proofs chips
        let proofsHtml = '';
        if (m.proofs && m.proofs.length > 0) {
            proofsHtml = m.proofs.map(p => `
                <div class="proof-item-chip" id="proof-chip-${p.id}">
                    <i class="fa-solid fa-file-lines" style="color:var(--primary-color);"></i>
                    <a href="${p.file_path}" target="_blank" style="text-decoration:none; color:inherit;">${escapeHtml(p.file_name)}</a>
                    ${!isFormLocked ? `<i class="fa-solid fa-xmark remove-proof" onclick="deleteProof(${p.id}, ${m.assessment_id})"></i>` : ''}
                </div>
            `).join('');
        }

        html += `
            <div class="kra-assessment-card" data-metric-id="${m.metric_id}" data-assessment-id="${m.assessment_id}">
                <div class="measure-header">
                    <div>
                        <div style="font-size:11.5px; font-weight:800; color:${meta.color}; text-transform:uppercase; margin-bottom:3px;">
                            <i class="fa-solid ${meta.icon}"></i> ${meta.name}
                        </div>
                        <h2 class="measure-title">${idx + 1}. ${escapeHtml(m.measure_name)}</h2>
                        <p class="measure-desc">${escapeHtml(m.objective || 'Complete agreed targets with verified documentation')}</p>
                    </div>

                    <div style="display:flex; align-items:center; gap:8px;">
                        <span class="stat-badge" style="background:#e0f2fe; color:#0369a1; font-size:13px; font-weight:800;">
                            Target: ${escapeHtml(m.target_display || `${m.target_value}${m.target_unit}`)}
                        </span>
                        <span class="stat-badge" style="background:#fef3c7; color:#92400e; font-size:13px; font-weight:800;">
                            Weightage: ${m.weightage}%
                        </span>
                        <span class="scale-pill" onclick="viewThresholdDetails(${m.metric_id})">
                            <i class="fa-solid fa-magnifying-glass"></i> View 0–6 Benchmark Scale
                        </span>
                    </div>
                </div>

                <div class="evaluation-grid">
                    <!-- Column 1: Actual Achievement & Auto-Score -->
                    <div class="input-group-kra">
                        <label>1. Actual Achievement (${escapeHtml(m.target_unit || '%')}) *</label>
                        <input type="number" step="0.001" class="actual-achieved-input" value="${actualVal}" placeholder="Enter actual achieved number (e.g. 98.5)" ${isFormLocked ? 'disabled' : ''} oninput="handleActualInput(${m.metric_id}, this.value)">
                        
                        <div class="suggested-score-banner" id="banner-score-${m.metric_id}">
                            <i class="fa-solid fa-lightbulb" style="color:#16a34a; font-size:16px;"></i>
                            <div>
                                <div style="font-size:12px; font-weight:800; color:#15803d;" class="suggested-text">
                                    System Auto-Score: ${suggested}/6
                                </div>
                                <div style="font-size:11px; color:#166534;" class="suggested-desc">
                                    Calculated automatically against 0–6 target scale
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Column 2: Self Rating Selection -->
                    <div class="input-group-kra">
                        <label>2. Your Self Rating (Scale 0 to 6) *</label>
                        <select class="self-rating-select" id="select-rating-${m.metric_id}" ${isFormLocked ? 'disabled' : ''} onchange="recalculateTotals()">
                            ${[6,5,4,3,2,1,0].map(s => `<option value="${s}" ${s === selfRating ? 'selected' : ''}>⭐ Rating ${s} of 6</option>`).join('')}
                        </select>
                        <span style="font-size:11.5px; color:var(--text-muted); margin-top:2px;">
                            6 = Outstanding (>110%) | 5 = Exceeds | 4 = Target Met (100%) | 3 = Min Acceptable | 0 = Unachieved
                        </span>
                    </div>
                </div>

                <!-- Reasoning Textarea -->
                <div class="input-group-kra" style="margin-bottom:16px;">
                    <label>3. Self-Assessment Reasoning &amp; Operational Justification *</label>
                    <textarea rows="2" class="self-reasoning-input" placeholder="Explain your achievements, challenges resolved, initiatives taken, and evidence references..." ${isFormLocked ? 'disabled' : ''}>${escapeHtml(reasoning)}</textarea>
                </div>

                <!-- Multi-Proof File Attachment Section -->
                <div>
                    <label style="font-size:12.5px; font-weight:700; color:#334155; display:block; margin-bottom:6px;">
                        4. Evidence / Proof Documents (PDF, Excel, Images, Reports)
                    </label>

                    ${!isFormLocked ? `
                        <div class="proof-uploader-box" onclick="triggerFileUpload(${m.assessment_id})">
                            <i class="fa-solid fa-cloud-arrow-up" style="font-size:22px; color:var(--primary-color);"></i>
                            <div style="font-size:13px; font-weight:700; color:var(--teal-900); margin-top:4px;">
                                Click to Upload Supporting Proof / Report
                            </div>
                            <div style="font-size:11px; color:#64748b;">
                                Supports PDF, Excel (.xlsx, .xls), Word, CSV, Images (Max 25MB)
                            </div>
                            <input type="file" id="file-input-${m.assessment_id}" style="display:none;" onchange="handleFileUpload(event, ${m.assessment_id})">
                        </div>
                    ` : ''}

                    <div class="proof-list" id="proof-list-${m.assessment_id}">
                        ${proofsHtml || '<span style="color:#94a3b8; font-size:12px;">No proof files attached yet</span>'}
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// Live Score Matching on Input
function handleActualInput(metricId, val) {
    const metric = currentMetrics.find(m => m.metric_id === metricId);
    if (!metric || !metric.threshold_matrix) return;

    const numVal = parseFloat(val);
    if (isNaN(numVal)) return;

    const scoreRes = simulateScore(numVal, metric.threshold_matrix);
    const banner = document.getElementById(`banner-score-${metricId}`);
    if (banner) {
        banner.querySelector('.suggested-text').textContent = `System Auto-Score: ${scoreRes.score}/6 [${scoreRes.label}]`;
        banner.querySelector('.suggested-desc').textContent = `Matched against benchmark threshold bracket`;
    }

    // Auto update rating dropdown to match suggested score
    const select = document.getElementById(`select-rating-${metricId}`);
    if (select) {
        select.value = scoreRes.score;
    }

    recalculateTotals();
}

function simulateScore(actualVal, matrix) {
    const scale = matrix.scale || {};
    for (let s = 6; s >= 0; s--) {
        const b = scale[s.toString()];
        if (b && actualVal >= b.min && actualVal <= b.max) {
            return { score: s, label: b.label };
        }
    }
    return { score: 0, label: '< Benchmark' };
}

function recalculateTotals() {
    let totalScore = 0;
    const cards = document.querySelectorAll('.kra-assessment-card');
    cards.forEach(card => {
        const metricId = parseInt(card.getAttribute('data-metric-id'));
        const metric = currentMetrics.find(m => m.metric_id === metricId);
        if (metric) {
            const wt = parseFloat(metric.weightage || 0);
            const rating = parseInt(card.querySelector('.self-rating-select').value) || 0;
            totalScore += (rating * wt) / 100;
        }
    });

    document.getElementById('stat-calc-score').textContent = `${totalScore.toFixed(2)} / 6.00`;
}

// File Upload Trigger
function triggerFileUpload(assessmentId) {
    const input = document.getElementById(`file-input-${assessmentId}`);
    if (input) input.click();
}

async function handleFileUpload(e, assessmentId) {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('proofFile', file);
    formData.append('assessmentId', assessmentId);
    formData.append('employeeId', currentEmployeeId);

    try {
        const res = await fetch('/api/kra/proofs/upload', {
            method: 'POST',
            body: formData
        });
        const json = await res.json();
        if (json.success && json.data) {
            const list = document.getElementById(`proof-list-${assessmentId}`);
            const chip = document.createElement('div');
            chip.className = 'proof-item-chip';
            chip.id = `proof-chip-${json.data.id}`;
            chip.innerHTML = `
                <i class="fa-solid fa-file-lines" style="color:var(--primary-color);"></i>
                <a href="${json.data.file_path}" target="_blank" style="text-decoration:none; color:inherit;">${escapeHtml(json.data.file_name)}</a>
                <i class="fa-solid fa-xmark remove-proof" onclick="deleteProof(${json.data.id}, ${assessmentId})"></i>
            `;
            list.appendChild(chip);
        } else {
            alert(json.message || 'Upload failed');
        }
    } catch (err) {
        console.error('File upload error:', err);
    }
}

async function deleteProof(proofId, assessmentId) {
    if (!confirm('Remove this proof attachment?')) return;
    try {
        const res = await fetch(`/api/kra/proofs/${proofId}`, { method: 'DELETE' });
        const json = await res.json();
        if (json.success) {
            const chip = document.getElementById(`proof-chip-${proofId}`);
            if (chip) chip.remove();
        }
    } catch (err) {
        console.error('Error deleting proof:', err);
    }
}

// View Threshold Scale Popover
function viewThresholdDetails(metricId) {
    const metric = currentMetrics.find(m => m.metric_id === metricId);
    if (!metric || !metric.threshold_matrix || !metric.threshold_matrix.scale) return;

    const scale = metric.threshold_matrix.scale;
    let html = `
        <div style="margin-bottom:14px; font-size:13.5px; font-weight:700; color:#334155;">
            ${escapeHtml(metric.measure_name)} — Target: <strong>${escapeHtml(metric.target_display || '')}</strong>
        </div>
        <div style="display:grid; grid-template-columns: 70px 100px 100px 1fr; gap:8px; background:#f1f5f9; padding:8px; border-radius:6px; font-weight:800; font-size:12px; color:#475569; margin-bottom:8px;">
            <div>Score</div>
            <div>Min Bound</div>
            <div>Max Bound</div>
            <div>Benchmark Criteria</div>
        </div>
    `;

    for (let s = 6; s >= 0; s--) {
        const b = scale[s.toString()] || {};
        html += `
            <div style="display:grid; grid-template-columns: 70px 100px 100px 1fr; gap:8px; align-items:center; padding:8px; border-bottom:1px solid #e2e8f0; font-size:12.5px;">
                <div><span class="rating-badge rating-${s}">${s}</span></div>
                <div style="font-weight:700;">${b.min !== undefined ? b.min : '-'}</div>
                <div style="font-weight:700;">${b.max !== undefined ? b.max : '-'}</div>
                <div style="color:#475569;">${escapeHtml(b.label || '')}</div>
            </div>
        `;
    }

    document.getElementById('view-threshold-title').textContent = `0–6 Threshold Matrix: ${metric.measure_name}`;
    document.getElementById('view-threshold-content').innerHTML = html;
    document.getElementById('modal-view-threshold').classList.add('active');
}

// Level 1: Submit Self-Assessment
async function handleSubmitSelfAssessment() {
    const cards = document.querySelectorAll('.kra-assessment-card');
    const assessments = [];

    let hasEmptyReasoning = false;
    cards.forEach(card => {
        const metricId = parseInt(card.getAttribute('data-metric-id'));
        const actualAchieved = card.querySelector('.actual-achieved-input').value;
        const selfRating = card.querySelector('.self-rating-select').value;
        const selfReasoning = card.querySelector('.self-reasoning-input').value.trim();

        if (!selfReasoning) {
            hasEmptyReasoning = true;
        }

        assessments.push({
            metricId,
            actualAchieved: parseFloat(actualAchieved) || 0,
            selfRating: parseInt(selfRating) || 0,
            selfReasoning
        });
    });

    if (assessments.length === 0) {
        alert('No measures to submit.');
        return;
    }

    if (hasEmptyReasoning) {
        if (!confirm('Some measures do not have reasoning entered. Do you still want to proceed?')) {
            return;
        }
    }

    if (!confirm('Are you sure you want to submit your Level 1 Self-Assessment? This will lock your evaluation and route it to your Reporting Manager.')) {
        return;
    }

    try {
        const res = await fetch('/api/kra/assessments/employee-submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employeeId: currentEmployeeId,
                cycleId: currentCycleId,
                assessments
            })
        });
        const json = await res.json();
        if (json.success) {
            alert('🎉 Level 1: Self-Assessment submitted successfully to your L1 Manager!');
            await loadEmployeeAssessment();
        } else {
            alert(json.message || 'Submission failed');
        }
    } catch (err) {
        console.error('Error submitting self-assessment:', err);
    }
}

function escapeHtml(text) {
    if (!text) return '';
    return text.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
