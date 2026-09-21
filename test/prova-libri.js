/* Le prove di «libri» — il lettore di EPUB che legge ad alta voce.
 *
 * Due cose non si possono provare con un file:// e per questo qui dentro c'è
 * un server vero, anche se è l'unica prova del repo che ne ha uno.
 *
 *   1. IndexedDB non esiste su file://. Chrome lo nega e basta, e «libri» è
 *      fatto quasi tutto di IndexedDB: senza server non si proverebbe niente.
 *   2. Il service worker non si registra su file://.
 *
 * ElevenLabs non viene mai chiamato davvero: costa soldi a carattere, e una
 * prova che spende non la lancia più nessuno. Al suo posto c'è una finta che
 * restituisce MP3 veri (fotogrammi silenziosi, ma fotogrammi) e i tempi
 * carattere per carattere, e che soprattutto CONTA quante volte è stata
 * chiamata: è l'unico modo per dimostrare che riprendendo un capitolo
 * interrotto non si ripaga quello che era già stato generato.
 */
const { apriBrowser, RADICE, cartellaFoto } = require('./browser');
const fs = require('fs');
const path = require('path');
const http = require('http');
const zlib = require('zlib');

const r = [];
const ok = (nome, cond, extra = '') =>
  r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);
const vicino = (a, b, tolleranza) => Math.abs(a - b) <= tolleranza;

// ── un EPUB finto, costruito qui ────────────────────────────────────────────
/* Serve uno zip, e non c'è un pacchetto per farlo fra le dipendenze delle
   prove. Uno zip senza compressione sono tre intestazioni in fila: si scrive
   una volta e non ci si pensa più. */
function zip(voci) {
  const pezzi = [], centrale = [];
  let posizione = 0;
  for (const v of voci) {
    const nome = Buffer.from(v.nome, 'utf8');
    const dati = Buffer.isBuffer(v.dati) ? v.dati : Buffer.from(v.dati, 'utf8');
    /* `zlib.crc32` c'è da Node 20.15 in poi. Le prove automatiche girano su
       Node 20, quindi la strada del ripiego è quella vera là e non è mai
       quella che si prova qui: è stata provata a parte, forzandola. */
    const crc = zlib.crc32 ? zlib.crc32(dati) : crc32(dati);

    const locale = Buffer.alloc(30);
    locale.writeUInt32LE(0x04034b50, 0);
    locale.writeUInt16LE(20, 4);
    locale.writeUInt32LE(crc >>> 0, 14);
    locale.writeUInt32LE(dati.length, 18);
    locale.writeUInt32LE(dati.length, 22);
    locale.writeUInt16LE(nome.length, 26);
    pezzi.push(locale, nome, dati);

    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt32LE(crc >>> 0, 16);
    cen.writeUInt32LE(dati.length, 20);
    cen.writeUInt32LE(dati.length, 24);
    cen.writeUInt16LE(nome.length, 28);
    cen.writeUInt32LE(posizione, 42);
    centrale.push(cen, nome);

    posizione += locale.length + nome.length + dati.length;
  }
  const corpoCentrale = Buffer.concat(centrale);
  const fine = Buffer.alloc(22);
  fine.writeUInt32LE(0x06054b50, 0);
  fine.writeUInt16LE(voci.length, 8);
  fine.writeUInt16LE(voci.length, 10);
  fine.writeUInt32LE(corpoCentrale.length, 12);
  fine.writeUInt32LE(posizione, 16);
  return Buffer.concat([Buffer.concat(pezzi), corpoCentrale, fine]);
}

function crc32(buf) {
  let c, tavola = crc32.t;
  if (!tavola) {
    tavola = crc32.t = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      tavola[n] = c >>> 0;
    }
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ tavola[(crc ^ buf[i]) & 0xFF];
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function paginaXhtml(titolo, paragrafi) {
  return '<?xml version="1.0" encoding="utf-8"?>\n' +
    '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>' + titolo + '</title></head>' +
    '<body><h1>' + titolo + '</h1>' +
    paragrafi.map(p => '<p>' + p + '</p>').join('') +
    '</body></html>';
}

/* Tre capitoli veri, più due pagine che non lo sono: la copertina e una
   pagina bianca. Ci sono apposta — l'app deve buttarle, perché capitoli da
   tre secondi a schermo bloccato sono un cambio di file ogni tre secondi.

   I capitoli sono lunghi apposta. Con capitoli corti stavano in un pezzo
   solo, e metà delle prove qui sotto — quelle che contano le richieste e
   quella che interrompe la generazione a metà — passavano senza aver mai
   provato niente, perché non c'era una metà in cui fermarsi. */
const P = (n, quanti) => Array.from({ length: quanti }, (_, i) =>
  'Paragrafo ' + (i + 1) + ' del capitolo ' + n + '. ' +
  'Qui ci sta una frase abbastanza lunga da assomigliare a della prosa vera, ' +
  'con virgole, punti e un po’ di respiro, perché spezzare un testo di ' +
  'cinque parole non dimostra niente di quello che succede su un libro.');

function epubFinto() {
  const opf =
    '<?xml version="1.0" encoding="utf-8"?>\n' +
    '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id">' +
    '<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">' +
    '<dc:identifier id="id">prova-libri-1</dc:identifier>' +
    '<dc:title>Il libro di prova</dc:title>' +
    '<dc:creator>Chi l’ha scritto</dc:creator>' +
    '<dc:language>it</dc:language>' +
    '</metadata>' +
    '<manifest>' +
    '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>' +
    '<item id="cop" href="copertina.xhtml" media-type="application/xhtml+xml"/>' +
    '<item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/>' +
    '<item id="c2" href="c2.xhtml" media-type="application/xhtml+xml"/>' +
    '<item id="vuota" href="vuota.xhtml" media-type="application/xhtml+xml"/>' +
    '<item id="c3" href="c3.xhtml" media-type="application/xhtml+xml"/>' +
    '</manifest>' +
    '<spine>' +
    '<itemref idref="cop"/><itemref idref="c1"/><itemref idref="c2"/>' +
    '<itemref idref="vuota"/><itemref idref="c3"/>' +
    '</spine></package>';

  const nav =
    '<?xml version="1.0" encoding="utf-8"?>\n' +
    '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">' +
    '<head><title>Indice</title></head><body><nav epub:type="toc"><ol>' +
    '<li><a href="c1.xhtml">La partenza</a></li>' +
    '<li><a href="c2.xhtml#dentro">Il mezzo</a></li>' +
    '<li><a href="c3.xhtml">La fine</a></li>' +
    '</ol></nav></body></html>';

  return zip([
    { nome: 'mimetype', dati: 'application/epub+zip' },
    { nome: 'META-INF/container.xml', dati:
      '<?xml version="1.0"?><container version="1.0" ' +
      'xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles>' +
      '<rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>' +
      '</rootfiles></container>' },
    { nome: 'OEBPS/content.opf', dati: opf },
    { nome: 'OEBPS/nav.xhtml', dati: nav },
    { nome: 'OEBPS/copertina.xhtml', dati: paginaXhtml('Copertina', ['Il libro di prova']) },
    { nome: 'OEBPS/c1.xhtml', dati: paginaXhtml('La partenza', P(1, 24)) },
    { nome: 'OEBPS/c2.xhtml', dati: paginaXhtml('Il mezzo', P(2, 16)) },
    { nome: 'OEBPS/vuota.xhtml', dati: paginaXhtml('', []) },
    { nome: 'OEBPS/c3.xhtml', dati: paginaXhtml('La fine', P(3, 8)) }
  ]);
}

/* Un EPUB in cui non c'è niente da leggere. Con `protetto` ci si mette anche
   il file che i libri comprati in libreria hanno quando il testo è cifrato:
   è l'unico modo per distinguere «questo libro non ha testo» da «questo
   libro il testo ce l'ha ma non me lo fa leggere», e sono due messaggi
   diversi per chi li riceve. */
function epubSenzaTesto(protetto) {
  const opf =
    '<?xml version="1.0" encoding="utf-8"?>\n' +
    '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id">' +
    '<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">' +
    '<dc:identifier id="id">muto</dc:identifier><dc:title>Un libro muto</dc:title>' +
    '</metadata>' +
    '<manifest><item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/></manifest>' +
    '<spine><itemref idref="c1"/></spine></package>';
  const voci = [
    { nome: 'mimetype', dati: 'application/epub+zip' },
    { nome: 'META-INF/container.xml', dati:
      '<?xml version="1.0"?><container version="1.0" ' +
      'xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles>' +
      '<rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>' +
      '</rootfiles></container>' },
    { nome: 'OEBPS/content.opf', dati: opf },
    { nome: 'OEBPS/c1.xhtml', dati: paginaXhtml('', ['.']) }
  ];
  if (protetto) {
    voci.push({ nome: 'META-INF/encryption.xml', dati:
      '<?xml version="1.0"?><encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container"/>' });
  }
  return zip(voci);
}

// ── un fotogramma MP3 vero, silenzioso ──────────────────────────────────────
/* FF FB 90 C0: MPEG-1 Layer III, 128 kbps costanti, 44100 Hz, mono, senza
   CRC. Con le informazioni di lato a zero il fotogramma è silenzio, ma è un
   fotogramma valido: il browser lo decodifica, ne calcola la durata e lo
   suona. Serve proprio questo — un MP3 finto che il browser rifiuta non
   proverebbe che i capitoli attaccati si suonano davvero.
   417 byte a fotogramma, 1152 campioni: 26,12 millisecondi l'uno. */
function fotogrammaMp3() {
  const f = Buffer.alloc(417);
  f[0] = 0xFF; f[1] = 0xFB; f[2] = 0x90; f[3] = 0xC0;
  return f.toString('base64');
}

// ── il server ───────────────────────────────────────────────────────────────
const TIPI = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.css': 'text/css', '.json': 'application/json'
};

function servi() {
  return new Promise((risolvi) => {
    const s = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const file = path.join(RADICE, p);
      if (!file.startsWith(RADICE) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end('no'); return;
      }
      res.writeHead(200, { 'content-type': TIPI[path.extname(file)] || 'application/octet-stream' });
      res.end(fs.readFileSync(file));
    });
    s.listen(0, '127.0.0.1', () => risolvi({ server: s, porta: s.address().port }));
  });
}

// ── la finta di ElevenLabs, dentro la pagina ────────────────────────────────
function fintaElevenLabs(conf) {
  window.__api = { chiamate: [], rompiA: -1, frame: conf.frame };

  const daBase64 = (b64) => {
    const g = atob(b64);
    const u = new Uint8Array(g.length);
    for (let i = 0; i < g.length; i++) u[i] = g.charCodeAt(i);
    return u;
  };
  const inBase64 = (u8) => {
    let s = '';
    for (let i = 0; i < u8.length; i += 8192) {
      s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192));
    }
    return btoa(s);
  };

  const frame = daBase64(conf.frame);
  const vero = window.fetch.bind(window);

  window.fetch = async (risorsa, opzioni) => {
    const url = String(risorsa && risorsa.url ? risorsa.url : risorsa);
    if (url.indexOf('api.elevenlabs.io') === -1) return vero(risorsa, opzioni);

    if (url.indexOf('/v1/voices') !== -1) {
      return new Response(JSON.stringify({ voices: [
        { voice_id: 'v-mia', name: 'La mia voce', category: 'cloned' },
        { voice_id: 'v-altra', name: 'Una di serie', category: 'premade' }
      ] }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (url.indexOf('/v1/user/subscription') !== -1) {
      return new Response(JSON.stringify({ character_count: 1000, character_limit: 100000 }),
        { status: 200, headers: { 'content-type': 'application/json' } });
    }

    const corpo = JSON.parse(opzioni.body);
    const n = window.__api.chiamate.length + 1;
    window.__api.chiamate.push({
      testo: corpo.text,
      caratteri: corpo.text.length,
      prima: corpo.previous_text || '',
      dopo: corpo.next_text || '',
      ids: corpo.previous_request_ids || [],
      modello: corpo.model_id,
      voce: url
    });

    if (n === window.__api.rompiA) {
      return new Response(JSON.stringify({ detail: { message: 'rotto apposta' } }),
        { status: 422, headers: { 'content-type': 'application/json' } });
    }

    /* Tanti fotogrammi quanto è lungo il testo, così i capitoli hanno durate
       diverse: con durate tutte uguali un errore negli scostamenti fra un
       capitolo e l'altro non si vedrebbe. */
    const quanti = Math.max(12, Math.round(corpo.text.length * 0.15));
    const audio = new Uint8Array(quanti * frame.length);
    for (let i = 0; i < quanti; i++) audio.set(frame, i * frame.length);

    // I tempi: il testo spalmato sulla durata, carattere per carattere.
    const durata = quanti * 1152 / 44100;
    const c = corpo.text.split('');
    const da = [], a = [];
    for (let i = 0; i < c.length; i++) {
      da.push(i * durata / c.length);
      a.push((i + 1) * durata / c.length);
    }

    return new Response(JSON.stringify({
      audio_base64: inBase64(audio),
      alignment: { characters: c, character_start_times_seconds: da, character_end_times_seconds: a }
    }), {
      status: 200,
      headers: { 'content-type': 'application/json', 'request-id': 'req-' + n }
    });
  };
}

// ═══════════════════════════════════════════════════════════════════════════
(async () => {
  const { server, porta } = await servi();
  const INDIRIZZO = 'http://127.0.0.1:' + porta + '/libri/index.html';

  const browser = await apriBrowser({
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--mute-audio']
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errori = [];
  page.on('pageerror', e => errori.push('PAGEERROR: ' + e.message));

  /* Le librerie arrivano dalla CDN: qui si servono da node_modules, come fanno
     già le altre prove con la mappa.

     ⚠️ L'intercettazione va messa sul CONTESTO, non sulla pagina, e ci sono
     già cascato: `page.route` non vede le richieste fatte dal service worker.
     Appena il service worker si attiva — cosa che succede qualche decimo dopo
     l'apertura — è lui a servire gli script, la CDN vera da qui non si
     raggiunge, e l'app si ritrova senza le librerie per leggere gli EPUB. Si
     vedeva solo se fra l'apertura e l'importazione passava abbastanza tempo,
     cioè si vedeva a intermittenza, che è il modo peggiore. */
  const locali = {
    'jszip': path.join(RADICE, 'node_modules/jszip/dist/jszip.min.js'),
    'epubjs': path.join(RADICE, 'node_modules/epubjs/dist/epub.min.js')
  };
  await page.context().route('**/cdn.jsdelivr.net/**', (rotta) => {
    const url = rotta.request().url();
    const quale = url.indexOf('jszip') !== -1 ? 'jszip' : 'epubjs';
    if (!fs.existsSync(locali[quale])) return rotta.abort();
    rotta.fulfill({
      status: 200,
      contentType: 'text/javascript; charset=utf-8',
      body: fs.readFileSync(locali[quale], 'utf8')
    });
  });

  await page.addInitScript(fintaElevenLabs, { frame: fotogrammaMp3() });
  await page.goto(INDIRIZZO, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.LIBRI && window.LIBRI.ora, { timeout: 20000 });

  ok('l’app si apre senza errori in pagina', errori.length === 0, errori[0] || '');

  // ── senza chiave si finisce nelle impostazioni ────────────────────────────
  ok('senza chiave si apre sulle impostazioni',
     await page.evaluate(() => document.getElementById('scImpostazioni').classList.contains('attiva')));

  /* Lo sblocco dell'audio: al primo tocco l'elemento suona un attimo di
     silenzio per restare libero anche dopo, quando fra il tocco e il play ci
     saranno stati minuti di generazione. Quello che si controlla qui è che
     non lasci in giro la sua sorgente finta: se restasse attaccata, il primo
     capitolo partirebbe da un file che non è il suo. */
  const sblocco = await page.evaluate(async () => {
    document.body.click();
    await new Promise(r => setTimeout(r, 700));
    const s = document.getElementById('suono');
    return { src: s.getAttribute('src'), fermo: s.paused };
  });
  ok('il primo tocco sblocca l\u2019audio e non lascia in giro il silenzio',
     !sblocco.src && sblocco.fermo === true, sblocco.src || 'nessuna sorgente');

  await page.evaluate(() => window.LIBRI.imposta({ chiave: 'sk-finta', voce: 'v-mia', voceNome: 'La mia voce' }));

  // ── il testo si estrae con i suoi a capo ──────────────────────────────────
  const testo = await page.evaluate(() => {
    const d = new DOMParser().parseFromString(
      '<html><body><h1>Titolo</h1><p>uno</p><p>due</p>' +
      '<p>tre<br/>quattro</p><script>var x=1;<\/script><style>p{}</style></body></html>', 'text/html');
    return window.LIBRI.testoDaDocumento(d.documentElement);
  });
  ok('fra due paragrafi ci va un a capo, non niente',
     /uno\ndue/.test(testo), JSON.stringify(testo.slice(0, 40)));
  ok('e il <br> va a capo anche lui', /tre\nquattro/.test(testo));
  ok('e gli script e gli stili non finiscono nel testo letto',
     !/var x/.test(testo) && !/p\{\}/.test(testo));

  // ── spezzare ──────────────────────────────────────────────────────────────
  const spezzato = await page.evaluate(() => {
    const lungo = Array.from({ length: 60 }, (_, i) => 'Frase numero ' + i + ' che finisce qui.').join(' ');
    const pezzi = window.LIBRI.spezzaLungo(lungo, 300);
    return {
      max: Math.max(...pezzi.map(p => p.length)),
      interi: pezzi.every(p => !/\s$/.test(p) && p.length > 0),
      tutto: pezzi.join(' ').replace(/\s+/g, ' ') === lungo.replace(/\s+/g, ' ')
    };
  });
  ok('un paragrafo lungo si taglia sotto il massimo', spezzato.max <= 300, spezzato.max + ' caratteri');
  ok('e non si perde per strada nemmeno una parola', spezzato.tutto === true);

  // ── importare l'EPUB ──────────────────────────────────────────────────────
  const epub = epubFinto();
  fs.writeFileSync(path.join(cartellaFoto(), 'prova.epub'), epub);

  const scheda = await page.evaluate(async (b64) => {
    const g = atob(b64);
    const u = new Uint8Array(g.length);
    for (let i = 0; i < g.length; i++) u[i] = g.charCodeAt(i);
    const file = new File([u], 'prova.epub', { type: 'application/epub+zip' });
    const l = await window.LIBRI.importaEpub(file);
    return { id: l.id, titolo: l.titolo, autore: l.autore, capitoli: l.capitoli, caratteri: l.caratteri };
  }, epub.toString('base64'));

  ok('l’EPUB si apre e ne esce il titolo', scheda.titolo === 'Il libro di prova', scheda.titolo);
  ok('e l’autore', scheda.autore === 'Chi l’ha scritto', scheda.autore);
  ok('i capitoli sono tre: la copertina e la pagina vuota sono state buttate',
     scheda.capitoli.length === 3, scheda.capitoli.length + ' capitoli');
  ok('e portano i nomi dell’indice, non «Capitolo 1»',
     scheda.capitoli.map(c => c.titolo).join(' · ') === 'La partenza · Il mezzo · La fine',
     scheda.capitoli.map(c => c.titolo).join(' · '));
  ok('il testo del capitolo è finito in IndexedDB',
     await page.evaluate(async (id) => {
       const t = await window.LIBRI.prendi('testi', id + '|0');
       return !!t && t.testo.indexOf('Paragrafo 1 del capitolo 1') !== -1;
     }, scheda.id));

  // ── i libri che non si possono leggere lo dicono bene ─────────────────────
  const rifiutati = await page.evaluate(async (due) => {
    const apri = async (b64) => {
      const g = atob(b64);
      const u = new Uint8Array(g.length);
      for (let i = 0; i < g.length; i++) u[i] = g.charCodeAt(i);
      try {
        await window.LIBRI.importaEpub(new File([u], 'x.epub', { type: 'application/epub+zip' }));
        return 'nessun errore';
      } catch (e) { return e.message; }
    };
    return { protetto: await apri(due.protetto), muto: await apri(due.muto) };
  }, { protetto: epubSenzaTesto(true).toString('base64'),
       muto: epubSenzaTesto(false).toString('base64') });

  ok('un EPUB protetto lo dice, invece di far sospettare un difetto dell\u2019app',
     /protetto/i.test(rifiutati.protetto), rifiutati.protetto);
  ok('e un EPUB senza testo dice un\u2019altra cosa ancora',
     /non ho trovato testo/i.test(rifiutati.muto), rifiutati.muto);

  /* ── quanto dura, a occhio ───────────────────────────────────────────────
     Sembra una cosa da niente e non lo è: la stima è l'unico numero che si
     vede PRIMA di spendere, e per un po' ha detto «100 h 21 min» per un libro
     da un'ora e mezza, perché chi la usava moltiplicava per 60 dei secondi
     credendoli minuti. Qui si legge quello che c'è scritto a schermo e lo si
     riporta a secondi: una prova sulla funzione da sola non avrebbe visto
     niente, perché la funzione era giusta ed erano sbagliate le chiamate. */
  const inSecondi = (testo) => {
    const h = /(\d+)\s*h\b/.exec(testo);
    const m = /(\d+)\s*min\b/.exec(testo);
    return (h ? Number(h[1]) : 0) * 3600 + (m ? Number(m[1]) : 0) * 60;
  };
  const stima = await page.evaluate(async (id) => {
    await window.apriLibro(id);
    await new Promise(r => setTimeout(r, 400));
    const l = await window.LIBRI.prendi('libri', id);
    const primo = document.querySelector('#elencoCapitoli .cap small');
    return {
      caratteri: l.caratteri,
      attesi: window.LIBRI.secondiStimati(l.caratteri),
      capitolo: l.capitoli[0].caratteri,
      attesiCap: window.LIBRI.secondiStimati(l.capitoli[0].caratteri),
      scheda: document.getElementById('libroMisura').textContent,
      riga: primo ? primo.textContent : ''
    };
  }, scheda.id);

  ok('la stima in secondi sta nel raggio di una lettura vera',
     stima.attesi > stima.caratteri / 25 && stima.attesi < stima.caratteri / 8,
     stima.caratteri + ' caratteri in ' + Math.round(stima.attesi) + 's');
  ok('e la scheda del libro scrive quella, non sessanta volte tanto',
     vicino(inSecondi(stima.scheda), stima.attesi, 60),
     stima.scheda);
  ok('e lo stesso vale per la riga del capitolo',
     vicino(inSecondi(stima.riga), stima.attesiCap, 60),
     stima.riga);

  // ── generare l'audio di un capitolo ───────────────────────────────────────
  const gen = await page.evaluate(async (id) => {
    window.__api.chiamate = [];
    const a = await window.LIBRI.generaCapitolo(id, 0);
    return {
      chiamate: window.__api.chiamate.length,
      caratteriChiesti: window.__api.chiamate.reduce((s, c) => s + c.caratteri, 0),
      maxPezzo: Math.max(...window.__api.chiamate.map(c => c.caratteri)),
      conContesto: window.__api.chiamate.slice(1).every(c => c.prima.length > 0),
      conIds: window.__api.chiamate.slice(1).every(c => c.ids.length > 0),
      completo: a.completo,
      durata: a.durata,
      byte: a.byte,
      pezzi: a.totale,
      paragrafi: a.paragrafi.length,
      tempi: a.tempi.length,
      suono: a.suono.size,
      tipo: a.suono.type
    };
  }, scheda.id);

  ok('il capitolo si genera e resta segnato come completo', gen.completo === true);
  ok('in tanti pezzi quante sono le richieste', gen.chiamate === gen.pezzi,
     gen.chiamate + ' richieste, ' + gen.pezzi + ' pezzi');
  ok('nessun pezzo supera il massimo', gen.maxPezzo <= 1500, gen.maxPezzo + ' caratteri');
  ok('ogni pezzo dopo il primo sa cosa veniva prima',
     gen.conContesto === true && gen.conIds === true);
  ok('l’audio è un MP3 unico', gen.tipo === 'audio/mpeg' && gen.suono > 0, gen.suono + ' byte');
  ok('e i byte tornano con la durata dichiarata',
     vicino(gen.durata, gen.byte / 16000, 0.05),
     gen.durata.toFixed(2) + 's contro ' + (gen.byte / 16000).toFixed(2) + 's');
  ok('c’è un tempo per ogni paragrafo', gen.tempi === gen.paragrafi,
     gen.tempi + ' tempi, ' + gen.paragrafi + ' paragrafi');

  // ── la seconda volta non si ripaga ────────────────────────────────────────
  const dueVolte = await page.evaluate(async (id) => {
    window.__api.chiamate = [];
    await window.LIBRI.generaCapitolo(id, 0);
    return window.__api.chiamate.length;
  }, scheda.id);
  ok('richiedere lo stesso capitolo non chiama ElevenLabs', dueVolte === 0,
     dueVolte + ' richieste');

  // ── interrotto a metà, si riprende da lì ──────────────────────────────────
  /* È la prova che vale più di tutte: ogni pezzo rigenerato per niente è
     denaro. Si rompe apposta alla seconda richiesta, poi si riprende, e si
     conta: il totale deve essere «i pezzi più quello andato male», non il
     doppio. */
  const ripresa = await page.evaluate(async (id) => {
    window.__api.chiamate = [];
    window.__api.rompiA = 2;
    let messaggio = '';
    try { await window.LIBRI.generaCapitolo(id, 1); }
    catch (e) { messaggio = e.message; }
    const meta = await window.LIBRI.prendi('audio', window.LIBRI.chiaveAudio(id, 1));
    const dopoIlGuasto = window.__api.chiamate.length;

    window.__api.rompiA = -1;
    const finito = await window.LIBRI.generaCapitolo(id, 1);
    return {
      messaggio,
      fattiPrima: meta ? meta.fatti : -1,
      completoPrima: meta ? meta.completo : null,
      dopoIlGuasto,
      totale: window.__api.chiamate.length,
      pezzi: finito.totale,
      completo: finito.completo
    };
  }, scheda.id);

  ok('un errore di ElevenLabs arriva su con il suo messaggio',
     /422|rotto apposta/.test(ripresa.messaggio), ripresa.messaggio);
  ok('quello che era già pronto resta salvato', ripresa.fattiPrima === 1,
     ripresa.fattiPrima + ' pezzi tenuti');
  ok('e il capitolo non risulta completo', ripresa.completoPrima === false);
  ok('riprendendo, il capitolo si finisce', ripresa.completo === true);
  ok('e i pezzi già pagati non si ripagano',
     ripresa.totale === ripresa.pezzi + 1,
     ripresa.totale + ' richieste in tutto per ' + ripresa.pezzi + ' pezzi (una andata male)');

  // ── cambiare voce non fa ascoltare la voce di prima ───────────────────────
  const cambioVoce = await page.evaluate(async (id) => {
    const primaChiave = window.LIBRI.chiaveAudio(id, 0);
    await window.LIBRI.imposta({ voce: 'v-altra' });
    const dopoChiave = window.LIBRI.chiaveAudio(id, 0);
    const conNuova = await window.LIBRI.audioPronto(id, 0);
    await window.LIBRI.imposta({ voce: 'v-mia' });
    const tornata = await window.LIBRI.audioPronto(id, 0);
    return { diverse: primaChiave !== dopoChiave, conNuova: !!conNuova, tornata: !!tornata };
  }, scheda.id);
  ok('cambiando voce cambia la chiave dell’audio salvato', cambioVoce.diverse === true);
  ok('e col cambio non si riascolta la voce di prima', cambioVoce.conNuova === false);
  ok('e tornando indietro l’audio di prima è ancora lì, non ripagato', cambioVoce.tornata === true);

  // ── i capitoli si attaccano in un file solo ───────────────────────────────
  const flusso = await page.evaluate(async (id) => {
    await window.LIBRI.imposta({ unisci: true });
    const uno = await window.LIBRI.audioPronto(id, 0);
    const due = await window.LIBRI.audioPronto(id, 1);
    const f = await window.LIBRI.montaFlusso(id, 0);

    await window.LIBRI.imposta({ unisci: false });
    const solo = await window.LIBRI.montaFlusso(id, 0);
    await window.LIBRI.imposta({ unisci: true });

    return {
      segmenti: f.segmenti.map(s => ({ cap: s.cap, inizio: s.inizio, durata: s.durata })),
      misura: f.suono.size,
      sommaMisure: uno.suono.size + due.suono.size,
      durata: f.durata,
      somma: uno.durata + due.durata,
      soloUno: solo.segmenti.length
    };
  }, scheda.id);

  ok('i capitoli pronti si attaccano in un audio solo',
     flusso.segmenti.length === 2, flusso.segmenti.length + ' capitoli attaccati');
  ok('e il file unico è grande quanto i due messi insieme',
     flusso.misura === flusso.sommaMisure, flusso.misura + ' contro ' + flusso.sommaMisure);
  ok('il secondo capitolo comincia dove finisce il primo',
     vicino(flusso.segmenti[1].inizio, flusso.segmenti[0].durata, 0.001),
     flusso.segmenti[1].inizio.toFixed(3) + 's');
  ok('il terzo non c’è, perché il suo audio non è ancora pronto',
     flusso.segmenti.length === 2);
  ok('e chi non li vuole uniti ne trova uno solo', flusso.soloUno === 1);

  // ── il lettore ────────────────────────────────────────────────────────────
  const apertura = await page.evaluate(async (id) => {
    await window.LIBRI.apriCapitolo(id, 0, 0, false);
    const s = document.getElementById('suono');
    await new Promise((ok) => {
      if (isFinite(s.duration) && s.duration > 0) return ok();
      s.addEventListener('loadedmetadata', ok, { once: true });
      setTimeout(ok, 6000);
    });
    const md = navigator.mediaSession && navigator.mediaSession.metadata;
    return {
      durataVera: s.duration,
      durataAttesa: window.LIBRI.ora.durata,
      titolo: md ? md.title : null,
      album: md ? md.album : null,
      autore: md ? md.artist : null,
      miniSiVede: document.getElementById('mini').classList.contains('c-e'),
      paragrafiAVideo: document.querySelectorAll('#pagina p').length
    };
  }, scheda.id);

  ok('il browser decodifica davvero l’audio attaccato',
     isFinite(apertura.durataVera) && apertura.durataVera > 0,
     apertura.durataVera + 's');
  ok('e la durata vera combacia con quella calcolata dai byte',
     vicino(apertura.durataVera, apertura.durataAttesa, apertura.durataAttesa * 0.02),
     apertura.durataVera.toFixed(2) + 's contro ' + apertura.durataAttesa.toFixed(2) + 's');
  ok('sulla schermata di blocco compare il capitolo',
     apertura.titolo === 'La partenza', apertura.titolo || 'niente');
  ok('e sotto il titolo del libro e l’autore',
     apertura.album === 'Il libro di prova' && apertura.autore === 'Chi l’ha scritto');
  ok('la barretta in fondo si accende', apertura.miniSiVede === true);
  ok('e la pagina mostra i paragrafi del capitolo', apertura.paragrafiAVideo > 0,
     apertura.paragrafiAVideo + ' paragrafi');

  // ── toccare un paragrafo ci salta sopra ───────────────────────────────────
  const salto = await page.evaluate(async () => {
    const s = document.getElementById('suono');
    const p = document.querySelectorAll('#pagina p');
    const quale = Math.min(3, p.length - 1);
    const atteso = window.LIBRI.ora.segmenti[0].tempi.find(t => t.p === quale);
    p[quale].click();
    await new Promise(r => setTimeout(r, 120));
    return { dove: s.currentTime, atteso: atteso ? atteso.inizio : -1, quale };
  });
  ok('toccando un paragrafo la voce riparte da lì',
     salto.atteso > 0 && vicino(salto.dove, salto.atteso, 0.3),
     'sono a ' + salto.dove.toFixed(2) + 's, il paragrafo comincia a ' + salto.atteso.toFixed(2) + 's');

  // ── suona davvero, e si ricorda dove sono arrivato ────────────────────────
  const ascolto = await page.evaluate(async (id) => {
    const s = document.getElementById('suono');
    s.currentTime = 0;
    await s.play().catch(() => {});
    await new Promise(r => setTimeout(r, 1600));
    const avanzato = s.currentTime;
    s.pause();
    await new Promise(r => setTimeout(r, 250));
    const st = await window.LIBRI.prendi('stato', id);
    return { avanzato, segnalibro: st, illuminato: !!document.querySelector('#pagina p.ora') };
  }, scheda.id);

  ok('l’audio suona e il tempo avanza', ascolto.avanzato > 0.4,
     'arrivato a ' + ascolto.avanzato.toFixed(2) + 's');
  ok('e il paragrafo che sta leggendo si illumina', ascolto.illuminato === true);
  ok('il punto in cui sono arrivato viene salvato',
     !!ascolto.segnalibro && ascolto.segnalibro.capitolo === 0,
     ascolto.segnalibro ? 'capitolo ' + ascolto.segnalibro.capitolo + ', ' +
       ascolto.segnalibro.secondi.toFixed(1) + 's' : 'niente');

  // ── passare al capitolo dopo, dentro lo stesso file ───────────────────────
  const avanti = await page.evaluate(async () => {
    window.__api.chiamate = [];
    const s = document.getElementById('suono');
    const prima = s.currentSrc;
    await window.cambiaCapitolo(1);
    await new Promise(r => setTimeout(r, 300));
    return {
      stessoFile: s.currentSrc === prima,
      dove: s.currentTime,
      inizioDue: window.LIBRI.ora.segmenti[1].inizio,
      chiamate: window.__api.chiamate.length,
      capitolo: window.LIBRI.ora.segmenti[window.LIBRI.ora.indice].cap
    };
  });

  ok('passare al capitolo dopo non ricarica niente, se è già attaccato',
     avanti.stessoFile === true && avanti.chiamate === 0,
     avanti.chiamate + ' richieste');
  ok('e ci si ritrova al secondo in cui quel capitolo comincia',
     vicino(avanti.dove, avanti.inizioDue, 0.5),
     avanti.dove.toFixed(2) + 's contro ' + avanti.inizioDue.toFixed(2) + 's');
  ok('e il lettore sa di essere sul secondo capitolo', avanti.capitolo === 1,
     'capitolo ' + avanti.capitolo);

  // ── le voci e il credito ──────────────────────────────────────────────────
  const voci = await page.evaluate(async () => {
    await window.caricaVoci();
    const sel = document.getElementById('inVoce');
    await window.leggiCredito();
    return {
      quante: sel.options.length,
      primaVera: sel.options[1] ? sel.options[1].textContent : '',
      credito: document.getElementById('credito').textContent
    };
  });
  ok('le voci si caricano', voci.quante === 3, voci.quante + ' voci in elenco');
  ok('e la propria viene per prima', /la tua/.test(voci.primaVera), voci.primaVera);
  ok('il credito che resta si legge', /99\.000|99000/.test(voci.credito), voci.credito);

  /* Un'immagine del lettore mentre suona, per chi vuole vedere com'era. Non è
     un controllo — nessuna prova ci fa sopra un'asserzione — e per questo sta
     in un try/catch: una fotografia di contorno non può bocciare una prova. */
  try {
    await page.evaluate(() => { window.apriLettore(); });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(cartellaFoto(), 'libri-lettore.png') });
    await page.evaluate(() => { window.chiudiLettore(); });
  } catch (e) {}

  // ── preparare tutto il libro in un colpo ──────────────────────────────────
  /* È il modo per cui l'app è fatta: con tutti i capitoli pronti se ne
     attaccano sei alla volta e a schermo bloccato non c'è più un cambio di
     file per ore. Quello che si controlla è che non ripassi su quelli già
     pronti — ripassarci costa, e costa esattamente quanto la prima volta. */
  page.on('dialog', (d) => d.accept());
  const tutto = await page.evaluate(async (id) => {
    /* Si toglie apposta l'audio dell'ultimo capitolo: senza, la preparazione
       in avanti l'ha già fatto durante le prove del lettore, «prepara tutto»
       non trova niente da fare e la prova passa senza aver provato niente. */
    await window.LIBRI.togli('audio', window.LIBRI.chiaveAudio(id, 2));
    await window.apriLibro(id);
    window.__api.chiamate = [];
    await window.preparaTutto();
    const pronti = [];
    for (let i = 0; i < 3; i++) pronti.push(!!(await window.LIBRI.audioPronto(id, i)));
    const dopo = await window.LIBRI.prendi('audio', window.LIBRI.chiaveAudio(id, 2));
    return { pronti, chiamate: window.__api.chiamate.length, pezziDelTerzo: dopo.totale };
  }, scheda.id);

  ok('«prepara tutto il libro» prepara quello che manca',
     tutto.pronti.every(Boolean), JSON.stringify(tutto.pronti));
  ok('e non ripassa sui capitoli gi\u00e0 pronti',
     tutto.chiamate === tutto.pezziDelTerzo,
     tutto.chiamate + ' richieste, e al terzo capitolo ne servivano ' + tutto.pezziDelTerzo);

  // ── quanti capitoli si preparano avanti ───────────────────────────────────
  /* Uno solo non basterebbe, ed è il punto più facile da sbagliare: i
     capitoli si attaccano solo se sono pronti QUANDO si comincia, quindi
     preparandone uno solo a ogni fine capitolo ce n'è esattamente uno da
     attaccare — cioè nessuno — e si torna a un cambio di file per capitolo. */
  const avantiDue = await page.evaluate(async (id) => {
    for (const c of await window.LIBRI.chiaviCon('audio', id + '|')) {
      await window.LIBRI.togli('audio', c);
    }
    await window.LIBRI.imposta({ avanti: true });
    await window.LIBRI.apriCapitolo(id, 0, 0, false);
    for (let k = 0; k < 100; k++) {
      if (await window.LIBRI.audioPronto(id, 2)) break;
      await new Promise(r => setTimeout(r, 100));
    }
    const pronti = [];
    for (let i = 0; i < 3; i++) pronti.push(!!(await window.LIBRI.audioPronto(id, i)));
    return { pronti, quanti: window.LIBRI.AVANTI_QUANTI };
  }, scheda.id);

  ok('mentre si ascolta si preparano due capitoli avanti, non uno',
     avantiDue.quanti >= 2 && avantiDue.pronti.every(Boolean),
     avantiDue.quanti + ' avanti, pronti: ' + JSON.stringify(avantiDue.pronti));

  // ── quello che esce dal telefono è dichiarato ─────────────────────────────
  const html = fs.readFileSync(path.join(RADICE, 'libri', 'index.html'), 'utf8');
  const fuori = new Set();
  [...html.matchAll(/(?:fetch\(|src\s*=\s*|=\s*)['"`](https:\/\/[a-z0-9.-]+)/gi)].forEach(m => fuori.add(m[1]));
  [...html.matchAll(/'(https:\/\/[a-z0-9.-]+)/gi)].forEach(m => fuori.add(m[1]));
  const ammessi = ['https://api.elevenlabs.io', 'https://cdn.jsdelivr.net'];
  const strani = [...fuori].filter(h => !ammessi.some(a => h.startsWith(a)));
  ok('l’app parla solo con ElevenLabs e con la CDN delle librerie',
     strani.length === 0, strani.join(', ') || 'nessun altro');
  ok('e le impostazioni lo dicono a chi la usa',
     /ElevenLabs/.test(html) && /Cosa esce da questo telefono/.test(html));

  // ── togliere un libro si porta via tutto ──────────────────────────────────
  const pulizia = await page.evaluate(async (id) => {
    await window.LIBRI.togli('libri', id);
    const chiavi = await window.LIBRI.chiaviCon('audio', id + '|');
    for (const c of chiavi) await window.LIBRI.togli('audio', c);
    const testi = await window.LIBRI.chiaviCon('testi', id + '|');
    for (const c of testi) await window.LIBRI.togli('testi', c);
    return {
      audio: (await window.LIBRI.chiaviCon('audio', id + '|')).length,
      testi: (await window.LIBRI.chiaviCon('testi', id + '|')).length,
      pezzi: (await window.LIBRI.chiaviCon('pezzi', id + '|')).length
    };
  }, scheda.id);
  ok('tolto il libro non restano avanzi',
     pulizia.audio === 0 && pulizia.testi === 0 && pulizia.pezzi === 0,
     JSON.stringify(pulizia));

  // ── il service worker non si mangia le chiamate a pagamento ───────────────
  const sw = fs.readFileSync(path.join(RADICE, 'libri', 'sw.js'), 'utf8');
  ok('il service worker sta dentro libri/, non alla radice',
     fs.existsSync(path.join(RADICE, 'libri', 'sw.js')));
  ok('e lascia stare le chiamate a ElevenLabs', /elevenlabs/.test(sw) && /return;/.test(sw));

  console.log('\n' + r.join('\n'));
  const falliti = r.filter(x => x.includes('FALLITO')).length;
  console.log(`\n${r.length - falliti}/${r.length} passati`);
  if (errori.length) console.log('\nErrori in pagina:\n' + errori.join('\n'));

  await browser.close();
  server.close();
  process.exit(falliti ? 1 : 0);
})().catch(e => {
  console.log('\n' + r.join('\n'));
  console.log('\nLa prova non è arrivata in fondo: ' + (e && e.stack || e));
  console.log(`\n${r.filter(x => !x.includes('FALLITO')).length}/${r.length + 1} passati`);
  process.exit(1);
});
