import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { useEffect } from 'react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error';
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
}

export default function Toast({ toasts, removeToast }: ToastProps) {
  return (
    <div className="fixed bottom-8 right-8 z-[200] flex flex-col gap-3 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({ toast, onRemove }: { toast: ToastMessage; onRemove: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onRemove, 5000);
    return () => clearTimeout(timer);
  }, [onRemove]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 20, scale: 0.9 }}
      className="pointer-events-auto flex items-center gap-4 bg-zinc-900/90 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl min-w-[300px]"
    >
      <div className={`${toast.type === 'success' ? 'text-emerald-500' : 'text-rose-500'}`}>
        {toast.type === 'success' ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
      </div>
      <p className="flex-1 text-sm font-medium text-white">{toast.message}</p>
      <button onClick={onRemove} className="p-1 text-zinc-500 hover:text-white transition-colors">
        <X size={16} />
      </button>
    </motion.div>
  );
}
