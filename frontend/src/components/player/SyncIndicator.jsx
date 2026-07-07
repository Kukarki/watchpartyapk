import { useState, useEffect, useRef } from 'react';
import { useRoomStore } from '@/store/roomStore.js';

export default function SyncIndicator() {
  const { videoState } = useRoomStore();
  const [show, setShow] = useState(false);
  const [label, setLabel] = useState('');
  const prevState = useRef(videoState);
  const hideTimer = useRef(null);

  useEffect(() => {
    const prev = prevState.current;

    let msg = '';
    if (prev.isPlaying !== videoState.isPlaying) {
      msg = videoState.isPlaying ? '▶ Play' : '⏸ Paused';
    } else if (Math.abs(prev.currentTime - videoState.currentTime) > 3) {
      msg = '⟳ Syncing...';
    } else if (prev.videoUrl !== videoState.videoUrl && videoState.videoUrl) {
      msg = '🎬 New video loaded';
    }

    if (msg) {
      setLabel(msg);
      setShow(true);
      clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setShow(false), 2500);
    }

    prevState.current = videoState;
  }, [videoState]);

  if (!show) return null;

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none
                     animate-fade-in">
      <div className="glass px-4 py-2 rounded-full text-sm font-mono text-bright
                       shadow-cinema">
        {label}
      </div>
    </div>
  );
}