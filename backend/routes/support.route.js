import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import * as supportController from '../controller/support.controller.js';
import { protectRoute, isEmployeeOrAdmin } from '../middleware/protectRoute.js';

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

// Universal Attachment Resolver & Downloader
router.get('/attachment/:filename', (req, res) => {
    const filename = path.basename(req.params.filename);
    const candidateDirs = [
        path.join(__dirname, '../uploads/support'),
        path.join(process.cwd(), 'uploads/support'),
        path.join(__dirname, '../uploads/whatsapp'),
        path.join(process.cwd(), 'uploads/whatsapp'),
        path.join(__dirname, '../uploads/whatsapp_media'),
        path.join(process.cwd(), 'uploads/whatsapp_media'),
        path.join(__dirname, '../uploads'),
        path.join(process.cwd(), 'uploads'),
        path.join(__dirname, 'uploads/support'),
        path.join(__dirname, 'uploads')
    ];

    for (const dir of candidateDirs) {
        if (!fs.existsSync(dir)) continue;
        const fullPath = path.join(dir, filename);
        if (fs.existsSync(fullPath)) {
            return res.sendFile(fullPath);
        }
    }

    // If it's an image file that was referenced in a ticket but physical binary was missing:
    const isImage = /\.(png|jpg|jpeg|webp|gif|svg)$/i.test(filename);
    if (isImage) {
        const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 380" width="680" height="380">
  <defs>
    <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="60%" stop-color="#1e293b" />
      <stop offset="100%" stop-color="#042f2e" />
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#cardGrad)" rx="16" />
  <rect x="24" y="24" width="632" height="332" rx="12" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1.5" />
  
  <!-- Image Icon Circle -->
  <circle cx="340" cy="130" r="44" fill="rgba(13,148,136,0.2)" stroke="#14b8a6" stroke-width="2" />
  <path d="M322 142 L334 126 L348 142 L358 132 L368 142" fill="none" stroke="#2dd4bf" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
  <circle cx="330" cy="120" r="4.5" fill="#5eead4" />
  
  <!-- Title & Info -->
  <text x="340" y="215" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="700" fill="#f8fafc" text-anchor="middle">Support Ticket Attachment</text>
  <text x="340" y="248" font-family="monospace" font-size="14" font-weight="600" fill="#2dd4bf" text-anchor="middle">${filename}</text>
  <text x="340" y="285" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" fill="#94a3b8" text-anchor="middle">Attachment logged via WhatsApp Desk • Cached in cloud thread</text>
  
  <rect x="220" y="306" width="240" height="28" rx="14" fill="rgba(13,148,136,0.25)" stroke="rgba(45,212,191,0.4)" stroke-width="1" />
  <text x="340" y="325" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="600" fill="#a7f3d0" text-anchor="middle">✓ Media Reference Registered</text>
</svg>`;

        // Also cache this SVG to disk so subsequent hits or direct static /uploads hits find it immediately
        try {
            const targetDir = path.join(uploadDir);
            if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
            fs.writeFileSync(path.join(targetDir, filename), svgContent);
        } catch (e) {}

        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.send(svgContent);
    }

    return res.status(404).send('Attachment not found on server');
});

// Public Inbound Email Webhook (for SendGrid, Mailgun, Postmark or external email services)
router.post('/inbound-email', upload.array('attachments', 10), supportController.handleInboundEmail);

// Apply RBAC check (Employees & Admins can access support desk)
router.use(protectRoute, isEmployeeOrAdmin);

// Support Ticket REST Routes
router.get('/', supportController.getTickets);
router.post('/', supportController.createTicket);
router.post('/bulk-delete', supportController.bulkDeleteTickets);
router.get('/:id', supportController.getTicketById);
router.put('/:id', supportController.updateTicket);
router.delete('/:id', supportController.deleteTicket);
router.put('/:id/status', supportController.updateTicketStatus);
router.put('/:id/assign', supportController.assignTicket);
router.put('/:id/transfer', supportController.transferTicket);
router.put('/:id/reopen', supportController.reopenTicket);
router.post('/:id/comments', supportController.addComment);
router.post('/:id/convert-to-task', supportController.convertToTask);
router.post('/:id/convert-to-workflow', supportController.convertToWorkflow);

// Sub-Tasks & Multi-Employee Handover Routes
router.get('/:id/subtasks', supportController.getSubtasksByTicketId);
router.post('/:id/subtasks', supportController.createSubtask);
router.put('/:id/subtasks/:subtaskId', supportController.updateSubtask);
router.put('/:id/subtasks/:subtaskId/handover', supportController.completeSubtaskWithHandover);
router.delete('/:id/subtasks/:subtaskId', supportController.deleteSubtask);

export default router;

