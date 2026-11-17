/* TundraVolt service worker: app shell cache + push notifications + icon badge.
   It never stores readings or logins — those always come live from Supabase. */
const CACHE = 'tundravolt-v1';
const SHELL = ['/', '/index.html', '/manifest.json',
  '/icons/icon-192.png', '/icons/icon-512.png', '/icons/badge-96.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Network first (so updates arrive right away), cache only as offline fallback.
// Only our own files are handled; Supabase requests go straight to the network.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request).then(r => r || caches.match('/index.html')))
  );
});

// New bill push from the Supabase Edge Function
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  const title = d.title || '⚡ TundraVolt';
  const opts = {
    body: d.body || 'You have a new electric bill.',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    tag: d.tag || 'tundravolt-bill',
    renotify: true,
    vibrate: [120, 60, 120],
    data: { url: d.url || '/' }
  };
  const count = Number(d.badge || 1);
  e.waitUntil(Promise.all([
    self.registration.showNotification(title, opts),
    (self.navigator && 'setAppBadge' in self.navigator) ? self.navigator.setAppBadge(count).catch(() => {}) : Promise.resolve()
  ]));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { if ('focus' in c) { c.navigate(target).catch(() => {}); return c.focus(); } }
    return self.clients.openWindow(target);
  }));
});
