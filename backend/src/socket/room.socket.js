import { roomService } from '../services/room.service.js';
import { VideoService } from '../services/video.service.js';
import { logger } from '../utils/logger.js';

// ── Simple in-memory per-socket chat rate limiter (H5) ──────────────────────
// Allows up to MAX_MSGS within WINDOW_MS per socket. Ephemeral by design.
const CHAT_WINDOW_MS = 10_000;
const CHAT_MAX_MSGS  = 8;

function chatRateOk(socket) {
  const now = Date.now();
  if (!socket.data._chatHits) socket.data._chatHits = [];
  socket.data._chatHits = socket.data._chatHits.filter((t) => now - t < CHAT_WINDOW_MS);
  if (socket.data._chatHits.length >= CHAT_MAX_MSGS) return false;
  socket.data._chatHits.push(now);
  return true;
}

export function registerRoomHandlers(io, socket) {
  const { userId, displayName, avatar } = socket.user;

  // ── Authorization helper (C1) ─────────────────────────────────────────────
  // Only the room host may control shared playback. Returns the room if the
  // caller is authorized, otherwise emits an error and returns null.
  async function requirePlaybackControl(roomId) {
    if (!_inRoom(socket, roomId)) return null;
    const room = await roomService.getRoomWithState(roomId);
    if (!room) {
      socket.emit('room:error', { code: 'NOT_FOUND', message: 'Room not found' });
      return null;
    }
    if (room.hostId !== userId) {
      socket.emit('room:error', { code: 'FORBIDDEN', message: 'Only the host can control playback' });
      logger.warn('Blocked unauthorized playback control', { userId, roomId });
      return null;
    }
    return room;
  }

  // ─── room:join ───────────────────────────────────────────────────────────
  socket.on('room:join', async ({ roomId } = {}) => {
    if (!roomId) {
      return socket.emit('room:error', { code: 'INVALID_PAYLOAD', message: 'roomId required' });
    }

    try {
      const room = await roomService.getRoomWithState(roomId);
      if (!room) {
        return socket.emit('room:error', { code: 'NOT_FOUND', message: 'Room not found' });
      }

      const prevRoom = socket.data.currentRoomId;
      if (prevRoom && prevRoom !== roomId) await _leaveRoom(io, socket, prevRoom);

      socket.join(roomId);
      socket.data.currentRoomId = roomId;

      const isHost = room.hostId === userId;
      await roomService.addMember(roomId, { userId, displayName, avatar, isHost });

      const [members, chatHistory] = await Promise.all([
        roomService.getRoomMembers(roomId),
        roomService.getChatHistory(roomId, 50),
      ]);

      socket.emit('room:joined', {
        room,
        members,
        chatHistory,
        videoState: room.videoState,
      });

      socket.to(roomId).emit('room:member_joined', {
        member: { userId, displayName, avatar, isHost },
      });

      logger.info('Socket joined room', { socketId: socket.id, roomId, userId });
    } catch (err) {
      logger.error('room:join error', { err: err.message, roomId });
      socket.emit('room:error', { code: 'SERVER_ERROR', message: 'Failed to join room' });
    }
  });

  // ─── room:leave ──────────────────────────────────────────────────────────
  socket.on('room:leave', async ({ roomId } = {}) => {
    if (!roomId) return;
    await _leaveRoom(io, socket, roomId);
  });

  // ─── video:play ──────────────────────────────────────────────────────────
  socket.on('video:play', async ({ roomId, currentTime, timestamp } = {}) => {
    const room = await requirePlaybackControl(roomId);
    if (!room) return;
    try {
      await roomService.updateVideoState(roomId, { isPlaying: true, currentTime });
      io.to(roomId).emit('video:play', { currentTime, userId, timestamp: timestamp || Date.now() });
    } catch (err) {
      logger.error('video:play error', { err: err.message });
    }
  });

  // ─── video:pause ─────────────────────────────────────────────────────────
  socket.on('video:pause', async ({ roomId, currentTime, timestamp } = {}) => {
    const room = await requirePlaybackControl(roomId);
    if (!room) return;
    try {
      await roomService.updateVideoState(roomId, { isPlaying: false, currentTime });
      io.to(roomId).emit('video:pause', { currentTime, userId, timestamp: timestamp || Date.now() });
    } catch (err) {
      logger.error('video:pause error', { err: err.message });
    }
  });

  // ─── video:seek ──────────────────────────────────────────────────────────
  socket.on('video:seek', async ({ roomId, currentTime, timestamp } = {}) => {
    const room = await requirePlaybackControl(roomId);
    if (!room) return;
    try {
      await roomService.updateVideoState(roomId, { currentTime });
      io.to(roomId).emit('video:seek', { currentTime, userId, timestamp: timestamp || Date.now() });
    } catch (err) {
      logger.error('video:seek error', { err: err.message });
    }
  });

  // ─── video:change_url ────────────────────────────────────────────────────
  socket.on('video:change_url', async ({ roomId, videoUrl } = {}) => {
    const room = await requirePlaybackControl(roomId);
    if (!room) return;
    if (typeof videoUrl !== 'string' || videoUrl.length > 2048) return;
    try {
      await roomService.updateVideoState(roomId, { videoUrl, currentTime: 0, isPlaying: false });
      io.to(roomId).emit('video:state', { videoUrl, currentTime: 0, isPlaying: false, changedBy: userId });
    } catch (err) {
      logger.error('video:change_url error', { err: err.message });
    }
  });

  // ─── video:sync_request ──────────────────────────────────────────────────
  // Read-only — any member may request the authoritative state.
  socket.on('video:sync_request', async ({ roomId } = {}) => {
    if (!_inRoom(socket, roomId)) return;
    try {
      const room = await roomService.getRoomWithState(roomId);
      if (!room) return;
      const currentTime = VideoService.reconcileTime(room.videoState, Date.now());
      socket.emit('video:state', { ...room.videoState, currentTime });
    } catch (err) {
      logger.error('video:sync_request error', { err: err.message });
    }
  });

  // ─── chat:message ────────────────────────────────────────────────────────
  socket.on('chat:message', async ({ roomId, content, type = 'text' } = {}) => {
    if (!_inRoom(socket, roomId)) return;
    if (!content?.trim()) return;
    if (typeof content !== 'string') return;
    if (type !== 'text' && type !== 'emoji') return;          // whitelist message types
    if (!chatRateOk(socket)) {                                 // H5 rate limit
      return socket.emit('chat:rate_limited', { message: 'You are sending messages too fast.' });
    }

    try {
      const message = await roomService.addChatMessage(roomId, {
        userId,
        displayName,
        avatar,
        content: content.trim().slice(0, 2000),
        type,
      });
      io.to(roomId).emit('chat:message', { message });
    } catch (err) {
      logger.error('chat:message error', { err: err.message });
    }
  });

  // ─── reaction:float (ephemeral floating emojis, seen by everyone) ─────────
  socket.on('reaction:float', ({ roomId, emoji } = {}) => {
    if (!_inRoom(socket, roomId)) return;
    if (typeof emoji !== 'string' || emoji.length > 12) return;
    if (!chatRateOk(socket)) return;   // reuse chat rate limit to prevent spam
    io.to(roomId).emit('reaction:float', { emoji, userId, displayName });
  });

  // ─── chat:reaction ───────────────────────────────────────────────────────
  socket.on('chat:reaction', async ({ roomId, messageId, emoji } = {}) => {
    if (!_inRoom(socket, roomId) || !messageId || !emoji) return;
    if (typeof emoji !== 'string' || emoji.length > 12) return;

    try {
      await roomService.applyReactionDB(messageId, emoji, userId);
    } catch (err) {
      logger.warn('chat:reaction DB persist failed', { err: err.message });
    }

    socket.to(roomId).emit('chat:reaction', { messageId, emoji, userId });
  });

  // ─── chat:typing ─────────────────────────────────────────────────────────
  socket.on('chat:typing', ({ roomId, isTyping } = {}) => {
    if (!_inRoom(socket, roomId)) return;
    socket.to(roomId).emit('chat:typing', { userId, displayName, isTyping });
  });

  // ─── disconnect cleanup ───────────────────────────────────────────────────
  socket.on('disconnect', async () => {
    const roomId = socket.data.currentRoomId;
    if (roomId) await _leaveRoom(io, socket, roomId);
  });
}

async function _leaveRoom(io, socket, roomId) {
  const { userId, displayName } = socket.user;
  socket.leave(roomId);
  socket.data.currentRoomId = null;

  try {
    await roomService.removeMember(roomId, userId);
    io.to(roomId).emit('room:member_left', { userId, displayName });
    logger.info('Socket left room', { socketId: socket.id, roomId, userId });
  } catch (err) {
    logger.error('_leaveRoom error', { err: err.message });
  }
}

function _inRoom(socket, roomId) {
  return roomId && socket.rooms.has(roomId);
}
