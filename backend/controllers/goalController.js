const db = require('../db');

exports.getGoals = async (req, res) => {
  try {
    const goalsList = await db.query(
      'SELECT * FROM goals WHERE user_id = $1 AND is_archived = FALSE ORDER BY created_at DESC', 
      [req.user.id]
    );
    
    const goalIds = goalsList.rows.map(g => g.id);
    let allTasks = [];
    if (goalIds.length > 0) {
      const tasksList = await db.query(
        'SELECT * FROM goal_tasks WHERE goal_id = ANY($1::uuid[]) ORDER BY created_at ASC', 
        [goalIds]
      );
      allTasks = tasksList.rows;
    }

    const assembledGoals = [];
    for (let goal of goalsList.rows) {
      let startDate = goal.start_date;
      if (!startDate) {
        startDate = goal.created_at || new Date();
        await db.query("UPDATE goals SET start_date = $1 WHERE id = $2", [startDate, goal.id]);
      }
      let targetDate = goal.target_date;
      const rd = await db.query("SELECT * FROM roadmaps WHERE goal_id = $1 ORDER BY created_at DESC LIMIT 1", [goal.id]);
      let dur = 30;
      if (rd.rows.length > 0) {
        const roadmapData = rd.rows[0];
        dur = roadmapData.duration_days || 30;
        
        if (roadmapData.metadata) {
          let meta = typeof roadmapData.metadata === 'string' ? JSON.parse(roadmapData.metadata) : roadmapData.metadata;
          let parsedDuration = null;
          if (meta.summary && typeof meta.summary.timeline === 'string') {
            const match = meta.summary.timeline.match(/(\d+)\s*(day|week|month|year)s?/i);
            if (match) {
              const val = parseInt(match[1]);
              const unit = match[2].toLowerCase();
              if (unit === 'day') parsedDuration = val;
              else if (unit === 'week') parsedDuration = val * 7;
              else if (unit === 'month') parsedDuration = val * 30;
              else if (unit === 'year') parsedDuration = val * 365;
            }
          }
          
          let totalRoadmapDays = 0;
          if (meta.months) {
            for (const m of meta.months) {
              if (m.weeks) {
                for (const w of m.weeks) {
                  if (w.days) {
                    totalRoadmapDays += w.days.length;
                  }
                }
              }
            }
          }

          const correctDuration = parsedDuration || totalRoadmapDays;
          if (correctDuration && dur !== correctDuration) {
            dur = correctDuration;
            await db.query("UPDATE roadmaps SET duration_days = $1 WHERE id = $2", [dur, roadmapData.id]);
          }
        }
      }

      const expectedTargetDate = new Date(startDate);
      expectedTargetDate.setDate(expectedTargetDate.getDate() + dur);

      if (!targetDate || Math.abs(Math.ceil((new Date(targetDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) - dur) > 1) {
        targetDate = expectedTargetDate;
        await db.query("UPDATE goals SET target_date = $1 WHERE id = $2", [targetDate, goal.id]);
      }
      
      assembledGoals.push({
        ...goal,
        start_date: startDate,
        target_date: targetDate,
        steps: allTasks.filter(t => t.goal_id === goal.id).map(t => ({
          ...t,
          is_completed: t.status === 'completed'
        }))
      });
    }

    res.json(assembledGoals);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error fetching goals' });
  }
};

exports.createGoal = async (req, res) => {
  try {
    const { title, description, target_date } = req.body;
    const result = await db.query(
      'INSERT INTO goals (user_id, title, description, target_date) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.user.id, title, description, target_date]
    );
    const newGoal = result.rows[0];
    res.json({ ...newGoal, steps: [] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error creating goal' });
  }
};

exports.updateGoal = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, start_date, target_date, progress_percent, priority } = req.body;
    
    // 1. Get existing goal details
    const goalRes = await db.query('SELECT * FROM goals WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (goalRes.rows.length === 0) {
      return res.status(404).json({ error: 'Goal not found' });
    }
    const oldGoal = goalRes.rows[0];

    let finalStartDate = oldGoal.start_date;
    let finalTargetDate = oldGoal.target_date;

    // 2. Handle start_date update and shift task dates
    if (start_date !== undefined && start_date !== null) {
      const oldStart = oldGoal.start_date ? new Date(oldGoal.start_date) : new Date(oldGoal.created_at);
      const newStart = new Date(start_date);
      
      // Calculate local date difference to avoid UTC shift issues
      const oldStartLocal = new Date(oldStart.getFullYear(), oldStart.getMonth(), oldStart.getDate());
      const newStartLocal = new Date(newStart.getFullYear(), newStart.getMonth(), newStart.getDate());
      const shiftTime = newStartLocal.getTime() - oldStartLocal.getTime();
      const shiftDays = Math.round(shiftTime / (1000 * 60 * 60 * 24));

      if (shiftDays !== 0) {
        await db.query(
          `UPDATE goal_tasks SET task_date = task_date + $1::integer WHERE goal_id = $2`,
          [shiftDays, id]
        );
      }
      finalStartDate = start_date;
    }

    if (target_date !== undefined) {
      finalTargetDate = target_date;
    }

    // 3. Update the goal record
    const result = await db.query(
      `UPDATE goals 
       SET title = COALESCE($1, title), 
           description = COALESCE($2, description), 
           start_date = COALESCE($3, start_date),
           target_date = COALESCE($4, target_date),
           progress_percent = COALESCE($5, progress_percent),
           priority = COALESCE($6, priority),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 AND user_id = $8 
       RETURNING *`,
      [title, description, finalStartDate, finalTargetDate, progress_percent, priority, id, req.user.id]
    );

    // 4. Update the active roadmap's duration_days if start/end dates are updated
    if (finalStartDate && finalTargetDate) {
      const sDate = new Date(finalStartDate);
      const tDate = new Date(finalTargetDate);
      
      const sDateLocal = new Date(sDate.getFullYear(), sDate.getMonth(), sDate.getDate());
      const tDateLocal = new Date(tDate.getFullYear(), tDate.getMonth(), tDate.getDate());
      const newDur = Math.max(1, Math.round((tDateLocal.getTime() - sDateLocal.getTime()) / (1000 * 60 * 60 * 24)));

      await db.query(
        `UPDATE roadmaps SET duration_days = $1 WHERE goal_id = $2`,
        [newDur, id]
      );
    }

    res.json({
      ...result.rows[0],
      durationInDays: finalStartDate && finalTargetDate ? 
        Math.round((new Date(finalTargetDate) - new Date(finalStartDate)) / (1000 * 60 * 60 * 24)) : 30
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error updating goal' });
  }
};

exports.deleteGoal = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM goals WHERE id = $1 AND user_id = $2 RETURNING id', [id, req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Goal not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error deleting goal' });
  }
};

exports.createStep = async (req, res) => {
  try {
    const { goal_id, title } = req.body;
    const result = await db.query(
      'INSERT INTO goal_tasks (goal_id, title, task_date) VALUES ($1, $2, CURRENT_DATE) RETURNING *',
      [goal_id, title]
    );
    res.json({ ...result.rows[0], is_completed: false });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error creating step' });
  }
};

exports.updateStep = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_completed, title, status: reqStatus } = req.body;
    
    // Determine target status
    let targetStatus = undefined;
    if (reqStatus !== undefined) {
      targetStatus = reqStatus;
    } else if (is_completed !== undefined) {
      targetStatus = is_completed ? 'completed' : 'pending';
    }

    let query = 'UPDATE goal_tasks SET ';
    const params = [];
    let paramIdx = 1;

    if (title !== undefined) {
      query += `title = $${paramIdx++}, `;
      params.push(title);
    }

    if (targetStatus !== undefined) {
      query += `status = $${paramIdx++}, `;
      params.push(targetStatus);
      
      if (targetStatus === 'completed') {
        query += `completed_at = $${paramIdx++}, `;
        params.push(new Date());

        // Compute streak from previous task
        const prevTaskResult = await db.query(
          `SELECT streak_snapshot, status FROM goal_tasks 
           WHERE goal_id = (SELECT goal_id FROM goal_tasks WHERE id=$1) 
           AND task_date < (SELECT task_date FROM goal_tasks WHERE id=$1) 
           ORDER BY task_date DESC LIMIT 1`,
          [id]
        );
        let newStreak = 1;
        if (prevTaskResult.rows.length > 0 && prevTaskResult.rows[0].status === 'completed') {
          newStreak = (prevTaskResult.rows[0].streak_snapshot || 0) + 1;
        }
        query += `streak_snapshot = $${paramIdx++}, `;
        params.push(newStreak);

      } else if (targetStatus === 'missed') {
        query += `streak_snapshot = $${paramIdx++}, `;
        params.push(0);
        query += `completed_at = $${paramIdx++}, `;
        params.push(null);
      } else {
        // Pending
        query += `completed_at = $${paramIdx++}, `;
        params.push(null);
      }
    }

    if (params.length === 0) return res.status(400).json({ error: 'No fields to update' });

    query = query.slice(0, -2);
    query += `, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramIdx} RETURNING *`;
    params.push(id);

    const result = await db.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Task not found' });

    // Call progress engine
    const { updateGoalProgress } = require('../utils/progressEngine');
    const newProgress = await updateGoalProgress(result.rows[0].goal_id);

    res.json({ 
      ...result.rows[0], 
      is_completed: result.rows[0].status === 'completed',
      progress_percent: newProgress
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error updating task' });
  }
};

exports.deleteStep = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM goal_tasks WHERE id = $1 RETURNING goal_id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Task not found' });

    // Call progress engine
    const { updateGoalProgress } = require('../utils/progressEngine');
    await updateGoalProgress(result.rows[0].goal_id);

    res.json({ message: 'Task deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error deleting task' });
  }
};
