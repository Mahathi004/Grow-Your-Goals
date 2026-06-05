import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';

export default function Hero() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const handleBegin = () => {
    if (isAuthenticated) navigate('/dashboard');
    else navigate('/auth');
  };

  return (
    <div className="relative z-10 flex flex-col items-center justify-center text-center px-6 pt-40 pb-48 w-full max-w-7xl mx-auto flex-1 h-full">
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="text-4xl sm:text-5xl md:text-6xl lg:text-6xl tracking-tight leading-tight max-w-6xl font-medium text-white drop-shadow-lg"
      >
        Turn Your Goals Into Measurable Progress
      </motion.h1>
      
      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
        className="text-zinc-300/80 text-base sm:text-lg max-w-3xl mt-6 leading-relaxed font-normal px-4"
      >
        An AI-powered system that breaks your goals into actionable steps, tracks your{' '}
        <br className="hidden sm:block" />
        consistency, and predicts your success before you fall behind.
      </motion.p>
      
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.24, ease: [0.22, 1, 0.36, 1] }}
        className="mt-12"
      >
        <motion.button
          onClick={handleBegin}
          whileHover={{ scale: 1.03, backgroundColor: 'rgba(255,255,255,0.08)' }}
          whileTap={{ scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          className="bg-[#050505]/40 backdrop-blur-sm border border-white/10 rounded-full px-14 py-4 text-[15px] tracking-wide text-white transition-colors font-medium shadow-2xl"
        >
          Begin Journey
        </motion.button>
      </motion.div>
    </div>
  );
}
