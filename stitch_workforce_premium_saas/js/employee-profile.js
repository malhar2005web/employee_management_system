// employee-profile.js — Load profile details, handle tab switches and qualifications/skills pills/certifications updates

(async function () {
    // --- Logout ---
    document.getElementById('logout-btn').addEventListener('click', async () => {
        await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' });
        window.location.href = '/login.html';
    });

    let currentProfileData = null;
    let skillsList = [];
    let certificationsList = [];
    let selectedFile = null;

    function showToast(msg, type = 'success') {
        const t = document.createElement('div');
        const bg = type === 'success' ? '#23b899' : '#e05252';
        t.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:9999;padding:12px 20px;border-radius:10px;font-weight:700;font-size:13.5px;color:#fff;background:${bg};box-shadow:0 4px 20px rgba(0,0,0,0.15);transition:opacity 0.4s;`;
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, 3000);
    }

    // --- Tab Switching Logic (Sub-Tabs) ---
    document.getElementById('profile-sub-tabs').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-tab]');
        if (!btn) return;

        // Toggle Active tab button
        document.querySelectorAll('#profile-sub-tabs button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Toggle Active panel
        const tabName = btn.dataset.tab;
        document.querySelectorAll('.tab-panel').forEach(p => p.style.display = 'none');
        document.getElementById(`panel-${tabName}`).style.display = 'block';
    });

    // --- Skills Pills Render & Manager ---
    function renderSkills() {
        const container = document.getElementById('skills-pills-container');
        if (!skillsList || !skillsList.length) {
            container.innerHTML = '<div style="font-size:13px; color:var(--text-muted); padding:4px 0;">No skills added yet.</div>';
            return;
        }
        container.innerHTML = skillsList.map((s, idx) => `
            <span class="skill-pill">
                ${s} <i class="fa-solid fa-xmark remove-btn" onclick="removeSkill(${idx})"></i>
            </span>
        `).join('');
    }

    window.removeSkill = (idx) => {
        skillsList.splice(idx, 1);
        renderSkills();
    };

    document.getElementById('btn-add-skill').addEventListener('click', () => {
        const input = document.getElementById('input-new-skill');
        const val = input.value.trim();
        if (val && !skillsList.includes(val)) {
            skillsList.push(val);
            renderSkills();
            input.value = '';
        }
    });

    document.getElementById('input-new-skill').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('btn-add-skill').click();
        }
    });

    // --- Certifications Render & Manager ---
    function renderCertifications() {
        const container = document.getElementById('certifications-list-container');
        if (!certificationsList || !certificationsList.length) {
            container.innerHTML = '<div style="font-size:13px; color:var(--text-muted); padding:4px 0;">No certifications added yet.</div>';
            return;
        }
        container.innerHTML = certificationsList.map((c, idx) => `
            <div class="cert-row">
                <div>
                    <strong style="color: var(--teal-900); font-size:13.5px;"><i class="fa-solid fa-medal" style="color:var(--orange); margin-right:6px;"></i> ${c.name}</strong>
                    ${c.fileName ? `<div style="font-size:12px; color:var(--text-body); margin-top:4px;"><i class="fa-solid fa-paperclip"></i> ${c.fileName}</div>` : ''}
                </div>
                <button type="button" class="btn-primary" onclick="removeCert(${idx})" style="padding: 6px 12px; background: rgba(224, 83, 83, 0.15); border-color: rgba(224, 83, 83, 0.3); color: var(--red); font-size: 12px;"><i class="fa-solid fa-trash-can"></i> Delete</button>
            </div>
        `).join('');
    }

    window.removeCert = (idx) => {
        certificationsList.splice(idx, 1);
        renderCertifications();
    };

    document.getElementById('cert-file-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            selectedFile = file;
            document.getElementById('uploaded-filename').textContent = file.name;
        }
    });

    let docCv = null;
    let docOffer = null;
    let docAdhar = null;
    let docPan = null;

    function handleDocUpload(inputId, filenameId, linkId, onLoaded) {
        const inputEl = document.getElementById(inputId);
        if (!inputEl) return;
        inputEl.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = () => {
                    const docObj = {
                        fileName: file.name,
                        fileData: reader.result
                    };
                    document.getElementById(filenameId).textContent = file.name;
                    const link = document.getElementById(linkId);
                    link.href = reader.result;
                    link.style.display = 'inline-flex';
                    onLoaded(docObj);
                };
                reader.readAsDataURL(file);
            }
        });
    }

    handleDocUpload('pers-doc-cv', 'cv-filename', 'cv-download-link', (obj) => { docCv = obj; });
    handleDocUpload('pers-doc-offer', 'offer-filename', 'offer-download-link', (obj) => { docOffer = obj; });
    handleDocUpload('pers-doc-adhar', 'adhar-filename', 'adhar-download-link', (obj) => { docAdhar = obj; });
    handleDocUpload('pers-doc-pan', 'pan-filename', 'pan-download-link', (obj) => { docPan = obj; });

    document.getElementById('btn-add-certification').addEventListener('click', () => {
        const nameInput = document.getElementById('cert-name-input');
        const name = nameInput.value.trim();
        if (!name) {
            showToast("Please enter a certification name", "error");
            return;
        }

        if (selectedFile) {
            const reader = new FileReader();
            reader.onload = () => {
                certificationsList.push({
                    name,
                    fileName: selectedFile.name,
                    fileData: reader.result
                });
                renderCertifications();
                // Reset fields
                nameInput.value = '';
                selectedFile = null;
                document.getElementById('uploaded-filename').textContent = 'No file chosen';
                document.getElementById('cert-file-input').value = '';
            };
            reader.readAsDataURL(selectedFile);
        } else {
            certificationsList.push({
                name,
                fileName: '',
                fileData: ''
            });
            renderCertifications();
            nameInput.value = '';
        }
    });

    // --- Load Profile ---
    async function loadProfile() {
        try {
            const res = await fetch('/api/v1/auth/me', { credentials: 'include' });
            const data = await res.json();
            if (!data.success || !data.data) {
                showToast("Failed to load profile", "error");
                return;
            }

            const me = data.data;
            currentProfileData = me;

            // Update topbar & sidebar name
            document.getElementById('profile-name').textContent = me.full_name || me.username || 'Employee';

            // Initials Avatar or Saved Profile Picture
            const hdrAvatarText = document.getElementById('hdr-avatar-text');
            const hdrAvatarImg = document.getElementById('hdr-avatar-img');
            const savedPic = localStorage.getItem('user_profile_pic') || localStorage.getItem('admin_profile_pic') || (me && me.profile_picture && !me.profile_picture.includes('pravatar.cc') ? me.profile_picture : null);
            if (savedPic) {
                localStorage.setItem('user_profile_pic', savedPic);
                if (hdrAvatarImg) {
                    hdrAvatarImg.src = savedPic;
                    hdrAvatarImg.style.display = 'block';
                }
                if (hdrAvatarText) hdrAvatarText.style.display = 'none';
                if (typeof window.syncAllTopbarAvatars === 'function') window.syncAllTopbarAvatars();
            } else {
                if (hdrAvatarImg) hdrAvatarImg.style.display = 'none';
                if (hdrAvatarText) {
                    hdrAvatarText.style.display = 'inline';
                    if (me.full_name) {
                        const parts = me.full_name.split(' ');
                        const initials = parts.map(p => p.charAt(0)).join('').substring(0, 2).toUpperCase();
                        hdrAvatarText.textContent = initials;
                    } else {
                        hdrAvatarText.textContent = 'EE';
                    }
                }
            }

            // Set Header Information
            document.getElementById('hdr-fullname').textContent = me.full_name || 'Sarah Jenkins';
            document.getElementById('hdr-designation').textContent = me.designation_name || 'Business Analyst';
            document.getElementById('hdr-department').textContent = me.department_name || 'Data';
            document.getElementById('hdr-team').textContent = (me.department_name || 'Data') + ' Team';
            
            const joinDate = me.joining_date ? new Date(me.joining_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
            document.getElementById('hdr-joining-date').textContent = joinDate;
            document.getElementById('hdr-manager').textContent = me.manager_name || 'Corporate Admin';

            // Set Skills & Certifications lists
            skillsList = Array.isArray(me.skills) ? me.skills : [];
            certificationsList = Array.isArray(me.certifications) ? me.certifications : [];
            renderSkills();
            renderCertifications();

            // Format date for input field (YYYY-MM-DD)
            let dobFormatted = '';
            if (me.dob) {
                dobFormatted = new Date(me.dob).toISOString().split('T')[0];
            }

            // Map data to the sub-sections
            
            // Sub-Tab 1: Public Profile
            document.getElementById('pub-pref-name').textContent = me.full_name || '';
            document.getElementById('pub-first-name').textContent = me.full_name ? me.full_name.split(' ')[0] : '';
            document.getElementById('pub-last-name').textContent = me.full_name ? me.full_name.split(' ').slice(1).join(' ') : '';
            document.getElementById('pub-department').textContent = me.department_name || 'Not Assigned';
            document.getElementById('pub-supervisor').textContent = me.manager_name || 'Corporate Admin';
            document.getElementById('pub-email').textContent = me.email || '';
            document.getElementById('pub-linkedin').value = me.linkedin || 'https://linkedin.com/in/';
            document.getElementById('pub-job-name').textContent = me.designation_name || 'Not Assigned';
            document.getElementById('pub-gender').textContent = me.gender || 'Female';

            // Sub-Tab 2: HR Information
            document.getElementById('hr-code').textContent = me.employee_code || '';
            document.getElementById('hr-salary-grade').textContent = me.salary_grade || 'Grade 1';
            document.getElementById('hr-joining-date').textContent = joinDate;

            // Sub-Tab 3: Personal Data
            document.getElementById('pers-dob').value = dobFormatted;
            document.getElementById('pers-phone').value = me.phone || '';
            document.getElementById('pers-whatsapp-no').value = me.whatsapp_no || '';
            document.getElementById('pers-anydesk-id').value = me.anydesk_id || '';
            document.getElementById('pers-citizenship').value = me.citizenship || 'Indian';
            document.getElementById('pers-address').value = me.address || '';
            document.getElementById('pers-perm-address').value = me.perm_address || '';
            document.getElementById('pers-bank-name').value = me.bank_name || '';
            document.getElementById('pers-bank-acc-no').value = me.bank_acc_no || '';
            document.getElementById('pers-bank-ifsc').value = me.bank_ifsc || '';

            // Handle documents
            if (me.doc_cv && me.doc_cv.fileName) {
                docCv = me.doc_cv;
                document.getElementById('cv-filename').textContent = me.doc_cv.fileName;
                const link = document.getElementById('cv-download-link');
                link.href = me.doc_cv.fileData;
                link.style.display = 'inline-flex';
            } else {
                docCv = null;
                document.getElementById('cv-filename').textContent = 'No file uploaded';
                document.getElementById('cv-download-link').style.display = 'none';
            }

            if (me.doc_offer_letter && me.doc_offer_letter.fileName) {
                docOffer = me.doc_offer_letter;
                document.getElementById('offer-filename').textContent = me.doc_offer_letter.fileName;
                const link = document.getElementById('offer-download-link');
                link.href = me.doc_offer_letter.fileData;
                link.style.display = 'inline-flex';
            } else {
                docOffer = null;
                document.getElementById('offer-filename').textContent = 'No file uploaded';
                document.getElementById('offer-download-link').style.display = 'none';
            }

            if (me.doc_adhar_card && me.doc_adhar_card.fileName) {
                docAdhar = me.doc_adhar_card;
                document.getElementById('adhar-filename').textContent = me.doc_adhar_card.fileName;
                const link = document.getElementById('adhar-download-link');
                link.href = me.doc_adhar_card.fileData;
                link.style.display = 'inline-flex';
            } else {
                docAdhar = null;
                document.getElementById('adhar-filename').textContent = 'No file uploaded';
                document.getElementById('adhar-download-link').style.display = 'none';
            }

            if (me.doc_pan_card && me.doc_pan_card.fileName) {
                docPan = me.doc_pan_card;
                document.getElementById('pan-filename').textContent = me.doc_pan_card.fileName;
                const link = document.getElementById('pan-download-link');
                link.href = me.doc_pan_card.fileData;
                link.style.display = 'inline-flex';
            } else {
                docPan = null;
                document.getElementById('pan-filename').textContent = 'No file uploaded';
                document.getElementById('pan-download-link').style.display = 'none';
            }

            // Sub-Tab 4: Emergency Contact
            document.getElementById('emg-name').value = me.emergency_name || '';
            document.getElementById('emg-relationship').value = me.emergency_relationship || '';
            document.getElementById('emg-phone').value = me.emergency_phone || '';

            // Sub-Tab 5: Qualifications & Skills
            document.getElementById('edu-grad-college').value = me.edu_grad_college || '';
            document.getElementById('edu-grad-cgpa').value = me.edu_grad_cgpa || '';
            document.getElementById('edu-12th-college').value = me.edu_12th_college || '';
            document.getElementById('edu-12th-marks').value = me.edu_12th_marks || '';
            document.getElementById('edu-10th-school').value = me.edu_10th_school || '';
            document.getElementById('edu-10th-marks').value = me.edu_10th_marks || '';

        } catch (e) {
            console.error(e);
        }
    }

    // --- General Save Profile Data Helper ---
    async function saveProfileData(fields) {
        // Merge with current state to avoid wiping out other fields
        const payload = {
            linkedin: currentProfileData.linkedin,
            phone: currentProfileData.phone,
            whatsapp_no: currentProfileData.whatsapp_no,
            anydesk_id: currentProfileData.anydesk_id,
            dob: currentProfileData.dob,
            citizenship: currentProfileData.citizenship,
            address: currentProfileData.address,
            perm_address: currentProfileData.perm_address,
            bank_name: currentProfileData.bank_name,
            bank_acc_no: currentProfileData.bank_acc_no,
            bank_ifsc: currentProfileData.bank_ifsc,
            doc_cv: docCv,
            doc_offer_letter: docOffer,
            doc_adhar_card: docAdhar,
            doc_pan_card: docPan,
            emergency_name: currentProfileData.emergency_name,
            emergency_relationship: currentProfileData.emergency_relationship,
            emergency_phone: currentProfileData.emergency_phone,
            degree: currentProfileData.degree,
            skills: skillsList,
            certifications: certificationsList,
            edu_10th_school: currentProfileData.edu_10th_school,
            edu_10th_marks: currentProfileData.edu_10th_marks,
            edu_12th_college: currentProfileData.edu_12th_college,
            edu_12th_marks: currentProfileData.edu_12th_marks,
            edu_grad_college: currentProfileData.edu_grad_college,
            edu_grad_cgpa: currentProfileData.edu_grad_cgpa,
            ...fields
        };

        try {
            const res = await fetch('/api/v1/employee/profile', {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                showToast("Profile updated successfully!", "success");
                await loadProfile();
            } else {
                showToast(data.message || "Failed to save profile details", "error");
            }
        } catch (e) {
            showToast("Network error", "error");
        }
    }

    // Bind save triggers to each sub-panel button
    
    // Save Public Profile (LinkedIn)
    document.getElementById('btn-save-public').addEventListener('click', () => {
        const linkedin = document.getElementById('pub-linkedin').value.trim();
        saveProfileData({ linkedin });
    });

    // Save Personal Data
    document.getElementById('btn-save-personal').addEventListener('click', () => {
        const dob = document.getElementById('pers-dob').value;
        const phone = document.getElementById('pers-phone').value.trim();
        const whatsapp_no = document.getElementById('pers-whatsapp-no').value.trim();
        const anydesk_id = document.getElementById('pers-anydesk-id').value.trim();
        const citizenship = document.getElementById('pers-citizenship').value.trim();
        const address = document.getElementById('pers-address').value.trim();
        const perm_address = document.getElementById('pers-perm-address').value.trim();
        const bank_name = document.getElementById('pers-bank-name').value.trim();
        const bank_acc_no = document.getElementById('pers-bank-acc-no').value.trim();
        const bank_ifsc = document.getElementById('pers-bank-ifsc').value.trim();
        
        saveProfileData({ 
            dob, 
            phone, 
            whatsapp_no,
            anydesk_id,
            citizenship, 
            address, 
            perm_address, 
            bank_name, 
            bank_acc_no, 
            bank_ifsc,
            doc_cv: docCv,
            doc_offer_letter: docOffer,
            doc_adhar_card: docAdhar,
            doc_pan_card: docPan
        });
    });

    // Save Emergency Contact
    document.getElementById('btn-save-emergency').addEventListener('click', () => {
        const emergency_name = document.getElementById('emg-name').value.trim();
        const emergency_relationship = document.getElementById('emg-relationship').value.trim();
        const emergency_phone = document.getElementById('emg-phone').value.trim();
        saveProfileData({ emergency_name, emergency_relationship, emergency_phone });
    });

    // Save Qualifications, Skills & Certifications
    document.getElementById('btn-save-qualifications').addEventListener('click', () => {
        const edu_grad_college = document.getElementById('edu-grad-college').value.trim();
        const edu_grad_cgpa = document.getElementById('edu-grad-cgpa').value.trim();
        const edu_12th_college = document.getElementById('edu-12th-college').value.trim();
        const edu_12th_marks = document.getElementById('edu-12th-marks').value.trim();
        const edu_10th_school = document.getElementById('edu-10th-school').value.trim();
        const edu_10th_marks = document.getElementById('edu-10th-marks').value.trim();
        
        saveProfileData({
            edu_grad_college,
            edu_grad_cgpa,
            edu_12th_college,
            edu_12th_marks,
            edu_10th_school,
            edu_10th_marks,
            skills: skillsList,
            certifications: certificationsList
        });
    });

    // --- Change Password ---
    document.getElementById('btn-change-password').addEventListener('click', async () => {
        const currentPassword = document.getElementById('pass-current').value;
        const newPassword = document.getElementById('pass-new').value;
        const confirmPassword = document.getElementById('pass-confirm').value;

        if (!currentPassword || !newPassword || !confirmPassword) {
            showToast("Please fill all password fields", "error");
            return;
        }

        if (newPassword.length < 6) {
            showToast("Password must be at least 6 characters long", "error");
            return;
        }

        if (newPassword !== confirmPassword) {
            showToast("New passwords do not match", "error");
            return;
        }

        try {
            const res = await fetch('/api/v1/employee/change-password', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword })
            });
            const data = await res.json();
            if (data.success) {
                showToast("Password updated successfully!", "success");
                document.getElementById('pass-current').value = '';
                document.getElementById('pass-new').value = '';
                document.getElementById('pass-confirm').value = '';
            } else {
                showToast(data.message || "Failed to update password", "error");
            }
        } catch (e) {
            showToast("Network error", "error");
        }
    });

    // --- Profile Picture Edit & Upload System ---
    const avatarTrigger = document.getElementById('btn-avatar-upload-trigger');
    const avatarPencil = document.getElementById('btn-avatar-pencil');
    const picInput = document.getElementById('profile-pic-input');
    const hdrAvatarText = document.getElementById('hdr-avatar-text');
    const hdrAvatarImg = document.getElementById('hdr-avatar-img');

    function applyAvatarImage(dataUrl) {
        if (hdrAvatarImg) {
            hdrAvatarImg.src = dataUrl;
            hdrAvatarImg.style.display = 'block';
        }
        if (hdrAvatarText) hdrAvatarText.style.display = 'none';
        localStorage.setItem('user_profile_pic', dataUrl);
        localStorage.setItem('admin_profile_pic', dataUrl);
        if (typeof window.syncAllTopbarAvatars === 'function') {
            window.syncAllTopbarAvatars();
        } else {
            document.querySelectorAll('.topbar-user img').forEach(img => {
                img.src = dataUrl;
            });
        }
    }

    if (picInput) {
        if (avatarTrigger) {
            avatarTrigger.addEventListener('click', (e) => {
                if (e.target !== avatarPencil && !avatarPencil.contains(e.target)) {
                    picInput.click();
                }
            });
        }
        if (avatarPencil) {
            avatarPencil.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                picInput.click();
            });
        }

        const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB limit
        picInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                if (!file.type.startsWith('image/')) {
                    showToast('Please select a valid image file (PNG, JPG, WebP)', 'error');
                    return;
                }
                if (file.size > MAX_FILE_SIZE) {
                    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
                    showToast(`Image size is too large (${sizeMB}MB). Maximum allowed limit is 5MB.`, 'error');
                    picInput.value = '';
                    return;
                }
                try {
                    const dataUrl = await compressAvatarImage(file, 360, 0.85);
                    applyAvatarImage(dataUrl);

                    try {
                        localStorage.setItem('user_profile_pic', dataUrl);
                        localStorage.setItem('admin_profile_pic', dataUrl);
                    } catch(quotaErr) {
                        console.warn("LocalStorage save warning:", quotaErr);
                    }

                    try {
                        await fetch('/api/v1/employee/profile', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({ profile_picture: dataUrl })
                        });
                    } catch(err) {
                        console.error("DB Profile pic save error:", err);
                    }
                    showToast('Profile picture updated & synced successfully!');
                } catch(compressErr) {
                    console.error("Compression error:", compressErr);
                    showToast('Error processing image file', 'error');
                }
            }
        });
    }

    function compressAvatarImage(file, maxWidth = 360, quality = 0.85) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    if (width > maxWidth || height > maxWidth) {
                        if (width > height) {
                            height = Math.round((height * maxWidth) / width);
                            width = maxWidth;
                        } else {
                            width = Math.round((width * maxWidth) / height);
                            height = maxWidth;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', quality));
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    await loadProfile();
})();
