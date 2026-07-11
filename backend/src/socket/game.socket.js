import { roomService } from '../services/room.service.js';
import { gameService } from '../services/game.service.js';
import { logger } from '../utils/logger.js';

function inRoom(socket, roomId) {
  return roomId && socket.rooms.has(roomId);
}

export function registerGameHandlers(io, socket) {
  const { userId } = socket.user;

  // ─── game:start — host-only, deals current room members into the game ───
  socket.on('game:start', async ({ roomId } = {}) => {
    if (!inRoom(socket, roomId)) return;
    try {
      const room = await roomService.getRoomWithState(roomId);
      if (!room) return socket.emit('game:error', { message: 'Room not found' });
      if (room.hostId !== userId) return socket.emit('game:error', { message: 'Only the host can start the game' });
      if (!room.gameType) return socket.emit('game:error', { message: 'This room has no game configured' });

      const members = await roomService.getRoomMembers(roomId);
      if (members.length < 2) return socket.emit('game:error', { message: 'Need at least 2 players to start' });
      if (members.length > 4) return socket.emit('game:error', { message: 'Ludo supports at most 4 players' });

      const players = members.map((m) => ({ userId: m.userId, displayName: m.displayName }));
      const state = await gameService.createGame(roomId, room.gameType, players);

      io.to(roomId).emit('game:state', { state, events: [{ type: 'game_started' }] });
    } catch (err) {
      logger.error('game:start error', { err: err.message, roomId });
      socket.emit('game:error', { message: err.message || 'Could not start the game' });
    }
  });

  // ─── game:action — generic dispatch, e.g. { type: 'roll_dice' } / { type: 'move_token', tokenId } ───
  socket.on('game:action', async ({ roomId, action } = {}) => {
    if (!inRoom(socket, roomId) || !action?.type) return;
    try {
      const room = await roomService.getRoomWithState(roomId);
      if (!room?.gameType) return socket.emit('game:error', { message: 'No game in this room' });

      const { state, events } = await gameService.applyAction(roomId, room.gameType, action, userId);
      io.to(roomId).emit('game:state', { state, events });
    } catch (err) {
      // Illegal-move / not-your-turn errors are expected user feedback, not server faults.
      socket.emit('game:error', { message: err.message || 'Invalid move' });
    }
  });
}
