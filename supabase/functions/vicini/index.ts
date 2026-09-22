/* IL PONTE FRA L'APP E LA MAPPA.
 *
 * PERCHE' ESISTE. Overpass e Nominatim sono tenuti su da volontari, e le
 * loro regole dicono la stessa cosa: un'app diffusa non deve chiamarli da
 * ogni telefono. Con l'app sullo store sarebbero migliaia di telefoni che
 * bussano alla stessa porta, ognuno con la sua identita', e la porta si
 * chiude - per tutti, non solo per chi ha esagerato.
 *
 * Qui in mezzo cambia tutto:
 *
 *  1. LA MEMORIA E' DI TUTTI. La risposta si tiene da parte una volta sola.
 *     Chi cerca un bagno a Muggio' dopo di te non fa nessuna chiamata:
 *     legge la tua. In una citta' dove l'app la usano in cento, le chiamate
 *     verso l'esterno non sono cento - sono una.
 *
 *  2. VERSO OVERPASS SIAMO UNO SOLO. Una identita', con un nome e un
 *     contatto nell'intestazione, che e' quello che le loro regole chiedono
 *     e che da dentro un browser non si puo' nemmeno fare: il telefono non
 *     puo' scrivere il proprio User-Agent, questa funzione si'.
 *
 *  3. IL GIORNO CHE SI CAMBIA FORNITORE, SI CAMBIA QUI. Se un domani si
 *     passa a un servizio a pagamento, si riscrive questo file e basta:
 *     l'app non se ne accorge e non serve pubblicare una versione nuova.
 *
 * COSA VEDE E COSA NON VEDE. Arriva la domanda gia' scritta dal telefono,
 * con il centro ARROTONDATO a una griglia di circa duecento metri - e' il
 * telefono a farlo, prima di mandarla, perche' due persone nello stesso
 * isolato facciano la stessa identica domanda e la seconda la trovi gia'
 * pronta. Quindi qui non arriva mai dove sei di preciso, e non arriva
 * niente che dica chi sei: nessun nome, nessun conto, nessun identificativo.
 * Non si scrive nessun registro di chi ha chiesto cosa.
 */

/* La regola che dice quali domande si possono inoltrare sta in un file a
   se', importato anche dalla prova: qui non c'e' Deno, e una regola di
   sicurezza che non si riesce a provare e' una regola di cui non si sa
   niente. Vedi test/prova-ponte.js. */
import { domandaAmmessa } from './domanda.mjs';

const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.osm.jp/api/interpreter',
  'https://overpass.osm.ch/api/interpreter',
];

/* Chi siamo, per chi ospita il servizio. Le regole di OpenStreetMap
   chiedono di potersi rivolgere a qualcuno quando qualcosa va storto. */
const CHI_SIAMO = 'GeppGo/1.0 (app di viaggio; merati.giacomo94@gmail.com)';

/* Quanto si tiene una risposta. Un bagno non si sposta e un bancomat
   nemmeno: una settimana e' prudente, non spericolato. Le risposte VUOTE
   si tengono molto meno - "qui non c'e' niente" e' la risposta che
   qualcuno potrebbe aver appena smentito mettendo il posto sulla mappa. */
const GIORNI = 7;
const ORE_VUOTO = 6;

async function impronta(q: string): Promise<string> {
  const dati = new TextEncoder().encode(q);
  const somma = await crypto.subtle.digest('SHA-256', dati);
  return [...new Uint8Array(somma)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/* Si chiede a un server alla volta, passando al prossimo quando uno cade.
   Qui non c'e' fretta come sul telefono: siamo noi soli, e una richiesta in
   piu' da un server e' molto meno peso di una richiesta in piu' da mille
   telefoni. */
async function chiediAOverpass(q: string): Promise<unknown> {
  let ultimo: unknown = null;
  for (const url of OVERPASS) {
    try {
      const ctrl = new AbortController();
      const taglia = setTimeout(() => ctrl.abort(), 25000);
      const res = await fetch(url, {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': CHI_SIAMO,
        },
        body: 'data=' + encodeURIComponent(q),
      });
      clearTimeout(taglia);
      if (!res.ok) { ultimo = new Error(res.status + ' da ' + new URL(url).host); continue; }
      return await res.json();
    } catch (e) { ultimo = e; }
  }
  throw ultimo ?? new Error('nessun server della mappa ha risposto');
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
    const { q } = await req.json();
    const guaio = domandaAmmessa(q);
    if (guaio) return rispondi({ errore: 'domanda non ammessa: ' + guaio }, 400);

    const chiave = await impronta(q);
    const URL_DB = Deno.env.get('SUPABASE_URL');
    const CHIAVE_DB = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const testa = {
      'apikey': CHIAVE_DB ?? '',
      'Authorization': 'Bearer ' + (CHIAVE_DB ?? ''),
      'Content-Type': 'application/json',
    };

    /* 1. Qualcuno l'ha gia' chiesta? */
    if (URL_DB && CHIAVE_DB) {
      try {
        const r = await fetch(
          `${URL_DB}/rest/v1/vicini_cache?chiave=eq.${chiave}&select=risposta,quando`,
          { headers: testa });
        const righe = await r.json();
        if (Array.isArray(righe) && righe.length) {
          const eta = Date.now() - new Date(righe[0].quando).getTime();
          const quanti = (righe[0].risposta?.elements ?? []).length;
          const scadenza = quanti ? GIORNI * 86400000 : ORE_VUOTO * 3600000;
          if (eta < scadenza) return rispondi({ ...righe[0].risposta, da: 'memoria' });
        }
      } catch (_) { /* la memoria e' un aiuto, non un obbligo */ }
    }

    /* 2. No: si chiede fuori, una volta sola per tutti. */
    const dati = await chiediAOverpass(q);

    /* 3. E si tiene da parte per chi viene dopo. */
    if (URL_DB && CHIAVE_DB) {
      try {
        await fetch(`${URL_DB}/rest/v1/vicini_cache`, {
          method: 'POST',
          headers: { ...testa, 'Prefer': 'resolution=merge-duplicates' },
          body: JSON.stringify({ chiave, risposta: dati, quando: new Date().toISOString() }),
        });
      } catch (_) { /* se non si riesce a ricordare, pazienza: la risposta c'e' */ }
    }
    return rispondi({ ...(dati as Record<string, unknown>), da: 'overpass' });
  } catch (e) {
    return rispondi({ errore: String((e as Error)?.message ?? e) }, 502);
  }
});
