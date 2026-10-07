/* I TEMPI FRA LE TAPPE, E IL NAVIGATORE CHE NON C'E' PIU'.

   Il navigatore interno disegnava un percorso a piedi chiesto a
   router.project-osrm.org, che sa fare solo l'auto. Adesso ogni tasto apre
   Apple Maps o Google Maps col mezzo del tratto, e in time-table i tempi a
   piedi, in bici e in auto sono quelli veri sulle strade, chiesti alle
   istanze di FOSSGIS (una per mezzo), con le loro regole: una richiesta al
   secondo, mai mentre si trascina, e la risposta tenuta nel telefono.
   Coi mezzi pubblici resta una stima, col «≈».

   Il servizio qui e' finto: la prova decide cosa risponde e quando, e conta
   le richieste. Le prove:
   1. spesa «da verificare» col cambio scritto a mano: l'etichetta sparisce;
   2. del navigatore interno e di OSRM nel codice non resta niente;
   3. ogni tasto apre Google Maps o Apple Maps col mezzo giusto;
   4. chi aveva scelto il navigatore interno sceglie al primo uso, e resta;
   5. a piedi, in bici e in auto la richiesta va all'istanza giusta, e il
      tempo mostrato e' quello della risposta, senza «≈»;
   6. treno, metro e bus: nessuna richiesta, tempo col «≈»;
   7. riaprendo non si richiede, e senza rete i tempi veri restano;
   8. servizio in errore o lento oltre 8 secondi: la stima col «≈»;
   9. spostando tappe di fila: mai piu' di una richiesta al secondo, e
      nessuna mentre si trascina;
   10. una tappa spostata in un altro posto: il tempo si ricalcola;
   11. testi in cinque lingue, e niente fuori schermo da 320 a 430 px. */
const { apriBrowser, APP, leafletJs, RADICE } = require('./browser');
const fs = require('fs');
const path = require('path');

/* Il file letto e' quello aperto nel browser: con APP_URL la controprova
   sul codice vecchio controlla davvero il codice vecchio. */
const FILE_APP = APP.startsWith('file://') ? decodeURIComponent(APP.slice(7)) : path.join(RADICE, 'Index 2.1.html');
const OGGI = new Date().toISOString().split('T')[0];
const r = [];
const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);
const errori = [];

const tappa = (id, nome, ora, fine, lat, lng, extra = {}) => Object.assign({ id, name: nome, time: ora, timeEnd: fine, lat, lng,
  type: 'outdoor', who: [1, 2], completed: false, booking: { needed: false, done: false } }, extra);
/* Una giornata coi sei mezzi, uno per tratto: si arriva a ogni tappa col
   mezzo scritto su di lei. */
const SEI = [
  tappa(11, 'Senso-ji', '08:00', '09:00', 35.7148, 139.7967),
  tappa(12, 'Ueno', '10:00', '11:00', 35.7138, 139.7770, { segTravelMode: 'walk' }),
  tappa(13, 'Akihabara', '12:00', '13:00', 35.6984, 139.7731, { segTravelMode: 'bike' }),
  tappa(14, 'Tokyo Tower', '14:00', '15:00', 35.6586, 139.7454, { segTravelMode: 'car' }),
  tappa(15, 'Yokohama', '16:30', '17:30', 35.4437, 139.6380, { segTravelMode: 'rail' }),
  tappa(16, 'Shibuya', '19:00', '20:00', 35.6595, 139.7005, { segTravelMode: 'train' }),
  tappa(17, 'Shinjuku', '21:00', '22:00', 35.6896, 139.7006, { segTravelMode: 'bus' })
];
const viaggio = (attivita, extra = {}, spese = []) => Object.assign({
  trips: [{ id: 1, name: 'Tokyo', destination: 'Tokyo', currency: 'EUR', status: 'open', start: OGGI, end: OGGI,
    participants: [{ id: 1, name: 'Gepp', isMe: true }, { id: 2, name: 'Jak' }], suggested: [], pois: [], hotels: [], tickets: [],
    weather: {}, createdAt: 1, expenses: spese,
    days: [{ id: 'd1', date: OGGI, title: '', travelMode: 'walk', activities: attivita }] }],
  currentTripId: 1, settings: { proxRadius: 200 }, myName: 'Gepp', skipAuth: true, consentNotif: true
}, extra);
/* Le risposte del servizio, diverse per istanza: cosi' si vede da dove
   viene il numero a schermo. */
const RISPOSTE = { 'routed-foot': { distance: 2100, duration: 1500 }, 'routed-bike': { distance: 2300, duration: 600 }, 'routed-car': { distance: 2600, duration: 420 } };

async function apri(browser, stato, { servizio = {}, larghezza = 390, lingua = null, rotte = null } = {}) {
  const page = await browser.newPage({ viewport: { width: larghezza, height: 900 } });
  const serv = Object.assign({ modo: 'ok', ritardo: {}, chiamate: [], risposta: null }, servizio);
  page.__serv = serv;
  page.on('pageerror', e => errori.push('PAGEERROR: ' + e.message.split('\n')[0]));
  await page.route('**/leaflet@1.9.4/dist/leaflet.js', ro => ro.fulfill({
    status: 200, contentType: 'application/javascript', body: fs.readFileSync(leafletJs(), 'utf8') }));
  await page.route(/tile\.openstreetmap\.org/, ro => ro.abort());
  await page.route('**/routing.openstreetmap.de/**', ro => {
    const u = ro.request().url();
    const istanza = u.split('/')[3];
    const coord = decodeURIComponent(u.split('/driving/')[1].split('?')[0]);
    serv.chiamate.push({ t: Date.now(), istanza, coord });
    if (serv.modo === 'errore' || (serv.errore && serv.errore.includes(istanza))) return ro.fulfill({ status: 500, body: 'rotto' });
    const ris = serv.risposta ? serv.risposta(istanza, coord) : RISPOSTE[istanza];
    const manda = () => ro.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 'Ok', routes: [ris] }) }).catch(() => {});
    const ms = serv.ritardo[istanza] || 0;
    if (ms) setTimeout(manda, ms); else manda();
  });
  if (rotte) await rotte(page);
  /* Lo stato si semina una volta sola per pagina: ricaricando deve restare
     quello che l'app ha salvato. Il segno sta anche nella memoria che si
     protegge, cosi' una ricarica che perdesse il sessionStorage non
     riseminerebbe da capo (vedi apriBrowser). */
  await page.addInitScript(([s, l]) => {
    if (localStorage.getItem('prova-tempi') || sessionStorage.getItem('prova-tempi')) return;
    localStorage.clear();
    const st = JSON.parse(JSON.stringify(s)); if (l) st.settings.lingua = l;
    localStorage.setItem('geppgo2', JSON.stringify(st));
    localStorage.setItem('geppgo2_intro', '1');
    localStorage.setItem('prova-tempi', '1');
    sessionStorage.setItem('prova-tempi', '1');
  }, [stato, lingua]);
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.openDay === 'function' && typeof window.renderAll === 'function', { timeout: 20000 });
  await page.waitForTimeout(1200);
  return page;
}
const prova = async (nome, fn) => {
  try { await fn(); } catch (e) { ok(nome, false, 'si è fermata: ' + e.message.split('\n')[0]); }
};
/* I tratti a schermo, per tappa d'arrivo: il testo della striscia (o della
   riga dell'orario, quando le tappe sono attaccate). */
const tratti = p => p.evaluate(() => {
  const out = {};
  document.querySelectorAll('#ttBody .tt-travel-shown').forEach(el => {
    const m = el.querySelector('.tt-travel-mezzo'), q = el.querySelector('.tt-travel-quanto');
    out[(m ? m.textContent.replace('▾', '').trim() : '') + ' ' + (q ? q.textContent.trim() : el.textContent.trim())] = true;
  });
  return Object.keys(out);
});
const trattoDi = (lista, emoji) => lista.find(x => x.startsWith(emoji)) || '';

(async () => {
  const browser = await apriBrowser();

  /* ── 1. il cambio scritto a mano chiude il «da verificare» ─────────── */
  await prova('1', async () => {
    const sushi = { id: 5, desc: 'Sushi', category: 'Cibo', amount: 10000, origAmount: 10000, origCurrency: 'JPY', rate: 1,
      payerId: 1, splitAmong: [1, 2], date: OGGI + 'T12:00:00', paid: true };
    const p = await apri(browser, viaggio([], {}, [sushi]));
    await p.waitForTimeout(800);
    const prima = await p.evaluate(() => ({ foglio: document.getElementById('mCambiVerifica').classList.contains('active'), stato: T().expenses[0].cambioStato }));
    ok('1. all\'apertura la spesa è «da verificare»', prima.foglio && prima.stato === 'verifica', JSON.stringify(prima));
    await p.evaluate(() => { closeSheet('mCambiVerifica'); go('money'); openExpense(5); });
    await p.waitForTimeout(500);
    await p.fill('#expCambio', '0,006');
    await p.waitForTimeout(300);
    await p.click('#mExpense button[onclick="addExpense()"]');
    await p.waitForTimeout(500);
    const dopo = await p.evaluate(() => {
      const e = T().expenses[0];
      const riga = [...document.querySelectorAll('#money .exp-row')].map(x => x.innerText).join(' ');
      cambiControllati.clear(); controllaCambiDaVerificare();
      return { stato: e.cambioStato || null, mano: e.cambioManuale, cambio: e.rate, conta: speseDaVerificare(T()).length,
        etichetta: /da verificare/.test(riga), foglio: document.getElementById('mCambiVerifica').classList.contains('active') };
    });
    ok('1. scritto il cambio a mano, l\'etichetta «da verificare» sparisce', !dopo.stato && dopo.mano === true && dopo.cambio === 0.006 && !dopo.etichetta, JSON.stringify(dopo));
    ok('1. e l\'avviso all\'apertura non la conta più', dopo.conta === 0 && !dopo.foglio, JSON.stringify({ conta: dopo.conta, foglio: dopo.foglio }));
    const salvata = await p.evaluate(() => JSON.parse(localStorage.getItem('geppgo2')).trips[0].expenses[0]);
    await p.reload({ waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof window.renderAll === 'function' && !document.getElementById('bootSplash'), { timeout: 20000 });
    await p.waitForTimeout(1500);
    /* Se cade, la riga dice cosa c'era nel telefono prima e dopo la ricarica. */
    const riaperta = await p.evaluate(() => ({ foglio: document.getElementById('mCambiVerifica').classList.contains('active'),
      e: (JSON.parse(localStorage.getItem('geppgo2')).trips[0].expenses || [])[0] }));
    ok('1. nemmeno riaprendo l\'app', !riaperta.foglio, JSON.stringify({ prima: { stato: salvata.cambioStato, mano: salvata.cambioManuale, rate: salvata.rate },
      dopo: riaperta.e && { stato: riaperta.e.cambioStato, mano: riaperta.e.cambioManuale, rate: riaperta.e.rate } }));
    await p.close();
  });

  /* ── 2. niente navigatore interno, niente OSRM ──────────────────────── */
  await prova('2', async () => {
    const html = fs.readFileSync(FILE_APP, 'utf8');
    const swAccanto = path.join(path.dirname(FILE_APP), 'sw.js');
    const sw = fs.readFileSync(fs.existsSync(swAccanto) ? swAccanto : path.join(RADICE, 'sw.js'), 'utf8');
    const resti = ['internalNav', 'router.project-osrm.org', 'endNav', '.navbar{', "value=\"internal\""].filter(x => html.includes(x) || sw.includes(x));
    ok('2. nel codice non resta nessun riferimento a internalNav né a router.project-osrm.org', !resti.length, resti.join(', '));
    const dove = ['PERCORSI_SERVIZI', 'routed-foot', 'routed-bike', 'routed-car'].filter(x => !html.includes(x));
    ok('2. gli indirizzi del servizio dei percorsi stanno in un punto solo', !dove.length && (html.match(/routing\.openstreetmap\.de/g) || []).length === 3, dove.join(', '));
  });

  /* ── 3. ogni tasto apre il navigatore giusto, col mezzo giusto ──────── */
  await prova('3', async () => {
    const p = await apri(browser, viaggio(SEI));
    const prova3 = await p.evaluate(async () => {
      window.__aperti = []; apriFuori = u => window.__aperti.push(u);
      const esito = {};
      for (const nav of ['google', 'apple']) {
        app.settings.nav = nav;
        for (const m of MEZZI) {
          window.__aperti = []; openNav(35.66, 139.70, 'X', m);
          await new Promise(x => setTimeout(x, nav === 'google' ? 1000 : 50));
          esito[nav + ':' + m] = window.__aperti.slice();
        }
      }
      return esito;
    });
    const G = { walk: 'walking', bike: 'bicycling', car: 'driving', rail: 'transit', train: 'transit', bus: 'transit' };
    const A = { walk: 'w', bike: 'w', car: 'd', rail: 'r', train: 'r', bus: 'r' };
    const sbagliati = [];
    Object.keys(G).forEach(m => {
      const g = prova3['google:' + m] || [];
      if (!g.some(u => u.startsWith('comgooglemaps://') && u.includes('directionsmode=' + G[m]))
        || !g.some(u => u.startsWith('https://www.google.com/maps/dir/?api=1') && u.includes('travelmode=' + G[m]))) sbagliati.push('google ' + m + ': ' + g.join(' '));
      const a = prova3['apple:' + m] || [];
      if (a.length !== 1 || !a[0].startsWith('maps://') || !a[0].includes('dirflg=' + A[m])) sbagliati.push('apple ' + m + ': ' + a.join(' '));
    });
    ok('3. Google Maps col travelmode giusto e Apple Maps col dirflg giusto, per tutti e sei i mezzi (in bici Apple a piedi)', !sbagliati.length, sbagliati.slice(0, 2).join(' | '));
    // i tasti veri: «🧭 Naviga» nel menu della tappa, col mezzo del tratto
    const tasti = await p.evaluate(async () => {
      app.settings.nav = 'google';
      const out = {};
      for (const [id, nome] of [[13, 'bike'], [14, 'car'], [16, 'train']]) {
        window.__aperti = [];
        tapAct(0, id); await new Promise(x => setTimeout(x, 300));
        const b = document.getElementById('amNavBtn');
        if (b && b.style.display !== 'none') b.click();
        await new Promise(x => setTimeout(x, 1000));
        out[nome] = window.__aperti.slice();
        document.querySelectorAll('.modal.active').forEach(m => closeSheet(m));
      }
      // la scheda della tappa
      window.__aperti = []; adRef = { di: 0, id: 12 }; navFromDetail(); await new Promise(x => setTimeout(x, 1000));
      out.dettaglio = window.__aperti.slice();
      return out;
    });
    ok('3. «🧭 Naviga» nel menu di una tappa usa il mezzo con cui ci si arriva',
       tasti.bike.some(u => /travelmode=bicycling/.test(u)) && tasti.car.some(u => /travelmode=driving/.test(u)) && tasti.train.some(u => /travelmode=transit/.test(u)),
       JSON.stringify({ bike: tasti.bike.length, car: tasti.car.length, train: tasti.train.length }));
    ok('3. e così la scheda della tappa', tasti.dettaglio.some(u => /travelmode=walking/.test(u)), tasti.dettaglio.join(' '));
    // con «Chiedimelo ogni volta» il foglio offre solo Apple e Google
    const chiedi = await p.evaluate(() => {
      app.settings.nav = 'ask'; window.__aperti = [];
      openNav(35.66, 139.70, 'Shibuya', 'car');
      const testo = document.getElementById('navBody').innerText;
      return { aperto: document.getElementById('mNav').classList.contains('active'), testo, scelte: document.querySelectorAll('#navBody .rcard').length };
    });
    ok('3. «Chiedimelo»: il foglio offre Apple Maps e Google Maps, e basta',
       chiedi.aperto && chiedi.scelte === 2 && !/GeppGo/.test(chiedi.testo) && /in macchina/.test(chiedi.testo), chiedi.testo.replace(/\s+/g, ' ').slice(0, 90));
    await p.click('#navBody .rcard:has-text("Google Maps")');
    await p.waitForTimeout(1000);
    const scelto = await p.evaluate(() => ({ aperti: window.__aperti.slice(), nav: app.settings.nav }));
    ok('3. e la scelta apre col mezzo del tratto', scelto.aperti.some(u => /travelmode=driving/.test(u)) && scelto.nav === 'ask', JSON.stringify(scelto));
    await p.close();
  });

  /* ── 4. chi aveva il navigatore interno ─────────────────────────────── */
  await prova('4', async () => {
    const p = await apri(browser, viaggio(SEI, { settings: { proxRadius: 200, nav: 'internal' } }));
    const profilo = await p.evaluate(() => ({ valore: document.getElementById('navPref').value,
      voci: [...document.querySelectorAll('#navPref option')].map(o => o.value) }));
    ok('4. nel Profilo l\'opzione del navigatore interno non c\'è più', !profilo.voci.includes('internal') && profilo.valore === 'ask', JSON.stringify(profilo));
    const primo = await p.evaluate(() => {
      window.__aperti = []; apriFuori = u => window.__aperti.push(u);
      openNav(35.66, 139.70, 'Ueno', 'walk');
      return { aperto: document.getElementById('mNav').classList.contains('active'), testo: document.getElementById('navBody').innerText,
        scelte: [...document.querySelectorAll('#navBody .rcard .rlbl')].map(x => x.textContent), ricorda: !!document.getElementById('navRemember') };
    });
    ok('4. al primo uso vede la scelta fra Google Maps e Apple Maps',
       primo.aperto && primo.scelte.join('|') === 'Mappe di Apple|Google Maps' && /non c'è più/.test(primo.testo) && !primo.ricorda, JSON.stringify(primo.scelte));
    await p.click('#navBody .rcard:has-text("Mappe di Apple")');
    await p.waitForTimeout(400);
    const dopo = await p.evaluate(() => ({ nav: app.settings.nav, salvato: JSON.parse(localStorage.getItem('geppgo2')).settings.nav, aperti: window.__aperti.slice(),
      profilo: document.getElementById('navPref').value }));
    ok('4. la scelta viene salvata', dopo.nav === 'apple' && dopo.salvato === 'apple' && dopo.profilo === 'apple' && dopo.aperti.some(u => u.startsWith('maps://')), JSON.stringify(dopo));
    const poi = await p.evaluate(() => { window.__aperti = []; openNav(35.66, 139.70, 'Ueno', 'car'); return { aperto: document.getElementById('mNav').classList.contains('active'), aperti: window.__aperti.slice() }; });
    ok('4. e dalla volta dopo apre diretto, senza chiedere', !poi.aperto && poi.aperti.length === 1 && /dirflg=d/.test(poi.aperti[0]), JSON.stringify(poi));
    await p.close();
  });

  /* ── 5, 6, 7. i tempi veri, e le stime dei mezzi pubblici ──────────── */
  await prova('5-6-7', async () => {
    const p = await apri(browser, viaggio(SEI));
    await p.evaluate(() => openDay(0));
    await p.waitForTimeout(600);
    const subito = await tratti(p);
    ok('5. finché la risposta non c\'è, a piedi/bici/auto si vede la stima col «≈»',
       ['🚶', '🚲', '🚗'].every(e => /≈/.test(trattoDi(subito, e))), subito.join(' | '));
    await p.waitForTimeout(5500);
    const serv = p.__serv;
    const istanze = serv.chiamate.map(c => c.istanza);
    ok('5. a piedi la richiesta va a routed-foot, in bici a routed-bike, in auto a routed-car',
       istanze.sort().join(',') === 'routed-bike,routed-car,routed-foot', istanze.join(','));
    /* La coppia giusta per l'istanza giusta: a piedi Senso-ji → Ueno. */
    const piedi = serv.chiamate.find(c => c.istanza === 'routed-foot');
    ok('5. con le coordinate del tratto (lon,lat;lon,lat)', piedi && piedi.coord === '139.7967,35.7148;139.777,35.7138', piedi && piedi.coord);
    const veri = await tratti(p);
    ok('5. i tempi mostrati sono quelli della risposta, senza «≈»',
       trattoDi(veri, '🚶') === '🚶 25 min · 2.1 km' && trattoDi(veri, '🚲') === '🚲 10 min · 2.3 km' && /^🚗 7 min · 2\.6 km/.test(trattoDi(veri, '🚗')),
       ['🚶', '🚲', '🚗'].map(e => trattoDi(veri, e)).join(' | '));
    ok('6. con treno, metro e bus non parte nessuna richiesta', serv.chiamate.length === 3, serv.chiamate.length + ' richieste');
    ok('6. e il tempo è mostrato con «≈»', ['🚆', '🚇', '🚌'].every(e => /≈/.test(trattoDi(veri, e))), ['🚆', '🚇', '🚌'].map(e => trattoDi(veri, e)).join(' | '));
    const conto = await p.evaluate(() => {
      const t = T(), d = t.days[0], m = (a, b, mode) => travelEstimate(d, hav(a, b), mode, false).minutes;
      const A = d.activities;
      return { metro: m(A[4], A[5], 'train'), bus: m(A[5], A[6], 'bus'), treno: m(A[3], A[4], 'rail'),
        kmMetro: hav(A[4], A[5]) / 1000 };
    });
    /* Metro: 12 minuti fissi + (km * 1,2) / 30 km/h. */
    const attesoMetro = 12 + Math.max(1, Math.round(conto.kmMetro * 1.2 / 30 * 60));
    ok('6. la stima dei mezzi pubblici conta i minuti fissi di fermata e attesa', conto.metro === attesoMetro && conto.treno > 20 && conto.bus > 12, JSON.stringify(conto) + ' atteso metro ' + attesoMetro);
    // 7. riaprendo la giornata non si richiede niente
    await p.evaluate(() => { go('plan'); });
    await p.waitForTimeout(300);
    await p.evaluate(() => openDay(0));
    await p.waitForTimeout(2500);
    ok('7. riaprendo la giornata non partono richieste nuove', serv.chiamate.length === 3, serv.chiamate.length + ' richieste');
    // senza rete, dopo il primo calcolo
    await p.context().setOffline(true);
    await p.reload({ waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof window.openDay === 'function', { timeout: 20000 });
    await p.waitForTimeout(800);
    await p.evaluate(() => openDay(0));
    await p.waitForTimeout(2500);
    const offline = await tratti(p);
    ok('7. senza rete i tempi veri restano visibili', trattoDi(offline, '🚶') === '🚶 25 min · 2.1 km' && trattoDi(offline, '🚲') === '🚲 10 min · 2.3 km', ['🚶', '🚲'].map(e => trattoDi(offline, e)).join(' | '));
    ok('7. e non parte niente', serv.chiamate.length === 3, serv.chiamate.length + ' richieste');
    await p.context().setOffline(false);
    await p.close();
  });

  /* ── 8. servizio rotto o lento ──────────────────────────────────────── */
  await prova('8', async () => {
    const p = await apri(browser, viaggio(SEI.slice(0, 3)), { servizio: { errore: ['routed-foot'], ritardo: { 'routed-bike': 9500 } } });
    await p.evaluate(() => openDay(0));
    await p.waitForTimeout(12500);
    const lista = await tratti(p);
    const serv = p.__serv;
    ok('8. il servizio è stato chiamato', serv.chiamate.length === 2, serv.chiamate.map(c => c.istanza).join(','));
    ok('8. con l\'errore resta la stima col «≈»', /^🚶 ≈ /.test(trattoDi(lista, '🚶')), trattoDi(lista, '🚶'));
    ok('8. oltre 8 secondi anche', /^🚲 ≈ /.test(trattoDi(lista, '🚲')), trattoDi(lista, '🚲'));
    await p.close();
  });

  /* ── 9. tappe spostate di fila ──────────────────────────────────────── */
  await prova('9', async () => {
    const quattro = [
      tappa(21, 'A', '08:00', '09:00', 35.70, 139.70), tappa(22, 'B', '10:00', '11:00', 35.71, 139.71),
      tappa(23, 'C', '12:00', '13:00', 35.72, 139.72), tappa(24, 'D', '14:00', '15:00', 35.73, 139.73)];
    const p = await apri(browser, viaggio(quattro));
    await p.evaluate(() => openDay(0));
    await p.waitForTimeout(5000);
    const serv = p.__serv;
    const prime = serv.chiamate.length;
    /* Due trascinamenti di fila: B dopo C, poi D prima di C. Ogni volta
       cambiano le coppie (si arriva da un'altra tappa) e servono richieste
       nuove; mentre il dito tiene la tappa non ne deve partire nessuna. */
    const tenute = [];
    const trascina = async (id, dy) => {
      const b = await p.locator(`#ttBody .tt-block[data-id="${id}"]`).boundingBox();
      const x = b.x + b.width / 2, y = b.y + 12;
      await p.mouse.move(x, y);
      await p.mouse.down();
      const da = Date.now();
      await p.waitForTimeout(700);
      await p.mouse.move(x, y + dy / 2, { steps: 4 });
      await p.waitForTimeout(800);
      await p.mouse.move(x, y + dy, { steps: 4 });
      await p.waitForTimeout(800);
      tenute.push([da, Date.now()]);
      await p.mouse.up();
    };
    await trascina(22, 64 * 3.5);
    await p.waitForTimeout(300);
    await trascina(24, -64 * 3.5);
    await p.waitForTimeout(9000);
    const t = serv.chiamate.map(c => c.t);
    const passi = t.slice(1).map((x, i) => x - t[i]);
    const durante = serv.chiamate.filter(c => tenute.some(([a, b]) => c.t > a && c.t < b));
    ok('9. spostando tappe di fila partono le richieste per le coppie nuove', serv.chiamate.length > prime, prime + ' → ' + serv.chiamate.length);
    ok('9. mai più di una richiesta al secondo', passi.every(x => x >= 1000), passi.join(','));
    ok('9. e nessuna mentre si trascina', !durante.length, durante.length + ' durante');
    const ordine = await p.evaluate(() => T().days[0].activities.map(a => a.name + ' ' + a.time).join(', '));
    ok('9. (i trascinamenti hanno spostato davvero le tappe)', /B 1[3-4]/.test(ordine) && /D 1[01]/.test(ordine), ordine);
    await p.close();
  });

  /* ── 10. una tappa in un altro posto ────────────────────────────────── */
  await prova('10', async () => {
    const p = await apri(browser, viaggio(SEI.slice(0, 2)), { servizio: {
      risposta: (ist, coord) => coord.endsWith('139.777,35.7138') ? { distance: 2100, duration: 1500 } : { distance: 5400, duration: 3900 } } });
    await p.evaluate(() => openDay(0));
    await p.waitForTimeout(3500);
    const prima = trattoDi(await tratti(p), '🚶');
    await p.evaluate(() => { const a = T().days[0].activities.find(x => x.id === 12); a.lat = 35.6895; a.lng = 139.6917; save(); buildTT(); });
    await p.waitForTimeout(600);
    const subito = trattoDi(await tratti(p), '🚶');
    await p.waitForTimeout(3500);
    const dopo = trattoDi(await tratti(p), '🚶');
    const serv = p.__serv;
    ok('10. spostata la tappa, il tempo vecchio non vale più (torna la stima)', prima === '🚶 25 min · 2.1 km' && /≈/.test(subito), prima + ' → ' + subito);
    ok('10. e si ricalcola con le coordinate nuove', serv.chiamate.length === 2 && serv.chiamate[1].coord === '139.7967,35.7148;139.6917,35.6895' && dopo === '🚶 65 min · 5.4 km',
       serv.chiamate.map(c => c.coord).join(' | ') + ' → ' + dopo);
    await p.close();
  });

  /* ── 11. lingue e schermi ───────────────────────────────────────────── */
  await prova('11', async () => {
    const p0 = await apri(browser, viaggio([]));
    const diz = await p0.evaluate(() => typeof DIZIONARIO_TEMPI === 'object' ? DIZIONARIO_TEMPI : null);
    await p0.close();
    const html = fs.readFileSync(FILE_APP, 'utf8');
    const chiavi = diz ? Object.keys(diz.en) : [];
    const buchi = [];
    ['en', 'es', 'fr', 'pt'].forEach(l => chiavi.forEach(k => { if (!diz[l][k] || !diz[l][k].trim()) buchi.push(l + ': ' + k); }));
    const nonUsate = chiavi.filter(k => html.split(k.replace(/'/g, "\\'")).length - 1 < 5 && html.split(k).length - 1 < 5);
    ok(`11. le ${chiavi.length} frasi nuove ci sono in inglese, spagnolo, francese e portoghese`, chiavi.length >= 20 && !buchi.length && !nonUsate.length, buchi.concat(nonUsate).slice(0, 3).join(' | '));
    for (const [l, attesi] of [['en', ['by bike', 'Real time on the actual roads']], ['es', ['en bici', 'Estimación con parada y espera']],
      ['fr', ['à vélo', 'Temps sur les vraies routes']], ['pt', ['de comboio', 'Estimativa com paragem e espera']]]) {
      const p = await apri(browser, viaggio(SEI.slice(0, 3)), { lingua: l });
      await p.evaluate(() => openDay(0));
      await p.waitForTimeout(500);
      await p.click('#ttBody .tt-travel-mezzo');
      await p.waitForTimeout(400);
      const testo = await p.evaluate(() => document.getElementById('mMezzo').innerText);
      ok(`11. la scelta del mezzo in ${l}`, attesi.every(x => testo.includes(x)) && !/in bici|Tempo sulle strade/.test(testo), testo.replace(/\s+/g, ' ').slice(0, 80));
      await p.close();
    }
    /* Niente fuori schermo: la time-table, i fogli del mezzo e del navigatore,
       chiari e scuri. Si scusano solo le strisce che scorrono di proposito e i
       contenitori che tagliano su tutti e due gli assi. */
    const sborda = (p, sel) => p.evaluate(s => {
      const W = innerWidth, STRISCE = '.nav-track, .hh-days, .hh-cards, .hh-trips, .chip-row, .tt-days';
      const taglia = q => { const st = getComputedStyle(q); return /(hidden|clip)/.test(st.overflowX) && /(hidden|clip)/.test(st.overflowY); };
      const scusato = el => { const su = el.parentElement; if (su && su.closest(STRISCE)) return true;
        for (let q = su; q && q !== document.documentElement; q = q.parentElement) if (taglia(q)) return true; return false; };
      return [...document.querySelectorAll(s)].flatMap(rad => [rad, ...rad.querySelectorAll('*')]).filter(e => {
        const r = e.getBoundingClientRect(); if (!r.width || !r.height) return false;
        const st = getComputedStyle(e); if (st.display === 'none' || st.visibility === 'hidden') return false;
        return (r.right > W + 1 || r.left < -1) && !scusato(e);
      }).slice(0, 3).map(e => (e.id || e.className || e.tagName) + ' ' + Math.round(e.getBoundingClientRect().left) + '→' + Math.round(e.getBoundingClientRect().right));
    }, sel);
    for (const w of [320, 360, 390, 430]) for (const scuro of [false, true]) {
      const p = await apri(browser, viaggio(SEI, { settings: { proxRadius: 200, dark: scuro } }), { larghezza: w });
      await p.evaluate(() => openDay(0));
      await p.waitForTimeout(500);
      const tt = await sborda(p, '#ttBody');
      /* Su una riga, e col numero intero: i puntini di sospensione
         nasconderebbero proprio i minuti. */
      const una = await p.evaluate(() => [...document.querySelectorAll('#ttBody .tt-travel-shown')].every(el => el.scrollHeight <= el.clientHeight + 2)
        && [...document.querySelectorAll('#ttBody .tt-travel-quanto')].every(el => el.scrollWidth <= el.clientWidth + 1));
      await p.click('#ttBody .tt-travel-mezzo');
      await p.waitForTimeout(400);
      const mz = await sborda(p, '#mMezzo .sheet');
      await p.evaluate(() => { closeSheet('mMezzo'); app.settings.nav = 'ask'; openNav(35.6, 139.7, 'Un posto con un nome piuttosto lungo per vedere', 'bike'); });
      await p.waitForTimeout(400);
      const nv = await sborda(p, '#mNav .sheet');
      ok(`11. a ${w} px, tema ${scuro ? 'scuro' : 'chiaro'}: time-table e fogli dentro lo schermo`, !tt.length && !mz.length && !nv.length && una, tt.concat(mz, nv).join(' | '));
      await p.close();
    }
  });

  ok('nessun errore in pagina', !errori.length, errori.slice(0, 3).join(' | '));
  console.log('\n' + r.join('\n'));
  const falliti = r.filter(x => x.includes('FALLITO')).length;
  console.log(`\n${r.length - falliti}/${r.length} passati`);
  await browser.close();
  process.exit(falliti ? 1 : 0);
})();
