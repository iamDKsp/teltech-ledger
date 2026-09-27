// Service Worker para suporte a PWA e instalacao mobile do Teltech Ledger
const CACHE_NAME = 'teltech-ledger-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Apenas responde requisicoes GET normais com network-first
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
