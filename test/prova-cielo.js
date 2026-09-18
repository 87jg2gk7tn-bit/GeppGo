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

/* Le date del viaggio finto le costruisce Node, ma a guardarle è il
   browser un istante dopo: a cavallo della mezzanotte sono due giorni
   diversi, e il viaggio «di oggi» arriva in pagina già datato ieri. Non è
   teoria — su CI, in una corsa partita alle 23:58 e finita alle 00:05, il
   meteo di oggi è diventato il meteo di ieri e tre righe sono andate
   rosse per niente.
   Qui l'oggi di Node viene riscritto con l'oggi del BROWSER al momento in
   cui lo stato entra nel telefono finto: le due date non possono più
   scollarsi. Si usa la data locale, che è quella con cui l'app ragiona. */
const terzo = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
const lontano = new Date(Date.now() + 40 * 864e5).toISOString().slice(0, 10);
/* Una passata sola, con una tabella: sostituendo una data per volta la
   seconda sostituzione si mangerebbe quello che ha appena scritto la
   prima (oggi diventa domani, e poi domani diventa dopodomani). */
const metti = (page, st) => page.addInitScript(([s, quali]) => {
  const g = n => {
    const d = new Date(Date.now() + n * 864e5);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  };
  const tab = {};
  quali.forEach(([vecchia, quanti]) => { tab[vecchia] = g(quanti); });
  localStorage.setItem('geppgo2',
    JSON.stringify(s).replace(/\d{4}-\d{2}-\d{2}/g, d => tab[d] || d));
}, [st, [[oggi, 0], [domani, 1], [terzo, 2], [lontano, 40]]]);

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
    await metti(page, st);
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
  /* La riga va misurata quando ha finito di prendere le sue misure. Se la
     si interroga mentre si sta ancora assestando - i caratteri che
     arrivano, il cielo che si disegna - si legge una fila che NON sborda,
     e allora le sfumature sono spente tutte e due: la prova dice «0px,
     0px» senza che niente sia rotto. Su un runner lento è successo
     davvero, e su un altro identico no. */
  /* I NOMI DEI VIAGGI NON SONO PIÙ QUI, e questo blocco l'ho riscritto
     invece di aggirarlo. C'era una fila di pillole scorrevoli con le
     sfumature ai bordi, il "+" in coda e la temperatura all'altro capo:
     una riga intera, quarantaquattro pixel più i margini, per una cosa
     che si fa una volta ogni tanto. A pagarla era la mappa, che restava
     sotto la piega. Adesso i viaggi stanno dietro le tre righine in alto
     a sinistra, e in cima alla home resta la sola temperatura. */
  const riga = await page.evaluate(() => {
    const grado = document.querySelector('.hh-grado');
    const st = grado ? getComputedStyle(grado) : null;
    return {
      gradoCè: !!grado, tag: grado && grado.tagName, testo: grado && grado.textContent.trim(),
      /* Il riquadro non deve tornare: era la cosa di troppo. */
      niente_riquadro: !document.querySelector('.hh-cielo'),
      senzaScatola: !!st && st.borderTopWidth === '0px' &&
                    (st.backgroundImage === 'none') &&
                    /rgba\(0, 0, 0, 0\)|transparent/.test(st.backgroundColor),
      /* Le pillole non devono tornare: erano la riga che costava la mappa. */
      nienteFila: !document.querySelector('#homeHero .hh-trip, #homeHero .hh-trips'),
      menuCè: !!document.querySelector('#menuViaggi'),
      menuASinistra: (() => {
        const m = document.getElementById('menuViaggi');
        if (!m) return false;
        const r = m.getBoundingClientRect();
        const b = document.querySelector('.brand');
        return r.left < 20 && (!b || r.right <= b.getBoundingClientRect().left + 1);
      })()
    };
  });
  ok('la temperatura c\'è, in cima alla home', riga.gradoCè === true);
  ok('ed è un tasto vero, non un cartello', riga.tag === 'BUTTON', String(riga.tag));
  ok('dice la temperatura di quel giorno', riga.testo === '24°', riga.testo);
  /* Il punto della modifica chiesta: il riquadro non c'è più, il numero sta
     sul cielo come ci sta il titolo. */
  ok('e non è dentro un riquadro: niente bordo, niente fondo', riga.senzaScatola === true);
  ok('il riquadro di prima non c\'è più', riga.niente_riquadro === true);
  ok('la fila dei nomi dei viaggi non è più in home', riga.nienteFila === true);
  ok('e al suo posto ci sono le tre righine, in alto a sinistra',
     riga.menuCè === true && riga.menuASinistra === true);

  /* La tendina: tutti i viaggi in corso, quello che stai guardando
     segnato, e il modo di farne uno nuovo. Se mancasse una delle tre
     cose, dei viaggi non si saprebbe più come uscire. */
  const tendina = await page.evaluate(async () => {
    document.getElementById('menuViaggi').click();
    await new Promise(r2 => setTimeout(r2, 500));
    const m = document.getElementById('mViaggi');
    const voci = [...document.querySelectorAll('#vgLista .vg-voce')];
    return {
      aperta: !!m && m.classList.contains('active'),
      quanti: voci.length,
      nomi: voci.map(x => (x.querySelector('b') || {}).textContent || ''),
      segnati: voci.filter(x => x.classList.contains('qui')).length,
      nuovo: !!document.querySelector('#mViaggi .vg-nuovo')
    };
  });
  ok('le tre righine aprono i viaggi', tendina.aperta === true);
  ok('e ci sono tutti e tre', tendina.quanti === 3, tendina.quanti + ': ' + tendina.nomi.join(' | '));
  ok('quello che stai guardando è segnato, uno solo', tendina.segnati === 1, tendina.segnati + ' segnati');
  ok('e da lì si aggiunge un viaggio', tendina.nuovo === true);

  /* NON È UNA TENDINA DAL BASSO: è un pannello che esce da sinistra, alto
     quanto la pagina. Si misura il movimento vero — dove sta il bordo
     sinistro prima e dopo — perché una classe si può mettere anche su un
     foglio che continua a salire dal fondo. */
  const movimento = await page.evaluate(async () => {
    closeSheet('mViaggi');
    await new Promise(r2 => setTimeout(r2, 500));
    const c = () => document.querySelector('#mViaggi .cassetto');
    const fermo = c() ? c().getBoundingClientRect() : null;
    document.getElementById('menuViaggi').click();
    await new Promise(r2 => setTimeout(r2, 60));
    const meta = c().getBoundingClientRect();
    await new Promise(r2 => setTimeout(r2, 600));
    const fine = c().getBoundingClientRect();
    return {
      partivaDaFuori: !!fermo && Math.round(fermo.width) === 0,
      /* Mentre esce il bordo sinistro si sta ancora muovendo verso lo zero:
         se salisse dal basso, il bordo sinistro non cambierebbe affatto. */
      inMovimento: Math.abs(Math.round(meta.left)) > 2 || Math.abs(Math.round(meta.top)) > 2,
      sxFinale: Math.round(fine.left),
      alto: Math.round(fine.height),
      schermo: Math.round(innerHeight),
      /* Non prende tutta la larghezza: la striscia scoperta è il modo di
         chiuderlo senza cercare niente. */
      largo: Math.round(fine.width)
    };
  });
  ok('il pannello parte da fuori schermo', movimento.partivaDaFuori === true);
  ok('e si muove entrando, invece di salire dal basso', movimento.inMovimento === true);
  ok('arriva attaccato al bordo sinistro', movimento.sxFinale === 0, movimento.sxFinale + 'px');
  ok('ed è alto quanto la pagina', Math.abs(movimento.alto - movimento.schermo) <= 2,
     movimento.alto + ' su ' + movimento.schermo);
  ok('ma non larga quanto la pagina: resta una striscia da toccare',
     movimento.largo > 200 && movimento.largo < 380, movimento.largo + 'px');

  /* IL DIFETTO CHE QUESTA RIGA HA TROVATO, e che una prova scritta male non
     avrebbe visto: col pannello fuori, le tre righine della PAGINA ci
     finiscono sotto. Premendole da codice — menuViaggi.click() — si chiude
     lo stesso, perché il click non passa dal dito; premendole davvero si
     tocca quello che sta sopra, cioè il titolo, e il pannello resta lì.
     Quindi non si chiede «esiste il tasto»: si chiede CHI C'È SOTTO IL
     DITO, e si preme quello. */
  const ritocco = await page.evaluate(async () => {
    const m = document.getElementById('menuViaggi').getBoundingClientRect();
    const sotto = document.elementFromPoint(m.left + m.width / 2, m.top + m.height / 2);
    const chi = sotto ? (sotto.closest('button') || sotto) : null;
    if (chi && chi.click) chi.click();
    await new Promise(r2 => setTimeout(r2, 600));
    return { chiuso: !document.getElementById('mViaggi').classList.contains('active'),
             cosaCera: chi ? (chi.getAttribute('aria-label') || chi.className || chi.tagName) : 'niente' };
  });
  ok('ritoccando le righine il pannello si riassorbe',
     ritocco.chiuso === true, 'sotto il dito c\'era: ' + ritocco.cosaCera);

  /* E toccando fuori dal pannello, sulla striscia di pagina che resta. */
  const fuori = await page.evaluate(async () => {
    document.getElementById('menuViaggi').click();
    await new Promise(r2 => setTimeout(r2, 600));
    const m = document.getElementById('mViaggi');
    const r = m.getBoundingClientRect();
    const e = document.elementFromPoint(r.right - 18, r.top + r.height / 2);
    if (e) e.click();
    await new Promise(r2 => setTimeout(r2, 600));
    return !m.classList.contains('active');
  });
  ok('e toccando fuori si riassorbe lo stesso', fuori === true);

  await page.evaluate(async () => {
    document.getElementById('menuViaggi').click();
    await new Promise(r2 => setTimeout(r2, 500));
  });
  /* Toccare un viaggio deve cambiare viaggio davvero, non solo chiudere
     la tendina: e' l'unica strada rimasta per passare da uno all'altro. */
  const cambiato = await page.evaluate(async () => {
    const altro = [...document.querySelectorAll('#vgLista .vg-voce')].find(x => !x.classList.contains('qui'));
    if (!altro) return null;
    altro.click();
    await new Promise(r2 => setTimeout(r2, 600));
    return { id: T().id, chiusa: !document.getElementById('mViaggi').classList.contains('active') };
  });
  ok('toccandone uno si cambia viaggio', !!cambiato && cambiato.id !== 1, cambiato ? 'viaggio ' + cambiato.id : 'nessuna voce');
  ok('e la tendina si chiude', !!cambiato && cambiato.chiusa === true);
  await page.close();
  page = await apri(stato({ [oggi]: wx(0, 24, 14, 0) }));

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
  /* Il sole sta SOTTO il bordo, non a cavallo. Partiva quattro pixel sopra
     l'inizio del velo e la linea in alto lo tagliava di netto — insieme
     all'alone, che è la parte che lo fa sembrare luce. E non deve finire
     addosso né alle pillole dei viaggi né alla temperatura: un sole mezzo
     coperto da un'altra cosa non sembra un sole, sembra uno sbaglio. */
  const astro = await page.evaluate(() => {
    const velo = document.querySelector('.hh-velo');
    const sole = document.querySelector('.hh-velo .cl-astro');
    const grado = document.querySelector('.hh-grado');
    const occhiello = document.querySelector('.hh-eyebrow');
    if (!velo || !sole) return { cè: false };
    const v = velo.getBoundingClientRect(), s2 = sole.getBoundingClientRect();
    const o = occhiello && occhiello.getBoundingClientRect(), g = grado && grado.getBoundingClientRect();
    return {
      cè: true,
      ariaSopra: Math.round(s2.top - v.top),
      /* Le pillole dei viaggi non ci sono più: sotto il sole adesso c'è
         l'occhiello col nome del viaggio, ed è quello a non doversi
         prendere il sole in faccia. */
      ariaSotto: o ? Math.round(o.top - s2.bottom) : null,
      distanzaGrado: g ? Math.round(g.left - s2.right) : null,
      largo: Math.round(s2.width)
    };
  });
  ok('il sole sta tutto dentro, non a cavallo della linea in alto',
     astro.cè === true && astro.ariaSopra >= 4, astro.ariaSopra + 'px d\'aria sopra');
  ok('e non finisce addosso al nome del viaggio',
     astro.ariaSotto !== null && astro.ariaSotto >= 6, astro.ariaSotto + 'px prima dell\'occhiello');
  ok('né addosso alla temperatura',
     astro.distanzaGrado !== null && astro.distanzaGrado >= 12,
     astro.distanzaGrado + 'px dalla temperatura');
  ok('e il tondo decorativo si spegne', sfondo.tondoSpento === true);
  await page.close();

  // ══ e cambia davvero col tempo che fa, misurato ══════════════════════
  /* Quattro millimetri: pioggia normale. Il caso "forte" viene subito
     dopo, con ventidue, e le due cose devono vedersi diverse. */
  page = await apri(stato({ [oggi]: wx(63, 13, 8, 4) }));
  const pioggia = await page.evaluate(([luce]) => {
    const hh = document.querySelector('.hh');
    /* Le pillole dei viaggi non ci sono più: quello che sta sul cielo e
       deve restare leggibile adesso è il tasto della ricerca. */
    const sopra = document.querySelector('#homeHero .hh-cerca');
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
             inchiostroSopra: sopra ? getComputedStyle(sopra).color : '' };
  }, [LUCE]);
  ok('con la pioggia il cielo è di pioggia', /c-pioggia/.test(pioggia.classi), pioggia.classi);
  /* Prima erano trattini tutti uguali che scendevano alla stessa velocità:
     una grata che si muove, non pioggia. Quello che mancava non era la
     velocità, era la VARIETÀ. */
  ok('la pioggia è fatta di gocce, una per una', pioggia.gocce > 12, pioggia.gocce + ' gocce');
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
  /* Il confronto fra i cieli NON si fa su due pagine vive: quelle si portano
     dietro l'orologio della macchina, e dopo il tramonto il cielo di pioggia
     è più CHIARO di quello sereno — le nuvole rimandano giù la luce, è fisica
     giusta e prova sbagliata. Costata una riga rossa alle nove di sera.
     Le tavolozze si misurano su elementi costruiti apposta: giorno contro
     giorno, notte contro notte, e l'ora che è non c'entra più niente. */
  const tavolozza = await page.evaluate(([luce]) => {
    const fai = cls => {
      const d = document.createElement('div');
      d.className = cls; d.style.position = 'absolute'; d.style.left = '-9999px';
      document.body.appendChild(d);
      const v = eval(luce)(d); d.remove(); return v;
    };
    return { sereno: fai('cielo c-sereno'), velato: fai('cielo c-velato'),
             pioggia: fai('cielo c-pioggia'), tempo: fai('cielo c-tempo'),
             serenoNotte: fai('cielo c-sereno notte') };
  }, [LUCE]);
  ok('di giorno il cielo di pioggia è più scuro di quello sereno',
     tavolozza.pioggia < tavolozza.sereno - 15,
     `pioggia ${tavolozza.pioggia}, sereno ${tavolozza.sereno}`);
  ok('e quello del temporale è più scuro ancora',
     tavolozza.tempo < tavolozza.pioggia - 10,
     `temporale ${tavolozza.tempo}, pioggia ${tavolozza.pioggia}`);
  ok('e la notte è più scura del giorno, a parità di tempo che fa',
     tavolozza.serenoNotte < tavolozza.sereno - 40,
     `notte ${tavolozza.serenoNotte}, giorno ${tavolozza.sereno}`);
  /* Se il cielo in alto si fa scuro, quello che ci sta sopra deve
     schiarirsi: inchiostro tenue su un temporale non si legge più. */
  ok('e quello che ci sta sopra passa all\'inchiostro chiaro',
     /cl-buio/.test(pioggia.classi) && /255, 255, 255/.test(pioggia.inchiostroSopra),
     pioggia.inchiostroSopra);
  await page.close();

  /* QUANTA pioggia si vede dipende da quanta ne cade, e non a due gradini:
     era un interruttore sopra/sotto gli otto millimetri, e due posizioni non
     sono il tempo che fa. Fra una pioggerella da mezzo millimetro e un
     diluvio da venticinque uno distingue guardando fuori dalla finestra, e
     la schermata deve distinguere anche lei. */
  const quanteCon = async (mm) => {
    const p2 = await apri(stato({ [oggi]: wx(mm > 2 ? 65 : 51, 14, 9, mm) }));
    const n = await p2.evaluate(() => document.querySelectorAll('.hh-velo .cl-g').length);
    await p2.close();
    return n;
  };
  const scala = [];
  for (const mm of [0.3, 2, 6, 14, 25]) scala.push({ mm, n: await quanteCon(mm) });
  const dettaglio = scala.map(x => x.mm + 'mm→' + x.n).join('  ');
  /* Cresce sempre: più millimetri, più gocce. Nessun gradino all'indietro. */
  let sempreSu = true;
  for (let i = 1; i < scala.length; i++) if (scala[i].n <= scala[i - 1].n) sempreSu = false;
  ok('più millimetri cadono, più gocce si vedono — senza mai tornare indietro',
     sempreSu === true, dettaglio);
  /* E la differenza fra poco e tanto si deve VEDERE, non essere una
     sfumatura: da mezzo millimetro a venticinque le gocce devono almeno
     triplicare. */
  ok('e fra una pioggerella e un diluvio la differenza si vede',
     scala[scala.length - 1].n >= scala[0].n * 3, dettaglio);
  /* Un codice di pioggia con zero millimetri capita — le pioggerelle che non
     bagnano. Qualcosa si deve vedere lo stesso: se no la schermata dice
     "pioggia" e non piove. */
  const zero = await quanteCon(0);
  ok('e se il codice dice pioggia ma i millimetri sono zero, qualcosa si vede',
     zero >= 4 && zero <= 10, zero + ' gocce');

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
     typeof notte.luce === 'number' && notte.luce < 90, 'luce ' + notte.luce);
  ok('e ci sono le stelle e la luna', notte.stelle === true && notte.luna === true);
  await page.close();

  /* QUESTA PROVA CONTENEVA LA SCELTA SBAGLIATA, e andava cambiata, non
     aggirata. Diceva: «su un giorno futuro non è mai notte», perché l'ora
     di adesso non dice niente su giovedì. Il ragionamento filava e il
     risultato era sbagliato: un viaggio a Parigi fra tre giorni, aperto
     alle due di notte, mostrava un sole pieno in cima allo schermo. Chi
     guarda lo guarda ADESSO.
     Adesso la regola è: la luce segue l'ora del posto, il tempo che fa
     segue la giornata che stai guardando. Le due cose si misurano
     separate, perché è proprio la loro combinazione che prima non
     esisteva. Il posto è messo a mezzanotte e mezza col fuso, così la
     prova dice la stessa cosa a qualunque ora giri. */
  const mezzanotteEMezza = (() => {
    const o = new Date();
    return Math.round((0.5 - (o.getUTCHours() + o.getUTCMinutes() / 60 + o.getUTCSeconds() / 3600)) * 3600);
  })();
  page = await apri(stato({
    [domani]: Object.assign(wx(61, 22, 12, 6, '20:05', '07:15'), { scarto: mezzanotteEMezza })
  }, [{ id: 'd1', date: domani, title: '', activities: [] }]));
  const futuro = await page.evaluate(() => ({
    classi: document.querySelector('.hh').className,
    oraLì: adessoNelPosto(T().weather[Object.keys(T().weather)[0]]).hhmm
  }));
  ok('di notte il cielo è notturno anche su una giornata futura',
     /\bnotte\b/.test(futuro.classi), futuro.classi + ' · lì sono le ' + futuro.oraLì);
  /* E la metà che NON deve seguire l'orologio: che piova lo dice la
     giornata che guardi, non l'ora che è. */
  ok('e il tempo che fa resta quello di quella giornata',
     /c-pioggia/.test(futuro.classi), futuro.classi);
  await page.close();

  /* Lo stesso giorno futuro, ma con il posto in pieno pomeriggio: il
     cielo torna diurno. Senza questa riga la prova di sopra passerebbe
     anche su un'app che disegna sempre la notte. */
  const pomeriggio = (() => {
    const o = new Date();
    return Math.round((15 - (o.getUTCHours() + o.getUTCMinutes() / 60 + o.getUTCSeconds() / 3600)) * 3600);
  })();
  page = await apri(stato({
    [domani]: Object.assign(wx(61, 22, 12, 6, '20:05', '07:15'), { scarto: pomeriggio })
  }, [{ id: 'd1', date: domani, title: '', activities: [] }]));
  const futuroGiorno = await page.evaluate(() => document.querySelector('.hh').className);
  ok('e di pomeriggio, sulla stessa giornata, torna diurno',
     !/\bnotte\b/.test(futuroGiorno), futuroGiorno);
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
    /* La striscia dei nomi non c'è più, e con lei lo spazio vuoto che si
       poteva toccare: resta la temperatura, e la sua riga. */
    const riga = document.querySelector('.hh-grado-solo');
    out.cèRiga = !!riga;
    if (riga) {
      const br = riga.getBoundingClientRect();
      const e = document.elementFromPoint(br.left + 12, br.top + br.height / 2);
      if (e) e.click();
      await attendi(400);
    }
    out.colVuoto = aperta();
    closeSheet('mMeteo'); await attendi(500);
    return out;
  });
  ok('toccando la temperatura si apre il meteo', apertura.colGrado === true);
  ok('la temperatura ha una riga sua', apertura.cèRiga === true);
  ok('e toccandola di fianco si apre lo stesso', apertura.colVuoto === true);
  /* Il controllo «toccando un nome si cambia viaggio, non si apre il
     meteo» non ha più un soggetto: in cima i nomi non ci sono. Che
     toccarne uno cambi viaggio lo prova adesso la tendina, qui sopra. */
  await page.close();


  // ══ dentro la tendina ════════════════════════════════════════════════
  /* Il posto è messo alle 17:00 con lo scarto del fuso, e non è un
     capriccio: a mezzanotte «adesso» è la prima casella della fila e non
     c'è niente da scorrere, quindi la riga che controlla lo scorrimento
     passerebbe anche su un'app che non scorre affatto. Fissando l'ora del
     posto la prova dice qualcosa a qualunque ora giri. */
  const alleCinque = (() => {
    const o = new Date();
    return Math.round((17 - (o.getUTCHours() + o.getUTCMinutes() / 60 + o.getUTCSeconds() / 3600)) * 3600);
  })();
  page = await apri(stato({
    [oggi]: Object.assign(wx(61, 18, 9, 6), { scarto: alleCinque }),
    [domani]: wx(0, 23, 12, 0), [terzo]: wx(73, 2, -3, 4) }));
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
      /* La promessa non è «la fila è scorsa»: è che «adesso» si VEDA
         senza doverlo cercare. A mezzanotte adesso è la prima casella e
         non c'è niente da scorrere - la fila giusta ha scrollLeft 0 - e
         alle 23 la fila è già in fondo e non può scorrere oltre. In
         tutt'e due i casi la cosa che conta è la stessa: la casella sta
         dentro la finestra. */
      adessoSiVede: (() => {
        if (!fila || !adesso) return null;
        const f = fila.getBoundingClientRect(), x = adesso.getBoundingClientRect();
        return { dentro: x.left >= f.left - 2 && x.right <= f.right + 2,
                 dove: Math.round(x.left - f.left), largo: Math.round(f.width) };
      })(),
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
  ok('e «adesso» si vede senza doverlo cercare',
     !!(dentro.adessoSiVede && dentro.adessoSiVede.dentro),
     dentro.adessoSiVede ? `a ${dentro.adessoSiVede.dove}px dal bordo, su ${dentro.adessoSiVede.largo}px` : 'manca');
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
    await metti(page, {
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

  // ══ QUANTO DURA UNA PREVISIONE ═══════════════════════════════════════
  /* Il difetto piu' silenzioso che il meteo abbia avuto: una volta
     scaricata, una previsione non si aggiornava MAI piu' — solo cambiando le
     tappe o premendo il tasto a mano. Cosi' una previsione per domani presa
     una settimana fa restava a schermo con l'aria di essere fresca, e uno ci
     fa la valigia. */
  async function conPrevisione(vecchiaDiOre) {
    const page2 = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page2.on('pageerror', e => err.push('PAGEERROR: ' + e.message.split('\n')[0]));
    const chiamate = [];
    await page2.route('**/leaflet@1.9.4/dist/leaflet.js', ro => ro.fulfill({
      status: 200, contentType: 'application/javascript', body: fs.readFileSync(leafletJs(), 'utf8') }));
    await page2.route(/tile\.openstreetmap\.org/, ro => ro.abort());
    await page2.route(/nominatim\.openstreetmap\.org/, ro => ro.abort());
    await page2.route(/api\.open-meteo\.com/, ro => {
      chiamate.push(ro.request().url());
      ro.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        daily: { time: [oggi], weather_code: [0], temperature_2m_max: [26], temperature_2m_min: [15],
                 precipitation_sum: [0], wind_speed_10m_max: [6],
                 sunset: [oggi + 'T20:30'], sunrise: [oggi + 'T06:20'] },
               /* La risposta vera li porta sempre, perche' la chiediamo con
                  timezone=auto: la finta deve somigliarle. */
               timezone: 'Europe/Prague', utc_offset_seconds: 7200 }) });
    });
    /* Lo scarto c'e' perche' ce l'hanno le previsioni vere da quando le
       salviamo col fuso del posto. Senza, la previsione conterebbe come
       scaduta a prescindere - ed e' giusto che sia cosi', ma qui si sta
       misurando un'altra cosa: se una previsione FRESCA venga richiesta
       di nuovo per sbaglio. */
    const st = stato({ [oggi]: { code: 61, tempMax: 9, tempMin: 3, precipitation: 5, windSpeed: 12,
      sunset: oggi + 'T20:30', sunrise: oggi + 'T06:20', luogo: 'Praga',
      scarto: 7200, fuso: 'Europe/Prague', lat: 50.0755, lng: 14.4378, v: 2,
      preso: Date.now() - vecchiaDiOre * 3600 * 1000 } });
    await metti(page2, st);
    await page2.goto(APP, { waitUntil: 'domcontentloaded' });
    await page2.waitForFunction(() => typeof go === 'function', { timeout: 20000 });
    await page2.waitForTimeout(1400);
    const dopo = await page2.evaluate(() => {
      const t = T(), k = Object.keys(t.weather)[0];
      /* Se la funzione non c'è — il codice di prima non ce l'aveva — la prova
         deve DIRLO, non schiantarsi: un elenco spiega cosa manca. */
      const sc = (typeof meteoScaduto === 'function') ? meteoScaduto(t.weather[k], k) : 'manca meteoScaduto';
      return { temp: (t.weather[k] || {}).tempMax, scaduta: sc };
    });
    await page2.close();
    return { chiamate: chiamate.length, dopo };
  }

  /* Presa dieci minuti fa: va benissimo, non si tocca. Chiedere di nuovo
     sarebbe una chiamata sprecata a un'API che non e' nostra. */
  const fresca = await conPrevisione(0.17);
  ok('una previsione appena presa non si richiede', fresca.chiamate === 0,
     fresca.chiamate + ' chiamate');
  ok('e resta quella che c\'era', fresca.dopo.temp === 9, fresca.dopo.temp + '°');

  /* Presa sei ore fa, per OGGI: vecchia. Si rifa' da sola, senza che
     nessuno prema niente. */
  const vecchia = await conPrevisione(6);
  ok('una previsione di sei ore fa per oggi è scaduta e si rifà da sola',
     vecchia.chiamate > 0, vecchia.chiamate + ' chiamate');
  ok('e a schermo finisce quella nuova, non quella vecchia',
     vecchia.dopo.temp === 26, vecchia.dopo.temp + '° (la vecchia era 9°)');
  ok('e dopo non è più scaduta', vecchia.dopo.scaduta === false);

  /* Quanto regge dipende da quanto è vicino il giorno: per oggi tre ore sono
     tante, per fra dieci giorni mezza giornata va benissimo — più in là si
     guarda, meno cambia da un'ora all'altra. */
  /* Una pagina nuova: quella di prima l'ha chiusa la sezione precedente. */
  page = await apri(stato({ [oggi]: wx(0, 24, 14, 0) }));
  const durate = await page.evaluate(() => {
    if (typeof meteoScaduto !== 'function')
      return { oggiDueOre: null, oggiMezzOra: null, lontanoSeiOre: null,
               lontanoUnGiorno: null, senzaOra: null };
    const oggiD = new Date(); oggiD.setHours(0, 0, 0, 0);
    const giorno = n => new Date(oggiD.getTime() + n * 864e5).toISOString().slice(0, 10);
    /* Lo scarto c'e' perche' ce l'hanno le previsioni vere: senza, una
       previsione conta come scaduta a prescindere - regola voluta, ma qui
       si stanno misurando le DURATE, e mescolare le due cose vorrebbe
       dire non misurare piu' niente. */
    const con = (ore, quandoFra) => meteoScaduto(
      { preso: Date.now() - ore * 3600 * 1000, scarto: 7200, v: 2 }, giorno(quandoFra));
    return {
      oggiDueOre: con(2, 0),      // per oggi, due ore fa → vecchia
      oggiMezzOra: con(0.5, 0),   // per oggi, mezz'ora fa → buona
      lontanoSeiOre: con(6, 10),  // per fra dieci giorni, sei ore fa → buona
      lontanoUnGiorno: con(24, 10),
      senzaOra: meteoScaduto({ tempMax: 20 }, giorno(0)),
      /* E la regola nuova: senza il fuso del posto si rifa', per quanto
         appena presa. E' cosi' che le previsioni gia' sui telefoni si
         rimettono in riga da sole. */
      senzaFuso: meteoScaduto({ preso: Date.now() }, giorno(0)),
      /* E il rovescio: una salvata dal codice nuovo non si rifa' in
         eterno nemmeno se il fuso, per qualunque motivo, mancasse. */
      nuovaSenzaScarto: meteoScaduto({ preso: Date.now(), v: 2 }, giorno(0))
    };
  });
  ok('per oggi una previsione di due ore fa è già vecchia', durate.oggiDueOre === true);
  ok('ma una di mezz\'ora va benissimo', durate.oggiMezzOra === false);
  ok('per un giorno lontano sei ore vanno bene', durate.lontanoSeiOre === false);
  ok('e un giorno intero no', durate.lontanoUnGiorno === true);
  ok('una previsione senza il fuso del posto si rifà, per quanto fresca',
     durate.senzaFuso === true);
  ok('ma non si rifà in eterno: una salvata dal codice nuovo vale',
     durate.nuovaSenzaScarto === false);
  /* Le previsioni salvate prima che segnassimo l'ora non hanno una data:
     si rifanno, invece di restare li' per sempre. */
  ok('e una previsione senza l\'ora in cui è stata presa si rifà', durate.senzaOra === true);

  /* Coordinate che non vogliono dire niente. Zero-zero è un punto
     nell'oceano al largo della Guinea, ed è quello che esce da una tappa
     salvata male: il meteo di lì è vero, ma non è il tuo. */
  const punti = await page.evaluate(() => {
    if (typeof puntoSensato !== 'function')
      return { zeroZero: 'manca', fuoriScala: 'manca', testo: 'manca', niente: 'manca', buono: null };
    return {
      zeroZero: puntoSensato({ lat: 0, lng: 0 }),
      fuoriScala: puntoSensato({ lat: 91, lng: 12 }),
      testo: puntoSensato({ lat: 'boh', lng: 12 }),
      niente: puntoSensato(null),
      buono: puntoSensato({ lat: 35.0116, lng: 135.7681 })
    };
  });
  ok('zero-zero non è un posto: è l\'oceano al largo della Guinea', punti.zeroZero === null);
  ok('e nemmeno una latitudine oltre il polo', punti.fuoriScala === null);
  ok('né delle coordinate che non sono numeri', punti.testo === null && punti.niente === null);
  ok('mentre Kyoto passa', !!punti.buono && Math.abs(punti.buono.lat - 35.0116) < 0.001);
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
  /* Sette, non più otto: anche il Profilo se n'è andato dalla barra, in
     fondo al cassetto delle tre righine. */
  ok('e la barra è scesa a sette voci', barra.voci.length === 7, barra.voci.length + ' voci');
  ok('la vecchia pagina del meteo non c\'è più', barra.paginaMeteo === false);
  ok('ma il meteo c\'è, nella tendina', barra.tendina === true);
  /* Il pezzo che tiene in piedi il resto: la barra in basso non ha più una
     voce per il meteo, quindi se sparisse anche la porta in cima al meteo
     non ci si arriverebbe più da nessuna parte. */
  const porta = await page.evaluate(() => ({
    grado: !!document.querySelector('.hh-grado[onclick*="apriMeteo"]'),
    striscia: !!document.querySelector('.hh-grado-solo[onclick*="apriMeteo"]')
  }));
  ok('e la porta per arrivarci è in cima alla home, sul cielo',
     porta.grado === true && porta.striscia === true,
     `temperatura ${porta.grado}, riga ${porta.striscia}`);
  await page.close();

  await browser.close();
  for (const e of err) r.push(' FALLITO  ' + e);
  const passati = r.filter(x => x.startsWith('  OK')).length;
  console.log(r.join('\n'));
  console.log(`\n${passati}/${r.length} passati`);
  process.exit(passati === r.length ? 0 : 1);
})();
