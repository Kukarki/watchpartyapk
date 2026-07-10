import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider }    from '@/contexts/AuthContext.jsx';
import { SocketProvider }  from '@/contexts/SocketContext.jsx';
import { RoomProvider }    from '@/contexts/RoomContext.jsx';
import { FriendsProvider } from '@/contexts/FriendsContext.jsx';
import ProtectedRoute      from '@/components/layout/ProtectedRoute.jsx';
import ProfilePage         from '@/pages/ProfilePage.jsx';
import ErrorBoundary       from '@/components/layout/ErrorBoundary.jsx';
import LandingPage         from '@/pages/LandingPage.jsx';
import HomePage            from '@/pages/HomePage.jsx';
import JoinPage            from '@/pages/JoinPage.jsx';
import LoginPage           from '@/pages/LoginPage.jsx';
import AuthCallbackPage    from '@/pages/AuthCallbackPage.jsx';
import RoomPage            from '@/pages/RoomPage.jsx';
import MusicRoomPage       from '@/pages/MusicRoomPage.jsx';
import MusicPage           from '@/pages/MusicPage.jsx';
import PlaylistDetailPage  from '@/pages/PlaylistDetailPage.jsx';
import PlatformPage        from '@/pages/PlatformPage.jsx';
import FriendsPage         from '@/pages/FriendsPage.jsx';

export default function App() {
  return (
    <ErrorBoundary>
    <AuthProvider>
      <SocketProvider>
      <FriendsProvider>
        <Routes>
          {/* Public */}
          <Route path="/"                   element={<LandingPage />} />
          <Route path="/join"               element={<JoinPage />} />
          <Route path="/join/:roomId"       element={<JoinPage />} />
          <Route path="/login"              element={<LoginPage />} />
          <Route path="/auth/callback"      element={<AuthCallbackPage />} />
          <Route path="/platform/:platformId" element={<PlatformPage />} />

          {/* Protected */}
          <Route element={<ProtectedRoute />}>
            <Route path="/home" element={<HomePage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/friends" element={<FriendsPage />} />
            <Route path="/music" element={<MusicPage />} />
            <Route path="/music/playlist/:playlistId" element={<PlaylistDetailPage />} />
            <Route path="/music/shared/:shareCode" element={<PlaylistDetailPage />} />
            <Route
              path="/room/:roomId"
              element={
                <RoomProvider>
                  <RoomPage />
                </RoomProvider>
              }
            />
            <Route
              path="/music-room/:roomId"
              element={
                <RoomProvider>
                  <MusicRoomPage />
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
      </FriendsProvider>
      </SocketProvider>
    </AuthProvider>
    </ErrorBoundary>
  );
}