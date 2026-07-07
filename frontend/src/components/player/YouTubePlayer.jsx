/**
 * YouTubePlayer
 * Embeds a YouTube video via the IFrame API and keeps it in sync with the
 * room's shared video state. Works in any browser — no extension required.
 *
 * Sync strategy:
 *   - onStateChange fires for play/pause → broadcast to room
 *   - Poll getCurrentTime() every second to detect user seeks
 *   - Apply remote state (from socket) by calling playVideo/pauseVideo/seekTo
 *   - isRemote flag prevents echo-broadcasting remote-triggered events
 */

import { useEffect, useRef, useCallback } from 'react';
import { useRoomStore } from '@/store/roomStore.js';
import { useRoomActions } from '@/contexts/RoomContext.jsx';

const SYNC_THRESHOLD = 2; // seconds of drift before we force a seek

// Load the YouTube IFrame API once across the whole app.
let ytApiPromise = null;
function loadYouTubeAPI() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(script);
    window.onYouTubeIframeAPIReady = () => resolve(window.YT);
  });
  return ytApiPromise;
}

export default function YouTubePlayer({ videoId }) {
  const mountRef      = useRef(null);  // div the IFrame mounts into
  const playerRef     = useRef(null);  // YT.Player instance
  const isRemote      = useRef(false); // true when an action came from a socket event
  const prevTime      = useRef(0);     // last polled time (for seek detection)
  const lastSeekAt    = useRef(0);     // timestamp of last seek broadcast
  const applyStateRef = useRef(null);  // always-current version of applyRoomState
  const readyRef      = useRef(false); // whether the player is ready

  const { videoState } = useRoomStore();
  const { sendPlay, sendPause, sendSeek, requestSync } = useRoomActions();

  // ── Create / reload player when videoId changes ───────────
  useEffect(() => {
    let cancelled = false;

    loadYouTubeAPI().then((YT) => {
      if (cancelled || !mountRef.current) return;

      // If player already exists just swap the video
      if (playerRef.current?.loadVideoById) {
        playerRef.current.loadVideoById(videoId);
        readyRef.current = false;
        return;
      }

      playerRef.current = new YT.Player(mountRef.current, {
        videoId,
        width:  '100%',
        height: '100%',
        playerVars: {
          autoplay:       0,
          controls:       1,   // use YouTube's native controls
          rel:            0,
          modestbranding: 1,
          iv_load_policy: 3,
          origin:         window.location.origin, // 👈 FIXED: allows postMessage
        },
        events: {
          onReady: () => {
            readyRef.current = true;
            requestSync();
            applyStateRef.current?.();
          },
          onError: (e) => {
            const errors = {
              2:   'Invalid video ID',
              5:   'Video cannot play in embedded player',
              100: 'Video not found or private',
              101: 'Video owner has disabled embedding',
              150: 'Video owner has disabled embedding',
            };
            console.error('YouTube Error:', errors[e.data] || `Error code ${e.data}`);
          },
          onStateChange: (e) => {
            const { PlayerState } = window.YT;
            const t = playerRef.current?.getCurrentTime?.() ?? 0;

            if (e.data === PlayerState.PLAYING) {
              if (!isRemote.current) sendPlay(t);
              isRemote.current = false;
            } else if (e.data === PlayerState.PAUSED) {
              if (!isRemote.current) sendPause(t);
              isRemote.current = false;
            }
          },
        },
      });
    });

    return () => { cancelled = true; };
  }, [requestSync, videoId]);

  // ── Detect user seeks by polling current time ─────────────
  useEffect(() => {
    const id = setInterval(() => {
      const p = playerRef.current;
      if (!p?.getPlayerState || !window.YT?.PlayerState) return;
      if (p.getPlayerState() !== window.YT.PlayerState.PLAYING) return;

      const now  = p.getCurrentTime?.() ?? 0;
      const prev = prevTime.current;
      prevTime.current = now;

      // Natural playback advances ~1 s/s; a bigger jump is a seek
      const jumped   = Math.abs(now - (prev + 1)) > 3;
      const cooldown = Date.now() - lastSeekAt.current > 1000;
      if (jumped && cooldown) {
        lastSeekAt.current = Date.now();
        sendSeek(now);
      }
    }, 1000);

    return () => clearInterval(id);
  }, [sendSeek]);

  // ── Apply remote videoState changes ───────────────────────
  const applyRoomState = useCallback((state = videoState) => {
    const p = playerRef.current;
    if (!p?.getPlayerState || !window.YT?.PlayerState) return;

    const { isPlaying, currentTime, updatedAt } = state;
    if (!readyRef.current || !updatedAt) return; // wait for the player to be ready

    const elapsed  = isPlaying ? (Date.now() - updatedAt) / 1000 : 0;
    const expected = Math.max(0, currentTime + elapsed);
    const actual   = p.getCurrentTime?.() ?? 0;
    const state_   = p.getPlayerState?.();
    const playing  = state_ === window.YT.PlayerState.PLAYING;

    if (Math.abs(actual - expected) > SYNC_THRESHOLD) {
      isRemote.current   = true;
      lastSeekAt.current = Date.now();
      prevTime.current   = expected;
      p.seekTo?.(expected, true);
    }

    if (isPlaying && !playing) {
      isRemote.current = true;
      setTimeout(() => {
        p.playVideo?.();
        isRemote.current = false;
      }, 120);
    } else if (!isPlaying && playing) {
      isRemote.current = true;
      p.pauseVideo?.();
      isRemote.current = false;
    }
  }, [videoState]);

  // Keep the ref pointing to the latest bound version so onReady can call it
  applyStateRef.current = () => applyRoomState(videoState);

  useEffect(() => {
    applyRoomState(videoState);
  }, [videoState, applyRoomState]);

  return (
    <div className="w-full h-full bg-black">
      <div ref={mountRef} className="w-full h-full" />
    </div>
  );
}