import bcryptjs from 'bcryptjs';
import { pool } from './db.js';

const initQuery = `
-- Create Roles Table
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    role_name VARCHAR(50) UNIQUE NOT NULL
);

-- Create Departments Table
CREATE TABLE IF NOT EXISTS departments (
    id SERIAL PRIMARY KEY,
    dept_name VARCHAR(100) UNIQUE NOT NULL
);

-- Create Employees Table
CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    email VARCHAR(150) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    designation VARCHAR(100),
    profile_pic VARCHAR(255) DEFAULT '/default-avatar.png',
    role_id INT REFERENCES roles(id) ON DELETE RESTRICT,
    department_id INT REFERENCES departments(id) ON DELETE SET NULL,
    manager_id INT REFERENCES employees(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Customers Table
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    company_name VARCHAR(150) UNIQUE NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Projects Table
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    project_name VARCHAR(150) NOT NULL,
    description TEXT,
    customer_id INT REFERENCES customers(id) ON DELETE CASCADE,
    start_date DATE,
    end_date DATE,
    status VARCHAR(50) DEFAULT 'In Progress',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Project Members Table
CREATE TABLE IF NOT EXISTS project_members (
    project_id INT REFERENCES projects(id) ON DELETE CASCADE,
    employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
    PRIMARY KEY (project_id, employee_id)
);

-- Create Tasks Table
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    task_name VARCHAR(255) NOT NULL,
    description TEXT,
    project_id INT REFERENCES projects(id) ON DELETE CASCADE,
    assigned_to INT REFERENCES employees(id) ON DELETE SET NULL,
    created_by INT REFERENCES employees(id) ON DELETE SET NULL,
    due_date DATE,
    priority VARCHAR(20) CHECK (priority IN ('Low', 'Medium', 'High')) DEFAULT 'Medium',
    status VARCHAR(50) CHECK (status IN ('To Do', 'In Progress', 'Completed', 'Delayed')) DEFAULT 'To Do',
    progress_percent INT CHECK (progress_percent BETWEEN 0 AND 100) DEFAULT 0,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Attendance Logs Table
CREATE TABLE IF NOT EXISTS attendance_logs (
    id SERIAL PRIMARY KEY,
    employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
    work_date DATE NOT NULL,
    clock_in TIMESTAMP,
    clock_out TIMESTAMP,
    correction_status VARCHAR(50) DEFAULT 'Approved',
    UNIQUE (employee_id, work_date)
);

-- Create Shifts Table
CREATE TABLE IF NOT EXISTS shifts (
    id SERIAL PRIMARY KEY,
    shift_name VARCHAR(50) UNIQUE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL
);

-- Create Shift Assignments Table
CREATE TABLE IF NOT EXISTS shift_assignments (
    id SERIAL PRIMARY KEY,
    employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
    shift_id INT REFERENCES shifts(id) ON DELETE CASCADE,
    schedule_date DATE NOT NULL,
    UNIQUE (employee_id, schedule_date)
);

-- Create Leave Requests Table
CREATE TABLE IF NOT EXISTS leave_requests (
    id SERIAL PRIMARY KEY,
    employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
    leave_type VARCHAR(50) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(50) CHECK (status IN ('Pending', 'Approved', 'Rejected')) DEFAULT 'Pending',
    reason TEXT,
    approved_by INT REFERENCES employees(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Timesheets Table
CREATE TABLE IF NOT EXISTS timesheets (
    id SERIAL PRIMARY KEY,
    employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
    work_date DATE NOT NULL,
    hours NUMERIC(4, 2) NOT NULL,
    description TEXT,
    category VARCHAR(50) CHECK (category IN ('Billable', 'Non-Billable')) DEFAULT 'Billable',
    status VARCHAR(50) CHECK (status IN ('Pending', 'Approved', 'Rejected')) DEFAULT 'Pending',
    approved_by INT REFERENCES employees(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Goals Table
CREATE TABLE IF NOT EXISTS goals (
    id SERIAL PRIMARY KEY,
    employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
    goal_title VARCHAR(255) NOT NULL,
    weightage INT NOT NULL,
    progress_percent INT CHECK (progress_percent BETWEEN 0 AND 100) DEFAULT 0,
    target_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Remote Monitoring Activity Logs Table
CREATE TABLE IF NOT EXISTS monitoring_logs (
    id SERIAL PRIMARY KEY,
    employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
    log_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    active_duration INT DEFAULT 0,
    idle_duration INT DEFAULT 0,
    keyboard_strokes INT DEFAULT 0,
    mouse_clicks INT DEFAULT 0,
    active_window VARCHAR(255)
);

-- Create Screen Monitoring Table
CREATE TABLE IF NOT EXISTS screenshots (
    id SERIAL PRIMARY KEY,
    employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
    captured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    file_path VARCHAR(255) NOT NULL
);

-- Create Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES employees(id) ON DELETE SET NULL,
    action_type VARCHAR(100) NOT NULL,
    details TEXT,
    log_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

const runMigrations = async () => {
    try {
        console.log("Starting database migrations...");
        await pool.query(initQuery);
        console.log("🚀 Tables created or verified successfully.");

        // Insert Default Roles
        await pool.query(`
            INSERT INTO roles (id, role_name) 
            VALUES (1, 'Admin'), (2, 'Employee')
            ON CONFLICT (id) DO NOTHING;
        `);
        console.log("Default roles verified.");

        // Insert Default Department (Optional)
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS departments (id SERIAL PRIMARY KEY, dept_name VARCHAR(100) UNIQUE NOT NULL);
            `);
            await pool.query(`
                INSERT INTO departments (id, dept_name) 
                VALUES (1, 'Administration'), (2, 'Engineering')
                ON CONFLICT (id) DO NOTHING;
            `);
            console.log("Default departments verified.");
        } catch (depErr) {
            console.log("Departments table skipped or already managed.");
        }

        // Check if admin already exists
        try {
            const adminCheck = await pool.query("SELECT * FROM employees WHERE company_email = $1", ["admin@ems.com"]);
            if (adminCheck.rows.length === 0) {
                const salt = await bcryptjs.genSalt(10);
                const hashedPassword = await bcryptjs.hash("adminPassword123", salt);

                await pool.query(`
                    INSERT INTO employees (employee_code, company_email, password_hash, full_name, designation, role, status)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                `, ["EMP000", "admin@ems.com", hashedPassword, "System Administrator", "Administrator", "admin", "active"]);
                console.log("🚀 Default admin account verified/created: admin@ems.com / adminPassword123");
            } else {
                console.log("Admin account already exists.");
            }
        } catch (adminErr) {
            console.log("Admin seed check skipped/already initialized.");
        }

        // Execute PCS Attendance Schema & Procedures Migrations
        console.log("Starting PCS Attendance Migrations...");
        const fs = await import('fs');
        const path = await import('path');
        const { fileURLToPath } = await import('url');
        const __dirname = path.dirname(fileURLToPath(import.meta.url));

        const schemaMigrationSql = fs.readFileSync(path.join(__dirname, 'migrations', 'pcs_attendance_migration.sql'), 'utf8');
        await pool.query(schemaMigrationSql);
        console.log("✅ PCS Attendance Schema & Views Migration verified.");

        const procsMigrationSql = fs.readFileSync(path.join(__dirname, 'migrations', 'pcs_procedures_migration.sql'), 'utf8');
        await pool.query(procsMigrationSql);
        console.log("✅ PCS Attendance PL/pgSQL Business Engine verified.");

        console.log("Migration run completed successfully.");
    } catch (error) {
        console.error("❌ Migration error:", error.message);
    } finally {
        await pool.end();
    }
};

runMigrations();
