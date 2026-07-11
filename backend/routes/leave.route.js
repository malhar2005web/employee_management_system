import express from 'express';
import { 
    getLeaves, 
    createManualLeave, 
    approveLeave, 
    rejectLeave, 
    deleteLeave 
} from '../controller/leave.controller.js';
import { protectRoute, isAdmin } from '../middleware/protectRoute.js';

const router = express.Router();

// Apply admin RBAC check globally on all leave routes
router.use(protectRoute, isAdmin);

router.get("/", getLeaves);
router.post("/", createManualLeave);
router.post("/approve/:id", approveLeave);
router.post("/reject/:id", rejectLeave);
router.delete("/:id", deleteLeave);

export default router;
