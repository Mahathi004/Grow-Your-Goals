import { useEffect, useRef, useState, useCallback } from 'react';
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  animate,
  AnimatePresence,
} from 'framer-motion';
import { Check, Lock, Trophy, Zap, ArrowRight } from 'lucide-react';
import confetti from 'canvas-confetti';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Node {
  title: string;
  description?: string;
  details?: string;
  duration?: string;
  reward?: string;
}

interface Task {
  id: string;
  status: string;
}

interface Props {
  nodes: Node[];
  tasks: Task[];
  handleTaskStatusChange?: (taskId: string | undefined, newStatus: string) => Promise<void>;
  addToast?: (type: 'success' | 'error', message: string) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SVG_W = 680;
const STEP = 220;          // vertical distance between nodes
const SWING = 190;         // horizontal amplitude of the S-curve
const PATH_W = 3;          // base path stroke (the glowing line itself is thin & bright)
const CARD_W = 200;

// ─── Path builder ────────────────────────────────────────────────────────────

function buildPath(nodeCount: number) {
  const cx = SVG_W / 2;
  const points: { x: number; y: number }[] = [];

  // Start node
  points.push({ x: cx, y: STEP / 2 });
  // Journey nodes
  for (let i = 0; i < nodeCount; i++) {
    points.push({ x: cx, y: (i + 1) * STEP + STEP / 2 });
  }
  // Goal
  points.push({ x: cx, y: (nodeCount + 1) * STEP + STEP / 2 });

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const midY = (p0.y + p1.y) / 2;
    const side = i % 2 === 0 ? SWING : -SWING;
    d += ` C ${p0.x + side} ${midY} ${p1.x + side} ${midY} ${p1.x} ${p1.y}`;
  }

  return { d, points };
}

// ─── Geometry ─────────────────────────────────────────────────────────────────

function distForY(path: SVGPathElement, targetY: number, len: number) {
  let lo = 0, hi = len;
  for (let i = 0; i < 64; i++) {
    const mid = (lo + hi) / 2;
    (path.getPointAtLength(mid).y < targetY ? (lo = mid) : (hi = mid));
  }
  return (lo + hi) / 2;
}

function tangentDeg(path: SVGPathElement, d: number, len: number) {
  const e = Math.min(1.5, len * 0.001);
  const p1 = path.getPointAtLength(Math.max(0, d - e));
  const p2 = path.getPointAtLength(Math.min(len, d + e));
  return Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);
}

// ─── Premium Gem Orb ─────────────────────────────────────────────────────────

function GemOrb({ angle }: { angle: number }) {
  return (
    <div
      style={{
        width: 28,
        height: 28,
        transform: `rotate(${angle - 90}deg)`,
        transition: 'transform 0.08s linear',
      }}
    >
      <svg viewBox="0 0 28 28" fill="none">
        <defs>
          <radialGradient id="gemGrad" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#a5f3fc" />
            <stop offset="40%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#0284c7" />
          </radialGradient>
          <filter id="gemGlow">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {/* outer ring */}
        <circle cx="14" cy="14" r="13" fill="url(#gemGrad)" filter="url(#gemGlow)" opacity="0.15" />
        {/* gem body */}
        <circle cx="14" cy="14" r="9" fill="url(#gemGrad)" filter="url(#gemGlow)" />
        {/* specular highlight */}
        <ellipse cx="11" cy="10" rx="3.5" ry="2.2" fill="white" opacity="0.55" transform="rotate(-20 11 10)" />
        {/* small inner spark */}
        <circle cx="14" cy="14" r="2.5" fill="white" opacity="0.35" />
        {/* forward arrow indicator */}
        <path d="M 14 8 L 18 14 L 14 20 L 10 14 Z" fill="white" opacity="0.12" />
      </svg>
    </div>
  );
}

// ─── Phase number badge ──────────────────────────────────────────────────────

function PhaseBadge({ n, state }: { n: number; state: 'done' | 'active' | 'locked' }) {
  const ring =
    state === 'done'
      ? 'border-emerald-500/50 bg-emerald-500/10'
      : state === 'active'
      ? 'border-blue-400/60 bg-blue-500/10 shadow-[0_0_14px_rgba(59,130,246,0.35)]'
      : 'border-white/8 bg-white/3';
  const text =
    state === 'done' ? 'text-emerald-400' : state === 'active' ? 'text-blue-300' : 'text-zinc-600';

  return (
    <div className={`w-9 h-9 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${ring}`}>
      {state === 'done' ? (
        <Check size={14} className="text-emerald-400" strokeWidth={2.5} />
      ) : state === 'locked' ? (
        <Lock size={12} className="text-zinc-600" />
      ) : (
        <span className={`text-xs font-black ${text}`}>{n}</span>
      )}
    </div>
  );
}

// ─── Node Card ────────────────────────────────────────────────────────────────

function NodeCard({
  node,
  index,
  state,
  isChecked,
  isAnimating,
  scaleCardIdx,
  pulsingIdx,
  onComplete,
}: {
  node: Node;
  index: number;
  state: 'done' | 'active' | 'locked';
  isChecked: boolean;
  isAnimating: boolean;
  scaleCardIdx: number | null;
  pulsingIdx: number | null;
  onComplete: () => void;
}) {
  const isDone = state === 'done';
  const isActive = state === 'active';
  const isLocked = state === 'locked';

  return (
    <motion.div
      animate={scaleCardIdx === index ? { scale: [1, 1.03, 1] } : {}}
      transition={{ duration: 0.35 }}
      className={`relative rounded-2xl border p-4 backdrop-blur-xl transition-all duration-500 ${
        isDone
          ? 'bg-emerald-950/40 border-emerald-500/20'
          : isActive
          ? 'bg-slate-900/70 border-blue-500/25 shadow-[0_0_30px_rgba(59,130,246,0.1),inset_0_1px_0_rgba(255,255,255,0.06)]'
          : 'bg-zinc-950/50 border-white/[0.06]'
      }`}
      style={{ opacity: isLocked ? 0.38 : 1 }}
    >
      {/* Top accent line for active */}
      {isActive && (
        <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-blue-400/60 to-transparent rounded-full" />
      )}

      <div className="flex items-start gap-3">
        <PhaseBadge
          n={index + 1}
          state={
            pulsingIdx === index
              ? 'active'
              : isDone
              ? 'done'
              : isActive
              ? 'active'
              : 'locked'
          }
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4
              className={`font-semibold text-sm leading-snug ${
                isDone ? 'text-zinc-400 line-through decoration-emerald-500/40' : isActive ? 'text-white' : 'text-zinc-500'
              }`}
            >
              {node.title}
            </h4>

            {/* Action button */}
            {isActive && (
              <button
                onClick={onComplete}
                disabled={isAnimating}
                className={`flex-shrink-0 h-6 px-2.5 rounded-lg text-[10px] font-bold tracking-wide flex items-center gap-1 transition-all ${
                  isChecked
                    ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
                    : 'bg-blue-600/20 border border-blue-500/30 text-blue-300 hover:bg-blue-600/30 hover:border-blue-400/50 hover:shadow-[0_0_10px_rgba(59,130,246,0.2)]'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isChecked ? (
                  <><Check size={9} strokeWidth={3} /> Done</>
                ) : (
                  <>Mark done <ArrowRight size={9} /></>
                )}
              </button>
            )}
          </div>

          {(node.description || node.details) && (
            <p className="text-[11px] text-zinc-500 leading-relaxed line-clamp-2">
              {node.description || node.details}
            </p>
          )}

          {(node.duration || node.reward) && (
            <div className="flex items-center gap-3 mt-2 pt-2 border-t border-white/[0.04]">
              {node.duration && (
                <span className="text-[10px] text-zinc-600 font-medium">{node.duration}</span>
              )}
              {node.reward && (
                <span className="text-[10px] text-amber-500/70 font-medium">+{node.reward}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function WindingRoadMap({ nodes, tasks, handleTaskStatusChange, addToast }: Props) {
  if (!nodes || nodes.length === 0) {
    return (
      <div className="text-center text-zinc-600 p-20 bg-zinc-950/40 rounded-[40px] border border-white/5 text-sm font-medium">
        No journey path data — generate a roadmap to continue.
      </div>
    );
  }

  const totalNodes = nodes.length;
  const svgH = (totalNodes + 2) * STEP;
  const { d: pathD, points } = buildPath(totalNodes);

  // ── DB-driven completion index ──
  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const dbCompletedIdx = Math.floor((completedCount / Math.max(tasks.length, 1)) * totalNodes) - 1;

  // ── Local state ──
  const [localCompletedIdx, setLocalCompletedIdx] = useState(-1);
  const [isAnimating, setIsAnimating] = useState(false);
  const [activeCheckIdx, setActiveCheckIdx] = useState<number | null>(null);
  const [scaleCardIdx, setScaleCardIdx] = useState<number | null>(null);
  const [revealedIdx, setRevealedIdx] = useState<number | null>(null);
  const [pulsingIdx, setPulsingIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!isAnimating) setLocalCompletedIdx(dbCompletedIdx);
  }, [dbCompletedIdx, isAnimating]);

  // ── SVG geometry ──
  const pathRef = useRef<SVGPathElement>(null);
  const [totalLen, setTotalLen] = useState(0);
  const [nodeDists, setNodeDists] = useState<number[]>([]);

  useEffect(() => {
    if (!pathRef.current) return;
    const len = pathRef.current.getTotalLength();
    setTotalLen(len);
    const dists = points.map((p) => distForY(pathRef.current!, p.y, len));
    setNodeDists(dists);
  }, [nodes]);

  // ── Orb position (spring) ──
  const orbDist = useSpring(0, { stiffness: 55, damping: 16 });
  const orbX = useMotionValue(SVG_W / 2);
  const orbY = useMotionValue(points[0]?.y ?? 0);
  const [orbAngle, setOrbAngle] = useState(90);

  const targetDistIdx = Math.min(localCompletedIdx + 2, nodeDists.length - 1); // +2: skip start
  const targetDist = nodeDists[targetDistIdx] ?? 0;

  useEffect(() => {
    if (totalLen > 0 && nodeDists.length > 0) orbDist.set(targetDist);
  }, [targetDist, totalLen]);

  useEffect(() => {
    return orbDist.on('change', (d) => {
      if (!pathRef.current || totalLen === 0) return;
      try {
        const pt = pathRef.current.getPointAtLength(d);
        orbX.set(pt.x);
        orbY.set(pt.y);
        setOrbAngle(tangentDeg(pathRef.current, d, totalLen));
      } catch (_) {}
    });
  }, [orbDist, totalLen]);

  // ── Glow pulse ──
  const glowS = useMotionValue(0);
  const glowE = useMotionValue(0);
  const glowLen = useTransform([glowS, glowE], ([s, e]) => Math.max(0, Number(e) - Number(s)));

  // ── Confetti ──
  const fireConfetti = useCallback((x: number, y: number) => {
    const svgEl = pathRef.current?.closest('svg');
    if (!svgEl) return;
    const r = svgEl.getBoundingClientRect();
    confetti({
      particleCount: 90,
      spread: 65,
      origin: { x: (r.left + x) / window.innerWidth, y: (r.top + y) / window.innerHeight },
      colors: ['#38bdf8', '#818cf8', '#34d399', '#fbbf24', '#f472b6'],
      ticks: 200,
    });
  }, []);

  // ── Persist ──
  const persist = async (nodeIdx: number): Promise<boolean> => {
    const s = Math.floor(nodeIdx * tasks.length / totalNodes);
    const e = Math.floor((nodeIdx + 1) * tasks.length / totalNodes);
    const pending = tasks.slice(s, e).filter((t) => t.status !== 'completed');
    if (!pending.length) return true;
    try {
      if (handleTaskStatusChange) {
        await Promise.all(pending.map((t) => handleTaskStatusChange(t.id, 'completed')));
      }
      return true;
    } catch (_) { return false; }
  };

  // ── Completion sequence (persist-before-reveal) ──
  const completeStep = async (nodeIdx: number) => {
    if (isAnimating) return;
    setIsAnimating(true);

    const prevDist = nodeDists[nodeIdx + 1] ?? 0;  // snapshot for rollback (+1 for start)

    // 1. Checkbox feedback
    setActiveCheckIdx(nodeIdx);
    setScaleCardIdx(nodeIdx);
    await ms(280);

    // 2. Glow travel along path
    const gS = (nodeDists[nodeIdx + 1] ?? 0) / totalLen;
    const gE = (nodeDists[nodeIdx + 2] ?? totalLen) / totalLen;
    glowS.set(gS); glowE.set(gS);
    await new Promise<void>((ok) => {
      animate(glowE, gE, { duration: 1.1, ease: 'easeInOut', onComplete: ok });
      animate(glowS, gE, { duration: 1.1, delay: 0.18, ease: 'easeInOut' });
    });

    // 3. Move orb to next node
    const nextDist = nodeDists[nodeIdx + 2] ?? totalLen;
    orbDist.set(nextDist);
    await ms(820);

    // 4. PERSIST — before any UI reveal
    const ok = await persist(nodeIdx);

    if (ok) {
      setLocalCompletedIdx(nodeIdx);

      // 5. Reveal next node
      const next = nodeIdx + 1;
      if (next < totalNodes) { setRevealedIdx(next); await ms(380); }

      // 6. Pulse next node badge
      if (next < totalNodes) { setPulsingIdx(next); await ms(320); }

      // 7. Confetti 🎉
      if (pathRef.current && totalLen > 0) {
        const pt = pathRef.current.getPointAtLength(nextDist);
        fireConfetti(pt.x, pt.y);
        if (nodeIdx === totalNodes - 1) {
          setTimeout(() => fireConfetti(pt.x + 60, pt.y - 30), 380);
          setTimeout(() => fireConfetti(pt.x - 60, pt.y + 20), 700);
        }
      }
    } else {
      if (addToast) addToast('error', 'Failed to save progress. Please try again.');
      // Animated rollback — spring returns orb to previous position
      orbDist.set(prevDist);
      await ms(460);
      setActiveCheckIdx(null);
      setScaleCardIdx(null);
    }

    setIsAnimating(false);
    setActiveCheckIdx(null);
    setScaleCardIdx(null);
    setRevealedIdx(null);
    setPulsingIdx(null);
  };

  // ── Progress path fill ──
  const fillLen = totalNodes > 0 ? (localCompletedIdx + 1) / (totalNodes + 1) : 0;

  // ── Per-node state helper ──
  const nodeState = (i: number): 'done' | 'active' | 'locked' => {
    if (i <= localCompletedIdx) return 'done';
    if (i === localCompletedIdx + 1) return 'active';
    return 'locked';
  };

  return (
    <div
      className="relative rounded-[40px] overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #06080f 0%, #090d1a 60%, #050709 100%)' }}
    >
      {/* Ambient blobs */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-blue-600/[0.04] rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/3 right-1/4 w-64 h-64 bg-violet-600/[0.04] rounded-full blur-[80px] pointer-events-none" />

      {/* Subtle dot grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.028) 1px, transparent 1px)',
          backgroundSize: '36px 36px',
        }}
      />

      <div className="flex justify-center px-4 py-12">
        {/* ── Central SVG column ── */}
        <div style={{ position: 'relative', width: SVG_W, height: svgH }}>

          <svg
            width={SVG_W}
            height={svgH}
            className="absolute inset-0 overflow-visible"
            style={{ zIndex: 1 }}
          >
            <defs>
              {/* Main path gradient */}
              <linearGradient id="pathGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.9" />
                <stop offset="45%" stopColor="#818cf8" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.9" />
              </linearGradient>

              {/* Completed path gradient */}
              <linearGradient id="doneGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>

              {/* Glow filter */}
              <filter id="lineGlow" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              {/* Strong glow for pulse */}
              <filter id="pulseGlow" x="-80%" y="-80%" width="260%" height="260%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              {/* Orb glow */}
              <filter id="orbGlow" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* ── Measurement path (invisible, in DOM) ── */}
            <path ref={pathRef} d={pathD} fill="none" stroke="transparent" strokeWidth="1" />

            {/* ── Track: dim guide ribbon ── */}
            <path
              d={pathD}
              fill="none"
              stroke="rgba(255,255,255,0.04)"
              strokeWidth={PATH_W + 12}
              strokeLinecap="round"
            />

            {/* ── Track: outer glow ── */}
            <path
              d={pathD}
              fill="none"
              stroke="rgba(255,255,255,0.025)"
              strokeWidth={PATH_W + 6}
              strokeLinecap="round"
            />

            {/* ── Completed fill (bright, glowing) ── */}
            <motion.path
              d={pathD}
              fill="none"
              stroke="url(#doneGrad)"
              strokeWidth={PATH_W + 1}
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: fillLen }}
              transition={{ duration: 1, ease: 'easeOut' }}
              filter="url(#lineGlow)"
            />

            {/* ── Remaining path: subtle dotted ── */}
            <path
              d={pathD}
              fill="none"
              stroke="rgba(255,255,255,0.09)"
              strokeWidth={PATH_W}
              strokeLinecap="round"
              strokeDasharray="5 10"
            />

            {/* ── Glow travel pulse ── */}
            <motion.path
              d={pathD}
              fill="none"
              stroke="#7dd3fc"
              strokeWidth={PATH_W + 6}
              strokeLinecap="round"
              strokeDasharray="60 99999"
              style={{
                strokeDashoffset: useTransform(glowS, (v) => -v * totalLen),
                opacity: useTransform(glowLen, (l) => l > 0 ? 0.9 : 0),
                filter: 'drop-shadow(0 0 12px rgba(125,211,252,1))',
              }}
            />

            {/* ── Node markers on path ── */}
            {points.slice(1, -1).map((pt, i) => {
              const state = nodeState(i);
              const isPulsing = pulsingIdx === i;
              const color =
                state === 'done' ? '#34d399' : state === 'active' ? '#60a5fa' : 'rgba(255,255,255,0.15)';
              return (
                <g key={i}>
                  {/* Outer ring / glow */}
                  <motion.circle
                    cx={pt.x}
                    cy={pt.y}
                    r={state === 'active' ? 14 : 11}
                    fill={color}
                    opacity={state === 'active' ? 0.08 : 0.04}
                    animate={
                      isPulsing
                        ? { r: [11, 18, 11], opacity: [0.08, 0.2, 0.08] }
                        : state === 'active' && !isAnimating
                        ? { r: [13, 16, 13], opacity: [0.07, 0.14, 0.07] }
                        : {}
                    }
                    transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                    filter={state !== 'locked' ? 'url(#pulseGlow)' : undefined}
                  />
                  {/* Core dot */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={state === 'done' ? 5 : state === 'active' ? 6 : 4}
                    fill={color}
                    filter={state !== 'locked' ? 'url(#lineGlow)' : undefined}
                  />
                  {/* Inner white specular */}
                  {state !== 'locked' && (
                    <circle
                      cx={pt.x - 1.5}
                      cy={pt.y - 1.5}
                      r={1.8}
                      fill="white"
                      opacity={0.5}
                    />
                  )}
                </g>
              );
            })}

            {/* ── START node ── */}
            <g>
              <circle cx={points[0].x} cy={points[0].y} r={20} fill="#1e3a5f" opacity={0.5} />
              <circle cx={points[0].x} cy={points[0].y} r={14} fill="#1d4ed8" filter="url(#lineGlow)" />
              <circle cx={points[0].x - 4} cy={points[0].y - 4} r={4} fill="white" opacity={0.4} />
            </g>

            {/* ── GOAL node ── */}
            <motion.g
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <circle
                cx={points[points.length - 1].x}
                cy={points[points.length - 1].y}
                r={24}
                fill="#78350f"
                opacity={0.18}
                filter="url(#pulseGlow)"
              />
              <circle
                cx={points[points.length - 1].x}
                cy={points[points.length - 1].y}
                r={16}
                fill="#92400e"
                opacity={0.8}
                filter="url(#lineGlow)"
              />
              <circle
                cx={points[points.length - 1].x - 4}
                cy={points[points.length - 1].y - 5}
                r={5}
                fill="white"
                opacity={0.3}
              />
            </motion.g>

          </svg>

          {/* ── Orb (React overlay on SVG coordinates) ── */}
          <motion.div
            style={{
              position: 'absolute',
              left: orbX,
              top: orbY,
              x: '-50%',
              y: '-50%',
              zIndex: 30,
              pointerEvents: 'none',
            }}
          >
            <GemOrb angle={orbAngle} />
          </motion.div>

          {/* ── START label ── */}
          <div
            style={{
              position: 'absolute',
              top: points[0].y + 22,
              left: points[0].x,
              transform: 'translateX(-50%)',
              zIndex: 25,
            }}
          >
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-600/10 border border-blue-500/20">
              <Zap size={9} className="text-blue-400" />
              <span className="text-[9px] font-black text-blue-400 uppercase tracking-[0.2em]">Start</span>
            </div>
          </div>

          {/* ── GOAL label ── */}
          <div
            style={{
              position: 'absolute',
              top: points[points.length - 1].y + 24,
              left: points[points.length - 1].x,
              transform: 'translateX(-50%)',
              zIndex: 25,
            }}
          >
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
              <Trophy size={9} className="text-amber-400" />
              <span className="text-[9px] font-black text-amber-400 uppercase tracking-[0.2em]">
                {localCompletedIdx >= totalNodes - 1 ? 'Achieved' : 'Goal'}
              </span>
            </div>
          </div>

          {/* ── Node Cards (alternating left / right) ── */}
          {nodes.map((node, i) => {
            const pt = points[i + 1]; // +1 for start
            const state = nodeState(i);
            const isLocked = state === 'locked';
            const cardOnRight = i % 2 === 0;
            const cardX = cardOnRight
              ? pt.x + 26
              : pt.x - 26 - CARD_W;

            const visible = !isLocked || revealedIdx === i;

            return (
              <AnimatePresence key={i}>
                {(visible || !isLocked) && (
                  <motion.div
                    initial={revealedIdx === i ? { opacity: 0, y: 12 } : false}
                    animate={{ opacity: isLocked ? 0.38 : 1, y: 0 }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                    style={{
                      position: 'absolute',
                      top: pt.y,
                      left: cardX,
                      transform: 'translateY(-50%)',
                      width: CARD_W,
                      zIndex: 20,
                    }}
                  >
                    {/* Connector dot-line */}
                    <div
                      style={{
                        position: 'absolute',
                        top: '50%',
                        [cardOnRight ? 'left' : 'right']: 0,
                        width: 26,
                        height: 1,
                        background:
                          state === 'done'
                            ? 'linear-gradient(90deg, rgba(52,211,153,0.5), rgba(52,211,153,0.1))'
                            : state === 'active'
                            ? 'linear-gradient(90deg, rgba(96,165,250,0.5), rgba(96,165,250,0.1))'
                            : 'rgba(255,255,255,0.06)',
                        transform: cardOnRight ? 'translateX(-100%)' : 'translateX(100%)',
                      }}
                    />

                    <NodeCard
                      node={node}
                      index={i}
                      state={state}
                      isChecked={activeCheckIdx === i || state === 'done'}
                      isAnimating={isAnimating}
                      scaleCardIdx={scaleCardIdx}
                      pulsingIdx={pulsingIdx}
                      onComplete={() => completeStep(i)}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Util ─────────────────────────────────────────────────────────────────────

function ms(t: number): Promise<void> {
  return new Promise((r) => setTimeout(r, t));
}
