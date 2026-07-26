import { useMemo } from 'react';
import { getWoodColorTexture } from './proceduralTextures.js';

// A large surface beneath the board + dice tray so the scene reads as
// "sitting on a table" instead of floating in a black void -- the board's
// own felt/wood only covers its own footprint, so without this the camera
// pull-back exposed bare background on every side.
export default function Ground() {
  const map = useMemo(() => getWoodColorTexture('#20140c', { size: 256, repeat: 8 }), []);
  return (
    <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[9, 9]} />
      <meshStandardMaterial map={map} roughness={0.95} metalness={0} />
    </mesh>
  );
}
