/* 批改台 · 服务工作线程（PWA 离线壳 + 桌面安装）
- 安装时预缓存应用壳（静态资源）
- 同源 GET 走「缓存优先，后台更新」（stale-while-revalidate）
- /api/* 与跨域请求（字典/字体）一律走网络，不缓存
*/
const CACHE = 'pigai-shell-v4';
const ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/standards.js',
  '/js/store.js',
  '/js/llm.js',
  '/js/app.js',
  '/js/daily.js',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 跨域（字典 API / 字体）放行
  if (url.pathname.startsWith('/api/')) return;      // 接口始终走网络

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
