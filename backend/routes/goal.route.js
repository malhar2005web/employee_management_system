import express from 'express';
import { 
    getGoals, 
    createGoal, 
    updateGoal, 
    deleteGoal 
} from '../controller/goal.controller.js';
import { protectRoute, isAdmin } from '../middleware/protectRoute.js';

const router = express.Router();

// Apply admin RBAC check globally on all goals routes
router.use(protectRoute, isAdmin);

router.get("/", getGoals);
router.post("/", createGoal);
router.put("/:id", updateGoal);
router.delete("/:id", deleteGoal);

export default router;
