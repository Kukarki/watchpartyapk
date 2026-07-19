// WildBeam — a shedding card game in the Crazy-Eights family (the public
// mechanics UNO is also based on), with original naming and WatchParty
// theming. 2-8 players.
//
// Cards: 4 colors (beam/cyan/amber/crimson), values 0-9, plus:
//   Freeze  (skip next player)          x2 per color
//   Rewind  (reverse direction)         x2 per color
//   Boost+2 (next draws 2, skipped)     x2 per color
//   Prism   (wild — pick a color)       x4
//   Surge+4 (wild + next draws 4)       x4
// 108 cards total. "Last card!" must be declared when playing down to one
// card, or you auto-draw a penalty card.

const COLORS = ['beam', 'cyan', 'amber', 'crimson'];

const meta = {
  id: 'wildbeam',
  name: 'WildBeam',
  emoji: '🎴',
  minPlayers: 2,
  maxPlayers: 8,
  turnMs: 30000,
};

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildDeck() {
  const deck = [];
  let n = 0;
  for (const color of COLORS) {
    deck.push({ id: `c${n++}`, color, kind: 'num', value: 0 });
    for (let v = 1; v <= 9; v++) {
      for (let k = 0; k < 2; k++) deck.push({ id: `c${n++}`, color, kind: 'num', value: v });
    }
    for (const kind of ['freeze', 'rewind', 'boost2']) {
      for (let k = 0; k < 2; k++) deck.push({ id: `c${n++}`, color, kind, value: null });
    }
  }
  for (let k = 0; k < 4; k++) deck.push({ id: `c${n++}`, color: null, kind: 'prism', value: null });
  for (let k = 0; k < 4; k++) deck.push({ id: `c${n++}`, color: null, kind: 'surge4', value: null });
  return deck;
}

function createState(playerIds) {
  if (playerIds.length < meta.minPlayers || playerIds.length > meta.maxPlayers) {
    throw new Error(`WildBeam needs ${meta.minPlayers}-${meta.maxPlayers} players`);
  }
  const deck = shuffle(buildDeck());
  const hands = {};
  for (const pid of playerIds) hands[pid] = deck.splice(0, 7);

  // starting card must be a number card
  let top = deck.shift();
  while (top.kind !== 'num') { deck.push(top); top = deck.shift(); }

  return {
    gameId: 'wildbeam',
    status: 'playing',
    deck,
    discard: [top],           // last element = top of pile
    hands,
    order: [...playerIds],
    turnIdx: 0,
    dir: 1,
    currentColor: top.color,
    currentKind: 'num',
    currentValue: top.value,
    drawnCard: null,           // card id the current player just drew (may play it or pass)
    winners: [],               // pids in finishing order
    eliminated: [],
  };
}

const isActive = (s, pid) => !s.winners.includes(pid) && !s.eliminated.includes(pid);
const activePlayers = (s) => s.order.filter((p) => isActive(s, p));
const currentPid = (s) => s.order[s.turnIdx];

function advance(s, steps) {
  const len = s.order.length;
  if (!activePlayers(s).length) return;
  for (let k = 0; k < steps; k++) {
    do { s.turnIdx = (s.turnIdx + s.dir + len) % len; }
    while (!isActive(s, s.order[s.turnIdx]));
  }
}
function nextTurn(s, skips = 0) {
  s.drawnCard = null;
  advance(s, 1 + skips);
}
function peekNext(s) {
  const save = { turnIdx: s.turnIdx };
  advance(s, 1);
  const pid = currentPid(s);
  s.turnIdx = save.turnIdx;
  return pid;
}

function drawCards(s, pid, n) {
  const got = [];
  for (let i = 0; i < n; i++) {
    if (!s.deck.length) {
      const top = s.discard.pop();
      s.deck = shuffle(s.discard);
      s.discard = [top];
      if (!s.deck.length) break; // everything is in hands — rare, just stop
    }
    const card = s.deck.shift();
    s.hands[pid].push(card);
    got.push(card);
  }
  return got;
}

function playable(s, card) {
  if (card.kind === 'prism' || card.kind === 'surge4') return true;
  if (card.color === s.currentColor) return true;
  if (card.kind === 'num') return s.currentKind === 'num' && card.value === s.currentValue;
  return card.kind === s.currentKind; // freeze-on-freeze etc. across colors
}

function finish(s, events) {
  for (const pid of activePlayers(s)) s.winners.push(pid); // remaining ranked by cards? keep join order of remaining
  s.status = 'ended';
  events.push({ type: 'game_over', ranking: [...s.winners] });
}

function applyMove(s, pid, move) {
  if (s.status !== 'playing') return { error: 'game is over' };
  if (currentPid(s) !== pid) return { error: 'not your turn' };
  const events = [];

  if (move.type === 'timeout') {
    if (!s.drawnCard) drawCards(s, pid, 1);
    events.push({ type: 'timed_out', pid });
    nextTurn(s);
    events.push({ type: 'turn', pid: currentPid(s) });
    return { events };
  }

  if (move.type === 'draw') {
    if (s.drawnCard) return { error: 'you already drew this turn' };
    const [card] = drawCards(s, pid, 1);
    events.push({ type: 'drew', pid });
    if (!card || !playable(s, card)) {
      nextTurn(s);
      events.push({ type: 'turn', pid: currentPid(s) });
    } else {
      s.drawnCard = card.id; // player may play it or pass
    }
    return { events };
  }

  if (move.type === 'pass') {
    if (!s.drawnCard) return { error: 'draw a card first' };
    nextTurn(s);
    events.push({ type: 'turn', pid: currentPid(s) });
    return { events };
  }

  if (move.type === 'play') {
    const hand = s.hands[pid];
    const idx = hand.findIndex((c) => c.id === move.cardId);
    if (idx < 0) return { error: 'card not in your hand' };
    const card = hand[idx];
    if (s.drawnCard && card.id !== s.drawnCard) {
      return { error: 'play the drawn card or pass' };
    }
    if (!playable(s, card)) return { error: 'that card does not match' };

    hand.splice(idx, 1);
    s.discard.push(card);
    s.drawnCard = null;

    if (card.kind === 'prism' || card.kind === 'surge4') {
      const chosen = COLORS.includes(move.chooseColor)
        ? move.chooseColor
        : COLORS[Math.floor(Math.random() * COLORS.length)];
      s.currentColor = chosen;
      s.currentKind = 'wild';
      s.currentValue = null;
      events.push({ type: 'played', pid, card, chosenColor: chosen });
    } else {
      s.currentColor = card.color;
      s.currentKind = card.kind;
      s.currentValue = card.value;
      events.push({ type: 'played', pid, card });
    }

    // "Last card!" declaration
    if (hand.length === 1) {
      if (move.callLastCard) events.push({ type: 'last_card', pid });
      else {
        drawCards(s, pid, 1);
        events.push({ type: 'missed_call', pid, penalty: 1 });
      }
    }

    // going out
    if (hand.length === 0) {
      s.winners.push(pid);
      events.push({ type: 'went_out', pid, place: s.winners.length });
      if (activePlayers(s).length <= 1) {
        finish(s, events);
        return { events };
      }
    }

    // card effects
    let skips = 0;
    if (card.kind === 'freeze') skips = 1;
    if (card.kind === 'rewind') {
      if (activePlayers(s).length === 2) skips = 1;
      else s.dir *= -1;
      events.push({ type: 'rewound', dir: s.dir });
    }
    if (card.kind === 'boost2' || card.kind === 'surge4') {
      const victim = peekNext(s);
      const n = card.kind === 'boost2' ? 2 : 4;
      drawCards(s, victim, n);
      skips = 1;
      events.push({ type: 'boosted', pid: victim, n });
    }

    nextTurn(s, skips);
    events.push({ type: 'turn', pid: currentPid(s) });
    return { events };
  }

  return { error: `unknown move '${move.type}'` };
}

function removePlayer(s, pid, events = []) {
  if (!isActive(s, pid)) return { events };
  const wasTheirTurn = currentPid(s) === pid;
  s.eliminated.push(pid);
  // return their cards to the bottom of the deck
  s.deck.push(...(s.hands[pid] || []));
  s.hands[pid] = [];
  events.push({ type: 'left', pid });
  if (activePlayers(s).length <= 1 && s.status === 'playing') {
    finish(s, events);
  } else if (wasTheirTurn) {
    s.drawnCard = null;
    advance(s, 1);
    events.push({ type: 'turn', pid: currentPid(s) });
  }
  return { events };
}

// what everyone can see
function publicState(s) {
  return {
    gameId: s.gameId,
    status: s.status,
    order: s.order,
    turn: s.status === 'playing' ? currentPid(s) : null,
    dir: s.dir,
    currentColor: s.currentColor,
    currentKind: s.currentKind,
    currentValue: s.currentValue,
    discardTop: s.discard[s.discard.length - 1],
    deckCount: s.deck.length,
    handCounts: Object.fromEntries(Object.entries(s.hands).map(([p, h]) => [p, h.length])),
    winners: s.winners,
    eliminated: s.eliminated,
  };
}

// what only this player sees
function privateView(s, pid) {
  return {
    myHand: s.hands[pid] || [],
    drawnCard: currentPid(s) === pid ? s.drawnCard : null,
  };
}

const isOver = (s) => s.status === 'ended';
const ranking = (s) => [...s.winners];

module.exports = {
  meta, createState, applyMove, removePlayer,
  publicState, privateView, isOver, ranking,
  _test: { playable, COLORS },
};
