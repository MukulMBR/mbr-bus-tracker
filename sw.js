const CACHE_NAME = 'motion-hub-cache-v1';
const ASSETS = [
  '/editor',
  '/motion-hub-core.css',
  '/motion-hub-utils.js',
  '/libs/ffmpeg.min.js',
  '/libs/ffmpeg-core.js',
  '/libs/ffmpeg-core.wasm'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Allow individual asset failures (e.g. if offline or not loaded yet)
      return Promise.allSettled(
        ASSETS.map(url => cache.add(url).catch(err => console.warn(`PWA: Cache failed for ${url}:`, err)))
      );
    })
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (e) => {
  // Only intercept same-origin static requests
  if (e.request.url.startsWith(self.location.origin)) {
    e.respondWith(
      caches.match(e.request).then((cachedResponse) => {
        return cachedResponse || fetch(e.request);
      })
    );
  }
});
