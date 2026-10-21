/* TUTTO A PORTATA (miglioria 9c).

   La regola «Nessuna funzione nascosta» (CLAUDE.md): ogni funzione a non
   più di 2 tocchi dalla Home o dalla barra in basso, con una voce che ha una
   scritta. Il controllo del 13 ottobre (DA-FARE) aveva trovato le funzioni
   che non la rispettavano: un'icona sola, un titolo da toccare, tre o
   quattro tocchi. Qui si prova che adesso la rispettano.

   1. ogni funzione dell'elenco si raggiunge in al massimo 2 tocchi dalla
      Home, toccando voci con la scritta. La barra in basso resta di sole
      icone: le parole sotto le icone a 320 px non ci stanno, e come ridurre
      le voci lo decide Giacomo (vedi DA-FARE);
   2. da 320 a 430 px, in 5 lingue, in tema chiaro e scuro: niente esce
      dallo schermo, niente è troncato o sovrapposto, e intorno al centro di
      ogni tasto ci sono 44×44 px che rispondono a lui (compresa l'icona del
      mezzo fra due tappe, che resta senza scritta);
   3. «Lisbona ▾» apre l'elenco dei viaggi con le tre voci, e il Profilo si
      apre con un tocco;
   4. «✈️ Viaggio» apre la scheda del viaggio;
   5. «Il ricordo» si apre anche per un viaggio in corso;
   6. in portoghese a 320 px «Cosa cerchi» passa alla forma corta, intera;
      «ADESSO» e «ora» sono tradotti;
   7. MAPPA_APP dice i percorsi nuovi (e l'assistente li riceve);
   8. i testi nuovi sono tradotti in cinque lingue.

   I tocchi sono veri: Playwright tocca il punto dove sta la voce e si
   rifiuta se lì sopra c'è altro, come farebbe un dito. */
const fs = require('fs');
const { apriBrowser, APP, leafletJs } = require('./browser');

const r = [];
const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);
const errori = [];

/* ── le date, e l'ora ────────────────────────────────────────────────────
   L'orologio della pagina sta a mezzogiorno di oggi: la tappa delle 11:30
   è in corso («ADESSO», e «ora» nell'anello) a qualunque ora girino le
   prove. */
const giornoA = scarto => { const b = new Date(); return new Date(b.getFullYear(), b.getMonth(), b.getDate() + scarto, 12, 0, 0); };
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const dataFra = s => iso(giornoA(s));
const MEZZOGIORNO = giornoA(0);

const tappa = (id, name, time, timeEnd, lat, lng) => ({ id, name, time, timeEnd, type: 'any', who: [], completed: false, lat, lng, booking: { needed: false, done: false } });
const meteo = d => ({ code: 0, tempMax: 24, tempMin: 15, precipitation: 0, windSpeed: 6, sunrise: d + 'T07:30', sunset: d + 'T19:10', luogo: 'Lisbona' });
/* Lisbona: in corso, quattro giorni da oggi, due persone, due tappe oggi
   (una adesso) e una cena pagata da Anna per tutti e due, così nei saldi
   c'è un rimborso da segnare. */
function lisbona(extra = {}) {
  const giorni = [0, 1, 2, 3].map(i => ({ id: 'd' + i, date: dataFra(i), title: '', activities: i ? [] : [
    tappa(501, 'Torre di Belém', '11:30', '12:45', 38.6916, -9.2160),
    tappa(502, 'Mosteiro dos Jerónimos', '14:00', '15:30', 38.6979, -9.2068)] }));
  return Object.assign({
    id: 1, name: 'Lisbona', destination: 'Lisbona', currency: 'EUR', status: 'open',
    start: giorni[0].date, end: giorni[3].date,
    participants: [{ id: 11, name: 'Anna', isMe: true }, { id: 12, name: 'Bruno' }], guests: [],
    pois: [], hotels: [], tickets: [],
    expenses: [{ id: 901, desc: 'Cena', amount: 60, payerId: 11, splitAmong: [11, 12], category: 'Cibo', date: giorni[0].date, paid: true }],
    weather: Object.fromEntries(giorni.map(g => [g.date, meteo(g.date)])), createdAt: 1, days: giorni
  }, extra);
}
/* Lo stesso viaggio con la sola tappa delle 11:30: il riquadro «Fra poco»
   segue la prossima tappa, e finché ce n'è una dopo mostra quella. */
const soloAdesso = () => { const t = lisbona(); t.days[0].activities = t.days[0].activities.slice(0, 1); return t; };
/* Porto: un viaggio a cui Anna è stata invitata (non conta nel limite del
   piano gratuito, quindi «+ Aggiungi viaggio» apre il foglio vero), ancora
   senza giorni: è quello di «✦ Su misura» in Home. */
const porto = () => ({ id: 2, name: 'Porto', destination: 'Porto', currency: 'EUR', status: 'open', start: '', end: '', _admin: false,
  participants: [{ id: 11, name: 'Anna', isMe: true }], guests: [], pois: [], hotels: [], tickets: [], expenses: [], weather: {}, createdAt: 2, days: [] });

async function apri(browser, { larghezza = 390, scuro = false, lingua = null, viaggi = null, corrente = 1 } = {}) {
  const page = await browser.newPage({ viewport: { width: larghezza, height: 844 } });
  page.on('pageerror', e => errori.push('PAGEERROR: ' + e.message.split('\n')[0]));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_BLOCKED|net::/.test(m.text())) errori.push('CONSOLE: ' + m.text().slice(0, 140)); });
  await page.route('**/leaflet@1.9.4/dist/leaflet.js', ro => ro.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(leafletJs(), 'utf8') }));
  await page.route(/tile\.openstreetmap\.org/, ro => ro.abort());
  await page.route(/api\.open-meteo\.com/, ro => ro.abort());
  await page.clock.install({ time: MEZZOGIORNO });
  await page.addInitScript(([vv, corrente, scuro, lingua]) => {
    if (sessionStorage.getItem('prova-a-portata')) return;
    sessionStorage.setItem('prova-a-portata', '1');
    localStorage.clear();
    const st = { trips: vv, currentTripId: corrente, settings: { dark: scuro }, myName: 'Anna', skipAuth: true, consentNotif: false };
    if (lingua) st.settings.lingua = lingua;
    localStorage.setItem('geppgo2', JSON.stringify(st));
    localStorage.setItem('geppgo2_intro', '1');
    localStorage.setItem('geppgo2_avviso_home', String(Date.now()));
  }, [viaggi || [lisbona(), porto()], corrente, scuro, lingua]);
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.renderAll === 'function' && !document.getElementById('bootSplash'), null, { timeout: 30000 });
  await page.waitForTimeout(400);
  return page;
}
const prova = async (nome, fn) => { try { await fn(); } catch (e) { ok(nome, false, 'si è fermata: ' + e.message.split('\n')[0]); } };
const aspetta = (p, fn, arg, ms = 3000) => p.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
const foglioAperto = (p, id) => aspetta(p, i => { const m = document.getElementById(i); return !!m && m.classList.contains('active'); }, id);
/* Il testo di un pezzo sta tutto dentro di lui, su una riga sola. Non si usa
   scrollWidth: conta anche l'area invisibile da 44 px, che sborda apposta. */
const INTERO = el => {
  if (!el) return false;
  const rg = document.createRange(); rg.selectNodeContents(el);
  const q = rg.getBoundingClientRect(), b = el.getBoundingClientRect(), righe = new Set([...rg.getClientRects()].map(x => Math.round(x.top)));
  return q.width > 0 && q.left >= b.left - 0.5 && q.right <= b.right + 0.5 && righe.size === 1;
};
/* Di nuovo in Home, sul viaggio giusto, coi fogli chiusi. */
const aCasa = async (p, corrente = 1) => {
  await p.evaluate(c => {
    document.querySelectorAll('.modal.active').forEach(m => closeSheet(m.id));
    window.__spie = [];
    if (app.currentTripId !== c) { app.currentTripId = c; save(); }
    if (typeof setDiscover === 'function') setDiscover('search');
    if (typeof setMoney === 'function') setMoney('list');
    go('plan'); renderAll();
  }, corrente);
  await p.waitForTimeout(450);
};
/* Le funzioni che, toccate davvero, partirebbero per la loro strada (il
   prompt per rinominare, il PDF, il file del calendario, l'assistente, la
   posizione): qui si guarda solo che il tocco ci arrivi. */
const SPIE = ['toggleGPS', 'renameTrip', 'toggleStatus', 'openDiary', 'exportICS', 'sistemaGiornata', 'openGenForDay', 'undoDrag', 'toggleSuggest'];
const spia = p => p.evaluate(n => { window.__spie = []; n.forEach(k => { window[k] = function () { window.__spie.push(k); }; }); }, SPIE);

/* ── 1. i percorsi ─────────────────────────────────────────────────────────
   Ogni passo è una voce con la sua scritta, tranne BARRA: un'icona della
   barra in basso, che le parole non le ha (vedi sopra). */
const BARRA = p => ({ barra: p });
/* prima: quello che c'e' da fare perche' la voce si accenda (non e' un tocco
   e non si conta): «↩ Annulla» con niente da annullare e' spento
   (aria-disabled, miglioria 11), e un dito vero non lo cerca. */
const VOCE = (sel, re, prima) => ({ sel, re, prima });
const NOME = VOCE('#menuViaggi', /Lisbona/);
const VIAGGIO = VOCE('#homeHero .hh-rapido', /Viaggio/);
const GIORNATA = VOCE('#homeHero .hh-eyebrow', /GIORNO 1 DI 4/);
const PROFILO = VOCE('#tbProfilo', /^\s*A\s*$/);
/* [funzione, partenza, passi, cosa deve succedere]. «dietro una scheda»:
   per questi due la richiesta era la scritta, e stanno dietro una scheda
   di una pagina della barra (Scopri › Assistente, Spese › Saldi): 2 tocchi
   da lì, 3 dalla Home. Lo si conta e lo si dice, invece di nasconderlo. */
const FUNZIONI = [
  ['cambiare viaggio', 1, [NOME, VOCE('#mViaggi .vg-voce', /Porto/)], 'viaggio:2'],
  ['aggiungere un viaggio', 1, [NOME, VOCE('#mViaggi .vg-nuovo', /Aggiungi viaggio/)], 'mNewTrip'],
  ['importare da Excel', 1, [NOME, VOCE('#mViaggi .vg-importa', /Importa da Excel/)], 'mImport'],
  ['entrare con un codice', 1, [NOME, VOCE('#mViaggi .vg-codice', /Ho un codice/)], 'mCode'],
  ['il Profilo', 1, [PROFILO], 'pagina:trips'],
  ['il GPS', 1, [VOCE('#gpsPill', /GPS/)], 'spia:toggleGPS'],
  ['il meteo', 1, [VOCE('#homeHero .hh-grado', /Meteo/)], 'mMeteo'],
  ['aggiungere una tappa dalla Home', 1, [VOCE('#plan .hh-add', /Aggiungi/)], 'mActDetail'],
  ['la scheda del viaggio', 1, [VIAGGIO], 'mTripZoom'],
  ['rinominare il viaggio', 1, [VIAGGIO, VOCE('#tripZoomBody button', /Rinomina/)], 'spia:renameTrip'],
  ['i giorni del viaggio', 1, [VIAGGIO, VOCE('#tripZoomBody button', /Giorni/)], 'mTripDates'],
  ['concludere il viaggio', 1, [VIAGGIO, VOCE('#tripZoomBody button', /Concludi viaggio/)], 'spia:toggleStatus'],
  ['eliminare il viaggio', 1, [VIAGGIO, VOCE('#tripZoomBody button', /Elimina viaggio/)], 'mConfirm'],
  ['i consigli, dalla scheda del viaggio', 1, [VIAGGIO, VOCE('#tripZoomBody button', /Consigli/)], 'mSuggest'],
  ['i punti di ripristino, dalla scheda del viaggio', 1, [VIAGGIO, VOCE('#tripZoomBody button', /Punti di ripristino/)], 'mRestore'],
  ['il ricordo, a viaggio in corso', 1, [VIAGGIO, VOCE('#tripZoomBody button', /Il ricordo/)], 'mRicordo'],
  ['il diario in PDF', 1, [VIAGGIO, VOCE('#tripZoomBody button', /Diario PDF/)], 'spia:openDiary'],
  ['esportare nel calendario', 1, [VIAGGIO, VOCE('#tripZoomBody button', /Esporta nel calendario/)], 'spia:exportICS'],
  ['il PDF dell\'itinerario, dalla scheda del viaggio', 1, [VIAGGIO, VOCE('#tripZoomBody button', /PDF dell'itinerario/)], 'mPdfItin'],
  ['i tetti di spesa, dalla scheda del viaggio', 1, [VIAGGIO, VOCE('#tripZoomBody button', /Tetti di spesa/)], 'mTetti'],
  ['la mappa di tutto il viaggio, dalla mappa della Home', 1, [VOCE('#homeMapWrap .mappa-tutto', /Tutto il viaggio/)], 'mViaggioMappa'],
  ['la mappa di tutto il viaggio, dalla scheda del viaggio', 1, [VIAGGIO, VOCE('#tripZoomBody button', /Tutto il viaggio/)], 'mViaggioMappa'],
  ['la mappa di tutto il viaggio, dalla Time Table', 1, [GIORNATA, VOCE('#dayMapWrap .mappa-tutto', /Tutto il viaggio/)], 'mViaggioMappa'],
  ['Su misura, in un viaggio senza giorni', 2, [VOCE('#homeHero .hh-sumisura', /Su misura/)], 'importa:itin'],
  ['ordinare il giro', 1, [GIORNATA, VOCE('#mDay .tt-az', /Ordina il giro/)], 'spia:sistemaGiornata'],
  ['l\'Autopilota', 1, [GIORNATA, VOCE('#mDay .tt-az', /Autopilota/)], 'spia:openGenForDay'],
  ['aggiungere in Time Table', 1, [GIORNATA, VOCE('#ttFab', /Aggiungi/)], 'mAddScelta'],
  ['annullare uno spostamento', 1, [GIORNATA, VOCE('#ttUndo', /Annulla/, "markDrag(T().days[ttDay].activities[0],{time:'09:00',timeEnd:'10:30'})")], 'spia:undoDrag'],
  ['i consigli, da Scopri', 1, [BARRA('discover'), VOCE('#sgRiga', /Consigli nei dintorni/)], 'spia:toggleSuggest'],
  ['Su misura, nel «Nuovo viaggio»', 1, [NOME, VOCE('#mViaggi .vg-nuovo', /Aggiungi viaggio/)], 'nuovo:suMisura'],
  ['la prenotazione dalla mail, da Biglietti', 1, [BARRA('tickets'), VOCE('#tickets .tk-mail', /Prenotazione dalla mail/)], 'importa:booking'],
  ['aggiungere una spesa', 1, [BARRA('money'), VOCE('#money .mh-spesa', /Spesa/)], 'mExpense'],
  ['i punti di ripristino, dal Profilo', 1, [PROFILO], 'profilo:ripristino'],
  ['segnare un rimborso', 1, [BARRA('money'), VOCE('#money .seg-btn', /Saldi/), VOCE('#money .tic-tx', /Pagato/)], 'mPareggia', 'dietro una scheda'],
  ['allegare un PDF in chat', 1, [BARRA('discover'), VOCE('#segAI', /Assistente/), VOCE('#aiMode .clip', /PDF/)], 'file', 'dietro una scheda']
];
const ESITO = e => {
  const attivo = id => { const m = document.getElementById(id); return !!m && m.classList.contains('active'); };
  const visibile = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).display !== 'none';
  if (e.startsWith('spia:')) return (window.__spie || []).includes(e.slice(5));
  if (e.startsWith('pagina:')) return attivo(e.slice(7));
  if (e.startsWith('viaggio:')) return !!T() && T().id === Number(e.slice(8));
  if (e.startsWith('importa:')) {
    const sub = { itin: 'impItinSub', booking: 'impBookingSub' }[e.slice(8)];
    return attivo('discover') && visibile(document.getElementById('impMode')) && visibile(document.getElementById(sub));
  }
  if (e === 'nuovo:suMisura') {
    const c = document.getElementById('ntSuMisura'), l = c && c.closest('label');
    return attivo('mNewTrip') && !!l && visibile(l) && /Su misura/.test(l.textContent);
  }
  if (e === 'profilo:ripristino') return attivo('trips') && [...document.querySelectorAll('#profileCard .card-h')].some(h => /Punti di ripristino/.test(h.textContent));
  return attivo(e);
};
/* Un percorso, a tocchi veri. Ogni voce deve avere una scritta: almeno una
   lettera (l'iniziale del Profilo conta, come chiesto). */
async function percorri(p, passi) {
  const visti = [];
  for (const s of passi) {
    if (s.barra) {
      await p.locator(`.nav-item[data-p="${s.barra}"]`).click({ timeout: 3000 });
      visti.push({ testo: 'barra: ' + s.barra, barra: true });
    } else {
      if (s.prima) await p.evaluate(js => eval(js), s.prima);
      const el = p.locator(s.sel).filter({ hasText: s.re }).first();
      await el.scrollIntoViewIfNeeded({ timeout: 3000 });
      const testo = (await el.innerText()).replace(/\s+/g, ' ').trim();
      await el.click({ timeout: 3000 });
      visti.push({ testo, barra: false });
    }
    await p.waitForTimeout(450);
  }
  return visti;
}

/* ── 2. le misure ──────────────────────────────────────────────────────────
   Per ogni schermata, i pezzi che la miglioria ha aggiunto o cambiato e i
   loro vicini:
   - fuori: un pezzo che esce dallo schermo, la pagina che scorre di lato;
   - troncati: un testo più largo (o più alto) del posto che ha, tagliato o
     coi puntini;
   - spezzate: una parola divisa fra due righe;
   - sovrapposti: due pezzi uno sopra l'altro;
   - piccoli: un tasto intorno al cui centro non ci sono 44×44 px che
     rispondono a lui (si tocca il punto, come un dito: conta anche l'area
     invisibile intorno, e conta se sopra c'è altro);
   - invisibili: testo dello stesso colore del fondo. */
const SCHERMI = [
  { nome: 'Home', prepara: 'casa', sel: ['#menuViaggi', '#gpsPill', '#tbProfilo', '#homeHero .hh-grado', '#homeHero .hh-cerca', '#homeHero .hh-raccolta', '#homeHero .hh-rapido', '#plan .hh-add', '#homeMapWrap .mappa-tutto'] },
  { nome: 'Home senza giorni', prepara: 'porto', sel: ['#menuViaggi', '#homeHero .hh-sumisura', '#homeHero .hh-cerca', '#homeHero .hh-rapido'] },
  { nome: 'cassetto', prepara: 'cassetto', sel: ['#cassChiudi', '#mViaggi .vg-voce', '#mViaggi .vg-nuovo', '#mViaggi .vg-importa', '#mViaggi .vg-codice'] },
  { nome: 'scheda del viaggio', prepara: 'scheda', sel: ['#tripZoomBody .chip', '#tripZoomBody .btn'] },
  { nome: 'Time Table', prepara: 'giornata', sel: ['#mDay .tt-az', '#ttFab', '#ttUndo', '#dayMapWrap .mappa-tutto'], mezzi: true },
  { nome: 'Scopri', prepara: 'scopri', sel: ['#segSearch', '#segAI', '#segImp', '#sgRiga'] },
  { nome: 'Scopri › Assistente', prepara: 'assistente', sel: ['#aiMode .clip'] },
  { nome: 'Spese', prepara: 'spese', sel: ['#money .mh-spesa', '#money .seg-btn'] },
  { nome: 'Spese › Saldi', prepara: 'saldi', sel: ['#money .tic-tx'] },
  { nome: 'Biglietti', prepara: 'biglietti', sel: ['#tickets .tk-modo', '#tickets .tk-mail'] },
  { nome: 'Nuovo viaggio', prepara: 'nuovo', sel: ['#mNewTrip label.split-item'] },
  { nome: 'Profilo', prepara: 'profilo', sel: ['#profileCard .card-h'] }
];
const PREPARA = async (p, cosa) => {
  await p.evaluate(c => {
    document.querySelectorAll('.modal.active').forEach(m => closeSheet(m.id));
    const torna = () => { if (app.currentTripId !== 1) { app.currentTripId = 1; save(); renderAll(); } };
    if (c === 'porto') { app.currentTripId = 2; save(); renderAll(); go('plan'); return; }
    torna();
    if (c === 'casa') go('plan');
    else if (c === 'cassetto') { go('plan'); apriViaggi(); }
    else if (c === 'scheda') openTripZoom(1);
    else if (c === 'giornata') openDay(0);
    else if (c === 'scopri') { go('discover'); setDiscover('search'); }
    else if (c === 'assistente') { go('discover'); setDiscover('ai'); }
    else if (c === 'spese') { go('money'); setMoney('list'); }
    else if (c === 'saldi') { go('money'); setMoney('bal'); }
    else if (c === 'biglietti') go('tickets');
    else if (c === 'nuovo') openNewTrip();
    else if (c === 'profilo') go('trips');
    window.scrollTo(0, 0);
  }, cosa);
  await p.waitForTimeout(cosa === 'giornata' ? 900 : 500);
};
const MISURA = ([sels, mezzi]) => {
  const W = innerWidth, H = innerHeight;
  const out = { fuori: [], troncati: [], spezzate: [], sovrapposti: [], piccoli: [], invisibili: [], visti: 0, mezzi: 0 };
  if (document.documentElement.scrollWidth > W + 1) out.fuori.push('la pagina scorre di lato');
  const nome = el => (el.id ? '#' + el.id : String(el.className || el.tagName).split(' ')[0]) + ' «' + (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24) + '»';
  const visibile = el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const els = [];
  sels.forEach(s => document.querySelectorAll(s).forEach(el => { if (visibile(el) && !els.includes(el)) els.push(el); }));
  out.visti = els.length;
  /* Sovrapposti: si guarda a pagina ferma in cima, fra i pezzi interi a
     schermo. Scorrendo, la testata (che sta ferma) passerebbe sopra al
     resto e sembrerebbe un pezzo addosso a un altro. */
  const interi = els.filter(el => { const q = el.getBoundingClientRect(); return q.top >= 0 && q.bottom <= H; });
  for (let i = 0; i < interi.length; i++) for (let j = i + 1; j < interi.length; j++) {
    const a = interi[i], b = interi[j];
    if (a.contains(b) || b.contains(a)) continue;
    const p = a.getBoundingClientRect(), q = b.getBoundingClientRect();
    if (Math.min(p.right, q.right) - Math.max(p.left, q.left) > 1 && Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top) > 1) out.sovrapposti.push(nome(a) + ' / ' + nome(b));
  }
  const tasto = el => el.matches('button, label, a, [onclick], [role=button]');
  /* I 44 px intorno al centro: il centro, quattro punti a 21 px (sopra,
     sotto, a destra, a sinistra) e quattro in diagonale a 15. Ognuno deve
     cadere sul tasto (o dentro di lui). Gli spigoli del quadrato no: un
     tasto alto 44 con gli angoli tondi lì non risponde, e il dito, che è
     tondo anche lui, non ci arriva. */
  const quadrato = el => {
    const q = el.getBoundingClientRect(), cx = q.left + q.width / 2, cy = q.top + q.height / 2, male = [];
    for (const [dx, dy] of [[0, 0], [-21, 0], [21, 0], [0, -21], [0, 21], [-15, -15], [15, -15], [-15, 15], [15, 15]]) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || x > W || y < 0 || y > H) { male.push(`${dx},${dy} fuori dallo schermo`); continue; }
      const h = document.elementFromPoint(x, y);
      if (!h || (h !== el && !el.contains(h))) male.push(`${dx},${dy} → ${h ? nome(h) : 'niente'}`);
    }
    return male.length ? `${nome(el)} ${Math.round(q.width)}×${Math.round(q.height)} (${male.slice(0, 2).join('; ')})` : null;
  };
  els.forEach(el => {
    el.scrollIntoView({ block: 'center', inline: 'nearest' });
    const q = el.getBoundingClientRect();
    if (q.left < -0.5 || q.right > W + 0.5) out.fuori.push(`${nome(el)} ${Math.round(q.left)}..${Math.round(q.right)}`);
    [el, ...el.querySelectorAll('*')].forEach(x => {
      if (!visibile(x) || !(x.innerText || '').trim()) return;
      const cs = getComputedStyle(x);
      if ((cs.overflowX !== 'visible' || cs.textOverflow === 'ellipsis') && x.scrollWidth > x.clientWidth + 1) out.troncati.push(nome(x));
      else if (cs.overflowY !== 'visible' && x.scrollHeight > x.clientHeight + 2) out.troncati.push(nome(x) + ' in altezza');
    });
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) {
      if (!n.parentElement || !visibile(n.parentElement)) continue;
      /* Andare a capo su un trattino («l’e-» e sotto «mail») è come si
         scrive; a metà fra due lettere no. */
      const re = /[^\s\-‐]+/g; let m;
      while ((m = re.exec(n.data))) {
        const rg = document.createRange(); rg.setStart(n, m.index); rg.setEnd(n, m.index + m[0].length);
        if (new Set([...rg.getClientRects()].map(x => Math.round(x.top))).size > 1) out.spezzate.push(`${m[0]} in ${nome(el)}`);
      }
    }
    const cs = getComputedStyle(el);
    if (cs.color === cs.backgroundColor) out.invisibili.push(nome(el));
    if (tasto(el)) { const male = quadrato(el); if (male) out.piccoli.push(male); }
  });
  /* L'icona del mezzo fra due tappe: senza scritta, ma da 44×44. */
  if (mezzi) document.querySelectorAll('#ttBody .tt-travel-mezzo').forEach(el => {
    if (!visibile(el)) return;
    out.mezzi++;
    el.scrollIntoView({ block: 'center', inline: 'nearest' });
    const male = quadrato(el);
    if (male) out.piccoli.push('il mezzo: ' + male);
  });
  return out;
};

(async () => {
  const browser = await apriBrowser();

  /* ── 1. ogni funzione a 2 tocchi dalla Home, con la scritta ───────────── */
  await prova('1', async () => {
    const p = await apri(browser);
    await spia(p);
    for (const [nome, partenza, passi, atteso, nota] of FUNZIONI) {
      try {
        await aCasa(p, partenza);
        let scelto = null;
        if (atteso === 'file') p.once('filechooser', () => { scelto = true; });
        const visti = await percorri(p, passi);
        await p.waitForTimeout(150);
        const arrivato = atteso === 'file' ? scelto === true : await p.evaluate(ESITO, atteso);
        const senzaScritta = visti.filter(v => !v.barra && !/\p{L}/u.test(v.testo));
        const tocchi = visti.length, daContare = nota ? tocchi - 1 : tocchi;
        const strada = visti.map(v => v.barra ? '[' + v.testo + ']' : '«' + v.testo.slice(0, 32) + '»').join(' › ');
        ok(`1. ${nome}: ${tocchi} ${tocchi === 1 ? 'tocco' : 'tocchi'}${nota ? ` (${nota}: ${daContare} dalla pagina della barra)` : ''}, con la scritta`,
          arrivato && daContare <= 2 && !senzaScritta.length, strada + (arrivato ? '' : ' — non si apre: ' + atteso));
      } catch (e) {
        ok(`1. ${nome}`, false, 'si è fermata: ' + e.message.split('\n')[0]);
      }
    }
    await p.close();
  });

  /* ── 2. tutto nello schermo, 320–430 px, 5 lingue, chiaro e scuro ──────── */
  await prova('2', async () => {
    const guasti = { fuori: [], troncati: [], spezzate: [], sovrapposti: [], piccoli: [], invisibili: [] };
    let misure = 0, mezzi = 0, vuote = [];
    const combo = async (lingua, larghezza, scuro) => {
      const p = await apri(browser, { lingua, larghezza, scuro });
      const tema = await p.evaluate(() => document.body.classList.contains('dark'));
      if (tema !== scuro) guasti.invisibili.push(`${lingua} ${larghezza}px: tema sbagliato`);
      for (const s of SCHERMI) {
        await PREPARA(p, s.prepara);
        const m = await p.evaluate(MISURA, [s.sel, !!s.mezzi]);
        misure++;
        mezzi += m.mezzi;
        const tag = `${lingua} ${larghezza}px ${scuro ? 'scuro' : 'chiaro'}, ${s.nome}`;
        if (!m.visti) vuote.push(tag);
        Object.keys(guasti).forEach(k => m[k].forEach(x => guasti[k].push(`${tag}: ${x}`)));
      }
      await p.close();
    };
    for (const lingua of ['it', 'en', 'es', 'fr', 'pt']) {
      for (const larghezza of [320, 375, 430]) {
        await Promise.all([combo(lingua, larghezza, false), combo(lingua, larghezza, true)]);
      }
    }
    const atteso = 5 * 3 * 2 * SCHERMI.length;
    const primi = k => guasti[k].length ? `${guasti[k].length} in tutto: ` + guasti[k].slice(0, 3).join(' | ') : '';
    ok(`2. misurate ${SCHERMI.length} schermate da 320 a 430 px, in 5 lingue, in tema chiaro e scuro`, misure === atteso && !vuote.length, `${misure} di ${atteso}${vuote.length ? '; vuote: ' + vuote.slice(0, 3).join('; ') : ''}`);
    ok('2. niente esce dallo schermo, la pagina non scorre di lato', !guasti.fuori.length, primi('fuori'));
    ok('2. nessun testo troncato', !guasti.troncati.length, primi('troncati'));
    ok('2. nessuna parola spezzata a metà', !guasti.spezzate.length, primi('spezzate'));
    ok('2. niente sovrapposto', !guasti.sovrapposti.length, primi('sovrapposti'));
    ok('2. ogni tasto ha 44×44 px che rispondono a lui, l\'icona del mezzo compresa', !guasti.piccoli.length && mezzi > 0, primi('piccoli') || `${mezzi} icone del mezzo misurate`);
    ok('2. i testi si leggono, in tema chiaro e scuro', !guasti.invisibili.length, primi('invisibili'));
  });

  /* ── 3. «Lisbona ▾» e il Profilo ───────────────────────────────────────── */
  await prova('3', async () => {
    const p = await apri(browser);
    const tasto = await p.evaluate(() => {
      const b = document.getElementById('menuViaggi');
      if (!b) return { testo: '', freccina: false };
      /* Dalla Layout 1 la freccina è un'icona del blocco SVG (#i-giu), non
         più il carattere «▾»: si guarda che ci sia e che si veda. */
      const g = b.querySelector('use[href="#i-giu"]');
      return { testo: b.innerText.replace(/\s+/g, ' ').trim(), freccina: !!g && g.closest('svg').getBoundingClientRect().width > 0 };
    });
    ok('3. accanto alle righine c\'è il nome del viaggio con la freccina', tasto.testo === 'Lisbona' && tasto.freccina, tasto.testo + (tasto.freccina ? ' ▾' : ' (senza freccina)'));
    await p.locator('#menuViaggi').click();
    const aperto = await foglioAperto(p, 'mViaggi');
    const voci = await p.evaluate(() => {
      const m = document.getElementById('mViaggi');
      const vedo = re => [...m.querySelectorAll('button')].some(b => re.test(b.innerText) && b.getClientRects().length && b.getBoundingClientRect().bottom <= innerHeight);
      return { aggiungi: vedo(/Aggiungi viaggio/), excel: vedo(/Importa da Excel/), codice: vedo(/Ho un codice/),
        viaggi: [...m.querySelectorAll('.vg-voce b')].map(b => b.textContent) };
    });
    ok('3. un tocco su «Lisbona ▾» apre l\'elenco dei viaggi', aperto && voci.viaggi.includes('Lisbona') && voci.viaggi.includes('Porto'), voci.viaggi.join(', '));
    ok('3. … con «Aggiungi viaggio», «Importa da Excel» e «Ho un codice», a schermo', voci.aggiungi && voci.excel && voci.codice, JSON.stringify(voci));
    await p.locator('#cassChiudi').click();
    const chiuso = await aspetta(p, () => !document.getElementById('mViaggi').classList.contains('active'));
    ok('3. ritoccando il nome il cassetto si richiude', chiuso);
    const tondo = await p.evaluate(() => { const b = document.getElementById('tbProfilo'); return { testo: b.textContent.trim(), etichetta: b.getAttribute('aria-label') }; });
    await p.locator('#tbProfilo').click();
    const profilo = await aspetta(p, () => document.getElementById('trips').classList.contains('active'));
    ok('3. il Profilo si apre con un tocco, dal tondo con l\'iniziale in alto a destra', profilo && tondo.testo === 'A' && tondo.etichetta === 'Profilo', `«${tondo.testo}», ${tondo.etichetta}`);
    await p.close();
    // senza un nome, il tondo dice «Profilo»
    const q = await apri(browser);
    const senza = await q.evaluate(intero => { app.myName = ''; T().participants.forEach(x => { if (x.isMe) x.name = ''; }); save(); renderAll();
      const b = document.getElementById('tbProfilo'), q2 = b.getBoundingClientRect();
      return { testo: b.textContent.trim(), intero: eval(intero)(b), dentro: q2.right <= innerWidth }; }, INTERO.toString());
    ok('3. senza un nome, al posto dell\'iniziale c\'è la scritta «Profilo», intera', senza.testo === 'Profilo' && senza.intero && senza.dentro, JSON.stringify(senza));
    await q.close();
  });

  /* ── 4. «✈️ Viaggio» apre la scheda del viaggio ────────────────────────── */
  await prova('4', async () => {
    const p = await apri(browser);
    await p.locator('#homeHero .hh-rapido', { hasText: 'Viaggio' }).click();
    const aperta = await foglioAperto(p, 'mTripZoom');
    const dentro = await p.evaluate(() => {
      const b = document.getElementById('tripZoomBody'), t = b.innerText;
      return { nome: /Lisbona/.test(t), voci: ['Rinomina', 'Giorni', 'Concludi viaggio', 'Elimina viaggio', 'Consigli', 'Punti di ripristino', 'Il ricordo', 'Diario PDF', 'PDF dell\'itinerario', 'Esporta nel calendario']
        .filter(v => ![...b.querySelectorAll('button')].some(x => x.innerText.includes(v))) };
    });
    ok('4. «✈️ Viaggio» apre la scheda del viaggio', aperta && dentro.nome);
    ok('4. … con rinomina, giorni, concludi, elimina, consigli, punti di ripristino, ricordo, diario, PDF dell\'itinerario e calendario', !dentro.voci.length, dentro.voci.length ? 'mancano: ' + dentro.voci.join(', ') : '10 voci');
    await p.close();
  });

  /* ── 5. il ricordo, a viaggio in corso ─────────────────────────────────── */
  await prova('5', async () => {
    const p = await apri(browser);
    const inCorso = await p.evaluate(() => T().status === 'open' && T().start <= new Date().toISOString().slice(0, 10));
    await p.locator('#homeHero .hh-rapido', { hasText: 'Viaggio' }).click();
    await foglioAperto(p, 'mTripZoom');
    await p.locator('#tripZoomBody button', { hasText: 'Il ricordo' }).click();
    const aperto = await foglioAperto(p, 'mRicordo');
    const ricordo = await p.evaluate(() => ({ titolo: document.getElementById('ricordoTitolo').textContent, corpo: document.getElementById('ricordoBody').innerText.replace(/\s+/g, ' ').slice(0, 120),
      ancoraAperto: T().status === 'open' }));
    ok('5. per un viaggio in corso «📖 Il ricordo» apre il ricordo', inCorso && aperto && ricordo.titolo === 'Lisbona' && /giorni/i.test(ricordo.corpo), `${ricordo.titolo} · ${ricordo.corpo}`);
    ok('5. … e il viaggio resta in corso (aprirlo non lo conclude)', ricordo.ancoraAperto);
    await p.close();
  });

  /* ── 6. il portoghese a 320 px, «ADESSO» e «ora» ───────────────────────── */
  await prova('6', async () => {
    const p = await apri(browser, { lingua: 'pt', larghezza: 320 });
    const c = await p.evaluate(intero => {
      const INTERO = eval(intero);
      const b = document.querySelector('#homeHero .hh-cerca'), l = b.querySelector('.hh-cerca-l'), s = b.querySelector('.hh-cerca-c'), rc = document.querySelector('#homeHero .hh-raccolta');
      const vis = x => !!x && x.getClientRects().length > 0;
      const q = b.getBoundingClientRect(), qr = rc ? rc.getBoundingClientRect() : null;
      /* «A raccolta» a 320 px va a capo fra le parole, apposta: lì basta che
         stia dentro il suo tasto. */
      const dentroIlTasto = el => { const rg = document.createRange(); rg.selectNodeContents(el); const a = rg.getBoundingClientRect(), z = el.getBoundingClientRect(); return a.left >= z.left - 0.5 && a.right <= z.right + 0.5 && a.top >= z.top - 0.5 && a.bottom <= z.bottom + 0.5; };
      return { corto: b.classList.contains('corto'), lungo: vis(l), visibile: vis(s), testo: s ? s.textContent.trim() : '', atteso: tv('Cosa cerchi?'), lungoTradotto: tv('Cosa cerchi qui intorno?'),
        intero: !!s && INTERO(s) && q.right <= innerWidth, dentro: !qr || qr.right <= innerWidth,
        raccolta: rc ? rc.innerText.replace(/\s+/g, ' ').trim() : '', raccoltaIntera: !!rc && dentroIlTasto(rc) };
    }, INTERO.toString());
    ok('6. in portoghese a 320 px «Cosa cerchi» passa alla forma corta', c.corto && !c.lungo && c.visibile && c.testo === c.atteso && c.atteso !== 'Cosa cerchi?' && c.testo !== c.lungoTradotto, `«${c.testo}» invece di «${c.lungoTradotto}»`);
    ok('6. … intera, senza puntini, e accanto «A raccolta» resta intero anche lui', c.intero && c.dentro && c.raccoltaIntera && !/…/.test(c.testo), `«${c.testo}» · «${c.raccolta}»`);
    await p.close();
    const viste = [];
    for (const lingua of ['it', 'en', 'es', 'fr', 'pt']) {
      const q = await apri(browser, { lingua, viaggi: [soloAdesso(), porto()] });
      const v = await q.evaluate(() => ({ etichetta: (document.querySelector('.hh-soon .hh-soon-l') || {}).textContent || '',
        anello: (document.querySelector('.hh-soon .hh-ring span') || {}).textContent || '' }));
      const d = await q.evaluate(l => l === 'it' ? { ADESSO: 'ADESSO', ora: 'ora' } : { ADESSO: DIZIONARIO_DATI[l].ADESSO, ora: DIZIONARIO_DATI[l].ora }, lingua);
      const giusto = v.etichetta === d.ADESSO && v.anello === d.ora && (lingua === 'it' || (v.etichetta !== 'ADESSO' && v.anello !== 'ora'));
      viste.push([lingua, giusto, `«${v.etichetta}» «${v.anello}»`]);
      await q.close();
    }
    ok('6. nel riquadro «Fra poco» «ADESSO» e «ora» sono nella lingua dell\'app', viste.every(x => x[1]), viste.map(x => `${x[0]} ${x[2]}`).join(' · '));
  });

  /* ── 7. MAPPA_APP ──────────────────────────────────────────────────────── */
  await prova('7', async () => {
    const p = await apri(browser);
    const m = await p.evaluate(() => {
      const riga = inizio => MAPPA_APP.split('\n').find(l => l.startsWith('- ' + inizio)) || '';
      const domande = [
        ['Come cambio viaggio?', /"Lisbona ▾"/], ['How do I switch trip?', /"Lisbona ▾"/], ['¿Dónde está el perfil?', /tondo con l'iniziale/],
        ['Dove trovo il ricordo del viaggio?', /"Il ricordo"/], ['Où est le souvenir du voyage ?', /"Il ricordo"/],
        ['Dove trovo Autopilota?', /"Autopilota"/], ['Onde está o piloto automático?', /"Autopilota"/],
        ['Come si annulla uno spostamento?', /"Annulla"/], ['Where are the restore points?', /"Punti di ripristino"/],
        ['Dove si spengono i consigli?', /"Consigli nei dintorni"/], ['Dove allego un PDF in chat?', /"PDF"/]
      ];
      return {
        barra: riga('La barra in basso'), righine: riga('Le TRE RIGHINE'), home: riga('Home'), tt: riga('Time Table'), scopri: riga('Scopri'),
        spese: riga('Spese'), meteo: riga('Meteo'), ricordo: riga('Il ricordo del viaggio'), profilo: riga('Profilo'),
        vecchie: [/"Costruisci la giornata"[^.]*dietro/, /si tocca la temperatura \("22°"\)/, /un tondo con la scritta "Recupero"/].filter(re => re.test(MAPPA_APP)).map(String),
        risposte: domande.map(([d, re]) => [d, re.test(mappaPerDomanda(d))])
      };
    });
    const casi = [
      ['in alto «Lisbona ▾», col cassetto (Aggiungi viaggio, Importa da Excel, Ho un codice), la pillola «GPS» e il Profilo a un tocco',
        /"Lisbona ▾"/.test(m.righine) && /"Aggiungi viaggio", "Importa da Excel", "Ho un codice"/.test(m.righine) && /pillola "GPS"/.test(m.righine) && /tondo con l'iniziale, che apre il Profilo con un tocco/.test(m.righine)],
      ['la barra in basso senza scritte, il Profilo e il Meteo fuori dalla barra', /Sotto le icone non ci sono scritte/.test(m.barra) && /tondo con l'iniziale in alto a destra/.test(m.barra) && /"22° · Meteo ›"/.test(m.barra)],
      ['in Home «22° · Meteo ›», «✈️ Viaggio» nella fila, «+ Aggiungi» e «✦ Su misura» nei viaggi senza giorni',
        /"22° · Meteo ›"/.test(m.home) && /"Viaggio" \(apre la scheda del viaggio/.test(m.home) && /"Aggiungi"/.test(m.home) && /"Su misura"/.test(m.home)],
      ['nella scheda del viaggio «📖 Il ricordo» anche in corso, «📄 Diario PDF», «📋 PDF dell\'itinerario» e il calendario (che si aggiorna, o «🗓️ Esporta nel calendario» senza account)',
        /"Il ricordo" \(anche a viaggio in corso\), "Diario PDF", "PDF dell'itinerario" e "Calendario che si aggiorna" \(per i viaggi nel cloud; senza account al suo posto c'e' "Esporta nel calendario"\)/.test(m.home) && /anche a viaggio in corso/.test(m.ricordo)],
      ['in Time Table «✦ Ordina il giro» e «🪄 Autopilota» come tasti, «＋ Aggiungi», «↩ Annulla», il mezzo che risponde intorno',
        /"Ordina il giro"/.test(m.tt) && /"Autopilota"/.test(m.tt) && /"Costruisci la giornata" non c'e' piu'/.test(m.tt) && /"Aggiungi"/.test(m.tt) && /"Annulla"/.test(m.tt) && /risponde anche un po' intorno/.test(m.tt)],
      ['in Scopri «📎 PDF» e l\'interruttore «Consigli nei dintorni»; Su misura anche in Home e in «Nuovo viaggio»; la prenotazione anche in Biglietti',
        /"PDF"/.test(m.scopri) && /"Consigli nei dintorni"/.test(m.scopri) && /foglio "Nuovo viaggio"/.test(m.scopri) && /"Prenotazione dalla mail"/.test(m.scopri)],
      ['in Spese «+ Spesa» e «✓ Pagato»; il Meteo da «22° · Meteo ›»; nel Profilo «Punti di ripristino»',
        /"Spesa"/.test(m.spese) && /"Pagato"/.test(m.spese) && /"22° · Meteo ›"/.test(m.meteo) && /"Punti di ripristino"/.test(m.profilo) && /tondo con l'iniziale in alto a destra/.test(m.profilo)]
    ];
    casi.forEach(([n, c]) => ok('7. MAPPA_APP: ' + n, c));
    ok('7. i percorsi vecchi non ci sono più', !m.vecchie.length, m.vecchie.join(' '));
    const no = m.risposte.filter(x => !x[1]).map(x => x[0]);
    ok('7. l\'assistente riceve il percorso giusto, chiedendo in cinque lingue', !no.length, no.length ? 'senza risposta: ' + no.join(' | ') : m.risposte.length + ' domande');
    await p.close();
  });

  /* ── 8. i testi nuovi in cinque lingue ─────────────────────────────────── */
  await prova('8', async () => {
    const FRASI = ['✈️ Viaggio', '📖 Il ricordo', '📄 Diario PDF', '🗓️ Esporta nel calendario', 'Ordina il giro', 'Pagato', 'Punti di ripristino',
      'Consigli nei dintorni', 'Posti in linea con quelli che salvi, con un avviso quando ci passi vicino.', '✦ Su misura: appena creato, preparami l\'itinerario',
      '📩 Prenotazione dalla mail', 'ADESSO', 'ora', 'FRA POCO', 'PIÙ TARDI', 'DOMANI', 'DOPODOMANI', 'già passata', 'domani', 'dopodomani', '↩ Annulla', 'IN PROGRAMMA'];
    const p = await apri(browser);
    const mancano = await p.evaluate(fr => {
      const segni = s => (String(s).match(/\{\d\}/g) || []).sort().join('');
      const no = [];
      ['en', 'es', 'fr', 'pt'].forEach(l => fr.forEach(f => { const v = (DIZIONARIO_DATI[l] || {})[f]; if (!v || v === f || segni(v) !== segni(f)) no.push(`${l}: ${f}`); }));
      return no;
    }, FRASI);
    ok(`8. le ${FRASI.length} frasi nuove sono nel dizionario di en, es, fr e pt`, !mancano.length, mancano.slice(0, 4).join('; ') || `${FRASI.length * 4} traduzioni`);
    await p.close();
    /* E a schermo, nella lingua scelta: niente italiano rimasto nei pezzi
       nuovi. Si guarda il testo che si vede, schermata per schermata. */
    const ITALIANO = /Viaggio\b|Il ricordo|Diario PDF|Esporta nel calendario|Ordina il giro|Autopilota|Pagato|Punti di ripristino|Consigli nei dintorni|Prenotazione dalla mail|Su misura|ADESSO|PIÙ TARDI|FRA POCO|IN PROGRAMMA|\bAnnulla\b|\bAggiungi\b|\bSpesa\b|\bMeteo\b|I tuoi viaggi|Ho un codice/;
    const DOVE = [['casa', '.topbar, #homeHero, .hh-soon'], ['porto', '#homeHero'], ['cassetto', '#mViaggi'], ['scheda', '#tripZoomBody'],
      ['giornata', '#mDay .tt-azioni, #ttFab, #ttUndo'], ['scopri', '#sgRiga'], ['assistente', '#aiMode .chat-in-row'], ['spese', '#money .mh-top'],
      ['saldi', '#money .tic-tx'], ['biglietti', '#tickets .tk-mail'], ['nuovo', '#mNewTrip'], ['profilo', '#profileCard']];
    const rimasti = [];
    for (const lingua of ['en', 'es', 'fr', 'pt']) {
      const q = await apri(browser, { lingua });
      for (const [cosa, sel] of DOVE) {
        await PREPARA(q, cosa);
        const testo = await q.evaluate(s => [...document.querySelectorAll(s)].filter(x => x.getClientRects().length).map(x => x.innerText).join(' \n '), sel);
        const trovato = testo.match(ITALIANO);
        if (trovato) rimasti.push(`${lingua} ${cosa}: «${trovato[0]}»`);
      }
      await q.close();
    }
    ok('8. a schermo, in en, es, fr e pt, i testi nuovi non restano in italiano', !rimasti.length, rimasti.slice(0, 5).join(' | '));
  });

  ok('nessun errore in pagina', !errori.length, errori.slice(0, 3).join(' | '));
  await browser.close();
  r.forEach(x => console.log(x));
  const falliti = r.filter(x => x.includes('FALLITO')).length;
  console.log(`\n${r.length - falliti}/${r.length} passati`);
  process.exit(falliti ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
