import { pool } from '../config/db.js';
import crypto from 'crypto';

/**
 * ⚡ CENTRALIZED EVENT LOGGER SERVICE
 * High-performance, non-blocking event system.
 * Generates unique Event IDs (evt_...) and shared Correlation IDs (corr_...).
 */

export const generateEventId = () => `evt_${crypto.randomBytes(8).toString('hex')}`;
export const generateCorrelationId = () => `corr_${crypto.randomBytes(8).toString('hex')}`;

export const logActivityEvent = async (req, {
    eventId = null,
    correlationId = null,
    eventType,
    category = 'Work', // 'Work', 'Security', 'Attendance', 'Workflow', 'Performance', 'Administration', 'Notification'
    module,
    severity = 'INFO', // 'INFO', 'WARNING', 'ERROR', 'CRITICAL'
    entityType,
    entityId = null,
    entityName = null,
    action,
    oldValue = null,
    newValue = null,
    reason = null,
    impactType = 'Time', // 'Time', 'Cost', 'Security', 'Quality', 'Customer', 'Performance'
    impactDescription = null,
    metadata = {}
}) => {
    try {
        const finalEventId = eventId || generateEventId();
        const finalCorrelationId = correlationId || req?.correlationId || generateCorrelationId();

        const performedBy = req?.user?.employee_id || req?.user?.id || req?.user?.userId || null;
        const ipAddress = req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress || '127.0.0.1';
        const userAgent = req?.headers?.['user-agent'] || 'App Client';
        const platform = req?.headers?.['x-platform'] || (userAgent.includes('Mobile') ? 'Mobile' : 'Desktop/Web');

        const query = `
            INSERT INTO activity_events (
                event_id, correlation_id, event_type, category, module, severity,
                entity_type, entity_id, entity_name, action, performed_by,
                old_value, new_value, reason, impact_type, impact_description,
                metadata, ip_address, platform, browser, created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW())
        `;

        const values = [
            finalEventId,
            finalCorrelationId,
            eventType,
            category,
            module,
            severity,
            entityType,
            entityId,
            entityName,
            action,
            performedBy,
            oldValue ? String(oldValue) : null,
            newValue ? String(newValue) : null,
            reason,
            impactType,
            impactDescription,
            JSON.stringify(metadata || {}),
            ipAddress,
            platform,
            userAgent
        ];

        // Async non-blocking execution to keep API latency under 5ms
        pool.query(query, values).catch(err => {
            console.error('❌ Failed to log activity event:', err.message);
        });

        return { eventId: finalEventId, correlationId: finalCorrelationId };

    } catch (error) {
        console.error('Error in logActivityEvent:', error.message);
        return null;
    }
};
