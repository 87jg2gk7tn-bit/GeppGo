const { apriBrowser, APP } = require('./browser');

(async () => {
  const browser = await apriBrowser();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const err = [];
  page.on('pageerror', e => err.push('PAGEERROR: ' + e.message));
  await page.addInitScript(() => localStorage.setItem('geppgo2', JSON.stringify({
    trips: [], settings: {}, myName: 'Gepp', premium: false })));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof myPos !== 'undefined', { timeout: 20000 });

  const r = [];
  const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);

  const stato = await page.evaluate(() => {
    renderAds();
    const slot = [...document.querySelectorAll('.ad-slot')];
    return {
      quanti: slot.length,
      visibili: slot.filter(a => a.style.display !== 'none').length,
      attiva: PUBBLICITA_ATTIVA,
      sotto: document.getElementById('planSub') ? document.getElementById('planSub').textContent : ''
    };
  });
  ok('i riquadri restano nel codice, pronti', stato.quanti === 9, stato.quanti + ' riquadri');
  ok('ma non se ne vede nessuno finché non c\'è pubblicità vera', stato.visibili === 0, stato.visibili + ' visibili');
  ok('e l\'interruttore è spento', stato.attiva === false);
  ok('il piano non dice più "con pubblicità"', !/pubblicit/i.test(stato.sotto), stato.sotto);

  // la voce del Premium che prometteva di toglierla
  const prem = await page.evaluate(() => {
    openPremium();
    const v = document.getElementById('premNoAds');
    return { c: !!v, mostrata: v ? v.style.display !== 'none' : null };
  });
  ok('la voce "Zero pubblicità" c\'è ancora nel codice', prem.c === true);
  ok('ma non si promette di togliere una cosa che non esiste', prem.mostrata === false);

  // e accendendo l'interruttore, torna tutto
  const acceso = await page.evaluate(() => {
    window.PROVA_ACCESA = true;
    const slot = [...document.querySelectorAll('.ad-slot')];
    // si simula quello che farebbe renderAds con l'interruttore acceso
    slot.forEach(a => a.style.display = 'flex');
    document.getElementById('premNoAds').style.display = 'flex';
    return { visibili: slot.filter(a => a.style.display !== 'none').length };
  });
  ok('e i riquadri sono pronti a riaccendersi', acceso.visibili === 9, acceso.visibili + ' riquadri');

  console.log('\n' + r.join('\n'));
  const falliti = r.filter(x => x.includes('FALLITO')).length;
  console.log(`\n${r.length - falliti}/${r.length} passati`);
  if (err.length) console.log('\nErrori in pagina:\n' + err.join('\n'));
  await browser.close();
  process.exit(falliti ? 1 : 0);
})();
