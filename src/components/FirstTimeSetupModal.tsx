import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, Sparkles, User, Phone, FileText, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProfileData {
  fullName: string;
  phone: string;
  bio: string;
  workStyle: string;
  interests: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const INTERESTS = [
  'Career', 'Fitness', 'Learning', 'Finance', 'Health',
  'Mindfulness', 'Business', 'Coding', 'Creativity', 'Relationships'
];

const WORK_STYLES = [
  { id: 'deep_work',  label: 'Deep Work',   desc: 'Long uninterrupted focus blocks' },
  { id: 'flexible',   label: 'Flexible',    desc: 'Adaptable schedule, fluid tasks' },
  { id: 'sprint',     label: 'Sprint Mode', desc: 'Short, intense bursts of activity' },
];

const STORAGE_KEY = (userId: string) => `gyg_profile_setup_done_${userId}`;

// ─── Individual Step Components ───────────────────────────────────────────────

function StepWelcome({ name }: { name: string }) {
  return (
    <div className="text-center py-4">
      <motion.div
        initial={{ scale: 0 }} animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-violet-500/20 to-blue-500/20 border border-white/10 flex items-center justify-center"
      >
        <Sparkles size={36} className="text-white" />
      </motion.div>
      <h2 className="text-3xl font-bold text-white mb-3 tracking-tight">
        Welcome{name ? `, ${name.split(' ')[0]}` : ''}! 🎉
      </h2>
      <p className="text-zinc-400 text-[15px] leading-relaxed max-w-xs mx-auto">
        Let's set up your profile in just a few quick steps so GYG can personalise your experience.
      </p>
      <p className="text-zinc-600 text-[13px] mt-4">Takes less than a minute • All fields are optional</p>
    </div>
  );
}

function StepBasicInfo({ data, onChange }: { data: ProfileData; onChange: (d: Partial<ProfileData>) => void }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="text-xl font-bold text-white mb-1">About you</h3>
        <p className="text-zinc-500 text-[14px]">Your public-facing information</p>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-2">Full Name</label>
          <div className="relative">
            <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="e.g. Alex Johnson"
              value={data.fullName}
              onChange={e => onChange({ fullName: e.target.value })}
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-9 pr-4 py-3.5 text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/25 text-[14px] transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-2">Phone Number <span className="text-zinc-700 normal-case font-normal">(optional)</span></label>
          <div className="relative">
            <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="tel"
              placeholder="+1 (555) 000-0000"
              value={data.phone}
              onChange={e => onChange({ phone: e.target.value })}
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-9 pr-4 py-3.5 text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/25 text-[14px] transition-all"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em]">Short Bio <span className="text-zinc-700 normal-case font-normal">(optional)</span></label>
            <span className="text-[11px] text-zinc-600">{data.bio.length}/120</span>
          </div>
          <div className="relative">
            <FileText size={15} className="absolute left-3.5 top-3.5 text-zinc-500" />
            <textarea
              placeholder="A little bit about yourself..."
              value={data.bio}
              maxLength={120}
              rows={3}
              onChange={e => onChange({ bio: e.target.value })}
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-9 pr-4 py-3.5 text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/25 text-[14px] transition-all resize-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function StepPreferences({ data, onChange }: { data: ProfileData; onChange: (d: Partial<ProfileData>) => void }) {
  const toggleInterest = (interest: string) => {
    const list = data.interests.includes(interest)
      ? data.interests.filter(i => i !== interest)
      : [...data.interests, interest];
    onChange({ interests: list });
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-xl font-bold text-white mb-1">Your preferences</h3>
        <p className="text-zinc-500 text-[14px]">Help the AI personalise your experience</p>
      </div>

      {/* Work Style */}
      <div>
        <label className="block text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-3">
          <Zap size={11} className="inline mr-1.5" />Work Style
        </label>
        <div className="grid grid-cols-3 gap-2">
          {WORK_STYLES.map(s => (
            <button
              key={s.id}
              onClick={() => onChange({ workStyle: s.id })}
              className={`p-3 rounded-xl border text-left transition-all ${
                data.workStyle === s.id
                  ? 'bg-violet-500/15 border-violet-500/40 text-white'
                  : 'bg-white/[0.03] border-white/8 text-zinc-400 hover:border-white/20'
              }`}
            >
              <p className={`text-[13px] font-bold mb-0.5 ${data.workStyle === s.id ? 'text-violet-300' : ''}`}>{s.label}</p>
              <p className="text-[11px] text-zinc-600 leading-tight">{s.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Interests */}
      <div>
        <label className="block text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-3">Interests</label>
        <div className="flex flex-wrap gap-2">
          {INTERESTS.map(interest => {
            const selected = data.interests.includes(interest);
            return (
              <button
                key={interest}
                onClick={() => toggleInterest(interest)}
                className={`px-3.5 py-1.5 rounded-full text-[13px] font-semibold border transition-all ${
                  selected
                    ? 'bg-white text-black border-white'
                    : 'bg-white/[0.04] border-white/10 text-zinc-400 hover:border-white/25 hover:text-white'
                }`}
              >
                {interest}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StepDone() {
  return (
    <div className="text-center py-6">
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="text-5xl mb-5"
      >
        🚀
      </motion.div>
      <h3 className="text-2xl font-bold text-white mb-2">You're all set!</h3>
      <p className="text-zinc-400 text-[15px] leading-relaxed max-w-xs mx-auto">
        Your profile is ready. Start setting goals and let GYG help you grow.
      </p>
    </div>
  );
}

// ─── Progress Dots ────────────────────────────────────────────────────────────

function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center gap-1.5 justify-center">
      {Array.from({ length: total }).map((_, i) => (
        <motion.div
          key={i}
          animate={{ width: i === current ? 20 : 6, opacity: i <= current ? 1 : 0.3 }}
          className={`h-1.5 rounded-full ${i <= current ? 'bg-white' : 'bg-white/20'}`}
        />
      ))}
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function FirstTimeSetupModal() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [step, setStep]       = useState(0); // 0=welcome, 1=basic, 2=prefs, 3=done
  const [data, setData]       = useState<ProfileData>({
    fullName:  user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : '',
    phone:     '',
    bio:       '',
    workStyle: '',
    interests: [],
  });

  const TOTAL_STEPS = 4; // 0,1,2,3

  useEffect(() => {
    if (!user?.id) return;

    const done = localStorage.getItem(STORAGE_KEY(user.id));
    if (!done) {
      // Small delay so the dashboard renders first
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, [user?.id]);

  const updateData = (partial: Partial<ProfileData>) => {
    setData(prev => ({ ...prev, ...partial }));
  };

  const handleNext = () => {
    if (step < TOTAL_STEPS - 1) {
      setStep(s => s + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(s => s - 1);
  };

  const handleFinish = () => {
    if (user?.id) {
      localStorage.setItem(STORAGE_KEY(user.id), JSON.stringify({ ...data, completedAt: Date.now() }));
    }
    setVisible(false);
  };

  const handleSkip = () => {
    if (user?.id) {
      localStorage.setItem(STORAGE_KEY(user.id), JSON.stringify({ skipped: true, skippedAt: Date.now() }));
    }
    setVisible(false);
  };

  const isLastStep = step === TOTAL_STEPS - 1;
  const isFirstStep = step === 0;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/75 backdrop-blur-md"
            onClick={handleSkip}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="relative w-full max-w-lg bg-[#0a0a0f] border border-white/[0.08] rounded-[32px] shadow-[0_60px_120px_rgba(0,0,0,0.9)] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Ambient glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-violet-600/10 blur-[80px] rounded-full pointer-events-none" />

            {/* Header */}
            <div className="flex items-center justify-between px-8 pt-7 pb-0">
              <ProgressDots total={TOTAL_STEPS} current={step} />
              <button
                onClick={handleSkip}
                className="p-2 text-zinc-600 hover:text-zinc-400 transition-colors rounded-xl hover:bg-white/5"
                title="Skip setup"
              >
                <X size={18} />
              </button>
            </div>

            {/* Step content */}
            <div className="px-8 py-7 min-h-[340px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  {step === 0 && <StepWelcome name={data.fullName || user?.firstName || ''} />}
                  {step === 1 && <StepBasicInfo data={data} onChange={updateData} />}
                  {step === 2 && <StepPreferences data={data} onChange={updateData} />}
                  {step === 3 && <StepDone />}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Footer actions */}
            <div className="px-8 pb-8 flex items-center justify-between gap-4 border-t border-white/[0.04] pt-5">
              {/* Back / Skip */}
              <div>
                {!isFirstStep && !isLastStep && (
                  <button
                    onClick={handleBack}
                    className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 text-[14px] font-medium transition-colors"
                  >
                    <ChevronLeft size={16} /> Back
                  </button>
                )}
                {isFirstStep && (
                  <button
                    onClick={handleSkip}
                    className="text-zinc-600 hover:text-zinc-400 text-[13px] font-medium transition-colors"
                  >
                    Skip for now
                  </button>
                )}
              </div>

              {/* Next / Finish */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={isLastStep ? handleFinish : handleNext}
                className="flex items-center gap-2 bg-white text-black hover:bg-zinc-100 rounded-2xl px-6 py-3 font-bold text-[14px] transition-all shadow-lg shadow-white/5"
              >
                {isLastStep ? (
                  'Start Growing 🚀'
                ) : step === 0 ? (
                  <>Let's go <ChevronRight size={16} /></>
                ) : (
                  <>Continue <ChevronRight size={16} /></>
                )}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
