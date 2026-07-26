import { useRef, useEffect } from 'react';
import { CameraControls } from '@react-three/drei';
import { BASE_TOP_LEFT } from '@/components/games/board-layout.js';
import { gridToWorld } from './boardTransform.js';

// Free smooth orbiting (drag/scroll) via drei's CameraControls, plus a
// gentle re-target (not a hard camera move -- just where the controls'
// pivot points) toward whichever seat's corner is currently active, so the
// view eases toward the action without fighting the player's own orbiting.
export default function CameraRig({ focusColor }) {
  const controlsRef = useRef(null);
  const lastFocusRef = useRef(null);

  useEffect(() => {
    if (!focusColor || !controlsRef.current || focusColor === lastFocusRef.current) return;
    lastFocusRef.current = focusColor;
    const [baseRow, baseCol] = BASE_TOP_LEFT[focusColor];
    const [x, , z] = gridToWorld([baseRow + 2.5, baseCol + 2.5]);
    // Blend toward the active corner rather than snapping straight to it --
    // keeps the nudge gentle instead of a hard re-center every turn.
    controlsRef.current.setTarget(x * 0.35, 0, z * 0.35, true);
  }, [focusColor]);

  return (
    <CameraControls
      ref={controlsRef}
      minDistance={1}
      maxDistance={3.5}
      maxPolarAngle={Math.PI / 2.15}
      dollyToCursor={false}
    />
  );
}
