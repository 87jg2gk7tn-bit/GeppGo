/* A raccolta: il tasto con cui chi organizza chiama gli altri.
 *
 * Qui dentro viaggia una posizione, ed è l'unica dell'app che esce dal
 * telefono e arriva ad altre persone. Le prove servono soprattutto a tenere
 * ferme le quattro promesse che la rendono accettabile: è la posizione di chi
 * chiama e non di chi riceve, è presa in quell'istante e mai aggiornata, la
 * può fare solo un admin, e dopo due ore non la vede più nessuno.
 *
 * I permessi veri li prova supabase-prova-raccolta.sql: quello che si prova
 * qui è il comportamento dell'app, con un finto cloud che registra tutto
 * quello che gli viene chiesto. */
const { apriBrowser, APP } = require('./browser');

const VIAGGIO = {
  id: 101, cid: 'aaa-bbb-ccc', name: 'Giappone', destination: 'Tokyo', currency: 'JPY',
  status: 'open', start: '2026-09-01', end: '2026-09-02',
  participants: [{ id: 1, name: 'Gepp', isMe: true }, { id: 2, name: 'Luca' }],
  suggested: [], pois: [], expenses: [], tickets: [], weather: {},
  days: [{ id: 1, date: '2026-09-01', title: '', activities: [] }], createdAt: Date.now()
};
const stato = {
  trips: [JSON.parse(JSON.stringify(VIAGGIO))],
  currentTripId: 101, settings: {}, myName: 'Gepp', premium: true, skipAuth: true
};

(async () => {
  const browser = await apriBrowser();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const err = [];
  page.on('pageerror', e => err.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '')));

  await page.addInitScript(s => localStorage.setItem('geppgo2', JSON.stringify(s)), stato);
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof myPos !== 'undefined', { timeout: 20000 });

  const r = [];
  const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);

  // ── un finto cloud che segna tutto ──────────────────────────────────────
  await page.evaluate(() => {
    myUid = 'io';
    memByTrip = { 'aaa-bbb-ccc': { trip_id: 'aaa-bbb-ccc', user_id: 'io', ruolo: 'admin', participant_id: 1 } };
    membriPerViaggio = { 'aaa-bbb-ccc': [
      { trip_id: 'aaa-bbb-ccc', user_id: 'io',   ruolo: 'admin',    participant_id: 1, member_name: 'Gepp' },
      { trip_id: 'aaa-bbb-ccc', user_id: 'luca', ruolo: 'compagno', participant_id: 2, member_name: 'Luca' }
    ] };
    app.trips.forEach(decorateTrip);

    window.CLOUD = { messe: [], tolte: [], lette: 0, canali: [], errore: null };
    session = { user: { id: 'io' } };
    /* Il finto database si comporta come quello vero su un punto che conta:
       restituisce solo le chiamate non scadute, come fa la regola di lettura. */
    window.__RIGHE = [];
    const filtro = () => ({
      eq: function () { return this; },
      lt: async function () { CLOUD.tolte.push('vecchie'); return { error: null }; }
    });
    sb = {
      from: (tab) => ({
        insert: async (riga) => {
          if (CLOUD.errore) return { error: CLOUD.errore };
          CLOUD.messe.push(riga);
          return { error: null };
        },
        delete: () => filtro(),
        select: () => ({
          order: async () => {
            CLOUD.lette++;
            return { data: window.__RIGHE.filter(x => new Date(x.scade_il).getTime() > Date.now()), error: null };
          }
        })
      }),
      channel: (nome) => {
        const ch = { nome, on: (a, b, cb) => { ch.cb = cb; return ch; }, subscribe: () => ch };
        CLOUD.canali.push(ch);
        return ch;
      },
      removeChannel: () => {}
    };
    // una posizione già in mano, come quando il GPS è acceso da un po'
    myPos = { lat: 35.6595, lng: 139.7005 };
    myPosAt = Date.now();
    renderAll();
  });

  // ── il tasto: chi lo vede e chi no ──────────────────────────────────────
  const tasto = await page.evaluate(() => {
    const c = () => !!document.querySelector('#homeHero .hh-act-forte');
    const fatti = {};
    fatti.daAdmin = c();
    // da non-admin sparisce
    const t = T(); t._admin = false; renderHomeHero(); fatti.daCompagno = c();
    t._admin = true;
    // da soli non ha senso: non c'è nessuno da chiamare
    const soli = t.participants.slice(1); const tutti = t.participants;
    t.participants = [tutti[0]]; renderHomeHero(); fatti.daSolo = c();
    t.participants = tutti;
    // e un viaggio mai andato nel cloud non ha modo di avvisare nessuno
    const cid = t.cid; t.cid = null; renderHomeHero(); fatti.senzaCloud = c();
    t.cid = cid; renderHomeHero();
    fatti.tornato = c();
    fatti.testo = (document.querySelector('#homeHero .hh-act-forte') || {}).textContent || '';
    return fatti;
  });
  ok('chi organizza vede il tasto in home', tasto.daAdmin === true);
  ok('e si chiama "A raccolta"', /A raccolta/.test(tasto.testo), tasto.testo);
  ok('un compagno che non è admin non lo vede', tasto.daCompagno === false);
  ok('in un viaggio da soli non compare', tasto.daSolo === false);
  ok('e nemmeno in uno che non è nel cloud', tasto.senzaCloud === false);
  ok('quando le condizioni tornano, torna anche il tasto', tasto.tornato === true);

  // ── chiamare ────────────────────────────────────────────────────────────
  const chiama = await page.evaluate(async () => {
    apriRaccolta();
    const aperto = document.getElementById('mRaccolta').classList.contains('active');
    const frasi = [...document.querySelectorAll('#raccVeloci .chip')].map(b => b.textContent);
    raccoltaFrase('Si parte');
    const scritta = document.getElementById('raccNota').value;
    await mandaRaccolta();
    await new Promise(x => setTimeout(x, 300));
    return {
      aperto, frasi, scritta,
      messa: CLOUD.messe[0],
      chiuso: !document.getElementById('mRaccolta').classList.contains('active'),
      pulizia: CLOUD.tolte.slice()
    };
  });
  ok('il tasto apre il foglio per chiamare', chiama.aperto === true);
  ok('con le frasi pronte da toccare, che in strada nessuno scrive',
     chiama.frasi.length >= 3 && chiama.frasi.includes('Si parte'), chiama.frasi.join(', '));
  ok('toccarne una la scrive', chiama.scritta === 'Si parte', chiama.scritta);
  ok('la chiamata parte col viaggio giusto', chiama.messa && chiama.messa.trip_id === 'aaa-bbb-ccc',
     JSON.stringify(chiama.messa && chiama.messa.trip_id));
  ok('a nome di chi la fa', chiama.messa && chiama.messa.chiamata_da === 'io', String(chiama.messa && chiama.messa.chiamata_da));
  ok('col nome che i compagni conoscono', chiama.messa && chiama.messa.nome === 'Gepp', String(chiama.messa && chiama.messa.nome));
  ok('e con la nota scritta', chiama.messa && chiama.messa.nota === 'Si parte', String(chiama.messa && chiama.messa.nota));
  ok('dentro c\'è la posizione di chi chiama',
     !!chiama.messa && Math.abs(chiama.messa.lat - 35.6595) < 0.001 && Math.abs(chiama.messa.lng - 139.7005) < 0.001,
     JSON.stringify(chiama.messa && [chiama.messa.lat, chiama.messa.lng]));
  ok('e nient\'altro: niente posizioni di chi riceve, niente elenchi',
     !!chiama.messa && Object.keys(chiama.messa).sort().join(',') === 'chiamata_da,lat,lng,nome,nota,trip_id',
     Object.keys(chiama.messa || {}).sort().join(','));
  ok('poi il foglio si chiude da solo', chiama.chiuso === true);
  ok('e le proprie chiamate vecchie vengono portate via', chiama.pulizia.includes('vecchie'));

  // Senza posizione non parte niente: meglio non chiamare che chiamare a vuoto.
  const senzaPos = await page.evaluate(async () => {
    const p = myPos, a = myPosAt, g = navigator.geolocation;
    myPos = null; myPosAt = 0;
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition: (_ok, ko) => ko && ko({ code: 1 }) }
    });
    const prima = CLOUD.messe.length;
    apriRaccolta();
    await mandaRaccolta();
    await new Promise(x => setTimeout(x, 200));
    const msg = document.getElementById('raccMsg').textContent;
    closeSheet('mRaccolta');
    myPos = p; myPosAt = a;
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: g });
    return { partite: CLOUD.messe.length - prima, msg };
  });
  ok('senza posizione non manda niente', senzaPos.partite === 0, senzaPos.partite + ' partite');
  ok('e lo dice invece di far finta', /posizione/i.test(senzaPos.msg), senzaPos.msg);

  // Un database senza la tabella: si spiega, non si subisce.
  const senzaTabella = await page.evaluate(async () => {
    CLOUD.errore = { message: 'relation "public.raccolte" does not exist' };
    apriRaccolta();
    await mandaRaccolta();
    await new Promise(x => setTimeout(x, 200));
    const msg = document.getElementById('raccMsg').textContent;
    closeSheet('mRaccolta');
    CLOUD.errore = null;
    return msg;
  });
  ok('se al database manca la tabella lo dice chiaro', /supabase-schema\.sql/.test(senzaTabella), senzaTabella);

  // ── riceverne una ───────────────────────────────────────────────────────
  const riceve = await page.evaluate(async () => {
    localStorage.removeItem('geppgo_racc_viste');
    raccoltaArrivata({
      id: 'r1', trip_id: 'aaa-bbb-ccc', chiamata_da: 'luca', nome: 'Luca',
      lat: 35.6586, lng: 139.7454, nota: 'Si mangia',
      creata_il: new Date().toISOString(),
      scade_il: new Date(Date.now() + 7200000).toISOString()
    });
    await new Promise(x => setTimeout(x, 200));
    const aperto = document.getElementById('mRaccoltaIn').classList.contains('active');
    return {
      aperto,
      titolo: document.getElementById('raccInT').textContent,
      corpo: document.getElementById('raccInBody').innerText
    };
  });
  ok('quando ne arriva una si apre l\'avviso', riceve.aperto === true);
  ok('e dice chi chiama', /Luca chiama a raccolta/.test(riceve.titolo), riceve.titolo);
  ok('con le sue parole', /Si mangia/.test(riceve.corpo), riceve.corpo.slice(0, 60));
  ok('e quanto è lontano', /km da te|m da te/.test(riceve.corpo), riceve.corpo.replace(/\n/g, ' | ').slice(0, 120));
  ok('dicendo che è dov\'era, non dov\'è adesso',
     /non dove si trova adesso/.test(riceve.corpo) && /non segue nessuno/.test(riceve.corpo));

  // "Portami lì" passa dal navigatore che c'è già.
  const portami = await page.evaluate(async () => {
    let chiesto = null;
    const vero = window.openNav;
    window.openNav = (lat, lng, nome) => { chiesto = { lat, lng, nome }; };
    raccoltaPortami();
    await new Promise(x => setTimeout(x, 150));
    window.openNav = vero;
    return { chiesto, chiuso: !document.getElementById('mRaccoltaIn').classList.contains('active') };
  });
  ok('"Portami lì" apre il navigatore sul punto giusto',
     !!portami.chiesto && Math.abs(portami.chiesto.lat - 35.6586) < 0.001,
     JSON.stringify(portami.chiesto));
  ok('con scritto chi ti sta aspettando', /Luca/.test((portami.chiesto || {}).nome || ''), (portami.chiesto || {}).nome);
  ok('e l\'avviso si chiude', portami.chiuso === true);

  // La stessa chiamata non si ripresenta ogni volta che l'app si sincronizza.
  const duevolte = await page.evaluate(async () => {
    closeSheet('mRaccoltaIn');
    await new Promise(x => setTimeout(x, 150));
    raccoltaArrivata({
      id: 'r1', trip_id: 'aaa-bbb-ccc', chiamata_da: 'luca', nome: 'Luca',
      lat: 35.6586, lng: 139.7454, nota: 'Si mangia',
      creata_il: new Date().toISOString(),
      scade_il: new Date(Date.now() + 7200000).toISOString()
    });
    await new Promise(x => setTimeout(x, 200));
    return document.getElementById('mRaccoltaIn').classList.contains('active');
  });
  ok('la stessa chiamata non si ripresenta due volte', duevolte === false);

  // Quelle che non riguardano chi guarda non si vedono affatto.
  const scarta = await page.evaluate(async () => {
    const prova = async (r) => {
      closeSheet('mRaccoltaIn');
      await new Promise(x => setTimeout(x, 120));
      raccoltaArrivata(r);
      await new Promise(x => setTimeout(x, 150));
      return document.getElementById('mRaccoltaIn').classList.contains('active');
    };
    const base = {
      trip_id: 'aaa-bbb-ccc', chiamata_da: 'luca', nome: 'Luca', lat: 35.65, lng: 139.7,
      creata_il: new Date().toISOString(), scade_il: new Date(Date.now() + 7200000).toISOString()
    };
    return {
      mia: await prova(Object.assign({}, base, { id: 'r2', chiamata_da: 'io' })),
      altrui: await prova(Object.assign({}, base, { id: 'r3', trip_id: 'un-altro-viaggio' })),
      scaduta: await prova(Object.assign({}, base, { id: 'r4', scade_il: new Date(Date.now() - 1000).toISOString() }))
    };
  });
  ok('la propria chiamata non torna indietro a chi l\'ha fatta', scarta.mia === false);
  ok('quella di un viaggio che non è tuo non si vede', scarta.altrui === false);
  ok('e una scaduta non si apre nemmeno se arriva', scarta.scaduta === false);

  // ── l'orecchio in tempo reale ───────────────────────────────────────────
  const orecchio = await page.evaluate(async () => {
    CLOUD.canali = [];
    raccoltaAscolta();
    const ch = CLOUD.canali[CLOUD.canali.length - 1];
    closeSheet('mRaccoltaIn');
    await new Promise(x => setTimeout(x, 120));
    // come se il database avvisasse adesso
    ch.cb({ new: {
      id: 'r5', trip_id: 'aaa-bbb-ccc', chiamata_da: 'luca', nome: 'Luca',
      lat: 35.66, lng: 139.7, nota: 'Si parte',
      creata_il: new Date().toISOString(), scade_il: new Date(Date.now() + 7200000).toISOString()
    } });
    await new Promise(x => setTimeout(x, 200));
    return { canale: ch.nome, aperto: document.getElementById('mRaccoltaIn').classList.contains('active') };
  });
  ok('l\'app resta in ascolto sulle chiamate', orecchio.canale === 'raccolte-rt', orecchio.canale);
  ok('e una che arriva in quel momento si apre subito', orecchio.aperto === true);

  // Chi riapre l'app dopo trova quella che si era persa.
  const ripesca = await page.evaluate(async () => {
    closeSheet('mRaccoltaIn');
    localStorage.removeItem('geppgo_racc_viste');
    await new Promise(x => setTimeout(x, 120));
    window.__RIGHE = [
      { id: 'r6', trip_id: 'aaa-bbb-ccc', chiamata_da: 'luca', nome: 'Luca', lat: 35.67, lng: 139.7,
        nota: 'Ci vediamo qui', creata_il: new Date().toISOString(),
        scade_il: new Date(Date.now() + 7200000).toISOString() },
      { id: 'r7', trip_id: 'aaa-bbb-ccc', chiamata_da: 'luca', nome: 'Luca', lat: 35.68, lng: 139.7,
        nota: 'vecchia', creata_il: new Date(Date.now() - 9000000).toISOString(),
        scade_il: new Date(Date.now() - 1800000).toISOString() }
    ];
    await raccolteDalCloud();
    await new Promise(x => setTimeout(x, 250));
    return {
      aperto: document.getElementById('mRaccoltaIn').classList.contains('active'),
      corpo: document.getElementById('raccInBody').innerText
    };
  });
  ok('riaprendo l\'app si trova la chiamata che era partita', ripesca.aperto === true);
  ok('quella giusta, non la scaduta', /Ci vediamo qui/.test(ripesca.corpo) && !/vecchia/.test(ripesca.corpo),
     ripesca.corpo.slice(0, 60));

  // ── quello che non deve esserci ─────────────────────────────────────────
  // Una chiamata non si aggiorna mai: se esistesse un update, una riga
  // potrebbe diventare un puntino che segue qualcuno per due ore.
  const fonte = await page.evaluate(() => {
    const s = [...document.querySelectorAll('script')].map(x => x.textContent).join('\n');
    const pezzo = s.slice(s.indexOf('===== A RACCOLTA'), s.indexOf('async function openDiary'));
    return {
      update: /from\('raccolte'\)\s*\.\s*update|from\("raccolte"\)\s*\.\s*update/.test(s),
      watch: /watchPosition/.test(pezzo),
      ore: typeof RACCOLTA_ORE !== 'undefined' ? RACCOLTA_ORE : null
    };
  });
  ok('nessuna parte dell\'app aggiorna una chiamata già fatta', fonte.update === false);
  ok('e nessuna segue la posizione nel tempo', fonte.watch === false);
  ok('la chiamata vale due ore', fonte.ore === 2, String(fonte.ore));

  console.log('\n' + r.join('\n'));
  const falliti = r.filter(x => x.includes('FALLITO')).length;
  console.log(`\n${r.length - falliti}/${r.length} passati`);
  if (err.length) console.log('\nErrori in pagina:\n' + err.join('\n'));
  await browser.close();
  process.exit(falliti ? 1 : 0);
})();
