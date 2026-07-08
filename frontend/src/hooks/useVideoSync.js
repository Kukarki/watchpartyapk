import { useEffect, useRef, useCallback } from 'react';
import { useRoomStore } from '@/store/roomStore.js';
import { useRoomActions } from '@/contexts/RoomContext.jsx';
import { useAuthStore } from '@/store/authStore.js';

const SYNC_THRESHOLD_S = 2; // seconds before we force a seek

/**
 * useVideoSync
 * Connects an <video> ref to the room's shared video state.
 * Returns event handlers to attach to the video element.
 */
export function useVideoSync(videoRef) {
  const { videoState } = useRoomStore();
  const { sendPlay, sendPause, sendSeek } = useRoomActions();
  const { user } = useAuthStore();

  // Track whether the current action is local (ours) or remote
  const isLocalAction = useRef(false);
  const lastSentTime = useRef(0);

  // ── Apply remote state changes to the video element ──────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const { isPlaying, currentTime, updatedAt } = videoState;

    // Compute where server expects us to be, accounting for elapsed time
    const elapsed = isPlaying ? (Date.now() - updatedAt) / 1000 : 0;
    const expectedTime = currentTime + elapsed;

    // Seek if out of sync
    if (Math.abs(video.currentTime - expectedTime) > SYNC_THRESHOLD_S) {
      isLocalAction.current = true;
      video.currentTime = expectedTime;
    }

    // Sync play/pause
    if (isPlaying && video.paused) {
      isLocalAction.current = true;
      video.play().catch(() => {});
    } else if (!isPlaying && !video.paused) {
      isLocalAction.current = true;
      video.pause();
    }
  }, [videoState, videoRef]);

  // ── Local event handlers (user-initiated) ────────────────

  const onPlay = useCallback(() => {
    if (isLocalAction.current) {
      isLocalAction.current = false;
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    sendPlay(video.currentTime);
  }, [sendPlay, videoRef]);

  const onPause = useCallback(() => {
    if (isLocalAction.current) {
      isLocalAction.current = false;
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    sendPause(video.currentTime);
  }, [sendPause, videoRef]);

  const onSeeked = useCallback(() => {
    if (isLocalAction.current) {
      isLocalAction.current = false;
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    const now = Date.now();
    // Debounce: don't spam seek events
    if (now - lastSentTime.current < 300) return;
    lastSentTime.current = now;
    sendSeek(video.currentTime);
  }, [sendSeek, videoRef]);

  return { onPlay, onPause, onSeeked };
}