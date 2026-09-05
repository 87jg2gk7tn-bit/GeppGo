/* Leggere la mail di conferma: è il motivo per cui la gente usa TripIt.

   Le mail qui sotto sono scritte come arrivano davvero — con l'intestazione,
   il "Gentile cliente", il numero di telefono dell'assistenza in mezzo e gli
   orari sparsi — perché è su quelle che il lettore deve funzionare, non su
   un testo pulito costruito apposta.

   Il controllo che conta più di tutti sta in fondo: leggere una prenotazione
   NON deve mandare niente a nessuno. Il testo di una conferma ha il nome, il
   codice e a volte il documento: farselo leggere da un servizio esterno
   sarebbe la cosa più facile e la più sbagliata, ed è anche il contrario di
   quello che il pannello promette. */
const { apriBrowser, APP } = require('./browser');

const stato = {
  trips: [{ id: 1730000000010, name: 'Giappone', destination: 'Tokyo', currency: 'EUR',
    status: 'open', start: '2026-03-14', end: '2026-03-22',
    participants: [{ id: 1, name: 'Gepp', isMe: true }],
    pois: [], expenses: [], tickets: [], hotels: [], weather: {}, createdAt: 1,
    days: ['2026-03-14','2026-03-15','2026-03-16'].map((d, i) => ({ id: 'd' + i, date: d, title: '', activities: [] })) }],
  currentTripId: 1730000000010, settings: { proxRadius: 200 }, myName: 'Gepp', skipAuth: true
};

// ── le mail ───────────────────────────────────────────────────────────────
const MAIL = {
  voloIt: `Gentile Giacomo Merati,
grazie per aver scelto ITA Airways. Assistenza clienti: 06 85960020

Codice di prenotazione: QX7T2M

Volo AZ786
Roma Fiumicino (FCO) → Tokyo Haneda (HND)
Partenza: 15 marzo 2026 alle 21:50
Arrivo: 16 marzo 2026 alle 17:35
Terminal 1 · Gate B14

Totale: 842,50 EUR`,

  voloEn: `Dear Giacomo,
Your booking is confirmed. Customer service open 09:00-18:00.

Booking reference: KJ9P4R

Flight FR1842
London Stansted (STN) → Milan Bergamo (BGY)
Departure: March 15, 2026 at 07:20
Arrival: 10:45

Gate 42
Total: £128.40`,

  trenoEs: `Estimado cliente,
Gracias por viajar con Renfe. Atención al cliente: 912 320 320

Código de reserva: RN44821

Tren AVE 03093
Madrid Puerta de Atocha → Barcelona Sants
Salida: 15 de marzo de 2026 a las 08:30
Llegada: 11:15
Coche 7 · Asiento 12A · Andén 4

Total: 89,90 EUR`,

  trenoFr: `Bonjour,
Votre réservation SNCF est confirmée.

Numéro de dossier: TGV77X

TGV 6208
Paris Gare de Lyon → Lyon Part-Dieu
Départ: 15 mars 2026 à 09:04
Arrivée: 11:00
Voiture 12 · Siège 45

Total: 79,00 EUR`,

  hotelPt: `Olá Giacomo,
A sua reserva está confirmada.

Código de reserva: LX88213

Hotel: Pousada de Lisboa
Rua do Comércio 31, Lisboa

Check-in: 14 março 2026 a partir das 15:00
Check-out: 18 março 2026 até às 11:00

Total: 640,00 EUR`,

  hotelIt: `Gentile ospite,
la tua prenotazione su Booking.com è confermata.

Numero di prenotazione: 4471928365

Struttura: Ryokan Sakura
Check-in: 16/03/2026 dalle 15:00
Check-out: 20/03/2026 entro le 10:00

Importo totale: € 1.240,00`,

  andataRitorno: `Gentile Giacomo,
la tua prenotazione Trenitalia è confermata.
Codice di prenotazione: PNR8842

ANDATA
Frecciarossa 9612
Milano Centrale → Roma Termini
Partenza: 15 marzo 2026 alle 07:10
Arrivo: 10:15
Carrozza 5 · Posto 11A

RITORNO
Frecciarossa 9655
Roma Termini → Milano Centrale
Partenza: 18 marzo 2026 alle 18:50
Arrivo: 21:55
Carrozza 3 · Posto 7C

Totale: 158,00 EUR`,

  autoEn: `Dear customer,
Your car rental is confirmed. Europcar.

Confirmation number: EC55210

Pick-up: Rome Fiumicino Airport
Date: 15/03/2026 at 12:00
Drop-off: 20/03/2026 at 09:00

Total: 310.00 EUR`,

  ristorante: `Gentile Giacomo,
la prenotazione al ristorante è confermata.

Ristorante: Trattoria da Enzo
Prenotazione tavolo per 4 persone
16 marzo 2026 alle 20:30

Codice prenotazione: TF9012`,

  americana: `Dear traveler,
Your reservation is confirmed.

Confirmation code: US1234
Hotel: The Standard
Check-in: 03/15/2026
Check-out: 03/20/2026`,

  niente: `Ciao Giacomo,
come stai? Ti scrivo per sapere se ci vediamo la settimana prossima.
Fammi sapere. Un abbraccio.`
};

(async () => {
  const browser = await apriBrowser();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const err = [];
  page.on('pageerror', e => err.push('PAGEERROR: ' + e.message));

  const fuori = [];
  page.on('request', q => { if (/^https?:/.test(q.url())) fuori.push(q.url()); });

  await page.addInitScript(s => localStorage.setItem('geppgo2', JSON.stringify(s)), stato);
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.prenotazioniNelTesto === 'function', { timeout: 20000 });
  await page.waitForTimeout(400);

  const r = [];
  const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);
  const leggi = m => page.evaluate(t => prenotazioniNelTesto(t), MAIL[m]);
  const una = async m => (await leggi(m))[0];

  // ── i tipi, nelle cinque lingue ─────────────────────────────────────────
  const tipo = m => page.evaluate(t => detectBookingType(t), MAIL[m]);
  ok('riconosce un volo in italiano', await tipo('voloIt') === 'volo');
  ok('e uno in inglese', await tipo('voloEn') === 'volo');
  ok('riconosce un treno in spagnolo', await tipo('trenoEs') === 'treno');
  ok('e uno in francese', await tipo('trenoFr') === 'treno');
  ok('riconosce un alloggio in portoghese', await tipo('hotelPt') === 'hotel');
  ok('e uno in italiano', await tipo('hotelIt') === 'hotel');
  ok('riconosce un noleggio auto', await tipo('autoEn') === 'auto');
  ok('riconosce un ristorante', await tipo('ristorante') === 'ristorante');
  ok('e su una mail che non è una prenotazione non inventa niente',
     await tipo('niente') === 'sconosciuto', await tipo('niente'));

  // ── il volo italiano, campo per campo ───────────────────────────────────
  const v = await una('voloIt');
  ok('volo: prende il numero, non la prima riga', v.nome === 'Volo AZ786', v.nome);
  ok('volo: legge i codici degli aeroporti', v.da === 'FCO' && v.a === 'HND', v.da + ' → ' + v.a);
  ok('volo: legge la data di partenza', v.dataDa === '2026-03-15', v.dataDa);
  /* L'ora giusta è quella etichettata "Partenza", non la prima del testo:
     nella mail prima ci sono gli orari dell'assistenza clienti. */
  ok('volo: prende l\'ora della partenza, non la prima che trova', v.oraDa === '21:50', v.oraDa);
  ok('volo: e anche quella di arrivo', v.oraA === '17:35', v.oraA);
  ok('volo: legge il codice di prenotazione', v.codice === 'QX7T2M', v.codice);
  ok('volo: legge il totale', v.prezzo === 842.5 && v.valuta === 'EUR', v.prezzo + ' ' + v.valuta);
  ok('volo: tiene da parte gate e terminal', /Gate B14/.test(v.note) && /Terminal 1/.test(v.note), v.note);

  // ── il volo inglese ─────────────────────────────────────────────────────
  const ve = await una('voloEn');
  ok('inglese: "March 15, 2026" è una data', ve.dataDa === '2026-03-15', ve.dataDa);
  ok('inglese: legge il volo', ve.nome === 'Volo FR1842', ve.nome);
  ok('inglese: legge gli aeroporti', ve.da === 'STN' && ve.a === 'BGY', ve.da + ' → ' + ve.a);
  ok('inglese: legge il codice', ve.codice === 'KJ9P4R', ve.codice);
  ok('inglese: legge il totale in sterline', ve.prezzo === 128.4 && ve.valuta === 'GBP', ve.prezzo + ' ' + ve.valuta);

  // ── lo spagnolo ─────────────────────────────────────────────────────────
  const es = await una('trenoEs');
  ok('spagnolo: "15 de marzo de 2026" è una data', es.dataDa === '2026-03-15', es.dataDa);
  ok('spagnolo: legge l\'ora della salida', es.oraDa === '08:30', es.oraDa);
  ok('spagnolo: legge il codice', es.codice === 'RN44821', es.codice);
  ok('spagnolo: legge la stazione di partenza e quella di arrivo',
     /Madrid/.test(es.da) && /Barcelona/.test(es.a), es.da + ' → ' + es.a);
  ok('spagnolo: tiene da parte carrozza, posto e binario',
     /Carrozza 7/.test(es.note) && /Posto 12A/.test(es.note) && /Binario 4/.test(es.note), es.note);

  // ── il francese ─────────────────────────────────────────────────────────
  const fr = await una('trenoFr');
  ok('francese: "15 mars 2026" è una data', fr.dataDa === '2026-03-15', fr.dataDa);
  ok('francese: legge l\'ora del départ', fr.oraDa === '09:04', fr.oraDa);
  ok('francese: legge il numero di dossier', fr.codice === 'TGV77X', fr.codice);
  ok('francese: riconosce il treno', /Tgv/i.test(fr.nome), fr.nome);

  // ── il portoghese ───────────────────────────────────────────────────────
  const pt = await una('hotelPt');
  ok('portoghese: "14 março 2026" è una data', pt.dataDa === '2026-03-14', pt.dataDa);
  ok('portoghese: legge il check-out', pt.dataA === '2026-03-18', pt.dataA);
  ok('portoghese: legge il nome della struttura', /Pousada de Lisboa/.test(pt.nome), pt.nome);

  // ── l'alloggio italiano, col totale scritto all'italiana ────────────────
  const hi = await una('hotelIt');
  ok('alloggio: check-in e check-out', hi.dataDa === '2026-03-16' && hi.dataA === '2026-03-20',
     hi.dataDa + ' → ' + hi.dataA);
  ok('alloggio: il nome della struttura', /Ryokan Sakura/.test(hi.nome), hi.nome);
  /* 1.240,00 all'italiana è milleduecentoquaranta, non uno e ventiquattro. */
  ok('alloggio: "€ 1.240,00" è milleduecentoquaranta', hi.prezzo === 1240, String(hi.prezzo));
  ok('alloggio: legge il numero di prenotazione', hi.codice === '4471928365', hi.codice);

  // ── andata E ritorno: due prenotazioni, non una ─────────────────────────
  const ar = await leggi('andataRitorno');
  ok('andata e ritorno sono DUE prenotazioni', ar.length === 2, ar.length + ' trovate');
  if (ar.length === 2) {
    ok('la prima è l\'andata', ar[0].dataDa === '2026-03-15' && /Milano/.test(ar[0].da),
       ar[0].dataDa + ' ' + ar[0].da + ' → ' + ar[0].a);
    ok('la seconda è il ritorno', ar[1].dataDa === '2026-03-18' && /Roma/.test(ar[1].da),
       ar[1].dataDa + ' ' + ar[1].da + ' → ' + ar[1].a);
    ok('e ognuna ha il suo orario', ar[0].oraDa === '07:10' && ar[1].oraDa === '18:50',
       ar[0].oraDa + ' / ' + ar[1].oraDa);
    ok('e il suo posto', /Posto 11A/.test(ar[0].note) && /Posto 7C/.test(ar[1].note),
       ar[0].note + ' | ' + ar[1].note);
    /* Il codice sta scritto una volta sola, in cima: vale per tutte e due. */
    ok('il codice della mail vale per tutte e due',
       ar[0].codice === 'PNR8842' && ar[1].codice === 'PNR8842', ar[0].codice + ' / ' + ar[1].codice);
  }

  // ── un alloggio NON si spezza in andata e ritorno ───────────────────────
  const solo = await leggi('hotelPt');
  ok('un soggiorno resta una prenotazione sola', solo.length === 1, solo.length + ' trovate');

  // ── la data all'americana ───────────────────────────────────────────────
  /* 03/15/2026 non può essere il quindicesimo mese: si capisce da solo. */
  const us = await una('americana');
  ok('"03/15/2026" si capisce che è marzo, non il mese 15', us.dataDa === '2026-03-15', us.dataDa);
  ok('e il check-out pure', us.dataA === '2026-03-20', us.dataA);

  // ── il noleggio auto e il ristorante ────────────────────────────────────
  const au = await una('autoEn');
  ok('auto: riconosce la compagnia', /Europcar/i.test(au.nome), au.nome);
  ok('auto: legge le date', au.dataDa === '2026-03-15' && au.dataA === '2026-03-20',
     au.dataDa + ' → ' + au.dataA);
  const ri = await una('ristorante');
  ok('ristorante: legge il nome', /Trattoria da Enzo/.test(ri.nome), ri.nome);
  ok('ristorante: legge data e ora', ri.dataDa === '2026-03-16' && ri.oraDa === '20:30',
     ri.dataDa + ' ' + ri.oraDa);

  // ── e su una mail che non è una prenotazione ────────────────────────────
  const no = await una('niente');
  ok('su una mail qualunque non inventa un codice', !no.codice, no.codice || '(niente)');
  ok('né un prezzo', !no.prezzo, String(no.prezzo));

  // ── il pannello ─────────────────────────────────────────────────────────
  fuori.length = 0;
  const pannello = await page.evaluate(t => {
    document.getElementById('bookText').value = t;
    analyzeBooking();
    return { testo: document.getElementById('bookResult').innerText,
             quante: prenTrovate.length };
  }, MAIL.andataRitorno);
  ok('il pannello dice quante ne ha trovate', /trovate 2|ne ho trovate 2/i.test(pannello.testo),
     pannello.testo.split('\n')[0]);
  ok('e le mostra tutte e due', pannello.quante === 2, String(pannello.quante));
  /* L'ora sta dentro un campo, e innerText non legge il valore dei campi:
     va chiesto al campo. */
  const seconda = await page.evaluate(() => {
    prenScegli(1);
    return { ora: document.getElementById('bpTimeStart').value,
             da: document.getElementById('bpFrom').value };
  });
  ok('si può passare alla seconda', seconda.ora === '18:50' && /Roma/.test(seconda.da),
     seconda.da + ' ' + seconda.ora);

  await page.waitForTimeout(1500);
  /* LA REGOLA: il testo di una prenotazione non esce dal telefono. */
  ok('leggere una prenotazione non manda niente a nessuno', fuori.length === 0,
     fuori.join(', ') || 'nessuna chiamata');

  // ── e il pannello lo promette per iscritto ──────────────────────────────
  const promessa = await page.evaluate(() => document.getElementById('impBookingSub').innerText);
  ok('il pannello promette che resta sul telefono', /sul telefono/i.test(promessa),
     promessa.split('\n').filter(Boolean).slice(0, 2).join(' / '));

  console.log('\n' + r.join('\n'));
  const falliti = r.filter(x => x.includes('FALLITO')).length;
  console.log(`\n${r.length - falliti}/${r.length} passati`);
  if (err.length) console.log('\nErrori in pagina:\n' + err.join('\n'));
  await browser.close();
  process.exit(falliti || err.length ? 1 : 0);
})();
