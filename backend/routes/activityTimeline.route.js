import express from 'express';
import { protectRoute } from '../middleware/protectRoute.js';
import {
    getTimelineEvents,
    getStepPerformance,
    getTaskPlaybackTimeline,
    exportTimelineReport
} from '../controller/activityTimeline.controller.js';

const router = express.Router();

router.use(protectRoute);

router.get('/events', getTimelineEvents);
router.get('/step-performance/:stepId', getStepPerformance);
router.get('/playback/:taskId', getTaskPlaybackTimeline);
router.get('/export', exportTimelineReport);

export default router;
