import { SAFE_GLOBAL_SQUARES, COLOR_START_OFFSET } from '@/components/games/board-layout.js';

function globalSquare(color, pos) {
  return (COLOR_START_OFFSET[color] + pos) % 52;
}

// Priority tiers, highest first: finish a token > capture (bigger bonus the
// further the victim had traveled) > leave base > land on a safe square >
// otherwise advance whichever token is already furthest along.
function scoreMove(state, color, tokenId, diceValue) {
  const token = state.tokens[tokenId];
  const wasHome = token.pos === 'home';
  const newPos = wasHome ? 0 : token.pos + diceValue;

  if (newPos === 57) return 1000;

  let captureBonus = 0;
  if (newPos <= 50) {
    const landedGlobal = globalSquare(color, newPos);
    if (!SAFE_GLOBAL_SQUARES.includes(landedGlobal)) {
      for (const otherToken of Object.values(state.tokens)) {
        if (otherToken.color === color) continue;
        if (typeof otherToken.pos !== 'number' || otherToken.pos > 50) continue;
        if (globalSquare(otherToken.color, otherToken.pos) === landedGlobal) {
          captureBonus += 500 + otherToken.pos * 5;
        }
      }
    }
  }
  if (captureBonus > 0) return captureBonus;

  if (wasHome) return 300;

  const safeBonus = newPos <= 50 && SAFE_GLOBAL_SQUARES.includes(globalSquare(color, newPos)) ? 150 : 0;
  const progress = wasHome ? 0 : token.pos;
  return safeBonus + progress;
}

/** @returns {string} the chosen tokenId */
export function chooseBotMove(state, legalTokenIds) {
  const color = state.seats[state.currentSeatIndex].color;
  let best = legalTokenIds[0];
  let bestScore = -Infinity;
  for (const tokenId of legalTokenIds) {
    const score = scoreMove(state, color, tokenId, state.diceValue);
    if (score > bestScore) {
      bestScore = score;
      best = tokenId;
    }
  }
  return best;
}
