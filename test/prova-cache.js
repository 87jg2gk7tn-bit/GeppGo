const { apriBrowser, APP } = require('./browser');

const stato = {
  trips: [{ id: 101, name: 'Prova', destination: 'Tokyo', currency: 'JPY', status: 'open',
    participants: [{ id: 1, name: 'Gepp', isMe: true }],
    suggested: [], pois: [], expenses: [], tickets: [], weather: {},
    days: [{ id: 1, date: '2026-09-01', title: '', activities: [] }], createdAt: Date.now() }],
  currentTripId: 101, settings: { proxRadius: 200 }, myName: 'Gepp'
};

(async () => {
  const browser = await apriBrowser();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const err = [];
  page.on('pageerror', e => err.push('PAGEERROR: ' + e.message));

  // Overpass non è raggiungibile da qui, e non deve esserlo: si conta quante
  // volte l'app prova a chiamarlo, che è esattamente quello che la cache serve
  // a ridurre.
  let chiamate = 0;
  await page.route('**/api/interpreter', async route => {
    chiamate++;
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ elements: [
        { type: 'node', id: 1, lat: 35.6586, lon: 139.7454, tags: { amenity: 'atm', operator: 'Seven Bank' } }
      ] })
    });
  });

  await page.addInitScript(s => {
    localStorage.setItem('geppgo2', JSON.stringify(s));
    navigator.geolocation.getCurrentPosition = cb => cb({ coords: { latitude: 35.6595, longitude: 139.7454 } });
  }, stato);
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof myPos !== 'undefined', { timeout: 20000 });

  const r = [];
  const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);

  const cerca = (lat, lng, kind = 'atm', raggio = 1500) =>
    page.evaluate(([la, lo, k, rr]) => viciniOverpass(k, la, lo, rr, false), [lat, lng, kind, raggio]);

  // ── la prima volta si chiede davvero ─────────────────────────────────────
  await page.evaluate(() => localStorage.removeItem('geppgo_vicini'));
  chiamate = 0;
  const primo = await cerca(35.6595, 139.7454);
  ok('la prima ricerca chiede a Overpass', chiamate === 1, chiamate + ' chiamate');
  ok('e trova quello che deve', primo.length === 1 && /Seven Bank/.test(primo[0].nome), JSON.stringify(primo[0] && primo[0].nome));

  // ── la seconda no ────────────────────────────────────────────────────────
  const secondo = await cerca(35.6595, 139.7454);
  ok('la stessa ricerca non ne fa una seconda', chiamate === 1, chiamate + ' chiamate in tutto');
  ok('e restituisce le stesse cose', JSON.stringify(secondo) === JSON.stringify(primo));

  // ── qualche passo più in là è la stessa ricerca ──────────────────────────
  // 0,0002 gradi ≈ 20 metri
  await cerca(35.6597, 139.7456);
  ok('spostandosi di venti metri non si richiede niente', chiamate === 1, chiamate + ' chiamate');

  // ── un chilometro più in là no ───────────────────────────────────────────
  await cerca(35.6700, 139.7600);
  ok('un chilometro più in là si richiede', chiamate === 2, chiamate + ' chiamate');

  // ── e una cosa diversa nemmeno ───────────────────────────────────────────
  await cerca(35.6595, 139.7454, 'bagno');
  ok('cercare un bagno non riusa la risposta dei bancomat', chiamate === 3, chiamate + ' chiamate');

  // ── un raggio diverso è una ricerca diversa ──────────────────────────────
  await cerca(35.6595, 139.7454, 'atm', 5000);
  ok('e nemmeno un raggio più largo', chiamate === 4, chiamate + ' chiamate');

  // ── quando scade, si richiede ────────────────────────────────────────────
  const scaduta = await page.evaluate(() => {
    const c = JSON.parse(localStorage.getItem('geppgo_vicini'));
    Object.keys(c).forEach(k => { c[k].quando = Date.now() - 25 * 3600 * 1000; });
    localStorage.setItem('geppgo_vicini', JSON.stringify(c));
    return Object.keys(c).length;
  });
  await cerca(35.6595, 139.7454);
  ok('dopo un giorno si richiede', chiamate === 5, chiamate + ' chiamate, ' + scaduta + ' voci invecchiate');

  // ── "qui non c'è niente" si tiene per meno ───────────────────────────────
  const vuoto = await page.evaluate(() => {
    localStorage.removeItem('geppgo_vicini');
    return true;
  });
  await page.unroute('**/api/interpreter');
  let vuote = 0;
  await page.route('**/api/interpreter', async route => {
    vuote++;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ elements: [] }) });
  });
  await cerca(35.9000, 139.9000);
  ok('una ricerca a vuoto si fa una volta', vuote === 1, vuote + ' chiamate');
  await cerca(35.9000, 139.9000);
  ok('e subito dopo non si rifà', vuote === 1, vuote + ' chiamate');
  await page.evaluate(() => {
    const c = JSON.parse(localStorage.getItem('geppgo_vicini'));
    Object.keys(c).forEach(k => { c[k].quando = Date.now() - 2 * 3600 * 1000; });
    localStorage.setItem('geppgo_vicini', JSON.stringify(c));
  });
  await cerca(35.9000, 139.9000);
  ok('ma dopo un\'ora sì, perché "non c\'è niente" si ricontrolla volentieri',
     vuote === 2, vuote + ' chiamate');

  // ── la cache non cresce all'infinito ─────────────────────────────────────
  const tetto = await page.evaluate(async () => {
    localStorage.removeItem('geppgo_vicini');
    for (let i = 0; i < 70; i++) viciniCacheScrivi('atm', 10 + i * 0.5, 10, 1500, false, [{ nome: 'x' }]);
    return Object.keys(JSON.parse(localStorage.getItem('geppgo_vicini'))).length;
  });
  ok('la cache non cresce oltre il tetto', tetto === 60, tetto + ' voci su 70 scritte');

  const vecchie = await page.evaluate(() => {
    const c = JSON.parse(localStorage.getItem('geppgo_vicini'));
    // le prime scritte sono le più vecchie: devono essere quelle buttate
    const q = Object.values(c).map(x => x.lat).sort((a, b) => a - b);
    return { primaC: q.includes(10), ultimaC: q.includes(10 + 69 * 0.5) };
  });
  ok('e butta via le più vecchie, non le più fresche',
     vecchie.primaC === false && vecchie.ultimaC === true, JSON.stringify(vecchie));

  // ── se la memoria è piena, la cache si fa da parte ───────────────────────
  const piena = await page.evaluate(() => {
    const vero = localStorage.setItem.bind(localStorage);
    localStorage.setItem = (k, v) => { if (k === 'geppgo_vicini') throw new Error('QuotaExceededError'); return vero(k, v); };
    let esploso = false;
    try { viciniCacheScrivi('atm', 50, 50, 1500, false, [{ nome: 'y' }]); } catch (e) { esploso = true; }
    localStorage.setItem = vero;
    return { esploso, restata: localStorage.getItem('geppgo_vicini') };
  });
  ok('con la memoria piena non si rompe niente', piena.esploso === false);
  ok('e la cache si toglie di mezzo invece di rubare spazio ai viaggi',
     piena.restata === null, String(piena.restata).slice(0, 30));

  console.log('\n' + r.join('\n'));
  const falliti = r.filter(x => x.includes('FALLITO')).length;
  console.log(`\n${r.length - falliti}/${r.length} passati`);
  if (err.length) console.log('\nErrori in pagina:\n' + err.join('\n'));
  await browser.close();
  process.exit(falliti ? 1 : 0);
})();
