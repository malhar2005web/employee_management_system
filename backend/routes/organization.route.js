import express from 'express';
import { getDirectory, getOrgChart } from '../controller/organization.controller.js';
import { protectRoute } from '../middleware/protectRoute.js';

const router = express.Router();

router.get("/directory", protectRoute, getDirectory);
router.get("/chart", protectRoute, getOrgChart);

export default router;
