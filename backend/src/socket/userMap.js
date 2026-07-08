// In-process userId ↔ socketId mapping.
// Replaces Redis `user:{userId}:socket` keys.
// Ephemeral by design — lost on restart, which is fine (sockets reconnect).
export const userSocketMap = new Map(); // userId → socketId (most recent — used by voice/call 1:1 signaling)

// userId → Set<socketId>. Tracks every open socket per user (multi-tab/device).
// Used for presence (online/offline) and for broadcasting to all of a user's tabs,
// independent of the single "most recent socket" tracked above.
const userSocketSets = new Map();

// Returns { wentOnline } — true if this was the user's first open socket.
export function addSocket(userId, socketId) {
  const set = userSocketSets.get(userId);
  if (!set) {
    userSocketSets.set(userId, new Set([socketId]));
    return { wentOnline: true };
  }
  set.add(socketId);
  return { wentOnline: false };
}

// Returns { wentOffline } — true if the user has no open sockets left.
export function removeSocket(userId, socketId) {
  const set = userSocketSets.get(userId);
  if (!set) return { wentOffline: false };
  set.delete(socketId);
  if (set.size === 0) {
    userSocketSets.delete(userId);
    return { wentOffline: true };
  }
  return { wentOffline: false };
}

export function isOnline(userId) {
  return userSocketSets.has(userId);
}

export function getOnlineUserIds() {
  return new Set(userSocketSets.keys());
}

export function emitToUser(io, userId, event, payload) {
  const set = userSocketSets.get(userId);
  if (!set) return;
  for (const socketId of set) {
    io.to(socketId).emit(event, payload);
  }
}
