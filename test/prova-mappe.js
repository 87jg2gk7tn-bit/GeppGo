/* LE MAPPE NUOVE: MapLibre ed Esri (novembre 2026).

   Tutte le mappe dell'app sono passate da Leaflet con le mattonelle di
   OpenStreetMap a MapLibre GL JS col satellite di Esri. Qui, con le risposte
   di Esri finte (test/esri-finto.js, fatte come quelle vere):
   1. ogni mappa — Oggi, Programma (stretto e largo), Tutto il viaggio, la
      scheda del viaggio, la scheda di un posto, le mappine di Scopri — nasce
      con MapLibre (o, per le mappine, coi pezzi di Esri) e mostra
      segnaposto, percorso e schede giusti;
   2. lo stile e' quello delle anteprime: i toni del tema, strade e nomi solo
      da vicino, la chiave su ogni richiesta a Esri e su nessun'altra, i nomi
      nella lingua dell'app; cambiando tema cambia la mappa; Tutto il viaggio
      e' un globo;
   3. la citazione («Powered by Esri», «© OpenStreetMap», «Fonti») su ogni
      mappa, i comandi da 44 px, nessuna violazione grave di axe;
   4. Esri che non risponde, o che rifiuta la chiave: la mappa lo dice,
      tradotto, e l'app va avanti (segnaposto, schede, le altre pagine);
   5. MapLibre arriva solo quando a schermo c'e' una mappa;
   6. nel codice non resta niente di Leaflet, e la chiave sta solo nella sua
      costante;
   7. quanti pezzi di mappa costa aprire Oggi e il Programma (si stampa). */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { apriBrowser, RADICE } = require('./browser');
const { apriPagina, VIAGGIO, PORTO } = require('./schermate');
const { chiaveDellApp, ATTRIBUZIONE_FOTO } = require('./esri-finto');

const HTML = fs.readFileSync(path.join(RADICE, 'Index 2.1.html'), 'utf8');
const SW = fs.readFileSync(path.join(RADICE, 'sw.js'), 'utf8');
const AXE = require.resolve('axe-core/axe.min.js');
const CHIAVE = chiaveDellApp(HTML);

const r = [];
const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);
const errori = [];
const scelte = process.argv.slice(2).map(Number).filter(Boolean);
const fai = n => !scelte.length || scelte.includes(n);
const prova = async (nome, fn) => { try { await fn(); } catch (e) { ok(nome, false, 'si è fermata: ' + e.message.split('\n')[0]); } };
const aspetta = (p, fn, arg, ms = 10000) => p.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
const pronta = (p, nome) => aspetta(p, n => { const m = window.eval(n); return !!m && m._g && m._g.pronta && m.loaded(); }, nome, 15000);
const fermi = p => p.evaluate(() => document.querySelectorAll('.modal.active').forEach(m => { try { closeSheet(m.id); } catch (e) {} }));

(async () => {
  const browser = await apriBrowser();

  /* ── 1. ogni mappa nasce con MapLibre e mostra quello che deve ───────── */
  if (fai(1)) await prova('1', async () => {
    const page = await apriPagina(browser, { errori, chiave: 'mappe-1-' + Math.random() });
    const esri = page.__esri;
    // OGGI: le tappe col numero (e la foto, dove c'e'), il percorso d'oro, la scheda
    await pronta(page, 'homeMapObj');
    await page.waitForTimeout(600);
    const oggi = await page.evaluate(() => ({
      mappa: homeMapObj instanceof maplibregl.Map, fonte: homeMapObj._g.fonte,
      segni: homeMapMarks.map(mk => ({ n: mk.getElement().querySelector('b').textContent, nome: mk.getElement().getAttribute('aria-label'), foto: !!mk.getElement().querySelector('img') })),
      percorso: !!homeMapObj.getLayer('g-percorso') && homeMapObj._g.dati.percorso.features.length === 1 && homeMapObj._g.dati.percorso.features[0].geometry.coordinates.length > 3,
      oro: homeMapObj.getPaintProperty('g-percorso', 'line-color'), tratteggio: homeMapObj.getPaintProperty('g-percorso', 'line-dasharray')
    }));
    ok('1. Oggi: MapLibre col fondo di Esri, le tre tappe numerate nell\'ordine della giornata', oggi.mappa && oggi.fonte === 'esri' && oggi.segni.map(s => s.n).join() === '1,2,3' && /^1\. Fushimi Inari/.test(oggi.segni[0].nome),
      JSON.stringify(oggi.segni));
    ok('1. e il percorso della giornata tratteggiato in oro', oggi.percorso && /^#E8B23A$/i.test(oggi.oro) && Array.isArray(oggi.tratteggio), `${oggi.oro} ${JSON.stringify(oggi.tratteggio)}`);
    /* la foto del posto, dove c'e': come nelle anteprime */
    await page.evaluate(() => { T().days[0].activities[1].photo = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACwAAAAAAQABAAACAkQBADs='; renderAll(); });
    await pronta(page, 'homeMapObj');
    const conFoto = await page.evaluate(() => homeMapMarks.map(mk => mk.getElement().classList.contains('con-foto') && !!mk.getElement().querySelector('.g-foto img')));
    ok('1. la tappa con la foto del posto ha il segnaposto con la foto e il numero', conFoto.join() === 'false,true,false', conFoto.join());
    await page.evaluate(() => homeMapMarks[1].getElement().click());
    await page.waitForTimeout(500);
    const scheda = await page.evaluate(() => ({ testo: (document.querySelector('#homeMap .maplibregl-popup .g-scheda-dentro') || {}).innerText || '', carta: (document.querySelector('.hh-card:nth-child(2)') || {}).getBoundingClientRect ? Math.round(document.querySelector('.hh-cards').scrollLeft) : -1 }));
    ok('1. toccando un segnaposto: la scheda col nome e l\'ora, e la striscia va alla sua tappa', /Nishiki/.test(scheda.testo) && /ore 12:00/.test(scheda.testo) && scheda.carta > 0, JSON.stringify(scheda));

    // PROGRAMMA (stretto)
    await page.evaluate(() => openDay(0));
    await pronta(page, 'dayMapObj');
    const giorno = await page.evaluate(() => ({ segni: Object.keys(dayMapSegni).length, albergo: document.querySelectorAll('#dayMap .g-albergo').length, percorso: !!dayMapObj.getLayer('g-percorso'),
      alta: Math.round(document.getElementById('dayMap').getBoundingClientRect().height) }));
    ok('1. Programma: le tappe del giorno, l\'albergo della notte e il percorso, in una mappa alta 130 px', giorno.segni === 3 && giorno.albergo === 1 && giorno.percorso && giorno.alta === 130, JSON.stringify(giorno));
    await page.evaluate(() => Object.values(dayMapSegni)[0].getElement().click());
    await page.waitForTimeout(500);
    const sg = await page.evaluate(() => (document.querySelector('#dayMap .maplibregl-popup .g-scheda-dentro') || {}).innerText || '');
    ok('1. e la scheda del segnaposto dice numero, nome e ora', /^1\. Fushimi Inari\s+ore 09:30/.test(sg.trim()), sg);

    // TUTTO IL VIAGGIO: il globo, le linee dei giorni, gli alberghi
    await page.evaluate(() => apriMappaViaggio());
    await pronta(page, 'vmMappa');
    await page.waitForTimeout(600);
    const tutto = await page.evaluate(() => ({ globo: vmMappa.getProjection().type, cielo: !!vmMappa.getSky(), linee: vmMappa._g.dati.linee.features.length, segni: vmSegni.length, case: vmCase.length, tasti: document.querySelectorAll('#vmMappa .maplibregl-ctrl-group button').length }));
    ok('1. Tutto il viaggio: il globo col suo cielo, la linea del giorno, le tappe e l\'albergo, e i tasti dello zoom', tutto.globo === 'globe' && tutto.cielo && tutto.linee === 1 && tutto.segni >= 2 && tutto.case === 1 && tutto.tasti === 2, JSON.stringify(tutto));
    await fermi(page);

    // LA SCHEDA DEL VIAGGIO: i posti col cerchio dell'avviso, gli alberghi con «Portami qui»
    await page.evaluate(() => openTripZoom(1));
    await page.waitForTimeout(400);
    await pronta(page, 'map');
    const viaggio = await page.evaluate(() => ({ posti: document.querySelectorAll('#map .g-posto').length, anelli: map._g.dati.anelli.features.length, alberghi: document.querySelectorAll('#map .g-albergo').length }));
    await page.evaluate(() => document.querySelector('#map .g-albergo').click());
    await page.waitForTimeout(400);
    const portami = await page.evaluate(() => [...document.querySelectorAll('#map .maplibregl-popup button')].map(b => b.textContent.trim()));
    ok('1. la scheda del viaggio: i posti salvati col loro cerchio, l\'albergo con «Portami qui»', viaggio.posti === 2 && viaggio.anelli === 2 && viaggio.alberghi === 1 && portami.includes('Portami qui'), JSON.stringify(viaggio) + ' ' + portami.join('|'));
    await fermi(page);

    // LA SCHEDA DI UN POSTO
    await page.evaluate(() => openPlaceInfo({ name: 'Kinkaku-ji', lat: 35.0394, lng: 135.7292, address: 'Kyoto', type: 'attraction' }));
    await pronta(page, 'piMapObj');
    const posto = await page.evaluate(() => { const c = piMapObj.getCenter(); return { lat: +c.lat.toFixed(4), lng: +c.lng.toFixed(4), spillo: !!document.querySelector('#piMap .g-spillo') }; });
    ok('1. la scheda di un posto: la mappa sul posto, col segno al centro', posto.lat === 35.0394 && posto.lng === 135.7292 && posto.spillo, JSON.stringify(posto));
    await fermi(page);

    // SCOPRI: le mappine ferme, coi pezzi di Esri e senza WebGL
    await page.evaluate(() => { go('discover'); setDiscover('search'); renderResults([{ display_name: 'Kinkaku-ji, Kyoto, Giappone', lat: '35.0394', lon: '135.7292', type: 'attraction', class: 'tourism' }, { display_name: 'Ginkaku-ji, Kyoto', lat: '35.0270', lon: '135.7982', type: 'attraction', class: 'tourism' }], 'searchResults'); });
    await aspetta(page, () => document.querySelectorAll('#searchResults .g-ferma[data-fonte="esri"] img').length > 0);
    const mappine = await page.evaluate(() => [...document.querySelectorAll('#searchResults .mini-map')].map(m => ({ fonte: m.dataset.fonte || '', pezzi: m.querySelectorAll('img').length, canvas: m.querySelectorAll('canvas').length, pin: !!m.querySelector('.g-ferma-pin') })));
    ok('1. Scopri: le mappine sono pezzi di Esri messi in fila (niente WebGL), col segno al centro', mappine.length === 2 && mappine[0].fonte === 'esri' && mappine[0].pezzi >= 1 && mappine[0].pezzi <= 4 && mappine.every(m => !m.canvas && m.pin), JSON.stringify(mappine));

    // la chiave: su ogni richiesta a Esri, e la lingua dell'app
    ok('1. ogni richiesta a Esri porta la chiave', esri.conta.senzaChiave === 0 && esri.conta.stile >= 1 && esri.conta.pezzi > 0, JSON.stringify(esri.conta));
    await page.close();
  });

  /* ── 1b. il Programma largo: la tappa e il suo segnaposto insieme ────── */
  if (fai(1)) await prova('1b', async () => {
    const page = await apriPagina(browser, { errori, larghezza: 1280, altezza: 800, chiave: 'mappe-1b-' + Math.random() });
    await page.evaluate(() => openDay(0));
    await pronta(page, 'dayMapObj');
    await page.waitForTimeout(400);
    await page.locator('#ttBody .tt-block[data-id="13"]').click();
    await page.waitForTimeout(700);
    const t = await page.evaluate(() => ({ largo: ttLargo(), segno: dayMapSegni[13].getElement().classList.contains('scelto'), scheda: (document.querySelector('#dayMap .maplibregl-popup .g-scheda-dentro') || {}).innerText || '',
      apri: !!document.querySelector('#dayMap .maplibregl-popup .tt-apri-tappa') }));
    ok('1. Programma largo: toccando una tappa si accende il suo segnaposto e si apre la sua scheda, con «Apri»', t.largo && t.segno && /Kiyomizu/.test(t.scheda) && t.apri, JSON.stringify(t));
    await page.close();
  });

  /* ── 2. lo stile: i toni, i nomi da vicino, il tema, la lingua ──────── */
  if (fai(2)) await prova('2', async () => {
    const page = await apriPagina(browser, { errori, chiave: 'mappe-2-' + Math.random() });
    await pronta(page, 'homeMapObj');
    const stile = await page.evaluate(() => {
      const st = homeMapObj.getStyle(), raster = st.layers.find(l => l.type === 'raster'), sopra = st.layers.filter(l => l.source === 'esri');
      return { fondo: homeMapObj.getPaintProperty('g-fondo', 'background-color'), opacita: homeMapObj.getPaintProperty(raster.id, 'raster-opacity'), saturazione: JSON.stringify(homeMapObj.getPaintProperty(raster.id, 'raster-saturation')),
        lato: st.sources[raster.source].tileSize, daVicino: sopra.length && sopra.every(l => l.minzoom >= ZOOM_CITTA), nomi: sopra.filter(l => l.type === 'symbol').map(l => l.paint && l.paint['text-color']),
        lontani: sopra.some(l => l.id === 'Admin0 point/label'), url: st.sources[raster.source].tiles[0] };
    });
    ok('2. tema chiaro: la foto grigia al 77% sopra l\'arancio, come l\'anteprima oggi-a', /#F0B464/i.test(stile.fondo) && stile.opacita === 0.77 && /-1/.test(stile.saturazione), JSON.stringify(stile));
    ok('2. strade e nomi sopra la foto solo da vicino (da ZOOM_CITTA), coi colori dell\'app; quelli che servono solo da lontano non ci sono', stile.daVicino && stile.nomi.every(c => /#1E1810/i.test(c)) && !stile.lontani, JSON.stringify(stile.nomi));
    ok('2. i pezzi della foto dichiarati da 362 px (meno pezzi, come nelle anteprime), con la chiave', stile.lato === 362 && stile.url.includes('token=' + encodeURIComponent(CHIAVE)), stile.lato + ' ' + stile.url.slice(0, 90));
    /* cambiando tema cambia la mappa: quella di Tutto il viaggio resta aperta
       e si ridipinge, quella di Oggi rinasce col tema nuovo */
    await page.evaluate(() => apriMappaViaggio());
    await pronta(page, 'vmMappa');
    const leggi = n => page.evaluate(n => { const m = window.eval(n), st = m.getStyle(), raster = st.layers.find(l => l.type === 'raster');
      return { m, fondo: m.getPaintProperty('g-fondo', 'background-color'), opacita: JSON.stringify(m.getPaintProperty(raster.id, 'raster-opacity')),
        nomi: m.getPaintProperty('Road/label/Major', 'text-color'), cielo: (m.getSky() || {})['sky-color'] }; }, n).then(x => (delete x.m, x));
    const chiaro = await leggi('vmMappa');
    const prima = await page.evaluate(() => vmMappa);
    await page.evaluate(() => cambiaTema());
    await page.waitForTimeout(300);
    const scuro = await leggi('vmMappa');
    const stessa = await page.evaluate(p => true, prima);
    await fermi(page);
    await pronta(page, 'homeMapObj');
    const oggiScuro = await leggi('homeMapObj');
    ok('2. cambiando tema la mappa diventa quella scura dell\'anteprima oggi-b (il blu notte, la foto più bassa, i nomi panna, il cielo del globo)',
      /#F0B464/i.test(chiaro.fondo) && /#0E1A36/i.test(scuro.fondo) && /0\.58/.test(scuro.opacita) && /#F6EEDD/i.test(scuro.nomi) && /#070D1C/i.test(scuro.cielo) && /#0E1A36/i.test(oggiScuro.fondo),
      JSON.stringify({ chiaro, scuro, oggiScuro }));
    await page.evaluate(() => cambiaTema());
    // la lingua dei nomi
    const lingue = {};
    for (const l of ['en', 'pt']) {
      const q = await apriPagina(browser, { errori, lingua: l, chiave: 'mappe-2' + l + '-' + Math.random() });
      const u = [];
      q.on('request', rq => { if (/basemapstyles-api/.test(rq.url())) u.push(rq.url()); });
      await q.evaluate(() => { Object.keys(ESRI_STILI).forEach(k => delete ESRI_STILI[k]); Object.keys(ESRI_PRONTI).forEach(k => delete ESRI_PRONTI[k]); destroyHomeMap(); renderAll(); });
      await pronta(q, 'homeMapObj');
      lingue[l] = (u[0] || '').match(/language=([^&]+)/);
      lingue[l] = lingue[l] && lingue[l][1];
      await q.close();
    }
    ok('2. i nomi sulla mappa nella lingua dell\'app (il portoghese del Portogallo)', lingue.en === 'en' && lingue.pt === 'pt-PT', JSON.stringify(lingue));
    await page.close();
  });

  /* ── 3. citazione, comandi da 44 px, axe ────────────────────────────── */
  if (fai(3)) await prova('3', async () => {
    const guai = [], viol = [];
    for (const tema of ['chiaro', 'scuro']) {
      const page = await apriPagina(browser, { errori, tema, chiave: 'mappe-3-' + Math.random() });
      await page.addScriptTag({ path: AXE });
      const CASI = [['Oggi', "go('plan')", '#homeMap', 'homeMapObj'], ['Programma', 'openDay(0)', '#dayMap', 'dayMapObj'], ['Tutto il viaggio', 'apriMappaViaggio()', '#vmMappa', 'vmMappa'], ['scheda del viaggio', 'openTripZoom(1)', '#map', 'map']];
      for (const [nome, js, sel, obj] of CASI) {
        await fermi(page); await page.evaluate(() => go('plan'));
        await page.waitForTimeout(200);
        await page.evaluate(js);
        await page.waitForTimeout(400);
        await pronta(page, obj);
        await page.waitForTimeout(400);
        const m = await page.evaluate(s => {
          const c = document.querySelector(s), d = c && c.querySelector('.g-diritti');
          if (!d) return { manca: true };
          d.scrollIntoView({ block: 'center' });
          const q = d.getBoundingClientRect();
          const tasti = [...c.parentElement.querySelectorAll('button,a[href]')].filter(b => !d.contains(b) && !b.closest('.maplibregl-marker,.maplibregl-popup') && b.getClientRects().length);
          const sopra = tasti.filter(b => { const k = b.getBoundingClientRect(), cx = k.left + k.width / 2, cy = k.top + k.height / 2; return !(cx + 22 <= q.left || cx - 22 >= q.right || cy + 22 <= q.top || cy - 22 >= q.bottom); }).map(b => b.getAttribute('aria-label') || b.textContent.trim());
          const zoom = [...c.querySelectorAll('.maplibregl-ctrl-group button')].map(b => { const k = b.getBoundingClientRect(); return Math.round(k.width) + 'x' + Math.round(k.height) + ' ' + b.getAttribute('aria-label'); });
          const t = d.textContent.replace(/\s+/g, ' ');
          return { esri: /Powered by Esri/.test(t), osm: /© OpenStreetMap/.test(t), fonti: !!d.querySelector('.g-fonti'), sopra, zoom };
        }, sel);
        if (m.manca) { guai.push(`${tema} ${nome}: nessuna citazione`); continue; }
        if (!m.esri || !m.osm || !m.fonti) guai.push(`${tema} ${nome}: citazione incompleta`);
        if (m.sopra.length) guai.push(`${tema} ${nome}: la citazione tocca ${m.sopra.join(', ')}`);
        if (m.zoom.some(z => !/^44x44 (Aumenta|Riduci) zoom$/.test(z))) guai.push(`${tema} ${nome}: zoom ${m.zoom.join(', ')}`);
        /* «Fonti» apre l'elenco di chi ha fatto le immagini */
        const fonti = await page.evaluate(s => { const b = document.querySelector(s + ' .g-fonti'); b.click(); const t = document.querySelector(s + ' .g-fonti-testo'); const v = !t.hidden && t.textContent; b.click(); return { v, aria: b.getAttribute('aria-expanded') }; }, sel);
        if (!fonti.v || !fonti.v.includes('Vantor') || fonti.aria !== 'false') guai.push(`${tema} ${nome}: «Fonti» ${JSON.stringify(fonti)}`);
        const a = await page.evaluate(async s => {
          const res = await axe.run({ include: [s] }, { resultTypes: ['violations'] });
          return res.violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => `${v.id}: ${v.nodes.slice(0, 2).map(n => n.target.join(' ')).join(', ')}`);
        }, sel);
        a.forEach(v => viol.push(`${tema} ${nome}: ${v}`));
      }
      await page.close();
    }
    ok('3. ogni mappa ha «Powered by Esri», «© OpenStreetMap» e «Fonti» (che apre le fonti), in un angolo che non tocca i tasti, nei due temi', !guai.filter(g => !/zoom/.test(g)).length, guai.filter(g => !/zoom/.test(g)).slice(0, 4).join(' | ') || '8 mappe');
    ok('3. i tasti dello zoom sono da 44 px, col nome nella lingua dell\'app', !guai.filter(g => /zoom/.test(g)).length, guai.filter(g => /zoom/.test(g)).slice(0, 3).join(' | '));
    ok('3. nessuna violazione grave o critica di axe sulle mappe, nei due temi', !viol.length, viol.slice(0, 4).join(' | '));
  });

  /* ── 4. Esri che non risponde, o che rifiuta la chiave ──────────────── */
  if (fai(4)) await prova('4', async () => {
    for (const [caso, esri, lingua, atteso] of [['non risponde', { giu: true }, 'it', 'La mappa satellitare non risponde: controlla la rete e riprova.'],
      ['rifiuta la chiave', { rifiuta: true }, 'it', 'La mappa satellitare ora non è disponibile: riprova più tardi.'],
      ['non risponde (in inglese)', { giu: true }, 'en', 'The satellite map isn’t responding: check your connection and try again.']]) {
      const page = await apriPagina(browser, { errori, esri, lingua, chiave: 'mappe-4-' + Math.random() });
      await aspetta(page, () => !!homeMapObj && !document.querySelector('#homeMap .g-avviso').hidden);
      const m = await page.evaluate(() => ({ avviso: document.querySelector('#homeMap .g-avviso span').textContent, tasto: document.querySelector('#homeMap .g-avviso button').textContent,
        fonte: homeMapObj._g.fonte, segni: homeMapMarks.length }));
      // l'app va avanti: la scheda di un segnaposto, il Programma, Spese
      await page.evaluate(() => homeMapMarks[0].getElement().click());
      await page.waitForTimeout(300);
      const scheda = await page.evaluate(() => !!document.querySelector('#homeMap .maplibregl-popup'));
      await page.evaluate(() => openDay(0));
      await aspetta(page, () => !!dayMapObj && Object.keys(dayMapSegni).length === 3, null, 6000);
      await page.evaluate(() => go('money'));
      await page.waitForTimeout(300);
      const avanti = await page.evaluate(() => ({ giorno: !!dayMapObj && Object.keys(dayMapSegni).length, spese: document.getElementById('money').classList.contains('active') }));
      ok(`4. Esri ${caso}: la mappa lo dice con un messaggio chiaro e «${m.tasto}», e va avanti col ripiego e coi segnaposto`,
        m.avviso === atteso && m.fonte === 'osm' && m.segni === 3 && scheda, JSON.stringify(m));
      ok(`4. e l'app non si blocca (la scheda, il Programma, Spese) — ${caso}`, avanti.giorno === 3 && avanti.spese, JSON.stringify(avanti));
      await page.close();
    }
    /* «Riprova» quando Esri torna: le mappe tornano tutte insieme. Esri
       finto legge `giu` a ogni richiesta: si cambia mentre la prova gira. */
    const comeRisponde = { giu: true };
    const page = await apriPagina(browser, { errori, esri: comeRisponde, chiave: 'mappe-4r-' + Math.random() });
    await aspetta(page, () => !!homeMapObj && !document.querySelector('#homeMap .g-avviso').hidden);
    comeRisponde.giu = false;
    await page.evaluate(() => document.querySelector('#homeMap .g-avviso button').click());
    await aspetta(page, () => homeMapObj._g.fonte === 'esri' && homeMapObj._g.pronta);
    const tornata = await page.evaluate(() => ({ fonte: homeMapObj._g.fonte, avviso: !document.querySelector('#homeMap .g-avviso').hidden, citazione: /Powered by Esri/.test(document.querySelector('#homeMap .g-diritti').textContent) }));
    ok('4. «Riprova», quando Esri torna: la mappa satellitare torna e l\'avviso se ne va', tornata.fonte === 'esri' && !tornata.avviso && tornata.citazione, JSON.stringify(tornata));
    await page.close();
  });

  /* ── 5. MapLibre solo quando serve una mappa ────────────────────────── */
  if (fai(5)) await prova('5', async () => {
    const senzaPosti = JSON.parse(JSON.stringify(VIAGGIO));
    senzaPosti.days.forEach(d => d.activities.forEach(a => { delete a.lat; delete a.lng; delete a.poiId; }));
    senzaPosti.hotels = []; senzaPosti.pois = [];
    const page = await apriPagina(browser, { errori, viaggi: [senzaPosti, PORTO], chiave: 'mappe-5-' + Math.random() });
    const chieste = [];
    page.on('request', rq => { if (/maplibre-gl@/.test(rq.url())) chieste.push(rq.url()); });
    await page.waitForTimeout(1500);
    const prima = await page.evaluate(() => typeof maplibregl);
    await page.evaluate(() => apriMappaViaggio());
    await aspetta(page, () => typeof maplibregl !== 'undefined' && !!vmMappa);
    ok('5. senza mappe a schermo MapLibre non si scarica; aprendo una mappa arriva', prima === 'undefined' && chieste.length === 2, `prima: ${prima}, poi ${chieste.length} richieste`);
    const testa = HTML.slice(0, HTML.indexOf('<body'));
    ok('5. e niente di MapLibre nella testa della pagina (la prima schermata non lo aspetta)', !/maplibre/i.test(testa) && !/<script[^>]+maplibre/i.test(HTML));
    await page.close();
  });

  /* ── 6. niente Leaflet, e la chiave in un posto solo ────────────────── */
  if (fai(6)) await prova('6', async () => {
    const pkg = fs.readFileSync(path.join(RADICE, 'package.json'), 'utf8');
    const resti = [['Index 2.1.html', HTML], ['sw.js', SW], ['package.json', pkg]].filter(([, t]) => /leaflet/i.test(t)).map(([n]) => n);
    ok('6. nel codice non resta nessun riferimento a Leaflet (app, service worker, dipendenze)', !resti.length && !/\bL\.(map|marker|divIcon|tileLayer)\(/.test(HTML), resti.join(', '));
    /* La chiave: si cercano tutti i file del repo (quelli che git conosce,
       piu' quelli nuovi non ancora aggiunti), tranne i pacchetti. */
    let elenco = [];
    try { elenco = execFileSync('git', ['-C', RADICE, 'ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' }).split('\n').filter(Boolean); } catch (e) {}
    const dove = [];
    for (const f of elenco) {
      const p = path.join(RADICE, f);
      let t = ''; try { if (fs.statSync(p).size > 20e6) continue; t = fs.readFileSync(p, 'utf8'); } catch (e) { continue; }
      const n = t.split(CHIAVE).length - 1;
      if (n) dove.push(`${f} ×${n}`);
    }
    const costante = (HTML.match(/const ESRI_CHIAVE='[^']+';/g) || []).length;
    ok('6. la chiave di Esri sta solo nella sua costante (ESRI_CHIAVE, in Index 2.1.html)', !!CHIAVE && costante === 1 && dove.length === 1 && dove[0] === 'Index 2.1.html ×1', dove.join(', ') || 'da nessuna parte');
    const claude = fs.readFileSync(path.join(RADICE, 'CLAUDE.md'), 'utf8');
    ok('6. e CLAUDE.md dice dove sta, che è pubblica ma limitata al sito, e che scade a novembre 2027', /ESRI_CHIAVE/.test(claude) && /87jg2gk7tn-bit\.github\.io/.test(claude) && /novembre 2027/.test(claude));
  });

  /* ── 7. quanti pezzi di mappa costa un'apertura ─────────────────────── */
  if (fai(7)) await prova('7', async () => {
    const misure = {};
    for (const [nome, js, obj] of [['Oggi', null, 'homeMapObj'], ['Programma', 'openDay(0)', 'dayMapObj']]) {
      const page = await apriPagina(browser, { errori, chiave: 'mappe-7-' + Math.random() });
      if (!js) { await pronta(page, obj); await page.waitForTimeout(1500); misure[nome] = Object.assign({}, page.__esri.conta); }
      else {
        await pronta(page, 'homeMapObj'); await page.waitForTimeout(1500);
        const prima = Object.assign({}, page.__esri.conta);
        await page.evaluate(js); await pronta(page, obj); await page.waitForTimeout(1500);
        misure[nome] = Object.fromEntries(Object.keys(prima).map(k => [k, page.__esri.conta[k] - prima[k]]));
      }
      await page.close();
    }
    console.log(`  pezzi di mappa per apertura (390×844) — Oggi: ${misure.Oggi.pezzi} della foto, ${misure.Oggi.vettori} di strade e nomi, ${misure.Oggi.stile} stile · ` +
      `Programma: ${misure.Programma.pezzi} della foto, ${misure.Programma.vettori} di strade e nomi, ${misure.Programma.stile} stile`);
    /* Al massimo una dozzina: la mappa di Oggi nasce gia' sulla tappa in mano
       (prima volava dall'inquadratura alla tappa, e il volo chiedeva una
       ventina di pezzi di passaggio). */
    ok('7. aprire Oggi e il Programma chiede pochi pezzi (al massimo una dozzina ciascuno), e lo stile una volta sola', misure.Oggi.pezzi > 0 && misure.Oggi.pezzi <= 12 && misure.Programma.pezzi <= 12 && misure.Oggi.stile === 1 && misure.Programma.stile === 0,
      JSON.stringify(misure));
  });

  ok('nessun errore in pagina', !errori.length, errori.slice(0, 3).join(' | '));
  console.log('\n' + r.join('\n'));
  const falliti = r.filter(x => x.includes('FALLITO')).length;
  console.log(`\n${r.length - falliti}/${r.length} passati`);
  await browser.close();
  process.exit(falliti ? 1 : 0);
})();
