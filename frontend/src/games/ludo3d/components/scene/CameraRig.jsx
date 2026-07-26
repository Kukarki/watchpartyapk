import { useRef, useEffect } from 'react';
import { CameraControls } from '@react-three/drei';

// Matches the original 2D board's fixed presentation: dead-center overhead,
// board shown as a normal square (red top-left, green top-right, yellow
// bottom-right, blue bottom-left) -- NOT rotated into a 45-degree diamond,
// and not biased toward whichever seat is human. Any off-center or diagonal
// camera offset rotates the board's apparent orientation on screen, which
// read as "too 3D" / unfamiliar compared to the old game. Rotation is
// locked (azimuth + polar) so it can't be dragged into that look by
// accident; a little zoom is still allowed.
export default function CameraRig() {
  const controlsRef = useRef(null);
  const framedRef = useRef(false);

  useEffect(() => {
    if (!controlsRef.current || framedRef.current) return;
    framedRef.current = true;
    // A perfectly vertical camera (x=z=0) is a degenerate look-at case (the
    // up-vector and view direction become parallel) -- a tiny, visually
    // negligible offset keeps the orientation well-defined.
    controlsRef.current.setLookAt(0, 3.1, 0.01, 0, 0, 0, false);
  }, []);

  return (
    <CameraControls
      ref={controlsRef}
      minDistance={2}
      maxDistance={4.5}
      azimuthRotateSpeed={0}
      polarRotateSpeed={0}
      truckSpeed={0}
    />
  );
}
