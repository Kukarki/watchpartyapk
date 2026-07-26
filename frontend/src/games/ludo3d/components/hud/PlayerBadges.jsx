import { COLOR_HEX } from '../../engine/colors.js';

// Styled to match the old 2D game's player row (colored pill, translucent
// tint, "> " prefix on whoever's turn it is, a bot glyph for bots) --
// positioned by the parent (Ludo3DApp.jsx) directly under the dice panel
// at the top of the screen, not as a standalone floating strip.
export default function PlayerBadges({ seats, currentSeatIndex }) {
  return (
    <div className="flex gap-2 flex-wrap justify-center px-4">
      {seats.map((seat, i) => {
        const active = i === currentSeatIndex;
        const hex = COLOR_HEX[seat.color];
        return (
          <div
            key={seat.color}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200"
            style={{
              background: active ? `${hex}30` : 'rgba(0,0,0,0.55)',
              color: hex,
              border: `1.5px solid ${hex}${active ? 'ff' : '77'}`,
              boxShadow: active ? `0 0 14px ${hex}88` : 'none',
            }}
          >
            {active && <span>▶</span>}
            {seat.isBot && <span>🤖</span>}
            {seat.name}
          </div>
        );
      })}
    </div>
  );
}
