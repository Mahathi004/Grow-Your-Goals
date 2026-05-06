const db = require('../db');

/**
 * Task Service
 * Handles population and updates of goal_tasks and roadmap_steps.
 */

exports.populateTaskInstances = async (goalId, roadmapId, roadmapJson) => {

  try {
    if (!roadmapJson.months) return;

    let stepOrder = 1;
    for (const month of roadmapJson.months) {
      // Create a roadmap step for each month as a high-level milestone
      const stepRes = await db.query(
        `INSERT INTO roadmap_steps (roadmap_id, title, description, order_index, estimated_days)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [roadmapId, `Month ${month.month}: ${month.focus || 'Development'}`, month.summary || '', stepOrder++, 30]
      );
      const stepId = stepRes.rows[0].id;

      if (!month.weeks) continue;
      for (const week of month.weeks) {
        if (!week.days) continue;
        for (const day of week.days) {
          if (!day.tasks) continue;
          for (const task of day.tasks) {
            await db.query(
              `INSERT INTO goal_tasks (goal_id, roadmap_step_id, task_date, title, description, status)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [goalId, stepId, day.date, task.task, task.description || '', 'pending']
            );
          }
        }
      }
    }
    

  } catch (error) {
    // Silent catch or handled by caller
    throw error;
  }
};
