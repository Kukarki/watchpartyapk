import { create } from 'zustand';
import { useRef, useCallback, useEffect } from 'react';
import { createInitialState, applyRoll, applyMoveToken, chooseBotMove, createLocalRollProvider } from '../engine/index.js';
import { playPawnHop, playCapture, playWinChime } from '../audio/sfx.js';

const BOT_ROLL_DELAY_MS = 700;
const BOT_MOVE_DELAY_MS = 550;
// Matches the old 2D game's dice-spin duration (LudoBoard.jsx's
// ROLL_ANIM_MS) -- the roll provider itself resolves near-instantly, this
// is purely so the flat dice face has time to visibly spin before landing.
const ROLL_ANIM_MS = 650;

// The reactive slice -- anything a component needs to re-render on. Refs to
// the Pawn 3D objects (below) are deliberately NOT here: they're
// imperative handles, not render-driving state.
const useStore = create((set) => ({
  ludoState: null,
  isDiceRolling: false,
  setLudoState: (s) => set({ ludoState: s }),
  setDiceRolling: (v) => set({ isDiceRolling: v }),
}));

/**
 * The integration point binding the pure engine and the pawn animations
 * together. Owns imperative refs to the 3D Pawn objects (registered on
 * mount) and exposes the actions components call: startGame,
 * rollForCurrentSeat, moveToken. Replaying an engine transition's events[]
 * against the right pawn ref (hop vs. capture-tumble) plus the matching
 * sound effect happens once, here -- not duplicated per caller.
 */
export function useLudo3DController() {
  const ludoState = useStore((s) => s.ludoState);
  const isDiceRolling = useStore((s) => s.isDiceRolling);
  const setLudoState = useStore((s) => s.setLudoState);
  const setDiceRolling = useStore((s) => s.setDiceRolling);

  const pawnRefs = useRef(new Map());
  const rollProviderRef = useRef(createLocalRollProvider());

  const registerPawnRef = useCallback((tokenId, ref) => {
    if (ref) pawnRefs.current.set(tokenId, ref);
    else pawnRefs.current.delete(tokenId);
  }, []);

  const startGame = useCallback((seats) => {
    setLudoState(createInitialState(seats));
  }, [setLudoState]);

  const playEvents = useCallback(async (events) => {
    for (const evt of events) {
      const pawn = evt.tokenId ? pawnRefs.current.get(evt.tokenId) : null;
      if (evt.type === 'token_left_home') {
        await pawn?.hopTo([0]);
        playPawnHop();
      } else if (evt.type === 'token_moved') {
        const path = [];
        for (let p = evt.from + 1; p <= evt.to; p++) path.push(p);
        await pawn?.hopTo(path);
        playPawnHop();
      } else if (evt.type === 'token_finished') {
        const path = [];
        for (let p = evt.from + 1; p <= 56; p++) path.push(p);
        path.push('finished');
        await pawn?.hopTo(path);
        playPawnHop();
      } else if (evt.type === 'captured') {
        playCapture();
        pawnRefs.current.get(evt.capturedTokenId)?.tumbleHome();
      } else if (evt.type === 'game_won') {
        playWinChime();
      }
    }
  }, []);

  const rollForCurrentSeat = useCallback(async () => {
    if (!ludoState || ludoState.phase !== 'awaiting-roll' || isDiceRolling) return null;
    setDiceRolling(true);
    const seat = ludoState.seats[ludoState.currentSeatIndex];
    const value = await rollProviderRef.current.getRoll({
      seatIndex: ludoState.currentSeatIndex,
      color: seat.color,
      consecutiveSixes: ludoState.consecutiveSixes,
    });
    await new Promise((resolve) => setTimeout(resolve, ROLL_ANIM_MS));
    const { state: newState, events } = applyRoll(ludoState, value);
    setLudoState(newState);
    setDiceRolling(false);
    await playEvents(events);
    return { value, state: newState, events };
  }, [ludoState, isDiceRolling, setDiceRolling, setLudoState, playEvents]);

  const moveToken = useCallback(async (tokenId) => {
    if (!ludoState || ludoState.phase !== 'awaiting-move') return null;
    const { state: newState, events } = applyMoveToken(ludoState, tokenId);
    setLudoState(newState);
    await playEvents(events);
    return { state: newState, events };
  }, [ludoState, setLudoState, playEvents]);

  // Bots call the exact same rollForCurrentSeat/moveToken actions a human
  // would -- no special-cased "cheat" path -- just triggered automatically
  // with a small pacing delay so turns are watchable instead of instant.
  useEffect(() => {
    if (!ludoState || ludoState.phase === 'game-over') return undefined;
    const seat = ludoState.seats[ludoState.currentSeatIndex];
    if (!seat.isBot) return undefined;

    let cancelled = false;
    if (ludoState.phase === 'awaiting-roll' && !isDiceRolling) {
      const t = setTimeout(() => { if (!cancelled) rollForCurrentSeat(); }, BOT_ROLL_DELAY_MS);
      return () => { cancelled = true; clearTimeout(t); };
    }
    if (ludoState.phase === 'awaiting-move') {
      const tokenId = chooseBotMove(ludoState, ludoState.legalTokenIds);
      const t = setTimeout(() => { if (!cancelled) moveToken(tokenId); }, BOT_MOVE_DELAY_MS);
      return () => { cancelled = true; clearTimeout(t); };
    }
    return undefined;
  }, [ludoState, isDiceRolling, rollForCurrentSeat, moveToken]);

  return {
    ludoState,
    isDiceRolling,
    startGame,
    rollForCurrentSeat,
    moveToken,
    registerPawnRef,
  };
}
