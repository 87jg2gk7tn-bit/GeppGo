/* Come ci si muove: stazione dei treni, metropolitana, fermata del bus.

   IL DIFETTO. Il giro si allargava fino a cinque chilometri e poi si
   arrendeva. Per un bagno va benissimo — uno a venti chilometri non serve
   a nessuno, e la risposta giusta è «non c'è» — ma per la METROPOLITANA
   no: se stai in un paese fuori città il metro sta in città, a quindici
   chilometri, ed è esattamente quello che volevi sapere. Cercando da un
   posto che il metro non ce l'ha, l'app diceva «non risulta niente»
   mentre la risposta c'era, poco più in là.

   Adesso la scala dipende da cosa cerchi: fitta sotto, larga sopra per i
   trasporti, ferma a cinque chilometri per i bisogni. E ci si ferma al
   primo scalino che trova qualcosa — in centro il primo giro basta, e gli
   altri non si fanno nemmeno.

   Le domande a Overpass si guardano una per una: è l'unico modo di sapere
   che l'app ha davvero allargato il giro, invece di dirlo e basta. */
const { apriBrowser, APP, cartellaFoto } = require('./browser');
const { comeOverpass } = require('./overpass-finto');

const stato = {
  trips: [{
    id: 't1', name: 'Prova', destination: 'Tokyo', currency: 'JPY', status: 'open',
    start: '2026-09-01', end: '2026-09-02',
    participants: [{ id: 'p1', name: 'Gepp' }],
    suggested: [], pois: [], expenses: [], tickets: [], hotels: [], weather: {}, createdAt: Date.now(),
    days: [{ id: 'd1', date: '2026-09-01', title: '', activities: [] }]
  }],
  currentTripId: 't1', settings: { proxRadius: 200 }, myName: 'Gepp', skipAuth: true
};

/* Quello che Overpass risponderebbe. «vuoto» è il caso della persona che
   ha segnalato il difetto: sta in un posto dove il metro non c'è. */
const METRO = [
  { type: 'node', id: 1, lat: 35.6600, lon: 139.7460,
    tags: { railway: 'subway_entrance', name: 'Asakusa · uscita A1', wheelchair: 'yes' } },
  { type: 'node', id: 2, lat: 35.6620, lon: 139.7480,
    tags: { railway: 'station', station: 'subway', name: 'Asakusa' } },
  { type: 'node', id: 3, lat: 35.6640, lon: 139.7500,
    tags: { railway: 'subway_entrance', name: 'Asakusa · uscita B2' } }
];

(async () => {
  const browser = await apriBrowser();
  const r = [];
  const err = [];
  const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);

  /* `risposta` decide cosa torna a ogni giro: così si può fingere il posto
     dove non c'è niente fino a venti chilometri. */
  async function apri(risposta) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', e => err.push('PAGEERROR: ' + e.message.split('\n')[0]));
    page._domande = [];
    await page.route('**/api/interpreter', async route => {
      const q = decodeURIComponent(route.request().postData() || '').replace(/^data=/, '');
      page._domande.push(q);
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(comeOverpass(risposta(q, page._domande.length))) });
    });
    await page.addInitScript(s => {
      localStorage.setItem('geppgo2', JSON.stringify(s));
      navigator.geolocation.getCurrentPosition = cb =>
        cb({ coords: { latitude: 35.6595, longitude: 139.7454 } });
    }, stato);
    await page.goto(APP, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.cercaVicino === 'function', { timeout: 15000 });
    return page;
  }

  /* I raggi che una domanda ha chiesto, in ordine: Overpass li porta
     scritti dentro, `around:<metri>`. */
  const raggiChiesti = domande => domande.map(q => {
    const m = q.match(/around:(\d+)/);
    return m ? +m[1] : null;
  }).filter(x => x !== null);

  // ══ la scala: quella che serve, non una sola per tutti ═══════════════
  let page = await apri(() => []);
  /* Sul codice di prima raggiDi() non esiste affatto: si ripiega sulla
     scala unica, così la prova dice cosa manca invece di schiantarsi. */
  const scale = await page.evaluate(() => {
    const d = k => (typeof raggiDi === 'function') ? raggiDi(k)
      : (typeof VICINI_RAGGI !== 'undefined' ? VICINI_RAGGI : []);
    return { metro: d('metro'), treno: d('treno'), bus: d('bus'),
             bagno: d('bagno'), atm: d('atm') };
  });
  /* QUELLO CHE CONTA E' DOVE ARRIVA, NON QUANTI SCALINI FA. La riga
     pretendeva i sei raggi esatti; ma ogni scalino e' un viaggio andata e
     ritorno al server, e cercando il metro da un paese dove non c'e' se ne
     facevano sei in fila prima di trovarlo. Il requisito era «arrivare a
     venti chilometri», e quello resta: ci si arriva in tre passi. Si
     controlla il fatto - fin dove arriva, e che parta vicino - non l'elenco
     dei numeri. */
  ok('la metropolitana si cerca fino a venti chilometri',
     scale.metro[scale.metro.length - 1] === 20000, scale.metro.join(', '));
  ok('partendo da vicino, non buttandosi subito a venti chilometri',
     scale.metro[0] <= 2000, scale.metro.join(', '));
  /* Sei scalini, fitti sotto e larghi sopra: costano sei viaggi al server
     nel caso peggiore, e si tengono perche' col ponte e la memoria
     condivisa quei viaggi quasi sempre non escono di casa. */
  ok('a scalini fitti sotto e larghi sopra',
     scale.metro.join(',') === '1000,2000,3000,5000,10000,20000', scale.metro.join(', '));
  /* Stessa ragione, stesso problema: se il paese non ha la stazione, la
     stazione è quella della città. */
  ok('e la stazione dei treni allo stesso modo',
     scale.treno.join(',') === scale.metro.join(','), scale.treno.join(', '));
  /* Una fermata del bus a venti chilometri non è la tua fermata. */
  ok('il bus si ferma prima', scale.bus[scale.bus.length - 1] === 10000, scale.bus.join(', '));
  /* E un bagno a venti chilometri non serve a nessuno: lì la risposta
     giusta è «non c'è», non «eccone uno a un'ora di macchina». */
  ok('i bisogni restano vicini', scale.bagno[scale.bagno.length - 1] <= 5000 &&
     scale.atm[scale.atm.length - 1] <= 5000,
     'bagno ' + scale.bagno.join(', ') + ' · bancomat ' + scale.atm.join(', '));
  await page.close();

  // ══ IL CASO SEGNALATO: qui il metro non c'è ══════════════════════════
  /* Niente a nessun raggio tranne l'ultimo. Se l'app si fermasse a cinque
     chilometri, come faceva, direbbe «non risulta niente» avendo la
     risposta a portata di un giro in più. */
  page = await apri(q => /around:20000/.test(q) ? METRO : []);
  await page.evaluate(() => { if (typeof cercaMetro === 'function') cercaMetro(); });
  await page.waitForFunction(
    () => /Asakusa|non risulta|nessun/i.test(document.getElementById('bagnoBody').innerHTML),
    { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(400);
  const lontano = {
    raggi: raggiChiesti(page._domande),
    testo: await page.evaluate(() => document.getElementById('bagnoBody').innerText.replace(/\s+/g, ' ').trim())
  };
  ok('cercando da dove il metro non c\'è, il giro si allarga fino in fondo',
     lontano.raggi[lontano.raggi.length - 1] === 20000 &&
     lontano.raggi.every((x, i) => i === 0 || x > lontano.raggi[i - 1]),
     lontano.raggi.join(' → '));
  ok('e a venti chilometri la trova, invece di dire che non c\'è niente',
     /Asakusa/.test(lontano.testo) && !/non risulta/i.test(lontano.testo),
     lontano.testo.slice(0, 70));
  await page.close();

  // ══ e in città non fa sei giri per niente ════════════════════════════
  /* Il rovescio, e conta quanto l'altro: se trovasse tutto al primo giro e
     continuasse lo stesso, sarebbero cinque richieste buttate a un
     servizio gratuito che ci lascia usare gratis. */
  page = await apri(() => METRO);
  await page.evaluate(() => { if (typeof cercaMetro === 'function') cercaMetro(); });
  await page.waitForFunction(
    () => /Asakusa|non risulta/i.test(document.getElementById('bagnoBody').innerHTML), { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(400);
  const vicino = raggiChiesti(page._domande);
  ok('ma se le trova subito si ferma al primo giro',
     vicino.length === 1 && vicino[0] === scale.metro[0], vicino.join(' → ') || 'nessuna domanda');
  await page.close();

  // ══ le domande giuste, per ciascuno dei tre ══════════════════════════
  page = await apri(() => METRO);
  const domande = {};
  for (const [nome, fn] of [['metro', 'cercaMetro'], ['treno', 'cercaTreno'], ['bus', 'cercaBus']]) {
    page._domande = [];
    await page.evaluate(f => { closeSheet('mBagno'); if (typeof window[f] === 'function') window[f](); }, fn);
    await page.waitForFunction(
      () => /Asakusa|non risulta/i.test(document.getElementById('bagnoBody').innerHTML), { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(300);
    domande[nome] = page._domande.join(' ');
  }
  /* La metro si cerca dalle ENTRATE: una stazione è lunga trecento metri e
     ha cinque bocche, e il puntino al centro manda nella piazza sbagliata. */
  ok('la metro chiede le entrate, non solo il centro della stazione',
     /railway"="subway_entrance"/.test(domande.metro), 'entrate cercate');
  /* Il treno esclude le stazioni del metro: se no le due ricerche danno la
     stessa cosa e chi cerca il treno si ritrova davanti una fermata.
     Si chiede «la domanda chiede questo valore?», non «c'e' dentro questa
     stringa esatta?»: i valori della stessa chiave adesso si chiedono
     insieme — railway~"^(station|halt)$" — per non far fare al server tre
     ricerche dove ne basta una, e la vecchia riga diventava rossa pur
     cercando le stesse identiche cose. */
  const chiede = (q, chiave, valore) =>
    new RegExp('"' + chiave + '"\\s*=\\s*"' + valore + '"').test(q) ||
    new RegExp('"' + chiave + '"\\s*~\\s*"[^"]*\\b' + valore + '\\b').test(q);
  ok('il treno esclude le stazioni della metropolitana',
     chiede(domande.treno, 'railway', 'station') && /station"!="subway"/.test(domande.treno),
     'esclusione presente');
  ok('e prende anche le fermate piccole', chiede(domande.treno, 'railway', 'halt'),
     domande.treno.slice(0, 80));
  ok('il bus chiede le paline e le autostazioni',
     /highway"="bus_stop"/.test(domande.bus) && /amenity"="bus_station"/.test(domande.bus));
  await page.close();

  await browser.close();
  for (const e of err) r.push(' FALLITO  ' + e);
  const passati = r.filter(x => x.startsWith('  OK')).length;
  console.log(r.join('\n'));
  console.log(`\n${passati}/${r.length} passati`);
  process.exit(passati === r.length ? 0 : 1);
})();
