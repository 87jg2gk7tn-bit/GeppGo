/* «Cosa cerchi qui intorno»: quello che si deve trovare, quello che NON si
   deve trovare, e cosa succede quando il servizio della mappa non risponde.

   QUATTRO COSE SEGNALATE DAL VIVO, a Muggiò:
   1. la metropolitana rispondeva «Non riesco a raggiungere la mappa»;
   2. cercando la stazione dei treni usciva al primo posto, con la stellina,
      la «Stazione Carabinieri Muggiò» a 195 metri — da lì non parte nessun
      treno;
   3. la fermata del bus a cento metri non veniva trovata;
   4. il bancomat sotto casa nemmeno.

   Ognuna aveva una causa diversa, e sono tutte qui sotto.

   Il finto Overpass legge la domanda per davvero (test/overpass-finto.js):
   tipo, raggio e TUTTI i filtri di ogni enunciato, comprese la presenza di
   una chiave e la negazione. Senza quello, metà di queste righe passerebbe
   anche sul codice rotto. */
const { apriBrowser, APP, leafletJs } = require('./browser');
const { rispondi } = require('./overpass-finto');
const fs = require('fs');

/* Muggiò, dove il difetto è stato visto. */
const IO = { lat: 45.5920, lng: 9.2280 };
/* Sposta un punto di tot metri verso nord: serve a mettere le cose a
   distanze precise, che è quello che queste prove misurano. */
const su = m => IO.lat + m / 111320;

const stato = {
  trips: [{
    id: 't1', name: 'Prova', destination: 'Muggiò', currency: 'EUR', status: 'open',
    start: '2026-09-01', end: '2026-09-02',
    participants: [{ id: 'p1', name: 'Gepp' }],
    suggested: [], pois: [], expenses: [], tickets: [], hotels: [], weather: {},
    createdAt: Date.now(),
    days: [{ id: 'd1', date: '2026-09-01', title: '', activities: [] }]
  }],
  currentTripId: 't1', settings: { proxRadius: 200 }, myName: 'Gepp', skipAuth: true
};

(async () => {
  const browser = await apriBrowser();
  const r = [];
  const err = [];
  const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);

  async function apri(mondo, opts = {}) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', e => err.push('PAGEERROR: ' + e.message.split('\n')[0]));
    await page.route('**/leaflet@1.9.4/dist/leaflet.js', ro => ro.fulfill({
      status: 200, contentType: 'application/javascript', body: fs.readFileSync(leafletJs(), 'utf8') }));
    await page.route(/tile\.openstreetmap\.org/, ro => ro.abort());
    page._chiamate = [];
    await page.route('**/api/interpreter', async route => {
      const q = decodeURIComponent(route.request().postData() || '').replace(/^data=/, '');
      const n = page._chiamate.push({ q, host: new URL(route.request().url()).host });
      /* «I primi tot tentativi vanno male»: è così che si mette in scena un
         servizio che arranca, invece di sperare che arranchi. */
      if (opts.fallisciPrime && n <= opts.fallisciPrime)
        return route.fulfill({ status: 429, body: 'too many requests' });
      let dentro;
      try { dentro = rispondi(q, mondo); }
      catch (e) { err.push('DOMANDA ILLEGGIBILE: ' + e.message); dentro = []; }
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ elements: dentro }) });
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

  /* `tieni` serve alle prove del ripiego: li' la memoria della ricerca di
     prima E' il soggetto, e cancellarla vorrebbe dire provare il vuoto. */
  const cerca = async (page, kind, tieni) => {
    page._chiamate = [];
    await page.evaluate(([k, tieni]) => {
      /* Il nome della cache si chiede all'app: cambia apposta quando si
         correggono le domande. */
      if (!tieni) localStorage.removeItem(VICINI_CACHE_CHIAVE);
      myPos = null; myPosAt = 0;
      closeSheet('mBagno');
      cercaVicino(k);
    }, [kind, !!tieni]);
    await page.waitForFunction(
      () => { const b = document.getElementById('bagnoBody'); return b && !/Cerco|ci riprovo/i.test(b.innerText); },
      { timeout: 60000 }).catch(() => {});
    return page.evaluate(() => document.getElementById('bagnoBody').innerText.replace(/\s+/g, ' ').trim());
  };

  // ══ 1. QUELLO CHE SI CHIAMA "STAZIONE" MA NON LO È ═══════════════════
  /* Il caso vero: la caserma dei carabinieri al primo posto fra le stazioni
     dei treni. La rete che cerca per NOME non guardava che cosa fosse la
     cosa trovata — e «stazione» vuol dire dieci cose diverse, in italiano
     come in inglese.
     Insieme alla caserma ci sono tutti i parenti che la stessa parola si
     porta dietro in giro per il mondo: sono i casi che un'app usata in
     Giappone o in America incontra ogni giorno. */
  /* NIENTE che si trovi per etichetta: così la rete sul nome parte davvero.
     Se ci fosse una stazione vera la rete non partirebbe nemmeno — e allora
     i falsi sarebbero assenti per il motivo sbagliato, e questa prova
     direbbe di sì guardando il vuoto. */
  let page = await apri([
    /* la corte dei falsi, tutti a due passi e tutti col nome giusto */
    { type: 'node', id: 2, lat: su(195), lon: IO.lng,
      tags: { amenity: 'police', name: 'Stazione Carabinieri Muggiò', operator: 'Arma dei Carabinieri' } },
    { type: 'node', id: 3, lat: su(200), lon: IO.lng,
      tags: { amenity: 'fuel', name: 'Stazione di Servizio Esso' } },
    { type: 'node', id: 4, lat: su(205), lon: IO.lng,
      tags: { amenity: 'fire_station', name: 'Fire Station' } },
    { type: 'way', id: 5, center: { lat: su(210), lon: IO.lng },
      tags: { highway: 'residential', name: 'Via della Stazione' } },
    { type: 'node', id: 6, lat: su(215), lon: IO.lng,
      tags: { place: 'hamlet', name: 'Frazione Stazione Nord' } },
    { type: 'way', id: 7, center: { lat: su(220), lon: IO.lng },
      tags: { power: 'plant', name: 'Power Station' } },
    { type: 'node', id: 8, lat: su(225), lon: IO.lng,
      tags: { tourism: 'hotel', name: 'Station Hotel' } },
    { type: 'node', id: 9, lat: su(230), lon: IO.lng,
      tags: { amenity: 'charging_station', name: 'Stazione di ricarica' } },
    { type: 'node', id: 10, lat: su(235), lon: IO.lng,
      tags: { amenity: 'recycling', name: 'Stazione ecologica' } },
    /* E UNA CHE INVECE CI DEVE STARE: una stazione mappata male, solo come
       edificio col nome sopra. Senza questa riga la prova direbbe di sì
       anche a un'app che butta via tutto quello che trova per nome, e
       allora nei paesi dove le etichette sono scarse non si troverebbe più
       niente. È il rovescio, e conta quanto il resto. */
    { type: 'way', id: 11, center: { lat: su(240), lon: IO.lng },
      tags: { building: 'train_station', name: 'Vecchia Stazione di Muggiò' } }
  ]);
  let testo = await cerca(page, 'treno');
  ok('la caserma dei Carabinieri non è più una stazione dei treni',
     !/Carabinieri/.test(testo), testo.slice(0, 90));
  const falsi = [['la stazione di servizio', /Servizio Esso/], ['i pompieri', /Fire Station/],
                 ['la via che si chiama Stazione', /Via della Stazione/],
                 ['la frazione che si chiama Stazione', /Frazione Stazione Nord/],
                 ['la centrale elettrica', /Power Station/], ['l\'albergo Station Hotel', /Station Hotel/],
                 ['la colonnina di ricarica', /di ricarica/], ['la piazzola ecologica', /ecologica/]];
  falsi.forEach(([che, re]) => ok(`e nemmeno ${che}`, !re.test(testo), testo.slice(0, 90)));
  /* Il rovescio, e conta quanto il resto: non si è buttato via tutto. */
  ok('mentre una stazione mappata solo come edificio si trova lo stesso',
     /Vecchia Stazione di Muggiò/.test(testo), testo.slice(0, 120));
  ok('dichiarando che è presa dal nome e va controllata',
     /da controllare/.test(testo));
  /* E che la rete sul nome sia partita per davvero: se non fosse partita,
     tutte le righe qui sopra sarebbero verdi senza aver provato niente. */
  ok('e la rete sul nome è partita davvero, se no qui sopra non si prova niente',
     page._chiamate.some(c => /name\|brand\|operator/.test(c.q)),
     page._chiamate.length + ' domande');
  await page.close();

  // ══ 1-bis. LA RICERCA PER NOME È L'ULTIMA SPIAGGIA, NON UN CONTORNO ══
  /* È la domanda più cara delle sei: cercare una parola in venti lingue
     dentro cinque campi obbliga Overpass a leggersi le etichette di tutto.
     Partiva ogni volta che si trovavano MENO DI TRE cose — in un paese,
     cioè quasi sempre: si era già trovata la stazione e si faceva aspettare
     venti secondi per cercarne una terza che non c'è. E su un servizio in
     coda quei venti secondi diventano «overpass lento», e si perde anche
     quello che si era trovato.
     Segnalato dal vivo: «dettaglio: overpass lento» su bancomat e aree
     fumatori. */
  page = await apri([
    { type: 'node', id: 12, lat: su(300), lon: IO.lng,
      tags: { railway: 'halt', name: 'Lissone-Muggiò', operator: 'Rete Ferroviaria Italiana' } }
  ]);
  testo = await cerca(page, 'treno');
  ok('trovata la stazione, non si paga la ricerca per nome',
     !page._chiamate.some(c => /name\|brand\|operator/.test(c.q)),
     page._chiamate.length + ' domande: ' + page._chiamate.map(c => (c.q.match(/around:(\d+)/) || [])[1]).join(', '));
  ok('e la stazione c\'è', /Lissone-Muggiò/.test(testo), testo.slice(0, 70));
  await page.close();

  // ══ 1-ter. QUANTO PESA UNA DOMANDA ═══════════════════════════════════
  /* Ogni `(around:` è una ricerca sulla mappa a sé, che Overpass esegue una
     per una. La domanda del bancomat ne faceva DICIOTTO — tre per filtro,
     perché si chiedevano punti, contorni e insiemi separatamente — e
     diciotto ricerche su un chilometro e mezzo, su un server in coda, non
     stanno in dieci secondi. Con `nwr` e i valori della stessa chiave
     chiesti insieme sono un quarto.
     Questo non è un dettaglio di stile: è la differenza fra una risposta e
     «overpass lento». */
  page = await apri([]);
  const pesi = await page.evaluate(() => {
    const out = {};
    Object.keys(VICINI).forEach(k => {
      out[k] = (VICINI[k].q(1500, 45.59, 9.22).match(/\(around:/g) || []).length;
    });
    out.nome = (ovAttorno([ovNome(VICINI.atm.parole)], 1500, 45.59, 9.22).match(/\(around:/g) || []).length;
    return out;
  });
  Object.entries(pesi).forEach(([k, n]) =>
    ok(`la domanda "${k}" resta leggera`, n <= 5, n + ' ricerche sulla mappa'));
  await page.close();

  // ══ 2. LA FERMATA DEL BUS A CENTO METRI ══════════════════════════════
  /* La stessa palina sta sulla mappa in cinque modi, e chi mappa ne mette
     quasi sempre uno solo. Qui ce n'è una per forma, ognuna mappata in un
     modo diverso e nessuna col modo "classico": se l'app ne chiede solo
     tre su cinque, di queste non ne trova nessuna. */
  page = await apri([
    { type: 'node', id: 20, lat: su(100), lon: IO.lng,
      tags: { public_transport: 'stop_position', bus: 'yes', name: 'Via Fiume' } },
    { type: 'node', id: 21, lat: su(140), lon: IO.lng,
      tags: { highway: 'platform', bus: 'yes', name: 'Piazza Matteotti' } },
    { type: 'node', id: 22, lat: su(180), lon: IO.lng,
      tags: { public_transport: 'station', bus: 'yes', name: 'Autostazione Muggiò' } }
  ]);
  testo = await cerca(page, 'bus');
  ok('la fermata mappata solo come punto di fermata si trova',
     /Via Fiume/.test(testo), testo.slice(0, 90));
  ok('e quella mappata come banchina vecchio stile',
     /Piazza Matteotti/.test(testo), testo.slice(0, 90));
  ok('e quella mappata come stazione degli autobus',
     /Autostazione Muggiò/.test(testo), testo.slice(0, 90));
  ok('la più vicina è la prima, con la stella',
     testo.indexOf('Via Fiume') < testo.indexOf('Piazza Matteotti'), testo.slice(0, 60));
  await page.close();

  // ══ 3. UNA BANCA CHE DICE DI NON AVERE IL BANCOMAT ═══════════════════
  /* `["atm"]` vuol dire «ha l'etichetta atm, qualunque valore abbia»:
     comprende atm=no, cioè esattamente i posti che dichiarano di NON
     averlo. Venivano offerti come bancomat.
     Questa riga esiste solo perché il finto Overpass sa cos'è una
     negazione: col finto di prima sarebbe passata anche sul codice
     rotto, senza provare niente. */
  page = await apri([
    { type: 'node', id: 30, lat: su(50), lon: IO.lng,
      tags: { amenity: 'bank', atm: 'no', name: 'Banca Senza Sportello' } },
    { type: 'node', id: 31, lat: su(60), lon: IO.lng,
      tags: { shop: 'convenience', atm: 'no', name: 'Alimentari Senza Sportello' } },
    { type: 'node', id: 32, lat: su(300), lon: IO.lng,
      tags: { amenity: 'atm', name: 'Bancomat di via Roma' } }
  ]);
  testo = await cerca(page, 'atm');
  ok('una banca che dichiara di non avere il bancomat non viene offerta',
     !/Banca Senza Sportello/.test(testo), testo.slice(0, 90));
  ok('e nemmeno il negozio che lo dichiara',
     !/Alimentari Senza Sportello/.test(testo), testo.slice(0, 90));
  ok('mentre il bancomat vero si trova', /Bancomat di via Roma/.test(testo), testo.slice(0, 70));
  await page.close();

  // ══ 4. QUANDO IL SERVIZIO DELLA MAPPA NON RISPONDE ═══════════════════
  /* IL DIFETTO DELLA PRIMA FOTOGRAFIA. La chiamata stava nuda dentro il
     ciclo dei raggi: al primo intoppo l'errore saltava fuori dal ciclo e
     l'app diceva «Non riesco a raggiungere la mappa» senza aver nemmeno
     provato i raggi più larghi. Un singhiozzo di un momento diventava una
     ricerca fallita — con un tasto «Riprova» da premere a mano. */
  page = await apri([
    { type: 'node', id: 40, lat: su(400), lon: IO.lng,
      tags: { railway: 'subway_entrance', name: 'Metro Centrale' } }
  ], { fallisciPrime: 3 });
  testo = await cerca(page, 'metro');
  ok('un intoppo all\'inizio non fa fallire tutta la ricerca',
     /Metro Centrale/.test(testo), testo.slice(0, 90));
  ok('e non compare il cartello «non riesco a raggiungere la mappa»',
     !/non ha risposto|Non riesco a raggiungere/.test(testo), testo.slice(0, 90));
  /* Ci ha riprovato DA SOLA: nessuno ha premuto niente. */
  ok('ci ha riprovato da sola, senza chiedere di premere un tasto',
     page._chiamate.length > 3, page._chiamate.length + ' richieste');
  await page.close();

  // ══ 5. E QUANDO NON RISPONDE DAVVERO, LO DICE SENZA MENTIRE ══════════
  page = await apri([], { fallisciPrime: 999 });
  testo = await cerca(page, 'bus');
  ok('se non risponde nessuno lo dice, invece di dire che non c\'è niente',
     /non ha risposto/.test(testo) && !/non risulta nessuna fermata/.test(testo),
     testo.slice(0, 100));
  /* Il numero dei tentativi non è a caso: senza un tetto, un servizio giù
     verrebbe tempestato da un telefono che ci riprova all'infinito. */
  /* Sul codice di prima queste costanti non esistono: si chiedono con
     prudenza, se no la prova esplode invece di dire cosa manca — e una
     prova che esplode non si legge. */
  const conti = await page.evaluate(() => ({
    tentativi: typeof VICINI_TENTATIVI === 'number' ? VICINI_TENTATIVI : null,
    server: typeof OVERPASS !== 'undefined' ? OVERPASS.length : null }));
  if (conti.tentativi == null) ok('l\'app sa quante volte riprovare da sola', false, 'VICINI_TENTATIVI non esiste');
  ok('ma non ci riprova all\'infinito: c\'è un tetto',
     conti.tentativi != null && page._chiamate.length <= conti.tentativi * conti.server + 2,
     `${page._chiamate.length} richieste, tetto ${conti.tentativi}×${conti.server}`);
  await page.close();

  // ══ 5-bis. SE NON RISPONDE, MOSTRA QUELLO CHE SAPEVA GIA' ════════════
  /* LA SEGNALAZIONE PIÙ IMPORTANTE, e quella che mi ha fatto capire il
     resto: «prima i bagni me li trovava, adesso neanche quello». La
     ricerca dei bagni non era cambiata di una virgola — era cambiato che
     avevo cambiato il nome della cache, e quelle ricerche rispondevano
     DALLA MEMORIA senza toccare la rete. Buttando via la memoria ho tolto
     la cosa che nascondeva una rete che già non andava.
     Un bagno non si sposta: l'ultima risposta vale mille volte un cartello
     d'errore. Qui si cerca una volta con la rete che va — così la memoria
     si riempie — e poi si stacca tutto e si cerca di nuovo. */
  page = await apri([
    { type: 'node', id: 60, lat: su(120), lon: IO.lng,
      tags: { amenity: 'toilets', name: 'Bagno del parco' } }
  ]);
  testo = await cerca(page, 'bagno');
  ok('col servizio che risponde, il bagno si trova', /Bagno del parco/.test(testo), testo.slice(0, 70));
  /* Adesso la rete non c'è più, e la memoria è VECCHIA: si invecchia di tre
     giorni, che è oltre le ventiquattr'ore entro cui la cache normale
     risponde da sola. Senza invecchiarla risponderebbe la cache — cosa
     giusta, ma non è questo che si sta provando: qui si prova il ripiego,
     cioè cosa succede quando anche la memoria è scaduta. */
  await page.evaluate(() => {
    const tutta = JSON.parse(localStorage.getItem(VICINI_CACHE_CHIAVE) || '{}');
    Object.keys(tutta).forEach(k => { tutta[k].quando = Date.now() - 3 * 86400000; });
    localStorage.setItem(VICINI_CACHE_CHIAVE, JSON.stringify(tutta));
  });
  await page.route('**/api/interpreter', ro => ro.abort());
  testo = await cerca(page, 'bagno', true);
  ok('col servizio giù mostra quello che aveva trovato prima, invece di niente',
     /Bagno del parco/.test(testo), testo.slice(0, 110));
  ok('e dice che è una risposta vecchia, senza spacciarla per fresca',
     /non risponde adesso/.test(testo) && /avevo trovato/.test(testo), testo.slice(0, 110));
  ok('con la distanza, che quella resta giusta', /120 m|1 min a piedi/.test(testo), testo.slice(0, 110));
  await page.close();

  /* E il rovescio: se non si sapeva niente, non si inventa niente. */
  page = await apri([], { fallisciPrime: 999 });
  testo = await cerca(page, 'bagno');
  ok('ma se non c\'era niente da ricordare non inventa',
     !/avevo trovato/.test(testo) && /non ha risposto/.test(testo), testo.slice(0, 90));
  /* E dice cosa è andato storto: «non risponde» nasconde la differenza fra
     l'essere senza campo e l'essere stati messi in castigo da Overpass, e
     quelle due cose si risolvono in modi diversi. Senza questa riga una
     segnalazione dice solo «non funziona». */
  ok('e dice cosa è andato storto, non solo che è andato storto',
     /dettaglio:/.test(testo) && /429/.test(testo), testo.slice(-80));
  await page.close();

  // ══ 5-ter. LA MEMORIA COL NOME VECCHIO VALE PER IL RIPIEGO ═══════════
  /* Il nome della cache cambia apposta quando si corregge una domanda, per
     non riproporre risposte prese con quella sbagliata. Giusto — ma per il
     RIPIEGO no: buttare via il passato proprio nel momento in cui la rete
     non c'è vuol dire lasciare a mani vuote chi fino a ieri trovava quello
     che cercava. È esattamente quello che è successo. */
  page = await apri([], { fallisciPrime: 999 });
  await page.evaluate(io => {
    const vecchio = {};
    vecchio['bagno|1500|tipo@' + io.lat.toFixed(4) + ',' + io.lng.toFixed(4)] = {
      fam: 'bagno|1500|tipo', lat: io.lat, lng: io.lng, quando: Date.now() - 3 * 86400000,
      lista: [{ lat: io.lat + 0.0009, lng: io.lng, nome: 'Bagno di ieri', extra: [] }]
    };
    localStorage.setItem('geppgo_vicini', JSON.stringify(vecchio));
  }, IO);
  testo = await cerca(page, 'bagno', true);
  ok('anche la memoria salvata col nome vecchio serve da ripiego',
     /Bagno di ieri/.test(testo), testo.slice(0, 110));
  ok('e dice quanto è vecchia', /giorni fa/.test(testo), testo.slice(0, 110));
  await page.close();

  // ══ 6. IL TELEFONO NON MOLLA PRIMA DEL SERVER ════════════════════════
  /* La domanda diceva a Overpass «prenditi 15 secondi» e il telefono si
     arrendeva a 9: buttava via una risposta che stava arrivando e diceva
     «non ci riesco» mentre il server stava ancora lavorando per noi.
     I due numeri adesso escono dalla stessa costante, e questa riga è
     quello che impedisce loro di tornare a litigare. */
  page = await apri([{ type: 'node', id: 50, lat: su(80), lon: IO.lng,
    tags: { amenity: 'atm', name: 'Bancomat' } }]);
  await cerca(page, 'atm');
  const tempi = await page.evaluate(() => ({
    attesa: typeof VICINI_ATTESA_MS === 'number' ? VICINI_ATTESA_MS : null,
    server: typeof VICINI_TIMEOUT_SERVER === 'number' ? VICINI_TIMEOUT_SERVER : null }));
  const nellaDomanda = +((page._chiamate[0].q.match(/\[timeout:(\d+)\]/) || [])[1]);
  ok('il telefono aspetta più a lungo di quanto concede al server',
     tempi.attesa != null && tempi.server != null && tempi.attesa > tempi.server * 1000,
     tempi.server == null ? `il numero del server è scritto a mano nella domanda (${nellaDomanda}s), non in una costante`
                          : `telefono ${tempi.attesa}ms, server ${tempi.server}s`);
  ok('e il numero nella domanda è lo stesso della costante, non un gemello',
     tempi.server != null && nellaDomanda === tempi.server,
     `nella domanda ${nellaDomanda}s, costante ${tempi.server}s`);
  await page.close();

  await browser.close();
  for (const e of err) r.push(' FALLITO  ' + e);
  const passati = r.filter(x => x.startsWith('  OK')).length;
  console.log(r.join('\n'));
  console.log(`\n${passati}/${r.length} passati`);
  process.exit(passati === r.length ? 0 : 1);
})();
