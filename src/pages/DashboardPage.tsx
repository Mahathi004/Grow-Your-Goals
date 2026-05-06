import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase, Dumbbell, Sparkles, BookOpen, TrendingUp,
  Clock, Plus, Pin, Play, Archive, MoreVertical,
  Target, CheckSquare, Trash2, Copy, Edit3, XCircle
} from 'lucide-react';
import AIChat from '../components/AIChat';
import api from '../api';
import useOutsideClick from '../hooks/useOutsideClick';
import ConfirmModal from '../components/ConfirmModal';
import Toast from '../components/Toast';
import type { ToastMessage } from '../components/Toast';
import { useRef } from 'react';

const GOAL_CHIPS = [
  { label: 'Career', icon: Briefcase, color: '#60A5FA' },
  { label: 'Fitness', icon: Dumbbell, color: '#34D399' },
  { label: 'Beauty', icon: Sparkles, color: '#F472B6' },
  { label: 'Study', icon: BookOpen, color: '#C084FC' },
  { label: 'Business', icon: TrendingUp, color: '#F59E0B' },
  { label: 'Habit', icon: Clock, color: '#E5E7EB' },
];

export default function DashboardPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isChatting, setIsChatting] = useState(false);
  const [goals, setGoals] = useState<any[]>([]);
  const [loadingGoals, setLoadingGoals] = useState(true);
  const [, setTodayData] = useState<{ todayTasks: any[]; overdueTasks: any[] }>({ todayTasks: [], overdueTasks: [] });
  const [chatTrigger, setChatTrigger] = useState<string | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type?: 'danger' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
  });

  const addToast = (type: 'success' | 'error', message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleChipClick = (label: string) => {
    const presets: Record<string, string> = {
      Career: 'I want to advance my career.',
      Fitness: 'I want to improve my fitness.',
      Beauty: 'I want to improve my hair/skin health.',
      Study: 'I want to study more effectively.',
      Business: 'I want to start or grow a business.',
      Habit: 'I want to build a new habit.',
    };
    setChatTrigger(presets[label] || `I want to achieve a ${label} goal.`);
    setTimeout(() => setChatTrigger(null), 1000);
  };

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate('/auth');
    else if (isAuthenticated) fetchGoals();
  }, [isAuthenticated, authLoading]);

  const fetchGoals = async () => {
    try {
      const res = await api.get('/ai/goals');
      if (res.data.success) setGoals(res.data.goals);
      const todayRes = await api.get('/ai/today');
      if (todayRes.data.success) setTodayData({ todayTasks: todayRes.data.todayTasks || [], overdueTasks: todayRes.data.overdueTasks || [] });
    } catch (err) { }
    finally { setLoadingGoals(false); }
  };

  const handleGoalAction = async (id: string, action: string, value?: any) => {
    try {
      let res;
      if (action === 'pin') res = await api.put(`/ai/goals/${id}/primary`, { isPinned: value });
      else if (action === 'status') res = await api.put(`/ai/goals/${id}/status`, { status: value });
      else if (action === 'archive') res = await api.put(`/ai/goals/${id}/archive`, { archived: value });
      else if (action === 'rename') res = await api.put(`/ai/goals/${id}/rename`, { title: value });
      else if (action === 'delete') res = await api.delete(`/ai/goals/${id}`);
      else if (action === 'duplicate') res = await api.post(`/ai/goals/${id}/duplicate`);
      
      if (res?.data?.success || action === 'delete') {
        addToast('success', `Goal ${action === 'delete' ? 'deleted' : action === 'duplicate' ? 'duplicated' : 'updated'} successfully`);
        fetchGoals();
      }
    } catch (err: any) {
      // Error handled by toast
      addToast('error', err.response?.data?.message || `Failed to ${action} goal`);
    }
  };

  const handleBulkDelete = async () => {
    try {
      const res = await api.post('/ai/goals/bulk-delete', { ids: selectedIds });
      if (res.data.success) {
        addToast('success', `${selectedIds.length} goals deleted successfully`);
        setSelectedIds([]);
        setIsSelectionMode(false);
        fetchGoals();
      }
    } catch (err: any) {
      // Error handled by toast
      addToast('error', err.response?.data?.message || 'Failed to delete selected goals');
    }
  };

  const handleBulkArchive = async (archive: boolean) => {
    try {
      const res = await api.post('/ai/goals/bulk-archive', { ids: selectedIds, archive });
      if (res.data.success) {
        addToast('success', `${selectedIds.length} goals ${archive ? 'archived' : 'restored'} successfully`);
        setSelectedIds([]);
        setIsSelectionMode(false);
        fetchGoals();
      }
    } catch (err: any) {
      // Error handled by toast
      addToast('error', err.response?.data?.message || `Failed to ${archive ? 'archive' : 'restore'} selected goals`);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === goals.length) setSelectedIds([]);
    else setSelectedIds(goals.map(g => g.id));
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const confirmDelete = (goal: any) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Delete Goal',
      message: `Are you sure you want to delete "${goal.goal_title}"? This will remove all history, roadmaps, and progress. This action cannot be undone.`,
      type: 'danger',
      onConfirm: () => handleGoalAction(goal.id, 'delete'),
    });
  };

  if (authLoading) return null;

  const pinnedGoal = goals.find((g: any) => g.is_primary && g.goal_setup_finished);
  const activeGoals = goals.filter((g: any) => g.goal_setup_finished && !g.is_primary && !g.is_archived);
  const draftGoals = goals.filter((g: any) => !g.goal_setup_finished);
  const archivedGoals = goals.filter((g: any) => g.is_archived && g.goal_setup_finished);
  
  const hasGoals = !loadingGoals && goals.length > 0;

  /*
   * SINGLE RETURN — AIChat is mounted exactly once, always at the
   * same DOM position. No unmount/remount = no textarea glitches.
   */
  return (
    <div className="w-full relative z-10">
      {/* Premium Cinematic Background */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Ambient Glows */}
        <div className="absolute top-[-10%] left-[5%] w-[50%] h-[50%] bg-[#3b82f6] opacity-[0.18] blur-[140px] rounded-full mix-blend-screen animate-pulse" />
        <div className="absolute bottom-[-10%] right-[5%] w-[45%] h-[45%] bg-[#8b5cf6] opacity-[0.15] blur-[150px] rounded-full mix-blend-screen animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute top-[20%] right-[15%] w-[35%] h-[35%] bg-[#ec4899] opacity-[0.12] blur-[140px] rounded-full mix-blend-screen animate-pulse" style={{ animationDelay: '4s' }} />
        
        {/* Vignette Depth */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(10,12,20,0.85)_120%)]" />
      </div>

      {/* ── CENTERED HEADER + COMPOSER ───────────────────────── */}
      <div className={`flex flex-col items-center px-6 relative z-10 transition-all duration-300 ${isChatting ? 'pt-6' : 'pt-[clamp(100px,12vh,160px)] pb-4 mb-[32px]'
        }`}>
        {/* Title — hidden during chat */}
        {!isChatting && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8 w-full max-w-4xl">
            <h1 className="text-[32px] md:text-[42px] font-extrabold text-white tracking-[-0.03em] leading-[1.1]">
              Got an idea, {user?.firstName ? (user.firstName.charAt(0).toUpperCase() + user.firstName.slice(1).toLowerCase()) : 'Achiever'}?
            </h1>
          </motion.div>
        )}

        {/* AIChat — SINGLE INSTANCE, never unmounts */}
        <div className={`w-full transition-all duration-500 ${isChatting ? '' : 'max-w-[820px] w-full mx-auto'}`}>
          <AIChat onChatStatusChange={setIsChatting} externalTrigger={chatTrigger} />
        </div>

        {/* Category chips — hidden during chat */}
        {!isChatting && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
            className="flex flex-nowrap overflow-x-auto custom-scrollbar justify-center gap-3 mt-6 max-w-[1000px] mx-auto w-full pb-2 px-4">
            {GOAL_CHIPS.map((chip) => (
              <button key={chip.label} onClick={() => handleChipClick(chip.label)}
                className="group flex flex-shrink-0 items-center gap-2 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.05] hover:border-white/[0.15] px-4 py-2 rounded-full transition-all duration-300 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.1)]">
                <chip.icon size={14} className="group-hover:scale-110 transition-transform" style={{ color: chip.color }} />
                <span className="text-white/70 group-hover:text-white text-[13px] font-medium tracking-wide">{chip.label}</span>
              </button>
            ))}
            <button className="flex flex-shrink-0 items-center gap-2 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.05] px-4 py-2 rounded-full text-white/50 hover:text-white transition-all backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.1)] text-[13px] font-medium tracking-wide">
              <Plus size={14} style={{ color: '#9CA3AF' }} /><span>Custom</span>
            </button>
          </motion.div>
        )}
      </div>

      {/* ── BELOW-FOLD: Goal Portfolio (visible only when NOT chatting + has goals) ── */}
      {!isChatting && (
        <div className="w-full px-8 py-10 max-w-[1000px] mx-auto relative z-10 bg-gradient-to-br from-[rgba(15,18,28,0.88)] to-[rgba(10,12,20,0.76)] backdrop-blur-[24px] border border-white/[0.05] rounded-[28px] shadow-[0_20px_60px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.04)] mb-24 mt-28">

          {/* Ambient background glows behind portfolio */}
          <div className="absolute -top-20 -left-20 w-96 h-96 bg-[#7c3aed] opacity-[0.08] blur-[120px] rounded-full pointer-events-none -z-10" />
          <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-[#3b82f6] opacity-[0.06] blur-[120px] rounded-full pointer-events-none -z-10" />

          {/* Header & Controls */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 border-b border-white/[0.04] pb-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1 tracking-tight">
                {isSelectionMode ? `${selectedIds.length} Selected` : 'Goal Portfolio'}
              </h2>
              <p className="text-[#9aa3b2] text-sm font-medium opacity-[0.72] leading-[1.6]">
                {isSelectionMode ? 'Select the goals you want to manage in bulk.' : 'Manage your active journeys and archived ambitions.'}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              {/* Search Bar (UI Only) */}
              <div className="flex items-center bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.04] rounded-full px-4 py-2 w-full sm:w-64 transition-colors focus-within:border-white/10 focus-within:bg-white/[0.05]">
                <span className="text-[#9aa3b2] mr-2 text-sm opacity-70">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                </span>
                <input type="text" placeholder="Search goals..." className="bg-transparent border-none outline-none text-sm text-white placeholder-[#9aa3b2] w-full" />
              </div>

              <div className="flex items-center gap-3">
                {isSelectionMode && (
                  <button
                    onClick={toggleSelectAll}
                    className="px-4 py-2 bg-white/[0.04] hover:bg-white/[0.08] text-[#9aa3b2] hover:text-white rounded-full text-sm font-bold transition-all border border-transparent"
                  >
                    {selectedIds.length === goals.length ? 'Deselect All' : 'Select All'}
                  </button>
                )}
                <button
                  onClick={() => {
                    setIsSelectionMode(!isSelectionMode);
                    if (!isSelectionMode) setSelectedIds([]);
                    else setSelectedIds([]);
                  }}
                  className={`px-4 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2 ${isSelectionMode ? 'bg-[#1a1f2b] text-white border border-[#7c3aed]/40 shadow-[0_0_10px_rgba(124,58,237,0.1)]' : 'bg-white/[0.04] hover:bg-white/[0.07] text-[#9aa3b2] hover:text-white border border-transparent'}`}
                >
                  {isSelectionMode ? <XCircle size={16} className="text-[#7c3aed]" /> : <CheckSquare size={16} />}
                  {isSelectionMode ? 'Exit' : 'Select'}
                </button>
                <div className="flex bg-white/[0.02] border border-white/[0.04] rounded-full p-1 gap-1">
                  {['All', 'Active', 'Pinned', 'Archived'].map(filter => (
                    <button key={filter} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${filter === 'All' ? 'bg-[#1a1f2b] text-white border border-[#7c3aed]/40 shadow-[0_0_10px_rgba(124,58,237,0.1)]' : 'bg-transparent text-[#9aa3b2] hover:bg-white/[0.07] hover:text-white border border-transparent'}`}>
                      {filter}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {!hasGoals ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 bg-[#1a1f2b] border border-white/[0.05] rounded-full flex items-center justify-center mb-6 shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]">
                <Target className="text-[#7c3aed] drop-shadow-[0_0_8px_rgba(124,58,237,0.3)]" size={32} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Your portfolio is empty</h3>
              <p className="text-[#9aa3b2] max-w-sm">Create your first goal journey using the AI assistant above to start building your portfolio.</p>
            </motion.div>
          ) : (
            <div className="space-y-16">
              {/* Pinned Goals */}
              {pinnedGoal && (
                <section className="overflow-visible">
                  <div className="flex items-center gap-2 mb-6 text-blue-400 opacity-60">
                    <Pin size={16} fill="currentColor" />
                    <h3 className="text-xs font-black uppercase tracking-[0.3em]">Pinned Strategy</h3>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-1 gap-4 overflow-visible">
                    <GoalRow
                      goal={pinnedGoal}
                      isPinned
                      onAction={handleGoalAction}
                      onDelete={() => confirmDelete(pinnedGoal)}
                      onView={() => navigate(`/roadmap?id=${pinnedGoal.id}`)}
                      isSelectionMode={isSelectionMode}
                      isSelected={selectedIds.includes(pinnedGoal.id)}
                      onSelect={() => toggleSelection(pinnedGoal.id)}
                    />
                  </div>
                </section>
              )}

              {/* Draft Journeys */}
              {draftGoals.length > 0 && (
                <section className="overflow-visible">
                  <div className="flex items-center gap-2 mb-6 text-purple-400 opacity-60">
                    <Sparkles size={16} />
                    <h3 className="text-xs font-black uppercase tracking-[0.3em]">Draft Journeys (Setup Mode)</h3>
                  </div>
                  <div className="space-y-4 overflow-visible">
                    {draftGoals.map((goal: any) => (
                      <GoalRow
                        key={goal.id}
                        goal={goal}
                        onAction={handleGoalAction}
                        onDelete={() => confirmDelete(goal)}
                        onView={() => navigate(`/roadmap?id=${goal.id}`)}
                        isSelectionMode={isSelectionMode}
                        isSelected={selectedIds.includes(goal.id)}
                        onSelect={() => toggleSelection(goal.id)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Active Portfolio */}
              <section className="overflow-visible">
                <div className="flex items-center gap-2 mb-6 text-[#9aa3b2] opacity-60">
                  <Briefcase size={16} />
                  <h3 className="text-xs font-black uppercase tracking-[0.3em]">Active Portfolio</h3>
                </div>
                <div className="space-y-4 overflow-visible">
                  {activeGoals.map((goal: any) => (
                    <GoalRow
                      key={goal.id}
                      goal={goal}
                      onAction={handleGoalAction}
                      onDelete={() => confirmDelete(goal)}
                      onView={() => navigate(`/roadmap?id=${goal.id}`)}
                      isSelectionMode={isSelectionMode}
                      isSelected={selectedIds.includes(goal.id)}
                      onSelect={() => toggleSelection(goal.id)}
                    />
                  ))}
                </div>
              </section>

              {/* Archived Collection */}
              {archivedGoals.length > 0 && (
                <section className="pt-8 border-t border-white/[0.04] overflow-visible">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2 text-[#9aa3b2] opacity-60">
                      <Archive size={16} />
                      <h3 className="text-xs font-black uppercase tracking-[0.3em]">Archived Ambitions</h3>
                    </div>
                  </div>
                  <div className="space-y-4 opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all overflow-visible">
                    {archivedGoals.map((goal: any) => (
                      <GoalRow
                        key={goal.id}
                        goal={goal}
                        onAction={handleGoalAction}
                        onDelete={() => confirmDelete(goal)}
                        onView={() => navigate(`/roadmap?id=${goal.id}`)}
                        isSelectionMode={isSelectionMode}
                        isSelected={selectedIds.includes(goal.id)}
                        onSelect={() => toggleSelection(goal.id)}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      )}

      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        onClose={() => setConfirmConfig({ ...confirmConfig, isOpen: false })}
        onConfirm={confirmConfig.onConfirm}
        title={confirmConfig.title}
        message={confirmConfig.message}
        type={confirmConfig.type}
      />

      {/* Bulk Action Toolbar */}
      <AnimatePresence>
        {isSelectionMode && selectedIds.length > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-6 bg-zinc-900/90 backdrop-blur-2xl border border-white/10 px-6 py-4 rounded-[32px] shadow-[0_30px_60px_rgba(0,0,0,0.6)] min-w-[400px]"
          >
            <div className="flex items-center gap-3 border-r border-white/10 pr-6">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                {selectedIds.length}
              </div>
              <span className="text-white font-bold text-sm">Goals Selected</span>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setConfirmConfig({
                    isOpen: true,
                    title: 'Archive Selected Goals',
                    message: `Are you sure you want to archive ${selectedIds.length} goals? They will be moved to the archive section.`,
                    type: 'info',
                    onConfirm: () => handleBulkArchive(true),
                  });
                }}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-bold transition-all border border-white/5"
              >
                <Archive size={14} /> Archive Selected
              </button>
              <button
                onClick={() => {
                  setConfirmConfig({
                    isOpen: true,
                    title: 'Delete Selected Goals',
                    message: `Are you sure you want to delete ${selectedIds.length} goals? This action cannot be undone.`,
                    type: 'danger',
                    onConfirm: handleBulkDelete,
                  });
                }}
                className="flex items-center gap-2 px-4 py-2 bg-rose-600/10 hover:bg-rose-600 text-rose-500 hover:text-white rounded-xl text-xs font-bold transition-all border border-rose-500/20"
              >
                <Trash2 size={14} /> Delete Selected
              </button>
              <button
                onClick={() => setSelectedIds([])}
                className="px-4 py-2 text-zinc-400 hover:text-white text-xs font-bold transition-all"
              >
                Clear
              </button>
            </div>

            <button
              onClick={() => setIsSelectionMode(false)}
              className="p-2 text-zinc-500 hover:text-white transition-colors"
            >
              <XCircle size={20} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <Toast toasts={toasts} removeToast={removeToast} />
    </div>
  );
}

function GoalRow({ goal, isPinned = false, onAction, onDelete, onView, isSelectionMode, isSelected, onSelect }: any) {
  const [showActions, setShowActions] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useOutsideClick(menuRef as any, () => setShowActions(false));
  const progress = goal.progress_percent || 0;
  const status = goal.status || 'Active';

  const getIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'career': return Briefcase;
      case 'fitness': return Dumbbell;
      case 'beauty': return Sparkles;
      case 'study': return BookOpen;
      case 'business': return TrendingUp;
      case 'habit': return Clock;
      default: return Target;
    }
  };
  const Icon = getIcon(goal.category);

  const categoryConfig: any = {
    career: { color: '#94a3b2', raw: '148, 163, 178' }, 
    fitness: { color: '#c084fc', raw: '192, 132, 252' }, 
    beauty: { color: '#f472b6', raw: '244, 114, 182' }, 
    study: { color: '#818cf8', raw: '129, 140, 248' }, 
    business: { color: '#fbbf24', raw: '251, 191, 36' }, 
    habit: { color: '#94a3b8', raw: '148, 163, 184' }, 
    custom: { color: '#4ade80', raw: '74, 222, 128' } 
  };
  const config = categoryConfig[goal.category?.toLowerCase()] || categoryConfig.custom;

  const statusColors: any = {
    active: 'text-blue-400 bg-blue-500/10',
    completed: 'text-emerald-400 bg-emerald-500/10',
    archived: 'text-zinc-500 bg-white/5',
    paused: 'text-orange-400 bg-orange-500/10',
    onboarding: 'text-purple-400 bg-purple-500/10',
  };

  return (
    <div
      onClick={() => isSelectionMode ? onSelect() : onView()}
      className={`group relative bg-white/[0.015] backdrop-blur-xl border rounded-[22px] p-5 flex flex-col md:flex-row md:items-center gap-6 transition-all duration-300 cursor-pointer hover:bg-white/[0.03] shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)] ${
        isSelected 
          ? 'border-[#7c3aed]/20 bg-[#7c3aed]/5 ring-1 ring-[#7c3aed]/5' 
          : 'border-white/[0.04]'
      } ${isPinned && !isSelected ? 'ring-1 ring-[#7c3aed]/5' : ''} ${showActions ? 'z-[1000] !overflow-visible' : 'z-10'}`}
    >
      {/* Left: Checkbox (Selection Mode) */}
      <AnimatePresence>
        {(isSelectionMode || isSelected) && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 'auto', opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="flex items-center"
          >
            <div
              onClick={(e) => { e.stopPropagation(); onSelect(); }}
              className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                isSelected ? 'bg-[#1a1f2b] border-[#7c3aed]/50 text-[#7c3aed] shadow-[0_0_8px_rgba(124,58,237,0.2)]' : 'border-white/20 hover:border-white/40'
              }`}
            >
              {isSelected && <CheckSquare size={14} fill="currentColor" />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Left: Info */}
      <div className="flex flex-1 items-center gap-7 min-w-0">
        <div 
          className="p-[17px] rounded-[18px] flex-shrink-0 transition-all duration-300 relative flex items-center justify-center overflow-hidden"
          style={{ 
            backgroundColor: `rgba(${config.raw}, 0.05)`,
            border: `1px solid rgba(${config.raw}, 0.08)`,
          }}
        >
          <Icon size={23} style={{ color: `rgba(${config.raw}, 0.5)` }} strokeWidth={2} className="relative z-10" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 mb-1.5">
            <h4 className="text-[17px] font-semibold text-white/90 truncate transition-colors cursor-pointer" onClick={onView}>
              {goal.title}
            </h4>
            <span className={`px-2 py-0.5 rounded-[5px] text-[10px] font-bold uppercase tracking-widest opacity-90 ${statusColors[status.toLowerCase()] || statusColors.active}`}>
              {status}
            </span>
            {isPinned && <Pin size={12} className="text-[#7c3aed]/60" fill="currentColor" />}
          </div>
          <p className="text-[#9aa3b2]/72 text-[14px] font-normal line-clamp-1 mb-2.5">{goal.description || 'No description provided.'}</p>
          <div className="flex flex-wrap items-center gap-5 opacity-50">
            <div className="flex items-center gap-1.5 bg-transparent px-0 py-0 rounded text-[12px] font-medium text-[#9aa3b2] uppercase tracking-tight">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: config.color }} />
              {goal.category || 'Custom'}
            </div>
            <span className="text-[12px] text-[#9aa3b2] font-medium uppercase tracking-tight flex items-center gap-1">
              <Clock size={11} /> {new Date(goal.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {/* Middle: Progress */}
      <div className="w-full md:w-56 flex-shrink-0 md:mr-12">
        <div className="flex justify-between items-end mb-2.5">
          <span className="text-[11px] font-medium text-[#9aa3b2] opacity-32 uppercase tracking-widest">Progress</span>
          <span className="text-[14px] font-semibold text-white/90">{progress}%</span>
        </div>
        <div className="h-[2px] w-full bg-white/[0.04] rounded-full overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} className={`h-full bg-[#7c3aed]/40`} />
        </div>
      </div>

      {/* Right: Actions */}
      <div className="relative" ref={menuRef}>
        {!isSelectionMode && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowActions(!showActions);
            }}
            className={`p-2 rounded-lg transition-all ${showActions ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}
          >
            <MoreVertical size={20} />
          </button>
        )}

        <AnimatePresence>
          {showActions && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-full mt-2 w-56 bg-zinc-950/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_30px_70px_rgba(0,0,0,0.8)] z-[9999] overflow-hidden py-2"
            >
              <div className="px-3 py-2 border-b border-white/5 mb-1">
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Goal Actions</p>
              </div>
              <MenuButton icon={Play} label="Open Strategy" onClick={() => { setShowActions(false); onView(); }} />
              <MenuButton icon={Edit3} label="Edit Goal" onClick={() => {
                setShowActions(false);
                const newTitle = window.prompt('Rename goal:', goal.title);
                if (newTitle) onAction(goal.id, 'rename', newTitle);
              }} />
              <MenuButton icon={Copy} label="Duplicate" onClick={() => { setShowActions(false); onAction(goal.id, 'duplicate'); }} />
              <MenuButton icon={Pin} label={isPinned ? 'Unpin' : 'Pin Strategy'} onClick={() => { setShowActions(false); onAction(goal.id, 'pin', !isPinned); }} />
              <MenuButton icon={Archive} label={goal.is_archived ? 'Restore' : 'Archive'} onClick={() => { setShowActions(false); onAction(goal.id, 'archive', !goal.is_archived); }} />
              <div className="h-px bg-white/5 my-1 mx-2" />
              <MenuButton icon={Trash2} label="Delete Goal" variant="danger" onClick={() => { setShowActions(false); onDelete(); }} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function MenuButton({ icon: Icon, label, onClick, variant = 'default', iconClassName = '' }: any) {
  const styles = {
    default: 'text-zinc-300 hover:bg-white/5 hover:text-white',
    danger: 'text-rose-400 hover:bg-rose-500/10 hover:text-rose-300',
  };

  return (
    <button
      onClick={onClick}
      className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 transition-colors ${styles[variant as keyof typeof styles]}`}
    >
      <Icon size={16} className={iconClassName} />
      <span className="font-medium">{label}</span>
    </button>
  );
}
