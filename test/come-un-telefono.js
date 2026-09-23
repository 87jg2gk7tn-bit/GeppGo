/* LE SEI VOCI IN FILA, COME LE PROVA UNA PERSONA, SULLA RETE VERA.
 *
 * Non è una prova — `npm test` non la lancia — e fa apposta la cosa che le
 * prove non devono fare: apre l'app SENZA recinto, col ponte vero e i
 * server della mappa veri, e tocca le sei voci del menu una dopo l'altra,
 * chiudendo ogni volta con la ✕. La lancia il workflow «Il ponte
 * risponde?».
 *
 * PERCHÉ. «Funziona solo per stazione e metro.» Stazione e metro sono le
 * prime due del menu. Se il guasto fosse nelle voci, cambiando l'ordine
 * cambierebbe poco; se è nei server — che contano le richieste di ogni
 * connessione e dopo un po' smettono di rispondere — le prime due vanno e
 * le altre no, qualunque esse siano. Per saperlo bisogna rifare la stessa
 * sequenza, sulla stessa rete, e guardare ogni risposta che arriva.
 */
const { apriBrowser, APP } = require('./browser');

const DOVE = { lat: 45.4641, lng: 9.1900 };
const VOCI = [
  ['treno', 'Stazione dei treni'], ['metro', 'Metropolitana'], ['bus', 'Fermata del bus'],
  ['bagno', 'Bagno pubblico'], ['fumo', 'Area fumatori'], ['atm', 'Bancomat'],
];
const stato = { trips: [{ id: 1, name: 'Prova', destination: 'Milano', currency: 'EUR', status: 'open',
  participants: [{ id: 'p1', name: 'Gepp' }], suggested: [], pois: [], expenses: [], tickets: [],
  hotels: [], weather: {}, createdAt: Date.now(),
  days: [{ id: 'd1', date: '2026-09-01', title: '', activities: [] }] }],
  currentTripId: 1, settings: {}, myName: 'Gepp', skipAuth: true };

(async () => {
  const browser = await apriBrowser();
  /* `newContext` e non `newPage`: il recinto sta su `newPage`, e qui la rete
     vera la si vuole. */
  const ctx = await browser.newContext({ locale: 'it-IT', viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  let log = [];
  const partenze = new Map();
  const conta = u => /\/api\/interpreter|\/functions\/v1\/vicini/.test(u);
  page.on('request', rq => { if (conta(rq.url())) partenze.set(rq, Date.now()); });
  const chiudi = (rq, com) => {
    if (!partenze.has(rq)) return;
    const u = new URL(rq.url());
    const chi = u.pathname.includes('/functions/') ? 'ponte' : u.host.replace(/^overpass\./, '');
    log.push(`${chi} ${com} ${((Date.now() - partenze.get(rq)) / 1000).toFixed(1)}s`);
    partenze.delete(rq);
  };
  page.on('requestfinished', async rq => { const r = await rq.response(); chiudi(rq, r ? String(r.status()) : '?'); });
  page.on('requestfailed', rq => chiudi(rq, 'caduta (' + (rq.failure() || {}).errorText + ')'));

  await page.addInitScript(([s, d]) => {
    localStorage.setItem('geppgo2', JSON.stringify(s));
    navigator.geolocation.getCurrentPosition = cb => cb({ coords: { latitude: d.lat, longitude: d.lng } });
  }, [stato, DOVE]);
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.cercaVicino === 'function', { timeout: 30000 });
  await page.waitForFunction(() => !document.getElementById('bootSplash'), { timeout: 30000 }).catch(() => {});
  const versione = await page.evaluate(() => VERSIONE_APP);
  console.log(`L'app vera (${versione}), la rete vera, dal Duomo di Milano. Le sei voci in fila, come dal menu.\n`);

  for (const [kind, voce] of VOCI) {
    log = [];
    const via = Date.now();
    await page.evaluate(() => openSheet('mCerca'));
    await page.click(`#mCerca .cerca-voce:has-text("${voce}")`);
    await page.waitForTimeout(500);
    const aperta = await page.evaluate(() => document.getElementById('mBagno').classList.contains('active'));
    /* Si aspetta la FINE: un risultato, un «non c'è», o l'errore — non il
       «ci riprovo da solo», che è un passaggio. */
    await page.waitForFunction(() => {
      const t = document.getElementById('bagnoBody').innerText;
      return /⭐|non risulta|non ha risposto|avevo trovato/i.test(t) && !/riprovo da solo/i.test(t);
    }, { timeout: 150000 }).catch(() => {});
    const quanto = ((Date.now() - via) / 1000).toFixed(1);
    const testo = await page.evaluate(() => document.getElementById('bagnoBody').innerText.replace(/\s+/g, ' ').trim());
    console.log(`━━ ${voce}  —  ${quanto}s${aperta ? '' : '  ⚠ LA SCHEDA NON SI È APERTA'}`);
    console.log(`   vede: ${testo.slice(0, 110)}`);
    console.log(`   rete: ${log.join(' · ') || 'nessuna richiesta'}\n`);
    await page.click('#mBagno .x-close').catch(() => {});
    await page.waitForTimeout(800);
  }
  await browser.close();

  /* E alla fine: quanti posti ha ancora questa connessione sul server
     principale. Se sono finiti, il guasto sono le richieste, non le voci. */
  try {
    const st = await (await fetch('https://overpass-api.de/api/status')).text();
    console.log('overpass-api.de, stato di questa connessione:\n' + st.split('\n').slice(0, 8).map(l => '   ' + l).join('\n'));
  } catch (e) { console.log('stato di overpass-api.de non leggibile: ' + e.message); }
})().catch(e => { console.error(e); process.exit(1); });
