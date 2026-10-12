/* LA VALIGIA E LE IMPOSTAZIONI NEL CLOUD, E I CONFLITTI SENZA PERDITE.

   Qui due telefoni e un compagno di viaggio parlano con lo STESSO cloud: un
   cloud finto che vive in Node (Nuvola, qui sotto), con le regole di chi
   vede cosa scritte come nel database vero, e il tempo reale che avvisa le
   altre pagine quando un viaggio cambia. Ogni pagina puo' restare senza
   rete (window.__offline) per far nascere i conflitti veri.
   Le regole vere del database si provano su Postgres (la prova 7, che usa
   test/supabase-prova-personale.sql).
   1. il backup tiene le foto di chi lo fa, non quelle dei compagni;
   2. il ripristino con l'account: un viaggio condiviso torna come copia
      privata e quello del gruppo resta com'e'; uno solo tuo torna com'era;
   3. chi ha gia' viaggi senza account vede l'avviso alla prima apertura dopo
      l'aggiornamento, poi non prima di una settimana;
   4. la valigia passa da un telefono all'altro dello stesso account, e un
      compagno non la vede; due valigie fatte prima diventano una sola;
   5. le impostazioni scelte passano; quelle del telefono no; una
      navigazione al volo e i valori di serie non passano sopra a una scelta;
   6. senza la tabella nel cloud l'app funziona in locale, senza errori;
   7. il database: B non legge ne' scrive le righe di A;
   8. due telefoni senza rete aggiungono compagni diversi: restano tutti e
      due; uno tolto non ricompare;
   9. nome cambiato su A e date cambiate su B: restano tutte e due;
   10. un viaggio del formato di prima si unisce senza perdere niente, e
       nemmeno un nome cambiato da un telefono con l'app di prima;
   11. i testi nuovi in cinque lingue, e niente fuori schermo. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { apriBrowser, APP, leafletJs, RADICE } = require('./browser');

const FFLATE_JS = (() => { try { return fs.readFileSync(path.join(RADICE, 'node_modules', 'fflate', 'umd', 'index.js'), 'utf8'); } catch (e) { return null; } })();
let fflate = null;
try { fflate = require(path.join(RADICE, 'node_modules', 'fflate')); } catch (e) {}
const JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a' +
  'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA' +
  'AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';
const GIORNO = 864e5;
const ANNA = 'u-anna', BRUNO = 'u-bruno';

const r = [];
const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);
const errori = [];

/* ── il cloud finto, uno per tutte le pagine ──────────────────────────────── */
const copia = x => x == null ? x : JSON.parse(JSON.stringify(x));
class Nuvola {
  constructor() { this.pagine = new Map(); this.azzera(); }
  azzera() {
    this.t = { trips: [], trip_members: [], foto: [], raccolte: [], dati_personali: [] };
    this.file = {}; this.chiamate = []; this.assente = false; this.n = 0;
  }
  membro(u, trip) { return this.t.trip_members.some(m => m.trip_id === trip && m.user_id === u); }
  vede(tab, u, r) {
    if (tab === 'trips') return r.owner === u || this.membro(u, r.id);
    if (tab === 'trip_members') return r.user_id === u || this.membro(u, r.trip_id);
    if (tab === 'dati_personali') return r.user_id === u;
    if (tab === 'foto') return this.membro(u, r.trip_id);
    return true;
  }
  /* Le regole di scrittura, come nello schema. */
  scrive(tab, u, r) {
    if (tab === 'trips') return r.owner === u || this.membro(u, r.id);
    if (tab === 'trip_members') return r.user_id === u;
    if (tab === 'dati_personali') return r.user_id === u && (!r.trip_id || this.membro(u, r.trip_id))
      && (r.chiave === 'impostazioni' ? !r.trip_id : r.chiave === 'valigia:' + r.trip_id);
    if (tab === 'foto') return this.membro(u, r.trip_id) && r.caricata_da === u;
    return true;
  }
  esegui(q, page) {
    const u = q.utente;
    if (page) this.pagine.set(page, u);
    this.chiamate.push({ tab: q.tab, op: q.op, utente: u });
    const rifiuto = m => ({ data: null, error: { message: m } });
    if (q.tab === '__storage') { if (!u) return rifiuto('no'); this.file[q.path] = q.byte; return { data: { path: q.path }, error: null }; }
    if (q.tab === '__rpc') {
      if (q.op === 'join_trip') { const t = this.t.trips.find(x => x.id === q.arg.p_trip && x.invite_code === q.arg.p_code); if (!t) return rifiuto('codice'); if (!this.membro(u, t.id)) this.t.trip_members.push({ trip_id: t.id, user_id: u, ruolo: 'compagno' }); }
      return { data: null, error: null };
    }
    if (q.tab === 'dati_personali' && this.assente)
      return { data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.dati_personali' in the schema cache" }, status: 404 };
    if (!u) return rifiuto('permission denied');
    const T = this.t[q.tab] = this.t[q.tab] || [];
    const passa = x => q.filtri.every(f => f.tipo === 'in' ? f.v.map(String).includes(String(x[f.c])) : String(x[f.c]) === String(f.v));
    if (q.op === 'select') {
      const d = T.filter(x => this.vede(q.tab, u, x) && passa(x)).map(copia);
      return { data: q.single ? (d[0] || null) : d, error: null };
    }
    if (q.op === 'insert' || q.op === 'upsert') {
      const righe = (Array.isArray(q.riga) ? q.riga : [q.riga]).map(copia);
      for (const x of righe) {
        if (q.tab === 'trips') { this.n++; x.id = x.id || 'cid-n' + this.n; x.invite_code = x.invite_code || 'inv-n' + this.n; }
        if (!this.scrive(q.tab, u, x)) return rifiuto('new row violates row-level security policy');
      }
      const toccate = [];
      for (const x of righe) {
        const gia = q.op === 'upsert' && q.tab === 'dati_personali' ? T.find(y => y.user_id === x.user_id && y.chiave === x.chiave) : null;
        if (gia) { if (!this.vede(q.tab, u, gia)) return rifiuto('rls'); Object.assign(gia, x); toccate.push(gia); }
        else { T.push(x); toccate.push(x); }
      }
      this.avvisa(q.tab, 'INSERT', toccate);
      return { data: q.single ? copia(toccate[0]) : copia(toccate), error: null };
    }
    if (q.op === 'update') {
      const d = T.filter(x => this.vede(q.tab, u, x) && passa(x));
      for (const x of d) if (!this.scrive(q.tab, u, Object.assign({}, x, q.patch))) return rifiuto('rls');
      d.forEach(x => Object.assign(x, copia(q.patch)));
      this.avvisa(q.tab, 'UPDATE', d);
      return { data: q.single ? copia(d[0] || null) : copia(d), error: null };
    }
    if (q.op === 'delete') {
      const d = T.filter(x => this.vede(q.tab, u, x) && passa(x));
      this.t[q.tab] = T.filter(x => !d.includes(x));
      return { data: copia(d), error: null };
    }
    return rifiuto('operazione sconosciuta');
  }
  /* Il tempo reale: chi puo' leggere il viaggio riceve la riga nuova. */
  avvisa(tab, evento, righe) {
    if (tab !== 'trips') return;
    for (const [page, u] of this.pagine) {
      if (page.isClosed()) { this.pagine.delete(page); continue; }
      righe.forEach(x => {
        if (!(x.owner === u || this.membro(u, x.id))) return;
        page.evaluate(([t, p]) => window.__rt && window.__rt(t, p), [tab, { eventType: evento, new: copia(x), old: { id: x.id } }]).catch(() => {});
      });
    }
  }
}
const nuvola = new Nuvola();

/* Il finto supabase-js dentro la pagina: ogni richiesta va a Nuvola. */
const SUPA_FINTO = `(()=>{
  let sessione=window.__sessione||null,ascolta=null;
  const chiama=q=>{
    if(window.__offline)return Promise.resolve({data:null,error:{message:'Failed to fetch'}});
    q.utente=sessione&&sessione.user?sessione.user.id:null;
    return window.__nuvolaRpc(q);
  };
  function query(tab){
    const st={tab,op:'select',filtri:[],single:false};let px;
    const b={
      select(){return px;},insert(x){st.op='insert';st.riga=x;return px;},upsert(x){st.op='upsert';st.riga=x;return px;},
      update(x){st.op='update';st.patch=x;return px;},delete(){st.op='delete';return px;},
      eq(c,v){st.filtri.push({c,v,tipo:'eq'});return px;},in(c,v){st.filtri.push({c,v,tipo:'in'});return px;},
      single(){st.single=true;return px;},maybeSingle(){st.single=true;return px;},
      then(a,b2){return chiama(JSON.parse(JSON.stringify(st))).then(a,b2);}
    };
    px=new Proxy(b,{get:(o,k)=>k in o?o[k]:(()=>px)});
    return px;
  }
  const entra=(email)=>{sessione={user:{id:window.__utenteNuovo||'u-nuovo',email},access_token:'x',refresh_token:'y'};const s=sessione;setTimeout(()=>ascolta&&ascolta('SIGNED_IN',s),0);return{data:{user:s.user,session:s},error:null};};
  const auth={
    onAuthStateChange(cb){ascolta=cb;return{data:{subscription:{unsubscribe(){}}}};},
    async getSession(){return{data:{session:sessione},error:null};},
    async getUser(){return{data:{user:sessione&&sessione.user},error:null};},
    async signUp(o){return entra(o.email);},async signInWithPassword(o){return entra(o.email);},
    async signOut(){sessione=null;setTimeout(()=>ascolta&&ascolta('SIGNED_OUT',null),0);return{error:null};},
    async setSession(){return{data:{},error:{message:'no'}};},async exchangeCodeForSession(){return{data:{},error:{message:'no'}};},
    async updateUser(){return{data:{},error:null};},async resetPasswordForEmail(){return{data:{},error:null};},async verifyOtp(){return{data:{},error:{message:'no'}};}
  };
  const storage={from:()=>({
    upload:(p,blob)=>chiama({tab:'__storage',op:'upload',path:p,byte:blob.size,filtri:[]}),
    async remove(){return{data:null,error:null};},async createSignedUrl(){return{data:null,error:{message:'no'}};},async list(){return{data:[],error:null};}
  })};
  const canali=new Set();
  window.__rt=(t,p)=>{if(window.__offline)return;canali.forEach(c=>(c.cb[t]||[]).forEach(f=>{try{f(p);}catch(e){}}));};
  const canale=()=>{const c={cb:{},on(ev,f,cb){const t=f&&f.table;(c.cb[t]=c.cb[t]||[]).push(cb);return c;},subscribe(cb){canali.add(c);if(typeof cb==='function')setTimeout(()=>cb('SUBSCRIBED'),0);return c;},unsubscribe(){canali.delete(c);return Promise.resolve();},send(){return Promise.resolve('ok');}};return c;};
  const client={auth,storage,from:query,channel:canale,
    removeChannel(c){canali.delete(c);return Promise.resolve();},removeAllChannels(){canali.clear();return Promise.resolve();},
    rpc(n,a){return chiama({tab:'__rpc',op:n,arg:a,filtri:[]});},functions:{invoke:async()=>({data:null,error:{message:'no'}})}};
  window.supabase={createClient:()=>client};
})();`;

/* Un viaggio come lo scrive l'app. */
const viaggio = (id, nome, persone, extra = {}) => Object.assign({
  id, name: nome, destination: 'Lisbona', currency: 'EUR', status: 'open', start: '2026-11-03', end: '2026-11-04',
  participants: persone, guests: [], suggested: [], pois: [], hotels: [], tickets: [], weather: {}, createdAt: 1,
  expenses: [{ id: 701, desc: 'Cena', category: 'Cibo', amount: 40, origAmount: 40, origCurrency: 'EUR', payerId: persone[0].id, splitAmong: persone.map(p => p.id), date: '2026-11-03', type: 'expense' }],
  days: [{ id: 'd1', date: '2026-11-03', title: '', activities: [{ id: 501, name: 'Torre di Belém', time: '10:00', timeEnd: '11:00', type: 'any', who: [], completed: false, booking: { needed: false, done: false } }] },
    { id: 'd2', date: '2026-11-04', title: '', activities: [] }]
}, extra);
const PERSONE = [{ id: 1, name: 'Anna' }, { id: 2, name: 'Bruno' }];
/* Il cloud di partenza: Lisbona, di Anna e Bruno; Porto, solo di Anna. */
function semina() {
  nuvola.azzera();
  nuvola.t.trips.push({ id: 'cid-1', owner: ANNA, invite_code: 'inv-1', data: viaggio(1001, 'Lisbona', PERSONE), updated_by: ANNA });
  nuvola.t.trips.push({ id: 'cid-2', owner: ANNA, invite_code: 'inv-2', data: viaggio(1002, 'Porto', [PERSONE[0]], { destination: 'Porto' }), updated_by: ANNA });
  nuvola.t.trip_members.push({ trip_id: 'cid-1', user_id: ANNA, participant_id: 1, ruolo: 'admin', member_name: 'Anna' });
  nuvola.t.trip_members.push({ trip_id: 'cid-1', user_id: BRUNO, participant_id: 2, ruolo: 'compagno', member_name: 'Bruno' });
  nuvola.t.trip_members.push({ trip_id: 'cid-2', user_id: ANNA, participant_id: 1, ruolo: 'admin', member_name: 'Anna' });
}
const vuoto = (extra = {}) => Object.assign({ trips: [], currentTripId: null, settings: { proxRadius: 200 }, myName: 'Anna', skipAuth: false, consentNotif: true }, extra);

/* Un telefono. Con utente, ha gia' fatto l'accesso a quell'account. */
async function apri(browser, { utente = null, stato = null, extraLs = null, foto = null, avvisi = false, condividi = false,
  larghezza = 390, altezza = 844, lingua = null } = {}) {
  const page = await browser.newPage({ viewport: { width: larghezza, height: altezza }, avvisi });
  page.on('pageerror', e => errori.push('PAGEERROR: ' + e.message.split('\n')[0]));
  await page.exposeBinding('__nuvolaRpc', (src, q) => nuvola.esegui(q, src.page));
  await page.route('**/leaflet@1.9.4/dist/leaflet.js', ro => ro.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(leafletJs(), 'utf8') }));
  await page.route(/tile\.openstreetmap\.org/, ro => ro.abort());
  await page.route('**/fflate@*/**', ro => FFLATE_JS ? ro.fulfill({ status: 200, contentType: 'application/javascript', body: FFLATE_JS }) : ro.abort());
  await page.route('**/supabase-js@*/**', ro => ro.fulfill({ status: 200, contentType: 'application/javascript', body: SUPA_FINTO }));
  await page.addInitScript(([u, s, x, fi, cond, l]) => {
    window.__sessione = u ? { user: { id: u, email: u + '@x.it' }, access_token: 'x', refresh_token: 'y' } : null;
    window.__offline = false;
    if (cond) { window.__condivisi = []; navigator.canShare = () => true; navigator.share = async o => { window.__condivisi.push(o); }; }
    if (sessionStorage.getItem('prova-personale')) return;
    sessionStorage.setItem('prova-personale', '1');
    localStorage.clear();
    if (s) { const st = JSON.parse(JSON.stringify(s)); st.settings = st.settings || {}; if (l) st.settings.lingua = l; localStorage.setItem('geppgo2', JSON.stringify(st)); }
    localStorage.setItem('geppgo2_intro', '1');
    if (x) Object.keys(x).forEach(k => localStorage.setItem(k, typeof x[k] === 'string' ? x[k] : JSON.stringify(x[k])));
    if (fi) {
      const q = indexedDB.open('geppgo_ph', 2);
      q.onupgradeneeded = e => { const db = e.target.result; if (!db.objectStoreNames.contains('ph')) db.createObjectStore('ph', { keyPath: 'id' }); if (!db.objectStoreNames.contains('tessere')) db.createObjectStore('tessere', { keyPath: 'k' }); };
      q.onsuccess = e => { const db = e.target.result; const tx = db.transaction('ph', 'readwrite'); fi.forEach(v => tx.objectStore('ph').put(v)); tx.oncomplete = () => db.close(); };
    }
  }, [utente, stato || vuoto(), extraLs, foto, condividi, lingua]);
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.renderAll === 'function' && !document.getElementById('bootSplash'), null, { timeout: 30000 });
  return page;
}
const prova = async (nome, fn) => { try { await fn(); } catch (e) { ok(nome, false, 'si è fermata: ' + e.message.split('\n')[0]); } };
const aspetta = (p, fn, arg, ms = 8000) => p.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
/* Il telefono ha preso i viaggi dal cloud e non ha piu' niente da mandare. */
const pronto = (p, n = 2) => aspetta(p, k => typeof app !== 'undefined' && app.trips.length >= k && !!session && !syncBusy && app.trips.every(t => !t.cid || allineato(t.cid, t)), n, 12000);
const viaggioDi = (p, cid) => p.evaluate(c => JSON.parse(JSON.stringify(app.trips.find(t => t.cid === c) || null)), cid);
const nelCloud = cid => copia((nuvola.t.trips.find(t => t.id === cid) || {}).data || null);
const senzaRete = (p, si) => p.evaluate(v => { window.__offline = v; }, si);
const sincronizza = p => p.evaluate(async () => { for (let i = 0; i < 50 && syncBusy; i++) await new Promise(r2 => setTimeout(r2, 100)); await syncPush(); });
/* Valigia e impostazioni: un giro intero, aspettando quello che fosse gia'
   partito da solo. */
const personale = p => p.evaluate(async () => {
  for (let i = 0; i < 80 && personaleBusy; i++) await new Promise(r2 => setTimeout(r2, 100));
  await personaleSync();
  for (let i = 0; i < 80 && personaleBusy; i++) await new Promise(r2 => setTimeout(r2, 100));
});
const nomi = t => (t && t.participants || []).map(x => x.name).sort().join(',');
/* Il contenuto di un viaggio, senza i contatori che l'app aggiorna da se'
   aprendolo su un telefono qualunque (i tentativi di trovare la foto di una
   tappa o i confini della citta', senza rete qui sempre falliti) e le ore
   delle modifiche: quello che si guarda e' se ci e' finito dentro il backup. */
const contenuto = x => JSON.parse(JSON.stringify(x, (k, v) => /^_(photoTry|bbTry|ct)$/.test(k) || (/^_del/.test(k) && v && !Object.keys(v).length) ? undefined : v));
const fileCondiviso = async p => {
  const f = await p.evaluate(async () => {
    const c = window.__condivisi && window.__condivisi[0]; if (!c) return null;
    const b = new Uint8Array(await c.files[0].arrayBuffer());
    let s = ''; for (let k = 0; k < b.length; k += 0x8000) s += String.fromCharCode.apply(null, b.subarray(k, k + 0x8000));
    return btoa(s);
  });
  return f && Buffer.from(f, 'base64');
};
async function esportaZip(p) {
  await p.evaluate(() => go('trips'));
  await p.click('#trips button[onclick="exportData()"]');
  await aspetta(p, () => /Condividi o salva/.test(document.getElementById('bkAzioni').textContent), null, 15000);
  await p.click('#bkAzioni button:has-text("Condividi o salva")');
  await p.waitForTimeout(400);
  const buf = await fileCondiviso(p);
  if (!buf || !fflate) return null;
  return JSON.parse(fflate.strFromU8(fflate.unzipSync(new Uint8Array(buf))['geppgo.json']));
}

(async () => {
  const browser = await apriBrowser();

  /* ── 1. il backup tiene solo le foto di chi lo fa ───────────────────── */
  await prova('1', async () => {
    semina();
    const fotoMiste = [
      { id: 'f-anna', tripId: 1001, date: '2026-11-03', data: JPEG, mini: JPEG, chi: ANNA, cloudId: 'c-1', percorso: 'cid-1/c-1.jpg' },
      { id: 'f-bruno', tripId: 1001, date: '2026-11-03', data: JPEG, mini: JPEG, chi: BRUNO, cloudId: 'c-2', percorso: 'cid-1/c-2.jpg' },
      { id: 'f-locale', tripId: 1001, date: '2026-11-03', data: JPEG, ts: 1 },
      { id: 'tk-1', tripId: 1001, kind: 'ticket', data: JPEG }];
    let p = await apri(browser, { utente: ANNA, condividi: true, foto: fotoMiste });
    await pronto(p);
    const j = await esportaZip(p);
    const ids = j ? j.foto.map(x => x.id).sort() : [];
    ok('1. il backup contiene le foto di chi lo fa (e le sue senza account, e i biglietti), non quelle dei compagni',
       JSON.stringify(ids) === JSON.stringify(['f-anna', 'f-locale', 'tk-1']), ids.join(', ') || 'nessun file');
    await p.close();
    /* Anche dopo essere usciti dall'account: il telefono ricorda chi era. */
    p = await apri(browser, { stato: vuoto({ skipAuth: true, trips: [viaggio(1001, 'Lisbona', PERSONE, { cid: 'cid-1' })], currentTripId: 1001 }),
      extraLs: { geppgo2_mio_uid: ANNA }, condividi: true, foto: fotoMiste });
    const j2 = await esportaZip(p);
    const ids2 = j2 ? j2.foto.map(x => x.id).sort() : [];
    ok('1. e anche uscito dall\'account le sue restano e quelle dei compagni no', JSON.stringify(ids2) === JSON.stringify(['f-anna', 'f-locale', 'tk-1']), ids2.join(', '));
    await p.close();
  });

  /* ── 2. il ripristino con l'account ─────────────────────────────────── */
  await prova('2', async () => {
    semina();
    const gruppoPrima = nelCloud('cid-1');
    const backup = vuoto({ trips: [
      viaggio(1001, 'Lisbona di agosto', PERSONE, { cid: 'cid-1', _owner: true, expenses: [] }),
      viaggio(1002, 'Porto di agosto', [PERSONE[0]], { cid: 'cid-2', _owner: true, destination: 'Porto' })], currentTripId: 1001 });
    const p = await apri(browser, { utente: ANNA });
    await pronto(p);
    await p.evaluate(() => go('trips'));
    await p.setInputFiles('#trips input[onchange="importData(event)"]', { name: 'geppgo-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
    await aspetta(p, () => document.getElementById('mConfirm').classList.contains('active'), null, 4000);
    await p.click('#cfOk');
    await aspetta(p, () => /Backup ripristinato/.test(document.getElementById('bkStato').textContent), null, 10000);
    const nota = await p.evaluate(() => (document.querySelector('#bkAzioni .bk-nota') || {}).textContent || '');
    await aspetta(p, () => app.trips.every(t => !!t.cid) && !syncBusy && app.trips.every(t => allineato(t.cid, t)), null, 15000);
    const copiaCloud = nuvola.t.trips.find(t => /copia dal backup/.test((t.data || {}).name || ''));
    const membriCopia = copiaCloud ? nuvola.t.trip_members.filter(m => m.trip_id === copiaCloud.id).map(m => m.user_id) : [];
    const locali = await p.evaluate(() => app.trips.map(t => t.name).sort());
    ok('2. il viaggio condiviso torna come copia privata, e quello del gruppo nel cloud resta com\'era',
       JSON.stringify(contenuto(nelCloud('cid-1'))) === JSON.stringify(contenuto(gruppoPrima)) && !!copiaCloud && copiaCloud.owner === ANNA
       && JSON.stringify(membriCopia) === JSON.stringify([ANNA]) && copiaCloud.data.name === 'Lisbona di agosto (copia dal backup)',
       JSON.stringify({ gruppo: nelCloud('cid-1').name, copia: copiaCloud && copiaCloud.data.name, membriCopia }));
    ok('2. il viaggio solo suo torna com\'era, sul telefono e nel cloud', nelCloud('cid-2').name === 'Porto di agosto'
       && JSON.stringify(locali) === JSON.stringify(['Lisbona', 'Lisbona di agosto (copia dal backup)', 'Porto di agosto']),
       JSON.stringify({ cloud: nelCloud('cid-2').name, locali }));
    ok('2. e lo dice', /Un viaggio condiviso è tornato come copia privata/.test(nota), nota);
    await p.close();
  });

  /* ── 3. l'avviso a chi aveva gia' dei viaggi senza account ───────────── */
  await prova('3', async () => {
    const conViaggi = vuoto({ skipAuth: true, trips: [viaggio(2001, 'Roma', [PERSONE[0]])], currentTripId: 2001 });
    /* Com'era dopo la versione di prima: il conto partito, il foglio mai visto. */
    const p = await apri(browser, { stato: conViaggi, avvisi: true, extraLs: { geppgo2_avviso_account: String(Date.now() - GIORNO) } });
    const subito = await aspetta(p, () => document.getElementById('mSoloQui').classList.contains('active'), null, 9000);
    const segni = await p.evaluate(() => ({ vecchio: localStorage.getItem('geppgo2_avviso_account'), nuovo: +localStorage.getItem('geppgo2_avviso_account2') }));
    await p.evaluate(() => closeSheet('mSoloQui'));
    await p.reload({ waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof window.renderAll === 'function' && !document.getElementById('bootSplash'), null, { timeout: 30000 });
    await p.waitForTimeout(4500);
    const dinuovo = await p.evaluate(() => document.getElementById('mSoloQui').classList.contains('active'));
    await p.evaluate(g => localStorage.setItem('geppgo2_avviso_account2', String(Date.now() - 8 * g)), GIORNO);
    await p.reload({ waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof window.renderAll === 'function' && !document.getElementById('bootSplash'), null, { timeout: 30000 });
    const settimana = await aspetta(p, () => document.getElementById('mSoloQui').classList.contains('active'), null, 9000);
    ok('3. chi ha già viaggi senza account vede l\'avviso alla prima apertura dopo l\'aggiornamento',
       subito && segni.vecchio === null && Date.now() - segni.nuovo < 60000, JSON.stringify({ subito, segni }));
    ok('3. poi non prima di una settimana', !dinuovo && settimana, JSON.stringify({ dinuovo, settimana }));
    await p.close();
  });

  /* ── 4. la valigia, da un telefono all'altro ─────────────────────────── */
  await prova('4', async () => {
    semina();
    const a = await apri(browser, { utente: ANNA }), b = await apri(browser, { utente: ANNA }), c = await apri(browser, { utente: BRUNO });
    await pronto(a); await pronto(b); await pronto(c, 1);
    await a.evaluate(() => {
      const t = app.trips.find(x => x.cid === 'cid-1');
      savePacking(t, getPacking(t).concat([{ id: 9001, cat: 'Documenti', label: 'Passaporto', checked: false, custom: true },
        { id: 9002, cat: 'Elettronica', label: 'Caricabatterie', checked: true, custom: true }]));
    });
    const arrivata = await aspetta(a, () => true, null, 100) && await new Promise(res => {
      const t0 = Date.now(); const giro = () => { const riga = nuvola.t.dati_personali.find(x => x.user_id === ANNA && x.chiave === 'valigia:cid-1'); if (riga && riga.dati.voci.length === 2) res(true); else if (Date.now() - t0 > 8000) res(false); else setTimeout(giro, 200); }; giro();
    });
    await b.evaluate(() => personaleSync());
    const suB = await b.evaluate(() => getPacking(app.trips.find(x => x.cid === 'cid-1')).map(x => x.label + (x.checked ? '✓' : '')).sort());
    await c.evaluate(() => personaleSync());
    const suC = await c.evaluate(() => getPacking(app.trips.find(x => x.cid === 'cid-1')).map(x => x.label));
    const righeViste = nuvola.esegui({ tab: 'dati_personali', op: 'select', filtri: [], utente: BRUNO }).data.filter(x => x.user_id === ANNA).length;
    ok('4. il telefono A aggiunge voci alla valigia, il telefono B con lo stesso account le vede',
       arrivata && JSON.stringify(suB) === JSON.stringify(['Caricabatterie✓', 'Passaporto']), JSON.stringify(suB));
    ok('4. un compagno con un altro account no', suC.length === 0 && righeViste === 0, JSON.stringify({ suC, righeViste }));
    /* Una voce tolta su A sparisce anche da B, e non torna. */
    await a.evaluate(() => { const t = app.trips.find(x => x.cid === 'cid-1'); savePacking(t, getPacking(t).filter(x => x.label !== 'Caricabatterie')); return personaleSync(); });
    await b.evaluate(() => personaleSync());
    const dopo = await b.evaluate(() => getPacking(app.trips.find(x => x.cid === 'cid-1')).map(x => x.label));
    ok('4. e una voce tolta su A sparisce anche da B', JSON.stringify(dopo) === JSON.stringify(['Passaporto']), JSON.stringify(dopo));
    /* Chi aveva gia' due telefoni: su ognuno la valigia fatta dai suggerimenti
       dell'app, con id diversi. Dopo la prima sincronizzazione la valigia e'
       una sola, senza doppioni, e la spunta fatta su A resta anche se B i suoi
       suggerimenti li ha fatti dopo: non sono una scelta di nessuno. */
    await senzaRete(a, true); await senzaRete(b, true);
    const etichetta = await a.evaluate(() => {
      const t = app.trips.find(x => x.cid === 'cid-2'); app.currentTripId = t.id;
      openPacking(); closeSheet('mPacking');
      const l = getPacking(t); l[0].checked = true; savePacking(t, l);
      return l[0].label;
    });
    await b.waitForTimeout(30);
    await b.evaluate(() => { const t = app.trips.find(x => x.cid === 'cid-2'); app.currentTripId = t.id; openPacking(); closeSheet('mPacking'); });
    await senzaRete(a, false); await senzaRete(b, false);
    await personale(a); await personale(b); await personale(a);
    const due = await Promise.all([a, b].map(p => p.evaluate(e => {
      const l = getPacking(app.trips.find(x => x.cid === 'cid-2')), n = l.map(x => x.label.toLowerCase());
      return { voci: l.length, doppie: n.length - new Set(n).size, spuntata: !!(l.find(x => x.label === e) || {}).checked, ids: l.map(x => x.id).sort().join(',') };
    }, etichetta)));
    const porto = ((nuvola.t.dati_personali.find(x => x.user_id === ANNA && x.chiave === 'valigia:cid-2') || {}).dati || { voci: [] }).voci;
    ok('4. chi aveva già la valigia su due telefoni ne ritrova una sola, senza doppioni, con la spunta fatta su A',
       due.every(x => x.doppie === 0 && x.spuntata && x.voci > 5) && due[0].ids === due[1].ids && porto.length === due[0].voci,
       JSON.stringify({ a: Object.assign({}, due[0], { ids: undefined }), b: Object.assign({}, due[1], { ids: undefined }), stessa: due[0].ids === due[1].ids, nelCloud: porto.length }));
    await a.close(); await b.close(); await c.close();
  });

  /* ── 5. le impostazioni ──────────────────────────────────────────────── */
  await prova('5', async () => {
    semina();
    const a = await apri(browser, { utente: ANNA }), b = await apri(browser, { utente: ANNA });
    await pronto(a); await pronto(b);
    await a.evaluate(() => {
      app.settings.nav = 'google'; app.settings.fotoQualita = 'media'; app.settings.dark = true; app.myName = 'Anna Bianchi';
      app.settings.lingua = 'en'; app.settings.ttFab = { x: 12, y: 34 };
      save(); return personaleSync();
    });
    const riga = (nuvola.t.dati_personali.find(x => x.user_id === ANNA && x.chiave === 'impostazioni') || {}).dati || { v: {} };
    await b.evaluate(() => personaleSync());
    const suB = await b.evaluate(() => ({ nav: app.settings.nav, foto: app.settings.fotoQualita, scuro: document.body.classList.contains('dark'), nome: app.myName,
      lingua: app.settings.lingua || null, tasto: app.settings.ttFab || null, tendina: document.getElementById('navPref').value }));
    ok('5. le impostazioni scelte passano da un telefono all\'altro (navigatore, qualità delle foto, tema, nome)',
       suB.nav === 'google' && suB.foto === 'media' && suB.scuro && suB.nome === 'Anna Bianchi' && suB.tendina === 'google', JSON.stringify(suB));
    ok('5. quelle legate al telefono no (lingua, posizione del tasto +), e non vanno nemmeno nel cloud',
       suB.lingua === null && suB.tasto === null && !('lingua' in riga.v) && !('ttFab' in riga.v), JSON.stringify({ suB: { lingua: suB.lingua, tasto: suB.tasto }, nelCloud: Object.keys(riga.v) }));
    /* Un terzo telefono che le impostazioni non le ha ancora prese (il cloud
       non rispondeva all'apertura) apre il navigatore una volta sola, senza
       «Ricordati la scelta»: non e' una scelta, e non deve passare sopra a
       quella fatta su A quando il cloud torna. */
    nuvola.assente = true;
    const d = await apri(browser, { utente: ANNA });
    await pronto(d);
    await aspetta(d, () => personaleAssente === true);
    nuvola.assente = false;
    const alVolo = await d.evaluate(async () => {
      apriFuori = () => {};
      const prima = app.settings.nav === undefined ? null : app.settings.nav;
      navGo('apple', 38.69, -9.21, 'Belém', 'walk');
      save();
      personaleAssente = false; await personaleSync();
      return { prima, dopo: app.settings.nav };
    });
    const navNelCloud = ((nuvola.t.dati_personali.find(x => x.user_id === ANNA && x.chiave === 'impostazioni') || {}).dati || { v: {} }).v.nav;
    ok('5. e una navigazione al volo su un altro telefono non passa sopra alla scelta fatta',
       alVolo.prima === null && alVolo.dopo === 'google' && navNelCloud === 'google', JSON.stringify({ alVolo, navNelCloud }));
    await a.close(); await b.close(); await d.close();
    /* Un telefono appena installato ha i valori di serie, senza ora: se arriva
       per primo nel cloud non deve passare sopra al raggio degli avvisi scelto
       prima dell'aggiornamento sull'altro telefono, che l'ora non ce l'ha. */
    semina();
    const nuovo = await apri(browser, { utente: ANNA });
    await pronto(nuovo); await personale(nuovo);
    const vecchio = await apri(browser, { utente: ANNA, stato: vuoto({ settings: { proxRadius: 500 } }) });
    await pronto(vecchio); await personale(vecchio); await personale(nuovo);
    const raggi = { vecchio: await vecchio.evaluate(() => app.settings.proxRadius), nuovo: await nuovo.evaluate(() => app.settings.proxRadius),
      cloud: (((nuvola.t.dati_personali.find(x => x.user_id === ANNA && x.chiave === 'impostazioni') || {}).dati || {}).v || {}).proxRadius };
    ok('5. un telefono appena installato non manda i valori di serie: il raggio scelto prima su un altro telefono resta',
       raggi.vecchio === 500 && raggi.nuovo === 500 && raggi.cloud === 500, JSON.stringify(raggi));
    await nuovo.close(); await vecchio.close();
  });

  /* ── 6. la tabella che non c'e' ──────────────────────────────────────── */
  await prova('6', async () => {
    semina();
    nuvola.assente = true;
    const p = await apri(browser, { utente: ANNA });
    await pronto(p);
    await p.waitForTimeout(500);
    const primeChiamate = nuvola.chiamate.filter(x => x.tab === 'dati_personali').length;
    await p.evaluate(() => {
      const t = app.trips.find(x => x.cid === 'cid-1');
      savePacking(t, [{ id: 9101, cat: 'Extra', label: 'Ombrello', checked: false, custom: true }]);
      app.settings.nav = 'apple'; save();
    });
    await p.waitForTimeout(2500);
    const dopo = await p.evaluate(() => ({ valigia: getPacking(app.trips.find(x => x.cid === 'cid-1')).map(x => x.label), nav: app.settings.nav,
      assente: personaleAssente, toast: (document.querySelector('.toast') || {}).textContent || '',
      schermo: document.body.innerText }));
    const chiamate = nuvola.chiamate.filter(x => x.tab === 'dati_personali').length;
    ok('6. senza la tabella nel cloud valigia e impostazioni restano sul telefono, e funzionano',
       JSON.stringify(dopo.valigia) === JSON.stringify(['Ombrello']) && dopo.nav === 'apple' && dopo.assente, JSON.stringify({ valigia: dopo.valigia, nav: dopo.nav }));
    ok('6. senza errori a schermo, e senza riprovare a ogni modifica', primeChiamate === 1 && chiamate === 1
       && !/dati_personali|schema cache|PGRST|tabella|errore/i.test(dopo.toast + ' ' + dopo.schermo), JSON.stringify({ primeChiamate, chiamate, toast: dopo.toast }));
    nuvola.assente = false;
    await p.close();
  });

  /* ── 7. il database ──────────────────────────────────────────────────── */
  await prova('7', async () => {
    const dir = path.join(RADICE, 'test');
    const pg = spawnSync('psql', ['-d', 'postgres', '-tAc', 'select 1'], { encoding: 'utf8' });
    if (pg.status !== 0) {
      ok('7. il database: B non legge né scrive le righe di A', !process.env.PROVE_TUTTE, 'saltata: Postgres non risponde' + (process.env.PROVE_TUTTE ? ' (e qui non si può saltare)' : ''));
      return;
    }
    /* Un database tutto suo, che alla fine se ne va: le altre prove sul
       database non devono trovare niente di questa. */
    const db = 'geppgo_prova_personale_' + process.pid;
    const sql = (args, base = db) => spawnSync('psql', ['-d', base, '-v', 'ON_ERROR_STOP=1', '-q'].concat(args), { encoding: 'utf8' });
    sql(['-c', `drop database if exists ${db}`], 'postgres');
    const crea = sql(['-c', `create database ${db}`], 'postgres');
    try {
      if (crea.status !== 0) throw new Error('non riesco a creare il database: ' + (crea.stderr || '').trim().split('\n')[0]);
      /* Il database di adesso, senza la tabella nuova; poi la migrazione, due
         volte - che e' quello che fara' chi la lancia a mano. */
      const schema = fs.readFileSync(path.join(RADICE, 'supabase-schema.sql'), 'utf8');
      const taglio = schema.indexOf('--  LA VALIGIA E LE IMPOSTAZIONI, PRIVATE');
      const prima = path.join(os.tmpdir(), 'geppgo-schema-prima-' + process.pid + '.sql');
      fs.writeFileSync(prima, schema.slice(0, schema.lastIndexOf('\n-- ═', taglio)));
      const passi = [['-f', path.join(dir, 'supabase-ambiente-finto.sql')], ['-c', 'grant usage on schema public to anon, authenticated;'], ['-f', prima],
        ['-f', path.join(RADICE, 'supabase', 'migrazioni', '2026-10-12-valigia-e-impostazioni.sql')],
        ['-f', path.join(RADICE, 'supabase', 'migrazioni', '2026-10-12-valigia-e-impostazioni.sql')]];
      for (const ps of passi) { const x = sql(ps); if (x.status !== 0) throw new Error('si ferma su ' + ps[ps.length - 1] + ': ' + (x.stderr || '').trim().split('\n').filter(l => !/NOTICE/.test(l))[0]); }
      fs.unlinkSync(prima);
      const res = spawnSync('psql', ['-d', db, '-q', '-f', path.join(dir, 'supabase-prova-personale.sql')], { encoding: 'utf8' });
      const uscita = (res.stdout || '') + (res.stderr || '');
      const m = /(\d+)\/(\d+) passati/.exec(uscita);
      const falliti = uscita.split('\n').filter(l => l.includes('FALLITO'));
      ok('7. il database: B non legge né scrive le righe di A (la migrazione lanciata due volte sopra lo schema di adesso)',
         !!m && m[1] === m[2] && !falliti.length, m ? m[0] : uscita.trim().split('\n').slice(-3).join(' | '));
      /* E la migrazione e' lo stesso testo che sta in fondo allo schema. */
      const mig = fs.readFileSync(path.join(RADICE, 'supabase', 'migrazioni', '2026-10-12-valigia-e-impostazioni.sql'), 'utf8');
      const sezione = mig.slice(mig.indexOf('-- ═', mig.indexOf('LA VALIGIA E LE IMPOSTAZIONI, PRIVATE') - 200));
      ok('7. e la migrazione è lo stesso testo che sta in fondo allo schema', schema.includes(sezione.trim()), sezione.length + ' caratteri');
    } finally {
      sql(['-c', `drop database if exists ${db}`], 'postgres');
    }
  });

  /* ── 8. compagni aggiunti senza rete, e uno tolto ────────────────────── */
  await prova('8', async () => {
    semina();
    const a = await apri(browser, { utente: ANNA }), b = await apri(browser, { utente: BRUNO });
    await pronto(a); await pronto(b, 1);
    await senzaRete(a, true); await senzaRete(b, true);
    await a.evaluate(() => { const t = app.trips.find(x => x.cid === 'cid-1'); t.participants.push({ id: 3001, name: 'Carla', isMe: false }); save(); });
    await b.evaluate(() => { const t = app.trips.find(x => x.cid === 'cid-1'); t.participants.push({ id: 4001, name: 'Dario', isMe: false }); save(); });
    await a.waitForTimeout(1200);
    await senzaRete(a, false); await sincronizza(a);
    await senzaRete(b, false); await sincronizza(b);
    await aspetta(a, () => (app.trips.find(x => x.cid === 'cid-1').participants || []).length === 4, null, 6000);
    const tutti = { cloud: nomi(nelCloud('cid-1')), a: nomi(await viaggioDi(a, 'cid-1')), b: nomi(await viaggioDi(b, 'cid-1')) };
    ok('8. due telefoni senza rete aggiungono compagni diversi: dopo la sincronizzazione ci sono tutti e due',
       tutti.cloud === 'Anna,Bruno,Carla,Dario' && tutti.a === tutti.cloud && tutti.b === tutti.cloud, JSON.stringify(tutti));
    /* A toglie Dario; B, senza rete, intanto cambia altro. */
    await senzaRete(b, true);
    await a.evaluate(() => { const t = app.trips.find(x => x.cid === 'cid-1'); app.currentTripId = t.id; removeParticipant(4001); });
    await aspetta(a, () => document.getElementById('mConfirm').classList.contains('active'), null, 3000);
    await a.click('#cfOk');
    await a.waitForTimeout(300);
    await sincronizza(a);
    await b.evaluate(() => { const t = app.trips.find(x => x.cid === 'cid-1'); t.days[0].title = 'Belém'; save(); });
    await b.waitForTimeout(1200);
    await senzaRete(b, false); await sincronizza(b);
    await a.waitForTimeout(600);
    const dopo = { cloud: nomi(nelCloud('cid-1')), a: nomi(await viaggioDi(a, 'cid-1')), b: nomi(await viaggioDi(b, 'cid-1')), titolo: nelCloud('cid-1').days[0].title };
    ok('8. un compagno tolto su un telefono non ricompare (e la modifica dell\'altro resta)',
       dopo.cloud === 'Anna,Bruno,Carla' && dopo.a === dopo.cloud && dopo.b === dopo.cloud && dopo.titolo === 'Belém', JSON.stringify(dopo));
    await a.close(); await b.close();
  });

  /* ── 9. il nome su A, le date su B ───────────────────────────────────── */
  await prova('9', async () => {
    semina();
    const a = await apri(browser, { utente: ANNA }), b = await apri(browser, { utente: BRUNO });
    await pronto(a); await pronto(b, 1);
    await senzaRete(a, true); await senzaRete(b, true);
    await a.evaluate(() => { const t = app.trips.find(x => x.cid === 'cid-1'); t.name = 'Lisbona e Sintra'; save(); });
    await b.evaluate(() => { const t = app.trips.find(x => x.cid === 'cid-1'); t.start = '2026-11-02'; t.end = '2026-11-06'; save(); });
    await a.waitForTimeout(1200);
    await senzaRete(a, false); await sincronizza(a);
    await senzaRete(b, false); await sincronizza(b);
    await aspetta(a, () => app.trips.find(x => x.cid === 'cid-1').start === '2026-11-02', null, 6000);
    const v = t => t ? { nome: t.name, dal: t.start, al: t.end } : null;
    const tutti = { cloud: v(nelCloud('cid-1')), a: v(await viaggioDi(a, 'cid-1')), b: v(await viaggioDi(b, 'cid-1')) };
    const giusto = x => x && x.nome === 'Lisbona e Sintra' && x.dal === '2026-11-02' && x.al === '2026-11-06';
    ok('9. nome cambiato su A e date cambiate su B: restano tutte e due le modifiche', giusto(tutti.cloud) && giusto(tutti.a) && giusto(tutti.b), JSON.stringify(tutti));
    await a.close(); await b.close();
  });

  /* ── 10. un viaggio del formato di prima ─────────────────────────────── */
  await prova('10', async () => {
    semina();
    const a = await apri(browser, { utente: ANNA });
    await pronto(a);
    const primaSenzaOre = !('_ct' in nelCloud('cid-1'));
    await senzaRete(a, true);
    await a.evaluate(() => {
      const t = app.trips.find(x => x.cid === 'cid-1');
      t.name = 'Lisbona 2026';
      t.days[1].activities.push({ id: 502, name: 'Alfama', time: '15:00', timeEnd: '16:00', type: 'any', who: [], completed: false, booking: { needed: false, done: false } });
      save();
    });
    /* Intanto il telefono di Bruno, con l'app di prima, scrive nel cloud un
       viaggio senza ore dei campi: cambia la destinazione e aggiunge una spesa. */
    const riga = nuvola.t.trips.find(t => t.id === 'cid-1');
    riga.data.destination = 'Lisbona e dintorni';
    riga.data.expenses.push({ id: 702, desc: 'Tram 28', category: 'Trasporti', amount: 6, origAmount: 6, origCurrency: 'EUR', payerId: 2, splitAmong: [1, 2], date: '2026-11-04', type: 'expense' });
    riga.updated_by = BRUNO;
    await a.waitForTimeout(1000);
    await senzaRete(a, false); await sincronizza(a);
    const d = nelCloud('cid-1'), l = await viaggioDi(a, 'cid-1');
    const esito = x => ({ nome: x.name, dest: x.destination, spese: x.expenses.map(e => e.id).sort().join(','), tappe: x.days.reduce((n, g) => n + g.activities.length, 0) });
    const giusto = x => x.nome === 'Lisbona 2026' && x.dest === 'Lisbona e dintorni' && x.spese === '701,702' && x.tappe === 2;
    ok('10. un viaggio del formato di prima si unisce senza perdere niente (il nome di qui, la destinazione e la spesa di là, la tappa nuova)',
       primaSenzaOre && giusto(esito(d)) && giusto(esito(l)), JSON.stringify({ cloud: esito(d), telefono: esito(l) }));
    /* Adesso il viaggio ha le ore dei campi, e il telefono di Bruno, ancora
       con l'app di prima, cambia il nome: le ore non le scrive, ma quelle che
       c'erano se le porta dietro. Il nome nuovo deve arrivare, e restare. */
    const oraNome = (nelCloud('cid-1')._ct || {}).name;
    const riga2 = nuvola.t.trips.find(t => t.id === 'cid-1');
    riga2.data.name = 'Lisbona con Bruno';
    riga2.updated_by = BRUNO;
    /* E sul telefono di Anna c'e' ancora la valigia di una volta, dentro il
       viaggio, mai aperta da quando le valigie stanno a parte. */
    await a.evaluate(() => { app.trips.find(x => x.cid === 'cid-1').packing = [{ id: 77, cat: 'Extra', label: 'Ombrello di una volta', checked: false }]; });
    await a.evaluate(() => pullCloud());
    await sincronizza(a);
    const nome2 = { cloud: nelCloud('cid-1').name, telefono: (await viaggioDi(a, 'cid-1')).name };
    ok('10. e il nome cambiato da un telefono con l\'app di prima, con le ore vecchie dentro, non torna indietro',
       !!oraNome && nome2.cloud === 'Lisbona con Bruno' && nome2.telefono === 'Lisbona con Bruno', JSON.stringify(Object.assign({ conOre: !!oraNome }, nome2)));
    const unaVolta = await a.evaluate(() => getPacking(app.trips.find(x => x.cid === 'cid-1')).map(x => x.label));
    ok('10. e la valigia di una volta, rimasta dentro il viaggio, non si perde unendo', unaVolta.includes('Ombrello di una volta') && !('packing' in nelCloud('cid-1')), JSON.stringify(unaVolta));
    await a.close();
  });

  /* ── 11. le cinque lingue, e lo schermo ──────────────────────────────── */
  await prova('11', async () => {
    const frasi = ['{1} (copia dal backup)', 'Un viaggio condiviso è tornato come copia privata: quello del gruppo resta com\'è.',
      '{1} viaggi condivisi sono tornati come copie private: quelli del gruppo restano come sono.'];
    let p = await apri(browser, { stato: vuoto({ skipAuth: true }) });
    const buchi = await p.evaluate(f => {
      const out = [];
      ['en', 'es', 'fr', 'pt'].forEach(l => f.forEach(k => {
        const v = DIZIONARIO[l][k];
        if (!v || v === k) out.push(l + ': ' + k);
        else if ((k.match(/\{\d\}/g) || []).join() !== (v.match(/\{\d\}/g) || []).join()) out.push(l + ' segnaposto: ' + k);
      }));
      return out;
    }, frasi);
    await p.close();
    ok('11. i testi nuovi ci sono in inglese, spagnolo, francese e portoghese', !buchi.length, buchi.slice(0, 3).join(' | ') || frasi.length + ' frasi × 4 lingue');
    const viste = [], fuori = [];
    for (const l of ['en', 'es', 'fr', 'pt']) for (const larghezza of [320, 430]) {
      p = await apri(browser, { stato: vuoto({ skipAuth: true }), lingua: l, larghezza, altezza: 700 });
      const g = await p.evaluate(W => {
        bkApri(tv('Ripristino'));
        bkStato(tv('Backup ripristinato. Viaggi: {1} · foto: {2}.', 3, 12), 1);
        bkAzioni(`<p class="bk-nota">${esc(tv('{1} viaggi condivisi sono tornati come copie private: quelli del gruppo restano come sono.', 2))}</p>` + bkChiudiHtml());
        const m = document.getElementById('mBackup'); m.classList.add('in-scena', 'active');
        const testo = document.querySelector('#mBackup .bk-nota').textContent;
        const out = [];
        m.querySelectorAll('.sheet *').forEach(el => { const b = el.getBoundingClientRect(); if (b.width && (b.right > W + 1 || b.left < -1)) out.push(el.className || el.tagName); });
        if (document.documentElement.scrollWidth > W) out.push('la pagina scorre di lato');
        return { testo, copia: tv('{1} (copia dal backup)', 'Lisbona'), out };
      }, larghezza);
      if (larghezza === 320) viste.push(l + ': ' + g.copia + ' / ' + g.testo.slice(0, 40));
      if (/viaggi condivisi|copia dal backup/.test(g.testo + g.copia)) viste.push(l + ' ← non tradotto');
      g.out.forEach(x => fuori.push(`${l} ${larghezza}: ${x}`));
      await p.close();
    }
    ok('11. la nota del ripristino e il nome della copia si leggono in ogni lingua', !viste.some(v => /non tradotto/.test(v)), viste.join(' | '));
    ok('11. e da 320 a 430 px niente esce dallo schermo', !fuori.length, fuori.slice(0, 3).join(' | ') || '4 lingue × 2 larghezze');
  });

  ok('nessun errore in pagina', !errori.length, errori.slice(0, 3).join(' | '));
  console.log('\n' + r.join('\n'));
  const falliti = r.filter(x => x.includes('FALLITO')).length;
  console.log(`\n${r.length - falliti}/${r.length} passati`);
  await browser.close();
  process.exit(falliti ? 1 : 0);
})();
