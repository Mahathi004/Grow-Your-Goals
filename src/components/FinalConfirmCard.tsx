import { motion } from 'framer-motion';
import {
  XCircle, AlertTriangle, CheckCircle2, ArrowRight, Loader2, Lock,
  TrendingUp, Shield, Zap, Brain, Activity
} from 'lucide-react';

interface ValidationResult {
  validity: 'VALID' | 'RISKY' | 'IMPOSSIBLE';
  analysis: string;
  blockerReason: string | null;
  minimumDays: number;
  minimumDurationText: string;
  recommendedDurationText: string;
  userDurationText: string | null;
  isProbeDate: boolean;
  complexityScore: number;
  confidenceScore: number;
  feasibilityScore?: number;
  successProbability?: number;
  timelineRisk?: string;
  executionDensity?: string;
  domainConstraint?: string | null;
  isAggressiveTimeline: boolean;
}

interface FinalConfirmCardProps {
  onConfirm: () => void;
  onEdit: () => void;
  validationResult?: ValidationResult | null;
  isFeasibilityLoading?: boolean;
  onOverrideConfirm?: () => void;
}

/* ── Helpers ─────────────────────────────────────────── */
const cxLabel = (s: number) =>
  s <= 2 ? 'Trivial' : s <= 4 ? 'Simple' : s <= 6 ? 'Moderate' : s <= 8 ? 'Complex' : 'Expert';

function Ring({ percent, color, size = 44 }: { percent: number; color: string; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(100, Math.max(0, percent)) / 100) * circ;
  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={4} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={4}
        strokeLinecap="round"
        initial={{ strokeDasharray: `0 ${circ}` }}
        animate={{ strokeDasharray: `${dash} ${circ - dash}` }}
        transition={{ duration: 1, ease: 'easeOut' }}
      />
    </svg>
  );
}

export default function FinalConfirmCard({
  onConfirm, onEdit, validationResult, isFeasibilityLoading, onOverrideConfirm
}: FinalConfirmCardProps) {
  const v = validationResult;
  const validity = v?.validity;
  const isBlocked = validity === 'IMPOSSIBLE';
  const isRisky = validity === 'RISKY';
  const isValid = validity === 'VALID';

  const feasibility = isBlocked ? 0 : (v?.feasibilityScore ?? v?.confidenceScore ?? 0);
  const success = isBlocked ? 0 : (v?.successProbability ?? 0);
  const risk = isBlocked ? 'CRITICAL' : (v?.timelineRisk ?? 'MEDIUM');
  const density = isBlocked ? 'Impossible' : (v?.executionDensity ?? 'MEDIUM');
  const complexity = v?.complexityScore ?? 5;

  const riskCol = risk === 'LOW' ? '#34d399' : risk === 'MEDIUM' ? '#fbbf24' : risk === 'HIGH' ? '#f97316' : '#ef4444';
  const densCol = (density === 'LOW' || density === 'Steady') ? '#34d399' : density === 'MEDIUM' ? '#60a5fa' : (density === 'HIGH' || density === 'Impossible' || density === 'OVERLOADED') ? '#ef4444' : '#ef4444';

  // theme
  const accent = isBlocked ? '#ef4444' : isRisky ? '#f97316' : '#10b981';
  const accentBg = isBlocked ? 'rgba(239,68,68,' : isRisky ? 'rgba(249,115,22,' : 'rgba(16,185,129,';
  const borderCls = isBlocked ? 'border-red-500/20' : isRisky ? 'border-orange-500/20' : isValid ? 'border-emerald-500/15' : 'border-white/[0.06]';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 360, damping: 30 }}
      className="w-full max-w-[420px] mx-auto my-4 relative"
    >
      {/* Ambient glow behind card */}
      <div className="absolute -inset-4 rounded-[36px] blur-3xl pointer-events-none"
        style={{ background: `${accentBg}0.06)` }} />

      <div className={`relative bg-[#0a0c14]/[0.97] backdrop-blur-3xl border rounded-[24px] overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.75)] ${borderCls}`}>

        {/* ── SCANLINE ACCENT ── */}
        <div className="absolute top-0 left-0 right-0 h-[1px]"
          style={{ background: `linear-gradient(90deg, transparent, ${accent}60, transparent)` }} />

        {/* ══════════ LOADING ══════════ */}
        {isFeasibilityLoading && (
          <div className="px-7 py-10 flex flex-col items-center gap-5 text-center">
            {/* Pulsing ring */}
            <div className="relative">
              <div className="w-16 h-16 rounded-full border border-blue-500/15 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full animate-ping bg-blue-500/5" />
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" strokeWidth={1.5} />
              </div>
            </div>
            <div>
              <p className="text-white font-black text-[15px] tracking-tight">Feasibility Analysis</p>
              <p className="text-zinc-600 text-[10px] mt-1.5 uppercase tracking-[0.2em] font-bold">Running intelligent validation</p>
            </div>
            <div className="w-full max-w-[260px] space-y-2.5 mt-1">
              {['Domain constraint analysis', 'Timeline feasibility scoring', 'Success probability modeling'].map((s, i) => (
                <motion.div key={s}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 0.6, x: 0 }}
                  transition={{ delay: i * 0.4 }}
                  className="flex items-center gap-2.5 text-[10px] text-zinc-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500/40 animate-pulse" />
                  {s}
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* ══════════ RESULT ══════════ */}
        {!isFeasibilityLoading && v && (
          <>
            {/* ─── 1. STATUS (largest visual weight) ─── */}
            <div className="px-7 pt-7 pb-5">
              <div className="flex items-start gap-4">
                <div className="relative shrink-0">
                  <div className="w-11 h-11 rounded-[14px] flex items-center justify-center"
                    style={{ background: `${accentBg}0.08)`, border: `1px solid ${accentBg}0.2)`, boxShadow: `0 0 24px ${accentBg}0.12)` }}>
                    {isBlocked ? <XCircle size={22} style={{ color: accent }} />
                     : isRisky ? <AlertTriangle size={22} style={{ color: accent }} />
                     : <CheckCircle2 size={22} style={{ color: accent }} />}
                  </div>
                  {/* Pulse dot */}
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full animate-pulse"
                    style={{ background: accent, boxShadow: `0 0 8px ${accent}` }} />
                </div>
                <div>
                  <h3 className="font-black text-[17px] tracking-tight leading-tight" style={{ color: accent }}>
                    {isBlocked ? 'Timeline Not Feasible' : isRisky ? 'Aggressive Timeline' : 'Timeline Achievable'}
                  </h3>
                  <p className="text-[10px] uppercase tracking-[0.15em] font-bold mt-1"
                    style={{ color: `${accentBg}0.45)` }}>
                    {isBlocked ? 'Generation blocked' : isRisky ? 'High-intensity warning' : 'Ready to generate'}
                  </p>
                </div>
              </div>
            </div>

            {/* ─── 2. REASONING ─── */}
            <div className="px-7 pb-5">
              <div className="rounded-2xl p-5"
                style={{
                  background: isBlocked ? 'rgba(239,68,68,0.16)' : isRisky ? 'rgba(249,115,22,0.14)' : `${accentBg}0.03)`,
                  border: isBlocked ? '2px solid rgba(239,68,68,0.85)' : isRisky ? '2px solid rgba(249,115,22,0.85)' : `1px solid ${accentBg}0.08)`,
                  boxShadow: (isBlocked || isRisky) ? '0 12px 30px rgba(0, 0, 0, 0.4)' : 'none'
                }}>
                {(isBlocked || isRisky) && (
                  <div className="flex items-center gap-2 mb-3 font-black text-[13px] uppercase tracking-[0.2em] animate-pulse" style={{ color: accent }}>
                    <AlertTriangle size={15} />
                    {isBlocked ? 'Critical Blocker' : 'Timeline Warning'}
                  </div>
                )}
                <p className={`text-white leading-relaxed font-bold ${isBlocked || isRisky ? 'text-[15px]' : 'text-[13px]'}`}>
                  {v.blockerReason || v.analysis}
                </p>

                {v.domainConstraint && (
                  <div className="mt-3 flex items-center gap-2">
                    <Lock size={10} style={{ color: `${accentBg}0.5)` }} />
                    <span className="text-[9px] font-black uppercase tracking-[0.15em]"
                      style={{ color: `${accentBg}0.5)` }}>
                      {v.domainConstraint}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* ─── 3. TIMELINE COMPARISON ─── */}
            {!v.isProbeDate && (v.userDurationText || isBlocked || isRisky) && (
              <div className="px-7 pb-5">
                <div className={`grid gap-2.5 ${(isBlocked || isRisky) ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {!v.isProbeDate && v.userDurationText && (
                    <div className="rounded-2xl p-4 relative overflow-hidden"
                      style={{ background: `${accentBg}0.04)`, border: `1px solid ${accentBg}0.1)` }}>
                      <p className="text-[9px] text-zinc-600 uppercase tracking-[0.15em] font-black">Selected</p>
                      <p className="text-[18px] font-black mt-1" style={{ color: accent }}>
                        {v.userDurationText}
                      </p>
                      {/* Corner accent */}
                      <div className="absolute top-0 right-0 w-8 h-8 rounded-bl-2xl"
                        style={{ background: `${accentBg}0.06)` }} />
                    </div>
                  )}
                  {(isBlocked || isRisky) && (
                    <div className="rounded-2xl p-4 bg-white/[0.02] border border-white/[0.06]">
                      <p className="text-[9px] text-zinc-600 uppercase tracking-[0.15em] font-black">
                        {isBlocked ? 'Min. Required' : 'Recommended'}
                      </p>
                      <p className="text-[18px] font-black text-zinc-200 mt-1">
                        {isBlocked ? v.minimumDurationText : v.recommendedDurationText}
                      </p>
                    </div>
                  )}
                </div>

                {isBlocked && (
                  <p className="text-[11px] text-zinc-500 mt-3 leading-relaxed">
                    Extend your timeline to at least <span className="text-zinc-300 font-bold">{v.minimumDurationText}</span> to generate a valid execution strategy.
                  </p>
                )}
              </div>
            )}

            {/* ─── 4. METRICS DASHBOARD (all states) ─── */}
            <div className={`px-7 pb-5 transition-opacity duration-200 ${(isBlocked || isRisky) ? 'opacity-30 hover:opacity-40' : ''}`}>
              <div className="text-[9px] text-zinc-600 uppercase tracking-widest font-black mb-2 flex items-center justify-between">
                <span>Validation Metrics</span>
                {(isBlocked || isRisky) && <span className="text-[8px] text-zinc-500 font-normal italic">(secondary metrics)</span>}
              </div>
              <div className="rounded-2xl bg-white/[0.015] border border-white/[0.05] p-4">
                {/* Top row: ring gauges */}
                <div className="flex items-center justify-around mb-4">
                  <div className="flex flex-col items-center gap-1">
                    <div className="relative">
                      <Ring percent={feasibility} color={feasibility >= 70 ? '#10b981' : feasibility >= 45 ? '#f97316' : '#ef4444'} />
                      <span className={`absolute inset-0 flex items-center justify-center text-[11px] font-black ${feasibility >= 70 ? 'text-emerald-400' : feasibility >= 45 ? 'text-orange-400' : 'text-red-400'}`}>
                        {feasibility}%
                      </span>
                    </div>
                    <span className="text-[8px] text-zinc-600 uppercase tracking-[0.2em] font-bold">Feasibility</span>
                  </div>
                  <div className="w-[1px] h-10 bg-white/[0.04]" />
                  <div className="flex flex-col items-center gap-1">
                    <div className="relative">
                      <Ring percent={success} color={success >= 65 ? '#10b981' : success >= 40 ? '#f97316' : '#ef4444'} />
                      <span className={`absolute inset-0 flex items-center justify-center text-[11px] font-black ${success >= 65 ? 'text-emerald-400' : success >= 40 ? 'text-orange-400' : 'text-red-400'}`}>
                        {success}%
                      </span>
                    </div>
                    <span className="text-[8px] text-zinc-600 uppercase tracking-[0.2em] font-bold">Success</span>
                  </div>
                </div>

                {/* Bottom row: metric pills */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col items-center bg-white/[0.02] rounded-xl py-2 px-1 border border-white/[0.04]">
                    <Shield size={12} style={{ color: riskCol }} className="mb-0.5" />
                    <span className="text-[10px] font-black" style={{ color: riskCol }}>{risk}</span>
                    <span className="text-[8px] text-zinc-700 uppercase tracking-wider">Risk</span>
                  </div>
                  <div className="flex flex-col items-center bg-white/[0.02] rounded-xl py-2 px-1 border border-white/[0.04]">
                    <Activity size={12} style={{ color: densCol }} className="mb-0.5" />
                    <span className="text-[10px] font-black" style={{ color: densCol }}>{density}</span>
                    <span className="text-[8px] text-zinc-700 uppercase tracking-wider">Intensity</span>
                  </div>
                  <div className="flex flex-col items-center bg-white/[0.02] rounded-xl py-2 px-1 border border-white/[0.04]">
                    <Brain size={12} className="text-violet-400 mb-0.5" />
                    <span className="text-[10px] font-black text-violet-400">{cxLabel(complexity)}</span>
                    <span className="text-[8px] text-zinc-700 uppercase tracking-wider">Complexity</span>
                  </div>
                </div>

                {v.isAggressiveTimeline && (
                  <div className="mt-3 flex items-center gap-2 bg-orange-500/[0.05] border border-orange-500/15 rounded-xl px-3 py-2">
                    <Zap size={11} className="text-orange-400 shrink-0" />
                    <p className="text-[10px] text-orange-400/80 font-medium">
                      Tagged as <span className="font-bold">Aggressive Timeline</span>
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* ─── 5. OVERRIDE (IMPOSSIBLE only) ─── */}
            {isBlocked && (
              <div className="px-7 pb-5">
                <div className="rounded-2xl bg-white/[0.015] border border-white/[0.04] p-4">
                  <p className="text-[10px] text-zinc-600 leading-relaxed mb-3">
                    Advanced override available. Roadmap will be permanently tagged as{' '}
                    <span className="text-orange-400/80 font-bold">Unrealistic Timeline</span> with reduced confidence.
                  </p>
                  <button
                    onClick={onOverrideConfirm}
                    className="w-full py-2.5 bg-white/[0.02] hover:bg-orange-500/[0.08] border border-white/[0.06] hover:border-orange-500/25 text-zinc-500 hover:text-orange-400 text-[11px] font-bold rounded-xl transition-all tracking-wide uppercase"
                  >
                    Override — Generate Anyway
                  </button>
                </div>
              </div>
            )}

            {/* ─── 6. ACTION BUTTONS ─── */}
            <div className="px-7 pb-7 flex gap-3">
              <button
                onClick={onEdit}
                className="flex-1 py-3.5 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] text-zinc-400 hover:text-white rounded-2xl font-bold text-[13px] transition-all duration-200"
              >
                {isBlocked ? 'Extend Timeline' : 'Edit Details'}
              </button>

              {!isBlocked && (
                <motion.button
                  onClick={onConfirm}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`flex-[2] py-3.5 rounded-2xl font-bold text-[13px] flex items-center justify-center gap-2 transition-all duration-200 ${
                    isRisky
                      ? 'bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white shadow-[0_8px_28px_rgba(249,115,22,0.25)]'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-[0_8px_28px_rgba(59,130,246,0.3)]'
                  }`}
                >
                  <TrendingUp size={15} />
                  {isRisky ? 'Accept Risk & Generate' : 'Confirm & Generate'}
                  <ArrowRight size={14} />
                </motion.button>
              )}
            </div>

            {/* Bottom accent line */}
            <div className="absolute bottom-0 left-0 right-0 h-[1px]"
              style={{ background: `linear-gradient(90deg, transparent, ${accent}30, transparent)` }} />
          </>
        )}

        {/* Fallback */}
        {!isFeasibilityLoading && !v && (
          <div className="px-7 py-7 flex gap-3">
            <button onClick={onEdit} className="flex-1 py-3.5 bg-white/[0.03] border border-white/[0.05] text-zinc-400 rounded-2xl font-bold text-[13px]">Cancel</button>
            <motion.button onClick={onConfirm} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="flex-[2] py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-bold text-[13px] flex items-center justify-center gap-2 shadow-[0_8px_28px_rgba(59,130,246,0.3)]">
              <TrendingUp size={15} /> Generate <ArrowRight size={14} />
            </motion.button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
