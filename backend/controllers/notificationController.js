const db = require('../db');
const { evaluateUserNotifications } = require('../services/notificationEngine');

exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Run dynamic evaluation engine
    const evalResult = await evaluateUserNotifications(userId);
    const activeAlerts = evalResult.notifications;

    // 2. Fetch existing notifications in DB
    const dbNotificationsRes = await db.query(
      'SELECT * FROM notifications WHERE user_id = $1',
      [userId]
    );
    const dbNotifications = dbNotificationsRes.rows;

    // Keep track of IDs we match, so we delete obsolete ones
    const activeDbIds = [];

    for (const alert of activeAlerts) {
      // Find matching alert in DB
      const match = dbNotifications.find(dbN => 
        dbN.goal_id === alert.goalId && 
        dbN.category === alert.category
      );

      if (match) {
        // Update message / priority / severity in case they changed
        await db.query(
          `UPDATE notifications 
           SET title = $1, message = $2, priority = $3, severity = $4, action_link = $5, type = $6, updated_at = NOW()
           WHERE id = $7`,
          [
            alert.goalTitle,
            alert.message,
            alert.priority,
            alert.severity,
            alert.actionLink,
            alert.type,
            match.id
          ]
        );
        activeDbIds.push(match.id);
      } else {
        // Insert new notification
        const insertRes = await db.query(
          `INSERT INTO notifications (user_id, goal_id, type, title, message, priority, severity, action_link, category)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id`,
          [
            userId,
            alert.goalId,
            alert.type,
            alert.goalTitle,
            alert.message,
            alert.priority,
            alert.severity,
            alert.actionLink,
            alert.category
          ]
        );
        activeDbIds.push(insertRes.rows[0].id);
      }
    }

    // Delete notifications that are no longer active in evaluation
    // E.g. because goals were deleted, completed, archived, or issues resolved!
    if (activeDbIds.length > 0) {
      await db.query(
        'DELETE FROM notifications WHERE user_id = $1 AND id NOT IN (SELECT unnest($2::uuid[]))',
        [userId, activeDbIds]
      );
    } else {
      await db.query(
        'DELETE FROM notifications WHERE user_id = $1',
        [userId]
      );
    }

    // 3. Fetch final updated list of notifications from DB
    const finalDbRes = await db.query(
      `SELECT n.*, g.title as goal_title, g.category as goal_category, g.is_favorite
       FROM notifications n
       JOIN goals g ON n.goal_id = g.id
       WHERE n.user_id = $1
         AND g.deleted_at IS NULL
         AND g.is_archived = FALSE
         AND g.status = 'active'
         AND (g.progress_percent IS NULL OR g.progress_percent < 100)
       ORDER BY n.created_at DESC`,
      [userId]
    );


    // Score final notifications for ordering
    // (since favorites might have been starred/unstarred since last eval)
    const finalAlerts = finalDbRes.rows.map(n => {
      let score = 10;
      if (n.is_favorite) score += 30;
      if (n.severity === 'danger' || n.priority === 'critical') score += 50;
      if (n.severity === 'warning' || n.priority === 'high') score += 25;
      
      return {
        id: n.id,
        goalId: n.goal_id,
        goalTitle: n.title,
        type: n.type,
        priority: n.priority,
        severity: n.severity,
        message: n.message,
        actionLink: n.action_link,
        category: n.category,
        createdAt: n.created_at,
        isRead: n.read_status,
        expiresAt: n.expires_at,
        score
      };
    });

    // Sort by priority score descending
    finalAlerts.sort((a, b) => b.score - a.score);

    res.json({
      success: true,
      notifications: finalAlerts,
      briefing: evalResult.briefing,
      summary: evalResult.summary
    });
  } catch (error) {
    console.error('Fetch Notifications Error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving notifications.' });
  }
};

exports.markRead = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query(
      'UPDATE notifications SET read_status = TRUE, updated_at = NOW() WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    res.json({ success: true, message: 'Notification marked as read.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error marking notification read.' });
  }
};

exports.markAllRead = async (req, res) => {
  try {
    await db.query(
      'UPDATE notifications SET read_status = TRUE, updated_at = NOW() WHERE user_id = $1',
      [req.user.id]
    );
    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error marking all notifications read.' });
  }
};

exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    res.json({ success: true, message: 'Notification dismissed.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting notification.' });
  }
};

exports.evaluateNotifications = async (req, res) => {
  try {
    const result = await evaluateUserNotifications(req.user.id);
    res.json({ success: true, briefing: result.briefing });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error running validation checks.' });
  }
};
