import { getSupabaseAdmin } from '../config/supabase.js';
import { GAME_MODULES } from '../games/index.js';
import { logger } from '../utils/logger.js';

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

  async createGame(roomId, gameType, players) {
    const module = GAME_MODULES[gameType];
    if (!module) throw Object.assign(new Error(`Unknown game type: ${gameType}`), { status: 400 });

    const state = module.createInitialState(players);
    await this.saveState(roomId, gameType, state);
    logger.info('Game started', { roomId, gameType, playerCount: players.length });
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
}

export const gameService = new GameService();
