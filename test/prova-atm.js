const { apriBrowser, APP, RADICE } = require('./browser');
const OUT = '/tmp/claude-0/-home-user-GeppGo/63cda2c7-b8e3-5374-b037-1b6d541802ce/scratchpad';

const stato = {
  trips: [{
    id: 't1', name: 'Prova', destination: 'Tokyo', currency: 'JPY', status: 'open',
    start: '2026-09-01', end: '2026-09-02',
    participants: [{ id: 'p1', name: 'Gepp' }],
    suggested: [], pois: [], expenses: [], tickets: [], weather: {}, createdAt: Date.now(),
    days: [{ id: 'd1', date: '2026-09-01', title: '', activities: [] }]
  }],
  currentTripId: 't1', settings: { proxRadius: 200 }, myName: 'Gepp'
};

(async () => {
  const browser = await apriBrowser();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const err = [];
  page.on('pageerror', e => err.push('PAGEERROR: ' + e.message));

  // Overpass non è raggiungibile da qui: si intercetta e si risponde come farebbe lui,
  // così si prova per davvero la catena "domanda → risposta → schede a schermo".
  let ultimaQuery = null;
  await page.route('**/api/interpreter', async route => {
    ultimaQuery = decodeURIComponent(route.request().postData() || '').replace(/^data=/, '');
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ elements: [
        { type: 'node', id: 1, lat: 35.6586, lon: 139.7454,
          tags: { amenity: 'atm', operator: 'Seven Bank', opening_hours: '24/7', fee: 'no' } },
        { type: 'way', id: 2, center: { lat: 35.6600, lon: 139.7470 },
          tags: { amenity: 'bank', atm: 'yes', name: 'MUFG Bank', wheelchair: 'yes' } },
        { type: 'node', id: 3, lat: 35.6700, lon: 139.7500,
          tags: { shop: 'convenience', atm: 'yes', name: 'FamilyMart', opening_hours: '24/7' } }
      ] })
    });
  });

  await page.addInitScript(s => {
    localStorage.setItem('geppgo2', JSON.stringify(s));
    // GPS finto: Asakusa
    navigator.geolocation.getCurrentPosition = cb =>
      cb({ coords: { latitude: 35.6595, longitude: 139.7454 } });
  }, stato);
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.cercaVicino === 'function', { timeout: 15000 });

  const r = [];
  const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);

  // ── la voce esiste ed è completa come le altre ───────────────────────
  const forma = await page.evaluate(() => {
    const campi = ['ic', 'titolo', 'cosa', 'manca', 'q', 'nome', 'extra', 'vuoto'];
    const mancanti = {};
    Object.keys(VICINI).forEach(k => {
      mancanti[k] = campi.filter(c => VICINI[k][c] == null);
    });
    return { chiavi: Object.keys(VICINI), mancanti };
  });
  ok('c\'è la voce atm accanto a bagno e fumo', forma.chiavi.join(',') === 'bagno,fumo,atm', forma.chiavi.join(','));
  ok('e nessuna delle tre ha campi mancanti', Object.values(forma.mancanti).every(x => x.length === 0), JSON.stringify(forma.mancanti));

  // ── il tasto in Home ─────────────────────────────────────────────────
  const tasto = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.hh-act')].find(x => /Bancomat/.test(x.textContent));
    return b ? { testo: b.textContent.trim(), onclick: b.getAttribute('onclick') } : null;
  });
  ok('il tasto Bancomat c\'è in Home', !!tasto, tasto ? tasto.testo : 'non trovato');
  ok('e chiama la ricerca giusta', tasto && tasto.onclick === 'cercaAtm()', tasto ? tasto.onclick : '');

  // sta in fila con le altre due ricerche di cosa c'è qui intorno
  const fila = await page.evaluate(() =>
    [...document.querySelectorAll('.hh-acts .hh-act')].map(x => x.textContent.trim()));
  const iFumo = fila.findIndex(x => /Area fumatori/.test(x));
  const iAtm = fila.findIndex(x => /Bancomat/.test(x));
  ok('viene subito dopo "Area fumatori", con le altre ricerche', iFumo >= 0 && iAtm === iFumo + 1, fila.join(' | '));

  // com'è la home con il tasto al suo posto (aspettando che lo splash se ne vada)
  await page.waitForFunction(() => {
    const b = [...document.querySelectorAll('.hh-acts .hh-act')].find(x => /Bancomat/.test(x.textContent));
    if (!b) return false;
    const r = b.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
  }, { timeout: 15000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/atm-home.png` });

  // ── la ricerca vera ──────────────────────────────────────────────────
  await page.evaluate(() => cercaAtm());
  await page.waitForFunction(() => /Seven Bank|FamilyMart|non risulta/.test(document.getElementById('bagnoBody').innerHTML), { timeout: 10000 });
  await page.waitForTimeout(300);

  ok('la domanda a Overpass chiede gli sportelli a sé', /amenity"="atm"/.test(ultimaQuery));
  // il tag "atm" con QUALSIASI valore: esistono anche atm=only e atm=separate
  ok('e anche banche e negozi che ne hanno uno dentro', /\["atm"\]/.test(ultimaQuery));
  // le sigle vivono nella ricerca per nome, che ora è una richiesta a sé e parte
  // solo quando per tipo non si trova abbastanza: si controlla la fonte
  const sigle = await page.evaluate(() => PAROLE_BANCA);
  ok('e le banche note solo per sigla', /bpm/.test(sigle) && /hsbc/.test(sigle), sigle.slice(-60));
  ok('cerca sia i punti sia gli edifici', /^.*node\[.*way\[/s.test(ultimaQuery));

  const titolo = await page.evaluate(() => document.getElementById('bagnoTitle').textContent);
  ok('il titolo del pannello è quello del bancomat', /Bancomat/.test(titolo), titolo);

  const html = await page.evaluate(() => document.getElementById('bagnoBody').innerHTML);
  const testo = await page.evaluate(() => document.getElementById('bagnoBody').innerText);
  ok('il più vicino è in cima con la stella', /⭐/.test(html));
  ok('lo sportello Seven Bank c\'è', /Seven Bank/.test(testo));
  ok('la banca col bancomat dentro c\'è', /MUFG Bank/.test(testo));
  ok('e il minimarket pure', /FamilyMart/.test(testo));
  ok('dice "sempre aperto" quando è 24/7', /sempre aperto/.test(testo));
  ok('dice dov\'è quando sta dentro qualcosa', /dentro la banca/.test(testo) && /dentro un minimarket/.test(testo));
  ok('non scrive "dentro" per lo sportello a sé stante',
     !/Seven Bank[\s\S]{0,80}dentro/.test(testo));
  ok('senza commissione quando fee=no', /senza commissione/.test(testo));
  ok('distanza e minuti a piedi ci sono', /m · \d+ min a piedi/.test(testo));
  ok('c\'è il tasto per farsi portare', /openNav\(/.test(html));

  await page.screenshot({ path: `${OUT}/atm-risultati.png` });

  // ── l'assistente ─────────────────────────────────────────────────────
  const frasi = await page.evaluate(() => ({
    si: ['dove trovo un bancomat?', 'dove posso prelevare?', 'c\'è un ATM qui vicino?',
         'mi serve uno sportello automatico', 'where is a cash machine'].map(sembraCercaAtm),
    no: ['quanto abbiamo speso in contanti?', 'dividiamo i soldi domani',
         'che ore sono?', 'aggiungi una spesa di 20 euro'].map(sembraCercaAtm)
  }));
  ok('riconosce le richieste di bancomat', frasi.si.every(Boolean), JSON.stringify(frasi.si));
  ok('e non scatta sulle frasi che parlano di soldi per altro', frasi.no.every(x => !x), JSON.stringify(frasi.no));

  // ── senza GPS il messaggio parla di bancomat, non di aree fumatori ───
  const msg = await page.evaluate(() => {
    vicinoKind = 'atm'; vicinoNienteGps();
    return document.getElementById('bagnoBody').innerText;
  });
  ok('senza GPS il messaggio parla del bancomat', /il bancomat più vicino/.test(msg), msg.split('\n')[0].slice(0, 70));
  const msgF = await page.evaluate(() => {
    vicinoKind = 'fumo'; vicinoNienteGps();
    return document.getElementById('bagnoBody').innerText;
  });
  ok('e per le aree fumatori è rimasto giusto', /l'area fumatori più vicina/.test(msgF), msgF.split('\n')[0].slice(0, 70));

  // ── le due ricerche di prima non si sono rotte ───────────────────────
  await page.evaluate(() => cercaBagno());
  await page.waitForTimeout(600);
  const tB = await page.evaluate(() => document.getElementById('bagnoTitle').textContent);
  ok('la ricerca bagni funziona ancora', /Bagno più vicino/.test(tB), tB);
  ok('e chiede i gabinetti, non i bancomat', /amenity"="toilets"/.test(ultimaQuery) && !/atm/.test(ultimaQuery));

  console.log('\n' + r.join('\n'));
  const falliti = r.filter(x => x.includes('FALLITO')).length;
  console.log(`\n${r.length - falliti}/${r.length} passati`);
  if (err.length) console.log('\nErrori in pagina:\n' + err.join('\n'));
  await browser.close();
  process.exit(falliti ? 1 : 0);
})();
