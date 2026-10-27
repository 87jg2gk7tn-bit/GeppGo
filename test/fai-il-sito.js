/* La copia che va online (Layout 3).

   Index 2.1.html si scrive con i commenti: sono la memoria del progetto, il
   perché di ogni scelta, e chi ci lavora li deve trovare dove servono. Al
   telefono invece non servono a niente: erano circa 200 dei 750 KB compressi
   che ogni avvio scarica, e col campo debole ogni KB costa una ventina di
   millisecondi prima che l'app si possa usare.

   Questo script scrive in _site/ (o nella cartella che gli si dà) la copia
   da pubblicare: gli stessi file con gli stessi nomi, senza i commenti di
   JavaScript, CSS e HTML. Restano solo quelli di licenza (/*! … *\/). La
   pubblica su GitHub Pages .github/workflows/pubblica.yml a ogni push su
   main; il file di lavoro nel repo non cambia mai. La copia è generata: non
   si modifica a mano, si rifà.

   Cosa si toglie, e come, perché il comportamento resti identico:
   - JavaScript: i commenti li trova acorn, che legge il codice come il
     browser (un «//» dentro una stringa o una regex non è un commento). Un
     commento che occupa righe intere sparisce con le sue righe; uno in mezzo
     al codice lascia uno spazio, e un a capo se ne conteneva uno, perché per
     l'inserimento automatico dei punti e virgola un commento con un a capo
     vale un a capo. Alla fine si confrontano i token della copia con quelli
     dell'originale, uno per uno, compreso dove c'è un a capo fra due token:
     se non sono identici la copia non si scrive.
   - CSS: lo stesso, saltando stringhe e url(...); dove un commento separava
     due pezzi («1px/**\/2px») resta uno spazio.
   - HTML: i commenti fuori da script e style, letti nell'ordine in cui li
     legge il browser (un «<!--» dentro uno script non è un commento HTML).

   Le prove girano anche sulla copia: APP_URL=file://…/_site/Index%202.1.html
   npm test (il secondo lavoro di prove.yml), e prova-schermi-grandi (prova
   2) confronta la copia con l'originale nel browser: stessi fogli di stile,
   stessa pagina, nessun commento rimasto.

   Uso: node test/fai-il-sito.js [cartella]      (di solito npm run sito) */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const acorn = require('acorn');

const RADICE = path.resolve(__dirname, '..');

/* Cosa va online. Solo quello che il telefono apre: niente prove, documenti,
   SQL, funzioni di Supabase o codice del ponte. Con la pubblicazione dal
   ramo, invece, andava online tutto il repo (DA-FARE.md compreso). */
const PAGINE = ['Index 2.1.html', 'index.html', 'privacy.html', 'privacy-en.html', 'privacy-es.html', 'privacy-fr.html', 'privacy-pt.html'];
const SCRIPT = ['sw.js'];
const COPIE = ['manifest.webmanifest', 'icona.svg', '_redirects'];
const CARTELLE = ['icone'];

/* ── togliere dei pezzi senza lasciare righe vuote ────────────────────────
   Un pezzo che sta da solo sulla sua riga (prima e dopo solo spazi) se ne
   va con tutta la riga; uno in mezzo al testo lascia `resto(pezzo)`. */
function togli(src, pezzi, resto) {
  let out = '', da = 0;
  for (const p of pezzi) {
    if (p.start < da) continue;
    const inizioRiga = src.lastIndexOf('\n', p.start - 1) + 1;
    let fineRiga = src.indexOf('\n', p.end);
    if (fineRiga < 0) fineRiga = src.length;
    const solo = inizioRiga >= da && !src.slice(inizioRiga, p.start).trim() && !src.slice(p.end, fineRiga).trim();
    if (solo) {
      out += src.slice(da, inizioRiga);
      da = Math.min(src.length, fineRiga + 1);
    } else {
      /* gli spazi prima del pezzo, a fine riga, non servono più */
      let prima = src.slice(da, p.start);
      const dopo = src[p.end];
      if (dopo === undefined || dopo === '\n' || dopo === '\r') prima = prima.replace(/[ \t]+$/, '');
      out += prima + resto(src, p, prima);
      da = p.end;
    }
  }
  return out + src.slice(da);
}

/* Al posto di un commento in mezzo al codice: niente se accanto c'è già uno
   spazio, un a capo se il commento ne aveva uno (vale come a capo), se no
   uno spazio, perché il commento poteva separare due parole. */
function restoCommento(src, p, prima) {
  const testo = src.slice(p.start, p.end);
  if (/[\n\r\u2028\u2029]/.test(testo) && !testo.startsWith('//')) return '\n';
  const a = prima.slice(-1), b = src[p.end];
  if (!a || /\s/.test(a) || b === undefined || /\s/.test(b)) return '';
  return ' ';
}

/* ── JavaScript ──────────────────────────────────────────────────────── */
const ACORN = { ecmaVersion: 'latest', allowHashBang: true, allowAwaitOutsideFunction: false };

function commentiJs(src, tipo) {
  const c = [];
  acorn.parse(src, Object.assign({ sourceType: tipo, onComment: (blocco, testo, start, end) => c.push({ blocco, testo, start, end }) }, ACORN));
  return c;
}

/* I token, e per ognuno se fra lui e quello prima c'è un a capo (anche
   dentro un commento a blocco: per il punto e virgola automatico conta
   come un a capo). Due sorgenti con la stessa lista si leggono uguali. */
function tokenJs(src, tipo) {
  const out = [];
  let fine = 0;
  for (const t of acorn.tokenizer(src, Object.assign({ sourceType: tipo }, ACORN))) {
    /* prima del primo token un a capo non conta: non c'è niente da chiudere */
    const capo = out.length > 0 && /[\n\r\u2028\u2029]/.test(src.slice(fine, t.start));
    out.push([t.type.label, t.value === undefined ? '' : String(t.value), capo ? 1 : 0]);
    fine = t.end;
  }
  return out;
}

function senzaCommentiJs(src, tipo = 'script') {
  const via = commentiJs(src, tipo).filter(c => !(c.blocco && c.testo.startsWith('!')));
  const out = togli(src, via, restoCommento);
  const a = tokenJs(src, tipo), b = tokenJs(out, tipo);
  if (a.length !== b.length) throw new Error(`i token non tornano: ${a.length} prima, ${b.length} dopo`);
  for (let i = 0; i < a.length; i++) {
    if (a[i][0] !== b[i][0] || a[i][1] !== b[i][1] || a[i][2] !== b[i][2])
      throw new Error(`il token ${i} cambia: ${JSON.stringify(a[i])} → ${JSON.stringify(b[i])}`);
  }
  const restano = commentiJs(out, tipo).filter(c => !(c.blocco && c.testo.startsWith('!')));
  if (restano.length) throw new Error(`restano ${restano.length} commenti`);
  return out;
}

/* ── CSS ─────────────────────────────────────────────────────────────── */
function commentiCss(css) {
  const c = [];
  for (let i = 0; i < css.length;) {
    const ch = css[i];
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < css.length && css[j] !== ch && css[j] !== '\n') j += css[j] === '\\' ? 2 : 1;
      i = j + 1;
    } else if (ch === '/' && css[i + 1] === '*') {
      const f = css.indexOf('*/', i + 2), end = f < 0 ? css.length : f + 2;
      c.push({ blocco: true, testo: css.slice(i + 2, f < 0 ? css.length : f), start: i, end });
      i = end;
    } else if ((ch === 'u' || ch === 'U') && /^url\(\s*[^\s"')]/i.test(css.slice(i, i + 6)) && !/[\w-]/.test(css[i - 1] || '')) {
      /* url(...) senza virgolette: dentro può esserci di tutto */
      const f = css.indexOf(')', i);
      i = f < 0 ? css.length : f + 1;
    } else i++;
  }
  return c;
}

function senzaCommentiCss(css) {
  const via = commentiCss(css).filter(c => !c.testo.startsWith('!'));
  const out = togli(css, via, restoCommento);
  const restano = commentiCss(out).filter(c => !c.testo.startsWith('!'));
  if (restano.length) throw new Error(`nel CSS restano ${restano.length} commenti`);
  return out;
}

/* ── HTML ────────────────────────────────────────────────────────────────
   Si legge in ordine, come il browser: un commento, uno script o uno stile,
   quello che viene prima. Il contenuto degli script si passa a
   senzaCommentiJs, quello degli stili a senzaCommentiCss; gli script che
   non sono JavaScript (type="application/json" e simili) restano com'erano. */
function pezziHtml(html) {
  const pezzi = [];
  const re = /<!--|<(script|style)\b[^>]*>/gi;
  let m;
  while ((m = re.exec(html))) {
    if (m[0] === '<!--') {
      const f = html.indexOf('-->', m.index + 4), end = f < 0 ? html.length : f + 3;
      pezzi.push({ tipo: 'commento', start: m.index, end, testo: html.slice(m.index + 4, f < 0 ? html.length : f) });
      re.lastIndex = end;
    } else {
      const tag = m[1].toLowerCase(), chiude = new RegExp('</' + tag + '\\s*>', 'ig');
      chiude.lastIndex = re.lastIndex;
      const c = chiude.exec(html), fine = c ? c.index : html.length;
      pezzi.push({ tipo: tag, apertura: m[0], start: re.lastIndex, end: fine });
      re.lastIndex = c ? c.index + c[0].length : html.length;
    }
  }
  return pezzi;
}

function eJavaScript(apertura) {
  const t = /\btype\s*=\s*["']?([^"'\s>]+)/i.exec(apertura);
  return !t || /^(text\/javascript|application\/javascript|module)$/i.test(t[1]);
}

function senzaCommentiHtml(html) {
  const pezzi = pezziHtml(html);
  /* prima il contenuto di script e stili, al loro posto; poi i commenti */
  let out = '', da = 0;
  const commenti = [];
  for (const p of pezzi) {
    if (p.tipo === 'commento') continue;
    if (/\bsrc\s*=/i.test(p.apertura)) continue;
    const dentro = html.slice(p.start, p.end);
    let nuovo = dentro;
    if (p.tipo === 'style') nuovo = senzaCommentiCss(dentro);
    else if (eJavaScript(p.apertura)) nuovo = senzaCommentiJs(dentro, /type\s*=\s*["']?module/i.test(p.apertura) ? 'module' : 'script');
    out += html.slice(da, p.start) + nuovo;
    da = p.end;
  }
  out += html.slice(da);
  /* i commenti HTML si cercano di nuovo sul testo nuovo: le posizioni sono
     cambiate, l'ordine di lettura no */
  pezziHtml(out).forEach(p => { if (p.tipo === 'commento' && !p.testo.startsWith('!')) commenti.push(p); });
  /* un commento HTML in mezzo al testo non lascia niente: nella pagina era
     un nodo a sé, e i due pezzi di testo accanto si leggevano già attaccati */
  const finale = togli(out, commenti, () => '');
  const restano = pezziHtml(finale).filter(p => p.tipo === 'commento' && !p.testo.startsWith('!'));
  if (restano.length) throw new Error(`restano ${restano.length} commenti HTML`);
  return finale;
}

/* ── la copia ───────────────────────────────────────────────────────── */
function gz(buf) { return zlib.gzipSync(buf, { level: 9 }).length; }

function faiIlSito(dest = path.join(RADICE, '_site'), opz = {}) {
  const dir = path.resolve(dest);
  if (dir === RADICE || RADICE.startsWith(dir + path.sep)) throw new Error('la copia non può andare sopra il progetto');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const misure = [];
  const scrivi = (nome, testo, prima) => {
    fs.writeFileSync(path.join(dir, nome), testo);
    misure.push({ nome, prima: Buffer.byteLength(prima), dopo: Buffer.byteLength(testo), gzPrima: gz(Buffer.from(prima)), gzDopo: gz(Buffer.from(testo)) });
  };
  for (const f of PAGINE) {
    const src = fs.readFileSync(path.join(RADICE, f), 'utf8');
    scrivi(f, senzaCommentiHtml(src), src);
  }
  for (const f of SCRIPT) {
    const src = fs.readFileSync(path.join(RADICE, f), 'utf8');
    scrivi(f, senzaCommentiJs(src), src);
  }
  for (const f of COPIE) fs.copyFileSync(path.join(RADICE, f), path.join(dir, f));
  for (const c of CARTELLE) {
    fs.mkdirSync(path.join(dir, c), { recursive: true });
    for (const f of fs.readdirSync(path.join(RADICE, c))) fs.copyFileSync(path.join(RADICE, c, f), path.join(dir, c, f));
  }
  /* Senza, GitHub Pages passerebbe i file da Jekyll, che salta quelli che
     cominciano con «_». Con l'artefatto di Pages non serve, ma non costa
     niente e tiene la copia uguale ovunque la si pubblichi. */
  fs.writeFileSync(path.join(dir, '.nojekyll'), '');
  if (!opz.zitto) {
    const kb = n => (n / 1024).toFixed(1).replace('.', ',') + ' KB';
    for (const m of misure) console.log(`${m.nome.padEnd(18)} ${kb(m.prima).padStart(10)} → ${kb(m.dopo).padStart(10)}   compresso ${kb(m.gzPrima).padStart(9)} → ${kb(m.gzDopo)}`);
    console.log(`copia scritta in ${path.relative(process.cwd(), dir) || dir}`);
  }
  return { dir, misure };
}

module.exports = { faiIlSito, senzaCommentiJs, senzaCommentiCss, senzaCommentiHtml, tokenJs, commentiJs, commentiCss, pezziHtml, eJavaScript, PAGINE, SCRIPT, COPIE, CARTELLE };

if (require.main === module) {
  try { faiIlSito(process.argv[2] ? path.resolve(process.argv[2]) : undefined); }
  catch (e) { console.error('La copia non si fa: ' + e.message); process.exit(1); }
}
