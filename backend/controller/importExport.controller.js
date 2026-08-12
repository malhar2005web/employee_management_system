import { pool } from '../config/db.js';
import ExcelJS from 'exceljs';
import { StorageProvider } from '../utils/storageProvider.js';

// ── CONFIGURATION-DRIVEN MODULE REGISTRY MAP ────────────────────────────────
export const MODULE_REGISTRY = {
    customers: {
        table: 'customers',
        primaryKey: 'id',
        uuidColumn: 'uuid',
        displayName: 'Customer Master',
        importColumns: ['name', 'email', 'phone', 'industry', 'sla_type', 'sla_response_time', 'sla_resolution_time', 'contract_start', 'contract_end', 'deadline'],
        exportColumns: ['id', 'uuid', 'name', 'email', 'phone', 'industry', 'sla_type', 'sla_response_time', 'sla_resolution_time', 'contract_start', 'contract_end', 'deadline', 'updated_at'],
        dropdowns: {
            industry: ['Pharma', 'Manufacturing', 'IT Services', 'Logistics', 'Healthcare', 'Consulting', 'Retail', 'Others'],
            sla_type: ['Standard', 'Premium', 'Enterprise', 'SME', 'Government', 'Startup', 'Vendor', 'Partner']
        },
        foreignKeys: [],
        validateRow: async (row, client) => {
            const errors = [];
            if (!row.name || String(row.name).trim() === '') errors.push('Customer Name is mandatory.');
            if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(row.email).trim())) errors.push(`Invalid Email format '${row.email}'.`);
            return errors;
        }
    },
    employees: {
        table: 'employees',
        primaryKey: 'id',
        uuidColumn: 'uuid',
        displayName: 'Employee Directory',
        importColumns: ['full_name', 'employee_code', 'email', 'phone', 'whatsapp_no', 'department_id', 'designation_id', 'status'],
        exportColumns: ['id', 'uuid', 'full_name', 'employee_code', 'email', 'phone', 'whatsapp_no', 'department_id', 'designation_id', 'status', 'updated_at'],
        dropdowns: {
            status: ['Active', 'Inactive', 'On Leave', 'Suspended']
        },
        foreignKeys: [
            { column: 'department_id', targetTable: 'departments', targetCol: 'id', name: 'Department' }
        ],
        validateRow: async (row, client) => {
            const errors = [];
            if (!row.full_name || String(row.full_name).trim() === '') errors.push('Full Name is mandatory.');
            if (!row.employee_code || String(row.employee_code).trim() === '') errors.push('Employee Code is mandatory.');
            if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(row.email).trim())) errors.push(`Invalid Email format '${row.email}'.`);
            if (row.department_id) {
                const deptCheck = await client.query('SELECT id FROM departments WHERE id = $1', [row.department_id]);
                if (deptCheck.rows.length === 0) errors.push(`Invalid Department ID '${row.department_id}' - Department does not exist.`);
            }
            return errors;
        }
    },
    tasks: {
        table: 'tasks',
        primaryKey: 'id',
        uuidColumn: 'uuid',
        displayName: 'Tasks & Workflows',
        importColumns: ['name', 'description', 'priority', 'status', 'project_id', 'assigned_to'],
        exportColumns: ['id', 'uuid', 'name', 'description', 'priority', 'status', 'project_id', 'assigned_to', 'updated_at'],
        dropdowns: {
            priority: ['Low', 'Medium', 'High', 'Urgent'],
            status: ['To Do', 'In Progress', 'Under Review', 'Completed', 'Archived']
        },
        foreignKeys: [
            { column: 'project_id', targetTable: 'projects', targetCol: 'id', name: 'Project' }
        ],
        validateRow: async (row, client) => {
            const errors = [];
            if (!row.name || String(row.name).trim() === '') errors.push('Task Name is mandatory.');
            if (row.project_id) {
                const projCheck = await client.query('SELECT id FROM projects WHERE id = $1', [row.project_id]);
                if (projCheck.rows.length === 0) errors.push(`Invalid Project ID '${row.project_id}' - Project does not exist.`);
            }
            return errors;
        }
    },
    projects: {
        table: 'projects',
        primaryKey: 'id',
        uuidColumn: 'uuid',
        displayName: 'Project Master',
        importColumns: ['name', 'description', 'status', 'start_date', 'end_date'],
        exportColumns: ['id', 'uuid', 'name', 'description', 'status', 'start_date', 'end_date', 'updated_at'],
        dropdowns: {
            status: ['Planning', 'In Progress', 'On Hold', 'Completed', 'Cancelled']
        },
        foreignKeys: [],
        validateRow: async (row, client) => {
            const errors = [];
            if (!row.name || String(row.name).trim() === '') errors.push('Project Name is mandatory.');
            return errors;
        }
    },
    attendance: {
        table: 'attendance',
        primaryKey: 'id',
        uuidColumn: 'uuid',
        displayName: 'Attendance Logs',
        importColumns: ['employee_id', 'date', 'check_in', 'check_out', 'status'],
        exportColumns: ['id', 'uuid', 'employee_id', 'date', 'check_in', 'check_out', 'status', 'updated_at'],
        dropdowns: {
            status: ['Present', 'Absent', 'Half Day', 'Late', 'On Leave']
        },
        foreignKeys: [
            { column: 'employee_id', targetTable: 'employees', targetCol: 'id', name: 'Employee' }
        ],
        validateRow: async (row, client) => {
            const errors = [];
            if (!row.employee_id) errors.push('Employee ID is mandatory.');
            if (row.employee_id) {
                const empCheck = await client.query('SELECT id FROM employees WHERE id = $1', [row.employee_id]);
                if (empCheck.rows.length === 0) errors.push(`Invalid Employee ID '${row.employee_id}' - Employee does not exist.`);
            }
            return errors;
        }
    }
};

// ── OWASP FORMULA INJECTION SANITIZER ───────────────────────────────────────
function sanitizeCellValue(val) {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (/^[=\+\-@\t\r]/.test(str)) {
        return `'${str}`; // Prefix single quote to disable execution in Excel
    }
    return str;
}

// ── 1. DOWNLOAD MODULE TEMPLATE WITH INSTRUCTIONS & VALIDATIONS ─────────────
export async function downloadModuleTemplate(req, res) {
    try {
        const { module } = req.query;
        const config = MODULE_REGISTRY[module];
        if (!config) {
            return res.status(400).json({ success: false, message: `Invalid or unsupported module '${module}'.` });
        }

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'PCS Enterprise EMS';
        workbook.created = new Date();

        // ── SHEET 1: INSTRUCTION & METADATA ──
        const instSheet = workbook.addWorksheet('Instructions & Metadata');
        instSheet.views = [{ showGridLines: true }];

        instSheet.columns = [
            { header: 'Metadata Key', key: 'key', width: 28 },
            { header: 'Metadata Value / Rules', key: 'val', width: 65 }
        ];

        instSheet.addRows([
            { key: 'Schema Version', val: 'EMS Data Sync Schema v2.0' },
            { key: 'Template ID', val: `TMPL_${module.toUpperCase()}_${Date.now()}` },
            { key: 'Generated At', val: new Date().toISOString() },
            { key: 'Generated By', val: req.user ? req.user.email : 'EMS System Admin' },
            { key: 'Target Module', val: config.displayName },
            { key: '-----------------------------', val: '---------------------------------------------------------' },
            { key: 'RULE 1: DO NOT EDIT UUID', val: 'Keep the "uuid" column untouched. It maps entity identity.' },
            { key: 'RULE 2: BLANK ID = NEW RECORD', val: 'Leave "id" and "uuid" blank to insert a brand new record.' },
            { key: 'RULE 3: NO DELETION VIA FILE', val: 'Deleting a row from this file will NOT delete it from DB (Omitted rows are skipped).' },
            { key: 'RULE 4: REQUIRED FIELDS', val: 'Fields marked in bold red header in Data Template tab are required.' },
            { key: 'RULE 5: DROPDOWN VALIDATIONS', val: 'Use built-in dropdown selection options where provided.' }
        ]);

        // Style Instructions header
        instSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        instSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0C4A40' } };

        // ── SHEET 2: DATA TEMPLATE ──
        const dataSheet = workbook.addWorksheet('Data Template');
        dataSheet.views = [{ state: 'frozen', ySplit: 1, showGridLines: true }]; // Freeze header row

        const columns = [
            { header: 'id (Read Only)', key: 'id', width: 14 },
            { header: 'uuid (Read Only)', key: 'uuid', width: 36 },
            ...config.importColumns.map(col => ({
                header: col.replace(/_/g, ' ').toUpperCase(),
                key: col,
                width: 22
            })),
            { header: 'last_modified (ISO)', key: 'updated_at', width: 25 }
        ];

        dataSheet.columns = columns;

        // Style Header Row
        const headerRow = dataSheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16A085' } };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

        // Add Sample Data Row
        const sampleObj = { id: '', uuid: '' };
        config.importColumns.forEach(col => {
            if (config.dropdowns[col]) {
                sampleObj[col] = config.dropdowns[col][0];
            } else if (col.includes('email')) {
                sampleObj[col] = 'sample@company.com';
            } else if (col.includes('date')) {
                sampleObj[col] = new Date().toISOString().split('T')[0];
            } else {
                sampleObj[col] = `Sample ${col}`;
            }
        });
        sampleObj.updated_at = new Date().toISOString();
        dataSheet.addRow(sampleObj);

        // Auto Filters
        dataSheet.autoFilter = {
            from: { row: 1, column: 1 },
            to: { row: 1, column: columns.length }
        };

        // Set response headers for file download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=EMS_Template_${module}_v2.xlsx`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (e) {
        console.error('Error downloading template:', e.message);
        res.status(500).json({ success: false, message: `Failed to generate import template: ${e.message}` });
    }
}

// ── 2. EXPORT MODULE DATA (.XLSX / .CSV) ───────────────────────────────────
export async function exportModuleData(req, res) {
    try {
        const { module, format = 'xlsx', status } = req.query;
        const config = MODULE_REGISTRY[module];
        if (!config) {
            return res.status(400).json({ success: false, message: `Invalid module '${module}'.` });
        }

        let queryStr = `SELECT * FROM ${config.table}`;
        const queryParams = [];

        if (status) {
            queryStr += ` WHERE status = $1`;
            queryParams.push(status);
        }
        queryStr += ` ORDER BY id ASC`;

        const dbRes = await pool.query(queryStr, queryParams);
        const rows = dbRes.rows;

        if (format === 'csv') {
            // UTF-8 BOM CSV Export
            const headers = config.exportColumns.join(',');
            const csvRows = rows.map(r => {
                return config.exportColumns.map(col => {
                    const val = r[col] !== undefined && r[col] !== null ? r[col] : '';
                    const sanitized = sanitizeCellValue(val);
                    return `"${String(sanitized).replace(/"/g, '""')}"`;
                }).join(',');
            });

            const csvContent = '\uFEFF# EMS Schema Version 2.0\n' + headers + '\n' + csvRows.join('\n');

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename=EMS_Export_${module}_${Date.now()}.csv`);
            return res.send(csvContent);
        } else {
            // Excel (.xlsx) Export using ExcelJS
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet(config.displayName);
            sheet.views = [{ state: 'frozen', ySplit: 1, showGridLines: true }];

            sheet.columns = config.exportColumns.map(col => ({
                header: col.replace(/_/g, ' ').toUpperCase(),
                key: col,
                width: col === 'uuid' ? 36 : 22
            }));

            // Header Style
            const headerRow = sheet.getRow(1);
            headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0C4A40' } };

            rows.forEach(r => {
                const rowObj = {};
                config.exportColumns.forEach(col => {
                    rowObj[col] = sanitizeCellValue(r[col]);
                });
                sheet.addRow(rowObj);
            });

            sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: config.exportColumns.length } };

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=EMS_Export_${module}_${Date.now()}.xlsx`);
            await workbook.xlsx.write(res);
            return res.end();
        }
    } catch (e) {
        console.error('Error exporting module data:', e.message);
        res.status(500).json({ success: false, message: `Failed to export data: ${e.message}` });
    }
}

// ── 3. PREVIEW IMPORT DATA (NO DB LOCK REQUIRED) ───────────────────────────
export async function previewImportData(req, res) {
    const client = await pool.connect();
    try {
        const { module } = req.body;
        const file = req.file;

        if (!file) {
            client.release();
            return res.status(400).json({ success: false, message: 'No file uploaded.' });
        }

        const config = MODULE_REGISTRY[module];
        if (!config) {
            client.release();
            return res.status(400).json({ success: false, message: `Invalid module '${module}'.` });
        }

        let parsedRows = [];

        if (file.originalname.endsWith('.xlsx')) {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(file.buffer);
            const sheet = workbook.getWorksheet('Data Template') || workbook.worksheets[0];

            const headerMap = [];
            sheet.getRow(1).eachCell((cell, colNum) => {
                const h = String(cell.value || '').trim().toLowerCase().replace(/ \(.*\)/g, '').replace(/ /g, '_');
                headerMap[colNum] = h;
            });

            sheet.eachRow((row, rowNum) => {
                if (rowNum === 1) return; // Skip header
                const rowObj = {};
                row.eachCell((cell, colNum) => {
                    const key = headerMap[colNum];
                    if (key) rowObj[key] = sanitizeCellValue(cell.value);
                });
                if (Object.keys(rowObj).length > 0) parsedRows.push({ rowIndex: rowNum, data: rowObj });
            });
        } else {
            // CSV Parsing
            const csvStr = file.buffer.toString('utf-8');
            const lines = csvStr.split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#'));
            if (lines.length === 0) {
                client.release();
                return res.status(400).json({ success: false, message: 'Empty CSV file.' });
            }

            const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase().replace(/ \(.*\)/g, '').replace(/ /g, '_'));
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',').map(v => v.replace(/^"|"$/g, '').trim());
                const rowObj = {};
                headers.forEach((h, idx) => {
                    rowObj[h] = sanitizeCellValue(values[idx]);
                });
                parsedRows.push({ rowIndex: i + 1, data: rowObj });
            }
        }

        // ── VALIDATION & CONCURRENCY CONFLICT DETECTION ──
        let newCount = 0;
        let updatedCount = 0;
        let invalidCount = 0;
        let skippedCount = 0;
        let conflictCount = 0;
        const conflictsOnly = [];
        const validatedRows = [];

        for (const item of parsedRows) {
            const r = item.data;
            const errors = await config.validateRow(r, client);
            let status = 'valid';
            let actionType = 'new';
            let conflictDetails = null;

            if (errors.length > 0) {
                status = 'invalid';
                invalidCount++;
            } else if (r.id || r.uuid) {
                // Existing record lookup
                let dbRecord = null;
                if (r.uuid) {
                    const resUuid = await client.query(`SELECT * FROM ${config.table} WHERE uuid = $1`, [r.uuid]);
                    if (resUuid.rows.length > 0) dbRecord = resUuid.rows[0];
                }
                if (!dbRecord && r.id) {
                    const resId = await client.query(`SELECT * FROM ${config.table} WHERE ${config.primaryKey} = $1`, [r.id]);
                    if (resId.rows.length > 0) dbRecord = resId.rows[0];
                }

                if (dbRecord) {
                    actionType = 'update';
                    // Check DB Concurrency conflict
                    const dbUpdatedAt = new Date(dbRecord.updated_at || dbRecord.created_at).getTime();
                    const csvUpdatedAt = r.updated_at || r.last_modified ? new Date(r.updated_at || r.last_modified).getTime() : 0;

                    if (csvUpdatedAt && dbUpdatedAt > csvUpdatedAt + 2000) {
                        status = 'conflict';
                        conflictCount++;
                        conflictDetails = {
                            field: 'Concurrently Modified Record',
                            dbValue: `DB Updated At: ${new Date(dbUpdatedAt).toLocaleString()}`,
                            csvValue: `CSV Exported At: ${new Date(csvUpdatedAt).toLocaleString()}`
                        };
                        conflictsOnly.push({
                            rowIndex: item.rowIndex,
                            id: dbRecord[config.primaryKey],
                            name: dbRecord.name || dbRecord.full_name || `Record #${dbRecord[config.primaryKey]}`,
                            conflictDetails
                        });
                    } else {
                        updatedCount++;
                    }
                } else {
                    actionType = 'new';
                    newCount++;
                }
            } else {
                actionType = 'new';
                newCount++;
            }

            validatedRows.push({
                rowIndex: item.rowIndex,
                status,
                actionType,
                errors,
                data: r
            });
        }

        // Save preview file metadata to StorageProvider
        const storageResult = await StorageProvider.saveFile(file.buffer, file.originalname);

        client.release();
        res.status(200).json({
            success: true,
            summary: {
                totalRows: parsedRows.length,
                newCount,
                updatedCount,
                invalidCount,
                skippedCount,
                conflictCount
            },
            storage: storageResult,
            conflicts: conflictsOnly,
            validatedRowsSample: validatedRows.slice(0, 50)
        });
    } catch (e) {
        client.release();
        console.error('Error previewing import data:', e.message);
        res.status(500).json({ success: false, message: `Preview failed: ${e.message}` });
    }
}

// ── 4. START IMPORT ASYNCHRONOUS JOB WITH STAGING & ADVISORY LOCKS ──────────
export async function startImportJob(req, res) {
    const client = await pool.connect();
    try {
        const { module, storageKey, storagePath, fileName, validatedRows } = req.body;
        const userId = req.user ? req.user.id : 1;
        const config = MODULE_REGISTRY[module];

        if (!config) {
            client.release();
            return res.status(400).json({ success: false, message: `Invalid module '${module}'.` });
        }

        const jobId = `JOB_${module.toUpperCase()}_${Date.now()}`;

        // 1. Create Job Record
        await client.query(`
            INSERT INTO import_jobs (job_id, module_name, status, total_rows, file_name, storage_provider, storage_key, storage_path, created_by, started_at)
            VALUES ($1, $2, 'processing', $3, $4, 'local', $5, $6, $7, NOW())
        `, [jobId, module, validatedRows.length, fileName || 'import.xlsx', storageKey, storagePath, userId]);

        // 2. Insert into Staging Records
        for (let i = 0; i < validatedRows.length; i++) {
            const vr = validatedRows[i];
            await client.query(`
                INSERT INTO import_staging_records (job_id, batch_number, row_index, raw_data, validation_status, error_details)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [jobId, Math.floor(i / 500) + 1, vr.rowIndex, JSON.stringify(vr.data), vr.status, JSON.stringify(vr.errors)]);
        }

        // Return immediately to user with Job ID for UI polling
        res.status(200).json({
            success: true,
            jobId,
            message: `Import job '${jobId}' initialized. Background worker is processing ${validatedRows.length} records.`
        });

        // ── ASYNCHRONOUS BACKGROUND COMMIT WORKER ──
        setImmediate(async () => {
            const workerClient = await pool.connect();
            try {
                // ACQUIRE POSTGRESQL ADVISORY LOCK (ON COMMIT ONLY)
                const lockRes = await workerClient.query(`SELECT pg_try_advisory_xact_lock(hashtext($1)) AS acquired`, [module]);
                if (!lockRes.rows[0].acquired) {
                    console.log(`[ADVISORY LOCK BUSY] Import for ${module} is currently running by another admin.`);
                    await workerClient.query(`UPDATE import_jobs SET status = 'failed', error_message = 'Concurrent import locked by another admin.' WHERE job_id = $1`, [jobId]);
                    workerClient.release();
                    return;
                }

                let rowsAdded = 0;
                let rowsUpdated = 0;
                let rowsFailed = 0;
                let rowsSkipped = 0;

                const batchSize = 500;
                const totalBatches = Math.ceil(validatedRows.length / batchSize);

                for (let b = 0; b < totalBatches; b++) {
                    await workerClient.query('BEGIN');
                    try {
                        const batchRows = validatedRows.slice(b * batchSize, (b + 1) * batchSize);

                        for (const item of batchRows) {
                            if (item.status === 'invalid') {
                                rowsFailed++;
                                continue;
                            }

                            const r = item.data;
                            if (item.actionType === 'update' && (r.id || r.uuid)) {
                                // Execute UPDATE
                                const updateCols = config.importColumns.filter(c => r[c] !== undefined);
                                const setClause = updateCols.map((c, idx) => `${c} = $${idx + 1}`).join(', ');
                                const vals = updateCols.map(c => r[c]);

                                if (r.uuid) {
                                    vals.push(r.uuid);
                                    await workerClient.query(`UPDATE ${config.table} SET ${setClause}, updated_at = NOW() WHERE uuid = $${vals.length}`, vals);
                                } else {
                                    vals.push(r.id);
                                    await workerClient.query(`UPDATE ${config.table} SET ${setClause}, updated_at = NOW() WHERE ${config.primaryKey} = $${vals.length}`, vals);
                                }
                                rowsUpdated++;
                            } else {
                                // Execute INSERT
                                const insertCols = config.importColumns.filter(c => r[c] !== undefined && r[c] !== '');
                                const colNames = insertCols.join(', ');
                                const placeholders = insertCols.map((_, idx) => `$${idx + 1}`).join(', ');
                                const vals = insertCols.map(c => r[c]);

                                if (insertCols.length > 0) {
                                    await workerClient.query(`INSERT INTO ${config.table} (${colNames}) VALUES (${placeholders})`, vals);
                                    rowsAdded++;
                                } else {
                                    rowsSkipped++;
                                }
                            }
                        }

                        await workerClient.query('COMMIT');
                        const progress = Math.round(((b + 1) / totalBatches) * 100);
                        await workerClient.query(`UPDATE import_jobs SET progress_percent = $1, processed_rows = $2 WHERE job_id = $3`, [progress, (b + 1) * batchSize, jobId]);
                    } catch (batchErr) {
                        await workerClient.query('ROLLBACK');
                        console.error(`Batch ${b + 1} failed:`, batchErr.message);
                        rowsFailed += batchSize;
                    }
                }

                // Finalize Job & Write Audit Log
                await workerClient.query(`
                    UPDATE import_jobs 
                    SET status = 'completed', progress_percent = 100, rows_added = $1, rows_updated = $2, rows_failed = $3, rows_skipped = $4, completed_at = NOW()
                    WHERE job_id = $5
                `, [rowsAdded, rowsUpdated, rowsFailed, rowsSkipped, jobId]);

                await workerClient.query(`
                    INSERT INTO import_audit_logs (job_id, module_name, file_name, imported_by, total_rows, rows_added, rows_updated, rows_failed, rows_skipped, status)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'completed')
                `, [jobId, module, fileName || 'import.xlsx', userId, validatedRows.length, rowsAdded, rowsUpdated, rowsFailed, rowsSkipped]);

                console.log(`🎉 [IMPORT JOB COMPLETED] ${jobId} finished: ${rowsAdded} Added, ${rowsUpdated} Updated, ${rowsFailed} Failed.`);
            } catch (e) {
                console.error(`Import Worker Error in ${jobId}:`, e.message);
                await workerClient.query(`UPDATE import_jobs SET status = 'failed', error_message = $1 WHERE job_id = $2`, [e.message, jobId]);
            } finally {
                workerClient.release();
            }
        });
    } catch (e) {
        client.release();
        console.error('Error starting import job:', e.message);
        res.status(500).json({ success: false, message: `Job initialization failed: ${e.message}` });
    }
}

// ── 5. GET IMPORT JOB STATUS (FOR REAL-TIME PROGRESS BAR) ───────────────────
export async function getImportJobStatus(req, res) {
    try {
        const { jobId } = req.params;
        const result = await pool.query(`SELECT * FROM import_jobs WHERE job_id = $1`, [jobId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Import job not found.' });
        }
        res.status(200).json({ success: true, job: result.rows[0] });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
}

// ── 6. GET IMPORT CENTER DASHBOARD STATS ────────────────────────────────────
export async function getImportCenterStats(req, res) {
    try {
        const jobs = await pool.query(`SELECT * FROM import_jobs ORDER BY created_at DESC LIMIT 50`);
        const stats = await pool.query(`
            SELECT 
                COUNT(*) AS total_jobs,
                COUNT(*) FILTER (WHERE status = 'completed') AS completed_jobs,
                COUNT(*) FILTER (WHERE status = 'failed') AS failed_jobs,
                COUNT(*) FILTER (WHERE status = 'processing') AS running_jobs,
                SUM(rows_added) AS total_rows_added,
                SUM(rows_updated) AS total_rows_updated
            FROM import_jobs
        `);

        res.status(200).json({
            success: true,
            stats: stats.rows[0],
            recentJobs: jobs.rows
        });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
}
