import express from 'express';
import { 
    getTimesheets, 
    createManualTimesheet, 
    approveTimesheet, 
    rejectTimesheet, 
    deleteTimesheet 
} from '../controller/timesheet.controller.js';
import { protectRoute, isAdmin } from '../middleware/protectRoute.js';

const router = express.Router();

// Apply admin RBAC check globally on all timesheet routes
router.use(protectRoute, isAdmin);

router.get("/", getTimesheets);
router.post("/", createManualTimesheet);
router.post("/approve/:id", approveTimesheet);
router.post("/reject/:id", rejectTimesheet);
router.delete("/:id", deleteTimesheet);

export default router;
