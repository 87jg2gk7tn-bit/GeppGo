/* LE FONTI, MISURATE UNA PER UNA SULLA RETE VERA. Non è una prova: npm test
 * non la lancia. La lancia il workflow «Le fonti del qui intorno».
 *
 * PERCHÉ. «Mi dà il risultato di due giorni fa. Deve trovarlo adesso.» I
 * server di Overpass sono l'unica fonte del «qui intorno», e oggi quello
 * principale ci chiude la porta mentre gli altri ci mettono da dodici
 * secondi a oltre quaranta. Serve una seconda fonte che non dipenda da loro
 * — e prima di costruirci sopra bisogna sapere, voce per voce, quale
 * risponde, quanto ci mette, e se trova davvero la cosa più vicina.
 *
 * Si provano solo fonti già dichiarate in privacy.html (OpenStreetMap:
 * Overpass, Nominatim, Photon): una fonte nuova vorrebbe dire un servizio
 * nuovo a cui mandare le ricerche di chi usa l'app, e quella è una scelta
 * da fare apposta, non di passaggio.
 */
const { apriBrowser, APP, leafletJs } = require('./browser');
const { comeOverpass } = require('./overpass-finto');
const fs = require('fs');
const path = require('path');

/* Un punto sulla griglia di duecento metri, nella zona di chi prova l'app
   (è lo stesso delle prove del ponte). Sulla griglia, come farebbe il
   telefono: al ponte e ai servizi non arriva mai un punto preciso. */
const P = { lat: 45.592, lng: 9.228 };

/* Per ogni voce: cosa chiedere a Photon (chiave:valore di OpenStreetMap) e
   a Nominatim (le «frasi speciali» inglesi, che Nominatim traduce in
   categorie), e fin dove guardare. */
const VOCI = {
  treno: { tag: ['railway:station', 'railway:halt'], frasi: ['railway station', 'train station'], km: 10 },
  metro: { tag: ['railway:subway_entrance', 'station:subway'], frasi: ['subway entrance', 'subway station'], km: 15 },
  bus:   { tag: ['highway:bus_stop', 'amenity:bus_station'], frasi: ['bus stop'], km: 1.5 },
  bagno: { tag: ['amenity:toilets'], frasi: ['toilets', 'public toilet'], km: 3 },
  fumo:  { tag: ['amenity:smoking_area'], frasi: ['smoking area'], km: 5 },
  atm:   { tag: ['amenity:atm', 'amenity:bank'], frasi: ['atm', 'bank'], km: 2 },
};
const OVERPASS = [
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];
const UA = 'GeppGo/1.0 (misura delle fonti; merati.giacomo94@gmail.com)';

function metri(a, b, c, d) {
  const R = 6371000, r = x => x * Math.PI / 180;
  const h = Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}
async function prendi(url, opz = {}, attesa = 30000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), attesa);
  const via = Date.now();
  try {
    const r = await fetch(url, Object.assign({ signal: ctrl.signal, headers: { 'User-Agent': UA } }, opz));
    const testo = await r.text();
    let d = null; try { d = JSON.parse(testo); } catch (e) {}
    return { s: (Date.now() - via) / 1000, stato: r.status, d, testo };
  } catch (e) {
    return { s: (Date.now() - via) / 1000, errore: /abort/i.test(String(e)) ? 'tempo scaduto' : String(e.message || e).slice(0, 50) };
  } finally { clearTimeout(t); }
}
/* Il più vicino e quanti, da una lista di {nome, lat, lng}. */
function riga(x, punti) {
  if (x.errore) return `${x.s.toFixed(1)}s  NON RISPONDE: ${x.errore}`;
  if (x.stato !== 200) return `${x.s.toFixed(1)}s  ERRORE ${x.stato}: ${String(x.testo).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 60)}`;
  if (!punti) return `${x.s.toFixed(1)}s  risposta illeggibile: ${String(x.testo).slice(0, 60)}`;
  if (!punti.length) return `${x.s.toFixed(1)}s     0`;
  const vic = punti.map(p => Object.assign(p, { m: metri(P.lat, P.lng, p.lat, p.lng) })).sort((a, b) => a.m - b.m)[0];
  return `${x.s.toFixed(1)}s  ${String(punti.length).padStart(4)}   il più vicino: ${String(vic.nome || '(senza nome)').slice(0, 30)} a ${vic.m} m`;
}
const daOverpass = d => d && Array.isArray(d.elements) && !d.remark
  ? d.elements.map(e => ({ nome: (e.tags || {}).name, lat: e.lat != null ? e.lat : (e.center || {}).lat, lng: e.lon != null ? e.lon : (e.center || {}).lon }))
  : null;
const daPhoton = d => d && Array.isArray(d.features)
  ? d.features.map(f => ({ nome: f.properties.name, lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] }))
  : null;
const daNominatim = d => Array.isArray(d) ? d.map(x => ({ nome: x.name || x.display_name, lat: +x.lat, lng: +x.lon })) : null;

async function primeDomande() {
  /* Le domande di Overpass si fanno fare all'APP, come sempre: il primo
     giro di ogni voce, esattamente come parte dal telefono. */
  const browser = await apriBrowser();
  const page = await browser.newPage();
  let viste = [];
  await page.route('**/leaflet@1.9.4/dist/leaflet.js', ro => ro.fulfill({
    status: 200, contentType: 'application/javascript', body: fs.readFileSync(leafletJs(), 'utf8') }));
  await page.route('**/api/interpreter', ro => {
    viste.push(decodeURIComponent(ro.request().postData() || '').replace(/^data=/, ''));
    ro.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(comeOverpass([])) });
  });
  await page.addInitScript(p => {
    navigator.geolocation.getCurrentPosition = cb => cb({ coords: { latitude: p.lat, longitude: p.lng } });
  }, P);
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.cercaVicino === 'function', { timeout: 30000 });
  const prime = {};
  for (const k of Object.keys(VOCI)) {
    viste = [];
    await page.evaluate(kk => { localStorage.removeItem(VICINI_CACHE_CHIAVE); myPos = null; myPosAt = 0; cercaVicino(kk); }, k);
    await page.waitForFunction(() => !/Cerco|riprovo/i.test(document.getElementById('bagnoBody').innerText), { timeout: 120000 }).catch(() => {});
    prime[k] = viste[0];
  }
  await browser.close();
  return prime;
}

(async () => {
  const sorgente = fs.readFileSync(path.join(__dirname, '..', 'Index 2.1.html'), 'utf8');
  const ultimo = nome => (sorgente.match(new RegExp('window\\.' + nome + '\\s*=\\s*"([^"]+)"', 'g')) || [])
    .map(m => m.replace(/^.*"([^"]+)"$/, '$1')).filter(Boolean).pop();
  const base = (ultimo('GEPPGO_SUPA_URL') || '').replace(/\/+$/, '');
  const chiave = ultimo('GEPPGO_SUPA_KEY') || '';
  const prime = await primeDomande();

  console.log(`Le fonti del «qui intorno», voce per voce, da ${P.lat},${P.lng}.\n`);
  for (const [k, v] of Object.entries(VOCI)) {
    console.log(`━━ ${k}`);
    const q = prime[k];
    // 1. Overpass, tutti i server insieme, col primo giro vero dell'app
    await Promise.all(OVERPASS.map(async u => {
      const x = await prendi(u, { method: 'POST', body: 'data=' + encodeURIComponent(q),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA } }, 40000);
      console.log(`   overpass ${new URL(u).host.replace(/^overpass\./, '').padEnd(18)} ${riga(x, daOverpass(x.d))}`);
    }));
    // 2. Photon, «cosa c'è vicino a questo punto» filtrato per categoria
    const tagQS = v.tag.map(t => 'osm_tag=' + encodeURIComponent(t)).join('&');
    const rev = await prendi(`https://photon.komoot.io/reverse?lat=${P.lat}&lon=${P.lng}&radius=${v.km}&limit=15&${tagQS}`);
    console.log(`   photon reverse              ${riga(rev, daPhoton(rev.d))}`);
    // 3. Photon, ricerca per parola con la categoria e la posizione come preferenza
    const api = await prendi(`https://photon.komoot.io/api?q=${encodeURIComponent(v.frasi[0])}&lat=${P.lat}&lon=${P.lng}&limit=15&${tagQS}`);
    console.log(`   photon api                  ${riga(api, daPhoton(api.d))}`);
    // 4. Nominatim, le frasi speciali dentro un riquadro chiuso
    const dLat = v.km / 111, dLng = v.km / (111 * Math.cos(P.lat * Math.PI / 180));
    const box = [P.lng - dLng, P.lat + dLat, P.lng + dLng, P.lat - dLat].map(n => n.toFixed(3)).join(',');
    for (const f of v.frasi) {
      await new Promise(s => setTimeout(s, 1100));   /* una al secondo: è la loro regola */
      const n = await prendi(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(f)}&viewbox=${box}&bounded=1&format=json&limit=20`);
      console.log(`   nominatim «${f}»`.padEnd(32) + riga(n, daNominatim(n.d)));
    }
    // 5. e la stessa di Nominatim passando dal ponte degli indirizzi, cioè da Supabase
    if (base && chiave) {
      const u = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(v.frasi[0])}&viewbox=${box}&bounded=1&format=json&limit=20`;
      const g = await prendi(base + '/functions/v1/geo', { method: 'POST', body: JSON.stringify({ url: u }),
        headers: { 'Content-Type': 'application/json', apikey: chiave, Authorization: 'Bearer ' + chiave } });
      const dati = g.d && (g.d.dati !== undefined ? g.d.dati : null);
      console.log(`   nominatim dal ponte geo     ${g.d && g.d.errore ? 'DICE DI NO: ' + g.d.errore : riga(g, daNominatim(dati))}${g.d && g.d.da ? '  (da «' + g.d.da + '»)' : ''}`);
    }
    console.log('');
  }
})().catch(e => { console.error(e); process.exit(1); });
