import { describe, it, expect } from 'vitest';
import { createInitialState, computeLegalMoves, applyRoll, applyMoveToken } from './ludoEngine.js';

function twoPlayerState(overrides = {}) {
  const seats = [
    { color: 'red', isHuman: true, isBot: false, name: 'You' },
    { color: 'yellow', isHuman: false, isBot: true, name: 'Bot Yellow' },
  ];
  return { ...createInitialState(seats), ...overrides };
}

describe('ludoEngine', () => {
  it('only allows leaving base on a 6', () => {
    const state = twoPlayerState();
    expect(computeLegalMoves(state, 'red', 6)).toEqual(['red-0', 'red-1', 'red-2', 'red-3']);
    expect(computeLegalMoves(state, 'red', 5)).toEqual([]);
  });

  it('moves a token out of base on rolling a 6, landing on relative pos 0', () => {
    let state = twoPlayerState();
    ({ state } = applyRoll(state, 6));
    expect(state.legalTokenIds).toContain('red-0');
    const { state: afterMove, events } = applyMoveToken(state, 'red-0');
    expect(afterMove.tokens['red-0'].pos).toBe(0);
    expect(events.some((e) => e.type === 'token_left_home')).toBe(true);
  });

  it('grants an extra turn on rolling a 6, keeping the same seat', () => {
    let state = twoPlayerState();
    ({ state } = applyRoll(state, 6));
    const { state: afterMove, events } = applyMoveToken(state, 'red-0');
    expect(afterMove.currentSeatIndex).toBe(0);
    expect(afterMove.phase).toBe('awaiting-roll');
    expect(events.some((e) => e.type === 'extra_turn')).toBe(true);
  });

  it('advances to the next seat when the roll was not a 6', () => {
    const base = twoPlayerState();
    let state = { ...base, tokens: { ...base.tokens, 'red-0': { color: 'red', pos: 3 } } };
    ({ state } = applyRoll(state, 2));
    const { state: afterMove } = applyMoveToken(state, 'red-0');
    expect(afterMove.currentSeatIndex).toBe(1);
  });

  it('captures an opponent token landing on a non-safe shared square', () => {
    // yellow (offset 26) at relative pos 2 -> global 28 (not in SAFE_GLOBAL_SQUARES)
    // red (offset 0) moving to global 28 -> relative pos 28
    const base = twoPlayerState();
    let state = {
      ...base,
      tokens: {
        ...base.tokens,
        'red-0': { color: 'red', pos: 26 },
        'yellow-0': { color: 'yellow', pos: 2 },
      },
    };
    ({ state } = applyRoll(state, 2));
    const { state: afterMove, events } = applyMoveToken(state, 'red-0');
    expect(afterMove.tokens['red-0'].pos).toBe(28);
    expect(afterMove.tokens['yellow-0'].pos).toBe('home');
    expect(events.some((e) => e.type === 'captured' && e.capturedTokenId === 'yellow-0')).toBe(true);
  });

  it('does not capture on a safe/star square', () => {
    // global 34 is a safe square. yellow (offset 26) at relative pos 8 -> global 34.
    // red (offset 0) moving to global 34 -> relative pos 34.
    const base = twoPlayerState();
    let state = {
      ...base,
      tokens: {
        ...base.tokens,
        'red-0': { color: 'red', pos: 32 },
        'yellow-0': { color: 'yellow', pos: 8 },
      },
    };
    ({ state } = applyRoll(state, 2));
    const { state: afterMove, events } = applyMoveToken(state, 'red-0');
    expect(afterMove.tokens['red-0'].pos).toBe(34);
    expect(afterMove.tokens['yellow-0'].pos).toBe(8); // untouched, coexists on the safe square
    expect(events.some((e) => e.type === 'captured')).toBe(false);
  });

  it('requires an exact roll to finish -- overshoot is not a legal move', () => {
    const base = twoPlayerState();
    const state = { ...base, tokens: { ...base.tokens, 'red-0': { color: 'red', pos: 55 } } };
    expect(computeLegalMoves(state, 'red', 3)).not.toContain('red-0'); // 55+3=58, overshoot
    expect(computeLegalMoves(state, 'red', 2)).toContain('red-0');     // 55+2=57, exact
  });

  it('finishes a token that lands exactly on 57', () => {
    const base = twoPlayerState();
    let state = { ...base, tokens: { ...base.tokens, 'red-0': { color: 'red', pos: 55 } } };
    ({ state } = applyRoll(state, 2));
    const { state: afterMove, events } = applyMoveToken(state, 'red-0');
    expect(afterMove.tokens['red-0'].pos).toBe('finished');
    expect(events.some((e) => e.type === 'token_finished')).toBe(true);
  });

  it('detects a win once all 4 tokens are finished', () => {
    const base = twoPlayerState();
    let state = {
      ...base,
      tokens: {
        ...base.tokens,
        'red-0': { color: 'red', pos: 55 },
        'red-1': { color: 'red', pos: 'finished' },
        'red-2': { color: 'red', pos: 'finished' },
        'red-3': { color: 'red', pos: 'finished' },
      },
    };
    ({ state } = applyRoll(state, 2));
    const { state: afterMove, events } = applyMoveToken(state, 'red-0');
    expect(afterMove.phase).toBe('game-over');
    expect(afterMove.winner).toBe('red');
    expect(events.some((e) => e.type === 'game_won')).toBe(true);
  });

  it('forfeits the turn with no move on three consecutive 6s', () => {
    const state = twoPlayerState({ consecutiveSixes: 2 });
    const { state: afterRoll, events } = applyRoll(state, 6);
    expect(afterRoll.phase).toBe('awaiting-roll');
    expect(afterRoll.currentSeatIndex).toBe(1);
    expect(afterRoll.consecutiveSixes).toBe(0);
    expect(events.some((e) => e.type === 'forfeit_three_sixes')).toBe(true);
  });

  it('auto-passes the turn when a roll produces no legal moves', () => {
    const state = twoPlayerState(); // all red tokens home, rolling non-6 -> nothing can move
    const { state: afterRoll, events } = applyRoll(state, 4);
    expect(afterRoll.currentSeatIndex).toBe(1);
    expect(afterRoll.phase).toBe('awaiting-roll');
    expect(events.some((e) => e.type === 'no_legal_moves')).toBe(true);
  });
});
