/* UNA RICERCA DOPO L'ALTRA, COME LE FA UNA PERSONA.
 *
 * Segnalato dal vivo: «funziona bene solo per stazione e metro, per tutte
 * le altre voci o chiude direttamente la finestra di ricerca o non dà
 * risultati». Le prove guardavano una voce alla volta, su una pagina
 * fresca: nessuna faceva quello che fa una persona, cioè provarne una,
 * chiuderla perché è lenta, e toccarne un'altra.
 *
 * Il guasto: finché una ricerca era in corso, `cercaVicino` usciva subito
 * senza fare niente. Il menu si chiudeva, la scheda non si apriva — «chiude
 * direttamente la finestra». E la ricerca del bus, chiusa con la ✕, stava
 * ancora salendo la sua scala di cinque giri in sottofondo: finché non
 * finiva, bagno, fumatori e bancomat non partivano più.
 */
const { apriBrowser, APP, leafletJs } = require('./browser');
const { comeOverpass } = require('./overpass-finto');
const fs = require('fs');

const IO = { lat: 45.4750, lng: 9.1900 };
const stato = { trips: [{ id: 1, name: 'Prova', destination: 'Milano', currency: 'EUR', status: 'open',
  participants: [{ id: 'p1', name: 'Gepp' }], suggested: [], pois: [], expenses: [], tickets: [],
  hotels: [], weather: {}, createdAt: Date.now(),
  days: [{ id: 'd1', date: '2026-09-01', title: '', activities: [] }] }],
  currentTripId: 1, settings: {}, myName: 'Gepp', skipAuth: true };

(async () => {
  const browser = await apriBrowser();
  const r = [];
  const err = [];
  const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);

  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', e => err.push('PAGEERROR: ' + e.message.split('\n')[0]));
  const chieste = [];
  await page.route('**/leaflet@1.9.4/dist/leaflet.js', ro => ro.fulfill({
    status: 200, contentType: 'application/javascript', body: fs.readFileSync(leafletJs(), 'utf8') }));
  await page.route(/tile\.openstreetmap\.org/, ro => ro.abort());
  await page.route('**/api/interpreter', async ro => {
    const q = decodeURIComponent(ro.request().postData() || '');
    /* Il bus è lento — venti secondi — e alla fine trova una fermata. I
       bagni rispondono subito. È esattamente la sequenza segnalata. */
    if (/bus_stop|"bus"/.test(q)) {
      chieste.push('bus');
      await new Promise(s => setTimeout(s, 20000));
      return ro.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(comeOverpass([{ type: 'node', id: 1, lat: IO.lat + 0.0005, lon: IO.lng,
          tags: { highway: 'bus_stop', name: 'Fermata arrivata tardi' } }])) }).catch(() => {});
    }
    if (/toilets/.test(q)) {
      chieste.push('bagno');
      return ro.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(comeOverpass([{ type: 'node', id: 2, lat: IO.lat + 0.0003, lon: IO.lng,
          tags: { amenity: 'toilets', name: 'Bagno di piazza' } }])) });
    }
    chieste.push('altro');
    return ro.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(comeOverpass([])) });
  });
  await page.addInitScript(([s, io]) => {
    localStorage.setItem('geppgo2', JSON.stringify(s));
    navigator.geolocation.getCurrentPosition = cb => cb({ coords: { latitude: io.lat, longitude: io.lng } });
  }, [stato, IO]);
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.cercaVicino === 'function', { timeout: 20000 });
  await page.waitForFunction(() => !document.getElementById('bootSplash'), { timeout: 20000 });
  await page.evaluate(() => { localStorage.removeItem(VICINI_CACHE_CHIAVE); myPos = null; myPosAt = 0; });

  const aperta = () => page.evaluate(() => document.getElementById('mBagno').classList.contains('active'));
  const titolo = () => page.evaluate(() => document.getElementById('bagnoTitle').textContent);
  const corpo = () => page.evaluate(() => document.getElementById('bagnoBody').innerText.replace(/\s+/g, ' ').trim());

  // 1. si cerca il bus, che è lento, e dopo tre secondi si chiude con la ✕
  /* Si passa dal menu e dalla ✕ VERI, non da `cercaVicino(...)` chiamato a
     mano: la sequenza segnalata passa di lì, ed è lì che si vedeva. */
  await page.evaluate(() => { openSheet('mCerca'); });
  await page.click('#mCerca .cerca-voce:has-text("Fermata del bus")');
  await page.waitForTimeout(3000);
  ok('il bus parte', (await titolo()).includes('bus') || /bus|fermat/i.test(await titolo()), await titolo());
  await page.click('#mBagno .x-close');
  await page.waitForTimeout(500);

  // 2. e subito dopo si cercano i bagni
  await page.evaluate(() => { openSheet('mCerca'); });
  await page.click('#mCerca .cerca-voce:has-text("Bagno pubblico")');
  await page.waitForTimeout(800);
  ok('la scheda dei bagni si apre, anche col bus ancora in corso', await aperta());
  ok('e dice che sta cercando bagni, non il bus', /bagno/i.test(await titolo()), await titolo());
  await page.waitForFunction(() => /Bagno di piazza/.test(document.getElementById('bagnoBody').innerText),
    { timeout: 15000 }).catch(() => {});
  ok('e trova il bagno, senza aspettare che il bus finisca', /Bagno di piazza/.test(await corpo()), (await corpo()).slice(0, 60));

  // 3. e quando il bus finalmente arriva, non si scrive sopra ai bagni
  /* La ricerca vecchia è stata sostituita: quando la sua risposta arriva
     deve sparire in silenzio. Se scrivesse, la persona che guarda i bagni
     si vedrebbe comparire una fermata del bus sotto un titolo coi bagni. */
  await page.waitForTimeout(19000);
  const dopo = await corpo();
  ok('quando il bus arriva tardi, non scrive sopra ai bagni',
     /Bagno di piazza/.test(dopo) && !/Fermata arrivata tardi/.test(dopo), dopo.slice(0, 60));
  /* E una ricerca chiusa non continua a salire la scala: con la ✕ la
     persona ha detto che non le interessa più, e ogni giro in più è una
     domanda a un servizio di volontari che non serve a nessuno. */
  const bus = chieste.filter(x => x === 'bus').length;
  ok('e la ricerca del bus, chiusa, non sale altri giri della scala', bus <= 2,
     bus + ' domande sul bus');

  await page.close();

  // ── E IL SERVER CHE TI CHIUDE LA PORTA ──────────────────────────────
  /* Misurato dal vivo: overpass-api.de, dopo una raffica di richieste dalla
     stessa connessione, risponde «406» senza le intestazioni per il browser
     — e sul telefono arriva come un errore di rete in tre decimi di
     secondo. L'app lo trattava come un momento di lentezza: ci ribussava a
     ogni giro, a ogni riprova, a ogni voce. Qui il primo server rifiuta
     così, e il secondo risponde. */
  const p2 = await browser.newPage({ viewport: { width: 390, height: 844 } });
  p2.on('pageerror', e => err.push('PAGEERROR: ' + e.message.split('\n')[0]));
  const perServer = {};
  let chiude = null;
  await p2.route('**/leaflet@1.9.4/dist/leaflet.js', ro => ro.fulfill({
    status: 200, contentType: 'application/javascript', body: fs.readFileSync(leafletJs(), 'utf8') }));
  await p2.route(/tile\.openstreetmap\.org/, ro => ro.abort());
  await p2.route('**/api/interpreter', async ro => {
    const casa = new URL(ro.request().url()).host;
    perServer[casa] = (perServer[casa] || 0) + 1;
    if (casa === chiude) return ro.abort('failed');
    /* Gli altri sono lenti, come misurato dal vivo (mail.ru dodici secondi,
       kumi e private.coffee oltre venti): qui tre e mezzo bastano perché
       dopo due secondi e mezzo l'app ne chiami un altro in parallelo — ed è
       lì che il server che ha chiuso la porta tornava a essere chiamato. */
    await new Promise(s => setTimeout(s, 3500));
    const q = decodeURIComponent(ro.request().postData() || '');
    const el = /toilets/.test(q)
      ? [{ type: 'node', id: 2, lat: IO.lat + 0.0003, lon: IO.lng, tags: { amenity: 'toilets', name: 'Bagno di piazza' } }]
      : [{ type: 'node', id: 3, lat: IO.lat + 0.004, lon: IO.lng, tags: { railway: 'station', name: 'Stazione di prova' } }];
    return ro.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(comeOverpass(el)) });
  });
  await p2.addInitScript(([s, io]) => {
    localStorage.setItem('geppgo2', JSON.stringify(s));
    navigator.geolocation.getCurrentPosition = cb => cb({ coords: { latitude: io.lat, longitude: io.lng } });
  }, [stato, IO]);
  await p2.goto(APP, { waitUntil: 'domcontentloaded' });
  await p2.waitForFunction(() => typeof window.cercaVicino === 'function', { timeout: 20000 });
  await p2.waitForFunction(() => !document.getElementById('bootSplash'), { timeout: 20000 });
  /* Chi è il primo lo dice l'app: se un giorno si riordina la lista, la
     prova continua a guardare quello giusto. */
  chiude = await p2.evaluate(() => new URL(OVERPASS[0]).host);
  await p2.evaluate(() => { localStorage.removeItem(VICINI_CACHE_CHIAVE); myPos = null; myPosAt = 0; });

  const fino = async re => p2.waitForFunction(r => new RegExp(r).test(document.getElementById('bagnoBody').innerText),
    re, { timeout: 30000 }).catch(() => {});
  await p2.evaluate(() => { openSheet('mCerca'); });
  await p2.click('#mCerca .cerca-voce:has-text("Stazione dei treni")');
  await fino('Stazione di prova');
  const t1 = await p2.evaluate(() => document.getElementById('bagnoBody').innerText.replace(/\s+/g, ' '));
  ok('col primo server che chiude la porta, la stazione si trova lo stesso', /Stazione di prova/.test(t1), t1.slice(0, 50));
  const dopoTreno = perServer[chiude] || 0;
  await p2.click('#mBagno .x-close');
  await p2.waitForTimeout(400);

  await p2.evaluate(() => { openSheet('mCerca'); });
  await p2.click('#mCerca .cerca-voce:has-text("Bagno pubblico")');
  await fino('Bagno di piazza');
  const t2 = await p2.evaluate(() => document.getElementById('bagnoBody').innerText.replace(/\s+/g, ' '));
  ok('e anche il bagno, subito dopo', /Bagno di piazza/.test(t2), t2.slice(0, 50));
  /* La riga che conta: il server che ha chiuso la porta non si ribussa.
     Ogni richiesta in più è una ragione in più per tenerla chiusa. */
  const dopoBagno = perServer[chiude] || 0;
  ok('e al server che ha chiuso la porta non si ribussa', dopoBagno === dopoTreno,
     `${chiude}: ${dopoTreno} richieste dopo la stazione, ${dopoBagno} dopo il bagno`);
  await p2.close();

  await browser.close();
  for (const e of err) r.push(' FALLITO  ' + e);
  console.log('\n' + r.join('\n'));
  const falliti = r.filter(x => x.includes('FALLITO')).length;
  console.log(`\n${r.length - falliti}/${r.length} passati`);
  process.exit(falliti ? 1 : 0);
})();
