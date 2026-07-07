/**
 * VideoService
 * Handles server-side video state reconciliation.
 * The server is the single source of truth for video state.
 * All clients receive authoritative state from here.
 */
export class VideoService {
  /**
   * Calculate the expected current time, accounting for network latency.
   * @param {object} state - Stored video state
   * @param {number} clientTimestamp - When the client sent the event (ms)
   * @returns {number} Adjusted current time in seconds
   */
  static reconcileTime(state, clientTimestamp) {
    if (!state.isPlaying) return state.currentTime;

    const now = Date.now();
    const latency = (now - clientTimestamp) / 1000; // seconds
    const elapsed = (now - state.updatedAt) / 1000;

    return state.currentTime + elapsed - latency;
  }

  /**
   * Determine if a client is out of sync beyond the acceptable threshold.
   * @param {number} clientTime
   * @param {number} serverTime
   * @param {number} threshold - seconds (default 2s)
   */
  static isOutOfSync(clientTime, serverTime, threshold = 2) {
    return Math.abs(clientTime - serverTime) > threshold;
  }
}