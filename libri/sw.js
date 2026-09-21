/* Service worker di «libri».

   Sta dentro la cartella libri/ e non alla radice del sito: il suo raggio
   d'azione è /libri/ e basta. Alla radice ci sta già quello di GeppGo, e due
   service worker che si contendono lo stesso indirizzo si sovrascrivono a
   vicenda — l'ultimo che si registra vince, e l'altra app resta senza.

   Qui si mette da parte la conchiglia dell'app (l'HTML, il manifesto,
   l'icona) e le due librerie che leggono gli EPUB. Le librerie arrivano da
   una CDN: senza di loro, aperta l'app in aereo, non si potrebbe nemmeno
   aprire un libro già importato. Tutto il resto — i libri, l'audio già
   generato — vive in IndexedDB e non passa di qui.

   Quello che NON si mette in cache è api.elevenlabs.io: le risposte costano
   soldi a carattere e finiscono già in IndexedDB, dove sappiamo dirle per
   capitolo e per voce. Una seconda copia qui sarebbe solo spazio buttato. */
const NOME_CACHE = 'libri-conchiglia-v1';

const CONCHIGLIA = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icona.svg'
];

/* Le librerie esterne, con la versione fissata. Fissarla non è pignoleria:
   se un giorno la CDN servisse una versione diversa, l'app si aprirebbe
   comunque e sbaglierebbe a leggere gli EPUB, che è il guasto peggiore —
   quello che sembra un problema del libro. */
const LIBRERIE = [
  'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
  'https://cdn.jsdelivr.net/npm/epubjs@0.3.93/dist/epub.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(NOME_CACHE);
    await Promise.all(CONCHIGLIA.concat(LIBRERIE).map(async (url) => {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (res && res.ok) await cache.put(url, res.clone());
      } catch (e) {
        /* Se una non si scarica non si butta via tutta l'installazione:
           l'app resta usabile e quella risorsa si prenderà al primo giro
           con la rete. */
      }
    }));
  })());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const chiavi = await caches.keys();
    await Promise.all(chiavi.filter(k => k.startsWith('libri-') && k !== NOME_CACHE)
                            .map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // L'API della voce non passa mai di qui: niente cache, niente intromissioni.
  if (/elevenlabs\.io$/.test(url.hostname)) return;

  const eLibreria = LIBRERIE.some(l => req.url.startsWith(l.split('?')[0]));
  const eNostra = url.origin === self.location.origin;
  if (!eLibreria && !eNostra) return;

  /* L'HTML dell'app si prende dalla rete quando c'è. Con la cache per prima
     si resterebbe indietro di una pubblicazione a ogni apertura, e il guaio
     è che non si nota: l'app funziona, solo che è quella di ieri. La copia
     salvata resta come riserva per quando la rete non c'è. */
  const eConchiglia = req.mode === 'navigate' || /\.html$/i.test(url.pathname) ||
                      url.pathname.endsWith('/libri/') || url.pathname.endsWith('/libri');

  event.respondWith((async () => {
    const cache = await caches.open(NOME_CACHE);

    if (eConchiglia) {
      try {
        const fresca = await fetch(req, { cache: 'no-store' });
        if (fresca && fresca.ok) { cache.put(req, fresca.clone()); return fresca; }
      } catch (e) {}
      const salvata = await cache.match(req) || await cache.match('./index.html');
      if (salvata) return salvata;
      return new Response('Offline, e di questa pagina non c’è una copia salvata.',
                          { status: 503, statusText: 'Offline' });
    }

    // Librerie, icona, manifesto: cambiano di rado, prima la copia salvata.
    const salvata = await cache.match(req);
    if (salvata) return salvata;
    try {
      const fresca = await fetch(req);
      if (fresca && fresca.ok) cache.put(req, fresca.clone());
      return fresca;
    } catch (e) {
      return new Response('Offline, e di questa risorsa non c’è una copia salvata.',
                          { status: 503, statusText: 'Offline' });
    }
  })());
});
