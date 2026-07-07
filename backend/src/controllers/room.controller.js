import { roomService } from '../services/room.service.js';
import { isSupabaseConnected } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

export async function createRoom(req, res, next) {
  try {
    const { name, videoUrl } = req.body;
    const { userId, displayName } = req.user;
    if (!name?.trim()) return res.status(400).json({ error: 'Room name is required' });

    const room = await roomService.createRoom({
      name:     name.trim(),
      hostId:   userId,
      hostName: displayName || '',
      videoUrl: videoUrl || '',
    });

    res.status(201).json({ room });
  } catch (err) {
    next(err);
  }
}

export async function getRoom(req, res, next) {
  try {
    const room = await roomService.getRoomWithState(req.params.roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json({ room });
  } catch (err) {
    next(err);
  }
}

export async function getChatHistory(req, res, next) {
  try {
    const { roomId } = req.params;
    const count = Math.min(parseInt(req.query.count || '50', 10), 100);
    const messages = await roomService.getChatHistory(roomId, count);
    res.json({ messages });
  } catch (err) {
    next(err);
  }
}

export async function getPublicRooms(req, res, next) {
  try {
    if (!isSupabaseConnected()) return res.json({ rooms: [] });
    const rooms = await roomService.listPublicRooms(20);
    res.json({ rooms });
  } catch (err) {
    next(err);
  }
}
