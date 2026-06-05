import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Eye, EyeOff, Mail, Lock, User, ShieldCheck, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api';

declare global {
  interface Window {
    google?: {
      accounts: { id: {
        initialize: (c: object) => void;
        renderButton: (el: HTMLElement, c: object) => void;
        revoke: (email: string, cb: () => void) => void;
      }};
    };
  }
}

type Mode = 'login' | 'signup';

function GoogleButton({ onCredential, label = 'continue_with' }: {
  onCredential: (r: { credential: string }) => void;
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const initDone = useRef(false);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (initDone.current || !clientId || clientId === 'your_google_client_id_here') return;

    const tryInit = () => {
      if (!window.google?.accounts?.id) return false;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: onCredential,
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      setReady(true);
      initDone.current = true;
      return true;
    };

    if (!tryInit()) {
      const iv = setInterval(() => { if (tryInit()) clearInterval(iv); }, 100);
      return () => clearInterval(iv);
    }
  }, []);

  useEffect(() => {
    if (!ready || !ref.current || !window.google?.accounts?.id) return;
    window.google.accounts.id.renderButton(ref.current, {
      type: 'standard', theme: 'outline', size: 'large',
      text: label, shape: 'pill', logo_alignment: 'left', width: 340,
    });
  }, [ready, label]);

  return (
    <div className="flex flex-col items-center w-full">
      <div ref={ref} className={`transition-opacity duration-300 ${ready ? 'opacity-100' : 'opacity-0'}`} />
      {!ready && <div className="w-[340px] h-[44px] rounded-full bg-white/5 border border-white/10 animate-pulse" />}
    </div>
  );
}

function InputField({
  icon: Icon, type = 'text', placeholder, value, onChange, rightElement,
  autoComplete,
}: {
  icon: React.ElementType; type?: string; placeholder: string;
  value: string; onChange: (v: string) => void;
  rightElement?: React.ReactNode; autoComplete?: string;
}) {
  return (
    <div className="relative flex items-center">
      <Icon size={16} className="absolute left-4 text-zinc-500 pointer-events-none" />
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        autoComplete={autoComplete}
        className="w-full bg-white/[0.04] border border-white/10 rounded-2xl pl-10 pr-12 py-4 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-white/10 focus:border-white/25 transition-all text-[15px]"
      />
      {rightElement && (
        <div className="absolute right-4">{rightElement}</div>
      )}
    </div>
  );
}

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>('login');
  // Login fields
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword]     = useState('');
  const [showPass, setShowPass]     = useState(false);
  // Signup field
  const [signupEmail, setSignupEmail] = useState('');
  // Shared
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  const switchMode = (m: Mode) => { setMode(m); setError(''); };

  // ── Manual login ──────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) return;
    setError(''); setLoading(true);
    try {
      const res = await api.post('/auth/login', { identifier: identifier.trim(), password });
      login(res.data.token, res.data.user);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally { setLoading(false); }
  };

  // ── Manual signup — email only ────────────────────────────────────────────
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupEmail.trim()) return;
    setError(''); setLoading(true);
    try {
      const res = await api.post('/auth/signup', { email: signupEmail.trim() });
      login(res.data.token, res.data.user);
      navigate('/onboarding', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Signup failed. Please try again.');
    } finally { setLoading(false); }
  };

  // ── Google credential callback ────────────────────────────────────────────
  const handleGoogleCredential = async (response: { credential: string }) => {
    setError(''); setLoading(true);
    try {
      const res = await api.post('/auth/google', { credential: response.credential });
      login(res.data.token, res.data.user);
      if (res.data.onboardingCompleted === false) {
        navigate('/onboarding', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Google sign-in failed. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.35, ease: 'easeOut' } }}
      exit={{ opacity: 0, transition: { duration: 0.25, ease: 'easeIn' } }}
      className="relative z-10 flex flex-col items-center justify-center min-h-screen p-6 w-full"
    >
      <button
        onClick={() => navigate('/')}
        className="absolute top-8 left-8 text-zinc-400 hover:text-white transition-all flex items-center gap-2 group"
      >
        <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
        Back to Home
      </button>

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.1, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md bg-black/70 backdrop-blur-[48px] border border-white/15 rounded-[40px] shadow-[0_50px_100px_-30px_rgba(0,0,0,1)] overflow-hidden"
      >

        {/* Mode toggle tabs */}
        <div className="flex border-b border-white/10">
          {(['login', 'signup'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={`flex-1 py-5 text-[14px] font-semibold tracking-wide transition-all capitalize
                ${mode === m
                  ? 'text-white border-b-2 border-white'
                  : 'text-zinc-500 hover:text-zinc-300'
                }`}
            >
              {m === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          ))}
        </div>

        <div className="p-10">
          {/* Icon */}
          <motion.div
            key={mode}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mb-6 w-14 h-14 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center mx-auto"
          >
            <Sparkles size={24} className="text-white" />
          </motion.div>

          <motion.h2
            key={`title-${mode}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-bold text-center text-white mb-2 tracking-tight"
          >
            {mode === 'login' ? 'Welcome back' : 'Join GYG'}
          </motion.h2>

          <motion.p
            key={`sub-${mode}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-zinc-500 text-center text-[14px] mb-8"
          >
            {mode === 'login'
              ? 'Sign in to continue your journey'
              : 'Create your account to get started'}
          </motion.p>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                key="err"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-rose-500/10 border border-rose-500/25 text-rose-400 text-sm rounded-2xl p-3.5 mb-5 text-center"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {/* ── LOGIN MODE ─────────────────────────────────── */}
            {mode === 'login' && (
              <motion.div
                key="login"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.2 }}
              >
                <form onSubmit={handleLogin} className="flex flex-col gap-4">
                  <InputField
                    icon={User}
                    placeholder="Username or Email"
                    value={identifier}
                    onChange={setIdentifier}
                    autoComplete="username"
                  />
                  <InputField
                    icon={Lock}
                    type={showPass ? 'text' : 'password'}
                    placeholder="Password"
                    value={password}
                    onChange={setPassword}
                    autoComplete="current-password"
                    rightElement={
                      <button type="button" onClick={() => setShowPass(p => !p)}
                        className="text-zinc-500 hover:text-white transition-colors">
                        {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    }
                  />

                  <button
                    type="submit"
                    disabled={loading || !identifier.trim() || !password}
                    className="mt-1 w-full bg-white text-black hover:bg-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-2xl py-4 font-bold text-[15px] transition-all active:scale-[0.98]"
                  >
                    {loading ? 'Signing in…' : 'Sign In'}
                  </button>
                </form>

                <Divider />
                <GoogleButton onCredential={handleGoogleCredential} label="continue_with" />
              </motion.div>
            )}

            {/* ── SIGNUP MODE ────────────────────────────────── */}
            {mode === 'signup' && (
              <motion.div
                key="signup"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.2 }}
              >
                <form onSubmit={handleSignup} className="flex flex-col gap-4">
                  <InputField
                    icon={Mail}
                    type="email"
                    placeholder="Email address"
                    value={signupEmail}
                    onChange={setSignupEmail}
                    autoComplete="email"
                  />

                  <button
                    type="submit"
                    disabled={loading || !signupEmail.trim()}
                    className="mt-1 w-full bg-white text-black hover:bg-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-2xl py-4 font-bold text-[15px] transition-all active:scale-[0.98]"
                  >
                    {loading ? 'Continuing…' : 'Continue with Email'}
                  </button>
                </form>

                <p className="text-zinc-500 text-[13px] text-center mt-3">
                  You'll set your username & password on the next step.
                </p>

                <Divider />
                <GoogleButton onCredential={handleGoogleCredential} label="signup_with" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Security badge */}
          <div className="mt-8 flex items-center justify-center gap-1.5 text-zinc-600 text-[12px]">
            <ShieldCheck size={13} />
            <span>Secured by Google OAuth 2.0 · No passwords stored for Google accounts</span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-3 my-6">
      <div className="flex-1 h-px bg-white/10" />
      <span className="text-zinc-600 text-[12px] font-medium">or</span>
      <div className="flex-1 h-px bg-white/10" />
    </div>
  );
}
