const db = require('../db');
const { processIntake, extractActiveContext } = require('../services/llm/intakeEngine');
const { generateRoadmap } = require('../services/llm/plannerService');
const { populateTaskInstances } = require('../services/taskService');
const { validateTimelineRealism } = require('../services/llm/realismService');

/**
 * Production AI Controller
 * Using normalized schema: goals, roadmaps, roadmap_steps, goal_tasks, goal_sessions.
 */

// 1. Unified Chat Endpoint (Intake + Planning)
exports.chat = async (req, res) => {
  try {
    const { 
      message, 
      goalId, 
      diveDeeper, 
      confirm, 
      goalTitle, 
      startDate: bodyStartDate, 
      targetDate: bodyTargetDate, 
      isTimelineAiGenerated: bodyIsTimelineAiGenerated,
      overrideValidation,
      forkIndex
    } = req.body;
    
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
      const isTimelineAiGeneratedVal = bodyIsTimelineAiGenerated !== undefined ? bodyIsTimelineAiGenerated : true;
      const startVal = bodyStartDate || new Date();
      const targetVal = isTimelineAiGeneratedVal ? null : bodyTargetDate;

      const insertGoal = await db.query(
        `INSERT INTO goals (user_id, status, title, start_date, target_date, is_timeline_ai_generated) 
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [req.user.id, 'onboarding', goalTitle || 'New Goal', startVal, targetVal, isTimelineAiGeneratedVal]
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
    let currentPhase = goalSession.current_phase || 'Phase 1';

    // ── Handle swipe-to-reply or edit fork index ──
    if (forkIndex !== undefined && forkIndex !== null) {
      chatHistory = chatHistory.slice(0, forkIndex);
      // Determine rolled back phase
      const assistantMessages = chatHistory.filter(m => m.role === 'assistant');
      if (assistantMessages.length === 0) {
        currentPhase = 'Phase 1';
      } else {
        const hasExpertMode = chatHistory.some(m => m.content && m.content.includes("Advanced Precision Mode activated"));
        currentPhase = hasExpertMode ? 'Phase 3' : 'Phase 1';
      }
    }

    // FLOW 1: Explicit Confirmation -> Generate Roadmap
    if (confirm) {
      if (bodyStartDate || bodyTargetDate) {
        const startVal = bodyStartDate || (goal.start_date ? goal.start_date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
        const isTimelineAiGeneratedVal = bodyIsTimelineAiGenerated !== undefined ? bodyIsTimelineAiGenerated : false;
        
        let targetVal = null;
        let timelineDays = null;
        
        let activeContext = {};
        if (goal.active_context) {
          activeContext = typeof goal.active_context === 'string' ? JSON.parse(goal.active_context) : goal.active_context;
        }

        if (!isTimelineAiGeneratedVal && bodyTargetDate) {
          targetVal = bodyTargetDate;
          const s = new Date(startVal);
          const t = new Date(targetVal);
          timelineDays = Math.max(1, Math.round((t - s) / 86400000));
          
          activeContext.timelineDays = timelineDays;
          activeContext.timeline = timelineDays === 1 ? `1 day` : `${timelineDays} days`;
        } else {
          // If AI generated, extract conversational timeline from history
          const latestTimeline = extractLatestTimeline(chatHistory);
          if (latestTimeline) {
            timelineDays = latestTimeline.days;
            activeContext.timelineDays = timelineDays;
            activeContext.timeline = latestTimeline.text;
            
            const sDate = new Date(startVal);
            const tDate = new Date(sDate.getTime() + timelineDays * 86400000);
            targetVal = tDate.toISOString().split('T')[0];
          } else {
            // Keep database target date if it exists
            if (goal.target_date) {
              targetVal = goal.target_date.toISOString().split('T')[0];
              const s = new Date(startVal);
              const t = new Date(targetVal);
              timelineDays = Math.max(1, Math.round((t - s) / 86400000));
              
              activeContext.timelineDays = timelineDays;
              activeContext.timeline = timelineDays === 1 ? `1 day` : `${timelineDays} days`;
            } else {
              targetVal = null;
              activeContext.timelineDays = null;
              activeContext.timeline = null;
            }
          }
        }

        await db.query(
          'UPDATE goals SET start_date = $1, target_date = $2, is_timeline_ai_generated = $3, active_context = $4 WHERE id = $5',
          [startVal, targetVal, isTimelineAiGeneratedVal, JSON.stringify(activeContext), goal.id]
        );

        // Refresh goal object
        const goalRes = await db.query('SELECT * FROM goals WHERE id = $1', [goal.id]);
        goal = goalRes.rows[0];
      }

      let userTargetDuration = null;
      const gStart = goal.start_date ? new Date(goal.start_date) : new Date();
      
      // Get the timeline from active context first
      let timelineDays = null;
      if (goal.active_context && typeof goal.active_context === 'object') {
        timelineDays = goal.active_context.timelineDays;
      }
      
      let gTarget = null;
      if (timelineDays) {
        userTargetDuration = timelineDays;
        gTarget = new Date(gStart.getTime() + timelineDays * 86400000);
      } else {
        const latestTimeline = extractLatestTimeline(chatHistory);
        if (latestTimeline) {
          userTargetDuration = latestTimeline.days;
          gTarget = new Date(gStart.getTime() + latestTimeline.days * 86400000);
        } else {
          gTarget = goal.target_date ? new Date(goal.target_date) : null;
          if (goal.is_timeline_ai_generated === false && gTarget) {
            userTargetDuration = Math.max(1, Math.round((gTarget - gStart) / (1000 * 60 * 60 * 24)));
          }
        }
      }

      const validationStartDate = gStart.toISOString().split('T')[0];
      const validationEndDate = gTarget
        ? gTarget.toISOString().split('T')[0]
        : new Date(gStart.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      let skillLevel = 'not specified';
      let constraintsContext = '';
      if (goal.active_context && typeof goal.active_context === 'object') {
        skillLevel = goal.active_context.experience || 'not specified';
        constraintsContext = goal.active_context.constraints || '';
      } else {
        skillLevel = extractSkillLevel(chatHistory);
        constraintsContext = chatHistory.map(m => m.content || '').join(' ').slice(-800);
      }

      const validationResult = await validateTimelineRealism(
        goal.title,
        validationStartDate,
        validationEndDate,
        { skillLevel, context: constraintsContext }
      );

      // Persist validation metadata to goal row
      await db.query(
        `UPDATE goals SET 
          timeline_validity = $1,
          is_aggressive_timeline = $2,
          confidence_score = $3,
          minimum_required_days = $4,
          complexity_score = $5,
          override_validation = $6
         WHERE id = $7`,
        [
          validationResult.validity,
          validationResult.isAggressiveTimeline || false,
          validationResult.confidenceScore ?? 75,
          validationResult.minimumDays ?? null,
          validationResult.complexityScore ?? null,
          overrideValidation ? true : false,
          goal.id
        ]
      );

      // BLOCK if IMPOSSIBLE and no override
      if (validationResult.validity === 'IMPOSSIBLE' && !overrideValidation) {
        return res.status(422).json({
          success: false,
          blocked: true,
          validity: 'IMPOSSIBLE',
          analysis: validationResult.analysis,
          blockerReason: validationResult.blockerReason,
          minimumDays: validationResult.minimumDays,
          minimumDurationText: validationResult.minimumDurationText,
          recommendedDurationText: validationResult.recommendedDurationText,
          complexityScore: validationResult.complexityScore,
          confidenceScore: validationResult.confidenceScore,
          message: `Timeline blocked: ${validationResult.blockerReason || validationResult.analysis}`
        });
      }

      const roadmapJson = await generateRoadmap(chatHistory, userTargetDuration);
      await db.query('UPDATE roadmaps SET locked = TRUE WHERE goal_id = $1', [goal.id]);

      let totalRoadmapDays = 0;
      if (roadmapJson.months) {
        for (const m of roadmapJson.months) {
          if (m.weeks) {
            for (const w of m.weeks) {
              if (w.days) {
                totalRoadmapDays += w.days.length;
              }
            }
          }
        }
      }

      let parsedDuration = null;
      if (roadmapJson.summary && typeof roadmapJson.summary.timeline === 'string') {
        const match = roadmapJson.summary.timeline.match(/(\d+)\s*(day|week|month|year)s?/i);
        if (match) {
          const val = parseInt(match[1]);
          const unit = match[2].toLowerCase();
          if (unit === 'day') parsedDuration = val;
          else if (unit === 'week') parsedDuration = val * 7;
          else if (unit === 'month') parsedDuration = val * 30;
          else if (unit === 'year') parsedDuration = val * 365;
        }
      }

      const durationDays = userTargetDuration || roadmapJson.durationDays || parsedDuration || totalRoadmapDays || 30;

      const roadmapRes = await db.query(
        `INSERT INTO roadmaps (goal_id, duration_days, roadmap_version, generated_by_ai, metadata)
         VALUES ($1, $2, (SELECT COALESCE(MAX(roadmap_version), 0) + 1 FROM roadmaps WHERE goal_id = $1), TRUE, $3) 
         RETURNING id`,
        [
          goal.id, 
          durationDays, 
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

      const isReplan = goal.roadmap_generated;
      if (isReplan) {
        await db.query("DELETE FROM goal_tasks WHERE goal_id = $1 AND status != 'completed'", [goal.id]);
        await db.query("DELETE FROM goal_milestones WHERE goal_id = $1 AND achieved_at IS NULL", [goal.id]);
      }

      await populateTaskInstances(goal.id, roadmapId, roadmapJson);

      const startDate = goal.start_date || (isReplan ? new Date() : new Date());
      let targetDate = goal.target_date;
      if (!targetDate || goal.is_timeline_ai_generated) {
        targetDate = new Date(startDate);
        targetDate.setDate(targetDate.getDate() + durationDays);
      }

      const isTimelineAiGeneratedVal = timelineDays ? false : goal.is_timeline_ai_generated;
      await db.query(
        `UPDATE goals 
         SET status = $1, 
             category = $2, 
             title = $3,
             description = $4,
             roadmap_generated = TRUE,
             goal_setup_finished = $5,
             start_date = $6,
             target_date = $7,
             is_timeline_ai_generated = $8
         WHERE id = $9`,
        [
          isReplan ? 'active' : 'onboarding',
          roadmapJson.goalType || 'Custom', 
          roadmapJson.goalTitle || goal.title, 
          roadmapJson.summary?.goal || '',
          isReplan ? true : false,
          startDate,
          targetDate,
          isTimelineAiGeneratedVal,
          goal.id
        ]
      );

      if (isReplan) {
        const remainingDays = Math.max(1, Math.ceil((targetDate - new Date()) / (1000 * 60 * 60 * 24)));
        const newMilestones = [
          { title: 'Roadmap Refocused', days: 0, description: 'Adjusted and restarted execution plan' },
          { title: 'Midpoint Progression', days: Math.floor(remainingDays / 2), description: 'Reaching the halfway mark of the refocused plan' },
          { title: 'Ultimate Mastery', days: remainingDays, description: 'Achieving the final target' }
        ];
        
        for (const m of newMilestones) {
          const mDate = new Date();
          mDate.setDate(mDate.getDate() + m.days);
          await db.query(
            "INSERT INTO goal_milestones (goal_id, title, description, created_at) VALUES ($1, $2, $3, $4)",
            [goal.id, m.title, m.description, mDate]
          );
        }

        const { updateGoalProgress } = require('../utils/progressEngine');
        await updateGoalProgress(goal.id);
      }

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
      currentPhase = 'Phase 3';
      
      const activeContext = await extractActiveContext(chatHistory);
      const resolvedTarget = goal.target_date 
        ? goal.target_date.toISOString().split('T')[0] 
        : new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
        
      const validationResult = await validateTimelineRealism(
        activeContext.outcome || goal.title,
        goal.start_date ? goal.start_date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        resolvedTarget,
        { skillLevel: activeContext.experience, context: activeContext.constraints }
      );

      await db.query(
        `UPDATE goals SET 
          active_context = $1,
          timeline_validity = $2,
          is_aggressive_timeline = $3,
          confidence_score = $4,
          minimum_required_days = $5,
          complexity_score = $6
         WHERE id = $7`,
        [
          JSON.stringify(activeContext),
          validationResult.validity,
          validationResult.isAggressiveTimeline || false,
          validationResult.confidenceScore ?? 75,
          validationResult.minimumDays ?? null,
          validationResult.complexityScore ?? null,
          goal.id
        ]
      );

      await db.query(
        'UPDATE goal_sessions SET messages = $1, current_phase = $2 WHERE goal_id = $3', 
        [JSON.stringify(chatHistory), currentPhase, goal.id]
      );
      
      return res.json({ 
        success: true, 
        message: intakeResult.responseText, 
        phase: currentPhase, 
        goalId: goal.id,
        messages: chatHistory,
        validationResult,
        activeContext,
        targetDate: goal.target_date ? goal.target_date.toISOString().split('T')[0] : null,
        isTimelineAiGenerated: goal.is_timeline_ai_generated
      });
    }

    // FLOW 3: Standard Chat Intake
    if (!message) {
      return res.status(400).json({ success: false, message: 'Message is required.' });
    }

    const intakeResult = await processIntake(message, chatHistory, currentPhase);
    
    chatHistory.push({ role: 'user', content: message });
    chatHistory.push({ role: 'assistant', content: intakeResult.responseText });

    // Transition phase
    if (intakeResult.isReady && currentPhase === 'Phase 1') {
      currentPhase = 'Phase 2';
    }

    // Extract active context
    const activeContext = await extractActiveContext(chatHistory);
    
    // Update goal target_date and is_timeline_ai_generated if timeline parsed
    // Update goal target_date and is_timeline_ai_generated if timeline parsed
    if (activeContext.timelineDays) {
      const startVal = goal.start_date ? new Date(goal.start_date) : new Date();
      const computedTarget = new Date(startVal.getTime() + activeContext.timelineDays * 86400000);
      const targetVal = computedTarget.toISOString().split('T')[0];
      
      await db.query(
        'UPDATE goals SET target_date = $1, is_timeline_ai_generated = TRUE WHERE id = $2',
        [targetVal, goal.id]
      );
      goal.target_date = computedTarget;
      goal.is_timeline_ai_generated = true;
    } else if (goal.target_date) {
      // Preserve existing manual or AI target date if it exists
      const startVal = goal.start_date ? new Date(goal.start_date) : new Date();
      const tVal = new Date(goal.target_date);
      const days = Math.max(1, Math.round((tVal - startVal) / 86400000));
      activeContext.timelineDays = days;
      activeContext.timeline = days === 1 ? `1 day` : `${days} days`;
    } else {
      await db.query(
        'UPDATE goals SET target_date = NULL, is_timeline_ai_generated = TRUE WHERE id = $1',
        [goal.id]
      );
      goal.target_date = null;
      goal.is_timeline_ai_generated = true;
    }

    // Run feasibility check
    const resolvedTarget = goal.target_date 
      ? goal.target_date.toISOString().split('T')[0] 
      : new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
      
    const validationResult = await validateTimelineRealism(
      activeContext.outcome || goal.title,
      goal.start_date ? goal.start_date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      resolvedTarget,
      { skillLevel: activeContext.experience, context: activeContext.constraints }
    );

    // Save active context and validation results to goal
    await db.query(
      `UPDATE goals SET 
        active_context = $1,
        timeline_validity = $2,
        is_aggressive_timeline = $3,
        confidence_score = $4,
        minimum_required_days = $5,
        complexity_score = $6
       WHERE id = $7`,
      [
        JSON.stringify(activeContext),
        validationResult.validity,
        validationResult.isAggressiveTimeline || false,
        validationResult.confidenceScore ?? 75,
        validationResult.minimumDays ?? null,
        validationResult.complexityScore ?? null,
        goal.id
      ]
    );

    // Update goal title if outcome extracted and matches a new value
    if (activeContext.outcome && activeContext.outcome !== goal.title) {
      await db.query('UPDATE goals SET title = $1 WHERE id = $2', [activeContext.outcome, goal.id]);
      goal.title = activeContext.outcome;
    }

    // Save history and phase
    await db.query(
      'UPDATE goal_sessions SET messages = $1, current_phase = $2 WHERE goal_id = $3', 
      [JSON.stringify(chatHistory), currentPhase, goal.id]
    );

    res.json({ 
      success: true, 
      message: intakeResult.responseText, 
      isReady: intakeResult.isReady, 
      isEnhanced: intakeResult.isEnhanced,
      goalId: goal.id,
      messages: chatHistory,
      validationResult,
      activeContext,
      targetDate: goal.target_date ? goal.target_date.toISOString().split('T')[0] : null,
      isTimelineAiGenerated: goal.is_timeline_ai_generated
    });

  } catch (error) {
    console.error('AI Chat Error:', error.message || error);
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
    // 7-day auto-purge of soft-deleted goals
    await db.query(
      "DELETE FROM goals WHERE user_id = $1 AND deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '7 days'",
      [req.user.id]
    );

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

    // Fetch milestones
    const milestonesRes = await db.query(
      'SELECT * FROM goal_milestones WHERE goal_id = $1 ORDER BY created_at ASC',
      [goal.id]
    );

    let durationDays = 30;
    if (roadmapRes.rows.length > 0) {
      const roadmapData = roadmapRes.rows[0];
      durationDays = roadmapData.duration_days || 30;

      // Self-heal roadmap duration_days if it was set to 30 default but metadata indicates a different duration
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
        if (correctDuration && durationDays !== correctDuration) {
          durationDays = correctDuration;
          await db.query("UPDATE roadmaps SET duration_days = $1 WHERE id = $2", [durationDays, roadmapData.id]);
        }
      }
    }

    let startDate = goal.start_date;
    if (!startDate) {
      startDate = goal.created_at || new Date();
      await db.query("UPDATE goals SET start_date = $1 WHERE id = $2", [startDate, goal.id]);
    }

    let targetDate = goal.target_date;
    const expectedTargetDate = new Date(startDate);
    expectedTargetDate.setDate(expectedTargetDate.getDate() + durationDays);

    // If target date is missing OR if the duration calculated from target_date doesn't match the roadmap duration_days, heal it!
    if (!targetDate || Math.abs(Math.ceil((new Date(targetDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) - durationDays) > 1) {
      targetDate = expectedTargetDate;
      await db.query("UPDATE goals SET target_date = $1 WHERE id = $2", [targetDate, goal.id]);
    }

    const computedDurationDays = Math.ceil((new Date(targetDate) - new Date(startDate)) / (1000 * 60 * 60 * 24));

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
        start_date: startDate,
        target_date: targetDate,
        durationInDays: computedDurationDays,
        roadmap,
        tasks,
        milestones: milestonesRes.rows
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
    const { id } = req.params;
    const userId = req.user.id;
    if (!title) return res.status(400).json({ success: false, message: 'Title is required.' });

    await db.query(
      'UPDATE goals SET title = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3',
      [title, id, userId]
    );

    // Load active_context and validate realism
    const goalRes = await db.query('SELECT * FROM goals WHERE id = $1 AND user_id = $2', [id, userId]);
    const goal = goalRes.rows[0];
    
    let activeContext = {};
    if (goal.active_context) {
      activeContext = typeof goal.active_context === 'string' ? JSON.parse(goal.active_context) : goal.active_context;
    }
    
    const startDate = goal.start_date ? goal.start_date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    const targetDate = goal.target_date ? goal.target_date.toISOString().split('T')[0] : new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

    const validationResult = await validateTimelineRealism(
      title,
      startDate,
      targetDate,
      { skillLevel: activeContext.experience || 'not specified', context: activeContext.constraints || '' }
    );

    await db.query(
      `UPDATE goals SET 
        timeline_validity = $1,
        is_aggressive_timeline = $2,
        confidence_score = $3,
        minimum_required_days = $4,
        complexity_score = $5
       WHERE id = $6`,
      [
        validationResult.validity,
        validationResult.isAggressiveTimeline || false,
        validationResult.confidenceScore ?? 75,
        validationResult.minimumDays ?? null,
        validationResult.complexityScore ?? null,
        id
      ]
    );

    res.json({ success: true, message: 'Goal renamed.', validationResult });
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

    const result = await db.query('UPDATE goals SET deleted_at = NOW() WHERE id = $1 AND user_id = $2', [id, userId]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Goal not found or unauthorized.' });
    }

    res.json({ success: true, message: 'Goal moved to trash.' });
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

    const result = await db.query('UPDATE goals SET deleted_at = NOW() WHERE id = ANY($1) AND user_id = $2', [ids, userId]);
    
    res.json({ 
      success: true, 
      message: `${result.rowCount} goals moved to trash.`,
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

    query += ', updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING goal_id';

    const result = await db.query(query, params);
    if (result.rows.length > 0) {
      const { updateGoalProgress } = require('../utils/progressEngine');
      const newProgress = await updateGoalProgress(result.rows[0].goal_id);
      return res.json({ success: true, message: `Task updated successfully.`, progress_percent: newProgress });
    }
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

    // Get duration from the latest roadmap
    const roadmapRes = await db.query(
      'SELECT duration_days FROM roadmaps WHERE goal_id = $1 ORDER BY created_at DESC LIMIT 1',
      [id]
    );
    const durationDays = roadmapRes.rows.length > 0 ? roadmapRes.rows[0].duration_days : 30;

    // Get goal details to inspect dates
    const goalRes = await db.query(
      'SELECT start_date, target_date, is_timeline_ai_generated, created_at FROM goals WHERE id = $1 AND user_id = $2', 
      [id, userId]
    );
    if (goalRes.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Goal not found.' });
    }
    const currentGoal = goalRes.rows[0];

    let startDate = currentGoal.start_date;
    let targetDate = currentGoal.target_date;

    if (currentGoal.is_timeline_ai_generated) {
      startDate = startDate || currentGoal.created_at || new Date();
      targetDate = new Date(startDate);
      targetDate.setDate(targetDate.getDate() + durationDays);
    } else {
      startDate = startDate || currentGoal.created_at || new Date();
      targetDate = targetDate || new Date(startDate);
      if (!currentGoal.target_date) {
        targetDate.setDate(targetDate.getDate() + durationDays);
      }
    }

    const result = await db.query(
      `UPDATE goals 
       SET status = 'active', 
           goal_setup_finished = TRUE, 
           start_date = $3, 
           target_date = $4,
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 AND user_id = $2 
       RETURNING *`,
      [id, userId, startDate, targetDate]
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
    const duration = durationDays;

    const milestones = [
      { title: 'The First Step', days: 0, description: 'Started the journey' },
      { title: 'Momentum Builder', days: Math.floor(duration / 2), description: 'Reached the halfway mark' },
      { title: 'Goal Mastery', days: duration, description: 'Completed the roadmap' }
    ];

    for (const m of milestones) {
      const milestoneDate = new Date(startDate);
      milestoneDate.setDate(milestoneDate.getDate() + m.days);
      await db.query(
        "INSERT INTO goal_milestones (goal_id, title, description, created_at) VALUES ($1, $2, $3, $4)",
        [id, m.title, m.description, milestoneDate]
      );
    }

    await db.query('COMMIT');

    // Centralized progress calculation
    const { updateGoalProgress } = require('../utils/progressEngine');
    const progress = await updateGoalProgress(id);

    res.json({ success: true, message: 'Goal setup finished.', goal: { ...goal, progress_percent: progress } });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Finish Setup Error:', error);
    res.status(500).json({ success: false, message: 'Error finishing goal setup.' });
  }
};

exports.getCalendar = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Fetch all active goals
    const goalsRes = await db.query(
      "SELECT id, title, category, start_date, target_date, progress_percent, created_at FROM goals WHERE user_id = $1 AND status = 'active' AND deleted_at IS NULL",
      [userId]
    );

    const goals = [];
    for (let goal of goalsRes.rows) {
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

      goals.push({
        ...goal,
        start_date: startDate,
        target_date: targetDate
      });
    }

    // Fetch all tasks for active goals
    const tasksRes = await db.query(
      "SELECT t.*, g.title as goal_title, g.category as goal_category FROM goal_tasks t JOIN goals g ON t.goal_id = g.id WHERE g.user_id = $1 AND g.status = 'active' ORDER BY t.task_date ASC",
      [userId]
    );

    // Fetch all milestones for active goals
    const milestonesRes = await db.query(
      "SELECT m.*, g.title as goal_title, g.category as goal_category FROM goal_milestones m JOIN goals g ON m.goal_id = g.id WHERE g.user_id = $1 AND g.status = 'active' ORDER BY m.created_at ASC",
      [userId]
    );

    res.json({ 
      success: true, 
      goals, 
      tasks: tasksRes.rows, 
      milestones: milestonesRes.rows 
    });
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

    // Call dynamic progress calculation engine
    const { updateGoalProgress } = require('../utils/progressEngine');
    const newProgress = await updateGoalProgress(result.rows[0].goal_id);

    res.json({ success: true, task: result.rows[0], progress_percent: newProgress });
  } catch (error) {
    console.error('Patch Task Status Error:', error);
    res.status(500).json({ success: false, message: 'Error updating task status.' });
  }
};

exports.bulkDeleteGoalsActual = async (req, res) => {
  try {
    const { ids } = req.body;
    const userId = req.user.id;
    const result = await db.query("UPDATE goals SET deleted_at = NOW() WHERE id = ANY($1) AND user_id = $2", [ids, userId]);
    res.json({ success: true, message: `${result.rowCount} goals moved to trash.` });
  } catch (error) {
    console.error('Bulk Delete Error:', error);
    res.status(500).json({ success: false, message: 'Error deleting goals.' });
  }
};

exports.validateTimeline = async (req, res) => {
  try {
    const { goalTitle, startDate, targetDate, skillLevel: clientSkill, context: clientContext, goalId } = req.body;
    if (!goalTitle || !startDate || !targetDate) {
      return res.status(400).json({ success: false, message: 'Missing goalTitle, startDate, or targetDate.' });
    }

    let skillLevel = clientSkill || 'not specified';
    let context = clientContext || '';

    if (goalId) {
      const goalRes = await db.query('SELECT active_context FROM goals WHERE id = $1', [goalId]);
      if (goalRes.rows.length > 0) {
        const activeContext = goalRes.rows[0].active_context || {};
        if (activeContext.experience) {
          skillLevel = activeContext.experience;
        }
        if (activeContext.constraints) {
          context = activeContext.constraints;
        }
      }
    }

    const result = await validateTimelineRealism(goalTitle, startDate, targetDate, { skillLevel, context });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Validate Timeline Error:', error);
    res.status(500).json({ success: false, message: 'Error validating timeline.' });
  }
};

/**
 * Parse the most recent duration mention from a message array.
 * Searches from newest → oldest so the latest update wins.
 * Returns { days, text } or null.
 */
function extractLatestTimeline(messages) {
  const patterns = [
    // "6 months", "3 weeks", "1 year", "30 days"
    /(\d+)\s*(year|month|week|day)s?/i,
    // "half a year" → 180 days
    /half\s+a?\s*year/i,
    // "a month", "a week"
    /\ba\s+(month|week|year|day)\b/i,
  ];

  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role !== 'user') continue;
    const raw = (messages[i]?.content || '');
    const text = raw.toLowerCase();

    // Skip system/probe lines
    if (text.includes('context_sufficient') || text.includes('precision_enhanced')) continue;

    for (const pat of patterns) {
      const m = text.match(pat);
      if (m) {
        if (/half.*year/i.test(m[0])) return { days: 180, text: '6 months' };
        if (/\ba\s+(month)/i.test(m[0])) return { days: 30, text: '1 month' };
        if (/\ba\s+(week)/i.test(m[0])) return { days: 7, text: '1 week' };
        if (/\ba\s+(year)/i.test(m[0])) return { days: 365, text: '1 year' };

        const val = parseInt(m[1]);
        const unit = m[2].toLowerCase();
        let days;
        if (unit === 'day') days = val;
        else if (unit === 'week') days = val * 7;
        else if (unit === 'month') days = val * 30;
        else if (unit === 'year') days = val * 365;
        else continue;

        const label = val === 1 ? `1 ${unit}` : `${val} ${unit}s`;
        return { days, text: label };
      }
    }
  }
  return null;
}

/**
 * Parse skill level from the MOST RECENT relevant message (not a full-history scan).
 */
function extractSkillLevel(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role !== 'user') continue;
    const text = (messages[i]?.content || '').toLowerCase();
    if (/beginner|limited|no experience|never|just starting|new to|novice|zero/.test(text)) return 'beginner';
    if (/intermediate|some experience|familiar|decent|moderate/.test(text)) return 'intermediate';
    if (/expert|advanced|professional|years of|experienced|specialist/.test(text)) return 'expert';
  }
  return 'not specified';
}

/**
 * Feasibility Check — called from FinalConfirmCard BEFORE generation.
 * Uses ACTIVE CONTEXT from conversation (latest timeline wins, not stale DB values).
 */
exports.feasibilityCheck = async (req, res) => {
  try {
    const {
      goalId,
      goalTitle: clientTitle,
      startDate: clientStart,
      targetDate: clientTarget,
      userDurationText: clientDuration,
    } = req.body;

    let goalTitle = clientTitle;
    let startDate = clientStart || new Date().toISOString().split('T')[0];
    let targetDate = clientTarget || null;
    let skillLevel = 'not specified';
    let context = '';
    let userDurationText = clientDuration || null;   // what the user actually said

    if (goalId) {
      const goalRes = await db.query('SELECT * FROM goals WHERE id = $1 AND user_id = $2', [goalId, req.user.id]);
      const goal = goalRes.rows[0];

      if (goal) {
        goalTitle = goal.title || goalTitle;

        // Start date: use clientStart if passed, else DB value, else today
        if (clientStart) {
          startDate = clientStart;
        } else if (goal.start_date) {
          startDate = goal.start_date.toISOString().split('T')[0];
        }

        // Get active_context from DB
        let activeContext = {};
        if (goal.active_context) {
          activeContext = typeof goal.active_context === 'string' ? JSON.parse(goal.active_context) : goal.active_context;
        }

        // Fetch conversation messages for ACTIVE CONTEXT
        const sessionRes = await db.query('SELECT messages FROM goal_sessions WHERE goal_id = $1', [goalId]);
        const msgs = sessionRes.rows[0]?.messages || [];

        let dbUpdateNeeded = false;
        let updateFields = [];
        let updateValues = [];

        // If clientStart is explicitly passed, update start_date
        if (clientStart && clientStart !== (goal.start_date ? goal.start_date.toISOString().split('T')[0] : null)) {
          startDate = clientStart;
          dbUpdateNeeded = true;
          updateFields.push('start_date = $' + (updateValues.length + 1));
          updateValues.push(clientStart);
        }

        // If clientTarget is explicitly passed, override targetDate and set is_timeline_ai_generated = false
        if (clientTarget) {
          const s = new Date(startDate);
          const t = new Date(clientTarget);
          const days = Math.max(1, Math.round((t - s) / 86400000));
          userDurationText = days >= 365
            ? `${Math.round(days / 365)} year${Math.round(days / 365) > 1 ? 's' : ''}`
            : days >= 30
            ? `${Math.round(days / 30)} month${Math.round(days / 30) > 1 ? 's' : ''}`
            : days >= 7
            ? `${Math.round(days / 7)} week${Math.round(days / 7) > 1 ? 's' : ''}`
            : `${days} day${days > 1 ? 's' : ''}`;
          
          activeContext.timelineDays = days;
          activeContext.timeline = userDurationText;
          targetDate = clientTarget;

          dbUpdateNeeded = true;
          updateFields.push('target_date = $' + (updateValues.length + 1));
          updateValues.push(clientTarget);
          updateFields.push('is_timeline_ai_generated = $' + (updateValues.length + 1));
          updateValues.push(false);
          updateFields.push('active_context = $' + (updateValues.length + 1));
          updateValues.push(JSON.stringify(activeContext));
        } else {
          // If no clientTarget is passed, fallback to conversational timeline
          const latestTimeline = extractLatestTimeline(msgs);
          if (latestTimeline) {
            const sDate = new Date(startDate);
            const tDate = new Date(sDate.getTime() + latestTimeline.days * 86400000);
            targetDate = tDate.toISOString().split('T')[0];
            userDurationText = latestTimeline.text;

            activeContext.timelineDays = latestTimeline.days;
            activeContext.timeline = userDurationText;

            dbUpdateNeeded = true;
            updateFields.push('target_date = $' + (updateValues.length + 1));
            updateValues.push(targetDate);
            updateFields.push('is_timeline_ai_generated = $' + (updateValues.length + 1));
            updateValues.push(true); // AI generated
            updateFields.push('active_context = $' + (updateValues.length + 1));
            updateValues.push(JSON.stringify(activeContext));
          } else if (goal.target_date) {
            // Keep database target date (whether manual or AI-generated)
            targetDate = goal.target_date.toISOString().split('T')[0];
            const s = new Date(startDate);
            const t = new Date(targetDate);
            const days = Math.max(1, Math.round((t - s) / 86400000));
            userDurationText = days >= 365
              ? `${Math.round(days / 365)} year${Math.round(days / 365) > 1 ? 's' : ''}`
              : days >= 30
              ? `${Math.round(days / 30)} month${Math.round(days / 30) > 1 ? 's' : ''}`
              : days >= 7
              ? `${Math.round(days / 7)} week${Math.round(days / 7) > 1 ? 's' : ''}`
              : `${days} day${days > 1 ? 's' : ''}`;

            activeContext.timelineDays = days;
            activeContext.timeline = userDurationText;

            dbUpdateNeeded = true;
            updateFields.push('active_context = $' + (updateValues.length + 1));
            updateValues.push(JSON.stringify(activeContext));
          }
        }

        if (dbUpdateNeeded && updateFields.length > 0) {
          updateValues.push(goalId);
          await db.query(
            `UPDATE goals SET ${updateFields.join(', ')} WHERE id = $${updateValues.length}`,
            updateValues
          );
        }

        // Determine skillLevel & context from active_context properties, fallback to extraction from messages
        skillLevel = activeContext.experience || extractSkillLevel(msgs);
        context = activeContext.constraints || msgs.map(m => m.content || '').join(' ').slice(-800);
      }
    }

    if (!goalTitle) {
      return res.status(400).json({ success: false, message: 'Goal title is required for feasibility check.' });
    }

    // If still no target date, use 30-day probe — but mark it so UI can hide it
    const isProbeDate = !targetDate;
    const resolvedTarget = targetDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

    const result = await validateTimelineRealism(goalTitle, startDate, resolvedTarget, { skillLevel, context });

    res.json({
      success: true,
      ...result,
      // Surface the ACTUAL user-stated duration — never the internal probe
      userDurationText: isProbeDate ? null : userDurationText,
      isProbeDate,         // frontend uses this to hide "Selected Duration" if unknown
    });
  } catch (error) {
    console.error('Feasibility Check Error:', error);
    res.status(500).json({ success: false, message: 'Error running feasibility check.' });
  }
};



exports.updateGoalDates = async (req, res) => {
  try {
    const { id } = req.params;
    const { start_date, target_date } = req.body;
    const userId = req.user.id;

    await db.query('BEGIN');

    // Get current goal details
    const goalRes = await db.query(
      'SELECT title, start_date, target_date, is_timeline_ai_generated, active_context FROM goals WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (goalRes.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Goal not found.' });
    }

    const currentGoal = goalRes.rows[0];
    const oldStartDateStr = currentGoal.start_date ? new Date(currentGoal.start_date).toISOString().split('T')[0] : null;
    const oldTargetDateStr = currentGoal.target_date ? new Date(currentGoal.target_date).toISOString().split('T')[0] : null;

    const newStartDateStr = start_date || oldStartDateStr;
    const newTargetDateStr = target_date || oldTargetDateStr;

    // Calculate shift days
    let shiftDays = 0;
    if (start_date && oldStartDateStr) {
      const oldS = new Date(oldStartDateStr);
      const newS = new Date(start_date);
      shiftDays = Math.round((newS - oldS) / (1000 * 60 * 60 * 24));
    }

    // Load active_context and run validateTimelineRealism
    let activeContext = {};
    if (currentGoal.active_context) {
      activeContext = typeof currentGoal.active_context === 'string' ? JSON.parse(currentGoal.active_context) : currentGoal.active_context;
    }

    const validationResult = await validateTimelineRealism(
      currentGoal.title,
      newStartDateStr,
      newTargetDateStr,
      { skillLevel: activeContext.experience || 'not specified', context: activeContext.constraints || '' }
    );

    // Calculate new duration in days
    const calcNewS = new Date(newStartDateStr);
    const calcNewT = new Date(newTargetDateStr);
    const calcDurationDays = Math.max(1, Math.round((calcNewT - calcNewS) / (1000 * 60 * 60 * 24)));

    // Sync active_context
    activeContext.timelineDays = calcDurationDays;
    activeContext.timeline = calcDurationDays === 1 ? `1 day` : `${calcDurationDays} days`;

    // Update goal dates, validation metadata, and mark is_timeline_ai_generated as false (since user edited manually)
    await db.query(
      `UPDATE goals 
       SET start_date = $1, 
           target_date = $2, 
           is_timeline_ai_generated = FALSE,
           timeline_validity = $3,
           is_aggressive_timeline = $4,
           confidence_score = $5,
           minimum_required_days = $6,
           complexity_score = $7,
           active_context = $8,
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $9`,
      [
        newStartDateStr,
        newTargetDateStr,
        validationResult.validity,
        validationResult.isAggressiveTimeline || false,
        validationResult.confidenceScore ?? 75,
        validationResult.minimumDays ?? null,
        validationResult.complexityScore ?? null,
        JSON.stringify(activeContext),
        id
      ]
    );

    // Apply task shifts
    if (shiftDays !== 0) {
      await db.query(
        `UPDATE goal_tasks 
         SET task_date = task_date + $1::integer, 
             updated_at = CURRENT_TIMESTAMP 
         WHERE goal_id = $2`,
        [shiftDays, id]
      );
    }

    // Recalculate duration & update roadmap
    const newS = new Date(newStartDateStr);
    const newT = new Date(newTargetDateStr);
    const durationDays = Math.max(1, Math.round((newT - newS) / (1000 * 60 * 60 * 24)));

    await db.query(
      `UPDATE roadmaps 
       SET duration_days = $1, 
           updated_at = CURRENT_TIMESTAMP 
       WHERE goal_id = $2`,
      [durationDays, id]
    );

    // Redistribute milestones
    await db.query("DELETE FROM goal_milestones WHERE goal_id = $1 AND achieved_at IS NULL", [id]);
    const milestones = [
      { title: 'The First Step', days: 0, description: 'Started the journey' },
      { title: 'Momentum Builder', days: Math.floor(durationDays / 2), description: 'Reached the halfway mark' },
      { title: 'Goal Mastery', days: durationDays, description: 'Completed the roadmap' }
    ];

    for (const m of milestones) {
      const milestoneDate = new Date(newStartDateStr);
      milestoneDate.setDate(milestoneDate.getDate() + m.days);
      await db.query(
        "INSERT INTO goal_milestones (goal_id, title, description, created_at) VALUES ($1, $2, $3, $4)",
        [id, m.title, m.description, milestoneDate]
      );
    }

    await db.query('COMMIT');

    // Centralized progress sync
    const { updateGoalProgress } = require('../utils/progressEngine');
    const newProgress = await updateGoalProgress(id);

    res.json({ 
      success: true, 
      message: 'Goal dates updated and timeline rescheduled.', 
      progress_percent: newProgress,
      validationResult
    });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Update Goal Dates Error:', error);
    res.status(500).json({ success: false, message: 'Error updating goal dates.' });
  }
};

exports.toggleFavoriteGoal = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const result = await db.query(
      'UPDATE goals SET is_favorite = NOT is_favorite WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, userId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Goal not found or unauthorized.' });
    }
    res.json({ success: true, message: 'Favorite status toggled.', goal: result.rows[0] });
  } catch (error) {
    console.error('Toggle Favorite Error:', error);
    res.status(500).json({ success: false, message: 'Error toggling favorite.' });
  }
};

exports.getTrashGoals = async (req, res) => {
  try {
    const userId = req.user.id;
    // 7-day auto-purge of soft-deleted goals
    await db.query(
      "DELETE FROM goals WHERE user_id = $1 AND deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '7 days'",
      [userId]
    );

    const result = await db.query(
      `SELECT *, EXTRACT(EPOCH FROM (deleted_at + INTERVAL '7 days' - NOW())) AS seconds_left
       FROM goals 
       WHERE user_id = $1 AND deleted_at IS NOT NULL 
       ORDER BY deleted_at DESC`,
      [userId]
    );
    res.json({ success: true, goals: result.rows });
  } catch (error) {
    console.error('Get Trash Goals Error:', error);
    res.status(500).json({ success: false, message: 'Error fetching trash goals.' });
  }
};

exports.restoreGoal = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const result = await db.query(
      "UPDATE goals SET deleted_at = NULL WHERE id = $1 AND user_id = $2 RETURNING *",
      [id, userId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Goal not found or unauthorized.' });
    }
    res.json({ success: true, message: 'Goal restored successfully.', goal: result.rows[0] });
  } catch (error) {
    console.error('Restore Goal Error:', error);
    res.status(500).json({ success: false, message: 'Error restoring goal.' });
  }
};

exports.deleteGoalPermanently = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const result = await db.query('DELETE FROM goals WHERE id = $1 AND user_id = $2', [id, userId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Goal not found or unauthorized.' });
    }
    res.json({ success: true, message: 'Goal permanently deleted.' });
  } catch (error) {
    console.error('Permanent Delete Error:', error);
    res.status(500).json({ success: false, message: 'Error permanently deleting goal.' });
  }
};
