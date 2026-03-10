// ── VR App – Konduktööri · Service Worker ──
const CACHE_NAME = 'vr-app-cache-v1';

const APP_SHELL = [
  './index.html',
  './logo.png',
  './manifest.json',
  './sounds/beep.mp3',
  './sounds/huom.mp3',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// ── INSTALL: cache app shell ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(APP_SHELL);
    })
  );
  // Activate immediately without waiting for old SW to stop
  self.skipWaiting();
});

// ── ACTIVATE: remove old caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  // Take control of all open clients immediately
  self.clients.claim();
});

// ── FETCH: cache-first for app shell, network-first for API calls ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always go to network for external APIs (Firebase, digitraffic, etc.)
  const isExternal =
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('firestore') ||
    url.hostname.includes('digitraffic') ||
    url.hostname.includes('venaarauhassa') ||
    url.hostname.includes('unpkg') ||
    url.hostname.includes('gstatic') ||
    url.hostname.includes('openstreetmap');

  if (isExternal) {
    // Network only for external resources — no caching
    event.respondWith(fetch(event.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // Cache-first for app shell assets
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      // Not in cache — fetch from network and cache it
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const toCache = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
        return response;
      }).catch(() => {
        // Offline fallback: return cached index.html for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return new Response('', { status: 503 });
      });
    })
  );
});
