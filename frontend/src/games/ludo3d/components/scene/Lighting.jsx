import { Environment, ContactShadows } from '@react-three/drei';

// One key directional light + soft ambient/hemisphere fill + an HDRI
// environment (drei's CDN-hosted preset -- no asset to source/host
// ourselves) for real reflections on the glossy plastic/felt materials.
//
// The directional light does NOT cast a real-time shadow map -- that's a
// full extra scene render every frame (plus PCF filtering), and stacked on
// top of ContactShadows + AO + bloom it was the main source of the
// perceived lag. ContactShadows alone already gives the soft grounded
// shadow the spec asks for, at a fraction of the cost, so the harder
// directional shadow was redundant rather than additive.
export default function Lighting() {
  return (
    <>
      <hemisphereLight args={['#dfe7f2', '#3a2c1e', 0.5]} />
      <ambientLight intensity={0.18} />
      <directionalLight position={[1.6, 2.4, 1.2]} intensity={1.6} />
      <Environment preset="apartment" environmentIntensity={0.6} resolution={128} />
      <ContactShadows position={[0, -0.001, 0]} opacity={0.5} scale={4} blur={2} far={1.2} resolution={256} />
    </>
  );
}
