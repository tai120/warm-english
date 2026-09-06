/* ============================================================
   离线缓存（Service Worker）
   界面文件缓存优先；课程内容优先取最新（方便补充新课）
   ============================================================ */
const CACHE = 'warm-english-v8'; /* 改代码后记得把版本号 +1，用户刷新就能拿到新版 */
const SHELL = [
  './',
  './index.html',
  './css/style.css',
  './js/storage.js',
  './js/srs.js',
  './js/tts.js',
  './js/recorder.js',
  './js/app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  if (url.pathname.includes('/data/')) {
    // 课程内容：网络优先，取不到再用缓存（离线时也能学已下载的课）
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
  } else {
    // 界面文件：缓存优先，没缓存再走网络
    e.respondWith(
      caches.match(e.request).then(hit =>
        hit || fetch(e.request).then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
          return res;
        })
      )
    );
  }
});
