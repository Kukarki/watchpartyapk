import { userSocketMap } from './userMap.js';
import { logger } from '../utils/logger.js';

// In-process video call presence.
// Key: roomId → Set<userId>
// Ephemeral — lost on server restart, which is intentional.
const callRooms = new Map();

function getCallRoom(roomId) {
  if (!callRooms.has(roomId)) callRooms.set(roomId, new Set());
  return callRooms.get(roomId);
}

export function registerCallHandlers(io, socket) {
  const { userId, displayName, avatar } = socket.user;

  // ─── call:join ────────────────────────────────────────────────────────────
  // Adds the user to call presence and notifies existing participants.
  // Existing participants (who already have localStream set) will each
  // initiate an offer to the new joiner — mesh topology, no server media.
  socket.on('call:join', ({ roomId } = {}) => {
    if (!roomId) return;
    if (socket.data.callRoom === roomId) return; // already joined

    const room = getCallRoom(roomId);
    if (room.size >= 4) {
      socket.emit('call:error', { message: 'Call is full (max 4 participants)' });
      return;
    }

    room.add(userId);
    socket.data.callRoom = roomId;

    // Notify everyone else in the socket.io room (all room members receive this;
    // only those already in the video call will act on it).
    socket.to(roomId).emit('call:member_joined', { userId, displayName, avatar });

    logger.info('User joined video call', { userId, roomId, callSize: room.size });
  });

  // ─── call:leave ───────────────────────────────────────────────────────────
  socket.on('call:leave', () => {
    _leaveCall(io, socket);
  });

  // ─── WebRTC signaling relay (SDP + ICE) ──────────────────────────────────
  // Pure relay — the server never inspects or stores SDP/ICE payloads.

  socket.on('call:offer', ({ targetId, sdp } = {}) => {
    if (!targetId || !sdp) return;
    const targetSocketId = userSocketMap.get(targetId);
    if (targetSocketId) {
      io.to(targetSocketId).emit('call:offer', { fromId: userId, sdp });
    }
  });

  socket.on('call:answer', ({ targetId, sdp } = {}) => {
    if (!targetId || !sdp) return;
    const targetSocketId = userSocketMap.get(targetId);
    if (targetSocketId) {
      io.to(targetSocketId).emit('call:answer', { fromId: userId, sdp });
    }
  });

  socket.on('call:ice_candidate', ({ targetId, candidate } = {}) => {
    if (!targetId || !candidate) return;
    const targetSocketId = userSocketMap.get(targetId);
    if (targetSocketId) {
      io.to(targetSocketId).emit('call:ice_candidate', { fromId: userId, candidate });
    }
  });

  // ─── Emoji reaction broadcast ─────────────────────────────────────────────
  socket.on('call:reaction', ({ roomId, emoji } = {}) => {
    if (!roomId || !emoji) return;
    // Relay to everyone else in the room (sender already displayed it locally)
    socket.to(roomId).emit('call:reaction', { fromId: userId, displayName, emoji });
  });

  // ─── disconnect cleanup ───────────────────────────────────────────────────
  socket.on('disconnect', () => {
    if (socket.data.callRoom) _leaveCall(io, socket);
  });
}

function _leaveCall(io, socket) {
  const { userId, displayName } = socket.user;
  const roomId = socket.data.callRoom;
  if (!roomId) return;

  socket.data.callRoom = null;

  const room = getCallRoom(roomId);
  room.delete(userId);
  if (room.size === 0) callRooms.delete(roomId);

  io.to(roomId).emit('call:member_left', { userId, displayName });
  logger.info('User left video call', { userId, roomId });
}
