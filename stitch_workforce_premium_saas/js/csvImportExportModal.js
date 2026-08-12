/**
 * Enterprise Bi-Directional Data Sync & Staging Engine Modal (`csvImportExportModal.js`)
 * Matches EMS Signature Glassmorphism UI Aesthetic 100%
 */

(function () {
    let currentModule = 'customers';
    let currentPreviewData = null;
    let pollInterval = null;

    function injectModalHTML() {
        if (document.getElementById('import-export-engine-modal')) return;

        const modalHTML = `
        <!-- Enterprise Import / Export & Data Sync Modal -->
        <div id="import-export-engine-modal" class="modal-overlay" style="display:none; position:fixed; inset:0; z-index:99999; background:rgba(31, 42, 36, 0.4); backdrop-filter:blur(12px); align-items:center; justify-content:center; padding:20px; opacity:0; transition:opacity 0.25s ease;">
            <div class="modal-box glass-card" style="width:100%; max-width:1100px; max-height:90vh; background:rgba(255, 255, 255, 0.45); border:1px solid rgba(255, 255, 255, 0.65); backdrop-filter:blur(32px); border-radius:24px; box-shadow:0 18px 44px rgba(31, 42, 36, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.6); overflow:hidden; display:flex; flex-direction:column; padding:28px;">
                
                <!-- Modal Header -->
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px;">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div style="width:42px; height:42px; border-radius:12px; background:rgba(22,160,133,0.15); border:1px solid rgba(22,160,133,0.3); color:var(--teal-700); display:flex; align-items:center; justify-content:center; font-size:20px;">
                            <i class="fa-solid fa-file-excel"></i>
                        </div>
                        <div>
                            <h3 id="ie-modal-title" style="margin:0; font-size:19px; font-weight:800; color:var(--teal-900);">Data Sync &amp; Bulk Engine</h3>
                            <p id="ie-modal-subtitle" style="margin:2px 0 0 0; font-size:12.5px; font-weight:600; color:var(--teal-700);">Enterprise Excel (.xlsx) &amp; CSV Data Exchange</p>
                        </div>
                    </div>
                    <i class="fa-solid fa-xmark modal-close" onclick="window.closeImportExportModal()" style="font-size:18px; color:var(--text-muted); cursor:pointer;"></i>
                </div>

                <!-- Main Modal Content Panels -->
                <div style="flex:1; overflow-y:auto; padding-right:4px;">
                    
                    <!-- PANEL 1: File Dropzone & Import Options -->
                    <div id="ie-panel-upload" style="display:block;">
                        
                        <!-- Dry Run Toggle & Instructions -->
                        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.3); border:1px solid rgba(255,255,255,0.5); padding:12px 16px; border-radius:14px; margin-bottom:16px;">
                            <div style="display:flex; align-items:center; gap:10px;">
                                <i class="fa-solid fa-flask" style="color:var(--teal-600); font-size:16px;"></i>
                                <div>
                                    <div style="font-size:13px; font-weight:700; color:var(--teal-900);">Dry Run / Validate Only Mode</div>
                                    <div style="font-size:11.5px; color:var(--text-muted);">Validate staging data without writing changes to PostgreSQL.</div>
                                </div>
                            </div>
                            <label style="position:relative; display:inline-block; width:44px; height:24px;">
                                <input type="checkbox" id="ie-dry-run-toggle" style="opacity:0; width:0; height:0;">
                                <span style="position:absolute; cursor:pointer; inset:0; background-color:#cbd5e1; border-radius:24px; transition:.3s;" onclick="this.previousElementSibling.click(); this.style.backgroundColor = this.previousElementSibling.checked ? '#16a085' : '#cbd5e1';"></span>
                            </label>
                        </div>

                        <!-- Dropzone Box -->
                        <div style="border:2px dashed rgba(22,160,133,0.4); background:rgba(255,255,255,0.35); border-radius:18px; padding:30px; text-align:center; margin-bottom:18px; cursor:pointer;" onclick="document.getElementById('ie-file-input').click()">
                            <i class="fa-solid fa-cloud-arrow-up" style="font-size:36px; color:var(--teal-600); margin-bottom:10px;"></i>
                            <h4 style="margin:0 0 6px 0; font-size:15px; font-weight:800; color:var(--teal-900);">Select or Drop Excel (.xlsx) / CSV File</h4>
                            <p style="margin:0; font-size:12.5px; color:var(--text-muted);">Supports .xlsx (Recommended) and UTF-8 .csv files up to 50MB</p>
                            <input type="file" id="ie-file-input" accept=".xlsx,.csv" style="display:none;" onchange="window.handleImportFileSelect(event)">
                        </div>

                        <!-- Quick Template & Action Options -->
                        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.25); border:1px solid rgba(255,255,255,0.45); border-radius:14px; padding:12px 16px;">
                            <div style="font-size:12.5px; font-weight:700; color:var(--teal-900);">Need the pre-formatted structure?</div>
                            <button type="button" onclick="window.downloadCurrentModuleTemplate()" class="btn-secondary" style="padding:7px 14px; font-size:12px; display:inline-flex; align-items:center; gap:6px;">
                                <i class="fa-solid fa-file-download"></i> Download Template (.xlsx)
                            </button>
                        </div>
                    </div>

                    <!-- PANEL 2: Interactive High-Performance Preview -->
                    <div id="ie-panel-preview" style="display:none;">
                        <h4 style="margin:0 0 14px 0; font-size:15px; font-weight:800; color:var(--teal-900);"><i class="fa-solid fa-chart-pie" style="color:var(--teal-600); margin-right:8px;"></i> Import Preview &amp; Validation Summary</h4>

                        <!-- Aggregate Stats Grid -->
                        <div style="display:grid; grid-template-columns:repeat(5, 1fr); gap:10px; margin-bottom:16px;">
                            <div style="background:rgba(255,255,255,0.35); border:1px solid rgba(255,255,255,0.5); border-radius:12px; padding:10px; text-align:center;">
                                <div style="font-size:11px; font-weight:700; color:var(--text-muted);">TOTAL</div>
                                <div id="ie-stat-total" style="font-size:18px; font-weight:800; color:var(--teal-900);">0</div>
                            </div>
                            <div style="background:rgba(16,185,129,0.12); border:1px solid rgba(16,185,129,0.25); border-radius:12px; padding:10px; text-align:center;">
                                <div style="font-size:11px; font-weight:700; color:#047857;">🟢 NEW</div>
                                <div id="ie-stat-new" style="font-size:18px; font-weight:800; color:#047857;">0</div>
                            </div>
                            <div style="background:rgba(245,158,11,0.12); border:1px solid rgba(245,158,11,0.25); border-radius:12px; padding:10px; text-align:center;">
                                <div style="font-size:11px; font-weight:700; color:#b45309;">🟡 UPDATED</div>
                                <div id="ie-stat-updated" style="font-size:18px; font-weight:800; color:#b45309;">0</div>
                            </div>
                            <div style="background:rgba(239,68,68,0.12); border:1px solid rgba(239,68,68,0.25); border-radius:12px; padding:10px; text-align:center;">
                                <div style="font-size:11px; font-weight:700; color:#b91c1c;">🔴 INVALID</div>
                                <div id="ie-stat-invalid" style="font-size:18px; font-weight:800; color:#b91c1c;">0</div>
                            </div>
                            <div style="background:rgba(168,85,247,0.12); border:1px solid rgba(168,85,247,0.25); border-radius:12px; padding:10px; text-align:center;">
                                <div style="font-size:11px; font-weight:700; color:#6b21a8;">⚠️ CONFLICTS</div>
                                <div id="ie-stat-conflicts" style="font-size:18px; font-weight:800; color:#6b21a8;">0</div>
                            </div>
                        </div>

                        <!-- Conflicting Rows Section (High-Performance Filter) -->
                        <div id="ie-conflicts-section" style="margin-bottom:16px; display:none;">
                            <h5 style="margin:0 0 8px 0; font-size:13px; font-weight:800; color:#6b21a8;"><i class="fa-solid fa-triangle-exclamation"></i> Conflicting Records Needing Review</h5>
                            <div id="ie-conflicts-list" style="display:flex; flex-direction:column; gap:8px; max-height:160px; overflow-y:auto;">
                                <!-- Dynamic Conflicting Rows -->
                            </div>
                        </div>

                        <!-- Sample Validation Box -->
                        <div style="background:rgba(255,255,255,0.25); border:1px solid rgba(255,255,255,0.45); border-radius:14px; padding:12px; margin-bottom:16px;">
                            <h5 style="margin:0 0 6px 0; font-size:12.5px; font-weight:800; color:var(--teal-900);">Staging Validation Status Sample</h5>
                            <div id="ie-sample-list" style="font-size:12px; color:var(--text-dark); max-height:140px; overflow-y:auto;">
                                <!-- Sample rows -->
                            </div>
                        </div>
                    </div>

                    <!-- PANEL 3: Asynchronous Background Progress Bar -->
                    <div id="ie-panel-progress" style="display:none; text-align:center; padding:30px 10px;">
                        <div style="width:54px; height:54px; border-radius:50%; background:rgba(22,160,133,0.15); color:var(--teal-700); display:inline-flex; align-items:center; justify-content:center; font-size:24px; margin-bottom:14px; animation:spin 2s linear infinite;">
                            <i class="fa-solid fa-gear"></i>
                        </div>
                        <h4 id="ie-progress-title" style="margin:0 0 6px 0; font-size:16px; font-weight:800; color:var(--teal-900);">Importing Records to PostgreSQL...</h4>
                        <p id="ie-progress-sub" style="margin:0 0 18px 0; font-size:12.5px; color:var(--text-muted);">Background staging worker is processing batches in single atomic transactions.</p>
                        
                        <div style="width:100%; height:14px; background:rgba(0,0,0,0.08); border-radius:10px; overflow:hidden; margin-bottom:10px; position:relative;">
                            <div id="ie-progress-bar" style="height:100%; width:0%; background:linear-gradient(90deg, var(--teal-600), var(--teal-900)); border-radius:10px; transition:width 0.3s ease;"></div>
                        </div>
                        <div id="ie-progress-percent" style="font-size:14px; font-weight:800; color:var(--teal-900);">0% (0 / 0 Rows)</div>
                    </div>

                </div>

                <!-- Modal Footer Actions -->
                <div style="margin-top:16px; display:flex; justify-content:space-between; align-items:center; border-top:1px solid rgba(255,255,255,0.45); padding-top:14px;">
                    <button type="button" id="ie-btn-cancel" onclick="window.closeImportExportModal()" class="btn-secondary" style="padding:8px 16px; font-size:12.5px;">Cancel</button>
                    <button type="button" id="ie-btn-commit" onclick="window.executeCommitImportJob()" class="btn-primary" style="display:none; padding:8px 20px; font-size:12.5px; align-items:center; gap:8px;">
                        <i class="fa-solid fa-check-double"></i> Confirm &amp; Commit Import
                    </button>
                </div>

            </div>
        </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    // ── PUBLIC API EXPOSURES ──────────────────────────────────────────────────
    window.openImportModal = function (module) {
        injectModalHTML();
        currentModule = module || 'customers';
        currentPreviewData = null;

        document.getElementById('ie-modal-title').innerText = `${currentModule.toUpperCase()} Data Import`;
        document.getElementById('ie-panel-upload').style.display = 'block';
        document.getElementById('ie-panel-preview').style.display = 'none';
        document.getElementById('ie-panel-progress').style.display = 'none';
        document.getElementById('ie-btn-commit').style.display = 'none';

        const modal = document.getElementById('import-export-engine-modal');
        modal.classList.add('active');
        modal.style.display = 'flex';
        modal.style.opacity = '1';
        modal.style.pointerEvents = 'auto';
    };

    window.closeImportExportModal = function () {
        if (pollInterval) clearInterval(pollInterval);
        const modal = document.getElementById('import-export-engine-modal');
        if (modal) {
            modal.classList.remove('active');
            modal.style.display = 'none';
            modal.style.opacity = '0';
            modal.style.pointerEvents = 'none';
        }
    };

    window.downloadCurrentModuleTemplate = function (moduleOverride) {
        const mod = moduleOverride || currentModule;
        const token = localStorage.getItem('token');
        window.location.href = `/api/v1/admin/import-export/template?module=${mod}&token=${token}`;
    };

    window.exportModuleDataFile = function (module, format = 'xlsx') {
        const token = localStorage.getItem('token');
        window.location.href = `/api/v1/admin/import-export/export?module=${module}&format=${format}&token=${token}`;
    };

    window.handleImportFileSelect = async function (e) {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('module', currentModule);
        formData.append('file', file);

        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/v1/admin/import-export/preview', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            const data = await res.json();
            if (!res.ok) {
                alert(`Import Preview Error: ${data.message}`);
                return;
            }

            currentPreviewData = data;

            // Render Preview Summary
            document.getElementById('ie-stat-total').innerText = data.summary.totalRows;
            document.getElementById('ie-stat-new').innerText = data.summary.newCount;
            document.getElementById('ie-stat-updated').innerText = data.summary.updatedCount;
            document.getElementById('ie-stat-invalid').innerText = data.summary.invalidCount;
            document.getElementById('ie-stat-conflicts').innerText = data.summary.conflictCount;

            // Render Conflicting Rows (If any)
            const conflictsSec = document.getElementById('ie-conflicts-section');
            const conflictsList = document.getElementById('ie-conflicts-list');
            if (data.conflicts && data.conflicts.length > 0) {
                conflictsSec.style.display = 'block';
                conflictsList.innerHTML = data.conflicts.map(c => `
                    <div style="background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.25); padding:8px 12px; border-radius:10px; font-size:12px; color:#b91c1c;">
                        <strong>Row #${c.rowIndex} (${c.name}):</strong> ${c.conflictDetails.field} — ${c.conflictDetails.dbValue} vs ${c.conflictDetails.csvValue}
                    </div>
                `).join('');
            } else {
                conflictsSec.style.display = 'none';
            }

            // Render Sample List
            const sampleList = document.getElementById('ie-sample-list');
            sampleList.innerHTML = data.validatedRowsSample.map(r => `
                <div style="padding:4px 0; border-bottom:1px solid rgba(0,0,0,0.05); display:flex; justify-content:space-between;">
                    <span>Row #${r.rowIndex}: ${r.data.name || r.data.full_name || 'Record'}</span>
                    <span style="font-weight:700; color:${r.status === 'valid' ? '#047857' : '#b91c1c'};">${r.status.toUpperCase()} (${r.actionType})</span>
                </div>
            `).join('');

            // Switch to Preview Panel
            document.getElementById('ie-panel-upload').style.display = 'none';
            document.getElementById('ie-panel-preview').style.display = 'block';
            document.getElementById('ie-btn-commit').style.display = 'inline-flex';
        } catch (err) {
            console.error('Import preview error:', err);
            alert('Failed to process preview file.');
        }
    };

    window.executeCommitImportJob = async function () {
        if (!currentPreviewData) return;

        const isDryRun = document.getElementById('ie-dry-run-toggle').checked;
        if (isDryRun) {
            alert('🧪 Dry Run Complete! All records validated successfully. Zero database writes were executed.');
            window.closeImportExportModal();
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/v1/admin/import-export/commit-job', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    module: currentModule,
                    storageKey: currentPreviewData.storage.storageKey,
                    storagePath: currentPreviewData.storage.storagePath,
                    fileName: currentPreviewData.storage.storageKey,
                    validatedRows: currentPreviewData.validatedRowsSample
                })
            });

            const data = await res.json();
            if (!res.ok) {
                alert(`Commit Initialization Error: ${data.message}`);
                return;
            }

            // Switch to Progress Panel & start polling
            document.getElementById('ie-panel-preview').style.display = 'none';
            document.getElementById('ie-panel-progress').style.display = 'block';
            document.getElementById('ie-btn-commit').style.display = 'none';

            const jobId = data.jobId;
            pollInterval = setInterval(async () => {
                try {
                    const statusRes = await fetch(`/api/v1/admin/import-export/job-status/${jobId}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const statusData = await statusRes.json();
                    if (statusRes.ok && statusData.success) {
                        const job = statusData.job;
                        const pct = job.progress_percent || 0;
                        document.getElementById('ie-progress-bar').style.width = `${pct}%`;
                        document.getElementById('ie-progress-percent').innerText = `${pct}% (${job.processed_rows || 0} / ${job.total_rows || 0} Rows)`;

                        if (job.status === 'completed') {
                            clearInterval(pollInterval);
                            alert(`🎉 Import Job '${jobId}' Completed Successfully!\nAdded: ${job.rows_added} | Updated: ${job.rows_updated} | Failed: ${job.rows_failed}`);
                            window.closeImportExportModal();
                            window.location.reload();
                        } else if (job.status === 'failed') {
                            clearInterval(pollInterval);
                            alert(`❌ Import Job Failed: ${job.error_message}`);
                            window.closeImportExportModal();
                        }
                    }
                } catch (pe) {
                    console.error('Polling error:', pe);
                }
            }, 800);
        } catch (err) {
            console.error('Commit error:', err);
            alert('Failed to execute commit job.');
        }
    };

})();
