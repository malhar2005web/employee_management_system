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

        // SMTP
        if (settings.smtp) {
            document.getElementById('smtp-host').value = settings.smtp.host || '';
            document.getElementById('smtp-port').value = settings.smtp.port || '';
            document.getElementById('smtp-user').value = settings.smtp.user || '';
            document.getElementById('smtp-pass').value = settings.smtp.pass || '';
            document.getElementById('smtp-sender').value = settings.smtp.sender || '';
        }

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

            if (file.size > 25 * 1024 * 1024) {
                alert("File size exceeds maximum 25MB limit.");
                inputWaFile.value = '';
                return;
            }

            const formData = new FormData();
            formData.append('attachment', file);

            try {
                const res = await fetch('/api/v1/admin/settings/upload-attachment', {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    document.getElementById('wa-attachment-url').value = data.attachmentUrl;
                    document.getElementById('wa-attachment-filename').value = data.attachmentName;

                    const nameLabel = document.getElementById('wa-attachment-name');
                    if (nameLabel) {
                        nameLabel.innerHTML = `<a href="${data.attachmentUrl}" target="_blank" style="color:var(--teal-600); font-weight:700; text-decoration:none;"><i class="fa-solid fa-paperclip"></i> ${data.attachmentName}</a>`;
                    }
                    if (btnRemoveWa) btnRemoveWa.style.display = 'inline-block';
                    if (typeof showToast === 'function') showToast("Attachment uploaded successfully!");
                } else {
                    alert(data.message || "Failed to upload attachment");
                }
            } catch (err) {
                console.error("Attachment upload error:", err);
                alert("Error uploading attachment file");
            }
        });
    }

    if (btnRemoveWa) {
        btnRemoveWa.addEventListener('click', () => {
            document.getElementById('wa-attachment-url').value = '';
            document.getElementById('wa-attachment-filename').value = '';
            const nameLabel = document.getElementById('wa-attachment-name');
            if (nameLabel) nameLabel.textContent = 'No file attached';
            btnRemoveWa.style.display = 'none';
            if (inputWaFile) inputWaFile.value = '';
        });
    }

    // Form submit save
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

            const payload = {
                company: {
                    name: getVal('com-name'),
                    email: getVal('com-email'),
                    address: getVal('com-address'),
                    timezone: getVal('com-tz') || 'UTC',
                    currency: getVal('com-curr') || 'USD'
                },
                smtp: {
                    host: getVal('smtp-host'),
                    port: parseInt(getVal('smtp-port'), 10) || 2525,
                    user: getVal('smtp-user'),
                    pass: getVal('smtp-pass'),
                    sender: getVal('smtp-sender')
                },
                preferences: {
                    standardHours: parseFloat(getVal('pref-hours')) || 8,
                    gracePeriod: parseInt(getVal('pref-grace'), 10) || 15,
                    workingDays
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
                        showToast("System Settings & WhatsApp template saved successfully!", "success");
                    } else {
                        alert("System Settings & WhatsApp template saved successfully!");
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
