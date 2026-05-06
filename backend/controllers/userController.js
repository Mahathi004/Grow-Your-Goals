const db = require('../db');

/**
 * User Controller
 * Handles user-specific data like streaks, check-ins, and profile.
 */

exports.getStreak = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await db.query(
      'SELECT current_streak, longest_streak, last_login_at FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    res.json({ success: true, ...result.rows[0] });
  } catch (error) {
    console.error('Get Streak Error:', error);
    res.status(500).json({ success: false, message: 'Error fetching streak data.' });
  }
};

exports.updateCheckin = async (req, res) => {
  try {
    const userId = req.user.id;
    // Use localDate from frontend to handle timezone differences, fallback to UTC
    const today = req.body.localDate || new Date().toISOString().split('T')[0];

    // Check if there's already a check-in for today
    const checkinRes = await db.query(
      'SELECT * FROM user_checkins WHERE user_id = $1 AND date = $2',
      [userId, today]
    );

    if (checkinRes.rows.length > 0) {
      // Already checked in today
      return res.json({ success: true, message: 'Already checked in today.' });
    }

    // Get user's last login/streak info
    const userRes = await db.query(
      'SELECT current_streak, longest_streak, last_login_at FROM users WHERE id = $1',
      [userId]
    );
    const user = userRes.rows[0];

    let newStreak = 1;
    const lastLogin = user.last_login_at ? new Date(user.last_login_at).toISOString().split('T')[0] : null;
    
    // Calculate yesterday relative to "today"
    const todayDate = new Date(today);
    const yesterday = new Date(todayDate);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (lastLogin === yesterdayStr) {
      newStreak = user.current_streak + 1;
    } else if (lastLogin === today) {
      newStreak = user.current_streak;
    }

    const newLongestStreak = Math.max(newStreak, user.longest_streak);

    // Update user streak
    await db.query(
      'UPDATE users SET current_streak = $1, longest_streak = $2, last_login_at = CURRENT_TIMESTAMP, total_checkins = total_checkins + 1 WHERE id = $3',
      [newStreak, newLongestStreak, userId]
    );

    // Record check-in
    await db.query(
      'INSERT INTO user_checkins (user_id, date, streak_count) VALUES ($1, $2, $3)',
      [userId, today, newStreak]
    );

    res.json({ 
      success: true, 
      message: 'Check-in successful!', 
      currentStreak: newStreak, 
      longestStreak: newLongestStreak 
    });
  } catch (error) {
    console.error('Checkin Error:', error);
    res.status(500).json({ success: false, message: 'Error recording check-in.' });
  }
};
