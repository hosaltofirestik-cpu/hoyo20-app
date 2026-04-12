const CACHE_NAME = 'hoyo20-ti-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/modules/invoices/invoice-module.css',
  '/modules/invoices/invoice-module.js',
  '/supabase-config.js',
  '/supabase-service.js',
  '/vendor/xlsx.full.min.js',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});