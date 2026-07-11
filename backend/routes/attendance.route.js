import express from 'express';
import { 
    getAttendanceLogs, 
    getPendingCorrections, 
    createManualCorrection, 
    approveCorrection, 
    rejectCorrection 
} from '../controller/attendance.controller.js';
import { protectRoute, isAdmin } from '../middleware/protectRoute.js';

const router = express.Router();

// Apply admin RBAC check globally on all attendance routes
router.use(protectRoute, isAdmin);

router.get("/", getAttendanceLogs);
router.get("/pending", getPendingCorrections);
router.post("/correction", createManualCorrection);
router.post("/approve/:id", approveCorrection);
router.post("/reject/:id", rejectCorrection);

export default router;
