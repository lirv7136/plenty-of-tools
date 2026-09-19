/* Plenty of Tools service worker.
   Deliberately minimal: it exists so the site is installable and shows a friendly page when
   offline. It never caches tool pages or assets, because several tools ship workers and wasm
   that must always match the current deploy. Other caches (for example the transcription
   model cache) belong to the tools and are left alone. */
const CACHE = 'pot-offline-v2';
const OFFLINE = '/offline'; // Pages serves offline.html here without a redirect; redirected responses cannot be used for navigations

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.add(new Request(OFFLINE, { cache: 'reload' }))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('pot-offline-') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.mode !== 'navigate') return; // everything else goes straight to the network, untouched
  event.respondWith(fetch(event.request).catch(async () => (await caches.match(OFFLINE)) || new Response('You are offline.', { status: 503, headers: { 'Content-Type': 'text/plain' } })));
});
