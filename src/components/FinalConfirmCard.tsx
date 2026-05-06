import { motion } from 'framer-motion';
import { Target, Calendar, ShieldAlert, Clock, ArrowRight } from 'lucide-react';

interface FinalConfirmCardProps {
  onConfirm: () => void;
  onEdit: () => void;
}

export default function FinalConfirmCard({ onConfirm, onEdit }: FinalConfirmCardProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-zinc-800/80 border border-white/10 rounded-3xl p-6 shadow-2xl max-w-md w-full mx-auto my-6"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-xl">
          <Target size={20} />
        </div>
        <div>
          <h3 className="text-white font-bold text-lg leading-tight">Review Your Plan</h3>
          <p className="text-zinc-400 text-sm">Almost ready to generate your roadmap.</p>
        </div>
      </div>

      <div className="space-y-4 mb-8">
        <div className="flex items-start gap-3 text-sm">
          <Calendar size={16} className="text-zinc-500 mt-0.5" />
          <div>
            <span className="text-zinc-500 block font-medium">Timeline</span>
            <span className="text-zinc-200">Set based on your input</span>
          </div>
        </div>
        
        <div className="flex items-start gap-3 text-sm">
          <ShieldAlert size={16} className="text-orange-500 mt-0.5" />
          <div>
            <span className="text-zinc-500 block font-medium">Primary Blocker</span>
            <span className="text-zinc-200">Identified & addressed</span>
          </div>
        </div>

        <div className="flex items-start gap-3 text-sm">
          <Clock size={16} className="text-emerald-500 mt-0.5" />
          <div>
            <span className="text-zinc-500 block font-medium">Daily Commitment</span>
            <span className="text-zinc-200">Scheduled in roadmap</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button 
          onClick={onEdit}
          className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-semibold transition-colors"
        >
          Edit Details
        </button>
        <button 
          onClick={onConfirm}
          className="flex-[2] py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all"
        >
          Confirm & Generate <ArrowRight size={16} />
        </button>
      </div>
    </motion.div>
  );
}
