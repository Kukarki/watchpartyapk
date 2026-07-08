import { addSocket, removeSocket, getOnlineUserIds, emitToUser } from './userMap.js';
import { friendService } from '../services/friend.service.js';
import { getSupabaseAdmin, isSupabaseConnected } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

export function registerFriendHandlers(io, socket) {
  const { userId, displayName, avatar } = socket.user;

  const { wentOnline } = addSocket(userId, socket.id);

  if (wentOnline) {
    broadcastPresence(io, userId, true).catch((err) => {
      logger.warn('Friend presence broadcast (online) failed', { userId, err: err.message });
    });
  }

  sendPresenceSnapshot(socket, userId).catch((err) => {
    logger.warn('Friend presence snapshot failed', { userId, err: err.message });
  });

  socket.on('friend:invite', async ({ toUserId, roomId } = {}) => {
    try {
      if (!toUserId || !roomId) return;
      const friendIds = await friendService.getFriendIds(userId);
      if (!friendIds.includes(toUserId)) return; // silently ignore non-friends
      emitToUser(io, toUserId, 'friend:invited', {
        fromUser: { userId, displayName, avatar },
        roomId,
      });
    } catch (err) {
      logger.warn('friend:invite failed', { userId, err: err.message });
    }
  });

  socket.on('disconnect', () => {
    const { wentOffline } = removeSocket(userId, socket.id);
    if (!wentOffline) return;

    updateLastSeen(userId).catch(() => {});
    broadcastPresence(io, userId, false).catch((err) => {
      logger.warn('Friend presence broadcast (offline) failed', { userId, err: err.message });
    });
  });
}

async function broadcastPresence(io, userId, online) {
  const friendIds = await friendService.getFriendIds(userId);
  for (const friendId of friendIds) {
    emitToUser(io, friendId, 'presence:update', { userId, online });
  }
}

async function sendPresenceSnapshot(socket, userId) {
  const friendIds = await friendService.getFriendIds(userId);
  const onlineIds = getOnlineUserIds();
  const onlineFriendIds = friendIds.filter((id) => onlineIds.has(id));
  socket.emit('presence:snapshot', { onlineFriendIds });
}

async function updateLastSeen(userId) {
  if (!isSupabaseConnected()) return;
  await getSupabaseAdmin().from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', userId);
}
