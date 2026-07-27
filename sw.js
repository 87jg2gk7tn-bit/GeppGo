/* Service worker di GeppGo: mette in cache la shell dell'app (questo file HTML)
   così che, una volta aperta almeno una volta con internet, l'app si apra
   e sia completamente usabile anche senza connessione e senza GPS (creare un
   viaggio, aggiungere attività, tutto ciò che vive nei dati locali). Le cose
   che per natura richiedono internet - ricerca dei posti, meteo, mappe,
   sincronizzazione cloud - restano non disponibili offline come è normale
   che sia, ma non impediscono al resto dell'app di funzionare.

   Le librerie esterne (mappa, scanner, drag&drop) non vengono messe in
   cache qui: senza rete non servirebbero comunque a molto (es. la mappa
   avrebbe comunque bisogno delle tile, che non si possono precaricare tutte),
   e il codice dell'app già degrada con calma quando mancano. */
const CACHE_NAME = 'geppgo-shell-v1';
const SHELL_URLS = ['./', './index.html', './Index%202.1.html'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(SHELL_URLS.map(async (url) => {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (res && res.ok) await cache.put(url, res.clone());
      } catch (e) {}
    }));
  })());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // solo la shell dell'app, non le API/librerie esterne

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);
    const fetchPromise = fetch(req).then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    if (cached) { fetchPromise; return cached; } // rispondi subito dalla cache, aggiornala in background
    const fresh = await fetchPromise;
    if (fresh) return fresh;
    if (req.mode === 'navigate') {
      const fallback = await cache.match('./Index%202.1.html');
      if (fallback) return fallback;
    }
    return new Response('Offline e nessuna copia salvata di questa risorsa.', { status: 503, statusText: 'Offline' });
  })());
});
