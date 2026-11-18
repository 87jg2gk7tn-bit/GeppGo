/* Service worker di GeppGo: mette in cache la shell dell'app (questo file HTML)
   così che, una volta aperta almeno una volta con internet, l'app si apra
   e sia completamente usabile anche senza connessione e senza GPS (creare un
   viaggio, aggiungere attività, tutto ciò che vive nei dati locali). Le cose
   che per natura richiedono internet - ricerca dei posti, meteo, mappe,
   sincronizzazione cloud - restano non disponibili offline come è normale
   che sia, ma non impediscono al resto dell'app di funzionare.

   Le librerie esterne (mappa, cloud, lettori dei codici, codici a barre, lo
   zip del backup) si tengono da parte anche loro, in una cache a sé: hanno
   la versione esatta nell'indirizzo, quindi non invecchiano. Prima non si
   tenevano, e senza rete lo scanner, i codici a barre e la mappa non
   c'erano proprio, anche con le mattonelle della mappa gia' viste in
   memoria.

   E i pezzi delle mappe gia' guardate, ma solo quanto Esri permette (vedi
   «Le mappe senza rete», in fondo). */
const CACHE_NAME = 'geppgo-shell-v58';
const CACHE_LIBRERIE = CACHE_NAME.replace('-shell-', '-librerie-');
const SHELL_URLS = ['./', './index.html', './Index%202.1.html', './manifest.webmanifest', './icona.svg'];
/* Le stesse di LIBRERIE in Index 2.1.html: una prova controlla che restino
   uguali, perche' una libreria nuova scritta solo di la' offline mancherebbe
   senza che nessuno se ne accorga. Queste si scaricano in sottofondo dopo il
   primo avvio; quelle di LIBRERIE_AL_MOMENTO no (vedi sotto). */
const LIBRERIE = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js',
  'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js',
  'https://cdn.jsdelivr.net/npm/@zxing/library@0.23.0/umd/index.min.js',
  'https://cdn.jsdelivr.net/npm/bwip-js@4.5.1/dist/bwip-js-min.js',
  'https://cdn.jsdelivr.net/npm/fflate@0.8.2/umd/index.js'
];
/* SheetJS (i file di Excel) pesa piu' di tutte le altre insieme e serve solo
   a chi importa un viaggio: scaricarla in sottofondo sul telefono di tutti
   era mezzo megabyte sprecato per quasi tutti. Arriva la prima volta che si
   apre l'importazione e da li' resta (libreria() la tiene); qui si dice solo
   di portarla nella cache della versione nuova, come le altre, invece di
   buttarla a ogni aggiornamento. */
const LIBRERIE_AL_MOMENTO = [
  'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js',
  /* jsPDF, per il PDF dell'itinerario: 420 KB, e lo fa chi lo chiede, quando
     lo chiede. Stessa regola di SheetJS. */
  'https://cdn.jsdelivr.net/npm/jspdf@4.2.1/dist/jspdf.umd.min.js',
  /* MapLibre, per le mappe: un mega, e arriva la prima volta che a schermo
     c'e' una mappa. Chi una mappa non la guarda non lo scarica. */
  'https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.js',
  'https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.css'
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
/* I pezzi delle mappe (vedi «Le mappe senza rete»): anche questa senza la
   versione nel nome, perche' cosa ci sta dentro lo decidono le date di Esri,
   non la versione dell'app. La stessa di CACHE_MAPPE nell'HTML. */
const CACHE_MAPPE = 'geppgo-mappe';
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
       vecchie se ne vanno tutte, tranne i caratteri e le mappe, che non hanno
       la versione nel nome. */
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
    await Promise.all(keys.filter((k) => k !== CACHE_NAME && k !== CACHE_LIBRERIE && k !== CACHE_CARATTERI && k !== CACHE_MAPPE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

/* Dopo il primo avvio l'app chiede di scaricare le librerie in sottofondo,
   una alla volta: cosi' scanner, codici a barre e mappa ci sono anche senza
   rete, comprese quelle che l'app carica solo al momento. */
self.addEventListener('message', (event) => {
  if (event.data && event.data.tipo === 'librerie') event.waitUntil(scaricaLibrerie(event.data.usate).then(scaricaCaratteri));
});
/* usate: le librerie «al momento» che la pagina ha gia' caricato prima che
   questa service worker la guardasse (alla prima apertura, MapLibre per la
   mappa di Oggi). Si tengono anche quelle, ma solo se stanno nella lista:
   la pagina non puo' far scaricare qui un indirizzo qualunque. */
async function scaricaLibrerie(usate) {
  const cache = await caches.open(CACHE_LIBRERIE);
  const giaUsate = (Array.isArray(usate) ? usate : []).filter((u) => LIBRERIE_AL_MOMENTO.includes(u));
  for (const url of LIBRERIE.concat(giaUsate)) {
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

/* Il tocco su un avviso (vedi GLI AVVISI nell'app): porta GeppGo in primo
   piano nel punto giusto - il viaggio, la giornata, la tappa, la chiamata a
   raccolta. Dove andare sta nei dati della notifica (`dove`). Se l'app e'
   gia' aperta le si dice con un messaggio, e non la si ricarica; se e'
   chiusa la si apre con «#avviso=...», che lei legge all'avvio. */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(apriAvviso((event.notification && event.notification.data) || {}));
});
async function apriAvviso(dati) {
  const dove = (dati && dati.dove) || {};
  const finestre = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  // Solo la finestra dell'app: la pagina della privacy non saprebbe cosa farsene.
  const app = finestre.find((c) => /Index(%20| )2\.1\.html/.test(c.url));
  if (app) {
    try { if (app.focus) await app.focus(); } catch (e) {}
    app.postMessage({ tipo: 'avviso', dove });
    return;
  }
  const url = new URL('Index%202.1.html', self.registration.scope);
  url.hash = 'avviso=' + encodeURIComponent(JSON.stringify(dove));
  if (self.clients.openWindow) await self.clients.openWindow(url.href);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) {
    // le librerie si tengono; le API e tutto il resto vanno alla rete, come sempre
    if (eLibreria(url)) event.respondWith(libreria(req));
    else if (eCarattere(url)) event.respondWith(carattere(event));
    else if (eMappa(url)) event.respondWith(pezzoDiMappa(event));
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

/* ===== LE MAPPE SENZA RETE =====
   Le condizioni di Esri (ArcGIS Location Platform, E204 3.1 d.6 e 7.3 b)
   permettono di tenere da parte le sue mappe solo come dicono le intestazioni
   delle sue risposte (Cache-Control, Expires), quanto serve all'app per
   funzionare, e chiedono di buttarle quando l'accordo finisce. Non permettono
   di scaricarne in blocco. Quindi:
   - si tiene solo quello che la mappa ha gia' chiesto mentre la si guardava:
     niente «scarica la zona»;
   - ogni pezzo resta finche' le sue intestazioni lo dicono fresco, e dopo non
     si usa piu' (ne' con la rete ne' senza: senza rete, solo se Esri ha
     scritto stale-if-error, e per quanto ha scritto). no-store e no-cache:
     non si tiene;
   - al massimo MAPPE_MAX pezzi: oltre, se ne vanno i piu' vecchi;
   - se Esri risponde che la chiave non vale (401, 403, 498, 499: scaduta,
     revocata, o finita la soglia gratuita) si butta tutto: l'app fa lo stesso
     quando lo vede lei (chiaveRifiutata).
   Valgono le stesse regole per le mattonelle di OpenStreetMap, finche' c'e' il
   ripiego. La chiave non entra nell'indirizzo con cui il pezzo si tiene: cosi'
   non sta scritta anche qui, e una chiave rifatta ritrova i pezzi validi.
   Sopra ogni pezzo si annota quando e' arrivato, fino a quando vale e quanto
   pesa: il Profilo li conta da li' (mappeQuante). */
const MAPPE_MAX = 1500;
const ESRI_RIFIUTI = [401, 403, 498, 499];
/* Quante voci ci sono: contate una volta, poi tenute a mano a ogni pezzo
   scritto, e ricontate ogni cinquanta (la pagina puo' svuotare la cache per
   conto suo). Le scritture vanno in fila una alla volta (inFila): con tanti
   pezzi che arrivano insieme, contare e sfoltire a meta' di un'altra
   scrittura lasciava la cache sopra il tetto. */
let mappeQuante = null, mappeScritte = 0, mappeFila = Promise.resolve();
function inFila(fn) { const p = mappeFila.then(fn, fn); mappeFila = p.catch(() => {}); return p; }
/* Il primo pezzo chiesto dopo che la service worker si e' svegliata fa anche
   il giro dei pezzi che le date non permettono piu' di tenere: all'avvio
   farebbe aspettare tutto il resto. */
let mappeDaSfoltire = true;
function eEsri(url) { return url.hostname === 'arcgis.com' || url.hostname.endsWith('.arcgis.com'); }
function eMappa(url) { return eEsri(url) || url.hostname === 'tile.openstreetmap.org'; }
function chiaveMappa(indirizzo) {
  const u = new URL(indirizzo);
  u.searchParams.delete('token');
  return u.href;
}
/* Per quanto le intestazioni permettono di tenere la risposta, in ms: null se
   non lo permettono. Senza Age leggibile si conta da quando arriva. */
function permesso(r) {
  const cc = (r.headers.get('cache-control') || '').toLowerCase();
  if (/\bno-store\b|\bno-cache\b/.test(cc)) return null;
  let fresco = null;
  const ma = /\bmax-age=(\d+)/.exec(cc);
  if (ma) fresco = Number(ma[1]) - (Number(r.headers.get('age')) || 0);
  else {
    const fine = Date.parse(r.headers.get('expires') || '');
    const da = Date.parse(r.headers.get('date') || '') || Date.now();
    if (isFinite(fine)) fresco = (fine - da) / 1000;
  }
  if (!(fresco > 0)) return null;
  const se = /\bstale-if-error=(\d+)/.exec(cc);
  return { fresco: fresco * 1000, errore: se ? Number(se[1]) * 1000 : 0 };
}
function valeAncora(c, ora, ancheErrore) {
  const scade = Number(c.headers.get('x-geppgo-scade')) || 0;
  return ora < scade + (ancheErrore ? (Number(c.headers.get('x-geppgo-errore')) || 0) : 0);
}
async function pezzoDiMappa(event) {
  const req = event.request, url = new URL(req.url), chiave = chiaveMappa(req.url);
  const cache = await caches.open(CACHE_MAPPE);
  if (mappeDaSfoltire) { mappeDaSfoltire = false; event.waitUntil(inFila(() => sfoltisciMappe(true))); }
  const c = await cache.match(chiave);
  const ora = Date.now();
  if (c && valeAncora(c, ora, false)) return c;
  let r = null;
  try { r = await fetch(req); } catch (e) {}
  if (!r) return (c && valeAncora(c, ora, true)) ? c : Response.error();
  if (eEsri(url) && ESRI_RIFIUTI.includes(r.status)) { event.waitUntil(caches.delete(CACHE_MAPPE)); return r; }
  if (r.ok) event.waitUntil(tieniPezzo(cache, chiave, r.clone(), eEsri(url)));
  else if (r.status >= 500 && c && valeAncora(c, ora, true)) return c;
  return r;
}
async function tieniPezzo(cache, chiave, r, esri) {
  try {
    const p = permesso(r);
    if (!p) return;
    const corpo = await r.blob();
    /* Esri dice gli errori anche dentro una risposta «200» (lo stile): un
       errore non si tiene, e uno che dice «chiave» butta tutto. */
    if (esri && /json/.test(r.headers.get('content-type') || '') && corpo.size < 4096) {
      const t = await corpo.text();
      const m = /"error"\s*:\s*\{[^}]*"code"\s*:\s*(\d+)/.exec(t);
      if (m) { if (ESRI_RIFIUTI.includes(Number(m[1]))) await caches.delete(CACHE_MAPPE); return; }
    }
    const h = new Headers(r.headers), ora = Date.now();
    h.set('x-geppgo-salvato', String(ora));
    h.set('x-geppgo-scade', String(Math.round(ora + p.fresco)));
    if (p.errore) h.set('x-geppgo-errore', String(p.errore));
    h.set('x-geppgo-byte', String(corpo.size));
    await inFila(async () => {
      const nuovo = !(await cache.match(chiave));
      await cache.put(chiave, new Response(corpo, { status: r.status, statusText: r.statusText, headers: h }));
      if (mappeQuante === null || ++mappeScritte % 50 === 0) mappeQuante = (await cache.keys()).length;
      else if (nuovo) mappeQuante++;
      if (mappeQuante > MAPPE_MAX) await sfoltisciMappe(false);
    });
  } catch (e) {}
}
/* Oltre MAPPE_MAX se ne vanno i piu' vecchi (keys() li da' nell'ordine in
   cui sono entrati); tutti: anche quelli che non valgono piu'. */
async function sfoltisciMappe(tutti) {
  try {
    if (!(await caches.has(CACHE_MAPPE))) return;
    const cache = await caches.open(CACHE_MAPPE);
    let chiavi = await cache.keys();
    if (tutti) {
      const ora = Date.now(), restano = [];
      for (const k of chiavi) {
        const c = await cache.match(k);
        if (c && valeAncora(c, ora, true)) restano.push(k); else await cache.delete(k);
      }
      chiavi = restano;
    }
    const via = Math.max(0, chiavi.length - MAPPE_MAX);
    for (let i = 0; i < via; i++) await cache.delete(chiavi[i]);
    mappeQuante = chiavi.length - via;
  } catch (e) {}
}
