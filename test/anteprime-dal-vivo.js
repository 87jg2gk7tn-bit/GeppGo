/* LE ANTEPRIME DI STILE, GUARDATE SULLA RETE VERA. Non è una prova: npm test
 * non la lancia. Si lancia a mano, quando si tocca un'anteprima.
 *
 * COSA SONO. anteprime/oggi-a.html, oggi-b.html e luogo.html: tre pagine a
 * sé, fuori dall'app, per scegliere dove portare lo stile (novembre 2026).
 * La mappa è fatta di immagini satellitari di Esri disegnate da MapLibre, e
 * i caratteri sono di Google: senza rete non c'è niente da guardare. Per
 * questo qui si esce dal recinto di browser.js, apposta: le pagine hanno
 * solo dati di esempio e non parlano con nessun servizio di GeppGo.
 *
 * COSA DICE.
 *  · controlli: a 320, 360, 390 e 430 px niente scorre di lato, i tasti sono
 *    da 44, non ci sono errori, la mappa c'è coi diritti di Esri e le foto
 *    arrivano; a 390 px anche i contrasti, i collegamenti alle altre due,
 *    nessuna scritta sotto i 12 px, e i tasti che nell'anteprima non portano
 *    da nessuna parte lo dicono senza spostare la pagina.
 *  · pezzi: quanti pezzi di mappa (le richieste a Esri) costa aprire ogni
 *    pagina, su cinque schermi, e quanti ne costano i gesti. È il numero
 *    che dice quante aperture copre la soglia gratuita di chi fornisce la
 *    mappa: va rimisurato ogni volta che cambiano l'inquadratura,
 *    l'inclinazione o `tileSize`.
 *
 *   node test/anteprime-dal-vivo.js              controlli e pezzi
 *   node test/anteprime-dal-vivo.js controlli    solo i controlli
 *   node test/anteprime-dal-vivo.js pezzi        solo i pezzi di mappa
 *   node test/anteprime-dal-vivo.js controlli luogo.html   una pagina sola
 *   ANTEPRIME_URL=https://…/GeppGo/anteprime/ node test/anteprime-dal-vivo.js
 *                                                 sulla copia online
 */
const path = require('path');
const { pathToFileURL } = require('url');
const { apriBrowser, RADICE } = require('./browser');

const DOVE = (process.env.ANTEPRIME_URL || pathToFileURL(path.join(RADICE, 'anteprime')).href).replace(/\/*$/, '/');
const PAGINE = ['oggi-a.html', 'oggi-b.html', 'luogo.html'];
const cosa = process.argv[2] || '';
const scelte = process.argv.slice(3);
if ((cosa && cosa !== 'controlli' && cosa !== 'pezzi') || scelte.some(x => !PAGINE.includes(x))) {
  console.error('Si lancia senza niente, oppure con «controlli» o «pezzi», e dopo i nomi delle pagine da guardare (' + PAGINE.join(', ') + ').'); process.exit(2);
}
const DA_GUARDARE = scelte.length ? PAGINE.filter(x => scelte.includes(x)) : PAGINE;

/* MapLibre disegna con WebGL, e un Chromium senza schermo e senza scheda
   grafica lo rifiuta: gli si dice di disegnare col processore. Se la
   macchina esce in rete da un proxy, il browser passa da lì come tutto il
   resto. */
async function apri() {
  return apriBrowser(Object.assign(
    { args: ['--no-sandbox', '--allow-file-access-from-files', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] },
    process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY } } : {}));
}
/* Fuori dal recinto: l'ultima rotta registrata vince su quella di
   browser.js, che fermerebbe i pezzi di mappa. */
async function pagina(browser, opz) {
  const p = await browser.newPage(Object.assign({ hasTouch: true, isMobile: true }, opz));
  await p.route('**/*', r => r.continue());
  return p;
}
/* La mappa è ferma quando ha finito di caricare e nessuno la sta muovendo.
   Le pagine la lasciano in window.__mappa proprio per chi le guarda da qui. */
const fermo = p => p.evaluate(() => new Promise(ok => {
  const m = window.__mappa; if (!m) return ok('la mappa non c\'è');
  const t = setTimeout(() => ok('dopo 25 secondi caricava ancora'), 25000);
  const f = () => { if (m.loaded() && m.areTilesLoaded() && !m.isMoving()) { clearTimeout(t); ok(''); } else m.once('idle', f); };
  f();
}));
const DI_ESRI = /arcgisonline\.com|arcgis\.com/;

/* ── I CONTROLLI ───────────────────────────────────────────────────────── */

/* Le scritte da misurare, pagina per pagina. Le anteprime mettono quasi
   tutto sopra una foto, il cielo o la mappa: il colore del fondo non sta nel
   foglio di stile, e axe lì dice «non lo so». */
const SCRITTE = {
  'oggi-a.html': ['.occhiello', '.citta', '.umore', '.meta', '.gente i', '.gradi b', '.gradi span', '.tutto span', '.viaggio', '.io', '.ultimo', '.diritti', '.s-ora', '.s-nome', '.s-n', '.adesivo span', '.c-occhiello', '.c-nome', '.c-nota', '.b-occhiello', '.b-nome', '.b-nota', '.b-ora', '.b-vai', '.f-occhiello', '.altre b', '.altre em', '.nota', '.crediti p', '.crediti li', '.crediti h2', '.voce', '.mezzo', '.spilla b'],
  'luogo.html': ['.vetro', '.c-credito', '.occhiello', '.nome span', '.nome em', '.frase', '.fatti', '.aggiungi', '.assistente', '.assistente small', '.mano', '.distanza b', '.distanza span', '.distanza strong', '.diritti', '.f-occhiello', '.altre b', '.altre em', '.nota', '.crediti p', '.mezzo']
};
SCRITTE['oggi-b.html'] = SCRITTE['oggi-a.html'];

/* IL CONTRASTO DI UNA SCRITTA, SUI PIXEL. Due foto dello schermo, con le
   lettere e senza: i punti che cambiano sono le lettere. Il colore della
   scritta è quello del foglio di stile (steso sul fondo, se è trasparente),
   il fondo è il pixel vero che c'è dietro; conta il punto peggiore, tolto il
   5% più basso, che sono i bordi sfumati delle lettere.
   Si fotografa sempre lo schermo intero: con l'emulazione del telefono una
   foto ritagliata fa cambiare finestra a Playwright, e la pagina si sposta. */
async function contrasto(p, el, schermo) {
  const info = await el.evaluate(e => {
    const cs = getComputedStyle(e), r = e.getBoundingClientRect(), c = cs.color.match(/[\d.]+/g).map(Number);
    return { colore: [c[0], c[1], c[2], c.length > 3 ? c[3] : 1], px: parseFloat(cs.fontSize), peso: +cs.fontWeight, testo: (e.textContent || '').trim().slice(0, 24), r: { x: r.x, y: r.y, w: r.width, h: r.height } };
  });
  const x = Math.max(0, info.r.x), y = Math.max(0, info.r.y);
  const riquadro = { x, y, width: Math.min(info.r.w, schermo.w - x), height: Math.min(info.r.h, schermo.h - y) };
  if (riquadro.width < 2 || riquadro.height < 2) return null;
  /* I figli scritti in un altro colore si nascondono: hanno la loro riga
     nell'elenco. Le icone tengono il colore che avevano. */
  await el.evaluate(e => {
    const mio = getComputedStyle(e).color;
    [...e.querySelectorAll('*')].forEach(f => {
      f.dataset.st = f.getAttribute('style') || '';
      if (f.closest('svg')) { if (f.tagName.toLowerCase() === 'svg') f.style.setProperty('color', getComputedStyle(f).color, 'important'); return; }
      if (getComputedStyle(f).color !== mio) f.style.setProperty('visibility', 'hidden', 'important');
    });
    e.dataset.st = e.getAttribute('style') || '';
  });
  const con = await p.screenshot();
  await el.evaluate(e => [e, ...e.querySelectorAll('*')].forEach(f => {
    if (f.closest('svg')) return;
    for (const [k, v] of [['color', 'transparent'], ['-webkit-text-fill-color', 'transparent'], ['text-shadow', 'none'], ['text-decoration-color', 'transparent']]) f.style.setProperty(k, v, 'important');
  }));
  const senza = await p.screenshot();
  await el.evaluate(e => [e, ...e.querySelectorAll('*')].forEach(f => { f.setAttribute('style', f.dataset.st || ''); delete f.dataset.st; }));
  const esito = await p.evaluate(async ([a64, b64, col, q]) => {
    const leggi = async s => {
      const img = new Image(); img.src = 'data:image/png;base64,' + s; await img.decode();
      const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(q.width)); c.height = Math.max(1, Math.round(q.height));
      const g = c.getContext('2d'); g.drawImage(img, -Math.round(q.x), -Math.round(q.y));
      return g.getImageData(0, 0, c.width, c.height).data;
    };
    const A = await leggi(a64), B = await leggi(b64);
    const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
    const L = (r, g, b) => .2126 * f(r) + .7152 * f(g) + .0722 * f(b);
    const rr = [];
    for (let i = 0; i < A.length; i += 4) {
      if (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]) <= 30) continue;
      const a = col[3], lt = L(col[0] * a + B[i] * (1 - a), col[1] * a + B[i + 1] * (1 - a), col[2] * a + B[i + 2] * (1 - a)), lb = L(B[i], B[i + 1], B[i + 2]);
      rr.push((Math.max(lt, lb) + .05) / (Math.min(lt, lb) + .05));
    }
    if (rr.length < 12) return null;
    rr.sort((x, y) => x - y);
    return { peggio: rr[Math.floor(rr.length * .05)], medio: rr[Math.floor(rr.length / 2)] };
  }, [con.toString('base64'), senza.toString('base64'), info.colore, riquadro]);
  if (!esito) return null;
  /* Testo grande, per le WCAG: da 24 px, o da 18,66 px in grassetto. */
  const soglia = info.px >= 24 || (info.px >= 18.66 && info.peso >= 700) ? 3 : 4.5;
  return { testo: info.testo, px: info.px, soglia, peggio: +esito.peggio.toFixed(2), medio: +esito.medio.toFixed(2) };
}

async function controlli() {
  const browser = await apri();
  let fatti = 0, male = 0;
  const ok = (bene, che, nota) => { fatti++; if (!bene) male++; console.log((bene ? '  OK      ' : '  FALLITO ') + che + (nota ? ' — ' + nota : '')); };
  for (const pag of DA_GUARDARE) {
    console.log('\n' + pag);
    for (const w of [320, 360, 390, 430]) {
      const schermo = { w, h: 844 };
      /* «Riduci movimento»: le cose che entrano una dopo l'altra sono già
         al loro posto, e si misura la pagina ferma. */
      const p = await pagina(browser, { viewport: { width: w, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
      const guai = []; let pezzi = 0;
      p.on('pageerror', e => guai.push(e.message.split('\n')[0]));
      p.on('console', m => { if (m.type() === 'error') guai.push(m.text().slice(0, 160)); });
      p.on('requestfailed', r => guai.push('non arriva: ' + r.url().slice(0, 90)));
      p.on('request', r => { if (DI_ESRI.test(r.url())) pezzi++; });
      await p.goto(DOVE + pag, { waitUntil: 'load' });
      const mappa = await fermo(p);
      await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(500);

      const m = await p.evaluate(() => {
        const de = document.documentElement;
        const tasti = [...document.querySelectorAll('a[href],button')].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.height && getComputedStyle(e).visibility !== 'hidden'; });
        /* I collegamenti dentro una riga di testo (i crediti) non sono tasti:
           le WCAG li lasciano alti quanto la riga. */
        const piccoli = tasti.filter(e => !e.closest('.crediti,.diritti,.c-credito')).map(e => [e, e.getBoundingClientRect()]).filter(([, r]) => r.width < 43.5 || r.height < 43.5)
          .map(([e, r]) => (e.className || e.tagName) + ' ' + Math.round(r.width) + '×' + Math.round(r.height));
        const diritti = [...document.querySelectorAll('.diritti')].filter(e => e.getBoundingClientRect().height && getComputedStyle(e).visibility !== 'hidden').map(e => e.textContent.trim());
        return { sw: de.scrollWidth, cw: de.clientWidth, bw: document.body.scrollWidth, piccoli, tasti: tasti.length, diritti };
      });
      ok(m.sw <= m.cw && m.bw <= m.cw + 1, `${w} px: niente scorre di lato`, `pagina ${m.sw}/${m.cw}, corpo ${m.bw}`);
      ok(!m.piccoli.length, `${w} px: i ${m.tasti} tasti sono da 44`, m.piccoli.slice(0, 6).join(' | '));
      ok(!mappa && pezzi > 0 && m.diritti.some(d => /Esri/.test(d)), `${w} px: la mappa c'è (${pezzi} pezzi) e porta i diritti di Esri`, mappa || (pezzi ? 'diritti: ' + (m.diritti.join(' | ') || 'non si vedono') : 'nessun pezzo chiesto'));

      if (w === 390) {
        const esiti = [];
        for (const sel of SCRITTE[pag]) {
          const quanti = await p.locator(sel).count();
          for (let i = 0; i < Math.min(quanti, 6); i++) {
            const el = p.locator(sel).nth(i);
            if (!(await el.isVisible())) continue;
            /* Quello che sta nel palco o nella barra si guarda dalla cima
               della pagina, dov'è quando la si apre. */
            await el.evaluate(e => { if (e.closest('.barra,.palco')) window.scrollTo(0, 0); else e.scrollIntoView({ block: 'center' }); });
            await p.waitForTimeout(140);
            const c = await contrasto(p, el, schermo);
            if (c) esiti.push(Object.assign({ sel }, c));
          }
        }
        /* I tasti finti. Un collegamento vuoto (href="#") riporta la pagina
           in cima e sporca l'indirizzo: sul telefono sembra un guasto. Si
           toccano a pagina scesa, e si guarda che resti dov'è. */
        await p.evaluate(() => window.scrollTo(0, 240)); await p.waitForTimeout(150);
        if (pag === 'luogo.html') {
          const dopo = async () => p.evaluate(() => { const t = document.getElementById('aggiungi'); return t ? { premuto: t.getAttribute('aria-pressed'), testo: t.textContent.trim(), y: Math.round(scrollY), ancora: location.hash } : null; });
          await p.locator('#aggiungi').click({ timeout: 3000 }).catch(() => {});
          const uno = await dopo();
          await p.locator('#aggiungi').click({ timeout: 3000 }).catch(() => {});
          const due = await dopo();
          ok(!!uno && uno.premuto === 'true' && uno.testo === 'Nel programma di oggi' && uno.y === 240 && !uno.ancora && due.premuto === 'false' && due.testo === 'Aggiungi al programma',
            '390 px: «Aggiungi al programma» fa vedere il posto aggiunto, un altro tocco lo toglie, e la pagina resta dov\'è', JSON.stringify([uno, due]));
        } else {
          const finti = await p.locator('[data-finto]').count();
          await p.locator('.barra [data-finto]').first().click({ timeout: 3000 }).catch(() => {});
          await p.waitForTimeout(200);
          const dice = await p.evaluate(() => { const m = document.querySelector('.messaggio.su'); return { testo: m ? m.textContent.trim() : '', y: Math.round(scrollY), ancora: location.hash }; });
          ok(finti >= 6 && /anteprima/.test(dice.testo) && dice.y === 240 && !dice.ancora, `390 px: le ${finti} voci che qui non si aprono lo dicono, e la pagina resta dov'è`, JSON.stringify(dice));
          if (dice.testo) { const c = await contrasto(p, p.locator('.messaggio'), schermo); if (c) esiti.push(Object.assign({ sel: '.messaggio' }, c)); }
          await p.locator('#quiOggi').click({ timeout: 3000 }).catch(() => {});
          await p.waitForTimeout(250);
          const su = await p.evaluate(() => ({ y: Math.round(scrollY), ancora: location.hash, messaggio: !!document.querySelector('.messaggio.su') }));
          ok(su.y === 0 && !su.ancora && !su.messaggio, '390 px: «Oggi», che è la schermata aperta, riporta in cima', JSON.stringify(su));
        }
        const sotto = esiti.filter(e => e.peggio < e.soglia);
        ok(esiti.length > 15 && !sotto.length, `390 px: contrasti a norma su ${esiti.length} scritte, nel punto peggiore del fondo vero`,
          sotto.map(e => `${e.sel} «${e.testo}» ${e.px} px: ${e.peggio} (a metà ${e.medio}), ne servono ${e.soglia}`).join(' | '));
        console.log('          i più vicini alla soglia: ' + esiti.slice().sort((a, b) => a.peggio / a.soglia - b.peggio / b.soglia).slice(0, 4).map(e => `${e.sel} ${e.peggio}`).join(', '));
        const altre = await p.evaluate(() => [...document.querySelectorAll('.altre a')].map(a => a.getAttribute('href')));
        ok(PAGINE.filter(x => x !== pag).every(a => altre.includes(a)), '390 px: in fondo ci sono i collegamenti alle altre due', altre.join(', '));
        const sotto12 = await p.evaluate(() => [...document.querySelectorAll('body *')]
          .filter(e => !e.children.length && (e.textContent || '').trim() && !e.closest('svg') && parseFloat(getComputedStyle(e).fontSize) < 12)
          .map(e => (e.className || e.tagName) + ' ' + getComputedStyle(e).fontSize).slice(0, 5));
        ok(!sotto12.length, '390 px: nessuna scritta sotto i 12 px', sotto12.join(' | '));
      }

      /* Le foto in fondo arrivano solo quando ci si avvicina (loading=lazy):
         si scende piano fino in fondo, come un dito. */
      const alta = await p.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < alta; y += 600) { await p.evaluate(v => window.scrollTo(0, v), y); await p.waitForTimeout(120); }
      await p.waitForTimeout(400);
      const foto = await p.evaluate(() => [...document.images].map(i => ({ src: i.getAttribute('src'), arrivata: i.complete && i.naturalWidth > 0 })));
      const perse = foto.filter(f => !f.arrivata).map(f => f.src);
      ok(foto.length > 0 && !perse.length, `${w} px: le ${foto.length} foto sono arrivate`, perse.join(', '));
      ok(!guai.length, `${w} px: nessun errore in pagina`, guai.slice(0, 3).join(' | '));
      await p.close();
    }
  }
  await browser.close();
  console.log(`\n${fatti - male}/${fatti} passati`);
  return !male;
}

/* ── I PEZZI DI MAPPA ──────────────────────────────────────────────────── */

/* La soglia gratuita di Esri (ArcGIS Location Platform) a novembre 2026:
   due milioni di pezzi di mappa al mese. Va ricontrollata quando si sceglie
   il fornitore: il conto in fondo serve a decidere, non a fare un preventivo. */
const SOGLIA = 2000000;
const SCHERMI = [[360, 740, 'Android piccolo'], [390, 844, 'iPhone 14, 15 e 16'], [393, 852, 'iPhone 15 e 16 Pro'], [430, 932, 'iPhone Pro Max'], [390, 664, 'iPhone in Safari, con le barre']];
const GESTI = ['tocca le schede', 'tutto il viaggio', 'torna a oggi', 'trascina la mappa', 'avvicina di un livello'];

/* Ogni misura parte da un browser nuovo, con la memoria vuota: è la prima
   apertura, il caso peggiore. Chi riapre lo stesso giorno ha già i pezzi in
   memoria (Esri li dà buoni per 24 ore) e non ne chiede nessuno. */
async function misura(pag, w, h, gesti) {
  const browser = await apri();
  const p = await pagina(browser, { viewport: { width: w, height: h }, deviceScaleFactor: 3 });
  let n = 0, byte = 0; const livelli = {};
  p.on('request', r => { const m = DI_ESRI.test(r.url()) && r.url().match(/\/tile\/(\d+)\//); if (m) { n++; livelli[m[1]] = (livelli[m[1]] || 0) + 1; } });
  p.on('response', r => { if (DI_ESRI.test(r.url())) byte += +(r.headers()['content-length'] || 0); });
  await p.goto(DOVE + pag, { waitUntil: 'load' });
  /* Due volte: la pagina si apre con la mappa che scende al suo posto, e i
     pezzi dell'arrivo si chiedono dopo. */
  let guaio = await fermo(p); await p.waitForTimeout(3600); guaio = (await fermo(p)) || guaio;
  const passi = [{ passo: 'apertura', n, byte }];
  for (const g of gesti || []) {
    const prima = n, bPrima = byte;
    if (g === 'tocca le schede') for (const k of [1, 2, 3]) { await p.evaluate(i => document.querySelectorAll('.scheda .lastra')[i].click(), k); await p.waitForTimeout(350); }
    if (g === 'tutto il viaggio' || g === 'torna a oggi') { await p.click('#tutto'); await p.waitForTimeout(900); }
    if (g === 'trascina la mappa') { const y = Math.round(h * .42); await p.mouse.move(w * .6, y); await p.mouse.down(); for (let k = 1; k <= 12; k++) await p.mouse.move(w * .6 - k * 10, y - k * 3); await p.mouse.up(); await p.waitForTimeout(900); }
    if (g === 'avvicina di un livello') { await p.evaluate(() => window.__mappa.easeTo({ zoom: window.__mappa.getZoom() + 1.2, duration: 600 })); await p.waitForTimeout(1200); }
    await fermo(p); await p.waitForTimeout(1000); await fermo(p);
    passi.push({ passo: g, n: n - prima, byte: byte - bPrima });
  }
  await browser.close();
  return { passi, livelli, guaio };
}

async function pezzi() {
  console.log('\nI pezzi di mappa di un\'apertura a freddo (le richieste a Esri)');
  const somme = {}; let tuttoBene = true;
  for (const [w, h, nome] of SCHERMI) for (const pag of DA_GUARDARE) {
    const m = await misura(pag, w, h), a = m.passi[0];
    if (m.guaio || !a.n) tuttoBene = false;
    (somme[pag] = somme[pag] || []).push(a.n);
    console.log(`  ${pag.padEnd(12)} ${(w + ' × ' + h).padEnd(10)} ${nome.padEnd(30)} ${String(a.n).padStart(3)} pezzi, ${String(Math.round(a.byte / 1024)).padStart(4)} KB, livelli ${Object.keys(m.livelli).map(z => z + ': ' + m.livelli[z]).join(', ') || 'nessuno'}${m.guaio ? '  ← ' + m.guaio : ''}`);
  }
  console.log('\nI gesti, a 390 × 844 (pezzi in più)');
  for (const pag of DA_GUARDARE.filter(x => x !== 'luogo.html')) {
    const m = await misura(pag, 390, 844, GESTI);
    console.log(`  ${pag.padEnd(12)} ` + m.passi.slice(1).map(e => `${e.passo}: ${e.n}`).join(' · '));
  }
  const media = pag => somme[pag].reduce((a, b) => a + b, 0) / somme[pag].length;
  console.log('\nIn media: ' + DA_GUARDARE.map(pag => `${pag} ${media(pag).toFixed(1)}`).join(' · '));
  /* Il conto si fa sulla schermata che si apre tutti i giorni, cioè «Oggi»:
     la scheda di un posto ne chiede un quarto. */
  const oggi = DA_GUARDARE.filter(x => x !== 'luogo.html').map(media);
  if (oggi.length) {
    const m = oggi.reduce((a, b) => a + b, 0) / oggi.length;
    console.log(`«Oggi» fa ${m.toFixed(1)} pezzi ad apertura: i ${SOGLIA.toLocaleString('it-IT')} gratuiti al mese coprono circa ${(Math.round(SOGLIA / m / 1000) * 1000).toLocaleString('it-IT')} aperture a freddo.`);
  }
  return tuttoBene;
}

(async () => {
  console.log('Le anteprime in ' + DOVE);
  let bene = true;
  if (cosa !== 'pezzi') bene = (await controlli()) && bene;
  if (cosa !== 'controlli') bene = (await pezzi()) && bene;
  process.exit(bene ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
