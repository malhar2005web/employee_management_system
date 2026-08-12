import express from 'express';
import { 
    getSelfReports, 
    getFieldVisits, 
    generateCustomReport,
    exportModuleCSV 
} from '../controller/report.controller.js';
import { protectRoute, isAdmin } from '../middleware/protectRoute.js';

const router = express.Router();

// Apply admin RBAC check globally on all reports routes
router.use(protectRoute, isAdmin);

router.get("/self-reports", getSelfReports);
router.get("/dsr", getFieldVisits);
router.get("/custom", generateCustomReport);
router.get("/export/csv", exportModuleCSV);

export default router;
