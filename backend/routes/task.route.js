import express from 'express';
import { 
    getWorkflows,
    createWorkflow,
    updateWorkflowStatus,
    updateWorkflowTaskStatus,
    deleteWorkflow,
    getTasks, 
    createTask, 
    updateTask, 
    deleteTask, 
    forwardTask, 
    approveTask, 
    createTemplate 
} from '../controller/task.controller.js';
import { protectRoute, isAdmin } from '../middleware/protectRoute.js';

const router = express.Router();

// Apply admin RBAC check globally on all task routes
router.use(protectRoute, isAdmin);

router.get("/workflows", getWorkflows);
router.post("/workflows", createWorkflow);
router.put("/workflows/:id/status", updateWorkflowStatus);
router.put("/workflows/:id/tasks/:taskId/status", updateWorkflowTaskStatus);
router.delete("/workflows/:id", deleteWorkflow);
router.get("/", getTasks);
router.post("/", createTask);
router.put("/:id", updateTask);
router.delete("/:id", deleteTask);
router.post("/:id/forward", forwardTask);
router.post("/:id/approve", approveTask);
router.post("/templates", createTemplate);

export default router;

