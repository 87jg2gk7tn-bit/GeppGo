/* Il caso vero: sul telefono di Jak un biglietto viene rinominato, e su questo
   telefono deve arrivare il nome nuovo. Le funzioni di fusione sono pure, quindi
   si provano direttamente, senza bisogno di Supabase. */
const { apriBrowser, APP, RADICE } = require('./browser');

(async () => {
  const browser = await apriBrowser();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.mergedRecordFields === 'function', { timeout: 15000 });

  const out = await page.evaluate(() => {
    const r = [];
    const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);

    // io ho il biglietto col nome grezzo dello screenshot
    const locale = () => ({
      tickets: [
        { id: 'tk1', name: 'Screenshot 2026 08 06 17 53 12 412 com.a', code: 'UPB6356699918_01' },
        { id: 'tkMio', name: 'Biglietto aggiunto solo da me', code: 'ZZZ' }
      ],
      expenses: [{ id: 'e1', label: 'Cena', amount: 30 }],
      pois: [], hotels: [],
      days: [{ id: 'd1', date: '2026-08-06', activities: [
        { id: 'a1', name: 'Senso-ji', time: '10:00' },
        { id: 'aMia', name: 'Tappa mia', time: '18:00' }
      ] }]
    });
    // Jak ha rinominato il biglietto, sistemato la spesa e spostato la tappa
    const remoto = () => ({
      tickets: [
        { id: 'tk1', name: 'Check-in · APA Hotel (Asakusa Ekimae)', code: 'UPB6356699918_01' },
        { id: 'tkJak', name: 'Entrata in Giappone', code: 'YYY' }
      ],
      expenses: [{ id: 'e1', label: 'Cena da Ichiran', amount: 42 }],
      pois: [], hotels: [],
      days: [{ id: 'd1', date: '2026-08-06', activities: [
        { id: 'a1', name: 'Senso-ji (tempio)', time: '11:30' },
        { id: 'aJak', name: 'Tappa di Jak', time: '15:00' }
      ] }]
    });

    // ── allineati col cloud: deve vincere il remoto ──────────────────
    const m = mergedRecordFields(locale(), remoto(), 'remoto');
    const tk = m.tickets.find(x => x.id === 'tk1');
    ok('il biglietto rinominato da Jak ARRIVA', tk.name === 'Check-in · APA Hotel (Asakusa Ekimae)', tk.name);
    ok('il biglietto che ho solo io non sparisce', !!m.tickets.find(x => x.id === 'tkMio'));
    ok('quello nuovo di Jak arriva', !!m.tickets.find(x => x.id === 'tkJak'));
    ok('nessun biglietto duplicato', m.tickets.length === 3, m.tickets.length + ' biglietti');

    const e = m.expenses.find(x => x.id === 'e1');
    ok('la spesa corretta da Jak arriva', e.label === 'Cena da Ichiran' && e.amount === 42, `${e.label} ${e.amount}`);

    const acts = m.days[0].activities;
    const a1 = acts.find(x => x.id === 'a1');
    ok('la tappa che Jak ha spostato arriva', a1.time === '11:30' && a1.name === 'Senso-ji (tempio)', `${a1.name} ${a1.time}`);
    ok('la mia tappa resta', !!acts.find(x => x.id === 'aMia'));
    ok('la tappa nuova di Jak arriva', !!acts.find(x => x.id === 'aJak'));
    ok('nessuna tappa duplicata', acts.length === 3, acts.length + ' tappe');

    // ── ho modifiche non salvate: devono vincere le mie ──────────────
    const p = mergedRecordFields(locale(), remoto(), 'locale');
    const tkp = p.tickets.find(x => x.id === 'tk1');
    ok('con modifiche mie in sospeso, le mie sono protette', tkp.name === 'Screenshot 2026 08 06 17 53 12 412 com.a', tkp.name);
    ok('ma le aggiunte di Jak arrivano lo stesso', !!p.tickets.find(x => x.id === 'tkJak'));
    const a1p = p.days[0].activities.find(x => x.id === 'a1');
    ok('e le mie tappe restano come le ho lasciate', a1p.time === '10:00', a1p.time);

    // ── una cancellazione resta una cancellazione ────────────────────
    const loc2 = locale(); loc2._delTicket = { tk1: Date.now() };
    const d = mergedRecordFields(loc2, remoto(), 'remoto');
    ok('un biglietto che ho cancellato non torna indietro', !d.tickets.find(x => x.id === 'tk1'));
    const rem2 = remoto(); rem2._delTicket = { tkMio: Date.now() };
    const d2 = mergedRecordFields(locale(), rem2, 'remoto');
    ok('e se lo cancella Jak sparisce anche qui', !d2.tickets.find(x => x.id === 'tkMio'));

    // ── il giorno che ho solo io non si perde ────────────────────────
    const loc3 = locale();
    loc3.days.push({ id: 'dMio', date: '2026-08-07', activities: [{ id: 'x1', name: 'Solo mio' }] });
    const g = mergedRecordFields(loc3, remoto(), 'remoto');
    ok('un giorno che ho solo io resta', !!g.days.find(x => x.id === 'dMio'), g.days.length + ' giorni');

    // ── liste vuote / mancanti non devono rompere ────────────────────
    try {
      const v = mergedRecordFields({ days: [] }, { days: [] }, 'remoto');
      ok('con un viaggio vuoto non si rompe', Array.isArray(v.tickets) && v.tickets.length === 0);
    } catch (err) { ok('con un viaggio vuoto non si rompe', false, err.message); }

    return r;
  });

  console.log('\n' + out.join('\n'));
  const falliti = out.filter(x => x.includes('FALLITO')).length;
  console.log(`\n${out.length - falliti}/${out.length} passati`);
  await browser.close();
  process.exit(falliti ? 1 : 0);
})();
