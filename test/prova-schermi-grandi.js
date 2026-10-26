/* GLI SCHERMI GRANDI (Layout 3): l'esterno e l'interno dell'iPhone Duo,
   l'iPad e il computer, con le decisioni del Passo 0.

   1. in francese a 320 px la barra dice «Accueil» e «Agenda», intere; le
      traduzioni confermate sono quelle in uso; la regola dei 2 e 3 tocchi
      sta in CLAUDE.md;
   2. la copia che va online (test/fai-il-sito.js) non ha commenti, tranne
      quelli di licenza, e il file di lavoro sì; nel browser si comporta come
      l'originale (stessi fogli di stile, stessa pagina, l'app parte senza
      errori); le prove principali passano anche su di lei; i KB compressi
      scendono; i flussi di GitHub la fanno, la provano e la pubblicano;
   3. nessun margine sicuro scritto in forma abbreviata per i due lati, e col
      margine di un lato solo (la fotocamera del Duo) il contenuto si sposta
      da quella parte e basta;
   4. alle larghezze del Passo 1 niente scorre di lato, niente esce dallo
      schermo, niente testo tagliato, in 5 lingue e nei due temi;
   5. da 900 px (o in orizzontale su uno schermo grande) la barra sta di lato
      con icona e parola; sotto resta in basso;
   6. sugli schermi larghi i fogli sono schede centrate, con l'azione
      principale visibile in fondo;
   7. il Programma largo: due colonne, la mappa ferma, la tappa e il suo
      segnaposto accesi insieme;
   8. a 385 px (Split View) e sull'esterno del Duo l'app e' quella del
      telefono;
   9. su un iPhone normale (390 x 844) l'aspetto non cambia: le schermate
      sono quelle di prima della Layout 3, pixel per pixel;
   10. nessuna violazione grave di axe sulle schermate larghe; il CSS in testa
       resta piccolo.

   `node test/prova-schermi-grandi.js 4 7` fa solo le prove 4 e 7. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const { spawnSync } = require('child_process');
const { apriBrowser, APP, RADICE } = require('./browser');
const { apriPagina, MISURA, NOMI } = require('./schermate');
const { misura } = require('./prova-accessibilita');
const sito = require('./fai-il-sito');

const r = [];
const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);
const errori = [];
const SCELTE = process.argv.slice(2).filter(a => /^\d+$/.test(a));
const fare = n => !SCELTE.length || SCELTE.includes(String(n));
const prova = async (nome, fn) => { try { await fn(); } catch (e) { ok(nome, false, 'si è fermata: ' + e.message.split('\n')[0]); } };
const primi = (l, n = 5) => l.slice(0, n).join(' | ') + (l.length > n ? ` (e altri ${l.length - n})` : '');
const kb = n => (n / 1024).toFixed(1).replace('.', ',') + ' KB';
const LINGUE = ['it', 'en', 'es', 'fr', 'pt'];
const LAVORO = fs.readFileSync(path.join(RADICE, 'Index 2.1.html'), 'utf8');
/* Le misure del Passo 1 */
const MISURE = [['Split View', 385, 800], ['esterno del Duo', 466, 678], ['interno del Duo in verticale', 670, 870],
  ['interno del Duo in orizzontale', 950, 585], ['iPad', 1024, 768], ['computer', 1280, 800]];
/* L'ultima versione prima della Layout 3 (la Layout 2): per la prova 9. */
const RIFERIMENTO = 'b8a2eb5';
const apri = (browser, o = {}) => apriPagina(browser, Object.assign({ errori, chiave: 'sg-' + Math.random(), attesa: 600 }, o));
const chiudiFogli = p => p.evaluate(() => document.querySelectorAll('.modal.active').forEach(m => { try { closeSheet(m.id); } catch (e) { m.classList.remove('active'); } }));
/* Le animazioni finite e i messaggi via: si misura una schermata ferma. */
const ferma = async (p, ms = 350) => {
  await p.waitForTimeout(ms);
  await p.evaluate(() => { document.getAnimations().forEach(a => { try { a.finish(); } catch (e) {} }); document.querySelectorAll('.toast').forEach(x => x.remove()); });
};
/* Il margine sicuro di un lato solo, come la fotocamera del Duo: Chromium lo
   finge con il suo protocollo (Emulation.setSafeAreaInsetsOverride). */
async function margini(page, insets) {
  const s = await page.context().newCDPSession(page);
  await s.send('Emulation.setSafeAreaInsetsOverride', { insets: Object.assign({ top: 0, bottom: 0, left: 0, right: 0 }, insets) });
  await page.waitForTimeout(250);
  return s;
}
/* I commenti di una pagina, contati con gli stessi lettori della copia. */
function contaCommenti(html) {
  const n = { js: 0, css: 0, html: 0 };
  for (const p of sito.pezziHtml(html)) {
    if (p.tipo === 'commento') { if (!p.testo.startsWith('!')) n.html++; continue; }
    if (/\bsrc\s*=/i.test(p.apertura)) continue;
    const dentro = html.slice(p.start, p.end);
    if (p.tipo === 'style') n.css += sito.commentiCss(dentro).filter(c => !c.testo.startsWith('!')).length;
    else if (sito.eJavaScript(p.apertura)) n.js += sito.commentiJs(dentro, 'script').filter(c => !(c.blocco && c.testo.startsWith('!'))).length;
  }
  return n;
}
/* Due foto uguali? Si confrontano nel browser, pixel per pixel: una
   differenza vera (un colore, un bordo, una scritta spostata) ne cambia
   centinaia; l'arrotondamento dei bordi delle lettere qualche decina. */
const CONFRONTA = async ([a, b]) => {
  const carica = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = 'data:image/png;base64,' + src; });
  const [ia, ib] = await Promise.all([carica(a), carica(b)]);
  if (ia.width !== ib.width || ia.height !== ib.height) return { diversi: -1, totale: 0 };
  const dati = img => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
  const da = dati(ia), db = dati(ib);
  let diversi = 0;
  for (let i = 0; i < da.length; i += 4) if (Math.abs(da[i] - db[i]) > 24 || Math.abs(da[i + 1] - db[i + 1]) > 24 || Math.abs(da[i + 2] - db[i + 2]) > 24) diversi++;
  return { diversi, totale: da.length / 4 };
};

(async () => {
  const browser = await apriBrowser();

  /* ── 1. Passo 0: il francese, le traduzioni, la regola dei tocchi ───────── */
  if (fare(1)) await prova('1', async () => {
    const p = await apri(browser, { lingua: 'fr', larghezza: 320 });
    const b = await p.evaluate(async () => {
      await document.fonts.ready; navAdatta();
      const pista = document.querySelector('.nav .nav-track');
      const voci = [...pista.querySelectorAll('.ni-tx')].map(t => {
        const rg = document.createRange(); rg.selectNodeContents(t);
        const q = t.getBoundingClientRect();
        return { testo: t.textContent.trim(), intera: t.scrollWidth <= t.clientWidth + 0.5 && rg.getBoundingClientRect().width <= q.width + 0.5, dentro: q.left >= 0 && q.right <= innerWidth };
      });
      const scorre = pista.scrollWidth > pista.clientWidth + 1;
      openDay(0); await new Promise(r => setTimeout(r, 400));
      return { voci, scorre, vero: document.fonts.check('600 12px "Plus Jakarta Sans"'), titolo: document.querySelector('#mDay .tt-title').textContent.trim() };
    });
    await p.close();
    const acc = b.voci.find(v => v.testo === 'Accueil'), age = b.voci.find(v => v.testo === 'Agenda');
    ok('1. in francese a 320 px la barra dice «Accueil» e «Agenda», intere e a schermo, e la barra non scorre',
      !!acc && !!age && acc.intera && age.intera && acc.dentro && age.dentro && !b.scorre,
      b.voci.map(v => v.testo + (v.intera ? '' : ' (tagliata)')).join(' · ') + (b.vero ? ', caratteri veri' : ', caratteri di riserva'));
    ok('1. e la schermata si chiama «Agenda» anche nel titolo', b.titolo === 'Agenda', b.titolo);
    const q = await apri(browser);
    const d = await q.evaluate(() => {
      const voce = k => ['en', 'es', 'fr', 'pt'].map(l => DIZIONARIO[l][k]);
      const fr = Object.entries(DIZIONARIO.fr).filter(([k, v]) => /Programma/.test(k) && /programme/i.test(v)).map(([k, v]) => v);
      return { programma: voce('Programma'), prenotazioni: voce('Prenotazioni'), oggi: DIZIONARIO.fr.Oggi, fr,
        mappa: MAPPA_APP.split('\n').find(l => l.startsWith('- La barra in basso')) || '' };
    });
    await q.close();
    ok('1. «Programma» = Schedule / Programa / Agenda / Roteiro', JSON.stringify(d.programma) === '["Schedule","Programa","Agenda","Roteiro"]', d.programma.join(' / '));
    ok('1. «Prenotazioni» = Bookings / Reservas / Réservations / Reservas', JSON.stringify(d.prenotazioni) === '["Bookings","Reservas","Réservations","Reservas"]', d.prenotazioni.join(' / '));
    ok('1. «Oggi» in francese è «Accueil»', d.oggi === 'Accueil', d.oggi);
    ok('1. in francese nessuna frase chiama più la schermata «programme» («au programme», che vuol dire previsto, resta)', !d.fr.length, primi(d.fr, 3));
    ok('1. l\'assistente riceve i nomi della barra in ogni lingua (MAPPA_APP): in francese Accueil · Agenda',
      /francese Accueil · Agenda · Découvrir · Dépenses · Réservations/.test(d.mappa) && /inglese Today · Schedule/.test(d.mappa));
    const claude = fs.readFileSync(path.join(RADICE, 'CLAUDE.md'), 'utf8').replace(/\s+/g, ' ');
    ok('1. CLAUDE.md: 2 tocchi per le funzioni d\'uso frequente, 3 per impostazioni e azioni rare, sempre con voci scritte',
      /Le funzioni d'uso frequente si raggiungono dalla Home o dalla barra in basso in al massimo 2 tocchi; impostazioni e azioni rare \(per esempio rinominare, cambiare i giorni o eliminare un viaggio\) in al massimo 3\. Sempre tramite voci con un testo leggibile, mai solo icone o gesti\./.test(claude));
  });

  /* ── 2. la copia che va online ─────────────────────────────────────────── */
  if (fare(2)) await prova('2', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'geppgo-sito-'));
    try {
      const { misure } = sito.faiIlSito(dir, { zitto: true });
      const copia = fs.readFileSync(path.join(dir, 'Index 2.1.html'), 'utf8');
      const nL = contaCommenti(LAVORO), nC = contaCommenti(copia);
      ok('2. la copia non ha commenti (JavaScript, CSS e HTML), il file di lavoro sì',
        nC.js === 0 && nC.css === 0 && nC.html === 0 && nL.js > 500 && nL.css > 100 && nL.html > 20,
        `lavoro ${nL.js} JS, ${nL.css} CSS, ${nL.html} HTML — copia ${nC.js}, ${nC.css}, ${nC.html}`);
      const altre = sito.PAGINE.filter(f => f !== 'Index 2.1.html').map(f => [f, contaCommenti(fs.readFileSync(path.join(dir, f), 'utf8'))])
        .concat([['sw.js', { js: sito.commentiJs(fs.readFileSync(path.join(dir, 'sw.js'), 'utf8'), 'script').filter(c => !(c.blocco && c.testo.startsWith('!'))).length, css: 0, html: 0 }]])
        .filter(([, n]) => n.js || n.css || n.html).map(([f, n]) => `${f}: ${n.js + n.css + n.html}`);
      ok('2. e nemmeno le altre pagine e la service worker', !altre.length, altre.join(', '));
      const js = sito.senzaCommentiJs('a=1;/*! licenza MIT */\n// via\nb=2/* via */+3\n'), css = sito.senzaCommentiCss('a{margin:1px/**/2px}/*! licenza */');
      ok('2. restano solo i commenti di licenza (/*! … */), e dove un commento separava due pezzi resta uno spazio',
        /\/\*! licenza MIT \*\//.test(js) && !/via/.test(js) && /\/\*! licenza \*\//.test(css) && /1px 2px/.test(css), JSON.stringify([js, css]));
      /* I token della copia sono quelli dell'originale, a capo compresi: lo
         controlla la copia stessa mentre si fa, qui lo si rifà da fuori. */
      const scr = h => sito.pezziHtml(h).filter(p => p.tipo === 'script' && !/\bsrc\s*=/i.test(p.apertura)).map(p => h.slice(p.start, p.end));
      const sL = scr(LAVORO), sC = scr(copia);
      const diversi = sL.map((s, i) => JSON.stringify(sito.tokenJs(s, 'script')) === JSON.stringify(sito.tokenJs(sC[i] || '', 'script')) ? null : i).filter(x => x !== null);
      ok(`2. negli script della copia i token sono gli stessi dell'originale (${sL.length} script)`, sL.length === sC.length && !diversi.length, diversi.join(', '));
      /* Nel browser: i fogli di stile e la pagina (senza JavaScript) uguali, e
         l'app che parte e si usa senza errori. */
      const leggi = async u => {
        const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
        const pg = await ctx.newPage(); await pg.goto(u);
        const x = await pg.evaluate(() => {
          const css = [...document.styleSheets].map(s => { try { return [...s.cssRules].map(r => r.cssText).join('\n'); } catch (e) { return '?'; } });
          const c = document.documentElement.cloneNode(true);
          const w = document.createTreeWalker(c, NodeFilter.SHOW_COMMENT), via = [];
          while (w.nextNode()) via.push(w.currentNode);
          via.forEach(n => n.remove());
          c.querySelectorAll('script,style').forEach(n => { n.textContent = ''; });
          return { css, html: c.outerHTML.replace(/>\s+</g, '> <').replace(/\s+/g, ' ') };
        });
        await ctx.close(); return x;
      };
      const a = await leggi(pathToFileURL(path.join(RADICE, 'Index 2.1.html')).href), c = await leggi(pathToFileURL(path.join(dir, 'Index 2.1.html')).href);
      ok(`2. nel browser la copia ha gli stessi fogli di stile (${a.css.map(x => x.split('\n').length).join(' + ')} regole) e la stessa pagina`,
        JSON.stringify(a.css) === JSON.stringify(c.css) && a.html === c.html);
      const errCopia = [];
      const pg = await apriPagina(browser, { errori: errCopia, chiave: 'copia', attesa: 600, indirizzo: pathToFileURL(path.join(dir, 'Index 2.1.html')).href });
      const giro = await pg.evaluate(async () => {
        const fatto = [];
        for (const p of ['discover', 'money', 'prenotazioni', 'trips', 'plan']) { go(p); fatto.push(document.getElementById(p).classList.contains('active')); }
        openDay(0); await new Promise(r => setTimeout(r, 500));
        fatto.push(document.querySelectorAll('#ttBody .tt-block[data-id]').length === 3);
        openExpense(); await new Promise(r => setTimeout(r, 400));
        fatto.push(document.getElementById('mExpense').classList.contains('active'));
        return fatto;
      });
      await pg.close();
      ok('2. e la copia si apre e si usa senza errori (pagine, Programma, un foglio)', giro.every(Boolean) && !errCopia.length, JSON.stringify(giro) + ' ' + primi(errCopia, 2));
      /* Le prove principali, sulla copia. Tutta la batteria la gira il
         secondo lavoro di prove.yml, a ogni modifica. */
      const PRINCIPALI = ['prova-versione.js', 'prova-nav.js', 'prova-giornata.js', 'prova-spese.js', 'prova-undo.js', 'prova-prenotazioni.js'];
      const esiti = PRINCIPALI.map(f => {
        const res = spawnSync(process.execPath, [path.join(__dirname, f)], { encoding: 'utf8', timeout: 6 * 60 * 1000,
          env: Object.assign({}, process.env, { APP_URL: pathToFileURL(path.join(dir, 'Index 2.1.html')).href }) });
        const m = [...((res.stdout || '') + (res.stderr || '')).matchAll(/(\d+)\/(\d+) passati/g)].pop();
        return { f, bene: res.status === 0 && !!m && m[1] === m[2], conto: m ? m[1] + '/' + m[2] : 'non arrivata in fondo' };
      });
      ok(`2. le prove principali passano anche sulla copia: ${esiti.map(e => e.f.replace(/^prova-|\.js$/g, '') + ' ' + e.conto).join(', ')}`, esiti.every(e => e.bene));
      const g = misure.find(x => x.nome === 'Index 2.1.html');
      ok(`2. compressi, i KB dell'app scendono: ${kb(g.gzPrima)} → ${kb(g.gzDopo)} (−${Math.round((1 - g.gzDopo / g.gzPrima) * 100)}%)`, g.gzDopo < g.gzPrima * 0.85);
      const pub = fs.readFileSync(path.join(RADICE, '.github', 'workflows', 'pubblica.yml'), 'utf8');
      const prv = fs.readFileSync(path.join(RADICE, '.github', 'workflows', 'prove.yml'), 'utf8');
      ok('2. pubblica.yml fa la copia a ogni push su main e pubblica _site su Pages (solo se Pages pubblica da GitHub Actions)',
        /push:\s*\n\s*branches: \[main\]/.test(pub) && /npm run sito/.test(pub) && /upload-pages-artifact/.test(pub) && /path: _site/.test(pub) && /deploy-pages/.test(pub) && /build_type/.test(pub));
      ok('2. prove.yml gira le prove dell\'app anche sulla copia', /npm run sito/.test(prv) && /APP_URL="file:\/\/\$GITHUB_WORKSPACE\/_site\/Index%202\.1\.html"/.test(prv));
      ok('2. la copia non va nel repo (_site/ in .gitignore)', /^_site\/$/m.test(fs.readFileSync(path.join(RADICE, '.gitignore'), 'utf8')));
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  /* ── 3. i margini sicuri, un lato alla volta ───────────────────────────── */
  if (fare(3)) await prova('3', async () => {
    /* Nel foglio di stile (senza i commenti, che ne parlano): nessuna forma
       abbreviata con il margine di sinistra o di destra, e nessun lato che
       prende il margine dell'altro. */
    const css = sito.pezziHtml(LAVORO).filter(p => p.tipo === 'style').map(p => sito.senzaCommentiCss(LAVORO.slice(p.start, p.end))).join('\n');
    const ABBREVIATE = /^(padding|margin|inset|border|border-width|padding-inline|margin-inline|inset-inline|scroll-padding|scroll-margin|gap)$/;
    const male = [], usi = [];
    for (const m of css.matchAll(/([a-z-]+)\s*:\s*([^;{}]*safe-area-inset-(?:left|right)[^;{}]*)/g)) {
      const prop = m[1], val = m[2], sx = /inset-left/.test(val), dx = /inset-right/.test(val);
      usi.push(prop);
      if (ABBREVIATE.test(prop)) male.push(`${prop}: ${val.slice(0, 60)}`);
      else if (/(^|-)left$/.test(prop) && dx && !sx) male.push(`${prop} prende il margine di destra`);
      else if (/(^|-)right$/.test(prop) && sx && !dx) male.push(`${prop} prende il margine di sinistra`);
    }
    const inLinea = [...LAVORO.matchAll(/(?:padding|margin|inset)\s*:[^;"'`{}]*safe-area-inset-(?:left|right)/g)].map(x => x[0].slice(0, 60));
    ok(`3. nessun margine sicuro di lato in forma abbreviata (${usi.length} regole con i margini di sinistra e di destra)`, usi.length > 20 && !male.length && !inLinea.length, primi(male.concat(inLinea), 3));
    /* E dal vero: la fotocamera da una parte sola. Il contenuto si sposta da
       quella parte e basta: dall'altra non si aggiungono i suoi 48 px (con
       una forma abbreviata ci sarebbero da tutte e due). Le distanze si
       misurano dentro il contenitore delle pagine, cosi' la barra laterale
       non conta. */
    const fuori = [];
    for (const [w, h] of [[466, 678], [670, 870], [950, 585]]) for (const lato of ['left', 'right']) {
      const p = await apri(browser, { larghezza: w, altezza: h });
      await margini(p, { [lato]: 48 });
      await p.evaluate(() => { misuraBordi(); navAdatta(); });
      await ferma(p);
      const misure = async () => p.evaluate(lato => {
        const W = innerWidth, cam = 48;
        const box = el => el && el.getClientRects().length ? el.getBoundingClientRect() : null;
        const testi = sel => [...document.querySelectorAll(sel)].filter(el => box(el) && box(el).width > 0);
        const sotto = [];
        /* scritte e tasti che devono restare fuori dalla fotocamera */
        const controlla = (nome, el) => { const q = box(el); if (!q || !q.width) return; if (lato === 'left' ? q.left < cam - 0.5 : q.right > W - cam + 0.5) sotto.push(`${nome} ${Math.round(lato === 'left' ? q.left : W - q.right)} px dal bordo`); };
        testi('.topbar button, .topbar .mv-nome').forEach(el => controlla('barra in alto', el));
        testi('.nav .nav-item').forEach(el => controlla('barra delle sezioni', el));
        testi('.page.active .hh-eyebrow, .page.active .hh-city, .page.active .card, .page.active .tt-title, .page.active .tt-block').forEach(el => controlla(el.className.split(' ')[0], el));
        /* le schede della pagina: dalla parte della fotocamera la distanza
           comprende i suoi 48 px, dall'altra no */
        const sc = document.querySelector('main.scroll').getBoundingClientRect();
        const schede = testi('.page.active .card').map(el => { const q = box(el); return { sx: q.left - sc.left, dx: sc.right - q.right }; });
        const asim = schede.length ? schede.map(g => lato === 'left' ? g.sx - g.dx : g.dx - g.sx) : [];
        /* con la barra di lato, la fotocamera di sinistra la copre la barra:
           si guarda che la barra se la prenda, e le pagine restano al centro */
        if (barraLaterale() && lato === 'left') {
          const nav = document.querySelector('.nav').getBoundingClientRect();
          if (nav.width < 96 + cam - 1) sotto.push(`la barra laterale non si allarga per la fotocamera (${Math.round(nav.width)} px)`);
          return { sotto, asim: null };
        }
        return { sotto, asim: asim.length ? Math.min(...asim) : null };
      }, lato);
      const casa = await misure();
      await p.evaluate(() => openDay(0)); await ferma(p, 600);
      const prog = await misure();
      await p.evaluate(() => openExpense()); await ferma(p, 500);
      const foglio = await p.evaluate(lato => {
        const m = document.querySelector('.modal.active .sheet'); if (!m) return ['il foglio non si apre'];
        const W = innerWidth, el = [...m.querySelectorAll('.sheet-t, input, .btn-primario')].filter(x => x.getClientRects().length);
        return el.filter(x => { const q = x.getBoundingClientRect(); return lato === 'left' ? q.left < 48 - 0.5 : q.right > W - 48 + 0.5; }).map(x => (x.className || x.tagName).toString().split(' ')[0] + ' sotto la fotocamera');
      }, lato);
      await p.close();
      const dove = `${w}×${h}, fotocamera a ${lato === 'left' ? 'sinistra' : 'destra'}`;
      casa.sotto.concat(prog.sotto, foglio).forEach(x => fuori.push(`${dove}: ${x}`));
      if (casa.asim != null && casa.asim < 40) fuori.push(`${dove}: le schede hanno la stessa aria dalle due parti (${Math.round(casa.asim)} px di differenza), come se la fotocamera fosse anche dall'altra`);
    }
    ok('3. con la fotocamera da una parte sola (466, 670, 950 px, a sinistra e a destra) niente ci finisce sotto, e l\'altro lato tiene il suo margine', !fuori.length, primi(fuori, 4));
  });

  /* ── 4. alle larghezze del Passo 1: niente fuori, niente tagliato ──────── */
  if (fare(4)) await prova('4', async () => {
    const SCHERMATE = [['Oggi', "go('plan')"], ['Programma', 'openDay(0)'], ['Scopri', "go('discover');setDiscover('search')"], ['Spese', "go('money')"],
      ['Prenotazioni', "apriPrenotazioni('biglietti')"], ['Hotel', "apriPrenotazioni('hotel')"], ['Profilo', "go('trips')"], ['menu dei viaggi', 'apriViaggi()'], ['Nuova spesa', 'openExpense()']];
    const male = []; let misurate = 0;
    for (const [nome, w, h] of MISURE) for (const lingua of LINGUE) for (const tema of ['chiaro', 'scuro']) {
      const p = await apri(browser, { lingua, larghezza: w, altezza: h, tema, attesa: 400 });
      for (const [sn, js] of SCHERMATE) {
        await chiudiFogli(p); await p.waitForTimeout(60);
        await p.evaluate(js); await ferma(p, 300);
        const mm = await p.evaluate(MISURA, NOMI);
        misurate++;
        [...mm.fuori, ...mm.troncati, ...mm.sovrapposti].forEach(x => male.push(`${w}×${h} ${lingua} ${tema} ${sn}: ${x}`));
      }
      await p.close();
    }
    ok(`4. alle ${MISURE.length} larghezze del Passo 1 (${MISURE.map(m => m[1] + '×' + m[2]).join(', ')}), in 5 lingue e due temi, niente scorre di lato, esce dallo schermo o è tagliato (${misurate} schermate)`,
      misurate > 0 && !male.length, primi(male, 4));
  });

  /* ── 5. la barra di lato da 900 px, in basso sotto ────────────────────── */
  if (fare(5)) await prova('5', async () => {
    const CASI = [[385, 800, false, 'Split View'], [466, 678, false, 'esterno del Duo'], [670, 870, false, 'interno del Duo in verticale'], [768, 1024, false, 'iPad in verticale'],
      [844, 390, false, 'telefono in orizzontale'], [850, 600, true, 'orizzontale su uno schermo grande'], [950, 585, true, 'interno del Duo in orizzontale'],
      [900, 1200, true, '900 px in verticale'], [1024, 768, true, 'iPad'], [1280, 800, true, 'computer']];
    const male = [], aprono = [];
    for (const [w, h, diLato, nome] of CASI) {
      const p = await apri(browser, { larghezza: w, altezza: h });
      const b = await p.evaluate(async () => {
        await document.fonts.ready;
        const nav = document.querySelector('.nav'), q = nav.getBoundingClientRect();
        const voci = [...nav.querySelectorAll('.nav-item')].map(v => {
          const ic = v.querySelector('.ni-ic svg'), tx = v.querySelector('.ni-tx'), qv = v.getBoundingClientRect(), qi = ic.getBoundingClientRect(), qt = tx.getBoundingClientRect();
          const rg = document.createRange(); rg.selectNodeContents(tx);
          return { w: qv.width, h: qv.height, icona: qi.width >= 20, parola: tx.textContent.trim(), sotto: qt.top >= qi.bottom - 1, intera: tx.scrollWidth <= tx.clientWidth + 0.5 && rg.getBoundingClientRect().width <= qt.width + 0.5, px: parseFloat(getComputedStyle(tx).fontSize) };
        });
        return { q: { l: q.left, t: q.top, r: q.right, b: q.bottom, w: q.width, h: q.height }, voci, js: barraLaterale(), W: innerWidth, H: innerHeight };
      });
      const lato = b.q.h > b.q.w && b.q.l <= 0.5 && b.q.t <= 0.5 && b.q.b >= b.H - 0.5;
      const basso = b.q.w > b.q.h && b.q.b >= b.H - 40 && b.q.b <= b.H + 0.5;
      if (diLato ? !lato : !basso) male.push(`${nome} (${w}×${h}): la barra ${lato ? 'sta di lato' : basso ? 'sta in basso' : 'è altrove'}`);
      if (b.js !== diLato) male.push(`${nome}: barraLaterale() dice ${b.js}`);
      b.voci.forEach(v => { if (!v.icona || !v.sotto || !v.intera || v.px < 12 || v.w < 44 || v.h < 44) male.push(`${nome}: «${v.parola}» ${!v.icona ? 'senza icona' : !v.sotto ? 'non sotto l\'icona' : !v.intera ? 'tagliata' : v.px < 12 ? 'sotto i 12 px' : Math.round(v.w) + '×' + Math.round(v.h)}`); });
      if (diLato) {
        /* ogni voce apre la sua schermata, toccandola davvero */
        const pagine = ['plan', 'mDay', 'discover', 'money', 'prenotazioni'];
        for (let i = 0; i < pagine.length; i++) {
          await p.locator('.nav .nav-item').nth(i).click(); await p.waitForTimeout(350);
          const att = await p.evaluate(() => (document.querySelector('main .page.active') || {}).id);
          if (att !== pagine[i]) aprono.push(`${nome}: voce ${i + 1} → ${att}`);
        }
      }
      await p.close();
    }
    ok('5. da 900 px, o in orizzontale su uno schermo grande (850×600, 950×585), la barra sta di lato, alta quanto lo schermo, con l\'icona e la parola sotto; sotto i 900 px, e in un telefono in orizzontale (844×390), resta in basso',
      !male.length, primi(male, 4));
    ok('5. di lato ogni voce apre la sua schermata', !aprono.length, primi(aprono, 3));
    /* le parole intere anche di lato, in cinque lingue */
    const parole = [];
    for (const lingua of LINGUE) {
      const p = await apri(browser, { lingua, larghezza: 1024, altezza: 768 });
      const t = await p.evaluate(async () => { await document.fonts.ready; return [...document.querySelectorAll('.nav .ni-tx')].filter(tx => { const rg = document.createRange(); rg.selectNodeContents(tx); return rg.getBoundingClientRect().width > tx.getBoundingClientRect().width + 0.5 || tx.getBoundingClientRect().right > document.querySelector('.nav').getBoundingClientRect().right; }).map(tx => tx.textContent); });
      t.forEach(x => parole.push(`${lingua} «${x}»`));
      await p.close();
    }
    ok('5. e le parole stanno intere nella barra di lato, in cinque lingue', !parole.length, parole.join(', '));
    /* le misure sono le stesse nel foglio di stile e in JavaScript */
    const norm = s => s.replace(/\s+/g, '');
    const lat = (LAVORO.match(/const LATERALE_MQ='([^']+)'/) || [])[1] || '', lar = (LAVORO.match(/const LARGO_MQ='([^']+)'/) || [])[1] || '';
    const cssLat = LAVORO.includes('@media ' + lat + '{') || norm(LAVORO).includes(norm('@media ' + lat + '{'));
    const cssLar = norm(LAVORO).includes(norm('@media ' + lar + '{'));
    ok('5. le soglie sono scritte uguali nel foglio di stile e in JavaScript (LARGO_MQ, LATERALE_MQ)', !!lat && !!lar && cssLat && cssLar, `${lar} · ${lat}`);
  });

  /* ── 6. i fogli, schede centrate ──────────────────────────────────────── */
  if (fare(6)) await prova('6', async () => {
    const FOGLI = [['Nuovo viaggio', 'openNewTrip()'], ['Nuova spesa', 'openExpense()'], ['Nuova tappa', 'openActDetail(0,null)'], ['Giorni', 'openTripDates()'],
      ['Aggiungi biglietto', 'openTicketSheet()'], ['Tetti di spesa', 'apriTetti()'], ['Meteo', 'apriMeteo()'], ['Scheda del viaggio', 'openTripZoom(T().id)'], ['Mappa del viaggio', 'apriMappaViaggio()']];
    const male = []; let visti = 0;
    for (const [w, h] of [[670, 870], [950, 585], [1024, 768], [1280, 800]]) {
      const p = await apri(browser, { larghezza: w, altezza: h });
      for (const [nome, js] of FOGLI) {
        await chiudiFogli(p); await p.waitForTimeout(80);
        const c = await p.evaluate(js => { try { eval(js); return true; } catch (e) { return e.message; } }, js);
        if (c !== true) { male.push(`${w}px ${nome}: ${c}`); continue; }
        await ferma(p, 500);
        const e = await p.evaluate(() => {
          const m = [...document.querySelectorAll('.modal.active')].pop(); if (!m) return { niente: true };
          const s = m.querySelector('.sheet'); s.scrollTop = 0;
          const q = s.getBoundingClientRect(), cs = getComputedStyle(s);
          const b = [...m.querySelectorAll('.sheet-piede .btn-primario, .btn-primario')].find(x => x.getBoundingClientRect().height > 0);
          const out = { sx: q.left, dx: innerWidth - q.right, w: q.width, sotto: innerHeight - q.bottom, raggio: parseFloat(cs.borderBottomLeftRadius), mappa: s.classList.contains('vm-sheet') };
          if (b) {
            const qb = b.getBoundingClientRect(), sopra = document.elementFromPoint(qb.left + qb.width / 2, qb.top + qb.height / 2);
            Object.assign(out, { tasto: b.innerText.trim(), dentro: qb.top >= Math.max(0, q.top) && qb.bottom <= Math.min(innerHeight, q.bottom) + 0.5, libero: !!sopra && (sopra === b || b.contains(sopra)), piede: !!b.closest('.sheet-piede') });
          }
          return out;
        });
        if (e.niente) { male.push(`${w}px ${nome}: il foglio non si apre`); continue; }
        visti++;
        if (Math.abs(e.sx - e.dx) > 2) male.push(`${w}px ${nome}: non è al centro (${Math.round(e.sx)} | ${Math.round(e.dx)})`);
        if (e.w > (e.mappa ? 641 : 561)) male.push(`${w}px ${nome}: largo ${Math.round(e.w)} px`);
        if (e.sotto < 4 || e.raggio < 8) male.push(`${w}px ${nome}: attaccato al fondo, non una scheda`);
        if (e.tasto !== undefined && e.piede && (!e.dentro || !e.libero)) male.push(`${w}px ${nome}: «${e.tasto}» ${!e.dentro ? 'fuori dallo schermo' : 'coperto'}`);
      }
      await p.close();
    }
    ok(`6. da 670 a 1280 px i fogli sono schede al centro, larghe al massimo 560 px (la mappa del viaggio 640), con l'azione principale in fondo e visibile (${visti} fogli)`, visti >= 30 && !male.length, primi(male, 4));
  });

  /* ── 7. il Programma largo ────────────────────────────────────────────── */
  if (fare(7)) await prova('7', async () => {
    const male = [];
    for (const [w, h] of [[670, 870], [950, 585], [1280, 800]]) {
      const p = await apri(browser, { larghezza: w, altezza: h });
      await p.evaluate(() => openDay(0)); await ferma(p, 1100);
      const dove = `${w}×${h}`;
      const g = await p.evaluate(() => {
        const box = sel => { const q = document.querySelector(sel).getBoundingClientRect(); return { l: q.left, t: q.top, r: q.right, b: q.bottom, w: q.width, h: q.height }; };
        return { largo: ttLargo(), mappa: box('#dayMapWrap'), col: box('.tt-colonna'), testa: box('#ttTestata'), fab: box('#ttFab') };
      });
      if (!g.largo) male.push(`${dove}: le due colonne non ci sono`);
      if (g.mappa.l < g.col.r + 8 || g.col.w < 300 || g.mappa.w < 250) male.push(`${dove}: tappe ${Math.round(g.col.w)} px e mappa ${Math.round(g.mappa.w)} px non stanno affiancate`);
      if (g.mappa.t < g.testa.b - 1) male.push(`${dove}: la mappa sale sopra i giorni`);
      if (g.mappa.h < 200) male.push(`${dove}: la mappa è alta ${Math.round(g.mappa.h)} px`);
      if (g.fab.r > g.col.r + 1) male.push(`${dove}: «Aggiungi» sta sopra la mappa`);
      /* la mappa resta ferma mentre la giornata scorre */
      const scorre = await p.evaluate(async () => {
        const sc = document.querySelector('main.scroll'); sc.scrollTop = 0; await new Promise(r => setTimeout(r, 200));
        const t0 = document.getElementById('dayMapWrap').getBoundingClientRect().top, c0 = document.querySelector('.tt-colonna').getBoundingClientRect().top;
        sc.scrollTop = 420; await new Promise(r => setTimeout(r, 250));
        const t1 = document.getElementById('dayMapWrap').getBoundingClientRect().top, c1 = document.querySelector('.tt-colonna').getBoundingClientRect().top;
        const testa = document.getElementById('ttTestata').getBoundingClientRect().bottom;
        sc.scrollTop = 0; await new Promise(r => setTimeout(r, 200));
        return { mosso: sc.scrollHeight > sc.clientHeight + 300, mappa: t1, colonna: c0 - c1, sotto: t1 >= testa - 1, t0 };
      });
      if (!scorre.mosso || scorre.colonna < 200 || !scorre.sotto) male.push(`${dove}: scorrendo la mappa non resta ferma sotto i giorni (${JSON.stringify(scorre)})`);
      /* un tocco vero su una tappa: la tappa e il suo segnaposto si accendono */
      const blocco = p.locator('#ttBody .tt-block[data-id="13"]');
      await blocco.scrollIntoViewIfNeeded(); await blocco.click(); await p.waitForTimeout(700);
      const t = await p.evaluate(() => {
        const el = document.querySelector('#ttBody .tt-block[data-id="13"]'), mk = dayMapSegni[13] && dayMapSegni[13].getElement();
        return { tappa: el.classList.contains('scelta') && el.getAttribute('aria-current') === 'true', segno: !!mk && !!mk.querySelector('.pin.scelto'),
          altri: document.querySelectorAll('#dayMap .pin.scelto').length, scheda: !!document.querySelector('#dayMap .leaflet-popup'),
          apri: (() => { const x = document.querySelector('#dayMap .leaflet-popup .tt-apri-tappa'); return !!x && getComputedStyle(x).display !== 'none'; })(),
          menu: document.getElementById('mActMenu').classList.contains('active') };
      });
      if (!t.tappa || !t.segno || t.altri !== 1 || !t.scheda || !t.apri || t.menu) male.push(`${dove}: toccando la tappa ${JSON.stringify(t)}`);
      await blocco.click(); await p.waitForTimeout(500);
      if (!await p.evaluate(() => document.getElementById('mActMenu').classList.contains('active'))) male.push(`${dove}: il secondo tocco non apre il menu della tappa`);
      await chiudiFogli(p); await p.waitForTimeout(400);
      /* «Apri» sulla scheda del segnaposto apre il menu */
      await p.evaluate(() => { ttEvidenzia(12, true); }); await p.waitForTimeout(500);
      const tastoApri = p.locator('#dayMap .leaflet-popup .tt-apri-tappa');
      if (await tastoApri.count()) { await tastoApri.click(); await p.waitForTimeout(500); }
      const daApri = await p.evaluate(() => document.getElementById('mActMenu').classList.contains('active') && actMenuRef && actMenuRef.id === 12);
      if (!daApri) male.push(`${dove}: «Apri» sulla mappa non apre la tappa`);
      await chiudiFogli(p); await p.waitForTimeout(400);
      /* un tocco vero su un segnaposto: si accende la sua tappa, e la giornata ci va */
      await p.evaluate(() => { document.querySelector('main.scroll').scrollTop = 0; dayMapObj.setView(dayMapSegni[11].getLatLng(), 15, { animate: false }); }); await p.waitForTimeout(450);
      const xy = await p.evaluate(() => { const q = dayMapSegni[11].getElement().getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }; });
      await p.mouse.click(xy.x, xy.y); await p.waitForTimeout(900);
      const s = await p.evaluate(() => {
        const el = document.querySelector('#ttBody .tt-block[data-id="11"]'), q = el.getBoundingClientRect(), sc = document.querySelector('main.scroll').getBoundingClientRect();
        const testa = document.getElementById('ttTestata').getBoundingClientRect().bottom;
        return { tappa: el.classList.contains('scelta'), segno: !!dayMapSegni[11].getElement().querySelector('.pin.scelto'), aVista: q.top >= testa - 1 && q.bottom <= sc.bottom + 1, scelta: ttScelta };
      });
      if (!s.tappa || !s.segno || !s.aVista) male.push(`${dove}: toccando il segnaposto ${JSON.stringify(s)}`);
      /* con la tastiera (o VoiceOver) il menu si apre subito */
      await p.locator('#ttBody .tt-block[data-id="12"]').focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(500);
      if (!await p.evaluate(() => document.getElementById('mActMenu').classList.contains('active') && actMenuRef.id === 12)) male.push(`${dove}: con la tastiera il menu della tappa non si apre subito`);
      await chiudiFogli(p); await p.waitForTimeout(300);
      /* un giorno senza posizioni: una colonna sola, al centro */
      await p.evaluate(() => openDay(3)); await ferma(p, 700);
      const vuoto = await p.evaluate(() => { const c = document.querySelector('.tt-colonna').getBoundingClientRect(), pg = document.getElementById('mDay').getBoundingClientRect(); return { mappa: getComputedStyle(document.getElementById('dayMapWrap')).display, sx: c.left - pg.left, dx: pg.right - c.right }; });
      if (vuoto.mappa !== 'none' || Math.abs(vuoto.sx - vuoto.dx) > 2) male.push(`${dove}: il giorno senza mappa non è una colonna al centro (${JSON.stringify(vuoto)})`);
      await p.close();
    }
    ok('7. Programma largo (670, 950 e 1280 px): due colonne, i giorni sopra, la mappa ferma mentre si scorre, «Aggiungi» sotto le tappe', !male.filter(x => /colonne|affiancate|giorni|ferma|alta|Aggiungi/.test(x)).length, primi(male.filter(x => /colonne|affiancate|giorni|ferma|alta|Aggiungi/.test(x)), 3));
    ok('7. toccando una tappa si accende anche il suo segnaposto (e un altro tocco, o «Apri», apre il menu); toccando un segnaposto si accende la sua tappa e la giornata ci va; con la tastiera il menu si apre subito',
      !male.filter(x => /toccando|tocco|Apri|tastiera/.test(x)).length, primi(male.filter(x => /toccando|tocco|Apri|tastiera/.test(x)), 3));
    ok('7. un giorno senza posizioni resta una colonna sola, al centro', !male.filter(x => /senza mappa/.test(x)).length, primi(male.filter(x => /senza mappa/.test(x)), 2));
    /* sul telefono il Programma resta com'era */
    const p = await apri(browser);
    await p.evaluate(() => openDay(0)); await ferma(p, 900);
    const tel = await p.evaluate(async () => {
      const m = document.getElementById('dayMapWrap').getBoundingClientRect(), b = document.getElementById('ttBody').getBoundingClientRect();
      const el = document.querySelector('#ttBody .tt-block[data-id="13"]');
      return { largo: ttLargo(), sopra: m.bottom <= b.top + 1, alta: Math.round(document.getElementById('dayMap').getBoundingClientRect().height), id: !!el };
    });
    await p.locator('#ttBody .tt-block[data-id="13"]').scrollIntoViewIfNeeded(); await p.locator('#ttBody .tt-block[data-id="13"]').click(); await p.waitForTimeout(500);
    const menu = await p.evaluate(() => document.getElementById('mActMenu').classList.contains('active'));
    await p.close();
    ok('7. sul telefono (390 px) una colonna sola, la mappa alta 130 px sopra la giornata, e il tocco apre la tappa come prima', !tel.largo && tel.sopra && tel.alta === 130 && menu, JSON.stringify(tel) + ' menu ' + menu);
  });

  /* ── 8. Split View e l'esterno del Duo: l'app del telefono ─────────────── */
  if (fare(8)) await prova('8', async () => {
    const male = [];
    for (const [w, h, nome] of [[385, 800, 'Split View'], [466, 678, 'esterno del Duo']]) {
      const p = await apri(browser, { larghezza: w, altezza: h });
      const a = await p.evaluate(async () => {
        const nav = document.querySelector('.nav').getBoundingClientRect(), pg = document.querySelector('.page.active'), cs = getComputedStyle(pg);
        openDay(0); await new Promise(r => setTimeout(r, 900));
        const m = document.getElementById('dayMapWrap').getBoundingClientRect(), b = document.getElementById('ttBody').getBoundingClientRect();
        openExpense(); await new Promise(r => setTimeout(r, 600));
        const s = document.querySelector('#mExpense .sheet').getBoundingClientRect();
        return { basso: nav.bottom > innerHeight - 40 && nav.width > nav.height, lato: barraLaterale(), largo: schermoLargo(), sx: parseFloat(cs.paddingLeft), dx: parseFloat(cs.paddingRight),
          prog: !ttLargo() && m.bottom <= b.top + 1, foglio: Math.abs(s.bottom - innerHeight) < 1 && s.width >= innerWidth - 1 };
      });
      if (!a.basso || a.lato || a.largo) male.push(`${nome}: la barra non è quella in basso del telefono`);
      if (a.sx !== 16 || a.dx !== 16) male.push(`${nome}: margini della pagina ${a.sx}/${a.dx}`);
      if (!a.prog) male.push(`${nome}: il Programma non è a una colonna`);
      if (!a.foglio) male.push(`${nome}: il foglio non sale dal basso, largo quanto lo schermo`);
      await chiudiFogli(p); await p.waitForTimeout(300);
      const pagine = ['plan', 'mDay', 'discover', 'money', 'prenotazioni'];
      for (let i = 0; i < pagine.length; i++) {
        await p.locator('.nav .nav-item').nth(i).click(); await p.waitForTimeout(350);
        const att = await p.evaluate(() => (document.querySelector('main .page.active') || {}).id);
        if (att !== pagine[i]) male.push(`${nome}: la voce ${i + 1} apre ${att}`);
      }
      await p.close();
    }
    ok('8. a 385 px (Split View) e sull\'esterno del Duo (466×678) è l\'app del telefono: barra in basso, margini da 16, Programma a una colonna, fogli dal basso, ogni voce apre la sua schermata', !male.length, primi(male, 4));
    /* sull'esterno del Duo, basso, il cielo della Home si abbassa */
    const alto = await apri(browser, { larghezza: 466, altezza: 900 }), basso = await apri(browser, { larghezza: 466, altezza: 678 });
    const c = async p => p.evaluate(() => { const hh = document.querySelector('#plan .hh'), q = hh.getBoundingClientRect(), s = document.querySelector('#plan .hh-soon'); return { h: Math.round(q.height), sopra: parseFloat(getComputedStyle(hh).paddingTop), soon: s ? Math.round(s.getBoundingClientRect().bottom) : 0, H: innerHeight }; });
    const ca = await c(alto), cb = await c(basso);
    await alto.close(); await basso.close();
    ok('8. sotto i 700 px di altezza il cielo della Home è più basso, e la tappa di «Fra poco» resta sopra la barra',
      cb.h < ca.h - 30 && cb.sopra < ca.sopra && cb.soon > 0 && cb.soon < cb.H - 75, `alto ${ca.h} px (sopra ${ca.sopra}), basso ${cb.h} px (sopra ${cb.sopra}), «Fra poco» finisce a ${cb.soon} di ${cb.H}`);
  });

  /* ── 9. un iPhone normale: com'era prima della Layout 3 ───────────────── */
  if (fare(9)) await prova('9', async () => {
    const git = spawnSync('git', ['-C', RADICE, 'show', `${RIFERIMENTO}:Index 2.1.html`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (git.status !== 0 || !git.stdout) {
      const msg = `manca la versione di riferimento ${RIFERIMENTO} (serve la storia del repo: fetch-depth 0)`;
      if (process.env.PROVE_TUTTE) ok('9. su un iPhone normale l\'aspetto non cambia', false, msg); else console.log('  (9 saltata: ' + msg + ')');
      return;
    }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'geppgo-prima-'));
    fs.writeFileSync(path.join(dir, 'Index 2.1.html'), git.stdout);
    const prima = pathToFileURL(path.join(dir, 'Index 2.1.html')).href;
    const SCHERMATE = [['Oggi', "go('plan')"], ['Programma', 'openDay(0)'], ['Scopri', "go('discover');setDiscover('search')"], ['Spese', "go('money')"],
      ['Prenotazioni', "apriPrenotazioni('biglietti')"], ['menu dei viaggi', 'apriViaggi()'], ['Nuova spesa', 'openExpense()'], ['menu della tappa', 'openDay(0);tapAct(0,13)']];
    const foto = async (indirizzo, tema) => {
      const p = await apriPagina(browser, { errori, chiave: 'iph-' + Math.random(), attesa: 700, tema, indirizzo });
      await p.addStyleTag({ content: '*{caret-color:transparent!important}' });
      const out = [];
      for (const [nome, js] of SCHERMATE) {
        await chiudiFogli(p); await p.waitForTimeout(80);
        await p.evaluate(js); await ferma(p, 900);
        await p.evaluate(() => { document.querySelectorAll('.toast,.tt-scorri').forEach(x => x.remove()); });
        out.push([nome, (await p.screenshot({ type: 'png' })).toString('base64')]);
      }
      await p.close();
      return out;
    };
    const diversi = [];
    try {
      for (const tema of ['chiaro', 'scuro']) {
        const a = await foto(prima, tema), b = await foto(APP, tema);
        const pg = await browser.newPage();
        for (let i = 0; i < a.length; i++) {
          const d = await pg.evaluate(CONFRONTA, [a[i][1], b[i][1]]);
          if (d.diversi < 0 || d.diversi > d.totale * 0.002) diversi.push(`${tema} ${a[i][0]}: ${d.diversi < 0 ? 'misure diverse' : (d.diversi / d.totale * 100).toFixed(2) + '% dei pixel'}`);
        }
        await pg.close();
      }
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
    ok(`9. su un iPhone normale (390×844) le schermate sono quelle di prima della Layout 3 (${SCHERMATE.length} schermate, due temi, confronto coi pixel)`, !diversi.length, primi(diversi, 4));
  });

  /* ── 10. axe sulle schermate larghe, e la testa leggera ───────────────── */
  if (fare(10)) await prova('10', async () => {
    const CASI = [[1280, 800, 'Oggi', "go('plan')"], [1280, 800, 'Programma con una tappa accesa', 'openDay(0);setTimeout(()=>ttEvidenzia(13,true),500)'], [1280, 800, 'un foglio', 'openExpense()'],
      [670, 870, 'Programma', 'openDay(0)'], [950, 585, 'Oggi', "go('plan')"], [950, 585, 'Spese', "go('money')"]];
    const viol = [];
    for (const tema of ['chiaro', 'scuro']) for (const [w, h, nome, js] of CASI) {
      const p = await apri(browser, { larghezza: w, altezza: h, tema });
      await p.evaluate(js); await ferma(p, 1100);
      const mm = await misura(p, { axe: true, contrasto: true, tocchi: true });
      [...(mm.axe || []), ...(mm.testi || []).map(x => `contrasto «${String(x.testo || '').slice(0, 16)}» ${Number(x.r).toFixed(2)}:1`), ...(mm.piccoli || []).map(x => 'tasto piccolo ' + (x.chi || x))]
        .forEach(v => viol.push(`${tema} ${w}px ${nome}: ${v}`));
      await p.close();
    }
    ok(`10. nessuna violazione grave di axe sulle schermate larghe (barra di lato, Programma a due colonne, fogli), contrasti a norma, tasti da 44, nei due temi`, !viol.length, primi(viol, 4));
    const testa = LAVORO.slice(0, LAVORO.indexOf('</head>'));
    const stili = [...testa.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('');
    const netto = sito.senzaCommentiCss(stili).length;
    ok(`10. il CSS in testa resta piccolo (${netto} byte senza commenti) e senza le regole degli schermi grandi`, netto < 1500 && !/@container|safe-area-inset-left|LATERALE|min-width:900px/.test(stili), netto + ' byte');
  });

  await browser.close();
  const nonCercati = errori.filter(e => !/ERR_BLOCKED|net::|Failed to load resource|tile\.openstreetmap/.test(e));
  ok('nessun errore in pagina durante le prove', !nonCercati.length, primi([...new Set(nonCercati)]));
  console.log('\nGLI SCHERMI GRANDI (Layout 3)\n' + r.join('\n'));
  const passati = r.filter(x => x.startsWith('  OK')).length;
  console.log(`\n${passati}/${r.length} passati`);
  process.exit(passati === r.length ? 0 : 1);
})();
