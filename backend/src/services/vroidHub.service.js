// VRoid Hub OAuth integration — same authorization-code-flow shape as
// spotify.service.js / youtube.service.js in this same directory, plus two
// things VRoid Hub specifically requires that Spotify/YouTube don't: PKCE
// (code_verifier/code_challenge) and a proprietary `X-Api-Version` header.
//
// CONFIRMED (via a working reference provider config): the OAuth authorize
// path (/oauth/authorize), token path (/oauth/token), the profile endpoint
// (/api/account, and its response shape), the PKCE requirement, and the
// X-Api-Version:11 header.
//
// STILL UNVERIFIED (best-documented guess, developer.vroid.com's own docs
// blocked this codebase's fetch tooling): the character-model list and
// download-license endpoint paths/shapes below. Confirm against
// developer.vroid.com/en/api/ once reachable, or by testing the live flow.
import crypto from 'crypto';
import { getSupabaseAdmin } from '../config/supabase.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const AUTH_BASE = 'https://hub.vroid.com';
const API_BASE  = 'https://hub.vroid.com/api/v1';
const API_VERSION_HEADER = { 'X-Api-Version': '11' };

// Short-lived, in-memory PKCE verifier store, keyed by `state` (which this
// flow always sets to the WatchParty userId — same value connectAccount()
// receives back after the redirect, so no extra plumbing is needed to
// correlate the two). A single-process in-memory Map is fine here: entries
// live for at most a few minutes (the time it takes a user to approve the
// OAuth prompt) and are deleted the moment they're consumed.
const pkceStore = new Map(); // userId -> { verifier, ts }
const PKCE_TTL_MS = 10 * 60 * 1000;

function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function createPkcePair() {
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

class VroidHubService {
  get sb() {
    return getSupabaseAdmin();
  }

  getAuthUrl(state) {
    const { verifier, challenge } = createPkcePair();
    pkceStore.set(state, { verifier, ts: Date.now() });

    const params = new URLSearchParams({
      client_id:             config.vroidHub.clientId,
      response_type:         'code',
      redirect_uri:          config.vroidHub.redirectUri,
      scope:                 'default',
      state,
      code_challenge:        challenge,
      code_challenge_method: 'S256',
    });
    return `${AUTH_BASE}/oauth/authorize?${params.toString()}`;
  }

  async exchangeCode(code, state) {
    const entry = pkceStore.get(state);
    pkceStore.delete(state);
    if (!entry || Date.now() - entry.ts > PKCE_TTL_MS) {
      throw httpError(400, 'Login session expired — try connecting again');
    }

    const res = await fetch(`${AUTH_BASE}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...API_VERSION_HEADER },
      body: new URLSearchParams({
        grant_type:    'authorization_code',
        code,
        client_id:     config.vroidHub.clientId,
        client_secret: config.vroidHub.clientSecret,
        redirect_uri:  config.vroidHub.redirectUri,
        code_verifier: entry.verifier,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.error('VRoid Hub token exchange failed', { status: res.status, body, redirectUri: config.vroidHub.redirectUri });
      throw httpError(502, 'VRoid Hub token exchange failed — try connecting again');
    }
    return res.json(); // { access_token, refresh_token, expires_in, ... }
  }

  async refreshAccessToken(refreshToken) {
    const res = await fetch(`${AUTH_BASE}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...API_VERSION_HEADER },
      body: new URLSearchParams({
        grant_type:    'refresh_token',
        refresh_token: refreshToken,
        client_id:     config.vroidHub.clientId,
        client_secret: config.vroidHub.clientSecret,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.error('VRoid Hub token refresh failed', { status: res.status, body });
      throw httpError(502, 'VRoid Hub token refresh failed');
    }
    return res.json(); // { access_token, expires_in, refresh_token? }
  }

  async connectAccount(userId, code) {
    const tokens = await this.exchangeCode(code, userId);
    const profile = await this._fetchProfile(tokens.access_token);

    const { error } = await this.sb.from('vroid_hub_connections').upsert({
      user_id:       userId,
      vroid_user_id: profile.id,
      access_token:  tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at:    new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    }, { onConflict: 'user_id' });
    if (error) throw error;

    logger.info('VRoid Hub account connected', { userId, vroidUserId: profile.id });
    return { vroidUserId: profile.id, name: profile.name };
  }

  async disconnectAccount(userId) {
    const { error } = await this.sb.from('vroid_hub_connections').delete().eq('user_id', userId);
    if (error) throw error;
  }

  async getConnection(userId) {
    const { data, error } = await this.sb.from('vroid_hub_connections').select('*').eq('user_id', userId).maybeSingle();
    if (error || !data) return null;
    return data;
  }

  // [{ id, name, thumbnailUrl }] — UNVERIFIED path/shape, see file header.
  async listModels(userId) {
    const connection = await this.getConnection(userId);
    if (!connection) return { connected: false, models: [] };

    const accessToken = await this._validAccessToken(connection);
    const res = await fetch(`${API_BASE}/character_models?is_private_visibility=true`, {
      headers: { Authorization: `Bearer ${accessToken}`, ...API_VERSION_HEADER },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.error('VRoid Hub model list failed', { status: res.status, body });
      throw httpError(502, 'Could not load your VRoid Hub models');
    }
    const data = await res.json();
    const models = (data?.data || []).map((m) => ({
      id: m.id,
      name: m.character_model_name || m.name || 'Untitled',
      thumbnailUrl: m.portrait_image?.url || m.thumbnail_url || null,
    }));
    return { connected: true, models };
  }

  // Fresh presigned download URL for the selected model's .vrm file — these
  // expire, so this always re-resolves via the API rather than caching the
  // URL. UNVERIFIED path/shape, see file header.
  async getModelDownloadUrl(userId, modelId) {
    const connection = await this.getConnection(userId);
    if (!connection) throw httpError(400, 'VRoid Hub is not connected');

    const accessToken = await this._validAccessToken(connection);
    const res = await fetch(`${API_BASE}/character_models/${modelId}/download_license`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', ...API_VERSION_HEADER },
      body: JSON.stringify({ sdk_controller_name: 'watchparty' }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.error('VRoid Hub download-license fetch failed', { status: res.status, body, modelId });
      throw httpError(502, 'Could not load this VRoid Hub model');
    }
    const data = await res.json();
    return data?.file?.url || data?.url || null;
  }

  async selectModel(userId, modelId) {
    const { error } = await this.sb.from('profiles').update({ vrm_model_id: modelId }).eq('id', userId);
    if (error) throw error;
  }

  async getSelectedModelId(userId) {
    const { data, error } = await this.sb.from('profiles').select('vrm_model_id').eq('id', userId).maybeSingle();
    if (error) throw error;
    return data?.vrm_model_id || null;
  }

  // Fresh presigned URL for whichever model is currently selected, or null
  // if the user hasn't picked one yet.
  async getSelectedAvatarUrl(userId) {
    const modelId = await this.getSelectedModelId(userId);
    if (!modelId) return null;
    return this.getModelDownloadUrl(userId, modelId);
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

    this.sb.from('vroid_hub_connections').update(updates).eq('user_id', connection.user_id)
      .then(() => {}).catch(() => {});

    return refreshed.access_token;
  }

  // CONFIRMED path + response shape via a working reference provider config:
  // GET https://hub.vroid.com/api/account ->
  //   { data: { user_detail: { user: { id, name, icon: { sq170: { url } } } } } }
  async _fetchProfile(accessToken) {
    const res = await fetch(`${AUTH_BASE}/api/account`, {
      headers: { Authorization: `Bearer ${accessToken}`, ...API_VERSION_HEADER },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.error('Failed to fetch VRoid Hub profile', { status: res.status, body });
      throw httpError(502, 'Failed to fetch VRoid Hub profile');
    }
    const data = await res.json();
    const user = data?.data?.user_detail?.user || {};
    return { id: user.id, name: user.name, iconUrl: user.icon?.sq170?.url || null };
  }
}

export const vroidHubService = new VroidHubService();
