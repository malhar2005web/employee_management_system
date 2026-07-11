import express from 'express';
import { getWorkloadStats } from '../controller/workload.controller.js';
import { protectRoute, isAdmin } from '../middleware/protectRoute.js';

const router = express.Router();

// Apply admin RBAC check globally on all workload routes
router.use(protectRoute, isAdmin);

router.get("/", getWorkloadStats);

export default router;
