/* IL GIRO DELLE SCHERMATE: come si arriva a ogni schermata e finestra di
   MAPPA_APP, con un viaggio di prova pieno, e la misura dei testi tagliati o
   sovrapposti.

   Stava dentro prova-traduzioni (miglioria 10). Adesso lo usa anche
   prova-accessibilita (miglioria 11), e due copie dello stesso giro
   divergerebbero alla prima finestra nuova: una aggiunta qui la provano
   tutte e due. */
const fs = require('fs');
const { APP, leafletJs, leafletCss } = require('./browser');

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
   finisce dentro la prova da sola. Il Premium c'è anche lui, nei due stati:
   «non toccare Premium e pubblicità» riguardava come funzionano, non le
   parole che usano. */
const SU = "document.getElementById('authGate').style.display='flex';", GIU = "document.getElementById('authGate').style.display='none'";
/* Un viaggio nel cloud, quanto basta per disegnarlo: un account e il codice
   del viaggio. */
const NEL_CLOUD = "sb=sb||{};session={user:{id:'io',email:'q@x.it'}};T().cid='c1';", FUORI_CLOUD = 'session=null;delete T().cid';
/* Il tempo del primo giorno, e il giorno dalle 0 alle 24 se si vuole il cielo di giorno. */
const cielo = (codice, giorno) => "(()=>{const w=T().weather[T().days[0].date];w._prima=w._prima||{code:w.code,sunrise:w.sunrise,sunset:w.sunset};w.code=" + codice + ';' +
  (giorno ? "w.sunrise=w.sunrise.slice(0,11)+'00:00';w.sunset=w.sunset.slice(0,11)+'23:59';" : '') + "renderAll();go('plan')})()";
const CIELO_VIA = '(()=>{const w=T().weather[T().days[0].date];if(w._prima){Object.assign(w,w._prima);delete w._prima;}renderAll()})()';
/* I tetti di spesa, tutti e tre i tipi, con una spesa prevista: il gruppo
   all'87%, Cibo oltre il tetto, la propria parte al 92%. Gli avvisi delle
   soglie risultano gia' dati, perche' i banner non coprano la schermata. */
const TETTI = "(()=>{const t=T();t.tetto=20000;t.tettoCat_Cibo=2000;t.tettoCat_Trasporti=12500;" +
  "t.expenses.push({id:299,desc:'Onsen',amount:1500,currency:'JPY',payerId:1,category:'Attrazioni',paid:false,splitAmong:[1,2,3],date:t.days[2].date});" +
  "app.tettiMiei={1:{v:9000,t:1}};app.tettiAvvisi={1:{gruppo:{80:20000,100:20000},mio:{80:9000,100:9000},'cat:Cibo':{80:2000,100:2000},'cat:Trasporti':{80:12500,100:12500}}};save();renderAll();})();";
const TETTI_VIA = "(()=>{const t=T();delete t.tetto;delete t.tettoCat_Cibo;delete t.tettoCat_Trasporti;delete t._admin;t.expenses=t.expenses.filter(e=>e.id!==299);app.tettiMiei={};app.tettiAvvisi={};save();renderAll();})()";
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
  /* Il PDF dell'itinerario e il calendario che si aggiorna (miglioria 13b):
     il foglio delle opzioni e quello col PDF pronto; il calendario di un
     viaggio nel cloud senza link, col link, e quando nel cloud non c'e'
     ancora. */
  ['pdf dell\'itinerario', 'apriPdfItinerario()'],
  ['pdf pronto', "apriPdfItinerario();pdfPronto=new File(['%PDF-1.3'],nomeFilePdf(T()),{type:'application/pdf'});pdfMostra('')", 'pdfPronto=null'],
  ['scheda del viaggio nel cloud', NEL_CLOUD + 'openTripZoom(1)', FUORI_CLOUD],
  ['calendario senza link', NEL_CLOUD + "openSheet('mCalendario');calRiga=null;calMostra('')", FUORI_CLOUD],
  ['calendario col link', NEL_CLOUD + "openSheet('mCalendario');calRiga={codice:'" + 'a'.repeat(64) + "',lingua:'it'};calMostra('')", FUORI_CLOUD + ';calRiga=null'],
  ['calendario non ancora disponibile', NEL_CLOUD + "openSheet('mCalendario');calMostra('manca')", FUORI_CLOUD],
  ['condividi', 'openShare()'], ['condividi senza account', 'openShareLocal()'],
  ['condividi con account', "sb=sb||{};session={user:{id:'io',email:'q@x.it'}};T().cid='c1';T()._invite='x';window.GEPPGO_PUBLIC_URL='https://esempio.it/';openShare()", "session=null;delete T().cid;delete T()._invite;delete window.GEPPGO_PUBLIC_URL"],
  ['invito da link', "handleJoin(btoa(encodeURIComponent(JSON.stringify({n:'Islanda',s:'" + D[0] + "',e:'" + D[3] + "',d:'Reykjavik',p:['Wanda','Vito']}))))"],
  ['ripristino', 'openRestore()'], ['giorni', 'openTripDates()'], ['aggiungi giorno', 'openAddDay()'], ['importa lista', 'openImportDay()'],
  ['spese', "go('money');moneyVista('spese');setMoney('list')"], ['saldi', "go('money');moneyVista('spese');setMoney('bal')"],
  ['budget', "go('money');moneyVista('budget')"], ['aggiungi persona', "go('money');openSheet('mPerson')"],
  ['pareggia', 'openPareggia(2)'], ['quote della spesa', 'openSaldoSpesa(201)'], ['nuova spesa', 'openExpense()'], ['modifica spesa', 'openExpense(202)'],
  ['categoria', "openCatExp('Cibo')"],
  ['budget coi tetti', TETTI + "go('money');moneyVista('budget');document.getElementById('tettiCard').scrollIntoView({block:'start'})", TETTI_VIA],
  ['tetti di spesa', TETTI + 'apriTetti()', TETTI_VIA], ['tetti di spesa da compagno', TETTI + 'T()._admin=false;apriTetti()', TETTI_VIA],
  ['home col tetto', TETTI + "go('plan')", TETTI_VIA],
  ['biglietti', "go('tickets')"], ['nuovo biglietto', 'openTicketSheet()'], ['biglietto grande', 'openTicketBig(7)'],
  ['hotel', "go('hotels')"], ['nuovo hotel', "pendingHotel={name:'Ryokan Hoshi',lat:35,lng:135.76,address:'Kyoto',editId:null};apriFoglioHotel(T())"], ['modifica hotel', 'editHotel(5)'], ['mail hotel', 'apriMailHotel()'],
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
  /* La mappa nasce subito, senza aspettare il foglio: il passo misura dopo
     un quarto di secondo. */
  ['mappa del viaggio', 'apriMappaViaggio();vmCreaMappa()'], ['mappa del viaggio, un giorno', 'apriMappaViaggio();vmCreaMappa();vmScegli(0)'],
  ['elenco del viaggio', "apriMappaViaggio();vmVista('elenco')", "vmVista('mappa')"],
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
  ['luoghi famosi', 'openFamousPlaces(T())'], ['scanner', 'openScanner()'],
  /* Il Premium nei suoi due stati, e quello che dice a chi vuole eliminare
     un viaggio col piano gratuito. */
  ['premium', 'openPremium()'], ['premium attivo', 'app.premium=true;openPremium()', 'app.premium=false;renderAll()'],
  ['profilo premium', "app.premium=true;renderAll();go('trips')", 'app.premium=false;renderAll()'],
  ['eliminare è del premium', 'premiumNienteElimina(T())'],
  /* Il cielo della home cambia col tempo che fa e con l'ora del posto, e il
     testo ci sta sopra: di giorno e di notte, coi tempi che lo scuriscono o
     lo schiariscono. «home» è la notte serena (le prove girano a
     mezzogiorno, e a Kyoto sono le nove di sera). */
  ...[[0, true, 'giorno sereno'], [2, true, 'giorno velato'], [3, true, 'giorno nuvoloso'], [45, true, 'giorno di nebbia'], [61, true, 'giorno di pioggia'],
    [71, true, 'giorno di neve'], [95, true, 'giorno di temporale'], [3, false, 'notte nuvolosa'], [45, false, 'notte di nebbia'], [61, false, 'notte di pioggia'],
    [71, false, 'notte di neve'], [95, false, 'notte di temporale']].map(([codice, giorno, nome]) => ['home, ' + nome, cielo(codice, giorno), CIELO_VIA])
];
/* Le schermate principali, rimisurate anche a 360, 375, 390 e 414 px (i
   telefoni più comuni): il giro intero si fa a 320 e a 430, i due capi. */
const PRINCIPALI = ['presentazione', 'accesso: entra', 'accesso: nuovo account', 'home', 'cassetto', 'scheda del viaggio', 'time table', 'menu della tappa', 'spese', 'saldi', 'pareggia', 'condividi con account',
  'biglietti', 'hotel', 'scopri cerca', 'scopri su misura', 'profilo con account', 'nuovo viaggio', 'bagagli', 'meteo', 'a raccolta', 'backup', 'elimina account con account',
  'premium'];

/* I nomi del viaggio di prova e quello che scrive chi usa l'app: non si
   traducono, e una misura che guarda le parole li deve riconoscere. */
const NOMI =[...new Set([VIAGGIO, PORTO].flatMap(t => [t.name, t.destination, ...(t.participants || []).map(p => p.name), ...(t.pois || []).flatMap(p => [p.name, p.address]),
  ...(t.expenses || []).map(e => e.desc), ...(t.tickets || []).flatMap(k => [k.name, k.code]), ...(t.hotels || []).flatMap(h => [h.name, h.address]),
  ...(t.days || []).flatMap(d => [d.title, ...(d.activities || []).map(a => a.name)])]).concat(SCRITTI).filter(Boolean))].sort((a, b) => b.length - a.length);

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
      if (!p || p.closest('.leaflet-container,script,style,select,option,textarea')) return NodeFilter.FILTER_REJECT;
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
  /* Un tasto che galleggia sopra la pagina (in Time Table «↩ Annulla» e
     «＋ Aggiungi», fissi in basso) copre quello che ci scorre sotto, come la
     barra in basso: non gli si sovrappone. Lo si toglie scorrendo. */
  const fisso = el => { for (let x = el; x && x !== document.body; x = x.parentElement) if (getComputedStyle(x).position === 'fixed') return x; return null; };
  const scorre2 = el => { for (let x = el.parentElement; x && x !== document.documentElement; x = x.parentElement) { const c = getComputedStyle(x); if (/(auto|scroll)/.test(c.overflowY) && x.scrollHeight > x.clientHeight + 1) return true; } return false; };
  const galleggia = (x, y) => { const fx = fisso(x.p), fy = fisso(y.p); return fx !== fy && ((fx && !fx.contains(y.p) && scorre2(y.p)) || (fy && !fy.contains(x.p) && scorre2(x.p))); };
  for (let i = 0; i < righe.length; i++) for (let j = i + 1; j < righe.length; j++) {
    const a = righe[i], b = righe[j];
    if (a.p === b.p || a.p.contains(b.p) || b.p.contains(a.p)) continue;
    if (galleggia(a, b)) continue;
    if (Math.min(a.r, b.r) - Math.max(a.l, b.l) > 2 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 1) {
      const coppia = nome(a.p) + ' / ' + nome(b.p);
      if (!out.sovrapposti.includes(coppia)) out.sovrapposti.push(coppia);
    }
  }
  return out;
};

/* Una pagina dell'app col viaggio di prova, nella lingua e nel tema chiesti.
   L'orologio è fermo a mezzogiorno del primo giorno; la rete delle mappe e
   del meteo non risponde (le prove non escono in rete, vedi browser.js).
   - chiave: segna il primo avvio in sessionStorage, così una ricarica non
     riparte da zero;
   - valigia: la valigia vecchia, in italiano (vedi VALIGIA);
   - errori: dove finiscono gli errori della pagina;
   - opzioni: quelle di Playwright per la pagina (reducedMotion, ...). */
async function apriPagina(browser, { lingua = 'it', larghezza = 390, altezza = 844, viaggi, tema = 'chiaro', valigia = false, chiave = 'breve', attesa = 300, errori, opzioni = {}, indirizzo = APP } = {}) {
  const page = await browser.newPage(Object.assign({ viewport: { width: larghezza, height: altezza } }, opzioni));
  if (errori) page.on('pageerror', e => errori.push(`PAGEERROR(${lingua}${tema === 'scuro' ? ', scuro' : ''}): ` + e.message.split('\n')[0]));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.route('**/leaflet@1.9.4/dist/leaflet.js', ro => ro.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(leafletJs(), 'utf8') }));
  /* Anche il suo foglio di stile: senza, i controlli della mappa (la
     scritta «Leaflet | © OSM», lo zoom) non stanno nei loro angoli, e qui
     non si vede quello che si vede sul server delle prove, dove la CDN
     risponde: la scritta finiva sopra il tasto 🧭. */
  await page.route('**/leaflet@1.9.4/dist/leaflet.css', ro => ro.fulfill({ status: 200, contentType: 'text/css', body: fs.readFileSync(leafletCss(), 'utf8') }));
  await page.route(/tile\.openstreetmap\.org|api\.open-meteo\.com/, ro => ro.abort());
  await page.clock.install({ time: giornoA(0) });
  await page.addInitScript(([vv, val, l, scuro, k]) => {
    if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, '1'); localStorage.clear();
    const st = { trips: vv, currentTripId: 1, settings: { proxRadius: 200 }, myName: 'Zelda', skipAuth: true };
    if (l !== 'it') st.settings.lingua = l;
    if (scuro) st.settings.dark = true;
    localStorage.setItem('geppgo2', JSON.stringify(st)); localStorage.setItem('geppgo2_intro', '1');
    localStorage.setItem('geppgo2_avviso_home', String(Date.now()));
    if (val) localStorage.setItem('geppgo2_pack_1_local', JSON.stringify(val));
  }, [viaggi || [VIAGGIO, PORTO], valigia ? VALIGIA : null, lingua, tema === 'scuro', chiave]);
  /* indirizzo: un altro ingresso, per esempio index.html con quello che
     arriva dal tasto Condividi (vedi prova-installazione). index.html rimanda
     all'app: si aspetta di esserci arrivati. */
  await page.goto(indirizzo, { waitUntil: 'domcontentloaded' });
  if (indirizzo !== APP) await page.waitForURL(/Index%202\.1\.html/, { timeout: 30000 });
  await page.waitForFunction(() => typeof renderAll === 'function' && !document.getElementById('bootSplash'), null, { timeout: 30000 });
  await page.waitForTimeout(attesa);
  return page;
}

/* Un giro: la pagina in una lingua, un tema e una larghezza, tutti i passi
   (o solo quelli scelti), e per ognuno quello che chiede chi fa la prova
   (guarda). In fondo, se si fa il giro intero, anche le finestre che nessun
   passo ha aperto, vuote come sono. allaFine legge qualcosa dalla pagina
   prima che si chiuda. */
async function giro(browser, { lingua = 'it', larghezza = 390, tema = 'chiaro', soloQuesti = null, guarda, allaFine, opzioni = {} }) {
  const err = [];
  const page = await apriPagina(browser, { lingua, larghezza, tema, valigia: true, chiave: 'giro', attesa: 400, opzioni });
  page.on('pageerror', e => err.push(e.message.split('\n')[0]));
  const esiti = {}, aperte = new Set();
  const passi = soloQuesti ? PASSI.filter(p => soloQuesti.includes(p[0])) : PASSI;
  /* Ogni passo parte con la pagina in cima: chi scorre non è la finestra ma
     il contenitore delle pagine, e restava scorso dal passo prima (quello che
     stava in alto finiva nascosto sotto la testata). */
  const pulisci = () => page.evaluate(() => {
    document.querySelectorAll('.modal.active').forEach(m => { try { closeSheet(m.id); } catch (e) {} });
    document.querySelectorAll('.toast,.prox').forEach(x => x.remove());
    document.querySelectorAll('.scroll,.sheet').forEach(x => { x.scrollTop = 0; });
    window.scrollTo(0, 0);
  });
  const leggi = async nome => {
    esiti[nome] = await guarda(page, nome);
    (await page.evaluate(() => [...document.querySelectorAll('.modal.active')].map(m => m.id))).forEach(a => aperte.add(a));
  };
  for (const [nome, js, dopo] of passi) {
    try {
      await pulisci();
      await page.waitForTimeout(60);
      /* un passo che si rompe si dice: inghiottito, la misura guardava la
         schermata di prima credendola quella nuova (la Time Table rotta da un
         t() al posto di tv() passava liscia) */
      const rotto = await page.evaluate(js => { try { const r = eval(js); if (r && r.catch) r.catch(() => {}); return null; } catch (e) { return e.message; } }, js);
      if (rotto) err.push(nome + ': ' + rotto);
      await page.waitForTimeout(260);
      await leggi(nome);
      if (dopo) await page.evaluate(js => { try { eval(js); } catch (e) {} }, dopo);
    } catch (e) { esiti[nome] = null; err.push(nome + ': ' + e.message.split('\n')[0]); }
  }
  if (!soloQuesti) {
    const restano = await page.evaluate(gia => [...document.querySelectorAll('.modal')].map(m => m.id).filter(id => id && !gia.includes(id)), [...aperte]);
    for (const id of restano) {
      try {
        await pulisci();
        await page.evaluate(i => { try { openSheet(i); } catch (e) {} }, id);
        await page.waitForTimeout(200);
        await leggi('finestra ' + id);
      } catch (e) { err.push(id + ': ' + e.message.split('\n')[0]); }
    }
  }
  const fine = allaFine ? await allaFine(page) : undefined;
  await page.close();
  return { esiti, err, aperte: [...aperte], fine };
}

module.exports = { giornoA, iso, D, att, VIAGGIO, PORTO, VALIGIA, SCRITTI, NOMI, PASSI, PRINCIPALI, MISURA, apriPagina, giro };
