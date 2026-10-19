/* I LINK CORTI DI GOOGLE MAPS, APERTI DA QUI.
 *
 * L'app manda il link corto (maps.app.goo.gl/...) che la persona ha
 * incollato; qui si seguono i rimandi fino all'indirizzo vero di Google Maps
 * e lo si restituisce. Le coordinate, o il nome del posto da cercare, le
 * legge poi l'app: qui non si interpreta niente. Le regole — quali indirizzi
 * si aprono, il tempo massimo, il limite di richieste — stanno in
 * regole.mjs, dove le prova Node.
 *
 * COSA NON ARRIVA QUI E COSA NON SI TIENE. Arriva solo il link. Non si
 * scrive da nessuna parte: niente memoria condivisa (un link mandato da un
 * amico dice dove vuoi andare tu, non e' una domanda di tutti come «Colosseo,
 * Roma»), niente registro. Il registro della funzione riceve solo il tipo di
 * guaio, mai il link. L'indirizzo IP di chi chiede serve per il limite di
 * richieste e resta nella memoria della funzione per dieci minuti al
 * massimo. A Google arriva il nostro server, non il telefono.
 *
 * Si pubblica da solo con .github/workflows/funzioni.yml, come le altre due.
 */

import { segui, nuovoLimite, LUNGHEZZA_MAX } from './regole.mjs';

const conta = nuovoLimite();

/* Chi siamo, per Google: un programma, non un telefono. A un telefono il
   link corto puo' rispondere con una pagina che prova ad aprire l'app di
   Google Maps; a un programma risponde con un rimando secco. Se arriva lo
   stesso una pagina, l'indirizzo lo si cerca li' dentro (linkNelTesto).
   Niente email qui, a differenza del ponte degli indirizzi: Google non la
   chiede. */
const TESTA = {
  'User-Agent': 'GeppGo/1.0 (+https://87jg2gk7tn-bit.github.io/GeppGo/)',
  'Accept-Language': 'it,en;q=0.8',
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/* Il codice del guaio decide lo stato; l'app sceglie la frase da mostrare,
   nella sua lingua (vedi MSG_LINK nell'HTML). */
const STATO: Record<string, number> = { non_ammesso: 400, troppe: 429, tempo: 504 };

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const rispondi = (corpo: unknown, stato = 200) =>
    new Response(JSON.stringify(corpo), {
      status: stato,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  if (req.method !== 'POST') return rispondi({ errore: 'non_ammesso' }, 405);

  const chi = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'senza-indirizzo';
  if (!conta(chi)) return rispondi({ errore: 'troppe' }, 429);

  let url: unknown;
  try {
    const testo = await req.text();
    if (testo.length > LUNGHEZZA_MAX + 200) throw new Error('troppo lungo');
    url = JSON.parse(testo).url;
  } catch (_) {
    return rispondi({ errore: 'non_ammesso' }, 400);
  }

  try {
    const { url: finale } = await segui(url as string, { fetch, testa: TESTA });
    return rispondi({ url: finale });
  } catch (e) {
    const codice = (e as { codice?: string })?.codice || 'non_leggibile';
    console.log('link-mappe:', codice);
    return rispondi({ errore: codice }, STATO[codice] || 502);
  }
});
