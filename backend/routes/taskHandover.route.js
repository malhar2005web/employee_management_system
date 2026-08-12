import express from 'express';
import { protectRoute } from '../middleware/protectRoute.js';
import {
    assignTask,
    transferTask,
    delegateTask,
    returnTask,
    escalateTask,
    respondToApproval,
    getTaskTimeline,
    getHandoverAnalytics,
    getPendingApprovals
} from '../controller/taskHandover.controller.js';

const router = express.Router();

router.use(protectRoute);

router.post('/assign', assignTask);
router.post('/transfer', transferTask);
router.post('/delegate', delegateTask);
router.post('/return', returnTask);
router.post('/escalate', escalateTask);
router.post('/approvals/respond', respondToApproval);
router.get('/approvals/pending', getPendingApprovals);
router.get('/:taskId/timeline', getTaskTimeline);
router.get('/analytics', getHandoverAnalytics);

export default router;
