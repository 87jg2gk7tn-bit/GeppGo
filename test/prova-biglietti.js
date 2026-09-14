/* I biglietti.

   I biglietti sono per le ATTRAZIONI: un ingresso al castello, un museo, una
   torre. Da lì viene tutto il resto.

   IL DIFETTO. Il filtro «di chi vuoi vedere i biglietti» partiva su TE quando
   il viaggio aveva più di una persona. Ma un ingresso preso per il gruppo non
   è «di» nessuno in particolare, e quasi mai uno si ferma a dire di chi è
   ciascuno: così aprendo la sezione si leggeva «Nessun biglietto intestato a
   Gepp» mentre il viaggio i biglietti ce li aveva, e l'unico appiglio era una
   scritta grigia da dodici pixel. Partire da te sembrava un riguardo ed era
   un inganno.

   E L'ARIA. Tre modi per fare la stessa cosa erano tre tasti in due stili,
   e prima di poterli usare c'erano sei righe di grigio — il muro di testo più
   alto dell'app.

   Sul codice di prima la prima riga è già rossa. */
const { apriBrowser, APP, leafletJs } = require('./browser');
const fs = require('fs');

const oggi = new Date().toISOString().slice(0, 10);
const domani = new Date(Date.now() + 864e5).toISOString().slice(0, 10);

const castello = {
  id: 12, name: 'Castello di Praga', time: '11:00', timeEnd: '13:00',
  lat: 50.09, lng: 14.40, who: [1, 2], completed: false, type: 'outdoor',
  booking: { needed: false, done: false }
};

/* Due persone e biglietti SENZA NOME: è il caso normale, non un caso
   limite. Uno aggiunge l'ingresso al castello e non si ferma a dire di chi
   è — e infatti non è di nessuno, è del gruppo. */
const stato = (biglietti, persone) => ({
  trips: [{
    id: 1, name: 'Praga', destination: 'Praga', currency: 'CZK', status: 'open',
    start: oggi, end: domani,
    participants: persone || [{ id: 1, name: 'Gepp', isMe: true }, { id: 2, name: 'Luca' }],
    pois: [], expenses: [], hotels: [], weather: {}, createdAt: 1,
    tickets: biglietti,
    days: [{ id: 'd1', date: oggi, title: '', activities: [] },
           { id: 'd2', date: domani, title: '', activities: [castello] }]
  }],
  currentTripId: 1, settings: {}, myName: 'Gepp', skipAuth: true
});

const TRE = [
  { id: 7, name: 'Castello di Praga', code: 'PRG-4412', format: 'qrcode', type: 'attraction', actId: 12 },
  { id: 8, name: 'Ingresso torre', code: 'PRG-9001', format: 'qrcode', type: 'attraction', actId: 12 },
  { id: 9, name: 'Museo Kafka', code: 'KAF-77', format: 'qrcode', type: 'attraction' }
];

(async () => {
  const browser = await apriBrowser();
  const r = [];
  const err = [];
  const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);

  async function apri(st) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', e => err.push('PAGEERROR: ' + e.message.split('\n')[0]));
    await page.route('**/leaflet@1.9.4/dist/leaflet.js', ro => ro.fulfill({
      status: 200, contentType: 'application/javascript', body: fs.readFileSync(leafletJs(), 'utf8') }));
    await page.route(/tile\.openstreetmap\.org/, ro => ro.abort());
    await page.route(/api\.open-meteo\.com/, ro => ro.abort());
    await page.addInitScript(s => localStorage.setItem('geppgo2', JSON.stringify(s)), st);
    await page.goto(APP, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof renderTickets === 'function', { timeout: 20000 });
    await page.evaluate(() => { go('tickets'); const s = document.querySelector('.scroll'); if (s) s.scrollTop = 0; });
    await page.waitForTimeout(700);
    return page;
  }

  // ══ IL DIFETTO: la sezione diceva di non avere quello che aveva ══════
  let page = await apri(stato(TRE));
  const primo = await page.evaluate(() => ({
    filtro: typeof tkWhoVal === 'function' ? tkWhoVal(T()) : 'manca',
    testo: document.getElementById('ticketsList').innerText.replace(/\s+/g, ' ').trim(),
    quantiMostrati: document.querySelectorAll('#ticketsList .ticket').length,
    quantiNelViaggio: T().tickets.length
  }));
  ok('aprendo i biglietti si parte da tutti, non da te', primo.filtro === 'tutti', primo.filtro);
  ok('e NON dice di non averne mentre ce ne sono',
     !/Nessun biglietto/i.test(primo.testo),
     primo.testo.slice(0, 60));
  ok('i biglietti del viaggio si vedono tutti',
     primo.quantiMostrati === primo.quantiNelViaggio,
     primo.quantiMostrati + ' mostrati su ' + primo.quantiNelViaggio);

  /* Il filtro per persona resta: serve a chi il viaggio lo ha diviso
     davvero. È un affinamento, non la porta d'ingresso. */
  const filtrato = await page.evaluate(async () => {
    setTkWho('1');
    await new Promise(r2 => setTimeout(r2, 400));
    const dopo = { testo: document.getElementById('ticketsList').innerText, filtro: tkWhoVal(T()) };
    setTkWho('tutti');
    await new Promise(r2 => setTimeout(r2, 400));
    return dopo;
  });
  ok('ma se lo chiedi tu, il filtro per persona c\'è ancora',
     filtrato.filtro === '1' && /Nessun biglietto intestato/i.test(filtrato.testo),
     filtrato.filtro);
  ok('e da lì si torna indietro con un tasto, non con un link grigio',
     await page.evaluate(async () => {
       setTkWho('1'); await new Promise(r2 => setTimeout(r2, 400));
       const b = [...document.querySelectorAll('#ticketsList button')]
         .find(x => /Vedi tutti i biglietti/i.test(x.textContent));
       if (b) b.click();
       await new Promise(r2 => setTimeout(r2, 400));
       return tkWhoVal(T()) === 'tutti';
     }) === true);

  // ══ i tre modi sono tre, e sono uguali ═══════════════════════════════
  const modi = await page.evaluate(() => {
    const m = [...document.querySelectorAll('#tickets .tk-modo')];
    const b = m.map(x => x.getBoundingClientRect());
    return {
      quanti: m.length,
      classi: [...new Set(m.map(x => x.className))].length,
      largheUguali: b.length === 3 && Math.max(...b.map(x => x.width)) - Math.min(...b.map(x => x.width)) < 1.5,
      alteUguali: b.length === 3 && Math.max(...b.map(x => x.height)) - Math.min(...b.map(x => x.height)) < 1.5,
      inFila: b.length === 3 && Math.max(...b.map(x => x.top)) - Math.min(...b.map(x => x.top)) < 1.5,
      etichette: m.map(x => x.textContent.replace(/\s+/g, ' ').trim())
    };
  });
  ok('ci sono tre modi per aggiungere un biglietto', modi.quanti === 3, modi.quanti + ' modi');
  /* Uno pieno e due vuoti dicevano che il primo conta più degli altri, e non
     è vero: dipende solo da dove ce l'hai, il biglietto. */
  ok('e sono tre tasti uguali, non uno pieno e due vuoti',
     modi.classi === 1 && modi.largheUguali && modi.alteUguali && modi.inFila,
     modi.classi + ' stili · ' + modi.etichette.join(' | '));

  // ══ il muro di testo sta dietro una porta ════════════════════════════
  const spiega = await page.evaluate(async () => {
    const d = document.querySelector('#tickets .spiega');
    if (!d) return { cè: false };
    const chiusa = !d.open;
    const primaAltezza = Math.round(d.getBoundingClientRect().height);
    d.querySelector('summary').click();
    await new Promise(r2 => setTimeout(r2, 250));
    return { cè: true, chiusa, aperta: d.open,
             primaAltezza, dopoAltezza: Math.round(d.getBoundingClientRect().height),
             dentro: d.innerText.replace(/\s+/g, ' ') };
  });
  ok('la spiegazione parte chiusa, invece di occupare mezza schermata',
     spiega.cè === true && spiega.chiusa === true && spiega.primaAltezza < 60,
     spiega.primaAltezza + 'px da chiusa');
  ok('e toccandola si apre', spiega.aperta === true && spiega.dopoAltezza > spiega.primaAltezza + 40,
     spiega.dopoAltezza + 'px da aperta');
  /* La cosa che tranquillizza davvero non si perde per strada: che leggere
     un codice qui dentro non lo consumi è la paura di chiunque. */
  ok('e dentro c\'è ancora la cosa che conta: leggere non consuma il biglietto',
     /non lo consuma/i.test(spiega.dentro || ''), (spiega.dentro || '').slice(0, 50));
  await page.close();

  // ══ si raggruppano per attrazione, e dicono anche QUANDO ═════════════
  page = await apri(stato(TRE));
  const gruppi = await page.evaluate(() => ({
    titoli: [...document.querySelectorAll('#ticketsList .card-h')].map(x => x.textContent.trim()),
    sotto: [...document.querySelectorAll('#ticketsList .card-sub')].map(x => x.textContent.trim()),
    etichette: [...document.querySelectorAll('#ticketsList .section-label')].map(x => x.textContent.trim())
  }));
  ok('i biglietti stanno sotto l\'attrazione a cui servono',
     gruppi.titoli.length === 1 && /Castello di Praga/.test(gruppi.titoli[0]), gruppi.titoli.join(' | '));
  ok('e quanti sono', /2 bigliett/.test(gruppi.sotto[0] || ''), gruppi.sotto[0]);
  /* Un biglietto è di un'attrazione ma anche di un MOMENTO: sapere che il
     castello è martedì alle undici è metà dell'informazione. */
  ok('e dicono anche quando ci vai: giorno, data e ora',
     /Giorno 2/.test(gruppi.sotto[0] || '') && /11:00/.test(gruppi.sotto[0] || ''), gruppi.sotto[0]);
  /* Quello non attaccato a nessuna tappa non resta orfano in fondo senza
     dire chi è. */
  ok('e quello senza una tappa ha un titolo suo, non resta orfano',
     gruppi.etichette.some(x => /Non collegati/i.test(x)), gruppi.etichette.join(' | '));
  await page.close();

  /* Se NESSUN biglietto è attaccato a una tappa, "Non collegati" non vuol
     dire niente: non c'è nessun collegato da cui distinguerli. */
  page = await apri(stato([TRE[2]]));
  const soli = await page.evaluate(() => ({
    etichette: [...document.querySelectorAll('#ticketsList .section-label')].map(x => x.textContent.trim()),
    quanti: document.querySelectorAll('#ticketsList .ticket').length
  }));
  ok('se nessuno è attaccato a una tappa, il titolo non dice «non collegati»',
     soli.etichette.length === 1 && !/Non collegati/i.test(soli.etichette[0]), soli.etichette.join(' | '));
  ok('e il biglietto si vede lo stesso', soli.quanti === 1, soli.quanti + ' biglietti');
  await page.close();

  /* Da soli il filtro non ha senso e infatti non compare: una tendina con
     una voce sola è una tendina di troppo. */
  page = await apri(stato(TRE, [{ id: 1, name: 'Gepp', isMe: true }]));
  const daSoli = await page.evaluate(() => ({
    barra: document.getElementById('tkWhoBar').innerHTML.trim().length,
    quanti: document.querySelectorAll('#ticketsList .ticket').length
  }));
  ok('viaggiando da solo il filtro per persona non compare nemmeno',
     daSoli.barra === 0, daSoli.barra + ' caratteri');
  ok('e i biglietti si vedono tutti lo stesso', daSoli.quanti === 3, daSoli.quanti + ' biglietti');
  await page.close();

  /* ══ e la mappa che l'assistente legge dice la stessa cosa ══════════════
     MAPPA_APP è quello che l'assistente dell'app ha davanti quando qualcuno
     gli chiede «da dove si vedono i biglietti». Nessuno controllava che
     fosse ancora vero, e infatti cambiando il filtro la mappa è rimasta a
     dire «di suo parte dai tuoi» per un po': l'assistente avrebbe risposto
     una cosa e la schermata ne avrebbe fatta un'altra. Qui le due si
     misurano una contro l'altra, così la prossima volta se ne accorge la
     prova e non l'utente. */
  page = await apri(stato(TRE));
  const mappa = await page.evaluate(() => {
    const m = typeof MAPPA_APP === 'string' ? MAPPA_APP : '';
    const bigl = (m.split(/Biglietti:/)[1] || '').split(/\n/)[0];
    return {
      cè: !!bigl,
      diceTutti: /parte da TUTTI/i.test(bigl),
      diceTuoi: /parte dai tuoi/i.test(bigl),
      filtroVero: tkWhoVal(T())
    };
  });
  ok('la mappa dell\'assistente parla dei biglietti', mappa.cè === true);
  ok('e dice da dove parte l\'elenco così come parte davvero',
     (mappa.filtroVero === 'tutti') === (mappa.diceTutti && !mappa.diceTuoi),
     'mappa: ' + (mappa.diceTutti ? 'tutti' : mappa.diceTuoi ? 'tuoi' : 'non lo dice')
       + ' · schermata: ' + mappa.filtroVero);
  await page.close();

  await browser.close();
  for (const e of err) r.push(' FALLITO  ' + e);
  const passati = r.filter(x => x.startsWith('  OK')).length;
  console.log(r.join('\n'));
  console.log(`\n${passati}/${r.length} passati`);
  process.exit(passati === r.length ? 0 : 1);
})();
