/* IL CALENDARIO CHE SI AGGIORNA, SERVITO DA QUI.
 *
 * Il calendario del telefono chiede …/functions/v1/calendario/<codice>.ics
 * e riceve il viaggio di quel codice in formato iCalendar. Cosa c'e' dentro
 * e come si scrive sta in regole.mjs, dove lo prova Node.
 *
 * SENZA CHIAVE. Il calendario di iPhone non manda intestazioni: questa
 * funzione si pubblica con --no-verify-jwt (vedi funzioni.yml) e la
 * protezione e' il codice nel link, 64 caratteri a caso scelti dal database.
 * Il database lo legge con la chiave di servizio, che Supabase mette qui da
 * solo, e risponde solo se il codice c'e' e chi l'ha fatto e' ancora nel
 * viaggio (calendario_per_codice, in supabase-schema.sql).
 *
 * COSA NON SI TIENE. Niente si scrive: ne' il codice, ne' chi chiede. Il
 * registro della funzione riceve solo il tipo di guaio, mai il codice, che
 * e' una chiave.
 *
 * Si pubblica da solo con .github/workflows/funzioni.yml, come le altre.
 */

import { rispondi } from './regole.mjs';

const URL_DB = Deno.env.get('SUPABASE_URL');
const CHIAVE_DB = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

async function leggi(codice: string) {
  const r = await fetch(`${URL_DB}/rest/v1/rpc/calendario_per_codice`, {
    method: 'POST',
    headers: { apikey: CHIAVE_DB!, Authorization: `Bearer ${CHIAVE_DB}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_codice: codice }),
  });
  if (!r.ok) {
    console.log('calendario: il database risponde', r.status);
    throw new Error('database');
  }
  return await r.json();
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('', { status: 405 });
  const esito = await rispondi(new URL(req.url), { leggi });
  return new Response(req.method === 'HEAD' ? null : esito.corpo, {
    status: esito.stato,
    headers: {
      'Content-Type': esito.tipo || 'text/plain; charset=utf-8',
      // ogni telefono il suo: niente copie a meta' strada
      'Cache-Control': 'private, max-age=600',
      'X-Robots-Tag': 'noindex',
    },
  });
});
