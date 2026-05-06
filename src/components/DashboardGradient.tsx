import React from 'react';
import { motion } from 'framer-motion';

const DashboardGradient: React.FC = () => {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.2, ease: "easeInOut" }}
      className="fixed inset-0 pointer-events-none z-0 bg-[#020205] overflow-hidden"
    >
      {/* Restored Blue/Dark Gradient */}
      <div 
        className="absolute inset-0 opacity-40 blur-[100px]" 
        style={{ 
          background: 'linear-gradient(135deg, #0F2A5F 0%, #2F6BFF 35%, #6FA8FF 60%, #FFD166 100%)',
        }} 
      />

      {/* Deep Glow - Royal Blue */}
      <div 
        className="absolute -top-[20%] -left-[10%] w-[80%] h-[80%] rounded-full bg-blue-900/40 blur-[150px] animate-pulse"
        style={{ animationDuration: '8s' }}
      />

      {/* Soft Glow - Golden Yellow at bottom */}
      <div 
        className="absolute -bottom-[20%] -right-[10%] w-[70%] h-[70%] rounded-full bg-amber-500/10 blur-[150px] animate-pulse"
        style={{ animationDuration: '10s' }}
      />

      {/* Center Dark Vignette */}
      <div className="absolute inset-0 bg-radial-gradient from-transparent via-black/20 to-black/60 pointer-events-none" />

      {/* Subtle Noise Texture */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
    </motion.div>
  );
};

export default DashboardGradient;

