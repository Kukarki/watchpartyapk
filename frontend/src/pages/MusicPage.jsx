import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '@/components/layout/AppShell.jsx';
import { roomApi } from '@/api/room.api.js';
import { playlistApi } from '@/api/playlist.api.js';
import { historyApi } from '@/api/history.api.js';
import { spotifyApi } from '@/api/spotify.api.js';
import { youtubeApi } from '@/api/youtube.api.js';
import { parseVideoUrl } from '@/utils/videoUtils.js';
import MusicSearch from '@/components/music/MusicSearch.jsx';
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
  const [spotify, setSpotify] = useState(null); // null = loading, else { connected, isPlaying, track }
  const [connectingSpotify, setConnectingSpotify] = useState(false);
  const [youtube, setYoutube] = useState(null); // null = loading, else { connected, playlists }
  const [connectingYoutube, setConnectingYoutube] = useState(false);
  const [importingYtPlaylist, setImportingYtPlaylist] = useState(null);
  const [addedVideoIds, setAddedVideoIds] = useState(new Set());

  const refreshPlaylists = () => playlistApi.list().then((d) => setPlaylists(d.playlists || [])).catch(() => {});

  useEffect(() => {
    refreshPlaylists().finally(() => setLoadingPlaylists(false));
    historyApi.list(10).then((d) => setHistory(d.history || [])).catch(() => {});

    const loadSpotify = () => spotifyApi.getNowPlaying().then(setSpotify).catch(() => setSpotify({ connected: false }));
    loadSpotify();
    const interval = setInterval(loadSpotify, 15000);

    youtubeApi.listPlaylists().then(setYoutube).catch(() => setYoutube({ connected: false }));

    return () => clearInterval(interval);
  }, []);

  const handleConnectSpotify = async () => {
    setConnectingSpotify(true);
    try {
      const { url } = await spotifyApi.getAuthUrl();
      window.location.href = url;
    } catch (err) {
      toast.error(err.response?.data?.error || 'Spotify is not available right now');
      setConnectingSpotify(false);
    }
  };

  const handleDisconnectSpotify = async () => {
    try {
      await spotifyApi.disconnect();
      setSpotify({ connected: false });
      toast.success('Spotify disconnected');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to disconnect');
    }
  };

  const handleConnectYouTube = async () => {
    setConnectingYoutube(true);
    try {
      const { url } = await youtubeApi.getAuthUrl();
      window.location.href = url;
    } catch (err) {
      toast.error(err.response?.data?.error || 'YouTube is not available right now');
      setConnectingYoutube(false);
    }
  };

  const handleDisconnectYouTube = async () => {
    try {
      await youtubeApi.disconnect();
      setYoutube({ connected: false });
      toast.success('YouTube disconnected');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to disconnect');
    }
  };

  const handleImportYtPlaylist = async (ytPlaylist) => {
    setImportingYtPlaylist(ytPlaylist.id);
    try {
      const { playlistId, trackCount } = await youtubeApi.importPlaylist(ytPlaylist.id, ytPlaylist.title);
      toast.success(`Imported ${trackCount} track${trackCount === 1 ? '' : 's'}`);
      await refreshPlaylists();
      navigate(`/music/playlist/${playlistId}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to import playlist');
    } finally {
      setImportingYtPlaylist(null);
    }
  };

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

  // One-click add from the lobby search — goes straight into your most
  // recently used playlist (playlists are sorted by updated_at desc), or a
  // fresh "Quick Adds" playlist if you don't have one yet. No picker, no
  // extra clicks — that's the whole point of it living here vs. in a room.
  const handleQuickAdd = async (result) => {
    try {
      let target = playlists[0];
      if (!target) {
        const { playlist } = await playlistApi.create('Quick Adds');
        target = playlist;
      }
      await playlistApi.addTrack(target.id, {
        url: result.url, title: result.title, thumbnail: result.thumbnail, type: 'youtube',
      });
      setAddedVideoIds((s) => new Set(s).add(result.videoId));
      toast.success(`Added to "${target.name}"`);
      refreshPlaylists();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add track');
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

        {/* Quick add — search any song, one click adds it to your playlist */}
        <div className="card p-6 mb-8 animate-slide-up" style={{ animationDelay: '0.08s' }}>
          <h2 className="font-display font-semibold text-bright text-base mb-1">Find Music</h2>
          <p className="text-dim text-xs mb-3">Search any song — one click adds it to your most recent playlist.</p>
          <MusicSearch onAdd={handleQuickAdd} addedIds={addedVideoIds} />
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

        {/* Connect accounts */}
        <div className="card p-6 animate-slide-up space-y-5" style={{ animationDelay: '0.15s' }}>
          <div>
            <h2 className="font-display font-semibold text-bright text-base mb-1">Connect Your Music</h2>
            <p className="text-dim text-xs">Show friends what you're listening to, or pull in your own playlists.</p>
          </div>

          {/* Spotify */}
          <div>
            <p className="text-xs font-mono text-dim uppercase tracking-widest mb-2">Spotify</p>
            {spotify?.connected ? (
              <div className="flex items-center gap-3 flex-wrap">
                {spotify.isPlaying && spotify.track ? (
                  <div className="flex items-center gap-3 bg-raised border border-border rounded-xl px-3 py-2">
                    {spotify.track.albumArt && (
                      <img src={spotify.track.albumArt} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs text-online font-mono flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-online animate-pulse-dot" />
                        Now playing
                      </p>
                      <p className="text-sm text-bright truncate max-w-[220px]">{spotify.track.name}</p>
                      <p className="text-xs text-dim truncate max-w-[220px]">{spotify.track.artists}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-raised border border-border rounded-xl px-3 py-2.5">
                    <span className="text-online text-sm">🟢</span>
                    <p className="text-xs text-dim">Connected — nothing playing right now</p>
                  </div>
                )}
                <button onClick={handleDisconnectSpotify} className="btn-ghost text-xs px-3 py-1.5 text-dim">
                  Disconnect
                </button>
              </div>
            ) : (
              <button onClick={handleConnectSpotify} disabled={connectingSpotify || spotify === null}
                      className="btn-ghost border border-border text-sm px-4 py-2 disabled:opacity-50">
                🟢 {connectingSpotify ? 'Redirecting...' : 'Connect Spotify'}
              </button>
            )}
          </div>

          {/* YouTube */}
          <div>
            <p className="text-xs font-mono text-dim uppercase tracking-widest mb-2">YouTube</p>
            {youtube?.connected ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-2 bg-raised border border-border rounded-xl px-3 py-2">
                    <span className="text-online text-sm">▶️</span>
                    <p className="text-xs text-dim">Connected — import a playlist below</p>
                  </div>
                  <button onClick={handleDisconnectYouTube} className="btn-ghost text-xs px-3 py-1.5 text-dim">
                    Disconnect
                  </button>
                </div>
                {youtube.playlists?.length > 0 && (
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {youtube.playlists.map((p) => (
                      <div key={p.id} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-raised">
                        {p.thumbnail && <img src={p.thumbnail} alt="" className="w-8 h-8 rounded object-cover shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-bright truncate">{p.title}</p>
                          <p className="text-[10px] text-dim">{p.itemCount} videos</p>
                        </div>
                        <button
                          onClick={() => handleImportYtPlaylist(p)}
                          disabled={importingYtPlaylist === p.id}
                          className="btn-ghost text-[10px] px-2 py-1 border border-border shrink-0 disabled:opacity-40"
                        >
                          {importingYtPlaylist === p.id ? 'Importing…' : 'Import'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <button onClick={handleConnectYouTube} disabled={connectingYoutube || youtube === null}
                      className="btn-ghost border border-border text-sm px-4 py-2 disabled:opacity-50">
                ▶️ {connectingYoutube ? 'Redirecting...' : 'Connect YouTube'}
              </button>
            )}
          </div>
        </div>
      </main>
    </AppShell>
  );
}
