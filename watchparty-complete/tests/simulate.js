// Headless simulation: play full games with random legal moves.
// Run: node tests/simulate.js
const wildbeam = require('../server/games/wildbeam');
const matchblitz = require('../server/games/matchblitz');

function simWildBeam(nPlayers, seedLabel) {
  const pids = Array.from({ length: nPlayers }, (_, i) => `p${i + 1}`);
  const s = wildbeam.createState(pids);
  let moves = 0;
  while (s.status === 'playing' && moves < 5000) {
    moves++;
    const pub = wildbeam.publicState(s);
    const pid = pub.turn;
    const hand = s.hands[pid];
    const { playable } = wildbeam._test;

    let res;
    if (s.drawnCard) {
      // must play the drawn card or pass
      const card = hand.find((c) => c.id === s.drawnCard);
      res = Math.random() < 0.7
        ? wildbeam.applyMove(s, pid, { type: 'play', cardId: card.id, chooseColor: 'cyan', callLastCard: true })
        : wildbeam.applyMove(s, pid, { type: 'pass' });
    } else {
      const options = hand.filter((c) => playable(s, c));
      if (options.length && Math.random() < 0.9) {
        const card = options[Math.floor(Math.random() * options.length)];
        const callLastCard = Math.random() < 0.8; // sometimes forget, hits the penalty path
        res = wildbeam.applyMove(s, pid, {
          type: 'play', cardId: card.id,
          chooseColor: ['beam', 'cyan', 'amber', 'crimson'][Math.floor(Math.random() * 4)],
          callLastCard,
        });
      } else {
        res = wildbeam.applyMove(s, pid, { type: 'draw' });
      }
    }
    if (res.error) throw new Error(`[${seedLabel}] illegal sim move: ${res.error}`);

    // occasionally someone rage-quits (tests removePlayer paths)
    if (moves === 40 && nPlayers > 2) wildbeam.removePlayer(s, pids[1]);
  }
  if (s.status !== 'ended') throw new Error(`[${seedLabel}] did not terminate in ${moves} moves`);
  // card conservation: deck + discard + hands + (eliminated hands already returned) = 108
  const total = s.deck.length + s.discard.length
    + Object.values(s.hands).reduce((a, h) => a + h.length, 0);
  if (total !== 108) throw new Error(`[${seedLabel}] card leak: ${total}/108`);
  return { moves, ranking: wildbeam.ranking(s) };
}

function simMatchBlitz(nPlayers, seedLabel) {
  const pids = Array.from({ length: nPlayers }, (_, i) => `p${i + 1}`);
  const s = matchblitz.createState(pids);
  let moves = 0;
  while (s.status === 'playing' && moves < 3000) {
    moves++;
    const pid = s.order[s.turnIdx];
    const open = s.cells
      .map((c, i) => ({ c, i }))
      .filter(({ c, i }) => !c.matched && !s.flipped.includes(i));
    const pick = open[Math.floor(Math.random() * open.length)];
    const res = matchblitz.applyMove(s, pid, { type: 'flip', index: pick.i });
    if (res.error) throw new Error(`[${seedLabel}] illegal sim move: ${res.error}`);
  }
  if (s.status !== 'ended') throw new Error(`[${seedLabel}] did not terminate`);
  const pairs = Object.values(s.scores).reduce((a, b) => a + b, 0);
  if (pairs !== 12) throw new Error(`[${seedLabel}] pair count wrong: ${pairs}/12`);
  return { moves, ranking: matchblitz.ranking(s), scores: s.scores };
}

let wbMoves = 0;
for (let run = 0; run < 200; run++) {
  const n = 2 + (run % 7); // 2..8 players
  const r = simWildBeam(n, `wb-run${run}-${n}p`);
  wbMoves += r.moves;
}
console.log(`WildBeam: 200 full games OK (2-8 players, avg ${Math.round(wbMoves / 200)} moves, incl. quit + missed-call paths)`);

let mbMoves = 0;
for (let run = 0; run < 200; run++) {
  const n = 2 + (run % 5); // 2..6 players
  const r = simMatchBlitz(n, `mb-run${run}-${n}p`);
  mbMoves += r.moves;
}
console.log(`Match Blitz: 200 full games OK (2-6 players, avg ${Math.round(mbMoves / 200)} flips, all 12 pairs accounted)`);

// spot checks
const bad = wildbeam.applyMove(wildbeam.createState(['a', 'b']), 'b', { type: 'draw' });
if (bad.error !== 'not your turn') throw new Error('turn guard failed');
console.log('Guards OK (out-of-turn rejected)');
console.log('ALL SIMULATIONS PASSED');
