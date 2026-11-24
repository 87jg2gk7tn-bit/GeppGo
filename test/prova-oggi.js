/* OGGI COME LE ANTEPRIME (anteprime/oggi-a nel tema chiaro, oggi-b nel
   tema scuro, ridisegno di novembre 2026).

   Quello che il ridisegno promette, misurato:
   1. a 390×844 nei due temi gli stessi elementi delle anteprime, nello
      stesso ordine e con le stesse proporzioni (il cielo con la citta', il
      giorno e il meteo; la mappa; le schede-foto; il biglietto);
   2. le schede-foto storte e sovrapposte, legate ai segnaposto (si scorre la
      fila e si accende il segnaposto, si tocca il segnaposto e la fila ci
      va), e senza foto il colore e l'icona del tipo, mai un'immagine rotta;
      con «Riduci movimento» niente si muove;
   3. gli adesivi a mano solo con un motivo vero e mai piu' di tre, interi
      nelle cinque lingue, con lettere che il carattere a mano ha;
   4. con un dito sopra la mappa si scorre la pagina, con due si muove la
      mappa;
   5. gli stati: nessun viaggio, viaggio senza giorni, giorno senza tappe,
      viaggio futuro, viaggio concluso;
   6. da 320 a 430 px nessuno scorrimento di lato e i tasti da 44; da 600 px
      di spazio le due colonne, la mappa a destra fino al bordo;
   7. nessuna violazione grave di axe, nei due temi;
   8. la mappa non rinasce ridisegnando la Home;
   9. MapLibre e i caratteri a mano arrivano solo a schermata d'apertura
      sparita (la prima schermata non aspetta niente di nuovo);
   10. le entrate (schede, biglietto, segnaposto, percorso) una volta sola,
       quando il giorno compare, mai sotto un foglio, e finite non restano
       in vigore.

   Sul codice di prima non parte: .og-palco non esiste. */
const fs = require('fs');
const path = require('path');
const { apriBrowser, RADICE } = require('./browser');
const { apriPagina, VIAGGIO, PORTO } = require('./schermate');

const AXE = require.resolve('axe-core/axe.min.js');
const r = [], err = [];
const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);
const pausa = ms => new Promise(x => setTimeout(x, ms));
/* Una sezione che si ferma si dice, e le altre vanno avanti: sul codice di
   prima (la controprova) la prova deve bocciare sezione per sezione, non
   cadere alla prima schermata che manca. */
/* `node test/prova-oggi.js 2 10` fa solo le sezioni 2 e 10. */
const SCELTE = process.argv.slice(2).filter(a => /^\d+$/.test(a));
const sezione = async (n, f) => {
  if (SCELTE.length && !SCELTE.includes(String(n))) return;
  try { await f(); } catch (e) { ok(`${n}. si è fermata`, false, String((e && e.message) || e).split('\n')[0].slice(0, 200)); }
};

/* Un viaggio spostato di g giorni: tutte le date, il meteo e gli alberghi. */
function sposta(v, g) {
  const s = JSON.parse(JSON.stringify(v));
  const f = d => { if (!d) return d; const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + g); return x.toISOString().slice(0, 10); };
  s.start = f(s.start); s.end = f(s.end); s.days.forEach(d => { d.date = f(d.date); });
  s.hotels.forEach(h => { h.checkIn = f(h.checkIn); h.checkOut = f(h.checkOut); });
  s.weather = Object.fromEntries(Object.entries(s.weather).map(([k, w]) => [f(k), w]));
  s.expenses.forEach(e => { e.date = f(e.date); });
  return s;
}
const pronta = p => p.waitForFunction(() => typeof window.renderAll === 'function' && !document.getElementById('bootSplash'), null, { timeout: 30000 });
const mappaPronta = p => p.waitForFunction(() => !!window.homeMapObj && homeMapObj.loaded && homeMapObj.loaded(), null, { timeout: 20000 }).catch(() => {});
const ferma = p => p.evaluate(() => document.getAnimations().forEach(a => { try { a.finish(); } catch (e) {} }));
async function oggi(browser, o = {}) {
  const errori = [];
  const p = await apriPagina(browser, Object.assign({ attesa: 1200, errori }, o));
  p.__errori = errori;
  await p.evaluate(() => go('plan'));
  await mappaPronta(p);
  await pausa(1600);
  await ferma(p);
  await pausa(200);
  return p;
}
const box = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height, r: b.right, b: b.bottom }; }, sel);

(async () => {
  const browser = await apriBrowser();

  // ── 1. come le anteprime, a 390×844 nei due temi ─────────────────────
  await sezione('1', async () => {
    /* Le anteprime e l'app si misurano nello stesso browser, coi caratteri di
       ripiego tutte e due (quelli di Google qui non arrivano): le misure che
       contano sono dove stanno le cose, non i pixel delle lettere. */
    const PREV = { occ: '.riga1 .occhiello', tutto: '#tutto', gradi: '.gradi', citta: '.citta', umore: '.umore', meta: '.meta', tappe: '#tappe', scheda: '#tappe .scheda', chiave: '#tappe .chiave', biglietto: '.biglietto' };
    const APPS = { occ: '#plan .og-occhiello', tutto: '#ogTutto', gradi: '#plan .og-gradi', citta: '#plan .og-testa .hh-city', umore: '#plan .og-testa .hh-mood', meta: '#plan .og-testa .hh-meta', tappe: '#plan .og-tappe', scheda: '#plan .og-tappe .stampa', chiave: '#plan .og-chiave', biglietto: '#ogBiglietto' };
    for (const [tema, file] of [['chiaro', 'oggi-a.html'], ['scuro', 'oggi-b.html']]) {
      const pa = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await pa.goto('file://' + path.join(RADICE, 'anteprime', file));
      await pausa(1500);
      /* I caratteri dell'anteprima arrivano da Google: misurata prima che
         arrivassero (su GitHub, con la macchina carica) il biglietto era
         alto 127 px col carattere di ripiego, 112 con Fraunces. L'app li ha
         tutti e due: si aspettano. */
      await pa.evaluate(() => document.fonts.ready.then(() => true)).catch(() => {});
      await pa.waitForFunction(() => [...document.fonts].some(f => f.family === 'Fraunces' && f.status === 'loaded'), null, { timeout: 10000 }).catch(() => {});
      await ferma(pa);
      const ant = {};
      for (const [k, s] of Object.entries(PREV)) ant[k] = await box(pa, s);
      await pa.close();
      /* il primo giorno di un viaggio di quattro, con l'albergo: sul telefono la
         fila parte dalla tappa in mano, qui la si riporta alla prima, come
         nell'anteprima */
      const p = await oggi(browser, { tema });
      await p.evaluate(() => { const s = document.querySelector('#plan .og-tappe'); s.scrollLeft = 0; });
      await pausa(400);
      const app = {};
      for (const [k, s] of Object.entries(APPS)) app[k] = await box(p, s);
      const manca = Object.keys(APPS).filter(k => !app[k] || !ant[k]);
      ok(`1. ${tema}: ci sono tutti gli elementi dell'anteprima (riga del giorno, «Tutto il viaggio», meteo, città, frase, riga sotto, schede-foto, chiave, biglietto)`, !manca.length, manca.join(', '));
      if (!manca.length) {
        const ordine = o => ['occ', 'citta', 'umore', 'meta', 'tappe', 'biglietto'].map(k => o[k].y);
        const crescente = a => a.every((v, i) => !i || v > a[i - 1]);
        ok(`1. ${tema}: nello stesso ordine dall'alto (giorno, città, frase, riga sotto, schede, biglietto)`, crescente(ordine(app)) && crescente(ordine(ant)), ordine(app).map(Math.round).join(' < '));
        const scarti = ['occ', 'citta', 'umore', 'meta', 'scheda', 'biglietto'].map(k => [k, Math.round(app[k].y - ant[k].y)]);
        ok(`1. ${tema}: alla stessa altezza dell'anteprima (entro 24 px)`, scarti.every(([, d]) => Math.abs(d) <= 24), scarti.map(x => x.join(' ')).join(', '));
        /* Il biglietto dell'app porta i dati veri, quello dell'anteprima i suoi:
           l'altezza non e' mai la stessa al pixel. E l'anteprima cambia coi
           caratteri della macchina: 112 px con quelli di Google, 121 senza qui,
           127 su GitHub. Si guarda che sia della stessa famiglia (30 px). */
        ok(`1. ${tema}: con le stesse proporzioni (schede 126 px, biglietto alto come quello, «Tutto il viaggio» e meteo a destra)`,
          Math.abs(app.scheda.w - ant.scheda.w) <= 14 && Math.abs(app.biglietto.h - ant.biglietto.h) <= 30 && app.tutto.r > 330 && app.gradi.r > 330 && Math.abs(app.chiave.w - ant.chiave.w) <= 14,
          `scheda ${Math.round(app.scheda.w)}/${Math.round(ant.scheda.w)}, biglietto ${Math.round(app.biglietto.h)}/${Math.round(ant.biglietto.h)}`);
      }
      const mappa = await p.evaluate(() => ({ larga: document.getElementById('homeMap').getBoundingClientRect().width, cielo: !!document.querySelector('#homeMap .cm-cielo'), spille: document.querySelectorAll('#homeMap .og-spilla').length,
        tratti: document.querySelectorAll('#homeMap .og-tratto .og-giorno-tratto path.oro').length, mezzi: document.querySelectorAll('#homeMap .og-mezzo').length, casa: !!document.querySelector('#homeMap .og-casa'), pitch: homeMapObj.getPitch() }));
      ok(`1. ${tema}: il cielo sfuma dentro la mappa a tutta larghezza, inclinata, coi segnaposto, il percorso d'oro, i mezzi e l'albergo`,
        mappa.larga === 390 && mappa.cielo && mappa.spille === 3 && mappa.tratti === 3 && mappa.mezzi >= 1 && mappa.casa && mappa.pitch > 30, JSON.stringify(mappa));
      if (tema === 'scuro') {
        const sopra = await p.evaluate(() => { const m = document.getElementById('homeMap').getBoundingClientRect(), b = document.getElementById('ogBiglietto').getBoundingClientRect(); return { mappa: m.bottom, biglietto: b.bottom }; });
        ok('1. scuro: come oggi-b, la mappa tiene tutto il primo schermo e il biglietto ci sta sopra', sopra.mappa >= 840 && sopra.biglietto < sopra.mappa, JSON.stringify(sopra));
      }
      err.push(...p.__errori);
      await p.close();
    }
  });

  // ── 2. le schede-foto ────────────────────────────────────────────────
  await sezione('2', async () => {
    const p = await oggi(browser, {});
    const s = await p.evaluate(() => {
      const c = [...document.querySelectorAll('#plan .og-tappe .stampa')];
      const ang = c.map(x => { const m = new DOMMatrix(getComputedStyle(x).transform); return Math.atan2(m.b, m.a) * 180 / Math.PI; });
      const sov = c.slice(1).map((x, i) => c[i].getBoundingClientRect().right - x.getBoundingClientRect().left);
      return { ang, sov, img: c.map(x => !!x.querySelector('img')), senza: c.map(x => !!x.querySelector('.lastra.senza-foto .s-tipo .ico')), tasti: c.map(x => x.querySelector('.lastra').tagName) };
    });
    ok('2. le schede-foto sono storte, di poco (fra 1 e 4 gradi), da una parte e dall\'altra', s.ang.length === 3 && s.ang.every(a => Math.abs(a) >= 1 && Math.abs(a) <= 4) && s.ang.some(a => a < 0) && s.ang.some(a => a > 0), s.ang.map(a => a.toFixed(1)).join(', '));
    ok('2. e sovrapposte', s.sov.every(d => d > 2), s.sov.map(Math.round).join(', '));
    ok('2. senza foto: il colore e l\'icona del tipo, mai un\'immagine (e ogni scheda è un tasto)', s.senza.every(Boolean) && !s.img.some(Boolean) && s.tasti.every(t => t === 'BUTTON'), JSON.stringify(s.senza));
    /* si scorre la fila (prima la si tocca, come un dito): si accende il segnaposto */
    const scorsa = await p.evaluate(async () => {
      const st = document.querySelector('#plan .og-tappe');
      st.dispatchEvent(new WheelEvent('wheel', { deltaX: 1, bubbles: true }));
      const c = st.querySelectorAll('.stampa');
      st.scrollLeft = c[0].offsetLeft - parseFloat(getComputedStyle(st).paddingLeft);
      await new Promise(x => setTimeout(x, 400));
      const a = homeCardSel, sp = [...document.querySelectorAll('#homeMap .og-spilla')].map(x => x.classList.contains('accesa'));
      return { sel: a, accese: sp, su: [...c].map(x => x.classList.contains('su')), biglietto: document.querySelector('#ogBiglietto .b-nome').textContent };
    });
    ok('2. scorrendo la fila, la scheda in mano si alza e il suo segnaposto si accende (e il biglietto dice di lei)', scorsa.sel === 0 && scorsa.accese[0] && !scorsa.accese[1] && scorsa.su[0] && scorsa.biglietto === 'Fushimi Inari', JSON.stringify(scorsa));
    /* e viceversa: il tocco su un segnaposto porta la fila alla sua scheda */
    await p.evaluate(() => document.querySelectorAll('#homeMap .og-spilla')[2].click());
    await pausa(1200);
    const toccata = await p.evaluate(() => ({ sel: homeCardSel, su: [...document.querySelectorAll('#plan .og-tappe .stampa')].map(x => x.classList.contains('su')), accesa: document.querySelectorAll('#homeMap .og-spilla')[2].classList.contains('accesa') }));
    ok('2. e toccando un segnaposto la fila va alla sua scheda, accesa insieme a lui', toccata.sel === 2 && toccata.su[2] && toccata.accesa, JSON.stringify(toccata));
    /* una foto che non arriva: il ripiego, non l'immagine rotta */
    const rotta = await p.evaluate(async () => {
      const t = T(); t.days[0].activities[1].photo = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Nishiki.jpg/400px-Nishiki.jpg';
      renderHomeHero();
      await new Promise(x => setTimeout(x, 1500));
      const c = document.querySelectorAll('#plan .og-tappe .stampa')[1];
      return { img: !!c.querySelector('img'), senza: c.querySelector('.lastra').classList.contains('senza-foto'), icona: !!c.querySelector('.s-tipo .ico') };
    });
    ok('2. una foto che non arriva lascia il colore e l\'icona del tipo, mai un\'immagine rotta', !rotta.img && rotta.senza && rotta.icona, JSON.stringify(rotta));
    /* le foto grandi alla misura giusta e solo quando servono */
    const misure = await p.evaluate(async () => {
      const t = T(); t.days[0].activities[1].photo = 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Nishiki_Market.jpg/400px-Nishiki_Market.jpg';
      const html = schedaFoto({ n: 2, ora: '12:00', nome: 'Nishiki', foto: t.days[0].activities[1].photo });
      const d = document.createElement('div'); d.innerHTML = html; const img = d.querySelector('img');
      return { srcset: img.getAttribute('srcset'), sizes: img.getAttribute('sizes'), lazy: img.getAttribute('loading') };
    });
    ok('2. le foto delle schede si scaricano alla misura della scheda (srcset di Wikimedia, sizes 126px) e solo quando ci si arriva', /250px-/.test(misure.srcset || '') && /500px-/.test(misure.srcset || '') && misure.sizes === '126px' && misure.lazy === 'lazy', JSON.stringify(misure));
    err.push(...p.__errori);
    await p.close();
    /* Riduci movimento: niente animazioni */
    const pr = await oggi(browser, { opzioni: { reducedMotion: 'reduce' } });
    const anim = await pr.evaluate(() => {
      const vive = document.getAnimations().filter(a => a.playState === 'running' && a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('#plan'));
      const eco = getComputedStyle(document.querySelector('#homeMap .og-spilla.prossima .sp-corpo'), '::after').animationName;
      return { vive: vive.length, eco, apre: document.querySelector('#plan .og-palco').classList.contains('apre') };
    });
    ok('2. con «Riduci movimento» niente si muove (schede, biglietto, segnaposto, percorso)', anim.vive === 0 && anim.eco === 'none' && !anim.apre, JSON.stringify(anim));
    err.push(...pr.__errori);
    await pr.close();
  });

  // ── 3. gli adesivi ───────────────────────────────────────────────────
  await sezione('3', async () => {
    const conta = p => p.evaluate(() => [...document.querySelectorAll('#plan .adesivo')].map(a => a.textContent.trim()));
    let p = await oggi(browser, {});
    let ad = await conta(p);
    ok('3. il primo giorno: «primo giorno!» e «da non perdere» sulla tappa essenziale, niente altro', ad.length === 2 && ad.includes('primo giorno!') && ad.includes('da non perdere'), ad.join(', '));
    const centrale = await p.evaluate(async () => { selHomeDay(1); await new Promise(x => setTimeout(x, 600)); return [...document.querySelectorAll('#plan .adesivo')].map(a => a.textContent.trim()); });
    ok('3. un giorno in mezzo, senza tappe essenziali né prenotate: nessun adesivo', centrale.length === 0, centrale.join(', '));
    const tanti = await p.evaluate(async () => {
      const t = T(), d = t.days[0];
      d.activities.forEach(a => { a.priority = 'essential'; a.booking = { needed: true, done: true }; });
      for (let k = 0; k < 3; k++) d.activities.push({ id: 900 + k, name: 'Extra ' + k, time: '1' + (6 + k) + ':00', timeEnd: '', lat: 35.0 + k / 100, lng: 135.76, type: 'outdoor', who: [1], completed: false, booking: { needed: true, done: true }, priority: 'essential', notes: '' });
      selHomeDay(0); renderHomeHero();
      await new Promise(x => setTimeout(x, 800));
      return [...document.querySelectorAll('#plan .adesivo')].map(a => a.textContent.trim());
    });
    ok('3. con sei tappe essenziali e prenotate: mai più di tre adesivi', tanti.length === 3, tanti.join(', '));
    err.push(...p.__errori);
    await p.close();
    /* le cinque lingue: il testo intero, tradotto; e lettere che Caveat Brush ha */
    const lettere = new Set();
    for (const lingua of ['en', 'es', 'fr', 'pt']) {
      p = await oggi(browser, { lingua });
      ad = await conta(p);
      const atteso = await p.evaluate(() => [tv('primo giorno!'), tv('da non perdere'), tv('prenotato'), tv('ultimo giorno!')]);
      ok(`3. in ${lingua} gli adesivi sono interi e tradotti`, ad.length === 2 && ad.every(a => atteso.includes(a) && !/primo giorno|da non perdere/.test(a)), ad.join(', '));
      atteso.join('').split('').forEach(c => lettere.add(c));
      err.push(...p.__errori);
      await p.close();
    }
    'primo giorno!da non perdereprenotatoultimo giorno!'.split('').forEach(c => lettere.add(c));
    /* Il sottoinsieme latin di Caveat Brush che l'app scarica (unicode-range
       U+0000-00FF e pochi altri) ha tutte le lettere accentate dell'Europa
       occidentale: controllato col file del carattere (fontTools, 22
       novembre 2026: nessuna lettera di U+0020-00FF manca). Qui si controlla
       che gli adesivi non escano da li'. */
    const fuori = [...lettere].filter(c => c.charCodeAt(0) < 0x20 || c.charCodeAt(0) > 0xFF);
    ok('3. le lettere degli adesivi, in tutte le lingue, sono fra quelle del carattere a mano (accentate comprese)', !fuori.length, fuori.join(' '));
  });

  // ── 4. con un dito si scorre la pagina, con due si muove la mappa ─────
  await sezione('4', async () => {
    const p = await oggi(browser, { opzioni: { hasTouch: true, isMobile: true } });
    const cdp = await p.context().newCDPSession(p);
    const prima = await p.evaluate(() => ({ y: document.querySelector('main.scroll').scrollTop, c: homeMapObj.getCenter().toArray(), z: homeMapObj.getZoom(), coop: homeMapObj.cooperativeGestures.isEnabled() }));
    /* tocchi veri, uno per volta: il gesto «sintetico» di Chromium qui non
       arriva alla pagina */
    let y = 380;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y }] });
    for (let i = 0; i < 12; i++) { y -= 25; await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195, y }] }); await pausa(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await pausa(800);
    const dopo = await p.evaluate(() => ({ y: document.querySelector('main.scroll').scrollTop, c: homeMapObj.getCenter().toArray(), z: homeMapObj.getZoom() }));
    const mossa = Math.abs(dopo.c[0] - prima.c[0]) + Math.abs(dopo.c[1] - prima.c[1]);
    ok('4. un dito che scorre sopra la mappa scorre la pagina, e la mappa resta ferma', prima.coop && dopo.y - prima.y > 80 && mossa < 1e-6, `pagina ${prima.y}→${Math.round(dopo.y)}, mappa ${mossa.toExponential(1)}`);
    await p.evaluate(() => { document.querySelector('main.scroll').scrollTop = 0; });
    await pausa(300);
    let d = 30;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195 - d, y: 400, id: 1 }, { x: 195 + d, y: 400, id: 2 }] });
    for (let i = 0; i < 12; i++) { d += 8; await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195 - d, y: 400, id: 1 }, { x: 195 + d, y: 400, id: 2 }] }); await pausa(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await pausa(900);
    const pizzico = await p.evaluate(() => ({ y: document.querySelector('main.scroll').scrollTop, z: homeMapObj.getZoom() }));
    ok('4. con due dita la mappa si muove (si ingrandisce), e la pagina no', pizzico.z - prima.z > 0.2 && pizzico.y < 20, `zoom ${prima.z.toFixed(2)}→${pizzico.z.toFixed(2)}, pagina ${pizzico.y}`);
    const testo = await p.evaluate(() => paroleMappa()['CooperativeGesturesHandler.MobileHelpText']);
    ok('4. e chi ci prova con un dito legge come si fa, nella lingua dell\'app', testo === 'Usa due dita per spostare la mappa', testo);
    err.push(...p.__errori);
    await p.close();
  });

  // ── 5. gli stati ─────────────────────────────────────────────────────
  await sezione('5', async () => {
    const stato = async (viaggi, js) => {
      const p = await apriPagina(browser, { attesa: 1200, viaggi, errori: err });
      await p.evaluate(() => go('plan'));
      if (js) await p.evaluate(js);
      await pausa(1500);
      await ferma(p);
      return p;
    };
    let p = await stato([]);
    let s = await p.evaluate(() => ({ citta: (document.querySelector('#plan .hh-city') || {}).textContent, tasti: [...document.querySelectorAll('#plan .og-partenza .btn')].map(b => b.textContent.trim()), mappa: !!document.getElementById('homeMap') }));
    ok('5. nessun viaggio: «Si parte?» e i tre tasti per cominciare, senza mappa', s.citta === 'Si parte?' && s.tasti.length === 3 && /Aggiungi viaggio/.test(s.tasti[0]) && /Ho un codice/.test(s.tasti[1]) && /Importa/.test(s.tasti[2]) && !s.mappa, JSON.stringify(s));
    await p.close();
    p = await stato([Object.assign({}, PORTO, { id: 1 })]);
    s = await p.evaluate(() => ({ citta: document.querySelector('#plan .hh-city').textContent, su: !!document.querySelector('#plan .hh-sumisura'), cerca: !!document.querySelector('#plan .hh-cerca'), mappa: !!document.getElementById('homeMap') }));
    ok('5. viaggio senza giorni: la destinazione, «Su misura» e la ricerca', s.citta === 'Porto' && s.su && s.cerca && !s.mappa, JSON.stringify(s));
    await p.close();
    p = await stato([VIAGGIO, PORTO], 'selHomeDay(2)');
    s = await p.evaluate(() => ({ bianca: (document.querySelector('#plan .stampa.bianca') || {}).textContent, mappa: !!document.getElementById('homeMap'), biglietto: (document.getElementById('ogBigliettoBox') || {}).textContent }));
    ok('5. giorno senza tappe: la mappa della città e la stampa bianca «Aggiungi la prima tappa»', /Aggiungi la prima tappa/.test(s.bianca || '') && s.mappa && !(s.biglietto || '').trim(), JSON.stringify(s));
    await p.evaluate(() => document.querySelector('#plan .stampa.bianca .lastra').click());
    await pausa(500);
    ok('5. e la stampa bianca è il tasto: apre la tappa nuova di quel giorno', await p.evaluate(() => document.getElementById('mActDetail').classList.contains('active')));
    await p.close();
    p = await stato([sposta(VIAGGIO, 10), PORTO]);
    s = await p.evaluate(() => ({ occ: document.querySelector('#plan .og-occhiello').textContent, ad: [...document.querySelectorAll('#plan .adesivo')].map(a => a.textContent), occB: (document.querySelector('#ogBiglietto .b-occhiello') || {}).textContent }));
    ok('5. viaggio futuro: il primo giorno, «primo giorno!», e il biglietto dice fra quanto', s.occ === 'GIORNO 1 DI 4' && s.ad.includes('primo giorno!') && /FRA 10 GIORNI/i.test(s.occB || ''), JSON.stringify(s));
    await p.close();
    p = await stato([sposta(VIAGGIO, -10), PORTO]);
    s = await p.evaluate(() => ({ occ: document.querySelector('#plan .og-occhiello').textContent, ad: [...document.querySelectorAll('#plan .adesivo')].map(a => a.textContent), b: (document.getElementById('ogBiglietto') || {}).textContent }));
    ok('5. viaggio concluso: l\'ultimo giorno, «ultimo giorno!», e il biglietto «Viaggio concluso» col ricordo', s.occ === 'GIORNO 4 DI 4' && s.ad.includes('ultimo giorno!') && /Viaggio concluso/.test(s.b || '') && /Il ricordo/.test(s.b || ''), JSON.stringify(s));
    await p.close();
  });

  // ── 6. le larghezze ──────────────────────────────────────────────────
  await sezione('6', async () => {
    for (const w of [320, 360, 390, 430]) {
      const p = await oggi(browser, { larghezza: w, altezza: 800 });
      const m = await p.evaluate(() => {
        const sc = document.querySelector('main.scroll'), W = innerWidth;
        const piccoli = [...document.querySelectorAll('#plan .og-palco button, #plan .og-palco a, #ogBiglietto')]/* la citazione della mappa sta in un angolo senza tasti, e la sua misura la guarda prova-installazione */
          .filter(b => b.offsetParent && !b.closest('.maplibregl-ctrl') && !b.closest('.g-angolo'))
          .map(b => { const r = b.getBoundingClientRect(); return { n: (b.className || b.tagName).toString().split(' ')[0], w: r.width, h: r.height }; })
          .filter(x => x.w < 43.5 || x.h < 43.5);
        const fuori = ['#plan .og-testa .hh-city', '#ogBiglietto', '#ogTutto', '#plan .og-gradi'].filter(s => { const e = document.querySelector(s); return e && e.getBoundingClientRect().right > W + .5; });
        return { lato: sc.scrollWidth - sc.clientWidth, piccoli, fuori };
      });
      ok(`6. a ${w} px niente scorre di lato, niente esce e i tasti sono da 44`, m.lato <= 0 && !m.fuori.length && !m.piccoli.length, JSON.stringify(m).slice(0, 300));
      err.push(...p.__errori);
      await p.close();
    }
    for (const [w, h] of [[670, 870], [1024, 768], [1280, 800]]) {
      const p = await oggi(browser, { larghezza: w, altezza: h });
      const m = await p.evaluate(() => {
        const pal = document.querySelector('#plan .og-palco'), mp = document.getElementById('homeMap').getBoundingClientRect(), fila = document.querySelector('#plan .og-tappe').getBoundingClientRect();
        const cielo = document.querySelector('#plan .og-palco > .cm-cielo'), sc = document.querySelector('main.scroll').getBoundingClientRect();
        return { largo: ogLargo(pal), mappaSx: mp.left, mappaDx: mp.right, filaDx: fila.right, alta: mp.height, cieloSx: cielo && cielo.getBoundingClientRect().left, cieloDx: cielo && cielo.getBoundingClientRect().right, paginaSx: sc.left, paginaDx: sc.right, W: innerWidth, H: innerHeight };
      });
      ok(`6. a ${w}×${h} le due colonne: le schede a sinistra, la mappa a destra fino al bordo, alta quasi quanto lo schermo, il cielo sopra tutte e due`,
        m.largo && m.mappaSx >= m.filaDx && Math.abs(m.mappaDx - m.paginaDx) < 2 && m.alta >= Math.min(700, m.H - 80) && Math.abs(m.cieloSx - m.paginaSx) < 2 && Math.abs(m.cieloDx - m.paginaDx) < 2, JSON.stringify(m));
      err.push(...p.__errori);
      await p.close();
    }
  });

  // ── 7. axe, nei due temi ─────────────────────────────────────────────
  await sezione('7', async () => {
    for (const tema of ['chiaro', 'scuro']) {
      const p = await oggi(browser, { tema });
      await p.addScriptTag({ path: AXE });
      const v = await p.evaluate(async () => {
        const res = await axe.run({ include: [document.querySelector('#plan')] }, { resultTypes: ['violations'] });
        return res.violations.filter(x => x.impact === 'serious' || x.impact === 'critical').map(x => `${x.impact} ${x.id}: ${x.nodes.slice(0, 2).map(n => n.target.join(' ')).join(', ')}`);
      });
      ok(`7. ${tema}: nessuna violazione grave o critica di axe in Oggi`, !v.length, v.join(' | ').slice(0, 400));
      err.push(...p.__errori);
      await p.close();
    }
  });

  // ── 8. la mappa non rinasce ──────────────────────────────────────────
  await sezione('8', async () => {
    const p = await oggi(browser, {});
    const m = await p.evaluate(async () => {
      const diOggi = () => [...mappeVive].filter(m => m.getContainer().id === 'homeMap').length;
      const prima = homeMapObj, tela = homeMapObj.getCanvas(), vive = diOggi();
      renderHomeHero(); renderAll(); selHomeDay(0); renderHomeHero();
      await new Promise(x => setTimeout(x, 800));
      return { stessa: homeMapObj === prima, tela: tela.isConnected && homeMapObj.getCanvas() === tela, vive: vive === 1 && diOggi() === 1, spille: document.querySelectorAll('#homeMap .og-spilla').length };
    });
    ok('8. ridisegnando la Home (anche quattro volte) la mappa resta la stessa: stessa tela, nessuna mappa nuova, i segnaposto rifatti', m.stessa && m.tela && m.vive && m.spille === 3, JSON.stringify(m));
    err.push(...p.__errori);
    await p.close();
  });

  // ── 9. la prima schermata non aspetta niente di nuovo ────────────────
  await sezione('9', async () => {
    const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await p.addInitScript(() => {
      window.__quando = {};
      const t0 = () => performance.now();
      new MutationObserver(ms => {
        for (const m of ms) {
          for (const n of m.addedNodes) {
            if (n.tagName === 'SCRIPT' && /maplibre-gl/.test(n.src || '')) window.__quando.maplibre = window.__quando.maplibre || t0();
            if (n.tagName === 'LINK' && /Caveat/.test(n.href || '')) window.__quando.caveat = window.__quando.caveat || t0();
          }
          for (const n of m.removedNodes) if (n.id === 'bootSplash') window.__quando.via = t0();
          /* la schermata d'apertura comincia ad andarsene (dopoLApertura) */
          if (m.type === 'attributes' && m.target.id === 'bootSplash' && m.target.classList.contains('hide')) window.__quando.sparisce = window.__quando.sparisce || t0();
        }
      }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    });
    await p.addInitScript(v => { if (sessionStorage.getItem('k9')) return; sessionStorage.setItem('k9', '1'); localStorage.clear(); localStorage.setItem('geppgo2', JSON.stringify({ trips: v, currentTripId: 1, settings: {}, myName: 'Zelda', skipAuth: true })); localStorage.setItem('geppgo2_intro', '1'); localStorage.setItem('geppgo2_avviso_home', String(Date.now())); }, [VIAGGIO]);
    const { APP } = require('./browser');
    await p.goto(APP, { waitUntil: 'domcontentloaded' });
    await pronta(p);
    await pausa(2500);
    const q = await p.evaluate(() => window.__quando);
    ok('9. MapLibre e il carattere a mano si chiedono solo quando la schermata d\'apertura se ne va (la prima schermata è già disegnata)', q.sparisce && q.maplibre && q.caveat && q.maplibre >= q.sparisce && q.caveat >= q.sparisce, JSON.stringify(q));
    const html = fs.readFileSync(path.join(RADICE, 'Index 2.1.html'), 'utf8');
    const testa = html.slice(0, html.indexOf('</head>')).replace(/<!--[\s\S]*?-->/g, '');
    ok('9. in testa all\'HTML nessun carattere nuovo che fermi la pagina: un <link> solo, che non blocca, e Caveat Brush non c\'è', (testa.match(/fonts\.googleapis\.com\/css2/g) || []).length === 1 && !/Caveat/.test(testa) && /media="print" onload=/.test(testa));
    await p.close();
  });

  // ── 10. le entrate: una volta sola, mai sotto un foglio ──────────────
  /* Un'animazione che tiene la sua fine (fill both o forwards) resta in
     vigore per sempre, e il browser tiene un livello grafico per ogni
     elemento che ce l'ha: con 20 tappe un'ottantina, ricopiati a ogni
     fotogramma di qualunque mappa. La mappa del viaggio con 200 tappe aperta
     sopra Oggi zoomava un terzo più lenta (prova-budget-mappa 8). */
  await sezione('10', async () => {
    const p = await oggi(browser, {});
    const vive = () => p.evaluate(() => {
      const pg = document.getElementById('plan');
      const dentro = a => { const t = a.effect && a.effect.target; return !!t && pg.contains(t); };
      const css = document.getAnimations().filter(a => typeof CSSAnimation !== 'undefined' && a instanceof CSSAnimation && dentro(a));
      return {
        tenute: css.filter(a => a.playState === 'finished').map(a => a.animationName),
        entrate: css.filter(a => a.playState === 'running' && /^(st-arriva|b-scrivi|og-spunta|og-traccia)$/.test(a.animationName)).map(a => a.animationName),
        apre: !!document.querySelector('#plan .og-palco.apre')
      };
    });
    const riposo = await vive();
    ok('10. finite le entrate, nessuna animazione resta in vigore sotto Oggi (ognuna teneva un livello grafico a sé)', riposo.tenute.length === 0, riposo.tenute.join(', ') || 'nessuna');
    const su = await p.evaluate(() => {
      const c = document.querySelectorAll('#plan .og-tappe .stampa')[1];
      const prima = getComputedStyle(c).transform;
      c.classList.add('su');
      const subito = getComputedStyle(c).transform;
      c.classList.remove('su');
      return { prima, subito };
    });
    ok('10. la scheda che si accende sale con la sua transizione (la tenuta dell\'entrata la faceva scattare)', su.subito === su.prima, JSON.stringify(su));
    await p.evaluate(() => renderHomeHero());
    const ridisegno = await vive();
    ok('10. ridisegnando lo stesso giorno (una spunta, il cloud, il tema) schede e biglietto non rientrano', ridisegno.entrate.length === 0, ridisegno.entrate.join(', ') || 'nessuna');
    await p.evaluate(() => selHomeDay(1));
    const altro = await vive();
    ok('10. un altro giorno sì: le sue schede entrano in scena', altro.entrate.includes('st-arriva'), altro.entrate.join(', ') || 'nessuna');
    await p.evaluate(() => openSheet('mCode'));
    const coperte = await vive();
    ok('10. un foglio che si apre sopra Oggi chiude subito le entrate di sotto', coperte.entrate.length === 0 && coperte.tenute.length === 0, JSON.stringify(coperte));
    await p.evaluate(() => selHomeDay(0));
    const sotto = await vive();
    ok('10. sotto un foglio aperto il giorno cambia senza entrate (schede, segnaposto, percorso)', sotto.entrate.length === 0 && !sotto.apre, JSON.stringify(sotto));
    await p.evaluate(() => closeSheet('mCode'));
    err.push(...p.__errori);
    await p.close();
  });

  await browser.close();
  ok('nessun errore in pagina', !err.length, err.slice(0, 3).join(' | '));
  console.log('\n' + r.join('\n'));
  const falliti = r.filter(x => x.includes('FALLITO')).length;
  console.log(`\n${r.length - falliti}/${r.length} passati`);
  process.exit(falliti ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
