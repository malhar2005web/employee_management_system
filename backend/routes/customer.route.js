import express from 'express';
import { 
    getCustomers, 
    createCustomer, 
    updateCustomer, 
    deleteCustomer,
    getCustomerBillingReport,
    exportCustomerBillingReport,
    updateBillingRate
} from '../controller/customer.controller.js';
import { protectRoute, isAdmin } from '../middleware/protectRoute.js';

const router = express.Router();

// Apply auth check globally
router.use(protectRoute);

router.get("/billing-report/export", isAdmin, exportCustomerBillingReport);
router.get("/billing-report", isAdmin, getCustomerBillingReport);
router.put("/billing-rate", isAdmin, updateBillingRate);
router.get("/", getCustomers);
router.post("/", isAdmin, createCustomer);
router.put("/:id", isAdmin, updateCustomer);
router.delete("/:id", isAdmin, deleteCustomer);

export default router;
