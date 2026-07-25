/* WatchParty service worker — minimal, enables PWA install + basic app-shell cache. */
const CACHE = 'watchparty-shell-v3';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Only handle GET navigations/assets on our own origin; never touch API/socket calls.
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  // Never intercept API or realtime traffic — let those hit the network directly.
  const { pathname } = new URL(request.url);
  if (pathname.startsWith('/api') || pathname.startsWith('/socket.io')) return;

  // Network-first for navigations so users always get the latest app; fall back to cached shell offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
  }
  // Every other GET request (JS/CSS/images/etc.) is left untouched -- no
  // event.respondWith() means the browser's normal network fetch runs as if
  // there were no service worker at all. The caching benefit still comes
  // from nginx's Cache-Control headers (immutable for hashed assets), so
  // there's no need for bespoke cache-matching logic here that can throw an
  // uncaught rejection (and a hard network-error response) on any transient
  // network hiccup -- which is exactly what was happening before.
});
