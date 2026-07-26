// The swap point for a future networked multiplayer version: anything
// shaped { getRoll(context) => Promise<number 1-6> } works. The local
// provider ignores context; a future createSocketRollProvider(socket) would
// use it (seatIndex/color/consecutiveSixes) to ask the right endpoint.
// Swapping providers is a one-line change at the store composition root
// (state/useLudo3DStore.js) — nothing in engine/, physics/, or components/
// needs to change.
export function createLocalRollProvider({ rng = Math.random } = {}) {
  return {
    async getRoll(_context) {
      return 1 + Math.floor(rng() * 6);
    },
  };
}
