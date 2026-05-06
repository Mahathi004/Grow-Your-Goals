import { Menu, Flame, Calendar, ChevronDown, CheckCircle2, ChevronRight } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useState, useEffect, useRef } from "react";
import api from "../api";

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const [goals, setGoals] = useState<any[]>([]);
  const [showGoalSelector, setShowGoalSelector] = useState(false);
  const selectorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isAuthenticated) {
      fetchGoals();
    }
  }, [isAuthenticated]);

  const fetchGoals = async () => {
    try {
      const res = await api.get('/ai/goals');
      if (res.data.success) {
        setGoals(res.data.goals.filter((g: any) => g.goal_setup_finished));
      }
    } catch (err) {
      // Silent catch or handle appropriately
    }
  };

  const handleAuthClick = () => {
    if (isAuthenticated) {
      logout();
      navigate('/');
    } else {
      navigate('/auth');
    }
  };

  return (
    <nav className="relative z-[100] flex flex-row justify-between items-center px-8 py-6 max-w-7xl mx-auto w-full">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/')}>
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-black/20 border border-white/20 backdrop-blur-sm group-hover:bg-white/10 transition-colors">
            <svg width="16" height="16" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white">
              <path d="M30.5 7.5C27.85 5.11 24.18 4 20 4C11.16 4 4 11.16 4 20C4 28.84 11.16 36 20 36C28.84 36 36 28.84 36 20H20" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M20 12L28 20L20 28" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="text-[20px] font-bold tracking-tight text-white font-sans hidden sm:block">
            Grow Your Goals
          </div>
        </div>

        {/* Goal Selector (Calendar Dropdown) */}
        {isAuthenticated && goals.length > 0 && (
          <div className="relative" ref={selectorRef}>
            <button 
              onClick={() => setShowGoalSelector(!showGoalSelector)}
              className="flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-xl text-zinc-300 hover:text-white transition-all text-sm font-bold"
            >
              <Calendar size={16} className="text-blue-400" />
              <span className="hidden md:inline">Select Goal</span>
              <ChevronDown size={14} className={`transition-transform ${showGoalSelector ? 'rotate-180' : ''}`} />
            </button>

            {showGoalSelector && (
              <div className="absolute top-full left-0 mt-2 w-64 bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden py-2 animate-in fade-in slide-in-from-top-2">
                <div className="px-4 py-2 border-b border-white/5 mb-1">
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Active Journeys</p>
                </div>
                <div className="max-h-60 overflow-y-auto custom-scrollbar">
                  {goals.map((goal) => (
                    <button
                      key={goal.id}
                      onClick={() => {
                        setShowGoalSelector(false);
                        navigate(`/calendar?id=${goal.id}`);
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-white/5 flex items-center justify-between group transition-colors border-b border-white/[0.03] last:border-0"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-all">
                          <CheckCircle2 size={16} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white truncate">{goal.title}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black uppercase text-zinc-500 tracking-tighter bg-white/5 px-1.5 py-0.5 rounded">
                              {goal.status || 'Active'}
                            </span>
                            <span className="text-[9px] font-black text-blue-400">
                              {goal.progress_percent || 0}%
                            </span>
                          </div>
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-zinc-700 group-hover:text-blue-400 transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Center Navigation Links */}
      <div className="hidden lg:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 gap-8 items-center text-[13px] text-zinc-400 font-bold uppercase tracking-widest">
        <button onClick={() => navigate('/')} className={`hover:text-white transition-colors ${location.pathname === '/' ? 'text-white' : ''}`}>Home</button>
        {isAuthenticated && (
          <button onClick={() => navigate('/dashboard')} className={`hover:text-white transition-colors ${location.pathname === '/dashboard' ? 'text-white' : ''}`}>Dashboard</button>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Streak Flame */}
        {isAuthenticated && (
          <div 
            className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 px-3 py-1.5 rounded-full cursor-help group relative"
          >
            <Flame size={16} className={`${(user?.current_streak || 0) > 0 ? 'text-orange-500 fill-orange-500' : 'text-zinc-500'}`} />
            <span className="text-orange-500 font-black text-sm">{user?.current_streak || 0}</span>
            
            {/* Streak Tooltip & Milestones */}
            <div className="absolute top-full right-0 mt-3 w-56 bg-zinc-900 border border-white/10 p-4 rounded-2xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none shadow-2xl z-[200]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-black text-white uppercase tracking-widest">Consistency</span>
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
              <div className="mt-4 pt-3 border-t border-white/5">
                <p className="text-[9px] text-zinc-500 leading-relaxed italic">
                  Keep showing up daily to unlock elite status.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Auth Button */}
        <button 
          onClick={handleAuthClick}
          className="hidden md:flex items-center justify-center border border-white/20 rounded-xl px-5 py-2 text-[13px] bg-white/5 text-white hover:bg-white/10 transition-all font-bold active:scale-95"
        >
          {isAuthenticated ? 'Log Out' : 'Sign In'}
        </button>
        
        <button className="md:hidden text-white p-2">
          <Menu size={24} />
        </button>
      </div>
    </nav>
  )
}
