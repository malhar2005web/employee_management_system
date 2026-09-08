import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
    handleWebhook,
    sendDirectMessage,
    getChatHistory,
    getMediaStream
} from '../controller/whatsapp.controller.js';

const router = express.Router();

// Setup Multer Storage for WhatsApp Media Attachments
const uploadDir = path.join(process.cwd(), 'uploads', 'whatsapp_media');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'wa-media-' + uniqueSuffix + ext);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit
});

// 1. Webhook Endpoint (GET for verification, POST for inbound messages & receipts)
router.get('/webhook', (req, res) => {
    // WABA Webhook verification challenge
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    
    if (mode === 'subscribe') {
        return res.status(200).send(challenge);
    }
    res.status(200).json({ success: true, message: "WABA Webhook Listener Active" });
});

router.post('/webhook', handleWebhook);

// 2. Direct Send Message (Supports Text, Templates, or Uploaded Image/Document)
router.post('/send-direct', upload.single('mediaFile'), sendDirectMessage);

// 3. Get Chat History for a Phone Number
router.get('/history/:phone', getChatHistory);

// 4. Stream / View WhatsApp Media Attachment
router.get('/media/:mediaId', getMediaStream);

export default router;
