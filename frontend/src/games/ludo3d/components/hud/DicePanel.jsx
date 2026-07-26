import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import Dice from '../scene/Dice.jsx';
import DiceTray from '../scene/DiceTray.jsx';
import { PHYSICS_TIMESTEP } from '../../physics/constants.js';
import { COLOR_HEX } from '@/components/games/board-layout.js';

// A dedicated on-screen dice stage docked to the side of the screen --
// matching the old 2D game's small fixed "dice card" UI -- instead of a
// tray sitting in-world next to the board. Own, independent <Canvas> (own
// WebGL context): confirmed via isolated testing that a second canvas
// renders correctly in this app's target browsers, and it's dramatically
// simpler/more reliable than sharing the board's canvas through a
// scissor-viewport (tried first; broke on view render-order and never
// fully stabilized). The die is still a genuine, physically-simulated
// rigid body -- own isolated Physics world, same headless-search-then-
// replay mechanism as always (see physics/headlessDiceSearch.js); only
// the render target changed.
export default function DicePanel({ ludoState, isDiceRolling, onRoll, registerDiceRef }) {
  const seat = ludoState.seats[ludoState.currentSeatIndex];
  const isHumanTurn = seat.isHuman;
  const hex = COLOR_HEX[seat.color];

  let message = null;
  if (isDiceRolling) message = 'Rolling...';
  else if (ludoState.phase === 'awaiting-roll') {
    message = isHumanTurn ? 'Your turn' : `${seat.name}...`;
  } else if (ludoState.phase === 'awaiting-move') {
    message = isHumanTurn ? `Rolled ${ludoState.diceValue}` : `${seat.name} rolled ${ludoState.diceValue}`;
  }

  return (
    <div
      className="absolute top-1/2 right-3 -translate-y-1/2 flex flex-col items-center gap-2 p-3 rounded-2xl"
      style={{ background: 'rgba(10,10,10,0.65)', border: `1px solid ${hex}55`, backdropFilter: 'blur(4px)' }}
    >
      {message && (
        <div className="text-xs font-medium px-1 text-center max-w-[100px]" style={{ color: hex }}>
          {message}
        </div>
      )}

      <div className="w-[110px] h-[110px] rounded-xl overflow-hidden shrink-0" style={{ background: '#3a2a1a', position: 'relative' }}>
        <Canvas
          camera={{ position: [0, 0.5, 0], rotation: [-Math.PI / 2, 0, 0], fov: 40 }}
          style={{ width: 110, height: 110 }}
          dpr={[1, 1.5]}
          gl={{ antialias: false }}
          resize={{ debounce: 0 }}
        >
          <color attach="background" args={['#3a2a1a']} />
          <ambientLight intensity={0.9} />
          <directionalLight position={[0.3, 0.8, 0.4]} intensity={1.6} />
          <Suspense fallback={null}>
            <Physics timeStep={PHYSICS_TIMESTEP} gravity={[0, -9.81, 0]}>
              <DiceTray />
              <Dice ref={registerDiceRef} />
            </Physics>
          </Suspense>
        </Canvas>
      </div>

      {isHumanTurn && ludoState.phase === 'awaiting-roll' && !isDiceRolling && (
        <button
          onClick={onRoll}
          className="px-4 py-2 rounded-lg font-bold text-sm active:scale-95 transition-transform shadow-lg"
          style={{ background: '#f5a623', color: '#0a0a0a' }}
        >
          🎲 Roll
        </button>
      )}
    </div>
  );
}
