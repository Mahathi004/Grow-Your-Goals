import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, 
  RefreshCw, 
  Trophy, 
  Clock, 
  Map as MapIcon, 
  Layout, 
  Zap,
  ShieldAlert,
  Calendar,
  CheckSquare,
  Circle,
  XCircle,
  ChevronRight,
  Activity,
  Flame,
  Sparkles,
  Check,
  Edit2
} from 'lucide-react';
import api from '../api';
import { useNavigate, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import Toast from '../components/Toast';

export const RoadmapPage = () => {
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'summary' | 'hierarchy' | 'journey'>('summary');
  const [toasts, setToasts] = useState<any[]>([]);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [editingStep, setEditingStep] = useState<any>(null);
  const [expandedMonth, setExpandedMonth] = useState<number>(0);
  const [expandedWeek, setExpandedWeek] = useState<number>(0);
  const weekListRef = useRef<HTMLDivElement>(null);

  // Reset week-list scroll position every time a different month is opened
  useEffect(() => {
    if (weekListRef.current) {
      weekListRef.current.scrollTop = 0;
    }
    setExpandedWeek(0);
  }, [expandedMonth]);

  const addToast = (type: 'success' | 'error', message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t: any) => t.id !== id));
  };

  const navigate = useNavigate();
  const { id: goalId } = useParams<{ id: string }>();

  const fetchPlan = async () => {
    try {
      if (!goalId) {
        setLoading(false);
        return;
      }
      const endpoint = `/ai/goals/${goalId}`;
      const response = await api.get(endpoint);
      if (response.data.success) {
        setPlan(response.data.goal);
      }
    } catch (err) {
      // Silent catch or handle appropriately
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateGoalDates = async (newStart: string | null, newTarget: string | null) => {
    try {
      const payload: any = {};
      if (newStart) payload.start_date = newStart;
      if (newTarget) payload.target_date = newTarget;

      const res = await api.put(`/ai/goals/${goalId}`, payload);
      if (res.data) {
        await fetchPlan();
        addToast('success', 'Goal timeline updated successfully');
        window.dispatchEvent(new Event('goalsUpdated'));
      }
    } catch (err) {
      addToast('error', 'Failed to update goal dates');
    }
  };

  useEffect(() => { fetchPlan(); }, [goalId]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#050505]">
        <div className="w-12 h-12 border-4 border-blue-500/10 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  // Safe Roadmap Resolution
  let roadmap: any = null;
  let months: any[] = [];
  
  if (plan?.roadmap) {
    const meta = plan.roadmap.metadata || {};
    roadmap = {
      ...plan.roadmap,
      ...meta,
      summary: meta.summary || {},
      journeyPath: meta.journeyPath || [],
      aiInsight: meta.aiInsight || meta.summary?.strategy_overview || ''
    };

    // Reconstruct months/weeks from flat tasks
    const tasks = plan.tasks || [];
    const groupedMonths: any = {};

    const getLocalDateStr = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    tasks.forEach((task: any) => {
      const date = new Date(task.task_date);
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      const dateStr = getLocalDateStr(date);
      
      if (!groupedMonths[monthKey]) {
        groupedMonths[monthKey] = {
          monthName: date.toLocaleString('default', { month: 'long' }),
          weeks: {}
        };
      }

      const day = date.getDate();
      const weekIdx = Math.min(Math.floor((day - 1) / 7), 3);

      if (!groupedMonths[monthKey].weeks[weekIdx]) {
        groupedMonths[monthKey].weeks[weekIdx] = {
          weekGoal: `Strategic Focus Week ${weekIdx + 1}`,
          days: {}
        };
      }

      if (!groupedMonths[monthKey].weeks[weekIdx].days[dateStr]) {
        groupedMonths[monthKey].weeks[weekIdx].days[dateStr] = {
          date: dateStr,
          tasks: []
        };
      }

      groupedMonths[monthKey].weeks[weekIdx].days[dateStr].tasks.push({
        task: task.title,
        description: task.description,
        status: task.status,
        duration: '30-45 mins', // Fallback or from task notes if added
        priority: 'Medium'
      });
    });

    months = Object.values(groupedMonths).map((m: any) => ({
      ...m,
      weeks: Object.keys(m.weeks).sort().map(k => ({
        ...m.weeks[k],
        weekNumber: parseInt(k) + 1,
        days: Object.values(m.weeks[k].days)
      }))
    }));
  }

  if (!plan || !roadmap) {
    return (
      <div className="flex-1 p-10 flex flex-col items-center justify-center text-zinc-400 gap-6 bg-[#050505]">
        <div className="w-20 h-20 bg-white/5 rounded-[40px] flex items-center justify-center">
          <ShieldAlert size={40} className="text-zinc-600" />
        </div>
        <div className="text-center">
          <h3 className="text-xl font-bold text-white mb-2">Strategy not found</h3>
          <p className="text-zinc-500">We couldn't find a valid roadmap for this goal.</p>
        </div>
        <button onClick={() => navigate('/dashboard')} className="px-8 py-3 bg-zinc-900 border border-white/10 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all">
          Return to Dashboard
        </button>
      </div>
    );
  }

  const tasks = plan.tasks || [];
  const summary = roadmap.summary || {};
  const journeyPath = roadmap.journeyPath || [];

  const handleTaskStatusChange = async (taskId: string | undefined, newStatus: string) => {
    if (!taskId) return;
    try {
      const res = await api.put(`/ai/tasks/${taskId}/status`, { status: newStatus });
      if (res.data.success) {
        setPlan((prev: any) => ({
          ...prev,
          progress_percent: res.data.progress_percent !== undefined ? res.data.progress_percent : prev.progress_percent,
          tasks: prev.tasks.map((t: any) => t.id === taskId ? { ...t, status: newStatus } : t)
        }));
        window.dispatchEvent(new Event('goalsUpdated'));
      }
    } catch (err) { }
  };

  const completionPercent = plan.progress_percent !== undefined ? plan.progress_percent : 0;

  return (
    <div className="flex-1 min-h-screen bg-[#050505] text-zinc-400 relative overflow-hidden flex flex-col">
      {/* Background Ambient */}
      <div className="fixed inset-0 z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-5%] left-[-5%] w-[40%] h-[40%] bg-indigo-600/10 blur-[100px] rounded-full" />
      </div>

      <div className="relative z-10 flex-1 flex flex-col">
        {/* Header */}
        <header className="px-8 py-6 border-b border-white/[0.05] bg-black/20 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-7xl mx-auto flex items-center justify-between pr-40">
            <div className="flex items-center gap-6">
              <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-white/5 rounded-xl transition-colors text-zinc-500 hover:text-white">
                <ChevronLeft size={24} />
              </button>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">
                    {roadmap.category || 'Strategy'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold text-white tracking-tight">{roadmap.title || plan.title}</h1>
                  {plan.is_timeline_ai_generated && (
                    <span 
                      title="System-generated timeline based on estimated goal complexity."
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold tracking-wider bg-violet-500/10 border border-violet-500/20 text-violet-400 cursor-help"
                    >
                      <Sparkles size={8} /> AI
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="hidden md:flex flex-col items-end">
                <div className="flex items-center gap-2 mb-1">
                  <Activity size={14} className="text-emerald-500" />
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Progress</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-32 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${completionPercent}%` }} className="h-full bg-emerald-500" />
                  </div>
                  <span className="text-white font-bold text-sm">{completionPercent}%</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {!plan.goal_setup_finished && (
                  <button 
                    onClick={async () => {
                      try {
                        await api.post(`/ai/goals/${plan.id}/finish-setup`);
                        window.dispatchEvent(new Event('goalsUpdated'));
                        setShowSuccessOverlay(true);
                        addToast('success', 'Goal Formed Successfully!');

                        setTimeout(() => {
                          setShowSuccessOverlay(false);
                          navigate('/dashboard');
                        }, 3000);
                      } catch (err) {
                        // Error handled by toast
                        addToast('error', 'Failed to finalize goal setup.');
                      }
                    }}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-600/30 transition-all animate-pulse hover:animate-none flex items-center gap-2"
                  >
                    <Sparkles size={14} /> Finish Goal Setup
                  </button>
                )}
                <button onClick={() => navigate(`/dashboard?mode=chat&goalId=${plan.id}&replan=true`)} className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/5 text-white rounded-xl text-xs font-bold transition-all">
                  <RefreshCw size={16} /> <span className="hidden sm:inline">Replan</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Tab Nav */}
        <div className="px-8 pt-6">
          <div className="max-w-7xl mx-auto flex items-center gap-1 bg-zinc-900/50 border border-white/[0.05] p-1.5 rounded-2xl w-fit">
            {[
              { id: 'summary', label: 'Summary', icon: Layout },
              { id: 'hierarchy', label: 'Execution', icon: Calendar },
              { id: 'journey', label: 'Journey', icon: MapIcon },
            ].map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg' : 'text-zinc-500 hover:text-white'}`}>
                <tab.icon size={14} /> {tab.label}
              </button>
            ))}
          </div>
        </div>

        <main className="flex-1 p-8 overflow-y-auto custom-scrollbar relative">
          <div className="max-w-7xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="w-full">
                
                {activeTab === 'summary' && (() => {
                  const displayStartDate = plan.start_date 
                    ? new Date(plan.start_date).toLocaleDateString(undefined, { dateStyle: 'medium' }) 
                    : new Date(plan.created_at || Date.now()).toLocaleDateString(undefined, { dateStyle: 'medium' });

                  const displayTargetDate = plan.target_date 
                    ? new Date(plan.target_date).toLocaleDateString(undefined, { dateStyle: 'medium' }) 
                    : (() => {
                        const d = new Date(plan.start_date || plan.created_at || Date.now());
                        d.setDate(d.getDate() + (plan.durationInDays || 30));
                        return d.toLocaleDateString(undefined, { dateStyle: 'medium' });
                      })();

                  return (
                    <div className="space-y-8">
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 bg-zinc-900/60 border border-white/5 p-8 rounded-[40px] relative overflow-hidden">
                          <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-4">
                              <h2 className="text-2xl font-bold text-white">Blueprint Overview</h2>
                              {plan.is_timeline_ai_generated && (
                                <span 
                                  title="System-generated timeline based on estimated goal complexity."
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold tracking-wider bg-violet-500/10 border border-violet-500/20 text-violet-400 cursor-help shadow-[0_0_15px_rgba(139,92,246,0.15)] animate-pulse"
                                >
                                  <Sparkles size={10} />
                                  AI-ESTIMATED
                                </span>
                              )}
                            </div>
                            <div className="prose prose-invert max-w-none text-zinc-400 mb-6">
                               <ReactMarkdown>{roadmap.aiInsight || summary.strategy_overview || `Your mission is to achieve "${plan.title}" over ${summary.timeline || months.length + ' months'}.`}</ReactMarkdown>
                            </div>

                            {/* Rich structured summary fields */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-6 border-t border-white/5">
                              {summary.goal && (
                                <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                                  <span className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-1">Target Objective</span>
                                  <span className="text-sm font-bold text-zinc-200">{summary.goal}</span>
                                </div>
                              )}
                              {summary.timeline && (
                                <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl relative">
                                  <span className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-1">Estimated Timeline</span>
                                  <span className="text-sm font-bold text-zinc-200">{summary.timeline}</span>
                                  {plan.is_timeline_ai_generated && (
                                    <span 
                                      title="System-generated timeline based on estimated goal complexity."
                                      className="absolute top-4 right-4 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-extrabold tracking-wider bg-violet-500/10 border border-violet-500/20 text-violet-400 cursor-help"
                                    >
                                      <Sparkles size={8} /> AI
                                    </span>
                                  )}
                                </div>
                              )}
                              {summary.blocker && (
                                <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                                  <span className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-1">Identified Blocker</span>
                                  <span className="text-sm font-bold text-rose-400">{summary.blocker}</span>
                                </div>
                              )}
                              {summary.daily_commitment && (
                                <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                                  <span className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-1">Commitment Level</span>
                                  <span className="text-sm font-bold text-emerald-400">{summary.daily_commitment}</span>
                                </div>
                              )}
                            </div>
                            
                            {summary.focus_areas && summary.focus_areas.length > 0 && (
                              <div className="mt-4 p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                                <span className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-2">Key Strategic Focus Areas</span>
                                <div className="flex flex-wrap gap-2">
                                  {summary.focus_areas.map((area: string, index: number) => (
                                    <span key={index} className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1 rounded-xl font-bold">
                                      {area}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="space-y-4">
                          <SummaryStat 
                            icon={Clock} 
                            label="Start Date" 
                            value={displayStartDate} 
                            color="blue" 
                            isDate={true}
                            rawValue={plan.start_date ? String(plan.start_date).slice(0, 10) : new Date(plan.created_at || Date.now()).toISOString().slice(0, 10)}
                            onChange={(val: string) => handleUpdateGoalDates(val, null)}
                          />
                          <SummaryStat 
                            icon={Calendar} 
                            label="Target Date" 
                            value={displayTargetDate} 
                            color="blue" 
                            isDate={true}
                            rawValue={plan.target_date ? String(plan.target_date).slice(0, 10) : (() => {
                               const d = new Date(plan.start_date || plan.created_at || Date.now());
                               d.setDate(d.getDate() + (plan.durationInDays || 30));
                               return d.toISOString().slice(0, 10);
                             })()}
                            onChange={(val: string) => handleUpdateGoalDates(null, val)}
                            isAiGenerated={plan.is_timeline_ai_generated}
                          />
                          <SummaryStat 
                            icon={Clock} 
                            label="Duration" 
                            value={`${plan.durationInDays || 30} Days`} 
                            color="blue" 
                            isAiGenerated={plan.is_timeline_ai_generated}
                          />
                          <SummaryStat icon={Flame} label="Effort" value={summary.daily_commitment || "Daily tasks"} color="orange" />
                          <SummaryStat icon={ShieldAlert} label="Blocker" value={summary.blocker || "Knowledge"} color="rose" />
                        </div>
                      </div>

                    {/* Milestones Track */}
                    {plan.milestones && plan.milestones.length > 0 && (
                      <div className="bg-zinc-900/40 border border-white/5 p-8 rounded-[40px] relative overflow-hidden">
                        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                          <Trophy className="text-yellow-500 animate-pulse" size={20} />
                          Milestone Progression Checkpoints
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          {plan.milestones.map((m: any, idx: number) => {
                            const isCompleted = !!m.achieved_at;
                            return (
                              <div 
                                key={m.id || idx} 
                                className={`p-6 rounded-3xl border transition-all ${
                                  isCompleted 
                                    ? 'bg-emerald-500/5 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.05)]' 
                                    : 'bg-zinc-900/80 border-white/5'
                                }`}
                              >
                                <div className="flex items-start justify-between mb-3">
                                  <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg ${
                                    isCompleted 
                                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                      : 'bg-zinc-800 text-zinc-500 border border-white/5'
                                  }`}>
                                    Checkpoint {idx + 1}
                                  </span>
                                  {isCompleted ? (
                                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                                      <Check className="text-emerald-400" size={12} strokeWidth={3} />
                                    </div>
                                  ) : (
                                    <div className="w-6 h-6 rounded-full bg-zinc-800 border border-white/5 flex items-center justify-center">
                                      <Clock className="text-zinc-600" size={12} />
                                    </div>
                                  )}
                                </div>
                                <h4 className={`font-bold text-sm mb-1 ${isCompleted ? 'text-emerald-300' : 'text-white'}`}>{m.title}</h4>
                                <p className="text-xs text-zinc-500 leading-relaxed mb-4">{m.description}</p>
                                {m.achieved_at && (
                                  <p className="text-[10px] text-emerald-500/80 font-medium">
                                    Achieved: {new Date(m.achieved_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

                {activeTab === 'hierarchy' && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[calc(100vh-320px)]">
                    <div className="lg:col-span-3 flex flex-col gap-3 overflow-y-auto custom-scrollbar pr-2">
                      {months.map((m: any, mIdx: number) => (
                        <div key={mIdx} className={`rounded-2xl border transition-all ${expandedMonth === mIdx ? 'bg-zinc-900 border-white/10' : 'bg-transparent border-white/5'}`}>
                          <button onClick={() => setExpandedMonth(mIdx)} className="w-full p-4 flex items-center justify-between text-left">
                            <span className={`text-sm font-bold ${expandedMonth === mIdx ? 'text-blue-400' : 'text-zinc-400'}`}>{m.monthName || m.month || `Month ${mIdx + 1}`}</span>
                            <ChevronRight size={14} className={expandedMonth === mIdx ? 'rotate-90' : ''} />
                          </button>
                           {expandedMonth === mIdx && (
                             <div ref={weekListRef} className="p-1 bg-black/20 overflow-y-auto max-h-60">
                               {m.weeks.map((week: any, wIdx: number) => {
                                 const previousWeeksCount = mIdx * 4;
                                 const displayWeekNum = previousWeeksCount + week.weekNumber;
                                 
                                 const scrollToWeek = (num: number) => {
                                   setExpandedWeek(wIdx);
                                   const element = document.getElementById(`week-${num}`);
                                   if (element) {
                                     element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                   }
                                 };

                                 return (
                                   <button 
                                     key={wIdx} 
                                     onClick={() => scrollToWeek(displayWeekNum)} 
                                     className={`w-full p-2.5 rounded-xl text-xs font-bold transition-all ${expandedWeek === wIdx ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-zinc-500 hover:text-white'}`}
                                   >
                                     Week {displayWeekNum}
                                   </button>
                                 );
                               })}
                             </div>
                           )}
                        </div>
                      ))}
                    </div>

                    <div className="lg:col-span-9 bg-zinc-900/40 border border-white/5 rounded-[40px] flex flex-col overflow-hidden">
                      <div className="p-8 border-b border-white/5 bg-white/[0.02]">
                        <h3 className="text-xl font-bold text-white mb-1">Execution Roadmap</h3>
                        <p className="text-zinc-500 text-sm">Full tactical breakdown of your strategy.</p>
                      </div>

                      <div className="flex-1 overflow-y-auto p-8 space-y-16 custom-scrollbar">
                        {months.map((month: any, mIdx: number) => (
                          <div key={mIdx} className="space-y-10">
                            {/* Month Header */}
                            <div className="flex items-center gap-4">
                              <h2 className="text-2xl font-bold text-white tracking-tight">
                                {month.monthName || month.month || `Month ${mIdx + 1}`}
                              </h2>
                              <div className="h-px flex-1 bg-white/10" />
                            </div>

                            <div className="space-y-12 pl-4">
                              {month.weeks.map((week: any, wIdx: number) => {
                                const previousWeeksCount = mIdx * 4;
                                const displayWeekNum = previousWeeksCount + week.weekNumber;

                                return (
                                  <div key={wIdx} id={`week-${displayWeekNum}`} className="space-y-6 scroll-mt-20">
                                    <div className="flex items-center gap-3">
                                      <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] bg-blue-500/10 px-2 py-0.5 rounded">
                                        Week {displayWeekNum}
                                      </span>
                                      <span className="text-zinc-400 text-xs font-bold">{week.weekGoal || 'Strategic Consolidation Phase'}</span>
                                    </div>
                                    
                                    <div className="space-y-6 pl-4 border-l border-white/5">
                                      {week.days?.length > 0 ? (
                                        week.days.map((day: any, dIdx: number) => (
                                          <div key={dIdx} className="space-y-3">
                                            <h4 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                                              {new Date(day.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                                            </h4>
                                            <div className="grid gap-3">
                                              {day.tasks?.map((taskObj: any, tIdx: number) => {
                                                const dbTask = tasks.find((t: any) => {
                                                  const tDate = new Date(t.task_date);
                                                  const tLocalDateStr = `${tDate.getFullYear()}-${String(tDate.getMonth() + 1).padStart(2, '0')}-${String(tDate.getDate()).padStart(2, '0')}`;
                                                  return t.title === taskObj.task && tLocalDateStr === day.date;
                                                });
                                                const status = dbTask?.status || 'pending';
                                                const isCompleted = status === 'completed';
                                                const isOverdue = !isCompleted && new Date(day.date) < new Date(new Date().setHours(0, 0, 0, 0));
                                                return (
                                                  <div key={tIdx} className={`flex items-center justify-between p-4 rounded-2xl border transition-colors group ${
                                                    isCompleted 
                                                      ? 'bg-emerald-500/5 border-emerald-500/10 hover:border-emerald-500/20' 
                                                      : isOverdue 
                                                        ? 'bg-red-500/5 border-red-500/10 hover:border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.02)]' 
                                                        : 'bg-white/5 border-white/5 hover:border-white/10'
                                                  }`}>
                                                    <div className="flex items-center gap-4">
                                                      <button onClick={() => handleTaskStatusChange(dbTask?.id, status === 'completed' ? 'pending' : 'completed')}>
                                                        {isCompleted ? (
                                                          <CheckSquare size={18} className="text-emerald-500" />
                                                        ) : isOverdue ? (
                                                          <XCircle size={18} className="text-red-500" />
                                                        ) : (
                                                          <Circle size={18} className="text-zinc-600 group-hover:text-zinc-400" />
                                                        )}
                                                      </button>
                                                      <div>
                                                        <div className="flex items-center gap-2">
                                                          <p className={`text-sm font-bold ${isCompleted ? 'text-emerald-500/50 line-through font-normal' : isOverdue ? 'text-red-400 font-bold' : 'text-zinc-200'}`}>{taskObj.task}</p>
                                                          {isOverdue && (
                                                            <span className="text-[8px] font-black bg-red-500/10 border border-red-500/20 text-red-400 px-1.5 py-0.5 rounded uppercase tracking-wider">Overdue</span>
                                                          )}
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-1">
                                                          <span className="text-[10px] text-zinc-500">{taskObj.duration}</span>
                                                          <span className="text-[10px] text-zinc-600">•</span>
                                                          <span className={`text-[10px] font-bold ${taskObj.priority === 'High' ? 'text-rose-400' : 'text-zinc-600'}`}>{taskObj.priority}</span>
                                                        </div>
                                                      </div>
                                                    </div>
                                                    <button 
                                                      onClick={() => setEditingStep({ ...taskObj, date: day.date })}
                                                      className="p-2 opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded-xl transition-all text-zinc-600 hover:text-white"
                                                    >
                                                      <Edit2 size={14} />
                                                    </button>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        ))
                                      ) : (
                                        <div className="p-4 bg-white/[0.02] border border-dashed border-white/5 rounded-2xl text-[10px] text-zinc-600 uppercase tracking-widest text-center">
                                          Phase execution details pending analysis
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'journey' && (
                  <JourneyPathVisual nodes={journeyPath} tasks={tasks} />
                )}

              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
      <Toast toasts={toasts} removeToast={removeToast} />

      <AnimatePresence>
        {showSuccessOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 backdrop-blur-2xl"
          >
            <motion.div
              initial={{ scale: 0.8, y: 40 }}
              animate={{ scale: 1, y: 0 }}
              className="flex flex-col items-center text-center"
            >
              <div className="relative mb-8">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                  className="w-32 h-32 bg-blue-600 rounded-full flex items-center justify-center shadow-[0_0_80px_rgba(37,99,235,0.4)]"
                >
                  <Check size={64} className="text-white" strokeWidth={4} />
                </motion.div>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
                  className="absolute -inset-4 border-2 border-dashed border-blue-500/30 rounded-full"
                />
                <div className="absolute -top-4 -right-4 text-yellow-400 animate-bounce">
                  <Sparkles size={32} fill="currentColor" />
                </div>
              </div>
              <h2 className="text-4xl font-black text-white mb-4 tracking-tighter uppercase">Goal Formed Successfully</h2>
              <p className="text-zinc-500 font-bold max-w-sm tracking-tight leading-relaxed">
                Your journey has officially begun. Redirecting you to your execution dashboard...
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {editingStep && (
          <div className="fixed inset-0 z-[1100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setEditingStep(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md" 
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-zinc-900 border border-white/10 rounded-[40px] shadow-2xl p-8"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">Modify Step</p>
                  <h3 className="text-xl font-bold text-white">Edit Strategy</h3>
                </div>
                <button onClick={() => setEditingStep(null)} className="p-2 hover:bg-white/5 rounded-full">
                  <XCircle size={24} className="text-zinc-600" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-2">Step Title</label>
                  <input 
                    type="text" 
                    defaultValue={editingStep.task}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white font-bold focus:outline-none focus:ring-2 ring-blue-500/50"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-2">Priority</label>
                  <select className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white font-bold focus:outline-none focus:ring-2 ring-blue-500/50 appearance-none">
                    <option value="High">High Priority</option>
                    <option value="Medium">Medium Priority</option>
                    <option value="Low">Low Priority</option>
                  </select>
                </div>
                <button 
                  onClick={() => {
                    addToast('success', 'Step updated locally (Review Mode)');
                    setEditingStep(null);
                  }}
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-600/30"
                >
                  Save Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

function JourneyPathVisual({ nodes, tasks }: { nodes: any[], tasks: any[] }) {
  if (!nodes || nodes.length === 0) return <div className="text-center text-zinc-500 p-20 bg-zinc-900/20 rounded-[48px] border border-white/5 font-medium">Expert analysis required to generate Journey Path.</div>;
  
  const pathWidth = 600;
  const nodeSpacing = 160;
  const height = (nodes.length + 2) * nodeSpacing;
  
  // Calculate completed status (mock logic: if first few tasks are done, node is done)
  // Real logic would check actual task completion per phase
  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const totalTasks = tasks.length || 1;
  const progressPercent = completedCount / totalTasks;
  const completedNodeIndex = Math.floor(progressPercent * nodes.length) - 1;

  let pathD = `M ${pathWidth / 2} ${nodeSpacing / 2}`;
  nodes.forEach((_, i) => {
    const y = (i + 1) * nodeSpacing + (nodeSpacing / 2);
    const prevY = i * nodeSpacing + (nodeSpacing / 2);
    const midY = (prevY + y) / 2;
    const curveOffset = i % 2 === 0 ? 150 : -150;
    pathD += ` C ${pathWidth / 2 + curveOffset} ${midY} ${pathWidth / 2 + curveOffset} ${midY} ${pathWidth / 2} ${y}`;
  });
  
  const goalY = (nodes.length + 1) * nodeSpacing + (nodeSpacing / 2);
  const finalMidY = ((nodes.length) * nodeSpacing + (nodeSpacing / 2) + goalY) / 2;
  const finalCurveOffset = nodes.length % 2 === 0 ? 150 : -150;
  pathD += ` C ${pathWidth / 2 + finalCurveOffset} ${finalMidY} ${pathWidth / 2 + finalCurveOffset} ${finalMidY} ${pathWidth / 2} ${goalY}`;

  return (
    <div className="relative p-12 bg-zinc-900/10 border border-white/5 rounded-[48px] overflow-hidden flex flex-col items-center">
      <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      <div className="relative" style={{ width: pathWidth, height }}>
        <svg width={pathWidth} height={height} className="absolute inset-0 pointer-events-none overflow-visible">
          <defs>
            <linearGradient id="roadmapGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
          <path d={pathD} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" strokeLinecap="round" />
          <motion.path d={pathD} fill="none" stroke="url(#roadmapGradient)" strokeWidth="4" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2 }} />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center pointer-events-none">
          <div className="absolute flex flex-col items-center" style={{ top: nodeSpacing/2, transform: 'translateY(-50%)' }}>
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center border-2 border-white/20 shadow-lg shadow-blue-500/20"><Zap size={18} className="text-white" /></div>
          </div>

          {nodes.map((node, i) => {
            const y = (i + 1) * nodeSpacing + (nodeSpacing / 2);
            const isCompleted = i <= completedNodeIndex;
            const isCurrent = i === completedNodeIndex + 1;
            const isLocked = i > completedNodeIndex + 1;

            return (
              <div key={i} className="absolute flex items-center gap-6 pointer-events-auto group" style={{ top: y, transform: 'translateY(-50%)', left: i % 2 === 0 ? '50%' : 'auto', right: i % 2 === 0 ? 'auto' : '50%', flexDirection: i % 2 === 0 ? 'row' : 'row-reverse', width: '300px', marginLeft: i % 2 === 0 ? '-20px' : '0', marginRight: i % 2 === 0 ? '0' : '-20px' }}>
                <div className={`w-10 h-10 rounded-2xl border-2 flex items-center justify-center transition-all ${isCompleted ? 'bg-blue-600 border-blue-400' : isCurrent ? 'bg-zinc-900 border-blue-500 animate-pulse' : 'bg-zinc-900 border-white/5 opacity-40'}`}>
                   <Activity size={18} className={isCompleted ? 'text-white' : isCurrent ? 'text-blue-500' : 'text-zinc-600'} />
                </div>
                <div className={`flex-1 p-4 bg-zinc-900/80 backdrop-blur-md border border-white/5 rounded-2xl ${isLocked ? 'opacity-40' : 'hover:border-white/20 transition-colors'}`}>
                  <h4 className="text-white font-bold text-sm truncate mb-1">{node.title || node.node}</h4>
                  <p className="text-zinc-500 text-[10px] leading-relaxed line-clamp-2">{node.description || node.details}</p>
                </div>
              </div>
            );
          })}

          <div className="absolute flex flex-col items-center" style={{ top: goalY, transform: 'translateY(-50%)' }}>
            <motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 3, repeat: Infinity }} className="w-16 h-16 rounded-[28px] bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/20 border-2 border-white/20">
              <Trophy className="text-white w-8 h-8" />
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryStat({ icon: Icon, label, value, color, isDate, onChange, rawValue, isAiGenerated }: any) {
  const colors: any = {
    blue: 'text-blue-400 bg-blue-500/10',
    orange: 'text-orange-400 bg-orange-500/10',
    rose: 'text-rose-400 bg-rose-500/10',
  };
  return (
    <div className="p-4 bg-zinc-900/40 border border-white/5 rounded-2xl flex items-center gap-4 group relative">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors[color]}`}><Icon size={18} /></div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{label}</p>
          {isAiGenerated && (
            <span 
              title="System-generated timeline based on estimated goal complexity."
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-extrabold tracking-wider bg-violet-500/10 border border-violet-500/20 text-violet-400 cursor-help shadow-[0_0_10px_rgba(139,92,246,0.1)]"
            >
              <Sparkles size={8} /> AI
            </span>
          )}
        </div>
        {isDate && onChange ? (
          <input 
            type="date" 
            value={rawValue || ''} 
            onChange={(e) => onChange(e.target.value)}
            className="bg-transparent text-white font-bold text-sm outline-none border-none p-0 cursor-pointer w-full focus:ring-0 [color-scheme:dark]"
          />
        ) : (
          <p className="text-white font-bold text-sm">{value}</p>
        )}
      </div>
    </div>
  );
}
