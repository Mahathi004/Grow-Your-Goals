import { Loader2 } from 'lucide-react';
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  isLoading?: boolean;
}

export const Button = ({ variant = 'primary', isLoading, children, className = '', disabled, ...props }: ButtonProps) => {
  const baseStyle = "relative inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.2)] hover:shadow-[0_0_25px_rgba(37,99,235,0.4)] border border-blue-500/50",
    secondary: "bg-white/5 hover:bg-white/10 text-white border border-white/10",
    danger: "bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20",
    ghost: "bg-transparent hover:bg-white/5 text-zinc-400 hover:text-white"
  };

  return (
    <button 
      className={`${baseStyle} ${variants[variant]} ${className} ${isLoading ? 'text-transparent' : ''}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center text-current">
          <Loader2 size={16} className="animate-spin" />
        </div>
      )}
      <span className={isLoading ? 'invisible' : 'flex items-center gap-2'}>{children}</span>
    </button>
  );
};

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { label: string, error?: string }>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5 w-full">
        <label className="text-[11px] font-black uppercase tracking-widest text-zinc-500">{label}</label>
        <input 
          ref={ref}
          className={`w-full bg-black/40 border ${error ? 'border-rose-500/50 focus:border-rose-500' : 'border-white/10 focus:border-blue-500/50'} rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all ${className}`}
          {...props}
        />
        {error && <span className="text-xs font-bold text-rose-500 mt-1">{error}</span>}
      </div>
    );
  }
);
Input.displayName = 'Input';

export const Toggle = ({ checked, onChange, label, description }: { checked: boolean, onChange: (v: boolean) => void, label?: string, description?: string }) => {
  return (
    <div className="flex items-center justify-between gap-4 cursor-pointer" onClick={() => onChange(!checked)}>
      {(label || description) && (
        <div className="flex flex-col">
          {label && <span className="text-sm font-bold text-white">{label}</span>}
          {description && <span className="text-xs text-zinc-500 mt-0.5">{description}</span>}
        </div>
      )}
      <div className={`relative w-11 h-6 rounded-full transition-colors duration-300 ease-in-out shrink-0 ${checked ? 'bg-blue-600' : 'bg-white/10'}`}>
        <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform duration-300 ease-in-out shadow-sm ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </div>
    </div>
  );
};

export const Card = ({ children, className = '', title, description }: { children: React.ReactNode, className?: string, title?: string, description?: string }) => {
  return (
    <div className={`bg-zinc-900/30 backdrop-blur-md border border-white/5 rounded-3xl p-8 shadow-2xl relative overflow-hidden group ${className}`}>
      {/* Subtle hover gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      
      {(title || description) && (
        <div className="mb-8 relative z-10 border-b border-white/5 pb-6">
          {title && <h2 className="text-2xl font-black text-white tracking-tight">{title}</h2>}
          {description && <p className="text-zinc-500 text-sm mt-2">{description}</p>}
        </div>
      )}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};
