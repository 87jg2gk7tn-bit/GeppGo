/* LA DOMANDA SI CONTROLLA PRIMA DI INOLTRARLA.
 *
 * Senza questo il ponte sarebbe un Overpass aperto a chiunque: uno ci passa
 * una domanda che legge mezzo pianeta, e a farsi bloccare siamo noi — con
 * la nostra identità, quella che abbiamo messo apposta per essere
 * riconoscibili. Si accetta solo la forma esatta che l'app produce, niente
 * di più.
 *
 * STA IN UN FILE A SÉ, e non dentro la funzione, per un motivo solo: qui non
 * c'è Deno, quindi la funzione non si può lanciare per provarla. Scritta
 * così la regola è UNA, la usa la funzione sul server e la prova da Node, e
 * non possono divergere. Una regola di sicurezza che non si riesce a provare
 * è una regola di cui non si sa niente. */

export const RAGGIO_MAX = 25000;
export const LUNGHEZZA_MAX = 2500;
export const RICERCHE_MAX = 12;
export const RISULTATI_MAX = 1000;

/* Torna null se va bene, altrimenti il motivo — che finisce nella risposta
   e quindi nel messaggio d'errore: quando qualcosa non torna si deve poter
   capire cosa, senza indovinare. */
export function domandaAmmessa(q) {
  if (typeof q !== 'string') return 'non e\' testo';
  if (q.length > LUNGHEZZA_MAX) return 'troppo lunga';
  const testa = /^\[out:json\]\[timeout:(\d{1,2})\];\(/.exec(q);
  if (!testa) return 'non comincia come deve';
  const coda = /\);out center (\d{1,4});$/.exec(q);
  if (!coda) return 'non finisce come deve';
  if (+coda[1] > RISULTATI_MAX) return 'chiede troppi risultati';
  const corpo = q.slice(testa[0].length, q.length - coda[0].length);
  /* Il corpo dev'essere SOLO enunciati `nwr[...](around:R,lat,lng);`. Si
     consuma pezzo per pezzo: se alla fine avanza qualcosa, non era. È il
     modo di dire «solo questo e nient'altro» — un'espressione regolare che
     cerca le cose vietate lascia sempre fuori quella a cui non si è
     pensato. */
  let i = 0;
  let quanti = 0;
  while (i < corpo.length) {
    if (!corpo.startsWith('nwr', i)) return 'un pezzo non e\' una ricerca nwr';
    i += 3;
    if (corpo[i] !== '[') return 'una ricerca senza filtri';
    while (corpo[i] === '[') {
      let j = i + 1;
      let virgolette = false;
      while (j < corpo.length) {
        const c = corpo[j];
        if (c === '"' && corpo[j - 1] !== '\\') virgolette = !virgolette;
        else if (c === ']' && !virgolette) break;
        j++;
      }
      if (j >= corpo.length) return 'un filtro non si chiude';
      i = j + 1;
    }
    const m = /^\(around:(\d+),(-?\d{1,3}(?:\.\d{1,6})?),(-?\d{1,3}(?:\.\d{1,6})?)\);/
      .exec(corpo.slice(i));
    if (!m) return 'manca il giro (around)';
    if (+m[1] > RAGGIO_MAX) return 'il giro e\' troppo largo';
    if (Math.abs(+m[2]) > 90 || Math.abs(+m[3]) > 180) return 'coordinate senza senso';
    i += m[0].length;
    quanti++;
    if (quanti > RICERCHE_MAX) return 'troppe ricerche in una domanda';
  }
  return quanti ? null : 'domanda vuota';
}
