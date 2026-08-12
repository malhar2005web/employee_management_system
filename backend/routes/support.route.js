import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import * as supportController from '../controller/support.controller.js';
import { protectRoute, isAdmin } from '../middleware/protectRoute.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Setup multer storage for support ticket attachments
const uploadDir = path.join(__dirname, '../uploads/support');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'ticket-attachment-' + uniqueSuffix + ext);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit
});

// File upload route
router.post('/upload-attachment', upload.single('attachment'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const attachmentUrl = `/uploads/support/${req.file.filename}`;
    return res.json({
        success: true,
        attachmentUrl,
        attachmentName: req.file.originalname
    });
});

// Apply admin RBAC check globally on all support routes
router.use(protectRoute, isAdmin);

// Support Ticket REST Routes
router.get('/', supportController.getTickets);
router.post('/', supportController.createTicket);
router.get('/:id', supportController.getTicketById);
router.put('/:id', supportController.updateTicket);
router.put('/:id/status', supportController.updateTicketStatus);
router.put('/:id/assign', supportController.assignTicket);
router.post('/:id/comments', supportController.addComment);
router.post('/:id/convert-to-task', supportController.convertToTask);
router.post('/:id/convert-to-workflow', supportController.convertToWorkflow);

export default router;
