import { useState, useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore.js';

export default function ProtectedRoute() {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();

  const [hydrated, setHydrated] = useState(() => useAuthStore.persist.hasHydrated());

  useEffect(() => {
    const syncHydration = () => setHydrated(useAuthStore.persist.hasHydrated());
    syncHydration();

    return useAuthStore.persist.onFinishHydration(syncHydration);
  }, []);

  const ready = hydrated || isAuthenticated;

  if (!ready) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-amber/30 border-t-amber
                        rounded-full animate-spin" />
      </div>
    );
  }

  // Always prompt for a display name when entering a room, so invite-link guests
  // always see the join screen. We use sessionStorage to avoid re-prompting on
  // simple page refreshes — the flag is cleared when the tab/browser closes.
  const roomMatch = location.pathname.match(/\/room\/([A-Za-z0-9]+)/);
  const roomId = roomMatch?.[1];
  if (roomId) {
    const verified = sessionStorage.getItem(`room_verified_${roomId}`);
    if (!verified) {
      return <Navigate to={`/join/${roomId}`} replace />;
    }
  }

  if (!isAuthenticated) {
    if (roomId) return <Navigate to={`/join/${roomId}`} replace />;
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
