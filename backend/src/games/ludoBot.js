// Ludo bot AI — decides which legal token to move. Pure function, no I/O.
//
// Strategy: dry-run every legal move through the real engine (applyAction is
// pure, so this is free/safe) and score the resulting events instead of
// duplicating capture/finish detection logic here. This guarantees the bot's
// evaluation always matches the actual rules exactly.
import { ludoGame } from './ludo.js';

function scoreMove(state, playerId, tokenId) {
  const { state: result, events } = ludoGame.applyAction(state, { type: 'move_token', tokenId }, playerId);
  let score = 0;
  if (events.some((e) => e.type === 'game_won')) score += 1000;
  if (events.some((e) => e.type === 'captured')) score += 100;
  if (events.some((e) => e.type === 'token_finished')) score += 80;

  const token = state.tokens[tokenId];
  if (token.pos === 'home') score += 25; // getting a token into play is good
  else score += Math.min(token.pos, 56); // otherwise prefer advancing the furthest token

  // Mild caution: avoid landing somewhere an opponent could capture back next
  // turn, unless this move itself captures (worth the risk) or finishes.
  if (!events.some((e) => e.type === 'captured' || e.type === 'token_finished')) {
    const landed = result.tokens[tokenId];
    if (typeof landed.pos === 'number' && landed.pos <= 50) score -= 5;
  }

  return score;
}

export function pickBotMove(state, playerId) {
  const { legalTokenIds } = state;
  if (!legalTokenIds || legalTokenIds.length === 0) return null;
  if (legalTokenIds.length === 1) return legalTokenIds[0];

  let best = legalTokenIds[0];
  let bestScore = -Infinity;
  for (const tokenId of legalTokenIds) {
    const score = scoreMove(state, playerId, tokenId);
    if (score > bestScore) { bestScore = score; best = tokenId; }
  }
  return best;
}

// Power mode: choose between the two rolled values. A 6 (release a token /
// extra turn) always wins; otherwise take the bigger number for more progress.
export function pickBotDiceChoice(options) {
  if (options.includes(6)) return 6;
  return Math.max(...options);
}

export function makeBotPlayer(roomId, index) {
  return { userId: `bot-${roomId}-${index}`, displayName: `Bot ${index}`, isBot: true };
}

export function isBotUserId(userId) {
  return typeof userId === 'string' && userId.startsWith('bot-');
}
