/* Service worker di GeppGo: mette in cache la shell dell'app (questo file HTML)
   così che, una volta aperta almeno una volta con internet, l'app si apra
   e sia completamente usabile anche senza connessione e senza GPS (creare un
   viaggio, aggiungere attività, tutto ciò che vive nei dati locali). Le cose
   che per natura richiedono internet - ricerca dei posti, meteo, mappe,
   sincronizzazione cloud - restano non disponibili offline come è normale
   che sia, ma non impediscono al resto dell'app di funzionare.

   Le librerie esterne (mappa, cloud, lettori dei codici, codici a barre) si
   tengono da parte anche loro, in una cache a sé: hanno la versione esatta
   nell'indirizzo, quindi non invecchiano. Prima non si tenevano, e senza rete
   lo scanner, i codici a barre e la mappa non c'erano proprio, anche con le
   mattonelle della mappa gia' viste in memoria. */
const CACHE_NAME = 'geppgo-shell-v38';
const CACHE_LIBRERIE = CACHE_NAME.replace('-shell-', '-librerie-');
const SHELL_URLS = ['./', './index.html', './Index%202.1.html', './manifest.webmanifest', './icona.svg'];
/* Le stesse di LIBRERIE in Index 2.1.html: una prova controlla che restino
   uguali, perche' una libreria nuova scritta solo di la' offline mancherebbe
   senza che nessuno se ne accorga. */
const LIBRERIE = [
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js',
  'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js',
  'https://cdn.jsdelivr.net/npm/@zxing/library@0.23.0/umd/index.min.js',
  'https://cdn.jsdelivr.net/npm/bwip-js@4.5.1/dist/bwip-js-min.js'
];
/* Quanto si aspetta la rete prima di aprire la copia. Col campo debole
   l'HTML intero vuole parecchi secondi, e prima si aspettava tutto il
   download - senza limite - prima di ripiegare sulla copia: lo schermo
   restava nero proprio quando la copia c'era. Con la rete buona la risposta
   arriva molto prima, e si vede subito l'ultima versione. */
const HTML_ATTESA_MS = 3000;

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
    /* Le librerie che la versione nuova usa ancora passano nella cache nuova
       senza riscaricarle (col campo debole sono mezzo megabyte); poi le cache
       vecchie se ne vanno tutte. */
    const nuova = await caches.open(CACHE_LIBRERIE);
    for (const k of keys) {
      if (k === CACHE_LIBRERIE || !k.startsWith('geppgo-librerie-')) continue;
      const vecchia = await caches.open(k);
      for (const url of LIBRERIE) {
        if (await nuova.match(url)) continue;
        const r = await vecchia.match(url);
        if (r) await nuova.put(url, r);
      }
    }
    await Promise.all(keys.filter((k) => k !== CACHE_NAME && k !== CACHE_LIBRERIE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

/* Dopo il primo avvio l'app chiede di scaricare le librerie in sottofondo,
   una alla volta: cosi' scanner, codici a barre e mappa ci sono anche senza
   rete, comprese quelle che l'app carica solo al momento. */
self.addEventListener('message', (event) => {
  if (event.data && event.data.tipo === 'librerie') event.waitUntil(scaricaLibrerie());
});
async function scaricaLibrerie() {
  const cache = await caches.open(CACHE_LIBRERIE);
  for (const url of LIBRERIE) {
    if (await cache.match(url)) continue;
    try {
      const r = await fetch(url, { mode: 'cors', credentials: 'omit' });
      if (r && r.ok) await cache.put(url, r);
    } catch (e) {}
  }
}
/* Una libreria e' un indirizzo di unpkg o jsDelivr con la versione esatta:
   quello non cambia mai, quindi si risponde dalla cache e, se non c'e', la si
   prende e la si tiene (anche una caricata al momento che non sta nella
   lista, come il lettore dei PDF). */
function eLibreria(url) {
  return (url.hostname === 'unpkg.com' || url.hostname === 'cdn.jsdelivr.net') && /@\d+\.\d+\.\d+\//.test(url.pathname);
}
async function libreria(req) {
  const cache = await caches.open(CACHE_LIBRERIE);
  const c = await cache.match(req.url);
  if (c) return c;
  /* Chiesta con CORS anche se la pagina non l'ha fatto: una risposta opaca
     non si puo' controllare, e in cache peserebbe come sette mega. */
  let r = null;
  try { r = await fetch(req.url, { mode: 'cors', credentials: 'omit' }); } catch (e) {}
  if (r && r.ok) { cache.put(req.url, r.clone()).catch(() => {}); return r; }
  return fetch(req);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) {
    // le librerie si tengono; le API e tutto il resto vanno alla rete, come sempre
    if (eLibreria(url)) event.respondWith(libreria(req));
    return;
  }

  // L'HTML dell'app (la "shell") va preso dalla rete quando c'è, altrimenti
  // resteresti indietro di un deploy: la vecchia strategia rispondeva sempre
  // dalla cache e aggiornava solo in background, quindi ogni apertura mostrava
  // la build precedente. La cache resta come copia di riserva per l'offline.
  const isShell = req.mode === 'navigate' || /\.html$/i.test(url.pathname) || url.pathname === '/';

  if (isShell) {
    let salva = Promise.resolve();
    const rete = (async () => {
      const cache = await caches.open(CACHE_NAME);
      const r = await fetch(req, { cache: 'no-store' });
      if (r && r.ok) salva = cache.put(req, r.clone()).catch(() => {});
      return r;
    })();
    // La risposta di rete, anche se arriva dopo la copia, la sostituisce:
    // l'apertura dopo e' gia' l'ultima versione.
    event.waitUntil(rete.then(() => salva, () => {}));
    event.respondWith((async () => {
      const tardi = new Promise((ok) => setTimeout(() => ok('tardi'), HTML_ATTESA_MS));
      const prima = await Promise.race([rete.catch(() => null), tardi]);
      if (prima && prima !== 'tardi' && prima.ok) return prima;
      const cache = await caches.open(CACHE_NAME);
      const copia = (await cache.match(req)) || (await cache.match('./Index%202.1.html'));
      if (copia) return copia;
      // Nessuna copia (la primissima apertura): si aspetta la rete, quanto ci mette.
      if (prima && prima !== 'tardi') return prima;
      try { const r = await rete; if (r) return r; } catch (e) {}
      return new Response('Offline e nessuna copia salvata di questa risorsa.', { status: 503, statusText: 'Offline' });
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Tutto il resto (icone, manifest, ...) resta cache-first: cambia di rado.
    const cached = await cache.match(req);
    const fetchPromise = fetch(req).then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    if (cached) { fetchPromise; return cached; }
    const fresh = await fetchPromise;
    if (fresh) return fresh;
    return new Response('Offline e nessuna copia salvata di questa risorsa.', { status: 503, statusText: 'Offline' });
  })());
});
