/* LA NAVIGAZIONE (Layout 2): la barra in basso a cinque voci con le parole,
   le azioni del viaggio nel menu dei viaggi, Prenotazioni, Identifica in
   Scopri, il Programma che si chiama Programma, e il cielo in cima a tutte le
   schermate.

   1. in inglese, nel Programma, «1 person» e non «1 people»; i plurali
      sistemati sono giusti con 0, 1, 2 e 5 nelle cinque lingue;
   2. il cielo sta in cima a tutte le schermate (il cielo grande con la città
      solo in Home), segue il tempo, l'ora e il tema, sfuma nel panna, e le
      scritte che ci stanno sopra restano a norma (4,5:1, 3:1 se grandi),
      misurate due volte: col conto della sfumatura e coi pixel della foto;
   3. A raccolta, Bagagli, Compagni, Condividi e Viaggio sono nel menu dei
      viaggi, fra l'elenco e «Aggiungi viaggio», sotto il nome del viaggio, e
      funzionano; in Home non ci sono più («Cosa cerchi» da solo, la scheda
      della valigia sì); senza un viaggio aperto il gruppo non c'è;
   4. la barra ha cinque voci con la parola sotto, intere da 320 a 430 px in
      cinque lingue, almeno a 12 px, coi caratteri veri; dove nella pillola
      non ci stanno la barra prende tutta la larghezza, e dove non ci stanno
      nemmeno così lo dice (sono le parole da accorciare, da decidere); ogni
      voce apre la sua schermata, la scelta ha aria-current e il tondo
      d'inchiostro, i tasti sono da 44;
   5. la schermata si chiama «Programma» ovunque: titolo, barra, testi a
      schermo, frasi nel codice (tv, tp, toast), traduzioni e MAPPA_APP;
   6. Prenotazioni: le schede funzionano; si apre su Biglietti se c'è un
      biglietto oggi o nelle prossime 24 ore, se no sull'ultima scheda usata;
      ogni vecchio percorso verso Hotel e Biglietti apre la scheda giusta, e
      «Portami qui» dentro Hotel funziona;
   7. Identifica si raggiunge in due tocchi, con una voce scritta; e la
      quarta scheda in Scopri non ci starebbe (la prova la misura);
   8. i vecchi indirizzi interni (#hotel, #biglietti, #identifica...) e le
      notifiche portano al posto nuovo;
   9. MAPPA_APP dice i percorsi nuovi; axe senza violazioni gravi sulle
      schermate nuove nei due temi; niente fuori schermo da 320 a 430 px.

   `node test/prova-navigazione.js 4 6` fa solo le prove 4 e 6. */
const fs = require('fs');
const path = require('path');
const { apriBrowser, APP, RADICE } = require('./browser');
const { VIAGGIO, PORTO, D, iso, giornoA, att, apriPagina, MISURA, NOMI } = require('./schermate');
const { misura } = require('./prova-accessibilita');

const r = [];
const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);
const errori = [];
const SCELTE = process.argv.slice(2).filter(a => /^\d+$/.test(a));
const fare = n => !SCELTE.length || SCELTE.includes(String(n));
const prova = async (nome, fn) => { try { await fn(); } catch (e) { ok(nome, false, 'si è fermata: ' + e.message.split('\n')[0]); } };
const primi = (l, n = 5) => l.slice(0, n).join(' | ') + (l.length > n ? ` (e altri ${l.length - n})` : '');
const LINGUE = ['it', 'en', 'es', 'fr', 'pt'];
const LARGHEZZE = [320, 360, 375, 390, 414, 430];
const FILE_APP = APP.startsWith('file://') ? decodeURIComponent(APP.slice(7)) : path.join(RADICE, 'Index 2.1.html');
const HTML = fs.readFileSync(FILE_APP, 'utf8');
const apri = (browser, o = {}) => apriPagina(browser, Object.assign({ errori, chiave: 'nav-' + Math.random() }, o));
const copia = x => JSON.parse(JSON.stringify(x));

/* La barra in basso, nelle cinque lingue, e la schermata che apre ogni voce. */
const PAROLE = {
  it: ['Oggi', 'Programma', 'Scopri', 'Spese', 'Prenotazioni'],
  en: ['Today', 'Schedule', 'Discover', 'Expenses', 'Bookings'],
  es: ['Hoy', 'Programa', 'Descubrir', 'Gastos', 'Reservas'],
  fr: ['Aujourd’hui', 'Programme', 'Découvrir', 'Dépenses', 'Réservations'],
  pt: ['Hoje', 'Roteiro', 'Descobrir', 'Despesas', 'Reservas']
};
const PAGINE_VOCI = ['plan', 'mDay', 'discover', 'money', 'prenotazioni'];

/* Le scritte che stanno sul cielo di una pagina senza un fondo loro, con il
   colore della sfumatura dove stanno. La sfumatura si legge dal CSS vero
   della pagina (background-image), non dai conti dell'app: e' un altro modo
   di fare lo stesso conto. */
const SUL_CIELO = `(() => {
  const pg = document.querySelector('main .page.active');
  if (!pg) return { errore: 'nessuna pagina' };
  const cs = getComputedStyle(pg), bi = cs.backgroundImage;
  const colori = [...bi.matchAll(/rgba?\\(([^)]+)\\)/g)].map(m => m[1].split(',').map(Number).slice(0, 3));
  const stop = (bi.match(/\\)\\s*([\\d.]+)%\\)?\\s*$/) || [])[1];
  const alto = parseFloat((cs.backgroundSize.split(' ')[1] || '0'));
  if (colori.length < 2) return { id: pg.id, sfumatura: bi, citta: !!pg.querySelector('.hh-city,.hh-velo') };
  const [a, b] = colori, fine = alto * (stop ? parseFloat(stop) / 100 : 0.82), cima = pg.getBoundingClientRect().top;
  const fondo = y => { const k = Math.max(0, Math.min(1, (y - cima) / fine)); return a.map((v, i) => v + (b[i] - v) * k); };
  const lum = c => c.reduce((s, v, i) => { v /= 255; v = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); return s + v * [0.2126, 0.7152, 0.0722][i]; }, 0);
  const con = (x, y) => { const p = lum(x), q = lum(y); return (Math.max(p, q) + 0.05) / (Math.min(p, q) + 0.05); };
  const haFondo = el => { const s = getComputedStyle(el), c = (s.backgroundColor.match(/[\\d.]+/g) || []).map(Number); return (c.length > 3 ? c[3] > 0.05 : c.length === 3) || s.backgroundImage !== 'none'; };
  const scritte = new Set(), w = document.createTreeWalker(pg, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) if (n.parentElement && n.textContent.trim()) scritte.add(n.parentElement);
  const male = [], viste = [];
  scritte.forEach(el => {
    const q = el.getBoundingClientRect(); if (!q.width || !q.height || q.top - cima >= fine) return;
    /* una scritta che ha preso un fondo suo sul cielo (dove ne' il nero ne'
       il bianco reggevano) si misura sul suo fondo */
    const proprio = el.hasAttribute('data-su-cielo') && el.style.backgroundColor ? (el.style.backgroundColor.match(/[\\d.]+/g) || []).map(Number).slice(0, 3) : null;
    if (!proprio) for (let x = el; x && x !== pg; x = x.parentElement) if (haFondo(x)) return;
    const st = getComputedStyle(el); if (st.visibility === 'hidden') return;
    const fg = (st.color.match(/[\\d.]+/g) || []).map(Number).slice(0, 3);
    const px = parseFloat(st.fontSize), peso = parseInt(st.fontWeight, 10) || 400, soglia = (px >= 24 || (px >= 18.66 && peso >= 700)) ? 3 : 4.5;
    /* dove stanno le lettere */
    const rg = document.createRange(); rg.selectNodeContents(el); const l = rg.getBoundingClientRect();
    const su = l.height ? l.top : q.top, giu = l.height ? l.bottom : q.bottom;
    const peggio = proprio ? con(fg, proprio) : Math.min(...[su + 1, (su + giu) / 2, giu - 1].map(y => con(fg, fondo(y))));
    viste.push(el.textContent.trim().slice(0, 20));
    if (peggio + 0.005 < soglia) male.push(pg.id + ' «' + el.textContent.trim().slice(0, 24) + '» ' + peggio.toFixed(2) + ':1 (serve ' + soglia + ')');
  });
  return { id: pg.id, cima: a, fine: b, alto, stop, male, viste, citta: !!pg.querySelector('.hh-city,.hh-velo') };
})()`;
/* Il cielo del primo giorno: il tempo (codice) e il giorno o la notte. */
const scena = (codice, notte) => `(() => { const t = T(), w = t.weather[t.days[0].date]; w.code = ${codice}; w.precipitation = ${codice} >= 61 ? 6 : 0;
  w.sunrise = w.sunrise.slice(0, 11) + '${notte ? '23:58' : '00:00'}'; w.sunset = w.sunset.slice(0, 11) + '${notte ? '00:01' : '23:59'}';
  renderAll(); })()`;

(async () => {
  const browser = await apriBrowser();

  /* ── 1. «1 person» e i plurali ─────────────────────────────────────────── */
  if (fare(1)) await prova('1', async () => {
    /* Nel Programma, una tappa per una persona sola su tre. */
    const v = copia(VIAGGIO);
    v.days[0].activities.find(a => a.id === 12).who = [1];
    v.days[0].activities.find(a => a.id === 11).who = [1, 2];
    const visto = {};
    for (const lingua of LINGUE) {
      const p = await apri(browser, { lingua, viaggi: [v, PORTO] });
      visto[lingua] = await p.evaluate(() => { openDay(0); return [...document.querySelectorAll('#mDay .tt-block .tsub')].map(e => e.textContent.replace(/\s+/g, ' ')).join(' | '); });
      await p.close();
    }
    ok('1. in inglese, nel Programma, una tappa per una persona dice «1 person»', /· 1 person\b/.test(visto.en) && !/1 people/.test(visto.en), (visto.en.match(/· \d+ (person|people)/g) || []).join(', ') || visto.en.slice(0, 120));
    ok('1. e due persone «2 people»', /· 2 people\b/.test(visto.en));
    ok('1. nelle altre lingue l\'abbreviazione resta giusta per uno e per tanti (pers., pess.)',
      /· 1 pers\./.test(visto.it) && /· 1 pers\./.test(visto.es) && /· 1 pers\./.test(visto.fr) && /· 1 pess\./.test(visto.pt),
      LINGUE.map(l => l + ': ' + ((visto[l].match(/· 1 \S+/) || [''])[0])).join(', '));
    /* Le altre frasi che con «1» davano un plurale sbagliato. */
    const CASI = [
      [' · {1} pers.', ' · {1} pers.', { en: [' · 0 people', ' · 1 person', ' · 2 people', ' · 5 people'] }],
      ['FRA {1} GIORNO', 'FRA {1} GIORNI', { it: ['FRA 0 GIORNI', 'FRA 1 GIORNO', 'FRA 2 GIORNI', 'FRA 5 GIORNI'], en: ['IN 0 DAYS', 'IN 1 DAY', 'IN 2 DAYS', 'IN 5 DAYS'], fr: ['DANS 0 JOUR', 'DANS 1 JOUR', 'DANS 2 JOURS', 'DANS 5 JOURS'], pt: ['DAQUI A 0 DIAS', 'DAQUI A 1 DIA', 'DAQUI A 2 DIAS', 'DAQUI A 5 DIAS'] }],
      ['fra {1} giorno', 'fra {1} giorni', { en: ['in 0 days', 'in 1 day', 'in 2 days', 'in 5 days'], es: ['en 0 días', 'en 1 día', 'en 2 días', 'en 5 días'] }],
      ['Disponibile tra {1} giorno', 'Disponibile tra {1} giorni', { en: ['Available in 0 days', 'Available in 1 day', 'Available in 2 days', 'Available in 5 days'], fr: ['Disponible dans 0 jour', 'Disponible dans 1 jour', 'Disponible dans 2 jours', 'Disponible dans 5 jours'] }],
      ['Importa {1} riga', 'Importa {1} righe', { it: ['Importa 0 righe', 'Importa 1 riga', 'Importa 2 righe', 'Importa 5 righe'], en: ['Import 0 rows', 'Import 1 row', 'Import 2 rows', 'Import 5 rows'], pt: ['Importar 0 linhas', 'Importar 1 linha', 'Importar 2 linhas', 'Importar 5 linhas'] }],
      ['…e {1} altra riga.', '…e altre {1} righe.', { it: ['…e altre 0 righe.', '…e 1 altra riga.', '…e altre 2 righe.', '…e altre 5 righe.'], en: ['…and 0 more rows.', '…and 1 more row.', '…and 2 more rows.', '…and 5 more rows.'] }],
      [' e {1} altra', ' e altre {1}', { it: [' e altre 0', ' e 1 altra', ' e altre 2', ' e altre 5'], fr: [' et 0 autre', ' et 1 autre', ' et 2 autres', ' et 5 autres'] }],
      ['{1} giorno', '{1} giorni', { en: ['0 days', '1 day', '2 days', '5 days'] }]
    ];
    const male = [];
    for (const lingua of LINGUE) {
      const p = await apri(browser, { lingua });
      const v2 = await p.evaluate(c => c.map(([u, t]) => [0, 1, 2, 5].map(n => tp(n, u, t))), CASI);
      await p.close();
      CASI.forEach(([u, , attese], i) => { if (attese[lingua] && JSON.stringify(v2[i]) !== JSON.stringify(attese[lingua])) male.push(`${lingua} «${u}»: ${JSON.stringify(v2[i])}`); });
    }
    ok('1. i plurali sistemati sono giusti con 0, 1, 2 e 5 (lo zero francese al singolare)', !male.length, primi(male, 3) || `${CASI.length} frasi`);
    /* E nel codice non resta nessuna di quelle frasi passata a tv() col numero. */
    const restano = [/tv\(' · \{1\} pers\.'/, /tv\('FRA \{1\} GIORNI'/, /tv\('fra \{1\} giorni',da-16\)/, /tv\('Disponibile tra \{1\} giorni'/, /tv\('Importa \{1\} righe'/, /tv\('…e altre \{1\} righe\.'/,
      /tv\(' e altre \{1\}'/, /tv\('\{1\} · \{2\} giorni · \{3\}'/, /tv\('Ne carico al massimo \{1\} per volta: le altre \{2\}/, /tv\('\{1\} luoghi',0\)/].filter(re => re.test(HTML)).map(String);
    ok('1. nel codice nessuna di quelle frasi passa più da tv() col numero (passano da tp())', !restano.length, restano.join(' | '));
    /* La scheda di un viaggio di un giorno solo, nel Profilo: «1 day». */
    const uno = Object.assign(copia(PORTO), { id: 3, name: 'Gita', start: D[0], end: D[0], days: [{ id: 'g', date: D[0], title: '', activities: [] }] });
    const p = await apri(browser, { lingua: 'en', viaggi: [copia(VIAGGIO), uno] });
    const scheda = await p.evaluate(() => { go('trips'); const c = [...document.querySelectorAll('.hist-card')].find(x => x.textContent.includes('Gita')); return c ? c.querySelector('.hist-m').textContent : ''; });
    await p.close();
    ok('1. e nel Profilo un viaggio di un giorno dice «1 day»', /\b1 day\b/.test(scheda) && !/1 days/.test(scheda), scheda);
  });

  /* ── 2. il cielo in cima a tutte le schermate ─────────────────────────── */
  if (fare(2)) await prova('2', async () => {
    const PAGINE = [['Spese', "go('money');moneyVista('spese')"], ['Budget', "go('money');moneyVista('budget')"], ['Scopri', "go('discover');setDiscover('search')"],
      ['Prenotazioni › Biglietti', "typeof apriPrenotazioni === 'function' ? apriPrenotazioni('biglietti') : go('tickets')"], ['Prenotazioni › Hotel', "typeof apriPrenotazioni === 'function' ? apriPrenotazioni('hotel') : go('hotels')"], ['Programma', 'openDay(0)'],
      ['Programma, un altro giorno', 'openDay(1)'], ['Identifica', "typeof apriIdentifica === 'function' ? apriIdentifica() : go('identify')"], ['Profilo', 'apriProfilo()']];
    const SCENE = [['sereno di giorno', 0, false], ['sereno di sera', 0, true], ['velato', 2, false], ['nuvoloso', 3, false], ['nuvoloso di sera', 3, true], ['nebbia', 45, false],
      ['pioggia di giorno', 63, false], ['pioggia di sera', 63, true], ['neve', 71, false], ['temporale', 95, false], ['temporale di sera', 95, true]];
    const cime = {}, senza = [], citta = [], conto = [], pixel = [], panna = [];
    /* Quante pagine col cielo, quante scritte su quel cielo e quante foto:
       un controllo che non ha avuto niente da guardare non dice «a norma». */
    let misurate = 0, scritteSul = 0, fotografate = 0;
    for (const tema of ['chiaro', 'scuro']) {
      const p = await apri(browser, { tema });
      for (const [nomeScena, codice, notte] of SCENE) {
        await p.evaluate(scena(codice, notte));
        await p.waitForTimeout(150);
        for (const [nome, js] of PAGINE) {
          await p.evaluate(js);
          await p.evaluate(() => { document.getAnimations().forEach(x => { try { x.finish(); } catch (e) {} }); });
          await p.waitForTimeout(80);
          await p.evaluate(() => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res))));
          const s = await p.evaluate(SUL_CIELO);
          const dove = `${tema}, ${nomeScena}, ${nome}`;
          /* il cielo grande si guarda su ogni pagina, che abbia la sfumatura o no */
          if (s.citta) citta.push(dove);
          if (!s.cima) { senza.push(dove + ': ' + (s.sfumatura || s.errore)); continue; }
          misurate++; scritteSul += (s.viste || []).length;
          (cime[tema + '|' + nomeScena] = cime[tema + '|' + nomeScena] || []).push(s.cima.join(','));
          const paper = await p.evaluate(() => { const d = document.createElement('i'); d.style.color = 'var(--paper)'; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return (c.match(/[\d.]+/g) || []).map(Number).slice(0, 3).join(','); });
          if (s.fine.join(',') !== paper || Math.abs(parseFloat(s.stop) - 82) > 0.5 || Math.abs(s.alto - 440) > 0.5) panna.push(`${dove}: finisce in ${s.fine} al ${s.stop}% di ${s.alto}px`);
          s.male.forEach(m => conto.push(dove + ': ' + m));
          /* e coi pixel della foto: la misura della miglioria 11, che le
             sfumature le legge dallo schermo */
          if (nomeScena === 'sereno di sera' || nomeScena === 'pioggia di giorno') {
            const m = await misura(p, { axe: false, contrasto: true, tocchi: false });
            fotografate++;
            (m.testi || []).forEach(x => pixel.push(`${dove}: «${String(x.testo || '').slice(0, 20)}» ${Number(x.r).toFixed(2)}:1`));
          }
        }
      }
      await p.close();
    }
    ok(`2. la sfumatura del cielo c'è in cima a tutte le ${PAGINE.length} schermate, in ${SCENE.length} cieli e due temi`, !senza.length, primi(senza, 3));
    ok('2. e sfuma nel panna della pagina all\'82% di 440 px, come la Home', misurate > 0 && !panna.length, primi(panna, 3) || `${misurate} pagine col cielo`);
    ok('2. il cielo grande con la città resta solo in Home', !citta.length, primi(citta, 3));
    const unico = k => { const v = cime[k] || []; return v.length && v.every(x => x === v[0]) ? v[0] : null; };
    const luce = s => { const c = s.split(',').map(Number); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
    const g = unico('chiaro|sereno di giorno'), s = unico('chiaro|sereno di sera'), pi = unico('chiaro|pioggia di giorno'), gs = unico('scuro|sereno di giorno');
    ok('2. tutte le schermate hanno lo stesso cielo, quello della Home', Object.keys(cime).length === SCENE.length * 2 && Object.keys(cime).every(k => unico(k)), Object.entries(cime).filter(([k]) => !unico(k)).map(([k, v]) => k + ': ' + [...new Set(v)].join(' / ')).join(' | ') || `${Object.keys(cime).length} cieli su ${SCENE.length * 2}`);
    ok('2. segue l\'ora: di sera il cielo è più scuro che di giorno', g && s && luce(s) < luce(g) - 20, `giorno ${g}, sera ${s}`);
    ok('2. segue il tempo: con la pioggia il cielo cambia colore', g && pi && g !== pi, `sereno ${g}, pioggia ${pi}`);
    ok('2. segue il tema: nel tema scuro il cielo di giorno è più cupo', g && gs && luce(gs) < luce(g) - 20, `chiaro ${g}, scuro ${gs}`);
    ok('2. le scritte che stanno sul cielo senza un fondo loro sono a norma (conto sulla sfumatura)', scritteSul > 0 && !conto.length, primi(conto, 4) || `${scritteSul} scritte misurate`);
    ok('2. e lo sono anche a guardare i pixel della foto (sera serena e pioggia, due temi)', fotografate > 0 && !pixel.length, primi(pixel, 4) || `${fotografate} foto`);
    /* La testata del Programma: trasparente al suo posto, panna quando resta
       ferma in alto, e le scritte tornano del loro colore. */
    const p = await apri(browser, { altezza: 640 });
    await p.evaluate(scena(0, true));
    const t = await p.evaluate(async () => {
      openDay(0); await new Promise(r => setTimeout(r, 500));
      const sc = document.querySelector('main.scroll'), tes = document.getElementById('ttTestata'), sub = document.getElementById('dayTt');
      sc.scrollTop = 0; tingiPagina();
      const fermo = { bg: getComputedStyle(tes).backgroundColor, col: sub.style.color };
      sc.scrollTop = 600; await new Promise(r => setTimeout(r, 150));
      const scesa = { bg: getComputedStyle(tes).backgroundColor, col: sub.style.color, ferma: tes.classList.contains('ferma') };
      return { fermo, scesa };
    });
    await p.close();
    ok('2. la testata del Programma lascia vedere il cielo al suo posto, e quando resta ferma in alto è panna con le scritte del loro colore',
      /rgba\(0, 0, 0, 0\)|transparent/.test(t.fermo.bg) && t.fermo.col && t.scesa.ferma && !/rgba\(0, 0, 0, 0\)/.test(t.scesa.bg) && !t.scesa.col, JSON.stringify(t));
  });

  /* ── 3. le azioni del viaggio nel menu dei viaggi ─────────────────────── */
  if (fare(3)) await prova('3', async () => {
    const p = await apri(browser);
    const m = await p.evaluate(async () => {
      document.getElementById('menuViaggi').click();
      await new Promise(r => setTimeout(r, 450));
      const az = document.getElementById('vgAzioni'), lista = document.getElementById('vgLista'), nuovo = document.querySelector('#mViaggi .vg-nuovo');
      if (!az || az.hidden) return { manca: true };
      const tasti = [...az.querySelectorAll('button')];
      const tok = n => { const d = document.createElement('i'); d.style.color = 'var(' + n + ')'; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; };
      return {
        titolo: (az.querySelector('.vg-az-t') || {}).textContent, nome: T().name,
        ordine: !!(lista.compareDocumentPosition(az) & Node.DOCUMENT_POSITION_FOLLOWING) && !!(az.compareDocumentPosition(nuovo) & Node.DOCUMENT_POSITION_FOLLOWING)
          && lista.getBoundingClientRect().bottom <= az.getBoundingClientRect().top + 1 && az.getBoundingClientRect().bottom <= nuovo.getBoundingClientRect().top + 1,
        parole: tasti.map(b => b.textContent.trim()),
        icone: tasti.every(b => { const u = b.querySelector('svg.ico use'); const s = u && document.querySelector(u.getAttribute('href')); return !!(s && s.innerHTML.includes('--ico-d')); }),
        beige: tasti.every(b => getComputedStyle(b).backgroundColor === tok('--tasto-fondo')),
        misure: tasti.map(b => { const q = b.getBoundingClientRect(); return [Math.round(q.width), Math.round(q.height)]; })
      };
    });
    ok('3. nel menu dei viaggi c\'è il gruppo del viaggio aperto, col suo nome come titolo', !m.manca && m.titolo === m.nome, m.manca ? 'il gruppo non c\'è' : `«${m.titolo}»`);
    ok('3. sta fra l\'elenco dei viaggi e «Aggiungi viaggio»', !m.manca && m.ordine);
    ok('3. le cinque azioni: A raccolta, Bagagli, Compagni, Condividi, Viaggio', !m.manca && JSON.stringify(m.parole) === JSON.stringify(['A raccolta', 'Bagagli', 'Compagni', 'Condividi', 'Viaggio']), m.manca ? '' : m.parole.join(', '));
    ok('3. icona a due toni più parola, tasti beige, almeno 44 × 44', !m.manca && m.icone && m.beige && m.misure.every(([w, h]) => w >= 44 && h >= 44), m.manca ? '' : JSON.stringify(m.misure));
    /* Ognuna apre la sua cosa, col cassetto chiuso. */
    const apre = [['Bagagli', 'mPacking'], ['Compagni', 'mPeople'], ['Condividi', 'mShare'], ['Viaggio', 'mTripZoom'], ['A raccolta', null]];
    const esiti = [];
    for (const [parola, foglio] of apre) {
      const e = await p.evaluate(async ([parola, foglio]) => {
        document.querySelectorAll('.modal.active').forEach(x => x.classList.remove('active'));
        let detto = '';
        window.__toastPrima = window.__toastPrima || window.toast; window.toast = m => { detto = String(m); };
        apriViaggi(); await new Promise(r => setTimeout(r, 400));
        const b = [...document.querySelectorAll('#vgAzioni button')].find(x => x.textContent.trim() === parola);
        if (!b) return parola + ': tasto mancante';
        b.click(); await new Promise(r => setTimeout(r, 500));
        const cassetto = document.getElementById('mViaggi').classList.contains('active');
        const aperto = foglio ? document.getElementById(foglio).classList.contains('active') : (document.getElementById('mRaccolta').classList.contains('active') || !!detto);
        window.toast = window.__toastPrima;
        return (aperto && !cassetto) ? '' : `${parola}: ${foglio || 'raccolta'} ${aperto ? 'aperto' : 'non aperto'}, cassetto ${cassetto ? 'ancora aperto' : 'chiuso'}`;
      }, [parola, foglio]);
      if (e) esiti.push(e);
    }
    ok('3. e funzionano: ognuna apre la sua finestra (A raccolta apre la chiamata o dice cosa manca), col cassetto chiuso', !esiti.length, esiti.join(' | '));
    /* In Home non ci sono più; «Cosa cerchi» da solo, largo quanto la riga. */
    const h = await p.evaluate(() => {
      document.querySelectorAll('.modal.active').forEach(x => x.classList.remove('active'));
      go('plan'); renderHomeHero();
      const hero = document.getElementById('homeHero'), cerca = hero.querySelector('.hh-cerca'), riga = cerca && cerca.closest('.hh-azioni');
      const parole = [...hero.querySelectorAll('button')].map(b => b.textContent.trim()).filter(t => /^(A raccolta|Bagagli|Compagni|Condividi|Viaggio)$/.test(t));
      const hh = hero.querySelector('.hh'), hs = getComputedStyle(hh), dentro = hh.getBoundingClientRect().width - parseFloat(hs.paddingLeft) - parseFloat(hs.paddingRight);
      return { parole, vecchi: hero.querySelectorAll('.hh-raccolta,.hh-rapido,.hh-rapidi').length, largo: cerca ? Math.round(cerca.getBoundingClientRect().width) : 0, riga: Math.round(dentro), soli: riga ? riga.children.length : 0,
        valigia: !!hero.querySelector('#valScheda') };
    });
    ok('3. in Home non ci sono più', !h.parole.length && !h.vecchi, h.parole.join(', '));
    ok('3. in Home «Cosa cerchi qui intorno?» resta da solo, a tutta larghezza', h.soli === 1 && Math.abs(h.largo - h.riga) <= 1, `${h.largo} px su ${h.riga}`);
    ok('3. la scheda «Prepara la valigia» resta com\'è, nei giorni giusti (il primo giorno del viaggio)', h.valigia);
    await p.close();
    /* Senza un viaggio aperto il gruppo non c'è. */
    const q = await apri(browser, { viaggi: [] });
    const vuoto = await q.evaluate(async () => { apriViaggi(); await new Promise(r => setTimeout(r, 400)); const az = document.getElementById('vgAzioni'); return { nascosto: !az || az.hidden || !az.offsetHeight, tasti: az ? az.querySelectorAll('button').length : 0 }; });
    await q.close();
    /* con un viaggio aperto il gruppo c'era (qui sopra): se no non si e'
       provato niente */
    ok('3. senza un viaggio aperto il gruppo non compare', !m.manca && vuoto.nascosto && !vuoto.tasti, m.manca ? 'il gruppo non c\'è nemmeno con un viaggio' : JSON.stringify(vuoto));
  });

  /* ── 4. la barra in basso ─────────────────────────────────────────────── */
  if (fare(4)) await prova('4', async () => {
    const tagliate = [], piccole = [], fuori = [], parole = [], nonServe = [], daDecidere = [], piene = [];
    let caratteri = '';
    for (const lingua of LINGUE) for (const larghezza of LARGHEZZE) {
      const p = await apri(browser, { lingua, larghezza });
      const b = await p.evaluate(async () => {
        await document.fonts.ready;
        if (typeof navAdatta === 'function') navAdatta();
        const barra = document.querySelector('.nav'), pista = barra.querySelector('.nav-track');
        const voci = [...pista.querySelectorAll('.nav-item')];
        /* quanto servirebbe a tutta larghezza: le parole e i loro margini */
        const serve = voci.reduce((s, v) => { const t = v.querySelector('.ni-tx'), st = getComputedStyle(v); return s + Math.max(44, Math.ceil(t.getBoundingClientRect().width) + parseFloat(st.paddingLeft) + parseFloat(st.paddingRight)); }, 0);
        return {
          font: getComputedStyle(voci[0].querySelector('.ni-tx')).fontFamily.split(',')[0].replace(/"/g, ''),
          vero: document.fonts.check('600 12px "Plus Jakarta Sans"'),
          piena: barra.classList.contains('piena'), scorre: pista.scrollWidth > pista.clientWidth + 1, posto: pista.clientWidth, serve,
          voci: voci.map(v => { const t = v.querySelector('.ni-tx'), q = v.getBoundingClientRect(), rg = document.createRange(); rg.selectNodeContents(t);
            return { testo: t.textContent.trim(), px: parseFloat(getComputedStyle(t).fontSize), intera: t.scrollWidth <= t.clientWidth + 0.5 && rg.getBoundingClientRect().width <= t.getBoundingClientRect().width + 0.5,
              sx: q.left, dx: q.right }; })
        };
      });
      await p.close();
      if (!caratteri) caratteri = b.font + (b.vero ? '' : ' (NON caricato)');
      const dove = `${lingua} ${larghezza}px`;
      if (JSON.stringify(b.voci.map(v => v.testo)) !== JSON.stringify(PAROLE[lingua])) parole.push(`${dove}: ${b.voci.map(v => v.testo).join(', ')}`);
      b.voci.forEach(v => { if (!v.intera) tagliate.push(`${dove} «${v.testo}»`); if (v.px < 12) piccole.push(`${dove} «${v.testo}» ${v.px}px`); });
      if (b.scorre) {
        /* Non ci stanno nemmeno a tutta larghezza: la barra dev'essere piena,
           e sono le parole da accorciare (si decide insieme). */
        if (!b.piena) fuori.push(`${dove}: scorre senza aver preso tutta la larghezza`);
        daDecidere.push(`${dove} (servono ${Math.round(b.serve)} px, ce ne sono ${b.posto})`);
      } else {
        b.voci.forEach(v => { if (v.sx < -0.5 || v.dx > larghezza + 0.5) fuori.push(`${dove} «${v.testo}» fuori dallo schermo`); });
        if (b.piena) piene.push(dove);
      }
      /* piena solo quando serve: nella pillola non ci sarebbero state */
      if (b.piena && b.serve <= larghezza - 2 * 13.6 - 8 - 2) nonServe.push(`${dove}: piena ma ci stava nella pillola (${Math.round(b.serve)} px)`);
    }
    ok('4. le cinque voci sono Oggi · Programma · Scopri · Spese · Prenotazioni, tradotte nelle cinque lingue', !parole.length, primi(parole, 3));
    ok(`4. le parole sono sempre intere, da 320 a 430 px in cinque lingue (${LINGUE.length * LARGHEZZE.length} misure), coi caratteri veri: ${caratteri}`, !tagliate.length && !/NON/.test(caratteri), primi(tagliate, 4));
    ok('4. e almeno a 12 px', !piccole.length, primi(piccole, 3));
    ok('4. tutte e cinque a schermo; dove nella pillola non ci stanno la barra prende tutta la larghezza, e solo lì', !fuori.length && !nonServe.length,
      primi(fuori.concat(nonServe), 4) || (piene.length ? 'a tutta larghezza: ' + piene.join(', ') : 'sempre nella pillola'));
    ok('4. dove non ci stanno nemmeno a tutta larghezza la pista scorre con le parole intere: ' + (daDecidere.length ? 'DA DECIDERE, parole più corte per ' + daDecidere.join(', ') : 'nessun caso'), true);
    /* Ogni voce apre la sua schermata; aria-current, nav, 44 px, tondo d'inchiostro. */
    const p = await apri(browser);
    const v = await p.evaluate(async pagine => {
      const out = [];
      const tok = n => { const d = document.createElement('i'); d.style.color = 'var(' + n + ')'; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; };
      const voci = [...document.querySelectorAll('.nav .nav-item')];
      for (let i = 0; i < voci.length; i++) {
        voci[i].click(); await new Promise(r => setTimeout(r, 350));
        const att = document.querySelector('main .page.active'), cur = document.querySelectorAll('.nav [aria-current="page"]');
        const q = voci[i].getBoundingClientRect(), ic = voci[i].querySelector('.ni-ic');
        out.push({ pagina: att && att.id, attesa: pagine[i], cur: cur.length === 1 && cur[0] === voci[i], w: q.width, h: q.height,
          tondo: getComputedStyle(ic).backgroundColor === tok('--ink'), altri: voci.filter(x => x !== voci[i]).every(x => getComputedStyle(x.querySelector('.ni-ic')).backgroundColor === 'rgba(0, 0, 0, 0)') });
      }
      const nav = document.querySelector('nav.nav');
      return { out, zona: nav && nav.tagName === 'NAV' && !!nav.getAttribute('aria-label') };
    }, PAGINE_VOCI);
    await p.close();
    ok('4. ogni voce apre la schermata giusta', v.out.every(x => x.pagina === x.attesa), v.out.map(x => `${x.attesa}→${x.pagina}`).join(', '));
    ok('4. la voce scelta ha aria-current, e la barra è una zona nav con il suo nome', v.zona && v.out.every(x => x.cur));
    ok('4. il tondo della voce scelta è d\'inchiostro (le altre senza)', v.out.every(x => x.tondo && x.altri));
    ok('4. i tasti della barra sono da 44 × 44 almeno', v.out.every(x => x.w >= 44 && x.h >= 44), v.out.map(x => Math.round(x.w) + '×' + Math.round(x.h)).join(' '));
  });

  /* ── 5. si chiama «Programma» ovunque ─────────────────────────────────── */
  if (fare(5)) await prova('5', async () => {
    const TITOLI = { it: 'Programma', en: 'Schedule', es: 'Programa', fr: 'Programme', pt: 'Roteiro' };
    const titoli = [], vecchi = [];
    for (const lingua of LINGUE) {
      const p = await apri(browser, { lingua });
      const x = await p.evaluate(async () => {
        const testi = [];
        const raccogli = () => { testi.push(document.body.innerText); document.querySelectorAll('[title],[aria-label],[placeholder]').forEach(e => testi.push([e.title, e.getAttribute('aria-label'), e.placeholder].filter(Boolean).join(' '))); };
        openDay(0); await new Promise(r => setTimeout(r, 300));
        const titolo = document.querySelector('#mDay .tt-title').textContent.trim(), voce = (document.querySelector('.nav-item[data-p="mDay"] .ni-tx') || { textContent: '(nessuna parola)' }).textContent.trim();
        raccogli();
        tapAct(0, 12); await new Promise(r => setTimeout(r, 300)); raccogli(); closeSheet('mActMenu');
        go('plan'); raccogli();
        if (typeof apriPrenotazioni === 'function') apriPrenotazioni('hotel'); else go('hotels'); raccogli(); apriMailHotel(); await new Promise(r => setTimeout(r, 200)); raccogli();
        document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
        openTicketSheet(); await new Promise(r => setTimeout(r, 200)); raccogli();
        document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
        go('discover'); setDiscover('search'); raccogli();
        return { titolo, voce, vecchio: testi.join('\n').split('\n').filter(l => /time.?table/i.test(l)).slice(0, 4) };
      });
      await p.close();
      if (x.titolo !== TITOLI[lingua] || x.voce !== TITOLI[lingua]) titoli.push(`${lingua}: titolo «${x.titolo}», barra «${x.voce}»`);
      x.vecchio.forEach(l => vecchi.push(`${lingua}: «${l.slice(0, 70)}»`));
    }
    ok('5. il titolo della schermata e la voce della barra sono la stessa parola, in cinque lingue (Programma, Schedule, Programa, Programme, Roteiro)', !titoli.length, titoli.join(' | '));
    ok('5. nessun testo a schermo dice più «Time Table» (Programma, menu della tappa, Home, Hotel, mail dell\'hotel, nuovo biglietto, Scopri)', !vecchi.length, primi(vecchi, 3));
    /* Il dizionario e MAPPA_APP: nessuna frase dice la parola vecchia. */
    const p = await apri(browser);
    const d = await p.evaluate(() => {
      const male = [];
      Object.entries(DIZIONARIO).forEach(([l, dz]) => Object.entries(dz).forEach(([k, v]) => {
        if (/time.?table/i.test(k)) male.push(`chiave «${k.slice(0, 50)}»`);
        else if (/time.?table/i.test(v) && !/bus timetable/i.test(v)) male.push(`${l} «${v.slice(0, 50)}»`);
      }));
      const mappa = MAPPA_APP.split('\n').filter(l => /time.?table/i.test(l) && !/si chiamava Time Table/.test(l)).map(l => 'MAPPA_APP «' + l.slice(0, 50) + '»');
      return male.concat(mappa, /- Programma: la giornata ora per ora/.test(MAPPA_APP) ? [] : ['MAPPA_APP senza la voce «Programma»']);
    });
    await p.close();
    /* E le frasi nel codice: una chiave rinominata nel dizionario ma non
       nella chiamata resta italiana in tutte le lingue, e a schermo si vede
       solo dove la si incontra (il «Apri la time-table» della Home vuota). */
    const nelCodice = [...HTML.matchAll(/\b(?:tv|tp|toast|t)\(\s*'((?:[^'\\]|\\.)*)'/g)].map(m => m[1]).filter(s => /time.?table/i.test(s));
    nelCodice.forEach(s => d.push(`nel codice «${s.slice(0, 50)}»`));
    ok('5. nel dizionario delle cinque lingue, nelle frasi del codice e in MAPPA_APP la schermata si chiama Programma', !d.length, primi(d, 3));
  });

  /* ── 6. Prenotazioni ──────────────────────────────────────────────────── */
  if (fare(6)) await prova('6', async () => {
    const p = await apri(browser);
    const schede = await p.evaluate(async () => {
      const stato = () => ({ pagina: document.querySelector('main .page.active').id, biglietti: getComputedStyle(document.getElementById('tickets')).display !== 'none', hotel: getComputedStyle(document.getElementById('hotels')).display !== 'none',
        seg: [...document.querySelectorAll('#prenSeg .seg-btn')].map(b => b.textContent.trim() + (b.classList.contains('active') ? '*' : '')).join('|') });
      apriPrenotazioni(); const a = stato();
      document.getElementById('segHotel').click(); const b = stato();
      document.getElementById('segBiglietti').click(); const c = stato();
      return [a, b, c];
    });
    ok('6. Prenotazioni ha il controllo a schede «Biglietti | Hotel» e le schede funzionano',
      schede[0].pagina === 'prenotazioni' && schede[1].hotel && !schede[1].biglietti && schede[1].seg === 'Biglietti|Hotel*' && schede[2].biglietti && !schede[2].hotel && schede[2].seg === 'Biglietti*|Hotel', JSON.stringify(schede.map(s => s.seg)));
    ok('6. le schede sono le schermate di prima: in Biglietti l\'elenco dei biglietti, in Hotel le notti e gli alberghi',
      await p.evaluate(() => !!document.querySelector('#tickets #ticketsList .ticket') && !!document.querySelector('#hotels #hotelNotti .ht-cop') && !!document.querySelector('#hotels #hotelList .card')));
    /* Quale scheda all'apertura. */
    const apertura = await p.evaluate(async () => {
      let nuovo = 900; const t = T(), giorno = (n, ora) => { const id = ++nuovo; t.days[n].activities.push({ id, name: 'Museo ' + n, time: ora, timeEnd: '', who: [1], booking: { needed: false, done: false } }); return id; };
      const quale = () => { apriPrenotazioni(); return document.getElementById('segBiglietti').classList.contains('active') ? 'biglietti' : 'hotel'; };
      const out = {};
      /* nessun biglietto attaccato a una tappa: l'ultima usata */
      t.tickets = [{ id: 70, name: 'Pass', code: 'P1', format: 'qrcode' }];
      document.getElementById('segHotel').click(); out.ultimaHotel = quale();
      document.getElementById('segBiglietti').click(); out.ultimaBiglietti = quale();
      document.getElementById('segHotel').click();
      /* un biglietto fra tre giorni: conta ancora l'ultima */
      t.tickets = [{ id: 71, name: 'Museo', code: 'M3', format: 'qrcode', actId: giorno(3, '10:00') }];
      out.fraTreGiorni = quale();
      /* un biglietto di oggi, anche a un'ora gia' passata: Biglietti */
      t.tickets = [{ id: 72, name: 'Museo', code: 'M0', format: 'qrcode', actId: giorno(0, '08:00') }];
      out.oggi = quale();
      /* un biglietto domattina (nelle prossime 24 ore, l'orologio e' a mezzogiorno): Biglietti */
      document.getElementById('segHotel').click();
      t.tickets = [{ id: 73, name: 'Museo', code: 'M1', format: 'qrcode', actId: giorno(1, '09:00') }];
      out.domattina = quale();
      /* domani sera, oltre le 24 ore: l'ultima usata (Hotel) */
      document.getElementById('segHotel').click();
      t.tickets = [{ id: 74, name: 'Museo', code: 'M2', format: 'qrcode', actId: giorno(1, '20:30') }];
      out.domaniSera = quale();
      /* mai scelta una scheda: Biglietti */
      localStorage.removeItem('geppgo2_pren_scheda'); t.tickets = [];
      out.primaVolta = quale();
      return out;
    });
    ok('6. senza biglietti vicini si apre sull\'ultima scheda usata (Hotel, poi Biglietti)', apertura.ultimaHotel === 'hotel' && apertura.ultimaBiglietti === 'biglietti' && apertura.fraTreGiorni === 'hotel' && apertura.domaniSera === 'hotel', JSON.stringify(apertura));
    ok('6. con un biglietto di oggi, o di una tappa nelle prossime 24 ore, si apre su Biglietti anche se l\'ultima era Hotel', apertura.oggi === 'biglietti' && apertura.domattina === 'biglietti');
    ok('6. la prima volta, senza un\'ultima scheda, Biglietti', apertura.primaVolta === 'biglietti');
    /* I vecchi percorsi. */
    const vecchi = await p.evaluate(async () => {
      const dove = () => document.querySelector('main .page.active').id + '/' + (document.getElementById('segHotel').classList.contains('active') ? 'hotel' : 'biglietti');
      const out = {};
      go('hotels'); out.goHotels = dove(); go('tickets'); out.goTickets = dove();
      go('plan'); vaiAlPosto('hotel'); out.postoHotel = dove(); vaiAlPosto('biglietti'); out.postoBiglietti = dove();
      /* «Portami qui» nella scheda Hotel */
      let portato = null; const prima = window.openNav; window.openNav = (lat, lng, nome) => { portato = [lat, lng, nome]; };
      apriPrenotazioni('hotel');
      const b = [...document.querySelectorAll('#hotelList button')].find(x => /Portami qui/.test(x.textContent));
      if (b) b.click();
      window.openNav = prima;
      out.portami = portato;
      return out;
    });
    await p.close();
    ok('6. go(\'hotels\') e go(\'tickets\'), i nomi di prima, aprono Prenotazioni sulla scheda giusta', vecchi.goHotels === 'prenotazioni/hotel' && vecchi.goTickets === 'prenotazioni/biglietti', `${vecchi.goHotels}, ${vecchi.goTickets}`);
    ok('6. e così i vecchi indirizzi «hotel» e «biglietti»', vecchi.postoHotel === 'prenotazioni/hotel' && vecchi.postoBiglietti === 'prenotazioni/biglietti');
    ok('6. «Portami qui» dentro la scheda Hotel funziona', !!vecchi.portami && vecchi.portami[2] === 'Ryokan Hoshi', JSON.stringify(vecchi.portami));
  });

  /* ── 7. Identifica, in due tocchi ─────────────────────────────────────── */
  if (fare(7)) await prova('7', async () => {
    const p = await apri(browser);
    /* Da Home: «Scopri» nella barra, poi la riga «Identifica». Due tocchi veri. */
    await p.evaluate(() => go('plan'));
    await p.locator('.nav-item', { hasText: 'Scopri' }).click();
    await p.waitForTimeout(250);
    const riga = await p.evaluate(() => { const b = document.querySelector('#discover .sc-identifica'), pg = document.getElementById('discover');
      return b ? { testo: b.textContent.replace(/\s+/g, ' ').trim(), primo: pg.firstElementChild === b || [...pg.children].filter(x => getComputedStyle(x).display !== 'none' && x.tagName !== 'SCRIPT')[0] === b, h: b.getBoundingClientRect().height } : null; });
    await p.locator('#discover .sc-identifica').click();
    await p.waitForTimeout(250);
    const arrivo = await p.evaluate(() => ({ pagina: document.querySelector('main .page.active').id, voce: (document.querySelector('.nav [aria-current="page"] .ni-tx') || {}).textContent, foto: !!document.querySelector('#identify input[type="file"]') }));
    ok('7. Identifica si raggiunge in due tocchi da Home: «Scopri» nella barra, poi la riga «Identifica»', arrivo.pagina === 'identify' && arrivo.foto, JSON.stringify(arrivo));
    ok('7. la riga è ben visibile in cima a Scopri, con la parola scritta e cosa fa', !!riga && riga.primo && /^Identifica/.test(riga.testo) && riga.h >= 44, JSON.stringify(riga));
    ok('7. dentro Identifica la barra accende Scopri, e «Scopri» riporta indietro', arrivo.voce === 'Scopri' &&
      await p.evaluate(() => { document.querySelector('#identify .id-indietro').click(); return document.querySelector('main .page.active').id === 'discover'; }));
    await p.close();
    /* La quarta scheda: a 320 px, nelle cinque lingue, «Identifica» starebbe
       intera accanto alle altre tre? Si prova davvero, con una copia del
       controllo a schede. Si guarda l'insieme, non la scheda: una scheda non
       si stringe sotto la sua parola, quindi quando il posto non basta e'
       il controllo intero a sbordare, e la scheda presa da sola sembra
       sempre a filo (la prima versione di questa misura confrontava proprio
       quello, e il verdetto dipendeva dagli arrotondamenti). Servono le
       parole, piu' i margini dentro le schede e lo spazio fra l'una e
       l'altra. */
    const misure = [];
    for (const lingua of LINGUE) {
      const q = await apri(browser, { lingua, larghezza: 320 });
      const m = await q.evaluate(async () => {
        await document.fonts.ready; go('discover');
        const seg = document.querySelector('#discover .seg'), c = seg.cloneNode(true);
        const b = c.querySelector('.seg-btn').cloneNode(true); b.textContent = t('Identifica'); b.removeAttribute('id'); c.appendChild(b);
        c.querySelectorAll('[id]').forEach(x => x.removeAttribute('id'));
        seg.after(c);
        const cs = getComputedStyle(c), gap = parseFloat(cs.columnGap) || 0;
        const voci = [...c.querySelectorAll('.seg-btn')].map(x => { const rg = document.createRange(); rg.selectNodeContents(x); const st = getComputedStyle(x);
          return { testo: x.textContent.trim(), parola: rg.getBoundingClientRect().width, margini: parseFloat(st.paddingLeft) + parseFloat(st.paddingRight) }; });
        const posto = c.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        const serve = voci.reduce((n, v) => n + v.parola + v.margini, 0) + gap * (voci.length - 1);
        c.remove();
        return { serve: Math.round(serve), posto: Math.round(posto), id: voci[voci.length - 1].testo };
      });
      await q.close();
      misure.push(Object.assign({ lingua }, m));
    }
    const nonCi = misure.filter(x => x.serve > x.posto);
    ok('7. la quarta scheda «Identifica» a 320 px non ci starebbe intera in tutte e cinque le lingue: per questo è una riga in cima', nonCi.length > 0,
      misure.map(x => `${x.lingua} «${x.id}»: servono ${x.serve} px su ${x.posto}` + (x.serve > x.posto ? ' (non ci sta)' : '')).join('; '));
  });

  /* ── 8. vecchi indirizzi e notifiche ──────────────────────────────────── */
  if (fare(8)) await prova('8', async () => {
    const CASI = [['#hotel', 'prenotazioni', 'hotel'], ['#hotels', 'prenotazioni', 'hotel'], ['#biglietti', 'prenotazioni', 'biglietti'], ['#tickets', 'prenotazioni', 'biglietti'],
      ['#identifica', 'identify'], ['#identify', 'identify'], ['#programma', 'mDay'], ['#timetable', 'mDay'], ['#spese', 'money'], ['#budget', 'money', 'budget'], ['#prenotazioni', 'prenotazioni'], ['#scopri', 'discover']];
    const male = [];
    const stato = () => ({ pagina: (document.querySelector('main .page.active') || {}).id, scheda: (document.getElementById('segHotel') || { classList: { contains: () => false } }).classList.contains('active') ? 'hotel' : 'biglietti',
      budget: getComputedStyle(document.getElementById('moneyBudget')).display !== 'none', hash: location.hash });
    for (const [hash, pagina, scheda] of CASI) {
      const p = await apri(browser, { indirizzo: APP + hash });
      const s = await p.evaluate(stato);
      await p.close();
      const giusto = s.pagina === pagina && (!scheda || (scheda === 'budget' ? s.budget : s.scheda === scheda)) && !s.hash.startsWith(hash);
      if (!giusto) male.push(`${hash} → ${s.pagina}${scheda ? '/' + (scheda === 'budget' ? (s.budget ? 'budget' : 'spese') : s.scheda) : ''} (cancelletto «${s.hash.slice(0, 12)}»)`);
    }
    ok(`8. aprendo l'app con un vecchio indirizzo interno si arriva al posto nuovo (${CASI.map(c => c[0]).join(' ')}), e l'indirizzo torna pulito`, !male.length, primi(male, 4));
    /* Con l'app aperta, il cancelletto che cambia. */
    const p = await apri(browser);
    const aperta = await p.evaluate(async () => {
      const out = [];
      for (const [h, atteso] of [['#hotel', 'prenotazioni/hotel'], ['#biglietti', 'prenotazioni/biglietti'], ['#identifica', 'identify/'], ['#programma', 'mDay/']]) {
        location.hash = h; await new Promise(r => setTimeout(r, 250));
        const pg = document.querySelector('main .page.active').id, sc = pg === 'prenotazioni' ? (document.getElementById('segHotel').classList.contains('active') ? 'hotel' : 'biglietti') : '';
        out.push([h, pg + '/' + sc === atteso, pg + '/' + sc]);
      }
      return out;
    });
    ok('8. e anche con l\'app già aperta, quando il cancelletto cambia', aperta.every(x => x[1]), aperta.map(x => x[0] + '→' + x[2]).join(', '));
    /* Le notifiche della miglioria 9: dove portano. */
    const notifiche = await p.evaluate(async () => {
      const dove = () => document.querySelector('main .page.active').id;
      const out = {};
      go('plan'); vaiAllAvviso({ tipo: 'promemoria', trip: 1, att: 21 }); await new Promise(r => setTimeout(r, 200));
      out.promemoria = dove() + ' ' + (document.getElementById('dayTt').textContent || '').trim().slice(0, 20) + ' giorno ' + (ttDay + 1);
      go('plan'); vaiAllAvviso({ tipo: 'partenza', trip: 1, att: 12 }); await new Promise(r => setTimeout(r, 200)); out.partenza = dove();
      document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
      go('plan'); vaiAllAvviso({ tipo: 'prenota', trip: 1, att: 11 }); await new Promise(r => setTimeout(r, 300));
      out.prenota = dove() + (document.querySelector('.modal.active') ? ' + ' + document.querySelector('.modal.active').id : '');
      document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
      go('plan'); vaiAllAvviso({ tipo: 'budget', trip: 1 }); await new Promise(r => setTimeout(r, 200));
      out.budget = dove() + (getComputedStyle(document.getElementById('moneyBudget')).display !== 'none' ? ' › Budget' : '');
      go('money'); vaiAllAvviso({ tipo: 'vicino', trip: 1, poi: 91, dist: 50 }); await new Promise(r => setTimeout(r, 200)); out.vicino = dove();
      return out;
    });
    await p.close();
    ok('8. le notifiche portano alle schermate nuove: promemoria, partenza e prenota nel Programma, il tetto di spesa in Spese › Budget, il posto vicino in Oggi',
      /^mDay .* giorno 2$/.test(notifiche.promemoria) && notifiche.partenza === 'mDay' && /^mDay \+ /.test(notifiche.prenota) && notifiche.budget === 'money › Budget' && notifiche.vicino === 'plan', JSON.stringify(notifiche));
    /* E toccata ad app chiusa: la service worker la apre con #avviso=. */
    const sw = fs.readFileSync(path.join(RADICE, 'sw.js'), 'utf8');
    const q = await apri(browser, { indirizzo: APP + '#avviso=' + encodeURIComponent(JSON.stringify({ tipo: 'promemoria', trip: 1, att: 21 })) });
    await q.waitForTimeout(600);
    const chiusa = await q.evaluate(() => document.querySelector('main .page.active').id + ' giorno ' + (ttDay + 1));
    await q.close();
    ok('8. e una notifica toccata ad app chiusa (#avviso=, da sw.js) apre il Programma sul giorno giusto', /#avviso=/.test(sw) && chiusa === 'mDay giorno 2', chiusa);
  });

  /* ── 9. MAPPA_APP, axe, schermi stretti ───────────────────────────────── */
  if (fare(9)) await prova('9', async () => {
    const p = await apri(browser);
    const m = await p.evaluate(() => {
      const riga = inizio => MAPPA_APP.split('\n').find(l => l.startsWith('- ' + inizio)) || '';
      return {
        barra: riga('La barra in basso'), cassetto: riga('Le TRE RIGHINE'), home: riga('Home'), scopri: riga('Scopri'), pren: riga('Prenotazioni'), programma: riga('Programma'),
        vecchie: [/Home, Time Table, Scopri, Spese/, /Sotto le icone non ci sono scritte/, /Subito sotto, una fila di quattro tasti/, /Il tasto "A raccolta" sta in home/, /"Viaggio" in Home ›/, /- Hotel: gli alloggi/].filter(re => re.test(MAPPA_APP)).map(String),
        bagagli: mappaPerDomanda('Dove trovo i bagagli nell\'app?'), identifica: mappaPerDomanda('Dove trovo Identifica nell\'app?'), hotel: mappaPerDomanda('Dove sono gli hotel nell\'app?')
      };
    });
    const casi = [
      ['la barra: cinque voci con la parola, Oggi · Programma · Scopri · Spese · Prenotazioni', /"Oggi".*"Programma".*"Scopri".*"Spese".*"Prenotazioni"/.test(m.barra) && /parola/.test(m.barra)],
      ['il menu dei viaggi: il gruppo del viaggio aperto con le cinque azioni, prima di «Aggiungi viaggio»', /"A raccolta".*"Bagagli".*"Compagni".*"Condividi".*"Viaggio".*"Aggiungi viaggio"/.test(m.cassetto)],
      ['la Home: le cinque azioni non ci sono più, «Cosa cerchi» da solo', /NON sono piu' in Home/.test(m.home) && /da solo/.test(m.home)],
      ['Scopri: Identifica in cima', /"Identifica"/.test(m.scopri)],
      ['Prenotazioni: le due schede e quale si apre', /"Biglietti" e "Hotel"/.test(m.pren) && /24 ore/.test(m.pren)],
      ['il Programma ha la sua voce', !!m.programma],
      ['niente percorsi vecchi', !m.vecchie.length],
      ['e l\'assistente riceve la voce giusta (bagagli → menu dei viaggi, Identifica → Scopri, hotel → Prenotazioni)', /menu dei viaggi/.test(m.bagagli) && /- Scopri: in cima la riga "Identifica"/.test(m.identifica) && /- Prenotazioni/.test(m.hotel)]
    ];
    casi.forEach(([n, c]) => ok('9. MAPPA_APP: ' + n, c, n === 'niente percorsi vecchi' ? m.vecchie.join(' | ') : ''));
    await p.close();
    /* axe sulle schermate nuove o toccate, nei due temi. */
    const SCHERMATE = [['Oggi', "go('plan')"], ['menu dei viaggi', 'apriViaggi()'], ['Programma', 'openDay(0)'], ['Scopri', "go('discover');setDiscover('search')"],
      ['Prenotazioni › Biglietti', "apriPrenotazioni('biglietti')"], ['Prenotazioni › Hotel', "apriPrenotazioni('hotel')"], ['Identifica', 'apriIdentifica()'], ['Spese', "go('money')"]];
    const axe = [];
    for (const tema of ['chiaro', 'scuro']) {
      const q = await apri(browser, { tema });
      for (const [nome, js] of SCHERMATE) {
        await q.evaluate(() => document.querySelectorAll('.modal.active').forEach(x => x.classList.remove('active')));
        await q.evaluate(js); await q.waitForTimeout(450);
        const mm = await misura(q, { axe: true, contrasto: true, tocchi: true });
        [...(mm.axe || []), ...(mm.testi || []).map(x => `contrasto «${String(x.testo || '').slice(0, 16)}» ${Number(x.r).toFixed(2)}:1`), ...(mm.piccoli || []).map(x => 'tasto piccolo ' + (x.chi || x))].forEach(v => axe.push(`${tema} ${nome}: ${v}`));
      }
      await q.close();
    }
    ok(`9. axe sulle ${SCHERMATE.length} schermate nuove o toccate, nei due temi: nessuna violazione grave, contrasti a norma, tasti da 44`, !axe.length, primi(axe, 4));
    /* Niente fuori dallo schermo, niente di tagliato o sovrapposto. */
    const tagliati = [];
    for (const lingua of LINGUE) for (const larghezza of [320, 430]) {
      const q = await apri(browser, { lingua, larghezza });
      for (const [nome, js] of SCHERMATE) {
        await q.evaluate(() => document.querySelectorAll('.modal.active').forEach(x => x.classList.remove('active')));
        await q.evaluate(js); await q.waitForTimeout(350);
        const mm = await q.evaluate(MISURA, NOMI);
        [...mm.fuori, ...mm.troncati, ...mm.sovrapposti].forEach(x => tagliati.push(`${lingua} ${larghezza}px ${nome}: ${x}`));
      }
      await q.close();
    }
    ok('9. niente fuori dallo schermo, tagliato o sovrapposto da 320 a 430 px in cinque lingue', !tagliati.length, primi(tagliati, 4));
  });

  await browser.close();
  const nonCercati = errori.filter(e => !/ERR_BLOCKED|net::|Failed to load resource|tile\.openstreetmap/.test(e));
  ok('nessun errore in pagina durante le prove', !nonCercati.length, primi([...new Set(nonCercati)]));
  console.log('\nLA NAVIGAZIONE (Layout 2)\n' + r.join('\n'));
  const passati = r.filter(x => x.startsWith('  OK')).length;
  console.log(`\n${passati}/${r.length} passati`);
  process.exit(passati === r.length ? 0 : 1);
})();
