// Offline support: once a slide/video has been shown it is kept on the device,
// so screens keep playing through network or server outages.
const SHELL = 'kevcast-shell-v1';
const MEDIA = 'kevcast-media-v1';
const SHELL_FILES = ['./', 'index.html', 'player.css', 'player.js', '/shared/schedule.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/')) return; // always live

  if (url.pathname.startsWith('/media/')) {
    // Videos use Range requests; let the browser stream those directly.
    if (e.request.headers.has('range')) return;
    e.respondWith(
      caches.open(MEDIA).then(async (c) => {
        const hit = await c.match(e.request);
        if (hit) return hit;
        const res = await fetch(e.request);
        if (res.ok && res.status === 200) c.put(e.request, res.clone());
        return res;
      })
    );
    return;
  }

  // Player shell: network first, cache fallback.
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(SHELL).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
