import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface EvolvingDoodleProps {
  category: string;
  streak: number;
  status: 'pending' | 'completed' | 'missed';
  isMilestone?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}

const r = 'round' as const;

// Helper to determine stage (1-5)
const getStage = (streak: number): number => {
  if (streak === 1) return 1;
  if (streak >= 2 && streak <= 3) return 2;
  if (streak >= 4 && streak <= 6) return 3;
  if (streak >= 7 && streak <= 13) return 4;
  if (streak >= 14) return 5;
  return 1; // fallback or 0
};

// SVG paths for categories
const LearningPaths = ({ stage, f }: { stage: number, f: number }) => (
  <g fill="none" strokeLinecap={r} strokeLinejoin={r}>
    {stage === 1 && <circle cx="24" cy="36" r="4" fill="#a7f3d0" fillOpacity={f * 0.8} stroke="#047857" strokeWidth="1.5" />}
    {stage === 2 && <path d="M24 36 Q18 24 24 20 Q30 24 24 36" fill="#6ee7b7" fillOpacity={f * 0.8} stroke="#047857" strokeWidth="1.5" />}
    {stage === 3 && (
      <path d="M12 36 L12 24 L24 20 L36 24 L36 36 L24 40 Z" fill="#93c5fd" fillOpacity={f * 0.8} stroke="#1d4ed8" strokeWidth="1.5" />
    )}
    {stage === 4 && (
      <g stroke="#1d4ed8" strokeWidth="1.5">
        <rect x="12" y="28" width="24" height="8" fill="#bfdbfe" fillOpacity={f * 0.9} />
        <rect x="14" y="20" width="20" height="8" fill="#93c5fd" fillOpacity={f * 0.9} />
        <rect x="16" y="12" width="16" height="8" fill="#60a5fa" fillOpacity={f * 0.9} />
      </g>
    )}
    {stage === 5 && (
      <g stroke="#eab308" strokeWidth="1.5">
        <path d="M12 28 Q24 20 36 28 L36 36 Q24 28 12 36 Z" fill="#fef08a" fillOpacity={f * 0.9} />
        <circle cx="24" cy="14" r="8" fill="#fde047" fillOpacity={f * 0.9} />
        <line x1="24" y1="2" x2="24" y2="4" />
        <line x1="16" y1="6" x2="18" y2="8" />
        <line x1="32" y1="6" x2="30" y2="8" />
      </g>
    )}
  </g>
);

const HealthPaths = ({ stage, f }: { stage: number, f: number }) => (
  <g fill="none" strokeLinecap={r} strokeLinejoin={r} stroke="#16a34a" strokeWidth="1.5">
    {stage === 1 && <circle cx="24" cy="38" r="3" fill="#bbf7d0" fillOpacity={f} />}
    {stage === 2 && <path d="M24 38 Q18 30 20 24 Q28 26 24 38" fill="#86efac" fillOpacity={f} />}
    {stage === 3 && (
      <>
        <line x1="24" y1="38" x2="24" y2="16" />
        <path d="M24 30 Q16 26 18 20 Q24 24 24 30" fill="#4ade80" fillOpacity={f} />
      </>
    )}
    {stage === 4 && (
      <>
        <line x1="24" y1="38" x2="24" y2="12" />
        <path d="M24 30 Q16 26 18 20 Q24 24 24 30" fill="#4ade80" fillOpacity={f} />
        <path d="M24 22 Q32 18 30 12 Q24 16 24 22" fill="#22c55e" fillOpacity={f} />
      </>
    )}
    {stage === 5 && (
      <>
        <line x1="24" y1="38" x2="24" y2="24" />
        <circle cx="24" cy="20" r="10" fill="#fbcfe8" fillOpacity={f} stroke="#db2777" />
        <circle cx="24" cy="20" r="4" fill="#fcd34d" fillOpacity={f} stroke="#d97706" />
      </>
    )}
  </g>
);

const FitnessPaths = ({ stage, f }: { stage: number, f: number }) => (
  <g fill="none" strokeLinecap={r} strokeLinejoin={r}>
    {stage === 1 && <path d="M16 34 Q24 26 32 34 L16 34 Z" fill="#d6d3d1" fillOpacity={f} stroke="#78716c" strokeWidth="1.5" />}
    {stage === 2 && <path d="M12 32 C12 24 36 24 36 32 L36 36 L12 36 Z" fill="#fb7185" fillOpacity={f} stroke="#e11d48" strokeWidth="1.5" />}
    {stage === 3 && (
      <g stroke="#0369a1" strokeWidth="1.5" fill="#38bdf8" fillOpacity={f}>
        <rect x="8" y="20" width="8" height="12" rx="2" />
        <rect x="32" y="20" width="8" height="12" rx="2" />
        <line x1="16" y1="26" x2="32" y2="26" strokeWidth="2" />
      </g>
    )}
    {stage === 4 && <path d="M24 36 Q16 26 24 12 Q32 26 24 36" fill="#fb923c" fillOpacity={f} stroke="#c2410c" strokeWidth="1.5" />}
    {stage === 5 && (
      <g stroke="#b45309" strokeWidth="1.5" fill="#fde047" fillOpacity={f}>
        <path d="M16 16 L32 16 L28 28 L20 28 Z" />
        <path d="M16 16 Q10 16 12 22 Q16 22 18 20" />
        <path d="M32 16 Q38 16 36 22 Q32 22 30 20" />
        <rect x="22" y="28" width="4" height="8" />
        <line x1="18" y1="36" x2="30" y2="36" strokeWidth="2" />
      </g>
    )}
  </g>
);

const CareerPaths = ({ stage, f }: { stage: number, f: number }) => (
  <g fill="none" strokeLinecap={r} strokeLinejoin={r}>
    {stage === 1 && <circle cx="24" cy="24" r="4" fill="#94a3b8" fillOpacity={f} stroke="#475569" strokeWidth="1.5" />}
    {stage === 2 && (
      <g stroke="#475569" strokeWidth="1.5" fill="#cbd5e1" fillOpacity={f}>
        <circle cx="24" cy="24" r="8" />
        <circle cx="24" cy="24" r="3" fill="#fff" />
      </g>
    )}
    {stage === 3 && (
      <g stroke="#334155" strokeWidth="1.5" fill="#e2e8f0" fillOpacity={f}>
        <rect x="12" y="16" width="24" height="14" rx="2" />
        <path d="M8 32 L40 32" strokeWidth="2" />
      </g>
    )}
    {stage === 4 && (
      <g stroke="#1d4ed8" strokeWidth="1.5" fill="#60a5fa" fillOpacity={f}>
        <path d="M24 8 Q16 16 20 32 L28 32 Q32 16 24 8" />
        <path d="M20 32 L24 40 L28 32" fill="#ef4444" stroke="#b91c1c" />
      </g>
    )}
    {stage === 5 && (
      <g stroke="#7c3aed" strokeWidth="1.5" fill="#a78bfa" fillOpacity={f}>
        <path d="M24 4 Q12 16 18 36 L30 36 Q36 16 24 4" />
        <path d="M18 36 L24 44 L30 36" fill="#f59e0b" stroke="#d97706" />
        <circle cx="12" cy="12" r="1.5" fill="#fde047" stroke="none" />
        <circle cx="36" cy="18" r="2" fill="#fde047" stroke="none" />
      </g>
    )}
  </g>
);

const CreativityPaths = ({ stage, f }: { stage: number, f: number }) => (
  <g fill="none" strokeLinecap={r} strokeLinejoin={r}>
    {stage === 1 && <path d="M22 22 L26 26" stroke="#db2777" strokeWidth="3" />}
    {stage === 2 && (
      <g stroke="#be185d" strokeWidth="1.5" fill="#fbcfe8" fillOpacity={f}>
        <path d="M16 32 L32 16" strokeWidth="2" />
        <path d="M32 16 Q36 12 36 12 Q36 16 32 16" fill="#fb7185" />
      </g>
    )}
    {stage === 3 && (
      <g stroke="#9333ea" strokeWidth="1.5" fill="#d8b4fe" fillOpacity={f}>
        <ellipse cx="24" cy="24" rx="14" ry="10" />
        <circle cx="16" cy="24" r="2" fill="#fff" />
        <circle cx="28" cy="20" r="2" fill="#f43f5e" />
        <circle cx="30" cy="28" r="2" fill="#3b82f6" />
      </g>
    )}
    {stage === 4 && (
      <g stroke="#1e40af" strokeWidth="1.5" fill="#bfdbfe" fillOpacity={f}>
        <rect x="12" y="12" width="24" height="24" rx="1" />
        <path d="M16 16 L24 24 L20 30" stroke="#db2777" strokeWidth="2" fill="none" />
      </g>
    )}
    {stage === 5 && (
      <g stroke="#b45309" strokeWidth="1.5" fill="#fef3c7" fillOpacity={f}>
        <rect x="8" y="10" width="32" height="28" rx="2" />
        <rect x="12" y="14" width="24" height="20" fill="#fca5a5" />
        <path d="M12 28 Q24 20 36 24" stroke="#047857" strokeWidth="2" fill="none" />
        <circle cx="18" cy="20" r="3" fill="#fde047" stroke="none" />
      </g>
    )}
  </g>
);

const ReflectionPaths = ({ stage, f }: { stage: number, f: number }) => (
  <g fill="none" strokeLinecap={r} strokeLinejoin={r}>
    {stage === 1 && <circle cx="24" cy="24" r="4" fill="#c4b5fd" fillOpacity={f} stroke="#6d28d9" strokeWidth="1.5" />}
    {stage === 2 && (
      <path d="M24 32 Q16 20 24 16 Q32 20 24 32" fill="#a78bfa" fillOpacity={f} stroke="#6d28d9" strokeWidth="1.5" />
    )}
    {stage === 3 && (
      <path d="M28 12 Q12 16 16 32 Q20 36 28 32 Q24 24 28 12" fill="#ede9fe" fillOpacity={f} stroke="#4f46e5" strokeWidth="1.5" />
    )}
    {stage === 4 && (
      <g stroke="#c026d3" strokeWidth="1.5" fill="#f0abfc" fillOpacity={f}>
        <path d="M24 24 Q12 16 16 32 Q20 32 24 24" />
        <path d="M24 24 Q36 16 32 32 Q28 32 24 24" />
      </g>
    )}
    {stage === 5 && (
      <g stroke="#9333ea" strokeWidth="1.5" fill="#d8b4fe" fillOpacity={f}>
        <path d="M24 24 Q6 10 12 36 Q20 36 24 24" />
        <path d="M24 24 Q42 10 36 36 Q28 36 24 24" />
        <circle cx="18" cy="24" r="2" fill="#fdf4ff" />
        <circle cx="30" cy="24" r="2" fill="#fdf4ff" />
      </g>
    )}
  </g>
);

const FinancePaths = ({ stage, f }: { stage: number, f: number }) => (
  <g fill="none" strokeLinecap={r} strokeLinejoin={r}>
    {stage === 1 && <circle cx="24" cy="24" r="6" fill="#fde047" fillOpacity={f} stroke="#b45309" strokeWidth="1.5" />}
    {stage === 2 && (
      <g stroke="#b45309" strokeWidth="1.5" fill="#fde047" fillOpacity={f}>
        <circle cx="20" cy="26" r="6" />
        <circle cx="28" cy="22" r="6" />
        <circle cx="24" cy="30" r="6" />
      </g>
    )}
    {stage === 3 && (
      <g stroke="#047857" strokeWidth="1.5" fill="#6ee7b7" fillOpacity={f}>
        <path d="M16 16 L32 16 L36 36 L12 36 Z" />
        <path d="M20 16 Q24 8 28 16" />
      </g>
    )}
    {stage === 4 && (
      <g stroke="#be185d" strokeWidth="1.5" fill="#fbcfe8" fillOpacity={f}>
        <ellipse cx="24" cy="26" rx="14" ry="10" />
        <path d="M28 16 L28 12 L20 12 L20 16" />
        <line x1="26" y1="26" x2="28" y2="26" />
      </g>
    )}
    {stage === 5 && (
      <g stroke="#92400e" strokeWidth="1.5" fill="#fcd34d" fillOpacity={f}>
        <path d="M12 24 Q24 16 36 24 L36 36 L12 36 Z" />
        <rect x="12" y="24" width="24" height="4" fill="#fbbf24" />
        <rect x="22" y="22" width="4" height="6" fill="#f59e0b" />
        <circle cx="18" cy="18" r="2" fill="#fef08a" stroke="none" />
        <circle cx="24" cy="14" r="2" fill="#fef08a" stroke="none" />
        <circle cx="30" cy="18" r="2" fill="#fef08a" stroke="none" />
      </g>
    )}
  </g>
);

const DoodleSvg = ({ category, stage, fillFactor }: { category: string, stage: number, fillFactor: number }) => {
  const cat = category?.toLowerCase() || '';
  if (cat.includes('health') || cat.includes('plant')) return <HealthPaths stage={stage} f={fillFactor} />;
  if (cat.includes('fitness') || cat.includes('gym') || cat.includes('workout')) return <FitnessPaths stage={stage} f={fillFactor} />;
  if (cat.includes('career') || cat.includes('work') || cat.includes('business')) return <CareerPaths stage={stage} f={fillFactor} />;
  if (cat.includes('creative') || cat.includes('art') || cat.includes('draw')) return <CreativityPaths stage={stage} f={fillFactor} />;
  if (cat.includes('reflect') || cat.includes('journal') || cat.includes('mind')) return <ReflectionPaths stage={stage} f={fillFactor} />;
  if (cat.includes('finance') || cat.includes('money') || cat.includes('budget')) return <FinancePaths stage={stage} f={fillFactor} />;
  // Default to Learning
  return <LearningPaths stage={stage} f={fillFactor} />;
};

export const EvolvingDoodle: React.FC<EvolvingDoodleProps> = ({ category, streak, status, isMilestone, onClick }) => {
  const stage = status === 'missed' ? 1 : getStage(streak || (status === 'completed' ? 1 : 0));
  
  // Visual states
  const isPending = status === 'pending';
  const isCompleted = status === 'completed';
  const isMissed = status === 'missed';
  
  const fillFactor = isPending ? 0.2 : (isMissed ? 0.1 : 0.9);

  // Randomness for handmade feel
  const randOffset = useMemo(() => (Math.random() - 0.5) * 4, []);
  const randRotate = useMemo(() => (Math.random() - 0.5) * 10, []);

  // Idle animation
  const idleAnim = isCompleted ? {
    scale: [1, 1.05, 1],
    rotate: [randRotate, randRotate + 3, randRotate],
    transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' }
  } : {
    rotate: randRotate
  };

  // Droop animation for missed
  const missedAnim = isMissed ? {
    y: 4,
    opacity: 0.5,
    filter: 'saturate(0)',
    rotate: randRotate - 15,
  } : {};

  return (
    <div className="relative w-full h-full flex items-center justify-center" onClick={onClick}>
      {/* Milestone Glow Aura */}
      <AnimatePresence>
        {isMilestone && isCompleted && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1.4, opacity: [0, 0.4, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-0 rounded-full bg-amber-400 blur-md pointer-events-none"
          />
        )}
      </AnimatePresence>
      
      {/* Main SVG Container */}
      <motion.svg
        viewBox="0 0 48 48"
        className="w-full h-full overflow-visible"
        initial={false}
        animate={{ ...(idleAnim as any), ...(missedAnim as any), x: randOffset }}
        style={{
          filter: isPending ? 'grayscale(0.5)' : 'none'
        }}
      >
        {/* Subtle watercolor shadow */}
        <ellipse cx="24" cy="42" rx="12" ry="3" fill="rgba(0,0,0,0.06)" />
        
        {/* The Doodle */}
        <motion.g
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          key={stage} // forces re-render/morph when stage changes
        >
          <DoodleSvg category={category} stage={stage} fillFactor={fillFactor} />
        </motion.g>

        {/* Milestone Sparkle Overlay */}
        {isMilestone && isCompleted && (
          <motion.path
            d="M 38 10 L 40 14 L 44 16 L 40 18 L 38 22 L 36 18 L 32 16 L 36 14 Z"
            fill="#fef08a"
            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5], rotate: [0, 45, 90] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
      </motion.svg>
    </div>
  );
};

export default EvolvingDoodle;
