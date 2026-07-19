/**
 * EXAMPLE — how to wire XP grants into your existing Socket.IO room layer.
 * This file is documentation; copy the relevant pieces into your handlers.
 *
 * Rules implemented here (from the design doc):
 *  - `join` XP only counts after 5 minutes of continuous presence
 *  - `host` XP only counts after 10 minutes with >= 2 other participants
 *  - grants push an `xp:awarded` event so the client can toast/level-up
 */
const { grantXp } = require('./progression.service');

const JOIN_VERIFY_MS = 5 * 60 * 1000;
const HOST_VERIFY_MS = 10 * 60 * 1000;

function wireAvatarXp(io) {
  io.on('connection', (socket) => {
    // assumes your auth middleware set socket.data.userId at handshake
    const userId = socket.data && socket.data.userId;
    if (!userId) return;

    socket.on('room:joined', ({ roomId }) => {
      const timer = setTimeout(async () => {
        try {
          const result = await grantXp(userId, 'join', { refId: roomId });
          if (result.granted) socket.emit('xp:awarded', result);
        } catch (err) {
          console.error('[avatar-xp] join grant failed', err.message);
        }
      }, JOIN_VERIFY_MS);
      socket.once('disconnect', () => clearTimeout(timer));
      socket.once('room:left', () => clearTimeout(timer));
    });

    socket.on('room:hosting', ({ roomId, getParticipantCount }) => {
      // `getParticipantCount` here stands in for however your room layer
      // exposes live occupancy (e.g. io.sockets.adapter.rooms.get(roomId).size)
      const timer = setTimeout(async () => {
        try {
          const others = (typeof getParticipantCount === 'function' ? getParticipantCount() : 0) - 1;
          if (others < 2) return; // didn't hold an audience — no grant
          const result = await grantXp(userId, 'host', { refId: roomId });
          if (result.granted) socket.emit('xp:awarded', result);
        } catch (err) {
          console.error('[avatar-xp] host grant failed', err.message);
        }
      }, HOST_VERIFY_MS);
      socket.once('disconnect', () => clearTimeout(timer));
    });
  });
}

module.exports = { wireAvatarXp };
