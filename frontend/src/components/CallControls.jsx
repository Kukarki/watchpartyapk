/**
 * CallControls
 * Mute / camera / background-blur / minimize / hang-up buttons.
 * `isMinimized` switches to a compact icon-only row with touch-safe sizing.
 */
export default function CallControls({
  isMuted,
  isCameraOff,
  isBlurOn      = false,
  isBlurLoading = false,
  onToggleMute,
  onToggleCamera,
  onToggleBlur,
  onLeave,
  onToggleMinimize,
  isMinimized = false,
}) {
  const base = `flex items-center justify-center rounded-full select-none
                transition-all duration-150 active:scale-90 touch-manipulation`;

  // Minimized: 40 px (comfortable touch target), expanded: 44 px
  const sz = isMinimized ? 'w-10 h-10 text-base' : 'w-11 h-11 text-lg';

  const neutral  = 'bg-raised border border-border text-sub hover:text-bright hover:border-bright/20';
  const active   = 'bg-danger/20 border border-danger/40 text-danger hover:bg-danger/30';
  const blurOn   = 'bg-info/20 border border-info/40 text-info hover:bg-info/30';

  return (
    <div className={`flex items-center justify-center ${isMinimized ? 'gap-2' : 'gap-3'}`}>

      {/* Mute */}
      <button
        onClick={onToggleMute}
        title={isMuted ? 'Unmute' : 'Mute'}
        className={`${base} ${sz} ${isMuted ? active : neutral}`}
      >
        {isMuted ? '🔇' : '🎙️'}
      </button>

      {/* Camera */}
      <button
        onClick={onToggleCamera}
        title={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
        className={`${base} ${sz} ${isCameraOff ? active : neutral}`}
      >
        {isCameraOff ? '📷' : '🎥'}
      </button>

      {/* Background blur — hidden if handler not provided */}
      {onToggleBlur && (
        <button
          onClick={onToggleBlur}
          disabled={isBlurLoading}
          title={isBlurOn ? 'Disable background blur' : 'Blur background'}
          className={`${base} ${sz} ${isBlurOn ? blurOn : neutral}
                       disabled:opacity-40 disabled:cursor-wait`}
        >
          {isBlurLoading ? '⏳' : '🌫️'}
        </button>
      )}

      {/* Minimize / expand */}
      {onToggleMinimize && (
        <button
          onClick={onToggleMinimize}
          title={isMinimized ? 'Expand' : 'Minimize'}
          className={`${base} ${sz} ${neutral}`}
        >
          {isMinimized ? '⬆' : '⬇'}
        </button>
      )}

      {/* Hang up */}
      <button
        onClick={onLeave}
        title="Leave call"
        className={`${base} ${sz} bg-danger/20 border border-danger/30 text-danger hover:bg-danger/30`}
      >
        📵
      </button>

    </div>
  );
}
