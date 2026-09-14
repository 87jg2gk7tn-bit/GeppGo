/* Il fuso del posto.

   IL DIFETTO. Il telefono dice l'ora di dove sei TU. Il meteo è di dove
   VAI. L'app confrontava il tramonto di Tokyo — 18:20 di Tokyo, perché le
   previsioni le chiediamo con timezone=auto — con l'ora segnata dal
   telefono in Italia. Da Milano il Giappone è avanti di sette ore: alle
   due del pomeriggio qui, a Tokyo sono le nove di sera, e l'app disegnava
   il sole sopra la notte. Lo stesso valeva per «sera piovosa» (la sera
   tua, la pioggia loro) e per la casellina «adesso» nella fila delle ore,
   che sono ore del posto e si trovava marcata sette caselle più in là.

   COME SI PROVA SENZA DIPENDERE DALL'OROLOGIO. Due posti con lo stesso
   identico sole — stessa alba, stesso tramonto — e due fusi diversi,
   scelti perché in uno siano le 14:00 e nell'altro le 02:00 nel momento
   in cui la prova gira. Se l'app guarda il fuso, i due rispondono
   diverso. Se guarda l'orologio della macchina, rispondono per forza
   uguale — qualunque ora sia. È quella riga a essere rossa sul codice di
   prima, sempre, non a volte. */
const { apriBrowser, APP, leafletJs } = require('./browser');
const fs = require('fs');

/* La data di OGGI in UTC: è su quella che cadono tutti e due i posti,
   perché lo scarto è costruito per non far cambiare giorno. */
const oggiUTC = new Date().toISOString().slice(0, 10);
const domaniUTC = new Date(Date.now() + 864e5).toISOString().slice(0, 10);

/* Lo scarto che porta l'ora del posto esattamente a H, adesso. */
function scartoPer(H) {
  const o = new Date();
  const utc = o.getUTCHours() + o.getUTCMinutes() / 60 + o.getUTCSeconds() / 3600;
  return Math.round((H - utc) * 3600);
}

const sole = { sunrise: oggiUTC + 'T06:00', sunset: oggiUTC + 'T20:00' };

const stato = (scarto, extra) => ({
  trips: [{
    id: 1, name: 'Giappone', destination: 'Tokyo', currency: 'JPY', status: 'open',
    start: oggiUTC, end: domaniUTC,
    participants: [{ id: 1, name: 'Gepp', isMe: true }],
    pois: [], expenses: [], tickets: [], hotels: [], createdAt: 1,
    weather: {
      [oggiUTC]: Object.assign({
        code: 0, tempMax: 22, tempMin: 15, precipitation: 0, windSpeed: 6,
        luogo: 'Tokyo', preso: Date.now(), fuso: 'Asia/Tokyo'
      }, sole, scarto === null ? {} : { scarto }, extra || {})
    },
    days: [
      { id: 'd1', date: oggiUTC, title: '', activities: [
        { id: 11, name: 'Senso-ji', time: '09:30', timeEnd: '10:30', lat: 35.71, lng: 139.79,
          who: [1], completed: false, type: 'outdoor', booking: { needed: false, done: false } }] },
      { id: 'd2', date: domaniUTC, title: '', activities: [] }]
  }],
  currentTripId: 1, settings: {}, myName: 'Gepp', skipAuth: true
});

(async () => {
  const browser = await apriBrowser();
  const r = [];
  const err = [];
  const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);

  async function apri(st, oreFinte) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', e => err.push('PAGEERROR: ' + e.message.split('\n')[0]));
    await page.route('**/leaflet@1.9.4/dist/leaflet.js', ro => ro.fulfill({
      status: 200, contentType: 'application/javascript', body: fs.readFileSync(leafletJs(), 'utf8') }));
    await page.route(/tile\.openstreetmap\.org/, ro => ro.abort());
    await page.route(/nominatim\.openstreetmap\.org/, ro => ro.abort());
    await page.route(/api\.open-meteo\.com/, ro => ro.abort());
    /* Le rotte si scelgono al contrario di come si scrivono: l'ultima che
       combacia vince, quindi la più precisa va per ultima. */
    if (oreFinte) {
      await page.route(/api\.open-meteo\.com.*hourly=/, ro => ro.fulfill({
        status: 200, contentType: 'application/json', body: JSON.stringify(oreFinte) }));
    }
    await page.addInitScript(s => localStorage.setItem('geppgo2', JSON.stringify(s)), st);
    await page.goto(APP, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof adessoNelPosto === 'function' || typeof cieloNotte === 'function',
      { timeout: 20000 });
    await page.waitForTimeout(600);
    return page;
  }

  // ══ la prova che non dipende dall'orologio della macchina ════════════
  const mezzogiorno = scartoPer(14), notteFonda = scartoPer(2);

  let page = await apri(stato(mezzogiorno));
  const giorno = await page.evaluate(([d]) => ({
    notte: cieloNotte(T().weather[d], d),
    ora: typeof adessoNelPosto === 'function' ? adessoNelPosto(T().weather[d]).hhmm : 'manca',
    data: typeof adessoNelPosto === 'function' ? adessoNelPosto(T().weather[d]).data : ''
  }), [oggiUTC]);
  await page.close();

  page = await apri(stato(notteFonda));
  const notte = await page.evaluate(([d]) => ({
    notte: cieloNotte(T().weather[d], d),
    ora: typeof adessoNelPosto === 'function' ? adessoNelPosto(T().weather[d]).hhmm : 'manca',
    data: typeof adessoNelPosto === 'function' ? adessoNelPosto(T().weather[d]).data : ''
  }), [oggiUTC]);
  await page.close();

  /* LA RIGA CHE CONTA. Stesso sole, fusi diversi: se l'app guardasse
     l'orologio di chi guarda, questi due non potrebbero mai rispondere
     diverso. */
  ok('due posti con lo stesso sole e fusi diversi rispondono diverso',
     giorno.notte !== notte.notte,
     `mezzogiorno lì: ${giorno.notte ? 'notte' : 'giorno'} · notte fonda lì: ${notte.notte ? 'notte' : 'giorno'}`);
  ok('a mezzogiorno nel posto è giorno', giorno.notte === false, 'ora del posto ' + giorno.ora);
  ok('alle due di notte nel posto è notte', notte.notte === true, 'ora del posto ' + notte.ora);
  /* Lo scarto è costruito per non far scavallare la mezzanotte: se la
     data si sposta, la prova sta misurando un'altra cosa. */
  ok('e in tutt\'e due i casi il giorno del posto è ancora quello',
     giorno.data === oggiUTC && notte.data === oggiUTC, giorno.data + ' / ' + notte.data);

  // ══ e il meteo lo dice a parole ══════════════════════════════════════
  page = await apri(stato(notteFonda));
  const scritta = await page.evaluate(async () => {
    apriMeteo();
    await new Promise(x => setTimeout(x, 700));
    const li = document.querySelector('#mtHero .mt-li');
    return { cè: !!li, testo: li ? li.innerText.replace(/\s+/g, ' ').trim() : '' };
  });
  ok('nel meteo c\'è scritto se è giorno o notte', scritta.cè === true, scritta.testo);
  ok('e di notte dice notte', /notte/i.test(scritta.testo), scritta.testo);
  /* Non basta dire «è notte»: senza l'ora uno non sa se mancano dieci
     minuti all'alba o sei ore. */
  ok('e dice anche che ora è lì, col nome del posto',
     /Tokyo/.test(scritta.testo) && /\d{2}:\d{2}/.test(scritta.testo), scritta.testo);
  await page.close();

  page = await apri(stato(mezzogiorno));
  const diGiorno = await page.evaluate(async () => {
    apriMeteo();
    await new Promise(x => setTimeout(x, 700));
    const li = document.querySelector('#mtHero .mt-li');
    return li ? li.innerText.replace(/\s+/g, ' ').trim() : '';
  });
  ok('e di giorno dice giorno', /giorno/i.test(diGiorno) && !/notte/i.test(diGiorno), diGiorno);
  await page.close();

  // ══ quello che NON si dice ═══════════════════════════════════════════
  /* Senza il fuso l'app avrebbe solo l'orologio di chi guarda: scrivere
     «a Tokyo sono le 14:10» prendendo l'ora da Milano sarebbe inventare.
     Un cielo disegnato è un'impressione e può ripiegare; una frase è
     un'affermazione e allora si tace. */
  page = await apri(stato(null));
  const senzaFuso = await page.evaluate(async () => {
    apriMeteo();
    await new Promise(x => setTimeout(x, 700));
    return { riga: !!document.querySelector('#mtHero .mt-li'),
             heroCè: !!document.querySelector('#mtHero .mt-hero') };
  });
  ok('senza il fuso del posto l\'app non si inventa che ora è lì', senzaFuso.riga === false);
  ok('ma il meteo si vede lo stesso', senzaFuso.heroCè === true);
  await page.close();

  /* «È notte» su giovedì non vuol dire niente: la notte di quale momento? */
  page = await apri(stato(notteFonda));
  const altroGiorno = await page.evaluate(async ([dom]) => {
    apriMeteo();
    await new Promise(x => setTimeout(x, 400));
    meteoGiorno(dom);
    await new Promise(x => setTimeout(x, 600));
    return !!document.querySelector('#mtHero .mt-li');
  }, [domaniUTC]);
  ok('e su un giorno che non è oggi non lo dice affatto', altroGiorno === false);
  await page.close();

  // ══ la casellina «adesso» nella fila delle ore ═══════════════════════
  /* Le ore che arrivano sono ore del posto: la bandierina va sull'ora
     del posto, non su quella del telefono. */
  const ore = {
    hourly: {
      time: Array.from({ length: 24 }, (_, h) => `${oggiUTC}T${String(h).padStart(2, '0')}:00`),
      temperature_2m: Array.from({ length: 24 }, () => 20),
      weather_code: Array.from({ length: 24 }, () => 0),
      precipitation_probability: Array.from({ length: 24 }, () => 0)
    }
  };
  page = await apri(stato(mezzogiorno), ore);
  const bandierina = await page.evaluate(async () => {
    apriMeteo();
    await new Promise(x => setTimeout(x, 1400));
    const celle = [...document.querySelectorAll('#mtOre .mt-ora')];
    const i = celle.findIndex(x => x.classList.contains('adesso'));
    return { quante: celle.length, dove: i,
             passate: celle.filter(x => x.classList.contains('passata')).length };
  });
  ok('le ore arrivano', bandierina.quante === 24, bandierina.quante + ' ore');
  /* Alle 14:00 del posto la casella segnata è la quindicesima (le 14), e
     dietro ne restano quattordici già passate. */
  ok('«adesso» sta sull\'ora del posto, non su quella del telefono',
     bandierina.dove === 14, 'segnata la cella ' + bandierina.dove);
  ok('e le ore prima risultano passate', bandierina.passate === 14,
     bandierina.passate + ' passate');

  /* Alle tre di notte la fila mostrava tre soli in fila: il disegno
     dell'ora veniva dal codice meteo e basta, e un cielo limpido di notte
     è limpido lo stesso — ma il sole non c'è. Alba alle 06:00 e tramonto
     alle 20:00: buie le ore 0-5 e 20-23, dieci in tutto. */
  const buio = await page.evaluate(() => {
    const celle = [...document.querySelectorAll('#mtOre .mt-ora')];
    const em = i => (celle[i].querySelector('.mt-o-e') || {}).textContent || '';
    return { buie: celle.filter(x => x.classList.contains('buia')).length,
             allTre: em(3), aMezzogiorno: em(12), alleVenti: em(20), alleDiciannove: em(19) };
  });
  ok('le ore di buio sono segnate come tali', buio.buie === 10, buio.buie + ' ore buie');
  ok('e sopra un\'ora di buio non c\'è il sole',
     buio.allTre !== '☀️' && buio.alleVenti !== '☀️',
     'alle 03:00 ' + buio.allTre + ' · alle 20:00 ' + buio.alleVenti);
  /* E non è che il sole sia sparito ovunque: di giorno c'è. */
  ok('mentre di giorno il sole c\'è ancora',
     buio.aMezzogiorno === '☀️' && buio.alleDiciannove === '☀️',
     'a mezzogiorno ' + buio.aMezzogiorno + ' · alle 19:00 ' + buio.alleDiciannove);
  await page.close();

  // ══ il fuso arriva davvero dalla risposta, e non lo buttiamo ═════════
  /* Era già lì dentro — lo chiediamo con timezone=auto — e finiva nel
     cestino. Questa riga guarda che venga raccolto e messo da parte. */
  const risposta = {
    timezone: 'Asia/Tokyo', utc_offset_seconds: 32400,
    daily: { time: [oggiUTC], weather_code: [0], temperature_2m_max: [22], temperature_2m_min: [15],
             precipitation_sum: [0], wind_speed_10m_max: [6],
             sunset: [oggiUTC + 'T18:20'], sunrise: [oggiUTC + 'T05:25'] }
  };
  page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', e => err.push('PAGEERROR: ' + e.message.split('\n')[0]));
  await page.route('**/leaflet@1.9.4/dist/leaflet.js', ro => ro.fulfill({
    status: 200, contentType: 'application/javascript', body: fs.readFileSync(leafletJs(), 'utf8') }));
  await page.route(/tile\.openstreetmap\.org/, ro => ro.abort());
  await page.route(/nominatim\.openstreetmap\.org/, ro => ro.abort());
  await page.route(/api\.open-meteo\.com/, ro => ro.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(risposta) }));
  const senzaMeteo = stato(null);
  senzaMeteo.trips[0].weather = {};
  await page.addInitScript(s => localStorage.setItem('geppgo2', JSON.stringify(s)), senzaMeteo);
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof fetchDayWx === 'function', { timeout: 20000 });
  const raccolto = await page.evaluate(async ([d]) => {
    const t = T();
    await fetchDayWx(t, t.days.find(x => x.date === d));
    const w = (T().weather || {})[d] || {};
    return { scarto: w.scarto, fuso: w.fuso, tramonto: w.sunset };
  }, [oggiUTC]);
  ok('lo scarto del posto viene raccolto dalla risposta', raccolto.scarto === 32400,
     String(raccolto.scarto));
  ok('e anche il nome del fuso', raccolto.fuso === 'Asia/Tokyo', String(raccolto.fuso));
  ok('insieme al tramonto, che è l\'altra metà della domanda',
     /18:20/.test(String(raccolto.tramonto)), String(raccolto.tramonto));
  await page.close();

  await browser.close();
  for (const e of err) r.push(' FALLITO  ' + e);
  const passati = r.filter(x => x.startsWith('  OK')).length;
  console.log(r.join('\n'));
  console.log(`\n${passati}/${r.length} passati`);
  process.exit(passati === r.length ? 0 : 1);
})();
