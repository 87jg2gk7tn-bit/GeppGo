/* LA MAPPA SENZA RETE (le mappe nuove: MapLibre ed Esri, novembre 2026).

   Il momento in cui GeppGo serve di più è quello in cui il telefono non ha
   campo. Le zone già guardate restano nel telefono, ma solo come permettono
   le condizioni di Esri (ArcGIS Location Platform, E204 3.1 d.6 e 7.3 b):
   - si tiene solo quello che la mappa ha chiesto mentre la si guardava:
     **non esiste uno «scarica tutta la città»**;
   - ogni pezzo resta per il tempo che le intestazioni di Esri dicono
     (Cache-Control), e dopo non si usa più, nemmeno senza rete;
   - no-store e no-cache: non si tiene niente;
   - al massimo 1.500 pezzi;
   - se Esri dice che la chiave non vale più (498), si butta tutto.
   Li tiene la service worker (sw.js, «Le mappe senza rete»): qui la si prova
   per davvero, con l'app servita da un indirizzo http e le risposte di Esri
   finte date dal contesto del browser, che vede anche le richieste che la
   service worker fa per conto suo (le rotte della pagina no).
   In fondo: la riga del Profilo, «Libera lo spazio della mappa», e le
   mattonelle della mappa di prima buttate una volta sola. */
const { apriBrowser, recinta, RADICE, maplibreJs, maplibreCss } = require('./browser');
const { stileFinto, PNG_FOTO } = require('./esri-finto');
const fs = require('fs');
const http = require('http');
const path = require('path');

/* L'app va servita da un indirizzo vero, non da file://: la service worker
   da un file non si registra. */
function servi() {
  const s = http.createServer((req, res) => {
    const nome = decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '') || 'Index 2.1.html';
    const f = path.join(RADICE, nome);
    if (!f.startsWith(RADICE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    const tipo = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
                   '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' }[path.extname(f)] || 'text/plain';
    res.writeHead(200, { 'Content-Type': tipo, 'Cache-Control': 'no-cache' });
    res.end(fs.readFileSync(f));
  });
  return new Promise(r => s.listen(0, '127.0.0.1', () => r(s)));
}

const OGGI = new Date().toISOString().split('T')[0];
const tappa = (id, name, time, lat, lng) => ({ id, name, time, timeEnd: '', lat, lng, type: 'outdoor', who: [1], completed: false, booking: { needed: false, done: false }, notes: '' });
const stato = {
  trips: [{ id: 1730000000011, name: 'Giappone', destination: 'Tokyo', currency: 'EUR', status: 'open', start: OGGI, end: OGGI,
    participants: [{ id: 1, name: 'Gepp', isMe: true }], suggested: [],
    pois: [], expenses: [], tickets: [], hotels: [], weather: {}, createdAt: 1,
    days: [{ id: 'd1', date: OGGI, title: '', activities: [tappa(11, 'Senso-ji', '09:00', 35.7148, 139.7967), tappa(12, 'Ueno', '11:00', 35.7156, 139.7745)] }] }],
  currentTripId: 1730000000011, settings: { proxRadius: 200 }, myName: 'Gepp', skipAuth: true
};

/* Esri finto, dal contesto: come risponde lo decide `esri` mentre la prova
   gira. */
const esri = { giu: false, rifiuta: false, cache: 'max-age=86400', pezzi: 0, stile: 0, tutte: 0, memoriaInRete: 0 };
const ESRI = /(^|\.)arcgis\.com$/;
async function esriDalContesto(ctx) {
  await ctx.route(u => ESRI.test(u.hostname), route => {
    const u = new URL(route.request().url());
    esri.tutte++;
    /* un pezzo «dalla memoria» (lo stile di riserva) non deve mai arrivare qui */
    if (u.searchParams.has('geppgo')) esri.memoriaInRete++;
    if (esri.giu) return route.abort('internetdisconnected');
    const h = { 'access-control-allow-origin': '*', 'cache-control': esri.cache };
    if (u.hostname === 'basemapstyles-api.arcgis.com') {
      esri.stile++;
      if (esri.rifiuta) return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ error: { code: 498, message: 'Invalid token.' } }) });
      return route.fulfill({ status: 200, contentType: 'application/json', headers: h, body: JSON.stringify(stileFinto()) });
    }
    if (esri.rifiuta) return route.fulfill({ status: 498, contentType: 'text/plain', headers: { 'access-control-allow-origin': '*' }, body: 'Invalid token.' });
    if (u.hostname === 'ibasemaps-api.arcgis.com') { esri.pezzi++; return route.fulfill({ status: 200, contentType: 'image/png', headers: h, body: PNG_FOTO }); }
    if (/\.json$/.test(u.pathname)) return route.fulfill({ status: 200, contentType: 'application/json', headers: h, body: '{}' });
    if (u.hostname === 'cdn.arcgis.com') return route.fulfill({ status: 200, contentType: 'image/png', headers: h, body: PNG_FOTO });
    return route.fulfill({ status: 200, contentType: 'application/x-protobuf', headers: h, body: Buffer.alloc(0) });
  });
  /* il ripiego non serve qui: se Esri non risponde, nemmeno lui */
  await ctx.route(u => u.hostname === 'tile.openstreetmap.org', route => route.abort('internetdisconnected'));
  /* MapLibre dal pacchetto installato anche quando lo chiede la service
     worker (le rotte della pagina, dove sta il recinto, lei non le passa) */
  await ctx.route(u => u.hostname === 'unpkg.com' && /^\/maplibre-gl@[\d.]+\/dist\/maplibre-gl\.(js|css)$/.test(u.pathname), route => {
    const css = /\.css$/.test(route.request().url());
    route.fulfill({ status: 200, contentType: css ? 'text/css' : 'application/javascript', headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(css ? maplibreCss() : maplibreJs()) });
  });
}

const r = [];
const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);
const err = [];

/* Quello che la service worker ha messo da parte: indirizzi e date annotate. */
const memoria = page => page.evaluate(async () => {
  if (!(await caches.has('geppgo-mappe'))) return { c: false, voci: [] };
  const c = await caches.open('geppgo-mappe');
  const voci = [];
  for (const k of await c.keys()) {
    const x = await c.match(k);
    voci.push({ url: k.url, salvato: Number(x.headers.get('x-geppgo-salvato')), scade: Number(x.headers.get('x-geppgo-scade')), byte: Number(x.headers.get('x-geppgo-byte')) });
  }
  return { c: true, voci };
});
const pezziIn = m => m.voci.filter(v => /ibasemaps-api\.arcgis\.com\/.*\/tile\//.test(v.url));

(async () => {
  const server = await servi();
  const APP = 'http://127.0.0.1:' + server.address().port + '/Index%202.1.html';
  const browser = await apriBrowser();
  const ctx = await browser.newContext({ serviceWorkers: 'allow', viewport: { width: 390, height: 844 }, locale: 'it-IT' });
  await esriDalContesto(ctx);
  await ctx.addInitScript(s => {
    if (localStorage.getItem('prova-mappa')) return;
    localStorage.clear();
    localStorage.setItem('geppgo2', JSON.stringify(s));
    localStorage.setItem('geppgo2_intro', '1');
    localStorage.setItem('geppgo2_avviso_account2', String(Date.now()));
    localStorage.setItem('prova-mappa', '1');
  }, stato);
  /* il recinto di tutte le prove (browser.js): dalla pagina non si esce */
  const page = await recinta(await ctx.newPage());
  page.on('pageerror', e => err.push('PAGEERROR: ' + e.message));
  const pronta = () => page.waitForFunction(() => typeof window.renderAll === 'function' && !document.getElementById('bootSplash'), null, { timeout: 30000 });
  const mappaPronta = () => page.waitForFunction(() => !!homeMapObj && homeMapObj._g.pronta && homeMapObj.loaded(), null, { timeout: 20000 }).catch(() => {});

  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await pronta();
  await page.evaluate(() => navigator.serviceWorker.ready);
  /* ── 0. MapLibre resta anche se e' arrivato prima della service worker ──
     Alla primissima apertura la mappa di Oggi chiede MapLibre prima che la
     service worker guardi la pagina: dopo qualche secondo l'app le dice
     quali librerie sono gia' arrivate, e lei le tiene. */
  const LIB = /const CACHE_NAME = '([^']+)'/.exec(fs.readFileSync(path.join(RADICE, 'sw.js'), 'utf8'))[1].replace('-shell-', '-librerie-');
  const tenuta = await page.waitForFunction(async c => {
    const k = await (await caches.open(c)).keys();
    return k.filter(r => /maplibre-gl@[\d.]+\/dist\/maplibre-gl\.(js|css)$/.test(r.url)).length === 2;
  }, LIB, { timeout: 15000, polling: 500 }).then(() => true, () => false);
  ok('0. MapLibre, arrivato alla prima apertura prima della service worker, resta nella cache delle librerie (la mappa c\'è anche senza rete)', tenuta, LIB);
  /* la prima apertura non passa ancora dalla service worker: si riapre */
  await page.reload({ waitUntil: 'domcontentloaded' });
  await pronta();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 });
  await page.evaluate(() => caches.delete('geppgo-mappe'));

  // ── 1. guardando la mappa, i pezzi si tengono da parte ───────────────
  esri.pezzi = 0;
  await page.reload({ waitUntil: 'domcontentloaded' });
  await pronta();
  await mappaPronta();
  await page.waitForTimeout(1500);
  const chiesti = esri.pezzi;
  let m = await memoria(page);
  const pezzi = pezziIn(m);
  ok('1. guardare la mappa di Oggi chiede i pezzi della foto a Esri', chiesti > 0, chiesti + ' pezzi');
  ok('1. e la service worker li tiene da parte, senza la chiave nell\'indirizzo', pezzi.length > 0 && pezzi.length <= chiesti && !m.voci.some(v => /token=/.test(v.url)),
    `${pezzi.length} pezzi, ${m.voci.length} voci in tutto`);
  const durate = pezzi.map(v => v.scade - v.salvato);
  ok('1. ognuno per il tempo delle intestazioni di Esri (max-age=86400: un giorno), non di più', durate.length && durate.every(d => Math.abs(d - 86400000) < 5000),
    durate.slice(0, 3).join(', ') + ' ms');
  ok('1. anche lo stile (i nomi e le strade sopra la foto si rivedono senza rete)', m.voci.some(v => /basemapstyles-api/.test(v.url)));

  // ── 2. riaprire la stessa zona non la richiede alla rete ─────────────
  esri.pezzi = 0;
  await page.reload({ waitUntil: 'domcontentloaded' });
  await pronta();
  await mappaPronta();
  await page.waitForTimeout(1500);
  ok('2. riaprire la stessa zona non chiede di nuovo i pezzi', esri.pezzi === 0, esri.pezzi + ' chiesti di nuovo');

  // ── 3. senza rete: la zona già vista c'è, con la foto di Esri ────────
  esri.giu = true; esri.tutte = 0;
  await page.reload({ waitUntil: 'domcontentloaded' });
  await pronta();
  await mappaPronta();
  await page.waitForTimeout(1500);
  const senza = await page.evaluate(() => ({ fonte: homeMapObj && homeMapObj._g.fonte, avviso: !document.querySelector('#homeMap .g-avviso').hidden, segni: homeMapMarks.length,
    citazione: document.querySelector('#homeMap .g-diritti').textContent }));
  ok('3. senza rete la zona già vista si rivede: la foto di Esri, i segnaposto, nessun avviso', senza.fonte === 'esri' && !senza.avviso && senza.segni === 2 && /Powered by Esri/.test(senza.citazione),
    JSON.stringify(senza));

  // ── 3b. senza rete e con lo stile di Esri scaduto (il passo 0) ───────
  /* Lo stile vale dieci minuti, la foto un giorno: l'app riaperta senza rete
     dopo un quarto d'ora non ha piu' lo stile. Allora la foto gia' guardata
     si disegna con uno stile fatto dall'app (stileRiserva), e i suoi pezzi
     (geppgo=memoria) la service worker li da' solo dalla memoria e solo se
     ancora validi: in rete non vanno mai. */
  await page.evaluate(async () => {
    const c = await caches.open('geppgo-mappe');
    for (const k of await c.keys()) {
      if (!/basemapstyles-api/.test(k.url)) continue;
      const x = await c.match(k);
      const h = new Headers(x.headers); h.set('x-geppgo-scade', String(Date.now() - 1000));
      await c.put(k, new Response(await x.blob(), { status: x.status, headers: h }));
    }
  });
  const dallaMemoria = [];
  const ascolta = rs => { if (/geppgo=memoria/.test(rs.url())) dallaMemoria.push(rs.status()); };
  page.on('response', ascolta);
  esri.memoriaInRete = 0;
  await page.reload({ waitUntil: 'domcontentloaded' });
  await pronta();
  await page.waitForFunction(() => !!homeMapObj && homeMapObj._g.fonte === 'memoria', null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2500);
  page.off('response', ascolta);
  const riserva = await page.evaluate(() => ({ fonte: homeMapObj && homeMapObj._g.fonte, segni: homeMapMarks.length,
    avviso: (document.querySelector('#homeMap .g-avviso:not([hidden])') || {}).textContent || '',
    citazione: (document.querySelector('#homeMap .g-diritti') || {}).textContent || '' }));
  const serviti = dallaMemoria.filter(x => x === 200).length;
  ok('3b. senza rete e con lo stile di Esri scaduto, la foto dal satellite già guardata si disegna lo stesso, coi segnaposto',
    riserva.fonte === 'memoria' && serviti > 0 && riserva.segni === 2, JSON.stringify(riserva) + ` · ${serviti} pezzi dalla memoria`);
  ok('3b. e lo dice, con la citazione di Esri e le fonti della foto', /Sei senza rete/.test(riserva.avviso) && /Powered by Esri/.test(riserva.citazione), riserva.avviso);
  const mancante = await page.evaluate(() => fetch('https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/19/1/1?geppgo=memoria&f=json&token=x').then(x => x.status, () => 0));
  ok('3b. un pezzo «dalla memoria» non va mai in rete: quello che non c\'è resta vuoto (404)', esri.memoriaInRete === 0 && mancante === 404, `${esri.memoriaInRete} in rete, mancante ${mancante}`);

  // ── 4. scaduto il tempo, non si usa più (nemmeno senza rete) ─────────
  /* Si fanno scadere le date annotate: e' quello che fa il tempo. */
  await page.evaluate(async () => {
    const c = await caches.open('geppgo-mappe');
    for (const k of await c.keys()) {
      const x = await c.match(k);
      const h = new Headers(x.headers); h.set('x-geppgo-scade', String(Date.now() - 1000));
      await c.put(k, new Response(await x.blob(), { status: x.status, headers: h }));
    }
  });
  const unPezzo = pezzi[0] && pezzi[0].url;
  const scaduto = await page.evaluate(u => fetch(u).then(r => 'servito ' + r.status, () => 'non servito'), unPezzo);
  ok('4. un pezzo scaduto non si usa più, nemmeno senza rete', scaduto === 'non servito', scaduto);
  esri.giu = false;

  // ── 5. no-store: niente da parte ─────────────────────────────────────
  await page.evaluate(() => caches.delete('geppgo-mappe'));
  esri.cache = 'no-store';
  await page.reload({ waitUntil: 'domcontentloaded' });
  await pronta();
  await mappaPronta();
  await page.waitForTimeout(1500);
  m = await memoria(page);
  ok('5. se Esri scrive no-store, non si tiene niente', !m.voci.length, m.voci.length + ' voci');
  esri.cache = 'max-age=86400';

  // ── 6. al massimo 1.500 pezzi: oltre, se ne vanno i più vecchi ───────
  /* 1.590 pezzi già da parte (finti, freschi), poi la mappa ne chiede di
     nuovi: ogni cinquanta pezzi scritti la service worker conta. */
  await page.evaluate(async png => {
    const c = await caches.open('geppgo-mappe'), ora = Date.now(), corpo = Uint8Array.from(atob(png), x => x.charCodeAt(0));
    const h = { 'content-type': 'image/png', 'x-geppgo-salvato': String(ora), 'x-geppgo-scade': String(ora + 864e5), 'x-geppgo-byte': String(corpo.length) };
    for (let i = 0; i < 1590; i++) await c.put('https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/3/0/' + i + '?f=json', new Response(corpo, { headers: h }));
  }, PNG_FOTO.toString('base64'));
  const prima = (await memoria(page)).voci.length;
  await page.evaluate(async () => {
    for (let i = 0; i < 60; i++) await fetch('https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/18/' + (1000 + i) + '/77?f=json&token=x').catch(() => {});
  });
  await page.waitForTimeout(1500);
  const dopo = await memoria(page);
  ok('6. al massimo 1.500 pezzi: oltre, se ne vanno i più vecchi', prima >= 1590 && dopo.voci.length <= 1500 && !dopo.voci.some(v => /\/tile\/3\/0\/0\?/.test(v.url)) && dopo.voci.some(v => /\/tile\/18\/1059\//.test(v.url)),
    `${prima} prima, ${dopo.voci.length} dopo`);

  // ── 7. la riga del Profilo, e «Libera lo spazio della mappa» ─────────
  await page.evaluate(() => caches.delete('geppgo-mappe'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await pronta();
  await mappaPronta();
  await page.waitForTimeout(1500);
  const riga = await page.evaluate(async () => { apriProfilo(); mappeMostraStato(); await new Promise(x => setTimeout(x, 800)); return document.getElementById('mappeStato').textContent; });
  ok('7. il Profilo dice quanti pezzi ci sono, quanto pesano e per quanto restano', /\d+ pezzi di mappa da parte · [\d,.]+ (KB|MB) · ognuno resta al massimo 1 giorno/.test(riga), riga);
  const spiega = await page.evaluate(() => document.getElementById('mappeStato').closest('.card').innerText);
  ok('7. e spiega in modo semplice cosa permette Esri: il tempo, 1.500 pezzi, niente città scaricate in anticipo',
    /per il tempo che Esri/.test(spiega) && /1\.500 pezzi/.test(spiega) && /scaricare in anticipo una città intera non è permesso/.test(spiega), spiega.replace(/\s+/g, ' ').slice(0, 160));
  await page.evaluate(() => { mappeSvuota(); document.getElementById('cfOk').click(); });
  await page.waitForTimeout(800);
  const vuota = await page.evaluate(async () => ({ c: await caches.has('geppgo-mappe'), riga: document.getElementById('mappeStato').textContent }));
  ok('7. «Libera lo spazio della mappa» butta tutto', !vuota.c && /Ancora niente/.test(vuota.riga), JSON.stringify(vuota));

  // ── 8. la chiave rifiutata: si butta tutto, e la mappa lo dice ───────
  await page.evaluate(() => go('plan'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await pronta();
  await mappaPronta();
  await page.waitForTimeout(1200);
  const pieno = (await memoria(page)).voci.length;
  esri.rifiuta = true;
  /* un pezzo nuovo (ci si avvicina): Esri risponde 498 */
  await page.evaluate(() => { homeMapObj.jumpTo({ zoom: 17.5 }); });
  await page.waitForTimeout(2500);
  /* «vuota»: la cache la riapre a vuoto la prima richiesta che passa */
  const rifiutata = await page.evaluate(async () => ({ c: (await caches.has('geppgo-mappe')) && (await (await caches.open('geppgo-mappe')).keys()).length > 0, fonte: homeMapObj._g.fonte,
    avviso: (document.querySelector('#homeMap .g-avviso:not([hidden])') || {}).textContent || '', segni: homeMapMarks.length }));
  ok('8. Esri rifiuta la chiave (498): i pezzi da parte si buttano tutti', pieno > 0 && !rifiutata.c, `${pieno} voci prima, cache ${rifiutata.c ? 'ancora piena' : 'vuota'}`);
  ok('8. e la mappa lo dice, e va avanti coi segnaposto', rifiutata.fonte !== 'esri' && /La mappa satellitare ora non è disponibile/.test(rifiutata.avviso) && rifiutata.segni === 2, JSON.stringify(rifiutata));
  esri.rifiuta = false;

  // ── 9. niente «scarica la zona», e solo quello che si vede ───────────
  const html = fs.readFileSync(path.join(RADICE, 'Index 2.1.html'), 'utf8'), sw = fs.readFileSync(path.join(RADICE, 'sw.js'), 'utf8');
  /* In sw.js le mappe si prendono solo dentro pezzoDiMappa, cioe' quando la
     pagina le chiede; nell'app nessuno chiede pezzi per conto suo, se non le
     mappine ferme di Scopri, che mostrano quello che chiedono. */
  const swFetch = [...sw.matchAll(/async function (\w+)\([^)]*\)\s*\{[\s\S]*?\n\}/g)].filter(x => /fetch\(/.test(x[0])).map(x => x[1]);
  ok('9. niente «scarica la zona»: la service worker prende i pezzi solo quando la mappa li chiede',
    !swFetch.some(n => /Mapp|mapp|pezz|Pezz/.test(n) && n !== 'pezzoDiMappa') && /if \(eMappa\(url\)\) event\.respondWith\(pezzoDiMappa\(event\)\)/.test(sw.replace(/else /g, '')),
    swFetch.join(', '));
  ok('9. e nell\'app non c\'è un modo di scaricare una zona in anticipo', !/scarica(re)? (la|una) zona|preload|prefetch/i.test(html.replace(/<!--[\s\S]*?-->|\/\*[\s\S]*?\*\//g, '')));
  esri.pezzi = 0;
  await page.evaluate(() => caches.delete('geppgo-mappe'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await pronta();
  await mappaPronta();
  await page.waitForTimeout(1500);
  ok('9. aprire Oggi chiede solo i pezzi che si vedono (una ventina, non centinaia)', esri.pezzi > 0 && esri.pezzi <= 40, esri.pezzi + ' pezzi');

  // ── 10. le mattonelle della mappa di prima se ne vanno una volta ─────
  const vecchie = await page.evaluate(async () => {
    localStorage.removeItem('geppgo2_tessere_via');
    const db = await idbP();
    await new Promise(ok2 => { const t = db.transaction('tessere', 'readwrite'); for (let i = 0; i < 5; i++) t.objectStore('tessere').put({ k: 'z/1/' + i, blob: new Blob(['x']), ts: 1 }); t.oncomplete = ok2; });
    tessereVecchieVia();
    await new Promise(x => setTimeout(x, 500));
    const n = await new Promise(ok2 => { const q = db.transaction('tessere').objectStore('tessere').count(); q.onsuccess = () => ok2(q.result); });
    return { rimaste: n, segnato: localStorage.getItem('geppgo2_tessere_via') };
  });
  ok('10. le mattonelle tenute dalla mappa di prima si buttano, una volta sola', vecchie.rimaste === 0 && vecchie.segnato === '1', JSON.stringify(vecchie));

  ok('nessun errore in pagina', !err.length, err.slice(0, 3).join(' | '));
  console.log('\n' + r.join('\n'));
  const falliti = r.filter(x => x.includes('FALLITO')).length;
  console.log(`\n${r.length - falliti}/${r.length} passati`);
  await browser.close();
  server.close();
  process.exit(falliti ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
