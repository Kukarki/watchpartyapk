import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Avatar from '@/components/ui/Avatar.jsx';
import Emoji from '@/components/ui/Emoji.jsx';

const EMOJI_CATEGORIES = [
  { label: '⚡', title: 'Quick',  emojis: ['👍','👎','❤️','😂','😮','😢','😡','🙏'] },
  { label: '😂', title: 'Fun',    emojis: ['🔥','💯','🥳','🎉','👀','💀','😍','🤩','🥺','😭','🤔','🫡','💪','🙈','🤯','🫶'] },
  { label: '🌶️', title: 'Spicy', emojis: ['🍆','🍑','💦','😏','🥵','😈','👅','🤤','🫦','💋','🍒','🌶️','😜','🫠','🔞','💦'] },
];

const ALL_EMOJIS = EMOJI_CATEGORIES.flatMap((c) => c.emojis);
const LONG_PRESS_MS = 500;

function toReactionMap(raw) {
  return (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
}

export default function ChatMessage({ message, isSelf, isGrouped, onReact, currentUserId }) {
  const [showPicker, setShowPicker] = useState(false);
  const [pickerPos, setPickerPos]   = useState({ x: 0, y: 0 });
  const [activeTab, setActiveTab]   = useState(0);

  // Local reaction state — updated immediately on react, and synced from
  // the message prop when the server broadcasts the updated reactions.
  const [reactions, setReactions] = useState(() => toReactionMap(message.reactions));

  // Sync reactions from parent whenever the message prop changes
  // (e.g. remote user reacts, or chat history loads)
  useEffect(() => {
    setReactions(toReactionMap(message.reactions));
  }, [message.reactions]);

  const timerRef  = useRef(null);
  const hasMoved  = useRef(false);
  const bubbleRef = useRef(null);
  const btnRef    = useRef(null);

  const timeLabel = new Date(message.createdAt).toLocaleTimeString([], {
    hour: 'numeric', minute: '2-digit',
  });

  const reactionEntries = Object.entries(reactions).filter(
    ([, users]) => Array.isArray(users) && users.length > 0,
  );

  // ── Open picker near anchor ───────────────────────────────
  const openPicker = useCallback((anchor) => {
    const rect = anchor.getBoundingClientRect();
    const W = 264, H = 160;
    let x = isSelf ? rect.right - W : rect.left;
    let y = rect.top - H - 8;
    x = Math.max(8, Math.min(x, window.innerWidth  - W - 8));
    y = Math.max(8, Math.min(y, window.innerHeight - H - 8));
    setPickerPos({ x, y });
    setShowPicker(true);
  }, [isSelf]);

  // ── Long-press (mobile) ───────────────────────────────────
  useEffect(() => {
    const el = bubbleRef.current;
    if (!el) return;
    const onStart = (e) => {
      e.preventDefault();
      hasMoved.current = false;
      timerRef.current = setTimeout(() => {
        if (!hasMoved.current) openPicker(el);
      }, LONG_PRESS_MS);
    };
    const onMove = () => { hasMoved.current = true; clearTimeout(timerRef.current); };
    const onEnd  = () => clearTimeout(timerRef.current);
    el.addEventListener('touchstart', onStart, { passive: false });
    el.addEventListener('touchmove',  onMove,  { passive: true });
    el.addEventListener('touchend',   onEnd,   { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove',  onMove);
      el.removeEventListener('touchend',   onEnd);
    };
  }, [openPicker]);

  // ── React to a message ────────────────────────────────────
  const handleReact = useCallback((emoji) => {
    // 1. Update local state immediately so UI responds instantly
    setReactions((prev) => {
      const next  = { ...prev };
      const users = Array.isArray(next[emoji]) ? [...next[emoji]] : [];
      if (users.includes(currentUserId)) {
        next[emoji] = users.filter((id) => id !== currentUserId);
        if (next[emoji].length === 0) delete next[emoji];
      } else {
        next[emoji] = [...users, currentUserId];
      }
      return next;
    });
    // 2. Broadcast to server / other users
    onReact?.(emoji);
    setShowPicker(false);
  }, [currentUserId, onReact]);

  return (
    <div className={`px-3 py-1 ${isGrouped ? 'pt-0.5' : 'pt-2'}`}>
      <div className={`flex gap-2 ${isSelf ? 'justify-end' : 'justify-start'}`}>

        {!isSelf && !isGrouped && (
          <div className="shrink-0 pt-1">
            <Avatar src={message.avatar} name={message.displayName} size="sm" />
          </div>
        )}

        <div className={`max-w-[80%] flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}>
          {!isSelf && !isGrouped && (
            <div className="mb-1 flex items-center gap-2 px-1">
              <span className="text-[11px] font-medium text-sub">{message.displayName}</span>
              <span className="text-[10px] text-dim">{timeLabel}</span>
            </div>
          )}

          {/* Bubble + react button */}
          <div className={`flex items-center gap-1.5 ${isSelf ? 'flex-row-reverse' : 'flex-row'}`}>
            {/* Always-visible react button */}
            <button
              ref={btnRef}
              type="button"
              onClick={() => openPicker(btnRef.current)}
              title="Add reaction"
              className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full
                         text-dim hover:text-bright hover:bg-raised border border-transparent
                         hover:border-border transition-all duration-150 active:scale-90
                         opacity-40 hover:opacity-100 text-xs"
            >
              😊
            </button>

            {/* Message bubble */}
            <div
              ref={bubbleRef}
              title={timeLabel}
              onContextMenu={(e) => { e.preventDefault(); openPicker(bubbleRef.current); }}
              className={`px-3.5 py-2 text-sm leading-relaxed shadow-sm select-none
                           break-words transition-colors
                           ${isSelf
                             ? 'bg-amber text-void font-medium rounded-2xl rounded-br-sm'
                             : 'bg-raised text-bright border border-border rounded-2xl rounded-bl-sm'
                           }`}
            >
              {message.content}
            </div>
          </div>

          {isSelf && !isGrouped && (
            <span className="mt-1 px-1 text-[10px] text-dim">{timeLabel}</span>
          )}

          {/* ── Reaction pills ── */}
          {reactionEntries.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {reactionEntries.map(([emoji, users]) => {
                const active = Array.isArray(users) && users.includes(currentUserId);
                return (
                  <button
                    key={`${message.id}-${emoji}`}
                    type="button"
                    onClick={() => handleReact(emoji)}
                    className={`inline-flex items-center gap-1 rounded-full border
                                 px-2 py-0.5 text-[11px] font-medium transition-all active:scale-95
                                 ${active
                                   ? 'border-amber/60 bg-amber/10 text-amber'
                                   : 'border-border bg-raised text-sub hover:border-amber/30 hover:text-bright'
                                 }`}
                  >
                    <Emoji emoji={emoji} size={14} />
                    <span>{users.length}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Emoji picker portal ── */}
      {showPicker && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setShowPicker(false)} />
          <div
            className="fixed z-[9999] rounded-2xl bg-surface border border-border shadow-2xl overflow-hidden"
            style={{ left: pickerPos.x, top: pickerPos.y, width: 264 }}
          >
            <div className="flex border-b border-border">
              {EMOJI_CATEGORIES.map((cat, i) => (
                <button
                  key={cat.label}
                  type="button"
                  onClick={() => setActiveTab(i)}
                  title={cat.title}
                  className={`flex-1 py-2.5 flex items-center justify-center transition-colors
                               ${activeTab === i ? 'bg-amber/10 border-b-2 border-amber' : 'hover:bg-raised'}`}
                >
                  <Emoji emoji={cat.label} size={18} />
                </button>
              ))}
            </div>
            <div className="p-2 grid grid-cols-8 gap-0.5">
              {EMOJI_CATEGORIES[activeTab].emojis.map((emoji) => {
                const selected = Array.isArray(reactions[emoji]) && reactions[emoji].includes(currentUserId);
                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleReact(emoji)}
                    className={`w-8 h-8 flex items-center justify-center rounded-xl
                                 transition-transform hover:scale-125 active:scale-110
                                 ${selected ? 'bg-amber/20 ring-1 ring-amber/50' : 'hover:bg-raised'}`}
                  >
                    <Emoji emoji={emoji} size={22} />
                  </button>
                );
              })}
            </div>
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}
