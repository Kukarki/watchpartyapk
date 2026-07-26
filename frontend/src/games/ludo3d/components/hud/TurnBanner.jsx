import { COLOR_HEX } from '../../engine/colors.js';

// Primary interaction is clicking a highlighted pawn directly (see
// Pawns.jsx), but the legal-move chips here give the same choice as a
// clear, accessible list -- useful when several tokens are hard to tell
// apart at a glance, and a discoverable affordance for what's clickable.
// Rolling/awaiting-roll messaging + the Roll button itself live in
// DicePanel.jsx (docked to the side, next to the physical die) -- this
// banner only covers the move phase, which is about the board itself.
export default function TurnBanner({ ludoState, onMoveToken }) {
  const seat = ludoState.seats[ludoState.currentSeatIndex];
  const isHumanTurn = seat.isHuman;
  const hex = COLOR_HEX[seat.color];

  let message = null;
  if (ludoState.phase === 'awaiting-move') {
    message = isHumanTurn
      ? `Rolled ${ludoState.diceValue} -- pick a highlighted token`
      : `${seat.name} rolled ${ludoState.diceValue}...`;
  }

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2.5">
      {message && (
        <div className="px-4 py-1.5 rounded-full text-sm font-medium" style={{ background: 'rgba(0,0,0,0.6)', color: hex }}>
          {message}
        </div>
      )}

      {isHumanTurn && ludoState.phase === 'awaiting-move' && (
        <div className="flex gap-2 flex-wrap justify-center max-w-md">
          {ludoState.legalTokenIds.map((tokenId) => (
            <button
              key={tokenId}
              onClick={() => onMoveToken(tokenId)}
              className="px-3 py-1.5 rounded-lg text-xs font-mono active:scale-95 transition-transform"
              style={{ background: 'rgba(0,0,0,0.65)', color: hex, border: `1px solid ${hex}` }}
            >
              {tokenId}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
