/* QUANDO UN SERVER DELLA MAPPA MENTE, E LE DUE COPIE DELLA REGOLA.
 *
 * IL CASO VERO, quello che ha tenuto in piedi mezza segnalazione: uno dei
 * server di Overpass — `overpass.osm.ch` — rispondeva 200, senza nessun
 * errore, in SEI DECIMI di secondo, con la lista vuota. Il suo database era
 * vuoto. E siccome l'app chiede a più server in corsa e prende il primo che
 * risponde, vinceva sempre lui: la risposta che arrivava era «qui non c'è
 * niente», per qualunque cosa si cercasse e ovunque si fosse. Il bancomat
 * davanti a casa che non si trova, la fermata dell'autobus a cento metri che
 * non si trova.
 *
 * Non c'è niente da guardare in quella risposta: nessun errore, nessun
 * `remark`. L'unica cosa che la smaschera è `osm3s.timestamp_osm_base` — la
 * data dei dati — che lì era `117204`. Da cui la regola:
 *
 *   UN «NON C'È NIENTE» SI CREDE SOLO A CHI SA DIRE DI QUANDO SONO I SUOI
 *   DATI. Una risposta che contiene dei posti si prende comunque.
 *
 * PERCHÉ QUESTA PROVA ESISTE, oltre a provare la regola. La regola sta
 * scritta DUE VOLTE: una nell'app (che è un file solo e non può importare
 * niente) e una in `supabase/functions/vicini/memoria.mjs`, che usa il
 * ponte. Due copie divergono — è una questione di quando, non di se. Qui
 * la stessa tabella di casi passa da tutte e due e si pretende la stessa
 * risposta: il giorno che una cambia e l'altra no, questa riga cade.
 */
const { apriBrowser, APP } = require('./browser');
const { comeOverpass, comeIlServerRotto } = require('./overpass-finto');

(async () => {
  const { rispostaAttendibile: regolaPonte } =
    await import('../supabase/functions/vicini/memoria.mjs');

  const r = [];
  const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);

  const unPosto = { type: 'node', id: 1, lat: 45.46, lon: 9.19, tags: { amenity: 'atm' } };

  /* La tabella: cosa è arrivato, e se ci si deve credere. */
  const casi = [
    ['la risposta buona con dei posti dentro', comeOverpass([unPosto]), true],
    ['un «non c\'è niente» con la data dei dati', comeOverpass([]), true],
    ['IL SERVER COL DATABASE VUOTO (il caso vero)', comeIlServerRotto(), false],
    ['un «niente» senza nessuna data', { version: 0.6, elements: [] }, false],
    ['un «niente» con una data che è un numero',
     { osm3s: { timestamp_osm_base: '117204' }, elements: [] }, false],
    ['un «niente» con una data scritta male',
     { osm3s: { timestamp_osm_base: '22/09/2026' }, elements: [] }, false],
    /* `remark` è il modo che ha Overpass di dire «non ce l'ho fatta» dentro
       una risposta riuscita: 200, ma non è una risposta. */
    ['una risposta che dice «query timed out» nel remark',
     Object.assign(comeOverpass([]), { remark: 'runtime error: Query timed out' }), false],
    ['e lo stesso remark anche se qualcosa l\'ha trovato',
     Object.assign(comeOverpass([unPosto]), { remark: 'runtime error: Query timed out' }), false],
    ['niente del tutto', null, false],
    ['del testo al posto della risposta', 'boh', false],
    ['una risposta senza la lista', { osm3s: { timestamp_osm_base: '2026-09-22T10:00:00Z' } }, false],
    ['una lista che non è una lista', { elements: 'tanti' }, false],
    /* CHE NON FACCIA PEGGIO DI PRIMA: una risposta con dei posti dentro si
       prende comunque, qualunque cosa dica di sé. I posti o ci sono o non ci
       sono, e non si butta via roba buona per un'etichetta storta. */
    ['dei posti con la data storta si prendono lo stesso',
     { osm3s: { timestamp_osm_base: '117204' }, elements: [unPosto] }, true],
    ['e dei posti senza nessuna data pure',
     { elements: [unPosto] }, true],
  ];

  // ── 1. la regola, dalla parte del ponte ──────────────────────────────
  for (const [che, dato, atteso] of casi)
    ok(`${atteso ? 'si crede a' : 'NON si crede a'} ${che}`,
       regolaPonte(dato) === atteso, 'il ponte dice ' + regolaPonte(dato));

  // ── 2. e la copia che sta nell'app dice le stesse cose ───────────────
  const browser = await apriBrowser();
  const page = await browser.newPage();
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.rispostaAttendibile === 'function', { timeout: 20000 });
  const dettiDallApp = await page.evaluate(
    lista => lista.map(d => rispostaAttendibile(d)), casi.map(c => c[1]));
  const diverse = casi
    .map((c, i) => [c[0], regolaPonte(c[1]), dettiDallApp[i]])
    .filter(([, a, b]) => a !== b);
  ok('la regola nell\'app e quella nel ponte dicono le stesse cose',
     diverse.length === 0,
     diverse.length ? diverse.map(([n, a, b]) => `«${n}»: ponte ${a}, app ${b}`).join('; ')
                    : casi.length + ' casi, stessa risposta');
  await page.close();

  // ── 3. E DAL VIVO: il bugiardo veloce non deve vincere ───────────────
  /* La regola da sola non basta a dormirci: quello che conta è che la
     RICERCA finisca bene. Qui si rimette in piedi il caso vero — un server
     che risponde «niente» in un istante e uno onesto che ci mette un
     secondo — e si pretende che il bancomat si trovi. Prima di questa
     correzione vinceva il primo, e l'app diceva «non risulta nessun
     bancomat» con un bancomat a cento metri. */
  const IO = { lat: 45.4750, lng: 9.1900 };
  const stato = { trips: [{ id: 1, name: 'Prova', destination: 'Milano', currency: 'EUR', status: 'open',
    participants: [{ id: 'p1', name: 'Gepp' }], suggested: [], pois: [], expenses: [], tickets: [],
    hotels: [], weather: {}, createdAt: Date.now(),
    days: [{ id: 'd1', date: '2026-09-01', title: '', activities: [] }] }],
    currentTripId: 1, settings: {}, myName: 'Gepp', skipAuth: true };

  const p2 = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const interrogati = [];
  /* Chi è il primo server lo dirà l'APP, appena la pagina è in piedi:
     scrivere un nome qui vorrebbe dire che riordinando la lista la prova
     smette di provare quello che dice. */
  let bugiardo = null;
  await p2.route('**/functions/v1/vicini', ro => ro.abort());   /* niente ponte: si guarda la strada diretta */
  await p2.route('**/api/interpreter', async ro => {
    const casa = new URL(ro.request().url()).host;
    interrogati.push(casa);
    /* Il bugiardo è il PRIMO della lista e risponde subito: è esattamente
       com'era nella realtà, ed è il motivo per cui vinceva sempre. */
    if (casa === bugiardo)
      return ro.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(comeIlServerRotto()) });
    await new Promise(s => setTimeout(s, 900));
    return ro.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(comeOverpass([
        { type: 'node', id: 7, lat: IO.lat + 0.0009, lon: IO.lng,
          tags: { amenity: 'atm', name: 'Bancomat che esiste davvero' } }
      ])) });
  });
  await p2.addInitScript(([s, io]) => {
    localStorage.setItem('geppgo2', JSON.stringify(s));
    navigator.geolocation.getCurrentPosition = cb =>
      cb({ coords: { latitude: io.lat, longitude: io.lng } });
  }, [stato, IO]);
  await p2.goto(APP, { waitUntil: 'domcontentloaded' });
  await p2.waitForFunction(() => typeof window.cercaVicino === 'function', { timeout: 20000 });
  bugiardo = await p2.evaluate(() => new URL(OVERPASS[0]).host);
  await p2.evaluate(() => { localStorage.removeItem(VICINI_CACHE_CHIAVE); myPos = null; myPosAt = 0; cercaVicino('atm'); });
  await p2.waitForFunction(() => !/Cerco|riprovo/i.test(document.getElementById('bagnoBody').innerText), { timeout: 60000 }).catch(() => {});
  const testo = await p2.evaluate(() => document.getElementById('bagnoBody').innerText.replace(/\s+/g, ' ').trim());
  ok('il bancomat si trova, anche se il server più veloce dice che non c\'è',
     /Bancomat che esiste davvero/.test(testo), testo.slice(0, 90));
  ok('e non si è creduto al primo che ha risposto',
     interrogati.length > 1, 'server interrogati: ' + [...new Set(interrogati)].join(', '));
  await browser.close();

  console.log('\n' + r.join('\n'));
  const falliti = r.filter(x => x.includes('FALLITO')).length;
  console.log(`\n${r.length - falliti}/${r.length} passati`);
  process.exit(falliti ? 1 : 0);
})();
