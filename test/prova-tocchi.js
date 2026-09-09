/* Quanto è grande quello che si tocca.
 *
 * Apple indica 44×44 punti come minimo, e non è un capriccio da linee guida:
 * GeppGo si usa camminando per una città che non si conosce, con una mano
 * sola, spesso di fretta. Un tasto da 27 px lo si sbaglia — e sbagliarlo
 * vuol dire aprire la cosa accanto.
 *
 * Misurato prima di questa prova: la barra in basso era alta 41 px, le
 * scorciatoie della home 27, il "+" della giornata 26, la X della pubblicità
 * 14. Nessuna di queste cose si vedeva leggendo il codice.
 *
 * La correzione allarga l'area invisibile che risponde al dito senza toccare
 * l'aspetto, e per questo qui si controllano DUE cose, non una:
 *   1. che ogni tasto arrivi a 44×44;
 *   2. che le aree allargate **non si rubino i tocchi a vicenda** — un'area
 *      invisibile che copre il tasto accanto è peggio di un tasto piccolo,
 *      perché il dito va nel posto giusto e succede la cosa sbagliata. */
const { apriBrowser, APP } = require('./browser');

/* Le classi che si toccano più spesso in tutta l'app. Non è un elenco
   esaustivo: è l'elenco delle cose che si usano in mezzo alla strada. */
const CLASSI = ['nav-item', 'hh-act', 'hh-day', 'hh-trip', 'hh-trip-add', 'hh-add',
                'ibtn', 'edit-ic', 'seg-btn', 'gps-pill', 'th-btn', 'ad-x'];

const stato = { trips: [
  { id: 1, name: 'Giappone', destination: 'Tokyo', currency: 'JPY', status: 'open',
    start: '2026-09-01', end: '2026-09-05',
    participants: [{ id: 1, name: 'Gepp', isMe: true }, { id: 2, name: 'Luca' }],
    suggested: [], pois: [], tickets: [], weather: {}, expenses: [],
    days: [1, 2, 3, 4, 5].map(i => ({ id: i, date: '2026-09-0' + i, title: '', activities: [] })),
    createdAt: 1 },
  { id: 2, name: 'Lisbona', destination: 'Lisbona', currency: 'EUR', status: 'open',
    start: '2026-10-01', end: '2026-10-02', participants: [{ id: 1, name: 'Gepp', isMe: true }],
    suggested: [], pois: [], tickets: [], weather: {}, expenses: [],
    days: [{ id: 1, date: '2026-10-01', title: '', activities: [] }], createdAt: 2 }],
  currentTripId: 1, settings: {}, myName: 'Gepp', skipAuth: true };

(async () => {
  const browser = await apriBrowser();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const err = [];
  page.on('pageerror', e => err.push('PAGEERROR: ' + e.message));
  await page.addInitScript(s => localStorage.setItem('geppgo2', JSON.stringify(s)), stato);
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof myPos !== 'undefined', { timeout: 20000 });
  await page.evaluate(() => new Promise(r => setTimeout(r, 900)));

  const r = [];
  const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);

  const guarda = async (pagina) => await page.evaluate(({ CLASSI, pagina }) => {
    if (pagina) go(pagina);
    const vis = el => {
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden') return false;
      const b = el.getBoundingClientRect();
      return b.width > 0 && b.height > 0 && b.top >= 0 && b.bottom <= innerHeight;
    };
    const num = v => Math.abs(parseFloat(v) || 0);
    const piccoli = [], rubati = [], visti = [];
    /* Con un foglio aperto, tutto quello che sta dietro è coperto: chiedere
       "chi risponde qui?" restituirebbe il foglio, e sembrerebbe un furto di
       tocchi quando invece è solo un foglio davanti. Si guarda dentro il
       foglio, che è l'unica cosa toccabile in quel momento. */
    const radice = document.querySelector('.modal.active') || document;
    for (const c of CLASSI) {
      for (const el of radice.querySelectorAll('.' + c)) {
        if (!vis(el)) continue;
        const b = el.getBoundingClientRect();
        const a = getComputedStyle(el, '::after');
        const su = num(a.top), giu = num(a.bottom), sx = num(a.left), dx = num(a.right);
        const h = Math.round(b.height + su + giu), w = Math.round(b.width + sx + dx);
        visti.push(c);
        if (h < 44 || w < 44) piccoli.push(`${c} ${w}×${h}`);
        /* I quattro angoli dell'area allargata: se lì risponde un altro
           tasto, quel tasto sta rubando i tocchi. */
        const angoli = [[b.left - sx + 2, b.top - su + 2], [b.right + dx - 2, b.top - su + 2],
                        [b.left - sx + 2, b.bottom + giu - 2], [b.right + dx - 2, b.bottom + giu - 2]];
        for (const [x, y] of angoli) {
          const sotto = document.elementFromPoint(x, y);
          if (!sotto) continue;
          if (sotto === el || el.contains(sotto) || sotto.closest('.' + c) === el) continue;
          const chi = sotto.closest(CLASSI.map(k => '.' + k).join(',')) || sotto.closest('button,[onclick]');
          if (chi && chi !== el)
            rubati.push(`${c} "${(el.textContent || '').trim().slice(0, 12)}" → ${(chi.className || '').split(' ')[0]}`);
        }
      }
    }
    return { piccoli: [...new Set(piccoli)], rubati: [...new Set(rubati)], visti: [...new Set(visti)] };
  }, { CLASSI, pagina });

  const tutti = { piccoli: [], rubati: [], visti: [] };
  for (const pg of [null, 'discover', 'money', 'hotels', 'tickets', 'trips']) {
    const m = await guarda(pg);
    await page.evaluate(() => new Promise(r2 => setTimeout(r2, 350)));
    tutti.piccoli.push(...m.piccoli);
    tutti.rubati.push(...m.rubati);
    tutti.visti.push(...m.visti);
  }

  /* Le righe delle liste sono il posto dove i tasti erano più piccoli di
     tutti — 30 e 32 px scritti a mano, fuori dalla misura di casa. Vanno
     guardate aprendole davvero: sono dentro un foglio e in una schermata a
     cui il giro qui sopra non arriva. */
  await page.evaluate(() => {
    const t = T();
    t.pois = [{ id: 901, name: 'Fushimi Inari', lat: 34.96, lng: 135.77, address: 'Kyoto',
                notes: '', website: '', phone: '', hours: '', priority: 'essential', assignedDay: null }];
    t.packing = [{ id: 902, label: 'Adattatore', cat: 'Elettronica', checked: false }];
    save(); renderAll(); go('discover'); setDiscover('search');
  });
  await page.evaluate(() => new Promise(r2 => setTimeout(r2, 500)));
  const lista = await guarda(null);
  await page.evaluate(() => { openPacking(); });
  await page.evaluate(() => new Promise(r2 => setTimeout(r2, 600)));
  const bagagli = await guarda(null);
  for (const m of [lista, bagagli]) {
    tutti.piccoli.push(...m.piccoli); tutti.rubati.push(...m.rubati); tutti.visti.push(...m.visti);
  }
  await page.evaluate(() => closeSheet('mPacking'));
  tutti.piccoli = [...new Set(tutti.piccoli)];
  tutti.rubati = [...new Set(tutti.rubati)];
  tutti.visti = [...new Set(tutti.visti)];

  ok('tutto quello che si tocca arriva a 44×44',
     tutti.piccoli.length === 0, tutti.piccoli.join(', '));
  ok('e nessun tasto ruba il tocco a quello accanto',
     tutti.rubati.length === 0, tutti.rubati.join(' | '));
  /* Se un giorno qualcuno rinominasse le classi, la prova continuerebbe a
     passare guardando il vuoto. Qui si pretende di averne viste quasi tutte. */
  ok('e la prova ha davvero guardato i tasti che dice',
     tutti.visti.length >= CLASSI.length - 1,
     tutti.visti.length + ' classi su ' + CLASSI.length + ': ' + tutti.visti.join(', '));

  // ── l'aspetto non è cambiato ────────────────────────────────────────────
  // L'area cresce, il tasto no: è tutto il punto. Se un giorno qualcuno
  // "sistemasse" questo mettendo del padding vero, l'app cambierebbe faccia.
  await page.evaluate(() => go('plan'));
  await page.evaluate(() => new Promise(r2 => setTimeout(r2, 400)));
  const aspetto = await page.evaluate(() => {
    const a = document.querySelector('.hh-act'), n = document.querySelector('.nav-item');
    return { scorciatoia: Math.round(a.getBoundingClientRect().height),
             barra: Math.round(n.getBoundingClientRect().height) };
  });
  ok('ma i tasti restano piccoli a vedersi, come sono sempre stati',
     aspetto.scorciatoia < 34 && aspetto.barra < 44,
     'scorciatoia ' + aspetto.scorciatoia + ' px, barra ' + aspetto.barra + ' px');

  // ── e ogni tasto dice qualcosa quando lo tocchi ─────────────────────────
  const muti = await page.evaluate((CLASSI) => {
    const regole = [];
    for (const ss of document.styleSheets) {
      try { for (const x of ss.cssRules) if (x.selectorText) regole.push(x.selectorText); } catch (e) {}
    }
    const attive = regole.filter(s => /:active/.test(s)).join(' | ');
    return CLASSI.filter(c => !new RegExp('\\.' + c + '\\b[^,{]*:active').test(attive));
  }, CLASSI);
  /* gps-pill, ad-x e nav-item cambiano aspetto in altri modi (il pallino, la
     pillola nera che si sposta): quello che conta è che non ce ne siano
     tanti muti. */
  ok('quasi tutti rispondono al tocco', muti.length <= 3, 'muti: ' + (muti.join(', ') || 'nessuno'));

  console.log('\n' + r.join('\n'));
  const falliti = r.filter(x => x.includes('FALLITO')).length;
  console.log(`\n${r.length - falliti}/${r.length} passati`);
  if (err.length) console.log('\nErrori in pagina:\n' + err.join('\n'));
  await browser.close();
  process.exit(falliti ? 1 : 0);
})();
