import { COLOR_HEX as BASE_COLOR_HEX } from '@/components/games/board-layout.js';

// The 2D game's green (#22d3a0, a light mint/teal) reads as washed-out/too
// close to white against the 3D board's cream felt and pawn-placement
// slots. Overridden here, not in board-layout.js, so the shared 2D
// multiplayer board's palette is untouched.
export const COLOR_HEX = { ...BASE_COLOR_HEX, green: '#16a34a' };
