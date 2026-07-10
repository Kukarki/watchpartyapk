import { youtubeService } from '../services/youtube.service.js';
import { isSupabaseConnected } from '../config/supabase.js';
import { config } from '../config/index.js';

export async function getAuthUrl(req, res, next) {
  try {
    if (!config.youtube.clientId) {
      return res.status(503).json({ error: 'YouTube is not configured on this server yet' });
    }
    const url = youtubeService.getAuthUrl(req.user.userId);
    res.json({ url });
  } catch (err) {
    next(err);
  }
}

export async function handleCallback(req, res, next) {
  try {
    if (!isSupabaseConnected()) return res.status(503).json({ error: 'Database not configured' });
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'code is required' });
    const result = await youtubeService.connectAccount(req.user.userId, code);
    res.json({ connected: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function listPlaylists(req, res, next) {
  try {
    if (!isSupabaseConnected()) return res.json({ connected: false, playlists: [] });
    const playlists = await youtubeService.listPlaylists(req.user.userId);
    res.json({ connected: true, playlists });
  } catch (err) {
    if (err.status === 404) return res.json({ connected: false, playlists: [] });
    next(err);
  }
}

export async function importPlaylist(req, res, next) {
  try {
    const { name } = req.body;
    const result = await youtubeService.importPlaylist(req.user.userId, req.params.playlistId, name);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function searchVideos(req, res, next) {
  try {
    const results = await youtubeService.searchVideos(req.query.q);
    res.json({ results });
  } catch (err) {
    next(err);
  }
}

export async function disconnect(req, res, next) {
  try {
    await youtubeService.disconnectAccount(req.user.userId);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
