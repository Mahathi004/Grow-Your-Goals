import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Toast from '../components/Toast';

import { 
  IdentitySection, 
  ProductivitySection, 
  SecuritySection, 
  ConnectionsSection, 
  AchievementsSection, 
  DangerZoneSection 
} from './settings/Sections';

export const SettingsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [toasts, setToasts] = useState<any[]>([]);

  const addToast = (type: 'success' | 'error', message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, type, message }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter((t: any) => t.id !== id));
  };

  const initialIdentityData = {
    // @ts-ignore
    fullName: user?.name || '',
    // @ts-ignore
    username: user?.username || '',
    email: user?.email || '',
    phone: '',
    bio: '',
    avatarUrl: ''
  };

  const initialProductivityData = {
    workTime: 'Morning',
    style: 'deep_work',
    interests: ['Fitness', 'Learning'],
    aiPersonalization: true
  };

  return (
    <div className="flex-1 min-h-screen overflow-y-auto custom-scrollbar relative z-10 w-full">
      {/* Background Ambient */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[40%] h-[40%] bg-blue-600/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-0 left-0 w-[40%] h-[40%] bg-indigo-600/5 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 w-full max-w-4xl mx-auto px-6 py-12 flex flex-col gap-10">
        
        {/* Compact Header */}
        <header className="flex flex-col gap-6">
          <button 
            onClick={() => navigate('/dashboard')} 
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">Profile Settings</h1>
            <p className="text-sm text-zinc-500 mt-1 font-medium">Manage your personal information, preferences, and security</p>
          </div>
        </header>

        {/* Staggered Sections */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ staggerChildren: 0.1 }}
          className="flex flex-col gap-8"
        >
          <motion.div variants={{ initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } }}>
            <IdentitySection initialData={initialIdentityData} addToast={addToast} />
          </motion.div>

          <motion.div variants={{ initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } }}>
            <AchievementsSection />
          </motion.div>

          <motion.div variants={{ initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } }}>
            <ProductivitySection initialData={initialProductivityData} addToast={addToast} />
          </motion.div>

          <motion.div variants={{ initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } }}>
            <SecuritySection addToast={addToast} />
          </motion.div>

          <motion.div variants={{ initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } }}>
            <ConnectionsSection addToast={addToast} />
          </motion.div>

          <motion.div variants={{ initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } }}>
            <DangerZoneSection addToast={addToast} />
          </motion.div>
        </motion.div>

        {/* Footer */}
        <div className="text-center pt-8 pb-12">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600">Grow Your Goals</p>
          <p className="text-xs text-zinc-700 mt-1">Version 1.2.4 (Premium)</p>
        </div>

      </div>

      <Toast toasts={toasts} removeToast={removeToast} />
    </div>
  );
};

export default SettingsPage;
