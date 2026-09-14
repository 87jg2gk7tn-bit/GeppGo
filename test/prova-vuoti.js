/* I riquadri vuoti, e se da lì si può fare qualcosa.

   Un riquadro vuoto è il momento in cui l'app ha meno da dire e la persona
   ha più bisogno di sapere come si comincia. In fondo a «Scopri» ce n'erano
   due, alti un pollice l'uno, che dicevano soltanto che non c'era niente:
   «Nessun luogo salvato» e «Niente in time-table, per ora».

   Per il primo l'azione — la ricerca — stava in cima alla stessa pagina, ma
   dopo una schermata intera di scorrimento: chi arrivava in fondo doveva
   tornare su per capire da dove si comincia. Per il secondo l'azione sta
   proprio in un'ALTRA schermata.

   Non vale ovunque: dove l'azione è già lì vicino, un secondo tasto sarebbe
   lo stesso tasto due volte — ed è un errore che ho già fatto. Questa prova
   controlla tutt'e due le cose. */
const { apriBrowser, APP, leafletJs } = require('./browser');
const fs = require('fs');

const oggi = new Date().toISOString().slice(0, 10);
const domani = new Date(Date.now() + 864e5).toISOString().slice(0, 10);

const stato = {
  trips: [{
    id: 1, name: 'Praga', destination: 'Praga', currency: 'CZK', status: 'open',
    start: oggi, end: domani,
    participants: [{ id: 1, name: 'Gepp', isMe: true }],
    pois: [], expenses: [], tickets: [], hotels: [], weather: {}, createdAt: 1,
    days: [{ id: 'd1', date: oggi, title: '', activities: [] },
           { id: 'd2', date: domani, title: '', activities: [] }]
  }],
  currentTripId: 1, settings: {}, myName: 'Gepp', skipAuth: true
};

(async () => {
  const browser = await apriBrowser();
  const r = [];
  const err = [];
  const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);

  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', e => err.push('PAGEERROR: ' + e.message.split('\n')[0]));
  await page.route('**/leaflet@1.9.4/dist/leaflet.js', ro => ro.fulfill({
    status: 200, contentType: 'application/javascript', body: fs.readFileSync(leafletJs(), 'utf8') }));
  await page.route('**/leaflet@1.9.4/dist/leaflet.css', ro => ro.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route(/tile\.openstreetmap\.org/, ro => ro.abort());
  await page.route(/api\.open-meteo\.com/, ro => ro.abort());
  await page.route(/nominatim\.openstreetmap\.org/, ro => ro.abort());
  await page.addInitScript(s => localStorage.setItem('geppgo2', JSON.stringify(s)), stato);
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof renderSaved === 'function', { timeout: 20000 });
  await page.evaluate(() => { go('discover'); const s = document.querySelector('.scroll'); if (s) s.scrollTop = 0; });
  await page.waitForTimeout(700);

  // ══ i due riquadri in fondo a Scopri ═════════════════════════════════
  const due = await page.evaluate(() => {
    const leggi = id => {
      const box = document.querySelector('#' + id + ' .empty');
      if (!box) return null;
      const b = box.querySelector('button');
      return { testo: box.innerText.replace(/\s+/g, ' ').trim(),
               tasto: b ? b.textContent.trim() : '',
               alto: Math.round(box.getBoundingClientRect().height) };
    };
    return { salvati: leggi('savedPOIs'), programma: leggi('progPOIs') };
  });
  ok('il riquadro dei luoghi salvati c\'è', !!due.salvati, due.salvati ? due.salvati.testo : 'manca');
  ok('e non è solo un cartello: da lì si cerca un posto',
     !!due.salvati && due.salvati.tasto.length > 2, due.salvati ? due.salvati.tasto : '');
  ok('il riquadro del programma c\'è', !!due.programma, due.programma ? due.programma.testo : 'manca');
  ok('e da lì si apre la time-table, che è dove si rimedia',
     !!due.programma && /time-table/i.test(due.programma.tasto), due.programma ? due.programma.tasto : '');

  /* Un tasto che non porta da nessuna parte è peggio di nessun tasto:
     promette e non mantiene. */
  ok('il tasto dei luoghi salvati porta davvero sulla ricerca',
     await page.evaluate(async () => {
       const b = document.querySelector('#savedPOIs .empty button');
       if (!b) return false;
       b.click();
       await new Promise(x => setTimeout(x, 600));
       return document.activeElement === document.getElementById('poiSearch');
     }) === true);
  ok('e quello del programma apre davvero la time-table',
     await page.evaluate(async () => {
       const b = document.querySelector('#progPOIs .empty button');
       if (!b) return false;
       b.click();
       await new Promise(x => setTimeout(x, 700));
       const m = document.getElementById('mDay');
       return !!m && m.classList.contains('active');
     }) === true);

  // ══ e dove l'azione c'è già, il tasto NON si aggiunge ════════════════
  /* La time-table vuota non ha bisogno di un cartello: la griglia è la
     cosa, e il "+" che la riempie sta lì in fondo a destra. Aggiungerci
     un riquadro «niente qui» sarebbe rumore sopra uno strumento che
     funziona. */
  /* Aperta da questa prova e non dal tasto di prima: così se il tasto
     manca questa riga dice ancora la sua, invece di cadere per rimbalzo. */
  const tt = await page.evaluate(async () => {
    openTimetable();
    await new Promise(x => setTimeout(x, 700));
    const m = document.getElementById('mDay');
    return { aperta: !!m && m.classList.contains('active'),
             cartello: !!document.querySelector('#mDay .empty') };
  });
  ok('la time-table vuota non mette un cartello sopra la griglia',
     tt.aperta === true && tt.cartello === false);

  // ══ i bagagli non partono vuoti: la lista se la fa da sola ═══════════
  /* Qui il riquadro vuoto quasi non si vede mai, e non vale la pena
     inventargli un'azione: la lista arriva già scritta. */
  await page.evaluate(() => { try { go('discover'); } catch (e) {} });
  await page.waitForTimeout(400);
  const bag = await page.evaluate(async () => {
    openPacking();
    await new Promise(x => setTimeout(x, 900));
    return { voci: document.querySelectorAll('#packList .pk-row, #packList input[type=checkbox]').length,
             cartello: !!document.querySelector('#packList .empty') };
  });
  ok('i bagagli arrivano già con delle voci, non vuoti',
     bag.voci > 3 && bag.cartello === false, bag.voci + ' voci');

  await page.close();
  await browser.close();
  for (const e of err) r.push(' FALLITO  ' + e);
  const passati = r.filter(x => x.startsWith('  OK')).length;
  console.log(r.join('\n'));
  console.log(`\n${passati}/${r.length} passati`);
  process.exit(passati === r.length ? 0 : 1);
})();
