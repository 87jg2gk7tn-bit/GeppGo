const { apriBrowser, APP, RADICE } = require('./browser');

const stato = {
  trips: [
    { id: 101, cid: 'viaggio-in-gruppo', name: 'Giappone', status: 'open',
      participants: [{ id: 1, name: 'Gepp', isMe: true }, { id: 2, name: 'Luca' }],
      suggested: [], pois: [], expenses: [], tickets: [], weather: {}, days: [], createdAt: Date.now() },
    { id: 102, cid: 'viaggio-da-solo', name: 'Weekend da solo', status: 'open',
      participants: [{ id: 3, name: 'Gepp', isMe: true }],
      suggested: [], pois: [], expenses: [], tickets: [], weather: {}, days: [], createdAt: Date.now() }
  ],
  currentTripId: 101, settings: {}, myName: 'Gepp', premium: true
};

(async () => {
  const browser = await apriBrowser();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const err = [];
  page.on('pageerror', e => err.push('PAGEERROR: ' + e.message));
  await page.addInitScript(s => localStorage.setItem('geppgo2', JSON.stringify(s)), stato);
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof myPos !== 'undefined', { timeout: 20000 });

  const r = [];
  const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);

  await page.evaluate(() => {
    myUid = 'io';
    memByTrip = {
      'viaggio-in-gruppo': { trip_id: 'viaggio-in-gruppo', user_id: 'io', ruolo: 'admin', participant_id: 1 },
      'viaggio-da-solo':   { trip_id: 'viaggio-da-solo',   user_id: 'io', ruolo: 'admin', participant_id: 3 }
    };
    membriPerViaggio = {
      'viaggio-in-gruppo': [
        { trip_id: 'viaggio-in-gruppo', user_id: 'io',   ruolo: 'admin',    participant_id: 1, member_name: 'Gepp' },
        { trip_id: 'viaggio-in-gruppo', user_id: 'luca', ruolo: 'compagno', participant_id: 2, member_name: 'Luca' }
      ],
      'viaggio-da-solo': [
        { trip_id: 'viaggio-da-solo', user_id: 'io', ruolo: 'admin', participant_id: 3, member_name: 'Gepp' }
      ]
    };
    app.trips.forEach(decorateTrip);
    window.CLOUD = { rpc: [], tolti: [], uscito: false };
    session = { user: { id: 'io', email: 'gepp@x.it' } };
    sb = {
      storage: { from: () => ({ remove: async l => { CLOUD.tolti.push(...l); return { error: null }; } }) },
      from: () => ({ select: () => ({ eq: async () => ({ data: [{ percorso: 'viaggio-in-gruppo/mia.jpg' }], error: null }) }) }),
      rpc: async (nome) => { CLOUD.rpc.push(nome); return { error: null }; },
      auth: { signOut: async () => { CLOUD.uscito = true; } }
    };
  });

  // ── il tasto c'è, ed è discreto ──────────────────────────────────────────
  const tasto = await page.evaluate(() => {
    renderProfile();
    const b = [...document.querySelectorAll('#profileCard button')].find(x => /Elimina il mio account/.test(x.textContent));
    return b ? { c: true, rosso: /red/.test(b.getAttribute('style') || '') } : { c: false };
  });
  ok('c\'è il tasto per eliminare l\'account', tasto.c === true);
  ok('ed è segnato come cosa seria', tasto.rosso === true);

  // ── prima di chiedere, dice cosa succede ─────────────────────────────────
  const avviso = await page.evaluate(() => {
    apriEliminaAccount();
    return { aperto: document.getElementById('mElimAcc').classList.contains('active'),
             testo: document.getElementById('eaCosa').innerText };
  });
  ok('si apre spiegando cosa succede', avviso.aperto === true);
  ok('dice che il viaggio con altri dentro resta a loro', /restano a loro/.test(avviso.testo), '');
  ok('e nomina quello dove sei solo', /Weekend da solo/.test(avviso.testo));
  ok('avvisa che le foto spariscono anche ai compagni', /anche dai telefoni dei compagni/.test(avviso.testo));
  ok('e che sul telefono i dati restano', /resta finché non fai un reset/.test(avviso.testo));

  // ── non basta un tocco ───────────────────────────────────────────────────
  const senzaParola = await page.evaluate(async () => {
    document.getElementById('eaConferma').value = '';
    await eliminaAccount();
    return { msg: document.getElementById('eaMsg').textContent, chiamate: CLOUD.rpc.length };
  });
  ok('senza scrivere ELIMINA non parte niente', senzaParola.chiamate === 0, senzaParola.msg);

  const parolaStorta = await page.evaluate(async () => {
    document.getElementById('eaConferma').value = 'elimina tutto';
    await eliminaAccount();
    return CLOUD.rpc.length;
  });
  ok('e nemmeno scrivendo altro', parolaStorta === 0);

  // ── con la parola giusta ─────────────────────────────────────────────────
  const fatto = await page.evaluate(async () => {
    document.getElementById('eaConferma').value = 'elimina';   // minuscolo: vale lo stesso
    await eliminaAccount();
    await new Promise(r => setTimeout(r, 300));
    return { rpc: CLOUD.rpc, tolti: CLOUD.tolti, uscito: CLOUD.uscito,
             chiuso: !document.getElementById('mElimAcc').classList.contains('active') };
  });
  ok('scritta la parola, l\'account viene eliminato', fatto.rpc.includes('elimina_account'), fatto.rpc.join(','));
  ok('e la parola vale anche scritta in minuscolo', fatto.rpc.length === 1);
  ok('i file delle proprie foto vengono tolti prima', fatto.tolti.includes('viaggio-in-gruppo/mia.jpg'), JSON.stringify(fatto.tolti));
  ok('poi si esce dall\'account', fatto.uscito === true);
  ok('e il foglio si chiude', fatto.chiuso === true);

  // ── se il database rifiuta, non si finge che sia andata ──────────────────
  const rifiuto = await page.evaluate(async () => {
    sb.rpc = async () => ({ error: { message: 'qualcosa non va' } });
    apriEliminaAccount();
    document.getElementById('eaConferma').value = 'ELIMINA';
    await eliminaAccount();
    return { msg: document.getElementById('eaMsg').textContent,
             ancoraAperto: document.getElementById('mElimAcc').classList.contains('active') };
  });
  ok('se il cloud rifiuta lo dice, e non chiude', /qualcosa non va/.test(rifiuto.msg) && rifiuto.ancoraAperto, rifiuto.msg);

  // ── senza account non si apre nemmeno ────────────────────────────────────
  const senza = await page.evaluate(() => {
    closeSheet('mElimAcc');
    const v = session; session = null;
    apriEliminaAccount();
    const aperto = document.getElementById('mElimAcc').classList.contains('active');
    session = v;
    return aperto;
  });
  ok('senza essere connessi non si apre', senza === false);

  console.log('\n' + r.join('\n'));
  const falliti = r.filter(x => x.includes('FALLITO')).length;
  console.log(`\n${r.length - falliti}/${r.length} passati`);
  if (err.length) console.log('\nErrori in pagina:\n' + err.join('\n'));
  await browser.close();
  process.exit(falliti ? 1 : 0);
})();
