/* L'AVVIO, ANCHE COL CAMPO DEBOLE.

   Prima sei librerie arrivavano dalle CDN, bloccanti, prima del codice
   dell'app: col campo debole l'app era usabile dopo venti secondi. La
   service worker aspettava l'HTML dalla rete senza limite, e senza rete le
   librerie mancavano tutte. Qui si prova come e' adesso, con l'app e le CDN
   servite in locale (rete-finta.js): cosi' la prova decide cosa arriva,
   quando, e cosa no.
   1. benzina nella valuta del viaggio, o in euro senza cambio;
   2. rete lenta oltre 3 secondi: si apre la copia, e la copia si aggiorna;
   3. rete buona: arriva subito l'ultima versione;
   4. all'avvio niente lettori dei codici ne' codici a barre; arrivano al
      momento, e funzionano;
   5. ogni libreria ha la versione esatta e punta a un file che c'e';
   6. dopo il primo avvio, senza rete: mappa, scanner, codici a barre;
   7. il cloud che non arriva: chi non ha l'account lo sa, chi ce l'ha entra;
   8. una libreria al momento che non arriva: il messaggio con «Riprova»;
   9. il codice morto non c'e' piu', importTrip e' intatto, e
      nessuna funzione e' chiamata senza esistere;
   10. le misure: l'app usabile prima e meno JavaScript all'avvio;
   11. i testi nuovi in cinque lingue. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { apriBrowser, APP, RADICE } = require('./browser');
const { serverFinti, misuraAvvio, leggiIndirizzo, filePacchetto } = require('./rete-finta');
const { funzioniMancanti } = require('./funzioni-mancanti');

/* Il file e' quello indicato da APP_URL, se c'e': cosi' la controprova sul
   codice vecchio prova davvero il codice vecchio, service worker compresa. */
const FILE_APP = APP.startsWith('file://') ? decodeURIComponent(APP.slice(7)) : path.join(RADICE, 'Index 2.1.html');
const FILE_SW = fs.existsSync(path.join(path.dirname(FILE_APP), 'sw.js')) ? path.join(path.dirname(FILE_APP), 'sw.js') : path.join(RADICE, 'sw.js');
const HTML = fs.readFileSync(FILE_APP, 'utf8');
const SW = fs.readFileSync(FILE_SW, 'utf8');
const CACHE = /const CACHE_NAME = '([^']+)'/.exec(SW)[1];
const CACHE_LIBRERIE = CACHE.replace('-shell-', '-librerie-');
const VERSIONE = /const VERSIONE_APP='([^']+)'/.exec(HTML)[1];

/* Le misure del codice di prima (d98e258, la versione del 7 ottobre 04:11),
   prese con misuraAvvio su questa stessa rete finta: 400 kbps, 400 ms di
   latenza, mediana di tre avvii. */
const PRIMA = { prima: 1220, usabile: 21133, kbJs: 523 };
/* L'impronta di importTrip com'era prima di questa miglioria. mImport e'
   stato rifatto nella miglioria 6 (l'importazione da una tabella, vedi
   prova-importa); importTrip no: chiama l'assistente, che e' della 7. */
const INTATTI = { importTrip: 'a2ba31914123bb82' };

const r = [];
const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);
const errori = [];
const OGGI = new Date().toISOString().split('T')[0];
const tappa = (id, nome, ora, fine, lat, lng, extra = {}) => Object.assign({ id, name: nome, time: ora, timeEnd: fine, lat, lng,
  type: 'outdoor', who: [1], completed: false, booking: { needed: false, done: false } }, extra);
const viaggio = (extra = {}, viaggioExtra = {}) => Object.assign({
  trips: [Object.assign({ id: 1, name: 'Tokyo', destination: 'Tokyo', currency: 'EUR', status: 'open', start: OGGI, end: OGGI,
    participants: [{ id: 1, name: 'Gepp', isMe: true }], suggested: [], pois: [], hotels: [], weather: {}, createdAt: 1, expenses: [],
    tickets: [{ id: 77, name: 'Treno per Kyoto', code: '123456789012', fmt: 'code128', type: 'attraction' }],
    days: [{ id: 'd1', date: OGGI, title: '', travelMode: 'walk', activities: [
      tappa(11, 'Senso-ji', '09:00', '10:00', 35.7148, 139.7967),
      tappa(12, 'Tokyo Tower', '11:00', '12:00', 35.6586, 139.7454, { segTravelMode: 'car' })] }] }, viaggioExtra)],
  currentTripId: 1, settings: { proxRadius: 200 }, myName: 'Gepp', skipAuth: true, consentNotif: true
}, extra);
/* Una tabella dei cambi con lo yen: 1 yen = 0,006 euro. */
const CAMBI_JPY = { JPY: { rates: { JPY: 1, EUR: 0.006, USD: 0.0066 }, t: Date.now(), d: Date.now() } };

let srv, browser;
async function apri(stato, { sw = false, lingua = null, larghezza = 390, cambi = null, extraLs = null } = {}) {
  const page = await browser.newPage({ serviceWorkers: sw ? 'allow' : 'block', viewport: { width: larghezza, height: 844 } });
  page.on('pageerror', e => errori.push('PAGEERROR: ' + e.message.split('\n')[0]));
  /* Lo stato si semina una volta sola: ricaricando resta quello dell'app. */
  await page.addInitScript(([s, l, c, x]) => {
    if (localStorage.getItem('prova-avvio')) return;
    localStorage.clear();
    const st = JSON.parse(JSON.stringify(s)); if (l) st.settings.lingua = l;
    localStorage.setItem('geppgo2', JSON.stringify(st));
    localStorage.setItem('geppgo2_intro', '1');
    if (c) localStorage.setItem('geppgo2_cambi', JSON.stringify(c));
    if (x) Object.keys(x).forEach(k => localStorage.setItem(k, x[k]));
    localStorage.setItem('prova-avvio', '1');
  }, [stato, lingua, cambi, extraLs]);
  await page.goto(srv.app + '/Index%202.1.html', { waitUntil: 'domcontentloaded' });
  await pronta(page);
  return page;
}
const pronta = page => page.waitForFunction(() => typeof window.renderAll === 'function' && !document.getElementById('bootSplash'), null, { timeout: 30000 });
/* Ogni prova parte col server com'e' di solito: una che cade a meta' non
   deve lasciare alla successiva una CDN rotta o l'app giu'. */
const prova = async (nome, fn) => {
  Object.assign(srv.stato, { html: HTML, ritardoHtml: 0, giu: false, cdnGiu: false, cdnRotti: new Set() });
  try { await fn(); } catch (e) { ok(nome, false, 'si è fermata: ' + e.message.split('\n')[0]); }
};
const chieste = (da, re) => srv.log.slice(da).filter(v => v.dove === 'cdn' && re.test(v.url));
const numero = s => parseFloat(String(s).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'));
/* Un QR vero, fatto con la libreria che sta dentro l'app, come file. */
const fileQR = (page, testo) => page.evaluateHandle(async t => {
  const cv = document.createElement('canvas');
  await QRCode.toCanvas(cv, t, { width: 360, margin: 4 });
  const blob = await new Promise(ok => cv.toBlob(ok, 'image/png'));
  return new File([blob], 'biglietto.png', { type: 'image/png' });
}, testo);

(async () => {
  srv = await serverFinti({ html: HTML, sw: SW });
  browser = await apriBrowser({ args: srv.args.concat(['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream']) });

  /* ── 1. la benzina nella valuta giusta ──────────────────────────────── */
  await prova('1', async () => {
    let p = await apri(viaggio({}, { currency: 'JPY' }), { cambi: CAMBI_JPY });
    await p.evaluate(() => openDay(0));
    await p.waitForTimeout(700);
    const conCambio = await p.evaluate(() => {
      const t = T(), d = t.days[0], A = d.activities;
      const est = tempoTratta(d, A[0], A[1], 'car', false, false);
      const striscia = [...document.querySelectorAll('#ttBody .tt-travel-quanto')].map(x => x.textContent).find(x => /km/.test(x) && /~/.test(x)) || '';
      const totale = (document.querySelector('#ttBody .tt-totale') || {}).textContent || '';
      return { euro: est.cost, striscia, totale };
    });
    const atteso = conCambio.euro / 0.006;
    const mostrato = numero((/~¥\s*([\d.,]+)/.exec(conCambio.striscia) || [])[1]);
    ok('1. in un viaggio in yen la benzina è convertita e mostrata in yen, con «~»',
       /~¥/.test(conCambio.striscia) && Math.abs(mostrato - atteso) < 0.02 && /~¥/.test(conCambio.totale),
       `${conCambio.striscia} | totale: ${conCambio.totale} | atteso ~¥${atteso.toFixed(2)}`);
    await p.close();
    p = await apri(viaggio({}, { currency: 'JPY' }));
    await p.evaluate(() => openDay(0));
    await p.waitForTimeout(700);
    const senza = await p.evaluate(() => [...document.querySelectorAll('#ttBody .tt-travel-quanto')].map(x => x.textContent).find(x => /km/.test(x) && /~/.test(x)) || '');
    ok('1. senza un cambio la benzina resta in euro, col simbolo €', /~€\s*\d/.test(senza) && !/¥/.test(senza), senza);
    await p.close();
  });

  /* ── 2 e 3. l'HTML: copia dopo 3 secondi, ultima versione con la rete buona ── */
  await prova('2-3', async () => {
    srv.stato.html = HTML; srv.stato.ritardoHtml = 0;
    const p = await apri(viaggio(), { sw: true });
    await p.evaluate(() => navigator.serviceWorker.ready);
    await p.reload({ waitUntil: 'domcontentloaded' }); await pronta(p);
    const comandata = await p.evaluate(() => !!navigator.serviceWorker.controller);
    // la rete adesso risponde dopo otto secondi, con una versione nuova
    srv.stato.html = HTML.replace(/const VERSIONE_APP='[^']*'/, "const VERSIONE_APP='2099-01-01 00:00'");
    srv.stato.ritardoHtml = 8000;
    let t0 = Date.now();
    await p.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    const dopo = Date.now() - t0;
    await pronta(p);
    const vista = await p.evaluate(() => VERSIONE_APP);
    ok('2. rete lenta oltre 3 secondi: l\'app si apre dalla copia in circa 3 secondi',
       comandata && dopo >= 2800 && dopo < 6000 && vista === VERSIONE_HTML(),
       `${dopo} ms, versione ${vista}`);
    // e quando la rete risponde, la copia si aggiorna per la volta dopo
    let aggiornata = false;
    for (let i = 0; i < 40 && !aggiornata; i++) {
      await p.waitForTimeout(500);
      aggiornata = await p.evaluate(async c => {
        const x = await (await caches.open(c)).match('/Index%202.1.html');
        return !!x && (await x.text()).includes("VERSIONE_APP='2099-01-01 00:00'");
      }, CACHE);
    }
    ok('2. quando la rete risponde, anche in ritardo, la copia si aggiorna', aggiornata);
    // rete buona: si vede subito l'ultima versione pubblicata
    srv.stato.html = HTML.replace(/const VERSIONE_APP='[^']*'/, "const VERSIONE_APP='2099-02-02 00:00'");
    srv.stato.ritardoHtml = 0;
    t0 = Date.now();
    await p.reload({ waitUntil: 'domcontentloaded' });
    const veloce = Date.now() - t0;
    await pronta(p);
    const nuova = await p.evaluate(() => VERSIONE_APP);
    ok('3. con la rete buona arriva subito l\'ultima versione', nuova === '2099-02-02 00:00' && veloce < 2800, `${veloce} ms, versione ${nuova}`);
    srv.stato.html = HTML;
    await p.close();
  });
  function VERSIONE_HTML() { return VERSIONE; }

  /* ── 4. all'avvio niente lettori ne' codici a barre; al momento si' ──── */
  await prova('4', async () => {
    const da = srv.log.length;
    const p = await apri(viaggio());
    await p.waitForTimeout(2500);
    const avvio = srv.log.slice(da).filter(v => v.dove === 'cdn').map(v => v.url);
    const vietate = avvio.filter(u => /jsqr|zxing|bwip|sortable/i.test(u));
    ok('4. all\'avvio non partono richieste per jsQR, ZXing, bwip-js e Sortable', !vietate.length && avvio.some(u => /leaflet/.test(u)),
       vietate.join(' ') || avvio.map(u => u.split('/').slice(-3).join('/')).join(' '));
    // lo scanner: i lettori arrivano aprendolo, e la fotocamera (finta) parte
    const d2 = srv.log.length;
    await p.evaluate(() => openScanner());
    await p.waitForTimeout(2500);
    const scan = await p.evaluate(() => ({ jsQR: typeof jsQR, zx: typeof ZXing, acceso: scanOn, msg: document.getElementById('scanResult').textContent }));
    ok('4. aprendo lo scanner arrivano jsQR e ZXing, e lo scanner parte',
       scan.jsQR === 'function' && scan.zx === 'object' && scan.acceso && chieste(d2, /jsqr/).length === 1 && chieste(d2, /zxing/).length === 1, JSON.stringify(scan));
    await p.evaluate(() => closeScanner());
    // e leggono davvero un biglietto da una foto
    const f = await fileQR(p, 'GEPPGO-QR-4');
    await p.evaluate(file => ticketsFromImages({ files: [file], value: '' }), f);
    await p.waitForTimeout(2500);
    const letto = await p.evaluate(() => T().tickets.some(tk => tk.code === 'GEPPGO-QR-4'));
    ok('4. un biglietto da foto viene letto', letto);
    // i codici a barre: bwip-js arriva la prima volta che ce n'e' uno da disegnare
    const d3 = srv.log.length;
    await p.evaluate(() => { closeSheet('mTkLink'); go('tickets'); renderTickets(); });
    await p.waitForTimeout(2000);
    const barre = await p.evaluate(() => { const c = document.querySelector('#qr-77 canvas'); return { bwip: typeof bwipjs, tela: !!c && c.width > 50 }; });
    ok('4. il codice a barre arriva al momento e viene disegnato', barre.bwip === 'object' && barre.tela && chieste(d3, /bwip/).length === 1, JSON.stringify(barre));
    await p.close();
  });

  /* ── 5. versioni esatte, file che esistono ───────────────────────────── */
  await prova('5', async () => {
    const nellApp = [...new Set(HTML.match(/https:\/\/(?:unpkg\.com|cdn\.jsdelivr\.net|cdn\.sheetjs\.com)\/[^'"`\s)]+/g))];
    /* Solo la lista LIBRERIE di sw.js: li' c'e' anche l'indirizzo dei
       caratteri, che non e' una libreria. */
    const listaSw = (/const LIBRERIE = \[([\s\S]*?)\];/.exec(SW) || [, ''])[1];
    const nelSw = [...listaSw.matchAll(/'(https:\/\/[^']+)'/g)].map(m => m[1]);
    const lib = [...HTML.matchAll(/(?:js|css):'(https:\/\/[^']+)'/g)].map(m => m[1]);
    const inesatte = nellApp.concat(nelSw).filter(u => { const p = leggiIndirizzo(u); return !p || !/^\d+\.\d+\.\d+$/.test(p.versione); });
    ok('5. ogni indirizzo di libreria ha una versione esatta', !inesatte.length && nellApp.length >= 7, inesatte.join(' ') || nellApp.length + ' indirizzi');
    /* pdf.js sta in PDF_CDN (una cartella) e si carica gia' al momento da
       prima: i suoi due file (legacy/build/pdf.min.js e pdf.worker.min.js
       della 3.11.174) sono stati controllati a mano sul pacchetto, che pesa
       32 MB e porta con se' una libreria nativa, e per questo non sta fra le
       dipendenze delle prove. Tutte le altre si controllano qui. */
    const daControllare = nellApp.concat(nelSw).filter(u => !/pdfjs-dist/.test(u));
    const mancanti = daControllare.filter(u => { const p = leggiIndirizzo(u); return !p || !filePacchetto(p.nome, p.versione, p.dentro); });
    ok('5. e punta a un file che esiste davvero nel pacchetto di quella versione', !mancanti.length, mancanti.join(' ') || daControllare.length + ' controllati');
    ok('5. la lista della service worker è la stessa dell\'app', JSON.stringify([...lib].sort()) === JSON.stringify([...nelSw].sort()) && lib.length === 7,
       lib.length + ' nell\'app, ' + nelSw.length + ' in sw.js');
  });

  /* ── 6. dopo il primo avvio, senza rete ──────────────────────────────── */
  await prova('6', async () => {
    srv.stato.giu = false; srv.stato.cdnGiu = false;
    const p = await apri(viaggio(), { sw: true });
    await p.evaluate(() => navigator.serviceWorker.ready);
    let tenute = 0;
    for (let i = 0; i < 60 && tenute < 7; i++) {
      await p.waitForTimeout(500);
      tenute = await p.evaluate(async c => (await (await caches.open(c)).keys()).length, CACHE_LIBRERIE);
    }
    ok('6. dopo il primo avvio la service worker tiene da parte tutte le librerie', tenute === 7, tenute + ' in ' + CACHE_LIBRERIE);
    // via la rete: ne' l'app ne' le CDN rispondono
    srv.stato.giu = true; srv.stato.cdnGiu = true;
    await p.reload({ waitUntil: 'domcontentloaded' });
    await pronta(p);
    await p.waitForTimeout(1500);
    const mappa = await p.evaluate(() => ({ L: typeof L, mappa: !!map, home: !!homeMapObj }));
    ok('6. senza rete la mappa c\'è', mappa.L === 'object' && mappa.mappa && mappa.home, JSON.stringify(mappa));
    await p.evaluate(() => openScanner());
    await p.waitForTimeout(2000);
    const scan = await p.evaluate(() => ({ jsQR: typeof jsQR, zx: typeof ZXing, acceso: scanOn }));
    await p.evaluate(() => closeScanner());
    const f = await fileQR(p, 'GEPPGO-OFFLINE');
    await p.evaluate(file => ticketsFromImages({ files: [file], value: '' }), f);
    await p.waitForTimeout(2500);
    const letto = await p.evaluate(() => T().tickets.some(tk => tk.code === 'GEPPGO-OFFLINE'));
    ok('6. senza rete lo scanner parte e legge un biglietto', scan.jsQR === 'function' && scan.zx === 'object' && scan.acceso && letto, JSON.stringify(scan) + ' letto: ' + letto);
    await p.evaluate(() => { closeSheet('mTkLink'); go('tickets'); renderTickets(); });
    await p.waitForTimeout(1500);
    /* Con bwip-js: senza, il codice di prima ripiegava su un QR, che al
       varco non e' il biglietto. */
    const barre = await p.evaluate(() => ({ bwip: typeof bwipjs, tela: !!document.querySelector('#qr-77 canvas') }));
    ok('6. senza rete il codice a barre si disegna', barre.bwip === 'object' && barre.tela, JSON.stringify(barre));
    srv.stato.giu = false; srv.stato.cdnGiu = false;
    await p.close();
  });

  /* ── 7. la libreria del cloud non arriva ─────────────────────────────── */
  await prova('7', async () => {
    srv.stato.cdnRotti = new Set(['@supabase/supabase-js']);
    let p = await apri(viaggio({ skipAuth: false }));
    await p.waitForTimeout(1500);
    const senza = await p.evaluate(() => {
      const g = document.getElementById('authGate'), giu = document.getElementById('auCloudGiu');
      const tasti = [...giu.querySelectorAll('button')].filter(b => b.offsetParent).map(b => b.textContent.trim());
      return { gate: getComputedStyle(g).display, avviso: giu.offsetParent ? giu.querySelector('.au-giu-t').textContent : '', tasti };
    });
    ok('7. senza account compare la schermata, con l\'avviso, «Riprova» e «Prova senza account»',
       senza.gate === 'flex' && senza.avviso === 'Il cloud non risponde' && senza.tasti.join('|') === 'Riprova|Prova senza account', JSON.stringify(senza));
    await p.click('#auCloudGiu .btn-filo');
    await p.waitForTimeout(400);
    const dentro = await p.evaluate(() => ({ gate: getComputedStyle(document.getElementById('authGate')).display, skip: app.skipAuth }));
    ok('7. «Prova senza account» fa entrare', dentro.gate === 'none' && dentro.skip === true, JSON.stringify(dentro));
    await p.close();
    // con un account: si entra coi dati del telefono
    const sessione = { access_token: 'finto', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 86400,
      refresh_token: 'finto', user: { id: '00000000-0000-0000-0000-000000000001', email: 'gepp@esempio.it', aud: 'authenticated', role: 'authenticated' } };
    p = await apri(viaggio({ skipAuth: false }), { extraLs: { 'sb-cyolhqndurgwbivxcssf-auth-token': JSON.stringify(sessione) } });
    await p.waitForTimeout(1500);
    const con = await p.evaluate(() => ({ gate: getComputedStyle(document.getElementById('authGate')).display, viaggio: (T() || {}).name, sb: !!sb, giu: cloudGiu }));
    ok('7. con un account si entra coi dati del telefono, senza schermata', con.gate === 'none' && con.viaggio === 'Tokyo' && !con.sb && con.giu, JSON.stringify(con));
    // la libreria torna: la sincronizzazione riparte da sola
    srv.stato.cdnRotti = new Set();
    const fuori = p.__fuori ? p.__fuori.length : 0;
    await p.evaluate(() => window.dispatchEvent(new Event('online')));
    await p.waitForTimeout(3000);
    const torna = await p.evaluate(() => ({ sb: !!sb, sessione: !!session, giu: cloudGiu }));
    const chiamateCloud = (p.__fuori || []).slice(fuori).filter(u => /supabase\.co/.test(u)).length;
    ok('7. quando la libreria arriva la sincronizzazione riparte da sola', torna.sb && torna.sessione && !torna.giu && chiamateCloud > 0,
       JSON.stringify(torna) + ' · ' + chiamateCloud + ' chiamate al cloud');
    await p.close();
  });

  /* ── 8. una libreria al momento che non arriva ───────────────────────── */
  await prova('8', async () => {
    srv.stato.cdnRotti = new Set(['jsqr', 'bwip-js']);
    const p = await apri(viaggio());
    await p.evaluate(() => openScanner());
    await p.waitForTimeout(2000);
    const scan = await p.evaluate(() => ({ testo: document.getElementById('scanResult').textContent, tasti: [...document.querySelectorAll('#scanResult button')].map(b => b.textContent), acceso: scanOn }));
    ok('8. lo scanner senza lettori lo dice, con «Riprova»', /Lo scanner non si è caricato/.test(scan.testo) && scan.tasti[0] === 'Riprova' && !scan.acceso, JSON.stringify(scan));
    await p.evaluate(() => closeScanner());
    const f = await fileQR(p, 'GEPPGO-RIPROVA');
    await p.evaluate(file => ticketsFromImages({ files: [file], value: '' }), f);
    await p.waitForTimeout(1500);
    const foglio = await p.evaluate(() => ({ aperto: document.getElementById('mConfirm').classList.contains('active'), titolo: document.getElementById('cfTitle').textContent, tasto: document.getElementById('cfOk').textContent }));
    ok('8. leggere un biglietto da foto senza lettori lo dice, con «Riprova»', foglio.aperto && foglio.titolo === 'Il lettore dei codici non si è caricato' && foglio.tasto === 'Riprova', JSON.stringify(foglio));
    // la rete torna: «Riprova» legge il biglietto
    srv.stato.cdnRotti = new Set(['bwip-js']);
    await p.click('#cfOk');
    await p.waitForTimeout(3000);
    const letto = await p.evaluate(() => T().tickets.some(tk => tk.code === 'GEPPGO-RIPROVA'));
    ok('8. e «Riprova» lo legge quando i lettori arrivano', letto);
    await p.evaluate(() => { closeSheet('mTkLink'); go('tickets'); renderTickets(); });
    await p.waitForTimeout(1500);
    const barre = await p.evaluate(() => { const el = document.getElementById('qr-77'); return { testo: el.textContent, tasto: !!el.querySelector('button'), tela: !!el.querySelector('canvas') }; });
    ok('8. il codice a barre senza la sua libreria lo dice, lascia il numero e offre «Riprova»',
       /Il codice a barre non si è caricato/.test(barre.testo) && /123456789012/.test(barre.testo) && barre.tasto && !barre.tela, JSON.stringify(barre));
    srv.stato.cdnRotti = new Set();
    await p.click('#qr-77 button');
    await p.waitForTimeout(2000);
    ok('8. e «Riprova» lo disegna quando arriva', await p.evaluate(() => !!document.querySelector('#qr-77 canvas')));
    await p.close();
  });

  /* ── 9. codice morto, pezzi intatti, funzioni che esistono ───────────── */
  await prova('9', async () => {
    const restano = ['renderTimeline', 'Sortable', 'searchFlights', 'saveFl'].filter(n => HTML.includes(n));
    ok('9. nessun riferimento a renderTimeline, Sortable, searchFlights e saveFl', !restano.length, restano.join(', '));
    const h = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
    const a = HTML.search(/\n(async )?function importTrip\(/), resto = HTML.slice(a + 1), b = resto.search(/\n(async )?function [A-Za-z_$]/);
    const ora = { mImport: HTML.includes('<div class="modal" id="mImport">'), importTrip: a > 0 ? h(resto.slice(0, b)) : '' };
    ok('9. mImport c\'è ancora e importTrip è come prima', ora.mImport && ora.importTrip === INTATTI.importTrip, JSON.stringify(ora));
    const an = await funzioniMancanti(HTML, browser);
    ok('9. nessuna funzione chiamata ma non definita', !an.mancanti.length && an.chiamate > 3000,
       an.mancanti.map(x => x.nome + ' (' + x.righe.join(',') + ')').join(' ') || `${an.chiamate} chiamate, ${an.definiti} nomi`);
  });

  /* ── 10. le misure, prima e dopo ─────────────────────────────────────── */
  await prova('10', async () => {
    const giri = [];
    for (let i = 0; i < 2; i++) giri.push(await misuraAvvio(browser, srv, { stato: viaggio() }));
    const m = giri.sort((x, y) => x.usabile - y.usabile)[0];
    console.log(`  misure — prima: schermata ${PRIMA.prima} ms, usabile ${PRIMA.usabile} ms, JS ${PRIMA.kbJs} KB · ` +
      `adesso: schermata ${m.prima} ms, usabile ${m.usabile} ms, JS ${m.kbJs} KB (${m.fileJs.join(', ')}), HTML ${m.kbHtml} KB`);
    ok('10. con la rete lenta l\'app è usabile prima', m.usabile < PRIMA.usabile * 0.75, `${PRIMA.usabile} → ${m.usabile} ms`);
    ok('10. e scarica meno JavaScript all\'avvio', m.kbJs < PRIMA.kbJs / 2, `${PRIMA.kbJs} → ${m.kbJs} KB`);
    ok('10. la prima schermata non arriva più tardi', m.prima <= PRIMA.prima * 1.15, `${PRIMA.prima} → ${m.prima} ms`);
  });

  /* ── 11. i testi nuovi in cinque lingue ──────────────────────────────── */
  await prova('11', async () => {
    const p = await apri(viaggio());
    const d = await p.evaluate(() => {
      const it = Object.keys(DIZIONARIO_AVVIO.en);
      const buchi = [];
      ['en', 'es', 'fr', 'pt'].forEach(l => it.forEach(k => { const v = DIZIONARIO_AVVIO[l][k]; if (!v || v === k || DIZIONARIO[l][k] !== v) buchi.push(l + ': ' + k); }));
      const altri = ['es', 'fr', 'pt'].filter(l => Object.keys(DIZIONARIO_AVVIO[l]).length !== it.length);
      return { n: it.length, buchi, altri };
    });
    ok('11. le frasi nuove ci sono in inglese, spagnolo, francese e portoghese', d.n >= 11 && !d.buchi.length && !d.altri.length,
       d.buchi.slice(0, 3).join(' | ') || d.n + ' frasi');
    await p.close();
    srv.stato.cdnRotti = new Set(['@supabase/supabase-js']);
    const viste = [];
    for (const [l, atteso] of [['en', 'The cloud isn’t responding'], ['es', 'La nube no responde'], ['fr', 'Le cloud ne répond pas'], ['pt', 'A nuvem não responde']]) {
      const q = await apri(viaggio({ skipAuth: false }), { lingua: l });
      await q.waitForTimeout(1500);
      const t = await q.evaluate(() => ({ t: document.querySelector('#auCloudGiu .au-giu-t').textContent, p: document.querySelector('#auCloudGiu .au-perche').textContent, b: document.getElementById('auRiprova').textContent }));
      viste.push(l + ': ' + t.t + ' / ' + t.b);
      if (t.t !== atteso || /Per accedere/.test(t.p) || t.b === 'Riprova') viste.push('  ↑ non tradotto');
      await q.close();
    }
    srv.stato.cdnRotti = new Set();
    ok('11. la schermata del cloud che non risponde si legge in ogni lingua', !viste.some(v => /non tradotto/.test(v)), viste.join(' | '));
  });

  ok('nessun errore in pagina', !errori.length, errori.slice(0, 3).join(' | '));
  console.log('\n' + r.join('\n'));
  const falliti = r.filter(x => x.includes('FALLITO')).length;
  console.log(`\n${r.length - falliti}/${r.length} passati`);
  await browser.close();
  srv.chiudi();
  process.exit(falliti ? 1 : 0);
})();
