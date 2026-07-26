// Pure Ludo rules state machine — zero rendering imports. Mirrors
// backend/src/games/ludo.js's position encoding (proven in the existing
// multiplayer game) so the two stay conceptually swappable later, minus
// power-mode (not part of this game's spec).
//
// Position encoding per token, relative to its own color's start square:
//   'home'      — in base, not yet released
//   0-50        — steps along the shared 52-square outer loop
//                 (global square = (COLOR_START_OFFSET[color] + pos) % 52)
//   51-56       — steps into this color's private 6-cell home stretch
//   'finished'  — reached the center
// A token needs to land exactly on relative pos 57 to finish (overshoot
// is not a legal move).
import { SAFE_GLOBAL_SQUARES, COLOR_START_OFFSET } from '@/components/games/board-layout.js';

const TOKENS_PER_PLAYER = 4;
const FINISH_POS = 57;

function globalSquare(color, pos) {
  return (COLOR_START_OFFSET[color] + pos) % 52;
}

function tokenIdsFor(color) {
  return Array.from({ length: TOKENS_PER_PLAYER }, (_, i) => `${color}-${i}`);
}

function currentColor(state) {
  return state.seats[state.currentSeatIndex].color;
}

function advanceSeat(state) {
  return (state.currentSeatIndex + 1) % state.seats.length;
}

/**
 * @param {{color:string,isHuman:boolean,isBot:boolean,name:string}[]} seats
 */
export function createInitialState(seats) {
  if (!Array.isArray(seats) || seats.length < 2 || seats.length > 4) {
    throw new Error('Ludo needs 2-4 players');
  }
  const tokens = {};
  for (const seat of seats) {
    for (const tokenId of tokenIdsFor(seat.color)) {
      tokens[tokenId] = { color: seat.color, pos: 'home' };
    }
  }
  return {
    seats,
    tokens,
    currentSeatIndex: 0,
    phase: 'awaiting-roll',
    diceValue: null,
    consecutiveSixes: 0,
    legalTokenIds: [],
    winner: null,
  };
}

export function computeLegalMoves(state, color, diceValue) {
  const legal = [];
  for (const [tokenId, token] of Object.entries(state.tokens)) {
    if (token.color !== color) continue;
    if (token.pos === 'home') {
      if (diceValue === 6) legal.push(tokenId);
      continue;
    }
    if (token.pos === 'finished') continue;
    if (token.pos + diceValue <= FINISH_POS) legal.push(tokenId);
  }
  return legal;
}

/**
 * @param {ReturnType<typeof createInitialState>} state
 * @param {1|2|3|4|5|6} rollValue
 * @returns {{state: object, events: object[]}}
 */
export function applyRoll(state, rollValue) {
  if (state.phase === 'game-over') throw new Error('Game is already over');
  if (state.phase !== 'awaiting-roll') throw new Error('Not awaiting a roll');

  const color = currentColor(state);
  const events = [{ type: 'rolled', color, value: rollValue }];
  const consecutiveSixes = rollValue === 6 ? state.consecutiveSixes + 1 : 0;

  // Three 6s in a row forfeits the turn entirely — no move, matches the
  // existing backend's rule of the same name.
  if (consecutiveSixes === 3) {
    const nextSeatIndex = advanceSeat(state);
    events.push({ type: 'forfeit_three_sixes', color }, { type: 'turn_advanced', nextSeatIndex });
    return {
      state: {
        ...state,
        currentSeatIndex: nextSeatIndex,
        phase: 'awaiting-roll',
        diceValue: null,
        consecutiveSixes: 0,
        legalTokenIds: [],
      },
      events,
    };
  }

  const legalTokenIds = computeLegalMoves(state, color, rollValue);

  if (legalTokenIds.length === 0) {
    const nextSeatIndex = advanceSeat(state);
    events.push({ type: 'no_legal_moves', color }, { type: 'turn_advanced', nextSeatIndex });
    return {
      state: {
        ...state,
        currentSeatIndex: nextSeatIndex,
        phase: 'awaiting-roll',
        diceValue: null,
        // Resets even off a 6 -- a 6 that produces no legal move shouldn't
        // count toward the three-in-a-row forfeit streak.
        consecutiveSixes: 0,
        legalTokenIds: [],
      },
      events,
    };
  }

  return {
    state: { ...state, diceValue: rollValue, consecutiveSixes, legalTokenIds, phase: 'awaiting-move' },
    events,
  };
}

/**
 * @param {ReturnType<typeof createInitialState>} state
 * @param {string} tokenId
 * @returns {{state: object, events: object[]}}
 */
export function applyMoveToken(state, tokenId) {
  if (state.phase !== 'awaiting-move') throw new Error('Not awaiting a move');
  if (!state.legalTokenIds.includes(tokenId)) throw new Error(`Illegal move: ${tokenId}`);

  const token = state.tokens[tokenId];
  const color = token.color;
  const diceValue = state.diceValue;
  const wasHome = token.pos === 'home';
  const newPos = wasHome ? 0 : token.pos + diceValue;

  const newTokens = { ...state.tokens };
  const events = [];

  if (newPos === FINISH_POS) {
    newTokens[tokenId] = { ...token, pos: 'finished' };
    // `from` (the pre-move numeric pos) lets the renderer reconstruct the
    // full hop-by-hop animation path into the center, not just the endpoints.
    events.push({ type: 'token_finished', tokenId, color, from: token.pos });
  } else {
    newTokens[tokenId] = { ...token, pos: newPos };
    events.push(
      wasHome
        ? { type: 'token_left_home', tokenId, color }
        : { type: 'token_moved', tokenId, color, from: token.pos, to: newPos }
    );

    // Capture check — shared track only, safe squares + same-color exempt.
    if (newPos <= 50) {
      const landedGlobal = globalSquare(color, newPos);
      if (!SAFE_GLOBAL_SQUARES.includes(landedGlobal)) {
        for (const [otherId, otherToken] of Object.entries(newTokens)) {
          if (otherId === tokenId || otherToken.color === color) continue;
          if (typeof otherToken.pos !== 'number' || otherToken.pos > 50) continue;
          if (globalSquare(otherToken.color, otherToken.pos) === landedGlobal) {
            newTokens[otherId] = { ...otherToken, pos: 'home' };
            events.push({
              type: 'captured', tokenId, color,
              capturedTokenId: otherId, capturedColor: otherToken.color,
            });
          }
        }
      }
    }
  }

  const wonGame = tokenIdsFor(color).every((id) => newTokens[id].pos === 'finished');
  if (wonGame) {
    events.push({ type: 'game_won', color });
    return {
      state: {
        ...state, tokens: newTokens, diceValue: null, legalTokenIds: [],
        phase: 'game-over', winner: color,
      },
      events,
    };
  }

  const extraTurn = diceValue === 6;
  const nextSeatIndex = extraTurn ? state.currentSeatIndex : advanceSeat(state);
  events.push(extraTurn ? { type: 'extra_turn', color } : { type: 'turn_advanced', nextSeatIndex });

  return {
    state: {
      ...state,
      tokens: newTokens,
      currentSeatIndex: nextSeatIndex,
      diceValue: null,
      consecutiveSixes: extraTurn ? state.consecutiveSixes : 0,
      legalTokenIds: [],
      phase: 'awaiting-roll',
    },
    events,
  };
}

export const meta = { minPlayers: 2, maxPlayers: 4 };
