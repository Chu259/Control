// Progressive Web App Service Worker for depos
// Supports background push notifications, offline caching lifecycle, and notification clicks

const CACHE_NAME = 'depos-v1';

self.addEventListener('install', (event) => {
  // Activate worker immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Claim clients so the service worker controls active pages immediately
  event.waitUntil(self.clients.claim());
});

// Native Web Push event handler
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { title: 'depos', body: event.data.text() };
    }
  }

  const title = data.title || '⚠️ Alerta de Inventario';
  const options = {
    body: data.body || 'Se ha detectado una actualización en el stock de productos.',
    icon: data.icon || '/assets/icon-192.png',
    badge: data.badge || '/assets/icon-192.png',
    vibrate: [200, 100, 200],
    tag: data.tag || `stock-alert-${Date.now()}`,
    renotify: true,
    data: {
      url: data.url || '/',
      timestamp: Date.now(),
      ...data.data,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle clicking on the notification (focus the open app or open the window)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
