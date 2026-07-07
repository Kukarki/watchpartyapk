import { useCallback } from 'react';
import { useRoomStore } from '@/store/roomStore.js';
import { formatDuration } from '@/utils/format.js';

export default function PlayerControls({
  videoRef,
  currentTime,
  duration,
  volume,
  isMuted,
  isFullscreen,
  onSeek,
  onVolumeChange,
  onMuteToggle,
  onFullscreen,
}) {
  const { videoState } = useRoomStore();
  const isPlaying = videoState.isPlaying;

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  }, [videoRef]);

  const handleProgressClick = useCallback((e) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    onSeek(ratio * duration);
  }, [duration, onSeek]);

  const progress = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className="absolute inset-0 flex flex-col justify-end">
      {/* Gradient */}
      <div className="player-overlay absolute inset-0 pointer-events-none" />

      {/* Controls bar */}
      <div className="relative z-10 px-4 pb-4 pt-16 space-y-2">
        {/* Progress bar */}
        <div
          className="w-full h-1 bg-white/20 rounded-full cursor-pointer group/progress
                      hover:h-2 transition-all duration-150"
          onClick={handleProgressClick}
          role="slider"
          aria-label="Video progress"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-amber rounded-full relative"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2
                             w-3 h-3 bg-amber rounded-full shadow-glow-sm
                             opacity-0 group-hover/progress:opacity-100
                             transition-opacity duration-150" />
          </div>
        </div>

        {/* Buttons row */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            className="w-10 h-10 flex items-center justify-center rounded-full
                        bg-white/10 hover:bg-white/20 text-white
                        transition-colors duration-150 text-lg"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>

          {/* Volume */}
          <div className="flex items-center gap-2 group/vol">
            <button
              onClick={onMuteToggle}
              className="text-white/70 hover:text-white transition-colors text-lg"
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              className="w-0 group-hover/vol:w-20 overflow-hidden transition-all duration-200"
              aria-label="Volume"
            />
          </div>

          {/* Time */}
          <span className="text-white/70 text-xs font-mono ml-1 hidden sm:block">
            {formatDuration(currentTime)} / {formatDuration(duration)}
          </span>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Fullscreen */}
          <button
            onClick={onFullscreen}
            className="text-white/70 hover:text-white transition-colors text-lg"
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? '⊡' : '⛶'}
          </button>
        </div>
      </div>
    </div>
  );
}