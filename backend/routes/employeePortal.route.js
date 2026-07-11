import express from 'express';
import { protectRoute, isEmployee } from '../middleware/protectRoute.js';
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
router.post("/chat/send", protectRoute, isEmployeeOrAdmin, sendChatMessage);

router.put("/profile", updateProfile);
router.post("/change-password", changePassword);
router.get("/inbox", getInbox);
router.post("/inbox/mark-all-read", markAllRead);

export default router;
