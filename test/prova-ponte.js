/* IL PONTE fra l'app e la mappa, e la griglia che protegge la posizione.
 *
 * PERCHE' ESISTE IL PONTE. Overpass e Nominatim sono tenuti su da volontari,
 * e le loro regole dicono che un'app diffusa non deve chiamarli da ogni
 * telefono. Con l'app sullo store sarebbero migliaia di telefoni alla stessa
 * porta e la porta si chiude — per tutti. In mezzo c'e' una funzione su
 * Supabase che tiene la risposta una volta sola per tutti.
 *
 * QUI SI PROVANO TRE COSE, e la seconda e' la piu' importante:
 *   1. che l'app passi dal ponte, e che non chiami Overpass per conto suo
 *      quando il ponte risponde;
 *   2. che al ponte NON arrivi mai dove sei di preciso — la domanda si fa su
 *      una griglia di circa duecento metri, ed e' anche quello che fa
 *      combaciare le domande di due persone nello stesso isolato;
 *   3. che il ponte rotto non diventi un'app rotta: si torna a chiamare
 *      Overpass direttamente, come si e' sempre fatto.
 *
 * E si prova il controllo di sicurezza del ponte, che vive in un file a se'
 * (supabase/functions/vicini/domanda.mjs) apposta per poter essere provato
 * da qui: qui non c'e' Deno, e una regola di sicurezza che non si riesce a
 * provare e' una regola di cui non si sa niente. */
const { apriBrowser, APP, leafletJs } = require('./browser');
const fs = require('fs');

const IO = { lat: 45.59217, lng: 9.22839 };   /* un punto qualunque, non tondo */

const stato = {
  trips: [{
    id: 't1', name: 'Prova', destination: 'Muggiò', currency: 'EUR', status: 'open',
    start: '2026-09-01', end: '2026-09-02',
    participants: [{ id: 'p1', name: 'Gepp' }],
    suggested: [], pois: [], expenses: [], tickets: [], hotels: [], weather: {},
    createdAt: Date.now(),
    days: [{ id: 'd1', date: '2026-09-01', title: '', activities: [] }]
  }],
  currentTripId: 't1', settings: {}, myName: 'Gepp', skipAuth: true
};

(async () => {
  const browser = await apriBrowser();
  const r = [];
  const err = [];
  const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);

  // ══ IL CONTROLLO DI SICUREZZA DEL PONTE ══════════════════════════════
  /* Senza, il ponte sarebbe un Overpass aperto a chiunque: uno ci passa una
     domanda che legge mezzo pianeta e a farsi bloccare siamo noi, con la
     nostra identita' — quella che abbiamo messo apposta per essere
     riconoscibili. */
  const { domandaAmmessa } = await import('../supabase/functions/vicini/domanda.mjs');
  const buona = '[out:json][timeout:20];(nwr["amenity"="atm"](around:1500,45.592,9.228);nwr["atm"]["atm"!="no"](around:1500,45.592,9.228););out center 150;';
  ok('la domanda che fa l\'app passa', domandaAmmessa(buona) === null, String(domandaAmmessa(buona)));
  const cattive = [
    ['un giro grande come mezzo continente',
     '[out:json][timeout:20];(nwr["amenity"="atm"](around:900000,45.592,9.228););out center 150;'],
    ['una domanda che chiede centomila risultati',
     '[out:json][timeout:20];(nwr["amenity"="atm"](around:1500,45.592,9.228););out center 9999;'],
    ['una domanda senza il giro, cioè su tutto il pianeta',
     '[out:json][timeout:20];(nwr["amenity"="atm"];);out center 150;'],
    ['una che chiede il formato che vuole lei',
     '[out:csv(::id)][timeout:20];(nwr["amenity"="atm"](around:1500,45.592,9.228););out center 150;'],
    ['una che infila un secondo comando in coda',
     '[out:json][timeout:20];(nwr["amenity"="atm"](around:1500,45.592,9.228););out center 150;out meta;'],
    ['una che chiede di risalire alle relazioni (ricorsione)',
     '[out:json][timeout:20];(nwr["amenity"="atm"](around:1500,45.592,9.228);>;);out center 150;'],
    ['una lunghissima, per farci macinare a vuoto',
     '[out:json][timeout:20];(' + 'nwr["amenity"="atm"](around:1500,45.592,9.228);'.repeat(40) + ');out center 150;'],
    ['una che non è nemmeno testo', { q: 1 }]
  ];
  cattive.forEach(([che, q]) =>
    ok(`e ${che} viene respinta`, typeof domandaAmmessa(q) === 'string', String(domandaAmmessa(q))));

  // ══ E LE DOMANDE VERE, NON QUELLA SCRITTA QUI SOPRA ══════════════════
  /* La riga qui sopra guarda una domanda scritta a mano, che somiglia a
     quelle dell'app. Somigliare non basta: il giorno che una ricerca cambia
     forma — un filtro nuovo, una parentesi in piu' — il controllo del ponte
     la respingerebbe, il ponte direbbe di no a tutto, e il telefono
     ripiegherebbe in silenzio sulla strada diretta. Cioe' il ponte sarebbe
     spento senza che nessuno se ne accorga: nessun errore, solo l'app com'era
     prima. Percio' qui le domande NON si scrivono: si fanno fare all'app,
     tutte quelle di tutte le voci, e si passano al controllo vero. */
  {
    const pq = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const dette = [];
    await pq.route('**/leaflet@1.9.4/dist/leaflet.js', ro => ro.fulfill({
      status: 200, contentType: 'application/javascript', body: fs.readFileSync(leafletJs(), 'utf8') }));
    await pq.route('**/api/interpreter', ro => {
      dette.push(decodeURIComponent(ro.request().postData() || '').replace(/^data=/, ''));
      ro.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ elements: [] }) });
    });
    await pq.addInitScript(s => {
      localStorage.setItem('geppgo2', JSON.stringify(s));
      navigator.geolocation.getCurrentPosition = cb => cb({ coords: { latitude: 45.59217, longitude: 9.22839 } });
    }, stato);
    await pq.goto(APP, { waitUntil: 'domcontentloaded' });
    await pq.waitForFunction(() => typeof window.cercaVicino === 'function', { timeout: 20000 });
    /* Le voci si chiedono all'APP, non si elencano qui: una voce nuova
       entrerebbe in app e questa prova continuerebbe a controllare le
       vecchie, che e' il modo di avere una prova verde su un ponte rotto. */
    const voci = await pq.evaluate(() => Object.keys(VICINI));
    for (const k of voci) {
      await pq.evaluate(kk => { localStorage.removeItem(VICINI_CACHE_CHIAVE); myPos = null; myPosAt = 0; cercaVicino(kk); }, k);
      await pq.waitForFunction(() => !/Cerco/.test(document.getElementById('bagnoBody').innerText), { timeout: 90000 });
    }
    const uniche = [...new Set(dette)];
    const respinte = uniche.map(q => [q, domandaAmmessa(q)]).filter(([, g]) => g);
    ok('le voci da cercare si leggono dall\'app, non da qui', voci.length > 0, voci.join(' '));
    ok('e OGNI domanda che l\'app fa davvero passa il controllo del ponte',
       uniche.length > 0 && respinte.length === 0,
       respinte.length ? `respinta (${respinte[0][1]}): ${respinte[0][0].slice(0, 90)}`
                       : `${uniche.length} domande vere, nessuna respinta`);
    await pq.close();
  }

  // ══ IL PONTE DEVE STARE DENTRO LA PAZIENZA DEL TELEFONO ══════════════
  /* IL DIFETTO, trovato dal vivo: il ponte provava cinque server da
     venticinque secondi l'uno IN FILA — fino a due minuti — mentre il
     telefono lo aspettava ventuno. Quando la mappa arrancava il ponte
     perdeva sempre, per costruzione: il telefono lo mollava, lo segnava
     rotto per un minuto e tornava a chiamare da solo. Cioè il ponte non
     serviva proprio nel caso per cui esiste.
     I due numeri vivono in due file diversi — uno nell'app, uno nella
     funzione — e nessuno li confrontava. Adesso questa riga lo fa. */
  const tempiPonte = await import('../supabase/functions/vicini/domanda.mjs');
  {
    const p0 = await browser.newPage();
    /* Si blocca solo quello che uscirebbe davvero in rete, non tutto:
       bloccando tutto la pagina non si carica e la costante si legge
       `null` — cioè la prova diventa rossa per colpa sua. */
    await p0.route('**/leaflet@1.9.4/dist/leaflet.js', ro => ro.fulfill({
      status: 200, contentType: 'application/javascript', body: fs.readFileSync(leafletJs(), 'utf8') }));
    await p0.route(/tile\.openstreetmap\.org|api\.interpreter|nominatim|photon/, ro => ro.abort());
    await p0.goto(APP, { waitUntil: 'domcontentloaded' });
    await p0.waitForFunction(() => typeof VICINI_ATTESA_MS === 'number', { timeout: 20000 });
    const pazienza = await p0.evaluate(() => VICINI_ATTESA_MS);
    ok('il ponte fa in tempo, prima che il telefono si stanchi di aspettarlo',
       pazienza != null && tempiPonte.PONTE_BUDGET_MS < pazienza,
       `ponte al massimo ${tempiPonte.PONTE_BUDGET_MS}ms, telefono aspetta ${pazienza}ms`);
    /* E un server solo non si mangia tutto il budget: se no il secondo non
       verrebbe mai provato, e avere cinque indirizzi non servirebbe. */
    ok('e un server lento non si mangia tutto il tempo del ponte',
       tempiPonte.PONTE_ATTESA_SERVER_MS * 2 <= tempiPonte.PONTE_BUDGET_MS,
       `${tempiPonte.PONTE_ATTESA_SERVER_MS}ms per server su ${tempiPonte.PONTE_BUDGET_MS}ms`);
    await p0.close();
  }

  // ══ IL PONTE DEGLI INDIRIZZI (Nominatim, Photon) ═════════════════════
  /* E' il piu' urgente dei due: Nominatim e' usato in DICIASSETTE punti
     dell'app — la ricerca degli hotel, gli indirizzi, la città di ogni
     viaggio, la valuta — e permette UNA richiesta al secondo, sconsigliando
     l'uso da app diffuse. Sullo store sarebbe il primo a chiudersi, e con
     lui se ne andrebbe la ricerca degli alberghi. */
  const geo = await import('../supabase/functions/geo/domanda.mjs');
  const buoni = [
    'https://nominatim.openstreetmap.org/search?q=Colosseo&format=json&limit=1',
    'https://nominatim.openstreetmap.org/reverse?lat=45.592&lon=9.228&format=json',
    'https://photon.komoot.io/api/?q=Roma&limit=5'
  ];
  buoni.forEach(u => ok('l\'app può chiedere ' + new URL(u).pathname,
    geo.indirizzoAmmesso(u) === null, String(geo.indirizzoAmmesso(u))));
  const cattivi = [
    ['un sito qualunque', 'https://esempio.invalid/rubami'],
    ['una strada non prevista dello stesso servizio',
     'https://nominatim.openstreetmap.org/status.php?format=json'],
    ['senza cifratura', 'http://nominatim.openstreetmap.org/search?q=a&format=json'],
    ['con credenziali infilate dentro',
     'https://tizio:caio@nominatim.openstreetmap.org/search?q=a&format=json'],
    ['che si sceglie il formato che vuole',
     'https://nominatim.openstreetmap.org/search?q=a&format=xml'],
    ['che chiede di scaricare mezzo paese',
     'https://nominatim.openstreetmap.org/search?q=a&format=json&limit=500'],
    ['lunghissimo', 'https://nominatim.openstreetmap.org/search?format=json&q=' + 'a'.repeat(900)]
  ];
  cattivi.forEach(([che, u]) => ok(`e ${che} viene respinto`,
    typeof geo.indirizzoAmmesso(u) === 'string', String(geo.indirizzoAmmesso(u))));
  /* LA RIGA CHE TIENE IN PIEDI LA PROMESSA. Il telefono arrotonda la
     posizione prima di mandarla; il ponte NON si fida e ricontrolla. Se un
     domani l'app smettesse di arrotondare, il ponte rifiuterebbe invece di
     inoltrare la posizione esatta a Nominatim. */
  ok('e una posizione NON arrotondata viene respinta dal ponte',
     geo.posizioneArrotondata('https://nominatim.openstreetmap.org/reverse?lat=45.59217&lon=9.22839&format=json') === false);
  ok('mentre quella sulla griglia passa',
     geo.posizioneArrotondata('https://nominatim.openstreetmap.org/reverse?lat=45.592&lon=9.228&format=json') === true);

  // ══ L'APP E IL PONTE ═════════════════════════════════════════════════
  async function apri({ ponte }) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', e => err.push('PAGEERROR: ' + e.message.split('\n')[0]));
    await page.route('**/leaflet@1.9.4/dist/leaflet.js', ro => ro.fulfill({
      status: 200, contentType: 'application/javascript', body: fs.readFileSync(leafletJs(), 'utf8') }));
    await page.route(/tile\.openstreetmap\.org/, ro => ro.abort());
    page._ponte = [];
    page._diretto = [];
    await page.route('**/functions/v1/vicini', async route => {
      const corpo = JSON.parse(route.request().postData() || '{}');
      page._ponte.push(corpo.q || '');
      if (!ponte) return route.abort();
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ elements: [
          { type: 'node', id: 1, lat: IO.lat + 0.0009, lon: IO.lng,
            tags: { amenity: 'atm', name: 'Bancomat dal ponte' } }
        ], da: 'memoria' }) });
    });
    await page.route('**/api/interpreter', async route => {
      page._diretto.push(decodeURIComponent(route.request().postData() || ''));
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ elements: [
          { type: 'node', id: 2, lat: IO.lat + 0.001, lon: IO.lng,
            tags: { amenity: 'atm', name: 'Bancomat diretto' } }
        ] }) });
    });
    await page.addInitScript(([s, io]) => {
      localStorage.setItem('geppgo2', JSON.stringify(s));
      navigator.geolocation.getCurrentPosition = cb =>
        cb({ coords: { latitude: io.lat, longitude: io.lng } });
    }, [stato, IO]);
    await page.goto(APP, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.cercaVicino === 'function', { timeout: 20000 });
    await page.waitForFunction(() => !document.getElementById('bootSplash'), { timeout: 20000 });
    return page;
  }

  const cerca = async (page, kind) => {
    await page.evaluate(k => {
      localStorage.removeItem(VICINI_CACHE_CHIAVE);
      myPos = null; myPosAt = 0; ponteRotto = 0;
      closeSheet('mBagno'); cercaVicino(k);
    }, kind);
    await page.waitForFunction(
      () => { const b = document.getElementById('bagnoBody'); return b && !/Cerco|ci riprovo/i.test(b.innerText); },
      { timeout: 60000 }).catch(() => {});
    return page.evaluate(() => document.getElementById('bagnoBody').innerText.replace(/\s+/g, ' ').trim());
  };

  // ── 1. col ponte acceso, l'app passa di lì e basta ──────────────────
  let page = await apri({ ponte: true });
  let testo = await cerca(page, 'atm');
  ok('col ponte, la risposta arriva da lì', /Bancomat dal ponte/.test(testo), testo.slice(0, 70));
  /* Il punto di tutta l'opera: una ricerca, una richiesta — e quella
     richiesta quasi sempre non esce nemmeno, perché il ponte risponde dalla
     memoria comune. Se l'app chiamasse anche Overpass, il ponte non
     servirebbe a niente. */
  ok('e l\'app non chiama Overpass per conto suo',
     page._diretto.length === 0, page._diretto.length + ' chiamate dirette');

  // ── 2. AL PONTE NON ARRIVA DOVE SEI ─────────────────────────────────
  /* È la riga che tiene in piedi la promessa sulla privacy. La posizione
     vera ha sei decimali; quella che parte è su una griglia di circa
     duecento metri. Se un giorno qualcuno togliesse l'arrotondamento,
     l'app comincerebbe a mandare la posizione esatta a un server nostro
     senza che nessuno se ne accorga: qui diventa rosso. */
  const chiesto = page._ponte[0] || '';
  const punti = [...chiesto.matchAll(/around:\d+,(-?[\d.]+),(-?[\d.]+)/g)].map(m => [+m[1], +m[2]]);
  ok('al ponte è arrivata almeno una domanda', punti.length > 0, chiesto.slice(0, 80));
  const esatta = punti.some(([la, lo]) => la === IO.lat || lo === IO.lng);
  ok('e NON contiene la posizione esatta',
     !esatta, punti.length ? `mandato ${punti[0][0]},${punti[0][1]} — vero ${IO.lat},${IO.lng}` : '');
  /* Sulla griglia vuol dire multipli esatti del passo, non "un po'
     diversa": una posizione appena sporcata sarebbe comunque riconoscibile,
     e non farebbe combaciare due domande dallo stesso isolato. */
  const passo = await page.evaluate(() => VICINI_GRIGLIA);
  const sullaGriglia = punti.every(([la, lo]) =>
    Math.abs(la / passo - Math.round(la / passo)) < 1e-6 &&
    Math.abs(lo / passo - Math.round(lo / passo)) < 1e-6);
  ok('ma è un punto esatto della griglia, non una posizione sporcata',
     sullaGriglia, punti.map(p => p.join(',')).join(' | '));
  /* E lo spostamento resta piccolo: la griglia non deve spostare il giro
     tanto da farsi sfuggire quello che si cerca. */
  const scostamento = Math.round(Math.hypot(
    (punti[0][0] - IO.lat) * 111320,
    (punti[0][1] - IO.lng) * 111320 * Math.cos(IO.lat * Math.PI / 180)));
  ok('e il centro si sposta di meno di duecento metri',
     scostamento < 200, scostamento + ' m');
  await page.close();

  // ── 3. due persone nello stesso isolato fanno la STESSA domanda ─────
  /* È così che la memoria comune serve a qualcosa: se ognuno chiedesse dal
     proprio punto esatto, ogni domanda sarebbe diversa dalle altre e la
     memoria non troverebbe mai niente. */
  const vicino = { lat: IO.lat + 0.0004, lng: IO.lng - 0.0004 };   /* ~60 m più in là */
  const pagina2 = await browser.newPage({ viewport: { width: 390, height: 844 } });
  pagina2._ponte = [];
  await pagina2.route('**/leaflet@1.9.4/dist/leaflet.js', ro => ro.fulfill({
    status: 200, contentType: 'application/javascript', body: fs.readFileSync(leafletJs(), 'utf8') }));
  await pagina2.route(/tile\.openstreetmap\.org/, ro => ro.abort());
  await pagina2.route('**/functions/v1/vicini', async route => {
    pagina2._ponte.push(JSON.parse(route.request().postData() || '{}').q || '');
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ elements: [], da: 'memoria' }) });
  });
  await pagina2.route('**/api/interpreter', ro => ro.fulfill({
    status: 200, contentType: 'application/json', body: '{"elements":[]}' }));
  await pagina2.addInitScript(([s, p]) => {
    localStorage.setItem('geppgo2', JSON.stringify(s));
    navigator.geolocation.getCurrentPosition = cb =>
      cb({ coords: { latitude: p.lat, longitude: p.lng } });
  }, [stato, vicino]);
  await pagina2.goto(APP, { waitUntil: 'domcontentloaded' });
  await pagina2.waitForFunction(() => typeof window.cercaVicino === 'function', { timeout: 20000 });
  await pagina2.waitForFunction(() => !document.getElementById('bootSplash'), { timeout: 20000 });
  await cerca(pagina2, 'atm');
  ok('due persone a sessanta metri fanno la stessa identica domanda',
     pagina2._ponte[0] === chiesto,
     pagina2._ponte[0] === chiesto ? 'una sola risposta serve a tutti e due'
       : (pagina2._ponte[0] || '').slice(0, 60) + ' ≠ ' + chiesto.slice(0, 60));
  await pagina2.close();

  // ── 3-bis. GLI INDIRIZZI PASSANO DAVVERO DAL PONTE ──────────────────
  /* I ventun punti dell'app non chiamano più Nominatim: chiamano `fetchGeo`,
     che si usa come `fetch` ed è quello che li ha fatti passare tutti dal
     ponte senza rimaneggiarne ventuno a mano — che è il modo di introdurre
     un difetto proprio in quello che non si guarda. */
  const pg = await browser.newPage({ viewport: { width: 390, height: 844 } });
  pg._geo = []; pg._nominatim = [];
  await pg.route('**/leaflet@1.9.4/dist/leaflet.js', ro => ro.fulfill({
    status: 200, contentType: 'application/javascript', body: fs.readFileSync(leafletJs(), 'utf8') }));
  await pg.route(/tile\.openstreetmap\.org/, ro => ro.abort());
  await pg.route('**/functions/v1/geo', async route => {
    pg._geo.push(JSON.parse(route.request().postData() || '{}').url || '');
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ dati: [{ lat: '41.89', lon: '12.49', display_name: 'Colosseo dal ponte' }], da: 'memoria' }) });
  });
  await pg.route(/nominatim\.openstreetmap\.org/, async route => {
    pg._nominatim.push(route.request().url());
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await pg.addInitScript(s2 => localStorage.setItem('geppgo2', JSON.stringify(s2)), stato);
  await pg.goto(APP, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => typeof window.fetchGeo === 'function', { timeout: 20000 });
  await pg.waitForFunction(() => !document.getElementById('bootSplash'), { timeout: 20000 });

  const risposta = await pg.evaluate(async () => {
    const r = await fetchGeo('https://nominatim.openstreetmap.org/search?q=Colosseo&format=json&limit=1');
    return (await r.json())[0];
  });
  ok('una ricerca di indirizzo passa dal ponte',
     risposta && /Colosseo dal ponte/.test(risposta.display_name || ''), JSON.stringify(risposta).slice(0, 60));
  ok('e Nominatim non viene chiamato direttamente',
     pg._nominatim.length === 0, pg._nominatim.length + ' chiamate dirette');

  /* E anche qui la posizione si arrotonda prima di partire: «dov'è questo
     punto» è una domanda che contiene dove sei. */
  await pg.evaluate(() => fetchGeo('https://nominatim.openstreetmap.org/reverse?lat=45.59217&lon=9.22839&format=json').then(r => r.json()));
  const inverso = pg._geo.find(u => /reverse/.test(u)) || '';
  ok('e una domanda «dov\'è questo punto» parte arrotondata',
     /lat=45\.592(&|$)/.test(inverso) && !/45\.59217/.test(inverso), inverso.slice(-60));
  await pg.close();

  // ── 4. ponte rotto ≠ app rotta ──────────────────────────────────────
  page = await apri({ ponte: false });
  testo = await cerca(page, 'atm');
  ok('col ponte giù si torna a chiamare la mappa direttamente',
     /Bancomat diretto/.test(testo), testo.slice(0, 70));
  ok('e ci si è provati, prima di arrendersi al diretto',
     page._ponte.length > 0, page._ponte.length + ' tentativi sul ponte');
  await page.close();

  // ── 5. «STO ANCORA CERCANDO» NON È «SONO ROTTO» ─────────────────────
  /* Il caso segnalato dal vivo: «non voglio che mi dica non ho trovato
     niente riprova — deve riprovare lui». Quando la mappa arranca il ponte
     non si arrende: continua a cercare in sottofondo, scrive la risposta
     nella memoria comune, e intanto dice al telefono che sta ancora
     cercando. Da qui devono seguire due cose, e sono la ragione di queste
     righe:
       - il ponte NON va messo in castigo: è vivo, sta lavorando, e metterlo
         in castigo vorrebbe dire buttare via proprio il lavoro che sta
         facendo per noi;
       - l'app deve riprovare DA SOLA, perché fra qualche secondo la
         risposta è lì pronta, e chiedere alla persona di premere un tasto
         è chiederle di fare il lavoro dell'app. */
  {
    const pa = await browser.newPage({ viewport: { width: 390, height: 844 } });
    pa.on('pageerror', e => err.push('PAGEERROR: ' + e.message.split('\n')[0]));
    const alPonte = [];
    await pa.route('**/leaflet@1.9.4/dist/leaflet.js', ro => ro.fulfill({
      status: 200, contentType: 'application/javascript', body: fs.readFileSync(leafletJs(), 'utf8') }));
    await pa.route(/tile\.openstreetmap\.org/, ro => ro.abort());
    await pa.route('**/functions/v1/vicini', async route => {
      alPonte.push(Date.now());
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ ancora: true, errore: 'overpass lento', dopo: 50 }) });
    });
    /* E la mappa diretta è giù davvero: così la ricerca finisce a mani
       vuote ed è il caso che interessa. */
    await pa.route('**/api/interpreter', ro => ro.fulfill({ status: 504, body: 'gateway timeout' }));
    await pa.addInitScript(([s, io]) => {
      localStorage.setItem('geppgo2', JSON.stringify(s));
      navigator.geolocation.getCurrentPosition = cb =>
        cb({ coords: { latitude: io.lat, longitude: io.lng } });
    }, [stato, IO]);
    await pa.goto(APP, { waitUntil: 'domcontentloaded' });
    await pa.waitForFunction(() => typeof window.cercaVicino === 'function', { timeout: 20000 });
    await pa.waitForFunction(() => !document.getElementById('bootSplash'), { timeout: 20000 });

    await pa.evaluate(() => {
      localStorage.removeItem(VICINI_CACHE_CHIAVE);
      myPos = null; myPosAt = 0; ponteRotto = 0; ponteAncora = 0;
      cercaVicino('atm');
    });
    await pa.waitForFunction(
      () => /riprovo da solo/i.test(document.getElementById('bagnoBody').innerText),
      { timeout: 60000 }).catch(() => {});
    const dice = await pa.evaluate(() => document.getElementById('bagnoBody').innerText.replace(/\s+/g, ' ').trim());
    ok('quando il ponte sta ancora cercando, l\'app lo dice e non dà la colpa a nessuno',
       /riprovo da solo/i.test(dice), dice.slice(0, 90));
    /* Un numero che scende è la differenza fra «sta lavorando» e «è
       bloccata»: senza, lo schermo resta fermo nove secondi. */
    ok('e si vede quanto manca, invece di uno schermo fermo',
       /fra \d+ second/i.test(dice), (dice.match(/fra \d+ second\w*/i) || [''])[0]);
    ok('il ponte NON viene messo in castigo: è vivo, sta cercando',
       await pa.evaluate(() => ponteRotto) === 0);

    /* LA RIGA CHE LA PERSONA HA CHIESTO. Non si tocca niente e si aspetta:
       la seconda richiesta al ponte deve partire DA SOLA. */
    const primaDi = alPonte.length;
    /* Si aspetta quanto l'APP dice di voler aspettare, non un numero
       scritto qui: cambiandolo nell'app, una prova con la sua attesa
       scritta a mano diventerebbe rossa senza che niente sia rotto. */
    const quanto = await pa.evaluate(() => VICINI_RIPROVA_MS);
    await pa.waitForFunction(n => window.__nonEsiste === n, primaDi, { timeout: quanto + 4000 })
      .catch(() => {});
    ok('e riprova DA SOLA, senza che nessuno prema niente',
       alPonte.length > primaDi, `${primaDi} → ${alPonte.length} richieste al ponte`);
    const riprove = await pa.evaluate(() => vicinoRiprove);
    const tetto = await pa.evaluate(() => VICINI_RIPROVE_MAX);
    ok('ma non all\'infinito: qualche riprova e poi si dice com\'è andata',
       riprove <= tetto, `${riprove} riprove su un tetto di ${tetto}`);

    /* E chiudendo la scheda si smette di aspettare: una riprova che
       riapre un foglio appena chiuso è un'app che non ascolta. */
    await pa.evaluate(() => { closeSheet('mBagno'); });
    const fermi = await pa.evaluate(() => vicinoAttesa === null && vicinoConto === null);
    ok('e chiudendo la scheda l\'app smette di aspettare', fermi === true);
    await pa.close();
  }

  await browser.close();
  for (const e of err) r.push(' FALLITO  ' + e);
  const passati = r.filter(x => x.startsWith('  OK')).length;
  console.log(r.join('\n'));
  console.log(`\n${passati}/${r.length} passati`);
  process.exit(passati === r.length ? 0 : 1);
})();
