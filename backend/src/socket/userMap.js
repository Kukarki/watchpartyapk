// In-process userId ↔ socketId mapping.
// Replaces Redis `user:{userId}:socket` keys.
// Ephemeral by design — lost on restart, which is fine (sockets reconnect).
export const userSocketMap = new Map(); // userId → socketId
