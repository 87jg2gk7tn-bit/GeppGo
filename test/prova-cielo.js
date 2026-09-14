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

  // ══ la riga in cima: i nomi, il "+", il cielo ═════════════════════════
  let page = await apri(stato({ [oggi]: wx(0, 24, 14, 0) }));
  const riga = await page.evaluate(() => {
    const barra = document.querySelector('.hh-tripbar');
    const fila = document.querySelector('.hh-trips');
    const piu = document.querySelector('.hh-trip-add');
    const cielo = document.querySelector('.hh-cielo');
    const b = x => x ? x.getBoundingClientRect() : null;
    const rb = b(barra), rf = b(fila), rp = b(piu), rc = b(cielo);
    return {
      cielaCè: !!cielo, tag: cielo && cielo.tagName,
      piuCè: !!piu,
      piuDentroLoScorrevole: !!(piu && fila && fila.contains(piu)),
      piuDopoINomi: !!(rp && rf && rp.left >= rf.right - 1),
      piuPrimaDelCielo: !!(rp && rc && rp.right <= rc.left + 1),
      piuNellaBarra: !!(rp && rb && rp.left >= rb.left - .5 && rp.right <= rb.right + .5),
      cieloAlBordo: !!(rc && rb && Math.abs(rc.right - rb.right) < 1.5),
      altoCielo: Math.round(rc.height), largoCielo: Math.round(rc.width),
      quantiViaggi: document.querySelectorAll('.hh-trip').length,
      filaScorre: getComputedStyle(fila).overflowX,
      maschera: getComputedStyle(fila).maskImage || getComputedStyle(fila).webkitMaskImage || '',
      vsx: parseFloat(getComputedStyle(fila).getPropertyValue('--vsx')) || 0,
      vdx: parseFloat(getComputedStyle(fila).getPropertyValue('--vdx')) || 0
    };
  });
  ok('il riquadro del cielo c\'è, in cima alla home', riga.cielaCè === true);
  ok('ed è un tasto vero, non un cartello', riga.tag === 'BUTTON', String(riga.tag));
  ok('il "+" c\'è ancora', riga.piuCè === true);
  /* Il punto della modifica: il "+" stava all'estremo destro, staccato dai
     nomi a cui appartiene. Adesso gli sta appiccicato. */
  ok('il "+" sta subito dopo i nomi dei viaggi', riga.piuDopoINomi === true);
  ok('e prima del cielo, non dall\'altra parte', riga.piuPrimaDelCielo === true);
  /* E resta fuori dallo scorrevole apposta: se scorresse coi nomi, con tre
     viaggi in lista non lo vedresti mai. */
  ok('il "+" non scorre insieme ai nomi', riga.piuDentroLoScorrevole === false);
  ok('con tre viaggi in lista si vede lo stesso', riga.quantiViaggi === 3 && riga.piuNellaBarra === true,
     riga.quantiViaggi + ' viaggi');
  /* Quanto sono grandi sotto il dito lo misura prova-tocchi, che tiene
     conto dell'area invisibile intorno e di dove viene tagliata. Qui basta
     che il cielo sia alto di suo: non ha bisogno di allargamenti. */
  ok('il cielo è alto abbastanza per un dito senza trucchi', riga.altoCielo >= 44, riga.altoCielo + ' px');
  ok('il cielo sta all\'altro capo della riga', riga.cieloAlBordo === true);
  ok('ed è largo abbastanza da guardarlo', riga.largoCielo >= 90, riga.largoCielo + ' px');
  /* I nomi si tagliavano di netto contro il "+": un nome mozzato sembra un
     difetto, un nome che sfuma dice "scorri". */
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

  // ══ il cielo segue il tempo che fa, misurato ══════════════════════════
  const cielo = await page.evaluate(([luce]) => {
    const el = document.querySelector('.hh-cielo');
    return { classi: el.className, luce: eval(luce)(el), testo: el.innerText.trim(),
             sole: !!el.querySelector('.cl-astro'), nuvole: el.querySelectorAll('.cl-nuv').length,
             pioggia: !!el.querySelector('.cl-pio') };
  }, [LUCE]);
  ok('col sole il cielo è sereno', /c-sereno/.test(cielo.classi), cielo.classi);
  ok('e c\'è il sole disegnato, senza nuvole davanti',
     cielo.sole === true && cielo.nuvole === 0, `sole ${cielo.sole}, nuvole ${cielo.nuvole}`);
  ok('e dice la temperatura di quel giorno', cielo.testo === '24°', cielo.testo);
  const luceSereno = cielo.luce;
  await page.close();

  page = await apri(stato({ [oggi]: wx(63, 13, 8, 14) }));
  const pioggia = await page.evaluate(([luce]) => {
    const el = document.querySelector('.hh-cielo');
    return { classi: el.className, luce: eval(luce)(el),
             pioggia: !!el.querySelector('.cl-pio'), sole: !!el.querySelector('.cl-astro') };
  }, [LUCE]);
  ok('con la pioggia il cielo è di pioggia', /c-pioggia/.test(pioggia.classi), pioggia.classi);
  ok('e la pioggia è disegnata', pioggia.pioggia === true);
  ok('e il sole non c\'è: dietro le nuvole non lo vedresti', pioggia.sole === false);
  ok('e il cielo è più scuro di quando c\'è il sole', pioggia.luce < luceSereno - 15,
     `pioggia ${pioggia.luce}, sereno ${luceSereno}`);
  await page.close();

  page = await apri(stato({ [oggi]: wx(73, 1, -5, 6) }));
  const neve = await page.evaluate(() => {
    const el = document.querySelector('.hh-cielo');
    return { classi: el.className, fiocchi: !!el.querySelector('.cl-nev') };
  });
  ok('con la neve il cielo è di neve', /c-neve/.test(neve.classi) && neve.fiocchi === true, neve.classi);
  await page.close();

  page = await apri(stato({ [oggi]: wx(95, 20, 15, 22) }));
  const tempo = await page.evaluate(() => {
    const el = document.querySelector('.hh-cielo');
    return { classi: el.className, lampo: !!el.querySelector('.cl-lampo'), pioggia: !!el.querySelector('.cl-pio') };
  });
  ok('col temporale il cielo è di temporale', /c-tempo/.test(tempo.classi), tempo.classi);
  ok('e ci sono il lampo e la pioggia', tempo.lampo === true && tempo.pioggia === true);
  await page.close();

  // ══ di notte ═════════════════════════════════════════════════════════
  /* Il tramonto messo all'una di notte vuol dire che a quest'ora, qualunque
     ora sia, il sole è già sceso. */
  page = await apri(stato({ [oggi]: wx(0, 24, 14, 0, '00:01', '00:00') }));
  const notte = await page.evaluate(([luce]) => {
    const el = document.querySelector('.hh-cielo');
    return { classi: el.className, luce: eval(luce)(el), stelle: !!el.querySelector('.cl-stelle') };
  }, [LUCE]);
  ok('dopo il tramonto il cielo è di notte', /\bnotte\b/.test(notte.classi), notte.classi);
  ok('e di notte è scuro davvero, non solo di nome', notte.luce < 90,
     `luce ${notte.luce} contro ${luceSereno} di giorno`);
  ok('e ci sono le stelle', notte.stelle === true);
  await page.close();

  /* Un giorno futuro non è mai notte: l'ora di adesso non dice niente su
     giovedì, e disegnarci la luna sopra sarebbe una bugia. */
  page = await apri(stato({ [domani]: wx(0, 22, 12, 0, '00:01', '00:00') },
    [{ id: 'd1', date: domani, title: '', activities: [] }]));
  const futuro = await page.evaluate(() => document.querySelector('.hh-cielo').className);
  ok('su un giorno futuro non è mai notte, a qualunque ora si guardi',
     !/\bnotte\b/.test(futuro), futuro);
  await page.close();

  // ══ quando la previsione non c'è ═════════════════════════════════════
  page = await apri(stato({}, [{ id: 'd1', date: lontano, title: '', activities: [] }]));
  const vuoto = await page.evaluate(() => {
    const el = document.querySelector('.hh-cielo');
    return { classi: el.className, testo: el.innerText.trim(), sole: !!el.querySelector('.cl-astro') };
  });
  ok('oltre le previsioni il riquadro dice fra quanto arrivano',
     /^fra \d+ gg$/.test(vuoto.testo), vuoto.testo);
  ok('e non si inventa il sole su un tempo che non sa',
     vuoto.sole === false && /c-ignoto/.test(vuoto.classi), vuoto.classi);
  await page.close();

  // ══ aprire il meteo ══════════════════════════════════════════════════
  page = await apri(stato({ [oggi]: wx(61, 18, 9, 6), [domani]: wx(0, 23, 12, 0) }));
  const apertura = await page.evaluate(async () => {
    const attendi = ms => new Promise(r2 => setTimeout(r2, ms));
    const aperta = () => document.getElementById('mMeteo').classList.contains('active');
    const tocca = el => { const b = el.getBoundingClientRect();
      const e = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); if (e) e.click(); };
    const out = {};
    tocca(document.querySelector('.hh-cielo'));
    await attendi(400); out.colCielo = aperta();
    closeSheet('mMeteo'); await attendi(500);
    /* Lo spazio fra il "+" e il cielo non è un buco: è ancora la striscia
       del meteo, e toccandolo si apre. */
    const barra = document.querySelector('.hh-tripbar'),
          piu = document.querySelector('.hh-trip-add'), ci = document.querySelector('.hh-cielo');
    const bp = piu.getBoundingClientRect(), bc = ci.getBoundingClientRect(), bb = barra.getBoundingClientRect();
    out.cèSpazio = bc.left - bp.right > 6;
    const e = document.elementFromPoint((bp.right + bc.left) / 2, bb.top + bb.height / 2);
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
  ok('toccando il cielo si apre il meteo', apertura.colCielo === true);
  ok('fra il "+" e il cielo c\'è dello spazio', apertura.cèSpazio === true);
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
  /* Il pezzo che tiene in piedi il resto: se un giorno sparisse anche il
     riquadro, al meteo non ci si arriverebbe più da nessuna parte. */
  ok('e l\'unica porta per arrivarci è il riquadro in cima',
     await page.evaluate(() => !!document.querySelector('.hh-cielo[onclick*="apriMeteo"]')));
  await page.close();

  await browser.close();
  for (const e of err) r.push(' FALLITO  ' + e);
  const passati = r.filter(x => x.startsWith('  OK')).length;
  console.log(r.join('\n'));
  console.log(`\n${passati}/${r.length} passati`);
  process.exit(passati === r.length ? 0 : 1);
})();
