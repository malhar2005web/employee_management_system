import express from 'express';
import { 
    getEmployees, 
    createEmployee, 
    updateEmployee, 
    toggleEmployeeStatus, 
    getDeptsAndDesigs, 
    createDepartment, 
    updateDepartment,
    deleteDepartment,
    createDesignation,
    updateDesignation,
    deleteDesignation,
    getDashboardSummary,
    getProductivityTrend
} from '../controller/employee.controller.js';
import { protectRoute, isAdmin } from '../middleware/protectRoute.js';

const router = express.Router();

// Apply admin RBAC check globally on all employee routes
router.use(protectRoute, isAdmin);

router.get("/dashboard-summary", getDashboardSummary);
router.get("/productivity-trend", getProductivityTrend);
router.get("/", getEmployees);
router.post("/", createEmployee);
router.put("/:id", updateEmployee);
router.patch("/:id/status", toggleEmployeeStatus);
router.get("/metadata", getDeptsAndDesigs);
router.post("/departments", createDepartment);
router.put("/departments/:id", updateDepartment);
router.delete("/departments/:id", deleteDepartment);
router.post("/designations", createDesignation);
router.put("/designations/:id", updateDesignation);
router.delete("/designations/:id", deleteDesignation);

export default router;
