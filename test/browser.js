/* Come si apre il browser per le prove.

   Prima ogni file aveva scritto dentro il percorso esatto di Chromium, quello
   di questa macchina: le prove giravano qui e da nessun'altra parte. Con le
   prove che devono girare da sole a ogni modifica, il percorso non puo' piu'
   essere una cosa saputa a memoria da chi le ha scritte.

   L'ordine: quello che dice CHROMIUM_PATH, poi quello gia' installato su
   questa macchina, e se non c'e' ne' l'uno ne' l'altro si lascia decidere a
   Playwright (che sui server delle prove automatiche se lo scarica da solo). */
const fs = require('fs');
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
  return chromium.launch(Object.assign(
    { args: ['--no-sandbox'] },
    exe ? { executablePath: exe } : {},
    opzioni
  ));
}

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

module.exports = { apriBrowser, APP, RADICE, leafletJs, leafletCss };
