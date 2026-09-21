document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const errorAlert = document.getElementById('error-alert');
    const successAlert = document.getElementById('success-alert');
    const forgotLink = document.getElementById('forgot-link');

    const showAlert = (alertEl, message, isSuccess = false) => {
        alertEl.textContent = message;
        alertEl.style.display = 'block';
        setTimeout(() => {
            alertEl.style.display = 'none';
        }, 6000);
    };

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            errorAlert.style.display = 'none';
            successAlert.style.display = 'none';

            const email = emailInput.value.trim();
            const password = passwordInput.value;

            try {
                const response = await fetch('/api/v1/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();

                if (response.ok && data.success) {
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
            }
        });
    }

    if (forgotLink) {
        forgotLink.addEventListener('click', async (e) => {
            e.preventDefault();
            errorAlert.style.display = 'none';
            successAlert.style.display = 'none';

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
            regModal.style.opacity = '1';
        });
    };

    const closeRegisterModal = () => {
        if (!regModal) return;
        regModal.style.opacity = '0';
        setTimeout(() => {
            regModal.style.display = 'none';
        }, 150);
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
                    .replace(/[^a-z0-9]/g, '-')
                    .replace(/-+/g, '-')
                    .replace(/^-|-$/g, '')
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
            const companyCode = regCompanyCode ? regCompanyCode.value.trim() : '';
            const adminFullName = regAdminName ? regAdminName.value.trim() : '';
            const email = regAdminEmail ? regAdminEmail.value.trim() : '';
            const password = regPassword ? regPassword.value : '';
            const confirmPassword = regConfirmPassword ? regConfirmPassword.value : '';

            if (!companyName || !companyCode || !adminFullName || !email || !password) {
                showAlert(regErrorAlert, 'Please fill in all required fields.');
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
                btnSubmitCompany.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Setting up Organization...';
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
                    showAlert(regSuccessAlert, 'Company registered successfully! Redirecting to Dashboard...', true);
                    setTimeout(() => {
                        window.location.href = '/admin-dashboard.html';
                    }, 900);
                } else {
                    showAlert(regErrorAlert, data.message || 'Registration failed. Please check your details.');
                }
            } catch (err) {
                console.error('Registration error:', err);
                showAlert(regErrorAlert, 'A network or server error occurred. Please try again.');
            } finally {
                if (btnSubmitCompany) {
                    btnSubmitCompany.disabled = false;
                    btnSubmitCompany.innerHTML = '<i class="fa-solid fa-rocket"></i> Register & Launch Dashboard';
                }
            }
        });
    }
});
