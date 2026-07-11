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
import timesheetRoutes from "./routes/timesheet.route.js";
import goalRoutes from "./routes/goal.route.js";
import monitoringRoutes from "./routes/monitoring.route.js";
import screenshotRoutes from "./routes/screenshot.route.js";
import workloadRoutes from "./routes/workload.route.js";
import trainingRoutes from "./routes/training.route.js";
import reportRoutes from "./routes/report.route.js";
import communicationRoutes from "./routes/communication.route.js";
import auditRoutes from "./routes/audit.route.js";
import settingsRoutes from "./routes/settings.route.js";
import employeePortalRoutes from "./routes/employeePortal.route.js";

// ESM fix
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = ENV_VARS.PORT || 5008;

// Middleware
app.use(express.json());
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
app.get("/employee-attendance.html", protectHtml("Employee"));
app.get("/employee-dsr.html", protectHtml("Employee"));
app.get("/employee-leave.html", protectHtml("Employee"));
app.get("/employee-tasks.html", protectHtml("Employee"));
app.get("/employee-timesheets.html", protectHtml("Employee"));
app.get("/employee-goals.html", protectHtml("Employee"));
app.get("/employee-trainings.html", protectHtml("Employee"));
app.get("/employee-profile.html", protectHtml("Employee"));
app.get("/employee-inbox.html", protectHtml("Employee"));

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
app.use("/api/v1/admin/timesheets", timesheetRoutes);
app.use("/api/v1/admin/goals", goalRoutes);
app.use("/api/v1/admin/monitoring", monitoringRoutes);
app.use("/api/v1/admin/screenshots", screenshotRoutes);
app.use("/api/v1/admin/workload", workloadRoutes);
app.use("/api/v1/admin/trainings", trainingRoutes);
app.use("/api/v1/admin/reports", reportRoutes);
app.use("/api/v1/admin/communication", communicationRoutes);
app.use("/api/v1/admin/audit", auditRoutes);
app.use("/api/v1/admin/settings", settingsRoutes);
app.use("/api/v1/employee", employeePortalRoutes);

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

const server = createServer(app);

// DB + Migrations + Server Start
connectDB()
  .then(async () => {
    await runMigrations();
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ DB connection failed:", err);
    // Start anyway in degraded mode
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT} (degraded - no DB)`);
    });
   });


