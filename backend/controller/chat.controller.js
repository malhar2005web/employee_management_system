import { pool } from '../config/db.js';
import { logActivityEvent } from '../services/eventLogger.service.js';

const getEmpId = (req) => {
    if (!req.user) return null;
    return req.user.employee_id || req.user.id || req.user.userId;
};

/**
 * 💬 1. GET CHANNELS (Direct Messages, Task Groups, Department Channels with Presence)
 */
export const getChannels = async (req, res) => {
    try {
        const currentEmpId = getEmpId(req);

        // Fetch DMs (Individual Employees with Live Presence & Unread Count from specific sender)
        const dmsRes = await pool.query(`
            SELECT 
                e.id AS employee_id, e.full_name, e.employee_code,
                d.name AS department_name, ds.title AS designation,
                CASE 
                    WHEN ts.id IS NOT NULL THEN 'Busy'
                    ELSE 'Online'
                END AS presence_status,
                t.title AS active_task_title,
                COALESCE(un.cnt, 0)::INT AS unread_count
            FROM employees e
            LEFT JOIN departments d ON e.department_id = d.id
            LEFT JOIN designations ds ON e.designation_id = ds.id
            LEFT JOIN task_sessions ts ON (ts.employee_id = e.id AND ts.status = 'Running')
            LEFT JOIN tasks t ON ts.task_id = t.id
            LEFT JOIN (
                SELECT sender_id, COUNT(*)::INT AS cnt 
                FROM notifications 
                WHERE recipient_id = $1 AND is_read = false AND sender_id IS NOT NULL AND sender_id != $1 AND (type = 'Chat' OR type = 'Mention Alert')
                GROUP BY sender_id
            ) un ON e.id = un.sender_id
            WHERE e.id != $1 AND (e.status = 'Active' OR e.status = 'active' OR e.status IS NULL)
            ORDER BY unread_count DESC, e.full_name ASC
        `, [currentEmpId || 0]);

        // Auto-ensure Department Channels exist for all departments
        await pool.query(`
            INSERT INTO chat_channels (channel_type, name, department_id)
            SELECT 'Department', '#' || name, id FROM departments d
            WHERE NOT EXISTS (
                SELECT 1 FROM chat_channels cc WHERE cc.department_id = d.id AND cc.channel_type = 'Department'
            )
        `);

        // Auto-ensure Task Group Channels exist for all active tasks
        await pool.query(`
            INSERT INTO chat_channels (channel_type, name, task_id)
            SELECT 'TaskGroup', title, id FROM tasks t
            WHERE NOT EXISTS (
                SELECT 1 FROM chat_channels cc WHERE cc.task_id = t.id AND cc.channel_type = 'TaskGroup'
            )
        `);

        // Fetch Task/Project Group Channels with Unread count by channel_id
        const taskGroupsRes = await pool.query(`
            SELECT DISTINCT c.id, c.name, c.task_id, c.project_id, c.customer_id, c.is_pinned,
                   COALESCE(t.title, c.name) AS task_title,
                   COALESCE(un.cnt, 0)::INT AS unread_count
            FROM chat_channels c
            LEFT JOIN tasks t ON c.task_id = t.id
            LEFT JOIN chat_channel_members ccm ON c.id = ccm.channel_id
            LEFT JOIN (
                SELECT channel_id, COUNT(*)::INT AS cnt 
                FROM notifications 
                WHERE recipient_id = $1 AND is_read = false AND channel_id IS NOT NULL
                GROUP BY channel_id
            ) un ON c.id = un.channel_id
            WHERE c.channel_type = 'TaskGroup' AND (
                ccm.employee_id = $1 OR 
                c.task_id IS NULL OR
                EXISTS (
                    SELECT 1 FROM tasks t2 WHERE t2.id = c.task_id AND $1 = ANY(t2.assigned_to)
                )
            )
            ORDER BY unread_count DESC, c.is_pinned DESC, c.id DESC
        `, [currentEmpId || 0]);

        // Fetch Department Channels with Unread count by channel_id
        const deptsRes = await pool.query(`
            SELECT c.id, c.name, c.department_id, c.is_pinned, d.name AS department_name,
                   COALESCE(un.cnt, 0)::INT AS unread_count
            FROM chat_channels c
            JOIN departments d ON c.department_id = d.id
            LEFT JOIN (
                SELECT channel_id, COUNT(*)::INT AS cnt 
                FROM notifications 
                WHERE recipient_id = $1 AND is_read = false AND channel_id IS NOT NULL
                GROUP BY channel_id
            ) un ON c.id = un.channel_id
            WHERE c.channel_type = 'Department'
            ORDER BY unread_count DESC, c.name ASC
        `, [currentEmpId || 0]);

        return res.json({
            success: true,
            data: {
                directMessages: dmsRes.rows,
                taskGroups: taskGroupsRes.rows,
                departmentChannels: deptsRes.rows
            }
        });

    } catch (error) {
        console.error('Error fetching chat channels:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch channels' });
    }
};

/**
 * 🧵 2. GET CHANNEL THREAD MESSAGES
 */
export const getChannelMessages = async (req, res) => {
    try {
        const { channelId } = req.params;

        const result = await pool.query(`
            SELECT 
                cm.id, cm.channel_id, cm.sender_id, cm.message_type, cm.reply_to_message_id,
                cm.message_text, cm.mentions, cm.attachments, cm.seen_by, cm.created_at,
                e.full_name AS sender_name
            FROM chat_messages cm
            LEFT JOIN employees e ON cm.sender_id = e.id
            WHERE cm.channel_id = $1
            ORDER BY cm.created_at ASC
            LIMIT 200
        `, [channelId]);

        return res.json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error('Error fetching channel messages:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch messages' });
    }
};

/**
 * 🚀 3. SEND CHAT MESSAGE WITH `@mention` PARSER & NOTIFICATIONS
 */
export const sendMessage = async (req, res) => {
    try {
        const senderId = getEmpId(req);
        const { channelId, messageText, replyToMessageId, messageType = 'TEXT' } = req.body;
        const file = req.file;

        if (!channelId || (!messageText && !file)) {
            return res.status(400).json({ success: false, message: 'channelId and messageText or file are required' });
        }

        const msgText = messageText || (file ? `📎 ${file.originalname}` : '');
        const finalMessageType = file ? 'FILE' : messageType;

        // Build attachments array if file present
        let attachments = [];
        if (file) {
            attachments.push({
                url: `/uploads/chat/${file.filename}`,
                name: file.originalname,
                type: file.mimetype,
                size: file.size
            });
        }

        // Parse @mentions from text
        const mentionRegex = /@([A-Za-z0-9_\s]+)/g;
        const matches = [...msgText.matchAll(mentionRegex)];
        const mentionedNames = matches.map(m => m[1].trim());

        let mentionedEmpIds = [];
        if (mentionedNames.length > 0) {
            const empRes = await pool.query(
                `SELECT id, full_name FROM employees WHERE full_name ILIKE ANY($1)`,
                [mentionedNames.map(n => `%${n}%`)]
            );
            mentionedEmpIds = empRes.rows.map(r => r.id);
        }

        // Insert chat message
        const insertRes = await pool.query(`
            INSERT INTO chat_messages (channel_id, sender_id, message_type, reply_to_message_id, message_text, mentions, attachments, created_at)
            VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, NOW())
            RETURNING *
        `, [channelId, senderId, finalMessageType, replyToMessageId || null, msgText, JSON.stringify(mentionedEmpIds), JSON.stringify(attachments)]);

        const newMessage = insertRes.rows[0];

        // Fetch channel details & recipients
        const chanRes = await pool.query(`SELECT * FROM chat_channels WHERE id = $1`, [channelId]);
        const chan = chanRes.rows[0];
        const senderRes = await pool.query(`SELECT full_name FROM employees WHERE id = $1`, [senderId]);
        const senderName = senderRes.rows[0]?.full_name || 'Team Member';

        let recipientIds = [];
        if (chan) {
            if (chan.channel_type === 'TaskGroup' && chan.task_id) {
                const taskRes = await pool.query(`SELECT assigned_to FROM tasks WHERE id = $1`, [chan.task_id]);
                const assigned = taskRes.rows[0]?.assigned_to;
                recipientIds = Array.isArray(assigned) ? assigned : (assigned ? [assigned] : []);
            } else if (chan.channel_type === 'Department' && chan.department_id) {
                const deptRes = await pool.query(`SELECT id FROM employees WHERE department_id = $1`, [chan.department_id]);
                recipientIds = deptRes.rows.map(r => r.id);
            }
        }

        // Build notification message
        const notifText = file 
            ? `${senderName}: 📎 ${file.originalname}`
            : `${senderName}: ${msgText.length > 50 ? msgText.substring(0, 47) + '...' : msgText}`;

        // Notify all channel recipients (strictly excluding sender)
        for (const recipientId of recipientIds) {
            if (recipientId && recipientId !== senderId) {
                await pool.query(`
                    INSERT INTO notifications (title, message, type, recipient_id, sender_id, channel_id)
                    VALUES ($1, $2, 'Chat', $3, $4, $5)
                `, [
                    `New message in ${chan?.name || 'Group Chat'}`,
                    notifText,
                    recipientId,
                    senderId,
                    parseInt(channelId, 10)
                ]);
            }
        }

        // Dispatch Notifications for Tagged Users
        for (const empId of mentionedEmpIds) {
            if (empId !== senderId) {
                await pool.query(`
                    INSERT INTO notifications (title, message, type, recipient_id, sender_id, channel_id)
                    VALUES ($1, $2, 'Mention Alert', $3, $4, $5)
                `, [
                    'Tagged in Chat Room',
                    `You were mentioned by ${senderName}: "${msgText.substring(0, 50)}..."`,
                    empId,
                    senderId,
                    parseInt(channelId, 10)
                ]);
            }
        }

        return res.status(201).json({
            success: true,
            data: newMessage
        });

    } catch (error) {
        console.error('Error sending chat message:', error);
        return res.status(500).json({ success: false, message: 'Failed to send chat message' });
    }
};

/**
 * ✅ 4. MARK CHANNEL OR CONTACT NOTIFICATIONS READ
 */
export const markChannelRead = async (req, res) => {
    try {
        const currentEmpId = getEmpId(req);
        const { channelId } = req.params;
        const { contactId } = req.query;

        if (channelId && channelId !== '0') {
            await pool.query(`
                UPDATE notifications 
                SET is_read = true 
                WHERE recipient_id = $1 AND channel_id = $2
            `, [currentEmpId, parseInt(channelId, 10)]);
        } else if (contactId) {
            await pool.query(`
                UPDATE notifications 
                SET is_read = true 
                WHERE recipient_id = $1 AND sender_id = $2
            `, [currentEmpId, parseInt(contactId, 10)]);
        }

        return res.json({ success: true, message: 'Notifications marked as read' });
    } catch (error) {
        console.error('Error marking channel notifications read:', error);
        return res.status(500).json({ success: false, message: 'Failed to mark read' });
    }
};
