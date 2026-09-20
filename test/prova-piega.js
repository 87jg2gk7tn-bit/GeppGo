/* Cosa si vede aprendo la home, senza scorrere.

   IL DIFETTO. La mappa della giornata restava tagliata dalla barra in
   basso: si apriva l'app e di quella mappa si vedeva una striscia, con
   il resto nascosto sotto la pillola. Sopra, il cielo teneva quasi
   settanta pixel di niente prima della scritta del viaggio, e i gradi
   avevano una riga tutta loro — trentasei pixel per due cifre. Erano
   misure giuste per com'era fatta la home PRIMA: li' accanto c'era la
   fila dei nomi dei viaggi. Quella fila e' andata dietro le tre
   righine, e quello spazio e' rimasto li' a non fare niente, spingendo
   giu' tutto il resto.

   Adesso i gradi stanno sulla stessa riga della scritta, e le distanze
   sono quelle che servono: su un telefono da 844 in su la mappa si vede
   TUTTA appena si apre.

   Le misure si prendono dal vero — dove finisce la mappa, dove comincia
   la pillola — non dai fogli di stile: un margine scritto giusto non
   vuol dire che la cosa si veda.

   IL LIMITE, detto qui perche' non lo si scopra due volte: su un
   telefono corto (un SE da 667, un 8 da 736) la mappa NON ci sta lo
   stesso, e questa prova non pretende che ci stia. Per farcela entrare
   bisognerebbe rimpicciolire il titolo grosso, che e' la faccia
   dell'app. Li' si scorre, come si scorreva. */
const { apriBrowser, APP, leafletJs } = require('./browser');
const fs = require('fs');

const oggi = new Date();
const d = n => new Date(oggi.getTime() - n * 86400000).toISOString().slice(0, 10);

/* Una giornata piena come quella di chi ha segnalato il difetto: cinque
   giorni, l'ultimo e' oggi, cinque tappe con una posizione, il meteo (che
   e' quello che fa comparire la frase sotto il nome della citta' e i
   gradi — cioe' le righe che spingono giu' la mappa). Senza meteo la home
   e' piu' corta e la prova guarderebbe un caso piu' facile del vero. */
const giorni = [4, 3, 2, 1, 0].map((n, i) => ({
  id: 'd' + i, date: d(n), title: '',
  activities: n === 0 ? [1, 2, 3, 4, 5].map(k => ({
    id: 'a' + k, name: 'Tappa numero ' + k, time: String(8 + k).padStart(2, '0') + ':00',
    dur: 60, type: 'visita', people: [], lat: 48.83 + k * 0.002, lng: 2.35 + k * 0.002
  })) : []
}));

const stato = nome => ({
  trips: [{
    id: 1, name: nome || 'Parigi 26', destination: 'Parigi', currency: 'EUR', status: 'open',
    start: d(4), end: d(0),
    participants: [{ id: 'p1', name: 'Gepp', isMe: true }, { id: 'p2', name: 'Ali' }],
    suggested: [], pois: [], expenses: [], tickets: [],
    hotels: [{ id: 'h1', name: 'Grand Hôtel des Gobelins', address: 'Parigi',
               checkIn: d(4), checkOut: d(0), lat: 48.834, lng: 2.353 }],
    weather: { [d(0)]: {
      code: 2, tempMax: 27, tempMin: 18, precipitation: 0,
      sunrise: d(0) + 'T07:20', sunset: d(0) + 'T19:40', ore: [],
      fuso: 'Europe/Paris', scarto: 7200, lat: 48.8566, lng: 2.3522, v: 2,
      ts: Date.now(), sig: 'x'
    } },
    createdAt: 1, days: giorni
  }],
  currentTripId: 1, settings: {}, myName: 'Gepp',
  /* Le due righe che servono SEMPRE prima di misurare o premere qualcosa:
     senza skipAuth l'app apre «accedi o crea account» a tutto schermo (qui
     non si vede, la libreria di Supabase sta su una CDN irraggiungibile da
     questa macchina; sul server delle prove si vede), e piu' sotto si
     aspetta che la schermata d'avvio se ne sia andata. */
  skipAuth: true
});

(async () => {
  const browser = await apriBrowser();
  const r = [];
  const err = [];
  const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);

  async function apri(largo, alto, nome) {
    const page = await browser.newPage({ viewport: { width: largo, height: alto } });
    page.on('pageerror', e => err.push('PAGEERROR: ' + e.message.split('\n')[0]));
    await page.route('**/leaflet@1.9.4/dist/leaflet.js', ro => ro.fulfill({
      status: 200, contentType: 'application/javascript', body: fs.readFileSync(leafletJs(), 'utf8') }));
    /* Le tessere si servono finte: una mappa che aspetta la rete non e' alta
       come una che ce l'ha, e qui si misurano le altezze. */
    await page.route(/tile\.openstreetmap\.org/, ro => ro.fulfill({
      status: 200, contentType: 'image/png',
      body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64') }));
    await page.route(/api\.open-meteo\.com|nominatim/, ro => ro.abort());
    await page.addInitScript(s => localStorage.setItem('geppgo2', JSON.stringify(s)), stato(nome));
    await page.goto(APP, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof go === 'function', { timeout: 20000 });
    await page.waitForFunction(() => !document.getElementById('bootSplash'), { timeout: 20000 });
    await page.waitForFunction(() => !!document.getElementById('homeMapWrap'), { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(900);
    return page;
  }

  const misura = page => page.evaluate(() => {
    const q = s => document.querySelector(s);
    const box = e => e ? e.getBoundingClientRect() : null;
    const mappa = box(q('#homeMapWrap')), pillola = box(q('.nav'));
    const eb = box(q('.hh-eyebrow')), grado = box(q('.hh-grado-solo')), sole = box(q('.cl-astro'));
    /* Due riquadri si toccano se non sono separati da nessuna delle quattro
       parti. Si guardano i riquadri e non le classi: e' l'unico modo di
       sapere se dal vivo una scritta finisce addosso a un'altra. */
    const tocca = (a, b) => (!a || !b) ? null :
      !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
    /* Sulla stessa riga vuol dire che si sovrappongono in verticale, non che
       stanno a due pixel di distanza: se i gradi tornassero a prendersi una
       riga loro, questa diventerebbe falsa. */
    const stessaRiga = (eb && grado) ? (eb.top < grado.bottom - 2 && grado.top < eb.bottom - 2) : null;
    return {
      mappaC: mappa ? Math.round(mappa.top) : null,
      mappaF: mappa ? Math.round(mappa.bottom) : null,
      pillola: pillola ? Math.round(pillola.top) : null,
      cieloVuoto: (eb && q('.hh')) ? Math.round(eb.top - box(q('.hh')).top) : null,
      stessaRiga,
      ebTocca: tocca(eb, grado), ebToccaSole: tocca(eb, sole), gradoToccaSole: tocca(grado, sole)
    };
  });

  // ══ la mappa si vede tutta, appena si apre ═══════════════════════════
  /* I due telefoni piu' diffusi. Non un numero fisso di pixel: si chiede
     che la mappa FINISCA prima di dove comincia la pillola. */
  for (const [largo, alto] of [[390, 844], [393, 852], [430, 932]]) {
    const page = await apri(largo, alto);
    const m = await misura(page);
    if (m.mappaF == null || m.pillola == null) {
      ok(`a ${largo}×${alto} la mappa della giornata c'è`, false, 'la mappa non c\'è proprio');
    } else {
      ok(`a ${largo}×${alto} la mappa si vede tutta senza scorrere`,
         m.mappaF <= m.pillola,
         m.mappaF <= m.pillola ? `${m.pillola - m.mappaF}px di aria sotto`
                               : `${m.mappaF - m.pillola}px nascosti sotto la barra`);
    }
    await page.close();
  }

  // ══ i gradi non hanno piu' una riga tutta loro ═══════════════════════
  let page = await apri(390, 844);
  let m = await misura(page);
  ok('i gradi stanno sulla riga della scritta, non su una loro',
     m.stessaRiga === true, m.stessaRiga === null ? 'uno dei due non c\'è' : '');
  /* Il numero da cui e' partito tutto: quanto cielo vuoto c'e' prima della
     scritta. Era 103, cioe' la fila dei viaggi che non c'e' piu'. Si
     chiede che stia sotto i novanta: sotto quella soglia la mappa entra, e
     non si pretende un valore preciso che la prima riscrittura del cielo
     farebbe diventare rosso per niente. */
  ok('e sopra la scritta non c\'è più il vuoto della fila dei viaggi',
     m.cieloVuoto != null && m.cieloVuoto < 90, m.cieloVuoto + 'px di cielo vuoto');
  ok('niente si tocca, col nome corto',
     m.ebTocca === false && m.ebToccaSole === false && m.gradoToccaSole === false,
     `scritta/gradi ${m.ebTocca}, scritta/sole ${m.ebToccaSole}, gradi/sole ${m.gradoToccaSole}`);
  await page.close();

  // ══ e con un nome lungo, che è dove si rompe ═════════════════════════
  /* Il primo tentativo faceva galleggiare i gradi nell'angolo. Con un nome
     corto sembrava perfetto; con questo la scritta andava a capo, si
     allargava in giu' e finiva addosso al numero. Per questo adesso sono
     una riga vera con due colonne: cosi' non possono toccarsi nemmeno
     volendo. E per questo la prova il nome lungo ce l'ha. */
  page = await apri(390, 844, 'Viaggio di nozze in Giappone e Corea 2026');
  m = await misura(page);
  ok('con un nome lungo la scritta non finisce addosso ai gradi',
     m.ebTocca === false, 'si toccano: ' + m.ebTocca);
  /* E non finisce nemmeno dietro al sole, che sta in alto a destra ed e'
     alto cinquantadue pixel: e' il sole a dire quanto in alto si puo'
     portare la scritta, non il gusto di chi guarda. */
  ok('e nemmeno dietro al sole',
     m.ebToccaSole === false, 'si toccano: ' + m.ebToccaSole);
  ok('e la mappa si vede tutta anche così',
     m.mappaF != null && m.pillola != null && m.mappaF <= m.pillola,
     m.mappaF != null ? `mappa fino a ${m.mappaF}, barra da ${m.pillola}` : 'la mappa non c\'è');
  await page.close();

  await browser.close();
  for (const e of err) r.push(' FALLITO  ' + e);
  const passati = r.filter(x => x.startsWith('  OK')).length;
  console.log(r.join('\n'));
  console.log(`\n${passati}/${r.length} passati`);
  process.exit(passati === r.length ? 0 : 1);
})();
