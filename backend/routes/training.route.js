import express from 'express';
import { 
    getTrainings, 
    createTraining, 
    updateTraining, 
    deleteTraining 
} from '../controller/training.controller.js';
import { protectRoute, isAdmin } from '../middleware/protectRoute.js';

const router = express.Router();

// Apply admin RBAC check globally on all trainings routes
router.use(protectRoute, isAdmin);

router.get("/", getTrainings);
router.post("/", createTraining);
router.put("/:id", updateTraining);
router.delete("/:id", deleteTraining);

export default router;
