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

    const assembledGoals = goalsList.rows.map(goal => ({
      ...goal,
      steps: allTasks.filter(t => t.goal_id === goal.id).map(t => ({
        ...t,
        is_completed: t.status === 'completed'
      }))
    }));

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
    const { title, description, target_date, progress_percent, priority } = req.body;
    
    const result = await db.query(
      `UPDATE goals 
       SET title = COALESCE($1, title), 
           description = COALESCE($2, description), 
           target_date = COALESCE($3, target_date),
           progress_percent = COALESCE($4, progress_percent),
           priority = COALESCE($5, priority),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 AND user_id = $7 
       RETURNING *`,
      [title, description, target_date, progress_percent, priority, id, req.user.id]
    );
    
    if (result.rows.length === 0) return res.status(404).json({ error: 'Goal not found' });
    res.json(result.rows[0]);
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
    res.json({ ...result.rows[0], is_completed: result.rows[0].status === 'completed' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error updating task' });
  }
};

exports.deleteStep = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM goal_tasks WHERE id = $1', [id]);
    res.json({ message: 'Task deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error deleting task' });
  }
};
