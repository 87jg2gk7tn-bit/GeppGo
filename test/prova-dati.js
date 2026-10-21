/* I DATI AL SICURO.

   Chi usa GeppGo senza account ha i viaggi solo nel telefono, e li puo'
   perdere senza saperlo: cambiando telefono, cancellando i dati del browser,
   o lasciando Safari sette giorni senza aprire l'app. Qui si prova quello
   che lo protegge, con un cloud finto che tiene tutto in memoria
   (window.__nuvola) e fa vedere cosa e' arrivato:
   1. la memoria persistente si chiede alla creazione del primo viaggio,
      dove il browser la conosce;
   2. senza account il foglio «I tuoi viaggi sono solo su questo telefono»
      compare dopo il primo viaggio (o alla prima apertura, a chi i viaggi
      li aveva gia'), e poi non piu' di una volta a settimana;
   3. creando l'account i viaggi del telefono finiscono nel cloud, foto
      comprese, e non si perde niente (nemmeno la valigia);
   4. in Safari su iPhone, senza l'app sulla Home, la spiegazione per
      metterla; nell'app installata no;
   5. l'app installata e vuota chiede «Avevi gia' dei viaggi in Safari?»;
   6. il backup e' un file solo con dati e foto, e ripristinato su un
      telefono vuoto riporta viaggi e foto; troppo grande lo dice; senza il
      foglio Condividi si scarica;
   7. il ripristino accetta anche il vecchio JSON;
   8. «Esci» con modifiche o foto in attesa dice quante sono, e aspetta;
      senza niente in attesa si esce subito;
   9. lo stato del cloud nel Profilo, nei tre casi;
   10. i testi nuovi in cinque lingue, e niente fuori schermo da 320 a
       430 px, nel tema chiaro e in quello scuro. */
const fs = require('fs');
const path = require('path');
const { apriBrowser, APP, leafletJs, RADICE } = require('./browser');

/* fflate: lo stesso pacchetto che l'app chiede alla CDN, servito da qui; e
   in Node per aprire lo zip che l'app consegna. */
const FFLATE_JS = (() => { try { return fs.readFileSync(path.join(RADICE, 'node_modules', 'fflate', 'umd', 'index.js'), 'utf8'); } catch (e) { return null; } })();
let fflate = null;
try { fflate = require(path.join(RADICE, 'node_modules', 'fflate')); } catch (e) {}

const OGGI = new Date().toISOString().split('T')[0];
const GIORNO = 864e5;
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
/* Due immagini vere e piccolissime: il caricamento nel cloud le passa da un
   canvas (la miniatura), e una finta non si decodificherebbe. */
const JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a' +
  'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA' +
  'AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const vuoto = (extra = {}) => Object.assign({ trips: [], currentTripId: null, settings: { proxRadius: 200 }, myName: 'Gepp', skipAuth: true, consentNotif: true }, extra);
const unViaggio = (id, nome, extra = {}) => Object.assign({
  id, name: nome, destination: '', currency: 'EUR', status: 'open', start: '2026-11-02', end: '2026-11-03',
  participants: [{ id: 1, name: 'Gepp', isMe: true }, { id: 2, name: 'Jak', isMe: false }],
  suggested: [], pois: [], weather: {}, createdAt: 1, tickets: [],
  hotels: [{ id: 901, name: 'Hotel Sole', lat: null, lng: null, address: '', checkIn: '2026-11-02', checkOut: '2026-11-03' }],
  expenses: [{ id: 701, desc: 'Cena', category: 'Cibo', amount: 42, origAmount: 42, origCurrency: 'EUR', paid: 1, who: [1, 2], date: '2026-11-02', type: 'expense' }],
  days: [{ id: 'd1', date: '2026-11-02', title: '', activities: [{ id: 501, name: 'Castello', time: '10:00', timeEnd: '11:00', type: 'any', who: [1, 2], completed: false, booking: { needed: false, done: false } }] },
    { id: 'd2', date: '2026-11-03', title: '', activities: [] }]
}, extra);
const foto = (id, tripId, extra = {}) => Object.assign({ id, tripId, date: '2026-11-02', data: JPEG, mini: JPEG, ts: 1, chi: null }, extra);
/* Come cleanTrip dell'app: quello che del viaggio va nel cloud. Senza le ore
   delle modifiche (_ct), che non sono contenuto. */
const pulito = t => {
  const c = JSON.parse(JSON.stringify(t));
  ['cid', '_invite', '_owner', '_admin', 'canc_chiesta_da', 'packing', '_creating', '_ct'].forEach(k => delete c[k]);
  (c.participants || []).forEach(p => delete p.isMe);
  return c;
};
/* Lo stesso contenuto, scritto in qualunque ordine. */
const ordinato = x => Array.isArray(x) ? x.map(ordinato) : (x && typeof x === 'object') ? Object.keys(x).sort().reduce((o, k) => (o[k] = ordinato(x[k]), o), {}) : x;
const uguali = (a, b) => JSON.stringify(ordinato(a)) === JSON.stringify(ordinato(b));

/* Un finto supabase-js con dentro un database in memoria: tabelle, file e
   l'elenco di tutto quello che l'app ha chiesto. __nuvola.giu fa fallire
   ogni scrittura (rete che cade), __nuvola.fotoGiu solo i caricamenti
   delle foto. La sessione iniziale si mette in __nuvola.sessione. */
const SUPA_FINTO = `(()=>{
  const N=window.__nuvola=window.__nuvola||{};
  ['trips','trip_members','foto','raccolte'].forEach(k=>{N[k]=N[k]||[];});
  N.file=N.file||{};N.chiamate=N.chiamate||[];N.sessione=N.sessione||null;
  let ascolta=null,conta=0;
  const copia=x=>x==null?x:JSON.parse(JSON.stringify(x));
  const rotto={message:'Failed to fetch'};
  function query(tab){
    const st={op:'select',filtri:[],single:false};
    const esegui=()=>{
      const t=N[tab]=N[tab]||[];
      const passa=r=>st.filtri.every(f=>f.tipo==='in'?f.v.map(String).includes(String(r[f.c])):String(r[f.c])===String(f.v));
      if(st.op!=='select'&&N.giu){N.chiamate.push({tab,op:st.op,rifiutata:true});return{data:null,error:rotto};}
      if(st.op==='insert'){
        const righe=(Array.isArray(st.riga)?st.riga:[st.riga]).map(r=>{const x=copia(r);if(tab==='trips'){conta++;x.id=x.id||('cid-n'+conta);x.invite_code=x.invite_code||('inv-n'+conta);}return x;});
        righe.forEach(x=>t.push(x));N.chiamate.push({tab,op:'insert',n:righe.length});
        return{data:st.single?copia(righe[0]):copia(righe),error:null};
      }
      if(st.op==='update'){const d=t.filter(passa);d.forEach(r=>Object.assign(r,copia(st.patch)));N.chiamate.push({tab,op:'update',n:d.length});return{data:copia(d),error:null};}
      if(st.op==='delete'){const d=t.filter(passa);N[tab]=t.filter(r=>!passa(r));N.chiamate.push({tab,op:'delete',n:d.length});return{data:copia(d),error:null};}
      const d=t.filter(passa).map(copia);
      return{data:st.single?(d[0]||null):d,error:null};
    };
    let px;
    const b={
      select(){return px;},insert(r){st.op='insert';st.riga=r;return px;},upsert(r){st.op='insert';st.riga=r;return px;},
      update(p){st.op='update';st.patch=p;return px;},delete(){st.op='delete';return px;},
      eq(c,v){st.filtri.push({c,v,tipo:'eq'});return px;},in(c,v){st.filtri.push({c,v,tipo:'in'});return px;},
      single(){st.single=true;return px;},maybeSingle(){st.single=true;return px;},
      then(ok,ko){return Promise.resolve().then(esegui).then(ok,ko);}
    };
    /* order, gt, limit e il resto non filtrano. */
    px=new Proxy(b,{get:(o,k)=>k in o?o[k]:(()=>px)});
    return px;
  }
  const entra=(come,email)=>{N.sessione={user:{id:'u-nuovo',email},access_token:'x',refresh_token:'y'};N.chiamate.push({auth:come,email});const s=N.sessione;setTimeout(()=>ascolta&&ascolta('SIGNED_IN',s),0);return{data:{user:s.user,session:s},error:null};};
  const auth={
    onAuthStateChange(cb){ascolta=cb;return{data:{subscription:{unsubscribe(){}}}};},
    async getSession(){return{data:{session:N.sessione},error:null};},
    async getUser(){return{data:{user:N.sessione&&N.sessione.user},error:null};},
    async signUp(o){return entra('signUp',o.email);},
    async signInWithPassword(o){return entra('signIn',o.email);},
    async signOut(){N.chiamate.push({auth:'signOut'});N.sessione=null;setTimeout(()=>ascolta&&ascolta('SIGNED_OUT',null),0);return{error:null};},
    async setSession(){return{data:{},error:{message:'no'}};},
    async exchangeCodeForSession(){return{data:{},error:{message:'no'}};},
    async updateUser(){return{data:{},error:null};},
    async resetPasswordForEmail(){return{data:{},error:null};},
    async verifyOtp(){return{data:{},error:{message:'no'}};}
  };
  const storage={from:b=>({
    async upload(p,blob){if(N.giu||N.fotoGiu){N.chiamate.push({upload:p,rifiutata:true});return{data:null,error:rotto};}N.file[p]={tipo:blob.type,byte:blob.size};N.chiamate.push({upload:p});return{data:{path:p},error:null};},
    async remove(){return{data:null,error:null};},
    async createSignedUrl(){return{data:null,error:{message:'no'}};},
    async list(){return{data:[],error:null};}
  })};
  const canale=()=>{const c={on(){return c;},subscribe(cb){if(typeof cb==='function')setTimeout(()=>cb('SUBSCRIBED'),0);return c;},unsubscribe(){return Promise.resolve();},send(){return Promise.resolve('ok');},track(){return Promise.resolve();},presenceState(){return{};}};return c;};
  const client={auth,storage,from:query,channel:canale,removeChannel(){return Promise.resolve();},removeAllChannels(){return Promise.resolve();},
    rpc(n,a){N.chiamate.push({rpc:n});return Promise.resolve({data:null,error:null});},
    functions:{invoke:async()=>({data:null,error:{message:'no'}})}};
  window.supabase={createClient:()=>client};
})();`;

const r = [];
const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);
const errori = [];

/* Apre l'app come un telefono: lo stato si mette solo al primo caricamento
   (ricaricando resta quello che l'app ha salvato). */
async function apri(browser, { stato = null, extraLs = null, ua = null, installata = false, persist = 'finto', larghezza = 390, altezza = 844,
  lingua = null, scuro = false, nuvola = null, condividi = false, intro = false, foto: fotoIdb = null, tessere = null, maiVisto = false } = {}) {
  /* L'avviso «solo su questo telefono» si da' per visto da poco, salvo dove
     e' proprio lui che si prova (maiVisto, o una data in extraLs): chi ha
     dei viaggi senza account lo vede all'apertura, e coprirebbe i tasti. */
  if (!maiVisto && !(extraLs && 'geppgo2_avviso_account2' in extraLs)) extraLs = Object.assign({ geppgo2_avviso_account2: String(Date.now()) }, extraLs || {});
  /* avvisi: true - qui gli avvisi si provano, non si danno per visti
     (vedi test/browser.js). */
  const opz = { viewport: { width: larghezza, height: altezza }, avvisi: true };
  if (ua) opz.userAgent = ua;
  const page = await browser.newPage(opz);
  page.on('pageerror', e => errori.push('PAGEERROR: ' + e.message.split('\n')[0]));
  await page.route('**/leaflet@1.9.4/dist/leaflet.js', ro => ro.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(leafletJs(), 'utf8') }));
  await page.route(/tile\.openstreetmap\.org/, ro => ro.abort());
  await page.route('**/fflate@*/**', ro => FFLATE_JS ? ro.fulfill({ status: 200, contentType: 'application/javascript', body: FFLATE_JS }) : ro.abort());
  await page.route('**/supabase-js@*/**', ro => ro.fulfill({ status: 200, contentType: 'application/javascript', body: SUPA_FINTO }));
  await page.addInitScript(([s, x, inst, pers, l, d, nv, cond, conIntro, fi, te]) => {
    window.__persist = { chiamate: 0 };
    if (pers === 'finto' && navigator.storage) navigator.storage.persist = async () => { window.__persist.chiamate++; return true; };
    if (pers === 'assente' && window.StorageManager) { try { delete StorageManager.prototype.persist; } catch (e) {} }
    if (inst) Object.defineProperty(Navigator.prototype, 'standalone', { get: () => true, configurable: true });
    if (nv) window.__nuvola = JSON.parse(JSON.stringify(nv));
    /* Il foglio Condividi di iPhone: qui si tiene il file che gli arriva. */
    if (cond) { window.__condivisi = []; navigator.canShare = () => true; navigator.share = async o => { window.__condivisi.push(o); }; }
    if (sessionStorage.getItem('prova-dati')) return;
    sessionStorage.setItem('prova-dati', '1');
    localStorage.clear();
    if (s) { const st = JSON.parse(JSON.stringify(s)); st.settings = st.settings || {}; if (l) st.settings.lingua = l; if (d) st.settings.dark = true; localStorage.setItem('geppgo2', JSON.stringify(st)); }
    if (!conIntro) localStorage.setItem('geppgo2_intro', '1');
    if (x) Object.keys(x).forEach(k => localStorage.setItem(k, typeof x[k] === 'string' ? x[k] : JSON.stringify(x[k])));
    /* Le foto (e i pezzi di mappa) si mettono in IndexedDB prima che l'app
       parta, nello stesso database che usa lei. */
    if (fi || te) {
      const q = indexedDB.open('geppgo_ph', 2);
      q.onupgradeneeded = e => { const db = e.target.result; if (!db.objectStoreNames.contains('ph')) db.createObjectStore('ph', { keyPath: 'id' }); if (!db.objectStoreNames.contains('tessere')) db.createObjectStore('tessere', { keyPath: 'k' }); };
      q.onsuccess = e => { const db = e.target.result; const tx = db.transaction(['ph', 'tessere'], 'readwrite'); (fi || []).forEach(v => tx.objectStore('ph').put(v)); (te || []).forEach(v => tx.objectStore('tessere').put(v)); tx.oncomplete = () => db.close(); };
    }
  }, [stato, extraLs, installata, persist, lingua, scuro, nuvola, condividi, intro, fotoIdb, tessere]);
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.renderAll === 'function' && !document.getElementById('bootSplash'), null, { timeout: 30000 });
  await page.waitForTimeout(400);
  return page;
}
const prova = async (nome, fn) => {
  try { await fn(); } catch (e) { ok(nome, false, 'si è fermata: ' + e.message.split('\n')[0]); }
};
const aspetta = (p, fn, arg, ms = 6000) => p.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
const attivo = (p, id) => p.evaluate(i => { const m = document.getElementById(i); return !!m && m.classList.contains('active'); }, id);
const aspettaFoglio = (p, id, ms = 6000) => aspetta(p, i => { const m = document.getElementById(i); return !!m && m.classList.contains('active'); }, id, ms);
const chiudiFogli = p => p.evaluate(() => document.querySelectorAll('.modal.active').forEach(m => closeSheet(m.id)));
/* Il tocco sta davvero sopra a tutto: al centro del tasto c'e' il tasto. */
const sopra = (p, sel) => p.evaluate(s => {
  const el = document.querySelector(s); if (!el) return false;
  const b = el.getBoundingClientRect(); if (!b.width || !b.height) return false;
  const x = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
  return !!x && (x === el || el.contains(x));
}, sel);
const ultimoToast = p => p.evaluate(() => { const t = document.querySelector('.toast'); return t ? t.textContent : ''; });
async function creaViaggio(p, nome) {
  await p.evaluate(() => openNewTrip());
  await p.waitForTimeout(450);
  await p.fill('#ntName', nome);
  await p.click('#mNewTrip button[onclick="createTrip()"]');
  await p.waitForTimeout(450);
}
const fotoInIdb = p => p.evaluate(() => idbP().then(db => new Promise(res => {
  const out = []; const c = db.transaction('ph').objectStore('ph').openCursor();
  c.onsuccess = e => { const cur = e.target.result; if (!cur) return res(out); out.push(cur.value); cur.continue(); };
})));
const mettiFoto = (p, recs) => p.evaluate(rs => idbP().then(db => new Promise(res => { const tx = db.transaction('ph', 'readwrite'); rs.forEach(v => tx.objectStore('ph').put(v)); tx.oncomplete = res; })), recs);
/* Il file che l'app ha dato al foglio Condividi, come Buffer. */
const fileCondiviso = async (p, i = 0) => {
  const f = await p.evaluate(async n => {
    const c = window.__condivisi && window.__condivisi[n]; if (!c || !c.files || !c.files[0]) return null;
    const file = c.files[0], b = new Uint8Array(await file.arrayBuffer());
    let s = ''; for (let k = 0; k < b.length; k += 0x8000) s += String.fromCharCode.apply(null, b.subarray(k, k + 0x8000));
    return { nome: file.name, tipo: file.type, titolo: c.title || '', b64: btoa(s) };
  }, i);
  return f && Object.assign(f, { buf: Buffer.from(f.b64, 'base64') });
};
/* Uno stato con l'account: il viaggio e' gia' nel cloud, allineato. */
const conAccount = (trip) => ({
  stato: vuoto({ trips: [trip], currentTripId: trip.id, skipAuth: false }),
  nuvola: {
    sessione: { user: { id: 'u-1', email: 'gepp@example.com' }, access_token: 'x', refresh_token: 'y' },
    trips: [{ id: trip.cid, owner: 'u-1', invite_code: 'inv-1', data: pulito(trip) }],
    trip_members: [{ trip_id: trip.cid, user_id: 'u-1', participant_id: 1, ruolo: 'admin', member_name: 'Gepp' }]
  },
  extraLs: { geppgo2_lastpush: { [trip.cid]: JSON.stringify(pulito(trip)) } }
});
/* Si aspetta che l'app abbia finito di parlare col cloud dopo l'avvio. */
const allineata = p => aspetta(p, () => typeof modificheInAttesa === 'function' && !!session && !syncBusy && modificheInAttesa() === 0, null, 10000);

(async () => {
  const browser = await apriBrowser();

  /* ── 1. la memoria persistente ─────────────────────────────────────── */
  await prova('1', async () => {
    let p = await apri(browser, { stato: vuoto() });
    const prima = await p.evaluate(() => ({ n: __persist.chiamate, rec: localStorage.getItem('geppgo2_persistenza') }));
    await creaViaggio(p, 'Lisbona');
    await p.waitForTimeout(300);
    const dopo = await p.evaluate(() => ({ n: __persist.chiamate, rec: JSON.parse(localStorage.getItem('geppgo2_persistenza') || 'null'), fogli: [...document.querySelectorAll('.modal.active')].map(m => m.id) }));
    await chiudiFogli(p);
    await p.waitForTimeout(400);
    await creaViaggio(p, 'Porto');
    await p.waitForTimeout(300);
    const dopo2 = await p.evaluate(() => __persist.chiamate);
    ok('1. navigator.storage.persist() si chiede alla creazione del primo viaggio, e se ne tiene l\'esito',
       prima.n === 0 && !prima.rec && dopo.n === 1 && !!dopo.rec && dopo.rec.esito === true && typeof dopo.rec.t === 'number',
       JSON.stringify({ prima, dopo: { n: dopo.n, rec: dopo.rec } }));
    ok('1. senza nessun foglio per chiederlo, e non una seconda volta', dopo2 === 1 && !dopo.fogli.some(f => /Persist/i.test(f)), 'chiamate: ' + dopo2 + ' · fogli: ' + dopo.fogli.join(','));
    await p.close();
    p = await apri(browser, { stato: vuoto(), persist: 'assente' });
    await creaViaggio(p, 'Lisbona');
    await p.waitForTimeout(300);
    const senza = await p.evaluate(() => ({ c: typeof (navigator.storage && navigator.storage.persist), rec: localStorage.getItem('geppgo2_persistenza'), n: app.trips.length }));
    ok('1. dove persist() non esiste il viaggio nasce lo stesso, e non si salva niente', senza.c !== 'function' && !senza.rec && senza.n === 1, JSON.stringify(senza));
    await p.close();
  });

  /* ── 2. senza account: dopo il primo viaggio, poi una volta a settimana ── */
  await prova('2', async () => {
    let p = await apri(browser, { stato: vuoto({ premium: true }), maiVisto: true });
    const subito = await attivo(p, 'mSoloQui');
    await creaViaggio(p, 'Lisbona');
    const comparso = await aspettaFoglio(p, 'mSoloQui', 7000);
    const foglio = await p.evaluate(() => ({ t: document.querySelector('#mSoloQui .sheet-t').textContent.trim(),
      tasti: [...document.querySelectorAll('#mSoloQui .sheet button.btn')].map(b => b.textContent.trim()), quando: +localStorage.getItem('geppgo2_avviso_account2') }));
    ok('2. senza account, dopo il primo viaggio: «I tuoi viaggi sono solo su questo telefono», con «Crea un account» e «Più tardi»',
       !subito && comparso && /I tuoi viaggi sono solo su questo telefono/.test(foglio.t) && foglio.tasti.includes('Crea un account') && foglio.tasti.includes('Più tardi') && Date.now() - foglio.quando < 60000,
       JSON.stringify(foglio));
    await p.click('#mSoloQui button:has-text("Più tardi")');
    await p.waitForTimeout(500);
    const chiuso = !(await attivo(p, 'mSoloQui'));
    await creaViaggio(p, 'Porto');
    await p.waitForTimeout(4000);
    const secondo = await attivo(p, 'mSoloQui');
    await p.evaluate(() => localStorage.setItem('geppgo2_avviso_account2', String(Date.now() - 8 * 864e5)));
    await creaViaggio(p, 'Madrid');
    const settimana = await aspettaFoglio(p, 'mSoloQui', 7000);
    ok('2. «Più tardi» lo chiude; un altro viaggio nella stessa settimana non lo fa ricomparire, dopo una settimana sì', chiuso && !secondo && settimana,
       JSON.stringify({ chiuso, secondo, settimana }));
    await p.close();
    /* All'apertura: chi aveva gia' dei viaggi lo vede la prima volta dopo
       l'aggiornamento; poi non prima di una settimana dall'ultimo. */
    const conViaggio = vuoto({ trips: [unViaggio(11, 'Roma')], currentTripId: 11 });
    p = await apri(browser, { stato: conViaggio, maiVisto: true });
    const primaVolta = await aspettaFoglio(p, 'mSoloQui', 8000);
    await p.close();
    p = await apri(browser, { stato: conViaggio, extraLs: { geppgo2_avviso_account2: String(Date.now() - 3 * GIORNO) } });
    await p.waitForTimeout(4500);
    const treGiorni = await attivo(p, 'mSoloQui');
    await p.close();
    p = await apri(browser, { stato: conViaggio, extraLs: { geppgo2_avviso_account2: String(Date.now() - 8 * GIORNO) } });
    const ottoGiorni = await aspettaFoglio(p, 'mSoloQui', 8000);
    await p.close();
    ok('2. all\'apertura: chi ha già dei viaggi lo vede la prima volta, a 3 giorni dall\'ultimo no, a 8 giorni sì',
       primaVolta && !treGiorni && ottoGiorni, JSON.stringify({ primaVolta, treGiorni, ottoGiorni }));
  });

  /* ── 3. creando l'account i viaggi vanno nel cloud ───────────────────── */
  await prova('3', async () => {
    const a = unViaggio(101, 'Kyoto'), b = unViaggio(102, 'Osaka', { expenses: [] });
    const p = await apri(browser, { stato: vuoto({ trips: [a, b], currentTripId: 101 }),
      extraLs: { geppgo2_avviso_account2: String(Date.now() - 8 * GIORNO),
        geppgo2_pack_101_local: [{ id: 1, cat: 'Documenti', label: 'Passaporto', checked: true, custom: true }] },
      foto: [foto('ph-k1', 101)] });
    const prima = await p.evaluate(() => JSON.parse(JSON.stringify(app.trips)));
    const comparso = await aspettaFoglio(p, 'mSoloQui', 8000);
    await p.click('#mSoloQui button:has-text("Crea un account")');
    await aspetta(p, () => getComputedStyle(document.getElementById('authGate')).display !== 'none' && document.getElementById('auPass2Wrap').style.display === 'block', null, 4000);
    const modulo = await p.evaluate(() => document.getElementById('auTitolo').textContent.trim());
    await p.fill('#auEmail', 'nuovo@example.com');
    await p.fill('#auPass', 'segreta123');
    await p.fill('#auPass2', 'segreta123');
    await p.click('#auBtnUp');
    const arrivati = await aspetta(p, () => window.__nuvola.trips.length === 2 && window.__nuvola.foto.length === 1, null, 20000);
    await p.waitForTimeout(800);
    const esito = await p.evaluate(() => ({
      cloud: window.__nuvola.trips.map(r => ({ id: r.id, owner: r.owner, data: r.data })),
      file: Object.keys(window.__nuvola.file), righeFoto: window.__nuvola.foto.length,
      locali: JSON.parse(JSON.stringify(app.trips)), skip: app.skipAuth, sessione: !!session,
      cancello: getComputedStyle(document.getElementById('authGate')).display,
      valigia: getPacking(app.trips.find(t => t.id === 101)).map(x => x.label)
    }));
    const fotoDopo = await fotoInIdb(p);
    const stessi = esito.locali.length === 2 && prima.every(t => {
      const l = esito.locali.find(x => x.id === t.id), c = esito.cloud.find(x => l && x.id === l.cid);
      return l && c && uguali(pulito(l), pulito(t)) && uguali(pulito(c.data), pulito(t));
    });
    ok('3. dal foglio «Crea un account» si arriva al modulo di registrazione', comparso && modulo === 'Crea un account', modulo);
    ok('3. creato l\'account, i due viaggi del telefono sono nel cloud, uguali a com\'erano (spese, tappe, alberghi)',
       arrivati && stessi && esito.cloud.every(c => c.owner === 'u-nuovo') && esito.sessione && esito.skip === false && esito.cancello === 'none',
       esito.cloud.length + ' nel cloud · ' + esito.locali.map(t => t.name + ':' + (t.cid || '-')).join(', '));
    ok('3. la foto del telefono è arrivata anche lei (con la miniatura), e la valigia c\'è ancora',
       esito.righeFoto === 1 && esito.file.length === 2 && fotoDopo.length === 1 && !!fotoDopo[0].cloudId && JSON.stringify(esito.valigia) === '["Passaporto"]',
       JSON.stringify({ file: esito.file.length, cloudId: fotoDopo[0] && fotoDopo[0].cloudId, valigia: esito.valigia }));
    await p.evaluate(() => go('trips'));
    const stato = await aspetta(p, () => (document.getElementById('statoCloud') || {}).textContent === 'Tutto salvato nel cloud', null, 4000);
    ok('3. e il Profilo dice «Tutto salvato nel cloud»', stato, await p.evaluate(() => (document.getElementById('statoCloud') || {}).textContent));
    await p.close();
  });

  /* ── 4. la Home in Safari ─────────────────────────────────────────────── */
  await prova('4', async () => {
    const recente = { geppgo2_avviso_account2: String(Date.now()) };
    let p = await apri(browser, { stato: vuoto({ premium: true }), ua: IPHONE, extraLs: recente });
    await creaViaggio(p, 'Lisbona');
    const comparso = await aspettaFoglio(p, 'mHome', 7000);
    const testo = await p.evaluate(() => document.querySelector('#mHome .sheet').textContent.replace(/\s+/g, ' '));
    await p.click('#mHome button:has-text("Ho capito")');
    await p.waitForTimeout(500);
    await p.evaluate(() => go('trips'));
    await p.waitForTimeout(300);
    const riga = await p.evaluate(() => { const el = document.getElementById('homeRiga'); return !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0; });
    await p.click('#homeRiga button');
    const dalProfilo = await aspettaFoglio(p, 'mHome', 3000);
    await chiudiFogli(p);
    await p.waitForTimeout(400);
    await creaViaggio(p, 'Porto');
    await p.waitForTimeout(3500);
    const unaVolta = !(await attivo(p, 'mHome'));
    ok('4. in Safari su iPhone, dopo il primo viaggio, la spiegazione per la Home: Condividi › Aggiungi alla schermata Home, e i 7 giorni',
       comparso && /Condividi/.test(testo) && /Aggiungi alla schermata Home/.test(testo) && /7 giorni/.test(testo), testo.slice(0, 160));
    ok('4. una volta sola, e resta nel Profilo', unaVolta && riga && dalProfilo, JSON.stringify({ unaVolta, riga, dalProfilo }));
    await p.close();
    /* Nell'app installata (e fuori da iPhone) niente. */
    const inst = vuoto({ premium: true, trips: [unViaggio(21, 'Roma')], currentTripId: 21 });
    p = await apri(browser, { stato: inst, ua: IPHONE, installata: true, extraLs: recente });
    await creaViaggio(p, 'Lisbona');
    await p.waitForTimeout(4000);
    const installata = await p.evaluate(() => ({ foglio: document.getElementById('mHome').classList.contains('active'), riga: getComputedStyle(document.getElementById('homeRiga')).display }));
    await p.close();
    p = await apri(browser, { stato: inst, extraLs: recente });
    await creaViaggio(p, 'Lisbona');
    await p.waitForTimeout(4000);
    const computer = await p.evaluate(() => ({ foglio: document.getElementById('mHome').classList.contains('active'), riga: getComputedStyle(document.getElementById('homeRiga')).display }));
    await p.close();
    ok('4. nell\'app installata non compare (e nemmeno fuori da iPhone)', !installata.foglio && installata.riga === 'none' && !computer.foglio && computer.riga === 'none',
       JSON.stringify({ installata, computer }));
  });

  /* ── 5. l'app installata e vuota ─────────────────────────────────────── */
  await prova('5', async () => {
    let p = await apri(browser, { ua: IPHONE, installata: true });
    const comparso = await aspettaFoglio(p, 'mDaSafari', 7000);
    await p.waitForTimeout(600);
    const vede = await p.evaluate(() => ({ t: document.querySelector('#mDaSafari .sheet-t').textContent.trim(),
      cancello: getComputedStyle(document.getElementById('authGate')).display,
      tasti: [...document.querySelectorAll('#mDaSafari .sheet .btn')].map(b => b.textContent.trim()),
      accetta: (document.querySelector('#mDaSafari input[type=file]') || {}).accept || '' }));
    const accediSopra = await sopra(p, '#mDaSafari button[onclick="daSafariAccedi()"]');
    const ripristinaSopra = await sopra(p, '#mDaSafari label.btn');
    ok('5. app installata vuota: «Avevi già dei viaggi in Safari?», con «Accedi» e «Ripristina da un backup», sopra la schermata di accesso',
       comparso && vede.t === 'Avevi già dei viaggi in Safari?' && vede.tasti.includes('Accedi') && vede.tasti.includes('Ripristina da un backup')
       && /zip/.test(vede.accetta) && /json/.test(vede.accetta) && vede.cancello !== 'none' && accediSopra && ripristinaSopra,
       JSON.stringify(Object.assign(vede, { accediSopra, ripristinaSopra })));
    await p.click('#mDaSafari button[onclick="daSafariAccedi()"]');
    await p.waitForTimeout(700);
    const accedi = await p.evaluate(() => ({ foglio: document.getElementById('mDaSafari').classList.contains('active'),
      titolo: document.getElementById('auTitolo').textContent.trim(), modulo: getComputedStyle(document.getElementById('auMain')).display }));
    await p.reload({ waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof window.renderAll === 'function' && !document.getElementById('bootSplash'), null, { timeout: 30000 });
    await p.waitForTimeout(4500);
    const dopo = await attivo(p, 'mDaSafari');
    ok('5. «Accedi» porta al modulo d\'accesso, e la domanda non torna alla riapertura', !accedi.foglio && accedi.titolo === 'Accedi' && accedi.modulo === 'block' && !dopo,
       JSON.stringify({ accedi, dopo }));
    await p.close();
    /* In Safari (non installata) no; con la presentazione, dopo. */
    p = await apri(browser, { ua: IPHONE });
    await p.waitForTimeout(4500);
    const safari = await attivo(p, 'mDaSafari');
    await p.close();
    p = await apri(browser, { ua: IPHONE, installata: true, intro: true });
    await p.waitForTimeout(4000);
    const conIntro = await p.evaluate(() => ({ intro: getComputedStyle(document.getElementById('intro')).display, foglio: document.getElementById('mDaSafari').classList.contains('active') }));
    await p.evaluate(() => introFine());
    const dopoIntro = await aspettaFoglio(p, 'mDaSafari', 6000);
    await p.close();
    ok('5. in Safari non compare; con la presentazione aspetta che finisca', !safari && conIntro.intro !== 'none' && !conIntro.foglio && dopoIntro,
       JSON.stringify({ safari, conIntro, dopoIntro }));
  });

  /* ── 6. il backup con le foto ─────────────────────────────────────────── */
  await prova('6', async () => {
    const k = unViaggio(201, 'Kyoto');
    const fotoK = [foto('ph-a', 201), foto('ph-b', 201, { mini: PNG, cloudId: 'c-b', percorso: 'x/c-b.jpg' }), foto('tk-1', 201, { kind: 'ticket', mini: undefined })];
    let p = await apri(browser, { stato: vuoto({ trips: [k], currentTripId: 201 }), condividi: true, foto: fotoK,
      extraLs: { geppgo2_pack_201_local: [{ id: 1, cat: 'Documenti', label: 'Passaporto', checked: false, custom: true }] },
      tessere: [{ k: 'z/1/2/3', b: 'pezzo di mappa' }] });
    await p.evaluate(() => go('trips'));
    await p.waitForTimeout(300);
    const nessuno = await p.evaluate(() => document.getElementById('backupUltimo').textContent);
    await p.click('#trips button[onclick="exportData()"]');
    const pronto = await aspetta(p, () => /Condividi o salva/.test(document.getElementById('bkAzioni').textContent), null, 15000);
    const barra = await p.evaluate(() => ({ stato: document.getElementById('bkStato').textContent, pieno: document.getElementById('bkPieno').style.width,
      valore: document.querySelector('#mBackup .bk-barra').getAttribute('aria-valuenow') }));
    await p.click('#bkAzioni button:has-text("Condividi o salva")');
    await p.waitForTimeout(500);
    const f = await fileCondiviso(p);
    let dentro = null;
    if (f && fflate) {
      const z = fflate.unzipSync(new Uint8Array(f.buf));
      const j = JSON.parse(fflate.strFromU8(z['geppgo.json']));
      dentro = { nomi: Object.keys(z), j, z };
    }
    const jpeg = Buffer.from(JPEG.split(',')[1], 'base64'), png = Buffer.from(PNG.split(',')[1], 'base64');
    const fileDi = (id, campo) => { const m = dentro && dentro.j.foto.find(x => x.id === id); const n = m && m[campo]; return n && dentro.z[n] ? Buffer.from(dentro.z[n]) : null; };
    ok('6. l\'esportazione dà un file solo, .zip, al foglio Condividi, con la barra arrivata in fondo',
       pronto && !!f && /^geppgo-backup-\d{4}-\d{2}-\d{2}\.zip$/.test(f.nome) && f.tipo === 'application/zip' && barra.valore === '100' && barra.pieno === '100%',
       JSON.stringify(Object.assign({ nome: f && f.nome, tipo: f && f.tipo }, barra)));
    ok('6. dentro: i dati (viaggio, valigia) e le foto, piene e miniature, byte per byte; i pezzi di mappa no',
       !!dentro && dentro.j.formato === 'geppgo-backup' && dentro.j.dati.trips[0].name === 'Kyoto' && dentro.j.foto.length === 3
       && JSON.stringify(dentro.j.bagagli.geppgo2_pack_201_local.map(x => x.label)) === '["Passaporto"]'
       && fileDi('ph-a', 'file').equals(jpeg) && fileDi('ph-a', 'fileMini').equals(jpeg) && fileDi('ph-b', 'fileMini').equals(png) && !!fileDi('tk-1', 'file')
       && !dentro.nomi.some(n => /tessere|mappa|z\/1/.test(n)) && !/pezzo di mappa/.test(JSON.stringify(dentro.j)),
       dentro ? dentro.nomi.join(', ') : 'nessuno zip');
    const ultimo = await p.evaluate(() => document.getElementById('backupUltimo').textContent);
    const oggi = await p.evaluate(() => new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }));
    ok('6. nel Profilo la data dell\'ultimo backup', nessuno === 'Nessun backup fatto da questo telefono' && ultimo === 'Ultimo backup: ' + oggi, nessuno + ' → ' + ultimo);
    await p.close();
    /* Ripristinato su un telefono vuoto. */
    p = await apri(browser, { stato: vuoto() });
    await p.evaluate(() => go('trips'));
    await p.waitForTimeout(300);
    await p.setInputFiles('#trips input[onchange="importData(event)"]', { name: f ? f.nome : 'x.zip', mimeType: 'application/zip', buffer: f ? f.buf : Buffer.from('x') });
    const fatto = await aspetta(p, () => /Backup ripristinato/.test(document.getElementById('bkStato').textContent), null, 15000);
    const rip = await p.evaluate(() => ({ msg: document.getElementById('bkStato').textContent, viaggi: app.trips.map(t => t.name), spese: app.trips[0] && app.trips[0].expenses.length,
      valigia: app.trips[0] ? getPacking(app.trips[0]).map(x => x.label) : [] }));
    const fotoR = await fotoInIdb(p);
    const a2 = fotoR.find(x => x.id === 'ph-a'), b2 = fotoR.find(x => x.id === 'ph-b'), t2 = fotoR.find(x => x.id === 'tk-1');
    ok('6. ripristinato su un profilo vuoto riporta viaggi, valigia e foto, uguali',
       fatto && JSON.stringify(rip.viaggi) === '["Kyoto"]' && rip.spese === 1 && JSON.stringify(rip.valigia) === '["Passaporto"]' && fotoR.length === 3
       && a2 && a2.data === JPEG && a2.mini === JPEG && a2.tripId === 201 && b2 && b2.mini === PNG && b2.cloudId === 'c-b' && t2 && t2.kind === 'ticket' && t2.data === JPEG,
       rip.msg + ' · ' + fotoR.map(x => x.id).join(','));
    await p.close();
    /* Lo stesso backup scompattato e ricompattato da un altro programma: le
       foto prima del JSON, tutto dentro una cartella. */
    let rifatto = null;
    if (dentro) {
      const voci = {};
      Object.keys(dentro.z).filter(n => n !== 'geppgo.json').sort().forEach(n => { voci['geppgo-backup/' + n] = dentro.z[n]; });
      voci['__MACOSX/geppgo-backup/._geppgo.json'] = new Uint8Array([0, 5, 22, 7]);
      voci['geppgo-backup/geppgo.json'] = dentro.z['geppgo.json'];
      rifatto = Buffer.from(fflate.zipSync(voci));
    }
    p = await apri(browser, { stato: vuoto() });
    await p.evaluate(() => go('trips'));
    await p.setInputFiles('#trips input[onchange="importData(event)"]', { name: 'geppgo-backup.zip', mimeType: 'application/zip', buffer: rifatto || Buffer.from('x') });
    const fatto3 = await aspetta(p, () => /Backup ripristinato/.test(document.getElementById('bkStato').textContent), null, 15000);
    const fotoR3 = await fotoInIdb(p);
    ok('6. anche uno zip rifatto da un altro programma (foto prima dei dati, dentro una cartella) riporta tutto',
       fatto3 && fotoR3.length === 3 && fotoR3.every(x => x.data === JPEG), await p.evaluate(() => document.getElementById('bkStato').textContent) + ' · ' + fotoR3.length + ' foto');
    await p.close();
    /* Troppo grande: lo dice, e propone i dati senza le foto. */
    p = await apri(browser, { stato: vuoto({ trips: [k], currentTripId: 201 }), condividi: true, foto: fotoK });
    await p.evaluate(() => { window.fotoElenco = async () => [{ meta: { id: 'enorme', tripId: 201, file: 'foto/1-enorme.jpg', tipo: 'image/jpeg' }, byte: 400 * 1048576 }]; exportData(); });
    const grande = await aspetta(p, () => /troppo/.test(document.getElementById('bkStato').textContent), null, 8000);
    const msgGrande = await p.evaluate(() => ({ t: document.getElementById('bkStato').textContent, tasti: [...document.querySelectorAll('#bkAzioni button')].map(b => b.textContent.trim()) }));
    await p.click('#bkAzioni button:has-text("Esporta senza le foto")');
    await aspetta(p, () => /Condividi o salva/.test(document.getElementById('bkAzioni').textContent), null, 10000);
    await p.click('#bkAzioni button:has-text("Condividi o salva")');
    await p.waitForTimeout(400);
    const leggero = await fileCondiviso(p);
    let senzaFoto = null;
    if (leggero && fflate) { const z = fflate.unzipSync(new Uint8Array(leggero.buf)); senzaFoto = { nomi: Object.keys(z), foto: JSON.parse(fflate.strFromU8(z['geppgo.json'])).foto.length }; }
    ok('6. troppo grande: lo dice col peso, e «Esporta senza le foto» fa un file coi soli dati',
       grande && /400 MB/.test(msgGrande.t) && msgGrande.tasti.includes('Esporta senza le foto') && !!senzaFoto && senzaFoto.foto === 0 && JSON.stringify(senzaFoto.nomi) === '["geppgo.json"]',
       msgGrande.t + ' · ' + JSON.stringify(senzaFoto));
    await p.close();
    /* Senza il foglio Condividi (un computer): si scarica. */
    p = await apri(browser, { stato: vuoto({ trips: [k], currentTripId: 201 }), foto: fotoK });
    await p.evaluate(() => go('trips'));
    await p.click('#trips button[onclick="exportData()"]');
    await aspetta(p, () => /Scarica il backup/.test(document.getElementById('bkAzioni').textContent), null, 15000);
    const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 8000 }).catch(() => null), p.click('#bkAzioni button:has-text("Scarica il backup")')]);
    await p.waitForTimeout(300);
    const scaricato = await p.evaluate(() => !!localStorage.getItem('geppgo2_ultimo_backup'));
    ok('6. senza il foglio Condividi il backup si scarica', !!dl && /^geppgo-backup-\d{4}-\d{2}-\d{2}\.zip$/.test(dl.suggestedFilename()) && scaricato,
       dl ? dl.suggestedFilename() : 'nessuno scaricamento');
    await p.close();
  });

  /* ── 7. il vecchio JSON ──────────────────────────────────────────────── */
  await prova('7', async () => {
    const vecchio = vuoto({ trips: [unViaggio(301, 'Vienna')], currentTripId: 301, myName: 'Gepp' });
    let p = await apri(browser, { stato: vuoto() });
    await p.evaluate(() => go('trips'));
    await p.setInputFiles('#trips input[onchange="importData(event)"]', { name: 'geppgo-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(vecchio)) });
    const fatto = await aspetta(p, () => /Backup ripristinato/.test(document.getElementById('bkStato').textContent), null, 8000);
    const a = await p.evaluate(() => ({ msg: document.getElementById('bkStato').textContent, viaggi: app.trips.map(t => t.name), spese: app.trips[0] && app.trips[0].expenses.length }));
    ok('7. il vecchio JSON (solo i dati) si ripristina su un profilo vuoto', fatto && JSON.stringify(a.viaggi) === '["Vienna"]' && a.spese === 1 && /Viaggi: 1/.test(a.msg), a.msg);
    await p.close();
    /* Con dei viaggi gia' sul telefono prima si chiede, e si tiene una copia. */
    p = await apri(browser, { stato: vuoto({ trips: [unViaggio(302, 'Praga')], currentTripId: 302 }) });
    await p.evaluate(() => go('trips'));
    await p.setInputFiles('#trips input[onchange="importData(event)"]', { name: 'geppgo-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(vecchio)) });
    const chiede = await aspettaFoglio(p, 'mConfirm', 4000);
    const domanda = await p.evaluate(() => document.getElementById('cfTitle').textContent);
    await p.click('#cfOk');
    const fatto2 = await aspetta(p, () => /Backup ripristinato/.test(document.getElementById('bkStato').textContent), null, 8000);
    const b = await p.evaluate(() => ({ viaggi: app.trips.map(t => t.name), copia: (localStorage.getItem('geppgo2_snap') || '').includes('Praga') }));
    ok('7. con dei viaggi sul telefono prima chiede, e tiene una copia fra i punti di ripristino', chiede && domanda === 'Ripristinare il backup?' && fatto2 && JSON.stringify(b.viaggi) === '["Vienna"]' && b.copia,
       domanda + ' · ' + JSON.stringify(b));
    await p.close();
    /* Il JSON del formato nuovo va anche lui; un file qualunque no. */
    p = await apri(browser, { stato: vuoto() });
    await p.evaluate(() => go('trips'));
    await p.setInputFiles('#trips input[onchange="importData(event)"]', { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ciao: 1 })) });
    const rifiuta = await aspetta(p, () => /non è un backup/.test(document.getElementById('bkStato').textContent), null, 6000);
    const nienteToccato = await p.evaluate(() => app.trips.length === 0);
    await p.evaluate(() => closeSheet('mBackup'));
    await p.waitForTimeout(500);
    await p.setInputFiles('#trips input[onchange="importData(event)"]', { name: 'geppgo.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ formato: 'geppgo-backup', versione: 2, dati: vecchio, bagagli: {}, foto: [] })) });
    const nuovo = await aspetta(p, () => /Backup ripristinato/.test(document.getElementById('bkStato').textContent) && app.trips.length === 1, null, 6000);
    ok('7. un JSON qualunque viene rifiutato senza toccare niente; il JSON del formato nuovo va', rifiuta && nienteToccato && nuovo, JSON.stringify({ rifiuta, nienteToccato, nuovo }));
    await p.close();
  });

  /* ── 8. Esci ──────────────────────────────────────────────────────────── */
  await prova('8', async () => {
    const trip = unViaggio(401, 'Kyoto', { cid: 'cid-1' });
    const base = conAccount(trip);
    /* Niente in attesa: si esce subito. */
    let p = await apri(browser, base);
    const pronta = await allineata(p);
    await p.evaluate(() => go('trips'));
    await p.waitForTimeout(300);
    await p.click('#profileCard button[onclick="authOut()"]');
    await p.waitForTimeout(800);
    const subito = await p.evaluate(() => ({ foglio: document.getElementById('mEsci').classList.contains('active'), uscito: window.__nuvola.chiamate.some(c => c.auth === 'signOut'),
      toast: (document.querySelector('.toast') || {}).textContent || '', sessione: !!session }));
    ok('8. senza niente in attesa «Esci» esce subito', pronta && !subito.foglio && subito.uscito && !subito.sessione && subito.toast === 'Sei uscito dall\'account', JSON.stringify(subito));
    await p.close();
    /* Due modifiche e tre foto rimaste indietro. */
    p = await apri(browser, base);
    await allineata(p);
    await p.evaluate(() => {
      window.__nuvola.giu = true;
      T().name = 'Kyoto e Nara';
      T().expenses.push({ id: 702, desc: 'Treno', category: 'Trasporti', amount: 12, origAmount: 12, origCurrency: 'EUR', paid: 1, who: [1], date: '2026-11-02', type: 'expense' });
      save();
    });
    await mettiFoto(p, [foto('ph-1', 401), foto('ph-2', 401), foto('ph-3', 401)]);
    await p.waitForTimeout(1500);
    await p.evaluate(() => go('trips'));
    await p.waitForTimeout(300);
    await p.click('#profileCard button[onclick="authOut()"]');
    const avviso = await aspettaFoglio(p, 'mEsci', 4000);
    const quante = await p.evaluate(() => [...document.querySelectorAll('#esciQuante div')].map(d => d.textContent));
    const tasti = await p.evaluate(() => [...document.querySelectorAll('#mEsci .sheet button.btn')].map(b => b.textContent.trim()));
    ok('8. con modifiche e foto in attesa compare l\'avviso, coi numeri giusti e i due tasti',
       avviso && JSON.stringify(quante) === JSON.stringify(['Modifiche non ancora nel cloud: 2', 'Foto non ancora nel cloud: 3']) && tasti.includes('Aspetta e sincronizza') && tasti.includes('Esci lo stesso'),
       JSON.stringify({ quante, tasti }));
    /* «Aspetta e sincronizza» senza rete: non esce, e lo dice. */
    await p.click('#esciAspetta');
    await aspetta(p, () => /Non sono riuscito/.test(document.getElementById('esciStato').textContent), null, 10000);
    const senzaRete = await p.evaluate(() => ({ stato: document.getElementById('esciStato').textContent, foglio: document.getElementById('mEsci').classList.contains('active'), sessione: !!session }));
    /* Torna la rete: parte tutto, poi esce. */
    await p.evaluate(() => { window.__nuvola.giu = false; });
    await p.click('#esciAspetta');
    const uscito = await aspetta(p, () => window.__nuvola.chiamate.some(c => c.auth === 'signOut'), null, 15000);
    await p.waitForTimeout(400);
    const dopo = await p.evaluate(() => ({ nome: window.__nuvola.trips[0].data.name, spese: window.__nuvola.trips[0].data.expenses.length, righe: window.__nuvola.foto.length,
      toast: (document.querySelector('.toast') || {}).textContent || '', foglio: document.getElementById('mEsci').classList.contains('active') }));
    ok('8. «Aspetta e sincronizza»: senza rete resta dentro e lo dice; con la rete manda tutto, poi esce',
       senzaRete.foglio && senzaRete.sessione && /Non sono riuscito a salvare tutto/.test(senzaRete.stato) && uscito && dopo.nome === 'Kyoto e Nara' && dopo.spese === 2 && dopo.righe === 3 && !dopo.foglio
       && dopo.toast === 'Tutto salvato nel cloud: sei uscito dall\'account.', JSON.stringify({ senzaRete, dopo }));
    await p.close();
    /* «Esci lo stesso»: esce, e sul telefono resta tutto. */
    p = await apri(browser, base);
    await allineata(p);
    await p.evaluate(() => { window.__nuvola.giu = true; T().name = 'Kyoto e Nara'; save(); });
    await p.waitForTimeout(1500);
    await p.evaluate(() => go('trips'));
    await p.click('#profileCard button[onclick="authOut()"]');
    await aspettaFoglio(p, 'mEsci', 4000);
    await p.click('#mEsci button:has-text("Esci lo stesso")');
    const esce = await aspetta(p, () => window.__nuvola.chiamate.some(c => c.auth === 'signOut'), null, 5000);
    const resta = await p.evaluate(() => app.trips.map(t => t.name));
    ok('8. «Esci lo stesso» esce subito, e i dati restano sul telefono', esce && JSON.stringify(resta) === '["Kyoto e Nara"]', JSON.stringify(resta));
    await p.close();
  });

  /* ── 9. lo stato nel Profilo ──────────────────────────────────────────── */
  await prova('9', async () => {
    const trip = unViaggio(501, 'Kyoto', { cid: 'cid-9' });
    const p = await apri(browser, conAccount(trip));
    await allineata(p);
    await p.evaluate(() => go('trips'));
    const leggi = () => p.evaluate(() => { const el = document.getElementById('statoCloud'); return el ? { t: el.textContent, attesa: el.classList.contains('in-attesa') } : null; });
    const aspettaTesto = t => aspetta(p, x => (document.getElementById('statoCloud') || {}).textContent === x, t, 6000);
    await aspettaTesto('Tutto salvato nel cloud');
    const tutto = await leggi();
    await p.evaluate(() => { window.__nuvola.giu = true; T().name = 'Kyoto e Nara'; save(); });
    await aspettaTesto('1 modifica in attesa');
    const una = await leggi();
    await p.evaluate(() => { T().expenses.push({ id: 703, desc: 'Tè', category: 'Cibo', amount: 4, origAmount: 4, origCurrency: 'EUR', paid: 1, who: [1], date: '2026-11-02', type: 'expense' }); save(); });
    await aspettaTesto('2 modifiche in attesa');
    const due = await leggi();
    await p.evaluate(async () => { window.__nuvola.giu = false; window.__nuvola.fotoGiu = true; await syncPush(); });
    await mettiFoto(p, [foto('ph-91', 501), foto('ph-92', 501), foto('ph-93', 501)]);
    await p.evaluate(() => fotoDaSpedire());
    await aspettaTesto('3 foto da caricare');
    const tre = await leggi();
    await p.evaluate(() => { window.__nuvola.fotoGiu = false; return fotoDaSpedire(); });
    await aspettaTesto('Tutto salvato nel cloud');
    const dinuovo = await leggi();
    ok('9. tutto nel cloud: «Tutto salvato nel cloud»', !!tutto && tutto.t === 'Tutto salvato nel cloud' && !tutto.attesa && !!dinuovo && dinuovo.t === 'Tutto salvato nel cloud', JSON.stringify({ tutto, dinuovo }));
    ok('9. modifiche non ancora sincronizzate: «N modifiche in attesa»', !!una && una.t === '1 modifica in attesa' && una.attesa && !!due && due.t === '2 modifiche in attesa', JSON.stringify({ una, due }));
    ok('9. foto non ancora caricate: «N foto da caricare»', !!tre && tre.t === '3 foto da caricare' && tre.attesa, JSON.stringify(tre));
    await p.close();
  });

  /* ── 10. cinque lingue, da 320 a 430 px, chiaro e scuro ──────────────── */
  await prova('10', async () => {
    /* Le frasi nuove ci sono tutte, in tutte e quattro le altre lingue, coi
       buchi {1} {2} al loro posto. */
    let p = await apri(browser, { stato: vuoto() });
    const diz = await p.evaluate(() => {
      if (typeof DIZIONARIO_DATI === 'undefined') return null;
      const it = Object.keys(DIZIONARIO_DATI.en), buchi = [];
      ['en', 'es', 'fr', 'pt'].forEach(l => it.forEach(k => {
        const v = DIZIONARIO_DATI[l][k];
        if (!v || !v.trim()) buchi.push(l + ': ' + k);
        /* Una parola che in italiano non cambia («1 foto», «3 foto») porta
           nella traduzione le due forme separate da «|» (vedi tp): i buchi si
           guardano forma per forma. */
        else if (v.split('|').some(f => (k.match(/\{\d\}/g) || []).sort().join() !== (f.match(/\{\d\}/g) || []).sort().join())) buchi.push(l + ' segnaposto: ' + k);
        else if (DIZIONARIO[l][k] !== v) buchi.push(l + ' coperta: ' + k);
      }));
      return { n: it.length, buchi };
    });
    await p.close();
    ok('10. le frasi nuove ci sono in inglese, spagnolo, francese e portoghese', !!diz && diz.n >= 50 && !diz.buchi.length, diz ? (diz.buchi.slice(0, 3).join(' | ') || diz.n + ' frasi') : 'nessun dizionario');
    /* A schermo, in ogni lingua: ogni foglio nuovo e la scheda del backup. */
    const scena = async pp => pp.evaluate(() => {
      const fogli = {};
      const testi = el => { const out = []; const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const s = n.nodeValue.trim(); if (s.length > 1 && getComputedStyle(n.parentNode).display !== 'none') out.push(s); } return out; };
      const prendi = (id, prepara) => { prepara(); fogli[id] = testi(document.querySelector('#' + id + ' .sheet')); closeSheet(id); };
      prendi('mSoloQui', () => openSheet('mSoloQui'));
      prendi('mHome', () => openSheet('mHome'));
      prendi('mDaSafari', () => openSheet('mDaSafari'));
      prendi('mBackup', () => { bkApri(tv('Backup')); bkStato(tv('Foto {1} di {2}…', 3, 10), 0.3); });
      prendi('mEsci', () => { esciMostra(2, 3); openSheet('mEsci'); });
      go('trips'); mostraUltimoBackup();
      const scheda = document.getElementById('backupUltimo').closest('.card');
      fogli.backup = testi(scheda);
      return fogli;
    });
    const nonTradotte = [];
    for (const l of ['en', 'es', 'fr', 'pt']) {
      p = await apri(browser, { stato: vuoto({ trips: [unViaggio(601, 'Roma')], currentTripId: 601 }), lingua: l });
      await p.waitForTimeout(300);
      const fogli = await scena(p);
      await p.waitForTimeout(200);
      const restate = await p.evaluate(([fg, lin]) => {
        const out = [];
        Object.keys(fg).forEach(id => fg[id].forEach(s => { const v = DIZIONARIO[lin][s]; if (v !== undefined && v !== s) out.push(id + ': ' + s); }));
        return out;
      }, [fogli, l]);
      if (restate.length) nonTradotte.push(l + ' → ' + restate.slice(0, 2).join(' | '));
      await p.close();
    }
    ok('10. i fogli nuovi e la scheda del backup si leggono in ogni lingua', !nonTradotte.length, nonTradotte.join(' || ') || 'en, es, fr, pt');
    /* Da 320 a 430 px, chiaro e scuro, in italiano e in francese (le frasi
       piu' lunghe): niente esce dallo schermo, niente testo tagliato, i
       tasti si toccano col pollice. */
    const guasti = [];
    for (const l of [null, 'fr']) for (const scuro of [false, true]) {
      p = await apri(browser, { stato: vuoto({ trips: [unViaggio(602, 'Roma')], currentTripId: 602 }), lingua: l, scuro });
      for (const larghezza of [320, 375, 390, 430]) {
        await p.setViewportSize({ width: larghezza, height: 740 });
        await p.waitForTimeout(150);
        const g = await p.evaluate(([W, dove]) => {
          const out = [];
          const guarda = (radice, nome) => {
            radice.querySelectorAll('*').forEach(el => {
              const r = el.getBoundingClientRect();
              if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') return;
              if (r.right > W + 1 || r.left < -1) out.push(nome + ' ' + (el.id || el.className || el.tagName) + ' ' + Math.round(r.left) + '→' + Math.round(r.right));
              /* I tasti nuovi si toccano col pollice; quelli che c'erano gia'
                 nella scheda del backup devono almeno starci. */
              if (el.matches('.btn') && el.scrollWidth > el.clientWidth + 1) out.push(nome + ' tasto tagliato ' + el.textContent.trim().slice(0, 24));
              if (el.matches('.modal .btn, .dati-link, #homeRiga .btn') && r.height < 44) out.push(nome + ' tasto ' + el.textContent.trim().slice(0, 24) + ' ' + Math.round(r.height) + 'px');
            });
            if (radice.scrollWidth > radice.clientWidth + 1) out.push(nome + ' scorre di lato');
          };
          const scena = [
            ['mSoloQui', () => openSheet('mSoloQui')],
            ['mHome', () => openSheet('mHome')],
            ['mDaSafari', () => openSheet('mDaSafari')],
            ['mBackup', () => { bkApri(tv('Backup')); bkStato(tv('Il backup sarebbe di {1}: troppo per farlo in una volta su questo telefono. Puoi esportare i dati senza le foto.', '1,2 GB'), null); bkAzioni(`<button class="btn btn-primario btn-block" style="margin-bottom:.5rem">${esc(tv('Esporta senza le foto'))}</button>` + bkChiudiHtml()); }],
            ['mEsci', () => { esciMostra(12, 340); document.getElementById('esciStato').textContent = tv('Non sono riuscito a salvare tutto: controlla la rete e riprova.'); openSheet('mEsci'); }]
          ];
          for (const [id, apri] of scena) {
            apri();
            const m = document.getElementById(id);
            m.classList.add('in-scena', 'active');
            guarda(m.querySelector('.sheet'), dove + ' ' + id);
            m.classList.remove('active', 'in-scena');
          }
          go('trips'); mostraUltimoBackup();
          document.getElementById('homeRiga').style.display = '';
          guarda(document.getElementById('backupUltimo').closest('.card'), dove + ' backup');
          if (document.documentElement.scrollWidth > W) out.push(dove + ' la pagina scorre di lato');
          return out;
        }, [larghezza, `${l || 'it'} ${larghezza}${scuro ? ' scuro' : ''}`]);
        guasti.push(...g);
      }
      const tema = await p.evaluate(() => ({ scuro: document.body.classList.contains('dark'), sfondo: getComputedStyle(document.querySelector('#mEsci .sheet')).backgroundColor }));
      if (tema.scuro !== scuro) guasti.push(`${l || 'it'}: il tema ${scuro ? 'scuro' : 'chiaro'} non c'è`);
      await p.close();
    }
    ok('10. da 320 a 430 px, chiaro e scuro, italiano e francese: niente fuori schermo, niente tagliato, tasti da 44 px', !guasti.length,
       guasti.slice(0, 4).join(' | ') || '2 lingue × 2 temi × 4 larghezze × 6 schermate');
  });

  ok('nessun errore in pagina', !errori.length, errori.slice(0, 3).join(' | '));
  console.log('\n' + r.join('\n'));
  const falliti = r.filter(x => x.includes('FALLITO')).length;
  console.log(`\n${r.length - falliti}/${r.length} passati`);
  await browser.close();
  process.exit(falliti ? 1 : 0);
})();
