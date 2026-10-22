/* IL CARATTERE (Layout 1b): il sistema della Layout 1 resta, ma l'app torna
   calda. La Layout 1 l'aveva lasciata tutta bianca e inchiostro, ammassata e
   di un colore solo, e il Programma (la Time Table) si apriva in fondo.

   1. il tondo del tema (luna/sole) sta nella barra in alto e funziona; c'è
      ancora nel Profilo, e i due vanno d'accordo;
   2. il Programma non si apre mai in fondo: oggi, giorno di viaggio, sulla
      prossima tappa (o su quella in corso) con la testata del giorno a
      vista; in ogni altro caso (viaggio passato o futuro, un altro giorno,
      oggi a giornata finita) in cima, con la prima tappa a vista. E «oggi»
      è oggi anche in Italia, non a Greenwich;
   3. lo stato «scelto» è d'oro nei giorni e nei controlli a schede; la
      barra in basso resta col tondo d'inchiostro;
   4. i tasti secondari sono beige col bordo leggero; le schede del totale
      (Spese) e del Budget sono d'oro, con le scritte d'inchiostro a norma;
   5. le icone dei comandi sono a due toni, inchiostro e un tratto d'oro (e
      il tratto d'oro si vede davvero, a pixel); nessuna emoji nei comandi;
   6. il respiro: 24–32 px fra le sezioni di Home, Programma e Spese, 4–12
      fra le cose dello stesso gruppo;
   7. axe senza violazioni gravi; niente fuori dallo schermo da 320 a 430 px
      in cinque lingue e due temi; lo stile in testa piccolo come dopo la
      Layout 1.

   `node test/prova-carattere.js 2 6` fa solo le prove 2 e 6. */
const fs = require('fs');
const path = require('path');
const { apriBrowser, APP, RADICE } = require('./browser');
const { VIAGGIO, PORTO, NOMI, MISURA, iso, apriPagina, giro } = require('./schermate');
const { misura } = require('./prova-accessibilita');

const r = [];
const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);
const errori = [];
const SCELTE = process.argv.slice(2).filter(a => /^\d+$/.test(a));
const fare = n => !SCELTE.length || SCELTE.includes(String(n));
const prova = async (nome, fn) => { try { await fn(); } catch (e) { ok(nome, false, 'si è fermata: ' + e.message.split('\n')[0]); } };
const primi = (l, n = 5) => l.slice(0, n).join(' | ') + (l.length > n ? ` (e altri ${l.length - n})` : '');
const LINGUE = ['it', 'en', 'es', 'fr', 'pt'];
const FILE_APP = APP.startsWith('file://') ? decodeURIComponent(APP.slice(7)) : path.join(RADICE, 'Index 2.1.html');
const HTML = fs.readFileSync(FILE_APP, 'utf8');

/* Il viaggio di prova spostato di qualche giorno: passato o futuro. */
function spostaViaggio(v, giorni) {
  const c = JSON.parse(JSON.stringify(v));
  const sposta = s => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + giorni); return iso(d); };
  c.start = sposta(c.start); c.end = sposta(c.end);
  c.days.forEach(d => { d.date = sposta(d.date); });
  c.weather = Object.fromEntries(Object.entries(c.weather).map(([k, w]) => [sposta(k), w]));
  c.expenses.forEach(e => { e.date = sposta(e.date); });
  c.hotels.forEach(h => { h.checkIn = sposta(h.checkIn); h.checkOut = sposta(h.checkOut); });
  return c;
}
/* L'istante in cui, in un fuso, è un certo giorno a una certa ora. */
function istanteA(dataISO, hh, mm, fuso) {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const base = Date.UTC(+dataISO.slice(0, 4), +dataISO.slice(5, 7) - 1, +dataISO.slice(8, 10), hh, mm);
  for (let o = -14 * 60; o <= 14 * 60; o += 15) {
    const t = new Date(base - o * 60000), p = Object.fromEntries(fmt.formatToParts(t).map(x => [x.type, x.value]));
    if (`${p.year}-${p.month}-${p.day}` === dataISO && +p.hour === hh && +p.minute === mm) return t;
  }
  throw new Error('istante non trovato');
}
/* Un orario di oggi (o di un altro giorno) nel fuso di chi fa la prova. */
const alle = (h, m, giorni = 0) => { const b = new Date(); return new Date(b.getFullYear(), b.getMonth(), b.getDate() + giorni, h, m, 0); };

/* Colori e contrasti, calcolati nella pagina. */
const COLORI = `(() => {
  const rgb = c => { const d = document.createElement('div'); d.style.color = c; document.body.appendChild(d); const x = getComputedStyle(d).color; d.remove(); return x; };
  const tok = n => rgb(getComputedStyle(document.body).getPropertyValue(n).trim());
  const num = c => (c.match(/[\\d.]+/g) || []).map(Number);
  const lum = c => { const [r, g, b] = num(c).slice(0, 3).map(v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const contrasto = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  return { rgb, tok, contrasto, trasparente: c => /rgba\\(.*,\\s*0\\)$/.test(c) || c === 'transparent' };
})()`;
const visibile = `el => { const q = el.getBoundingClientRect(); if (q.width < 1 || q.height < 1) return false;
  for (let x = el; x && x !== document.documentElement; x = x.parentElement) { const c = getComputedStyle(x);
    if (c.display === 'none' || c.visibility === 'hidden' || parseFloat(c.opacity) < 0.05) return false; } return true; }`;
/* Le schermate dove si vedono tasti, icone e colori. */
const SCHERMATE = [['Home', "go('plan')"], ['Programma', 'openDay(0)'], ['Spese', "go('money');moneyVista('spese')"], ['Budget', "go('money');moneyVista('budget')"],
  ['Biglietti', "go('tickets')"], ['Hotel', "go('hotels')"], ['Profilo', 'apriProfilo()'], ['Scopri', "go('discover');setDiscover('search')"], ['scheda del viaggio', 'openTripZoom(1)']];
const vai = (page, js) => page.evaluate(js => {
  document.querySelectorAll('.modal.active').forEach(m => { try { closeSheet(m.id); } catch (e) {} });
  document.querySelectorAll('.toast').forEach(x => x.remove());
  eval(js);
}, js).then(() => page.waitForTimeout(450));
/* Dove guardare: il foglio aperto in cima, se c'è, se no la pagina con le sue barre. */
const RADICI = `(() => { const a = [...document.querySelectorAll('.modal.active')]; if (a.length) return [a[a.length - 1]];
  return [document.querySelector('.topbar'), document.querySelector('.page.active'), document.querySelector('.nav')].filter(Boolean); })()`;

(async () => {
  const browser = await apriBrowser();

  /* ── 1: il tema nella barra in alto ─────────────────────────────────── */
  if (fare(1)) await prova('1', async () => {
    const page = await apriPagina(browser, { errori, chiave: 'tema-' + Math.random() });
    const m = await page.evaluate(() => {
      const riga = document.querySelector('.topbar-row'), th = document.getElementById('thTema');
      const ordine = [...riga.children].filter(e => getComputedStyle(e).display !== 'none').map(e => e.id || e.className.split(' ')[0]);
      if (!th) return { c: false, ordine };
      const q = th.getBoundingClientRect(), dopo = getComputedStyle(th, '::after');
      const bordo = parseFloat(getComputedStyle(th).borderLeftWidth) || 0;
      return { c: riga.contains(th), ordine, w: q.width, h: q.height, nome: th.getAttribute('aria-label'), usa: th.querySelector('use') && th.querySelector('use').getAttribute('href'),
        tocco: Math.round(q.width - 2 * bordo - 2 * parseFloat(dopo.left)) };
    });
    const i = m.ordine.indexOf('thTema');
    ok('1. il tondo del tema sta nella barra in alto, fra il GPS e il Profilo, con la luna e il nome «Tema scuro»',
      m.c && i > 0 && m.ordine[i - 1] === 'gpsPill' && m.ordine[i + 1] === 'tbProfilo' && m.usa === '#i-luna' && m.nome === 'Tema scuro', JSON.stringify(m));
    ok('1. si tocca su 44×44 (l\'area invisibile parte dall\'interno del bordo)', m.tocco >= 44, m.tocco + ' px');
    await page.click('#thTema'); await page.waitForTimeout(250);
    const scuro = await page.evaluate(() => ({ dark: document.body.classList.contains('dark'), nome: document.getElementById('thTema').getAttribute('aria-label'),
      usa: document.querySelector('#thTema use').getAttribute('href'), salvato: JSON.parse(localStorage.getItem('geppgo2')).settings.dark,
      barra: (document.querySelector('meta[name="theme-color"]') || {}).content }));
    ok('1. toccato, l\'app passa al tema scuro e se lo ricorda; il tondo diventa il sole, «Tema chiaro»',
      scuro.dark && scuro.salvato === true && scuro.usa === '#i-sole' && scuro.nome === 'Tema chiaro', JSON.stringify(scuro));
    await page.click('#thTema'); await page.waitForTimeout(250);
    const chiaro = await page.evaluate(() => ({ dark: document.body.classList.contains('dark'), usa: document.querySelector('#thTema use').getAttribute('href') }));
    ok('1. ritoccato torna al chiaro, con la luna', !chiaro.dark && chiaro.usa === '#i-luna', JSON.stringify(chiaro));
    /* nel Profilo c'è ancora, e la barra in alto lo segue */
    await vai(page, 'apriProfilo()');
    const prof = await page.evaluate(() => {
      const casella = [...document.querySelectorAll('#trips label')].find(l => /Tema scuro/.test(l.textContent));
      const inp = casella && casella.querySelector('input');
      if (inp) inp.click();
      return { c: !!inp, dark: document.body.classList.contains('dark'), usa: (document.querySelector('#thTema use') || {}).getAttribute && document.querySelector('#thTema use').getAttribute('href') };
    });
    ok('1. nel Profilo c\'è ancora «Tema scuro», e accendendolo lì anche il tondo in alto diventa il sole', prof.c && prof.dark && prof.usa === '#i-sole', JSON.stringify(prof));
    await page.close();
    /* senza un viaggio aperto, e nelle cinque lingue */
    const nomi = [];
    for (const lingua of LINGUE) {
      const p = await apriPagina(browser, { lingua, errori, viaggi: lingua === 'it' ? [] : undefined, chiave: 'tema-' + lingua + Math.random() });
      nomi.push(await p.evaluate(l => { const th = document.getElementById('thTema'); if (!th) return l + ': manca';
        const q = th.getBoundingClientRect(), n = th.getAttribute('aria-label');
        return q.width > 0 && n === tv('Tema scuro') && (l === 'it' || n !== 'Tema scuro') ? '' : l + ': ' + n; }, lingua));
      await p.close();
    }
    ok('1. c\'è anche senza un viaggio aperto, e il suo nome si legge in cinque lingue', nomi.every(x => !x), nomi.filter(Boolean).join(' | '));
  });

  /* ── 2: dove si apre il Programma ───────────────────────────────────── */
  if (fare(2)) await prova('2', async () => {
    const MISURA_TT = () => {
      const sc = document.querySelector('.scroll'), r = sc.getBoundingClientRect();
      const testa = document.getElementById('ttTestata'), rn = document.querySelector('.nav').getBoundingClientRect();
      const rt = testa ? testa.getBoundingClientRect() : null;
      const sotto = Math.min(r.bottom, rn.top);
      const blocchi = [...document.querySelectorAll('#ttBody .ttgrid > .tt-block[data-id]')].map(b => { const q = b.getBoundingClientRect(); return { id: b.dataset.id, top: Math.round(q.top), bottom: Math.round(q.bottom) }; });
      const sopra = rt ? Math.max(r.top, rt.bottom) : r.top;
      blocchi.forEach(b => { b.vista = b.top >= sopra - 1 && b.bottom <= sotto + 1; });
      return { st: Math.round(sc.scrollTop), giu: sc.scrollHeight - sc.clientHeight, giorno: ttDay, data: (document.getElementById('dayTt') || {}).textContent,
        testa: rt ? { top: Math.round(rt.top), bottom: Math.round(rt.bottom), vista: rt.top >= r.top - 1 && rt.bottom <= sotto, ferma: Math.abs(rt.top - r.top) <= 1 } : null,
        blocchi, sopra: Math.round(sopra), sotto: Math.round(sotto), adesso: !!document.getElementById('ttAdesso') };
    };
    async function apri({ viaggio = VIAGGIO, quando, scorriHome = true, fuso = null }) {
      const page = await apriPagina(browser, { errori, viaggi: [viaggio, PORTO], chiave: 'prog-' + Math.random(), opzioni: fuso ? { timezoneId: fuso } : {} });
      await page.clock.setFixedTime(quando);
      await page.evaluate(() => renderAll()); await page.waitForTimeout(200);
      /* la Home lasciata in fondo: prima il Programma ereditava quel punto */
      if (scorriHome) await page.evaluate(() => { const s = document.querySelector('.scroll'); s.scrollTop = s.scrollHeight; });
      await page.waitForTimeout(100);
      await page.click('.nav-item[data-p="mDay"]');
      await page.waitForTimeout(700);
      return page;
    }
    const breve = m => `scorso ${m.st} di ${m.giu}; testata ${m.testa ? (m.testa.vista ? 'a vista' : 'NON a vista') : 'MANCA'}; ` + m.blocchi.map(b => `${b.id} ${b.top}→${b.bottom}${b.vista ? '' : ' (no)'}`).join(', ');
    const inCima = m => m.st === 0 && m.testa && m.testa.vista && m.blocchi.length && m.blocchi[0].vista && m.st < m.giu - 1;
    /* Su una giornata piena sopra (l'avviso della pioggia, le tappe senza
       orario) la prima tappa in cima non ci sta: si scende di quanto basta a
       vederla intera, e non di piu' (sta in fondo a quello che si vede). */
    const quantoBasta = m => m.testa && m.testa.vista && m.blocchi.length && m.blocchi[0].vista && m.st < m.giu - 1 &&
      (m.st === 0 || m.blocchi[0].bottom >= m.sotto - 12);

    let page = await apri({ viaggio: spostaViaggio(VIAGGIO, -30), quando: alle(21, 40) });
    let m = await page.evaluate(MISURA_TT);
    ok('2. viaggio passato, alle 21:40, dopo una Home scorsa fino in fondo: il Programma si apre in cima, con la testata e la prima tappa a vista', inCima(m), breve(m));
    /* le ore vuote prima della prima tappa si possono riaprire */
    const prima = await page.evaluate(() => { const b = document.querySelector('.tt-prima'); if (b) b.click(); return !!b; });
    await page.waitForTimeout(300);
    const ore = await page.evaluate(() => ({ prima: (document.querySelector('.tt-line') || {}).dataset?.h, blocchi: document.querySelectorAll('#ttBody .ttgrid > .tt-block[data-id]').length }));
    ok('2. la griglia parte poco prima della prima tappa, e «Mostra le ore prima» rimette le 06:00', prima && ore.prima === '6' && ore.blocchi === 3, JSON.stringify(ore));
    await page.close();

    page = await apri({ viaggio: spostaViaggio(VIAGGIO, 30), quando: alle(21, 40) });
    m = await page.evaluate(MISURA_TT);
    ok('2. viaggio futuro, alle 21:40: in cima, prima tappa a vista', inCima(m), breve(m));
    await page.close();

    for (const [ore2, min, id, cosa] of [[14, 30, '13', 'la prossima tappa (Kiyomizu, alle 15)'], [10, 30, '11', 'la tappa in corso (Fushimi Inari, 9:30–11)']]) {
      page = await apri({ quando: alle(ore2, min) });
      m = await page.evaluate(MISURA_TT);
      const b = m.blocchi.find(x => x.id === id);
      const giusta = m.giorno === 0 && m.testa && m.testa.ferma && b && b.vista && b.top - m.testa.bottom <= 64 && m.st > 0 && m.st < m.giu - 1;
      ok(`2. oggi, giorno di viaggio, alle ${ore2}:${min}: si apre su ${cosa}, appena sotto la testata del giorno, ferma in alto`, giusta, breve(m));
      await page.close();
    }

    page = await apri({ quando: alle(21, 40) });
    m = await page.evaluate(MISURA_TT);
    ok('2. oggi a giornata finita (21:40): in cima, prima tappa a vista', inCima(m) && m.giorno === 0, breve(m));
    /* un altro giorno scelto: Nara, con Todaiji alle 10 */
    await page.evaluate(() => { const g = document.querySelectorAll('#dayChips .giorno')[1]; if (g) g.click(); });
    await page.waitForTimeout(600);
    m = await page.evaluate(MISURA_TT);
    ok('2. scelto un altro giorno (Nara, con l\'avviso della pioggia sopra la giornata): il più in alto possibile, con la sua prima tappa intera a vista e la testata', quantoBasta(m) && m.giorno === 1, breve(m));
    await page.close();

    /* «oggi» in Italia: all'1:30 di notte di domani è già domani, e alle
       10:30 la riga di adesso sta sul giorno giusto. Prima si guardava
       l'ora di Greenwich: in Italia, fino alle 2, era ancora ieri. */
    const domani = VIAGGIO.days[1].date, oggi = VIAGGIO.days[0].date;
    page = await apri({ quando: istanteA(domani, 1, 30, 'Europe/Rome'), fuso: 'Europe/Rome', scorriHome: false });
    m = await page.evaluate(MISURA_TT);
    const giornoNotte = m.giorno;
    await page.close();
    page = await apri({ quando: istanteA(oggi, 10, 30, 'Europe/Rome'), fuso: 'Europe/Rome', scorriHome: false });
    m = await page.evaluate(MISURA_TT);
    ok('2. nel fuso di Roma «oggi» è oggi: all\'1:30 si apre il giorno nuovo, e alle 10:30 la riga di adesso sta sul giorno giusto',
      giornoNotte === 1 && m.giorno === 0 && m.adesso, `all'1:30 giorno ${giornoNotte + 1}; alle 10:30 giorno ${m.giorno + 1}, riga di adesso ${m.adesso ? 'sì' : 'no'}`);
    await page.close();
  });

  /* ── 3: lo stato scelto d'oro ───────────────────────────────────────── */
  if (fare(3)) await prova('3', async () => {
    const male = [];
    for (const tema of ['chiaro', 'scuro']) {
      const page = await apriPagina(browser, { tema, errori, chiave: 'scelto-' + tema + Math.random() });
      const guarda = async (js, sel, attesi) => {
        await vai(page, js);
        return page.evaluate(([COL, sel, attesi]) => {
          const C = eval(COL), el = document.querySelector(sel);
          if (!el) return [sel + ': manca'];
          const cs = getComputedStyle(el), fondo = cs.backgroundColor, scritta = getComputedStyle(el.querySelector('.giorno-n') || el).color;
          const out = [];
          if (fondo !== C.tok(attesi.fondo)) out.push(`${sel}: fondo ${fondo}, atteso ${attesi.fondo} ${C.tok(attesi.fondo)}`);
          if (scritta !== C.tok(attesi.scritta)) out.push(`${sel}: scritta ${scritta}, attesa ${attesi.scritta} ${C.tok(attesi.scritta)}`);
          const k = C.contrasto(scritta, fondo); if (k < 4.5) out.push(`${sel}: contrasto ${k.toFixed(2)}:1`);
          return out;
        }, [COLORI, sel, attesi]);
      };
      const oro = { fondo: '--green', scritta: '--oro-su' };
      male.push(...(await guarda("go('plan')", '.hh-days .giorno.on', oro)).map(x => `${tema} Home ${x}`));
      male.push(...(await guarda('openDay(0)', '#dayChips .giorno.on', oro)).map(x => `${tema} Programma ${x}`));
      const scheda = { fondo: '--surface', scritta: '--green-deep' };
      male.push(...(await guarda("go('money');moneyVista('spese')", '#moneySeg .seg-btn.active', scheda)).map(x => `${tema} Spese ${x}`));
      male.push(...(await guarda("go('money');moneyVista('budget')", '#moneySeg .seg-btn.active', scheda)).map(x => `${tema} Budget ${x}`));
      male.push(...(await guarda("go('money');moneyVista('spese');setMoney('list')", '#tricountBody .seg .seg-btn.active', scheda)).map(x => `${tema} Spese/Saldi ${x}`));
      male.push(...(await guarda("go('plan')", '.nav-item.active', { fondo: '--ink', scritta: '--paper' })).map(x => `${tema} barra in basso ${x}`));
      await page.close();
    }
    ok('3. il giorno scelto è un tondo d\'oro (Home e Programma), la scheda scelta è bianca con la scritta oro (Spese, Budget, Saldi), con contrasti a norma, nei due temi', !male.filter(x => !/barra in basso/.test(x)).length, primi(male.filter(x => !/barra in basso/.test(x))));
    ok('3. la barra in basso resta col tondo d\'inchiostro', !male.filter(x => /barra in basso/.test(x)).length, primi(male.filter(x => /barra in basso/.test(x))));
  });

  /* ── 4: i secondari beige, le schede d'oro ──────────────────────────── */
  if (fare(4)) await prova('4', async () => {
    const tasti = [], schede = [];
    let contati = 0;
    for (const tema of ['chiaro', 'scuro']) {
      const page = await apriPagina(browser, { tema, errori, chiave: 'beige-' + tema + Math.random() });
      for (const [nome, js] of SCHERMATE) {
        await vai(page, js);
        const m = await page.evaluate(([COL, RAD, VIS]) => {
          const C = eval(COL), vis = eval(VIS), fondo = C.tok('--tasto-fondo'), bordo = C.tok('--tasto-bordo');
          const out = [];
          let n = 0;
          /* sul cielo scuro della Home i tasti sono di vetro, con la scritta
             bianca (fanno parte del cielo, vedi cieloScritte): non contano */
          eval(RAD).forEach(rad => rad.querySelectorAll('.btn-secondario').forEach(b => {
            if (!vis(b) || b.classList.contains('vetro')) return; n++;
            const cs = getComputedStyle(b), testo = (b.textContent || '').trim().slice(0, 24);
            if (cs.backgroundColor !== fondo) out.push(`«${testo}» fondo ${cs.backgroundColor}`);
            else if (cs.borderTopColor !== bordo) out.push(`«${testo}» bordo ${cs.borderTopColor}`);
            const k = C.contrasto(cs.color, cs.backgroundColor); if (k < 4.5) out.push(`«${testo}» contrasto ${k.toFixed(2)}:1`);
          }));
          return { out, n };
        }, [COLORI, RADICI, visibile]);
        contati += m.n;
        tasti.push(...m.out.map(x => `${tema} ${nome}: ${x}`));
      }
      /* le schede d'oro, e ogni scritta che ci sta dentro */
      for (const [nome, js, sel] of [['Spese', "go('money');moneyVista('spese')", '.money-hero'], ['Budget', "go('money');moneyVista('budget')", '.budget-hero']]) {
        await vai(page, js);
        schede.push(...(await page.evaluate(([COL, sel]) => {
          const C = eval(COL), s = document.querySelector(sel);
          if (!s) return [sel + ' manca'];
          const cs = getComputedStyle(s), out = [];
          const scuro = 'rgb(161, 118, 62)', chiaro = 'rgb(184, 134, 60)';
          if (!/linear-gradient/.test(cs.backgroundImage) || !cs.backgroundImage.includes(scuro) || !cs.backgroundImage.includes(chiaro)) out.push('il fondo non è l\'oro: ' + cs.backgroundImage.slice(0, 60));
          if (cs.color !== C.tok('--oro-su')) out.push('la scritta non è d\'inchiostro: ' + cs.color);
          const w = document.createTreeWalker(s, NodeFilter.SHOW_TEXT, { acceptNode: t => /\S/.test(t.data) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT });
          let t;
          while ((t = w.nextNode())) {
            const p = t.parentElement, pc = getComputedStyle(p);
            if (pc.display === 'none' || p.closest('select,option')) continue;
            /* il fondo vero di questa scritta: il primo che ne ha uno, se no l'oro (il capo più scuro) */
            let f = scuro;
            for (let x = p; x && x !== s; x = x.parentElement) { const xc = getComputedStyle(x); if (!C.trasparente(xc.backgroundColor) || xc.backgroundImage !== 'none') { f = xc.backgroundColor; break; } }
            const grande = parseFloat(pc.fontSize) >= 24 || (parseFloat(pc.fontSize) >= 18.66 && +pc.fontWeight >= 700);
            const k = C.contrasto(pc.color, f);
            if (k < (grande ? 3 : 4.5)) out.push(`«${t.data.trim().slice(0, 20)}» ${k.toFixed(2)}:1`);
          }
          return out;
        }, [COLORI, sel])).map(x => `${tema} ${nome}: ${x}`));
      }
      await page.close();
    }
    ok(`4. i tasti secondari sono beige col bordo leggero, mai bianchi, con la scritta a norma (${contati} tasti, 9 schermate, due temi)`, contati > 20 && !tasti.length, primi(tasti));
    ok('4. le schede del totale in Spese e del Budget sono d\'oro, con le scritte d\'inchiostro a norma (4,5:1, 3:1 le grandi), nei due temi', !schede.length, primi(schede));
  });

  /* ── 5: le icone a due toni ─────────────────────────────────────────── */
  if (fare(5)) await prova('5', async () => {
    /* I segni puri (crocetta, più, meno, frecce, spunta, pausa) e quelli
       d'avviso o d'eliminazione restano di un colore solo; e dove il fondo
       è d'oro, o la scritta rossa, il tratto d'oro non ci va. */
    const GLIFI = ['i-chiudi', 'i-piu', 'i-meno', 'i-avanti', 'i-indietro', 'i-giu', 'i-su', 'i-spunta', 'i-pausa', 'i-cestino', 'i-attenzione'];
    const UN_COLORE = '.btn-primario,.btn-elimina,.chip.on,.giorno.on,.hh-act.on,.locate-fab.on,.picker-opt.sel,.fab';
    const COMANDI = '.btn,.chip,.seg-btn,.th-btn,.menu-btn,.nav-item,.tt-az,.giorno,.riga,button';
    const male = [], emoji = [];
    let icone = 0;
    for (const tema of ['chiaro', 'scuro']) {
      const page = await apriPagina(browser, { tema, errori, chiave: 'ico-' + tema + Math.random() });
      for (const [nome, js] of SCHERMATE) {
        await vai(page, js);
        const m = await page.evaluate(([COL, RAD, VIS, GLIFI, UN_COLORE, COMANDI]) => {
          const C = eval(COL), vis = eval(VIS), oro = C.tok('--green'), out = [], em = [];
          let n = 0;
          eval(RAD).forEach(rad => {
            rad.querySelectorAll('svg.ico').forEach(s => {
              const cmd = s.closest(COMANDI); if (!cmd || !vis(s)) return;
              const u = s.querySelector('use'), href = u && u.getAttribute('href');
              if (!href || GLIFI.includes(href.slice(1))) return;
              n++;
              const sim = document.querySelector(href), testo = (cmd.textContent || '').trim().slice(0, 20);
              if (!sim || !sim.querySelector('[style*="--ico-d"]')) { out.push(`${href} in «${testo}»: nessun tratto d'oro`); return; }
              const d = getComputedStyle(s).getPropertyValue('--ico-d').trim();
              if (s.closest(UN_COLORE)) { if (d !== 'currentColor') out.push(`${href} in «${testo}»: sul fondo d'oro il tratto dovrebbe essere del colore della scritta`); }
              else if (C.rgb(d) !== oro || C.rgb(d) === getComputedStyle(s).color) out.push(`${href} in «${testo}»: tratto ${d}, non d'oro`);
            });
            /* la barra in basso: ogni icona ha il suo tratto d'oro */
            rad.querySelectorAll('.nav-item svg').forEach(s => { if (!s.querySelector('[style*="--ico-d"]')) out.push('barra in basso «' + s.closest('.nav-item').getAttribute('aria-label') + '»: nessun tratto d\'oro'); });
            /* nessuna emoji nei comandi (il meteo sul giorno è contenuto) */
            rad.querySelectorAll('.btn,.chip,.seg-btn,.th-btn,.menu-btn,.nav-item,.tt-az,.giorno').forEach(c => {
              if (!vis(c)) return;
              const copia = c.cloneNode(true); copia.querySelectorAll('.giorno-m').forEach(x => x.remove());
              if (/\p{Extended_Pictographic}/u.test(copia.textContent)) em.push(`«${copia.textContent.trim().slice(0, 24)}»`);
            });
          });
          return { out, em, n };
        }, [COLORI, RADICI, visibile, GLIFI, UN_COLORE, COMANDI]);
        icone += m.n;
        male.push(...m.out.map(x => `${tema} ${nome}: ${x}`));
        emoji.push(...m.em.map(x => `${tema} ${nome}: ${x}`));
      }
      await page.close();
    }
    ok(`5. le icone dei comandi sono a due toni: inchiostro e un tratto d'oro (${icone} icone in 9 schermate, due temi; anche la barra in basso)`, icone > 40 && !male.length, primi(male));
    ok('5. nessuna emoji nei comandi', !emoji.length, primi(emoji));
    /* E il tratto d'oro si vede davvero: dentro un <use> non passa niente,
       tranne le variabili. Si fotografa l'icona di «Naviga la giornata» e si
       contano i pixel. */
    const page = await apriPagina(browser, { errori, chiave: 'pixel-' + Math.random(), opzioni: { deviceScaleFactor: 3 } });
    await vai(page, 'openDay(0)');
    await page.evaluate(() => { document.querySelector('.scroll').scrollTop = 0; });
    const el = await page.$('.tt-az .ico');
    const png = el ? (await el.screenshot()).toString('base64') : '';
    await page.close();
    const tela = await browser.newPage();
    const px = png ? await tela.evaluate(async b64 => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data; let oro = 0, scuro = 0;
      for (let i = 0; i < d.length; i += 4) { const [r, g, b] = [d[i], d[i + 1], d[i + 2]]; if (r > 150 && r - b > 70 && g > 100 && g < r) oro++; if (r < 80 && g < 80 && b < 80) scuro++; }
      return { oro, scuro };
    }, png) : { oro: 0, scuro: 0 };
    await tela.close();
    ok('5. e il tratto d\'oro si vede davvero: nell\'icona fotografata ci sono pixel d\'oro e d\'inchiostro', px.oro > 30 && px.scuro > 30, JSON.stringify(px));
  });

  /* ── 6: il respiro ──────────────────────────────────────────────────── */
  if (fare(6)) await prova('6', async () => {
    const page = await apriPagina(browser, { errori, chiave: 'respiro-' + Math.random() });
    /* fra due cose: dal fondo della prima alla cima della seconda */
    const SPAZI = ([coppie]) => coppie.map(([nome, a, b, tipo]) => {
      const qa = typeof a === 'string' ? document.querySelector(a) : null, qb = typeof b === 'string' ? document.querySelector(b) : null;
      if (!qa || !qb) return { nome, tipo, d: null };
      return { nome, tipo, d: Math.round(qb.getBoundingClientRect().top - qa.getBoundingClientRect().bottom) };
    });
    const male = [], visti = [];
    const controlla = (dove, l) => l.forEach(x => {
      visti.push(`${dove} ${x.nome} ${x.d}`);
      const giusto = x.d !== null && (x.tipo === 'sezioni' ? x.d >= 24 && x.d <= 32 : x.d >= 0 && x.d <= 12);
      if (!giusto) male.push(`${dove}: ${x.nome} ${x.d === null ? 'non trovato' : x.d + ' px'} (${x.tipo === 'sezioni' ? 'fra sezioni 24–32' : 'nel gruppo 4–12'})`);
    });
    await vai(page, "go('plan')"); await page.evaluate(() => { document.querySelector('.scroll').scrollTop = 0; });
    controlla('Home', await page.evaluate(SPAZI, [[
      ['«Prepara la valigia» → «Fra poco»', '#valScheda', '.hh-soon', 'sezioni'],
      ['«Fra poco» → i giorni', '.hh-soon', '.hh-days .giorno', 'sezioni'],
      ['i giorni → «La giornata»', '.hh-days .giorno', '.hh-sec', 'gruppo'],
      ['«La giornata» → la mappa', '.hh-sec', '#homeMapWrap', 'gruppo'],
      ['la mappa → le tappe', '#homeMapWrap', '.hh-cards .hh-card', 'gruppo'],
      ['le tappe → la pubblicità', '.hh-cards .hh-card', '#plan>.ad-slot', 'sezioni'],
      ['la pubblicità → «Da prenotare»', '#plan>.ad-slot', '#bookings>*', 'sezioni']]]));
    await vai(page, 'openDay(0)'); await page.evaluate(() => { document.querySelector('.scroll').scrollTop = 0; });
    controlla('Programma', await page.evaluate(SPAZI, [[
      ['il titolo → la testata del giorno', '.tt-head', '#ttTestata', 'gruppo'],
      ['la testata del giorno → la mappa', '#ttTestata', '#dayMapWrap', 'sezioni'],
      ['la mappa → il tempo', '#dayMapWrap', '#dayWx', 'gruppo'],
      ['il tempo → i quattro tasti', '#dayWx', '.tt-strumenti', 'sezioni'],
      ['fra le due file di tasti', '.tt-strumenti .tt-azioni', '.tt-strumenti .tt-azioni+.tt-azioni', 'gruppo'],
      ['i tasti → la giornata', '.tt-strumenti', '#ttBody', 'sezioni']]]));
    await vai(page, "go('money');moneyVista('spese');setMoney('list')"); await page.evaluate(() => { document.querySelector('.scroll').scrollTop = 0; });
    controlla('Spese', await page.evaluate(SPAZI, [[
      ['Spese|Budget → il viaggio', '#moneySeg', '#tricountBody>:first-child', 'sezioni'],
      ['il viaggio → il totale', '#tricountBody>:first-child', '.money-hero', 'gruppo'],
      ['il totale → Spese|Saldi', '.money-hero', '#tricountBody .seg', 'sezioni'],
      ['Spese|Saldi → il primo giorno', '#tricountBody .seg', '#tricountBody .section-label', 'sezioni'],
      ['il giorno → la sua spesa', '#tricountBody .section-label', '#tricountBody .section-label+.card', 'gruppo']]]));
    await vai(page, "go('money');moneyVista('budget')"); await page.evaluate(() => { document.querySelector('.scroll').scrollTop = 0; });
    controlla('Budget', await page.evaluate(SPAZI, [[
      ['il budget → i tetti', '.budget-hero', '#tettiCard', 'sezioni'],
      ['i tetti → le categorie', '#tettiCard', '#tettiCard+.card', 'sezioni']]]));
    await page.close();
    ok('6. fra le sezioni di Home, Programma, Spese e Budget 24–32 px, fra le cose dello stesso gruppo 4–12', !male.length, primi(male, 8));
  });

  /* ── 7: accessibilità, schermi stretti, stile in testa ──────────────── */
  if (fare(7)) await prova('7', async () => {
    const TOCCATE = ['home', 'time table', 'spese', 'saldi', 'budget', 'biglietti', 'hotel', 'scopri cerca', 'profilo con account', 'scheda del viaggio'];
    const axe = [];
    for (const tema of ['chiaro', 'scuro']) {
      const g = await giro(browser, { larghezza: 390, tema, soloQuesti: TOCCATE, guarda: async page => {
        const m = await misura(page, { axe: true, contrasto: true });
        return [...(m.axe || []), ...(m.testi || []).map(x => `contrasto ${x.chi} «${String(x.testo || '').slice(0, 16)}» ${Number(x.r).toFixed(2)}:1`)];
      } });
      Object.entries(g.esiti).forEach(([n, l]) => (l || []).forEach(v => axe.push(`${tema} ${n}: ${v}`)));
      errori.push(...g.err.map(e => `giro 7 ${tema}: ` + e));
    }
    ok(`7. axe sulle ${TOCCATE.length} schermate toccate, nei due temi: nessuna violazione grave, contrasti a norma`, !axe.length, primi(axe));
    const tagliati = [];
    for (const tema of ['chiaro', 'scuro']) for (const lingua of LINGUE) for (const larghezza of [320, 430]) {
      const g = await giro(browser, { lingua, larghezza, tema, soloQuesti: TOCCATE, guarda: async page => page.evaluate(MISURA, NOMI) });
      Object.entries(g.esiti).forEach(([n, mm]) => { if (!mm) return; [...mm.fuori, ...mm.troncati, ...mm.sovrapposti].forEach(x => tagliati.push(`${tema} ${lingua} ${larghezza}px ${n}: ${x}`)); });
      /* e la barra in alto, col tondo del tema in più, ci sta */
      const p = await apriPagina(browser, { lingua, larghezza, tema, errori, chiave: 'testata-' + lingua + larghezza + tema });
      const fuori = await p.evaluate(() => [...document.querySelectorAll('.topbar-row > *')].filter(e => getComputedStyle(e).display !== 'none')
        .filter(e => e.getBoundingClientRect().right > innerWidth + 0.5).map(e => e.id || e.className));
      fuori.forEach(x => tagliati.push(`${tema} ${lingua} ${larghezza}px barra in alto: ${x} esce dallo schermo`));
      await p.close();
    }
    ok(`7. niente fuori dallo schermo, tagliato o sovrapposto da 320 a 430 px, in 5 lingue e due temi (${TOCCATE.length} schermate e la barra in alto)`, !tagliati.length, primi(tagliati));
    const testa = HTML.slice(0, HTML.indexOf('<body'));
    const kb = Buffer.byteLength(testa) / 1024;
    const stili = [...testa.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('');
    ok('7. lo stile in testa resta piccolo come dopo la Layout 1 (sotto i 4 KB: c\'è solo la schermata d\'apertura)', kb < 4, `${kb.toFixed(1)} KB in testa, di cui ${(Buffer.byteLength(stili) / 1024).toFixed(1)} di stile`);
  });

  await browser.close();
  const nonCercati = errori.filter(e => !/ERR_BLOCKED|net::|Failed to load resource|tile\.openstreetmap/.test(e));
  ok('nessun errore in pagina durante le prove', !nonCercati.length, primi(nonCercati));
  console.log('\nIL CARATTERE (Layout 1b)\n' + r.join('\n'));
  const passati = r.filter(x => x.startsWith('  OK')).length;
  console.log(`\n${passati}/${r.length} passati`);
  process.exit(passati === r.length ? 0 : 1);
})();
