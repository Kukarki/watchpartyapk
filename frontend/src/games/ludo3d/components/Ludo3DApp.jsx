import { Suspense, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import Dice from './scene/Dice.jsx';
import DiceTray from './scene/DiceTray.jsx';
import Board from './scene/Board.jsx';
import Ground from './scene/Ground.jsx';
import Pawns from './scene/Pawns.jsx';
import Lighting from './scene/Lighting.jsx';
import CameraRig from './scene/CameraRig.jsx';
import Effects from './scene/Effects.jsx';
import SetupScreen from './hud/SetupScreen.jsx';
import PlayerBadges from './hud/PlayerBadges.jsx';
import TurnBanner from './hud/TurnBanner.jsx';
import WinnerModal from './hud/WinnerModal.jsx';
import { useLudo3DController } from '../state/useLudo3DStore.js';
import { assignSeats } from '../engine/index.js';
import { PHYSICS_TIMESTEP } from '../physics/constants.js';
import { freeHeadlessDieWorld } from '../physics/rapierSetup.js';

export default function Ludo3DApp() {
  const {
    ludoState, isDiceRolling, startGame, rollForCurrentSeat, moveToken,
    registerDiceRef, registerPawnRef,
  } = useLudo3DController();
  const [started, setStarted] = useState(false);

  // The headless search world (physics/rapierSetup.js) owns WASM linear
  // memory that JS's GC won't reclaim on its own -- free it when this page
  // unmounts (navigating back to Games, etc).
  useEffect(() => () => freeHeadlessDieWorld(), []);

  const handleStart = (count) => {
    startGame(assignSeats(count, 'red'));
    setStarted(true);
  };

  const handlePlayAgain = () => setStarted(false);

  const currentSeat = ludoState?.seats[ludoState.currentSeatIndex];
  const canMove = ludoState?.phase === 'awaiting-move';
  const highlightableTokenIds = canMove && currentSeat?.isHuman ? ludoState.legalTokenIds : [];

  return (
    <div className="relative w-full h-full">
      <Canvas camera={{ position: [0, 3.1, 0.01], fov: 42 }} dpr={[1, 1.5]} gl={{ antialias: false, powerPreference: 'high-performance' }}>
        <color attach="background" args={['#161210']} />
        <Lighting />
        <Suspense fallback={null}>
          <Ground />
          <Board />
          {ludoState && (
            <Pawns
              seats={ludoState.seats}
              tokens={ludoState.tokens}
              highlightableTokenIds={highlightableTokenIds}
              onTokenClick={moveToken}
              registerPawnRef={registerPawnRef}
            />
          )}
          <Physics timeStep={PHYSICS_TIMESTEP} gravity={[0, -9.81, 0]}>
            <DiceTray />
            <Dice ref={registerDiceRef} />
          </Physics>
          <Effects />
        </Suspense>
        <CameraRig />
      </Canvas>

      {!started && <SetupScreen onStart={handleStart} />}

      {started && ludoState && ludoState.phase !== 'game-over' && (
        <>
          <PlayerBadges seats={ludoState.seats} currentSeatIndex={ludoState.currentSeatIndex} />
          <TurnBanner
            ludoState={ludoState}
            isDiceRolling={isDiceRolling}
            onRoll={rollForCurrentSeat}
            onMoveToken={moveToken}
          />
        </>
      )}

      {started && ludoState?.phase === 'game-over' && (
        <WinnerModal
          seat={ludoState.seats.find((s) => s.color === ludoState.winner)}
          onPlayAgain={handlePlayAgain}
        />
      )}
    </div>
  );
}
