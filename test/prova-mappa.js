/* La mappa senza rete.

   Il momento in cui GeppGo serve di più è quello in cui il telefono non ha
   campo. Tutto il resto già funzionava offline: l'unica cosa che diventava un
   rettangolo grigio era lo sfondo della mappa.

   Il controllo che vale più di tutti è l'ultimo: **non esiste uno "scarica
   tutta la città"**. Scaricare tessere in blocco dai server di OpenStreetMap
   è vietato dalle loro condizioni — sono volontari, e ti bloccano. È lo stesso
   ragionamento della cache di Overpass, e va tenuto fermo. */
const { apriBrowser, RADICE, leafletJs } = require('./browser');
const fs = require('fs');
const http = require('http');
const path = require('path');

/* L'app va servita da un indirizzo vero, non da file://. Tenere le tessere da
   parte vuol dire prenderle con fetch, e da una pagina aperta come file il
   browser il fetch verso un altro sito non lo lascia nemmeno partire: la
   prova direbbe "non le tiene da parte" per un motivo che sul telefono non
   esiste. Quindici righe di server valgono la differenza. */
function servi() {
  const s = http.createServer((req, res) => {
    const nome = decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '') || 'Index 2.1.html';
    const f = path.join(RADICE, nome);
    if (!f.startsWith(RADICE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    const tipo = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
                   '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' }[path.extname(f)] || 'text/plain';
    res.writeHead(200, { 'Content-Type': tipo });
    res.end(fs.readFileSync(f));
  });
  return new Promise(r => s.listen(0, '127.0.0.1', () => r(s)));
}

const stato = {
  trips: [{ id: 1730000000011, name: 'Giappone', destination: 'Tokyo', currency: 'EUR',
    status: 'open', start: '2026-03-14', end: '2026-03-16',
    participants: [{ id: 1, name: 'Gepp', isMe: true }],
    pois: [{ id: 'p1', name: 'Senso-ji', lat: 35.7148, lng: 139.7967, priority: 'essential', photo: 'x', _photoTry: 99 }],
    expenses: [], tickets: [], hotels: [], weather: {}, createdAt: 1,
    days: [{ id: 'd1', date: '2026-03-14', title: '', activities: [] }] }],
  currentTripId: 1730000000011, settings: { proxRadius: 200 }, myName: 'Gepp', skipAuth: true
};

// una tessera vera, 1×1 verde, perché si possa riconoscerla quando torna
const TESSERA = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

(async () => {
  const server = await servi();
  const APP = 'http://127.0.0.1:' + server.address().port + '/Index%202.1.html';
  const browser = await apriBrowser();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const err = [];
  page.on('pageerror', e => err.push('PAGEERROR: ' + e.message));

  await page.route('**/leaflet@1.9.4/dist/leaflet.js', ro => ro.fulfill({
    status: 200, contentType: 'application/javascript', body: fs.readFileSync(leafletJs(), 'utf8') }));

  let tessereChieste = 0;
  let reteAccesa = true;
  /* Un'espressione regolare e non il modello a stelline: "**\/tile.openstreetmap.org/**"
     vuole una barra prima di "tile", e l'indirizzo vero è "a.tile.openstreetmap.org".
     Non combaciava, e la prova guardava passare le richieste senza vederle. */
  await page.route(/tile\.openstreetmap\.org/, async ro => {
    tessereChieste++;
    if (!reteAccesa) return ro.abort();
    /* Il permesso di lettura da un altro sito: senza, il fetch non arriva a
       vedere l'immagine — ed è esattamente quello che manda OpenStreetMap. */
    await ro.fulfill({ status: 200, contentType: 'image/png', body: TESSERA,
      headers: { 'Access-Control-Allow-Origin': '*' } });
  });

  await page.addInitScript(s => localStorage.setItem('geppgo2', JSON.stringify(s)), stato);
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.stratoMappa === 'function', { timeout: 20000 });
  await page.waitForTimeout(500);

  const r = [];
  const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);

  const svuota = () => page.evaluate(() => tessereButta());
  const quante = () => page.evaluate(() => tessereQuante());
  /* Il riquadro va messo nella pagina, con la sua misura, PRIMA di creare la
     mappa: Leaflet decide quali tessere servono da quanto è grande il
     contenitore, e su un contenitore staccato non ne chiede nessuna. */
  const guarda = (lat, lng, z) => page.evaluate(async ([la, lo, zz]) => {
    const d = document.createElement('div');
    d.style.cssText = 'width:390px;height:400px';
    document.body.appendChild(d);
    const m = L.map(d, { attributionControl: false }).setView([la, lo], zz);
    stratoMappa().addTo(m);
    await new Promise(r => setTimeout(r, 2500));
    const img = [...d.querySelectorAll('img.leaflet-tile')];
    return { quante: img.length,
             daMemoria: img.filter(i => i.dataset.geppgo === 'memoria').length,
             daRete: img.filter(i => i.dataset.geppgo === 'rete').length,
             vuote: img.filter(i => i.dataset.geppgo === 'vuota').length,
             rotte: img.filter(i => !i.src).length };
  }, [lat, lng, z]);

  // ── guardare la mappa la mette da parte ──────────────────────────────────
  await svuota();
  tessereChieste = 0;
  const primoGiro = await guarda(35.7148, 139.7967, 14);
  const dopoPrima = await quante();
  ok('guardare la mappa chiede le tessere alla rete', tessereChieste > 0, tessereChieste + ' chieste');
  ok('e le mostra', primoGiro.daRete > 0, primoGiro.daRete + ' pezzi su ' + primoGiro.quante);
  ok('e se le tiene da parte', dopoPrima.quante > 0, dopoPrima.quante + ' pezzi');
  ok('e sa quanto pesano', dopoPrima.byte > 0, dopoPrima.byte + ' byte');

  // ── la stessa zona non si richiede ───────────────────────────────────────
  const prima = tessereChieste;
  const secondoGiro = await guarda(35.7148, 139.7967, 14);
  ok('riaprire la stessa zona non la richiede alla rete', tessereChieste === prima,
     tessereChieste + ' chieste in tutto, erano ' + prima);
  ok('e la ripesca dalla memoria', secondoGiro.daMemoria > 0,
     secondoGiro.daMemoria + ' pezzi su ' + secondoGiro.quante);

  // ── SENZA RETE: la zona già vista si vede lo stesso ──────────────────────
  reteAccesa = false;
  const offline = await guarda(35.7148, 139.7967, 14);
  ok('senza rete la zona già guardata si vede lo stesso',
     offline.daMemoria > 0, offline.daMemoria + ' pezzi su ' + offline.quante + ' presi dalla memoria');

  // ── SENZA RETE, zona mai vista: un riquadro neutro, non un buco ──────────
  const maiVista = await guarda(-33.86, 151.21, 14);   // Sydney
  ok('una zona mai vista, senza rete, diventa un riquadro neutro',
     maiVista.vuote > 0, maiVista.vuote + ' riquadri su ' + maiVista.quante);
  ok('e non resta un\'immagine rotta', maiVista.rotte === 0, maiVista.rotte + ' rotte');
  reteAccesa = true;

  // ── il magazzino non cresce all'infinito ─────────────────────────────────
  const tetto = await page.evaluate(async () => {
    await tessereButta();
    const db = await idbP();
    await new Promise(res => {
      const t = db.transaction('tessere', 'readwrite'), s = t.objectStore('tessere');
      for (let i = 0; i < 1700; i++) s.put({ k: 'z/' + i + '/0', blob: new Blob(['x']), ts: i });
      t.oncomplete = res; t.onerror = res;
    });
    await tessereSfoltisci();
    return (await tessereQuante()).quante;
  });
  ok('il magazzino non cresce oltre il tetto', tetto === 1500, tetto + ' pezzi su 1700 scritti');
  const vecchie = await page.evaluate(async () => {
    const db = await idbP();
    return await new Promise(res => {
      const q = db.transaction('tessere').objectStore('tessere').get('z/0/0');
      q.onsuccess = e => res(!!e.target.result); q.onerror = () => res(false);
    });
  });
  ok('e butta via le più vecchie', vecchie === false);

  // ── in Profilo si vede quanto occupa, e si può liberare ──────────────────
  await svuota();
  await page.evaluate(() => { session = { user: { id: 'io', email: 'g@x.it' } }; renderProfile(); });
  await page.waitForTimeout(600);
  const vuoto = await page.evaluate(() => document.getElementById('tessereStato').textContent);
  ok('a magazzino vuoto lo dice senza allarmare', /si riempie da sola/i.test(vuoto), vuoto);
  const conRoba = await page.evaluate(async () => {
    const db = await idbP();
    await new Promise(res => {
      const t = db.transaction('tessere', 'readwrite'), s = t.objectStore('tessere');
      for (let i = 0; i < 12; i++) s.put({ k: 'a/' + i + '/0', blob: new Blob([new Uint8Array(20000)]), ts: i });
      t.oncomplete = res; t.onerror = res;
    });
    tessereMostraStato();
    await new Promise(r => setTimeout(r, 400));
    return document.getElementById('tessereStato').textContent;
  });
  ok('con la mappa da parte dice quanti pezzi e quanto pesano',
     /12 pezzi/.test(conRoba) && /MB/.test(conRoba), conRoba);
  const dopoPulizia = await page.evaluate(async () => {
    await tessereButta(); tessereMostraStato();
    await new Promise(r => setTimeout(r, 400));
    return (await tessereQuante()).quante;
  });
  ok('e si può liberare lo spazio', dopoPulizia === 0, String(dopoPulizia));

  // ── le foto di chi c'era prima non si toccano ────────────────────────────
  /* Il magazzino delle tessere è arrivato dopo, e ha alzato la versione del
     database: chi ha già l'app installata ci arriva con le sue foto dentro. */
  const foto = await page.evaluate(async () => {
    const db = await idbP();
    await new Promise(res => { db.transaction('ph', 'readwrite').objectStore('ph')
      .put({ id: 'f1', tripId: 1, data: 'x', ts: 1 }).onsuccess = res; });
    return await new Promise(res => {
      db.transaction('ph').objectStore('ph').get('f1').onsuccess = e => res(!!e.target.result);
    });
  });
  ok('il magazzino delle foto continua a funzionare', foto === true);

  // ── LA REGOLA: niente "scarica tutta la città" ───────────────────────────
  /* Scaricare tessere in blocco dai server di OpenStreetMap è vietato dalle
     loro condizioni: sono volontari, e ti bloccano. La regola si controlla
     guardando quello che l'app fa davvero, non cercando parole nel codice —
     un controllo sulle parole boccerebbe la frase che spiega la scelta. */
  await svuota();
  tessereChieste = 0;
  await guarda(48.8566, 2.3522, 13);   // Parigi, mai vista
  /* Un riquadro di 390×400 a zoom 13 sta dentro una ventina di tessere: se un
     giorno ne partissero centinaia vorrebbe dire che qualcuno ha aggiunto lo
     "scarica la città", ed è il momento di fermarsi. */
  ok('aprire la mappa chiede solo quello che si vede', tessereChieste > 0 && tessereChieste <= 40,
     tessereChieste + ' tessere per una schermata');

  // ── e la scelta è scritta dove la si legge ───────────────────────────────
  /* textContent e non innerText: il Profilo in questo momento è nascosto, e
     innerText legge solo quello che si vede a schermo. */
  const spiega = await page.evaluate(() => document.body.textContent);
  ok('la scelta è spiegata in Profilo', /vietato dalle loro condizioni/i.test(spiega));

  console.log('\n' + r.join('\n'));
  const falliti = r.filter(x => x.includes('FALLITO')).length;
  console.log(`\n${r.length - falliti}/${r.length} passati`);
  if (err.length) console.log('\nErrori in pagina:\n' + err.join('\n'));
  await browser.close();
  server.close();
  process.exit(falliti || err.length ? 1 : 0);
})();
