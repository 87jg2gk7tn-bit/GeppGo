/* LE ICONE DELL'APP, FATTE DAL LOGO.
 *
 *   npm run icone        rifà icona.svg e i PNG in icone/
 *
 * Il logo vero sta in un posto solo: l'SVG della testata dentro
 * «Index 2.1.html» (.brand-logo). Da lì si fanno tutte le icone:
 * - icona.svg, l'icona della scheda del browser;
 * - icone/apple-touch-icon.png, 180×180, per la Home di iPhone: piena, sul
 *   fondo scuro della schermata d'apertura, perché iPhone l'SVG non lo usa e
 *   la trasparenza la riempie di nero;
 * - icone/icona-192.png e icona-512.png, quelle del manifest: il tondo da
 *   solo, su fondo trasparente;
 * - icone/icona-maskable-512.png, quella che Android ritaglia nella forma che
 *   vuole (tondo, goccia, quadrato): il fondo arriva fino ai bordi e il logo
 *   sta tutto dentro il cerchio centrale dell'80%, la zona che nessun
 *   ritaglio tocca.
 * Prima l'icona era un globo marrone di una versione vecchia, e per iPhone un
 * SVG che iPhone ignorava: sulla Home finiva una fotografia della pagina.
 *
 * Le disegna Chromium, lo stesso delle prove (vedi browser.js): un SVG
 * disegnato da un browser è quello che si vede nell'app. I PNG senza
 * trasparenza escono senza canale alfa: non «trasparenza a zero», proprio
 * niente da riempire. test/prova-installazione.js ridisegna e confronta:
 * se il logo cambia e le icone no, la prova lo dice. */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { apriBrowser, RADICE } = require('./browser');

const FONDO = '#14110B';   // la schermata d'apertura (#bootSplash), e il manifest
/* disco: quanto del lato prende il tondo dorato del logo. */
const ICONE = [
  { file: 'icone/apple-touch-icon.png', lato: 180, fondo: FONDO, disco: 0.80 },
  { file: 'icone/icona-192.png', lato: 192, fondo: null, disco: 0.96 },
  { file: 'icone/icona-512.png', lato: 512, fondo: null, disco: 0.96 },
  { file: 'icone/icona-maskable-512.png', lato: 512, fondo: FONDO, disco: 0.72 }
];

/* L'SVG del logo, preso dalla testata dell'app. */
function logoDallApp() {
  const html = fs.readFileSync(path.join(RADICE, 'Index 2.1.html'), 'utf8');
  const m = html.match(/<svg class="brand-logo"[^>]*>([\s\S]*?)<\/svg>/);
  if (!m) throw new Error('Nella testata dell\'app non trovo il logo (.brand-logo)');
  const dentro = m[1].split('\n').map(r => r.trim()).filter(Boolean).join('\n  ');
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48" fill="none">\n' +
    '  <!-- Il logo di GeppGo, copiato dalla testata dell\'app da test/fai-le-icone.js (npm run icone). Non si modifica qui. -->\n  ' +
    dentro + '\n</svg>\n';
}

/* ── un PNG scritto a mano: zlib c'è già in Node, e così non serve niente ── */
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (const b of buf) c = CRC[(c ^ b) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function pezzo(tipo, dati) {
  const lun = Buffer.alloc(4); lun.writeUInt32BE(dati.length);
  const td = Buffer.concat([Buffer.from(tipo, 'ascii'), dati]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td));
  return Buffer.concat([lun, td, c]);
}
/* rgba: i pixel come li dà il canvas. Con alfa=false si scrivono solo R, G e
   B (tipo colore 2): il file non ha più un canale per la trasparenza. */
function png(lato, rgba, alfa) {
  const passo = alfa ? 4 : 3;
  const grezzo = Buffer.alloc((lato * passo + 1) * lato);
  for (let y = 0; y < lato; y++) {
    const riga = y * (lato * passo + 1);
    grezzo[riga] = 0;
    for (let x = 0; x < lato; x++) {
      const da = (y * lato + x) * 4, a = riga + 1 + x * passo;
      grezzo[a] = rgba[da]; grezzo[a + 1] = rgba[da + 1]; grezzo[a + 2] = rgba[da + 2];
      if (alfa) grezzo[a + 3] = rgba[da + 3];
    }
  }
  const testa = Buffer.alloc(13);
  testa.writeUInt32BE(lato, 0); testa.writeUInt32BE(lato, 4);
  testa[8] = 8; testa[9] = alfa ? 6 : 2; testa[10] = 0; testa[11] = 0; testa[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    pezzo('IHDR', testa), pezzo('IDAT', zlib.deflateSync(grezzo, { level: 9 })), pezzo('IEND', Buffer.alloc(0))
  ]);
}

/* I pixel di ogni icona, disegnati da Chromium. Torna { svg, icone: [{ file,
   lato, fondo, rgba (Buffer), png (Buffer) }] }. */
async function disegnaIcone(browser) {
  const svg = logoDallApp();
  const proprio = !browser;
  if (proprio) browser = await apriBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent('<!doctype html><html><body></body></html>');
    const fatte = [];
    for (const ic of ICONE) {
      const b64 = await page.evaluate(async ({ svg, lato, fondo, disco }) => {
        const img = new Image();
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
        await img.decode();
        const cv = document.createElement('canvas');
        cv.width = cv.height = lato;
        const g = cv.getContext('2d');
        if (fondo) { g.fillStyle = fondo; g.fillRect(0, 0, lato, lato); }
        /* Nel logo il tondo è largo 46 su 48: si disegna il quadrato intero
           perché il tondo misuri `disco` del lato, al centro. */
        const intero = lato * disco * 48 / 46, da = (lato - intero) / 2;
        g.drawImage(img, da, da, intero, intero);
        const px = g.getImageData(0, 0, lato, lato).data;
        let s = '';
        for (let i = 0; i < px.length; i += 0x8000) s += String.fromCharCode.apply(null, px.subarray(i, i + 0x8000));
        return btoa(s);
      }, { svg, lato: ic.lato, fondo: ic.fondo, disco: ic.disco });
      const rgba = Buffer.from(b64, 'base64');
      fatte.push(Object.assign({}, ic, { rgba, png: png(ic.lato, rgba, !ic.fondo) }));
    }
    return { svg, icone: fatte };
  } finally {
    await page.close();
    if (proprio) await browser.close();
  }
}

module.exports = { ICONE, FONDO, logoDallApp, disegnaIcone, png };

if (require.main === module) {
  (async () => {
    const { svg, icone } = await disegnaIcone();
    fs.writeFileSync(path.join(RADICE, 'icona.svg'), svg);
    fs.mkdirSync(path.join(RADICE, 'icone'), { recursive: true });
    for (const ic of icone) {
      fs.writeFileSync(path.join(RADICE, ic.file), ic.png);
      console.log(`  ${ic.file.padEnd(30)} ${ic.lato}×${ic.lato}  ${ic.fondo ? 'pieno, senza trasparenza' : 'tondo su fondo trasparente'}  ${(ic.png.length / 1024).toFixed(1)} KB`);
    }
    console.log('  icona.svg                      dal logo della testata');
  })().catch(e => { console.error(e); process.exit(1); });
}
