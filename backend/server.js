import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import jwt from 'jsonwebtoken';

// Config & DB
import { ENV_VARS } from "./config/envVars.js";
import { connectDB, pool } from "./config/db.js";
import { runMigrations } from "./config/migrations.js";

// Routes
import authRoutes from "./routes/auth.route.js";
import organizationRoutes from "./routes/organization.route.js";
import employeeRoutes from "./routes/employee.route.js";
import customerRoutes from "./routes/customer.route.js";
import projectRoutes from "./routes/project.route.js";
import taskRoutes from "./routes/task.route.js";
import attendanceRoutes from "./routes/attendance.route.js";
import shiftRoutes from "./routes/shift.route.js";
import leaveRoutes from "./routes/leave.route.js";
import workloadRoutes from "./routes/workload.route.js";
import reportRoutes from "./routes/report.route.js";
import communicationRoutes from "./routes/communication.route.js";
import auditRoutes from "./routes/audit.route.js";
import settingsRoutes from "./routes/settings.route.js";
import employeePortalRoutes from "./routes/employeePortal.route.js";
import taskSessionRoutes from "./routes/taskSession.route.js";
import taskHandoverRoutes from "./routes/taskHandover.route.js";
import activityTimelineRoutes from "./routes/activityTimeline.route.js";
import chatRoutes from "./routes/chat.route.js";
import workloadHeatmapRoutes from "./routes/workloadHeatmap.route.js";
import monitoringRoutes from "./routes/monitoring.route.js";
import deletionRoutes from "./routes/deletion.route.js";
import importExportRoutes from "./routes/importExport.route.js";
import supportRoutes from "./routes/support.route.js";
import pcsAttendanceRoutes from "./routes/pcsAttendance.route.js";
import outEntryRoutes from "./routes/outEntry.route.js";
import holidayRoutes from "./routes/holiday.route.js";
import { syncTeramindDataToCache } from "./services/teramind.service.js";

// ESM fix
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = ENV_VARS.PORT || 5008;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

// HTML Protection Middleware for direct file requests
const protectHtml = (requiredRole) => {
    return async (req, res, next) => {
        const token = req.cookies["jwt-moma"];
        if (!token) {
            return res.redirect("/login.html");
        }
        try {
            const decoded = jwt.verify(token, ENV_VARS.JWT_SECRET);
            const userQuery = await pool.query("SELECT role FROM users WHERE id = $1", [decoded.userId]);
            if (userQuery.rows.length === 0 || userQuery.rows[0].role !== requiredRole) {
                return res.redirect("/login.html");
            }
            next();
        } catch (e) {
            res.redirect("/login.html");
        }
    };
};

// Route protections for HTML assets
app.get("/admin-dashboard.html", protectHtml("Admin"));
app.get("/employee-dashboard.html", protectHtml("Employee"));
app.get("/admin-organization.html", protectHtml("Admin"));
app.get("/employee-organization.html", protectHtml("Employee"));
app.get("/admin-employees.html", protectHtml("Admin"));
app.get("/admin-customers.html", protectHtml("Admin"));
app.get("/admin-projects.html", protectHtml("Admin"));
app.get("/admin-tasks.html", protectHtml("Admin"));
app.get("/admin-attendance.html", protectHtml("Admin"));
app.get("/admin-shifts.html", protectHtml("Admin"));
app.get("/admin-leaves.html", protectHtml("Admin"));
app.get("/admin-timesheets.html", protectHtml("Admin"));
app.get("/admin-goals.html", protectHtml("Admin"));
app.get("/admin-monitoring.html", protectHtml("Admin"));
app.get("/admin-screenshots.html", protectHtml("Admin"));
app.get("/admin-workload.html", protectHtml("Admin"));
app.get("/admin-trainings.html", protectHtml("Admin"));
app.get("/admin-reports.html", protectHtml("Admin"));
app.get("/admin-communication.html", protectHtml("Admin"));
app.get("/admin-audit-logs.html", protectHtml("Admin"));
app.get("/admin-settings.html", protectHtml("Admin"));
app.get("/admin-support.html", protectHtml("Admin"));
app.get("/employee-attendance.html", protectHtml("Employee"));
app.get("/employee-dsr.html", protectHtml("Employee"));
app.get("/employee-leave.html", protectHtml("Employee"));
app.get("/employee-tasks.html", protectHtml("Employee"));
app.get("/employee-timesheets.html", protectHtml("Employee"));
app.get("/employee-goals.html", protectHtml("Employee"));
app.get("/employee-trainings.html", protectHtml("Employee"));
app.get("/employee-profile.html", protectHtml("Employee"));
app.get("/employee-inbox.html", protectHtml("Employee"));

// Serve uploaded chat files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serving Frontend static assets
app.use(express.static(path.join(__dirname, "../stitch_workforce_premium_saas")));

// API Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/organization", organizationRoutes);
app.use("/api/v1/admin/employees", employeeRoutes);
app.use("/api/v1/admin/customers", customerRoutes);
app.use("/api/v1/admin/projects", projectRoutes);
app.use("/api/v1/admin/tasks", taskRoutes);
app.use("/api/v1/admin/attendance", attendanceRoutes);
app.use("/api/v1/admin/shifts", shiftRoutes);
app.use("/api/v1/admin/leaves", leaveRoutes);
app.use("/api/v1/admin/workload", workloadRoutes);
app.use("/api/v1/admin/reports", reportRoutes);
app.use("/api/v1/admin/communication", communicationRoutes);
app.use("/api/v1/admin/audit", auditRoutes);
app.use("/api/v1/admin/settings", settingsRoutes);
app.use("/api/v1/employee", employeePortalRoutes);
app.use("/api/v1/tracking", taskSessionRoutes);
app.use("/api/v1/task-handover", taskHandoverRoutes);
app.use("/api/v1/timeline", activityTimelineRoutes);
app.use("/api/v1/chat", chatRoutes);
app.use("/api/v1/workload-heatmap", workloadHeatmapRoutes);
app.use("/api/v1/admin/monitoring", monitoringRoutes);
app.use("/api/v1/admin/deletion", deletionRoutes);
app.use("/api/v1/admin/import-export", importExportRoutes);
app.use("/api/v1/support", supportRoutes);
app.use("/api/v1/attendance/pcs", pcsAttendanceRoutes);
app.use("/api/v1/attendance/out-entries", outEntryRoutes);
app.use("/api/v1/admin/out-entries", outEntryRoutes);
app.use("/api/v1/holidays", holidayRoutes);
app.use("/api/v1/admin/holidays", holidayRoutes);

// Fallback to login page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../stitch_workforce_premium_saas/login.html"));
});

app.get("*", (req, res) => {
  res.redirect("/login.html");
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// Background Heartbeat Monitor Service
const startHeartbeatMonitor = () => {
    setInterval(async () => {
        try {
            const staleRes = await pool.query(`
                SELECT id, employee_id, started_at, last_heartbeat_at 
                FROM task_sessions 
                WHERE status = 'Running' AND last_heartbeat_at < NOW() - INTERVAL '120 seconds'
            `);

            for (const session of staleRes.rows) {
                const durationQuery = await pool.query(
                    `SELECT EXTRACT(EPOCH FROM ($1::timestamptz - $2::timestamptz))::INT as seconds`,
                    [session.last_heartbeat_at, session.started_at]
                );
                const durationSec = Math.max(1, durationQuery.rows[0].seconds || 0);

                await pool.query(`
                    UPDATE task_sessions 
                    SET status = 'Auto Paused', ended_at = $1, duration_seconds = $2, end_reason = 'Heartbeat Lost', updated_at = NOW()
                    WHERE id = $3
                `, [session.last_heartbeat_at, durationSec, session.id]);

                await pool.query(`
                    INSERT INTO task_session_events (session_id, employee_id, event_type, reason)
                    VALUES ($1, $2, 'Auto Paused', 'Heartbeat Lost')
                `, [session.id, session.employee_id]);

                console.log(`💓 Auto-paused stale session #${session.id} (Heartbeat Lost)`);
            }
        } catch (err) {
            console.error('Error in Heartbeat Monitor worker:', err.message);
        }
    }, 30000);
};

// Background Delegation Expiry Worker (Distributed Lock)
const startDelegationExpiryWorker = () => {
    setInterval(async () => {
        try {
            const expiredRes = await pool.query(`
                SELECT id, task_id, from_employee_id, to_employee_id 
                FROM task_transfers 
                WHERE transfer_type = 'Delegation' AND status = 'Approved' 
                  AND expiry_at <= NOW() AND expiry_at IS NOT NULL
                FOR UPDATE SKIP LOCKED
            `);

            for (const item of expiredRes.rows) {
                await pool.query(`UPDATE task_transfers SET status = 'Expired', updated_at = NOW() WHERE id = $1`, [item.id]);

                if (item.from_employee_id) {
                    await pool.query(`UPDATE task_assignments SET is_active = false WHERE task_id = $1`, [item.task_id]);
                    await pool.query(`
                        INSERT INTO task_assignments (task_id, assignee_type, assignee_id, role, assigned_by, assigned_at, is_active)
                        VALUES ($1, 'Employee', $2, 'Primary', $2, NOW(), true)
                    `, [item.task_id, item.from_employee_id]);

                    await pool.query(`
                        INSERT INTO task_assignment_history (task_id, assignee_type, assignee_id, role, action, old_owner_id, new_owner_id, reason_code, comments, performed_by)
                        VALUES ($1, 'Employee', $2, 'Primary', 'RETURNED', $3, $2, 'EXPIRED', 'Delegation period expired - auto reverted ownership', $2)
                    `, [item.task_id, item.from_employee_id, item.to_employee_id]);

                    console.log(`⏱️ Auto-reverted expired delegation for task #${item.task_id}`);
                }
            }
        } catch (err) {
            console.error('Error in Delegation Expiry Worker:', err.message);
        }
    }, 60000);
};

// Teramind Background Telemetry Sync Worker
let teramindSyncWorkerStarted = false;
const startTeramindSyncWorker = () => {
    if (teramindSyncWorkerStarted) {
        console.log("⚠️ Teramind Sync Worker already running on this instance. Skipping duplicate initialization.");
        return;
    }
    teramindSyncWorkerStarted = true;

    // Perform initial sync after 5 seconds on startup
    setTimeout(() => {
        syncTeramindDataToCache();
    }, 5000);

    // Periodic loop every 5 minutes (300,000 ms)
    setInterval(async () => {
        try {
            await syncTeramindDataToCache();
        } catch (err) {
            console.error('Error in Teramind Sync Worker:', err.message);
        }
    }, 300000);
};

const server = createServer(app);

// DB + Migrations + Server Start
connectDB()
  .then(async () => {
    await runMigrations();
    startHeartbeatMonitor();
    startDelegationExpiryWorker();
    startTeramindSyncWorker();
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`💓 Background Heartbeat Monitor active (120s timeout)`);
      console.log(`⏱️ Delegation Expiry & Escalation Worker active (60s loop)`);
      console.log(`📡 Teramind Telemetry Cache Sync Worker active (5m loop)`);
    });
  })

  .catch((err) => {
    console.error("❌ DB connection failed:", err);
    // Start anyway in degraded mode
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT} (degraded - no DB)`);
    });
  });



