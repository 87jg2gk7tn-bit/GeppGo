/* IL PRIMO IMPATTO.

   Quello che vede chi apre GeppGo per la prima volta, e quello che lo fa
   sembrare un'app fatta bene o un esperimento:
   1. il cambio di una spesa non cambia da solo quando la si corregge;
   2. all'apertura nessuno chiede la posizione, e la home resta piena;
   3. chi il permesso l'aveva gia' dato non vede niente di nuovo;
   4. «Cosa cerchi qui intorno?» spiega prima di far chiedere il permesso;
   5. la presentazione: una volta sola, si salta, non a chi arriva da un
      invito, in tutte e cinque le lingue;
   6. la schermata di accesso: tre scelte, un tocco solo per registrarsi, e
      la conferma via email detta chiara;
   7. nessun messaggio da sviluppatore («Passo 9», «GUIDA-AI.md», «ponte»,
      «Worker», «Supabase») in nessuna lingua;
   8. il pannello del cloud non ha piu' un tasto, si apre tenendo premuta la
      versione, e il link d'invito si incolla in «Ho un codice»;
   9. niente che esca dallo schermo da 320 a 430 px, «Cosa cerchi» su una
      riga, e la pubblicita' al suo posto per chi non e' premium. */
const { apriBrowser, APP, leafletJs, RADICE } = require('./browser');
const fs = require('fs');
const path = require('path');

const OGGI = new Date().toISOString().split('T')[0];
const GIORNO = 86400000;
const DI_SERIE = 'https://cyolhqndurgwbivxcssf.supabase.co';
const TABELLA_EUR = { EUR: 1, JPY: 160, USD: 1.1 };

const viaggio = (extra = {}, spese = []) => Object.assign({
  trips: [{ id: 1730000000088, name: 'Giappone', destination: 'Kyoto', currency: 'EUR', status: 'open',
    start: OGGI, end: OGGI, participants: [{ id: 1, name: 'Gepp', isMe: true }, { id: 2, name: 'Jak' }],
    destLoc: { lat: 35.0116, lng: 135.7681 }, destTipo: 'city',
    suggested: [], pois: [], hotels: [], tickets: [], weather: {}, createdAt: 1,
    expenses: spese, days: [{ id: 'd1', date: OGGI, title: '', activities: [] }] }],
  currentTripId: 1730000000088, settings: { proxRadius: 200 }, myName: 'Gepp', skipAuth: true, consentNotif: true
}, extra);

/* Un finto supabase-js: quanto basta perche' la schermata di accesso si
   apra e la registrazione risponda come il servizio vero - con la sessione,
   o senza (e' la conferma via email). Tutto il resto risponde vuoto. */
const SUPA_FINTO = conSessione => `(()=>{
  const vuoto={data:[],error:null};
  const catena=()=>{const f=function(){};const p=new Proxy(f,{get:(t,k)=>k==='then'?(ok=>ok(vuoto)):(()=>p),apply:()=>p});return p;};
  let ascolta=null;
  window.__iscrizioni=0;
  const auth={
    onAuthStateChange(cb){ascolta=cb;return{data:{subscription:{unsubscribe(){}}}};},
    async getSession(){return{data:{session:null},error:null};},
    async signUp(o){window.__iscrizioni++;
      if(${conSessione}){const s={user:{id:'u-nuovo',email:o.email},access_token:'x'};setTimeout(()=>ascolta&&ascolta('SIGNED_IN',s),0);return{data:{user:s.user,session:s},error:null};}
      return{data:{user:{id:'u-nuovo',email:o.email,identities:[{id:'i1'}]},session:null},error:null};},
    async signInWithPassword(){return{data:{},error:{message:'Invalid login credentials'}};},
    async signOut(){return{error:null};},
    async setSession(){return{data:{},error:{message:'no'}};},
    async exchangeCodeForSession(){return{data:{},error:{message:'no'}};}
  };
  const client=new Proxy({auth},{get:(t,k)=>k in t?t[k]:(k==='then'?undefined:catena())});
  window.supabase={createClient:()=>client};
})();`;

const r = [];
const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);
const errori = [];

/* Apre l'app come la aprirebbe un telefono: lo stato si mette solo al primo
   caricamento (ricaricando resta quello che l'app ha salvato), e ogni
   richiesta di posizione si conta. */
async function apri(browser, { stato = null, intro = false, locale = 'it-IT', permessi = null, geo = null,
  larghezza = 390, hash = '', supabase = null, rotte = null } = {}) {
  const opz = { viewport: { width: larghezza, height: 800 }, locale };
  if (permessi) opz.permissions = permessi;
  if (geo) opz.geolocation = geo;
  const page = await browser.newPage(opz);
  page.on('pageerror', e => errori.push('PAGEERROR: ' + e.message.split('\n')[0]));
  await page.route('**/leaflet@1.9.4/dist/leaflet.js', ro => ro.fulfill({
    status: 200, contentType: 'application/javascript', body: fs.readFileSync(leafletJs(), 'utf8') }));
  await page.route(/tile\.openstreetmap\.org/, ro => ro.abort());
  await page.route('**/v6/latest/**', ro => ro.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ result: 'success', base_code: 'EUR', time_last_update_unix: Math.floor(Date.now() / 1000), rates: TABELLA_EUR }) }));
  /* Qualunque versione: l'app la fissa (vedi LE LIBRERIE), la prova no. */
  if (supabase !== null) await page.route('**/supabase-js@*/**', ro => ro.fulfill({ status: 200, contentType: 'application/javascript', body: SUPA_FINTO(supabase) }));
  if (rotte) await rotte(page);
  await page.addInitScript(([s, conIntro]) => {
    const g = navigator.geolocation;
    window.__pos = { get: 0, watch: 0 };
    if (g) {
      const og = g.getCurrentPosition.bind(g), ow = g.watchPosition.bind(g);
      g.getCurrentPosition = function (...a) { window.__pos.get++; return og(...a); };
      g.watchPosition = function (...a) { window.__pos.watch++; return ow(...a); };
    }
    if (sessionStorage.getItem('prova-primo')) return;
    sessionStorage.setItem('prova-primo', '1');
    localStorage.clear();
    if (s) localStorage.setItem('geppgo2', JSON.stringify(s));
    if (!conIntro) localStorage.setItem('geppgo2_intro', '1');
  }, [stato, intro]);
  await page.goto(APP + hash, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.renderAll === 'function' && typeof window.addExpense === 'function', { timeout: 20000 });
  await page.waitForTimeout(1600);
  return page;
}
const prova = async (nome, fn) => {
  try { await fn(); } catch (e) { ok(nome, false, 'si è fermata: ' + e.message.split('\n')[0]); }
};
const visibile = (p, sel) => p.evaluate(s => {
  const el = document.querySelector(s); if (!el) return false;
  const r = el.getBoundingClientRect(), st = getComputedStyle(el);
  return r.width > 0 && r.height > 0 && st.display !== 'none' && st.visibility !== 'hidden' && st.opacity !== '0';
}, sel);
const attivo = (p, id) => p.evaluate(i => { const m = document.getElementById(i); return !!m && m.classList.contains('active'); }, id);

(async () => {
  const browser = await apriBrowser();

  /* ── 1. il cambio salvato resta quello della spesa ─────────────────── */
  await prova('1', async () => {
    const cinque = Date.now() - 5 * GIORNO;
    const sushi = { id: 201, desc: 'Sushi', category: 'Cibo', amount: 10000 / 150, origAmount: 10000, origCurrency: 'JPY',
      rate: 1 / 150, cambioData: cinque, payerId: 1, splitAmong: [1, 2], date: OGGI + 'T12:00:00', paid: true };
    const p = await apri(browser, { stato: viaggio({}, [sushi]) });
    const data = await p.evaluate(ms => new Date(ms).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }), cinque);
    await p.evaluate(() => { go('money'); openExpense(201); });
    await p.waitForTimeout(500);
    await p.fill('#expDesc', 'Sushi buono');
    await p.fill('#expAmt', '20000');
    await p.waitForTimeout(400);
    const anteprima = await p.evaluate(() => document.getElementById('expConv').textContent);
    ok('1. modificando, l\'anteprima usa il cambio salvato con la spesa, non quello di oggi',
       /€133,33/.test(anteprima) && anteprima.includes(data), anteprima + ' (atteso il cambio del ' + data + ')');
    await p.click('#mExpense button[onclick="addExpense()"]');
    await p.waitForTimeout(500);
    let e = await p.evaluate(() => JSON.parse(JSON.stringify(T().expenses.find(x => x.id === 201))));
    ok('1. descrizione e importo cambiano, il cambio no',
       e.desc === 'Sushi buono' && e.origAmount === 20000 && e.rate === 1 / 150 && Math.abs(e.amount - 20000 / 150) < 0.005 && e.cambioData === cinque,
       JSON.stringify({ desc: e.desc, cambio: e.rate, importo: e.amount, stessaData: e.cambioData === cinque }));
    // cambiando valuta si ricalcola
    await p.evaluate(() => openExpense(201));
    await p.waitForTimeout(400);
    await p.evaluate(() => { const s = document.getElementById('expCur'); s.value = 'USD'; s.dispatchEvent(new Event('change')); });
    await p.fill('#expAmt', '100');
    await p.waitForTimeout(500);
    await p.click('#mExpense button[onclick="addExpense()"]');
    await p.waitForTimeout(500);
    e = await p.evaluate(() => JSON.parse(JSON.stringify(T().expenses.find(x => x.id === 201))));
    ok('1. cambiando la valuta il cambio si ricalcola, con quello di oggi',
       e.origCurrency === 'USD' && Math.abs(e.rate - 1 / 1.1) < 1e-9 && Math.abs(e.amount - 100 / 1.1) < 0.005 && e.cambioData > cinque + GIORNO,
       JSON.stringify({ valuta: e.origCurrency, cambio: e.rate, importo: e.amount }));
    await p.close();
  });

  /* ── 2. primo avvio: nessuna richiesta di posizione ─────────────────── */
  await prova('2', async () => {
    let p = await apri(browser, { intro: true });
    await p.waitForTimeout(1500);
    const vuoto = await p.evaluate(() => window.__pos);
    ok('2. primo avvio a profilo vuoto: nessuna richiesta di posizione all\'apertura',
       vuoto.get === 0 && vuoto.watch === 0, JSON.stringify(vuoto));
    await p.close();
    /* Con un viaggio, e senza permesso: la home prende citta' e meteo dalla
       destinazione. Il servizio del meteo risponde solo se gli si chiede il
       punto di Kyoto: se l'app chiedesse il meteo di dove sei, resterebbe
       muto. */
    const chiesti = [];
    p = await apri(browser, { stato: viaggio(), rotte: async pg => {
      await pg.route('**/api.open-meteo.com/**', ro => {
        const u = new URL(ro.request().url());
        chiesti.push(u.searchParams.get('latitude') + ',' + u.searchParams.get('longitude'));
        if (u.searchParams.get('latitude') !== '35.0116') return ro.abort();
        ro.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ timezone: 'Asia/Tokyo', utc_offset_seconds: 32400, daily: {
          time: [OGGI], weather_code: [0], temperature_2m_max: [19.4], temperature_2m_min: [8], precipitation_sum: [0],
          wind_speed_10m_max: [5], sunset: [OGGI + 'T17:10'], sunrise: [OGGI + 'T06:00'] } }) });
      });
    } });
    await p.waitForTimeout(1500);
    const home = await p.evaluate(() => ({
      pos: window.__pos,
      citta: (document.querySelector('#homeHero .hh-city') || {}).textContent || '',
      grado: (document.querySelector('#homeHero .hh-grado-solo') || {}).textContent || '',
      cerca: !!document.querySelector('#homeHero .hh-cerca'),
      foglio: document.getElementById('mPosizione').classList.contains('active')
    }));
    ok('2. con un viaggio, ancora nessuna richiesta di posizione e nessun foglio',
       home.pos.get === 0 && home.pos.watch === 0 && !home.foglio, JSON.stringify(home.pos));
    ok('2. la home ha la città della destinazione', /Kyoto/.test(home.citta), home.citta);
    ok('2. e il meteo, preso sulla destinazione', /19/.test(home.grado) && chiesti.includes('35.0116,135.7681'),
       home.grado + ' · chiesto per ' + chiesti.join(' '));
    ok('2. e i tasti di sempre', home.cerca);
    await p.close();
  });

  /* ── 3. il permesso c'era gia': tutto come prima ─────────────────────── */
  await prova('3', async () => {
    const p = await apri(browser, { stato: viaggio(), permessi: ['geolocation'], geo: { latitude: 45.4642, longitude: 9.19 } });
    await p.evaluate(() => {
      window.__foglio = 0;
      new MutationObserver(() => { if (document.getElementById('mPosizione').classList.contains('active')) window.__foglio++; })
        .observe(document.getElementById('mPosizione'), { attributes: true, attributeFilter: ['class'] });
    });
    await p.waitForFunction(() => typeof myPos !== 'undefined' && myPos, { timeout: 8000 }).catch(() => {});
    const avvio = await p.evaluate(() => ({ pos: window.__pos, myPos }));
    ok('3. con il permesso già dato, la posizione si usa all\'apertura come prima',
       avvio.pos.get >= 1 && avvio.myPos && Math.abs(avvio.myPos.lat - 45.4642) < 0.001, JSON.stringify(avvio));
    await p.click('#homeHero .hh-cerca');
    await p.waitForTimeout(400);
    await p.click('#mCerca .cerca-voce:has-text("Bagno")').catch(() => p.evaluate(() => { closeSheet('mCerca'); cercaVicino('bagno'); }));
    await p.waitForTimeout(800);
    await p.evaluate(() => { closeSheet('mBagno'); toggleGPS(); });
    await p.waitForTimeout(1200);
    const dopo = await p.evaluate(() => ({ foglio: window.__foglio, gps: gpsId !== null, aperto: document.getElementById('mPosizione').classList.contains('active') }));
    ok('3. «Cosa cerchi» e il GPS partono senza fogli in più', dopo.foglio === 0 && !dopo.aperto && dopo.gps, JSON.stringify(dopo));
    await p.close();
  });

  /* ── 4. senza permesso: prima il perché, poi la richiesta ───────────── */
  await prova('4', async () => {
    const p = await apri(browser, { stato: viaggio() });
    await p.click('#homeHero .hh-cerca');
    await p.waitForTimeout(400);
    await p.click('#mCerca .cerca-voce:has-text("Bagno")');
    await p.waitForTimeout(500);
    let f = await p.evaluate(() => ({ aperto: document.getElementById('mPosizione').classList.contains('active'),
      testo: document.getElementById('mPosizione').innerText, pos: Object.assign({}, window.__pos) }));
    ok('4. «Cosa cerchi qui intorno?» senza permesso: prima compare il foglio che spiega',
       f.aperto && /cercare cosa c'è intorno a te/.test(f.testo) && /Continua/.test(f.testo) && /Non ora/.test(f.testo), f.testo.replace(/\s+/g, ' ').slice(0, 90));
    ok('4. e la richiesta al telefono non è ancora partita', f.pos.get === 0, JSON.stringify(f.pos));
    await p.click('#mPosizione button:has-text("Non ora")');
    await p.waitForTimeout(400);
    const no = await p.evaluate(() => ({ pos: Object.assign({}, window.__pos), testo: document.getElementById('bagnoBody').innerText }));
    ok('4. «Non ora»: nessuna richiesta, e la scheda dice perché è vuota',
       no.pos.get === 0 && /Senza la posizione non posso cercare qui intorno/.test(no.testo), no.testo.replace(/\s+/g, ' ').slice(0, 80));
    await p.click('#bagnoBody button:has-text("Usa la posizione")');
    await p.waitForTimeout(400);
    ok('4. ritoccando, il foglio torna', await attivo(p, 'mPosizione'));
    await p.click('#mPosizione button:has-text("Continua")');
    await p.waitForTimeout(600);
    const si = await p.evaluate(() => Object.assign({}, window.__pos));
    ok('4. e dopo «Continua» parte la richiesta del telefono', si.get === 1, JSON.stringify(si));
    /* Lo stesso vale per il GPS («dove sono» sulla mappa, avvisi vicino alle
       tappe), in un telefono nuovo. */
    const p2 = await apri(browser, { stato: viaggio() });
    await p2.evaluate(() => toggleGPS());
    await p2.waitForTimeout(400);
    const g = await p2.evaluate(() => ({ aperto: document.getElementById('mPosizione').classList.contains('active'), pos: Object.assign({}, window.__pos),
      testo: document.getElementById('posPerche').textContent }));
    ok('4. anche il GPS chiede col foglio, prima del permesso', g.aperto && g.pos.get === 0 && /mostrarti sulla mappa/.test(g.testo), g.testo);
    await p2.close();
    await p.close();
  });

  /* ── 5. la presentazione ─────────────────────────────────────────────── */
  await prova('5', async () => {
    let p = await apri(browser, { intro: true });
    const prima = await p.evaluate(() => ({ titoli: [...document.querySelectorAll('#intro .intro-t')].map(x => x.textContent), tasto: document.getElementById('introAvanti').textContent }));
    ok('5. al primissimo avvio c\'è la presentazione, tre schermate',
       await visibile(p, '#intro') && prima.titoli.join('|') === 'Il viaggio, giorno per giorno|Tutto il gruppo in un\'app|Conti chiari in ogni valuta' && prima.tasto === 'Avanti',
       prima.titoli.join(' | '));
    await p.click('#introAvanti'); await p.waitForTimeout(700);
    await p.click('#introAvanti'); await p.waitForTimeout(700);
    const ultima = await p.evaluate(() => document.getElementById('introAvanti').textContent);
    await p.click('#introAvanti'); await p.waitForTimeout(500);
    ok('5. si scorre con «Avanti» e l\'ultima dice «Inizia»', ultima === 'Inizia' && !(await visibile(p, '#intro')), ultima);
    await p.reload({ waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof window.renderAll === 'function', { timeout: 20000 });
    await p.waitForTimeout(1200);
    ok('5. riaprendo l\'app non ricompare', !(await visibile(p, '#intro')));
    await p.close();

    p = await apri(browser, { intro: true });
    await p.click('#intro .intro-salta'); await p.waitForTimeout(500);
    const saltata = await p.evaluate(() => localStorage.getItem('geppgo2_intro'));
    ok('5. «Salta» la chiude subito, e conta come vista', !(await visibile(p, '#intro')) && saltata === '1', String(saltata));
    await p.close();

    for (const h of ['#join2=' + encodeURIComponent('abc:def'), '#join=xyz']) {
      p = await apri(browser, { intro: true, hash: h });
      ok(`5. chi arriva da un invito (${h.slice(0, 7)}…) non la vede`, !(await visibile(p, '#intro')));
      await p.close();
    }

    const diz = await (async () => { const q = await apri(browser, { stato: viaggio() }); const d = await q.evaluate(() => DIZIONARIO); await q.close(); return d; })();
    const frasi = ['Il viaggio, giorno per giorno', 'Tappe, orari e mappa in un\'unica time table.', 'Tutto il gruppo in un\'app',
      'Biglietti con QR e hotel assegnati a ognuno.', 'Conti chiari in ogni valuta', 'Le spese si dividono da sole, anche in yen o dollari.', 'Salta'];
    for (const [l, loc] of [['it', 'it-IT'], ['en', 'en-US'], ['es', 'es-ES'], ['fr', 'fr-FR'], ['pt', 'pt-PT']]) {
      p = await apri(browser, { intro: true, locale: loc });
      /* Elemento per elemento, a frase intera: «Saltar» contiene «Salta», e
         un confronto a pezzi lo scambierebbe per italiano. */
      const visti = await p.evaluate(() => [...document.querySelectorAll('#intro .intro-t, #intro .intro-s, #intro .intro-salta')].map(x => x.textContent.trim()));
      const attese = frasi.map(f => l === 'it' ? f : diz[l][f]);
      const mancano = attese.filter(f => !f || !visti.includes(f));
      const italiano = l !== 'it' && frasi.some(f => visti.includes(f));
      ok(`5. la presentazione in ${l}`, !mancano.length && !italiano, (mancano[0] || '') + (italiano ? ' (resta italiano)' : ''));
      await p.close();
    }
  });

  /* ── 6. la schermata di accesso ──────────────────────────────────────── */
  await prova('6', async () => {
    let p = await apri(browser, { supabase: false });
    const scelte = await p.evaluate(() => {
      const g = document.getElementById('authGate');
      const tasti = [...document.querySelectorAll('#auScelta button')].map(b => { const r = b.getBoundingClientRect();
        return { t: b.textContent.trim(), h: Math.round(r.height), dentro: r.width > 0 && r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight }; });
      return { aperta: getComputedStyle(g).display !== 'none', tasti, riga: (document.querySelector('#auScelta .au-perche') || {}).textContent || '' };
    });
    const nomi = scelte.tasti.map(x => x.t);
    ok('6. la schermata di accesso ha tre scelte grandi e visibili',
       scelte.aperta && ['Crea un account', 'Accedi', 'Prova senza account'].every(n => nomi.includes(n)) && scelte.tasti.every(x => x.dentro && x.h >= 44),
       JSON.stringify(scelte.tasti));
    ok('6. con la riga su cosa cambia', /tutti i tuoi dispositivi/.test(scelte.riga) && /solo su questo telefono/.test(scelte.riga), scelte.riga);
    await p.click('#auScelta button:has-text("Crea un account")');
    await p.fill('#auEmail', 'gepp@esempio.it');
    await p.fill('#auPass', 'segreta123');
    await p.fill('#auPass2', 'segreta123');
    await p.click('#auBtnUp');
    await p.waitForTimeout(500);
    const mail = await p.evaluate(() => ({ n: window.__iscrizioni, testo: document.getElementById('auMailInviata').innerText,
      vis: getComputedStyle(document.getElementById('auMailInviata')).display !== 'none' }));
    ok('6. «Crea account» registra al primo tocco', mail.n === 1, 'registrazioni: ' + mail.n);
    ok('6. con la conferma via email, lo dice chiaro',
       mail.vis && mail.testo.includes('Ti abbiamo mandato un\'email: apri il link per confermare, poi torna qui') && mail.testo.includes('gepp@esempio.it'),
       mail.testo.replace(/\s+/g, ' ').slice(0, 100));
    await p.close();
    // senza conferma via email: un tocco e si entra
    p = await apri(browser, { supabase: true });
    await p.click('#auScelta button:has-text("Crea un account")');
    await p.fill('#auEmail', 'gepp@esempio.it');
    await p.fill('#auPass', 'segreta123');
    await p.fill('#auPass2', 'segreta123');
    await p.click('#auBtnUp');
    await p.waitForTimeout(800);
    const dentro = await p.evaluate(() => ({ n: window.__iscrizioni, gate: getComputedStyle(document.getElementById('authGate')).display }));
    ok('6. senza conferma via email, un tocco e si è dentro', dentro.n === 1 && dentro.gate === 'none', JSON.stringify(dentro));
    await p.close();
    // «Prova senza account»
    p = await apri(browser, { supabase: false });
    await p.click('#auScelta button:has-text("Prova senza account")');
    await p.waitForTimeout(300);
    const senza = await p.evaluate(() => ({ gate: getComputedStyle(document.getElementById('authGate')).display, skip: app.skipAuth }));
    ok('6. «Prova senza account» entra subito', senza.gate === 'none' && senza.skip === true, JSON.stringify(senza));
    await p.close();
  });

  /* ── 7. nessun messaggio da sviluppatore ─────────────────────────────── */
  await prova('7', async () => {
    const VIETATE = /\bpasso\b|\bguida\b|\bponte\b|\bworker\b|supabase/i;
    const TECNICI = ['new row violates row-level security policy', 'Bucket not found', 'relation "public.raccolte" does not exist',
      'API key not valid. Please pass a valid API key.', 'models/gemini-x is no longer available', 'Failed to fetch',
      'Invalid login credentials', 'User already registered', 'Email not confirmed', 'weird PGRST301 server error'];
    const trovate = [];
    for (const [l, loc] of [['it', 'it-IT'], ['en', 'en-US'], ['es', 'es-ES'], ['fr', 'fr-FR'], ['pt', 'pt-PT']]) {
      const p = await apri(browser, { stato: viaggio({ settings: { proxRadius: 200, lingua: l } }), locale: loc });
      const testi = await p.evaluate(async errs => {
        const fuori = [];
        for (const pg of ['plan', 'discover', 'money', 'hotels', 'tickets', 'identify', 'trips']) {
          go(pg); await new Promise(x => setTimeout(x, 250)); fuori.push(document.body.innerText);
        }
        openSheet('mCode'); await new Promise(x => setTimeout(x, 300)); fuori.push(document.getElementById('mCode').innerText); closeSheet('mCode');
        errs.forEach(m => {
          const e = { message: m };
          fuori.push(spiegaErroreAccesso(e), erroreCloud(e), fotoSpiega(e), raccoltaSpiega(e), motivoAI(m));
        });
        return fuori;
      }, TECNICI);
      testi.forEach(x => { const m = String(x).match(VIETATE); if (m) trovate.push(l + ': «' + m[0] + '» in ' + String(x).slice(Math.max(0, m.index - 40), m.index + 40).replace(/\s+/g, ' ')); });
      await p.close();
    }
    ok('7. nessun testo a schermo, né messaggio d\'errore, parla da sviluppatore, in nessuna lingua', !trovate.length, trovate.slice(0, 2).join(' | '));
    // la schermata di accesso e la presentazione, che si vedono prima di tutto
    const p = await apri(browser, { supabase: false, intro: true });
    const prime = await p.evaluate(() => document.getElementById('intro').innerText + '\n' + document.getElementById('authGate').innerText);
    ok('7. nemmeno presentazione e schermata di accesso', !VIETATE.test(prime), (prime.match(VIETATE) || [''])[0]);
    await p.close();
    /* E nei dizionari, dove le frasi aspettano di essere usate: nessuna
       traduzione di «guida, Passo 9» e simili. Fanno eccezione solo le voci
       del pannello tecnico del cloud, che serve a chi ha un Supabase suo e
       non si apre per sbaglio (prova 8). */
    const q = await apri(browser, { stato: viaggio() });
    const diz = await q.evaluate(() => {
      const mcloud = document.getElementById('mCloud').innerText;
      const out = [];
      ['en', 'es', 'fr', 'pt'].forEach(l => Object.entries(DIZIONARIO[l]).forEach(([k, v]) => out.push({ l, k, v, mcloud: mcloud.includes(k) })));
      return out;
    });
    await q.close();
    const VIETATE_DIZ = /(passo|paso|step|étape)\s*\d|GUIDA-AI|\bguida\b|\.md\b|\bponte\b|\bworker\b|supabase/i;
    const sporche = diz.filter(x => !x.mcloud && (VIETATE_DIZ.test(x.k) || VIETATE_DIZ.test(x.v)));
    ok('7. e nemmeno nelle traduzioni, fuori dal pannello tecnico', !sporche.length, sporche.slice(0, 2).map(x => x.l + ': ' + x.v).join(' | '));
  });

  /* ── 8. il pannello del cloud nascosto, l'invito in «Ho un codice» ──── */
  await prova('8', async () => {
    let p = await apri(browser, { stato: viaggio() });
    await p.evaluate(() => go('trips'));
    await p.waitForTimeout(400);
    const link = await p.evaluate(() => ({ nelTesto: document.body.innerText.includes('Usa un cloud tuo'),
      tasto: [...document.querySelectorAll('button')].some(b => /openCloudCfg/.test(b.getAttribute('onclick') || '')) }));
    ok('8. «Usa un cloud tuo» non c\'è più nel Profilo', !link.nelTesto && !link.tasto, JSON.stringify(link));
    await p.locator('#verRiga').scrollIntoViewIfNeeded();
    await p.dispatchEvent('#verRiga', 'pointerdown');
    await p.waitForTimeout(600);
    await p.dispatchEvent('#verRiga', 'pointerup');
    await p.waitForTimeout(2000);
    ok('8. un tocco breve sulla versione non apre niente', !(await attivo(p, 'mCloud')));
    await p.dispatchEvent('#verRiga', 'pointerdown');
    await p.waitForTimeout(2300);
    await p.dispatchEvent('#verRiga', 'pointerup');
    ok('8. tenendola premuta due secondi si apre il pannello del cloud', await attivo(p, 'mCloud'));
    await p.close();

    // un invito vero incollato in «Ho un codice»
    const b64 = s => Buffer.from(s).toString('base64');
    const CID = '11111111-2222-3333-4444-555555555555', INV = 'invitoProva';
    p = await apri(browser, { stato: viaggio({ trips: [], currentTripId: null }) });
    await p.click('#homeHero button:has-text("Ho un codice")');
    await p.waitForTimeout(400);
    const campo = await visibile(p, '#mCode #cfgInvito');
    ok('8. «Ho un codice» ha il campo per il link d\'invito', campo && await attivo(p, 'mCode'));
    const linkVero = '#join2=' + encodeURIComponent(CID + ':' + INV + '~' + b64(DI_SERIE + '|k'));
    const riavvio = p.waitForNavigation({ timeout: 15000 }).catch(() => {});
    await p.fill('#cfgInvito', 'https://esempio.github.io/GeppGo/' + linkVero);
    await p.click('#mCode button:has-text("Usa questo link")');
    await riavvio;
    await p.waitForFunction(() => typeof window.renderAll === 'function', { timeout: 20000 }).catch(() => {});
    await p.waitForTimeout(400);
    const dopo = await p.evaluate(() => ({ attesa: typeof pendingJoin2 === 'undefined' ? 'nessuno' : pendingJoin2, cfg: localStorage.getItem('geppgo_cfg') }));
    ok('8. un invito vero incollato lì riparte sull\'invito, senza salvare il server', dopo.attesa === CID + ':' + INV && dopo.cfg === null, JSON.stringify(dopo));
    await p.close();

    // e uno con un server finto viene rifiutato
    p = await apri(browser, { stato: viaggio({ trips: [], currentTripId: null }) });
    await p.click('#homeHero button:has-text("Ho un codice")');
    await p.waitForTimeout(400);
    await p.evaluate(() => { window.__resta = 'questa pagina'; });
    const linkFinto = '#join2=' + encodeURIComponent(CID + ':' + INV + '~' + b64('https://server-finto.example.com|k'));
    await p.fill('#cfgInvito', 'https://esempio.github.io/GeppGo/' + linkFinto);
    await p.click('#mCode button:has-text("Usa questo link")');
    await p.waitForTimeout(1300);
    const finto = await p.evaluate(() => ({ resta: window.__resta, cfg: localStorage.getItem('geppgo_cfg'), msg: document.getElementById('cfgInvMsg').textContent,
      avviso: document.getElementById('mConfirm').classList.contains('active') ? document.getElementById('cfTitle').textContent : '' }));
    ok('8. un invito con un server finto viene rifiutato: niente salvato, niente riavvio, avviso',
       finto.resta === 'questa pagina' && finto.cfg === null && finto.msg === 'Questo invito non è valido' && finto.avviso === 'Questo invito non è valido', JSON.stringify(finto));
    await p.close();
  });

  /* ── 9. da 320 a 430 px ──────────────────────────────────────────────── */
  await prova('9', async () => {
    /* Esce dallo schermo un elemento visibile che sborda a destra o a
       sinistra. Si lasciano stare solo le strisce che scorrono di proposito
       (la barra in basso, la fila dei giorni, le schede delle tappe) e i
       contenitori che tagliano su tutti e due gli assi (la mappa). Un foglio
       che scorre in verticale NON scusa niente: un campo che esce a destra
       resta tagliato anche li' dentro, ed e' proprio il difetto da trovare. */
    const sborda = (p, sel) => p.evaluate(s => {
      const W = innerWidth;
      const STRISCE = '.nav-track, .hh-days, .hh-cards, .hh-trips, .chip-row';
      const taglia = q => { const st = getComputedStyle(q); return /(hidden|clip)/.test(st.overflowX) && /(hidden|clip)/.test(st.overflowY); };
      const scusato = el => { const su = el.parentElement; if (su && su.closest(STRISCE)) return true;
        for (let q = su; q && q !== document.documentElement; q = q.parentElement) if (taglia(q)) return true; return false; };
      const radici = [...document.querySelectorAll(s)];
      const fuori = radici.flatMap(rad => [rad, ...rad.querySelectorAll('*')]).filter(e => {
        const r = e.getBoundingClientRect(); if (!r.width || !r.height) return false;
        const st = getComputedStyle(e); if (st.display === 'none' || st.visibility === 'hidden') return false;
        if (r.right <= W + 1 && r.left >= -1) return false;
        return !scusato(e);
      }).slice(0, 4).map(e => (e.id ? '#' + e.id : e.tagName.toLowerCase()) + '.' + String(e.className || '').split(' ')[0] + ' ' + Math.round(e.getBoundingClientRect().left) + '→' + Math.round(e.getBoundingClientRect().right));
      /* E nessun contenitore deve scorrere di lato senza volerlo. */
      radici.forEach(rad => { if (rad.scrollWidth > rad.clientWidth + 1 && !rad.closest(STRISCE)) fuori.push((rad.id || rad.className) + ' scorre di lato: ' + rad.scrollWidth + '>' + rad.clientWidth); });
      return fuori;
    }, sel);
    for (const w of [320, 360, 390, 430]) {
      const p = await apri(browser, { stato: viaggio({ premium: false }), larghezza: w });
      const home = await sborda(p, '.topbar, #plan');
      const cerca = await p.evaluate(() => {
        const b = document.querySelector('#homeHero .hh-cerca');
        const l = [...b.querySelectorAll('span')].find(s => getComputedStyle(s).display !== 'none');
        const r = b.getBoundingClientRect();
        /* Le righe vere del testo: un Range da' un rettangolo per riga. */
        const rg = document.createRange(); rg.selectNodeContents(l);
        const righe = new Set([...rg.getClientRects()].map(q => Math.round(q.top))).size;
        return { h: Math.round(r.height), righe, tagliata: l.scrollWidth > l.clientWidth + 1, testo: l.textContent };
      });
      const pubbl = await p.evaluate(() => [...document.querySelectorAll('#plan .ad-slot')].some(a => { const r = a.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(a).display !== 'none'; }));
      await p.evaluate(() => openNewTrip());
      await p.waitForTimeout(500);
      const nuovo = await sborda(p, '#mNewTrip .sheet');
      ok(`9. a ${w} px niente esce dallo schermo in Home e in «Nuovo viaggio»`, !home.length && !nuovo.length, home.concat(nuovo).join(' | '));
      ok(`9. a ${w} px «${cerca.testo}» sta su una riga, alto almeno 44 px`, cerca.righe === 1 && !cerca.tagliata && cerca.h >= 44, JSON.stringify(cerca));
      ok(`9. a ${w} px la pubblicità resta visibile per chi non è premium`, pubbl);
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
