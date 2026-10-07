/* I LINK DELLE EMAIL: RECUPERO, ACCESSO E CONFERMA.

   Toccato il link di una mail, Supabase riapre l'app con i token dopo il
   cancelletto. Prima l'app riscriveva il cancelletto in «#c=...» durante il
   caricamento e i token sparivano: il link apriva l'app senza far entrare.
   E «Ho un codice» verificava tutto come recupero.

   Qui l'app e' servita da un'origine https finta (e, per l'indirizzo
   pubblico, da quella di GitHub Pages), e supabase-js e' finto: registra
   cosa gli chiede l'app e risponde come il servizio vero. Le prove:
   1. #access_token=...&type=recovery: dentro, e il foglio «Nuova password»;
   2. type=magiclink: dentro;
   3. type=signup: dentro, con «Account confermato»;
   4. #error_description=... (link scaduto): il messaggio col tasto per un
      link nuovo, e il tasto lo chiede davvero;
   5. dopo la lettura nella barra non restano token;
   6. #join=, #join2= e #c= come prima, e l'invito col server finto rifiutato;
   7. un link incollato in «Ho un codice» vale per recupero, accesso e
      conferma;
   8. il codice a 6 cifre usa il tipo dell'ultima richiesta, o prova i tipi
      in ordine;
   9. la registrazione passa emailRedirectTo; sull'origine di Pages vale la
      costante, altrove l'indirizzo calcolato;
   10. i testi nuovi in cinque lingue.
   E il recupero della password, obbligatorio (R1-R7): dopo un link o un
   codice di recupero il foglio non ha la croce, non si chiude e copre tutto;
   «Annulla» fa uscire; dopo una ricarica torna; salvata la password si esce
   dagli altri dispositivi; l'accesso normale non lo apre; le lingue. */
const fs = require('fs');
const path = require('path');
const { apriBrowser, APP, RADICE } = require('./browser');

/* Il file e' quello indicato da APP_URL, se c'e': cosi' la controprova sul
   codice vecchio prova davvero il codice vecchio. */
const FILE_APP = APP.startsWith('file://') ? decodeURIComponent(APP.slice(7)) : path.join(RADICE, 'Index 2.1.html');
const HTML = fs.readFileSync(FILE_APP, 'utf8');
const DI_SERIE = 'https://cyolhqndurgwbivxcssf.supabase.co';
const FINTO = 'https://cattivo.example.com';
const PAGES = 'https://87jg2gk7tn-bit.github.io';
const COSTANTE = 'https://87jg2gk7tn-bit.github.io/GeppGo/Index%202.1.html';
const LOCALE = 'https://geppgo.prova';
const EMAIL = 'gepp@esempio.it';
const b64 = s => Buffer.from(s).toString('base64');
const OGGI = new Date().toISOString().split('T')[0];

const r = [];
const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);
const errori = [];

/* Un supabase-js finto: registra le chiamate in window.__supa e risponde
   come il servizio vero. window.__giusto dice quale token o codice e' buono,
   e con che tipo. */
const SUPA_FINTO = `(()=>{
  const reg=window.__supa={opzioni:null,chiamate:[]};
  const vuoto={data:[],error:null};
  const catena=()=>{const f=function(){};const p=new Proxy(f,{get:(t,k)=>k==='then'?(ok=>ok(vuoto)):(()=>p),apply:()=>p});return p;};
  const ascolta=[];
  /* La sessione sta in localStorage, come la tiene la libreria vera: cosi'
     una ricarica la ritrova. */
  const CHIAVE='sb-cyolhqndurgwbivxcssf-auth-token';
  let sess=null;try{sess=JSON.parse(localStorage.getItem(CHIAVE)||'null');}catch(e){}
  const utente={id:'u-1',email:'${EMAIL}'};
  const avvisa=(ev,s)=>ascolta.forEach(cb=>{try{cb(ev,s);}catch(e){}});
  const entra=(s,ev)=>{sess=s;try{localStorage.setItem(CHIAVE,JSON.stringify(s));}catch(e){}avvisa(ev||'SIGNED_IN',s);};
  const si=s=>({data:{user:s.user,session:s},error:null});
  const no=m=>({data:{user:null,session:null},error:{message:m}});
  const auth={
    onAuthStateChange(cb){ascolta.push(cb);return{data:{subscription:{unsubscribe(){}}}};},
    async getSession(){return{data:{session:sess},error:null};},
    async setSession(t){reg.chiamate.push(['setSession',t]);if(t.access_token==='scaduto')return no('Invalid JWT');const s={access_token:t.access_token,refresh_token:t.refresh_token,user:utente};entra(s);return si(s);},
    async verifyOtp(a){reg.chiamate.push(['verifyOtp',a]);const g=window.__giusto||{};
      const va=(a.token_hash&&a.token_hash===g.token_hash&&a.type===g.type)||(a.token&&a.token===g.token&&a.type===g.type&&a.email===g.email);
      if(!va)return no('Token has expired or is invalid');const s={access_token:'x',refresh_token:'y',user:utente};
      entra(s,a.type==='recovery'?'PASSWORD_RECOVERY':'SIGNED_IN');return si(s);},
    async signInWithPassword(a){reg.chiamate.push(['signInWithPassword',a]);if(a.password!=='giusta123')return no('Invalid login credentials');
      const s={access_token:'pw',refresh_token:'pw',user:utente};entra(s);return si(s);},
    async resetPasswordForEmail(e,o){reg.chiamate.push(['resetPasswordForEmail',e,o]);return{data:{},error:null};},
    async signInWithOtp(a){reg.chiamate.push(['signInWithOtp',a]);return{data:{},error:null};},
    async signUp(a){reg.chiamate.push(['signUp',a]);return{data:{user:{id:'u-2',email:a.email,identities:[{id:'i'}]},session:null},error:null};},
    async resend(a){reg.chiamate.push(['resend',a]);return{data:{},error:null};},
    async updateUser(a){reg.chiamate.push(['updateUser',a]);return{data:{user:utente},error:null};},
    async signOut(o){reg.chiamate.push(['signOut',o||null]);if(o&&o.scope==='others')return{error:null};
      sess=null;try{localStorage.removeItem(CHIAVE);}catch(e){}avvisa('SIGNED_OUT',null);return{error:null};},
    async exchangeCodeForSession(){return no('no');}
  };
  const client=new Proxy({auth},{get:(t,k)=>k in t?t[k]:(k==='then'?undefined:catena())});
  window.supabase={createClient:(u,k,o)=>{reg.opzioni=o;reg.url=u;return client;}};
})();`;

const viaggio = (extra = {}) => Object.assign({
  trips: [{ id: 1, name: 'Kyoto', destination: 'Kyoto', currency: 'EUR', status: 'open', start: OGGI, end: OGGI,
    participants: [{ id: 1, name: 'Gepp', isMe: true }], suggested: [], pois: [], hotels: [], tickets: [], weather: {}, createdAt: 1,
    expenses: [], days: [{ id: 'd1', date: OGGI, title: '', activities: [] }] }],
  currentTripId: 1, settings: { proxRadius: 200 }, myName: 'Gepp', skipAuth: false, consentNotif: true
}, extra);

/* L'app servita da un'origine https (quella finta, o quella di Pages a un
   percorso a scelta), come la apre un telefono che ha toccato il link. */
async function apri(browser, { hash = '', search = '', stato = viaggio(), lingua = null, origine = LOCALE, percorso = '/Index%202.1.html', ls = null, giusto = null } = {}) {
  const page = await browser.newPage({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
  page.on('pageerror', e => errori.push('PAGEERROR: ' + e.message.split('\n')[0]));
  await page.route(origine + '/**', ro => {
    const p = decodeURIComponent(new URL(ro.request().url()).pathname);
    if (/\.html$/.test(p) || p.endsWith('/')) return ro.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: HTML });
    const f = path.join(RADICE, path.basename(p));
    if (/\.(svg|webmanifest)$/.test(p) && fs.existsSync(f)) return ro.fulfill({ status: 200, body: fs.readFileSync(f) });
    return ro.fulfill({ status: 404, body: '' });
  });
  await page.route('**/supabase-js@*/**', ro => ro.fulfill({ status: 200, contentType: 'application/javascript', body: SUPA_FINTO }));
  await page.addInitScript(([s, l, x, g]) => {
    if (g) window.__giusto = g;
    /* I messaggi brevi si contano tutti: uno caccia l'altro, e la prova
       vuole vederli anche se sono durati poco. */
    window.__toast = [];
    document.addEventListener('DOMContentLoaded', () => new MutationObserver(m => m.forEach(x => x.addedNodes.forEach(n => {
      if (n.classList && n.classList.contains('toast')) window.__toast.push(n.textContent);
    }))).observe(document.body, { childList: true }));
    if (localStorage.getItem('prova-link') || sessionStorage.getItem('prova-link')) return;
    localStorage.clear();
    const st = JSON.parse(JSON.stringify(s)); if (l) st.settings.lingua = l;
    localStorage.setItem('geppgo2', JSON.stringify(st));
    localStorage.setItem('geppgo2_intro', '1');
    if (x) Object.keys(x).forEach(k => localStorage.setItem(k, x[k]));
    localStorage.setItem('prova-link', '1'); sessionStorage.setItem('prova-link', '1');
  }, [stato, lingua, ls, giusto]);
  await page.goto(origine + percorso + search + hash, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.renderAll === 'function' && !document.getElementById('bootSplash'), null, { timeout: 30000 });
  await page.waitForFunction(() => window.__supa && window.__supa.opzioni, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(900);
  return page;
}
const prova = async (nome, fn) => {
  try { await fn(); } catch (e) { ok(nome, false, 'si è fermata: ' + e.message.split('\n')[0]); }
};
const stato = p => p.evaluate(() => ({
  dentro: typeof session !== 'undefined' && !!session,
  nuovaPw: document.getElementById('mNewPass').classList.contains('active'),
  gate: getComputedStyle(document.getElementById('authGate')).display,
  toast: window.__toast.slice(),
  href: location.href,
  setSession: (window.__supa ? window.__supa.chiamate : []).filter(c => c[0] === 'setSession').map(c => c[1])
}));
const tokenNellaBarra = href => /access_token|refresh_token|error_description|error_code|[#&?]error=/.test(href);
const chiamate = (p, nome) => p.evaluate(n => (window.__supa ? window.__supa.chiamate : []).filter(c => c[0] === n).map(c => c.slice(1)), nome);
const linkMail = tipo => `#access_token=AT-${tipo}&expires_at=9999999999&expires_in=3600&refresh_token=RT-${tipo}&token_type=bearer&type=${tipo}`;
const SCADUTO = '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired';

(async () => {
  const browser = await apriBrowser();
  const barre = [];

  /* ── 1, 2, 3, 5. il link toccato: dentro, secondo il tipo ─────────────── */
  await prova('1-2-3', async () => {
    let p = await apri(browser, { hash: linkMail('recovery') });
    await p.waitForTimeout(600);
    let s = await stato(p);
    ok('1. link di recupero: accesso fatto con i token del link', s.dentro && s.setSession.length === 1 && s.setSession[0].access_token === 'AT-recovery' && s.setSession[0].refresh_token === 'RT-recovery',
       JSON.stringify(s.setSession));
    ok('1. e il foglio «Nuova password» è aperto subito', s.nuovaPw && s.gate === 'none', JSON.stringify({ nuovaPw: s.nuovaPw, gate: s.gate }));
    barre.push(['recupero', s.href, s.dentro && s.nuovaPw]);
    await p.close();

    p = await apri(browser, { hash: linkMail('magiclink') });
    s = await stato(p);
    ok('2. link di accesso: accesso fatto, senza fogli in più', s.dentro && s.setSession.length === 1 && !s.nuovaPw && s.gate === 'none' && s.toast.includes('Accesso effettuato'),
       JSON.stringify({ dentro: s.dentro, nuovaPw: s.nuovaPw, toast: s.toast }));
    barre.push(['accesso', s.href, s.dentro]);
    await p.close();

    p = await apri(browser, { hash: linkMail('signup') });
    s = await stato(p);
    ok('3. link di conferma: accesso fatto e «Account confermato»', s.dentro && s.setSession.length === 1 && !s.nuovaPw && s.toast.includes('Account confermato'),
       JSON.stringify({ dentro: s.dentro, toast: s.toast }));
    barre.push(['conferma', s.href, s.dentro]);
    await p.close();
  });

  /* ── 4. il link scaduto ──────────────────────────────────────────────── */
  await prova('4', async () => {
    /* La richiesta l'ha fatta questo telefono: il tasto la rifa' uguale. */
    let p = await apri(browser, { hash: SCADUTO, ls: { geppgo2_richiesta_email: JSON.stringify({ tipo: 'recovery', email: EMAIL, t: Date.now() }) } });
    let s = await p.evaluate(() => {
      const c = document.getElementById('mConfirm'), b = document.getElementById('cfOk'), q = b.getBoundingClientRect();
      const sopra = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2);
      return { aperto: c.classList.contains('active'), titolo: document.getElementById('cfTitle').textContent, testo: document.getElementById('cfMsg').textContent,
        tasto: b.textContent, siTocca: sopra === b || b.contains(sopra), dentro: !!session, href: location.href };
    });
    ok('4. link scaduto: il messaggio lo dice, col tasto per un link nuovo, sopra la schermata d\'accesso',
       s.aperto && s.titolo === 'Il link della mail non vale più' && /già stato usato o è scaduto/.test(s.testo) && s.tasto === 'Chiedi un link nuovo' && s.siTocca && !s.dentro,
       JSON.stringify(s));
    barre.push(['scaduto', s.href, s.aperto]);
    await p.click('#cfOk');
    await p.waitForTimeout(500);
    const nuova = await chiamate(p, 'resetPasswordForEmail');
    const avviso = await p.evaluate(() => window.__toast.slice());
    ok('4. e il tasto chiede davvero un link nuovo, dello stesso tipo e allo stesso indirizzo',
       nuova.length === 1 && nuova[0][0] === EMAIL && nuova[0][1] && nuova[0][1].redirectTo === LOCALE + '/Index%202.1.html' && avviso.some(t => t.includes(EMAIL)),
       JSON.stringify({ nuova, avviso }));
    await p.close();
    /* La richiesta l'ha fatta un'altra memoria (l'app sulla Home): il tasto
       apre l'accesso, con due parole su cosa fare. */
    p = await apri(browser, { hash: SCADUTO });
    await p.click('#cfOk');
    await p.waitForTimeout(400);
    s = await p.evaluate(() => ({ gate: getComputedStyle(document.getElementById('authGate')).display, main: document.getElementById('auMain').style.display, msg: document.getElementById('auMsg').textContent }));
    ok('4. senza una richiesta su questo telefono, il tasto apre l\'accesso e dice cosa fare', s.gate === 'flex' && s.main === 'block' && /Password dimenticata\?/.test(s.msg), JSON.stringify(s));
    await p.close();
  });

  /* ── 5. niente token nella barra ─────────────────────────────────────── */
  await prova('5', async () => {
    /* Conta solo se il link e' stato anche usato: il codice di prima la
       barra la puliva lo stesso, ma buttando via i token senza leggerli. */
    const sporche = barre.filter(([, h]) => tokenNellaBarra(h)), nonLetti = barre.filter(([, , letto]) => !letto);
    ok('5. dopo la lettura nella barra degli indirizzi non restano token', barre.length === 4 && !sporche.length && !nonLetti.length && barre.every(([, h]) => /#c=/.test(h)),
       (sporche.length ? 'token: ' + sporche.map(x => x[0]).join(', ') : '') + (nonLetti.length ? ' non letti: ' + nonLetti.map(x => x[0]).join(', ') : '') ||
       barre.map(([n, h]) => n + ': ' + h.replace(/#c=.*/, '#c=…')).join(' | '));
  });

  /* ── 6. gli inviti come prima ────────────────────────────────────────── */
  await prova('6', async () => {
    const CID = 'cid-1', INV = 'inv-1';
    let p = await apri(browser, { hash: '#join2=' + encodeURIComponent(CID + ':' + INV + '~' + b64(DI_SERIE + '|k')), stato: viaggio({ skipAuth: true }) });
    let s = await p.evaluate(() => ({ attesa: pendingJoin2, rifiutato: GEPPGO_LINK_RIFIUTATO, link: GEPPGO_LINK_EMAIL, hash: location.hash.slice(0, 3), avviso: document.getElementById('mConfirm').classList.contains('active') }));
    ok('6. #join2= col server di serie: l\'invito resta in attesa come prima', s.attesa === CID + ':' + INV && !s.rifiutato && !s.avviso && s.hash === '#c=', JSON.stringify(s));
    await p.close();
    p = await apri(browser, { hash: '#join2=' + encodeURIComponent(CID + ':' + INV + '~' + b64(FINTO + '|chiave-finta')), stato: viaggio({ skipAuth: true }) });
    s = await p.evaluate(() => ({ attesa: pendingJoin2, rifiutato: GEPPGO_LINK_RIFIUTATO, url: GEPPGO_SUPA_URL, cfg: localStorage.getItem('geppgo_cfg'),
      avviso: document.getElementById('mConfirm').classList.contains('active') ? document.getElementById('cfTitle').textContent : '' }));
    ok('6. #join2= con un server finto: rifiutato, niente salvato, l\'avviso', s.rifiutato && !s.attesa && s.url === 'https://cyolhqndurgwbivxcssf.supabase.co' && !s.cfg && s.avviso === 'Questo invito non è valido', JSON.stringify(s));
    await p.close();
    p = await apri(browser, { hash: '#c=' + encodeURIComponent(b64(DI_SERIE + '|k')), stato: viaggio({ skipAuth: true }) });
    s = await p.evaluate(() => ({ rifiutato: GEPPGO_LINK_RIFIUTATO, link: GEPPGO_LINK_EMAIL, hash: location.hash.slice(0, 3) }));
    ok('6. #c= col server di serie: accettato, la configurazione resta nell\'indirizzo', !s.rifiutato && !s.link && s.hash === '#c=', JSON.stringify(s));
    await p.close();
    p = await apri(browser, { hash: '#c=' + encodeURIComponent(b64(FINTO + '|chiave-finta')), stato: viaggio({ skipAuth: true }) });
    s = await p.evaluate(() => ({ rifiutato: GEPPGO_LINK_RIFIUTATO, url: GEPPGO_SUPA_URL, cfg: localStorage.getItem('geppgo_cfg') }));
    ok('6. #c= con un server finto: rifiutato, niente salvato', s.rifiutato && s.url === 'https://cyolhqndurgwbivxcssf.supabase.co' && !s.cfg, JSON.stringify(s));
    await p.close();
    const vecchio = Buffer.from(encodeURIComponent(JSON.stringify({ n: 'Kyoto con Jak', s: OGGI, e: OGGI, p: ['Gepp', 'Jak'] }))).toString('base64');
    p = await apri(browser, { hash: '#join=' + vecchio, stato: viaggio({ skipAuth: true }) });
    s = await p.evaluate(() => ({ foglio: document.getElementById('mJoin').classList.contains('active'), link: GEPPGO_LINK_EMAIL }));
    ok('6. #join= (gli inviti di una volta): si apre come prima', s.foglio && !s.link, JSON.stringify(s));
    await p.close();
  });

  /* ── 7. il link incollato in «Ho un codice» ──────────────────────────── */
  await prova('7', async () => {
    const verifica = async (tipoLink, tipoGiusto) => {
      const p = await apri(browser, { giusto: { token_hash: 'h-' + tipoLink, type: tipoGiusto } });
      await p.evaluate(() => { auVai('in'); openRecPanel(false); });
      await p.fill('#auCode', `${DI_SERIE}/auth/v1/verify?token=h-${tipoLink}&type=${tipoLink}&redirect_to=${encodeURIComponent(LOCALE + '/Index%202.1.html')}`);
      await p.click('#auRec .btn-grad');
      await p.waitForTimeout(900);
      const s = await stato(p);
      const v = await chiamate(p, 'verifyOtp');
      await p.close();
      return { s, v };
    };
    let x = await verifica('recovery', 'recovery');
    ok('7. link di recupero incollato: verificato come recupero, foglio «Nuova password»',
       x.v.length === 1 && x.v[0][0].type === 'recovery' && x.v[0][0].token_hash === 'h-recovery' && x.s.dentro && x.s.nuovaPw, JSON.stringify(x.v));
    x = await verifica('magiclink', 'email');
    ok('7. link di accesso incollato: verificato come «email» (magiclink è deprecato), dentro',
       x.v.length === 1 && x.v[0][0].type === 'email' && x.s.dentro && !x.s.nuovaPw && x.s.toast.includes('Accesso effettuato'), JSON.stringify({ v: x.v, toast: x.s.toast }));
    x = await verifica('signup', 'email');
    ok('7. link di conferma incollato: verificato, dentro e «Account confermato»',
       x.v.length === 1 && x.v[0][0].type === 'email' && x.s.dentro && x.s.toast.includes('Account confermato'), JSON.stringify({ v: x.v, toast: x.s.toast }));
  });

  /* ── 8. il codice a 6 cifre ──────────────────────────────────────────── */
  await prova('8', async () => {
    let p = await apri(browser, { ls: { geppgo2_richiesta_email: JSON.stringify({ tipo: 'magiclink', email: EMAIL, t: Date.now() }) },
      giusto: { token: '123456', type: 'email', email: EMAIL } });
    await p.evaluate(() => { auVai('in'); openRecPanel(false); });
    await p.fill('#auCode', '123456');
    await p.click('#auRec .btn-grad');
    await p.waitForTimeout(900);
    let v = await chiamate(p, 'verifyOtp'), s = await stato(p);
    ok('8. con l\'ultima richiesta salvata il codice si prova una volta sola, col suo tipo',
       v.length === 1 && v[0][0].type === 'email' && v[0][0].email === EMAIL && s.dentro, JSON.stringify(v.map(c => c[0].type)));
    await p.close();
    p = await apri(browser, { giusto: { token: '654321', type: 'signup', email: EMAIL } });
    await p.evaluate(e => { auVai('in'); document.getElementById('auEmail').value = e; openRecPanel(false); }, EMAIL);
    await p.fill('#auCode', '654321');
    await p.click('#auRec .btn-grad');
    await p.waitForTimeout(1200);
    v = await chiamate(p, 'verifyOtp'); s = await stato(p);
    ok('8. senza richiesta salvata prova recovery, email, signup, in quest\'ordine',
       v.map(c => c[0].type).join(',') === 'recovery,email,signup' && s.dentro && s.toast.includes('Account confermato'), JSON.stringify({ tipi: v.map(c => c[0].type), toast: s.toast }));
    await p.close();
    p = await apri(browser, { giusto: { token: '111111', type: 'recovery', email: EMAIL } });
    await p.evaluate(e => { auVai('in'); document.getElementById('auEmail').value = e; openRecPanel(false); }, EMAIL);
    await p.fill('#auCode', '999999');
    await p.click('#auRec .btn-grad');
    await p.waitForTimeout(1200);
    const msg = await p.evaluate(() => document.getElementById('recMsg').textContent);
    ok('8. un codice sbagliato lo dice chiaro', /Il codice non è giusto o è scaduto/.test(msg), msg);
    await p.close();
  });

  /* ── 9. l'indirizzo di ritorno ───────────────────────────────────────── */
  await prova('9', async () => {
    const richieste = async p => {
      await p.evaluate(e => {
        auVai('su');
        document.getElementById('auEmail').value = e; document.getElementById('auPass').value = 'segreta123'; document.getElementById('auPass2').value = 'segreta123';
      }, EMAIL);
      await p.evaluate(() => authUp());
      await p.evaluate(() => authMagic());
      await p.evaluate(() => authForgot());
      await p.waitForTimeout(400);
      return p.evaluate(() => {
        const c = window.__supa.chiamate, uno = n => (c.find(x => x[0] === n) || [])[1];
        return { su: (uno('signUp') || {}).options, accesso: ((uno('signInWithOtp') || {}).options || {}).emailRedirectTo,
          recupero: ((c.find(x => x[0] === 'resetPasswordForEmail') || [])[2] || {}).redirectTo, base: baseApp(), flusso: window.__supa.opzioni.auth.flowType };
      });
    };
    /* Su Pages, aperta a un percorso diverso da quello giusto: vale la costante. */
    let p = await apri(browser, { origine: PAGES, percorso: '/geppgo/Index%202.1.html' });
    let s = await richieste(p);
    ok('9. sull\'origine di Pages la registrazione passa emailRedirectTo, ed è la costante',
       s.su && s.su.emailRedirectTo === COSTANTE && s.accesso === COSTANTE && s.recupero === COSTANTE, JSON.stringify(s));
    ok('9. e la costante vale anche per gli inviti', s.base === 'https://87jg2gk7tn-bit.github.io/GeppGo/', s.base);
    ok('9. il flusso resta «implicit»', s.flusso === 'implicit', s.flusso);
    await p.close();
    p = await apri(browser);
    s = await richieste(p);
    ok('9. su un\'altra origine (le prove) l\'indirizzo è quello calcolato',
       s.su && s.su.emailRedirectTo === LOCALE + '/Index%202.1.html' && s.accesso === LOCALE + '/Index%202.1.html' && s.base === LOCALE + '/', JSON.stringify(s));
    await p.close();
  });

  /* ── 10. i testi nuovi in cinque lingue ──────────────────────────────── */
  await prova('10', async () => {
    let p = await apri(browser, { stato: viaggio({ skipAuth: true }) });
    const d = await p.evaluate(() => {
      const it = Object.keys(DIZIONARIO_LINK.en), buchi = [];
      ['en', 'es', 'fr', 'pt'].forEach(l => it.forEach(k => { const v = DIZIONARIO_LINK[l][k]; if (!v || v === k || DIZIONARIO[l][k] !== v) buchi.push(l + ': ' + k); }));
      const usati = ['Account confermato', 'Il link della mail non vale più', 'Chiedi un link nuovo', 'Il codice non è giusto o è scaduto: controlla le sei cifre, o chiedi una nuova email.']
        .filter(k => !(k in DIZIONARIO_LINK.en));
      return { n: it.length, buchi, usati };
    });
    ok('10. le frasi nuove ci sono in inglese, spagnolo, francese e portoghese', d.n >= 14 && !d.buchi.length && !d.usati.length, d.buchi.slice(0, 3).join(' | ') || d.usati.join(' | ') || d.n + ' frasi');
    await p.close();
    const viste = [];
    for (const [l, titolo, tasto] of [['en', 'The email link no longer works', 'Ask for a new link'], ['es', 'El enlace del correo ya no vale', 'Pedir un enlace nuevo'],
      ['fr', 'Le lien de l’e-mail ne marche plus', 'Demander un nouveau lien'], ['pt', 'A ligação do email já não funciona', 'Pedir uma ligação nova']]) {
      p = await apri(browser, { hash: SCADUTO, lingua: l });
      const t = await p.evaluate(() => ({ t: document.getElementById('cfTitle').textContent, b: document.getElementById('cfOk').textContent }));
      await p.evaluate(() => { closeSheet('mConfirm'); auVai('in'); openRecPanel(false); });
      const etichetta = await p.evaluate(() => document.querySelector('#auRec label').textContent);
      viste.push(`${l}: ${t.t} / ${t.b} / ${etichetta}` + (t.t !== titolo || t.b !== tasto || /della mail/.test(etichetta) ? '  ← non tradotto' : ''));
      await p.close();
    }
    ok('10. il link scaduto e «Ho un codice» si leggono in ogni lingua', !viste.some(v => /non tradotto/.test(v)), viste.join(' | '));
  });

  /* ── R. IL RECUPERO DELLA PASSWORD, OBBLIGATORIO ─────────────────────────
     Provato su iPhone: aperto il link di recupero, la croce chiudeva il
     foglio «Nuova password» e si restava dentro senza averla cambiata. */
  const foglioPw = p => p.evaluate(() => {
    const m = document.getElementById('mNewPass'), x = m.querySelector('.x-close'), g = m.querySelector('.sheet-grip'), r = m.getBoundingClientRect();
    const fondo = getComputedStyle(m).backgroundColor, alfa = /rgba\([^)]*,\s*([\d.]+)\)/.exec(fondo);
    return { attivo: m.classList.contains('active'), obbligatorio: m.classList.contains('obbligatorio'),
      croce: !!x && x.offsetParent !== null, maniglia: !!g && g.offsetParent !== null,
      copre: r.top <= 0 && r.left <= 0 && r.right >= innerWidth && r.bottom >= innerHeight, pieno: !alfa || +alfa[1] === 1,
      segno: !!localStorage.getItem('geppgo2_recupero') };
  });
  const dietroSiVede = p => p.evaluate(() => {
    const m = document.getElementById('mNewPass');
    return [[10, 10], [innerWidth / 2, 70], [innerWidth - 12, innerHeight / 3], [20, innerHeight - 20]].filter(([x, y]) => !m.contains(document.elementFromPoint(x, y))).length;
  });
  await prova('R1-R4', async () => {
    let p = await apri(browser, { hash: linkMail('recovery') });
    await p.waitForTimeout(600);
    let f = await foglioPw(p);
    await p.mouse.click(8, 8);                       // un tocco sul fondo
    await p.waitForTimeout(400);
    await p.evaluate(() => closeSheet('mNewPass'));  // la strada di ogni altra chiusura
    await p.goBack().catch(() => {});                // il gesto indietro
    await p.waitForTimeout(500);
    /* Col codice di prima il gesto indietro portava via dalla pagina: il
       foglio non c'e' piu', e la prova lo deve dire, non fermarsi. */
    const resta = await p.evaluate(() => { const m = document.getElementById('mNewPass'); return !!m && m.classList.contains('active'); }).catch(() => false);
    const dietro = resta ? await dietroSiVede(p) : -1;
    ok('R1. link di recupero: foglio obbligatorio, senza croce né maniglia', f.attivo && f.obbligatorio && !f.croce && !f.maniglia && f.segno, JSON.stringify(f));
    ok('R1. non si chiude toccando fuori, né da codice, né col gesto indietro', resta, String(resta));
    ok('R1. e copre tutto, con un fondo pieno: dietro non si vede niente', f.copre && f.pieno && dietro === 0, JSON.stringify({ copre: f.copre, pieno: f.pieno, puntiScoperti: dietro }));
    await p.click('#mNewPass button.np-obbligo');
    await p.waitForTimeout(600);
    let s = await p.evaluate(() => ({ uscite: window.__supa.chiamate.filter(c => c[0] === 'signOut').map(c => c[1]), dentro: !!session,
      gate: getComputedStyle(document.getElementById('authGate')).display, segno: !!localStorage.getItem('geppgo2_recupero'),
      foglio: document.getElementById('mNewPass').classList.contains('active'), sessioneNelTelefono: !!localStorage.getItem('sb-cyolhqndurgwbivxcssf-auth-token') }));
    ok('R2. «Annulla» fa uscire dall\'account', s.uscite.length === 1 && s.uscite[0] === null && !s.dentro && !s.sessioneNelTelefono && s.gate === 'flex' && !s.segno && !s.foglio, JSON.stringify(s));
    await p.close();

    p = await apri(browser, { hash: linkMail('recovery') });
    await p.waitForTimeout(600);
    await p.reload({ waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof window.renderAll === 'function' && !document.getElementById('bootSplash'), null, { timeout: 30000 });
    await p.waitForTimeout(1500);
    f = await foglioPw(p);
    ok('R3. ricaricata prima di salvare: il foglio obbligatorio ricompare', f.attivo && f.obbligatorio && !f.croce && f.segno && f.copre, JSON.stringify(f));
    await p.fill('#npPass', 'nuova-segreta');
    await p.click('#mNewPass .btn-grad');
    await p.waitForTimeout(800);
    s = await p.evaluate(() => ({ aggiornata: window.__supa.chiamate.filter(c => c[0] === 'updateUser').map(c => c[1].password),
      uscite: window.__supa.chiamate.filter(c => c[0] === 'signOut').map(c => c[1]), segno: !!localStorage.getItem('geppgo2_recupero'),
      foglio: document.getElementById('mNewPass').classList.contains('active'), dentro: !!session, toast: window.__toast.slice() }));
    ok('R4. «Salva nuova password»: aggiornata, segno cancellato, fuori dagli altri dispositivi, e lo dice',
       s.aggiornata.join() === 'nuova-segreta' && !s.segno && !s.foglio && s.dentro && s.uscite.length === 1 && s.uscite[0] && s.uscite[0].scope === 'others'
       && s.toast.includes('Password aggiornata. Sugli altri dispositivi dovrai accedere di nuovo.'), JSON.stringify(s));
    await p.close();
  });

  await prova('R5', async () => {
    const p = await apri(browser, { ls: { geppgo2_richiesta_email: JSON.stringify({ tipo: 'recovery', email: EMAIL, t: Date.now() }) },
      giusto: { token: '123456', type: 'recovery', email: EMAIL } });
    await p.evaluate(() => { auVai('in'); openRecPanel(false); });
    await p.fill('#auCode', '123456');
    await p.click('#auRec .btn-grad');
    await p.waitForTimeout(900);
    const f = await foglioPw(p);
    await p.mouse.click(8, 8);
    await p.waitForTimeout(400);
    const resta = await p.evaluate(() => document.getElementById('mNewPass').classList.contains('active'));
    ok('R5. recupero col codice a 6 cifre: stesso foglio obbligatorio', f.attivo && f.obbligatorio && !f.croce && f.segno && f.copre && resta, JSON.stringify(f));
    await p.close();
  });

  await prova('R6', async () => {
    const p = await apri(browser);
    await p.evaluate(e => { auVai('in'); document.getElementById('auEmail').value = e; document.getElementById('auPass').value = 'giusta123'; }, EMAIL);
    await p.click('#auBtnIn');
    await p.waitForTimeout(800);
    const f = await foglioPw(p);
    const dentro = await p.evaluate(() => !!session);
    ok('R6. accesso normale con email e password: nessun foglio obbligatorio', dentro && !f.attivo && !f.obbligatorio && !f.segno, JSON.stringify({ dentro, ...f }));
    /* E «Cambia password» dal Profilo resta il foglio libero. */
    await p.evaluate(() => openNewPass());
    await p.waitForTimeout(400);
    const libero = await foglioPw(p);
    await p.click('#mNewPass .x-close');
    await p.waitForTimeout(500);
    const chiuso = await p.evaluate(() => !document.getElementById('mNewPass').classList.contains('active'));
    ok('R6. «Cambia password» dal Profilo resta chiudibile', libero.attivo && !libero.obbligatorio && libero.croce && chiuso, JSON.stringify({ ...libero, chiuso }));
    await p.close();
  });

  await prova('R7', async () => {
    let p = await apri(browser, { stato: viaggio({ skipAuth: true }) });
    const d = await p.evaluate(() => {
      const it = Object.keys(DIZIONARIO_RECUPERO.en), buchi = [];
      ['en', 'es', 'fr', 'pt'].forEach(l => it.forEach(k => { const v = DIZIONARIO_RECUPERO[l][k]; if (!v || v === k || DIZIONARIO[l][k] !== v) buchi.push(l + ': ' + k); }));
      return { n: it.length, buchi };
    });
    ok('R7. le frasi nuove ci sono in inglese, spagnolo, francese e portoghese', d.n >= 4 && !d.buchi.length, d.buchi.slice(0, 3).join(' | ') || d.n + ' frasi');
    await p.close();
    const viste = [];
    for (const [l, salva, annulla] of [['en', 'Save new password', 'Cancel'], ['es', 'Guardar nueva contraseña', 'Cancelar'], ['fr', 'Enregistrer le nouveau mot de passe', 'Annuler'], ['pt', 'Guardar nova palavra-passe', 'Cancelar']]) {
      p = await apri(browser, { hash: linkMail('recovery'), lingua: l });
      await p.waitForTimeout(600);
      const t = await p.evaluate(() => ({ testo: document.querySelector('#mNewPass p.np-obbligo').textContent, salva: document.querySelector('#mNewPass .btn-grad').textContent, annulla: document.querySelector('#mNewPass button.np-obbligo').textContent }));
      viste.push(`${l}: ${t.salva} / ${t.annulla}` + (t.salva !== salva || t.annulla !== annulla || /Sei entrato/.test(t.testo) ? '  ← non tradotto' : ''));
      await p.close();
    }
    ok('R7. il foglio obbligatorio si legge in ogni lingua', !viste.some(v => /non tradotto/.test(v)), viste.join(' | '));
  });

  ok('nessun errore in pagina', !errori.length, errori.slice(0, 3).join(' | '));
  console.log('\n' + r.join('\n'));
  const falliti = r.filter(x => x.includes('FALLITO')).length;
  console.log(`\n${r.length - falliti}/${r.length} passati`);
  await browser.close();
  process.exit(falliti ? 1 : 0);
})();
