import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRoomStore } from '@/store/roomStore.js';
import { useSocketContext } from '@/contexts/SocketContext.jsx';
import { playlistApi } from '@/api/playlist.api.js';
import { queueApi } from '@/api/room.api.js';
import MusicPlayer     from '@/components/player/MusicPlayer.jsx';
import ChatPanel       from '@/components/chat/ChatPanel.jsx';
import MemberList      from '@/components/room/MemberList.jsx';
import RoomHeader      from '@/components/room/RoomHeader.jsx';
import WatchQueue      from '@/components/room/WatchQueue.jsx';
import VoiceChannel    from '@/components/voice/VoiceChannel.jsx';
import MusicSearch     from '@/components/music/MusicSearch.jsx';
import toast from 'react-hot-toast';

const SIDEBAR_TABS = [
  { id: 'chat',    icon: '💬', title: 'Chat' },
  { id: 'members', icon: '👥', title: 'People' },
  { id: 'queue',   icon: '📋', title: 'Queue' },
  { id: 'voice',   icon: '🎙️', title: 'Voice' },
];

export default function MusicRoomPage() {
  const { isChatOpen, toggleChat, room } = useRoomStore();
  const { connected }        = useSocketContext();
  const navigate             = useNavigate();
  const [sidebarTab, setSidebarTab] = useState('queue');
  const [queueRefreshKey, setQueueRefreshKey] = useState(0);
  const [showLoadPlaylist, setShowLoadPlaylist] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [loadingPlaylist, setLoadingPlaylist] = useState(null);
  const [addedVideoIds, setAddedVideoIds] = useState(new Set());

  useEffect(() => {
    if (!showLoadPlaylist) return;
    playlistApi.list().then((d) => setPlaylists(d.playlists || [])).catch(() => {});
  }, [showLoadPlaylist]);

  const handleLoadPlaylist = async (playlistId) => {
    setLoadingPlaylist(playlistId);
    try {
      const { added } = await playlistApi.importToRoom(playlistId, room.id);
      toast.success(`Added ${added} track${added === 1 ? '' : 's'} to the queue`);
      setShowLoadPlaylist(false);
      setQueueRefreshKey((k) => k + 1); // force WatchQueue to remount and refetch
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load playlist');
    } finally {
      setLoadingPlaylist(null);
    }
  };

  const handleAddSearchResult = async (result) => {
    try {
      await queueApi.addToQueue(room.id, { url: result.url, title: result.title, type: 'youtube' });
      setAddedVideoIds((s) => new Set(s).add(result.videoId));
      setQueueRefreshKey((k) => k + 1);
      toast.success(`Added "${result.title}" to the queue`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add track');
    }
  };

  // A "watch" room slipped in via /music-room/:id — send it to the right page.
  useEffect(() => {
    if (room && room.roomType === 'watch') {
      navigate(`/room/${room.id}`, { replace: true });
    }
  }, [room, navigate]);

  if (room && room.roomType === 'watch') return null;

  if (!room) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <div className="text-center space-y-4 animate-fade-in">
          <div className="text-5xl">🎵</div>
          <p className="text-sub font-mono text-sm">
            {!connected ? 'Connecting to server...' : 'Joining listening party...'}
          </p>
          <div className="flex gap-2 justify-center">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </div>
          <button onClick={() => navigate('/music')}
                  className="btn-ghost text-xs mt-2">
            ← Back to music
          </button>
        </div>
      </div>
    );
  }

  const sidebarInner = (
    <>
      <div className="flex border-b border-border shrink-0">
        {SIDEBAR_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSidebarTab(tab.id)}
            title={tab.title}
            className={`flex-1 py-3 flex flex-col items-center gap-0.5
                         transition-colors text-xs font-medium
              ${sidebarTab === tab.id
                ? 'border-b-2 border-amber text-amber'
                : 'text-dim hover:text-sub'
              }`}
          >
            <span className="text-base leading-none">{tab.icon}</span>
            <span className="leading-none">{tab.title}</span>
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-hidden overflow-y-auto relative">
        {sidebarTab === 'chat'    && <ChatPanel />}
        {sidebarTab === 'members' && <MemberList />}
        {sidebarTab === 'voice'   && <VoiceChannel channelId="music" channelName="Listening Party" />}
        {sidebarTab === 'queue' && (
          <div className="h-full flex flex-col">
            <div className="px-3 pt-3 shrink-0 space-y-1.5">
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => { setShowSearch((v) => !v); setShowLoadPlaylist(false); }}
                  className="btn-ghost text-xs px-2.5 py-1.5 border border-border flex-1 justify-center"
                >
                  🔍 Search Music
                </button>
                <button
                  type="button"
                  onClick={() => { setShowLoadPlaylist((v) => !v); setShowSearch(false); }}
                  className="btn-ghost text-xs px-2.5 py-1.5 border border-border flex-1 justify-center"
                >
                  📥 Load Playlist
                </button>
              </div>

              {showSearch && (
                <div className="mt-2 card p-2">
                  <MusicSearch onAdd={handleAddSearchResult} addedIds={addedVideoIds} />
                </div>
              )}

              {showLoadPlaylist && (
                <div className="mt-2 card p-2 max-h-40 overflow-y-auto space-y-0.5">
                  {playlists.length === 0 ? (
                    <p className="text-dim text-xs px-2 py-1">No playlists yet.</p>
                  ) : (
                    playlists.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => handleLoadPlaylist(p.id)}
                        disabled={loadingPlaylist === p.id}
                        className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg
                                   text-left text-xs text-sub hover:bg-raised hover:text-bright
                                   disabled:opacity-40 transition-colors"
                      >
                        <span className="truncate">{p.name}</span>
                        <span className="text-dim shrink-0 ml-2">{p.trackCount ?? 0}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <div className="flex-1 min-h-0">
              <WatchQueue key={queueRefreshKey} roomId={room.id} />
            </div>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="h-[100dvh] bg-void flex flex-col overflow-hidden">
      <RoomHeader />
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="flex-1 relative bg-black">
            <MusicPlayer />
          </div>
        </div>

        {isChatOpen && (
          <aside className="hidden md:flex w-80 xl:w-96 flex-col border-l border-border
                             bg-surface shrink-0 animate-slide-right">
            {sidebarInner}
          </aside>
        )}

        {isChatOpen && (
          <div className="md:hidden fixed inset-0 z-40 flex flex-col bg-surface
                          animate-slide-up" style={{ height: '100dvh' }}>
            <div className="flex items-center justify-between px-4 py-2.5
                            border-b border-border shrink-0 bg-void/40">
              <span className="text-sm font-semibold text-sub">Listening Party</span>
              <button
                onClick={toggleChat}
                className="text-dim hover:text-sub text-2xl leading-none px-2"
                aria-label="Close panel"
              >
                ×
              </button>
            </div>
            {sidebarInner}
          </div>
        )}
      </div>

      {!isChatOpen && (
        <button
          onClick={toggleChat}
          className="md:hidden fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full
                     bg-amber text-void shadow-lg flex items-center justify-center
                     text-2xl active:scale-95 transition-transform"
          aria-label="Open panel"
        >
          🎵
        </button>
      )}
    </div>
  );
}
