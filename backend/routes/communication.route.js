import express from 'express';
import { getAnnouncements, broadcastNotice, getInboxAlerts, syncMailboxNow } from '../controller/communication.controller.js';
import { protectRoute, isEmployeeOrAdmin } from '../middleware/protectRoute.js';

const router = express.Router();

// Apply RBAC check globally on all communication routes (Admins and Employees)
router.use(protectRoute, isEmployeeOrAdmin);

router.get("/", getAnnouncements);
router.post("/", broadcastNotice);
router.get("/inbox", getInboxAlerts);
router.post("/sync-mailbox", syncMailboxNow);

export default router;
