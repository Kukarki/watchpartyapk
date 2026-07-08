import { useState, useEffect, useCallback, useRef } from 'react';
import { useSocketContext } from '@/contexts/SocketContext.jsx';
import { useRoomStore } from '@/store/roomStore.js';

const EMOJIS      = ['😂', '❤️', '🔥', '👏', '😮', '🎉'];
const LIFETIME_MS = 2800; // must match animate-float-up duration in tailwind.config.js

let _id = 0;

/**
 * CallReactions
 * Renders a compact emoji picker bar below the video grid.
 * Sent reactions float upward over the grid and disappear automatically.
 * Drop this inside a `relative` container that wraps the video tiles.
 */
export default function CallReactions() {
  const { socket, emit } = useSocketContext();
  const { room }         = useRoomStore();
  const [reactions, setReactions] = useState([]);

  const remove = useCallback((id) => {
    setReactions((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const spawn = useCallback((emoji) => {
    const id = ++_id;
    // Random horizontal spread within 10 – 90 % so emojis don't clip at edges
    const left = 10 + Math.random() * 80;
    setReactions((prev) => [...prev, { id, emoji, left }]);
    setTimeout(() => remove(id), LIFETIME_MS);
  }, [remove]);

  // Receive reactions from remote participants
  useEffect(() => {
    const s = socket.current;
    if (!s) return;
    const handler = ({ emoji }) => spawn(emoji);
    s.on('call:reaction', handler);
    return () => s.off('call:reaction', handler);
  }, [socket, spawn]);

  const send = useCallback((emoji) => {
    spawn(emoji); // show locally without waiting for the round-trip
    emit('call:reaction', { roomId: room?.id, emoji });
  }, [spawn, emit, room]);

  return (
    <>
      {/* Floating emoji layer — absolutely positioned over parent's grid area */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
        {reactions.map((r) => (
          <span
            key={r.id}
            className="absolute bottom-14 text-2xl leading-none animate-float-up select-none"
            style={{ left: `${r.left}%` }}
          >
            {r.emoji}
          </span>
        ))}
      </div>

      {/* Picker bar */}
      <div className="relative z-20 flex items-center justify-center gap-1 py-1">
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => send(emoji)}
            className="w-8 h-8 flex items-center justify-center text-base rounded-full
                         bg-void/60 backdrop-blur-sm border border-border/40
                         hover:bg-void/90 hover:scale-125 active:scale-95
                         transition-transform duration-100 touch-manipulation"
          >
            {emoji}
          </button>
        ))}
      </div>
    </>
  );
}
