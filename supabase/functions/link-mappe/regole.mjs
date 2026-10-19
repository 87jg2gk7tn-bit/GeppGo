/* I LINK CORTI DI GOOGLE MAPS: QUALI SI APRONO, E COME.
 *
 * PERCHE' SERVE UN SERVER. Il tasto «Condividi» di Google Maps su iPhone da'
 * un link come https://maps.app.goo.gl/AbCd1234: dentro non c'e' nessuna
 * coordinata, e l'indirizzo vero si scopre solo seguendo il rimando. Dal
 * telefono non si puo': il browser non lascia leggere dove rimanda un altro
 * dominio. Qui lo segue una funzione nostra, che restituisce l'indirizzo
 * finale; le coordinate (o il nome del posto) le legge poi l'app.
 *
 * PERCHE' COSI' STRETTO. Una funzione che segue i rimandi per conto di
 * chiunque e' un modo comodo per far arrivare traffico a qualunque sito con
 * la nostra faccia, o per far guardare al nostro server dentro posti dove non
 * deve guardare. Quindi: si parte solo da un link di Google Maps, si segue un
 * rimando solo se porta ancora dentro Google Maps (controllato a ogni passo,
 * non solo all'inizio), e un rimando che esce non si segue — nemmeno per
 * vedere cosa c'e'.
 *
 * Sta in un file a se' perche' qui non c'e' Deno e la funzione non si puo'
 * lanciare per provarla: cosi' le regole sono UNE, le usa il server e le
 * prova Node (test/prova-installazione.js), e non possono divergere. Anche
 * `segui` e' qui, con la `fetch` passata da fuori: le prove le danno un
 * Google finto, il server quello vero. */

/* Otto secondi per tutto il giro, rimandi compresi: oltre, chi ha incollato
   il link sta guardando un telefono fermo. L'app aspetta un poco di piu'
   (vedi apriLinkCorto), cosi' arriva prima la risposta «tempo scaduto» del
   server che il suo silenzio. */
export const TEMPO_MAX_MS = 8000;
/* Un link corto di Google arriva in uno o due rimandi, tre con la pagina dei
   consensi: sei e' gia' largo. Oltre, e' un giro che non finisce. */
export const RIMANDI_MAX = 6;
export const LUNGHEZZA_MAX = 2000;
/* Quante richieste. Una persona incolla un link ogni tanto; trenta in dieci
   minuti dallo stesso posto non e' una persona. E un tetto per tutti
   insieme, per lo stesso motivo. I conti stanno nella memoria della
   funzione: niente si scrive, e quando la funzione si spegne si
   dimenticano (vedi nuovoLimite). */
export const LIMITE = { finestraMs: 10 * 60 * 1000, perChi: 30, perTutti: 600 };

const GOOGLE = /^(?:www\.|maps\.)?google\.(?:com|[a-z]{2}|co\.[a-z]{2}|com\.[a-z]{2})$/;
const CONSENSO = /^consent\.google\.(?:com|[a-z]{2}|co\.[a-z]{2}|com\.[a-z]{2})$/;

function comeUrl(u) {
  if (u instanceof URL) return u;
  try { return new URL(String(u)); } catch (_) { return null; }
}

/* Che cosa e' un indirizzo: 'corto' (il link da seguire), 'mappa' (Google
   Maps vero e proprio), 'consenso' (la pagina dei consensi europei, da cui si
   legge solo dove voleva andare), oppure niente. */
export function tipoDiIndirizzo(u) {
  const url = comeUrl(u);
  if (!url || (url.protocol !== 'https:' && url.protocol !== 'http:')) return null;
  const host = url.hostname.toLowerCase(), strada = url.pathname;
  if (host === 'maps.app.goo.gl') return /^\/[A-Za-z0-9_-]+\/?$/.test(strada) ? 'corto' : null;
  if (host === 'goo.gl') return /^\/maps\/[A-Za-z0-9_-]+\/?$/.test(strada) ? 'corto' : null;
  if (CONSENSO.test(host)) return 'consenso';
  if (GOOGLE.test(host)) {
    if (host.startsWith('maps.')) return 'mappa';
    return (strada === '/maps' || strada.startsWith('/maps/')) ? 'mappa' : null;
  }
  return null;
}

/* Niente credenziali infilate nell'indirizzo, niente porte strane: sono i
   due modi per far sembrare Google qualcos'altro. */
function vizi(url) {
  if (url.username || url.password) return 'ha delle credenziali dentro';
  if (url.port) return 'ha una porta sua';
  return null;
}

function normalizza(u) {
  const url = comeUrl(u);
  if (!url) return null;
  if (url.protocol === 'http:') url.protocol = 'https:';
  url.hash = '';
  return url.toString();
}

/* Il link da cui si parte. Torna null se va bene, altrimenti il motivo. */
export function linkAmmesso(u) {
  if (typeof u !== 'string') return 'non e\' testo';
  if (u.length > LUNGHEZZA_MAX) return 'troppo lungo';
  const url = comeUrl(u);
  if (!url) return 'non e\' un indirizzo';
  if (url.protocol !== 'https:') return 'non e\' https';
  const tipo = tipoDiIndirizzo(url);
  if (tipo !== 'corto' && tipo !== 'mappa') return 'non e\' un link di Google Maps';
  return vizi(url);
}

/* LA PAGINA DEI CONSENSI. Dall'Europa, Google manda chi arriva senza i suoi
   biscotti a consent.google.com, con l'indirizzo che voleva aprire nel
   parametro «continue». Quello e' l'indirizzo vero: lo si legge e ci si
   ferma li'. Non si accetta niente a nome di nessuno, e il controllo e' lo
   stesso di ogni altro passo: se «continue» porta fuori da Google Maps, non
   lo si segue. */
export function dalConsenso(u) {
  const url = comeUrl(u);
  if (!url || tipoDiIndirizzo(url) !== 'consenso') return null;
  const vero = comeUrl(url.searchParams.get('continue') || '');
  if (!vero || vizi(vero)) return null;
  const tipo = tipoDiIndirizzo(vero);
  return tipo === 'mappa' || tipo === 'corto' ? normalizza(vero) : null;
}

/* Le coordinate ci sono gia'? Allora non serve chiedere altro a Google. Le
   legge davvero l'app (coordDaLink): qui basta sapere se ci sono. */
export function haCoordinate(u) {
  let s = String(u || '');
  try { s = decodeURIComponent(s); } catch (_) { /* resta com'e' */ }
  return /!3d-?\d+(?:\.\d+)?!4d-?\d+(?:\.\d+)?/.test(s)
    || /@-?\d{1,2}\.\d+,-?\d{1,3}\.\d+/.test(s)
    || /[?&](?:q|query|ll|sll|center|daddr|destination)=-?\d{1,2}\.\d+\s*,\s*\+?-?\d{1,3}\.\d+/i.test(s)
    || /\/(?:search|place|dir)\/-?\d{1,2}\.\d+\s*,\s*\+?-?\d{1,3}\.\d+/i.test(s);
}

/* UNA PAGINA DI PASSAGGIO invece del rimando. Secondo chi chiede, il link
   corto puo' rispondere con una pagina che rimanda da se' (un meta refresh,
   un indirizzo scritto dentro). Si cerca li' dentro il primo indirizzo di
   Google Maps, con lo stesso controllo dei rimandi veri. */
export function linkNelTesto(testo, base) {
  const pulito = String(testo || '')
    .replace(/\\u0026/gi, '&').replace(/\\u003d/gi, '=').replace(/\\\//g, '/').replace(/&amp;/g, '&');
  const candidati = [];
  const meta = pulito.match(/http-equiv=["']?refresh["']?[^>]*?content=["']?\s*\d+\s*;\s*url=([^"'>\s]+)/i);
  if (meta) candidati.push(meta[1]);
  for (const m of pulito.matchAll(/https?:\/\/[a-z0-9.-]+\/[^\s"'<>\\]*/gi)) candidati.push(m[0]);
  for (const c of candidati) {
    let url;
    try { url = new URL(c, base); } catch (_) { continue; }
    if (vizi(url)) continue;
    const tipo = tipoDiIndirizzo(url);
    if (tipo === 'mappa') return normalizza(url);
    if (tipo === 'consenso') { const vero = dalConsenso(url); if (vero) return vero; }
  }
  return null;
}

function guaio(codice, dettaglio) {
  const e = new Error(dettaglio || codice);
  e.codice = codice;
  return e;
}

function lascia(res) {
  try { if (res && res.body && res.body.cancel) res.body.cancel().catch(() => {}); } catch (_) { /* gia' chiusa */ }
}

async function leggiInizio(res, max) {
  if (!res.body || !res.body.getReader) {
    try { return (await res.text()).slice(0, max); } catch (_) { return ''; }
  }
  const lettore = res.body.getReader();
  const pezzi = [];
  let n = 0;
  try {
    while (n < max) {
      const { done, value } = await lettore.read();
      if (done) break;
      pezzi.push(value);
      n += value.length;
    }
  } finally {
    try { await lettore.cancel(); } catch (_) { /* gia' chiusa */ }
  }
  const tutto = new Uint8Array(n);
  let i = 0;
  for (const p of pezzi) { tutto.set(p, i); i += p.length; }
  return new TextDecoder().decode(tutto).slice(0, max);
}

/* SEGUIRE I RIMANDI, uno alla volta e a mano (redirect: 'manual'): se lo
   facesse la fetch da sola, arriverebbe in fondo prima che si possa guardare
   dove sta andando. Torna { url } con l'indirizzo finale, oppure un errore con
   .codice: 'non_ammesso', 'tempo', 'rete', 'non_leggibile'. */
export async function segui(inizio, opzioni = {}) {
  const chiedi = opzioni.fetch;
  const tempoMax = opzioni.tempoMax || TEMPO_MAX_MS;
  const rimandiMax = opzioni.rimandiMax || RIMANDI_MAX;
  const testa = opzioni.testa || {};
  const motivo = linkAmmesso(inizio);
  if (motivo) throw guaio('non_ammesso', motivo);
  const stop = new AbortController();
  let scaduto = false;
  const taglia = setTimeout(() => { scaduto = true; stop.abort(); }, tempoMax);
  const visti = new Set();
  let attuale = normalizza(inizio);
  try {
    for (let passo = 0; passo <= rimandiMax; passo++) {
      if (visti.has(attuale)) break;
      visti.add(attuale);
      if (tipoDiIndirizzo(attuale) === 'mappa' && haCoordinate(attuale)) return { url: attuale };
      let res;
      try {
        res = await chiedi(attuale, { method: 'GET', redirect: 'manual', signal: stop.signal, headers: testa });
      } catch (e) {
        throw guaio(scaduto ? 'tempo' : 'rete', String((e && e.message) || e));
      }
      const dove = res.headers.get('location');
      if (res.status >= 300 && res.status < 400 && dove) {
        lascia(res);
        let prossimo;
        try { prossimo = new URL(dove, attuale); } catch (_) { throw guaio('non_leggibile', 'un rimando che non si legge'); }
        const tipo = tipoDiIndirizzo(prossimo);
        if (tipo === 'consenso') {
          const vero = dalConsenso(prossimo);
          if (!vero) throw guaio('non_ammesso', 'la pagina dei consensi porta fuori da Google Maps');
          if (tipoDiIndirizzo(vero) === 'mappa') return { url: vero, consenso: true };
          attuale = vero;
          continue;
        }
        if (!tipo || vizi(prossimo)) throw guaio('non_ammesso', 'rimanda fuori da Google Maps: ' + prossimo.hostname);
        attuale = normalizza(prossimo);
        continue;
      }
      if (res.ok && tipoDiIndirizzo(attuale) === 'corto') {
        const dentro = linkNelTesto(await leggiInizio(res, 65536), attuale);
        if (dentro && !visti.has(dentro)) { attuale = dentro; continue; }
      } else {
        lascia(res);
      }
      /* Il link corto non ha portato da nessuna parte: scaduto, sbagliato, o
         una pagina che non dice dove andare. */
      if (tipoDiIndirizzo(attuale) === 'corto') throw guaio('non_leggibile', 'il link corto non rimanda a Google Maps (' + res.status + ')');
      return { url: attuale };
    }
    throw guaio('non_leggibile', 'troppi rimandi');
  } catch (e) {
    if (scaduto && (!e.codice || e.codice === 'rete')) throw guaio('tempo', 'oltre ' + tempoMax + ' ms');
    throw e;
  } finally {
    clearTimeout(taglia);
  }
}

/* IL LIMITE DI RICHIESTE, nella memoria della funzione: per ognuno (la
   chiave e' l'indirizzo da cui arriva la richiesta) e per tutti insieme. Non
   si scrive da nessuna parte, e un indirizzo che non chiede piu' niente
   esce dalla memoria. E' un limite per istanza: se Supabase ne accende due,
   i conti si fanno due volte. Per fermare chi esagera basta lo stesso, ed e'
   una cosa semplice e vera invece di una complicata che non si puo'
   provare. */
export function nuovoLimite(regole = LIMITE) {
  const perChi = new Map();
  let tutti = [];
  return function conta(chiave, adesso = Date.now()) {
    const dopo = adesso - regole.finestraMs;
    tutti = tutti.filter(t => t > dopo);
    const mie = (perChi.get(chiave) || []).filter(t => t > dopo);
    if (mie.length >= regole.perChi || tutti.length >= regole.perTutti) {
      if (mie.length) perChi.set(chiave, mie); else perChi.delete(chiave);
      return false;
    }
    mie.push(adesso);
    tutti.push(adesso);
    perChi.set(chiave, mie);
    if (perChi.size > 5000) {
      for (const [k, v] of perChi) if (!v.some(t => t > dopo)) perChi.delete(k);
    }
    return true;
  };
}
