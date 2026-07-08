import { createContext, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore.js';
import { userApi } from '@/api/user.api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { token, user, isAuthenticated, setAuth, logout: storeLogout } = useAuthStore();
  const navigate = useNavigate();

  const logout = useCallback(() => {
    storeLogout();
    navigate('/');
    toast.success('Logged out');
  }, [storeLogout, navigate]);

  return (
    <AuthContext.Provider value={{
      token, user, isAuthenticated,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}