import express from 'express';
import { protectRoute } from '../middleware/protectRoute.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    getChannels,
    getChannelMessages,
    sendMessage,
    markChannelRead,
    createGroup
} from '../controller/chat.controller.js';

import fs from 'fs';

const __filename_route = fileURLToPath(import.meta.url);
const __dirname_route = path.dirname(__filename_route);

// Multer config for chat file uploads (channel messages)
const chatStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname_route, '..', 'uploads', 'chat');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, uniqueSuffix + ext);
    }
});

const chatUpload = multer({
    storage: chatStorage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: (req, file, cb) => {
        // Disallow dangerous executable scripts/binaries for security
        const blocked = /\.(exe|bat|cmd|sh|vbs|msi|scr|com|ps1)$/i;
        if (blocked.test(path.extname(file.originalname || ''))) {
            return cb(new Error('Executable files (.exe, .bat, etc.) are not allowed for security reasons.'), false);
        }
        cb(null, true);
    }
});

const router = express.Router();

router.use(protectRoute);

router.get('/channels', getChannels);
router.get('/messages/:channelId', getChannelMessages);
router.post('/messages', chatUpload.single('file'), sendMessage);
router.post('/channels/:channelId/read', markChannelRead);
router.post('/groups', createGroup);

export default router;
