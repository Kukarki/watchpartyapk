import { COLOR_HEX } from '../../engine/colors.js';

export default function WinnerModal({ seat, onPlayAgain }) {
  const hex = COLOR_HEX[seat.color];
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.78)' }}>
      <div
        className="text-center px-10 py-8 rounded-2xl space-y-4"
        style={{ background: 'rgba(18,18,18,0.95)', border: `2px solid ${hex}`, boxShadow: `0 0 32px ${hex}55` }}
      >
        <div className="text-5xl">🏆</div>
        <h2 className="text-2xl font-bold" style={{ color: hex }}>{seat.name} wins!</h2>
        <button
          onClick={onPlayAgain}
          className="px-5 py-2.5 rounded-lg font-bold active:scale-95 transition-transform"
          style={{ background: '#f5a623', color: '#0a0a0a' }}
        >
          Play Again
        </button>
      </div>
    </div>
  );
}
