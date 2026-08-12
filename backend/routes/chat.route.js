import express from 'express';
import { protectRoute } from '../middleware/protectRoute.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    getChannels,
    getChannelMessages,
    sendMessage,
    markChannelRead
} from '../controller/chat.controller.js';

const __filename_route = fileURLToPath(import.meta.url);
const __dirname_route = path.dirname(__filename_route);

// Multer config for chat file uploads (channel messages)
const chatStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname_route, '..', 'uploads', 'chat');
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
    limits: { fileSize: 25 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = /\.(jpg|jpeg|png|gif|webp|svg|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|zip|rar|7z|tar|gz)$/i;
        if (allowed.test(path.extname(file.originalname))) {
            cb(null, true);
        } else {
            cb(new Error('Unsupported file type'), false);
        }
    }
});

const router = express.Router();

router.use(protectRoute);

router.get('/channels', getChannels);
router.get('/messages/:channelId', getChannelMessages);
router.post('/messages', chatUpload.single('file'), sendMessage);
router.post('/channels/:channelId/read', markChannelRead);

export default router;
