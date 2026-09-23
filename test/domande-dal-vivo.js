/* LE DOMANDE VERE, MANDATE AL PONTE VERO. Non è una prova: `npm test` non la
 * lancia (non si chiama prova-*), perché parla apposta col servizio vero —
 * e le prove non devono. La lancia a mano il workflow «Il ponte risponde?».
 *
 * PERCHÉ ESISTE. «Funziona solo per stazione e metro, le altre voci non
 * danno risultati.» Il controllo del ponte faceva UNA domanda, scritta a
 * mano, sui bancomat: rispondeva bene, e non diceva niente delle altre
 * cinque voci. Qui le domande non si scrivono: si fanno fare all'APP, per
 * ogni voce, esattamente come le farebbe sul telefono — tutti i giri della
 * scala e la ricerca per nome — e poi si mandano al ponte e ai server veri,
 * una per una, misurando quanto ci mettono e cosa tornano.
 *
 * Dentro il browser il recinto di test/browser.js resta acceso: l'app qui
 * non esce in rete, le sue domande si catturano e basta. È questo script,
 * da fuori, a mandarle — così si sa esattamente cosa è partito.
 */
const { apriBrowser, APP, leafletJs } = require('./browser');
const { comeOverpass } = require('./overpass-finto');
const fs = require('fs');

/* Un punto dove di tutto ce n'è di sicuro: se qui una voce non trova
   niente, il guasto è nostro e non della mappa. */
const DOVE = { lat: 45.4641, lng: 9.1900, nome: 'Duomo di Milano' };
const DIRETTI = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

const stato = { trips: [{ id: 1, name: 'Prova', destination: 'Milano', currency: 'EUR', status: 'open',
  participants: [{ id: 'p1', name: 'Gepp' }], suggested: [], pois: [], expenses: [], tickets: [],
  hotels: [], weather: {}, createdAt: Date.now(),
  days: [{ id: 'd1', date: '2026-09-01', title: '', activities: [] }] }],
  currentTripId: 1, settings: {}, myName: 'Gepp', skipAuth: true };

async function domandeDellApp() {
  const browser = await apriBrowser();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  let viste = [];
  await page.route('**/leaflet@1.9.4/dist/leaflet.js', ro => ro.fulfill({
    status: 200, contentType: 'application/javascript', body: fs.readFileSync(leafletJs(), 'utf8') }));
  /* Si risponde «niente» a tutto, con la data giusta: così l'app percorre
     tutta la scala fino in fondo, ricerca per nome compresa — che è il caso
     peggiore, quello di chi non trova. */
  await page.route('**/api/interpreter', ro => {
    viste.push(decodeURIComponent(ro.request().postData() || '').replace(/^data=/, ''));
    ro.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(comeOverpass([])) });
  });
  await page.addInitScript(([s, d]) => {
    localStorage.setItem('geppgo2', JSON.stringify(s));
    navigator.geolocation.getCurrentPosition = cb => cb({ coords: { latitude: d.lat, longitude: d.lng } });
  }, [stato, DOVE]);
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.cercaVicino === 'function', { timeout: 20000 });
  const voci = await page.evaluate(() => Object.keys(VICINI));
  const perVoce = {};
  for (const k of voci) {
    viste = [];
    await page.evaluate(kk => {
      localStorage.removeItem(VICINI_CACHE_CHIAVE);
      myPos = null; myPosAt = 0;
      closeSheet('mBagno'); cercaVicino(kk);
    }, k);
    await page.waitForFunction(() => !/Cerco|riprovo/i.test(document.getElementById('bagnoBody').innerText),
      { timeout: 120000 }).catch(() => {});
    perVoce[k] = [...new Set(viste)];
  }
  await browser.close();
  return perVoce;
}

function chiedi(url, corpo, intestazioni, attesa) {
  const ctrl = new AbortController();
  const taglia = setTimeout(() => ctrl.abort(), attesa);
  const via = Date.now();
  return fetch(url, { method: 'POST', body: corpo, headers: intestazioni, signal: ctrl.signal })
    .then(async r => ({ stato: r.status, d: await r.json().catch(() => null), s: (Date.now() - via) / 1000 }))
    .catch(e => ({ errore: /abort/i.test(String(e)) ? 'tempo scaduto' : String(e.message || e).slice(0, 60),
                   s: (Date.now() - via) / 1000 }))
    .finally(() => clearTimeout(taglia));
}

function riassunto(x) {
  if (x.errore) return `${x.s.toFixed(1)}s  NON RISPONDE: ${x.errore}`;
  /* Un «0 posti» senza data era in realtà una pagina d'errore (troppe
     richieste, server pieno), letta come una risposta vuota perché qui non
     si guardava lo stato. Stessa bugia che l'app ha smesso di credere. */
  if (x.stato && x.stato !== 200) return `${x.s.toFixed(1)}s  ERRORE ${x.stato}${x.d && x.d.errore ? ': ' + String(x.d.errore).slice(0, 70) : ''}`;
  if (!x.d) return `${x.s.toFixed(1)}s  risposta che non è JSON`;
  const d = x.d || {};
  if (d.ancora) return `${x.s.toFixed(1)}s  sta ancora cercando (${String(d.errore).slice(0, 70)})`;
  if (d.errore) return `${x.s.toFixed(1)}s  DICE DI NO [${x.stato}]: ${String(d.errore).slice(0, 80)}`;
  if (d.remark) return `${x.s.toFixed(1)}s  REMARK: ${String(d.remark).slice(0, 80)}`;
  const n = (d.elements || []).length;
  const data = String((d.osm3s || {}).timestamp_osm_base || '?').slice(0, 16);
  return `${x.s.toFixed(1)}s  ${String(n).padStart(4)} posti${d.da ? ', da «' + d.da + '»' : ''}  (dati al ${data})`;
}

(async () => {
  const sorgente = fs.readFileSync(require('path').join(__dirname, '..', 'Index 2.1.html'), 'utf8');
  const ultimo = nome => (sorgente.match(new RegExp('window\\.' + nome + '\\s*=\\s*"([^"]+)"', 'g')) || [])
    .map(m => m.replace(/^.*"([^"]+)"$/, '$1')).filter(Boolean).pop();
  const base = (ultimo('GEPPGO_SUPA_URL') || '').replace(/\/+$/, '');
  const chiave = ultimo('GEPPGO_SUPA_KEY') || '';

  console.log(`Le domande che fa l'app, voce per voce, da ${DOVE.nome}.\n`);
  const perVoce = await domandeDellApp();

  for (const [voce, domande] of Object.entries(perVoce)) {
    console.log(`━━ ${voce} — ${domande.length} domande (la scala intera, e per nome in fondo)`);
    for (const [i, q] of domande.entries()) {
      const giro = (q.match(/around:(\d+)/) || [])[1];
      const perNome = /\["name"~|\[~"\^\(name/.test(q) || /name/.test(q) && q.length > 900;
      const etichetta = `  ${i + 1}. ${giro ? (giro >= 1000 ? giro / 1000 + ' km' : giro + ' m') : '?'}` +
        `${perNome ? ' per nome' : ''} (${q.length} caratteri)`;
      console.log(etichetta);
      if (base && chiave) {
        const p = await chiedi(base + '/functions/v1/vicini', JSON.stringify({ q }),
          { 'Content-Type': 'application/json', apikey: chiave, Authorization: 'Bearer ' + chiave }, 30000);
        console.log('       ponte          ' + riassunto(p));
      }
      /* I server diretti solo sul primo giro: è quello che decide se la voce
         funziona, e non si vuole caricare dei volontari con trenta domande. */
      if (i === 0) {
        for (const u of DIRETTI) {
          const x = await chiedi(u, 'data=' + encodeURIComponent(q),
            { 'Content-Type': 'application/x-www-form-urlencoded',
              'User-Agent': 'GeppGo/1.0 (controllo; merati.giacomo94@gmail.com)' }, 40000);
          console.log('       ' + new URL(u).host.padEnd(15).slice(0, 15) + ' ' + riassunto(x));
        }
      }
    }
    console.log('');
  }
})().catch(e => { console.error(e); process.exit(1); });
