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
});
