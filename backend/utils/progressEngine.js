const db = require('../db');

/**
 * Recalculates the dynamic progress score of a goal and saves it to the database.
 * 
 * Formula:
 * - Tasks Completion Rate (80% weight)
 * - Milestone Achievement Rate (20% weight)
 * - Overdue Penalty: -1.5% for each task scheduled in the past (before today) that is not completed (max -15% penalty)
 * - Streak Bonus: +0.5% per streak day of the user (max +10% bonus)
 * 
 * @param {string} goalId The UUID of the goal
 * @returns {Promise<number>} The updated progress percentage (0 - 100)
 */
async function updateGoalProgress(goalId) {
  try {
    // 1. Fetch Task counts
    const tasksRes = await db.query(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN task_date < CURRENT_DATE AND status != 'completed' THEN 1 END) as overdue
       FROM goal_tasks 
       WHERE goal_id = $1`,
      [goalId]
    );
    
    const totalTasks = parseInt(tasksRes.rows[0]?.total || 0);
    const completedTasks = parseInt(tasksRes.rows[0]?.completed || 0);
    const overdueTasks = parseInt(tasksRes.rows[0]?.overdue || 0);

    // 2. Fetch Milestone counts
    const milestonesRes = await db.query(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN achieved_at IS NOT NULL THEN 1 END) as completed
       FROM goal_milestones 
       WHERE goal_id = $1`,
      [goalId]
    );

    const totalMilestones = parseInt(milestonesRes.rows[0]?.total || 0);
    const completedMilestones = parseInt(milestonesRes.rows[0]?.completed || 0);

    // 3. Fetch User Streak
    const userRes = await db.query(
      `SELECT u.current_streak 
       FROM users u 
       JOIN goals g ON g.user_id = u.id 
       WHERE g.id = $1`,
      [goalId]
    );
    const currentStreak = parseInt(userRes.rows[0]?.current_streak || 0);

    // 4. Calculate Raw Progress
    let taskProgress = totalTasks > 0 ? (completedTasks / totalTasks) * 80 : 0;
    let milestoneProgress = totalMilestones > 0 ? (completedMilestones / totalMilestones) * 20 : 0;
    
    // If there are no milestones, task progress scales to 100%
    if (totalMilestones === 0) {
      taskProgress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    }

    const rawProgress = taskProgress + milestoneProgress;

    // 5. Calculate Penalty and Bonus
    const overduePenalty = Math.min(overdueTasks * 1.5, 15.0); // max -15%
    const streakBonus = Math.min(currentStreak * 0.5, 10.0); // max +10%

    // 6. Calculate Final Percentage
    const finalProgress = Math.max(0, Math.min(100, Math.round(rawProgress - overduePenalty + streakBonus)));

    // 7. Update Database
    await db.query(
      `UPDATE goals 
       SET progress_percent = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2`,
      [finalProgress, goalId]
    );

    return finalProgress;
  } catch (error) {
    console.error('Error calculating goal progress:', error);
    return 0;
  }
}

module.exports = {
  updateGoalProgress
};
