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

    window.CLOUD = { caricate: [], righe: [], segnalazioni: [], tolte: [], firmate: [], rpc: [], file: {}, scaricati: [] };
    // Le foto piene, separate dalle miniature: da quando ogni foto ne porta
    // due, contare i caricamenti non dice piu' quante foto sono partite.
    window.PIENE = () => CLOUD.caricate.filter(c => !/-mini\.jpg$/.test(c.percorso));
    window.ULTIMA_PIENA = () => { const p = PIENE(); return p[p.length - 1]; };
    session = { user: { id: 'io' } };
    sb = {
      storage: { from: (b) => ({
        upload: async (percorso, blob, opz) => {
          CLOUD.caricate.push({ bucket: b, percorso, tipo: blob.type, bytes: blob.size, opz });
          // Il finto magazzino tiene i byte veri e li ridà uguali: è l'unico
          // modo perché "quanto si scarica" sia una misura e non una stima.
          CLOUD.file[percorso] = blob;
          return { data: { path: percorso }, error: null };
        },
        remove: async (l) => { CLOUD.tolte.push(...l); l.forEach(p => delete CLOUD.file[p]); return { error: null }; },
        createSignedUrl: async (percorso, sec) => {
          CLOUD.firmate.push({ percorso, sec });
          const blob = CLOUD.file[percorso] ||
            new Blob([Uint8Array.from(atob(window.__JPEG), c => c.charCodeAt(0))], { type: 'image/jpeg' });
          // Ogni indirizzo firmato viene scaricato subito dopo: segnarne il
          // peso qui vale quanto misurare il traffico.
          CLOUD.scaricati.push({ percorso, bytes: blob.size });
          return { data: { signedUrl: URL.createObjectURL(blob) }, error: null };
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
    const prima = PIENE().length;
    await fotoDaSpedire();
    await new Promise(r => setTimeout(r, 400));
    return { quante: dopo.length, caricatePrima: prima, caricateDopo: PIENE().length };
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
    const prima = PIENE().length;
    const pr = addPhoto({ files: [new File([byte], 'o.jpg', { type: 'image/jpeg' })], value: '' });
    await new Promise(r => setTimeout(r, 150)); scegliQualita('originale'); await pr;
    await new Promise(r => setTimeout(r, 700));
    const c = ULTIMA_PIENA();
    return { partito: byte.length, arrivato: c && c.bytes, nuove: PIENE().length - prima };
  });
  ok('con "Originale" il file parte identico, byte per byte',
     intatta.arrivato === intatta.partito, intatta.partito + ' -> ' + intatta.arrivato + ' byte');

  // un file che non è JPEG non può restare "originale": si ripiega, non si perde
  const nonJpeg = await page.evaluate(async () => {
    app.settings.fotoQualita = 'originale';
    const prima = PIENE().length;
    const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), c => c.charCodeAt(0));
    const pr = addPhoto({ files: [new File([png], 'x.png', { type: 'image/png' })], value: '' });
    await new Promise(r => setTimeout(r, 150)); scegliQualita('originale'); await pr;
    await new Promise(r => setTimeout(r, 700));
    const c = ULTIMA_PIENA();
    return { nuove: PIENE().length - prima, tipo: c && c.tipo };
  });
  ok('un PNG viene comunque accolto, convertito in JPEG', nonJpeg.nuove === 1 && nonJpeg.tipo === 'image/jpeg',
     JSON.stringify(nonJpeg));

  const annulla = await page.evaluate(async () => {
    const prima = (await phAll(101)).length, su = PIENE().length;
    const pr = addPhoto({ files: [new File([Uint8Array.from(atob(window.__JPEG), c => c.charCodeAt(0))], 'n.jpg', { type: 'image/jpeg' })], value: '' });
    await new Promise(r => setTimeout(r, 150));
    scegliQualita(null);
    await pr; await new Promise(r => setTimeout(r, 300));
    return { prima, dopo: (await phAll(101)).length, su, suDopo: PIENE().length };
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
    const ultima = ULTIMA_PIENA();
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
    const prima = (await phAll(101)).length, su = PIENE().length;
    const pr = addPhoto({ files: fai(5), value: '' });
    await new Promise(r => setTimeout(r, 200));
    const titolo = document.querySelector('#mFotoQual .sheet-t').textContent;
    scegliQualita('alta'); await pr;
    await new Promise(r => setTimeout(r, 1500));
    return { titolo, aggiunte: (await phAll(101)).length - prima, caricate: PIENE().length - su };
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

  // ── le miniature: quanto si scarica davvero ──────────────────────────────
  // Prima di questa parte ogni telefono si tirava giù ogni foto di ogni
  // viaggio a grandezza naturale, per sempre. Qui si misura: con una foto
  // vera, quanto parte, quanto pesa la miniatura, e quanti byte scende chi
  // apre l'app senza guardare niente.
  const mini = await page.evaluate(async () => {
    // Una foto vera, non un pixel: rumore a 1600x1200, che comprime male
    // proprio come una foto di città piena di dettagli.
    const fotoFinta = (lato) => new Promise(res => {
      const cv = document.createElement('canvas');
      cv.width = lato; cv.height = Math.round(lato * 0.75);
      const cx = cv.getContext('2d');
      const im = cx.createImageData(cv.width, cv.height);
      for (let i = 0; i < im.data.length; i += 4) {
        im.data[i] = Math.random() * 255; im.data[i + 1] = Math.random() * 255;
        im.data[i + 2] = Math.random() * 255; im.data[i + 3] = 255;
      }
      cx.putImageData(im, 0, 0);
      cv.toBlob(b => res(b), 'image/jpeg', 0.9);
    });
    const blob = await fotoFinta(1600);
    app.settings.fotoQualita = 'alta';
    const prima = CLOUD.caricate.length;
    const pr = addPhoto({ files: [new File([blob], 'vera.jpg', { type: 'image/jpeg' })], value: '' });
    await new Promise(r => setTimeout(r, 200)); scegliQualita('alta'); await pr;
    await new Promise(r => setTimeout(r, 1500));
    const nuovi = CLOUD.caricate.slice(prima);
    const piena = nuovi.find(c => !/-mini\.jpg$/.test(c.percorso));
    const piccola = nuovi.find(c => /-mini\.jpg$/.test(c.percorso));
    const riga = CLOUD.righe[CLOUD.righe.length - 1];
    return { quanti: nuovi.length, piena, piccola, riga };
  });
  ok('di ogni foto parte anche una miniatura', mini.quanti === 2 && !!mini.piccola,
     mini.quanti + ' file: ' + (mini.piccola ? mini.piccola.percorso : 'nessuna miniatura'));
  ok('con lo stesso nome della foto, più "-mini"',
     !!mini.piccola && mini.piccola.percorso === mini.piena.percorso.replace(/\.jpg$/, '-mini.jpg'),
     mini.piccola && mini.piccola.percorso);
  ok('nella stessa cartella del viaggio, così valgono gli stessi permessi',
     !!mini.piccola && mini.piccola.percorso.startsWith('aaa-bbb-ccc/'), mini.piccola && mini.piccola.percorso);
  const kb = c => c ? Math.round(c.bytes / 1024) + ' KB' : 'niente';
  ok('e pesa una frazione della foto',
     !!mini.piccola && mini.piccola.bytes * 8 < mini.piena.bytes,
     kb(mini.piena) + ' -> ' + kb(mini.piccola));
  ok('il registro sa dov\'è la miniatura',
     !!mini.piccola && !!mini.riga && mini.riga.percorso_mini === mini.piccola.percorso,
     String(mini.riga && mini.riga.percorso_mini));

  // Il compagno che apre l'app: si scarica la miniatura, non la foto.
  const traffico = await page.evaluate(async () => {
    const piena = ULTIMA_PIENA();
    const pesoPieno = CLOUD.file[piena.percorso].size;
    window.__RIGHE_REMOTE = [{
      id: 'foto-vera-di-luca', trip_id: 'aaa-bbb-ccc', caricata_da: 'luca', giorno: '2026-09-01',
      percorso: piena.percorso, percorso_mini: piena.percorso.replace(/\.jpg$/, '-mini.jpg'),
      creata_il: new Date().toISOString()
    }];
    CLOUD.scaricati = [];
    await fotoDalCloud();
    await new Promise(r => setTimeout(r, 600));
    const rec = (await phAll(101)).find(x => x.cloudId === 'foto-vera-di-luca');
    return {
      pesoPieno, scaricati: CLOUD.scaricati.slice(),
      byte: CLOUD.scaricati.reduce((n, x) => n + x.bytes, 0),
      haMini: !!(rec && rec.mini), haPiena: !!(rec && rec.data), id: rec && rec.id
    };
  });
  ok('sincronizzando arriva la miniatura, non la foto',
     traffico.scaricati.length === 1 && /-mini\.jpg$/.test(traffico.scaricati[0].percorso),
     JSON.stringify(traffico.scaricati.map(x => x.percorso)));
  ok('e la foto piena resta nel cloud finché non la si apre',
     traffico.haMini === true && traffico.haPiena === false,
     'miniatura ' + traffico.haMini + ', foto ' + traffico.haPiena);
  ok('così chi apre l\'app scarica almeno otto volte meno',
     traffico.byte * 8 < traffico.pesoPieno,
     Math.round(traffico.pesoPieno / 1024) + ' KB prima, ' + Math.round(traffico.byte / 1024) + ' KB adesso');

  // La striscia del giorno si disegna con la miniatura: è alta 62 pixel.
  const striscia = await page.evaluate(async () => {
    await renderDayPhotos();
    const rec = (await phAll(101)).find(x => x.cloudId === 'foto-vera-di-luca');
    const img = [...document.querySelectorAll('#dayPhotos img')].find(i => i.getAttribute('onclick').includes(rec.id));
    return { trovata: !!img, èLaMini: !!img && img.src === rec.mini };
  });
  ok('la striscia del giorno mostra la miniatura', striscia.trovata && striscia.èLaMini === true,
     JSON.stringify(striscia));

  // Aprendola davvero, la foto vera scende - una volta sola.
  const apre = await page.evaluate(async () => {
    const rec = (await phAll(101)).find(x => x.cloudId === 'foto-vera-di-luca');
    // Il finto cloud risponde in un millesimo di secondo, e così non si
    // vedrebbe mai quello che c'è da vedere: la miniatura che tiene il posto
    // mentre la foto vera sta arrivando. Qui si mette la lentezza di una
    // rete da viaggio, e solo sulla foto piena.
    const veroSt = sb.storage;
    sb.storage = { from: (b) => {
      const s = veroSt.from(b);
      return Object.assign({}, s, {
        createSignedUrl: async (p, sec) => {
          if (!/-mini\.jpg$/.test(p)) await new Promise(r => setTimeout(r, 500));
          return s.createSignedUrl(p, sec);
        }
      });
    }};
    CLOUD.scaricati = [];
    await openPhoto(rec.id);
    await new Promise(r => setTimeout(r, 150));
    const subito = document.getElementById('phBig').src;
    await new Promise(r => setTimeout(r, 1200));
    const dopo = document.getElementById('phBig').src;
    const salvato = (await phAll(101)).find(x => x.cloudId === 'foto-vera-di-luca');
    const primoGiro = CLOUD.scaricati.slice();
    // riaperta: non deve scaricare di nuovo niente
    CLOUD.scaricati = [];
    await openPhoto(rec.id);
    await new Promise(r => setTimeout(r, 800));
    sb.storage = veroSt;
    return {
      subitoÈLaMini: subito === rec.mini,
      cambiata: dopo !== subito && dopo.length > 100,
      tenuta: !!(salvato && salvato.data),
      primoGiro, secondoGiro: CLOUD.scaricati.slice()
    };
  });
  ok('aprendo una foto si vede subito la miniatura, senza attese', apre.subitoÈLaMini === true);
  ok('poi al suo posto arriva la foto vera', apre.cambiata === true);
  ok('scaricata dal percorso della foto piena',
     apre.primoGiro.length === 1 && !/-mini\.jpg$/.test(apre.primoGiro[0].percorso),
     JSON.stringify(apre.primoGiro.map(x => x.percorso)));
  ok('e da lì in poi resta sul telefono: senza rete si rivede', apre.tenuta === true);
  ok('riaprendola non si scarica una seconda volta', apre.secondoGiro.length === 0,
     JSON.stringify(apre.secondoGiro.map(x => x.percorso)));

  // Nel rullino ci va la foto vera, mai la miniatura.
  const salvaVera = await page.evaluate(async () => {
    const rec = (await phAll(101)).find(x => x.cloudId === 'foto-vera-di-luca');
    // si riparte da capo: solo miniatura, come chi non l'ha mai aperta
    const db = await idbP();
    delete rec.data;
    await new Promise(r => { db.transaction('ph', 'readwrite').objectStore('ph').put(rec).onsuccess = r; });
    let uscito = null;
    navigator.canShare = () => true;
    navigator.share = async (d) => { uscito = d.files[0].size; };
    await openPhoto(rec.id);
    await new Promise(r => setTimeout(r, 80));
    phRec = await new Promise(res => { const q = db.transaction('ph').objectStore('ph').get(rec.id); q.onsuccess = e => res(e.target.result); });
    delete phRec.data;
    await salvaFoto();
    const peso = p => (p && CLOUD.file[p]) ? CLOUD.file[p].size : 0;
    return { uscito, pesoMini: peso(rec.percorsoMini), pesoPieno: peso(rec.percorso) };
  });
  ok('salvandola sul telefono esce la foto vera, non la miniatura',
     salvaVera.pesoPieno > 0 && salvaVera.uscito === salvaVera.pesoPieno,
     salvaVera.uscito + ' byte (miniatura ' + salvaVera.pesoMini + ', foto ' + salvaVera.pesoPieno + ')');

  // Cancellando una foto se ne va anche la miniatura: una cancellazione che
  // lascia in giro una copia più piccola non è una cancellazione.
  const elimMini = await page.evaluate(async () => {
    const rec = (await phAll(101)).find(x => x.chi === 'io' && x.percorsoMini);
    if (!rec) return { tolte: [], percorso: null, mini: null };
    await openPhoto(rec.id); await new Promise(r => setTimeout(r, 150));
    CLOUD.tolte = [];
    delPhoto(); await new Promise(r => setTimeout(r, 150));
    document.getElementById('cfOk').click();
    await new Promise(r => setTimeout(r, 500));
    return { tolte: CLOUD.tolte.slice(), percorso: rec.percorso, mini: rec.percorsoMini };
  });
  ok('cancellando la foto sparisce anche la miniatura',
     !!elimMini.mini && elimMini.tolte.includes(elimMini.percorso) && elimMini.tolte.includes(elimMini.mini),
     JSON.stringify(elimMini.tolte));

  // Le foto messe prima che le miniature esistessero non hanno niente da
  // scaricare in piccolo: si prende la foto piena, come si è sempre fatto.
  const vecchia = await page.evaluate(async () => {
    window.__RIGHE_REMOTE = [{
      id: 'foto-vecchia', trip_id: 'aaa-bbb-ccc', caricata_da: 'luca', giorno: '2026-09-01',
      percorso: 'aaa-bbb-ccc/foto-vecchia.jpg', creata_il: new Date().toISOString()
    }];
    CLOUD.scaricati = [];
    await fotoDalCloud();
    await new Promise(r => setTimeout(r, 500));
    const rec = (await phAll(101)).find(x => x.cloudId === 'foto-vecchia');
    return { scaricati: CLOUD.scaricati.map(x => x.percorso), haPiena: !!(rec && rec.data) };
  });
  ok('una foto vecchia, senza miniatura, si scarica lo stesso',
     vecchia.haPiena === true && vecchia.scaricati.length === 1 && !/-mini/.test(vecchia.scaricati[0]),
     JSON.stringify(vecchia));

  // E su un database dove lo schema non è ancora stato rilanciato la colonna
  // della miniatura non c'è: la foto deve arrivare comunque, senza.
  const senzaColonna = await page.evaluate(async () => {
    const vero = sb.from;
    const tentativi = [];
    sb.from = (tab) => {
      const base = vero(tab);
      if (tab !== 'foto') return base;
      return Object.assign({}, base, {
        insert: async (riga) => {
          tentativi.push(Object.keys(riga));
          if ('percorso_mini' in riga)
            return { error: { message: "Could not find the 'percorso_mini' column of 'foto' in the schema cache" } };
          return base.insert(riga);
        }
      });
    };
    const rec = { id: 'senza-colonna', tripId: 101, date: '2026-09-01', ts: Date.now(),
      data: 'data:image/jpeg;base64,' + window.__JPEG };
    const db = await idbP();
    await new Promise(r => { db.transaction('ph', 'readwrite').objectStore('ph').put(rec).onsuccess = r; });
    const esito = await fotoSuCloud(rec);
    sb.from = vero;
    return { esito, tentativi, perche: fotoPerche, rimasti: Object.keys(CLOUD.file).filter(p => /senza/.test(p)) };
  });
  ok('se al database manca la colonna, la foto arriva lo stesso',
     senzaColonna.esito === true, 'esito ' + senzaColonna.esito + ' — ' + senzaColonna.perche);
  ok('riprovando senza la miniatura, non lasciandola a metà',
     senzaColonna.tentativi.length === 2 && !senzaColonna.tentativi[1].includes('percorso_mini'),
     JSON.stringify(senzaColonna.tentativi));

  console.log('\n' + r.join('\n'));
  const falliti = r.filter(x => x.includes('FALLITO')).length;
  console.log(`\n${r.length - falliti}/${r.length} passati`);
  if (err.length) console.log('\nErrori in pagina:\n' + err.join('\n'));
  await browser.close();
  process.exit(falliti ? 1 : 0);
})();
