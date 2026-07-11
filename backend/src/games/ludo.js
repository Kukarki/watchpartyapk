// Ludo — full traditional rules, server-authoritative, pure functions (no I/O).
//
// Position encoding (relative to each color's own start square — keeps the
// logic color-agnostic):
//   'home'      — token in base, not yet released
//   0-50        — steps along the shared 52-square outer loop, relative to
//                 this color's start square. Global square = (offset + pos) % 52.
//   51-56       — steps into this color's private home stretch (index pos-51)
//   'finished'  — reached the end of the home stretch
//
// A token therefore needs 57 total steps (0..56 then landing exactly on 57)
// to finish — a 6 is required to leave 'home', and the final move into
// 'finished' must be an exact roll (overshooting is an illegal move).

const COLORS = ['red', 'green', 'yellow', 'blue'];
const COLOR_START_OFFSET = { red: 0, green: 13, yellow: 26, blue: 39 };
// The 4 start squares + 4 star squares — tokens here can't be captured.
const SAFE_GLOBAL_SQUARES = [0, 8, 13, 21, 26, 34, 39, 47];

function globalSquare(color, pos) {
  return (COLOR_START_OFFSET[color] + pos) % 52;
}

function createInitialState(players) {
  if (players.length < 2 || players.length > 4) {
    throw new Error('Ludo needs 2-4 players');
  }
  const assigned = players.map((p, i) => ({ ...p, color: COLORS[i] }));
  const tokens = {};
  for (const p of assigned) {
    for (let i = 0; i < 4; i++) {
      tokens[`${p.color}-${i}`] = { color: p.color, pos: 'home' };
    }
  }
  return {
    players: assigned,
    tokens,
    currentPlayerIndex: 0,
    diceValue: null,
    consecutiveSixes: 0,
    legalTokenIds: [],
    winner: null,
  };
}

function computeLegalMoves(state, color, diceValue) {
  const legal = [];
  for (const [tokenId, token] of Object.entries(state.tokens)) {
    if (token.color !== color) continue;
    if (token.pos === 'home') {
      if (diceValue === 6) legal.push(tokenId);
      continue;
    }
    if (token.pos === 'finished') continue;
    const newPos = token.pos + diceValue;
    if (newPos <= 57) legal.push(tokenId);
  }
  return legal;
}

function advanceTurn(state) {
  return { currentPlayerIndex: (state.currentPlayerIndex + 1) % state.players.length };
}

function applyAction(state, action, playerId) {
  if (state.winner) throw new Error('This game is already over');

  const player = state.players[state.currentPlayerIndex];
  if (!player || player.userId !== playerId) throw new Error("It's not your turn");

  if (action.type === 'roll_dice') {
    if (state.diceValue !== null) throw new Error('Move a token before rolling again');

    const roll = 1 + Math.floor(Math.random() * 6);
    const consecutiveSixes = roll === 6 ? state.consecutiveSixes + 1 : 0;

    // Three 6s in a row forfeits the turn entirely (no move) — traditional rule.
    if (consecutiveSixes === 3) {
      const next = advanceTurn(state);
      return {
        state: { ...state, ...next, diceValue: null, consecutiveSixes: 0, legalTokenIds: [] },
        events: [{ type: 'forfeit_three_sixes', playerId, roll }],
      };
    }

    const legalTokenIds = computeLegalMoves(state, player.color, roll);
    if (legalTokenIds.length === 0) {
      // Nothing this player can legally do with this roll — auto-pass.
      const next = advanceTurn(state);
      return {
        state: { ...state, ...next, diceValue: null, consecutiveSixes: 0, legalTokenIds: [] },
        events: [{ type: 'no_legal_moves', playerId, roll }],
      };
    }

    return {
      state: { ...state, diceValue: roll, consecutiveSixes, legalTokenIds },
      events: [{ type: 'rolled', playerId, roll }],
    };
  }

  if (action.type === 'move_token') {
    if (state.diceValue === null) throw new Error('Roll the dice first');
    const { tokenId } = action;
    if (!state.legalTokenIds.includes(tokenId)) throw new Error('That move is not legal');

    const token = state.tokens[tokenId];
    const newTokens = { ...state.tokens };
    const events = [];

    const newPos = token.pos === 'home' ? 0 : token.pos + state.diceValue;

    if (newPos === 57) {
      newTokens[tokenId] = { ...token, pos: 'finished' };
      events.push({ type: 'token_finished', playerId, tokenId });
    } else {
      newTokens[tokenId] = { ...token, pos: newPos };

      // Capture check — only applies on the shared outer loop.
      if (newPos <= 50) {
        const landedGlobal = globalSquare(token.color, newPos);
        if (!SAFE_GLOBAL_SQUARES.includes(landedGlobal)) {
          for (const [otherId, otherToken] of Object.entries(newTokens)) {
            if (otherId === tokenId || otherToken.color === token.color) continue;
            if (typeof otherToken.pos !== 'number' || otherToken.pos > 50) continue;
            if (globalSquare(otherToken.color, otherToken.pos) === landedGlobal) {
              newTokens[otherId] = { ...otherToken, pos: 'home' };
              events.push({ type: 'captured', playerId, tokenId, capturedTokenId: otherId });
            }
          }
        }
      }
    }

    const playerTokenIds = Object.keys(newTokens).filter((id) => newTokens[id].color === player.color);
    const wonGame = playerTokenIds.every((id) => newTokens[id].pos === 'finished');

    if (wonGame) {
      events.push({ type: 'game_won', playerId });
      return {
        state: { ...state, tokens: newTokens, winner: playerId, diceValue: null, legalTokenIds: [] },
        events,
      };
    }

    const capturedSomething = events.some((e) => e.type === 'captured');
    const extraTurn = state.diceValue === 6 || capturedSomething;

    if (extraTurn) {
      return { state: { ...state, tokens: newTokens, diceValue: null, legalTokenIds: [] }, events };
    }

    const next = advanceTurn(state);
    return {
      state: { ...state, ...next, tokens: newTokens, diceValue: null, consecutiveSixes: 0, legalTokenIds: [] },
      events,
    };
  }

  throw new Error(`Unknown action type: ${action.type}`);
}

export const ludoGame = { createInitialState, applyAction };
