/* BUDGET CON TETTO E MAPPA DI TUTTO IL VIAGGIO (miglioria 13a).

   1. un admin fissa il tetto del gruppo e lo vedono tutti; un compagno non
      admin non lo cambia: il foglio non glielo lascia fare, e se ci prova lo
      stesso (il viaggio mandato coi tetti cambiati) il cloud li rimette
      com'erano e il suo telefono torna a quelli giusti;
   2. il tetto personale e' privato: va nella tabella dati_personali, mai nel
      viaggio, e un compagno non lo vede; l'altro telefono dello stesso
      account invece lo riceve;
   3. i conti: speso, quanto resta, percentuale, quota al giorno; le previste
      a parte; quelle in attesa di cambio fuori, con la riga che lo dice;
   4. gli avvisi all'80% e al 100%, una volta sola per soglia, per il gruppo,
      per la persona e per la categoria; con un tetto nuovo si riarmano; col
      permesso arrivano anche come notifica, senza solo nell'app; il tocco
      porta al Budget;
   5. la scheda in Home compare solo oltre l'80%, e porta al Budget;
   6. due telefoni senza rete: il tetto cambiato su uno arriva sull'altro, e
      le modifiche dell'altro (il nome, una spesa, un altro tetto) restano;
   7. la mappa del viaggio: tutte le tappe coi colori e i numeri giusti, le
      linee giorno per giorno, l'albergo; il filtro per giorno; la scheda del
      segnaposto apre la tappa giusta;
   8. con 200 tappe la mappa si apre e si muove senza blocchi;
   9. la mappa si raggiunge in al massimo 2 tocchi con una voce scritta, dalla
      Home e dal Programma; dalla scheda del viaggio (anche i tetti, che
      sono un'impostazione) fino a 3, come vuole la regola per le azioni
      rare; l'elenco per VoiceOver contiene tutte le tappe;
   10. i testi nuovi in cinque lingue; niente fuori schermo da 320 a 430 px nei
       due temi; nessuna violazione grave di axe.

   Il cloud e' finto (Nuvola, come in prova-cloud-personale) e ha la stessa
   regola del database sui tetti; le regole vere le prova Postgres
   (test/supabase-prova-tetti.sql).

   `node test/prova-budget-mappa.js 3 7` fa solo le prove 3 e 7. */
const fs = require('fs');
const path = require('path');
const { apriBrowser, APP, leafletJs, leafletCss, RADICE } = require('./browser');
const { apriPagina, giornoA, iso } = require('./schermate');

const r = [];
const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);
const errori = [];
const SCELTE = process.argv.slice(2).filter(a => /^\d+$/.test(a));
const fai = n => !SCELTE.length || SCELTE.includes(String(n));
const LINGUE = ['it', 'en', 'es', 'fr', 'pt'];
const AXE = require.resolve('axe-core/axe.min.js');
const prova = async (nome, fn) => { try { await fn(); } catch (e) { ok(nome, false, 'si è fermata: ' + e.message.split('\n')[0]); } };
const aspetta = (p, fn, arg, ms = 8000) => p.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
const D = [0, 1, 2, 3, 4].map(i => iso(giornoA(i)));

/* ── il cloud finto ───────────────────────────────────────────────────────── */
const ANNA = 'u-anna', BRUNO = 'u-bruno';
const copia = x => x == null ? x : JSON.parse(JSON.stringify(x));
const CHIAVE_TETTO = k => k === 'tetto' || /^tettoCat_/.test(k);
class Nuvola {
  constructor() { this.pagine = new Map(); this.azzera(); }
  azzera() { this.t = { trips: [], trip_members: [], foto: [], raccolte: [], dati_personali: [] }; this.chiamate = []; this.n = 0; }
  membro(u, trip) { return this.t.trip_members.some(m => m.trip_id === trip && m.user_id === u); }
  admin(u, trip) { return this.t.trip_members.some(m => m.trip_id === trip && m.user_id === u && m.ruolo === 'admin'); }
  vede(tab, u, x) {
    if (tab === 'trips') return x.owner === u || this.membro(u, x.id);
    if (tab === 'trip_members') return x.user_id === u || this.membro(u, x.trip_id);
    if (tab === 'dati_personali') return x.user_id === u;
    return true;
  }
  /* Come lo schema: la chiave del tetto e' 'tetto:<id del viaggio>'. */
  scrive(tab, u, x) {
    if (tab === 'trips') return x.owner === u || this.membro(u, x.id);
    if (tab === 'trip_members') return x.user_id === u;
    if (tab === 'dati_personali') return x.user_id === u && (!x.trip_id || this.membro(u, x.trip_id))
      && (x.chiave === 'impostazioni' ? !x.trip_id : (x.chiave === 'valigia:' + x.trip_id || x.chiave === 'tetto:' + x.trip_id));
    return true;
  }
  esegui(q, page) {
    const u = q.utente;
    if (page) this.pagine.set(page, u);
    this.chiamate.push({ tab: q.tab, op: q.op, utente: u, riga: q.riga ? copia(q.riga) : null, patch: q.patch ? copia(q.patch) : null });
    const rifiuto = m => ({ data: null, error: { message: m } });
    if (q.tab === '__rpc') return { data: null, error: null };
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
        if (gia) { Object.assign(gia, x); toccate.push(gia); } else { T.push(x); toccate.push(x); }
      }
      this.avvisa(q.tab, 'INSERT', toccate);
      return { data: q.single ? copia(toccate[0]) : copia(toccate), error: null };
    }
    if (q.op === 'update') {
      const d = T.filter(x => this.vede(q.tab, u, x) && passa(x));
      for (const x of d) if (!this.scrive(q.tab, u, Object.assign({}, x, q.patch))) return rifiuto('rls');
      d.forEach(x => {
        const patch = copia(q.patch);
        /* Il guardiano dei tetti (trips_tetti_custoditi): chi non e' admin
           non li cambia, e il resto del suo aggiornamento passa. */
        if (q.tab === 'trips' && patch.data && !(x.owner === u || this.admin(u, x.id))) {
          const prima = x.data || {}, ctPrima = prima._ct || {}, ctDopo = Object.assign({}, patch.data._ct);
          new Set(Object.keys(prima).concat(Object.keys(patch.data), Object.keys(ctPrima), Object.keys(ctDopo))).forEach(k => {
            if (!CHIAVE_TETTO(k)) return;
            if (k in prima) patch.data[k] = prima[k]; else delete patch.data[k];
            if (k in ctPrima) ctDopo[k] = ctPrima[k]; else delete ctDopo[k];
          });
          if (patch.data._ct || Object.keys(ctDopo).length) patch.data._ct = ctDopo;
        }
        Object.assign(x, patch);
      });
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
/* Il finto supabase-js, come in prova-cloud-personale. */
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
  const auth={
    onAuthStateChange(cb){ascolta=cb;return{data:{subscription:{unsubscribe(){}}}};},
    async getSession(){return{data:{session:sessione},error:null};},
    async getUser(){return{data:{user:sessione&&sessione.user},error:null};},
    async signOut(){sessione=null;setTimeout(()=>ascolta&&ascolta('SIGNED_OUT',null),0);return{error:null};},
    async setSession(){return{data:{},error:{message:'no'}};},async exchangeCodeForSession(){return{data:{},error:{message:'no'}};},
    async updateUser(){return{data:{},error:null};},async resetPasswordForEmail(){return{data:{},error:null};},async verifyOtp(){return{data:{},error:{message:'no'}};}
  };
  const storage={from:()=>({async upload(){return{data:null,error:{message:'no'}};},async remove(){return{data:null,error:null};},async createSignedUrl(){return{data:null,error:{message:'no'}};},async list(){return{data:[],error:null};}})};
  const canali=new Set();
  window.__rt=(t,p)=>{if(window.__offline)return;canali.forEach(c=>(c.cb[t]||[]).forEach(f=>{try{f(p);}catch(e){}}));};
  const canale=()=>{const c={cb:{},on(ev,f,cb){const t=f&&f.table;(c.cb[t]=c.cb[t]||[]).push(cb);return c;},subscribe(cb){canali.add(c);if(typeof cb==='function')setTimeout(()=>cb('SUBSCRIBED'),0);return c;},unsubscribe(){canali.delete(c);return Promise.resolve();},send(){return Promise.resolve('ok');}};return c;};
  const client={auth,storage,from:query,channel:canale,
    removeChannel(c){canali.delete(c);return Promise.resolve();},removeAllChannels(){canali.clear();return Promise.resolve();},
    rpc(n,a){return chiama({tab:'__rpc',op:n,arg:a,filtri:[]});},functions:{invoke:async()=>({data:null,error:{message:'no'}})}};
  window.supabase={createClient:()=>client};
})();`;

/* Lisbona, nel cloud: Anna admin, Bruno compagno. Cinque giorni da oggi. */
const PERSONE = [{ id: 1, name: 'Anna' }, { id: 2, name: 'Bruno' }];
const spesa = (id, amount, cat, among, extra = {}) => Object.assign({ id, desc: 'Spesa ' + id, category: cat, amount, origAmount: amount, origCurrency: 'EUR', rate: 1, payerId: 1, splitAmong: among, date: D[0], type: 'expense' }, extra);
const lisbona = (extra = {}) => Object.assign({
  id: 1001, name: 'Lisbona', destination: 'Lisbona', currency: 'EUR', status: 'open', start: D[0], end: D[4],
  participants: PERSONE, guests: [], suggested: [], pois: [], hotels: [], tickets: [], weather: {}, createdAt: 1,
  expenses: [spesa(701, 100, 'Cibo', [1, 2])],
  days: D.map((d, i) => ({ id: 'd' + i, date: d, title: '', activities: [] }))
}, extra);
function semina(dati) {
  nuvola.azzera();
  nuvola.t.trips.push({ id: 'cid-1', owner: ANNA, invite_code: 'inv-1', data: dati || lisbona(), updated_by: ANNA });
  nuvola.t.trip_members.push({ trip_id: 'cid-1', user_id: ANNA, participant_id: 1, ruolo: 'admin', member_name: 'Anna' });
  nuvola.t.trip_members.push({ trip_id: 'cid-1', user_id: BRUNO, participant_id: 2, ruolo: 'compagno', member_name: 'Bruno' });
}
const vuoto = () => ({ trips: [], currentTripId: null, settings: { proxRadius: 200 }, myName: 'Anna', skipAuth: false, consentNotif: false });
async function apriCloud(browser, utente, { larghezza = 390 } = {}) {
  const page = await browser.newPage({ viewport: { width: larghezza, height: 844 } });
  page.on('pageerror', e => errori.push('PAGEERROR(cloud): ' + e.message.split('\n')[0]));
  await page.exposeBinding('__nuvolaRpc', (src, q) => nuvola.esegui(q, src.page));
  await page.route('**/leaflet@1.9.4/dist/leaflet.js', ro => ro.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(leafletJs(), 'utf8') }));
  await page.route('**/leaflet@1.9.4/dist/leaflet.css', ro => ro.fulfill({ status: 200, contentType: 'text/css', body: fs.readFileSync(leafletCss(), 'utf8') }));
  await page.route(/tile\.openstreetmap\.org/, ro => ro.abort());
  await page.route('**/supabase-js@*/**', ro => ro.fulfill({ status: 200, contentType: 'application/javascript', body: SUPA_FINTO }));
  await page.addInitScript(([u, s]) => {
    window.__sessione = u ? { user: { id: u, email: u + '@x.it' }, access_token: 'x', refresh_token: 'y' } : null;
    window.__offline = false;
    if (sessionStorage.getItem('prova-tetti')) return;
    sessionStorage.setItem('prova-tetti', '1');
    localStorage.clear();
    localStorage.setItem('geppgo2', JSON.stringify(s));
    localStorage.setItem('geppgo2_intro', '1');
  }, [utente, vuoto()]);
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.renderAll === 'function' && !document.getElementById('bootSplash'), null, { timeout: 30000 });
  return page;
}
const pronto = p => aspetta(p, () => typeof app !== 'undefined' && app.trips.length >= 1 && !!session && !syncBusy && app.trips.every(t => !t.cid || allineato(t.cid, t)), null, 15000);
const viaggioDi = p => p.evaluate(() => JSON.parse(JSON.stringify(app.trips.find(t => t.cid === 'cid-1') || null)));
const nelCloud = () => copia((nuvola.t.trips.find(t => t.id === 'cid-1') || {}).data || null);
const senzaRete = (p, si) => p.evaluate(v => { window.__offline = v; }, si);
const sincronizza = p => p.evaluate(async () => { for (let i = 0; i < 50 && syncBusy; i++) await new Promise(r2 => setTimeout(r2, 100)); await syncPush(); for (let i = 0; i < 50 && syncBusy; i++) await new Promise(r2 => setTimeout(r2, 100)); });
const personale = p => p.evaluate(async () => {
  for (let i = 0; i < 80 && personaleBusy; i++) await new Promise(r2 => setTimeout(r2, 100));
  await personaleSync();
  for (let i = 0; i < 80 && personaleBusy; i++) await new Promise(r2 => setTimeout(r2, 100));
});
/* Il viaggio aperto nella pagina: quello del cloud. */
const scegliLisbona = p => p.evaluate(() => { const t = app.trips.find(x => x.cid === 'cid-1'); if (t) { app.currentTripId = t.id; save(); renderAll(); } });
/* Il foglio dei tetti, riempito come lo riempie un dito. */
async function compilaTetti(p, campi) {
  await p.evaluate(() => apriTetti());
  await p.waitForSelector('#mTetti.active', { timeout: 4000 });
  for (const [id, v] of Object.entries(campi)) await p.fill('#' + id, String(v));
  await p.click('#mTetti .btn-primario');
  await p.waitForTimeout(300);
}

/* ── un viaggio locale, per i conti e la mappa ────────────────────────────── */
const tappa = (id, name, time, lat, lng, extra = {}) => Object.assign({ id, name, time, timeEnd: '', lat, lng, who: [1], completed: false, type: 'any', booking: { needed: false, done: false }, notes: '' }, extra);
function viaggioLocale(extra = {}) {
  return Object.assign({
    id: 1, name: 'Kyoto', destination: 'Kyoto', currency: 'EUR', status: 'open', start: D[0], end: D[4],
    participants: [{ id: 1, name: 'Zelda', isMe: true }, { id: 2, name: 'Yuri' }], guests: [], suggestOn: false, suggested: [],
    pois: [], tickets: [], weather: {}, createdAt: 1,
    hotels: [{ id: 5, name: 'Ryokan Hoshi', lat: 35.0, lng: 135.76, address: 'Kyoto', checkIn: D[0], checkOut: D[2] }],
    expenses: [],
    days: [
      { id: 'd0', date: D[0], title: '', activities: [tappa(11, 'Fushimi Inari', '09:30', 34.967, 135.772), tappa(12, 'Nishiki', '12:00', 35.005, 135.765), tappa(13, 'Kiyomizu', '15:00', 35.003, 135.775)] },
      { id: 'd1', date: D[1], title: '', activities: [tappa(21, 'Todaiji', '10:00', 34.689, 135.84), tappa(22, 'Senza indirizzo', '16:00', null, null)] },
      { id: 'd2', date: D[2], title: '', activities: [] }, { id: 'd3', date: D[3], title: '', activities: [] }, { id: 'd4', date: D[4], title: '', activities: [] }]
  }, extra);
}
/* Le spese della prova dei conti: pagate 120 (Cibo, a metà) e 80 (Trasporti,
   solo Zelda); prevista 60 (Attrazioni, a metà); in attesa di cambio 5000 yen. */
const SPESE_CONTI = [
  { id: 801, desc: 'Cena', amount: 120, origAmount: 120, origCurrency: 'EUR', rate: 1, payerId: 1, category: 'Cibo', splitAmong: [1, 2], date: D[0], paid: true },
  { id: 802, desc: 'Treno', amount: 80, origAmount: 80, origCurrency: 'EUR', rate: 1, payerId: 1, category: 'Trasporti', splitAmong: [1], date: D[0], paid: true },
  { id: 803, desc: 'Museo', amount: 60, origAmount: 60, origCurrency: 'EUR', rate: 1, payerId: 2, category: 'Attrazioni', splitAmong: [1, 2], date: D[1], paid: false },
  { id: 804, desc: 'Ramen', amount: 0, origAmount: 5000, origCurrency: 'JPY', rate: null, cambioStato: 'attesa', payerId: 2, category: 'Cibo', splitAmong: [1, 2], date: D[0], paid: true }];
async function apriLocale(browser, opz = {}) {
  const page = await apriPagina(browser, Object.assign({ viaggi: [viaggioLocale(opz.extra || {})], errori, chiave: 'prova-tetti-' + Math.random() }, opz));
  await page.waitForFunction(() => typeof L !== 'undefined', null, { timeout: 15000 }).catch(() => {});
  return page;
}
/* Gli avvisi passano da avvisa(): li si conta, e la notifica del telefono si
   finge (registration.showNotification) quando il permesso c'e'. */
const SPIA_AVVISI = permesso => {
  window.__avvisi = []; window.__notifiche = [];
  const vera = avvisa;
  window.avvisa = o => { window.__avvisi.push({ tipo: o.tipo, titolo: o.titolo, testo: o.testo, dove: o.dove }); return vera(o); };
  window.notifichePermesse = () => permesso;
  window.registrazioneAvvisi = async () => ({ showNotification: async (t, o) => { window.__notifiche.push({ t, o }); } });
};

(async () => {
  const browser = await apriBrowser();

  // ── 1. il tetto del gruppo: lo fissa un admin, lo vedono tutti ────────────
  if (fai(1)) await prova('1. tetto del gruppo', async () => {
    semina();
    const anna = await apriCloud(browser, ANNA), bruno = await apriCloud(browser, BRUNO);
    await pronto(anna); await pronto(bruno);
    await scegliLisbona(anna); await scegliLisbona(bruno);
    const ruoli = { anna: await anna.evaluate(() => sonoAdmin(T())), bruno: await bruno.evaluate(() => sonoAdmin(T())) };
    ok('1. Anna e\' admin del viaggio, Bruno no', ruoli.anna === true && ruoli.bruno === false, JSON.stringify(ruoli));

    await compilaTetti(anna, { tetGruppo: '500' });
    await sincronizza(anna);
    const cloud = nelCloud();
    ok('1. l\'admin fissa il tetto del gruppo dal foglio, e va nel viaggio di tutti', cloud && cloud.tetto === 500, 'nel cloud: ' + (cloud && cloud.tetto));
    await sincronizza(bruno);
    const vistoDaBruno = await aspetta(bruno, () => T() && T().tetto === 500, null, 8000);
    await bruno.evaluate(() => { go('money'); moneyVista('budget'); });
    const testoBruno = await bruno.evaluate(() => { const v = document.querySelector('#tettiCard .tet-voce[data-tetto="gruppo"]'); return v ? v.textContent.replace(/\s+/g, ' ') : ''; });
    const atteso = await bruno.evaluate(() => fmtMoney(500, 'EUR').replace(/\s+/g, ' '));
    ok('1. e il compagno lo vede nel suo Budget', vistoDaBruno && testoBruno.includes(atteso), testoBruno.slice(0, 120));

    await bruno.evaluate(() => apriTetti());
    const foglio = await bruno.evaluate(() => ({ gruppo: document.getElementById('tetGruppo').disabled, cat: [...document.querySelectorAll('#tetBody [id^="tetCat_"]')].every(x => x.disabled), mio: document.getElementById('tetMio').disabled }));
    ok('1. al compagno il foglio non lascia cambiare i tetti del gruppo (il suo si)', foglio.gruppo && foglio.cat && !foglio.mio, JSON.stringify(foglio));
    // anche forzando il campo, il salvataggio non tocca il tetto del gruppo
    await bruno.evaluate(() => { const i = document.getElementById('tetGruppo'); i.disabled = false; i.value = '5'; salvaTetti(); });
    const dopoForzato = await bruno.evaluate(() => T().tetto);
    ok('1. e anche forzando il campo, il tetto del gruppo resta quello', dopoForzato === 500, String(dopoForzato));
    // e se il viaggio parte lo stesso coi tetti cambiati, il cloud li rimette
    await bruno.evaluate(() => { T().tetto = 1; T().name = 'Lisbona e Sintra'; save(); });
    await sincronizza(bruno);
    const cloud2 = nelCloud();
    ok('1. il viaggio mandato da un compagno coi tetti cambiati: il nome passa, il tetto no', cloud2.name === 'Lisbona e Sintra' && cloud2.tetto === 500, `nome ${cloud2.name}, tetto ${cloud2.tetto}`);
    await bruno.evaluate(async () => { await pullCloud(); });
    const torna = await aspetta(bruno, () => T() && T().tetto === 500, null, 8000);
    ok('1. e il telefono del compagno torna al tetto giusto', torna, String(await bruno.evaluate(() => T().tetto)));
    await anna.close(); await bruno.close();
  });

  // ── 2. il tetto personale: privato ─────────────────────────────────────────
  if (fai(2)) await prova('2. tetto personale', async () => {
    semina();
    const anna = await apriCloud(browser, ANNA), bruno = await apriCloud(browser, BRUNO);
    await pronto(anna); await pronto(bruno);
    await scegliLisbona(anna); await scegliLisbona(bruno);
    await compilaTetti(anna, { tetMio: '300' });
    await personale(anna); await sincronizza(anna);
    const riga = nuvola.t.dati_personali.find(x => x.user_id === ANNA && x.chiave === 'tetto:cid-1');
    ok('2. il tetto personale va nella tabella dati_personali, a nome di chi lo fissa', !!riga && riga.trip_id === 'cid-1' && riga.dati && riga.dati.v === 300, JSON.stringify(riga || null));
    const cloud = JSON.stringify(nelCloud());
    ok('2. e non sta nel viaggio che vedono tutti', !/tettiMiei|"tetto"\s*:\s*300|300/.test(cloud.replace(/"id":\d+/g, '')), cloud.length + ' caratteri');
    const vistoDaBruno = nuvola.esegui({ tab: 'dati_personali', op: 'select', filtri: [], utente: BRUNO }).data.filter(x => x.user_id === ANNA).length;
    await sincronizza(bruno); await personale(bruno);
    await bruno.evaluate(() => { go('money'); moneyVista('budget'); });
    const budgetBruno = await bruno.evaluate(() => ({ testo: document.getElementById('tettiCard').textContent, mio: tettoMio(T()) }));
    ok('2. un compagno non lo vede: ne\' nel cloud, ne\' nel suo Budget', vistoDaBruno === 0 && budgetBruno.mio === 0 && !/Il tuo tetto/.test(budgetBruno.testo), `righe di Anna viste da Bruno: ${vistoDaBruno}, tetto suo: ${budgetBruno.mio}`);
    // l'altro telefono di Anna lo riceve
    const anna2 = await apriCloud(browser, ANNA);
    await pronto(anna2); await scegliLisbona(anna2); await personale(anna2);
    const sul2 = await anna2.evaluate(() => tettoMio(T()));
    ok('2. l\'altro telefono dello stesso account invece lo riceve', sul2 === 300, String(sul2));
    // senza la tabella aggiornata il tetto resta sul telefono, senza errori
    const schema = fs.readFileSync(path.join(RADICE, 'supabase-schema.sql'), 'utf8');
    ok('2. lo schema accetta la chiave del tetto, e solo per un viaggio di cui si fa parte', /'tetto:'\s*\|\|\s*trip_id::text/.test(schema) && /pers_insert[\s\S]{0,300}is_trip_member\(trip_id\)/.test(schema));
    /* Le due migrazioni da lanciare a mano dicono quello che dice lo schema:
       quella del 19 (la tabella e il guardiano) e quella del 12, che lanciata
       dopo non deve rimettere il vincolo di prima. */
    const mig = n => fs.readFileSync(path.join(RADICE, 'supabase', 'migrazioni', n), 'utf8');
    const m19 = mig('2026-10-19-tetti-di-spesa.sql'), m12 = mig('2026-10-12-valigia-e-impostazioni.sql');
    const da = (x, s) => x.slice(x.indexOf('-- ═', x.indexOf(s) - 200));
    const blocchi19 = da(m19, 'LA VALIGIA E LE IMPOSTAZIONI, PRIVATE').split(/\n(?=-- ─{20,}\n--  I TETTI DI SPESA DEL GRUPPO)/);
    ok('2. e le migrazioni a mano hanno lo stesso testo dello schema (tabella, vincolo e guardiano)',
      blocchi19.length === 2 && blocchi19.every(b => schema.includes(b.trim())) && schema.includes(da(m12, 'LA VALIGIA E LE IMPOSTAZIONI, PRIVATE').trim()),
      blocchi19.map(b => b.length + ' caratteri').join(' + '));
    await anna.close(); await bruno.close(); await anna2.close();
  });

  // ── 3. i conti ─────────────────────────────────────────────────────────────
  if (fai(3)) await prova('3. conti', async () => {
    const page = await apriLocale(browser, { extra: { expenses: SPESE_CONTI, tetto: 400, tettoCat_Cibo: 100 } });
    await page.evaluate(() => { app.tettiMiei = { 1: { v: 200, t: 1 } }; app.tettiAvvisi = { 1: { gruppo: { 80: 400, 100: 400 }, mio: { 80: 200, 100: 200 }, 'cat:Cibo': { 80: 100, 100: 100 } } }; save(); renderAll(); go('money'); moneyVista('budget'); });
    await page.waitForTimeout(300);
    const s = await page.evaluate(() => statoTetti(T()).map(v => ({ k: v.chiave, speso: v.speso, prev: v.previste, resta: v.resta, pct: v.pct, giorni: v.giorni, al: v.alGiorno, conPrev: v.conPrev, pctPrev: v.pctPrev })));
    const g = s.find(v => v.k === 'gruppo') || {}, m = s.find(v => v.k === 'mio') || {}, c = s.find(v => v.k === 'cat:Cibo') || {};
    ok('3. gruppo: speso 200 di 400, restano 200, 50%, previste a parte (con quelle 260, 65%)', g.speso === 200 && g.resta === 200 && g.pct === 50 && g.prev === 60 && g.conPrev === 260 && Math.round(g.pctPrev) === 65, JSON.stringify(g));
    ok('3. quota al giorno: restano 200 per i 5 giorni che mancano, oggi compreso: 40 al giorno', g.giorni === 5 && g.al === 40, `${g.giorni} giorni, ${g.al} al giorno`);
    ok('3. la tua parte: 60 della cena e 80 del treno, 140 di 200 (70%); con la tua meta\' del museo 170', m.speso === 140 && Math.round(m.pct) === 70 && m.conPrev === 170, JSON.stringify(m));
    ok('3. la categoria: Cibo 120 di 100, oltre di 20; la spesa in attesa di cambio non conta', c.speso === 120 && c.resta === -20 && Math.round(c.pct) === 120, JSON.stringify(c));
    const vista = await page.evaluate(() => {
      const testo = s => (document.querySelector(`#tettiCard .tet-voce[data-tetto="${s}"]`) || {}).textContent || '';
      return { g: testo('gruppo'), c: testo('cat:Cibo'), tutto: document.getElementById('tettiCard').textContent,
        attesi: { speso: tv('Speso {1} di {2}', fmtMoney(200, 'EUR'), fmtMoney(400, 'EUR')),
          resta: tp(5, 'Restano {2} per {1} giorno', 'Restano {2} per i prossimi {1} giorni, cioè {3} al giorno', fmtMoney(200, 'EUR'), fmtMoney(40, 'EUR')),
          prev: tv('Con le previste arriveresti a {1} ({2})', fmtMoney(260, 'EUR'), fmtPct(65)),
          oltre: tv('{1} oltre il tetto', fmtMoney(20, 'EUR')),
          attesa: tp(1, '{1} spesa non ancora inclusa (cambio in attesa)', '{1} spese non ancora incluse (cambio in attesa)') } };
    });
    const pulito = x => x.replace(/\s+/g, ' ');
    ok('3. a schermo: «Speso 200 € di 400 €» e «restano 200 € per i prossimi 5 giorni, cioè 40 € al giorno»', pulito(vista.g).includes(pulito(vista.attesi.speso)) && pulito(vista.g).includes(pulito(vista.attesi.resta)), pulito(vista.g).slice(0, 160));
    ok('3. le previste a parte: «con le previste arriveresti a 260 € (65%)»', pulito(vista.g).includes(pulito(vista.attesi.prev)), vista.attesi.prev);
    ok('3. il tetto superato lo dice: «20 € oltre il tetto»', pulito(vista.c).includes(pulito(vista.attesi.oltre)), pulito(vista.c).slice(0, 120));
    ok('3. e la riga dice che la spesa in attesa di cambio e\' esclusa', pulito(vista.tutto).includes(vista.attesi.attesa), vista.attesi.attesa);
    // un viaggio finito: niente quota al giorno
    const finito = await page.evaluate(() => { const t = T(); const prima = [t.start, t.end]; t.start = '2020-01-01'; t.end = '2020-01-05'; const v = statoTetti(t).find(x => x.chiave === 'gruppo'); [t.start, t.end] = prima; return { giorni: v.giorni, al: v.alGiorno }; });
    ok('3. a viaggio finito la quota al giorno non si dice', finito.giorni === 0 && finito.al === 0, JSON.stringify(finito));
    // una cifra scritta all'italiana
    const cifre = await page.evaluate(() => [numTetto('1.500'), numTetto('1 500'), numTetto('1500,5'), numTetto('1,500.25'), numTetto('2000')]);
    ok('3. le cifre scritte come le scrive chi usa l\'app («1.500», «1 500», «1500,5»)', JSON.stringify(cifre) === JSON.stringify([1500, 1500, 1500.5, 1500.25, 2000]), JSON.stringify(cifre));
    await page.close();
  });

  // ── 4. gli avvisi ──────────────────────────────────────────────────────────
  if (fai(4)) await prova('4. avvisi', async () => {
    const page = await apriLocale(browser, { extra: { tetto: 100, tettoCat_Cibo: 50 } });
    await page.evaluate(SPIA_AVVISI, false);
    const spendi = (id, amount, cat = 'Trasporti', among = [1, 2]) => page.evaluate(([id, amount, cat, among]) => {
      T().expenses.push({ id, desc: 'x' + id, amount, origAmount: amount, origCurrency: 'EUR', rate: 1, payerId: 1, category: cat, splitAmong: among, date: T().start, paid: true });
      save(); renderAll();
    }, [id, amount, cat, among]);
    const togli = id => page.evaluate(i => { T().expenses = T().expenses.filter(e => e.id !== i); save(); renderAll(); }, id);
    const avvisi = async () => { await page.waitForTimeout(650); return page.evaluate(() => window.__avvisi.map(a => (a.dove && a.dove.tipo) + ':' + a.testo)); };
    await spendi(1, 70);
    let a = await avvisi();
    ok('4. sotto l\'80% nessun avviso', a.length === 0, a.join(' | '));
    await spendi(2, 15);
    a = await avvisi();
    const g80 = a.filter(x => /80/.test(x) && /gruppo/i.test(x));
    ok('4. passato l\'80% del tetto del gruppo: un avviso', a.length === 1 && g80.length === 1, a.join(' | '));
    await spendi(3, 5);
    a = await avvisi();
    ok('4. e non un altro alla spesa dopo, sempre sopra l\'80%', a.length === 1, a.length + ' avvisi');
    await spendi(4, 15);
    a = await avvisi();
    ok('4. passato il 100%: il suo avviso, una volta', a.length === 2 && /superato/.test(a[1]), a.join(' | '));
    await togli(4); await togli(3); await togli(2); await spendi(5, 20);
    a = await avvisi();
    ok('4. tornando sotto e risalendo, la stessa soglia non riparte', a.length === 2, a.length + ' avvisi');
    await page.evaluate(() => { T().tetto = 300; save(); renderAll(); });
    await spendi(6, 160);
    a = await avvisi();
    ok('4. un tetto nuovo (alzato dall\'admin) riarma le soglie', a.length === 3 && /80/.test(a[2]), a.join(' | '));
    // la persona: 50 della Zelda, a salti
    await page.evaluate(() => { app.tettiMiei = { 1: { v: 100, t: Date.now() } }; T().expenses = []; T().tetto = 100000; save(); renderAll(); });
    await page.waitForTimeout(650);
    await page.evaluate(() => { window.__avvisi = []; });
    await spendi(10, 85, 'Trasporti', [1]);
    a = await avvisi();
    ok('4. il tuo tetto: avviso all\'80%', a.length === 1 && /tuo tetto/.test(a[0]), a.join(' | '));
    await spendi(11, 20, 'Trasporti', [1]);
    a = await avvisi();
    ok('4. e al 100%', a.length === 2 && /superato il tuo tetto/.test(a[1]), a.join(' | '));
    // la categoria, saltando l'80 in un colpo: parte solo quello del 100
    await page.evaluate(() => { window.__avvisi = []; });
    await spendi(12, 60, 'Cibo', [1, 2]);
    a = await avvisi();
    const cibo = a.filter(x => /Cibo/.test(x));
    ok('4. la categoria: passata l\'80 e il 100 in un colpo, un avviso solo, quello del 100', cibo.length === 1 && /superato/.test(cibo[0]), a.join(' | '));
    // dove porta il tocco
    const dove = await page.evaluate(() => { go('plan'); vaiAllAvviso(window.__avvisi[window.__avvisi.length - 1].dove); return { soldi: document.getElementById('money').classList.contains('active'), budget: getComputedStyle(document.getElementById('moneyBudget')).display !== 'none' }; });
    ok('4. il tocco sull\'avviso apre il Budget', dove.soldi && dove.budget, JSON.stringify(dove));
    // i permessi: senza, il banner; con, anche la notifica del telefono
    const senza = await page.evaluate(() => ({ banner: document.querySelectorAll('.prox.avv').length, notifiche: window.__notifiche.length }));
    await page.evaluate(SPIA_AVVISI, true);
    await page.evaluate(() => { app.tettiAvvisi = {}; save(); renderAll(); });
    await page.waitForTimeout(800);
    const con = await page.evaluate(() => ({ notifiche: window.__notifiche.length, dove: window.__notifiche[0] && window.__notifiche[0].o.data && window.__notifiche[0].o.data.dove }));
    ok('4. senza il permesso l\'avviso e\' un banner nell\'app; col permesso arriva anche come notifica del telefono, che porta al Budget',
      senza.banner >= 1 && senza.notifiche === 0 && con.notifiche >= 1 && con.dove && con.dove.tipo === 'budget', JSON.stringify({ senza, con }));
    await page.close();
  });

  // ── 5. la scheda in Home ───────────────────────────────────────────────────
  if (fai(5)) await prova('5. scheda in Home', async () => {
    const page = await apriLocale(browser, { extra: { tetto: 100, expenses: [{ id: 1, desc: 'x', amount: 79, origAmount: 79, origCurrency: 'EUR', rate: 1, payerId: 1, category: 'Trasporti', splitAmong: [1, 2], date: D[0], paid: true }] } });
    await page.evaluate(() => { app.tettiAvvisi = { 1: { gruppo: { 80: 100, 100: 100 } } }; save(); renderAll(); go('plan'); });
    await page.waitForTimeout(300);
    const prima = await page.evaluate(() => !!document.getElementById('budScheda'));
    await page.evaluate(() => { T().expenses[0].amount = T().expenses[0].origAmount = 81; save(); renderAll(); go('plan'); });
    await page.waitForTimeout(300);
    const dopo = await page.evaluate(() => { const b = document.getElementById('budScheda'); return b ? b.textContent.replace(/\s+/g, ' ').trim() : null; });
    ok('5. a 79% la scheda non c\'e\'; a 81% compare, e dice quale tetto e a che punto', !prima && !!dopo && /Tetto del gruppo/.test(dopo) && /81/.test(dopo), dopo || '(niente)');
    await page.click('#budScheda');
    await page.waitForTimeout(300);
    const budget = await page.evaluate(() => document.getElementById('money').classList.contains('active') && getComputedStyle(document.getElementById('moneyBudget')).display !== 'none');
    ok('5. e porta al Budget', budget);
    await page.evaluate(() => { T().expenses[0].amount = T().expenses[0].origAmount = 30; save(); renderAll(); go('plan'); });
    await page.waitForTimeout(300);
    const via = await page.evaluate(() => !document.getElementById('budScheda'));
    ok('5. tornata sotto l\'80%, sparisce', via);
    await page.close();
  });

  // ── 6. due telefoni ────────────────────────────────────────────────────────
  if (fai(6)) await prova('6. due telefoni', async () => {
    semina(lisbona({ tetto: 500 }));
    const a1 = await apriCloud(browser, ANNA), a2 = await apriCloud(browser, ANNA), bruno = await apriCloud(browser, BRUNO);
    await pronto(a1); await pronto(a2); await pronto(bruno);
    await scegliLisbona(a1); await scegliLisbona(a2); await scegliLisbona(bruno);
    await senzaRete(a1, true); await senzaRete(a2, true); await senzaRete(bruno, true);
    // su un telefono Anna alza il tetto; sull'altro mette quello del Cibo; Bruno cambia il nome e aggiunge una spesa
    await a1.evaluate(() => { T().tetto = 700; save(); });
    await a2.evaluate(() => { T().tettoCat_Cibo = 150; save(); });
    await bruno.evaluate(() => { const t = T(); t.name = 'Lisbona 2026'; t.expenses.push({ id: 9901, desc: 'Pastéis', amount: 12, origAmount: 12, origCurrency: 'EUR', rate: 1, payerId: 2, category: 'Cibo', splitAmong: [1, 2], date: t.start, type: 'expense' }); save(); });
    for (const p of [a1, a2, bruno]) { await senzaRete(p, false); await sincronizza(p); }
    for (const p of [a1, a2, bruno]) await sincronizza(p);
    for (const p of [a1, a2, bruno]) await p.evaluate(async () => { await pullCloud(); });
    for (const p of [a1, a2, bruno]) await sincronizza(p);
    const cloud = nelCloud();
    const viste = [];
    for (const p of [a1, a2, bruno]) viste.push(await viaggioDi(p));
    const giusto = t => t && t.tetto === 700 && t.tettoCat_Cibo === 150 && t.name === 'Lisbona 2026' && (t.expenses || []).some(e => e.id === 9901) && (t.expenses || []).some(e => e.id === 701);
    ok('6. nel cloud: il tetto alzato, quello del Cibo, il nome nuovo e la spesa di Bruno, tutti insieme', giusto(cloud), JSON.stringify({ tetto: cloud.tetto, cibo: cloud.tettoCat_Cibo, nome: cloud.name, spese: (cloud.expenses || []).map(e => e.id) }));
    ok('6. e uguale sui tre telefoni', viste.every(giusto), viste.map(t => t && `${t.tetto}/${t.tettoCat_Cibo}/${t.name}/${(t.expenses || []).length}`).join(' · '));
    await a1.close(); await a2.close(); await bruno.close();
  });

  // ── 7. la mappa del viaggio ────────────────────────────────────────────────
  if (fai(7)) await prova('7. mappa', async () => {
    const page = await apriLocale(browser);
    await page.evaluate(() => apriMappaViaggio());
    await aspetta(page, () => typeof vmMappa !== 'undefined' && vmMappa && document.querySelectorAll('#vmMappa .leaflet-marker-icon').length > 0, null, 8000);
    const colori = await page.evaluate(() => COLORI_GIORNI.slice(0, 2));
    const segni = () => page.evaluate(() => [...document.querySelectorAll('#vmMappa .leaflet-marker-icon')].map(e => {
      const pin = e.querySelector('.vm-pin,.vm-grappolo,.vm-casa');
      return { titolo: e.getAttribute('title') || '', testo: (pin && pin.textContent || '').trim(), colore: pin && pin.classList.contains('vm-pin') ? getComputedStyle(pin).backgroundColor : '', tipo: pin ? pin.className : '' };
    }));
    const rgb = h => { const n = parseInt(h.slice(1), 16); return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`; };
    // tutti i giorni: le 4 tappe con una posizione ci sono tutte, sciolte o nei gruppi
    let s = await segni();
    const tappeTutte = s.filter(x => /vm-pin/.test(x.tipo)).length + s.filter(x => /vm-grappolo/.test(x.tipo)).reduce((n, x) => n + Number(x.testo), 0);
    ok('7. «Tutti i giorni»: tutte le tappe con una posizione sulla mappa (sciolte o raccolte), e l\'albergo', tappeTutte === 4 && s.some(x => /vm-casa/.test(x.tipo)), s.map(x => x.titolo || x.testo).join(' | '));
    /* Senza rete: lo sfondo e' lo strato di stratoMappa, quello che tiene da
       parte le zone gia' viste (prova-mappa lo prova da solo). */
    const sfondo = await page.evaluate(() => {
      let strato = false; vmMappa.eachLayer(l => { if (L.TileLayer.GeppGo && l instanceof L.TileLayer.GeppGo) strato = true; });
      const a = document.querySelector('#vmMappa .leaflet-control-attribution a[href*="openstreetmap.org/copyright"]');
      return { strato, citazione: a ? a.closest('.leaflet-control-attribution').textContent.trim() : '' };
    });
    ok('7. lo sfondo e\' quello che resta per quando manca la rete, con «© OpenStreetMap» e il link ai diritti', sfondo.strato && /©\s*OpenStreetMap/.test(sfondo.citazione), JSON.stringify(sfondo));
    // il primo giorno: tre numeri, nel colore del giorno, nell'ordine della giornata
    await page.evaluate(() => vmScegli(0));
    await page.waitForTimeout(500);
    s = await segni();
    const pins = s.filter(x => /vm-pin/.test(x.tipo));
    ok('7. Giorno 1: 1, 2 e 3 nell\'ordine della giornata, tutti col colore del giorno',
      pins.length === 3 && ['1. Fushimi Inari', '2. Nishiki', '3. Kiyomizu'].every((n, i) => pins.some(x => x.titolo.startsWith(n) && x.testo === String(i + 1))) && pins.every(x => x.colore === rgb(colori[0])),
      pins.map(x => `${x.testo} ${x.titolo} ${x.colore}`).join(' | '));
    const linea = await page.evaluate(() => vmLinee.getLayers().filter(l => l instanceof L.Polyline).map(l => ({ c: l.options.color, n: l.getLatLngs().length })));
    ok('7. e la linea che le unisce, nel colore del giorno', linea.length === 1 && linea[0].c === colori[0] && linea[0].n === 3, JSON.stringify(linea));
    const giorni = await page.evaluate(() => [...document.querySelectorAll('#vmGiorni .chip')].map(b => b.textContent.trim() + (b.classList.contains('on') ? '*' : '')));
    ok('7. il filtro: «Tutti i giorni» e un tasto per giorno, quello scelto acceso', giorni.length === 6 && giorni[0].startsWith('Tutti i giorni') && giorni[1] === 'Giorno 1*', giorni.join(' · '));
    await page.evaluate(() => vmScegli(1));
    await page.waitForTimeout(500);
    s = await segni();
    const p2 = s.filter(x => /vm-pin/.test(x.tipo));
    ok('7. Giorno 2: solo la sua tappa con la posizione, col suo colore, e l\'albergo dove si dorme quella notte',
      p2.length === 1 && p2[0].titolo.startsWith('1. Todaiji') && p2[0].colore === rgb(colori[1]) && s.some(x => /vm-casa/.test(x.tipo)), s.map(x => x.titolo || x.testo).join(' | '));
    await page.evaluate(() => vmScegli(2));
    await page.waitForTimeout(400);
    s = await segni();
    ok('7. Giorno 3: il giorno del check-out l\'albergo non c\'e\' piu\'', !s.some(x => /vm-casa/.test(x.tipo)), s.map(x => x.titolo || x.testo).join(' | ') || 'niente sulla mappa');
    // la scheda del segnaposto e la tappa giusta
    await page.evaluate(() => vmScegli(0));
    await page.waitForTimeout(500);
    await page.click('#vmMappa .leaflet-marker-icon[title^="2. Nishiki"]');
    await page.waitForSelector('.vm-pop', { timeout: 3000 });
    await page.waitForTimeout(500); // la mappa si sposta per far stare dentro la scheda
    const scheda = await page.evaluate(() => document.querySelector('.vm-pop').textContent.replace(/\s+/g, ' ').trim());
    const attesa = await page.evaluate(() => vmGiornoNome(T(), 0) + ' · ' + tv('ore {1}', '12:00'));
    ok('7. toccando un segnaposto: la scheda con nome, giorno e ora, e «Apri la tappa»', scheda.includes('2. Nishiki') && scheda.includes(attesa) && /Apri la tappa/.test(scheda), scheda);
    /* la crocetta di Leaflet: 24 px e «Close popup» in inglese, se lasciata com'e' */
    const croce = await page.evaluate(() => {
      const b = document.querySelector('#vmMappa .leaflet-popup-close-button'); if (!b) return null;
      const q = b.getBoundingClientRect(), cx = q.left + q.width / 2, cy = q.top + q.height / 2;
      const prende = (dx, dy) => { const el = document.elementFromPoint(cx + dx, cy + dy); return !!el && (el === b || b.contains(el)); };
      return { nome: b.getAttribute('aria-label'), tocco: [[-21, 0], [21, 0], [0, -21], [0, 21]].every(([x, y]) => prende(x, y)) };
    });
    ok('7. e la sua crocetta si chiama «Chiudi» e risponde su 44 px', !!croce && croce.nome === 'Chiudi' && croce.tocco, JSON.stringify(croce));
    await page.click('.vm-pop .btn');
    await page.waitForTimeout(400);
    const aperta = await page.evaluate(() => ({ mappa: document.getElementById('mViaggioMappa').classList.contains('active'), menu: document.getElementById('mActMenu').classList.contains('active'), nome: document.getElementById('amName').textContent, ref: actMenuRef }));
    ok('7. e «Apri la tappa» apre quella tappa (il suo menu, come dalla Home)', !aperta.mappa && aperta.menu && aperta.nome === 'Nishiki' && aperta.ref && aperta.ref.di === 0 && aperta.ref.id === 12, JSON.stringify(aperta));
    // un gruppo si apre toccandolo: ci si avvicina
    await page.evaluate(() => { closeSheet('mActMenu'); apriMappaViaggio(); });
    await aspetta(page, () => document.querySelectorAll('#vmMappa .vm-grappolo').length > 0, null, 6000);
    const z0 = await page.evaluate(() => vmMappa.getZoom());
    await page.click('#vmMappa .leaflet-marker-icon:has(.vm-grappolo)');
    await page.waitForTimeout(900);
    const z1 = await page.evaluate(() => vmMappa.getZoom());
    ok('7. toccando un gruppo di tappe vicine, la mappa si avvicina', z1 > z0, `zoom ${z0} → ${z1}`);
    await page.close();
  });

  // ── 8. 200 tappe ───────────────────────────────────────────────────────────
  if (fai(8)) await prova('8. 200 tappe', async () => {
    const giorni = [];
    for (let g = 0; g < 10; g++) {
      const acts = [];
      for (let k = 0; k < 20; k++) {
        const ang = (g * 20 + k) * 2.39996, rag = 0.004 + 0.0007 * (g * 20 + k);
        acts.push(tappa(10000 + g * 100 + k, `Tappa ${g + 1}-${k + 1}`, String(8 + Math.floor(k / 2)).padStart(2, '0') + ':' + (k % 2 ? '30' : '00'), 41.9 + rag * Math.sin(ang), 12.49 + rag * Math.cos(ang)));
      }
      giorni.push({ id: 'g' + g, date: iso(giornoA(g)), title: '', activities: acts });
    }
    const page = await apriLocale(browser, { extra: { name: 'Roma', start: giorni[0].date, end: giorni[9].date, days: giorni, hotels: [] } });
    await page.evaluate(() => {
      window.__lunghi = [];
      try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__lunghi.push(Math.round(e.duration)))).observe({ entryTypes: ['longtask'] }); } catch (e) {}
    });
    const t0 = Date.now();
    await page.evaluate(() => apriMappaViaggio());
    const nata = await aspetta(page, () => typeof vmMappa !== 'undefined' && vmMappa && document.querySelectorAll('#vmMappa .leaflet-marker-icon').length > 0, null, 10000);
    const apertura = Date.now() - t0;
    const conto = await page.evaluate(() => {
      const el = [...document.querySelectorAll('#vmMappa .leaflet-marker-icon')];
      const sciolte = el.filter(e => e.querySelector('.vm-pin')).length;
      const raccolte = el.filter(e => e.querySelector('.vm-grappolo')).reduce((n, e) => n + Number(e.textContent.trim()), 0);
      return { segni: el.length, tappe: sciolte + raccolte };
    });
    ok('8. con 200 tappe la mappa si apre (meno di 3 secondi, attesa del foglio compresa)', nata && apertura < 3000, apertura + ' ms');
    ok('8. le 200 tappe ci sono tutte, e i segnaposto vicini si raccolgono (meno segni che tappe)', conto.tappe === 200 && conto.segni < 200, JSON.stringify(conto));
    // muoverla: zoom avanti e indietro, e spostarla
    const tempi = await page.evaluate(async () => {
      const misura = async f => { const t = performance.now(); await f(); return Math.round(performance.now() - t); };
      const zoom = z => new Promise(ok2 => { vmMappa.once('zoomend', () => setTimeout(ok2, 0)); vmMappa.setZoom(z, { animate: false }); });
      const fuori = [];
      const z = vmMappa.getZoom();
      fuori.push(await misura(() => zoom(z + 2)));
      fuori.push(await misura(() => zoom(z + 4)));
      fuori.push(await misura(() => zoom(z)));
      fuori.push(await misura(async () => { vmMappa.panBy([200, 120], { animate: false }); }));
      fuori.push(await misura(() => zoom(z + 1)));
      return fuori;
    });
    const lunghi = await page.evaluate(() => window.__lunghi.slice());
    const peggio = Math.max(0, ...lunghi);
    ok('8. e si muove senza blocchi: ogni zoom o spostamento sotto il mezzo secondo, nessun blocco lungo', tempi.every(x => x < 500) && peggio < 500, `tempi ${tempi.join('/')} ms, blocchi ${lunghi.join('/') || 'nessuno'}`);
    await page.close();
  });

  // ── 9. a portata, e l'elenco ───────────────────────────────────────────────
  if (fai(9)) await prova('9. a portata', async () => {
    const percorri = async (p, passi) => {
      const visti = [];
      for (const [sel, re] of passi) {
        const el = p.locator(sel).filter({ hasText: re }).first();
        await el.scrollIntoViewIfNeeded({ timeout: 3000 });
        visti.push((await el.innerText()).replace(/\s+/g, ' ').trim());
        await el.click({ timeout: 3000 });
        await p.waitForTimeout(450);
      }
      return visti;
    };
    /* Dalla Layout 2 la scheda del viaggio si apre dal menu dei viaggi (il
       nome in alto, poi «Viaggio»): quello che sta lì dentro è a 2 tocchi
       dal menu, 3 dalla Home, e per le impostazioni e le azioni rare la
       regola ne concede 3 (Layout 3). Lo si conta e lo si dice, come in
       prova-a-portata. */
    const SCHEDA = [['#menuViaggi', /\S/], ['#vgAzioni .vg-az', /Viaggio/]];
    const casi = [
      ['dalla Home, sulla mappa di oggi', p => p.evaluate(() => go('plan')), [['#homeMapWrap .mappa-tutto', /Tutto il viaggio/]], 'mViaggioMappa'],
      ['dal menu dei viaggi, dalla scheda del viaggio', p => p.evaluate(() => go('plan')), [...SCHEDA, ['#tripZoomBody button', /Tutto il viaggio/]], 'mViaggioMappa', 3],
      ['dal Programma, sulla mappa della giornata', p => p.evaluate(() => openDay(0)), [['#dayMapWrap .mappa-tutto', /Tutto il viaggio/]], 'mViaggioMappa'],
      ['dal Programma, in un giorno senza mappa', p => p.evaluate(() => openDay(3)), [['#ttTutto', /Tutto il viaggio/]], 'mViaggioMappa'],
      ['i tetti di spesa, dalla scheda del viaggio', p => p.evaluate(() => go('plan')), [...SCHEDA, ['#tripZoomBody button', /Tetti di spesa/]], 'mTetti', 3]
    ];
    for (const [nome, prima, passi, meta, limite = 2] of casi) {
      const page = await apriLocale(browser);
      await prima(page);
      await page.waitForTimeout(700);
      let visti = [], esito = false;
      try { visti = await percorri(page, passi); esito = await aspetta(page, id => document.getElementById(id).classList.contains('active'), meta, 3000); } catch (e) { visti.push('si ferma: ' + e.message.split('\n')[0]); }
      ok(`9. ${nome}: ${passi.length} ${passi.length === 1 ? 'tocco' : 'tocchi'}${limite > 2 ? ' (azione rara, dietro la scheda del viaggio: fino a 3)' : ''}, ogni voce con la scritta`, esito && passi.length <= limite && visti.length === passi.length && visti.every(v => /[a-zA-Zà-ú]/.test(v)), visti.join(' › '));
      await page.close();
    }
    const page = await apriLocale(browser);
    await page.evaluate(() => { apriMappaViaggio(); });
    await page.click('#vmSegElenco');
    await page.waitForTimeout(300);
    const elenco = await page.evaluate(() => ({
      titoli: [...document.querySelectorAll('#vmElenco .vm-giorno-t')].map(h => h.textContent.trim()),
      voci: [...document.querySelectorAll('#vmElenco .vm-voce')].map(b => b.textContent.replace(/\s+/g, ' ').trim()),
      tasti: [...document.querySelectorAll('#vmElenco .vm-voce')].every(b => b.tagName === 'BUTTON'),
      tutte: T().days.reduce((n, d) => n + d.activities.length, 0)
    }));
    ok('9. «Elenco»: tutte le tappe, anche quella senza indirizzo, raggruppate per giorno, ognuna un tasto', elenco.voci.length === elenco.tutte && elenco.titoli.length === 2 && elenco.tasti && elenco.voci.some(v => /Senza indirizzo/.test(v) && /senza posizione/.test(v)), `${elenco.voci.length}/${elenco.tutte}: ${elenco.titoli.join(' · ')}`);
    await page.click('#vmElenco .vm-voce:has-text("Kiyomizu")');
    await page.waitForTimeout(400);
    const dallElenco = await page.evaluate(() => ({ menu: document.getElementById('mActMenu').classList.contains('active'), nome: document.getElementById('amName').textContent }));
    ok('9. e dall\'elenco si apre la tappa', dallElenco.menu && dallElenco.nome === 'Kiyomizu', JSON.stringify(dallElenco));
    await page.close();
  });

  // ── 10. lingue, schermi, axe ───────────────────────────────────────────────
  if (fai(10)) await prova('10. lingue e schermi', async () => {
    const html = fs.readFileSync(path.join(RADICE, 'Index 2.1.html'), 'utf8');
    const lotto = html.slice(html.indexOf('const DIZIONARIO_TETTI={'), html.indexOf("Object.keys(DIZIONARIO_TETTI)"));
    const chiavi = l => { const a = lotto.indexOf('\n  ' + l + ':{'), b = lotto.indexOf('\n  }', a); return [...lotto.slice(a, b).matchAll(/\n    '((?:[^'\\]|\\.)*)':'((?:[^'\\]|\\.)*)'/g)].map(m => [m[1], m[2]]); };
    const en = chiavi('en');
    const manca = ['es', 'fr', 'pt'].map(l => { const k = new Map(chiavi(l)); return en.filter(([x]) => !k.get(x)).map(([x]) => l + ': ' + x); }).flat();
    ok('10. ogni frase nuova ha la sua traduzione in inglese, spagnolo, francese e portoghese', en.length >= 50 && !manca.length, manca.slice(0, 4).join(' | ') || en.length + ' frasi');
    /* Le frasi usate dal codice nuovo stanno tutte nel dizionario. */
    const usate = new Set();
    const pezzo = html.slice(html.indexOf('/* ===== I TETTI DI SPESA (miglioria 13a)'), html.indexOf('/* ===== METTERLA SUL TELEFONO'))
      + html.slice(html.indexOf('/* ===== LA MAPPA DI TUTTO IL VIAGGIO (miglioria 13a)'), html.indexOf('function addFromDay(){'));
    [...pezzo.matchAll(/\bt[vp]\(\s*(?:[^,'()]+,\s*)?'((?:[^'\\]|\\.)*)'(?:\s*,\s*'((?:[^'\\]|\\.)*)')?/g)].forEach(m => { usate.add(m[1]); if (m[2] && /\{1\}/.test(m[2])) usate.add(m[2]); });
    const dizIt = new Set();
    [...html.matchAll(/\n\s+'((?:[^'\\]|\\.)*)':'/g)].forEach(m => dizIt.add(m[1]));
    const senza = [...usate].filter(x => x && !/^\{1\}$/.test(x) && !dizIt.has(x));
    /* almeno 40: una ricerca che non trova niente sembrerebbe un codice perfetto */
    ok('10. e ogni frase che il codice nuovo scrive a schermo e\' nel dizionario', usate.size >= 40 && !senza.length, senza.slice(0, 5).join(' | ') || usate.size + ' frasi');

    /* Le schermate nuove in cinque lingue, da 320 a 430 px, nei due temi. */
    const SCHERMI = [
      ['Budget coi tetti', "go('money');moneyVista('budget');document.getElementById('tettiCard').scrollIntoView({block:'start'})", '#tettiCard'],
      ['foglio dei tetti', 'apriTetti()', '#mTetti .sheet'],
      ['Home con la scheda', "closeSheet('mTetti');go('plan');document.getElementById('budScheda').scrollIntoView({block:'center'})", '#budScheda'],
      ['mappa del viaggio', "apriMappaViaggio()", '#mViaggioMappa .sheet'],
      ['elenco del viaggio', "apriMappaViaggio();vmVista('elenco')", '#mViaggioMappa .sheet']
    ];
    const PREPARA = "(()=>{const t=T();t.tetto=400;t.tettoCat_Cibo=100;t.tettoCat_Trasporti=90;t.expenses=" + JSON.stringify(SPESE_CONTI) + ";app.tettiMiei={1:{v:200,t:1}};app.tettiAvvisi={1:{gruppo:{80:400,100:400},mio:{80:200,100:200},'cat:Cibo':{80:100,100:100},'cat:Trasporti':{80:90,100:90}}};save();renderAll();})()";
    const ITALIANO = /\b(Tetto|Tetti|Speso|Restano|Giorno \d|Tutto il viaggio|Elenco|Mappa delle|Apri la tappa|Nessun tetto|Imposta i|Modifica i|Il tuo tetto|Per tutto il gruppo|oltre il tetto|previste|al giorno|Tutti i giorni|senza posizione)\b/;
    const fuori = [], italiano = [], axeGuai = [];
    for (const lingua of LINGUE) {
      for (const [larghezza, tema] of [[320, 'chiaro'], [430, 'scuro'], [390, lingua === 'it' ? 'scuro' : 'chiaro']]) {
        const page = await apriLocale(browser, { lingua, larghezza, tema });
        await page.evaluate(PREPARA);
        for (const [nome, js, sel] of SCHERMI) {
          await page.evaluate(js);
          await page.waitForTimeout(nome.startsWith('mappa') ? 900 : 350);
          await page.evaluate(() => document.querySelectorAll('.prox.avv').forEach(e => e.remove()));
          const m = await page.evaluate(s => {
            const radice = document.querySelector(s);
            if (!radice) return { manca: true };
            const W = innerWidth, guai = [];
            /* Una fila che scorre di lato (i giorni della mappa) puo' andare
               oltre il bordo: ci si arriva col dito, come nelle altre file di
               tasti dell'app. Il foglio intero invece non deve scorrere. */
            const inFilaCheScorre = el => { for (let a = el.parentElement; a && a !== radice; a = a.parentElement) if (/auto|scroll/.test(getComputedStyle(a).overflowX)) return true; return false; };
            if (radice.scrollWidth > radice.clientWidth + 1) guai.push('il foglio scorre di lato: ' + radice.scrollWidth + ' > ' + radice.clientWidth);
            radice.querySelectorAll('*').forEach(el => {
              const r2 = el.getBoundingClientRect();
              if (!r2.width || !el.getClientRects().length || el.closest('.leaflet-pane,.leaflet-control-container')) return;
              if ((r2.right > W + 1 || r2.left < -1) && !inFilaCheScorre(el)) guai.push('fuori: ' + (el.id || el.className || el.tagName) + ' ' + Math.round(r2.left) + '–' + Math.round(r2.right));
              const st = getComputedStyle(el);
              if ((st.overflow === 'hidden' || st.textOverflow === 'ellipsis') && el.scrollWidth > el.clientWidth + 1 && el.children.length === 0 && el.textContent.trim()) guai.push('tagliato: ' + el.textContent.trim().slice(0, 30));
            });
            if (document.scrollingElement.scrollWidth > W + 1) guai.push('la pagina scorre di lato');
            return { guai, testo: radice.innerText };
          }, sel);
          if (m.manca) { fuori.push(`${lingua} ${larghezza} ${nome}: non c'e'`); continue; }
          m.guai.forEach(g => fuori.push(`${lingua} ${larghezza} ${tema} ${nome}: ${g}`));
          if (lingua !== 'it') {
            const it = (m.testo.replace(/Kyoto|Fushimi Inari|Nishiki|Kiyomizu|Todaiji|Senza indirizzo|Ryokan Hoshi|Zelda|Yuri/g, '').match(ITALIANO) || [])[0];
            if (it) italiano.push(`${lingua} ${nome}: «${it}»`);
          }
          if (larghezza === 390) {
            if (!page._axe) { await page.addScriptTag({ path: AXE }); page._axe = true; }
            const v = await page.evaluate(async s => {
              const res = await axe.run({ include: [document.querySelector(s)] }, { resultTypes: ['violations'] });
              return res.violations.filter(x => x.impact === 'serious' || x.impact === 'critical').map(x => `${x.impact} ${x.id}: ${x.nodes.slice(0, 2).map(n => n.target.join(' ')).join(', ')}`);
            }, sel);
            v.forEach(x => axeGuai.push(`${lingua} ${tema} ${nome}: ${x}`));
          }
        }
        await page.close();
      }
    }
    ok('10. le schermate nuove nelle cinque lingue, senza italiano rimasto', !italiano.length, italiano.slice(0, 4).join(' | ') || '5 lingue');
    ok('10. niente fuori schermo e niente tagliato, da 320 a 430 px, nel tema chiaro e in quello scuro', !fuori.length, fuori.slice(0, 4).join(' | ') || 'tutto dentro');
    ok('10. nessuna violazione grave o critica di axe, nei due temi', !axeGuai.length, axeGuai.slice(0, 4).join(' | ') || 'nessuna');
  });

  ok('nessun errore nelle pagine', !errori.length, errori.slice(0, 3).join(' | '));
  console.log('\n' + r.join('\n'));
  const falliti = r.filter(x => x.includes('FALLITO')).length;
  console.log(`\n${r.length - falliti}/${r.length} passati`);
  await browser.close();
  process.exit(falliti ? 1 : 0);
})();
