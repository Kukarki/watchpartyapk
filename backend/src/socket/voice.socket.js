import { userSocketMap } from './userMap.js';
import { logger } from '../utils/logger.js';

// In-process voice-channel presence.
// Key: `${roomId}:${channelId}` → Map<userId, socketId>
// Using a Map (not Set) lets us route WebRTC signaling to the exact tab that joined
// the channel and prevents a second tab from evicting the active voice socket.
// Ephemeral — lost on restart (which is fine; voice calls don't survive server restarts).
const voiceChannels = new Map();

function getChannel(roomId, channelId) {
  const key = `${roomId}:${channelId}`;
  if (!voiceChannels.has(key)) voiceChannels.set(key, new Map());
  return voiceChannels.get(key);
}

export function registerVoiceHandlers(io, socket) {
  const { userId, displayName, avatar } = socket.user;

  // ─── voice:join ────────────────────────────────────────────
  socket.on('voice:join', ({ roomId, channelId = 'general' } = {}) => {
    if (!roomId) return;
    const channel = getChannel(roomId, channelId);
    const existingMembers = [...channel.keys()];

    if (channel.has(userId)) {
      // User is rejoining from another tab — update their socket without re-broadcasting.
      channel.set(userId, socket.id);
      socket.data.voiceRoom    = roomId;
      socket.data.voiceChannel = channelId;
      socket.join(`voice:${roomId}:${channelId}`);
      // existingMembers snapshot (taken before this branch) includes the user's own userId
      // since they were already in the Map — filter it out so the client doesn't try to
      // create a peer connection to itself.
      socket.emit('voice:channel_members', { roomId, channelId, memberIds: existingMembers.filter(id => id !== userId) });
      return;
    }

    channel.set(userId, socket.id);
    socket.data.voiceRoom    = roomId;
    socket.data.voiceChannel = channelId;
    socket.join(`voice:${roomId}:${channelId}`);

    io.to(roomId).emit('voice:member_joined', { userId, displayName, avatar, roomId, channelId });
    socket.emit('voice:channel_members', { roomId, channelId, memberIds: existingMembers });

    logger.info('User joined voice channel', { userId, roomId, channelId });
  });

  // ─── voice:leave ───────────────────────────────────────────
  socket.on('voice:leave', () => {
    _leaveVoice(io, socket, true); // explicit leave — always fires
  });

  // ─── voice:mute ────────────────────────────────────────────
  socket.on('voice:mute', ({ roomId, isMuted } = {}) => {
    if (!roomId) return;
    socket.data.isMuted = isMuted;
    socket.to(roomId).emit('voice:muted', { userId, isMuted });
  });

  // ─── WebRTC signaling relay (SDP + ICE) ────────────────────

  socket.on('voice:offer', ({ targetId, sdp } = {}) => {
    if (!targetId || !sdp) return;
    const key = `${socket.data.voiceRoom}:${socket.data.voiceChannel}`;
    const targetSocketId = voiceChannels.get(key)?.get(targetId) ?? userSocketMap.get(targetId);
    if (targetSocketId) io.to(targetSocketId).emit('voice:offer', { fromId: userId, sdp });
  });

  socket.on('voice:answer', ({ targetId, sdp } = {}) => {
    if (!targetId || !sdp) return;
    const key = `${socket.data.voiceRoom}:${socket.data.voiceChannel}`;
    const targetSocketId = voiceChannels.get(key)?.get(targetId) ?? userSocketMap.get(targetId);
    if (targetSocketId) io.to(targetSocketId).emit('voice:answer', { fromId: userId, sdp });
  });

  socket.on('voice:ice_candidate', ({ targetId, candidate } = {}) => {
    if (!targetId || !candidate) return;
    const key = `${socket.data.voiceRoom}:${socket.data.voiceChannel}`;
    const targetSocketId = voiceChannels.get(key)?.get(targetId) ?? userSocketMap.get(targetId);
    if (targetSocketId) io.to(targetSocketId).emit('voice:ice_candidate', { fromId: userId, candidate });
  });

  // ─── screenshare signaling ─────────────────────────────────────
  socket.on('screenshare:start', ({ roomId } = {}) => {
    if (!roomId) return;
    socket.to(roomId).emit('screenshare:started', { userId, displayName });
  });

  socket.on('screenshare:stop', ({ roomId } = {}) => {
    if (!roomId) return;
    socket.to(roomId).emit('screenshare:stopped', { userId });
  });

  socket.on('screenshare:offer', ({ targetId, sdp } = {}) => {
    if (!targetId || !sdp) return;
    const targetSocketId = userSocketMap.get(targetId);
    if (targetSocketId) io.to(targetSocketId).emit('screenshare:offer', { fromId: userId, sdp });
  });

  socket.on('screenshare:answer', ({ targetId, sdp } = {}) => {
    if (!targetId || !sdp) return;
    const targetSocketId = userSocketMap.get(targetId);
    if (targetSocketId) io.to(targetSocketId).emit('screenshare:answer', { fromId: userId, sdp });
  });

  socket.on('screenshare:ice_candidate', ({ targetId, candidate } = {}) => {
    if (!targetId || !candidate) return;
    const targetSocketId = userSocketMap.get(targetId);
    if (targetSocketId) io.to(targetSocketId).emit('screenshare:ice_candidate', { fromId: userId, candidate });
  });

  // ─── disconnect cleanup ────────────────────────────────────
  socket.on('disconnect', () => {
    if (socket.data.voiceRoom) _leaveVoice(io, socket, false); // implicit — guard applies
  });
}

// force=true  (explicit voice:leave): always removes the user, even if a different tab
//             currently owns the channel Map slot.
// force=false (implicit disconnect): guard prevents an inactive background tab from
//             evicting the tab that has the live microphone stream.
function _leaveVoice(io, socket, force = false) {
  const { userId, displayName } = socket.user;
  const { voiceRoom: roomId, voiceChannel: channelId } = socket.data;
  if (!roomId || !channelId) return;

  socket.leave(`voice:${roomId}:${channelId}`);
  socket.data.voiceRoom    = null;
  socket.data.voiceChannel = null;

  const key = `${roomId}:${channelId}`;
  const channel = getChannel(roomId, channelId);
  if (!force && channel.get(userId) !== socket.id) return;

  channel.delete(userId);
  if (channel.size === 0) voiceChannels.delete(key);

  io.to(roomId).emit('voice:member_left', { userId, displayName, roomId, channelId });
  logger.info('User left voice channel', { userId, roomId, channelId });
}
