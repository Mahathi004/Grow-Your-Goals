import { Flame, Calendar, Bell, User, ChevronDown, CheckCircle2, ChevronRight, X, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import CalendarModal from './CalendarModal';
import api from '../api';
import useOutsideClick from '../hooks/useOutsideClick';

export default function GlobalHeader() {
  const { user, isAuthenticated } = useAuth();
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [goals, setGoals] = useState<any[]>([]);
  const [showGoalSelector, setShowGoalSelector] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [briefing, setBriefing] = useState<any>({
    goalsAtRisk: 0,
    milestonesDue: 0,
    roadmapsImproving: 0,
    suggestedFocus: "None",
    briefText: "No active goals in execution mode."
  });
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');

  const selectorRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      fetchGoals();
      fetchNotifications();
    }
    const handleUpdate = () => {
      if (isAuthenticated) {
        fetchGoals();
        fetchNotifications();
      }
    };
    window.addEventListener('goalsUpdated', handleUpdate);
    return () => {
      window.removeEventListener('goalsUpdated', handleUpdate);
    };
  }, [isAuthenticated]);

  // @ts-ignore
  useOutsideClick(selectorRef, () => setShowGoalSelector(false));
  // @ts-ignore
  useOutsideClick(notificationsRef, () => setShowNotificationsDropdown(false));

  const fetchGoals = async () => {
    try {
      const res = await api.get('/ai/goals');
      if (res.data.success) {
        setGoals(res.data.goals);
      }
    } catch (err) {
      // Silent catch or handle appropriately
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/ai/notifications');
      if (res.data.success) {
        setNotifications(res.data.notifications || []);
        if (res.data.briefing) {
          setBriefing(res.data.briefing);
        }
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      const res = await api.put(`/ai/notifications/${id}/read`);
      if (res.data.success) {
        setNotifications(prev => 
          prev.map(n => n.id === id ? { ...n, isRead: true } : n)
        );
      }
    } catch (err) {
      console.error('Error marking notification read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await api.put('/ai/notifications/read-all');
      if (res.data.success) {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      }
    } catch (err) {
      console.error('Error marking all notifications read:', err);
    }
  };

  const handleDismiss = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await api.delete(`/ai/notifications/${id}`);
      if (res.data.success) {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const handleNotificationClick = (n: any) => {
    handleMarkRead(n.id);
    setShowNotificationsDropdown(false);
    if (n.actionLink) {
      navigate(n.actionLink);
    }
  };

  const getTabNotifications = (tab: string) => {
    if (tab === 'active') {
      return notifications.filter(n => !n.isRead);
    }
    if (tab === 'history') {
      return notifications.filter(n => n.isRead);
    }
    return [];
  };

  const activeGoal = goals.find(g => location.search.includes(g.id)) || goals[0];

  return (
    <>
    <header className="fixed top-0 right-0 left-0 h-16 flex items-center justify-between px-6 z-50 pointer-events-none">
      {/* Left side: branding/logo placeholder (empty for now) */}
      <div className="flex items-center pointer-events-auto">
      </div>

      {/* Right side: Actions & Streak */}
      <div className="flex items-center gap-4 pointer-events-auto bg-black/20 backdrop-blur-xl border border-white/5 px-4 py-1.5 rounded-full shadow-2xl">
        {/* Streak Flame */}
        {isAuthenticated && (
          <div className="flex items-center gap-2 px-1 cursor-help group relative">
            <motion.div
              animate={(user?.current_streak || 0) > 0 ? {
                filter: [
                  "drop-shadow(0px 0px 4px rgba(249,115,22,0.5))",
                  "drop-shadow(0px 0px 12px rgba(249,115,22,1))",
                  "drop-shadow(0px 0px 4px rgba(249,115,22,0.5))"
                ]
              } : {}}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              className="flex items-center gap-1.5"
            >
              <div className="relative w-[18px] h-[18px] flex items-center justify-center">
                {/* Base Fire (Red/Dark Orange) */}
                <motion.div
                  animate={(user?.current_streak || 0) > 0 ? {
                    scale: [1, 1.1, 0.95, 1.05, 1],
                    rotate: [0, -3, 3, -1, 0]
                  } : {}}
                  transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute origin-bottom"
                >
                  <Flame size={18} className={`${(user?.current_streak || 0) > 0 ? 'text-orange-600 fill-orange-600' : 'text-zinc-500'}`} />
                </motion.div>
                
                {/* Mid Fire (Orange) */}
                {(user?.current_streak || 0) > 0 && (
                  <motion.div
                    animate={{
                      scale: [0.75, 0.9, 0.7, 0.85, 0.75],
                      rotate: [0, 5, -5, 2, 0]
                    }}
                    transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.1 }}
                    className="absolute origin-bottom bottom-0"
                  >
                    <Flame size={18} className="text-orange-400 fill-orange-400" />
                  </motion.div>
                )}
                
                {/* Core Fire (Yellow) */}
                {(user?.current_streak || 0) > 0 && (
                  <motion.div
                    animate={{
                      scale: [0.45, 0.6, 0.4, 0.55, 0.45],
                      y: [0, -1, 1, 0, 0]
                    }}
                    transition={{ duration: 0.4, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
                    className="absolute origin-bottom bottom-0"
                  >
                    <Flame size={18} className="text-yellow-400 fill-yellow-400" />
                  </motion.div>
                )}
              </div>

              <span className={`${(user?.current_streak || 0) > 0 ? 'text-orange-500' : 'text-zinc-500'} font-black text-[14px]`}>
                {user?.current_streak || 0}
              </span>
            </motion.div>
            
            {/* Streak Tooltip */}
            <div className="absolute top-full right-0 mt-4 w-56 bg-zinc-900 border border-white/10 p-4 rounded-2xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none shadow-2xl z-[200]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black text-white uppercase tracking-widest">Streak Status</span>
                <Flame size={12} className="text-orange-500" />
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Consistency', days: 7, icon: '🌟' },
                  { label: 'Discipline', days: 30, icon: '🔥' },
                  { label: 'Elite', days: 100, icon: '💎' }
                ].map(m => (
                  <div key={m.label} className={`flex items-center justify-between text-[10px] ${(user?.current_streak || 0) >= m.days ? 'text-white font-bold' : 'text-zinc-600'}`}>
                    <div className="flex items-center gap-2">
                      <span>{m.icon}</span>
                      <span>{m.label} Badge</span>
                    </div>
                    <span>{m.days}d</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="w-[1px] h-4 bg-white/10" />

        {/* Journey & Calendar Selector */}
        <div className="relative" ref={selectorRef}>
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowGoalSelector(!showGoalSelector)}
            className="flex items-center gap-2.5 px-2 py-1 rounded-full hover:bg-white/5 transition-all group"
          >
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-600/20 text-blue-500 group-hover:bg-blue-600 group-hover:text-white transition-all">
              <Calendar size={15} />
            </div>
            <div className="flex flex-col items-start pr-1">
              <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest leading-none mb-0.5">Journey</span>
              <span className="text-white text-[11px] font-bold truncate max-w-[120px]">
                {activeGoal?.title || 'Select Goal'}
              </span>
            </div>
            <ChevronDown size={14} className={`text-zinc-500 group-hover:text-white transition-transform ${showGoalSelector ? 'rotate-180' : ''}`} />
          </motion.button>

          <AnimatePresence>
            {showGoalSelector && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute top-full right-0 mt-3 w-[280px] bg-[#0c0c0c] border border-white/10 rounded-[24px] shadow-2xl p-2 overflow-hidden z-[100]"
              >
                <div className="p-3 border-b border-white/5 flex items-center justify-between">
                  <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest px-2">Your Journeys</span>
                  <button 
                    onClick={() => {
                      navigate(`/calendar?id=${activeGoal?.id}`);
                      setShowGoalSelector(false);
                    }}
                    className="text-[9px] font-black text-blue-500 hover:text-blue-400 uppercase tracking-widest bg-blue-500/10 px-2 py-1 rounded-lg transition-colors"
                  >
                    View Execution Planner
                  </button>
                </div>
                <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-1">
                  {goals.length === 0 && <div className="p-4 text-center text-zinc-600 text-xs uppercase font-black">No active goals</div>}
                  {goals.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => {
                        navigate(`/calendar?id=${g.id}`);
                        setShowGoalSelector(false);
                      }}
                      className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-white/5 transition-all text-left group"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${g.id === activeGoal?.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-white/5 text-zinc-500 group-hover:text-white transition-colors'}`}>
                          {g.progress_percent === 100 ? <CheckCircle2 size={16} /> : <div className="text-[10px] font-black">{Math.round(g.progress_percent)}%</div>}
                        </div>
                        <div>
                          <p className={`text-xs font-bold truncate max-w-[140px] ${g.id === activeGoal?.id ? 'text-white' : 'text-zinc-400 group-hover:text-white transition-colors'}`}>{g.title}</p>
                          <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-black">{g.category || 'Standard'}</p>
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-zinc-700 group-hover:text-white group-hover:translate-x-1 transition-all" />
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Notifications */}
        <div className="relative flex items-center" ref={notificationsRef}>
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              const nextVal = !showNotificationsDropdown;
              setShowNotificationsDropdown(nextVal);
              setShowGoalSelector(false);
              if (nextVal) {
                fetchNotifications();
              }
            }}
            className="p-2 text-zinc-400 hover:text-white transition-colors relative flex items-center justify-center rounded-full hover:bg-white/5"
          >
            <Bell size={18} />
            {notifications.filter(n => !n.isRead).length > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
              </span>
            )}
          </motion.button>

          <AnimatePresence>
            {showNotificationsDropdown && (
              <motion.div 
                initial={{ opacity: 0, y: 15, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 15, scale: 0.96 }}
                transition={{ type: "spring", stiffness: 350, damping: 25 }}
                className="absolute top-full right-0 mt-4 w-[380px] bg-[#07090e]/95 backdrop-blur-3xl border border-white/10 rounded-[28px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.05)] p-5 flex flex-col gap-4 z-[999] overflow-hidden pointer-events-auto"
              >
                {/* Top Border Gradient Glow Line */}
                <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-purple-500/35 to-transparent pointer-events-none z-20" />

                {/* Radial Glow Overlay */}
                <div className="absolute top-0 left-0 right-0 h-48 bg-gradient-to-b from-purple-500/10 via-transparent to-transparent opacity-50 pointer-events-none" />

                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/5 pb-3 relative z-10">
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                      <Bell size={13} className="text-purple-400 drop-shadow-[0_0_4px_rgba(168,85,247,0.4)]" />
                    </div>
                    <span className="text-xs font-black text-white uppercase tracking-[0.15em]">Notifications</span>
                  </div>
                  {notifications.filter(n => !n.isRead).length > 0 && (
                    <button 
                      onClick={handleMarkAllRead}
                      className="text-[9px] font-black text-purple-400 hover:text-purple-300 uppercase tracking-widest bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 rounded-lg transition-all"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                {/* Simplified AI Briefing Card */}
                {briefing.briefText && (
                  <div className="relative overflow-hidden bg-white/[0.02] border border-white/10 rounded-2xl p-4 flex items-start gap-3.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)] transition-all hover:border-white/15 relative z-10">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-xl pointer-events-none"></div>
                    <Sparkles size={16} className="text-purple-400 mt-0.5 flex-shrink-0 animate-pulse drop-shadow-[0_0_8px_rgba(192,132,252,0.8)]" />
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-[9px] font-black uppercase tracking-widest bg-gradient-to-r from-purple-400 to-indigo-300 bg-clip-text text-transparent">Strategic AI Brief</span>
                      <p className="text-[11px] text-zinc-300 leading-relaxed font-semibold">
                        {(() => {
                          const text = briefing.briefText;
                          const focus = briefing.suggestedFocus;
                          if (!focus || focus === 'None' || !text.includes(focus)) {
                            return text;
                          }
                          const parts = text.split(focus);
                          return (
                            <>
                              {parts[0]}
                              <span className="text-purple-400 font-extrabold drop-shadow-[0_0_6px_rgba(168,85,247,0.4)]">{focus}</span>
                              {parts[1]}
                            </>
                          );
                        })()}
                      </p>
                    </div>
                  </div>
                )}

                {/* Sliding Capsule Tabs */}
                <div className="flex bg-[#0c0e14]/65 border border-white/[0.04] rounded-full p-1 relative z-10">
                  {[
                    { id: 'active', label: 'Active Alerts' },
                    { id: 'history', label: 'History Log' }
                  ].map(tab => {
                    const count = tab.id === 'active' ? getTabNotifications('active').length : 0;
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all relative ${isActive ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                        {isActive && (
                          <motion.div 
                            layoutId="activeTabPill"
                            className="absolute inset-0 bg-white/[0.05] border border-white/10 rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                          />
                        )}
                        <span className="relative z-10 flex items-center gap-1.5">
                          {tab.label}
                          {count > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full bg-purple-600/30 border border-purple-500/25 text-purple-300 text-[8px] font-black">
                              {count}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Notifications Tab List */}
                <div className="flex flex-col gap-2 max-h-[240px] overflow-y-auto custom-scrollbar pr-1 relative z-10">
                  {getTabNotifications(activeTab).length > 0 ? (
                    getTabNotifications(activeTab).map(n => {
                      const isDanger = n.severity === 'danger';
                      const isWarning = n.severity === 'warning';
                      const dotColor = isDanger ? 'bg-red-500' : isWarning ? 'bg-amber-400' : 'bg-purple-500';

                      return (
                        <div
                          key={n.id}
                          onClick={() => handleNotificationClick(n)}
                          className={`group relative flex items-start justify-between p-3 rounded-2xl border transition-all duration-300 cursor-pointer transform hover:translate-x-0.5 overflow-hidden
                            bg-white/[0.01] border-white/5 hover:border-white/10 hover:bg-white/[0.03]
                            ${n.isRead ? 'opacity-50 hover:opacity-100' : ''}`}
                        >
                          <div className="flex gap-3 min-w-0 flex-1">
                            {/* Clean Minimal Dot */}
                            <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${dotColor}`} />
                            
                            <div className="flex flex-col gap-1.5 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border text-zinc-300 border-white/10 bg-white/5">
                                  {n.goalTitle || 'Goal'}
                                </span>
                                <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider">
                                  {n.category || 'Strategic'}
                                </span>
                              </div>
                              <p className="text-[11px] text-zinc-300 leading-relaxed font-semibold pr-2">
                                {n.message}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0 self-center">
                            <button
                              onClick={(e) => handleDismiss(n.id, e)}
                              className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100"
                              title="Dismiss Alert"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-center px-4 animate-fade-in">
                      <div className="w-12 h-12 bg-white/[0.02] border border-white/5 rounded-full flex items-center justify-center mb-3 shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)]">
                        {activeTab === 'active' 
                          ? <Sparkles size={16} className="text-purple-400 animate-pulse" /> 
                          : <CheckCircle2 size={16} className="text-green-400" />}
                      </div>
                      <span className="text-xs font-black text-zinc-300 uppercase tracking-widest mb-1">
                        {activeTab === 'active' ? 'All clear' : 'No history'}
                      </span>
                      <p className="text-[10px] text-zinc-500 max-w-[220px] leading-relaxed">
                        {activeTab === 'active' 
                          ? "Your goal execution metrics are in solid alignment." 
                          : "Cleared alerts and archive logs will show up here."}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="w-[1px] h-4 bg-white/10" />

        {/* Profile/Settings */}
        <motion.button 
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/settings')}
          title="Settings"
          className="p-1.5 text-zinc-400 hover:text-white transition-colors bg-white/5 rounded-full"
        >
          <User size={18} />
        </motion.button>
      </div>
    </header>

    <CalendarModal 
      isOpen={isCalendarOpen} 
      onClose={() => setIsCalendarOpen(false)} 
      primaryGoal={activeGoal} 
    />
    </>
  );
}
