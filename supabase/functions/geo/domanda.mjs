/* QUALI INDIRIZZI IL PONTE ACCETTA DI CHIAMARE.
 *
 * Stesso ragionamento del ponte delle ricerche vicine: senza un controllo
 * saremmo un servizio che chiama qualunque cosa per conto di chiunque — cioè
 * un modo comodo per far arrivare traffico a qualcun altro con la nostra
 * faccia. Si accetta solo la forma esatta che l'app produce.
 *
 * Sta in un file a sé perché qui non c'è Deno e la funzione non si può
 * lanciare per provarla: così la regola è UNA, la usa il server e la prova
 * Node, e non possono divergere. */

/* Solo questi, e solo queste strade. */
export const AMMESSI = {
  'nominatim.openstreetmap.org': ['/search', '/reverse'],
  'photon.komoot.io': ['/api', '/api/'],
};

export const LUNGHEZZA_MAX = 600;

/* Torna null se va bene, altrimenti il motivo. */
export function indirizzoAmmesso(u) {
  if (typeof u !== 'string') return 'non e\' testo';
  if (u.length > LUNGHEZZA_MAX) return 'troppo lungo';
  let url;
  try { url = new URL(u); } catch (_) { return 'non e\' un indirizzo'; }
  if (url.protocol !== 'https:') return 'non e\' https';
  const strade = AMMESSI[url.hostname];
  if (!strade) return 'non e\' uno dei servizi previsti';
  if (!strade.includes(url.pathname)) return 'non e\' una delle richieste previste';
  /* Niente credenziali infilate nell'indirizzo, niente porte strane. */
  if (url.username || url.password) return 'ha delle credenziali dentro';
  if (url.port) return 'ha una porta sua';
  /* La risposta la vogliamo in JSON: e' l'unica che l'app sa leggere, e
     lasciar scegliere il formato a chi chiama e' un modo per farsi
     restituire cose che non ci aspettiamo. */
  if (url.hostname === 'nominatim.openstreetmap.org' &&
      url.searchParams.get('format') !== 'json') return 'il formato dev\'essere json';
  /* Un limite alto e' un modo per farci scaricare mezzo paese a ogni
     chiamata. L'app non chiede mai piu' di venti. */
  const limite = +(url.searchParams.get('limit') || '1');
  if (!(limite >= 1 && limite <= 20)) return 'chiede troppi risultati';
  return null;
}

/* La posizione si arrotonda PRIMA di partire, sul telefono; qui si ricontrolla
   che sia davvero arrotondata. Una riga sola, ma e' quella che tiene in piedi
   la promessa: se un giorno l'app smettesse di arrotondare, il ponte se ne
   accorgerebbe invece di inoltrare la posizione esatta. */
export const GRIGLIA = 0.002;

export function posizioneArrotondata(u) {
  let url;
  try { url = new URL(u); } catch (_) { return true; }
  for (const nome of ['lat', 'lon']) {
    const v = url.searchParams.get(nome);
    if (v == null) continue;
    const n = Number(v);
    if (!isFinite(n)) return false;
    if (Math.abs(n / GRIGLIA - Math.round(n / GRIGLIA)) > 1e-6) return false;
  }
  return true;
}
