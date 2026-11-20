/* LE MAPPE DAL VIVO: il sito pubblicato, con Esri vero. Non è una prova: npm
 * test non la lancia. Si lancia a mano dopo una pubblicazione che tocca le
 * mappe, o dopo aver rifatto la chiave di Esri.
 *
 * PERCHÉ. La chiave di Esri vale solo dal sito pubblicato
 * (https://87jg2gk7tn-bit.github.io): le prove usano un Esri finto
 * (test/esri-finto.js), e solo qui si vede quello vero. Si esce dal recinto
 * di browser.js apposta. Il viaggio è di prova e sta solo nella memoria del
 * browser: niente account, niente cloud.
 *
 * COSA DICE.
 *  · che lo stile di Esri arrivi senza errori, e con quali fonti;
 *  · gli indirizzi veri dei pezzi e le loro intestazioni (Cache-Control, Age,
 *    Expires): sono quelle che decidono quanto la service worker li può
 *    tenere per l'offline;
 *  · quanti pezzi costa aprire Oggi e il Programma;
 *  · che con la service worker i pezzi restino, e per quanto;
 *  · e fotografa le mappe nei due temi (nella cartella delle foto delle
 *    prove, vedi cartellaFoto in browser.js).
 *
 *   node test/mappe-dal-vivo.js
 *   MAPPE_URL=https://…/Index%202.1.html node test/mappe-dal-vivo.js
 */
const path = require('path');
const { apriBrowser, cartellaFoto } = require('./browser');

const URL_APP = process.env.MAPPE_URL || 'https://87jg2gk7tn-bit.github.io/GeppGo/Index%202.1.html';
const OUT = cartellaFoto();
const OGGI = new Date().toISOString().split('T')[0];
const tappa = (id, name, time, lat, lng) => ({ id, name, time, timeEnd: '', lat, lng, type: 'outdoor', who: [1], completed: false, booking: { needed: false, done: false }, notes: '' });
const STATO = {
  trips: [{ id: 1, name: 'Prova delle mappe', destination: 'Kyoto', currency: 'EUR', status: 'open', start: OGGI, end: OGGI,
    participants: [{ id: 1, name: 'Gepp', isMe: true }], suggested: [], pois: [], expenses: [], tickets: [], weather: {}, createdAt: 1,
    hotels: [{ id: 5, name: 'Ryokan', lat: 35.0, lng: 135.76, address: 'Kyoto', checkIn: OGGI, checkOut: OGGI }],
    days: [{ id: 'd1', date: OGGI, title: '', activities: [tappa(11, 'Fushimi Inari', '09:30', 34.967, 135.772), tappa(12, 'Nishiki', '12:00', 35.005, 135.765), tappa(13, 'Kiyomizu', '15:00', 35.003, 135.775)] }] }],
  currentTripId: 1, settings: { proxRadius: 200 }, myName: 'Gepp', skipAuth: true
};

/* MapLibre disegna con WebGL (le opzioni le mette apriBrowser); se la
   macchina esce in rete da un proxy, il browser passa da lì. */
async function apri() {
  return apriBrowser(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY } } : {});
}
async function pagina(browser, sw) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'it-IT', serviceWorkers: sw ? 'allow' : 'block' });
  await ctx.addInitScript(s => {
    if (sessionStorage.getItem('dal-vivo')) return;
    sessionStorage.setItem('dal-vivo', '1');
    localStorage.clear();
    localStorage.setItem('geppgo2', JSON.stringify(s));
    localStorage.setItem('geppgo2_intro', '1');
    localStorage.setItem('geppgo2_avviso_account2', String(Date.now()));
  }, STATO);
  const p = await ctx.newPage();
  return p;
}
const senzaChiave = u => u.replace(/([?&])token=[^&]+/, '$1token=…');
const ferma = (p, nome) => p.waitForFunction(n => { const m = window.eval(n); return !!m && m._g && m._g.pronta && m.loaded() && !m.isMoving(); }, nome, { timeout: 30000 }).then(() => true, () => false);

(async () => {
  const browser = await apri();
  const errori = [];

  // ── 1. senza service worker: le risposte di Esri come arrivano dalla rete ──
  const p = await pagina(browser, false);
  p.on('pageerror', e => errori.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' || /Esri|mappa/i.test(m.text())) errori.push('CONSOLE ' + m.type() + ': ' + m.text().slice(0, 200)); });
  const risposte = [];
  p.on('response', async r => {
    const u = r.url();
    if (!/\.arcgis\.com\//.test(u)) return;
    const h = r.headers();
    const voce = { url: senzaChiave(u), stato: r.status(), cache: h['cache-control'] || '', age: h.age || '', expires: h.expires || '', cors: h['access-control-allow-origin'] || '', tipo: h['content-type'] || '' };
    if (/basemapstyles-api/.test(u)) { try { const t = await r.text(); voce.errore = /"error"/.test(t) ? t.slice(0, 200) : ''; voce.fonti = Object.values((JSON.parse(t).sources || {})).map(s => s.attribution || '').filter(Boolean); voce.sorgenti = Object.entries(JSON.parse(t).sources || {}).map(([k, s]) => k + ':' + s.type + ':' + ((s.tiles || [])[0] || s.url || '').replace(/\?.*$/, '')); } catch (e) {} }
    risposte.push(voce);
  });
  await p.goto(URL_APP, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof renderAll === 'function' && !document.getElementById('bootSplash'), null, { timeout: 60000 });
  const oggiPronta = await ferma(p, 'homeMapObj');
  await p.waitForTimeout(2500);
  const pezziOggi = risposte.filter(r => /\/tile\//.test(r.url)).length;
  const stato = await p.evaluate(() => ({ versione: VERSIONE_APP, fonte: homeMapObj && homeMapObj._g.fonte, avviso: (document.querySelector('#homeMap .g-avviso:not([hidden])') || {}).textContent || '',
    citazione: (document.querySelector('#homeMap .g-diritti') || {}).textContent || '' }));
  await p.evaluate(() => document.getElementById('homeMapWrap').scrollIntoView({ block: 'center' }));
  await p.waitForTimeout(800);
  await (await p.$('#homeMapWrap')).screenshot({ path: path.join(OUT, 'dal-vivo-oggi-chiaro.png') });
  const prima = risposte.length;
  await p.evaluate(() => openDay(0));
  await ferma(p, 'dayMapObj');
  await p.waitForTimeout(2500);
  const pezziProgramma = risposte.slice(prima).filter(r => /\/tile\//.test(r.url)).length;
  await (await p.$('#dayMapWrap')).screenshot({ path: path.join(OUT, 'dal-vivo-programma-chiaro.png') });
  // il tema scuro, e da vicino (strade e nomi)
  await p.evaluate(() => { cambiaTema(); go('plan'); });
  await ferma(p, 'homeMapObj');
  await p.evaluate(() => { homeMapObj.jumpTo({ zoom: 15.5 }); document.getElementById('homeMapWrap').scrollIntoView({ block: 'center' }); });
  await ferma(p, 'homeMapObj');
  await p.waitForTimeout(2500);
  await (await p.$('#homeMapWrap')).screenshot({ path: path.join(OUT, 'dal-vivo-oggi-scuro-vicino.png') });
  // Tutto il viaggio, col globo
  await p.evaluate(() => apriMappaViaggio());
  await ferma(p, 'vmMappa');
  await p.evaluate(() => vmMappa.jumpTo({ zoom: 2 }));
  await ferma(p, 'vmMappa');
  await p.waitForTimeout(2500);
  await p.screenshot({ path: path.join(OUT, 'dal-vivo-globo-scuro.png') });
  await p.context().close();

  // ── 2. con la service worker: i pezzi restano, e per quanto ────────────
  const q = await pagina(browser, true);
  await q.goto(URL_APP, { waitUntil: 'domcontentloaded' });
  await q.waitForFunction(() => typeof renderAll === 'function' && !document.getElementById('bootSplash'), null, { timeout: 60000 });
  await q.evaluate(() => navigator.serviceWorker.ready);
  await q.reload({ waitUntil: 'domcontentloaded' });
  await q.waitForFunction(() => !!navigator.serviceWorker.controller && typeof renderAll === 'function', null, { timeout: 60000 });
  await ferma(q, 'homeMapObj');
  await q.waitForTimeout(3000);
  const tenuti = await q.evaluate(async () => {
    if (!(await caches.has('geppgo-mappe'))) return { n: 0, durate: [] };
    const c = await caches.open('geppgo-mappe'), out = [];
    for (const k of await c.keys()) { const x = await c.match(k); out.push(Math.round((Number(x.headers.get('x-geppgo-scade')) - Number(x.headers.get('x-geppgo-salvato'))) / 1000)); }
    return { n: out.length, durate: [...new Set(out)].slice(0, 6) };
  });
  await q.context().close();
  await browser.close();

  // ── il resoconto ───────────────────────────────────────────────────────
  const stile = risposte.find(r => /basemapstyles-api/.test(r.url)) || {};
  const perHost = {};
  risposte.forEach(r => { const h = new URL(r.url).hostname; perHost[h] = perHost[h] || { n: 0, stati: new Set(), cache: new Set(), age: new Set() }; perHost[h].n++; perHost[h].stati.add(r.stato); perHost[h].cache.add(r.cache); if (r.age) perHost[h].age.add(r.age); });
  console.log('\nLE MAPPE DAL VIVO — ' + URL_APP + ' (versione ' + stato.versione + ')');
  console.log('  la mappa di Oggi: ' + (oggiPronta ? 'pronta' : 'NON pronta') + ', fondo ' + stato.fonte + (stato.avviso ? ', AVVISO: ' + stato.avviso : ', nessun avviso'));
  console.log('  la citazione: «' + stato.citazione.replace(/\s+/g, ' ') + '»');
  console.log('  lo stile: stato ' + stile.stato + (stile.errore ? ', ERRORE ' + stile.errore : ', senza errori') + ', Cache-Control «' + stile.cache + '»');
  (stile.sorgenti || []).forEach(s => console.log('    sorgente ' + s));
  (stile.fonti || []).forEach(f => console.log('    fonte «' + f + '»'));
  Object.entries(perHost).forEach(([h, v]) => console.log(`  ${h}: ${v.n} risposte, stati ${[...v.stati].join('/')}, Cache-Control ${[...v.cache].map(c => '«' + c + '»').join(' ')}${v.age.size ? ', Age ' + [...v.age].slice(0, 3).join('/') : ''}`));
  console.log(`  pezzi della foto per apertura (390×844): Oggi ${pezziOggi}, Programma ${pezziProgramma}`);
  console.log(`  con la service worker: ${tenuti.n} voci tenute, per ${tenuti.durate.map(s => s + ' s').join(', ') || '—'}`);
  console.log('  le foto: ' + ['dal-vivo-oggi-chiaro.png', 'dal-vivo-programma-chiaro.png', 'dal-vivo-oggi-scuro-vicino.png', 'dal-vivo-globo-scuro.png'].map(f => path.join(OUT, f)).join(', '));
  if (errori.length) console.log('  errori:\n    ' + errori.slice(0, 8).join('\n    '));
  const bene = oggiPronta && stato.fonte === 'esri' && !stile.errore && stile.stato === 200 && risposte.filter(r => /\/tile\//.test(r.url)).every(r => r.stato === 200);
  console.log('\n' + (bene ? 'Le mappe di Esri arrivano.' : 'QUALCOSA NON VA: guarda le righe qui sopra.'));
  process.exit(bene ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
