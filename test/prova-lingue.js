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

/* Il viaggio di prova è pieno apposta. Con un viaggio vuoto — un partecipante,
   nessuna tappa, nessuna spesa — metà delle frasi dell'app non si disegna mai,
   e la prova non le vede nemmeno: è così che ottanta frasi in italiano sono
   passate sotto il naso. Qui dentro ci sono due persone, tappe con orario e
   con solo una parte del gruppo, una prenotazione da fare, una spesa e un
   biglietto: bastano a far comparire le frasi che il codice compone. */
const stato = {
  trips: [{ id: 1730000000012, name: 'Giappone', destination: 'Tokyo', currency: 'EUR',
    status: 'open', start: '2026-03-14', end: '2026-03-16',
    participants: [{ id: 1, name: 'Gepp', isMe: true }, { id: 2, name: 'Luca' }],
    pois: [{ id: 91, name: 'Fushimi', lat: 34.96, lng: 135.77, address: 'Kyoto',
             notes: '', priority: 'essential', assignedDay: null }],
    expenses: [{ id: 1, desc: 'Ramen', amount: 2400, currency: 'EUR', payerId: 1,
                 category: 'Cibo', type: 'food', paid: true, splitAmong: [1, 2],
                 date: '2026-03-14' }],
    tickets: [{ id: 7, name: 'Ingresso', code: 'AB12', format: 'qrcode',
                type: 'attraction', who: 1 }],
    hotels: [], createdAt: 1,
    /* Il meteo c'è apposta. Senza, "pioggia leggera", "cielo limpido" e
       "mattina piovosa" non si disegnavano mai: erano rimaste in italiano in
       tutte e quattro le lingue, e questa prova non poteva vederle perché il
       viaggio di prova non aveva un tempo che fa. Uno dei due giorni piove e
       l'altro no, così si prendono due rami diversi. */
    weather: {
      '2026-03-14': { code: 61, tempMax: 14, tempMin: 6, precipitation: 7.2, windSpeed: 12,
                      sunset: '2026-03-14T18:20', sunrise: '2026-03-14T06:40', luogo: 'Kyoto' },
      '2026-03-15': { code: 0, tempMax: 19, tempMin: 8, precipitation: 0, windSpeed: 5,
                      sunset: '2026-03-15T18:21', sunrise: '2026-03-15T06:39', luogo: 'Kyoto' }
    },
    days: [{ id: 'd1', date: '2026-03-14', title: '', activities: [
      { id: 11, name: 'Fushimi', time: '09:30', timeEnd: '11:00', lat: 34.96, lng: 135.77,
        who: [1, 2], completed: false, type: 'outdoor', booking: { needed: true, done: false } },
      { id: 12, name: 'Nishiki', time: '14:00', timeEnd: '15:00', lat: 35.00, lng: 135.76,
        who: [1], completed: true, type: 'outdoor', booking: { needed: false, done: false } }] },
      { id: 'd2', date: '2026-03-15', title: '', activities: [] }] }],
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
     già aperta, glielo si chiede qui invece di aprirne un'altra.
     La cifra è un milione e non duemila: in italiano e in spagnolo i gruppi
     partono dalla quinta cifra, e "2400,00" o "2.400,00" dipendono dalla
     versione di ICU del browser — la prova diceva cose diverse qui e sulla
     macchina delle prove automatiche. */
  const formatiIt = await it.evaluate(() => ({
    soldi: fmtMoney(1234567, 'JPY'),
    data: new Date('2026-09-01').toLocaleDateString(loc(), { weekday: 'long', month: 'long', day: 'numeric' })
  }));
  ok('in italiano date e numeri non cambiano di una virgola',
     formatiIt.soldi === '¥1.234.567,00' && /settembre/.test(formatiIt.data),
     formatiIt.soldi + ' · ' + formatiIt.data);
  await it.close();

  // ── in inglese ───────────────────────────────────────────────────────────
  const en = await apri(browser, 'en');
  en.on('pageerror', e => err.push('PAGEERROR(en): ' + e.message));
  const barraEn = await en.evaluate(() =>
    [...document.querySelectorAll('.nav-item')].map(n => n.getAttribute('title')));
  /* "Weather" non è più fra le voci: il meteo si apre dal riquadro del
     cielo in cima alla home. Che sia tradotto anche lì lo controlla il
     confronto fra le due lingue più sotto, che guarda dentro la tendina. */
  ok('in inglese la barra è tradotta',
     barraEn.includes('Expenses') && barraEn.includes('Discover') && barraEn.includes('Timetable'),
     barraEn.join(' · '));
  ok('e il meteo non è più una voce della barra',
     !barraEn.includes('Weather') && !barraEn.includes('Meteo'), barraEn.join(' · '));
  ok('ma il riquadro del cielo lo dice nella lingua giusta',
     await en.evaluate(() => (document.querySelector('.hh-cielo') || {}).title) === 'Weather for the trip',
     await en.evaluate(() => (document.querySelector('.hh-cielo') || {}).title || 'non c\'è'));
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
  /* La prova che conta davvero, e per un po' ha detto una bugia.
     Il primo metodo cercava frasi contenenti una parolina italiana ("il",
     "che", "non", "giorni"): "Esci", "Saldi", "Recupero", "Condividi" non ne
     hanno nessuna, quindi per la prova non esistevano. Diceva zero mentre a
     schermo ne restavano ottanta, e non era un caso limite: erano i tasti del
     Profilo, quelli della home e le voci dei menù.
     Il metodo di adesso non indovina, CONFRONTA: la stessa schermata si apre
     in italiano e nella lingua da provare, e si raccoglie quello che si legge.
     Una stringa che compare identica in tutt'e due o è un nome proprio, o non
     è tradotta — e i nomi propri stanno in un elenco scritto qui sotto, dove
     si vedono. */
  const IDENTICHE_PER_DAVVERO = new Set([
    'GeppGo', 'Leaflet', '© OSM', 'A JavaScript library for interactive maps',
    'Google Maps', 'Apple', 'Google', 'Android', 'Supabase', 'ChatGPT', 'Excel',
    'iPhone', 'Instagram', 'OpenStreetMap', 'GeppGo Premium', 'Premium', 'GPS',
    'Home', 'Email', 'Password', 'Shopping', 'Budget', 'Hotel', 'ℹ️ Info', '🗺️ Maps',
    'Check-in', 'Check-out', '💾 Backup', '1 km', 'PDF', 'QR', 'Go', 'ok', 'OK',
    'Italiano', 'English', 'Español', 'Français', 'Português',
    'Project URL', 'Project Settings > API', 'https://...', 'tu@esempio.it',
    'es. MXP', 'es. NRT', 'q@x.it', 'GeppGo · build r91', 'build r91',
    'Marco', 'https://xxxxx.supabase.co',
    'merati.giacomo94@gmail.com',
    "Louvre\nMusée d'Orsay\nSainte-Chapelle"
  ]);
  /* I dati del viaggio di prova: il nome che ha scritto una persona non si
     traduce, e comparirebbe identico in tutte le lingue per forza. Si prendono
     TUTTI dal viaggio, non a mano: aggiungendo una tappa alla prova, il suo
     nome entra qui da solo invece di diventare un falso allarme. */
  const t0 = stato.trips[0];
  const MIEI = [t0.name, t0.destination, stato.myName,
                ...t0.participants.map(x => x.name),
                ...(t0.pois || []).flatMap(x => [x.name, x.address]),
                ...(t0.expenses || []).map(x => x.desc),
                ...(t0.tickets || []).flatMap(x => [x.name, x.code]),
                ...(t0.days || []).flatMap(d => (d.activities || []).map(a => a.name))
               ].filter(Boolean);
  const eMio = x => MIEI.some(m => x.includes(m));
  /* Le unità si scrivono uguali in tutte e quattro le lingue: tolte quelle, se
     non resta una lettera la stringa è fatta solo di numeri e misure. Ce ne
     può essere più d'una nella stessa riga ("88 min · 6.1 km"). */
  const UNITA = /\b(min|km|kg|MB|GB|px|h|m)\b/g;
  const soloUnita = x => !/\p{L}/u.test(x.replace(UNITA, ' '));
  /* Numeri, orari, cifre, emoji e frecce: uguali in ogni lingua per natura. */
  const SENZA_LETTERE = /^[^\p{L}]*$/u;
  const CODICE_VALUTA = /^[A-Z]{3}( \(.{1,4}\))?$/;
  const NOME_E_NUMERO = /^[A-Z][a-zà-ÿ]*( \(tu\)| \(you\)| \(tú\)| \(toi\))? · \d+$/;

  /* Quello che si legge davvero, in una lingua. Si girano le schermate, si
     forzano gli stati che dipendono dalla rete, e si aprono tutti i pannelli. */
  const LEGGI = `(async (pagine) => {
    /* L'osservatore traduce su requestAnimationFrame: due giri di fotogrammi
       piu' una pausa, altrimenti si legge la schermata mezzo secondo prima
       che tocchi a lui. */
    const attendi = ms => new Promise(r => setTimeout(r, ms));
    const respira = async ms => {
      await new Promise(r => requestAnimationFrame(r));
      await new Promise(r => requestAnimationFrame(r));
      await attendi(ms);
    };
    const fuori = new Set();
    const vis = el => { const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden'; };
    const guarda = () => {
      /* Si traduce e POI si guarda. L'osservatore traduce quello che nasce su
         un requestAnimationFrame, e inseguirlo con le attese e' una corsa che
         si perde a turno: prima e' toccato al portoghese, poi allo spagnolo
         con "Essenziale" e "Indicazioni" — frasi tradotte benissimo.
         La domanda di questa prova e' "il dizionario e' completo?", non
         "l'osservatore ha fatto in tempo?": quella e' un'altra prova, e c'e'
         gia' ("resta tradotta anche dopo che l'app si ridisegna"). Chiamando
         traduciPagina() qui, quello che resta in italiano resta perche' NON
         SI SA tradurre, che e' l'unica cosa che vogliamo sapere. */
      try { traduciPagina(); } catch (e) {}
      const cam = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode: n => {
          const q = n.parentNode;
          if (!q || q.nodeName === 'SCRIPT' || q.nodeName === 'STYLE') return NodeFilter.FILTER_REJECT;
          if (!vis(q)) return NodeFilter.FILTER_REJECT;
          return n.nodeValue && n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }});
      let n; while ((n = cam.nextNode())) fuori.add(n.nodeValue.trim());
      document.querySelectorAll('[placeholder],[title],[aria-label]').forEach(el => {
        if (!vis(el)) return;
        ['placeholder','title','aria-label'].forEach(a => {
          const v = (el.getAttribute(a) || '').trim(); if (v) fuori.add(v);
        });
      });
      document.querySelectorAll('option').forEach(o => {
        const v = (o.textContent || '').trim(); if (v) fuori.add(v);
      });
    };
    for (const pg of pagine) { go(pg); await respira(230); guarda(); }
    /* Il Profilo con l'account dentro mostra tasti che senza account non
       esistono: "Cambia password", "Esci", "Elimina il mio account". Erano
       tutti e tre in italiano, e nessuno se n'era accorto. */
    try { session = { user: { id: 'io', email: 'q@x.it' } }; renderProfile(); await respira(200); guarda(); } catch (e) {}
    /* E i due avvisi in cima alla home, che dipendono dalla RETE: dove la
       libreria di Supabase non si scarica non compaiono mai. */
    try {
      go('plan');
      window.GEPPGO_SUPA_URL = window.GEPPGO_SUPA_URL || 'https://finto.supabase.co';
      window.GEPPGO_SUPA_KEY = window.GEPPGO_SUPA_KEY || 'finta';
      sb = sb || {}; session = null;
      for (const pieno of [false, true]) { storageFull = pieno; renderCloudWarn(); await respira(120); guarda(); }
      storageFull = false; renderCloudWarn();
    } catch (e) {}
    try { openDay(0); await respira(450); guarda(); } catch (e) {}
    const fogli = [...document.querySelectorAll('.modal')].map(m => m.id).filter(Boolean);
    for (const f of fogli) { openSheet(f); await respira(160); guarda(); closeSheet(f); await attendi(190); }
    return [...fuori];
  })`;
  /* "weather" non c'è più: il meteo non è una sezione della barra, è una
     tendina che si apre dal riquadro in cima alla home. Viene guardata lo
     stesso, perché il giro qui sopra apre tutti i .modal uno per uno. */
  const PAGINE = ['plan', 'discover', 'money', 'hotels', 'tickets', 'identify', 'trips'];

  const leggiIn = async (lingua) => {
    const p = await apri(browser, lingua);
    p.on('pageerror', e => err.push(`PAGEERROR(${lingua}): ` + e.message));
    /* Non si guarda finché la traduzione non è passata. La prima mano la dà
       traduciPagina() all'avvio, ma l'osservatore traduce quello che nasce
       dopo su un requestAnimationFrame: sulla macchina delle prove, con
       quattro browser addosso, il portoghese è stato fotografato prima che
       toccasse a lui e sono comparsi in italiano i tasti della home — frasi
       che erano tradotte benissimo. Si aspetta un segnale certo, non un
       tempo. */
    if (lingua !== 'it') await p.waitForFunction(
      () => document.querySelector('.nav-item[data-p="money"]').getAttribute('title') !== 'Spese',
      { timeout: 20000 });
    const visti = await p.evaluate(([leggi, pg]) => eval(leggi)(pg), [LEGGI, PAGINE]);
    /* I valori del dizionario si chiedono a questa pagina, che è già aperta:
       aprirne una apposta costerebbe altri tredici secondi per lingua. */
    const valori = lingua === 'it' ? null : await p.evaluate(lg =>
      Object.values(DIZIONARIO[lg]).concat([...GIA_TRADOTTE]), lingua);
    const extra = lingua === 'it' ? null : await p.evaluate(() => ({
      soldi: fmtMoney(1234567, 'JPY'),
      data: new Date('2026-09-01').toLocaleDateString(loc(), { weekday: 'long', month: 'long', day: 'numeric' }),
      composte: {
        tappa: tv('{1} TAPPA', 1), tappe: tv('{1} TAPPE', 4),
        giorno: tv('{1} · GIORNO {2} DI {3}', 'GIAPPONE', 1, 3),
        devi: tv('Devi {1}', '€12,00'),
        ignota: tv('Mai tradotta, con {1} dentro', 7),
        contata: (() => { tv('{1} luoghi', 9); return GIA_TRADOTTE.has('9 places'); })()
      }
    }));
    await p.close();
    return { visti: new Set(visti), extra, valori };
  };

  /* I nomi dei giorni e dei mesi di una lingua, corti e lunghi, con e senza
     punto: servono a riconoscere una data scritta bene. */
  const dateDi = (l) => {
    const loc = { it: 'it-IT', en: 'en-GB', es: 'es-ES', fr: 'fr-FR', pt: 'pt-PT' }[l];
    const fuori = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(Date.UTC(2026, 2, 1 + i));
      for (const f of ['short', 'long', 'narrow'])
        fuori.push(d.toLocaleDateString(loc, { weekday: f, timeZone: 'UTC' }));
    }
    for (let m = 0; m < 12; m++) {
      const d = new Date(Date.UTC(2026, m, 15));
      for (const f of ['short', 'long'])
        fuori.push(d.toLocaleDateString(loc, { month: f, timeZone: 'UTC' }));
    }
    /* Anche quelli italiani: la stringa da scartare è uguale nelle due lingue,
       quindi le sue parole vanno riconosciute da tutt'e due le parti. */
    if (l !== 'it') fuori.push(...dateDi('it'));
    return fuori.map(x => x.toLowerCase().replace(/[.,]/g, ''));
  };

  /* I numeri fuori dal confronto. Non e' un dettaglio: "tu €1.200,00" e
     "tu €1200,00" sono la stessa frase con lo stesso "tu" non tradotto, ma
     come stringhe sono diverse — e quanti puntini ci mette l'italiano dipende
     dalla versione di ICU del browser. Su questa macchina l'italiano scrive
     1.200,00 e lo spagnolo 1200,00, quindi le due non coincidevano e il "tu"
     e' passato; sulla macchina delle prove scrivono uguale, e l'ha preso.
     Si sostituisce il numero INTERO, separatori compresi: togliendo solo le
     cifre resterebbero i puntini a distinguere "€.," da "€,", e il "tu"
     continuerebbe a passare. Cosi' il risultato non dipende piu' da dove gira
     la prova. */
  const chiave = x => x.replace(/\d[\d.,\u00a0\u202f ]*/g, '#').replace(/\s+/g, ' ').trim();

  const inItaliano = (await leggiIn('it')).visti;
  const formati = {};
  let composte = null;
  for (const l of ['en', 'es', 'fr', 'pt']) {
    const { visti, extra, valori } = await leggiIn(l);
    formati[l] = extra;
    if (l === 'en') composte = extra.composte;
    /* Fra italiano e spagnolo tante parole sono uguali per davvero: "persona",
       "hotel", "total". Il criterio che distingue non è l'occhio, è il
       dizionario — se quella stringa è un VALORE della lingua di arrivo,
       allora è la traduzione giusta e si dà il caso che coincida; se non c'è,
       nessuno l'ha mai tradotta. Insieme ai valori vanno le composte già
       riempite da tv(): il buco è stato sostituito, quindi nel dizionario non
       si trovano più. */
    const tradotte = new Set(valori.map(chiave));
    const visteAltrove = new Set([...visti].map(chiave));
    /* Una data scritta bene può coincidere: "dom 15" è l'abbreviazione giusta
       sia in italiano sia in spagnolo (domenica, domingo). Non è un buco — la
       prova sui formati controlla a parte che le date seguano la lingua. Si
       scarta quello che è fatto SOLO di nomi di giorni e mesi della lingua
       d'arrivo, perché allora è tradotto per definizione. */
    const paroleData = new Set(dateDi(l));
    const soloData = x => {
      const parole = x.toLowerCase().match(/\p{L}+/gu);
      return !!parole && parole.every(w => paroleData.has(w));
    };
    /* E quello che resta togliendo i pezzi già tradotti da tv(): "14:00–15:00
       · 1 pers." è un orario più una composta, e di italiano non ha niente. */
    const fraseComposta = x => {
      let resto = x;
      for (const pezzo of valori) if (pezzo && pezzo.length > 2 && resto.includes(pezzo)) resto = resto.split(pezzo).join(' ');
      return !/\p{L}/u.test(resto);
    };
    const resta = [...inItaliano].filter(x =>
      visteAltrove.has(chiave(x)) && !tradotte.has(chiave(x)) && !IDENTICHE_PER_DAVVERO.has(x) &&
      !SENZA_LETTERE.test(x) && !CODICE_VALUTA.test(x) && !NOME_E_NUMERO.test(x) &&
      !soloUnita(x) && !eMio(x) && !soloData(x) && !fraseComposta(x) && x.length > 1);
    ok(`in ${LINGUA_NOME[l]} non resta niente in italiano a schermo`, resta.length === 0,
       resta.length ? `${resta.length}: ` + resta.slice(0, 12).map(x => JSON.stringify(x.slice(0, 70))).join(' ')
                    : `${inItaliano.size} frasi confrontate, nessuna uguale`);
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
     formati.en.soldi === '¥1,234,567.00', formati.en.soldi);
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
