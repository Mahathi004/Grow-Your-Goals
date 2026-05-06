import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Target, 
  BarChart3, 
  Settings,
  LogOut
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

const DashboardSidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [isExpanded, setIsExpanded] = useState(() => {
    const saved = localStorage.getItem('sidebarExpanded');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem('sidebarExpanded', JSON.stringify(isExpanded));
    window.dispatchEvent(new Event('sidebarToggle'));
  }, [isExpanded]);

  const handleIconClick = (path: string) => {
    navigate(path);
  };

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const navItems = [
    { icon: <LayoutDashboard size={20} />, label: "Dashboard", path: "/dashboard" },
    { icon: <Target size={20} />, label: "Roadmap", path: "/roadmap" },
    { icon: <BarChart3 size={20} />, label: "Progress", path: "/progress" },
    { icon: <Settings size={20} />, label: "Settings", path: "/settings" },
  ];

  return (
    <motion.aside 
      initial={false}
      animate={{ width: isExpanded ? 280 : 70 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="fixed left-0 top-0 bottom-0 bg-[#000000]/60 backdrop-blur-3xl border-r border-white/5 flex flex-col items-start py-6 z-50 overflow-hidden"
    >
      <div 
        className="px-4 mb-10 w-full flex items-center cursor-pointer group"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="relative flex items-center justify-center min-w-[38px] h-10 rounded-xl bg-white/[0.03] border border-white/10 backdrop-blur-md group-hover:bg-white/[0.05] transition-all duration-500 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <svg width="22" height="22" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white transition-transform duration-500 group-hover:scale-110 group-hover:rotate-12 relative z-10">
            <path d="M30.5 7.5C27.85 5.11 24.18 4 20 4C11.16 4 4 11.16 4 20C4 28.84 11.16 36 20 36C28.84 36 36 28.84 36 20H20" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M20 12L28 20L20 28" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        
        <AnimatePresence>
          {isExpanded && (
            <motion.span 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="ml-3 font-black text-xl text-white tracking-tighter whitespace-nowrap bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60"
            >
              Grow Your Goals
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <nav className="flex flex-col gap-2 w-full px-3 flex-1 overflow-y-auto custom-scrollbar">
        {navItems.map((item, idx) => (
          <NavItem 
            key={idx}
            icon={item.icon} 
            label={item.label} 
            active={location.pathname === item.path}
            isExpanded={isExpanded}
            onClick={() => handleIconClick(item.path)} 
          />
        ))}
      </nav>

      <div className="mt-auto w-full px-3 flex flex-col gap-4">
        <div className="flex items-center justify-between p-1 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/5 transition-all group">
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0">
              <div className="w-9 h-9 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center overflow-hidden group-hover:border-white/20 transition-all">
                <div className="w-full h-full bg-gradient-to-b from-blue-600/50 to-indigo-900/50 flex items-center justify-center text-xs font-bold text-white">
                  {user?.firstName?.[0] || 'U'}
                </div>
              </div>
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-[#000000]"></div>
            </div>
            
            <AnimatePresence>
              {isExpanded && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="flex flex-col overflow-hidden"
                >
                  <span className="text-sm font-medium text-white whitespace-nowrap">{user?.firstName || 'User'}</span>
                  <span className="text-[11px] text-zinc-500 whitespace-nowrap">Free Tier</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {isExpanded && (
            <button 
              onClick={handleLogout}
              className="p-2 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          )}
        </div>
      </div>
    </motion.aside>
  );
};

interface NavItemProps {
  icon: React.ReactNode;
  active?: boolean;
  label: string;
  isExpanded: boolean;
  onClick?: () => void;
}

const NavItem = ({ icon, active = false, label, isExpanded, onClick }: NavItemProps) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div className="relative flex items-center">
      <button 
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`w-full h-11 flex items-center rounded-xl transition-all duration-300 relative group
        ${isExpanded ? 'px-3' : 'justify-center'}
        ${active 
          ? 'bg-white/10 text-white shadow-lg shadow-white/5' 
          : 'text-zinc-500 hover:text-white hover:bg-white/[0.04]'}`}
      >
        {active && (
          <motion.div 
            layoutId="activeGlow"
            className="absolute inset-0 bg-blue-500/10 rounded-xl blur-md -z-10"
          />
        )}

        <motion.div 
          whileHover={{ scale: 1.1 }}
          transition={{ type: "spring", stiffness: 400, damping: 10 }}
          className="flex-shrink-0"
        >
          {icon}
        </motion.div>

        <AnimatePresence>
          {isExpanded && (
            <motion.span 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="ml-3 text-sm font-medium whitespace-nowrap"
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>

        {active && (
          <motion.div 
            layoutId="activeLine"
            className="absolute left-0 w-1 h-5 bg-white rounded-full ml-1"
          />
        )}
      </button>

      <AnimatePresence>
        {!isExpanded && isHovered && (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 20 }}
            exit={{ opacity: 0, x: 10 }}
            className="fixed left-12 px-3 py-1.5 bg-[#151515] border border-white/10 text-white text-xs font-medium rounded-lg shadow-xl pointer-events-none z-[100] whitespace-nowrap"
          >
            {label}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DashboardSidebar;
