import { router } from 'expo-router';
// @ts-ignore — JSX module, types resolved at build time
import LudoSoloScreen from '../../../games/ludo/LudoSoloScreen';

export default function LudoSoloRoute() {
  return <LudoSoloScreen onExit={() => router.back()} />;
}
