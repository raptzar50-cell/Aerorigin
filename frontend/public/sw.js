const CACHE_NAME = 'aerogin-dev-clean';

// Install — skip waiting immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate — clean ALL caches to prevent stale Vite dev files
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

// Fetch — Always network first
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

