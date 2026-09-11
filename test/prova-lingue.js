/* Le lingue.

   La chiave del dizionario è la frase italiana stessa. È la scelta che rende
   la cosa fattibile su un'app di dodicimila righe scritta tutta in italiano —
   niente tremila nomi di chiavi da inventare — e ha una conseguenza che vale
   più di tutto il resto: **quello che non è ancora tradotto resta in
   italiano**, invece di mostrare "menu.spese.aggiungi" a qualcuno che sta
   viaggiando. Metà delle prove qui sotto guardano proprio quello. */
const { apriBrowser, APP, leafletJs, RADICE } = require('./browser');
const fs = require('fs');
const path = require('path');

const stato = {
  trips: [{ id: 1730000000012, name: 'Giappone', destination: 'Tokyo', currency: 'EUR',
    status: 'open', start: '2026-03-14', end: '2026-03-16',
    participants: [{ id: 1, name: 'Gepp', isMe: true }],
    pois: [], expenses: [], tickets: [], hotels: [], weather: {}, createdAt: 1,
    days: [{ id: 'd1', date: '2026-03-14', title: '', activities: [] }] }],
  currentTripId: 1730000000012, settings: { proxRadius: 200 }, myName: 'Gepp', skipAuth: true
};

async function apri(browser, lingua, linguaTelefono) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 },
    locale: linguaTelefono || 'it-IT' });
  await page.route('**/leaflet@1.9.4/dist/leaflet.js', ro => ro.fulfill({
    status: 200, contentType: 'application/javascript', body: fs.readFileSync(leafletJs(), 'utf8') }));
  await page.route(/tile\.openstreetmap\.org/, ro => ro.abort());
  await page.addInitScript(([s, l]) => {
    const st = JSON.parse(JSON.stringify(s));
    if (l) st.settings.lingua = l;
    localStorage.setItem('geppgo2', JSON.stringify(st));
  }, [stato, lingua]);
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.t === 'function', { timeout: 20000 });
  await page.waitForTimeout(600);
  return page;
}

(async () => {
  const browser = await apriBrowser();
  const r = [];
  const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);
  const err = [];

  // ── in italiano, niente cambia ───────────────────────────────────────────
  const it = await apri(browser, 'it');
  it.on('pageerror', e => err.push('PAGEERROR: ' + e.message));
  const barraIt = await it.evaluate(() =>
    [...document.querySelectorAll('.nav-item')].map(n => n.getAttribute('title')));
  ok('in italiano la barra è quella di sempre',
     barraIt.includes('Spese') && barraIt.includes('Scopri'), barraIt.join(' · '));
  ok('e t() restituisce la frase così com\'è',
     await it.evaluate(() => t('Salva')) === 'Salva');
  /* Aprire una pagina costa tredici secondi: quello che si può chiedere a una
     già aperta, glielo si chiede qui invece di aprirne un'altra. */
  const formatiIt = await it.evaluate(() => ({
    soldi: fmtMoney(2400, 'JPY'),
    data: new Date('2026-09-01').toLocaleDateString(loc(), { weekday: 'long', month: 'long', day: 'numeric' })
  }));
  ok('in italiano date e numeri non cambiano di una virgola',
     formatiIt.soldi === '¥2.400,00' && /settembre/.test(formatiIt.data),
     formatiIt.soldi + ' · ' + formatiIt.data);
  await it.close();

  // ── in inglese ───────────────────────────────────────────────────────────
  const en = await apri(browser, 'en');
  en.on('pageerror', e => err.push('PAGEERROR(en): ' + e.message));
  const barraEn = await en.evaluate(() =>
    [...document.querySelectorAll('.nav-item')].map(n => n.getAttribute('title')));
  ok('in inglese la barra è tradotta',
     barraEn.includes('Expenses') && barraEn.includes('Discover') && barraEn.includes('Weather'),
     barraEn.join(' · '));
  ok('e anche le etichette per chi non vede', await en.evaluate(() =>
     document.querySelector('.nav-item[data-p="money"]').getAttribute('aria-label')) === 'Expenses');
  ok('la pagina dichiara la lingua che sta usando',
     await en.evaluate(() => document.documentElement.lang) === 'en');

  /* IL PUNTO: una frase che non è nel dizionario non deve sparire né
     diventare un codice. Resta in italiano, e si legge lo stesso. */
  const nonTradotta = await en.evaluate(() => t('Una frase che non ho mai tradotto'));
  ok('quello che non è tradotto resta in italiano, non diventa un codice',
     nonTradotta === 'Una frase che non ho mai tradotto', nonTradotta);
  const vuota = await en.evaluate(() => [t(''), t(undefined)]);
  ok('e una frase vuota non fa saltare niente', vuota[0] === '' && !vuota[1], JSON.stringify(vuota));

  // ── spagnolo, francese, portoghese ───────────────────────────────────────
  await en.close();
  for (const [l, atteso, dove] of [['es', 'Gastos', 'money'], ['fr', 'Dépenses', 'money'], ['pt', 'Despesas', 'money']]) {
    const p = await apri(browser, l);
    p.on('pageerror', e => err.push(`PAGEERROR(${l}): ` + e.message));
    const v = await p.evaluate(d => document.querySelector(`.nav-item[data-p="${d}"]`).getAttribute('title'), dove);
    ok(`in ${LINGUA_NOME[l]} la barra è tradotta`, v === atteso, v);
    await p.close();
  }

  // ── la lingua del telefono, adesso che il dizionario è pieno ─────────────
  /* La soglia ha fatto il suo mestiere: con il dizionario oltre l'80% le
     lingue si accendono DA SOLE, senza che nessuno abbia toccato una riga di
     codice. Era il modo di finire il lavoro senza mai lasciare l'app in mezzo
     al guado, e questa riga è il momento in cui è successo. */
  const auto = await apri(browser, null, 'es-ES');
  const barraAuto = await auto.evaluate(() => ({
    titolo: document.querySelector('.nav-item[data-p="money"]').getAttribute('title'),
    pronta: linguaPronta('es'),
    quante: Object.keys(DIZIONARIO.es).length
  }));
  ok('col telefono in spagnolo l\'app si apre in spagnolo',
     barraAuto.titolo === 'Gastos' && barraAuto.pronta === true,
     barraAuto.titolo + ', ' + barraAuto.quante + ' frasi nel dizionario');
  /* E la soglia non è decorativa: se il dizionario tornasse mezzo vuoto,
     l'app tornerebbe tutta in italiano invece di restare mezza tradotta. */
  const seSiSvuota = await auto.evaluate(() => {
    const vero = DIZIONARIO.es;
    DIZIONARIO.es = { 'Spese': 'Gastos' };
    const esito = { pronta: linguaPronta('es'), scelta: linguaScelta() };
    DIZIONARIO.es = vero;
    return esito;
  });
  ok('e se una lingua fosse mezza vuota l\'app resterebbe in italiano',
     seSiSvuota.pronta === false && seSiSvuota.scelta === 'it', JSON.stringify(seSiSvuota));
  await auto.close();

  // ── ma sceglierla a mano vale sempre ─────────────────────────────────────
  const aMano = await apri(browser, 'es', 'it-IT');
  const barraMano = await aMano.evaluate(() =>
    document.querySelector('.nav-item[data-p="money"]').getAttribute('title'));
  ok('sceglierla a mano vale anche se non è ancora pronta', barraMano === 'Gastos', barraMano);
  await aMano.close();

  /* Una lingua che non sappiamo dire non deve lasciare l'app a metà: si resta
     in italiano, che è meglio di un'interfaccia sfondata. */
  const ignota = await apri(browser, null, 'de-DE');
  const barraIgnota = await ignota.evaluate(() =>
    document.querySelector('.nav-item[data-p="money"]').getAttribute('title'));
  ok('una lingua che non sappiamo dire torna all\'italiano', barraIgnota === 'Spese', barraIgnota);
  await ignota.close();

  // ── il selettore in Profilo ──────────────────────────────────────────────
  const prof = await apri(browser, 'en');
  const sel = await prof.evaluate(() => {
    session = { user: { id: 'io', email: 'g@x.it' } };
    renderProfile();
    const s = document.getElementById('sceltaLingua');
    return { quante: s.options.length, scelta: s.value,
             nomi: [...s.options].map(o => o.textContent),
             nota: document.getElementById('linguaCopertura').textContent };
  });
  ok('in Profilo ci sono tutte e cinque le lingue', sel.quante === 5, sel.nomi.join(', '));
  ok('ognuna col suo nome, scritto nella sua lingua',
     sel.nomi.includes('Español') && sel.nomi.includes('Français') && sel.nomi.includes('Português'));
  ok('e quella in uso è selezionata', sel.scelta === 'en', sel.scelta);
  /* Onestà: una persona che vede metà app in italiano deve sapere perché.
     La nota stessa è tradotta — "itali" prende italiano, Italian, italien. */
  ok('dice quanto è tradotto davvero, invece di far finta',
     /%/.test(sel.nota) && /itali/i.test(sel.nota), sel.nota);
  const percento = parseInt((sel.nota.match(/(\d+)%/) || [])[1] || '0', 10);
  ok('e la percentuale è un numero sensato', percento > 0 && percento <= 100, percento + '%');
  await prof.close();

  // ── anche quello che l'app ridisegna da sola ─────────────────────────────
  /* Le schermate si rifanno da capo con innerHTML e si portano via la
     traduzione fatta all'avvio: se non si ripassa dopo un ridisegno, l'app
     torna in italiano al primo tocco. */
  const dopoRidisegno = await (async () => {
    const p = await apri(browser, 'en');
    p.on('pageerror', e => err.push('PAGEERROR(rid): ' + e.message));
    const v = await p.evaluate(() => {
      renderAll();
      return document.querySelector('.nav-item[data-p="money"]').getAttribute('title');
    });
    await p.close();
    return v;
  })();
  ok('e resta tradotta anche dopo che l\'app si ridisegna', dopoRidisegno === 'Expenses', dopoRidisegno);

  // ── quello che l'app DICE ────────────────────────────────────────────────
  /* I messaggi a comparsa nell'app sono centottantadue: passano tutti da
     toast(), che li traduce in un posto solo. Metterci t() a mano in
     centottantadue punti sarebbe stato centottantadue occasioni di
     dimenticarsene. */
  const messaggi = await (async () => {
    const p = await apri(browser, 'es');
    p.on('pageerror', e => err.push('PAGEERROR(msg): ' + e.message));
    const v = await p.evaluate(async () => {
      toast('Foto salvata');
      const uno = document.querySelector('.toast').textContent;
      toast('Una frase che non ho mai tradotto');
      const due = document.querySelector('.toast').textContent;
      confirmDo('Concludere il viaggio?', 'Foto salvata', () => {}, '🏁', 'Salva');
      const tre = { titolo: document.getElementById('cfTitle').textContent,
                    tasto: document.getElementById('cfOk').textContent };
      return { uno, due, tre };
    });
    await p.close();
    return v;
  })();
  ok('i messaggi a comparsa si leggono nella lingua scelta',
     messaggi.uno === 'Foto guardada', messaggi.uno);
  ok('e uno mai tradotto resta in italiano, non sparisce',
     messaggi.due === 'Una frase che non ho mai tradotto', messaggi.due);
  ok('anche le domande prima di fare qualcosa di serio',
     messaggi.tre.tasto === 'Guardar', messaggi.tre.titolo + ' / ' + messaggi.tre.tasto);

  // ── il dizionario è fatto bene ───────────────────────────────────────────
  const diz = await (async () => {
    const p = await apri(browser, 'it');
    const d = await p.evaluate(() => {
      const fuori = {};
      Object.keys(DIZIONARIO).forEach(l => {
        const v = DIZIONARIO[l];
        fuori[l] = { quante: Object.keys(v).length,
                     vuote: Object.keys(v).filter(k => !v[k]).length,
                     ugualiAllItaliano: Object.keys(v).filter(k => v[k] === k).length };
      });
      fuori.chiavi = Object.keys(DIZIONARIO.en);
      fuori.stesseChiavi = Object.keys(DIZIONARIO).every(l =>
        Object.keys(DIZIONARIO[l]).length === Object.keys(DIZIONARIO.en).length);
      return fuori;
    });
    await p.close();
    return d;
  })();
  ok('le quattro lingue hanno le stesse frasi', diz.stesseChiavi === true,
     Object.keys(LINGUA_NOME).map(l => l + ':' + diz[l].quante).join(' '));
  ok('nessuna traduzione è vuota',
     ['en','es','fr','pt'].every(l => diz[l].vuote === 0));
  /* Qualche parola è uguale in due lingue ("Budget", "Documenti"): è normale.
     Se lo fossero quasi tutte vorrebbe dire che qualcuno ha incollato
     l'italiano per far salire il conto. */
  ok('e non sono l\'italiano ricopiato',
     ['en','es','fr','pt'].every(l => diz[l].ugualiAllItaliano < diz[l].quante * 0.25),
     ['en','es','fr','pt'].map(l => l + ':' + diz[l].ugualiAllItaliano).join(' '));

  // ── niente italiano rimasto a schermo ────────────────────────────────────
  /* La prova che conta davvero: si gira per le schermate e per i pannelli con
     l'app in ognuna delle quattro lingue, e non deve restare NIENTE in
     italiano. Una frase si riconosce italiana da una parola che in inglese
     non esiste; quelle già tradotte si scartano prima, perché "I" inglese è
     anche "i" italiano e senza quel filtro l'elenco si riempiva di inglese. */
  const SPIE = "\\b(il|lo|gli|le|un|una|del|della|dei|delle|che|non|per|con|sul|sulla|nel|nella|questo|questa|quando|dove|puoi|devi|sono|hai|ho|ma|piu'|più|già|gia'|ancora|senza|dopo|prima|tuo|tua|tuoi|viaggio|giorno|giorni|spesa|spese|foto|luogo|luoghi|tappa|tappe|nessun|nessuna|niente|ora)\\b";
  const formati = {};
  let composte = null;
  for (const l of ['en', 'es', 'fr', 'pt']) {
    const p = await apri(browser, l);
    p.on('pageerror', e => err.push(`PAGEERROR(resta ${l}): ` + e.message));

    /* Date e numeri: si chiedono a questa pagina, che è già aperta. */
    formati[l] = await p.evaluate(() => ({
      soldi: fmtMoney(2400, 'JPY'),
      data: new Date('2026-09-01').toLocaleDateString(loc(), { weekday: 'long', month: 'long', day: 'numeric' })
    }));
    /* E le frasi composte, che si controllano una volta sola in inglese. */
    if (l === 'en') composte = await p.evaluate(() => ({
      tappa: tv('{1} TAPPA', 1),
      tappe: tv('{1} TAPPE', 4),
      giorno: tv('{1} · GIORNO {2} DI {3}', 'GIAPPONE', 1, 3),
      devi: tv('Devi {1}', '€12,00'),
      ignota: tv('Mai tradotta, con {1} dentro', 7),
      contata: (() => { tv('{1} luoghi', 9); return GIA_TRADOTTE.has('9 places'); })()
    }));

    /* Il giro si fa tutto dentro la pagina, non un pannello per volta da
       fuori: con cinquanta pannelli per quattro lingue, andare e tornare ogni
       volta faceva durare la prova sette minuti invece di uno. */
    const resta = await p.evaluate(async ([spie, lg, pagine]) => {
      const TRAD = new Set(Object.values(DIZIONARIO[lg]));
      const re = new RegExp(spie, 'i');
      const fuori = [];
      const attendi = ms => new Promise(r => setTimeout(r, ms));
      const vis = el => { const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden'; };
      /* Le composte non stanno fra i valori del dizionario, perché il buco è
         già riempito: senza GIA_TRADOTTE risulterebbero non tradotte. */
      const guarda = x => { if (x.length > 2 && !TRAD.has(x) && !GIA_TRADOTTE.has(x) && re.test(x)) fuori.push(x); };
      const cerca = () => {
        const cam = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
          acceptNode: n => {
            const q = n.parentNode;
            if (!q || q.nodeName === 'SCRIPT' || q.nodeName === 'STYLE') return NodeFilter.FILTER_REJECT;
            if (!vis(q)) return NodeFilter.FILTER_REJECT;
            return n.nodeValue && n.nodeValue.trim().length > 2 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
          }
        });
        let n; while ((n = cam.nextNode())) guarda(n.nodeValue.trim());
        document.querySelectorAll('[placeholder],[title],[aria-label]').forEach(el => {
          if (!vis(el)) return;
          ['placeholder', 'title', 'aria-label'].forEach(a => guarda((el.getAttribute(a) || '').trim()));
        });
      };
      for (const pg of pagine) { go(pg); await attendi(200); cerca(); }
      /* Tutti i pannelli, non un elenco scritto a mano: uno nuovo entra nella
         prova da solo, invece di restare fuori finché qualcuno se ne accorge. */
      const fogli = [...document.querySelectorAll('.modal')].map(m => m.id).filter(Boolean);
      for (const f of fogli) {
        openSheet(f); await attendi(150); cerca();
        closeSheet(f); await attendi(200);
      }
      return fuori;
    }, [SPIE, l, ['plan', 'discover', 'money', 'hotels', 'tickets', 'weather', 'identify', 'trips']]);
    const unici = [...new Set(resta)];
    ok(`in ${LINGUA_NOME[l]} non resta niente in italiano a schermo`, unici.length === 0,
       unici.length ? unici.slice(0, 4).map(x => JSON.stringify(x.slice(0, 60))).join(' | ') : 'tutte le schermate e i pannelli');
    await p.close();
  }

  // ── le frasi che il codice compone ───────────────────────────────────────
  /* Erano l'ultimo pezzo rimasto in italiano, e il più insidioso: "1 TAPPA",
     "Devi 12,00", "GIAPPONE · GIORNO 1 DI 3". Cucite da pezzi funzionavano
     solo in italiano — altrove il numero va da un'altra parte e il plurale
     non si fa allo stesso modo. Ora la chiave è la frase intera col buco. */
  ok('una frase composta si traduce intera, non a pezzi',
     composte.tappa === '1 STOP' && composte.tappe === '4 STOPS',
     composte.tappa + ' / ' + composte.tappe);
  ok('e i buchi si riempiono dove vuole la lingua, non dove capita',
     composte.giorno === 'GIAPPONE · DAY 1 OF 3', composte.giorno);
  ok('anche quando dentro c\'è una cifra', composte.devi === 'You owe €12,00', composte.devi);
  ok('una composta mai tradotta resta in italiano, col buco riempito lo stesso',
     composte.ignota === 'Mai tradotta, con 7 dentro', composte.ignota);
  /* Senza questo, le frasi composte risulterebbero per sempre non tradotte
     proprio perché sono tradotte bene, e la percentuale in Profilo mentirebbe
     verso il basso. */
  ok('e il conteggio della copertura sa che sono già tradotte', composte.contata === true);

  /* E ogni frase che il codice passa a tv() deve stare nel dizionario. Si
     legge il file, non la pagina: una frase composta che compare solo in un
     caso raro — una data sbagliata, un elenco vuoto — non si vede girando per
     le schermate, e resterebbe in italiano senza che nessuno se ne accorga. */
  const chiavi = [...fs.readFileSync(path.join(RADICE, 'Index 2.1.html'), 'utf8')
    .matchAll(/\btv\('((?:[^'\\]|\\.)*)'/g)].map(m => m[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\'));
  const orfane = await (async () => {
    const p = await apri(browser, 'it');
    const v = await p.evaluate(ks => ks.filter(k => !DIZIONARIO.en[k]), chiavi);
    await p.close();
    return v;
  })();
  ok('ogni frase passata a tv() sta nel dizionario', orfane.length === 0,
     orfane.length ? orfane.slice(0, 5).map(x => JSON.stringify(x)).join(' | ') : chiavi.length + ' frasi composte, tutte tradotte');

  // ── date e numeri ────────────────────────────────────────────────────────
  /* "martedì 1 settembre" in mezzo a una schermata inglese è la prima cosa
     che salta all'occhio, e "2.400,00" letto da un inglese fa due virgola
     quattro. Le date e i numeri seguono la lingua scelta, non il codice. */
  ok('in inglese la data si legge in inglese',
     /September/.test(formati.en.data) && !/settembre/.test(formati.en.data), formati.en.data);
  ok('e i numeri si scrivono come li scrive chi legge',
     formati.en.soldi === '¥2,400.00', formati.en.soldi);
  ok('e lo stesso in francese', /septembre/.test(formati.fr.data), formati.fr.data);
  ok('e in portoghese', /setembro/.test(formati.pt.data), formati.pt.data);

  // ── cambiare lingua si salva ─────────────────────────────────────────────
  const cambio = await (async () => {
    const p = await apri(browser, 'it');
    const dopo = await p.evaluate(() => {
      /* Non si ricarica davvero dentro la prova: si guarda che la scelta
         venga scritta dove deve. */
      const vero = location.reload; location.reload = () => {};
      cambiaLingua('fr');
      location.reload = vero;
      return { salvata: JSON.parse(localStorage.getItem('geppgo2')).settings.lingua,
               inMemoria: app.settings.lingua };
    });
    await p.close();
    return dopo;
  })();
  ok('la lingua scelta si salva sul telefono', cambio.salvata === 'fr', cambio.salvata);
  ok('e vale anche subito', cambio.inMemoria === 'fr', cambio.inMemoria);

  console.log('\n' + r.join('\n'));
  const falliti = r.filter(x => x.includes('FALLITO')).length;
  console.log(`\n${r.length - falliti}/${r.length} passati`);
  if (err.length) console.log('\nErrori in pagina:\n' + err.join('\n'));
  await browser.close();
  process.exit(falliti || err.length ? 1 : 0);
})();

const LINGUA_NOME = { en: 'inglese', es: 'spagnolo', fr: 'francese', pt: 'portoghese' };
