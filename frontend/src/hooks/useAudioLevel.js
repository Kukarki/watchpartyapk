import { useEffect, useRef, useState } from 'react';

const SPEAKING_THRESHOLD = 0.08;

/**
 * useAudioLevel
 * Real voice-activity level (0-1) for a MediaStream, via an AnalyserNode —
 * replaces the old "speaking = !isMuted" proxy with an actual amplitude read.
 */
export function useAudioLevel(stream) {
  const [level, setLevel] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!stream || stream.getAudioTracks().length === 0) {
      setLevel(0);
      return;
    }

    let audioCtx;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return;
    }
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.6;
    source.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      setLevel(sum / data.length / 255);
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(rafRef.current);
      source.disconnect();
      analyser.disconnect();
      audioCtx.close().catch(() => {});
    };
  }, [stream]);

  return level;
}

/** Convenience boolean wrapper around useAudioLevel for speaking-ring UI. */
export function useIsSpeaking(stream, threshold = SPEAKING_THRESHOLD) {
  const level = useAudioLevel(stream);
  return level > threshold;
}
