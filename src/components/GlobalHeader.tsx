import { Flame, Calendar, Bell, User, ChevronDown, CheckCircle2, ChevronRight } from 'lucide-react';
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
  const selectorRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      fetchGoals();
    }
  }, [isAuthenticated]);

  // @ts-ignore
  useOutsideClick(selectorRef, () => setShowGoalSelector(false));

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
        <motion.button 
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="p-1.5 text-zinc-400 hover:text-white transition-colors relative"
        >
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-blue-500 rounded-full border border-black" />
        </motion.button>

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
