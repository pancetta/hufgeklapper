/* The service worker: keeps the whole game in a cache so it runs offline from the home screen.
   The build puts VERSION and FILES in front of this file (see vite.config.ts). */
const CACHE = `hufgeklapper-${VERSION}`;

self.addEventListener('install', (e) => {
  // a new version takes over at once: the open page keeps its loaded code, the next start runs the new one
  // 'reload' skips the browser's HTTP cache (Pages sends max-age=600): an old index.html must never land next to new code
  // shortcut: assumes the Pages CDN serves index.html and sw.js from the same deploy
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('hufgeklapper-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.open(CACHE).then((c) => c.match(e.request, { ignoreSearch: true })).then((hit) => hit ?? fetch(e.request)));
});
