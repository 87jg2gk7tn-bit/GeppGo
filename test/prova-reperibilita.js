/* I BAGAGLI A PORTATA DI MANO, NESSUNA FUNZIONE NASCOSTA.

   La lista bagagli si trovava solo dentro la scheda del viaggio, e la
   scheda si apre toccando un titolo o il viaggio nel Profilo: il proprietario
   l'ha cercata e ha dovuto chiedere all'assistente dove fosse. Prima di
   partire e' la cosa che serve di piu'. Adesso in Home, sotto l'intestazione
   del viaggio, c'e' una fila con la scritta («🧳 Bagagli», «👥 Compagni»,
   «🔗 Condividi»), e nei sette giorni prima della partenza e il primo giorno
   una scheda «Prepara la valigia» con quante voci sono pronte.

   1. in Home la fila c'e', si vede, e i tre tasti aprono Bagagli, Compagni
      e Condividi;
   2. fila e scheda stanno nello schermo da 320 a 430 px, con tasti di
      almeno 44 px, in tema chiaro e scuro;
   3. la scheda compare nei 7 giorni prima della partenza e il primo giorno,
      col conto giusto; non prima, e non dal secondo giorno;
   4. chiusa con la X, non ricompare fino al giorno dopo;
   5. la lista bagagli si apre ancora anche dalla scheda del viaggio;
   6. MAPPA_APP dice il percorso nuovo (e l'assistente lo legge, in ogni
      lingua);
   7. i testi nuovi sono tradotti in cinque lingue. */
const fs = require('fs');
const path = require('path');
const { apriBrowser, APP, leafletJs, RADICE } = require('./browser');
const { fileURLToPath } = require('url');
/* I file si leggono da dove sta l'app che si prova: con APP_URL che punta
   a una copia (la controprova sul codice di prima) si legge quella. */
const CARTELLA = APP.startsWith('file://') ? path.dirname(fileURLToPath(APP)) : RADICE;

const r = [];
const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);
const errori = [];

/* ── le date: a mezzogiorno, contando i giorni sul calendario ────────────
   Sommare 24 ore puo' sbagliare giorno nella notte del cambio d'ora; il
   mezzogiorno di un giorno di calendario no. */
const giornoA = (scarto, base = new Date()) => { const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + scarto, 12, 0, 0); return d; };
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const dataFra = (scarto, base) => iso(giornoA(scarto, base));

/* Un viaggio di quattro giorni che parte fra `fra` giorni (negativo: e'
   gia' cominciato). Il primo giorno ha una tappa, cosi' in Home c'e' anche
   «Fra poco», che sale sull'intestazione proprio dove sta la scheda. */
function viaggio(fra, extra = {}) {
  const giorni = [0, 1, 2, 3].map(i => ({ id: 'd' + i, date: dataFra(fra + i), title: '', activities: i ? [] : [
    { id: 501, name: 'Torre di Belém', time: '10:00', timeEnd: '11:30', type: 'any', who: [], completed: false, lat: 38.6916, lng: -9.2160, booking: { needed: false, done: false } }] }));
  return Object.assign({
    id: 1, name: 'Lisbona', destination: 'Lisbona', currency: 'EUR', status: 'open',
    start: giorni[0].date, end: giorni[3].date,
    participants: [{ id: 11, name: 'Anna', isMe: true }, { id: 12, name: 'Bruno' }], guests: [],
    pois: [], hotels: [], tickets: [], expenses: [], weather: {}, createdAt: 1, days: giorni
  }, extra);
}
/* Trenta voci, dodici gia' in valigia. */
const VALIGIA = Array.from({ length: 30 }, (_, i) => ({ id: 'v' + i, cat: ['Documenti', 'Elettronica', 'Igiene', 'Abbigliamento', 'Extra'][i % 5], label: 'Voce ' + (i + 1), checked: i < 12, custom: false, t: 0 }));

async function apri(browser, { fra = 3, viaggioExtra = {}, larghezza = 390, scuro = false, lingua = null, valigia = VALIGIA, ora = null, extraLs = null } = {}) {
  const page = await browser.newPage({ viewport: { width: larghezza, height: 844 } });
  page.on('pageerror', e => errori.push('PAGEERROR: ' + e.message.split('\n')[0]));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_BLOCKED|net::/.test(m.text())) errori.push('CONSOLE: ' + m.text().slice(0, 140)); });
  await page.route('**/leaflet@1.9.4/dist/leaflet.js', ro => ro.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(leafletJs(), 'utf8') }));
  await page.route(/tile\.openstreetmap\.org/, ro => ro.abort());
  if (ora) await page.clock.install({ time: ora });
  await page.addInitScript(([t, scuro, lingua, valigia, x]) => {
    if (sessionStorage.getItem('prova-reperibilita')) return;
    sessionStorage.setItem('prova-reperibilita', '1');
    localStorage.clear();
    const st = { trips: [t], currentTripId: t.id, settings: { dark: scuro }, myName: 'Anna', skipAuth: true, consentNotif: false };
    if (lingua) st.settings.lingua = lingua;
    localStorage.setItem('geppgo2', JSON.stringify(st));
    localStorage.setItem('geppgo2_intro', '1');
    localStorage.setItem('geppgo2_avviso_home', String(Date.now()));
    if (valigia) localStorage.setItem('geppgo2_pack_' + t.id + '_local', JSON.stringify(valigia));
    if (x) Object.keys(x).forEach(k => localStorage.setItem(k, x[k]));
  }, [viaggio(fra, viaggioExtra), scuro, lingua, valigia, extraLs]);
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.renderAll === 'function' && !document.getElementById('bootSplash'), null, { timeout: 30000 });
  await page.waitForTimeout(300);
  return page;
}
const prova = async (nome, fn) => { try { await fn(); } catch (e) { ok(nome, false, 'si è fermata: ' + e.message.split('\n')[0]); } };
const aspetta = (p, fn, arg, ms = 5000) => p.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
const foglioAperto = (p, id) => aspetta(p, i => { const m = document.getElementById(i); return !!m && m.classList.contains('active'); }, id, 3000);
const chiudiFogli = p => p.evaluate(() => document.querySelectorAll('.modal.active').forEach(m => closeSheet(m.id)));
/* Le misure di fila e scheda, come le vede chi ha il telefono in mano:
   - fuori: un pezzo che esce dallo schermo, un testo che esce dal suo tasto,
     la pagina che scorre di lato;
   - piccoli: tasti sotto i 44×44 px;
   - spezzate: parole tagliate a meta' fra due righe;
   - coperti: tasti con sopra un'altra cosa (al centro del tasto il dito
     tocca altro);
   - addosso: la scheda che copre la fila o finisce sotto «Fra poco». */
const MISURA = () => {
  const out = { tema: document.body.classList.contains('dark') ? 'scuro' : 'chiaro', fuori: [], piccoli: [], spezzate: [], coperti: [], addosso: [], tasti: 0 };
  if (document.documentElement.scrollWidth > innerWidth + 1) out.fuori.push('la pagina scorre di lato');
  const fila = document.querySelector('#homeHero .hh-rapidi'), vs = document.querySelector('#homeHero #valScheda'), so = document.querySelector('#homeHero .hh-soon');
  const tasti = [...document.querySelectorAll('#homeHero .hh-rapido, #homeHero #valScheda .val-x, #homeHero #valScheda .val-apri')];
  out.tasti = tasti.length;
  const nome = el => (el.className || el.id || '').toString().split(' ')[0] + ' «' + el.textContent.trim().slice(0, 18) + '»';
  [fila, vs].concat(tasti).forEach(el => {
    if (!el) { out.fuori.push('manca un pezzo'); return; }
    const q = el.getBoundingClientRect();
    if (q.left < -0.5 || q.right > innerWidth + 0.5) out.fuori.push(nome(el) + ` ${Math.round(q.left)}..${Math.round(q.right)}`);
    if (el.scrollWidth > el.clientWidth + 1) out.fuori.push(nome(el) + ' testo che esce');
  });
  tasti.forEach(b => {
    const q = b.getBoundingClientRect();
    if (q.height < 44 || q.width < 44) out.piccoli.push(nome(b) + ' ' + Math.round(q.width) + '×' + Math.round(q.height));
    const x = q.left + q.width / 2, y = q.top + q.height / 2;
    if (y > 0 && y < innerHeight) { const h = document.elementFromPoint(x, y); if (!h || (h !== b && !b.contains(h))) out.coperti.push(nome(b) + ' sotto ' + (h ? (h.id ? '#' + h.id : (h.className || h.tagName).toString().split(' ')[0]) : 'niente')); }
  });
  // le parole: ognuna su una riga sola, nei tasti e nei testi della scheda
  const testi = tasti.concat(vs ? [...vs.querySelectorAll('.val-t, .val-quando, .val-conto')] : []);
  testi.forEach(el => {
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) {
      const re = /\S+/g; let m;
      while ((m = re.exec(n.data))) {
        const rg = document.createRange(); rg.setStart(n, m.index); rg.setEnd(n, m.index + m[0].length);
        if (new Set([...rg.getClientRects()].map(x => Math.round(x.top))).size > 1) out.spezzate.push(m[0]);
      }
    }
  });
  if (vs && fila && vs.getBoundingClientRect().top < fila.getBoundingClientRect().bottom - 0.5) out.addosso.push('la scheda copre la fila');
  if (vs && so && vs.getBoundingClientRect().bottom > so.getBoundingClientRect().top + 0.5) out.addosso.push('«Fra poco» finisce sopra la scheda');
  const b = document.querySelector('#homeHero .hh-rapido');
  if (b) { const cs = getComputedStyle(b); if (cs.color === cs.backgroundColor) out.fuori.push('testo invisibile ' + cs.color); }
  return out;
};
/* Cosa dice la scheda della valigia in Home (null se non c'e'). */
const scheda = p => p.evaluate(() => {
  const el = document.querySelector('#homeHero #valScheda');
  if (!el) return null;
  const b = el.querySelector('.val-barra i');
  return { titolo: (el.querySelector('.val-t') || {}).textContent || '', quando: (el.querySelector('.val-quando') || {}).textContent || '',
    conto: (el.querySelector('.val-conto') || {}).textContent || '', barra: b ? b.style.width : '' };
});

(async () => {
  const browser = await apriBrowser();

  /* ── 1. la fila in Home: si vede e apre le tre cose ────────────────────── */
  await prova('1', async () => {
    const p = await apri(browser, { fra: 20 });
    const fila = await p.evaluate(() => {
      const f = document.querySelector('#homeHero .hh-rapidi');
      if (!f) return null;
      const rf = f.getBoundingClientRect();
      const st = getComputedStyle(f);
      return { testi: [...f.querySelectorAll('.hh-rapido')].map(b => b.textContent.trim()), visibile: rf.height > 0 && st.display !== 'none' && st.visibility !== 'hidden',
        sopraLaPiega: rf.top >= 0 && rf.bottom <= innerHeight,
        sottoCerca: (() => { const c = document.querySelector('#homeHero .hh-cerca'); return !!c && c.getBoundingClientRect().bottom <= rf.top + 1; })() };
    });
    ok('1. in Home c\'è la fila di accessi rapidi, con icona e testo', !!fila && JSON.stringify(fila.testi) === JSON.stringify(['🧳 Bagagli', '👥 Compagni', '🔗 Condividi']), fila ? fila.testi.join(' | ') : 'nessuna fila');
    ok('1. la fila si vede subito, senza scorrere, sotto «Cosa cerchi qui intorno?»', !!fila && fila.visibile && fila.sopraLaPiega && fila.sottoCerca, JSON.stringify(fila));
    const casi = [['🧳 Bagagli', 'mPacking'], ['👥 Compagni', 'mPeople'], ['🔗 Condividi', 'mShare']];
    for (const [testo, foglio] of casi) {
      await p.locator('#homeHero .hh-rapido', { hasText: testo }).click();
      const aperto = await foglioAperto(p, foglio);
      const dentro = await p.evaluate(f => {
        const m = document.getElementById(f);
        return f === 'mPacking' ? m.querySelectorAll('input[type=checkbox], .pack-item, .pk-item').length || (m.textContent.match(/Voce \d+/g) || []).length
          : f === 'mPeople' ? /Anna/.test(m.textContent) && /Bruno/.test(m.textContent)
          : /Lisbona/.test(m.textContent);
      }, foglio);
      ok(`1. «${testo}» apre il suo foglio`, aperto && !!dentro, `${foglio} ${aperto ? 'aperto' : 'chiuso'}, dentro: ${dentro}`);
      await chiudiFogli(p);
      await p.waitForTimeout(250);
    }
    // anche in un viaggio che non ha ancora i giorni la fila c'e'
    const p2 = await apri(browser, { viaggioExtra: { days: [], start: '', end: '' } });
    const senzaGiorni = await p2.evaluate(() => [...document.querySelectorAll('#homeHero .hh-rapido')].map(b => b.textContent.trim()).join(' | '));
    ok('1. la fila c\'è anche in un viaggio senza giorni', senzaGiorni === '🧳 Bagagli | 👥 Compagni | 🔗 Condividi', senzaGiorni || 'nessuna');
    await p.close(); await p2.close();
  });

  /* ── 2. nello schermo da 320 a 430, tasti da un dito, chiaro e scuro ──── */
  await prova('2', async () => {
    const fuori = [], piccoli = [], spezzate = [], coperti = [];
    let misurati = 0;
    for (const scuro of [false, true]) {
      for (const larghezza of [320, 360, 375, 390, 414, 430]) {
        const p = await apri(browser, { fra: 3, larghezza, scuro });
        const m = await p.evaluate(MISURA);
        misurati++;
        const tag = `${larghezza}px ${m.tema}`;
        if (m.tema !== (scuro ? 'scuro' : 'chiaro')) fuori.push(tag + ': tema sbagliato');
        if (m.tasti !== 5) fuori.push(tag + `: ${m.tasti} tasti invece di 5`);
        m.fuori.forEach(x => fuori.push(tag + ': ' + x));
        m.piccoli.forEach(x => piccoli.push(tag + ': ' + x));
        m.spezzate.forEach(x => spezzate.push(tag + ': ' + x));
        m.coperti.concat(m.addosso).forEach(x => coperti.push(tag + ': ' + x));
        await p.close();
      }
    }
    ok('2. fila e scheda stanno nello schermo da 320 a 430 px, in tema chiaro e scuro', fuori.length === 0 && misurati === 12, fuori.slice(0, 4).join('; ') || `${misurati} misure`);
    ok('2. tutti i tasti di fila e scheda sono di almeno 44×44 px', piccoli.length === 0, piccoli.slice(0, 4).join('; '));
    ok('2. nessuna parola spezzata a metà', spezzate.length === 0, spezzate.slice(0, 4).join('; '));
    ok('2. niente copre i tasti, e la scheda non sta addosso alla fila né a «Fra poco»', coperti.length === 0, coperti.slice(0, 4).join('; '));
  });

  /* ── 3. quando compare la scheda, e il conto ───────────────────────────── */
  await prova('3', async () => {
    const casi = [
      [8, false, 'otto giorni prima'],
      [7, /^Si parte fra 7 giorni$/, 'sette giorni prima'],
      [3, /^Si parte fra 3 giorni$/, 'tre giorni prima'],
      [1, /^Si parte domani$/, 'il giorno prima'],
      [0, /^Si parte oggi$/, 'il primo giorno'],
      [-1, false, 'il secondo giorno'],
      [-3, false, 'l\'ultimo giorno']
    ];
    const esiti = [];
    for (const [fra, atteso, nome] of casi) {
      const p = await apri(browser, { fra });
      const s = await scheda(p);
      const giusto = atteso ? !!s && s.titolo === '🧳 Prepara la valigia' && atteso.test(s.quando) && s.conto === '12 su 30 pronte' && s.barra === '40%' : s === null;
      esiti.push([nome, giusto, s ? `${s.quando} · ${s.conto} · ${s.barra}` : 'nessuna scheda', !!atteso]);
      await p.close();
    }
    esiti.forEach(([n, g, d, c]) => ok(c ? `3. ${n}: la scheda c'è, con «12 su 30 pronte»` : `3. ${n}: la scheda non c'è`, g, d));
    // il conto segue le spunte, senza ridisegnare la Home
    const p = await apri(browser, { fra: 2 });
    await p.locator('#valScheda .val-apri').click();
    await foglioAperto(p, 'mPacking');
    const spuntata = await p.evaluate(() => {
      const t = T(), voci = getPacking(t);
      const v = voci.find(x => !x.checked); v.checked = true; savePacking(t, voci);
      const el = document.getElementById('valScheda');
      return el ? el.querySelector('.val-conto').textContent : 'scheda sparita';
    });
    ok('3. spuntare una voce aggiorna il conto della scheda', spuntata === '13 su 30 pronte', spuntata);
    await p.close();
    // lista vuota: lo dice, e il tasto la riempie coi suggerimenti
    const pv = await apri(browser, { fra: 2, valigia: null });
    const vuota = await scheda(pv);
    await pv.locator('#valScheda .val-apri').click();
    const piena = await foglioAperto(pv, 'mPacking') && await pv.evaluate(() => getPacking(T()).length);
    ok('3. con la lista vuota la scheda lo dice, e «Apri la lista» la prepara', !!vuota && vuota.conto === 'La lista è ancora vuota' && piena > 0, (vuota ? vuota.conto : 'nessuna scheda') + ` · voci dopo: ${piena}`);
    await pv.close();
    // un viaggio concluso non chiede di fare la valigia
    const pc = await apri(browser, { fra: 2, viaggioExtra: { status: 'closed' } });
    ok('3. un viaggio concluso non mostra la scheda', (await scheda(pc)) === null);
    await pc.close();
  });

  /* ── 4. chiusa con la X, torna il giorno dopo ──────────────────────────── */
  await prova('4', async () => {
    const oggi = giornoA(0), domani = giornoA(1);
    const p = await apri(browser, { fra: 4, ora: oggi });
    const prima = await scheda(p);
    await p.locator('#valScheda .val-x').click();
    const dopoX = await scheda(p);
    await p.evaluate(() => renderAll());
    const dopoRender = await scheda(p);
    await p.reload({ waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof window.renderAll === 'function' && !document.getElementById('bootSplash'), null, { timeout: 30000 });
    await p.waitForTimeout(300);
    const dopoRiapertura = await scheda(p);
    ok('4. la X chiude la scheda, e non torna né ridisegnando né riaprendo l\'app', !!prima && dopoX === null && dopoRender === null && dopoRiapertura === null,
      `prima: ${prima ? prima.quando : '-'} · dopo la X: ${dopoX ? 'c\'è' : 'via'} · ridisegnata: ${dopoRender ? 'c\'è' : 'via'} · riaperta: ${dopoRiapertura ? 'c\'è' : 'via'}`);
    // l'orologio va a domani: la scheda torna, con un giorno di meno
    await p.clock.setSystemTime(domani);
    await p.reload({ waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof window.renderAll === 'function' && !document.getElementById('bootSplash'), null, { timeout: 30000 });
    await p.waitForTimeout(300);
    const domaniS = await scheda(p);
    ok('4. il giorno dopo la scheda torna, con un giorno di meno', !!domaniS && domaniS.quando === 'Si parte fra 3 giorni', domaniS ? domaniS.quando : 'nessuna scheda');
    await p.close();
  });

  /* ── 5. la lista si apre ancora dalla scheda del viaggio ───────────────── */
  await prova('5', async () => {
    const p = await apri(browser, { fra: 20 });
    // come farebbe una persona: Time Table dalla barra, il titolo, «🎒 Bagagli»
    await p.locator('.nav-item[data-p="mDay"]').click();
    await p.locator('#ttEyebrow').click();
    const scheda = await foglioAperto(p, 'mTripZoom');
    await p.locator('#tripZoomBody button', { hasText: 'Bagagli' }).click();
    const lista = await foglioAperto(p, 'mPacking');
    const voci = await p.evaluate(() => (document.getElementById('mPacking').textContent.match(/Voce \d+/g) || []).length);
    ok('5. dalla scheda del viaggio «🎒 Bagagli» apre ancora la lista', scheda && lista && voci === 30, `scheda ${scheda ? 'aperta' : 'chiusa'}, lista ${lista ? 'aperta' : 'chiusa'}, ${voci} voci`);
    // e dal Profilo, toccando il viaggio (l'aereo)
    await chiudiFogli(p);
    await p.evaluate(() => { go('trips'); });
    await p.waitForTimeout(250);
    await p.locator('.hist-card', { hasText: 'Lisbona' }).first().click();
    const dalProfilo = await foglioAperto(p, 'mTripZoom');
    ok('5. la scheda del viaggio si apre ancora dal Profilo, e ha «🎒 Bagagli»', dalProfilo && await p.locator('#tripZoomBody button', { hasText: 'Bagagli' }).count() === 1);
    await p.close();
  });

  /* ── 6. MAPPA_APP: il percorso nuovo ───────────────────────────────────── */
  await prova('6', async () => {
    const p = await apri(browser, { fra: 20 });
    const m = await p.evaluate(() => {
      const home = (MAPPA_APP.split('\n').find(l => l.startsWith('- Home:')) || '');
      const domande = ['Dove trovo la lista bagagli?', 'Where is the packing list in the app?', '¿Dónde está la lista de equipaje?', 'Où est la liste de bagages ?', 'Onde está a lista de bagagem?'];
      return { home, vecchia: /I bagagli stanno nella scheda del viaggio, dov'erano gia'/.test(MAPPA_APP),
        risposte: domande.map(d => /"🧳 Bagagli"/.test(mappaPerDomanda(d))) };
    });
    ok('6. MAPPA_APP dice che in Home c\'è «🧳 Bagagli», sotto «Cosa cerchi qui intorno?»', /Subito sotto, una fila di tre tasti con la scritta: "🧳 Bagagli" \(apre la lista bagagli\), "👥 Compagni" .* e "🔗 Condividi"/.test(m.home), m.home.slice(0, 80));
    ok('6. … e che la lista resta anche nella scheda del viaggio, e c\'è la scheda «Prepara la valigia»', /anche nella scheda del viaggio \("🎒 Bagagli"\)/.test(m.home) && /"Prepara la valigia"/.test(m.home) && /si chiude con la X e torna il giorno dopo/.test(m.home));
    ok('6. il vecchio percorso («stanno nella scheda del viaggio») non c\'è più', !m.vecchia);
    ok('6. l\'assistente riceve il percorso nuovo chiedendo dei bagagli, in tutte e cinque le lingue', m.risposte.every(Boolean), m.risposte.map(x => x ? 'sì' : 'no').join(' '));
    await p.close();
  });

  /* ── 7. i testi nuovi in cinque lingue ─────────────────────────────────── */
  await prova('7', async () => {
    const FRASI = ['🧳 Bagagli', '👥 Compagni', '🔗 Condividi', '🧳 Prepara la valigia', 'Si parte oggi', 'Si parte domani', 'Si parte fra {1} giorni', '{1} su {2} pronte', 'La lista è ancora vuota', 'Apri la lista'];
    const p = await apri(browser, { fra: 20 });
    const diz = await p.evaluate(fr => {
      const out = {};
      ['en', 'es', 'fr', 'pt'].forEach(l => { out[l] = fr.map(f => { const v = (DIZIONARIO_DATI[l] || {})[f]; return { f, v: v || null }; }); });
      return out;
    }, FRASI);
    const mancano = [];
    Object.keys(diz).forEach(l => diz[l].forEach(({ f, v }) => {
      const segni = s => (s.match(/\{\d\}/g) || []).sort().join('');
      if (!v || v === f || segni(v) !== segni(f)) mancano.push(`${l}: ${f}`);
    }));
    ok('7. le 10 frasi nuove sono nel dizionario di en, es, fr e pt, coi segnaposto', mancano.length === 0, mancano.slice(0, 4).join('; ') || '40 traduzioni');
    await p.close();
    // e a schermo: fila e scheda nella lingua scelta, senza italiano rimasto
    const viste = [];
    for (const lingua of ['en', 'es', 'fr', 'pt']) {
      const q = await apri(browser, { fra: 5, lingua });
      const v = await q.evaluate(() => ({
        fila: [...document.querySelectorAll('#homeHero .hh-rapido')].map(b => b.textContent.trim()),
        scheda: (document.getElementById('valScheda') || {}).innerText || ''
      }));
      const d = diz[lingua].reduce((o, x) => (o[x.f] = x.v, o), {});
      const atteso = [d['🧳 Bagagli'], d['👥 Compagni'], d['🔗 Condividi']];
      const conto = d['{1} su {2} pronte'].replace('{1}', '12').replace('{2}', '30');
      const quando = d['Si parte fra {1} giorni'].replace('{1}', '5');
      const giusto = JSON.stringify(v.fila) === JSON.stringify(atteso) && v.scheda.includes(d['🧳 Prepara la valigia']) && v.scheda.includes(conto)
        && v.scheda.includes(quando) && v.scheda.includes(d['Apri la lista']) && !/Prepara la valigia|pronte|Si parte|Apri la lista/.test(v.scheda);
      viste.push([lingua, giusto, v.fila.join(' | ') + ' · ' + v.scheda.replace(/\s+/g, ' ').slice(0, 90)]);
      await q.close();
    }
    viste.forEach(([l, g, d]) => ok(`7. in ${l} fila e scheda sono tradotte`, g, d));
    // tradotte le parole si allungano («Companheiros»): da 320 a 430 px tutto
    // resta dentro, intero e toccabile
    const lunghe = [];
    for (const lingua of ['en', 'es', 'fr', 'pt']) {
      for (const larghezza of [320, 430]) {
        const q = await apri(browser, { fra: 5, lingua, larghezza });
        const m = await q.evaluate(MISURA);
        m.fuori.concat(m.piccoli, m.spezzate.map(x => 'parola spezzata: ' + x), m.coperti, m.addosso).forEach(x => lunghe.push(`${lingua} ${larghezza}px: ${x}`));
        await q.close();
      }
    }
    ok('7. tradotti, da 320 a 430 px i tasti restano dentro, interi e alti un dito', lunghe.length === 0, lunghe.slice(0, 4).join('; '));
  });

  ok('nessun errore in pagina', !errori.length, errori.slice(0, 3).join(' | '));
  await browser.close();
  r.forEach(x => console.log(x));
  const falliti = r.filter(x => x.includes('FALLITO')).length;
  console.log(`\n${r.length - falliti}/${r.length} passati`);
  process.exit(falliti ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
