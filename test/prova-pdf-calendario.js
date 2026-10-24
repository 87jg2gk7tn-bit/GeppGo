/* IL PDF DELL'ITINERARIO E IL CALENDARIO CHE SI AGGIORNA (miglioria 13b).

   1. dalla 13a: una spesa che passa piu' soglie insieme fa un avviso solo,
      che parte dalla piu' grave e dice le altre; i colori dei giorni sono
      tutti diversi fino a 21 giorni (e si distinguono); la crocetta delle
      schede sulla mappa della Home e su quella della giornata risponde su
      44 px e si chiama «Chiudi» nella lingua dell'app;
   2. il PDF ha la copertina, i giorni, le tappe con l'ora, gli alberghi, gli
      spostamenti e i link a Google Maps; le opzioni (costi, note, biglietti)
      si rispettano; i codici dei biglietti e i QR non ci sono mai;
   3. gli accenti sono testo vero del PDF, e il nome giapponese c'e',
      disegnato coi caratteri del telefono (non vuoto, non quadratini);
   4. il PDF arriva al foglio Condividi, dentro il tocco, come file
      «Itinerario - Giappone.pdf» nella lingua dell'app; dove il foglio
      Condividi non c'e', si scarica con lo stesso nome;
   5. il calendario che si aggiorna: dall'app (dal menu dei viaggi in due tocchi) si
      crea il link, si aggiunge al calendario (webcal://), si copia, si rifa'
      e si spegne; la funzione, col codice giusto, da' un calendario valido
      con gli eventi giusti, alle ore giuste del posto; col codice sbagliato,
      spento o di chi e' uscito dal viaggio, niente;
   6. cambiando o togliendo una tappa il calendario cambia senza doppioni;
   7. il database: nessuno legge o crea i codici di un altro (la prova SQL,
      sopra la migrazione lanciata due volte sullo schema di prima);
   8. senza account, «Esporta nel calendario» fa il file .ics di sempre;
   9. i testi nuovi in cinque lingue; niente fuori schermo da 320 a 430 px nei
      due temi; tasti da 44 px; nessuna violazione grave di axe.

   Il PDF si legge qui, in Node: gli oggetti, i flussi compressi, il testo
   scritto coi caratteri di base (WinAnsi), i link e le immagini. Il cloud
   dell'app e' finto (Nuvola, come in prova-budget-mappa); il database e le
   regole della funzione del calendario sono veri: Postgres con la
   migrazione, e supabase/functions/calendario/regole.mjs che legge da li'
   come fa la funzione pubblicata.

   `node test/prova-pdf-calendario.js 2 5` fa solo le prove 2 e 5. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const { apriBrowser, APP, leafletJs, leafletCss, RADICE } = require('./browser');
const { VIAGGIO, PORTO, apriPagina, giornoA, iso } = require('./schermate');

const r = [];
const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);
const errori = [];
const SCELTE = process.argv.slice(2).filter(a => /^\d+$/.test(a));
const fai = n => !SCELTE.length || SCELTE.includes(String(n));
const LINGUE = ['it', 'en', 'es', 'fr', 'pt'];
const AXE = require.resolve('axe-core/axe.min.js');
const JSPDF = require.resolve('jspdf/dist/jspdf.umd.min.js');
const prova = async (nome, fn) => { try { await fn(); } catch (e) { ok(nome, false, 'si è fermata: ' + e.message.split('\n')[0]); } };
const aspetta = (p, fn, arg, ms = 8000) => p.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
const copia = x => x == null ? x : JSON.parse(JSON.stringify(x));
const D = [0, 1, 2, 3].map(i => iso(giornoA(i)));
const nudo = d => d.replace(/-/g, '');

/* ── il viaggio di prova ──────────────────────────────────────────────────
   Quello del giro delle schermate (Kyoto, quattro giorni), con dentro le
   cose difficili: un indirizzo con la ō, un nome e un indirizzo in
   giapponese, gli accenti e il «€», una nota, una spesa legata a una tappa
   e due biglietti con il codice, uno dei due legato al volo. */
const CODICI = ['AB12CODICE', 'QRSEGRETO123'];
function viaggioPdf() {
  const v = copia(VIAGGIO);
  v.days[0].activities[0].address = 'Fukakusa Yabunouchichō, Kyōto';
  v.days[0].activities[1].notes = 'Assaggiare il tamagoyaki';
  v.days[0].activities[2].name = 'Kiyomizu-dera 清水寺';
  v.days[0].activities[2].address = '京都市東山区清水1丁目294';
  v.days[1].activities.push({ id: 22, name: 'Caffè Crème brûlée à Nara', time: '15:00', timeEnd: '', lat: 34.68, lng: 135.83, who: [1, 2], notes: 'Œuvre d’art – 50 €', booking: { needed: false, done: false } });
  v.expenses.push({ id: 204, desc: 'Biglietto', amount: 400, currency: 'JPY', payerId: 1, category: 'Attrazioni', paid: true, splitAmong: [1, 2, 3], date: D[0], actIds: [13] });
  v.tickets = [{ id: 7, name: 'Pass JR', code: CODICI[0], fmt: 'qrcode', type: 'attraction', personId: 1 },
    { id: 8, name: 'Volo NH 216', code: CODICI[1], fmt: 'qrcode', type: 'flight', personId: 2, actId: 21 }];
  return v;
}

/* ── leggere il PDF ───────────────────────────────────────────────────────
   Gli oggetti uno per uno: i flussi (compressi, si aprono con zlib), dentro
   i flussi il testo scritto (i pezzi fra parentesi prima di Tj, coi byte di
   WinAnsi), i link (/URI) e le immagini (/Subtype /Image). */
const WINANSI = new Map([[0x80, '€'], [0x82, '‚'], [0x83, 'ƒ'], [0x84, '„'], [0x85, '…'], [0x86, '†'], [0x87, '‡'], [0x88, 'ˆ'], [0x89, '‰'], [0x8A, 'Š'], [0x8B, '‹'], [0x8C, 'Œ'], [0x8E, 'Ž'],
  [0x91, '‘'], [0x92, '’'], [0x93, '“'], [0x94, '”'], [0x95, '•'], [0x96, '–'], [0x97, '—'], [0x98, '˜'], [0x99, '™'], [0x9A, 'š'], [0x9B, '›'], [0x9C, 'œ'], [0x9E, 'ž'], [0x9F, 'Ÿ']]);
function leggiPdf(buf) {
  const s = buf.toString('latin1');
  const flussi = [], immagini = [];
  for (const m of s.matchAll(/(?<!end)stream\r?\n/g)) {
    const dict = s.slice(s.lastIndexOf(' obj', m.index), m.index);
    if (!/>>\s*$/.test(dict)) continue;
    const dopo = m.index + m[0].length, n = /\/Length (\d+)/.exec(dict);
    const dati = buf.subarray(dopo, n ? dopo + Number(n[1]) : s.indexOf('endstream', dopo));
    if (/\/Subtype\s*\/Image/.test(dict)) {
      immagini.push({ w: Number((/\/Width (\d+)/.exec(dict) || [])[1]), h: Number((/\/Height (\d+)/.exec(dict) || [])[1]), filtro: (/\/Filter\s*\/(\w+)/.exec(dict) || [])[1], dati });
      continue;
    }
    let d = dati;
    if (/\/FlateDecode/.test(dict)) { try { d = zlib.inflateSync(dati); } catch (e) { continue; } }
    flussi.push(d.toString('latin1'));
  }
  const scioglie = x => x.replace(/\\([0-7]{1,3}|[\s\S])/g, (t, c) => /^[0-7]+$/.test(c) ? String.fromCharCode(parseInt(c, 8)) : ({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' }[c] || c));
  const righe = [];
  /* gli spazi che non vanno a capo (le cifre, «400 ¥») come spazi: si confronta il testo, non la tipografia */
  flussi.forEach(f => { for (const t of f.matchAll(/\(((?:\\[\s\S]|[^\\)])*)\)\s*Tj/g)) righe.push([...scioglie(t[1])].map(c => WINANSI.get(c.charCodeAt(0)) || c).join('').replace(/[\u00a0\u202f]/g, ' ')); });
  const link = [...s.matchAll(/\/URI\s*\(((?:\\[\s\S]|[^\\)])*)\)/g)].map(x => scioglie(x[1]));
  return { righe, testo: righe.join('\n'), link, immagini, flussi, grezzo: s, pagine: (s.match(/\/Type\s*\/Page\b(?!s)/g) || []).length };
}

/* Il foglio Condividi finto: tiene il file che gli arriva (nome, tipo,
   byte), e se in quel momento il tocco c'era ancora (iPhone il foglio lo
   apre solo dentro un tocco). si=false: un telefono senza foglio Condividi
   per i file. */
const SPIA_CONDIVIDI = si => {
  window.__condivisi = [];
  navigator.canShare = d => si && !!(d && d.files && d.files.length);
  navigator.share = async d => {
    const f = d.files[0], attivo = navigator.userActivation ? navigator.userActivation.isActive : null;
    const b64 = await new Promise(ok2 => { const q = new FileReader(); q.onload = () => ok2(String(q.result).split(',')[1]); q.readAsDataURL(f); });
    window.__condivisi.push({ nome: f.name, tipo: f.type, byte: f.size, attivo, b64 });
  };
};
async function apriPdf(browser, { lingua = 'it', larghezza = 390, viaggio, condividi = true } = {}) {
  const page = await apriPagina(browser, { lingua, larghezza, viaggi: [viaggio || viaggioPdf(), PORTO], errori, chiave: 'pdf-' + Math.random() });
  await page.route('**/jspdf@4.2.1/dist/jspdf.umd.min.js', ro => ro.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(JSPDF, 'utf8') }));
  await page.evaluate(SPIA_CONDIVIDI, condividi);
  return page;
}
/* La scheda del viaggio come un dito: dalla Layout 2 si apre dal menu dei
   viaggi (il nome in alto), col tasto «Viaggio» sotto il nome del viaggio. */
async function schedaViaggio(page) {
  await page.click('#menuViaggi');
  await page.waitForSelector('#mViaggi.active', { timeout: 4000 });
  await page.click('#vgAzioni .vg-az[onclick*="openTripZoom"]');
  await page.waitForSelector('#mTripZoom.active', { timeout: 4000 });
}
/* Come un dito: il menu dei viaggi, «Viaggio», «PDF dell'itinerario», le
   spunte, «Crea il PDF». */
async function foglioPdf(page, opz = {}) {
  await page.evaluate(() => { document.querySelectorAll('.modal.active').forEach(m => closeSheet(m.id)); go('plan'); });
  await page.waitForTimeout(350);
  await schedaViaggio(page);
  await page.click('#tripZoomBody button[onclick="apriPdfItinerario()"]');
  await page.waitForSelector('#mPdfItin.active', { timeout: 4000 });
  await page.waitForTimeout(250);
  for (const [k, v] of Object.entries(opz)) { const c = page.locator('#pdfOpz_' + k); if ((await c.isChecked()) !== v) await c.click(); }
  await page.click('#pdfCrea');
  await page.waitForFunction(() => !!pdfPronto, null, { timeout: 30000 });
}
async function creaPdf(page, opz) {
  await foglioPdf(page, opz);
  const prima = await page.evaluate(() => window.__condivisi.length);
  await page.click('#pdfAzioni button');
  await page.waitForFunction(n => window.__condivisi.length > n, prima, { timeout: 10000 });
  const c = await page.evaluate(() => window.__condivisi[window.__condivisi.length - 1]);
  return Object.assign(c, { buf: Buffer.from(c.b64, 'base64') });
}

/* ── i colori ─────────────────────────────────────────────────────────── */
const daHex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
const lin = v => v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
const lum = c => { const [a, b, d] = c.map(lin); return 0.2126 * a + 0.7152 * b + 0.0722 * d; };
function lab(c) {
  const [a, b, d] = c.map(lin);
  const x = (0.4124564 * a + 0.3575761 * b + 0.1804375 * d) / 0.95047, y = 0.2126729 * a + 0.7151522 * b + 0.0721750 * d, z = (0.0193339 * a + 0.1191920 * b + 0.9503041 * d) / 1.08883;
  const f = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
/* CIEDE2000: quanto due colori sembrano diversi a un occhio. */
function de2000(c1, c2) {
  const [L1, a1, b1] = lab(c1), [L2, a2, b2] = lab(c2), rad = Math.PI / 180;
  const Cb = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2, G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const a1p = a1 * (1 + G), a2p = a2 * (1 + G), C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const h1p = (Math.atan2(b1, a1p) / rad + 360) % 360, h2p = (Math.atan2(b2, a2p) / rad + 360) % 360;
  let dhp = h2p - h1p; if (C1p * C2p === 0) dhp = 0; else if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360;
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(dhp * rad / 2), Lbp = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2;
  let hbp = h1p + h2p; if (C1p * C2p !== 0) { if (Math.abs(h1p - h2p) > 180) hbp += (h1p + h2p < 360 ? 360 : -360); hbp /= 2; }
  const T = 1 - 0.17 * Math.cos((hbp - 30) * rad) + 0.24 * Math.cos(2 * hbp * rad) + 0.32 * Math.cos((3 * hbp + 6) * rad) - 0.20 * Math.cos((4 * hbp - 63) * rad);
  const dTh = 30 * Math.exp(-(((hbp - 275) / 25) ** 2)), Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const Sl = 1 + 0.015 * (Lbp - 50) ** 2 / Math.sqrt(20 + (Lbp - 50) ** 2), Sc = 1 + 0.045 * Cbp, Sh = 1 + 0.015 * Cbp * T, Rt = -Math.sin(2 * dTh * rad) * Rc;
  return Math.sqrt(((L2 - L1) / Sl) ** 2 + ((C2p - C1p) / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * ((C2p - C1p) / Sc) * (dHp / Sh));
}

/* ── il cloud finto, col calendario ───────────────────────────────────────
   Come in prova-budget-mappa, con in piu' la tabella calendari e le sue
   regole (le stesse dello schema, provate davvero in Postgres alla prova 7):
   ognuno vede e cancella solo le sue righe, crea solo per un viaggio di cui
   fa parte e una per viaggio, il codice lo sceglie il database, della riga
   si cambia solo la lingua. */
const ANNA = 'u-anna', BRUNO = 'u-bruno';
class Nuvola {
  constructor() { this.pagine = new Map(); this.azzera(); }
  azzera() { this.t = { trips: [], trip_members: [], foto: [], raccolte: [], dati_personali: [], calendari: [] }; this.n = 0; this.senzaCalendari = false; }
  membro(u, trip) { return this.t.trip_members.some(m => m.trip_id === trip && m.user_id === u); }
  vede(tab, u, x) {
    if (tab === 'trips') return x.owner === u || this.membro(u, x.id);
    if (tab === 'trip_members') return x.user_id === u || this.membro(u, x.trip_id);
    if (tab === 'dati_personali' || tab === 'calendari') return x.user_id === u;
    return true;
  }
  scrive(tab, u, x) {
    if (tab === 'trips') return x.owner === u || this.membro(u, x.id);
    if (tab === 'trip_members') return x.user_id === u;
    if (tab === 'dati_personali') return x.user_id === u;
    return true;
  }
  esegui(q, page) {
    const u = q.utente;
    if (page) this.pagine.set(page, u);
    const rifiuto = m => ({ data: null, error: { message: m } });
    if (q.tab === '__rpc') return { data: null, error: null };
    if (!u) return rifiuto('permission denied');
    const T = this.t[q.tab] = this.t[q.tab] || [];
    const passa = x => q.filtri.every(f => f.tipo === 'in' ? f.v.map(String).includes(String(x[f.c])) : String(x[f.c]) === String(f.v));
    if (q.tab === 'calendari') {
      if (this.senzaCalendari) return { data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.calendari' in the schema cache" } };
      const mie = T.filter(x => x.user_id === u && passa(x));
      if (q.op === 'select') return { data: q.single ? copia(mie[0] || null) : copia(mie), error: null };
      if (q.op === 'insert') {
        const x = Object.assign({ lingua: 'it' }, copia(q.riga), { codice: crypto.randomBytes(32).toString('hex'), creato_il: new Date().toISOString() });
        x.user_id = x.user_id || u;
        if (x.user_id !== u || !this.membro(u, x.trip_id)) return rifiuto('new row violates row-level security policy for table "calendari"');
        if (T.some(y => y.user_id === x.user_id && y.trip_id === x.trip_id)) return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "calendari_uno"' } };
        T.push(x);
        return { data: q.single ? copia(x) : [copia(x)], error: null };
      }
      if (q.op === 'update') {
        if (Object.keys(q.patch || {}).some(k => k !== 'lingua')) return rifiuto('permission denied for table calendari');
        mie.forEach(x => Object.assign(x, q.patch));
        return { data: copia(mie), error: null };
      }
      if (q.op === 'delete') { this.t.calendari = T.filter(x => !mie.includes(x)); return { data: copia(mie), error: null }; }
    }
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
      return { data: q.single ? copia(toccate[0]) : copia(toccate), error: null };
    }
    if (q.op === 'update') {
      const d = T.filter(x => this.vede(q.tab, u, x) && passa(x));
      for (const x of d) if (!this.scrive(q.tab, u, Object.assign({}, x, q.patch))) return rifiuto('rls');
      d.forEach(x => Object.assign(x, copia(q.patch)));
      return { data: q.single ? copia(d[0] || null) : copia(d), error: null };
    }
    if (q.op === 'delete') {
      const d = T.filter(x => this.vede(q.tab, u, x) && passa(x));
      this.t[q.tab] = T.filter(x => !d.includes(x));
      return { data: copia(d), error: null };
    }
    return rifiuto('operazione sconosciuta');
  }
}
const nuvola = new Nuvola();
/* Il finto supabase-js, come in prova-budget-mappa. */
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
/* Lisbona, nel cloud: Anna admin, Bruno compagno. Con la posizione della
   destinazione, ma senza il meteo: il fuso lo chiede il foglio. */
const lisbona = () => ({
  id: 1001, name: 'Lisbona', destination: 'Lisbona', destLoc: { lat: 38.72, lng: -9.14 }, currency: 'EUR', status: 'open', start: D[0], end: D[3],
  participants: [{ id: 1, name: 'Anna' }, { id: 2, name: 'Bruno' }], guests: [], suggested: [], pois: [], hotels: [], tickets: [], expenses: [], weather: {}, createdAt: 1,
  days: D.map((d, i) => ({ id: 'd' + i, date: d, title: '', activities: i ? [] : [{ id: 1, name: 'Torre di Belém', time: '10:00', timeEnd: '', lat: 38.6916, lng: -9.2160, who: [1, 2], notes: '' }] }))
});
function semina() {
  nuvola.azzera();
  nuvola.t.trips.push({ id: 'cid-1', owner: ANNA, invite_code: 'inv-1', data: lisbona(), updated_by: ANNA });
  nuvola.t.trip_members.push({ trip_id: 'cid-1', user_id: ANNA, participant_id: 1, ruolo: 'admin', member_name: 'Anna' });
  nuvola.t.trip_members.push({ trip_id: 'cid-1', user_id: BRUNO, participant_id: 2, ruolo: 'compagno', member_name: 'Bruno' });
}
async function apriCloud(browser, utente, { larghezza = 390 } = {}) {
  const page = await browser.newPage({ viewport: { width: larghezza, height: 844 } });
  page.on('pageerror', e => errori.push('PAGEERROR(cloud): ' + e.message.split('\n')[0]));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.exposeBinding('__nuvolaRpc', (src, q) => nuvola.esegui(q, src.page));
  await page.route('**/leaflet@1.9.4/dist/leaflet.js', ro => ro.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(leafletJs(), 'utf8') }));
  await page.route('**/leaflet@1.9.4/dist/leaflet.css', ro => ro.fulfill({ status: 200, contentType: 'text/css', body: fs.readFileSync(leafletCss(), 'utf8') }));
  await page.route(/tile\.openstreetmap\.org/, ro => ro.abort());
  /* Open-Meteo: solo la domanda del fuso (un giorno, timezone=auto) ha una
     risposta; il meteo vero resta fuori, come senza rete. */
  page.__fusi = [];
  await page.route(/api\.open-meteo\.com/, ro => {
    const u = ro.request().url();
    if (/forecast_days=1/.test(u) && /timezone=auto/.test(u)) { page.__fusi.push(u); return ro.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ timezone: 'Europe/Lisbon', utc_offset_seconds: 3600, daily: { time: [D[0]], weather_code: [1] } }) }); }
    return ro.abort();
  });
  await page.route('**/supabase-js@*/**', ro => ro.fulfill({ status: 200, contentType: 'application/javascript', body: SUPA_FINTO }));
  await page.addInitScript(([u]) => {
    window.__sessione = u ? { user: { id: u, email: u + '@x.it' }, access_token: 'x', refresh_token: 'y' } : null;
    window.__offline = false;
    if (sessionStorage.getItem('prova-calendario')) return;
    sessionStorage.setItem('prova-calendario', '1');
    localStorage.clear();
    localStorage.setItem('geppgo2', JSON.stringify({ trips: [], currentTripId: null, settings: { proxRadius: 200 }, myName: 'Anna', skipAuth: false, consentNotif: false }));
    localStorage.setItem('geppgo2_intro', '1');
  }, [utente]);
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.renderAll === 'function' && !document.getElementById('bootSplash'), null, { timeout: 30000 });
  return page;
}
const pronto = p => aspetta(p, () => typeof app !== 'undefined' && app.trips.length >= 1 && !!session && !syncBusy && app.trips.every(t => !t.cid || allineato(t.cid, t)), null, 15000);
const scegliLisbona = p => p.evaluate(() => { const t = app.trips.find(x => x.cid === 'cid-1'); if (t) { app.currentTripId = t.id; save(); renderAll(); go('plan'); } });
const sincronizza = p => p.evaluate(async () => { for (let i = 0; i < 50 && syncBusy; i++) await new Promise(r2 => setTimeout(r2, 100)); await syncPush(); for (let i = 0; i < 50 && syncBusy; i++) await new Promise(r2 => setTimeout(r2, 100)); });

/* ── il database: uno tutto suo, che alla fine se ne va ───────────────────
   Lo schema com'era prima di oggi, poi la migrazione del calendario due
   volte (come fara' chi la lancia a mano). */
const DB = 'geppgo_prova_calendario_' + process.pid;
const sql = (args, { base = DB, input } = {}) => spawnSync('psql', ['-d', base, '-v', 'ON_ERROR_STOP=1', '-q'].concat(args), { encoding: 'utf8', input });
const MIGRAZIONE = path.join(RADICE, 'supabase', 'migrazioni', '2026-10-20-calendario.sql');
const SCHEMA = fs.readFileSync(path.join(RADICE, 'supabase-schema.sql'), 'utf8');
const pgRisponde = () => spawnSync('psql', ['-d', 'postgres', '-tAc', 'select 1'], { encoding: 'utf8' }).status === 0;
let dbPronto = null;
function preparaDb() {
  if (dbPronto !== null) return dbPronto;
  sql(['-c', `drop database if exists ${DB}`], { base: 'postgres' });
  const crea = sql(['-c', `create database ${DB}`], { base: 'postgres' });
  if (crea.status !== 0) throw new Error('non riesco a creare il database: ' + (crea.stderr || '').trim().split('\n')[0]);
  const taglio = SCHEMA.indexOf('--  IL CALENDARIO CHE SI AGGIORNA');
  const prima = path.join(os.tmpdir(), 'geppgo-schema-prima-cal-' + process.pid + '.sql');
  fs.writeFileSync(prima, SCHEMA.slice(0, SCHEMA.lastIndexOf('\n-- ═', taglio)));
  try {
    const passi = [['-f', path.join(RADICE, 'test', 'supabase-ambiente-finto.sql')], ['-c', 'grant usage on schema public to anon, authenticated;'], ['-f', prima], ['-f', MIGRAZIONE], ['-f', MIGRAZIONE]];
    for (const ps of passi) { const x = sql(ps); if (x.status !== 0) throw new Error('si ferma su ' + path.basename(ps[ps.length - 1]) + ': ' + (x.stderr || '').trim().split('\n').filter(l => !/NOTICE/.test(l))[0]); }
  } finally { fs.unlinkSync(prima); }
  dbPronto = true;
  return true;
}
const finisciDb = () => { if (dbPronto) sql(['-c', `drop database if exists ${DB}`], { base: 'postgres' }); };
const UID_ANNA = '11111111-1111-1111-1111-111111111111', UID_BRUNO = '22222222-2222-2222-2222-222222222222', VIAGGIO_DB = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SONO = `create or replace function pg_temp.sono(p_uid uuid) returns void language plpgsql as $$
begin execute 'reset role'; perform set_config('request.jwt.claim.sub', coalesce(p_uid::text,''), false);
  if p_uid is null then execute 'set role anon'; else execute 'set role authenticated'; end if; end $$;\n`;
/* Il viaggio di Anna nel database, con Bruno dentro, e il link del
   calendario di tutti e due (Anna in inglese): come li farebbe l'app, con
   le regole vere. Torna i due codici. */
function seminaDb(dati) {
  const x = sql(['-tA', '-v', 'dati=' + JSON.stringify(dati)], { input: SONO + `
    delete from public.calendari; delete from public.trips; delete from auth.users;
    insert into auth.users(id,email) values ('${UID_ANNA}','anna@x.it'),('${UID_BRUNO}','bruno@x.it');
    select pg_temp.sono('${UID_ANNA}');
    insert into public.trips(id, owner, data) values ('${VIAGGIO_DB}', '${UID_ANNA}', :'dati'::jsonb);
    insert into public.trip_members(trip_id,user_id,member_name) values ('${VIAGGIO_DB}', '${UID_ANNA}', 'Anna');
    reset role;
    select invite_code as invito from public.trips where id = '${VIAGGIO_DB}' \\gset
    select pg_temp.sono('${UID_BRUNO}');
    select public.join_trip('${VIAGGIO_DB}', :'invito') \\gset
    insert into public.calendari(trip_id) values ('${VIAGGIO_DB}') returning codice as bruno \\gset
    select pg_temp.sono('${UID_ANNA}');
    insert into public.calendari(trip_id, lingua) values ('${VIAGGIO_DB}', 'en') returning codice as anna \\gset
    reset role;
    select 'CODICI', :'anna', :'bruno';` });
  if (x.status !== 0) throw new Error('il viaggio nel database: ' + (x.stderr || '').trim().split('\n').filter(l => !/NOTICE/.test(l))[0]);
  const riga = (x.stdout || '').split('\n').find(l => l.startsWith('CODICI|'));
  const [, anna, bruno] = riga.split('|');
  return { anna, bruno };
}
const cambiaDb = dati => { const x = sql(['-v', 'dati=' + JSON.stringify(dati)], { input: `update public.trips set data = :'dati'::jsonb where id = '${VIAGGIO_DB}';` }); if (x.status !== 0) throw new Error(x.stderr); };
/* Come la funzione legge il database (con la chiave di servizio, qui da
   amministratore): calendario_per_codice. */
let letture = 0;
const leggiDb = codice => {
  letture++;
  const x = sql(['-tA', '-v', 'c=' + codice], { input: "select public.calendario_per_codice(:'c');" });
  if (x.status !== 0) throw new Error(x.stderr);
  const t = (x.stdout || '').trim();
  return t ? JSON.parse(t) : null;
};
/* Il calendario di prova: Kyoto col fuso di Tokyo, una nota privata e un
   promemoria, un volo senza ora legato a un biglietto, una tappa senza ora
   e senza biglietto, l'albergo con l'ora del check-out e senza quella del
   check-in. */
function viaggioCal() {
  const v = copia(VIAGGIO);
  v.fuso = 'Asia/Tokyo';
  v.days[0].activities[1].notes = 'Prenotazione QX-77, non la deve vedere nessuno';
  v.days[0].activities[1].remindMin = 30;
  v.days[2].activities.push({ id: 31, name: 'Volo per Tokyo', time: '', timeEnd: '', who: [1, 2], notes: '' });
  v.days[2].activities.push({ id: 32, name: 'Passeggiata libera', time: '', timeEnd: '', who: [1], notes: '' });
  v.tickets = [{ id: 7, name: 'Pass JR', code: CODICI[0], fmt: 'qrcode', type: 'attraction' }, { id: 8, name: 'Volo per Tokyo', code: CODICI[1], fmt: 'qrcode', type: 'flight', actId: 31 }];
  v.hotels[0].oraCheckOut = '10:00';
  return v;
}
/* Un file iCalendar letto da qui: le righe (ripiegate rimesse insieme),
   gli eventi con i loro campi, e i guai di forma (RFC 5545). */
function leggiIcs(testo) {
  const guai = [];
  if (/[^\r]\n/.test(testo) || !testo.endsWith('\r\n')) guai.push('righe senza CRLF');
  const fisiche = testo.split('\r\n').slice(0, -1);
  const lunghe = fisiche.filter(l => Buffer.byteLength(l, 'utf8') > 75);
  if (lunghe.length) guai.push(lunghe.length + ' righe oltre 75 byte');
  const righe = [];
  fisiche.forEach(l => { if (/^[ \t]/.test(l) && righe.length) righe[righe.length - 1] += l.slice(1); else righe.push(l); });
  if (righe[0] !== 'BEGIN:VCALENDAR' || righe[righe.length - 1] !== 'END:VCALENDAR') guai.push('non comincia e finisce con VCALENDAR');
  if (!righe.includes('VERSION:2.0') || !righe.some(l => l.startsWith('PRODID:'))) guai.push('manca VERSION o PRODID');
  const eventi = [];
  let ev = null, dentroAllarme = false;
  for (const l of righe) {
    if (l === 'BEGIN:VEVENT') { if (ev) guai.push('VEVENT dentro VEVENT'); ev = { campi: {}, allarme: null }; continue; }
    if (l === 'END:VEVENT') { if (!ev) guai.push('END:VEVENT senza BEGIN'); else eventi.push(ev); ev = null; continue; }
    if (!ev) continue;
    if (l === 'BEGIN:VALARM') { dentroAllarme = true; ev.allarme = {}; continue; }
    if (l === 'END:VALARM') { dentroAllarme = false; continue; }
    const i = l.indexOf(':'), k = l.slice(0, i), v = l.slice(i + 1);
    (dentroAllarme ? ev.allarme : ev.campi)[k] = v;
  }
  if (ev) guai.push('VEVENT non chiuso');
  eventi.forEach(e => {
    const c = e.campi, inizio = c.DTSTART || c['DTSTART;VALUE=DATE'];
    if (!c.UID || !c.DTSTAMP || !inizio || !c.SUMMARY) guai.push('evento senza UID, DTSTAMP, DTSTART o SUMMARY: ' + JSON.stringify(c).slice(0, 80));
    if (c.DTSTART && !/^\d{8}T\d{6}Z?$/.test(c.DTSTART)) guai.push('DTSTART strano: ' + c.DTSTART);
    if (c['DTSTART;VALUE=DATE'] && !/^\d{8}$/.test(c['DTSTART;VALUE=DATE'])) guai.push('data strana: ' + c['DTSTART;VALUE=DATE']);
    if (e.allarme && (!e.allarme.ACTION || !e.allarme.TRIGGER || !e.allarme.DESCRIPTION)) guai.push('promemoria incompleto');
  });
  const uid = eventi.map(e => e.campi.UID);
  if (new Set(uid).size !== uid.length) guai.push('UID doppi');
  return { righe, eventi, guai, uid, per: Object.fromEntries(eventi.map(e => [e.campi.UID.split('@')[0], e])) };
}

(async () => {
  const browser = await apriBrowser();
  /* Sul codice di prima la funzione non c'e': le prove 5 e 6 lo dicono,
     invece di fermare tutto (vedi la controprova in test/README.md). */
  let regole = null;
  try { regole = await import(pathToFileURL(path.join(RADICE, 'supabase', 'functions', 'calendario', 'regole.mjs')).href); } catch (e) { regole = null; }

  // ── 1. dalla 13a: l'avviso unico, i 21 colori, le crocette ────────────────
  if (fai(1)) await prova('1. dalla 13a', async () => {
    const soldi = (lingua) => apriPagina(browser, { lingua, errori, chiave: 'tetti-' + Math.random(), viaggi: [Object.assign(copia(VIAGGIO), {
      name: 'Kyoto', currency: 'EUR', expenses: [], tetto: 100, tettoCat_Cibo: 50, participants: [{ id: 1, name: 'Zelda', isMe: true }, { id: 2, name: 'Yuri' }] }), PORTO] });
    const avvisi = {};
    for (const lingua of ['it', 'en']) {
      const page = await soldi(lingua);
      await page.evaluate(() => {
        window.__avvisi = [];
        const vera = avvisa;
        window.avvisa = o => { window.__avvisi.push({ titolo: o.titolo, testo: o.testo, dove: o.dove }); return vera(o); };
        app.tettiMiei = { 1: { v: 60, t: 1 } }; app.tettiAvvisi = {}; save(); renderAll();
      });
      await page.waitForTimeout(500);
      await page.evaluate(() => { window.__avvisi = []; T().expenses.push({ id: 901, desc: 'Cena', amount: 110, origAmount: 110, origCurrency: 'EUR', rate: 1, payerId: 1, category: 'Cibo', splitAmong: [1, 2], date: T().start, paid: true }); save(); renderAll(); });
      await page.waitForTimeout(700);
      avvisi[lingua] = await page.evaluate(() => window.__avvisi);
      await page.close();
    }
    const it = avvisi.it, en = avvisi.en;
    ok('1. una spesa che passa tre soglie insieme (gruppo al 100%, Cibo al 100%, la tua parte all\'80%): un avviso solo', it.length === 1 && en.length === 1, it.length + ' avvisi: ' + it.map(a => a.testo).join(' | '));
    ok('1. che parte dalla piu\' grave (Cibo, oltre il doppio) e dice le altre in una riga',
      !!it[0] && it[0].testo.startsWith('Per Cibo il gruppo ha superato il tetto') && it[0].testo.includes('Anche: il tetto del gruppo (110%) e il tuo tetto (92%).'), it[0] ? it[0].testo : 'nessun avviso');
    ok('1. e in inglese e\' tradotto tutto, anche la riga delle altre', !!en[0] && en[0].testo.startsWith('For Food the group has gone over the cap') && en[0].testo.includes('Also: the group cap (110%) and your cap (92%).'), en[0] ? en[0].testo : 'nessun avviso');

    // i colori dei giorni, su un viaggio di 21
    const giorni = Array.from({ length: 21 }, (_, i) => ({ id: 'g' + i, date: iso(giornoA(i)), title: '', activities: [{ id: 5000 + i, name: 'Tappa ' + (i + 1), time: '10:00', timeEnd: '', lat: 35 + i * 0.01, lng: 135.7 + i * 0.01, who: [1], notes: '' }] }));
    const lungo = Object.assign(copia(VIAGGIO), { start: giorni[0].date, end: giorni[20].date, days: giorni, hotels: [] });
    const p = await apriPagina(browser, { errori, chiave: 'colori-' + Math.random(), viaggi: [lungo, PORTO] });
    await p.waitForFunction(() => typeof L !== 'undefined', null, { timeout: 15000 }).catch(() => {});
    await p.evaluate(() => apriMappaViaggio());
    await aspetta(p, () => document.querySelectorAll('#vmGiorni .vm-pallino').length >= 21, null, 6000);
    const visti = await p.evaluate(() => ({ elenco: COLORI_GIORNI.slice(), pallini: [...document.querySelectorAll('#vmGiorni .vm-pallino')].map(e => getComputedStyle(e).backgroundColor) }));
    await p.close();
    const ventuno = Array.from({ length: 21 }, (_, i) => visti.elenco[i % visti.elenco.length]);
    let minimo = Infinity, coppia = '';
    for (let i = 0; i < 21; i++) for (let j = i + 1; j < 21; j++) { const d = de2000(daHex(ventuno[i]), daHex(ventuno[j])); if (d < minimo) { minimo = d; coppia = `giorno ${i + 1} e ${j + 1}`; } }
    const contrasti = ventuno.map(c => 1.05 / (lum(daHex(c)) + 0.05));
    ok('1. i colori dei giorni sono tutti diversi fino al giorno 21 (sulla mappa del viaggio)', new Set(visti.pallini.slice(0, 21)).size === 21 && visti.pallini.length >= 21,
      `${new Set(visti.pallini.slice(0, 21)).size} colori diversi su ${Math.min(21, visti.pallini.length)} giorni`);
    ok('1. e si distinguono a occhio (CIEDE2000 almeno 15 fra due qualunque), col numero bianco leggibile (4,5:1)', minimo >= 15 && Math.min(...contrasti) >= 4.5,
      `minimo ${minimo.toFixed(1)} (${coppia}), contrasto minimo ${Math.min(...contrasti).toFixed(2)}:1`);

    // le crocette: la mappa della Home e quella della giornata, in inglese
    const q = await apriPagina(browser, { lingua: 'en', errori, chiave: 'croci-' + Math.random() });
    await q.waitForFunction(() => typeof L !== 'undefined', null, { timeout: 15000 }).catch(() => {});
    /* la scheda della prima tappa, aperta come la apre il tocco sul segnaposto */
    const croce = async (sel, mappa) => {
      await aspetta(q, s => document.querySelectorAll(s + ' .leaflet-marker-icon').length > 0, sel, 8000);
      await q.evaluate(nome => { const m = window.eval(nome); let primo = null; m.eachLayer(l => { if (!primo && l.getPopup && l.getPopup()) primo = l; }); primo.openPopup(); }, mappa);
      await q.waitForSelector(sel + ' .leaflet-popup-close-button', { timeout: 3000 });
      await q.waitForTimeout(500);
      return q.evaluate(s => {
        const b = document.querySelector(s + ' .leaflet-popup-close-button');
        b.scrollIntoView({ block: 'center' });
        const k = b.getBoundingClientRect(), cx = k.left + k.width / 2, cy = k.top + k.height / 2;
        const prende = (dx, dy) => { const el = document.elementFromPoint(cx + dx, cy + dy); return !!el && (el === b || b.contains(el)); };
        return { nome: b.getAttribute('aria-label'), titolo: b.title, tocco: [[-21, 0], [21, 0], [0, -21], [0, 21]].every(([x, y]) => prende(x, y)),
          scheda: b.closest('.leaflet-popup').querySelector('.leaflet-popup-content').innerText.trim() };
      }, sel);
    };
    const home = await croce('#homeMap', 'homeMapObj');
    await q.evaluate(() => { homeMapObj.closePopup(); openDay(0); });
    const giorno = await croce('#dayMap', 'dayMapObj');
    await q.close();
    ok('1. la crocetta della scheda sulla mappa della Home risponde su 44 px e si chiama «Close» in inglese', home.tocco && home.nome === 'Close' && home.titolo === 'Close', JSON.stringify(home));
    ok('1. e cosi\' quella sulla mappa della giornata (dove la scheda dice anche l\'ora in inglese)', giorno.tocco && giorno.nome === 'Close' && /\nat \d\d:\d\d$/.test(giorno.scheda), JSON.stringify(giorno));
  });

  // ── 2. il PDF: cosa c'e' dentro, e le opzioni ──────────────────────────────
  let pdfBase = null;
  if (fai(2) || fai(3)) await prova('2. il PDF', async () => {
    const page = await apriPdf(browser);
    const atteso = await page.evaluate(() => ({
      date: pdfData(T().start, { day: 'numeric', month: 'long', year: 'numeric' }) + ' – ' + pdfData(T().end, { day: 'numeric', month: 'long', year: 'numeric' }),
      giorni: T().days.map((d, i) => tv('Giorno {1} · {2}', i + 1, pdfData(d.date)) + (d.title ? ' · ' + d.title : '')),
      volo: [tv('Volo'), tv('di {1}', 'Yuri'), tv('Giorno {1} · {2}', 2, pdfData(T().days[1].date, { day: 'numeric', month: 'long' })), '10:00'].join(' · ')
    }));
    const base = await creaPdf(page);                                        // costi no, note si', biglietti si'
    const conCosti = await creaPdf(page, { costi: true, note: false, biglietti: false });
    await page.close();
    pdfBase = base;
    const a = leggiPdf(base.buf), b = leggiPdf(conCosti.buf);
    ok('2. e\' un PDF vero: copertina, giorni e la fine, piu\' di una pagina', base.buf.slice(0, 5).toString() === '%PDF-' && /%%EOF\s*$/.test(base.buf.toString('latin1')) && a.pagine >= 2, a.pagine + ' pagine, ' + Math.round(base.byte / 1024) + ' KB');
    const copertina = ['Giappone', atteso.date, 'Tokyo', 'Compagni di viaggio: Zelda, Yuri e Ximena', '4 giorni · 5 tappe · 1 albergo'];
    ok('2. la copertina: nome, date, destinazione e compagni', copertina.every(x => a.righe.includes(x)), copertina.filter(x => !a.righe.includes(x)).join(' | ') || 'tutto');
    ok('2. giorno per giorno, con la data', atteso.giorni.every(x => a.righe.includes(x)), atteso.giorni.filter(x => !a.righe.includes(x)).join(' | ') || atteso.giorni.length + ' giorni');
    const tappe = ['09:30–11:00', 'Fushimi Inari', '12:00–13:00', 'Nishiki', '15:00–16:30', '10:00–12:00', 'Todaiji', 'Caffè Crème brûlée à Nara', 'Giornata libera'];
    ok('2. le tappe con l\'ora', tappe.every(x => a.righe.includes(x)), tappe.filter(x => !a.righe.includes(x)).join(' | ') || tappe.length + ' righe');
    const albergo = ['Notte: Ryokan Hoshi', 'Kyoto', 'Check-in dalle 15:00'];
    ok('2. l\'albergo della notte, con l\'indirizzo e il check-in', albergo.every(x => a.righe.includes(x)) && a.righe.filter(x => x === 'Notte: Ryokan Hoshi').length === 2, albergo.filter(x => !a.righe.includes(x)).join(' | ') || 'due notti');
    const tratti = a.righe.filter(x => /^~?\d+ min a piedi · [\d,]+ km$/.test(x));
    ok('2. gli spostamenti fra una tappa e l\'altra, col mezzo e il tempo', tratti.length >= 3, tratti.join(' | '));
    const maps = ['query=34.967,135.772', 'query=35.005,135.765', 'query=34.689,135.84', 'query=35,135.76'];
    ok('2. il link a Google Maps per ogni tappa e per l\'albergo, toccabile', maps.every(m => a.link.some(l => l.startsWith('https://www.google.com/maps/search/?api=1&') && l.includes(m))) && a.righe.filter(x => x === 'Apri in Google Maps').length >= 7,
      a.link.length + ' link: ' + a.link.slice(0, 2).join(' '));
    ok('2. con le opzioni di partenza: le note si\', i costi no, i biglietti si\' (senza codice)',
      a.righe.includes('Note: Assaggiare il tamagoyaki') && !a.righe.some(x => /^Costo: /.test(x)) && !a.righe.includes('Costi') && a.righe.includes('Biglietti') && a.righe.includes('Pass JR') && a.righe.includes(atteso.volo),
      a.righe.filter(x => /Note|Costo|Biglietti|Volo/.test(x)).join(' | '));
    ok('2. cambiando le opzioni: i costi si\' (per tappa e per categoria), le note e i biglietti no',
      b.righe.includes('Costo: 400 ¥') && b.righe.includes('Costi') && b.righe.some(x => /^Totale: 17\.800 ¥$/.test(x)) && !b.righe.some(x => /^Note: /.test(x)) && !b.righe.includes('Biglietti') && !b.righe.includes('Pass JR'),
      b.righe.filter(x => /Costo|Costi|Totale|Note|Biglietti/.test(x)).join(' | '));
    const dappertutto = buf => { const p = leggiPdf(buf); return CODICI.filter(c => buf.toString('latin1').includes(c) || p.flussi.some(f => f.includes(c))); };
    ok('2. i codici dei biglietti non ci sono mai, da nessuna parte del file', !dappertutto(base.buf).length && !dappertutto(conCosti.buf).length, dappertutto(base.buf).concat(dappertutto(conCosti.buf)).join(', ') || 'nessuno');
    /* Le immagini sono solo righe di testo disegnate (basse e larghe): un QR
       sarebbe un quadrato. */
    const quadrate = a.immagini.filter(i => i.h * 1.6 > i.w || i.h > 80);
    ok('2. e nessun QR: le sole immagini sono righe di testo disegnate', a.immagini.length >= 1 && !quadrate.length, a.immagini.map(i => i.w + '×' + i.h).join(', '));
  });

  // ── 3. accenti e giapponese ────────────────────────────────────────────────
  if (fai(3)) await prova('3. accenti e giapponese', async () => {
    if (!pdfBase) throw new Error('il PDF della prova 2 non c\'e\'');
    const a = leggiPdf(pdfBase.buf);
    const accenti = ['Caffè Crème brûlée à Nara', 'Note: Œuvre d’art – 50 €'];
    ok('3. gli accenti, «œ», «’», «–» e «€» sono testo vero del PDF (si cercano e si copiano)', accenti.every(x => a.righe.includes(x)), accenti.filter(x => !a.righe.includes(x)).join(' | ') || accenti.join(' | '));
    ok('3. e niente lettere storpiate (UTF-8 letto a pezzi, segni di sostituzione)', !/Ã|Â|æ¸|þÿ|\uFFFD|\?{2,}/.test(a.testo), (a.testo.match(/Ã.|Â.|æ¸|þÿ|\uFFFD/g) || []).slice(0, 4).join(' '));
    const page = await apriPdf(browser);
    /* La riga col giapponese la disegna il telefono: deve essere nel PDF
       proprio quell'immagine. E i tre ideogrammi, disegnati uno per volta,
       devono essere pieni e diversi fra loro: un carattere che manca diventa
       un quadratino, uguale per tutti. */
    const disegno = await page.evaluate(() => {
      const nome = pdfImmagine('Kiyomizu-dera 清水寺', 10.5, true, PDF_INK), indirizzo = pdfImmagine('京都市東山区清水1丁目294', 9.5, false, PDF_TENUE);
      const c = document.createElement('canvas'); c.width = 64; c.height = 64;
      const g = c.getContext('2d');
      const firma = ch => {
        g.fillStyle = '#fff'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#000'; g.font = '48px ' + PDF_FONT; g.textBaseline = 'alphabetic'; g.fillText(ch, 8, 52);
        const d = g.getImageData(0, 0, 64, 64).data; let s = '', neri = 0;
        for (let i = 0; i < d.length; i += 4) { const n = d[i] < 128; s += n ? 1 : 0; if (n) neri++; }
        return { s, neri };
      };
      const f = ['清', '水', '寺', '\uE000', '\uE001'].map(firma);
      return { nome: nome.data, indirizzo: indirizzo.data, neri: f.slice(0, 3).map(x => x.neri), diversi: f[0].s !== f[1].s && f[1].s !== f[2].s && f[0].s !== f[2].s,
        lontaniDaiQuadratini: f.slice(0, 3).every(x => x.s !== f[3].s), quadratiniUguali: f[3].s === f[4].s };
    });
    await page.close();
    const jpeg = d => Buffer.from(d.split(',')[1], 'base64');
    const dentro = j => a.immagini.some(i => i.filtro === 'DCTDecode' && i.dati.equals(j));
    ok('3. il nome giapponese del posto e il suo indirizzo sono nel PDF, disegnati come li disegna il telefono', dentro(jpeg(disegno.nome)) && dentro(jpeg(disegno.indirizzo)),
      `${a.immagini.length} righe disegnate nel PDF`);
    ok('3. e gli ideogrammi si vedono davvero: pieni, diversi uno dall\'altro, non quadratini', disegno.diversi && disegno.neri.every(n => n > 80) && disegno.lontaniDaiQuadratini,
      `punti neri ${disegno.neri.join(', ')}; diversi ${disegno.diversi}; quadratini dei caratteri mancanti uguali fra loro: ${disegno.quadratiniUguali}`);
    ok('3. senza scaricare nessun carattere: il PDF pesa poco', pdfBase.byte < 300 * 1024, Math.round(pdfBase.byte / 1024) + ' KB');
  });

  // ── 4. il foglio Condividi ─────────────────────────────────────────────────
  if (fai(4)) await prova('4. foglio Condividi', async () => {
    const nomi = {};
    for (const lingua of ['it', 'en', 'fr']) {
      const page = await apriPdf(browser, { lingua });
      const c = await creaPdf(page);
      nomi[lingua] = c;
      if (lingua === 'it') {
        const chiuso = await page.evaluate(() => !document.getElementById('mPdfItin').classList.contains('active'));
        ok('4. «Condividi o salva» apre il foglio Condividi col file, dentro il tocco, e il foglio del PDF si chiude', c.attivo === true && chiuso, JSON.stringify({ attivo: c.attivo, chiuso }));
      }
      await page.close();
    }
    ok('4. il file e\' «Itinerario - Giappone.pdf», un PDF', nomi.it.nome === 'Itinerario - Giappone.pdf' && nomi.it.tipo === 'application/pdf' && nomi.it.buf.slice(0, 5).toString() === '%PDF-', `${nomi.it.nome} · ${nomi.it.tipo}`);
    ok('4. e il nome segue la lingua dell\'app', nomi.en.nome === 'Itinerary - Giappone.pdf' && nomi.fr.nome === 'Itinéraire - Giappone.pdf', `${nomi.en.nome} · ${nomi.fr.nome}`);
    // un nome con caratteri che un file non puo' avere
    const strano = Object.assign(viaggioPdf(), { name: 'Tokyo/Kyoto: "2026"?' });
    const p2 = await apriPdf(browser, { viaggio: strano });
    const c2 = await creaPdf(p2);
    await p2.close();
    ok('4. un nome con «/», «:» o virgolette diventa un nome di file valido', c2.nome === 'Itinerario - Tokyo Kyoto 2026.pdf', c2.nome);
    // senza foglio Condividi per i file: si scarica, con lo stesso nome
    const p3 = await apriPdf(browser, { condividi: false });
    await foglioPdf(p3);
    const tasto = (await p3.textContent('#pdfAzioni button')).trim();
    const [dl] = await Promise.all([p3.waitForEvent('download', { timeout: 8000 }), p3.click('#pdfAzioni button')]);
    const scaricato = fs.readFileSync(await dl.path());
    await p3.close();
    ok('4. dove il foglio Condividi non c\'e\': «Scarica il PDF», con lo stesso nome', tasto === 'Scarica il PDF' && dl.suggestedFilename() === 'Itinerario - Giappone.pdf' && scaricato.slice(0, 5).toString() === '%PDF-', `${tasto} → ${dl.suggestedFilename()}`);
  });

  // ── 5. il calendario che si aggiorna ───────────────────────────────────────
  let db = null;
  const dbServe = fai(5) || fai(6) || fai(7);
  if (dbServe) {
    if (!pgRisponde()) {
      db = { assente: true };
    } else {
      try { preparaDb(); db = { ok: true }; } catch (e) { db = { errore: e.message }; }
    }
  }
  const senzaDb = n => {
    if (db && db.ok) return false;
    const motivo = db && db.errore ? db.errore : 'Postgres non risponde';
    ok(`${n}. il database`, !!(db && db.assente) && !process.env.PROVE_TUTTE, 'saltata: ' + motivo + (process.env.PROVE_TUTTE ? ' (e qui non si può saltare)' : ''));
    return true;
  };

  if (fai(5)) await prova('5. calendario', async () => {
    // dall'app: due tocchi dal menu dei viaggi, poi il link
    semina();
    const page = await apriCloud(browser, ANNA);
    await pronto(page); await scegliLisbona(page);
    await page.waitForTimeout(300);
    await schedaViaggio(page);
    const voce = page.locator('#tripZoomBody button[onclick="apriCalendario()"]');
    /* Dalla Layout 1 il 🗓️ davanti è l'icona a linea del calendario: nel
       testo resta la frase sola, e l'icona si guarda a parte. */
    const scritta = (await voce.innerText()).trim();
    const icona = await voce.locator('use[href="#i-calendario"]').count();
    await voce.click();
    const aperto = await aspetta(page, () => document.getElementById('mCalendario').classList.contains('active') && /Crea il link/.test(document.getElementById('calAzioni').textContent), null, 5000);
    const foglio = await page.evaluate(() => document.querySelector('#mCalendario .sheet').innerText.replace(/\s+/g, ' '));
    ok('5. dal menu dei viaggi in due tocchi: «Viaggio», «Calendario che si aggiorna» (con l\'icona del calendario), col foglio che spiega e avvisa', scritta === 'Calendario che si aggiorna' && icona === 1 && aperto
      && /Chi ha il link vede l'itinerario/.test(foglio) && /si aggiornano da soli/.test(foglio), scritta + ' · ' + foglio.slice(0, 90));
    await page.click('#calAzioni button');
    await aspetta(page, () => !!document.getElementById('calAggiungi'), null, 5000);
    const riga1 = nuvola.t.calendari.filter(x => x.user_id === ANNA);
    const href1 = await page.getAttribute('#calAggiungi', 'href');
    ok('5. «Crea il link»: una riga per Anna e per il viaggio, col codice scelto dal database', riga1.length === 1 && riga1[0].trip_id === 'cid-1' && /^[0-9a-f]{64}$/.test(riga1[0].codice) && riga1[0].lingua === 'it', JSON.stringify(riga1.map(x => ({ trip: x.trip_id, lingua: x.lingua }))));
    ok('5. «Aggiungi al calendario» e\' il link webcal:// della funzione, con quel codice', href1 === `webcal://cyolhqndurgwbivxcssf.supabase.co/functions/v1/calendario/${riga1[0].codice}.ics`, href1);
    await page.evaluate(() => { window.__copiato = null; navigator.clipboard.writeText = async x => { window.__copiato = x; }; });
    await page.click('#calAzioni button[onclick="calCopia()"]');
    await page.waitForTimeout(200);
    const copiato = await page.evaluate(() => window.__copiato);
    ok('5. «Copia il link» copia lo stesso indirizzo in https (per un calendario che il webcal non lo conosce)', copiato === href1.replace('webcal://', 'https://'), String(copiato));
    await page.click('#calAzioni button[onclick="calCrea(true)"]');
    await aspetta(page, h => document.getElementById('calAggiungi') && document.getElementById('calAggiungi').getAttribute('href') !== h, href1, 5000);
    const riga2 = nuvola.t.calendari.filter(x => x.user_id === ANNA), stato2 = await page.textContent('#calStato');
    ok('5. «Crea un link nuovo»: un codice nuovo, e quello di prima non c\'e\' piu\'', riga2.length === 1 && riga2[0].codice !== riga1[0].codice && /quello di prima non funziona più/.test(stato2), stato2);
    await page.click('#calAzioni button[onclick="calSpegni()"]');
    await page.waitForSelector('#mConfirm.active', { timeout: 3000 });
    await page.click('#cfOk');
    await aspetta(page, () => /Crea il link/.test(document.getElementById('calAzioni').textContent), null, 5000);
    const stato3 = await page.textContent('#calStato');
    ok('5. «Disattiva il link», dopo la conferma: la riga se ne va, e il foglio lo dice', nuvola.t.calendari.filter(x => x.user_id === ANNA).length === 0 && /Link disattivato/.test(stato3), stato3);
    // il fuso della destinazione, chiesto una volta e messo nel viaggio
    await sincronizza(page);
    const fuso = await page.evaluate(() => T().fuso), nelCloud = (nuvola.t.trips.find(t => t.id === 'cid-1') || {}).data || {};
    ok('5. il fuso della destinazione (che il meteo non ha ancora) si chiede una volta e va nel viaggio di tutti', fuso === 'Europe/Lisbon' && nelCloud.fuso === 'Europe/Lisbon' && page.__fusi.length === 1, `${fuso} · nel cloud ${nelCloud.fuso} · ${page.__fusi.length} domande`);
    // la lingua del calendario e' quella dell'app di chi ha il link
    await page.evaluate(() => { closeSheet('mCalendario'); calCrea(false); });
    await page.waitForTimeout(400);
    await page.evaluate(() => { app.settings.lingua = 'fr'; save(); apriCalendario(); });
    await page.waitForTimeout(600);
    const lingua = (nuvola.t.calendari.find(x => x.user_id === ANNA) || {}).lingua;
    ok('5. la lingua del calendario segue quella dell\'app (cambiata l\'app, cambia la riga)', lingua === 'fr', String(lingua));
    // senza la tabella nel cloud: lo dice piano, e resta il file .ics
    nuvola.senzaCalendari = true;
    await page.evaluate(() => { app.settings.lingua = 'it'; save(); closeSheet('mCalendario'); apriCalendario(); });
    await page.waitForTimeout(600);
    const manca = await page.evaluate(() => ({ stato: document.getElementById('calStato').textContent, ics: !!document.querySelector('#mCalendario .cal-ics'), tutto: document.querySelector('#mCalendario .sheet').innerText }));
    nuvola.senzaCalendari = false;
    ok('5. se nel cloud il calendario non c\'e\' ancora, il foglio lo dice senza parole tecniche e offre il file .ics', /non è ancora disponibile/.test(manca.stato) && manca.ics && !/supabase|PGRST|schema|tabella|calendari\b|errore/i.test(manca.tutto), manca.stato);
    await page.close();

    // la funzione, col database vero
    if (!regole) { ok('5. la funzione del calendario', false, 'supabase/functions/calendario/regole.mjs non c\'è'); return; }
    if (senzaDb(5)) return;
    const v = viaggioCal();
    const codici = seminaDb(v);
    const url = c => new URL(`https://cyolhqndurgwbivxcssf.supabase.co/calendario/${c}.ics`);
    const ora = new Date(Date.UTC(2026, 9, 20, 10, 0, 0));
    const giusto = await regole.rispondi(url(codici.anna), { leggi: leggiDb, ora });
    const ics = leggiIcs(giusto.corpo || '');
    ok('5. col codice giusto: un calendario (200, text/calendar)', giusto.stato === 200 && /^text\/calendar/.test(giusto.tipo || ''), giusto.stato + ' ' + giusto.tipo);
    ok('5. scritto come vuole iCalendar (CRLF, righe di 75 byte al massimo, eventi chiusi, UID e DTSTAMP, nessun UID doppio)', !ics.guai.length, ics.guai.slice(0, 4).join(' | ') || ics.righe.length + ' righe');
    const dom = `@${VIAGGIO_DB}.geppgo`;
    const attesi = ['tappa-11', 'tappa-12', 'tappa-13', 'tappa-21', 'tappa-31', 'checkin-5', 'checkout-5'];
    ok('5. gli eventi giusti: le tappe con l\'ora, il volo del biglietto (senza ora, tutto il giorno), il check-in e il check-out; non la tappa senza ora',
      JSON.stringify(Object.keys(ics.per).sort()) === JSON.stringify(attesi.slice().sort()) && ics.uid.every(u => u.endsWith(dom)), Object.keys(ics.per).join(', '));
    const e11 = (ics.per['tappa-11'] || { campi: {} }).campi, e12 = ics.per['tappa-12'] || { campi: {} }, e31 = (ics.per['tappa-31'] || { campi: {} }).campi;
    const cin = (ics.per['checkin-5'] || { campi: {} }).campi, cout = (ics.per['checkout-5'] || { campi: {} }).campi;
    ok('5. le ore sono quelle del posto: le 09:30 di Tokyo sono le 00:30 UTC, e l\'evento lo dice anche («Local time»: il link di Anna e\' in inglese)',
      e11.DTSTART === nudo(D[0]) + 'T003000Z' && e11.DTEND === nudo(D[0]) + 'T020000Z' && /Local time: 09:30–11:00 \(Tokyo\)/.test(e11.DESCRIPTION || '') && e11.SUMMARY === 'Fushimi Inari',
      `${e11.DTSTART} → ${e11.DTEND} · ${(e11.DESCRIPTION || '').slice(0, 60)}`);
    ok('5. con il posto (indirizzo, coordinate, link a Google Maps) e il promemoria chiesto nella tappa',
      e11.LOCATION === 'Kyoto' && e11.GEO === '34.967;135.772' && /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=34\.967,135\.772$/.test(e11.URL || '') && !!e12.allarme && e12.allarme.TRIGGER === '-PT30M',
      `${e11.LOCATION} · ${e11.GEO} · promemoria ${e12.allarme && e12.allarme.TRIGGER}`);
    ok('5. il volo senza ora e il check-in senza ora: tutto il giorno; il check-out alle 10:00 di Tokyo',
      e31['DTSTART;VALUE=DATE'] === nudo(D[2]) && cin['DTSTART;VALUE=DATE'] === nudo(D[0]) && cin.SUMMARY === 'Check-in · Ryokan Hoshi' && cout.DTSTART === nudo(D[2]) + 'T010000Z',
      `${e31['DTSTART;VALUE=DATE']} · ${cin['DTSTART;VALUE=DATE']} ${cin.SUMMARY} · ${cout.DTSTART}`);
    ok('5. e niente di privato: non le note, non i codici dei biglietti', !/QX-77|non la deve vedere/.test(giusto.corpo) && !CODICI.some(c => giusto.corpo.includes(c)));
    // senza fuso: l'ora resta quella scritta, dovunque; e col cambio dell'ora legale
    const senzaFuso = leggiIcs(regole.calendarioIcs(Object.assign(copia(v), { fuso: null, weather: {} }), { cid: 'x', ora }));
    const legale = [regole.utcDaLocale('2026-10-24', '09:30', 'Europe/Rome').toISOString(), regole.utcDaLocale('2026-10-25', '09:30', 'Europe/Rome').toISOString()];
    ok('5. se il fuso non si sa, l\'ora resta «del posto» (fluttuante); e il giorno del cambio dell\'ora legale si conta giusto',
      ((senzaFuso.per['tappa-11'] || { campi: {} }).campi.DTSTART === nudo(D[0]) + 'T093000') && legale[0] === '2026-10-24T07:30:00.000Z' && legale[1] === '2026-10-25T08:30:00.000Z',
      `${(senzaFuso.per['tappa-11'] || { campi: {} }).campi.DTSTART} · ${legale.join(' · ')}`);
    // i codici che non devono funzionare
    const prima = letture;
    const sbagliato = await regole.rispondi(url(crypto.randomBytes(32).toString('hex')), { leggi: leggiDb, ora });
    const storto = await regole.rispondi(new URL('https://x.supabase.co/calendario/nonunvero.ics'), { leggi: leggiDb, ora });
    const corto = await regole.rispondi(new URL('https://x.supabase.co/calendario/' + codici.anna.slice(0, 40) + '.ics'), { leggi: leggiDb, ora });
    ok('5. col codice sbagliato niente (404, senza dire perche\'); uno storto o tagliato non arriva nemmeno al database', sbagliato.stato === 404 && storto.stato === 404 && corto.stato === 404 && letture === prima + 1 && !/BEGIN:VCALENDAR/.test(sbagliato.corpo + storto.corpo), `${sbagliato.stato} ${storto.stato} ${corto.stato}, ${letture - prima} letture`);
    const giu = await regole.rispondi(url(codici.anna), { leggi: () => { throw new Error('il database dorme'); }, ora });
    ok('5. se il database non risponde: 503, e il calendario del telefono riprova dopo (tiene quello che aveva)', giu.stato === 503 && !/BEGIN:VCALENDAR/.test(giu.corpo), giu.stato + ' ' + giu.corpo.trim());
    let x = sql([], { input: SONO + `select pg_temp.sono('${UID_ANNA}'); delete from public.calendari where trip_id = '${VIAGGIO_DB}'; reset role;` });
    const spento = await regole.rispondi(url(codici.anna), { leggi: leggiDb, ora }), ancoraBruno = await regole.rispondi(url(codici.bruno), { leggi: leggiDb, ora });
    ok('5. spento il link: il codice vecchio non da\' piu\' niente, e quello del compagno funziona ancora', x.status === 0 && spento.stato === 404 && ancoraBruno.stato === 200, `${spento.stato} · Bruno ${ancoraBruno.stato}`);
    x = sql([], { input: SONO + `select pg_temp.sono('${UID_BRUNO}'); delete from public.trip_members where trip_id = '${VIAGGIO_DB}' and user_id = '${UID_BRUNO}'; reset role;` });
    const uscito = await regole.rispondi(url(codici.bruno), { leggi: leggiDb, ora });
    ok('5. uscito dal viaggio, il link del compagno non da\' piu\' niente', x.status === 0 && uscito.stato === 404, `${uscito.stato}` + (x.status ? ' ' + x.stderr : ''));
  });

  // ── 6. cambiando o togliendo una tappa ─────────────────────────────────────
  if (fai(6)) await prova('6. modifiche', async () => {
    if (!regole) { ok('6. la funzione del calendario', false, 'supabase/functions/calendario/regole.mjs non c\'è'); return; }
    if (senzaDb(6)) return;
    const v = viaggioCal();
    const codici = seminaDb(v);
    const url = new URL(`https://cyolhqndurgwbivxcssf.supabase.co/functions/v1/calendario/${codici.anna}.ics`);
    const ora = new Date(Date.UTC(2026, 9, 20, 10, 0, 0));
    const prima = leggiIcs((await regole.rispondi(url, { leggi: leggiDb, ora })).corpo || '');
    const w = copia(v);
    w.days[0].activities = w.days[0].activities.filter(a => a.id !== 13);                     // tolta
    Object.assign(w.days[0].activities.find(a => a.id === 12), { time: '14:00', timeEnd: '15:00' }); // spostata
    w.days[0].activities.push({ id: 14, name: 'Gion', time: '18:00', timeEnd: '', lat: 35.0037, lng: 135.7788, who: [1, 2], notes: '' });   // nuova
    w.days[0].activities.push({ id: 15, name: 'Check-in · Ryokan Hoshi', time: '15:00', timeEnd: '', hotelId: 5, who: [1, 2], notes: '' }); // il check-in diventa una tappa
    cambiaDb(w);
    const dopo = leggiIcs((await regole.rispondi(url, { leggi: leggiDb, ora })).corpo || '');
    const e12a = (prima.per['tappa-12'] || { campi: {} }).campi, e12b = (dopo.per['tappa-12'] || { campi: {} }).campi;
    ok('6. la tappa spostata e\' lo stesso evento (stesso UID) alla nuova ora', e12a.UID === e12b.UID && e12a.DTSTART === nudo(D[0]) + 'T030000Z' && e12b.DTSTART === nudo(D[0]) + 'T050000Z', `${e12a.DTSTART} → ${e12b.DTSTART}`);
    ok('6. la tappa tolta sparisce dal calendario', !!prima.per['tappa-13'] && !dopo.per['tappa-13']);
    ok('6. quella nuova compare, una volta', !!dopo.per['tappa-14'] && dopo.uid.filter(u => u.startsWith('tappa-14@')).length === 1);
    ok('6. il check-in diventato una tappa non resta anche come evento dell\'albergo (niente doppioni)', !!dopo.per['tappa-15'] && !dopo.per['checkin-5'] && !!prima.per['checkin-5'], Object.keys(dopo.per).join(', '));
    ok('6. nessun UID doppio, e il file resta valido', !dopo.guai.length && new Set(dopo.uid).size === dopo.uid.length, dopo.guai.join(' | ') || dopo.uid.length + ' eventi');
  });

  // ── 7. il database: i codici sono di chi li ha fatti ───────────────────────
  if (fai(7)) await prova('7. database', async () => {
    if (senzaDb(7)) return;
    const res = spawnSync('psql', ['-d', DB, '-q', '-f', path.join(RADICE, 'test', 'supabase-prova-calendario.sql')], { encoding: 'utf8' });
    const uscita = (res.stdout || '') + (res.stderr || '');
    const m = /(\d+)\/(\d+) passati/.exec(uscita);
    const falliti = uscita.split('\n').filter(l => l.includes('FALLITO'));
    const chiave = ['un compagno non vede il link dell\'altro', 'un compagno non crea un link a nome di un altro', 'un estraneo non crea un link per un viaggio non suo', 'e quella del link di un altro no', 'con la chiave pubblica la funzione non si chiama'];
    ok('7. sopra la migrazione lanciata due volte: nessuno legge, crea o cambia i codici di un altro, e da fuori la funzione non si chiama', !!m && m[1] === m[2] && Number(m[2]) >= 20 && !falliti.length && chiave.every(c => uscita.includes(c)),
      m ? m[0] + (falliti.length ? ' — ' + falliti.slice(0, 2).join(' | ') : '') : uscita.trim().split('\n').slice(-3).join(' | '));
    const mig = fs.readFileSync(MIGRAZIONE, 'utf8');
    const sezione = mig.slice(mig.indexOf('-- ═', mig.indexOf('IL CALENDARIO CHE SI AGGIORNA') - 200));
    ok('7. e la migrazione e\' lo stesso testo che sta in fondo allo schema', SCHEMA.includes(sezione.trim()), sezione.length + ' caratteri');
  });
  finisciDb();

  // ── 8. senza account ───────────────────────────────────────────────────────
  if (fai(8)) await prova('8. senza account', async () => {
    const page = await apriPagina(browser, { errori, chiave: 'ics-' + Math.random(), viaggi: [viaggioPdf(), PORTO] });
    await schedaViaggio(page);
    const voci = await page.$$eval('#tripZoomBody button', bs => bs.map(b => b.innerText.trim()));
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), page.click('#tripZoomBody button[onclick="apriCalendario()"]')]);
    const testo = fs.readFileSync(await dl.path(), 'utf8');
    const foglio = await page.evaluate(() => document.getElementById('mCalendario').classList.contains('active'));
    await page.close();
    ok('8. senza account la voce resta «Esporta nel calendario»', voci.includes('Esporta nel calendario') && !voci.includes('Calendario che si aggiorna'), voci.filter(x => /calendario/i.test(x)).join(' | '));
    ok('8. e fa il file .ics di sempre, subito, senza il foglio del link', dl.suggestedFilename() === 'geppgo-giappone.ics' && /^BEGIN:VCALENDAR/.test(testo) && (testo.match(/BEGIN:VEVENT/g) || []).length >= 5 && !foglio,
      `${dl.suggestedFilename()} · ${(testo.match(/BEGIN:VEVENT/g) || []).length} eventi`);
  });

  // ── 9. lingue, schermi, tocchi, axe ────────────────────────────────────────
  if (fai(9)) await prova('9. lingue e schermi', async () => {
    const html = fs.readFileSync(path.join(RADICE, 'Index 2.1.html'), 'utf8');
    const lotto = html.slice(html.indexOf('const DIZIONARIO_ITINERARIO={'), html.indexOf('Object.keys(DIZIONARIO_ITINERARIO)'));
    const chiavi = l => { const a = lotto.indexOf('\n  ' + l + ':{'), b = lotto.indexOf('\n  }', a); return [...lotto.slice(a, b).matchAll(/\n    '((?:[^'\\]|\\.)*)':'((?:[^'\\]|\\.)*)'/g)].map(m => [m[1], m[2]]); };
    const en = chiavi('en');
    const manca = ['es', 'fr', 'pt'].map(l => { const k = new Map(chiavi(l)); return en.filter(([x]) => !k.get(x)).map(([x]) => l + ': ' + x); }).flat();
    ok('9. ogni frase nuova ha la sua traduzione in inglese, spagnolo, francese e portoghese', en.length >= 50 && !manca.length, manca.slice(0, 4).join(' | ') || en.length + ' frasi');
    const CLOUD = "sb=sb||{};session={user:{id:'io',email:'q@x.it'}};T().cid='c1';";
    const SCHERMI = [
      ['scheda del viaggio', 'openTripZoom(1)', '#mTripZoom .sheet'],
      ['scheda del viaggio nel cloud', CLOUD + 'openTripZoom(1)', '#mTripZoom .sheet'],
      ['PDF, le opzioni', 'apriPdfItinerario()', '#mPdfItin .sheet'],
      ['PDF pronto', "apriPdfItinerario();pdfPronto=new File(['%PDF-1.3'],nomeFilePdf(T()),{type:'application/pdf'});pdfMostra('')", '#mPdfItin .sheet'],
      ['PDF senza rete', "apriPdfItinerario();pdfMostra('rete')", '#mPdfItin .sheet'],
      ['calendario senza link', CLOUD + "openSheet('mCalendario');calRiga=null;calMostra('')", '#mCalendario .sheet'],
      ['calendario col link', CLOUD + "openSheet('mCalendario');calRiga={codice:'" + 'a'.repeat(64) + "',lingua:'it'};calMostra('',tv('Link nuovo pronto: quello di prima non funziona più.'))", '#mCalendario .sheet'],
      ['calendario da copiare a mano', CLOUD + "openSheet('mCalendario');calRiga={codice:'" + 'b'.repeat(64) + "',lingua:'it'};calMostra('');navigator.clipboard.writeText=()=>Promise.reject(new Error('no'));copiaConComando=()=>false;calCopia()", '#mCalendario .sheet'],
      ['calendario non ancora disponibile', CLOUD + "openSheet('mCalendario');calMostra('manca')", '#mCalendario .sheet']
    ];
    const ITALIANO = /PDF dell'itinerario|Includi|Senza i codici|Crea il PDF|Condividi o salva|Scarica il PDF|Il PDF è pronto|serve la rete|Calendario che si aggiorna|Chi ha il link|Oppure scarica|Crea il link|Aggiungi al calendario|Copia il link|Crea un link nuovo|Disattiva il link|non è ancora disponibile|Il link non c'è|Un PDF da mandare|Aggiungi il viaggio|Esporta nel calendario|tieni premuto|Link nuovo pronto/;
    const fuori = [], italiano = [], piccoli = [], axeGuai = [];
    for (const lingua of LINGUE) {
      for (const [larghezza, tema] of [[320, 'chiaro'], [430, 'scuro'], [390, lingua === 'it' ? 'scuro' : 'chiaro']]) {
        const page = await apriPagina(browser, { lingua, larghezza, tema, errori, chiave: 'schermi-' + Math.random(), viaggi: [viaggioPdf(), PORTO] });
        for (const [nome, js, sel] of SCHERMI) {
          await page.evaluate(() => { document.querySelectorAll('.modal.active').forEach(m => closeSheet(m.id)); session = null; delete T().cid; });
          await page.waitForTimeout(250);
          await page.evaluate(js);
          await page.waitForTimeout(400);
          await page.evaluate(() => document.querySelectorAll('.prox.avv,.toast').forEach(e => e.remove()));
          const m = await page.evaluate(s => {
            const radice = document.querySelector(s);
            if (!radice || !radice.getClientRects().length) return { manca: true };
            const W = innerWidth, guai = [], piccoli = [];
            if (radice.scrollWidth > radice.clientWidth + 1) guai.push('il foglio scorre di lato: ' + radice.scrollWidth + ' > ' + radice.clientWidth);
            radice.querySelectorAll('*').forEach(el => {
              const r2 = el.getBoundingClientRect();
              if (!r2.width || !el.getClientRects().length || el.closest('.leaflet-pane,.leaflet-control-container')) return;
              if (r2.right > W + 1 || r2.left < -1) guai.push('fuori: ' + (el.id || el.className || el.tagName) + ' ' + Math.round(r2.left) + '–' + Math.round(r2.right));
              const st = getComputedStyle(el);
              if ((st.overflow === 'hidden' || st.textOverflow === 'ellipsis') && el.scrollWidth > el.clientWidth + 1 && el.children.length === 0 && el.textContent.trim()) guai.push('tagliato: ' + el.textContent.trim().slice(0, 30));
            });
            /* i tasti nuovi: 44 px al tocco (la ✕ dei fogli ha la sua area, provata in prova-accessibilita) */
            radice.querySelectorAll('#pdfAzioni .btn,.pdf-opz,#calAzioni .btn,.cal-ics,#tripZoomBody button[onclick="apriPdfItinerario()"],#tripZoomBody button[onclick="apriCalendario()"]').forEach(el => {
              const r2 = el.getBoundingClientRect();
              if (r2.height < 43.5 || r2.width < 43.5) piccoli.push((el.id || el.className) + ' ' + Math.round(r2.width) + '×' + Math.round(r2.height));
            });
            if (document.scrollingElement.scrollWidth > W + 1) guai.push('la pagina scorre di lato');
            return { guai, piccoli, testo: radice.innerText };
          }, sel);
          if (m.manca) { fuori.push(`${lingua} ${larghezza} ${nome}: non c'e'`); continue; }
          m.guai.forEach(g => fuori.push(`${lingua} ${larghezza} ${tema} ${nome}: ${g}`));
          m.piccoli.forEach(g => piccoli.push(`${lingua} ${larghezza} ${nome}: ${g}`));
          if (lingua !== 'it') {
            const it = (m.testo.replace(/Giappone|Tokyo|Zelda|Yuri|Ximena/g, '').match(ITALIANO) || [])[0];
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
    ok('9. le schermate nuove nelle cinque lingue, senza italiano rimasto', !italiano.length, italiano.slice(0, 4).join(' | ') || '5 lingue, ' + SCHERMI.length + ' schermate');
    ok('9. niente fuori schermo e niente tagliato, da 320 a 430 px, nel tema chiaro e in quello scuro', !fuori.length, fuori.slice(0, 4).join(' | ') || 'tutto dentro');
    ok('9. i tasti nuovi rispondono su 44 px', !piccoli.length, piccoli.slice(0, 4).join(' | ') || 'tutti');
    ok('9. nessuna violazione grave o critica di axe, nei due temi', !axeGuai.length, axeGuai.slice(0, 4).join(' | ') || 'nessuna');
  });

  const rumore = e => /Failed to load resource|net::ERR_/.test(e);
  ok('nessun errore nelle pagine', !errori.filter(e => !rumore(e)).length, errori.filter(e => !rumore(e)).slice(0, 3).join(' | '));
  console.log('\n' + r.join('\n'));
  const falliti = r.filter(x => x.includes('FALLITO')).length;
  console.log(`\n${r.length - falliti}/${r.length} passati`);
  await browser.close();
  process.exit(falliti ? 1 : 0);
})();
