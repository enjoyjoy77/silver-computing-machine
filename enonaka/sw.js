// えのなか の service worker
// 画面（HTML・JS・アイコン）はキャッシュから即答し、裏でネットから取り直す（stale-while-revalidate）。
// お試しのキャラ（models/、6.7MB）と場面の絵（bg/）は別のキャッシュに入れ、一度取ったら取り直さない。
const SHELL = 'enonaka-shell-v2';
const MEDIA = 'enonaka-media-v1';
const FILES = ['./', './index.html', './stage-core.js', './sample-scene.js', './presets.js', './lib/three-vrm-bundle.min.js',
  './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('enonaka-shell-') && k !== SHELL).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  if (url.pathname.includes('/models/') || url.pathname.includes('/bg/')) {
    e.respondWith(
      caches.open(MEDIA).then(async c => {
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
