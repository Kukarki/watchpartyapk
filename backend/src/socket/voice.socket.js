import { userSocketMap } from './userMap.js';
import { logger } from '../utils/logger.js';

// In-process voice-channel presence.
// Key: `${roomId}:${channelId}` → Set<userId>
// Ephemeral — lost on restart (which is fine; voice calls don't survive server restarts).
const voiceChannels = new Map();

function getChannel(roomId, channelId) {
  const key = `${roomId}:${channelId}`;
  if (!voiceChannels.has(key)) voiceChannels.set(key, new Set());
  return voiceChannels.get(key);
}

export function registerVoiceHandlers(io, socket) {
  const { userId, displayName, avatar } = socket.user;

  // ─── voice:join ────────────────────────────────────────────
  socket.on('voice:join', ({ roomId, channelId = 'general' } = {}) => {
    if (!roomId) return;
    const channel = getChannel(roomId, channelId);
    const existingMembers = [...channel];

    channel.add(userId);
    socket.data.voiceRoom    = roomId;
    socket.data.voiceChannel = channelId;
    socket.join(`voice:${roomId}:${channelId}`);

    io.to(roomId).emit('voice:member_joined', { userId, displayName, avatar, channelId });
    socket.emit('voice:channel_members', { channelId, memberIds: existingMembers });

    logger.info('User joined voice channel', { userId, roomId, channelId });
  });

  // ─── voice:leave ───────────────────────────────────────────
  socket.on('voice:leave', () => {
    _leaveVoice(io, socket);
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
    const targetSocketId = userSocketMap.get(targetId);
    if (targetSocketId) io.to(targetSocketId).emit('voice:offer', { fromId: userId, sdp });
  });

  socket.on('voice:answer', ({ targetId, sdp } = {}) => {
    if (!targetId || !sdp) return;
    const targetSocketId = userSocketMap.get(targetId);
    if (targetSocketId) io.to(targetSocketId).emit('voice:answer', { fromId: userId, sdp });
  });

  socket.on('voice:ice_candidate', ({ targetId, candidate } = {}) => {
    if (!targetId || !candidate) return;
    const targetSocketId = userSocketMap.get(targetId);
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
    if (socket.data.voiceRoom) _leaveVoice(io, socket);
  });
}

function _leaveVoice(io, socket) {
  const { userId, displayName } = socket.user;
  const { voiceRoom: roomId, voiceChannel: channelId } = socket.data;
  if (!roomId || !channelId) return;

  socket.leave(`voice:${roomId}:${channelId}`);
  socket.data.voiceRoom    = null;
  socket.data.voiceChannel = null;

  const channel = getChannel(roomId, channelId);
  channel.delete(userId);
  if (channel.size === 0) voiceChannels.delete(`${roomId}:${channelId}`);

  io.to(roomId).emit('voice:member_left', { userId, displayName, channelId });
  logger.info('User left voice channel', { userId, roomId, channelId });
}
