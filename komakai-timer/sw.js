// 10万分の1秒タイマー の service worker
// 役目は2つ。
// 1. ページに COOP/COEP ヘッダーを付けて「隔離されたページ」(crossOriginIsolated) にする。
//    GitHub Pages ではヘッダーを設定できないので、ここで付け足す。
//    隔離されると Chrome の performance.now() が 0.1ms きざみから 0.005ms きざみになり、小数点第5位まで本物になる。
//    Safari は隔離しても 1ms きざみのまま。
// 2. オフラインでも開けるようにする。まずキャッシュから即答し、裏でネットから取り直す（stale-while-revalidate）。
const CACHE = 'komakai-timer-v1';
const FILES = ['./timer.html'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('komakai-timer-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isolate(res) {
  if (!res || res.status === 0) return res;   // リダイレクトなど中身の見えない応答はそのまま
  const h = new Headers(res.headers);
  h.set('Cross-Origin-Opener-Policy', 'same-origin');
  h.set('Cross-Origin-Embedder-Policy', 'require-corp');
  h.set('Cross-Origin-Resource-Policy', 'same-origin');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).origin !== location.origin) return;

  e.respondWith(
    caches.open(CACHE).then(async c => {
      const hit = await c.match(e.request, { ignoreSearch: true });
      const refresh = fetch(e.request).then(res => {
        if (res && res.ok) c.put(e.request, res.clone());
        return res;
      }).catch(() => null);
      if (hit) { e.waitUntil(refresh); return isolate(hit); }
      const res = await refresh;
      return res ? isolate(res) : Response.error();
    })
  );
});
