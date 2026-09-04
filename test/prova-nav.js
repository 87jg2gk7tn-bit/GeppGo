const { apriBrowser, APP, RADICE, leafletJs, leafletCss } = require('./browser');
const fs = require('fs');

const tappa = (id, name, time, lat, lng) => ({
  id, name, time, timeEnd: '', lat, lng, who: ['p1'], completed: false,
  booking: { needed: false, done: false }
});

const viaggio = (activities, travelMode) => ({
  trips: [{
    id: 't1', name: 'Giappone', destination: 'Tokyo', currency: 'JPY', status: 'open',
    start: '2026-09-01', end: '2026-09-02',
    participants: [{ id: 'p1', name: 'Gepp' }],
    suggested: [], pois: [], expenses: [], tickets: [], hotels: [], weather: {}, createdAt: 1,
    days: [{ id: 'd1', date: new Date().toISOString().split('T')[0], title: '', travelMode, activities }]
  }],
  currentTripId: 't1', settings: { proxRadius: 200 }, myName: 'Gepp'
});

(async () => {
  const browser = await apriBrowser();
  const r = [];
  const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);

  async function apri(stato) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', e => r.push(' FALLITO  errore in pagina: ' + e.message.split('\n')[0]));
    await page.route('**/leaflet@1.9.4/dist/leaflet.js', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(leafletJs(), 'utf8') }));
    await page.route('**/leaflet@1.9.4/dist/leaflet.css', route => route.fulfill({ status: 200, contentType: 'text/css', body: fs.readFileSync(leafletCss(), 'utf8') }));
    await page.route('**/tile.openstreetmap.org/**', route => route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64') }));
    await page.addInitScript(s => localStorage.setItem('geppgo2', JSON.stringify(s)), stato);
    await page.goto(APP, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.navigaGiornata === 'function', { timeout: 15000 });
    // si intercetta l'apertura del navigatore invece di aprirlo davvero
    await page.evaluate(() => {
      window.__url = null; window.__toast = [];
      window.open = u => { window.__url = u; return null; };
      const vero = window.toast;
      window.toast = m => { window.__toast.push(m); if (vero) try { vero(m); } catch (e) {} };
    });
    await page.waitForTimeout(300);
    return page;
  }
  const lancia = async (page, di) => page.evaluate(i => {
    window.__url = null; window.__toast = [];
    navigaGiornata(i);
    return { url: window.__url, toast: window.__toast };
  }, di);

  // ── giornata normale, a piedi ────────────────────────────────────────
  let page = await apri(viaggio([
    tappa(3, 'Shibuya',  '18:00', 35.6595, 139.7005),   // scritta per prima, ma è l'ultima
    tappa(1, 'Senso-ji', '10:00', 35.7148, 139.7967),
    tappa(2, 'Ueno',     '14:00', 35.7138, 139.7770)
  ], 'walk'));
  let e = await lancia(page, 0);
  const u = new URL(e.url);
  ok('parte un percorso di Google Maps', /google\.com\/maps\/dir/.test(e.url), e.url ? e.url.slice(0, 60) : 'nessun indirizzo');
  ok('si parte dalla prima tappa del giorno (Senso-ji, 10:00)', u.searchParams.get('origin') === '35.7148,139.7967', u.searchParams.get('origin'));
  ok('si finisce all\'ultima (Shibuya, 18:00)', u.searchParams.get('destination') === '35.6595,139.7005', u.searchParams.get('destination'));
  ok('quella di mezzo è una sosta (Ueno, 14:00)', u.searchParams.get('waypoints') === '35.7138,139.777', u.searchParams.get('waypoints'));
  ok('l\'ordine è quello degli orari, non di come sono scritte',
     u.searchParams.get('origin').startsWith('35.7148') && u.searchParams.get('destination').startsWith('35.6595'));
  ok('a piedi, come il giorno', u.searchParams.get('travelmode') === 'walking', u.searchParams.get('travelmode'));
  ok('dice quante tappe', /3 tappe/.test(e.toast.join(' ')), e.toast.join(' | '));
  await page.close();

  // ── in auto ──────────────────────────────────────────────────────────
  page = await apri(viaggio([
    tappa(1, 'A', '09:00', 35.10, 139.10), tappa(2, 'B', '12:00', 35.20, 139.20)
  ], 'car'));
  e = await lancia(page, 0);
  ok('se il giorno è in auto, il percorso è in auto', new URL(e.url).searchParams.get('travelmode') === 'driving');
  ok('con due tappe non ci sono soste in mezzo', !new URL(e.url).searchParams.get('waypoints'));
  await page.close();

  // ── una tappa sola / nessun posto ────────────────────────────────────
  page = await apri(viaggio([tappa(1, 'Solo una', '09:00', 35.1, 139.1)], 'walk'));
  e = await lancia(page, 0);
  ok('con una tappa sola non apre niente e lo dice', !e.url && /seconda tappa/.test(e.toast.join(' ')), e.toast.join(' | '));
  await page.close();

  page = await apri(viaggio([
    { id: 1, name: 'Senza posto', time: '09:00', timeEnd: '', who: ['p1'], completed: false, booking: { needed: false, done: false } }
  ], 'walk'));
  e = await lancia(page, 0);
  ok('senza tappe con un posto non apre niente e lo dice', !e.url && /Nessuna tappa/.test(e.toast.join(' ')), e.toast.join(' | '));
  await page.close();

  // ── due tappe nello stesso punto ─────────────────────────────────────
  page = await apri(viaggio([
    tappa(1, 'Museo', '10:00', 35.1000, 139.1000),
    tappa(2, 'Museo · caffè', '11:00', 35.10001, 139.10001),
    tappa(3, 'Altrove', '15:00', 35.2000, 139.2000)
  ], 'walk'));
  e = await lancia(page, 0);
  ok('due tappe nello stesso posto diventano una fermata sola',
     !new URL(e.url).searchParams.get('waypoints') && /2 tappe/.test(e.toast.join(' ')), e.toast.join(' | '));
  await page.close();

  // ── giornata lunghissima: si taglia e lo dice ────────────────────────
  const tante = [];
  for (let i = 0; i < 15; i++) tante.push(tappa(i + 1, 'T' + i, String(8 + i).padStart(2, '0') + ':00', 35 + i * 0.1, 139 + i * 0.1));
  page = await apri(viaggio(tante, 'walk'));
  e = await lancia(page, 0);
  const w = new URL(e.url).searchParams.get('waypoints').split('|');
  ok('non si superano le nove fermate in mezzo', w.length === 9, w.length + ' fermate');
  ok('e avvisa che le ultime non ci stanno', /non ci stanno/.test(e.toast.join(' ')), e.toast.join(' | '));
  await page.close();

  // ── tappe senza orario in fondo ──────────────────────────────────────
  page = await apri(viaggio([
    { ...tappa(1, 'Senza ora', '', 35.90, 139.90) },
    tappa(2, 'Mattina', '09:00', 35.10, 139.10),
    tappa(3, 'Sera', '19:00', 35.50, 139.50)
  ], 'walk'));
  e = await lancia(page, 0);
  ok('le tappe senza orario vanno in fondo, non in testa',
     new URL(e.url).searchParams.get('origin') === '35.1,139.1' && new URL(e.url).searchParams.get('destination') === '35.9,139.9',
     new URL(e.url).searchParams.get('origin') + ' → ' + new URL(e.url).searchParams.get('destination'));
  await page.close();

  // ── mezzi diversi per tratta: il giro si spezza ──────────────────────
  // a piedi fino a Ueno, in metro fino a Shibuya, a piedi fino all'ultima
  page = await apri(viaggio([
    tappa(1, 'Senso-ji', '10:00', 35.7148, 139.7967),
    { ...tappa(2, 'Ueno', '12:00', 35.7138, 139.7770), segTravelMode: 'walk' },
    { ...tappa(3, 'Shibuya', '15:00', 35.6595, 139.7005), segTravelMode: 'train' },
    { ...tappa(4, 'Izakaya', '19:00', 35.6600, 139.7010), segTravelMode: 'walk' }
  ], 'walk'));
  e = await lancia(page, 0);
  ok('con mezzi diversi non apre di forza un percorso solo', !e.url);
  let pezzi = await page.evaluate(() => ({
    n: navGiroPezzi.length,
    mezzi: navGiroPezzi.map(p => p.mode),
    estremi: navGiroPezzi.map(p => p.tappe[0].a.name + '→' + p.tappe[p.tappe.length - 1].a.name),
    pannelloAperto: document.getElementById('mNavGiro').classList.contains('active'),
    testo: document.getElementById('navGiroBody').innerText
  }));
  ok('il giro si spezza dove cambia il mezzo', pezzi.n === 3, pezzi.n + ' pezzi: ' + pezzi.mezzi.join(','));
  ok('i mezzi sono quelli scelti', pezzi.mezzi.join(',') === 'walk,train,walk', pezzi.mezzi.join(','));
  ok('ogni pezzo riparte da dove finisce quello prima',
     pezzi.estremi.join(' | ') === 'Senso-ji→Ueno | Ueno→Shibuya | Shibuya→Izakaya', pezzi.estremi.join(' | '));
  ok('il pannello si apre', pezzi.pannelloAperto);
  ok('e spiega perché è diviso', /mezzo solo per percorso/.test(pezzi.testo));
  ok('e dice dove si cambia il mezzo di una tratta', /time-table/.test(pezzi.testo));

  // aprendo un pezzo parte il navigatore con IL SUO mezzo
  const p2 = await page.evaluate(() => { window.__url = null; navGiroApri(1); return window.__url; });
  const u2 = new URL(p2);
  ok('il pezzo in metro si apre in metro', u2.searchParams.get('travelmode') === 'transit', u2.searchParams.get('travelmode'));
  ok('e va da Ueno a Shibuya', u2.searchParams.get('origin') === '35.7138,139.777' && u2.searchParams.get('destination') === '35.6595,139.7005');
  const p1 = await page.evaluate(() => { window.__url = null; navGiroApri(0); return window.__url; });
  ok('il primo pezzo si apre a piedi', new URL(p1).searchParams.get('travelmode') === 'walking');

  // ── e si può avere TUTTA la giornata in una volta ────────────────────
  ok('il pannello offre tutta la giornata insieme', /Tutta la giornata insieme/.test(pezzi.testo), pezzi.testo.split('\n').find(x => /Tutta la giornata/.test(x)) || '');
  const tutto = await page.evaluate(() => { window.__url = null; navGiroTutto(); return window.__url; });
  const ut = new URL(tutto);
  const wp = (ut.searchParams.get('waypoints') || '').split('|').filter(Boolean);
  ok('tutta la giornata parte dalla PRIMA tappa', ut.searchParams.get('origin') === '35.7148,139.7967', ut.searchParams.get('origin'));
  ok('e arriva all\'ULTIMA', ut.searchParams.get('destination') === '35.66,139.701', ut.searchParams.get('destination'));
  ok('con dentro tutte quelle in mezzo', wp.length === 2, wp.length + ' soste');
  ok('e usa il mezzo che copre più tratte (a piedi: 2 tratte su 3)',
     ut.searchParams.get('travelmode') === 'walking', ut.searchParams.get('travelmode'));
  ok('il pannello avvisa che il mezzo sarà uno solo', /le farà fare tutte/.test(pezzi.testo));
  await page.close();

  // ── tutte le tratte con lo stesso mezzo: apre diretto, niente pannello ─
  page = await apri(viaggio([
    { ...tappa(1, 'A', '09:00', 35.10, 139.10) },
    { ...tappa(2, 'B', '12:00', 35.20, 139.20), segTravelMode: 'car' },
    { ...tappa(3, 'C', '17:00', 35.30, 139.30), segTravelMode: 'car' }
  ], 'walk'));
  e = await lancia(page, 0);
  ok('se il mezzo è sempre lo stesso apre subito, senza pannello',
     !!e.url && !(await page.evaluate(() => document.getElementById('mNavGiro').classList.contains('active'))));
  ok('e usa quel mezzo, non quello del giorno', new URL(e.url).searchParams.get('travelmode') === 'driving', new URL(e.url).searchParams.get('travelmode'));
  await page.close();

  // ── i due tasti ci sono e chiamano la funzione ───────────────────────
  page = await apri(viaggio([tappa(1, 'A', '09:00', 35.1, 139.1), tappa(2, 'B', '12:00', 35.2, 139.2)], 'walk'));
  const tasti = await page.evaluate(() => {
    const trova = sel => [...document.querySelectorAll(sel)].find(x => /Naviga la giornata/.test(x.textContent));
    const h = trova('.hh-acts .hh-act'), tt = trova('#mDay .chip');
    return { home: h ? h.getAttribute('onclick') : null, tt: tt ? tt.getAttribute('onclick') : null };
  });
  ok('il tasto sta nella time-table', tasti.tt === 'navigaGiornata()', String(tasti.tt));
  ok('e NON in home: la giornata si guarda in time-table', tasti.home === null, String(tasti.home));

  // premuto davvero dalla time-table
  const daTT = await page.evaluate(() => {
    window.__url = null;
    [...document.querySelectorAll('#mDay .chip')].find(x => /Naviga la giornata/.test(x.textContent)).click();
    return window.__url;
  });
  ok('premendolo in time-table parte il percorso', /maps\/dir/.test(daTT || ''), daTT ? daTT.slice(0, 60) : 'niente');
  await page.close();

  console.log('\n' + r.join('\n'));
  const falliti = r.filter(x => x.includes('FALLITO')).length;
  console.log(`\n${r.length - falliti}/${r.length} passati`);
  await browser.close();
  process.exit(falliti ? 1 : 0);
})();
