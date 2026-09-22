/* LA MEMORIA COMUNE DEL PONTE: cosa si usa, cosa si va a richiedere.
 *
 * PERCHE' QUESTE RIGHE ESISTONO. Quando Overpass e' lento davvero il ponte
 * non si arrende piu': continua a cercare in sottofondo e lascia in memoria
 * un SEGNALE che ci sta gia' lavorando qualcuno, cosi' dieci telefoni non
 * mandano dieci volte la stessa richiesta a un servizio di volontari.
 *
 * E quel segnale e' la cosa pericolosa del giro: sta nella stessa casella
 * delle risposte, e una risposta senza niente dentro e' una risposta
 * legittima — «qui non c'e' nessun bancomat». Scambiare il segnale per una
 * risposta vuota vorrebbe dire rispondere «non c'e' niente» a TUTTI, per sei
 * ore, senza che nessun errore lo dica da nessuna parte. E' esattamente il
 * tipo di guasto che non si trova guardando: si trova solo se c'e' una riga
 * che lo chiede.
 *
 * Le regole stanno in supabase/functions/vicini/memoria.mjs e non dentro la
 * funzione, perche' qui non c'e' Deno e la funzione non si potrebbe lanciare
 * per provarla. Cosi' la regola e' UNA: la usa il server, la prova Node, e
 * non possono divergere.
 */
(async () => {
  const { cheFarne, eUnSegnale, SEGNALE, GIORNI, ORE_VUOTO, SEGNALE_VALE_MS, PONTE_SOTTOFONDO_MS }
    = await import('../supabase/functions/vicini/memoria.mjs');
  const { PONTE_BUDGET_MS } = await import('../supabase/functions/vicini/domanda.mjs');

  const r = [];
  const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);

  const ADESSO = Date.parse('2026-09-23T12:00:00Z');
  const fa = ms => new Date(ADESSO - ms).toISOString();
  const con = (risposta, quantoFa) => cheFarne({ risposta, quando: fa(quantoFa) }, ADESSO);
  const posti = { elements: [{ type: 'node', id: 1, tags: { amenity: 'atm' } }] };
  const nessunPosto = { elements: [] };

  // ── il segnale non è una risposta ────────────────────────────────────
  /* La riga che conta. Senza, il segnale passa per «qui non c'è niente» e
     viene servito per sei ore a chiunque cerchi la stessa cosa. */
  const segnaleFresco = con(SEGNALE, 2000);
  ok('il segnale «ci sto lavorando» NON viene servito come risposta',
     segnaleFresco.usa === false, JSON.stringify(segnaleFresco));
  ok('e chi arriva mentre si cerca cerca lo stesso, per sé',
     segnaleFresco.chiedi === true);
  ok('ma non lascia un secondo lavoro in sottofondo sulla stessa domanda',
     segnaleFresco.giaInCorso === true);
  ok('un segnale si riconosce, una risposta vuota no',
     eUnSegnale(SEGNALE) === true && eUnSegnale(nessunPosto) === false &&
     eUnSegnale(posti) === false && eUnSegnale(null) === false);

  // ── e un segnale dimenticato non blocca per sempre ───────────────────
  /* Se la funzione che l'aveva lasciato muore a metà, il segnale resta lì.
     Senza una scadenza nessuno riproverebbe mai più quella domanda: si
     ricorderebbe per sempre di star cercando una cosa che non cerca
     nessuno. */
  const segnaleVecchio = con(SEGNALE, SEGNALE_VALE_MS + 1000);
  ok('un segnale rimasto lì da troppo non blocca più nessuno',
     segnaleVecchio.chiedi === true && segnaleVecchio.giaInCorso === false,
     JSON.stringify(segnaleVecchio));
  ok('e la sua scadenza sta oltre la ricerca in sottofondo, non prima',
     SEGNALE_VALE_MS > PONTE_SOTTOFONDO_MS,
     `segnale ${SEGNALE_VALE_MS}ms, ricerca ${PONTE_SOTTOFONDO_MS}ms`);

  // ── le risposte vere ─────────────────────────────────────────────────
  ok('una risposta di ieri si usa', con(posti, 86400000).usa === true);
  ok('una di due settimane fa no',
     con(posti, GIORNI * 86400000 + 1000).usa === false);
  /* «Qui non c'è niente» è la risposta che qualcuno può aver appena
     smentito mettendo il posto sulla mappa: si tiene molto meno. */
  ok('un «non c\'è niente» di un\'ora fa si usa',
     con(nessunPosto, 3600000).usa === true);
  ok('ma uno di ieri si va a ricontrollare',
     con(nessunPosto, ORE_VUOTO * 3600000 + 1000).usa === false);
  ok('e un «non c\'è niente» scade molto prima di una risposta piena',
     ORE_VUOTO * 3600000 < GIORNI * 86400000,
     `${ORE_VUOTO} ore contro ${GIORNI} giorni`);

  // ── e quando in memoria non c'è niente ───────────────────────────────
  ok('senza niente in memoria si va a chiedere',
     cheFarne(null, ADESSO).chiedi === true && cheFarne(null, ADESSO).usa === false);
  ok('e una riga storta non viene scambiata per una risposta',
     cheFarne({ quando: fa(1000) }, ADESSO).usa === false &&
     cheFarne({ risposta: posti }, ADESSO).usa === false);
  /* Un orologio che va indietro — succede — non deve far passare per
     freschissima una risposta di un mese fa. */
  ok('una riga datata nel futuro si va a ricontrollare, non si usa',
     con(posti, -60000).usa === false);

  // ── la ricerca in sottofondo ha senso solo se dura più dell'altra ────
  /* Se cercasse per lo stesso tempo del ponte, andrebbe a vuoto esattamente
     come lui: non servirebbe a niente. Il senso è arrivare dove il telefono
     non arriva. */
  ok('cercare in sottofondo dura molto più che davanti alla persona',
     PONTE_SOTTOFONDO_MS > PONTE_BUDGET_MS * 2,
     `sottofondo ${PONTE_SOTTOFONDO_MS}ms, davanti ${PONTE_BUDGET_MS}ms`);

  console.log('\n' + r.join('\n'));
  const falliti = r.filter(x => x.includes('FALLITO')).length;
  console.log(`\n${r.length - falliti}/${r.length} passati`);
  process.exit(falliti ? 1 : 0);
})();
