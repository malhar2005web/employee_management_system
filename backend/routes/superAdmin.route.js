import express from "express";
import {
    getSuperAdminStats,
    getCompanies,
    provisionCompany,
    updateCompanyModules,
    toggleCompanyStatus,
    getCompanyModulesForTenant
} from "../controller/superAdmin.controller.js";

const router = express.Router();

// Public tenant-aware module query (for frontend dashboard sidebar filtering)
router.get("/tenant-modules", getCompanyModulesForTenant);

// Super Admin platform routes
router.get("/stats", getSuperAdminStats);
router.get("/companies", getCompanies);
router.post("/companies", provisionCompany);
router.put("/companies/:id/modules", updateCompanyModules);
router.put("/companies/:id/status", toggleCompanyStatus);

export default router;
