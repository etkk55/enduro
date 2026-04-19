// ERTA Service Worker - Push Notifications
// Chat 25 - nw25-01

const CACHE_NAME = 'erta-v1';

// Installazione Service Worker
self.addEventListener('install', (event) => {
  console.log('📲 ERTA SW installato');
  self.skipWaiting();
});

// Attivazione
self.addEventListener('activate', (event) => {
  console.log('✅ ERTA SW attivato');
  event.waitUntil(clients.claim());
});

// Ricezione Push Notification
self.addEventListener('push', (event) => {
  console.log('🔔 Push ricevuto');
  
  let data = { title: 'ERTA', body: 'Nuovo messaggio', url: '/' };
  
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    console.log('Push data parse error:', e);
  }
  
  const options = {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [300, 100, 300, 100, 300],
    tag: 'erta-notification-' + Date.now(),
    renotify: true,
    requireInteraction: true,
    silent: false,
    data: {
      url: data.url || '/'
    }
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Click sulla notifica - apre l'app
self.addEventListener('notificationclick', (event) => {
  console.log('👆 Notifica cliccata');
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Se ERTA e' gia' aperta, focus su quella finestra
      for (const client of clientList) {
        if ('focus' in client && client.url.startsWith(self.registration.scope)) {
          return client.focus();
        }
      }
      // Altrimenti apri nuova finestra sulla home (agnostico al dominio)
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen || self.registration.scope);
      }
    })
  );
});

// Chiusura notifica senza click
self.addEventListener('notificationclose', (event) => {
  console.log('❌ Notifica chiusa');
});
