/**
 * Service Worker — HanziGo PWA offline support
 * Strategy: Stale-while-revalidate (instant load, silent background update)
 *
 * To trigger update: bump CACHE_VERSION below and push.
 */
const CACHE_VERSION = 'hanzigo-v1';

const CORE_FILES = [
  './',
  './index.html',
  './css/style.css',
  './js/constants.js',
  './js/state.js',
  './js/data.js',
  './js/services.js',
  './js/ui.js',
  './js/controllers.js',
  './config.json',
  './manifest.json'
];

// Data files (auto-generated list)
const DATA_FILES = [];
for (let g = 1; g <= 9; g++) {
  for (let s = 1; s <= 2; s++) {
    DATA_FILES.push(`./data/grade${g}-semester${s}.json`);
  }
}

const ALL_FILES = [...CORE_FILES, ...DATA_FILES];

// Install: cache all files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(ALL_FILES))
      .then(() => self.skipWaiting()) // Activate immediately
  );
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    ).then(() => self.clients.claim()) // Take control immediately
  );
});

// Fetch: stale-while-revalidate
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and external URLs (like Google TTS)
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      // Return cached immediately, then update cache in background
      const fetchPromise = fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached); // If network fails, use cache

      return cached || fetchPromise;
    })
  );
});
