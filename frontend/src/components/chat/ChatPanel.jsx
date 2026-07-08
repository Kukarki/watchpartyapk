import { useEffect, useRef } from 'react';
import { useChat } from '@/hooks/useChat.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useRoomStore } from '@/store/roomStore.js';
import ChatMessage from './ChatMessage.jsx';
import ChatInput from './ChatInput.jsx';
import TypingIndicator from './TypingIndicator.jsx';
import Avatar from '@/components/ui/Avatar.jsx';

export default function ChatPanel() {
  const { messages, typingList, submitMessage, reactToMessage, handleTypingStart } = useChat();
  const { user } = useAuth();
  const { members } = useRoomStore();
  const bottomRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 150;
    if (isNearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, typingList]);

  const others = members.filter((m) => m.userId !== user?.userId);
  const selfMember = members.find((m) => m.userId === user?.userId);

  return (
    <div className="h-full flex flex-col bg-surface">

      {/* ── Who's in the room (compact) ── */}
      <div className="px-4 py-2 border-b border-border shrink-0 max-h-[88px] overflow-y-auto">
        {members.length === 0 ? (
          <p className="text-dim text-xs text-center py-1">Connecting...</p>
        ) : (
          <div className="space-y-2">
            {/* All members as chips */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {members.map((m) => {
                const isSelf = m.userId === user?.userId;
                return (
                  <div
                    key={m.userId}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl
                                 border transition-colors
                                 ${isSelf
                                   ? 'bg-amber/10 border-amber/30'
                                   : 'bg-raised border-border'
                                 }`}
                  >
                    <div className="relative">
                      <Avatar src={m.avatar} name={m.displayName} size="xs" />
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5
                                        rounded-full bg-online border border-surface" />
                    </div>
                    <span className={`text-xs font-medium
                      ${isSelf ? 'text-amber' : 'text-sub'}`}>
                      {isSelf ? `${m.displayName} (you)` : m.displayName}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Status line */}
            <p className="text-[10px] text-dim flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-online inline-block
                               animate-pulse" />
              {members.length === 1
                ? 'Just you — share the invite link!'
                : `${members.length} people watching live`}
            </p>
          </div>
        )}
      </div>

      {/* ── Messages ── */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto py-3 space-y-1.5 scroll-smooth"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center
                           h-full text-center px-6 py-8 animate-fade-in">
            <div className="text-4xl mb-3">💬</div>
            <p className="text-sub text-sm font-medium mb-1">No messages yet</p>
            <p className="text-dim text-xs leading-relaxed">
              {others.length > 0
                ? `Say hi to ${others.map(o => o.displayName).join(' & ')}!`
                : 'Invite a friend and start watching together'}
            </p>
          </div>
        )}

        {messages.map((message, idx) => {
          const isSelf = message.userId === user?.userId;
          const prevMsg = messages[idx - 1];
          const nextMsg = messages[idx + 1];

          const isGrouped =
            prevMsg?.userId === message.userId &&
            message.createdAt - prevMsg.createdAt < 60_000;

          // Date separator
          const showDateSep =
            !prevMsg ||
            new Date(message.createdAt).toDateString() !==
            new Date(prevMsg.createdAt).toDateString();

          return (
            <div key={message.id}>
              {showDateSep && (
                <div className="flex items-center gap-3 px-4 py-2 my-1">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[10px] text-dim font-mono whitespace-nowrap">
                    {new Date(message.createdAt).toLocaleDateString([], {
                      weekday: 'short', month: 'short', day: 'numeric',
                    })}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              )}
              <ChatMessage
                message={message}
                isSelf={isSelf}
                isGrouped={isGrouped}
                onReact={(emoji) => reactToMessage(message.id, emoji)}
                currentUserId={user?.userId}
              />
            </div>
          );
        })}

        {typingList.length > 0 && (
          <div className="px-2">
            <TypingIndicator names={typingList} />
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input ── */}
      <div className="border-t border-border shrink-0 p-3 bg-void/40">
        <ChatInput
          onSubmit={submitMessage}
          onTyping={handleTypingStart}
          placeholder={
            others.length > 0
              ? `Message ${others[0]?.displayName}...`
              : 'Say something...'
          }
        />
      </div>
    </div>
  );
}