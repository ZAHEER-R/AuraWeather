/* ============================================================
   Service Worker — Background Push Notifications
   Handles all push notifications even when app is closed
   File: /public/sw.js
   ============================================================ */

const CACHE_NAME = 'aura-weather-v1';

// Install event
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(clients.claim());
});

// Push notification received
self.addEventListener('push', (event) => {
  console.log('Push event received:', event);

  const data = event.data?.json() || {};
  const notification = data.notification || {};

  const options = {
    body: notification.body || 'New notification',
    icon: notification.icon || '/icons/app.png',
    badge: notification.badge || '/icons/badge.png',
    tag: notification.tag || 'notification',
    requireInteraction: notification.requireInteraction || false,
    actions: [
      {
        action: 'open',
        title: 'Open',
        icon: '/icons/open.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icons/close.png'
      }
    ],
    data: notification.data || {}
  };

  event.waitUntil(
    self.registration.showNotification(notification.title || 'AuraWeather', options)
  );
});

// Notification click
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event.notification.tag);

  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      // Check if app is already open
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // If not open, open new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Notification close
self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event.notification.tag);
});

// Background sync for offline messages
self.addEventListener('sync', (event) => {
  console.log('Background sync event:', event.tag);

  if (event.tag === 'sync-notifications') {
    event.waitUntil(syncNotifications());
  }
});

async function syncNotifications() {
  try {
    // Sync any pending notifications from database
    const response = await fetch('/api/notifications/pending');
    const notifications = await response.json();

    for (const notif of notifications) {
      await self.registration.showNotification(notif.title, {
        body: notif.body,
        icon: notif.icon,
        tag: notif.tag,
        data: notif.data
      });
    }
  } catch (error) {
    console.error('Sync notifications error:', error);
  }
}

// Fetch event for offline support
self.addEventListener('fetch', (event) => {
  // Only cache GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return cached response if available
      if (response) {
        return response;
      }

      return fetch(event.request).then((response) => {
        // Don't cache non-successful responses
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }

        // Clone the response
        const responseToCache = response.clone();

        // Cache the response
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      }).catch(() => {
        // Return offline page if network fails
        return caches.match('/offline.html');
      });
    })
  );
});
