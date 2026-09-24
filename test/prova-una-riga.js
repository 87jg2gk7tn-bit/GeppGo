/* UN POSTO, UNA RIGA.
 *
 * Segnalato dal vivo: «stazione, metropolitana e fermata bus duplicano dei
 * risultati e non deve succedere: uno è abbastanza». Nella prova sulla rete
 * vera, al Duomo il metro dava «Duomo» tre volte — 24, 48 e 76 metri — e
 * erano tre ENTRATE della stessa stazione. Lo stesso per il bus (un lato
 * della strada per ogni direzione, stesso nome) e per la stazione (segnata
 * come punto e come edificio).
 *
 * Qui si dà alla mappa esattamente quei doppioni, e si contano le righe che
 * compaiono. E si controlla il rovescio, che conta quanto il resto: due
 * fermate SENZA nome lontane fra loro sono due fermate, e due bancomat della
 * stessa banca a trecento metri sono due bancomat.
 */
const { apriBrowser, APP, leafletJs } = require('./browser');
const { rispondi, comeOverpass } = require('./overpass-finto');
const fs = require('fs');

const IO = { lat: 45.4750, lng: 9.1900 };
const su = m => IO.lat + m / 111320;
const est = m => IO.lng + m / (111320 * Math.cos(IO.lat * Math.PI / 180));
const stato = { trips: [{ id: 1, name: 'Prova', destination: 'Milano', currency: 'EUR', status: 'open',
  participants: [{ id: 'p1', name: 'Gepp' }], suggested: [], pois: [], expenses: [], tickets: [],
  hotels: [], weather: {}, createdAt: Date.now(),
  days: [{ id: 'd1', date: '2026-09-01', title: '', activities: [] }] }],
  currentTripId: 1, settings: {}, myName: 'Gepp', skipAuth: true };

const nodo = (id, m, tags, verso = su) => ({ type: 'node', id, lat: verso === su ? su(m) : IO.lat, lon: verso === su ? IO.lng : est(m), tags });

const MONDO = [
  // metro: tre entrate della stessa stazione, un'altra stazione, e due entrate senza nome vicine
  nodo(1, 24, { railway: 'subway_entrance', name: 'Duomo' }),
  nodo(2, 48, { railway: 'subway_entrance', name: 'Duomo' }, est),
  nodo(3, 76, { railway: 'subway_entrance', name: 'Duomo' }),
  nodo(4, 300, { railway: 'subway_entrance', name: 'Cordusio' }, est),
  nodo(5, 500, { railway: 'subway_entrance' }),
  nodo(6, 530, { railway: 'subway_entrance' }),
  // bus: la stessa fermata sui due lati della strada, e due fermate senza nome lontane fra loro
  nodo(10, 242, { highway: 'bus_stop', name: 'MUGGIÒ Italia/Pellico' }, est),
  nodo(11, 300, { highway: 'bus_stop', name: 'Muggiò Italia / Pellico' }, est),
  nodo(12, 100, { highway: 'bus_stop' }),
  nodo(13, 450, { highway: 'bus_stop' }),
  // stazione: segnata come punto e come edificio
  nodo(20, 1670, { railway: 'station', train: 'yes', name: 'Lissone-Muggiò' }),
  { type: 'way', id: 21, center: { lat: su(1750), lon: IO.lng }, tags: { railway: 'station', train: 'yes', name: 'Lissone-Muggiò' } },
  // bancomat: due sportelli della stessa banca, lontani
  nodo(30, 100, { amenity: 'atm', name: 'Intesa Sanpaolo' }, est),
  nodo(31, 400, { amenity: 'atm', name: 'Intesa Sanpaolo' }),
];

(async () => {
  const browser = await apriBrowser();
  const r = [];
  const err = [];
  const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', e => err.push('PAGEERROR: ' + e.message.split('\n')[0]));
  await page.route('**/leaflet@1.9.4/dist/leaflet.js', ro => ro.fulfill({
    status: 200, contentType: 'application/javascript', body: fs.readFileSync(leafletJs(), 'utf8') }));
  await page.route(/tile\.openstreetmap\.org/, ro => ro.abort());
  await page.route('**/api/interpreter', ro => {
    const q = decodeURIComponent(ro.request().postData() || '').replace(/^data=/, '');
    ro.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(comeOverpass(rispondi(q, MONDO))) });
  });
  await page.addInitScript(([s, io]) => {
    localStorage.setItem('geppgo2', JSON.stringify(s));
    navigator.geolocation.getCurrentPosition = cb => cb({ coords: { latitude: io.lat, longitude: io.lng } });
  }, [stato, IO]);
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.cercaVicino === 'function', { timeout: 20000 });
  await page.waitForFunction(() => !document.getElementById('bootSplash'), { timeout: 20000 });

  const righe = async kind => {
    await page.evaluate(k => { localStorage.removeItem(VICINI_CACHE_CHIAVE); myPos = null; myPosAt = 0; closeSheet('mBagno'); cercaVicino(k); }, kind);
    await page.waitForFunction(() => document.querySelectorAll('#bagnoBody .ms-t').length > 0 ||
      /non risulta/.test(document.getElementById('bagnoBody').innerText), { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(300);
    return page.evaluate(() => [...document.querySelectorAll('#bagnoBody .ms-row')].map(x =>
      x.querySelector('.ms-t').textContent.replace(/^⭐\s*/, '').trim() + ' · ' + x.querySelector('.ms-w').textContent.split('·')[0].trim()));
  };
  const quante = (lista, re) => lista.filter(x => re.test(x)).length;

  const metro = await righe('metro');
  ok('metro: «Duomo» una volta sola, non tre', quante(metro, /^Duomo ·/) === 1, metro.join(' | '));
  ok('ed è l\'entrata più vicina', metro.some(x => /^Duomo · 24 m/.test(x)), metro.join(' | '));
  ok('l\'altra stazione c\'è', quante(metro, /^Cordusio ·/) === 1);
  ok('due entrate senza nome a trenta metri: una riga', quante(metro, /^Metropolitana ·/) === 1, metro.join(' | '));

  const bus = await righe('bus');
  ok('bus: la stessa fermata sui due lati della strada, una riga',
     quante(bus, /Italia ?\/ ?Pellico/i) === 1, bus.join(' | '));
  ok('anche se il nome è scritto un po\' diverso (maiuscole, spazi)', !bus.some(x => /Muggiò Italia \/ Pellico/.test(x)) || quante(bus, /Pellico/) === 1);
  ok('ma due fermate senza nome a 350 metri sono due fermate',
     quante(bus, /^Fermata ·/) === 2, bus.join(' | '));

  const treno = await righe('treno');
  ok('stazione: segnata come punto e come edificio, una riga', quante(treno, /Lissone-Muggiò/) === 1, treno.join(' | '));

  const atm = await righe('atm');
  ok('bancomat: due sportelli della stessa banca a 300 m restano due', quante(atm, /Intesa Sanpaolo/) === 2, atm.join(' | '));

  await browser.close();
  for (const e of err) r.push(' FALLITO  ' + e);
  console.log('\n' + r.join('\n'));
  const falliti = r.filter(x => x.includes('FALLITO')).length;
  console.log(`\n${r.length - falliti}/${r.length} passati`);
  process.exit(falliti ? 1 : 0);
})();
