import { Html } from '@react-three/drei';
import { BASE_TOP_LEFT } from '@/components/games/board-layout.js';
import { COLOR_HEX } from '../../engine/colors.js';
import { gridToWorld, BOARD_SURFACE_Y } from './boardTransform.js';

// Each player's name badge anchored over their own home base -- matching
// the old 2D board's "name at the top of the house" layout -- instead of a
// separate floating HUD list. Real DOM content (drei's <Html>, screen-space
// projected from the 3D anchor point) rather than a baked canvas-texture
// mesh: normal browser text rendering, no font-loading/positioning
// pitfalls, and it's the same pill style already used elsewhere in this
// game's HUD.
export default function PlayerNameLabels({ seats, currentSeatIndex }) {
  return (
    <>
      {seats.map((seat, i) => {
        const [baseRow, baseCol] = BASE_TOP_LEFT[seat.color];
        const [x, , z] = gridToWorld([baseRow + 0.6, baseCol + 3]);
        const active = i === currentSeatIndex;
        const hex = COLOR_HEX[seat.color];
        return (
          <Html key={seat.color} position={[x, BOARD_SURFACE_Y + 0.02, z]} center style={{ pointerEvents: 'none' }}>
            <div
              className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold whitespace-nowrap"
              style={{
                background: active ? `${hex}35` : 'rgba(0,0,0,0.6)',
                color: hex,
                border: `1.5px solid ${hex}${active ? 'ff' : '99'}`,
                boxShadow: active ? `0 0 10px ${hex}88` : 'none',
              }}
            >
              {active && <span>▶</span>}
              {seat.isBot && <span>🤖</span>}
              {seat.name}
            </div>
          </Html>
        );
      })}
    </>
  );
}
