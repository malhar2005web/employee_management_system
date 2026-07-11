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
        document.getElementById('whitelist-ips').value = settings.ipWhitelist || '';
    };

    // Form submit save
    if (settingsForm) {
        settingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Assemble checked days
            const checkboxes = document.querySelectorAll('input[name="workdays"]:checked');
            const workingDays = Array.from(checkboxes).map(cb => parseInt(cb.value, 10));

            const payload = {
                company: {
                    name: document.getElementById('com-name').value.trim(),
                    email: document.getElementById('com-email').value.trim(),
                    address: document.getElementById('com-address').value.trim(),
                    timezone: document.getElementById('com-tz').value,
                    currency: document.getElementById('com-curr').value.trim()
                },
                smtp: {
                    host: document.getElementById('smtp-host').value.trim(),
                    port: parseInt(document.getElementById('smtp-port').value, 10) || 25,
                    user: document.getElementById('smtp-user').value.trim(),
                    pass: document.getElementById('smtp-pass').value.trim(),
                    sender: document.getElementById('smtp-sender').value.trim()
                },
                preferences: {
                    standardHours: parseFloat(document.getElementById('pref-hours').value) || 8,
                    gracePeriod: parseInt(document.getElementById('pref-grace').value, 10) || 15,
                    workingDays
                },
                ipWhitelist: document.getElementById('whitelist-ips').value.trim()
            };

            try {
                const response = await fetch('/api/v1/admin/settings', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await response.json();
                if (response.ok && data.success) {
                    alert("System Settings configuration updated successfully!");
                    loadSettings();
                } else {
                    alert(data.message || "Failed to update configuration");
                }
            } catch (error) {
                console.error("Error saving settings preference:", error);
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
