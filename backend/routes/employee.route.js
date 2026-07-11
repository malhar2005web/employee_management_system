import express from 'express';
import { 
    getEmployees, 
    createEmployee, 
    updateEmployee, 
    toggleEmployeeStatus, 
    getDeptsAndDesigs, 
    createDepartment, 
    createDesignation 
} from '../controller/employee.controller.js';
import { protectRoute, isAdmin } from '../middleware/protectRoute.js';

const router = express.Router();

// Apply admin RBAC check globally on all employee routes
router.use(protectRoute, isAdmin);

router.get("/", getEmployees);
router.post("/", createEmployee);
router.put("/:id", updateEmployee);
router.patch("/:id/status", toggleEmployeeStatus);
router.get("/metadata", getDeptsAndDesigs);
router.post("/departments", createDepartment);
router.post("/designations", createDesignation);

export default router;
