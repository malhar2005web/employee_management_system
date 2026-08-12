import express from 'express';
import multer from 'multer';
import path from 'path';
import { 
    checkDependencyLock,
    createDeletionRequest, 
    uploadDeletionDocument, 
    submitStageApproval, 
    archiveRecord, 
    getPurgeQueue, 
    purgeRecord, 
    getDeletionAuditLogs 
} from '../controller/deletion.controller.js';
import { protectRoute, isAdmin } from '../middleware/protectRoute.js';

const router = express.Router();

// Multer Storage & Security Configuration
const storage = multer.memoryStorage(); // Store in memory for sha-256 checksum & mime validation
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB Max File Size
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'image/png',
            'image/jpeg',
            'image/jpg'
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Invalid document format. Allowed: PDF, DOC, DOCX, PNG, JPG, JPEG"));
        }
    }
});

// Protect all deletion & offboarding routes
router.use(protectRoute, isAdmin);

router.get("/dependency-check", checkDependencyLock);
router.post("/request", createDeletionRequest);
router.post("/document", upload.single('document'), uploadDeletionDocument);
router.post("/approve-stage", submitStageApproval);
router.post("/archive", archiveRecord);
router.get("/purge-queue", getPurgeQueue);
router.post("/purge", purgeRecord);
router.get("/audit-logs", getDeletionAuditLogs);

export default router;
