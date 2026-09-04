/* I due casi segnalati: la banca sotto casa col bancomat, e il bagno del parco.
   Overpass non è raggiungibile da qui: si intercetta la chiamata, si legge la
   domanda che parte e si risponde come farebbe lui. */
const { apriBrowser, APP, RADICE, leafletJs } = require('./browser');
const fs = require('fs');

const stato = {trips:[{id:1730000000001,name:'Casa',destination:'Milano',currency:'EUR',status:'open',start:'2026-09-01',end:'2026-09-02',participants:[{id:'p1',name:'Gepp'}],suggested:[],pois:[],expenses:[],tickets:[],hotels:[],weather:{},createdAt:1,days:[{id:'d1',date:new Date().toISOString().split('T')[0],title:'',activities:[]}]}],currentTripId:1730000000001,settings:{proxRadius:200},myName:'Gepp'};

const IO = { lat: 45.4750, lng: 9.1900 };
// ~500 m da me
const lontano = { lat: 45.4795, lng: 9.1900 };

(async () => {
  const browser = await apriBrowser();
  const r = [];
  const ok = (n, c, e = '') => r.push(`${c ? '  OK  ' : ' FALLITO '} ${n}${e ? ' — ' + e : ''}`);

  /* Una pagina sola, riusata: aprirne una per ogni caso significava caricare
     l'app quaranta volte e aspettare dieci minuti. Gli elementi che il finto
     Overpass restituisce si cambiano fra un caso e l'altro. */
  let elementiCorrenti = [];
  async function apriRiusabile() {
    const { page, chiamate } = await apri([], {}, () => elementiCorrenti);
    return { page, chiamate };
  }
  // risponde come Overpass, ma solo agli elementi che stanno nel raggio chiesto
  async function apri(elementi, opts = {}, dammiElementi = null) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', e => r.push(' FALLITO  errore in pagina: ' + e.message.split('\n')[0]));
    await page.route('**/leaflet@1.9.4/dist/leaflet.js', ro => ro.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(leafletJs(), 'utf8') }));
    await page.route('**/tile.openstreetmap.org/**', ro => ro.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64') }));

    const chiamate = [];
    await page.route('**/api/interpreter', async route => {
      const q = decodeURIComponent(route.request().postData() || '').replace(/^data=/, '');
      const host = new URL(route.request().url()).host;
      chiamate.push({ q, host });
      if (opts.rompi && opts.rompi.includes(host)) return route.fulfill({ status: 429, body: 'too many requests' });
      const raggio = parseInt((q.match(/around:(\d+)/) || [])[1] || '0', 10);
      const daUsare = dammiElementi ? dammiElementi() : elementi;
      const dentro = daUsare.filter(el => {
        const R = 6371000, dLa = (el.lat - IO.lat) * Math.PI / 180, dLo = (el.lon - IO.lng) * Math.PI / 180;
        const a = Math.sin(dLa / 2) ** 2 + Math.cos(IO.lat * Math.PI / 180) * Math.cos(el.lat * Math.PI / 180) * Math.sin(dLo / 2) ** 2;
        const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        if (d > raggio) return false;
        // esce solo se la domanda chiede davvero il suo tipo e il suo tag
        const tipoOk = new RegExp(`\\b${el.type}\\[`).test(q);
        // filtri per valore esatto: ["amenity"="bank"]
        let tagOk = Object.entries(el.tags).some(([k, val]) => q.includes(`["${k}"="${val}"]`));
        // ["name"~"(banc|bank)",i] — espressione regolare sul valore
        if (!tagOk) {
          const re = /\["([a-z:_]+)"~"([^"]+)",i\]/g;
          let m;
          while ((m = re.exec(q))) {
            const [, chiave, pattern] = m;
            if (el.tags[chiave] && new RegExp(pattern, 'i').test(el.tags[chiave])) { tagOk = true; break; }
          }
        }
        // [~"^(name|brand|operator)$"~"(banc|bank)",i] — espressione regolare
        // anche sul NOME del tag: è così che si guardano più chiavi in un colpo
        if (!tagOk) {
          const re2 = /\[~"([^"]+)"~"([^"]+)",i\]/g;
          let m;
          while ((m = re2.exec(q))) {
            const [, kPat, vPat] = m;
            const kRe = new RegExp(kPat), vRe = new RegExp(vPat, 'i');
            if (Object.entries(el.tags).some(([k, val]) => kRe.test(k) && vRe.test(val))) { tagOk = true; break; }
          }
        }
        return tipoOk && tagOk;
      });
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ elements: dentro }) });
    });

    await page.addInitScript(s => {
      localStorage.setItem('geppgo2', JSON.stringify(s));
      navigator.geolocation.getCurrentPosition = cb => cb({ coords: { latitude: 45.4750, longitude: 9.1900 } });
    }, stato);
    await page.goto(APP, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.cercaVicino === 'function', { timeout: 15000 });
    await page.waitForTimeout(300);
    return { page, chiamate };
  }
  const cerca = async (page, kind) => {
    await page.evaluate(k => { myPos = null; myPosAt = 0; cercaVicino(k); }, kind);
    await page.waitForFunction(() => !/Cerco/.test(document.getElementById('bagnoBody').innerText), { timeout: 15000 });
    await page.waitForTimeout(200);
    return page.evaluate(() => document.getElementById('bagnoBody').innerText);
  };

  // ── 1. la banca sotto casa, senza il tag del bancomat ────────────────
  let { page, chiamate } = await apri([
    { type: 'way', id: 1, center: { lat: 45.47510, lon: 9.19010 }, tags: { amenity: 'bank', name: 'Banca Sotto Casa' } }
  ]);
  let testo = await cerca(page, 'atm');
  ok('la banca sotto casa ora si trova', /Banca Sotto Casa/.test(testo), testo.split('\n').slice(0, 2).join(' / '));
  ok('e dice onestamente che il bancomat è probabile, non certo', /molto probabile/.test(testo));
  ok('la domanda chiede anche le banche', /amenity"="bank"/.test(chiamate[0].q));
  ok('e i contorni disegnati, non solo i punti', /way\["amenity"="bank"\]/.test(chiamate[0].q));
  ok('e gli insiemi di contorni', /relation\["amenity"="atm"\]/.test(chiamate[0].q));
  ok('il tetto ai risultati è alto', /out center 150/.test(chiamate[0].q), (chiamate[0].q.match(/out center \d+/) || [])[0]);
  await page.close();

  // ── 1b. il Banco BPM in TUTTI i modi in cui può stare sulla mappa ────
  // (il caso vero: filiale a due passi che non veniva trovata)
  const modiBanca = [
    ['etichettata banca', { amenity: 'bank', name: 'Banco BPM' }],
    ['banca che dichiara il bancomat', { amenity: 'bank', atm: 'yes', name: 'Banco BPM' }],
    ['solo sportello bancomat', { amenity: 'atm', name: 'Banco BPM' }],
    ['ufficio finanziario', { office: 'financial', name: 'Banco BPM' }],
    ['solo il nome sull\'edificio', { building: 'commercial', name: 'Banco BPM' }],
    ['banca giapponese', { building: 'yes', name: '三菱UFJ銀行' }]
  ];
  const bpm = await apriRiusabile();
  for (const [come, tags] of modiBanca) {
    elementiCorrenti = [{ type: 'way', id: 100, center: { lat: 45.47512, lon: 9.19012 }, tags }];
    const txt = await cerca(bpm.page, 'atm');
    ok(`Banco BPM si trova anche se è ${come}`, txt.includes(tags.name), txt.split('\n').slice(0, 2).join(' / '));
  }
  await bpm.page.close();

  // ── 1b-bis. le banche che si conoscono solo per sigla ────────────────
  // "BPM" non contiene né "banca" né "bank": nessuna regola generale le prende
  const sigle = [
    ['BPM (nome secco)', { name: 'BPM' }],
    ['BPM filiale', { name: 'BPM - Filiale di Muggiò' }],
    ['nome codice, insegna nel marchio', { name: 'Filiale 03421', brand: 'Banco BPM' }],
    ['nome codice, insegna nel nome ufficiale', { name: 'AG. 12', official_name: 'Banco BPM S.p.A.' }],
    ['MPS', { name: 'MPS' }],
    ['HSBC', { name: 'HSBC' }],
    ['BNL', { name: 'BNL' }],
    ['BPER', { name: 'BPER' }],
    ['abbreviazione nel nome breve', { name: 'Agenzia 4', short_name: 'UBI' }]
  ];
  const sig = await apriRiusabile();
  for (const [come, tags] of sigle) {
    elementiCorrenti = [{ type: 'node', id: 300, lat: 45.47512, lon: 9.19012, tags: { building: 'yes', ...tags } }];
    const txt = await cerca(sig.page, 'atm');
    ok(`banca trovata per sigla — ${come}`, txt.includes(tags.name), txt.split('\n')[0]);
  }
  // le sigle non devono pescare parole comuni che le contengono
  const nonBanche = [
    ['un parcheggio', 'Parking Centro'],
    ['un cantiere', 'Building Service'],
    ['uno studio tecnico', 'Studio Ing. Rossi'],
    ['un bar', 'Bar Sport']
  ];
  for (const [cosa, nome] of nonBanche) {
    elementiCorrenti = [{ type: 'node', id: 301, lat: 45.47512, lon: 9.19012, tags: { building: 'yes', name: nome } }];
    const txt = await cerca(sig.page, 'atm');
    ok(`${cosa} non viene scambiato per una banca`, !txt.includes(nome), txt.split('\n')[0]);
  }
  await sig.page.close();

  // ── 1c. la stessa precisione in tutto il mondo ───────────────────────
  // una filiale mappata SOLO col nome (nessuna etichetta di tipo), paese per paese
  const banchePaesi = [
    ['Italia', { name: 'Banco BPM' }],
    ['Germania', { name: 'Sparkasse Köln' }],
    ['Austria', { name: 'Raiffeisenbank' }],
    ['Francia', { name: 'Crédit Agricole' }],
    ['Spagna', { name: 'Banco Santander' }],
    ['Portogallo', { name: 'Caixa Geral de Depósitos' }],
    ['Regno Unito', { name: 'Barclays Bank' }],
    ['Paesi Bassi', { name: 'Rabobank' }],
    ['Polonia', { name: 'Bank Pekao' }],
    ['Russia', { name: 'Сбербанк' }],
    ['Grecia', { name: 'Τράπεζα Πειραιώς' }],
    // in greco l'accento si sposta declinando: è il caso che sfuggiva
    ['Grecia (al genitivo)', { name: 'Υποκατάστημα τραπέζης' }],
    ['Giappone', { name: '三菱UFJ銀行' }],
    ['Cina', { name: '中国银行' }],
    ['Corea', { name: '국민은행' }],
    ['Thailandia', { name: 'ธนาคารกรุงเทพ' }],
    ['Emirati', { name: 'بنك أبوظبي' }],
    ['India', { name: 'बैंक ऑफ बड़ौदा' }],
    ['Israele', { name: 'בנק הפועלים' }],
    ['Turchia', { name: 'Türkiye İş Bankası' }],
    ['Brasile', { name: 'Banco do Brasil' }],
    ['Messico', { name: 'Cajero BBVA' }],
    ['Svizzera', { name: 'Geldautomat Postfinance' }]
  ];
  const mondo = await apriRiusabile();
  for (const [paese, tags] of banchePaesi) {
    elementiCorrenti = [{ type: 'node', id: 200, lat: 45.47512, lon: 9.19012, tags: { building: 'yes', ...tags } }];
    const txt = await cerca(mondo.page, 'atm');
    ok(`banca trovata anche col nome solo — ${paese}`, txt.includes(tags.name), txt.split('\n')[0]);
  }

  // il marchio al posto del nome: in mezzo mondo la filiale ha solo quello
  elementiCorrenti = [{ type: 'node', id: 201, lat: 45.47512, lon: 9.19012, tags: { shop: 'yes', brand: 'HSBC Bank', name: 'Filiale 1204' } }];
  {
    const txt = await cerca(mondo.page, 'atm');
    ok('si guarda anche il marchio, non solo il nome', /Filiale 1204/.test(txt), txt.split('\n')[0]);
  }

  // bagni: stessa prova in alfabeti diversi
  const bagniPaesi = [
    ['Italia', 'Bagni pubblici'], ['Francia', 'Toilettes publiques'], ['Spagna', 'Aseos públicos'],
    ['Germania', 'Öffentliche Toilette'], ['Brasile', 'Banheiro público'], ['Russia', 'Туалет'],
    ['Giappone', 'お手洗い'], ['Cina', '公共厕所'], ['Corea', '공중화장실'],
    ['Thailandia', 'ห้องน้ำสาธารณะ'], ['Regno Unito', 'Public restroom'],
    ['Grecia', 'Δημόσια τουαλέτα']
  ];
  for (const [paese, nome] of bagniPaesi) {
    elementiCorrenti = [{ type: 'node', id: 202, lat: 45.47512, lon: 9.19012, tags: { building: 'yes', name: nome } }];
    const txt = await cerca(mondo.page, 'bagno');
    ok(`bagno trovato col nome solo — ${paese}`, txt.includes(nome), txt.split('\n')[0]);
  }
  await mondo.page.close();

  // aree fumatori: stessa prova, paese per paese, mappate SOLO col nome
  const fumoPaesi = [
    ['Italia', 'Area fumatori'], ['Francia', 'Espace fumeurs'], ['Spagna', 'Zona de fumadores'],
    ['Germania', 'Raucherbereich'], ['Paesi Bassi', 'Rookruimte'], ['Svezia', 'Rökruta'],
    ['Finlandia', 'Tupakointialue'], ['Polonia', 'Palarnia'], ['Ungheria', 'Dohányzó hely'],
    ['Turchia', 'Sigara içme alanı'], ['Russia', 'Курилка'], ['Grecia', 'Χώρος καπνίσματος'],
    ['Giappone', '喫煙所'], ['Cina', '吸烟区'], ['Corea', '흡연구역'],
    ['Thailandia', 'จุดสูบบุหรี่'], ['Emirati', 'منطقة تدخين'], ['Israele', 'אזור עישון'],
    ['Brasile', 'Área para fumantes'], ['Norvegia', 'Røykeområde']
  ];
  const fumo = await apriRiusabile();
  for (const [paese, nome] of fumoPaesi) {
    elementiCorrenti = [{ type: 'node', id: 203, lat: 45.47512, lon: 9.19012, tags: { building: 'yes', name: nome } }];
    const txt = await cerca(fumo.page, 'fumo');
    ok(`area fumatori trovata col nome solo — ${paese}`, txt.includes(nome), txt.split('\n')[0]);
  }
  // e quella etichettata per bene non deve essere marcata "da controllare"
  elementiCorrenti = [{ type: 'node', id: 204, lat: 45.47512, lon: 9.19012, tags: { amenity: 'smoking_area', name: 'Area attrezzata' } }];
  let txtF = await cerca(fumo.page, 'fumo');
  ok('quella etichettata per bene non è marcata "da controllare"', /Area attrezzata/.test(txtF) && !/da controllare/.test(txtF), txtF.split('\n').slice(0, 2).join(' / '));
  // quella presa solo dal nome invece sì
  elementiCorrenti = [{ type: 'node', id: 205, lat: 45.47512, lon: 9.19012, tags: { building: 'yes', name: 'Area fumatori' } }];
  txtF = await cerca(fumo.page, 'fumo');
  ok('quella presa dal nome lo dichiara', /da controllare/.test(txtF), txtF.split('\n').slice(0, 2).join(' / '));
  // niente falsi allarmi sui ristoranti barbecue
  elementiCorrenti = [{ type: 'node', id: 206, lat: 45.47512, lon: 9.19012, tags: { amenity: 'restaurant', name: 'The Smokehouse Grill' } }];
  txtF = await cerca(fumo.page, 'fumo');
  ok('una "Smokehouse" non viene scambiata per area fumatori', !/Smokehouse/.test(txtF), txtF.split('\n')[0]);
  await fumo.page.close();

  // ── 1d. la ricerca per nome pesa: solo nei giri stretti ──────────────
  // (è quello che faceva scadere la ricerca dei bagni, che arriva sempre in fondo)
  {
    const t = await apri([]);   // niente da trovare: fa tutti e quattro i giri
    await cerca(t.page, 'bagno');
    const giri = t.chiamate.map(c => ({
      raggio: +(c.q.match(/around:(\d+)/) || [])[1],
      perNome: /\[~"\^\(name/.test(c.q)
    }));
    ok('a mani vuote fa due giri per tipo e poi uno per nome', giri.length === 3, giri.map(g => g.raggio + (g.perNome ? '/nome' : '')).join(' → '));
    ok('i giri per tipo non si portano dietro la ricerca per nome',
       giri.filter(g => !g.perNome).length === 2 && giri.filter(g => !g.perNome).every(g => !g.perNome));
    ok('la ricerca per nome è una richiesta a sé, in fondo', giri[giri.length-1].perNome);
    ok('e non si allarga: costa troppo per farla larga', giri[giri.length-1].raggio === 1500, String(giri[giri.length-1].raggio));
    await t.page.close();
  }

  // se per tipo si trova abbastanza, la ricerca per nome non parte proprio:
  // è quella che pesa, ed è il motivo per cui la ricerca era lenta
  {
    const vicino = (n) => ({ type:'node', id:600+n, lat:45.4751+n*0.0002, lon:9.1901+n*0.0002, tags:{ amenity:'toilets', name:'Bagno '+n } });
    const t = await apri([vicino(1), vicino(2), vicino(3)]);
    await cerca(t.page, 'bagno');
    const perNome = t.chiamate.filter(c => /\[~"\^\(name/.test(c.q)).length;
    ok('trovando abbastanza per tipo, non si cerca anche per nome', perNome === 0, t.chiamate.length + ' richieste, di cui ' + perNome + ' per nome');
    ok('e basta un giro solo', t.chiamate.length === 1, t.chiamate.length + ' richieste');
    await t.page.close();
  }

  // "wc" dentro una parola non fa di un posto un bagno
  {
    const casi = [
      ['Newcastle non viene scambiato per un bagno', { building: 'yes', name: 'Newcastle Pub' }, false],
      ['ma "WC pubblico" si trova', { building: 'yes', name: 'WC pubblico' }, true],
      ['e anche "Bagni comunali"', { building: 'yes', name: 'Bagni comunali' }, true]
    ];
    const wc = await apriRiusabile();
    for (const [che, tags, atteso] of casi) {
      elementiCorrenti = [{ type: 'node', id: 400, lat: 45.47512, lon: 9.19012, tags }];
      const txt = await cerca(wc.page, 'bagno');
      ok(che, txt.includes(tags.name) === atteso, txt.split('\n')[0]);
    }
    await wc.page.close();
  }

  // ── 1e. la strada gratis: aggiungere il posto che manca ──────────────
  {
    const t = await apri([{ type: 'node', id: 500, lat: 45.47512, lon: 9.19012, tags: { amenity: 'atm', name: 'Bancomat' } }]);
    await cerca(t.page, 'atm');
    const c1 = await t.page.evaluate(() => {
      const b = [...document.querySelectorAll('#bagnoBody button')].find(x => /Manca qualcosa/.test(x.textContent));
      return b ? b.getAttribute('onclick') : null;
    });
    ok('sotto i risultati c\'è il modo per segnalare quello che manca', /apriOsmQui\(/.test(c1 || ''), String(c1));
    // e apre la spiegazione, con i due modi
    const dentro = await t.page.evaluate(() => {
      apriOsmQui(45.475, 9.19);
      const m = document.getElementById('mOsmAiuto');
      return { aperto: m.classList.contains('active'), testo: document.getElementById('osmAiutoBody').innerText };
    });
    ok('si apre la spiegazione', dentro.aperto);
    ok('dice che la mappa non è quella di Google', /non è quella di Google/i.test(dentro.testo));
    ok('e che aggiungerlo vale per tutti', /per sempre e per tutti/i.test(dentro.testo));
    ok('spiega la via corta dal telefono', /Every Door/.test(dentro.testo));
    // i due indirizzi che apre
    const link = await t.page.evaluate(() => {
      const out = {};
      window.open = u => { out.ultimo = u; return null; };
      osmVai(''); out.guarda = out.ultimo;
      osmVai('edit'); out.aggiungi = out.ultimo;
      return out;
    });
    ok('"guarda" apre la mappa sul punto giusto', /openstreetmap\.org\/#map=18\/45\.47500\/9\.19000/.test(link.guarda), link.guarda);
    ok('"aggiungi" apre l\'editor sullo stesso punto', /openstreetmap\.org\/edit#map=19\/45\.47500\/9\.19000/.test(link.aggiungi), link.aggiungi);
    await t.page.close();
  }

  // ── 2. il bagno del parco a 500 m, dichiarato dal parco ──────────────
  ({ page, chiamate } = await apri([
    { type: 'way', id: 2, center: { lat: lontano.lat, lon: lontano.lng }, tags: { leisure: 'park', toilets: 'yes', name: 'Parco Sempione' } }
  ]));
  testo = await cerca(page, 'bagno');
  ok('il bagno del parco a 500 m ora si trova', /Parco Sempione/.test(testo), testo.split('\n').slice(0, 2).join(' / '));
  ok('e si capisce di chi sono', /Bagni · Parco Sempione/.test(testo));
  ok('e che non è una casetta a sé', /dentro, non una casetta/.test(testo));
  ok('per arrivarci ha allargato il giro oltre i 400 m', chiamate.length >= 2, chiamate.map(c => (c.q.match(/around:(\d+)/) || [])[1]).join(' → '));
  await page.close();

  // ── 3. non ci si ferma alla prima che si trova ───────────────────────
  ({ page, chiamate } = await apri([
    { type: 'node', id: 3, lat: 45.47520, lon: 9.19000, tags: { amenity: 'toilets' } },
    { type: 'node', id: 4, lat: lontano.lat, lon: lontano.lng, tags: { amenity: 'toilets', name: 'Bagno del parco' } },
    { type: 'node', id: 5, lat: 45.4800, lon: 9.1910, tags: { amenity: 'toilets', name: 'Bagno stazione' } }
  ]));
  testo = await cerca(page, 'bagno');
  ok('con una sola vicina allarga e ne mostra altre', /Bagno del parco/.test(testo) && /Bagno stazione/.test(testo), testo.replace(/\n+/g, ' / ').slice(0, 120));
  ok('ma la più vicina resta in cima con la stella', /⭐/.test(testo) && testo.indexOf('⭐') < testo.indexOf('Bagno del parco'));
  await page.close();

  // ── 4. la stessa banca contata una volta sola ────────────────────────
  ({ page } = await apri([
    { type: 'node', id: 6, lat: 45.47510, lon: 9.19010, tags: { amenity: 'atm', name: 'Banca Sotto Casa' } },
    { type: 'way', id: 7, center: { lat: 45.47513, lon: 9.19013 }, tags: { amenity: 'bank', name: 'Banca Sotto Casa' } }
  ]));
  testo = await cerca(page, 'atm');
  ok('la stessa banca non esce due volte', (testo.match(/Banca Sotto Casa/g) || []).length === 1,
     (testo.match(/Banca Sotto Casa/g) || []).length + ' volte');
  await page.close();

  // ── 5. se il server principale arranca, se ne prova un altro ─────────
  ({ page, chiamate } = await apri([
    { type: 'node', id: 8, lat: 45.47520, lon: 9.19000, tags: { amenity: 'atm', name: 'Bancomat via Roma' } }
  ], { rompi: ['overpass-api.de'] }));
  testo = await cerca(page, 'atm');
  ok('col primo server giù la ricerca funziona lo stesso', /Bancomat via Roma/.test(testo), testo.split('\n')[0]);
  ok('ha davvero cambiato server', chiamate.some(c => c.host !== 'overpass-api.de'), [...new Set(chiamate.map(c => c.host))].join(', '));
  await page.close();

  // ── 6. le aree fumatori: anche i contorni, non solo i punti ──────────
  ({ page, chiamate } = await apri([
    { type: 'way', id: 9, center: { lat: 45.47520, lon: 9.19000 }, tags: { smoking: 'designated', name: 'Area fumatori stazione' } }
  ]));
  testo = await cerca(page, 'fumo');
  ok('un\'area fumatori disegnata come contorno si trova', /Area fumatori stazione/.test(testo), testo.split('\n')[0]);
  await page.close();

  // ── 7. quando davvero non c'è niente, lo dice ────────────────────────
  ({ page } = await apri([]));
  testo = await cerca(page, 'atm');
  ok('senza niente nei dintorni lo dice, senza inventare', /non risulta nessun bancomat/.test(testo), testo.split('\n')[0]);
  await page.close();

  console.log('\n' + r.join('\n'));
  const f = r.filter(x => x.includes('FALLITO')).length;
  console.log(`\n${r.length - f}/${r.length} passati`);
  await browser.close();
  process.exit(f ? 1 : 0);
})();
