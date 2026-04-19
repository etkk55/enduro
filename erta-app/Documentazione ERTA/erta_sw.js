// ERTA - Service Worker v13.0 (upload PDF per tutti i tipi)
const CACHE_NAME = 'erta-cache-v13';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json'
];

// Install - cache files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('ERTA: Cache aperta');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate - clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('ERTA: Rimuovo vecchia cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch - network first, fallback to cache
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip API calls (always fetch from network)
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Clone response for cache
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        // Fallback to cache
        return caches.match(event.request);
      })
  );
});

// Handle push notifications (for future use)
self.addEventListener('push', event => {
  const options = {
    body: event.data ? event.data.text() : 'Nuovo comunicato dalla Direzione Gara',
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%231a1a2e" width="100" height="100" rx="20"/><text x="50" y="65" font-size="50" text-anchor="middle" fill="%23e94560">🏍️</text></svg>',
    badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle fill="%23e94560" cx="50" cy="50" r="40"/></svg>',
    vibrate: [200, 100, 200],
    tag: 'erta-notification'
  };

  event.waitUntil(
    self.registration.showNotification('ERTA - Comunicato', options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('./')
  );
});
