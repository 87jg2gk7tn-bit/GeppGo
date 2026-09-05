/* Gli spazi pubblicitari, e a cosa servono davvero.

   Sono vuoti — dentro non c'è ancora nessuna pubblicità — e per questo erano
   stati tolti: nove riquadri tratteggiati che non fanno guadagnare niente.
   Quel ragionamento guardava il guadagno e non guardava a cosa servivano.

   Servono a far vedere **la differenza fra il piano gratuito e il Premium**.
   Senza, i due piani sono identici a schermo e non si capisce che cosa si
   compra. È l'unico posto dell'app in cui quella differenza si vede, ed è il
   motivo per cui questa prova esiste: perché non vengano tolti di nuovo da
   qualcuno che li guarda e li trova inutili. */
const { apriBrowser, APP } = require('./browser');

(async () => {
  const browser = await apriBrowser();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const err = [];
  page.on('pageerror', e => err.push('PAGEERROR: ' + e.message));
  await page.addInitScript(() => localStorage.setItem('geppgo2', JSON.stringify({
    trips: [], settings: {}, myName: 'Gepp', premium: false, skipAuth: true })));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof myPos !== 'undefined', { timeout: 20000 });

  const r = [];
  const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);

  // ── chi non è Premium li vede ────────────────────────────────────────────
  const gratis = await page.evaluate(() => {
    app.premium = false; renderAds();
    const slot = [...document.querySelectorAll('.ad-slot')];
    return {
      quanti: slot.length,
      visibili: slot.filter(a => a.style.display !== 'none').length,
      attiva: PUBBLICITA_ATTIVA,
      distintivo: document.getElementById('planBadge').textContent,
      sotto: document.getElementById('planSub').textContent
    };
  });
  ok('i riquadri ci sono tutti e nove', gratis.quanti === 9, gratis.quanti + ' riquadri');
  ok('e chi non è Premium li vede', gratis.visibili === 9, gratis.visibili + ' visibili');
  ok('l\'interruttore è acceso', gratis.attiva === true);
  ok('il piano gratuito si chiama così', /gratis/i.test(gratis.distintivo), gratis.distintivo);
  ok('e dice che c\'è la pubblicità', /con pubblicità/i.test(gratis.sotto), gratis.sotto);

  // ── chi è Premium NON li vede: è la differenza che il Premium vende ──────
  const premium = await page.evaluate(() => {
    app.premium = true; renderAds();
    const slot = [...document.querySelectorAll('.ad-slot')];
    return {
      visibili: slot.filter(a => a.style.display !== 'none').length,
      distintivo: document.getElementById('planBadge').textContent,
      sotto: document.getElementById('planSub').textContent
    };
  });
  ok('CHI È PREMIUM NON NE VEDE NEMMENO UNO', premium.visibili === 0, premium.visibili + ' visibili');
  ok('e il distintivo cambia', /premium/i.test(premium.distintivo), premium.distintivo);
  ok('e il piano dice che la pubblicità non c\'è', /niente pubblicità/i.test(premium.sotto), premium.sotto);

  /* Il punto di tutto: fra i due piani si deve VEDERE una differenza. Se un
     giorno i riquadri sparissero di nuovo, gratuito e Premium tornerebbero
     identici a schermo e questa riga diventerebbe rossa. */
  ok('fra i due piani la differenza si vede', gratis.visibili > 0 && premium.visibili === 0,
     'gratis ' + gratis.visibili + ', premium ' + premium.visibili);

  // ── e il Premium può prometterlo, perché è vero ─────────────────────────
  const prem = await page.evaluate(() => {
    app.premium = false; renderAds();
    openPremium();
    const v = document.getElementById('premNoAds');
    return { c: !!v, mostrata: v ? v.style.display !== 'none' : null,
             testo: v ? v.textContent : '' };
  });
  ok('nel Premium c\'è la voce "Zero pubblicità"', prem.c === true);
  ok('e si mostra, perché adesso è una promessa vera', prem.mostrata === true, prem.testo);

  // ── resta il modo di spegnerli tutti in un colpo ─────────────────────────
  /* Il giorno che dentro ci finirà pubblicità vera, o che si deciderà di non
     farne più, si cambia una riga sola — e vanno rifatte le schede privacy
     sugli store, perché la pubblicità cambia le risposte su tracciamento e
     identificatori. */
  const spegnimento = await page.evaluate(() => {
    const src = document.documentElement.innerHTML;
    return { interruttore: /const PUBBLICITA_ATTIVA=/.test(src),
             avviso: /PRIVACY-STORE\.md/.test(src) };
  });
  ok('c\'è un interruttore solo per spegnerli tutti', spegnimento.interruttore === true);
  ok('e accanto è scritto cosa va rifatto quando la pubblicità sarà vera',
     spegnimento.avviso === true);

  console.log('\n' + r.join('\n'));
  const falliti = r.filter(x => x.includes('FALLITO')).length;
  console.log(`\n${r.length - falliti}/${r.length} passati`);
  if (err.length) console.log('\nErrori in pagina:\n' + err.join('\n'));
  await browser.close();
  process.exit(falliti ? 1 : 0);
})();
