import toast from 'react-hot-toast';
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
let warnedOnce = false;

export async function getIceServers() {
  const now = Date.now();
  if (cached && (now - cachedAt) < CACHE_MS) return cached;
  if (inflight) return inflight;

  inflight = webrtcApi.getIceServers()
    .then(({ iceServers }) => {
      const hasTurn = (iceServers || []).some((s) => String(s.urls).startsWith('turn:'));
      if (!hasTurn && !warnedOnce) {
        warnedOnce = true;
        console.warn('[WebRTC] No TURN server in ICE config — calls may fail across networks.', iceServers);
        toast.error('Call relay server unavailable — connection may fail on some networks.', { id: 'ice-no-turn' });
      } else {
        console.info('[WebRTC] ICE servers loaded (TURN included).');
      }
      cached = iceServers?.length ? iceServers : FALLBACK_ICE_SERVERS;
      cachedAt = Date.now();
      return cached;
    })
    .catch((err) => {
      if (!warnedOnce) {
        warnedOnce = true;
        console.error('[WebRTC] Failed to fetch ICE servers — falling back to STUN only.', err);
        toast.error('Could not reach the call relay server — calls may fail on some networks.', { id: 'ice-fetch-failed' });
      }
      return FALLBACK_ICE_SERVERS;
    })
    .finally(() => { inflight = null; });

  return inflight;
}
