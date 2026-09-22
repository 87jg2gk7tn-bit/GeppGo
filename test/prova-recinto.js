/* CHE DALLE PROVE NON SI ESCA IN RETE.
 *
 * Questa prova esiste per un guasto vero, e sgradevole: da quando c'e' il
 * ponte, l'app prima di chiedere alla mappa chiede a noi — al servizio VERO,
 * quello che rispondera' ai telefoni delle persone. Le prove intercettavano
 * Overpass e non il ponte, e su questo computer la cosa non si vedeva: la
 * chiamata al ponte qui non passa, l'app ripiegava su Overpass — che era
 * intercettato — e tutto sembrava a posto. Sul server delle prove
 * automatiche, dove la rete c'e' davvero, il ponte rispondeva sul serio: il
 * finto Overpass non veniva interrogato mai e cinque prove diventavano rosse.
 *
 * Il rosso era il meno. Una prova che parla col servizio vero non prova
 * niente — risponde il mondo, non il caso che si voleva provare — e scriveva
 * anche nella memoria condivisa vera, quella di chi usa l'app.
 *
 * Il recinto sta in test/browser.js e vale per TUTTE le prove, perche' passano
 * tutte da li'. Questa prova e' il posto dove si controlla che ci sia ancora:
 * senza, il giorno che qualcuno lo toglie nessuno se ne accorge finche' non
 * ricompare lo stesso guasto, in una prova che non c'entra niente.
 */
const { apriBrowser, APP, leafletJs, fuoriFermate, FUORI_AMMESSI } = require('./browser');
const fs = require('fs');

const stato = { trips: [{ id: 101, name: 'Prova', destination: 'Milano', currency: 'EUR', status: 'open',
  participants: [{ id: 1, name: 'Gepp', isMe: true }],
  suggested: [], pois: [], expenses: [], tickets: [], hotels: [], weather: {},
  days: [{ id: 1, date: '2026-09-01', title: '', activities: [] }], createdAt: Date.now() }],
  currentTripId: 101, settings: { proxRadius: 200 }, myName: 'Gepp' };

(async () => {
  const browser = await apriBrowser();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const r = [];
  const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);

  /* Tutto quello che la pagina ha CHIESTO, fermato o no. E' la lista contro
     cui si controlla il recinto: se una richiesta e' qui e non fra le
     fermate, vuol dire che e' uscita davvero. */
  const chieste = [];
  page.on('request', rq => chieste.push(rq.url()));

  /* Quello a cui risponde la prova stessa: non e' uscito in rete nemmeno
     quello, ma non l'ha fermato il recinto — l'ha risposto lei. Va tenuto da
     parte, altrimenti finisce nel conto delle scappate. */
  const risposteDellaProva = [];

  await page.route('**/leaflet@1.9.4/dist/leaflet.js', ro => {
    risposteDellaProva.push(ro.request().url());
    ro.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(leafletJs(), 'utf8') });
  });

  /* Il finto Overpass, come in tutte le altre prove: e' anche la prova che
     una rotta messa dalla prova vince sul recinto. */
  let interrogato = 0;
  await page.route('**/api/interpreter', ro => {
    interrogato++;
    risposteDellaProva.push(ro.request().url());
    ro.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ elements: [
      { type: 'node', id: 1, lat: 45.4751, lon: 9.1901, tags: { amenity: 'atm', name: 'Bancomat del recinto' } }
    ] }) });
  });

  await page.addInitScript(s => {
    localStorage.setItem('geppgo2', JSON.stringify(s));
    navigator.geolocation.getCurrentPosition = cb => cb({ coords: { latitude: 45.4750, longitude: 9.1900 } });
  }, stato);
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.cercaVicino === 'function', { timeout: 20000 });

  await page.evaluate(() => { localStorage.removeItem(VICINI_CACHE_CHIAVE); myPos = null; myPosAt = 0; cercaVicino('atm'); });
  await page.waitForFunction(() => !/Cerco/.test(document.getElementById('bagnoBody').innerText), { timeout: 20000 });

  const fermate = fuoriFermate(page);

  // ── 1. l'app chiede davvero al ponte: era questo a sfuggire ──────────
  /* L'indirizzo del ponte non si scrive qui: si chiede all'APP qual e', cosi'
     il giorno che cambia progetto Supabase la prova continua a guardare il
     posto giusto invece di controllare un indirizzo che non esiste piu'. */
  const casaDelPonte = await page.evaluate(() => (window.GEPPGO_SUPA_URL || '').replace(/^https?:\/\//, '').replace(/\/.*$/, ''));
  ok('l\'app, prima della mappa, chiede al ponte', !!casaDelPonte, casaDelPonte || 'nessun ponte configurato');
  const alPonte = fermate.filter(u => u.includes('/functions/v1/'));
  ok('e la chiamata al ponte la ferma il recinto, non la rete',
     alPonte.length > 0, alPonte.map(u => u.replace(/^https?:\/\/[^/]+/, '')).join(' '));

  // ── 2. e niente di nostro esce davvero ───────────────────────────────
  /* Questa e' la prova che conta: OGNI richiesta verso un posto che non sia
     il guscio dev'essere fra le fermate. Se ce n'e' una che non c'e', e'
     uscita — e allora la prova che la faceva partire stava parlando col
     mondo. */
  const dovevanoFermarsi = [...new Set(chieste.filter(u => {
    if (!/^https?:/.test(u)) return false;
    const h = new URL(u).hostname;
    return h !== 'localhost' && h !== '127.0.0.1' && !FUORI_AMMESSI.has(h);
  }))];
  const scappate = dovevanoFermarsi.filter(u => !fermate.includes(u) && !risposteDellaProva.includes(u));
  ok('nessuna richiesta verso fuori esce davvero',
     dovevanoFermarsi.length > 0 && scappate.length === 0,
     scappate.length ? 'scappate: ' + scappate.slice(0, 3).join(' ')
                     : fermate.length + ' fermate dal recinto, ' +
                       new Set(risposteDellaProva).size + ' risposte dalla prova');

  // ── 3. il guscio passa lo stesso ─────────────────────────────────────
  /* I pacchetti e i caratteri delle CDN sono codice, non dati nostri, e senza
     di loro l'app nelle prove non e' piu' l'app. */
  const guscioFermato = fermate.filter(u => { try { return FUORI_AMMESSI.has(new URL(u).hostname); } catch (e) { return false; } });
  ok('il guscio — pacchetti e caratteri — il recinto non lo tocca',
     guscioFermato.length === 0, guscioFermato.slice(0, 2).join(' '));

  // ── 4. una rotta della prova vince sul recinto ───────────────────────
  /* Se il recinto vincesse sulle rotte delle prove, nessuna prova potrebbe
     piu' far finta di essere Overpass: sarebbe un recinto che invece di
     proteggere le prove le spegne. */
  ok('quello che la prova intercetta lo decide la prova', interrogato > 0,
     interrogato + ' domande al finto Overpass');
  const testo = await page.evaluate(() => document.getElementById('bagnoBody').innerText);
  ok('e la ricerca arriva in fondo con la risposta finta',
     /Bancomat del recinto/.test(testo), testo.split('\n').slice(0, 2).join(' / '));

  // ── 5. anche un posto mai visto prima e' fuori ───────────────────────
  /* Il recinto non e' una lista di cose vietate — quelle si dimenticano
     sempre — ma il contrario: passa solo il guscio, e qualunque servizio
     nuovo nasce gia' chiuso. */
  const mai = await page.evaluate(() => fetch('https://esempio-mai-visto.invalid/qualcosa')
    .then(() => 'passata').catch(e => 'fermata'));
  ok('un servizio mai visto nasce gia\' chiuso', mai === 'fermata', mai);

  console.log('\n' + r.join('\n'));
  const falliti = r.filter(x => x.includes('FALLITO')).length;
  console.log(`\n${r.length - falliti}/${r.length} passati`);
  await browser.close();
  process.exit(falliti ? 1 : 0);
})();
