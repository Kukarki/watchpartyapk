import { getSupabaseAdmin } from '../config/supabase.js';
import { GAME_MODULES } from '../games/index.js';
import { logger } from '../utils/logger.js';

// Per-room mutex for removePlayer: concurrent disconnect + explicit leave on the
// same room must not both read the same stale state and then race to upsert.
const _removeInProgress = new Set();

class GameService {
  get sb() {
    return getSupabaseAdmin();
  }

  async getState(roomId) {
    const { data, error } = await this.sb.from('game_states').select('*').eq('room_id', roomId).maybeSingle();
    if (error || !data) return null;
    return { gameType: data.game_type, state: data.state };
  }

  async saveState(roomId, gameType, state) {
    const { error } = await this.sb.from('game_states').upsert({
      room_id: roomId, game_type: gameType, state, updated_at: new Date().toISOString(),
    }, { onConflict: 'room_id' });
    if (error) throw error;
  }

  async createGame(roomId, gameType, players, opts = {}) {
    const module = GAME_MODULES[gameType];
    if (!module) throw Object.assign(new Error(`Unknown game type: ${gameType}`), { status: 400 });

    const state = module.createInitialState(players, opts);
    await this.saveState(roomId, gameType, state);
    logger.info('Game started', { roomId, gameType, playerCount: players.length, mode: opts.mode });
    return state;
  }

  async applyAction(roomId, gameType, action, playerId) {
    const module = GAME_MODULES[gameType];
    if (!module) throw Object.assign(new Error(`Unknown game type: ${gameType}`), { status: 400 });

    const existing = await this.getState(roomId);
    if (!existing) throw Object.assign(new Error('No game in progress'), { status: 404 });

    const { state, events } = module.applyAction(existing.state, action, playerId);
    await this.saveState(roomId, gameType, state);
    return { state, events };
  }

  // Called when a player disconnects or explicitly leaves mid-game.
  // Delegates to the game module if it implements removePlayer; otherwise a no-op
  // (clients already handle game:player_left to freeze or end locally).
  // A per-room mutex prevents concurrent disconnect + explicit-leave calls from
  // both reading the same stale state and then racing to upsert.
  async removePlayer(roomId, userId) {
    if (_removeInProgress.has(roomId)) return;
    _removeInProgress.add(roomId);
    try {
      const existing = await this.getState(roomId);
      if (!existing) return;

      const module = GAME_MODULES[existing.gameType];
      if (typeof module?.removePlayer !== 'function') return;

      const result = module.removePlayer(existing.state, userId);
      if (!result) return;

      if (result.ended) {
        await this.sb.from('game_states').delete().eq('room_id', roomId);
        logger.info('Game ended after player removal', { roomId, userId });
      } else if (result.state) {
        await this.saveState(roomId, existing.gameType, result.state);
      }
    } finally {
      _removeInProgress.delete(roomId);
    }
  }
}

export const gameService = new GameService();
