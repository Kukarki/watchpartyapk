import { getSupabaseAdmin } from '../config/supabase.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const AUTH_BASE = 'https://accounts.spotify.com';
const API_BASE  = 'https://api.spotify.com/v1';
const SCOPES    = ['user-read-currently-playing', 'user-read-playback-state'];

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function basicAuthHeader() {
  return 'Basic ' + Buffer.from(`${config.spotify.clientId}:${config.spotify.clientSecret}`).toString('base64');
}

class SpotifyService {
  get sb() {
    return getSupabaseAdmin();
  }

  getAuthUrl(state) {
    const params = new URLSearchParams({
      client_id:     config.spotify.clientId,
      response_type: 'code',
      redirect_uri:  config.spotify.redirectUri,
      scope:         SCOPES.join(' '),
      state,
    });
    return `${AUTH_BASE}/authorize?${params.toString()}`;
  }

  async exchangeCode(code) {
    const res = await fetch(`${AUTH_BASE}/api/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: basicAuthHeader() },
      body: new URLSearchParams({
        grant_type:   'authorization_code',
        code,
        redirect_uri: config.spotify.redirectUri,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.error('Spotify token exchange failed', { status: res.status, body, redirectUri: config.spotify.redirectUri });
      throw httpError(502, 'Spotify token exchange failed — try connecting again');
    }
    return res.json(); // { access_token, refresh_token, expires_in, ... }
  }

  async refreshAccessToken(refreshToken) {
    const res = await fetch(`${AUTH_BASE}/api/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: basicAuthHeader() },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.error('Spotify token refresh failed', { status: res.status, body });
      throw httpError(502, 'Spotify token refresh failed');
    }
    return res.json(); // { access_token, expires_in, refresh_token? }
  }

  async connectAccount(userId, code) {
    const tokens = await this.exchangeCode(code);
    const profile = await this._fetchProfile(tokens.access_token);

    const { error } = await this.sb.from('spotify_connections').upsert({
      user_id:         userId,
      spotify_user_id: profile.id,
      access_token:    tokens.access_token,
      refresh_token:   tokens.refresh_token,
      expires_at:      new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    }, { onConflict: 'user_id' });
    if (error) throw error;

    logger.info('Spotify account connected', { userId, spotifyUserId: profile.id });
    return { spotifyUserId: profile.id, displayName: profile.display_name };
  }

  async disconnectAccount(userId) {
    const { error } = await this.sb.from('spotify_connections').delete().eq('user_id', userId);
    if (error) throw error;
  }

  async getConnection(userId) {
    const { data, error } = await this.sb.from('spotify_connections').select('*').eq('user_id', userId).maybeSingle();
    if (error || !data) return null;
    return data;
  }

  async getNowPlaying(userId) {
    const connection = await this.getConnection(userId);
    if (!connection) return { connected: false };

    const accessToken = await this._validAccessToken(connection);
    const res = await fetch(`${API_BASE}/me/player/currently-playing`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.status === 204 || res.status === 202 || !res.ok) {
      return { connected: true, isPlaying: false };
    }

    const data = await res.json();
    if (!data?.item) return { connected: true, isPlaying: false };

    return {
      connected: true,
      isPlaying: data.is_playing,
      track: {
        name:     data.item.name,
        artists:  (data.item.artists || []).map((a) => a.name).join(', '),
        albumArt: data.item.album?.images?.[0]?.url || '',
        url:      data.item.external_urls?.spotify || '',
      },
    };
  }

  async _validAccessToken(connection) {
    const expiresAt = new Date(connection.expires_at).getTime();
    if (Date.now() < expiresAt - 30_000) return connection.access_token;

    const refreshed = await this.refreshAccessToken(connection.refresh_token);
    const updates = {
      access_token: refreshed.access_token,
      expires_at:   new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
    };
    if (refreshed.refresh_token) updates.refresh_token = refreshed.refresh_token;

    this.sb.from('spotify_connections').update(updates).eq('user_id', connection.user_id)
      .then(() => {}).catch(() => {});

    return refreshed.access_token;
  }

  async _fetchProfile(accessToken) {
    const res = await fetch(`${API_BASE}/me`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.error('Failed to fetch Spotify profile', { status: res.status, body });
      throw httpError(502, 'Failed to fetch Spotify profile');
    }
    return res.json();
  }
}

export const spotifyService = new SpotifyService();
