import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';

export default function JoinPage() {
  const { roomId: paramRoomId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  // Pre-fill name if the user already has a session
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [roomCode, setRoomCode] = useState(paramRoomId || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Require sign-in. Send unauthenticated users to /login, remembering the room.
  useEffect(() => {
    if (!isAuthenticated) {
      const target = paramRoomId ? `/room/${paramRoomId}` : '/home';
      navigate('/login', { replace: true, state: { redirectTo: target, roomCode: paramRoomId || '' } });
    }
  }, [isAuthenticated]);

  const avatarSeed = displayName.trim() || 'Guest';
  const avatarUrl = `https://api.dicebear.com/8.x/avataaars/svg?seed=${encodeURIComponent(avatarSeed)}`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const name = displayName.trim();
    if (!name) {
      setError('Please enter your name');
      return;
    }
    setLoading(true);
    try {
      const code = roomCode.trim().toUpperCase();

      // Sign-in is required, so the user already has a session. Use it.
      if (!isAuthenticated) {
        navigate('/login', { replace: true, state: { roomCode: code } });
        return;
      }

      if (code) sessionStorage.setItem(`room_verified_${code}`, '1');
      navigate(code ? `/room/${code}` : '/home', { replace: true });
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-void flex flex-col items-center
                     justify-center px-4 py-8">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                      w-[600px] h-[400px] opacity-25 blur-[100px] rounded-full"
          style={{
            background:
              'radial-gradient(ellipse, rgba(245,166,35,0.3) 0%, transparent 70%)',
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-sm animate-slide-up">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🎬</div>
          <h1 className="font-display font-bold text-2xl text-bright">
            Watch<span className="text-gradient">Party</span>
          </h1>
          {paramRoomId ? (
            <div className="mt-3 space-y-1.5">
              <p className="text-sub text-sm">You've been invited!</p>
              <div className="inline-flex items-center gap-2 px-3 py-1.5
                               bg-amber/10 border border-amber/20 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse" />
                <span className="text-amber text-xs font-mono tracking-widest">
                  Room {paramRoomId}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sub text-sm mt-2">Enter your name to get started</p>
          )}
        </div>

        {/* Card */}
        <div className="card p-6 space-y-5">

          {/* Avatar row */}
          <div className="flex items-center gap-4 pb-4 border-b border-border">
            <div className="relative shrink-0">
              <img
                src={avatarUrl}
                alt="avatar"
                className="w-14 h-14 rounded-full border-2 border-amber/30 bg-raised"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full
                               bg-online border-2 border-surface" />
            </div>
            <div>
              <p className="text-bright text-sm font-medium">
                {displayName.trim() || 'Your name here'}
              </p>
              <p className="text-dim text-xs mt-0.5">
                {displayName.trim() ? 'Looking good! 👋' : 'Avatar updates as you type'}
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sub text-xs font-mono uppercase
                                 tracking-widest mb-2">
                Your Display Name
              </label>
              <input
                type="text"
                className="input-base"
                placeholder="e.g. MovieNerd42"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={30}
                autoFocus
                disabled={loading}
              />
            </div>

            {!paramRoomId && (
              <div>
                <label className="block text-sub text-xs font-mono uppercase
                                   tracking-widest mb-2">
                  Room Code{' '}
                  <span className="text-dim normal-case">(optional)</span>
                </label>
                <input
                  type="text"
                  className="input-base font-mono uppercase tracking-widest"
                  placeholder="A1B2C3D4"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  maxLength={8}
                  disabled={loading}
                />
              </div>
            )}

            {error && (
              <p className="text-danger text-xs bg-danger/10 border border-danger/20
                             rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !displayName.trim()}
              className="btn-primary w-full justify-center py-3 text-sm
                          disabled:opacity-40 disabled:cursor-not-allowed
                          disabled:shadow-none"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-void/40
                                    border-t-void rounded-full animate-spin" />
                  {paramRoomId ? 'Joining...' : 'Setting up...'}
                </span>
              ) : paramRoomId ? (
                'Join the Party →'
              ) : roomCode ? (
                'Join Room →'
              ) : (
                'Enter Lobby →'
              )}
            </button>

            <p className="text-center text-dim text-xs">
              Signed in · Ready to watch
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}