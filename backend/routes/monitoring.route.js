import express from 'express';
import { 
    getMonitoringLogs, 
    getActivityLogs, 
    categorizeProductivity,
    getExecutiveHealthCards,
    getMonitoringDashboard,
    getAnalyticsApps,
    getAnalyticsWebsites,
    getAnalyticsAlerts,
    getTeramindConfig,
    updateTeramindConfig,
    testTeramindConnection,
    triggerManualSync,
    getEmployeeActivityLogs,
    getSingleComputerDetails,
    getLoginSessionHistory,
    getProcessVideo,
    proxyVideoStream,
    getAvailableWorkstations,
    assignWorkstation,
    exportMonitoringTelemetry
} from '../controller/monitoring.controller.js';
import { protectRoute, isAdmin } from '../middleware/protectRoute.js';

const router = express.Router();

// Public media stream proxy for HTML5 video element
router.get("/video-stream-proxy", proxyVideoStream);

// Apply admin RBAC check globally on all monitoring routes
router.use(protectRoute, isAdmin);

// Legacy routes
router.get("/logs", getMonitoringLogs);
router.get("/activities", getActivityLogs);
router.post("/categorize", categorizeProductivity);

// Teramind Integration & Dashboard Endpoints
router.get("/health", getExecutiveHealthCards);
router.get("/dashboard", getMonitoringDashboard);
router.get("/export-telemetry", exportMonitoringTelemetry);
router.get("/available-workstations", getAvailableWorkstations);
router.post("/assign-workstation", assignWorkstation);
router.get("/computer/:id", getSingleComputerDetails);
router.get("/session-history", getLoginSessionHistory);
router.get("/employee/:id/logs", getEmployeeActivityLogs);
router.get("/process-video", getProcessVideo);
router.get("/analytics/apps", getAnalyticsApps);
router.get("/analytics/websites", getAnalyticsWebsites);
router.get("/analytics/alerts", getAnalyticsAlerts);
router.get("/config", getTeramindConfig);
router.post("/config", updateTeramindConfig);
router.post("/test-connection", testTeramindConnection);
router.post("/sync", triggerManualSync);

export default router;
