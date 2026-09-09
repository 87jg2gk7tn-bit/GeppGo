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
    /* La striscia che contiene un tasto, quando scorre, lo taglia ai bordi:
       la barra in basso ha nove voci e ne mostra cinque. Una voce mezza
       fuori ha un angolo che cade SOPRA la pagina, non sopra la barra, e
       chiedere lì "chi risponde?" darebbe la scheda che sta dietro — che non
       è un furto di tocchi, è una voce non ancora scorsa in vista.
       Questa distinzione è costata una CI rossa: in locale i font di Google
       non si scaricano, le voci sono più strette e ci stanno tutte; sulla
       macchina delle prove no. */
    const scatola = el => {
      let p = el.parentElement;
      while (p && p !== document.body) {
        const s = getComputedStyle(p);
        if (/auto|scroll|hidden/.test(s.overflowX + s.overflowY)) return p.getBoundingClientRect();
        p = p.parentElement;
      }
      return null;
    };
    const vis = el => {
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden') return false;
      const b = el.getBoundingClientRect();
      if (!(b.width > 0 && b.height > 0 && b.top >= 0 && b.bottom <= innerHeight)) return false;
      const c = scatola(el);
      // dentro la sua striscia per intero, se ne ha una che scorre
      return !c || (b.left >= c.left - 1 && b.right <= c.right + 1);
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
        /* L'area vera, non quella sulla carta: dentro una striscia che
           scorre, quello che sborda viene tagliato — e un'area tagliata non
           è area guadagnata. Si conta solo quello che resta dentro. */
        const cont = scatola(el);
        let alto = b.top - su, basso = b.bottom + giu, sin = b.left - sx, des = b.right + dx;
        if (cont) {
          alto = Math.max(alto, cont.top); basso = Math.min(basso, cont.bottom);
          sin = Math.max(sin, cont.left); des = Math.min(des, cont.right);
        }
        const h = Math.round(basso - alto), w = Math.round(des - sin);
        visti.push(c);
        if (h < 44 || w < 44) piccoli.push(`${c} ${w}×${h}`);
        /* I quattro angoli dell'area vera: se lì risponde un altro tasto,
           quel tasto sta rubando i tocchi.
           Un tasto a cavallo del bordo della sua striscia dà un riquadro
           rovesciato (sinistra oltre destra): lì la sonda finirebbe fuori
           dalla barra, sulla pagina dietro, e griderebbe al furto per un
           tasto che è solo mezzo fuori vista. Questo caso ha fatto due CI
           rosse: si salta. */
        if (des - sin < 4 || basso - alto < 4) continue;
        const angoli = [[sin + 2, alto + 2], [des - 2, alto + 2],
                        [sin + 2, basso - 2], [des - 2, basso - 2]];
        for (const [x, y] of angoli) {
          // mai tastare fuori dalla striscia che contiene il tasto
          if (cont && (x < cont.left + 1 || x > cont.right - 1 ||
                       y < cont.top + 1 || y > cont.bottom - 1)) continue;
          const sotto = document.elementFromPoint(x, y);
          if (!sotto) continue;
          if (sotto === el || el.contains(sotto) || sotto.closest('.' + c) === el) continue;
          // rispondere il contenitore non è rubare: è la barra sotto al tasto
          if (sotto.contains(el)) continue;
          const chi = sotto.closest(CLASSI.map(k => '.' + k).join(',')) || sotto.closest('button,[onclick]');
          if (chi && chi !== el && !chi.contains(el))
            rubati.push(`${c} "${(el.textContent || '').trim().slice(0, 12)}" → ${(chi.className || '').split(' ')[0]}`);
        }
      }
    }
    return { piccoli: [...new Set(piccoli)], rubati: [...new Set(rubati)], visti: [...new Set(visti)] };
  }, { CLASSI, pagina });

  const tutti = { piccoli: [], rubati: [], visti: [] };
  /* Due larghezze, non una. Su uno schermo stretto la barra in basso scorre
     di più e le voci ai bordi sporgono: è la condizione in cui una prova
     scritta con leggerezza dà risposte sbagliate, ed è anche un telefono
     vero — un iPhone SE è largo 320. */
  /* La terza passata simula i font veri, che da qui non si scaricano ma in
     CI sì: il testo più largo fa scorrere di più la barra in basso e manda
     le voci ai bordi a cavallo del bordo della pillola. È il caso che ha
     fatto rossa la CI due volte mentre qui era verde — adesso si riproduce
     anche qui, e non serve più aspettare la CI per scoprirlo. */
  const LARGHEZZE = [[390, false], [320, false], [390, true]];
  for (const [largo, fontLarghi] of LARGHEZZE) {
    await page.setViewportSize({ width: largo, height: 844 });
    await page.evaluate((on) => {
      const vecchio = document.getElementById('provaFontLarghi');
      if (vecchio) vecchio.remove();
      if (!on) return;
      const st = document.createElement('style');
      st.id = 'provaFontLarghi';
      st.textContent = '.nav-item{padding-left:1.1rem!important;padding-right:1.1rem!important}';
      document.head.appendChild(st);
    }, fontLarghi);
    await page.evaluate(() => new Promise(r2 => setTimeout(r2, 400)));
    for (const pg of [null, 'discover', 'money', 'hotels', 'tickets', 'trips']) {
      const m = await guarda(pg);
      await page.evaluate(() => new Promise(r2 => setTimeout(r2, 350)));
      const dove = ' (a ' + largo + (fontLarghi ? ', font larghi' : '') + ')';
      tutti.piccoli.push(...m.piccoli.map(x => x + dove));
      tutti.rubati.push(...m.rubati.map(x => x + dove));
      tutti.visti.push(...m.visti);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { const v = document.getElementById('provaFontLarghi'); if (v) v.remove(); });
  await page.evaluate(() => new Promise(r2 => setTimeout(r2, 400)));

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

  // ── il giorno vuoto è un tasto, non un cartello ─────────────────────────
  // Diceva "tocca il titolo per aprire la giornata", e mandava la persona a
  // cercare un titolo mentre il tasto che fa quella cosa gli stava due
  // centimetri sopra. Quando non c'è niente in programma è l'unica cosa da
  // fare sullo schermo: è giusto che sia lui a rispondere al dito.
  const vuoto = await page.evaluate(async () => {
    const t = T();
    t.pois = []; t.days.forEach(d => d.activities = []);
    save(); renderAll(); go('plan');
    await new Promise(r2 => setTimeout(r2, 500));
    const el = document.querySelector('.hh-empty');
    if (!el) return { c: 'non c\'è' };
    const b = el.getBoundingClientRect();
    let chiamato = false;
    const vero = window.homeAdd;
    window.homeAdd = () => { chiamato = true; };
    // si tocca il centro, come farebbe un dito
    document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2).click();
    await new Promise(r2 => setTimeout(r2, 150));
    window.homeAdd = vero;
    return { c: 'c\'è', tasto: el.tagName, alto: Math.round(b.height),
             testo: el.innerText.replace(/\s+/g, ' ').trim(), chiamato };
  });
  ok('il giorno vuoto dice cosa fare, invece di mandarti a cercare',
     /Aggiungi la prima tappa/.test(vuoto.testo || ''), vuoto.testo || vuoto.c);
  ok('ed è un tasto vero, non un cartello', vuoto.tasto === 'BUTTON', String(vuoto.tasto));
  ok('toccandolo si aggiunge la tappa', vuoto.chiamato === true);
  ok('ed è grande abbastanza da non poterlo sbagliare', vuoto.alto >= 44, vuoto.alto + ' px');

  console.log('\n' + r.join('\n'));
  const falliti = r.filter(x => x.includes('FALLITO')).length;
  console.log(`\n${r.length - falliti}/${r.length} passati`);
  if (err.length) console.log('\nErrori in pagina:\n' + err.join('\n'));
  await browser.close();
  process.exit(falliti ? 1 : 0);
})();
