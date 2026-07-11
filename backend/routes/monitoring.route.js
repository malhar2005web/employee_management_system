import express from 'express';
import { 
    getMonitoringLogs, 
    getActivityLogs, 
    categorizeProductivity 
} from '../controller/monitoring.controller.js';
import { protectRoute, isAdmin } from '../middleware/protectRoute.js';

const router = express.Router();

// Apply admin RBAC check globally on all monitoring routes
router.use(protectRoute, isAdmin);

router.get("/logs", getMonitoringLogs);
router.get("/activities", getActivityLogs);
router.post("/categorize", categorizeProductivity);

export default router;
