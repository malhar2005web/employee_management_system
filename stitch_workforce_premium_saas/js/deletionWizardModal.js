/**
 * Enterprise Deletion & Offboarding Workflow Wizard Modal
 * Matches EMS Signature Glassmorphism Design System 100%
 */

(function () {
  let wizardState = {
    currentStep: 1,
    recordType: 'employee', // 'employee', 'customer', 'project', 'task'
    targetId: null,
    targetName: '',
    requestId: null,
    reason: '',
    category: 'Resignation',
    effectiveDate: new Date().toISOString().split('T')[0],
    hrRemarks: '',
    documents: [],
    approvals: [],
    dependencies: [],
    isLocked: false
  };

  function injectModalHTML() {
    if (document.getElementById('deletion-wizard-modal')) return;

    const modalHTML = `
    <!-- Deletion & Offboarding Wizard Modal (Lush Glassmorphism Theme) -->
    <div id="deletion-wizard-modal" class="modal-overlay" style="display:none; position:fixed; inset:0; z-index:99999; background:rgba(31, 42, 36, 0.4); backdrop-filter:blur(12px); align-items:center; justify-content:center; padding:20px; opacity:0; transition:opacity 0.25s ease;">
      <div class="modal-box glass-card" style="width:100%; max-width:1100px; max-height:90vh; background:rgba(255, 255, 255, 0.45); border:1px solid rgba(255, 255, 255, 0.65); backdrop-filter:blur(32px); border-radius:24px; box-shadow:0 18px 44px rgba(31, 42, 36, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.6); overflow:hidden; display:flex; flex-direction:column; padding:28px;">
        
        <!-- Modal Header -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px;">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="width:40px; height:40px; border-radius:12px; background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.3); color:#ef4444; display:flex; align-items:center; justify-content:center; font-size:18px;">
              <i class="fa-solid fa-shield-halved"></i>
            </div>
            <div>
              <h3 id="dw-title" style="margin:0; font-size:19px; font-weight:800; color:var(--teal-900, #0c4a40);">Offboarding &amp; Deletion Wizard</h3>
              <p id="dw-subtitle" style="margin:2px 0 0 0; font-size:12.5px; font-weight:600; color:var(--teal-700, #134e4a);">Enterprise Verification &amp; Document Workflow</p>
            </div>
          </div>
          <i class="fa-solid fa-xmark modal-close" onclick="window.closeDeletionWizard()" style="font-size:18px; color:var(--text-muted); cursor:pointer;"></i>
        </div>

        <!-- Wizard Stepper Header (Glass Card Pill) -->
        <div style="padding:10px 16px; background:rgba(255,255,255,0.25); border:1px solid rgba(255,255,255,0.45); border-radius:14px; display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
          <div class="dw-step-item" id="dw-step-1" style="display:flex; align-items:center; gap:6px; font-size:12px; font-weight:700; color:var(--teal-900);">
            <span style="width:22px; height:22px; border-radius:50%; background:var(--teal-600, #16a085); color:white; display:flex; align-items:center; justify-content:center; font-size:11px;">1</span> Details
          </div>
          <div style="color:rgba(0,0,0,0.2); font-size:10px;"><i class="fa-solid fa-chevron-right"></i></div>
          <div class="dw-step-item" id="dw-step-2" style="display:flex; align-items:center; gap:6px; font-size:12px; font-weight:600; color:var(--text-muted);">
            <span style="width:22px; height:22px; border-radius:50%; background:rgba(0,0,0,0.08); color:var(--text-muted); display:flex; align-items:center; justify-content:center; font-size:11px;">2</span> Documents
          </div>
          <div style="color:rgba(0,0,0,0.2); font-size:10px;"><i class="fa-solid fa-chevron-right"></i></div>
          <div class="dw-step-item" id="dw-step-3" style="display:flex; align-items:center; gap:6px; font-size:12px; font-weight:600; color:var(--text-muted);">
            <span style="width:22px; height:22px; border-radius:50%; background:rgba(0,0,0,0.08); color:var(--text-muted); display:flex; align-items:center; justify-content:center; font-size:11px;">3</span> Clearances
          </div>
          <div style="color:rgba(0,0,0,0.2); font-size:10px;"><i class="fa-solid fa-chevron-right"></i></div>
          <div class="dw-step-item" id="dw-step-4" style="display:flex; align-items:center; gap:6px; font-size:12px; font-weight:600; color:var(--text-muted);">
            <span style="width:22px; height:22px; border-radius:50%; background:rgba(0,0,0,0.08); color:var(--text-muted); display:flex; align-items:center; justify-content:center; font-size:11px;">4</span> Verify
          </div>
          <div style="color:rgba(0,0,0,0.2); font-size:10px;"><i class="fa-solid fa-chevron-right"></i></div>
          <div class="dw-step-item" id="dw-step-5" style="display:flex; align-items:center; gap:6px; font-size:12px; font-weight:600; color:var(--text-muted);">
            <span style="width:22px; height:22px; border-radius:50%; background:rgba(0,0,0,0.08); color:var(--text-muted); display:flex; align-items:center; justify-content:center; font-size:11px;">5</span> Final
          </div>
        </div>

        <!-- Wizard Body Panels -->
        <div style="flex:1; overflow-y:auto; padding-right:4px;">
          
          <!-- STEP 1: Reason & Metadata -->
          <div id="dw-panel-1" class="dw-panel" style="display:block;">
            <h4 style="margin:0 0 14px 0; color:var(--teal-900, #0c4a40); font-size:14.5px; font-weight:800;"><i class="fa-solid fa-file-signature" style="color:var(--teal-600); margin-right:8px;"></i> Step 1: Offboarding Reason &amp; Effective Dates</h4>
            
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:14px;">
              <div class="form-group" style="display:flex; flex-direction:column; gap:6px;">
                <label style="font-size:12px; font-weight:700; color:var(--text-dark);">Category / Primary Reason *</label>
                <select id="dw-category" style="width:100%; padding:10px 12px; border-radius:12px; border:1px solid rgba(255,255,255,0.65); background:rgba(255,255,255,0.55); font-size:13px; font-weight:600; color:var(--text-dark); outline:none;">
                  <option value="Resignation">Employee Resignation</option>
                  <option value="Termination">Company Termination</option>
                  <option value="Performance">Performance Issue</option>
                  <option value="Restructuring">Corporate Restructuring</option>
                  <option value="Contract Expired">Contract Expired</option>
                  <option value="Customer Closed">Customer Account Closed</option>
                  <option value="Duplicate">Duplicate Record</option>
                  <option value="Other">Other / Policy Closure</option>
                </select>
              </div>

              <div class="form-group" style="display:flex; flex-direction:column; gap:6px;">
                <label style="font-size:12px; font-weight:700; color:var(--text-dark);">Effective Termination Date *</label>
                <input type="date" id="dw-effective-date" style="width:100%; padding:10px 12px; border-radius:12px; border:1px solid rgba(255,255,255,0.65); background:rgba(255,255,255,0.55); font-size:13px; font-weight:600; color:var(--text-dark); outline:none;">
              </div>
            </div>

            <div class="form-group" style="display:flex; flex-direction:column; gap:6px; margin-bottom:14px;">
              <label style="font-size:12px; font-weight:700; color:var(--text-dark);">Detailed Reason for Offboarding / Closure *</label>
              <textarea id="dw-reason" rows="3" placeholder="Provide full justification for this action..." style="width:100%; padding:10px 12px; border-radius:12px; border:1px solid rgba(255,255,255,0.65); background:rgba(255,255,255,0.55); font-size:13px; outline:none; font-family:inherit; color:var(--text-dark);"></textarea>
            </div>

            <div class="form-group" style="display:flex; flex-direction:column; gap:6px;">
              <label style="font-size:12px; font-weight:700; color:var(--text-dark);">HR / Admin Remarks</label>
              <input type="text" id="dw-hr-remarks" placeholder="Optional notes for compliance record..." style="width:100%; padding:10px 12px; border-radius:12px; border:1px solid rgba(255,255,255,0.65); background:rgba(255,255,255,0.55); font-size:13px; outline:none; color:var(--text-dark);">
            </div>
          </div>

          <!-- STEP 2: Document Upload -->
          <div id="dw-panel-2" class="dw-panel" style="display:none;">
            <h4 style="margin:0 0 14px 0; color:var(--teal-900); font-size:14.5px; font-weight:800;"><i class="fa-solid fa-cloud-arrow-up" style="color:var(--teal-600); margin-right:8px;"></i> Step 2: Upload Mandatory &amp; Supporting Documents</h4>
            
            <!-- Requirement Box -->
            <div id="dw-doc-req-info" style="padding:12px 16px; border-radius:14px; background:rgba(37,99,235,0.1); border:1px solid rgba(37,99,235,0.25); color:#1d4ed8; font-size:12.5px; font-weight:600; margin-bottom:14px; display:flex; align-items:center; gap:10px;">
              <i class="fa-solid fa-circle-info" style="font-size:16px;"></i>
              <div>
                <strong>Mandatory Requirement:</strong> <span id="dw-doc-req-text">Resignation Letter OR Termination Letter must be uploaded.</span>
              </div>
            </div>

            <!-- Nested Glass Form Box -->
            <div style="background:rgba(255,255,255,0.25); border:1px solid rgba(255,255,255,0.45); border-radius:16px; padding:16px; margin-bottom:16px;">
              <div style="display:grid; grid-template-columns:1.2fr 1fr; gap:14px; margin-bottom:14px;">
                <div class="form-group" style="display:flex; flex-direction:column; gap:6px;">
                  <label style="font-size:12px; font-weight:700; color:var(--text-dark);">Document Type *</label>
                  <select id="dw-doc-type" style="width:100%; padding:9px 12px; border-radius:10px; border:1px solid rgba(255,255,255,0.65); background:rgba(255,255,255,0.65); font-size:13px; font-weight:600; color:var(--text-dark); outline:none;">
                    <option value="Resignation Letter">Resignation Letter (Mandatory)</option>
                    <option value="Termination Letter">Termination Letter (Mandatory)</option>
                    <option value="Exit Interview Form">Exit Interview Form</option>
                    <option value="Full &amp; Final Settlement Sheet">Full &amp; Final Settlement Sheet</option>
                    <option value="Asset Return Checklist">Asset Return Checklist</option>
                    <option value="ID Card Return Acknowledgement">ID Card Return Acknowledgement</option>
                    <option value="Clearance Certificate">Clearance Certificate</option>
                    <option value="Contract Closure Document">Contract Closure Document</option>
                    <option value="Invoice / Bill Settlement">Invoice / Bill Settlement</option>
                  </select>
                </div>

                <div class="form-group" style="display:flex; flex-direction:column; gap:6px;">
                  <label style="font-size:12px; font-weight:700; color:var(--text-dark);">Select File (PDF, DOC, DOCX, PNG, JPG)</label>
                  <input type="file" id="dw-file-input" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" style="width:100%; padding:6px 10px; border-radius:10px; border:1px solid rgba(255,255,255,0.65); background:rgba(255,255,255,0.65); font-size:12px; color:var(--text-dark);">
                </div>
              </div>

              <button type="button" onclick="window.uploadWizardDocument()" class="btn-primary" style="padding:8px 18px; font-size:12.5px; display:inline-flex; align-items:center; gap:8px;">
                <i class="fa-solid fa-upload"></i> Upload &amp; Verify Document
              </button>
            </div>

            <!-- Uploaded Files List -->
            <div>
              <h5 style="margin:0 0 10px 0; font-size:13px; font-weight:800; color:var(--teal-900);">Uploaded &amp; Verified Documents (<span id="dw-doc-count">0</span>)</h5>
              <div id="dw-doc-list" style="display:flex; flex-direction:column; gap:8px;">
                <div style="text-align:center; padding:18px; color:var(--text-muted); font-size:13px; background:rgba(255,255,255,0.25); border-radius:12px; border:1px dashed rgba(0,0,0,0.15);">
                  No documents uploaded yet.
                </div>
              </div>
            </div>
          </div>

          <!-- STEP 3: Clearances & Approvals -->
          <div id="dw-panel-3" class="dw-panel" style="display:none;">
            <h4 style="margin:0 0 14px 0; color:var(--teal-900); font-size:14.5px; font-weight:800;"><i class="fa-solid fa-clipboard-check" style="color:var(--teal-600); margin-right:8px;"></i> Step 3: Department Clearances &amp; Approvals</h4>
            <p style="font-size:13px; color:var(--text-body); margin-bottom:14px;">Verify that all required department clearances are granted before offboarding.</p>
            
            <div id="dw-approval-stages" style="display:flex; flex-direction:column; gap:10px;">
              <!-- Dynamic Stages Rendered Here -->
            </div>
          </div>

          <!-- STEP 4: Review & Dependency Check -->
          <div id="dw-panel-4" class="dw-panel" style="display:none;">
            <h4 style="margin:0 0 14px 0; color:var(--teal-900); font-size:14.5px; font-weight:800;"><i class="fa-solid fa-shield-check" style="color:var(--teal-600); margin-right:8px;"></i> Step 4: System Validation &amp; Dependency Audit</h4>
            
            <!-- Dependency Banner -->
            <div id="dw-dependency-banner" style="margin-bottom:14px;"></div>

            <!-- Summary Table -->
            <div style="background:rgba(255,255,255,0.25); border:1px solid rgba(255,255,255,0.45); border-radius:16px; padding:16px;">
              <h5 style="margin:0 0 10px 0; font-size:13.5px; font-weight:800; color:var(--teal-900);">Offboarding Summary</h5>
              <table style="width:100%; border-collapse:collapse; font-size:13px;">
                <tr><td style="padding:6px 0; color:var(--text-muted); font-weight:600; width:150px;">Target Name:</td><td style="font-weight:700; color:var(--text-dark);" id="dw-sum-name">—</td></tr>
                <tr><td style="padding:6px 0; color:var(--text-muted); font-weight:600;">Record Type:</td><td style="font-weight:700; color:var(--text-dark);" id="dw-sum-type">—</td></tr>
                <tr><td style="padding:6px 0; color:var(--text-muted); font-weight:600;">Category:</td><td style="font-weight:700; color:var(--teal-600);" id="dw-sum-cat">—</td></tr>
                <tr><td style="padding:6px 0; color:var(--text-muted); font-weight:600;">Effective Date:</td><td style="font-weight:700; color:var(--text-dark);" id="dw-sum-date">—</td></tr>
                <tr><td style="padding:6px 0; color:var(--text-muted); font-weight:600;">Uploaded Files:</td><td style="font-weight:700; color:var(--teal-700);" id="dw-sum-docs">—</td></tr>
              </table>
            </div>
          </div>

          <!-- STEP 5: Final Action -->
          <div id="dw-panel-5" class="dw-panel" style="display:none;">
            <h4 style="margin:0 0 14px 0; color:var(--teal-900); font-size:14.5px; font-weight:800;"><i class="fa-solid fa-box-archive" style="color:var(--teal-600); margin-right:8px;"></i> Step 5: Final Offboard &amp; Retention Archive</h4>
            
            <div style="padding:14px 16px; background:rgba(255,255,255,0.3); border-radius:14px; border:1px solid rgba(255,255,255,0.5); margin-bottom:18px; font-size:13px; color:var(--text-body);">
              <p style="margin:0 0 6px 0; font-weight:700; color:var(--teal-900);">Retention Period &amp; Soft Delete Policy:</p>
              <ul style="margin:0; padding-left:18px;">
                <li>The record will be <strong>Archived / Soft-Deleted</strong> immediately.</li>
                <li>Data will be safely stored in the <strong>Purge Retention Queue</strong> for <strong>60 Days</strong>.</li>
                <li>Permanent Purge requires explicit Admin Password Confirmation from <em>Admin Settings -> Retention Purge Queue</em>.</li>
              </ul>
            </div>

            <button type="button" id="dw-btn-archive" onclick="window.executeArchiveRecord()" class="btn-primary" style="width:100%; padding:12px; background:linear-gradient(135deg, var(--teal-900), #0f172a); color:white; border:none; border-radius:14px; font-size:14.5px; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:10px; box-shadow:var(--glass-shadow);">
              <i class="fa-solid fa-box-archive"></i> Archive &amp; Offboard Record
            </button>
          </div>

        </div>

        <!-- Wizard Footer Controls -->
        <div style="margin-top:18px; display:flex; justify-content:space-between; align-items:center; border-top:1px solid rgba(255,255,255,0.45); padding-top:16px;">
          <button type="button" id="dw-btn-prev" onclick="window.navigateWizard(-1)" class="btn-secondary" style="visibility:hidden; padding:9px 18px; font-size:12.5px;">
            <i class="fa-solid fa-arrow-left"></i> Previous
          </button>
          
          <button type="button" id="dw-btn-next" onclick="window.navigateWizard(1)" class="btn-primary" style="padding:9px 22px; font-size:12.5px; display:inline-flex; align-items:center; gap:8px; margin-left:auto;">
            Next Step <i class="fa-solid fa-arrow-right"></i>
          </button>
        </div>

      </div>
    </div>

    <!-- Admin Permanent Purge Confirmation Modal -->
    <div id="purge-confirm-modal" class="modal-overlay" style="display:none; position:fixed; inset:0; z-index:100000; background:rgba(31, 42, 36, 0.4); backdrop-filter:blur(12px); align-items:center; justify-content:center; padding:20px; opacity:0; transition:opacity 0.25s ease;">
      <div class="modal-box glass-card" style="width:100%; max-width:460px; background:rgba(255,255,255,0.65); border:1px solid rgba(255,255,255,0.7); backdrop-filter:blur(32px); border-radius:20px; padding:26px; box-shadow:0 18px 44px rgba(0,0,0,0.15);">
        <div style="text-align:center; margin-bottom:18px;">
          <div style="width:52px; height:52px; border-radius:50%; background:rgba(239,68,68,0.15); color:#ef4444; display:inline-flex; align-items:center; justify-content:center; font-size:22px; margin-bottom:10px;">
            <i class="fa-solid fa-triangle-exclamation"></i>
          </div>
          <h3 style="margin:0; font-size:18px; font-weight:800; color:var(--teal-900);">Permanent Purge Confirmation</h3>
          <p style="margin:4px 0 0 0; font-size:12.5px; color:var(--text-muted);">This operation is irreversible and will permanently delete all database records.</p>
        </div>

        <div class="form-group" style="display:flex; flex-direction:column; gap:6px; margin-bottom:14px;">
          <label style="font-size:12px; font-weight:700; color:var(--text-dark);">Re-enter Admin Password *</label>
          <input type="password" id="purge-admin-pass" placeholder="Enter password to confirm purge..." style="width:100%; padding:10px 12px; border-radius:10px; border:1px solid rgba(255,255,255,0.65); background:rgba(255,255,255,0.65); font-size:13.5px; outline:none;">
        </div>

        <div class="form-group" style="display:flex; flex-direction:column; gap:6px; margin-bottom:18px;">
          <label style="font-size:12px; font-weight:700; color:var(--text-dark);">Purge Reason / Justification</label>
          <input type="text" id="purge-reason" placeholder="Compliance purge justification..." style="width:100%; padding:10px 12px; border-radius:10px; border:1px solid rgba(255,255,255,0.65); background:rgba(255,255,255,0.65); font-size:13px; outline:none;">
        </div>

        <div style="display:flex; gap:12px;">
          <button type="button" onclick="document.getElementById('purge-confirm-modal').style.display='none'" class="btn-secondary" style="flex:1; padding:10px;">Cancel</button>
          <button type="button" onclick="window.confirmExecutePermanentPurge()" style="flex:1; padding:10px; background:#ef4444; color:white; font-weight:800; border:none; border-radius:10px; cursor:pointer;">Purge Permanently</button>
        </div>
      </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  // ── OPEN DELETION WIZARD ──────────────────────────────────────────────────
  window.openDeletionWizard = async function (recordType, targetId, targetName) {
    injectModalHTML();

    wizardState = {
      currentStep: 1,
      recordType: recordType || 'employee',
      targetId: targetId,
      targetName: targetName || 'Selected Record',
      requestId: null,
      reason: '',
      category: recordType === 'employee' ? 'Resignation' : 'Customer Closed',
      effectiveDate: new Date().toISOString().split('T')[0],
      hrRemarks: '',
      documents: [],
      approvals: [],
      dependencies: [],
      isLocked: false
    };

    // Update Modal Titles & Requirements Hint Text
    const titleText = recordType === 'employee' ? 'Employee Offboarding Wizard' :
                      recordType === 'customer' ? 'Customer Account Closure Wizard' :
                      recordType === 'project' ? 'Project Closure Wizard' : 'Task Archival Wizard';
    
    document.getElementById('dw-title').innerText = titleText;
    document.getElementById('dw-subtitle').innerText = `Target: ${targetName} (ID: ${targetId})`;

    const reqText = recordType === 'employee' ? 'Resignation Letter OR Termination Letter must be uploaded.' :
                    recordType === 'customer' ? 'At least 1 supporting closure document (Invoice, PO, Contract, Cancellation Request) must be uploaded.' :
                    'Closure report or manager approval document must be uploaded.';
    const docReqElem = document.getElementById('dw-doc-req-text');
    if (docReqElem) docReqElem.innerText = reqText;

    // Clear form inputs
    const reasonInput = document.getElementById('dw-reason');
    if (reasonInput) reasonInput.value = '';
    const hrRemarksInput = document.getElementById('dw-hr-remarks');
    if (hrRemarksInput) hrRemarksInput.value = '';
    const fileInput = document.getElementById('dw-file-input');
    if (fileInput) fileInput.value = '';
    renderDocumentList();

    // Reset Panels
    window.navigateWizardToStep(1);

    // Show Modal with active class and inline style overrides
    const modal = document.getElementById('deletion-wizard-modal');
    modal.classList.add('active');
    modal.style.display = 'flex';
    modal.style.opacity = '1';
    modal.style.pointerEvents = 'auto';
  };

  window.closeDeletionWizard = function () {
    const modal = document.getElementById('deletion-wizard-modal');
    if (modal) {
      modal.classList.remove('active');
      modal.style.display = 'none';
      modal.style.opacity = '0';
      modal.style.pointerEvents = 'none';
    }
  };

  // ── WIZARD STEP NAVIGATION ────────────────────────────────────────────────
  window.navigateWizardToStep = function (step) {
    wizardState.currentStep = step;

    // Toggle Panels
    for (let i = 1; i <= 5; i++) {
      const panel = document.getElementById(`dw-panel-${i}`);
      const stepBadge = document.getElementById(`dw-step-${i}`);
      if (panel) panel.style.display = i === step ? 'block' : 'none';

      if (stepBadge) {
        if (i < step) {
          stepBadge.style.color = 'var(--teal-700)';
          stepBadge.querySelector('span').style.background = 'var(--teal-600)';
          stepBadge.querySelector('span').style.color = 'white';
        } else if (i === step) {
          stepBadge.style.color = 'var(--teal-900)';
          stepBadge.querySelector('span').style.background = 'var(--teal-600)';
          stepBadge.querySelector('span').style.color = 'white';
        } else {
          stepBadge.style.color = 'var(--text-muted)';
          stepBadge.querySelector('span').style.background = 'rgba(0,0,0,0.08)';
          stepBadge.querySelector('span').style.color = 'var(--text-muted)';
        }
      }
    }

    // Toggle Prev/Next Buttons
    const btnPrev = document.getElementById('dw-btn-prev');
    const btnNext = document.getElementById('dw-btn-next');
    if (btnPrev) btnPrev.style.visibility = step > 1 ? 'visible' : 'hidden';

    if (btnNext) {
      if (step === 5) {
        btnNext.style.display = 'none';
      } else {
        btnNext.style.display = 'inline-flex';
      }
    }
  };

  window.navigateWizard = async function (direction) {
    const targetStep = wizardState.currentStep + direction;

    if (direction === 1) {
      // Validate Step 1
      if (wizardState.currentStep === 1) {
        const reason = document.getElementById('dw-reason').value.trim();
        if (!reason) {
          alert('Please enter a detailed reason for offboarding.');
          return;
        }
        wizardState.reason = reason;
        wizardState.category = document.getElementById('dw-category').value;
        wizardState.effectiveDate = document.getElementById('dw-effective-date').value;
        wizardState.hrRemarks = document.getElementById('dw-hr-remarks').value;

        // Create Deletion Request in Backend if not created yet
        if (!wizardState.requestId) {
          try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/v1/admin/deletion/request', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({
                recordType: wizardState.recordType,
                targetId: wizardState.targetId,
                targetName: wizardState.targetName,
                reason: wizardState.reason,
                category: wizardState.category,
                effectiveDate: wizardState.effectiveDate,
                hrRemarks: wizardState.hrRemarks
              })
            });

            const data = await res.json();
            if (!res.ok) {
              if (data.isLocked) {
                alert(`Offboarding Blocked! Active dependencies exist: ${data.dependencies.map(d=>d.message).join(', ')}`);
              } else {
                alert(`Error initializing offboard request: ${data.message}`);
              }
              return;
            }
            wizardState.requestId = data.request.id;
          } catch (e) {
            console.error('Offboard request error:', e);
            alert('Failed to connect to backend server.');
            return;
          }
        }
      }

      // Step 4 Validation Banner Render
      if (targetStep === 4) {
        await renderStep4Validation();
      }
    }

    window.navigateWizardToStep(targetStep);
  };

  // ── STEP 2: UPLOAD DOCUMENT ───────────────────────────────────────────────
  window.uploadWizardDocument = async function () {
    if (!wizardState.requestId) {
      alert('Please complete Step 1 first.');
      return;
    }

    const fileInput = document.getElementById('dw-file-input');
    const docType = document.getElementById('dw-doc-type').value;

    if (!fileInput.files || fileInput.files.length === 0) {
      alert('Please select a file to upload.');
      return;
    }

    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('requestId', wizardState.requestId);
    formData.append('documentType', docType);
    formData.append('document', file);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/admin/deletion/document', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        alert(`Document Upload Failed: ${data.message}`);
        return;
      }

      wizardState.documents.push(data.document);
      fileInput.value = '';
      renderDocumentList();
      alert(`✅ Document '${data.document.file_name}' (Version v${data.document.document_version}) verified and uploaded!`);
    } catch (e) {
      console.error('Doc upload error:', e);
      alert('Failed to upload document to server.');
    }
  };

  function renderDocumentList() {
    const container = document.getElementById('dw-doc-list');
    const countSpan = document.getElementById('dw-doc-count');
    if (countSpan) countSpan.innerText = wizardState.documents.length;

    if (wizardState.documents.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:18px; color:var(--text-muted); font-size:13px; background:rgba(255,255,255,0.25); border-radius:12px; border:1px dashed rgba(0,0,0,0.15);">No documents uploaded yet.</div>`;
      return;
    }

    container.innerHTML = wizardState.documents.map(doc => `
      <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 14px; background:rgba(255,255,255,0.45); border:1px solid rgba(255,255,255,0.65); border-radius:12px;">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="width:34px; height:34px; border-radius:8px; background:rgba(22,160,133,0.15); color:var(--teal-700); display:flex; align-items:center; justify-content:center; font-size:15px;">
            <i class="fa-solid fa-file-shield"></i>
          </div>
          <div>
            <div style="font-size:13px; font-weight:700; color:var(--text-dark);">${doc.file_name} <span style="background:rgba(22,160,133,0.15); color:var(--teal-700); padding:2px 6px; border-radius:6px; font-size:10px;">v${doc.document_version}</span></div>
            <div style="font-size:11px; color:var(--text-muted);">${doc.document_type} | Checksum SHA-256: ${doc.checksum ? doc.checksum.substring(0, 12) : 'OK'}...</div>
          </div>
        </div>
        <span style="color:var(--teal-700); font-weight:700; font-size:12px;"><i class="fa-solid fa-circle-check"></i> Verified</span>
      </div>
    `).join('');
  }

  // ── STEP 4: RENDER VALIDATION & DEPENDENCY SUMMARY ────────────────────────
  async function renderStep4Validation() {
    const banner = document.getElementById('dw-dependency-banner');
    document.getElementById('dw-sum-name').innerText = wizardState.targetName;
    document.getElementById('dw-sum-type').innerText = wizardState.recordType.toUpperCase();
    document.getElementById('dw-sum-cat').innerText = wizardState.category;
    document.getElementById('dw-sum-date').innerText = wizardState.effectiveDate;
    document.getElementById('dw-sum-docs').innerText = `${wizardState.documents.length} Uploaded Files`;

    // Check mandatory docs
    const uploadedTypes = wizardState.documents.map(d => d.document_type.toLowerCase());
    let docValid = true;
    let docMessage = '';

    if (wizardState.recordType === 'employee') {
      const hasResignation = uploadedTypes.some(t => t.includes('resignation'));
      const hasTermination = uploadedTypes.some(t => t.includes('termination'));
      if (!hasResignation && !hasTermination) {
        docValid = false;
        docMessage = 'Employee cannot be offboarded until required documents are uploaded (Resignation Letter OR Termination Letter).';
      }
    } else if (wizardState.recordType === 'customer') {
      if (uploadedTypes.length === 0) {
        docValid = false;
        docMessage = 'Customer cannot be closed without uploading at least 1 supporting closure document.';
      }
    }

    if (!docValid) {
      banner.innerHTML = `
        <div style="padding:12px 16px; background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.3); border-radius:14px; color:#ef4444; font-size:13px; font-weight:700; display:flex; align-items:center; gap:12px;">
          <i class="fa-solid fa-triangle-exclamation" style="font-size:20px;"></i>
          <div>
            <div>Validation Failed: Missing Required Documents</div>
            <div style="font-size:12px; font-weight:600; color:#dc2626; margin-top:2px;">${docMessage}</div>
          </div>
        </div>
      `;
    } else {
      banner.innerHTML = `
        <div style="padding:12px 16px; background:rgba(16,185,129,0.15); border:1px solid rgba(16,185,129,0.3); border-radius:14px; color:#047857; font-size:13px; font-weight:700; display:flex; align-items:center; gap:12px;">
          <i class="fa-solid fa-circle-check" style="font-size:20px;"></i>
          <div>
            <div>All Mandatory Documents &amp; System Validations Passed</div>
            <div style="font-size:12px; font-weight:600; color:#065f46; margin-top:2px;">Record is ready for soft-delete archiving and retention staging.</div>
          </div>
        </div>
      `;
    }
  }

  // ── STEP 5: EXECUTE ARCHIVE ───────────────────────────────────────────────
  window.executeArchiveRecord = async function () {
    if (!wizardState.requestId) {
      alert('Invalid offboard request context.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/admin/deletion/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ requestId: wizardState.requestId })
      });

      const data = await res.json();
      if (!res.ok) {
        alert(`Offboard Archival Failed: ${data.message}`);
        return;
      }

      alert(`🎉 ${data.message}`);
      window.closeDeletionWizard();
      window.location.reload();
    } catch (e) {
      console.error('Archive error:', e);
      alert('Failed to execute archival request.');
    }
  };

  // ── PURGE QUEUE MODAL (ADMIN SETTINGS) ────────────────────────────────────
  let selectedPurgeRequestId = null;

  window.openPurgeQueueModal = async function () {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/admin/deletion/purge-queue', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await res.json();
      if (!res.ok) return;

      console.log('Retention Purge Queue:', data.queue);
    } catch (e) {
      console.error('Purge queue error:', e);
    }
  };

  window.triggerPermanentPurgePrompt = function (requestId) {
    selectedPurgeRequestId = requestId;
    const modal = document.getElementById('purge-confirm-modal');
    if (modal) {
      modal.style.display = 'flex';
      modal.style.opacity = '1';
      modal.style.pointerEvents = 'auto';
    }
  };

  window.confirmExecutePermanentPurge = async function () {
    if (!selectedPurgeRequestId) return;
    const adminPass = document.getElementById('purge-admin-pass').value;
    const reason = document.getElementById('purge-reason').value;

    if (!adminPass) {
      alert('Please enter your Admin Password to confirm purge.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/admin/deletion/purge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          requestId: selectedPurgeRequestId,
          adminPassword: adminPass,
          reason: reason
        })
      });

      const data = await res.json();
      if (!res.ok) {
        alert(`Permanent Purge Failed: ${data.message}`);
        return;
      }

      alert(`🔥 ${data.message}`);
      document.getElementById('purge-confirm-modal').style.display = 'none';
      window.location.reload();
    } catch (e) {
      console.error('Purge error:', e);
      alert('Failed to execute permanent purge.');
    }
  };

})();
