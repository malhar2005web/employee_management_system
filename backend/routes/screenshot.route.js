import express from 'express';
import { 
    getScreenshots, 
    createManualScreenshot, 
    updateScreenshotSettings 
} from '../controller/screenshot.controller.js';
import { protectRoute, isAdmin } from '../middleware/protectRoute.js';

const router = express.Router();

// Apply admin RBAC check globally on all screenshots routes
router.use(protectRoute, isAdmin);

router.get("/", getScreenshots);
router.post("/", createManualScreenshot);
router.put("/settings", updateScreenshotSettings);

export default router;
