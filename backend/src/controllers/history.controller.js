import { roomService } from '../services/room.service.js';
import { isSupabaseConnected } from '../config/supabase.js';

export async function getListenHistory(req, res, next) {
  try {
    if (!isSupabaseConnected()) return res.json({ history: [] });
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const history = await roomService.getListenHistory(req.user.userId, limit);
    res.json({ history });
  } catch (err) {
    next(err);
  }
}
