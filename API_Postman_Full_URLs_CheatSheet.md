# 🚀 Complete Postman Ready API Cheat Sheet (100% Exact Server Mount URLs)

Base Server Address: **`http://localhost:5008`**

Every URL below matches the exact `server.js` route mounts line-by-line.

---

## 1. Authentication & Session (`http://localhost:5008/api/v1/auth`)

### 1.1 User Login
- **Method**: `POST`
- **Full URL**: `http://localhost:5008/api/v1/auth/login`
- **Headers**: `Content-Type: application/json`
```json
{
  "email": "admin@ems.com",
  "password": "adminPassword123"
}
```

---

### 1.2 Get Current User Profile
- **Method**: `GET`
- **Full URL**: `http://localhost:5008/api/v1/auth/me`

---

## 2. Departments & Employee Management (`http://localhost:5008/api/v1/admin/employees`)

### 2.1 Create Department
- **Method**: `POST`
- **Full URL**: `http://localhost:5008/api/v1/admin/employees/departments`
- **Headers**: `Content-Type: application/json`
```json
{
  "name": "Software Engineering & DevOps",
  "code": "ENG-DEV",
  "description": "Core software engineering team"
}
```

---

### 2.2 Create Designation
- **Method**: `POST`
- **Full URL**: `http://localhost:5008/api/v1/admin/employees/designations`
- **Headers**: `Content-Type: application/json`
```json
{
  "title": "Lead System Architect",
  "departmentId": 1,
  "level": 3
}
```

---

### 2.3 Get Employees List
- **Method**: `GET`
- **Full URL**: `http://localhost:5008/api/v1/admin/employees`

---

### 2.4 Onboard New Employee / Create Account
- **Method**: `POST`
- **Full URL**: `http://localhost:5008/api/v1/admin/employees`
- **Headers**: `Content-Type: application/json`
```json
{
  "fullName": "Rohan Deshmukh",
  "email": "rohan.deshmukh@pcscorp.com",
  "employeeCode": "EMP-2006",
  "phone": "+91 9823011223",
  "departmentId": 1,
  "designationId": 1,
  "joiningDate": "2026-08-01",
  "address": "Baner, Pune, MH"
}
```

---

## 3. Work Shifts & Roster (`http://localhost:5008/api/v1/admin/shifts`)

### 3.1 Get Shifts
- **Method**: `GET`
- **Full URL**: `http://localhost:5008/api/v1/admin/shifts`

---

### 3.2 Create Work Shift Schedule
- **Method**: `POST`
- **Full URL**: `http://localhost:5008/api/v1/admin/shifts`
- **Headers**: `Content-Type: application/json`
```json
{
  "name": "Evening Shift B",
  "code": "SHIFT-EVENING",
  "startTime": "14:00:00",
  "endTime": "22:00:00",
  "gracePeriod": 15
}
```

---

## 4. Customer Management (`http://localhost:5008/api/v1/admin/customers`)

### 4.1 Get Customers List
- **Method**: `GET`
- **Full URL**: `http://localhost:5008/api/v1/admin/customers`

---

### 4.2 Create Customer Account & Branches
- **Method**: `POST`
- **Full URL**: `http://localhost:5008/api/v1/admin/customers`
- **Headers**: `Content-Type: application/json`
```json
{
  "name": "Apex Global Solutions Pvt Ltd",
  "industry": "Manufacturing & Logistics",
  "sla_tier": "Enterprise (Resp: 2h, Reso: 24h)",
  "billing_cycle": "Monthly Recurring",
  "branches": [
    {
      "branch_name": "Pune Corporate Office",
      "plant_address": "Hinjewadi Phase 3, Pune",
      "contact_person": "John Doe",
      "email": "john.doe@apexglobal.com",
      "phone": "07028386535",
      "plant_active": true,
      "billing_active": true
    }
  ]
}
```

---

## 5. Project Management (`http://localhost:5008/api/v1/admin/projects`)

### 5.1 Get Projects List
- **Method**: `GET`
- **Full URL**: `http://localhost:5008/api/v1/admin/projects`

---

### 5.2 Create Project
- **Method**: `POST`
- **Full URL**: `http://localhost:5008/api/v1/admin/projects`
- **Headers**: `Content-Type: application/json`
```json
{
  "name": "PCS Smart Telemetry System",
  "customer_id": 1,
  "description": "IoT telemetry pipeline and dashboard portal",
  "start_date": "2026-08-01",
  "end_date": "2026-11-30",
  "budget": 45000,
  "status": "In Progress"
}
```

---

## 6. Tasks & Workflows (`http://localhost:5008/api/v1/admin/tasks`)

### 6.1 Get Tasks List
- **Method**: `GET`
- **Full URL**: `http://localhost:5008/api/v1/admin/tasks`

---

### 6.2 Create Task
- **Method**: `POST`
- **Full URL**: `http://localhost:5008/api/v1/admin/tasks`
- **Headers**: `Content-Type: application/json`
```json
{
  "title": "Develop OAuth2 SSO Authentication API",
  "description": "Build JWT refresh token rotation and OAuth2 PKCE handler",
  "customer_id": 1,
  "project_id": 1,
  "assigned_to": [1],
  "due_date": "2026-08-15T18:00:00.000Z",
  "priority": "High",
  "status": "Not Started",
  "estimated_hours": 16
}
```

---

### 6.3 Get Workflows
- **Method**: `GET`
- **Full URL**: `http://localhost:5008/api/v1/admin/tasks/workflows`

---

### 6.4 Create Workflow
- **Method**: `POST`
- **Full URL**: `http://localhost:5008/api/v1/admin/tasks/workflows`
- **Headers**: `Content-Type: application/json`
```json
{
  "name": "Q3 Enterprise Security Audit",
  "projectId": 4,
  "description": "Full vulnerability scanning and penetration test workflow",
  "startDate": "2026-08-01",
  "targetCompletion": "2026-08-31",
  "priority": "High",
  "status": "Planning"
}
```

---

## 7. Task Session Tracking (`http://localhost:5008/api/v1/tracking`)

> 💡 **Workflow Note**: Time tracking requires a running session. First call `POST /start` with `taskId`. Once a session is running, call `POST /pause` or `POST /stop`.

### 7.1 Start Task Session Timer
- **Method**: `POST`
- **Full URL**: `http://localhost:5008/api/v1/tracking/start`
- **Headers**: `Content-Type: application/json`
```json
{
  "taskId": 5,
  "platform": "Web"
}
```

---

### 7.2 Pause Task Session Timer
- **Method**: `POST`
- **Full URL**: `http://localhost:5008/api/v1/tracking/pause`
- **Headers**: `Content-Type: application/json`
```json
{
  "reason": "Lunch break"
}
```

---

### 7.3 Stop / Complete Task Session Timer
- **Method**: `POST`
- **Full URL**: `http://localhost:5008/api/v1/tracking/stop`
- **Headers**: `Content-Type: application/json`
```json
{
  "sessionId": 13,
  "endReason": "Task completed successfully",
  "isTaskCompleted": true
}
```

---

## 8. Support Desk & Maintenance (`http://localhost:5008/api/v1/support`)

### 8.1 Get Support Tickets List with Metrics
- **Method**: `GET`
- **Full URL**: `http://localhost:5008/api/v1/support`

---

### 8.2 Raise Support Ticket (`SUP-XXXXXX`)
- **Method**: `POST`
- **Full URL**: `http://localhost:5008/api/v1/support`
- **Headers**: `Content-Type: application/json`
```json
{
  "customer_id": 1,
  "project_id": 1,
  "category": "Bug",
  "priority": "High",
  "assigned_to": 1,
  "reported_by": "John Doe (john@client.com)",
  "title": "Login scanner QR code failure after deployment",
  "description": "Customer scanner camera fails to decode binary QR payload on Android app v3.2.",
  "attachments": []
}
```

---

### 8.3 Update Support Ticket Status
- **Method**: `PUT`
- **Full URL**: `http://localhost:5008/api/v1/support/1/status`
- **Headers**: `Content-Type: application/json`
```json
{
  "status": "In Progress"
}
```

---

### 8.4 Post Ticket Comment or Internal Note
- **Method**: `POST`
- **Full URL**: `http://localhost:5008/api/v1/support/1/comments`
- **Headers**: `Content-Type: application/json`
```json
{
  "comment_text": "Root cause identified: QR decoder binary parser fix applied on staging branch.",
  "is_internal_note": true,
  "attachments": []
}
```

---

### 8.5 Convert Support Ticket to Task
- **Method**: `POST`
- **Full URL**: `http://localhost:5008/api/v1/support/1/convert-to-task`
- **Headers**: `Content-Type: application/json`
```json
{
  "estimated_hours": 6
}
```

---

### 8.6 Convert Support Ticket to Workflow
- **Method**: `POST`
- **Full URL**: `http://localhost:5008/api/v1/support/1/convert-to-workflow`
- **Headers**: `Content-Type: application/json`
```json
{
  "project_id": 1
}
```

---

## 9. Teramind Telemetry & Workstation Monitoring (`http://localhost:5008/api/v1/admin/monitoring`)

### 9.1 Get Executive Health Cards (Online, Offline, Working, Idle, Alerts)
- **Method**: `GET`
- **Full URL**: `http://localhost:5008/api/v1/admin/monitoring/health`
- **Description**: Returns live workstation health metrics cards.

---

### 9.2 Get Workstation Monitoring Table Dashboard
- **Method**: `GET`
- **Full URL**: `http://localhost:5008/api/v1/admin/monitoring/dashboard`
- **Description**: Returns live status dots (Green online, Orange idle, Red offline), employee working hours, idle time, productivity score & PC OS.

---

### 9.3 Get Specific Employee Activity & App Logs
- **Method**: `GET`
- **Full URL**: `http://localhost:5008/api/v1/admin/monitoring/employee/5/logs`
- **Description**: Returns granular app usage and website activity logs for employee ID 5.

---

### 9.4 Get Most Used Desktop Applications Analytics
- **Method**: `GET`
- **Full URL**: `http://localhost:5008/api/v1/admin/monitoring/analytics/apps`

---

### 9.5 Get Top Visited Websites Analytics
- **Method**: `GET`
- **Full URL**: `http://localhost:5008/api/v1/admin/monitoring/analytics/websites`

---

### 9.6 Get Teramind Security & Productivity Alerts Feed
- **Method**: `GET`
- **Full URL**: `http://localhost:5008/api/v1/admin/monitoring/analytics/alerts`

---

### 9.7 Get Teramind Integration Settings
- **Method**: `GET`
- **Full URL**: `http://localhost:5008/api/v1/admin/monitoring/config`

---

### 9.8 Update Teramind Integration Configuration
- **Method**: `POST`
- **Full URL**: `http://localhost:5008/api/v1/admin/monitoring/config`
- **Headers**: `Content-Type: application/json`
```json
{
  "instance_url": "https://company.teramind.co",
  "api_token": "tm_live_token_994812",
  "is_enabled": true,
  "sync_interval_minutes": 5,
  "enable_input_rate": true
}
```

---

### 9.9 Test Live Teramind Connection
- **Method**: `POST`
- **Full URL**: `http://localhost:5008/api/v1/admin/monitoring/test-connection`
- **Headers**: `Content-Type: application/json`
```json
{
  "instance_url": "https://company.teramind.co",
  "api_token": "tm_live_token_994812"
}
```

---

### 9.10 Trigger Manual Immediate Telemetry Sync
- **Method**: `POST`
- **Full URL**: `http://localhost:5008/api/v1/admin/monitoring/sync`
- **Headers**: `Content-Type: application/json`
```json
{}
```
