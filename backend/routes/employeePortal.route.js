import express from 'express';
import { protectRoute, isEmployee } from '../middleware/protectRoute.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename_route = fileURLToPath(import.meta.url);
const __dirname_route = path.dirname(__filename_route);

// Multer config for chat file uploads
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
    limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
    fileFilter: (req, file, cb) => {
        const allowed = /\.(jpg|jpeg|png|gif|webp|svg|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|zip|rar|7z|tar|gz)$/i;
        if (allowed.test(path.extname(file.originalname))) {
            cb(null, true);
        } else {
            cb(new Error('Unsupported file type'), false);
        }
    }
});

import {
    getDashboardSummary,
    getAttendanceStatus,
    clockIn,
    clockOut,
    requestCorrection,
    getAttendanceLogs,
    getReports,
    submitSelfReport,
    submitDsrReport,
    getLeaveBalances,
    applyLeave,
    getLeaveHistory,
    getTasks,
    updateTaskProgress,
    getTimesheets,
    submitTimesheet,
    getGoals,
    submitGoalSelfAssessment,
    getTrainings,
    completeTraining
} from '../controller/employeePortal.controller.js';

const router = express.Router();

// Apply session checks and employee role validation globally on these routes
router.use(protectRoute, isEmployee);

// Dashboard
router.get("/dashboard/summary", getDashboardSummary);

// Attendance & Clock in/out
router.get("/attendance/status", getAttendanceStatus);
router.post("/attendance/clock-in", clockIn);
router.post("/attendance/clock-out", clockOut);
router.post("/attendance/correction", requestCorrection);
router.get("/attendance/logs", getAttendanceLogs);

// Reports
router.get("/reports", getReports);
router.post("/reports/self", submitSelfReport);
router.post("/reports/field", submitDsrReport);

// Leaves
router.get("/leaves/balances", getLeaveBalances);
router.post("/leaves/apply", applyLeave);
router.get("/leaves/history", getLeaveHistory);

// Out Entry / Gate Pass
import { getOutEntries, createOutEntry, markReturnInTime } from '../controller/outEntry.controller.js';
router.get("/out-entries", getOutEntries);
router.post("/out-entries", createOutEntry);
router.put("/out-entries/:id/return", markReturnInTime);

// Tasks
router.get("/tasks", getTasks);
router.put("/tasks/:id/progress", updateTaskProgress);

// Timesheets
router.get("/timesheets", getTimesheets);
router.post("/timesheets", submitTimesheet);

// Goals
router.get("/goals", getGoals);
router.put("/goals/:id/self-assessment", submitGoalSelfAssessment);

// Trainings
router.get("/trainings", getTrainings);
router.put("/trainings/:id/complete", completeTraining);

// Profile & Password & Inbox
import { 
    updateProfile, 
    changePassword, 
    getInbox, 
    markAllRead,
    getChatContacts,
    getChatMessages,
    sendChatMessage
} from '../controller/employeePortal.controller.js';

import { isEmployeeOrAdmin } from '../middleware/protectRoute.js';

// Chat routes (accessible by Employee & Admin)
router.get("/chat/contacts", protectRoute, isEmployeeOrAdmin, getChatContacts);
router.get("/chat/messages", protectRoute, isEmployeeOrAdmin, getChatMessages);
router.post("/chat/send", protectRoute, isEmployeeOrAdmin, chatUpload.single('file'), sendChatMessage);

router.put("/profile", updateProfile);
router.post("/change-password", changePassword);
router.get("/inbox", getInbox);
router.post("/inbox/mark-all-read", markAllRead);

export default router;
