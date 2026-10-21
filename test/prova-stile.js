/* LO STILE (Layout 1): un sistema solo, controllato su tutte le schermate.

   1. le grandezze del testo sono solo quelle della scala (12, 13, 15, 17,
      22 e 32 px) più il nome della città nel cielo della Home; niente sotto
      i 12 px — a schermo, schermata per schermata, e nel foglio di stile; i
      campi da scrivere almeno a 16 px, se no iPhone ingrandisce la pagina;
   2. colori, spazi, raggi e ombre scritti a mano solo dove c'è un motivo
      (il cielo e la sua città, le maschere delle strisce che scorrono, il
      logo e la schermata d'apertura, le illustrazioni, la stampa); e
      nessun doppione fra le variabili;
   3. i tasti sono solo dei tipi della Layout 1 (principale, secondario,
      terziario, eliminazione, pillola, controllo a schede, giorno, riga di
      elenco, crocetta, più le eccezioni dichiarate); nessun comando è fatto
      di sola emoji o di un carattere solo, e un'emoji in un comando c'è
      solo quando è contenuto (le categorie delle spese, il meteo);
   4. il selettore dei giorni è lo stesso in Home, Time Table e Hotel;
   5. nei fogli con un'azione principale il tasto sta in fondo e si vede
      senza scorrere, anche sul telefono più piccolo;
   6. la sfumatura del cielo sta solo in Home; nella barra in alto non c'è
      il tasto del tema, che sta nel Profilo;
   7. «Scorri con un dito» compare solo la prima volta, dentro la Time Table,
      senza coprire i titoli, e non resta altrove; «Annulla» compare solo
      dopo una modifica, per qualche secondo, e non copre altri tasti;
   8. axe senza violazioni gravi, contrasti e tasti da 44 px come nella
      miglioria 11, sulle schermate principali nei due temi; niente testi
      tagliati o sovrapposti da 320 a 430 px, in cinque lingue e due temi;
   9. in testa c'è solo lo stile della schermata d'apertura, e con la rete
      lenta la prima schermata arriva prima di quanto arrivava;
   10. il file .ics passa dal foglio Condividi, con gli stessi UID a ogni
      esportazione (reimportato non raddoppia) e senza le note.

   `node test/prova-stile.js 3 7` fa solo le prove 3 e 7. */
const fs = require('fs');
const path = require('path');
const { apriBrowser, APP, RADICE } = require('./browser');
const { PASSI, PRINCIPALI, MISURA, NOMI, VIAGGIO, PORTO, apriPagina, giro } = require('./schermate');
const { serverFinti, misuraAvvio } = require('./rete-finta');
const { misura } = require('./prova-accessibilita');

const r = [];
const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);
const errori = [];
const SCELTE = process.argv.slice(2).filter(a => /^\d+$/.test(a));
const fare = n => !SCELTE.length || SCELTE.includes(String(n));
const prova = async (nome, fn) => { try { await fn(); } catch (e) { ok(nome, false, 'si è fermata: ' + e.message.split('\n')[0]); } };
const primi = (l, n = 5) => l.slice(0, n).join(' | ') + (l.length > n ? ` (e altri ${l.length - n})` : '');
const LINGUE = ['it', 'en', 'es', 'fr', 'pt'];
/* Il file e' quello indicato da APP_URL, se c'e': cosi' la controprova sul
   codice vecchio guarda davvero il codice vecchio, anche nelle prove sul
   foglio di stile. */
const FILE_APP = APP.startsWith('file://') ? decodeURIComponent(APP.slice(7)) : path.join(RADICE, 'Index 2.1.html');
const HTML = fs.readFileSync(FILE_APP, 'utf8');

/* Lo strato che si vede: la presentazione o l'accesso, la finestra in cima,
   la Time Table, o la pagina con le sue barre (come in schermate.js). */
const STRATO = `(() => {
  const aperti = [...document.querySelectorAll('.modal.active')];
  aperti.sort((a, b) => (parseInt(getComputedStyle(a).zIndex, 10) || 0) - (parseInt(getComputedStyle(b).zIndex, 10) || 0));
  const sopra = ['intro', 'authGate'].map(id => document.getElementById(id)).find(el => el && getComputedStyle(el).display !== 'none');
  const day = document.querySelector('#mDay.active');
  return sopra ? [sopra] : aperti.length ? [aperti[aperti.length - 1]] : day ? [day]
    : [document.querySelector('.topbar'), document.querySelector('.page.active'), document.querySelector('.nav')].filter(Boolean);
})()`;
/* Dentro un <details> chiuso le cose non si vedono, anche se Chromium dà loro
   una misura. */
const visibile = `el => { const q = el.getBoundingClientRect(); if (q.width < 1 || q.height < 1) return false;
  const d = el.closest('details'); if (d && !d.open && !el.closest('summary')) return false;
  for (let x = el; x && x !== document.documentElement; x = x.parentElement) { const c = getComputedStyle(x);
    if (c.display === 'none' || c.visibility === 'hidden' || parseFloat(c.opacity) < 0.05) return false; } return true; }`;

/* I tipi di tasto della Layout 1. Le famiglie di prima (.tt-az, .hh-rapido,
   .auth-link…) restano per la disposizione, ma ognuna porta la classe del
   suo tipo. In fondo le eccezioni dichiarate in CLAUDE.md: la barra in
   basso, i controlli e i segnaposto delle mappe; e quello che tasto non è
   ma si tocca (una scheda intera, il nome dentro una scheda, un link nel
   testo, il cielo della Home, la barra in alto, la striscia del tragitto
   nella Time Table, la casella del link da copiare). */
const TIPI = {
  'principale': '.btn-primario', 'secondario': '.btn-secondario', 'terziario': '.btn-terziario', 'eliminazione': '.btn-elimina',
  'pillola': '.chip', 'controllo a schede': '.seg-btn', 'giorno': '.giorno', 'riga di elenco': '.riga',
  'crocetta': '.x,.x-close,.val-x,.ub-x,.pchip button,.tap-chip button',
  'barra in basso': '.nav-item', 'mappa': '.locate-fab,.leaflet-control a', 'segnaposto della mappa': '.leaflet-marker-icon',
  'barra in alto': '.menu-btn,.tb-profilo', 'cielo della Home': '.hh-cerca,.hh-grado,.hh-eyebrow,.hh-city',
  'scheda': '.card,.hh-card,.hh-soon,.hh-empty,.hist-card,.exp-row,.person,.wcard,.cat,.tt-block,.tt-act,.res,.rcard,.ms-row,.split-item',
  'nome nella scheda': '.come-testo,.trip-hero-name,.hist-n,.ticket-n', 'link nel testo': 'a[href]:not(.btn):not(.chip)',
  'tragitto in Time Table': '.tt-travel-mezzo,.tt-travel-x,.tt-travel-skip,.tt-travel-toggle', 'link da copiare': '.share-link',
  'pubblicità': '.ad-x'
};
/* I comandi dove una scritta ci deve essere: tutto, tranne le schede (che
   portano il loro contenuto: una spesa col suo «🍜», una tappa col tempo),
   i segnaposto delle mappe e la pubblicità. */
const CON_PAROLE = ['principale', 'secondario', 'terziario', 'eliminazione', 'pillola', 'controllo a schede', 'giorno', 'riga di elenco', 'nome nella scheda', 'cielo della Home'];
/* I comandi che possono essere fatti di un segno solo, col nome per
   VoiceOver: la crocetta, la barra in basso, i controlli della mappa,
   l'iniziale del Profilo, il mezzo e la crocetta del tragitto. */
const SOLO_SEGNO = ['crocetta', 'barra in basso', 'mappa', 'barra in alto', 'tragitto in Time Table'];

(async () => {
  const browser = await apriBrowser();

  /* ── 1 e 2: il foglio di stile ─────────────────────────────────────── */
  const css = [...HTML.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
  const regole = [...css.matchAll(/([^{}]*)\{([^{}]*)\}/g)].map(m => ({ sel: m[1].replace(/\s+/g, ' ').trim(), corpo: m[2] }));
  const corpo = HTML.slice(HTML.indexOf('<body'));
  const inLinea = [...corpo.matchAll(/style=(\\?")([^"\\]*)\1/g)].map(m => ({ sel: 'style="…"', corpo: m[2] }));
  const dichiarazioni = [...regole, ...inLinea].flatMap(({ sel, corpo }) => [...corpo.matchAll(/(?:^|;)\s*([\w-]+)\s*:\s*([^;]+)/g)]
    .map(d => ({ sel, p: d[1].toLowerCase(), v: d[2].trim().replace(/\s*!important$/, '') })).filter(d => !d.p.startsWith('--')));

  if (fare(1)) await prova('1', async () => {
    const scala = /^var\(--fs-(xs|s|m|l|xl|xxl|cielo)\)$/;
    /* La schermata d'apertura sta in testa, prima delle variabili: i suoi
       32 px sono scritti in rem (vedi IN TESTA SOLO LA SCHERMATA D'APERTURA). */
    const fuori = dichiarazioni.filter(d => d.p === 'font-size' && !scala.test(d.v) && !/bootSplash/.test(d.sel)).map(d => `${d.sel.slice(0, 40)} {font-size:${d.v}}`);
    ok('1. nel foglio di stile e negli style="" ogni grandezza del testo è una variabile della scala (--fs-xs … --fs-xxl, --fs-cielo)', !fuori.length, primi(fuori) ||
      `${dichiarazioni.filter(d => d.p === 'font-size').length} dichiarazioni`);
    const vars = Object.fromEntries([...css.matchAll(/(--fs-[\w-]+)\s*:\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]));
    const px = v => parseFloat(v) * (/rem$/.test(v) ? 16 : 1);
    const giuste = ['--fs-xs', '--fs-s', '--fs-m', '--fs-l', '--fs-xl', '--fs-xxl'].map(k => px(vars[k] || '0'));
    ok('1. la scala è 12, 13, 15, 17, 22, 32 px', JSON.stringify(giuste) === JSON.stringify([12, 13, 15, 17, 22, 32]), giuste.join(', '));
    const g = await giro(browser, { larghezza: 390, guarda: async page => page.evaluate(([STRATO, visibile]) => {
      const vis = eval(visibile), SCALA = [12, 13, 15, 17, 22, 32], out = [], campi = [];
      let visti = 0;
      for (const rad of eval(STRATO)) {
        /* I campi da scrivere: sotto i 16 px iPhone ingrandisce la pagina a
           ogni tocco. Le tendine no: il tocco lo prende il velo che apre il
           foglio di scelta dell'app (wireBottomSheetSelect). */
        rad.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]):not([type=color]),textarea').forEach(c => {
          if (!vis(c)) return;
          visti++;
          const fs = parseFloat(getComputedStyle(c).fontSize);
          if (fs < 16) campi.push(`${c.id ? '#' + c.id : c.tagName.toLowerCase()} ${fs}px`);
        });
        const w = document.createTreeWalker(rad, NodeFilter.SHOW_TEXT, { acceptNode: t => /\S/.test(t.data) ? 1 : 2 });
        let t;
        while ((t = w.nextNode())) {
          const p = t.parentElement;
          if (!p || p.closest('.leaflet-container,script,style,svg,option,#bootSplash') || !vis(p)) continue;
          const fs = parseFloat(getComputedStyle(p).fontSize);
          if (p.closest('.hh-city,.mt-temp')) { if (fs < 44) out.push(`${fs}px nel cielo «${t.data.trim().slice(0, 16)}»`); continue; }
          if (!SCALA.some(s => Math.abs(s - fs) < 0.3)) out.push(`${Math.round(fs * 10) / 10}px «${t.data.trim().slice(0, 18)}»`);
        }
      }
      return { testi: [...new Set(out)], campi: [...new Set(campi)], visti };
    }, [STRATO, visibile]) });
    const male = Object.entries(g.esiti).flatMap(([n, l]) => ((l && l.testi) || []).map(x => `${n}: ${x}`));
    const campiPiccoli = Object.entries(g.esiti).flatMap(([n, l]) => ((l && l.campi) || []).map(x => `${n}: ${x}`));
    const campiVisti = Object.values(g.esiti).reduce((a, l) => a + ((l && l.visti) || 0), 0);
    const sotto = male.filter(x => /^[^:]+: (\d+(\.\d+)?)px/.test(x) && parseFloat(x.split(': ')[1]) < 12);
    ok(`1. a schermo, su ${Object.keys(g.esiti).length} schermate e finestre, solo grandezze della scala (e il nome della città nel cielo)`, !male.length, primi(male));
    ok('1. e niente sotto i 12 px', !sotto.length, primi(sotto) || 'nessuna');
    ok('1. i campi da scrivere stanno a 16 px o più (sotto, iPhone ingrandisce la pagina a ogni tocco)', campiVisti > 20 && !campiPiccoli.length, primi(campiPiccoli) || `${campiVisti} campi guardati`);
    errori.push(...g.err.map(e => 'giro 1: ' + e));
  });

  if (fare(2)) await prova('2', async () => {
    /* Dove scrivere a mano è motivato: il cielo e la sua città (sono
       disegno), le maschere che sfumano le strisce che scorrono (una
       maschera è trasparenza, non colore), il logo e la schermata
       d'apertura (il marchio non si tocca), le illustrazioni della
       presentazione e dello scanner, i segnaposto e i pallini delle mappe,
       la stampa del diario, la pubblicità e il Premium. */
    const MOTIVATO = /\.cl-|\.cielo|\.hh-velo|\.hh-city|\.mt-hero|\.mt-txt|\.brand-logo|#bootSplash|\.bootSplash|\.sw-in|\.scan-|\.intro-ill|\.i-|\.pin|\.vm-|#diaryPrint|\.hh::after|\.hh\.cl|\.vetro|@keyframes|\.leaflet|\.ad-slot|\.prem/;
    const COLORE = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/;
    const libero = d => MOTIVATO.test(d.sel) || /mask/.test(d.p);
    const colori = dichiarazioni.filter(d => COLORE.test(d.v) && !libero(d)).map(d => `${d.sel.slice(0, 36)} {${d.p}:${d.v.slice(0, 40)}}`);
    ok('2. colori scritti a mano solo dove è motivato (cielo, logo, illustrazioni, maschere, stampa)', !colori.length, primi(colori) ||
      `${dichiarazioni.filter(d => COLORE.test(d.v)).length} valori, tutti in quei posti`);
    const spazi = dichiarazioni.filter(d => /^(margin|padding)(-[\w-]+)?$|^(row-|column-)?gap$/.test(d.p) && !libero(d))
      .filter(d => (d.v.match(/(?<![\w.(-])-?\d*\.?\d+(?:px|rem|em)\b/g) || []).some(t => !['0px', '1px', '2px', '-1px', '-2px'].includes(t)))
      .map(d => `${d.sel.slice(0, 36)} {${d.p}:${d.v.slice(0, 40)}}`);
    ok('2. spazi solo dalla scala (--sp-1 … --sp-6), più 1 e 2 px per i ritocchi fini', !spazi.length, primi(spazi) || 'nessuno scritto a mano');
    const raggi = dichiarazioni.filter(d => /^border(-[\w-]+)?-radius$/.test(d.p) && !libero(d))
      .filter(d => !/^((var\(--r-(ctl|card|pill)\)|0|inherit)\s*)+$/.test(d.v) && !/^calc\(.*var\(--r-(ctl|card|pill)\).*\)$/.test(d.v))
      .map(d => `${d.sel.slice(0, 36)} {${d.p}:${d.v.slice(0, 40)}}`);
    ok('2. raggi solo --r-ctl, --r-card e --r-pill', !raggi.length, primi(raggi) || 'nessuno scritto a mano');
    const ombre = dichiarazioni.filter(d => d.p === 'box-shadow' && !libero(d))
      .filter(d => !/^(var\(--(sh-1|sh-2|anello)\)|none|inset 0 0 0 \dpx var\(--[\w-]+\))$/.test(d.v))
      .map(d => `${d.sel.slice(0, 36)} {${d.p}:${d.v.slice(0, 40)}}`);
    ok('2. ombre solo --sh-1 (appoggiata) e --sh-2 (galleggiante), più l\'anello di chi è scelto', !ombre.length, primi(ombre) || 'nessuna scritta a mano');
    /* I doppioni: due variabili dello stesso genere (colori con colori,
       spazi con spazi…) che valgono uguale in tutti e due i temi. Un 12 px
       di testo e un 12 px di spazio non sono doppioni: dicono cose diverse. */
    const blocchi = sel => Object.assign({}, ...[...css.matchAll(new RegExp('(?:^|\\n)\\s*' + sel + '\\s*\\{([^}]*)\\}', 'g'))]
      .map(m => Object.fromEntries([...m[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+)/g)].map(d => [d[1], d[2].replace(/\s+/g, '').toLowerCase()]))));
    const chiaro = blocchi(':root'), scuro = Object.assign({}, chiaro, blocchi('body\\.dark'));
    const genere = k => (/^--(fs|sp|r|sh)-/.exec(k) || [, 'colore'])[1];
    const visti = {}, doppioni = [];
    Object.keys(chiaro).forEach(k => { const id = genere(k) + '|' + chiaro[k] + '|' + scuro[k]; if (visti[id]) doppioni.push(`${visti[id]} = ${k}`); else visti[id] = k; });
    ok(`2. nessun doppione fra le ${Object.keys(chiaro).length} variabili`, !doppioni.length, primi(doppioni) || 'nessuno');
    const vecchie = ['--blue', '--brown', '--sh-xs', '--sh-sm', '--sh-md', '--sh-lg', '--r-sm', '--r-md', '--r-lg', '--r-xl', '--cielo-b', '--stampa-carta'].filter(v => new RegExp(v + '\\b').test(HTML));
    ok('2. le variabili tolte non tornano (--blue, --brown, le vecchie ombre e i vecchi raggi)', !vecchie.length, vecchie.join(', '));
  });

  /* ── 3: i tasti ─────────────────────────────────────────────────────── */
  if (fare(3)) await prova('3', async () => {
    const g = await giro(browser, { larghezza: 390, guarda: async page => page.evaluate(([STRATO, visibile, TIPI]) => {
      const vis = eval(visibile), out = [];
      /* le emoji che sono contenuto: le categorie delle spese e il meteo */
      const meteo = []; for (let c = 0; c < 100; c++) meteo.push(wxEmoji(c, false), wxEmoji(c, true));
      const contenuto = new Set([...CATS.map(c => c.i), ...meteo].map(e => e.replace(/\uFE0F/g, '')));
      for (const rad of eval(STRATO)) rad.querySelectorAll('button,a[href],[role="button"]').forEach(el => {
        if (!vis(el)) return;
        const tipo = Object.keys(TIPI).find(k => el.matches(TIPI[k])) || null;
        const testo = (el.innerText || '').replace(/\s+/g, ' ').trim();
        const emoji = [...testo.matchAll(/\p{Extended_Pictographic}\uFE0F?/gu)].map(m => m[0].replace(/\uFE0F/g, '')).filter(e => !contenuto.has(e));
        out.push({ tipo, cl: (typeof el.className === 'string' ? el.className : '').trim().slice(0, 50), testo: testo.slice(0, 40),
          parole: /\p{L}{2,}/u.test(testo), nome: el.getAttribute('aria-label') || el.title || '', emoji });
      });
      return out;
    }, [STRATO, visibile, TIPI]) });
    const senzaTipo = new Set(), senzaParole = new Set(), conEmoji = new Set(), segnoMuto = new Set(), conta = {};
    Object.entries(g.esiti).forEach(([n, l]) => (l || []).forEach(x => {
      conta[x.tipo || '?'] = (conta[x.tipo || '?'] || 0) + 1;
      if (!x.tipo) senzaTipo.add(`${n}: .${x.cl} «${x.testo}»`);
      else if (CON_PAROLE.includes(x.tipo) && !x.parole) senzaParole.add(`${n}: ${x.tipo} .${x.cl} «${x.testo}»`);
      else if (SOLO_SEGNO.includes(x.tipo) && !x.parole && !/\p{L}{2,}/u.test(x.nome)) segnoMuto.add(`${n}: ${x.tipo} .${x.cl}`);
      if (x.emoji.length && x.tipo !== 'scheda' && x.tipo !== 'segnaposto della mappa') conEmoji.add(`${n}: .${x.cl} «${x.testo}»`);
    }));
    const tipi = Object.keys(conta).filter(k => k !== '?');
    ok(`3. ogni tasto su ${Object.keys(g.esiti).length} schermate è di un tipo della Layout 1 o di un'eccezione dichiarata`, !senzaTipo.size, primi([...senzaTipo]) ||
      tipi.map(k => `${k} ${conta[k]}`).join(', '));
    ok('3. nessun tasto di comando fatto di sola icona, sola emoji o un carattere solo (tranne crocetta, barra in basso e mappa, col nome per VoiceOver)',
      !senzaParole.size && !segnoMuto.size, primi([...senzaParole, ...segnoMuto]));
    ok('3. nei comandi niente emoji, se non sono contenuto (categorie delle spese, meteo)', !conEmoji.size, primi([...conEmoji]));
    /* E nel codice: i tipi vecchi non ci sono più. */
    const vecchi = ['btn-grad', 'btn-soft', 'btn-filo', 'btn-danger', 'btn-green', 'btn-blue', '"ibtn', ' ibtn ', 'edit-ic', 'pill-ghost', 'status-pill', '"tchip', 'cat-chip"', '"starter"'].filter(c => corpo.includes(c));
    ok('3. le classi dei tasti di prima non ci sono più (btn-grad, btn-soft, ibtn, edit-ic, pill-ghost, tchip…)', !vecchi.length, vecchi.join(', '));
    errori.push(...g.err.map(e => 'giro 3: ' + e));
  });

  /* ── 4: il selettore dei giorni ─────────────────────────────────────── */
  if (fare(4)) await prova('4', async () => {
    const page = await apriPagina(browser, { errori });
    const impronta = sel => page.evaluate(sel => {
      const g = document.querySelector(sel); if (!g || !g.closest('.giorni')) return null;
      const c = getComputedStyle(g);
      return { quanti: g.closest('.giorni').querySelectorAll('.giorno').length, stile: ['fontSize', 'fontWeight', 'borderRadius', 'paddingTop', 'paddingLeft', 'height', 'borderTopWidth', 'fontFamily'].map(k => c[k]).join(' ') };
    }, sel);
    await page.evaluate(() => go('plan')); await page.waitForTimeout(300);
    const home = await impronta('.hh-days .giorno');
    await page.evaluate(() => openDay(0)); await page.waitForTimeout(400);
    const tt = await impronta('#dayChips .giorno');
    await page.evaluate(() => { closeSheet('mDay'); go('hotels'); }); await page.waitForTimeout(400);
    const hotel = await impronta('.ht-notti .giorno');
    const giusti = home && tt && hotel && home.stile === tt.stile && tt.stile === hotel.stile;
    ok('4. Home, Time Table e Hotel usano lo stesso selettore dei giorni (.giorni/.giorno, stesse misure)', !!giusti,
      [home, tt, hotel].map((x, i) => ['Home', 'Time Table', 'Hotel'][i] + ': ' + (x ? `${x.quanti} giorni · ${x.stile}` : 'non trovato')).join(' | '));
    const doppi = ['hh-day"', 'hh-day ', 'day-chip', 'ht-notte"'].filter(c => corpo.includes(c));
    ok('4. i selettori di prima non ci sono più (hh-day, day-chip)', !doppi.length, doppi.join(', '));
    await page.close();
  });

  /* ── 5: i fogli con l'azione principale ─────────────────────────────── */
  if (fare(5)) await prova('5', async () => {
    const FOGLI = [['Nuovo viaggio', 'openNewTrip()'], ['Nuova spesa', 'openExpense()'], ['Modifica spesa', 'openExpense(202)'],
      ['Aggiungi biglietto', 'openTicketSheet()'], ['Nuovo albergo', "pendingHotel={name:'Ryokan Hoshi',lat:35,lng:135.76,address:'Kyoto',editId:null};apriFoglioHotel(T())"],
      ['Modifica albergo', 'editHotel(5)'], ['Nuova tappa', 'openActDetail(0,null)'], ['Modifica tappa', 'openActDetail(0,11)'],
      ['Salva luogo', "openSavePOI({name:'Kinkakuji',lat:35.039,lng:135.729})"], ['Modifica luogo', 'openEditPOI(91)'], ['Giorni', 'openTripDates()'],
      ['Aggiungi giorno', 'openAddDay()'], ['Aggiungi persona', "openSheet('mPerson')"], ['Consigli', 'openSuggestSheet()'],
      ['Autopilota', 'openDay(0);openGenForDay()'], ['Voce della valigia', "openPacking();editPackItem('v0')"]];
    const male = [];
    for (const [w, h] of [[320, 568], [390, 844]]) {
      const page = await apriPagina(browser, { errori, larghezza: w, altezza: h, valigia: true });
      for (const [nome, js] of FOGLI) {
        await page.evaluate(() => document.querySelectorAll('.modal.active').forEach(m => closeSheet(m.id)));
        await page.waitForTimeout(80);
        await page.evaluate(js => { eval(js); }, js);
        await page.waitForTimeout(450);
        const e = await page.evaluate(() => {
          const m = [...document.querySelectorAll('.modal.active')].pop(); if (!m) return { niente: true };
          const s = m.querySelector('.sheet'); s.scrollTop = 0;
          const b = [...m.querySelectorAll('.btn-primario')].find(x => x.getBoundingClientRect().height > 0);
          if (!b) return { senza: true };
          const q = b.getBoundingClientRect(), qs = s.getBoundingClientRect();
          const sopra = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2);
          return { piede: !!b.closest('.sheet-piede'), dentro: q.top >= Math.max(0, qs.top) && q.bottom <= Math.min(innerHeight, qs.bottom) + 0.5,
            libero: !!sopra && (sopra === b || b.contains(sopra)), testo: b.innerText.trim() };
        });
        if (e.niente || e.senza) male.push(`${w}px ${nome}: ${e.niente ? 'il foglio non si apre' : 'senza azione principale'}`);
        else if (!e.piede || !e.dentro || !e.libero) male.push(`${w}px ${nome}: «${e.testo}» ${!e.piede ? 'non sta nel piede del foglio' : !e.dentro ? 'fuori dallo schermo' : 'coperto'}`);
      }
      await page.close();
    }
    ok(`5. in ${FOGLI.length} fogli l'azione principale sta in fondo e si vede senza scorrere, a 320×568 e a 390×844`, !male.length, primi(male));
  });

  /* ── 6: il cielo e il tasto del tema ────────────────────────────────── */
  if (fare(6)) await prova('6', async () => {
    const page = await apriPagina(browser, { errori });
    const PAGINE = ['plan', 'discover', 'money', 'hotels', 'tickets', 'identify', 'trips'];
    const fondi = {};
    for (const p of PAGINE) {
      await page.evaluate(p => go(p), p); await page.waitForTimeout(250);
      fondi[p] = await page.evaluate(() => {
        const pag = document.querySelector('.page.active');
        const sfumati = [pag, ...pag.querySelectorAll('*'), document.body, document.querySelector('.app'), document.querySelector('main.scroll')].filter(Boolean)
          .filter(x => /gradient/.test(getComputedStyle(x).backgroundImage) && x.getBoundingClientRect().width > innerWidth * 0.8 && x.getBoundingClientRect().height > 150)
          .map(x => x.className && typeof x.className === 'string' ? '.' + x.className.split(' ')[0] : x.tagName.toLowerCase());
        return { sfumati, fondo: getComputedStyle(document.body).backgroundColor, carta: getComputedStyle(document.body).getPropertyValue('--paper').trim() };
      });
    }
    await page.evaluate(() => openDay(0)); await page.waitForTimeout(350);
    fondi.timetable = await page.evaluate(() => ({ sfumati: [document.querySelector('#mDay'), document.querySelector('#mDay .tt-sheet')].filter(x => x && /gradient/.test(getComputedStyle(x).backgroundImage)).map(x => x.id || x.className) }));
    const altrove = Object.entries(fondi).filter(([p, f]) => p !== 'plan' && f.sfumati.length).map(([p, f]) => `${p}: ${f.sfumati.join(', ')}`);
    ok('6. la sfumatura del cielo sta solo in Home (.hh); le altre schermate hanno il fondo panna pulito', fondi.plan.sfumati.some(x => /hh/.test(x)) && !altrove.length,
      altrove.join(' | ') || `Home: ${fondi.plan.sfumati.join(', ')} · altrove nessuna`);
    const barra = await page.evaluate(() => { closeSheet('mDay'); go('plan');
      const b = document.querySelector('.topbar');
      return { tema: [...b.querySelectorAll('button,[role="button"],[onclick]')].filter(x => /tema|dark|☾|☀/i.test((x.getAttribute('onclick') || '') + x.innerText + (x.getAttribute('aria-label') || '') + (x.title || ''))).map(x => x.outerHTML.slice(0, 60)),
        nelProfilo: (go('trips'), !!document.querySelector('#trips input[onchange*="toggleDark"]')) };
    });
    ok('6. nella barra in alto non c\'è il tasto del tema; il tema si sceglie nel Profilo', !barra.tema.length && barra.nelProfilo, barra.tema.join(' | ') || 'Profilo: «Tema scuro»');
    await page.close();
  });

  /* ── 7: «Scorri con un dito» e «Annulla» ────────────────────────────── */
  if (fare(7)) await prova('7', async () => {
    const page = await apriPagina(browser, { errori, chiave: 'scorri-' + Math.random() });
    await page.evaluate(() => openDay(0)); await page.waitForTimeout(500);
    const prima = await page.evaluate(() => {
      const h = document.getElementById('ttScorri'); if (!h) return null;
      const q = h.getBoundingClientRect();
      const coperti = ['.tt-title', '.tt-sub', '#ttEyebrow', '.topbar', '#mDay .x-close'].map(s => document.querySelector(s)).filter(Boolean)
        .filter(x => { const a = x.getBoundingClientRect(); return a.width && a.left < q.right && q.left < a.right && a.top < q.bottom && q.top < a.bottom; }).map(x => x.className);
      return { dentro: !!h.closest('#mDay'), testo: h.textContent, coperti, toast: [...document.querySelectorAll('.toast')].some(t => /Scorri/.test(t.textContent)) };
    });
    ok('7. la prima volta «Scorri con un dito» compare dentro la Time Table, sotto i giorni, e non copre i titoli', !!prima && prima.dentro && !prima.coperti.length && !prima.toast,
      prima ? `«${prima.testo}»${prima.coperti.length ? ' copre ' + prima.coperti.join(', ') : ''}${prima.toast ? ' (e c\'è anche il messaggio in basso)' : ''}` : 'non compare');
    await page.evaluate(() => { closeSheet('mDay'); go('money'); }); await page.waitForTimeout(400);
    const altrove = await page.evaluate(() => [...document.querySelectorAll('body *')].some(x => x.children.length === 0 && /Scorri con un dito/.test(x.textContent) && x.getBoundingClientRect().height > 0));
    ok('7. chiusa la Time Table il suggerimento non resta, né in Spese né altrove', !altrove);
    await page.reload(); await page.waitForFunction(() => typeof renderAll === 'function' && !document.getElementById('bootSplash'));
    await page.evaluate(() => openDay(0)); await page.waitForTimeout(700);
    const dopo = await page.evaluate(() => !!document.getElementById('ttScorri') || [...document.querySelectorAll('.toast')].some(t => /Scorri/.test(t.textContent)));
    ok('7. riaprendo l\'app il suggerimento non torna: si vede solo la prima volta', !dopo);
    /* «Annulla»: non c'è finché non si sposta qualcosa; dopo uno
       spostamento c'è, non copre altri tasti, e se ne va da solo. */
    const stato = () => page.evaluate(() => { const b = document.getElementById('ttUndo'); const q = b.getBoundingClientRect(); return { si: getComputedStyle(b).display !== 'none' && q.width > 0, q: { l: q.left, r: q.right, t: q.top, b: q.bottom } }; });
    const a0 = await stato();
    await page.evaluate(() => { const a = T().days[0].activities.find(x => x.id === 12); const prev = { time: a.time, timeEnd: a.timeEnd, parentId: a.parentId }; a.time = '13:00'; a.timeEnd = '14:00'; markDrag(a, prev, 'sposta'); });
    await page.waitForTimeout(150);
    const a1 = await stato();
    const sotto = await page.evaluate(q => [...document.querySelectorAll('button,[role="button"],.nav-item')].filter(x => x.id !== 'ttUndo' && !x.closest('#ttUndo'))
      .filter(x => { const a = x.getBoundingClientRect(); if (!a.width || !a.height) return false; const c = getComputedStyle(x); if (c.visibility === 'hidden') return false;
        return a.left < q.r && q.l < a.right && a.top < q.b && q.t < a.bottom; }).map(x => (x.className || x.tagName).toString().slice(0, 30)), a1.q);
    await page.clock.runFor(9000); await page.waitForTimeout(100);
    const a2 = await stato();
    ok('7. «Annulla» non c\'è finché non si sposta qualcosa, compare dopo uno spostamento senza coprire altri tasti, e dopo qualche secondo se ne va',
      !a0.si && a1.si && !sotto.length && !a2.si, `prima ${a0.si ? 'c\'era' : 'no'} · dopo lo spostamento ${a1.si ? 'sì' : 'no'}${sotto.length ? ' (copre ' + sotto.join(', ') + ')' : ''} · dopo 9 s ${a2.si ? 'ancora lì' : 'via'}`);
    await page.close();
  });

  /* ── 8: accessibilità e testi tagliati ──────────────────────────────── */
  if (fare(8)) await prova('8', async () => {
    const male = { axe: [], contrasto: [], tocchi: [] };
    for (const tema of ['chiaro', 'scuro']) {
      const g = await giro(browser, { larghezza: 390, tema, soloQuesti: PRINCIPALI, guarda: async page => {
        const m = await misura(page, { axe: true, contrasto: true, tocchi: true });
        return { axe: m.axe || [], contrasto: (m.testi || []).map(x => `${x.chi} «${String(x.testo || '').slice(0, 16)}» ${Number(x.r).toFixed(2)}:1`), tocchi: m.piccoli || [] };
      } });
      Object.entries(g.esiti).forEach(([n, x]) => { if (!x) return; ['axe', 'contrasto', 'tocchi'].forEach(k => x[k].forEach(v => male[k].push(`${tema} ${n}: ${v}`))); });
      errori.push(...g.err.map(e => `giro 8 ${tema}: ` + e));
    }
    ok(`8. axe sulle ${PRINCIPALI.length} schermate principali, nei due temi: nessuna violazione grave o critica`, !male.axe.length, primi(male.axe));
    ok('8. contrasti WCAG AA nei due temi (4,5:1 il testo, 3:1 il testo grande)', !male.contrasto.length, primi(male.contrasto));
    ok('8. ogni tasto si tocca su 44×44 px', !male.tocchi.length, primi(male.tocchi));
    const tagliati = [];
    for (const tema of ['chiaro', 'scuro']) for (const lingua of LINGUE) for (const larghezza of [320, 430]) {
      const g = await giro(browser, { lingua, larghezza, tema, soloQuesti: PRINCIPALI, guarda: async page => page.evaluate(MISURA, NOMI) });
      Object.entries(g.esiti).forEach(([n, m]) => { if (!m) return; [...m.fuori, ...m.troncati, ...m.sovrapposti].forEach(x => tagliati.push(`${tema} ${lingua} ${larghezza}px ${n}: ${x}`)); });
    }
    ok(`8. niente testi tagliati, sovrapposti o fuori dallo schermo da 320 a 430 px, in 5 lingue e due temi (${PRINCIPALI.length} schermate)`, !tagliati.length, primi(tagliati));
  });

  /* ── 9: lo stile in testa e la prima schermata ──────────────────────── */
  if (fare(9)) await prova('9', async () => {
    /* Le misure di prima della Layout 1 (la versione col CSS in testa), prese
       con misuraAvvio su questa stessa rete finta: 400 kbps, 400 ms di
       latenza, mediana di tre avvii (21 ottobre 2026). */
    const PRIMA = { kbTesta: 171.5, kbTestaGz: 45.2, prima: 1400 };
    const testa = HTML.slice(0, HTML.indexOf('<body'));
    const kbTesta = Buffer.byteLength(testa) / 1024, kbTestaGz = require('zlib').gzipSync(testa, { level: 9 }).length / 1024;
    const stiliInTesta = [...testa.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m => m[1].replace(/\/\*[\s\S]*?\*\//g, ''));
    const selettori = stiliInTesta.flatMap(c => [...c.matchAll(/([^{}]+)\{/g)].map(m => m[1].trim()));
    const estranei = selettori.filter(s => !/^(html,body|#bootSplash(\.hide)?|\.bootSplash-name( span)?)$/.test(s));
    ok('9. in testa c\'è solo lo stile della schermata d\'apertura', stiliInTesta.length === 1 && !estranei.length, estranei.join(', ') || selettori.join(', '));
    const dopoSplash = HTML.indexOf('<style>', HTML.indexOf('id="bootSplash"')) < HTML.indexOf('class="app"');
    ok('9. il resto dello stile sta subito dopo la schermata d\'apertura, prima dell\'app (niente sfarfallio)', dopoSplash);
    ok('9. il CSS in testa scende', kbTesta < PRIMA.kbTesta / 10, `${PRIMA.kbTesta} KB (${PRIMA.kbTestaGz} compressi) → ${kbTesta.toFixed(1)} KB (${kbTestaGz.toFixed(1)} compressi)`);
    const OGGI = new Date().toISOString().split('T')[0];
    const stato = { trips: [{ id: 1, name: 'Tokyo', destination: 'Tokyo', currency: 'EUR', status: 'open', start: OGGI, end: OGGI, participants: [{ id: 1, name: 'Gepp', isMe: true }],
      suggested: [], pois: [], hotels: [], weather: {}, createdAt: 1, expenses: [], tickets: [], days: [{ id: 'd1', date: OGGI, title: '', activities: [] }] }],
      currentTripId: 1, settings: { proxRadius: 200 }, myName: 'Gepp', skipAuth: true };
    const srv = await serverFinti({ html: HTML, sw: fs.readFileSync(path.join(RADICE, 'sw.js'), 'utf8') });
    const b2 = await apriBrowser({ args: srv.args });
    const tempi = [];
    for (let i = 0; i < 3; i++) tempi.push((await misuraAvvio(b2, srv, { stato })).prima);
    await b2.close(); await srv.chiudi?.();
    const m = tempi.sort((a, b) => a - b)[1];
    ok('9. con la rete lenta la prima schermata arriva prima', m < PRIMA.prima * 0.7, `${PRIMA.prima} → ${m} ms (mediana di ${tempi.join(', ')})`);
  });

  /* ── 10: il file .ics ───────────────────────────────────────────────── */
  if (fare(10)) await prova('10', async () => {
    const v = JSON.parse(JSON.stringify(VIAGGIO));
    v.days[0].activities[0].notes = 'Zeta-nota segreta'; v.days[0].activities[0].booking = { needed: true, done: false, by: v.days[0].date };
    const page = await apriPagina(browser, { errori, viaggi: [v, PORTO], chiave: 'ics-' + Math.random() });
    await page.evaluate(() => { window.__condivisi = []; navigator.canShare = d => !!(d && d.files && d.files.length); navigator.share = async d => { window.__condivisi.push({ nome: d.files[0].name, tipo: d.files[0].type, testo: await d.files[0].text() }); }; });
    /* senza account «Esporta nel calendario», nella scheda del viaggio, fa
       il file; poi lo si rifà, per vedere che gli UID restano quelli */
    await page.evaluate(() => openTripZoom(1)); await page.waitForTimeout(400);
    const tasto = await page.evaluate(() => { const b = [...document.querySelectorAll('#tripZoomBody button')].find(x => /Esporta nel calendario/.test(x.textContent)); if (b) b.click(); return !!b; });
    await page.waitForTimeout(400);
    await page.evaluate(() => exportICS()); await page.waitForTimeout(400);
    const c = await page.evaluate(() => window.__condivisi);
    const uid = x => (x.testo.match(/^UID:.*$/gm) || []);
    const eventi = c[0] ? (c[0].testo.match(/BEGIN:VEVENT/g) || []).length : 0;
    const stamp = c[0] ? (c[0].testo.match(/^DTSTAMP:\d{8}T\d{6}Z$/gm) || []).length : 0;
    ok('10. il file .ics passa dal foglio Condividi (un file text/calendar), dal tasto «Esporta nel calendario»', tasto && c.length === 2 && c[0].tipo === 'text/calendar' && /\.ics$/.test(c[0].nome),
      c.length ? `${c.length} volte, ${c[0].nome} (${c[0].tipo}), ${eventi} eventi` : 'il foglio Condividi non è stato chiamato');
    ok('10. con gli stessi UID a ogni esportazione (tappa-<id>@<viaggio>.geppgo), così reimportato non raddoppia', c.length === 2 && JSON.stringify(uid(c[0])) === JSON.stringify(uid(c[1])) &&
      uid(c[0]).length === eventi && uid(c[0]).every(u => /^UID:(tappa|prenota)-\w+@[\w.-]+\.geppgo$/.test(u)) && new Set(uid(c[0])).size === eventi && stamp === eventi, uid(c[0] || { testo: '' }).slice(0, 3).join(' '));
    ok('10. senza le note', c.length && !c.some(x => /Zeta-nota/.test(x.testo)));
    await page.close();
  });

  await browser.close();
  const nonCercati = errori.filter(e => !/ERR_BLOCKED|net::|Failed to load resource|tile\.openstreetmap/.test(e));
  ok('nessun errore in pagina durante le prove', !nonCercati.length, primi(nonCercati));
  console.log('\nLO STILE (Layout 1)\n' + r.join('\n'));
  const passati = r.filter(x => x.startsWith('  OK')).length;
  console.log(`\n${passati}/${r.length} passati`);
  process.exit(passati === r.length ? 0 : 1);
})();
