import { useState, useRef, useCallback } from 'react';

const MAX_LENGTH = 2000;
const EMOJI_OPTIONS = ['👍', '❤️', '😂', '🔥', '🎉', '😍', '👏', '😮', '🙂', '😄', '🤩', '🥳', '😢', '🙏', '💯', '✨', '😎', '🤔', '😡', '😅', '🥰', '🙌', '💖'];

export default function ChatInput({ onSubmit, onTyping, placeholder = 'Say something...' }) {
  const [value, setValue] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef(null);

  const handleChange = (e) => {
    setValue(e.target.value);
    onTyping?.();
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const submit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [value, onSubmit]);

  const insertEmoji = (emoji) => {
    setValue((prev) => `${prev}${prev ? ' ' : ''}${emoji}`);
    setShowEmojiPicker(false);
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (ta) {
        ta.focus();
        ta.setSelectionRange(ta.value.length, ta.value.length);
        ta.style.height = 'auto';
        ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
      }
    });
  };

  const remaining = MAX_LENGTH - value.length;
  const canSend = value.trim().length > 0;

  return (
    <div className="flex items-end gap-2">
      <div className={`flex-1 rounded-xl border transition-colors duration-150 overflow-hidden
                        bg-raised
                        ${canSend
                          ? 'border-amber/40 ring-1 ring-amber/20'
                          : 'border-border'
                        }`}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          maxLength={MAX_LENGTH}
          className="w-full bg-transparent px-3 py-2.5 text-sm text-bright
                      placeholder:text-dim resize-none outline-none
                      max-h-[120px] overflow-y-auto leading-relaxed"
          style={{ height: 'auto' }}
        />
        {value.length > MAX_LENGTH * 0.85 && (
          <div className={`text-right px-3 pb-1 text-[10px] font-mono
            ${remaining < 50 ? 'text-danger' : 'text-dim'}`}>
            {remaining} left
          </div>
        )}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setShowEmojiPicker((prev) => !prev)}
          className="h-9 w-9 flex items-center justify-center rounded-xl border border-border bg-raised text-lg shadow-sm transition hover:bg-amber/10 hover:text-amber focus:outline-none focus:ring-1 focus:ring-amber/30"
          aria-label="Open emoji picker"
          title="Emoji reactions"
        >
          😊
        </button>

        {showEmojiPicker && (
          <div className="absolute bottom-12 right-0 z-10 w-64 rounded-2xl border border-border bg-surface p-2 shadow-2xl shadow-black/20">
            <div className="mb-1 flex items-center justify-between px-1 text-[10px] uppercase tracking-[0.24em] text-dim">
              <span>Quick reactions</span>
              <button
                type="button"
                onClick={() => setShowEmojiPicker(false)}
                className="rounded-full px-2 py-1 text-dim hover:bg-raised hover:text-bright"
                aria-label="Close emoji picker"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-6 gap-1">
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => insertEmoji(emoji)}
                  className="h-9 w-9 rounded-xl text-lg transition hover:scale-105 hover:bg-amber/10 focus:outline-none focus:ring-1 focus:ring-amber/30"
                  aria-label={`Insert ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <button
        onClick={submit}
        disabled={!canSend}
        className="w-9 h-9 flex items-center justify-center rounded-xl shrink-0
                    transition-all duration-150 active:scale-90
                    disabled:opacity-30 disabled:cursor-not-allowed
                    bg-amber text-void hover:bg-amber-dark shadow-glow-sm"
        aria-label="Send message"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M2 21L23 12 2 3v7l15 2-15 2v7z" />
        </svg>
      </button>
    </div>
  );
}