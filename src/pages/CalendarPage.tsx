import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Trophy, 
  Filter, 
  CheckSquare, 
  Square,
  Activity,
  Sparkles
} from 'lucide-react';
import api from '../api';
import confetti from 'canvas-confetti';

interface Goal {
  id: string;
  title: string;
  category: string;
  start_date: string;
  target_date: string;
  progress_percent: number;
  is_timeline_ai_generated: boolean;
}

interface Task {
  id: string;
  goal_id: string;
  title: string;
  description: string;
  task_date: string;
  status: 'pending' | 'completed' | 'partial' | 'skipped';
  goal_title?: string;
  goal_category?: string;
}

interface Milestone {
  id: string;
  goal_id: string;
  title: string;
  description: string;
  created_at: string;
  achieved_at: string | null;
  goal_title?: string;
  goal_category?: string;
}

export const CalendarPage = () => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Filtering
  const [selectedGoalId, setSelectedGoalId] = useState<string>('all');
  
  // Selected Day Details Modal
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const location = useLocation();
  const navigate = useNavigate();
  
  useEffect(() => {
    fetchCalendarData();
  }, []);

  // Sync default filter to query params if present
  useEffect(() => {
    const goalParam = new URLSearchParams(location.search).get('id');
    if (goalParam) {
      setSelectedGoalId(goalParam);
    }
  }, [location.search]);

  const fetchCalendarData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/ai/calendar');
      if (res.data.success) {
        setGoals(res.data.goals || []);
        setTasks(res.data.tasks || []);
        setMilestones(res.data.milestones || []);
      }
    } catch (err) {
      console.error('Error fetching calendar data:', err);
    } finally {
      setLoading(false);
    }
  };

  const triggerConfetti = () => confetti({
    particleCount: 100, spread: 60, origin: { y: 0.7 },
    colors: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6']
  });

  const handleToggleTask = async (task: Task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    try {
      const res = await api.put(`/ai/tasks/${task.id}/status`, { status: newStatus });
      if (res.data.success) {
        // Update local tasks
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
        
        // Update progress of corresponding goal in local list
        if (res.data.progress_percent !== undefined) {
          setGoals(prev => prev.map(g => g.id === task.goal_id ? { ...g, progress_percent: res.data.progress_percent } : g));
        }

        if (newStatus === 'completed') {
          triggerConfetti();
        }
        window.dispatchEvent(new Event('goalsUpdated'));
      }
    } catch (err) {
      console.error('Error updating task status:', err);
    }
  };

  const isTaskOverdue = (task: Task) => {
    if (task.status === 'completed') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const taskDate = new Date(task.task_date);
    taskDate.setHours(0, 0, 0, 0);
    return taskDate < today;
  };

  // Calendar Grid Setup
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  
  const calendarCells = [];
  // Padding cells
  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push(null);
  }
  // Days of month
  for (let d = 1; d <= totalDays; d++) {
    calendarCells.push(new Date(year, month, d));
  }

  // Helper: filter items by goal filter
  const getFilteredTasks = () => {
    if (selectedGoalId === 'all') return tasks;
    return tasks.filter(t => t.goal_id === selectedGoalId);
  };

  const getFilteredMilestones = () => {
    if (selectedGoalId === 'all') return milestones;
    return milestones.filter(m => m.goal_id === selectedGoalId);
  };

  const getLocalDateStr = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getItemsForDate = (date: Date) => {
    const dateStr = getLocalDateStr(date);
    const dayTasks = getFilteredTasks().filter(t => {
      const tDate = new Date(t.task_date);
      const tLocalDateStr = `${tDate.getFullYear()}-${String(tDate.getMonth() + 1).padStart(2, '0')}-${String(tDate.getDate()).padStart(2, '0')}`;
      return tLocalDateStr === dateStr;
    });
    const dayMilestones = getFilteredMilestones().filter(m => {
      const mDate = new Date(m.created_at);
      const mLocalDateStr = `${mDate.getFullYear()}-${String(mDate.getMonth() + 1).padStart(2, '0')}-${String(mDate.getDate()).padStart(2, '0')}`;
      return mLocalDateStr === dateStr;
    });
    return { tasks: dayTasks, milestones: dayMilestones };
  };

  // Formatting date string
  const formatMonthName = (date: Date) => {
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  // Navigation
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Colors config
  const getGoalColors = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'career': return { dot: 'bg-blue-500', text: 'text-blue-400', badge: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' };
      case 'fitness': return { dot: 'bg-emerald-500', text: 'text-emerald-400', badge: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' };
      case 'beauty': return { dot: 'bg-pink-500', text: 'text-pink-400', badge: 'bg-pink-500/10 text-pink-400 border border-pink-500/20' };
      case 'study': return { dot: 'bg-purple-500', text: 'text-purple-400', badge: 'bg-purple-500/10 text-purple-400 border border-purple-500/20' };
      case 'business': return { dot: 'bg-amber-500', text: 'text-amber-400', badge: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' };
      default: return { dot: 'bg-zinc-500', text: 'text-zinc-400', badge: 'bg-zinc-800 text-zinc-400 border border-white/5' };
    }
  };

  const completedCount = getFilteredTasks().filter(t => t.status === 'completed').length;
  const totalCount = getFilteredTasks().length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Sidebar stats
  const activeMilestonesCount = getFilteredMilestones().filter(m => m.achieved_at !== null).length;
  const totalMilestonesCount = getFilteredMilestones().length;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#050505] relative z-10 w-full">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500/10 border-t-blue-500 rounded-full animate-spin" />
          <p className="font-bold text-zinc-500 text-xs tracking-widest uppercase">Syncing planner grid...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-screen bg-[#050505] text-zinc-400 relative overflow-hidden flex flex-col">
      {/* Background Ambient */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-5%] left-[-5%] w-[40%] h-[40%] bg-indigo-600/10 blur-[100px] rounded-full" />
      </div>

      <div className="relative z-10 flex-1 flex flex-col max-w-7xl mx-auto w-full px-6 py-8 gap-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/5 pb-6">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-white/5 rounded-xl transition-colors text-zinc-500 hover:text-white">
              <ChevronLeft size={24} />
            </button>
            <div>
              <p className="text-zinc-500 text-[10px] uppercase tracking-[0.3em] font-black mb-0.5">Execution Workspace</p>
              <h1 className="font-black text-2xl text-white tracking-tight leading-tight">Timeline Calendar</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* Goal Filter Dropdown */}
            <div className="flex items-center gap-2 bg-zinc-900/60 border border-white/5 rounded-2xl px-4 py-2">
              <Filter size={14} className="text-zinc-500" />
              <select 
                value={selectedGoalId} 
                onChange={(e) => setSelectedGoalId(e.target.value)}
                className="bg-transparent text-white font-bold text-xs outline-none cursor-pointer pr-4"
              >
                <option value="all" className="bg-zinc-950 text-white">All Active Goals</option>
                {goals.map(g => (
                  <option key={g.id} value={g.id} className="bg-zinc-950 text-white">{g.title}</option>
                ))}
              </select>
            </div>

            {/* Month Navigators */}
            <div className="flex items-center gap-2 bg-zinc-900/60 border border-white/5 rounded-2xl p-1">
              <button onClick={handlePrevMonth} className="p-2 hover:bg-white/5 rounded-xl text-zinc-400 hover:text-white transition-colors">
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs font-black text-white px-2 tracking-widest uppercase">
                {formatMonthName(currentDate)}
              </span>
              <button onClick={handleNextMonth} className="p-2 hover:bg-white/5 rounded-xl text-zinc-400 hover:text-white transition-colors">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </header>

        {/* Main Board Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Calendar Grid Container */}
          <div className="lg:col-span-8 bg-zinc-900/30 backdrop-blur-md border border-white/5 rounded-[32px] overflow-hidden shadow-2xl">
            {/* Weekday Row */}
            <div className="grid grid-cols-7 border-b border-white/5 bg-white/[0.01]">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} className="py-4 text-center text-[10px] font-black uppercase tracking-widest text-zinc-500 border-r last:border-r-0 border-white/5">
                  {d}
                </div>
              ))}
            </div>

            {/* Cells */}
            <div className="grid grid-cols-7" style={{ minHeight: '520px' }}>
              {calendarCells.map((date, idx) => {
                if (!date) {
                  return <div key={`pad-${idx}`} className="border-r border-b border-white/5 min-h-[96px]" />;
                }

                const { tasks: dayTasks, milestones: dayMilestones } = getItemsForDate(date);
                const isToday = new Date().toDateString() === date.toDateString();
                const totalTasksCount = dayTasks.length;
                
                const hasMilestone = dayMilestones.length > 0;
                
                return (
                  <div 
                    key={date.toISOString()}
                    onClick={() => setSelectedDay(date)}
                    className={`relative border-r border-b border-white/5 p-3 min-h-[104px] flex flex-col justify-between hover:bg-white/[0.02] cursor-pointer transition-colors ${
                      isToday ? 'bg-blue-600/5' : ''
                    }`}
                  >
                    {/* Header: Date Number & Badges */}
                    <div className="flex justify-between items-start">
                      {isToday ? (
                        <span className="w-6 h-6 flex items-center justify-center rounded-full bg-blue-600 text-white text-[10px] font-black shadow-[0_0_10px_rgba(37,99,235,0.4)]">
                          {date.getDate()}
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-zinc-600">{date.getDate()}</span>
                      )}

                      {/* Milestone Trophy */}
                      {hasMilestone && (() => {
                        const milestoneGoal = goals.find(g => g.id === dayMilestones[0].goal_id);
                        const isAiMilestone = milestoneGoal ? milestoneGoal.is_timeline_ai_generated : true;
                        return (
                          <span 
                            className={`${isAiMilestone ? 'text-violet-400 drop-shadow-[0_0_8px_rgba(139,92,246,0.5)]' : 'text-yellow-500'} animate-pulse`} 
                            title={`${isAiMilestone ? 'AI Milestone: ' : 'User Milestone: '}${dayMilestones[0].title}`}
                          >
                            <Trophy size={14} fill="currentColor" />
                          </span>
                        );
                      })()}
                    </div>

                    {/* Middle / Footer: Task Indicators */}
                    <div className="space-y-1.5 mt-4">
                      {dayTasks.slice(0, 3).map((task, tIdx) => {
                        const colors = getGoalColors(task.goal_category || 'custom');
                        const isDone = task.status === 'completed';
                        const isOverdue = isTaskOverdue(task);
                        
                        return (
                          <div key={task.id || tIdx} className="flex items-center gap-1.5 min-w-0">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              isDone ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]' : isOverdue ? 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]' : colors.dot
                            }`} />
                            <p className={`text-[10px] font-medium truncate ${
                              isDone ? 'text-emerald-500/50 line-through font-normal' : isOverdue ? 'text-red-400 font-bold' : 'text-zinc-300'
                            }`}>
                              {task.title}
                            </p>
                          </div>
                        );
                      })}
                      
                      {totalTasksCount > 3 && (
                        <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider pl-3">
                          + {totalTasksCount - 3} more
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sidebar Stats & Overview */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Monthly Analytics */}
            <div className="bg-zinc-900/30 backdrop-blur-md border border-white/5 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500 mb-6 flex items-center gap-2">
                <Activity size={14} className="text-blue-500" />
                Monthly Metrics
              </h3>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-1">Tasks Done</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-white">{completedCount}</span>
                    <span className="text-zinc-600 text-xs">/ {totalCount}</span>
                  </div>
                </div>
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-1">Milestones</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-yellow-500">{activeMilestonesCount}</span>
                    <span className="text-zinc-600 text-xs">/ {totalMilestonesCount}</span>
                  </div>
                </div>
              </div>

              {/* Progress Tracker */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-zinc-400">
                  <span>Overall Completion</span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Checklist: Scheduled for Today */}
            <div className="bg-zinc-900/30 backdrop-blur-md border border-white/5 rounded-3xl p-6 shadow-2xl">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500 mb-6 flex items-center gap-2">
                <CheckSquare size={14} className="text-emerald-500" />
                Active Task Tracker
              </h3>

              <div className="space-y-4 max-h-[360px] overflow-y-auto pr-2 custom-scrollbar">
                {(() => {
                  const todayStr = getLocalDateStr(new Date());
                  const trackerTasks = getFilteredTasks().filter(t => {
                    const tDate = new Date(t.task_date);
                    const tStr = `${tDate.getFullYear()}-${String(tDate.getMonth() + 1).padStart(2, '0')}-${String(tDate.getDate()).padStart(2, '0')}`;
                    return tStr === todayStr || isTaskOverdue(t);
                  });

                  if (trackerTasks.length === 0) {
                    return (
                      <div className="text-center py-8 text-zinc-600 text-xs uppercase tracking-widest font-bold border border-dashed border-white/5 rounded-2xl">
                        No tasks active or overdue
                      </div>
                    );
                  }

                  return trackerTasks.map(task => {
                    const isDone = task.status === 'completed';
                    const isOverdue = isTaskOverdue(task);
                    return (
                      <div 
                        key={task.id} 
                        onClick={() => handleToggleTask(task)}
                        className={`flex items-start gap-3 p-3 bg-white/[0.02] border rounded-2xl cursor-pointer hover:bg-white/[0.05] transition-colors group ${
                          isOverdue ? 'border-red-500/20 bg-red-500/[0.01]' : 'border-white/5'
                        }`}
                      >
                        <button className="mt-0.5 shrink-0 text-zinc-500 hover:text-white transition-colors">
                          {isDone ? (
                            <CheckSquare size={18} className="text-emerald-500" />
                          ) : isOverdue ? (
                            <Square size={18} className="text-red-500/60 group-hover:text-red-500" />
                          ) : (
                            <Square size={18} className="text-zinc-600 group-hover:text-zinc-400" />
                          )}
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className={`text-xs font-bold leading-relaxed ${
                              isDone ? 'text-zinc-600 line-through' : isOverdue ? 'text-red-400 font-bold' : 'text-zinc-200'
                            }`}>
                              {task.title}
                            </p>
                            {isOverdue && (
                              <span className="text-[8px] font-black bg-red-500/10 border border-red-500/20 text-red-400 px-1 py-0.5 rounded uppercase tracking-wider">
                                Overdue
                              </span>
                            )}
                          </div>
                          <span className="text-[9px] font-bold text-zinc-500 block mt-1 uppercase tracking-wider">
                            {task.goal_title}
                          </span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* Selected Day Agenda Modal */}
      <AnimatePresence>
        {selectedDay && (
          <div className="fixed inset-0 z-[1200] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDay(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-zinc-950 border border-white/10 rounded-[40px] shadow-2xl p-8 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">Daily Agenda</p>
                  <h3 className="text-lg font-bold text-white">
                    {selectedDay.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                  </h3>
                </div>
                <button onClick={() => setSelectedDay(null)} className="p-2 hover:bg-white/5 rounded-xl text-zinc-500 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>

              {/* Day Agenda Contents */}
              <div className="space-y-6 max-h-[380px] overflow-y-auto pr-2 custom-scrollbar">
                
                {/* Milestones on this Day */}
                {getItemsForDate(selectedDay).milestones.length > 0 && (
                  <div className="space-y-3">
                    <span className="text-[9px] font-black text-yellow-500 uppercase tracking-widest block">CHECKPOINTS REACHED</span>
                    {getItemsForDate(selectedDay).milestones.map(m => {
                      const milestoneGoal = goals.find(g => g.id === m.goal_id);
                      const isAiMilestone = milestoneGoal ? milestoneGoal.is_timeline_ai_generated : true;
                      return (
                        <div 
                          key={m.id} 
                          className={`p-4 rounded-2xl flex items-start gap-3 border ${
                            isAiMilestone 
                              ? 'bg-violet-500/5 border-violet-500/20 text-violet-400 animate-pulse' 
                              : 'bg-yellow-500/5 border-yellow-500/20 text-yellow-500'
                          }`}
                        >
                          <Trophy size={16} className={`${isAiMilestone ? 'text-violet-400' : 'text-yellow-500'} shrink-0 mt-0.5`} fill="currentColor" />
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className={`text-xs font-bold ${isAiMilestone ? 'text-violet-400' : 'text-yellow-400'}`}>{m.title}</h4>
                              {isAiMilestone && (
                                <span className="text-[8px] font-black bg-violet-500/10 border border-violet-500/20 text-violet-400 px-1 py-0.5 rounded uppercase tracking-wider flex items-center gap-0.5">
                                  <Sparkles size={8} /> AI
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-zinc-500 leading-relaxed mt-1">{m.description}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Tasks on this Day */}
                <div className="space-y-3">
                  <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block">TASKS SCHEDULED</span>
                  {getItemsForDate(selectedDay).tasks.length === 0 ? (
                    <div className="text-center py-6 text-zinc-600 text-xs font-bold uppercase tracking-widest border border-dashed border-white/5 rounded-2xl">
                      No tasks scheduled for this day
                    </div>
                  ) : (
                    getItemsForDate(selectedDay).tasks.map(task => {
                      const isDone = task.status === 'completed';
                      const isOverdue = isTaskOverdue(task);
                      return (
                        <div 
                          key={task.id}
                          onClick={() => handleToggleTask(task)}
                          className={`flex items-start gap-3 p-4 bg-white/[0.02] border rounded-2xl cursor-pointer hover:bg-white/[0.04] transition-colors group ${
                            isOverdue ? 'border-red-500/20' : 'border-white/5'
                          }`}
                        >
                          <button className="mt-0.5 shrink-0 text-zinc-500 hover:text-white transition-colors">
                            {isDone ? (
                              <CheckSquare size={18} className="text-emerald-500" strokeWidth={2.5} />
                            ) : isOverdue ? (
                              <Square size={18} className="text-red-500/60 group-hover:text-red-500" />
                            ) : (
                              <Square size={18} className="text-zinc-600 group-hover:text-zinc-400" />
                            )}
                          </button>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className={`text-xs font-bold leading-relaxed ${
                                isDone ? 'text-zinc-600 line-through font-normal' : isOverdue ? 'text-red-400 font-bold' : 'text-zinc-200'
                              }`}>
                                {task.title}
                              </h4>
                              {isOverdue && (
                                <span className="text-[8px] font-black bg-red-500/10 border border-red-500/20 text-red-400 px-1 py-0.5 rounded uppercase tracking-wider">
                                  Overdue
                                </span>
                              )}
                            </div>
                            {task.description && (
                              <p className="text-[11px] text-zinc-500 leading-relaxed mt-1">
                                {task.description}
                              </p>
                            )}
                            <span className="text-[9px] font-bold text-zinc-500 block mt-2 uppercase tracking-wider">
                              {task.goal_title}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
