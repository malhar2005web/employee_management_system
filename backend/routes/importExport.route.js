import express from 'express';
import multer from 'multer';
import { protectRoute, isAdmin } from '../middleware/protectRoute.js';
import {
    downloadModuleTemplate,
    exportModuleData,
    previewImportData,
    startImportJob,
    getImportJobStatus,
    getImportCenterStats
} from '../controller/importExport.controller.js';

const router = express.Router();
const upload = multer({ limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB limit

// Template Download & Data Export
router.get('/template', protectRoute, isAdmin, downloadModuleTemplate);
router.get('/export', protectRoute, isAdmin, exportModuleData);

// Import Preview & Job Start
router.post('/preview', protectRoute, isAdmin, upload.single('file'), previewImportData);
router.post('/commit-job', protectRoute, isAdmin, startImportJob);

// Status & Dashboard Metrics
router.get('/job-status/:jobId', protectRoute, isAdmin, getImportJobStatus);
router.get('/import-center/stats', protectRoute, isAdmin, getImportCenterStats);

export default router;
