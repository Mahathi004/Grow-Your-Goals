import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, XCircle } from 'lucide-react';
import api from '../api';
import confetti from 'canvas-confetti';



import { EvolvingDoodle } from '../components/EvolvingDoodle';

// ─── Main Component ───────────────────────────────────────────────────────────
export const CalendarPage = () => {
  const [goal, setGoal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeTask, setActiveTask] = useState<any>(null);

  const location = useLocation();
  const navigate = useNavigate();
  const goalId = new URLSearchParams(location.search).get('id');

  useEffect(() => { if (goalId) fetchGoalData(); }, [goalId]);

  const fetchGoalData = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/ai/goals/${goalId}`);
      if (res.data.success) setGoal(res.data.goal);
    } catch (err) { }
    finally { setLoading(false); }
  };

  const triggerConfetti = () => confetti({
    particleCount: 120, spread: 65, origin: { y: 0.6 },
    colors: ['#c8a96e', '#f7f2e8', '#8a6d3b', '#fff8dc']
  });

  const toggleTaskStatus = async (task: any) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    try {
      await api.put(`/ai/tasks/${task.id}/status`, { status: newStatus });
      setGoal({ ...goal, tasks: goal.tasks.map((t: any) => t.id === task.id ? { ...t, status: newStatus } : t) });
      if (newStatus === 'completed') triggerConfetti();
    } catch (err) { }
  };

  // ── Loading State ──
  if (loading) return (
    <div className="flex-1 flex items-center justify-center relative z-10 w-full">
      <div className="flex flex-col items-center gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full"
        />
        <p className="font-bold text-zinc-400 text-sm tracking-widest uppercase">Opening your planner…</p>
      </div>
    </div>
  );

  // ── Not Found State ──
  if (!goal) return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 relative z-10 w-full">
      <div className="bg-zinc-900/30 backdrop-blur-md border border-white/5 rounded-[32px] p-12 flex flex-col items-center gap-6 max-w-sm w-full relative shadow-2xl">
        <XCircle size={40} className="text-zinc-500" />
        <h2 className="font-black text-xl text-white">Goal Not Found</h2>
        <p className="text-zinc-400 text-center text-sm font-medium">
          We couldn't find this goal. It may have been deleted or moved.
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          className="mt-2 px-8 py-3 bg-white/5 text-zinc-300 border border-white/10 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-white/10 hover:text-white transition-all"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );

  // ── Calendar Calculations ──
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const padding = Array.from({ length: firstDayOfMonth }, (_, i) => i);
  const totalCells = padding.length + days.length > 35 ? 42 : 35;
  const trailingEmpty = totalCells - padding.length - days.length;

  const getTasksForDate = (day: number) => {
    const y = currentDate.getFullYear();
    const m = String(currentDate.getMonth() + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return goal.tasks.filter((t: any) => (t.task_date || '').slice(0, 10) === `${y}-${m}-${d}`);
  };

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const completedCount = goal.tasks.filter((t: any) => t.status === 'completed').length;
  const totalCount = goal.tasks.length;
  const progressPct = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;

  // Compute dynamic streaks based on sorted tasks
  const sortedTasks = [...(goal.tasks || [])].sort((a, b) => new Date(a.task_date).getTime() - new Date(b.task_date).getTime());
  let currentCalcStreak = 0;
  const taskStreaks = new Map();
  sortedTasks.forEach(t => {
    if (t.status === 'completed') {
      currentCalcStreak++;
      taskStreaks.set(t.id, currentCalcStreak);
    } else {
      currentCalcStreak = 0;
      taskStreaks.set(t.id, 0);
    }
  });

  return (
    <div className="flex-1 min-h-screen flex flex-col overflow-auto relative z-10 w-full">
      <div className="relative z-10 flex flex-col flex-1 px-4 py-8 sm:px-8 lg:px-16 gap-8 items-center">

        {/* ── PAGE HEADER ── */}
        <header className="flex items-center justify-between w-full max-w-[1300px]">
          <div className="flex items-center gap-4">
            <motion.button
              whileHover={{ scale: 1.05, x: -2 }}
              onClick={() => navigate('/dashboard')}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
            >
              <ChevronLeft size={20} />
            </motion.button>
            <div>
              <p className="text-zinc-500 text-[10px] uppercase tracking-[0.3em] font-black mb-0.5">My Planner</p>
              <h1 className="font-black text-2xl text-white tracking-tight leading-tight">{goal.title}</h1>
            </div>
          </div>

          {/* Month Navigator */}
          <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-2xl px-2 py-1.5 hover:bg-white/10 transition-colors">
            <select
              value={currentDate.getMonth()}
              onChange={(e) => setCurrentDate(new Date(currentDate.getFullYear(), parseInt(e.target.value), 1))}
              className="bg-transparent text-white font-bold text-[11px] uppercase tracking-[0.25em] outline-none cursor-pointer p-2"
            >
              {Array.from({ length: 12 }).map((_, i) => {
                const date = new Date(currentDate.getFullYear(), i, 1);
                return (
                  <option key={i} value={i} className="bg-zinc-900 text-white">
                    {new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date)}
                  </option>
                );
              })}
            </select>
          </div>
        </header>

        {/* ── MAIN PLANNER BOARD ── */}
        <div className="flex flex-col lg:flex-row gap-10 items-start justify-center w-full max-w-[1300px]">

          {/* ── CALENDAR BOARD ── */}
          <div className="bg-zinc-900/30 backdrop-blur-md border border-white/5 rounded-3xl flex-1 min-w-0 relative shadow-2xl overflow-hidden group">
            {/* Subtle hover gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

            {/* Top strip — month label */}
            <div className="flex items-center justify-between px-8 py-6 border-b border-white/5 relative z-10">
              <div className="flex items-center gap-3">
                <span className="inline-block w-3 h-3 rounded-full bg-rose-500/50" />
                <span className="inline-block w-3 h-3 rounded-full bg-amber-500/50" />
                <span className="inline-block w-3 h-3 rounded-full bg-emerald-500/50" />
              </div>
              <p className="font-bold text-zinc-400 text-sm">
                {new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(currentDate)}
              </p>
              {/* Progress strip */}
              <div className="flex items-center gap-3">
                <div className="h-1.5 w-24 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-blue-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPct}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                  />
                </div>
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">{progressPct}%</span>
              </div>
            </div>

            {/* Weekday Header Row */}
            <div className="grid grid-cols-7 border-b border-white/5 relative z-10">
              {weekdays.map((d) => (
                <div key={d} className={`py-4 text-center text-[10px] font-black uppercase tracking-widest text-zinc-500 border-r last:border-r-0 border-white/5`}>
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 relative z-10" style={{ minHeight: '480px' }}>
              {padding.map(p => (
                <div key={`pad-${p}`} className="border-r border-b border-white/5" />
              ))}
              {days.map(day => {
                const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                const dayTasks = getTasksForDate(day);
                const isToday = new Date().toDateString() === dayDate.toDateString();
                const primaryTask = dayTasks[0] || null;
                const streak = primaryTask ? (taskStreaks.get(primaryTask.id) || 0) : 0;
                const isMilestone = [3, 7, 14, 21, 30].includes(streak);
                
                return (
                  <div
                    key={day}
                    className={`relative flex flex-col items-center justify-center border-r border-b border-white/5 min-h-[88px] transition-colors hover:bg-white/[0.02] ${
                      isToday ? 'bg-blue-500/5' : ''
                    }`}
                  >
                    {/* Date number — top-right */}
                    {isToday ? (
                      <span className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center rounded-full bg-blue-600 text-white text-[9px] font-black leading-none z-10 shadow-[0_0_10px_rgba(37,99,235,0.5)]">
                        {day}
                      </span>
                    ) : (
                      <span className="absolute top-2 right-2 text-[10px] font-bold text-zinc-600 leading-none z-10">{day}</span>
                    )}

                    {/* SVG Doodle illustration */}
                    {primaryTask && (
                      <motion.div
                        whileHover={{ y: -4, scale: 1.05 }}
                        className="cursor-pointer w-14 h-14 select-none transition-transform relative z-10 opacity-90 hover:opacity-100"
                        title={primaryTask?.title}
                      >
                        <EvolvingDoodle 
                          category={goal.category || 'learning'} 
                          streak={streak} 
                          status={primaryTask.status || 'pending'} 
                          isMilestone={isMilestone} 
                          onClick={e => { e.stopPropagation(); setActiveTask(primaryTask); }}
                        />
                      </motion.div>
                    )}

                    {/* Extra tasks count */}
                    {dayTasks.length > 1 && (
                      <span className="absolute bottom-1.5 right-2 text-[9px] font-black text-zinc-500">
                        +{dayTasks.length - 1}
                      </span>
                    )}
                  </div>
                );
              })}
              {Array.from({ length: trailingEmpty }).map((_, i) => (
                <div key={`empty-${i}`} className="border-r border-b border-white/5" />
              ))}
            </div>

            {/* Bottom strip */}
            <div className="px-8 py-5 border-t border-white/5 relative z-10">
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">
                {completedCount} of {totalCount} entries completed
              </p>
            </div>
          </div>

          {/* ── SIDEBAR ── */}
          <aside className="w-full lg:w-72 flex flex-col gap-6 shrink-0">

            {/* Monthly Progress */}
            <div className="bg-zinc-900/30 backdrop-blur-md border border-white/5 rounded-3xl p-8 relative shadow-2xl overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              
              <div className="mb-6 relative z-10 border-b border-white/5 pb-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Monthly Progress</p>
              </div>
              
              <div className="flex flex-col gap-6 relative z-10">
                <div className="flex justify-between items-end">
                  <div>
                    <span className="text-4xl font-black text-white tracking-tight">{Math.round((completedCount / (totalCount || 1)) * 100)}</span>
                    <span className="text-zinc-500 text-sm font-bold ml-1">%</span>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-blue-400 tracking-tight">{currentCalcStreak}</span>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest block font-bold">Day Streak</span>
                  </div>
                </div>
                
                {/* Visual Progress Bar */}
                <div className="flex gap-1.5">
                  {Array.from({ length: 10 }).map((_, i) => {
                    const pct = (completedCount / (totalCount || 1)) * 10;
                    const filled = i < pct;
                    return (
                      <div key={i} className={`flex-1 h-2 rounded-full transition-colors ${filled ? 'bg-blue-500' : 'bg-white/5'}`} />
                    );
                  })}
                </div>
                
                <p className="text-zinc-400 text-xs leading-relaxed mt-2 text-center font-medium">
                  Small daily habits grow into massive success.
                </p>
              </div>
            </div>

          </aside>
        </div>
      </div>

      {/* ── TASK POPUP ── */}
      <AnimatePresence>
        {activeTask && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setActiveTask(null)}
              className="absolute inset-0 bg-[#061426]/60"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="bg-[#0c0c0c] border border-white/10 rounded-3xl w-full max-w-[320px] p-6 z-10 mx-auto shadow-2xl"
            >
              <div className="flex justify-between items-start mb-4">
                <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{goal.category}</p>
                <button onClick={() => setActiveTask(null)} className="text-zinc-500 hover:text-white transition-colors">
                  <XCircle size={20} />
                </button>
              </div>

              <div className="flex flex-col gap-5">
                <div>
                  <h3 className="font-bold text-white text-xl leading-tight mb-2">{activeTask.title}</h3>
                </div>

                <div className="border-t border-white/5 pt-5">
                  <div className="flex items-start gap-3 group cursor-pointer" onClick={() => { toggleTaskStatus(activeTask); setActiveTask(null); }}>
                     <div className={`mt-[2px] shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                        activeTask.status === 'completed'
                          ? 'border-blue-500 bg-blue-500'
                          : 'border-zinc-600 group-hover:border-blue-500'
                      }`}>
                        {activeTask.status === 'completed' && <span className="text-white leading-none text-xs">✓</span>}
                      </div>
                      <p className={`text-sm leading-relaxed font-medium ${activeTask.status === 'completed' ? 'text-zinc-500 line-through' : 'text-zinc-300 group-hover:text-white'}`}>
                        {activeTask.description || 'Complete this entry today.'}
                      </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
