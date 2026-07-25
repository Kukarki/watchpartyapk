import { roomService } from '../services/room.service.js';
import { gameService } from '../services/game.service.js';
import { GAME_MODULES } from '../games/index.js';
import { makeBotPlayer } from '../games/ludoBot.js';
import { logger } from '../utils/logger.js';

function inRoom(socket, roomId) {
  return roomId && socket.rooms.has(roomId);
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// After any state change, if it's now a bot's turn, play it out automatically
// (roll, then move) with human-feeling pauses, recursing for extra turns or
// back-to-back bot players. Never throws into the caller — a bot hiccup
// shouldn't take down a real player's move.
async function maybeRunBotTurn(io, roomId, gameType, state, depth = 0) {
  if (depth > 20) return; // safety valve against any unforeseen infinite loop
  if (!state || state.winner) return;

  const module = GAME_MODULES[gameType];
  const player = state.players?.[state.currentPlayerIndex];
  if (!player?.isBot || typeof module?.pickBotMove !== 'function') return;

  try {
    await delay(1200 + Math.random() * 700);

    // Power mode: the bot may spend one of its game-long dice choices instead
    // of rolling randomly.
    let chosenValue = null;
    if (typeof module.pickBotDiceValue === 'function') {
      chosenValue = module.pickBotDiceValue(state, player.userId);
    }

    let result = chosenValue !== null
      ? await gameService.applyAction(roomId, gameType, { type: 'choose_dice_value', value: chosenValue }, player.userId)
      : await gameService.applyAction(roomId, gameType, { type: 'roll_dice' }, player.userId);
    io.to(roomId).emit('game:state', result);

    let { state: next } = result;

    if (next.diceValue !== null && next.legalTokenIds?.length > 0) {
      await delay(1000 + Math.random() * 600);
      const tokenId = module.pickBotMove(next, player.userId);
      if (tokenId) {
        result = await gameService.applyAction(roomId, gameType, { type: 'move_token', tokenId }, player.userId);
        io.to(roomId).emit('game:state', result);
        next = result.state;
      }
    }

    await maybeRunBotTurn(io, roomId, gameType, next, depth + 1);
  } catch (err) {
    logger.error('bot turn error', { err: err.message, roomId });
  }
}

export function registerGameHandlers(io, socket) {
  const { userId } = socket.user;

  // ─── game:start — any current room member (2+ players) can start; deals
  // current room members (+ optional bots) into the game ───
  socket.on('game:start', async ({ roomId, botCount = 0, mode = 'classic' } = {}) => {
    if (!inRoom(socket, roomId)) return;
    try {
      const room = await roomService.getRoomWithState(roomId);
      if (!room) return socket.emit('game:error', { message: 'Room not found' });
      if (!room.gameType) return socket.emit('game:error', { message: 'This room has no game configured' });

      const module = GAME_MODULES[room.gameType];
      if (!module) return socket.emit('game:error', { message: `Unknown game type: ${room.gameType}` });
      const maxPlayers = module.meta?.maxPlayers ?? 4;
      const minPlayers = module.meta?.minPlayers ?? 2;

      const members = await roomService.getRoomMembers(roomId);
      if (members.length > maxPlayers) return socket.emit('game:error', { message: `${room.gameType} supports at most ${maxPlayers} players` });

      const requestedBots = Math.max(0, Math.min(Number(botCount) || 0, maxPlayers - members.length));
      if (members.length + requestedBots < minPlayers) {
        return socket.emit('game:error', { message: `Need at least ${minPlayers} players (including bots) to start` });
      }

      const players = members.map((m) => ({ userId: m.userId, displayName: m.displayName, isBot: false }));
      for (let i = 1; i <= requestedBots; i++) players.push(makeBotPlayer(roomId, i));

      const resolvedMode = mode === 'power' ? 'power' : 'classic';
      const state = await gameService.createGame(roomId, room.gameType, players, { mode: resolvedMode });

      io.to(roomId).emit('game:state', { state, events: [{ type: 'game_started' }] });
      maybeRunBotTurn(io, roomId, room.gameType, state);
    } catch (err) {
      logger.error('game:start error', { err: err.message, roomId });
      socket.emit('game:error', { message: err.message || 'Could not start the game' });
    }
  });

  // ─── game:leave — explicit leave (e.g. user navigates away without disconnecting) ───
  socket.on('game:leave', async ({ roomId } = {}) => {
    if (!inRoom(socket, roomId)) return;
    try {
      const gs = await gameService.getState(roomId);
      if (!gs) return;
      await gameService.removePlayer(roomId, userId);
      io.to(roomId).emit('game:player_left', { userId, roomId });
    } catch (err) {
      logger.error('game:leave error', { err: err.message, roomId });
    }
  });

  // ─── disconnect — notify the room so clients don't freeze waiting for a gone player ───
  socket.on('disconnect', () => {
    // socket.rooms is still populated during the 'disconnect' event.
    for (const roomId of socket.rooms) {
      if (roomId === socket.id) continue; // every socket is in its own room — skip
      gameService.getState(roomId).then(async (gs) => {
        if (!gs) return;
        await gameService.removePlayer(roomId, userId);
        io.to(roomId).emit('game:player_left', { userId, roomId });
      }).catch(() => {});
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
      maybeRunBotTurn(io, roomId, room.gameType, state);
    } catch (err) {
      // Illegal-move / not-your-turn errors are expected user feedback, not server faults.
      socket.emit('game:error', { message: err.message || 'Invalid move' });
    }
  });
}
