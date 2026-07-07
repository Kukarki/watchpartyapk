import { useEffect, useRef, useCallback } from 'react';
import { useSocketContext } from '@/contexts/SocketContext.jsx';

const RING_DURATION_MS = 1000;   // tone on  for 1 s
const RING_INTERVAL_MS = 3000;   // repeat every 3 s (1 s tone + 2 s silence)
const AUTO_STOP_MS     = 30000;  // stop after 30 s if nobody joins

/**
 * useCallRinger
 * Plays a synthesised two-tone ring via the Web Audio API whenever a remote
 * participant joins the video call while the local user is NOT yet in it.
 * Stops automatically when the user joins, everyone leaves, or 30 s elapses.
 */
export function useCallRinger(isInCall) {
  const { socket } = useSocketContext();

  const audioCtxRef    = useRef(null);
  const isRingingRef   = useRef(false);
  const ringTimerRef   = useRef(null);
  const autoStopRef    = useRef(null);
  const callCountRef   = useRef(0);   // rough count of call participants
  const isInCallRef    = useRef(isInCall);

  useEffect(() => { isInCallRef.current = isInCall; }, [isInCall]);

  // ── Audio synthesis ───────────────────────────────────────────────────────

  const scheduleRingCycle = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || !isRingingRef.current) return;

    const now = ctx.currentTime;

    // Soft fade-in / fade-out envelope
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.04);
    gain.gain.setValueAtTime(0.12, now + RING_DURATION_MS / 1000 - 0.04);
    gain.gain.linearRampToValueAtTime(0, now + RING_DURATION_MS / 1000);

    // Classic telephone cadence: 480 Hz + 440 Hz
    [480, 440].forEach((freq) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + RING_DURATION_MS / 1000);
    });

    ringTimerRef.current = setTimeout(scheduleRingCycle, RING_INTERVAL_MS);
  }, []);

  const stopRinging = useCallback(() => {
    if (!isRingingRef.current) return;
    isRingingRef.current = false;
    clearTimeout(ringTimerRef.current);
    clearTimeout(autoStopRef.current);
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
  }, []);

  const startRinging = useCallback(() => {
    if (isRingingRef.current || isInCallRef.current) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;
      isRingingRef.current = true;
      scheduleRingCycle();
      autoStopRef.current = setTimeout(stopRinging, AUTO_STOP_MS);
    } catch {
      // AudioContext blocked (e.g., no user gesture yet) — silently skip
    }
  }, [scheduleRingCycle, stopRinging]);

  // ── Socket listeners ──────────────────────────────────────────────────────

  useEffect(() => {
    const s = socket.current;
    if (!s) return;

    const onMemberJoined = () => {
      callCountRef.current += 1;
      startRinging();
    };

    const onMemberLeft = () => {
      callCountRef.current = Math.max(0, callCountRef.current - 1);
      if (callCountRef.current === 0) stopRinging();
    };

    s.on('call:member_joined', onMemberJoined);
    s.on('call:member_left', onMemberLeft);
    return () => {
      s.off('call:member_joined', onMemberJoined);
      s.off('call:member_left', onMemberLeft);
    };
  }, [socket, startRinging, stopRinging]);

  // Stop ringing as soon as the local user joins
  useEffect(() => {
    if (isInCall) stopRinging();
  }, [isInCall, stopRinging]);

  // Cleanup on unmount
  useEffect(() => () => stopRinging(), [stopRinging]);
}
