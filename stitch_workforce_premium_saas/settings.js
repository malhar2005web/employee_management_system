document.addEventListener('DOMContentLoaded', () => {
    const settingsForm = document.getElementById('settings-form');
    const logoutBtn = document.getElementById('logout-btn');

    // Load Settings
    const loadSettings = async () => {
        try {
            const response = await fetch('/api/v1/admin/settings');
            const data = await response.json();
            if (response.ok && data.success) {
                populateSettingsForm(data.data);
            }
        } catch (error) {
            console.error("Error loading settings configuration:", error);
        }
    };

    const populateSettingsForm = (settings) => {
        if (!settings) return;

        // Company
        if (settings.company) {
            document.getElementById('com-name').value = settings.company.name || '';
            document.getElementById('com-email').value = settings.company.email || '';
            document.getElementById('com-address').value = settings.company.address || '';
            document.getElementById('com-tz').value = settings.company.timezone || 'UTC';
            document.getElementById('com-curr').value = settings.company.currency || 'USD';
        }

        // Email Ticketing & Support Mailbox
        const et = settings.emailTicketing || {};
        const smtp = settings.smtp || {};
        
        const etEnabled = document.getElementById('email-ticket-enabled');
        if (etEnabled) etEnabled.checked = et.enabled !== false;

        const etUser = document.getElementById('email-ticket-user');
        if (etUser) etUser.value = et.email || smtp.user || 'joshi@pentasoftconsultancy.com';

        const etPass = document.getElementById('email-ticket-pass');
        if (etPass) etPass.value = et.password || smtp.pass || '';

        const etImapHost = document.getElementById('email-ticket-imap-host');
        if (etImapHost) etImapHost.value = et.imapHost || 'mail.pentasoftconsultancy.com';

        const etImapPort = document.getElementById('email-ticket-imap-port');
        if (etImapPort) etImapPort.value = et.imapPort || 993;

        const etImapSec = document.getElementById('email-ticket-imap-sec');
        if (etImapSec) etImapSec.value = et.imapSecure !== false ? 'true' : 'false';

        const etSmtpHost = document.getElementById('email-ticket-smtp-host');
        if (etSmtpHost) etSmtpHost.value = et.smtpHost || smtp.host || 'mail.pentasoftconsultancy.com';

        const etSmtpPort = document.getElementById('email-ticket-smtp-port');
        if (etSmtpPort) etSmtpPort.value = et.smtpPort || smtp.port || 465;

        const etSmtpSec = document.getElementById('email-ticket-smtp-sec');
        if (etSmtpSec) etSmtpSec.value = et.smtpSecure !== false ? 'true' : 'false';

        const etAutoReply = document.getElementById('email-ticket-autoreply');
        if (etAutoReply) etAutoReply.checked = et.autoReply !== false;

        const etInterval = document.getElementById('email-ticket-interval');
        if (etInterval) etInterval.value = et.pollIntervalSeconds || 30;

        // Legacy SMTP fields fallback if present on page
        if (document.getElementById('smtp-host')) document.getElementById('smtp-host').value = smtp.host || et.smtpHost || '';
        if (document.getElementById('smtp-port')) document.getElementById('smtp-port').value = smtp.port || et.smtpPort || '';
        if (document.getElementById('smtp-user')) document.getElementById('smtp-user').value = smtp.user || et.email || '';
        if (document.getElementById('smtp-pass')) document.getElementById('smtp-pass').value = smtp.pass || et.password || '';

        // Preferences
        if (settings.preferences) {
            document.getElementById('pref-hours').value = settings.preferences.standardHours || 8;
            document.getElementById('pref-grace').value = settings.preferences.gracePeriod || 15;
            
            // Checkboxes
            const workingDays = settings.preferences.workingDays || [1, 2, 3, 4, 5];
            const checkboxes = document.querySelectorAll('input[name="workdays"]');
            checkboxes.forEach(cb => {
                const dayVal = parseInt(cb.value, 10);
                cb.checked = workingDays.includes(dayVal);
            });
        }

        // Whitelist
        if (document.getElementById('whitelist-ips')) {
            document.getElementById('whitelist-ips').value = settings.ipWhitelist || '';
        }
        if (document.getElementById('sec-ip')) {
            document.getElementById('sec-ip').value = settings.ipWhitelist || '';
        }

        // WhatsApp Template
        if (settings.whatsappTemplate) {
            const waMsg = document.getElementById('wa-message-template');
            const waUrl = document.getElementById('wa-attachment-url');
            const waName = document.getElementById('wa-attachment-filename');
            const waNameLabel = document.getElementById('wa-attachment-name');
            const waRemoveBtn = document.getElementById('btn-remove-wa-file');

            if (waMsg) waMsg.value = settings.whatsappTemplate.message || '';
            if (waUrl) waUrl.value = settings.whatsappTemplate.attachmentUrl || '';
            if (waName) waName.value = settings.whatsappTemplate.attachmentName || '';

            if (settings.whatsappTemplate.attachmentName && settings.whatsappTemplate.attachmentUrl) {
                if (waNameLabel) {
                    waNameLabel.innerHTML = `<a href="${settings.whatsappTemplate.attachmentUrl}" target="_blank" style="color:var(--teal-600); font-weight:700; text-decoration:none;"><i class="fa-solid fa-paperclip"></i> ${settings.whatsappTemplate.attachmentName}</a>`;
                }
                if (waRemoveBtn) waRemoveBtn.style.display = 'inline-block';
            } else {
                if (waNameLabel) waNameLabel.textContent = 'No file attached';
                if (waRemoveBtn) waRemoveBtn.style.display = 'none';
            }
        }
    };

    // Password show/hide toggle
    const togglePass = document.getElementById('toggle-email-pass');
    const passInput = document.getElementById('email-ticket-pass');
    if (togglePass && passInput) {
        togglePass.addEventListener('click', () => {
            if (passInput.type === 'password') {
                passInput.type = 'text';
                togglePass.classList.replace('fa-eye', 'fa-eye-slash');
            } else {
                passInput.type = 'password';
                togglePass.classList.replace('fa-eye-slash', 'fa-eye');
            }
        });
    }

    // Test Email Connection Handler
    const testEmailBtn = document.getElementById('btn-test-email-conn');
    const testStatusDiv = document.getElementById('email-test-status');
    if (testEmailBtn && testStatusDiv) {
        testEmailBtn.addEventListener('click', async () => {
            const payload = {
                email: document.getElementById('email-ticket-user')?.value.trim() || '',
                password: document.getElementById('email-ticket-pass')?.value.trim() || '',
                imapHost: document.getElementById('email-ticket-imap-host')?.value.trim() || '',
                imapPort: parseInt(document.getElementById('email-ticket-imap-port')?.value, 10) || 993,
                imapSecure: document.getElementById('email-ticket-imap-sec')?.value === 'true',
                smtpHost: document.getElementById('email-ticket-smtp-host')?.value.trim() || '',
                smtpPort: parseInt(document.getElementById('email-ticket-smtp-port')?.value, 10) || 465,
                smtpSecure: document.getElementById('email-ticket-smtp-sec')?.value === 'true'
            };

            testStatusDiv.style.display = 'block';
            testStatusDiv.style.background = 'rgba(2,132,199,0.1)';
            testStatusDiv.style.color = '#0284c7';
            testStatusDiv.style.border = '1px solid rgba(2,132,199,0.3)';
            testStatusDiv.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right:8px;"></i> Testing IMAP &amp; SMTP connection to mail server...';

            try {
                const res = await fetch('/api/v1/admin/settings/test-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();

                if (data.success) {
                    testStatusDiv.style.background = 'rgba(16,185,129,0.12)';
                    testStatusDiv.style.color = '#059669';
                    testStatusDiv.style.border = '1px solid rgba(16,185,129,0.3)';
                    testStatusDiv.innerHTML = `
                        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                            <div><i class="fa-solid fa-circle-check" style="margin-right:8px;"></i> <strong>Connection Verified!</strong> Both IMAP and SMTP connected successfully.</div>
                            <button type="submit" form="settings-form" class="btn-primary" style="padding:6px 16px; font-size:12px; font-weight:800; border-radius:6px; background:#0d9488; cursor:pointer; box-shadow:0 2px 8px rgba(13,148,136,0.3);">
                                <i class="fa-solid fa-floppy-disk"></i> Save &amp; Apply Now
                            </button>
                        </div>
                    `;
                    if (typeof showToast === 'function') showToast("Email connection verified! Don't forget to click 'Save Settings'.", "success");
                } else {
                    testStatusDiv.style.background = 'rgba(239,68,68,0.12)';
                    testStatusDiv.style.color = '#dc2626';
                    testStatusDiv.style.border = '1px solid rgba(239,68,68,0.3)';
                    const imapMsg = data.results?.imap?.message || '';
                    const smtpMsg = data.results?.smtp?.message || '';
                    testStatusDiv.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="margin-right:8px;"></i> <strong>Test Notice:</strong> ${data.message || ''}<br><small style="display:block;margin-top:4px;">IMAP: ${imapMsg} | SMTP: ${smtpMsg}</small>`;
                }
            } catch (e) {
                testStatusDiv.style.background = 'rgba(239,68,68,0.12)';
                testStatusDiv.style.color = '#dc2626';
                testStatusDiv.style.border = '1px solid rgba(239,68,68,0.3)';
                testStatusDiv.innerHTML = '<i class="fa-solid fa-circle-xmark" style="margin-right:8px;"></i> <strong>Network Error:</strong> Failed to reach test server endpoint.';
            }
        });
    }

    // Wire Appearance & Font Size controls
    const fontSelect = document.getElementById('app-font-size-select');
    const fontSlider = document.getElementById('app-font-size-slider');
    const fontScaleVal = document.getElementById('font-scale-value');

    if (fontSelect && fontSlider) {
        const savedScale = localStorage.getItem('app_font_scale') || '112';
        fontSelect.value = savedScale;
        fontSlider.value = savedScale;
        if (fontScaleVal) fontScaleVal.textContent = savedScale + '%';

        const updateScale = (val) => {
            fontSelect.value = val;
            fontSlider.value = val;
            if (fontScaleVal) fontScaleVal.textContent = val + '%';
            if (typeof window.applyGlobalFontSize === 'function') {
                window.applyGlobalFontSize(val);
            } else {
                const scaleFactor = parseFloat(val) / 100;
                document.documentElement.style.setProperty('--app-font-scale', scaleFactor);
                document.documentElement.style.fontSize = (15 * scaleFactor) + 'px';
                localStorage.setItem('app_font_scale', val);
            }
        };

        fontSelect.addEventListener('change', (e) => updateScale(e.target.value));
        fontSlider.addEventListener('input', (e) => updateScale(e.target.value));
    }

    // Wire WhatsApp Attachment File Upload
    const btnUploadWa = document.getElementById('btn-upload-wa-file');
    const inputWaFile = document.getElementById('wa-attachment-file-input');
    const btnRemoveWa = document.getElementById('btn-remove-wa-file');

    if (btnUploadWa && inputWaFile) {
        btnUploadWa.addEventListener('click', () => inputWaFile.click());

        inputWaFile.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append('attachment', file);

            try {
                const res = await fetch('/api/v1/admin/settings/upload-attachment', {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();
                if (data.success) {
                    document.getElementById('wa-attachment-url').value = data.attachmentUrl;
                    document.getElementById('wa-attachment-filename').value = data.attachmentName;
                    const waNameLabel = document.getElementById('wa-attachment-name');
                    if (waNameLabel) {
                        waNameLabel.innerHTML = `<a href="${data.attachmentUrl}" target="_blank" style="color:var(--teal-600); font-weight:700; text-decoration:none;"><i class="fa-solid fa-paperclip"></i> ${data.attachmentName}</a>`;
                    }
                    if (btnRemoveWa) btnRemoveWa.style.display = 'inline-block';
                    if (typeof showToast === 'function') showToast("Attachment uploaded successfully!", "success");
                } else {
                    alert(data.message || "Failed to upload file");
                }
            } catch (err) {
                console.error("Upload error:", err);
                alert("Network error uploading attachment");
            }
        });
    }

    if (btnRemoveWa) {
        btnRemoveWa.addEventListener('click', () => {
            document.getElementById('wa-attachment-url').value = '';
            document.getElementById('wa-attachment-filename').value = '';
            const waNameLabel = document.getElementById('wa-attachment-name');
            if (waNameLabel) waNameLabel.textContent = 'No file attached';
            btnRemoveWa.style.display = 'none';
        });
    }

    // Submit Settings Form
    if (settingsForm) {
        settingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Assemble checked days
            const checkboxes = document.querySelectorAll('input[name="workdays"]:checked');
            const workingDays = Array.from(checkboxes).map(cb => parseInt(cb.value, 10));

            const getVal = (id) => {
                const el = document.getElementById(id);
                return el ? el.value.trim() : '';
            };

            const isChecked = (id) => {
                const el = document.getElementById(id);
                return el ? el.checked : true;
            };

            const emailUser = getVal('email-ticket-user') || getVal('smtp-user') || 'joshi@pentasoftconsultancy.com';
            const emailPass = getVal('email-ticket-pass') || getVal('smtp-pass');
            const imapHost = getVal('email-ticket-imap-host') || 'mail.pentasoftconsultancy.com';
            const imapPort = parseInt(getVal('email-ticket-imap-port'), 10) || 993;
            const imapSec = (document.getElementById('email-ticket-imap-sec')?.value !== 'false');
            const smtpHost = getVal('email-ticket-smtp-host') || getVal('smtp-host') || 'mail.pentasoftconsultancy.com';
            const smtpPort = parseInt(getVal('email-ticket-smtp-port') || getVal('smtp-port'), 10) || 465;
            const smtpSec = (document.getElementById('email-ticket-smtp-sec')?.value !== 'false');

            const payload = {
                company: {
                    name: getVal('com-name'),
                    email: getVal('com-email'),
                    address: getVal('com-address'),
                    timezone: getVal('com-tz') || 'UTC',
                    currency: getVal('com-curr') || 'USD'
                },
                smtp: {
                    host: smtpHost,
                    port: smtpPort,
                    user: emailUser,
                    pass: emailPass,
                    sender: emailUser
                },
                emailTicketing: {
                    enabled: isChecked('email-ticket-enabled'),
                    email: emailUser,
                    password: emailPass,
                    imapHost: imapHost,
                    imapPort: imapPort,
                    imapSecure: imapSec,
                    smtpHost: smtpHost,
                    smtpPort: smtpPort,
                    smtpSecure: smtpSec,
                    autoReply: isChecked('email-ticket-autoreply'),
                    pollIntervalSeconds: parseInt(getVal('email-ticket-interval'), 10) || 30
                },
                preferences: {
                    standardHours: parseFloat(getVal('pref-hours')) || 8,
                    gracePeriod: parseInt(getVal('pref-grace') || getVal('late-grace'), 10) || 15,
                    workingDays: workingDays.length ? workingDays : [1, 2, 3, 4, 5]
                },
                ipWhitelist: getVal('sec-ip') || getVal('whitelist-ips'),
                whatsappTemplate: {
                    message: getVal('wa-message-template'),
                    attachmentUrl: getVal('wa-attachment-url'),
                    attachmentName: getVal('wa-attachment-filename')
                }
            };

            try {
                const response = await fetch('/api/v1/admin/settings', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await response.json();
                if (response.ok && data.success) {
                    if (typeof showToast === 'function') {
                        showToast("System Settings & Email-to-Ticket configuration saved successfully!", "success");
                    } else {
                        alert("System Settings & Email-to-Ticket configuration saved successfully!");
                    }
                    loadSettings();
                } else {
                    alert(data.message || "Failed to update configuration");
                }
            } catch (error) {
                console.error("Error saving settings preference:", error);
                alert("Error saving settings configuration");
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                const response = await fetch('/api/v1/auth/logout', { method: 'POST' });
                if (response.ok) {
                    window.location.href = '/login.html';
                }
            } catch (error) {
                console.error("Logout failed:", error);
            }
        });
    }

    // Initial load
    loadSettings();
});
