// admin-profile.js — Load profile details, handle tab switches and qualifications/skills pills/certifications updates for admin

(async function () {
    // --- Logout ---
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' });
            window.location.href = '/login.html';
        });
    }

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
    const subTabsEl = document.getElementById('profile-sub-tabs');
    if (subTabsEl) {
        subTabsEl.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-tab]');
            if (!btn) return;

            // Toggle Active tab button
            document.querySelectorAll('#profile-sub-tabs button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Toggle Active panel
            const tabName = btn.dataset.tab;
            document.querySelectorAll('.tab-panel').forEach(p => p.style.display = 'none');
            const targetPanel = document.getElementById(`panel-${tabName}`);
            if (targetPanel) targetPanel.style.display = 'block';
        });
    }

    // --- Skills Pills Render & Manager ---
    function renderSkills() {
        const container = document.getElementById('skills-pills-container');
        if (!container) return;
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

    const addSkillBtn = document.getElementById('btn-add-skill');
    if (addSkillBtn) {
        addSkillBtn.addEventListener('click', () => {
            const input = document.getElementById('input-new-skill');
            const val = input.value.trim();
            if (val && !skillsList.includes(val)) {
                skillsList.push(val);
                renderSkills();
                input.value = '';
            }
        });
    }

    const newSkillInput = document.getElementById('input-new-skill');
    if (newSkillInput) {
        newSkillInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const addSkillBtn = document.getElementById('btn-add-skill');
                if (addSkillBtn) addSkillBtn.click();
            }
        });
    }

    // --- Certifications Render & Manager ---
    function renderCertifications() {
        const container = document.getElementById('certifications-list-container');
        if (!container) return;
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

    const certFileInput = document.getElementById('cert-file-input');
    if (certFileInput) {
        certFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                selectedFile = file;
                const filenameEl = document.getElementById('uploaded-filename');
                if (filenameEl) filenameEl.textContent = file.name;
            }
        });
    }

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
                    const filenameEl = document.getElementById(filenameId);
                    if (filenameEl) filenameEl.textContent = file.name;
                    const link = document.getElementById(linkId);
                    if (link) {
                        link.href = reader.result;
                        link.style.display = 'inline-flex';
                    }
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

    const addCertBtn = document.getElementById('btn-add-certification');
    if (addCertBtn) {
        addCertBtn.addEventListener('click', () => {
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
                    nameInput.value = '';
                    selectedFile = null;
                    const filenameEl = document.getElementById('uploaded-filename');
                    if (filenameEl) filenameEl.textContent = 'No file chosen';
                    const fileInputEl = document.getElementById('cert-file-input');
                    if (fileInputEl) fileInputEl.value = '';
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
    }

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
            const profileNameEl = document.getElementById('profile-name');
            if (profileNameEl) {
                profileNameEl.textContent = me.full_name || me.username || 'Admin';
            }

            // Initials Avatar
            const hdrAvatarText = document.getElementById('hdr-avatar-text');
            const hdrAvatarImg = document.getElementById('hdr-avatar-img');
            const savedPic = localStorage.getItem('admin_profile_pic') || localStorage.getItem('user_profile_pic') || (me && me.profile_picture && !me.profile_picture.includes('pravatar.cc') ? me.profile_picture : null);

            if (savedPic) {
                if (hdrAvatarImg) {
                    hdrAvatarImg.src = savedPic;
                    hdrAvatarImg.style.display = 'block';
                }
                if (hdrAvatarText) hdrAvatarText.style.display = 'none';
                localStorage.setItem('admin_profile_pic', savedPic);
                localStorage.setItem('user_profile_pic', savedPic);
                if (typeof window.syncAllTopbarAvatars === 'function') window.syncAllTopbarAvatars();
            } else if (hdrAvatarText) {
                if (me.full_name) {
                    const parts = me.full_name.split(' ');
                    const initials = parts.map(p => p.charAt(0)).join('').substring(0, 2).toUpperCase();
                    hdrAvatarText.textContent = initials;
                } else {
                    hdrAvatarText.textContent = 'CA';
                }
            }

            // Set Header Information
            const fullnameEl = document.getElementById('hdr-fullname');
            if (fullnameEl) fullnameEl.textContent = me.full_name || 'Admin User';
            const desigEl = document.getElementById('hdr-designation');
            if (desigEl) desigEl.textContent = me.designation_name || 'Administrator';
            const deptEl = document.getElementById('hdr-department');
            if (deptEl) deptEl.textContent = me.department_name || 'Management';
            const teamEl = document.getElementById('hdr-team');
            if (teamEl) teamEl.textContent = (me.department_name || 'Management') + ' Team';
            
            const joinDate = me.joining_date ? new Date(me.joining_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
            const joiningDateEl = document.getElementById('hdr-joining-date');
            if (joiningDateEl) joiningDateEl.textContent = joinDate;
            const managerEl = document.getElementById('hdr-manager');
            if (managerEl) managerEl.textContent = me.manager_name || 'None (System)';

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
            const pubPrefName = document.getElementById('pub-pref-name');
            if (pubPrefName) pubPrefName.textContent = me.full_name || '';
            const pubFirstName = document.getElementById('pub-first-name');
            if (pubFirstName) pubFirstName.textContent = me.full_name ? me.full_name.split(' ')[0] : '';
            const pubLastName = document.getElementById('pub-last-name');
            if (pubLastName) pubLastName.textContent = me.full_name ? me.full_name.split(' ').slice(1).join(' ') : '';
            const pubDept = document.getElementById('pub-department');
            if (pubDept) pubDept.textContent = me.department_name || 'Not Assigned';
            const pubSupervisor = document.getElementById('pub-supervisor');
            if (pubSupervisor) pubSupervisor.textContent = me.manager_name || 'None (System)';
            const pubEmail = document.getElementById('pub-email');
            if (pubEmail) pubEmail.textContent = me.email || '';
            const pubLinkedin = document.getElementById('pub-linkedin');
            if (pubLinkedin) pubLinkedin.value = me.linkedin || 'https://linkedin.com/in/';
            const pubJobName = document.getElementById('pub-job-name');
            if (pubJobName) pubJobName.textContent = me.designation_name || 'Not Assigned';
            const pubGender = document.getElementById('pub-gender');
            if (pubGender) pubGender.textContent = me.gender || 'Male';

            // Sub-Tab 2: HR Information
            const hrCode = document.getElementById('hr-code');
            if (hrCode) hrCode.textContent = me.employee_code || '';
            const hrSalaryGrade = document.getElementById('hr-salary-grade');
            if (hrSalaryGrade) hrSalaryGrade.textContent = me.salary_grade || 'Grade 1';
            const hrJoiningDate = document.getElementById('hr-joining-date');
            if (hrJoiningDate) hrJoiningDate.textContent = joinDate;

            // Sub-Tab 3: Personal Data
            const persDob = document.getElementById('pers-dob');
            if (persDob) persDob.value = dobFormatted;
            const persPhone = document.getElementById('pers-phone');
            if (persPhone) persPhone.value = me.phone || '';
            const persWhatsapp = document.getElementById('pers-whatsapp-no');
            if (persWhatsapp) persWhatsapp.value = me.whatsapp_no || '';
            const persAnydesk = document.getElementById('pers-anydesk-id');
            if (persAnydesk) persAnydesk.value = me.anydesk_id || '';
            const persCitizenship = document.getElementById('pers-citizenship');
            if (persCitizenship) persCitizenship.value = me.citizenship || 'Indian';
            const persAddress = document.getElementById('pers-address');
            if (persAddress) persAddress.value = me.address || '';
            const persPermAddress = document.getElementById('pers-perm-address');
            if (persPermAddress) persPermAddress.value = me.perm_address || '';
            const persBankName = document.getElementById('pers-bank-name');
            if (persBankName) persBankName.value = me.bank_name || '';
            const persBankAccNo = document.getElementById('pers-bank-acc-no');
            if (persBankAccNo) persBankAccNo.value = me.bank_acc_no || '';
            const persBankIfsc = document.getElementById('pers-bank-ifsc');
            if (persBankIfsc) persBankIfsc.value = me.bank_ifsc || '';

            // Handle documents
            if (me.doc_cv && me.doc_cv.fileName) {
                docCv = me.doc_cv;
                const cvFn = document.getElementById('cv-filename');
                if (cvFn) cvFn.textContent = me.doc_cv.fileName;
                const link = document.getElementById('cv-download-link');
                if (link) {
                    link.href = me.doc_cv.fileData;
                    link.style.display = 'inline-flex';
                }
            } else {
                docCv = null;
                const cvFn = document.getElementById('cv-filename');
                if (cvFn) cvFn.textContent = 'No file uploaded';
                const link = document.getElementById('cv-download-link');
                if (link) link.style.display = 'none';
            }

            if (me.doc_offer_letter && me.doc_offer_letter.fileName) {
                docOffer = me.doc_offer_letter;
                const offerFn = document.getElementById('offer-filename');
                if (offerFn) offerFn.textContent = me.doc_offer_letter.fileName;
                const link = document.getElementById('offer-download-link');
                if (link) {
                    link.href = me.doc_offer_letter.fileData;
                    link.style.display = 'inline-flex';
                }
            } else {
                docOffer = null;
                const offerFn = document.getElementById('offer-filename');
                if (offerFn) offerFn.textContent = 'No file uploaded';
                const link = document.getElementById('offer-download-link');
                if (link) link.style.display = 'none';
            }

            if (me.doc_adhar_card && me.doc_adhar_card.fileName) {
                docAdhar = me.doc_adhar_card;
                const adharFn = document.getElementById('adhar-filename');
                if (adharFn) adharFn.textContent = me.doc_adhar_card.fileName;
                const link = document.getElementById('adhar-download-link');
                if (link) {
                    link.href = me.doc_adhar_card.fileData;
                    link.style.display = 'inline-flex';
                }
            } else {
                docAdhar = null;
                const adharFn = document.getElementById('adhar-filename');
                if (adharFn) adharFn.textContent = 'No file uploaded';
                const link = document.getElementById('adhar-download-link');
                if (link) link.style.display = 'none';
            }

            if (me.doc_pan_card && me.doc_pan_card.fileName) {
                docPan = me.doc_pan_card;
                const panFn = document.getElementById('pan-filename');
                if (panFn) panFn.textContent = me.doc_pan_card.fileName;
                const link = document.getElementById('pan-download-link');
                if (link) {
                    link.href = me.doc_pan_card.fileData;
                    link.style.display = 'inline-flex';
                }
            } else {
                docPan = null;
                const panFn = document.getElementById('pan-filename');
                if (panFn) panFn.textContent = 'No file uploaded';
                const link = document.getElementById('pan-download-link');
                if (link) link.style.display = 'none';
            }

            // Sub-Tab 4: Emergency Contact
            const emgName = document.getElementById('emg-name');
            if (emgName) emgName.value = me.emergency_name || '';
            const emgRelationship = document.getElementById('emg-relationship');
            if (emgRelationship) emgRelationship.value = me.emergency_relationship || '';
            const emgPhone = document.getElementById('emg-phone');
            if (emgPhone) emgPhone.value = me.emergency_phone || '';

            // Sub-Tab 5: Qualifications & Skills
            const gradCollege = document.getElementById('edu-grad-college');
            if (gradCollege) gradCollege.value = me.edu_grad_college || '';
            const gradCgpa = document.getElementById('edu-grad-cgpa');
            if (gradCgpa) gradCgpa.value = me.edu_grad_cgpa || '';
            const college12th = document.getElementById('edu-12th-college');
            if (college12th) college12th.value = me.edu_12th_college || '';
            const marks12th = document.getElementById('edu-12th-marks');
            if (marks12th) marks12th.value = me.edu_12th_marks || '';
            const school10th = document.getElementById('edu-10th-school');
            if (school10th) school10th.value = me.edu_10th_school || '';
            const marks10th = document.getElementById('edu-10th-marks');
            if (marks10th) marks10th.value = me.edu_10th_marks || '';

        } catch (e) {
            console.error(e);
        }
    }

    // --- General Save Profile Data Helper ---
    async function saveProfileData(fields) {
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

    // Save Public Profile (LinkedIn)
    const savePublicBtn = document.getElementById('btn-save-public');
    if (savePublicBtn) {
        savePublicBtn.addEventListener('click', () => {
            const linkedin = document.getElementById('pub-linkedin').value.trim();
            saveProfileData({ linkedin });
        });
    }

    // Save Personal Data
    const savePersonalBtn = document.getElementById('btn-save-personal');
    if (savePersonalBtn) {
        savePersonalBtn.addEventListener('click', () => {
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
    }

    // Save Emergency Contact
    const saveEmergencyBtn = document.getElementById('btn-save-emergency');
    if (saveEmergencyBtn) {
        saveEmergencyBtn.addEventListener('click', () => {
            const emergency_name = document.getElementById('emg-name').value.trim();
            const emergency_relationship = document.getElementById('emg-relationship').value.trim();
            const emergency_phone = document.getElementById('emg-phone').value.trim();
            saveProfileData({ emergency_name, emergency_relationship, emergency_phone });
        });
    }

    // Save Qualifications, Skills & Certifications
    const saveQualificationsBtn = document.getElementById('btn-save-qualifications');
    if (saveQualificationsBtn) {
        saveQualificationsBtn.addEventListener('click', () => {
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
    }

    // --- Change Password ---
    const changePasswordBtn = document.getElementById('btn-change-password');
    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', async () => {
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
    }

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
        localStorage.setItem('admin_profile_pic', dataUrl);
        localStorage.setItem('user_profile_pic', dataUrl);
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
                    // Compress image to ~30KB (360x360 max) to ensure fast load & avoid localStorage quota limits
                    const dataUrl = await compressAvatarImage(file, 360, 0.85);
                    applyAvatarImage(dataUrl);

                    try {
                        localStorage.setItem('admin_profile_pic', dataUrl);
                        localStorage.setItem('user_profile_pic', dataUrl);
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

                    const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
                    resolve(compressedDataUrl);
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // Restore saved profile picture on load
    const savedPic = localStorage.getItem('admin_profile_pic');
    if (savedPic) {
        applyAvatarImage(savedPic);
    }

    await loadProfile();
})();
