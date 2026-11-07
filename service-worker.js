const CACHE = 'acta-pwa-v28';
const APP_SHELL = [
  '/', '/index.html', '/styles.css', '/config.js', '/app.js',
  '/manifest.webmanifest', '/assets/icon.svg', '/assets/icon-192.png',
  '/assets/icon-512.png', '/assets/campus-banner.jpg'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(async cache => { await Promise.all(APP_SHELL.map(async path => { try { const response = await fetch(path, {cache:'reload'}); if (response.ok) await cache.put(path, response); } catch {} })); }));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET') return;
  const isSupabaseCdn = url.href.startsWith('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2') || url.href.startsWith('https://unpkg.com/@supabase/supabase-js@2');
  if (isSupabaseCdn) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      try { const response = await fetch(request); if (response.ok) { const copy=response.clone(); caches.open(CACHE).then(cache=>cache.put(request,copy)); } return response; }
      catch { return (await caches.match(request)) || Response.error(); }
    })());
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        if (fresh.ok) {
          const copy = fresh.clone();
          caches.open(CACHE).then(cache => cache.put('/index.html', copy));
        }
        return fresh;
      } catch {
        return (await caches.match('/index.html')) || Response.error();
      }
    })());
    return;
  }
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && APP_SHELL.includes(url.pathname)) {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(request, copy));
      }
      return response;
    } catch {
      return Response.error();
    }
  })());
});


// Push reminders are delivered by the ACTA Supabase Edge Function.
self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = { title: 'ACTA reminder', body: event.data?.text() || 'You have an upcoming school event.' }; }
  const title = payload.title || 'ACTA event reminder';
  const options = { body: payload.body || 'A school event is coming up.', icon: payload.icon || '/assets/icon-192.png', badge: payload.badge || '/assets/icon-192.png', tag: payload.tag || 'acta-event-reminder', data: { url: payload.url || '/?page=calendar' }, renotify: false };
  event.waitUntil(self.registration.showNotification(title, options));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const client of list) if (client.url.startsWith(self.location.origin) && 'focus' in client) return client.focus();
    return clients.openWindow(target);
  }));
});
