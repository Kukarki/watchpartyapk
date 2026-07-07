import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { roomApi } from '@/api/room.api.js';
import toast from 'react-hot-toast';

export default function LobbyPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [creating, setCreating] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!roomName.trim()) return;
    setCreating(true);
    try {
      const { room } = await roomApi.createRoom({ name: roomName, videoUrl });
      // Mark room as verified so ProtectedRoute doesn't redirect the creator
      // back to JoinPage (the creator doesn't need to re-enter their name)
      sessionStorage.setItem(`room_verified_${room.id}`, '1');
      navigate(`/room/${room.id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create room');
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = (e) => {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    // Go through JoinPage so the user confirms/sets their display name
    navigate(`/join/${code}`);
  };

  return (
    <div className="min-h-screen bg-void">
      {/* Top nav */}
      <nav className="border-b border-border bg-surface/50 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎬</span>
            <span className="font-display font-bold text-lg text-bright">
              Watch<span className="text-gradient">Party</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <img
                src={user?.avatar || `https://api.dicebear.com/8.x/avataaars/svg?seed=${encodeURIComponent(user?.displayName || 'guest')}`}
                alt={user?.displayName || 'User'}
                className="w-8 h-8 rounded-full border border-border bg-raised"
                onError={(e) => { e.target.src = `https://api.dicebear.com/8.x/avataaars/svg?seed=${encodeURIComponent(user?.displayName || 'guest')}`; }}
              />
              <span className="text-sub text-sm hidden sm:block">{user?.displayName}</span>
            </div>
            <button onClick={logout} className="btn-ghost text-xs px-3 py-1.5">
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="mb-12">
          <h1 className="font-display font-bold text-4xl text-bright mb-2">
            Good to see you, <span className="text-gradient">{user?.displayName}</span>
          </h1>
          <p className="text-sub">Start a new watch party or jump into an existing one.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Create Room */}
          <div className="card p-8 hover:border-amber/30 transition-colors duration-300">
            <div className="text-4xl mb-4">✨</div>
            <h2 className="font-display font-semibold text-xl text-bright mb-2">
              Create a Room
            </h2>
            <p className="text-sub text-sm mb-6">
              Host a watch party. Share the room code with friends.
            </p>

            {!showCreate ? (
              <button
                onClick={() => setShowCreate(true)}
                className="btn-primary"
              >
                Create Room
              </button>
            ) : (
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-sub text-xs font-mono uppercase tracking-widest mb-1.5">
                    Room Name *
                  </label>
                  <input
                    type="text"
                    className="input-base"
                    placeholder="Friday Night Movies"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    maxLength={50}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sub text-xs font-mono uppercase tracking-widest mb-1.5">
                    Video URL <span className="text-dim normal-case">(optional)</span>
                  </label>
                  <input
                    type="url"
                    className="input-base"
                    placeholder="https://example.com/video.mp4"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                  />
                </div>
                <div className="flex gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={creating || !roomName.trim()}
                    className="btn-primary flex-1 justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {creating ? 'Creating...' : 'Create →'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="btn-ghost border border-border"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Join Room */}
          <div className="card p-8 hover:border-amber/30 transition-colors duration-300">
            <div className="text-4xl mb-4">🔗</div>
            <h2 className="font-display font-semibold text-xl text-bright mb-2">
              Join a Room
            </h2>
            <p className="text-sub text-sm mb-6">
              Enter a room code to watch with friends.
            </p>

            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-sub text-xs font-mono uppercase tracking-widest mb-1.5">
                  Room Code
                </label>
                <input
                  type="text"
                  className="input-base font-mono uppercase tracking-widest text-lg"
                  placeholder="A1B2C3D4"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  maxLength={8}
                />
              </div>
              <button
                type="submit"
                disabled={!joinCode.trim()}
                className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Join Room →
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
