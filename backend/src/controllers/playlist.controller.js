import { playlistService } from '../services/playlist.service.js';
import { isSupabaseConnected } from '../config/supabase.js';

export async function listPlaylists(req, res, next) {
  try {
    if (!isSupabaseConnected()) return res.json({ playlists: [] });
    const playlists = await playlistService.listPlaylists(req.user.userId);
    res.json({ playlists });
  } catch (err) {
    next(err);
  }
}

export async function createPlaylist(req, res, next) {
  try {
    const playlist = await playlistService.createPlaylist(req.user.userId, req.body.name);
    res.status(201).json({ playlist });
  } catch (err) {
    next(err);
  }
}

export async function getPlaylist(req, res, next) {
  try {
    const playlist = await playlistService.getPlaylist(req.params.playlistId, req.user.userId);
    res.json({ playlist });
  } catch (err) {
    next(err);
  }
}

export async function getSharedPlaylist(req, res, next) {
  try {
    const playlist = await playlistService.getPlaylistByShareCode(req.params.shareCode);
    res.json({ playlist });
  } catch (err) {
    next(err);
  }
}

export async function updatePlaylist(req, res, next) {
  try {
    const { name, isPublic } = req.body;
    const playlist = await playlistService.updatePlaylist(req.params.playlistId, req.user.userId, { name, isPublic });
    res.json({ playlist });
  } catch (err) {
    next(err);
  }
}

export async function deletePlaylist(req, res, next) {
  try {
    await playlistService.deletePlaylist(req.params.playlistId, req.user.userId);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function addTrack(req, res, next) {
  try {
    const track = await playlistService.addTrack(req.params.playlistId, req.user.userId, req.body);
    res.status(201).json({ track });
  } catch (err) {
    next(err);
  }
}

export async function removeTrack(req, res, next) {
  try {
    await playlistService.removeTrack(req.params.playlistId, req.params.trackId, req.user.userId);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function importToRoom(req, res, next) {
  try {
    const result = await playlistService.importToRoom(req.params.playlistId, req.params.roomId, req.user.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
