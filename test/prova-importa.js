/* IMPORTARE UN VIAGGIO DA EXCEL, CSV O CELLE INCOLLATE.

   Chi organizza un viaggio in un foglio di Excel deve poterlo portare su
   GeppGo in pochi tocchi. Qui l'app e' servita dalla rete finta
   (rete-finta.js): SheetJS arriva dal pacchetto installato come se fosse
   cdn.sheetjs.com, i caratteri di Google sono veri, e la ricerca dei luoghi
   e' simulata. I file si fanno qui, dentro la prova.
   1. i caratteri: niente @import, restano in cache e si vedono offline;
   2. i tre tasti d'ingresso aprono l'importazione;
   3. .xlsx con intestazioni italiane e date di Excel come numeri;
   4. CSV con punto e virgola, gg/mm/aaaa, accenti in Windows-1252;
   5. CSV con virgola, intestazioni inglesi, orari 2:30 PM;
   6. celle incollate (tabulazioni);
   7. un file senza intestazioni: le colonne si assegnano a mano;
   8. righe con date sbagliate: segnalate, saltate o corrette;
   9. le righe di alloggio finiscono negli Hotel;
   10. aggiunta a un viaggio che c'e': prima il punto di ripristino;
   11. la ricerca dei luoghi: una al secondo, e chi non si trova lo dice;
   12. il limite del piano gratuito per un viaggio nuovo;
   13. oltre 5 MB o 1.000 righe: un messaggio chiaro;
   14. «Scarica un modello», reimportato, fa un viaggio giusto;
   15. i testi in cinque lingue, e niente fuori schermo da 320 a 430 px. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { apriBrowser, APP, RADICE } = require('./browser');
const { serverFinti } = require('./rete-finta');

/* Il file e' quello indicato da APP_URL, se c'e' (la controprova). */
const FILE_APP = APP.startsWith('file://') ? decodeURIComponent(APP.slice(7)) : path.join(RADICE, 'Index 2.1.html');
const FILE_SW = fs.existsSync(path.join(path.dirname(FILE_APP), 'sw.js')) ? path.join(path.dirname(FILE_APP), 'sw.js') : path.join(RADICE, 'sw.js');
const HTML = fs.readFileSync(FILE_APP, 'utf8');
const SW = fs.readFileSync(FILE_SW, 'utf8');
/* SheetJS per fare i file .xlsx della prova: lo stesso pacchetto che la
   rete finta serve all'app. */
let XLSX = null;
try { XLSX = require(path.join(RADICE, 'node_modules', 'xlsx')); } catch (e) {}
const CARTELLA = fs.mkdtempSync(path.join(os.tmpdir(), 'geppgo-importa-'));

const r = [];
const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);
const errori = [];
const piu = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const OGGI = new Date().toISOString().slice(0, 10);
const vuoto = (extra = {}) => Object.assign({ trips: [], settings: {}, myName: 'Gepp', skipAuth: true, consentNotif: true }, extra);
const unViaggio = (id, nome, extra = {}) => Object.assign({ id, name: nome, destination: 'Roma', currency: 'EUR', status: 'open', start: '2026-11-02', end: '2026-11-03',
  participants: [{ id: 1, name: 'Gepp', isMe: true }], suggested: [], pois: [], hotels: [], weather: {}, createdAt: 1, expenses: [], tickets: [],
  days: [{ id: 'd1', date: '2026-11-02', title: '', activities: [{ id: 501, name: 'Pantheon', time: '10:00', timeEnd: '11:00', type: 'any', who: [1], completed: false, booking: { needed: false, done: false } }] },
    { id: 'd2', date: '2026-11-03', title: '', activities: [] }] }, extra);

/* Windows-1252: come latin1, piu' l'euro (e le virgolette, che qui non
   servono). E' quello che salva Excel in italiano. */
const in1252 = s => Buffer.from([...s].map(c => c === '€' ? 0x80 : c.charCodeAt(0)));
const scrivi = (nome, dati) => { const f = path.join(CARTELLA, nome); fs.writeFileSync(f, dati); return f; };
const seriale = iso => { const [y, m, d] = iso.split('-').map(Number); return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 864e5; };

let srv, browser;
async function apri(stato, { sw = false, lingua = null, larghezza = 390, altezza = 844, scuro = false } = {}) {
  const page = await browser.newPage({ serviceWorkers: sw ? 'allow' : 'block', viewport: { width: larghezza, height: altezza } });
  page.on('pageerror', e => errori.push('PAGEERROR: ' + e.message.split('\n')[0]));
  await page.addInitScript(([s, l, d]) => {
    if (localStorage.getItem('prova-importa')) return;
    localStorage.clear();
    const st = JSON.parse(JSON.stringify(s)); st.settings = st.settings || {};
    if (l) st.settings.lingua = l;
    if (d) st.settings.dark = true;
    localStorage.setItem('geppgo2', JSON.stringify(st));
    localStorage.setItem('geppgo2_intro', '1');
    localStorage.setItem('prova-importa', '1');
  }, [stato, lingua, scuro]);
  await page.goto(srv.app + '/Index%202.1.html', { waitUntil: 'domcontentloaded' });
  await pronta(page);
  return page;
}
const pronta = page => page.waitForFunction(() => typeof window.renderAll === 'function' && !document.getElementById('bootSplash'), null, { timeout: 30000 });
const prova = async (nome, fn) => {
  Object.assign(srv.stato, { html: HTML, sw: SW, ritardoHtml: 0, giu: false, cdnGiu: false, cdnRotti: new Set(), caratteri: false });
  try { await fn(); } catch (e) { ok(nome, false, 'si è fermata: ' + e.message.split('\n')[0]); }
};
/* Dal foglio dell'app: si apre, si sceglie il file, e si aspetta la
   schermata di controllo (o il messaggio). */
async function daFile(p, file) {
  await p.evaluate(() => openImport());
  await p.waitForTimeout(300);
  await p.setInputFiles('#impFile', file);
  await p.waitForFunction(() => document.getElementById('impControlla').style.display !== 'none' || (document.getElementById('impMsg').textContent || '').trim() && !/Apro il file/.test(document.getElementById('impMsg').textContent), null, { timeout: 30000 });
  await p.waitForTimeout(200);
}
async function daIncolla(p, testo) {
  await p.evaluate(() => openImport());
  await p.waitForTimeout(300);
  await p.fill('#impTripText', testo);
  await p.click('#impScegli button.btn-soft');
  await p.waitForTimeout(300);
}
async function importa(p) {
  await p.click('#impControlla .imp-vai');
  await p.waitForFunction(() => document.getElementById('impFatto').style.display !== 'none', null, { timeout: 10000 });
  await p.waitForTimeout(200);
}
const viaggioOra = p => p.evaluate(() => {
  const t = T();
  return { nome: t.name, dest: t.destination, cur: t.currency, start: t.start, end: t.end,
    giorni: t.days.map(d => ({ data: d.date, att: d.activities.filter(a => !a.hotelId).map(a => ({ n: a.name, o: a.time, f: a.timeEnd, nota: a.notes, pos: !!a.senzaPosizione, lat: a.lat })) })),
    hotel: (t.hotels || []).map(h => ({ n: h.name, ci: h.checkIn, co: h.checkOut, ora: h.oraCheckIn || '' })),
    spese: t.expenses.map(e => ({ d: e.desc, a: e.origAmount, c: e.origCurrency, pagata: e.paid })) };
});
const riepilogo = p => p.evaluate(() => Object.fromEntries([...document.querySelectorAll('#impFatto .imp-tab tr')].map(tr => [tr.cells[0].textContent, tr.cells[1].textContent])));
/* Si finge la ricerca dei luoghi: Nominatim risponde per i posti noti, e
   segna l'ora di ogni domanda; Photon non trova niente. */
async function finteMappe(p, noti) {
  const domande = [];
  await p.route('**/nominatim.openstreetmap.org/**', route => {
    const u = new URL(route.request().url()), q = u.searchParams.get('q') || '';
    domande.push({ q: q + (u.searchParams.get('extratags') ? ' [extratags]' : ''), t: Date.now() });
    const k = Object.keys(noti).find(n => q.toLowerCase().includes(n.toLowerCase()));
    const corpo = k ? [{ display_name: k + ', Torino, Italia', lat: String(noti[k][0]), lon: String(noti[k][1]), class: 'tourism', type: 'attraction', importance: .8, address: { country_code: 'it' }, boundingbox: ['45', '45.1', '7.6', '7.7'] }] : [];
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corpo) });
  });
  await p.route('**/photon.komoot.io/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"features":[]}' }));
  return domande;
}

(async () => {
  srv = await serverFinti({ html: HTML, sw: SW });
  browser = await apriBrowser({ args: srv.args });

  /* ── 1. i caratteri ─────────────────────────────────────────────────── */
  await prova('1', async () => {
    const stili = [...HTML.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n');
    const link = /<link id="caratteri" rel="stylesheet" href="([^"]+)"/.exec(HTML);
    const nelSw = /const CARATTERI_CSS = '([^']+)'/.exec(SW);
    ok('1. nessun @import nel CSS: i caratteri arrivano con preconnect e un <link> che non ferma la pagina',
       !/@import/.test(stili) && /rel="preconnect" href="https:\/\/fonts\.googleapis\.com"/.test(HTML) && /rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin/.test(HTML)
       && !!link && /display=swap/.test(link[1]) && /<link id="caratteri"[^>]*media="print" onload="this\.media='all'"/.test(HTML),
       link ? link[1].slice(0, 60) + '…' : 'nessun link');
    ok('1. la service worker tiene lo stesso indirizzo del foglio dei caratteri', !!nelSw && !!link && nelSw[1] === link[1].replace(/&amp;/g, '&'));
    srv.stato.caratteri = true;
    const p = await apri(vuoto(), { sw: true });
    await p.evaluate(() => navigator.serviceWorker.ready);
    let tenuti = [];
    for (let i = 0; i < 60 && tenuti.length < 2; i++) {
      await p.waitForTimeout(500);
      tenuti = await p.evaluate(async () => (await caches.has('geppgo-caratteri')) ? (await (await caches.open('geppgo-caratteri')).keys()).map(q => q.url) : []);
    }
    ok('1. dopo il primo avvio foglio e file dei caratteri restano nel telefono', tenuti.some(u => /fonts\.googleapis\.com\/css2/.test(u)) && tenuti.some(u => /fonts\.gstatic\.com/.test(u)), tenuti.map(u => u.slice(8, 40)).join(' | '));
    srv.stato.giu = true; srv.stato.cdnGiu = true;
    const da = srv.log.length;
    await p.reload({ waitUntil: 'domcontentloaded' });
    await pronta(p);
    const visti = await p.evaluate(async () => {
      await document.fonts.load("600 20px 'Fraunces'");
      return [...document.fonts].filter(f => f.family.replace(/['"]/g, '') === 'Fraunces').map(f => f.status);
    });
    /* Il foglio la service worker prova a rinnovarlo in sottofondo (senza
       rete non riesce, e non importa: risponde con la copia); il file del
       carattere non lo chiede proprio. */
    const allaRete = srv.log.slice(da).filter(v => v.dove === 'cdn' && /fonts\./.test(v.url));
    const file = allaRete.filter(v => /gstatic/.test(v.url)).length, fogliRiusciti = allaRete.filter(v => v.esito === 200).length;
    ok('1. senza rete i caratteri si vedono lo stesso: arrivano dal telefono', visti.includes('loaded') && file === 0 && fogliRiusciti === 0,
       JSON.stringify({ visti, fileChiesti: file, rinnoviTentati: allaRete.length }));
    await p.close();
  });

  /* ── 2. i tre tasti d'ingresso ──────────────────────────────────────── */
  await prova('2', async () => {
    let p = await apri(vuoto());
    const aperto = () => p.evaluate(() => document.getElementById('mImport').classList.contains('active') && document.getElementById('impScegli').style.display !== 'none');
    await p.click('button:has-text("Importa da Excel o CSV")');
    await p.waitForTimeout(500);
    const home = await aperto();
    await p.evaluate(() => closeSheet('mImport'));
    await p.waitForTimeout(400);
    await p.evaluate(() => openNewTrip());
    await p.waitForTimeout(400);
    await p.click('#mNewTrip .imp-entra');
    await p.waitForTimeout(700);
    const nuovo = await aperto();
    const nuovoChiuso = await p.evaluate(() => !document.getElementById('mNewTrip').classList.contains('active'));
    await p.evaluate(() => closeSheet('mImport'));
    await p.waitForTimeout(400);
    await p.evaluate(() => openSheet('mViaggi'));
    await p.waitForTimeout(400);
    const ordine = await p.evaluate(() => { const a = document.querySelector('#mViaggi .vg-nuovo'), b = document.querySelector('#mViaggi .vg-importa'); return !!a && !!b && a.compareDocumentPosition(b) === Node.DOCUMENT_POSITION_FOLLOWING; });
    await p.click('#mViaggi .vg-importa');
    await p.waitForTimeout(600);
    const cassetto = await aperto();
    ok('2. dalla home vuota («Si parte?») accanto a «+ Aggiungi viaggio» e «Ho un codice»', home);
    ok('2. da «Nuovo viaggio», con la riga «Hai già il viaggio su Excel? Importalo»', nuovo && nuovoChiuso);
    ok('2. dal cassetto, sotto «+ Aggiungi viaggio»', cassetto && ordine);
    await p.close();
  });

  /* ── 3. .xlsx con le date di Excel ──────────────────────────────────── */
  await prova('3', async () => {
    if (!XLSX) throw new Error('SheetJS non è installato (npm install)');
    const g1 = '2026-11-12', g2 = '2026-11-13', g3 = '2026-11-15';
    const ws = XLSX.utils.aoa_to_sheet([['Data', 'Ora', 'Attività', 'Luogo', 'Città', 'Costo'],
      [null, null, 'Pranzo al mercato', 'Mercato di Porta Palazzo', 'Torino', 15],
      [null, null, 'Museo Egizio', 'Museo Egizio', 'Torino', 18],
      [null, null, 'Mole Antonelliana', 'Mole Antonelliana', 'Torino', ''],
      [null, null, 'Superga', 'Basilica di Superga', 'Torino', ''],
      [null, null, 'Partenza', 'Porta Nuova', 'Torino', '']]);
    /* Date e ore come le salva Excel: numeri con un formato. La prima del
       secondo giorno e' un numero nudo, senza formato; l'ultima riga del
       primo giorno non ha la data (Excel: la si scrive una volta). */
    const cella = (rr, c, v, z) => { ws[XLSX.utils.encode_cell({ r: rr, c })] = z ? { t: 'n', v, z } : { t: 'n', v }; };
    cella(1, 0, seriale(g1), 'dd/mm/yyyy'); cella(1, 1, 13 / 24, 'hh:mm');
    cella(2, 0, seriale(g1), 'dd/mm/yyyy'); cella(2, 1, 9.5 / 24, 'hh:mm');
    cella(3, 1, 16.25 / 24, 'hh:mm');
    cella(4, 0, seriale(g2)); cella(4, 1, 10 / 24, 'hh:mm');
    cella(5, 0, seriale(g3), 'd mmm yyyy'); cella(5, 1, 18 / 24, 'h:mm AM/PM');
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Itinerario');
    const f = scrivi('Torino in autunno.xlsx', XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
    const p = await apri(vuoto());
    await daFile(p, f);
    const capito = await p.evaluate(() => ({ campi: imp.campi, intest: imp.intest }));
    ok('3. le intestazioni italiane sono riconosciute', capito.intest && capito.campi.join() === 'data,ora,attivita,luogo,citta,costo', capito.campi.join());
    await importa(p);
    const v = await viaggioOra(p);
    const g = d => (v.giorni.find(x => x.data === d) || { att: [] }).att;
    ok('3. viaggio nuovo col nome del file, dalla prima all\'ultima data', v.nome === 'Torino in autunno' && v.start === g1 && v.end === g3 && v.giorni.length === 4 && v.dest === 'Torino',
       JSON.stringify({ nome: v.nome, start: v.start, end: v.end, giorni: v.giorni.length }));
    ok('3. attività nei giorni giusti e in ordine di orario', g(g1).map(a => a.o + ' ' + a.n).join(' | ') === '09:30 Museo Egizio | 13:00 Pranzo al mercato | 16:15 Mole Antonelliana'
       && g(g2).map(a => a.o + ' ' + a.n).join() === '10:00 Superga' && g(g3).map(a => a.o + ' ' + a.n).join() === '18:00 Partenza',
       v.giorni.map(x => x.data + ': ' + x.att.map(a => a.o + ' ' + a.n).join(', ')).join(' / '));
    ok('3. i costi diventano spese previste', v.spese.length === 2 && v.spese.every(s => s.pagata === false) && v.spese.some(s => s.d === 'Museo Egizio' && s.a === 18), JSON.stringify(v.spese));
    await p.close();
  });

  /* ── 4. CSV col punto e virgola, in Windows-1252 ────────────────────── */
  await prova('4', async () => {
    const csv = 'Data;Ora;Attività;Luogo;Città;Costo\r\n05/12/2026;10:00;Visita alla Città Vecchia;Duomo;Firenze;12,50 €\r\n05/12/2026;15:30;Caffè sul Lungarno;Lungarno;Firenze;\r\n06/12/2026;09:00;Gita a Fiesole;"Fiesole; Piazza Mino";Firenze;"1.234,00 €"\r\n';
    const f = scrivi('Firenze.csv', in1252(csv));
    const p = await apri(vuoto());
    await daFile(p, f);
    await importa(p);
    const v = await viaggioOra(p);
    const tutte = v.giorni.flatMap(x => x.att.map(a => x.data + ' ' + a.o + ' ' + a.n));
    ok('4. accenti giusti, date gg/mm/aaaa, punto e virgola anche dentro le virgolette',
       tutte.join(' | ') === '2026-12-05 10:00 Visita alla Città Vecchia | 2026-12-05 15:30 Caffè sul Lungarno | 2026-12-06 09:00 Gita a Fiesole'
       && v.giorni.find(x => x.data === '2026-12-06').att[0].nota.includes('Fiesole; Piazza Mino'), tutte.join(' | '));
    ok('4. i costi con la virgola e il simbolo dell\'euro', v.spese.map(s => s.a + ' ' + s.c).join() === '12.5 EUR,1234 EUR' && v.cur === 'EUR', JSON.stringify(v.spese));
    await p.close();
  });

  /* ── 5. CSV con la virgola e le intestazioni in inglese ─────────────── */
  await prova('5', async () => {
    const csv = 'Date,Start time,Activity,Location,City,Price\n08/14/2026,9:15 AM,Brooklyn Bridge walk,Brooklyn Bridge,New York,\n08/14/2026,2:30 PM,MoMA,Museum of Modern Art,New York,"$30.00"\n"Aug 15, 2026",12:00 PM,Lunch,Chelsea Market,New York,25 USD\n';
    const f = scrivi('New York.csv', csv);
    const p = await apri(vuoto());
    await daFile(p, f);
    const campi = await p.evaluate(() => imp.campi.join());
    await importa(p);
    const v = await viaggioOra(p);
    const tutte = v.giorni.flatMap(x => x.att.map(a => x.data + ' ' + a.o + ' ' + a.n));
    ok('5. intestazioni inglesi, date mese/giorno, orari AM/PM', campi === 'data,ora,attivita,luogo,citta,costo'
       && tutte.join(' | ') === '2026-08-14 09:15 Brooklyn Bridge walk | 2026-08-14 14:30 MoMA | 2026-08-15 12:00 Lunch', campi + ' → ' + tutte.join(' | '));
    ok('5. la valuta presa dai costi', v.cur === 'USD' && v.spese.map(s => s.a + ' ' + s.c).join() === '30 USD,25 USD', v.cur + ' ' + JSON.stringify(v.spese));
    await p.close();
  });

  /* ── 6. celle incollate ─────────────────────────────────────────────── */
  await prova('6', async () => {
    const celle = 'Giorno\tOra\tCosa\tDove\tNote\nlun 7 dic\t9:30\tColazione\tBar Centrale\tcornetto\n\t11.00-12.30\tMuseo\tMuseo del Cinema\t\nmar 8 dic\t10h30\tMercato\tPorta Palazzo\tportare contanti\n';
    const p = await apri(vuoto());
    await daIncolla(p, celle);
    const campi = await p.evaluate(() => imp.campi.join());
    await importa(p);
    const v = await viaggioOra(p);
    const anno = new Date().getUTCFullYear() + (Date.UTC(new Date().getUTCFullYear(), 11, 7) < Date.now() - 60 * 864e5 ? 1 : 0);
    const tutte = v.giorni.flatMap(x => x.att.map(a => x.data + ' ' + a.o + (a.f ? '-' + a.f : '') + ' ' + a.n));
    ok('6. celle incollate (tabulazioni): date a parole, la data scritta una volta, «11.00-12.30», «10h30»',
       campi === 'data,ora,attivita,luogo,note' && tutte.join(' | ') === `${anno}-12-07 09:30 Colazione | ${anno}-12-07 11:00-12:30 Museo | ${anno}-12-08 10:30 Mercato`,
       campi + ' → ' + tutte.join(' | '));
    ok('6. le note e il luogo finiscono nelle note dell\'attività', v.giorni.flatMap(x => x.att).find(a => a.n === 'Mercato').nota.includes('portare contanti'));
    await p.close();
  });

  /* ── 7. senza intestazioni: le colonne a mano ───────────────────────── */
  await prova('7', async () => {
    const csv = '2026-09-10;09:00;Duomo di Milano;Piazza del Duomo\n2026-09-10;14:00;Cenacolo;Santa Maria delle Grazie\n2026-09-11;10:00;Navigli;Alzaia Naviglio Grande\n';
    const f = scrivi('milano.csv', csv);
    const p = await apri(vuoto());
    await daFile(p, f);
    const prima = await p.evaluate(() => ({ intest: imp.intest, nota: /decidi tu/.test(document.getElementById('impControlla').textContent), colonne: document.querySelectorAll('#impControlla .imp-col select').length }));
    // si tolgono tutte, poi si scelgono a mano
    for (let c = 0; c < prima.colonne; c++) await p.selectOption(`#impControlla .imp-col:nth-of-type(${c + 1}) select`, '').catch(() => {});
    const sel = c => `#impControlla .imp-col >> nth=${c}`;
    for (let c = 0; c < prima.colonne; c++) await p.locator(sel(c)).locator('select').selectOption('');
    const vuote = await p.evaluate(() => impPronte().length);
    await p.locator(sel(0)).locator('select').selectOption('data');
    await p.locator(sel(1)).locator('select').selectOption('ora');
    await p.locator(sel(2)).locator('select').selectOption('attivita');
    await p.locator(sel(3)).locator('select').selectOption('indirizzo');
    await importa(p);
    const v = await viaggioOra(p);
    const tutte = v.giorni.flatMap(x => x.att.map(a => x.data + ' ' + a.o + ' ' + a.n));
    ok('7. senza intestazioni lo dice, e senza colonne scelte non c\'è niente da importare', !prima.intest && prima.nota && prima.colonne === 4 && vuote === 0, JSON.stringify(prima) + ' pronte: ' + vuote);
    ok('7. scelte le colonne a mano, l\'importazione riesce', tutte.join(' | ') === '2026-09-10 09:00 Duomo di Milano | 2026-09-10 14:00 Cenacolo | 2026-09-11 10:00 Navigli'
       && v.giorni[0].att[0].nota === 'Piazza del Duomo' && v.nome === 'milano', tutte.join(' | '));
    await p.close();
  });

  /* ── 8. date sbagliate ──────────────────────────────────────────────── */
  await prova('8', async () => {
    const csv = 'Data;Ora;Attività\n03/10/2026;10:00;Arena\n31/02/2026;11:00;Casa di Giulietta\n04/10/2026;09:00;Lago di Garda\ndomani;12:00;Pranzo\n\n05/10/2026;10:00;Castelvecchio\n';
    const f = scrivi('Verona.csv', csv);
    const p = await apri(vuoto());
    await daFile(p, f);
    const segnalate = await p.evaluate(() => [...document.querySelectorAll('#impControlla .imp-prob .imp-prob-t')].map(x => x.textContent));
    const pronte = await p.evaluate(() => impPronte().length);
    ok('8. le righe con la data sbagliata e la riga vuota sono segnalate una per una',
       segnalate.length === 3 && /Riga 3.*31\/02\/2026/.test(segnalate[0]) && /Riga 5.*domani/.test(segnalate[1]) && /Riga 6.*vuota/.test(segnalate[2]) && pronte === 3, segnalate.join(' | '));
    // una si corregge, l'altra si salta
    await p.locator('#impControlla .imp-prob[data-riga="3"] input[type=date]').fill('2026-10-03');
    await p.locator('#impControlla .imp-prob[data-riga="3"] input[type=date]').dispatchEvent('change');
    await p.waitForTimeout(200);
    const dopo = await p.evaluate(() => ({ pronte: impPronte().length, salta3: document.querySelector('#impControlla .imp-prob[data-riga="3"] .imp-salta input').checked }));
    await importa(p);
    const v = await viaggioOra(p);
    const rie = await riepilogo(p);
    const tutte = v.giorni.flatMap(x => x.att.map(a => x.data + ' ' + a.n));
    ok('8. correggendone una e saltando l\'altra, il resto viene importato', dopo.pronte === 4 && !dopo.salta3
       && tutte.join(' | ') === '2026-10-03 Arena | 2026-10-03 Casa di Giulietta | 2026-10-04 Lago di Garda | 2026-10-05 Castelvecchio' && rie['Righe saltate'] === '2',
       JSON.stringify(dopo) + ' → ' + tutte.join(' | ') + ' · saltate ' + rie['Righe saltate']);
    await p.close();
  });

  /* ── 9. gli alloggi negli Hotel ─────────────────────────────────────── */
  await prova('9', async () => {
    const csv = 'Data;Ora;Attività;Luogo;Tipo;Costo;Note\n10/09/2026;15:00;Check-in;Hotel Roma;Hotel;300;\n10/09/2026;20:00;Cena;Trattoria Da Enzo;Ristorante;;\n12/09/2026;10:00;Check-out;Hotel Roma;Hotel;;\n12/09/2026;14:00;Check-in;Casa Rosa;Airbnb;;\n14/09/2026;16:00;Arrivo;B&B Il Sole;B&B;;2 notti\n15/09/2026;10:00;Spiaggia;Lido;;;\n';
    const f = scrivi('Mare.csv', csv);
    const p = await apri(vuoto());
    await daFile(p, f);
    await importa(p);
    const v = await viaggioOra(p);
    const h = n => v.hotel.find(x => x.n === n) || {};
    const att = v.giorni.flatMap(x => x.att.map(a => a.n));
    const tappe = await p.evaluate(() => T().days.flatMap(d => d.activities.filter(a => a.hotelId).map(a => d.date + ' ' + a.time + ' ' + a.name)));
    ok('9. hotel, airbnb e B&B diventano Hotel, con check-in e check-out', v.hotel.length === 3
       && h('Hotel Roma').ci === '2026-09-10' && h('Hotel Roma').co === '2026-09-12' && h('Hotel Roma').ora === '15:00'
       && h('Casa Rosa').ci === '2026-09-12' && h('Casa Rosa').co === '2026-09-14'
       && h('B&B Il Sole').ci === '2026-09-14' && h('B&B Il Sole').co === '2026-09-16', JSON.stringify(v.hotel));
    ok('9. e non restano fra le attività; le tappe di check-in/out sono nella time-table', att.join() === 'Cena,Spiaggia' && tappe.includes('2026-09-10 15:00 Check-in · Hotel Roma') && tappe.includes('2026-09-12 10:00 Check-out · Hotel Roma'),
       att.join() + ' / ' + tappe.join(' | '));
    ok('9. il costo dell\'albergo è una spesa prevista dell\'hotel', v.spese.length === 1 && v.spese[0].d === 'Hotel · Hotel Roma' && v.spese[0].a === 300 && v.spese[0].pagata === false, JSON.stringify(v.spese));
    await p.close();
  });

  /* ── 10. aggiunta a un viaggio che c'e' ─────────────────────────────── */
  await prova('10', async () => {
    const p = await apri(vuoto({ trips: [unViaggio(1, 'Roma')], currentTripId: 1 }));
    // si cambia qualcosa, cosi' lo stato di prima non e' quello dell'avvio
    await p.evaluate(() => { T().days[1].activities.push({ id: 502, name: 'Trastevere', time: '19:00', timeEnd: '', type: 'any', who: [1], completed: false, booking: { needed: false, done: false } }); save(); });
    const primaDi = await p.evaluate(() => localStorage.getItem('geppgo2'));
    await daIncolla(p, 'Data\tOra\tAttività\n03/11/2026\t09:00\tColosseo\n04/11/2026\t10:00\tVilla Borghese\n');
    const scelta = await p.evaluate(() => imp.dest);
    await p.click('#impControlla .imp-dest input[value="aggiungi"]');
    await importa(p);
    const dopo = await p.evaluate(() => ({ snap: getSnaps().map(s => s.data), n: app.trips.length, t: T() }));
    const nomi = dopo.t.days.map(d => d.date + ': ' + d.activities.map(a => a.name).join(','));
    ok('10. prima di aggiungere si crea il punto di ripristino con il viaggio com\'era', dopo.snap.includes(primaDi), dopo.snap.length + ' punti');
    ok('10. le righe vanno nel viaggio aperto, che si allunga fino alla data nuova', dopo.n === 1 && nomi.join(' | ') === '2026-11-02: Pantheon | 2026-11-03: Trastevere,Colosseo | 2026-11-04: Villa Borghese' && dopo.t.end === '2026-11-04',
       scelta + ' → ' + nomi.join(' | '));
    await p.close();
  });

  /* ── 11. la ricerca dei luoghi ──────────────────────────────────────── */
  await prova('11', async () => {
    const p = await apri(vuoto());
    const domande = await finteMappe(p, { 'Museo Egizio': [45.0684, 7.6843], 'Mole Antonelliana': [45.069, 7.6933], 'Palazzo Reale': [45.0727, 7.6857] });
    await daIncolla(p, 'Data\tOra\tAttività\tLuogo\tCittà\n20/10/2026\t09:00\tMuseo\tMuseo Egizio\tTorino\n20/10/2026\t12:00\tPranzo\tPosto Inesistente\tTorino\n20/10/2026\t15:00\tMole\tMole Antonelliana\tTorino\n21/10/2026\t10:00\tReggia\tPalazzo Reale\tTorino\n');
    const t0 = Date.now();
    await importa(p);
    const barra0 = await p.evaluate(() => !!document.getElementById('impGeoBar'));
    await p.waitForFunction(() => imp && imp.fatto && imp.fatto.geo.finito, null, { timeout: 60000 });
    const fine = await p.evaluate(() => ({ testo: document.getElementById('impGeoT').textContent, barra: document.getElementById('impGeoBar').style.width, sistemare: document.getElementById('impDaSistemare').textContent }));
    const v = await viaggioOra(p);
    const a = n => v.giorni.flatMap(x => x.att).find(x => x.n === n) || {};
    const mie = domande.filter(d => d.t >= t0);
    const salti = mie.slice(1).map((d, i) => d.t - mie[i].t);
    ok('11. una domanda alla mappa per volta, distanziate di almeno un secondo', mie.length >= 5 && Math.min(...salti) >= 1000, mie.length + ' domande, salto minimo ' + Math.min(...salti) + ' ms' + (Math.min(...salti) < 1000 ? ' · ' + mie.map(d => (d.t - t0) + ' ' + d.q).join(' | ') : ''));
    ok('11. con la barra che avanza fino in fondo', barra0 && fine.barra === '100%', JSON.stringify(fine));
    ok('11. i luoghi trovati hanno la posizione, quello che non c\'è resta «senza posizione»',
       a('Museo').lat > 45 && a('Mole').lat > 45 && a('Reggia').lat > 45 && a('Pranzo').lat == null && a('Pranzo').pos && !a('Museo').pos && fine.sistemare === '1' && /1 da sistemare|Luoghi trovati: 3 di 4/.test(fine.testo),
       JSON.stringify(v.giorni.flatMap(x => x.att.map(z => z.n + ':' + (z.lat ? 'sì' : 'no')))) + ' ' + fine.testo);
    await p.evaluate(() => { closeSheet('mImport'); openDay(0); });
    await p.waitForTimeout(600);
    const segno = await p.evaluate(() => [...document.querySelectorAll('#ttBody .tt-block')].map(b => b.textContent).find(x => /Pranzo/.test(x)) || '');
    ok('11. e nella time-table lo si vede', /senza posizione/.test(segno), segno.slice(0, 80));
    await p.close();
  });

  /* ── 12. il limite del piano gratuito ───────────────────────────────── */
  await prova('12', async () => {
    const p = await apri(vuoto({ trips: [unViaggio(1, 'Roma'), unViaggio(2, 'Napoli')], currentTripId: 1 }));
    await daIncolla(p, 'Data\tAttività\n01/12/2026\tMercatini\n');
    const scena = await p.evaluate(() => ({ dest: imp.dest, nuovoSpento: document.querySelector('#impControlla .imp-dest input[value="nuovo"]').disabled, dice: /serve Premium/.test(document.getElementById('impControlla').textContent) }));
    // anche forzando la scelta, il viaggio nuovo non nasce
    await p.evaluate(() => { imp.dest = 'nuovo'; impEsegui(); });
    await p.waitForTimeout(500);
    const dopo = await p.evaluate(() => ({ n: app.trips.length, premium: document.getElementById('mPremium').classList.contains('active') }));
    ok('12. con il limite raggiunto il viaggio nuovo non si può scegliere, e si propone di aggiungere', scena.dest === 'aggiungi' && scena.nuovoSpento && scena.dice, JSON.stringify(scena));
    ok('12. e forzandolo non nasce: si apre Premium', dopo.n === 2 && dopo.premium, JSON.stringify(dopo));
    await p.close();
  });

  /* ── 13. i limiti ───────────────────────────────────────────────────── */
  await prova('13', async () => {
    const riga = '01/12/2026;10:00;Una visita molto lunga con un nome lunghissimo;Un posto;Una città;12,00 €;' + 'x'.repeat(200) + '\n';
    const grande = scrivi('grande.csv', 'Data;Ora;Attività;Luogo;Città;Costo;Note\n' + riga.repeat(Math.ceil(5.3 * 1048576 / riga.length)));
    const lunghe = scrivi('lunghe.csv', 'Data;Ora;Attività\n' + Array.from({ length: 1200 }, (_, i) => `01/12/2026;10:00;Riga ${i}\n`).join(''));
    const p = await apri(vuoto());
    await daFile(p, grande);
    const m1 = await p.evaluate(() => ({ msg: document.getElementById('impMsg').textContent, controllo: document.getElementById('impControlla').style.display !== 'none' }));
    await daFile(p, lunghe);
    const m2 = await p.evaluate(() => ({ msg: document.getElementById('impMsg').textContent, controllo: document.getElementById('impControlla').style.display !== 'none' }));
    ok('13. un file oltre 5 MB: lo dice, col peso e il limite', /pesa 5,\d MB: il limite è 5 MB/.test(m1.msg) && !m1.controllo, m1.msg);
    ok('13. oltre 1.000 righe: lo dice, e dice cosa fare', /Ci sono 1\.201 righe: il limite è 1\.000/.test(m2.msg) && /Dividi/.test(m2.msg) && !m2.controllo, m2.msg);
    await p.close();
  });

  /* ── 14. il modello ─────────────────────────────────────────────────── */
  await prova('14', async () => {
    const p = await apri(vuoto());
    /* Il foglio Condividi di iPhone qui non c'e': lo si finge, e si tiene il
       file che l'app gli consegna. */
    await p.evaluate(() => {
      window.__condiviso = null;
      navigator.canShare = d => !!(d && d.files && d.files.length);
      navigator.share = async d => { const f = d.files[0]; window.__condiviso = { nome: f.name, tipo: f.type, b64: btoa(String.fromCharCode(...new Uint8Array(await f.arrayBuffer()))) }; };
    });
    await p.evaluate(() => openImport());
    await p.waitForTimeout(300);
    await p.click('#impScegli .imp-modello');
    await p.waitForFunction(() => window.__condiviso, null, { timeout: 30000 });
    const dato = await p.evaluate(() => window.__condiviso);
    const buf = Buffer.from(dato.b64, 'base64');
    const f = scrivi(dato.nome, buf);
    ok('14. «Scarica un modello» consegna un file Excel al foglio Condividi', dato.nome === 'GeppGo-modello.xlsx' && buf.slice(0, 2).toString() === 'PK' && /spreadsheetml/.test(dato.tipo), dato.nome + ' ' + buf.length + ' byte');
    await daFile(p, f);
    await importa(p);
    const v = await viaggioOra(p);
    const d1 = piu(OGGI, 30), d2 = piu(d1, 1);
    ok('14. reimportato, fa un viaggio giusto: due giorni, l\'albergo, la visita, le spese previste',
       v.start === d1 && v.end === d2 && v.hotel.length === 1 && v.hotel[0].n === 'Hotel Artemide' && v.hotel[0].ci === d1 && v.hotel[0].co === d2 && v.hotel[0].ora === '15:00'
       && v.giorni[1].att.map(a => a.o + '-' + a.f + ' ' + a.n).join() === '11:00-13:00 Visita al Colosseo' && v.dest === 'Roma' && v.spese.length === 2,
       JSON.stringify({ start: v.start, end: v.end, hotel: v.hotel, g2: v.giorni[1] && v.giorni[1].att, spese: v.spese.length }));
    /* Le intestazioni del modello si riconoscono in ogni lingua. */
    const lingue = await p.evaluate(() => Object.entries(IMP_MODELLO).map(([l, m]) => l + ':' + m.col.map(impCampoDaIntestazione).join(',')));
    const atteso = 'data,ora,fine,attivita,luogo,indirizzo,citta,tipo,costo,valuta,note,link';
    ok('14. le colonne del modello si riconoscono in tutte e cinque le lingue', lingue.every(x => x.split(':')[1] === atteso), lingue.filter(x => x.split(':')[1] !== atteso).join(' | ') || '5 lingue');
    await p.close();
  });

  /* ── 15. lingue e schermi ───────────────────────────────────────────── */
  await prova('15', async () => {
    let p = await apri(vuoto());
    const d = await p.evaluate(() => {
      const it = Object.keys(DIZIONARIO_IMPORTA.en), buchi = [], uguali = new Set(['Link']);
      ['en', 'es', 'fr', 'pt'].forEach(l => it.forEach(k => { const v = DIZIONARIO_IMPORTA[l][k]; if (!v || (v === k && !uguali.has(k)) || DIZIONARIO[l][k] !== v) buchi.push(l + ': ' + k); }));
      const altri = ['es', 'fr', 'pt'].filter(l => Object.keys(DIZIONARIO_IMPORTA[l]).length !== it.length);
      /* Ogni frase dei campi del menu e dei messaggi ha la sua traduzione. */
      const campi = IMP_CAMPI.map(c => c[1]).filter(k => !DIZIONARIO.en[k]);
      return { n: it.length, buchi, altri, campi };
    });
    ok('15. le frasi nuove ci sono in inglese, spagnolo, francese e portoghese', d.n >= 80 && !d.buchi.length && !d.altri.length && !d.campi.length,
       d.buchi.slice(0, 3).join(' | ') || d.campi.join(', ') || d.n + ' frasi');
    await p.close();
    const viste = [];
    for (const [l, leggi, scegli] of [['en', 'Read the cells', '📄 Choose a file'], ['es', 'Leer las celdas', '📄 Elegir un archivo'], ['fr', 'Lire les cellules', '📄 Choisir un fichier'], ['pt', 'Ler as células', '📄 Escolher um ficheiro']]) {
      p = await apri(vuoto(), { lingua: l });
      await p.evaluate(() => openImport());
      await p.waitForTimeout(400);
      const t = await p.evaluate(() => ({ leggi: document.querySelector('#impScegli button.btn-soft').textContent.trim(), scegli: document.querySelector('#impScegli .imp-file').textContent.trim() }));
      await p.fill('#impTripText', 'Date\tTime\tActivity\n01/12/2026\t10:00\tX\n');
      await p.click('#impScegli button.btn-soft');
      await p.waitForTimeout(400);
      const ctrl = await p.evaluate(() => document.querySelector('#impControlla .imp-sez').textContent);
      viste.push(`${l}: ${t.leggi} / ${t.scegli} / ${ctrl}` + (t.leggi !== leggi || t.scegli !== scegli || /Cosa c/.test(ctrl) ? '  ← non tradotto' : ''));
      await p.close();
    }
    ok('15. il foglio dell\'importazione si legge in ogni lingua', !viste.some(v => /non tradotto/.test(v)), viste.join(' | '));
    /* Da 320 a 430 px, chiaro e scuro: niente esce dallo schermo, e i tasti
       si toccano col pollice (almeno 44 px). */
    const guasti = [];
    const misura = (pp, dove) => pp.evaluate(dv => {
      const W = innerWidth, fuori = [], piccoli = [];
      document.querySelectorAll('#mImport .sheet *').forEach(el => {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') return;
        /* Un testo troppo lungo tagliato coi puntini da un contenitore che sta
           nello schermo non esce: si vede fino al bordo del contenitore. */
        let taglia = el.parentElement, tagliato = false;
        for (; taglia && taglia !== document.body; taglia = taglia.parentElement) {
          if (/hidden|clip/.test(getComputedStyle(taglia).overflowX)) { const t = taglia.getBoundingClientRect(); if (t.right <= W + 1 && t.left >= -1) tagliato = true; break; }
        }
        if (!tagliato && (r.right > W + 1 || r.left < -1)) fuori.push((el.className || el.tagName) + ' ' + Math.round(r.left) + '→' + Math.round(r.right));
        if (el.matches('#impScegli button, #impScegli .imp-file, #impControlla button, #impControlla select, #impControlla input:not([type=checkbox]):not([type=radio]), #impControlla .imp-salta, #impControlla .imp-intest, #impControlla .rcard, #impFatto button') && r.height < 44)
          piccoli.push((el.className || el.tagName) + ' ' + Math.round(r.height));
      });
      const sheet = document.querySelector('#mImport .sheet');
      if (document.documentElement.scrollWidth > W || sheet.scrollWidth > sheet.clientWidth) fuori.push('scorre di lato');
      return { dv, fuori: fuori.slice(0, 4), piccoli: piccoli.slice(0, 4) };
    }, dove);
    for (const larghezza of [320, 375, 430]) for (const scuro of [false, true]) {
      p = await apri(vuoto({ trips: [unViaggio(1, 'Roma')], currentTripId: 1 }), { larghezza, altezza: 700, scuro });
      await p.evaluate(() => openImport());
      await p.waitForTimeout(400);
      const a = await misura(p, `${larghezza}${scuro ? ' scuro' : ''} scegli`);
      await p.fill('#impTripText', 'Data\tOra\tAttività\tLuogo\tCittà\tCosto\tTipo\tNote\n03/11/2026\t09:00\tUna visita guidata con un nome davvero molto lungo\tMuseo Nazionale\tRoma\t18 €\t\tbiglietti già presi\n03/11/2026\t15:00\tCheck-in\tHotel Artemide\tRoma\t240\tHotel\t\n31/02/2026\t12:00\tPranzo\tTrattoria\tRoma\t\t\t\n');
      await p.click('#impScegli button.btn-soft');
      await p.waitForTimeout(400);
      const b = await misura(p, `${larghezza}${scuro ? ' scuro' : ''} controllo`);
      await p.evaluate(() => { document.querySelector('#mImport .sheet').scrollTop = 1e6; });
      await p.waitForTimeout(150);
      const piede = await p.evaluate(() => { const r = document.querySelector('#impControlla .imp-vai').getBoundingClientRect(); return r.bottom <= innerHeight + 1 && r.top >= 0; });
      await importa(p);
      const c = await misura(p, `${larghezza}${scuro ? ' scuro' : ''} riepilogo`);
      [a, b, c].forEach(x => { if (x.fuori.length || x.piccoli.length) guasti.push(x.dv + ': ' + x.fuori.concat(x.piccoli).join(', ')); });
      if (!piede) guasti.push(`${larghezza}: il tasto per importare non si vede in fondo`);
      await p.close();
    }
    ok('15. da 320 a 430 px, chiaro e scuro: niente fuori schermo, tasti da almeno 44 px', !guasti.length, guasti.slice(0, 4).join(' | ') || '6 schermi × 3 passi');
  });

  ok('nessun errore in pagina', !errori.length, errori.slice(0, 3).join(' | '));
  console.log('\n' + r.join('\n'));
  const falliti = r.filter(x => x.includes('FALLITO')).length;
  console.log(`\n${r.length - falliti}/${r.length} passati`);
  try { fs.rmSync(CARTELLA, { recursive: true, force: true }); } catch (e) {}
  await browser.close();
  srv.chiudi();
  process.exit(falliti ? 1 : 0);
})();
