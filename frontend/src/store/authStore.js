import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,

      setAuth: (token, user) =>
        set({ token, user, isAuthenticated: true }),

      logout: () =>
        set({ token: null, user: null, isAuthenticated: false }),

      updateUser: (updates) =>
        set((state) => ({ user: { ...state.user, ...updates } })),
    }),
    {
      name: 'watchparty-auth',
      partialize: (state) => ({ token: state.token, user: state.user }),
      merge: (persisted, current) => ({
        ...current,
        ...persisted,
        isAuthenticated: !!(persisted?.token && persisted?.user),
      }),
    }
  )
);
