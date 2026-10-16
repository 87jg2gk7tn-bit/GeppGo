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
const { apriBrowser, APP, RADICE, leafletJs } = require('./browser');

const r = [];
const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);
const errori = [];
const SCELTE = process.argv.slice(2).filter(a => /^\d$/.test(a));
const fare = n => !SCELTE.length || SCELTE.includes(String(n));
const LINGUE = ['en', 'es', 'fr', 'pt'];
const NOME_LINGUA = { it: 'italiano', en: 'inglese', es: 'spagnolo', fr: 'francese', pt: 'portoghese' };

/* ── il viaggio di prova ───────────────────────────────────────────────────
   Pieno apposta: con un viaggio vuoto metà delle frasi non si disegna mai.
   L'orologio sta a mezzogiorno del primo giorno, così la tappa delle 12 è in
   corso (l'anello di «Fra poco» dice «ora») a qualunque ora girino le prove. */
const giornoA = s => { const b = new Date(); return new Date(b.getFullYear(), b.getMonth(), b.getDate() + s, 12, 0, 0); };
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const D = [0, 1, 2, 3].map(i => iso(giornoA(i)));
const meteo = (d, code) => ({ code, tempMax: 21, tempMin: 12, precipitation: code > 50 ? 6 : 0, windSpeed: 9, sunrise: d + 'T06:40', sunset: d + 'T18:20', luogo: 'Kyoto' });
const att = (id, name, time, timeEnd, lat, lng, extra = {}) => Object.assign({ id, name, time, timeEnd, lat, lng, who: [1, 2], completed: false, type: 'outdoor', booking: { needed: false, done: false }, notes: '' }, extra);
const VIAGGIO = {
  id: 1, name: 'Giappone', destination: 'Tokyo', currency: 'JPY', status: 'open', start: D[0], end: D[3],
  participants: [{ id: 1, name: 'Zelda', isMe: true }, { id: 2, name: 'Yuri' }, { id: 3, name: 'Ximena' }],
  guests: [], suggestOn: true, interests: 'arte', suggested: [],
  pois: [{ id: 91, name: 'Fushimi Inari', lat: 34.967, lng: 135.772, address: 'Kyoto', priority: 'essential', notes: '' },
         { id: 92, name: 'Todaiji', lat: 34.685, lng: 135.843, address: 'Nara', priority: '', notes: '' }],
  expenses: [
    { id: 201, desc: 'Ramen', amount: 2400, currency: 'JPY', payerId: 1, category: 'Cibo', paid: true, splitAmong: [1, 2, 3], date: D[0] },
    { id: 202, desc: 'Shinkansen', amount: 12000, currency: 'JPY', payerId: 2, category: 'Trasporti', paid: true, splitAmong: [1, 2], date: D[0] },
    { id: 203, desc: 'Teamlab', amount: 3000, currency: 'JPY', payerId: 3, category: 'Attrazioni', paid: true, splitAmong: [1, 3], date: D[1] }],
  tickets: [{ id: 7, name: 'Pass JR', code: 'AB12', format: 'qrcode', type: 'attraction', who: 1 }],
  hotels: [{ id: 5, name: 'Ryokan Hoshi', lat: 35.0, lng: 135.76, address: 'Kyoto', checkIn: D[0], checkOut: D[2] }],
  weather: Object.fromEntries(D.map((d, i) => [d, meteo(d, i % 2 ? 61 : 0)])), createdAt: 1,
  days: [
    { id: 'd0', date: D[0], title: '', activities: [
      att(11, 'Fushimi Inari', '09:30', '11:00', 34.967, 135.772, { booking: { needed: true, done: false }, poiId: 91 }),
      att(12, 'Nishiki', '12:00', '13:00', 35.005, 135.765, { who: [1] }),
      att(13, 'Kiyomizu', '15:00', '16:30', 35.003, 135.775, { completed: true })] },
    { id: 'd1', date: D[1], title: 'Nara', activities: [att(21, 'Todaiji', '10:00', '12:00', 34.689, 135.84)] },
    { id: 'd2', date: D[2], title: '', activities: [] }, { id: 'd3', date: D[3], title: '', activities: [] }]
};
const PORTO = { id: 2, name: 'Porto', destination: 'Porto', currency: 'EUR', status: 'open', start: '', end: '', _admin: false,
  participants: [{ id: 1, name: 'Zelda', isMe: true }], guests: [], pois: [], hotels: [], tickets: [], expenses: [], weather: {}, createdAt: 2, days: [] };
/* La valigia come la preparava l'app prima: in italiano, col numero dentro.
   Non sono dati di chi usa l'app, sono frasi dell'app salvate: si devono
   leggere tradotte. */
const VALIGIA = ['Carta d\'identità o passaporto', 'Caricabatterie', 'Spazzolino e dentifricio', 'Magliette (5)', 'Calzini (5)', 'Pigiama', 'Crema solare', 'Borraccia']
  .map((label, i) => ({ id: 'v' + i, cat: ['Documenti', 'Elettronica', 'Igiene', 'Abbigliamento', 'Abbigliamento', 'Abbigliamento', 'Igiene', 'Extra'][i], label, checked: i < 3, custom: false, t: 0 }));
/* Quello che scrive chi usa l'app, o che arriva da fuori già nella sua
   lingua (il messaggio di chi chiama a raccolta, le proposte
   dell'assistente): non si traduce, e nel confronto si copre con un
   segnaposto. Niente parole vere qui dentro: «Si parte» coprirebbe anche
   «Si parte domani», che è una frase dell'app. */
const SCRITTI = ['Kinkakuji', 'Hachiko 17:00', 'Zeta-1', 'Zeta-2', 'Zeta-3', 'Islanda', 'Reykjavik', 'Wanda', 'Vito', 'q@x.it'];

/* ── i passi: come si arriva a ogni schermata e finestra di MAPPA_APP ──────
   Uno per voce della mappa (la barra in basso, il cassetto, la scheda del
   viaggio, la Time Table, Spese, Biglietti, Hotel, Scopri, il Profilo...), e
   le finestre riempite come le vede chi le usa. In fondo il giro apre anche,
   vuote, tutte le finestre che nessun passo ha aperto: una finestra nuova
   finisce dentro la prova da sola. Il Premium no: le sue frasi restano come
   sono, su richiesta («non toccare Premium e pubblicità»). */
const SU = "document.getElementById('authGate').style.display='flex';", GIU = "document.getElementById('authGate').style.display='none'";
const PASSI = [
  /* Il primo avvio: la presentazione e la schermata di accesso, che non sono
     finestre e che l'avvio delle prove salta. Sono la prima cosa che legge
     chi scarica l'app. */
  ['presentazione', "(()=>{const el=document.getElementById('intro');el.classList.remove('via');el.style.display='flex';introSegui();})()", "document.getElementById('intro').style.display='none'"],
  ['accesso: la scelta', SU + "auMostra('auScelta')", GIU], ['accesso: entra', SU + "auVai('in')", GIU], ['accesso: nuovo account', SU + "auVai('su')", GIU],
  ['accesso: recupero', SU + "openRecPanel()", GIU], ['accesso: email inviata', SU + "auMostra('auMailInviata')", GIU], ['accesso: il cloud non risponde', SU + "auMostra('auCloudGiu')", GIU],
  ['home', "go('plan')"],
  ['home senza giorni', "app.currentTripId=2;save();renderAll();go('plan')", "app.currentTripId=1;save();renderAll()"],
  ['home senza viaggio', "app.currentTripId=999;renderAll();go('plan')", "app.currentTripId=1;renderAll()"],
  ['cassetto', 'apriViaggi()'], ['cosa cerchi', 'apriCerca()'], ['meteo', 'apriMeteo()'],
  ['scheda del viaggio', 'openTripZoom(1)'], ['bagagli', 'openPacking()'], ['compagni', 'openPeople()'],
  ['condividi', 'openShare()'], ['condividi senza account', 'openShareLocal()'],
  ['condividi con account', "sb=sb||{};session={user:{id:'io',email:'q@x.it'}};T().cid='c1';T()._invite='x';window.GEPPGO_PUBLIC_URL='https://esempio.it/';openShare()", "session=null;delete T().cid;delete T()._invite;delete window.GEPPGO_PUBLIC_URL"],
  ['invito da link', "handleJoin(btoa(encodeURIComponent(JSON.stringify({n:'Islanda',s:'" + D[0] + "',e:'" + D[3] + "',d:'Reykjavik',p:['Wanda','Vito']}))))"],
  ['ripristino', 'openRestore()'], ['giorni', 'openTripDates()'], ['aggiungi giorno', 'openAddDay()'], ['importa lista', 'openImportDay()'],
  ['spese', "go('money');moneyVista('spese');setMoney('list')"], ['saldi', "go('money');moneyVista('spese');setMoney('bal')"],
  ['budget', "go('money');moneyVista('budget')"], ['aggiungi persona', "go('money');openSheet('mPerson')"],
  ['pareggia', 'openPareggia(2)'], ['quote della spesa', 'openSaldoSpesa(201)'], ['nuova spesa', 'openExpense()'], ['modifica spesa', 'openExpense(202)'],
  ['categoria', "openCatExp('Cibo')"],
  ['biglietti', "go('tickets')"], ['nuovo biglietto', 'openTicketSheet()'], ['biglietto grande', 'openTicketBig(7)'],
  ['hotel', "go('hotels')"], ['nuovo hotel', 'apriFoglioHotel(T())'], ['modifica hotel', 'editHotel(5)'], ['mail hotel', 'apriMailHotel()'],
  ['identifica', "go('identify')"],
  ['profilo', "go('trips')"],
  ['profilo con account', "session={user:{id:'io',email:'q@x.it'}};renderProfile();go('trips')", 'session=null;renderProfile()'],
  ['scopri cerca', "go('discover');setDiscover('search')"], ['scopri assistente', "go('discover');setDiscover('ai')"],
  ['scopri reel', "go('discover');setDiscover('imp');setImpSub('places')"], ['scopri su misura', "go('discover');setDiscover('imp');setImpSub('itin')"],
  ['scopri prenotazione', "go('discover');setDiscover('imp');setImpSub('booking')"],
  ['time table', 'openDay(0)'], ['menu della tappa', 'openDay(0);tapAct(0,12)'], ['menu tappa da home', "go('plan');tapAct(0,11)"],
  ['nota della tappa', 'tapAct(0,12);actMenuNote()'], ['modifica tappa', 'openActDetail(0,11)'], ['nuova tappa', 'openActDetail(0,null)'],
  ['aggiungi in time table', 'openDay(0);addFromDay()'], ['mezzi', 'openDay(0);apriMezzi(0,12)'], ['assistente della giornata', 'openDay(0);openAssistenteGiorno()'],
  ['autopilota', 'openDay(0);openGenForDay()'], ['giorno due', 'openDay(1)'],
  ['luogo salvato', 'openDetail(91)'], ['modifica luogo', 'openEditPOI(91)'], ['ricordo', 'apriRicordo(1)'],
  ['permessi', "apriPermessi(true,'gps')"], ['avvisi', 'apriPermessi(false)'], ['posizione', "chiediPosizione('cerca')"],
  ['navigatore', "navAsk(34.96,135.77,'Fushimi Inari','walk')"], ['nuovo viaggio', 'openNewTrip()'], ['importa', 'openImport()'],
  ['consigli', 'openSuggestSheet()'], ['nuova password', 'openNewPass()'], ['a raccolta', 'apriRaccolta()'],
  ['chiamata a raccolta', "mostraRaccolta({nome:'Yuri',lat:34.96,lng:135.77,messaggio:'Hachiko 17:00',creata_il:new Date().toISOString()},T())"],
  ['elimina account', 'apriEliminaAccount()'],
  ['elimina account con account', "sb=sb||{};session={user:{id:'io',email:'q@x.it'}};apriEliminaAccount()", 'session=null'],
  ['qualita foto', 'chiediQualita(5e6,2)'],
  ['codice', "openSheet('mCode')"], ['recupero', 'apriRecupero()'],
  ['proposte', "apriMosse(T(),T().days[0],[{tipo:'sposta',id:12,ora:'14:00',perche:'Zeta-3'}],'Zeta-1','Zeta-2')"],
  ['giro in navigatore', 'navGiroMostra()'], ['osm', 'apriOsmQui(34.96,135.77)'], ['bagno', "cercaVicino('bagno')"],
  ['vicino senza gps', "vicinoKind='bagno';openSheet('mBagno');vicinoNienteGps()"],
  ['conferma', "confirmDo('Eliminare il luogo?','Le attività collegate restano, senza il segnaposto.',()=>{})"],
  ['guida home', 'apriHome()'], ['solo qui', "openSheet('mSoloQui')"], ['da safari', "openSheet('mDaSafari')"],
  ['backup', "bkApri('💾 Backup')"], ['esci', "session={user:{id:'io',email:'q@x.it'}};app._pendingSync=true;authOut()", 'session=null'],
  ['identita', 'pickIdentity(T())'], ['info luogo', "openPlaceInfo({name:'Kinkakuji',lat:35.039,lng:135.729})"],
  ['salva luogo', "openSavePOI({name:'Kinkakuji',lat:35.039,lng:135.729})"], ['scegli valuta', "openSelectPicker(document.getElementById('expCur'))"],
  ['cloud', 'openCloudCfg()'],
  ['avvisi nel cloud', "go('plan');window.GEPPGO_SUPA_URL=window.GEPPGO_SUPA_URL||'https://finto.supabase.co';window.GEPPGO_SUPA_KEY=window.GEPPGO_SUPA_KEY||'finta';sb=sb||{};session=null;storageFull=true;renderCloudWarn()", 'storageFull=false;renderCloudWarn()'],
  ['luoghi famosi', 'openFamousPlaces(T())'], ['scanner', 'openScanner()']
];
/* Le schermate principali, rimisurate anche a 360, 375, 390 e 414 px (i
   telefoni più comuni): il giro intero si fa a 320 e a 430, i due capi. */
const PRINCIPALI = ['presentazione', 'accesso: entra', 'accesso: nuovo account', 'home', 'cassetto', 'scheda del viaggio', 'time table', 'menu della tappa', 'spese', 'saldi', 'pareggia', 'condividi con account',
  'biglietti', 'hotel', 'scopri cerca', 'scopri su misura', 'profilo con account', 'nuovo viaggio', 'bagagli', 'meteo', 'a raccolta', 'backup', 'elimina account con account'];

/* Quello che si legge in una schermata: testo, placeholder, title,
   aria-label e le voci dei menu. Si traduce e POI si guarda (vedi
   prova-lingue): la domanda è «il dizionario sa tradurlo?», non
   «l'osservatore ha fatto in tempo?». */
const LEGGI = () => {
  const fuori = new Set();
  const via = el => !!el.closest('[translate="no"],#mPremium');
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

/* Le misure di una schermata, nello strato che si vede: la finestra aperta
   più in alto, o la Time Table, o la pagina con la testata e la barra.
   - fuori: la pagina, o la finestra, che scorre di lato;
   - troncati: un testo tagliato da chi nasconde quello che esce (overflow
     hidden o clip, coi puntini o senza): una riga a cavallo del bordo, o
     alcune righe dentro e altre fuori (quelle tolte da un line-clamp). Un
     testo tutto fuori non conta: è una sezione chiusa apposta. Dentro un
     contenitore che scorre (la striscia dei giorni, il corpo di una
     finestra) non taglia niente chi sta più su: quello che esce si
     raggiunge scorrendo. I puntini su un nome scritto da chi usa l'app
     sono voluti — un nome può essere lungo quanto vuole — e si contano a
     parte;
   - sovrapposti: due testi con lettere uno sopra l'altro, tutti e due
     visibili (dentro i contenitori che li tagliano, e scoperti nel loro
     centro: una fascia fissa che passa sopra a un elenco lo copre, non gli
     si sovrappone). Si guarda la fascia centrale di ogni riga: le righe
     strette di un titolo grande si toccano negli spazi sopra e sotto le
     lettere, e non è un guasto. */
const MISURA = nomi => {
  const W = innerWidth, H = innerHeight, out = { fuori: [], troncati: [], sovrapposti: [], puntiniSuNomi: [] };
  const nome = el => (el.id ? '#' + el.id : (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/)[0] : el.tagName.toLowerCase())) +
    ' «' + (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 32) + '»';
  const soloNomi = s => { let x = s; for (const m of nomi) x = x.split(m).join(' ').split(m.toUpperCase()).join(' '); return !/\p{L}/u.test(x); };
  if (document.documentElement.scrollWidth > W + 1) out.fuori.push('la pagina scorre di lato: ' + document.documentElement.scrollWidth + ' px');
  const aperti = [...document.querySelectorAll('.modal.active')];
  aperti.sort((a, b) => (parseInt(getComputedStyle(a).zIndex, 10) || 0) - (parseInt(getComputedStyle(b).zIndex, 10) || 0));
  const dayAperta = document.querySelector('#mDay.active');
  /* La presentazione e l'accesso stanno sopra a tutto (sono a tutto
     schermo, più in alto delle finestre). */
  const sopra = ['intro', 'authGate'].map(id => document.getElementById(id)).find(el => el && getComputedStyle(el).display !== 'none');
  const radici = sopra ? [sopra] : aperti.length ? [aperti[aperti.length - 1]] : dayAperta ? [dayAperta]
    : [document.querySelector('.topbar'), document.querySelector('.page.active'), document.querySelector('.nav')].filter(Boolean);
  radici.forEach(rad => {
    const s = rad.querySelector('.sheet') || rad;
    const cs = getComputedStyle(s);
    if (cs.overflowX !== 'hidden' && cs.overflowX !== 'clip' && s.scrollWidth > s.clientWidth + 1)
      out.fuori.push(nome(s) + ' scorre di lato: ' + s.scrollWidth + ' > ' + s.clientWidth);
  });
  /* Tre domande che si ripetono per ogni testo dello stesso contenitore:
     si fanno una volta per elemento. */
  const ricordate = { visibile: new Map(), tagli: new Map(), scatola: new Map() };
  const ricorda = (quale, el, f) => { const m = ricordate[quale]; if (!m.has(el)) m.set(el, f()); return m.get(el); };
  const visibile = el => ricorda('visibile', el, () => {
    for (let x = el; x && x !== document.documentElement; x = x.parentElement) {
      const c = getComputedStyle(x);
      if (c.display === 'none' || c.visibility === 'hidden' || parseFloat(c.opacity) < 0.05) return false;
    }
    return true;
  });
  const nasconde = v => v === 'hidden' || v === 'clip';
  const scorre = v => v === 'auto' || v === 'scroll';
  /* Chi taglia questo testo, asse per asse, fino al primo che scorre. */
  const tagli = el => ricorda('tagli', el, () => {
    const fuori = []; let x = true, y = true;
    for (let a = el; a && a !== document.body && (x || y); a = a.parentElement) {
      const c = getComputedStyle(a);
      const tx = x && nasconde(c.overflowX), ty = y && nasconde(c.overflowY);
      if (tx || ty) fuori.push({ a, x: tx, y: ty, puntini: c.textOverflow === 'ellipsis' });
      if (scorre(c.overflowX)) x = false;
      if (scorre(c.overflowY)) y = false;
    }
    return fuori;
  });
  /* Il pezzo di schermo in cui un testo si può vedere: lo schermo, stretto
     da ogni contenitore che taglia o scorre. */
  const scatola = el => ricorda('scatola', el, () => {
    let l = 0, t = 0, r = W, b = H;
    for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
      const c = getComputedStyle(a);
      if (c.overflowX === 'visible' && c.overflowY === 'visible') continue;
      const q = a.getBoundingClientRect();
      if (c.overflowX !== 'visible') { l = Math.max(l, q.left); r = Math.min(r, q.right); }
      if (c.overflowY !== 'visible') { t = Math.max(t, q.top); b = Math.min(b, q.bottom); }
    }
    return { l, t, r, b };
  });
  const righe = [];
  radici.forEach(rad => {
    const w = document.createTreeWalker(rad, NodeFilter.SHOW_TEXT, { acceptNode: t => {
      const p = t.parentElement;
      if (!p || p.closest('.leaflet-container,script,style,#mPremium,select,option,textarea')) return NodeFilter.FILTER_REJECT;
      return /\p{L}/u.test(t.data) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT; } });
    let t;
    while ((t = w.nextNode())) {
      const p = t.parentElement;
      if (!visibile(p)) continue;
      const rg = document.createRange(); rg.selectNodeContents(t);
      const rr = [...rg.getClientRects()].filter(q => q.width > 0.5 && q.height > 0.5);
      if (!rr.length) continue;
      for (const tg of tagli(p)) {
        const b = tg.a.getBoundingClientRect();
        if (b.width <= 2 || b.height <= 2) continue;
        /* Coi puntini basta un pezzo di pixel: le ultime lettere diventano
           «…». Senza, un pixel tagliato al bordo di una lettera non si vede. */
        const m = tg.puntini ? 0.05 : 1;
        const dentro = q => (!tg.x || (q.left >= b.left - m && q.right <= b.right + m)) && (!tg.y || (q.top >= b.top - 1 && q.bottom <= b.bottom + 1));
        const tuttoFuori = q => (tg.x && (q.right <= b.left + 1 || q.left >= b.right - 1)) || (tg.y && (q.bottom <= b.top + 1 || q.top >= b.bottom - 1));
        if (rr.some(q => !dentro(q) && !tuttoFuori(q)) || (rr.some(dentro) && rr.some(q => !dentro(q)))) {
          const chi = nome(p) + (tg.a !== p ? ' dentro ' + nome(tg.a) : '');
          (tg.puntini && soloNomi(t.data) ? out.puntiniSuNomi : out.troncati).push(chi);
          break;
        }
      }
      const s = scatola(p);
      rr.forEach(q => {
        const l = Math.max(q.left, s.l), r = Math.min(q.right, s.r), tt = Math.max(q.top, s.t), bb = Math.min(q.bottom, s.b);
        if (r - l < 1 || bb - tt < 1) return;
        /* Scoperta se in almeno un punto della riga (cinque, da sinistra a
           destra) in cima c'è lei: un'etichetta che ne copre metà non la
           nasconde, e deve risultare sovrapposta. */
        const y = (tt + bb) / 2;
        const scoperta = [0.1, 0.3, 0.5, 0.7, 0.9].some(f => { const h = document.elementFromPoint(l + (r - l) * f, y); return !!h && (h === p || p.contains(h)); });
        if (!scoperta) return;
        righe.push({ p, l: l + 1, r: r - 1, t: Math.max(tt, q.top + q.height * 0.3), b: Math.min(bb, q.bottom - q.height * 0.3) });
      });
    }
  });
  for (let i = 0; i < righe.length; i++) for (let j = i + 1; j < righe.length; j++) {
    const a = righe[i], b = righe[j];
    if (a.p === b.p || a.p.contains(b.p) || b.p.contains(a.p)) continue;
    if (Math.min(a.r, b.r) - Math.max(a.l, b.l) > 2 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 1) {
      const coppia = nome(a.p) + ' / ' + nome(b.p);
      if (!out.sovrapposti.includes(coppia)) out.sovrapposti.push(coppia);
    }
  }
  return out;
};

/* Un giro: la pagina in una lingua e una larghezza, tutti i passi (o solo
   quelli scelti), e per ognuno quello che si legge e le misure. */
async function giro(browser, lingua, larghezza, soloQuesti) {
  const page = await browser.newPage({ viewport: { width: larghezza, height: 844 } });
  const err = [];
  page.on('pageerror', e => err.push(e.message.split('\n')[0]));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.route('**/leaflet@1.9.4/dist/leaflet.js', ro => ro.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(leafletJs(), 'utf8') }));
  await page.route(/tile\.openstreetmap\.org|api\.open-meteo\.com/, ro => ro.abort());
  await page.clock.install({ time: giornoA(0) });
  await page.addInitScript(([v, p, val, l]) => {
    if (sessionStorage.getItem('giro')) return; sessionStorage.setItem('giro', '1'); localStorage.clear();
    const st = { trips: [v, p], currentTripId: 1, settings: { proxRadius: 200 }, myName: 'Zelda', skipAuth: true };
    if (l !== 'it') st.settings.lingua = l;
    localStorage.setItem('geppgo2', JSON.stringify(st)); localStorage.setItem('geppgo2_intro', '1');
    localStorage.setItem('geppgo2_avviso_home', String(Date.now()));
    localStorage.setItem('geppgo2_pack_1_local', JSON.stringify(val));
  }, [VIAGGIO, PORTO, VALIGIA, lingua]);
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof renderAll === 'function' && !document.getElementById('bootSplash'), null, { timeout: 30000 });
  await page.waitForTimeout(400);
  const visti = {}, misure = {}, aperte = new Set();
  const passi = soloQuesti ? PASSI.filter(p => soloQuesti.includes(p[0])) : PASSI;
  const guarda = async nome => {
    const v = await page.evaluate(([leggi, misura, nomi]) => ({ testi: eval(leggi)(), misure: eval(misura)(nomi),
      aperte: [...document.querySelectorAll('.modal.active')].map(m => m.id) }), [LEGGI.toString(), MISURA.toString(), NOMI]);
    visti[nome] = v.testi; misure[nome] = v.misure; v.aperte.forEach(a => aperte.add(a));
  };
  const pulisci = () => page.evaluate(() => {
    document.querySelectorAll('.modal.active').forEach(m => { try { closeSheet(m.id); } catch (e) {} });
    document.querySelectorAll('.toast,.prox').forEach(x => x.remove());
    window.scrollTo(0, 0);
  });
  for (const [nome, js, dopo] of passi) {
    try {
      await pulisci();
      await page.waitForTimeout(60);
      await page.evaluate(js => { try { const r = eval(js); if (r && r.catch) r.catch(() => {}); } catch (e) { console.log('passo: ' + e.message); } }, js);
      await page.waitForTimeout(260);
      await guarda(nome);
      if (dopo) await page.evaluate(js => { try { eval(js); } catch (e) {} }, dopo);
    } catch (e) { visti[nome] = []; err.push(nome + ': ' + e.message.split('\n')[0]); }
  }
  /* E le finestre che nessun passo ha aperto, vuote come sono. */
  if (!soloQuesti) {
    const restano = await page.evaluate(gia => [...document.querySelectorAll('.modal')].map(m => m.id).filter(id => id && id !== 'mPremium' && !gia.includes(id)), [...aperte]);
    for (const id of restano) {
      try {
        await pulisci();
        await page.evaluate(i => { try { openSheet(i); } catch (e) {} }, id);
        await page.waitForTimeout(200);
        await guarda('finestra ' + id);
      } catch (e) { err.push(id + ': ' + e.message.split('\n')[0]); }
    }
  }
  const valori = lingua === 'it' ? [] : await page.evaluate(l => Object.values(DIZIONARIO[l]).concat([...GIA_TRADOTTE]), lingua);
  await page.close();
  return { visti, misure, valori, err, aperte: [...aperte] };
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
const NOMI = [...new Set([VIAGGIO, PORTO].flatMap(t => [t.name, t.destination, ...(t.participants || []).map(p => p.name), ...(t.pois || []).flatMap(p => [p.name, p.address]),
  ...(t.expenses || []).map(e => e.desc), ...(t.tickets || []).flatMap(k => [k.name, k.code]), ...(t.hotels || []).flatMap(h => [h.name, h.address]),
  ...(t.days || []).flatMap(d => [d.title, ...(d.activities || []).map(a => a.name)])]).concat(SCRITTI).filter(Boolean))].sort((a, b) => b.length - a.length);
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
async function apri(browser, lingua, larghezza = 390, viaggi) {
  const page = await browser.newPage({ viewport: { width: larghezza, height: 844 } });
  page.on('pageerror', e => errori.push(`PAGEERROR(${lingua}): ` + e.message.split('\n')[0]));
  await page.route('**/leaflet@1.9.4/dist/leaflet.js', ro => ro.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(leafletJs(), 'utf8') }));
  await page.route(/tile\.openstreetmap\.org|api\.open-meteo\.com/, ro => ro.abort());
  await page.clock.install({ time: giornoA(0) });
  await page.addInitScript(([vv, l]) => {
    if (sessionStorage.getItem('breve')) return; sessionStorage.setItem('breve', '1'); localStorage.clear();
    const st = { trips: vv, currentTripId: 1, settings: { proxRadius: 200 }, myName: 'Zelda', skipAuth: true };
    if (l !== 'it') st.settings.lingua = l;
    localStorage.setItem('geppgo2', JSON.stringify(st)); localStorage.setItem('geppgo2_intro', '1');
    localStorage.setItem('geppgo2_avviso_home', String(Date.now()));
  }, [viaggi || [VIAGGIO, PORTO], lingua]);
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof renderAll === 'function' && !document.getElementById('bootSplash'), null, { timeout: 30000 });
  await page.waitForTimeout(300);
  return page;
}
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
   Il Premium no: «non toccare Premium e pubblicità». Le sue frasi restano
   come sono, e qui si contano a parte. */
const PREMIUM = ['openPremium', 'togglePremium', 'renderAds', 'premiumNienteElimina'];
function statico() {
  const acorn = require('acorn'), walk = require('acorn-walk');
  const tv = new Set(), tp = new Map(), messaggi = new Set(), cuciti = [], ombre = [];
  let saltati = 0;
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
    const premium = anc => anc.some(a => a.type === 'FunctionDeclaration' && a.id && PREMIUM.includes(a.id.name));
    const prendi = (n, anc) => {
      if (!n) return;
      if (n.type === 'Literal' && typeof n.value === 'string' && lettere(n.value)) { if (premium(anc)) saltati++; else messaggi.add(n.value); }
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
          a.slice(0, nome === 'confirmDo' ? 2 : 1).forEach(x => { prendi(x, anc); if (cucito(x) && !premium(anc)) cuciti.push(riga(x)); });
        }
        if (nome === 't') for (let i = anc.length - 2; i >= 0; i--) if (/Function/.test(anc[i].type) && dichiaraT(anc[i])) { ombre.push(riga(n)); break; }
      },
      AssignmentExpression(n, anc) {
        if (n.left.type === 'MemberExpression' && n.left.property && ['textContent', 'innerText'].includes(n.left.property.name)) prendi(n.right, anc);
      }
    });
  }
  return { tv: [...tv], tp: [...tp.values()], messaggi: [...messaggi], cuciti, ombre, saltati };
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
      const esiti = await Promise.all(['it'].concat(LINGUE).map(l => giro(browser, l, larghezza)));
      ['it'].concat(LINGUE).forEach((l, i) => { (giri[l] = giri[l] || {})[larghezza] = esiti[i]; });
    }
    for (const larghezza of [360, 375, 390, 414]) {
      const esiti = await Promise.all(['it'].concat(LINGUE).map(l => giro(browser, l, larghezza, PRINCIPALI)));
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
    ok(`3. e ogni messaggio scritto per intero (${st.messaggi.length}, fra toast, domande, avvisi e righe di stato) ha la sua traduzione`, !d.some(x => x.includes('messaggio')),
      `il Premium resta com'è, su richiesta: ${st.saltati} frasi in ${PREMIUM.join(', ')}`);
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
       controlla che non ce ne sia nessuno normale. */
    const ATTESI = {
      it: ['1.234,50 €', '1.234.567 ¥', '99,90 A$', '0,50 €'],
      en: ['€1,234.50', '¥1,234,567', 'A$99.90', '€0.50'],
      es: ['1.234,50 €', '1.234.567 ¥', '99,90 A$', '0,50 €'],
      fr: ['1 234,50 €', '1 234 567 ¥', '99,90 A$', '0,50 €'],
      pt: ['1 234,50 €', '1 234 567 ¥', '99,90 A$', '0,50 €']
    };
    const LISTA = { it: ['3.000 ¥', '2.400 ¥', '12.000 ¥'], en: ['¥3,000', '¥2,400', '¥12,000'], es: ['3.000 ¥', '2.400 ¥', '12.000 ¥'], fr: ['3 000 ¥', '2 400 ¥', '12 000 ¥'], pt: ['3 000 ¥', '2 400 ¥', '12 000 ¥'] };
    const male = [], lista = [], spazi = [];
    for (const l of ['it'].concat(LINGUE)) {
      const q = await apri(browser, l);
      const v = await q.evaluate(() => {
        const soldi = [fmtMoney(1234.5, 'EUR'), fmtMoney(1234567, 'JPY'), fmtMoney(99.9, 'AUD'), fmtMoney(0.5, 'EUR')];
        go('money'); moneyVista('spese'); setMoney('list');
        return { soldi, lista: [...document.querySelectorAll('#money .exp-amt')].map(x => x.textContent.trim()) };
      });
      await q.close();
      const piano = s => s.replace(/[\u00a0\u202f]/g, ' ');
      if (JSON.stringify(v.soldi.map(piano)) !== JSON.stringify(ATTESI[l])) male.push(`${l}: ${JSON.stringify(v.soldi.map(piano))}`);
      if (JSON.stringify(v.lista.map(piano)) !== JSON.stringify(LISTA[l])) lista.push(`${l}: ${JSON.stringify(v.lista.map(piano))}`);
      if (v.soldi.concat(v.lista).some(s => s.includes(' '))) spazi.push(l);
    }
    ok('5. le valute seguono la lingua: dove va il simbolo, il separatore delle migliaia, i decimali (e lo yen senza)', !male.length,
      male.join(' | ') || 'it «1.234,50 €», en «€1,234.50», fr «1 234,50 €», yen «1.234.567 ¥» / «¥1,234,567»');
    ok('5. niente più «€1.234,50» in italiano né «€1234,50» in spagnolo e portoghese', !male.some(x => /^(it|es|pt)/.test(x)));
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
