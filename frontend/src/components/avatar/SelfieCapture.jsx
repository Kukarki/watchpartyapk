import { useEffect, useRef, useState, useCallback } from 'react';
import { analyzeSelfie, isSelfieAnalysisSupported } from '@/lib/avatar/selfieAnalysis.js';

// Camera capture -> face analysis modal. Everything happens client-side;
// the photo is drawn to a local <canvas> and never uploaded anywhere.
export default function SelfieCapture({ onResult, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [phase, setPhase] = useState('camera'); // camera | analyzing | error
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!isSelfieAnalysisSupported()) {
      setPhase('error');
      setErrorMsg('Your browser doesn\'t support this feature.');
      return;
    }
    let cancelled = false;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 } }, audio: false })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPhase('error');
          setErrorMsg('Camera access denied. Check your browser permissions.');
        }
      });
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const capture = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    const w = video.videoWidth, h = video.videoHeight;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, w, h);

    setPhase('analyzing');
    try {
      const attrs = await analyzeSelfie(canvas, ctx, w, h);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      onResult(attrs);
    } catch (err) {
      setPhase('error');
      setErrorMsg(err.message || 'Could not analyze that photo — try again with better lighting.');
    }
  }, [onResult]);

  const retry = () => { setPhase('camera'); setErrorMsg(''); };

  return (
    <>
      <div className="fixed inset-0 z-[9998] bg-void/80" onClick={onClose} />
      <div className="fixed z-[9999] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                       w-[92vw] max-w-sm card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <p className="text-sm font-semibold text-bright">Create from selfie</p>
          <button type="button" onClick={onClose} className="text-dim hover:text-bright text-sm">✕</button>
        </div>

        <div className="aspect-square bg-black relative">
          {phase !== 'error' && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover -scale-x-100"
            />
          )}
          {phase === 'analyzing' && (
            <div className="absolute inset-0 bg-void/70 flex flex-col items-center justify-center gap-2">
              <span className="w-6 h-6 border-2 border-amber/30 border-t-amber rounded-full animate-spin" />
              <p className="text-sub text-xs">Analyzing face…</p>
            </div>
          )}
          {phase === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
              <span className="text-3xl">📷</span>
              <p className="text-sub text-sm">{errorMsg}</p>
            </div>
          )}
        </div>

        <div className="p-4">
          {phase === 'camera' && (
            <button onClick={capture} className="btn-primary w-full justify-center py-2.5">
              📸 Capture
            </button>
          )}
          {phase === 'error' && (
            <button onClick={retry} className="btn-ghost border border-border w-full justify-center py-2.5">
              Try again
            </button>
          )}
        </div>
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </>
  );
}
