// Service Worker para suporte a PWA e instalação mobile do Teltech Ledger
const CACHE_NAME = 'teltech-shell-v2';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.png',
  '/favicon-32x32.png',
  '/favicon-16x16.png',
  '/favicon.svg',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Falha parcial no pre-cache do service worker:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Aceitar apenas requisições GET
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // PRIVACIDADE & SEGURANÇA: Nunca cachear chamadas de API autenticadas ou uploads confidenciais
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/uploads')) {
    return;
  }

  // Requisições de navegação (HTML principal do shell)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) return cachedResponse;
          const fallback = await caches.match('/');
          if (fallback) return fallback;
          return new Response(
            '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline - Teltech Ledger</title><style>body{background:#111113;color:#fafafa;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;padding:20px;text-align:center;}</style></head><body><div><h2>Sem conexão com a internet</h2><p style="color:#888;">Verifique sua rede para continuar usando o Teltech Ledger.</p></div></body></html>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        })
    );
    return;
  }

  // Assets estáticos (CSS, JS, imagens, fontes)
  if (
    url.origin === self.location.origin &&
    (url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|webp|woff2?|ico)$/) ||
     STATIC_ASSETS.includes(url.pathname))
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
          }
          return networkResponse;
        });
      })
    );
  }
});

// ============================================================================
// Web Push Notifications (Suporte nativo no iPhone / iOS PWA e Android / Web)
// ============================================================================
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch (err) {
    payload = {
      title: 'Teltech Ledger · Nexus',
      body: event.data.text() || 'Nova mensagem recebida',
    };
  }

  const title = payload.title || 'Teltech Ledger';
  let iconUrl = payload.icon || '/apple-touch-icon.png';
  if (typeof iconUrl === 'string' && iconUrl.startsWith('/')) {
    iconUrl = self.location.origin + iconUrl;
  }
  let badgeUrl = payload.badge || '/favicon-32x32.png';
  if (typeof badgeUrl === 'string' && badgeUrl.startsWith('/')) {
    badgeUrl = self.location.origin + badgeUrl;
  }

  const options = {
    body: payload.body || 'Nova notificação no sistema',
    icon: iconUrl,
    badge: badgeUrl,
    tag: payload.tag || 'teltech-notification',
    data: payload.data || { url: '/monitoramento' },
    renotify: true,
    vibrate: [100, 50, 100],
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || '/monitoramento';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Se houver uma janela aberta do app, focar nela e navegar até a URL
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if ('navigate' in client) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // Se não houver janela aberta, abrir uma nova
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

