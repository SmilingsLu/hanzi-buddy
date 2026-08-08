const CACHE_VERSION = 'hanzigo-v22';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './config.json',
  './css/style.css',
  './js/constants.js',
  './js/state.js',
  './js/data.js',
  './js/services.js',
  './js/ui.js',
  './js/controllers.js',
  './js/daily-task.js',
  './js/mobile.js',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

// Data files to cache (all grade/semester JSON)
const DATA_ASSETS = [];
for (let g = 1; g <= 9; g++) {
  for (let s = 1; s <= 2; s++) {
    DATA_ASSETS.push(`./data/grade${g}-semester${s}.json`);
  }
}

const ALL_ASSETS = [...STATIC_ASSETS, ...DATA_ASSETS];

// Install: pre-cache all static assets and data
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(ALL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: cache-first for static assets, network-first for API/TTS
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Network-only for TTS (Baidu) — don't cache audio
  if (url.hostname.includes('baidu.com') || url.pathname === '/tts') {
    return;
  }

  // Cache-first strategy for same-origin assets
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        // Not in cache — fetch from network and cache it
        return fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
          }
          return response;
        });
      }).catch(() => {
        // Offline fallback — return index.html for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      })
    );
  }
});
