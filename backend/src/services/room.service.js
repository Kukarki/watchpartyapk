import { v4 as uuidv4 } from 'uuid';
import { getSupabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

class RoomService {
  get sb() {
    return getSupabaseAdmin();
  }

  // ── Rooms ──────────────────────────────────────────────────────────────────

  async createRoom({ name, hostId, hostName = '', videoUrl = '', roomType = 'watch' }) {
    const roomId = uuidv4().slice(0, 8).toUpperCase();

    const { data, error } = await this.sb
      .from('rooms')
      .insert({
        room_id:          roomId,
        name,
        host_id:          hostId,
        host_name:        hostName,
        is_public:        true,
        current_url:      videoUrl,
        is_playing:       false,
        video_position:   0,
        state_updated_at: new Date().toISOString(),
        room_type:        roomType,
      })
      .select()
      .single();

    if (error) throw error;
    logger.info('Room created', { roomId, hostId, roomType });
    return this._mapRoom(data);
  }

  async getRoomWithState(roomId) {
    const { data, error } = await this.sb
      .from('rooms')
      .select('*')
      .eq('room_id', roomId)
      .single();

    if (error || !data) return null;
    return this._mapRoom(data);
  }

  async updateVideoState(roomId, { isPlaying, currentTime, videoUrl }) {
    const patch = { state_updated_at: new Date().toISOString() };
    if (isPlaying   !== undefined) patch.is_playing      = isPlaying;
    if (currentTime !== undefined) patch.video_position  = currentTime;
    if (videoUrl    !== undefined) patch.current_url     = videoUrl;

    const { error } = await this.sb
      .from('rooms')
      .update(patch)
      .eq('room_id', roomId);

    if (error) throw error;
  }

  // ── Members ────────────────────────────────────────────────────────────────

  async addMember(roomId, { userId, displayName, avatar = '', isHost = false }) {
    const now = new Date().toISOString();
    const { error } = await this.sb
      .from('room_members')
      .upsert(
        {
          room_id:      roomId,
          user_id:      userId,
          display_name: displayName,
          avatar,
          is_host:      isHost,
          joined_at:    now,
        },
        { onConflict: 'room_id,user_id' }
      );

    if (error) throw error;

    // Also write room visit history (fire and forget — non-fatal)
    this.sb.from('user_room_history')
      .upsert({ user_id: userId, room_id: roomId, joined_at: now }, { onConflict: 'user_id,room_id' })
      .then(() => {}).catch(() => {});

    logger.info('Member joined room', { roomId, userId });
  }

  async removeMember(roomId, userId) {
    const { error } = await this.sb
      .from('room_members')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', userId);

    if (error) throw error;
    logger.info('Member left room', { roomId, userId });
  }

  async listPublicRooms(limit = 20) {
    const { data, error } = await this.sb
      .from('rooms')
      .select('room_id, name, host_id, host_name, is_public, created_at')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  async getRecentRooms(userId, limit = 6) {
    const { data, error } = await this.sb
      .from('user_room_history')
      .select('room_id, joined_at, rooms(name, host_name)')
      .eq('user_id', userId)
      .order('joined_at', { ascending: false })
      .limit(limit);

    if (error) return [];
    return (data || [])
      .filter((r) => r.rooms)
      .map((r) => ({
        roomId:   r.room_id,
        name:     r.rooms.name,
        hostName: r.rooms.host_name,
        joinedAt: r.joined_at,
      }));
  }

  async getRoomMembers(roomId) {
    const { data, error } = await this.sb
      .from('room_members')
      .select('*')
      .eq('room_id', roomId)
      .order('joined_at');

    if (error) return [];
    return (data || []).map(this._mapMember);
  }

  // ── Chat ───────────────────────────────────────────────────────────────────

  async addChatMessage(roomId, { userId, displayName, avatar = '', content, type = 'text' }) {
    const { data, error } = await this.sb
      .from('chat_messages')
      .insert({
        room_id:      roomId,
        user_id:      userId,
        display_name: displayName,
        avatar,
        content,
        type,
      })
      .select()
      .single();

    if (error) throw error;
    return this._mapMessage(data);
  }

  async getChatHistory(roomId, limit = 50) {
    const { data, error } = await this.sb
      .from('chat_messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return [];
    // Reverse so messages arrive oldest-first (chronological)
    return (data || []).reverse().map(this._mapMessage);
  }

  // ── Reactions ─────────────────────────────────────────────────────────────

  /**
   * Atomically toggle a reaction on a message using the DB function.
   * Returns the updated reactions object { emoji: [userId, ...], ... }
   */
  async applyReactionDB(messageId, emoji, userId) {
    try {
      const { data, error } = await this.sb.rpc('toggle_chat_reaction', {
        p_message_id: messageId,
        p_emoji:      emoji,
        p_user_id:    userId,
      });
      if (error) throw error;
      return data || {};
    } catch (err) {
      logger.warn('applyReactionDB failed — falling back to no-op', { err: err.message });
      return null; // caller handles null by not persisting
    }
  }

  // ── Listen history (music rooms) ────────────────────────────────────────────

  async logListenHistory(roomId, userId, { url, title = 'Untitled', thumbnail = '', type = 'youtube' }) {
    const { error } = await this.sb.from('listen_history').insert({
      user_id: userId, room_id: roomId, url, title, thumbnail, type,
    });
    if (error) logger.warn('logListenHistory failed', { roomId, userId, error: error.message });
  }

  async getListenHistory(userId, limit = 20) {
    const { data, error } = await this.sb
      .from('listen_history')
      .select('*')
      .eq('user_id', userId)
      .order('played_at', { ascending: false })
      .limit(limit);

    if (error) return [];
    return (data || []).map((r) => ({
      id: r.id, url: r.url, title: r.title, thumbnail: r.thumbnail,
      type: r.type, roomId: r.room_id, playedAt: r.played_at,
    }));
  }

  // ── Mappers ────────────────────────────────────────────────────────────────

  _mapRoom(row) {
    return {
      id:       row.room_id,
      name:     row.name,
      hostId:   row.host_id,
      isPublic: row.is_public ?? true,
      roomType: row.room_type || 'watch',
      videoState: {
        videoUrl:    row.current_url       || '',
        isPlaying:   row.is_playing        ?? false,
        currentTime: row.video_position    ?? 0,
        updatedAt:   row.state_updated_at ? new Date(row.state_updated_at).getTime() : 0,
      },
    };
  }

  _mapMember(row) {
    return {
      userId:      row.user_id,
      displayName: row.display_name,
      avatar:      row.avatar,
      isHost:      row.is_host,
    };
  }

  _mapMessage(row) {
    // reactions is stored as JSONB: { "😡": ["userId1", "userId2"], ... }
    // Validate it's a plain object (never an array — guards against bad DB data)
    const raw = row.reactions;
    const reactions = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};

    return {
      id:          row.id,
      userId:      row.user_id,
      displayName: row.display_name,
      avatar:      row.avatar,
      content:     row.content,
      type:        row.type,
      reactions,
      createdAt:   new Date(row.created_at).getTime(),
    };
  }
}

// Singleton — both the HTTP controllers and socket handlers share the same instance.
export const roomService = new RoomService();
