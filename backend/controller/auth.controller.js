import { pool } from '../config/db.js';
import bcryptjs from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { generateTokenAndSetCookie } from '../utils/generate.Token.js';
import { ENV_VARS } from '../config/envVars.js';

export async function login(req, res) {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, message: "All fields are required" });
        }

        const userQuery = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (userQuery.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Invalid credentials" });
        }

        const user = userQuery.rows[0];
        const isPasswordCorrect = await bcryptjs.compare(password, user.password);
        if (!isPasswordCorrect) {
            return res.status(400).json({ success: false, message: "Invalid credentials" });
        }

        if (!user.is_active) {
            return res.status(403).json({ success: false, message: "User account is suspended" });
        }

        const token = generateTokenAndSetCookie(user.id, res);

        const client = req.headers['x-ems-client'];
        const platform = req.headers['x-ems-platform'];

        if (user.role === 'Employee' && (client === 'Mobile' || platform === 'Android' || platform === 'iOS')) {
            return res.status(403).json({
                success: false,
                message: "Desktop Required\nEmployee accounts are restricted to desktop access for secure attendance monitoring and work tracking. Please login using your office laptop."
            });
        }

        res.status(200).json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                is_active: user.is_active
            }
        });
    } catch (error) {
        console.log("Error in login", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function logout(req, res) {
    try {
        res.clearCookie("jwt-moma");
        res.status(200).json({ success: true, message: "Logged out successfully" });
    } catch (error) {
        console.log("Error in logout", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function authCheck(req, res) {
    try {
        res.status(200).json({ success: true, user: req.user });
    } catch (error) {
        console.log("Error in authCheck controller", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function getMe(req, res) {
    try {
        const userId = req.user.id;
        const result = await pool.query(
            `SELECT u.id, u.username, u.email, u.role,
                    e.id AS employee_id, e.full_name, e.employee_code,
                    e.skills,
                    mgr.full_name AS manager_name,
                    mgr.employee_code AS manager_code,
                    e.phone, e.whatsapp_no, e.anydesk_id, COALESCE(NULLIF(e.profile_picture, ''), NULLIF(u.profile_picture, '')) AS profile_picture,
                    e.dob, e.joining_date, e.citizenship, e.address,
                    e.emergency_name, e.emergency_relationship, e.emergency_phone,
                    e.degree, e.linkedin, e.gender, e.salary_grade,
                    e.edu_10th_school, e.edu_10th_marks,
                    e.edu_12th_college, e.edu_12th_marks,
                    e.edu_grad_college, e.edu_grad_cgpa,
                    e.certifications,
                    e.perm_address, e.bank_name, e.bank_acc_no, e.bank_ifsc,
                    e.doc_cv, e.doc_offer_letter, e.doc_adhar_card, e.doc_pan_card,
                    d.name AS department_name,
                    des.title AS designation_name
             FROM users u
             LEFT JOIN employees e ON u.id = e.user_id
             LEFT JOIN employees mgr ON e.reporting_manager_id = mgr.id
             LEFT JOIN departments d ON e.department_id = d.id
             LEFT JOIN designations des ON e.designation_id = des.id
             WHERE u.id = $1`,
            [userId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        res.status(200).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.log("Error in getMe", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function forgotPassword(req, res) {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, message: "Email is required" });
        }

        const userQuery = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (userQuery.rows.length === 0) {
            return res.status(404).json({ success: false, message: "User with this email does not exist" });
        }

        const token = crypto.randomBytes(20).toString('hex');
        const expiresAt = new Date(Date.now() + 3600000); // 1 hour expiration

        // Clean up old resets for this email
        await pool.query("DELETE FROM password_resets WHERE email = $1", [email]);

        // Insert new reset token
        await pool.query(
            "INSERT INTO password_resets (email, token, expires_at) VALUES ($1, $2, $3)",
            [email, token, expiresAt]
        );

        console.log(`[PASSWORD RESET MOCK EMAIL] To: ${email} | Token: ${token}`);

        res.status(200).json({
            success: true,
            message: "Password reset link sent to your email (mocked in server console)"
        });
    } catch (error) {
        console.log("Error in forgotPassword", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function resetPassword(req, res) {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword) {
            return res.status(400).json({ success: false, message: "Token and new password are required" });
        }

        const resetQuery = await pool.query(
            "SELECT * FROM password_resets WHERE token = $1 AND expires_at > NOW()",
            [token]
        );

        if (resetQuery.rows.length === 0) {
            return res.status(400).json({ success: false, message: "Invalid or expired token" });
        }

        const email = resetQuery.rows[0].email;
        const salt = await bcryptjs.genSalt(10);
        const hashedPassword = await bcryptjs.hash(newPassword, salt);

        await pool.query("UPDATE users SET password = $1 WHERE email = $2", [hashedPassword, email]);
        await pool.query("DELETE FROM password_resets WHERE email = $1", [email]);

        res.status(200).json({ success: true, message: "Password reset successfully" });
    } catch (error) {
        console.log("Error in resetPassword", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function refresh(req, res) {
    try {
        let token = req.cookies["jwt-moma"];
        if (!token && req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
            token = req.headers.authorization.split(" ")[1];
        }

        if (!token) {
            return res.status(401).json({ success: false, message: "No token provided" });
        }

        const decoded = jwt.verify(token, ENV_VARS.JWT_SECRET, { ignoreExpiration: true });
        const userQuery = await pool.query("SELECT id, role, is_active FROM users WHERE id = $1", [decoded.userId]);
        if (userQuery.rows.length === 0) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const user = userQuery.rows[0];
        if (!user.is_active) {
            return res.status(403).json({ success: false, message: "User account suspended" });
        }

        const newToken = generateTokenAndSetCookie(user.id, res);
        res.status(200).json({ success: true, token: newToken });
    } catch (error) {
        console.log("Error in refresh", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}
