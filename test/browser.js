/* Come si apre il browser per le prove.

   Prima ogni file aveva scritto dentro il percorso esatto di Chromium, quello
   di questa macchina: le prove giravano qui e da nessun'altra parte. Con le
   prove che devono girare da sole a ogni modifica, il percorso non puo' piu'
   essere una cosa saputa a memoria da chi le ha scritte.

   L'ordine: quello che dice CHROMIUM_PATH, poi quello gia' installato su
   questa macchina, e se non c'e' ne' l'uno ne' l'altro si lascia decidere a
   Playwright (che sui server delle prove automatiche se lo scarica da solo). */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright-core');

const NOTI = [
  process.env.CHROMIUM_PATH,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
].filter(Boolean);

/* La cartella del progetto: di solito quella sopra a questo file. Le prove
   girano anche da altrove (dove sta playwright installato), quindi c'e' un
   ripiego su GEPPGO_DIR. Il ripiego non e' mai il percorso di una macchina in
   particolare: un percorso scritto a mano funziona finche' non si cambia
   computer, e poi non funziona piu' - ed e' esattamente quello che e'
   successo. */
const RADICE = fs.existsSync(path.resolve(__dirname, '..', 'Index 2.1.html'))
  ? path.resolve(__dirname, '..')
  : (process.env.GEPPGO_DIR || path.resolve(__dirname, '..'));

const APP = process.env.APP_URL || 'file://' + RADICE + '/Index%202.1.html';

async function apriBrowser(opzioni = {}) {
  const exe = NOTI.find(p => { try { return fs.existsSync(p); } catch (e) { return false; } });
  const browser = await chromium.launch(Object.assign(
    { args: ['--no-sandbox'] },
    exe ? { executablePath: exe } : {},
    opzioni
  ));
  /* Le pagine nascono in italiano, sempre. Da quando l'app segue la lingua
     del telefono, ereditare quella del computer su cui girano le prove
     significherebbe provare l'app in inglese senza averlo deciso - ed e' gia'
     successo: due prove che non c'entravano niente sono diventate rosse
     perche' il server delle prove parla inglese. Chi vuole un'altra lingua la
     chiede, e la sua scelta vince. */
  const nuovaPagina = browser.newPage.bind(browser);
  browser.newPage = async (opz = {}) => await recinta(await nuovaPagina(Object.assign({ locale: 'it-IT' }, opz)));
  return browser;
}

/* IL RECINTO: dalle prove non si esce in rete.
 *
 * COM'E' ANDATA. Da quando c'e' il ponte, l'app prima di chiedere alla mappa
 * chiede a noi - a cyolhqndurgwbivxcssf.supabase.co, il servizio VERO, quello
 * che usano i telefoni delle persone. Le prove intercettavano Overpass e non
 * il ponte: su questo computer la chiamata al ponte non passa (e allora l'app
 * ripiegava su Overpass, che era intercettato, e le prove passavano), ma sul
 * server delle prove automatiche la rete c'e' davvero. Li' il ponte
 * rispondeva sul serio, con quello che c'e' davvero intorno a quelle
 * coordinate, il finto Overpass non veniva interrogato mai, e cinque prove
 * diventavano rosse - una schiantandosi su `chiamate[0]` che non esisteva,
 * perche' nessuna chiamata era passata di li'.
 *
 * MA IL ROSSO ERA IL MENO. Una prova che parla col servizio vero non prova
 * niente: risponde il mondo, non il caso che si voleva provare, e il
 * risultato cambia da un'ora all'altra. E scriveva anche nella memoria
 * condivisa vera, quella di chi usa l'app.
 *
 * COSA PASSA. Solo il guscio: i pacchetti e i caratteri delle CDN, che sono
 * codice e non dati nostri. Tutto il resto - il ponte, Overpass, Nominatim,
 * il meteo, le mattonelle - o se lo intercetta la prova, o non succede.
 * Le rotte che la prova aggiunge dopo vincono su questa, perche' Playwright
 * guarda prima l'ultima registrata: il recinto e' il ripiego, non un muro.
 *
 * Il ponte e' chiuso APPOSTA anche qui: cosi' le prove guardano la strada
 * diretta, che e' quella che resta quando il ponte non c'e'. Che il ponte
 * funzioni lo prova test/prova-ponte.js, che se lo intercetta da solo. */
const FUORI_AMMESSI = new Set([
  'unpkg.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'
]);

async function recinta(page) {
  const fermate = [];
  page.__fuori = fermate;
  /* Si aspetta che la rotta sia davvero posata prima di restituire la
     pagina: registrarla e andare avanti lascia aperta la finestra in cui la
     prova naviga e il recinto non c'e' ancora. */
  await page.route('**/*', route => {
    const u = route.request().url();
    let url;
    try { url = new URL(u); } catch (e) { return route.continue(); }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return route.continue();
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return route.continue();
    if (FUORI_AMMESSI.has(url.hostname)) return route.continue();
    fermate.push(u);
    return route.abort('blockedbyclient');
  });
  return page;
}

/* Quello che il recinto ha fermato, per chi lo vuole controllare. */
function fuoriFermate(page) { return page.__fuori || []; }

/* La mappa arriva da una CDN che qui non e' raggiungibile: le prove la
   servono dal pacchetto installato. Il percorso lo chiede Node, invece di
   costruirlo a mano da __dirname - che cambia appena un file si sposta di
   cartella, come e' successo portando le prove dentro test/. */
function leafletJs()  { return dentroLeaflet('leaflet.js'); }
function leafletCss() { return dentroLeaflet('leaflet.css'); }
function dentroLeaflet(nome) {
  try { return require.resolve('leaflet/dist/' + nome); }
  catch (e) { return path.join(RADICE, 'node_modules/leaflet/dist/', nome); }
}

/* Dove finiscono le immagini che le prove scattano per farsi guardare da un
   essere umano. Non sono controlli: nessuna prova ci fa sopra un'asserzione,
   servono a chi vuole vedere com'era la schermata in quel momento.
   Serve una funzione, e non una costante scritta a mano, perche' due prove
   avevano dentro il percorso della cartella di lavoro di UNA sessione — che
   su qualunque altra macchina non esiste. E' lo stesso errore del percorso
   di Chromium, ripetuto in un altro punto. */
function cartellaFoto() {
  const dir = path.join(os.tmpdir(), 'geppgo-prove');
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
  return dir;
}

module.exports = { apriBrowser, APP, RADICE, leafletJs, leafletCss, cartellaFoto, fuoriFermate, FUORI_AMMESSI };
