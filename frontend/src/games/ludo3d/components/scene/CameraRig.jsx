import { useRef, useEffect } from 'react';
import { CameraControls } from '@react-three/drei';
import { BASE_TOP_LEFT } from '@/components/games/board-layout.js';
import { gridToWorld } from './boardTransform.js';

function cornerCenter(color) {
  const [baseRow, baseCol] = BASE_TOP_LEFT[color];
  return gridToWorld([baseRow + 2.5, baseCol + 2.5]);
}

/**
 * Frames the view from the human player's own seat -- looking straight
 * across the board from their side, home base nearest the camera, the way
 * you'd actually sit at a table -- instead of an arbitrary generic angle.
 * Free orbiting (drag/scroll) still works via CameraControls on top of
 * this starting frame; `focusColor` gently re-targets (never moves the
 * camera itself) toward whoever's turn it is.
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
    // Pulled back beyond the board edge along the seat's own diagonal, at a
    // flatter, more eye-level angle than a top-down drone shot.
    const camX = dirX * 1.55;
    const camZ = dirZ * 1.55;
    controlsRef.current.setLookAt(camX, 1.05, camZ, 0, 0, 0, false);
  }, [homeColor]);

  useEffect(() => {
    if (!focusColor || !controlsRef.current || focusColor === lastFocusRef.current) return;
    lastFocusRef.current = focusColor;
    const [x, , z] = cornerCenter(focusColor);
    // Blend toward the active corner rather than snapping straight to it --
    // keeps the nudge gentle instead of a hard re-center every turn.
    controlsRef.current.setTarget(x * 0.3, 0, z * 0.3, true);
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
