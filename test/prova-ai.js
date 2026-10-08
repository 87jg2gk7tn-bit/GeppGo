/* L'ASSISTENTE AFFIDABILE, GRATUITO E IN REGOLA.

   Le dodici chiamate all'assistente passano tutte da chiediAI. Qui il
   ponte e' finto: risponde quello che decide la prova, quando lo decide (o
   mai), cosi' si vedono i casi che col ponte vero capitano a caso: il campo
   che cade, il modello in coda, la quota finita, il JSON storto. Le attese
   lunghe (30 secondi, 10 per «Annulla») le fa passare l'orologio finto di
   Playwright, non l'orologio vero.
   1. SheetJS non si scarica all'avvio ne' in sottofondo: arriva aprendo
      l'importazione, e dopo c'e' anche senza rete;
   2. verso l'assistente c'e' una fetch sola, dentro chiediAI;
   3. tempo scaduto: un messaggio chiaro, niente attesa infinita, il tasto
      torna attivo;
   4. senza rete: il messaggio subito, e nessuna richiesta;
   5. un 500 e poi una risposta buona: riesce il secondo tentativo; un 429
      (o la quota finita): nessun secondo tentativo e il messaggio giusto;
   6. due tocchi: una richiesta;
   7. «Annulla», che compare dopo dieci secondi, ferma la richiesta;
   8. il JSON fra ``` o con una frase intorno si legge; quello rotto si
      chiede di nuovo una volta, poi un messaggio;
   9. con l'app in inglese la richiesta chiede la risposta in inglese, e
      «Rispondi SEMPRE in italiano» non c'e' piu';
   10. niente api.anthropic.com e niente modelli «claude-»;
   11. la privacy nomina Cloudflare Workers AI e Tavily, e dice cosa fanno
       dei dati;
   12. i testi nuovi in cinque lingue;
   13. a Tavily solo posti, destinazione e date: l'elenco che parte dall'app
       non ha persone ne' recapiti, e passato al ponte vero (worker/) la
       ricerca resta pulita anche se il modello ci mette dei dati personali;
   14. quando la ricerca sul web non c'e', la risposta arriva e lo dice;
   15. la quota finita dice l'ora del ritorno, nell'ora del telefono;
   16. una richiesta troppo grande ha la sua frase;
   17. gli orari di apertura vengono da OpenStreetMap, senza assistente;
   18. i posti di una lista incollata si controllano sulla mappa;
   19. un PDF scansionato parte come immagini (valigia, albergo, chat);
   20. la mappa dell'app parte compatta, e intera solo quando serve;
   21. la foto di un reel parte rimpicciolita e senza i dati nascosti. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { apriBrowser, APP, RADICE } = require('./browser');
const { serverFinti } = require('./rete-finta');

/* I file sono quelli accanto ad APP_URL, se c'e': cosi' la controprova sul
   codice vecchio prova davvero il codice vecchio, privacy compresa. */
const FILE_APP = APP.startsWith('file://') ? decodeURIComponent(APP.slice(7)) : path.join(RADICE, 'Index 2.1.html');
const accanto = nome => fs.existsSync(path.join(path.dirname(FILE_APP), nome)) ? path.join(path.dirname(FILE_APP), nome) : path.join(RADICE, nome);
const HTML = fs.readFileSync(FILE_APP, 'utf8');
const SW = fs.readFileSync(accanto('sw.js'), 'utf8');
const PRIVACY = fs.readFileSync(accanto('privacy.html'), 'utf8').replace(/\s+/g, ' ');
let XLSX = null;
try { XLSX = require(path.join(RADICE, 'node_modules', 'xlsx')); } catch (e) {}
const CARTELLA = fs.mkdtempSync(path.join(os.tmpdir(), 'geppgo-ai-'));

const PONTE = /geppgo-ai\.merati-giacomo94\.workers\.dev/;
const SHEETJS = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
const r = [];
const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);
const errori = [];
/* Ogni richiesta arrivata al ponte finto, da tutte le prove: la 10 guarda
   che nessuna nomini un modello. */
const tutte = [];

const LISBONA = { trips: [{ id: 1, name: 'Lisbona', destination: 'Lisbona', currency: 'EUR', status: 'open', start: '2026-11-02', end: '2026-11-03',
  participants: [{ id: 1, name: 'Gepp', isMe: true }], suggested: [], pois: [], hotels: [], weather: {}, createdAt: 1, expenses: [], tickets: [],
  days: [{ id: 'd1', date: '2026-11-02', title: '', travelMode: 'walk', activities: [{ id: 501, name: 'Torre di Belém', time: '10:00', timeEnd: '11:00',
    type: 'outdoor', who: [1], completed: false, booking: { needed: false, done: false }, lat: 38.6916, lng: -9.2160 }] },
    { id: 'd2', date: '2026-11-03', title: '', activities: [] }] }],
  currentTripId: 1, settings: {}, myName: 'Gepp', skipAuth: true, consentNotif: true };
const POSTI = JSON.stringify({ posti: [
  { nome: 'Pastéis de Belém', query: 'Pastéis de Belém, Lisbona', perche: 'I pastéis originali, appena sfornati.' },
  { nome: 'LX Factory', query: 'LX Factory, Lisbona', perche: 'Negozi e caffè in una vecchia fabbrica.' }] });
const REEL = 'Lisbona in 2 giorni: Pastéis de Belém per colazione, poi LX Factory.';
const TASTO_REEL = '#impPlacesSub button.btn-grad';
const TASTO_CHAT = '#aiMode .chat-in-row button.btn-grad';

/* Il ponte finto. Ogni richiesta prende il prossimo passo della fila
   (l'ultimo resta per tutte quelle dopo):
   { testo, ricerca }  risponde come il ponte vero, con quel testo (e se c'e'
                       lo stato della ricerca sul web, come il ponte nuovo)
   { status, errore, tipo, riprova_alle }
                       risponde con quello status e {error:{message,...}}
   { cade: true }      la connessione si chiude, come col campo che cade
   { mai: true }       non risponde mai: la richiesta resta appesa
   e { dopo: ms } per farlo aspettare prima di rispondere. */
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST, OPTIONS' };
const testoDi = c => JSON.stringify(c || '');
const tipoDi = c => /reel\/post/.test(testoDi(c)) ? 'reel' : /Sei l'assistente di viaggio/.test((c && c.system) || '') ? 'chat'
  : /richiede o consiglia la prenotazione/.test(testoDi(c)) ? 'prenotare' : /conferma di un alloggio/.test(testoDi(c)) ? 'alloggio'
  : /mettere in valigia/.test(testoDi(c)) ? 'bagagli' : /TESTO INCOLLATO/.test(testoDi(c)) ? 'incollato' : 'altro';
async function ponteFinto(p, fila) {
  await p.unroute(PONTE).catch(() => {});
  const viste = [];
  await p.route(PONTE, async route => {
    const q = route.request();
    if (q.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS }).catch(() => {});
    let corpo = null; try { corpo = JSON.parse(q.postData() || 'null'); } catch (e) {}
    const v = { t: Date.now(), corpo, tipo: tipoDi(corpo) };
    viste.push(v); tutte.push(v);
    const passo = fila.length > 1 ? fila.shift() : fila[0];
    if (!passo || passo.mai) return;
    if (passo.dopo) await new Promise(fatto => setTimeout(fatto, passo.dopo));
    try {
      if (passo.cade) await route.abort('connectionreset');
      else if (passo.status) await route.fulfill({ status: passo.status, contentType: 'application/json', headers: CORS, body: JSON.stringify({ error: Object.assign({ message: passo.errore || 'errore' },
        passo.tipo ? { type: passo.tipo } : {}, passo.riprova_alle ? { riprova_alle: passo.riprova_alle } : {}) }) });
      else await route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(Object.assign({ content: [{ type: 'text', text: passo.testo }], stop_reason: 'end_turn' },
        passo.ricerca ? { ricerca: passo.ricerca } : {})) });
    } catch (e) { /* la pagina l'ha gia' lasciata andare (annullata, o scaduta) */ }
  });
  return viste;
}
const quante = (viste, tipo) => viste.filter(v => v.tipo === tipo).length;

let browser;
const pronta = page => page.waitForFunction(() => typeof window.renderAll === 'function' && !document.getElementById('bootSplash'), null, { timeout: 30000, polling: 100 });
async function apri({ stato = LISBONA, lingua = null, orologio = false, ora = null, fuso = null } = {}) {
  const page = await browser.newPage(Object.assign({ viewport: { width: 390, height: 844 } }, fuso ? { timezoneId: fuso } : {}));
  page.on('pageerror', e => errori.push('PAGEERROR: ' + e.message.split('\n')[0]));
  /* L'orologio finto scorre come quello vero finche' la prova non lo fa
     saltare avanti: l'avvio dell'app non se ne accorge. */
  if (orologio) await page.clock.install(ora ? { time: new Date(ora) } : undefined);
  await page.addInitScript(([s, l]) => {
    if (localStorage.getItem('prova-ai')) return;
    localStorage.clear();
    const st = JSON.parse(JSON.stringify(s)); st.settings = st.settings || {};
    if (l) st.settings.lingua = l;
    localStorage.setItem('geppgo2', JSON.stringify(st));
    localStorage.setItem('geppgo2_intro', '1');
    localStorage.setItem('prova-ai', '1');
  }, [stato, lingua]);
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await pronta(page);
  return page;
}
const prova = async (nome, fn) => {
  try { await fn(); } catch (e) { ok(nome, false, 'si è fermata: ' + e.message.split('\n')[0]); }
};
/* «Esplora › Importa › Posti da un reel»: la richiesta piu' semplice che ha
   un tasto suo, un JSON da leggere e un riquadro dove scrive l'esito. */
async function alReel(p) {
  await p.evaluate(() => { go('discover'); setDiscover('imp'); });
  await p.waitForTimeout(300);
  await p.fill('#impText', REEL);
}
/* Se la richiesta e' ancora in corso. Nel codice vecchio, su cui gira la
   controprova, aiInCorso non c'e': li' si guarda la scritta d'attesa, che
   c'era anche prima. Cosi' la controprova fallisce per quello che l'app fa,
   non per un nome che le manca. */
const inCorso = (p, k = 'reel') => p.evaluate(k => typeof aiInCorso === 'function' ? aiInCorso(k)
  : k === 'chat' ? !!document.querySelector('#chatMsgs .msg.typing') : /Cerco i posti/.test(document.getElementById('impResult').textContent), k);
async function aspetta(p, vuoi, k, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if ((await inCorso(p, k)) === vuoi) return true; await p.waitForTimeout(100); }
  return false;
}
const partita = (p, k = 'reel') => aspetta(p, true, k, 5000);
const finito = (p, k = 'reel') => aspetta(p, false, k, 15000);
/* Una richiesta fatta a mano, senza tasto ne' riquadro: l'esito finisce in
   window.__esito. Sul codice vecchio chiediAI non c'e', e lo si dice. */
const aMano = (p, o) => p.evaluate(o => {
  if (typeof chiediAI !== 'function') return false;
  window.__esito = 'in corso';
  chiediAI(o).then(x => { window.__esito = x; });
  return true;
}, o);
const esitoReel = p => p.evaluate(() => ({
  testo: document.getElementById('impResult').textContent.replace(/\s+/g, ' ').trim(),
  acceso: !document.querySelector('#impPlacesSub button.btn-grad').disabled,
  pillola: !!document.querySelector('#aiAttesa.on')
}));
async function allaChat(p) {
  await p.evaluate(() => { go('discover'); setDiscover('ai'); });
  await p.waitForTimeout(400);
}
const testoChat = p => p.evaluate(() => document.getElementById('chatMsgs').textContent.replace(/\s+/g, ' ').trim());

/* Un viaggio con dentro tutto quello che a una ricerca sul web non deve
   arrivare: compagni con nome e cognome, una tappa che e' un promemoria con
   un nome dentro, un telefono, un'email, un numero lungo, un pranzo senza
   posto. I posti veri sono tre: il luogo salvato, l'albergo, la Torre. */
const tappa = (id, name, lat, lng) => ({ id, name, time: '10:00', timeEnd: '11:00', type: 'outdoor', who: [1], completed: false,
  booking: { needed: false, done: false }, lat, lng });
const PRIVATO = { trips: [{ id: 2, name: 'Lisbona con gli amici', destination: 'Lisbona', currency: 'EUR', status: 'open', start: '2026-11-02', end: '2026-11-03',
  participants: [{ id: 1, name: 'Gepp', isMe: true }, { id: 2, name: 'Marco Rossi' }, { id: 3, name: 'Giulia Bianchi' }],
  suggested: [], weather: {}, createdAt: 1, expenses: [], tickets: [],
  pois: [{ id: 'p1', name: 'Oceanário de Lisboa', lat: 38.7635, lng: -9.0937, address: 'Lisbona', notes: '', priority: 'essential', assignedDay: null },
         { id: 'p2', name: 'Casa di Marco', lat: 38.72, lng: -9.14, address: 'Lisbona', notes: '', priority: 'normal', assignedDay: null }],
  hotels: [{ id: 'h1', name: 'Hotel Avenida Palace', address: 'Lisbona', checkIn: '2026-11-02', checkOut: '2026-11-03', lat: 38.7149, lng: -9.1413 }],
  days: [{ id: 'd1', date: '2026-11-02', title: '', travelMode: 'walk', activities: [
    tappa(501, 'Torre di Belém', 38.6916, -9.2160), tappa(502, 'Cena da Marco', 38.7100, -9.1300), tappa(503, 'Compleanno di Giulia', 38.7000, -9.1400),
    tappa(504, 'Chiamare Ana +351 912 345 678', 38.7000, -9.1400), tappa(505, 'mario.rossi@example.com', 38.7000, -9.1400),
    tappa(506, 'Ritiro biglietti 12345678', 38.7000, -9.1400), tappa(507, 'Pranzo con Ana', null, null)] },
    { id: 'd2', date: '2026-11-03', title: '', activities: [] }] }],
  currentTripId: 2, settings: {}, myName: 'Gepp', skipAuth: true, consentNotif: true };
const DOMANDA_PRIVATA = 'A che ora apre domani la Torre di Belém? Sono Marco Rossi, scrivimi a marco.rossi@example.com o al +39 333 1234567';
const PERSONALI = ['Marco', 'Rossi', 'Giulia', 'Bianchi', 'Ana', 'marco.rossi', 'mario', '@', '+351', '+39', '333', '1234567', '12345678', '912 345'];
const personali = s => PERSONALI.filter(x => String(s).includes(x));

/* La richiesta che l'app ha davvero mandato, passata al ponte vero
   (worker/ponte-ai.js) con un modello finto che risponde la fila data e una
   Tavily finta che tiene tutto quello che riceve. */
async function alPonteVero(corpo, risposte) {
  const src = fs.readFileSync(path.join(RADICE, 'worker', 'ponte-ai.js'), 'utf8');
  const ponte = (await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'))).default;
  const ricevute = [], vero = globalThis.fetch, fila = risposte.slice();
  globalThis.fetch = async (url, opz = {}) => {
    let b = null; try { b = JSON.parse(opz.body); } catch (e) {}
    ricevute.push(Object.assign({ url: String(url) }, b || {}));
    return new Response(JSON.stringify({ results: [{ title: 'Torre de Belém', url: 'https://www.torrebelem.gov.pt/', content: 'Aberta das 10:00 às 18:30.' }] }),
      { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const AI = { run: async () => ({ response: fila.length > 1 ? fila.shift() : fila[0] }) };
    const res = await ponte.fetch(new Request('https://geppgo-ai.prova.workers.dev/', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://87jg2gk7tn-bit.github.io' }, body: JSON.stringify(corpo) }), { AI, TAVILY_KEY: 'tvly-prova' });
    const t = await res.text();
    if (res.status !== 200) throw new Error('il ponte ha risposto ' + res.status + ': ' + t.slice(0, 120));
    return { ricevute, risposta: JSON.parse(t) };
  } finally { globalThis.fetch = vero; }
}

/* OpenStreetMap finto: Nominatim risponde quello che decide la prova, Photon
   niente. Si tengono le domande arrivate. */
async function mappaFinta(p, rispondi) {
  const chieste = [];
  const cors = { 'access-control-allow-origin': '*' };
  await p.route(/nominatim\.openstreetmap\.org\/search/, route => {
    const u = new URL(route.request().url());
    chieste.push({ q: u.searchParams.get('q') || '', extratags: u.searchParams.get('extratags') });
    return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(rispondi(u.searchParams.get('q') || '') || []) });
  });
  await p.route(/photon\.komoot\.io/, route => route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify({ features: [] }) }));
  return chieste;
}

/* pdf.js finto: un PDF di n pagine A4 senza testo dentro, cioe' una
   scansione. caricaPdfLib usa window.pdfjsLib se c'e' gia'. */
const pdfFinto = (p, pagine) => p.evaluate(n => {
  window.pdfjsLib = { getDocument: () => ({ promise: Promise.resolve({ numPages: n, getPage: async k => ({
    getTextContent: async () => ({ items: [] }),
    getViewport: ({ scale }) => ({ width: 595 * scale, height: 842 * scale }),
    render: ({ canvasContext, viewport }) => {
      canvasContext.fillStyle = '#223'; canvasContext.fillRect(40, 40, viewport.width - 80, 60);
      canvasContext.font = '40px sans-serif'; canvasContext.fillText('Pagina ' + k, 60, 200);
      return { promise: Promise.resolve() };
    } }) }) }) };
}, pagine);
const UN_PDF = nome => ({ name: nome, mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n% scansione finta\n') });
/* Tutto quello che un riquadro di stato scrive, anche per un attimo. */
const registra = (p, id) => p.evaluate(id => {
  window.__stati = window.__stati || {};
  const el = document.getElementById(id), lista = window.__stati[id] = [];
  new MutationObserver(() => lista.push(el.textContent.trim())).observe(el, { childList: true, characterData: true, subtree: true });
}, id);
const stati = (p, id) => p.evaluate(id => (window.__stati && window.__stati[id]) || [], id);
const blocchiImmagine = c => (Array.isArray(c) ? c : []).filter(b => b && b.type === 'image');
/* Larghezza e altezza di un JPEG, lette dal suo segmento SOF. */
function misureJpeg(buf) {
  for (let i = 2; i < buf.length - 9;) {
    if (buf[i] !== 0xFF) { i++; continue; }
    const m = buf[i + 1], lung = buf.readUInt16BE(i + 2);
    if (m >= 0xC0 && m <= 0xC3) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    i += 2 + lung;
  }
  return null;
}

(async () => {
  browser = await apriBrowser();

  /* ── 1. SheetJS al momento ──────────────────────────────────────────── */
  await prova('1', async () => {
    if (!XLSX) throw new Error('SheetJS non è installato (npm install)');
    const srv = await serverFinti({ html: HTML, sw: SW });
    const b2 = await apriBrowser({ args: srv.args });
    try {
      const p = await b2.newPage({ serviceWorkers: 'allow', viewport: { width: 390, height: 844 } });
      p.on('pageerror', e => errori.push('PAGEERROR: ' + e.message.split('\n')[0]));
      await p.addInitScript(s => {
        if (localStorage.getItem('prova-ai')) return;
        localStorage.clear(); localStorage.setItem('geppgo2', JSON.stringify(s));
        localStorage.setItem('geppgo2_intro', '1'); localStorage.setItem('prova-ai', '1');
      }, LISBONA);
      await p.goto(srv.app + '/Index%202.1.html', { waitUntil: 'domcontentloaded' });
      await pronta(p);
      await p.evaluate(() => navigator.serviceWorker.ready);
      const cacheLib = /const CACHE_NAME = '([^']+)'/.exec(SW)[1].replace('-shell-', '-librerie-');
      const inCache = () => p.evaluate(async c => (await caches.has(c)) ? (await (await caches.open(c)).keys()).map(q => q.url) : [], cacheLib);
      /* Si aspetta che il sottofondo abbia finito il suo giro: le librerie
         di tutti i giorni in cache, e poi ancora un po'. */
      let tenute = [];
      for (let i = 0; i < 80 && tenute.length < 6; i++) { await p.waitForTimeout(500); tenute = await inCache(); }
      await p.waitForTimeout(2000);
      tenute = await inCache();
      const primaDiAprire = srv.log.filter(v => v.dove === 'cdn' && /cdn\.sheetjs\.com/.test(v.url));
      ok('1. all\'avvio e in sottofondo SheetJS non si scarica', tenute.length >= 6 && !primaDiAprire.length && !tenute.some(u => /sheetjs/.test(u)),
         `${tenute.length} librerie in sottofondo, ${primaDiAprire.length} richieste a SheetJS`);
      // si apre l'importazione dal cassetto, come farebbe una persona
      await p.evaluate(() => openSheet('mViaggi'));
      await p.waitForTimeout(400);
      await p.click('#mViaggi .vg-importa');
      await p.waitForFunction(() => LIBRERIE.xlsx.pronta(), null, { timeout: 30000, polling: 100 });
      const arrivata = srv.log.filter(v => v.dove === 'cdn' && /cdn\.sheetjs\.com/.test(v.url) && v.esito === 200);
      ok('1. aprendo l\'importazione arriva, una volta', arrivata.length === 1, arrivata.map(v => v.url.slice(8, 60)).join(' | ') || 'nessuna');
      let tenuta = false;
      for (let i = 0; i < 30 && !tenuta; i++) { await p.waitForTimeout(300); tenuta = (await inCache()).includes(SHEETJS); }
      ok('1. e resta nel telefono', tenuta, cacheLib);
      // via la rete: ne' l'app ne' le CDN rispondono
      const ws = XLSX.utils.aoa_to_sheet([['Data', 'Ora', 'Attività', 'Luogo'], ['02/11/2026', '10:00', 'Torre di Belém', 'Lisbona'], ['03/11/2026', '11:00', 'Oceanário', 'Lisbona']]);
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Viaggio');
      const file = path.join(CARTELLA, 'Lisbona.xlsx'); fs.writeFileSync(file, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
      srv.stato.giu = true; srv.stato.cdnGiu = true;
      const da = srv.log.length;
      await p.reload({ waitUntil: 'domcontentloaded' });
      await pronta(p);
      await p.evaluate(() => openImport());
      await p.waitForTimeout(300);
      await p.setInputFiles('#impFile', file);
      await p.waitForFunction(() => document.getElementById('impControlla').style.display !== 'none' || /rete|Non riesco/.test(document.getElementById('impMsg').textContent), null, { timeout: 30000, polling: 100 });
      const letto = await p.evaluate(() => ({ controlla: document.getElementById('impControlla').style.display !== 'none', msg: document.getElementById('impMsg').textContent.trim() }));
      const riuscite = srv.log.slice(da).filter(v => /sheetjs/.test(v.url || '') && v.esito === 200).length;
      ok('1. dopo il primo uso, senza rete, un file Excel si apre lo stesso', letto.controlla && !riuscite, JSON.stringify(letto));
      await p.close();
    } finally { await b2.close(); srv.chiudi(); }
  });

  /* ── 2. una porta sola ──────────────────────────────────────────────── */
  await prova('2', async () => {
    const fetchAI = [...HTML.matchAll(/fetch\(\s*(?:AI_URL|window\.GEPPGO_AI_URL|['"`]https:\/\/geppgo-ai)/g)];
    const a = HTML.search(/\nasync function aiRichiesta\(/), b = a < 0 ? -1 : a + 1 + HTML.slice(a + 1).search(/\n(async )?function [A-Za-z_$]/);
    const dentro = fetchAI.length === 1 && a > 0 && fetchAI[0].index > a && fetchAI[0].index < b;
    ok('2. verso l\'assistente parte una fetch sola, dentro chiediAI (aiRichiesta)', dentro, fetchAI.length + ' fetch verso il ponte');
    const chiamate = (HTML.match(/chiediAI\(\{/g) || []).length;
    ok('2. e le dodici richieste passano tutte da chiediAI', chiamate >= 12, chiamate + ' chiamate');
  });

  /* ── 3. tempo scaduto ───────────────────────────────────────────────── */
  await prova('3', async () => {
    const p = await apri({ orologio: true });
    const viste = await ponteFinto(p, [{ mai: true }]);
    await alReel(p);
    await p.click(TASTO_REEL);
    await partita(p);
    const spento = await p.$eval(TASTO_REEL, x => x.disabled);
    await p.clock.fastForward(29000);
    await p.waitForTimeout(200);
    const a29 = await inCorso(p);
    await p.clock.fastForward(2000);
    await aspetta(p, false, 'reel', 3000);
    const e = await esitoReel(p);
    ok('3. mentre aspetta il tasto è spento, e a 29 secondi aspetta ancora', spento && a29, JSON.stringify({ spento, a29 }));
    ok('3. a 30 secondi si ferma con un messaggio chiaro', /non ha risposto in tempo/.test(e.testo), e.testo);
    ok('3. il tasto torna attivo e l\'attesa sparisce', e.acceso && !e.pillola && !/Cerco i posti/.test(e.testo), JSON.stringify(e));
    ok('3. un tempo scaduto non si ritenta da solo', quante(viste, 'reel') === 1, quante(viste, 'reel') + ' richieste');
    // con una foto o un PDF il tempo massimo e' il doppio
    const fatta = await aMano(p, { chiave: 'prova-file', conFile: true, attesa: 'nessuna', domanda: 'x' });
    await p.waitForTimeout(200);
    await p.clock.fastForward(31000);
    await p.waitForTimeout(200);
    const a31 = fatta && await p.evaluate(() => window.__esito);
    await p.clock.fastForward(30000);
    await p.waitForTimeout(300);
    const a61 = fatta && await p.evaluate(() => window.__esito);
    ok('3. con una foto o un PDF il tempo massimo è 60 secondi', a31 === 'in corso' && a61 && a61.errore === 'tempo', fatta ? JSON.stringify({ a31, a61 }) : 'chiediAI non c\'è');
    await p.close();
  });

  /* ── 4. senza rete ──────────────────────────────────────────────────── */
  await prova('4', async () => {
    const p = await apri();
    const partite = [];
    p.on('request', q => { if (PONTE.test(q.url())) partite.push(q.method()); });
    await ponteFinto(p, [{ testo: POSTI }]);
    await alReel(p);
    await p.context().setOffline(true);
    const t0 = Date.now();
    await p.click(TASTO_REEL);
    let e;
    do { await p.waitForTimeout(50); e = await esitoReel(p); } while (Date.now() - t0 < 5000 && (!e.testo || /Cerco i posti/.test(e.testo)));
    const ms = Date.now() - t0;
    ok('4. senza rete il messaggio arriva subito', ms < 1500 && /senza rete/i.test(e.testo) && /Riprova quando torna la connessione/.test(e.testo), ms + ' ms: ' + e.testo);
    ok('4. e il tasto resta attivo', e.acceso);
    await allaChat(p);
    await p.fill('#chatInput', 'Cosa vediamo la sera?');
    await p.click(TASTO_CHAT);
    await p.waitForTimeout(500);
    const chat = await testoChat(p);
    ok('4. anche in chat: il messaggio, subito', /senza rete/i.test(chat), chat.slice(-120));
    ok('4. e nessuna richiesta parte', partite.length === 0, partite.length + ' richieste');
    await p.context().setOffline(false);
    await p.close();
  });

  /* ── 5. errori del server ───────────────────────────────────────────── */
  await prova('5', async () => {
    const p = await apri();
    await alReel(p);
    let viste = await ponteFinto(p, [{ status: 500, errore: 'Internal error' }, { testo: POSTI }]);
    await p.click(TASTO_REEL); await finito(p);
    let e = await esitoReel(p);
    ok('5. un 500 e poi una risposta buona: riesce il secondo tentativo', quante(viste, 'reel') === 2 && /2 posti trovati/.test(e.testo), quante(viste, 'reel') + ' richieste: ' + e.testo.slice(0, 60));
    viste = await ponteFinto(p, [{ status: 429, errore: 'Too Many Requests' }, { testo: POSTI }]);
    await p.click(TASTO_REEL); await finito(p);
    e = await esitoReel(p);
    ok('5. un 429: nessun secondo tentativo', quante(viste, 'reel') === 1, quante(viste, 'reel') + ' richieste');
    ok('5. e «L\'assistente è molto richiesto: riprova fra qualche minuto»', /L'assistente è molto richiesto: riprova fra qualche minuto/.test(e.testo) && e.acceso, e.testo);
    /* Il ponte vecchio, quando la quota del servizio di prima era finita,
       rispondeva 502 col messaggio del servizio dentro: e' la stessa coda, e
       vale lo stesso, finche' su Cloudflare non c'e' il ponte nuovo. */
    viste = await ponteFinto(p, [{ status: 502, errore: 'You exceeded your current quota, please check your plan and billing details. Please retry in 21.3s.' }, { testo: POSTI }]);
    await p.click(TASTO_REEL); await finito(p);
    e = await esitoReel(p);
    ok('5. la quota finita col ponte vecchio (un 502): niente secondo tentativo, stesso messaggio', quante(viste, 'reel') === 1 && /molto richiesto/.test(e.testo), quante(viste, 'reel') + ' richieste: ' + e.testo);
    viste = await ponteFinto(p, [{ cade: true }, { testo: POSTI }]);
    await p.click(TASTO_REEL); await finito(p);
    e = await esitoReel(p);
    ok('5. la connessione che cade e poi torna: riesce il secondo tentativo', quante(viste, 'reel') === 2 && /2 posti trovati/.test(e.testo), quante(viste, 'reel') + ' richieste: ' + e.testo.slice(0, 60));
    await p.close();
  });

  /* ── 6. due tocchi ──────────────────────────────────────────────────── */
  await prova('6', async () => {
    const p = await apri();
    await alReel(p);
    let viste = await ponteFinto(p, [{ testo: POSTI, dopo: 700 }]);
    await p.dblclick(TASTO_REEL);
    await p.waitForTimeout(150);
    await finito(p);
    const e = await esitoReel(p);
    ok('6. un doppio tocco sul tasto: una richiesta sola', quante(viste, 'reel') === 1 && /2 posti trovati/.test(e.testo), quante(viste, 'reel') + ' richieste');
    // due chiamate di fila senza tasto: conta la chiave della richiesta
    await p.evaluate(() => { extractPlaces(); extractPlaces(); });
    await p.waitForTimeout(150);
    await finito(p);
    ok('6. due chiamate di fila dal codice: una richiesta sola', quante(viste, 'reel') === 2, quante(viste, 'reel') - 1 + ' richieste in più');
    // in chat la seconda domanda aspetta la prima, e resta nel campo
    viste = await ponteFinto(p, [{ testo: 'Il Miradouro da Senhora do Monte, al tramonto.', dopo: 900 }]);
    await allaChat(p);
    await p.fill('#chatInput', 'Cosa vediamo la sera?');
    await p.click(TASTO_CHAT);
    await p.waitForTimeout(100);
    await p.fill('#chatInput', 'E domani mattina?');
    await p.click(TASTO_CHAT);
    await finito(p, 'chat');
    const campo = await p.inputValue('#chatInput');
    ok('6. in chat una seconda domanda mentre la prima aspetta non parte, e resta nel campo', quante(viste, 'chat') === 1 && campo === 'E domani mattina?', quante(viste, 'chat') + ' richieste, nel campo: ' + campo);
    await p.close();
  });

  /* ── 7. «Annulla» ───────────────────────────────────────────────────── */
  await prova('7', async () => {
    const p = await apri({ orologio: true });
    const lasciate = [];
    p.on('requestfailed', q => { if (PONTE.test(q.url())) lasciate.push((q.failure() || {}).errorText); });
    const viste = await ponteFinto(p, [{ mai: true }]);
    await alReel(p);
    await p.click(TASTO_REEL);
    await partita(p);
    const vedi = () => p.evaluate(() => {
      const el = document.getElementById('aiAttesa'), b = el && el.querySelector('.ai-annulla');
      return { on: !!(el && el.classList.contains('on')), annulla: !!(b && getComputedStyle(b).display !== 'none'), testo: el ? el.textContent.trim() : '' };
    });
    await p.clock.fastForward(9000); await p.waitForTimeout(200);
    const a9 = await vedi();
    await p.clock.fastForward(1500); await p.waitForTimeout(200);
    const a10 = await vedi();
    ok('7. prima dei dieci secondi «Annulla» non c\'è', !a9.annulla, JSON.stringify(a9));
    ok('7. dopo dieci secondi compare, con «Ci sta mettendo più del solito…»', a10.on && a10.annulla && /più del solito/.test(a10.testo), JSON.stringify(a10));
    if (a10.annulla) await p.click('#aiAttesa .ai-annulla');
    await aspetta(p, false, 'reel', 3000);
    await p.waitForTimeout(300);
    const e = await esitoReel(p);
    ok('7. toccato «Annulla» la richiesta si ferma: «Richiesta annullata.»', /Richiesta annullata/.test(e.testo) && e.acceso && !e.pillola, JSON.stringify(e));
    ok('7. e il browser la lascia davvero andare, senza ritentarla', lasciate.length >= 1 && quante(viste, 'reel') === 1, JSON.stringify({ lasciate, richieste: quante(viste, 'reel') }));
    // un'attesa senza un segno suo (la pillola in alto) si vede subito
    const fatta = await aMano(p, { chiave: 'prova-globale', attesa: 'globale', domanda: 'x' });
    await p.waitForTimeout(200);
    const subito = await vedi();
    await p.clock.fastForward(10500); await p.waitForTimeout(200);
    if ((await vedi()).annulla) await p.click('#aiAttesa .ai-annulla');
    await p.waitForTimeout(300);
    const g = fatta && await p.evaluate(() => window.__esito);
    ok('7. se chi chiama non ha un segno d\'attesa suo, la pillola c\'è da subito, «Annulla» dopo dieci secondi', subito.on && !subito.annulla && /sta pensando/.test(subito.testo) && g && g.errore === 'annullata', fatta ? JSON.stringify({ subito, g }) : 'chiediAI non c\'è');
    await p.close();
  });

  /* ── 8. il JSON ─────────────────────────────────────────────────────── */
  await prova('8', async () => {
    const p = await apri();
    await alReel(p);
    let viste = await ponteFinto(p, [{ testo: 'Ecco i posti che ho trovato:\n```json\n' + POSTI + '\n```\nBuon viaggio!' }]);
    await p.click(TASTO_REEL); await finito(p);
    let e = await esitoReel(p);
    ok('8. il JSON fra ``` si legge', quante(viste, 'reel') === 1 && /2 posti trovati/.test(e.testo), e.testo.slice(0, 60));
    const conGraffe = JSON.stringify({ posti: [{ nome: 'Time Out Market', query: 'Time Out Market, Lisbona', perche: 'Si mangia di tutto {anche tardi}.' }, { nome: 'Alfama', query: 'Alfama, Lisbona', perche: 'Fado la sera.' }] });
    viste = await ponteFinto(p, [{ testo: 'Certo! ' + conGraffe + ' Fammi sapere se ne vuoi altri {di sera}.' }]);
    await p.click(TASTO_REEL); await finito(p);
    e = await esitoReel(p);
    ok('8. con una frase prima e dopo, e graffe dentro le frasi, si legge', quante(viste, 'reel') === 1 && /2 posti trovati/.test(e.testo) && /Time Out Market/.test(e.testo), e.testo.slice(0, 60));
    viste = await ponteFinto(p, [{ testo: '{"posti":[{"nome":"Pastéis de Belém","query":' }, { testo: POSTI }]);
    await p.click(TASTO_REEL); await finito(p);
    e = await esitoReel(p);
    const seconda = (viste.filter(v => v.tipo === 'reel')[1] || {}).corpo || { messages: [] };
    const coda = seconda.messages.slice(-2);
    ok('8. un JSON rotto si chiede di nuovo, una volta, mostrando quello che ha scritto', quante(viste, 'reel') === 2 && /2 posti trovati/.test(e.testo)
       && coda.length === 2 && coda[0].role === 'assistant' && /Pastéis/.test(coda[0].content) && coda[1].role === 'user' && /solo come JSON/.test(coda[1].content), quante(viste, 'reel') + ' richieste');
    viste = await ponteFinto(p, [{ testo: 'Non saprei, mi dispiace.' }, { testo: 'Ancora niente.' }]);
    await p.click(TASTO_REEL); await finito(p);
    e = await esitoReel(p);
    ok('8. rotto due volte: niente terzo tentativo, e un messaggio chiaro', quante(viste, 'reel') === 2 && /La risposta dell'assistente non si legge: riprova fra poco/.test(e.testo) && e.acceso, quante(viste, 'reel') + ' richieste: ' + e.testo);
    const casi = await p.evaluate(() => typeof aiLeggiJSON !== 'function' ? ['aiLeggiJSON non c\'è'] : [
      aiLeggiJSON('```json\n{"a":1}\n```'), aiLeggiJSON('Ecco: {"a":"x}y"} e basta'), aiLeggiJSON('[1,2,3] fine'),
      aiLeggiJSON('{"a":1} poi {"b":2}'), aiLeggiJSON('{"a":"di\\"ce {"} ok'), aiLeggiJSON('niente da leggere')
    ].map(x => JSON.stringify(x)));
    const attesi = ['{"a":1}', '{"a":"x}y"}', '[1,2,3]', '{"a":1}', '{"a":"di\\"ce {"}', 'null'];
    ok('8. la lettura regge anche i casi storti', JSON.stringify(casi) === JSON.stringify(attesi), casi.join(' '));
    await p.close();
  });

  /* ── 9. la lingua ───────────────────────────────────────────────────── */
  await prova('9', async () => {
    ok('9. «Rispondi SEMPRE in italiano» non c\'è più', !/Rispondi SEMPRE in italiano/i.test(HTML));
    const p = await apri({ lingua: 'en' });
    let viste = await ponteFinto(p, [{ testo: 'Go to the Miradouro da Senhora do Monte at sunset.' }]);
    await allaChat(p);
    await p.fill('#chatInput', 'What should we see in the evening?');
    await p.click(TASTO_CHAT);
    await finito(p, 'chat');
    const chat = (viste.find(v => v.tipo === 'chat') || {}).corpo || {};
    ok('9. con l\'app in inglese la chat chiede la risposta in inglese', /Rispondi in inglese \(English\)/.test(chat.system || ''), String(chat.system || '').split('\n').pop().slice(0, 90));
    ok('9. e i nomi dei luoghi restano quelli originali', /nomi dei luoghi lasciali come sono/.test(chat.system || ''));
    viste = await ponteFinto(p, [{ testo: POSTI }]);
    await alReel(p);
    await p.click(TASTO_REEL); await finito(p);
    const reel = (viste.find(v => v.tipo === 'reel') || {}).corpo || {};
    ok('9. anche le richieste che vogliono un JSON chiedono l\'inglese', /Rispondi in inglese \(English\)/.test(reel.system || '') && !/in italiano/.test(testoDi(reel.messages)), String(reel.system || '').slice(0, 60));
    await p.close();
    const es = await apri({ lingua: 'es' });
    viste = await ponteFinto(es, [{ testo: POSTI }]);
    await alReel(es);
    await es.click(TASTO_REEL); await finito(es);
    const spagnolo = ((viste.find(v => v.tipo === 'reel') || {}).corpo || {}).system || '';
    await es.close();
    const it = await apri();
    viste = await ponteFinto(it, [{ testo: POSTI }]);
    await alReel(it);
    await it.click(TASTO_REEL); await finito(it);
    const italiano = ((viste.find(v => v.tipo === 'reel') || {}).corpo || {}).system || '';
    await it.close();
    ok('9. in spagnolo lo spagnolo, in italiano l\'italiano', /Rispondi in spagnolo \(español\)/.test(spagnolo) && /Rispondi in italiano:/.test(italiano), [spagnolo, italiano].map(s => s.slice(0, 40)).join(' | '));
  });

  /* ── 10. niente Anthropic ───────────────────────────────────────────── */
  await prova('10', async () => {
    ok('10. nessun indirizzo api.anthropic.com', !/api\.anthropic\.com/i.test(HTML));
    ok('10. nessun modello «claude-»', !/claude-/i.test(HTML));
    const conModello = tutte.filter(v => v.corpo && 'model' in v.corpo).length;
    ok('10. e le richieste al ponte non nominano un modello: lo sceglie il ponte', tutte.length > 10 && !conModello, `${conModello} su ${tutte.length}`);
  });

  /* ── 11. la privacy ─────────────────────────────────────────────────── */
  await prova('11', async () => {
    const pv = PRIVACY.replace(/<[^>]+>/g, '');
    ok('11. la privacy nomina Cloudflare Workers AI, attraverso il ponte di GeppGo, e Gemini non c\'è più', /Cloudflare Workers AI/.test(pv) && /ponte di GeppGo/.test(pv) && !/Gemini/i.test(pv));
    ok('11. dice che Cloudflare non usa quello che gli si manda per addestrare modelli', /non usa quello che gli mandiamo[^.]*per addestrare modelli/i.test(pv));
    ok('11. nomina Tavily, e dice che le sue condizioni gli permettono di usare le ricerche per migliorare i suoi modelli',
       /Tavily/.test(pv) && /condizioni di Tavily gli permettono[^.]*migliorare i suoi modelli/i.test(pv));
    ok('11. e che a Tavily vanno solo posti, destinazione, date: mai persone o recapiti', /mai nomi di persone, email, telefoni/i.test(pv));
    ok('11. dice che un PDF scansionato parte come immagini, da cui niente si può togliere', /PDF scansionato/i.test(pv) && /immagin[ei][^.]*non può togliere/i.test(pv));
    ok('11. e consiglia di non mandare all\'assistente dati sensibili', /Non mandare all'assistente dati sensibili/i.test(pv));
    ok('11. e non dice più che l\'assistente legge i biglietti', !/leggere i biglietti|foto di un biglietto/i.test(PRIVACY));
  });

  /* ── 12. i testi nuovi in cinque lingue ─────────────────────────────── */
  await prova('12', async () => {
    const FRASI = [
      'Sei senza rete: l\'assistente ha bisogno di internet. Riprova quando torna la connessione.',
      'L\'assistente non ha risposto in tempo: riprova fra poco.',
      'Richiesta annullata.',
      'L\'assistente è molto richiesto: riprova fra qualche minuto',
      'L\'assistente non è disponibile in questo momento: riprova più tardi.',
      'L\'assistente non è raggiungibile: controlla la rete e riprova.',
      'L\'assistente non ha risposto: riprova fra poco.',
      'La risposta dell\'assistente non si legge: riprova fra poco.',
      'Ci sta mettendo più del solito…',
      '✦ L\'assistente sta pensando…',
      'Annulla',
      'Questa immagine non si apre: prova con uno screenshot',
      'La richiesta è troppo grande per l\'assistente: prova con meno testo o con meno pagine.',
      'L\'assistente ha raggiunto il limite di oggi: torna disponibile alle {1}.',
      'L\'assistente ha raggiunto il limite di oggi: torna disponibile domani alle {1}.',
      'La ricerca sul web non è attiva: rispondo con quello che so.',
      'Le ricerche sul web di questo mese sono finite: rispondo con quello che so.',
      'La ricerca sul web non ha risposto: rispondo con quello che so.',
      'È una scansione: leggo la pagina come immagine.',
      'È una scansione: leggo le prime {1} pagine come immagini.',
      'Controllo i posti sulla mappa...',
      'Attività aggiunte: {1}',
      'Con l\'indirizzo verificato: {1}',
      'Da controllare, non trovate sulla mappa: {1}',
      'Dalla scansione non riesco a leggere la prenotazione: copia e incolla il testo della mail.'
    ];
    const p = await apri({ lingua: 'fr' });
    const mancano = await p.evaluate(frasi => {
      const out = [];
      ['en', 'es', 'fr', 'pt'].forEach(l => frasi.forEach(f => { const v = DIZIONARIO[l] && DIZIONARIO[l][f]; if (!v || v === f) out.push(l + ': ' + f); }));
      return out;
    }, FRASI);
    ok('12. i testi nuovi ci sono in inglese, spagnolo, francese e portoghese', !mancano.length, mancano.slice(0, 4).join(' | ') || FRASI.length + ' frasi × 4 lingue');
    await ponteFinto(p, [{ testo: POSTI }]);
    await alReel(p);
    await p.context().setOffline(true);
    await p.click(TASTO_REEL);
    await p.waitForTimeout(400);
    const fr = await esitoReel(p);
    const atteso = await p.evaluate(() => DIZIONARIO.fr['Sei senza rete: l\'assistente ha bisogno di internet. Riprova quando torna la connessione.']);
    ok('12. e a schermo arrivano tradotti (l\'app in francese, senza rete)', !!atteso && fr.testo.includes(atteso), fr.testo);
    await p.context().setOffline(false);
    await ponteFinto(p, [{ mai: true }]);
    await aMano(p, { chiave: 'prova-pillola', attesa: 'globale', domanda: 'x' });
    await p.waitForTimeout(300);
    const pillola = await p.evaluate(() => (document.getElementById('aiAttesa') || {}).textContent || '');
    const pensa = await p.evaluate(() => DIZIONARIO.fr['✦ L\'assistente sta pensando…']);
    ok('12. anche l\'attesa', !!pensa && pillola.includes(pensa), pillola.trim());
    await p.close();
  });

  /* ── 13. a Tavily solo posti, destinazione e date ───────────────────── */
  await prova('13', async () => {
    const p = await apri({ stato: PRIVATO });
    let viste = await ponteFinto(p, [{ testo: 'Domani apre alle 10:00.' }]);
    await allaChat(p);
    await p.fill('#chatInput', DOMANDA_PRIVATA);
    await p.click(TASTO_CHAT);
    await finito(p, 'chat');
    const corpo = (viste.find(v => v.tipo === 'chat') || {}).corpo || {};
    const ric = corpo.ricerca || null;
    ok('13. la chat dice al ponte cosa si può cercare: i posti sulla mappa, la destinazione, le date', !!ric && ric.scopo === 'chat'
       && JSON.stringify((ric.luoghi || []).slice().sort()) === JSON.stringify(['Hotel Avenida Palace', 'Oceanário de Lisboa', 'Torre di Belém'])
       && ric.destinazione === 'Lisbona' && JSON.stringify(ric.date) === '["2026-11-02","2026-11-03"]', JSON.stringify(ric));
    ok('13. e nell\'elenco non c\'è niente di personale: compagni, email, telefoni, numeri lunghi, promemoria',
       !!ric && !personali(JSON.stringify(ric)).length, ric ? (personali(JSON.stringify(ric)).join(', ') || 'niente') : 'nessun elenco');
    /* La stessa richiesta, al ponte vero, con un modello che nella riga
       CERCA ci mette nome, email e telefono di chi scrive. */
    let vero = null;
    if (ric) vero = await alPonteVero(corpo, ['CERCA: orari | Torre di Belém, ' + DOMANDA_PRIVATA + ' | 2026-11-03', 'Domani apre alle 10:00 (torrebelem.gov.pt).']);
    const q = vero ? vero.ricevute.map(x => x.query) : [];
    ok('13. passata al ponte vero, a Tavily arriva solo «luogo destinazione argomento data»', !!vero && q.length === 1
       && q[0] === 'Torre di Belém Lisbona opening hours 2026-11-03' && !personali(JSON.stringify(vero.ricevute)).length && vero.risposta.ricerca === 'fatta',
       vero ? JSON.stringify(q) + ' ' + (personali(JSON.stringify(vero.ricevute)).join(', ') || '') : 'nessun elenco');
    // «serve prenotare?»: il nome della tappa va alla ricerca solo se è un posto senza persone
    viste = await ponteFinto(p, [{ testo: '{"prenotare":"no","giorni_prima":0,"motivo":"","sito":""}' }]);
    for (const id of [501, 502]) await p.evaluate(id => { adRef = { di: 0, id }; return doCheckBooking(); }, id);
    const pr = viste.filter(v => v.tipo === 'prenotare').map(v => v.corpo.ricerca || null);
    ok('13. «serve prenotare?» per la Torre di Belém: la tappa, la destinazione, il giorno', !!pr[0] && pr[0].scopo === 'prenotare'
       && JSON.stringify(pr[0].luoghi) === '["Torre di Belém"]' && pr[0].destinazione === 'Lisbona' && JSON.stringify(pr[0].date) === '["2026-11-02"]', JSON.stringify(pr[0]));
    ok('13. per «Cena da Marco» il nome resta fuori: solo destinazione e giorno', !!pr[1] && JSON.stringify(pr[1].luoghi) === '[]'
       && pr[1].destinazione === 'Lisbona' && !personali(JSON.stringify(pr[1])).length, JSON.stringify(pr[1]));
    const tutteQ = [];
    for (const c of viste.filter(v => v.tipo === 'prenotare')) {
      const x = await alPonteVero(c.corpo, ['{"prenotare":"no","giorni_prima":0,"motivo":"","sito":""}']);
      x.ricevute.forEach(y => tutteQ.push(y.query));
    }
    ok('13. e dal ponte vero, per le due tappe, a Tavily non arriva nessun nome', tutteQ.length === 2 && tutteQ[0] === 'Torre di Belém Lisbona tickets booking reservation required 2026-11-02'
       && tutteQ[1] === 'Lisbona tickets booking reservation required 2026-11-02', JSON.stringify(tutteQ));
    await p.close();
  });

  /* ── 14. la ricerca che non c'è si dice ─────────────────────────────── */
  await prova('14', async () => {
    const p = await apri();
    await allaChat(p);
    const note = async (passo, domanda) => {
      await ponteFinto(p, [passo]);
      const prima = await p.$$eval('#chatMsgs .msg.nota', x => x.length);
      await p.fill('#chatInput', domanda);
      await p.click(TASTO_CHAT);
      await finito(p, 'chat');
      await p.waitForTimeout(200);
      return (await p.$$eval('#chatMsgs .msg.nota', x => x.map(e => e.textContent.trim()))).slice(prima);
    };
    const nc = await note({ testo: 'Apre alle 10:00, credo.', ricerca: 'non_configurata' }, 'A che ora apre la Torre di Belém?');
    /* La riga sta sotto la risposta: sopra, con la chat che scorre in fondo,
       restava fuori vista. */
    const inFondo = await p.$eval('#chatMsgs', b => { const ms = [...b.querySelectorAll('.msg')]; return ms.slice(-2).map(m => m.className + ': ' + m.textContent.trim().slice(0, 30)); });
    const cf = await note({ testo: 'Di solito apre alle 10:00.', ricerca: 'crediti_finiti' }, 'E il Mosteiro dos Jerónimos?');
    const ft = await note({ testo: 'Apre alle 10:00 (torrebelem.gov.pt).', ricerca: 'fatta' }, 'E domenica?');
    const vecchio = await note({ testo: 'Apre alle 10:00.' }, 'E lunedì?');
    const risposte = await testoChat(p);
    ok('14. ricerca non attiva: la risposta arriva, con una riga che lo dice', nc.length === 1 && /La ricerca sul web non è attiva: rispondo con quello che so/.test(nc[0])
       && /Apre alle 10:00, credo/.test(risposte), JSON.stringify(nc));
    ok('14. e la riga sta sotto la risposta, in fondo alla chat, dove si legge', inFondo.length === 2 && /Apre alle 10:00, credo/.test(inFondo[0]) && /\bnota\b/.test(inFondo[1]), JSON.stringify(inFondo));
    ok('14. crediti del mese finiti: idem', cf.length === 1 && /Le ricerche sul web di questo mese sono finite/.test(cf[0]), JSON.stringify(cf));
    ok('14. ricerca fatta, o un ponte vecchio che non lo dice: nessuna riga in più', !ft.length && !vecchio.length, JSON.stringify([ft, vecchio]));
    await ponteFinto(p, [{ testo: '{"prenotare":"consigliata","giorni_prima":2,"motivo":"In alta stagione c\'è coda.","sito":""}', ricerca: 'non_riuscita' }]);
    await p.evaluate(() => { adRef = { di: 0, id: 501 }; return doCheckBooking(); });
    const hint = await p.$eval('#adBookHint', x => x.textContent);
    ok('14. anche «serve prenotare?» dice che la ricerca non ha risposto', /Prenotazione consigliata/.test(hint) && /La ricerca sul web non ha risposto/.test(hint), hint);
    await p.close();
  });

  /* ── 15. la quota finita, con l'ora del ritorno ─────────────────────── */
  await prova('15', async () => {
    const p = await apri({ orologio: true, ora: '2026-10-08T15:00:00Z', fuso: 'Europe/Rome' });
    await alReel(p);
    let viste = await ponteFinto(p, [{ status: 429, tipo: 'quota_finita', errore: 'quota gratuita del giorno finita', riprova_alle: '2026-10-09T00:00:00.000Z' }, { testo: POSTI }]);
    await p.click(TASTO_REEL); await finito(p);
    let e = await esitoReel(p);
    ok('15. quota finita: «torna disponibile domani alle 02:00», nell\'ora del telefono', /L'assistente ha raggiunto il limite di oggi: torna disponibile domani alle 02:00\./.test(e.testo) && e.acceso, e.testo);
    ok('15. e nessun secondo tentativo', quante(viste, 'reel') === 1, quante(viste, 'reel') + ' richieste');
    viste = await ponteFinto(p, [{ status: 429, tipo: 'quota_finita', errore: 'quota', riprova_alle: '2026-10-08T18:30:00.000Z' }]);
    await p.click(TASTO_REEL); await finito(p);
    e = await esitoReel(p);
    ok('15. se torna in giornata: «alle 20:30»', /torna disponibile alle 20:30\./.test(e.testo), e.testo);
    await p.close();
    const en = await apri({ orologio: true, ora: '2026-10-08T15:00:00Z', fuso: 'Europe/Rome', lingua: 'en' });
    await alReel(en);
    await ponteFinto(en, [{ status: 429, tipo: 'quota_finita', errore: 'quota', riprova_alle: '2026-10-09T00:00:00.000Z' }]);
    await en.click(TASTO_REEL); await finito(en);
    e = await esitoReel(en);
    ok('15. con l\'app in inglese, in inglese', /today’s limit: it’s back tomorrow at 0?2:00/.test(e.testo), e.testo);
    await en.close();
  });

  /* ── 16. troppo grande ──────────────────────────────────────────────── */
  await prova('16', async () => {
    const p = await apri();
    await alReel(p);
    const viste = await ponteFinto(p, [{ status: 413, tipo: 'troppo_grande', errore: 'immagine troppo grande' }, { testo: POSTI }]);
    await p.click(TASTO_REEL); await finito(p);
    const e = await esitoReel(p);
    ok('16. una richiesta troppo grande: la sua frase, e nessun secondo tentativo', /La richiesta è troppo grande per l'assistente: prova con meno testo o con meno pagine/.test(e.testo)
       && quante(viste, 'reel') === 1 && e.acceso, quante(viste, 'reel') + ' richieste: ' + e.testo);
    await p.close();
  });

  /* ── 17. gli orari da OpenStreetMap ─────────────────────────────────── */
  await prova('17', async () => {
    const ORARI = JSON.parse(JSON.stringify(LISBONA));
    ORARI.trips[0].days[0].activities.push(tappa(502, 'Museu Nacional do Azulejo', null, null));
    ORARI.trips[0].days[1].activities.push(tappa(503, 'Torre di Belém', 38.6916, -9.2160));
    const p = await apri({ stato: ORARI });
    const viste = await ponteFinto(p, [{ testo: '{"orari":[]}' }]);
    const chieste = await mappaFinta(p, q => /Bel[ée]m/i.test(q) ? [
        { lat: '41.1496', lon: '-8.6109', display_name: 'Torre di Belém (copia), Porto', importance: 0.6, class: 'tourism', type: 'attraction', extratags: { opening_hours: 'Mo-Su 09:00-20:00' } },
        { lat: '38.6916', lon: '-9.2160', display_name: 'Torre de Belém, Avenida Brasília, Lisboa', importance: 0.5, class: 'tourism', type: 'attraction', extratags: { opening_hours: 'Tu-Su 10:00-18:30; Mo off' } }]
      : /Azulejo/i.test(q) ? [{ lat: '38.7247', lon: '-9.1135', display_name: 'Museu Nacional do Azulejo, Lisboa', importance: 0.5, class: 'tourism', type: 'museum', extratags: { opening_hours: 'Tu-Su 10:00-18:00' } }]
      : []);
    const esito = await p.evaluate(async () => {
      const t = T();
      await verificaOrari(t, t.days[0]);
      await verificaOrari(t, t.days[1]);
      return t.days.map(d => d.activities.map(a => a.name + ': ' + (a.hours || '—')));
    });
    ok('17. lunedì la Torre è chiusa (quella vicina alla tappa, non la copia a Porto), il museo pure; martedì apre alle 10:00',
       JSON.stringify(esito) === JSON.stringify([['Torre di Belém: chiuso il lunedì', 'Museu Nacional do Azulejo: chiuso il lunedì'], ['Torre di Belém: 10:00-18:30']]), JSON.stringify(esito));
    ok('17. a OpenStreetMap va il nome del posto con la città, e si chiede il campo degli orari', chieste.length === 3
       && chieste.every(c => c.extratags === '1') && chieste[0].q === 'Torre di Belém, Lisbona' && chieste[1].q === 'Museu Nacional do Azulejo, Lisbona', JSON.stringify(chieste));
    ok('17. e l\'assistente non viene chiamato', viste.length === 0, viste.length + ' richieste');
    const casi = await p.evaluate(() => typeof orariDelGiorno !== 'function' ? ['orariDelGiorno non c\'è'] : [
      orariDelGiorno('Mo-Fr 09:00-18:00; Sa 10:00-14:00; Su off', new Date('2026-11-07T12:00:00')),
      orariDelGiorno('24/7', new Date('2026-11-07T12:00:00')),
      orariDelGiorno('Apr-Oct: Tu-Su 10:00-18:30; Nov-Mar: Tu-Su 10:00-17:30', new Date('2026-11-03T12:00:00')),
      orariDelGiorno('Mo-Su 10:00-13:00,14:00-18:00', new Date('2026-11-04T12:00:00')),
      orariDelGiorno('Mo-Sa 08:00-20:00; PH off', new Date('2026-11-08T12:00:00')),
      orariDelGiorno('sunrise-sunset', new Date('2026-11-08T12:00:00')),
      orariDelGiorno('Tu-Su 10:00-18:00', new Date('2026-11-02T12:00:00'))]);
    const attesi = ['10:00-14:00', 'sempre aperto', '10:00-17:30', '10:00-13:00, 14:00-18:00', 'chiuso la domenica', 'sunrise-sunset', 'chiuso il lunedì'];
    ok('17. gli orari di OpenStreetMap si leggono nelle forme di tutti i giorni, e le altre restano come sono', JSON.stringify(casi) === JSON.stringify(attesi), casi.join(' | '));
    await p.close();
  });

  /* ── 18. i posti di una lista, sulla mappa ──────────────────────────── */
  await prova('18', async () => {
    const p = await apri();
    const viste = await ponteFinto(p, [{ testo: '{"posti":[]}' }]);
    await mappaFinta(p, q => /Torre Belem/i.test(q) ? [{ lat: '38.6916', lon: '-9.2160', display_name: 'Torre de Belém, Avenida Brasília, Belém, Lisboa, Portugal', importance: 0.6, class: 'tourism', type: 'attraction' }] : []);
    await p.evaluate(() => { ttDay = 1; openImportDay(); });
    await p.waitForTimeout(500);
    await registra(p, 'dayImportStatus');
    await p.fill('#dayImportText', 'Torre Belem 10:00\nUn posto che non esiste da nessuna parte 12:30');
    await p.click('#dayImportBtn');
    await p.waitForFunction(() => /\.$/.test(document.getElementById('dayImportStatus').textContent.trim()) && !dayImportBusy, null, { timeout: 30000 });
    const fine = await p.evaluate(() => ({ stato: document.getElementById('dayImportStatus').textContent.trim(),
      tappe: T().days[1].activities.map(a => ({ name: a.name, lat: a.lat, lng: a.lng, notes: a.notes, time: a.time })) }));
    const passati = await stati(p, 'dayImportStatus');
    const [torre, ignoto] = fine.tappe;
    ok('18. il posto trovato entra col nome della mappa, la posizione e l\'indirizzo', !!torre && torre.name === 'Torre de Belém' && Math.abs(torre.lat - 38.6916) < 1e-6
       && /Avenida Brasília/.test(torre.notes) && torre.time === '10:00', JSON.stringify(torre));
    ok('18. quello che la mappa non conosce entra lo stesso, senza posizione', !!ignoto && ignoto.lat == null && ignoto.time === '12:30', JSON.stringify(ignoto));
    ok('18. e il riepilogo lo dice, a frasi intere', /Attività aggiunte: 2/.test(fine.stato) && /Con l'indirizzo verificato: 1/.test(fine.stato)
       && /Da controllare, non trovate sulla mappa: 1/.test(fine.stato) && passati.some(x => /Controllo i posti sulla mappa/.test(x)), fine.stato);
    ok('18. e l\'assistente non viene chiamato', viste.length === 0, viste.length + ' richieste');
    await p.close();
  });

  /* ── 19. i PDF scansionati ──────────────────────────────────────────── */
  await prova('19', async () => {
    const p = await apri();
    await mappaFinta(p, () => []);
    // la valigia: tre pagine su cinque, come immagini
    let viste = await ponteFinto(p, [{ testo: '{"voci":[{"nome":"Caricabatterie","cat":"Elettronica"},{"nome":"Crema solare","cat":"Igiene"}]}', dopo: 400 }]);
    await pdfFinto(p, 5);
    await registra(p, 'packImportStatus');
    await p.setInputFiles('#packPdf', UN_PDF('lista-scansionata.pdf'));
    await p.waitForFunction(() => /✅|⚠️/.test(document.getElementById('packImportStatus').textContent), null, { timeout: 20000 });
    const valigia = (viste.find(v => v.tipo === 'bagagli') || {}).corpo || { messages: [{}] };
    const cv = valigia.messages[0].content, iv = blocchiImmagine(cv);
    const sv = await stati(p, 'packImportStatus');
    ok('19. valigia da una scansione: partono le prime tre pagine, JPEG, prima della domanda', iv.length === 3
       && iv.every(b => b.source && b.source.type === 'base64' && b.source.media_type === 'image/jpeg' && /^\/9j\//.test(b.source.data))
       && cv[cv.length - 1].type === 'text' && /PDF scansionato/.test(cv[cv.length - 1].text), iv.length + ' immagini');
    ok('19. e lo dice mentre legge, poi mette le voci', sv.some(x => /È una scansione: leggo le prime 3 pagine come immagini/.test(x))
       && /✅/.test(sv[sv.length - 1] || ''), sv.slice(-2).join(' / '));
    // l'albergo: una pagina sola, la sua frase
    await p.evaluate(() => apriMailHotel());
    await p.waitForTimeout(400);
    viste = await ponteFinto(p, [{ testo: JSON.stringify({ struttura: 'Hotel Avenida Palace', indirizzo: 'Rua 1º de Dezembro 123', citta: 'Lisboa', paese: 'Portugal',
      checkin: '2026-11-02', checkout: '2026-11-03', oraCheckin: '15:00', oraCheckout: '11:00', codice: 'AB12CD', costo: 240, valuta: 'EUR', ospiti: 2, camera: '', telefono: '' }), dopo: 400 }]);
    await pdfFinto(p, 1);
    await registra(p, 'mhStato');
    await p.setInputFiles('#mhPdf', UN_PDF('voucher.pdf'));
    await p.waitForFunction(() => /Controlla e correggi|⚠️/.test(document.getElementById('mhStato').textContent), null, { timeout: 30000 });
    const alb = (viste.find(v => v.tipo === 'alloggio') || {}).corpo || { messages: [{}] };
    const ca = alb.messages[0].content, ia = blocchiImmagine(ca);
    const sa = await stati(p, 'mhStato');
    // il nome sta in un campo da correggere, non nel testo della scheda
    const anteprima = await p.$$eval('#mhResult input', xs => xs.map(x => x.value).join(' | '));
    ok('19. voucher scansionato: la pagina parte come immagine, e la domanda lo dice', ia.length === 1 && /scansionate/.test((ca[ca.length - 1] || {}).text || '')
       && !/<<<MAIL/.test(JSON.stringify(ca)), ia.length + ' immagini');
    ok('19. «È una scansione: leggo la pagina come immagine.», poi l\'anteprima da controllare', sa.some(x => /È una scansione: leggo la pagina come immagine\./.test(x))
       && /Hotel Avenida Palace/.test(anteprima), sa.slice(-1).join(''));
    // l'assistente che non risponde: senza testo il lettore a regole non può niente, e lo si dice
    viste = await ponteFinto(p, [{ status: 500, errore: 'x' }]);
    await p.evaluate(() => apriMailHotel());
    await p.waitForTimeout(300);
    await p.setInputFiles('#mhPdf', UN_PDF('voucher.pdf'));
    await p.waitForFunction(() => /⚠️/.test(document.getElementById('mhStato').textContent), null, { timeout: 20000 });
    const giu = await p.evaluate(() => ({ stato: document.getElementById('mhStato').textContent, anteprima: document.getElementById('mhResult').textContent.trim() }));
    ok('19. se l\'assistente non risponde su una scansione: il messaggio, e nessuna anteprima vuota', /L'assistente non ha risposto: riprova fra poco/.test(giu.stato) && !giu.anteprima, JSON.stringify(giu));
    // la chat: due PDF scansionati da due pagine, in tutto tre pagine
    await p.evaluate(() => closeSheet('mMailHotel'));
    await allaChat(p);
    viste = await ponteFinto(p, [{ testo: '{"giorni":[],"fuori":[]}' }]);
    await pdfFinto(p, 2);
    await p.setInputFiles('#chatPdf', [UN_PDF('giorno-1.pdf'), UN_PDF('giorno-2.pdf')]);
    await p.waitForFunction(() => !allegatoBusy, null, { timeout: 20000 }).catch(() => {});
    await p.waitForTimeout(300);
    const inc = (viste.find(v => v.tipo === 'incollato') || {}).corpo || { messages: [{}] };
    const ci = inc.messages[0].content, ii = blocchiImmagine(ci);
    ok('19. in chat, due PDF scansionati: tre pagine in tutto, come immagini', ii.length === 3 && /PDF scansionato/.test((ci[ci.length - 1] || {}).text || ''), ii.length + ' immagini');
    await p.close();
  });

  /* ── 20. la mappa dell'app, solo quando serve ───────────────────────── */
  await prova('20', async () => {
    const p = await apri();
    const m = await p.evaluate(() => typeof mappaPerDomanda !== 'function' ? null : {
      piena: MAPPA_APP.length, indice: MAPPA_COMPATTA.length,
      viaggio: mappaPerDomanda('Cosa vediamo stasera a Lisbona?'),
      bagagli: mappaPerDomanda('Dove trovo i bagagli nell\'app?'),
      lingua: mappaPerDomanda('Where can I change the language?'),
      esporta: mappaPerDomanda('¿Dónde está el botón para exportar?'),
      tasto: mappaPerDomanda('Il tasto non funziona') });
    ok('20. per una domanda di viaggio parte solo l\'indice della mappa: un quinto o meno', !!m && m.viaggio.length === m.indice && m.indice * 5 <= m.piena,
       m ? `indice ${(m.indice / 1024).toFixed(1)} KB contro ${(m.piena / 1024).toFixed(1)} KB` : 'mappaPerDomanda non c\'è');
    ok('20. per una domanda sull\'app, in più le voci che c\'entrano, anche in altre lingue', !!m && /I bagagli stanno nella scheda del viaggio/.test(m.bagagli)
       && /- La lingua: in Profilo/.test(m.lingua) && /- Profilo \(in fondo al cassetto/.test(m.esporta) && m.bagagli.length < m.piena,
       m ? [m.bagagli, m.lingua, m.esporta].map(x => (x.length / 1024).toFixed(1) + ' KB').join(', ') : '');
    ok('20. e tutta la mappa solo se è chiaramente sull\'app ma non si capisce dove', !!m && m.tasto.length === m.piena);
    const viste = await ponteFinto(p, [{ testo: 'Il Miradouro da Senhora do Monte, al tramonto.' }]);
    await allaChat(p);
    await p.fill('#chatInput', 'Cosa vediamo stasera?');
    await p.click(TASTO_CHAT);
    await finito(p, 'chat');
    const sys = ((viste.find(v => v.tipo === 'chat') || {}).corpo || {}).system || '';
    ok('20. e nella chat vera la richiesta è più leggera', !!m && sys.length > 0 && sys.length < m.piena && !/QUANTO SI ALLARGANO/.test(sys) && /indice/.test(sys),
       (sys.length / 1024).toFixed(1) + ' KB di istruzioni');
    await p.close();
  });

  /* ── 21. la foto di un reel ─────────────────────────────────────────── */
  await prova('21', async () => {
    const p = await apri();
    const viste = await ponteFinto(p, [{ testo: POSTI }]);
    await alReel(p);
    const orig = await p.evaluate(async () => {
      const c = document.createElement('canvas'); c.width = 2400; c.height = 1800;
      const x = c.getContext('2d'); x.fillStyle = '#4a7'; x.fillRect(0, 0, 2400, 1800); x.fillStyle = '#fff'; x.font = '200px sans-serif'; x.fillText('Belém', 300, 900);
      const b = await new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.9));
      const dati = new Uint8Array(await b.arrayBuffer());
      // un blocco Exif con dentro il punto GPS, subito dopo l'inizio del file, come quello di un telefono
      const exif = new TextEncoder().encode('Exif\0\0MM\0*\0\0\0\x08GPSLatitude 38.6916 GPSLongitude -9.2160 iPhone 15');
      const app1 = new Uint8Array([0xFF, 0xE1, (exif.length + 2) >> 8, (exif.length + 2) & 255, ...exif]);
      const tutto = new Uint8Array(dati.length + app1.length);
      tutto.set(dati.subarray(0, 2)); tutto.set(app1, 2); tutto.set(dati.subarray(2), 2 + app1.length);
      const inp = document.querySelector('input[onchange="onImpImage(event)"]');
      const dt = new DataTransfer(); dt.items.add(new File([tutto], 'reel.jpg', { type: 'image/jpeg' })); inp.files = dt.files;
      inp.dispatchEvent(new Event('change', { bubbles: true }));
      return { byte: tutto.length, gps: new TextDecoder('latin1').decode(tutto).includes('GPSLatitude') };
    });
    await p.waitForFunction(() => !!impB64, null, { timeout: 10000 });
    await p.click(TASTO_REEL); await finito(p);
    const c = ((viste.find(v => v.tipo === 'reel') || {}).corpo || { messages: [{}] }).messages[0].content;
    const img = blocchiImmagine(c)[0];
    const buf = img ? Buffer.from(img.source.data, 'base64') : Buffer.alloc(0);
    const mis = img ? misureJpeg(buf) : null;
    ok('21. la foto parte ridisegnata: al massimo 1280 px, e più leggera', !!mis && Math.max(mis.w, mis.h) === 1280 && buf.length < orig.byte,
       mis ? `${mis.w}×${mis.h}, ${(buf.length / 1024).toFixed(0)} KB contro ${(orig.byte / 1024).toFixed(0)} KB` : 'nessuna foto');
    ok('21. e senza i dati nascosti: niente Exif, niente punto GPS', orig.gps && buf.length > 0 && !buf.includes('Exif') && !buf.includes('GPSLatitude'));
    await p.close();
  });

  ok('nessun errore in pagina', !errori.length, errori.slice(0, 3).join(' | '));
  console.log('\n' + r.join('\n'));
  const falliti = r.filter(x => x.includes('FALLITO')).length;
  console.log(`\n${r.length - falliti}/${r.length} passati`);
  await browser.close();
  process.exit(falliti ? 1 : 0);
})();
