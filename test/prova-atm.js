const { apriBrowser, APP, RADICE, cartellaFoto } = require('./browser');
const OUT = cartellaFoto();

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
  /* Adesso le ricerche sono sei e l'ordine della tabella non e' quello in
     cui compaiono a schermo: quello lo decide il foglio «Cosa cerchi», e
     si controlla li' sotto. Qui basta che la voce ci sia. */
  ok('c\'è la voce atm insieme alle altre ricerche',
     forma.chiavi.indexOf('atm') >= 0 && forma.chiavi.length >= 6, forma.chiavi.join(','));
  ok('e nessuna delle tre ha campi mancanti', Object.values(forma.mancanti).every(x => x.length === 0), JSON.stringify(forma.mancanti));

  // ── dove si arriva al Bancomat ───────────────────────────────────────
  /* In home non c'e' piu' una pillola per ricerca: c'era una fila di sei
     tasti con l'emoji davanti, e cinque di quei sei facevano la stessa
     identica cosa - cercare qualcosa qui intorno. Adesso c'e' un tasto
     solo che chiede «cosa cerchi», e le sei risposte stanno dentro. */
  const porta = await page.evaluate(() => {
    const b = document.querySelector('#homeHero .hh-cerca');
    return b ? { testo: b.textContent.trim(), onclick: b.getAttribute('onclick') } : null;
  });
  ok('in home c\'è il tasto che chiede cosa cerchi', !!porta, porta ? porta.testo : 'non trovato');
  ok('e apre l\'elenco', porta && porta.onclick === 'apriCerca()', porta ? porta.onclick : '');

  const fila = await page.evaluate(async () => {
    apriCerca();
    await new Promise(r2 => setTimeout(r2, 500));
    return [...document.querySelectorAll('#mCerca .cerca-voce')].map(x => ({
      testo: (x.querySelector('b') || {}).textContent || '',
      onclick: x.getAttribute('onclick') || ''
    }));
  });
  const iAtm = fila.findIndex(x => /Bancomat/.test(x.testo));
  ok('il Bancomat è nell\'elenco', iAtm >= 0, fila.map(x => x.testo).join(' | '));
  ok('e chiama la ricerca giusta', iAtm >= 0 && /cercaAtm\(\)/.test(fila[iAtm].onclick),
     iAtm >= 0 ? fila[iAtm].onclick : '');
  /* L'ordine e' quello con cui le cose servono in viaggio: prima come ci
     si muove, poi i bisogni. Il bancomat sta in fondo perche' e' l'unico
     che si puo' risolvere anche in un altro modo. */
  ok('l\'elenco parte dai trasporti e finisce col bancomat',
     fila.map(x => x.testo).join('|') === ['Stazione dei treni', 'Metropolitana', 'Fermata del bus',
       'Bagno pubblico', 'Area fumatori', 'Bancomat'].join('|'),
     fila.map(x => x.testo).join(' | '));
  await page.screenshot({ path: `${OUT}/atm-home.png` });
  await page.evaluate(() => closeSheet('mCerca'));
  await page.waitForTimeout(400);

  // ── la ricerca vera ──────────────────────────────────────────────────
  await page.evaluate(() => cercaAtm());
  await page.waitForFunction(() => /Seven Bank|FamilyMart|non risulta/.test(document.getElementById('bagnoBody').innerHTML), { timeout: 10000 });
  await page.waitForTimeout(300);

  /* Non "c'e' dentro questa stringa" ma "chiede questa cosa": i valori
     della stessa chiave adesso si chiedono insieme - amenity~"^(atm|bank|
     bureau_de_change)$" - e la vecchia riga diventava rossa pur cercando
     esattamente le stesse cose. */
  const chiede = (q, chiave, valore) =>
    new RegExp('"' + chiave + '"\\s*=\\s*"' + valore + '"').test(q) ||
    new RegExp('"' + chiave + '"\\s*~\\s*"[^"]*\\b' + valore + '\\b').test(q);
  ok('la domanda a Overpass chiede gli sportelli a sé', chiede(ultimaQuery, 'amenity', 'atm'),
     ultimaQuery.slice(0, 80));
  // il tag "atm" con QUALSIASI valore: esistono anche atm=only e atm=separate
  ok('e anche banche e negozi che ne hanno uno dentro', /\["atm"\]/.test(ultimaQuery));
  // le sigle vivono nella ricerca per nome, che ora è una richiesta a sé e parte
  // solo quando per tipo non si trova abbastanza: si controlla la fonte
  const sigle = await page.evaluate(() => PAROLE_BANCA);
  ok('e le banche note solo per sigla', /bpm/.test(sigle) && /hsbc/.test(sigle), sigle.slice(-60));
  ok('cerca sia i punti sia gli edifici',
     /\bnwr\[/.test(ultimaQuery) || /node\[[\s\S]*way\[/.test(ultimaQuery),
     ultimaQuery.slice(0, 60));

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
