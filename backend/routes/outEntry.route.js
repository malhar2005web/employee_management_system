import express from 'express';
import {
    getOutEntries,
    createOutEntry,
    markReturnInTime,
    updateOutEntryStatus,
    deleteOutEntry,
    trackLocation,
    verifyVisitOtp
} from '../controller/outEntry.controller.js';
import { protectRoute } from '../middleware/protectRoute.js';

const router = express.Router();

// Apply auth check
router.use(protectRoute);

router.get('/', getOutEntries);
router.post('/', createOutEntry);
router.put('/:id/return', markReturnInTime);
router.put('/:id/status', updateOutEntryStatus);
router.post('/:id/track-location', trackLocation);
router.post('/:id/verify-visit-otp', verifyVisitOtp);
router.delete('/:id', deleteOutEntry);

export default router;
