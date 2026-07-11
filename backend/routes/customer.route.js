import express from 'express';
import { 
    getCustomers, 
    createCustomer, 
    updateCustomer, 
    deleteCustomer 
} from '../controller/customer.controller.js';
import { protectRoute, isAdmin } from '../middleware/protectRoute.js';

const router = express.Router();

// Apply admin RBAC check globally on all customer routes
router.use(protectRoute, isAdmin);

router.get("/", getCustomers);
router.post("/", createCustomer);
router.put("/:id", updateCustomer);
router.delete("/:id", deleteCustomer);

export default router;
