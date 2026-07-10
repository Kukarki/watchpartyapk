import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppShell from '@/components/layout/AppShell.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { playlistApi } from '@/api/playlist.api.js';
import { parseVideoUrl } from '@/utils/videoUtils.js';
import MusicSearch from '@/components/music/MusicSearch.jsx';
import toast from 'react-hot-toast';

export default function PlaylistDetailPage() {
  const { playlistId, shareCode } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [playlist, setPlaylist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [addMode, setAddMode] = useState('search'); // 'search' | 'url'
  const [addedVideoIds, setAddedVideoIds] = useState(new Set());

  const isOwner = playlist && user && playlist.ownerId === user.userId;

  const load = () => {
    const req = shareCode ? playlistApi.getShared(shareCode) : playlistApi.get(playlistId);
    req
      .then((d) => { setPlaylist(d.playlist); setName(d.playlist.name); })
      .catch((err) => toast.error(err.response?.data?.error || 'Playlist not found'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [playlistId, shareCode]);

  const handleRename = async () => {
    if (!name.trim() || name.trim() === playlist.name) return;
    try {
      const { playlist: updated } = await playlistApi.update(playlist.id, { name: name.trim() });
      setPlaylist((p) => ({ ...p, name: updated.name }));
      toast.success('Renamed');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to rename');
    }
  };

  const handleToggleShare = async () => {
    try {
      const { playlist: updated } = await playlistApi.update(playlist.id, { isPublic: !playlist.isPublic });
      setPlaylist((p) => ({ ...p, isPublic: updated.isPublic, shareCode: updated.shareCode }));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update sharing');
    }
  };

  const copyShareLink = () => {
    const url = `${window.location.origin}/music/shared/${playlist.shareCode}`;
    navigator.clipboard.writeText(url);
    toast.success('Share link copied!');
  };

  const handleAddTrack = async (e) => {
    e.preventDefault();
    const url = urlInput.trim();
    if (!url) return;
    const parsed = parseVideoUrl(url);
    if (!parsed.isValid) { toast.error('Paste a valid YouTube or track URL'); return; }

    setAdding(true);
    try {
      const { track } = await playlistApi.addTrack(playlist.id, {
        url, title: titleInput.trim() || 'Untitled', type: parsed.type,
      });
      setPlaylist((p) => ({ ...p, tracks: [...p.tracks, track] }));
      setUrlInput(''); setTitleInput('');
      toast.success('Added to playlist');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add track');
    } finally {
      setAdding(false);
    }
  };

  const handleAddSearchResult = async (result) => {
    try {
      const { track } = await playlistApi.addTrack(playlist.id, {
        url: result.url, title: result.title, thumbnail: result.thumbnail, type: 'youtube',
      });
      setPlaylist((p) => ({ ...p, tracks: [...p.tracks, track] }));
      setAddedVideoIds((s) => new Set(s).add(result.videoId));
      toast.success('Added to playlist');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add track');
    }
  };

  const handleRemoveTrack = async (trackId) => {
    try {
      await playlistApi.removeTrack(playlist.id, trackId);
      setPlaylist((p) => ({ ...p, tracks: p.tracks.filter((t) => t.id !== trackId) }));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to remove track');
    }
  };

  const handleDeletePlaylist = async () => {
    if (!confirm(`Delete "${playlist.name}"? This can't be undone.`)) return;
    try {
      await playlistApi.remove(playlist.id);
      toast.success('Playlist deleted');
      navigate('/music');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete playlist');
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="max-w-3xl mx-auto px-6 py-16 flex justify-center">
          <span className="w-5 h-5 border-2 border-amber/30 border-t-amber rounded-full animate-spin" />
        </div>
      </AppShell>
    );
  }

  if (!playlist) {
    return (
      <AppShell>
        <div className="max-w-3xl mx-auto px-6 py-16 text-center">
          <p className="text-sub text-sm mb-4">This playlist doesn't exist or isn't shared with you.</p>
          <button onClick={() => navigate('/music')} className="btn-ghost text-xs px-4 py-2">← Back to Music</button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="max-w-3xl mx-auto px-6 py-8 animate-slide-up">
        <button onClick={() => navigate('/music')} className="btn-ghost text-xs px-3 py-1.5 mb-4">
          ← Music
        </button>

        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            {isOwner ? (
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={handleRename}
                onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                className="font-display font-bold text-2xl text-bright bg-transparent
                           border-b border-transparent hover:border-border focus:border-amber
                           outline-none w-full"
                maxLength={60}
              />
            ) : (
              <h1 className="font-display font-bold text-2xl text-bright">{playlist.name}</h1>
            )}
            <p className="text-sub text-sm mt-1">{playlist.tracks.length} track{playlist.tracks.length !== 1 ? 's' : ''}</p>
          </div>

          {isOwner && (
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={handleToggleShare} className="btn-ghost text-xs px-3 py-1.5 border border-border">
                {playlist.isPublic ? '🔓 Shared' : '🔒 Private'}
              </button>
              {playlist.isPublic && (
                <button onClick={copyShareLink} className="btn-ghost text-xs px-3 py-1.5 border border-border">
                  🔗 Copy Link
                </button>
              )}
              <button onClick={handleDeletePlaylist} className="btn-ghost text-xs px-3 py-1.5 text-danger">
                Delete
              </button>
            </div>
          )}
        </div>

        {isOwner && (
          <div className="card p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-mono text-dim uppercase tracking-widest">Add Track</p>
              <div className="flex gap-1 card p-0.5">
                <button
                  type="button"
                  onClick={() => setAddMode('search')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors
                              ${addMode === 'search' ? 'bg-amber text-void' : 'text-sub hover:text-bright'}`}
                >
                  🔍 Search
                </button>
                <button
                  type="button"
                  onClick={() => setAddMode('url')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors
                              ${addMode === 'url' ? 'bg-amber text-void' : 'text-sub hover:text-bright'}`}
                >
                  🔗 Paste URL
                </button>
              </div>
            </div>

            {addMode === 'search' ? (
              <MusicSearch onAdd={handleAddSearchResult} addedIds={addedVideoIds} />
            ) : (
              <form onSubmit={handleAddTrack} className="flex flex-col sm:flex-row gap-2">
                <input
                  className="input-base text-sm flex-1"
                  placeholder="YouTube or track URL…"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                />
                <input
                  className="input-base text-sm sm:w-48"
                  placeholder="Title (optional)"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                />
                <button type="submit" disabled={adding || !urlInput.trim()}
                        className="btn-primary text-sm px-4 shrink-0 disabled:opacity-40">
                  {adding ? '...' : '+ Add'}
                </button>
              </form>
            )}
          </div>
        )}

        {playlist.tracks.length === 0 ? (
          <div className="card p-10 flex flex-col items-center text-center gap-2">
            <div className="text-3xl">🎵</div>
            <p className="text-dim text-sm">No tracks yet.</p>
          </div>
        ) : (
          <div className="card divide-y divide-border">
            {playlist.tracks.map((t, idx) => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                <span className="text-xs font-mono text-dim w-5 text-center shrink-0">{idx + 1}</span>
                <div className="w-8 h-8 rounded-lg bg-raised border border-border
                                 flex items-center justify-center text-sm shrink-0">
                  🎧
                </div>
                <p className="flex-1 min-w-0 text-sm text-bright truncate">{t.title}</p>
                {isOwner && (
                  <button
                    onClick={() => handleRemoveTrack(t.id)}
                    className="w-6 h-6 flex items-center justify-center rounded text-dim
                               hover:text-danger transition-colors text-xs shrink-0"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </AppShell>
  );
}
