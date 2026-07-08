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

  // Sign-in is required for everything now (no guests). Room access is simply:
  // logged in -> allowed. This survives refresh and removes the fragile
  // sessionStorage verify flag left over from the guest era.
  const roomMatch = location.pathname.match(/\/room\/([A-Za-z0-9]+)/);
  const roomId = roomMatch?.[1];

  if (!isAuthenticated) {
    if (roomId) return <Navigate to={`/join/${roomId}`} replace />;
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
