import { useRef, useState, useCallback } from 'react';

// Lightweight, dependency-free video filters via Canvas 2D's built-in
// `filter` property (same syntax as CSS filter) — no ML/segmentation model,
// unlike background blur which needs a ~50MB TensorFlow.js pipeline.
const FILTERS = {
  none:      'none',
  grayscale: 'grayscale(1)',
  sepia:     'sepia(0.8) saturate(1.3)',
  warm:      'saturate(1.3) hue-rotate(-8deg) brightness(1.05)',
  cool:      'saturate(1.15) hue-rotate(12deg) contrast(1.05)',
  vintage:   'sepia(0.35) contrast(1.1) brightness(0.95) saturate(0.85)',
};

export const FILTER_NAMES = Object.keys(FILTERS);

export function useVideoFilter() {
  const [filter, setFilterState] = useState('none');
  const [processedStream, setProcessedStream] = useState(null);

  const filterRef  = useRef('none');
  const canvasRef  = useRef(null);
  const videoElRef = useRef(null);
  const rafRef     = useRef(null);

  const drawLoop = useCallback(() => {
    const canvas = canvasRef.current;
    const video  = videoElRef.current;
    if (canvas && video && video.readyState >= 2 && video.videoWidth) {
      if (canvas.width !== video.videoWidth) {
        canvas.width  = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      const ctx = canvas.getContext('2d');
      ctx.filter = FILTERS[filterRef.current] || 'none';
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }
    rafRef.current = requestAnimationFrame(drawLoop);
  }, []);

  // Starts filtering the given source stream's video track; returns the filtered stream.
  const start = useCallback((sourceStream) => {
    if (canvasRef.current) return processedStream; // already running
    const videoTrack = sourceStream?.getVideoTracks()[0];
    if (!videoTrack) return null;

    const video = document.createElement('video');
    video.srcObject = new MediaStream([videoTrack]);
    video.muted = true;
    video.playsInline = true;
    video.play().catch(() => {});
    videoElRef.current = video;

    canvasRef.current = document.createElement('canvas');
    drawLoop();

    const stream = canvasRef.current.captureStream(30);
    setProcessedStream(stream);
    return stream;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawLoop]);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    processedStream?.getTracks().forEach((t) => t.stop());
    videoElRef.current?.pause();
    videoElRef.current = null;
    canvasRef.current = null;
    setProcessedStream(null);
    filterRef.current = 'none';
    setFilterState('none');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processedStream]);

  const setFilter = useCallback((name) => {
    if (!FILTERS[name]) return;
    filterRef.current = name;
    setFilterState(name);
  }, []);

  return { filter, filterNames: FILTER_NAMES, processedStream, start, stop, setFilter };
}
