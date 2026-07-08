import { useEffect, useState, useCallback } from 'react';
import { useSocketContext } from '@/contexts/SocketContext.jsx';

const REACTION_EMOJIS = ['❤️', '😂', '🔥', '👏', '😮', '🎉', '💯', '😍'];

let idCounter = 0;

export default function FloatingReactions({ roomId }) {
  const { socket, emit } = useSocketContext();
  const [floats, setFloats] = useState([]);

  // Add a floating emoji (random horizontal position + drift)
  const spawn = useCallback((emoji) => {
    const id = ++idCounter;
    const left = 5 + Math.random() * 80;         // 5%–85% from left
    const drift = (Math.random() - 0.5) * 60;    // -30px..+30px horizontal drift
    const duration = 2600 + Math.random() * 1200; // 2.6s–3.8s
    setFloats((f) => [...f, { id, emoji, left, drift, duration }]);
    setTimeout(() => {
      setFloats((f) => f.filter((x) => x.id !== id));
    }, duration);
  }, []);

  // Listen for reactions from anyone in the room
  useEffect(() => {
    const s = socket.current;
    if (!s) return;
    const onFloat = ({ emoji }) => spawn(emoji);
    s.on('reaction:float', onFloat);
    return () => s.off('reaction:float', onFloat);
  }, [socket, spawn]);

  const sendReaction = (emoji) => {
    emit('reaction:float', { roomId, emoji });
    // Optimistic: show your own immediately (server also echoes to everyone)
    spawn(emoji);
  };

  return (
    <>
      {/* Floating emojis overlay */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-30">
        {floats.map((f) => (
          <span
            key={f.id}
            className="absolute bottom-20 text-3xl select-none"
            style={{
              left: `${f.left}%`,
              animation: `floatUp ${f.duration}ms ease-out forwards`,
              '--drift': `${f.drift}px`,
            }}
          >
            {f.emoji}
          </span>
        ))}
      </div>

      {/* Reaction button bar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40
                      flex gap-1.5 px-3 py-2 rounded-full
                      bg-black/50 backdrop-blur border border-white/10">
        {REACTION_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => sendReaction(emoji)}
            className="text-xl hover:scale-125 active:scale-95 transition-transform"
            title={`React ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </>
  );
}
