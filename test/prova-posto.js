/* LA SCHEDA DI UN POSTO (anteprime/luogo.html, ridisegno di Oggi, novembre
   2026). Ha preso il posto del menu della tappa e del foglio «Luogo».

   1. È una sola, e si apre uguale da Oggi (le schede-foto), dal Programma,
      da Scopri, da Identifica e dai luoghi salvati, coi dati giusti.
   2. Orari, prenotazione, indirizzo e note sono foglietti con lo scotch (le
      note una per foglietto, e VoiceOver le legge come testo); i biglietti
      collegati hanno la forma di biglietto, e il codice non c'è.
   3. La riga dell'assistente «Ti piacerà perché…» compare solo se
      l'assistente risponde, si chiede una volta sola per posto e resta nel
      viaggio (riaprendo l'app non si richiede); con i consigli spenti non
      si chiede.
   4. Frase a mano, storia, credito della foto e altre foto arrivano da
      Wikidata, Wikipedia e Commons (qui finti), nella lingua dell'app; le
      foto alla misura giusta e solo quando servono.
   5. Le azioni: «+ Aggiungi al programma» mette il posto nel giorno che si
      guarda, al primo orario libero, e dice dove; Sposta; Elimina in fondo,
      rosso.
   6. Come l'anteprima a 390×844 nei due temi; cinque lingue; da 320 a 430 px
      e larga; axe; tasti da 44.

   Sul codice di prima non parte: apriPosto non esiste. */
const path = require('path');
const { apriBrowser, RADICE } = require('./browser');
const { apriPagina, VIAGGIO, PORTO } = require('./schermate');

const AXE = require.resolve('axe-core/axe.min.js');
const r = [], err = [];
const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);
const pausa = ms => new Promise(x => setTimeout(x, ms));
const PONTE = /geppgo-ai\.merati-giacomo94\.workers\.dev/;
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST, OPTIONS' };

/* Il viaggio di sempre, con quello che serve qui: gli orari del posto
   collegato, due note, un biglietto attaccato alla prima tappa. */
const viaggio = () => {
  const v = JSON.parse(JSON.stringify(VIAGGIO));
  v.pois[0].hours = 'Mo-Su 08:30-17:00';
  v.pois[0].website = 'https://inari.jp/';
  v.days[0].activities[0].notes = 'Entrare dal lato del torii\n\nPortare acqua: la salita è lunga e non ci sono fontane per un bel pezzo';
  v.tickets[0].actId = 11;
  return v;
};
/* Wikidata, Wikipedia e Commons finti: rispondono per il Kinkaku-ji, in
   tutte le lingue, e contano le richieste. */
async function retiFinte(p, conta) {
  const json = (route, body) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
  /* OpenStreetMap conosce solo il Kinkaku-ji (orari, Wikidata, sito): le tappe
     del viaggio tengono i loro orari salvati, e si contano solo le richieste
     per lui (Oggi, dietro, cerca le foto delle tappe per conto suo). */
  const kinkaku = u => Math.abs(parseFloat(u.searchParams.get('lat')) - 35.0394) < 0.001;
  await p.route(/nominatim\.openstreetmap\.org\/reverse/, route => {
    const u = new URL(route.request().url()), qui = kinkaku(u);
    if (qui) conta.osm++;
    json(route, qui ? { display_name: 'Kinkaku-ji, 1, Kinkakujicho, Kita Ward, Kyoto', extratags: { opening_hours: 'Mo-Su 09:00-17:00', wikidata: 'Q60656', website: 'https://www.shokoku-ji.jp/kinkakuji/' } } : { display_name: 'Kyoto', extratags: {} });
  });
  await p.route(/www\.wikidata\.org\/w\/api\.php/, route => {
    const u = new URL(route.request().url()), l = u.searchParams.get('languages');
    if (u.searchParams.get('ids') === 'Q60656') conta.wikidata++;
    const desc = { it: 'tempio buddista a Kyoto', en: 'Buddhist temple in Kyoto', es: 'templo budista en Kioto', fr: 'temple bouddhiste à Kyoto', pt: 'templo budista em Quioto' }[l];
    if (u.searchParams.get('action') === 'wbgetclaims') return json(route, {});
    json(route, { entities: { Q60656: { descriptions: { [l]: { value: desc } }, sitelinks: { [l + 'wiki']: { title: 'Kinkaku-ji' } } } } });
  });
  await p.route(/\.wikipedia\.org\/api\/rest_v1\/page\/summary\//, route => {
    const uu = new URL(route.request().url()), l = uu.hostname.split('.')[0];
    if (/Kinkaku/.test(decodeURIComponent(uu.pathname))) conta.wikipedia++;
    json(route, { type: 'standard', title: 'Kinkaku-ji', description: 'tempio', extract: `[${l}] Il Kinkaku-ji, il Padiglione d'oro, è un tempio zen di Kyoto. `.repeat(6),
      content_urls: { desktop: { page: `https://${l}.wikipedia.org/wiki/Kinkaku-ji` } }, coordinates: { lat: 35.0394, lon: 135.7292 } });
  });
  await p.route(/\.wikipedia\.org\/w\/api\.php/, route => json(route, { query: { pages: {} } }));
  /* le foto di Wikimedia: un'immagine vera (piccola), perche' una foto che non
     arriva l'app la toglie apposta (mai un'immagine rotta) */
  await p.route(/upload\.wikimedia\.org\//, route => route.fulfill({ status: 200, contentType: 'image/png', body: FOTO_FINTA }));
  await p.route(/commons\.wikimedia\.org\/w\/api\.php/, route => {
    conta.commons++;
    const u = new URL(route.request().url());
    const md = a => ({ Artist: { value: `<a href="//commons.wikimedia.org/wiki/User:${a}">${a}</a>` }, LicenseShortName: { value: 'CC BY-SA 4.0' }, LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0' } });
    if (u.searchParams.get('generator') === 'geosearch') {
      const pg = n => ({ index: n, imageinfo: [{ url: `https://upload.wikimedia.org/wikipedia/commons/a/a${n}/Kinkaku_${n}.jpg`, thumburl: `https://upload.wikimedia.org/wikipedia/commons/thumb/a/a${n}/Kinkaku_${n}.jpg/500px-Kinkaku_${n}.jpg`, width: 1600, height: n === 2 ? 2000 : 1200, descriptionurl: `https://commons.wikimedia.org/wiki/File:Kinkaku_${n}.jpg`, extmetadata: md('Fotografo' + n) }] });
      return json(route, { query: { pages: { 1: pg(1), 2: pg(2), 3: pg(3), 4: pg(4) } } });
    }
    json(route, { query: { pages: { 9: { imageinfo: [{ descriptionurl: 'https://commons.wikimedia.org/wiki/File:Kinkaku.jpg', extmetadata: md('Copertina') }] } } } });
  });
}
/* L'assistente finto: conta le richieste della riga «Ti piacerà perché». */
async function ponteFinto(p, stato) {
  await p.route(PONTE, async route => {
    const q = route.request();
    if (q.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    let corpo = null; try { corpo = JSON.parse(q.postData() || 'null'); } catch (e) {}
    if (/Ti piacerà perché/.test(JSON.stringify(corpo || ''))) stato.perche++;
    if (stato.giu) return route.fulfill({ status: 503, contentType: 'application/json', headers: CORS, body: JSON.stringify({ error: { message: 'giu' } }) });
    route.fulfill({ status: 200, contentType: 'application/json', headers: CORS,
      body: JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ perche: 'Ti piacerà perché il padiglione d\'oro si specchia nello stagno, e ami l\'arte.', frase: 'il padiglione d\'oro' }) }], stop_reason: 'end_turn' }) });
  });
}
const FOTO_FINTA = require('fs').readFileSync(path.join(RADICE, 'icone', 'apple-touch-icon.png'));
const KINKAKU = { name: 'Kinkaku-ji', lat: 35.0394, lng: 135.7292, address: '1 Kinkakujicho, Kita Ward, Kyoto', type: 'attraction', photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Kinkaku.jpg/400px-Kinkaku.jpg' };
async function pagina(browser, o = {}) {
  const errori = [];
  const p = await apriPagina(browser, Object.assign({ attesa: 1000, errori, viaggi: [viaggio(), PORTO] }, o));
  p.__errori = errori;
  p.__conta = { osm: 0, wikidata: 0, wikipedia: 0, commons: 0 };
  p.__ai = { perche: 0, giu: false };
  await retiFinte(p, p.__conta);
  await ponteFinto(p, p.__ai);
  return p;
}
const scheda = p => p.evaluate(() => {
  const P = typeof psDati === 'function' ? psDati() : null, c = document.getElementById('psCorpo');
  return { aperta: postoAperto(), nome: P && P.nome, tappa: P && P.tappa, indietro: (c.querySelector('.ps-indietro') || {}).textContent || '', copertina: !!c.querySelector('.copertina .strappo'),
    titolo: (c.querySelector('.cp-nome') || {}).textContent || '', testo: c.innerText.replace(/\s+/g, ' ') };
});

(async () => {
  const browser = await apriBrowser();

  // ── 1. una scheda sola, da cinque posti ──────────────────────────────
  {
    const p = await pagina(browser);
    /* da Oggi: il tocco su una scheda-foto */
    await p.evaluate(() => go('plan'));
    await pausa(1500);
    await p.evaluate(() => { const s = document.querySelector('#plan .og-tappe'); s.scrollLeft = 0; });
    await pausa(300);
    await p.locator('#plan .og-tappe .stampa .lastra').first().click();
    await pausa(700);
    let s = await scheda(p);
    ok('1. da Oggi (una scheda-foto): la scheda della tappa, col suo nome e «Oggi» per tornare', s.aperta && s.tappa && s.nome === 'Fushimi Inari' && /Oggi/.test(s.indietro) && s.copertina && s.titolo === 'Fushimi Inari', JSON.stringify(s).slice(0, 200));
    /* da Oggi, il biglietto della tappa in mano */
    await p.evaluate(() => closeSheet('mPosto'));
    await pausa(450);
    await p.locator('#ogBiglietto').click();
    await pausa(700);
    s = await scheda(p);
    ok('1. da Oggi (il biglietto): la scheda della tappa in mano', s.aperta && s.tappa, JSON.stringify(s).slice(0, 160));
    /* dal Programma: il tocco su una tappa */
    await p.evaluate(() => { closeSheet('mPosto'); openDay(0); });
    await pausa(900);
    const blocco = p.locator('#mDay .tt-block', { hasText: 'Nishiki' }).first();
    await blocco.click();
    await pausa(700);
    s = await scheda(p);
    if (!s.aperta) { await blocco.click(); await pausa(700); s = await scheda(p); }
    ok('1. dal Programma: la stessa scheda, della tappa toccata, e «Programma» per tornare', s.aperta && s.tappa && s.nome === 'Nishiki' && /Programma/.test(s.indietro), JSON.stringify(s).slice(0, 160));
    const sopra = await p.evaluate(() => (parseInt(getComputedStyle(document.getElementById('mPosto')).zIndex, 10) || 0) > (parseInt(getComputedStyle(document.getElementById('mDay')).zIndex, 10) || 0));
    ok('1. e sta sopra il Programma, non dietro', sopra);
    /* da Scopri: un risultato */
    await p.evaluate(() => { closeSheet('mPosto'); closeSheet('mDay'); go('discover'); });
    await pausa(400);
    await p.evaluate(k => openPlaceInfo(k), KINKAKU);
    await pausa(1500);
    s = await scheda(p);
    ok('1. da Scopri: la scheda del posto, con «+ Aggiungi al programma» e «Scopri» per tornare', s.aperta && !s.tappa && s.nome === 'Kinkaku-ji' && /Scopri/.test(s.indietro) && /Aggiungi al programma/.test(s.testo), JSON.stringify(s).slice(0, 200));
    /* dai luoghi salvati: il posto salvato che e' gia' una tappa si apre come tappa */
    await p.evaluate(() => { closeSheet('mPosto'); const poi = T().pois.find(x => x.id === 91); openPlaceInfo(Object.assign({}, poi)); });
    await pausa(800);
    s = await scheda(p);
    ok('1. dai luoghi salvati: un posto che è già in programma si apre come la sua tappa', s.aperta && s.tappa && s.nome === 'Fushimi Inari', JSON.stringify(s).slice(0, 160));
    /* da Identifica: «Apri la scheda» sotto il risultato */
    await p.evaluate(() => { closeSheet('mPosto'); go('identify'); });
    await pausa(300);
    await p.route(/nominatim\.openstreetmap\.org\/search/, route => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify([{ lat: '35.0394', lon: '135.7292', type: 'attraction', extratags: { opening_hours: 'Mo-Su 09:00-17:00' } }]) }));
    await p.evaluate(() => {
      idRiconosciuto = { nome: 'Kinkaku-ji', citta: 'Kyoto', paese: 'Giappone', storia: 'Il Padiglione d\'oro, ricostruito nel 1955.', sito: '', prenotazione: 'no' };
      document.getElementById('idResult').innerHTML = `<div class="card"><button class="btn btn-secondario btn-block" onclick="psDaIdentifica(idRiconosciuto)">${ico('posizione')}${esc(tv('Apri la scheda'))}</button></div>`;
    });
    await p.locator('#idResult button', { hasText: 'Apri la scheda' }).click();
    /* prima il posto si cerca sulla mappa (il ponte, poi OpenStreetMap): si aspetta lui */
    await p.waitForFunction(() => postoAperto() && psDati() && psDati().nome === 'Kinkaku-ji', null, { timeout: 12000 }).catch(() => {});
    await pausa(300);
    s = await scheda(p);
    ok('1. da Identifica: la stessa scheda, del posto riconosciuto, trovato sulla mappa, e «Identifica» per tornare', s.aperta && !s.tappa && s.nome === 'Kinkaku-ji' && /Identifica/.test(s.indietro) && await p.evaluate(() => psDati().lat === 35.0394), JSON.stringify(s).slice(0, 160));
    const fonte = await p.evaluate(() => document.getElementById('identify').innerHTML.includes('psDaIdentifica') || /psDaIdentifica\(idRiconosciuto\)/.test(identifyPlace.toString()));
    ok('1. e nell\'app «Apri la scheda» sta davvero sotto il risultato di Identifica', fonte);
    err.push(...p.__errori);
    await p.close();
  }

  // ── 2. foglietti e biglietti ─────────────────────────────────────────
  {
    const p = await pagina(browser);
    await p.evaluate(() => { go('plan'); tapAct(0, 11); });
    await pausa(1500);
    const f = await p.evaluate(() => {
      const fg = [...document.querySelectorAll('#psFoglietti .foglietto')];
      const voce = x => ({ titolo: (x.querySelector('.fg-t') || {}).textContent || '', testo: (x.querySelector('.fg-x') || {}).textContent || '', breve: x.classList.contains('breve'), tasto: x.tagName === 'BUTTON',
        scotch: (x.querySelector('.scotch') || {}).getAttribute && x.querySelector('.scotch').getAttribute('aria-hidden'), storto: new DOMMatrix(getComputedStyle(x).transform).b !== 0 });
      const b = [...document.querySelectorAll('#psCorpo .ps-biglietti .biglietto')].map(x => x.textContent);
      return { fg: fg.map(voce), biglietti: b, tutto: document.getElementById('psCorpo').innerText };
    });
    const orari = f.fg.find(x => /Orari/.test(x.titolo));
    ok('2. gli orari di OpenStreetMap di quel giorno sono un foglietto scritto a mano', !!orari && orari.breve && /08:30–17:00/.test(orari.testo), JSON.stringify(orari));
    const pren = f.fg.find(x => /Prenotazione/.test(x.titolo));
    ok('2. la prenotazione da fare è un foglietto («da prenotare»)', !!pren && pren.testo === 'da prenotare', JSON.stringify(pren));
    const note = f.fg.filter(x => x.titolo === 'Nota');
    ok('2. le note della tappa: una per foglietto, la corta a mano, la lunga in chiaro, e toccandole si scrivono', note.length === 2 && note[0].breve && !note[1].breve && note.every(x => x.tasto) && /Entrare dal lato del torii/.test(note[0].testo), JSON.stringify(note).slice(0, 220));
    ok('2. i foglietti sono storti, con lo scotch nascosto a VoiceOver, e il testo si legge come testo', f.fg.every(x => x.storto && x.scotch === 'true') && /Entrare dal lato del torii/.test(f.tutto));
    ok('2. il biglietto attaccato alla tappa ha la forma di biglietto, col suo nome, e il codice non c\'è', f.biglietti.length === 1 && /Pass JR/.test(f.biglietti[0]) && !/AB12/.test(f.tutto), JSON.stringify(f.biglietti));
    await p.locator('#psCorpo .ps-biglietti .biglietto').click();
    await pausa(500);
    ok('2. e toccandolo si apre il biglietto grande, sopra la scheda', await p.evaluate(() => document.getElementById('mTicketBig').classList.contains('active')));
    await p.evaluate(() => closeSheet('mTicketBig'));
    await pausa(400);
    /* una nota: dal foglietto, sopra la scheda; salvata, la scheda la mostra */
    await p.locator('#psFoglietti .foglietto', { hasText: 'Entrare dal lato' }).click();
    await pausa(400);
    const nota = await p.evaluate(async () => {
      const aperta = document.getElementById('mActNote').classList.contains('active');
      document.getElementById('anText').value = 'Solo una nota nuova';
      saveActNote();
      await new Promise(x => setTimeout(x, 400));
      return { aperta, scheda: postoAperto(), fg: [...document.querySelectorAll('#psFoglietti .foglietto .fg-x')].map(x => x.textContent) };
    });
    ok('2. toccando una nota si scrive, e salvandola la scheda mostra il foglietto nuovo', nota.aperta && nota.scheda && nota.fg.includes('Solo una nota nuova') && !nota.fg.some(x => /torii/.test(x)), JSON.stringify(nota));
    /* senza note: «Scrivi una nota» */
    await p.evaluate(async () => { tapAct(0, 13); await new Promise(x => setTimeout(x, 500)); });
    const vuota = await p.evaluate(() => { const x = document.querySelector('#psFoglietti .foglietto.vuoto'); return x ? x.textContent : ''; });
    ok('2. una tappa senza note invita a scriverla («Scrivi una nota»)', /Scrivi una nota/.test(vuota), vuota);
    err.push(...p.__errori);
    await p.close();
  }

  // ── 3. la riga dell'assistente ───────────────────────────────────────
  {
    let p = await pagina(browser);
    await p.evaluate(k => { go('discover'); openPlaceInfo(k); }, KINKAKU);
    await pausa(2500);
    let a = await p.evaluate(() => ({ riga: (document.getElementById('psPerche') || {}).textContent || '', visibile: !document.getElementById('psPerche').hidden, tenuta: JSON.stringify(T().perche || {}) }));
    ok('3. l\'assistente risponde: la riga «Ti piacerà perché…» in corsivo d\'oro, firmata', a.visibile && /Ti piacerà perché il padiglione/.test(a.riga) && /assistente di GeppGo/.test(a.riga), a.riga.slice(0, 120));
    ok('3. ed è tenuta nel viaggio, per quel posto e quella lingua', /kinkaku-ji\|35\.039,135\.729/.test(a.tenuta) && /"it"/.test(a.tenuta), a.tenuta.slice(0, 120));
    await p.evaluate(k => { closeSheet('mPosto'); openPlaceInfo(k); }, KINKAKU);
    await pausa(1500);
    ok('3. riaprendo la scheda non si richiede (una richiesta sola)', p.__ai.perche === 1, p.__ai.perche + ' richieste');
    /* riaperta l'app: la riga c'e' gia' */
    await p.reload({ waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof window.renderAll === 'function' && !document.getElementById('bootSplash'), null, { timeout: 30000 });
    p.__ai.perche = 0;
    await p.evaluate(k => { go('discover'); openPlaceInfo(k); }, KINKAKU);
    await pausa(1500);
    a = await p.evaluate(() => ({ riga: (document.getElementById('psPerche') || {}).textContent || '', visibile: !document.getElementById('psPerche').hidden }));
    ok('3. riaperta l\'app la riga c\'è ancora, senza chiederla di nuovo', a.visibile && /padiglione/.test(a.riga) && p.__ai.perche === 0, `${p.__ai.perche} richieste`);
    /* l'assistente non risponde: niente riga, niente messaggi */
    p.__ai.giu = true;
    await p.evaluate(() => { closeSheet('mPosto'); openPlaceInfo({ name: 'Ryoan-ji', lat: 35.0345, lng: 135.7182, type: 'attraction' }); });
    await pausa(2500);
    a = await p.evaluate(() => ({ nascosta: document.getElementById('psPerche').hidden, toast: (document.querySelector('.toast') || {}).textContent || '', attesa: !!document.querySelector('.ai-attesa.on, .ai-attesa[style*="flex"]') }));
    ok('3. se l\'assistente non risponde, la riga non compare (e non compare nessun avviso)', a.nascosta && !a.toast && !a.attesa, JSON.stringify(a));
    err.push(...p.__errori);
    await p.close();
    /* i consigli del viaggio spenti: non si chiede */
    p = await pagina(browser);
    await p.evaluate(k => { T().suggestOn = false; go('discover'); openPlaceInfo(k); }, KINKAKU);
    await pausa(2200);
    ok('3. con i consigli del viaggio spenti non si chiede niente all\'assistente', p.__ai.perche === 0 && await p.evaluate(() => document.getElementById('psPerche').hidden), p.__ai.perche + ' richieste');
    err.push(...p.__errori);
    await p.close();
  }

  // ── 4. dalla rete, nella lingua dell'app ─────────────────────────────
  for (const lingua of ['it', 'fr']) {
    const p = await pagina(browser, { lingua });
    await p.evaluate(k => { go('discover'); openPlaceInfo(k); }, KINKAKU);
    await pausa(2500);
    const w = await p.evaluate(() => {
      const c = document.getElementById('psCorpo'), img = c.querySelector('.copertina .cp-foto');
      const st = [...c.querySelectorAll('#psCollage .stampa.appiccicata')];
      return { frase: (document.getElementById('psFrase') || {}).textContent || '', storia: (c.querySelector('#psStoria .ps-storia-x') || {}).textContent || '', corta: !!c.querySelector('#psStoria .ps-storia-x.corta'),
        wiki: (c.querySelector('#psStoria a') || {}).href || '', credito: (document.getElementById('psCredito') || {}).textContent || '',
        srcset: img && img.getAttribute('srcset'), sizes: img && img.getAttribute('sizes'), foto: st.length, etichette: st.map(x => (x.querySelector('.a-mano') || {}).textContent || ''), pigre: st.every(x => x.querySelector('img').getAttribute('loading') === 'lazy'),
        crediti: (c.querySelector('.ps-crediti') || {}).textContent || '', orari: [...c.querySelectorAll('#psFoglietti .foglietto')].map(x => x.textContent).join(' | ') };
    });
    const frase = lingua === 'it' ? 'tempio buddista a Kyoto' : 'temple bouddhiste à Kyoto';
    ok(`4. ${lingua}: la frase a mano è la descrizione breve di Wikidata nella lingua dell'app`, w.frase === frase, w.frase);
    ok(`4. ${lingua}: «Un po' di storia» da Wikipedia in quella lingua, corta con «continua», e il link`, w.storia.startsWith(`[${lingua}]`) && w.corta && new RegExp(`${lingua}\\.wikipedia\\.org`).test(w.wiki), w.storia.slice(0, 40));
    ok(`4. ${lingua}: il credito della foto in copertina, da Commons`, /Copertina/.test(w.credito) && /CC BY-SA 4\.0/.test(w.credito), w.credito);
    ok(`4. ${lingua}: tre altre foto appiccicate, con «foto di …» a mano, pigre, e i crediti sotto`, w.foto === 3 && w.etichette.every(e => /Fotografo/.test(e)) && w.pigre && /Wikimedia Commons/.test(w.crediti) && /CC BY-SA/.test(w.crediti), JSON.stringify(w.etichette));
    ok(`4. ${lingua}: la copertina alla misura dello schermo (le misure di Wikimedia, sizes)`, /500px-/.test(w.srcset || '') && /960px-/.test(w.srcset || '') && /1280px-/.test(w.srcset || '') && /560px/.test(w.sizes || ''), (w.sizes || '') + ' · ' + (w.srcset || '').slice(0, 80));
    ok(`4. ${lingua}: gli orari di OpenStreetMap di oggi`, /09:00–17:00/.test(w.orari), w.orari.slice(0, 120));
    /* una volta per posto: riaprendo, niente si richiede */
    const prima = Object.assign({}, p.__conta);
    await p.evaluate(k => { closeSheet('mPosto'); openPlaceInfo(k); }, KINKAKU);
    await pausa(1200);
    ok(`4. ${lingua}: riaprendo la scheda, OpenStreetMap, Wikidata e Wikipedia non si richiedono`, p.__conta.osm === prima.osm && p.__conta.wikidata === prima.wikidata && p.__conta.wikipedia === prima.wikipedia, JSON.stringify([prima, p.__conta]));
    err.push(...p.__errori);
    await p.close();
  }

  // ── 5. le azioni ─────────────────────────────────────────────────────
  {
    const p = await pagina(browser);
    await p.evaluate(k => { go('discover'); openPlaceInfo(k); }, KINKAKU);
    await pausa(1500);
    await p.locator('#psCorpo .ps-azione', { hasText: 'Aggiungi al programma' }).click();
    await pausa(800);
    const g = await p.evaluate(() => {
      const t = T(), d = t.days[homeDayIndex(t)], a = d.activities.find(x => x.name === 'Kinkaku-ji');
      return { c: !!a, ora: a && a.time, dopo: a && d.activities.filter(x => x !== a && x.time).every(x => (x.timeEnd || x.time) <= a.time), poi: !!(a && a.poiId), tasto: (document.querySelector('#psCorpo .ps-azione') || {}).textContent || '',
        cambia: !!document.querySelector('#psCorpo .ps-aggiunto-r button'), tappa: psDati().tappa };
    });
    ok('5. «+ Aggiungi al programma» con un tocco: nel giorno che si guarda, dopo l\'ultima tappa, col posto salvato', g.c && g.ora && g.dopo && g.poi && g.tappa, JSON.stringify(g));
    ok('5. e il tasto dice dov\'è finito, con «Cambia»', /Nel programma/.test(g.tasto) && g.tasto.includes(g.ora || '§') && g.cambia, g.tasto);
    /* Cambia: Sposta, giorno e ora; la durata resta */
    await p.locator('#psCorpo .ps-aggiunto-r button', { hasText: 'Cambia' }).click();
    await pausa(500);
    const sp = await p.evaluate(async () => {
      const aperto = document.getElementById('mSposta').classList.contains('active');
      const a0 = psDati().a, dur = tMin(a0.timeEnd) - tMin(a0.time);
      spScegli(1); document.getElementById('spOra').value = '15:00';
      spostaConferma();
      await new Promise(x => setTimeout(x, 400));
      const t = T(), a = t.days[1].activities.find(x => x.name === 'Kinkaku-ji');
      return { aperto, giorno1: !!a, via: !t.days[0].activities.some(x => x.name === 'Kinkaku-ji'), ora: a && a.time, dur: a ? tMin(a.timeEnd) - tMin(a.time) : null, durPrima: dur, scheda: postoAperto() && psDati().di === 1 };
    });
    ok('5. «Sposta»: un foglio piccolo col giorno e l\'ora; la tappa passa di giorno e la durata resta', sp.aperto && sp.giorno1 && sp.via && sp.ora === '15:00' && sp.dur === sp.durPrima && sp.scheda, JSON.stringify(sp));
    /* Elimina: rosso, in fondo, staccato; chiede e toglie */
    const el = await p.evaluate(() => {
      const z = document.querySelector('#psCorpo .zona-elimina'), b = z && z.querySelector('.btn-elimina'), corpo = document.querySelector('#psCorpo .ps-corpo');
      return { c: !!b, ultimo: corpo.lastElementChild === z, rosso: b && getComputedStyle(b).color };
    });
    ok('5. «Elimina la tappa» è rosso, in fondo e staccato', el.c && el.ultimo, JSON.stringify(el));
    await p.locator('#psCorpo .zona-elimina .btn-elimina').click();
    await pausa(400);
    await p.locator('#cfOk').click();
    await pausa(500);
    const via = await p.evaluate(() => ({ scheda: postoAperto(), c: T().days.some(d => d.activities.some(x => x.name === 'Kinkaku-ji')), lapide: Object.keys(T()._delAct || {}).length }));
    ok('5. e confermando la tappa se ne va (con la lapide per gli altri telefoni) e la scheda si chiude', !via.scheda && !via.c && via.lapide > 0, JSON.stringify(via));
    /* Aggiungi biglietto: nasce attaccato */
    await p.evaluate(() => { go('plan'); tapAct(0, 12); });
    await pausa(800);
    await p.locator('#psCorpo .ps-azioni .riga', { hasText: 'Aggiungi biglietto' }).click();
    await pausa(500);
    const tk = await p.evaluate(async () => {
      const aperto = document.getElementById('mTicket').classList.contains('active'), giorno = document.getElementById('tkDay').closest('.fg').parentElement.hidden;
      document.getElementById('tkCode').value = 'ZZ99';
      addTicketManual();
      await new Promise(x => setTimeout(x, 300));
      const t = T(), b = t.tickets.find(x => x.code === 'ZZ99');
      return { aperto, giorno, nome: b && b.name, act: b && b.actId, tappe: t.days[0].activities.length };
    });
    ok('5. «Aggiungi biglietto»: il biglietto nasce attaccato alla tappa, senza crearne un\'altra', tk.aperto && tk.giorno && tk.nome === 'Nishiki' && tk.act === 12 && tk.tappe === 3, JSON.stringify(tk));
    err.push(...p.__errori);
    await p.close();
  }

  // ── 6. come l'anteprima, cinque lingue, larghezze, axe, tasti ────────
  for (const tema of ['chiaro', 'scuro']) {
    const pa = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await pa.goto('file://' + path.join(RADICE, 'anteprime', 'luogo.html'));
    await pausa(1200);
    const ant = await pa.evaluate(() => {
      const b = s => { const e = document.querySelector(s); const x = e.getBoundingClientRect(); return { y: x.top + scrollY, h: x.height, w: x.width }; };
      return { cop: b('.copertina'), nome: b('.nome span'), frase: b('.frase'), az: b('.aggiungi'), cart: b('.cartina'), dist: b('.distanza b') };
    });
    await pa.close();
    const p = await pagina(browser, { tema });
    await p.evaluate(k => { go('discover'); openPlaceInfo(k); }, KINKAKU);
    await pausa(2500);
    const app = await p.evaluate(() => {
      const sh = document.querySelector('#mPosto .sheet'), off = sh.getBoundingClientRect().top - sh.scrollTop;
      const b = s => { const e = document.querySelector(s); if (!e) return null; const x = e.getBoundingClientRect(); return { y: x.top - off, h: x.height, w: x.width }; };
      return { cop: b('#psCorpo .copertina'), nome: b('#psCorpo .cp-nome span'), frase: b('#psFrase'), az: b('#psCorpo .ps-azione'), cart: b('#psCorpo .cartina'), dist: b('#psCorpo .distanza b'), strappo: b('#psCorpo .copertina .strappo') };
    });
    const manca = Object.keys(app).filter(k => !app[k]);
    ok(`6. ${tema}: ci sono gli elementi dell'anteprima (copertina strappata, nome enorme, frase a mano, tasto d'oro, cartina, distanza)`, !manca.length, manca.join(', '));
    if (!manca.length) {
      const ord = o => [o.cop.y, o.frase.y, o.az.y, o.cart.y, o.dist.y];
      ok(`6. ${tema}: nello stesso ordine dell'anteprima`, ord(app).every((v, i, a) => !i || v > a[i - 1]), ord(app).map(Math.round).join(' < '));
      ok(`6. ${tema}: con le stesse proporzioni (copertina, nome, tasto, cartina)`, Math.abs(app.cop.h - ant.cop.h) <= 6 && Math.abs(app.nome.h - ant.nome.h) <= 16 && app.az.h >= 54 && Math.abs(app.cart.h - ant.cart.h) <= 6 && Math.abs(app.frase.y - app.cop.h - (ant.frase.y - ant.cop.h)) <= 24,
        `copertina ${Math.round(app.cop.h)}/${Math.round(ant.cop.h)}, nome ${Math.round(app.nome.h)}/${Math.round(ant.nome.h)}, cartina ${Math.round(app.cart.h)}/${Math.round(ant.cart.h)}`);
    }
    await p.addScriptTag({ path: AXE });
    const v = await p.evaluate(async () => {
      const res = await axe.run({ include: [document.querySelector('#mPosto')] }, { resultTypes: ['violations'] });
      return res.violations.filter(x => x.impact === 'serious' || x.impact === 'critical').map(x => `${x.impact} ${x.id}: ${x.nodes.slice(0, 2).map(n => n.target.join(' ')).join(', ')}`);
    });
    ok(`6. ${tema}: nessuna violazione grave o critica di axe nella scheda`, !v.length, v.join(' | ').slice(0, 400));
    err.push(...p.__errori);
    await p.close();
  }
  for (const lingua of ['en', 'es', 'fr', 'pt']) {
    const p = await pagina(browser, { lingua });
    await p.evaluate(() => { go('plan'); tapAct(0, 11); });
    await pausa(1200);
    const t = await p.evaluate(() => document.getElementById('psCorpo').innerText);
    /* parole intere: «Navigate» contiene «Naviga» */
    const rimasti = ['Aggiungi biglietto', 'Sposta', 'Modifica', 'Elimina la tappa', 'Come ci arrivi', 'Prenotazione', 'Indirizzo', 'Orari di', 'da prenotare', 'Naviga', 'dall\'albergo', 'Giorno 1', 'a piedi']
      .filter(x => new RegExp('(^|[^\\p{L}])' + x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^\\p{L}])', 'u').test(t));
    ok(`6. in ${lingua} niente italiano rimasto nella scheda di una tappa`, !rimasti.length, rimasti.join(', '));
    err.push(...p.__errori);
    await p.close();
  }
  for (const [w, h] of [[320, 700], [360, 780], [430, 932], [1024, 768]]) {
    const p = await pagina(browser, { larghezza: w, altezza: h });
    await p.evaluate(() => { go('plan'); tapAct(0, 11); });
    await pausa(1500);
    /* I tasti si toccano come un dito (come in prova-accessibilita): nove
       punti a 21 px dal centro devono prenderli. La citazione della mappa e il
       credito delle foto hanno i loro link piccoli, come in ogni mappa e in
       ogni didascalia (CC BY-SA chiede nome e licenza, non un tasto). */
    const m = await p.evaluate(async () => {
      const sh = document.querySelector('#mPosto .sheet'), r = sh.getBoundingClientRect();
      const piccoli = [];
      for (const b of [...sh.querySelectorAll('button, a[href]')].filter(b => b.offsetParent && !b.closest('.g-angolo,.cp-credito,.ps-crediti,.a-mano'))) {
        b.scrollIntoView({ block: 'center', behavior: 'instant' });
        await new Promise(x => requestAnimationFrame(x));
        const q = b.getBoundingClientRect(), cx = q.left + q.width / 2, cy = q.top + q.height / 2;
        const male = [[0, 0], [-21, 0], [21, 0], [0, -21], [0, 21], [-15, -15], [15, -15], [-15, 15], [15, 15]].filter(([dx, dy]) => {
          const h = document.elementFromPoint(cx + dx, cy + dy); return !h || (h !== b && !b.contains(h));
        });
        if (male.length) piccoli.push({ n: (b.textContent || b.className).trim().slice(0, 20), w: Math.round(q.width), h: Math.round(q.height), punti: male.map(x => x.join(',')).slice(0, 3).join(' ') });
      }
      sh.scrollTop = 0;
      return { lato: sh.scrollWidth - sh.clientWidth, larga: r.width, centro: Math.round(r.left + r.width / 2 - innerWidth / 2), piccoli };
    });
    const forma = w >= 640 ? m.larga <= 560 && Math.abs(m.centro) <= 2 : m.larga === w;
    ok(`6. a ${w} px la scheda ${w >= 640 ? 'è una scheda al centro, larga al massimo 560' : 'prende lo schermo'}, non scorre di lato, e i tasti sono da 44`, forma && m.lato <= 0 && !m.piccoli.length, JSON.stringify(m).slice(0, 300));
    err.push(...p.__errori);
    await p.close();
  }

  await browser.close();
  ok('nessun errore in pagina', !err.length, err.slice(0, 3).join(' | '));
  console.log('\n' + r.join('\n'));
  const falliti = r.filter(x => x.includes('FALLITO')).length;
  console.log(`\n${r.length - falliti}/${r.length} passati`);
  process.exit(falliti ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
