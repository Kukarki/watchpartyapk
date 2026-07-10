import { getSupabaseAdmin } from '../config/supabase.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const AUTH_BASE = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API_BASE  = 'https://www.googleapis.com/youtube/v3';
const SCOPE     = 'https://www.googleapis.com/auth/youtube.readonly';

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

class YouTubeService {
  get sb() {
    return getSupabaseAdmin();
  }

  getAuthUrl(state) {
    const params = new URLSearchParams({
      client_id:     config.youtube.clientId,
      response_type: 'code',
      redirect_uri:  config.youtube.redirectUri,
      scope:         SCOPE,
      access_type:   'offline', // required to get a refresh_token
      prompt:        'consent', // force refresh_token even on repeat connects
      state,
    });
    return `${AUTH_BASE}?${params.toString()}`;
  }

  async exchangeCode(code) {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     config.youtube.clientId,
        client_secret: config.youtube.clientSecret,
        redirect_uri:  config.youtube.redirectUri,
        grant_type:    'authorization_code',
      }),
    });
    if (!res.ok) throw httpError(502, 'YouTube token exchange failed — try connecting again');
    return res.json(); // { access_token, refresh_token, expires_in, ... }
  }

  async refreshAccessToken(refreshToken) {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id:     config.youtube.clientId,
        client_secret: config.youtube.clientSecret,
        grant_type:    'refresh_token',
      }),
    });
    if (!res.ok) throw httpError(502, 'YouTube token refresh failed');
    return res.json(); // { access_token, expires_in, ... } (no refresh_token on refresh)
  }

  async connectAccount(userId, code) {
    const tokens = await this.exchangeCode(code);
    if (!tokens.refresh_token) {
      throw httpError(400, 'Google did not grant offline access — disconnect any prior WatchParty access at myaccount.google.com/permissions and try again');
    }

    const channel = await this._fetchOwnChannel(tokens.access_token);

    const { error } = await this.sb.from('youtube_connections').upsert({
      user_id:        userId,
      google_user_id: channel.channelId,
      channel_title:  channel.title,
      access_token:   tokens.access_token,
      refresh_token:  tokens.refresh_token,
      expires_at:     new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    }, { onConflict: 'user_id' });
    if (error) throw error;

    logger.info('YouTube account connected', { userId, channelId: channel.channelId });
    return { channelTitle: channel.title };
  }

  async disconnectAccount(userId) {
    const { error } = await this.sb.from('youtube_connections').delete().eq('user_id', userId);
    if (error) throw error;
  }

  async getConnection(userId) {
    const { data, error } = await this.sb.from('youtube_connections').select('*').eq('user_id', userId).maybeSingle();
    if (error || !data) return null;
    return data;
  }

  async listPlaylists(userId) {
    const connection = await this.getConnection(userId);
    if (!connection) throw httpError(404, 'YouTube not connected');
    const accessToken = await this._validAccessToken(connection);

    const params = new URLSearchParams({ part: 'snippet,contentDetails', mine: 'true', maxResults: '50' });
    const res = await fetch(`${API_BASE}/playlists?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw httpError(502, 'Failed to load YouTube playlists');
    const data = await res.json();

    return (data.items || []).map((p) => ({
      id: p.id,
      title: p.snippet?.title || 'Untitled',
      thumbnail: p.snippet?.thumbnails?.medium?.url || p.snippet?.thumbnails?.default?.url || '',
      itemCount: p.contentDetails?.itemCount ?? 0,
    }));
  }

  async importPlaylist(userId, youtubePlaylistId, name) {
    const connection = await this.getConnection(userId);
    if (!connection) throw httpError(404, 'YouTube not connected');
    const accessToken = await this._validAccessToken(connection);

    const params = new URLSearchParams({ part: 'snippet,contentDetails', playlistId: youtubePlaylistId, maxResults: '50' });
    const res = await fetch(`${API_BASE}/playlistItems?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw httpError(502, 'Failed to load playlist tracks');
    const data = await res.json();

    const tracks = (data.items || [])
      .filter((item) => item.contentDetails?.videoId)
      .map((item, i) => ({
        url:       `https://www.youtube.com/watch?v=${item.contentDetails.videoId}`,
        title:     item.snippet?.title || 'Untitled',
        thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || '',
        position:  i,
      }));

    // Create a new WatchParty playlist and bulk-insert the tracks.
    const { data: playlist, error: pErr } = await this.sb
      .from('playlists')
      .insert({ owner_id: userId, name: name || 'Imported from YouTube' })
      .select().single();
    if (pErr) throw pErr;

    if (tracks.length > 0) {
      const rows = tracks.map((t) => ({ playlist_id: playlist.id, added_by: userId, type: 'youtube', ...t }));
      const { error: tErr } = await this.sb.from('playlist_tracks').insert(rows);
      if (tErr) throw tErr;
    }

    logger.info('YouTube playlist imported', { userId, youtubePlaylistId, count: tracks.length });
    return { playlistId: playlist.id, name: playlist.name, trackCount: tracks.length };
  }

  // ── Public search (API key, no user connection required) ──────────────────
  async searchVideos(query) {
    if (!config.youtube.apiKey) throw httpError(503, 'Music search is not configured on this server yet');
    const q = (query || '').trim();
    if (q.length < 2) return [];

    const params = new URLSearchParams({
      part: 'snippet', type: 'video', videoCategoryId: '10', // 10 = Music
      maxResults: '15', q, key: config.youtube.apiKey,
    });
    const res = await fetch(`${API_BASE}/search?${params.toString()}`);
    if (!res.ok) throw httpError(502, 'YouTube search failed');
    const data = await res.json();

    return (data.items || [])
      .filter((item) => item.id?.videoId)
      .map((item) => ({
        videoId:   item.id.videoId,
        url:       `https://www.youtube.com/watch?v=${item.id.videoId}`,
        title:     item.snippet?.title || 'Untitled',
        channel:   item.snippet?.channelTitle || '',
        thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || '',
      }));
  }

  async _validAccessToken(connection) {
    const expiresAt = new Date(connection.expires_at).getTime();
    if (Date.now() < expiresAt - 30_000) return connection.access_token;

    const refreshed = await this.refreshAccessToken(connection.refresh_token);
    const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

    this.sb.from('youtube_connections')
      .update({ access_token: refreshed.access_token, expires_at: newExpiresAt })
      .eq('user_id', connection.user_id)
      .then(() => {}).catch(() => {});

    return refreshed.access_token;
  }

  async _fetchOwnChannel(accessToken) {
    const params = new URLSearchParams({ part: 'snippet', mine: 'true' });
    const res = await fetch(`${API_BASE}/channels?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw httpError(502, 'Failed to fetch YouTube channel info');
    const data = await res.json();
    const channel = data.items?.[0];
    return { channelId: channel?.id || '', title: channel?.snippet?.title || 'YouTube' };
  }
}

export const youtubeService = new YouTubeService();
