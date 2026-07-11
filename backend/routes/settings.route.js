import express from 'express';
import { getSettings, updateSettings } from '../controller/settings.controller.js';
import { protectRoute, isAdmin } from '../middleware/protectRoute.js';

const router = express.Router();

// Apply admin RBAC check globally on all settings routes
router.use(protectRoute, isAdmin);

router.get("/", getSettings);
router.put("/", updateSettings);

export default router;
