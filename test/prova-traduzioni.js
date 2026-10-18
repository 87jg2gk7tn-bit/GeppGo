/* TRADUZIONI AL 100% (miglioria 10).

   1. la copertura si conta da sola: FRASI_IN_TUTTO non è un numero scritto
      a mano, è l'unione delle frasi del dizionario, e una frase nuova la
      fa salire senza toccare altro;
   2. in inglese, spagnolo, francese e portoghese nessuna schermata o
      finestra di MAPPA_APP mostra testi in italiano (esclusi nomi propri,
      dati scritti da chi usa l'app e parole uguali nelle due lingue);
   3. i testi del passo 2 sono tradotti in tutte le lingue (Saldi,
      Condividi, «Spostamento verso», le email, le frasi composte, l'anello
      di «Fra poco» in francese), e ogni frase passata a tv() o tp() sta nel
      dizionario di tutte e quattro, con gli stessi buchi;
   4. i plurali sono giusti con 0, 1, 2 e 5 in ogni lingua;
   5. le valute seguono la lingua: dove va il simbolo e il separatore delle
      migliaia, e lo yen senza decimali;
   6. la privacy si apre nella lingua dell'app, e le traduzioni dicono che in
      caso di dubbio vale l'italiano;
   7. niente testi troncati o sovrapposti da 320 a 430 px, in tutte le
      lingue.

   `node test/prova-traduzioni.js 2 7` fa solo le prove 2 e 7: il giro delle
   schermate è lungo, e mentre si sistema una frase non serve rifare tutto.

   IL BUCO CHE QUESTA PROVA CHIUDE. Le prove sulle lingue scartavano ogni
   testo con dentro un nome del viaggio di prova, perché un nome non si
   traduce e sarebbe sembrato italiano dimenticato. Ma così passava anche
   «Spostamento verso Nishiki»: italiano cucito a un nome, scartato intero.
   Qui i nomi si coprono con un segnaposto e il resto della frase si
   confronta lo stesso. Per lo stesso motivo i nomi del viaggio di prova
   sono scelti strani (Zelda, Yuri, Ximena, Teamlab): un nome che è anche una
   parola («Museo», «Ingresso») coprirebbe le parole vere dell'app. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const { apriBrowser, APP, RADICE } = require('./browser');
const { giornoA, D, att, VIAGGIO, PORTO, NOMI, PASSI, PRINCIPALI, MISURA, apriPagina, giro } = require('./schermate');

const r = [];
const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);
const errori = [];
const SCELTE = process.argv.slice(2).filter(a => /^\d$/.test(a));
const fare = n => !SCELTE.length || SCELTE.includes(String(n));
const LINGUE = ['en', 'es', 'fr', 'pt'];
const NOME_LINGUA = { it: 'italiano', en: 'inglese', es: 'spagnolo', fr: 'francese', pt: 'portoghese' };

/* Quello che si legge in una schermata: testo, placeholder, title,
   aria-label e le voci dei menu. Si traduce e POI si guarda (vedi
   prova-lingue): la domanda è «il dizionario sa tradurlo?», non
   «l'osservatore ha fatto in tempo?». */
const LEGGI = () => {
  const fuori = new Set();
  const via = el => !!el.closest('[translate="no"]');
  const vis = el => { if (!el.getClientRects().length) return false; const s = getComputedStyle(el); return s.visibility !== 'hidden' && s.opacity !== '0'; };
  try { traduciPagina(); } catch (e) {}
  const cam = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: n => {
    const q = n.parentNode; if (!q || q.nodeName === 'SCRIPT' || q.nodeName === 'STYLE') return NodeFilter.FILTER_REJECT;
    if (via(q) || !vis(q)) return NodeFilter.FILTER_REJECT;
    return n.nodeValue && n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT; } });
  let n; while ((n = cam.nextNode())) fuori.add(n.nodeValue.replace(/\s+/g, ' ').trim());
  document.querySelectorAll('[placeholder],[title],[aria-label]').forEach(el => {
    if (via(el) || !vis(el)) return;
    ['placeholder', 'title', 'aria-label'].forEach(a => { const v = (el.getAttribute(a) || '').replace(/\s+/g, ' ').trim(); if (v) fuori.add(v); });
  });
  document.querySelectorAll('select').forEach(s => { if (via(s) || !vis(s)) return; [...s.options].forEach(o => { const v = (o.textContent || '').replace(/\s+/g, ' ').trim(); if (v) fuori.add(v); }); });
  return [...fuori];
};

/* Un giro (vedi schermate.js) che per ogni schermata legge i testi e misura
   quelli tagliati o sovrapposti; in fondo prende i testi tradotti della
   lingua, per il confronto. */
async function giroTesti(browser, lingua, larghezza, soloQuesti) {
  const g = await giro(browser, { lingua, larghezza, soloQuesti,
    guarda: page => page.evaluate(([leggi, misura, nomi]) => ({ testi: eval(leggi)(), misure: eval(misura)(nomi) }), [LEGGI.toString(), MISURA.toString(), NOMI]),
    allaFine: page => lingua === 'it' ? [] : page.evaluate(l => Object.values(DIZIONARIO[l]).concat([...GIA_TRADOTTE]), lingua) });
  const visti = {}, misure = {};
  Object.entries(g.esiti).forEach(([nome, v]) => { visti[nome] = v ? v.testi : []; if (v) misure[nome] = v.misure; });
  return { visti, misure, valori: g.fine, err: g.err, aperte: g.aperte };
}

/* ── il confronto ──────────────────────────────────────────────────────────
   Una stringa che si legge uguale in italiano e nella lingua d'arrivo o è un
   nome, o è una parola uguale per davvero, o non è tradotta. */
const IDENTICHE = new Set([
  'GeppGo', 'GeppGo Premium', 'Premium', '✨ Premium', 'Leaflet', '© OSM', 'OpenStreetMap', 'Google Maps', 'Apple Maps', 'Apple', 'Google', 'Android',
  'iPhone', 'Instagram', 'TikTok', 'Excel', 'Numbers', 'CSV', 'PDF', 'QR', 'GPS', 'OK', 'ok', 'Go', 'Email', 'E-mail', 'Password', 'Budget',
  'Hotel', 'Check-in', 'Check-out', 'Italiano', 'English', 'Español', 'Français', 'Português', 'Supabase', 'Cloudflare',
  'Project URL', 'https://...', 'es. MXP', 'es. NRT', 'A JavaScript library for interactive maps', 'Tavily',
  'Overpass', 'Nominatim', 'Photon', 'Wi-Fi', 'Bluetooth', 'Safari', 'Chrome', 'Home', 'Booking', 'Airbnb',
  'Every Door', 'Data Matrix', 'Aztec', 'PDF417', 'Louvre Musée d\'Orsay Sainte-Chapelle', 'Project Settings > API', 'https://xxxxx.supabase.co', 'Marco',
  'GEPPGO', '🗺️ Maps'
]);
/* I nomi coperti da un segnaposto, i numeri pure (quanti puntini ci mette
   una lingua dipende dalla versione del browser, vedi prova-lingue). */
const copri = x => {
  let s = x;
  for (const m of NOMI) { s = s.split(m).join('‹›'); const M = m.toUpperCase(); if (M !== m) s = s.split(M).join('‹›'); }
  return s.replace(/\d[\d.,\u00a0\u202f ]*/g, '#').replace(/\s+/g, ' ').trim();
};
const SENZA_LETTERE = /^[^\p{L}]*$/u;
const SIGLA = x => /^[A-Z]{3}( \(.{1,4}\))?$/.test(x) || /^(https?:|file:|mailto:)/.test(x) || /^[^\s@]+@[^\s@]+$/.test(x) || /^[\w:~+/=.-]{16,}$/.test(x);
const UNITA = /\b(min|km|kg|MB|GB|px|h|m|JPY|EUR|USD)\b/g;
/* I nomi dei giorni e dei mesi di una lingua: «dom 18» è giusto sia in
   italiano sia in spagnolo. */
const dateDi = l => {
  const loc = { it: 'it-IT', en: 'en-GB', es: 'es-ES', fr: 'fr-FR', pt: 'pt-PT' }[l];
  const fuori = [];
  for (let i = 0; i < 7; i++) { const d = new Date(Date.UTC(2026, 2, 1 + i)); for (const f of ['short', 'long', 'narrow']) fuori.push(d.toLocaleDateString(loc, { weekday: f, timeZone: 'UTC' })); }
  for (let m = 0; m < 12; m++) { const d = new Date(Date.UTC(2026, m, 15)); for (const f of ['short', 'long']) fuori.push(d.toLocaleDateString(loc, { month: f, timeZone: 'UTC' })); }
  return fuori.map(x => x.toLowerCase().replace(/[.,]/g, ''));
};
/* Le parole che sono italiane e basta: servono a trovare le frasi tradotte
   a metà («2 days fa»), che non sono uguali all'italiano ma lo contengono. */
const PAROLE_IT = ['della', 'delle', 'degli', 'dello', 'nella', 'nelle', 'sulla', 'dalla', 'questo', 'questa', 'questi', 'queste', 'anche', 'perché', 'così',
  'già', 'più', 'ancora', 'viaggio', 'viaggi', 'giorno', 'giorni', 'spesa', 'spese', 'tappa', 'tappe', 'persone', 'luoghi', 'oggi', 'domani', 'ieri',
  'tutti', 'niente', 'nessuno', 'adesso', 'chiama', 'raccolta', 'pezzi', 'mappa', 'invio', 'inviato', 'codice', 'salvato', 'aggiungi', 'elimina',
  'modifica', 'scegli', 'dopo', 'verso', 'spostamento', 'ricevere', 'pareggiare', 'deve', 'devi', 'hai', 'fatto', 'prossima', 'prossimo', 'ultima',
  'ultimo', 'nuovo', 'nuova', 'settimana', 'minuti', 'ore', 'gli', 'il', 'di', 'da', 'su', 'per', 'che', 'nel', 'nei', 'dei', 'alle', 'alla', 'ai',
  'sei', 'sono', 'tuo', 'tua', 'tuoi', 'mio', 'mia', 'chiudi', 'apri', 'cerca', 'cerchi', 'quando', 'dove', 'ogni', 'senza', 'fra', 'tra'];

function rimasteInItaliano(inItaliano, l, visti, valori) {
  const tradotte = new Set(valori.map(copri));
  const paroleL = new Set(valori.join(' ').toLowerCase().match(/\p{L}+/gu) || []);
  const paroleData = new Set(dateDi(l).concat(dateDi('it')));
  const soloData = x => { const p = x.toLowerCase().match(/\p{L}+/gu); return !!p && p.every(w => paroleData.has(w)); };
  /* I pezzi già tradotti, anche quelli fra un buco e l'altro di una frase
     composta («{1} pers.» dà «pers.»). */
  const pezzi = [...new Set(valori.flatMap(v => String(v || '').split(/\{\d+\}/)).map(s => s.trim()).filter(s => s.length > 2))].sort((a, b) => b.length - a.length);
  /* Una riga fatta solo di pezzi già tradotti, nomi e numeri
     («14:00–15:00 · 2 pers.»). */
  const composta = x => {
    let resto = x;
    for (const m of NOMI) resto = resto.split(m).join(' ').split(m.toUpperCase()).join(' ');
    for (const p of pezzi) if (resto.includes(p)) resto = resto.split(p).join(' ');
    return !/\p{L}/u.test(resto.replace(UNITA, ' '));
  };
  const itCoperte = new Set([...inItaliano].map(copri));
  const fuori = [];
  /* Quanti testi da tradurre si sono guardati: serve a dire la copertura
     (quelli rimasti in italiano su questi). */
  fuori.contate = 0;
  for (const [x, dove] of visti) {
    if (x.length < 2 || IDENTICHE.has(x) || SENZA_LETTERE.test(x) || SIGLA(x)) continue;
    const c = copri(x);
    /* Tolti nomi, numeri e unità («≈ 682 min · 47.7 km»), deve restare
       almeno una parola. */
    if (!/\p{L}/u.test(c.split('‹›').join(' ').replace(/#/g, ' ').replace(UNITA, ' '))) continue;
    fuori.contate++;
    if (tradotte.has(c) || soloData(x) || composta(x)) continue;
    if (itCoperte.has(c)) { fuori.push(`${dove} · «${x.slice(0, 90)}»`); continue; }
    const parole = c.toLowerCase().match(/\p{L}+/gu) || [];
    if (parole.some(p => p.length > 2 && PAROLE_IT.includes(p) && !paroleL.has(p))) fuori.push(`${dove} · a metà «${x.slice(0, 90)}»`);
  }
  return fuori;
}

/* Una pagina in una lingua, per le prove brevi. */
const apri = (browser, lingua, larghezza = 390, viaggi) => apriPagina(browser, { lingua, larghezza, viaggi, errori });
const prova = async (nome, fn) => { try { await fn(); } catch (e) { ok(nome, false, 'si è fermata: ' + e.message.split('\n')[0]); } };
const HTML = fs.readFileSync(path.join(RADICE, 'Index 2.1.html'), 'utf8');

/* ── il codice, letto come lo legge il browser ────────────────────────────
   Con acorn, non con le espressioni regolari: le chiavi escono già sciolte
   (un \u00e0 scritto nel codice diventa «à», un \' diventa «'»), e si
   sa dentro quale funzione sta ogni chiamata.
   - le chiavi di tv() e di tp();
   - i messaggi scritti per intero: toast('...'), avvisa('...'), le due righe
     di confirmDo e le righe di stato (textContent = '...'). Si traducono da
     soli solo se la frase è nel dizionario;
   - i messaggi cuciti: un pezzo di frase attaccato col + o un template con
     dentro una variabile. Non si traducono mai: in un'altra lingua le parole
     vanno in un altro ordine (vedi CLAUDE.md, «Lingue»);
   - le t() chiamate dove t è una variabile della funzione (quasi sempre il
     viaggio): in italiano t() non si chiama nemmeno, e si rompe solo nelle
     altre lingue, proprio dove nessuno guarda.
   Il Premium compreso: fino alla miglioria 11 le sue frasi restavano in
   italiano e qui si saltavano per nome di funzione. */
function statico() {
  const acorn = require('acorn'), walk = require('acorn-walk');
  const tv = new Set(), tp = new Map(), messaggi = new Set(), cuciti = [], ombre = [];
  const lettere = s => /\p{L}{2,}/u.test(s);
  const dichiaraT = fn => {
    if (fn.params.some(p => p.type === 'Identifier' && p.name === 't')) return true;
    let si = false;
    walk.recursive(fn.body, null, {
      Function() {},
      VariableDeclarator(n, s, c) { if (n.id.type === 'Identifier' && n.id.name === 't') si = true; if (n.init) c(n.init, s); }
    }, walk.base);
    return si;
  };
  const cucito = n => {
    if (!n) return false;
    if (n.type === 'TemplateLiteral') return n.expressions.length > 0 && n.quasis.some(q => lettere(q.value.cooked || ''));
    if (n.type === 'BinaryExpression' && n.operator === '+') {
      const pezzi = []; const giu = x => { if (x.type === 'BinaryExpression' && x.operator === '+') { giu(x.left); giu(x.right); } else pezzi.push(x); };
      giu(n);
      return pezzi.some(p => (p.type === 'Literal' && typeof p.value === 'string' && lettere(p.value)) || (p.type === 'TemplateLiteral' && p.quasis.some(q => lettere(q.value.cooked || ''))));
    }
    if (n.type === 'ConditionalExpression') return cucito(n.consequent) || cucito(n.alternate);
    if (n.type === 'LogicalExpression') return cucito(n.left) || cucito(n.right);
    return false;
  };
  for (const b of HTML.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
    let ast;
    try { ast = acorn.parse(b[1], { ecmaVersion: 'latest', locations: true }); } catch (e) { continue; }
    const base = HTML.slice(0, b.index + b[0].indexOf(b[1])).split('\n').length - 1;
    const riga = n => 'riga ' + (n.loc.start.line + base);
    const prendi = (n, anc) => {
      if (!n) return;
      if (n.type === 'Literal' && typeof n.value === 'string' && lettere(n.value)) messaggi.add(n.value);
      else if (n.type === 'ConditionalExpression') { prendi(n.consequent, anc); prendi(n.alternate, anc); }
      else if (n.type === 'LogicalExpression') { prendi(n.left, anc); prendi(n.right, anc); }
    };
    walk.ancestor(ast, {
      CallExpression(n, anc) {
        const nome = n.callee.type === 'Identifier' ? n.callee.name : null;
        const a = n.arguments, testo = x => x && x.type === 'Literal' && typeof x.value === 'string';
        if (nome === 'tv' && testo(a[0])) tv.add(a[0].value);
        if (nome === 'tp' && testo(a[1]) && testo(a[2])) tp.set(a[1].value + '\u0000' + a[2].value, [a[1].value, a[2].value]);
        if (['toast', 'avvisa', 'confirmDo'].includes(nome)) {
          a.slice(0, nome === 'confirmDo' ? 2 : 1).forEach(x => { prendi(x, anc); if (cucito(x)) cuciti.push(riga(x)); });
        }
        if (nome === 't') for (let i = anc.length - 2; i >= 0; i--) if (/Function/.test(anc[i].type) && dichiaraT(anc[i])) { ombre.push(riga(n)); break; }
      },
      AssignmentExpression(n, anc) {
        if (n.left.type === 'MemberExpression' && n.left.property && ['textContent', 'innerText'].includes(n.left.property.name)) prendi(n.right, anc);
      }
    });
  }
  return { tv: [...tv], tp: [...tp.values()], messaggi: [...messaggi], cuciti, ombre };
}

(async () => {
  const browser = await apriBrowser();

  /* ── 1. la copertura si conta da sola ─────────────────────────────────── */
  if (fare(1)) await prova('1', async () => {
    const scritto = /const\s+FRASI_IN_TUTTO\s*=\s*\d/.test(HTML);
    ok('1. FRASI_IN_TUTTO non è più un numero scritto a mano', !scritto && /const\s+FRASI_IN_TUTTO\s*=\s*\(/.test(HTML),
      scritto ? (HTML.match(/const\s+FRASI_IN_TUTTO\s*=\s*[^;]+/) || [''])[0] : 'si calcola dal dizionario');
    const p = await apri(browser, 'en');
    const c = await p.evaluate(() => {
      const tutte = new Set(); Object.keys(DIZIONARIO).forEach(l => Object.keys(DIZIONARIO[l]).forEach(k => tutte.add(k)));
      return { conto: FRASI_IN_TUTTO, unione: tutte.size, per: Object.fromEntries(Object.keys(DIZIONARIO).map(l => [l, frasiTradotte(l)])),
        pronte: Object.keys(DIZIONARIO).every(l => linguaPronta(l)) };
    });
    await p.close();
    ok('1. e vale quante sono le frasi del dizionario, tutte le lingue insieme', c.conto === c.unione && c.conto > 1500,
      `${c.conto} frasi; tradotte ${Object.entries(c.per).map(([l, n]) => l + ' ' + n).join(', ')}`);
    ok('1. ogni lingua è sopra la soglia che la accende da sola', c.pronte === true);
    /* La prova vera: una frase in più in una lingua sola, in una copia
       dell'app, e il conto sale di uno senza toccare nient'altro. */
    const cartella = fs.mkdtempSync(path.join(os.tmpdir(), 'geppgo-conto-'));
    const copia = path.join(cartella, 'Index 2.1.html');
    const conUna = HTML.replace(/(DIZIONARIO_CENTO\s*=\s*\{\s*en\s*:\s*\{)/, "$1'Una frase in più, solo in inglese':'One more sentence, English only',");
    fs.writeFileSync(copia, conUna);
    const q = await browser.newPage();
    await q.goto(pathToFileURL(copia).href, { waitUntil: 'domcontentloaded' });
    await q.waitForFunction(() => typeof FRASI_IN_TUTTO === 'number', null, { timeout: 30000 });
    const dopo = await q.evaluate(() => FRASI_IN_TUTTO);
    await q.close();
    fs.rmSync(cartella, { recursive: true, force: true });
    ok('1. e una frase nuova lo fa salire da sola', conUna !== HTML && dopo === c.conto + 1, `${c.conto} → ${dopo}`);
  });

  /* ── 2 e 7. il giro di tutte le schermate, da 320 a 430 px ─────────────── */
  if (fare(2) || fare(7)) await prova('2', async () => {
    const giri = {};
    for (const larghezza of [320, 430]) {
      const esiti = await Promise.all(['it'].concat(LINGUE).map(l => giroTesti(browser, l, larghezza)));
      ['it'].concat(LINGUE).forEach((l, i) => { (giri[l] = giri[l] || {})[larghezza] = esiti[i]; });
    }
    for (const larghezza of [360, 375, 390, 414]) {
      const esiti = await Promise.all(['it'].concat(LINGUE).map(l => giroTesti(browser, l, larghezza, PRINCIPALI)));
      ['it'].concat(LINGUE).forEach((l, i) => { giri[l][larghezza] = esiti[i]; });
    }
    Object.entries(giri).forEach(([l, g]) => Object.entries(g).forEach(([w, e]) => e.err.forEach(x => errori.push(`giro ${l} ${w}px: ${x}`))));

    if (fare(2)) {
      const inItaliano = new Set();
      Object.values(giri.it).forEach(e => Object.values(e.visti).forEach(v => v.forEach(x => inItaliano.add(x))));
      const passiVisti = Object.keys(giri.it[320].visti).length;
      ok(`2. il giro apre ${passiVisti} schermate e finestre (tutte quelle di MAPPA_APP, e ogni finestra vuota che nessun passo apre)`,
        passiVisti >= PASSI.length && giri.it[320].aperte.length > 40, `${giri.it[320].aperte.length} finestre diverse viste aperte`);
      for (const l of LINGUE) {
        const visti = new Map();
        Object.values(giri[l]).forEach(e => Object.entries(e.visti).forEach(([dove, v]) => v.forEach(x => { if (!visti.has(x)) visti.set(x, dove); })));
        const valori = Object.values(giri[l]).flatMap(e => e.valori);
        const resta = rimasteInItaliano(inItaliano, l, visti, valori);
        const copertura = (100 * (1 - resta.length / Math.max(1, resta.contate))).toFixed(1).replace('.', ',');
        ok(`2. in ${NOME_LINGUA[l]} nessuna schermata mostra testi in italiano`, !resta.length,
          (resta.length ? `${resta.length} su ${resta.contate} (copertura ${copertura}%): ` + resta.slice(0, 8).join(' | ')
                        : `${resta.contate} testi da tradurre guardati (${visti.size} letti in tutto), nessuno rimasto in italiano: copertura ${copertura}%`));
        if (process.env.DETTAGLI) fs.writeFileSync(process.env.DETTAGLI.replace(/\.json$/, '') + '-' + l + '.json', JSON.stringify({ resta, visti: [...visti] }, null, 1));
      }
    }

    if (fare(7)) {
      const guasti = { fuori: [], troncati: [], sovrapposti: [], puntiniSuNomi: [] };
      let misure = 0;
      Object.entries(giri).forEach(([l, g]) => Object.entries(g).forEach(([w, e]) => Object.entries(e.misure).forEach(([dove, m]) => {
        misure++;
        Object.keys(guasti).forEach(k => m[k].forEach(x => guasti[k].push(`${l} ${w}px, ${dove}: ${x}`)));
      })));
      const primi = k => guasti[k].length ? `${guasti[k].length}: ` + guasti[k].slice(0, 4).join(' | ') : '';
      ok(`7. misurate ${misure} schermate, in 5 lingue, da 320 a 430 px (320, 360, 375, 390, 414, 430)`, misure > 5 * 2 * PASSI.length);
      ok('7. niente esce di lato', !guasti.fuori.length, primi('fuori'));
      /* I puntini su un nome scritto da chi usa l'app si dicono, ma non
         bocciano: «Giappone» a 320 px ci sta per tre pixel di meno in tutte
         le lingue, italiano compreso, e un nome lungo verrebbe tagliato
         comunque. Non è un testo dell'app. */
      const nomiTagliati = [...new Set(guasti.puntiniSuNomi.map(x => x.replace(/^\w+ \d+px, [^:]+: /, '')))];
      ok('7. nessun testo troncato', !guasti.troncati.length,
        primi('troncati') || (nomiTagliati.length ? 'coi puntini, voluti, solo nomi scritti da chi usa l\'app: ' + nomiTagliati.slice(0, 3).join(' | ') : ''));
      ok('7. nessun testo sovrapposto a un altro', !guasti.sovrapposti.length, primi('sovrapposti'));
      if (process.env.DETTAGLI) fs.writeFileSync(process.env.DETTAGLI.replace(/\.json$/, '') + '-misure.json', JSON.stringify(guasti, null, 1));
      /* E la misura non è cieca: un testo tagliato e uno sovrapposto, messi
         apposta in Home, li deve trovare. Una misura che non trova mai
         niente sembra uguale a una schermata perfetta. */
      const p = await apri(browser, 'it');
      const finti = await p.evaluate(([misura, nomi]) => {
        go('plan');
        const d = document.createElement('div');
        d.innerHTML = '<div id="provaTaglio" style="width:60px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">Una frase troppo lunga</div>' +
          '<div>Una riga qualunque <span id="provaSopra" style="position:relative;top:-1.1em;left:-4em;display:inline-block">Testo sopra</span></div>';
        document.querySelector('.page.active').prepend(d);
        window.scrollTo(0, 0);
        const m = eval(misura)(nomi);
        d.remove();
        return { taglio: m.troncati.some(x => x.includes('provaTaglio')), sopra: m.sovrapposti.some(x => x.includes('provaSopra')) };
      }, [MISURA.toString(), NOMI]);
      await p.close();
      ok('7. e la misura se ne accorge: un testo tagliato e uno sovrapposto messi apposta vengono trovati', finti.taglio && finti.sopra, JSON.stringify(finti));
    }
  });

  /* ── 3. i testi del passo 2 ─────────────────────────────────────────────── */
  if (fare(3)) await prova('3', async () => {
    /* Prima il codice, letto come lo legge il browser (acorn): le chiavi
       vere, con gli à già sciolti, e le funzioni in cui stanno. */
    const st = statico();
    const p = await apri(browser, 'it');
    const d = await p.evaluate(([chiaviTv, chiaviTp, messaggi]) => {
      const buchi = s => [...new Set(String(s).match(/\{\d+\}/g) || [])].sort().join(',');
      const male = [];
      for (const l of ['en', 'es', 'fr', 'pt']) {
        const dz = DIZIONARIO[l];
        chiaviTv.forEach(k => { const v = dz[k]; if (!v) male.push(`${l} manca tv «${k}»`); else if (String(v).split('|').some(f => buchi(f) !== buchi(k))) male.push(`${l} buchi diversi «${k}» → «${v}»`); });
        chiaviTp.forEach(([uno, tanti]) => [uno, tanti].forEach(k => { const v = dz[k]; if (!v) male.push(`${l} manca tp «${k}»`); else if (String(v).split('|').some(f => buchi(f) !== buchi(k))) male.push(`${l} buchi diversi «${k}» → «${v}»`); }));
        messaggi.forEach(k => { if (!dz[k] && !dz[k.replace(/\s+/g, ' ').trim()]) male.push(`${l} manca il messaggio «${k.slice(0, 60)}»`); });
      }
      return male;
    }, [st.tv, st.tp, st.messaggi]);
    await p.close();
    ok(`3. ogni frase passata a tv() (${st.tv.length}) o tp() (${st.tp.length}) sta nel dizionario di tutte e quattro le lingue, con gli stessi buchi`, !d.length && st.tv.length > 300 && st.tp.length > 50,
      d.length ? `${d.length}: ` + d.slice(0, 4).join(' | ') : '');
    ok(`3. e ogni messaggio scritto per intero (${st.messaggi.length}, fra toast, domande, avvisi e righe di stato) ha la sua traduzione, Premium compreso`, !d.some(x => x.includes('messaggio')),
      d.filter(x => x.includes('messaggio')).slice(0, 3).join(' | '));
    ok('3. nessun messaggio è cucito a pezzi con il + o con un template', !st.cuciti.length, st.cuciti.slice(0, 4).join(' | '));
    ok('3. e nessuna t() dove t è il viaggio (si romperebbe proprio in quella lingua)', !st.ombre.length, st.ombre.slice(0, 4).join(' | '));

    /* Poi le schermate, aspettando che passi il traduttore della pagina
       (traduce quello che nasce su un fotogramma): si prova la strada vera,
       non il dizionario. */
    const ITALIANO_SALDI = ['deve ricevere', 'deve dare', 'in pari', 'Aggiungi persona', 'Come pareggiare', 'COME PAREGGIARE'];
    const ITALIANO_CONDIVIDI = ['Condivisione in tempo reale', 'Manda questo link', 'si ritrovano', 'Devono solo creare', 'Copia il link', 'Oppure inquadra',
      'Se il link non funziona', 'Il compagno apre', 'Ho un codice', 'Copia il codice', 'Da quel momento', 'Link da inviare', 'Chi apre il link', 'Senza account', 'partecipanti'];
    const male = { saldi: [], condividi: [], spostamento: [], email: [], anello: [] };
    for (const l of LINGUE) {
      const q = await apri(browser, l);
      const v = await q.evaluate(async ([saldiIt, condIt]) => {
        const aspetta = ms => new Promise(r => setTimeout(r, ms));
        const respira = async () => { await new Promise(r => requestAnimationFrame(r)); await new Promise(r => requestAnimationFrame(r)); await aspetta(120); };
        const fuori = {};
        go('money'); moneyVista('spese'); setMoney('bal'); await respira();
        const saldi = document.getElementById('money').innerText.replace(/\s+/g, ' ');
        fuori.saldi = { resta: saldiIt.filter(s => saldi.includes(s)),
          attese: [tv('Come pareggiare'), tv('+ Aggiungi persona'), tp(2, 'deve dare · {1} persona', 'deve dare · {1} persone'), tp(1, 'deve ricevere · {1} persona', 'deve ricevere · {1} persone'), tv('in pari')],
          testo: saldi };
        fuori.saldi.mancano = fuori.saldi.attese.slice(0, 4).filter(a => !saldi.toLowerCase().includes(a.toLowerCase()));
        fuori.saldi.inPari = tagSaldo(0) !== 'in pari';
        sb = sb || {}; session = { user: { id: 'io', email: 'q@x.it' } }; T().cid = 'c1'; T()._invite = 'x'; window.GEPPGO_PUBLIC_URL = 'https://esempio.it/';
        await openShare(); await respira();
        const sh = document.getElementById('shareBody');
        const conB = [...sh.querySelectorAll('p')].filter(x => x.querySelector('b'));
        fuori.condividi = { resta: condIt.filter(s => sh.innerText.includes(s)),
          grassetto: conB.map(x => x.textContent.replace(/\s+/g, ' ').trim()),
          attese: [tv('Manda questo link ai tuoi compagni: aprendolo si ritrovano l\'app e l\'invito a <b>{1}</b> già dentro. Devono solo creare il <b>loro</b> account.', esc(T().name)),
            tv('Il compagno apre l\'app, crea il suo account, e in Home tocca <b>"Ho un codice"</b>:')].map(x => x.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim()) };
        closeSheet('mShare'); session = null; delete T().cid; delete T()._invite;
        openShareLocal(); await respira();
        fuori.condividi.restaLocale = condIt.filter(s => document.getElementById('shareBody').innerText.includes(s));
        closeSheet('mShare');
        go('plan'); tapAct(0, 11); await respira();
        const tr = document.querySelector('#amTravel > div');
        fuori.spostamento = { testo: tr ? tr.textContent : '', atteso: tv('Spostamento verso {1}', 'Nishiki') };
        closeSheet('mActMenu');
        const msg = document.getElementById('auMsg'); document.getElementById('auEmail').value = 'q@x.it';
        sb = { auth: { resetPasswordForEmail: () => new Promise(() => {}), signInWithOtp: async () => ({ error: null }) } };
        authForgot(); await respira();
        const codice = msg.textContent;
        await authMagic(); await respira();
        fuori.email = { codice, codiceAtteso: t('Invio email con il codice...'), link: msg.textContent,
          linkAtteso: tv('Link inviato a {1}. Aprilo con un TOCCO DIRETTO (niente anteprima): vale una volta sola e per poco tempo.', 'q@x.it') };
        return fuori;
      }, [ITALIANO_SALDI, ITALIANO_CONDIVIDI]);
      await q.close();
      if (v.saldi.resta.length || v.saldi.mancano.length || !v.saldi.inPari) male.saldi.push(`${l}: resta ${JSON.stringify(v.saldi.resta)}, mancano ${JSON.stringify(v.saldi.mancano)}${v.saldi.inPari ? '' : ', «in pari» in italiano'}`);
      const bVisti = v.condividi.grassetto, bAttesi = v.condividi.attese;
      if (v.condividi.resta.length || v.condividi.restaLocale.length || !bAttesi.every(a => bVisti.includes(a)))
        male.condividi.push(`${l}: resta ${JSON.stringify(v.condividi.resta.concat(v.condividi.restaLocale))}, frasi col grassetto ${JSON.stringify(bVisti).slice(0, 160)}`);
      if (v.spostamento.testo !== v.spostamento.atteso || /Spostamento/.test(v.spostamento.testo)) male.spostamento.push(`${l}: «${v.spostamento.testo}»`);
      if (v.email.codice !== v.email.codiceAtteso || /Invio email/.test(v.email.codice) || v.email.link !== v.email.linkAtteso || !v.email.link.includes('q@x.it') || /inviato/.test(v.email.link))
        male.email.push(`${l}: «${v.email.codice}» / «${v.email.link.slice(0, 60)}»`);
    }
    ok('3. Saldi: «deve ricevere», «deve dare», «in pari», «+ Aggiungi persona» e «Come pareggiare» tradotti in tutte le lingue', !male.saldi.length, male.saldi.slice(0, 2).join(' | '));
    ok('3. la finestra Condividi è tradotta, con e senza account, e le frasi col grassetto sono intere', !male.condividi.length, male.condividi.slice(0, 2).join(' | '));
    ok('3. «Spostamento verso …» nel menu della tappa è tradotto', !male.spostamento.length, male.spostamento.join(' | '));
    ok('3. i messaggi d\'invio delle email («Invio email con il codice...», «Link inviato a …») sono tradotti', !male.email.length, male.email.join(' | '));

    /* L'anello di «Fra poco»: la tappa è cominciata da mezz'ora, quindi
       dice «ora». In francese «en cours», che è giusto e va su due righe più
       piccole: deve stare dentro il cerchio, a 320 e a 430 px. */
    const adesso = Object.assign({}, VIAGGIO, { days: [{ id: 'd0', date: D[0], title: '', activities: [att(31, 'Kinkakuji', '11:30', '12:45', 35.039, 135.729)] }].concat(VIAGGIO.days.slice(1)) });
    const anelli = [];
    for (const l of ['it'].concat(LINGUE)) for (const w of [320, 430]) {
      const q = await apri(browser, l, w, [adesso, PORTO]);
      const a = await q.evaluate(() => {
        const s = document.querySelector('#homeHero .hh-ring span'), g = s && s.closest('.hh-ring');
        if (!s) return null;
        const rg = document.createRange(); rg.selectNodeContents(s);
        const x = rg.getBoundingClientRect(), c = g.getBoundingClientRect();
        return { testo: s.textContent, lungo: s.classList.contains('lungo'), dentro: x.left >= c.left + 4 && x.right <= c.right - 4 && x.top >= c.top + 4 && x.bottom <= c.bottom - 4,
          misure: `${Math.round(x.width)}×${Math.round(x.height)} in ${Math.round(c.width)}×${Math.round(c.height)}` };
      });
      await q.close();
      anelli.push({ l, w, a });
    }
    const atteso = { it: 'ora', en: 'now', es: 'ahora', fr: 'en cours', pt: 'agora' };
    const storti = anelli.filter(x => !x.a || x.a.testo !== atteso[x.l] || !x.a.dentro || x.a.lungo !== (atteso[x.l].length > 5));
    ok('3. l\'anello di «Fra poco» in francese dice «en cours» (non «là») e sta dentro il cerchio, come le altre lingue, a 320 e a 430 px', !storti.length,
      storti.length ? storti.map(x => `${x.l} ${x.w}px: ${JSON.stringify(x.a)}`).join(' | ') : anelli.filter(x => x.w === 320).map(x => `${x.l} «${x.a.testo}» ${x.a.misure}`).join(', '));
  });

  /* ── 4. i plurali ──────────────────────────────────────────────────────── */
  if (fare(4)) await prova('4', async () => {
    /* Con 0, 1, 2 e 5, scritti per intero. In francese lo zero va col
       singolare («0 jour»); le parole che in italiano non cambiano («foto»,
       «attività») hanno le due forme nella traduzione, separate da «|». */
    const CASI = [
      [['{1} giorno', '{1} giorni'], {
        it: ['0 giorni', '1 giorno', '2 giorni', '5 giorni'], en: ['0 days', '1 day', '2 days', '5 days'], es: ['0 días', '1 día', '2 días', '5 días'],
        fr: ['0 jour', '1 jour', '2 jours', '5 jours'], pt: ['0 dias', '1 dia', '2 dias', '5 dias'] }],
      [['{1} persona', '{1} persone'], {
        it: ['0 persone', '1 persona', '2 persone', '5 persone'], en: ['0 people', '1 person', '2 people', '5 people'], es: ['0 personas', '1 persona', '2 personas', '5 personas'],
        fr: ['0 personne', '1 personne', '2 personnes', '5 personnes'], pt: ['0 pessoas', '1 pessoa', '2 pessoas', '5 pessoas'] }],
      [['Speso: {2} · {1} spesa', 'Speso: {2} · {1} spese'], {
        it: ['Speso: X · 0 spese', 'Speso: X · 1 spesa', 'Speso: X · 2 spese', 'Speso: X · 5 spese'], en: ['Spent: X · 0 expenses', 'Spent: X · 1 expense', 'Spent: X · 2 expenses', 'Spent: X · 5 expenses'],
        es: ['Gastado: X · 0 gastos', 'Gastado: X · 1 gasto', 'Gastado: X · 2 gastos', 'Gastado: X · 5 gastos'], fr: ['Dépensé : X · 0 dépense', 'Dépensé : X · 1 dépense', 'Dépensé : X · 2 dépenses', 'Dépensé : X · 5 dépenses'],
        pt: ['Gasto: X · 0 despesas', 'Gasto: X · 1 despesa', 'Gasto: X · 2 despesas', 'Gasto: X · 5 despesas'] }],
      [['{1} foto da caricare', '{1} foto da caricare'], {
        it: ['0 foto da caricare', '1 foto da caricare', '2 foto da caricare', '5 foto da caricare'], en: ['0 photos to upload', '1 photo to upload', '2 photos to upload', '5 photos to upload'],
        es: ['0 fotos por subir', '1 foto por subir', '2 fotos por subir', '5 fotos por subir'], fr: ['0 photo à envoyer', '1 photo à envoyer', '2 photos à envoyer', '5 photos à envoyer'],
        pt: ['0 fotos por carregar', '1 foto por carregar', '2 fotos por carregar', '5 fotos por carregar'] }],
      [['{1} attività in attesa', '{1} attività in attesa'], {
        it: ['0 attività in attesa', '1 attività in attesa', '2 attività in attesa', '5 attività in attesa'], en: ['0 activities waiting', '1 activity waiting', '2 activities waiting', '5 activities waiting'],
        es: ['0 actividades en espera', '1 actividad en espera', '2 actividades en espera', '5 actividades en espera'], fr: ['0 activité en attente', '1 activité en attente', '2 activités en attente', '5 activités en attente'],
        pt: ['0 atividades à espera', '1 atividade à espera', '2 atividades à espera', '5 atividades à espera'] }]
    ];
    /* E dove si legge davvero: «La giornata» in Home dice quante tappe ha
       il giorno scelto. Quattro giorni con 0, 1, 2 e 5 tappe. */
    const tappe = n => Array.from({ length: n }, (_, i) => att(400 + n * 10 + i, 'Kinkakuji ' + (i + 1), String(9 + i).padStart(2, '0') + ':00', String(9 + i).padStart(2, '0') + ':45', 35.039, 135.729));
    const pieno = Object.assign({}, VIAGGIO, { days: [0, 1, 2, 5].map((n, i) => ({ id: 'p' + i, date: D[i], title: '', activities: tappe(n) })) });
    const GIORNATA = { it: ['0 TAPPE', '1 TAPPA', '2 TAPPE', '5 TAPPE'], en: ['0 STOPS', '1 STOP', '2 STOPS', '5 STOPS'], es: ['0 PARADAS', '1 PARADA', '2 PARADAS', '5 PARADAS'],
      fr: ['0 ÉTAPE', '1 ÉTAPE', '2 ÉTAPES', '5 ÉTAPES'], pt: ['0 PARAGENS', '1 PARAGEM', '2 PARAGENS', '5 PARAGENS'] };
    const male = [], giornata = [];
    for (const l of ['it'].concat(LINGUE)) {
      const q = await apri(browser, l, 390, [pieno, PORTO]);
      const v = await q.evaluate(casi => ({
        tp: casi.map(([[uno, tanti]]) => [0, 1, 2, 5].map(n => tp(n, uno, tanti, 'X'))),
        giornata: [0, 1, 2, 3].map(i => { selHomeDay(i); const c = document.querySelector('#homeHero .hh-sec-c') || document.querySelector('.hh-sec-c'); return c ? c.textContent.trim() : ''; })
      }), CASI);
      await q.close();
      CASI.forEach(([chiavi, attese], i) => { if (JSON.stringify(v.tp[i]) !== JSON.stringify(attese[l])) male.push(`${l} «${chiavi[0]}»: ${JSON.stringify(v.tp[i])}`); });
      if (JSON.stringify(v.giornata) !== JSON.stringify(GIORNATA[l])) giornata.push(`${l}: ${JSON.stringify(v.giornata)}`);
    }
    ok('4. plurali giusti con 0, 1, 2 e 5 in tutte e cinque le lingue (lo zero francese al singolare, «foto» e «attività» con le due forme)', !male.length,
      male.slice(0, 3).join(' | ') || `${CASI.length} frasi × 4 numeri × 5 lingue`);
    ok('4. e a schermo: «La giornata» dice 0, 1, 2 e 5 tappe nella forma giusta', !giornata.length, giornata.join(' | ') || 'fr: ' + GIORNATA.fr.join(', '));
  });

  /* ── 5. le valute ─────────────────────────────────────────────────────── */
  if (fare(5)) await prova('5', async () => {
    /* Il simbolo dove lo mette la lingua, il separatore delle migliaia della
       lingua, e lo yen senza decimali. Gli spazi sono quelli che non vanno a
       capo (U+00A0 e, in francese, U+202F): un importo spezzato fra due righe
       non si legge. Qui si confrontano come spazi normali, e a parte si
       controlla che non ce ne sia nessuno normale.
       Le migliaia come le separa la lingua (miglioria 11): in spagnolo e in
       portoghese quattro cifre stanno attaccate e i gruppi partono dalla
       quinta. L'italiano a quattro cifre dipende dalla versione del browser
       (i dati delle lingue sono cambiati nel 2025: «1.234» qui, «1234» con un
       Chromium più nuovo), e lì si accetta l'uno e l'altro. */
    const ATTESI = {
      it: ['1.234,50 €', '12.345,50 €', '1.234.567 ¥', '99,90 A$', '0,50 €'],
      en: ['€1,234.50', '€12,345.50', '¥1,234,567', 'A$99.90', '€0.50'],
      es: ['1234,50 €', '12.345,50 €', '1.234.567 ¥', '99,90 A$', '0,50 €'],
      fr: ['1 234,50 €', '12 345,50 €', '1 234 567 ¥', '99,90 A$', '0,50 €'],
      pt: ['1234,50 €', '12 345,50 €', '1 234 567 ¥', '99,90 A$', '0,50 €']
    };
    const LISTA = { it: ['3.000 ¥', '2.400 ¥', '12.000 ¥'], en: ['¥3,000', '¥2,400', '¥12,000'], es: ['3000 ¥', '2400 ¥', '12.000 ¥'], fr: ['3 000 ¥', '2 400 ¥', '12 000 ¥'], pt: ['3000 ¥', '2400 ¥', '12 000 ¥'] };
    /* «3.000» e «3000» sono tutti e due italiano giusto, a seconda del browser. */
    const quattro = (l, x) => l === 'it' ? x.map(s => s.replace(/(^|[^\d.])(\d)\.(\d{3})(?![\d.])/g, '$1$2$3')) : x;
    const male = [], lista = [], spazi = [];
    for (const l of ['it'].concat(LINGUE)) {
      const q = await apri(browser, l);
      const v = await q.evaluate(() => {
        const soldi = [fmtMoney(1234.5, 'EUR'), fmtMoney(12345.5, 'EUR'), fmtMoney(1234567, 'JPY'), fmtMoney(99.9, 'AUD'), fmtMoney(0.5, 'EUR')];
        go('money'); moneyVista('spese'); setMoney('list');
        return { soldi, lista: [...document.querySelectorAll('#money .exp-amt')].map(x => x.textContent.trim()) };
      });
      await q.close();
      const piano = s => s.replace(/[\u00a0\u202f]/g, ' ');
      if (JSON.stringify(quattro(l, v.soldi.map(piano))) !== JSON.stringify(quattro(l, ATTESI[l]))) male.push(`${l}: ${JSON.stringify(v.soldi.map(piano))}`);
      if (JSON.stringify(quattro(l, v.lista.map(piano))) !== JSON.stringify(quattro(l, LISTA[l]))) lista.push(`${l}: ${JSON.stringify(v.lista.map(piano))}`);
      if (v.soldi.concat(v.lista).some(s => s.includes(' '))) spazi.push(l);
    }
    ok('5. le valute seguono la lingua: dove va il simbolo, il separatore delle migliaia, i decimali (e lo yen senza)', !male.length,
      male.join(' | ') || 'it «12.345,50 €», en «€1,234.50», fr «1 234,50 €», yen «1.234.567 ¥» / «¥1,234,567»');
    ok('5. in spagnolo e portoghese quattro cifre senza separatore («1234,50 €»), cinque col loro («12.345,50 €», «12 345,50 €»)', !male.some(x => /^(es|pt)/.test(x)));
    ok('5. e così anche nella lista delle spese', !lista.length, lista.join(' | '));
    ok('5. con spazi che non vanno a capo dentro l\'importo', !spazi.length, spazi.join(', '));
  });

  /* ── 6. la privacy nella lingua dell'app ──────────────────────────────── */
  if (fare(6)) await prova('6', async () => {
    const FILE = { it: 'privacy.html', en: 'privacy-en.html', es: 'privacy-es.html', fr: 'privacy-fr.html', pt: 'privacy-pt.html' };
    const conta = html => ['<h2', '<h3', '<li', '<tr', '<table'].map(t => (html.match(new RegExp(t + '\\b', 'g')) || []).length).join('/');
    const fuori = html => [...html.matchAll(/(?:src|href)=["']https?:\/\/([^/"']+)/g)].map(m => m[1]).filter(h => !/garanteprivacy|commissariatodips/.test(h));
    const itHtml = fs.readFileSync(path.join(RADICE, 'privacy.html'), 'utf8');
    const male = [];
    for (const l of ['it'].concat(LINGUE)) {
      const q = await apri(browser, l);
      const v = await q.evaluate(() => {
        let aperto = null; const vero = window.open; window.open = u => { aperto = u; return null; };
        apriPrivacy(); window.open = vero;
        return { aperto, link: [...document.querySelectorAll('#authGate a[href*="privacy"]')].map(a => a.getAttribute('href')) };
      });
      if (v.aperto !== FILE[l] || !v.link.length || v.link.some(h => h !== FILE[l])) male.push(`${l}: apre ${v.aperto}, link ${v.link.join(',')}`);
      const html = fs.readFileSync(path.join(RADICE, FILE[l]), 'utf8');
      await q.goto(new URL(FILE[l], APP).href, { waitUntil: 'domcontentloaded' });
      const pag = await q.evaluate(() => ({
        lang: document.documentElement.lang,
        lingue: [...document.querySelectorAll('.lingue a, .lingue strong')].map(x => (x.tagName === 'STRONG' ? '*' : '') + (x.getAttribute('href') || x.textContent)),
        faFede: (() => { const b = document.getElementById('fa-fede'); return b ? { testo: b.textContent.replace(/\s+/g, ' ').trim(), link: !!b.querySelector('a[href="privacy.html"]') } : null; })()
      }));
      await q.close();
      if (pag.lang !== l) male.push(`${l}: lang «${pag.lang}»`);
      if (pag.lingue.length !== 5 || pag.lingue.filter(x => x.startsWith('*')).length !== 1 || Object.values(FILE).filter(f => f !== FILE[l]).some(f => !pag.lingue.includes(f))) male.push(`${l}: lingue ${JSON.stringify(pag.lingue)}`);
      if (l !== 'it' && !(pag.faFede && pag.faFede.link)) male.push(`${l}: manca il riquadro «fa fede l'italiano»`);
      if (l === 'it' && pag.faFede) male.push('it: il riquadro «fa fede» non va nell\'originale');
      if (conta(html) !== conta(itHtml)) male.push(`${l}: struttura ${conta(html)} invece di ${conta(itHtml)}`);
      if (fuori(html).length) male.push(`${l}: carica da fuori ${fuori(html).join(', ')}`);
      if (!html.includes('merati.giacomo94@gmail.com') || !/14/.test(html) || !/112/.test(html) || !/eu-north-1/.test(html) || !/Tavily/.test(html) || !/Cloudflare Workers AI/.test(html)) male.push(`${l}: manca un punto fermo (email, 14 anni, 112, eu-north-1, Tavily, Workers AI)`);
    }
    ok('6. la privacy si apre nella lingua dell\'app (Profilo e link sotto «Crea account»), in tutte e cinque', !male.some(x => /apre/.test(x)), male.filter(x => /apre/.test(x)).join(' | '));
    ok('6. ogni traduzione dice che in caso di dubbio vale l\'italiano, e ha i link alle altre lingue', !male.some(x => /lingue|fa fede|lang/.test(x)), male.filter(x => /lingue|fa fede|lang/.test(x)).join(' | '));
    ok('6. e ha le stesse sezioni dell\'italiano, senza niente preso da fuori', !male.some(x => /struttura|fuori|punto fermo/.test(x)), male.filter(x => /struttura|fuori|punto fermo/.test(x)).join(' | '));
    const redir = fs.readFileSync(path.join(RADICE, '_redirects'), 'utf8').split('\n');
    const tutto = redir.findIndex(x => /^\/\*/.test(x));
    const senzaRegola = Object.values(FILE).filter(f => { const i = redir.findIndex(x => x.startsWith('/' + f + ' ')); return i < 0 || i > tutto; });
    ok('6. le traduzioni restano raggiungibili come l\'originale (_redirects)', !senzaRegola.length, senzaRegola.join(', '));
  });

  r.sort((a, b) => (parseInt((a.match(/ (\d)\./) || [])[1], 10) || 0) - (parseInt((b.match(/ (\d)\./) || [])[1], 10) || 0));
  console.log('\n' + r.join('\n'));
  const falliti = r.filter(x => x.includes('FALLITO')).length;
  console.log(`\n${r.length - falliti}/${r.length} passati`);
  if (errori.length) console.log('\nErrori in pagina:\n' + [...new Set(errori)].slice(0, 30).join('\n'));
  await browser.close();
  process.exit(falliti ? 1 : 0);
})();
