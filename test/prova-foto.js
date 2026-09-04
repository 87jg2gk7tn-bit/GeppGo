const { apriBrowser, APP, RADICE } = require('./browser');

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
  const browser = await apriBrowser();
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
  await page.waitForSelector('#mFotoQual.active', { timeout: 10000 });
  const opzioni = await page.evaluate(() => [...document.querySelectorAll('#fqLista button')].map(b => b.textContent.replace(/\s+/g, ' ').trim()));
  ok('la qualità viene chiesta al momento di caricare', opzioni.length === 4, opzioni.length + ' opzioni');
  ok('con quanto peserà, scritto accanto', /KB|MB/.test(opzioni.join(' ')), opzioni[0]);
  ok('e "Originale" dice il peso vero di quel file', /Originale/.test(opzioni[3]), opzioni[3]);
  await page.evaluate(() => scegliQualita('alta'));
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
    const pr = addPhoto({ files: [new File([Uint8Array.from(atob(window.__JPEG), c => c.charCodeAt(0))], 'b.jpg', { type: 'image/jpeg' })], value: '' });
    await new Promise(r => setTimeout(r, 150)); scegliQualita('alta'); await pr;
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
    await fotoProvaCarico({ id: 'q', tripId: 101, data: 'x' });
    session = v; return fotoPerche;
  });
  ok('e se non sei connesso lo dice chiaro', /accedi dal Profilo/.test(senzaSess), senzaSess);

  // ── la qualità: quanto si perde e quanto si può scegliere ────────────────
  const qual = await page.evaluate(() => ({
    livelli: Object.keys(FOTO_QUALITA),
    diSerie: fotoLivello().nome,
    originaleNonRiduce: FOTO_QUALITA.originale.lato === 0,
    altaPixel: FOTO_QUALITA.alta.lato
  }));
  ok('si può scegliere fra quattro qualità', qual.livelli.length === 4, qual.livelli.join(','));
  ok('di serie è Alta, non più la miniatura', qual.diSerie === 'Alta', qual.diSerie);
  ok('"Alta" è 2560 px, non 1000', qual.altaPixel === 2560, String(qual.altaPixel));
  ok('e "Originale" non ridimensiona affatto', qual.originaleNonRiduce === true);

  // la scelta si salva e vale per le foto dopo
  const scelta = await page.evaluate(() => {
    app.settings = app.settings || {};
    mostraFotoQual();
    document.getElementById('fotoQual').value = 'leggera';
    saveFotoQual();
    return { salvata: app.settings.fotoQualita, usata: fotoLivello().lato, nota: document.getElementById('fotoQualNota').textContent };
  });
  ok('la scelta si salva', scelta.salvata === 'leggera', scelta.salvata);
  ok('e viene usata per ridurre', scelta.usata === 1000, String(scelta.usata));
  ok('con sotto scritto quanto pesa', /KB|MB/.test(scelta.nota), scelta.nota);

  // con "Originale" il file arriva nel cloud intatto, byte per byte
  const intatta = await page.evaluate(async () => {
    app.settings.fotoQualita = 'originale';
    const byte = Uint8Array.from(atob(window.__JPEG), c => c.charCodeAt(0));
    const prima = CLOUD.caricate.length;
    const pr = addPhoto({ files: [new File([byte], 'o.jpg', { type: 'image/jpeg' })], value: '' });
    await new Promise(r => setTimeout(r, 150)); scegliQualita('originale'); await pr;
    await new Promise(r => setTimeout(r, 700));
    const c = CLOUD.caricate[CLOUD.caricate.length - 1];
    return { partito: byte.length, arrivato: c && c.bytes, nuove: CLOUD.caricate.length - prima };
  });
  ok('con "Originale" il file parte identico, byte per byte',
     intatta.arrivato === intatta.partito, intatta.partito + ' -> ' + intatta.arrivato + ' byte');

  // un file che non è JPEG non può restare "originale": si ripiega, non si perde
  const nonJpeg = await page.evaluate(async () => {
    app.settings.fotoQualita = 'originale';
    const prima = CLOUD.caricate.length;
    const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), c => c.charCodeAt(0));
    const pr = addPhoto({ files: [new File([png], 'x.png', { type: 'image/png' })], value: '' });
    await new Promise(r => setTimeout(r, 150)); scegliQualita('originale'); await pr;
    await new Promise(r => setTimeout(r, 700));
    const c = CLOUD.caricate[CLOUD.caricate.length - 1];
    return { nuove: CLOUD.caricate.length - prima, tipo: c && c.tipo };
  });
  ok('un PNG viene comunque accolto, convertito in JPEG', nonJpeg.nuove === 1 && nonJpeg.tipo === 'image/jpeg',
     JSON.stringify(nonJpeg));

  const annulla = await page.evaluate(async () => {
    const prima = (await phAll(101)).length, su = CLOUD.caricate.length;
    const pr = addPhoto({ files: [new File([Uint8Array.from(atob(window.__JPEG), c => c.charCodeAt(0))], 'n.jpg', { type: 'image/jpeg' })], value: '' });
    await new Promise(r => setTimeout(r, 150));
    scegliQualita(null);
    await pr; await new Promise(r => setTimeout(r, 300));
    return { prima, dopo: (await phAll(101)).length, su, suDopo: CLOUD.caricate.length };
  });
  ok('chiudendo senza scegliere non si carica niente',
     annulla.dopo === annulla.prima && annulla.suDopo === annulla.su,
     annulla.prima + '->' + annulla.dopo + ' foto');

  // ── la qualità che scarico è quella che ho caricato ──────────────────────
  const identica = await page.evaluate(async () => {
    app.settings.fotoQualita = 'originale';
    const byte = Uint8Array.from(atob(window.__JPEG), c => c.charCodeAt(0));
    const pr = addPhoto({ files: [new File([byte], 'i.jpg', { type: 'image/jpeg' })], value: '' });
    await new Promise(r => setTimeout(r, 150)); scegliQualita('originale'); await pr;
    await new Promise(r => setTimeout(r, 700));
    const ultima = CLOUD.caricate[CLOUD.caricate.length - 1];
    const caricata = ultima.bytes;

    // quello che il telefono ha in mano: presa per identità, non per ordine
    const idFoto = ultima.percorso.split('/')[1].replace('.jpg', '');
    const rec = (await phAll(101)).find(x => x.cloudId === idFoto);
    const inCasa = dataUrlABlob(rec.data).size;

    // quello che esce dal tasto "Salva sul telefono"
    let salvato = null;
    navigator.canShare = () => true;
    navigator.share = async (d) => { salvato = d.files[0].size; };
    await openPhoto(rec.id); await new Promise(r => setTimeout(r, 150));
    await salvaFoto();
    return { partita: byte.length, caricata, inCasa, salvato };
  });
  ok('quello che carico e quello che tengo sono lo stesso file',
     identica.caricata === identica.partita && identica.inCasa === identica.partita,
     identica.partita + ' / ' + identica.caricata + ' / ' + identica.inCasa + ' byte');
  ok('e scaricandola esce identica, senza ricomprimere',
     identica.salvato === identica.partita, identica.salvato + ' byte');

  // ── a blocchi ────────────────────────────────────────────────────────────
  const blocco = await page.evaluate(async () => {
    const fai = n => Array.from({ length: n }, (_, i) =>
      new File([Uint8Array.from(atob(window.__JPEG), c => c.charCodeAt(0))], 'b' + i + '.jpg', { type: 'image/jpeg' }));
    const prima = (await phAll(101)).length, su = CLOUD.caricate.length;
    const pr = addPhoto({ files: fai(5), value: '' });
    await new Promise(r => setTimeout(r, 200));
    const titolo = document.querySelector('#mFotoQual .sheet-t').textContent;
    scegliQualita('alta'); await pr;
    await new Promise(r => setTimeout(r, 1500));
    return { titolo, aggiunte: (await phAll(101)).length - prima, caricate: CLOUD.caricate.length - su };
  });
  ok('si caricano più foto in una volta', blocco.aggiunte === 5, blocco.aggiunte + ' aggiunte');
  ok('e la qualità si sceglie una volta sola per tutte', /queste 5 foto/.test(blocco.titolo), blocco.titolo);
  ok('vanno tutte anche nel cloud', blocco.caricate === 5, blocco.caricate + ' caricate');

  const tetto = await page.evaluate(async () => {
    const fai = n => Array.from({ length: n }, (_, i) =>
      new File([Uint8Array.from(atob(window.__JPEG), c => c.charCodeAt(0))], 'c' + i + '.jpg', { type: 'image/jpeg' }));
    const prima = (await phAll(101)).length;
    const pr = addPhoto({ files: fai(20), value: '' });
    await new Promise(r => setTimeout(r, 200));
    const titolo = document.querySelector('#mFotoQual .sheet-t').textContent;
    scegliQualita('leggera'); await pr;
    await new Promise(r => setTimeout(r, 3000));
    return { titolo, aggiunte: (await phAll(101)).length - prima, max: FOTO_MAX_BLOCCO };
  });
  ok('oltre il blocco si ferma a 15', tetto.aggiunte === 15, tetto.aggiunte + ' aggiunte su 20 scelte');
  ok('e lo dice prima di partire', /queste 15 foto/.test(tetto.titolo), tetto.titolo);

  const multi = await page.evaluate(() => document.getElementById('phInput').hasAttribute('multiple'));
  ok('e il selettore del telefono ne fa scegliere più di una', multi === true);

  console.log('\n' + r.join('\n'));
  const falliti = r.filter(x => x.includes('FALLITO')).length;
  console.log(`\n${r.length - falliti}/${r.length} passati`);
  if (err.length) console.log('\nErrori in pagina:\n' + err.join('\n'));
  await browser.close();
  process.exit(falliti ? 1 : 0);
})();
