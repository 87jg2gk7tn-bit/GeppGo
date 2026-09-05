/* Il ricordo del viaggio: i numeri, la cartolina, il racconto da mandare.

   Due controlli contano più di tutti gli altri messi insieme, e sono la
   stessa regola vista da due lati: il ricordo NON deve diventare una pagina
   pubblica del viaggio, e il racconto NON deve portarsi dietro il codice
   d'invito. Se cade uno dei due cade tutta la tutela sulle foto. */
const { apriBrowser, APP, leafletJs } = require('./browser');
const fs = require('fs');

/* Due giornate lontane fra loro, e dentro ognuna due tappe a un chilometro
   esatto. Serve a far vedere che la notte in mezzo non viene contata: se lo
   fosse i chilometri sarebbero quattro, non due. */
const stato = {
  trips: [{
    id: 1730000000009, name: 'Il nostro Giappone', destination: 'Tokyo',
    currency: 'EUR', status: 'open', start: '2026-04-01', end: '2026-04-02',
    // gli id delle persone sono numeri, come quelli veri che escono da uid()
    participants: [{ id: 1, name: 'Gepp', isMe: true }, { id: 2, name: 'Anna' },
                   { id: 3, name: 'Bruno' }, { id: 4, name: 'Carla' }],
    /* photo e _photoTry servono a tenere zitta l'app: di suo va a cercarsi le
       foto dei luoghi in una coda con 1200 ms di pausa fra uno e l'altro, e
       quel traffico non c'entra col ricordo — ma sporcava il controllo che
       conta, quello che dice che aprire il ricordo non chiama nessuno. */
    pois: [{ id: 'x1', name: 'Senso-ji', lat: 45.4750, lng: 9.1900, priority: 'essential', photo: 'x', _photoTry: 99 },
           { id: 'x2', name: 'Shibuya', lat: 45.4840, lng: 9.1900, priority: 'essential', photo: 'x', _photoTry: 99 }],
    expenses: [
      { id: 'e1', desc: 'Ramen', amount: 40, category: 'Cibo', payerId: 1, splitAmong: [1,2,3,4] },
      { id: 'e2', desc: 'Ryokan', amount: 360, category: 'Hotel', payerId: 2, splitAmong: [1,2,3,4] },
      { id: 'e3', desc: 'Metro', amount: 20, category: 'Trasporti', payerId: 1, splitAmong: [1,2,3,4] },
      // un rimborso fra due persone non è una spesa del viaggio: non deve contare
      { id: 'e4', desc: 'Ti rendo', amount: 100, type: 'transfer', payerId: 2, splitAmong: [1] }
    ],
    tickets: [], hotels: [], weather: {}, createdAt: 1,
    days: [
      { id: 'd1', date: '2026-04-01', title: 'Il primo', activities: [
        { id: 'a1', name: 'Senso-ji', time: '09:00', timeEnd: '10:00', completed: true, _photoTry: 99, lat: 45.4750, lng: 9.1900 },
        { id: 'a2', name: 'Shibuya', time: '11:00', timeEnd: '12:00', completed: true, _photoTry: 99, lat: 45.4840, lng: 9.1900 },
        { id: 'a3', name: 'Cena', time: '20:00', timeEnd: '21:00', completed: false, _photoTry: 99 }
      ] },
      { id: 'd2', date: '2026-04-02', title: '', activities: [
        { id: 'a4', name: 'Ueno', time: '09:00', timeEnd: '10:00', completed: true, _photoTry: 99, lat: 45.5000, lng: 9.1900 },
        { id: 'a5', name: 'Akihabara', time: '11:00', timeEnd: '12:00', completed: false, _photoTry: 99, lat: 45.5090, lng: 9.1900 }
      ] }
    ]
  }],
  currentTripId: 1730000000009, settings: { proxRadius: 200 }, myName: 'Gepp'
};

(async () => {
  const browser = await apriBrowser();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const err = [];
  page.on('pageerror', e => err.push('PAGEERROR: ' + e.message));

  await page.route('**/leaflet@1.9.4/dist/leaflet.js', ro => ro.fulfill({
    status: 200, contentType: 'application/javascript', body: fs.readFileSync(leafletJs(), 'utf8') }));
  await page.route('**/tile.openstreetmap.org/**', ro => ro.fulfill({
    status: 200, contentType: 'image/png',
    body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64') }));

  const fuori = [];
  page.on('request', r => { if (/^https?:/.test(r.url())) fuori.push(r.url()); });

  await page.addInitScript(s => localStorage.setItem('geppgo2', JSON.stringify(s)), stato);
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.apriRicordo === 'function', { timeout: 20000 });
  await page.waitForTimeout(400);

  const r = [];
  const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);

  // ── i numeri ─────────────────────────────────────────────────────────────
  const n = await page.evaluate(() => {
    const t = app.trips[0];
    const x = ricordoNumeri(t);
    return { giorni: x.giorni, tappe: x.tappe, fatte: x.fatte, luoghi: x.luoghi,
      persone: x.persone, spesa: x.spesa, aTesta: x.aTesta, km: x.km,
      cat: x.cat, catSpesa: x.catSpesa, pieno: x.pieno && x.pieno.id, rotta: x.rotta.length };
  });
  ok('conta i giorni', n.giorni === 2, String(n.giorni));
  ok('conta le tappe', n.tappe === 5, String(n.tappe));
  ok('e quante ne sono state fatte davvero', n.fatte === 3, String(n.fatte));
  ok('conta i luoghi salvati', n.luoghi === 2, String(n.luoghi));
  ok('conta le persone', n.persone === 4, String(n.persone));
  ok('somma le spese', n.spesa === 420, String(n.spesa));
  ok('e NON conta i rimborsi fra persone', n.spesa === 420, n.spesa === 520 ? 'ha contato anche il rimborso' : 'giusto');
  ok('divide per quante erano', n.aTesta === 105, String(n.aTesta));
  ok('dice dove è andata di più', n.cat === 'Hotel' && n.catSpesa === 360, n.cat + ' ' + n.catSpesa);
  ok('trova il giorno più pieno', n.pieno === 'd1', String(n.pieno));
  /* Due chilometri, non quattro: fra la sera di un giorno e la mattina dopo
     si è dormito, e quel pezzo non è strada percorsa. */
  ok('conta i chilometri dentro la giornata', n.km === 2, n.km + ' km');
  ok('e non ci mette dentro la notte', n.km !== 4, n.km === 4 ? 'ha contato anche il salto fra i giorni' : 'giusto');
  ok('il filo del viaggio ha tutte le tappe con una posizione', n.rotta === 4, String(n.rotta));

  // ── si apre ──────────────────────────────────────────────────────────────
  /* Le code delle foto sono già disinnescate dallo stato di partenza, ma si
     aspetta comunque che la pagina sia zitta prima di cominciare a contare.
     L'attesa è più lunga della pausa che l'app si prende fra una richiesta e
     l'altra (1200 ms): con una finestra più corta si dichiarava "silenzio" a
     metà della coda e la prova bocciava il colpevole sbagliato. */
  let ultime = -1;
  for (let i = 0; i < 20 && ultime !== fuori.length; i++) {
    ultime = fuori.length;
    await page.waitForTimeout(1500);
  }
  fuori.length = 0;
  await page.evaluate(() => apriRicordo(app.trips[0].id));
  await page.waitForTimeout(700);
  const aperto = await page.evaluate(() => ({
    visibile: document.getElementById('mRicordo').classList.contains('active'),
    titolo: document.getElementById('ricordoTitolo').textContent,
    testo: document.getElementById('ricordoBody').innerText,
    canvas: !!document.getElementById('ricordoCv')
  }));
  ok('il ricordo si apre', aperto.visibile === true);
  ok('e porta il nome del viaggio', /Il nostro Giappone/.test(aperto.titolo), aperto.titolo);
  ok('dentro ci sono i numeri', /420/.test(aperto.testo) && /2 km|2\s*km/.test(aperto.testo),
     aperto.testo.replace(/\n+/g, ' / ').slice(0, 120));
  ok('dice dove è andata di più la spesa', /Hotel/.test(aperto.testo));
  ok('e qual è stato il giorno più pieno', /giorno più pieno/i.test(aperto.testo));
  ok('c\'è la cartolina', aperto.canvas === true);

  /* LA REGOLA: aprire il ricordo non deve parlare con nessuno. Se un giorno
     qualcuno lo trasformasse in una pagina da caricare da qualche parte,
     questa prova diventerebbe rossa. */
  ok('aprirlo non chiama nessun server', fuori.length === 0, fuori.join(', ') || 'nessuna chiamata');

  // ── il racconto ──────────────────────────────────────────────────────────
  const testo = await page.evaluate(() => ricordoTesto(app.trips[0]));
  ok('il racconto dice dove si è stati', /Tokyo/.test(testo), testo);
  ok('e quanti giorni', /2 giorni/.test(testo));
  ok('e in quanti', /4 persone/.test(testo));
  ok('e quanto si è speso', /420/.test(testo));
  ok('e i chilometri', /2 km/.test(testo));
  /* La riga che porta gente nuova: chi riceve il racconto deve capire da dove
     viene, altrimenti il "dopo viaggio" non serve a niente. */
  ok('nomina GeppGo, che è il motivo per cui esiste', /GeppGo/.test(testo));
  /* E LA REGOLA DALL'ALTRO LATO: un racconto è fatto per essere girato, un
     invito no. Il codice che fa entrare nel viaggio non ci deve stare. */
  ok('NON contiene il codice d\'invito', !/#join=/.test(testo) && !/#c=/.test(testo), testo);

  // ── la cartolina si disegna davvero ──────────────────────────────────────
  const dis = await page.evaluate(() => {
    const cv = document.getElementById('ricordoCv');
    const g = cv.getContext('2d');
    const d = g.getImageData(0, 0, cv.width, cv.height).data;
    const colori = new Set();
    for (let i = 0; i < d.length; i += 4 * 997) colori.add(d[i] + ',' + d[i+1] + ',' + d[i+2]);
    return { larga: cv.width, alta: cv.height, colori: colori.size };
  });
  ok('la cartolina ha la forma giusta', dis.larga === 1080 && dis.alta === 1350, dis.larga + '×' + dis.alta);
  ok('e non è un rettangolo vuoto', dis.colori > 3, dis.colori + ' colori diversi');

  const peso = await page.evaluate(() => new Promise(res => {
    document.getElementById('ricordoCv').toBlob(b => res(b ? { tipo: b.type, byte: b.size } : null), 'image/jpeg', .92);
  }));
  ok('e diventa un\'immagine da mandare', !!peso && peso.tipo === 'image/jpeg' && peso.byte > 3000,
     peso ? peso.tipo + ' ' + peso.byte + ' byte' : '(niente)');

  // ── le foto: di suo NON ci sono ──────────────────────────────────────────
  const senzaFoto = await page.evaluate(() => ({
    scelta: ricordoConFoto,
    box: (document.getElementById('ricordoFotoScelta') || {}).innerText || ''
  }));
  ok('senza foto nel viaggio non si propone niente', senzaFoto.scelta === false && senzaFoto.box === '',
     senzaFoto.box.slice(0, 60));

  // adesso due foto nel diario di questo viaggio
  await page.evaluate(async () => {
    const tinta = c => { const cv = document.createElement('canvas'); cv.width = cv.height = 64;
      const g = cv.getContext('2d'); g.fillStyle = c; g.fillRect(0, 0, 64, 64);
      return cv.toDataURL('image/jpeg', .9); };
    const db = await idbP();
    for (const [i, c] of [['f1', '#ff0000'], ['f2', '#ff0000']]) {
      await new Promise(res => { db.transaction('ph', 'readwrite').objectStore('ph').put({
        id: i, tripId: app.trips[0].id, date: '2026-04-01', ts: Date.now(), data: tinta(c) }).onsuccess = res; });
    }
  });
  await page.evaluate(() => apriRicordo(app.trips[0].id));
  await page.waitForTimeout(900);
  const conFoto = await page.evaluate(() => ({
    quante: ricordoQuanteFoto,
    scelta: ricordoConFoto,
    box: (document.getElementById('ricordoFotoScelta') || {}).innerText || ''
  }));
  ok('trova le foto del viaggio', conFoto.quante === 2, String(conFoto.quante));
  /* Le foto sono di tutti quelli che erano lì: chi manda la cartolina fuori
     dal gruppo deve sceglierlo lui, non trovarcele dentro. */
  ok('ma di suo NON le mette nella cartolina', conFoto.scelta === false);
  ok('lo propone, e dice che le foto sono di tutti',
     /quattro foto/i.test(conFoto.box) && /di tutti/i.test(conFoto.box), conFoto.box.replace(/\n+/g, ' / '));

  const rosso = () => page.evaluate(() => {
    const cv = document.getElementById('ricordoCv'), g = cv.getContext('2d');
    const d = g.getImageData(0, 700, cv.width, 400).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] > 180 && d[i+1] < 90 && d[i+2] < 90) n++;
    return n;
  });
  const primaR = await rosso();
  await page.evaluate(() => ricordoConLeFoto(true));
  await page.waitForTimeout(600);
  const dopoR = await rosso();
  ok('accendendo la scelta le foto ci finiscono davvero', dopoR > 5000 && primaR === 0,
     'prima ' + primaR + ' punti rossi, dopo ' + dopoR);
  await page.evaluate(() => ricordoConLeFoto(false));
  await page.waitForTimeout(500);
  ok('e si possono togliere', (await rosso()) === 0);

  // ── da dove ci si arriva ─────────────────────────────────────────────────
  const dalDettaglio = await page.evaluate(() => {
    closeSheet('mRicordo');
    openDetail(app.trips[0].id);
    const b = [...document.querySelectorAll('#detailBody button')].find(x => /ricordo/i.test(x.textContent));
    return b ? b.getAttribute('onclick') : null;
  });
  ok('dalla scheda del viaggio si riapre quando si vuole', /apriRicordo\(/.test(dalDettaglio || ''), String(dalDettaglio));

  /* Concludere un viaggio lo apre da solo: è l'unico momento in cui uno ha
     davvero voglia di guardare com'è andata. */
  const concludendo = await page.evaluate(async () => {
    closeSheet('mDetail'); closeSheet('mRicordo');
    closeFromDetail(app.trips[0].id);
    await new Promise(r => setTimeout(r, 600));
    return { aperto: document.getElementById('mRicordo').classList.contains('active'),
             stato: app.trips[0].status };
  });
  ok('concludere un viaggio apre il ricordo', concludendo.aperto === true);
  ok('e il viaggio risulta concluso', concludendo.stato === 'closed', concludendo.stato);

  // ── un viaggio vuoto non deve rompere niente ─────────────────────────────
  const vuoto = await page.evaluate(async () => {
    app.trips.push({ id: 999, name: 'Appena creato', destination: '', currency: 'EUR',
      status: 'open', participants: [], pois: [], expenses: [], tickets: [], hotels: [],
      weather: {}, days: [], createdAt: Date.now() });
    save();
    let rotto = '';
    try { await apriRicordo(999); } catch (e) { rotto = e.message; }
    await new Promise(r => setTimeout(r, 500));
    return { rotto, testo: ricordoTesto(app.trips.find(t => t.id === 999)),
             aperto: document.getElementById('mRicordo').classList.contains('active') };
  });
  ok('un viaggio senza niente dentro non fa saltare il ricordo', vuoto.rotto === '', vuoto.rotto);
  ok('si apre lo stesso', vuoto.aperto === true);
  ok('e il racconto resta una frase sensata', /Appena creato/.test(vuoto.testo) && /GeppGo/.test(vuoto.testo), vuoto.testo);

  console.log('\n' + r.join('\n'));
  const falliti = r.filter(x => x.includes('FALLITO')).length;
  console.log(`\n${r.length - falliti}/${r.length} passati`);
  if (err.length) console.log('\nErrori in pagina:\n' + err.join('\n'));
  await browser.close();
  process.exit(falliti || err.length ? 1 : 0);
})();
