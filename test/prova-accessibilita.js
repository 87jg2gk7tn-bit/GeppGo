/* ACCESSIBILITÀ (miglioria 11).

   1. i testi del Premium sono tradotti in tutte e cinque le lingue, e le
      migliaia seguono la lingua: in spagnolo e portoghese «1234 €» senza
      separatore, «12.345 €» e «12 345 €» col loro;
   2. axe-core su tutte le schermate e le finestre di MAPPA_APP, nei due
      temi: nessuna violazione grave o critica. E in più quello che axe non
      vede: ogni tasto ha un nome che si legge (non solo un simbolo), ogni
      riquadro che si tocca è un tasto per VoiceOver, ci sono le zone main e
      nav;
   3. tutte le coppie testo/fondo a 4,5:1 (3:1 il testo grande, i simboli e
      i bordi dei campi), nei due temi: --ink-faint sul panna e sul bianco, il
      testo sui tasti oro, e ogni altra coppia trovata a schermo. Sui fondi
      sfumati o con un'immagine (il cielo della Home) si guardano i pixel
      veri, col testo nascosto;
   4. nessun elemento toccabile sotto i 44×44 px, da 320 a 430 px: si tocca
      come un dito, in nove punti intorno al centro;
   5. l'attributo lang della pagina segue la lingua dell'app;
   6. aprendo un foglio il fuoco ci entra, chiudendolo torna al tasto che
      l'aveva aperto (con la ✕, con Esc, toccando fuori, scegliendo da una
      tendina); i fogli sono finestre con un nome; Tab gira dentro il foglio,
      Invio e spazio aprono un riquadro-tasto;
   7. i messaggi in basso durano in base alla lunghezza (2,6 s, poi 60 ms per
      carattere, al massimo 8 s), si chiudono con un tocco, VoiceOver li
      legge, non coprono i tasti principali e si leggono nei due temi;
   8. con «Riduci movimento» acceso sul telefono animazioni e transizioni
      sono ridotte al minimo, comprese quelle fatte da JavaScript;
   9. niente testi troncati o sovrapposti da 320 a 430 px, in cinque lingue.

   `node test/prova-accessibilita.js 2 3` fa solo le prove 2 e 3.

   axe-core sta solo qui, fra le dipendenze delle prove: nell'app non entra.

   TRE SCELTE DA SAPERE.
   - Il nome «GeppGo» scritto accanto al logo non conta per il contrasto: è
     il logo, e WCAG non chiede contrasto alle scritte di un logo («Go» è
     nel colore del marchio, e il marchio non si tocca).
   - Una scheda con dentro altri tasti (la spesa col suo ✎, il biglietto coi
     suoi chip) non può essere un tasto: un tasto dentro un tasto VoiceOver
     non lo legge. Il suo tocco resta per il dito, e la prova controlla che
     lo stesso lo faccia un tasto vero lì dentro.
   - Dentro le mappe si misurano i tasti dello zoom, non i segnaposto (sono
     disegni sulla mappa, e ripetono tappe e alberghi che hanno i loro tasti
     negli elenchi) né la parola «Leaflet» nella scritta dei diritti. Le
     mappe girano con Leaflet e il suo foglio di stile serviti in locale,
     come sul telefono: senza il foglio, i controlli non stanno nei loro
     angoli e la scritta che copriva il 🧭 qui non si vedeva. */
const fs = require('fs');
const path = require('path');
const { apriBrowser, RADICE } = require('./browser');
const { PASSI, PRINCIPALI, MISURA, NOMI, apriPagina, giro } = require('./schermate');

const r = [];
const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);
const errori = [];
const SCELTE = process.argv.slice(2).filter(a => /^\d$/.test(a));
const fare = n => !SCELTE.length || SCELTE.includes(String(n));
const prova = async (nome, fn) => { try { await fn(); } catch (e) { ok(nome, false, 'si è fermata: ' + e.message.split('\n')[0]); } };
const LINGUE = ['it', 'en', 'es', 'fr', 'pt'];
const HTML = fs.readFileSync(path.join(RADICE, 'Index 2.1.html'), 'utf8');
const AXE = require.resolve('axe-core/axe.min.js');
/* I caratteri invisibili si scrivono col loro numero: dentro il file non si
   vedrebbero, e chi lo legge non saprebbe che ci sono. */
const SPAZI_FISSI = new RegExp('[' + String.fromCharCode(0xA0, 0x202F) + ']', 'g');
const UNIONI_EMOJI = String.fromCharCode(0xFE0F, 0x200D);
const piano = s => String(s).replace(SPAZI_FISSI, ' ').replace(/\s+/g, ' ').trim();
const primi = (lista, n = 4) => lista.length ? `${lista.length}: ` + lista.slice(0, n).join(' | ') : '';

/* ── le misure dentro la pagina ────────────────────────────────────────────
   Una schermata alla volta, nello strato che si vede: la finestra aperta più
   in alto, o la Time Table, o la pagina con la testata e la barra, o la
   presentazione e l'accesso, che stanno sopra a tutto. */
const MISURA_A11Y = unioni => {
  const out = { testi: [], incerti: [], bordi: [], senzaNome: [], soloSimbolo: [], senzaRuolo: [], visti: { testi: 0, tasti: 0, campi: 0 } };
  const nome = el => (el.id ? '#' + el.id : (typeof el.className === 'string' && el.className.trim() ? el.tagName.toLowerCase() + '.' + el.className.trim().split(/\s+/)[0] : el.tagName.toLowerCase())) +
    ' «' + (el.innerText || el.textContent || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').replace(/\s+/g, ' ').trim().slice(0, 28) + '»';
  const aperti = [...document.querySelectorAll('.modal.active')];
  aperti.sort((a, b) => (parseInt(getComputedStyle(a).zIndex, 10) || 0) - (parseInt(getComputedStyle(b).zIndex, 10) || 0));
  const dayAperta = document.querySelector('#mDay.active');
  const sopra = ['intro', 'authGate'].map(id => document.getElementById(id)).find(el => el && getComputedStyle(el).display !== 'none');
  const radici = sopra ? [sopra] : aperti.length ? [aperti[aperti.length - 1]] : dayAperta ? [dayAperta]
    : [document.querySelector('.topbar'), document.querySelector('.page.active'), document.querySelector('.nav')].filter(Boolean);
  /* Visibile: mostrato, e non tagliato via del tutto da chi nasconde quello
     che esce (una sezione chiusa è alta zero con overflow hidden; dentro un
     <details> chiuso le cose hanno un riquadro ma non si vedono). Chi scorre
     non taglia: quello che sta fuori si raggiunge scorrendo. */
  const visibile = el => {
    if (!el.getClientRects().length) return false;
    if (el.checkVisibility && !el.checkVisibility({ contentVisibilityAuto: true })) return false;
    const q = el.getBoundingClientRect();
    let L = q.left, T = q.top, R = q.right, B = q.bottom;
    for (let x = el; x && x !== document.documentElement; x = x.parentElement) {
      const c = getComputedStyle(x);
      if (c.display === 'none' || c.visibility === 'hidden' || parseFloat(c.opacity) < 0.05) return false;
      if (x !== el && (c.overflowX === 'hidden' || c.overflowX === 'clip' || c.overflowY === 'hidden' || c.overflowY === 'clip')) {
        const b = x.getBoundingClientRect();
        if (c.overflowX === 'hidden' || c.overflowX === 'clip') { L = Math.max(L, b.left); R = Math.min(R, b.right); }
        if (c.overflowY === 'hidden' || c.overflowY === 'clip') { T = Math.max(T, b.top); B = Math.min(B, b.bottom); }
        if (R - L < 1 || B - T < 1) return false;
      }
    }
    return true;
  };
  /* ── i colori ── */
  const parse = s => {
    if (!s || s === 'transparent') return [0, 0, 0, 0];
    const m = /rgba?\(([^)]+)\)/.exec(s); if (!m) return null;
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(x => x.endsWith('%') ? parseFloat(x) / 100 : Number(x));
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  };
  const mescola = (su, sotto) => [0, 1, 2].map(i => su[i] * su[3] + sotto[i] * (1 - su[3]));
  const lum = c => { const f = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const rapporto = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const hex = c => '#' + c.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
  /* Uno strato con una sfumatura dipinge davvero dove sta il testo? Una
     sfumatura alta 440 px senza ripetizione non tocca quello che sta sotto:
     lì conta il colore che c'è dietro. */
  const dipinge = (a, c, y) => {
    if (y == null || !/no-repeat|repeat-x/.test(c.backgroundRepeat)) return true;
    const alto = c.backgroundSize.split(' ')[1] || '';
    if (!/px$/.test(alto)) return true;
    const da = a.getBoundingClientRect().top + (parseFloat(c.backgroundPositionY) || 0);
    return y >= da - 1 && y <= da + parseFloat(alto) + 1;
  };
  /* Il fondo salendo dai genitori, colori pieni e trasparenti composti uno
     sull'altro. Una sfumatura, un'immagine o un ::before/::after che dipinge
     lo rendono incerto: lì si guardano i pixel veri. */
  const fondoDi = (el, y) => {
    const strati = [];
    for (let a = el; a; a = a.parentElement) {
      const c = getComputedStyle(a);
      if (c.backgroundImage && c.backgroundImage !== 'none' && dipinge(a, c, y)) return { incerto: 'sfumatura o immagine su ' + nome(a) };
      for (const ps of ['::before', '::after']) {
        const p = getComputedStyle(a, ps);
        if (p.content && p.content !== 'none' && p.content !== 'normal' && ((p.backgroundImage && p.backgroundImage !== 'none') || (parse(p.backgroundColor) || [0, 0, 0, 0])[3] > 0.02) && (p.position === 'absolute' || p.position === 'fixed'))
          return { incerto: ps + ' di ' + nome(a) };
      }
      const bg = parse(c.backgroundColor);
      if (bg && bg[3] > 0) { strati.push(bg); if (bg[3] >= 0.995) break; }
      if (!a.parentElement) strati.push([255, 255, 255, 1]);
    }
    let col = strati[strati.length - 1].slice(0, 3);
    for (let i = strati.length - 2; i >= 0; i--) col = mescola(strati[i], col);
    return { colore: col };
  };
  const opacita = el => { let o = 1; for (let x = el; x && x !== document.documentElement; x = x.parentElement) o *= parseFloat(getComputedStyle(x).opacity); return o; };
  /* il nome GeppGo accanto al logo: è il logo (vedi in cima) */
  const marchio = el => !!el.closest('.brand-name,.auth-brand [translate="no"],.bootSplash-name');
  /* un tasto spento non deve farsi leggere come uno acceso (WCAG lo esclude) */
  const spento = el => !!el.closest('button:disabled,input:disabled,select:disabled,textarea:disabled,fieldset:disabled,[aria-disabled="true"]');
  const conSegni = new RegExp('[^\\s\\p{Extended_Pictographic}' + unioni + ']', 'u');
  window.__inc = [];
  radici.forEach(rad => {
    const w = document.createTreeWalker(rad, NodeFilter.SHOW_TEXT, { acceptNode: t => {
      const p = t.parentElement;
      if (!p || p.closest('.leaflet-container,script,style,select,option,textarea')) return NodeFilter.FILTER_REJECT;
      /* le emoji sono disegni a colori, non testo: il contrasto non le riguarda */
      return /[\p{L}\p{N}]/u.test(t.data) || conSegni.test(t.data.trim()) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT; } });
    let t;
    while ((t = w.nextNode())) {
      const p = t.parentElement;
      if (!visibile(p) || marchio(p) || spento(p)) continue;
      const rg = document.createRange(); rg.selectNodeContents(t);
      const rr = [...rg.getClientRects()].filter(q => q.width > 0.5 && q.height > 0.5);
      if (!rr.length) continue;
      const cs = getComputedStyle(p);
      const fg = parse(cs.webkitTextFillColor && cs.webkitTextFillColor !== cs.color && !/0\)$/.test(cs.webkitTextFillColor) ? cs.webkitTextFillColor : cs.color);
      if (!fg) continue;
      fg[3] *= opacita(p);
      const px = parseFloat(cs.fontSize), peso = parseInt(cs.fontWeight, 10) || 400;
      const lettere = /[\p{L}\p{N}]/u.test(t.data);
      /* testo grande per WCAG: 24 px, o 18,66 in grassetto */
      const grande = px >= 24 || (px >= 18.66 && peso >= 700);
      const soglia = lettere ? (grande ? 3 : 4.5) : 3;
      out.visti.testi++;
      const f = fondoDi(p, (rr[0].top + rr[0].bottom) / 2);
      const voce = { chi: nome(p), testo: t.data.replace(/\s+/g, ' ').trim().slice(0, 40), fg: hex(fg) + (fg[3] < 0.99 ? '/' + fg[3].toFixed(2) : ''), soglia };
      if (f.incerto) { window.__inc.push(t); out.incerti.push(Object.assign(voce, { fgRgba: fg })); continue; }
      const r = rapporto(mescola(fg, f.colore), f.colore);
      if (r + 0.005 < soglia) out.testi.push(Object.assign(voce, { bg: hex(f.colore), r: Math.round(r * 100) / 100 }));
    }
  });
  /* i segnaposto dei campi vuoti */
  radici.forEach(rad => rad.querySelectorAll('input[placeholder],textarea[placeholder]').forEach(el => {
    if (el.value || !visibile(el) || spento(el)) return;
    const fg = parse(getComputedStyle(el, '::placeholder').color); if (!fg) return;
    const f = fondoDi(el); if (f.incerto) return;
    out.visti.testi++;
    const r = rapporto(mescola(fg, f.colore), f.colore);
    if (r + 0.005 < 4.5) out.testi.push({ chi: nome(el) + ' (segnaposto)', testo: el.placeholder.slice(0, 40), fg: hex(fg), bg: hex(f.colore), r: Math.round(r * 100) / 100, soglia: 4.5 });
  }));
  /* i bordi dei campi: 3:1 con quello che c'è intorno (o il fondo del campo,
     se è lui a staccarsi). Conta il lato migliore: un campo con la sola riga
     sotto (l'importo della spesa) si riconosce da quella. */
  radici.forEach(rad => rad.querySelectorAll('input:not([type=hidden]),select,textarea').forEach(el => {
    if (!visibile(el) || spento(el)) return;
    const cs = getComputedStyle(el);
    if (['checkbox', 'radio'].includes(el.type) && cs.appearance !== 'none') return;   // li disegna il telefono
    if (['range', 'file', 'color'].includes(el.type) || parseFloat(cs.opacity) < 0.05 || el.getBoundingClientRect().width < 2) return;
    out.visti.campi++;
    const fuori = fondoDi(el.parentElement);
    if (fuori.incerto) return;
    let bordo = parse(cs.borderTopColor), rb = 1;
    for (const lato of ['Top', 'Right', 'Bottom', 'Left']) {
      const col = parse(cs['border' + lato + 'Color']);
      if (!(parseFloat(cs['border' + lato + 'Width']) > 0) || !col || !(col[3] > 0)) continue;
      const x = rapporto(mescola(col, fuori.colore), fuori.colore);
      if (x > rb) { rb = x; bordo = col; }
    }
    const dentro = parse(cs.backgroundColor);
    const rf = dentro && dentro[3] > 0 ? rapporto(mescola(dentro, fuori.colore), fuori.colore) : 1;
    if (Math.max(rb, rf) + 0.005 < 3) out.bordi.push({ chi: nome(el), bordo: hex(bordo), fuori: hex(fuori.colore), r: Math.round(Math.max(rb, rf) * 100) / 100 });
  }));
  /* ── i tasti: come si chiamano, e se VoiceOver sa che sono tasti ── */
  const SEL = 'button,a[href],input:not([type=hidden]),select,textarea,summary,[onclick],[role=button],[role=link],[role=tab],[role=switch],[role=checkbox],[role=radio],[role=menuitem],[role=option],[tabindex]:not([tabindex="-1"]),label';
  const pulita = x => (x.getAttribute('onclick') || '').replace(/^\s*event\.stopPropagation\(\);?\s*/, '').trim();
  const tasti = [];
  radici.forEach(rad => rad.querySelectorAll(SEL).forEach(el => {
    if (tasti.includes(el) || !visibile(el) || spento(el)) return;
    /* Della mappa contano i tasti dello zoom. Il riquadro della mappa non è
       un tasto (Leaflet gli dà il tabindex per le frecce della tastiera); i
       segnaposto e i loro fumetti ripetono tappe e alberghi che hanno già i
       loro tasti negli elenchi; «Leaflet» è una parola dentro la scritta dei
       diritti. */
    if (el.matches('.leaflet-container') || el.closest('.leaflet-marker-pane,.leaflet-popup-pane,.leaflet-control-attribution')) return;
    /* un'etichetta è un tasto quando accende una spunta o sceglie un file */
    if (el.tagName === 'LABEL' && !el.hasAttribute('onclick') && !(el.control && ['checkbox', 'radio', 'file'].includes(el.control.type))) return;
    /* un onclick che ferma soltanto il tocco (la maniglia che allunga una tappa) non è un tasto */
    if (el.hasAttribute('onclick') && !pulita(el) && !el.matches('button,a,input,select,textarea,label')) return;
    /* un campo dentro la sua etichetta: si tocca l'etichetta */
    if (el.matches('input,select,textarea') && el.closest('label')) return;
    if (parseFloat(getComputedStyle(el).opacity) < 0.05) return;
    tasti.push(el);
  }));
  out.visti.tasti = tasti.length;
  window.__tasti = tasti;
  const RUOLI = /^(button|link|tab|switch|checkbox|radio|menuitem|menuitemcheckbox|menuitemradio|option|slider|textbox|combobox|searchbox|spinbutton|treeitem|gridcell)$/;
  const nativo = el => el.matches('button,a[href],input,select,textarea,label,summary,option,details');
  /* Il nome come lo calcola un lettore di schermo, in breve: aria-label,
     aria-labelledby, l'etichetta del campo, il testo (senza quello nascosto),
     e il title per ultimo. */
  const nomeAcc = el => {
    const lab = (el.getAttribute('aria-label') || '').trim(); if (lab) return lab;
    const lb = el.getAttribute('aria-labelledby'); if (lb) { const x = lb.split(/\s+/).map(id => (document.getElementById(id) || {}).textContent || '').join(' ').replace(/\s+/g, ' ').trim(); if (x) return x; }
    if (el.matches('input,select,textarea')) {
      if (el.labels && el.labels.length) { const x = [...el.labels].map(l => l.textContent).join(' ').replace(/\s+/g, ' ').trim(); if (x) return x; }
      if (['button', 'submit', 'reset'].includes(el.type)) return el.value || '';
      return (el.getAttribute('placeholder') || el.getAttribute('title') || '').trim();
    }
    const dalTesto = n => {
      if (n.nodeType === 3) return n.data; if (n.nodeType !== 1) return '';
      if (n.getAttribute('aria-hidden') === 'true') return '';
      const c = getComputedStyle(n); if (c.display === 'none' || c.visibility === 'hidden') return '';
      if (n !== el && n.getAttribute('aria-label')) return ' ' + n.getAttribute('aria-label') + ' ';
      if (n.tagName === 'IMG') return n.getAttribute('alt') || '';
      if (n.tagName.toLowerCase() === 'svg') { const ti = n.querySelector('title'); return ti ? ti.textContent : ''; }
      return [...n.childNodes].map(dalTesto).join('') + (/^(block|flex|grid|list-item)/.test(c.display) ? ' ' : '');
    };
    const x = dalTesto(el).replace(/\s+/g, ' ').trim(); if (x) return x;
    return (el.getAttribute('title') || '').trim();
  };
  tasti.forEach(el => {
    const n = nomeAcc(el);
    if (!n) out.senzaNome.push(nome(el));
    else if (!/\p{L}/u.test(n)) out.soloSimbolo.push(nome(el) + ' = «' + n.slice(0, 12) + '»');
    /* una scheda con dentro un tasto vero che fa la stessa cosa: il suo
       tocco è una comodità per il dito (vedi in cima) */
    const doppione = el.hasAttribute('onclick') && [...el.querySelectorAll('button,[role=button]')].some(x => pulita(x) && pulita(x) === pulita(el));
    if (!doppione && !nativo(el) && !RUOLI.test(el.getAttribute('role') || '')) out.senzaRuolo.push(nome(el) + (el.hasAttribute('tabindex') ? '' : ' (senza tabindex)'));
    else if (!nativo(el) && !doppione && el.getAttribute('tabindex') === null) out.senzaRuolo.push(nome(el) + ' (la tastiera non ci arriva)');
  });
  /* chi ha la manina senza essere un tasto: il dito ci prova, VoiceOver no */
  radici.forEach(rad => rad.querySelectorAll('*').forEach(el => {
    if (tasti.includes(el) || nativo(el) || el.closest('.leaflet-container') || el.getAttribute('aria-hidden') === 'true') return;
    if (RUOLI.test(el.getAttribute('role') || '')) return;
    if (getComputedStyle(el).cursor !== 'pointer') return;
    if (el.parentElement && getComputedStyle(el.parentElement).cursor === 'pointer') return;
    if (!visibile(el)) return;
    out.senzaRuolo.push(nome(el) + ' (manina, senza onclick)');
  }));
  return out;
};

/* La prova del dito sui tasti trovati da MISURA_A11Y: nove punti a 21 px
   dal centro (15 in diagonale) devono rispondere a lui. Fa scorrere per
   portarli a schermo, e alla fine rimette ogni cosa dov'era. Due tasti
   vicini che fanno la stessa cosa (l'occhiello e la città in Home) non si
   sbagliano: toccare l'uno o l'altro è uguale. */
const TOCCHI_A11Y = () => {
  const W = innerWidth, H = innerHeight, piccoli = [];
  const nome = el => (el.id ? '#' + el.id : (typeof el.className === 'string' && el.className.trim() ? el.tagName.toLowerCase() + '.' + el.className.trim().split(/\s+/)[0] : el.tagName.toLowerCase())) +
    ' «' + (el.innerText || el.textContent || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').replace(/\s+/g, ' ').trim().slice(0, 28) + '»';
  const scorrevoli = [...document.querySelectorAll('*')].filter(x => x.scrollTop || x.scrollLeft).map(x => [x, x.scrollTop, x.scrollLeft]);
  const wy = scrollY, wx = scrollX;
  const azione = e => { for (let a = e; a && a.getAttribute; a = a.parentElement) { const o = (a.getAttribute('onclick') || '').replace(/^\s*event\.stopPropagation\(\);?\s*/, '').trim(); if (o) return o; } return null; };
  const quadrato = el => {
    const q = el.getBoundingClientRect(), cx = q.left + q.width / 2, cy = q.top + q.height / 2, male = [];
    const mia = azione(el);
    for (const [dx, dy] of [[0, 0], [-21, 0], [21, 0], [0, -21], [0, 21], [-15, -15], [15, -15], [-15, 15], [15, 15]]) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || x > W || y < 0 || y > H) { male.push(`${dx},${dy} fuori dallo schermo`); continue; }
      const h = document.elementFromPoint(x, y);
      if (!h || (h !== el && !el.contains(h) && !(mia && azione(h) === mia))) male.push(`${dx},${dy} → ${h ? nome(h).slice(0, 40) : 'niente'}`);
    }
    return male;
  };
  (window.__tasti || []).forEach(el => {
    if (!el.isConnected) return;
    /* la tendina vera sta sotto un velo che prende il tocco: si misura il velo */
    const bersaglio = el.matches('select') && el.dataset.bsWired && el.parentElement ? el.parentElement : el;
    try { bersaglio.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }); } catch (e) {}
    const male = quadrato(bersaglio);
    if (male.length) { const q = bersaglio.getBoundingClientRect(); piccoli.push(`${nome(el)} ${Math.round(q.width)}×${Math.round(q.height)} (${male.slice(0, 2).join('; ')})`); }
  });
  scorrevoli.forEach(([x, t, l]) => { x.scrollTop = t; x.scrollLeft = l; });
  window.scrollTo(wx, wy);
  return piccoli;
};

/* I testi sui fondi sfumati (il cielo della Home, i tasti oro): si fotografa
   la schermata col testo reso trasparente, e si legge il colore vero sotto
   ogni riga. Le emoji si saltano: non sono testo. */
const NASCONDI = '*,*::before,*::after{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;caret-color:transparent!important;transition:none!important;animation-play-state:paused!important}::placeholder{color:transparent!important}.cl-lampo,.cl-saetta{opacity:0!important;animation:none!important}';
const RETT = fatti => window.__inc.map((t, i) => {
  if (fatti[i] || !t.isConnected) return null;
  const rg = document.createRange(); rg.selectNodeContents(t);
  const rr = [...rg.getClientRects()].filter(q => q.width > 0.5 && q.height > 0.5);
  /* a schermo davvero: dentro lo schermo e dentro ogni contenitore che taglia o scorre */
  let L = 0, T = 0, R = innerWidth, B = innerHeight;
  for (let x = t.parentElement; x && x !== document.documentElement; x = x.parentElement) {
    const c = getComputedStyle(x);
    if (c.overflowX === 'visible' && c.overflowY === 'visible') continue;
    const b = x.getBoundingClientRect();
    if (c.overflowX !== 'visible') { L = Math.max(L, b.left); R = Math.min(R, b.right); }
    if (c.overflowY !== 'visible') { T = Math.max(T, b.top); B = Math.min(B, b.bottom); }
  }
  /* e non coperto da altro (la barra in basso galleggia sopra la pagina) */
  const scoperto = q => [0.25, 0.5, 0.75].every(f => { const h = document.elementFromPoint(q.left + (q.right - q.left) * f, (q.top + q.bottom) / 2); return h && (h === t.parentElement || t.parentElement.contains(h) || h.contains(t.parentElement)); });
  const dentro = rr.filter(q => q.top >= T - 0.5 && q.bottom <= B + 0.5 && q.left >= L - 0.5 && q.right <= R + 0.5 && scoperto(q));
  if (!dentro.length) return null;
  const emoji = [];
  for (const m of t.data.matchAll(/\p{Extended_Pictographic}/gu)) { const r2 = document.createRange(); r2.setStart(t, m.index); r2.setEnd(t, m.index + m[0].length); emoji.push(...[...r2.getClientRects()].map(q => ({ l: q.left, t: q.top, r: q.right, b: q.bottom }))); }
  return { rett: dentro.map(q => ({ l: q.left, t: q.top, r: q.right, b: q.bottom })), emoji };
});
const PIXEL = async ([b64, voci]) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
  const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
  const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
  const k = img.naturalWidth / innerWidth;
  const lum = c => { const f = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const rapporto = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const mescola = (su, sotto) => [0, 1, 2].map(i => su[i] * su[3] + sotto[i] * (1 - su[3]));
  const hex = c => '#' + c.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
  return voci.map(it => {
    let min = Infinity, peggio = null, n = 0;
    for (const q of it.rett) {
      if (q.t < -0.5 || q.b > innerHeight + 0.5 || q.l < -0.5 || q.r > innerWidth + 0.5) continue;
      for (let i = 1; i <= 5; i++) for (let j = 1; j <= 3; j++) {
        const x = q.l + (q.r - q.l) * i / 6, y = q.t + (q.b - q.t) * j / 4;
        if (it.emoji.some(e => x >= e.l - 1 && x <= e.r + 1 && y >= e.t - 1 && y <= e.b + 1)) continue;
        const d = g.getImageData(Math.min(cv.width - 1, Math.round(x * k)), Math.min(cv.height - 1, Math.round(y * k)), 1, 1).data;
        const bg = [d[0], d[1], d[2]];
        const r = rapporto(mescola(it.fgRgba, bg), bg);
        n++; if (r < min) { min = r; peggio = bg; }
      }
    }
    return { n, r: n ? Math.round(min * 100) / 100 : null, bg: peggio ? hex(peggio) : null };
  });
};
const SALVA = () => { window.__scorre = [...document.querySelectorAll('*')].filter(x => x.scrollTop || x.scrollLeft).map(x => [x, x.scrollTop, x.scrollLeft]); window.__wy = scrollY; };
const RIMETTI = () => { document.querySelectorAll('*').forEach(x => { if (x.scrollTop) x.scrollTop = 0; }); (window.__scorre || []).forEach(([x, t, l]) => { x.scrollTop = t; x.scrollLeft = l; }); window.scrollTo(0, window.__wy || 0); };

/* axe-core sullo strato che si vede. Il nome GeppGo accanto al logo resta
   fuori (vedi in cima). */
const AXE_STRATO = async () => {
  const aperti = [...document.querySelectorAll('.modal.active')];
  aperti.sort((a, b) => (parseInt(getComputedStyle(a).zIndex, 10) || 0) - (parseInt(getComputedStyle(b).zIndex, 10) || 0));
  const dayAperta = document.querySelector('#mDay.active');
  const sopra = ['intro', 'authGate'].map(id => document.getElementById(id)).find(el => el && getComputedStyle(el).display !== 'none');
  const radici = sopra ? [sopra] : aperti.length ? [aperti[aperti.length - 1]] : dayAperta ? [dayAperta]
    : [document.querySelector('.topbar'), document.querySelector('.page.active'), document.querySelector('.nav')].filter(Boolean);
  const res = await axe.run({ include: radici, exclude: ['.brand-name', '.auth-brand [translate="no"]', '.bootSplash-name'] }, { resultTypes: ['violations'] });
  return res.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')
    .map(v => `${v.impact} ${v.id}: ${v.nodes.slice(0, 2).map(n => n.target.join(' ')).join(', ')}`);
};

/* Una schermata misurata come serve: axe, contrasto (coi pixel veri dove il
   fondo è sfumato), nomi e ruoli, e la prova del dito. I messaggi in basso
   passano: si misura quello che resta (la prova 7 guarda loro). */
async function misura(page, { axe = true, contrasto = true, tocchi = true }) {
  if (axe && !page._axe) { await page.addScriptTag({ path: AXE }); page._axe = true; }
  await page.evaluate(() => {
    document.getAnimations().forEach(x => { try { x.finish(); } catch (e) {} });
    /* e quelli che arrivano dopo (il suggerimento «scorri con un dito»
       della Time Table) non arrivano proprio, finché si misura */
    document.querySelectorAll('.toast').forEach(x => x.remove());
    if (!window.__zitto) { window.__zitto = true; window.toast = () => {}; }
    window.scrollTo(0, 0);
  });
  await page.evaluate(SALVA);
  const m = await page.evaluate(MISURA_A11Y, UNIONI_EMOJI);
  if (contrasto && m.incerti.length) {
    const esiti = new Array(m.incerti.length).fill(null);
    for (let volta = 0; volta < 8; volta++) {
      const rett = await page.evaluate(RETT, esiti.map(Boolean));
      const qui = rett.map((q, i) => q ? Object.assign({ i, fgRgba: m.incerti[i].fgRgba }, q) : null).filter(Boolean);
      if (qui.length) {
        const st = await page.addStyleTag({ content: NASCONDI });
        await page.waitForTimeout(30);
        const png = await page.screenshot({ type: 'png' });
        const px = await page.evaluate(PIXEL, [png.toString('base64'), qui]);
        await st.evaluate(e => e.remove());
        qui.forEach((q, k) => { esiti[q.i] = px[k]; });
      }
      const resta = esiti.findIndex(x => !x);
      if (resta < 0) break;
      /* quelli fuori dallo schermo si portano a schermo, uno alla volta */
      await page.evaluate(i => { const t = window.__inc[i]; if (t && t.parentElement) t.parentElement.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }); }, resta);
      await page.waitForTimeout(40);
      const ancora = await page.evaluate(RETT, esiti.map((x, i) => !!x || i !== resta));
      if (!ancora[resta]) esiti[resta] = { n: 0 };
    }
    /* Una seconda occhiata ai bocciati, a schermata ferma: nel giro un
       foglio può essere ancora a metà della salita quando si fotografa. */
    const bocciati = m.incerti.map((it, i) => (esiti[i] && esiti[i].n && esiti[i].r + 0.005 < it.soglia) ? i : -1).filter(i => i >= 0);
    for (const i of bocciati) {
      await page.evaluate(i => { const t = window.__inc[i]; if (t && t.parentElement) t.parentElement.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }); }, i);
      await page.waitForTimeout(400);
      await page.evaluate(() => document.getAnimations().forEach(x => { try { x.finish(); } catch (e) {} }));
      const rett = await page.evaluate(RETT, esiti.map((x, k) => k !== i));
      if (!rett[i]) continue;
      const st = await page.addStyleTag({ content: NASCONDI });
      await page.waitForTimeout(30);
      const png = await page.screenshot({ type: 'png' });
      const [px] = await page.evaluate(PIXEL, [png.toString('base64'), [Object.assign({ i, fgRgba: m.incerti[i].fgRgba }, rett[i])]]);
      await st.evaluate(e => e.remove());
      if (px && px.n) esiti[i] = px;
    }
    await page.evaluate(RIMETTI);
    m.incerti.forEach((it, i) => { const p = esiti[i]; if (p && p.n && p.r + 0.005 < it.soglia) m.testi.push({ chi: it.chi, testo: it.testo, fg: it.fg, bg: p.bg + ' (pixel)', r: p.r, soglia: it.soglia }); });
  }
  m.axe = axe ? await page.evaluate(AXE_STRATO) : [];
  m.piccoli = tocchi ? await page.evaluate(TOCCHI_A11Y) : [];
  delete m.incerti;
  return m;
}

/* I conti dei colori in Node, per le coppie scritte nel foglio di stile. */
const hexRgb = h => { const x = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(x.slice(i, i + 2), 16)); };
const lumN = c => { const f = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const contrasto = (a, b) => { const x = lumN(hexRgb(a)), y = lumN(hexRgb(b)); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const virgola = n => n.toFixed(2).replace('.', ',');

/* Le misure servono anche a chi guarda una schermata sola mentre la
   sistema: require('./prova-accessibilita').misura(page, {...}). */
module.exports = { MISURA_A11Y, TOCCHI_A11Y, misura };

if (require.main === module) (async () => {
  const browser = await apriBrowser();

  /* ── 1. il Premium tradotto, e le migliaia ────────────────────────────── */
  if (fare(1)) await prova('1', async () => {
    /* Le frasi del Premium (miglioria 10 le aveva lasciate in italiano: «non
       toccare il Premium» voleva dire come funziona, non le parole). Si
       portano a schermo tutte - il foglio gratis e Premium, il Profilo
       gratis e Premium, il messaggio del cambio di piano, l'avviso
       «eliminare è del Premium» - e si legge quello che si vede. */
    const PREMIUM = ['Sei Premium ✨', 'Hai raggiunto 2 viaggi tuoi attivi', 'Viaggi illimitati, niente pubblicità e avvisi GPS su tutti i viaggi in corso.',
      'Il piano gratuito include 2 viaggi creati da te alla volta - quelli in cui ti hanno invitato non contano e sono senza limite. Concludi un viaggio da "I tuoi viaggi" oppure passa a Premium.',
      'Torna al piano Gratis (demo)', '✨ Premium attivo', 'Piano Gratis', 'Viaggi illimitati · niente pubblicità', 'Gestisci piano', 'Eliminare è del Premium',
      'Nel piano gratuito i viaggi si concludono invece di eliminarli: restano tra i viaggi conclusi e liberano il posto. Vuoi concluderlo adesso?'];
    const male = [], soldi = [];
    for (const l of LINGUE) {
      const p = await apriPagina(browser, { lingua: l, errori });
      const v = await p.evaluate(async PREMIUM => {
        const frame = () => new Promise(ok => requestAnimationFrame(() => requestAnimationFrame(ok)));
        const visto = [];
        const leggi = async () => { await frame(); visto.push(document.body.innerText); };
        /* Porto diventa un viaggio suo: con due viaggi il foglio dice «hai raggiunto 2 viaggi» */
        delete app.trips.find(x => x.id === 2)._admin;
        openPremium(); await leggi(); closeSheet('mPremium');
        togglePremium(); await leggi();                          // Premium acceso, e il messaggio
        openPremium(); await leggi(); closeSheet('mPremium');
        go('trips'); await leggi();
        togglePremium(); await leggi();                          // di nuovo gratis
        go('trips'); await leggi(); go('plan');
        premiumNienteElimina(T()); await leggi(); closeSheet('mConfirm');
        visto.push((document.getElementById('annunci') || {}).textContent || '');
        return {
          visto: visto.join('\n'),
          tradotte: Object.fromEntries(PREMIUM.map(f => [f, (DIZIONARIO[linguaScelta()] || {})[f] || ''])),
          soldi: [fmtMoney(1234, 'EUR'), fmtMoney(12345, 'EUR'), fmtMoney(1234.5, 'EUR'), fmtMoney(12345.5, 'EUR')]
        };
      }, PREMIUM);
      await p.close();
      const visto = piano(v.visto);
      for (const f of PREMIUM) {
        if (l === 'it') { if (!visto.includes(piano(f))) male.push(`it: non si vede «${f.slice(0, 30)}»`); continue; }
        const tr = v.tradotte[f];
        if (!tr || tr === f) { male.push(`${l}: «${f.slice(0, 30)}» senza traduzione`); continue; }
        if (!visto.includes(piano(tr))) male.push(`${l}: non si vede «${tr.slice(0, 30)}»`);
        if (visto.includes(piano(f))) male.push(`${l}: a schermo resta «${f.slice(0, 30)}»`);
      }
      soldi.push([l, v.soldi.map(piano)]);
    }
    ok('1. i testi del Premium si vedono tradotti in tutte e cinque le lingue (foglio, Profilo, messaggi, «eliminare è del Premium»)', !male.length,
      primi(male) || `${PREMIUM.length} frasi × 4 lingue, nessuna rimasta in italiano`);
    const S = Object.fromEntries(soldi);
    const giusti = l => ({ es: ['1234,00 €', '12.345,00 €', '1234,50 €', '12.345,50 €'], pt: ['1234,00 €', '12 345,00 €', '1234,50 €', '12 345,50 €'] })[l];
    const eccoli = ['es', 'pt'].filter(l => JSON.stringify(S[l]) !== JSON.stringify(giusti(l)));
    ok('1. in spagnolo e portoghese «1234 €» senza separatore, «12.345 €» (es) e «12 345 €» (pt) col loro', !eccoli.length,
      eccoli.map(l => `${l}: ${S[l].join(', ')}`).join(' | ') || `es ${S.es.slice(0, 2).join(', ')} · pt ${S.pt.slice(0, 2).join(', ')}`);
    ok('1. e le altre lingue col loro modo: inglese «€1,234.00», francese «1 234,00 €»', S.en[0] === '€1,234.00' && S.fr[0] === '1 234,00 €', `en ${S.en[0]} · fr ${S.fr[0]} · it ${S.it[0]}`);
  });

  /* ── 2, 3, 4: il giro di tutte le schermate ───────────────────────────── */
  const giri = {}, erroriGiro = [];
  if (fare(2) || fare(3) || fare(4)) {
    /* Nei due temi a 390 px tutto (axe, contrasto, nomi, tocchi); a 320 e
       430 px, nel tema chiaro, la prova del dito, che dipende dalla
       larghezza (i colori no). In parallelo: un giro intero, misurato per
       bene, è lungo. */
    const lavori = [['chiaro', 390, {}], ['scuro', 390, {}], ['chiaro', 320, { axe: false, contrasto: false }], ['chiaro', 430, { axe: false, contrasto: false }]];
    const esiti = await Promise.all(lavori.map(([tema, larghezza, cosa]) => giro(browser, { larghezza, tema, guarda: page => misura(page, cosa) })));
    lavori.forEach(([tema, larghezza], i) => { giri[tema + ' ' + larghezza] = esiti[i]; esiti[i].err.forEach(x => erroriGiro.push(`${tema} ${larghezza}px, ${x}`)); });
  }
  const raccogli = (quali, campo) => {
    const tutti = [];
    quali.forEach(k => Object.entries((giri[k] || {}).esiti || {}).forEach(([dove, m]) => (m ? m[campo] : ['(schermata non misurata)']).forEach(x => tutti.push(`${k}, ${dove}: ${typeof x === 'string' ? x : JSON.stringify(x)}`))));
    return tutti;
  };
  const schermate = k => Object.keys((giri[k] || {}).esiti || {}).length;

  if (fare(2)) await prova('2', async () => {
    const axe = raccogli(['chiaro 390', 'scuro 390'], 'axe');
    ok('2. il giro apre tutte le schermate e le finestre senza che niente si rompa', !erroriGiro.length, primi(erroriGiro));
    ok(`2. axe-core su ${schermate('chiaro 390')} schermate e finestre di MAPPA_APP, nei due temi: nessuna violazione grave o critica`,
      !axe.length && schermate('chiaro 390') >= PASSI.length, primi(axe, 6));
    const tutti = ['chiaro 390', 'scuro 390', 'chiaro 320', 'chiaro 430'];
    const senzaNome = raccogli(tutti, 'senzaNome'), simboli = raccogli(tutti, 'soloSimbolo'), ruoli = raccogli(tutti, 'senzaRuolo');
    const visti = tutti.reduce((s, k) => s + Object.values((giri[k] || {}).esiti || {}).reduce((a, m) => a + (m ? m.visti.tasti : 0), 0), 0);
    ok('2. ogni tasto ha un nome che VoiceOver legge, fatto di parole e non solo di un simbolo (✕, ✎, ‹, 🧭)', !senzaNome.length && !simboli.length,
      primi(senzaNome.concat(simboli)) || `${visti} tasti guardati`);
    ok('2. ogni div o span che si tocca è un tasto per VoiceOver e per la tastiera (role e tabindex), o ha dentro un tasto vero che fa lo stesso', !ruoli.length, primi(ruoli));
    /* E una volta sul documento intero: le regole che guardano la pagina e
       non una schermata (il meta viewport, la lingua, il titolo). Lo zoom con
       due dita era bloccato, e axe sugli strati non poteva accorgersene. */
    const d = await apriPagina(browser, { errori });
    await d.addScriptTag({ path: AXE });
    const documento = await d.evaluate(async () => (await axe.run({ exclude: ['.brand-name', '.auth-brand [translate="no"]', '.bootSplash-name'] }, { resultTypes: ['violations'] }))
      .violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => `${v.impact} ${v.id}: ${v.nodes.slice(0, 2).map(n => n.target.join(' ')).join(', ')}`));
    const zoom = await d.evaluate(() => document.querySelector('meta[name="viewport"]').content);
    await d.close();
    ok('2. e sul documento intero (lo zoom con due dita non è bloccato, la pagina ha lingua e titolo)', !documento.length && !/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(\.0)?\b/.test(zoom),
      primi(documento) || `viewport «${zoom}»`);
    /* le zone, e la barra fatta di tasti veri */
    const p = await apriPagina(browser, { errori });
    const z = await p.evaluate(() => ({
      main: !!document.querySelector('main.scroll .page'), nav: !!document.querySelector('nav.nav .nav-item'), banner: document.querySelector('.topbar').getAttribute('role'),
      voci: [...document.querySelectorAll('.nav-item')].map(x => x.tagName), corrente: (document.querySelector('.nav-item[aria-current="page"]') || { dataset: {} }).dataset.p
    }));
    await p.click('.nav-item[data-p="money"]');
    const dopo = await p.evaluate(() => [...document.querySelectorAll('.nav-item[aria-current="page"]')].map(x => x.dataset.p));
    await p.close();
    ok('2. ci sono le zone main e nav (e la testata), e la barra in basso è fatta di tasti veri che dicono qual è la pagina corrente',
      z.main && z.nav && z.banner === 'banner' && z.voci.every(x => x === 'BUTTON') && z.corrente === 'plan' && JSON.stringify(dopo) === '["money"]',
      `main ${z.main}, nav ${z.nav}, testata ${z.banner}, ${z.voci.length} voci ${[...new Set(z.voci)].join('/')}, corrente: plan → ${dopo.join(',')}`);
  });

  if (fare(3)) await prova('3', async () => {
    /* le coppie del foglio di stile, nei due temi */
    const p = await apriPagina(browser, { errori });
    const leggi = () => p.evaluate(() => {
      const cs = getComputedStyle(document.body), v = n => cs.getPropertyValue(n).trim();
      const b = document.createElement('button'); b.className = 'btn btn-primario'; b.textContent = 'Salva'; document.body.appendChild(b);
      const bc = getComputedStyle(b); const testo = bc.color, sfumatura = bc.backgroundImage; b.remove();
      const rgb = s => '#' + (s.match(/\d+/g) || []).slice(0, 3).map(x => (+x).toString(16).padStart(2, '0')).join('');
      return { faint: v('--ink-faint'), paper: v('--paper'), surface: v('--surface'), testo: rgb(testo), stop: (sfumatura.match(/rgb\([^)]+\)/g) || []).map(rgb) };
    });
    const chiaro = await leggi();
    await p.evaluate(() => document.body.classList.add('dark'));
    const scuro = await leggi();
    await p.close();
    const righe = [], male = [];
    for (const [tema, c] of [['chiaro', chiaro], ['scuro', scuro]]) {
      const a = contrasto(c.faint, c.paper), b = contrasto(c.faint, c.surface);
      righe.push(`${tema}: --ink-faint ${c.faint} ${virgola(a)}:1 sul fondo, ${virgola(b)}:1 sulle schede`);
      if (a < 4.5 || b < 4.5) male.push(tema + ' ink-faint');
      const oro = c.stop.map(s => contrasto(c.testo, s));
      righe.push(`${tema}: tasto oro ${c.testo} su ${c.stop.join('→')} ${oro.map(virgola).join('–')}:1`);
      if (!oro.length || oro.some(x => x < 4.5)) male.push(tema + ' tasto oro');
    }
    ok('3. --ink-faint a 4,5:1 sul panna e sul bianco, e il testo dei tasti oro a 4,5:1, nei due temi', !male.length, righe.join(' · '));
    const testi = raccogli(['chiaro 390', 'scuro 390'], 'testi'), bordi = raccogli(['chiaro 390', 'scuro 390'], 'bordi');
    const n = ['chiaro 390', 'scuro 390'].reduce((s, k) => s + Object.values((giri[k] || {}).esiti || {}).reduce((a, m) => a + (m ? m.visti.testi : 0), 0), 0);
    ok(`3. tutte le coppie testo/fondo a schermo rispettano le soglie (4,5:1, 3:1 il testo grande e i simboli), nei due temi: ${n} testi guardati`, !testi.length && n > 2000, primi(testi));
    ok('3. e i bordi dei campi stanno a 3:1 con quello che hanno intorno', !bordi.length, primi(bordi));
  });

  if (fare(4)) await prova('4', async () => {
    const piccoli = raccogli(['chiaro 320', 'chiaro 390', 'chiaro 430', 'scuro 390'], 'piccoli');
    ok('4. nessun elemento toccabile sotto i 44×44 px, a 320, 390 e 430 px, toccato come un dito', !piccoli.length && schermate('chiaro 320') >= PASSI.length, primi(piccoli, 6));
    /* i due casi della richiesta, misurati da soli: la riga con la spunta
       nei fogli della spesa e dell'attività, e «Rimuovi con Premium» */
    const p = await apriPagina(browser, { errori });
    const v = await p.evaluate(() => {
      const alto = el => el ? Math.round(el.getBoundingClientRect().height) : 0;
      openExpense(); const spesa = alto(document.querySelector('#mExpense .split-item')); closeSheet('mExpense');
      openActDetail(0, 11); const tappa = alto(document.querySelector('#mActDetail .split-item')); cancelActDetail();
      const ad = document.querySelector('#plan .ad-x'); go('plan'); ad.scrollIntoView({ block: 'center', behavior: 'instant' });
      const q = ad.getBoundingClientRect(), cx = q.left + q.width / 2, cy = q.top + q.height / 2;
      const punti = [[0, -21], [0, 21], [-21, 0], [21, 0]].map(([dx, dy]) => document.elementFromPoint(cx + dx, cy + dy) === ad);
      return { spesa, tappa, ad: punti.every(Boolean), adMisura: Math.round(q.width) + '×' + Math.round(q.height), onclick: ad.getAttribute('onclick') };
    });
    await p.close();
    ok('4. le righe con la spunta (spesa, attività) sono alte 44 px, e «Rimuovi con Premium» si tocca su 44 px facendo quello di prima',
      v.spesa >= 44 && v.tappa >= 44 && v.ad && v.onclick === 'openPremium()', `spesa ${v.spesa} px, attività ${v.tappa} px, «Rimuovi con Premium» disegnato ${v.adMisura}, toccabile su 44: ${v.ad}`);
  });

  /* ── 5. lang segue la lingua ──────────────────────────────────────────── */
  if (fare(5)) await prova('5', async () => {
    const visti = [];
    for (const l of LINGUE) {
      const p = await apriPagina(browser, { lingua: l, errori });
      visti.push([l, await p.evaluate(() => document.documentElement.lang)]);
      await p.close();
    }
    /* e cambiandola dal Profilo: la pagina si ricarica nella lingua nuova */
    const p = await apriPagina(browser, { errori });
    const prima = await p.evaluate(() => document.documentElement.lang);
    await Promise.all([p.waitForNavigation({ waitUntil: 'domcontentloaded' }), p.evaluate(() => cambiaLingua('fr'))]);
    await p.waitForFunction(() => typeof renderAll === 'function' && !document.getElementById('bootSplash'), null, { timeout: 30000 });
    const dopo = await p.evaluate(() => document.documentElement.lang);
    await p.close();
    ok('5. l\'attributo lang della pagina segue la lingua dell\'app, anche cambiandola dal Profilo', visti.every(([l, x]) => l === x) && prima === 'it' && dopo === 'fr',
      visti.map(([l, x]) => `${l}→${x}`).join(', ') + ` · dal Profilo: ${prima}→${dopo}`);
  });

  /* ── 6. il fuoco nei fogli ────────────────────────────────────────────── */
  if (fare(6)) await prova('6', async () => {
    const p = await apriPagina(browser, { errori });
    const dentro = id => p.evaluate(id => document.getElementById(id).contains(document.activeElement), id);
    const fuoco = () => p.evaluate(() => { const a = document.activeElement; return !a || a === document.body ? 'niente' : (a.id || a.className || a.tagName); });
    const attesa = () => p.waitForTimeout(450);
    const casi = [];
    /* a) Spese → «Aggiungi spesa» → chiuso con la ✕ */
    await p.click('.nav-item[data-p="money"]'); await attesa();
    await p.click('.mh-spesa'); await attesa();
    let entra = await dentro('mExpense');
    await p.click('#mExpense .x-close'); await attesa();
    casi.push(['«Aggiungi spesa», chiuso con la ✕', entra, await p.evaluate(() => document.activeElement.classList.contains('mh-spesa')), await fuoco()]);
    /* b) Home → «Cosa cerchi qui intorno?» → chiuso con Esc */
    await p.click('.nav-item[data-p="plan"]'); await attesa();
    await p.click('.hh-cerca'); await attesa();
    entra = await dentro('mCerca');
    await p.keyboard.press('Escape'); await attesa();
    casi.push(['«Cosa cerchi», chiuso con Esc', entra, await p.evaluate(() => document.activeElement.classList.contains('hh-cerca')), await fuoco()]);
    /* c) un riquadro-tasto (la prossima tappa in Home) → chiuso toccando fuori */
    await p.click('.hh-soon'); await attesa();
    entra = await dentro('mActMenu');
    await p.mouse.click(195, 12); await attesa();
    casi.push(['la prossima tappa in Home, chiuso toccando fuori', entra, await p.evaluate(() => document.activeElement.classList.contains('hh-soon') && !document.getElementById('mActMenu').classList.contains('active')), await fuoco()]);
    /* d) una tendina dentro un foglio: la scelta riporta sulla tendina */
    await p.click('.nav-item[data-p="money"]'); await attesa();
    await p.click('.mh-spesa'); await attesa();
    await p.click('#expPayer + .sel-velo'); await attesa();
    entra = await dentro('mPicker');
    await p.click('#pickerList .picker-opt'); await attesa();
    casi.push(['«Pagato da» dentro la spesa, scelto un nome', entra, await p.evaluate(() => document.activeElement.id === 'expPayer'), await fuoco()]);
    await p.click('#mExpense .x-close'); await attesa();
    ok('6. aprendo un foglio il fuoco entra; chiudendolo (✕, Esc, tocco fuori, scelta) torna al tasto che l\'aveva aperto', casi.every(c => c[1] && c[2]),
      casi.map(c => `${c[0]}: entra ${c[1]}, torna ${c[2]}${c[2] ? '' : ' (fuoco su ' + c[3] + ')'}`).join(' · '));
    /* e) ogni foglio è una finestra con un nome */
    const fogli = await p.evaluate(async () => {
      const male = [];
      for (const m of document.querySelectorAll('.modal')) {
        /* la conferma e la scheda del viaggio hanno il titolo che scrive chi le apre */
        if (m.id === 'mTripZoom') openTripZoom(T().id); else if (m.id === 'mConfirm') confirmDo('Eliminare la spesa?', '', null); else openSheet(m.id);
        await new Promise(ok => requestAnimationFrame(ok));
        const nomeId = m.getAttribute('aria-labelledby'), nome = nomeId && document.getElementById(nomeId) ? document.getElementById(nomeId).textContent.trim() : '';
        if (m.getAttribute('role') !== 'dialog' || m.getAttribute('aria-modal') !== 'true' || !nome) male.push(`${m.id} (${m.getAttribute('role')}, ${m.getAttribute('aria-modal')}, «${nome}»)`);
        if (m.id === 'mTripZoom') closeTripZoom(); else closeSheet(m.id);
      }
      return { n: document.querySelectorAll('.modal').length, male };
    });
    ok(`6. tutti i ${fogli.n} fogli e finestre sono role="dialog" con aria-modal e un nome`, !fogli.male.length && fogli.n > 50, primi(fogli.male));
    /* f) la tastiera: Tab gira dentro il foglio, Invio apre un riquadro-tasto */
    await p.evaluate(() => { document.querySelectorAll('.modal.active').forEach(m => closeSheet(m.id)); openSheet('mNewTrip'); });
    await attesa();
    let fuori = 0;
    for (let i = 0; i < 40; i++) { await p.keyboard.press(i % 7 === 6 ? 'Shift+Tab' : 'Tab'); if (!(await dentro('mNewTrip'))) fuori++; }
    await p.keyboard.press('Escape'); await attesa();
    await p.click('.nav-item[data-p="plan"]'); await attesa();
    await p.focus('.hh-soon');
    await p.keyboard.press('Enter'); await attesa();
    const conInvio = await p.evaluate(() => document.getElementById('mActMenu').classList.contains('active'));
    await p.keyboard.press('Escape'); await attesa();
    await p.focus('.hh-soon');
    await p.keyboard.press(' '); await attesa();
    const conSpazio = await p.evaluate(() => document.getElementById('mActMenu').classList.contains('active'));
    await p.close();
    ok('6. con la tastiera: Tab e Maiusc+Tab restano dentro il foglio aperto, Invio e spazio aprono un riquadro-tasto', !fuori && conInvio && conSpazio,
      `40 tasti Tab, ${fuori} finiti fuori · Invio ${conInvio}, spazio ${conSpazio}`);
  });

  /* ── 7. i messaggi in basso ───────────────────────────────────────────── */
  if (fare(7)) await prova('7', async () => {
    const p = await apriPagina(browser, { errori });
    const durate = await p.evaluate(() => [10, 40, 80, 120, 200].map(n => durataMessaggio('x'.repeat(n))));
    ok('7. la durata segue la lunghezza: almeno 2,6 s, poi 60 ms per carattere, al massimo 8 s', JSON.stringify(durate) === '[2600,2600,4800,7200,8000]',
      `10, 40, 80, 120, 200 caratteri → ${durate.map(x => (x / 1000).toFixed(1).replace('.', ',') + ' s').join(', ')}`);
    /* coi tempi veri dell'orologio della pagina */
    await p.evaluate(() => toast('x'.repeat(80)));
    await p.clock.runFor(4500);
    const ancora = await p.evaluate(() => !!document.querySelector('.toast') && document.querySelector('.toast').style.opacity !== '0');
    await p.clock.runFor(800);
    const via = await p.evaluate(() => !document.querySelector('.toast'));
    await p.evaluate(() => toast('Corto'));
    await p.clock.runFor(2400);
    const corto = await p.evaluate(() => !!document.querySelector('.toast'));
    await p.clock.runFor(700);
    const cortoVia = await p.evaluate(() => !document.querySelector('.toast'));
    ok('7. e a schermo: 80 caratteri restano 4,8 s, un messaggio corto 2,6 s', ancora && via && corto && cortoVia, `a 4,5 s c'è ${ancora}, a 5,3 s via ${via}; corto a 2,4 s ${corto}, a 3,1 s via ${cortoVia}`);
    /* un tocco lo chiude */
    await p.evaluate(() => toast('Un messaggio da chiudere con un tocco'));
    await p.click('.toast');
    await p.clock.runFor(400);
    const chiuso = await p.evaluate(() => !document.querySelector('.toast'));
    /* VoiceOver lo legge, una volta sola */
    await p.evaluate(() => toast('Spesa salvata'));
    await p.clock.runFor(200);
    const voce = await p.evaluate(() => { const a = document.getElementById('annunci'); return { ruolo: a.getAttribute('role'), live: a.getAttribute('aria-live'), testo: a.textContent, nascosto: document.querySelector('.toast').getAttribute('aria-hidden') }; });
    ok('7. si chiude con un tocco, e VoiceOver lo legge (una regione aria-live="polite" che c\'è sempre; il messaggio a schermo non si legge due volte)',
      chiuso && voce.ruolo === 'status' && voce.live === 'polite' && voce.testo === 'Spesa salvata' && voce.nascosto === 'true', `chiuso ${chiuso}, ${JSON.stringify(voce)}`);
    /* Non copre i tasti principali: le barre, il + della giornata, e nel
       foglio aperto la ✕ e i tasti delle azioni. I campi e il contenuto non
       contano: un foglio alto quanto lo schermo è tutto campi, e non c'è un
       posto dove un messaggio non ne copra qualcuno. */
    const copre = () => p.evaluate(() => {
      const el = document.querySelector('.toast'); if (!el) return ['nessun messaggio'];
      const q = el.getBoundingClientRect();
      const tasti = [...document.querySelectorAll('.nav-item,.topbar button,.fab,.tt-undo,.modal.active .sheet-head button,.modal.active .btn,.modal.active .confirm-a button')].filter(b => {
        const r2 = b.getBoundingClientRect(); if (!r2.width || r2.bottom <= 0 || r2.top >= innerHeight) return false;
        el.style.visibility = 'hidden'; const h = document.elementFromPoint(r2.left + r2.width / 2, r2.top + r2.height / 2); el.style.visibility = '';
        return h && (h === b || b.contains(h));
      });
      return tasti.filter(b => { const r2 = b.getBoundingClientRect(); return Math.min(r2.right, q.right) - Math.max(r2.left, q.left) > 1 && Math.min(r2.bottom, q.bottom) - Math.max(r2.top, q.top) > 1; })
        .map(b => b.id || (b.className && String(b.className).split(' ')[0]) || b.textContent.trim().slice(0, 20));
    });
    const scene = [
      ['la Home', "go('plan')"],
      ['la giornata, col + Aggiungi in basso', 'openDay(0)'],
      ['il foglio «Nuovo viaggio»', "openSheet('mNewTrip')"],
      ['la conferma di un\'eliminazione', "confirmDo('Eliminare la spesa?','Non si torna indietro.',()=>{},'🗑️','Elimina')"]
    ];
    const coperti = [];
    for (const [nome, js] of scene) {
      await p.evaluate(js => { document.querySelectorAll('.modal.active').forEach(m => closeSheet(m.id)); eval(js); }, js);
      await p.waitForTimeout(500);
      await p.evaluate(() => toast('Un messaggio di prova, lungo quanto uno vero'));
      await p.clock.runFor(100);
      const c = await copre();
      if (c.length) coperti.push(`${nome}: copre ${c.join(', ')}`);
    }
    ok('7. non copre i tasti principali: la barra, la testata, il + della giornata, i tasti dei fogli aperti', !coperti.length, coperti.join(' | ') || scene.map(s => s[0]).join(', '));
    await p.close();
    /* e si legge nei due temi: era bianco su panna nel tema scuro */
    const temi = [];
    for (const tema of ['chiaro', 'scuro']) {
      const q = await apriPagina(browser, { tema, errori });
      const c = await q.evaluate(() => { toast('Prova'); const s = getComputedStyle(document.querySelector('.toast')); const rgb = x => '#' + (x.match(/\d+/g) || []).slice(0, 3).map(v => (+v).toString(16).padStart(2, '0')).join(''); return [rgb(s.color), rgb(s.backgroundColor)]; });
      await q.close();
      temi.push([tema, c, contrasto(c[0], c[1])]);
    }
    ok('7. e si legge nei due temi (4,5:1)', temi.every(x => x[2] >= 4.5), temi.map(([t, c, x]) => `${t} ${c[0]} su ${c[1]} ${virgola(x)}:1`).join(' · '));
  });

  /* ── 8. riduci movimento ──────────────────────────────────────────────── */
  if (fare(8)) await prova('8', async () => {
    /* Tutte le animazioni e le transizioni in corso in un momento pieno di
       movimento: un foglio che sale, un messaggio che entra, il cielo della
       Home. Con «Riduci movimento» nessuna deve durare più di un attimo. */
    const leggi = page => page.evaluate(async () => {
      go('plan');
      openSheet('mNewTrip'); toast('Un messaggio');
      await new Promise(ok => requestAnimationFrame(() => requestAnimationFrame(ok)));
      const durate = document.getAnimations().map(a => { const t = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : {}; return Number(t.duration) || 0; });
      const sheet = getComputedStyle(document.querySelector('#mNewTrip .sheet')).transitionDuration.split(',').map(s => parseFloat(s) * (/ms/.test(s) ? 1 : 1000));
      closeSheet('mNewTrip');
      return { n: durate.length, lunghe: durate.filter(d => d > 1).length, max: Math.max(0, ...durate), foglio: Math.max(...sheet), meno: menoMovimento(), scorre: comeScorrere(),
        mappa: typeof L !== 'undefined' && L.Map ? L.Map.prototype.options.zoomAnimation : null };
    });
    const normale = await apriPagina(browser, { errori });
    const n = await leggi(normale); await normale.close();
    const ridotto = await apriPagina(browser, { errori, opzioni: { reducedMotion: 'reduce' } });
    const m = await leggi(ridotto); await ridotto.close();
    ok('8. con «Riduci movimento» animazioni e transizioni durano un attimo (il foglio che sale, il messaggio che entra, il cielo)',
      n.lunghe > 0 && n.foglio >= 200 && m.lunghe === 0 && m.foglio <= 1,
      `di solito ${n.lunghe} animazioni lunghe (fino a ${Math.round(n.max)} ms), foglio in ${Math.round(n.foglio)} ms · ridotto: ${m.lunghe} su ${m.n}, foglio in ${m.foglio} ms`);
    ok('8. e anche quelle fatte da JavaScript: niente scorrimenti morbidi, mappe senza zoom che scivola', !n.meno && n.scorre === 'smooth' && m.meno && m.scorre === 'auto' && n.mappa === true && m.mappa === false
      && !/behavior:\s*'smooth'/.test(HTML), `scorrimento ${n.scorre} → ${m.scorre}, zoom animato della mappa ${n.mappa} → ${m.mappa}`);
  });

  /* ── 9. niente testi tagliati o sovrapposti ───────────────────────────── */
  if (fare(9)) await prova('9', async () => {
    /* Tasti da 44 px, righe più alte, spazi più larghi: le scritte devono
       starci ancora, in tutte le lingue. Tutte le schermate a 320 e a 430
       px, le principali a 375. */
    const guasti = { fuori: [], troncati: [], sovrapposti: [] }, rotti = [];
    let misure = 0;
    const guarda = page => page.evaluate(([m, nomi]) => eval(m)(nomi), [MISURA.toString(), NOMI]);
    for (const [larghezza, soloQuesti] of [[320, null], [430, null], [375, PRINCIPALI]]) {
      const esiti = await Promise.all(LINGUE.map(lingua => giro(browser, { lingua, larghezza, soloQuesti, guarda })));
      esiti.forEach((e, i) => {
        e.err.forEach(x => rotti.push(`${LINGUE[i]} ${larghezza}px, ${x}`));
        Object.entries(e.esiti).forEach(([dove, m]) => { if (!m) return; misure++; Object.keys(guasti).forEach(k => m[k].forEach(x => guasti[k].push(`${LINGUE[i]} ${larghezza}px, ${dove}: ${x}`))); });
      });
    }
    ok(`9. misurate ${misure} schermate in 5 lingue, a 320, 375 e 430 px, senza che niente si rompa`, misure > 5 * 2 * PASSI.length && !rotti.length, primi(rotti));
    ok('9. niente esce di lato', !guasti.fuori.length, primi(guasti.fuori));
    ok('9. nessun testo troncato', !guasti.troncati.length, primi(guasti.troncati));
    ok('9. nessun testo sovrapposto a un altro', !guasti.sovrapposti.length, primi(guasti.sovrapposti));
  });

  r.sort((a, b) => (parseInt((a.match(/ (\d)\./) || [])[1], 10) || 0) - (parseInt((b.match(/ (\d)\./) || [])[1], 10) || 0));
  console.log('\n' + r.join('\n'));
  const falliti = r.filter(x => x.includes('FALLITO')).length;
  console.log(`\n${r.length - falliti}/${r.length} passati`);
  if (errori.length) console.log('\nErrori in pagina:\n' + [...new Set(errori)].slice(0, 30).join('\n'));
  await browser.close();
  process.exit(falliti ? 1 : 0);
})();
