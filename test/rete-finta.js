/* LA RETE FINTA: l'app servita come da GitHub Pages, le librerie come dalle
   CDN, e una rete lenta a piacere. Serve alle prove dell'avvio.

   Perche' cosi'. Il recinto di browser.js lascia passare le CDN, che qui non
   si raggiungono e sul server delle prove si': le prove che misurano o
   staccano le librerie devono decidere loro cosa arriva e quando. Allora:
   - l'app sta su un server http locale (127.0.0.1 e' un posto sicuro per il
     browser, quindi il service worker si registra come sul sito vero);
   - unpkg, jsDelivr e i caratteri di Google puntano a un server https locale,
     con un certificato fatto al momento: Chromium ci arriva da solo, anche
     dal service worker, che le rotte di Playwright non vedono;
   - i file delle librerie vengono dai pacchetti npm installati, e solo se la
     versione installata e' quella scritta nell'indirizzo: un indirizzo che
     punta a un file inesistente qui da' 404, come lo darebbe la CDN;
   - la rete lenta la fa Chromium (latenza e banda), sulla risposta compressa,
     perche' Pages e le CDN mandano tutto compresso.

   Questo file non e' una prova: tutte.js lancia solo i prova-*.js. */
const http = require('http');
const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { RADICE } = require('./browser');

const HOST_CDN = ['unpkg.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];
const TIPI = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html; charset=utf-8',
  '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.png': 'image/png' };

function certificato() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'geppgo-cert-'));
  const k = path.join(d, 'k.pem'), c = path.join(d, 'c.pem');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-subj', '/CN=localhost',
    '-days', '2', '-keyout', k, '-out', c], { stdio: 'ignore' });
  return { key: fs.readFileSync(k), cert: fs.readFileSync(c) };
}

/* "https://cdn.jsdelivr.net/npm/@zxing/library@0.23.0/umd/index.min.js"
   → { nome: '@zxing/library', versione: '0.23.0', dentro: 'umd/index.min.js' } */
function leggiIndirizzo(url) {
  let u; try { u = new URL(url); } catch (e) { return null; }
  let p = u.pathname;
  if (u.hostname === 'cdn.jsdelivr.net') { if (!p.startsWith('/npm/')) return null; p = p.slice(5); }
  else if (u.hostname === 'unpkg.com') p = p.slice(1);
  else return null;
  const m = /^((?:@[^/]+\/)?[^/@]+)@([^/]+)\/(.+)$/.exec(p);
  return m ? { nome: m[1], versione: m[2], dentro: m[3] } : null;
}
/* Il file dentro il pacchetto installato, solo se la versione e' quella
   chiesta e il file c'e' davvero. */
function filePacchetto(nome, versione, dentro) {
  const dir = path.join(RADICE, 'node_modules', nome);
  let v; try { v = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).version; } catch (e) { return null; }
  if (v !== versione) return null;
  const f = path.join(dir, dentro);
  return fs.existsSync(f) && fs.statSync(f).isFile() ? f : null;
}

/* Le risposte compresse si tengono da parte, per l'impronta del contenuto:
   due versioni dell'app possono avere la stessa lunghezza (cambia solo la
   data della versione), e una chiave piu' furba servirebbe quella vecchia. */
const compressi = new Map();
function corpo(buf, q) {
  if (!/gzip/.test(q.headers['accept-encoding'] || '')) return { b: buf, enc: null };
  const chiave = crypto.createHash('sha1').update(buf).digest('hex');
  if (!compressi.has(chiave)) compressi.set(chiave, zlib.gzipSync(buf, { level: 6 }));
  return { b: compressi.get(chiave), enc: 'gzip' };
}
function manda(q, r, buf, tipo, extra = {}) {
  const { b, enc } = corpo(buf, q);
  const h = Object.assign({ 'content-type': tipo, 'content-length': b.length }, extra);
  if (enc) h['content-encoding'] = enc;
  r.writeHead(200, h);
  r.end(b);
  return b.length;
}

/* I due server. `stato` si cambia mentre la prova gira:
   - html: il testo dell'app da servire (di serie il file vero);
   - sw: il testo della service worker (di serie il file vero);
   - ritardoHtml: millisecondi prima di rispondere con l'HTML;
   - giu: l'app non risponde (connessione chiusa), come senza rete;
   - cdnGiu: le CDN non rispondono;
   - cdnRotti: nomi di pacchetti che rispondono 404;
   - ripiego(url): per misurare il codice vecchio, il file da dare a un
     indirizzo che nei pacchetti non c'e' (jsDelivr lo minificava al volo). */
async function serverFinti(opz = {}) {
  const stato = Object.assign({ html: null, sw: null, ritardoHtml: 0, giu: false, cdnGiu: false, cdnRotti: new Set(), ripiego: null }, opz);
  const log = [];
  const app = http.createServer((q, r) => {
    const voce = { dove: 'app', path: decodeURIComponent(q.url.split('?')[0]), t: Date.now(), byte: 0 };
    log.push(voce);
    if (stato.giu) { q.socket.destroy(); voce.esito = 'giu'; return; }
    const servi = () => {
      if (stato.giu) { q.socket.destroy(); voce.esito = 'giu'; return; }
      let p = voce.path === '/' ? '/index.html' : voce.path;
      if (p === '/Index 2.1.html') {
        const testo = stato.html != null ? stato.html : fs.readFileSync(path.join(RADICE, 'Index 2.1.html'), 'utf8');
        voce.byte = manda(q, r, Buffer.from(testo), TIPI['.html'], { 'cache-control': 'no-cache' });
        voce.esito = 200; return;
      }
      if (p === '/sw.js' && stato.sw != null) {
        voce.byte = manda(q, r, Buffer.from(stato.sw), TIPI['.js'], { 'cache-control': 'no-cache', 'service-worker-allowed': '/' });
        voce.esito = 200; return;
      }
      const f = path.join(RADICE, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
      if (!f.startsWith(RADICE) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { r.writeHead(404); r.end(); voce.esito = 404; return; }
      const buf = fs.readFileSync(f);
      const extra = { 'cache-control': 'no-cache' };
      if (p === '/sw.js') extra['service-worker-allowed'] = '/';
      voce.byte = manda(q, r, buf, TIPI[path.extname(f)] || 'application/octet-stream', extra);
      voce.esito = 200;
    };
    if (/\.html$/.test(voce.path) && stato.ritardoHtml) setTimeout(servi, stato.ritardoHtml); else servi();
  });
  const cdn = https.createServer(certificato(), (q, r) => {
    const host = (q.headers.host || '').split(':')[0];
    const url = 'https://' + host + q.url;
    const voce = { dove: 'cdn', host, url, t: Date.now(), byte: 0 };
    log.push(voce);
    if (stato.cdnGiu) { q.socket.destroy(); voce.esito = 'giu'; return; }
    const cors = { 'access-control-allow-origin': '*', 'timing-allow-origin': '*', 'cache-control': 'public, max-age=31536000, immutable' };
    if (host === 'fonts.googleapis.com') {
      voce.byte = manda(q, r, Buffer.from('/* caratteri finti */\n'.repeat(40)), TIPI['.css'], cors); voce.esito = 200; return;
    }
    const pz = leggiIndirizzo(url);
    if (pz && stato.cdnRotti.has(pz.nome)) { r.writeHead(404, cors); r.end(); voce.esito = 404; return; }
    let f = pz && filePacchetto(pz.nome, pz.versione, pz.dentro);
    /* Come fa jsDelivr con gli indirizzi che il pacchetto non ha: «@2» lo
       porta all'ultima 2.x, e un .min.js che non esiste lo minifica al volo
       (qui si da' il file non minificato). Serve a misurare il codice di
       prima com'era davvero; che gli indirizzi dell'app non ne abbiano
       bisogno lo controlla prova-avvio, sui pacchetti. */
    if (!f && pz && host === 'cdn.jsdelivr.net') {
      let v = pz.versione;
      try {
        const inst = JSON.parse(fs.readFileSync(path.join(RADICE, 'node_modules', pz.nome, 'package.json'), 'utf8')).version;
        if (/^\d+$/.test(v) && inst.split('.')[0] === v) v = inst;
      } catch (e) {}
      f = filePacchetto(pz.nome, v, pz.dentro) || filePacchetto(pz.nome, v, pz.dentro.replace(/\.min\.js$/, '.js'));
      if (f) voce.comeJsDelivr = true;
    }
    if (!f && stato.ripiego) f = stato.ripiego(url);
    if (!f) { r.writeHead(404, cors); r.end(); voce.esito = 404; return; }
    const buf = fs.readFileSync(f);
    voce.byte = manda(q, r, buf, TIPI[path.extname(f)] || 'application/octet-stream', cors);
    voce.esito = 200;
  });
  await new Promise(ok => app.listen(0, '127.0.0.1', ok));
  await new Promise(ok => cdn.listen(0, '127.0.0.1', ok));
  const pc = cdn.address().port;
  return {
    app: 'http://127.0.0.1:' + app.address().port,
    stato, log,
    /* Gli argomenti di Chromium: le CDN portano al server locale. Senza proxy,
       se no il nome lo risolve il proxy e la regola non conta. */
    args: ['--no-sandbox', '--allow-file-access-from-files', '--ignore-certificate-errors', '--no-proxy-server',
      '--host-resolver-rules=' + HOST_CDN.map(h => `MAP ${h} 127.0.0.1:${pc}`).join(', ')],
    chiudi: () => { app.closeAllConnections && app.closeAllConnections(); cdn.closeAllConnections && cdn.closeAllConnections(); app.close(); cdn.close(); }
  };
}

/* Rete lenta sulla pagina: latenza per richiesta e banda, come la fa DevTools. */
async function rallenta(page, { kbps = 400, latenza = 400 } = {}) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  const bps = kbps * 1000 / 8;
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: latenza, downloadThroughput: bps, uploadThroughput: bps });
  return cdp;
}

/* Le misure si prendono dentro la pagina: la prima schermata (il primo
   disegno con qualcosa sopra) e l'app usabile (la schermata d'avvio che se ne
   va: succede alla fine dell'avvio, quando tutto e' disegnato). */
const SPIA = () => {
  window.__misure = {};
  try {
    new PerformanceObserver(l => { for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') window.__misure.prima = e.startTime; })
      .observe({ type: 'paint', buffered: true });
  } catch (e) {}
  document.addEventListener('DOMContentLoaded', () => {
    window.__misure.dcl = performance.now();
    const guarda = () => {
      const s = document.getElementById('bootSplash');
      if ((!s || s.classList.contains('hide')) && window.__misure.usabile == null) window.__misure.usabile = performance.now();
    };
    new MutationObserver(guarda).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
    guarda();
  });
};

/* Un avvio a freddo con la rete lenta: niente service worker (e' la prima
   volta), uno stato salvato da chi usa gia' l'app. Restituisce i tempi e i
   KB di JavaScript che l'app ha scaricato da sola, senza toccare niente. */
async function misuraAvvio(browser, srv, { stato, kbps = 400, latenza = 400, quieteMs = 2500, maxMs = 90000 } = {}) {
  const page = await browser.newPage({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
  if (stato) await page.addInitScript(s => { if (!localStorage.getItem('geppgo2')) { localStorage.setItem('geppgo2', JSON.stringify(s)); localStorage.setItem('geppgo2_intro', '1'); } }, stato);
  await page.addInitScript(SPIA);
  await rallenta(page, { kbps, latenza });
  const da = srv.log.length, t0 = Date.now();
  await page.goto(srv.app + '/Index%202.1.html', { waitUntil: 'commit', timeout: maxMs });
  await page.waitForFunction(() => window.__misure && window.__misure.usabile != null, null, { timeout: maxMs, polling: 100 });
  /* Poi si aspetta che la rete stia zitta: quello che l'app scarica da sola
     dopo essersi aperta (la mappa, il cloud) fa parte dell'avvio anche lui. */
  let ultimo = srv.log.length;
  let quieto = Date.now();
  while (Date.now() - quieto < quieteMs && Date.now() - t0 < maxMs) {
    await page.waitForTimeout(250);
    if (srv.log.length !== ultimo) { ultimo = srv.log.length; quieto = Date.now(); }
  }
  await page.waitForTimeout(500);
  const m = await page.evaluate(() => window.__misure);
  const voci = srv.log.slice(da);
  const js = voci.filter(v => v.dove === 'cdn' && /\.js(\?|$)/.test(v.url) && v.esito === 200);
  await page.close();
  return {
    prima: Math.round(m.prima || 0), usabile: Math.round(m.usabile), dcl: Math.round(m.dcl),
    kbJs: Math.round(js.reduce((s, v) => s + v.byte, 0) / 1024),
    fileJs: js.map(v => v.url.replace(/^https:\/\/[^/]+\/(npm\/)?/, '')),
    kbHtml: Math.round(voci.filter(v => v.dove === 'app' && v.path === '/Index 2.1.html').reduce((s, v) => s + v.byte, 0) / 1024)
  };
}

module.exports = { serverFinti, rallenta, misuraAvvio, leggiIndirizzo, filePacchetto, HOST_CDN };
