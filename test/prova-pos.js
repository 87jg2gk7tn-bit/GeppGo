const { apriBrowser, APP, RADICE, leafletJs, leafletCss } = require('./browser');
const OUT = '/tmp/claude-0/-home-user-GeppGo/63cda2c7-b8e3-5374-b037-1b6d541802ce/scratchpad';

// due tappe con posizione, così la mini-mappa della home viene costruita
const stato = {
  trips: [{
    id: 't1', name: 'Giappone', destination: 'Tokyo', currency: 'JPY', status: 'open',
    start: '2026-09-01', end: '2026-09-02',
    participants: [{ id: 'p1', name: 'Gepp' }],
    suggested: [], pois: [], expenses: [], tickets: [], hotels: [], weather: {}, createdAt: Date.now(),
    days: [{
      id: 'd1', date: new Date().toISOString().split('T')[0], title: '', activities: [
        { id: 1, name: 'Senso-ji', time: '10:00', timeEnd: '11:00', lat: 35.7148, lng: 139.7967,
          who: ['p1'], completed: false, booking: { needed: false, done: false } },
        { id: 2, name: 'Shibuya', time: '15:00', timeEnd: '16:00', lat: 35.6595, lng: 139.7005,
          who: ['p1'], completed: false, booking: { needed: false, done: false } }
      ]
    }]
  }],
  currentTripId: 't1', settings: { proxRadius: 200 }, myName: 'Gepp'
};

const POS = { coords: { latitude: 35.6800, longitude: 139.7400, accuracy: 25 } };

(async () => {
  const browser = await apriBrowser();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const err = [];
  page.on('pageerror', e => err.push('PAGEERROR: ' + e.message));

  // Leaflet arriva da un CDN irraggiungibile da qui: si serve la stessa versione presa da npm
  const fs = require('fs');
  await page.route('**/leaflet@1.9.4/dist/leaflet.js', route => route.fulfill({
    status: 200, contentType: 'application/javascript',
    body: fs.readFileSync(leafletJs(), 'utf8')
  }));
  await page.route('**/leaflet@1.9.4/dist/leaflet.css', route => route.fulfill({
    status: 200, contentType: 'text/css',
    body: fs.readFileSync(leafletCss(), 'utf8')
  }));

  // le tile della mappa non si scaricano da qui: si serve un pixel trasparente
  await page.route('**/tile.openstreetmap.org/**', route => route.fulfill({
    status: 200, contentType: 'image/png',
    body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
  }));

  await page.addInitScript(s => localStorage.setItem('geppgo2', JSON.stringify(s)), stato);
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.homeMePlace === 'function' && typeof window.buildHomeMap === 'function', { timeout: 15000 });
  await page.waitForFunction(() => !!homeMapObj, { timeout: 15000 });
  await page.waitForTimeout(500);

  const r = [];
  const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);

  const stato_ = () => page.evaluate(() => {
    const b = document.getElementById('locateFabHome');
    const rect = b ? b.getBoundingClientRect() : null;
    return {
      pallino: !!homeMeMarker, alone: !!homeMeHalo,
      tasto: !!b, tastoAcceso: b ? b.classList.contains('on') : null,
      tastoSiVede: rect ? (rect.width > 0 && rect.y > 0 && rect.y < innerHeight) : false,
      // il pallino è davvero disegnato dentro la mappa della home?
      nelDom: document.querySelectorAll('#homeMap .leaflet-marker-icon').length,
      dove: homeMeMarker ? homeMeMarker.getLatLng() : null
    };
  });

  // ── prima di avere una posizione ─────────────────────────────────────
  let s = await stato_();
  ok('il tasto 🧭 c\'è sulla mappa della home', s.tasto && s.tastoSiVede);
  ok('e parte spento, perché il GPS non è attivo', s.tastoAcceso === false);
  ok('nessun pallino finché non si sa dove siamo', !s.pallino && !s.alone);
  const marcatoriTappe = s.nelDom;
  ok('le due tappe sono sulla mappa', marcatoriTappe === 2, marcatoriTappe + ' marcatori');

  // ── arriva la posizione ──────────────────────────────────────────────
  await page.evaluate(p => { gpsId = 1; placeMe(p); }, POS);
  await page.waitForTimeout(400);
  s = await stato_();
  ok('arriva la posizione e il pallino compare in home', s.pallino && s.alone);
  ok('è nel punto giusto', s.dove && Math.abs(s.dove.lat - 35.68) < 1e-6 && Math.abs(s.dove.lng - 139.74) < 1e-6, JSON.stringify(s.dove));
  ok('si aggiunge alle tappe, non le sostituisce', s.nelDom === marcatoriTappe + 1, s.nelDom + ' marcatori');
  ok('col GPS attivo il tasto è acceso', s.tastoAcceso === true);

  await page.screenshot({ path: `${OUT}/pos-home.png` });

  // ── la home si ridisegna: il pallino deve resistere ──────────────────
  await page.evaluate(() => renderAll());
  await page.waitForTimeout(700);
  s = await stato_();
  ok('dopo un ridisegno della home il pallino c\'è ancora', s.pallino && s.alone);
  ok('e non è rimasto un doppione', s.nelDom === marcatoriTappe + 1, s.nelDom + ' marcatori');
  ok('e il tasto è ancora acceso', s.tastoAcceso === true);

  // ── il tasto centra sulla posizione ──────────────────────────────────
  const centro = await page.evaluate(() => {
    homeMapObj.setView([35.0, 139.0], 13);          // porto la vista lontano
    locateFabHome();
    const c = homeMapObj.getCenter();
    return { lat: c.lat, lng: c.lng };
  });
  ok('il tasto 🧭 porta la mappa sulla posizione',
     Math.abs(centro.lat - 35.68) < 1e-4 && Math.abs(centro.lng - 139.74) < 1e-4, JSON.stringify(centro));

  // com'è fatto il pallino, guardato da vicino
  await page.evaluate(() => document.getElementById('homeMapWrap').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(500);
  const wrap = await page.$('#homeMapWrap');
  await wrap.screenshot({ path: `${OUT}/pos-pallino.png` });

  // ── posizione vecchia: non si mostra ─────────────────────────────────
  await page.evaluate(() => { myPosAt = Date.now() - (POS_FRESCA_MS + 60000); homeMePlace(); });
  await page.waitForTimeout(300);
  s = await stato_();
  ok('una posizione di più di un quarto d\'ora fa non viene mostrata', !s.pallino, 'pallino=' + s.pallino);

  // ── GPS spento: sparisce ─────────────────────────────────────────────
  await page.evaluate(p => { myPosAt = Date.now(); placeMe(p); }, POS);
  await page.waitForTimeout(300);
  ok('(rimesso) il pallino è tornato', (await stato_()).pallino);
  await page.evaluate(() => { gpsId = null; stopGPS(); });
  await page.waitForTimeout(300);
  s = await stato_();
  ok('spegnendo il GPS il pallino sparisce', !s.pallino && !s.alone);
  ok('e il tasto si spegne', s.tastoAcceso === false);
  ok('le tappe restano al loro posto', s.nelDom === marcatoriTappe, s.nelDom + ' marcatori');

  // ── le altre due mappe non si sono rotte ─────────────────────────────
  const altre = await page.evaluate(p => {
    if (typeof initMap === 'function' && (typeof map === 'undefined' || !map)) initMap();
    gpsId = 1; placeMe(p);
    return { grande: !!meMarker, aloneGrande: !!meHalo };
  }, POS);
  ok('il pallino sulla mappa grande funziona ancora', altre.grande && altre.aloneGrande, JSON.stringify(altre));

  console.log('\n' + r.join('\n'));
  const falliti = r.filter(x => x.includes('FALLITO')).length;
  console.log(`\n${r.length - falliti}/${r.length} passati`);
  if (err.length) console.log('\nErrori in pagina:\n' + err.slice(0, 5).join('\n'));
  await browser.close();
  process.exit(falliti ? 1 : 0);
})();
