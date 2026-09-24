// Multi-Tenant Global Fetch Interceptor: Automatically attaches X-Company-Code and Authorization Bearer header
(function() {
    const originalFetch = window.fetch;
    window.fetch = function(url, options = {}) {
        options = options || {};
        options.headers = options.headers || {};
        const companyCode = localStorage.getItem('company_code') || 'pcs';
        const token = localStorage.getItem('token');

        // Handle auto-clear on logout request
        if (typeof url === 'string' && url.includes('/api/v1/auth/logout')) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        }

        if (companyCode) {
            if (options.headers instanceof Headers) {
                if (!options.headers.has('x-company-code')) options.headers.set('x-company-code', companyCode);
                if (token && !options.headers.has('authorization')) options.headers.set('authorization', 'Bearer ' + token);
            } else if (Array.isArray(options.headers)) {
                if (!options.headers.some(h => h[0].toLowerCase() === 'x-company-code')) options.headers.push(['x-company-code', companyCode]);
                if (token && !options.headers.some(h => h[0].toLowerCase() === 'authorization')) options.headers.push(['authorization', 'Bearer ' + token]);
            } else {
                if (!options.headers['x-company-code']) options.headers['x-company-code'] = companyCode;
                if (token && !options.headers['authorization'] && !options.headers['Authorization']) options.headers['Authorization'] = 'Bearer ' + token;
            }
        }

        if (options.credentials === undefined) {
            options.credentials = 'include';
        }

        return originalFetch.call(this, url, options);
    };
})();

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const rememberMeCheckbox = document.getElementById('remember-me');
    const errorAlert = document.getElementById('error-alert');
    const successAlert = document.getElementById('success-alert');
    const forgotLink = document.getElementById('forgot-link');
    const brandTitle = document.getElementById('login-brand-title');
    const brandSubtitle = document.getElementById('login-brand-subtitle');

    const showAlert = (alertEl, message, isSuccess = false) => {
        if (!alertEl) return;
        alertEl.textContent = message;
        alertEl.style.display = 'block';
        setTimeout(() => {
            alertEl.style.display = 'none';
        }, 6000);
    };

    // Auto-login persistence check (ONLY execute on login page to avoid dashboard reload loops)
    const checkAutoLogin = async () => {
        // If not on login page, abort immediately
        const isLoginPage = !!loginForm || window.location.pathname.endsWith('login.html') || window.location.pathname === '/';
        if (!isLoginPage) return;

        const token = localStorage.getItem('token');
        const rememberMePref = localStorage.getItem('remember_me');

        // Restore remembered email if present
        const savedEmail = localStorage.getItem('remembered_email');
        if (savedEmail && emailInput) {
            emailInput.value = savedEmail;
        }
        if (rememberMeCheckbox) {
            rememberMeCheckbox.checked = rememberMePref !== 'false';
        }

        // If token exists and remember_me is not disabled, try auto-login
        if (token && rememberMePref !== 'false') {
            try {
                const meRes = await fetch('/api/v1/auth/me');
                if (meRes.ok) {
                    const meData = await meRes.json();
                    if (meData.success && meData.data) {
                        const role = meData.data.role;
                        const currentPath = window.location.pathname;
                        if (role === 'Admin' && !currentPath.includes('admin-dashboard.html')) {
                            window.location.replace('/admin-dashboard.html');
                            return;
                        } else if (role === 'Employee' && !currentPath.includes('employee-dashboard.html')) {
                            window.location.replace('/employee-dashboard.html');
                            return;
                        }
                    }
                }
            } catch (err) {
                console.warn('[Auth] Auto-login check failed, continuing to login page:', err.message);
            }
        }
    };

    // Auto-detect company from Subdomain or URL query param (?org=tata or ?company=tata)
    const detectCompanyContext = async () => {
        let detectedCode = '';

        // 1. Check Subdomain (e.g. tata.domain.com)
        const host = window.location.hostname;
        if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(host) && host !== 'localhost') {
            const parts = host.split('.');
            if (parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'app' && parts[0] !== 'api') {
                detectedCode = parts[0].toLowerCase();
            }
        }

        // 2. Check URL search param (?org=tata or ?company=tata)
        const urlParams = new URLSearchParams(window.location.search);
        const queryOrg = urlParams.get('org') || urlParams.get('company');
        if (queryOrg) {
            detectedCode = queryOrg.trim().toLowerCase();
        }

        // 3. Fallback to localStorage if previously set
        if (!detectedCode) {
            detectedCode = localStorage.getItem('company_code') || 'pcs';
        }

        if (detectedCode && detectedCode !== 'pcs') {
            localStorage.setItem('company_code', detectedCode);
            await fetchAndApplyBranding(detectedCode);
        }
    };

    const fetchAndApplyBranding = async (code) => {
        if (!code || code === 'pcs') {
            if (brandTitle) brandTitle.textContent = 'PentaTEAMBRIDGE';
            if (brandSubtitle) brandSubtitle.textContent = 'Sign in to access the portal';
            return;
        }

        try {
            const res = await fetch(`/api/v1/auth/company-info/${encodeURIComponent(code)}`);
            const data = await res.json();
            if (res.ok && data.success && data.company) {
                if (brandTitle) brandTitle.textContent = data.company.company_name;
                if (brandSubtitle) brandSubtitle.textContent = `Sign in to access ${data.company.company_name} Portal`;
            }
        } catch (e) {
            console.warn('[Branding] Could not load company info:', e.message);
        }
    };

    detectCompanyContext();
    checkAutoLogin();

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (errorAlert) errorAlert.style.display = 'none';
            if (successAlert) successAlert.style.display = 'none';

            const email = emailInput.value.trim();
            const password = passwordInput.value;
            const companyCode = (localStorage.getItem('company_code') || 'pcs').trim().toLowerCase();
            const isRememberMe = rememberMeCheckbox ? rememberMeCheckbox.checked : true;

            const submitBtn = loginForm.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing in...';
            }

            try {
                const response = await fetch('/api/v1/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Company-Code': companyCode
                    },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    if (data.token) {
                        localStorage.setItem('token', data.token);
                    }
                    if (data.user) {
                        localStorage.setItem('user', JSON.stringify(data.user));
                    }
                    const activeCode = data.user?.company_code || companyCode;
                    localStorage.setItem('company_code', activeCode);

                    // Remember Me persistence
                    if (isRememberMe) {
                        localStorage.setItem('remember_me', 'true');
                        localStorage.setItem('remembered_email', email);
                    } else {
                        localStorage.setItem('remember_me', 'false');
                        localStorage.removeItem('remembered_email');
                    }

                    // Redirect based on user role
                    const role = data.user.role;
                    if (role === 'Admin') {
                        window.location.href = '/admin-dashboard.html';
                    } else if (role === 'Employee') {
                        window.location.href = '/employee-dashboard.html';
                    } else {
                        showAlert(errorAlert, 'Invalid user role configuration.');
                    }
                } else {
                    showAlert(errorAlert, data.message || 'Login failed. Please check your credentials.');
                }
            } catch (error) {
                console.error('Login error:', error);
                showAlert(errorAlert, 'An error occurred during login. Please try again later.');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = 'Sign In';
                }
            }
        });
    }

    if (forgotLink) {
        forgotLink.addEventListener('click', async (e) => {
            e.preventDefault();
            if (errorAlert) errorAlert.style.display = 'none';
            if (successAlert) successAlert.style.display = 'none';

            const email = prompt('Enter your registered email address:');
            if (!email) return;

            try {
                const response = await fetch('/api/v1/auth/forgot-password', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email: email.trim() })
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    showAlert(successAlert, data.message, true);
                } else {
                    showAlert(errorAlert, data.message || 'Failed to send reset link.');
                }
            } catch (error) {
                console.error('Forgot password error:', error);
                showAlert(errorAlert, 'An error occurred. Please try again.');
            }
        });
    }

    // ================= REGISTER NEW COMPANY / ADMIN MODAL =================
    const regModal = document.getElementById('register-company-modal');
    const btnOpenReg = document.getElementById('btn-open-register-modal');
    const regModalClose = document.getElementById('register-modal-close');
    const regForm = document.getElementById('register-company-form');
    const regCompanyName = document.getElementById('reg-company-name');
    const regCompanyCode = document.getElementById('reg-company-code');
    const regAdminName = document.getElementById('reg-admin-name');
    const regAdminEmail = document.getElementById('reg-admin-email');
    const regPassword = document.getElementById('reg-password');
    const regConfirmPassword = document.getElementById('reg-confirm-password');
    const regErrorAlert = document.getElementById('reg-error-alert');
    const regSuccessAlert = document.getElementById('reg-success-alert');
    const btnSubmitCompany = document.getElementById('btn-submit-company');

    let codeManuallyEdited = false;

    const openRegisterModal = () => {
        if (!regModal) return;
        if (regForm) regForm.reset();
        if (regErrorAlert) regErrorAlert.style.display = 'none';
        if (regSuccessAlert) regSuccessAlert.style.display = 'none';
        codeManuallyEdited = false;
        regModal.style.display = 'flex';
        requestAnimationFrame(() => {
            regModal.classList.add('active');
            regModal.style.opacity = '1';
        });
    };

    const closeRegisterModal = () => {
        if (!regModal) return;
        regModal.classList.remove('active');
        regModal.style.opacity = '0';
        setTimeout(() => {
            regModal.style.display = 'none';
        }, 220);
    };

    if (btnOpenReg) {
        btnOpenReg.addEventListener('click', (e) => {
            e.preventDefault();
            openRegisterModal();
        });
    }

    if (regModalClose) {
        regModalClose.addEventListener('click', closeRegisterModal);
    }

    if (regModal) {
        regModal.addEventListener('click', (e) => {
            if (e.target === regModal) closeRegisterModal();
        });
    }

    // Auto-open on #register hash or action query
    if (window.location.hash === '#register' || new URLSearchParams(window.location.search).get('action') === 'register') {
        openRegisterModal();
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && regModal && regModal.style.display === 'flex') {
            closeRegisterModal();
        }
    });

    // Auto-generate company code slug
    if (regCompanyCode) {
        regCompanyCode.addEventListener('input', () => {
            codeManuallyEdited = true;
        });
    }

    if (regCompanyName && regCompanyCode) {
        regCompanyName.addEventListener('input', () => {
            if (!codeManuallyEdited) {
                const slug = regCompanyName.value
                    .trim()
                    .toLowerCase()
                    .replace(/[^a-z0-9]/g, '')
                    .slice(0, 16);
                regCompanyCode.value = slug;
            }
        });
    }

    // Password Eye Toggles
    const toggleRegPwd = document.getElementById('toggle-reg-pwd');
    if (toggleRegPwd && regPassword) {
        toggleRegPwd.addEventListener('click', () => {
            const isPwd = regPassword.type === 'password';
            regPassword.type = isPwd ? 'text' : 'password';
            toggleRegPwd.className = isPwd ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
        });
    }

    const toggleRegConfPwd = document.getElementById('toggle-reg-conf-pwd');
    if (toggleRegConfPwd && regConfirmPassword) {
        toggleRegConfPwd.addEventListener('click', () => {
            const isPwd = regConfirmPassword.type === 'password';
            regConfirmPassword.type = isPwd ? 'text' : 'password';
            toggleRegConfPwd.className = isPwd ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
        });
    }

    // Submit Company Registration
    if (regForm) {
        regForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (regErrorAlert) regErrorAlert.style.display = 'none';
            if (regSuccessAlert) regSuccessAlert.style.display = 'none';

            const companyName = regCompanyName ? regCompanyName.value.trim() : '';
            const companyCode = regCompanyCode ? regCompanyCode.value.trim().toLowerCase().replace(/[^a-z0-9]/g, '') : '';
            const adminFullName = regAdminName ? regAdminName.value.trim() : '';
            const email = regAdminEmail ? regAdminEmail.value.trim() : '';
            const password = regPassword ? regPassword.value : '';
            const confirmPassword = regConfirmPassword ? regConfirmPassword.value : '';

            if (!companyName || !companyCode || !adminFullName || !email || !password) {
                showAlert(regErrorAlert, 'Please fill in all required fields.');
                return;
            }

            if (companyCode.length < 2) {
                showAlert(regErrorAlert, 'Company Code must be at least 2 alphanumeric characters.');
                if (regCompanyCode) regCompanyCode.focus();
                return;
            }

            if (password.length < 6) {
                showAlert(regErrorAlert, 'Password must be at least 6 characters long.');
                if (regPassword) regPassword.focus();
                return;
            }

            if (password !== confirmPassword) {
                showAlert(regErrorAlert, 'Passwords do not match. Please re-enter.');
                if (regConfirmPassword) regConfirmPassword.focus();
                return;
            }

            if (btnSubmitCompany) {
                btnSubmitCompany.disabled = true;
                btnSubmitCompany.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Provisioning Dedicated Enterprise Database...';
            }

            try {
                const response = await fetch('/api/v1/auth/register-company', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ companyName, companyCode, adminFullName, email, password })
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    if (data.token) {
                        localStorage.setItem('token', data.token);
                    }
                    if (data.company_code) {
                        localStorage.setItem('company_code', data.company_code);
                    }
                    showAlert(regSuccessAlert, `Company & Dedicated Database provisioned successfully! Redirecting to Dashboard...`, true);
                    setTimeout(() => {
                        window.location.href = '/admin-dashboard.html';
                    }, 1100);
                } else {
                    showAlert(regErrorAlert, data.message || 'Registration failed. Please check your details.');
                }
            } catch (err) {
                console.error('Registration error:', err);
                showAlert(regErrorAlert, 'A network or server error occurred. Please try again.');
            } finally {
                if (btnSubmitCompany) {
                    btnSubmitCompany.disabled = false;
                    btnSubmitCompany.innerHTML = '<i class="fa-solid fa-rocket"></i> Register &amp; Launch Dashboard';
                }
            }
        });
    }
});
