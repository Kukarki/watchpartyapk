/**
 * HLS Proxy
 * Fetches .m3u8 manifests and .ts segments from kisskh CDNs,
 * rewrites segment URLs to go through this proxy, and adds
 * CORS headers so the browser can load them from any origin.
 */

import { Router } from 'express';

const router = Router();

// Allow only these CDN provider domains (and their subdomains).
// SECURITY (M1): match by domain SUFFIX, not substring. Substring matching
// would let "kisskh.evil.com" through. We also require http(s) and block
// any URL that resolves to a non-standard scheme.
const ALLOWED_DOMAINS = [
  'cdnvideo.com',
  'videofaster.com',
  'kisskh.co',
];

function isAllowed(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    const host = parsed.hostname.toLowerCase();
    return ALLOWED_DOMAINS.some(
      (d) => host === d || host.endsWith('.' + d)
    );
  } catch {
    return false;
  }
}

const PROXY_HEADERS = {
  Referer:         'https://kisskh.co/',
  Origin:          'https://kisskh.co',
  'User-Agent':    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept':        '*/*',
};

// ── GET /api/proxy/hls?url=<m3u8_url> ────────────────────────────────────
// Fetches the manifest and rewrites segment URLs to go through /api/proxy/segment
router.get('/hls', async (req, res) => {
  const { url } = req.query;
  if (!url || !isAllowed(url)) {
    return res.status(400).json({ error: 'URL not allowed' });
  }

  try {
    const upstream = await fetch(url, { headers: PROXY_HEADERS });
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: 'Upstream error' });
    }

    const text    = await upstream.text();
    const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);

    // Rewrite every non-comment line (segment URLs) to go through our proxy
    const rewritten = text
      .split('\n')
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return line;
        const absUrl = trimmed.startsWith('http') ? trimmed : baseUrl + trimmed;
        return `/api/v1/proxy/segment?url=${encodeURIComponent(absUrl)}`;
      })
      .join('\n');

    res.set('Content-Type',               'application/vnd.apple.mpegurl');
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control',              'no-cache');
    res.send(rewritten);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/proxy/segment?url=<ts_url> ──────────────────────────────────
// Streams a single .ts video segment with CORS headers
router.get('/segment', async (req, res) => {
  const { url } = req.query;
  if (!url || !isAllowed(url)) {
    return res.status(400).json({ error: 'URL not allowed' });
  }

  try {
    const upstream = await fetch(url, { headers: PROXY_HEADERS });
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: 'Upstream error' });
    }

    res.set('Content-Type',               upstream.headers.get('content-type') || 'video/mp2t');
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control',              'public, max-age=3600');

    // Stream directly — don't buffer the whole segment in memory
    const reader = upstream.body.getReader();
    const pump = async () => {
      const { done, value } = await reader.read();
      if (done) { res.end(); return; }
      res.write(value);
      return pump();
    };
    await pump();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
