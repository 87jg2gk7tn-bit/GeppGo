/* INSTALLAZIONE IMPECCABILE E LINK CORTI DI GOOGLE MAPS (miglioria 12).

   1. CLAUDE.md ha la regola giusta sul logo (oro #C9962C col tratto #14110B,
      con la scritta GeppGo) e non più quella sbagliata sul verde;
   2. ogni mappa (Home, viaggio, giornata, anteprima di un posto, mappine dei
      risultati) mostra «© OpenStreetMap» col link alla pagina dei diritti,
      senza coprire tasti: le aree da 44 px dei tasti restano libere;
   3. l'icona per la Home di iPhone è un PNG 180×180 senza trasparenza; le
      icone del manifest sono PNG delle misure dichiarate, compresa quella
      maskable col logo dentro la zona sicura; e sono quelle del logo di
      adesso (ridisegnate e confrontate);
   4. il manifest ha nome, nome corto, start_url dentro lo scope, display
      standalone, colori coerenti con la schermata d'apertura; i meta per
      iPhone ci sono; la barra di stato segue il tema;
   5. share_target: un testo e un link condivisi (finti, come li manda
      Android) arrivano nel punto giusto; senza niente, come su iPhone, non
      succede niente; il Comando di iPhone arriva dove arriva Android;
   6. un link corto finto, con i rimandi e la pagina dei consensi di Google:
      il servizio dà l'indirizzo vero e l'app ne ricava le coordinate giuste,
      in tutti i punti dove si incolla un posto (luoghi, hotel, tappe);
   7. un link senza coordinate ma col nome: l'app trova il posto cercando;
   8. un indirizzo che non è di Google il servizio lo rifiuta (e non lo apre
      neanche per vedere); un servizio lento oltre 8 secondi dà un messaggio
      chiaro; il limite di richieste regge;
   9. i testi nuovi sono tradotti nelle cinque lingue, e niente esce dallo
      schermo da 320 a 430 px.

   Google non si chiama mai: le regole della funzione (link-mappe/regole.mjs)
   girano qui in Node, con un Google finto, e la pagina parla con loro al
   posto della funzione vera.

   `node test/prova-installazione.js 3 6` fa solo le prove 3 e 6. */
const fs = require('fs');
const path = require('path');
const { apriBrowser, APP, RADICE } = require('./browser');
const { apriPagina } = require('./schermate');
const { disegnaIcone, logoDallApp, FONDO } = require('./fai-le-icone');

const r = [];
const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);
const SCELTE = process.argv.slice(2).filter(a => /^\d$/.test(a));
const fai = n => !SCELTE.length || SCELTE.includes(String(n));
const LINGUE = ['it', 'en', 'es', 'fr', 'pt'];

/* ── un Google finto, con i rimandi che fa davvero ────────────────────────
   Il link corto rimanda a Google Maps; dall'Europa, senza i suoi biscotti,
   Google rimanda alla pagina dei consensi, con l'indirizzo vero in
   «continue». Kinkaku-ji ha le coordinate nell'indirizzo finale (!3d!4d), il
   ryokan solo il nome. */
const KINKAKU = 'https://www.google.com/maps/place/Kinkaku-ji/data=!4m6!3m5!1s0x6001a8b2b2a8e2b1:0x2c0e3d5f!8m2!3d35.0393748!4d135.7291969!16zL20vMDFnZmxs';
const KINKAKU_Q = 'https://maps.google.com/maps?q=Kinkaku-ji,+Kyoto&ftid=0x6001a8b2b2a8e2b1:0x2c0e3d5f&entry=gps';
const RYOKAN = 'https://www.google.com/maps/place/Ryokan+Hoshi,+Kyoto/data=!4m2!3m1!1s0x60010f9a:0x7?entry=gps';
const consenso = u => 'https://consent.google.com/ml?continue=' + encodeURIComponent(u) + '&gl=IT&m=0&pc=m&uxe=eomtm&cm=2&hl=it&src=1';
const GOOGLE = {
  'https://maps.app.goo.gl/Kinkaku1': { s: 302, l: KINKAKU_Q },
  [KINKAKU_Q]: { s: 302, l: consenso(KINKAKU) },
  'https://maps.app.goo.gl/Ryokan2': { s: 302, l: RYOKAN },
  [RYOKAN]: { s: 302, l: consenso(RYOKAN) },
  'https://maps.app.goo.gl/Cattivo3': { s: 302, l: 'https://evil.example/ruba?x=1' },
  'https://maps.app.goo.gl/Consenso4': { s: 302, l: 'https://consent.google.com/ml?continue=https://evil.example/' },
  'https://maps.app.goo.gl/Lento5': 'lento'
};
function googleFinto(chiesti) {
  return async (u, o) => {
    chiesti.push(u);
    const p = GOOGLE[u];
    if (p === 'lento') return new Promise((_, no) => o.signal.addEventListener('abort', () => no(new Error('This operation was aborted'))));
    if (!p) return new Response('non c\'è', { status: 404 });
    return new Response(null, { status: p.s, headers: { location: p.l } });
  };
}
const LAT_K = 35.0393748, LNG_K = 135.7291969;
const LAT_R = 35.0021, LNG_R = 135.7788;
const vicino = (a, b) => Math.abs(+a - +b) < 1e-6;

let R; // le regole della funzione, caricate all'inizio

/* La funzione link-mappe, sostituita dalle sue regole con il Google finto.
   lenta: non risponde mai (la pagina deve arrendersi da sola); stato: una
   risposta di guaio decisa qui. */
async function funzioneFinta(page, { lenta = false, stato = null, errore = null } = {}) {
  const chiesti = [], viste = [];
  await page.unroute('**/functions/v1/link-mappe').catch(() => {});
  await page.route('**/functions/v1/link-mappe', async route => {
    let corpo = {};
    try { corpo = JSON.parse(route.request().postData() || '{}'); } catch (e) {}
    viste.push(corpo.url);
    if (lenta) return;
    if (stato) return route.fulfill({ status: stato, contentType: 'application/json', body: JSON.stringify({ errore }) });
    try {
      const esito = await R.segui(corpo.url, { fetch: googleFinto(chiesti) });
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ url: esito.url }) });
    } catch (e) {
      const st = { non_ammesso: 400, troppe: 429, tempo: 504 }[e.codice] || 502;
      await route.fulfill({ status: st, contentType: 'application/json', body: JSON.stringify({ errore: e.codice }) });
    }
  });
  return { chiesti, viste };
}
/* La ricerca di sempre: conosce solo il ryokan. Risponde dal ponte degli
   indirizzi e dalla strada diretta, perché quale delle due prende l'app
   dipende da com'è andata prima (un ponte caduto si salta per un minuto). */
async function ricercaFinta(page) {
  const domande = [];
  const risposta = url => {
    domande.push(url);
    let q = '';
    try { const p = new URL(url).searchParams; q = (p.get('q') || p.get('street') || '').toLowerCase(); } catch (e) {}
    const trovato = /ryokan hoshi/.test(q);
    if (/\/reverse/.test(url)) return {};
    return /photon/.test(url)
      ? { features: trovato ? [{ properties: { name: 'Ryokan Hoshi', city: 'Kyoto', country: 'Giappone', osm_key: 'tourism', osm_value: 'guest_house' }, geometry: { coordinates: [LNG_R, LAT_R] } }] : [] }
      : (trovato ? [{ display_name: 'Ryokan Hoshi, Higashiyama, Kyoto, Giappone', lat: String(LAT_R), lon: String(LNG_R), class: 'tourism', type: 'guest_house', importance: 0.4 }] : []);
  };
  await page.route('**/functions/v1/geo', async route => {
    let url = '';
    try { url = JSON.parse(route.request().postData() || '{}').url || ''; } catch (e) {}
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ dati: risposta(url), da: 'memoria' }) });
  });
  await page.route(/^https:\/\/(nominatim\.openstreetmap\.org|photon\.komoot\.io)\//, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(risposta(route.request().url())) }));
  return domande;
}

/* I punti dove si incolla un posto, toccati come farebbe una persona. Ognuno
   torna { lat, lng, testo } — dove l'app ha messo il posto, e cosa ha detto. */
const PUNTI = {
  async tappa(page, link) {
    await page.evaluate(() => { document.querySelectorAll('.modal.active').forEach(m => closeSheet(m.id)); openActDetail(0, null); });
    await page.waitForSelector('#adAddr', { state: 'visible' });
    await page.fill('#adAddr', link);
    await page.evaluate(() => { adPoiPick = null; return adAddrFind(); });
    return page.evaluate(() => ({ lat: adPoiPick && adPoiPick.lat, lng: adPoiPick && adPoiPick.lng, testo: document.getElementById('adAddrHint').textContent }));
  },
  async ricercaHotel(page, link) {
    await page.evaluate(() => { document.querySelectorAll('.modal.active').forEach(m => closeSheet(m.id)); go('hotels'); lastHotRes = []; });
    await page.fill('#hotSearch', link);
    await page.waitForFunction(() => { const b = document.getElementById('hotResults'); return lastHotRes.length || /Google Maps|link|enlace|lien|ligação/i.test(b.textContent) && !/…$/.test(b.textContent.trim()); }, null, { timeout: 20000 }).catch(() => {});
    return page.evaluate(() => ({ lat: lastHotRes[0] && lastHotRes[0].lat, lng: lastHotRes[0] && lastHotRes[0].lon, nota: lastHotRes[0] && lastHotRes[0]._come, testo: document.getElementById('hotResults').textContent }));
  },
  async foglioHotel(page, link) {
    await page.evaluate(() => {
      document.querySelectorAll('.modal.active').forEach(m => closeSheet(m.id));
      pendingHotel = { name: 'Albergo del link', lat: null, lng: null, address: '', editId: null, approx: true };
      apriFoglioHotel(T(), '');
    });
    await page.fill('#haPos', link);
    await page.evaluate(() => saveHotelAdd());
    return page.evaluate(() => {
      const h = (T().hotels || []).find(x => x.name === 'Albergo del link');
      const esito = { lat: h && h.lat, lng: h && h.lng, approx: h && h.approx, testo: (document.getElementById('haPosNota') || {}).textContent || '' };
      if (h) { T().hotels = T().hotels.filter(x => x !== h); save(); }
      return esito;
    });
  },
  async mailHotel(page, link) {
    await page.evaluate(() => {
      document.querySelectorAll('.modal.active').forEach(m => closeSheet(m.id));
      apriMailHotel();
      mailAlloggio = { struttura: 'Albergo della mail', indirizzo: '', checkin: T().start, checkout: T().end, lat: null, lng: null };
      mostraAnteprimaAlloggio();
    });
    await page.fill('#mhPos', link);
    await page.waitForFunction(() => mailAlloggio && mailAlloggio.lat != null || /Google Maps|link|enlace|lien|ligação/i.test(document.getElementById('mhStato').textContent) && !/…$/.test(document.getElementById('mhStato').textContent.trim()), null, { timeout: 20000 }).catch(() => {});
    return page.evaluate(() => ({ lat: mailAlloggio && mailAlloggio.lat, lng: mailAlloggio && mailAlloggio.lng, approx: mailAlloggio && mailAlloggio.approx, testo: document.getElementById('mhStato').textContent }));
  },
  async luoghi(page, link) {
    await page.evaluate(() => { document.querySelectorAll('.modal.active').forEach(m => closeSheet(m.id)); go('discover'); setDiscover('search'); document.getElementById('searchResults').innerHTML = ''; });
    await page.fill('#poiSearch', link);
    await page.waitForFunction(() => document.querySelector('#searchResults .res-name') || /Google Maps|link|enlace|lien|ligação/i.test(document.getElementById('searchResults').textContent) && !/…$/.test(document.getElementById('searchResults').textContent.trim()), null, { timeout: 20000 }).catch(() => {});
    return page.evaluate(() => {
      const card = [...document.querySelectorAll('#searchResults .res')].find(c => c.querySelector('.res-name'));
      const m = card ? /"lat":(-?[\d.]+),"lng":(-?[\d.]+)/.exec(card.getAttribute('onclick') || '') : null;
      return { lat: m && +m[1], lng: m && +m[2], nome: card ? card.querySelector('.res-name').textContent : '', testo: document.getElementById('searchResults').textContent };
    });
  }
};

/* Una mappa e la sua citazione: c'è, ha il link, si vede, e non tocca le
   aree da 44 px dei tasti che ci stanno sopra o intorno. */
const GUARDA_MAPPA = sel => {
  const c = document.querySelector(sel);
  if (!c || !c.getClientRects().length) return { manca: true };
  const att = c.querySelector('.leaflet-control-attribution');
  if (!att) return { senzaCitazione: true };
  const r = c.getBoundingClientRect(), ra = att.getBoundingClientRect();
  const link = att.querySelector('a[href="https://www.openstreetmap.org/copyright"]');
  const lr = link && link.getBoundingClientRect();
  const sopra = link && document.elementFromPoint(lr.left + lr.width / 2, lr.top + lr.height / 2);
  const nome = x => (x.id ? '#' + x.id : x.tagName.toLowerCase() + '.' + String(x.className || '').split(' ')[0]) + ' «' + (x.textContent || x.getAttribute('aria-label') || '').trim().slice(0, 16) + '»';
  const tasti = [...new Set([...c.parentElement.querySelectorAll('button,a[href],[role=button],[onclick]')])]
    .filter(x => x !== c && !att.contains(x) && !x.closest('.leaflet-marker-pane,.leaflet-popup-pane') && x.getClientRects().length);
  const male = [];
  for (const b of tasti) {
    const q = b.getBoundingClientRect(), cx = q.left + q.width / 2, cy = q.top + q.height / 2;
    if (!(cx + 22 <= ra.left || cx - 22 >= ra.right || cy + 22 <= ra.top || cy - 22 >= ra.bottom)) male.push(nome(b) + ': l\'area da 44 px tocca la citazione');
    for (const [dx, dy] of [[0, 0], [-21, 0], [21, 0], [0, -21], [0, 21], [-15, -15], [15, -15], [-15, 15], [15, 15]]) {
      const h = document.elementFromPoint(cx + dx, cy + dy);
      if (h && att.contains(h)) male.push(nome(b) + ` ${dx},${dy} prende la citazione`);
    }
  }
  return {
    testo: att.textContent.replace(/\s+/g, ' ').trim(), link: !!link,
    dentro: ra.left >= r.left - 0.5 && ra.right <= r.right + 0.5 && ra.top >= r.top - 0.5 && ra.bottom <= r.bottom + 0.5,
    siVede: !!(link && sopra && (sopra === link || link.contains(sopra))), tasti: tasti.map(nome), male
  };
};

/* I pixel di un PNG, letti dal browser. */
async function pixel(page, buf) {
  const x = await page.evaluate(async b64 => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    const g = cv.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, cv.width, cv.height).data;
    let s = ''; for (let i = 0; i < d.length; i += 0x8000) s += String.fromCharCode.apply(null, d.subarray(i, i + 0x8000));
    return { w: cv.width, h: cv.height, b64: btoa(s) };
  }, buf.toString('base64'));
  return { w: x.w, h: x.h, d: Buffer.from(x.b64, 'base64') };
}
const testaPng = buf => ({ png: buf.slice(1, 4).toString('ascii') === 'PNG', w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), tipo: buf[25] });

(async () => {
  R = await import('../supabase/functions/link-mappe/regole.mjs');
  const browser = await apriBrowser();
  const errori = [];

  // ── 1. la regola del logo ────────────────────────────────────────────────
  if (fai(1)) {
    const claude = fs.readFileSync(path.join(RADICE, 'CLAUDE.md'), 'utf8');
    ok('1. CLAUDE.md: «Il logo è oro #C9962C con il tratto #14110B, con la scritta GeppGo: non va modificato»',
       claude.includes('Il logo è oro #C9962C con il tratto #14110B, con la scritta GeppGo: non va modificato'));
    ok('1. e non c\'è più la regola sul verde #006747', !/006747/.test(claude) && !/verde del brand/i.test(claude),
       (claude.match(/.{0,40}(006747|verde del brand).{0,40}/i) || [''])[0]);
  }

  // ── 2. la citazione di OpenStreetMap su ogni mappa ───────────────────────
  if (fai(2)) {
    const esiti = [], guai = [];
    for (const larghezza of [320, 430]) {
      const page = await apriPagina(browser, { larghezza, errori });
      await page.waitForFunction(() => typeof L !== 'undefined', null, { timeout: 15000 }).catch(() => {});
      const MAPPE = [
        ['Home', '#homeMap', null],
        ['viaggio', '#map', 'openTripZoom(1)'],
        ['giornata', '#dayMap', 'openDay(0)'],
        ['anteprima di un posto', '#piMap', "openPlaceInfo({name:'Kinkaku-ji',lat:35.0394,lng:135.7292,address:'Kyoto',type:'attraction'})"],
        ['mappina dei risultati', '#searchResults-mini-0', "go('discover');setDiscover('search');renderResults([{display_name:'Kinkaku-ji, Kyoto, Giappone',lat:'35.0394',lon:'135.7292',type:'attraction',class:'tourism'}],'searchResults')"]
      ];
      for (const [nome, sel, passo] of MAPPE) {
        await page.evaluate(() => { document.querySelectorAll('.modal.active').forEach(m => closeSheet(m.id)); go('plan'); });
        await page.waitForTimeout(300);
        if (passo) await page.evaluate(passo);
        await page.waitForFunction(s => { const c = document.querySelector(s); return c && c.querySelector('.leaflet-control-attribution a'); }, sel, { timeout: 8000 }).catch(() => {});
        await page.evaluate(s => { const c = document.querySelector(s); if (c) c.scrollIntoView({ block: 'center', behavior: 'instant' }); }, sel);
        await page.waitForTimeout(450);
        const m = await page.evaluate(GUARDA_MAPPA, sel);
        esiti.push({ larghezza, nome, m });
        const dove = `${nome} a ${larghezza} px`;
        if (m.manca || m.senzaCitazione) guai.push(dove + (m.manca ? ': la mappa non c\'è' : ': nessuna citazione'));
        else {
          if (!/© OpenStreetMap/.test(m.testo)) guai.push(dove + ': dice «' + m.testo + '»');
          if (!m.link) guai.push(dove + ': senza il link alla pagina dei diritti');
          if (!m.dentro || !m.siVede) guai.push(dove + ': la citazione non si vede tutta');
          guai.push(...m.male.map(x => dove + ': ' + x));
        }
      }
      await page.close();
    }
    const tutte = esiti.filter(e => !e.m.manca && !e.m.senzaCitazione);
    ok('2. ogni mappa — Home, viaggio, giornata, anteprima di un posto, mappine dei risultati — mostra «© OpenStreetMap» col link ai diritti, a 320 e 430 px',
       !guai.filter(g => !/area da 44|prende la citazione/.test(g)).length && tutte.length === 10,
       guai.filter(g => !/area da 44|prende la citazione/.test(g)).join(' | ') || tutte.map(e => e.nome + ' ' + e.larghezza).length + ' mappe: «' + (tutte[0] || { m: {} }).m.testo + '»');
    const coiTasti = esiti.filter(e => e.m.tasti && e.m.tasti.length);
    ok('2. e non copre nessun tasto: le aree da 44 px dei tasti sulla mappa e intorno restano libere',
       !guai.some(g => /area da 44|prende la citazione/.test(g)) && coiTasti.length >= 6,
       guai.filter(g => /area da 44|prende la citazione/.test(g)).join(' | ') || coiTasti.map(e => `${e.nome} ${e.larghezza}: ${e.m.tasti.length}`).join(', '));
  }

  // ── 3. le icone ──────────────────────────────────────────────────────────
  if (fai(3)) {
    const html = fs.readFileSync(path.join(RADICE, 'Index 2.1.html'), 'utf8');
    const man = JSON.parse(fs.readFileSync(path.join(RADICE, 'manifest.webmanifest'), 'utf8'));
    const apple = (html.match(/<link rel="apple-touch-icon"[^>]*>/) || [''])[0];
    const appleFile = (apple.match(/href="([^"]+)"/) || [])[1] || '';
    const appleBuf = appleFile && fs.existsSync(path.join(RADICE, appleFile)) ? fs.readFileSync(path.join(RADICE, appleFile)) : null;
    const ta = appleBuf ? testaPng(appleBuf) : {};
    const page = await browser.newPage();
    await page.setContent('<!doctype html><html><body></body></html>');
    let opaca = false;
    if (appleBuf && ta.png) { const px = await pixel(page, appleBuf); opaca = px.d.every((v, i) => i % 4 !== 3 || v === 255); }
    ok('3. l\'icona per la Home di iPhone è un PNG 180×180 senza trasparenza (nessun canale alfa)',
       !!appleBuf && ta.png && ta.w === 180 && ta.h === 180 && ta.tipo === 2 && opaca && /sizes="180x180"/.test(apple),
       appleFile + ' ' + JSON.stringify(ta));
    ok('3. e l\'SVG resta l\'icona della scheda', /<link rel="icon" href="icona\.svg" type="image\/svg\+xml">/.test(html));

    const icone = man.icons || [];
    const guaiIc = [];
    for (const ic of icone) {
      const f = path.join(RADICE, ic.src.replace(/^\.\//, ''));
      if (ic.type !== 'image/png') { guaiIc.push(ic.src + ' non è un PNG'); continue; }
      if (!fs.existsSync(f)) { guaiIc.push(ic.src + ' non esiste'); continue; }
      const t = testaPng(fs.readFileSync(f));
      if (!t.png || ic.sizes !== `${t.w}x${t.h}`) guaiIc.push(`${ic.src}: dichiarata ${ic.sizes}, è ${t.w}x${t.h}`);
    }
    const ha = (s, p) => icone.some(ic => ic.sizes === s && (ic.purpose || 'any').split(' ').includes(p));
    ok('3. nel manifest: PNG 192×192 e 512×512, e una maskable 512×512, delle misure che dichiarano',
       !guaiIc.length && ha('192x192', 'any') && ha('512x512', 'any') && ha('512x512', 'maskable') && icone.every(ic => ic.type === 'image/png'),
       guaiIc.join(' | ') || icone.map(ic => `${ic.sizes} ${ic.purpose}`).join(', '));

    /* E devono arrivare sul sito. Il .gitignore scarta i PNG (sono le
       schermate delle prove): un'icona che git non prende qui sul disco
       c'è, e sul telefono no. Senza git (una copia scaricata) non si guarda. */
    const fileIcone = [appleFile, ...icone.map(ic => ic.src.replace(/^\.\//, ''))].filter(Boolean);
    let ignorate = null;
    try {
      ignorate = require('child_process').execFileSync('git', ['check-ignore', ...fileIcone],
        { cwd: RADICE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split('\n').filter(Boolean);
    } catch (e) { ignorate = e.status === 1 ? [] : null; }
    ok('3. e git le prende: nessuna icona sta fra i file che il repo scarta',
       !!fileIcone.length && (ignorate === null || !ignorate.length),
       ignorate === null ? 'git non risponde: non guardato' : ignorate.join(', ') || 'tutte nel repo');

    const mask =icone.find(ic => (ic.purpose || '').includes('maskable') && ic.type === 'image/png');
    let fuori = -1, fondoOk = false;
    if (mask && fs.existsSync(path.join(RADICE, mask.src.replace(/^\.\//, '')))) {
      const px = await pixel(page, fs.readFileSync(path.join(RADICE, mask.src.replace(/^\.\//, ''))));
      const f = [1, 3, 5].map(i => parseInt(FONDO.slice(i, i + 2), 16));
      const c = px.w / 2, raggio = px.w * 0.4;
      fuori = 0;
      for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) {
        if (Math.hypot(x + 0.5 - c, y + 0.5 - c) <= raggio) continue;
        const i = (y * px.w + x) * 4;
        if (Math.abs(px.d[i] - f[0]) > 12 || Math.abs(px.d[i + 1] - f[1]) > 12 || Math.abs(px.d[i + 2] - f[2]) > 12 || px.d[i + 3] !== 255) fuori++;
      }
      const angolo = [px.d[0], px.d[1], px.d[2]];
      fondoOk = angolo.every((v, k) => Math.abs(v - f[k]) <= 2);
    }
    ok('3. la maskable ha il fondo fino ai bordi e il logo tutto dentro la zona sicura (il cerchio centrale dell\'80%)',
       !!mask && fondoOk && fuori === 0, mask ? `${fuori} pixel del logo fuori dalla zona sicura` : 'nessuna maskable');

    /* Ridisegnate adesso dal logo della testata: se il logo cambia e le
       icone no, qui si vede. Un margine per i bordi sfumati, che due
       versioni di Chromium possono disegnare un filo diverse. */
    const fresche = await disegnaIcone(browser);
    const diversi = [];
    for (const ic of fresche.icone) {
      const f = path.join(RADICE, ic.file);
      if (!fs.existsSync(f) || !testaPng(fs.readFileSync(f)).png) { diversi.push(ic.file + ' manca'); continue; }
      const px = await pixel(page, fs.readFileSync(f));
      const nuovo = await pixel(page, ic.png);
      if (px.w !== nuovo.w) { diversi.push(ic.file + ' ha un\'altra misura'); continue; }
      let n = 0;
      for (let i = 0; i < px.d.length; i += 4) {
        if (Math.max(Math.abs(px.d[i] - nuovo.d[i]), Math.abs(px.d[i + 1] - nuovo.d[i + 1]), Math.abs(px.d[i + 2] - nuovo.d[i + 2]), Math.abs(px.d[i + 3] - nuovo.d[i + 3])) > 40) n++;
      }
      if (n > px.d.length / 4 * 0.005) diversi.push(`${ic.file}: ${n} pixel diversi`);
    }
    const svg = fs.readFileSync(path.join(RADICE, 'icona.svg'), 'utf8');
    ok('3. e sono quelle del logo di adesso: icona.svg e i PNG coincidono con quelli ridisegnati dalla testata (npm run icone)',
       !diversi.length && svg === logoDallApp() && /#C9962C/.test(svg) && /#14110B/.test(svg), diversi.join(' | ') || (svg === logoDallApp() ? '' : 'icona.svg è rimasta indietro'));
    await page.close();
  }

  // ── 4. il manifest e i meta ──────────────────────────────────────────────
  if (fai(4)) {
    const html = fs.readFileSync(path.join(RADICE, 'Index 2.1.html'), 'utf8');
    const man = JSON.parse(fs.readFileSync(path.join(RADICE, 'manifest.webmanifest'), 'utf8'));
    const base = 'https://87jg2gk7tn-bit.github.io/GeppGo/manifest.webmanifest';
    const start = new URL(man.start_url, base).href, scope = new URL(man.scope, base).href;
    const splash = ((html.match(/#bootSplash\{[^}]*background:(#[0-9A-Fa-f]{6})/) || [])[1] || '').toUpperCase();
    ok('4. il manifest ha nome, nome corto, start_url dentro lo scope e display standalone',
       man.name === 'GeppGo' && man.short_name === 'GeppGo' && start.startsWith(scope) && man.display === 'standalone' && !!man.id
       && fs.existsSync(path.join(RADICE, man.start_url.replace(/^\.\//, ''))),
       `${man.name} / ${man.short_name} / ${man.start_url} in ${man.scope} / ${man.display}`);
    ok('4. e i colori sono quelli della schermata d\'apertura, uguale nei due temi (al lancio non c\'è uno stacco)',
       /^#[0-9A-F]{6}$/i.test(man.theme_color) && /^#[0-9A-F]{6}$/i.test(man.background_color)
       && man.background_color.toUpperCase() === splash && man.theme_color.toUpperCase() === splash
       && new RegExp('<meta name="theme-color" content="' + splash + '">', 'i').test(html),
       `theme_color ${man.theme_color}, background_color ${man.background_color}, apertura ${splash}`);
    const meta = n => (html.match(new RegExp('<meta name="' + n + '" content="([^"]*)">')) || [])[1];
    ok('4. i meta per iPhone e per Android: si apre a schermo intero, col suo nome, e la barra di stato «default» (leggibile nei due temi)',
       meta('apple-mobile-web-app-capable') === 'yes' && meta('mobile-web-app-capable') === 'yes'
       && meta('apple-mobile-web-app-status-bar-style') === 'default' && meta('apple-mobile-web-app-title') === 'GeppGo'
       && /<link rel="manifest" href="manifest\.webmanifest">/.test(html),
       ['apple-mobile-web-app-capable', 'mobile-web-app-capable', 'apple-mobile-web-app-status-bar-style', 'apple-mobile-web-app-title'].map(n => n + '=' + meta(n)).join(' '));
    const page = await apriPagina(browser, { errori });
    const barra = await page.evaluate(async () => {
      const m = () => document.querySelector('meta[name="theme-color"]').getAttribute('content');
      const testa = () => getComputedStyle(document.querySelector('.topbar')).backgroundColor;
      const out = { chiaro: [m(), testa()] };
      toggleDark(true); await new Promise(r => setTimeout(r, 50));
      out.scuro = [m(), testa()];
      toggleDark(false); await new Promise(r => setTimeout(r, 50));
      out.diNuovo = [m(), testa()];
      if (typeof coloreBarra !== 'function') { out.apertura = 'nessuno'; return out; }
      const finta = document.createElement('div'); finta.id = 'bootSplash'; document.body.appendChild(finta);
      coloreBarra(); out.apertura = m(); finta.remove(); coloreBarra();
      return out;
    });
    ok('4. la barra di stato segue il tema: il colore della testata nel chiaro e nello scuro, quello d\'apertura finché c\'è la schermata d\'apertura',
       barra.chiaro[0] === barra.chiaro[1] && barra.scuro[0] === barra.scuro[1] && barra.scuro[0] !== barra.chiaro[0]
       && barra.diNuovo[0] === barra.chiaro[0] && barra.apertura.toUpperCase() === '#14110B',
       JSON.stringify(barra));
    await page.close();
  }

  // ── 5. il tasto Condividi ────────────────────────────────────────────────
  if (fai(5)) {
    const man = JSON.parse(fs.readFileSync(path.join(RADICE, 'manifest.webmanifest'), 'utf8'));
    const html = fs.readFileSync(path.join(RADICE, 'Index 2.1.html'), 'utf8');
    const st = man.share_target || {};
    const legge = ['titolo', 'testo', 'collegamento'].every(k => html.includes(`q.get('${k}')`));
    ok('5. share_target resta nel manifest (Android), e i nomi dei campi sono quelli che l\'app legge',
       st.method === 'GET' && st.action === './index.html' && st.params && st.params.title === 'titolo' && st.params.text === 'testo' && st.params.url === 'collegamento' && legge,
       JSON.stringify(st.params));
    const INDICE = 'file://' + RADICE + '/index.html';
    const MAIL = 'Gentile ospite,\nla tua prenotazione su Booking.com è confermata.\n\nStruttura: Ryokan Sakura\nCheck-in: 16/03/2026 dalle 15:00\nCheck-out: 20/03/2026 entro le 10:00\n\nImporto totale: € 1.240,00';
    // un testo: la mail di un albergo
    let page = await apriPagina(browser, { errori, chiave: 'condividi-testo', indirizzo: INDICE + '?titolo=' + encodeURIComponent('Conferma') + '&testo=' + encodeURIComponent(MAIL) });
    await page.waitForTimeout(600);
    const mail = await page.evaluate(() => ({ aperto: !!document.querySelector('#mMailHotel.active'), testo: (document.getElementById('mhText') || {}).value || '', resta: location.search }));
    ok('5. un testo condiviso (la mail di un albergo) arriva al lettore delle prenotazioni, e l\'indirizzo si ripulisce',
       mail.aperto && /Ryokan Sakura/.test(mail.testo) && !mail.resta, JSON.stringify({ aperto: mail.aperto, resta: mail.resta }));
    await page.close();
    // un link: un posto condiviso da Google Maps, come lo manda Android
    page = await apriPagina(browser, { errori, chiave: 'condividi-link', indirizzo: INDICE + '?titolo=Kinkaku-ji&testo=' + encodeURIComponent('Kinkaku-ji\nhttps://maps.app.goo.gl/Kinkaku1') });
    // la funzione finta va messa prima che l'app la chiami: qui la si mette e si rifà l'ingresso
    await funzioneFinta(page);
    await page.goto(INDICE + '?titolo=Kinkaku-ji&testo=' + encodeURIComponent('Kinkaku-ji\nhttps://maps.app.goo.gl/Kinkaku1'));
    await page.waitForURL(/Index%202\.1\.html/);
    await page.waitForFunction(() => document.querySelector('#searchResults .res-name'), null, { timeout: 20000 }).catch(() => {});
    const link = await page.evaluate(() => {
      const card = [...document.querySelectorAll('#searchResults .res')].find(c => c.querySelector('.res-name'));
      const m = card ? /"lat":(-?[\d.]+),"lng":(-?[\d.]+)/.exec(card.getAttribute('onclick') || '') : null;
      return { pagina: (document.querySelector('.page.active') || {}).id, cerca: document.getElementById('searchMode').style.display, nome: card ? card.querySelector('.res-name').textContent : '', lat: m && +m[1], lng: m && +m[2], mail: !!document.querySelector('#mMailHotel.active') };
    });
    ok('5. un link condiviso da Google Maps arriva in Scopri › Cerca col posto, da aprire e salvare (non più al lettore delle prenotazioni)',
       link.pagina === 'discover' && link.cerca === 'block' && link.nome === 'Kinkaku-ji' && vicino(link.lat, LAT_K) && vicino(link.lng, LNG_K) && !link.mail,
       JSON.stringify(link));
    // il link nel campo «url», da solo
    await page.goto(INDICE + '?collegamento=' + encodeURIComponent('https://maps.app.goo.gl/Kinkaku1'));
    await page.waitForURL(/Index%202\.1\.html/);
    await page.waitForFunction(() => document.querySelector('#searchResults .res-name'), null, { timeout: 20000 }).catch(() => {});
    const soloUrl = await page.evaluate(() => (document.querySelector('#searchResults .res-name') || {}).textContent || '');
    // il Comando di iPhone: lo stesso link dopo il cancelletto
    await page.goto(APP + '#testo=' + encodeURIComponent('https://maps.app.goo.gl/Kinkaku1'));
    await page.waitForFunction(() => document.querySelector('#searchResults .res-name'), null, { timeout: 20000 }).catch(() => {});
    const comando = await page.evaluate(() => (document.querySelector('#searchResults .res-name') || {}).textContent || '');
    ok('5. anche col link nel campo «url», e col Comando di iPhone (#testo=): stesso posto, stesso punto', soloUrl === 'Kinkaku-ji' && comando === 'Kinkaku-ji', `url: «${soloUrl}», Comando: «${comando}»`);
    await page.close();
    // iPhone non usa share_target: l'app si apre da start_url senza niente
    page = await apriPagina(browser, { errori, chiave: 'condividi-niente', indirizzo: INDICE });
    await page.waitForTimeout(500);
    const niente = await page.evaluate(() => ({ pagina: (document.querySelector('.page.active') || {}).id, fogli: [...document.querySelectorAll('.modal.active')].map(m => m.id), cerca: document.getElementById('poiSearch').value }));
    ok('5. senza niente condiviso (iPhone, che share_target non lo usa) l\'app si apre normale: nessun foglio, nessuna ricerca',
       niente.pagina === 'plan' && !niente.fogli.length && !niente.cerca, JSON.stringify(niente));
    await page.close();
  }

  // ── 6. il link corto, coi rimandi e la pagina dei consensi ───────────────
  if (fai(6)) {
    const chiesti = [];
    const esito = await R.segui('https://maps.app.goo.gl/Kinkaku1', { fetch: googleFinto(chiesti) });
    ok('6. il servizio segue i rimandi fino alla pagina dei consensi e prende l\'indirizzo vero da «continue»',
       esito.url === KINKAKU && esito.consenso === true && !chiesti.some(u => /consent\.google/.test(u)),
       `${chiesti.length} richieste: ${chiesti.map(u => new URL(u).hostname).join(' → ')} → ${new URL(esito.url).pathname.slice(0, 40)}…`);
    const page = await apriPagina(browser, { errori, chiave: 'link-corti' });
    const fin = await funzioneFinta(page);
    await ricercaFinta(page);
    const esiti = {};
    for (const [nome, fare] of Object.entries(PUNTI)) esiti[nome] = await fare(page, 'https://maps.app.goo.gl/Kinkaku1');
    const giusti = Object.entries(esiti).filter(([, e]) => vicino(e.lat, LAT_K) && vicino(e.lng, LNG_K)).map(([n]) => n);
    ok('6. e l\'app ne ricava le coordinate giuste ovunque si incolla un posto: luoghi, ricerca degli hotel, foglio dell\'hotel, mail dell\'hotel, tappe',
       giusti.length === 5, Object.entries(esiti).map(([n, e]) => `${n} ${e.lat},${e.lng}`).join(' · '));
    ok('6. dicendo da dove viene la posizione (preso dal link di Google Maps)',
       /preso dal link di Google Maps/.test(esiti.ricercaHotel.nota || '') && /Posizione presa dal link di Google Maps/.test(esiti.mailHotel.testo) && esiti.mailHotel.approx === false,
       `${esiti.ricercaHotel.nota} / ${esiti.mailHotel.testo}`);
    const prima = fin.viste.length;
    await PUNTI.tappa(page, KINKAKU);
    ok('6. un link lungo con le coordinate si legge sul telefono, senza chiedere niente al servizio', fin.viste.length === prima, `${fin.viste.length - prima} richieste`);
    await page.close();
  }

  // ── 7. senza coordinate, col nome: lo trova la ricerca ───────────────────
  if (fai(7)) {
    const page = await apriPagina(browser, { errori, chiave: 'link-nome' });
    await funzioneFinta(page);
    const domande = await ricercaFinta(page);
    const esiti = {};
    for (const nome of ['tappa', 'ricercaHotel', 'luoghi', 'foglioHotel']) esiti[nome] = await PUNTI[nome](page, 'https://maps.app.goo.gl/Ryokan2');
    const giusti = Object.entries(esiti).filter(([, e]) => vicino(e.lat, LAT_R) && vicino(e.lng, LNG_R)).map(([n]) => n);
    ok('7. un link senza coordinate ma col nome del posto: l\'app lo trova con la sua ricerca (tappe, hotel, luoghi)',
       giusti.length === 4 && domande.some(u => /Ryokan(\+|%20| )Hoshi/i.test(u)),
       Object.entries(esiti).map(([n, e]) => `${n} ${e.lat},${e.lng}`).join(' · '));
    ok('7. e dice che l\'ha trovato col nome, perché un nome comune può sbagliare',
       /trovato dal nome nel link/.test(esiti.ricercaHotel.nota || '') && esiti.foglioHotel.approx === true, `${esiti.ricercaHotel.nota} / approssimativa: ${esiti.foglioHotel.approx}`);
    await page.close();
  }

  // ── 8. i rifiuti, il tempo, il limite ────────────────────────────────────
  if (fai(8)) {
    const NO = ['https://evil.example/maps', 'https://google.com.evil.example/maps/place/x', 'https://maps.app.goo.gl.evil.example/abc',
      'https://goo.gl/abc', 'http://maps.app.goo.gl/Kinkaku1', 'https://user:pw@maps.app.goo.gl/abc', 'https://maps.app.goo.gl:8443/abc',
      'https://consent.google.com/ml?continue=https://www.google.com/maps', 'https://www.google.com/search?q=x', 'javascript:alert(1)', 42];
    const SI = ['https://maps.app.goo.gl/Kinkaku1', 'https://goo.gl/maps/AbCd12', 'https://www.google.com/maps/place/Duomo', 'https://www.google.it/maps/@45.46,9.19,15z', 'https://maps.google.co.uk/?q=x'];
    const rifiutati = NO.filter(u => R.linkAmmesso(u)), accettati = SI.filter(u => !R.linkAmmesso(u));
    ok('8. il servizio accetta solo maps.app.goo.gl, goo.gl/maps e Google Maps: tutto il resto lo rifiuta', rifiutati.length === NO.length && accettati.length === SI.length,
       `${rifiutati.length}/${NO.length} rifiutati, ${accettati.length}/${SI.length} accettati` + (rifiutati.length < NO.length ? ' — passati: ' + NO.filter(u => !R.linkAmmesso(u)).join(', ') : ''));
    const chiesti = [], dentro = [];
    for (const u of ['https://maps.app.goo.gl/Cattivo3', 'https://maps.app.goo.gl/Consenso4', 'https://evil.example/x']) {
      try { await R.segui(u, { fetch: googleFinto(chiesti) }); dentro.push(u + ' passato'); } catch (e) { dentro.push(e.codice); }
    }
    ok('8. e un rimando che esce da Google non lo segue: nemmeno per vedere, la pagina di fuori non viene chiesta',
       dentro.every(x => x === 'non_ammesso') && !chiesti.some(u => /evil/.test(u)), dentro.join(', ') + ' · chiesti: ' + chiesti.map(u => new URL(u).hostname).join(', '));
    const t0 = Date.now();
    let codice = '';
    try { await R.segui('https://maps.app.goo.gl/Lento5', { fetch: googleFinto([]) }); } catch (e) { codice = e.codice; }
    const durata = Date.now() - t0;
    ok('8. Google lento: il servizio si ferma a 8 secondi e dice «tempo»', R.TEMPO_MAX_MS === 8000 && codice === 'tempo' && durata >= 7900 && durata < 9500, `${codice} dopo ${durata} ms`);
    const conta = R.nuovoLimite();
    const prime = Array.from({ length: R.LIMITE.perChi }, (_, i) => conta('1.2.3.4', 1000 + i)).every(Boolean);
    const troppo = conta('1.2.3.4', 2000), altro = conta('5.6.7.8', 2000), dopo = conta('1.2.3.4', 1000 + R.LIMITE.finestraMs + 100);
    ok(`8. il limite di richieste: ${R.LIMITE.perChi} in ${R.LIMITE.finestraMs / 60000} minuti dallo stesso indirizzo, poi «troppe»; un altro indirizzo no; passato il tempo si riparte`,
       prime && !troppo && altro && dopo, JSON.stringify({ prime, troppo, altro, dopo }));
    // e nell'app
    const page = await apriPagina(browser, { errori, chiave: 'link-guai' });
    let fin = await funzioneFinta(page);
    const cattivo = await PUNTI.tappa(page, 'https://maps.app.goo.gl/Cattivo3');
    ok('8. nell\'app, un link che porta fuori da Google: il messaggio dice che non è un link di Google Maps',
       /Questo non è un link di Google Maps/.test(cattivo.testo) && cattivo.lat == null && !fin.chiesti.some(u => /evil/.test(u)), cattivo.testo);
    fin = await funzioneFinta(page, { lenta: true });
    const t1 = Date.now();
    const lento = await PUNTI.tappa(page, 'https://maps.app.goo.gl/Lento5');
    const attesa = Date.now() - t1;
    ok('8. e un servizio che non risponde oltre 8 secondi: un messaggio chiaro, che dice cosa fare',
       /Google Maps non ha risposto in tempo: riprova fra poco, oppure apri il link e incolla l'indirizzo che vedi\./.test(lento.testo) && attesa > 8000 && attesa < 12000,
       `${lento.testo} (dopo ${attesa} ms)`);
    fin = await funzioneFinta(page, { stato: 504, errore: 'tempo' });
    const scaduto = await PUNTI.luoghi(page, 'https://maps.app.goo.gl/Kinkaku1');
    fin = await funzioneFinta(page, { stato: 429, errore: 'troppe' });
    const troppe = await PUNTI.ricercaHotel(page, 'https://maps.app.goo.gl/Kinkaku1');
    ok('8. e lo stesso quando è il servizio a dire «tempo» o «troppe»: la frase giusta, mai il testo del server',
       /non ha risposto in tempo/.test(scaduto.testo) && /Troppi link in poco tempo/.test(troppe.testo) && !/"errore"|tempo"|troppe"/.test(scaduto.testo + troppe.testo),
       `${scaduto.testo.slice(0, 60)}… / ${troppe.testo.slice(0, 60)}…`);
    await page.close();
  }

  // ── 9. le lingue e le misure ─────────────────────────────────────────────
  if (fai(9)) {
    const FRASI = ['Leggo il link di Google Maps…', 'Non riesco ad aprire il link: controlla la connessione e riprova.',
      'Google Maps non ha risposto in tempo: riprova fra poco, oppure apri il link e incolla l\'indirizzo che vedi.',
      'Troppi link in poco tempo: aspetta qualche minuto e riprova.',
      'Questo non è un link di Google Maps: incolla quello che ti dà «Condividi» in Google Maps, oppure le coordinate.',
      'Da questo link non riesco a capire il posto: aprilo, copia l\'indirizzo e incollalo qui.',
      'preso dal link di Google Maps', 'trovato dal nome nel link', 'Trovato dal nome nel link: controlla che sia il posto giusto.',
      'Posizione presa dal link di Google Maps'];
    const mancano = [], fuori = [], visti = [];
    for (const lingua of LINGUE) {
      for (const larghezza of [320, 430]) {
        const page = await apriPagina(browser, { errori, lingua, larghezza, chiave: 'lingue-' + lingua + larghezza });
        if (larghezza === 320) {
          const buchi = await page.evaluate(([frasi, l]) => frasi.filter(k => !DIZIONARIO[l] || !DIZIONARIO[l][k] || DIZIONARIO[l][k] === k), [FRASI, lingua]);
          if (lingua !== 'it') mancano.push(...buchi.map(k => lingua + ': ' + k.slice(0, 30)));
        }
        await funzioneFinta(page, { stato: 504, errore: 'tempo' });
        await ricercaFinta(page);
        const scritte = [];
        const lt = await PUNTI.luoghi(page, 'https://maps.app.goo.gl/Kinkaku1');
        scritte.push(['#searchResults', lt.testo]);
        const ht = await PUNTI.ricercaHotel(page, 'https://maps.app.goo.gl/Kinkaku1');
        scritte.push(['#hotResults', ht.testo]);
        const tt = await PUNTI.tappa(page, 'https://evil.example/posto');
        scritte.push(['#adAddrHint', tt.testo]);
        const att = await page.evaluate(() => typeof MSG_LINK === 'undefined' ? ['(nessuna frase)', '(nessuna frase)'] : [tv(MSG_LINK.tempo), tv(MSG_LINK.non_ammesso)]);
        if (!scritte[0][1].includes(att[0]) || !scritte[1][1].includes(att[0]) || !scritte[2][1].includes(att[1])) fuori.push(`${lingua} ${larghezza}: la frase a schermo non è quella della sua lingua`);
        if (lingua !== 'it' && scritte.some(([, s]) => /Google Maps non ha risposto|Questo non è un link/.test(s))) fuori.push(`${lingua}: italiano rimasto`);
        const misure = await page.evaluate(sel => sel.map(s => {
          const el = document.querySelector(s); if (!el || !el.getClientRects().length) return s + ' nascosto';
          const b = el.getBoundingClientRect();
          return el.scrollWidth > el.clientWidth + 1 || b.right > innerWidth + 0.5 || b.left < -0.5 ? `${s} esce (${Math.round(b.left)}–${Math.round(b.right)}, largo ${el.scrollWidth} su ${el.clientWidth})` : null;
        }).filter(Boolean), ['#adAddrHint']);
        // le altre due si guardano dove stanno, nelle loro pagine
        await PUNTI.luoghi(page, 'https://maps.app.goo.gl/Kinkaku1');
        misure.push(...await page.evaluate(() => { const el = document.querySelector('#searchResults .res') || document.getElementById('searchResults'); const b = el.getBoundingClientRect(); return b.right > innerWidth + 0.5 || el.scrollWidth > el.clientWidth + 1 ? ['#searchResults esce'] : []; }));
        await PUNTI.ricercaHotel(page, 'https://maps.app.goo.gl/Kinkaku1');
        misure.push(...await page.evaluate(() => { const el = document.querySelector('#hotResults > div') || document.getElementById('hotResults'); const b = el.getBoundingClientRect(); return b.right > innerWidth + 0.5 || el.scrollWidth > el.clientWidth + 1 ? ['#hotResults esce'] : []; }));
        fuori.push(...misure.map(m => `${lingua} ${larghezza}: ${m}`));
        visti.push(`${lingua} ${larghezza}`);
        await page.close();
      }
    }
    ok('9. i testi nuovi sono tradotti in tutte e cinque le lingue', !mancano.length, mancano.join(', ') || FRASI.length + ' frasi × 4 lingue');
    ok('9. e a schermo si leggono nella lingua giusta, senza uscire dallo schermo da 320 a 430 px', !fuori.length, fuori.join(' | ') || visti.length + ' schermate');
  }

  ok('nessun errore nelle pagine', !errori.length, errori.slice(0, 3).join(' | '));
  await browser.close();
  console.log(r.join('\n'));
  const passati = r.filter(x => x.startsWith('  OK')).length;
  console.log(`\n${passati}/${r.length} passati`);
  process.exit(passati === r.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
