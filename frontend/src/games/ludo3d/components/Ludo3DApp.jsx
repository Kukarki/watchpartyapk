import { Suspense, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import Board from './scene/Board.jsx';
import Ground from './scene/Ground.jsx';
import Pawns from './scene/Pawns.jsx';
import PlayerNameLabels from './scene/PlayerNameLabels.jsx';
import Lighting from './scene/Lighting.jsx';
import CameraRig from './scene/CameraRig.jsx';
import Effects from './scene/Effects.jsx';
import SetupScreen from './hud/SetupScreen.jsx';
import TurnBanner from './hud/TurnBanner.jsx';
import DicePanel from './hud/DicePanel.jsx';
import WinnerModal from './hud/WinnerModal.jsx';
import { useLudo3DController } from '../state/useLudo3DStore.js';
import { assignSeats } from '../engine/index.js';
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
  const showHud = started && ludoState && ludoState.phase !== 'game-over';

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Dice + status, kept in normal document flow above the board --
          same technique the old 2D game used ("kept above the board so
          it's never scrolled out of view") -- so it can never overlap the
          board underneath it; the board's canvas simply gets whatever
          vertical space is left below this row. */}
      {showHud && (
        <div className="shrink-0 flex justify-center pt-3 pb-2">
          <DicePanel
            ludoState={ludoState}
            isDiceRolling={isDiceRolling}
            onRoll={rollForCurrentSeat}
            registerDiceRef={registerDiceRef}
          />
        </div>
      )}

      <div className="relative flex-1 min-h-0">
        <Canvas camera={{ position: [0, 2.35, 0.01], fov: 42 }} dpr={[1, 2]} gl={{ antialias: false, powerPreference: 'high-performance' }}>
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
            <Effects />
          </Suspense>
          {/* Its own Suspense boundary, isolated from the board/pawns above:
              drei's <Text> loads its font asynchronously, and a slow/failed
              load must never hide the entire board while it waits. */}
          <Suspense fallback={null}>
            {ludoState && (
              <PlayerNameLabels seats={ludoState.seats} currentSeatIndex={ludoState.currentSeatIndex} />
            )}
          </Suspense>
          <CameraRig />
        </Canvas>

        {!started && <SetupScreen onStart={handleStart} />}

        {showHud && (
          <TurnBanner
            ludoState={ludoState}
            onMoveToken={moveToken}
          />
        )}

        {started && ludoState?.phase === 'game-over' && (
          <WinnerModal
            seat={ludoState.seats.find((s) => s.color === ludoState.winner)}
            onPlayAgain={handlePlayAgain}
          />
        )}
      </div>
    </div>
  );
}
