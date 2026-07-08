import { useState, useEffect } from 'react';
import { useRoomStore } from '@/store/roomStore.js';
import { useRoomActions } from '@/contexts/RoomContext.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { queueApi } from '@/api/room.api.js';
import { parseVideoUrl } from '@/utils/videoUtils.js';
import toast from 'react-hot-toast';

// Supabase returns queue_votes as [{ user_id }]; extract to plain string array.
function voterIds(item) {
  return (item?.queue_votes ?? []).map((v) => v.user_id);
}

export default function WatchQueue({ roomId }) {
  const { room, members } = useRoomStore();
  const { sendChangeUrl } = useRoomActions();
  const { user } = useAuth();

  const [queue, setQueue]         = useState([]);
  const [urlInput, setUrl]        = useState('');
  const [title, setTitle]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [adding, setAdding]       = useState(false);
  const [playingId, setPlayingId] = useState(null);

  const myMember = members.find((m) => m.userId === user?.userId);
  const isHost   = myMember?.isHost === true || room?.hostId === user?.userId;

  // Load queue on mount
  useEffect(() => {
    if (!roomId) return;
    queueApi.getQueue(roomId)
      .then((d) => setQueue(d.queue || []))
      .catch(() => {});
  }, [roomId]);

  const handleAdd = async (e) => {
    e.preventDefault();
    const url = urlInput.trim();
    if (!url) return;
    const parsed = parseVideoUrl(url);
    if (!parsed.isValid) { toast.error('Paste a valid YouTube or video URL'); return; }

    setAdding(true);
    try {
      const data = await queueApi.addToQueue(roomId, {
        url,
        title: title.trim() || 'Untitled',
        type:  parsed.type,
      });
      // Backend auto-votes for own item but doesn't return queue_votes join —
      // normalise so the UI reflects it immediately.
      const item = { ...data.item, queue_votes: [{ user_id: user?.userId }] };
      setQueue((q) => [...q, item]);
      setUrl(''); setTitle('');
      toast.success('Added to queue!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add');
    } finally {
      setAdding(false);
    }
  };

  const handleVote = async (itemId) => {
    if (!itemId) return;
    try {
      const data = await queueApi.voteItem(roomId, itemId);
      setQueue((q) => q.map((i) => i.id === itemId ? data.item : i));
    } catch (err) { console.error(err); }
  };

  const handleRemove = async (itemId) => {
    if (!itemId) return;
    try {
      await queueApi.removeItem(roomId, itemId);
      setQueue((q) => q.filter((i) => i.id !== itemId));
    } catch (err) { console.error(err); }
  };

  // Play a specific item — changes the video for everyone in the room
  const handlePlayItem = async (item) => {
    setPlayingId(item.id);
    try {
      sendChangeUrl(item.url); // broadcasts the new URL to everyone via socket immediately
      toast.success(`▶ Playing: ${item.title}`);
      // Best-effort remove from queue (may fail if not owner/host — that's ok)
      try {
        await queueApi.removeItem(roomId, item.id);
        setQueue((q) => q.filter((i) => i.id !== item.id));
      } catch {
        // Not owner/host — item stays in queue, that's fine
      }
    } catch {
      toast.error('Could not play item');
    } finally {
      setPlayingId(null);
    }
  };

  // Play top-voted item via the backend endpoint (keeps queue in sync)
  const handlePlayNext = async () => {
    setLoading(true);
    try {
      const data = await queueApi.playNext(roomId);
      sendChangeUrl(data.video.url);
      setQueue(data.queue || []);
      toast.success(`▶ Playing: ${data.video.title}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  // Sort by vote_count (server-maintained counter) descending
  const sorted = [...queue].sort((a, b) => (b.vote_count ?? 0) - (a.vote_count ?? 0));

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3
                       border-b border-border shrink-0">
        <div>
          <p className="text-bright text-sm font-semibold">Watch Queue</p>
          <p className="text-dim text-xs">{queue.length} video{queue.length !== 1 ? 's' : ''}</p>
        </div>
        {queue.length > 0 && (
          <button onClick={handlePlayNext} disabled={loading}
                  className="btn-primary text-xs px-3 py-1.5 disabled:opacity-40 gap-1">
            {loading ? '...' : '▶ Play #1'}
          </button>
        )}
      </div>

      {/* Queue list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {sorted.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-3xl mb-2">📋</div>
            <p className="text-dim text-xs">Queue is empty</p>
            <p className="text-dim/60 text-xs mt-1">Add a YouTube link below</p>
          </div>
        ) : (
          sorted.map((item, idx) => {
            const voters     = voterIds(item);
            const voted      = voters.includes(user?.userId);
            const isOwner    = item.added_by === user?.userId;
            const parsed     = parseVideoUrl(item.url);
            const isPlaying  = playingId === item.id;

            return (
              <div key={item.id}
                   className="flex items-center gap-2 p-3 rounded-xl
                               bg-raised border border-border
                               hover:border-amber/20 transition-colors group">

                {/* Rank badge */}
                <div className="w-5 text-center shrink-0">
                  <span className={`text-xs font-mono font-bold
                    ${idx === 0 ? 'text-amber' : 'text-dim'}`}>
                    {idx + 1}
                  </span>
                </div>

                {/* Play button — anyone can play; appears on hover */}
                <button
                  onClick={() => handlePlayItem(item)}
                  disabled={isPlaying}
                  title="Play now for everyone"
                  className="w-9 h-7 flex items-center justify-center rounded-lg shrink-0
                              bg-online/10 border border-online/20 text-online
                              hover:bg-online/25 hover:border-online/50
                              disabled:opacity-40 transition-all text-sm
                              opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                  {isPlaying ? '⏳' : '▶'}
                </button>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-bright text-xs font-medium truncate leading-tight">
                    {item.title}
                  </p>
                  <p className="text-dim text-[10px] truncate leading-tight mt-0.5">
                    {parsed.type === 'youtube' ? 'YouTube' : 'Video'} · {item.added_by_name}
                  </p>
                </div>

                {/* Vote button */}
                <button
                  onClick={() => handleVote(item.id)}
                  title={voted ? 'Remove vote' : 'Upvote'}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg
                               text-xs border transition-all shrink-0
                               ${voted
                                 ? 'bg-amber/20 border-amber/40 text-amber'
                                 : 'bg-surface border-border text-dim hover:border-amber/30'}`}>
                  <span>👍</span>
                  <span className="font-mono">{item.vote_count ?? voters.length}</span>
                </button>

                {/* Remove button */}
                {(isOwner || isHost) && (
                  <button
                    onClick={() => handleRemove(item.id)}
                    title="Remove from queue"
                    className="w-6 h-6 flex items-center justify-center rounded
                                text-dim hover:text-danger transition-colors text-xs shrink-0
                                opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                    ✕
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add form */}
      <div className="border-t border-border p-3 space-y-2 shrink-0">
        <p className="text-sub text-xs font-mono uppercase tracking-widest">Add to Queue</p>
        <form onSubmit={handleAdd} className="space-y-2">
          <input
            className="input-base text-xs py-2"
            placeholder="YouTube or video URL..."
            value={urlInput}
            onChange={(e) => setUrl(e.target.value)}
          />
          <div className="flex gap-2">
            <input
              className="input-base text-xs py-2 flex-1"
              placeholder="Title (optional)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <button
              type="submit"
              disabled={adding || !urlInput.trim()}
              className="btn-primary text-xs px-4 disabled:opacity-40
                          disabled:cursor-not-allowed shrink-0">
              {adding ? '...' : '+ Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
