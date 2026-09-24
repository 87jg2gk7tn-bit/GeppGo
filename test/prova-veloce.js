/* LA RICERCA VELOCE: PHOTON E NOMINATIM, QUANDO LA MAPPA ARRANCA.
 *
 * Segnalato con la foto: «Perché mi dà il risultato di due giorni fa? Deve
 * trovarlo adesso». Overpass era l'unica fonte, e i suoi server pubblici
 * oggi rispondono in 12-40 secondi o non rispondono. Misurato dal vivo:
 * Photon e Nominatim trovano gli stessi posti in 0,2-4 secondi. Qui si
 * prova che la veloce arriva quando la mappa arranca, che la mappa — più
 * ricca — prende il suo posto quando risponde, e soprattutto che quando la
 * mappa risponde in fretta la veloce NON parte: stazione e metro, che
 * funzionano, devono restare esattamente come sono.
 */
const { apriBrowser, APP, leafletJs } = require('./browser');
const { comeOverpass } = require('./overpass-finto');
const fs = require('fs');

const IO = { lat: 45.59217, lng: 9.22839 };   /* non sulla griglia, apposta */
const su = m => IO.lat + m / 111320;
const stato = { trips: [{ id: 1, name: 'Prova', destination: 'Muggiò', currency: 'EUR', status: 'open',
  participants: [{ id: 'p1', name: 'Gepp' }], suggested: [], pois: [], expenses: [], tickets: [],
  hotels: [], weather: {}, createdAt: Date.now(),
  days: [{ id: 'd1', date: '2026-09-01', title: '', activities: [] }] }],
  currentTripId: 1, settings: {}, myName: 'Gepp', skipAuth: true };

(async () => {
  const browser = await apriBrowser();
  const r = [];
  const err = [];
  const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);

  /* overpass: 'lento' (risponde dopo 20 s), 'giu' (504), 'svelto' (subito) */
  async function apri(overpass) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', e => err.push('PAGEERROR: ' + e.message.split('\n')[0]));
    page._photon = []; page._nominatim = [];
    await page.route('**/leaflet@1.9.4/dist/leaflet.js', ro => ro.fulfill({
      status: 200, contentType: 'application/javascript', body: fs.readFileSync(leafletJs(), 'utf8') }));
    await page.route(/tile\.openstreetmap\.org/, ro => ro.abort());
    await page.route('**/api/interpreter', async ro => {
      const q = decodeURIComponent(ro.request().postData() || '');
      if (overpass === 'giu') return ro.fulfill({ status: 504, body: 'gateway timeout' });
      if (overpass === 'lento') await new Promise(s => setTimeout(s, 20000));
      const el = /toilets/.test(q)
        ? [{ type: 'node', id: 9, lat: su(150), lon: IO.lng,
             tags: { amenity: 'toilets', name: 'Bagno dalla mappa', fee: 'no', opening_hours: '24/7' } }]
        : /railway/.test(q)
          ? [{ type: 'node', id: 8, lat: su(1670), lon: IO.lng,
               tags: { railway: 'station', train: 'yes', name: 'Lissone-Muggiò', operator: 'Rete Ferroviaria Italiana' } }]
          : [];
      return ro.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(comeOverpass(el)) }).catch(() => {});
    });
    await page.route(/photon\.komoot\.io\/reverse/, ro => {
      page._photon.push(ro.request().url());
      const u = new URL(ro.request().url());
      const tag = u.searchParams.getAll('osm_tag');
      const f = tag.includes('amenity:toilets')
        ? [{ geometry: { coordinates: [IO.lng, su(90)] }, properties: { osm_key: 'amenity', osm_value: 'toilets', name: 'Bagno da Photon' } }]
        : tag.includes('railway:station')
          /* Photon per «stazione» da' anche il metro, e non sa distinguerlo */
          ? [{ geometry: { coordinates: [IO.lng, su(200)] }, properties: { osm_key: 'railway', osm_value: 'station', name: '49th Street' } }]
          : [];
      ro.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ type: 'FeatureCollection', features: f }) });
    });
    await page.route(/nominatim\.openstreetmap\.org\/search/, ro => {
      /* Si contano solo le domande della ricerca veloce — quelle chiuse in
         un riquadro attorno a te. All'apertura l'app chiede a Nominatim
         dov'è la città del viaggio, e quella non c'entra. */
      if (/bounded=1/.test(ro.request().url())) page._nominatim.push(ro.request().url());
      const q = new URL(ro.request().url()).searchParams.get('q');
      const d = q === 'railway station' ? [
        /* la fermata del metro, che Nominatim riconosce dai dettagli */
        { lat: String(su(200)), lon: String(IO.lng), class: 'railway', type: 'station', name: '49th Street', extratags: { station: 'subway' } },
        /* e la stazione dei treni vera, piu' lontana */
        { lat: String(su(1000)), lon: String(IO.lng), class: 'railway', type: 'station', name: 'Grand Central', extratags: { train: 'yes', operator: 'Metro-North' } }
      ] : q === 'toilets' ? [
        /* un bagno vero, senza nome: Photon non ce l'ha, Nominatim sì */
        { lat: String(su(60)), lon: String(IO.lng), class: 'amenity', type: 'toilets', name: '', display_name: 'Via Casati, Muggiò' },
        /* e una via che si chiama «dei Bagni»: NON è un bagno */
        { lat: String(su(20)), lon: String(IO.lng), class: 'highway', type: 'residential', name: 'Via dei Bagni', display_name: 'Via dei Bagni' }
      ] : [];
      ro.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
    });
    await page.addInitScript(([s, io]) => {
      localStorage.setItem('geppgo2', JSON.stringify(s));
      navigator.geolocation.getCurrentPosition = cb => cb({ coords: { latitude: io.lat, longitude: io.lng } });
    }, [stato, IO]);
    await page.goto(APP, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.cercaVicino === 'function', { timeout: 20000 });
    await page.waitForFunction(() => !document.getElementById('bootSplash'), { timeout: 20000 });
    await page.evaluate(() => { localStorage.removeItem(VICINI_CACHE_CHIAVE); myPos = null; myPosAt = 0; });
    return page;
  }
  const corpo = p => p.evaluate(() => document.getElementById('bagnoBody').innerText.replace(/\s+/g, ' ').trim());
  const fino = (p, re, ms) => p.waitForFunction(r => new RegExp(r).test(document.getElementById('bagnoBody').innerText), re, { timeout: ms }).catch(() => {});

  // ── 1. la mappa arranca: la veloce arriva prima, poi la mappa prende il posto
  {
    const p = await apri('lento');
    const via = Date.now();
    await p.evaluate(() => cercaVicino('bagno'));
    await fino(p, 'Bagno da Photon|Via Casati|Bagno pubblico', 15000);
    const quanto = (Date.now() - via) / 1000;
    let t = await corpo(p);
    const dopo = await p.evaluate(() => typeof VICINI_VELOCE_DOPO_MS === 'number' ? VICINI_VELOCE_DOPO_MS : 4000);
    ok('con la mappa lenta, dopo pochi secondi c\'è già qualcosa',
       /Bagno/.test(t) && quanto < dopo / 1000 + 6, `${quanto.toFixed(1)}s — ${t.slice(0, 70)}`);
    ok('e dice che è la ricerca veloce, e che sta controllando la mappa',
       /ricerca veloce/.test(t) && /controllo anche sulla mappa/.test(t), t.slice(0, 90));
    /* Il bagno senza nome che Photon non ha, Nominatim sì: si vede. */
    ok('c\'è anche il bagno senza nome, che solo Nominatim conosce',
       /Bagno pubblico/.test(t), t.slice(0, 120));
    ok('e la via che si chiama «dei Bagni» NON è un bagno', !/Via dei Bagni/.test(t));
    /* Si chiede su un punto della griglia, come alla mappa: non dove sei. */
    const u = new URL(p._photon[0] || 'http://x/?lat=0&lon=0');
    ok('a Photon arriva un punto della griglia, non la posizione vera',
       u.searchParams.get('lat') === '45.592' && u.searchParams.get('lon') === '9.228',
       u.searchParams.get('lat') + ',' + u.searchParams.get('lon'));
    await fino(p, 'Bagno dalla mappa', 30000);
    t = await corpo(p);
    ok('quando la mappa risponde, la sua lista prende il posto della veloce',
       /Bagno dalla mappa/.test(t) && !/ricerca veloce/.test(t), t.slice(0, 80));
    ok('coi dettagli che solo la mappa ha', /sempre aperto|gratuito/.test(t), t.slice(0, 100));
    await p.close();
  }

  // ── 2. la mappa è giù: la veloce è la risposta, fresca, non quella di due giorni fa
  {
    const p = await apri('giu');
    await p.evaluate(() => cercaVicino('bagno'));
    await fino(p, 'Bagno da Photon', 40000);
    await p.waitForTimeout(500);
    const t = await corpo(p);
    ok('con la mappa giù, i bagni si trovano lo stesso', /Bagno da Photon/.test(t), t.slice(0, 80));
    ok('e non si dice «non ha risposto», né si mostra roba vecchia',
       !/non ha risposto|avevo trovato/.test(t), t.slice(0, 80));
    await p.close();
  }

  // ── 3. la mappa risponde in fretta: la veloce NON parte (stazione e metro restano come sono)
  {
    const p = await apri('svelto');
    await p.evaluate(() => cercaVicino('treno'));
    await fino(p, 'Lissone-Muggiò', 15000);
    const attesa = await p.evaluate(() => typeof VICINI_VELOCE_DOPO_MS === 'number' ? VICINI_VELOCE_DOPO_MS : 4000);
    await p.waitForTimeout(attesa + 1500);
    const t = await corpo(p);
    ok('con la mappa svelta, la stazione arriva dalla mappa come sempre',
       /Lissone-Muggiò/.test(t) && /gestita da Rete Ferroviaria Italiana/.test(t), t.slice(0, 90));
    ok('e né Photon né Nominatim vengono chiamati',
       p._photon.length === 0 && p._nominatim.length === 0,
       `photon ${p._photon.length}, nominatim ${p._nominatim.length} ${p._nominatim.join(' ').slice(0, 140)}`);
    await p.close();
  }

  // ── 4. la stazione dei treni non è la fermata del metro ──────────────
  /* Misurato in giro per il mondo: Photon per «stazione» restituiva anche il
     metro — a New York «49th Street», a Parigi «Châtelet». Nominatim coi
     dettagli dice station=subway, e quella si scarta come fa la mappa. */
  {
    const p = await apri('giu');
    await p.evaluate(() => cercaVicino('treno'));
    await fino(p, 'Grand Central|49th Street', 40000);
    await p.waitForTimeout(500);
    const t = await corpo(p);
    ok('la stazione dei treni vera si trova', /Grand Central/.test(t), t.slice(0, 80));
    ok('e la fermata del metro non passa per stazione dei treni', !/49th Street/.test(t), t.slice(0, 80));
    ok('per la stazione Photon non si interpella nemmeno: non sa distinguere', p._photon.length === 0,
       p._photon.length + ' domande a Photon');
    ok('e dai dettagli di Nominatim viene fuori anche chi la gestisce', /gestita da Metro-North/.test(t), t.slice(0, 100));
    await p.close();
  }

  await browser.close();
  for (const e of err) r.push(' FALLITO  ' + e);
  console.log('\n' + r.join('\n'));
  const falliti = r.filter(x => x.includes('FALLITO')).length;
  console.log(`\n${r.length - falliti}/${r.length} passati`);
  process.exit(falliti ? 1 : 0);
})();
