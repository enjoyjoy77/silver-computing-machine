// 戻れるRSVP 日本語 の service worker
// 方針: まずキャッシュから即答し、裏でネットから取り直して次回用に差し替える（stale-while-revalidate）。
// これなら index.html を更新したときに CACHE 名を変え忘れても、2回目の起動で新しい版になる。
const CACHE = 'rsvp-ja-v2';
const FILES = ['./', './index.html', './budoux-ja.min.js', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const sameOrigin = new URL(e.request.url).origin === location.origin;
  if (!sameOrigin) return; // Google Fonts などはブラウザに任せる

  e.respondWith(
    caches.open(CACHE).then(async c => {
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
