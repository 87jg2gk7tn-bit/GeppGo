/* SPOSTA L'OROLOGIO DI UNA PROVA. Non è una prova: si mette davanti a una.
 *
 *   SPOSTA_A=2027-02-10T10:00:00 node -r ./test/sposta-orologio.js test/prova-traduzioni.js 2
 *   SPOSTA_A=2026-10-26T23:59:50 node -r ./test/sposta-orologio.js test/prova-a-portata.js
 *
 * PERCHÉ. Due volte di fila le prove sono cadute su GitHub per colpa del
 * calendario, senza che l'app fosse cambiata: a mezzanotte (26 ottobre 2026:
 * il viaggio di prova cominciava «oggi», e fra l'avvio e l'apertura delle
 * pagine il giorno era cambiato) e a novembre (12 novembre: «nov» si scrive
 * uguale in italiano e in spagnolo, e passava per italiano rimasto). Un
 * guasto così non si riprova aspettando la data: la si finge.
 *
 * COME. Le prove prendono il giorno da Node (OGGI in schermate.js) e lo
 * passano alla pagina (page.clock.install): basta spostare l'orologio di
 * Node, e il resto lo segue. L'ora continua a scorrere, da SPOSTA_A in poi.
 */
const Vera = Date;
const quando = new Vera(process.env.SPOSTA_A || '');
if (isNaN(quando)) { console.error('SPOSTA_A deve essere una data, per esempio 2027-02-10T10:00:00'); process.exit(2); }
const scarto = quando.getTime() - Vera.now();
class Spostata extends Vera {
  constructor(...a) { if (a.length) super(...a); else super(Vera.now() + scarto); }
  static now() { return Vera.now() + scarto; }
}
global.Date = Spostata;
