import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider }    from '@/contexts/AuthContext.jsx';
import { SocketProvider }  from '@/contexts/SocketContext.jsx';
import { RoomProvider }    from '@/contexts/RoomContext.jsx';
import ProtectedRoute      from '@/components/layout/ProtectedRoute.jsx';
import ErrorBoundary       from '@/components/layout/ErrorBoundary.jsx';
import HomePage            from '@/pages/HomePage.jsx';
import JoinPage            from '@/pages/JoinPage.jsx';
import LoginPage           from '@/pages/LoginPage.jsx';
import AuthCallbackPage    from '@/pages/AuthCallbackPage.jsx';
import RoomPage            from '@/pages/RoomPage.jsx';
import LobbyPage           from '@/pages/LobbyPage.jsx';
import PlatformPage        from '@/pages/PlatformPage.jsx';

export default function App() {
  return (
    <ErrorBoundary>
    <AuthProvider>
      <SocketProvider>
        <Routes>
          {/* Public */}
          <Route path="/"                   element={<HomePage />} />
          <Route path="/join"               element={<JoinPage />} />
          <Route path="/join/:roomId"       element={<JoinPage />} />
          <Route path="/login"              element={<LoginPage />} />
          <Route path="/auth/callback"      element={<AuthCallbackPage />} />
          <Route path="/platform/:platformId" element={<PlatformPage />} />

          {/* Protected */}
          <Route element={<ProtectedRoute />}>
            <Route path="/lobby" element={<LobbyPage />} />
            <Route
              path="/room/:roomId"
              element={
                <RoomProvider>
                  <RoomPage />
                </RoomProvider>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background:  '#0e1118',
              color:       '#c8d6f0',
              border:      '1px solid #1e2433',
              fontFamily:  'DM Sans, sans-serif',
              fontSize:    '14px',
            },
            success: { iconTheme: { primary: '#f5a623', secondary: '#080a0f' } },
            error:   { iconTheme: { primary: '#ff4757', secondary: '#080a0f' } },
          }}
        />
      </SocketProvider>
    </AuthProvider>
    </ErrorBoundary>
  );
}