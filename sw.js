const CACHE = 'ikoge-focus-v13';
const ASSETS = ['./', 'index.html', 'style.css', 'ultron.css', 'app.js', 'ultron.js', 'streaks.js', 'reading.js', 'reminders.js', 'ultrontab.js', 'ultron-kb.js', 'ultron.html', 'manifest.json', 'icon.svg', 'icon-192.png', 'icon-512.png', 'icon-512-maskable.png', 'icon-180.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // never touch Spotify / radio streams
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}); }
      return res;
    }).catch(() => caches.match(req).then(r => r || (req.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const tab = (e.notification.data && e.notification.data.tab) || '';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    if (cs.length) { if (tab) cs[0].postMessage({ type: 'ikoge-tab', tab }); return cs[0].focus(); }
    return self.clients.openWindow('./' + (tab ? '?tab=' + tab : ''));
  }));
});
