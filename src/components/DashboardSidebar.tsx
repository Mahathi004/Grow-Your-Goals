import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  BarChart3, 
  Settings,
  LogOut,
  Search,
  Star,
  Trash2,
  RotateCcw,
  X,
  Sparkles
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import useOutsideClick from '../hooks/useOutsideClick';

const DashboardSidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [isExpanded, setIsExpanded] = useState(() => {
    const saved = localStorage.getItem('sidebarExpanded');
    return saved ? JSON.parse(saved) : false;
  });

  const [goals, setGoals] = useState<any[]>([]);
  const [trashGoals, setTrashGoals] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDraftsDropdown, setShowDraftsDropdown] = useState(false);
  const [showTrashDropdown, setShowTrashDropdown] = useState(false);
  const draftsRef = useRef<HTMLDivElement>(null);
  const trashRef = useRef<HTMLDivElement>(null);

  useOutsideClick(draftsRef as React.RefObject<HTMLElement>, () => {
    setShowDraftsDropdown(false);
  });

  useOutsideClick(trashRef as React.RefObject<HTMLElement>, () => {
    setShowTrashDropdown(false);
  });

  const fetchSidebarData = async () => {
    try {
      const res = await api.get('/ai/goals');
      if (res.data.success) {
        setGoals(res.data.goals || []);
      }
      const trashRes = await api.get('/ai/goals/trash');
      if (trashRes.data.success) {
        setTrashGoals(trashRes.data.goals || []);
      }
    } catch (err) {
      console.error('Error fetching sidebar goals:', err);
    }
  };

  useEffect(() => {
    localStorage.setItem('sidebarExpanded', JSON.stringify(isExpanded));
    window.dispatchEvent(new Event('sidebarToggle'));
  }, [isExpanded]);

  useEffect(() => {
    if (user) {
      fetchSidebarData();
    }
    const handleUpdate = () => {
      fetchSidebarData();
    };
    const handleSearch = (e: Event) => {
      const customEvent = e as CustomEvent;
      setSearchQuery(customEvent.detail || '');
    };
    window.addEventListener('goalsUpdated', handleUpdate);
    window.addEventListener('sidebarSearch', handleSearch);
    return () => {
      window.removeEventListener('goalsUpdated', handleUpdate);
      window.removeEventListener('sidebarSearch', handleSearch);
    };
  }, [user]);

  const handleIconClick = (path: string) => {
    navigate(path);
  };

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const handleToggleFavorite = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await api.put(`/ai/goals/${id}/favorite`);
      if (res.data.success) {
        window.dispatchEvent(new Event('goalsUpdated'));
      }
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  const handleRestoreGoal = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await api.post(`/ai/goals/${id}/restore`);
      if (res.data.success) {
        window.dispatchEvent(new Event('goalsUpdated'));
      }
    } catch (err) {
      console.error('Failed to restore goal:', err);
    }
  };

  const handlePermanentDeleteGoal = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to permanently delete this goal? This action cannot be undone.')) {
      return;
    }
    try {
      const res = await api.delete(`/ai/goals/${id}/permanent`);
      if (res.data.success) {
        window.dispatchEvent(new Event('goalsUpdated'));
      }
    } catch (err) {
      console.error('Failed to permanently delete goal:', err);
    }
  };

  const handleDeleteGoal = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to move this draft to the Dustbin?')) {
      return;
    }
    try {
      const res = await api.delete(`/ai/goals/${id}`);
      if (res.data.success) {
        window.dispatchEvent(new Event('goalsUpdated'));
      }
    } catch (err) {
      console.error('Failed to delete goal:', err);
    }
  };

  const handleGoalClick = (goal: any) => {
    if (goal.goal_setup_finished) {
      navigate(`/roadmap/${goal.id}`);
    } else {
      navigate(`/dashboard?mode=chat&goalId=${goal.id}`);
    }
  };

  const navItems = [
    { icon: <LayoutDashboard size={20} />, label: "Dashboard", path: "/dashboard" },
    { icon: <Sparkles size={20} className="text-purple-400" />, label: "Drafts", path: "#drafts", isDrafts: true },
    { icon: <Trash2 size={20} className="text-rose-400" />, label: "Dustbin", path: "#trash", isTrash: true },
    { icon: <BarChart3 size={20} />, label: "Progress", path: "/progress" },
    { icon: <Settings size={20} />, label: "Settings", path: "/settings" },
  ];

  // Deduplicate by ID to prevent duplicates in favorites and recent goals
  const uniqueGoals = Array.from(new Map(goals.map(g => [g.id, g])).values());
  const uniqueTrashGoals = Array.from(new Map(trashGoals.map(g => [g.id, g])).values());

  // Partition goals
  const filteredGoals = uniqueGoals.filter(g => 
    g.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Partition into active goals vs draft goals
  const activeFilteredGoals = filteredGoals.filter(g => g.goal_setup_finished);
  const starredGoals = activeFilteredGoals.filter(g => g.is_favorite);
  const recentGoals = activeFilteredGoals.filter(g => !g.is_favorite);
  const draftGoals = filteredGoals.filter(g => !g.goal_setup_finished);

  const filteredTrashGoals = uniqueTrashGoals.filter(g => 
    g.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <motion.aside 
      initial={false}
      animate={{ width: isExpanded ? 280 : 70 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="fixed left-0 top-0 bottom-0 bg-[#000000]/60 backdrop-blur-3xl border-r border-white/5 flex flex-col items-start py-6 z-50 overflow-visible"
    >
      <div 
        className="px-4 mb-10 w-full flex items-center cursor-pointer group"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="relative flex items-center justify-center min-w-[38px] h-10 rounded-xl bg-white/[0.03] border border-white/10 backdrop-blur-md group-hover:bg-white/[0.05] transition-all duration-500 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <svg width="22" height="22" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white transition-transform duration-500 group-hover:scale-110 group-hover:rotate-12 relative z-10">
            <path d="M30.5 7.5C27.85 5.11 24.18 4 20 4C11.16 4 4 11.16 4 20C4 28.84 11.16 36 20 36C28.84 36 36 28.84 36 20H20" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M20 12L28 20L20 28" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        
        <AnimatePresence>
          {isExpanded && (
            <motion.span 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="ml-3 font-black text-xl text-white tracking-tighter whitespace-nowrap bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60"
            >
              Grow Your Goals
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <nav className="flex flex-col gap-2 w-full px-3 flex-1 overflow-y-auto custom-scrollbar">
        {navItems.map((item, idx) => (
          <NavItem 
            key={idx}
            icon={item.icon} 
            label={item.label} 
            active={
              item.isDrafts 
                ? showDraftsDropdown 
                : item.isTrash 
                  ? showTrashDropdown 
                  : location.pathname === item.path
            }
            isExpanded={isExpanded}
            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
              if (item.isDrafts) {
                e.stopPropagation();
                setShowDraftsDropdown(!showDraftsDropdown);
                setShowTrashDropdown(false);
              } else if (item.isTrash) {
                e.stopPropagation();
                setShowTrashDropdown(!showTrashDropdown);
                setShowDraftsDropdown(false);
              } else {
                handleIconClick(item.path);
              }
            }} 
          />
        ))}

        {/* Drafts Flyout Popover */}
        <AnimatePresence>
          {showDraftsDropdown && (
            <motion.div
              ref={draftsRef}
              initial={{ opacity: 0, x: -10, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -10, scale: 0.95 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              style={{ 
                position: 'absolute', 
                left: isExpanded ? '285px' : '75px', 
                top: '144px',
                width: '320px',
              }}
              className="z-[999] bg-[#090b11]/95 backdrop-blur-3xl border border-white/10 rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.7),inset_0_1px_1px_rgba(255,255,255,0.05)] flex flex-col gap-3"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                <div className="flex items-center gap-2 text-purple-400">
                  <Sparkles size={14} className="animate-pulse" />
                  <span className="text-xs font-black uppercase tracking-[0.2em]">Draft Journeys</span>
                </div>
                <span className="bg-purple-500/20 border border-purple-500/30 text-purple-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {draftGoals.length} {draftGoals.length === 1 ? 'draft' : 'drafts'}
                </span>
              </div>

              {/* List */}
              <div className="flex flex-col gap-1.5 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                {draftGoals.length > 0 ? (
                  draftGoals.map(goal => (
                    <div 
                      key={goal.id}
                      onClick={() => {
                        setShowDraftsDropdown(false);
                        handleGoalClick(goal);
                      }}
                      className="group flex items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.07] hover:border-white/[0.1] transition-all duration-300 cursor-pointer"
                    >
                      <div className="flex flex-col gap-0.5 min-w-0 flex-1 mr-3">
                        <span className="text-xs font-semibold text-zinc-100 group-hover:text-white truncate transition-colors">
                          {goal.title || 'Untitled Draft'}
                        </span>
                        <span className="text-[9px] text-purple-400/80 font-semibold uppercase tracking-wider">
                          {goal.category || 'Custom'} • Setup
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteGoal(goal.id, e);
                        }}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100"
                        title="Move to Dustbin"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                    <div className="w-10 h-10 bg-white/[0.02] border border-white/5 rounded-full flex items-center justify-center mb-3">
                      <Sparkles size={16} className="text-zinc-500" />
                    </div>
                    <span className="text-xs font-bold text-zinc-300 mb-1">No drafts yet</span>
                    <p className="text-[10px] text-zinc-500 leading-relaxed max-w-[200px]">
                      Start a goal discussion on the dashboard to save a draft.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dustbin Flyout Popover */}
        <AnimatePresence>
          {showTrashDropdown && (
            <motion.div
              ref={trashRef}
              initial={{ opacity: 0, x: -10, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -10, scale: 0.95 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              style={{ 
                position: 'absolute', 
                left: isExpanded ? '285px' : '75px', 
                top: '196px',
                width: '320px',
              }}
              className="z-[999] bg-[#090b11]/95 backdrop-blur-3xl border border-white/10 rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.7),inset_0_1px_1px_rgba(255,255,255,0.05)] flex flex-col gap-3"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                <div className="flex items-center gap-2 text-rose-400">
                  <Trash2 size={14} />
                  <span className="text-xs font-black uppercase tracking-[0.2em]">Goal Dustbin</span>
                </div>
                <span className="bg-rose-500/20 border border-rose-500/30 text-rose-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {filteredTrashGoals.length} {filteredTrashGoals.length === 1 ? 'item' : 'items'}
                </span>
              </div>

              {/* List */}
              <div className="flex flex-col gap-1.5 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                {filteredTrashGoals.length > 0 ? (
                  filteredTrashGoals.map(goal => (
                    <div 
                      key={goal.id}
                      className="group flex items-center justify-between p-2 rounded-xl bg-red-950/[0.04] border border-red-500/[0.05] hover:bg-red-950/[0.08] hover:border-red-500/[0.15] transition-all duration-300"
                    >
                      <div className="flex flex-col gap-0.5 min-w-0 flex-1 mr-3">
                        <span className="text-xs font-semibold text-zinc-300 group-hover:text-white truncate">
                          {goal.title || 'Untitled Goal'}
                        </span>
                        <span className="text-[9px] text-rose-400/80 font-bold tracking-wide uppercase">
                          {getCountdownText(typeof goal.seconds_left === 'string' ? parseFloat(goal.seconds_left) : goal.seconds_left)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRestoreGoal(goal.id, e);
                          }}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-green-400 hover:bg-green-500/10 transition-all"
                          title="Restore Goal"
                        >
                          <RotateCcw size={12} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePermanentDeleteGoal(goal.id, e);
                          }}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                          title="Delete Permanently"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                    <div className="w-10 h-10 bg-white/[0.02] border border-white/5 rounded-full flex items-center justify-center mb-3">
                      <Trash2 size={16} className="text-zinc-500" />
                    </div>
                    <span className="text-xs font-bold text-zinc-300 mb-1">Dustbin is empty</span>
                    <p className="text-[10px] text-zinc-500 leading-relaxed max-w-[200px]">
                      Deleted goals stay here for a grace period before permanent removal.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {isExpanded && (
          <>
            <div className="h-px bg-white/5 my-4" />

            {/* Search Bar */}
            <div className="mb-4 px-1">
              <div className="flex items-center bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] rounded-xl px-2.5 py-1.5 transition-colors focus-within:border-white/10 focus-within:bg-white/[0.05]">
                <Search size={13} className="text-zinc-400 mr-2 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Search goals..."
                  value={searchQuery}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSearchQuery(val);
                    window.dispatchEvent(new CustomEvent('sidebarSearch', { detail: val }));
                  }}
                  className="bg-transparent border-none outline-none text-xs text-white placeholder-zinc-500 w-full"
                />
                {searchQuery && (
                  <button 
                    onClick={() => {
                      setSearchQuery('');
                      window.dispatchEvent(new CustomEvent('sidebarSearch', { detail: '' }));
                    }}
                    className="text-zinc-500 hover:text-white flex-shrink-0"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Favorites Section */}
            {starredGoals.length > 0 && (
              <div className="flex flex-col gap-1.5 mb-4 px-1">
                <div className="flex items-center gap-1.5 px-1.5 text-amber-400/80 text-[10px] font-black uppercase tracking-[0.2em]">
                  <Star size={10} fill="currentColor" />
                  <span>Starred Goals</span>
                </div>
                <div className="flex flex-col gap-1">
                  {starredGoals.map(goal => (
                    <SidebarGoalItem 
                      key={goal.id} 
                      goal={goal} 
                      onToggleFavorite={handleToggleFavorite} 
                      onClick={() => handleGoalClick(goal)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Recent Conversations Section */}
            {recentGoals.length > 0 && (
              <div className="flex flex-col gap-1.5 mb-4 px-1">
                <div className="px-1.5 text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em]">
                  Recent Goals
                </div>
                <div className="flex flex-col gap-1">
                  {recentGoals.map(goal => (
                    <SidebarGoalItem 
                      key={goal.id} 
                      goal={goal} 
                      onToggleFavorite={handleToggleFavorite} 
                      onClick={() => handleGoalClick(goal)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Draft Goals Section */}
            {draftGoals.length > 0 && (
              <div className="flex flex-col gap-1.5 mb-4 px-1">
                <div className="flex items-center gap-1.5 px-1.5 text-purple-400/80 text-[10px] font-black uppercase tracking-[0.2em]">
                  <Sparkles size={10} className="animate-pulse" />
                  <span>Draft Goals</span>
                </div>
                <div className="flex flex-col gap-1">
                  {draftGoals.map(goal => (
                    <SidebarDraftGoalItem 
                      key={goal.id} 
                      goal={goal} 
                      onDelete={handleDeleteGoal} 
                      onClick={() => handleGoalClick(goal)}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </nav>

      <div className="mt-auto w-full px-3 flex flex-col gap-4">
        <div 
          onClick={() => navigate('/settings')}
          className="flex items-center justify-between p-1 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/5 transition-all group cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0">
              <div className="w-9 h-9 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center overflow-hidden group-hover:border-white/20 transition-all">
                <div className="w-full h-full bg-gradient-to-b from-blue-600/50 to-indigo-900/50 flex items-center justify-center text-xs font-bold text-white">
                  {user?.firstName?.[0] || 'U'}
                </div>
              </div>
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-[#000000]"></div>
            </div>
            
            <AnimatePresence>
              {isExpanded && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="flex flex-col overflow-hidden"
                >
                  <span className="text-sm font-medium text-white whitespace-nowrap">{user?.firstName || 'User'}</span>
                  <span className="text-[11px] text-zinc-500 whitespace-nowrap">Free Tier</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {isExpanded && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleLogout();
              }}
              className="p-2 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          )}
        </div>
      </div>
    </motion.aside>
  );
};

const SidebarGoalItem: React.FC<{
  goal: any;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onClick: () => void;
}> = ({ goal, onToggleFavorite, onClick }) => {
  return (
    <div 
      onClick={onClick}
      className="group relative flex items-center justify-between px-2 py-1.5 rounded-lg bg-white/[0.01] border border-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.08] transition-all duration-300 cursor-pointer overflow-hidden"
    >
      <div className="flex flex-col gap-0.5 min-w-0 flex-1 mr-2">
        <span className="text-xs font-semibold text-zinc-200 truncate group-hover:text-white transition-colors">
          {goal.title || 'Untitled Goal'}
        </span>
        <span className="text-[9px] text-zinc-500 font-medium truncate uppercase tracking-wider">
          {goal.category || 'Custom'}
        </span>
      </div>
      
      <button 
        onClick={(e) => onToggleFavorite(goal.id, e)}
        className={`flex-shrink-0 p-1 rounded-md transition-all duration-300 ${
          goal.is_favorite 
            ? 'text-amber-400 hover:text-amber-300' 
            : 'text-zinc-600 hover:text-zinc-400 opacity-0 group-hover:opacity-100'
        }`}
      >
        <Star size={12} fill={goal.is_favorite ? 'currentColor' : 'none'} />
      </button>
    </div>
  );
};

const SidebarDraftGoalItem: React.FC<{
  goal: any;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onClick: () => void;
}> = ({ goal, onDelete, onClick }) => {
  return (
    <div 
      onClick={onClick}
      className="group relative flex items-center justify-between px-2 py-1.5 rounded-lg bg-purple-950/[0.02] border border-purple-500/[0.03] hover:bg-purple-950/[0.06] hover:border-purple-500/[0.1] transition-all duration-300 cursor-pointer overflow-hidden"
    >
      <div className="flex flex-col gap-0.5 min-w-0 flex-1 mr-2">
        <span className="text-xs font-semibold text-purple-200 truncate group-hover:text-purple-100 transition-colors">
          {goal.title || 'Untitled Draft'}
        </span>
        <span className="text-[9px] text-purple-400/60 font-medium truncate uppercase tracking-wider">
          {goal.category || 'Custom'} • Setup
        </span>
      </div>
      
      <button 
        onClick={(e) => onDelete(goal.id, e)}
        className="flex-shrink-0 p-1 rounded-md text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all duration-300"
        title="Move to Dustbin"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
};

const getCountdownText = (secondsLeft: number) => {
  if (!secondsLeft || secondsLeft <= 0) return '0d left';
  const days = Math.ceil(secondsLeft / 86400);
  if (days >= 1) return `${days}d left`;
  const hours = Math.ceil(secondsLeft / 3600);
  return `${hours}h left`;
};



interface NavItemProps {
  icon: React.ReactNode;
  active?: boolean;
  label: string;
  isExpanded: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

const NavItem = ({ icon, active = false, label, isExpanded, onClick }: NavItemProps) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div className="relative flex items-center">
      <button 
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`w-full h-11 flex items-center rounded-xl transition-all duration-300 relative group
        ${isExpanded ? 'px-3' : 'justify-center'}
        ${active 
          ? 'bg-white/10 text-white shadow-lg shadow-white/5' 
          : 'text-zinc-500 hover:text-white hover:bg-white/[0.04]'}`}
      >
        {active && (
          <motion.div 
            layoutId="activeGlow"
            className="absolute inset-0 bg-blue-500/10 rounded-xl blur-md -z-10"
          />
        )}

        <motion.div 
          whileHover={{ scale: 1.1 }}
          transition={{ type: "spring", stiffness: 400, damping: 10 }}
          className="flex-shrink-0"
        >
          {icon}
        </motion.div>

        <AnimatePresence>
          {isExpanded && (
            <motion.span 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="ml-3 text-sm font-medium whitespace-nowrap"
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>

        {active && (
          <motion.div 
            layoutId="activeLine"
            className="absolute left-0 w-1 h-5 bg-white rounded-full ml-1"
          />
        )}
      </button>

      <AnimatePresence>
        {!isExpanded && isHovered && (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 20 }}
            exit={{ opacity: 0, x: 10 }}
            className="fixed left-12 px-3 py-1.5 bg-[#151515] border border-white/10 text-white text-xs font-medium rounded-lg shadow-xl pointer-events-none z-[100] whitespace-nowrap"
          >
            {label}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DashboardSidebar;
