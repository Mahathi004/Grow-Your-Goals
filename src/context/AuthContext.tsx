import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import api from '../api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  authProvider?: string;
  onboardingCompleted?: boolean;
  current_streak?: number;
  longest_streak?: number;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
  refreshUser: () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser]         = useState<User | null>(null);
  const [token, setToken]       = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ── Refresh user profile from backend ────────────────────────────────────
  const refreshUser = useCallback(async () => {
    try {
      const [meRes, streakRes] = await Promise.all([
        api.get('/auth/me'),
        api.get('/user/streak'),
      ]);
      const updatedUser: User = { ...meRes.data, ...streakRes.data };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    } catch {
      // Silent
    }
  }, []);

  // ── Restore session on app startup ───────────────────────────────────────
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('token');
      const storedUser  = localStorage.getItem('user');

      if (storedToken && storedUser) {
        // Optimistic restore — feels instant
        setToken(storedToken);
        setUser(JSON.parse(storedUser));

        try {
          const localDate = new Date().toLocaleDateString('en-CA');
          await api.post('/user/checkin', { localDate });
          await refreshUser();
        } catch (err: any) {
          if (err?.response?.status === 401) {
            clearSession();
          }
        }
      }

      setIsLoading(false);
    };

    initAuth();
  }, [refreshUser]);

  // ── Login — called after any successful auth (signup, login, google) ──────
  const login = useCallback((newToken: string, newUser: User) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);

    // Non-critical background refresh
    if (newUser.onboardingCompleted) {
      const localDate = new Date().toLocaleDateString('en-CA');
      api.post('/user/checkin', { localDate })
        .then(() => refreshUser())
        .catch(() => {});
    }
  }, [refreshUser]);

  // ── Internal session clear ────────────────────────────────────────────────
  const clearSession = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    try {
      const email = user?.email;
      if (email && (window as any).google?.accounts?.id) {
        (window as any).google.accounts.id.revoke(email, () => {});
      }
    } catch { /* ignore */ }

    clearSession();
  }, [user]);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      login,
      logout,
      isAuthenticated: !!token,
      isLoading,
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
