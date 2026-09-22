/* IL PONTE PER GLI INDIRIZZI: Nominatim e Photon.
 *
 * PERCHE' E' PIU' URGENTE DELL'ALTRO. Nominatim e' usato in diciassette punti
 * dell'app - la ricerca degli hotel, gli indirizzi, la citta' di ogni viaggio,
 * la valuta - e le sue regole sono piu' strette di quelle di Overpass: UNA
 * richiesta al secondo, e l'uso da parte di app diffuse esplicitamente
 * sconsigliato. Con l'app sullo store sarebbe il primo a chiudersi, e con lui
 * se ne andrebbe la ricerca degli alberghi.
 *
 * E QUI LA MEMORIA CONDIVISA VALE ANCORA DI PIU'. Una ricerca vicina e' legata
 * a un posto; un indirizzo no: "Colosseo, Roma" e' la stessa domanda per
 * chiunque al mondo, oggi e fra un mese. La prima persona che lo cerca lo
 * cerca per tutte le altre. Un albergo non si sposta: le risposte si tengono
 * un mese.
 *
 * COSA NON ARRIVA QUI. Le ricerche per testo sono testo, e basta. Quelle per
 * coordinate (dov'e' questo punto) arrivano con la posizione gia' ARROTONDATA
 * dal telefono a circa duecento metri - e qui si ricontrolla che lo sia
 * davvero, invece di fidarsi: se un domani l'app smettesse di arrotondare, il
 * ponte lo rifiuterebbe invece di inoltrare la posizione esatta.
 * Non arriva nessun nome, nessun conto, nessun identificativo, e non si
 * scrive nessun registro di chi ha chiesto cosa.
 */

import { indirizzoAmmesso, posizioneArrotondata } from './domanda.mjs';

/* Chi siamo. Per Nominatim non e' una cortesia: le loro regole chiedono un
   User-Agent che identifichi l'applicazione, e chi non ce l'ha viene
   bloccato. Da dentro un browser non si puo' scrivere - il telefono non puo'
   cambiare il proprio User-Agent - quindi questa e' una cosa che SOLO il
   ponte puo' fare. */
const CHI_SIAMO = 'GeppGo/1.0 (app di viaggio; merati.giacomo94@gmail.com)';

/* Un indirizzo non si sposta. Un mese e' prudente. Le risposte vuote molto
   meno: "non trovato" e' quello che cambia quando qualcuno mette il posto
   sulla mappa. */
const GIORNI = 30;
const ORE_VUOTO = 12;

/* IL RITMO. Nominatim chiede al massimo una richiesta al secondo. Quasi tutte
   le richieste non arrivano mai qui - le serve la memoria - ma quelle che
   passano si mettono in fila una dietro l'altra, con un secondo e un decimo
   di distanza. E' una fila per istanza, non per il mondo intero: se Supabase
   ne accende due, i secondi si contano due volte. Con la memoria davanti il
   margine e' talmente ampio che resta prudente lo stesso, e si preferisce
   una cosa semplice e vera a una complicata che non si puo' provare. */
const PASSO_MS = 1100;
let fila: Promise<unknown> = Promise.resolve();
function inFila<T>(lavoro: () => Promise<T>): Promise<T> {
  const mio = fila.then(lavoro);
  fila = mio.then(
    () => new Promise(r => setTimeout(r, PASSO_MS)),
    () => new Promise(r => setTimeout(r, PASSO_MS)));
  return mio;
}

async function impronta(s: string): Promise<string> {
  const somma = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(somma)].map(b => b.toString(16).padStart(2, '0')).join('');
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const rispondi = (corpo: unknown, stato = 200) =>
    new Response(JSON.stringify(corpo), {
      status: stato,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  try {
    const { url } = await req.json();
    const guaio = indirizzoAmmesso(url);
    if (guaio) return rispondi({ errore: 'indirizzo non ammesso: ' + guaio }, 400);
    if (!posizioneArrotondata(url))
      return rispondi({ errore: 'la posizione non e\' arrotondata' }, 400);

    const chiave = 'geo:' + await impronta(url);
    const URL_DB = Deno.env.get('SUPABASE_URL');
    const CHIAVE_DB = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const testa = {
      'apikey': CHIAVE_DB ?? '',
      'Authorization': 'Bearer ' + (CHIAVE_DB ?? ''),
      'Content-Type': 'application/json',
    };

    /* 1. L'ha gia' chiesto qualcuno? Per un indirizzo, "qualcuno" vuol dire
          chiunque al mondo: "Colosseo, Roma" e' la stessa domanda per tutti. */
    if (URL_DB && CHIAVE_DB) {
      try {
        const r = await fetch(
          `${URL_DB}/rest/v1/vicini_cache?chiave=eq.${chiave}&select=risposta,quando`,
          { headers: testa });
        const righe = await r.json();
        if (Array.isArray(righe) && righe.length) {
          const eta = Date.now() - new Date(righe[0].quando).getTime();
          const dentro = righe[0].risposta?.dati;
          const vuoto = !dentro || (Array.isArray(dentro) ? !dentro.length
            : !(dentro.features?.length));
          if (eta < (vuoto ? ORE_VUOTO * 3600000 : GIORNI * 86400000))
            return rispondi({ dati: dentro, da: 'memoria' });
        }
      } catch (_) { /* la memoria e' un aiuto, non un obbligo */ }
    }

    /* 2. No: si chiede fuori, in fila, una volta sola per tutti. */
    const dati = await inFila(async () => {
      const ctrl = new AbortController();
      const taglia = setTimeout(() => ctrl.abort(), 20000);
      try {
        const res = await fetch(url, {
          signal: ctrl.signal,
          headers: { 'User-Agent': CHI_SIAMO, 'Accept-Language': 'it,en' },
        });
        if (!res.ok) throw new Error(res.status + ' da ' + new URL(url).hostname);
        return await res.json();
      } finally { clearTimeout(taglia); }
    });

    /* 3. E si tiene da parte per chi viene dopo. */
    if (URL_DB && CHIAVE_DB) {
      try {
        await fetch(`${URL_DB}/rest/v1/vicini_cache`, {
          method: 'POST',
          headers: { ...testa, 'Prefer': 'resolution=merge-duplicates' },
          body: JSON.stringify({ chiave, risposta: { dati }, quando: new Date().toISOString() }),
        });
      } catch (_) { /* se non si riesce a ricordare, pazienza */ }
    }
    return rispondi({ dati, da: 'nominatim' });
  } catch (e) {
    return rispondi({ errore: String((e as Error)?.message ?? e) }, 502);
  }
});
