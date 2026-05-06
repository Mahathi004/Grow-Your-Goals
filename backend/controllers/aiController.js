const db = require('../db');
const { processIntake } = require('../services/llm/intakeEngine');
const { generateRoadmap } = require('../services/llm/plannerService');
const { populateTaskInstances } = require('../services/taskService');

/**
 * Production AI Controller
 * Using normalized schema: goals, roadmaps, roadmap_steps, goal_tasks, goal_sessions.
 */

// 1. Unified Chat Endpoint (Intake + Planning)
exports.chat = async (req, res) => {
  try {
    const { message, goalId, diveDeeper, confirm, goalTitle } = req.body;
    
    let goal;
    let goalSession;

    if (goalId) {
      const goalRes = await db.query('SELECT * FROM goals WHERE id = $1 AND user_id = $2', [goalId, req.user.id]);
      goal = goalRes.rows[0];
      if (goal) {
        const sessionRes = await db.query('SELECT * FROM goal_sessions WHERE goal_id = $1', [goal.id]);
        goalSession = sessionRes.rows[0];
        
        if (!goalSession) {
          const insertSession = await db.query(
            'INSERT INTO goal_sessions (goal_id, messages) VALUES ($1, $2) RETURNING *',
            [goal.id, JSON.stringify([])]
          );
          goalSession = insertSession.rows[0];
        }
      }
    }

    if (!goal) {
      const insertGoal = await db.query(
        'INSERT INTO goals (user_id, status, title) VALUES ($1, $2, $3) RETURNING *',
        [req.user.id, 'onboarding', goalTitle || 'New Goal']
      );
      goal = insertGoal.rows[0];
      
      const insertSession = await db.query(
        'INSERT INTO goal_sessions (goal_id, messages) VALUES ($1, $2) RETURNING *',
        [goal.id, JSON.stringify([])]
      );
      goalSession = insertSession.rows[0];
    }

    if (!goalSession) {
      throw new Error('Goal session could not be established.');
    }

    let chatHistory = goalSession.messages || [];
    let currentPhase = 'Phase 1';

    // FLOW 1: Explicit Confirmation -> Generate Roadmap
    if (confirm) {
      const roadmapJson = await generateRoadmap(chatHistory);
      await db.query('UPDATE roadmaps SET locked = TRUE WHERE goal_id = $1', [goal.id]);

      const roadmapRes = await db.query(
        `INSERT INTO roadmaps (goal_id, duration_days, roadmap_version, generated_by_ai, metadata)
         VALUES ($1, $2, (SELECT COALESCE(MAX(roadmap_version), 0) + 1 FROM roadmaps WHERE goal_id = $1), TRUE, $3) 
         RETURNING id`,
        [
          goal.id, 
          roadmapJson.durationDays || 30, 
          JSON.stringify({
            summary: roadmapJson.summary,
            journeyPath: roadmapJson.journeyPath,
            aiInsight: roadmapJson.aiInsight,
            goalType: roadmapJson.goalType,
            goalTitle: roadmapJson.goalTitle
          })
        ]
      );
      const roadmapId = roadmapRes.rows[0].id;
      await populateTaskInstances(goal.id, roadmapId, roadmapJson);

      await db.query(
        `UPDATE goals 
         SET status = 'onboarding', 
             category = $1, 
             title = $2,
             description = $3,
             roadmap_generated = TRUE,
             goal_setup_finished = FALSE
         WHERE id = $4`,
        [
          roadmapJson.goalType || 'Custom', 
          roadmapJson.goalTitle || goal.title, 
          roadmapJson.summary?.goal || '',
          goal.id
        ]
      );

      return res.json({ 
        success: true, 
        isComplete: true, 
        goalId: goal.id,
        roadmap: roadmapJson 
      });
    }

    // FLOW 2: Dive Deeper (Expert Mode)
    if (diveDeeper) {
      currentPhase = 'Phase 2';
      const expertTriggerMsg = "SYSTEM: Advanced Precision Mode activated. Ask me 3-5 targeted follow-up questions for my goal.";
      const intakeResult = await processIntake(expertTriggerMsg, chatHistory, currentPhase);
      
      chatHistory.push({ role: 'assistant', content: intakeResult.responseText });
      await db.query('UPDATE goal_sessions SET messages = $1 WHERE goal_id = $2', [JSON.stringify(chatHistory), goal.id]);
      
      return res.json({ success: true, message: intakeResult.responseText, phase: currentPhase, goalId: goal.id });
    }

    // FLOW 3: Standard Chat Intake
    if (!message) {
      return res.status(400).json({ success: false, message: 'Message is required.' });
    }

    const intakeResult = await processIntake(message, chatHistory, currentPhase);
    
    chatHistory.push({ role: 'user', content: message });
    chatHistory.push({ role: 'assistant', content: intakeResult.responseText });

    await db.query('UPDATE goal_sessions SET messages = $1 WHERE goal_id = $2', [JSON.stringify(chatHistory), goal.id]);

    res.json({ 
      success: true, 
      message: intakeResult.responseText, 
      isReady: intakeResult.isReady, 
      isEnhanced: intakeResult.isEnhanced,
      goalId: goal.id
    });

  } catch (error) {
    console.error('AI Chat Error:', error.message);
    res.status(500).json({ success: false, message: 'AI Engine Error.' });
  }
};

// 1.5 Today Engine
exports.getTodayTasks = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const userId = req.user.id;
    
    // Fetch today's tasks from goal_tasks
    const todayRes = await db.query(`
      SELECT t.*, g.title as goal_title, g.category as goal_type 
      FROM goal_tasks t
      JOIN goals g ON t.goal_id = g.id
      WHERE g.user_id = $1 AND t.task_date = $2 AND g.status = 'active'
      ORDER BY t.created_at DESC
    `, [userId, today]);

    // Fetch overdue tasks (pending from past dates)
    const overdueRes = await db.query(`
      SELECT t.*, g.title as goal_title, g.category as goal_type 
      FROM goal_tasks t
      JOIN goals g ON t.goal_id = g.id
      WHERE g.user_id = $1 AND t.task_date < $2 AND t.status = 'pending' AND g.status = 'active'
      ORDER BY t.task_date ASC
    `, [userId, today]);

    res.json({ 
      success: true, 
      todayTasks: todayRes.rows,
      overdueTasks: overdueRes.rows
    });
  } catch (error) {
    console.error('Today Engine Error:', error);
    res.status(500).json({ success: false, message: 'Error fetching today tasks.' });
  }
};

// 2. Portfolio Management
exports.getAllGoals = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM goals WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ success: true, goals: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching goals.' });
  }
};

exports.getGoalById = async (req, res) => {
  try {
    const goalRes = await db.query(
      'SELECT * FROM goals WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (goalRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Goal not found.' });
    }

    const goal = goalRes.rows[0];

    // Fetch active roadmap
    const roadmapRes = await db.query(
      'SELECT * FROM roadmaps WHERE goal_id = $1 AND locked = FALSE ORDER BY created_at DESC LIMIT 1',
      [goal.id]
    );
    
    let roadmap = null;
    let steps = [];
    let tasks = [];

    if (roadmapRes.rows.length > 0) {
      const roadmapData = roadmapRes.rows[0];
      
      // Fetch steps for this roadmap
      const stepsRes = await db.query(
        'SELECT * FROM roadmap_steps WHERE roadmap_id = $1 ORDER BY order_index ASC',
        [roadmapData.id]
      );
      steps = stepsRes.rows;

      // Fetch tasks for this goal
      const tasksRes = await db.query(
        'SELECT * FROM goal_tasks WHERE goal_id = $1 ORDER BY task_date ASC',
        [goal.id]
      );
      tasks = tasksRes.rows;
      
      roadmap = { ...roadmapData, steps };
    }

    res.json({ 
      success: true, 
      goal: {
        ...goal,
        roadmap,
        tasks
      } 
    });
  } catch (error) {
    console.error('Get Goal Error:', error);
    res.status(500).json({ success: false, message: 'Error fetching goal.' });
  }
};

exports.getGoalHistory = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT messages FROM goal_sessions WHERE goal_id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.json({ success: true, messages: [] });
    }

    res.json({ success: true, messages: result.rows[0].messages || [] });
  } catch (error) {
    console.error('Get History Error:', error);
    res.status(500).json({ success: false, message: 'Error fetching chat history.' });
  }
};

exports.setPrimaryGoal = async (req, res) => {
  try {
    const { isPinned } = req.body;
    // Note: pinned_order or similar can be handled here if needed
    await db.query(
      'UPDATE goals SET priority = $1 WHERE id = $2 AND user_id = $3',
      [isPinned ? 'high' : 'medium', req.params.id, req.user.id]
    );
    res.json({ success: true, message: isPinned ? 'Goal pinned.' : 'Goal unpinned.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating pin status.' });
  }
};

exports.renameGoal = async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Title is required.' });

    await db.query(
      'UPDATE goals SET title = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3',
      [title, req.params.id, req.user.id]
    );

    res.json({ success: true, message: 'Goal renamed.' });
  } catch (error) {
    console.error('Rename Error:', error);
    res.status(500).json({ success: false, message: 'Error renaming goal.' });
  }
};

exports.archiveGoal = async (req, res) => {
  try {
    const { archived } = req.body;
    await db.query(
      'UPDATE goals SET is_archived = $1, status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND user_id = $4',
      [archived, archived ? 'archived' : 'active', req.params.id, req.user.id]
    );
    res.json({ success: true, message: archived ? 'Goal archived.' : 'Goal restored.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error archiving goal.' });
  }
};

exports.deleteGoal = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Foreign keys with ON DELETE CASCADE handle the cleanup of roadmaps, steps, tasks, sessions
    const result = await db.query('DELETE FROM goals WHERE id = $1 AND user_id = $2', [id, userId]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Goal not found or unauthorized.' });
    }

    res.json({ success: true, message: 'Goal deleted successfully.' });
  } catch (error) {
    console.error('Delete Error:', error);
    res.status(500).json({ success: false, message: 'Error deleting goal.' });
  }
};

exports.bulkDeleteGoals = async (req, res) => {
  try {
    const { ids } = req.body;
    const userId = req.user.id;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'IDs array is required.' });
    }

    const result = await db.query('DELETE FROM goals WHERE id = ANY($1) AND user_id = $2', [ids, userId]);
    
    res.json({ 
      success: true, 
      message: `${result.rowCount} goals deleted successfully.`,
      requested: ids.length,
      deleted: result.rowCount
    });
  } catch (error) {
    console.error('Bulk Delete Error:', error);
    res.status(500).json({ success: false, message: 'Error deleting goals.' });
  }
};

exports.bulkArchiveGoals = async (req, res) => {
  try {
    const { ids, archive } = req.body;
    const userId = req.user.id;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'IDs array is required.' });
    }

    const result = await db.query(
      'UPDATE goals SET is_archived = $1, status = $2 WHERE id = ANY($3) AND user_id = $4',
      [archive, archive ? 'archived' : 'active', ids, userId]
    );
    
    res.json({ 
      success: true, 
      message: `${result.rowCount} goals ${archive ? 'archived' : 'restored'} successfully.`,
      requested: ids.length,
      updated: result.rowCount
    });
  } catch (error) {
    console.error('Bulk Archive Error:', error);
    res.status(500).json({ success: false, message: 'Error archiving goals.' });
  }
};

exports.duplicateGoal = async (req, res) => {
  try {
    const { id } = req.params;
    const goalRes = await db.query('SELECT * FROM goals WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (goalRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Goal not found.' });

    const goal = goalRes.rows[0];
    const newTitle = `${goal.title} (Copy)`;

    const insertRes = await db.query(
      `INSERT INTO goals (user_id, title, description, category, status, priority, target_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.user.id, newTitle, goal.description, goal.category, goal.status, goal.priority, goal.target_date]
    );
    const newGoal = insertRes.rows[0];

    // Copy Roadmap
    const roadmapRes = await db.query(
      'SELECT * FROM roadmaps WHERE goal_id = $1 AND locked = FALSE ORDER BY created_at DESC LIMIT 1',
      [id]
    );

    if (roadmapRes.rows.length > 0) {
      const roadmap = roadmapRes.rows[0];
      const newRoadmapRes = await db.query(
        'INSERT INTO roadmaps (goal_id, duration_days, roadmap_version, generated_by_ai) VALUES ($1, $2, $3, $4) RETURNING id',
        [newGoal.id, roadmap.duration_days, 1, roadmap.generated_by_ai]
      );
      const newRoadmapId = newRoadmapRes.rows[0].id;

      // Copy Steps
      const stepsRes = await db.query('SELECT * FROM roadmap_steps WHERE roadmap_id = $1', [roadmap.id]);
      for (const step of stepsRes.rows) {
        await db.query(
          'INSERT INTO roadmap_steps (roadmap_id, title, description, order_index, estimated_days, dependencies, milestone) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [newRoadmapId, step.title, step.description, step.order_index, step.estimated_days, step.dependencies, step.milestone]
        );
      }
    }

    res.json({ success: true, goal: newGoal });
  } catch (error) {
    console.error('Duplicate Error:', error);
    res.status(500).json({ success: false, message: 'Error duplicating goal.' });
  }
};

exports.updateGoalStatus = async (req, res) => {
  try {
    const { status } = req.body;
    await db.query(
      'UPDATE goals SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3',
      [status, req.params.id, req.user.id]
    );
    res.json({ success: true, message: `Goal marked as ${status}.` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating status.' });
  }
};


exports.updateProgress = async (req, res) => {
  try {
    const { progress_percent } = req.body;
    const { id } = req.params;

    await db.query(
      'UPDATE goals SET progress_percent = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3',
      [progress_percent, id, req.user.id]
    );

    res.json({ success: true, progress_percent });
  } catch (error) {
    console.error('Update Progress Error:', error);
    res.status(500).json({ success: false, message: 'Error updating progress.' });
  }
};

exports.updateTaskStatus = async (req, res) => {
  try {
    const { status, task_date } = req.body;
    let query = 'UPDATE goal_tasks SET status = $1';
    let params = [status, req.params.id];

    if (task_date) {
      query += ', task_date = $3';
      params.push(task_date);
    }

    query += ', updated_at = CURRENT_TIMESTAMP WHERE id = $2';

    await db.query(query, params);
    res.json({ success: true, message: `Task updated successfully.` });
  } catch (error) {
    console.error('Update Task Error:', error);
    res.status(500).json({ success: false, message: 'Error updating task.' });
  }
};
exports.finishGoalSetup = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Start transaction
    await db.query('BEGIN');

    const result = await db.query(
      "UPDATE goals SET status = 'active', goal_setup_finished = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2 RETURNING *",
      [id, userId]
    );

    if (result.rowCount === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Goal not found.' });
    }

    const goal = result.rows[0];

    // 1. Create activity log
    await db.query(
      "INSERT INTO goal_activity_logs (goal_id, action, metadata) VALUES ($1, $2, $3)",
      [id, 'Goal officially started', JSON.stringify({ status: 'active', timestamp: new Date() })]
    );

    // 2. Initialize initial milestones (Start, Midpoint, Finish)
    const roadmapRes = await db.query("SELECT duration_days FROM roadmaps WHERE goal_id = $1 ORDER BY created_at DESC LIMIT 1", [id]);
    const duration = roadmapRes.rows[0]?.duration_days || 30;

    const milestones = [
      { title: 'The First Step', days: 0, description: 'Started the journey' },
      { title: 'Momentum Builder', days: Math.floor(duration / 2), description: 'Reached the halfway mark' },
      { title: 'Goal Mastery', days: duration, description: 'Completed the roadmap' }
    ];

    for (const m of milestones) {
      const milestoneDate = new Date();
      milestoneDate.setDate(milestoneDate.getDate() + m.days);
      await db.query(
        "INSERT INTO goal_milestones (goal_id, title, description, created_at) VALUES ($1, $2, $3, $4)",
        [id, m.title, m.description, milestoneDate]
      );
    }

    await db.query('COMMIT');

    res.json({ success: true, message: 'Goal setup finished.', goal });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Finish Setup Error:', error);
    res.status(500).json({ success: false, message: 'Error finishing goal setup.' });
  }
};

exports.getCalendar = async (req, res) => {
  try {
    const userId = req.user.id;
    const tasks = await db.query(
      "SELECT t.*, g.title as goal_title, g.category as goal_category FROM goal_tasks t JOIN goals g ON t.goal_id = g.id WHERE g.user_id = $1 AND g.status = 'active' ORDER BY t.task_date ASC",
      [userId]
    );
    res.json({ success: true, tasks: tasks.rows });
  } catch (error) {
    console.error('Get Calendar Error:', error);
    res.status(500).json({ success: false, message: 'Error fetching calendar.' });
  }
};

exports.getGoalCalendarByMonth = async (req, res) => {
  try {
    const { id, month } = req.params; 
    const userId = req.user.id;
    const year = new Date().getFullYear();

    const tasks = await db.query(
      "SELECT * FROM goal_tasks WHERE goal_id = $1 AND EXTRACT(MONTH FROM task_date) = $2 AND EXTRACT(YEAR FROM task_date) = $3 ORDER BY task_date ASC",
      [id, month, year]
    );

    res.json({ success: true, tasks: tasks.rows });
  } catch (error) {
    console.error('Get Goal Calendar Error:', error);
    res.status(500).json({ success: false, message: 'Error fetching goal calendar.' });
  }
};

exports.patchTaskStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.id;

    const taskCheck = await db.query(
      "SELECT t.* FROM goal_tasks t JOIN goals g ON t.goal_id = g.id WHERE t.id = $1 AND g.user_id = $2",
      [id, userId]
    );

    if (taskCheck.rowCount === 0) {
      return res.status(403).json({ success: false, message: 'Unauthorized or task not found.' });
    }

    const result = await db.query(
      "UPDATE goal_tasks SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *",
      [status, id]
    );

    res.json({ success: true, task: result.rows[0] });
  } catch (error) {
    console.error('Patch Task Status Error:', error);
    res.status(500).json({ success: false, message: 'Error updating task status.' });
  }
};

exports.bulkDeleteGoalsActual = async (req, res) => {
  try {
    const { ids } = req.body;
    const userId = req.user.id;
    const result = await db.query("DELETE FROM goals WHERE id = ANY($1) AND user_id = $2", [ids, userId]);
    res.json({ success: true, message: `${result.rowCount} goals deleted.` });
  } catch (error) {
    console.error('Bulk Delete Error:', error);
    res.status(500).json({ success: false, message: 'Error deleting goals.' });
  }
};
