/* Le lingue.

   La chiave del dizionario è la frase italiana stessa. È la scelta che rende
   la cosa fattibile su un'app di dodicimila righe scritta tutta in italiano —
   niente tremila nomi di chiavi da inventare — e ha una conseguenza che vale
   più di tutto il resto: **quello che non è ancora tradotto resta in
   italiano**, invece di mostrare "menu.spese.aggiungi" a qualcuno che sta
   viaggiando. Metà delle prove qui sotto guardano proprio quello. */
const { apriBrowser, APP, leafletJs } = require('./browser');
const fs = require('fs');

const stato = {
  trips: [{ id: 1730000000012, name: 'Giappone', destination: 'Tokyo', currency: 'EUR',
    status: 'open', start: '2026-03-14', end: '2026-03-16',
    participants: [{ id: 1, name: 'Gepp', isMe: true }],
    pois: [], expenses: [], tickets: [], hotels: [], weather: {}, createdAt: 1,
    days: [{ id: 'd1', date: '2026-03-14', title: '', activities: [] }] }],
  currentTripId: 1730000000012, settings: { proxRadius: 200 }, myName: 'Gepp', skipAuth: true
};

async function apri(browser, lingua, linguaTelefono) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 },
    locale: linguaTelefono || 'it-IT' });
  await page.route('**/leaflet@1.9.4/dist/leaflet.js', ro => ro.fulfill({
    status: 200, contentType: 'application/javascript', body: fs.readFileSync(leafletJs(), 'utf8') }));
  await page.route(/tile\.openstreetmap\.org/, ro => ro.abort());
  await page.addInitScript(([s, l]) => {
    const st = JSON.parse(JSON.stringify(s));
    if (l) st.settings.lingua = l;
    localStorage.setItem('geppgo2', JSON.stringify(st));
  }, [stato, lingua]);
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.t === 'function', { timeout: 20000 });
  await page.waitForTimeout(600);
  return page;
}

(async () => {
  const browser = await apriBrowser();
  const r = [];
  const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);
  const err = [];

  // ── in italiano, niente cambia ───────────────────────────────────────────
  const it = await apri(browser, 'it');
  it.on('pageerror', e => err.push('PAGEERROR: ' + e.message));
  const barraIt = await it.evaluate(() =>
    [...document.querySelectorAll('.nav-item')].map(n => n.getAttribute('title')));
  ok('in italiano la barra è quella di sempre',
     barraIt.includes('Spese') && barraIt.includes('Scopri'), barraIt.join(' · '));
  ok('e t() restituisce la frase così com\'è',
     await it.evaluate(() => t('Salva')) === 'Salva');
  await it.close();

  // ── in inglese ───────────────────────────────────────────────────────────
  const en = await apri(browser, 'en');
  en.on('pageerror', e => err.push('PAGEERROR(en): ' + e.message));
  const barraEn = await en.evaluate(() =>
    [...document.querySelectorAll('.nav-item')].map(n => n.getAttribute('title')));
  ok('in inglese la barra è tradotta',
     barraEn.includes('Expenses') && barraEn.includes('Discover') && barraEn.includes('Weather'),
     barraEn.join(' · '));
  ok('e anche le etichette per chi non vede', await en.evaluate(() =>
     document.querySelector('.nav-item[data-p="money"]').getAttribute('aria-label')) === 'Expenses');
  ok('la pagina dichiara la lingua che sta usando',
     await en.evaluate(() => document.documentElement.lang) === 'en');

  /* IL PUNTO: una frase che non è nel dizionario non deve sparire né
     diventare un codice. Resta in italiano, e si legge lo stesso. */
  const nonTradotta = await en.evaluate(() => t('Una frase che non ho mai tradotto'));
  ok('quello che non è tradotto resta in italiano, non diventa un codice',
     nonTradotta === 'Una frase che non ho mai tradotto', nonTradotta);
  const vuota = await en.evaluate(() => [t(''), t(undefined)]);
  ok('e una frase vuota non fa saltare niente', vuota[0] === '' && !vuota[1], JSON.stringify(vuota));

  // ── spagnolo, francese, portoghese ───────────────────────────────────────
  await en.close();
  for (const [l, atteso, dove] of [['es', 'Gastos', 'money'], ['fr', 'Dépenses', 'money'], ['pt', 'Despesas', 'money']]) {
    const p = await apri(browser, l);
    p.on('pageerror', e => err.push(`PAGEERROR(${l}): ` + e.message));
    const v = await p.evaluate(d => document.querySelector(`.nav-item[data-p="${d}"]`).getAttribute('title'), dove);
    ok(`in ${LINGUA_NOME[l]} la barra è tradotta`, v === atteso, v);
    await p.close();
  }

  // ── la lingua del telefono, ma solo quando è pronta ──────────────────────
  /* Un'app mezza tradotta è PEGGIO di una tutta in italiano: chi la apre
     pensa che sia rotta. Finché il dizionario non è quasi pieno, l'app non ci
     passa da sola — sceglierla a mano dal Profilo invece si può sempre. */
  const auto = await apri(browser, null, 'es-ES');
  const barraAuto = await auto.evaluate(() => ({
    titolo: document.querySelector('.nav-item[data-p="money"]').getAttribute('title'),
    pronta: linguaPronta('es'),
    quante: Object.keys(DIZIONARIO.es).length
  }));
  ok('finché una lingua non è pronta l\'app non ci passa da sola',
     barraAuto.titolo === 'Spese' && barraAuto.pronta === false,
     barraAuto.titolo + ', ' + barraAuto.quante + ' frasi su 656');
  /* Ma la soglia non è finta: si controlla che riempiendo il dizionario la
     lingua si accenda da sola, senza toccare una riga di codice. */
  const quandoPronta = await auto.evaluate(() => {
    const vero = Object.assign({}, DIZIONARIO.es);
    for (let i = 0; i < 700; i++) DIZIONARIO.es['finta ' + i] = 'falsa ' + i;
    const esito = { pronta: linguaPronta('es'), scelta: linguaScelta() };
    DIZIONARIO.es = vero;
    return esito;
  });
  ok('e quando il dizionario è pieno si accende da sola',
     quandoPronta.pronta === true && quandoPronta.scelta === 'es', JSON.stringify(quandoPronta));
  await auto.close();

  // ── ma sceglierla a mano vale sempre ─────────────────────────────────────
  const aMano = await apri(browser, 'es', 'it-IT');
  const barraMano = await aMano.evaluate(() =>
    document.querySelector('.nav-item[data-p="money"]').getAttribute('title'));
  ok('sceglierla a mano vale anche se non è ancora pronta', barraMano === 'Gastos', barraMano);
  await aMano.close();

  /* Una lingua che non sappiamo dire non deve lasciare l'app a metà: si resta
     in italiano, che è meglio di un'interfaccia sfondata. */
  const ignota = await apri(browser, null, 'de-DE');
  const barraIgnota = await ignota.evaluate(() =>
    document.querySelector('.nav-item[data-p="money"]').getAttribute('title'));
  ok('una lingua che non sappiamo dire torna all\'italiano', barraIgnota === 'Spese', barraIgnota);
  await ignota.close();

  // ── il selettore in Profilo ──────────────────────────────────────────────
  const prof = await apri(browser, 'en');
  const sel = await prof.evaluate(() => {
    session = { user: { id: 'io', email: 'g@x.it' } };
    renderProfile();
    const s = document.getElementById('sceltaLingua');
    return { quante: s.options.length, scelta: s.value,
             nomi: [...s.options].map(o => o.textContent),
             nota: document.getElementById('linguaCopertura').textContent };
  });
  ok('in Profilo ci sono tutte e cinque le lingue', sel.quante === 5, sel.nomi.join(', '));
  ok('ognuna col suo nome, scritto nella sua lingua',
     sel.nomi.includes('Español') && sel.nomi.includes('Français') && sel.nomi.includes('Português'));
  ok('e quella in uso è selezionata', sel.scelta === 'en', sel.scelta);
  /* Onestà: una persona che vede metà app in italiano deve sapere perché. */
  ok('dice quanto è tradotto davvero, invece di far finta',
     /%/.test(sel.nota) && /resta in italiano/i.test(sel.nota), sel.nota);
  const percento = parseInt((sel.nota.match(/(\d+)%/) || [])[1] || '0', 10);
  ok('e la percentuale è un numero sensato', percento > 0 && percento <= 100, percento + '%');
  await prof.close();

  // ── anche quello che l'app ridisegna da sola ─────────────────────────────
  /* Le schermate si rifanno da capo con innerHTML e si portano via la
     traduzione fatta all'avvio: se non si ripassa dopo un ridisegno, l'app
     torna in italiano al primo tocco. */
  const dopoRidisegno = await (async () => {
    const p = await apri(browser, 'en');
    p.on('pageerror', e => err.push('PAGEERROR(rid): ' + e.message));
    const v = await p.evaluate(() => {
      renderAll();
      return document.querySelector('.nav-item[data-p="money"]').getAttribute('title');
    });
    await p.close();
    return v;
  })();
  ok('e resta tradotta anche dopo che l\'app si ridisegna', dopoRidisegno === 'Expenses', dopoRidisegno);

  // ── il dizionario è fatto bene ───────────────────────────────────────────
  const diz = await (async () => {
    const p = await apri(browser, 'it');
    const d = await p.evaluate(() => {
      const fuori = {};
      Object.keys(DIZIONARIO).forEach(l => {
        const v = DIZIONARIO[l];
        fuori[l] = { quante: Object.keys(v).length,
                     vuote: Object.keys(v).filter(k => !v[k]).length,
                     ugualiAllItaliano: Object.keys(v).filter(k => v[k] === k).length };
      });
      fuori.chiavi = Object.keys(DIZIONARIO.en);
      fuori.stesseChiavi = Object.keys(DIZIONARIO).every(l =>
        Object.keys(DIZIONARIO[l]).length === Object.keys(DIZIONARIO.en).length);
      return fuori;
    });
    await p.close();
    return d;
  })();
  ok('le quattro lingue hanno le stesse frasi', diz.stesseChiavi === true,
     Object.keys(LINGUA_NOME).map(l => l + ':' + diz[l].quante).join(' '));
  ok('nessuna traduzione è vuota',
     ['en','es','fr','pt'].every(l => diz[l].vuote === 0));
  /* Qualche parola è uguale in due lingue ("Budget", "Documenti"): è normale.
     Se lo fossero quasi tutte vorrebbe dire che qualcuno ha incollato
     l'italiano per far salire il conto. */
  ok('e non sono l\'italiano ricopiato',
     ['en','es','fr','pt'].every(l => diz[l].ugualiAllItaliano < diz[l].quante * 0.25),
     ['en','es','fr','pt'].map(l => l + ':' + diz[l].ugualiAllItaliano).join(' '));

  // ── cambiare lingua si salva ─────────────────────────────────────────────
  const cambio = await (async () => {
    const p = await apri(browser, 'it');
    const dopo = await p.evaluate(() => {
      /* Non si ricarica davvero dentro la prova: si guarda che la scelta
         venga scritta dove deve. */
      const vero = location.reload; location.reload = () => {};
      cambiaLingua('fr');
      location.reload = vero;
      return { salvata: JSON.parse(localStorage.getItem('geppgo2')).settings.lingua,
               inMemoria: app.settings.lingua };
    });
    await p.close();
    return dopo;
  })();
  ok('la lingua scelta si salva sul telefono', cambio.salvata === 'fr', cambio.salvata);
  ok('e vale anche subito', cambio.inMemoria === 'fr', cambio.inMemoria);

  console.log('\n' + r.join('\n'));
  const falliti = r.filter(x => x.includes('FALLITO')).length;
  console.log(`\n${r.length - falliti}/${r.length} passati`);
  if (err.length) console.log('\nErrori in pagina:\n' + err.join('\n'));
  await browser.close();
  process.exit(falliti || err.length ? 1 : 0);
})();

const LINGUA_NOME = { en: 'inglese', es: 'spagnolo', fr: 'francese', pt: 'portoghese' };
