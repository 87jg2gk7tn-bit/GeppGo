/* LE FUNZIONI CHIAMATE E MAI DEFINITE.

   Una funzione che manca non la vede nessuno finche' qualcuno non tocca il
   tasto: `copyText` e' mancata per settimane, e «Copia il link» non copiava
   niente. Le espressioni regolari non bastano a trovarle (scambiano metodi
   per funzioni, stringhe per codice): qui si legge il codice con un parser
   vero, acorn, blocco di script per blocco, piu' i gestori `on...=` scritti
   nell'HTML e dentro i template.

   Un nome va bene se e' definito da qualche parte nel file, se e' del
   browser (finestra e sua catena di prototipi), o se e' di una libreria che
   arriva da fuori.

   Questo file non e' una prova: lo usano le prove (prova-avvio). */
const acorn = require('acorn');
const walk = require('acorn-walk');

/* I nomi che portano le librerie: arrivano da fuori, non sono nel file. */
const DA_FUORI = ['L', 'jsQR', 'ZXing', 'bwipjs', 'supabase', 'pdfjsLib', 'QRCode', 'Capacitor'];

async function globaliDelBrowser(browser) {
  const p = await browser.newPage();
  const nomi = await p.evaluate(() => {
    const s = new Set(); let o = window;
    while (o) { Object.getOwnPropertyNames(o).forEach(n => s.add(n)); o = Object.getPrototypeOf(o); }
    return [...s];
  });
  await p.close();
  return new Set(nomi);
}

async function funzioniMancanti(html, browser) {
  const globali = await globaliDelBrowser(browser);
  DA_FUORI.forEach(n => globali.add(n));
  const blocchi = [];
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g; let m;
  while ((m = re.exec(html))) {
    const inizio = html.slice(0, m.index + m[0].indexOf('>') + 1).split('\n').length - 1;
    blocchi.push({ codice: m[1], riga0: inizio });
  }
  const definiti = new Set();
  const chiamate = [];
  const aggiungi = pat => {
    if (!pat) return;
    if (pat.type === 'Identifier') definiti.add(pat.name);
    else if (pat.type === 'ObjectPattern') pat.properties.forEach(pr => aggiungi(pr.type === 'RestElement' ? pr.argument : pr.value));
    else if (pat.type === 'ArrayPattern') pat.elements.forEach(aggiungi);
    else if (pat.type === 'AssignmentPattern') aggiungi(pat.left);
    else if (pat.type === 'RestElement') aggiungi(pat.argument);
  };
  for (const bl of blocchi) {
    const ast = acorn.parse(bl.codice, { ecmaVersion: 'latest', sourceType: 'script', locations: true, allowHashBang: true });
    walk.full(ast, n => {
      if (/^(Function|Class)(Declaration|Expression)$/.test(n.type) && n.id) definiti.add(n.id.name);
      if (n.params) n.params.forEach(aggiungi);
      if (n.type === 'VariableDeclarator') aggiungi(n.id);
      if (n.type === 'CatchClause' && n.param) aggiungi(n.param);
      if (n.type === 'AssignmentExpression') {
        if (n.left.type === 'Identifier') definiti.add(n.left.name);
        if (n.left.type === 'MemberExpression' && n.left.object.type === 'Identifier' && n.left.object.name === 'window' && !n.left.computed) definiti.add(n.left.property.name);
      }
      if ((n.type === 'CallExpression' || n.type === 'NewExpression') && n.callee.type === 'Identifier')
        chiamate.push({ nome: n.callee.name, riga: bl.riga0 + n.loc.start.line });
    });
  }
  /* I gestori scritti come testo, nell'HTML e dentro le stringhe del codice. */
  const parole = new Set(['if', 'for', 'while', 'switch', 'return', 'typeof', 'function', 'catch', 'new', 'void', 'delete', 'in', 'of']);
  const reGest = /\son[a-z]+\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  while ((m = reGest.exec(html))) {
    const corpo = (m[1] != null ? m[1] : m[2]).replace(/\$\{[^}]*\}/g, '0');
    const riga = html.slice(0, m.index).split('\n').length;
    const reCall = /(?:^|[^\w$.])([A-Za-z_$][\w$]*)\s*\(/g; let c;
    while ((c = reCall.exec(corpo))) if (!parole.has(c[1])) chiamate.push({ nome: c[1], riga });
  }
  const mancanti = {};
  for (const c of chiamate) {
    if (definiti.has(c.nome) || globali.has(c.nome)) continue;
    (mancanti[c.nome] = mancanti[c.nome] || new Set()).add(c.riga);
  }
  return { blocchi: blocchi.length, definiti: definiti.size, chiamate: chiamate.length,
    mancanti: Object.keys(mancanti).sort().map(n => ({ nome: n, righe: [...mancanti[n]] })) };
}

module.exports = { funzioniMancanti };
