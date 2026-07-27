import { useEffect, useRef, useState } from 'react';
import { COLOR_HEX } from '../../engine/colors.js';

// Classic 6-face pip layouts on a 3x3 grid -- identical to the old 2D
// game's DiceFace (components/games/LudoBoard.jsx). Copied verbatim on
// request: the flat white square with dot pips is what reads as "a dice"
// at a glance, whereas a tiny physically-simulated 3D die in its own
// stage (tried first) was hard to see clearly no matter how it was lit
// or framed.
const PIP_LAYOUT = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function DiceFace({ value, rolling }) {
  const active = PIP_LAYOUT[value] || [];
  return (
    <div
      className={`w-[84px] h-[84px] rounded-2xl bg-[#f4f6fa] shadow-inner grid grid-cols-3 grid-rows-3
                  gap-1.5 p-3 shrink-0 ${rolling ? 'animate-[spin_0.5s_linear_infinite]' : ''}`}
    >
      {Array.from({ length: 9 }).map((_, i) => (
        <span key={i} className={`rounded-full ${active.includes(i) ? 'bg-[#141826]' : 'bg-transparent'}`} />
      ))}
    </div>
  );
}

// Dice + status, matching the old 2D game's exact look: a flat pip-face
// die next to the roll button/status text. Real dice fairness still comes
// from the roll provider (engine/rollProvider.js) -- this component is
// purely presentational, cycling a random face while isDiceRolling is
// true (same technique as the old game's rollingFace/setInterval) and
// then landing on the resolved value.
export default function DicePanel({ ludoState, isDiceRolling, onRoll }) {
  const seat = ludoState.seats[ludoState.currentSeatIndex];
  const isHumanTurn = seat.isHuman;
  const hex = COLOR_HEX[seat.color];

  const [rollingFace, setRollingFace] = useState(1);
  const rollIntervalRef = useRef(null);

  useEffect(() => {
    if (isDiceRolling) {
      rollIntervalRef.current = setInterval(() => {
        setRollingFace(1 + Math.floor(Math.random() * 6));
      }, 90);
      return () => clearInterval(rollIntervalRef.current);
    }
    clearInterval(rollIntervalRef.current);
    return undefined;
  }, [isDiceRolling]);

  let message = null;
  if (isDiceRolling) message = 'Rolling...';
  else if (ludoState.phase === 'awaiting-roll') {
    message = isHumanTurn ? 'Your turn -- roll the dice' : `Waiting for ${seat.name}...`;
  } else if (ludoState.phase === 'awaiting-move') {
    message = isHumanTurn ? 'Tap a blinking token to move it' : `${seat.name} rolled ${ludoState.diceValue}...`;
  }

  const displayValue = isDiceRolling ? rollingFace : (ludoState.diceValue ?? 1);

  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 rounded-2xl"
      style={{ background: 'rgba(10,10,10,0.65)', border: `1px solid ${hex}55`, backdropFilter: 'blur(4px)' }}
    >
      <DiceFace value={displayValue} rolling={isDiceRolling} />

      <div className="flex flex-col items-start gap-1.5">
        {message && (
          <div className="text-sm font-semibold max-w-[180px] leading-tight" style={{ color: hex }}>
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
