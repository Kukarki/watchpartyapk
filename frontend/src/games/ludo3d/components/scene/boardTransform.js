import { GRID_SIZE } from '@/components/games/board-layout.js';

// The one grid<->world mapping used by Board, Pawn, and Dice positioning.
// Accepts fractional row/col too (used for the center-triangle corners),
// not just integer cell centers.
export const CELL_SIZE = 0.1; // 10cm per grid cell -> ~1.5m board
export const BOARD_SURFACE_Y = 0.02; // top face of the board slab

const HALF = (GRID_SIZE - 1) / 2; // 7

/**
 * @param {[number, number]} rowCol
 * @param {number} [y]
 * @returns {[number, number, number]}
 */
export function gridToWorld([row, col], y = BOARD_SURFACE_Y) {
  const x = (col - HALF) * CELL_SIZE;
  const z = (row - HALF) * CELL_SIZE;
  return [x, y, z];
}

export const BOARD_HALF_EXTENT = (GRID_SIZE / 2) * CELL_SIZE; // 0.75
