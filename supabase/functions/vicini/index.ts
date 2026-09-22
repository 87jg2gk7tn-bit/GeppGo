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
import { domandaAmmessa, PONTE_ATTESA_SERVER_MS, PONTE_BUDGET_MS } from './domanda.mjs';
/* Le decisioni sulla memoria stanno anche loro in un file a se', e per un
   motivo in piu': una sbagliata non fa rumore. Scambiare il segnale «ci sto
   lavorando» per una risposta vuota vorrebbe dire dire «non c'e' niente» a
   tutti per sei ore, senza nessun errore da nessuna parte. Vedi
   test/prova-memoria.js. */
import { cheFarne, rispostaAttendibile, SEGNALE, PONTE_SOTTOFONDO_MS } from './memoria.mjs';

/* I SERVER DELLA MAPPA. Erano cinque; due sono stati tolti dopo averli
   interrogati uno per uno (il workflow «Il ponte risponde?»):
   - overpass.osm.ch rispondeva in sei decimi di secondo, senza errori, con
     la lista VUOTA: il suo database era vuoto. Essendo il piu' veloce
     vinceva ogni corsa, quindi la risposta che arrivava era sempre la sua —
     «qui non c'e' niente», per qualunque cosa si cercasse;
   - overpass.osm.jp ha un certificato che non si verifica, quindi da qui non
     si raggiunge affatto.
   Tenerli costava ricerche vere. Se un domani tornano a posto, si rimettono.
   Il controllo su `rispostaAttendibile` resta comunque, perche' la prossima
   volta il server che si guasta sara' un altro. */
const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

/* Chi siamo, per chi ospita il servizio. Le regole di OpenStreetMap
   chiedono di potersi rivolgere a qualcuno quando qualcosa va storto. */
const CHI_SIAMO = 'GeppGo/1.0 (app di viaggio; merati.giacomo94@gmail.com)';

async function impronta(q: string): Promise<string> {
  const dati = new TextEncoder().encode(q);
  const somma = await crypto.subtle.digest('SHA-256', dati);
  return [...new Uint8Array(somma)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/* Una domanda a UN server, con un tempo massimo. */
async function unServer(url: string, q: string, attesa: number): Promise<unknown> {
  const ctrl = new AbortController();
  const taglia = setTimeout(() => ctrl.abort(), attesa);
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': CHI_SIAMO,
      },
      body: 'data=' + encodeURIComponent(q),
    });
    if (!res.ok) throw new Error(res.status + ' da ' + new URL(url).host);
    const d = await res.json();
    /* Un «non c'e' niente» si crede solo a chi sa dire di quando sono i suoi
       dati: vedi memoria.mjs. Chi non lo sa dire non ha risposto, ha solo
       detto qualcosa — e si passa al prossimo. */
    if (!rispostaAttendibile(d)) throw new Error('database vuoto su ' + new URL(url).host);
    return d;
  } finally { clearTimeout(taglia); }
}

/* Si chiede a un server alla volta, passando al prossimo quando uno cade.
 *
 * IL PONTE DEVE STARE DENTRO LA PAZIENZA DEL TELEFONO. Prima provava cinque
 * server da venticinque secondi l'uno, in fila: fino a due minuti, mentre il
 * telefono lo aspettava ventuno. Cosi' il ponte perdeva SEMPRE quando la
 * mappa arrancava - proprio il caso per cui esiste - e il telefono tornava a
 * chiamare da solo.
 */
async function chiediAOverpass(q: string): Promise<unknown> {
  let ultimo: unknown = null;
  const inizio = Date.now();
  for (const url of OVERPASS) {
    if (Date.now() - inizio > PONTE_BUDGET_MS) break;
    try { return await unServer(url, q, PONTE_ATTESA_SERVER_MS); }
    catch (e) { ultimo = e; }
  }
  throw ultimo ?? new Error('nessun server della mappa ha risposto');
}

/* E QUANDO NON CE LA FA DENTRO QUEL TEMPO, NON SI LASCIA PERDERE.
 *
 * Tenere i tempi stretti da solo sposta il problema: se Overpass e' lento
 * davvero il ponte si arrende, non scrive niente, e la persona dopo ripaga
 * tutta l'attesa daccapo - e quella dopo ancora. Cosi' la memoria comune,
 * che e' il motivo per cui il ponte esiste, non si riempie mai proprio nei
 * posti e nelle ore in cui servirebbe.
 *
 * Qui invece la ricerca CONTINUA dopo che si e' gia' risposto al telefono,
 * con tutta la calma che serve, e quando arriva la scrive in memoria. Il
 * telefono intanto ha avuto "sto ancora cercando" - che e' vero, e non e'
 * "sono rotto" - e riprova da solo qualche secondo dopo, trovandola pronta.
 *
 * `EdgeRuntime.waitUntil` e' quello che tiene viva la funzione dopo la
 * risposta. Se un domani non ci fosse, il lavoro parte lo stesso e al
 * massimo viene troncato: l'app non se ne accorge, perde solo il vantaggio.
 */
function continuaInSottofondo(q: string, chiave: string, scrivi: (d: unknown) => Promise<void>,
                              dimentica: () => Promise<void>) {
  const lavoro = (async () => {
    let ultimo: unknown = null;
    for (const url of OVERPASS) {
      try { await scrivi(await unServer(url, q, PONTE_SOTTOFONDO_MS)); return; }
      catch (e) { ultimo = e; }
    }
    /* Non ce l'ha fatta nessuno: si toglie il segnale, se no resterebbe li'
       a dire "ci sta lavorando qualcuno" mentre non ci lavora piu' nessuno. */
    await dimentica();
    console.log('sottofondo a vuoto per ' + chiave.slice(0, 8) + ': ' + String((ultimo as Error)?.message ?? ultimo));
  })();
  try {
    (globalThis as unknown as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } })
      .EdgeRuntime?.waitUntil?.(lavoro);
  } catch (_) { /* senza waitUntil si fa quel che si riesce */ }
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

    const conMemoria = !!(URL_DB && CHIAVE_DB);
    const scrivi = async (risposta: unknown) => {
      if (!conMemoria) return;
      await fetch(`${URL_DB}/rest/v1/vicini_cache`, {
        method: 'POST',
        headers: { ...testa, 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify({ chiave, risposta, quando: new Date().toISOString() }),
      });
    };
    const dimentica = async () => {
      if (!conMemoria) return;
      await fetch(`${URL_DB}/rest/v1/vicini_cache?chiave=eq.${chiave}`,
        { method: 'DELETE', headers: testa });
    };

    /* 1. Qualcuno l'ha gia' chiesta? E qualcuno la sta gia' cercando? */
    let giaInCorso = false;
    if (conMemoria) {
      try {
        const r = await fetch(
          `${URL_DB}/rest/v1/vicini_cache?chiave=eq.${chiave}&select=risposta,quando`,
          { headers: testa });
        const righe = await r.json();
        const che = cheFarne(Array.isArray(righe) ? righe[0] : null);
        if (che.usa) return rispondi({ ...righe[0].risposta, da: 'memoria' });
        giaInCorso = che.giaInCorso;
      } catch (_) { /* la memoria e' un aiuto, non un obbligo */ }
    }

    /* 2. No: si chiede fuori, una volta sola per tutti. */
    try {
      const dati = await chiediAOverpass(q);
      /* 3. E si tiene da parte per chi viene dopo. */
      try { await scrivi(dati); } catch (_) { /* pazienza: la risposta c'e' */ }
      return rispondi({ ...(dati as Record<string, unknown>), da: 'overpass' });
    } catch (e) {
      /* NON CE L'HA FATTA IN TEMPO, MA NON E' FINITA. Si continua a cercare
         in sottofondo e si scrive la memoria quando arriva; al telefono si
         dice che si sta ancora cercando, cosi' lui riprova fra qualche
         secondo e la trova pronta invece di ricominciare da capo.
         Il segnale in memoria serve a non mandare in dieci la stessa
         richiesta a un servizio tenuto su da volontari: chi arriva e lo
         trova cerca per se', ma non ne lascia un altro. */
      if (!giaInCorso) {
        try { await scrivi(SEGNALE); } catch (_) { /* si continua lo stesso */ }
        continuaInSottofondo(q, chiave, scrivi, dimentica);
      }
      return rispondi({
        ancora: true,
        errore: String((e as Error)?.message ?? e),
        dopo: Math.round(PONTE_SOTTOFONDO_MS / 1000),
      });
    }
  } catch (e) {
    return rispondi({ errore: String((e as Error)?.message ?? e) }, 502);
  }
});
