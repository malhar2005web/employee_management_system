
# 🚀 Enterprise EMS API Documentation
> **Version:** 2.0 (Improved Layout)  
> **Purpose:** This document maps every API endpoint to its backend route, controller, access role, frontend usage, and business purpose.

---

# 📖 How to Read this Document

Every API table follows the same structure:

| Column | Description |
|--------|-------------|
| **Method** | HTTP method (`GET`, `POST`, `PUT`, etc.) |
| **Endpoint** | REST API URL |
| **Controller** | Backend controller function |
| **Access Role** | Who can access the API |
| **Frontend** | HTML/JS page using the API |
| **Purpose** | What the API actually does |

---

# 🗂 Complete Module Index

| # | Module | Base Route | Primary Users |
|---|--------|------------|---------------|
| 1 | Authentication | `/api/v1/auth` | Everyone |
| 2 | Employee Portal | `/api/v1/employee` | Employee |
| 3 | Chat & Communication | `/api/v1/chat` | All Logged-in Users |
| 4 | Task Tracking | `/api/v1/tracking` | Employee/Admin |
| 5 | Task Handover | `/api/v1/task-handover` | Managers |
| 6 | Activity Timeline | `/api/v1/timeline` | Admin |
| 7 | Workload Heatmap | `/api/v1/workload-heatmap` | Admin |
| 8 | Employees & Organization | `/api/v1/admin/employees` | Admin |
| 9 | Customers | `/api/v1/admin/customers` | Admin |
|10 | Projects & Tasks | `/api/v1/admin/projects` | Admin |
|11 | Attendance & Leave | `/api/v1/admin/attendance` | Admin |
|12 | Reports & Settings | `/api/v1/admin/reports` | Admin |
|13 | Support Desk | `/api/v1/support` | Admin |

---

# 🧭 Request Flow

```text
Frontend (HTML / JavaScript / .NET MAUI)
            │
            ▼
      Authentication Middleware
            │
            ▼
          Route Layer
            │
            ▼
      Controller Functions
            │
            ▼
     Business Logic / Services
            │
            ▼
        PostgreSQL Database
```

---

# 🚀 Enterprise EMS API Documentation (Beautified Edition)

> This edition adds a high-level architecture, module map and navigation
> before the detailed API reference.

## 📚 Quick Navigation

  \#   Module              Purpose
  ---- ------------------- ------------------------------
  1    Authentication      Login, JWT & Session
  2    Employee Portal     Attendance, Leave, Tasks
  3    Enterprise Chat     DM, Channels, Mentions
  4    Task Tracking       Timer, Heartbeat, Idle
  5    Task Handover       Transfer, Delegate
  6    Activity Timeline   Audit & Playback
  7    Workload Heatmap    Capacity Intelligence
  8    Admin Modules       Employees, Projects, Reports

------------------------------------------------------------------------

# 🏗 API Architecture

``` text
Frontend (HTML/JS + .NET MAUI)
             │
             ▼
        REST API Layer
             │
 ┌───────────┼───────────┐
 │           │           │
Auth      Employee     Admin
 │           │           │
 └─────── Business Services ───────┐
                                   │
 Task Sessions → Performance → Timeline
                                   │
                      Audit • Notifications
                                   │
                      Workload • SLA • Chat
```

------------------------------------------------------------------------

# 📦 Module Dependency Matrix

  Module           Depends On      Provides To
  ---------------- --------------- ---------------
  Authentication   JWT             Every Module
  Task Sessions    Tasks           Performance
  Performance      Task Sessions   Heatmap
  Timeline         All Modules     Audit
  Audit            Timeline        Compliance
  Workload         Performance     Dashboard
  SLA              Tasks           Notifications
  Chat             Employees       Timeline

------------------------------------------------------------------------

# Enterprise EMS --- Complete API Mapping & Documentation

This document maps all **Backend API Endpoints** to their corresponding
**Backend Route Files**, **Controller Functions**, **Access Roles**, and
**Frontend Usage** (`.js` files & `.html` pages).

------------------------------------------------------------------------

## 🔑 1. Authentication & Session APIs (`/api/v1/auth`)

Backend Route File: `backend/routes/auth.route.js`

  ----------------------------------------------------------------------------------------------------------------------
  Method      Endpoint URL                     Controller         Access Role     Used In Frontend      Action / Purpose
                                               Function                           Files                 
  ----------- -------------------------------- ------------------ --------------- --------------------- ----------------
  `POST`      `/api/v1/auth/login`             `login`            Public          `auth.js`             User
                                                                                                        authentication &
                                                                                                        JWT cookie
                                                                                                        issuance

  `POST`      `/api/v1/auth/logout`            `logout`           Authenticated   `auth.js`,            Clears JWT
                                                                                  `communication.js`    session cookie &
                                                                                                        redirects to
                                                                                                        login

  `POST`      `/api/v1/auth/forgot-password`   `forgotPassword`   Public          `auth.js`             Generates
                                                                                                        password reset
                                                                                                        token & emails
                                                                                                        link

  `POST`      `/api/v1/auth/reset-password`    `resetPassword`    Public          `login.html`          Resets password
                                                                                                        using valid
                                                                                                        token

  `GET`       `/api/v1/auth/me`                `getMe`            Authenticated   `communication.js`,   Fetches
                                                                                  `organization.js`     logged-in user
                                                                                                        profile & role

  `GET`       `/api/v1/auth/authCheck`         `authCheck`        Authenticated   Navigation Guard      Verifies if
                                                                                                        current user
                                                                                                        token is valid
  ----------------------------------------------------------------------------------------------------------------------

------------------------------------------------------------------------

## 👨‍💼 2. Employee Self-Service Portal APIs (`/api/v1/employee`)

Backend Route File: `backend/routes/employeePortal.route.js`

  --------------------------------------------------------------------------------------------------------------------------------------------------------
  Method      Endpoint URL                                   Controller Function          Access Role Used In Frontend Files       Action / Purpose
  ----------- ---------------------------------------------- ---------------------------- ----------- ---------------------------- -----------------------
  `GET`       `/api/v1/employee/dashboard/summary`           `getDashboardSummary`        Employee    `employee-dashboard.html`    Loads KPI metrics
                                                                                                                                   (Attendance %, Pending
                                                                                                                                   Tasks, Leave Balance)

  `GET`       `/api/v1/employee/attendance/status`           `getAttendanceStatus`        Employee    `employee-dashboard.html`    Gets today's clock-in &
                                                                                                                                   clock-out status

  `POST`      `/api/v1/employee/attendance/clock-in`         `clockIn`                    Employee    `employee-dashboard.html`    Punches clock-in time
                                                                                                                                   for today

  `POST`      `/api/v1/employee/attendance/clock-out`        `clockOut`                   Employee    `employee-dashboard.html`    Punches clock-out time
                                                                                                                                   for today

  `POST`      `/api/v1/employee/attendance/correction`       `requestCorrection`          Employee    `employee-attendance.html`   Submits manual
                                                                                                                                   attendance correction
                                                                                                                                   request

  `GET`       `/api/v1/employee/attendance/logs`             `getAttendanceLogs`          Employee    `employee-attendance.html`   Fetches monthly
                                                                                                                                   attendance history log

  `POST`      `/api/v1/employee/reports/self`                `submitSelfReport`           Employee    `employee-dashboard.html`    Submits End-of-Day
                                                                                                                                   (EOD) self work report

  `POST`      `/api/v1/employee/reports/field`               `submitDsrReport`            Employee    `employee-dsr.html`          Submits Daily Status
                                                                                                                                   Report for client
                                                                                                                                   visits

  `GET`       `/api/v1/employee/leaves/balances`             `getLeaveBalances`           Employee    `employee-leave.html`        Fetches remaining leave
                                                                                                                                   balances

  `POST`      `/api/v1/employee/leaves/apply`                `applyLeave`                 Employee    `employee-leave.html`        Submits new leave
                                                                                                                                   application

  `GET`       `/api/v1/employee/leaves/history`              `getLeaveHistory`            Employee    `employee-leave.html`        Loads leave application
                                                                                                                                   history & status

  `GET`       `/api/v1/employee/tasks`                       `getTasks`                   Employee    `employee-tasks.html`        Fetches tasks assigned
                                                                                                                                   to logged-in employee

  `PUT`       `/api/v1/employee/tasks/:id/progress`          `updateTaskProgress`         Employee    `employee-tasks.html`        Updates task progress
                                                                                                                                   percentage

  `GET`       `/api/v1/employee/timesheets`                  `getTimesheets`              Employee    `employee-timesheets.html`   Fetches monthly
                                                                                                                                   timesheet logs

  `POST`      `/api/v1/employee/timesheets`                  `submitTimesheet`            Employee    `employee-timesheets.html`   Submits daily
                                                                                                                                   billable/non-billable
                                                                                                                                   hours

  `GET`       `/api/v1/employee/goals`                       `getGoals`                   Employee    `employee-goals.html`        Loads assigned OKRs &
                                                                                                                                   goals

  `PUT`       `/api/v1/employee/goals/:id/self-assessment`   `submitGoalSelfAssessment`   Employee    `employee-goals.html`        Updates self progress
                                                                                                                                   on goals

  `GET`       `/api/v1/employee/trainings`                   `getTrainings`               Employee    `employee-trainings.html`    Loads assigned learning
                                                                                                                                   modules

  `PUT`       `/api/v1/employee/trainings/:id/complete`      `completeTraining`           Employee    `employee-trainings.html`    Marks training module
                                                                                                                                   completed

  `PUT`       `/api/v1/employee/profile`                     `updateProfile`              Employee /  `admin-profile.js`           Updates personal,
                                                                                          Admin                                    education & bank
                                                                                                                                   details

  `POST`      `/api/v1/employee/change-password`             `changePassword`             Employee /  `admin-profile.js`           Changes account
                                                                                          Admin                                    password

  `GET`       `/api/v1/employee/inbox`                       `getInbox`                   Employee    `employee-inbox.html`        Fetches employee
                                                                                                                                   notifications

  `POST`      `/api/v1/employee/inbox/mark-all-read`         `markAllRead`                Employee    `employee-inbox.js`          Marks all notifications
                                                                                                                                   as read
  --------------------------------------------------------------------------------------------------------------------------------------------------------

------------------------------------------------------------------------

## 💬 3. Real-Time Chat, Channels & File Upload APIs (`/api/v1/chat` & `/api/v1/employee/chat`)

Backend Route Files: `backend/routes/chat.route.js`,
`backend/routes/employeePortal.route.js`

  ---------------------------------------------------------------------------------------------------------------------------------------
  Method      Endpoint URL                              Controller Function    Access Role     Used In Frontend      Action / Purpose
                                                                                               Files                 
  ----------- ----------------------------------------- ---------------------- --------------- --------------------- --------------------
  `GET`       `/api/v1/chat/channels`                   `getChannels`          Authenticated   `communication.js`,   Loads DM list with
                                                                                               `organization.js`     presence, Task
                                                                                                                     Groups & Dept
                                                                                                                     channels

  `GET`       `/api/v1/chat/messages/:channelId`        `getChannelMessages`   Authenticated   `communication.js`,   Fetches channel
                                                                                               `organization.js`     thread messages &
                                                                                                                     file attachments

  `POST`      `/api/v1/chat/messages`                   `sendMessage`          Authenticated   `communication.js`,   Sends group message
                                                                                               `organization.js`     with `@mentions` &
                                                                                                                     files
                                                                                                                     (photos/PDFs/ZIPs)

  `POST`      `/api/v1/chat/channels/:channelId/read`   `markChannelRead`      Authenticated   `communication.js`,   Clears channel
                                                                                               `organization.js`     unread notification
                                                                                                                     badge

  `GET`       `/api/v1/employee/chat/contacts`          `getChatContacts`      Authenticated   `communication.js`,   Fetches active staff
                                                                                               `organization.js`     list for direct
                                                                                                                     messaging

  `GET`       `/api/v1/employee/chat/messages`          `getChatMessages`      Authenticated   `communication.js`,   Loads 1-on-1 direct
                                                                                               `organization.js`     message history

  `POST`      `/api/v1/employee/chat/send`              `sendChatMessage`      Authenticated   `communication.js`,   Sends 1-on-1 DM
                                                                                               `organization.js`     message with
                                                                                                                     optional file
                                                                                                                     attachment
  ---------------------------------------------------------------------------------------------------------------------------------------

------------------------------------------------------------------------

## ⏱️ 4. Task Session Tracking APIs (`/api/v1/tracking`)

Backend Route File: `backend/routes/taskSession.route.js`

  -------------------------------------------------------------------------------------------------------------------------
  Method      Endpoint URL                   Controller Function      Access Role     Used In Frontend Files Action /
                                                                                                             Purpose
  ----------- ------------------------------ ------------------------ --------------- ---------------------- --------------
  `POST`      `/api/v1/tracking/start`       `startTaskSession`       Authenticated   `trackingService.js`   Starts live
                                                                                                             timer session
                                                                                                             on task

  `POST`      `/api/v1/tracking/pause`       `pauseTaskSession`       Authenticated   `trackingService.js`   Pauses running
                                                                                                             task timer

  `POST`      `/api/v1/tracking/stop`        `stopTaskSession`        Authenticated   `trackingService.js`   Stops and
                                                                                                             records
                                                                                                             session
                                                                                                             duration

  `GET`       `/api/v1/tracking/active`      `getActiveTaskSession`   Authenticated   `trackingWidget.js`    Reads active
                                                                                                             running task
                                                                                                             session

  `POST`      `/api/v1/tracking/heartbeat`   `sendHeartbeat`          Authenticated   `trackingService.js`   30s heartbeat
                                                                                                             ping to
                                                                                                             prevent
                                                                                                             auto-pause

  `POST`      `/api/v1/tracking/idle`        `reportIdle`             Authenticated   `trackingService.js`   Logs idle
                                                                                                             detection
                                                                                                             during active
                                                                                                             task

  `GET`       `/api/v1/tracking/analytics`   `getTrackingAnalytics`   Authenticated   Task Dashboards        Time tracking
                                                                                                             analytics &
                                                                                                             productivity
                                                                                                             breakdown

  `GET`       `/api/v1/tracking/history`     `getSessionHistory`      Authenticated   Task Dashboards        Fetches past
                                                                                                             task timer
                                                                                                             session
                                                                                                             history
  -------------------------------------------------------------------------------------------------------------------------

------------------------------------------------------------------------

## 🔄 5. Task Handover, Delegation & Escalation APIs (`/api/v1/task-handover`)

Backend Route File: `backend/routes/taskHandover.route.js`

  ----------------------------------------------------------------------------------------------------------------------------------------
  Method      Endpoint URL                                Controller Function      Access Role     Used In Frontend Files   Action /
                                                                                                                            Purpose
  ----------- ------------------------------------------- ------------------------ --------------- ------------------------ --------------
  `POST`      `/api/v1/task-handover/assign`              `assignTask`             Authenticated   `taskHandoverModal.js`   Primary
                                                                                                                            assignment of
                                                                                                                            task to
                                                                                                                            employee

  `POST`      `/api/v1/task-handover/transfer`            `transferTask`           Authenticated   `taskHandoverModal.js`   Permanent task
                                                                                                                            ownership
                                                                                                                            transfer

  `POST`      `/api/v1/task-handover/delegate`            `delegateTask`           Authenticated   `taskHandoverModal.js`   Temporary
                                                                                                                            delegation
                                                                                                                            with expiry
                                                                                                                            date

  `POST`      `/api/v1/task-handover/return`              `returnTask`             Authenticated   `taskHandoverModal.js`   Manually
                                                                                                                            returns
                                                                                                                            delegated task
                                                                                                                            to owner

  `POST`      `/api/v1/task-handover/escalate`            `escalateTask`           Authenticated   `taskHandoverModal.js`   Escalates
                                                                                                                            blocked task
                                                                                                                            to
                                                                                                                            lead/manager

  `POST`      `/api/v1/task-handover/approvals/respond`   `respondToApproval`      Authenticated   `taskHandoverModal.js`   Approves or
                                                                                                                            rejects
                                                                                                                            pending
                                                                                                                            transfer

  `GET`       `/api/v1/task-handover/approvals/pending`   `getPendingApprovals`    Authenticated   `taskHandoverModal.js`   Pending task
                                                                                                                            handover
                                                                                                                            approval list

  `GET`       `/api/v1/task-handover/:taskId/timeline`    `getTaskTimeline`        Authenticated   `taskHandoverModal.js`   Task ownership
                                                                                                                            transition
                                                                                                                            audit history

  `GET`       `/api/v1/task-handover/analytics`           `getHandoverAnalytics`   Authenticated   Handover Dashboard       Task handover
                                                                                                                            bottleneck
                                                                                                                            analytics
  ----------------------------------------------------------------------------------------------------------------------------------------

------------------------------------------------------------------------

## 📜 6. Activity Timeline & Audit Stream APIs (`/api/v1/timeline`)

Backend Route File: `backend/routes/activityTimeline.route.js`

  ---------------------------------------------------------------------------------------------------------------------------------------------------
  Method      Endpoint URL                                  Controller Function         Access Role     Used In Frontend Files        Action /
                                                                                                                                      Purpose
  ----------- --------------------------------------------- --------------------------- --------------- ----------------------------- ---------------
  `GET`       `/api/v1/timeline/events`                     `getTimelineEvents`         Authenticated   `activityTimelineWidget.js`   Real-time audit
                                                                                                                                      event stream
                                                                                                                                      with filters

  `GET`       `/api/v1/timeline/step-performance/:stepId`   `getStepPerformance`        Authenticated   `activityTimelineWidget.js`   Step execution
                                                                                                                                      duration vs
                                                                                                                                      estimate

  `GET`       `/api/v1/timeline/playback/:taskId`           `getTaskPlaybackTimeline`   Authenticated   `activityTimelineWidget.js`   Chronological
                                                                                                                                      visual playback
                                                                                                                                      of task

  `GET`       `/api/v1/timeline/export`                     `exportTimelineReport`      Authenticated   Timeline UI                   Exports
                                                                                                                                      filtered audit
                                                                                                                                      trail to CSV
  ---------------------------------------------------------------------------------------------------------------------------------------------------

------------------------------------------------------------------------

## 🔥 7. Workload Heatmap & Capacity APIs (`/api/v1/workload-heatmap`)

Backend Route File: `backend/routes/workloadHeatmap.route.js`

  -------------------------------------------------------------------------------------------------------------------------------------
  Method      Endpoint URL                                   Controller Function      Access Role Used In Frontend Files  Action /
                                                                                                                          Purpose
  ----------- ---------------------------------------------- ------------------------ ----------- ----------------------- -------------
  `GET`       `/api/v1/workload-heatmap/heatmap`             `getWorkloadHeatmap`     Admin       `admin-workload.html`   Team capacity
                                                                                                                          utilization
                                                                                                                          heatmap

  `GET`       `/api/v1/workload-heatmap/rebalance-preview`   `previewAutoRebalance`   Admin       `admin-workload.html`   Previews
                                                                                                                          automatic
                                                                                                                          task
                                                                                                                          rebalancing
  -------------------------------------------------------------------------------------------------------------------------------------

------------------------------------------------------------------------

## 🛡️ 8. Admin --- Employees & Organization APIs (`/api/v1/admin/employees` & `/api/v1/organization`)

Backend Route Files: `backend/routes/employee.route.js`,
`backend/routes/organization.route.js`

  -----------------------------------------------------------------------------------------------------------------------------------------
  Method      Endpoint URL                             Controller Function      Access Role     Used In Frontend    Action / Purpose
                                                                                                Files               
  ----------- ---------------------------------------- ------------------------ --------------- ------------------- -----------------------
  `GET`       `/api/v1/admin/employees`                `getEmployees`           Admin           `organization.js`   Loads employee
                                                                                                                    directory table

  `POST`      `/api/v1/admin/employees`                `createEmployee`         Admin           `organization.js`   Adds new employee
                                                                                                                    account

  `PUT`       `/api/v1/admin/employees/:id`            `updateEmployee`         Admin           `organization.js`   Updates employee
                                                                                                                    profile & designation

  `PATCH`     `/api/v1/admin/employees/:id/status`     `toggleEmployeeStatus`   Admin           `organization.js`   Activates/Deactivates
                                                                                                                    employee account

  `GET`       `/api/v1/admin/employees/metadata`       `getDeptsAndDesigs`      Admin           `organization.js`   Populates department &
                                                                                                                    designation dropdowns

  `POST`      `/api/v1/admin/employees/departments`    `createDepartment`       Admin           `organization.js`   Creates new company
                                                                                                                    department

  `POST`      `/api/v1/admin/employees/designations`   `createDesignation`      Admin           `organization.js`   Creates new job
                                                                                                                    designation

  `GET`       `/api/v1/organization/directory`         `getDirectory`           Authenticated   `organization.js`   Searchable employee
                                                                                                                    phonebook directory

  `GET`       `/api/v1/organization/chart`             `getOrgChart`            Authenticated   `organization.js`   Renders organizational
                                                                                                                    hierarchy chart
  -----------------------------------------------------------------------------------------------------------------------------------------

------------------------------------------------------------------------

## 🏢 9. Admin --- Customers & SLA APIs (`/api/v1/admin/customers`)

Backend Route File: `backend/routes/customer.route.js`

  --------------------------------------------------------------------------------------------------------
  Method      Endpoint URL                    Controller         Access Role Used In Frontend Action /
                                              Function                       Files            Purpose
  ----------- ------------------------------- ------------------ ----------- ---------------- ------------
  `GET`       `/api/v1/admin/customers`       `getCustomers`     Admin       `customers.js`   Lists
                                                                                              clients with
                                                                                              search &
                                                                                              industry
                                                                                              filter

  `POST`      `/api/v1/admin/customers`       `createCustomer`   Admin       `customers.js`   Creates new
                                                                                              client
                                                                                              profile with
                                                                                              SLA settings

  `PUT`       `/api/v1/admin/customers/:id`   `updateCustomer`   Admin       `customers.js`   Updates
                                                                                              customer
                                                                                              details &
                                                                                              SLA
                                                                                              guarantees

  `DELETE`    `/api/v1/admin/customers/:id`   `deleteCustomer`   Admin       `customers.js`   Deletes
                                                                                              customer
                                                                                              profile
  --------------------------------------------------------------------------------------------------------

------------------------------------------------------------------------

## ⚡ 10. Admin --- Projects, Workflows & Tasks APIs (`/api/v1/admin/projects` & `/api/v1/admin/tasks`)

Backend Route Files: `backend/routes/project.route.js`,
`backend/routes/task.route.js`

  ---------------------------------------------------------------------------------------------------------------------------------------------------------------
  Method      Endpoint URL                                               Controller Function          Access Role Used In Frontend Files           Action /
                                                                                                                                                   Purpose
  ----------- ---------------------------------------------------------- ---------------------------- ----------- -------------------------------- --------------
  `GET`       `/api/v1/admin/projects`                                   `getProjects`                Admin       `admin-projects.html`            Lists all
                                                                                                                                                   active
                                                                                                                                                   projects

  `POST`      `/api/v1/admin/projects`                                   `createProject`              Admin       `admin-projects.html`            Creates
                                                                                                                                                   project linked
                                                                                                                                                   to customer

  `PUT`       `/api/v1/admin/projects/:id`                               `updateProject`              Admin       `admin-projects.html`            Updates
                                                                                                                                                   project status
                                                                                                                                                   and dates

  `DELETE`    `/api/v1/admin/projects/:id`                               `deleteProject`              Admin       `admin-projects.html`            Deletes
                                                                                                                                                   project record

  `GET`       `/api/v1/admin/tasks/workflows`                            `getWorkflows`               Admin       `admin-dashboard-workflows.js`   Loads active
                                                                                                                                                   project
                                                                                                                                                   workflows &
                                                                                                                                                   task teams

  `POST`      `/api/v1/admin/tasks/workflows`                            `createWorkflow`             Admin       `admin-dashboard-workflows.js`   Creates
                                                                                                                                                   multi-step
                                                                                                                                                   project
                                                                                                                                                   workflow

  `PUT`       `/api/v1/admin/tasks/workflows/:id/status`                 `updateWorkflowStatus`       Admin       `admin-dashboard-workflows.js`   Updates
                                                                                                                                                   workflow
                                                                                                                                                   lifecycle
                                                                                                                                                   stage

  `PUT`       `/api/v1/admin/tasks/workflows/:id/tasks/:taskId/status`   `updateWorkflowTaskStatus`   Admin       `admin-dashboard-workflows.js`   Updates status
                                                                                                                                                   of a specific
                                                                                                                                                   workflow step

  `DELETE`    `/api/v1/admin/tasks/workflows/:id`                        `deleteWorkflow`             Admin       `admin-dashboard-workflows.js`   Deletes
                                                                                                                                                   workflow
                                                                                                                                                   record

  `GET`       `/api/v1/admin/tasks`                                      `getTasks`                   Admin       `tasks.js`                       Lists all
                                                                                                                                                   organization
                                                                                                                                                   tasks

  `POST`      `/api/v1/admin/tasks`                                      `createTask`                 Admin       `tasks.js`                       Creates and
                                                                                                                                                   assigns task

  `PUT`       `/api/v1/admin/tasks/:id`                                  `updateTask`                 Admin       `tasks.js`                       Edits task
                                                                                                                                                   details &
                                                                                                                                                   deadline

  `DELETE`    `/api/v1/admin/tasks/:id`                                  `deleteTask`                 Admin       `tasks.js`                       Deletes task
  ---------------------------------------------------------------------------------------------------------------------------------------------------------------

------------------------------------------------------------------------

## 🕒 11. Admin --- Attendance, Shifts & Leave APIs (`/api/v1/admin/attendance`, `/api/v1/admin/shifts`, `/api/v1/admin/leaves`)

Backend Route Files: `backend/routes/attendance.route.js`,
`backend/routes/shift.route.js`, `backend/routes/leave.route.js`

  -----------------------------------------------------------------------------------------------------------------------------------
  Method      Endpoint URL                             Controller Function        Access Role Used In Frontend      Action / Purpose
                                                                                              Files                 
  ----------- ---------------------------------------- -------------------------- ----------- --------------------- -----------------
  `GET`       `/api/v1/admin/attendance`               `getAttendanceLogs`        Admin       `attendance.js`       Fetches master
                                                                                                                    attendance
                                                                                                                    register by date

  `GET`       `/api/v1/admin/attendance/pending`       `getPendingCorrections`    Admin       `attendance.js`       Loads attendance
                                                                                                                    clock correction
                                                                                                                    requests

  `POST`      `/api/v1/admin/attendance/correction`    `createManualCorrection`   Admin       `attendance.js`       Creates manual
                                                                                                                    clock-in entry
                                                                                                                    for employee

  `POST`      `/api/v1/admin/attendance/approve/:id`   `approveCorrection`        Admin       `attendance.js`       Approves
                                                                                                                    attendance
                                                                                                                    correction
                                                                                                                    request

  `POST`      `/api/v1/admin/attendance/reject/:id`    `rejectCorrection`         Admin       `attendance.js`       Rejects
                                                                                                                    attendance
                                                                                                                    correction
                                                                                                                    request

  `GET`       `/api/v1/admin/shifts`                   `getShiftsData`            Admin       `admin-shifts.html`   Lists master
                                                                                                                    shifts & active
                                                                                                                    roster
                                                                                                                    assignments

  `POST`      `/api/v1/admin/shifts`                   `createShift`              Admin       `admin-shifts.html`   Defines new shift
                                                                                                                    timing

  `DELETE`    `/api/v1/admin/shifts/:id`               `deleteShift`              Admin       `admin-shifts.html`   Deletes master
                                                                                                                    shift

  `POST`      `/api/v1/admin/shifts/assign`            `assignShiftBulk`          Admin       `admin-shifts.html`   Bulk assigns
                                                                                                                    employees to
                                                                                                                    shift schedule

  `DELETE`    `/api/v1/admin/shifts/assign/:id`        `deleteRosterAssignment`   Admin       `admin-shifts.html`   Removes shift
                                                                                                                    assignment from
                                                                                                                    roster

  `GET`       `/api/v1/admin/leaves`                   `getLeaves`                Admin       `attendance.js`       Fetches all leave
                                                                                                                    applications

  `POST`      `/api/v1/admin/leaves`                   `createManualLeave`        Admin       `attendance.js`       Manually grants
                                                                                                                    leave to employee

  `POST`      `/api/v1/admin/leaves/approve/:id`       `approveLeave`             Admin       `attendance.js`       Approves leave
                                                                                                                    request & deducts
                                                                                                                    balance

  `POST`      `/api/v1/admin/leaves/reject/:id`        `rejectLeave`              Admin       `attendance.js`       Rejects leave
                                                                                                                    request

  `DELETE`    `/api/v1/admin/leaves/:id`               `deleteLeave`              Admin       `attendance.js`       Cancels/Deletes leave record
  -----------------------------------------------------------------------------------------------------------------------------------

------------------------------------------------------------------------

## 📊 12. Admin --- Reports, Settings & Communication APIs (`/api/v1/admin/reports`, `/api/v1/admin/settings`, `/api/v1/admin/communication`)

Backend Route Files: `backend/routes/report.route.js`,
`backend/routes/settings.route.js`,
`backend/routes/communication.route.js`

  ---------------------------------------------------------------------------------------------------------------------------
  Method      Endpoint URL                           Controller Function      Access Role Used In Frontend     Action /
                                                                                          Files                Purpose
  ----------- -------------------------------------- ------------------------ ----------- -------------------- --------------
  `GET`       `/api/v1/admin/reports/self-reports`   `getSelfReports`         Admin       `reports.js`         Fetches
                                                                                                               employee EOD
                                                                                                               self work
                                                                                                               reports

  `GET`       `/api/v1/admin/reports/dsr`            `getFieldVisits`         Admin       `reports.js`         Fetches field
                                                                                                               client visit
                                                                                                               DSR logs

  `GET`       `/api/v1/admin/reports/custom`         `generateCustomReport`   Admin       `reports.js`         Exports custom
                                                                                                               CSV/Excel
                                                                                                               reports

  `GET`       `/api/v1/admin/settings`                     `getSettings`              Admin       `settings.js`        Fetches system settings & WhatsApp templates

  `PUT`       `/api/v1/admin/settings`                     `updateSettings`           Admin       `settings.js`        Updates office parameters, policies & WhatsApp templates

  `POST`      `/api/v1/admin/settings/upload-attachment`   `uploadWhatsappAttachment` Admin       `settings.js`        Uploads default WhatsApp template attachment file (PDF, ZIP, DOCX, Images max 25MB)

  `GET`       `/api/v1/admin/communication`                `getAnnouncements`         Admin       `communication.js`   Fetches broadcast announcement history

  `POST`      `/api/v1/admin/communication`                `broadcastNotice`          Admin       `communication.js`   Broadcasts office-wide notice or targeted alert
  ---------------------------------------------------------------------------------------------------------------------------

------------------------------------------------------------------------

## 🎧 13. Support Desk Module APIs (`/api/v1/support`)

Backend Route File: `backend/routes/support.route.js`

| Method | Endpoint URL | Controller Function | Access Role | Used In Frontend Files | Action / Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/support` | `getTickets` | Admin | `support.js` | Fetches support tickets list with metrics & filters |
| `POST` | `/api/v1/support` | `createTicket` | Admin | `support.js` | Creates new support ticket (auto SUP-XXXXXX code, SLA calculation) |
| `GET` | `/api/v1/support/:id` | `getTicketById` | Admin | `support.js` | Fetches ticket workspace details, comments & timeline history |
| `PUT` | `/api/v1/support/:id/status` | `updateTicketStatus` | Admin | `support.js` | Updates ticket status (`In Progress`, `Waiting Customer`, `Resolved`, `Closed`) |
| `PUT` | `/api/v1/support/:id/assign` | `assignTicket` | Admin | `support.js` | Assigns support ticket to employee |
| `POST` | `/api/v1/support/:id/comments` | `addComment` | Admin | `support.js` | Adds public comment or private internal note |
| `POST` | `/api/v1/support/:id/convert-to-task` | `convertToTask` | Admin | `support.js` | Escalates support ticket into a new Task in Workflow/Tasks module |
| `POST` | `/api/v1/support/:id/convert-to-workflow` | `convertToWorkflow` | Admin | `support.js` | Escalates support ticket into a new Workflow |
| `POST` | `/api/v1/support/upload-attachment` | `uploadSupportAttachment` | Admin | `support.js` | Uploads ticket file attachment (screenshots, logs, docs max 25MB) |

------------------------------------------------------------------------

## 📡 14. Workstation Telemetry & Teramind Integration APIs (`/api/v1/admin/monitoring`)

Backend Route File: `backend/routes/monitoring.route.js`

| Method | Endpoint URL | Controller Function | Access Role | Used In Frontend Files | Action / Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/admin/monitoring/health` | `getExecutiveHealthCards` | Admin | `admin-monitoring.js` | Fetches live workstation health metrics (Online/Offline machines, Working, Idle, Alerts) |
| `GET` | `/api/v1/admin/monitoring/dashboard` | `getMonitoringDashboard` | Admin | `admin-monitoring.js` | Fetches workstation telemetry table with live status dots (Green, Orange, Red), working hours & PC OS |
| `GET` | `/api/v1/admin/monitoring/employee/:id/logs` | `getEmployeeActivityLogs` | Admin | `admin-monitoring.js` | Fetches granular desktop app usage & web browsing logs for a specific employee ID |
| `GET` | `/api/v1/admin/monitoring/analytics/apps` | `getAnalyticsApps` | Admin | `admin-monitoring.js` | Fetches top used desktop applications categorized by productive/unproductive time |
| `GET` | `/api/v1/admin/monitoring/analytics/websites` | `getAnalyticsWebsites` | Admin | `admin-monitoring.js` | Fetches top visited URLs and web domain analytics |
| `GET` | `/api/v1/admin/monitoring/analytics/alerts` | `getAnalyticsAlerts` | Admin | `admin-monitoring.js` | Fetches security alerts & data policy violation alerts stream |
| `GET` | `/api/v1/admin/monitoring/config` | `getTeramindConfig` | Admin | `admin-monitoring.js` | Fetches Teramind integration settings (Instance URL, token status, sync interval) |
| `POST` | `/api/v1/admin/monitoring/config` | `updateTeramindConfig` | Admin | `admin-monitoring.js` | Updates Teramind API Instance URL, Token, sync interval & input rate toggle |
| `POST` | `/api/v1/admin/monitoring/test-connection` | `testTeramindConnection` | Admin | `admin-monitoring.js` | Tests live HTTPS connection to Teramind API Instance |
| `POST` | `/api/v1/admin/monitoring/sync` | `triggerManualSync` | Admin | `admin-monitoring.js` | Triggers immediate manual sync with Teramind API to update Postgres telemetry cache |
