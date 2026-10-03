// てのひらピアノ の service worker
// 画面（HTML・JS・アイコン）はキャッシュから即答し、裏でネットから取り直す（stale-while-revalidate）。
// 音源（samples/）はページ側が専用のキャッシュに入れていく。ここでは同じキャッシュから先に探すだけ。
const SHELL = 'tenohira-piano-shell-v1';
const SAMPLES = 'tenohira-piano-samples-v1';
const FILES = ['./', './index.html', './piano-core.js', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('tenohira-piano-shell-') && k !== SHELL).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  if (url.pathname.includes('/samples/')) {
    e.respondWith(
      caches.open(SAMPLES).then(async c => {
        const hit = await c.match(e.request, { ignoreSearch: true });
        if (hit) return hit;
        const res = await fetch(e.request);
        if (res && res.ok) c.put(e.request, res.clone()).catch(() => {});
        return res;
      })
    );
    return;
  }

  e.respondWith(
    caches.open(SHELL).then(async c => {
      const hit = await c.match(e.request, { ignoreSearch: true });
      const refresh = fetch(e.request).then(res => {
        if (res && res.ok) c.put(e.request, res.clone());
        return res;
      }).catch(() => null);
      if (hit) { e.waitUntil(refresh); return hit; }
      const res = await refresh;
      if (res) return res;
      if (e.request.mode === 'navigate') return c.match('./index.html');
      return Response.error();
    })
  );
});
