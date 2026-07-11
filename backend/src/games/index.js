import { ludoGame } from './ludo.js';

// Add new games here — one module per game, each exporting
// { createInitialState(players), applyAction(state, action, playerId) }.
export const GAME_MODULES = {
  ludo: ludoGame,
};
