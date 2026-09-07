// KRA & Performance Appraisal Suite — Admin Console Controller

let currentEmployeeId = null;
let currentCycleId = 1;
let currentMetricsData = [];
let currentAssessmentData = null;

const CATEGORY_META = {
    'FINANCIAL': { name: 'Financial Perspective (Cost, Opex & CCPC)', icon: 'fa-coins', color: '#0d9488' },
    'CUSTOMER': { name: 'Customer Service Level (Plan Attainment & OTIF)', icon: 'fa-handshake', color: '#2563eb' },
    'OPERATIONS_QUALITY': { name: 'Operations, Maintenance & QMS (Quality, SOPs, Audits)', icon: 'fa-gears', color: '#7c3aed' },
    'SAFETY_EHS': { name: 'Learning, Growth & EHS (Zero Incidents & Training)', icon: 'fa-shield-halved', color: '#059669' },
    'CUSTOM': { name: 'Operational Role-Specific Deliverables', icon: 'fa-star', color: '#d97706' }
};

document.addEventListener('DOMContentLoaded', async () => {
    initTabs();
    initThresholdInputs();
    setupEventListeners();
    await loadEmployees();
    await loadCycles();
});

function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn-kra');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content-kra').forEach(c => c.style.display = 'none');
            
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-tab');
            const targetContent = document.getElementById(targetId);
            if (targetContent) targetContent.style.display = 'block';
        });
    });
}

async function loadEmployees() {
    try {
        const res = await fetch('/api/v1/employees');
        const json = await res.json();
        const empSelect = document.getElementById('emp-select');
        empSelect.innerHTML = '';

        if (json.success && json.data && json.data.length > 0) {
            json.data.forEach(emp => {
                const opt = document.createElement('option');
                opt.value = emp.id;
                const dept = emp.department_name ? ` (${emp.department_name})` : '';
                const code = emp.employee_code ? ` [${emp.employee_code}]` : '';
                opt.textContent = `${emp.full_name}${code}${dept}`;
                empSelect.appendChild(opt);
            });
            currentEmployeeId = json.data[0].id;
            await loadEmployeeKRA();
        } else {
            empSelect.innerHTML = '<option value="">No Employees Found</option>';
        }
    } catch (err) {
        console.error('Error loading employees:', err);
    }
}

async function loadCycles() {
    try {
        const res = await fetch('/api/kra/cycles');
        const json = await res.json();
        const cycleSelect = document.getElementById('cycle-select');
        if (json.success && json.data && json.data.length > 0) {
            cycleSelect.innerHTML = '';
            json.data.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = `${c.financial_year} - ${c.cycle_name}`;
                if (c.status === 'active') opt.selected = true;
                cycleSelect.appendChild(opt);
            });
            currentCycleId = cycleSelect.value;
        }
    } catch (err) {
        console.error('Error loading cycles:', err);
    }
}

function setupEventListeners() {
    document.getElementById('emp-select').addEventListener('change', (e) => {
        currentEmployeeId = e.target.value;
        loadEmployeeKRA();
    });

    document.getElementById('cycle-select').addEventListener('change', (e) => {
        currentCycleId = e.target.value;
        loadEmployeeKRA();
    });

    document.getElementById('btn-add-metric').addEventListener('click', () => {
        openMetricModal();
    });

    document.getElementById('form-metric').addEventListener('submit', handleSaveMetric);
    
    document.getElementById('metric-target-val').addEventListener('input', (e) => {
        const val = parseFloat(e.target.value) || 100;
        autoPopulateThresholdScale(val);
    });

    document.getElementById('test-calc-input').addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (isNaN(val)) return;
        const matrix = extractThresholdMatrixFromForm();
        const scoreRes = simulateScore(val, matrix);
        const resBadge = document.getElementById('test-calc-result');
        resBadge.className = `rating-badge rating-${scoreRes.score}`;
        resBadge.style.width = 'auto';
        resBadge.style.padding = '4px 12px';
        resBadge.textContent = `Suggested Score: ${scoreRes.score}/6 [${scoreRes.label}]`;
    });

    document.getElementById('btn-save-l1-review').addEventListener('click', handleSaveL1Review);
    document.getElementById('btn-save-l2-plant').addEventListener('click', handleSaveL2Plant);
    document.getElementById('btn-finalize-hr').addEventListener('click', handleSaveHRFinalize);
    document.getElementById('btn-export-pdf').addEventListener('click', () => {
        window.print();
    });
}

async function loadEmployeeKRA() {
    if (!currentEmployeeId) return;

    try {
        const res = await fetch(`/api/kra/assessments/${currentEmployeeId}?cycleId=${currentCycleId}`);
        const json = await res.json();
        
        if (json.success) {
            currentMetricsData = json.data || [];
            currentAssessmentData = json.summary || {};

            renderTopStats(json.summary);
            renderWeightageBar(json.summary.totalWeightage);
            renderBuilderTab(currentMetricsData);
            renderL1ReviewTab(currentMetricsData);
            renderL2ManagerTab(currentMetricsData);
            renderL3PlantHeadTab(currentMetricsData);
            renderL4HRTab(currentMetricsData, json.summary);
        }
    } catch (err) {
        console.error('Error loading KRA data:', err);
    }
}

function renderTopStats(summary) {
    document.getElementById('stat-metric-count').textContent = currentMetricsData.length;
    
    const categories = new Set(currentMetricsData.map(m => m.category));
    document.getElementById('stat-cat-count').textContent = `${categories.size} Active Categories`;

    const totalWt = summary.totalWeightage || 0;
    document.getElementById('stat-weightage').textContent = `${totalWt}%`;

    const wtBadge = document.getElementById('stat-weightage-badge');
    if (Math.abs(totalWt - 100) < 0.01) {
        wtBadge.style.background = '#dcfce7';
        wtBadge.style.color = '#15803d';
        wtBadge.textContent = '100% (Balanced & Valid)';
    } else if (totalWt < 100) {
        wtBadge.style.background = '#fef3c7';
        wtBadge.style.color = '#b45309';
        wtBadge.textContent = `${(100 - totalWt).toFixed(1)}% Weightage Remaining`;
    } else {
        wtBadge.style.background = '#fee2e2';
        wtBadge.style.color = '#b91c1c';
        wtBadge.textContent = `Exceeds by ${(totalWt - 100).toFixed(1)}%`;
    }

    const workflowStatus = summary.overallStatus || 'draft';
    document.getElementById('stat-workflow-status').textContent = workflowStatus.toUpperCase().replace(/_/g, ' ');

    const score = summary.activeFinalScore || 0;
    document.getElementById('stat-score').textContent = `${score.toFixed(2)} / 6.00`;

    const slab = summary.marsAnalysis ? summary.marsAnalysis.slab : '0%';
    const grade = summary.marsAnalysis ? summary.marsAnalysis.grade : 'Pending';
    document.getElementById('stat-mars-slab').textContent = `MARS: ${slab} (${grade})`;
}

function renderWeightageBar(totalWt) {
    const bar = document.getElementById('weightage-bar');
    const txt = document.getElementById('weightage-text-status');
    const width = Math.min(totalWt, 100);
    bar.style.width = `${width}%`;

    if (Math.abs(totalWt - 100) < 0.01) {
        bar.style.background = 'linear-gradient(90deg, #10b981, #059669)';
        txt.textContent = '✅ 100% Allocated (Ready for Appraisal)';
        txt.style.color = '#059669';
    } else if (totalWt < 100) {
        bar.style.background = 'linear-gradient(90deg, #f59e0b, #d97706)';
        txt.textContent = `⚠️ ${totalWt}% / 100% (${(100 - totalWt).toFixed(1)}% remaining)`;
        txt.style.color = '#d97706';
    } else {
        bar.style.background = '#ef4444';
        txt.textContent = `❌ ${totalWt}% / 100% (Overallocated by ${(totalWt - 100).toFixed(1)}%)`;
        txt.style.color = '#ef4444';
    }
}

function renderBuilderTab(metrics) {
    const container = document.getElementById('kra-categories-container');
    if (metrics.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:60px 20px; background:rgba(255,255,255,0.45); border-radius:16px; border:1px dashed #cbd5e1;">
                <i class="fa-solid fa-folder-open" style="font-size:42px; color:#94a3b8; margin-bottom:12px;"></i>
                <h3 style="margin:0 0 6px 0; font-size:17px; font-weight:800; color:var(--teal-900);">No Measures Defined for this Employee</h3>
                <p style="margin:0 0 16px 0; font-size:13px; color:var(--text-muted);">Define target deliverables, weightages, and 0–6 threshold scale brackets.</p>
                <button class="action-btn-sm btn-primary-kra" onclick="openMetricModal()" style="padding:10px 20px;">
                    <i class="fa-solid fa-plus"></i> Add First Measure
                </button>
            </div>
        `;
        return;
    }

    const grouped = {};
    metrics.forEach(m => {
        const cat = m.category || 'OPERATIONS_QUALITY';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(m);
    });

    let html = '';
    for (const [catKey, list] of Object.entries(grouped)) {
        const meta = CATEGORY_META[catKey] || { name: catKey, icon: 'fa-tag', color: '#0d9488' };
        const catWeightage = list.reduce((sum, item) => sum + parseFloat(item.weightage || 0), 0);

        html += `
            <div class="category-section-card">
                <div class="category-header">
                    <h3>
                        <i class="fa-solid ${meta.icon}" style="color:${meta.color};"></i> ${meta.name}
                    </h3>
                    <span class="stat-badge" style="background:#f1f5f9; color:#334155; font-size:12px; font-weight:800;">
                        Category Weightage: ${catWeightage.toFixed(1)}% (${list.length} Measures)
                    </span>
                </div>

                <div style="overflow-x:auto;">
                    <table class="kra-table">
                        <thead>
                            <tr>
                                <th style="width:30%;">Measure / Objective</th>
                                <th>Target</th>
                                <th>Weightage</th>
                                <th>0–6 Scale Matrix</th>
                                <th>Status</th>
                                <th style="text-align:right;">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        list.forEach(m => {
            html += `
                <tr>
                    <td>
                        <div style="font-weight:800; color:var(--teal-900); font-size:14px;">${escapeHtml(m.measure_name)}</div>
                        <div style="font-size:12px; color:var(--text-muted); margin-top:3px;">${escapeHtml(m.objective || 'No description')}</div>
                    </td>
                    <td>
                        <span class="stat-badge" style="background:#e0f2fe; color:#0369a1; font-weight:800; font-size:12.5px;">
                            ${escapeHtml(m.target_display || `${m.target_value}${m.target_unit}`)}
                        </span>
                    </td>
                    <td>
                        <span class="stat-badge" style="background:#fef3c7; color:#92400e; font-weight:800;">
                            ${m.weightage}%
                        </span>
                    </td>
                    <td>
                        <span class="scale-pill" onclick="viewThresholdDetails(${m.metric_id})">
                            <i class="fa-solid fa-magnifying-glass"></i> View 0–6 Rules
                        </span>
                    </td>
                    <td>
                        <span class="stat-badge" style="background:#dcfce7; color:#15803d; font-weight:700;">
                            Active
                        </span>
                    </td>
                    <td style="text-align:right;">
                        <button class="action-btn-sm" style="background:#fee2e2; color:#b91c1c;" onclick="deleteMetric(${m.metric_id})">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });

        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    container.innerHTML = html;
}

function renderL1ReviewTab(metrics) {
    const tbody = document.getElementById('l1-review-tbody');
    let html = '';

    metrics.forEach(m => {
        const rating = m.self_rating !== null ? m.self_rating : '-';
        const ratingClass = m.self_rating !== null ? `rating-${m.self_rating}` : 'rating-0';
        const suggested = m.suggested_score !== null ? `${m.suggested_score}/6` : '-';
        
        let proofsHtml = '';
        if (m.proofs && m.proofs.length > 0) {
            proofsHtml = m.proofs.map(p => `
                <a href="${p.file_path}" target="_blank" class="proof-chip">
                    <i class="fa-solid fa-file-arrow-down"></i> ${escapeHtml(p.file_name)}
                </a>
            `).join('');
        } else {
            proofsHtml = '<span style="color:#94a3b8; font-size:12px;">No proof attached</span>';
        }

        html += `
            <tr>
                <td>
                    <div style="font-weight:800; color:var(--teal-900);">${escapeHtml(m.measure_name)}</div>
                    <div style="font-size:11.5px; color:var(--text-muted);">${escapeHtml(m.category_display || m.category)}</div>
                </td>
                <td><span class="stat-badge" style="background:#e0f2fe; color:#0369a1;">${escapeHtml(m.target_display || '')}</span></td>
                <td><span class="stat-badge" style="background:#fef3c7; color:#92400e;">${m.weightage}%</span></td>
                <td style="font-weight:700; color:#0f172a;">${m.actual_achieved !== null ? m.actual_achieved : '-'} ${escapeHtml(m.target_unit || '')}</td>
                <td><span class="stat-badge" style="background:#f1f5f9; color:#475569; font-weight:800;">${suggested}</span></td>
                <td><span class="rating-badge ${ratingClass}">${rating}</span></td>
                <td style="max-width:200px; font-size:12.5px; color:#334155;">${escapeHtml(m.self_reasoning || 'Pending entry')}</td>
                <td>${proofsHtml}</td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

function renderL2ManagerTab(metrics) {
    const tbody = document.getElementById('l2-mgr-tbody');
    let html = '';

    metrics.forEach(m => {
        let proofsHtml = '';
        if (m.proofs && m.proofs.length > 0) {
            proofsHtml = m.proofs.map(p => `
                <a href="${p.file_path}" target="_blank" class="proof-chip">
                    <i class="fa-solid fa-file"></i> ${escapeHtml(p.file_name)}
                </a>
            `).join('');
        } else {
            proofsHtml = '<span style="color:#94a3b8; font-size:11.5px;">No proofs</span>';
        }

        const currRating = m.l1_rating !== null ? m.l1_rating : (m.suggested_score !== null ? m.suggested_score : 4);
        const currRemarks = m.l1_remarks || '';

        html += `
            <tr data-assessment-id="${m.assessment_id}">
                <td>
                    <div style="font-weight:800; color:var(--teal-900);">${escapeHtml(m.measure_name)}</div>
                    <div style="font-size:11.5px; color:var(--text-muted);">Target: ${escapeHtml(m.target_display || '')}</div>
                </td>
                <td><span class="stat-badge" style="background:#fef3c7; color:#92400e;">${m.weightage}%</span></td>
                <td>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span class="rating-badge rating-${m.self_rating || 0}">${m.self_rating !== null ? m.self_rating : '-'}</span>
                        <span style="font-size:12.5px; color:#334155;">${escapeHtml(m.self_reasoning || 'No self remarks')}</span>
                    </div>
                </td>
                <td>${proofsHtml}</td>
                <td>
                    <select class="l1-rating-input" style="padding:6px 10px; border-radius:6px; border:1px solid #cbd5e1; font-weight:800; font-size:13px; background:#fff;">
                        ${[6,5,4,3,2,1,0].map(s => `<option value="${s}" ${s === currRating ? 'selected' : ''}>Rating ${s}/6</option>`).join('')}
                    </select>
                </td>
                <td>
                    <input type="text" class="l1-remarks-input" value="${escapeHtml(currRemarks)}" placeholder="Manager review remarks..." style="width:100%; padding:6px 10px; border-radius:6px; border:1px solid #cbd5e1; font-size:12.5px;">
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

function renderL3PlantHeadTab(metrics) {
    const tbody = document.getElementById('l3-plant-tbody');
    let html = '';

    metrics.forEach(m => {
        let proofsHtml = '';
        if (m.proofs && m.proofs.length > 0) {
            proofsHtml = m.proofs.map(p => `
                <a href="${p.file_path}" target="_blank" class="proof-chip">
                    <i class="fa-solid fa-file"></i> ${escapeHtml(p.file_name)}
                </a>
            `).join('');
        }

        const currRating = m.l2_rating !== null ? m.l2_rating : (m.l1_rating !== null ? m.l1_rating : 4);
        const currRemarks = m.l2_remarks || '';

        html += `
            <tr data-assessment-id="${m.assessment_id}">
                <td>
                    <div style="font-weight:800; color:var(--teal-900);">${escapeHtml(m.measure_name)}</div>
                    <div style="font-size:11.5px; color:var(--text-muted);">Target: ${escapeHtml(m.target_display || '')}</div>
                </td>
                <td><span class="stat-badge" style="background:#fef3c7; color:#92400e;">${m.weightage}%</span></td>
                <td>
                    <div style="font-size:12px; color:#334155; margin-bottom:3px;">
                        <strong>Emp:</strong> ⭐ ${m.self_rating !== null ? m.self_rating : '-'} ("${escapeHtml(m.self_reasoning || '')}")
                    </div>
                    <div style="font-size:12px; color:#0369a1;">
                        <strong>L1 Mgr:</strong> ⭐ ${m.l1_rating !== null ? m.l1_rating : '-'} ("${escapeHtml(m.l1_remarks || '')}")
                    </div>
                </td>
                <td>${proofsHtml}</td>
                <td>
                    <select class="l2-rating-input" style="padding:6px 10px; border-radius:6px; border:1px solid #cbd5e1; font-weight:800; font-size:13px; background:#fff;">
                        ${[6,5,4,3,2,1,0].map(s => `<option value="${s}" ${s === currRating ? 'selected' : ''}>Rating ${s}/6</option>`).join('')}
                    </select>
                </td>
                <td>
                    <input type="text" class="l2-remarks-input" value="${escapeHtml(currRemarks)}" placeholder="Plant head remarks..." style="width:100%; padding:6px 10px; border-radius:6px; border:1px solid #cbd5e1; font-size:12.5px;">
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

function renderL4HRTab(metrics, summary) {
    const tbody = document.getElementById('l4-hr-tbody');
    let html = '';

    metrics.forEach(m => {
        const currRating = m.hr_rating !== null ? m.hr_rating : (m.l2_rating !== null ? m.l2_rating : 4);
        const currRemarks = m.hr_remarks || '';
        const wt = parseFloat(m.weightage || 0);
        const calcVal = ((currRating * wt) / 100).toFixed(2);

        html += `
            <tr data-assessment-id="${m.assessment_id}" data-weightage="${wt}">
                <td>
                    <div style="font-weight:800; color:var(--teal-900);">${escapeHtml(m.measure_name)}</div>
                    <div style="font-size:11.5px; color:var(--text-muted);">${escapeHtml(m.category_display || '')}</div>
                </td>
                <td><span class="stat-badge" style="background:#fef3c7; color:#92400e;">${wt}%</span></td>
                <td>
                    <div style="font-size:11.5px; color:#475569;">
                        Emp: ⭐ ${m.self_rating || '-'} | Mgr: ⭐ ${m.l1_rating || '-'} | Plant: ⭐ ${m.l2_rating || '-'}
                    </div>
                </td>
                <td>
                    <select class="hr-rating-input" onchange="recalculateHRTotals()" style="padding:6px 10px; border-radius:6px; border:1px solid #cbd5e1; font-weight:800; font-size:13px; background:#fff;">
                        ${[6,5,4,3,2,1,0].map(s => `<option value="${s}" ${s === currRating ? 'selected' : ''}>Rating ${s}/6</option>`).join('')}
                    </select>
                </td>
                <td style="font-weight:800; color:#065f46;" class="hr-row-calc">${calcVal}</td>
                <td>
                    <input type="text" class="hr-remarks-input" value="${escapeHtml(currRemarks)}" placeholder="HR audit remarks..." style="width:100%; padding:6px 10px; border-radius:6px; border:1px solid #cbd5e1; font-size:12.5px;">
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
    recalculateHRTotals();
}

function recalculateHRTotals() {
    const rows = document.querySelectorAll('#l4-hr-tbody tr');
    let totalScore = 0;

    rows.forEach(row => {
        const wt = parseFloat(row.getAttribute('data-weightage') || 0);
        const rating = parseInt(row.querySelector('.hr-rating-input').value) || 0;
        const rowCalc = (rating * wt) / 100;
        row.querySelector('.hr-row-calc').textContent = rowCalc.toFixed(2);
        totalScore += rowCalc;
    });

    document.getElementById('hr-final-score-val').textContent = `${totalScore.toFixed(2)} / 6.00`;
    
    let slab = '0%';
    let grade = 'Unsatisfactory';
    let desc = 'Below Benchmark (PIP)';
    if (totalScore >= 4.80) { slab = '50%'; grade = 'Outstanding'; desc = 'Top Tier Payout (50% Variable Pay)'; }
    else if (totalScore >= 4.30) { slab = '45%'; grade = 'Exceeds Expectations'; desc = 'High Performance (45% Variable Pay)'; }
    else if (totalScore >= 3.80) { slab = '40%'; grade = 'Meets Expectations'; desc = 'Solid Delivery (40% Variable Pay)'; }
    else if (totalScore >= 3.30) { slab = '35%'; grade = 'Average'; desc = 'Acceptable (35% Variable Pay)'; }
    else if (totalScore >= 2.80) { slab = '30%'; grade = 'Needs Improvement'; desc = 'Sub-Par (30% Variable Pay)'; }

    document.getElementById('hr-mars-slab-val').textContent = `${slab} Variable Pay`;
    document.getElementById('hr-score-rating-badge').textContent = grade;
    document.getElementById('hr-mars-desc').textContent = desc;
}

function initThresholdInputs() {
    const container = document.getElementById('threshold-inputs-container');
    const defaultScales = [
        { score: 6, min: 110.01, max: 999.00, label: '> 110% (Benchmark)' },
        { score: 5, min: 105.01, max: 110.00, label: '105.1 – 110% (Exceeds)' },
        { score: 4, min: 100.00, max: 105.00, label: '100 – 105% (Target Met)' },
        { score: 3, min: 95.00,  max: 99.99,  label: '95 – 99.9% (Min Acceptable)' },
        { score: 2, min: 85.00,  max: 94.99,  label: '85 – 94.99% (Sub-Par)' },
        { score: 1, min: 80.00,  max: 84.99,  label: '80 – 84.99% (Critical Warning)' },
        { score: 0, min: 0.00,   max: 79.99,  label: '< 80% (Execution Failure)' }
    ];

    let html = '';
    defaultScales.forEach(s => {
        html += `
            <div class="threshold-grid" data-score="${s.score}">
                <div style="font-weight:800; color:var(--teal-900);">Score ${s.score}</div>
                <input type="number" step="0.01" class="t-min" value="${s.min}" style="padding:6px; border-radius:6px; border:1px solid #cbd5e1; font-size:12.5px;">
                <input type="number" step="0.01" class="t-max" value="${s.max}" style="padding:6px; border-radius:6px; border:1px solid #cbd5e1; font-size:12.5px;">
                <input type="text" class="t-label" value="${s.label}" style="padding:6px; border-radius:6px; border:1px solid #cbd5e1; font-size:12.5px;">
            </div>
        `;
    });
    container.innerHTML = html;
}

function autoPopulateThresholdScale(targetVal) {
    const rows = document.querySelectorAll('#threshold-inputs-container .threshold-grid');
    if (rows.length === 0) return;

    const t = parseFloat(targetVal) || 100;
    const calculated = {
        '6': { min: (t * 1.1001).toFixed(2), max: (t * 10).toFixed(2), label: `> ${(t * 1.1).toFixed(1)} (Benchmark)` },
        '5': { min: (t * 1.0501).toFixed(2), max: (t * 1.1000).toFixed(2), label: `${(t * 1.05).toFixed(1)} – ${(t * 1.1).toFixed(1)} (Exceeds)` },
        '4': { min: (t * 1.0000).toFixed(2), max: (t * 1.0500).toFixed(2), label: `${t.toFixed(1)} – ${(t * 1.05).toFixed(1)} (Target Met)` },
        '3': { min: (t * 0.9500).toFixed(2), max: (t * 0.9999).toFixed(2), label: `${(t * 0.95).toFixed(1)} – ${(t * 0.99).toFixed(1)} (Min Acceptable)` },
        '2': { min: (t * 0.8500).toFixed(2), max: (t * 0.9499).toFixed(2), label: `${(t * 0.85).toFixed(1)} – ${(t * 0.94).toFixed(1)} (Sub-Par)` },
        '1': { min: (t * 0.8000).toFixed(2), max: (t * 0.8499).toFixed(2), label: `${(t * 0.80).toFixed(1)} – ${(t * 0.84).toFixed(1)} (Critical Warning)` },
        '0': { min: '0.00', max: (t * 0.7999).toFixed(2), label: `< ${(t * 0.80).toFixed(1)} (Execution Failure)` }
    };

    rows.forEach(r => {
        const s = r.getAttribute('data-score');
        if (calculated[s]) {
            r.querySelector('.t-min').value = calculated[s].min;
            r.querySelector('.t-max').value = calculated[s].max;
            r.querySelector('.t-label').value = calculated[s].label;
        }
    });
}

function extractThresholdMatrixFromForm() {
    const rows = document.querySelectorAll('#threshold-inputs-container .threshold-grid');
    const scale = {};
    rows.forEach(r => {
        const s = r.getAttribute('data-score');
        scale[s] = {
            min: parseFloat(r.querySelector('.t-min').value) || 0,
            max: parseFloat(r.querySelector('.t-max').value) || 0,
            label: r.querySelector('.t-label').value || ''
        };
    });
    return {
        unit: document.getElementById('metric-target-unit').value || '%',
        direction: 'higher_is_better',
        scale
    };
}

function simulateScore(actualVal, matrix) {
    const scale = matrix.scale;
    for (let s = 6; s >= 0; s--) {
        const b = scale[s.toString()];
        if (b && actualVal >= b.min && actualVal <= b.max) {
            return { score: s, label: b.label };
        }
    }
    return { score: 0, label: '< Benchmark' };
}

function openMetricModal() {
    document.getElementById('form-metric').reset();
    document.getElementById('modal-add-metric').classList.add('active');
}

function closeMetricModal() {
    document.getElementById('modal-add-metric').classList.remove('active');
}

async function handleSaveMetric(e) {
    e.preventDefault();
    if (!currentEmployeeId) {
        alert('Please select an employee first.');
        return;
    }

    const category = document.getElementById('metric-category').value;
    const categoryDisplay = CATEGORY_META[category] ? CATEGORY_META[category].name : category;
    const measureName = document.getElementById('metric-name').value.trim();
    const objective = document.getElementById('metric-objective').value.trim();
    const targetValue = parseFloat(document.getElementById('metric-target-val').value) || 0;
    const targetUnit = document.getElementById('metric-target-unit').value.trim() || '%';
    const targetDisplay = document.getElementById('metric-target-display').value.trim() || `${targetValue}${targetUnit}`;
    const weightage = parseFloat(document.getElementById('metric-weightage').value) || 0;
    const thresholdMatrix = extractThresholdMatrixFromForm();

    try {
        const res = await fetch('/api/kra/metrics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cycleId: currentCycleId,
                employeeId: currentEmployeeId,
                category,
                categoryDisplay,
                measureName,
                objective,
                targetValue,
                targetUnit,
                targetDisplay,
                weightage,
                thresholdMatrix
            })
        });

        const json = await res.json();
        if (json.success) {
            closeMetricModal();
            await loadEmployeeKRA();
        } else {
            alert(json.message || 'Failed to save metric');
        }
    } catch (err) {
        console.error('Error saving metric:', err);
        alert('Network error while saving metric');
    }
}

async function deleteMetric(metricId) {
    if (!confirm('Are you sure you want to delete this performance measure?')) return;
    try {
        const res = await fetch(`/api/kra/metrics/${metricId}`, { method: 'DELETE' });
        const json = await res.json();
        if (json.success) {
            await loadEmployeeKRA();
        } else {
            alert(json.message || 'Failed to delete metric');
        }
    } catch (err) {
        console.error('Error deleting metric:', err);
    }
}

function viewThresholdDetails(metricId) {
    const metric = currentMetricsData.find(m => m.metric_id === metricId);
    if (!metric || !metric.threshold_matrix || !metric.threshold_matrix.scale) return;

    const scale = metric.threshold_matrix.scale;
    let html = `
        <div style="margin-bottom:12px; font-size:13.5px; font-weight:700; color:#334155;">
            ${escapeHtml(metric.measure_name)} — Target: <strong>${escapeHtml(metric.target_display || '')}</strong>
        </div>
        <div class="threshold-grid header" style="grid-template-columns: 70px 100px 100px 1fr;">
            <div>Score</div>
            <div>Min</div>
            <div>Max</div>
            <div>Performance Label</div>
        </div>
    `;

    for (let s = 6; s >= 0; s--) {
        const b = scale[s.toString()] || {};
        html += `
            <div class="threshold-grid" style="grid-template-columns: 70px 100px 100px 1fr;">
                <div><span class="rating-badge rating-${s}">${s}</span></div>
                <div style="font-weight:700;">${b.min !== undefined ? b.min : '-'}</div>
                <div style="font-weight:700;">${b.max !== undefined ? b.max : '-'}</div>
                <div style="font-size:12.5px; color:#475569;">${escapeHtml(b.label || '')}</div>
            </div>
        `;
    }

    document.getElementById('view-threshold-title').textContent = `0–6 Threshold Rules: ${metric.measure_name}`;
    document.getElementById('view-threshold-content').innerHTML = html;
    document.getElementById('modal-view-threshold').classList.add('active');
}

async function handleSaveL1Review() {
    const rows = document.querySelectorAll('#l2-mgr-tbody tr');
    const reviews = [];

    rows.forEach(r => {
        const assessmentId = r.getAttribute('data-assessment-id');
        const l1Rating = r.querySelector('.l1-rating-input').value;
        const l1Remarks = r.querySelector('.l1-remarks-input').value;
        if (assessmentId) {
            reviews.push({ assessmentId: parseInt(assessmentId), l1Rating: parseInt(l1Rating), l1Remarks });
        }
    });

    if (reviews.length === 0) return;

    try {
        const res = await fetch('/api/kra/assessments/l1-review', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                managerId: 1,
                employeeId: currentEmployeeId,
                cycleId: currentCycleId,
                reviews
            })
        });
        const json = await res.json();
        alert(json.message || 'L1 Review Saved!');
        await loadEmployeeKRA();
    } catch (err) {
        console.error('Error submitting L1 review:', err);
    }
}

async function handleSaveL2Plant() {
    const rows = document.querySelectorAll('#l3-plant-tbody tr');
    const reviews = [];

    rows.forEach(r => {
        const assessmentId = r.getAttribute('data-assessment-id');
        const l2Rating = r.querySelector('.l2-rating-input').value;
        const l2Remarks = r.querySelector('.l2-remarks-input').value;
        if (assessmentId) {
            reviews.push({ assessmentId: parseInt(assessmentId), l2Rating: parseInt(l2Rating), l2Remarks });
        }
    });

    if (reviews.length === 0) return;

    try {
        const res = await fetch('/api/kra/assessments/l2-validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                plantHeadId: 1,
                employeeId: currentEmployeeId,
                cycleId: currentCycleId,
                reviews
            })
        });
        const json = await res.json();
        alert(json.message || 'Plant Head Validation Signed Off!');
        await loadEmployeeKRA();
    } catch (err) {
        console.error('Error submitting Plant Head validation:', err);
    }
}

async function handleSaveHRFinalize() {
    const rows = document.querySelectorAll('#l4-hr-tbody tr');
    const reviews = [];

    rows.forEach(r => {
        const assessmentId = r.getAttribute('data-assessment-id');
        const hrRating = r.querySelector('.hr-rating-input').value;
        const hrRemarks = r.querySelector('.hr-remarks-input').value;
        if (assessmentId) {
            reviews.push({ assessmentId: parseInt(assessmentId), hrRating: parseInt(hrRating), hrRemarks });
        }
    });

    const revisedCtc = document.getElementById('hr-revised-ctc-input').value;

    try {
        const res = await fetch('/api/kra/assessments/hr-finalize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                hrAdminId: 1,
                employeeId: currentEmployeeId,
                cycleId: currentCycleId,
                reviews,
                revisedCtc
            })
        });
        const json = await res.json();
        alert(json.message || 'HR Final Appraisal Locked!');
        await loadEmployeeKRA();
    } catch (err) {
        console.error('Error submitting HR finalization:', err);
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
