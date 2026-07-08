import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { roomApi } from '@/api/room.api.js';
import { useFriendsStore } from '@/store/friendsStore.js';
import AppShell from '@/components/layout/AppShell.jsx';
import Avatar from '@/components/ui/Avatar.jsx';
import toast from 'react-hot-toast';

export const PLATFORMS = [
  {
    id: 'primevideo',
    name: 'Prime Video',
    logo: '/logos/primevideo.svg',
    borderColor: '#00A8E1',
    glowColor: 'rgba(0,168,225,0.15)',
    bgFrom: 'rgba(0,168,225,0.08)',
    bgTo: 'rgba(0,48,135,0.08)',
    dot: '#00A8E1',
    url: 'https://www.primevideo.com',
    signupUrl: 'https://www.amazon.com/amazonprime',
    description: 'Thousands of movies & shows',
    invertLogo: false,
  },
  {
    id: 'netflix',
    name: 'Netflix',
    logo: '/logos/netflix.svg',
    borderColor: '#E50914',
    glowColor: 'rgba(229,9,20,0.15)',
    bgFrom: 'rgba(229,9,20,0.08)',
    bgTo: 'rgba(131,16,16,0.08)',
    dot: '#E50914',
    url: 'https://www.netflix.com',
    signupUrl: 'https://www.netflix.com/signup',
    description: 'Award-winning series & films',
    invertLogo: false,
  },
  {
    id: 'disneyplus',
    name: 'Disney+',
    logo: '/logos/disneyplus.svg',
    borderColor: '#0063E5',
    glowColor: 'rgba(0,99,229,0.15)',
    bgFrom: 'rgba(0,99,229,0.08)',
    bgTo: 'rgba(4,7,20,0.3)',
    dot: '#0063E5',
    url: 'https://www.disneyplus.com',
    signupUrl: 'https://www.disneyplus.com/welcome',
    description: 'Disney, Marvel, Star Wars & more',
    invertLogo: false,
  },
  {
    id: 'youtube',
    name: 'YouTube',
    logo: '/logos/youtube.svg',
    borderColor: '#FF0000',
    glowColor: 'rgba(255,0,0,0.15)',
    bgFrom: 'rgba(255,0,0,0.08)',
    bgTo: 'rgba(40,40,40,0.3)',
    dot: '#FF0000',
    url: 'https://www.youtube.com',
    signupUrl: 'https://www.youtube.com',
    description: 'Free videos, no subscription',
    invertLogo: false,
  },
  {
    id: 'max',
    name: 'Max',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/1/17/HBO_Max_Logo.svg',
    borderColor: '#002BE7',
    glowColor: 'rgba(0,43,231,0.15)',
    bgFrom: 'rgba(0,43,231,0.08)',
    bgTo: 'rgba(0,7,61,0.3)',
    dot: '#002BE7',
    url: 'https://www.max.com',
    signupUrl: 'https://www.max.com/plans',
    description: 'HBO originals & blockbusters',
    invertLogo: true,
  },
  {
    id: 'appletv',
    name: 'Apple TV+',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg',
    borderColor: '#555555',
    glowColor: 'rgba(255,255,255,0.08)',
    bgFrom: 'rgba(255,255,255,0.05)',
    bgTo: 'rgba(255,255,255,0.01)',
    dot: '#ffffff',
    url: 'https://tv.apple.com',
    signupUrl: 'https://tv.apple.com',
    description: 'Apple originals & exclusives',
    invertLogo: true,
  },
];

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { friends, onlineFriendIds } = useFriendsStore();

  const [imgErrors, setImgErrors] = useState({});
  const [hovered, setHovered] = useState(null);
  const [joinCode, setJoinCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const handlePlatformClick = (platformId) => navigate(`/platform/${platformId}`);
  const handleImgError = (id) => setImgErrors((prev) => ({ ...prev, [id]: true }));

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!roomName.trim()) return;
    setCreating(true);
    try {
      const { room } = await roomApi.createRoom({ name: roomName, videoUrl });
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
    navigate(`/join/${code}`);
  };

  const onlineSet = new Set(onlineFriendIds);
  const onlineFriends = friends.filter((f) => onlineSet.has(f.userId)).slice(0, 6);

  return (
    <AppShell>
      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="mb-10 animate-slide-up">
          <h1 className="font-display font-bold text-3xl sm:text-4xl text-bright mb-2">
            Good to see you, <span className="text-gradient">{user?.displayName}</span>
          </h1>
          <p className="text-sub">Start a new watch party or jump into an existing one.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8 animate-slide-up" style={{ animationDelay: '0.05s' }}>
          {/* Create Room */}
          <div className="card p-8 hover:border-amber/30 transition-colors duration-300">
            <div className="text-4xl mb-4">✨</div>
            <h2 className="font-display font-semibold text-xl text-bright mb-2">Create a Room</h2>
            <p className="text-sub text-sm mb-6">Host a watch party. Share the room code with friends.</p>

            {!showCreate ? (
              <button onClick={() => setShowCreate(true)} className="btn-primary">
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
            <h2 className="font-display font-semibold text-xl text-bright mb-2">Join a Room</h2>
            <p className="text-sub text-sm mb-6">Enter a room code to watch with friends.</p>

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

        <div className="grid md:grid-cols-2 gap-6 mb-10 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          {/* Friends online strip */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-bright text-base">Friends Online</h2>
              <button onClick={() => navigate('/friends')} className="text-amber text-xs hover:underline">
                See all →
              </button>
            </div>
            {onlineFriends.length === 0 ? (
              <p className="text-dim text-xs">No friends online right now.</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {onlineFriends.map((f) => (
                  <div key={f.userId} className="flex items-center gap-2">
                    <div className="relative shrink-0">
                      <Avatar src={f.avatar} name={f.displayName} size="sm" />
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full
                                         border-2 border-surface bg-online" />
                    </div>
                    <span className="text-xs text-sub">{f.displayName}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent rooms — placeholder */}
          <div className="card p-6">
            <h2 className="font-display font-semibold text-bright text-base mb-4">Recent Rooms</h2>
            <p className="text-dim text-xs">Coming soon — your recently visited rooms will show up here.</p>
          </div>
        </div>

        <h2 className="font-display font-bold text-bright text-xl mb-1">
          Choose What to Watch
        </h2>
        <p className="text-dim text-xs mb-5">
          Pick a platform to start a synced session.
        </p>

        {/* Platform grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full mb-4 animate-slide-up"
             style={{ animationDelay: '0.15s' }}>
          {PLATFORMS.map((platform) => (
            <div
              key={platform.id}
              onClick={() => handlePlatformClick(platform.id)}
              onMouseEnter={() => setHovered(platform.id)}
              onMouseLeave={() => setHovered(null)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && handlePlatformClick(platform.id)}
              className="relative group p-6 text-left flex flex-col gap-4
                           rounded-xl border cursor-pointer
                           transition-all duration-300
                           hover:-translate-y-1 active:scale-[0.98]"
              style={{
                background: `linear-gradient(135deg, ${platform.bgFrom}, ${platform.bgTo})`,
                borderColor: hovered === platform.id ? platform.borderColor : 'rgba(30,36,51,1)',
                boxShadow: hovered === platform.id ? `0 0 32px ${platform.glowColor}` : 'none',
              }}
            >
              {/* Logo */}
              <div className="h-8 flex items-center">
                {imgErrors[platform.id] ? (
                  <span className="font-display font-bold text-bright text-base">
                    {platform.name}
                  </span>
                ) : (
                  <img
                    src={platform.logo}
                    alt={platform.name}
                    className="h-full w-auto object-contain max-w-[130px] transition-all duration-300"
                    style={{
                      filter: platform.invertLogo ? 'invert(1) brightness(0.9)' : 'brightness(0.9)',
                      ...(hovered === platform.id && {
                        filter: platform.invertLogo ? 'invert(1) brightness(1.1)' : 'brightness(1.1)',
                      }),
                    }}
                    onError={() => handleImgError(platform.id)}
                  />
                )}
              </div>

              {/* Description */}
              <p className="text-dim text-xs leading-relaxed hidden sm:block">
                {platform.description}
              </p>

              {/* Bottom row */}
              <div className="flex items-center justify-between mt-auto">
                <span className="w-2 h-2 rounded-full opacity-60"
                      style={{ backgroundColor: platform.dot }} />
                <span className="text-xs text-dim group-hover:text-sub
                                  transition-colors flex items-center gap-1">
                  Watch together
                  <span className="group-hover:translate-x-0.5 transition-transform inline-block">→</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </main>
    </AppShell>
  );
}
