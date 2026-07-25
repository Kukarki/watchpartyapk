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

const POWER_DICE_CHOICES = 2; // per player, for the whole game

// mode: 'classic' (default) — traditional rules only.
// 'power' adds two things on top of the same traditional rules, never
// replacing them: (1) each player gets 2 uses, for the entire game, of
// directly declaring the dice value they want instead of rolling randomly
// (e.g. "I need a 6 to get out" or "I need a 5 to capture that token"), and
// (2) a token that just captured is shielded from capture until it next
// moves. Safe/star squares work identically in both modes.
function createInitialState(players, opts = {}) {
  if (players.length < 2 || players.length > 4) {
    throw new Error('Ludo needs 2-4 players');
  }
  const mode = opts.mode === 'power' ? 'power' : 'classic';
  const assigned = players.map((p, i) => ({ ...p, color: COLORS[i] }));
  const tokens = {};
  for (const p of assigned) {
    for (let i = 0; i < 4; i++) {
      tokens[`${p.color}-${i}`] = { color: p.color, pos: 'home', shielded: false };
    }
  }
  const diceChoicesRemaining = {};
  if (mode === 'power') {
    for (const p of assigned) diceChoicesRemaining[p.userId] = POWER_DICE_CHOICES;
  }
  return {
    mode,
    players: assigned,
    tokens,
    currentPlayerIndex: 0,
    diceValue: null,
    diceChoicesRemaining, // power mode: { userId: uses left (0-2) }
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

// Shared by both a normal random roll and a power-mode declared value —
// three-sixes forfeit / no-legal-move auto-pass / normal roll all resolve
// identically once a single roll value has been settled on.
function resolveRoll(state, player, playerId, roll) {
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

function applyAction(state, action, playerId) {
  if (state.winner) throw new Error('This game is already over');

  const player = state.players[state.currentPlayerIndex];
  if (!player || player.userId !== playerId) throw new Error("It's not your turn");

  if (action.type === 'roll_dice') {
    if (state.diceValue !== null) throw new Error('Move a token before rolling again');
    const roll = 1 + Math.floor(Math.random() * 6);
    return resolveRoll(state, player, playerId, roll);
  }

  // Power mode only — spend one of a player's 2 game-long uses to directly
  // declare the dice value instead of rolling randomly.
  if (action.type === 'choose_dice_value') {
    if (state.mode !== 'power') throw new Error('Not available in this mode');
    if (state.diceValue !== null) throw new Error('Move a token before rolling again');
    const remaining = state.diceChoicesRemaining?.[playerId] || 0;
    if (remaining <= 0) throw new Error('No dice choices left');
    const { value } = action;
    if (!Number.isInteger(value) || value < 1 || value > 6) throw new Error('Choose a value between 1 and 6');

    const newRemaining = { ...state.diceChoicesRemaining, [playerId]: remaining - 1 };
    const result = resolveRoll({ ...state, diceChoicesRemaining: newRemaining }, player, playerId, value);
    return {
      state: result.state,
      events: [{ type: 'power_dice_used', playerId, value, remaining: remaining - 1 }, ...result.events],
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
      newTokens[tokenId] = { ...token, pos: 'finished', shielded: false };
      events.push({ type: 'token_finished', playerId, tokenId });
    } else {
      // Moving clears this token's own shield (power mode: "protected until
      // it next moves").
      newTokens[tokenId] = { ...token, pos: newPos, shielded: false };
      let capturedSomethingNow = false;

      // Capture check — only applies on the shared outer loop.
      if (newPos <= 50) {
        const landedGlobal = globalSquare(token.color, newPos);
        if (!SAFE_GLOBAL_SQUARES.includes(landedGlobal)) {
          for (const [otherId, otherToken] of Object.entries(newTokens)) {
            if (otherId === tokenId || otherToken.color === token.color) continue;
            if (typeof otherToken.pos !== 'number' || otherToken.pos > 50) continue;
            if (otherToken.shielded) continue; // power mode: shielded tokens can't be captured
            if (globalSquare(otherToken.color, otherToken.pos) === landedGlobal) {
              newTokens[otherId] = { ...otherToken, pos: 'home', shielded: false };
              events.push({ type: 'captured', playerId, tokenId, capturedTokenId: otherId });
              capturedSomethingNow = true;
            }
          }
        }
      }

      // Power mode: the capturing token is shielded until it next moves.
      if (capturedSomethingNow && state.mode === 'power') {
        newTokens[tokenId] = { ...newTokens[tokenId], shielded: true };
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

export const ludoGame = { createInitialState, applyAction, meta: { minPlayers: 2, maxPlayers: 4 } };
