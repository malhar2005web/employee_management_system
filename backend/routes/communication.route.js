import express from 'express';
import { getAnnouncements, broadcastNotice } from '../controller/communication.controller.js';
import { protectRoute, isAdmin } from '../middleware/protectRoute.js';

const router = express.Router();

// Apply admin RBAC check globally on all communication routes
router.use(protectRoute, isAdmin);

router.get("/", getAnnouncements);
router.post("/", broadcastNotice);

export default router;
