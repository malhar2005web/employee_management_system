import express from 'express';
import { 
    getProjects, 
    createProject, 
    updateProject, 
    deleteProject 
} from '../controller/project.controller.js';
import { protectRoute, isAdmin } from '../middleware/protectRoute.js';

const router = express.Router();

// Apply admin RBAC check globally on all project routes
router.use(protectRoute, isAdmin);

router.get("/", getProjects);
router.post("/", createProject);
router.put("/:id", updateProject);
router.delete("/:id", deleteProject);

export default router;
