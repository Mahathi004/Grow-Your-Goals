import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { AuthProvider } from './context/AuthContext';
import { GoalProvider } from './context/GoalContext';
import HomePage from './pages/HomePage';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import DashboardLayout from './components/DashboardLayout';
import './index.css';

import { 
  RoadmapPage, 
  ProgressPage, 
  SettingsPage,
  CalendarPage
} from './pages/ProductPages';

function AnimatedRoutes() {
  const location = useLocation();
  
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<HomePage />} />
        <Route path="/auth" element={<AuthPage />} />
        
        {/* All Sidebar Driven Pages */}
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/roadmap" element={<RoadmapPage />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
        </Route>
      </Routes>
    </AnimatePresence>
  );
}

function AppContent() {
  const location = useLocation();
  const isVideoBgPage = ['/', '/auth'].includes(location.pathname);

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-background text-foreground font-body flex flex-col">
      {/* Background Video - Only for Home and Auth */}
      {isVideoBgPage && (
        <video
          autoPlay
          loop
          muted
          playsInline
          className="fixed inset-0 w-full h-full object-cover z-0 opacity-80 pointer-events-none"
        >
          <source
            src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4"
            type="video/mp4"
          />
        </video>
      )}

      <AnimatedRoutes />
    </main>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <GoalProvider>
          <AppContent />
        </GoalProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

