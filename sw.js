// sw.js — Service Worker (E-02: ネットワークファースト戦略に変更)

const CACHE_NAME = 'kintai-cache-v6';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/app.js',
  './js/ui.js',
  './js/storage.js',
  './js/home.js',
  './js/calendar.js',
  './js/settings.js',
  './js/attendance.js',
  './js/holidays.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// インストール: 静的アセットをキャッシュ
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// アクティベート: 古いキャッシュを削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// フェッチ: ネットワークファースト → オフライン時のみキャッシュ
self.addEventListener('fetch', (event) => {
  // Google Fonts: キャッシュファーストで高速表示
  if (
    event.request.url.includes('fonts.googleapis.com') ||
    event.request.url.includes('fonts.gstatic.com')
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        caches.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((response) => {
            cache.put(event.request, response.clone());
            return response;
          });
        })
      )
    );
    return;
  }

  // 静的アセット: ネットワークファースト（更新を確実に反映）
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // レスポンスをキャッシュに保存
        if (response.ok) {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
        }
        return response;
      })
      .catch(() => {
        // オフライン時はキャッシュにフォールバック
        return caches.match(event.request);
      })
  );
});
