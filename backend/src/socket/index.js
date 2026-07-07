import { Server } from 'socket.io';
import { config } from '../config/index.js';
import { verifyToken } from '../utils/jwt.js';
import { userSocketMap } from './userMap.js';
import { registerRoomHandlers } from './room.socket.js';
import { registerVoiceHandlers } from './voice.socket.js';
import { registerCallHandlers } from './callHandler.js';
import { logger } from '../utils/logger.js';

export function initSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin:      config.cors.origins,
      methods:     ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout:  20000,
    pingInterval: 25000,
    transports:   ['websocket', 'polling'],
  });

  // Auth middleware — never crash the connection
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (token) {
        try {
          const decoded = verifyToken(token);
          socket.user = {
            userId:      decoded.userId,
            displayName: decoded.displayName || 'Guest',
            avatar:      decoded.avatar || '',
          };
        } catch {
          socket.user = { userId: `guest-${socket.id}`, displayName: 'Guest', avatar: '' };
        }
      } else {
        socket.user = { userId: `guest-${socket.id}`, displayName: 'Guest', avatar: '' };
      }
      return next();
    } catch (err) {
      logger.error('Socket auth middleware error', { message: err.message });
      socket.user = { userId: `guest-${socket.id}`, displayName: 'Guest', avatar: '' };
      return next();
    }
  });

  io.on('connection', (socket) => {
    const { userId } = socket.user;

    // Track socket for WebRTC relay (replaces Redis user:socket keys)
    userSocketMap.set(userId, socket.id);
    logger.info('Socket connected', { socketId: socket.id, userId });

    registerRoomHandlers(io, socket);
    registerVoiceHandlers(io, socket);
    registerCallHandlers(io, socket);

    socket.on('ping', () => socket.emit('pong'));

    socket.on('disconnect', () => {
      userSocketMap.delete(userId);
      logger.info('Socket disconnected', { socketId: socket.id, userId });
    });
  });

  io.engine.on('connection_error', (err) => {
    logger.error('Socket engine connection error', { message: err.message, code: err.code });
  });

  return io;
}
