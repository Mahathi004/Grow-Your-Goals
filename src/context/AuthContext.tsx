import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import api from '../api';

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const res = await api.get('/auth/me');
      const streakRes = await api.get('/user/streak');
      const updatedUser = { ...res.data, ...streakRes.data };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    } catch (err) {
      // Silent catch or handle appropriately
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        
        try {
          // Perform checkin first to update streaks if needed
          const localDate = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
          await api.post('/user/checkin', { localDate });
          // Then refresh user data
          await refreshUser();
        } catch (err) {
          // Silent catch or handle appropriately
          if ((err as any).response?.status === 401) {
            logout();
          }
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    // After login, trigger checkin
    const localDate = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
    api.post('/user/checkin', { localDate }).then(() => refreshUser());
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token, isLoading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
