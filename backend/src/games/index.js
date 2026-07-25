import { ludoGame } from './ludo.js';
import { pickBotMove, pickBotDiceChoice } from './ludoBot.js';

// Add new games here — one module per game, each exporting
// { createInitialState(players), applyAction(state, action, playerId) }.
// `pickBotMove(state, playerId)` is optional — games without it simply never
// get bot-driven turns (the socket layer skips scheduling them).
export const GAME_MODULES = {
  ludo: { ...ludoGame, pickBotMove, pickBotDiceChoice },
};
