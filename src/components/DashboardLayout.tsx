import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import DashboardSidebar from './DashboardSidebar';
import DashboardGradient from './DashboardGradient';
import GlobalHeader from './GlobalHeader';

export default function DashboardLayout() {
  const location = useLocation();
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(() => {
    const saved = localStorage.getItem('sidebarExpanded');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    const handleSidebarToggle = () => {
      const saved = localStorage.getItem('sidebarExpanded');
      setIsSidebarExpanded(saved ? JSON.parse(saved) : false);
    };

    window.addEventListener('sidebarToggle', handleSidebarToggle);
    return () => window.removeEventListener('sidebarToggle', handleSidebarToggle);
  }, []);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-background text-foreground font-body flex flex-col">
      <DashboardGradient />
      {location.pathname === '/dashboard' && <GlobalHeader />}
      <DashboardSidebar />
      
      <motion.main 
        animate={{ paddingLeft: isSidebarExpanded ? 280 : 70 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="flex-1 overflow-y-auto custom-scrollbar relative z-20 w-full"
      >
        <Outlet />
      </motion.main>
    </div>
  );
}
