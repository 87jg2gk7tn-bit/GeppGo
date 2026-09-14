/* La Time Table: i tasti sopra la griglia, e come è fatta la griglia.

   Due cose separate, chieste insieme.

   I TASTI. Erano quattro, in tre stili diversi, uno accanto all'altro, e
   spingevano la giornata sotto la piega. Ma non sono quattro cose dello
   stesso tipo: «Naviga la giornata» e «Chiedi all'assistente» si usano
   CAMMINANDO, «Ordina il giro con l'IA» e «Autopilota» da fermi, mentre il
   viaggio si costruisce. Quindi due restano in vista e due stanno dietro una
   porta che dice cosa c'è dentro.

   LA GRIGLIA. Era l'unico posto dell'app rimasto coi rettangoli color sabbia
   e il bordo di un pixel, mentre tutto il resto è passato a schede bianche
   con l'ombra morbida. E non diceva a che punto della giornata sei.

   Sul codice di prima non parte: .tt-az non esiste. */
const { apriBrowser, APP, leafletJs } = require('./browser');
const fs = require('fs');

const oggi = new Date().toISOString().slice(0, 10);
const domani = new Date(Date.now() + 864e5).toISOString().slice(0, 10);

const tappa = (id, name, time, timeEnd, lat, lng) => ({
  id, name, time, timeEnd, lat, lng, who: [1], completed: false,
  type: 'outdoor', booking: { needed: false, done: false }, notes: ''
});

const stato = (titoloGiorno) => ({
  trips: [{
    id: 1, name: 'Praga', destination: 'Praga', currency: 'CZK', status: 'open',
    start: oggi, end: domani,
    participants: [{ id: 1, name: 'Gepp', isMe: true }],
    pois: [], expenses: [], tickets: [], hotels: [], weather: {}, createdAt: 1,
    days: [
      { id: 'd1', date: oggi, title: titoloGiorno || '', activities: [
        tappa(11, 'Ponte Carlo', '09:30', '10:30', 50.0865, 14.4114),
        tappa(12, 'Castello di Praga', '11:00', '13:00', 50.0900, 14.4000)] },
      { id: 'd2', date: domani, title: '', activities: [
        tappa(21, 'Vyšehrad', '10:00', '12:00', 50.0640, 14.4180)] }]
  }],
  currentTripId: 1, settings: { proxRadius: 200 }, myName: 'Gepp', skipAuth: true
});

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
    await page.route('**/leaflet@1.9.4/dist/leaflet.css', ro => ro.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await page.route(/tile\.openstreetmap\.org/, ro => ro.abort());
    await page.route(/api\.open-meteo\.com/, ro => ro.abort());
    await page.addInitScript(s => localStorage.setItem('geppgo2', JSON.stringify(s)), st);
    await page.goto(APP, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof openTimetable === 'function', { timeout: 20000 });
    await page.evaluate(() => openTimetable());
    await page.waitForTimeout(1300);
    return page;
  }

  // ══ i tasti sopra la griglia ═════════════════════════════════════════
  let page = await apri(stato());
  const tasti = await page.evaluate(() => {
    const az = [...document.querySelectorAll('.tt-az')];
    const b = az.map(x => x.getBoundingClientRect());
    const testo = document.querySelector('#mDay .tt-sheet').innerText;
    return {
      quanti: az.length,
      etichette: az.map(x => x.textContent.replace(/\s+/g, ' ').trim()),
      /* Stessa classe e stessa larghezza: è un invito solo, in due modi.
         Prima erano tre stili diversi in fila. */
      largheUguali: b.length === 2 && Math.abs(b[0].width - b[1].width) < 1.5,
      inFila: b.length === 2 && Math.abs(b[0].top - b[1].top) < 1.5,
      porta: !!document.querySelector('.tt-costruisci'),
      portaTesto: (document.querySelector('.tt-costruisci') || {}).textContent,
      /* I due da tavolino NON devono stare a schermo. */
      ordinaAschermo: /Ordina il giro/.test(testo),
      autopilotaAschermo: /Autopilota/.test(testo)
    };
  });
  ok('sopra la griglia ci sono due tasti, non quattro', tasti.quanti === 2, tasti.quanti + ' tasti');
  ok('e sono le due cose che si fanno camminando',
     /Naviga la giornata/.test(tasti.etichette.join(' ')) &&
     /Chiedi all'assistente/.test(tasti.etichette.join(' ')), tasti.etichette.join(' | '));
  ok('sono uguali fra loro e larghi uguale, invece di tre stili in fila',
     tasti.largheUguali === true && tasti.inFila === true);
  ok('gli altri due non sono più a schermo',
     tasti.ordinaAschermo === false && tasti.autopilotaAschermo === false,
     `ordina ${tasti.ordinaAschermo}, autopilota ${tasti.autopilotaAschermo}`);
  ok('ma c\'è una porta che dice cosa c\'è dietro',
     tasti.porta === true && /Costruisci la giornata/.test(tasti.portaTesto || ''), tasti.portaTesto);

  /* Se la porta non c'è, la prova deve DIRLO invece di schiantarsi: un
     elenco di guasti spiega cosa manca, un'eccezione no. */
  const dentro = await page.evaluate(async () => {
    const attendi = ms => new Promise(r2 => setTimeout(r2, ms));
    const porta = document.querySelector('.tt-costruisci');
    if (!porta) return { aperto: false, quanti: 0, titoli: [], spiegati: false };
    porta.click();
    await attendi(450);
    const f = document.getElementById('mCostruisci');
    const str = [...document.querySelectorAll('.tt-strumento')];
    return {
      aperto: !!f && f.classList.contains('active'),
      quanti: str.length,
      titoli: str.map(x => (x.querySelector('.ts-t') || {}).textContent),
      /* Ognuno deve dire cosa fa: "Autopilota" da solo non lo sa nessuno. */
      spiegati: str.every(x => ((x.querySelector('.ts-s') || {}).textContent || '').length > 30)
    };
  });
  ok('toccandola si apre il foglio degli strumenti', dentro.aperto === true);
  ok('e dentro ci sono tutti e due', dentro.quanti === 2 &&
     /Ordina il giro/.test(dentro.titoli.join(' ')) && /Autopilota/.test(dentro.titoli.join(' ')),
     dentro.titoli.join(' | '));
  ok('e ognuno dice cosa fa, invece di essere solo un nome', dentro.spiegati === true);

  const parte = await page.evaluate(async () => {
    const attendi = ms => new Promise(r2 => setTimeout(r2, ms));
    let chiamato = '';
    const veroS = window.sistemaGiornata, veroA = window.openGenForDay;
    window.sistemaGiornata = () => { chiamato = 'ordina'; };
    window.openGenForDay = () => { chiamato = 'autopilota'; };
    const strum = re => [...document.querySelectorAll('.tt-strumento')].find(x => re.test(x.textContent));
    const s1 = strum(/Ordina il giro/);
    if (s1) s1.click();
    await attendi(400);
    const foglio = document.getElementById('mCostruisci');
    const uno = { chiamato, foglio: !!foglio && foglio.classList.contains('active') };
    if (foglio) openSheet('mCostruisci');
    await attendi(400); chiamato = '';
    const s2 = strum(/Autopilota/);
    if (s2) s2.click();
    await attendi(400);
    const due = { chiamato };
    window.sistemaGiornata = veroS; window.openGenForDay = veroA;
    if (foglio) closeSheet('mCostruisci');
    await attendi(400);
    return { uno, due };
  });
  ok('«Ordina il giro» fa partire l\'ordinamento e chiude il foglio',
     parte.uno.chiamato === 'ordina' && parte.uno.foglio === false,
     `${parte.uno.chiamato}, foglio aperto ${parte.uno.foglio}`);
  ok('e «Autopilota» apre l\'Autopilota', parte.due.chiamato === 'autopilota', parte.due.chiamato);

  // ══ la testata ══════════════════════════════════════════════════════
  const testata = await page.evaluate(() => {
    const tt = document.querySelector('.tt-title'), so = document.getElementById('dayTt');
    return {
      titolo: tt ? tt.textContent.trim() : '',
      serif: !!tt && /Fraunces/.test(getComputedStyle(tt).fontFamily),
      occhiello: (document.getElementById('ttEyebrow') || {}).textContent.replace(/\s+/g, ' ').trim(),
      sotto: so ? so.textContent.trim() : ''
    };
  });
  /* Il titolo dice in che schermata sei. Avevo provato a metterci la data
     in grande, come la home fa col nome della città, ed era stato bocciato:
     alla time-table ci si arriva anche da un link o dopo aver messo giù il
     telefono, e una data da sola non dice in che parte dell'app sei. */
  ok('il titolo dice in che schermata sei', testata.titolo === 'Time Table', testata.titolo);
  ok('ed è scritto col serif dell\'app', testata.serif === true);
  ok('l\'occhiello dice di che viaggio e di che giorno si tratta',
     /PRAGA/.test(testata.occhiello) && /1/.test(testata.occhiello), testata.occhiello);
  ok('e sotto c\'è la data del giorno che stai guardando',
     /\d/.test(testata.sotto) && /settembre|ottobre|novembre|dicembre|gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto/.test(testata.sotto),
     testata.sotto);
  await page.close();

  page = await apri(stato('Il giorno del castello'));
  const conNome = await page.evaluate(() => {
    const so = document.getElementById('dayTt');
    return { sotto: so ? so.textContent.trim() : '' };
  });
  ok('e se alla giornata hai dato un nome, quello viene prima della data',
     /^Il giorno del castello · /.test(conNome.sotto), conNome.sotto);
  await page.close();

  // ══ la griglia: schede come tutte le altre dell'app ══════════════════
  page = await apri(stato());
  const griglia = await page.evaluate(() => {
    const b = document.querySelector('.tt-block');
    if (!b) return { fondo: 'nessuna tappa', ombra: '', raggio: '0px',
                     bandella: { largh: '0px', sfondo: '' }, nomeSerif: false,
                     lineaParteDopo: false, lineaNonTratteggiata: false,
                     numeroSenzaRitaglio: false, trattoSenzaTratteggio: false };
    const st = getComputedStyle(b), pre = getComputedStyle(b, '::before');
    const nome = b.querySelector('.tname');
    const linea = document.querySelector('.tt-line');
    const numero = linea.querySelector('span');
    const sl = getComputedStyle(linea), sn = getComputedStyle(numero);
    const tr = document.querySelector('.tt-travel');
    return {
      fondo: st.backgroundColor,
      ombra: st.boxShadow,
      raggio: st.borderRadius,
      bandella: { largh: pre.width, sfondo: (pre.backgroundImage || '').slice(0, 30) },
      nomeSerif: /Fraunces/.test(getComputedStyle(nome).fontFamily),
      /* La riga dell'ora parte dopo la colonna delle ore, e il numero non ha
         più il rettangolo bianco dietro per tagliarla: era quello a far
         sembrare la griglia una tabella di vent'anni fa. */
      lineaParteDopo: parseFloat(sl.left) >= 40,
      lineaNonTratteggiata: sl.borderTopStyle === 'solid',
      numeroSenzaRitaglio: /rgba\(0, 0, 0, 0\)|transparent/.test(sn.backgroundColor),
      trattoSenzaTratteggio: tr ? getComputedStyle(tr).borderTopStyle !== 'dashed' : null
    };
  });
  ok('le tappe sono schede bianche come tutte le altre schede dell\'app',
     griglia.fondo === 'rgb(255, 255, 255)', griglia.fondo);
  ok('con l\'ombra morbida, non un bordo di un pixel',
     griglia.ombra !== 'none' && griglia.ombra.length > 4, griglia.ombra.slice(0, 40));
  ok('e gli angoli tondi come le altre', parseFloat(griglia.raggio) >= 12, griglia.raggio);
  ok('hanno la bandella d\'oro sul fianco, che le fa leggere come una fila',
     parseFloat(griglia.bandella.largh) >= 3 && /gradient/.test(griglia.bandella.sfondo),
     griglia.bandella.largh + ' ' + griglia.bandella.sfondo);
  ok('e il nome della tappa è nel serif con cui l\'app scrive i nomi',
     griglia.nomeSerif === true);
  ok('la riga dell\'ora non attraversa più la colonna delle ore',
     griglia.lineaParteDopo === true);
  ok('e il numero non ha più il rettangolo bianco dietro per tagliarla',
     griglia.numeroSenzaRitaglio === true);
  ok('la riga è piena, non tratteggiata', griglia.lineaNonTratteggiata === true);
  ok('e le targhette del tratto non sono più tratteggiate',
     griglia.trattoSenzaTratteggio === true, String(griglia.trattoSenzaTratteggio));

  // ══ la riga di adesso ════════════════════════════════════════════════
  const adesso = await page.evaluate(() => {
    const el = document.getElementById('ttAdesso');
    if (!el) return { cè: false };
    const n = new Date(), ora = n.getHours() + n.getMinutes() / 60;
    return {
      cè: true,
      top: parseFloat(el.style.top),
      atteso: (ora - 6) * TT_H,
      scritta: (el.querySelector('b') || {}).textContent,
      oraVera: String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0'),
      nonRubaIlTocco: getComputedStyle(el).pointerEvents === 'none'
    };
  });
  const fuoriOrario = new Date().getHours() < 6;
  if (fuoriOrario) {
    ok('prima delle sei la riga di adesso non si disegna', adesso.cè === false);
  } else {
    ok('se la giornata è oggi, una riga dice a che ora sei', adesso.cè === true);
  }
  /* Il resto ha senso solo se la riga c'è: senza questo, su un codice che
     non ce l'ha la prova si schianta invece di dire cosa manca. */
  if (!fuoriOrario && adesso.cè) {
    ok('e sta all\'ora giusta, non a occhio',
       Math.abs(adesso.top - adesso.atteso) < 2, `${Math.round(adesso.top)}px contro ${Math.round(adesso.atteso)}px`);
    ok('e lo scrive', adesso.scritta === adesso.oraVera, adesso.scritta + ' / ' + adesso.oraVera);
    ok('senza rubare il tocco alle tappe che ci passano sotto',
       adesso.nonRubaIlTocco === true);
    /* Ridisegnare tutta la time-table ogni minuto costerebbe caro e farebbe
       saltare un trascinamento a metà: si sposta solo la riga. */
    const cammina = await page.evaluate(() => {
      const el = document.getElementById('ttAdesso');
      el.style.top = '3px';
      adessoCammina();
      const n = new Date(), ora = n.getHours() + n.getMinutes() / 60;
      return { dopo: parseFloat(el.style.top), atteso: (ora - 6) * TT_H };
    });
    ok('e si rimette al posto giusto da sola, senza ridisegnare la giornata',
       Math.abs(cammina.dopo - cammina.atteso) < 2,
       `${Math.round(cammina.dopo)}px contro ${Math.round(cammina.atteso)}px`);
  }

  /* Su un giorno che non è oggi non vuol dire niente, e una riga che non
     vuol dire niente uno la legge lo stesso. */
  const domaniNiente = await page.evaluate(async () => {
    openDay(1);
    await new Promise(r2 => setTimeout(r2, 700));
    return !document.getElementById('ttAdesso');
  });
  ok('e su un giorno che non è oggi la riga non c\'è', domaniNiente === true);
  await page.close();

  await browser.close();
  for (const e of err) r.push(' FALLITO  ' + e);
  const passati = r.filter(x => x.startsWith('  OK')).length;
  console.log(r.join('\n'));
  console.log(`\n${passati}/${r.length} passati`);
  process.exit(passati === r.length ? 0 : 1);
})();
