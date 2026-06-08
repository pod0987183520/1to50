// 🌟 升級版本號至 v3，讓手機得知設定已變更
const CACHE_NAME = '1to50-pwa-cache-v4.01';

// 🌟 變更：將快取清單更新為你全新的圖片名稱
const ASSETS_TO_CACHE = [
  'index.html',
  'style.css',
  'game.js',
  'manifest.json',
  'z_img_app_192.png',
  'z_img_app_512.png',
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