import express from 'express';
import { protectRoute } from '../middleware/protectRoute.js';
import {
    getWorkloadHeatmap,
    previewAutoRebalance
} from '../controller/workloadHeatmap.controller.js';

const router = express.Router();

router.use(protectRoute);

router.get('/heatmap', getWorkloadHeatmap);
router.get('/rebalance-preview', previewAutoRebalance);

export default router;
