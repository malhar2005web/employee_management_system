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
            ALTER TABLE customers ADD COLUMN IF NOT EXISTS gst_no VARCHAR(100);
            ALTER TABLE customers ADD COLUMN IF NOT EXISTS branches JSONB DEFAULT '[]'::jsonb;
            ALTER TABLE customers ADD COLUMN IF NOT EXISTS deadline DATE;
            ALTER TABLE customers ADD COLUMN IF NOT EXISTS industry VARCHAR(100);
            ALTER TABLE customers ADD COLUMN IF NOT EXISTS sla_type VARCHAR(50);
            ALTER TABLE customers ADD COLUMN IF NOT EXISTS sla_response_time VARCHAR(50);
            ALTER TABLE customers ADD COLUMN IF NOT EXISTS sla_resolution_time VARCHAR(50);
            ALTER TABLE customers ADD COLUMN IF NOT EXISTS contract_start_date DATE;
            ALTER TABLE customers ADD COLUMN IF NOT EXISTS contract_end_date DATE;
            ALTER TABLE projects ADD COLUMN IF NOT EXISTS customer_id INT REFERENCES customers(id) ON DELETE CASCADE;
            ALTER TABLE projects ADD COLUMN IF NOT EXISTS branch_name VARCHAR(150);
            ALTER TABLE projects ADD COLUMN IF NOT EXISTS account_manager_id INT REFERENCES employees(id) ON DELETE SET NULL;
            ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_name_key;
            ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_manager_id INT REFERENCES employees(id) ON DELETE SET NULL;
            ALTER TABLE workflow_tasks ADD COLUMN IF NOT EXISTS status_history JSONB DEFAULT '[]'::jsonb;
        `);


        console.log('✅ All Phase 6 tables ensured.');
    } catch (error) {
        console.error('❌ Table migration error:', error.message);
    }

    // ── STEP 2: Seed Leave Types ───────────────────────────────────────────────────
    try {
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
        console.error('❌ Leave types seed error:', e.message);
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

    client.release();
    console.log('🎉 Phase 6 migrations complete.');
}
