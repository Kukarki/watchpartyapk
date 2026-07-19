// Generic multiplayer game session engine over Socket.IO.
// Games are pluggable modules (see wildbeam.js / matchblitz.js) exposing:
//   meta { id, name, minPlayers, maxPlayers, turnMs }
//   createState(playerIds) / applyMove(state, pid, move) -> { events?, error? }
//   removePlayer(state, pid) -> { events }
//   publicState(state) / privateView(state, pid) / isOver(state) / ranking(state)
//
// Sessions are in-memory (fine for a single backend instance; if you scale
// to multiple nodes later, pin game sockets to one node or move state to Redis).
const GAMES = {
  wildbeam: require('./wildbeam'),
  matchblitz: require('./matchblitz'),
};

const sessions = new Map(); // sessionId -> session
const DISCONNECT_GRACE_MS = 30000;

const rid = () => Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6);
const chan = (id) => `gs:${id}`;

function sessionSummary(s) {
  return {
    sessionId: s.id,
    roomId: s.roomId,
    gameId: s.gameId,
    game: GAMES[s.gameId].meta,
    hostId: s.hostId,
    status: s.status,
    players: s.players.map((p) => p.id),
  };
}

function attachGames(io, opts = {}) {
  const { onGameEnd } = opts; // async ({ session, ranking }) => {} — XP, persistence

  function broadcast(s, events) {
    const mod = GAMES[s.gameId];
    const pub = { sessionId: s.id, ...mod.publicState(s.state), deadline: s.deadline || null };
    io.to(chan(s.id)).emit('game:state', pub);
    if (events && events.length) io.to(chan(s.id)).emit('game:events', { sessionId: s.id, events });
    // personalized hands
    for (const p of s.players) {
      for (const sockId of p.sockets) {
        const sock = io.sockets.sockets.get(sockId);
        if (sock) sock.emit('game:hand', { sessionId: s.id, ...mod.privateView(s.state, p.id) });
      }
    }
  }

  function clearTimer(s) {
    if (s.turnTimer) { clearTimeout(s.turnTimer); s.turnTimer = null; }
  }

  function armTurnTimer(s) {
    clearTimer(s);
    const mod = GAMES[s.gameId];
    if (s.status !== 'playing' || !mod.meta.turnMs) return;
    s.deadline = Date.now() + mod.meta.turnMs;
    s.turnTimer = setTimeout(() => {
      const pub = mod.publicState(s.state);
      if (!pub.turn) return;
      runMove(s, pub.turn, { type: 'timeout' });
    }, mod.meta.turnMs);
  }

  async function endSession(s, rankingArr) {
    clearTimer(s);
    s.status = 'ended';
    io.to(chan(s.id)).emit('game:ended', {
      sessionId: s.id, gameId: s.gameId, ranking: rankingArr,
    });
    if (onGameEnd) {
      try { await onGameEnd({ session: sessionSummary(s), ranking: rankingArr }); }
      catch (err) { console.error('[games] onGameEnd failed:', err.message); }
    }
    setTimeout(() => sessions.delete(s.id), 60000); // keep briefly for late reads
  }

  function runMove(s, pid, move) {
    const mod = GAMES[s.gameId];
    const result = mod.applyMove(s.state, pid, move);
    if (result.error) return result;
    if (mod.isOver(s.state)) {
      broadcast(s, result.events);
      endSession(s, mod.ranking(s.state));
    } else {
      armTurnTimer(s);
      broadcast(s, result.events);
    }
    return result;
  }

  io.on('connection', (socket) => {
    // your existing socket auth should set this (same assumption as the
    // avatar module). Fallback for local testing only:
    const userId = (socket.data && socket.data.userId)
      || socket.handshake.auth?.userId
      || socket.handshake.query?.userId;
    if (!userId) return;

    const findPlayer = (s) => s.players.find((p) => p.id === userId);

    socket.on('game:create', ({ roomId, gameId }, cb = () => {}) => {
      const mod = GAMES[gameId];
      if (!mod) return cb({ error: `unknown game '${gameId}'` });
      const s = {
        id: rid(), roomId: roomId || null, gameId,
        hostId: userId, status: 'lobby',
        players: [{ id: userId, sockets: new Set([socket.id]), away: null }],
        state: null, turnTimer: null, deadline: null,
      };
      sessions.set(s.id, s);
      socket.join(chan(s.id));
      io.to(chan(s.id)).emit('game:lobby', sessionSummary(s));
      cb({ ok: true, session: sessionSummary(s) });
    });

    socket.on('game:list', ({ roomId }, cb = () => {}) => {
      const list = [...sessions.values()]
        .filter((s) => s.roomId === roomId && s.status !== 'ended')
        .map(sessionSummary);
      cb({ ok: true, sessions: list });
    });

    socket.on('game:join', ({ sessionId }, cb = () => {}) => {
      const s = sessions.get(sessionId);
      if (!s) return cb({ error: 'game not found' });
      const mod = GAMES[s.gameId];
      let p = findPlayer(s);
      if (!p) {
        if (s.status !== 'lobby') return cb({ error: 'game already started' });
        if (s.players.length >= mod.meta.maxPlayers) return cb({ error: 'game is full' });
        p = { id: userId, sockets: new Set(), away: null };
        s.players.push(p);
      }
      p.sockets.add(socket.id);
      if (p.away) { clearTimeout(p.away); p.away = null; } // reconnected
      socket.join(chan(s.id));
      io.to(chan(s.id)).emit('game:lobby', sessionSummary(s));
      if (s.status === 'playing') broadcast(s);
      cb({ ok: true, session: sessionSummary(s) });
    });

    socket.on('game:start', ({ sessionId }, cb = () => {}) => {
      const s = sessions.get(sessionId);
      if (!s) return cb({ error: 'game not found' });
      if (s.hostId !== userId) return cb({ error: 'only the host can start' });
      if (s.status !== 'lobby') return cb({ error: 'already started' });
      const mod = GAMES[s.gameId];
      try {
        s.state = mod.createState(s.players.map((p) => p.id));
      } catch (err) { return cb({ error: err.message }); }
      s.status = 'playing';
      armTurnTimer(s);
      broadcast(s, [{ type: 'started' }]);
      cb({ ok: true });
    });

    socket.on('game:move', ({ sessionId, move }, cb = () => {}) => {
      const s = sessions.get(sessionId);
      if (!s || s.status !== 'playing') return cb({ error: 'no running game' });
      if (!findPlayer(s)) return cb({ error: 'you are not in this game' });
      const result = runMove(s, userId, move || {});
      cb(result.error ? { error: result.error } : { ok: true });
    });

    socket.on('game:leave', ({ sessionId }, cb = () => {}) => {
      const s = sessions.get(sessionId);
      if (!s) return cb({ error: 'game not found' });
      leave(s, userId);
      socket.leave(chan(s.id));
      cb({ ok: true });
    });

    socket.on('disconnect', () => {
      for (const s of sessions.values()) {
        const p = findPlayer(s);
        if (!p || !p.sockets.has(socket.id)) continue;
        p.sockets.delete(socket.id);
        if (p.sockets.size) continue; // still connected elsewhere
        if (s.status === 'lobby') { leave(s, userId); continue; }
        // grace window for reconnects mid-game
        p.away = setTimeout(() => leave(s, userId), DISCONNECT_GRACE_MS);
      }
    });

    function leave(s, pid) {
      const idx = s.players.findIndex((p) => p.id === pid);
      if (idx < 0) return;
      if (s.status === 'lobby') {
        s.players.splice(idx, 1);
        if (!s.players.length || s.hostId === pid) {
          clearTimer(s);
          sessions.delete(s.id);
          io.to(chan(s.id)).emit('game:cancelled', { sessionId: s.id });
        } else {
          io.to(chan(s.id)).emit('game:lobby', sessionSummary(s));
        }
        return;
      }
      if (s.status !== 'playing') return;
      const mod = GAMES[s.gameId];
      const { events } = mod.removePlayer(s.state, pid, []);
      if (mod.isOver(s.state)) {
        broadcast(s, events);
        endSession(s, mod.ranking(s.state));
      } else {
        armTurnTimer(s);
        broadcast(s, events);
      }
    }
  });

  return { sessions, games: Object.fromEntries(Object.entries(GAMES).map(([k, v]) => [k, v.meta])) };
}

module.exports = { attachGames, GAMES };
