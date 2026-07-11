import express from 'express';
import { getActionAudits, getLoginLogs } from '../controller/audit.controller.js';
import { protectRoute, isAdmin } from '../middleware/protectRoute.js';

const router = express.Router();

// Apply admin RBAC check globally on all audit routes
router.use(protectRoute, isAdmin);

router.get("/actions", getActionAudits);
router.get("/logins", getLoginLogs);

export default router;
