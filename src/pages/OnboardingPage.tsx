import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Eye, EyeOff, AtSign, Lock, Sparkles, ArrowRight } from 'lucide-react';
import api from '../api';

// ─── Username availability hook ───────────────────────────────────────────────

function useUsernameCheck(username: string) {
  const [status, setStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!username) { setStatus('idle'); setMessage(''); return; }

    const valid = /^[a-zA-Z0-9_]{3,20}$/.test(username);
    if (!valid) {
      setStatus('invalid');
      setMessage('3–20 characters: letters, numbers, underscore only');
      return;
    }

    setStatus('checking');
    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/auth/check-username?username=${encodeURIComponent(username)}`);
        if (res.data.available) {
          setStatus('available'); setMessage(`@${username} is available!`);
        } else {
          setStatus('taken'); setMessage('That username is already taken');
        }
      } catch {
        setStatus('idle');
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [username]);

  return { status, message };
}

// ─── Password strength ────────────────────────────────────────────────────────

function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: '', color: '' };
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;

  if (score <= 1) return { score, label: 'Weak',   color: 'bg-rose-500' };
  if (score <= 3) return { score, label: 'Fair',   color: 'bg-amber-400' };
  return             { score, label: 'Strong', color: 'bg-emerald-500' };
}

// ─── Step components ──────────────────────────────────────────────────────────

function StepUsername({ value, onChange, onNext }: {
  value: string; onChange: (v: string) => void; onNext: () => void;
}) {
  const { status, message } = useUsernameCheck(value);
  const canProceed = status === 'available';

  return (
    <motion.div
      initial={{ opacity: 0, x: 32 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -32 }}
      className="flex flex-col gap-6"
    >
      <div>
        <h3 className="text-2xl font-bold text-white mb-1">Choose your username</h3>
        <p className="text-zinc-500 text-[14px]">This is how others will find you. You can't change it later.</p>
      </div>

      <div>
        <div className="relative flex items-center">
          <AtSign size={16} className="absolute left-4 text-zinc-500 pointer-events-none" />
          <input
            type="text"
            placeholder="yourusername"
            value={value}
            onChange={e => onChange(e.target.value.replace(/\s/g, ''))}
            autoComplete="username"
            maxLength={20}
            className="w-full bg-white/[0.04] border border-white/10 rounded-2xl pl-10 pr-12 py-4 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-white/10 focus:border-white/25 transition-all text-[15px]"
          />
          <div className="absolute right-4">
            {status === 'checking' && (
              <svg className="animate-spin h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            )}
            {status === 'available' && <CheckCircle size={18} className="text-emerald-400" />}
            {(status === 'taken' || status === 'invalid') && <XCircle size={18} className="text-rose-400" />}
          </div>
        </div>

        <AnimatePresence>
          {message && (
            <motion.p
              key={message}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`mt-2 text-[13px] ml-1 ${
                status === 'available' ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {message}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <button
        onClick={onNext}
        disabled={!canProceed}
        className="w-full flex items-center justify-center gap-2 bg-white text-black hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed rounded-2xl py-4 font-bold text-[15px] transition-all active:scale-[0.98]"
      >
        Continue <ArrowRight size={18} />
      </button>
    </motion.div>
  );
}

function StepPassword({ onComplete, loading }: {
  onComplete: (pw: string) => void; loading: boolean;
}) {
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [showPw, setShowPw]       = useState(false);
  const [showCf, setShowCf]       = useState(false);
  const [touched, setTouched]     = useState(false);

  const strength   = getPasswordStrength(password);
  const mismatch   = touched && confirm && password !== confirm;
  const canSubmit  = password.length >= 8 && password === confirm && !loading;

  return (
    <motion.div
      initial={{ opacity: 0, x: 32 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -32 }}
      className="flex flex-col gap-6"
    >
      <div>
        <h3 className="text-2xl font-bold text-white mb-1">Set your password</h3>
        <p className="text-zinc-500 text-[14px]">You can also sign in with Google later — both will work.</p>
      </div>

      {/* Password */}
      <div className="flex flex-col gap-2">
        <div className="relative flex items-center">
          <Lock size={16} className="absolute left-4 text-zinc-500 pointer-events-none" />
          <input
            type={showPw ? 'text' : 'password'}
            placeholder="Password (min. 8 characters)"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="new-password"
            className="w-full bg-white/[0.04] border border-white/10 rounded-2xl pl-10 pr-12 py-4 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-white/10 focus:border-white/25 transition-all text-[15px]"
          />
          <button type="button" onClick={() => setShowPw(p => !p)}
            className="absolute right-4 text-zinc-500 hover:text-white transition-colors">
            {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {/* Strength bar */}
        {password && (
          <div className="flex gap-1 mt-1">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className={`flex-1 h-1 rounded-full transition-all duration-300 ${
                i <= strength.score ? strength.color : 'bg-white/10'
              }`} />
            ))}
            <span className={`text-[12px] ml-2 ${strength.color.replace('bg-', 'text-')}`}>
              {strength.label}
            </span>
          </div>
        )}
      </div>

      {/* Confirm password */}
      <div>
        <div className="relative flex items-center">
          <Lock size={16} className="absolute left-4 text-zinc-500 pointer-events-none" />
          <input
            type={showCf ? 'text' : 'password'}
            placeholder="Confirm password"
            value={confirm}
            onChange={e => { setConfirm(e.target.value); setTouched(true); }}
            autoComplete="new-password"
            className={`w-full bg-white/[0.04] border rounded-2xl pl-10 pr-12 py-4 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-white/10 transition-all text-[15px] ${
              mismatch ? 'border-rose-500/50' : 'border-white/10 focus:border-white/25'
            }`}
          />
          <button type="button" onClick={() => setShowCf(p => !p)}
            className="absolute right-4 text-zinc-500 hover:text-white transition-colors">
            {showCf ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {mismatch && <p className="text-rose-400 text-[13px] mt-1.5 ml-1">Passwords don't match</p>}
      </div>

      <button
        onClick={() => canSubmit && onComplete(password)}
        disabled={!canSubmit}
        className="w-full flex items-center justify-center gap-2 bg-white text-black hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed rounded-2xl py-4 font-bold text-[15px] transition-all active:scale-[0.98]"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Setting up your account…
          </>
        ) : (
          <>Complete Setup <ArrowRight size={18} /></>
        )}
      </button>
    </motion.div>
  );
}

// ─── Main OnboardingPage ──────────────────────────────────────────────────────

export default function OnboardingPage() {
  const [step, setStep]       = useState<1 | 2>(1);
  const [username, setUsername] = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const { login, user } = useAuth();
  const navigate = useNavigate();

  const handleComplete = useCallback(async (password: string) => {
    setError(''); setLoading(true);
    try {
      const res = await api.post('/auth/complete-onboarding', { username, password });
      login(res.data.token, res.data.user);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Setup failed. Please try again.');
      setLoading(false);
    }
  }, [username, login, navigate]);

  return (
    <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-6 w-full">

      {/* Background subtle gradient */}
      <div className="fixed inset-0 bg-background pointer-events-none" />
      <div className="fixed inset-0 bg-gradient-to-br from-white/[0.02] via-transparent to-white/[0.01] pointer-events-none" />

      <div className="relative w-full max-w-md">

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-3 mb-8">
          {[1, 2].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <motion.div
                animate={{
                  background: s < step ? 'rgba(255,255,255,1)' : s === step ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.15)',
                  scale: s === step ? 1.1 : 1,
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold"
                style={{ color: s <= step ? '#000' : 'rgba(255,255,255,0.4)' }}
              >
                {s < step ? '✓' : s}
              </motion.div>
              {s < 2 && (
                <motion.div
                  animate={{ background: s < step ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.12)' }}
                  className="w-12 h-px"
                />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-black/70 backdrop-blur-[48px] border border-white/15 p-10 rounded-[40px] shadow-[0_50px_100px_-30px_rgba(0,0,0,1)]">

          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <p className="text-zinc-500 text-[12px] font-semibold tracking-widest uppercase">Profile Setup</p>
              <p className="text-white text-[15px] font-semibold">
                {user?.email ? `Setting up for ${user.email}` : 'Almost there'}
              </p>
            </div>
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                key="err"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-rose-500/10 border border-rose-500/25 text-rose-400 text-sm rounded-2xl p-3.5 mb-6 text-center"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Steps */}
          <AnimatePresence mode="wait">
            {step === 1 && (
              <StepUsername
                key="step1"
                value={username}
                onChange={setUsername}
                onNext={() => setStep(2)}
              />
            )}
            {step === 2 && (
              <StepPassword
                key="step2"
                onComplete={handleComplete}
                loading={loading}
              />
            )}
          </AnimatePresence>

          {/* Back link for step 2 */}
          {step === 2 && (
            <button
              onClick={() => setStep(1)}
              className="mt-5 w-full text-center text-zinc-600 hover:text-zinc-400 text-[13px] transition-colors"
            >
              ← Back to username
            </button>
          )}
        </div>

        <p className="text-center text-zinc-600 text-[12px] mt-6">
          After setup you can sign in with your username/password or Google — both will work.
        </p>
      </div>
    </div>
  );
}
