import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../api';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      if (isLogin) {
        const res = await api.post('/auth/login', { email, password });
        login(res.data.token, res.data.user);
        navigate('/dashboard');
      } else {
        const res = await api.post('/auth/signup', { email, password, firstName, lastName });
        login(res.data.token, res.data.user);
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Authentication failed');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.02 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="relative z-10 flex flex-col items-center justify-center min-h-screen p-6 w-full"
    >
      {/* Back button */}
      <button 
        onClick={() => navigate('/')}
        className="absolute top-8 left-8 text-zinc-400 hover:text-white transition-all flex items-center gap-2 group"
      >
        <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
        Back to Home
      </button>

      {/* Auth Card - Darker for better readability */}
      <div className="w-full max-w-md bg-black/70 backdrop-blur-[48px] border border-white/15 p-12 rounded-[40px] animate-fade-rise shadow-[0_50px_100px_-30px_rgba(0,0,0,1)]">
        <h2 className="text-4xl font-bold text-center mb-10 tracking-tight text-white leading-tight">
          {isLogin ? 'Welcome Back' : 'Join GYG'}
        </h2>
        
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm font-medium rounded-2xl p-4 mb-8 text-center animate-shake">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {!isLogin && (
            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="block text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2.5 ml-1">First Name</label>
                <input 
                  type="text" 
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 transition-all text-[15px]"
                  placeholder="John"
                />
              </div>
              <div>
                <label className="block text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2.5 ml-1">Last Name</label>
                <input 
                  type="text" 
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 transition-all text-[15px]"
                  placeholder="Doe"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2.5 ml-1">Email Address</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 transition-all text-[15px]"
              placeholder="you@email.com"
            />
          </div>

          <div className="relative">
            <label className="block text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2.5 ml-1">Password</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 transition-all pr-14 text-[15px]"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
              </button>
            </div>
          </div>
          
          <button 
            type="submit" 
            className="mt-6 bg-white text-black hover:bg-zinc-200 rounded-2xl px-6 py-5 transition-all duration-300 font-black text-[17px] active:scale-[0.98] shadow-xl shadow-white/5"
          >
            {isLogin ? 'Sign In Now' : 'Create My Account'}
          </button>
        </form>

        <div className="mt-10 text-center text-[15px]">
          <span className="text-zinc-500">{isLogin ? "New to GYG? " : "Joined before? "}</span>
          <button 
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-white font-black hover:text-blue-400 transition-colors ml-1 underline underline-offset-8"
          >
            {isLogin ? 'Sign Up Free' : 'Sign In'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

