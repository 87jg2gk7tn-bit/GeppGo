const { chromium } = require('playwright-core');
const APP = process.env.APP_URL || 'file:///home/user/GeppGo/Index%202.1.html';

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const r = [];
  const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);

  const apri = async (prima, hash = '') => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    if (prima) await page.addInitScript(prima);
    await page.goto(APP + hash, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof myPos !== 'undefined', { timeout: 20000 });
    return page;
  };

  // ── telefono nuovo, mai configurato ───────────────────────────────────────
  let p = await apri(null);
  const nuovo = await p.evaluate(() => ({
    url: window.GEPPGO_SUPA_URL, key: (window.GEPPGO_SUPA_KEY || '').slice(0, 20),
    serie: !!window.GEPPGO_CFG_DI_SERIE
  }));
  ok('su un telefono nuovo il cloud c\'è già', /^https:\/\/[a-z]+\.supabase\.co$/.test(nuovo.url), nuovo.url);
  ok('e la chiave pure', nuovo.key.startsWith('eyJ'), nuovo.key + '...');
  ok('ed è segnata come quella di serie', nuovo.serie === true);

  // il muro della configurazione non deve più comparire
  const muro = await p.evaluate(() => {
    accediOra();
    const cfg = document.getElementById('mCloud');
    return { cfgAperto: cfg.classList.contains('on'), html: document.body.innerText.slice(0, 0) };
  });
  ok('e non chiede più di incollare Project URL e chiave', muro.cfgAperto === false);

  // il pannello, se lo si apre a mano, non mostra la chiave di serie nei campi
  const campi = await p.evaluate(() => { openCloudCfg(); return {
    url: document.getElementById('cfgUrl').value, key: document.getElementById('cfgKey').value }; });
  ok('aprendolo a mano i campi restano vuoti', campi.url === '' && campi.key === '', JSON.stringify(campi));
  await p.close();

  // ── chi ha un proprio Supabase configurato tiene il suo ───────────────────
  p = await apri(() => localStorage.setItem('geppgo_cfg', JSON.stringify({
    url: 'https://mioprogetto.supabase.co', key: 'chiave-mia-lunghissima-1234567890' })));
  const mio = await p.evaluate(() => ({
    url: window.GEPPGO_SUPA_URL, serie: !!window.GEPPGO_CFG_DI_SERIE,
    campo: (openCloudCfg(), document.getElementById('cfgUrl').value)
  }));
  ok('una configurazione personale vince su quella di serie', mio.url === 'https://mioprogetto.supabase.co', mio.url);
  ok('e non viene scambiata per quella di serie', mio.serie === false);
  ok('e nel pannello si rivede la propria', mio.campo === 'https://mioprogetto.supabase.co', mio.campo);
  await p.close();

  // ── una configurazione nell'indirizzo vince anche lei ─────────────────────
  const b64 = Buffer.from('https://daltro.supabase.co|chiave-di-un-altro-progetto-x').toString('base64');
  p = await apri(null, '#c=' + encodeURIComponent(b64));
  const daHash = await p.evaluate(() => ({ url: window.GEPPGO_SUPA_URL, serie: !!window.GEPPGO_CFG_DI_SERIE }));
  ok('la configurazione nell\'indirizzo vince', daHash.url === 'https://daltro.supabase.co', daHash.url);
  ok('e nemmeno quella è "di serie"', daHash.serie === false);
  await p.close();

  console.log('\n' + r.join('\n'));
  const falliti = r.filter(x => x.includes('FALLITO')).length;
  console.log(`\n${r.length - falliti}/${r.length} passati`);
  await browser.close();
  process.exit(falliti ? 1 : 0);
})();
