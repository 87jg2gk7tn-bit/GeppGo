/* Il cielo in cima alla home, e la tendina del meteo.

   Il meteo era una delle nove voci della barra in basso: una sezione dove
   andare. Ma che tempo fa non è un posto, è una cosa che si guarda di
   sfuggita dieci volte al giorno mentre si sta facendo altro. Adesso sta in
   cima, di fianco ai nomi dei viaggi, disegnato — e toccandolo scende tutto
   il resto.

   Due cose questa prova le guarda col metro invece che a occhio, perché a
   occhio ci si era già sbagliati: che il cielo cambi DAVVERO col tempo che
   fa (si legge il colore, non la classe) e che il "+" resti raggiungibile
   con tre viaggi in lista.

   Sul codice di prima non parte nemmeno: .hh-cielo non esiste. */
const { apriBrowser, APP, leafletJs } = require('./browser');
const fs = require('fs');

const oggi = new Date().toISOString().slice(0, 10);
const domani = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
const terzo = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
const lontano = new Date(Date.now() + 40 * 864e5).toISOString().slice(0, 10);

const wx = (code, mx, mn, pr, tramonto, alba) => ({
  code, tempMax: mx, tempMin: mn, precipitation: pr, windSpeed: 8,
  sunset: oggi + 'T' + (tramonto || '20:30'), sunrise: oggi + 'T' + (alba || '06:20'),
  luogo: 'Praga'
});

/* Tre viaggi apposta: con uno solo il "+" ci sta comodo e non si scoprirebbe
   mai che con tre finiva fuori dallo schermo. */
const stato = (meteo, giorni) => ({
  trips: [
    { id: 1, name: 'Praga', destination: 'Praga', currency: 'EUR', status: 'open',
      start: oggi, end: terzo,
      participants: [{ id: 1, name: 'Gepp', isMe: true }],
      pois: [], expenses: [], tickets: [], hotels: [], createdAt: 1,
      weather: meteo,
      days: giorni || [
        { id: 'd1', date: oggi, title: '', activities: [
          { id: 11, name: 'Ponte Carlo', time: '09:30', timeEnd: '10:30', lat: 50.086, lng: 14.411,
            who: [1], completed: false, type: 'outdoor', booking: { needed: false, done: false } }] },
        { id: 'd2', date: domani, title: '', activities: [
          { id: 21, name: 'Castello', time: '10:00', timeEnd: '12:00', lat: 50.090, lng: 14.400,
            who: [1], completed: false, type: 'outdoor', booking: { needed: false, done: false } }] },
        { id: 'd3', date: terzo, title: '', activities: [
          { id: 31, name: 'Vyšehrad', time: '11:00', timeEnd: '13:00', lat: 50.064, lng: 14.418,
            who: [1], completed: false, type: 'outdoor', booking: { needed: false, done: false } }] }]
    },
    { id: 2, name: 'Giappone 26', status: 'open', days: [], pois: [], expenses: [],
      tickets: [], hotels: [], weather: {}, participants: [], createdAt: 2 },
    { id: 3, name: 'Capodanno a Lisbona', status: 'open', days: [], pois: [], expenses: [],
      tickets: [], hotels: [], weather: {}, participants: [], createdAt: 3 }
  ],
  currentTripId: 1, settings: { proxRadius: 200 }, myName: 'Gepp', skipAuth: true
});

/* Le ore finte: un mattino sereno, un pomeriggio di pioggia, una sera che si
   rimette. Così si vede se la fila segue davvero l'ora. */
const oreFinte = (data) => {
  const time = [], weather_code = [], temperature_2m = [], precipitation_probability = [];
  for (let h = 0; h < 24; h++) {
    time.push(`${data}T${String(h).padStart(2, '0')}:00`);
    weather_code.push(h < 12 ? 0 : h < 18 ? 61 : 3);
    temperature_2m.push(8 + h % 12);
    precipitation_probability.push(h < 12 ? 0 : h < 18 ? 80 : 20);
  }
  return { time, weather_code, temperature_2m, precipitation_probability };
};

(async () => {
  const browser = await apriBrowser();
  const r = [];
  const err = [];
  const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);

  /* Ogni pagina tiene il conto delle chiamate alle ore: una chiamata in più
     è una chiamata a un'API che non è nostra. */
  async function apri(st, opz = {}) {
    const page = await browser.newPage({ viewport: { width: opz.largo || 390, height: 844 } });
    page.on('pageerror', e => err.push('PAGEERROR: ' + e.message.split('\n')[0]));
    page._ore = [];
    await page.route('**/leaflet@1.9.4/dist/leaflet.js', ro => ro.fulfill({
      status: 200, contentType: 'application/javascript', body: fs.readFileSync(leafletJs(), 'utf8') }));
    await page.route(/tile\.openstreetmap\.org/, ro => ro.abort());
    /* L'ordine conta: Playwright prova le rotte dall'ultima registrata, e la
       più specifica deve essere l'ultima. */
    await page.route(/api\.open-meteo\.com/, ro => ro.abort());
    if (!opz.oreRotte) await page.route(/api\.open-meteo\.com.*hourly=/, ro => {
      const u = ro.request().url();
      page._ore.push(u);
      const d = (u.match(/start_date=(\d{4}-\d{2}-\d{2})/) || [])[1] || oggi;
      ro.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ hourly: oreFinte(d) }) });
    });
    await page.addInitScript(s => localStorage.setItem('geppgo2', JSON.stringify(s)), st);
    await page.goto(APP, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof go === 'function', { timeout: 20000 });
    await page.waitForTimeout(700);
    return page;
  }

  /* Quanto è chiaro il cielo, da 0 (nero) a 255 (bianco). Si legge il colore
     che il browser ha davvero risolto, non il nome della classe: una classe
     si può mettere anche su un rettangolo bianco. */
  const LUCE = `(el => {
    /* Il valore di una proprieta' personalizzata torna come l'hai scritto:
       i colori sono in esadecimale, non in rgb(). Ci si e' persi un giro
       a cercare "rgb(" dentro una stringa che non ne aveva. */
    const g = getComputedStyle(el).getPropertyValue('--cl-g');
    const v = [];
    for (const m of g.matchAll(/#([0-9a-fA-F]{6})\\b/g)) {
      const n = parseInt(m[1], 16);
      v.push([(n >> 16) & 255, (n >> 8) & 255, n & 255]);
    }
    for (const m of g.matchAll(/rgba?\\(([^)]+)\\)/g)) {
      const q = m[1].match(/[\\d.]+/g).map(Number);
      v.push([q[0], q[1], q[2]]);
    }
    if (!v.length) return null;
    const l = v.map(x => 0.299 * x[0] + 0.587 * x[1] + 0.114 * x[2]);
    return Math.round(l.reduce((a, b) => a + b, 0) / l.length);
  })`;

  // ══ la riga in cima: i nomi, il "+", la temperatura ══════════════════
  let page = await apri(stato({ [oggi]: wx(0, 24, 14, 0) }));
  const riga = await page.evaluate(() => {
    const barra = document.querySelector('.hh-tripbar');
    const fila = document.querySelector('.hh-trips');
    const piu = document.querySelector('.hh-trip-add');
    const grado = document.querySelector('.hh-grado');
    const b = x => x ? x.getBoundingClientRect() : null;
    const rb = b(barra), rf = b(fila), rp = b(piu), rg = b(grado);
    const st = grado ? getComputedStyle(grado) : null;
    return {
      gradoCè: !!grado, tag: grado && grado.tagName, testo: grado && grado.textContent.trim(),
      /* Il riquadro non deve tornare: era la cosa di troppo. */
      niente_riquadro: !document.querySelector('.hh-cielo'),
      senzaScatola: !!st && st.borderTopWidth === '0px' &&
                    (st.backgroundImage === 'none') &&
                    /rgba\(0, 0, 0, 0\)|transparent/.test(st.backgroundColor),
      piuCè: !!piu,
      piuDentroLoScorrevole: !!(piu && fila && fila.contains(piu)),
      piuDopoINomi: !!(rp && rf && rp.left >= rf.right - 1),
      piuPrimaDelGrado: !!(rp && rg && rp.right <= rg.left + 1),
      /* Il "+" deve restare attaccato ai nomi, non finire all'altro capo:
         è l'ultima cosa della lista, non un tasto per conto suo. */
      piuAttaccatoAiNomi: !!(rp && rf && rp.left - rf.right < 24),
      gradoAlBordo: !!(rg && rb && Math.abs(rg.right - rb.right) < 2),
      quantiViaggi: document.querySelectorAll('.hh-trip').length,
      filaScorre: getComputedStyle(fila).overflowX,
      maschera: getComputedStyle(fila).maskImage || getComputedStyle(fila).webkitMaskImage || '',
      vsx: parseFloat(getComputedStyle(fila).getPropertyValue('--vsx')) || 0,
      vdx: parseFloat(getComputedStyle(fila).getPropertyValue('--vdx')) || 0
    };
  });
  ok('la temperatura c\'è, in cima alla home', riga.gradoCè === true);
  ok('ed è un tasto vero, non un cartello', riga.tag === 'BUTTON', String(riga.tag));
  ok('dice la temperatura di quel giorno', riga.testo === '24°', riga.testo);
  /* Il punto della modifica chiesta: il riquadro non c'è più, il numero sta
     sul cielo come ci sta il titolo. */
  ok('e non è dentro un riquadro: niente bordo, niente fondo', riga.senzaScatola === true);
  ok('il riquadro di prima non c\'è più', riga.niente_riquadro === true);
  ok('il "+" c\'è ancora', riga.piuCè === true);
  ok('il "+" sta subito dopo i nomi dei viaggi', riga.piuDopoINomi === true);
  ok('e gli resta attaccato, invece di finire all\'altro capo della riga',
     riga.piuAttaccatoAiNomi === true);
  ok('e prima della temperatura', riga.piuPrimaDelGrado === true);
  /* Resta fuori dallo scorrevole apposta: se scorresse coi nomi, con tre
     viaggi in lista non lo vedresti mai. */
  ok('il "+" non scorre insieme ai nomi', riga.piuDentroLoScorrevole === false);
  ok('con tre viaggi in lista si vede lo stesso', riga.quantiViaggi === 3, riga.quantiViaggi + ' viaggi');
  ok('la temperatura sta all\'altro capo della riga', riga.gradoAlBordo === true);
  /* I nomi si tagliavano di netto: un nome mozzato sembra un difetto, un
     nome che sfuma dice «scorri». */
  ok('i nomi scorrono', riga.filaScorre === 'auto', riga.filaScorre);
  ok('e dove la fila continua svaniscono, invece di essere tagliati',
     riga.vdx > 8 && riga.vsx === 0, `sinistra ${riga.vsx}px, destra ${riga.vdx}px`);
  ok('ed è una sfumatura, non un taglio', /gradient/.test(riga.maschera), riga.maschera.slice(0, 40));
  const inFondo = await page.evaluate(async () => {
    const fila = document.querySelector('.hh-trips');
    fila.scrollLeft = fila.scrollWidth;
    fila.dispatchEvent(new Event('scroll'));
    await new Promise(r2 => setTimeout(r2, 120));
    const st = getComputedStyle(fila);
    return { sx: parseFloat(st.getPropertyValue('--vsx')) || 0, dx: parseFloat(st.getPropertyValue('--vdx')) || 0 };
  });
  ok('arrivati in fondo la sfumatura si ribalta', inFondo.sx > 8 && inFondo.dx === 0,
     `sinistra ${inFondo.sx}px, destra ${inFondo.dx}px`);

  // ══ il cielo È lo sfondo, non un'immagine appoggiata sopra ═══════════
  const sfondo = await page.evaluate(([luce]) => {
    const hh = document.querySelector('.hh'), velo = document.querySelector('.hh-velo');
    const sv = velo ? getComputedStyle(velo) : null;
    const rh = hh.getBoundingClientRect(), rv = velo ? velo.getBoundingClientRect() : null;
    return {
      classi: hh.className,
      luce: eval(luce)(hh),
      /* Lo sfondo dell'intestazione deve essere davvero cambiato: è quello
         che vuol dire «fuso», invece di un rettangolo appiccicato sopra. */
      sfumaturaVera: /gradient/.test(getComputedStyle(hh).backgroundImage),
      veloCè: !!velo,
      veloCopreTutto: !!(rv && Math.round(rv.width) === Math.round(rh.width) &&
                              Math.round(rv.height) === Math.round(rh.height)),
      /* Non deve rubare i tocchi a niente di quello che ci sta sopra. */
      veloNonTocca: !!sv && sv.pointerEvents === 'none',
      /* E deve svanire verso il basso: se finisse di netto si vedrebbe il
         bordo dell'immagine, ed è esattamente quello che non deve sembrare. */
      veloSvanisce: !!sv && /gradient/.test(sv.maskImage || sv.webkitMaskImage || ''),
      sole: !!document.querySelector('.hh-velo .cl-astro'),
      nuvole: document.querySelectorAll('.hh-velo .cl-nuv').length,
      /* Il tondo chiaro decorativo si toglie: due soli, uno finto e uno
         disegnato, sono uno di troppo. */
      tondoSpento: getComputedStyle(hh, '::after').display === 'none'
    };
  }, [LUCE]);
  ok('col sole l\'intestazione è un cielo sereno', /c-sereno/.test(sfondo.classi), sfondo.classi);
  ok('e il cielo è lo sfondo dell\'intestazione, non un riquadro sopra',
     sfondo.sfumaturaVera === true);
  ok('c\'è il velo disegnato', sfondo.veloCè === true);
  ok('e copre tutta l\'intestazione', sfondo.veloCopreTutto === true);
  ok('senza rubare un solo tocco a quello che ci sta sopra', sfondo.veloNonTocca === true);
  ok('e svanisce verso il basso, invece di finire con un taglio', sfondo.veloSvanisce === true);
  ok('col sereno c\'è il sole e non ci sono nuvole davanti',
     sfondo.sole === true && sfondo.nuvole === 0, `sole ${sfondo.sole}, nuvole ${sfondo.nuvole}`);
  ok('e il tondo decorativo si spegne', sfondo.tondoSpento === true);
  const luceSereno = sfondo.luce;
  await page.close();

  // ══ e cambia davvero col tempo che fa, misurato ══════════════════════
  /* Quattro millimetri: pioggia normale. Il caso "forte" viene subito
     dopo, con ventidue, e le due cose devono vedersi diverse. */
  page = await apri(stato({ [oggi]: wx(63, 13, 8, 4) }));
  const pioggia = await page.evaluate(([luce]) => {
    const hh = document.querySelector('.hh');
    const chip = document.querySelector('.hh-trip:not(.on)');
    return { classi: hh.className, luce: eval(luce)(hh),
             gocce: document.querySelectorAll('.hh-velo .cl-g').length,
             /* La pioggia vera non ha due gocce uguali. Se lunghezze,
                trasparenze e velocità fossero tutte identiche saremmo
                tornati alla grata che si muove: qui si contano i valori
                DISTINTI, che è l'unico modo di misurare la varietà. */
             lunghezze: new Set([...document.querySelectorAll('.hh-velo .cl-g')].map(x => getComputedStyle(x).height)).size,
             trasparenze: new Set([...document.querySelectorAll('.hh-velo .cl-g')].map(x => getComputedStyle(x).opacity)).size,
             velocita: [...document.querySelectorAll('.hh-velo .cl-g')].map(x => parseFloat(getComputedStyle(x).animationDuration)),
             altezze: [...document.querySelectorAll('.hh-velo .cl-g')].map(x => parseFloat(getComputedStyle(x).height)),
             opacita: [...document.querySelectorAll('.hh-velo .cl-g')].map(x => parseFloat(getComputedStyle(x).opacity)),
             sole: !!document.querySelector('.hh-velo .cl-astro'),
             inchiostroChip: getComputedStyle(chip).color };
  }, [LUCE]);
  ok('con la pioggia il cielo è di pioggia', /c-pioggia/.test(pioggia.classi), pioggia.classi);
  /* Prima erano trattini tutti uguali che scendevano alla stessa velocità:
     una grata che si muove, non pioggia. Quello che mancava non era la
     velocità, era la VARIETÀ. */
  ok('la pioggia è fatta di gocce, una per una', pioggia.gocce === 26, pioggia.gocce + ' gocce');
  /* Contare quante sono DIVERSE era un metro sbagliato: le lunghezze sono
     numeri interi in un intervallo stretto, quindi i doppioni sono
     inevitabili e il conteggio diceva "poca varietà" anche quando ce n'era
     parecchia. Quello che conta è l'AMPIEZZA: fra la goccia più corta e la
     più lunga ci deve essere una differenza che si vede. */
  const spanH = Math.max(...pioggia.altezze) - Math.min(...pioggia.altezze);
  ok('e non ce n\'è una uguale all\'altra: lunghezze sparse su tutto l\'intervallo',
     pioggia.lunghezze >= 10 && spanH >= 12,
     pioggia.lunghezze + ' lunghezze diverse, da ' + Math.min(...pioggia.altezze) +
     ' a ' + Math.max(...pioggia.altezze) + 'px');
  const opa = pioggia.opacita;
  ok('e trasparenze sparse, che è come si legge la profondità',
     pioggia.trasparenze >= 15 && (Math.max(...opa) - Math.min(...opa)) >= 0.35,
     pioggia.trasparenze + ' trasparenze, da ' + Math.min(...opa).toFixed(2) +
     ' a ' + Math.max(...opa).toFixed(2));
  /* Sulla velocità ci si è sbagliati due volte, in due direzioni opposte:
     prima troppo veloci e tutte uguali (una grata che si muove), poi troppo
     lente per correggere — strisce lunghe che scendevano adagio, cioè stelle
     cadenti. La pioggia vera è VELOCE: mezzo secondo per attraversare
     l'intestazione. Quello che le impedisce di sembrare una grata non è la
     lentezza, è che non ce n'è una uguale all'altra — ed è il controllo qui
     sopra a tenerlo fermo. */
  ok('e scendono come scende la pioggia, né a scatti né come stelle cadenti',
     Math.min(...pioggia.velocita) >= 0.3 && Math.max(...pioggia.velocita) <= 1.1,
     'da ' + Math.min(...pioggia.velocita) + 's a ' + Math.max(...pioggia.velocita) + 's');
  /* Una striscia lunga che scende adagio è una stella cadente. La lunghezza
     va con la velocità, non contro: corte. */
  ok('e sono strisce corte, non scie',
     pioggia.altezze.every(h => h <= 30), 'la più lunga ' + Math.max(...pioggia.altezze) + 'px');
  ok('e il sole non c\'è: dietro le nuvole non lo vedresti', pioggia.sole === false);
  ok('e il cielo è più scuro di quando c\'è il sole', pioggia.luce < luceSereno - 15,
     `pioggia ${pioggia.luce}, sereno ${luceSereno}`);
  /* Se il cielo in alto si fa scuro, quello che ci sta sopra deve
     schiarirsi: inchiostro tenue su un temporale non si legge più. */
  ok('e i nomi dei viaggi passano all\'inchiostro chiaro',
     /cl-buio/.test(pioggia.classi) && /255, 255, 255/.test(pioggia.inchiostroChip),
     pioggia.inchiostroChip);
  await page.close();

  /* Piove forte: le gocce si infittiscono. È la differenza fra
     «pioviggina» e «prendi l'ombrello», e si deve vedere. */
  page = await apri(stato({ [oggi]: wx(65, 14, 9, 22) }));
  const forte = await page.evaluate(() => {
    const hh = document.querySelector('.hh');
    const g = document.querySelectorAll('.hh-velo .cl-g');
    return { classe: hh.className.includes('forte'), quante: g.length };
  });
  ok('quando piove forte le gocce sono di più',
     forte.classe === true && forte.quante === 44, forte.quante + ' gocce');
  await page.close();

  page = await apri(stato({ [oggi]: wx(73, 1, -5, 6) }));
  const neve = await page.evaluate(() => ({
    classi: document.querySelector('.hh').className,
    fiocchi: !!document.querySelector('.hh-velo .cl-nev'),
    sole: !!document.querySelector('.hh-velo .cl-astro')
  }));
  ok('con la neve il cielo è di neve', /c-neve/.test(neve.classi) && neve.fiocchi === true, neve.classi);
  ok('e non c\'è un sole sopra la neve che scende', neve.sole === false);
  await page.close();

  page = await apri(stato({ [oggi]: wx(95, 20, 15, 22) }));
  const tempo = await page.evaluate(() => ({
    classi: document.querySelector('.hh').className,
    bagliore: !!document.querySelector('.hh-velo .cl-lampo'),
    saetta: !!document.querySelector('.hh-velo .cl-saetta'),
    pioggia: document.querySelectorAll('.hh-velo .cl-g').length > 0
  }));
  ok('col temporale il cielo è di temporale', /c-tempo/.test(tempo.classi), tempo.classi);
  ok('e ci sono il bagliore, la saetta e la pioggia',
     tempo.bagliore === true && tempo.saetta === true && tempo.pioggia === true);
  await page.close();

  // ══ di notte ═════════════════════════════════════════════════════════
  /* Il tramonto messo all'una di notte vuol dire che a quest'ora, qualunque
     ora sia, il sole è già sceso. */
  page = await apri(stato({ [oggi]: wx(0, 24, 14, 0, '00:01', '00:00') }));
  const notte = await page.evaluate(([luce]) => {
    const hh = document.querySelector('.hh');
    return { classi: hh.className, luce: eval(luce)(hh),
             stelle: !!document.querySelector('.hh-velo .cl-stelle'),
             luna: !!document.querySelector('.hh-velo .cl-astro') };
  }, [LUCE]);
  ok('dopo il tramonto il cielo è di notte', /\bnotte\b/.test(notte.classi), notte.classi);
  ok('e di notte è scuro davvero, non solo di nome',
     typeof notte.luce === 'number' && notte.luce < 90,
     `luce ${notte.luce} contro ${luceSereno} di giorno`);
  ok('e ci sono le stelle e la luna', notte.stelle === true && notte.luna === true);
  await page.close();

  /* Un giorno futuro non è mai notte: l'ora di adesso non dice niente su
     giovedì, e disegnarci la luna sopra sarebbe una bugia. */
  page = await apri(stato({ [domani]: wx(0, 22, 12, 0, '00:01', '00:00') },
    [{ id: 'd1', date: domani, title: '', activities: [] }]));
  const futuro = await page.evaluate(() => document.querySelector('.hh').className);
  ok('su un giorno futuro non è mai notte, a qualunque ora si guardi',
     !/\bnotte\b/.test(futuro), futuro);
  await page.close();

  // ══ quando la previsione non c'è ═════════════════════════════════════
  /* Niente cielo finto e nessuna scritta: quanti giorni mancano l'app lo
     dice già poco più sotto, nell'anello della prossima tappa. Riempire di
     parole il posto dove doveva esserci un'immagine era il difetto. */
  page = await apri(stato({}, [{ id: 'd1', date: lontano, title: '', activities: [] }]));
  const vuoto = await page.evaluate(() => {
    const hh = document.querySelector('.hh');
    return { classi: hh.className, velo: !!document.querySelector('.hh-velo'),
             grado: !!document.querySelector('.hh-grado'),
             testo: hh.innerText.replace(/\s+/g, ' ') };
  });
  ok('senza previsione l\'intestazione resta quella di sempre',
     vuoto.classi.trim() === 'hh' && vuoto.velo === false, vuoto.classi);
  ok('e non c\'è nessuna temperatura da mostrare', vuoto.grado === false);
  ok('e soprattutto nessuna scritta «fra tot giorni» in cima',
     !/fra \d+ ?g/i.test(vuoto.testo) && !/in \d+ ?d/i.test(vuoto.testo),
     vuoto.testo.slice(0, 70));
  await page.close();

  // ══ aprire il meteo ══════════════════════════════════════════════════
  page = await apri(stato({ [oggi]: wx(61, 18, 9, 6), [domani]: wx(0, 23, 12, 0) }));
  const apertura = await page.evaluate(async () => {
    const attendi = ms => new Promise(r2 => setTimeout(r2, ms));
    const aperta = () => document.getElementById('mMeteo').classList.contains('active');
    const tocca = el => { const b = el.getBoundingClientRect();
      const e = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); if (e) e.click(); };
    const out = {};
    tocca(document.querySelector('.hh-grado'));
    await attendi(400); out.colGrado = aperta();
    closeSheet('mMeteo'); await attendi(500);
    /* Lo spazio fra il "+" e la temperatura non è un buco: è ancora la
       striscia del meteo, e toccandolo si apre. */
    const barra = document.querySelector('.hh-tripbar'),
          piu = document.querySelector('.hh-trip-add'), g = document.querySelector('.hh-grado');
    const bp = piu.getBoundingClientRect(), bg = g.getBoundingClientRect(), bb = barra.getBoundingClientRect();
    out.cèSpazio = bg.left - bp.right > 6;
    const e = document.elementFromPoint((bp.right + bg.left) / 2, bb.top + bb.height / 2);
    if (e) e.click();
    await attendi(400); out.colVuoto = aperta();
    closeSheet('mMeteo'); await attendi(500);
    /* E toccando un nome si cambia viaggio, non si apre il meteo. */
    const altro = [...document.querySelectorAll('.hh-trip')].find(x => !x.classList.contains('on'));
    tocca(altro); await attendi(500);
    out.colNome = aperta();
    out.viaggioCambiato = T().id !== 1;
    return out;
  });
  ok('toccando la temperatura si apre il meteo', apertura.colGrado === true);
  ok('fra il "+" e la temperatura c\'è dello spazio', apertura.cèSpazio === true);
  ok('e toccando quello spazio si apre lo stesso', apertura.colVuoto === true);
  ok('mentre toccando un nome di viaggio si cambia viaggio, non si apre il meteo',
     apertura.colNome === false && apertura.viaggioCambiato === true,
     `aperto ${apertura.colNome}, cambiato ${apertura.viaggioCambiato}`);
  await page.close();


  // ══ dentro la tendina ════════════════════════════════════════════════
  page = await apri(stato({ [oggi]: wx(61, 18, 9, 6), [domani]: wx(0, 23, 12, 0), [terzo]: wx(73, 2, -3, 4) }));
  const dentro = await page.evaluate(async () => {
    const attendi = ms => new Promise(r2 => setTimeout(r2, ms));
    apriMeteo();
    await attendi(900);
    const m = document.getElementById('mMeteo');
    const hero = document.querySelector('.mt-hero');
    const celle = [...document.querySelectorAll('.mt-ora')];
    const fila = document.getElementById('mtOreFila');
    const adesso = document.querySelector('.mt-ora.adesso');
    return {
      aperta: m.classList.contains('active'),
      daSopra: m.classList.contains('modal-top'),
      giornoScelto: mtGiorno,
      heroClassi: hero ? hero.className : '',
      heroTesto: hero ? hero.innerText.replace(/\s+/g, ' ').trim() : '',
      segnati: [...document.querySelectorAll('.wcard.sel')].length,
      quanteRighe: document.querySelectorAll('.wcard').length,
      quanteOre: celle.length,
      cèAdesso: !!adesso,
      scorsoSuAdesso: !!(fila && adesso && fila.scrollLeft > 0),
      pioveNelPomeriggio: celle.some(c => /🌧|🌦/.test(c.innerText)),
      colonnine: document.querySelectorAll('.mt-o-b').length
    };
  });
  ok('la tendina si apre', dentro.aperta === true);
  ok('e scende dall\'alto, da dove hai toccato', dentro.daSopra === true);
  ok('si apre sul giorno che la home sta mostrando', dentro.giornoScelto === oggi, dentro.giornoScelto);
  ok('il riquadro grande ha il cielo di quel giorno', /c-pioggia/.test(dentro.heroClassi), dentro.heroClassi);
  ok('e dice quale giorno è, e di quanti', /GIORNO 1 DI 3/i.test(dentro.heroTesto), dentro.heroTesto.slice(0, 60));
  ok('nella lista ci sono tutti i giorni del viaggio', dentro.quanteRighe === 3, dentro.quanteRighe + ' righe');
  ok('e quello che stai guardando è segnato, uno solo', dentro.segnati === 1, dentro.segnati + ' segnati');
  ok('le ore ci sono, tutte e ventiquattro', dentro.quanteOre === 24, dentro.quanteOre + ' ore');
  ok('ognuna con la sua colonnina di pioggia', dentro.colonnine === 24, dentro.colonnine + ' colonnine');
  ok('l\'ora di adesso è segnata', dentro.cèAdesso === true);
  ok('e la fila ci è scorsa sopra, invece di partire da mezzanotte',
     dentro.scorsoSuAdesso === true);
  ok('e le ore seguono il tempo che fa, non sono tutte uguali',
     dentro.pioveNelPomeriggio === true);

  /* Cambiare giorno cambia il riquadro grande, e chiede le ore di QUEL
     giorno: le ore costano una chiamata, e chiederle per tutti i sette
     giorni quando ne stai guardando uno sarebbe sprecarne sei. */
  const chiamatePrima = page._ore.length;
  const cambio = await page.evaluate(async (giorno) => {
    const attendi = ms => new Promise(r2 => setTimeout(r2, ms));
    /* Si tocca la riga come farebbe un dito, invece di chiamare la
       funzione: così si prova anche che la riga risponda al tocco. */
    const riga = [...document.querySelectorAll('.wcard')].find(x => (x.getAttribute('onclick') || '').includes(giorno));
    if (riga) riga.click(); else meteoGiorno(giorno);
    await attendi(900);
    const hero = document.querySelector('.mt-hero');
    return { scelto: mtGiorno, classi: hero.className, testo: hero.innerText.replace(/\s+/g, ' ').trim(),
             segnati: [...document.querySelectorAll('.wcard.sel')].length,
             rigaTrovata: !!riga };
  }, terzo);
  ok('toccando un altro giorno il riquadro grande passa a quello',
     cambio.scelto === terzo && /c-neve/.test(cambio.classi), cambio.scelto + ' ' + cambio.classi);
  ok('e dice il giorno giusto', /GIORNO 3 DI 3/i.test(cambio.testo), cambio.testo.slice(0, 50));
  ok('e il segno nella lista si sposta con lui', cambio.segnati === 1, cambio.segnati + ' segnati');
  ok('le ore si chiedono solo per la giornata che stai guardando',
     page._ore.length === chiamatePrima + 1,
     `${chiamatePrima} chiamate prima, ${page._ore.length} dopo`);
  ok('e sono le ore di quel giorno, non di un altro',
     page._ore[page._ore.length - 1].includes('start_date=' + terzo),
     page._ore[page._ore.length - 1].split('&').filter(x => /date/.test(x)).join(' '));
  /* Tornandoci sopra non si richiede niente: la risposta è già in mano. */
  const chiamateDopo = page._ore.length;
  await page.evaluate(async () => { meteoGiorno(mtGiorno); await new Promise(r2 => setTimeout(r2, 700)); });
  ok('e tornando sullo stesso giorno non si richiede niente',
     page._ore.length === chiamateDopo, `${chiamateDopo} → ${page._ore.length}`);
  await page.close();

  // ══ quando le ore non arrivano ═══════════════════════════════════════
  page = await apri(stato({ [oggi]: wx(61, 18, 9, 6) }), { oreRotte: true });
  const senzaRete = await page.evaluate(async () => {
    apriMeteo();
    await new Promise(r2 => setTimeout(r2, 1200));
    return { testo: document.getElementById('mtOre').innerText.replace(/\s+/g, ' ').trim(),
             heroCè: !!document.querySelector('.mt-hero') };
  });
  ok('se le ore non arrivano lo dice, invece di restare in bianco',
     /non sono arrivate/i.test(senzaRete.testo), senzaRete.testo.slice(0, 60));
  ok('e il resto della tendina si vede lo stesso', senzaRete.heroCè === true);
  await page.close();

  // ══ DA DOVE VIENE IL METEO ═══════════════════════════════════════════
  /* Il difetto piu' grosso che il meteo abbia mai avuto, e dal codice non si
     vedeva: un viaggio con destinazione "Giappone" prendeva le previsioni dal
     CENTRO GEOGRAFICO del Giappone - le montagne del Gunma, mille metri di
     quota. Le previsioni erano giuste, era il posto a essere sbagliato, e uno
     leggeva otto gradi e neve mentre a Tokyo ce n'erano venti.
     Qui si guarda le COORDINATE che l'app chiede davvero, che e' l'unico modo
     di accorgersene. */
  const CENTRO_GIAPPONE = { lat: 36.5748, lng: 139.2394 };   // quello che risponde Nominatim per "Giappone"
  const KYOTO = { lat: 35.0116, lng: 135.7681 };

  async function chiediMeteo(giorni, extra) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', e => err.push('PAGEERROR: ' + e.message.split('\n')[0]));
    const chiamate = [];
    await page.route('**/leaflet@1.9.4/dist/leaflet.js', ro => ro.fulfill({
      status: 200, contentType: 'application/javascript', body: fs.readFileSync(leafletJs(), 'utf8') }));
    await page.route(/tile\.openstreetmap\.org/, ro => ro.abort());
    /* Il geocodificatore risponde come risponde quello vero a "Giappone":
       il paese, col suo centro geografico. */
    await page.route(/nominatim\.openstreetmap\.org/, ro => ro.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ lat: '36.5748', lon: '139.2394', addresstype: 'country',
        type: 'administrative', place_rank: 4, boundingbox: ['20.2', '45.7', '122.7', '154.2'],
        address: { country: 'Giappone', country_code: 'jp' }, name: 'Giappone' }]) }));
    await page.route(/api\.open-meteo\.com/, ro => {
      const u = ro.request().url();
      chiamate.push(u);
      const dd = (u.match(/start_date=(\d{4}-\d{2}-\d{2})/) || [])[1] || oggi;
      ro.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        daily: { time: [dd], weather_code: [71], temperature_2m_max: [1], temperature_2m_min: [-6],
                 precipitation_sum: [4], wind_speed_10m_max: [9],
                 sunset: [dd + 'T17:40'], sunrise: [dd + 'T06:30'] } }) });
    });
    await page.addInitScript(s => localStorage.setItem('geppgo2', JSON.stringify(s)), {
      trips: [Object.assign({
        id: 1, name: 'Giappone 26', destination: 'Giappone', currency: 'JPY', status: 'open',
        start: oggi, end: domani, participants: [{ id: 1, name: 'Gepp', isMe: true }],
        pois: [], expenses: [], tickets: [], hotels: [], weather: {}, createdAt: 1, days: giorni
      }, extra || {})],
      currentTripId: 1, settings: {}, myName: 'Gepp', skipAuth: true });
    await page.goto(APP, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof refreshWeather === 'function', { timeout: 20000 });
    await page.evaluate(async () => { await ensureDestLoc(T()); await refreshWeather(); });
    await page.waitForTimeout(700);
    const dove = await page.evaluate(() => {
      const t = T(), d = t.days[0];
      return { luogo: (t.weather[d.date] || {}).luogo || '', vicino: !!(t.weather[d.date] || {}).vicino,
               cè: !!t.weather[d.date], destLoc: t.destLoc, tipo: t.destTipo,
               perche: percheNienteMeteo(t) };
    });
    await page.close();
    const coord = chiamate.map(u => {
      const m = u.match(/latitude=([-\d.]+)&longitude=([-\d.]+)/);
      return m ? { lat: +m[1], lng: +m[2] } : null;
    }).filter(Boolean);
    return { coord, dove };
  }
  const vicino = (c, p) => Math.abs(c.lat - p.lat) < 0.05 && Math.abs(c.lng - p.lng) < 0.05;

  /* Giornata vuota, destinazione "Giappone", nient'altro: prima si andava a
     prendere il meteo in mezzo alle montagne. Adesso non si va da nessuna
     parte, e si dice perche'. */
  const soloPaese = await chiediMeteo([{ id: 'd1', date: oggi, title: '', activities: [] }]);
  ok('un paese intero non è un posto da cui prendere il meteo',
     !soloPaese.coord.some(c => vicino(c, CENTRO_GIAPPONE)),
     soloPaese.coord.map(c => c.lat + ',' + c.lng).join(' | ') || 'nessuna chiamata');
  ok('e invece di un numero sbagliato si dice cosa manca',
     /paese intero/i.test(soloPaese.dove.perche) && soloPaese.dove.cè === false,
     soloPaese.dove.perche || 'niente');

  /* Ma se il viaggio HA delle tappe, anche in un altro giorno, quelle
     valgono: il meteo di Kyoto e' una risposta, quello del centro del
     Giappone no. */
  const conTappe = await chiediMeteo([
    { id: 'd1', date: oggi, title: '', activities: [] },
    { id: 'd2', date: domani, title: '', activities: [
      { id: 21, name: 'Fushimi Inari', time: '10:00', timeEnd: '12:00',
        lat: KYOTO.lat, lng: KYOTO.lng, who: [1], completed: false, type: 'outdoor',
        booking: { needed: false, done: false } }] }]);
  ok('per una giornata vuota si guardano le tappe dei giorni intorno',
     conTappe.coord.some(c => vicino(c, KYOTO)) && !conTappe.coord.some(c => vicino(c, CENTRO_GIAPPONE)),
     conTappe.coord.map(c => c.lat.toFixed(3) + ',' + c.lng.toFixed(3)).join(' | '));
  ok('e si dice che è un\'approssimazione, non una certezza',
     conTappe.dove.vicino === true, 'vicino=' + conTappe.dove.vicino);

  // ══ la barra in basso ha una voce in meno ════════════════════════════
  page = await apri(stato({ [oggi]: wx(0, 24, 14, 0) }));
  const barra = await page.evaluate(() => ({
    voci: [...document.querySelectorAll('.nav-item')].map(n => n.dataset.p),
    paginaMeteo: !!document.getElementById('weather'),
    tendina: !!document.getElementById('mMeteo')
  }));
  ok('il meteo non è più una voce della barra in basso',
     !barra.voci.includes('weather'), barra.voci.join(' '));
  ok('e la barra è scesa a otto voci', barra.voci.length === 8, barra.voci.length + ' voci');
  ok('la vecchia pagina del meteo non c\'è più', barra.paginaMeteo === false);
  ok('ma il meteo c\'è, nella tendina', barra.tendina === true);
  /* Il pezzo che tiene in piedi il resto: la barra in basso non ha più una
     voce per il meteo, quindi se sparisse anche la porta in cima al meteo
     non ci si arriverebbe più da nessuna parte. */
  const porta = await page.evaluate(() => ({
    grado: !!document.querySelector('.hh-grado[onclick*="apriMeteo"]'),
    striscia: !!document.querySelector('.hh-tripbar[onclick*="meteoDaBarra"]')
  }));
  ok('e la porta per arrivarci è in cima alla home, sulla striscia del cielo',
     porta.grado === true && porta.striscia === true,
     `temperatura ${porta.grado}, striscia ${porta.striscia}`);
  await page.close();

  await browser.close();
  for (const e of err) r.push(' FALLITO  ' + e);
  const passati = r.filter(x => x.startsWith('  OK')).length;
  console.log(r.join('\n'));
  console.log(`\n${passati}/${r.length} passati`);
  process.exit(passati === r.length ? 0 : 1);
})();
