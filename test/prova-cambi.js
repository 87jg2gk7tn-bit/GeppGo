/* I CAMBI DELLE SPESE IN VALUTA, ANCHE SENZA RETE.

   IL GUASTO. Senza rete, e senza un cambio preso nelle ultime sei ore, la
   funzione del cambio restituiva 1 e la spesa si salvava cosi' per sempre,
   senza un avviso: 10.000 yen diventavano 10.000 euro, e l'anteprima sotto
   la cifra scriveva gia' «≈ €10.000,00». All'estero, senza campo, e'
   proprio il momento in cui le spese si segnano.

   Qui la rete la decide la prova: la tabella dei cambi risponde solo quando
   `rete.su` e' vero, e il telefono "senza campo" e' quello vero del browser
   (setOffline), con navigator.onLine e l'evento del ritorno della rete.

   Le nove prove chieste, nell'ordine:
   1. senza rete e senza tabella 10.000 JPY non diventano 10.000 EUR;
   2. senza rete con una tabella di tre giorni fa si usa quella, con la data;
   3. torna la rete: la spesa in attesa prende il cambio ed entra nei conti;
   4. il cambio scritto a mano si usa e il ritorno della rete non lo tocca;
   5. stessa valuta: cambio 1, nessun avviso;
   6. una vecchia spesa in yen con cambio 1 e' «da verificare», con le tre
      scelte che funzionano;
   7. totali e saldi non contano le spese in attesa e lo dicono;
   8. due telefoni: i campi nuovi passano dal documento del viaggio intatti;
   9. i testi nuovi ci sono in tutte e cinque le lingue. */
const { apriBrowser, APP, leafletJs } = require('./browser');
const fs = require('fs');

const OGGI = new Date().toISOString().split('T')[0];
const GIORNO = 86400000;
/* 1 euro = 160 yen = 1,10 dollari: 10.000 yen fanno 62,50 euro. */
const TABELLA_EUR = { EUR: 1, JPY: 160, USD: 1.1 };

const cena = { id: 101, desc: 'Cena', category: 'Cibo', amount: 50, origAmount: 50, origCurrency: 'EUR', rate: 1,
  payerId: 1, splitAmong: [1, 2], date: OGGI + 'T12:00:00', paid: true };
const viaggio = (spese, extra = {}) => ({
  trips: [Object.assign({ id: 1730000000077, name: 'Giappone', destination: 'Tokyo', currency: 'EUR', status: 'open',
    start: OGGI, end: OGGI, participants: [{ id: 1, name: 'Gepp', isMe: true }, { id: 2, name: 'Jak' }],
    suggested: [], pois: [], hotels: [], tickets: [], weather: {}, createdAt: 1,
    expenses: spese, days: [{ id: 'd1', date: OGGI, title: '', activities: [] }] }, extra)],
  currentTripId: 1730000000077, settings: { proxRadius: 200 }, myName: 'Gepp', skipAuth: true });

const r = [];
const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);
const errori = [];
const vicino = (a, b) => typeof a === 'number' && Math.abs(a - b) < 0.005;

async function apri(browser, stato, { cambi = null, lingua = null, rete = true } = {}) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const stato_rete = { su: rete, chiamate: [] };
  page.on('pageerror', e => errori.push('PAGEERROR: ' + e.message.split('\n')[0]));
  await page.route('**/leaflet@1.9.4/dist/leaflet.js', ro => ro.fulfill({
    status: 200, contentType: 'application/javascript', body: fs.readFileSync(leafletJs(), 'utf8') }));
  await page.route(/tile\.openstreetmap\.org/, ro => ro.abort());
  /* Il servizio dei cambi: una tabella con base euro, la valuta del viaggio.
     Senza rete, o per un'altra base, la richiesta cade come cadrebbe in
     montagna. */
  await page.route('**/v6/latest/**', ro => {
    const base = ro.request().url().split('/').pop();
    stato_rete.chiamate.push(base);
    if (!stato_rete.su || base !== 'EUR') return ro.abort('internetdisconnected');
    ro.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      result: 'success', base_code: 'EUR', time_last_update_unix: Math.floor(Date.now() / 1000), rates: TABELLA_EUR }) });
  });
  /* Solo al primo caricamento: ricaricando la pagina deve restare quello che
     l'app ha salvato, come su un telefono. */
  await page.addInitScript(([s, c, l]) => {
    if (sessionStorage.getItem('prova-cambi')) return;
    sessionStorage.setItem('prova-cambi', '1');
    const st = JSON.parse(JSON.stringify(s));
    if (l) st.settings.lingua = l;
    localStorage.setItem('geppgo2', JSON.stringify(st));
    if (c) localStorage.setItem('geppgo2_cambi', JSON.stringify(c)); else localStorage.removeItem('geppgo2_cambi');
  }, [stato, cambi, lingua]);
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.addExpense === 'function' && typeof window.renderAll === 'function', { timeout: 20000 });
  await page.waitForTimeout(1800);
  /* Ogni avviso che compare si annota: durano due secondi e mezzo, e la
     prova non deve arrivare tardi a leggerli. */
  await page.evaluate(() => {
    window.__avvisi = [];
    new MutationObserver(m => m.forEach(x => x.addedNodes.forEach(n => {
      if (n.classList && n.classList.contains('toast')) window.__avvisi.push(n.textContent);
    }))).observe(document.body, { childList: true });
  });
  return { page, rete: stato_rete };
}

const senzaCampo = async (p, rete) => { rete.su = false; await p.context().setOffline(true); };
const torna = async (p, rete) => { rete.su = true; await p.context().setOffline(false); };
const avvisi = p => p.evaluate(() => window.__avvisi.slice());
const spesa = (p, desc) => p.evaluate(d => {
  const e = T().expenses.find(x => x.desc === d);
  return e ? JSON.parse(JSON.stringify(e)) : null;
}, desc);

/* Scrive una spesa come la scriverebbe una persona: apre il foglio, scrive la
   cifra, sceglie la valuta, se vuole scrive il cambio, e guarda l'anteprima
   prima di salvare. */
async function scriviSpesa(p, { desc, importo, valuta, cambio = null, salva = true }) {
  await p.evaluate(() => { go('money'); openExpense(); });
  await p.waitForTimeout(450);
  await p.fill('#expDesc', desc);
  await p.evaluate(v => { const s = document.getElementById('expCur'); s.value = v; s.dispatchEvent(new Event('change')); }, valuta);
  await p.fill('#expAmt', String(importo));
  if (cambio != null) await p.fill('#expCambio', cambio);
  await p.waitForTimeout(500);
  const anteprima = await p.evaluate(() => {
    const box = document.getElementById('expConv'), w = document.getElementById('expCambioWrap');
    return { testo: box.textContent, attesa: box.classList.contains('attesa'),
      campo: w ? w.style.display !== 'none' : null,
      etichetta: (document.getElementById('expCambioLbl') || {}).textContent || '' };
  });
  if (salva) {
    await p.click('#mExpense button[onclick="addExpense()"]');
    await p.waitForTimeout(600);
  }
  return anteprima;
}
const soldi = p => p.evaluate(() => ({
  totale: (document.querySelector('#money .mh-tot') || {}).innerText || '',
  testo: document.getElementById('money').innerText,
  saldi: computeSettle(T()).bal
}));
const prova = async (nome, fn) => {
  try { await fn(); } catch (e) { ok(nome, false, 'si è fermata: ' + e.message.split('\n')[0]); }
};

(async () => {
  const browser = await apriBrowser();

  /* ── 1, 7, 4, 3: lo stesso telefono, senza campo e poi con la rete ───── */
  await prova('1-3-4-7', async () => {
    const { page: p, rete } = await apri(browser, viaggio([cena]), { rete: false });
    await senzaCampo(p, rete);

    // 1. senza rete e senza tabella
    const a1 = await scriviSpesa(p, { desc: 'Ramen', importo: '10000', valuta: 'JPY' });
    ok('1. l\'anteprima non inventa una cifra in euro',
       !/€\s?10\.000/.test(a1.testo) && !/≈/.test(a1.testo), a1.testo);
    ok('1. e dice che il cambio non c\'è ancora, ben visibile',
       /Cambio non ancora disponibile/.test(a1.testo) && a1.attesa, a1.testo);
    const ramen = await spesa(p, 'Ramen');
    ok('1. 10.000 JPY NON diventano 10.000 EUR',
       ramen && ramen.amount === 0 && ramen.amount !== 10000, ramen && `importo nei conti ${ramen.amount}, cambio ${ramen.rate}`);
    ok('1. la spesa resta in attesa, con la cifra vera nella sua valuta',
       ramen && ramen.cambioStato === 'attesa' && ramen.origAmount === 10000 && ramen.origCurrency === 'JPY' && ramen.rate == null,
       ramen && JSON.stringify({ stato: ramen.cambioStato, orig: ramen.origAmount, valuta: ramen.origCurrency, cambio: ramen.rate }));
    ok('1. e salvandola lo dice',
       (await avvisi(p)).includes('Spesa salvata: il cambio lo calcolo appena torna la rete'), (await avvisi(p)).join(' | '));
    const riga = await p.evaluate(() => {
      const el = [...document.querySelectorAll('#money .exp-row')].find(x => /Ramen/.test(x.innerText));
      return el ? el.innerText.replace(/\s+/g, ' ') : '';
    });
    ok('1. nell\'elenco si legge in yen, con «cambio in attesa»',
       /¥10\.000,00/.test(riga) && /cambio in attesa/.test(riga) && !/€10\.000/.test(riga), riga);

    // 7. totali e saldi senza le spese in attesa (ne aggiungo una seconda)
    await scriviSpesa(p, { desc: 'Taxi', importo: '30', valuta: 'USD' });
    let s = await soldi(p);
    ok('7. il totale del viaggio non conta le spese in attesa', s.totale === '€50,00', s.totale);
    ok('7. i saldi nemmeno: Jak deve ancora solo la sua metà della cena',
       vicino(s.saldi[2], -25) && vicino(s.saldi[1], 25), JSON.stringify(s.saldi));
    ok('7. e lo dice: «2 spese non ancora incluse»',
       /2 spese non ancora incluse \(cambio in attesa\)/.test(s.testo), (s.testo.match(/.*non ancora inclus.*/) || ['niente'])[0]);
    const saldiTesto = await p.evaluate(() => { setMoney('bal'); const x = document.getElementById('money').innerText; setMoney('list'); return x; });
    ok('7. anche nella scheda Saldi', /Saldi[\s\S]*2 spese non ancora incluse/.test(saldiTesto));
    const budget = await p.evaluate(() => { moneyVista('budget'); const x = document.getElementById('moneyBudget').innerText; moneyVista('spese'); return x; });
    ok('7. e nel Budget', /2 spese non ancora incluse/.test(budget), (budget.match(/.*non ancora inclus.*/) || ['niente'])[0]);

    // 4. il cambio a mano
    const a4 = await scriviSpesa(p, { desc: 'Sushi', importo: '10000', valuta: 'JPY', cambio: '0,0062' });
    ok('4. c\'è il campo per scrivere il cambio, con la sua etichetta', a4.campo === true && /quanti EUR vale 1 JPY/.test(a4.etichetta), a4.etichetta);
    ok('4. l\'anteprima usa il cambio scritto a mano', /€62,00/.test(a4.testo) && /scritto a mano/.test(a4.testo), a4.testo);
    let sushi = await spesa(p, 'Sushi');
    ok('4. e la spesa si salva con quel cambio, segnato come scritto a mano',
       sushi && sushi.rate === 0.0062 && vicino(sushi.amount, 62) && sushi.cambioManuale === true && !sushi.cambioStato,
       sushi && JSON.stringify({ cambio: sushi.rate, importo: sushi.amount, mano: sushi.cambioManuale }));
    s = await soldi(p);
    ok('4. entra subito nei conti, anche senza rete', s.totale === '€112,00', s.totale);

    // 3. torna la rete
    await torna(p, rete);
    await p.waitForFunction(() => { const e = T().expenses.find(x => x.desc === 'Ramen'); return e && !e.cambioStato; }, { timeout: 8000 }).catch(() => {});
    const ramen3 = await spesa(p, 'Ramen'), taxi3 = await spesa(p, 'Taxi');
    ok('3. al ritorno della rete la spesa in attesa prende il cambio',
       ramen3 && !ramen3.cambioStato && vicino(ramen3.rate, 1 / 160) && vicino(ramen3.amount, 62.5) && ramen3.cambioData > 0,
       ramen3 && JSON.stringify({ stato: ramen3.cambioStato, cambio: ramen3.rate, importo: ramen3.amount }));
    ok('3. anche quella in dollari', taxi3 && !taxi3.cambioStato && vicino(taxi3.amount, 30 / 1.1), taxi3 && String(taxi3.amount));
    ok('3. da solo, con una sola richiesta della tabella in euro',
       rete.chiamate.filter(x => x === 'EUR').length >= 1 && rete.chiamate.every(x => x === 'EUR'), rete.chiamate.join(','));
    ok('3. con un avviso breve', (await avvisi(p)).includes('✅ Cambio arrivato: 2 spese entrano nei conti'), (await avvisi(p)).join(' | '));
    s = await soldi(p);
    ok('3. ed entra nei conti: il totale la conta', s.totale === '€201,77', s.totale);
    ok('3. e nei saldi: Jak deve la sua metà di tutto',
       vicino(s.saldi[2], -(25 + 31 + 31.25 + 15 / 1.1)), JSON.stringify(s.saldi));
    ok('3. e la riga «non ancora incluse» se ne va', !/non ancora inclus/.test(s.testo));

    // 4. il cambio a mano non lo tocca nessuno, nemmeno chiedendo di nuovo i cambi
    await p.evaluate(async () => { await aggiornaCambiViaggi(); risolviCambiInAttesa(); });
    sushi = await spesa(p, 'Sushi');
    ok('4. il ritorno della rete non sovrascrive il cambio scritto a mano',
       sushi && sushi.rate === 0.0062 && vicino(sushi.amount, 62) && sushi.cambioManuale === true,
       sushi && JSON.stringify({ cambio: sushi.rate, importo: sushi.amount }));
    const riaperta = await p.evaluate(() => { const e = T().expenses.find(x => x.desc === 'Sushi'); openExpense(e.id);
      const v = document.getElementById('expCambio').value; closeSheet('mExpense'); return v; });
    ok('4. riaprendo la spesa il cambio scritto a mano si rivede', riaperta === '0,0062', riaperta);
    await p.close();
  });

  /* ── 2 e 5: una tabella di tre giorni fa, senza rete ──────────────────── */
  await prova('2-5', async () => {
    const tre = Date.now() - 3 * GIORNO;
    /* Il cambio di allora era diverso da quello di oggi (150 e non 160): se
       la prova leggesse quello di oggi, se ne accorgerebbe. */
    const { page: p, rete } = await apri(browser, viaggio([cena]),
      { rete: false, cambi: { EUR: { t: tre, d: tre, rates: { EUR: 1, JPY: 150, USD: 1.1 } } } });
    await senzaCampo(p, rete);
    const tenuta = await p.evaluate(() => { const c = JSON.parse(localStorage.getItem('geppgo2_cambi') || '{}'); return c.EUR && c.EUR.rates && c.EUR.rates.JPY; });
    ok('2. la tabella vecchia non si butta anche se l\'aggiornamento non riesce', tenuta === 150, String(tenuta));
    const data = await p.evaluate(ms => new Date(ms).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }), tre);
    const a2 = await scriviSpesa(p, { desc: 'Ramen', importo: '10000', valuta: 'JPY' });
    ok('2. l\'anteprima usa quel cambio e ne dice la data',
       /€66,67/.test(a2.testo) && a2.testo.includes('cambio del ' + data) && !a2.attesa, a2.testo + ' (atteso: cambio del ' + data + ')');
    const ramen = await spesa(p, 'Ramen');
    ok('2. la spesa si salva con quel cambio, non in attesa',
       ramen && vicino(ramen.amount, 66.67) && vicino(ramen.rate, 1 / 150) && !ramen.cambioStato && ramen.cambioData === tre,
       ramen && JSON.stringify({ importo: ramen.amount, stato: ramen.cambioStato, data: ramen.cambioData === tre }));
    ok('2. ed entra nei conti', (await soldi(p)).totale === '€116,67', (await soldi(p)).totale);

    // 5. stessa valuta
    const a5 = await scriviSpesa(p, { desc: 'Caffè', importo: '25', valuta: 'EUR', salva: false });
    ok('5. stessa valuta: niente campo del cambio e niente anteprima', a5.campo !== true && a5.testo === '', JSON.stringify(a5));
    await p.click('#mExpense button[onclick="addExpense()"]');
    await p.waitForTimeout(600);
    const caffe = await spesa(p, 'Caffè');
    ok('5. cambio 1, importo uguale, nessuno stato', caffe && caffe.rate === 1 && caffe.amount === 25 && !caffe.cambioStato && !caffe.cambioManuale,
       caffe && JSON.stringify(caffe));
    const av5 = await avvisi(p);
    ok('5. nessun avviso sul cambio', av5[av5.length - 1] === '✅ Spesa aggiunta' && !av5.some(x => /cambio/i.test(x)), av5.join(' | '));
    ok('5. né la riga delle spese non incluse, né il foglio dei cambi da verificare',
       !/non ancora inclus/.test((await soldi(p)).testo) && await p.evaluate(() => !document.getElementById('mCambiVerifica')?.classList.contains('active')));
    await p.close();
  });

  /* ── 6. le spese vecchie col cambio 1 ──────────────────────────────── */
  await prova('6', async () => {
    const vecchie = [
      cena,
      { id: 102, desc: 'Sushi', category: 'Cibo', amount: 10000, origAmount: 10000, origCurrency: 'JPY', rate: 1, payerId: 1, splitAmong: [1, 2], date: OGGI + 'T12:00:00', paid: true },
      { id: 103, desc: 'Taxi', category: 'Trasporti', amount: 3000, origAmount: 3000, origCurrency: 'JPY', rate: 1, payerId: 2, splitAmong: [1, 2], date: OGGI + 'T12:00:00', paid: true }
    ];
    const { page: p } = await apri(browser, viaggio(vecchie), { rete: true });
    const foglio = () => p.evaluate(() => {
      const m = document.getElementById('mCambiVerifica');
      return { aperto: !!m && m.classList.contains('active'), testo: m ? m.innerText : '',
        tasti: m ? [...m.querySelectorAll('#cvBody button')].map(b => b.textContent.trim()) : [] };
    });
    let f = await foglio();
    ok('6. aprendo il viaggio compare l\'avviso', f.aperto, f.testo.replace(/\s+/g, ' ').slice(0, 60));
    ok('6. dice quante sono', /2 spese in un'altra valuta sono state salvate con cambio 1/.test(f.testo), f.testo.split('\n').find(x => /spese/.test(x)) || '');
    ok('6. e offre le tre scelte',
       f.tasti.includes('Ricalcola col cambio attuale') && f.tasti.includes('Inserisco io il cambio') && f.tasti.includes('Va bene così'), f.tasti.join(' · '));
    let sushi = await spesa(p, 'Sushi'), cenaOra = await spesa(p, 'Cena');
    ok('6. le spese sono segnate «da verificare», con la cifra intatta',
       sushi && sushi.cambioStato === 'verifica' && sushi.amount === 10000 && (await spesa(p, 'Taxi')).cambioStato === 'verifica',
       sushi && JSON.stringify({ stato: sushi.cambioStato, importo: sushi.amount }));
    ok('6. quella in euro no', cenaOra && !cenaOra.cambioStato);
    const riga = await p.evaluate(() => { closeSheet('mCambiVerifica'); go('money');
      const el = [...document.querySelectorAll('#money .exp-row')].find(x => /Sushi/.test(x.innerText)); return el ? el.innerText.replace(/\s+/g, ' ') : ''; });
    ok('6. nell\'elenco portano l\'etichetta «da verificare»', /da verificare/.test(riga), riga);

    // scelta 1: ricalcola
    await p.evaluate(() => apriCambiVerifica());
    await p.waitForTimeout(400);
    await p.click('#cvBody button:has-text("Ricalcola col cambio attuale")');
    await p.waitForTimeout(800);
    sushi = await spesa(p, 'Sushi');
    let taxi = await spesa(p, 'Taxi');
    ok('6. «Ricalcola col cambio attuale» rifà i conti col cambio di oggi',
       sushi && vicino(sushi.amount, 62.5) && vicino(taxi.amount, 18.75) && !sushi.cambioStato && !taxi.cambioStato,
       JSON.stringify({ sushi: sushi && sushi.amount, taxi: taxi && taxi.amount }));
    ok('6. chiude il foglio e lo dice', !(await foglio()).aperto && (await avvisi(p)).includes('✅ Spese ricalcolate: 2'), (await avvisi(p)).join(' | '));

    /* Si rimettono le due spese come prima, e il viaggio come mai controllato:
       il foglio deve ricomparire da solo al prossimo disegno. */
    const daCapo = () => p.evaluate(v => {
      T().expenses = JSON.parse(JSON.stringify(v));
      cambiControllati.clear(); save(); renderAll();
    }, vecchie);
    await daCapo();
    await p.waitForTimeout(1200);
    ok('6. rimesse le spese com\'erano, l\'avviso ricompare da solo', (await foglio()).aperto);

    // scelta 2: il cambio a mano
    await p.click('#cvBody button:has-text("Inserisco io il cambio")');
    await p.waitForTimeout(300);
    const campi = await p.evaluate(() => [...document.querySelectorAll('#cvBody .cv-cambio')].map(i => ({ v: i.dataset.valuta, ph: i.placeholder })));
    ok('6. «Inserisco io il cambio» chiede un cambio per valuta', campi.length === 1 && campi[0].v === 'JPY' && campi[0].ph === '0,00625', JSON.stringify(campi));
    await p.fill('#cvBody .cv-cambio[data-valuta="JPY"]', '0,006');
    await p.click('#cvBody button:has-text("Salva i cambi")');
    await p.waitForTimeout(600);
    sushi = await spesa(p, 'Sushi'); taxi = await spesa(p, 'Taxi');
    ok('6. e lo usa per tutte le spese in quella valuta, come cambio scritto a mano',
       sushi && vicino(sushi.amount, 60) && vicino(taxi.amount, 18) && sushi.cambioManuale === true && taxi.cambioManuale === true && !sushi.cambioStato,
       JSON.stringify({ sushi: sushi && sushi.amount, taxi: taxi && taxi.amount }));
    await p.evaluate(async () => { await aggiornaCambiViaggi(); });
    sushi = await spesa(p, 'Sushi');
    ok('6. e un nuovo giro dei cambi non lo tocca', sushi && vicino(sushi.amount, 60), sushi && String(sushi.amount));
    ok('6. foglio chiuso e avviso', !(await foglio()).aperto && (await avvisi(p)).includes('✅ Cambio salvato, spese aggiornate: 2'));

    // scelta 3: va bene così
    await daCapo();
    await p.waitForTimeout(1200);
    await p.click('#cvBody button:has-text("Va bene così")');
    await p.waitForTimeout(600);
    sushi = await spesa(p, 'Sushi'); taxi = await spesa(p, 'Taxi');
    ok('6. «Va bene così» lascia le cifre come sono',
       sushi && sushi.amount === 10000 && taxi.amount === 3000 && !sushi.cambioStato && sushi.cambioManuale === true,
       JSON.stringify({ sushi: sushi && sushi.amount, stato: sushi && sushi.cambioStato }));
    await p.reload({ waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof window.renderAll === 'function', { timeout: 20000 });
    await p.waitForTimeout(2000);
    sushi = await spesa(p, 'Sushi');
    ok('6. e riaprendo l\'app non lo richiede più', !(await foglio()).aperto && sushi && !sushi.cambioStato && sushi.amount === 10000);
    await p.close();
  });

  /* ── 8. due telefoni ────────────────────────────────────────────────── */
  /* Il trasporto vero (Supabase) qui non c'è: si prova la strada che fa il
     documento del viaggio fra un telefono e l'altro, con le funzioni vere -
     cleanTrip prepara quello che parte, handleRealtimeChange e
     mergedRecordFields lo fanno entrare. */
  await prova('8', async () => {
    const condiviso = viaggio([cena], { cid: 'c-prova-cambi' });
    const A = await apri(browser, condiviso, { rete: false });
    const B = await apri(browser, condiviso, { rete: false });
    await senzaCampo(A.page, A.rete);
    await senzaCampo(B.page, B.rete);
    await scriviSpesa(A.page, { desc: 'Ramen', importo: '10000', valuta: 'JPY' });
    await scriviSpesa(A.page, { desc: 'Sushi', importo: '10000', valuta: 'JPY', cambio: '0,0062' });
    const doc = await A.page.evaluate(() => { lastPush['c-prova-cambi'] = JSON.stringify(cleanTrip(T())); return cleanTrip(T()); });
    const daA = doc.expenses.find(e => e.desc === 'Ramen'), manoA = doc.expenses.find(e => e.desc === 'Sushi');
    ok('8. quello che parte dal telefono A ha i campi nuovi',
       daA && daA.cambioStato === 'attesa' && manoA && manoA.cambioManuale === true && manoA.cambioData > 0,
       JSON.stringify({ stato: daA && daA.cambioStato, mano: manoA && manoA.cambioManuale }));
    const arriva = (pg, d) => pg.evaluate(d => {
      lastPush['c-prova-cambi'] = JSON.stringify(cleanTrip(T()));
      handleRealtimeChange({ eventType: 'UPDATE', new: { id: 'c-prova-cambi', data: d, invite_code: 'X', owner: 'altro', updated_by: 'altro' } });
    }, d);
    await arriva(B.page, doc);
    await B.page.waitForTimeout(400);
    const ramenB = await spesa(B.page, 'Ramen'), sushiB = await spesa(B.page, 'Sushi');
    ok('8. sul telefono B la spesa arriva in attesa, nella sua valuta',
       ramenB && ramenB.cambioStato === 'attesa' && ramenB.amount === 0 && ramenB.origAmount === 10000 && ramenB.origCurrency === 'JPY',
       ramenB && JSON.stringify({ stato: ramenB.cambioStato, importo: ramenB.amount }));
    ok('8. e il cambio a mano arriva com\'è, data compresa',
       sushiB && sushiB.cambioManuale === true && sushiB.rate === 0.0062 && sushiB.cambioData === manoA.cambioData,
       sushiB && JSON.stringify({ mano: sushiB.cambioManuale, cambio: sushiB.rate }));
    const totA = (await soldi(A.page)).totale, totB = (await soldi(B.page)).totale;
    ok('8. i due telefoni mostrano lo stesso totale', totA === totB && totA === '€112,00', totA + ' / ' + totB);

    /* B ritrova la rete per primo: calcola il cambio e lo manda. A, che era
       allineato, deve vedere la spesa diventata vera, non tenersi la sua. */
    await torna(B.page, B.rete);
    await B.page.waitForFunction(() => { const e = T().expenses.find(x => x.desc === 'Ramen'); return e && !e.cambioStato; }, { timeout: 8000 }).catch(() => {});
    const docB = await B.page.evaluate(() => cleanTrip(T()));
    await arriva(A.page, docB);
    await A.page.waitForTimeout(400);
    const ramenA = await spesa(A.page, 'Ramen'), sushiA = await spesa(A.page, 'Sushi');
    ok('8. il cambio calcolato da B arriva su A, che non era ancora in rete',
       ramenA && !ramenA.cambioStato && vicino(ramenA.amount, 62.5) && ramenA.cambioData === docB.expenses.find(e => e.desc === 'Ramen').cambioData,
       ramenA && JSON.stringify({ stato: ramenA.cambioStato, importo: ramenA.amount }));
    ok('8. e il cambio a mano resta a mano su tutti e due', sushiA && sushiA.cambioManuale === true && sushiA.rate === 0.0062);
    const tA = (await soldi(A.page)).totale, tB = (await soldi(B.page)).totale;
    ok('8. stesso stato, stesso totale', tA === tB && tA === '€174,50', tA + ' / ' + tB);
    await A.page.close(); await B.page.close();
  });

  /* ── 9. le lingue ───────────────────────────────────────────────────── */
  await prova('9', async () => {
    const html = fs.readFileSync(require('path').join(require('./browser').RADICE, 'Index 2.1.html'), 'utf8');
    const { page: p0 } = await apri(browser, viaggio([cena]), { rete: false });
    const diz = await p0.evaluate(() => typeof DIZIONARIO_CAMBI === 'object' ? DIZIONARIO_CAMBI : null);
    await p0.close();
    ok('9. c\'è il dizionario dei cambi', !!diz);
    if (!diz) return;
    const chiavi = Object.keys(diz.en);
    const graffe = s => (s.match(/\{\d\}/g) || []).sort().join('');
    const buchi = [];
    for (const l of ['en', 'es', 'fr', 'pt']) for (const k of chiavi) {
      const v = diz[l] && diz[l][k];
      if (typeof v !== 'string' || !v.trim() || graffe(v) !== graffe(k)) buchi.push(l + ': ' + k);
    }
    ok(`9. le ${chiavi.length} frasi nuove ci sono in inglese, spagnolo, francese e portoghese, con le stesse {variabili}`,
       chiavi.length >= 31 && !buchi.length && ['es', 'fr', 'pt'].every(l => Object.keys(diz[l]).length === chiavi.length), buchi.slice(0, 3).join(' | '));
    /* La chiave e' la frase italiana: se nel codice c'e' scritta un'altra
       frase, la traduzione non arriva mai. Ogni chiave deve comparire anche
       fuori dal dizionario, dove la si usa. */
    const nonUsate = chiavi.filter(k => html.split(k.replace(/'/g, "\\'")).length - 1 < 5 && html.split(k).length - 1 < 5);
    ok('9. e ognuna è la frase scritta davvero nel codice (l\'italiano)', !nonUsate.length, nonUsate.slice(0, 3).join(' | '));

    /* E a schermo: un viaggio con una spesa in attesa e una vecchia da
       verificare, aperto in ogni lingua. Nessun pezzo deve restare in
       italiano. */
    const misto = [cena,
      { id: 104, desc: 'Ramen', category: 'Cibo', amount: 0, origAmount: 10000, origCurrency: 'JPY', rate: null, cambioStato: 'attesa', payerId: 1, splitAmong: [1, 2], date: OGGI + 'T12:00:00', paid: true },
      { id: 105, desc: 'Sushi', category: 'Cibo', amount: 8000, origAmount: 8000, origCurrency: 'JPY', rate: 1, payerId: 1, splitAmong: [1, 2], date: OGGI + 'T12:00:00', paid: true }];
    for (const l of ['it', 'en', 'es', 'fr', 'pt']) {
      const { page: p, rete } = await apri(browser, viaggio(misto), { rete: false, lingua: l });
      await senzaCampo(p, rete);
      const tr = k => l === 'it' ? k : diz[l][k];
      const sub = (s, ...v) => s.replace(/\{(\d)\}/g, (_, i) => v[i - 1]);
      const visto = await p.evaluate(() => {
        const m = document.getElementById('mCambiVerifica');
        const foglio = m.classList.contains('active') ? m.innerText : '';
        cambiAMano(); const mano = m.innerText; closeSheet('mCambiVerifica');
        go('money');
        return { foglio, mano, soldi: document.getElementById('money').innerText };
      });
      const a = await scriviSpesa(p, { desc: 'Treno', importo: '5000', valuta: 'JPY', salva: false });
      const nota = await p.evaluate(() => document.querySelector('#mExpense .exp-cambio-nota').innerText);
      const attesi = [
        [visto.foglio, tr('Cambi da verificare')], [visto.foglio, tr('Ricalcola col cambio attuale')],
        [visto.foglio, tr('Inserisco io il cambio')], [visto.foglio, tr('Va bene così')],
        [visto.foglio, sub(tr('1 spesa in un\'altra valuta è stata salvata con cambio 1: la sua cifra è contata come se fosse in {1}.'), 'EUR')],
        [visto.mano, tr('Salva i cambi')], [visto.mano, tr('‹ Indietro')],
        [visto.soldi, tr('cambio in attesa')], [visto.soldi, tr('non ancora nei conti')],
        [visto.soldi, tr('1 spesa non ancora inclusa (cambio in attesa)')],
        [a.testo, tr('Cambio non ancora disponibile: lo calcolo appena torna la rete, oppure scrivilo tu qui sotto.')],
        [a.etichetta, sub(tr('Cambio: quanti {2} vale 1 {1}'), 'JPY', 'EUR')],
        [nota, tr('Lascialo vuoto per il cambio automatico. Se lo scrivi tu (per esempio quello della tua banca) non verrà mai cambiato da solo.')]
      ];
      const mancano = attesi.filter(([dove, cosa]) => !dove.includes(cosa)).map(x => x[1]);
      ok(`9. a schermo in ${l}: foglio, elenco, saldi e campo del cambio`, !mancano.length, mancano.slice(0, 2).join(' | '));
      await p.close();
    }
  });

  ok('nessun errore in pagina', !errori.length, errori.slice(0, 3).join(' | '));
  console.log('\n' + r.join('\n'));
  const falliti = r.filter(x => x.includes('FALLITO')).length;
  console.log(`\n${r.length - falliti}/${r.length} passati`);
  await browser.close();
  process.exit(falliti ? 1 : 0);
})();
