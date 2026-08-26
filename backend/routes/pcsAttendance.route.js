import express from 'express';
import { 
    calculateAttendance,
    getMonthlySummary,
    getDailyAttendanceSheet,
    getGapAnalysis,
    importAttendancePunches
} from '../controller/pcsAttendance.controller.js';
import { protectRoute, isAdmin } from '../middleware/protectRoute.js';

const router = express.Router();

// Apply auth check globally
router.use(protectRoute);

router.post("/calculate", isAdmin, calculateAttendance);
router.get("/monthly-summary", getMonthlySummary);
router.get("/daily-sheet", getDailyAttendanceSheet);
router.get("/gap-analysis", isAdmin, getGapAnalysis);
router.post("/import", isAdmin, importAttendancePunches);

export default router;
