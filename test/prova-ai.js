/* L'ASSISTENTE AFFIDABILE.

   Le quattordici chiamate all'assistente passano tutte da chiediAI. Qui il
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
   11. la privacy nomina Google Gemini e dice cosa ne fa dei dati;
   12. i testi nuovi in cinque lingue. */
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
   { testo }           risponde come il ponte vero, con quel testo
   { status, errore }  risponde con quello status e {error:{message}}
   { cade: true }      la connessione si chiude, come col campo che cade
   { mai: true }       non risponde mai: la richiesta resta appesa
   e { dopo: ms } per farlo aspettare prima di rispondere. */
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST, OPTIONS' };
const testoDi = c => JSON.stringify(c || '');
const tipoDi = c => /reel\/post/.test(testoDi(c)) ? 'reel' : /Sei l'assistente di viaggio/.test((c && c.system) || '') ? 'chat' : 'altro';
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
      else if (passo.status) await route.fulfill({ status: passo.status, contentType: 'application/json', headers: CORS, body: JSON.stringify({ error: { message: passo.errore || 'errore' } }) });
      else await route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify({ content: [{ type: 'text', text: passo.testo }], stop_reason: 'end_turn' }) });
    } catch (e) { /* la pagina l'ha gia' lasciata andare (annullata, o scaduta) */ }
  });
  return viste;
}
const quante = (viste, tipo) => viste.filter(v => v.tipo === tipo).length;

let browser;
const pronta = page => page.waitForFunction(() => typeof window.renderAll === 'function' && !document.getElementById('bootSplash'), null, { timeout: 30000, polling: 100 });
async function apri({ stato = LISBONA, lingua = null, orologio = false } = {}) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', e => errori.push('PAGEERROR: ' + e.message.split('\n')[0]));
  /* L'orologio finto scorre come quello vero finche' la prova non lo fa
     saltare avanti: l'avvio dell'app non se ne accorge. */
  if (orologio) await page.clock.install();
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
    ok('2. e le quattordici richieste passano tutte da chiediAI', chiamate >= 14, chiamate + ' chiamate');
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
    /* Il ponte vero, quando la quota di Google e' finita, risponde 502 con
       il messaggio di Google dentro: e' la stessa coda, e vale lo stesso. */
    viste = await ponteFinto(p, [{ status: 502, errore: 'gemini-3.1-flash-lite → You exceeded your current quota, please check your plan and billing details. Please retry in 21.3s.' }, { testo: POSTI }]);
    await p.click(TASTO_REEL); await finito(p);
    e = await esitoReel(p);
    ok('5. la quota finita, che il ponte manda come 502: niente secondo tentativo, stesso messaggio', quante(viste, 'reel') === 1 && /molto richiesto/.test(e.testo), quante(viste, 'reel') + ' richieste: ' + e.testo);
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
    ok('11. la privacy nomina Google Gemini, attraverso il ponte di GeppGo', /Google Gemini/.test(PRIVACY) && /ponte di GeppGo/.test(PRIVACY));
    ok('11. dice che col piano gratuito Google può usare richieste e risposte per migliorare i suoi prodotti',
       /piano gratuito/i.test(PRIVACY) && /Google può usare le richieste e le risposte per migliorare i suoi prodotti/i.test(PRIVACY.replace(/<[^>]+>/g, '')));
    ok('11. che possono leggerle dei revisori', /revisori/i.test(PRIVACY));
    ok('11. e consiglia di non mandare all\'assistente dati sensibili', /Non mandare all'assistente dati sensibili/i.test(PRIVACY.replace(/<[^>]+>/g, '')));
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
      'Questa immagine non si apre: prova con uno screenshot'
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

  ok('nessun errore in pagina', !errori.length, errori.slice(0, 3).join(' | '));
  console.log('\n' + r.join('\n'));
  const falliti = r.filter(x => x.includes('FALLITO')).length;
  console.log(`\n${r.length - falliti}/${r.length} passati`);
  await browser.close();
  process.exit(falliti ? 1 : 0);
})();
