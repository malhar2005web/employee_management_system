import express from 'express';
import { 
    getShiftsData, 
    createShift, 
    deleteShift, 
    assignShiftBulk, 
    deleteRosterAssignment 
} from '../controller/shift.controller.js';
import { protectRoute, isAdmin } from '../middleware/protectRoute.js';

const router = express.Router();

// Apply admin RBAC check globally on all shift routes
router.use(protectRoute, isAdmin);

router.get("/", getShiftsData);
router.post("/", createShift);
router.delete("/:id", deleteShift);
router.post("/assign", assignShiftBulk);
router.delete("/assign/:id", deleteRosterAssignment);

export default router;
