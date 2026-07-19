// Match Blitz — memory pairs. Flip two cells; a match scores a pair and you
// go again, a miss passes the turn. 2-6 players, 4x6 board (12 pairs).
const ICONS = ['🍿', '🎬', '🎧', '🎮', '🌙', '⚡', '🌈', '🛸', '🍩', '🔥', '💎', '🎲'];

const meta = {
  id: 'matchblitz',
  name: 'Match Blitz',
  emoji: '🧠',
  minPlayers: 2,
  maxPlayers: 6,
  turnMs: 20000,
};

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function createState(playerIds) {
  if (playerIds.length < meta.minPlayers || playerIds.length > meta.maxPlayers) {
    throw new Error(`Match Blitz needs ${meta.minPlayers}-${meta.maxPlayers} players`);
  }
  const cells = shuffle([...ICONS, ...ICONS]).map((icon) => ({ icon, matched: false }));
  return {
    gameId: 'matchblitz',
    status: 'playing',
    cells,
    flipped: [],   // indices flipped this turn (max 2)
    scores: Object.fromEntries(playerIds.map((p) => [p, 0])),
    order: [...playerIds],
    turnIdx: 0,
    eliminated: [],
    winnersRanked: null,
  };
}

const isActive = (s, pid) => !s.eliminated.includes(pid);
const activePlayers = (s) => s.order.filter((p) => isActive(s, p));
const currentPid = (s) => s.order[s.turnIdx];

function nextTurn(s) {
  s.flipped = [];
  const len = s.order.length;
  do { s.turnIdx = (s.turnIdx + 1) % len; }
  while (!isActive(s, s.order[s.turnIdx]));
}

function maybeFinish(s, events) {
  if (s.cells.every((c) => c.matched)) {
    s.status = 'ended';
    s.winnersRanked = activePlayers(s)
      .sort((a, b) => s.scores[b] - s.scores[a]);
    events.push({ type: 'game_over', ranking: s.winnersRanked, scores: s.scores });
  }
}

function applyMove(s, pid, move) {
  if (s.status !== 'playing') return { error: 'game is over' };
  if (currentPid(s) !== pid) return { error: 'not your turn' };
  const events = [];

  if (move.type === 'timeout') {
    events.push({ type: 'timed_out', pid });
    nextTurn(s);
    events.push({ type: 'turn', pid: currentPid(s) });
    return { events };
  }

  if (move.type !== 'flip') return { error: `unknown move '${move.type}'` };
  const i = move.index;
  if (!Number.isInteger(i) || i < 0 || i >= s.cells.length) return { error: 'bad cell' };
  if (s.cells[i].matched) return { error: 'already matched' };
  if (s.flipped.includes(i)) return { error: 'already flipped' };

  s.flipped.push(i);
  events.push({ type: 'flip', pid, index: i, icon: s.cells[i].icon });

  if (s.flipped.length === 2) {
    const [a, b] = s.flipped;
    if (s.cells[a].icon === s.cells[b].icon) {
      s.cells[a].matched = true;
      s.cells[b].matched = true;
      s.scores[pid] += 1;
      s.flipped = [];
      events.push({ type: 'match', pid, indices: [a, b], icon: s.cells[a].icon });
      maybeFinish(s, events);
      // matched -> same player keeps the turn (unless game ended)
    } else {
      events.push({ type: 'miss', pid, indices: [a, b] });
      nextTurn(s);
      events.push({ type: 'turn', pid: currentPid(s) });
    }
  }
  return { events };
}

function removePlayer(s, pid, events = []) {
  if (!isActive(s, pid)) return { events };
  const wasTheirTurn = currentPid(s) === pid;
  s.eliminated.push(pid);
  delete s.scores[pid];
  events.push({ type: 'left', pid });
  if (activePlayers(s).length <= 1 && s.status === 'playing') {
    s.status = 'ended';
    s.winnersRanked = activePlayers(s);
    events.push({ type: 'game_over', ranking: s.winnersRanked, scores: s.scores });
  } else if (wasTheirTurn) {
    nextTurn(s);
    events.push({ type: 'turn', pid: currentPid(s) });
  }
  return { events };
}

function publicState(s) {
  return {
    gameId: s.gameId,
    status: s.status,
    order: s.order,
    turn: s.status === 'playing' ? currentPid(s) : null,
    cells: s.cells.map((c) => ({ matched: c.matched, icon: c.matched ? c.icon : null })),
    flipped: s.flipped.map((i) => ({ index: i, icon: s.cells[i].icon })),
    scores: s.scores,
    eliminated: s.eliminated,
    pairsLeft: s.cells.filter((c) => !c.matched).length / 2,
  };
}

const privateView = () => ({}); // nothing hidden per-player in this game
const isOver = (s) => s.status === 'ended';
const ranking = (s) => s.winnersRanked || [];

module.exports = {
  meta, createState, applyMove, removePlayer,
  publicState, privateView, isOver, ranking,
};
