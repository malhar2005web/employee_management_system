-- ==============================================================================
-- PCS Attendance → EMS Database Migration (Phase 1 & 2)
-- Architecture: Clean Schema, Numeric Seconds Metrics, Reused EMS Tables, 0 Old Data
-- ==============================================================================

BEGIN;

-- 1. Alter Existing EMS attendance table to store canonical seconds metrics
ALTER TABLE attendance 
    ADD COLUMN IF NOT EXISTS late_seconds INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS early_logout_seconds INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS office_seconds INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS overtime_seconds INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS login_seconds INTEGER DEFAULT 0;

-- 2. Create pcs_attendance_sheet (Raw activity inputs - Preserves exact PCS semantics)
CREATE TABLE IF NOT EXISTS pcs_attendance_sheet (
    id SERIAL PRIMARY KEY,
    computer VARCHAR(150) NOT NULL,
    rep_datetime TIMESTAMP NOT NULL,
    duration TIME DEFAULT '00:00:00',
    yearmth VARCHAR(10),
    mth VARCHAR(4),
    dayys VARCHAR(4),
    data_from VARCHAR(150),
    remark VARCHAR(150),
    uploaded_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes on pcs_attendance_sheet for ultra-fast time-series and user aggregation
CREATE INDEX IF NOT EXISTS idx_pcs_att_sheet_comp_dt ON pcs_attendance_sheet(computer, rep_datetime);
CREATE INDEX IF NOT EXISTS idx_pcs_att_sheet_yearmth ON pcs_attendance_sheet(yearmth, dayys);
CREATE INDEX IF NOT EXISTS idx_pcs_att_sheet_rep_dt ON pcs_attendance_sheet(rep_datetime);

-- 3. Create pcs_calenders (Calendar generation table for monthly matrix joins)
CREATE TABLE IF NOT EXISTS pcs_calenders (
    id SERIAL PRIMARY KEY,
    date_times TIMESTAMP NOT NULL,
    yyyymm VARCHAR(8) NOT NULL,
    mm VARCHAR(4) NOT NULL,
    dd VARCHAR(4) NOT NULL,
    week_days VARCHAR(150) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pcs_calenders_yyyymm_mm ON pcs_calenders(yyyymm, mm);
CREATE INDEX IF NOT EXISTS idx_pcs_calenders_date_times ON pcs_calenders(date_times);

-- 4. Create attendance_user_rtp (Daily calculated attendance output with canonical seconds)
CREATE TABLE IF NOT EXISTS attendance_user_rtp (
    id SERIAL PRIMARY KEY,
    user_id_is VARCHAR(200) NOT NULL,
    employee_id INT REFERENCES employees(id) ON DELETE SET NULL,
    date_times DATE NOT NULL,
    yyyymm VARCHAR(10) NOT NULL,
    mm VARCHAR(8),
    dd VARCHAR(8),
    week_days VARCHAR(20),
    week_off_status VARCHAR(50),
    is_present VARCHAR(10) DEFAULT 'A', -- 'P', 'A', 'W' (WeekOff), 'H' (Holiday), 'L' (Leave)
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    -- Canonical numeric values (seconds)
    late_seconds INTEGER DEFAULT 0,
    early_logout_seconds INTEGER DEFAULT 0,
    office_seconds INTEGER DEFAULT 0,
    overtime_seconds INTEGER DEFAULT 0,
    total_seconds INTEGER DEFAULT 0,
    login_seconds INTEGER DEFAULT 0,
    -- Display formatting cache (e.g., '00:25', '08:45', '01:15')
    late_in_time VARCHAR(20) DEFAULT '00:00',
    pre_out_time VARCHAR(20) DEFAULT '00:00',
    office_hours VARCHAR(20) DEFAULT '00:00',
    overtime_hours VARCHAR(20) DEFAULT '00:00',
    total_hours VARCHAR(20) DEFAULT '00:00',
    login_hours VARCHAR(20) DEFAULT '00:00',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_att_user_rtp UNIQUE (user_id_is, date_times)
);

CREATE INDEX IF NOT EXISTS idx_att_user_rtp_user_dt ON attendance_user_rtp(user_id_is, date_times);
CREATE INDEX IF NOT EXISTS idx_att_user_rtp_emp_dt ON attendance_user_rtp(employee_id, date_times);
CREATE INDEX IF NOT EXISTS idx_att_user_rtp_yyyymm ON attendance_user_rtp(yyyymm, user_id_is);

-- ==============================================================================
-- PHASE 2: PostgreSQL Views
-- ==============================================================================

-- View 1: AttandenceSheetRtp
-- Computes total duration in seconds (tot_dur) from pcs_attendance_sheet
CREATE OR REPLACE VIEW "AttandenceSheetRtp" AS
SELECT 
    yearmth,
    mth,
    dayys,
    uploaded_on AS "UploadedOn",
    rep_datetime AS "RepDateTime",
    computer AS "Computer",
    duration AS "Duration",
    COALESCE(EXTRACT(HOUR FROM duration) * 3600 + EXTRACT(MINUTE FROM duration) * 60 + EXTRACT(SECOND FROM duration), 0)::INTEGER AS "TotDur",
    data_from AS "DataFrom",
    remark AS "Remark"
FROM pcs_attendance_sheet;

-- View 2: ATTENDANCE_SUM
-- Master monthly aggregation view over attendance_user_rtp
CREATE OR REPLACE VIEW "ATTENDANCE_SUM" AS
SELECT 
    a.user_id_is AS "USERNAME",
    a.yyyymm AS "YYYYMM",
    MAX(a.employee_id) AS "EMPLOYEE_ID",
    COUNT(*) FILTER (WHERE LOWER(a.week_days) != 'sunday') AS "TOTALDAYS",
    COUNT(*) FILTER (WHERE a.is_present = 'P') AS "PRESENT",
    COUNT(*) FILTER (WHERE a.is_present = 'A') AS "ABSENT",
    COUNT(*) FILTER (WHERE a.is_present = 'L' OR a.is_present = 'Leave') AS "LEAVE",
    COUNT(*) FILTER (WHERE a.is_present = 'W' OR a.is_present = 'WeekOff') AS "WEEKOFF",
    COUNT(*) FILTER (WHERE a.is_present = 'H' OR a.is_present = 'Holiday') AS "HOLIDAY",
    -- Seconds sums
    SUM(a.late_seconds) AS "TOTAL_LATE_SECONDS",
    SUM(a.early_logout_seconds) AS "TOTAL_EARLY_OUT_SECONDS",
    SUM(a.office_seconds) AS "TOTAL_OFFICE_SECONDS",
    SUM(a.overtime_seconds) AS "TOTAL_OVERTIME_SECONDS",
    SUM(a.login_seconds) AS "TOTAL_LOGIN_SECONDS",
    -- Formatted HH:MM strings (preserving exact legacy display output)
    CONCAT(
        LPAD(FLOOR(SUM(a.late_seconds) / 3600)::TEXT, 2, '0'), ':',
        LPAD(FLOOR((SUM(a.late_seconds) % 3600) / 60)::TEXT, 2, '0')
    ) AS "LATINTIME",
    CONCAT(
        LPAD(FLOOR(SUM(a.early_logout_seconds) / 3600)::TEXT, 2, '0'), ':',
        LPAD(FLOOR((SUM(a.early_logout_seconds) % 3600) / 60)::TEXT, 2, '0')
    ) AS "PREOUTTIME",
    CONCAT(
        LPAD(FLOOR(SUM(a.office_seconds) / 3600)::TEXT, 2, '0'), ':',
        LPAD(FLOOR((SUM(a.office_seconds) % 3600) / 60)::TEXT, 2, '0')
    ) AS "WORKIMGHR",
    CONCAT(
        LPAD(FLOOR(SUM(a.overtime_seconds) / 3600)::TEXT, 2, '0'), ':',
        LPAD(FLOOR((SUM(a.overtime_seconds) % 3600) / 60)::TEXT, 2, '0')
    ) AS "OTHOURS",
    CONCAT(
        LPAD(FLOOR(SUM(a.login_seconds) / 3600)::TEXT, 2, '0'), ':',
        LPAD(FLOOR((SUM(a.login_seconds) % 3600) / 60)::TEXT, 2, '0')
    ) AS "LOGIMHOURS"
FROM attendance_user_rtp a
GROUP BY a.user_id_is, a.yyyymm;

COMMIT;
