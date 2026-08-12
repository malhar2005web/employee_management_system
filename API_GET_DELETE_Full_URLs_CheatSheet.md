# 🔍 Complete Postman Ready GET & DELETE APIs Cheat Sheet (Full URLs & Query Params)

Base Server URL: **`http://localhost:5008`**

Every endpoint below contains the full, complete URL ready to copy directly into Postman, cURL, or ThunderClient.

---

## 📑 Table of Contents
1. [Authentication & Profile (`/api/v1/auth`)](#1-authentication--profile-apiv1auth)
2. [Organization, Departments & Leaves (`/api/v1/organization`)](#2-organization-departments--leaves-apiv1organization)
3. [Employee Directory (`/api/v1/admin/employees`)](#3-employee-directory-apiv1adminemployees)
4. [Customer Management (`/api/v1/admin/customers`)](#4-customer-management-apiv1admincustomers)
5. [Project Management (`/api/v1/admin/projects`)](#5-project-management-apiv1adminprojects)
6. [Tasks & Workflows (`/api/v1/admin/tasks`)](#6-tasks--workflows-apiv1admintasks)
7. [Attendance, Workload & Analytics (`/api/v1/admin/attendance`, `/api/v1/tracking`)](#7-attendance-workload--analytics-apiv1adminattendance-apiv1tracking)
8. [Task Delegation & Handover (`/api/v1/task-handover`)](#8-task-delegation--handover-apiv1task-handover)
9. [Chat & Communication (`/api/v1/chat`, `/api/v1/admin/communication`)](#9-chat--communication-apiv1chat-apiv1admincommunication)
10. [Deletion & Offboarding System (`/api/v1/admin/deletion`)](#10-deletion--offboarding-system-apiv1admindeletion)
11. [Settings & System Parameters (`/api/v1/admin/settings`)](#11-settings--system-parameters-apiv1adminsettings)
12. [Support Desk & Post-Delivery Maintenance (`/api/v1/support`)](#12-support-desk--post-delivery-maintenance-apiv1support)
13. [DELETE Endpoints](#13-delete-endpoints)

---

## 1. Authentication & Profile (`http://localhost:5008/api/v1/auth`)

### 1.1 Get Current User Session Details
- **Method**: `GET`
- **Full URL**: `http://localhost:5008/api/v1/auth/me`
- **Description**: Returns profile details, permissions & role of the currently logged-in user.

---

## 2. Organization, Departments & Leaves (`http://localhost:5008/api/v1/organization`)

### 2.1 List All Departments
- **Method**: `GET`
- **Full URL**: `http://localhost:5008/api/v1/organization/departments`
- **Description**: Returns all company departments and head employee details.

---

### 2.2 List Shift Schedules
- **Method**: `GET`
- **Full URL**: `http://localhost:5008/api/v1/organization/shifts`
- **Description**: Returns configured work shifts, timing, and grace periods.

---

### 2.3 List Leave Applications (Filterable)
- **Method**: `GET`
- **Full URL**: `http://localhost:5008/api/v1/organization/leaves`
- **With Status Filter**: `http://localhost:5008/api/v1/organization/leaves?status=Pending`
- **Description**: Fetches leave requests with optional status filtering (`Pending`, `Approved`, `Rejected`).

---

## 3. Employee Directory (`http://localhost:5008/api/v1/admin/employees`)

### 3.1 List All Employees (Filterable)
- **Method**: `GET`
- **Full URL**: `http://localhost:5008/api/v1/admin/employees`
- **Search Query**: `http://localhost:5008/api/v1/admin/employees?search=Malhar`
- **Department Filter**: `http://localhost:5008/api/v1/admin/employees?department_id=1`
- **Combined Filter**: `http://localhost:5008/api/v1/admin/employees?search=Engineer&department_id=1`

---

### 3.2 Get Single Employee Profile by ID
- **Method**: `GET`
- **Full URL**: `http://localhost:5008/api/v1/admin/employees/2`
- **Description**: Returns full employee details, department, shift, emergency contact & leave balances.

---

## 4. Customer Management (`http://localhost:5008/api/v1/admin/customers`)

### 4.1 List All Customer Accounts (With Plant/Billing Branches)
- **Method**: `GET`
- **Full URL**: `http://localhost:5008/api/v1/admin/customers`
- **Search Query**: `http://localhost:5008/api/v1/admin/customers?search=Apex`
- **Industry Filter**: `http://localhost:5008/api/v1/admin/customers?industry=Manufacturing`

---

### 4.2 Get Single Customer Details & Projects
- **Method**: `GET`
- **Full URL**: `http://localhost:5008/api/v1/admin/customers/12`
- **Description**: Returns customer profile, all branches, primary contacts & associated projects.

---

## 5. Project Management (`http://localhost:5008/api/v1/admin/projects`)

### 5.1 List All Projects
- **Method**: `GET`
- **Full URL**: `http://localhost:5008/api/v1/admin/projects`
- **Search Query**: `http://localhost:5008/api/v1/admin/projects?search=Telemetry`
- **Status Filter**: `http://localhost:5008/api/v1/admin/projects?status=In%20Progress`
- **Customer Filter**: `http://localhost:5008/api/v1/admin/projects?customer_id=12`

---

### 5.2 Get Single Project Details
- **Method**: `GET`
- **Full URL**: `http://localhost:5008/api/v1/admin/projects/4`

---

## 6. Tasks & Workflows (`http://localhost:5008/api/v1/admin/tasks`)

### 6.1 List All Tasks (Filterable)
- **Method**: `GET`
- **Full URL**: `http://localhost:5008/api/v1/admin/tasks`
- **Priority Filter**: `http://localhost:5008/api/v1/admin/tasks?priority=High`
- **Status Filter**: `http://localhost:5008/api/v1/admin/tasks?status=In%20Progress`
- **Combined Filter**: `http://localhost:5008/api/v1/admin/tasks?search=OAuth&status=In%20Progress&priority=High`

---

### 6.2 List Workflows with Nested Tasks
- **Method**: `GET`
- **Full URL**: `http://localhost:5008/api/v1/admin/tasks/workflow`

---

### 6.3 Get Single Task Details
- **Method**: `GET`
- **Full URL**: `http://localhost:5008/api/v1/admin/tasks/105`

---

## 7. Attendance, Workload & Analytics (`http://localhost:5008/api/v1/admin/attendance`, `http://localhost:5008/api/v1/tracking`)

### 7.1 List Employee Attendance Logs
- **Method**: `GET`
- **Full URL**: `http://localhost:5008/api/v1/admin/attendance`
- **Date Filter**: `http://localhost:5008/api/v1/admin/attendance?date=2026-07-27`

---

### 7.2 Workload Heatmap Matrix
- **Method**: `GET`
- **Full URL**: `http://localhost:5008/api/v1/workload-heatmap`
- **Description**: Returns employee workload distribution, active task counts & capacity percentages.

---

### 7.3 Get Active Task Timer Session
- **Method**: `GET`
- **Full URL**: `http://localhost:5008/api/v1/tracking/active`

---

### 7.4 Get Task Session History
- **Method**: `GET`
- **Full URL**: `http://localhost:5008/api/v1/tracking/history`

---

### 7.5 Get Time Tracking Analytics
- **Method**: `GET`
- **Full URL**: `http://localhost:5008/api/v1/tracking/analytics`

---

## 8. Task Delegation & Handover (`http://localhost:5008/api/v1/task-handover`)

### 8.1 Get My Task Delegations
- **Method**: `GET`
- **Full URL**: `http://localhost:5008/api/v1/task-handover/my-delegations`

---

### 8.2 Get Pending Manager Delegation Approvals
- **Method**: `GET`
- **Full URL**: `http://localhost:5008/api/v1/task-handover/approvals`

---

## 9. Chat & Communication (`http://localhost:5008/api/v1/chat`, `http://localhost:5008/api/v1/admin/communication`)

### 9.1 List Chat Channels
- **Method**: `GET`
- **Full URL**: `http://localhost:5008/api/v1/chat/channels`

---

### 9.2 Get Messages for Channel
- **Method**: `GET`
- **Full URL**: `http://localhost:5008/api/v1/chat/messages/3`

---

### 9.3 Get Office Announcements List
- **Method**: `GET`
- **Full URL**: `http://localhost:5008/api/v1/admin/communication`

---

## 10. Deletion & Offboarding System (`http://localhost:5008/api/v1/admin/deletion`)

### 10.1 List Pending Deletion Requests
- **Method**: `GET`
- **Full URL**: `http://localhost:5008/api/v1/admin/deletion/requests`

---

## 11. Settings & System Parameters (`http://localhost:5008/api/v1/admin/settings`)

### 11.1 Get System Settings & WhatsApp Templates
- **Method**: `GET`
- **Full URL**: `http://localhost:5008/api/v1/admin/settings`
- **Description**: Returns office details, working hours, IP whitelist & automated WhatsApp message templates.

---

## 12. Support Desk & Post-Delivery Maintenance (`http://localhost:5008/api/v1/support`)

### 12.1 List Support Tickets (With Real-Time Metrics & Multi-Filters)
- **Method**: `GET`
- **Full Default URL**: `http://localhost:5008/api/v1/support`
- **Search Query**: `http://localhost:5008/api/v1/support?search=SUP-000101`
- **Customer Filter**: `http://localhost:5008/api/v1/support?customer_id=12`
- **Category Filter**: `http://localhost:5008/api/v1/support?category=Bug`
- **Priority Filter**: `http://localhost:5008/api/v1/support?priority=Critical`
- **Status Filter**: `http://localhost:5008/api/v1/support?status=Open`
- **Combined Filter**: `http://localhost:5008/api/v1/support?search=scanner&customer_id=12&category=Bug&priority=High&status=Open`

---

### 12.2 Get Single Ticket Workspace (Details, Public Comments, Internal Notes & Timeline Stream)
- **Method**: `GET`
- **By Ticket ID**: `http://localhost:5008/api/v1/support/1`
- **By Ticket Code**: `http://localhost:5008/api/v1/support/SUP-000101`

---

## 13. Workstation Telemetry & Teramind Integration (`http://localhost:5008/api/v1/admin/monitoring`)

### 13.1 Get Executive Health Cards (Online, Offline, Working, Idle, Alerts)
- **Method**: `GET`
- **Full URL**: `http://localhost:5008/api/v1/admin/monitoring/health`
- **Description**: Returns live workstation health metrics cards.

---

### 13.2 Get Workstation Monitoring Table Dashboard
- **Method**: `GET`
- **Full URL**: `http://localhost:5008/api/v1/admin/monitoring/dashboard`
- **Description**: Returns live status dots (Green online, Orange idle, Red offline), employee working hours, idle time, productivity score & PC OS.

---

### 13.3 Get Specific Employee Activity & App Logs
- **Method**: `GET`
- **Full URL**: `http://localhost:5008/api/v1/admin/monitoring/employee/5/logs`
- **Description**: Returns granular app usage and website activity logs for employee ID 5.

---

### 13.4 Get Most Used Desktop Applications Analytics
- **Method**: `GET`
- **Full URL**: `http://localhost:5008/api/v1/admin/monitoring/analytics/apps`

---

### 13.5 Get Top Visited Websites Analytics
- **Method**: `GET`
- **Full URL**: `http://localhost:5008/api/v1/admin/monitoring/analytics/websites`

---

### 13.6 Get Teramind Security & Productivity Alerts Feed
- **Method**: `GET`
- **Full URL**: `http://localhost:5008/api/v1/admin/monitoring/analytics/alerts`

---

### 13.7 Get Teramind Integration Settings
- **Method**: `GET`
- **Full URL**: `http://localhost:5008/api/v1/admin/monitoring/config`

---

## 14. DELETE Endpoints

### 14.1 Delete Employee
- **Method**: `DELETE`
- **Full URL**: `http://localhost:5008/api/v1/admin/employees/5`

---

### 14.2 Delete Customer
- **Method**: `DELETE`
- **Full URL**: `http://localhost:5008/api/v1/admin/customers/12`

---

### 14.3 Delete Project
- **Method**: `DELETE`
- **Full URL**: `http://localhost:5008/api/v1/admin/projects/4`

---

### 14.4 Delete Task
- **Method**: `DELETE`
- **Full URL**: `http://localhost:5008/api/v1/admin/tasks/105`

---

### 14.5 Delete Workflow
- **Method**: `DELETE`
- **Full URL**: `http://localhost:5008/api/v1/admin/tasks/workflow/2`
