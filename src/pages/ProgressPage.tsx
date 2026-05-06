import { motion } from 'framer-motion';

/**
 * ProgressPage
 * A premium placeholder page for future analytics features.
 */
export const ProgressPage = () => {
  return (
    <div className="flex-1 min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-[#05060a]">
      {/* Ambient background glows for cinematic depth */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-600/[0.03] blur-[140px] rounded-full pointer-events-none" />
      <div className="absolute top-1/3 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-600/[0.02] blur-[120px] rounded-full pointer-events-none" />

      <div className="relative z-10 max-w-2xl w-full flex flex-col items-center text-center">
        
        {/* Animated Centerpiece: Premium Glass Orb / Analytics Visualization */}
        <div className="relative mb-14">
          {/* External ambient glow */}
          <motion.div
            animate={{ 
              scale: [1, 1.1, 1],
              opacity: [0.2, 0.4, 0.2],
            }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="w-72 h-72 rounded-full bg-blue-500/10 blur-3xl absolute inset-0 -translate-x-4 -translate-y-4"
          />
          
          {/* The Glass Orb */}
          <motion.div
            animate={{ y: [0, -12, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
            className="w-64 h-64 rounded-full border border-white/[0.08] bg-white/[0.01] backdrop-blur-[20px] relative flex items-center justify-center shadow-[inset_0_2px_10px_rgba(255,255,255,0.02),0_15px_45px_rgba(0,0,0,0.5)] overflow-hidden"
          >
            {/* Dynamic internal lines representing data/connectivity */}
            <div className="absolute inset-0 opacity-[0.08]">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                <motion.circle 
                  cx="50" cy="50" r="35" 
                  stroke="white" strokeWidth="0.2" fill="none" 
                  initial={{ pathLength: 0, rotate: 0 }} 
                  animate={{ pathLength: [0, 1, 0], rotate: 360 }} 
                  transition={{ duration: 10, repeat: Infinity, ease: "linear" }} 
                />
                <motion.circle 
                  cx="50" cy="50" r="25" 
                  stroke="white" strokeWidth="0.15" fill="none" 
                  initial={{ pathLength: 0, rotate: 180 }} 
                  animate={{ pathLength: [0, 1, 0], rotate: -180 }} 
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }} 
                />
                <line x1="0" y1="50" x2="100" y2="50" stroke="white" strokeWidth="0.1" />
                <line x1="50" y1="0" x2="50" y2="100" stroke="white" strokeWidth="0.1" />
              </svg>
            </div>
            
            {/* Core Pulse */}
            <motion.div 
              animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 4, repeat: Infinity }}
              className="w-12 h-12 rounded-full bg-blue-500/20 blur-xl" 
            />
          </motion.div>
        </div>

        {/* Content Section */}
        <div className="space-y-8">
          <div className="flex flex-col items-center gap-5">
            <span className="text-[11px] font-black text-blue-500/50 uppercase tracking-[0.5em] ml-[0.5em]">
              Performance Analytics
            </span>
            <span className="px-3.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-[10px] font-bold text-zinc-500 uppercase tracking-widest shadow-sm">
              Coming Soon
            </span>
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-[1.1]">
              Building something <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-white/40">insightful.</span>
            </h1>

            <p className="text-[#9aa3b2] text-lg max-w-lg mx-auto font-medium leading-relaxed opacity-70">
              Deep progress intelligence, streak analytics, consistency mapping, and personal performance insights are being crafted.
            </p>
          </div>

          <div className="pt-10 flex flex-col items-center">
            <div className="w-12 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-8" />
            <p className="text-zinc-600 text-[11px] font-medium uppercase tracking-[0.1em] max-w-[280px]">
              This space will soon transform your daily actions into meaningful long-term insight.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
