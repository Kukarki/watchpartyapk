import { Environment, ContactShadows } from '@react-three/drei';

// One key directional light (shadow-casting) + soft ambient/hemisphere
// fill + an HDRI environment (drei's CDN-hosted preset -- no asset to
// source/host ourselves) for real reflections on the glossy plastic/felt
// materials, plus soft grounded contact shadows under the pawns/dice/tray.
export default function Lighting() {
  return (
    <>
      <hemisphereLight args={['#dfe7f2', '#3a2c1e', 0.5]} />
      <ambientLight intensity={0.18} />
      <directionalLight
        position={[1.6, 2.4, 1.2]}
        intensity={1.6}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-1.2}
        shadow-camera-right={1.2}
        shadow-camera-top={1.2}
        shadow-camera-bottom={-1.2}
        shadow-camera-near={0.1}
        shadow-camera-far={5}
      />
      <Environment preset="apartment" environmentIntensity={0.6} />
      <ContactShadows position={[0, -0.001, 0]} opacity={0.55} scale={4} blur={2} far={1.2} />
    </>
  );
}
