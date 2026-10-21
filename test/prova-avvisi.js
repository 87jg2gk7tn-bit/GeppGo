/* GLI AVVISI, AFFIDABILI SU IPHONE.

   Su iPhone new Notification non funziona: in Safari non esiste, e
   nell'app sulla Home iOS vuole la notifica fatta dalla service worker
   (registration.showNotification). Qui si prova che ogni avviso passa da
   li', che il tocco porta nel punto giusto, che senza permesso l'avviso
   compare dentro l'app, e che i permessi si chiedono con un foglio solo.

   Il browser delle prove apre l'app da file://, dove una service worker
   vera non si registra: la si finge (navigator.serviceWorker, con una
   registrazione che tiene le notifiche mostrate), e si fingono anche le
   notifiche (Notification, col suo permesso) e la posizione, cosi' si sa in
   che ordine l'app chiede le cose. Il gestore del tocco (sw.js) si prova a
   parte, in Node, con un `self` finto: e' il codice vero di sw.js.

   1. nel codice non resta nessun new Notification(;
   2. ogni tipo di avviso chiama showNotification con titolo, testo e dati;
   3. il tocco (notificationclick) porta al punto giusto per ogni tipo;
   4. permesso negato o notifiche che non ci sono: l'avviso e' un banner;
   5. il primo GPS senza permessi: un foglio solo, poi le due domande in
      ordine;
   6. Safari senza Home: nessuna domanda delle notifiche, e la spiegazione;
   7. nel Profilo il testo sulle notifiche c'e', ed e' tradotto;
   8. i testi nuovi in cinque lingue, e niente fuori schermo da 320 a 430 px. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { apriBrowser, APP, leafletJs, RADICE } = require('./browser');
const { fileURLToPath } = require('url');
/* I file si leggono da dove sta l'app che si prova: con APP_URL che punta
   a una copia (la controprova sul codice di prima) si legge quella. */
const CARTELLA = APP.startsWith('file://') ? path.dirname(fileURLToPath(APP)) : RADICE;

const r = [];
const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);
const errori = [];

/* ── il viaggio ─────────────────────────────────────────────────────────── */
const OGGI = (() => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0]; })();
const DOMANI = (() => { const d = new Date(Date.now() + 864e5); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0]; })();
const VIAGGIO = {
  id: 1, cid: 'cid-1', name: 'Lisbona', destination: 'Lisbona', currency: 'EUR', status: 'open',
  participants: [{ id: 11, name: 'Anna', isMe: true }, { id: 12, name: 'Bruno' }], guests: [],
  suggestOn: true, suggested: [{ name: 'Pastéis de Belém', lat: 38.6975, lng: -9.2033 }],
  pois: [{ id: 801, name: 'Miradouro da Graça', lat: 38.7163, lng: -9.1310, priority: 'essential' }],
  hotels: [], tickets: [], expenses: [], weather: {}, createdAt: 1,
  days: [
    { id: 'd1', date: OGGI, title: '', activities: [{ id: 501, name: 'Torre di Belém', time: '23:50', timeEnd: '23:59', type: 'any', who: [], completed: false, booking: { needed: false, done: false } }] },
    { id: 'd2', date: DOMANI, title: '', activities: [{ id: 502, name: 'Oceanário', time: '10:00', timeEnd: '12:00', type: 'any', who: [], completed: false, booking: { needed: false, done: false } }] }
  ]
};
const stato = (extra = {}) => Object.assign({ trips: [VIAGGIO], currentTripId: 1, settings: { proxRadius: 200 }, myName: 'Anna', skipAuth: true, consentNotif: true }, extra);

/* Le finte del telefono, prima che l'app parta. */
const FINTE = ([permesso, conNotifiche, risposta, statoPos, standalone]) => {
  window.__mostrate = []; window.__richieste = []; window.__swAscolti = []; window.__fogli = [];
  if (conNotifiche) {
    const N = function () { window.__nuove = (window.__nuove || 0) + 1; };
    N.permission = permesso;
    N.requestPermission = () => { window.__richieste.push('notifiche'); N.permission = risposta; return Promise.resolve(N.permission); };
    window.Notification = N;
  } else {
    try { delete window.Notification; } catch (e) {}
    window.Notification = undefined;
  }
  const reg = { active: { postMessage() {} }, scope: location.href,
    showNotification: (t, o) => { window.__mostrate.push({ t, o: JSON.parse(JSON.stringify(o || {})) }); return Promise.resolve(); } };
  const sw = { register: () => Promise.resolve(reg), getRegistration: () => Promise.resolve(reg), getRegistrations: () => Promise.resolve([reg]),
    ready: Promise.resolve(reg), controller: null,
    addEventListener: (t, f) => { if (t === 'message') window.__swAscolti.push(f); }, removeEventListener() {} };
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, get: () => sw });
  const geo = { getCurrentPosition: (fatto) => { window.__richieste.push('posizione'); setTimeout(() => fatto({ coords: { latitude: 38.69, longitude: -9.20, accuracy: 20 } }), 20); },
    watchPosition: () => 7, clearWatch() {} };
  Object.defineProperty(navigator, 'geolocation', { configurable: true, get: () => geo });
  if (navigator.permissions) {
    const q = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = d => (d && d.name === 'geolocation') ? Promise.resolve({ state: statoPos, onchange: null }) : q(d);
  }
  if (standalone !== null) Object.defineProperty(navigator, 'standalone', { configurable: true, get: () => standalone });
  /* Quali fogli si aprono, in che ordine. */
  document.addEventListener('DOMContentLoaded', () => {
    new MutationObserver(ms => ms.forEach(m => {
      const el = m.target;
      if (el.classList && el.classList.contains('modal') && el.classList.contains('active') && window.__fogli[window.__fogli.length - 1] !== el.id) window.__fogli.push(el.id);
    })).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
  });
};

async function apri(browser, { st = stato(), permesso = 'granted', conNotifiche = true, risposta = 'granted', statoPos = 'granted',
  standalone = null, ua = null, larghezza = 390, lingua = null, extraLs = null } = {}) {
  const page = await browser.newPage(Object.assign({ viewport: { width: larghezza, height: 844 } }, ua ? { userAgent: ua } : {}));
  page.on('pageerror', e => errori.push('PAGEERROR: ' + e.message.split('\n')[0]));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_BLOCKED|net::/.test(m.text())) errori.push('CONSOLE: ' + m.text().slice(0, 140)); });
  await page.route('**/leaflet@1.9.4/dist/leaflet.js', ro => ro.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(leafletJs(), 'utf8') }));
  await page.route(/tile\.openstreetmap\.org/, ro => ro.abort());
  await page.addInitScript(FINTE, [permesso, conNotifiche, risposta, statoPos, standalone]);
  await page.addInitScript(([s, l, x]) => {
    if (sessionStorage.getItem('prova-avvisi')) return;
    sessionStorage.setItem('prova-avvisi', '1');
    localStorage.clear();
    const st = JSON.parse(JSON.stringify(s));
    if (l) st.settings.lingua = l;
    localStorage.setItem('geppgo2', JSON.stringify(st));
    localStorage.setItem('geppgo2_intro', '1');
    localStorage.setItem('geppgo2_avviso_home', String(Date.now()));
    if (x) Object.keys(x).forEach(k => localStorage.setItem(k, x[k]));
  }, [st, lingua, extraLs]);
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.renderAll === 'function' && !document.getElementById('bootSplash'), null, { timeout: 30000 });
  return page;
}
const prova = async (nome, fn) => { try { await fn(); } catch (e) { ok(nome, false, 'si è fermata: ' + e.message.split('\n')[0]); } };
const aspetta = (p, fn, arg, ms = 5000) => p.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
const nascosta = p => p.evaluate(() => Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }));
const visibile = p => p.evaluate(() => { delete document.visibilityState; });
const hhmm = ms => { const d = new Date(ms); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };

/* ── il gestore del tocco, quello vero di sw.js, con un `self` finto ────── */
function swFinto() {
  const ascolti = {};
  const stato = { finestre: [], aperte: [], fuoco: 0, messaggi: [] };
  const self = {
    addEventListener: (t, f) => { ascolti[t] = f; },
    registration: { scope: 'https://87jg2gk7tn-bit.github.io/GeppGo/' },
    location: { origin: 'https://87jg2gk7tn-bit.github.io' },
    skipWaiting() {},
    clients: {
      matchAll: async () => stato.finestre,
      openWindow: async u => { stato.aperte.push(u); return {}; },
      claim: async () => {}
    }
  };
  const ctx = vm.createContext({ self, URL, console, setTimeout, Promise, caches: {}, fetch: async () => { throw new Error('rete'); }, Response: function () {} });
  vm.runInContext(fs.readFileSync(path.join(CARTELLA, 'sw.js'), 'utf8'), ctx);
  const tocca = async dati => {
    let chiusa = false; const attese = [];
    await ascolti.notificationclick({ notification: { data: dati, close() { chiusa = true; } }, waitUntil: p => attese.push(p) });
    await Promise.all(attese);
    return chiusa;
  };
  const finestra = url => ({ url, focus: async () => { stato.fuoco++; }, postMessage: m => stato.messaggi.push(m) });
  return { ascolti, stato, tocca, finestra };
}

(async () => {
  const browser = await apriBrowser();

  /* ── 1. nel codice non resta nessun new Notification( ──────────────── */
  await prova('1', async () => {
    const html = fs.readFileSync(path.join(CARTELLA, 'Index 2.1.html'), 'utf8');
    const sw = fs.readFileSync(path.join(CARTELLA, 'sw.js'), 'utf8');
    const nuove = (html.match(/new\s+Notification\s*\(/g) || []).length + (sw.match(/new\s+Notification\s*\(/g) || []).length;
    const mostra = (html.match(/\.showNotification\s*\(/g) || []).length;
    ok('1. nel codice non resta nessun new Notification(', nuove === 0, nuove + ' trovati');
    ok('1. e la notifica del telefono si fa in un posto solo (avvisa, con showNotification)', mostra === 1, mostra + ' chiamate a showNotification');
  });

  /* ── 2. ogni tipo di avviso chiama showNotification ─────────────────── */
  await prova('2', async () => {
    const p = await apri(browser);
    await p.waitForTimeout(400);
    const esiti = await p.evaluate(async ([oggi, domani]) => {
      const t = app.trips[0], a = t.days[0].activities[0], b2 = t.days[1].activities[0];
      const ultima = () => window.__mostrate[window.__mostrate.length - 1] || null;
      const pausa = ms => new Promise(x => setTimeout(x, ms));
      const out = {};
      // promemoria: fra dieci minuti, avvisami mezz'ora prima
      const fra10 = new Date(Date.now() + 600000);
      a.time = String(fra10.getHours()).padStart(2, '0') + ':' + String(fra10.getMinutes()).padStart(2, '0');
      if (fra10.getDate() !== new Date().getDate()) { t.days[0].date = domani; }
      a.remindMin = 30; a.remindNotified = false;
      checkActReminders(); await pausa(80); out.promemoria = ultima();
      // da prenotare: il promemoria era per un minuto fa
      const prima = new Date(Date.now() - 60000);
      a.booking = { needed: true, done: false, by: t.days[0].date === domani ? oggi : oggi, time: String(prima.getHours()).padStart(2, '0') + ':' + String(prima.getMinutes()).padStart(2, '0') };
      checkBookRem(); await pausa(80); out.prenota = ultima();
      // ora di partire: la tappa e' a cinque chilometri, si va a piedi
      a.leaveAlert = true; a.leaveMode = 'walk'; a.leaveNotified = false; a.lat = 38.6916; a.lng = -9.2160;
      myPos = { lat: 38.7223, lng: -9.1393 }; myPosAt = Date.now();
      checkLeaveAlerts(); await pausa(80); out.partenza = ultima();
      // in scadenza: da prenotare entro domani (la prima, intanto, e' prenotata)
      a.booking.done = true;
      b2.booking = { needed: true, done: false, by: domani };
      checkBookingAlerts(); await pausa(80); out.scadenza = ultima();
      // con l'app in secondo piano: la tappa vicina, il consiglio, A raccolta
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      proxAlert(t.pois[0], 120); await pausa(80); out.vicino = ultima();
      suggestAlert(t, t.suggested[0], 0, 90); await pausa(80); out.consiglio = ultima();
      raccoltaArrivata({ id: 'r1', trip_id: 'cid-1', chiamata_da: 'u-bruno', nome: 'Bruno', nota: 'Si parte', lat: 38.70, lng: -9.20,
        creata_il: new Date().toISOString(), scade_il: new Date(Date.now() + 7200000).toISOString() });
      await pausa(80); out.raccolta = ultima();
      delete document.visibilityState;
      out.tutte = window.__mostrate.length;
      return out;
    }, [OGGI, DOMANI]);
    const giusto = (x, titolo, testo, tipo, dove) => !!x && titolo.test(x.t) && testo.test(x.o.body || '') && x.o.data && x.o.data.tipo === tipo
      && Object.keys(dove).every(k => String(x.o.data.dove[k]) === String(dove[k]));
    const breve = x => x ? `${x.t} | ${x.o.body} | ${JSON.stringify(x.o.data)}` : 'nessuna';
    ok('2. promemoria «Tra poco»: titolo, testo, dove porta', giusto(esiti.promemoria, /^⏰ Tra poco: Torre di Belém$/, /^Inizia alle \d\d:\d\d$/, 'promemoria', { trip: 1, att: 501 }), breve(esiti.promemoria));
    ok('2. «Da prenotare»', giusto(esiti.prenota, /^🎟️ Da prenotare$/, /^Torre di Belém$/, 'prenota', { trip: 1, att: 501 }), breve(esiti.prenota));
    ok('2. «Ora di partire», col tempo di strada', giusto(esiti.partenza, /^🚦 Ora di partire per «Torre di Belém»$/, /^Sei a .+ (e inizia|, inizia) alle/, 'partenza', { trip: 1, att: 501 }), breve(esiti.partenza));
    ok('2. «Prenotazione in scadenza»', giusto(esiti.scadenza, /^🎟️ Prenotazione in scadenza$/, /^Oceanário: prenota entro domani$/, 'scadenza', { trip: 1, att: 502 }), breve(esiti.scadenza));
    ok('2. la tappa vicina', giusto(esiti.vicino, /^📍 Miradouro da Graça è vicino!$/, /^A circa 120 m da te · tappa essenziale$/, 'vicino', { trip: 1, poi: 801, dist: 120 }), breve(esiti.vicino));
    ok('2. il consiglio nei dintorni', giusto(esiti.consiglio, /^Nei dintorni: Pastéis de Belém$/, /^In linea col tuo viaggio · a circa 90 m$/, 'consiglio', { trip: 1, consiglio: 'Pastéis de Belém' }), breve(esiti.consiglio));
    ok('2. A raccolta, con la chiamata dentro', giusto(esiti.raccolta, /^Bruno chiama a raccolta$/, /^Si parte$/, 'raccolta', {})
       && esiti.raccolta.o.data.dove.raccolta && esiti.raccolta.o.data.dove.raccolta.id === 'r1', breve(esiti.raccolta));
    ok('2. sette avvisi, sette notifiche', esiti.tutte === 7, esiti.tutte + ' notifiche');
    /* Con l'app davanti agli occhi la tappa vicina e A raccolta hanno gia'
       il loro posto a schermo: niente notifica in piu'. */
    const davanti = await p.evaluate(async () => {
      document.querySelectorAll('.prox').forEach(x => x.remove()); proxQueue.length = 0;
      const prima = window.__mostrate.length;
      proxAlert(app.trips[0].pois[0], 150);
      await new Promise(x => setTimeout(x, 100));
      return { notifiche: window.__mostrate.length - prima, banner: [...document.querySelectorAll('.prox .prox-t')].map(x => x.textContent) };
    });
    ok('2. e con l\'app davanti la tappa vicina resta il suo banner, senza notifica', davanti.notifiche === 0 && davanti.banner.some(x => /Miradouro/.test(x)), JSON.stringify(davanti));
    await p.close();
  });

  /* ── 3. il tocco porta al punto giusto ─────────────────────────────── */
  await prova('3', async () => {
    const DOVE = {
      promemoria: { tipo: 'promemoria', trip: 1, att: 501 },
      partenza: { tipo: 'partenza', trip: 1, att: 501 },
      prenota: { tipo: 'prenota', trip: 1, att: 502 },
      scadenza: { tipo: 'scadenza', trip: 1, att: 502 },
      vicino: { tipo: 'vicino', trip: 1, poi: 801, dist: 120 },
      consiglio: { tipo: 'consiglio', trip: 1, consiglio: 'Pastéis de Belém', dist: 90 },
      raccolta: { tipo: 'raccolta', raccolta: { id: 'r9', trip_id: 'cid-1', chiamata_da: 'u-bruno', nome: 'Bruno', nota: 'Al tram 28', lat: 38.71, lng: -9.13,
        creata_il: new Date().toISOString(), scade_il: new Date(Date.now() + 7200000).toISOString() } }
    };
    /* La service worker: con l'app aperta la porta davanti e le dice dove
       andare; da chiusa la apre con #avviso=... */
    const sw = swFinto();
    const conApp = [], senzaApp = [];
    for (const [tipo, dove] of Object.entries(DOVE)) {
      sw.stato.finestre = [sw.finestra('https://87jg2gk7tn-bit.github.io/GeppGo/privacy.html'), sw.finestra('https://87jg2gk7tn-bit.github.io/GeppGo/Index%202.1.html#c=xyz')];
      sw.stato.messaggi = []; sw.stato.fuoco = 0; sw.stato.aperte = [];
      const chiusa = await sw.tocca({ tipo, dove });
      conApp.push(chiusa && sw.stato.fuoco === 1 && sw.stato.aperte.length === 0 && sw.stato.messaggi.length === 1
        && sw.stato.messaggi[0].tipo === 'avviso' && JSON.stringify(sw.stato.messaggi[0].dove) === JSON.stringify(dove) ? '' : tipo);
      sw.stato.finestre = [sw.finestra('https://87jg2gk7tn-bit.github.io/GeppGo/privacy.html')];
      sw.stato.messaggi = []; sw.stato.aperte = [];
      await sw.tocca({ tipo, dove });
      const u = sw.stato.aperte[0] ? new URL(sw.stato.aperte[0]) : null;
      senzaApp.push(u && u.pathname === '/GeppGo/Index%202.1.html' && u.hash.startsWith('#avviso=')
        && JSON.stringify(JSON.parse(decodeURIComponent(u.hash.slice(8)))) === JSON.stringify(dove) && sw.stato.messaggi.length === 0 ? '' : tipo);
    }
    ok('3. sw.js: col tocco l\'app aperta viene davanti e riceve dove andare, senza ricaricarsi (tutti e sette i tipi)', conApp.every(x => !x), conApp.filter(Boolean).join(', '));
    ok('3. sw.js: ad app chiusa la apre con #avviso=..., la pagina dell\'app e non un\'altra', senzaApp.every(x => !x), senzaApp.filter(Boolean).join(', '));

    /* L'app: dove la porta ogni tipo, arrivando dal messaggio della
       service worker. */
    const p = await apri(browser);
    await p.waitForTimeout(300);
    const arrivi = {};
    for (const [tipo, dove] of Object.entries(DOVE)) {
      arrivi[tipo] = await p.evaluate(async d => {
        document.querySelectorAll('.prox').forEach(x => x.remove()); proxQueue.length = 0;
        document.querySelectorAll('.modal.active').forEach(m => closeSheet(m));
        go('plan');
        await new Promise(x => setTimeout(x, 450));
        window.__swAscolti.forEach(f => f({ data: { tipo: 'avviso', dove: d } }));
        await new Promise(x => setTimeout(x, 450));
        const attivo = id => { const el = document.getElementById(id); return !!el && el.classList.contains('active'); };
        return {
          tt: attivo('mDay'), giorno: ttDay, menu: attivo('mActMenu'), menuNome: document.getElementById('amName').textContent,
          dettaglio: attivo('mActDetail'), dettaglioNome: document.getElementById('adName').value,
          home: attivo('plan'), banner: [...document.querySelectorAll('.prox .prox-t')].map(x => x.textContent).join(' | '),
          raccolta: attivo('mRaccoltaIn'), raccoltaT: document.getElementById('raccInT').textContent, raccoltaCorpo: document.getElementById('raccInBody').innerText
        };
      }, dove);
    }
    const a = arrivi;
    ok('3. «Tra poco» e «Ora di partire» aprono la giornata e la tappa', a.promemoria.tt && a.promemoria.giorno === 0 && a.promemoria.menu && a.promemoria.menuNome === 'Torre di Belém'
       && a.partenza.tt && a.partenza.menu && a.partenza.menuNome === 'Torre di Belém', JSON.stringify({ p: a.promemoria, q: a.partenza }).slice(0, 220));
    ok('3. «Da prenotare» e «in scadenza» aprono la tappa da prenotare, nel suo giorno', a.prenota.tt && a.prenota.giorno === 1 && a.prenota.dettaglio && a.prenota.dettaglioNome === 'Oceanário'
       && a.scadenza.dettaglio && a.scadenza.dettaglioNome === 'Oceanário', JSON.stringify({ p: a.prenota, s: a.scadenza }).slice(0, 220));
    ok('3. la tappa vicina riapre la proposta, col posto', a.vicino.home && /Miradouro da Graça è vicino/.test(a.vicino.banner), a.vicino.banner);
    ok('3. il consiglio riapre il consiglio', a.consiglio.home && /Pastéis de Belém/.test(a.consiglio.banner), a.consiglio.banner);
    ok('3. A raccolta riapre la chiamata', a.raccolta.raccolta && /Bruno chiama a raccolta/.test(a.raccolta.raccoltaT) && /Al tram 28/.test(a.raccolta.raccoltaCorpo), a.raccolta.raccoltaT);
    /* Una chiamata scaduta nel frattempo non si riapre. */
    const scaduta = await p.evaluate(async d => {
      document.querySelectorAll('.modal.active').forEach(m => closeSheet(m));
      await new Promise(x => setTimeout(x, 400));
      const r2 = Object.assign({}, d.raccolta, { id: 'r-vecchia', scade_il: new Date(Date.now() - 60000).toISOString() });
      vaiAllAvviso({ tipo: 'raccolta', raccolta: r2 });
      await new Promise(x => setTimeout(x, 200));
      return { aperta: document.getElementById('mRaccoltaIn').classList.contains('active'), toast: (document.querySelector('.toast') || {}).textContent || '' };
    }, DOVE.raccolta);
    ok('3. e una chiamata scaduta nel frattempo non si riapre, lo dice', !scaduta.aperta && /scaduta/.test(scaduta.toast), JSON.stringify(scaduta));
    await p.close();

    /* Ad app chiusa: si apre con #avviso=... e arriva nel punto giusto. */
    const p2 = await apri(browser);
    await p2.evaluate(h => { history.replaceState(null, '', location.pathname + h); }, '#avviso=' + encodeURIComponent(JSON.stringify(DOVE.promemoria)));
    await p2.reload({ waitUntil: 'domcontentloaded' });
    await p2.waitForFunction(() => typeof window.renderAll === 'function' && !document.getElementById('bootSplash'), null, { timeout: 30000 });
    const freddo = await aspetta(p2, () => document.getElementById('mActMenu').classList.contains('active') && document.getElementById('amName').textContent === 'Torre di Belém', null, 5000);
    const indirizzo = await p2.evaluate(() => location.hash);
    ok('3. da chiusa: #avviso=... apre la tappa, e l\'indirizzo si ripulisce', freddo && !/avviso=/.test(indirizzo), JSON.stringify({ freddo, indirizzo: indirizzo.slice(0, 12) }));
    await p2.close();
  });

  /* ── 4. senza permesso, o senza notifiche: il banner ───────────────── */
  await prova('4', async () => {
    const casi = { negato: { permesso: 'denied' }, mancano: { conNotifiche: false }, noNellApp: { st: stato({ consentNotif: false }) } };
    const esiti = {};
    for (const [nome, opz] of Object.entries(casi)) {
      const p = await apri(browser, opz);
      await p.waitForTimeout(300);
      esiti[nome] = await p.evaluate(async () => {
        const t = app.trips[0], a = t.days[0].activities[0];
        const fra10 = new Date(Date.now() + 600000);
        a.time = String(fra10.getHours()).padStart(2, '0') + ':' + String(fra10.getMinutes()).padStart(2, '0');
        if (fra10.getDate() !== new Date().getDate()) t.days[0].date = t.days[1].date;
        a.remindMin = 30; a.remindNotified = false;
        checkActReminders();
        await new Promise(x => setTimeout(x, 200));
        const b = document.querySelector('.prox.avv');
        return { notifiche: window.__mostrate.length, banner: b ? b.querySelector('.prox-t').textContent + ' | ' + b.querySelector('.prox-d').textContent : '',
          tasti: b ? [...b.querySelectorAll('button')].map(x => x.textContent) : [] };
      });
      if (nome === 'negato') {
        /* «Apri» porta nel punto giusto anche dal banner. */
        await p.click('.prox.avv button.btn-primario');
        esiti.apri = await aspetta(p, () => document.getElementById('mActMenu').classList.contains('active') && document.getElementById('amName').textContent === 'Torre di Belém', null, 3000);
        esiti.via = await p.evaluate(() => !document.querySelector('.prox.avv'));
      }
      await p.close();
    }
    const banner = x => x.notifiche === 0 && /^⏰ Tra poco: Torre di Belém \| Inizia alle \d\d:\d\d$/.test(x.banner) && x.tasti.join(',') === 'Apri,Chiudi';
    ok('4. permesso negato: niente notifica, l\'avviso compare nell\'app come banner', banner(esiti.negato), JSON.stringify(esiti.negato));
    ok('4. notifiche che non ci sono (Safari): lo stesso banner', banner(esiti.mancano), JSON.stringify(esiti.mancano));
    ok('4. e così con il «no» dato dentro l\'app', banner(esiti.noNellApp), JSON.stringify(esiti.noNellApp));
    ok('4. «Apri» nel banner porta alla tappa, e il banner se ne va', esiti.apri && esiti.via, JSON.stringify({ apri: esiti.apri, via: esiti.via }));
  });

  /* ── 5. il primo GPS: un foglio solo, poi le due domande in ordine ──── */
  await prova('5', async () => {
    const p = await apri(browser, { st: stato({ consentNotif: undefined }), permesso: 'default', risposta: 'granted', statoPos: 'prompt' });
    await p.waitForTimeout(400);
    await p.evaluate(() => toggleGPS());
    await aspetta(p, () => document.getElementById('mNotif').classList.contains('active'), null, 3000);
    await p.waitForTimeout(450);
    const foglio = await p.evaluate(() => {
      const vede = id => { const el = document.getElementById(id); return !!el && getComputedStyle(el).display !== 'none'; };
      return { fogli: window.__fogli.slice(), titolo: document.getElementById('permT').textContent, pos: vede('permPos'), notif: vede('permNotif'),
        posTesto: document.getElementById('permPos').textContent, tasto: document.getElementById('permSi').textContent, richieste: window.__richieste.slice() };
    });
    ok('5. al primo GPS compare un foglio solo, che spiega posizione e avvisi', JSON.stringify(foglio.fogli) === JSON.stringify(['mNotif']) && foglio.pos && foglio.notif
       && /posizione/.test(foglio.posTesto) && /Posizione e avvisi/.test(foglio.titolo) && foglio.tasto === 'Continua' && !foglio.richieste.length, JSON.stringify(foglio));
    await p.click('#permSi');
    await aspetta(p, () => window.__richieste.length >= 2, null, 4000);
    await p.waitForTimeout(500);
    const dopo = await p.evaluate(() => ({ richieste: window.__richieste.slice(), fogli: window.__fogli.slice(), consenso: app.consentNotif, gps: gpsId !== null }));
    ok('5. con «Continua» il telefono chiede prima le notifiche, poi la posizione', JSON.stringify(dopo.richieste) === JSON.stringify(['notifiche', 'posizione']), JSON.stringify(dopo.richieste));
    ok('5. e nessun secondo foglio in mezzo; il GPS parte', JSON.stringify(dopo.fogli) === JSON.stringify(['mNotif']) && dopo.consenso === true && dopo.gps, JSON.stringify(dopo));
    /* Riacceso dopo, non chiede piu' niente. */
    const ancora = await p.evaluate(async () => {
      stopGPS(); window.__fogli.length = 0; await new Promise(x => setTimeout(x, 100));
      toggleGPS(); await new Promise(x => setTimeout(x, 300));
      return { fogli: window.__fogli.slice(), gps: gpsId !== null };
    });
    ok('5. riaccendendolo, niente fogli', !ancora.fogli.length && ancora.gps, JSON.stringify(ancora));
    await p.close();
    /* «Non ora» non accende niente, e la volta dopo si richiede. */
    const p2 = await apri(browser, { st: stato({ consentNotif: undefined }), permesso: 'default', statoPos: 'prompt' });
    await p2.waitForTimeout(400);
    await p2.evaluate(() => toggleGPS());
    await aspetta(p2, () => document.getElementById('mNotif').classList.contains('active'), null, 3000);
    await p2.waitForTimeout(400);
    await p2.click('#permNo');
    await p2.waitForTimeout(400);
    const no = await p2.evaluate(() => ({ richieste: window.__richieste.slice(), gps: gpsId !== null, consenso: app.consentNotif === undefined ? 'da chiedere' : app.consentNotif }));
    ok('5. «Non ora»: nessuna domanda, nessun GPS, e se ne riparla la prossima volta', !no.richieste.length && !no.gps && no.consenso === 'da chiedere', JSON.stringify(no));
    await p2.close();
  });

  /* ── 6. Safari senza Home ──────────────────────────────────────────── */
  await prova('6', async () => {
    const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
    /* Le notifiche finte ci sono apposta: anche dove esistessero, da Safari
       non si chiedono. */
    const p = await apri(browser, { st: stato({ consentNotif: undefined }), permesso: 'default', statoPos: 'prompt', ua: IPHONE, standalone: false });
    await p.waitForTimeout(400);
    await p.evaluate(() => toggleGPS());
    await aspetta(p, () => document.getElementById('mNotif').classList.contains('active'), null, 3000);
    await p.waitForTimeout(450);
    const foglio = await p.evaluate(() => {
      const vede = id => { const el = document.getElementById(id); return !!el && getComputedStyle(el).display !== 'none'; };
      return { safari: vede('permSafari'), notif: vede('permNotif'), pos: vede('permPos'), testo: document.getElementById('permSafari').innerText };
    });
    ok('6. Safari senza Home: il foglio spiega che le notifiche vogliono l\'app sulla Home', foglio.safari && !foglio.notif && foglio.pos
       && /solo con GeppGo aggiunta alla schermata Home/.test(foglio.testo) && /Come aggiungerla alla Home/.test(foglio.testo), JSON.stringify(foglio));
    await p.click('#permSi');
    await aspetta(p, () => window.__richieste.length >= 1, null, 3000);
    await p.waitForTimeout(400);
    const dopo = await p.evaluate(() => ({ richieste: window.__richieste.slice(), gps: gpsId !== null }));
    ok('6. e nessuna domanda delle notifiche: solo la posizione', JSON.stringify(dopo.richieste) === JSON.stringify(['posizione']) && dopo.gps, JSON.stringify(dopo));
    /* Un promemoria (solo avvisi): «Ho capito», niente domanda, una volta. */
    const soloAvvisi = await p.evaluate(async () => {
      localStorage.removeItem('geppgo2_notif_safari');
      window.__fogli.length = 0;
      chiediAvvisi(); await new Promise(x => setTimeout(x, 400));
      const vede = id => { const el = document.getElementById(id); return !!el && getComputedStyle(el).display !== 'none'; };
      return { aperto: document.getElementById('mNotif').classList.contains('active'), tasto: document.getElementById('permSi').textContent, nonOra: vede('permNo') };
    });
    await p.click('#permSi');
    await p.waitForTimeout(300);
    const unaVolta = await p.evaluate(async () => {
      window.__fogli.length = 0; chiediAvvisi(); await new Promise(x => setTimeout(x, 300));
      return { fogli: window.__fogli.slice(), richieste: window.__richieste.slice() };
    });
    ok('6. per un promemoria: «Ho capito», nessuna domanda, e non torna a ogni tappa', soloAvvisi.aperto && soloAvvisi.tasto === 'Ho capito' && !soloAvvisi.nonOra
       && !unaVolta.fogli.length && !unaVolta.richieste.includes('notifiche'), JSON.stringify({ soloAvvisi, unaVolta }));
    /* «Come aggiungerla alla Home» porta alla guida della miglioria 8. */
    await p.evaluate(async () => { localStorage.removeItem('geppgo2_notif_safari'); chiediAvvisi(); await new Promise(x => setTimeout(x, 400)); });
    await p.click('#permSafari button');
    const guida = await aspetta(p, () => document.getElementById('mHome').classList.contains('active'), null, 3000);
    ok('6. «Come aggiungerla alla Home» apre la guida', guida);
    /* E nel Profilo lo stesso, detto per Safari. */
    const profilo = await p.evaluate(() => { document.querySelectorAll('.modal.active').forEach(m => closeSheet(m)); go('trips');
      return { stato: document.getElementById('notifStato').textContent, tasto: document.getElementById('notifBtn').textContent }; });
    ok('6. e nel Profilo, al posto di «Attiva le notifiche», la strada per la Home', /schermata Home/.test(profilo.stato) && profilo.tasto === 'Come aggiungerla alla Home', JSON.stringify(profilo));
    await p.close();
  });

  /* ── 7. il testo del Profilo ───────────────────────────────────────── */
  await prova('7', async () => {
    const leggi = async (p) => p.evaluate(() => {
      go('trips');
      const card = [...document.querySelectorAll('#trips .card')].find(c => c.querySelector('#notifStato'));
      return card ? { titolo: card.querySelector('.card-h').textContent, testo: card.querySelector('p').textContent, stato: document.getElementById('notifStato').textContent,
        tasto: getComputedStyle(document.getElementById('notifBtn')).display !== 'none' ? document.getElementById('notifBtn').textContent : '' } : null;
    });
    const p = await apri(browser, { st: stato({ consentNotif: false }), permesso: 'default' });
    const it = await leggi(p);
    ok('7. nel Profilo c\'è la scheda «Avvisi e notifiche»: arrivano solo con GeppGo aperta, ad app chiusa non ancora', !!it && /Avvisi e notifiche/.test(it.titolo)
       && /solo mentre GeppGo è aperta/.test(it.testo) && /Con l'app chiusa.*non arrivano ancora/.test(it.testo), JSON.stringify(it));
    ok('7. con le notifiche spente lo dice, e c\'è il tasto per accenderle', !!it && /Notifiche spente/.test(it.stato) && it.tasto === 'Attiva le notifiche', JSON.stringify(it && { stato: it.stato, tasto: it.tasto }));
    await p.click('#notifBtn');
    await p.waitForTimeout(300);
    const acceso = await p.evaluate(() => ({ consenso: app.consentNotif, richieste: window.__richieste.slice(), stato: document.getElementById('notifStato').textContent }));
    ok('7. il tasto accende le notifiche anche dopo un «Non ora»', acceso.consenso === true && acceso.richieste.includes('notifiche') && /Notifiche attive/.test(acceso.stato), JSON.stringify(acceso));
    await p.close();
    const tradotti = {};
    for (const l of ['en', 'es', 'fr', 'pt']) {
      const q = await apri(browser, { st: stato({ consentNotif: false }), permesso: 'default', lingua: l });
      await q.waitForTimeout(500);
      const x = await leggi(q);
      const voci = await q.evaluate(lingua => ({ testo: DIZIONARIO[lingua]['Promemoria, ora di partire, tappe vicine e A raccolta arrivano solo mentre GeppGo è aperta: è lei a guardare l\'ora e dove sei. Con l\'app chiusa, o lasciata a lungo in secondo piano, non arrivano ancora.'],
        // dalla Layout 1 il titolo della scheda è senza la campanella: la chiave senza simbolo la aggiunge l'app
        titolo: DIZIONARIO[lingua]['Avvisi e notifiche'] }), l);
      tradotti[l] = !!x && !!voci.testo && x.testo === voci.testo && x.titolo === voci.titolo && !/arrivano|Notifiche spente/.test(x.testo + x.stato) ? '' : JSON.stringify(x).slice(0, 120);
      await q.close();
    }
    ok('7. ed è tradotto in inglese, spagnolo, francese e portoghese', Object.values(tradotti).every(x => !x), Object.entries(tradotti).filter(([, v]) => v).map(([k, v]) => k + ': ' + v).join(' | '));
  });

  /* ── 8. i testi nuovi in cinque lingue, e lo schermo ───────────────── */
  await prova('8', async () => {
    const p = await apri(browser);
    const FRASI = ['🔔 Gli avvisi di GeppGo', '🔔 Avvisi e notifiche', '📍 Posizione e avvisi', 'Come aggiungerla alla Home', 'Apri', 'Qualcuno', 'Tocca per vedere dove',
      'Notifiche spente: gli avvisi compaiono dentro l\'app.', 'Questa chiamata a raccolta è scaduta', '⏰ Tra poco: {1}', 'Inizia alle {1}', '📍 Accendi il GPS',
      'Per dirti quando partire per «{1}» mi serve sapere dove sei.', '📍 Sei già sul posto', '«{1}» inizia alle {2}, fra {3}.',
      'Sei a {1} e inizia alle {2}: arriveresti {3} in ritardo. Parti subito.', 'Sei a {1}, inizia alle {2}. Parti adesso o arrivi in ritardo.',
      'Per così poco la metro fa perdere tempo: meglio a piedi.', '🚦 Ora di partire per «{1}»', '📍 {1} è vicino!', 'A circa {1} m da te · tappa essenziale', 'A circa {1} m da te',
      'Nei dintorni: {1}', 'In linea col tuo viaggio · a circa {1} m', '🎟️ Prenotazione in scadenza', '{1}: prenota entro oggi', '{1}: prenota entro domani',
      '{1}: prenota entro {2} giorni', '{1} chiama a raccolta',
      'Subito dopo il telefono ti chiederà i due permessi, uno dopo l\'altro. Puoi cambiare idea quando vuoi dalle impostazioni.',
      'Su iPhone le notifiche arrivano solo con GeppGo aggiunta alla schermata Home: qui gli avvisi compaiono dentro l\'app.',
      'Questo browser non mostra notifiche: gli avvisi compaiono dentro l\'app.',
      'Notifiche attive: con GeppGo in secondo piano gli avvisi arrivano come notifiche del telefono.',
      'Le notifiche di GeppGo sono spente nelle impostazioni del telefono: gli avvisi compaiono dentro l\'app.'];
    const buchi = await p.evaluate(f => {
      const out = [];
      ['en', 'es', 'fr', 'pt'].forEach(l => f.forEach(x => { const v = DIZIONARIO[l][x]; if (!v || v === x) out.push(l + ': ' + x.slice(0, 40)); }));
      return out;
    }, FRASI);
    ok('8. i testi nuovi ci sono in inglese, spagnolo, francese e portoghese', !buchi.length, buchi.slice(0, 3).join(' | ') || FRASI.length + ' frasi × 4 lingue');
    /* Le segnaposto {1} {2} {3} restano tutte nella traduzione. */
    const segnaposto = await p.evaluate(f => {
      const out = [];
      ['en', 'es', 'fr', 'pt'].forEach(l => f.forEach(x => { const s = (x.match(/\{\d\}/g) || []).sort().join(''), v = ((DIZIONARIO[l][x] || '').match(/\{\d\}/g) || []).sort().join(''); if (s !== v) out.push(l + ': ' + x.slice(0, 30)); }));
      return out;
    }, FRASI);
    ok('8. e nelle traduzioni non si perde nessun {1}', !segnaposto.length, segnaposto.slice(0, 3).join(' | '));
    await p.close();
    /* Il foglio (le due forme), il banner e la scheda del Profilo, da 320 a
       430 px, in ogni lingua, chiaro e scuro. */
    const fuori = [], nonTradotti = [];
    const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
    for (const l of ['it', 'en', 'es', 'fr', 'pt']) {
      for (const larghezza of [320, 430]) {
        for (const scuro of [false, true]) {
          for (const safari of [false, true]) {
            if (safari && (larghezza === 430 || scuro)) continue;
            const q = await apri(browser, { st: stato({ consentNotif: undefined, settings: { proxRadius: 200, dark: scuro } }), permesso: 'default', statoPos: 'prompt',
              larghezza, lingua: l === 'it' ? null : l, ua: safari ? IPHONE : null, standalone: safari ? false : null });
            await q.waitForTimeout(400);
            const misura = await q.evaluate(async () => {
              const fuori = [];
              const controlla = (sel, dove) => document.querySelectorAll(sel).forEach(el => {
                const b = el.getBoundingClientRect();
                if (b.width && (b.left < -1 || b.right > innerWidth + 1 || el.scrollWidth > el.clientWidth + 2)) fuori.push(dove + ' ' + (el.id || el.className || el.tagName) + ' ' + Math.round(b.left) + '..' + Math.round(b.right));
              });
              toggleGPS(); await new Promise(x => setTimeout(x, 500));
              controlla('#mNotif .sheet, #mNotif .sheet *', 'foglio');
              const testi = [...document.querySelectorAll('#mNotif .sheet *')].filter(e => e.children.length === 0 && getComputedStyle(e).display !== 'none').map(e => e.textContent.trim()).filter(Boolean);
              closeSheet('mNotif'); await new Promise(x => setTimeout(x, 450));
              avvisa({ tipo: 'promemoria', titolo: tv('⏰ Tra poco: {1}', 'Museu Nacional do Azulejo, la visita guidata'), testo: tv('Inizia alle {1}', '10:30'), dove: { tipo: 'promemoria', trip: 1, att: 501 } });
              await new Promise(x => setTimeout(x, 300));
              controlla('.prox.avv, .prox.avv *', 'banner');
              const banner = [...document.querySelectorAll('.prox.avv button')].map(b => b.textContent);
              document.querySelectorAll('.prox').forEach(x => x.remove());
              go('trips'); await new Promise(x => setTimeout(x, 200));
              const card = document.getElementById('notifStato').closest('.card');
              card.scrollIntoView();
              controlla('#notifStato, #notifBtn', 'profilo');
              [...card.querySelectorAll('*')].forEach(el => { const b = el.getBoundingClientRect(); if (b.width && b.right > innerWidth + 1) fuori.push('profilo ' + (el.id || el.tagName)); });
              return { fuori, testi: testi.concat(banner, [card.querySelector('.card-h').textContent, card.querySelector('p').textContent, document.getElementById('notifStato').textContent]) };
            });
            misura.fuori.forEach(x => fuori.push(`${l} ${larghezza}${scuro ? ' scuro' : ''}${safari ? ' safari' : ''}: ${x}`));
            if (l !== 'it') {
              const italiane = misura.testi.filter(x => /\b(avvisi|notifiche|arrivano|telefono|Continua|Chiudi|Apri|Tra poco|Inizia alle|aggiungerla|Ho capito)\b/.test(x));
              italiane.forEach(x => nonTradotti.push(`${l}: ${x.slice(0, 50)}`));
            }
            await q.close();
          }
        }
      }
    }
    ok('8. da 320 a 430 px, chiaro e scuro, il foglio, il banner e la scheda del Profilo stanno nello schermo', !fuori.length, fuori.slice(0, 4).join(' | ') || '5 lingue × 2 larghezze × chiaro/scuro, e Safari');
    ok('8. e nelle altre lingue non resta niente in italiano', !nonTradotti.length, nonTradotti.slice(0, 4).join(' | '));
  });

  ok('nessun errore in pagina', !errori.length, errori.slice(0, 3).join(' | '));
  await browser.close();
  r.forEach(x => console.log(x));
  const falliti = r.filter(x => x.includes('FALLITO')).length;
  console.log(`\n${r.length - falliti}/${r.length} passati`);
  process.exit(falliti ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
