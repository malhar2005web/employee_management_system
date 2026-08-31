import { pool } from './db.js';

export async function runMigrations() {
    const client = await pool.connect();

    // ── STEP 1: Create all missing tables ─────────────────────────────────────────
    try {
        console.log('🔧 Running Phase 6 migrations...');

        await client.query(`
            CREATE TABLE IF NOT EXISTS leave_types (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL UNIQUE,
                code VARCHAR(10),
                default_balance NUMERIC(5,1) NOT NULL DEFAULT 15,
                carry_forward BOOLEAN DEFAULT false,
                max_carry_forward NUMERIC(5,1) DEFAULT 0,
                description TEXT,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS leave_balances (
                id SERIAL PRIMARY KEY,
                employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
                leave_type_id INT NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
                balance NUMERIC(5,1) DEFAULT 0,
                used NUMERIC(5,1) DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(employee_id, leave_type_id)
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS attendance_logs (
                id SERIAL PRIMARY KEY,
                employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
                work_date DATE NOT NULL,
                clock_in TIMESTAMP,
                clock_out TIMESTAMP,
                correction_status VARCHAR(20) DEFAULT 'Pending',
                approved_by INT REFERENCES employees(id),
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS self_reports (
                id SERIAL PRIMARY KEY,
                employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
                date DATE NOT NULL DEFAULT CURRENT_DATE,
                todays_work TEXT,
                tomorrows_plan TEXT,
                current_issues TEXT,
                work_capacity INT DEFAULT 100,
                percentage_complete INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS dsr_reports (
                id SERIAL PRIMARY KEY,
                employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
                customer_name VARCHAR(200) NOT NULL,
                office_address TEXT,
                site_name VARCHAR(200),
                contact_person VARCHAR(200),
                contact_no VARCHAR(30),
                visited_for TEXT,
                followup TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS employee_shifts (
                id SERIAL PRIMARY KEY,
                employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
                shift_id INT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
                effective_from DATE DEFAULT CURRENT_DATE,
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(employee_id, shift_id)
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                title VARCHAR(300) NOT NULL,
                message TEXT,
                type VARCHAR(50) DEFAULT 'Info',
                recipient_id INT REFERENCES employees(id) ON DELETE CASCADE,
                is_read BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS password_resets (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) NOT NULL,
                token VARCHAR(255) NOT NULL UNIQUE,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // Ensure shifts table columns
        await client.query(`
            ALTER TABLE shifts ADD COLUMN IF NOT EXISTS name VARCHAR(100);
            ALTER TABLE shifts ADD COLUMN IF NOT EXISTS code VARCHAR(50);
            ALTER TABLE shifts ADD COLUMN IF NOT EXISTS grace_period INT DEFAULT 15;
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS activity_logs (
                id SERIAL PRIMARY KEY,
                employee_id INT REFERENCES employees(id) ON DELETE SET NULL,
                action VARCHAR(300),
                module VARCHAR(100),
                details JSONB,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS workflows (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                customer_id INT REFERENCES customers(id) ON DELETE SET NULL,
                branch_name VARCHAR(150),
                project_id INT REFERENCES projects(id) ON DELETE SET NULL,
                account_manager_id INT REFERENCES employees(id) ON DELETE SET NULL,
                description TEXT,
                start_date DATE,
                target_completion DATE,
                priority VARCHAR(30) DEFAULT 'Medium',
                status VARCHAR(50) DEFAULT 'Planning',
                created_by INT REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS workflow_teams (
                id SERIAL PRIMARY KEY,
                workflow_id INT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
                name VARCHAR(180) NOT NULL,
                lead_id INT REFERENCES employees(id) ON DELETE SET NULL,
                member_ids INT[] DEFAULT '{}',
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS workflow_tasks (
                id SERIAL PRIMARY KEY,
                workflow_id INT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
                step_order INT NOT NULL DEFAULT 1,
                name VARCHAR(255) NOT NULL,
                assigned_team_id INT REFERENCES workflow_teams(id) ON DELETE SET NULL,
                assigned_employee_ids INT[] DEFAULT '{}',
                estimated_hours NUMERIC(6,2),
                deadline DATE,
                status VARCHAR(50) DEFAULT 'Not Started',
                priority VARCHAR(30) DEFAULT 'Medium',
                dependencies INT[] DEFAULT '{}',
                completion_percentage INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // Alter employees table to add additional profile fields
        await client.query(`
            ALTER TABLE employees ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
            ALTER TABLE employees ADD COLUMN IF NOT EXISTS dob DATE;
            ALTER TABLE employees ADD COLUMN IF NOT EXISTS citizenship VARCHAR(100);
            ALTER TABLE employees ADD COLUMN IF NOT EXISTS address TEXT;
            ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_name VARCHAR(200);
            ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_relationship VARCHAR(100);
            ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_phone VARCHAR(50);
            ALTER TABLE employees ADD COLUMN IF NOT EXISTS degree VARCHAR(200);
            ALTER TABLE employees ADD COLUMN IF NOT EXISTS linkedin VARCHAR(200);
            ALTER TABLE employees ADD COLUMN IF NOT EXISTS gender VARCHAR(20) DEFAULT 'Female';
            ALTER TABLE employees ADD COLUMN IF NOT EXISTS edu_10th_school TEXT;
            ALTER TABLE employees ADD COLUMN IF NOT EXISTS edu_10th_marks NUMERIC;
            ALTER TABLE employees ADD COLUMN IF NOT EXISTS edu_12th_college TEXT;
            ALTER TABLE employees ADD COLUMN IF NOT EXISTS edu_12th_marks NUMERIC;
            ALTER TABLE employees ADD COLUMN IF NOT EXISTS edu_grad_college TEXT;
            ALTER TABLE employees ADD COLUMN IF NOT EXISTS edu_grad_cgpa NUMERIC;
            ALTER TABLE employees ADD COLUMN IF NOT EXISTS certifications JSONB DEFAULT '[]'::jsonb;
            ALTER TABLE employees ADD COLUMN IF NOT EXISTS perm_address TEXT;
            ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_name VARCHAR(150);
            ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_acc_no VARCHAR(100);
            ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_ifsc VARCHAR(50);
            ALTER TABLE employees ADD COLUMN IF NOT EXISTS doc_cv JSONB DEFAULT '{}'::jsonb;
            ALTER TABLE employees ADD COLUMN IF NOT EXISTS doc_offer_letter JSONB DEFAULT '{}'::jsonb;
            ALTER TABLE employees ADD COLUMN IF NOT EXISTS doc_adhar_card JSONB DEFAULT '{}'::jsonb;
            ALTER TABLE employees ADD COLUMN IF NOT EXISTS doc_pan_card JSONB DEFAULT '{}'::jsonb;
            ALTER TABLE employees ADD COLUMN IF NOT EXISTS profile_picture TEXT;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture TEXT;
            ALTER TABLE customers ADD COLUMN IF NOT EXISTS gst_no VARCHAR(100);
            ALTER TABLE customers ADD COLUMN IF NOT EXISTS branches JSONB DEFAULT '[]'::jsonb;
            ALTER TABLE customers ADD COLUMN IF NOT EXISTS deadline DATE;
            ALTER TABLE customers ADD COLUMN IF NOT EXISTS industry VARCHAR(100);
            ALTER TABLE customers ADD COLUMN IF NOT EXISTS sla_type VARCHAR(50);
            ALTER TABLE customers ADD COLUMN IF NOT EXISTS sla_response_time VARCHAR(50);
            ALTER TABLE customers ADD COLUMN IF NOT EXISTS sla_resolution_time VARCHAR(50);
            ALTER TABLE customers ADD COLUMN IF NOT EXISTS contract_start_date DATE;
            ALTER TABLE customers ADD COLUMN IF NOT EXISTS contract_end_date DATE;
            ALTER TABLE customers ADD COLUMN IF NOT EXISTS assigned_employees JSONB DEFAULT '[]'::jsonb;
            ALTER TABLE projects ADD COLUMN IF NOT EXISTS customer_id INT REFERENCES customers(id) ON DELETE CASCADE;
            ALTER TABLE projects ADD COLUMN IF NOT EXISTS branch_name VARCHAR(150);
            ALTER TABLE projects ADD COLUMN IF NOT EXISTS account_manager_id INT REFERENCES employees(id) ON DELETE SET NULL;
            ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_name_key;
            ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_manager_id INT REFERENCES employees(id) ON DELETE SET NULL;
            ALTER TABLE workflow_tasks ADD COLUMN IF NOT EXISTS status_history JSONB DEFAULT '[]'::jsonb;
        `);

        // ── Phase 7: Task Session Tracking Engine Tables ─────────────────────────────
        await client.query(`
            CREATE TABLE IF NOT EXISTS task_sessions (
                id SERIAL PRIMARY KEY,
                employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
                task_id INT REFERENCES tasks(id) ON DELETE SET NULL,
                workflow_task_id INT REFERENCES workflow_tasks(id) ON DELETE SET NULL,
                project_id INT REFERENCES projects(id) ON DELETE SET NULL,
                subtask_id VARCHAR(100),
                started_at TIMESTAMP NOT NULL DEFAULT NOW(),
                ended_at TIMESTAMP,
                duration_seconds INT DEFAULT 0,
                status VARCHAR(30) NOT NULL DEFAULT 'Running',
                end_reason VARCHAR(100),
                platform VARCHAR(50) DEFAULT 'Web',
                last_heartbeat_at TIMESTAMP DEFAULT NOW(),
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );

            CREATE UNIQUE INDEX IF NOT EXISTS idx_one_running_session_per_employee 
            ON task_sessions (employee_id) WHERE status = 'Running';

            CREATE TABLE IF NOT EXISTS task_session_events (
                id SERIAL PRIMARY KEY,
                session_id INT NOT NULL REFERENCES task_sessions(id) ON DELETE CASCADE,
                employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
                event_type VARCHAR(50) NOT NULL,
                reason VARCHAR(100),
                details JSONB DEFAULT '{}'::jsonb,
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS heartbeat_logs (
                id SERIAL PRIMARY KEY,
                session_id INT REFERENCES task_sessions(id) ON DELETE CASCADE,
                employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
                ping_time TIMESTAMP DEFAULT NOW(),
                platform VARCHAR(50),
                active_window VARCHAR(255)
            );

            CREATE TABLE IF NOT EXISTS idle_logs (
                id SERIAL PRIMARY KEY,
                session_id INT REFERENCES task_sessions(id) ON DELETE CASCADE,
                employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
                idle_seconds INT NOT NULL,
                detected_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS task_session_configs (
                id SERIAL PRIMARY KEY,
                heartbeat_timeout_seconds INT DEFAULT 120,
                idle_threshold_seconds INT DEFAULT 300,
                auto_pause_enabled BOOLEAN DEFAULT true
            );

            -- ── Phase 8: Task Assignment & Handover Engine ────────────────────────────────
            CREATE TABLE IF NOT EXISTS task_assignments (
                id SERIAL PRIMARY KEY,
                task_id INT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                assignee_type VARCHAR(30) NOT NULL DEFAULT 'Employee',
                assignee_id INT NOT NULL,
                role VARCHAR(30) NOT NULL DEFAULT 'Primary',
                assigned_by INT NOT NULL REFERENCES employees(id),
                assigned_at TIMESTAMP DEFAULT NOW(),
                unassigned_at TIMESTAMP,
                is_active BOOLEAN DEFAULT true
            );

            -- Immutable Audit History Table (ONLY INSERT, never update/delete)
            CREATE TABLE IF NOT EXISTS task_assignment_history (
                id SERIAL PRIMARY KEY,
                task_id INT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                assignee_type VARCHAR(30) NOT NULL,
                assignee_id INT NOT NULL,
                role VARCHAR(30) NOT NULL,
                action VARCHAR(50) NOT NULL,
                old_owner_id INT REFERENCES employees(id),
                new_owner_id INT REFERENCES employees(id),
                reason_code VARCHAR(50),
                comments TEXT,
                performed_by INT NOT NULL REFERENCES employees(id),
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS task_transfers (
                id SERIAL PRIMARY KEY,
                task_id INT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                transfer_type VARCHAR(40) NOT NULL,
                from_employee_id INT REFERENCES employees(id),
                to_employee_id INT REFERENCES employees(id),
                to_team_id INT,
                to_department_id INT,
                reason_code VARCHAR(50) NOT NULL,
                reason_description TEXT NOT NULL,
                status VARCHAR(30) DEFAULT 'Approved',
                requires_approval BOOLEAN DEFAULT false,
                requested_by INT NOT NULL REFERENCES employees(id),
                expiry_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS task_transfer_attachments (
                id SERIAL PRIMARY KEY,
                transfer_id INT NOT NULL REFERENCES task_transfers(id) ON DELETE CASCADE,
                file_name VARCHAR(255) NOT NULL,
                file_path TEXT NOT NULL,
                file_size INT,
                mime_type VARCHAR(100),
                uploaded_by INT NOT NULL REFERENCES employees(id),
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS task_transfer_approvals (
                id SERIAL PRIMARY KEY,
                transfer_id INT NOT NULL REFERENCES task_transfers(id) ON DELETE CASCADE,
                approver_id INT NOT NULL REFERENCES employees(id),
                approver_role VARCHAR(50) NOT NULL,
                approval_order INT NOT NULL DEFAULT 1,
                status VARCHAR(30) DEFAULT 'Pending',
                comments TEXT,
                responded_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS task_escalations (
                id SERIAL PRIMARY KEY,
                task_id INT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                escalation_type VARCHAR(40) NOT NULL,
                triggered_by VARCHAR(30) NOT NULL,
                old_priority VARCHAR(20),
                new_priority VARCHAR(20),
                escalated_to_id INT REFERENCES employees(id),
                reason TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS task_followers (
                id SERIAL PRIMARY KEY,
                task_id INT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
                subscribed_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(task_id, employee_id)
            );

            -- ── PHASE 9: ACTIVITY TIMELINE, AUDIT TRAIL & PERFORMANCE INTELLIGENCE ENGINE ──
            CREATE TABLE IF NOT EXISTS activity_events (
                event_id VARCHAR(64) PRIMARY KEY,
                correlation_id VARCHAR(64) NOT NULL,
                event_type VARCHAR(100) NOT NULL,
                category VARCHAR(50) NOT NULL DEFAULT 'Work',
                module VARCHAR(50) NOT NULL,
                severity VARCHAR(20) DEFAULT 'INFO',
                entity_type VARCHAR(50) NOT NULL,
                entity_id INT,
                entity_name VARCHAR(255),
                action VARCHAR(100) NOT NULL,
                performed_by INT REFERENCES employees(id),
                old_value TEXT,
                new_value TEXT,
                reason TEXT,
                impact_type VARCHAR(50) DEFAULT 'Time',
                impact_description TEXT,
                metadata JSONB,
                ip_address VARCHAR(45),
                platform VARCHAR(50),
                browser VARCHAR(100),
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS performance_snapshots (
                id SERIAL PRIMARY KEY,
                entity_type VARCHAR(50) NOT NULL,
                entity_id INT NOT NULL,
                snapshot_type VARCHAR(20) DEFAULT 'Daily',
                estimated_seconds INT DEFAULT 0,
                actual_seconds INT DEFAULT 0,
                variance_seconds INT DEFAULT 0,
                efficiency_percentage NUMERIC(8,2) DEFAULT 100.00,
                schedule_accuracy_percentage NUMERIC(8,2) DEFAULT 100.00,
                risk_level VARCHAR(20) DEFAULT 'Low',
                projected_seconds INT DEFAULT 0,
                snapshot_date DATE DEFAULT CURRENT_DATE,
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE INDEX IF NOT EXISTS idx_activity_events_corr ON activity_events (correlation_id);
            CREATE INDEX IF NOT EXISTS idx_activity_events_entity ON activity_events (entity_type, entity_id);
            CREATE INDEX IF NOT EXISTS idx_activity_events_category ON activity_events (category);
            CREATE INDEX IF NOT EXISTS idx_activity_events_module ON activity_events (module);
            CREATE INDEX IF NOT EXISTS idx_activity_events_performed ON activity_events (performed_by);
            CREATE INDEX IF NOT EXISTS idx_activity_events_created ON activity_events (created_at DESC);

            -- ── PHASE 10: CHAT CHANNELS, SLA POLICIES & CAPACITY INTELLIGENCE ENGINE ──
            CREATE TABLE IF NOT EXISTS chat_channels (
                id SERIAL PRIMARY KEY,
                channel_type VARCHAR(30) NOT NULL,
                name VARCHAR(100) NOT NULL,
                task_id INT REFERENCES tasks(id) ON DELETE CASCADE,
                project_id INT REFERENCES projects(id) ON DELETE CASCADE,
                department_id INT REFERENCES departments(id) ON DELETE CASCADE,
                customer_id INT REFERENCES customers(id) ON DELETE CASCADE,
                is_pinned BOOLEAN DEFAULT false,
                pinned_message_id INT,
                created_at TIMESTAMP DEFAULT NOW()
            );

            ALTER TABLE chat_channels ADD COLUMN IF NOT EXISTS customer_id INT REFERENCES customers(id) ON DELETE CASCADE;

            CREATE TABLE IF NOT EXISTS chat_messages (
                id SERIAL PRIMARY KEY,
                channel_id INT NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
                sender_id INT NOT NULL REFERENCES employees(id),
                message_type VARCHAR(30) DEFAULT 'TEXT',
                reply_to_message_id INT REFERENCES chat_messages(id) ON DELETE SET NULL,
                message_text TEXT NOT NULL,
                mentions JSONB DEFAULT '[]'::jsonb,
                attachments JSONB DEFAULT '[]'::jsonb,
                seen_by JSONB DEFAULT '[]'::jsonb,
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS chat_channel_members (
                id SERIAL PRIMARY KEY,
                channel_id INT NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
                employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
                role VARCHAR(30) DEFAULT 'Member',
                joined_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(channel_id, employee_id)
            );

            CREATE TABLE IF NOT EXISTS sla_policies (
                id SERIAL PRIMARY KEY,
                policy_name VARCHAR(100) NOT NULL,
                priority VARCHAR(30) NOT NULL,
                business_hours_only BOOLEAN DEFAULT true,
                level1_mins INT DEFAULT 30,
                level2_mins INT DEFAULT 60,
                level3_mins INT DEFAULT 120,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS employee_capacity_settings (
                employee_id INT PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,
                weekly_capacity_hours NUMERIC(6,2) DEFAULT 40.00,
                updated_at TIMESTAMP DEFAULT NOW()
            );

            CREATE INDEX IF NOT EXISTS idx_chat_messages_channel ON chat_messages (channel_id, created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_chat_members_emp ON chat_channel_members (employee_id);
            CREATE INDEX IF NOT EXISTS idx_chat_channels_dept ON chat_channels (department_id);
            CREATE INDEX IF NOT EXISTS idx_chat_channels_task ON chat_channels (task_id);
        `);

        await client.query(`
            ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sender_id INT REFERENCES employees(id) ON DELETE SET NULL;
            ALTER TABLE notifications ADD COLUMN IF NOT EXISTS channel_id INT REFERENCES chat_channels(id) ON DELETE CASCADE;
        `);

        // Phase 11: Add file attachment columns to direct_messages
        await client.query(`
            ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS file_url TEXT;
            ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS file_name VARCHAR(255);
            ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS file_type VARCHAR(100);
            ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS file_size BIGINT;
        `);

        console.log('✅ Phase 10 Chat Channels, SLA Engine & Capacity Intelligence tables ensured.');
    } catch (error) {
        console.error('❌ Table migration error:', error.message);
    }

    // ── STEP 2: Seed Leave Types ───────────────────────────────────────────────────
    try {
        // ── Phase 7: Teramind Integration & Monitoring Tables ─────────────────────
        await client.query(`
            CREATE TABLE IF NOT EXISTS teramind_settings (
                id SERIAL PRIMARY KEY,
                instance_url VARCHAR(500) DEFAULT '',
                api_token TEXT DEFAULT '',
                is_enabled BOOLEAN DEFAULT true,
                sync_interval_minutes INT DEFAULT 5,
                enable_input_rate BOOLEAN DEFAULT false,
                last_sync_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);

        await client.query(`
            INSERT INTO teramind_settings (id, instance_url, api_token, is_enabled, sync_interval_minutes, enable_input_rate)
            VALUES (1, 'https://planexsoftwa.teramind.co', '02182bf72232fb8749b499a78140356ddb1d5c4e', true, 5, false)
            ON CONFLICT (id) DO UPDATE SET instance_url = EXCLUDED.instance_url, api_token = EXCLUDED.api_token;
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS employee_teramind_mapping (
                id SERIAL PRIMARY KEY,
                employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
                computer_id INT UNIQUE,
                computer_name VARCHAR(255),
                is_manual BOOLEAN DEFAULT false,
                last_sync TIMESTAMP DEFAULT NOW(),
                UNIQUE(employee_id)
            );
            ALTER TABLE employee_teramind_mapping ADD COLUMN IF NOT EXISTS is_manual BOOLEAN DEFAULT false;
            CREATE INDEX IF NOT EXISTS idx_emp_teramind_emp_id ON employee_teramind_mapping(employee_id);
            CREATE INDEX IF NOT EXISTS idx_emp_teramind_comp_id ON employee_teramind_mapping(computer_id);
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS teramind_computer_cache (
                id SERIAL PRIMARY KEY,
                computer_id INT UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                os VARCHAR(100),
                user_name VARCHAR(150),
                is_online BOOLEAN DEFAULT false,
                agent_status VARCHAR(50) DEFAULT 'Offline',
                last_seen TIMESTAMP,
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS teramind_export_cache (
                id SERIAL PRIMARY KEY,
                computer_id INT NOT NULL,
                start_ts INT NOT NULL,
                end_ts INT NOT NULL,
                export_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(computer_id, start_ts, end_ts)
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS teramind_activity_cache (
                id SERIAL PRIMARY KEY,
                employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
                computer_id INT,
                timestamp TIMESTAMP DEFAULT NOW(),
                work_date DATE NOT NULL DEFAULT CURRENT_DATE,
                productive_seconds INT DEFAULT 0,
                unproductive_seconds INT DEFAULT 0,
                idle_seconds INT DEFAULT 0,
                active_seconds INT DEFAULT 0,
                break_seconds INT DEFAULT 0,
                active_app VARCHAR(255) DEFAULT '',
                active_website VARCHAR(255) DEFAULT '',
                top_apps JSONB DEFAULT '[]',
                top_websites JSONB DEFAULT '[]',
                input_score INT DEFAULT 0,
                updated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(employee_id, work_date)
            );
            ALTER TABLE teramind_activity_cache ADD COLUMN IF NOT EXISTS timestamp TIMESTAMP DEFAULT NOW();
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS teramind_alerts (
                id SERIAL PRIMARY KEY,
                alert_id VARCHAR(100) UNIQUE,
                employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
                computer_id INT,
                severity VARCHAR(30) DEFAULT 'Medium',
                title VARCHAR(300) NOT NULL,
                description TEXT,
                triggered_at TIMESTAMP DEFAULT NOW(),
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('✅ Teramind tables, indexes, and settings ensured.');

        const ltCheck = await client.query('SELECT COUNT(*) FROM leave_types');
        if (parseInt(ltCheck.rows[0].count, 10) === 0) {
            await client.query(`
                INSERT INTO leave_types (name, code, default_balance, carry_forward) VALUES
                ('Annual Leave', 'AL', 18, true),
                ('Sick Leave', 'SL', 12, false),
                ('Casual Leave', 'CL', 6, false),
                ('Maternity Leave', 'ML', 84, false),
                ('Paternity Leave', 'PL', 7, false),
                ('Compensatory Off', 'CO', 5, false)
                ON CONFLICT (name) DO NOTHING;
            `);
            console.log('✅ Default leave types seeded.');
        }
    } catch (e) {
        console.error('❌ Teramind & Leave seed error:', e.message);
    }

    // ── STEP 3: Seed Leave Balances for all employees ─────────────────────────────
    try {
        const empRes = await client.query('SELECT id FROM employees');
        const ltRes = await client.query('SELECT id, default_balance FROM leave_types WHERE is_active = true');

        for (const emp of empRes.rows) {
            for (const lt of ltRes.rows) {
                const bal = parseFloat(lt.default_balance) || 15;
                await client.query(`
                    INSERT INTO leave_balances (employee_id, leave_type_id, balance, used)
                    VALUES ($1, $2, $3, 0)
                    ON CONFLICT (employee_id, leave_type_id) DO NOTHING;
                `, [emp.id, lt.id, bal]);
            }
        }
        console.log(`✅ Leave balances ensured: ${empRes.rows.length} employees × ${ltRes.rows.length} types.`);
    } catch (e) {
        console.error('❌ Leave balances seed error:', e.message);
    }

    // ── Phase 11: Enterprise Deletion, Offboarding & Retention System ────────────
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS deletion_requests (
                id SERIAL PRIMARY KEY,
                record_type VARCHAR(50) NOT NULL,
                target_id INT NOT NULL,
                target_name VARCHAR(255),
                reason TEXT NOT NULL,
                category VARCHAR(100),
                effective_date DATE,
                hr_remarks TEXT,
                requested_by INT REFERENCES employees(id),
                requested_at TIMESTAMP DEFAULT NOW(),
                status VARCHAR(50) DEFAULT 'pending_documents',
                retention_days INT DEFAULT 60,
                purge_eligible_at TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS deletion_documents (
                id SERIAL PRIMARY KEY,
                request_id INT NOT NULL REFERENCES deletion_requests(id) ON DELETE CASCADE,
                document_type VARCHAR(100) NOT NULL,
                document_version INT DEFAULT 1,
                storage_provider VARCHAR(50) DEFAULT 'local',
                storage_key VARCHAR(255),
                file_path TEXT NOT NULL,
                file_name VARCHAR(255) NOT NULL,
                file_size INT,
                mime_type VARCHAR(100),
                checksum VARCHAR(64),
                virus_scan_status VARCHAR(50) DEFAULT 'clean',
                uploaded_by INT REFERENCES employees(id),
                uploaded_at TIMESTAMP DEFAULT NOW(),
                verified_by INT REFERENCES employees(id),
                verification_status VARCHAR(50) DEFAULT 'verified'
            );

            CREATE TABLE IF NOT EXISTS deletion_approval_stages (
                id SERIAL PRIMARY KEY,
                record_type VARCHAR(50) NOT NULL,
                sequence_order INT NOT NULL,
                stage_name VARCHAR(100) NOT NULL,
                required_role VARCHAR(50) NOT NULL,
                is_mandatory BOOLEAN DEFAULT true
            );

            CREATE TABLE IF NOT EXISTS deletion_approvals (
                id SERIAL PRIMARY KEY,
                request_id INT NOT NULL REFERENCES deletion_requests(id) ON DELETE CASCADE,
                stage_id INT REFERENCES deletion_approval_stages(id),
                approver_id INT REFERENCES employees(id),
                status VARCHAR(50) DEFAULT 'pending',
                comments TEXT,
                approved_at TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS deletion_audit_logs (
                id SERIAL PRIMARY KEY,
                request_id INT REFERENCES deletion_requests(id) ON DELETE SET NULL,
                record_type VARCHAR(50) NOT NULL,
                record_id INT NOT NULL,
                record_name VARCHAR(255),
                action_type VARCHAR(50) NOT NULL,
                performed_by INT REFERENCES employees(id),
                approved_by INT REFERENCES employees(id),
                reason TEXT,
                ip_address VARCHAR(50),
                created_at TIMESTAMP DEFAULT NOW()
            );

            -- Seed dynamic approval stages
            INSERT INTO deletion_approval_stages (record_type, sequence_order, stage_name, required_role, is_mandatory)
            VALUES 
                ('employee', 1, 'HR Offboarding Review', 'HR', true),
                ('employee', 2, 'Department Manager Clearance', 'Manager', true),
                ('employee', 3, 'IT & Asset Revocation Clearance', 'IT', true),
                ('employee', 4, 'Finance & Payroll Settlement Clearance', 'Finance', true),
                ('customer', 1, 'Account Closure Review', 'Account Manager', true),
                ('customer', 2, 'Finance & Billing Audit', 'Finance', true),
                ('project', 1, 'Delivery Completion Audit', 'Project Manager', true),
                ('project', 2, 'Client Sign-off & Billing Audit', 'Finance', true),
                ('task', 1, 'Task Supervisor Sign-off', 'Manager', false)
            ON CONFLICT DO NOTHING;
        `);
        console.log('✅ Phase 11 Deletion & Offboarding System tables & approval stages ensured.');
    } catch (e) {
        console.error('❌ Phase 11 Migration Error:', e.message);
    }

    // ── PHASE 12: BI-DIRECTIONAL DATA SYNC & STAGING ENGINE ──
    try {
        await client.query(`
            -- Ensure UUID extension & UUID columns across core tables
            CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

            ALTER TABLE employees ADD COLUMN IF NOT EXISTS uuid UUID DEFAULT uuid_generate_v4();
            ALTER TABLE customers ADD COLUMN IF NOT EXISTS uuid UUID DEFAULT uuid_generate_v4();
            ALTER TABLE tasks ADD COLUMN IF NOT EXISTS uuid UUID DEFAULT uuid_generate_v4();
            ALTER TABLE projects ADD COLUMN IF NOT EXISTS uuid UUID DEFAULT uuid_generate_v4();
            ALTER TABLE attendance ADD COLUMN IF NOT EXISTS uuid UUID DEFAULT uuid_generate_v4();

            CREATE TABLE IF NOT EXISTS import_jobs (
                id SERIAL PRIMARY KEY,
                job_id VARCHAR(64) UNIQUE NOT NULL,
                module_name VARCHAR(50) NOT NULL,
                status VARCHAR(30) NOT NULL DEFAULT 'pending',
                progress_percent INT DEFAULT 0,
                processed_rows INT DEFAULT 0,
                total_rows INT DEFAULT 0,
                rows_added INT DEFAULT 0,
                rows_updated INT DEFAULT 0,
                rows_failed INT DEFAULT 0,
                rows_skipped INT DEFAULT 0,
                file_name VARCHAR(255) NOT NULL,
                file_hash VARCHAR(64),
                storage_provider VARCHAR(30) DEFAULT 'local',
                storage_key VARCHAR(500),
                storage_path TEXT,
                error_message TEXT,
                created_by INT REFERENCES users(id),
                started_at TIMESTAMP,
                completed_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS import_staging_records (
                id SERIAL PRIMARY KEY,
                job_id VARCHAR(64) REFERENCES import_jobs(job_id) ON DELETE CASCADE,
                batch_number INT DEFAULT 1,
                row_index INT NOT NULL,
                raw_data JSONB NOT NULL,
                validation_status VARCHAR(20) DEFAULT 'valid',
                error_details JSONB,
                is_committed BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS import_audit_logs (
                id SERIAL PRIMARY KEY,
                job_id VARCHAR(64) NOT NULL,
                module_name VARCHAR(50) NOT NULL,
                file_name VARCHAR(255) NOT NULL,
                file_format VARCHAR(10) DEFAULT 'csv',
                imported_by INT REFERENCES users(id),
                imported_at TIMESTAMP DEFAULT NOW(),
                total_rows INT DEFAULT 0,
                rows_added INT DEFAULT 0,
                rows_updated INT DEFAULT 0,
                rows_failed INT DEFAULT 0,
                rows_skipped INT DEFAULT 0,
                status VARCHAR(30) DEFAULT 'completed',
                details JSONB
            );
        `);
        console.log('✅ Phase 12 Bi-Directional Data Sync tables & UUID columns ensured.');
    } catch (e) {
        console.error('❌ Phase 12 Migration Error:', e.message);
    }

    // Phase 13: Support Desk Module Tables (Post-Delivery Maintenance Lifecycle)
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS support_tickets (
                id SERIAL PRIMARY KEY,
                ticket_code VARCHAR(30) UNIQUE NOT NULL,
                customer_id INT REFERENCES customers(id) ON DELETE CASCADE,
                project_id INT REFERENCES projects(id) ON DELETE SET NULL,
                workflow_id INT REFERENCES workflows(id) ON DELETE SET NULL,
                task_id INT REFERENCES tasks(id) ON DELETE SET NULL,
                reported_by VARCHAR(150),
                title VARCHAR(255) NOT NULL,
                description TEXT,
                category VARCHAR(50) DEFAULT 'Bug',
                priority VARCHAR(20) DEFAULT 'Medium',
                status VARCHAR(30) DEFAULT 'Open',
                assigned_to INT REFERENCES employees(id) ON DELETE SET NULL,
                response_deadline TIMESTAMP,
                resolution_deadline TIMESTAMP,
                responded_at TIMESTAMP,
                resolved_at TIMESTAMP,
                attachments JSONB DEFAULT '[]'::jsonb,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS support_ticket_comments (
                id SERIAL PRIMARY KEY,
                ticket_id INT REFERENCES support_tickets(id) ON DELETE CASCADE,
                author_id INT REFERENCES employees(id) ON DELETE SET NULL,
                author_name VARCHAR(150),
                comment_text TEXT NOT NULL,
                is_internal_note BOOLEAN DEFAULT FALSE,
                attachments JSONB DEFAULT '[]'::jsonb,
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS support_ticket_history (
                id SERIAL PRIMARY KEY,
                ticket_id INT REFERENCES support_tickets(id) ON DELETE CASCADE,
                performed_by VARCHAR(150),
                action VARCHAR(100) NOT NULL,
                previous_status VARCHAR(30),
                new_status VARCHAR(30),
                details TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('✅ Phase 13 Support Desk (Post-Delivery Maintenance) tables ensured.');
    } catch (e) {
        console.error('❌ Phase 13 Migration Error:', e.message);
    }

    // Phase 14: Out Entry & Movement Register Tables
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS out_entries (
                id SERIAL PRIMARY KEY,
                employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
                date DATE NOT NULL DEFAULT CURRENT_DATE,
                out_time TIME NOT NULL,
                in_time TIME,
                duration_minutes INT DEFAULT 0,
                purpose VARCHAR(50) NOT NULL,
                destination VARCHAR(255),
                reason TEXT,
                status VARCHAR(30) DEFAULT 'Out',
                approved_by INT REFERENCES employees(id) ON DELETE SET NULL,
                remarks TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );

            CREATE INDEX IF NOT EXISTS idx_out_entries_emp_dt ON out_entries(employee_id, date);
            CREATE INDEX IF NOT EXISTS idx_out_entries_status ON out_entries(status);
        `);
        console.log('✅ Phase 14 Out Entry & Movement Register tables ensured.');
    } catch (e) {
        console.error('❌ Phase 14 Migration Error:', e.message);
    }

    // Phase 15: Leave Types & Leave Requests Seeding
    try {
        await client.query(`
            INSERT INTO leave_types (name, code, default_balance, carry_forward, max_carry_forward, is_active)
            VALUES 
                ('Paid / Annual Leave', 'PL', 15.0, true, 10.0, true),
                ('Half Day Leave', 'HD', 6.0, false, 0.0, true),
                ('Compensatory Off', 'CO', 5.0, false, 0.0, true)
            ON CONFLICT DO NOTHING;
        `);

        const leaveCountRes = await client.query('SELECT COUNT(*) FROM leave_requests;');
        if (parseInt(leaveCountRes.rows[0].count, 10) === 0) {
            const emps = await client.query('SELECT id, full_name FROM employees ORDER BY id ASC;');
            if (emps.rows.length > 0) {
                const sampleLeaves = [
                    { name: 'Malhar', type: 'Casual Leave', start: '2026-08-25', end: '2026-08-26', status: 'Approved', reason: 'Family function in native place (Pune)' },
                    { name: 'Malhar', type: 'Sick Leave', start: '2026-07-14', end: '2026-07-14', status: 'Approved', reason: 'High fever and doctor consultation' },
                    { name: 'Nitin', type: 'Paid / Annual Leave', start: '2026-08-10', end: '2026-08-14', status: 'Approved', reason: 'Annual family vacation tour' },
                    { name: 'Nitin', type: 'Half Day Leave', start: '2026-08-28', end: '2026-08-28', status: 'Approved', reason: 'Vehicle RTO document verification' },
                    { name: 'Vaibhav', type: 'Sick Leave', start: '2026-08-18', end: '2026-08-19', status: 'Approved', reason: 'Severe migraine & advised 2 days rest' },
                    { name: 'Vaibhav', type: 'Casual Leave', start: '2026-09-04', end: '2026-09-04', status: 'Pending', reason: 'Bank work & home property registry' },
                    { name: 'Ganpati', type: 'Casual Leave', start: '2026-08-01', end: '2026-08-02', status: 'Approved', reason: 'Sister wedding preparation and rituals' },
                    { name: 'Ganpati', type: 'Compensatory Off', start: '2026-07-28', end: '2026-07-28', status: 'Approved', reason: 'Worked on Sunday server maintenance deployment' },
                    { name: 'Haresh', type: 'Paid / Annual Leave', start: '2026-07-06', end: '2026-07-08', status: 'Approved', reason: 'Village temple annual festival' },
                    { name: 'Haresh', type: 'Casual Leave', start: '2026-09-01', end: '2026-09-02', status: 'Pending', reason: 'Personal emergency at hometown' },
                    { name: 'Vijay', type: 'Sick Leave', start: '2026-08-05', end: '2026-08-06', status: 'Approved', reason: 'Food poisoning and recovery' },
                    { name: 'Vijay', type: 'Casual Leave', start: '2026-06-18', end: '2026-06-19', status: 'Approved', reason: 'Home shifting and renovation setup' },
                    { name: 'Kunal', type: 'Casual Leave', start: '2026-08-20', end: '2026-08-21', status: 'Approved', reason: 'Attending cousin engagement ceremony' },
                    { name: 'Kunal', type: 'Half Day Leave', start: '2026-09-03', end: '2026-09-03', status: 'Pending', reason: 'Passport renewal appointment' },
                    { name: 'Biswas', type: 'Sick Leave', start: '2026-07-20', end: '2026-07-21', status: 'Approved', reason: 'Eye infection & rest advised by ophthalmologist' },
                    { name: 'Biswas', type: 'Casual Leave', start: '2026-08-11', end: '2026-08-12', status: 'Rejected', reason: 'Shortage of critical project deadline (Declined by Manager)' }
                ];

                for (const sl of sampleLeaves) {
                    const emp = emps.rows.find(e => e.full_name.toLowerCase().includes(sl.name.toLowerCase()));
                    if (emp) {
                        await client.query(`
                            INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, reason, status, approved_by, created_at)
                            VALUES ($1, $2, $3, $4, $5, $6, 1, $3::date - INTERVAL '3 days');
                        `, [emp.id, sl.type, sl.start, sl.end, sl.reason, sl.status]);
                    }
                }
            }
        }
        console.log('✅ Phase 15 Leave Types & Leave Requests ensured.');
    } catch (e) {
        console.error('❌ Phase 15 Migration Error:', e.message);
    }

    client.release();
    console.log('🎉 All migrations complete.');
}


