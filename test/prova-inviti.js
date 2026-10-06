/* GLI INVITI: IL LINK SI COPIA, E UN LINK NON PUÒ CAMBIARE SERVER.
 *
 * Due guasti, tutti e due sulla strada per cui l'app si diffonde: chi
 * organizza manda il link ai compagni.
 *
 * 1. Nella finestra Condividi «📋 Copia il link», il tocco sul link e «Copia
 *    il codice» chiamavano copyText, che non esisteva: errore in console,
 *    appunti invariati, nessuna conferma. Provato con Playwright prima di
 *    correggerlo.
 * 2. Un link «#join2=…~…» o «#c=…» portava dentro indirizzo e chiave di un
 *    Supabase qualsiasi, e l'app li prendeva e li SALVAVA: un link finto
 *    mandava email, password e viaggi di chi lo apriva su un server altrui.
 *
 * Qui si tocca davvero ogni tasto e si leggono gli appunti, in italiano e in
 * inglese, anche quando gli appunti sono rifiutati (Safari) e quando non si
 * riesce a copiare affatto. Si apre l'app con link che portano un altro
 * server e si controlla che non salvi niente e lo dica, anche sopra la
 * schermata di accesso. E si controlla il rovescio, che conta quanto il
 * resto: i link veri, col server di serie - compresi quelli già mandati -
 * entrano nel viaggio come prima.
 */
const { apriBrowser, APP } = require('./browser');

const DI_SERIE = 'https://cyolhqndurgwbivxcssf.supabase.co';
const FINTO = 'https://server-finto.example.com';
const CID = '11111111-2222-3333-4444-555555555555';
const INV = 'abcdef123456';
const b64 = s => Buffer.from(s, 'binary').toString('base64');

const stato = lingua => ({ trips: [{ id: 1, name: 'Praga', destination: 'Praga', currency: 'EUR', status: 'open',
  participants: [{ id: 1, name: 'Gepp', isMe: true }, { id: 2, name: 'Luca' }], suggested: [], pois: [], expenses: [],
  tickets: [], hotels: [], weather: {}, createdAt: Date.now(),
  days: [{ id: 'd1', date: '2026-09-01', title: '', activities: [] }] }],
  currentTripId: 1, settings: lingua ? { lingua } : {}, myName: 'Gepp', skipAuth: true });

/* Le frasi nuove, che devono esserci in tutte le lingue. */
const NUOVE = [
  '📋 Link copiato',
  '📋 Codice copiato',
  'Non riesco a copiarlo da solo: tieni premuto sul testo qui sotto e scegli «Copia».',
  '📤 Invia il link',
  'Questo invito non è valido',
  'Il link porta a un server diverso da quello che usa GeppGo su questo telefono. Per sicurezza l\'ho ignorato e non ho salvato niente: chiedi a chi te l\'ha mandato un invito nuovo, fatto dall\'app.',
  'Ho capito',
];

(async () => {
  const browser = await apriBrowser();
  const r = [];
  const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);

  /* La configurazione salvata si prepara UNA volta per scheda: se la si
     rimettesse a ogni caricamento, dopo un riavvio non si saprebbe più se
     l'ha scritta l'app o la prova. */
  async function apri({ lingua, hash = '', cfg } = {}) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, permissions: ['clipboard-read', 'clipboard-write'] });
    page._errori = [];
    page.on('pageerror', e => page._errori.push(e.message.split('\n')[0]));
    page.on('console', m => { if (m.type() === 'error' && !/ERR_|net::|Failed to load resource/.test(m.text())) page._errori.push('console: ' + m.text().slice(0, 140)); });
    await page.addInitScript(([s, c]) => {
      if (sessionStorage.getItem('__prova')) return;
      sessionStorage.setItem('__prova', '1');
      localStorage.setItem('geppgo2', JSON.stringify(s));
      /* «nessuna configurazione» arriva qui come null, non come undefined:
         Playwright non sa passare undefined dentro un elenco. */
      if (c == null) localStorage.removeItem('geppgo_cfg'); else localStorage.setItem('geppgo_cfg', c);
    }, [stato(lingua), cfg]);
    await page.goto(APP + hash, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof go === 'function' && !document.getElementById('bootSplash'), { timeout: 20000 });
    await page.waitForTimeout(300);
    return page;
  }
  const appunti = p => p.evaluate(() => navigator.clipboard.readText().catch(e => 'NON LEGGIBILE: ' + e.message));
  /* Sul codice di prima qualcosa non c'è (una funzione, un tasto): la prova
     deve dire FALLITO col motivo, non fermarsi a metà. */
  const tocca = async (p, sel) => { try { await p.click(sel, { timeout: 3000 }); return ''; } catch (e) { return 'non toccabile: ' + sel; } };
  const chiedi = async (p, fn, arg) => { try { return await p.evaluate(fn, arg); } catch (e) { return { errore: e.message.split('\n')[0] }; } };
  /* I tasti si trovano dalla forma della finestra, non dal testo né dalla
     funzione che chiamano: uguali in ogni lingua e in ogni versione. */
  const TASTO_LINK = '#shareBody .share-link + div button:last-child';
  const TASTO_CODICE = '#shareBody details button';
  const avviso = p => p.evaluate(() => {
    const m = document.getElementById('mConfirm');
    const annulla = document.querySelector('#mConfirm .confirm-a .btn-soft');
    return { aperto: m.classList.contains('active'), titolo: document.getElementById('cfTitle').textContent,
      testo: document.getElementById('cfMsg').textContent, tasto: document.getElementById('cfOk').textContent,
      annulla: annulla ? getComputedStyle(annulla).display : '' };
  });
  const aspettaAvviso = p => p.waitForFunction(() => document.getElementById('mConfirm').classList.contains('active'), { timeout: 4000 }).catch(() => {});
  /* La finestra Condividi come la vede chi ha un account e il viaggio nel
     cloud. Il cloud vero qui non c'è (la rete è chiusa): basta che l'app
     creda di esserci, perché per costruire il link non lo interroga. */
  const condividi = p => p.evaluate(([cid, inv]) => {
    window.GEPPGO_PUBLIC_URL = 'https://esempio.github.io/GeppGo/';
    sb = {}; session = { user: { id: 'u1' } };
    const t = T(); t.cid = cid; t._invite = inv; t._admin = true;
    openShare();
    const payload = cid + ':' + inv + '~' + btoa(GEPPGO_SUPA_URL + '|' + GEPPGO_SUPA_KEY);
    return { payload, link: baseApp() + '#join2=' + encodeURIComponent(payload) };
  }, [CID, INV]);

  // ── 1. i tre tasti di copia, in italiano e in inglese ─────────────────
  for (const [lingua, linkOk, codiceOk] of [['it', '📋 Link copiato', '📋 Codice copiato'], ['en', '📋 Link copied', '📋 Code copied']]) {
    const p = await apri({ lingua });
    const atteso = await condividi(p);
    await p.waitForTimeout(300);
    const tasti = [
      ['il tocco sul link', () => tocca(p, '#shareBody .share-link'), atteso.link, linkOk],
      ['«📋 Copia il link»', () => tocca(p, TASTO_LINK), atteso.link, linkOk],
      ['«Copia il codice»', async () => (await tocca(p, '#shareBody details summary')) || tocca(p, TASTO_CODICE), atteso.payload, codiceOk],
    ];
    for (const [nome, tocca, testo, conferma] of tasti) {
      await p.evaluate(() => { navigator.clipboard.writeText('SENTINELLA'); document.querySelectorAll('.toast').forEach(x => x.remove()); });
      const prima = p._errori.length;
      const noTocco = await tocca();
      if (noTocco) p._errori.push(noTocco);
      await p.waitForTimeout(350);
      const avvisoBreve = await p.evaluate(() => { const t = document.querySelector('.toast'); return t ? t.textContent : ''; });
      const copiato = await appunti(p);
      const nuovi = p._errori.slice(prima);
      ok(`[${lingua}] ${nome}: niente errori, conferma «${conferma}», testo negli appunti`,
         !nuovi.length && avvisoBreve === conferma && copiato === testo,
         `errori: ${nuovi.join(' | ') || 'nessuno'} · conferma: «${avvisoBreve}» · appunti: «${copiato.slice(0, 50)}…»`);
    }
    await p.close();
  }

  // ── 1b. Safari che rifiuta gli appunti: si copia lo stesso ────────────
  {
    const p = await apri({ lingua: 'it' });
    const atteso = await condividi(p);
    await p.evaluate(() => {
      const vera = navigator.clipboard.writeText.bind(navigator.clipboard);
      vera('SENTINELLA');
      navigator.clipboard.writeText = () => Promise.reject(new DOMException('rifiutato', 'NotAllowedError'));
    });
    await tocca(p, TASTO_LINK);
    await p.waitForTimeout(350);
    const conferma = await p.evaluate(() => { const t = document.querySelector('.toast'); return t ? t.textContent : ''; });
    const copiato = await appunti(p);
    ok('con gli appunti rifiutati, il link arriva negli appunti per l\'altra strada',
       copiato === atteso.link && conferma === '📋 Link copiato', `conferma «${conferma}» · appunti «${copiato.slice(0, 40)}…»`);
    await p.close();
  }

  // ── 1c. non si riesce a copiare affatto: testo selezionato e «Invia il link»
  for (const lingua of ['it', 'en']) {
    const p = await apri({ lingua });
    const atteso = await condividi(p);
    await p.evaluate(() => {
      navigator.clipboard.writeText = () => Promise.reject(new DOMException('rifiutato', 'NotAllowedError'));
      document.execCommand = () => false;
      navigator.share = async d => { window.__condiviso = d; };
      document.querySelectorAll('.toast').forEach(x => x.remove());
    });
    const prima = p._errori.length;
    await tocca(p, TASTO_LINK);
    await p.waitForTimeout(350);
    const m = await p.evaluate(() => {
      const box = document.getElementById('copiaManuale'), ta = box && box.querySelector('textarea');
      return { c: !!box, visibile: !!box && box.getBoundingClientRect().height > 0, testo: ta ? ta.value : '',
        selezionato: ta ? (document.activeElement === ta && ta.selectionStart === 0 && ta.selectionEnd === ta.value.length) : false,
        frase: box ? box.querySelector('.cm-t').textContent : '', invia: !!(box && box.querySelector('button')),
        toast: (document.querySelector('.toast') || {}).textContent || '' };
    });
    const attesaFrase = lingua === 'en' ? 'I can’t copy it myself: press and hold the text below and choose “Copy”.' : NUOVE[2];
    ok(`[${lingua}] se non si copia: il testo resta a schermo già selezionato, e lo dice`,
       m.visibile && m.testo === atteso.link && m.selezionato && m.frase === attesaFrase && !p._errori.slice(prima).length,
       JSON.stringify({ visibile: m.visibile, selezionato: m.selezionato, frase: m.frase.slice(0, 40) }));
    ok(`[${lingua}] e non dice «copiato» senza averlo copiato`, !/copi/i.test(m.toast), m.toast || 'nessun avviso');
    if (m.invia) await tocca(p, '#copiaManuale button');
    await p.waitForTimeout(200);
    const condiviso = await p.evaluate(() => window.__condiviso || null);
    ok(`[${lingua}] e c'è «Invia il link», che manda proprio quel link`, m.invia && condiviso && condiviso.url === atteso.link,
       condiviso ? condiviso.url.slice(0, 40) : 'non offerto');
    await p.close();
  }

  // ── 2. link con un server finto: non si salva niente, e lo si dice ─────
  const linkFinto = '#join2=' + encodeURIComponent(CID + ':' + INV + '~' + b64(FINTO + '|chiave-finta'));
  for (const [nome, cfg] of [['senza configurazione salvata', undefined],
    ['con la configurazione che le versioni vecchie salvavano', JSON.stringify({ url: DI_SERIE, key: 'chiave-vecchia-ma-del-server-di-serie' })]]) {
    const p = await apri({ hash: linkFinto, cfg });
    await aspettaAvviso(p);
    const dopo = await p.evaluate(() => ({ cfg: localStorage.getItem('geppgo_cfg'), url: GEPPGO_SUPA_URL, attesa: pendingJoin2, hash: location.hash }));
    const a = await avviso(p);
    ok(`invito con server finto (${nome}): la configurazione salvata resta com'era`,
       dopo.cfg === (cfg === undefined ? null : cfg), String(dopo.cfg).slice(0, 60));
    ok('l\'app resta sul suo server, e nessun invito resta in sospeso',
       dopo.url === DI_SERIE && dopo.attesa === null && !/join2/.test(dopo.hash), `${dopo.url} · in sospeso: ${dopo.attesa}`);
    ok('compare «Questo invito non è valido», con un tasto solo',
       a.aperto && a.titolo === 'Questo invito non è valido' && a.tasto === 'Ho capito' && a.annulla === 'none', JSON.stringify(a).slice(0, 120));
    /* Chi apre un invito senza account ha davanti la schermata di accesso:
       l'avviso deve stare sopra, non sotto. */
    const sopra = await p.evaluate(() => {
      document.getElementById('authGate').style.display = 'flex';
      const b = document.getElementById('cfOk').getBoundingClientRect();
      const e = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      return e && (e.id === 'cfOk' || !!e.closest('#cfOk'));
    });
    ok('e l\'avviso si vede anche sopra la schermata di accesso', sopra);
    await p.close();
  }
  {
    const p = await apri({ hash: '#c=' + encodeURIComponent(b64(FINTO + '|chiave-finta')) });
    await aspettaAvviso(p);
    const dopo = await p.evaluate(() => ({ cfg: localStorage.getItem('geppgo_cfg'), url: GEPPGO_SUPA_URL, hash: location.hash }));
    const a = await avviso(p);
    const nelLink = (() => { try { return Buffer.from(decodeURIComponent(dopo.hash.slice(3)), 'base64').toString().split('|')[0]; } catch (e) { return ''; } })();
    ok('indirizzo «#c=» con server finto: niente salvato, server di serie, avviso',
       dopo.cfg === null && dopo.url === DI_SERIE && a.aperto && a.titolo === 'Questo invito non è valido',
       `cfg ${dopo.cfg} · ${dopo.url} · avviso ${a.aperto}`);
    ok('e l\'indirizzo torna a portare il server vero', nelLink === DI_SERIE, nelLink);
    await p.close();
  }
  {
    const p = await apri({});
    const r2 = await chiedi(p, async ([cid, inv, finto]) => {
      window.__rpc = [];
      sb = { rpc: async (n, a) => { __rpc.push([n, a]); return { error: null }; } }; session = { user: { id: 'u1' } };
      await doJoin2(cid + ':' + inv + '~' + btoa(finto + '|k'));
      await new Promise(s => setTimeout(s, 300));
      return { rpc: __rpc.length, cfg: localStorage.getItem('geppgo_cfg'), url: GEPPGO_SUPA_URL };
    }, [CID, INV, FINTO]);
    const a = await avviso(p);
    ok('codice incollato in «Ho un codice» con server finto: non entra, non salva, avvisa',
       r2.rpc === 0 && r2.cfg === null && r2.url === DI_SERIE && a.aperto && a.titolo === 'Questo invito non è valido', JSON.stringify(r2));
    await p.close();
  }
  {
    const p = await apri({});
    const r3 = await chiedi(p, async ([link]) => {
      window.__resta = 'questa pagina';
      openCloudCfg();
      document.getElementById('cfgInvito').value = 'https://esempio.github.io/GeppGo/' + link;
      usaInvito();
      await new Promise(s => setTimeout(s, 1200));
      return { cfg: localStorage.getItem('geppgo_cfg'), msg: document.getElementById('cfgInvMsg').textContent, resta: window.__resta };
    }, [linkFinto]);
    const a = await avviso(p);
    ok('link finto incollato in «Configura cloud»: non salva, non riavvia, avvisa',
       r3.cfg === null && r3.resta === 'questa pagina' && r3.msg === 'Questo invito non è valido' && a.aperto, JSON.stringify(r3));
    /* Il controllo guarda il server vero, non come comincia l'indirizzo. */
    const somiglianti = await chiedi(p, base => [
      geppgoServerDelLinkVa(btoa(base + '.server-finto.example.com|k')),
      geppgoServerDelLinkVa(btoa(base + '@server-finto.example.com|k')),
      geppgoServerDelLinkVa('non-è-base64!'),
      geppgoServerDelLinkVa(btoa(base + '/|k')),
    ], DI_SERIE);
    ok('i server che somigliano a quello vero non passano; la barra in fondo sì',
       Array.isArray(somiglianti) && somiglianti.join() === 'false,false,false,true', JSON.stringify(somiglianti));
    await p.close();
  }

  // ── 3. link col server di serie: l'invito entra come prima ────────────
  for (const [nome, link] of [
    ['come lo costruisce l\'app (e come sono quelli già mandati)', '#join2=' + encodeURIComponent(CID + ':' + INV + '~' + b64(DI_SERIE + '|' + 'qualsiasi-chiave'))],
    ['senza il pezzo del server, come i più vecchi', '#join2=' + encodeURIComponent(CID + ':' + INV)]]) {
    const p = await apri({ hash: link });
    await p.waitForTimeout(1200);
    const dopo = await p.evaluate(() => ({ cfg: localStorage.getItem('geppgo_cfg'), url: GEPPGO_SUPA_URL, attesa: pendingJoin2, hash: location.hash }));
    const a = await avviso(p);
    ok(`invito col server di serie (${nome}): resta in attesa dell'accesso, senza avvisi`,
       dopo.attesa === CID + ':' + INV && !a.aperto && dopo.url === DI_SERIE, `in sospeso: ${dopo.attesa} · avviso ${a.aperto}`);
    ok('e non salva niente: il server di serie non ha bisogno di essere salvato', dopo.cfg === null, String(dopo.cfg));
    /* Dopo l'accesso parte la stessa strada di prima: join_trip col codice,
       il viaggio arriva, e si sceglie chi si è. */
    const entra = await chiedi(p, async ([cid, inv]) => {
      window.__rpc = [];
      const risposta = tab => tab === 'trips'
        ? { data: [{ id: cid, invite_code: inv, owner: 'chi-ha-invitato', data: { id: 77, name: 'Viaggio di Luca', destination: 'Vienna', currency: 'EUR', status: 'open',
            participants: [{ id: 5, name: 'Luca' }, { id: 6, name: 'Gepp' }], suggested: [], days: [{ id: 'v1', date: '2026-09-02', title: '', activities: [] }],
            pois: [], expenses: [], tickets: [], hotels: [], weather: {}, createdAt: 1 } }] }
        : { data: [{ trip_id: cid, user_id: 'u1', participant_id: null, ruolo: 'compagno' }] };
      sb = { rpc: async (n, a) => { __rpc.push([n, a]); return { error: null }; },
        from: tab => { const q = { select: () => q, eq: () => q, then: (ok2) => ok2(risposta(tab)) }; return q; } };
      session = { user: { id: 'u1' } }; myUid = 'u1';
      const c = pendingJoin2; pendingJoin2 = null;
      await doJoin2(c);
      await new Promise(s => setTimeout(s, 400));
      return { rpc: __rpc, dentro: app.trips.some(t => t.cid === cid), chiSei: document.getElementById('mJoin').classList.contains('active') };
    }, [CID, INV]);
    ok('dopo l\'accesso: join_trip col codice giusto, il viaggio arriva, si sceglie chi si è',
       !entra.errore && entra.rpc.length === 1 && entra.rpc[0][0] === 'join_trip' && entra.rpc[0][1].p_trip === CID && entra.rpc[0][1].p_code === INV && entra.dentro && entra.chiSei,
       JSON.stringify(entra).slice(0, 140));
    await p.close();
  }
  {
    const p = await apri({});
    const r4 = await chiedi(p, async ([cid, inv, base]) => {
      window.__rpc = [];
      sb = { rpc: async (n, a) => { __rpc.push([n, a]); return { error: 'fermo qui' }; } }; session = { user: { id: 'u1' } };
      await doJoin2(cid + ':' + inv + '~' + btoa(base + '|k'));
      return __rpc;
    }, [CID, INV, DI_SERIE]);
    ok('codice incollato col server di serie: va dritto a join_trip, come prima',
       Array.isArray(r4) && r4.length === 1 && r4[0][1].p_trip === CID && r4[0][1].p_code === INV, JSON.stringify(r4));
    await p.close();
  }
  {
    /* Incollato in «Configura cloud», un invito vero riavvia l'app sull'invito,
       come prima - ma senza salvare il server. */
    const p = await apri({});
    const linkVero = '#join2=' + encodeURIComponent(CID + ':' + INV + '~' + b64(DI_SERIE + '|k'));
    const riavvio = p.waitForNavigation({ timeout: 15000 }).catch(() => {});
    await p.evaluate(link => { openCloudCfg(); document.getElementById('cfgInvito').value = 'https://esempio.github.io/GeppGo/' + link; usaInvito(); }, linkVero);
    await riavvio;
    await p.waitForFunction(() => typeof go === 'function' && !document.getElementById('bootSplash'), { timeout: 20000 }).catch(() => {});
    await p.waitForTimeout(300);
    const dopo = await p.evaluate(() => ({ attesa: typeof pendingJoin2 === 'undefined' ? 'nessuno' : pendingJoin2, cfg: localStorage.getItem('geppgo_cfg') }));
    ok('invito vero incollato in «Configura cloud»: si riparte sull\'invito, senza salvare il server',
       dopo.attesa === CID + ':' + INV && dopo.cfg === null, JSON.stringify(dopo));
    await p.close();
  }

  // ── 4. le frasi nuove ci sono in tutte e cinque le lingue ──────────────
  for (const lingua of ['it', 'en', 'es', 'fr', 'pt']) {
    const p = await apri({ lingua });
    const l4 = await p.evaluate(nuove => ({
      scelta: linguaScelta(),
      mancano: linguaScelta() === 'it' ? [] : nuove.filter(f => !DIZIONARIO[linguaScelta()][f] || DIZIONARIO[linguaScelta()][f] === f),
      dette: nuove.map(f => t(f)),
    }), NUOVE);
    const senzaAvviso = await chiedi(p, () => { avvisaLinkNonValido(); return ''; });
    await p.waitForTimeout(300);
    const a = await avviso(p);
    await p.evaluate(() => { closeSheet('mConfirm'); });
    const atteseAvviso = l4.dette[4] + '|' + l4.dette[5] + '|' + l4.dette[6];
    ok(`[${lingua}] le frasi nuove sono tradotte, e l'avviso esce nella lingua giusta`,
       !senzaAvviso && l4.scelta === lingua && !l4.mancano.length && a.titolo + '|' + a.testo + '|' + a.tasto === atteseAvviso
       && (lingua === 'it' || (a.titolo !== NUOVE[4] && l4.dette[1] !== NUOVE[1])),
       l4.mancano.length ? 'mancano: ' + l4.mancano.join(' / ').slice(0, 100) : `«${a.titolo}» · «${l4.dette[1]}»`);
    await p.close();
  }

  await browser.close();
  console.log('\n' + r.join('\n'));
  const falliti = r.filter(x => x.includes('FALLITO')).length;
  console.log(`\n${r.length - falliti}/${r.length} passati`);
  process.exit(falliti ? 1 : 0);
})();
