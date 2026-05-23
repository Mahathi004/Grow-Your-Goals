const db = require('../db');

/**
 * Intelligent Notification Engine
 * Analyzes active user goals and tasks, predicts risks, scores priorities, merges alerts, and compiles briefings.
 */
async function evaluateUserNotifications(userId) {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // 1. Fetch active goals for this user
  // Active goals: setup is finished, not archived, status is active, not completed (progress < 100), and not soft-deleted
  const goalsRes = await db.query(
    `SELECT * FROM goals 
     WHERE user_id = $1 
       AND goal_setup_finished = TRUE 
       AND status = 'active' 
       AND is_archived = FALSE 
       AND deleted_at IS NULL
       AND (progress_percent IS NULL OR progress_percent < 100)`,
    [userId]
  );
  const activeGoals = goalsRes.rows;


  if (activeGoals.length === 0) {
    return {
      notifications: [],
      briefing: {
        goalsAtRisk: 0,
        milestonesDue: 0,
        roadmapsImproving: 0,
        suggestedFocus: "None (Set up a goal to start)",
        briefText: "You have no active goals in execution mode. Start a new goal to activate AI tracking."
      },
      summary: "No goals require attention today."
    };
  }

  const rawNotifications = [];

  // Statistics for the AI Briefing
  let goalsAtRiskCount = 0;
  let milestonesDueCount = 0;
  let roadmapsImprovingCount = 0; // Goals with progress increases or consecutive days of task completion

  // 2. Evaluate each goal dynamically
  for (const goal of activeGoals) {
    const goalId = goal.id;
    const isFavorite = goal.is_favorite || false;

    // Fetch tasks for this goal
    const tasksRes = await db.query(
      `SELECT t.*, r.milestone as is_milestone 
       FROM goal_tasks t
       LEFT JOIN roadmap_steps r ON t.roadmap_step_id = r.id
       WHERE t.goal_id = $1
       ORDER BY t.task_date ASC`,
      [goalId]
    );
    const tasks = tasksRes.rows;

    // A. Goal Drift Detection (Inactivity)
    const completedTasks = tasks.filter(t => t.status === 'completed' || t.status === 'partial');
    let lastActivityDate = goal.start_date ? new Date(goal.start_date) : new Date(goal.created_at);
    if (completedTasks.length > 0) {
      // Find the latest completed task date
      const dates = completedTasks.map(t => new Date(t.completed_at || t.task_date));
      lastActivityDate = new Date(Math.max(...dates));
    }
    const inactiveDays = (now - lastActivityDate) / (1000 * 60 * 60 * 24);

    if (inactiveDays > 3) {
      const days = Math.floor(inactiveDays);
      rawNotifications.push({
        goalId,
        goalTitle: goal.title,
        type: 'STRATEGIC',
        priority: isFavorite ? 'critical' : 'high',
        severity: 'warning',
        message: `Roadmap inactive for ${days} days.`,
        actionLink: `/calendar?id=${goalId}`,
        category: 'Goal Drift',
        inactiveDays: days,
        isDrift: true
      });
    }

    // B. Burnout Detection (High Task Density)
    // Group pending or partial tasks by task_date
    const densityMap = {};
    tasks.forEach(t => {
      if (t.status === 'pending' || t.status === 'partial') {
        const dateStr = new Date(t.task_date).toISOString().split('T')[0];
        densityMap[dateStr] = (densityMap[dateStr] || 0) + 1;
      }
    });

    // Check if any day has more than 5 tasks
    let highDensityDetected = false;
    for (const date in densityMap) {
      if (densityMap[date] > 5) {
        highDensityDetected = true;
        break;
      }
    }

    if (highDensityDetected) {
      rawNotifications.push({
        goalId,
        goalTitle: goal.title,
        type: 'STRATEGIC',
        priority: isFavorite ? 'high' : 'medium',
        severity: 'warning',
        message: `High task density detected.`,
        actionLink: `/calendar?id=${goalId}`,
        category: 'Burnout Warning',
        isBurnout: true
      });
    }

    // C. Timeline Collapse Prediction
    const targetDate = goal.target_date ? new Date(goal.target_date) : null;
    const startDate = goal.start_date ? new Date(goal.start_date) : new Date(goal.created_at);
    const progress = goal.progress_percent || 0.0;

    if (targetDate && startDate) {
      const totalDurationDays = Math.max(1, (targetDate - startDate) / (1000 * 60 * 60 * 24));
      const daysElapsed = Math.max(0, (now - startDate) / (1000 * 60 * 60 * 24));
      const daysRemaining = (targetDate - now) / (1000 * 60 * 60 * 24);

      if (daysElapsed > 2 && progress > 0) {
        const velocity = progress / daysElapsed; // percent progress completed per day
        const remainingProgress = 100 - progress;
        const expectedDaysNeeded = remainingProgress / velocity;

        if (expectedDaysNeeded > daysRemaining && daysRemaining > 0) {
          const delayDays = Math.ceil(expectedDaysNeeded - daysRemaining);
          if (delayDays > 2) {
            rawNotifications.push({
              goalId,
              goalTitle: goal.title,
              type: 'CRITICAL',
              priority: isFavorite ? 'critical' : 'high',
              severity: 'danger',
              message: `Projected target delay of ${delayDays} days.`,
              actionLink: `/roadmap/${goalId}`,
              category: 'Timeline Collapse',
              delayDays,
              isCollapse: true
            });
            goalsAtRiskCount++;
          }
        }
      }
    }

    // D. Milestone Overdue / Due
    const overdueTasks = tasks.filter(t => {
      const taskDate = new Date(t.task_date).toISOString().split('T')[0];
      return t.status === 'pending' && taskDate < todayStr;
    });

    if (overdueTasks.length > 0) {
      rawNotifications.push({
        goalId,
        goalTitle: goal.title,
        type: 'CRITICAL',
        priority: isFavorite ? 'critical' : 'high',
        severity: 'danger',
        message: `${overdueTasks.length} overdue tasks pending.`,
        actionLink: `/calendar?id=${goalId}`,
        category: 'Milestone Overdue',
        isOverdue: true
      });
    }

    // Today/Tomorrow Milestone Due
    const milestoneTasksDueToday = tasks.filter(t => {
      const taskDate = new Date(t.task_date).toISOString().split('T')[0];
      return t.is_milestone && t.status === 'pending' && taskDate === todayStr;
    });

    if (milestoneTasksDueToday.length > 0) {
      milestoneTasksDueToday.forEach(m => {
        rawNotifications.push({
          goalId,
          goalTitle: goal.title,
          type: 'GOAL-SPECIFIC',
          priority: isFavorite ? 'high' : 'medium',
          severity: 'info',
          message: `Milestone "${m.title}" due today.`,
          actionLink: `/calendar?id=${goalId}`,
          category: 'Milestone Due',
          isDueToday: true
        });
        milestonesDueCount++;
      });
    }

    // E. Recovery Suggestion
    const collapseOrDrift = rawNotifications.find(n => n.goalId === goalId && (n.isCollapse || n.isDrift));
    if (collapseOrDrift || overdueTasks.length > 3) {
      rawNotifications.push({
        goalId,
        goalTitle: goal.title,
        type: 'STRATEGIC',
        priority: isFavorite ? 'high' : 'medium',
        severity: 'info',
        message: `AI recovery plan recommended.`,
        actionLink: `/dashboard?mode=chat&goalId=${goalId}`,
        category: 'Recovery Suggestion',
        isRecovery: true
      });
    }

    // F. Progress & Improving Check
    // If progress is > 70% or recently checked in 3 tasks consecutively
    const recentlyCompleted = tasks.filter(t => {
      const taskDate = new Date(t.task_date).toISOString().split('T')[0];
      return (t.status === 'completed') && (taskDate >= todayStr);
    });

    if (recentlyCompleted.length > 0) {
      roadmapsImprovingCount++;
      if (progress >= 90 && progress < 100) {
        rawNotifications.push({
          goalId,
          goalTitle: goal.title,
          type: 'PROGRESS',
          priority: 'medium',
          severity: 'info',
          message: `90% complete. Final steps in reach.`,
          actionLink: `/roadmap/${goalId}`,
          category: 'Roadmap Acceleration'
        });
      }
    }

    // G. Goal-Specific Reminders based on Category / Title keywords
    const categoryLower = (goal.category || '').toLowerCase();
    const titleLower = (goal.title || '').toLowerCase();

    if (categoryLower.includes('health') || categoryLower.includes('fit') || titleLower.includes('weight') || titleLower.includes('diet') || titleLower.includes('exercise')) {
      const todayPendingWorkout = tasks.some(t => {
        const taskDate = new Date(t.task_date).toISOString().split('T')[0];
        return t.status === 'pending' && taskDate === todayStr && (t.title.toLowerCase().includes('workout') || t.title.toLowerCase().includes('exercise') || t.title.toLowerCase().includes('gym') || t.title.toLowerCase().includes('run'));
      });
      if (todayPendingWorkout) {
        rawNotifications.push({
          goalId,
          goalTitle: goal.title,
          type: 'GOAL-SPECIFIC',
          priority: 'low',
          severity: 'info',
          message: `Workout activity scheduled today.`,
          actionLink: `/calendar?id=${goalId}`,
          category: 'Goal-Specific Reminder',
          isWorkout: true
        });
      }
    } else if (categoryLower.includes('gardening') || categoryLower.includes('plant') || categoryLower.includes('nature') || titleLower.includes('sunflower') || titleLower.includes('grow')) {
      const todayWatering = tasks.some(t => {
        const taskDate = new Date(t.task_date).toISOString().split('T')[0];
        return t.status === 'pending' && taskDate === todayStr && (t.title.toLowerCase().includes('water') || t.title.toLowerCase().includes('growth') || t.title.toLowerCase().includes('soil'));
      });
      if (todayWatering) {
        rawNotifications.push({
          goalId,
          goalTitle: goal.title,
          type: 'GOAL-SPECIFIC',
          priority: 'low',
          severity: 'info',
          message: `Watering check scheduled today.`,
          actionLink: `/calendar?id=${goalId}`,
          category: 'Goal-Specific Reminder',
          isWatering: true
        });
      }
    }
  }

  // 3. Score all notifications
  const scoredNotifications = rawNotifications.map(notification => {
    const goal = activeGoals.find(g => g.id === notification.goalId);
    const isFavorite = goal ? goal.is_favorite : false;
    
    let score = 10; // Base score
    
    // Add weights
    if (isFavorite) score += 30; // Favorite priority weight
    if (notification.severity === 'danger' || notification.priority === 'critical') score += 50;
    if (notification.severity === 'warning' || notification.priority === 'high') score += 25;
    
    if (notification.inactiveDays) {
      score += Math.min(25, notification.inactiveDays * 5); // Drift weight
    }
    
    if (notification.delayDays) {
      score += Math.min(30, notification.delayDays * 5); // Collapse weight
    }

    // Deadline proximity weight
    if (goal && goal.target_date) {
      const daysRemaining = (new Date(goal.target_date) - now) / (1000 * 60 * 60 * 24);
      if (daysRemaining <= 7 && daysRemaining > 0) {
        score += (8 - daysRemaining) * 5;
      }
    }

    // Low confidence weight
    if (goal && goal.confidence_score < 50) {
      score += (100 - goal.confidence_score) * 0.5;
    }

    return {
      ...notification,
      score
    };
  });

  // 4. Intelligent Merge & Deduplication per Goal
  // "Multiple notifications from the same goal should be intelligently merged to avoid spam."
  const mergedNotifications = [];
  const notificationsByGoal = {};

  scoredNotifications.forEach(n => {
    if (!notificationsByGoal[n.goalId]) {
      notificationsByGoal[n.goalId] = [];
    }
    notificationsByGoal[n.goalId].push(n);
  });

  for (const goalId in notificationsByGoal) {
    const goalAlerts = notificationsByGoal[goalId];
    
    if (goalAlerts.length === 1) {
      mergedNotifications.push(goalAlerts[0]);
    } else {
      // Sort goal alerts by score descending
      goalAlerts.sort((a, b) => b.score - a.score);
      
      // Select the primary alert (highest score)
      const primaryAlert = goalAlerts[0];
      
      // Merge descriptions/messages of secondary alerts
      const secondaryAlerts = goalAlerts.slice(1);
      const extraDetails = secondaryAlerts.map(sa => {
        let name = sa.category || sa.type;
        return name.toLowerCase();
      }).join(', ');
      
      // Create intelligent summary
      primaryAlert.message = `${primaryAlert.message} (+${secondaryAlerts.length} other alerts)`;
      // Max score representation
      primaryAlert.score = Math.max(...goalAlerts.map(a => a.score)) + 5; // Slight boost for multiple warnings
      
      mergedNotifications.push(primaryAlert);
    }
  }

  // Sort final notifications by score descending
  mergedNotifications.sort((a, b) => b.score - a.score);

  // 5. Select suggested Focus Recommendation (the single highest-impact goal based on a weighted scoring)
  // Calculate Goal Impact Score for all active goals
  const activeGoalScores = activeGoals.map(goal => {
    let score = 0;
    
    // Favorite weight
    if (goal.is_favorite) {
      score += 30;
    }
    
    // Target date deadline proximity
    if (goal.target_date) {
      const daysRemaining = (new Date(goal.target_date) - now) / (1000 * 60 * 60 * 24);
      if (daysRemaining > 0) {
        if (daysRemaining <= 7) {
          score += 40;
        } else if (daysRemaining <= 30) {
          score += 20;
        } else {
          score += 10;
        }
      } else {
        // Goal target date overdue
        score += 55;
      }
    }
    
    // Lower confidence = higher attention needed
    if (goal.confidence_score !== undefined && goal.confidence_score !== null) {
      score += (100 - goal.confidence_score) * 0.5;
    }
    
    // Alert score contribution
    const goalAlerts = scoredNotifications.filter(n => n.goalId === goal.id);
    if (goalAlerts.length > 0) {
      const maxAlertScore = Math.max(...goalAlerts.map(a => a.score));
      score += maxAlertScore;
    }
    
    return {
      goal,
      score
    };
  });

  // Sort goals by score descending
  activeGoalScores.sort((a, b) => b.score - a.score);

  // Pick the single highest-impact goal
  const highestImpactGoal = activeGoalScores.length > 0 ? activeGoalScores[0].goal : null;
  const suggestedFocus = highestImpactGoal ? highestImpactGoal.title : "None";

  // 6. Formulate AI Daily Briefing
  const riskGoals = activeGoals.filter(g => {
    // A goal is at risk if confidence_score is low or it has high-severity alerts
    const hasDangerAlert = mergedNotifications.some(n => n.goalId === g.id && n.severity === 'danger');
    return hasDangerAlert || (g.confidence_score && g.confidence_score < 50);
  });
  goalsAtRiskCount = riskGoals.length;

  let briefText = "";
  if (highestImpactGoal) {
    const highestImpactAlert = scoredNotifications.find(n => n.goalId === highestImpactGoal.id);
    
    let focusDetail = "";
    if (highestImpactAlert) {
      if (highestImpactAlert.isCollapse) {
        focusDetail = `is at risk of timeline collapse (estimated delay: ${highestImpactAlert.delayDays} days). Prioritize accelerated roadmap steps.`;
      } else if (highestImpactAlert.isDrift) {
        focusDetail = `has drifted with no activity for ${highestImpactAlert.inactiveDays} days. Re-engage today to keep your streak.`;
      } else if (highestImpactAlert.isBurnout) {
        focusDetail = `is experiencing extreme task density. Space out your milestones to avoid burnout.`;
      } else if (highestImpactAlert.isOverdue) {
        focusDetail = `has overdue tasks pending. Resolve these execution bottlenecks today.`;
      } else if (highestImpactAlert.isDueToday) {
        focusDetail = `has a critical milestone due today. Focus on achieving this checkpoint.`;
      } else {
        focusDetail = `requires strategic attention: ${highestImpactAlert.message}`;
      }
    } else {
      // If there are no warning alerts for this goal
      const daysRemaining = highestImpactGoal.target_date ? (new Date(highestImpactGoal.target_date) - now) / (1000 * 60 * 60 * 24) : 999;
      if (daysRemaining <= 7) {
        focusDetail = `is approaching its target deadline. Focus on daily execution to cross the finish line.`;
      } else if (highestImpactGoal.confidence_score && highestImpactGoal.confidence_score < 70) {
        focusDetail = `is stable but has low confidence rating (${highestImpactGoal.confidence_score}%). Focus on execution to rebuild momentum.`;
      } else {
        focusDetail = `is in excellent alignment. Maintain consistency on today's roadmap items.`;
      }
    }

    briefText = `Today's Strategic Brief: Your single highest-impact focus is ${highestImpactGoal.title}, which ${focusDetail}`;
  } else {
    briefText = "You have no active goals in execution mode. Start a new goal to activate AI tracking.";
  }

  const briefing = {
    goalsAtRisk: goalsAtRiskCount,
    milestonesDue: milestonesDueCount,
    roadmapsImproving: roadmapsImprovingCount,
    suggestedFocus,
    briefText
  };


  // 7. Generate Smart Aggregation message if multiple goals require attention
  let summary = "";
  const goalsNeedingAttention = [...new Set(mergedNotifications.map(n => n.goalTitle))];
  if (goalsNeedingAttention.length > 1) {
    const listText = mergedNotifications
      .slice(0, 2)
      .map(n => `${n.goalTitle} (${n.category || n.type})`)
      .join(', ');
    summary = `${goalsNeedingAttention.length} goals require attention today: ${listText}.`;
  } else if (goalsNeedingAttention.length === 1) {
    summary = `1 goal requires attention today: ${mergedNotifications[0].message}`;
  } else {
    summary = "Your roadmaps are in healthy alignment today.";
  }

  return {
    notifications: mergedNotifications,
    briefing,
    summary
  };
}

module.exports = {
  evaluateUserNotifications
};
