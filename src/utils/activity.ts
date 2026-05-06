import type { Goal } from '../context/GoalContext';

export interface ActivityData {
  date: string;
  count: number;
  tasks: string[];
}

/**
 * Groups all completed tasks by date string (YYYY-MM-DD)
 * Handles local timezone by using the date string from the ISO timestamp
 */
export function getDailyActivity(goals: Goal[]): Record<string, ActivityData> {
  const activity: Record<string, ActivityData> = {};

  goals.forEach(goal => {
    goal.steps.forEach(step => {
      if (step.is_completed && step.completed_at) {
        // Extract YYYY-MM-DD from the completed_at timestamp
        // We use the date part of the timestamp string directly
        const date = step.completed_at.split('T')[0];
        
        if (!activity[date]) {
          activity[date] = {
            date,
            count: 0,
            tasks: []
          };
        }
        
        activity[date].count += 1;
        activity[date].tasks.push(`${goal.title}: ${step.title}`);
      }
    });
  });

  return activity;
}

/**
 * Calculates current and longest streaks based on daily activity
 */
export function getStreak(activityMap: Record<string, ActivityData>) {
  const dates = Object.keys(activityMap).sort().reverse();
  if (dates.length === 0) return { current: 0, longest: 0 };

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  // Calculate current streak (must include today or yesterday as a start)


  // To find the current streak, we count backwards from the most recent active date
  if (activityMap[today] || activityMap[yesterday]) {
    let d = new Date(activityMap[today] ? today : yesterday);
    while (true) {
      const dateStr = d.toISOString().split('T')[0];
      if (activityMap[dateStr]) {
        currentStreak++;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }
  }

  // Calculate longest streak
  const sortedDates = Object.keys(activityMap).map(d => new Date(d)).sort((a, b) => a.getTime() - b.getTime());
  
  if (sortedDates.length > 0) {
    let lastDate = sortedDates[0];
    tempStreak = 1;
    longestStreak = 1;

    for (let i = 1; i < sortedDates.length; i++) {
        const diff = (sortedDates[i].getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
        if (diff === 1) {
            tempStreak++;
        } else {
            tempStreak = 1;
        }
        longestStreak = Math.max(longestStreak, tempStreak);
        lastDate = sortedDates[i];
    }
  }

  return {
    current: currentStreak,
    longest: Math.max(currentStreak, longestStreak)
  };
}
