import { useRef, useEffect } from 'react';
import { CameraControls } from '@react-three/drei';
import { BASE_TOP_LEFT } from '@/components/games/board-layout.js';
import { gridToWorld } from './boardTransform.js';

function cornerCenter(color) {
  const [baseRow, baseCol] = BASE_TOP_LEFT[color];
  return gridToWorld([baseRow + 2.5, baseCol + 2.5]);
}

/**
 * Frames the view from almost directly above the board, biased slightly
 * toward the human player's own seat (home base still reads as "nearest")
 * -- a flat, familiar top-down board-game look rather than an angled 3D
 * perspective shot. Free orbiting (drag/scroll) still works via
 * CameraControls on top of this starting frame, but its polar-angle range
 * is capped so it can't be dragged into a dramatic low, "hanging" angle;
 * `focusColor` gently re-targets (never moves the camera itself) toward
 * whoever's turn it is.
 */
export default function CameraRig({ homeColor = 'red', focusColor }) {
  const controlsRef = useRef(null);
  const lastFocusRef = useRef(null);
  const framedRef = useRef(null);

  useEffect(() => {
    if (!controlsRef.current || framedRef.current === homeColor) return;
    framedRef.current = homeColor;

    const [hx, , hz] = cornerCenter(homeColor);
    const dirX = hx === 0 ? 0 : Math.sign(hx);
    const dirZ = hz === 0 ? 0 : Math.sign(hz);
    // Mostly straight overhead (height dominates the x/z offset), just
    // enough directional lean that "your side" still reads as nearest.
    const camX = dirX * 0.55;
    const camZ = dirZ * 0.55;
    controlsRef.current.setLookAt(camX, 3.0, camZ, 0, 0, 0, false);
  }, [homeColor]);

  useEffect(() => {
    if (!focusColor || !controlsRef.current || focusColor === lastFocusRef.current) return;
    lastFocusRef.current = focusColor;
    const [x, , z] = cornerCenter(focusColor);
    // Blend toward the active corner rather than snapping straight to it --
    // keeps the nudge gentle instead of a hard re-center every turn.
    controlsRef.current.setTarget(x * 0.2, 0, z * 0.2, true);
  }, [focusColor]);

  return (
    <CameraControls
      ref={controlsRef}
      minDistance={1.5}
      maxDistance={5}
      minPolarAngle={0.1}
      maxPolarAngle={Math.PI / 3.4}
      dollyToCursor={false}
    />
  );
}
