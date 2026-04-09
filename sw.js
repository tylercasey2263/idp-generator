// Player IDP — Service Worker
// Cache-first for static assets, network-only for API calls

const CACHE_NAME = 'idp-v1';

// Static assets to pre-cache on install
const PRECACHE = [
  '/dashboard.html',
  '/team.html',
  '/generate.html',
  '/view-idp.html',
  '/team-plan.html',
  '/lineup.html',
  '/season.html',
  '/players.html',
  '/parent.html',
  '/users.html',
  '/settings.html',
  '/help.html',
  '/login.html',
  '/js/auth.js',
  '/js/nav.js',
  '/js/pos-picker.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-180.png',
  '/manifest.json',
];

// Domains that should always go to the network (never cache)
const NETWORK_ONLY = [
  'supabase.co',
  'supabase.com',
  'api.anthropic.com',
  'googleapis.com',
  'resend.com',
];

// ── Install: pre-cache static assets ────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: clean up old cache versions ───────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first for static, network-only for API ─────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always go to network for API calls and external services
  if (NETWORK_ONLY.some(d => url.hostname.includes(d))) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Network-only for POST/PUT/DELETE — never cache mutations
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache-first for everything else (HTML, JS, CSS, images, fonts)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        // Only cache successful responses for same-origin requests
        if (
          response.ok &&
          url.origin === self.location.origin
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback for HTML navigations
        if (event.request.destination === 'document') {
          return caches.match('/dashboard.html');
        }
      });
    })
  );
});
