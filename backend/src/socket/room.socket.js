import { roomService } from '../services/room.service.js';
import { VideoService } from '../services/video.service.js';
import { logger } from '../utils/logger.js';

export function registerRoomHandlers(io, socket) {
  const { userId, displayName, avatar } = socket.user;

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
    if (!_inRoom(socket, roomId)) return;
    try {
      await roomService.updateVideoState(roomId, { isPlaying: true, currentTime });
      io.to(roomId).emit('video:play', { currentTime, userId, timestamp: timestamp || Date.now() });
    } catch (err) {
      logger.error('video:play error', { err: err.message });
    }
  });

  // ─── video:pause ─────────────────────────────────────────────────────────
  socket.on('video:pause', async ({ roomId, currentTime, timestamp } = {}) => {
    if (!_inRoom(socket, roomId)) return;
    try {
      await roomService.updateVideoState(roomId, { isPlaying: false, currentTime });
      io.to(roomId).emit('video:pause', { currentTime, userId, timestamp: timestamp || Date.now() });
    } catch (err) {
      logger.error('video:pause error', { err: err.message });
    }
  });

  // ─── video:seek ──────────────────────────────────────────────────────────
  socket.on('video:seek', async ({ roomId, currentTime, timestamp } = {}) => {
    if (!_inRoom(socket, roomId)) return;
    try {
      await roomService.updateVideoState(roomId, { currentTime });
      io.to(roomId).emit('video:seek', { currentTime, userId, timestamp: timestamp || Date.now() });
    } catch (err) {
      logger.error('video:seek error', { err: err.message });
    }
  });

  // ─── video:change_url ────────────────────────────────────────────────────
  socket.on('video:change_url', async ({ roomId, videoUrl } = {}) => {
    if (!_inRoom(socket, roomId)) return;
    try {
      await roomService.updateVideoState(roomId, { videoUrl, currentTime: 0, isPlaying: false });
      io.to(roomId).emit('video:state', { videoUrl, currentTime: 0, isPlaying: false, changedBy: userId });
    } catch (err) {
      logger.error('video:change_url error', { err: err.message });
    }
  });

  // ─── video:sync_request ──────────────────────────────────────────────────
  socket.on('video:sync_request', async ({ roomId } = {}) => {
    if (!roomId) return;
    try {
      const room = await roomService.getRoomWithState(roomId);
      if (!room) return;
      // Reconcile currentTime to account for elapsed playback since last DB write
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

  // ─── chat:reaction ───────────────────────────────────────────────────────
  socket.on('chat:reaction', async ({ roomId, messageId, emoji } = {}) => {
    if (!_inRoom(socket, roomId) || !messageId || !emoji) return;
    if (typeof emoji !== 'string' || emoji.length > 12) return;

    // Persist atomically to DB — the DB function handles toggle logic
    // (non-fatal: if DB fails we still broadcast the optimistic update)
    try {
      await roomService.applyReactionDB(messageId, emoji, userId);
    } catch (err) {
      logger.warn('chat:reaction DB persist failed', { err: err.message });
    }

    // Use socket.to() (not io.to()) so the sender is excluded.
    // The sender already applied the reaction optimistically in ChatMessage
    // local state — echoing back would toggle it off immediately.
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
