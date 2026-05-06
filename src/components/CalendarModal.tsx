import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar as CalendarIcon, Clock, ChevronRight, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface CalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  primaryGoal: any;
}

export default function CalendarModal({ isOpen, onClose, primaryGoal }: CalendarModalProps) {
  const navigate = useNavigate();
  if (!isOpen) return null;

  const timetable = primaryGoal?.roadmap_json?.actionTable || [];
  const milestones = primaryGoal?.roadmap_json?.journeyPath || [];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-md"
        />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-2xl bg-zinc-900 border border-white/10 rounded-[40px] shadow-2xl overflow-hidden"
        >
          <div className="p-8 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-blue-600/10 to-transparent">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center">
                <CalendarIcon className="text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Execution Planner</h2>
                <p className="text-zinc-500 text-sm font-medium">Schedule for: {primaryGoal?.roadmap_json?.goalTitle || 'Primary Goal'}</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/5 rounded-full text-zinc-500 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
            {/* Today's Tasks */}
            <div className="space-y-6">
              <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                <Clock size={14} /> Today's Schedule
              </h3>
              <div className="space-y-3">
                {timetable.length > 0 ? timetable.map((task: any, i: number) => (
                  <div key={i} className="p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between group hover:bg-white/10 transition-colors">
                    <div>
                      <p className="text-white font-bold text-sm">{task.task}</p>
                      <p className="text-zinc-500 text-xs font-medium">{task.slot} • {task.duration}</p>
                    </div>
                    <ChevronRight size={16} className="text-zinc-700 group-hover:text-blue-500 transition-colors" />
                  </div>
                )) : (
                  <p className="text-zinc-600 text-sm italic">No tasks scheduled for today.</p>
                )}
              </div>
            </div>

            {/* Upcoming Milestones */}
            <div className="space-y-6">
              <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                <CalendarIcon size={14} /> Journey Milestones
              </h3>
              <div className="space-y-3">
                {milestones.length > 0 ? milestones.map((m: any, i: number) => (
                  <div key={i} className={`p-4 border rounded-2xl flex items-center gap-4 ${
                    m.completionState === 'completed' ? 'bg-emerald-500/10 border-emerald-500/20 opacity-50' :
                    m.completionState === 'active' ? 'bg-blue-600/10 border-blue-500/20' :
                    'bg-white/5 border-white/5'
                  }`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      m.completionState === 'completed' ? 'bg-emerald-500 text-white' :
                      m.completionState === 'active' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' :
                      'bg-zinc-800 text-zinc-600'
                    }`}>
                      <span className="text-xs font-bold">{i + 1}</span>
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm truncate max-w-[150px]">{m.title}</p>
                      <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">{m.duration}</p>
                    </div>
                  </div>
                )) : (
                  <p className="text-zinc-600 text-sm italic">No milestones defined.</p>
                )}
              </div>
            </div>
          </div>

          <div className="p-6 bg-white/[0.02] border-t border-white/5 flex justify-center">
            <button 
              onClick={() => {
                onClose();
                navigate(`/roadmap?id=${primaryGoal?.id}`);
              }}
              className="text-blue-400 hover:text-blue-300 text-sm font-bold flex items-center gap-2 transition-colors"
            >
              Go to Full Roadmap <ArrowRight size={16} />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
