const { apriBrowser, APP, RADICE } = require('./browser');


const stato = {
  trips: [{
    id: 't1', name: 'Prova', destination: 'Roma', currency: 'EUR', status: 'open',
    start: '2026-09-01', end: '2026-09-02',
    participants: [{ id: 'p1', name: 'Gepp' }],
    suggested: [], pois: [], expenses: [], tickets: [], weather: {}, createdAt: Date.now(),
    days: [{
      id: 'd1', date: '2026-09-01', title: '', activities: [
        { id: 1, name: 'Colosseo', time: '10:00', timeEnd: '11:00', type: 'any', notes: '',
          who: ['p1'], completed: false, booking: { needed: false, done: false },
          poiId: null, lat: null, lng: null },
        { id: 2, name: 'Senza fine', time: '15:00', timeEnd: '', type: 'any', notes: '',
          who: ['p1'], completed: false, booking: { needed: false, done: false },
          poiId: null, lat: null, lng: null }
      ]
    }]
  }],
  currentTripId: 't1', settings: { proxRadius: 200 }, myName: 'Gepp'
};

const err = [];

(async () => {
  const browser = await apriBrowser();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  page.on('pageerror', e => err.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') err.push('CONSOLE: ' + m.text()); });

  await page.addInitScript(s => localStorage.setItem('geppgo2', JSON.stringify(s)), stato);
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.openDay === 'function', { timeout: 15000 });
  await page.evaluate(() => openDay(0));
  await page.waitForTimeout(600);

  const leggi = id => page.evaluate(i => {
    const a = app.trips[0].days[0].activities.find(x => x.id === i);
    return { time: a.time, timeEnd: a.timeEnd };
  }, id);
  const undoVisibile = () => page.evaluate(() => {
    const b = document.getElementById('ttUndo');
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return {
      on: b.classList.contains('on'),
      title: b.title,
      // "si vede" davvero: ha dimensioni, sta nello schermo, ed e' lui in cima
      siVede: r.width > 0 && r.y > 0 && r.y + r.height < innerHeight
              && document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === b,
      opacita: getComputedStyle(b).opacity
    };
  });

  const risultati = [];
  const check = (nome, cond, extra = '') => {
    risultati.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);
    return cond;
  };
  /* se il tasto non e' visibile il test non deve fermarsi: si segna e si tira
     dritto, cosi' si vedono tutti i risultati in un colpo solo */
  const clickUndo = async () => {
    const v = await undoVisibile();
    if (!v.on) { risultati.push(' FALLITO  il tasto ↩ non e\' visibile, non posso premerlo'); return false; }
    await page.click('#ttUndo');
    return true;
  };

  // ── il blocco esiste e la maniglia c'e' ──────────────────────────────
  const box = await page.evaluate(() => {
    const el = document.querySelector('.tt-block[data-id="1"] .tszr');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  if (!box) { console.log('NON TROVO la maniglia .tszr — test interrotto'); await browser.close(); process.exit(1); }

  check('stato di partenza 10:00–11:00', JSON.stringify(await leggi(1)) === '{"time":"10:00","timeEnd":"11:00"}');

  // ── 0. la freccina si vede APPENA APERTA, prima di toccare niente ─────
  const v0 = await undoVisibile();
  check('la freccina ↩ SI VEDE appena aperta la time-table', v0.siVede, `opacita ${v0.opacita}`);
  check('ma parte spenta, non c\'e\' niente da annullare', !v0.on);
  check('e lo dice', /niente da annullare/i.test(v0.title), v0.title);
  await page.click('#ttUndo');   // premerla da spenta non deve rompere niente
  await page.waitForTimeout(250);
  check('premuta da spenta non cambia gli orari', JSON.stringify(await leggi(1)) === '{"time":"10:00","timeEnd":"11:00"}');
  // il messaggio va aspettato, non fotografato al volo: appare e poi svanisce
  const avviso = await page.evaluate(async () => {
    for (let i = 0; i < 40; i++) {
      const t = document.querySelector('.toast');
      if (t && /niente da annullare/i.test(t.textContent)) return t.textContent;
      await new Promise(r => setTimeout(r, 50));
    }
    const t = document.querySelector('.toast');
    return t ? t.textContent : '';
  });
  check('e avvisa invece di non fare niente', /niente da annullare/i.test(avviso), avviso || '(nessun avviso)');

  // ── la freccina non deve spuntare fuori dalla time-table ─────────────
  await page.evaluate(() => go('plan'));
  await page.waitForTimeout(400);
  check('in Home la freccina non c\'e\'', !(await undoVisibile()).siVede);
  await page.evaluate(() => openDay(0));
  await page.waitForTimeout(400);
  check('e tornando in time-table e\' di nuovo li\'', (await undoVisibile()).siVede);

  // ── 1. allungo tirando la maniglia ───────────────────────────────────
  const TT_H = await page.evaluate(() => TT_H);   // px per ora
  await page.mouse.move(box.x, box.y);
  await page.mouse.down();
  await page.mouse.move(box.x, box.y + TT_H, { steps: 10 });   // +1 ora
  await page.mouse.up();
  await page.waitForTimeout(300);

  const dopo = await leggi(1);
  check('allungato di un\'ora → 12:00', dopo.timeEnd === '12:00', JSON.stringify(dopo));
  const u1 = await undoVisibile();
  check('il tasto ↩ si ACCENDE dopo l\'allungamento', u1.on && u1.siVede, `opacita ${u1.opacita}`);
  check('la scritta del tasto parla di allungamento', /allungamento/i.test(u1.title), u1.title);

  // ── 2. annullo ───────────────────────────────────────────────────────
  await page.click('#ttUndo');
  await page.waitForTimeout(300);
  const ripristino = await leggi(1);
  check('↩ rimette 11:00', ripristino.timeEnd === '11:00', JSON.stringify(ripristino));
  check('l\'ora d\'inizio non si e\' mossa', ripristino.time === '10:00', ripristino.time);
  const spento = await undoVisibile();
  check('il tasto ↩ si spegne dopo l\'uso', !spento.on);
  check('ma resta al suo posto, non sparisce', spento.siVede);
  const salvato = await page.evaluate(() => JSON.parse(localStorage.getItem('geppgo2')).trips[0].days[0].activities[0].timeEnd);
  check('e il ripristino e\' anche salvato su disco', salvato === '11:00', salvato);

  // ── 3. la tappa che non aveva un orario di fine ──────────────────────
  const box2 = await page.evaluate(async () => {
    const el = document.querySelector('.tt-block[data-id="2"] .tszr');
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    await new Promise(r => setTimeout(r, 250));
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, inVista: r.y > 0 && r.y < innerHeight };
  });
  risultati.push(`  info   maniglia tappa 2 a y=${box2 ? Math.round(box2.y) : '?'} (viewport 844) in vista: ${box2 && box2.inVista}`);
  if (box2) {
    await page.mouse.move(box2.x, box2.y);
    await page.mouse.down();
    await page.mouse.move(box2.x, box2.y + TT_H, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    const d2 = await leggi(2);
    check('la tappa senza fine ne prende una', !!d2.timeEnd, JSON.stringify(d2));
    const diag = await page.evaluate(() => {
      const a = app.trips[0].days[0].activities.find(x => x.id === 2);
      const el = document.querySelector('.tt-block[data-id="2"]');
      return { range: typeof actRange === 'function' ? actRange(a) : 'n/d',
               classi: el ? el.className : 'nessun blocco',
               alt: el ? Math.round(el.getBoundingClientRect().height) : 0 };
    });
    risultati.push(`  info   tappa 2: range=${JSON.stringify(diag.range)} classi="${diag.classi}" altezza=${diag.alt}px`);
    await clickUndo();
    await page.waitForTimeout(300);
    const r2 = await leggi(2);
    check('↩ gliela toglie di nuovo (non resta un orario inventato)', !r2.timeEnd, JSON.stringify(r2));
  }

  // ── 4. lo spostamento continua a funzionare come prima ───────────────
  await page.evaluate(() => {
    const a = app.trips[0].days[0].activities.find(x => x.id === 1);
    a.time = '10:00'; a.timeEnd = '11:00'; save(); buildTT();
  });
  const bb = await page.evaluate(() => {
    const r = document.querySelector('.tt-block[data-id="1"]').getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + 6 };
  });
  await page.mouse.move(bb.x, bb.y);
  await page.mouse.down();
  await page.waitForTimeout(750);                       // pressione lunga
  await page.mouse.move(bb.x, bb.y + TT_H, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const sp = await leggi(1);
  check('spostato in giu\' di un\'ora → 11:00', sp.time === '11:00', JSON.stringify(sp));
  const u2 = await undoVisibile();
  check('il tasto ↩ compare anche per lo spostamento', u2.on);
  check('e la scritta torna a parlare di spostamento', /spostamento/i.test(u2.title), u2.title);
  await page.click('#ttUndo');
  await page.waitForTimeout(300);
  const sp2 = await leggi(1);
  check('↩ rimette lo spostamento a posto', sp2.time === '10:00' && sp2.timeEnd === '11:00', JSON.stringify(sp2));

  // ── 5. cambiando giorno l'undo si azzera ─────────────────────────────
  await page.evaluate(() => {
    const a = app.trips[0].days[0].activities.find(x => x.id === 1);
    markDrag(a, { time: a.time, timeEnd: a.timeEnd, parentId: null }, 'durata');
  });
  check('(preparato) tasto acceso', (await undoVisibile()).on);
  await page.evaluate(() => openDay(0));
  await page.waitForTimeout(300);
  check('riaprendo il giorno il tasto si spegne', !(await undoVisibile()).on);

  // ── 6. la pinza a due dita ───────────────────────────────────────────
  await page.evaluate(() => {
    const a = app.trips[0].days[0].activities.find(x => x.id === 1);
    a.time = '10:00'; a.timeEnd = '11:00'; save(); buildTT();
    document.querySelector('.tt-block[data-id="1"]').scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(300);
  const cdp = await page.context().newCDPSession(page);
  const c = await page.evaluate(() => {
    const r = document.querySelector('.tt-block[data-id="1"]').getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  const dita = (dy, type) => cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: type === 'touchEnd' ? [] : [
      { x: c.x, y: c.y - dy, id: 1 },
      { x: c.x, y: c.y + dy, id: 2 }
    ]
  });
  await dita(20, 'touchStart');
  for (const d of [30, 45, 60, 75]) { await dita(d, 'touchMove'); await page.waitForTimeout(40); }
  await dita(75, 'touchEnd');
  await page.waitForTimeout(300);

  const pz = await leggi(1);
  check('la pinza allarga la tappa', pz.timeEnd !== '11:00', JSON.stringify(pz));
  const u3 = await undoVisibile();
  check('il tasto ↩ compare anche dopo la pinza', u3.on);
  if (u3.on) {
    await clickUndo();
    await page.waitForTimeout(300);
    const pz2 = await leggi(1);
    check('↩ rimette la durata di prima anche dopo la pinza', pz2.timeEnd === '11:00' && pz2.time === '10:00', JSON.stringify(pz2));
  }

  console.log('\n' + risultati.join('\n'));
  const falliti = risultati.filter(r => r.includes('FALLITO')).length;
  console.log(`\n${risultati.length - falliti}/${risultati.length} passati`);
  if (err.length) console.log('\nErrori in pagina:\n' + err.slice(0, 10).join('\n'));
  await browser.close();
  process.exit(falliti ? 1 : 0);
})();
