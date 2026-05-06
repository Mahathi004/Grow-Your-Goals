import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import api from '../api';
import { useAuth } from './AuthContext';

export interface Step {
  id: string;
  goal_id: string;
  title: string;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  target_date: string;
  progress: number;
  is_favorite: boolean;
  created_at: string;
  steps: Step[];
}

interface GoalContextType {
  goals: Goal[];
  isLoading: boolean;
  fetchGoals: () => Promise<void>;
  createGoal: (title: string, description: string, target_date: string) => Promise<void>;
  updateGoal: (id: string, updates: Partial<Goal>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  addStep: (goalId: string, title: string) => Promise<void>;
  toggleStep: (stepId: string, isCompleted: boolean) => Promise<void>;
  updateStep: (stepId: string, title: string) => Promise<void>;
  deleteStep: (stepId: string) => Promise<void>;
  createAIGoal: (goalData: { title: string; description: string; target_date: string; tasks: string[] }) => Promise<void>;
}

const GoalContext = createContext<GoalContextType | undefined>(undefined);

export const GoalProvider = ({ children }: { children: ReactNode }) => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { isAuthenticated } = useAuth();

  const fetchGoals = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      const res = await api.get('/goals');
      setGoals(res.data);
    } catch (error) {
      // Error handled by UI or silent catch
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  const createGoal = async (title: string, description: string, target_date: string) => {
    try {
      const res = await api.post('/goals', { title, description, target_date });
      setGoals(prev => [res.data, ...prev]);
    } catch (error) {
      // Error handled by UI or silent catch
      throw error;
    }
  };

  const createAIGoal = async (goalData: { title: string; description: string; target_date: string; tasks: string[] }) => {
    try {
      const res = await api.post('/goals/ai', goalData);
      setGoals(prev => [res.data, ...prev]);
    } catch (error) {
      // Error handled by UI or silent catch
      throw error;
    }
  };

  const updateGoal = async (id: string, updates: Partial<Goal>) => {
    try {
      const res = await api.put(`/goals/${id}`, updates);
      setGoals(prev => prev.map(g => g.id === id ? { ...g, ...res.data } : g));
    } catch (error) {
      // Error handled by UI or silent catch
    }
  };

  const deleteGoal = async (id: string) => {
    try {
      await api.delete(`/goals/${id}`);
      setGoals(prev => prev.filter(g => g.id !== id));
    } catch (error) {
      // Error handled by UI or silent catch
    }
  };

  const addStep = async (goalId: string, title: string) => {
    try {
      const res = await api.post('/steps', { goal_id: goalId, title });
      const newStep = res.data;
      setGoals(prev => prev.map(g => g.id === goalId ? { ...g, steps: [...g.steps, newStep] } : g));
    } catch (error) {
      // Error handled by UI or silent catch
    }
  };

  const toggleStep = async (stepId: string, isCompleted: boolean) => {
    try {
      const res = await api.put(`/steps/${stepId}`, { is_completed: isCompleted });
      const updatedStep = res.data;
      
      setGoals(prev => prev.map(g => {
        if (g.id === updatedStep.goal_id) {
          const newSteps = g.steps.map(s => s.id === stepId ? updatedStep : s);
          // Auto-calculate progress based on completed steps
          const completedCount = newSteps.filter(s => s.is_completed).length;
          const progress = Math.round((completedCount / newSteps.length) * 100);
          
          // Update goal progress in state immediately
          return { ...g, steps: newSteps, progress };
        }
        return g;
      }));

      // Also update progress on backend
      const goal = goals.find(g => g.steps.some(s => s.id === stepId));
      if (goal) {
        const completedCount = goal.steps.map(s => s.id === stepId ? updatedStep : s).filter(s => s.is_completed).length;
        const progress = Math.round((completedCount / goal.steps.length) * 100);
        await api.put(`/goals/${goal.id}`, { progress });
      }
    } catch (error) {
      // Error handled by UI or silent catch
    }
  };

  const updateStep = async (stepId: string, title: string) => {
    try {
      const res = await api.put(`/steps/${stepId}`, { title });
      const updatedStep = res.data;
      setGoals(prev => prev.map(g => {
        if (g.id === updatedStep.goal_id) {
          return { ...g, steps: g.steps.map(s => s.id === stepId ? updatedStep : s) };
        }
        return g;
      }));
    } catch (error) {
      // Error handled by UI or silent catch
    }
  };

  const deleteStep = async (stepId: string) => {
    try {
      await api.delete(`/steps/${stepId}`);
      setGoals(prev => prev.map(g => {
        if (g.steps.some(s => s.id === stepId)) {
          const newSteps = g.steps.filter(s => s.id !== stepId);
          const completedCount = newSteps.filter(s => s.is_completed).length;
          const progress = newSteps.length > 0 ? Math.round((completedCount / newSteps.length) * 100) : 0;
          return { ...g, steps: newSteps, progress };
        }
        return g;
      }));
    } catch (error) {
      // Error handled by UI or silent catch
    }
  };

  return (
    <GoalContext.Provider value={{
      goals,
      isLoading,
      fetchGoals,
      createGoal,
      updateGoal,
      deleteGoal,
      addStep,
      toggleStep,
      updateStep,
      deleteStep,
      createAIGoal
    }}>
      {children}
    </GoalContext.Provider>
  );
};


export const useGoals = () => {
  const context = useContext(GoalContext);
  if (!context) throw new Error('useGoals must be used within a GoalProvider');
  return context;
};
