/* LA RICERCA VELOCE, IN GIRO PER IL MONDO. Non è una prova: npm test non
 * la lancia, perché parla apposta coi servizi veri. La lancia il workflow
 * «Il ponte risponde?».
 *
 * PERCHÉ. «Non solo la mia area, deve funzionare in tutto il mondo.» La
 * ricerca veloce è stata scelta misurando attorno a Muggiò. Photon e
 * Nominatim coprono tutto il pianeta, ma «coprono» non vuol dire «trovano
 * il bagno più vicino a Shibuya»: le frasi di Nominatim sono in inglese,
 * Photon tiene solo i posti col nome, e in ogni paese si mappa a modo suo.
 * Qui si chiede, in tredici posti di tutti i continenti — città e campagna —
 * la stessa cosa che chiederebbe il telefono, usando la funzione VERA
 * dell'app (viciniVeloce), non una copia: filtri e nomi compresi.
 */
const { apriBrowser, APP } = require('./browser');

const POSTI = [
  ['Tokyo, Shibuya', 35.6595, 139.7005],
  ['New York, Times Square', 40.7580, -73.9855],
  ['Parigi, Châtelet', 48.8584, 2.3470],
  ['Londra, King\'s Cross', 51.5308, -0.1238],
  ['Istanbul, Taksim', 41.0369, 28.9850],
  ['Città del Messico, Zócalo', 19.4326, -99.1332],
  ['San Paolo, Paulista', -23.5614, -46.6559],
  ['Sydney, centro', -33.8688, 151.2093],
  ['Nairobi, centro', -1.2864, 36.8172],
  ['Mumbai, CST', 18.9398, 72.8355],
  ['Reykjavík', 64.1466, -21.9426],
  ['Matera (paese)', 40.6664, 16.6043],
  ['Moab, Utah (campagna)', 38.5733, -109.5498],
];
const VOCI = ['treno', 'metro', 'bus', 'bagno', 'fumo', 'atm'];

(async () => {
  const browser = await apriBrowser();
  /* newContext, non newPage: il recinto delle prove sta su newPage, e qui la
     rete vera la si vuole. */
  const ctx = await browser.newContext({ locale: 'it-IT' });
  const page = await ctx.newPage();
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.viciniVeloce === 'function', { timeout: 30000 });

  console.log('La ricerca veloce dell\'app (Photon + Nominatim), la funzione vera, in giro per il mondo.\n');
  const vuote = {};
  for (const [nome, lat, lng] of POSTI) {
    console.log(`━━ ${nome}`);
    for (const k of VOCI) {
      const x = await page.evaluate(async ([k, lat, lng]) => {
        localStorage.removeItem(VICINI_CACHE_CHIAVE);
        const via = Date.now();
        const l = await viciniVeloce(k, lat, lng);
        const d = l.map(b => ({ nome: b.nome, m: Math.round(hav({ lat, lng }, { lat: b.lat, lng: b.lng })) }))
          .sort((a, b) => a.m - b.m);
        return { s: (Date.now() - via) / 1000, n: l.length, primo: d[0] };
      }, [k, lat, lng]);
      const dove = x.primo ? `${String(x.primo.nome).slice(0, 34)} a ${x.primo.m < 1000 ? x.primo.m + ' m' : (x.primo.m / 1000).toFixed(1) + ' km'}` : '—';
      console.log(`   ${k.padEnd(6)} ${x.s.toFixed(1).padStart(4)}s  ${String(x.n).padStart(3)}  ${dove}`);
      if (!x.n) (vuote[k] = vuote[k] || []).push(nome);
      /* Nominatim chiede una domanda al secondo: fra una voce e l'altra si
         aspetta, per non essere noi a farci chiudere la porta. */
      await page.waitForTimeout(1300);
    }
    console.log('');
  }
  await browser.close();
  console.log('Dove la ricerca veloce non ha trovato niente:');
  for (const k of VOCI) console.log(`   ${k.padEnd(6)} ${(vuote[k] || []).length}/${POSTI.length}  ${(vuote[k] || []).join(', ')}`);
})().catch(e => { console.error(e); process.exit(1); });
