// Static Ludo board geometry — a 15x15 grid (0-indexed rows/cols). Purely
// presentational: game rules live entirely in the backend (backend/src/games/ludo.js)
// and don't depend on these coordinates at all, only on the abstract
// relative-position numbers. This file just maps those numbers to pixels.

export const GRID_SIZE = 15;

// The 52-cell shared outer track, index 0 = global square 0 (Red's start).
// Matches backend/src/games/ludo.js's COLOR_START_OFFSET (red:0, green:13,
// yellow:26, blue:39) — each color's arm is exactly 13 cells.
export const TRACK = [
  // Red arm (global 0-12)
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
  [0, 7],
  [0, 8],
  // Green arm (global 13-25)
  [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
  [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
  [7, 14],
  [8, 14],
  // Yellow arm (global 26-38)
  [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
  [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
  [14, 7],
  [14, 6],
  // Blue arm (global 39-51)
  [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
  [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
  [7, 0],
  [6, 0],
];

// The 8 squares tokens can't be captured on: each color's start + one star
// square per arm. Must match backend/src/games/ludo.js's SAFE_GLOBAL_SQUARES.
export const SAFE_GLOBAL_SQUARES = [0, 8, 13, 21, 26, 34, 39, 47];

// Each color's private 6-cell home stretch, index 0-5 (relPos 51-56),
// leading from the track into the center finish triangle at (7,7).
export const HOME_STRETCH = {
  red:    [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6]],
  green:  [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]],
  yellow: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 8]],
  blue:   [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7]],
};

export const CENTER = [7, 7];

// Each base is a 6x6 corner square; tokens "at home" sit in a 2x2 pattern
// inside it (relative offsets from the base's top-left corner).
export const BASE_TOP_LEFT = {
  red:    [0, 0],
  green:  [0, 9],
  yellow: [9, 9],
  blue:   [9, 0],
};
const TOKEN_SLOT_OFFSETS = [[1, 1], [1, 4], [4, 1], [4, 4]];

export const COLOR_START_OFFSET = { red: 0, green: 13, yellow: 26, blue: 39 };

export const COLOR_HEX = {
  red:    '#ff4757',
  green:  '#22d3a0',
  yellow: '#f5a623',
  blue:   '#3b82f6',
};

// Resolve a token's { pos, color } to a [row, col] grid cell for rendering.
export function tokenCell(color, pos, tokenIndex) {
  if (pos === 'home') {
    const [baseRow, baseCol] = BASE_TOP_LEFT[color];
    const [dr, dc] = TOKEN_SLOT_OFFSETS[tokenIndex % 4];
    return [baseRow + dr, baseCol + dc];
  }
  if (pos === 'finished') return CENTER;
  if (typeof pos === 'number' && pos <= 50) {
    const global = (COLOR_START_OFFSET[color] + pos) % 52;
    return TRACK[global];
  }
  if (typeof pos === 'number' && pos <= 56) {
    return HOME_STRETCH[color][pos - 51];
  }
  return CENTER;
}
