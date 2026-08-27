const CACHE_NAME = '1to50-pwa-cache-v5.11';

const ASSETS_TO_CACHE = [
  'index.html',
  'style.css?v=5.11',
  'game.js?v=5.11',
  'manifest.json?v=5.00',
  'z_img_app_192.png?v=5.00',
  'z_img_app_512.png?v=5.00',
  'z_img_line.png'
];

// 安裝時，預先塞入基本快取
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

// 啟用時，清除舊的快取空間
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 【核心策略：網路優先策略 Network-First】
self.addEventListener('fetch', (event) => {
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});