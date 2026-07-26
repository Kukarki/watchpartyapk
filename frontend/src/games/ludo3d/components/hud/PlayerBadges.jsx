import { COLOR_HEX } from '../../engine/colors.js';

export default function PlayerBadges({ seats, currentSeatIndex }) {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-2 flex-wrap justify-center px-4">
      {seats.map((seat, i) => {
        const active = i === currentSeatIndex;
        const hex = COLOR_HEX[seat.color];
        return (
          <div
            key={seat.color}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200"
            style={{
              background: active ? hex : 'rgba(0,0,0,0.55)',
              color: active ? '#0a0a0a' : '#e5e5e5',
              border: `1px solid ${hex}`,
              boxShadow: active ? `0 0 14px ${hex}88` : 'none',
            }}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: active ? '#0a0a0a' : hex }} />
            {seat.name}
          </div>
        );
      })}
    </div>
  );
}
