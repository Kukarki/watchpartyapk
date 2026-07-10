import { spotifyService } from '../services/spotify.service.js';
import { isSupabaseConnected } from '../config/supabase.js';
import { config } from '../config/index.js';

export async function getAuthUrl(req, res, next) {
  try {
    if (!config.spotify.clientId) {
      return res.status(503).json({ error: 'Spotify is not configured on this server yet' });
    }
    const url = spotifyService.getAuthUrl(req.user.userId);
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
    const result = await spotifyService.connectAccount(req.user.userId, code);
    res.json({ connected: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getNowPlaying(req, res, next) {
  try {
    if (!isSupabaseConnected()) return res.json({ connected: false });
    const data = await spotifyService.getNowPlaying(req.user.userId);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function disconnect(req, res, next) {
  try {
    await spotifyService.disconnectAccount(req.user.userId);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
