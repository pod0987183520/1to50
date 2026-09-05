const CACHE_NAME = '1to50-pwa-cache-v7.06';

const ASSETS_TO_CACHE = [
  'index.html',
  'style.css?v=7.06',
  'game.js?v=7.06',
  'manifest.json?v=7.06',
  'z_img_app_192.png?v=7.06',
  'z_img_app_512.png?v=7.06',
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

// 【核心策略：網路優先策略 Network-First，嚴格排除後端 API】
self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  
  // 嚴格排除 Google Apps Script API 與外部跨域請求，絕不攔截或重發
  if (url.includes('script.google.com') || 
      url.includes('googleusercontent.com') || 
      url.includes('googleapis.com') ||
      !url.startsWith(self.location.origin)) {
    return; // 直接交由瀏覽器原生網路處理
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
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