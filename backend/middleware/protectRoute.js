import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';
import { ENV_VARS } from '../config/envVars.js';

export const protectRoute = async (req, res, next) => {
    try {
        let token = req.cookies["jwt-moma"];
        if (!token && req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
            token = req.headers.authorization.split(" ")[1];
        }

        if (!token) {
            return res.status(401).json({ success: false, message: "Unauthorized - no token provided" });
        }

        const decoded = jwt.verify(token, ENV_VARS.JWT_SECRET);
        if (!decoded) {
            return res.status(401).json({ success: false, message: "Unauthorized - invalid token" });
        }

        const userQuery = await pool.query(
            `SELECT u.id, u.username, u.email, u.role, u.is_active, 
                    e.id AS employee_id, e.full_name, e.employee_code, 
                    e.department_id, e.designation_id, e.reporting_manager_id, e.shift_id
             FROM users u
             LEFT JOIN employees e ON u.id = e.user_id
             WHERE u.id = $1`,
            [decoded.userId]
        );

        if (userQuery.rows.length === 0) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const user = userQuery.rows[0];
        if (!user.is_active) {
            return res.status(403).json({ success: false, message: "User account is suspended" });
        }

        req.user = user;
        next();
    } catch (error) {
        console.log("Error in protectRoute middleware:", error.message);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

export const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'Admin') {
        next();
    } else {
        return res.status(403).json({ success: false, message: "Forbidden - Admin access required" });
    }
};

export const isEmployee = (req, res, next) => {
    if (req.user && req.user.role === 'Employee') {
        next();
    } else {
        return res.status(403).json({ success: false, message: "Forbidden - Employee access required" });
    }
};

export const isEmployeeOrAdmin = (req, res, next) => {
    if (req.user && (req.user.role === 'Employee' || req.user.role === 'Admin')) {
        next();
    } else {
        return res.status(403).json({ success: false, message: "Forbidden - Employee or Admin access required" });
    }
};
