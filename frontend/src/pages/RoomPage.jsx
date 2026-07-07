import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRoomStore } from '@/store/roomStore.js';
import { useSocketContext } from '@/contexts/SocketContext.jsx';
import VideoPlayer     from '@/components/player/VideoPlayer.jsx';
import ChatPanel       from '@/components/chat/ChatPanel.jsx';
import MemberList      from '@/components/room/MemberList.jsx';
import RoomHeader      from '@/components/room/RoomHeader.jsx';
import SyncIndicator   from '@/components/player/SyncIndicator.jsx';
import VideoCall       from '@/components/VideoCall.jsx';
import ScreenShare     from '@/components/voice/ScreenShare.jsx';
import WatchQueue      from '@/components/room/WatchQueue.jsx';
import PollPanel       from '@/components/room/PollPanel.jsx';

const SIDEBAR_TABS = [
  { id: 'chat',    icon: '💬', title: 'Chat' },
  { id: 'members', icon: '👥', title: 'People' },
  { id: 'queue',   icon: '📋', title: 'Queue' },
  { id: 'polls',   icon: '🗳️', title: 'Polls' },
];

export default function RoomPage() {
  const { isChatOpen, room } = useRoomStore();
  const { connected }        = useSocketContext();
  const navigate             = useNavigate();
  const [sidebarTab, setSidebarTab] = useState('chat');

  if (!room) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <div className="text-center space-y-4 animate-fade-in">
          <div className="text-5xl">🎬</div>
          <p className="text-sub font-mono text-sm">
            {!connected ? 'Connecting to server...' : 'Joining room...'}
          </p>
          <div className="flex gap-2 justify-center">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </div>
          <button onClick={() => navigate('/lobby')}
                  className="btn-ghost text-xs mt-2">
            ← Back to lobby
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-void flex flex-col overflow-hidden">
      <RoomHeader />

      <div className="flex-1 flex overflow-hidden">

        {/* Left: Video */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="flex-1 relative bg-black">
            <VideoPlayer />
            <SyncIndicator />
            {/* Floating panels over video */}
            <VideoCall />
            <ScreenShare roomId={room.id} />
          </div>
        </div>

        {/* Right: Sidebar */}
        {isChatOpen && (
          <aside className="w-80 xl:w-96 flex flex-col border-l border-border
                             bg-surface shrink-0 animate-slide-right">

            {/* Tab bar */}
            <div className="flex border-b border-border shrink-0">
              {SIDEBAR_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSidebarTab(tab.id)}
                  title={tab.title}
                  className={`flex-1 py-2.5 flex flex-col items-center gap-0.5
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

            {/* Tab content */}
            <div className="flex-1 overflow-hidden">
              {sidebarTab === 'chat'    && <ChatPanel />}
              {sidebarTab === 'members' && <MemberList />}
              {sidebarTab === 'queue'   && <WatchQueue  roomId={room.id} />}
              {sidebarTab === 'polls'   && <PollPanel   roomId={room.id} />}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}