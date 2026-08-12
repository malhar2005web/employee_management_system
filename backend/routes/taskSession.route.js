import express from 'express';
import { protectRoute } from '../middleware/protectRoute.js';
import {
    startTaskSession,
    pauseTaskSession,
    stopTaskSession,
    getActiveTaskSession,
    sendHeartbeat,
    reportIdle,
    getTrackingAnalytics,
    getSessionHistory
} from '../controller/taskSession.controller.js';

const router = express.Router();

// Apply auth middleware globally on all session tracking routes
router.use(protectRoute);

router.post('/start', startTaskSession);
router.post('/pause', pauseTaskSession);
router.post('/stop', stopTaskSession);
router.get('/active', getActiveTaskSession);
router.post('/heartbeat', sendHeartbeat);
router.post('/idle', reportIdle);
router.get('/analytics', getTrackingAnalytics);
router.get('/history', getSessionHistory);

export default router;
