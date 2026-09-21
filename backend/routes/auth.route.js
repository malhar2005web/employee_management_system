import express from 'express';
import { authCheck, login, logout, forgotPassword, resetPassword, getMe, refresh, registerCompany, getCompanyInfo } from '../controller/auth.controller.js';
import { protectRoute } from '../middleware/protectRoute.js';

const router = express.Router();

router.post("/login", login);
router.post("/register-company", registerCompany);
router.get("/company-info/:code", getCompanyInfo);
router.post("/logout", logout);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/refresh", refresh);
router.get("/authCheck", protectRoute, authCheck);
router.get("/me", protectRoute, getMe);

export default router;
