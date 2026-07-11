import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRoomStore } from '@/store/roomStore.js';
import { useSocketContext } from '@/contexts/SocketContext.jsx';
import ChatPanel     from '@/components/chat/ChatPanel.jsx';
import MemberList    from '@/components/room/MemberList.jsx';
import RoomHeader    from '@/components/room/RoomHeader.jsx';
import VoiceChannel  from '@/components/voice/VoiceChannel.jsx';
import LudoBoard      from '@/components/games/LudoBoard.jsx';

const SIDEBAR_TABS = [
  { id: 'chat',    icon: '💬', title: 'Chat' },
  { id: 'members', icon: '👥', title: 'People' },
  { id: 'voice',   icon: '🎙️', title: 'Voice' },
];

const GAME_BOARDS = {
  ludo: LudoBoard,
};

export default function GameRoomPage() {
  const { isChatOpen, toggleChat, room } = useRoomStore();
  const { connected }        = useSocketContext();
  const navigate             = useNavigate();
  const [sidebarTab, setSidebarTab] = useState('chat');

  // A "watch"/"music" room slipped in via /game-room/:id — send it to the right page.
  useEffect(() => {
    if (room && room.roomType === 'watch') navigate(`/room/${room.id}`, { replace: true });
    if (room && room.roomType === 'music') navigate(`/music-room/${room.id}`, { replace: true });
  }, [room, navigate]);

  if (room && (room.roomType === 'watch' || room.roomType === 'music')) return null;

  if (!room) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <div className="text-center space-y-4 animate-fade-in">
          <div className="text-5xl">🎲</div>
          <p className="text-sub font-mono text-sm">
            {!connected ? 'Connecting to server...' : 'Joining game...'}
          </p>
          <div className="flex gap-2 justify-center">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </div>
          <button onClick={() => navigate('/games')}
                  className="btn-ghost text-xs mt-2">
            ← Back to games
          </button>
        </div>
      </div>
    );
  }

  const Board = GAME_BOARDS[room.gameType] || (() => (
    <div className="w-full h-full flex items-center justify-center">
      <p className="text-dim text-sm">Unknown game type "{room.gameType}"</p>
    </div>
  ));

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
      <div className="flex-1 overflow-hidden overflow-y-auto">
        {sidebarTab === 'chat'    && <ChatPanel />}
        {sidebarTab === 'members' && <MemberList />}
        {sidebarTab === 'voice'   && <VoiceChannel channelId="game" channelName="Game Room" />}
      </div>
    </>
  );

  return (
    <div className="h-[100dvh] bg-void flex flex-col overflow-hidden">
      <RoomHeader />
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="flex-1 relative bg-void">
            <Board />
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
              <span className="text-sm font-semibold text-sub">Game Room</span>
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
          🎲
        </button>
      )}
    </div>
  );
}
