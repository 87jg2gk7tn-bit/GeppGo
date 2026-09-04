const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
/* La cartella del progetto: normalmente quella sopra a questo file. Le prove
   pero' girano anche da un'altra cartella (dove sta playwright), quindi se
   accanto non si trova l'app si guarda dove dice GEPPGO_DIR. */
const RADICE = fs.existsSync(path.resolve(__dirname, '..', 'Index 2.1.html'))
  ? path.resolve(__dirname, '..')
  : (process.env.GEPPGO_DIR || '/home/user/GeppGo');
const APP = process.env.APP_URL || 'file://' + RADICE + '/Index%202.1.html';

(async () => {
  const r = [];
  const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);

  // ── la pagina esiste, ed è raggiungibile da fuori ────────────────────────
  const pagRaw = fs.readFileSync(path.join(RADICE, 'privacy.html'), 'utf8');
  /* Su un testo in prosa gli a-capo cadono dove capita: "Elimina il mio\naccount"
     e' la stessa frase di "Elimina il mio account", e un controllo che non lo
     sa fallisce per un motivo che non interessa a nessuno. Si schiacciano gli
     spazi prima di cercare. */
  const pag = pagRaw.replace(/\s+/g, ' ');
  const redir = fs.readFileSync(path.join(RADICE, '_redirects'), 'utf8');

  ok('la pagina della privacy esiste', pag.length > 2000, pagRaw.length + ' caratteri');
  ok('e resta raggiungibile sotto /privacy', /^\/privacy\s+\/privacy\.html/m.test(redir));
  const rPriv = redir.split('\n').findIndex(l => /^\/privacy\b/.test(l));
  const rTutto = redir.split('\n').findIndex(l => /^\/\*/.test(l));
  ok('e la regola viene prima di quella che prende tutto', rPriv >= 0 && rPriv < rTutto,
     'riga ' + rPriv + ' contro ' + rTutto);

  // ── non manda l'IP di chi la legge a nessuno ─────────────────────────────
  const fuori = [...pagRaw.matchAll(/(?:src|href)=["']https?:\/\/([^/"']+)/g)].map(m => m[1]);
  const automatici = fuori.filter(h => !/garanteprivacy|commissariatodips/.test(h));
  ok('e non carica niente da server esterni', automatici.length === 0, automatici.join(', ') || 'nessuno');

  // ── dice le cose che deve dire ───────────────────────────────────────────
  const deve = {
    'chi è il titolare': /titolare del trattamento/i,
    'come contattarlo': /merati\.giacomo94@gmail\.com/,
    'quali dati raccoglie': /email|posizione|foto/i,
    'su quale base giuridica': /art\. ?6\.1/,
    'a chi li dà': /Supabase/,
    'per quanto li tiene': /Per quanto tempo/i,
    'i diritti dell\'utente': /correggerli.*cancellarli|cancellarli/i,
    'come cancellare l\'account': /Elimina il mio account/,
    'come portarsi via i dati': /Esporta\s*dati/i,
    'a chi reclamare': /Garante/,
    'l\'età minima': /14 anni/,
    'e che le foto non sono pubbliche': /nessuna bacheca pubblica/i
  };
  Object.entries(deve).forEach(([nome, re]) => ok('la pagina dice ' + nome, re.test(pag)));

  // il punto sui dati di terzi: è quello che nessuno scrive e che qui serve
  ok('e avvisa che aggiungere un compagno significa trattare dati di un altro',
     /dati di\s*qualcun altro/i.test(pag));

  // ── ogni servizio esterno dell'app è dichiarato ──────────────────────────
  const html = fs.readFileSync(path.join(RADICE, 'Index 2.1.html'), 'utf8');
  const chiamati = new Set();
  [...html.matchAll(/fetch\(\s*[`'"]?(https:\/\/[a-z0-9.-]+)/gi)].forEach(m => chiamati.add(m[1]));
  [...html.matchAll(/@import url\('(https:\/\/[a-z0-9.-]+)/gi)].forEach(m => chiamati.add(m[1]));
  const nomeUmano = {
    'nominatim.openstreetmap.org': /OpenStreetMap/i, 'overpass-api.de': /Overpass/i,
    'photon.komoot.io': /Photon/i, 'api.open-meteo.com': /Open-Meteo/i,
    'router.project-osrm.org': /OSRM/i, 'it.wikipedia.org': /Wikipedia/i,
    'api.mymemory.translated.net': /MyMemory/i, 'open.er-api.com': /er-api/i,
    'fonts.googleapis.com': /Google Fonts/i
  };
  const scordati = Object.entries(nomeUmano)
    .filter(([host, re]) => [...chiamati].some(c => c.includes(host)) && !re.test(pag))
    .map(([host]) => host);
  ok('ogni servizio a cui l\'app parla è dichiarato', scordati.length === 0,
     scordati.join(', ') || 'nessuno dimenticato');

  // ── e dentro l'app ci si arriva ──────────────────────────────────────────
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const err = [];
  page.on('pageerror', e => err.push('PAGEERROR: ' + e.message));
  await page.addInitScript(() => localStorage.setItem('geppgo2', JSON.stringify({
    trips: [], settings: {}, myName: 'Gepp' })));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof myPos !== 'undefined', { timeout: 20000 });

  const gate = await page.evaluate(() => {
    const a = document.querySelector('#authGate a[href*="privacy"]');
    return a ? { c: true, testo: a.closest('p').textContent.trim(), href: a.getAttribute('href') } : { c: false };
  });
  ok('chi crea un account vede il link alla privacy', gate.c === true, gate.testo || '');
  ok('e il link porta alla pagina vera', gate.href === 'privacy.html', gate.href || '');

  const prof = await page.evaluate(() => {
    session = { user: { id: 'io', email: 'gepp@x.it' } };
    renderProfile();
    return !!document.querySelector('[onclick="apriPrivacy()"]');
  });
  ok('e dal Profilo si riapre quando si vuole', prof === true);

  console.log('\n' + r.join('\n'));
  const falliti = r.filter(x => x.includes('FALLITO')).length;
  console.log(`\n${r.length - falliti}/${r.length} passati`);
  if (err.length) console.log('\nErrori in pagina:\n' + err.join('\n'));
  await browser.close();
  process.exit(falliti ? 1 : 0);
})();
