import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { getSettings, updateSettings, uploadWhatsappAttachment } from '../controller/settings.controller.js';
import { protectRoute, isAdmin } from '../middleware/protectRoute.js';

const router = express.Router();

const waStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(process.cwd(), 'uploads', 'whatsapp');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'wa-attachment-' + uniqueSuffix + ext);
    }
});

const waUpload = multer({
    storage: waStorage,
    limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit
});

// Apply admin RBAC check globally on all settings routes
router.use(protectRoute, isAdmin);

router.get("/", getSettings);
router.put("/", updateSettings);
router.post("/upload-attachment", waUpload.single('attachment'), uploadWhatsappAttachment);

export default router;
