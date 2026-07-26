import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import Dice from '../scene/Dice.jsx';
import DiceTray from '../scene/DiceTray.jsx';
import { PHYSICS_TIMESTEP } from '../../physics/constants.js';
import { COLOR_HEX } from '../../engine/colors.js';

// A dedicated on-screen dice stage, positioned by the parent (Ludo3DApp.jsx)
// at the top of the screen next to the status text -- matching the old 2D
// game's "dice + status" top row. Own, independent <Canvas> (own WebGL
// context) -- confirmed via isolated testing that a second canvas renders
// correctly in this app's target browsers, and it's dramatically simpler/
// more reliable than sharing the board's canvas through a scissor-
// viewport (tried first; broke on view render-order and never fully
// stabilized). The die is still a genuine, physically-simulated rigid
// body -- own isolated Physics world, same headless-search-then-replay
// mechanism as always (see physics/headlessDiceSearch.js); only the
// render target changed.
export default function DicePanel({ ludoState, isDiceRolling, onRoll, registerDiceRef }) {
  const seat = ludoState.seats[ludoState.currentSeatIndex];
  const isHumanTurn = seat.isHuman;
  const hex = COLOR_HEX[seat.color];

  let message = null;
  if (isDiceRolling) message = 'Rolling...';
  else if (ludoState.phase === 'awaiting-roll') {
    message = isHumanTurn ? 'Your turn -- roll the dice' : `Waiting for ${seat.name}...`;
  } else if (ludoState.phase === 'awaiting-move') {
    message = isHumanTurn ? 'Tap a blinking token to move it' : `${seat.name} rolled ${ludoState.diceValue}...`;
  }

  return (
    <div
      className="flex items-center gap-2.5 px-2.5 py-2 rounded-2xl"
      style={{ background: 'rgba(10,10,10,0.65)', border: `1px solid ${hex}55`, backdropFilter: 'blur(4px)' }}
    >
      <div className="w-[88px] h-[88px] rounded-xl overflow-hidden shrink-0" style={{ background: '#3a2a1a', position: 'relative' }}>
        <Canvas
          camera={{ position: [0, 0.48, 0], rotation: [-Math.PI / 2, 0, 0], fov: 40 }}
          style={{ width: 88, height: 88 }}
          dpr={[1, 2]}
          gl={{ antialias: false }}
          resize={{ debounce: 0 }}
        >
          <color attach="background" args={['#3a2a1a']} />
          <ambientLight intensity={2.2} />
          <directionalLight position={[0.3, 0.8, 0.4]} intensity={1.4} />
          <pointLight position={[0, 0.3, 0]} intensity={0.6} />
          <Suspense fallback={null}>
            <Physics timeStep={PHYSICS_TIMESTEP} gravity={[0, -9.81, 0]}>
              <DiceTray />
              <Dice ref={registerDiceRef} />
            </Physics>
          </Suspense>
        </Canvas>
      </div>

      <div className="flex flex-col items-start gap-1.5">
        {message && (
          <div className="text-sm font-semibold max-w-[170px] leading-tight" style={{ color: hex }}>
            {message}
          </div>
        )}

        {isHumanTurn && ludoState.phase === 'awaiting-roll' && !isDiceRolling && (
          <button
            onClick={onRoll}
            className="px-3.5 py-1.5 rounded-lg font-bold text-sm active:scale-95 transition-transform shadow-lg"
            style={{ background: '#f5a623', color: '#0a0a0a' }}
          >
            🎲 Roll Dice
          </button>
        )}
      </div>
    </div>
  );
}
