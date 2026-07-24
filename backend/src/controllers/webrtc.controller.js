import crypto from 'crypto';

const TURN_SERVER_HOST   = process.env.TURN_SERVER_HOST || '';
const TURN_SERVER_PORT   = process.env.TURN_SERVER_PORT || '3478';
const TURN_SHARED_SECRET = process.env.TURN_SHARED_SECRET || '';
const CREDENTIAL_TTL_SECONDS = 24 * 60 * 60; // short-lived; refetched per call, so 24h is generous

// Time-limited TURN credentials (coturn REST API convention): the username is
// an expiry timestamp, the credential is an HMAC-SHA1 of it keyed by the
// shared secret. The secret itself never leaves the backend.
export function getIceServers(req, res) {
  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  if (TURN_SERVER_HOST && TURN_SHARED_SECRET) {
    const username = String(Math.floor(Date.now() / 1000) + CREDENTIAL_TTL_SECONDS);
    const credential = crypto.createHmac('sha1', TURN_SHARED_SECRET).update(username).digest('base64');

    iceServers.push(
      { urls: `stun:${TURN_SERVER_HOST}:${TURN_SERVER_PORT}` },
      { urls: `turn:${TURN_SERVER_HOST}:${TURN_SERVER_PORT}?transport=udp`, username, credential },
      { urls: `turn:${TURN_SERVER_HOST}:${TURN_SERVER_PORT}?transport=tcp`, username, credential },
    );
  }

  res.json({ iceServers });
}
