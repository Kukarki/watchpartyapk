import { webrtcApi } from '@/api/webrtc.api.js';

const FALLBACK_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

// Time-limited TURN credentials are fetched from the backend (which holds the
// shared secret) and cached for reuse across every call/screen-share/voice
// peer connection made during the session. Refetched well before the
// server-side credential's 24h expiry.
const CACHE_MS = 12 * 60 * 60 * 1000;

let cached = null;
let cachedAt = 0;
let inflight = null;

export async function getIceServers() {
  const now = Date.now();
  if (cached && (now - cachedAt) < CACHE_MS) return cached;
  if (inflight) return inflight;

  inflight = webrtcApi.getIceServers()
    .then(({ iceServers }) => {
      cached = iceServers?.length ? iceServers : FALLBACK_ICE_SERVERS;
      cachedAt = Date.now();
      return cached;
    })
    .catch(() => FALLBACK_ICE_SERVERS)
    .finally(() => { inflight = null; });

  return inflight;
}
