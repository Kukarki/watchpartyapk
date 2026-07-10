import crypto from 'crypto';
import { getSupabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function genShareCode() {
  return crypto.randomBytes(5).toString('hex');
}

class PlaylistService {
  get sb() {
    return getSupabaseAdmin();
  }

  async listPlaylists(ownerId) {
    const { data, error } = await this.sb
      .from('playlists')
      .select('*, playlist_tracks(count)')
      .eq('owner_id', ownerId)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return (data || []).map((p) => this._mapPlaylist(p));
  }

  async createPlaylist(ownerId, name) {
    const { data, error } = await this.sb
      .from('playlists')
      .insert({ owner_id: ownerId, name: name?.trim() || 'My Playlist' })
      .select()
      .single();
    if (error) throw error;
    return this._mapPlaylist(data);
  }

  async getPlaylist(playlistId, requesterId) {
    const { data: playlist, error } = await this.sb.from('playlists').select('*').eq('id', playlistId).single();
    if (error || !playlist) throw httpError(404, 'Playlist not found');
    if (playlist.owner_id !== requesterId && !playlist.is_public) {
      throw httpError(403, 'This playlist is private');
    }
    const tracks = await this._getTracks(playlistId);
    return { ...this._mapPlaylist(playlist), tracks };
  }

  async getPlaylistByShareCode(shareCode) {
    const { data: playlist, error } = await this.sb.from('playlists').select('*').eq('share_code', shareCode).single();
    if (error || !playlist) throw httpError(404, 'Playlist not found');
    const tracks = await this._getTracks(playlist.id);
    return { ...this._mapPlaylist(playlist), tracks };
  }

  async updatePlaylist(playlistId, ownerId, { name, isPublic }) {
    const { data: playlist } = await this.sb.from('playlists').select('*').eq('id', playlistId).single();
    if (!playlist) throw httpError(404, 'Playlist not found');
    if (playlist.owner_id !== ownerId) throw httpError(403, 'Not your playlist');

    const updates = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name.trim().slice(0, 60) || 'My Playlist';
    if (isPublic !== undefined) {
      updates.is_public = !!isPublic;
      if (isPublic && !playlist.share_code) updates.share_code = genShareCode();
    }

    const { data, error } = await this.sb.from('playlists').update(updates).eq('id', playlistId).select().single();
    if (error) throw error;
    return this._mapPlaylist(data);
  }

  async deletePlaylist(playlistId, ownerId) {
    const { data: playlist } = await this.sb.from('playlists').select('owner_id').eq('id', playlistId).single();
    if (!playlist) throw httpError(404, 'Playlist not found');
    if (playlist.owner_id !== ownerId) throw httpError(403, 'Not your playlist');
    const { error } = await this.sb.from('playlists').delete().eq('id', playlistId);
    if (error) throw error;
  }

  async addTrack(playlistId, ownerId, { url, title, thumbnail, type }) {
    const { data: playlist } = await this.sb.from('playlists').select('owner_id').eq('id', playlistId).single();
    if (!playlist) throw httpError(404, 'Playlist not found');
    if (playlist.owner_id !== ownerId) throw httpError(403, 'Not your playlist');
    if (!url?.trim()) throw httpError(400, 'url is required');

    const { data: last } = await this.sb
      .from('playlist_tracks').select('position').eq('playlist_id', playlistId)
      .order('position', { ascending: false }).limit(1).maybeSingle();
    const position = (last?.position ?? -1) + 1;

    const { data, error } = await this.sb
      .from('playlist_tracks')
      .insert({
        playlist_id: playlistId, url: url.trim(), title: title?.trim() || 'Untitled',
        thumbnail: thumbnail || '', type: type || 'youtube', added_by: ownerId, position,
      })
      .select().single();
    if (error) throw error;

    this.sb.from('playlists').update({ updated_at: new Date().toISOString() }).eq('id', playlistId)
      .then(() => {}).catch(() => {});
    return this._mapTrack(data);
  }

  async removeTrack(playlistId, trackId, ownerId) {
    const { data: playlist } = await this.sb.from('playlists').select('owner_id').eq('id', playlistId).single();
    if (!playlist) throw httpError(404, 'Playlist not found');
    if (playlist.owner_id !== ownerId) throw httpError(403, 'Not your playlist');
    const { error } = await this.sb.from('playlist_tracks').delete().eq('id', trackId).eq('playlist_id', playlistId);
    if (error) throw error;
  }

  // Seed a room's live queue (queue_items) from a playlist's tracks.
  async importToRoom(playlistId, roomId, requesterId) {
    const { data: playlist } = await this.sb.from('playlists').select('*').eq('id', playlistId).single();
    if (!playlist) throw httpError(404, 'Playlist not found');
    if (playlist.owner_id !== requesterId && !playlist.is_public) throw httpError(403, 'This playlist is private');

    const tracks = await this._getTracks(playlistId);
    if (tracks.length === 0) return { added: 0 };

    const { data: profile } = await this.sb.from('profiles').select('display_name').eq('id', requesterId).single();

    const rows = tracks.map((t) => ({
      room_id: roomId, url: t.url, title: t.title, thumbnail: t.thumbnail, type: t.type,
      added_by: requesterId, added_by_name: profile?.display_name || '', vote_count: 1,
    }));
    const { data: inserted, error } = await this.sb.from('queue_items').insert(rows).select();
    if (error) throw error;

    const votes = (inserted || []).map((item) => ({ item_id: item.id, user_id: requesterId }));
    if (votes.length) await this.sb.from('queue_votes').insert(votes);

    logger.info('Playlist imported to room', { playlistId, roomId, count: inserted?.length || 0 });
    return { added: inserted?.length || 0 };
  }

  async _getTracks(playlistId) {
    const { data, error } = await this.sb
      .from('playlist_tracks').select('*').eq('playlist_id', playlistId).order('position');
    if (error) return [];
    return (data || []).map((t) => this._mapTrack(t));
  }

  _mapPlaylist(row) {
    return {
      id: row.id, ownerId: row.owner_id, name: row.name, isPublic: row.is_public,
      shareCode: row.share_code, trackCount: row.playlist_tracks?.[0]?.count ?? undefined,
      createdAt: row.created_at, updatedAt: row.updated_at,
    };
  }

  _mapTrack(row) {
    return {
      id: row.id, playlistId: row.playlist_id, url: row.url, title: row.title,
      thumbnail: row.thumbnail, type: row.type, addedBy: row.added_by,
      position: row.position, createdAt: row.created_at,
    };
  }
}

export const playlistService = new PlaylistService();
