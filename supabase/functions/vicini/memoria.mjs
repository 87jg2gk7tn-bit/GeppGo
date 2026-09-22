/* COSA FARSENE DI QUELLO CHE C'E' IN MEMORIA.
 *
 * Sta in un file a sé, e non dentro la funzione, per la stessa ragione della
 * regola di sicurezza: qui non c'è Deno, la funzione non si può lanciare per
 * provarla, e queste decisioni non sono innocue — una sbagliata non fa
 * rumore, risponde «non c'è niente» a tutti per sei ore.
 *
 * IL CASO CHE HA FATTO NASCERE QUESTO FILE. Quando Overpass è lento davvero,
 * il ponte si arrendeva a diciotto secondi e non scriveva niente: la persona
 * dopo ripagava tutta l'attesa, e quella dopo ancora. Adesso il ponte
 * continua a cercare in sottofondo anche dopo aver risposto, e lascia in
 * memoria un SEGNALE che ci sta già lavorando qualcuno — così due telefoni
 * non mandano due volte la stessa richiesta a un servizio di volontari.
 *
 * E quel segnale è la cosa pericolosa: sta nella stessa casella delle
 * risposte, e una risposta senza niente dentro è una risposta legittima
 * («qui non c'è nessun bancomat»). Scambiare il segnale per una risposta
 * vuota vorrebbe dire rispondere «non c'è niente» a tutti, per ore, senza
 * che nessun errore lo dica. Per questo la distinzione è una funzione sola,
 * provata, invece di un «if» sparso dentro la funzione.
 */

/* Quanto si tiene una risposta. Un bagno non si sposta e un bancomat
   nemmeno: una settimana è prudente, non spericolata. Le risposte VUOTE si
   tengono molto meno — «qui non c'è niente» è la risposta che qualcuno
   potrebbe aver appena smentito mettendo il posto sulla mappa. */
export const GIORNI = 7;
export const ORE_VUOTO = 6;

/* Quanto può durare la ricerca in sottofondo, cioè quella che va avanti dopo
   che il telefono ha già avuto la sua risposta. Qui non c'è nessuno che
   aspetta guardando lo schermo, quindi si può avere pazienza: il senso è
   proprio arrivare fin dove il telefono non arriva. */
export const PONTE_SOTTOFONDO_MS = 50000;

/* Per quanto un segnale «ci sto lavorando» vale ancora. Oltre, si dà per
   perso: se la funzione che lo aveva lasciato è morta a metà, il segnale
   resterebbe lì per sempre e nessuno riproverebbe mai più. Un segnale
   scaduto non blocca nessuno — che è il modo giusto di sbagliare. */
export const SEGNALE_VALE_MS = PONTE_SOTTOFONDO_MS + 10000;

/* Com'è fatto il segnale. Una chiave sola, che non può essere confusa con
   una risposta di Overpass: le sue hanno `elements`. */
export const SEGNALE = { inCorso: true };
export function eUnSegnale(risposta) {
  return !!(risposta && risposta.inCorso === true);
}

/* Cosa fare, data la riga che c'è in memoria (o niente) e che ora è.
 *
 *   usa         → rispondere con questa, senza chiedere fuori
 *   chiedi      → andare a chiedere alla mappa
 *   giaInCorso  → c'è già qualcun altro che sta cercando questa stessa cosa:
 *                 si chiede lo stesso per chi sta aspettando adesso, ma NON
 *                 si lascia un altro lavoro in sottofondo
 */
export function cheFarne(riga, adesso = Date.now()) {
  if (!riga || riga.risposta == null) return { usa: false, chiedi: true, giaInCorso: false };
  const eta = adesso - new Date(riga.quando).getTime();
  if (!(eta >= 0)) return { usa: false, chiedi: true, giaInCorso: false };

  /* IL SEGNALE NON È UNA RISPOSTA. Senza questa riga varrebbe come una
     risposta senza niente dentro, e verrebbe servito per sei ore. */
  if (eUnSegnale(riga.risposta))
    return { usa: false, chiedi: true, giaInCorso: eta < SEGNALE_VALE_MS };

  const quanti = (riga.risposta.elements || []).length;
  const scadenza = quanti ? GIORNI * 86400000 : ORE_VUOTO * 3600000;
  if (eta < scadenza) return { usa: true, chiedi: false, giaInCorso: false };
  return { usa: false, chiedi: true, giaInCorso: false };
}
