const { chromium } = require('playwright-core');
const APP = process.env.APP_URL || 'file:///home/user/GeppGo/Index%202.1.html';

const stato = {
  trips: [
    { id: 101, cid: 'aaa', name: 'Giappone mio', destination: 'Tokyo', currency: 'JPY',
      status: 'open', start: '2026-09-01', end: '2026-09-05',
      participants: [{ id: 1, name: 'Gepp', isMe: true }, { id: 2, name: 'Luca' }],
      suggested: [], pois: [], expenses: [], tickets: [], weather: {},
      days: [{ id: 1, date: '2026-09-01', title: '', activities: [] }], createdAt: Date.now() },
    { id: 102, cid: 'bbb', name: 'Norvegia di Luca', destination: 'Oslo', currency: 'EUR',
      status: 'open', participants: [{ id: 3, name: 'Gepp', isMe: true }],
      suggested: [], pois: [], expenses: [], tickets: [], weather: {},
      days: [], createdAt: Date.now() },
    { id: 103, cid: 'ccc', name: 'Peru di Anna', destination: 'Lima', currency: 'USD',
      status: 'open', participants: [{ id: 4, name: 'Gepp', isMe: true }],
      suggested: [], pois: [], expenses: [], tickets: [], weather: {},
      days: [], createdAt: Date.now() }
  ],
  currentTripId: 101, settings: {}, myName: 'Gepp', premium: false
};

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const err = [];
  page.on('pageerror', e => err.push('PAGEERROR: ' + e.message));

  await page.addInitScript(s => localStorage.setItem('geppgo2', JSON.stringify(s)), stato);
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof myPos !== 'undefined', { timeout: 15000 });

  const r = [];
  const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);

  // Si finge di essere loggati: uno mio (admin), due altrui (compagno).
  await page.evaluate(() => {
    myUid = 'io';
    memByTrip = {
      aaa: { trip_id: 'aaa', user_id: 'io', ruolo: 'admin',    participant_id: 1 },
      bbb: { trip_id: 'bbb', user_id: 'io', ruolo: 'compagno', participant_id: 3 },
      ccc: { trip_id: 'ccc', user_id: 'io', ruolo: 'compagno', participant_id: 4 }
    };
    membriPerViaggio = {
      aaa: [{ trip_id: 'aaa', user_id: 'io',   ruolo: 'admin',    participant_id: 1, member_name: 'Gepp' },
            { trip_id: 'aaa', user_id: 'luca', ruolo: 'compagno', participant_id: 2, member_name: 'Luca' }],
      bbb: [{ trip_id: 'bbb', user_id: 'io',   ruolo: 'compagno', participant_id: 3, member_name: 'Gepp' },
            { trip_id: 'bbb', user_id: 'luca', ruolo: 'admin',    participant_id: 9, member_name: 'Luca' }],
      ccc: [{ trip_id: 'ccc', user_id: 'io',   ruolo: 'compagno', participant_id: 4, member_name: 'Gepp' },
            { trip_id: 'ccc', user_id: 'anna', ruolo: 'admin',    participant_id: 8, member_name: 'Anna' }]
    };
    app.trips.forEach(decorateTrip);
  });

  // ── il limite gratuito ────────────────────────────────────────────────────
  const lim = await page.evaluate(() => ({
    miei: viaggiMiei().map(t => t.name),
    puo: canCreateTrip(),
    tutti: app.trips.filter(t => t.status !== 'closed').length
  }));
  ok('i viaggi altrui non contano come miei', lim.miei.length === 1 && /Giappone/.test(lim.miei[0]), lim.miei.join(' | '));
  ok('con due inviti ricevuti posso ancora creare il mio', lim.puo === true, 'attivi in tutto: ' + lim.tutti);

  // e con due viaggi MIEI il limite scatta davvero
  const lim2 = await page.evaluate(() => {
    app.trips.push({ id: 104, name: 'Secondo mio', status: 'open', participants: [], days: [], pois: [], expenses: [], tickets: [], suggested: [], weather: {} });
    const prima = canCreateTrip();
    app.trips.push({ id: 105, name: 'Terzo mio', status: 'open', participants: [], days: [], pois: [], expenses: [], tickets: [], suggested: [], weather: {} });
    const dopo = canCreateTrip();
    app.trips = app.trips.filter(t => t.id < 104);
    return { prima, dopo };
  });
  ok('con due viaggi miei il limite non è ancora scattato', lim2.prima === false, 'canCreateTrip=' + lim2.prima);
  ok('e resta chiuso col terzo', lim2.dopo === false);

  // Prima che la sincronizzazione sia arrivata (o senza rete) il ruolo non si
  // conosce ancora: i viaggi del cloud non devono contare, altrimenti il bug
  // degli inviti torna identico appena si apre l'app.
  const alBuio = await page.evaluate(() => {
    const salva = app.trips;
    app.trips = [
      { id: 201, cid: 'x1', name: 'Invito 1', status: 'open' },
      { id: 202, cid: 'x2', name: 'Invito 2', status: 'open' }
    ];
    const puo = canCreateTrip(), quanti = viaggiMiei().length;
    app.trips = [{ id: 203, name: 'Solo mio, mai nel cloud', status: 'open' }];
    const localeConta = viaggiMiei().length;
    app.trips = salva;
    return { puo, quanti, localeConta };
  });
  ok('senza ancora sapere i ruoli, i viaggi del cloud non contano', alBuio.quanti === 0, alBuio.quanti + ' contati');
  ok('e si può creare il proprio viaggio lo stesso', alBuio.puo === true);
  ok('mentre un viaggio mai andato nel cloud conta come mio', alBuio.localeConta === 1);

  // ── i ruoli letti dal cloud ───────────────────────────────────────────────
  const ru = await page.evaluate(() => ({
    mio: app.trips.find(t => t.cid === 'aaa')._admin,
    altrui: app.trips.find(t => t.cid === 'bbb')._admin,
    quantiMio: quantiAdmin(app.trips.find(t => t.cid === 'aaa')),
    locale: (() => { const t = { id: 9, participants: [] }; decorateTrip(t); return t._admin; })()
  }));
  ok('sono admin del viaggio che ho creato', ru.mio === true);
  ok('e solo compagno in quello altrui', ru.altrui === false);
  ok('un viaggio mai andato nel cloud è mio', ru.locale === true);
  ok('conta gli admin del viaggio', ru.quantiMio === 1, String(ru.quantiMio));

  // ── l'avviso di eliminazione ──────────────────────────────────────────────
  const av = await page.evaluate(() => {
    const t = app.trips.find(x => x.cid === 'aaa');
    const vuoto = avvisoEliminazione(t);
    t.canc_chiesta_da = 'luca';
    membriPerViaggio.aaa[1].ruolo = 'admin';
    const altrui = avvisoEliminazione(t);
    t.canc_chiesta_da = 'io';
    const mio = avvisoEliminazione(t);
    const compagno = (() => { const b = app.trips.find(x => x.cid === 'bbb'); b.canc_chiesta_da = 'luca'; return avvisoEliminazione(b); })();
    t.canc_chiesta_da = null; membriPerViaggio.aaa[1].ruolo = 'compagno';
    return { vuoto, altrui, mio, compagno };
  });
  ok('senza richieste non c\'è nessun avviso', av.vuoto === '');
  ok('la richiesta di un altro admin si vede col suo nome', /Luca vuole eliminare/.test(av.altrui));
  ok('e offre il tasto per confermare', /confermaEliminazione\('aaa'\)/.test(av.altrui));
  ok('la propria richiesta dice che serve un altro admin', /Serve la conferma di un altro admin/.test(av.mio));
  ok('e non offre a sé stessi il tasto conferma', !/confermaEliminazione/.test(av.mio));
  ok('entrambe si possono annullare', /annullaEliminazione\('aaa'\)/.test(av.altrui) && /annullaEliminazione\('aaa'\)/.test(av.mio));
  ok('a un compagno non si mostra niente da confermare', av.compagno === '');

  // ── la scheda persone ─────────────────────────────────────────────────────
  const pe = await page.evaluate(() => {
    app.currentTripId = 101; renderPeople();
    const admin = document.getElementById('peopleList').innerHTML;
    app.currentTripId = 102; renderPeople();
    const compagno = document.getElementById('peopleList').innerHTML;
    app.currentTripId = 101;
    return { admin, compagno };
  });
  ok('l\'admin vede la corona sul proprio nome', /👑/.test(pe.admin));
  ok('e può promuovere un compagno', /cambiaRuolo\(2,'admin'\)/.test(pe.admin));
  ok('con un solo admin non gli si offre di togliersi il ruolo', !/cambiaRuolo\(1,'compagno'\)/.test(pe.admin));
  ok('un compagno non può promuovere nessuno', !/cambiaRuolo/.test(pe.compagno));

  // con due admin, togliere il ruolo torna possibile
  const pe2 = await page.evaluate(() => {
    membriPerViaggio.aaa[1].ruolo = 'admin';
    app.currentTripId = 101; renderPeople();
    const h = document.getElementById('peopleList').innerHTML;
    membriPerViaggio.aaa[1].ruolo = 'compagno';
    return h;
  });
  ok('con due admin si può togliere il ruolo a uno', /cambiaRuolo\(2,'compagno'\)/.test(pe2));

  // ── il tasto nella scheda viaggio ─────────────────────────────────────────
  const bt = await page.evaluate(() => {
    openDetail(101); const mio = document.getElementById('detailBody').innerHTML;
    openDetail(102); const altrui = document.getElementById('detailBody').innerHTML;
    return { mio, altrui };
  });
  ok('sul viaggio mio il tasto è il cestino', /🗑️<\/button>/.test(bt.mio));
  ok('su quello altrui diventa "esci"', /🚪<\/button>/.test(bt.altrui) && /Esci dal viaggio/.test(bt.altrui));

  // ── il piano gratuito: si conclude, non si elimina ────────────────────────
  const gr = await page.evaluate(async () => {
    app.premium = false; app.currentTripId = 101;
    askDeleteTrip(101);
    await new Promise(r => setTimeout(r, 200));
    const testo = document.body.innerText;
    const titolo = /Eliminare è del Premium/.test(testo);
    const parla = /si concludono invece di eliminarli/.test(testo);
    document.querySelectorAll('.modal.on .x-close,.modal.on [onclick*="close"]').forEach(b => b.click());
    return { titolo, parla };
  });
  ok('senza Premium eliminare propone di concludere', gr.titolo, JSON.stringify(gr));
  ok('e spiega perché', gr.parla);

  console.log('\n' + r.join('\n'));
  const falliti = r.filter(x => x.includes('FALLITO')).length;
  console.log(`\n${r.length - falliti}/${r.length} passati`);
  if (err.length) console.log('\nErrori in pagina:\n' + err.join('\n'));
  await browser.close();
  process.exit(falliti ? 1 : 0);
})();
