import { EffectComposer, N8AO, Bloom, SMAA, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';

// Soft ambient occlusion + a light bloom (specular pop on the glossy
// plastic/pip highlights) + AA + filmic tone mapping. Kept subtle per spec
// ("clean, not overdone") -- canvas MSAA is left off (see Ludo3DApp.jsx's
// <Canvas> gl props) so SMAA here is the only antialiasing pass.
export default function Effects() {
  return (
    <EffectComposer multisampling={0}>
      <N8AO intensity={1.5} aoRadius={0.1} distanceFalloff={1} quality="performance" halfRes />
      <Bloom intensity={0.2} luminanceThreshold={0.7} luminanceSmoothing={0.2} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <SMAA />
    </EffectComposer>
  );
}
