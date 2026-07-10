import { useRef } from 'react';
import { useRoomStore } from '@/store/roomStore.js';
import { useVideoSync } from '@/hooks/useVideoSync.js';
import { parseVideoUrl } from '@/utils/videoUtils.js';
import YouTubePlayer from './YouTubePlayer.jsx';

// Music Room's player. YouTube links play through the same synced IFrame
// embed watch-party rooms use; direct audio file URLs play through a plain
// <audio> element wired to the same generic useVideoSync hook (it only
// touches currentTime/paused/play()/pause(), which <audio> shares with
// <video> — no fork needed).
export default function MusicPlayer() {
  const audioRef = useRef(null);
  const { videoState } = useRoomStore();
  const { onPlay, onPause, onSeeked } = useVideoSync(audioRef);

  const parsed = parseVideoUrl(videoState.videoUrl || '');
  const hasTrack = !!videoState.videoUrl;

  return (
    <div className="relative w-full h-full bg-gradient-to-b from-raised to-void
                     flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-40"
           style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 30%, rgba(245,166,35,0.15), transparent)' }} />

      {!hasTrack ? (
        <div className="relative text-center space-y-3 animate-fade-in px-6">
          <div className="text-6xl opacity-50">🎵</div>
          <p className="text-dim text-sm font-mono">No track playing</p>
          <p className="text-dim/60 text-xs">Add a song from the Queue tab</p>
        </div>
      ) : parsed.type === 'youtube' && parsed.videoId ? (
        <div className="relative w-full h-full">
          <YouTubePlayer videoId={parsed.videoId} />
        </div>
      ) : (
        <div className="relative flex flex-col items-center gap-6 px-6 w-full max-w-md">
          <div className="w-48 h-48 rounded-2xl bg-raised border border-border
                           flex items-center justify-center text-6xl shadow-cinema">
            🎧
          </div>
          <audio
            ref={audioRef}
            src={videoState.videoUrl}
            onPlay={onPlay}
            onPause={onPause}
            onSeeked={onSeeked}
            controls
            className="w-full"
          />
        </div>
      )}
    </div>
  );
}
