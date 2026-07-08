import { Server } from 'socket.io';
import { config } from '../config/index.js';
import { verifyToken } from '../utils/jwt.js';
import { userSocketMap } from './userMap.js';
import { registerRoomHandlers } from './room.socket.js';
import { registerVoiceHandlers } from './voice.socket.js';
import { registerCallHandlers } from './callHandler.js';
import { registerFriendHandlers } from './friends.socket.js';
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

  // Auth middleware.
  // SECURITY (C2): if a token is PRESENT but invalid/expired, REJECT the
  // connection instead of silently downgrading to an anonymous guest.
  // Only allow the anonymous-guest fallback when NO token was supplied at all.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;

    if (token) {
      try {
        const decoded = verifyToken(token);
        socket.user = {
          userId:      decoded.userId,
          displayName: decoded.displayName || 'Guest',
          avatar:      decoded.avatar || '',
          provider:    decoded.provider || 'guest',
          authed:      true,
        };
        return next();
      } catch (err) {
        // A token was provided and it failed verification → refuse.
        logger.warn('Socket auth rejected: invalid token', { socketId: socket.id });
        return next(new Error('unauthorized'));
      }
    }

    // No token at all → anonymous guest (read-only-ish; sensitive actions gated downstream)
    socket.user = {
      userId:      `guest-${socket.id}`,
      displayName: 'Guest',
      avatar:      '',
      provider:    'guest',
      authed:      false,
    };
    return next();
  });

  io.on('connection', (socket) => {
    const { userId } = socket.user;

    userSocketMap.set(userId, socket.id);
    logger.info('Socket connected', { socketId: socket.id, userId });

    registerRoomHandlers(io, socket);
    registerVoiceHandlers(io, socket);
    registerCallHandlers(io, socket);
    registerFriendHandlers(io, socket);

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
