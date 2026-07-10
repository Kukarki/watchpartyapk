import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '@/components/layout/AppShell.jsx';
import { roomApi } from '@/api/room.api.js';
import { playlistApi } from '@/api/playlist.api.js';
import { historyApi } from '@/api/history.api.js';
import { parseVideoUrl } from '@/utils/videoUtils.js';
import toast from 'react-hot-toast';

function timeAgo(iso) {
  if (!iso) return '';
  const secs = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export default function MusicPage() {
  const navigate = useNavigate();

  const [roomName, setRoomName] = useState('');
  const [creating, setCreating] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(true);
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    playlistApi.list().then((d) => setPlaylists(d.playlists || [])).catch(() => {}).finally(() => setLoadingPlaylists(false));
    historyApi.list(10).then((d) => setHistory(d.history || [])).catch(() => {});
  }, []);

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    const name = roomName.trim() || 'Listening Party';
    setCreating(true);
    try {
      const { room } = await roomApi.createRoom({ name, roomType: 'music' });
      navigate(`/music-room/${room.id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create room');
    } finally {
      setCreating(false);
    }
  };

  const handleCreatePlaylist = async () => {
    setCreatingPlaylist(true);
    try {
      const { playlist } = await playlistApi.create('My Playlist');
      navigate(`/music/playlist/${playlist.id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create playlist');
    } finally {
      setCreatingPlaylist(false);
    }
  };

  return (
    <AppShell>
      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-10 animate-slide-up">
          <h1 className="font-display font-bold text-3xl sm:text-4xl text-bright mb-2">
            <span className="text-gradient">Music</span> Together
          </h1>
          <p className="text-sub">Start a listening party, build playlists, and hop on voice with friends.</p>
        </div>

        {/* Start a listening party */}
        <div className="card p-8 mb-8 hover:border-amber/30 transition-colors duration-300 animate-slide-up"
             style={{ animationDelay: '0.05s' }}>
          <div className="text-4xl mb-4">🎧</div>
          <h2 className="font-display font-semibold text-xl text-bright mb-2">Start a Listening Party</h2>
          <p className="text-sub text-sm mb-6">Voice chat + synced playback + a shared queue, live with friends.</p>
          <form onSubmit={handleCreateRoom} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              className="input-base flex-1"
              placeholder="Friday Night Mix"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              maxLength={50}
            />
            <button type="submit" disabled={creating}
                    className="btn-primary shrink-0 disabled:opacity-40 disabled:cursor-not-allowed">
              {creating ? 'Starting...' : 'Start Party →'}
            </button>
          </form>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          {/* Playlists */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-bright text-base">Your Playlists</h2>
              <button onClick={handleCreatePlaylist} disabled={creatingPlaylist}
                      className="btn-ghost text-xs px-2.5 py-1 disabled:opacity-40">
                + New
              </button>
            </div>
            {loadingPlaylists ? (
              <div className="flex items-center gap-2 text-dim text-xs">
                <span className="w-3 h-3 border-2 border-amber/30 border-t-amber rounded-full animate-spin" />
                Loading…
              </div>
            ) : playlists.length === 0 ? (
              <p className="text-dim text-xs">No playlists yet — create one to start collecting tracks.</p>
            ) : (
              <div className="space-y-1">
                {playlists.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => navigate(`/music/playlist/${p.id}`)}
                    className="w-full flex items-center gap-3 px-2 py-2 -mx-2 rounded-lg
                               hover:bg-raised transition-colors text-left group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-amber/10 border border-amber/20
                                     flex items-center justify-center text-sm shrink-0">
                      🎵
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-bright truncate">{p.name}</p>
                      <p className="text-xs text-dim">
                        {p.trackCount ?? 0} track{p.trackCount === 1 ? '' : 's'}
                        {p.isPublic ? ' · Shared' : ''}
                      </p>
                    </div>
                    <span className="text-dim text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                      Open →
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Recently played */}
          <div className="card p-6">
            <h2 className="font-display font-semibold text-bright text-base mb-4">Recently Played</h2>
            {history.length === 0 ? (
              <p className="text-dim text-xs">Tracks you play in a listening party will show up here.</p>
            ) : (
              <div className="space-y-1">
                {history.map((h) => {
                  const parsed = parseVideoUrl(h.url);
                  return (
                    <div key={h.id} className="flex items-center gap-3 px-2 py-2 -mx-2">
                      <div className="w-8 h-8 rounded-lg bg-raised border border-border
                                       flex items-center justify-center text-sm shrink-0">
                        🎧
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-bright truncate">{h.title}</p>
                        <p className="text-xs text-dim">
                          {parsed.type === 'youtube' ? 'YouTube' : 'Track'} · {timeAgo(h.playedAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Connect accounts — coming soon */}
        <div className="card p-6 animate-slide-up" style={{ animationDelay: '0.15s' }}>
          <h2 className="font-display font-semibold text-bright text-base mb-1">Connect Your Music</h2>
          <p className="text-dim text-xs mb-4">Link your account to show friends what you're listening to.</p>
          <div className="flex flex-wrap gap-3">
            <button disabled title="Coming soon"
                    className="btn-ghost border border-border text-sm px-4 py-2 opacity-50 cursor-not-allowed">
              🟢 Connect Spotify — coming soon
            </button>
            <button disabled title="Coming soon"
                    className="btn-ghost border border-border text-sm px-4 py-2 opacity-50 cursor-not-allowed">
              ▶️ Connect YouTube Music — coming soon
            </button>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
