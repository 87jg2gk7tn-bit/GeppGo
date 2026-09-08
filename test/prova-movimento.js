/* Come si muove l'app.
 *
 * Questa prova nasce da una scoperta scomoda: la salita dei fogli era scritta
 * nel foglio di stile fin dall'inizio, sembrava giusta a leggerla, e **non era
 * mai partita**. In tutta l'app i fogli comparivano già arrivati. Il motivo è
 * che una transizione non parte da `display:none`: il browser non ha un
 * "prima" da cui muoversi e mette tutto subito al suo posto.
 *
 * Leggendo il codice non si vedeva. Misurandolo sì. Per questo qui non si
 * controlla che *esista* un'animazione: si guarda dove sta il foglio,
 * fotogramma per fotogramma, e si pretende che si muova davvero. */
const { apriBrowser, APP } = require('./browser');

const stato = {
  trips: [{ id: 1, name: 'Giappone', destination: 'Tokyo', currency: 'JPY', status: 'open',
    start: '2026-09-01', end: '2026-09-02', participants: [{ id: 1, name: 'Gepp', isMe: true }],
    suggested: [], pois: [], expenses: [], tickets: [], weather: {},
    days: [{ id: 1, date: '2026-09-01', title: '', activities: [] }], createdAt: 1 }],
  currentTripId: 1, settings: {}, myName: 'Gepp', skipAuth: true
};

/* Dove sta il foglio rispetto al posto in cui deve arrivare, in pixel.
   0 = arrivato, un numero positivo = ancora tanto più giù. */
const SEGUI = `(async (id, quanti) => {
  const s = document.getElementById(id).querySelector('.sheet');
  const dove = () => Math.round(new DOMMatrixReadOnly(getComputedStyle(s).transform).m42);
  const campioni = [];
  for (let i = 0; i < quanti; i++) {
    campioni.push(dove());
    await new Promise(r => requestAnimationFrame(r));
  }
  return campioni;
})`;

(async () => {
  const browser = await apriBrowser();
  const r = [];
  const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);
  const err = [];

  const apri = async (opz = {}) => {
    const p = await browser.newPage(Object.assign({ viewport: { width: 390, height: 844 } }, opz));
    p.on('pageerror', e => err.push('PAGEERROR: ' + e.message));
    await p.addInitScript(s => localStorage.setItem('geppgo2', JSON.stringify(s)), stato);
    await p.goto(APP, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof myPos !== 'undefined', { timeout: 20000 });
    return p;
  };

  const page = await apri();

  // ── il foglio sale ───────────────────────────────────────────────────────
  const salita = await page.evaluate(async (segui) => {
    openSheet('mNav');
    return await eval(segui)('mNav', 8);
  }, SEGUI);
  const alto = await page.evaluate(() =>
    Math.round(document.querySelector('#mNav .sheet').getBoundingClientRect().height));

  ok('il foglio parte da sotto lo schermo, non da dov\'è arrivato',
     salita[0] >= alto * 0.9, salita[0] + ' px di ' + alto);
  ok('e sale davvero, fotogramma per fotogramma',
     salita[salita.length - 1] < salita[0] - 20, salita.join(' → '));
  ok('salendo non salta: passa per le posizioni in mezzo',
     salita.filter(v => v > 5 && v < alto - 5).length >= 3, salita.join(' → '));

  await page.evaluate(() => new Promise(r => setTimeout(r, 500)));
  const arrivato = await page.evaluate(() =>
    Math.round(new DOMMatrixReadOnly(getComputedStyle(document.querySelector('#mNav .sheet')).transform).m42));
  ok('e arriva fino in fondo', arrivato === 0, arrivato + ' px');

  // ── e scende ─────────────────────────────────────────────────────────────
  const discesa = await page.evaluate(async (segui) => {
    closeSheet('mNav');
    return await eval(segui)('mNav', 6);
  }, SEGUI);
  ok('chiudendolo scende, invece di sparire',
     discesa[discesa.length - 1] > discesa[0] + 20, discesa.join(' → '));

  // Mentre scende è ancora grande quanto lo schermo: se prendesse i tocchi,
  // per un terzo di secondo dopo averlo chiuso l'app sembrerebbe bloccata.
  const mentreScende = await page.evaluate(() => {
    const m = document.getElementById('mNav');
    return { puntatori: getComputedStyle(m).pointerEvents, aperto: m.classList.contains('active') };
  });
  ok('mentre scende non si mangia i tocchi', mentreScende.puntatori === 'none', mentreScende.puntatori);
  ok('e per il resto del codice è già chiuso', mentreScende.aperto === false);

  // Finita la discesa se ne va dal layout: un foglio invisibile che resta lì
  // è un foglio che prima o poi darà fastidio.
  const dopo = await page.evaluate(async () => {
    await new Promise(r => setTimeout(r, 600));
    const m = document.getElementById('mNav');
    return { display: getComputedStyle(m).display, inScena: m.classList.contains('in-scena') };
  });
  ok('finito di scendere esce dal layout', dopo.display === 'none' && dopo.inScena === false,
     dopo.display);

  // Chiuso e riaperto subito: l'uscita in sospeso non deve portarselo via.
  const riapre = await page.evaluate(async () => {
    openSheet('mNav');
    await new Promise(r => setTimeout(r, 50));
    closeSheet('mNav');
    await new Promise(r => setTimeout(r, 50));
    openSheet('mNav');                       // ci si ripensa, mentre sta scendendo
    await new Promise(r => setTimeout(r, 600));
    const m = document.getElementById('mNav');
    return { display: getComputedStyle(m).display, aperto: m.classList.contains('active'),
             puntatori: getComputedStyle(m).pointerEvents };
  });
  ok('riaprendolo mentre scende resta aperto',
     riapre.aperto === true && riapre.display === 'flex', JSON.stringify(riapre));
  ok('e torna a prendere i tocchi', riapre.puntatori === 'auto', riapre.puntatori);

  // ── si chiude anche dai due modi che lo facevano a mano ──────────────────
  // Toccare fuori dal foglio, e il tasto che chiude tutto per andare sulla
  // mappa: prima toglievano .active a mano, e la discesa non partiva.
  const daFuori = await page.evaluate(async () => {
    const m = document.getElementById('mNav');
    m.click();                                // il tocco sullo sfondo
    await new Promise(r => requestAnimationFrame(r));
    return { inScena: m.classList.contains('in-scena'), aperto: m.classList.contains('active') };
  });
  ok('toccando fuori il foglio scende, non sparisce',
     daFuori.aperto === false && daFuori.inScena === true, JSON.stringify(daFuori));

  await page.close();

  // ── chi ha chiesto meno movimento ────────────────────────────────────────
  // Le animazioni non spariscono: diventano istantanee. La differenza conta —
  // togliendole e basta, le cose restano dove si trovavano quando è iniziata
  // l'animazione, cioè a metà strada.
  const calmo = await apri({ reducedMotion: 'reduce' });
  const fermo = await calmo.evaluate(async (segui) => {
    openSheet('mNav');
    const campioni = await eval(segui)('mNav', 4);
    const s = document.querySelector('#mNav .sheet');
    return { campioni, durata: getComputedStyle(s).transitionDuration };
  }, SEGUI);
  /* "Non scivola" vuol dire: non passa per le posizioni in mezzo. Il primo
     campione è ancora quello di partenza — openSheet mette il foglio giù e
     poi accende .active, e sono due momenti distinti anche qui — ma da lì
     salta al suo posto invece di percorrere la strada. */
  const aMeta = fermo.campioni.filter(v => v > 5 && v < alto - 5);
  ok('con "riduci il movimento" il foglio non scivola',
     aMeta.length === 0, fermo.campioni.join(' → '));
  ok('ma arriva lo stesso al suo posto, non a metà strada',
     fermo.campioni[fermo.campioni.length - 1] === 0, String(fermo.campioni[fermo.campioni.length - 1]));
  /* Istantanee, non sparite: se la durata fosse zero secco certe transizioni
     non emetterebbero transitionend, e chi ci si appoggia resterebbe fermo. */
  const sec = parseFloat(fermo.durata.split(',')[0]);
  ok('perché le transizioni diventano istantanee, non sparite',
     sec > 0 && sec < 0.05, fermo.durata);

  const lampeggio = await calmo.evaluate(() => {
    const d = document.querySelector('.gps-dot');
    return d ? getComputedStyle(d).animationIterationCount : 'nessun pallino';
  });
  ok('e niente lampeggia all\'infinito', lampeggio === '1' || lampeggio === 'nessun pallino', lampeggio);

  // La pagina che si apre resta comunque leggibile: senza questo, "meno
  // movimento" diventerebbe "meno app".
  const leggibile = await calmo.evaluate(() => {
    const p = document.getElementById('plan');
    const s = getComputedStyle(p);
    return { opacita: s.opacity, visibile: p.getBoundingClientRect().height > 100 };
  });
  ok('e le schermate restano piene e leggibili',
     leggibile.opacita === '1' && leggibile.visibile === true, JSON.stringify(leggibile));

  await calmo.close();

  console.log('\n' + r.join('\n'));
  const falliti = r.filter(x => x.includes('FALLITO')).length;
  console.log(`\n${r.length - falliti}/${r.length} passati`);
  if (err.length) console.log('\nErrori in pagina:\n' + err.join('\n'));
  await browser.close();
  process.exit(falliti ? 1 : 0);
})();
