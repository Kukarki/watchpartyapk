import { createContext, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore.js';
import { userApi } from '@/api/user.api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { token, user, isAuthenticated, setAuth, logout: storeLogout } = useAuthStore();
  const navigate = useNavigate();

  /**
   * guestLogin — get a fresh token and SET it atomically.
   * Never clears the old token first — that would disconnect the socket.
   * The socket reconnects automatically when the token changes.
   */
  const guestLogin = useCallback(async (displayName) => {
    try {
      const data = await userApi.guestLogin(displayName);
      // setAuth replaces old token in one atomic update
      setAuth(data.token, data.user);
      return data;
    } catch (err) {
      const msg = err.response?.data?.error || 'Login failed';
      toast.error(msg);
      throw err;
    }
  }, [setAuth]);

  const logout = useCallback(() => {
    storeLogout();
    navigate('/');
    toast.success('Logged out');
  }, [storeLogout, navigate]);

  return (
    <AuthContext.Provider value={{
      token, user, isAuthenticated,
      guestLogin, logout,
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