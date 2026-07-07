import { v4 as uuidv4 } from 'uuid';
import { getSupabaseAdmin, isSupabaseConnected } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

const memory = {
  rooms: new Map(),
  members: new Map(),
  messages: new Map(),
};

class RoomService {
  get sb() {
    if (!isSupabaseConnected()) return null;
    return getSupabaseAdmin();
  }

  // ── Rooms ──────────────────────────────────────────────────────────────────

  async createRoom({ name, hostId, hostName = '', videoUrl = '' }) {
    const roomId = uuidv4().slice(0, 8).toUpperCase();

    if (!this.sb) {
      const now = new Date().toISOString();
      const room = {
        room_id: roomId,
        name,
        host_id: hostId,
        host_name: hostName,
        is_public: true,
        current_url: videoUrl,
        is_playing: false,
        video_position: 0,
        state_updated_at: now,
        created_at: now,
      };
      memory.rooms.set(roomId, room);
      memory.members.set(roomId, new Map());
      memory.messages.set(roomId, []);
      logger.info('Room created in memory', { roomId, hostId });
      return this._mapRoom(room);
    }

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
      })
      .select()
      .single();

    if (error) throw error;
    logger.info('Room created', { roomId, hostId });
    return this._mapRoom(data);
  }

  async getRoomWithState(roomId) {
    if (!this.sb) {
      const room = memory.rooms.get(roomId);
      return room ? this._mapRoom(room) : null;
    }

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

    if (!this.sb) {
      const room = memory.rooms.get(roomId);
      if (!room) return;
      Object.assign(room, patch);
      return;
    }

    const { error } = await this.sb
      .from('rooms')
      .update(patch)
      .eq('room_id', roomId);

    if (error) throw error;
  }

  // ── Members ────────────────────────────────────────────────────────────────

  async addMember(roomId, { userId, displayName, avatar = '', isHost = false }) {
    const now = new Date().toISOString();

    if (!this.sb) {
      if (!memory.members.has(roomId)) memory.members.set(roomId, new Map());
      memory.members.get(roomId).set(userId, {
        room_id: roomId,
        user_id: userId,
        display_name: displayName,
        avatar,
        is_host: isHost,
        joined_at: now,
      });
      logger.info('Member joined in-memory room', { roomId, userId });
      return;
    }

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
    if (!this.sb) {
      memory.members.get(roomId)?.delete(userId);
      logger.info('Member left in-memory room', { roomId, userId });
      return;
    }

    const { error } = await this.sb
      .from('room_members')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', userId);

    if (error) throw error;
    logger.info('Member left room', { roomId, userId });
  }

  async listPublicRooms(limit = 20) {
    if (!this.sb) {
      return Array.from(memory.rooms.values())
        .filter((room) => room.is_public)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, limit);
    }

    const { data, error } = await this.sb
      .from('rooms')
      .select('room_id, name, host_id, host_name, is_public, created_at')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  async getRoomMembers(roomId) {
    if (!this.sb) {
      return Array.from(memory.members.get(roomId)?.values() || [])
        .sort((a, b) => new Date(a.joined_at) - new Date(b.joined_at))
        .map(this._mapMember);
    }

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
    if (!this.sb) {
      const message = {
        id: uuidv4(),
        room_id: roomId,
        user_id: userId,
        display_name: displayName,
        avatar,
        content,
        type,
        reactions: {},
        created_at: new Date().toISOString(),
      };
      if (!memory.messages.has(roomId)) memory.messages.set(roomId, []);
      memory.messages.get(roomId).push(message);
      return this._mapMessage(message);
    }

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
    if (!this.sb) {
      return (memory.messages.get(roomId) || [])
        .slice(-limit)
        .map(this._mapMessage);
    }

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
    if (!this.sb) {
      for (const messages of memory.messages.values()) {
        const message = messages.find((item) => item.id === messageId);
        if (!message) continue;

        const users = new Set(message.reactions?.[emoji] || []);
        if (users.has(userId)) users.delete(userId);
        else users.add(userId);

        message.reactions = { ...(message.reactions || {}), [emoji]: Array.from(users) };
        if (!message.reactions[emoji].length) delete message.reactions[emoji];
        return message.reactions;
      }
      return null;
    }

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

  // ── Mappers ────────────────────────────────────────────────────────────────

  _mapRoom(row) {
    return {
      id:       row.room_id,
      name:     row.name,
      hostId:   row.host_id,
      isPublic: row.is_public ?? true,
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
