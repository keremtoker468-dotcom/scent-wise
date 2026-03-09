const CACHE = 'sw-v6';
const SHELL = [
  '/',
  '/app.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];
// perfumes.js and perfumes-rich.js are cached on-demand when lazily loaded by app.js

// Install: cache app shell
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

// Activate: clean ALL old caches aggressively, then claim clients
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first for HTML/navigation, stale-while-revalidate for assets
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Skip non-GET and external requests
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // API calls: network only (don't cache AI responses)
  if (url.pathname.startsWith('/api/')) return;

  // HTML/navigation requests: network-first (prevents stale page shell)
  if (e.request.mode === 'navigate' || e.request.destination === 'document') {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match(e.request).then(cached => {
        // Return cached page or a proper error response
        return cached || new Response('Offline — please check your connection and reload.', {
          status: 503, statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/html' }
        });
      }))
    );
    return;
  }

  // Static assets (JS, CSS, images): stale-while-revalidate
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetched = fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => {
        // Network failed — return cached version if available,
        // otherwise return a proper error response instead of undefined
        if (cached) return cached;
        return new Response('Network error', { status: 503, statusText: 'Service Unavailable' });
      });
      return cached || fetched;
    })
  );
});
