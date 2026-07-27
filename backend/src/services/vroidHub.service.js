// VRoid Hub OAuth integration — same authorization-code-flow shape as
// spotify.service.js / youtube.service.js in this same directory, plus two
// things VRoid Hub specifically requires that Spotify/YouTube don't: PKCE
// (code_verifier/code_challenge) and a proprietary `X-Api-Version` header.
//
// CONFIRMED against pixiv's own official reference implementation
// (github.com/pixiv/VRoidHub-API-Example, lib/vroid-hub-api.ts +
// pages/api/vroid/*) once the live flow surfaced an OAUTH_FORBIDDEN 403 on
// the endpoints below (they'd been a best-documented guess, since
// developer.vroid.com was unreachable during original development): the
// model list path is /api/account/character_models (no /v1/, no
// is_private_visibility param -- paginated via max_id/count instead), and
// the download flow is two calls -- POST /api/download_licenses with
// { character_model_id } to get a license id, then GET
// /api/download_licenses/{id}/download with redirect:'manual', reading the
// real file URL off the Location header of the resulting redirect (never a
// JSON body field). The OAuth authorize/token paths, /api/account profile
// endpoint, PKCE, and the X-Api-Version:11 header were already confirmed
// correct and are unchanged.
import crypto from 'crypto';
import { getSupabaseAdmin } from '../config/supabase.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const AUTH_BASE = 'https://hub.vroid.com';
const API_BASE  = 'https://hub.vroid.com/api';
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

  // [{ id, name, thumbnailUrl }]
  async listModels(userId) {
    const connection = await this.getConnection(userId);
    if (!connection) return { connected: false, models: [] };

    const accessToken = await this._validAccessToken(connection);
    const res = await fetch(`${API_BASE}/account/character_models?count=50`, {
      headers: { Authorization: `Bearer ${accessToken}`, ...API_VERSION_HEADER },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.error('VRoid Hub model list failed', { status: res.status, body });
      throw httpError(502, 'Could not load your VRoid Hub models');
    }
    const data = await res.json();
    // CharacterModelSerializer (confirmed shape): id, name, is_downloadable,
    // portrait_image: { original, w600, w300, sq600, sq300, sq150 } (each an
    // ImageSerializer { url, url2x, width, height } — no direct .url on
    // portrait_image itself). sq150 is the right size for a picker thumbnail.
    // Only list models VRoid Hub actually lets us download — the others
    // can't become a WatchParty avatar at all.
    const models = (data?.data || [])
      .filter((m) => m.is_downloadable)
      .map((m) => ({
        id: m.id,
        name: m.name || 'Untitled',
        thumbnailUrl: m.portrait_image?.sq150?.url || m.portrait_image?.original?.url || null,
      }));
    return { connected: true, models };
  }

  // Fresh presigned download URL for the selected model's .vrm file — these
  // expire, so this always re-resolves via the API rather than caching the
  // URL. Two-step flow (see file header): a license id first, then the
  // actual file URL comes back as a redirect Location, not JSON.
  async getModelDownloadUrl(userId, modelId) {
    const connection = await this.getConnection(userId);
    if (!connection) throw httpError(400, 'VRoid Hub is not connected');

    const accessToken = await this._validAccessToken(connection);

    const licenseRes = await fetch(`${API_BASE}/download_licenses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', ...API_VERSION_HEADER },
      body: JSON.stringify({ character_model_id: modelId }),
    });
    if (!licenseRes.ok) {
      const body = await licenseRes.text().catch(() => '');
      logger.error('VRoid Hub download-license fetch failed', { status: licenseRes.status, body, modelId });
      throw httpError(502, 'Could not load this VRoid Hub model');
    }
    const licenseId = (await licenseRes.json())?.data?.id;
    if (!licenseId) {
      logger.error('VRoid Hub download-license response had no id', { modelId });
      throw httpError(502, 'Could not load this VRoid Hub model');
    }

    // The actual download is large, so the API hands back a redirect to the
    // real file location rather than the file itself — read the Location
    // header instead of following it.
    const downloadRes = await fetch(`${API_BASE}/download_licenses/${licenseId}/download`, {
      method: 'GET',
      redirect: 'manual',
      headers: { Authorization: `Bearer ${accessToken}`, 'Accept-Encoding': 'gzip', ...API_VERSION_HEADER },
    });
    const location = downloadRes.headers.get('location');
    if (!location) {
      logger.error('VRoid Hub download redirect had no Location header', { modelId, status: downloadRes.status });
      throw httpError(502, 'Could not load this VRoid Hub model');
    }
    return location;
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
