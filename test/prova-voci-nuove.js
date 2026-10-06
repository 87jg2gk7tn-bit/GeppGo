/* SUPERMARKET, FARMACIA, RISTORANTE, BAR — E LA SCRITTA PIÙ SCURA.
 *
 * Chiesto: «aggiungi alla sezione "cosa cerchi qui intorno?" supermercati
 * (sotto la voce Supermarket), farmacie, ristoranti, bar (per bere alcolici)
 * e metti la scritta della sezione più scura. Con lo stesso metodo e senza
 * rompere niente.»
 *
 * Qui si prova, su un mondo finto ma fedele (il finto Overpass legge la
 * domanda per davvero), che ognuna trova quello che deve e SOLO quello:
 * - il supermarket non è il minimarket sotto casa;
 * - la farmacia c'è anche quando è segnata solo come healthcare=pharmacy,
 *   e la parafarmacia lo dice;
 * - il ristorante dice la cucina, e il fast food non è un ristorante;
 * - il bar è quello dove si beve (cocktail bar, pub, birreria): il bar
 *   italiano della colazione è amenity=cafe, e non c'è. E «Barbiere» non è
 *   un bar — per questo queste voci non cercano per nome.
 * Poi lo stesso metodo delle altre: con la mappa giù la ricerca veloce le
 * trova lo stesso. E niente doppioni: lo stesso supermercato segnato come
 * entrata e come edificio è una riga, ma due Esselunga in due vie diverse
 * sono due.
 */
const { apriBrowser, APP, leafletJs } = require('./browser');
const { rispondi, comeOverpass } = require('./overpass-finto');
const fs = require('fs');

const IO = { lat: 45.4750, lng: 9.1900 };
const su = m => IO.lat + m / 111320;
const est = m => IO.lng + m / (111320 * Math.cos(IO.lat * Math.PI / 180));
const stato = { trips: [{ id: 1, name: 'Prova', destination: 'Milano', currency: 'EUR', status: 'open',
  /* Due persone: così in home accanto a «Cosa cerchi» c'è anche «A raccolta»,
     e la scritta ha lo spazio vero che ha su un telefono. */
  participants: [{ id: 'p1', name: 'Gepp', isMe: true }, { id: 'p2', name: 'Luca' }], suggested: [], pois: [], expenses: [], tickets: [],
  hotels: [], weather: {}, createdAt: Date.now(),
  days: [{ id: 'd1', date: '2026-09-01', title: '', activities: [] }] }],
  currentTripId: 1, settings: {}, myName: 'Gepp', skipAuth: true };

const nodo = (id, m, tags, verso = su) => ({ type: 'node', id, lat: verso === su ? su(m) : IO.lat, lon: verso === su ? IO.lng : est(m), tags });

const MONDO = [
  // spesa: il supermercato segnato due volte (entrata ed edificio, 100 m fra i due centri),
  // un altro della stessa catena in un'altra via, e un minimarket che NON è un supermarket
  nodo(1, 200, { shop: 'supermarket', name: 'Esselunga', opening_hours: 'Mo-Sa 07:30-22:00' }),
  { type: 'way', id: 2, center: { lat: su(300), lon: IO.lng }, tags: { shop: 'supermarket', name: 'Esselunga', building: 'retail' } },
  nodo(3, 700, { shop: 'supermarket', name: 'Esselunga' }, est),
  nodo(4, 80, { shop: 'convenience', name: 'Carrefour Express' }, est),
  // farmacia: una normale, una segnata solo come healthcare, e una parafarmacia
  nodo(10, 150, { amenity: 'pharmacy', name: 'Farmacia Centrale', opening_hours: '24/7' }, est),
  nodo(11, 400, { healthcare: 'pharmacy', name: 'Farmacia Comunale 5' }),
  nodo(12, 600, { amenity: 'pharmacy', name: 'Parafarmacia Bio', dispensing: 'no' }, est),
  // ristorante: con la cucina come la scrive la mappa, e un fast food che non conta
  nodo(20, 120, { amenity: 'restaurant', name: 'Da Mario', cuisine: 'italian;pizza', 'diet:vegetarian': 'yes' }),
  nodo(21, 60, { amenity: 'fast_food', name: 'McDonald\'s' }, est),
  // bar: dove si beve — e quello della colazione, che qui non c'entra
  nodo(30, 100, { amenity: 'bar', name: 'Cocktail Lab', outdoor_seating: 'yes' }, est),
  nodo(31, 200, { amenity: 'pub', name: 'The Old Pub' }),
  nodo(32, 280, { amenity: 'biergarten' }, est),
  nodo(33, 40, { amenity: 'cafe', name: 'Bar Sport' }),
  nodo(34, 70, { shop: 'hairdresser', name: 'Barbiere Gino' }),
];

(async () => {
  const browser = await apriBrowser();
  const r = [];
  const err = [];
  const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);

  async function apri(overpass, viewport = { width: 390, height: 844 }) {
    /* Il permesso della posizione e' gia' dato: e' il telefono di chi l'aveva
       concesso. Senza, prima della richiesta l'app apre il foglio che spiega a
       cosa serve (vedi LA POSIZIONE, SOLO QUANDO SERVE) e la ricerca aspetta. */
    const page = await browser.newPage({ viewport, permissions: ['geolocation'] });
    page.on('pageerror', e => err.push('PAGEERROR: ' + e.message.split('\n')[0]));
    page._domande = [];
    await page.route('**/leaflet@1.9.4/dist/leaflet.js', ro => ro.fulfill({
      status: 200, contentType: 'application/javascript', body: fs.readFileSync(leafletJs(), 'utf8') }));
    await page.route(/tile\.openstreetmap\.org/, ro => ro.abort());
    await page.route('**/api/interpreter', ro => {
      if (overpass === 'giu') return ro.fulfill({ status: 504, body: 'gateway timeout' });
      const q = decodeURIComponent(ro.request().postData() || '').replace(/^data=/, '');
      page._domande.push(q);
      ro.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(comeOverpass(rispondi(q, MONDO))) });
    });
    /* La ricerca veloce: Photon e Nominatim come rispondono davvero —
       Photon per etichetta, Nominatim per frase, ognuno con le sue sviste. */
    await page.route(/photon\.komoot\.io\/reverse/, ro => {
      const tag = new URL(ro.request().url()).searchParams.getAll('osm_tag');
      const f = [];
      const metti = (m, k, v, name) => f.push({ geometry: { coordinates: [IO.lng, su(m)] }, properties: { osm_key: k, osm_value: v, name } });
      if (tag.includes('shop:supermarket')) metti(250, 'shop', 'supermarket', 'Lidl');
      if (tag.includes('amenity:pharmacy')) metti(300, 'amenity', 'pharmacy', 'Farmacia della Stazione');
      if (tag.includes('amenity:bar')) { metti(90, 'amenity', 'bar', 'Negroni Club'); metti(30, 'amenity', 'cafe', 'Bar Pasticceria'); }
      ro.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ type: 'FeatureCollection', features: f }) });
    });
    await page.route(/nominatim\.openstreetmap\.org\/search/, ro => {
      const q = new URL(ro.request().url()).searchParams.get('q');
      const x = (m, cl, ty, name, extratags) => ({ lat: String(su(m)), lon: String(IO.lng), class: cl, type: ty, name, extratags: extratags || {} });
      const d = q === 'restaurant' ? [x(140, 'amenity', 'restaurant', 'Trattoria del Ponte', { cuisine: 'regional' })]
        : q === 'bar' ? [x(20, 'amenity', 'cafe', 'Bar Centrale'), x(160, 'amenity', 'bar', 'Bar Basso')]
        : q === 'pharmacy' ? [x(350, 'amenity', 'pharmacy', 'Farmacia Moscova', { opening_hours: '24/7' })]
        : [];
      ro.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
    });
    await page.addInitScript(([s, io]) => {
      localStorage.setItem('geppgo2', JSON.stringify(s));
      navigator.geolocation.getCurrentPosition = cb => cb({ coords: { latitude: io.lat, longitude: io.lng } });
    }, [stato, IO]);
    await page.goto(APP, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.cercaVicino === 'function', { timeout: 20000 });
    await page.waitForFunction(() => !document.getElementById('bootSplash'), { timeout: 20000 });
    return page;
  }
  const righe = async (page, kind, re, ms = 30000) => {
    await page.evaluate(k => { localStorage.removeItem(VICINI_CACHE_CHIAVE); myPos = null; myPosAt = 0; closeSheet('mBagno'); cercaVicino(k); }, kind);
    await page.waitForFunction(r2 => new RegExp(r2).test(document.getElementById('bagnoBody').innerText),
      re, { timeout: ms }).catch(() => {});
    await page.waitForTimeout(400);
    return page.evaluate(() => [...document.querySelectorAll('#bagnoBody .ms-row')].map(x =>
      x.querySelector('.ms-t').textContent.replace(/^⭐\s*/, '').trim() + ' · ' + x.querySelector('.ms-w').textContent.trim()));
  };
  const quante = (lista, re) => lista.filter(x => re.test(x)).length;
  const cheVoci = p => p.evaluate(() => [...document.querySelectorAll('#mCerca .cerca-voce b')].map(b => b.textContent));

  // ── 1. il menu: le quattro nuove dopo il bancomat, e le prime sei dove stavano
  {
    /* Uno schermo piccolo: con dieci voci il menu non ci sta tutto, e
       l'ultima deve arrivarci un dito vero, non solo una funzione. */
    const p = await apri('svelto', { width: 360, height: 640 });
    await p.evaluate(() => apriCerca());
    await p.waitForTimeout(500);
    const voci = await cheVoci(p);
    ok('nel menu ci sono Supermarket, Farmacia, Ristorante e Bar, dopo il Bancomat',
       voci.slice(5).join('|') === 'Bancomat|Supermarket|Farmacia|Ristorante|Bar', voci.join(' | '));
    ok('e le prime sei non si sono spostate',
       voci.slice(0, 6).join('|') === 'Stazione dei treni|Metropolitana|Fermata del bus|Bagno pubblico|Area fumatori|Bancomat');
    let arrivato = true;
    try { await p.click('#mCerca .cerca-voce:has-text("Bar")', { timeout: 5000 }); } catch (e) { arrivato = false; }
    await p.waitForTimeout(600);
    const titolo = await p.evaluate(() => document.getElementById('bagnoTitle').textContent);
    ok('su un telefono piccolo l\'ultima voce, Bar, si tocca e apre la ricerca giusta',
       arrivato && /Bar più vicino/.test(titolo), arrivato ? titolo : 'non si riesce a toccarla');
    for (const [voce, re] of [['Supermarket', /Supermarket più vicino/], ['Farmacia', /Farmacia più vicina/], ['Ristorante', /Ristorante più vicino/]]) {
      await p.evaluate(() => { closeSheet('mBagno'); apriCerca(); });
      await p.waitForTimeout(400);
      await p.click(`#mCerca .cerca-voce:has-text("${voce}")`, { timeout: 5000 }).catch(() => {});
      await p.waitForTimeout(500);
      const t = await p.evaluate(() => document.getElementById('bagnoTitle').textContent);
      ok(`«${voce}» apre la sua ricerca`, re.test(t), t);
    }

    // ── la scritta della sezione, più scura
    const colori = await p.evaluate(() => {
      closeSheet('mBagno'); closeSheet('mCerca');
      const hh = document.querySelector('#homeHero .hh');
      /* Sopra una foto del cielo scura la scritta è bianca, e deve restare
         così: si misura il caso normale, su fondo chiaro. */
      if (hh) hh.classList.remove('cl-buio');
      const tinta = v => { const s = document.createElement('span'); s.style.color = `var(${v})`; document.body.appendChild(s);
        const c = getComputedStyle(s).color; s.remove(); return c; };
      const b = document.querySelector('#homeHero .hh-cerca');
      apriCerca();
      const i = document.querySelector('#mCerca .cerca-txt i');
      return { ink: tinta('--ink'), soft: tinta('--ink-soft'), faint: tinta('--ink-faint'),
        tasto: b ? getComputedStyle(b).color : 'manca',
        sotto: i ? getComputedStyle(i).color : 'manca' };
    });
    ok('in home «Cosa cerchi qui intorno?» è scritto col colore pieno, non col grigio',
       colori.tasto === colori.ink, `tasto ${colori.tasto}, pieno ${colori.ink}, grigio ${colori.soft}`);
    /* Più scura, non più grossa: in grassetto, accanto ad «A raccolta», la
       scritta andava a capo e il tasto raddoppiava (prova-tocchi). */
    await p.evaluate(() => closeSheet('mCerca'));
    await p.setViewportSize({ width: 390, height: 844 });
    await p.waitForTimeout(300);
    const alto = await p.evaluate(() => Math.round(document.querySelector('#homeHero .hh-cerca').getBoundingClientRect().height));
    ok('e su un telefono normale il tasto resta su una riga sola', alto <= 56, alto + ' px');
    ok('nel menu le righe sotto le voci sono un tono più scure',
       colori.sotto === colori.soft && colori.sotto !== colori.faint, `${colori.sotto} (prima ${colori.faint})`);
    await p.close();
  }

  // ── 2. ognuna trova quello che deve, e solo quello
  {
    const p = await apri('svelto');

    const spesa = await righe(p, 'super', 'Esselunga|non risulta');
    ok('supermarket: trova l\'Esselunga, con gli orari',
       spesa.some(x => /^Esselunga · 200 m.*orari: Mo-Sa 07:30-22:00/.test(x)), spesa.join(' | '));
    ok('lo stesso supermercato segnato come entrata e come edificio è una riga sola',
       !spesa.some(x => /^Esselunga · 300 m/.test(x)), spesa.join(' | '));
    ok('ma l\'altra Esselunga, in un\'altra via, c\'è', quante(spesa, /^Esselunga ·/) === 2, spesa.join(' | '));
    ok('e il minimarket non passa per supermarket', !spesa.some(x => /Carrefour Express/.test(x)));

    const farm = await righe(p, 'farmacia', 'Farmacia Centrale|non risulta');
    ok('farmacia: trova la più vicina, sempre aperta',
       /^Farmacia Centrale · 150 m.*sempre aperta/.test(farm[0] || ''), farm.join(' | '));
    ok('anche quella segnata solo come healthcare=pharmacy', farm.some(x => /Farmacia Comunale 5/.test(x)), farm.join(' | '));
    ok('e la parafarmacia dice che i farmaci con ricetta lì non ci sono',
       farm.some(x => /Parafarmacia Bio.*senza farmaci con ricetta/.test(x)), farm.join(' | '));

    p._domande = [];
    const cibo = await righe(p, 'ristorante', 'Da Mario|non risulta');
    ok('ristorante: dice la cucina, leggibile', cibo.some(x => /^Da Mario .*cucina: italian, pizza/.test(x)), cibo.join(' | '));
    ok('e se c\'è anche il vegetariano', cibo.some(x => /Da Mario.*anche vegetariano/.test(x)));
    ok('il fast food non è un ristorante', !cibo.some(x => /McDonald/.test(x)));
    /* In centro i ristoranti sono centinaia, e la mappa taglia PRIMA di
       ordinare per distanza: si parte da un giro stretto, e con un tetto
       piu' alto del solito. */
    const giri = p._domande.map(q => (/around:(\d+)/.exec(q) || [])[1]);
    const tetti = p._domande.map(q => (/out center (\d+)/.exec(q) || [])[1]);
    ok('si comincia da un giro stretto, cinquecento metri', giri[0] === '500', giri.join(','));
    ok('e la mappa può restituirne fino a quattrocento', tetti.length > 0 && tetti.every(t => t === '400'), tetti.join(','));

    p._domande = [];
    const bere = await righe(p, 'bar', 'Cocktail Lab|non risulta');
    ok('bar: il cocktail bar c\'è, coi tavoli fuori', bere.some(x => /^Cocktail Lab.*tavoli fuori/.test(x)), bere.join(' | '));
    ok('il pub c\'è, e dice che è un pub', bere.some(x => /^The Old Pub.*· pub/.test(x)), bere.join(' | '));
    ok('la birreria all\'aperto senza nome ha un nome che si capisce', bere.some(x => /^Birreria ·.*birreria all'aperto/.test(x)), bere.join(' | '));
    ok('il bar della colazione (amenity=cafe) non c\'è', !bere.some(x => /Bar Sport/.test(x)), bere.join(' | '));
    ok('e il barbiere nemmeno', !bere.some(x => /Barbiere/.test(x)));
    ok('queste voci non cercano per nome: «bar» sta dentro «Barbiere»',
       !p._domande.some(q => /\[~"/.test(q)), p._domande.filter(q => /\[~"/.test(q)).map(q => q.slice(0, 90)).join(' / '));
    await p.close();
  }

  // ── 3. la mappa è giù: lo stesso metodo delle altre, la ricerca veloce le trova
  {
    const p = await apri('giu');
    const spesa = await righe(p, 'super', 'Lidl', 40000);
    ok('con la mappa giù il supermarket si trova lo stesso', spesa.some(x => /^Lidl/.test(x)), spesa.join(' | '));
    const farm = await righe(p, 'farmacia', 'Farmacia della Stazione|Farmacia Moscova', 40000);
    ok('e la farmacia, da Photon e da Nominatim', farm.some(x => /Farmacia della Stazione/.test(x)) && farm.some(x => /Farmacia Moscova.*sempre aperta/.test(x)), farm.join(' | '));
    const cibo = await righe(p, 'ristorante', 'Trattoria del Ponte', 40000);
    ok('e il ristorante, con la cucina', cibo.some(x => /Trattoria del Ponte.*cucina: regional/.test(x)), cibo.join(' | '));
    await righe(p, 'bar', 'Negroni Club|Bar Basso', 40000);
    await p.waitForTimeout(1500);
    const bere2 = await p.evaluate(() => [...document.querySelectorAll('#bagnoBody .ms-row .ms-t')].map(x => x.textContent));
    ok('e il bar', bere2.some(x => /Negroni Club/.test(x)) && bere2.some(x => /Bar Basso/.test(x)), bere2.join(' | '));
    ok('ma anche dalla ricerca veloce il bar della colazione resta fuori',
       !bere2.some(x => /Bar Pasticceria|Bar Centrale/.test(x)), bere2.join(' | '));
    await p.close();
  }

  await browser.close();
  for (const e of err) r.push(' FALLITO  ' + e);
  console.log('\n' + r.join('\n'));
  const falliti = r.filter(x => x.includes('FALLITO')).length;
  console.log(`\n${r.length - falliti}/${r.length} passati`);
  process.exit(falliti ? 1 : 0);
})();
