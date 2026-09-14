/* Gli alloggi.

   IL DIFETTO. Un viaggio dal 14 al 18 ha quattro notti. Se un albergo
   copre il 14-16 e un altro il 17-18, la notte del 16 non ce l'ha
   nessuno — e questa schermata non lo diceva: mostrava due schede piatte
   con due date ciascuna, e il conto lo dovevi fare a mente. La cosa che
   una pagina di alberghi deve dire a colpo d'occhio è esattamente quella,
   e non la diceva.

   E DUE COSE CHE C'ERANO E NON SI VEDEVANO: quanto costa l'albergo e se è
   già pagato stavano nel viaggio da sempre, nella spesa collegata, ma per
   saperlo bisognava andare in Spese e cercare la riga giusta.

   Sul codice di prima la prima riga è già rossa. */
const { apriBrowser, APP, leafletJs } = require('./browser');
const fs = require('fs');

const g = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

/* Cinque giorni, quattro notti: 14→15, 15→16, 16→17, 17→18. */
const stato = (hotels, expenses, giorni) => ({
  trips: [{
    id: 1, name: 'Praga', destination: 'Praga', currency: 'CZK', status: 'open',
    start: g(0), end: g(giorni == null ? 4 : giorni),
    participants: [{ id: 1, name: 'Gepp', isMe: true }],
    pois: [], tickets: [], weather: {}, createdAt: 1,
    hotels: hotels || [], expenses: expenses || [],
    days: Array.from({ length: (giorni == null ? 4 : giorni) + 1 },
      (_, i) => ({ id: 'd' + i, date: g(i), title: '', activities: [] }))
  }],
  currentTripId: 1, settings: {}, myName: 'Gepp', skipAuth: true
});

const JOSEF = { id: 5, name: 'Hotel Josef', address: 'Rybná 20, Praha 1, Cechia',
  lat: 50.0895, lng: 14.4275, checkIn: g(0), checkOut: g(2) };
const LILIE = { id: 6, name: 'Pension U Lilie', address: 'Liliová 15, Praha',
  lat: 50.085, lng: 14.418, checkIn: g(3), checkOut: g(4) };
const TUTTO = { id: 7, name: 'Hotel Josef', address: 'Rybná 20, Praha 1',
  lat: 50.0895, lng: 14.4275, checkIn: g(0), checkOut: g(4) };

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
    await page.route(/nominatim\.openstreetmap\.org/, ro => ro.abort());
    await page.route(/photon\.komoot\.io/, ro => ro.abort());
    await page.addInitScript(s => localStorage.setItem('geppgo2', JSON.stringify(s)), st);
    await page.goto(APP, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof renderHotels === 'function', { timeout: 20000 });
    await page.evaluate(() => { go('hotels'); const s = document.querySelector('.scroll'); if (s) s.scrollTop = 0; });
    await page.waitForTimeout(600);
    return page;
  }

  // ══ il conto delle notti, che nessuno faceva ═════════════════════════
  let page = await apri(stato([JOSEF, LILIE]));
  const conto = await page.evaluate(() => ({
    notti: typeof nottiViaggio === 'function' ? nottiViaggio(T()).length : -1,
    /* La notte si conta da dove si DORME: l'ultimo giorno si torna a casa
       e non si dorme da nessuna parte. */
    ultimaNotteNonÈLUltimoGiorno: typeof nottiViaggio === 'function'
      && nottiViaggio(T()).indexOf(T().end) === -1,
    coperte: typeof copertura === 'function' ? copertura(T()).filter(x => x.hotel).length : -1,
    scoperte: typeof copertura === 'function' ? copertura(T()).filter(x => !x.hotel).map(x => x.notte) : []
  }));
  ok('un viaggio di cinque giorni ha quattro notti, non cinque', conto.notti === 4, conto.notti + ' notti');
  ok('e l\'ultimo giorno non è una notte: si torna a casa',
     conto.ultimaNotteNonÈLUltimoGiorno === true);
  ok('col 14-16 e il 17-18 tre notti sono coperte', conto.coperte === 3, conto.coperte + ' coperte');
  /* Il buco è quello vero: la notte del check-out del primo albergo, prima
     del check-in del secondo. */
  ok('e quella scoperta è proprio quella in mezzo',
     conto.scoperte.length === 1 && conto.scoperte[0] === new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10),
     conto.scoperte.join(', '));

  // ══ e adesso lo dice, invece di lasciartelo contare ══════════════════
  const visto = await page.evaluate(() => {
    const cop = document.getElementById('hotelNotti');
    const celle = [...document.querySelectorAll('#hotelNotti .ht-n')];
    return {
      cè: !!(cop && cop.innerHTML.trim()),
      quante: celle.length,
      piene: celle.filter(x => x.classList.contains('ok')).length,
      vuote: celle.filter(x => !x.classList.contains('ok')).length,
      testo: (cop ? cop.innerText : '').replace(/\s+/g, ' ').trim(),
      /* Non basta dire che manca: da qui si deve poter rimediare. */
      tasto: !!document.querySelector('#hotelNotti button')
    };
  });
  ok('le notti del viaggio si vedono tutte, una per una', visto.cè && visto.quante === 4,
     visto.quante + ' notti disegnate');
  ok('tre piene e una vuota, come sono davvero', visto.piene === 3 && visto.vuote === 1,
     visto.piene + ' piene, ' + visto.vuote + ' vuote');
  ok('e c\'è scritto quale notte manca, col suo nome',
     /Manca il letto/i.test(visto.testo), visto.testo.slice(0, 70));
  ok('e un tasto per rimediare, invece di un cartello', visto.tasto === true);
  /* Il tasto deve portare dove si cerca, non stare lì per bellezza. */
  ok('il tasto porta davvero sulla ricerca',
     await page.evaluate(async () => {
       const b = document.querySelector('#hotelNotti button');
       if (!b) return false;
       b.click();
       await new Promise(x => setTimeout(x, 500));
       return document.activeElement === document.getElementById('hotSearch');
     }) === true);
  await page.close();

  // ══ quanto costa e se è pagato: c'erano, e non si vedevano ═══════════
  page = await apri(stato([JOSEF],
    [{ id: 90, desc: 'Hotel · Hotel Josef', amount: 2400, origAmount: 2400, origCurrency: 'CZK',
       payerId: 1, category: 'Hotel', paid: false, splitAmong: [1], date: g(0), hotelId: 5 }]));
  const scheda = await page.evaluate(() => {
    const c = document.querySelector('#hotelList .card');
    return { testo: c ? c.innerText.replace(/\s+/g, ' ').trim() : '',
             tag: [...document.querySelectorAll('#hotelList .ht-tag')].map(x => x.textContent.trim()) };
  });
  ok('la scheda dice quante notti copre', scheda.tag.some(x => /2 notti/.test(x)), scheda.tag.join(' | '));
  /* Le cifre senza punteggiatura: come si raggruppano le migliaia lo decide
     la lingua della macchina, e non è quello che questa riga deve misurare.
     Cercando «2.400» la prova passava qui e cadeva su CI, dove lo stesso
     numero si scrive «2400,00». */
  ok('e quanto costa, senza dover andare in Spese',
     /2400/.test(scheda.tag.join(' ').replace(/\D/g, '')),
     scheda.tag.join(' | '));
  ok('e che è ancora da pagare', /da pagare/i.test(scheda.tag.join(' ')), scheda.tag.join(' | '));
  await page.close();

  // ══ quando è tutto a posto, lo dice piano ════════════════════════════
  page = await apri(stato([TUTTO]));
  const pieno = await page.evaluate(() => ({
    testo: ((document.getElementById('hotelNotti') || {}).innerText || '').replace(/\s+/g, ' ').trim(),
    tasto: !!document.querySelector('#hotelNotti button'),
    vuote: [...document.querySelectorAll('#hotelNotti .ht-n')].filter(x => !x.classList.contains('ok')).length
  }));
  ok('con tutte le notti coperte non resta nessun buco', pieno.vuote === 0, pieno.vuote + ' vuote');
  ok('e lo dice', /Tutte le 4 notti/i.test(pieno.testo), pieno.testo.slice(0, 60));
  /* Niente da rimediare, niente tasto: un tasto che non serve è rumore. */
  ok('e non ti mette davanti un tasto che non serve', pieno.tasto === false);
  await page.close();

  // ══ senza niente, la schermata non è un cartello che indica in su ════
  page = await apri(stato([]));
  const vuoto = await page.evaluate(() => {
    const t = ((document.getElementById('hotelNotti') || {}).innerText || '').replace(/\s+/g, ' ').trim();
    return { testo: t, tasto: (document.querySelector('#hotelNotti button') || {}).textContent,
             /* «Mancano 4 notti su 4» sarebbe un conto inutile. */
             nienteConto: !/4 notti su 4/.test(t) };
  });
  ok('senza alcun alloggio le notti si vedono lo stesso, tutte vuote',
     /Nessuna delle 4 notti/i.test(vuoto.testo), vuoto.testo.slice(0, 60));
  ok('e non fa il conto inutile «4 su 4»', vuoto.nienteConto === true);
  ok('e il tasto è quello pieno: è l\'unica cosa da fare qui',
     /Cerca un hotel/i.test(vuoto.tasto || '')
       && await page.evaluate(() => {
         const b = document.querySelector('#hotelNotti button');
         return !!b && b.classList.contains('btn-grad');
       }),
     vuoto.tasto);
  await page.close();

  // ══ un viaggio in giornata non ha notti, e non se ne inventa ═════════
  page = await apri(stato([], [], 0));
  const giornata = await page.evaluate(() => ({
    notti: typeof nottiViaggio === 'function' ? nottiViaggio(T()).length : -1,
    striscia: ((document.getElementById('hotelNotti') || {}).innerHTML || '').trim().length,
    /* Lì il cartello ci sta: non c'è nessuna notte da disegnare. */
    cartello: (document.querySelector('#hotelList .empty-t') || {}).textContent || '',
    azione: !!document.querySelector('#hotelList .empty button')
  }));
  ok('un viaggio tutto in giornata non ha notti', giornata.notti === 0, giornata.notti + ' notti');
  ok('e la striscia non compare', giornata.striscia === 0, giornata.striscia + ' caratteri');
  ok('ma il cartello sì, e ha l\'azione accanto',
     /Nessun alloggio/i.test(giornata.cartello) && giornata.azione === true, giornata.cartello);
  await page.close();

  // ══ il muro di testo della ricerca sta dietro una porta ══════════════
  page = await apri(stato([]));
  const spiega = await page.evaluate(async () => {
    const d = document.querySelector('#hotels .spiega');
    if (!d) return { cè: false };
    const chiusa = !d.open, prima = Math.round(d.getBoundingClientRect().height);
    d.querySelector('summary').click();
    await new Promise(x => setTimeout(x, 250));
    return { cè: true, chiusa, prima, dopo: Math.round(d.getBoundingClientRect().height),
             dentro: d.innerText.replace(/\s+/g, ' ') };
  });
  ok('la spiegazione della ricerca parte chiusa',
     spiega.cè === true && spiega.chiusa === true && spiega.prima < 60, spiega.prima + 'px da chiusa');
  ok('e aprendola c\'è ancora tutto quello che c\'era',
     spiega.dopo > spiega.prima + 40 && /Google Maps/.test(spiega.dentro || ''),
     spiega.dopo + 'px da aperta');
  await page.close();

  // ══ i due tondini senza nome ═════════════════════════════════════════
  page = await apri(stato([JOSEF]));
  const tondini = await page.evaluate(() => {
    const b = [...document.querySelectorAll('#hotelList .card-head button')];
    return { quanti: b.length,
             conNome: b.filter(x => (x.getAttribute('aria-label') || '').trim().length > 2).length,
             stessaMisura: b.length === 2 &&
               Math.abs(b[0].getBoundingClientRect().width - b[1].getBoundingClientRect().width) < 1.5 };
  });
  ok('i due tondini della scheda hanno un nome, per chi non vede le icone',
     tondini.conNome === 2, tondini.conNome + ' su ' + tondini.quanti);
  ok('e sono della stessa misura', tondini.stessaMisura === true);
  await page.close();

  // ══ e la mappa che l'assistente legge dice la stessa cosa ════════════
  page = await apri(stato([JOSEF, LILIE]));
  const mappa = await page.evaluate(() => {
    const m = typeof MAPPA_APP === 'string' ? MAPPA_APP : '';
    const h = (m.split(/\n- Hotel:/)[1] || '').split(/\n/)[0];
    return { cè: !!h, diceNotti: /notti/i.test(h) };
  });
  ok('la mappa dell\'assistente racconta anche le notti coperte',
     mappa.cè === true && mappa.diceNotti === true);
  await page.close();

  await browser.close();
  for (const e of err) r.push(' FALLITO  ' + e);
  const passati = r.filter(x => x.startsWith('  OK')).length;
  console.log(r.join('\n'));
  console.log(`\n${passati}/${r.length} passati`);
  process.exit(passati === r.length ? 0 : 1);
})();
