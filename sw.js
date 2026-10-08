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
const CACHE_NAME = 'geppgo-shell-v42';
const CACHE_LIBRERIE = CACHE_NAME.replace('-shell-', '-librerie-');
const SHELL_URLS = ['./', './index.html', './Index%202.1.html', './manifest.webmanifest', './icona.svg'];
/* Le stesse di LIBRERIE in Index 2.1.html: una prova controlla che restino
   uguali, perche' una libreria nuova scritta solo di la' offline mancherebbe
   senza che nessuno se ne accorga. Queste si scaricano in sottofondo dopo il
   primo avvio; quelle di LIBRERIE_AL_MOMENTO no (vedi sotto). */
const LIBRERIE = [
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js',
  'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js',
  'https://cdn.jsdelivr.net/npm/@zxing/library@0.23.0/umd/index.min.js',
  'https://cdn.jsdelivr.net/npm/bwip-js@4.5.1/dist/bwip-js-min.js'
];
/* SheetJS (i file di Excel) pesa piu' di tutte le altre insieme e serve solo
   a chi importa un viaggio: scaricarla in sottofondo sul telefono di tutti
   era mezzo megabyte sprecato per quasi tutti. Arriva la prima volta che si
   apre l'importazione e da li' resta (libreria() la tiene); qui si dice solo
   di portarla nella cache della versione nuova, come le altre, invece di
   buttarla a ogni aggiornamento. */
const LIBRERIE_AL_MOMENTO = [
  'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js'
];
/* Quanto si aspetta la rete prima di aprire la copia. Col campo debole
   l'HTML intero vuole parecchi secondi, e prima si aspettava tutto il
   download - senza limite - prima di ripiegare sulla copia: lo schermo
   restava nero proprio quando la copia c'era. Con la rete buona la risposta
   arriva molto prima, e si vede subito l'ultima versione. */
const HTML_ATTESA_MS = 3000;
/* I caratteri di Google: il foglio (che cambia di rado) e i file (che hanno
   l'impronta nell'indirizzo, quindi non cambiano mai). Stanno in una cache
   che non ha la versione nel nome: una versione nuova dell'app non li deve
   riscaricare. L'indirizzo e' lo stesso del <link id="caratteri">
   nell'HTML: una prova li confronta. */
const CACHE_CARATTERI = 'geppgo-caratteri';
const CARATTERI_CSS = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap';

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
      for (const url of LIBRERIE.concat(LIBRERIE_AL_MOMENTO)) {
        if (await nuova.match(url)) continue;
        const r = await vecchia.match(url);
        if (r) await nuova.put(url, r);
      }
    }
    await Promise.all(keys.filter((k) => k !== CACHE_NAME && k !== CACHE_LIBRERIE && k !== CACHE_CARATTERI).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

/* Dopo il primo avvio l'app chiede di scaricare le librerie in sottofondo,
   una alla volta: cosi' scanner, codici a barre e mappa ci sono anche senza
   rete, comprese quelle che l'app carica solo al momento. */
self.addEventListener('message', (event) => {
  if (event.data && event.data.tipo === 'librerie') event.waitUntil(scaricaLibrerie().then(scaricaCaratteri));
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
/* I caratteri si tengono gia' quando la pagina li chiede (vedi carattere()),
   ma alla primissima apertura la service worker non c'era ancora: qui si
   prendono il foglio e i file dell'alfabeto latino, che coprono tutte e
   cinque le lingue dell'app. Gli altri alfabeti arrivano se servono. */
async function scaricaCaratteri() {
  try {
    const cache = await caches.open(CACHE_CARATTERI);
    let foglio = await cache.match(CARATTERI_CSS);
    if (!foglio) {
      const r = await fetch(CARATTERI_CSS, { mode: 'cors', credentials: 'omit' });
      if (!r || !r.ok) return;
      await cache.put(CARATTERI_CSS, r.clone());
      foglio = r;
    }
    const testo = await foglio.text();
    // Google mette l'alfabeto in un commento prima di ogni @font-face.
    for (const [, alfabeto, blocco] of testo.matchAll(/(?:\/\*\s*([\w-]+)\s*\*\/\s*)?@font-face\s*\{([^}]*)\}/g)) {
      if (/cyrillic|greek|vietnamese/.test(alfabeto || '')) continue;
      const m = /url\((https:\/\/fonts\.gstatic\.com\/[^)\s]+)\)/.exec(blocco);
      if (!m || await cache.match(m[1])) continue;
      try {
        const f = await fetch(m[1], { mode: 'cors', credentials: 'omit' });
        if (f && f.ok) await cache.put(m[1], f);
      } catch (e) {}
    }
  } catch (e) {}
}
function eCarattere(url) {
  return url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
}
/* Il foglio si da' dalla copia, subito (anche senza rete), e intanto si
   rinnova; un file si da' dalla copia e basta. Chiesti con CORS come le
   librerie: una risposta opaca non si puo' controllare. */
async function carattere(event) {
  const req = event.request;
  const cache = await caches.open(CACHE_CARATTERI);
  const c = await cache.match(req.url);
  const foglio = new URL(req.url).hostname === 'fonts.googleapis.com';
  if (c && !foglio) return c;
  const rete = fetch(req.url, { mode: 'cors', credentials: 'omit' }).then((r) => {
    if (r && r.ok) return cache.put(req.url, r.clone()).then(() => r, () => r);
    return r;
  }).catch(() => null);
  if (c) { event.waitUntil(rete); return c; }
  return (await rete) || Response.error();
}
/* Una libreria e' un indirizzo di unpkg o jsDelivr con la versione esatta
   (o di SheetJS, che la scrive a modo suo: /xlsx-0.20.3/): quello non cambia
   mai, quindi si risponde dalla cache e, se non c'e', la si prende e la si
   tiene (anche una caricata al momento che non sta nella lista, come il
   lettore dei PDF). */
function eLibreria(url) {
  if (url.hostname === 'cdn.sheetjs.com') return /^\/xlsx-\d+\.\d+\.\d+\//.test(url.pathname);
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
    else if (eCarattere(url)) event.respondWith(carattere(event));
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
