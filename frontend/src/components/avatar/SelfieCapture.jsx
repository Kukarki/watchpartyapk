import { useRef, useEffect, useState } from 'react';
import { estimateAvatarColors } from '@/lib/selfieColorMatch.js';

// Camera capture + on-device color estimation — no upload, no third-party
// API. onResult receives { skinColor, hairColor } as hex strings already
// snapped to the given palettes.
export default function SelfieCapture({ skinPalette, hairPalette, onResult, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    navigator.mediaDevices?.getUserMedia?.({ video: { facingMode: 'user' } })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => setReady(true);
        }
      })
      .catch(() => setError("Couldn't access your camera — check browser permissions."));

    return () => streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const result = estimateAvatarColors(canvas, { skinPalette, hairPalette });
    onResult(result);
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-void/90 flex items-center justify-center p-4 animate-fade-in">
      <div className="relative w-full max-w-sm rounded-2xl overflow-hidden border border-border bg-surface animate-slide-up">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-void/70 text-bright
                     flex items-center justify-center hover:bg-void transition-colors"
        >
          ✕
        </button>

        <div className="p-5 space-y-4">
          <div>
            <h2 className="font-display font-semibold text-bright text-base">Create from selfie</h2>
            <p className="text-dim text-xs mt-1">
              Center your face in frame — we'll estimate your skin and hair color from the
              photo. It stays on your device, nothing is uploaded.
            </p>
          </div>

          {error ? (
            <p className="text-danger text-xs bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{error}</p>
          ) : (
            <div className="relative aspect-square rounded-xl overflow-hidden bg-void border border-border">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
              {/* Face-guide oval */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-[55%] h-[70%] rounded-[50%] border-2 border-amber/60" />
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleCapture}
            disabled={!ready || !!error}
            className="btn-primary w-full justify-center py-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            📸 Capture
          </button>
        </div>
      </div>
    </div>
  );
}
