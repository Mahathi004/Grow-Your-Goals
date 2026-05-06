import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Hero() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const handleBegin = () => {
    if (isAuthenticated) navigate('/dashboard');
    else navigate('/auth');
  };

  return (
    <div className="relative z-10 flex flex-col items-center justify-center text-center px-6 pt-40 pb-48 w-full max-w-7xl mx-auto flex-1 h-full">
      <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-6xl tracking-tight leading-tight max-w-6xl font-medium text-white drop-shadow-lg">
        Turn Your Goals Into Measurable Progress
      </h1>
      
      <p className="text-zinc-300/80 text-base sm:text-lg max-w-3xl mt-6 leading-relaxed font-normal px-4">
        An AI-powered system that breaks your goals into actionable steps, tracks your <br className="hidden sm:block" />
        consistency, and predicts your success before you fall behind.
      </p>
      
      <div className="mt-12 animate-fade-rise-delay-2">
        <button 
          onClick={handleBegin}
          className="bg-[#050505]/40 backdrop-blur-sm border border-white/10 rounded-full px-14 py-4 text-[15px] tracking-wide text-white hover:bg-white/5 transition-all font-medium active:scale-95 shadow-2xl"
        >
          Begin Journey
        </button>
      </div>
    </div>
  )
}
