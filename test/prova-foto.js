const { chromium } = require('playwright-core');
const APP = process.env.APP_URL || 'file:///home/user/GeppGo/Index%202.1.html';

// Un JPEG piccolissimo ma vero: serve perché addPhoto lo passa da un <img>
// e da un canvas, e un finto non verrebbe decodificato.
const JPEG_1x1 = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a' +
  'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA' +
  'AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64');

const stato = {
  trips: [{
    id: 101, cid: 'aaa-bbb-ccc', name: 'Giappone', destination: 'Tokyo', currency: 'JPY',
    status: 'open', start: '2026-09-01', end: '2026-09-02',
    participants: [{ id: 1, name: 'Gepp', isMe: true }, { id: 2, name: 'Luca' }],
    suggested: [], pois: [], expenses: [], tickets: [], weather: {},
    days: [{ id: 1, date: '2026-09-01', title: '', activities: [] }], createdAt: Date.now()
  }],
  currentTripId: 101, settings: {}, myName: 'Gepp', premium: true
};

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const err = [];
  page.on('pageerror', e => err.push('PAGEERROR: ' + e.message));

  await page.addInitScript(s => localStorage.setItem('geppgo2', JSON.stringify(s)), stato);
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof myPos !== 'undefined', { timeout: 20000 });

  const r = [];
  const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);

  // ── un finto cloud: registra tutto quello che l'app gli chiede ────────────
  await page.evaluate(() => {
    myUid = 'io';
    memByTrip = { 'aaa-bbb-ccc': { trip_id: 'aaa-bbb-ccc', user_id: 'io', ruolo: 'admin', participant_id: 1 } };
    membriPerViaggio = { 'aaa-bbb-ccc': [
      { trip_id: 'aaa-bbb-ccc', user_id: 'io',   ruolo: 'admin',    participant_id: 1, member_name: 'Gepp' },
      { trip_id: 'aaa-bbb-ccc', user_id: 'luca', ruolo: 'compagno', participant_id: 2, member_name: 'Luca' }
    ] };
    app.trips.forEach(decorateTrip);

    window.CLOUD = { caricate: [], righe: [], segnalazioni: [], tolte: [], firmate: [], rpc: [] };
    session = { user: { id: 'io' } };
    sb = {
      storage: { from: (b) => ({
        upload: async (percorso, blob, opz) => {
          CLOUD.caricate.push({ bucket: b, percorso, tipo: blob.type, bytes: blob.size, opz });
          return { data: { path: percorso }, error: null };
        },
        remove: async (l) => { CLOUD.tolte.push(...l); return { error: null }; },
        createSignedUrl: async (percorso, sec) => {
          CLOUD.firmate.push({ percorso, sec });
          return { data: { signedUrl: 'data:image/jpeg;base64,' + window.__JPEG }, error: null };
        }
      })},
      from: (tab) => ({
        insert: async (riga) => {
          if (tab === 'foto') CLOUD.righe.push(riga);
          if (tab === 'segnalazioni') CLOUD.segnalazioni.push(riga);
          return { error: null };
        },
        delete: () => ({ eq: async (c, v) => { CLOUD.tolte.push(tab + ':' + v); return { error: null }; } }),
        select: async () => ({ data: window.__RIGHE_REMOTE || [], error: null })
      }),
      rpc: async (nome, arg) => { CLOUD.rpc.push({ nome, arg }); return { error: null }; }
    };
  });
  await page.evaluate(j => { window.__JPEG = j; }, JPEG_1x1.toString('base64'));

  // ── mettere una foto ─────────────────────────────────────────────────────
  await page.setInputFiles('#phInput', { name: 'foto.jpg', mimeType: 'image/jpeg', buffer: JPEG_1x1 });
  await page.waitForFunction(() => CLOUD.caricate.length > 0, { timeout: 10000 });
  const su = await page.evaluate(() => ({ c: CLOUD.caricate[0], riga: CLOUD.righe[0] }));

  ok('la foto finisce nel magazzino giusto', su.c.bucket === 'foto-viaggi', su.c.bucket);
  ok('sotto la cartella del viaggio', su.c.percorso.startsWith('aaa-bbb-ccc/'), su.c.percorso);
  ok('e viene spedita come JPEG', su.c.tipo === 'image/jpeg' && su.c.opz.contentType === 'image/jpeg', su.c.tipo);
  ok('non sovrascrive mai un file esistente', su.c.opz.upsert === false, String(su.c.opz.upsert));
  ok('nel registro si segna chi l\'ha messa', su.riga.caricata_da === 'io', su.riga.caricata_da);
  ok('in quale viaggio', su.riga.trip_id === 'aaa-bbb-ccc', su.riga.trip_id);
  ok('e di che giorno è', su.riga.giorno === '2026-09-01', String(su.riga.giorno));
  ok('registro e file parlano dello stesso percorso', su.riga.percorso === su.c.percorso);

  // resta anche sul telefono, non solo nel cloud
  const locale = await page.evaluate(async () => (await phAll(101)).map(x => ({ cloud: !!x.cloudId, chi: x.chi })));
  ok('e la foto resta anche sul telefono', locale.length === 1 && locale[0].cloud === true, JSON.stringify(locale));

  // ── senza rete non si perde niente ───────────────────────────────────────
  const offline = await page.evaluate(async () => {
    const vero = sb; sb = null;
    await addPhoto({ files: [new File([Uint8Array.from(atob(window.__JPEG), c => c.charCodeAt(0))], 'b.jpg', { type: 'image/jpeg' })], value: '' });
    await new Promise(r => setTimeout(r, 400));
    const dopo = await phAll(101);
    sb = vero;
    const prima = CLOUD.caricate.length;
    await fotoDaSpedire();
    await new Promise(r => setTimeout(r, 400));
    return { quante: dopo.length, caricatePrima: prima, caricateDopo: CLOUD.caricate.length };
  });
  ok('senza rete la foto si salva lo stesso sul telefono', offline.quante === 2, offline.quante + ' foto');
  ok('e parte da sola appena la rete torna', offline.caricateDopo === offline.caricatePrima + 1,
     offline.caricatePrima + ' -> ' + offline.caricateDopo);

  // ── scaricare quelle dei compagni ────────────────────────────────────────
  const giu = await page.evaluate(async () => {
    window.__RIGHE_REMOTE = [{
      id: 'foto-di-luca', trip_id: 'aaa-bbb-ccc', caricata_da: 'luca',
      giorno: '2026-09-01', percorso: 'aaa-bbb-ccc/foto-di-luca.jpg',
      creata_il: new Date().toISOString()
    }];
    await fotoDalCloud();
    await new Promise(r => setTimeout(r, 500));
    const tutte = await phAll(101);
    return { quante: tutte.length, diLuca: tutte.filter(x => x.chi === 'luca').length, firmate: CLOUD.firmate };
  });
  ok('la foto di un compagno arriva sul mio telefono', giu.diLuca === 1, giu.quante + ' foto in tutto');
  ok('scaricata con un indirizzo firmato, non pubblico', giu.firmate.length === 1);
  ok('e quell\'indirizzo scade dopo un\'ora', giu.firmate[0] && giu.firmate[0].sec === 3600, String(giu.firmate[0] && giu.firmate[0].sec));

  const dinuovo = await page.evaluate(async () => {
    const prima = CLOUD.firmate.length;
    await fotoDalCloud();
    await new Promise(r => setTimeout(r, 300));
    return { prima, dopo: CLOUD.firmate.length, quante: (await phAll(101)).length };
  });
  ok('e non la riscarica ogni volta', dinuovo.dopo === dinuovo.prima, dinuovo.prima + ' -> ' + dinuovo.dopo);
  ok('né la duplica', dinuovo.quante === 3, dinuovo.quante + ' foto');

  // ── chi ha messo cosa, scritto sotto la foto ─────────────────────────────
  const scheda = await page.evaluate(async () => {
    const tutte = await phAll(101);
    const dilui = tutte.find(x => x.chi === 'luca');
    await openPhoto(dilui.id); await new Promise(r => setTimeout(r, 200));
    const testoLuca = document.getElementById('phChi').textContent;
    const mia = tutte.find(x => x.chi === 'io');
    await openPhoto(mia.id); await new Promise(r => setTimeout(r, 200));
    return { testoLuca, testoMia: document.getElementById('phChi').textContent };
  });
  ok('sotto la foto c\'è scritto chi l\'ha messa', /Messa da Luca/.test(scheda.testoLuca), scheda.testoLuca);
  ok('e per le proprie dice "tu"', /Messa da tu/.test(scheda.testoMia), scheda.testoMia);
  ok('e dice se è al sicuro nel cloud', /salvata anche nel cloud/.test(scheda.testoMia));

  // ── segnalare ────────────────────────────────────────────────────────────
  const seg = await page.evaluate(async () => {
    const tutte = await phAll(101);
    await openPhoto(tutte.find(x => x.chi === 'luca').id);
    await new Promise(r => setTimeout(r, 150));
    apriSegnala();
    const aperto = document.getElementById('mSegnala').classList.contains('active');
    document.getElementById('sgMotivo').value = 'minori';
    document.getElementById('sgNota').value = 'nella foto c\'è un bambino';
    await inviaSegnalazione();
    await new Promise(r => setTimeout(r, 200));
    return { aperto, inviata: CLOUD.segnalazioni[0], chiuso: !document.getElementById('mSegnala').classList.contains('active') };
  });
  ok('il tasto Segnala apre il modulo', seg.aperto === true);
  ok('la segnalazione parte col motivo scelto', seg.inviata && seg.inviata.motivo === 'minori', JSON.stringify(seg.inviata && seg.inviata.motivo));
  ok('con la nota di chi segnala', /bambino/.test(seg.inviata.nota || ''), seg.inviata.nota);
  ok('a nome di chi sta segnalando', seg.inviata.segnalata_da === 'io', seg.inviata.segnalata_da);
  ok('e tiene da parte il percorso del file', /aaa-bbb-ccc\//.test(seg.inviata.percorso_copia || ''), String(seg.inviata.percorso_copia));
  ok('poi il modulo si chiude', seg.chiuso === true);

  // le opzioni ci sono tutte, a partire da quella che conta di più
  const motivi = await page.evaluate(() => [...document.querySelectorAll('#sgMotivo option')].map(o => o.value));
  ok('fra i motivi c\'è quello sui minori, per primo', motivi[0] === 'minori', motivi.join(','));

  // ── eliminare ────────────────────────────────────────────────────────────
  const elimMia = await page.evaluate(async () => {
    const mia = (await phAll(101)).find(x => x.chi === 'io' && x.cloudId);
    await openPhoto(mia.id); await new Promise(r => setTimeout(r, 150));
    delPhoto(); await new Promise(r => setTimeout(r, 150));
    const testo = document.body.innerText;
    document.getElementById('cfOk').click();
    await new Promise(r => setTimeout(r, 400));
    return { testo, tolte: CLOUD.tolte.slice(), quante: (await phAll(101)).length };
  });
  ok('eliminando la propria avvisa che sparisce a tutti', /anche dai telefoni dei compagni/.test(elimMia.testo));
  ok('e la toglie sia dal registro sia dal magazzino',
     elimMia.tolte.some(x => /^foto:/.test(x)) && elimMia.tolte.some(x => /aaa-bbb-ccc\//.test(x)),
     JSON.stringify(elimMia.tolte));

  // ── salvare la foto sul telefono ─────────────────────────────────────────
  const salva = await page.evaluate(async () => {
    const tutte = await phAll(101);
    await openPhoto(tutte[0].id); await new Promise(r => setTimeout(r, 150));
    const tastoC = !!document.querySelector('#mPhoto [onclick="salvaFoto()"]');
    let condiviso = null;
    navigator.canShare = () => true;
    navigator.share = async (d) => { condiviso = { n: d.files.length, nome: d.files[0].name, tipo: d.files[0].type }; };
    await salvaFoto();
    return { tastoC, condiviso };
  });
  ok('c\'è il tasto per salvarla sul telefono', salva.tastoC === true);
  ok('e passa dal foglio di condivisione del telefono', !!salva.condiviso, JSON.stringify(salva.condiviso));
  ok('mandando un vero file JPEG', salva.condiviso && salva.condiviso.tipo === 'image/jpeg', String(salva.condiviso && salva.condiviso.tipo));
  ok('con un nome riconoscibile', /^geppgo-/.test(salva.condiviso.nome), salva.condiviso.nome);

  // ── quando non arriva nel cloud, si sa perché ────────────────────────────
  const perche = await page.evaluate(async () => {
    const vero = sb.storage;
    sb.storage = { from: () => ({ upload: async () => ({ error: { message: 'Bucket not found' } }) }) };
    const rec = { id: 'zz', tripId: 101, date: '2026-09-01', data: 'data:image/jpeg;base64,' + window.__JPEG, ts: Date.now() };
    const db = await idbP();
    await new Promise(r => { db.transaction('ph', 'readwrite').objectStore('ph').put(rec).onsuccess = r; });
    await fotoSuCloud(rec);
    const motivo = fotoPerche;
    await openPhoto('zz'); await new Promise(r => setTimeout(r, 200));
    const riga = document.getElementById('phChi').textContent;
    const tasto = document.getElementById('phRiprova').style.display;
    sb.storage = vero;
    return { motivo, riga, tasto };
  });
  ok('un magazzino mancante viene spiegato, non subìto', /supabase-schema\.sql/.test(perche.motivo), perche.motivo);
  ok('e la spiegazione si legge sotto la foto', /supabase-schema\.sql/.test(perche.riga), perche.riga.slice(0, 90));
  ok('con il tasto per riprovare', perche.tasto === 'block', perche.tasto);

  const senzaSess = await page.evaluate(async () => {
    const v = session; session = null;
    await fotoSuCloud({ id: 'q', tripId: 101, data: 'x' });
    session = v; return fotoPerche;
  });
  ok('e se non sei connesso lo dice chiaro', /accedi dal Profilo/.test(senzaSess), senzaSess);

  console.log('\n' + r.join('\n'));
  const falliti = r.filter(x => x.includes('FALLITO')).length;
  console.log(`\n${r.length - falliti}/${r.length} passati`);
  if (err.length) console.log('\nErrori in pagina:\n' + err.join('\n'));
  await browser.close();
  process.exit(falliti ? 1 : 0);
})();
