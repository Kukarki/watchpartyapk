import { useRef, useState, useCallback, useEffect } from 'react';
import Hls from 'hls.js';
import { useRoomStore } from '@/store/roomStore.js';
import { useVideoSync } from '@/hooks/useVideoSync.js';
import { parseVideoUrl } from '@/utils/videoUtils.js';
import PlayerControls from './PlayerControls.jsx';
import YouTubePlayer from './YouTubePlayer.jsx';

export default function VideoPlayer() {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const hideControlsTimer = useRef(null);

  const { videoState } = useRoomStore();
  const { onPlay, onPause, onSeeked } = useVideoSync(videoRef);

  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [buffering, setBuffering] = useState(false);

  // Auto-hide controls
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setShowControls(false);
      }
    }, 3000);
  }, []);

  useEffect(() => {
    return () => clearTimeout(hideControlsTimer.current);
  }, []);

  // ── HLS.js setup ──────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    const url   = videoState.videoUrl;
    if (!video || !url) return;

    const p = parseVideoUrl(url);
    if (p.type !== 'hls') return;

    // Route through our backend proxy to strip CDN CORS restrictions
    const proxyUrl = `/api/v1/proxy/hls?url=${encodeURIComponent(url)}`;

    let hls;
    if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true });
      hls.loadSource(proxyUrl);
      hls.attachMedia(video);
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari — native HLS, also needs proxy
      video.src = proxyUrl;
    }

    return () => hls?.destroy();
  }, [videoState.videoUrl]);

  const handleTimeUpdate = () => {
    setCurrentTime(videoRef.current?.currentTime || 0);
  };

  const handleDurationChange = () => {
    setDuration(videoRef.current?.duration || 0);
  };

  const handleVolumeChange = useCallback((v) => {
    const val = Math.max(0, Math.min(1, v));
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
    }
    setVolume(val);
    setIsMuted(val === 0);
  }, []);

  const handleMuteToggle = useCallback(() => {
    if (!videoRef.current) return;
    const next = !videoRef.current.muted;
    videoRef.current.muted = next;
    setIsMuted(next);
  }, []);

  const handleSeek = useCallback((time) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  }, []);

  const handleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Route YouTube URLs to the embedded IFrame player (no extension needed)
  const parsed = parseVideoUrl(videoState.videoUrl || '');
  if (parsed.type === 'youtube' && parsed.videoId) {
    return <YouTubePlayer videoId={parsed.videoId} />;
  }

  const hasVideo = !!videoState.videoUrl;
  const isHls    = parsed.type === 'hls';

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black flex items-center justify-center group"
      style={{ cursor: showControls ? 'default' : 'none' }}
      onMouseMove={resetHideTimer}
      onMouseLeave={() => {
        if (videoRef.current && !videoRef.current.paused) setShowControls(false);
      }}
    >
      {hasVideo ? (
        <video
          ref={videoRef}
          src={isHls ? undefined : videoState.videoUrl}
          className="w-full h-full object-contain"
          onPlay={onPlay}
          onPause={onPause}
          onSeeked={onSeeked}
          onTimeUpdate={handleTimeUpdate}
          onDurationChange={handleDurationChange}
          onWaiting={() => setBuffering(true)}
          onCanPlay={() => setBuffering(false)}
          onVolumeChange={() => {
            const v = videoRef.current;
            if (v) { setVolume(v.volume); setIsMuted(v.muted); }
          }}
          playsInline
          preload="metadata"
        />
      ) : (
        // Empty state
        <div className="text-center space-y-4 animate-fade-in">
          <div className="text-6xl opacity-40">📽️</div>
          <p className="text-dim text-sm font-mono">No video loaded</p>
          <p className="text-dim/60 text-xs">Set a video URL using the header above</p>
        </div>
      )}

      {/* Buffering spinner */}
      {buffering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-12 h-12 border-4 border-white/20 border-t-amber
                           rounded-full animate-spin" />
        </div>
      )}

      {/* Controls overlay */}
      {hasVideo && (
        <div
          className={`absolute inset-0 transition-opacity duration-300
            ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
          <PlayerControls
            videoRef={videoRef}
            currentTime={currentTime}
            duration={duration}
            volume={volume}
            isMuted={isMuted}
            isFullscreen={isFullscreen}
            onSeek={handleSeek}
            onVolumeChange={handleVolumeChange}
            onMuteToggle={handleMuteToggle}
            onFullscreen={handleFullscreen}
          />
        </div>
      )}
    </div>
  );
}