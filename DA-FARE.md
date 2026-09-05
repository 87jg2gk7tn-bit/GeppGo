# GeppGo — a che punto siamo

Aggiornato: 5 settembre 2026.

Questo file esiste perché le sessioni di lavoro non si ricordano fra loro.
Chi riprende in mano il progetto — Giacomo o un assistente — legge qui e sa
dov'era rimasto, senza rifare ragionamenti già fatti.

---

## ⚠️ DA FARE SUBITO

**Lanciare su Supabase lo schema aggiornato** (`supabase-schema.sql`, tutto il
file: è rilanciabile senza danni). Contiene la parte foto e la cancellazione
dell'account. Finché non è fatto, le foto non arrivano nel cloud — l'app dice
*"ancora solo su questo telefono — il magazzino delle foto non c'è ancora"* —
e il tasto "Elimina il mio account" non funziona.

SQL Editor → incolla → Run. Poi si prova ad aggiungere una foto: sotto deve
leggersi *"salvata anche nel cloud: la vedono i compagni di viaggio"*.

**E guardare in quale regione sta il progetto Supabase** (Project Settings →
General → Region): serve a completare una frase della privacy policy. Se è
fuori dall'Europa va detto per nome. Cinque minuti.

---

## Dove si sta andando

**App nativa sugli store.** L'ordine deciso: prima lo scheletro solido sul
link, poi l'IA a posto, poi la nativa. Le critiche del tipo "non puoi
incassare" non valgono: è una data, non un difetto.

**Il posizionamento è il gruppo.** Quello che GeppGo ha dimostrato in Giappone
(sei persone, due settimane, uso quotidiano) non è "un'app di viaggi": sono
sei persone che condividono giornata, spese e orari senza litigare. Oggi
userebbero Splitwise + TripIt + Google Maps + WhatsApp. È un posizionamento
più difendibile, e si diffonde da solo: chi organizza deve far installare
l'app agli altri cinque. Un utente ne porta cinque, gratis — l'unica leva di
distribuzione che una persona sola può permettersi.

Da qui discende una regola: **il limite del piano gratuito conta solo i viaggi
che crei tu.** Essere invitati è libero e illimitato, altrimenti il paywall
combatte l'unico motore di crescita che c'è.

---

## Il piano, in ordine

### Blocchi veri per lo store

1. ~~**Togliere il setup Supabase**~~ ✅ fatto. Chiave dentro l'app, si entra
   con la sola email. Schema versionato in `supabase-schema.sql`, 48 prove sui
   permessi.
2. ~~**Foto nel cloud**~~ ✅ fatto, con le tutele dentro (vedi sotto).
3. ~~**Cancellazione account dentro l'app**~~ ✅ fatto. `elimina_account()`
   nel database, tasto in Profilo. La parte delicata era non portarsi via i
   viaggi degli altri: chi si cancella lascia a chi resta i viaggi con
   qualcuno dentro, passando ruolo e proprietà. 21 prove sul database, 16
   sull'app.
4. ~~**Privacy policy + scheda dati**~~ ✅ fatto. `privacy.html` (raggiungibile
   sotto `/privacy`), linkata alla registrazione e dal Profilo.
   `PRIVACY-STORE.md` dice voce per voce cosa rispondere ad Apple e Google.
   **Restano due cose che non sono codice:** dire in quale regione stanno i
   server Supabase, e far leggere il testo a un avvocato — vedi in fondo a
   `PRIVACY-STORE.md`.
5. ~~**Test e CI nel repo**~~ ✅ fatto. `npm test` le lancia tutte;
   `.github/workflows/prove.yml` le fa girare da sole a ogni push e a ogni PR,
   con un Postgres vero per i permessi. Le prove che vivevano in una cartella
   temporanea sono tutte nel repo.
   **Il 5 settembre è diventata verde per la prima volta:** per dieci run era
   rossa e nessuno l'aveva guardata. Appena ha funzionato ha fatto uscire due
   difetti veri nel giro di mezz'ora — il pallino del GPS che tornava, e il
   pannello dell'account che si mangia i tocchi.

**I cinque blocchi per lo store sono chiusi.** Quello che resta prima di
pubblicare non è codice: la regione dei server, l'avvocato, la società.

### Poi, per crescere

6. **Interfaccia in inglese** — ⏸ **rimandata di proposito, dopo la nativa.**
   Decisione presa il 4 settembre. La *ricerca* dei posti è già mondiale;
   l'interfaccia è italiano scritto a mano, 531 stringhe nella sola parte
   statica più i messaggi e i blocchi costruiti al volo.
   Il motivo del rinvio: tradurre adesso vuol dire mantenere due lingue per
   tutto il rifacimento verso la nativa, quando ogni schermata cambierà
   ancora — doppio lavoro, e nel mezzo un'app mezza bilingue, che è peggio di
   una tutta in italiano. Si fa in un colpo solo quando le schermate hanno
   smesso di muoversi.
   Nel frattempo: ogni stringa nuova va scritta come se dovesse essere
   tradotta (una frase intera, non pezzi cuciti insieme), così il giorno che
   si fa non si deve riscrivere niente.
7. ~~**Cache delle ricerche POI**~~ ✅ fatto. Le risposte si tengono un giorno
   (un'ora se non hanno trovato niente) e si riusano se la ricerca di prima è
   stata fatta entro 150 metri. Non a griglia: due punti a venti metri
   finivano in celle diverse ogni volta che in mezzo cadeva un confine — l'ha
   trovato una prova, non un ragionamento.
8. ~~**Togliere gli slot pubblicitari vuoti**~~ ✅ fatto. I nove riquadri
   restano nel codice, già al loro posto, ma chiusi: si riaprono cambiando
   `PUBBLICITA_ATTIVA`. Quel giorno vanno rifatte anche le schede privacy
   sugli store, perché la pubblicità cambia le risposte su tracciamento e
   identificatori.
9. ~~**Il "dopo viaggio"**~~ ✅ fatto. Concludendo un viaggio si apre da solo
   (ed è l'unico momento in cui uno ha voglia di guardarlo); si riapre dalla
   scheda del viaggio. Dentro: i numeri, dove è andata di più la spesa, il
   giorno più pieno, e una cartolina con il filo delle tappe disegnato, da
   mandare col tasto Condividi del telefono.
   ⚠️ **Non è diventata una pagina pubblica**, e non deve diventarlo: la
   cartolina si disegna sul telefono e non viene appoggiata da nessuna parte.
   Due prove tengono ferma la regola — aprire il ricordo non chiama nessun
   server, e il racconto **non contiene il codice d'invito** (un racconto si
   gira, un invito no). Le foto ci vanno solo se uno le mette apposta.
10. ~~**Import prenotazioni dalle mail**~~ ✅ fatto. Il lettore riconosce voli,
    treni, autobus, traghetti, alloggi, noleggio auto, ristoranti e attività,
    in **cinque lingue** (la mail arriva nella lingua del sito su cui hai
    prenotato, non nella tua), e trova andata e ritorno come due prenotazioni
    separate. Ne ricava luoghi, date, orari, codice, totale, e mette gate,
    binario, carrozza e posto nelle note.
    Quanto era messo male prima, misurato sulle stesse mail: la conferma
    inglese perdeva la data e prendeva come ora di partenza le 09:00, che era
    l'orario dell'assistenza clienti; spagnolo e francese erano «non
    riconosciuti» e si chiamavano *Estimado cliente,* e *Bonjour,*.
    ⚠️ **Gira tutto sul telefono**, e deve restare così: il testo di una
    conferma ha il nome, il codice e a volte il documento. C'è una prova che
    conta le chiamate di rete.
11. ~~**Mappe offline**~~ ✅ fatto. Le zone che guardi restano nel telefono e
    si rivedono senza campo. Misurato: la stessa zona, guardata con la rete e
    riaperta senza, prima mostrava **0 tessere su 9**, ora **9 su 9**. Dove la
    mappa non c'è ancora resta un riquadro neutro, e sopra si vedono lo stesso
    il giro e le tappe. In Profilo si legge quanto occupa e si libera.
    ⚠️ **Non esiste "scarica tutta la città", ed è una scelta.** Scaricare
    tessere in blocco dai server di OpenStreetMap è vietato dalle loro
    condizioni: sono volontari, e ti bloccano — lo stesso ragionamento della
    cache di Overpass. Tenere da parte quello che si è già guardato è invece
    proprio quello che quelle condizioni chiedono di fare. Una prova controlla
    che una schermata chieda una ventina di tessere e non centinaia.

---

## Le foto: perché sono fatte così

La preoccupazione di partenza era seria e giusta: *«se qualcuno carica
contenuti illegali, di cosa rispondo?»*

Il principio giuridico, in UE (DSA, Reg. 2022/2065) come negli USA: **chi
ospita passivamente non risponde di quello che non sa.** Il rischio è sapere e
non fare niente, o non avere alcun modo di sapere. Quindi il lavoro è
costruire i meccanismi — che sono poi le quattro cose che l'App Store pretende
alla linea guida 1.2.

**La difesa più solida è l'architettura, e va protetta:** una foto vive dentro
un viaggio e la vedono solo le persone di quel viaggio. Niente bacheca, niente
ricerca, nessun indirizzo pubblico. Gli indirizzi di download sono firmati e
durano un'ora. Un gruppo chiuso di sei amici non è un canale di distribuzione.

Sopra ci sono: segnalazione su ogni foto (motivi in ordine di gravità, minori
per primi), registro di chi ha caricato cosa, blocco di una foto che sparisce
dalla vista restando nel registro, l'admin che può togliere la foto di
chiunque e togliere una persona dal viaggio, il contatto pubblicato in
Profilo. Il magazzino accetta solo JPEG fino a 12 MB.

### Cosa resta da fare, e non è codice

- **Condizioni d'uso scritte da un avvocato** (diritto delle nuove
  tecnologie), e soprattutto la **procedura scritta** di cosa si fa quando
  arriva una segnalazione: cosa si conserva, cosa si rimuove, a chi si
  comunica, in quanto tempo. Quella procedura, applicata, è ciò che dimostra
  diligenza.
- **Fare una società** (SRL/SRLS): oggi si risponde con il patrimonio
  personale.
- **Riconoscimento automatico** quando i volumi crescono: PhotoDNA
  (Microsoft), Child Safety Toolkit (Google) o lo strumento di Cloudflare —
  gratuiti per chi ne ha diritto, va fatta domanda. Attenzione: scansionare
  *crea conoscenza*, e la conoscenza fa scattare l'obbligo di segnalare. Va
  attivato quando la procedura di segnalazione è già pronta.
- In Italia le segnalazioni su materiale che riguarda minori si fanno alla
  **Polizia Postale** (CNCPO); se l'infrastruttura è americana, anche NCMEC.

---

## I costi del cloud

Supabase, progetto `cyolhqndurgwbivxcssf`. Oggi piano **gratuito**.

**Quando smette di essere gratis:** il piano gratuito mette in pausa i
progetti inattivi dopo circa una settimana. Con utenti veri serve il **Pro
(~25 $/mese)** a prescindere dai volumi.

**Quello che costa è il traffico in uscita, non lo spazio.** Ogni foto si
carica una volta e viene scaricata da ognuno degli altri: in un gruppo di sei,
una foto conta ×5.

Un viaggio come il Giappone (6 persone, 300 foto a qualità Alta, 1,5 MB):
450 MB di spazio, **2,25 GB di traffico**. Il gratuito dà 1 GB di spazio e
~5 GB di traffico: **un solo viaggio ne consuma metà**.

Col Pro (100 GB spazio, ~250 GB traffico) ci stanno ~100 viaggi al mese.
Oltre, si paga a consumo: ordini di grandezza ~0,02 $/GB al mese di spazio e
~0,09 $/GB di traffico. **Verificare su supabase.com/pricing: i prezzi
cambiano.**

**Le due leve:**
- La qualità scelta al caricamento è anche una manopola dei costi: Leggera
  (145 KB) contro Alta (1,5 MB) contro Originale (5,6 MB) sono dieci e
  quaranta volte tanto.
- **C'è un difetto di progetto che si pagherà**: oggi l'app scarica *ogni foto
  di ogni viaggio sul telefono di ognuno, per sempre*. La correzione, quando i
  volumi cresceranno: miniatura leggera per la striscia del giorno, foto piena
  solo quando qualcuno la apre davvero. Taglierebbe il traffico di circa dieci
  volte. Non è stata fatta perché sarebbe stata ottimizzazione prematura, ma è
  la prima cosa da fare il giorno che la bolletta sale.

---

## Sul modello di business

Il modello attuale — pubblicità più Premium per toglierla — vende la rimozione
di un fastidio creato apposta. Non è una miniera. Il Premium ha senso come
cosa premiante (viaggi illimitati a chi organizza), non punitiva.

Le commissioni sulle prenotazioni (hotel, esperienze, eSIM, assicurazioni)
sono dove stanno i soldi veri nei viaggi, **ma non adesso**: da soli, senza
fondo e senza assistenza clienti, il giorno che una prenotazione va storta la
persona scrive a te, non a Booking. È roba da "quando ci sono utenti e c'è
qualcuno che risponde".

---

## Cose scoperte a caro prezzo, da non riscoprire

- **In Postgres i permessi si sommano.** Ne basta uno vecchio dimenticato per
  riaprire quello che lo schema chiude. Nel progetto vero ce n'erano quindici,
  di due generazioni: fra questi due `DELETE` sui viaggi che rendevano inutile
  la conferma del secondo admin. Lo schema ora fa pulizia prima di ricreare, e
  tre prove verificano che dopo ci siano *esattamente* sette permessi.
- **Il `with check` di un UPDATE vede solo la riga nuova.** Quindi non può
  impedire a un campo di cambiare: appena ti scrivi `owner = io`, la
  condizione è vera e passi. Per proteggere un *campo* — proprietario, ruolo,
  richiesta di eliminazione — serve un trigger. È lo stesso inganno tre volte.
- **Ricomprimere un JPEG già compresso costa più dell'originale** (misurato:
  114%) senza aggiungere un dettaglio. Per questo "Originale" salta del tutto
  il canvas.
- **`uid()` restituisce un numero**, non una stringa. I confronti con valori
  che tornano dal database passano da `String()`.
- **`create table if not exists` non aggiunge colonne a una tabella che c'è
  già.** Ogni colonna nuova vuole il suo `alter table ... add column if not
  exists`, altrimenti sui database esistenti manca e le funzioni che la usano
  falliscono a tempo di esecuzione. È successo con `joined_at`, e l'ha trovato
  solo la prova che applica lo schema al database vero invece che a uno vuoto.
- **Un percorso costruito da `__dirname` si rompe appena il file si sposta.**
  Portando le prove dentro `test/`, nove su diciassette hanno smesso di
  funzionare per questo. Quello che serve si chiede a Node (`require.resolve`)
  o si passa da un posto solo (`test/browser.js`).
- **Una cache a griglia sbaglia sui confini.** Arrotondare le coordinate mette
  due punti vicinissimi in celle diverse se in mezzo cade un bordo, e la cache
  manca il colpo proprio nel caso più comune: la stessa persona ferma nello
  stesso posto. Meglio tenere la posizione vera e riusare quello che è stato
  preso *abbastanza vicino*.
- **Una cache che tiene la posizione tocca la privacy policy.** La pagina
  prometteva che la posizione "non viene mai conservata": tenendo per un
  giorno il punto da cui hai cercato, quella frase diventava falsa — anche se
  resta tutto dentro il telefono. Riscritta distinguendo *noi* dal
  *dispositivo*, e messa una prova che lega le due cose: finché nel codice
  c'è `VICINI_CACHE_CHIAVE`, la pagina deve dirlo. Vale in generale: **prima
  di tenere da parte un dato, si guarda cosa si era promesso.**
- **Il banco di prova va svuotato fra un caso e l'altro.** `prova-vicini`
  riusa una pagina sola e cerca sempre dallo stesso punto: appena è arrivata
  la cache, sessanta prove hanno cominciato a leggere la risposta del caso
  precedente. Non era un guasto dell'app — ma per un'ora è sembrato tale.
- **Una prova verde in locale non è una prova verde.** Sei prove avevano
  scritto dentro `file:///home/user/GeppGo/Index%202.1.html`: qui passavano,
  sul server delle prove automatiche — dove il progetto sta altrove —
  fallivano tutte. Adesso il percorso passa solo da `test/browser.js`, e il
  lanciatore boccia qualunque prova che se lo scriva a mano.
- **Una prova che dipende da cosa riesce a scaricare non è una prova.** `undo`
  falliva solo sul server: senza `skipAuth` l'app apre il pannello "accedi o
  crea account" a tutto schermo, e quel pannello si mangia i tocchi. Qui non
  si apriva perché la libreria di Supabase arriva da una CDN irraggiungibile
  da questa macchina. Il messaggio d'errore non nominava il pannello: si è
  visto solo facendo stampare al lanciatore quaranta righe invece di sei.
- **Un'intercettazione che non combacia non si lamenta.** Nelle prove
  `'**/tile.openstreetmap.org/**'` non intercettava niente: quel modello vuole
  una barra prima di `tile`, e l'indirizzo vero è `a.tile.openstreetmap.org`.
  Le richieste passavano e la prova le guardava senza vederle, dicendo «zero
  chiamate». Quando una prova dice zero, va verificato che stesse davvero
  guardando.
- **Passare da `<img>` a `fetch` cambia chi ti dà il permesso.** Un'immagine da
  un altro sito si carica sempre; con `fetch` serve che quel sito lo consenta,
  e da una pagina aperta come `file://` non parte proprio. Per questo la copia
  delle tessere è facoltativa: se non riesce, la mappa si carica lo stesso come
  immagine. Si perde la copia, non la mappa.
- **Una CI che nessuno guarda è peggio di nessuna CI.** Dieci run su dieci
  erano rossi dal giorno in cui è stata messa, e due PR sono state fuse lo
  stesso: il verde si dava per scontato. Prima di dire che una modifica è a
  posto si guarda l'esito della CI, non solo `npm test` sulla propria
  macchina.
- **Un rimedio che non si riesce a far fallire non è un rimedio.** Il
  messaggio a comparsa sembrava coprire il tasto "annulla": misurato a 320,
  360 e 390 px, non lo copre mai. La correzione è stata tolta invece di
  tenerla "per sicurezza": una modifica su un'ipotesi non verificata è solo
  un'altra cosa che può rompersi.
- **Provare anche la strada, non solo la destinazione.** Una query SQL corretta
  può rompersi nel copia-incolla (stringhe di soli spazi che si spezzano). Se
  si chiede a qualcuno di incollare qualcosa, va provato *incollandolo*.

---

## Come si lavora qui

- **Tutto va su `main`**, senza chiedere: ramo `claude/geppgo-ripresa-*` → PR →
  squash merge → il ramo si riparte da `origin/main`.
- L'app è **un solo file**, `Index 2.1.html` (~12.000 righe).
- I commenti sono in **italiano** e spiegano *perché*, non *cosa*.
- Le prove stanno in **`test/`** e ci restano: prima vivevano in una cartella
  temporanea che spariva a fine sessione.
- `MAPPA_APP`, dentro l'HTML, è la mappa che l'assistente dell'app usa per
  rispondere: va aggiornata quando l'interfaccia cambia.
