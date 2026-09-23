# GeppGo — a che punto siamo

Aggiornato: 14 settembre 2026.

Questo file esiste perché le sessioni di lavoro non si ricordano fra loro.
Chi riprende in mano il progetto — Giacomo o un assistente — legge qui e sa
dov'era rimasto, senza rifare ragionamenti già fatti.

---

## ⚠️ DA FARE SUBITO

~~**Lanciare su Supabase lo schema aggiornato**~~ ✅ **fatto l'11 settembre**:
i sette permessi rispondono tutti `ok`, quindi la colonna `percorso_mini` (le
miniature) e la tabella `raccolte` («A raccolta») ci sono.

~~**Guardare in quale regione sta il progetto Supabase**~~ ✅ **fatto il 13
settembre**: `eu-north-1`, North EU (Stockholm). I server sono in Svezia,
dentro lo Spazio economico europeo — il caso migliore. `privacy.html` adesso
lo dice per nome e il paragrafo sulle clausole contrattuali standard non c'è
più: per conservare i dati non si esce dall'Europa.

Resta una cosa sola, e non è codice:

- **Far leggere a un avvocato la privacy policy**, in particolare la parte
  «A raccolta». Il riassunto pronto da mandargli, con le sei garanzie
  strutturali e le domande, sta in fondo a `PRIVACY-STORE.md` — dove ora c'è
  anche la domanda su Supabase Inc., che è una società statunitense pur
  tenendo i server in Svezia.

**Come si rilancia lo schema**, quando servirà di nuovo: Supabase → **SQL
Editor** → **New query** → incolla **tutto** il contenuto di
`supabase-schema.sql` (in GitHub: apri il file, tasto **Copy raw file**) →
**Run**. Alla fine deve dire *Success*: se compare un errore in rosso, **non**
proseguire e riportalo, perché vuol dire che il file si è fermato a metà
lasciando il database scoperto.

⚠️ **Il file si può rilanciare quante volte si vuole — ma solo dal 9
settembre.** Prima non era vero: al secondo lancio si fermava con *«cannot
drop function is_trip_member because other objects depend on it»*, perché la
pulizia toglieva quella funzione mentre i permessi delle foto ci si
appoggiavano ancora. Nessuna prova lo prendeva, perché tutte partivano da un
database dove quel file non era ancora passato. Adesso c'è una prova
(`rilanciabile`) che lo lancia **tre volte di fila** e ricontrolla i permessi
dopo.

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
   I server stanno a Stoccolma (`eu-north-1`), dentro lo Spazio economico
   europeo, e la policy lo dice per nome. **Resta una cosa che non è codice:**
   far leggere il testo a un avvocato — vedi in fondo a `PRIVACY-STORE.md`.
5. ~~**Test e CI nel repo**~~ ✅ fatto. `npm test` le lancia tutte;
   `.github/workflows/prove.yml` le fa girare da sole a ogni push e a ogni PR,
   con un Postgres vero per i permessi. Le prove che vivevano in una cartella
   temporanea sono tutte nel repo.
   **Il 5 settembre è diventata verde per la prima volta:** per dieci run era
   rossa e nessuno l'aveva guardata. Appena ha funzionato ha fatto uscire due
   difetti veri nel giro di mezz'ora — il pallino del GPS che tornava, e il
   pannello dell'account che si mangia i tocchi.

**I cinque blocchi per lo store sono chiusi.** Quello che resta prima di
pubblicare non è codice: l'avvocato e la società.

⚠️ **Con «A raccolta» (punto 13) la privacy policy è cambiata**: adesso c'è un
caso in cui una posizione viene conservata, ed è dichiarato in `privacy.html`
e in `PRIVACY-STORE.md`. Se il testo è già passato da un avvocato, quel pezzo
va rifatto vedere.

### Poi, per crescere

6. ~~**Cinque lingue**~~ ✅ **finito** (italiano, inglese, spagnolo, francese,
   portoghese). **803 frasi per lingua**, e a schermo **non resta più niente
   in italiano**.

   ⚠️ **Questa riga ha già detto una bugia una volta, il 13 settembre.** La
   prova diceva zero, e Giacomo ha aperto l'app in inglese e ha trovato
   «Esci», «Saldi», «Recupero», «Condividi», «Bagagli», tutti i tasti del
   Profilo. Il riconoscitore cercava frasi contenenti una parolina italiana e
   quelle parole non ne hanno nessuna. Adesso il metodo **confronta** la
   stessa schermata in italiano e nella lingua da provare, invece di
   indovinare: 801 frasi messe una accanto all'altra, nessuna uguale. Se un
   giorno questa riga dovesse tornare a mentire, il posto da guardare è il
   metro, non l'app. Superata la soglia dell'80%, **le lingue si
   accendono da sole**: chi apre l'app con il telefono in spagnolo la trova in
   spagnolo, senza che nessuno abbia toccato una riga di codice per
   accenderla. Era il modo di finire il lavoro senza mai lasciare l'app in
   mezzo al guado, e ha funzionato.
   Decisione cambiata il 5 settembre: non solo inglese, ma le lingue in cui
   arriva la gente. Per non rifare il lavoro a ogni schermata che cambia,
   prima si è costruito l'impianto e le lingue si versano dentro.

   **Come funziona, ed è la scelta che regge tutto:** la chiave del dizionario
   è *la frase italiana stessa*, non un codice. Niente tremila nomi da
   inventare, niente tremila punti del codice da toccare — e quello che non è
   ancora tradotto **resta in italiano** invece di mostrare
   `menu.spese.aggiungi` a qualcuno che sta viaggiando. La traduzione passa
   una volta sui nodi di testo della pagina (e su placeholder, title e
   aria-label) all'avvio e dopo ogni ridisegno.

   Due punti di passaggio obbligati, e sono il motivo per cui il lavoro è
   stato fattibile: `toast()` e `confirmDo()` traducono **da soli**. I messaggi
   nell'app sono 182 e le domande decine: metterci `t()` a mano sarebbe stato
   altrettante occasioni di dimenticarsene.

   **Le frasi cucite dal codice, e come sono state sciolte.** Erano l'ultimo
   pezzo rimasto in italiano e il più insidioso: «1 TAPPA», «Devi 12,00»,
   «GIAPPONE · GIORNO 1 DI 3», «3 luoghi». Cucite da pezzi funzionavano solo
   in italiano — altrove il numero va da un'altra parte, l'articolo cambia con
   la parola che segue e il plurale non si fa allo stesso modo. Ora la chiave
   del dizionario è **la frase intera con i buchi segnati `{1}`, `{2}`**, e si
   riempie con `tv('{1} TAPPE', n)`. Quello che esce da `tv()` è già nella
   lingua giusta e finisce in `GIA_TRADOTTE`, perché il conteggio della
   copertura sappia che è tradotto: senza quel passaggio queste frasi
   risultavano non tradotte **proprio perché** erano tradotte bene, e la
   percentuale in Profilo mentiva verso il basso.

   **Le date e i numeri seguono la lingua** (`loc()`, e `LOCALI` accanto a
   `fmtMoney`). Erano trentasette `'it-IT'` scritti a mano: «martedì 1
   settembre» in mezzo a una schermata inglese è la prima cosa che salta
   all'occhio, e «2.400,00» letto da un inglese fa due virgola quattro.

   Restano in italiano solo i nomi propri (GeppGo, Android, Google Maps), gli
   indirizzi e gli esempi che non si traducono («es. MXP» è un codice di
   aeroporto). La percentuale in Profilo si ferma sul 91% perché conta anche
   quelli, insieme ai nomi delle persone e alle cifre: è un numero onesto per
   difetto, non un lavoro a metà.

   **Misurare, non leggere.** L'elenco di cosa mancava è stato tirato fuori
   girando l'app con un browser vero, non guardando il codice. Due trappole
   pagate per intero: le chiavi ricopiate a mano da un elenco **troncato a 95
   caratteri** non corrispondevano a niente (si prendono per indice dal file
   misurato, mai a occhio), e il riconoscitore di frasi italiane segnalava
   frasi inglesi perché `\bi\b` prende anche l'«I» inglese — prima di
   chiedersi «sembra italiana?» bisogna scartare quello che è già una
   traduzione.

   `traduciPagina()` da solo non bastava: girava all'avvio e dopo un
   ridisegno, ma i pannelli che si riempiono al momento restavano indietro.
   C'è un `MutationObserver` che traduce quello che compare dopo.

   **Quello che resta fuori, e non per dimenticanza: `privacy.html` è ancora
   solo in italiano.** È un testo legale, e tradurlo vuol dire produrre
   quattro testi legali: va fatto insieme all'avvocato che deve già guardare
   la parte «A raccolta», non prima e non a parte. Da decidere con lui se
   basta la versione italiana con un riassunto, o se servono le quattro.

   Nelle prove le pagine nascono sempre in italiano (`test/browser.js`):
   ereditare la lingua del computer su cui girano vorrebbe dire provare l'app
   in inglese senza averlo deciso.

   Il metodo che funziona: **una frase per volta in tutte e quattro le lingue
   insieme**, non una lingua alla volta. Il dizionario le tiene allineate (c'è
   una prova che lo impone) e si passa sul testo una volta sola invece di
   quattro.

   **Una lingua si accende da sola solo all'80% del dizionario.** Sotto quella
   soglia l'app resta tutta in italiano anche se il telefono è spagnolo,
   perché un'app mezza tradotta è peggio di una tutta in una lingua sola: chi
   la apre pensa che sia rotta. Sceglierla a mano dal Profilo si può sempre.
   La soglia si regola da sé: man mano che il dizionario si riempie, le lingue
   si accendono senza toccare una riga di codice. **È il modo di finire il
   lavoro senza mai lasciare l'app in mezzo al guado.**

   La regola per chi scrive righe nuove: **una frase intera per volta, mai
   cucita da pezzi.** «Mancano 3 giorni» si scrive come una frase con un buco,
   perché in un'altra lingua le parole vanno in un altro ordine.
7. ~~**Cache delle ricerche POI**~~ ✅ fatto. Le risposte si tengono un giorno
   (un'ora se non hanno trovato niente) e si riusano se la ricerca di prima è
   stata fatta entro 150 metri. Non a griglia: due punti a venti metri
   finivano in celle diverse ogni volta che in mezzo cadeva un confine — l'ha
   trovato una prova, non un ragionamento.
8. ~~**Togliere gli slot pubblicitari vuoti**~~ ❌ **rimesso, ed è giusto così.**
   I nove riquadri erano stati tolti perché sembravano vuoti e inutili. Non lo
   erano: **fanno vedere la differenza fra il piano gratuito e il Premium.**
   Senza, i due piani sono identici a schermo e non si capisce che cosa si
   compra — e sono l'unico posto dell'app dove quella differenza si vede.
   Ora `PUBBLICITA_ATTIVA` è acceso: li vede chi non è Premium, non li vede
   chi lo è. Una prova tiene ferma proprio quella differenza, così non
   spariscono di nuovo.
   Il giorno che dentro ci finirà pubblicità vera vanno rifatte le schede
   privacy sugli store, perché la pubblicità cambia le risposte su
   tracciamento e identificatori.
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
12. ~~**Le miniature delle foto**~~ ✅ fatto l'8 settembre. Era il difetto di
    progetto scritto più sotto, fra i costi del cloud: ogni telefono si
    scaricava ogni foto di ogni viaggio, intera, per sempre. Ora di ogni foto
    parte anche una copia da 480 px nella stessa cartella del viaggio (quindi
    con gli stessi permessi, senza regole nuove); è quella che scende
    sincronizzando, e la foto vera arriva solo quando qualcuno la apre — una
    volta, e poi resta sul telefono. **Misurato nella prova: 1316 KB a foto
    prima, 34 KB adesso.** Chi la salva nel rullino se la prende comunque
    intera, nella qualità con cui è stata caricata.
13. ~~**A raccolta**~~ ✅ fatto l'8 settembre. Il tasto con cui chi organizza
    chiama gli altri quando bisogna ripartire e non ci si trova: sui telefoni
    dei compagni arriva un avviso col punto dove sta chi ha chiamato e il
    tasto «Portami lì», che apre il navigatore (Apple, Google o quello di
    GeppGo). Sta in home, in evidenza, e **lo vede solo un admin** di un
    viaggio condiviso con altre persone.
    ⚠️ **Qui una posizione esce dal telefono e arriva ad altre persone: è
    l'unico posto dell'app dove succede.** Le quattro cose che lo rendono
    accettabile sono strutturali, non buone intenzioni — 17 prove sul database
    e 39 sull'app le tengono ferme:
    - è la posizione di **chi chiama**, mai di chi riceve. Nessuno viene
      localizzato: uno dice dove sta, gli altri decidono se andarci;
    - è presa **in quell'istante** e **non si aggiorna mai**: non esiste
      nessuna policy di `update`, quindi nessuna riga può diventare un puntino
      che segue qualcuno per due ore;
    - la può scrivere **solo un admin**, e solo a nome proprio;
    - **scade in due ore**, e le due ore sono un `check` del database
      (`scade_il <= creata_il + 2 ore`) più la regola di lettura. Non è l'app
      a nascondere la riga: è il database a non consegnarla. Senza quel
      vincolo si sarebbe potuta scrivere una chiamata che dura un anno, e la
      privacy policy avrebbe detto una cosa falsa.

    L'avviso **a telefono spento vuole l'app nativa** e non c'è ancora. Con
    l'app aperta — anche in un'altra scheda — la chiamata arriva nell'istante
    in cui parte; riaprendo l'app si trova comunque, finché non è scaduta.
    Quando il telefono torna in mano l'app riattacca l'orecchio e ricontrolla,
    perché è esattamente il momento in cui la chiamata deve saltare fuori.

### Quello che resta, in ordine

14. **Rivedere il layout e i movimenti.** In corso.

    **Fatto il 13 settembre — al Profilo non si arrivava.** Le voci della
    pillola in basso chiedevano 426 px; su un iPhone da 390 ce ne sono 361.
    (Il 14 settembre il Meteo è uscito dalla barra e sono scese a otto: non
    basta lo stesso, la pillola scorre ancora anche su un Pro Max da 430.)
    Misurato su quattro larghezze: il **Profilo resta fuori su ogni telefono
    esistente**, anche su un Pro Max da 430, e a 390 resta fuori anche
    Identifica. Dentro il Profilo ci sono l'account, la lingua, i ripristini,
    la cancellazione e la scheda del viaggio: non può essere la voce che non
    si vede mai. La pillola scorreva già — è una scelta di progetto, scritta
    nel commento fin dall'inizio — ma non lo diceva a nessuno: scrollbar
    nascosta, nessun bordo sfumato, nessuno che portasse in vista la voce
    attiva. L'unico indizio era l'ultima icona tagliata a metà, che non sembra
    un invito a scorrere: sembra un difetto.
    Stringere le icone **non si può**: sono a 44,8 px e sotto i 44 si perde il
    bersaglio minimo del dito, sistemato apposta poche settimane fa. Quindi si
    è lavorato sull'onestà dello scorrimento: quando vai da qualche parte la
    pillola porta quella voce in mezzo.

    **Rifatto il 14 settembre, e adesso si capisce.** Le icone sono passate da
    23 a 27 px: a 23, camminando per una città che non conosci e con una mano
    sola, un'icona la guardi due volte prima di riconoscerla. E lo scorrimento
    non si annuncia più con un'ombra, si vede: la fila delle voci scorre in una
    **pista dentro la pillola**, e ai bordi le icone **svaniscono sotto il
    vetro** invece di essere tagliate di netto. Chi guarda non legge un
    messaggio — vede che di là c'è dell'altro, e la mano va da sola. La
    sfumatura sta solo dalla parte dove c'è davvero qualcosa: arrivati in
    fondo quel lato torna netto, ed è l'unico modo per sapere che è finita.

    **Fatto il 14 settembre — il meteo è uscito dalla barra ed è salito in
    cima.** Era una delle nove voci in basso, cioè una sezione dove andare. Ma
    che tempo fa non è un posto: è una cosa che si guarda di sfuggita dieci
    volte al giorno mentre si sta facendo altro, e per farlo si dovevano
    lasciare la home, guardare, e tornare indietro. Adesso sta **in cima alla
    home**, di fianco ai nomi dei viaggi, in un riquadro che disegna il cielo
    di quella giornata; toccandolo scende una tendina dall'alto con la
    giornata in grande, le **ore una per una**, e sotto tutti i giorni del
    viaggio. La barra in basso ci ha guadagnato una voce in meno.

    Il cielo è **disegnato, non scaricato**, e non è una scorciatoia: una
    fotografia vera vorrebbe dire chiamare un servizio di immagini a ogni
    giornata — un altro nome nella privacy, un'altra cosa che smette di
    funzionare in aereo. Così è tutto CSS: sfumatura per il tipo di cielo,
    sole o luna con l'alone, nuvole sfocate che passano, pioggia su due
    strati, il bagliore e la saetta nel temporale, le stelle quando è sereno
    di notte. Costa niente, funziona senza rete, e cambia davvero col tempo
    che fa.

    **Rifatto lo stesso giorno: il primo tentativo era un riquadro, ed era
    sbagliato.** Avevo messo il cielo dentro una card da 120×54 in fondo alla
    riga dei viaggi, con dentro la temperatura e — quando la previsione non
    c'era ancora — la scritta «fra 9 gg». Giacomo l'ha guardata e ha detto che
    era brutta: *deve esserci un'immagine bella grande fusa con lo sfondo*, e
    quanti giorni mancano lo dice già l'anello della prossima tappa poco più
    sotto. Aveva ragione su tutt'e due le cose. Un riquadro, per quanto
    curato, resta un oggetto in più su una schermata già piena; e riempire di
    parole il posto dove doveva esserci un'immagine è il contrario di quello
    che serviva.

    Adesso il meteo **è lo sfondo dell'intestazione**: il colore in alto lo
    decide il tempo che fa e si scioglie nella carta della pagina esattamente
    dove si scioglieva prima — cambia il colore, non il modo in cui finisce.
    Sopra ci passa un velo con la scena, che svanisce verso il basso invece di
    finire con un taglio (un taglio si vede, ed è quello che fa sembrare
    un'immagine incollata). Non chiede spazio a niente, perché sta dove il
    fondo stava già. La temperatura resta, **senza scatola intorno**, in fondo
    alla riga dei viaggi. Se la previsione non c'è, non c'è nulla: nessun
    cielo finto, nessuna scritta, l'intestazione di sempre.

    Le misure della scena sono in **pixel**, non in `em`, e c'è un motivo: una
    goccia di pioggia è una goccia, non diventa otto volte più grande perché
    la finestra è più grande. Quello che cambia è `--s`, e sposta di poco: 1
    nell'intestazione, 0,62 nel riquadro della tendina.

    **Il sole stava a cavallo del bordo.** Misurato: il disco partiva quattro
    pixel sopra l'inizio del velo, e la linea in alto lo tagliava di netto —
    insieme all'alone, che è proprio la parte che lo fa sembrare luce e non un
    cerchio giallo. Fra l'inizio del velo e la riga dei viaggi ci sono 72 px,
    quindi lo spazio c'era: adesso è un disco da 52 con **9 px d'aria sopra e
    11 prima delle pillole**. E l'alone è diventato **doppio** — uno stretto e
    denso attaccato al disco, uno largo e molto più tenue — perché uno solo,
    largo 78 px e alla stessa intensità del nucleo, arrivava fin sotto la
    temperatura e si leggeva come una macchia gialla addosso al numero. Tre
    controlli geometrici lo tengono fermo: tutto dentro, lontano dalle pillole,
    lontano dalla temperatura.

    Una cosa che il disegno impone al testo: quando il cielo in alto è scuro
    (pioggia, temporale, notte) l'intestazione prende la classe `cl-buio` e i
    nomi dei viaggi passano all'inchiostro chiaro. Inchiostro tenue su un
    temporale non si legge, e non è un dettaglio estetico: è la riga con cui
    si cambia viaggio.

    **⚠️ Il difetto più grosso che il meteo abbia mai avuto, e dal codice non
    si vedeva.** Un viaggio con destinazione **«Giappone»** prendeva le
    previsioni dal **centro geografico del Giappone**: cercando un paese,
    Nominatim risponde col suo centroide — le montagne del Gunma, mille metri
    di quota, forse il posto più diverso da Tokyo che ci sia in Giappone. Le
    previsioni erano giuste, era il *posto* a essere sbagliato, e si leggeva
    «1 grado e neve» mentre a Tokyo ce n'erano venti. **Lo ha trovato
    Giacomo usandola, non la suite.**

    Adesso: un paese intero non è un posto, e non si usa (si guarda
    `addresstype`/`place_rank` di Nominatim, che ora vengono salvati). Prima
    di rinunciare si prova con le **tappe delle giornate intorno** — se il 3
    è vuoto ma il 2 e il 4 sei a Kyoto, Kyoto è una risposta e il centro del
    Giappone no — poi l'hotel, poi le città del viaggio. Quando è
    un'approssimazione il riquadro lo dice con un `≈` davanti al nome del
    posto. E se davvero non si sa dove guardare, **si dice quello** invece di
    mostrare un numero preso a caso: *«Giappone» è un paese intero: aggiungi
    una tappa o una città*.

    **Sulla fonte:** 3B Meteo non ha un'API pubblica gratuita, servirebbe una
    licenza commerciale. Open-Meteo, che usiamo già, è gratuito, senza chiave,
    e instrada da solo sul modello nazionale del posto — per il Giappone
    **JMA**, il servizio meteorologico giapponese, cioè la stessa fonte che
    qualunque altro servizio rivenderebbe. Il problema non era la fonte.

    **⚠️ E il secondo difetto, più silenzioso del primo: una previsione non
    si aggiornava mai.** Una volta scaricata restava lì per sempre — si
    rifaceva solo cambiando le tappe o premendo il tasto a mano. Quindi una
    previsione per domani presa una settimana fa stava a schermo con l'aria
    di essere fresca, e uno ci fa la valigia. **Peggiore del primo proprio
    perché non si vede**: col Giappone almeno il numero era strano, qui è
    plausibile e sbagliato.

    Ora ogni previsione porta l'ora in cui è stata presa (`preso`), e **scade
    da sola**: per oggi e domani dopo un'ora, entro tre giorni dopo tre ore,
    più in là dopo dodici — più lontano si guarda, meno cambia da un'ora
    all'altra. Quando è scaduta si rifà senza che nessuno prema niente, al
    massimo una volta ogni venti minuti per non martellare un'API che non è
    nostra. Le previsioni salvate prima di questa modifica non hanno l'ora:
    contano come scadute e si rifanno una volta, quindi si sistema da sé.

    E di fianco al nome del viaggio, nella tendina, c'è scritto **da quanto
    sta lì** («vista 20 min fa»): è l'unico modo di accorgersene senza doversi
    fidare.

    **Coordinate che non vogliono dire niente.** Zero-zero è un punto
    nell'oceano al largo della Guinea, ed è quello che esce da una tappa
    salvata male o da un geocodificatore che non ha trovato niente. Adesso
    ogni punto passa da un controllo prima di diventare una domanda al meteo:
    numeri finiti, latitudine entro il polo, e non lo zero-zero.

    **La pioggia, rifatta tre volte.** Il primo tentativo erano trattini
    fitti tutti alla stessa velocità: una grata che si muove, non pioggia. Il
    secondo, gocce ferme sul vetro disegnate ad anello: sembravano bolle di
    sapone, e Giacomo l'ha detto subito. Quello che mancava a tutti e due non
    era la velocità né la forma: era la **varietà**. La pioggia vera non ha
    due gocce uguali — una è lunga e vicina, quella dietro è corta e
    sbiadita, e nessuna delle due cade come l'altra.

    Adesso non c'è più una piastrella ripetuta: ci sono **ventisei gocce (o
    quarantaquattro se piove forte), una per una**, ognuna con la sua
    lunghezza, il suo spessore, la sua trasparenza e la sua velocità. Le
    sbiadite sono le lontane e cadono un filo più piano, ed è così che
    l'occhio legge la profondità in una scena piatta. I numeri sono sparsi ma
    sempre gli stessi (il vecchio trucco del seno): con `Math.random()` la
    pioggia salterebbe di posto a ogni ridisegno della home.

    **Sulla velocità ci si è sbagliati due volte, in due direzioni opposte.**
    Prima troppo veloce e tutte uguali: una grata che si muove. Poi, per
    correggere, l'ho fatta lenta — due, tre secondi per goccia — e Giacomo:
    *«hai mai visto una pioggia così lenta? Sembrano stelle cadenti»*. Aveva
    ragione. **Quello che impedisce alla pioggia di sembrare una grata non è
    la lentezza, è che non ce n'è una uguale all'altra.** Ora sta a mezzo
    secondo scarso, e le strisce sono corte: una striscia lunga che scende
    adagio non è pioggia, è una stella cadente — la lunghezza va con la
    velocità, non contro.

    Una cosa contata, non guardata a occhio: la caduta arriva a 330 px e non
    a 600, perché **su ventisei gocce ne arrivava UNA** nella fascia in cui
    si guardano — tutte le altre passavano la vita nella parte già dissolta
    dalla maschera.

    **Il «+» si è spostato di fianco ai viaggi.** Stava all'estremo destro
    della riga, staccato dai nomi a cui appartiene. Adesso gli sta appiccicato,
    e resta **fuori** dallo scorrevole apposta: se scorresse insieme ai nomi,
    con tre viaggi in lista non lo vedresti mai. I nomi, dove la fila continua,
    **svaniscono** invece di essere tagliati di netto — la stessa cura data
    alla barra in basso, e per la stessa ragione: un nome mozzato sembra un
    difetto, un nome che sfuma dice «scorri».

    **Le ore si chiedono solo per la giornata che stai guardando**, e solo
    quando la tendina è aperta: sono una chiamata in più a un'API che non è
    nostra, e chiederle per tutti i sette giorni quando ne guardi uno
    sarebbe sprecarne sei. Non si salvano sul telefono — fra un'ora sarebbero
    già vecchie.

    **E per strada è saltato fuori un buco vecchio.** Le parole del tempo —
    «pioggia leggera», «cielo limpido», «mattina piovosa», l'avviso della
    pioggia in time-table con le tappe all'aperto a rischio — **non erano
    tradotte in nessuna delle quattro lingue**, e la prova non poteva
    accorgersene: il viaggio di prova non aveva meteo, quindi quelle frasi non
    si disegnavano mai. Adesso il viaggio di prova ce l'ha, e sono tradotte
    tutte e sessantanove. Due erano cucite a pezzi e a pezzi non si traducono:
    la chiave è la frase intera col buco.

    **Fatto — al buio, senza campo, la mappa non è più una lastra chiara.** Il
    riquadro che sostituisce le tessere mancanti era disegnato una volta sola
    all'avvio, color crema, e non sapeva niente del tema: veniva fuori una
    lastra chiarissima in mezzo a una schermata nera, e **proprio nella
    situazione per cui la mappa offline esiste** — all'estero, senza rete,
    quasi sempre di sera. Adesso ce n'è uno per tema e quelle già appese
    vengono ridipinte quando il tema cambia.

    **Fatto — la giornata si apre dov'è la giornata.** La griglia della Time
    Table parte dalle 06:00 perché lì comincia il sistema di coordinate, ma
    nessuno ha una tappa alle sei: si aprivano due ore e mezza di righe vuote
    e la prima tappa restava sotto la piega (misurato: a 507 px su uno schermo
    da 844). La griglia non si tocca — i riquadri e il trascinamento contano
    tutti da quell'ora — si sposta lo sguardo: si apre sulla prima tappa, o su
    *adesso* se è oggi e siamo in mezzo alla giornata, con un'ora di griglia
    sopra per capire che è una linea del tempo e non un elenco.

    **Risolto il 14 settembre — i quattro tasti erano due cose diverse.**
    Erano quattro inviti in tre stili diversi, uno accanto all'altro, e
    spingevano la giornata sotto la piega. La domanda giusta non era «quali
    tolgo» ma «quali si usano quando»: Giacomo ha risposto che **«Naviga la
    giornata» e «Chiedi all'assistente» si usano camminando**, mentre
    **«Ordina il giro con l'IA» e «Autopilota» si usano in fase di
    prenotazione e costruzione del viaggio**. Quindi i due da strada restano
    in vista, uguali fra loro e larghi uguale — un invito solo, in due modi —
    e i due da tavolino stanno dietro «Costruisci la giornata», dove ognuno
    ha una riga che dice cosa fa (perché «Autopilota» da solo non lo sa
    nessuno).

    **Rifatta l'aria della Time Table.** Era l'unico posto dell'app rimasto
    coi rettangoli color sabbia e il bordo di un pixel, mentre tutto il resto
    è passato a schede bianche con l'ombra morbida: sembrava una schermata di
    un'altra app, più vecchia. Adesso le tappe sono schede come le altre, col
    nome nel serif con cui l'app scrive i nomi e una **bandella d'oro** sul
    fianco che le fa leggere come una fila anche quando sono lontane fra
    loro. La riga dell'ora parte **dopo** la colonna delle ore, così il numero
    non ha più bisogno di un rettangolo bianco dietro per tagliarla — ed era
    quel rettangolo, più di ogni altra cosa, a farla sembrare una tabella di
    vent'anni fa. Le targhette dei tratti hanno perso il bordo tratteggiato.
    Sulla testata avevo provato a fare come la home — occhiello piccolo e
    grande **la data**, perché la cosa di cui parla la schermata è il giorno —
    e **Giacomo l'ha bocciata**: il titolo è tornato «Time Table», con la data
    sotto. La ragione regge: alla time-table ci si arriva anche da un link o
    dopo aver messo giù il telefono, e «Lunedì 14 settembre» da solo non dice
    in che parte dell'app sei finito. Il nome della schermata non è un
    doppione, è un appiglio.

    **E adesso dice a che punto della giornata sei.** Una riga color mattone
    attraversa la griglia all'ora che è adesso, con l'orario scritto nella
    colonna, e **si sposta da sola** ogni minuto — spostando solo la riga, non
    ridisegnando la giornata: un ridisegno ogni minuto farebbe saltare un
    trascinamento a metà. Su un giorno che non è oggi non compare: una riga
    che non vuol dire niente uno la legge lo stesso.

    **Fatto l'8 settembre — i fogli salgono davvero.** Era il difetto più
    longevo del progetto: la salita era scritta nel CSS dal primo giorno,
    sembrava giusta, e **non è mai partita**. Misurata fotogramma per
    fotogramma, il foglio era già arrivato al primo frame — in *tutti* i fogli
    dell'app, e sono decine. Chiudendoli, sparivano invece di scendere.
    Ora salgono (111 → 88 → 68 → 51 → 36 → 23 → 13 px), scendono, non si
    mangiano i tocchi mentre scendono, ed escono dal layout quando hanno
    finito. Anche i tre punti che chiudevano «a mano» passano da `closeSheet`.

    **Fatto — «riduci il movimento».** L'app non guardava l'interruttore che
    iPhone e Android hanno apposta. Per chi soffre di vertigini o emicrania
    non è un vezzo. Ora le animazioni non spariscono, **diventano istantanee**:
    tutto arriva dov'era diretto, senza il viaggio — togliere le animazioni e
    basta lascerebbe le cose a metà strada.

    **Fatto — tutto quello che si tocca arriva a 44×44.** Misurato: la barra
    in basso era alta 41 px, le scorciatoie della home 27, il «+» della
    giornata 26, la X della pubblicità 14, i tasti a icona delle liste 30 e
    32. Apple indica 44 come minimo e qui non è burocrazia: l'app si usa
    camminando, con una mano sola, e un tasto da 27 px lo si sbaglia.
    **L'aspetto non è cambiato**: cresce solo l'area invisibile che risponde
    al dito (`::after`), che è il mestiere che fa iOS per conto suo. Due sole
    cose si vedono, e sono volute: i due tondi col «+» erano più piccoli di
    qualunque altra cosa nella loro riga e non sembravano tasti, e le
    scorciatoie della home hanno più aria fra una riga e l'altra — è lo spazio
    che serve perché la riga di sotto non si prenda i tocchi di quella sopra.
    La prova controlla tutt'e due le cose: la misura **e** che nessuna area
    rubi il tocco alla vicina.

    **Fatto — il giorno vuoto è un tasto, non un cartello.** Diceva *«tocca il
    titolo per aprire la giornata»* e mandava la persona a cercare un titolo,
    mentre il tasto che fa quella cosa le stava due centimetri sopra: adesso
    il riquadro **è** il tasto e dice «Aggiungi la prima tappa».

    Avevo fatto lo stesso a spese e biglietti, ed era sbagliato: **quelle due
    schermate avevano già l'azione a un centimetro di distanza** — un tasto
    «Aggiungi spesa» sotto, e in cima ai biglietti tutta una scheda «Aggiungi
    biglietto» con tre modi. Il risultato erano due tasti identici uno sopra
    l'altro. Tolto. La regola: *prima di aggiungere un'azione a una schermata,
    si guarda la schermata* — con uno screenshot, non a memoria.

    **Fatto — i Biglietti dicevano di non avere quello che avevano.** Il
    filtro «di chi vuoi vedere i biglietti» partiva su **te** quando il
    viaggio ha più di una persona. Ma i biglietti sono per le **attrazioni** —
    un ingresso al castello preso per il gruppo non è «di» nessuno in
    particolare — e quasi mai uno si ferma a dire di chi è ciascuno. Così
    aprendo la sezione si leggeva *«Nessun biglietto intestato a Gepp»* mentre
    il viaggio i biglietti ce li aveva, e l'unico appiglio era una scritta
    grigia da dodici pixel. Partire da te sembrava un riguardo ed era un
    inganno: adesso si parte da **tutti**, e il filtro per persona resta come
    affinamento.

    E l'aria: i tre modi per aggiungere un biglietto erano **tre tasti in due
    stili** (uno pieno, due vuoti), come se il primo contasse più degli altri
    — e non è vero, dipende solo da dove ce l'hai il biglietto. Adesso sono
    tre tasti uguali, con l'emoji sopra e la parola sotto: andando a capo da
    sole le etichette si spezzavano ognuna a modo suo, e se il capo è voluto
    diventa un incolonnamento. Le **sei righe di grigio** prima di poter fare
    qualcosa — il muro di testo più alto dell'app — sono dietro «Come funziona
    la lettura»: sono cose vere e vanno tenute, soprattutto quella sul codice
    che leggendolo non si consuma, ma si leggono una volta, non a ogni
    apertura.

    Infine i gruppi dicono anche **quando**: «Castello di Praga · Giorno 2 ·
    mar 15 set · 11:00». Un biglietto è di un'attrazione ma anche di un
    momento, e prima quella metà non c'era. E i biglietti non attaccati a
    nessuna tappa hanno un titolo loro invece di restare orfani in fondo.

    **Fatto — Hotel non diceva quali notti hai coperto.** Un viaggio dal 14
    al 18 ha **quattro** notti. Se un albergo copre il 14-16 e un altro il
    17-18, la notte del 16 non ce l'ha nessuno — e la schermata mostrava due
    schede piatte con le loro date, lasciando la sottrazione a chi guardava.
    È la domanda per cui una pagina di alloggi si apre, e non aveva risposta.

    Adesso in cima c'è la **striscia delle notti**: una casella per notte,
    piena se un letto c'è e tratteggiata se manca, e sotto una riga che dice
    quale notte manca *col suo nome* e il tasto che porta sulla ricerca. Con
    tutto coperto la riga lo dice piano e il tasto sparisce: un tasto che non
    serve è rumore. Senza nessun alloggio la riga dice «Nessuna delle 4 notti
    ha un letto» — non «mancano 4 su 4», che è un conto inutile — e il tasto
    diventa quello pieno, perché lì è l'unica cosa da fare. Il cartello
    «Nessun hotel: cercalo qui sopra» — un cartello che indicava in su —
    non c'è più: resta solo nei viaggi **senza date**, dove di notti non ce
    n'è nessuna da disegnare, e lì ha l'azione accanto.

    E due cose che c'erano e non si vedevano: **quanto costa** l'albergo e se
    è **ancora da pagare** stavano nel viaggio da sempre, nella spesa
    collegata, ma per saperlo bisognava andare in Spese a cercare la riga.
    Adesso sono due targhette sulla scheda, insieme a quante notti copre.
    Il tasto pieno «Portami qui» compare **solo sull'albergo di stanotte**
    (prima di sera, su nessuno): ripetuto su ogni scheda faceva urlare tutte
    le sere insieme, e la strada serve per il letto di adesso. E i due
    tondini senza nome in alto a destra adesso hanno un nome per chi non
    vede le icone.

    **Fatto — gli ultimi stati vuoti, guardati uno per uno.** Guardarli era
    la parte importante, e ha dato tre risposte diverse:

    - **«Nessun luogo salvato»** e **«Niente in time-table, per ora»**, i due
      riquadri in fondo a Scopri: erano cartelli davvero. Per il primo
      l'azione — la ricerca — sta in cima alla *stessa* pagina, ma dopo una
      schermata intera di scorrimento, e «a un centimetro» lì non valeva; per
      il secondo l'azione sta proprio in un'altra schermata. Adesso hanno
      «Cerca un posto» (che riporta sulla ricerca e ci mette il cursore) e
      «Apri la time-table».
    - **La time-table vuota** non prende niente: la griglia *è* la cosa, e il
      «+» che la riempie è già lì in fondo a destra. Un riquadro «niente qui»
      sopra uno strumento che funziona sarebbe solo rumore.
    - **«Nessuna voce ancora» nei bagagli** quasi non si vede mai: la lista
      arriva già scritta, generata da durata, meteo e attività. Lasciato
      com'è.

    `test/prova-vuoti.js` tiene ferme tutt'e tre le risposte, compresa quella
    negativa: la prova fallisce anche se qualcuno aggiunge un cartello alla
    time-table vuota.

    **Quello che resta di questo punto:** le attese (oggi l'app dice «Cerco…»
    a parole, che è onesto e leggibile — non serve metterci scheletri sopra
    per forza). Il passaggio fra una schermata e l'altra è stato misurato ed è
    già a posto: è un'`animation`, che a differenza di una `transition` parte
    anche su un elemento appena mostrato.
15. **Poi l'app nativa, e non prima.** Prima si mette a posto tutto sul link —
    funzioni, aspetto, lingue — e solo dopo ci si muove sul nativo, dove ogni
    modifica costa una pubblicazione invece di un salvataggio. Quello che il
    nativo sblocca e che oggi non si può avere: **gli avvisi a telefono
    spento** (che servono ad «A raccolta» e agli avvisi di partenza), gli
    acquisti dentro l'app per il Premium, e la presenza sugli store.

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
450 MB di spazio e — **prima delle miniature** — 2,25 GB di traffico. Il
gratuito dà 1 GB di spazio e ~5 GB di traffico: un solo viaggio ne consumava
metà.

**Con le miniature** (fatte l'8 settembre 2026) lo stesso viaggio scarica
~10 MB in tutto invece di 2,25 GB, più le foto che qualcuno apre davvero.
Misurato nella prova: **1316 KB a foto prima, 34 KB adesso — 38 volte meno.**
Lo spazio sale invece del 2,5% (la copia piccola si paga in archivio, ma
l'archivio costa quattro volte meno del traffico).

Col Pro (100 GB spazio, ~250 GB traffico) ci stanno ~100 viaggi al mese.
Oltre, si paga a consumo: ordini di grandezza ~0,02 $/GB al mese di spazio e
~0,09 $/GB di traffico. **Verificare su supabase.com/pricing: i prezzi
cambiano.**

**Le due leve:**
- La qualità scelta al caricamento è anche una manopola dei costi: Leggera
  (145 KB) contro Alta (1,5 MB) contro Originale (5,6 MB) sono dieci e
  quaranta volte tanto.
- ~~Il difetto di progetto che si sarebbe pagato: l'app scaricava *ogni foto
  di ogni viaggio sul telefono di ognuno, per sempre*.~~ **Fatto.** Di ogni
  foto parte anche una copia da 480 px (`<id>-mini.jpg`, stessa cartella,
  stessi permessi, colonna `percorso_mini`): è quella che scende
  sincronizzando, e la foto piena scende solo quando qualcuno la apre — e da
  lì in poi resta sul telefono. Chi scarica la foto nel rullino se la prende
  intera, sempre. Le foto caricate prima di questa modifica non hanno la
  copia piccola: per quelle si continua a scaricare l'intera, e va bene così.

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

- **Un ripiego in fila fa pagare al caso lento tutta l'attesa.** Il
  telefono chiedeva al ponte e aspettava; solo se il ponte falliva provava
  da solo. Dalla memoria il ponte risponde in meno di un secondo, ma quando
  deve andare fuori ci mette fino a diciotto — e quei diciotto li pagava
  chiunque cercasse qualcosa che la memoria non aveva: «le ricerche sono
  ancora molto lente». Adesso il ponte ha **un vantaggio, non
  l'esclusiva**: due secondi e mezzo tutti per sé, poi parte anche la
  strada diretta e vince il primo che porta una risposta *vera* (non il
  primo che risponde: «sto ancora cercando» non deve battere chi sta per
  trovare). `prova-ponte` misura il tempo — 3,5 s contro 15 — perché una
  prova che guarda solo se la risposta arriva era verde anche prima.
- **⚠️⚠️ UN SERVER PUÒ MENTIRE BENE, E ERA QUESTO.** «Il bancomat ce l'ho
  davanti a casa e non lo trova», «la fermata dell'autobus a cento metri e
  non la trova». Il colpevole era `overpass.osm.ch`: rispondeva **200, senza
  nessun errore, in sei decimi di secondo, con la lista vuota** — il suo
  database era vuoto. E siccome l'app chiede a più server in corsa e prende
  il primo che risponde, **vinceva sempre lui**: essere rotto lo rendeva il
  più veloce. Per qualunque ricerca, ovunque, la risposta era «qui non c'è
  niente». Non c'era niente da guardare in quella risposta: nessun errore,
  nessun `remark`. L'unica cosa che la smaschera è
  `osm3s.timestamp_osm_base`, la data dei dati, che lì era `117204`.
  La regola, adesso in due copie (l'app è un file solo e non può importare):
  **un «non c'è niente» si crede solo a chi sa dire di quando sono i suoi
  dati**; una risposta che contiene dei posti si prende comunque, così la
  regola non può far peggio di prima. `prova-bugie` prova la regola, prova
  che le due copie dicono le stesse cose, e rimette in piedi il caso vero —
  tolta la regola, l'app torna a dire «non risulta nessun bancomat» con un
  bancomat a cento metri.
  Tre cose da portarsi via: **essere rotti può rendere un server il più
  veloce, quindi il vincitore di una corsa è il più sospetto, non il più
  affidabile**; un servizio che va giù e basta è il caso fortunato, quello
  che risponde male è il caso difficile; e i finti delle prove che
  semplificano nascondono esattamente i guasti che vivono nella parte
  semplificata — `{elements: [...]}` senza il resto ha tenuto nascosto
  questo per settimane. Il modo di scoprirlo è stato **chiedere a ogni
  server, uno per uno, la stessa domanda** e guardare cosa risponde: è il
  workflow «Il ponte risponde?».
- **Un conto alla rovescia che cancella quello che sta annunciando.** Quando
  il ponte dice «sto ancora cercando», l'app aspetta nove secondi e riprova
  da sola, mostrando i secondi che scendono. Il conto, arrivato a zero,
  chiamava la funzione che spegne l'attesa — e quella spegne *anche* la
  riprova, che scattava nello stesso istante. Risultato: il messaggio
  prometteva una riprova che non arrivava mai, e nessun errore da nessuna
  parte. **Due timer che finiscono insieme vanno spenti uno per uno**: una
  funzione «ferma tutto» chiamata da dentro uno dei due ferma anche l'altro.
  L'ha trovato `prova-ponte`, che invece di guardare il messaggio aspetta e
  conta le richieste che partono davvero.
- **⚠️ Le prove parlavano col servizio VERO, e su questo computer non si
  vedeva.** Da quando c'è il ponte, l'app prima della mappa chiede a
  `cyolhqndurgwbivxcssf.supabase.co` — il servizio che risponde ai telefoni
  delle persone. Le prove intercettavano Overpass e non il ponte. Qui dentro
  la rete verso il ponte non passa: l'app ripiegava su Overpass, che era
  intercettato, e tutto sembrava a posto. **Sul server delle prove
  automatiche la rete c'è davvero**: il ponte rispondeva sul serio, con
  quello che c'è intorno a quelle coordinate *oggi*, il finto Overpass non
  veniva interrogato mai, e cinque prove diventavano rosse — una schiantandosi
  su `chiamate[0]` che non esisteva. Il rosso era il meno: una prova che parla
  col servizio vero non prova niente, e stava anche scrivendo nella memoria
  condivisa vera. Adesso in `test/browser.js` c'è **il recinto**: passa solo
  il guscio (pacchetti e caratteri delle CDN), tutto il resto o se lo
  intercetta la prova o non succede, e le rotte della prova vincono perché
  Playwright guarda prima l'ultima registrata. La regola generale:
  **quando l'app comincia a chiamare un servizio nuovo, la prova che non lo
  intercetta non fallisce — mente.** `prova-recinto` è il posto dove si
  controlla che il recinto ci sia ancora.
- **Un filtro con un valore di partenza può nascondere tutto quello che hai.**
  I biglietti partivano filtrati su «te», e chi non assegna i biglietti a
  nessuno — cioè quasi tutti — apriva la sezione e leggeva «nessun biglietto»
  con tre biglietti dentro. Un valore di partenza che *toglie* roba dalla
  vista va scelto col caso normale in testa, non col caso ordinato.
- **Una schermata che mostra i pezzi e non il totale lascia il conto a chi
  guarda.** Hotel mostrava due schede con le loro date — 14-16 e 17-18 — e
  la notte del 16, che non ce l'aveva nessuno, la doveva trovare l'utente
  sottraendo a mente. Ogni schermata che elenca cose che coprono un periodo
  (le notti, le assicurazioni, i trasporti) deve dire **quanto del periodo
  è coperto e quanto no**, prima di elencare i pezzi: è la domanda per cui
  quella schermata si apre.
- **Un dato salvato e mai mostrato non esiste.** Il costo dell'albergo e se
  fosse pagato stavano nel viaggio da sempre, nella spesa collegata, e in
  Hotel non si vedevano: per saperlo si andava in Spese a cercare la riga.
  Quando si aggiunge un campo, si guarda anche **dove lo si legge**.
- **⚠️ Un numero di versione scritto a mano mente dopo la seconda volta.**
  In Profilo c'era `GeppGo · build r91`, una stringa messa lì una volta e
  mai più toccata: dopo decine di modifiche diceva ancora r91. Il costo si
  paga quando una cosa nuova non si vede e la domanda diventa «è arrivata,
  o sto guardando quella di ieri?» — senza una riga vera si tira a
  indovinare. Ora c'è **una** costante `VERSIONE_APP` (una data) e tutti i
  posti che la mostrano leggono quella. **Va cambiata a mano a ogni cosa
  nuova che vale la pena vedere, e va cambiata insieme a `CACHE_NAME` in
  `sw.js`.** `prova-versione` controlla che i due posti dicano la stessa
  cosa e che il nome della copia sia cambiato.
- **Perché si può restare indietro di un deploy.** Tre memorie diverse, e
  vanno svuotate tutte: la copia del service worker (`caches`), la
  registrazione del service worker stesso, e la memoria del browser — che
  non si svuota, si aggira ricaricando con un indirizzo diverso
  (`?v=<adesso>`). È quello che fa «Cerca la versione più recente» in
  Profilo. Il **cancelletto in coda va conservato**: i link d'invito ci
  passano dentro, e un aggiornamento che se lo mangia manda la persona su
  un'app vuota senza farle capire perché.
- **Le date del viaggio finto vanno costruite col calendario del BROWSER.**
  `prova-cielo` le costruiva in Node all'avvio e la pagina si apriva un
  istante dopo: una corsa partita alle 23:58 e finita alle 00:05 ha visto
  il meteo «di oggi» arrivare in pagina già datato ieri, e tre righe sono
  andate rosse per niente. Ora `metti(page, st)` riscrive le date dentro
  `addInitScript`, con l'oggi del browser — **in una passata sola, con una
  tabella**: sostituendone una per volta la seconda si mangia quello che
  ha appena scritto la prima (oggi→domani, poi domani→dopodomani).
- **Una prova che dipende dall'ora, a certe ore non prova niente.** «La
  fila delle ore è scorsa su adesso» controllava `scrollLeft > 0`: a
  mezzanotte «adesso» è la prima casella, la fila giusta ha `scrollLeft`
  zero, e la riga cadeva pur essendo tutto a posto. Peggio: alle nove di
  sera sarebbe passata anche su un'app che non scorre affatto. Adesso si
  misura la promessa vera — *«adesso» sta dentro la finestra* — e l'ora
  del posto la fissa la prova stessa, col fuso, alle 17:00. Verificata
  togliendo lo scorrimento dall'app: la casella finisce a 1006px su 353 di
  finestra, e la riga diventa rossa.
- **Confrontare due letture dell'orologio è una monetina.** La targhetta
  della riga «adesso» viene scritta quando la riga si disegna; la prova
  rileggeva l'ora un attimo dopo e pretendeva che fossero identiche. A
  cavallo del minuto — su CI, alle 23:15 — sono giuste tutt'e due. Un
  minuto di tolleranza non ammorbidisce niente (un'etichetta sbagliata è
  lontana ben di più: verificato spostandola di cinque minuti, e infatti
  diventa rossa) e toglie la prova dalle mani del caso.
- **Una prova non deve misurare come un numero è scritto, ma che ci sia.**
  `/2[.,]400/` passava qui e cadeva su CI, dove lo stesso importo si scrive
  `2400,00`: le migliaia le raggruppa la lingua della macchina. Si tolgono
  le cifre dal resto (`.replace(/\D/g,'')`) e si cerca `2400`. Vale per date,
  orari e valute: **il fatto, non la punteggiatura.**
- **⚠️ Non cancellare voci di dizionario con un regex.** Le voci stanno
  parecchie per riga: un `'📷 Scansiona':'…',` tolto da una riga si porta via
  il contesto delle altre, e soprattutto può essere una voce che serviva a un
  ALTRO tasto. È successo: `'📷 Scansiona'` era usato anche nella scheda
  «aggiungi attività», e toglierlo l'avrebbe lasciato in italiano nelle
  quattro lingue. Se ne accorge solo `prova-lingue` — o nessuno. Prima di
  togliere una chiave, si cerca **dove è usata**, non dove è scritta.
- **`MAPPA_APP` invecchia in silenzio.** È il foglio che l'assistente ha
  davanti quando qualcuno gli chiede dov'è una cosa: se la schermata cambia e
  il foglio no, l'assistente risponde una cosa e l'app ne fa un'altra, e
  nessuno se ne accorge finché non è un utente a farlo notare. È successo coi
  biglietti: il filtro è passato a «tutti» e la mappa continuava a dire «di
  suo parte dai tuoi». Ora `prova-biglietti` mette le due cose una contro
  l'altra e misura se dicono lo stesso. **Dove si cambia un valore di
  partenza o un percorso, si aggiunge una prova di questo tipo:** la mappa è
  una promessa, e una promessa senza prova scade da sola.

- **L'orologio del telefono è quello di chi guarda, non quello del posto.**
  Il meteo lo chiediamo con `timezone=auto`, quindi alba e tramonto tornano
  *in ora locale del posto* — e l'app li confrontava con `new Date()
  .getHours()`, cioè con l'ora di casa. Da Milano il Giappone è avanti di
  sette ore: alle due del pomeriggio qui a Tokyo sono le nove di sera, e
  l'app disegnava il sole sopra la notte. Lo stesso su «sera piovosa» (la
  sera tua, la pioggia loro) e sulla casella «adesso» della fila oraria,
  che sono ore del posto. Lo scarto **era già nella risposta**
  (`utc_offset_seconds`) e finiva nel cestino: ora si salva come `scarto` e
  ci passa tutto da `adessoNelPosto(w)`. **Ogni volta che si mette insieme
  un'ora del telefono e un dato di un altro posto, ci si ferma e si guarda
  di che fuso è ciascuno.**
- **Quanto lontano vale la pena cercare dipende da COSA si cerca.** Le
  ricerche «qui intorno» si allargavano tutte fino a cinque chilometri e
  poi si arrendevano. Per un bagno è giusto — uno a venti chilometri non
  serve a nessuno, e «non c'è» è la risposta vera — ma per la
  **metropolitana** no: se stai in un paese fuori città il metro sta in
  città, a quindici chilometri, ed è esattamente quello che volevi sapere.
  Cercando da lì l'app diceva «non risulta niente» avendo la risposta a
  portata di un giro in più. Ora la scala è per tipo (`raggi` nella voce di
  `VICINI`): treni e metro fino a 20 km, bus fino a 10, bisogni entro 5. Ci
  si ferma al primo scalino che trova qualcosa, e c'è un tetto di tempo
  complessivo — sei giri a nove secondi l'uno farebbero un minuto di
  clessidra. **Quando si mette un limite, si guarda per chi quel limite è
  sbagliato.**
- **Cinque tasti che fanno la stessa cosa sono UNA cosa travestita da
  cinque.** La home aveva sei pillole con l'emoji davanti, su due righe:
  Bagno, Area fumatori, Bancomat, Bagagli, Condividi, A raccolta. Cinque
  di quelle sei erano la stessa mossa — *cerca qualcosa qui intorno* — e
  messe in fila diventavano un muro da leggere tutto prima di capire che
  nessuna serviva adesso. Adesso c'è **un tasto che fa la domanda**,
  «Cosa cerchi qui intorno?», e la scelta arriva dopo. Quando in una
  schermata compaiono più di tre azioni della stessa famiglia, la domanda
  non è quale togliere: è **qual è la domanda che le contiene tutte.**
- **Una fila che non si usa ogni giorno costa la piega dello schermo.**
  I nomi dei viaggi stavano in cima alla home: una riga intera, 44 px più
  i margini, per una cosa che si fa una volta ogni tanto — e a pagarla era
  la mappa, che restava tagliata dalla barra in fondo. Sono andati dietro
  le tre righine in alto a sinistra. **Quello che si usa di rado va messo
  dove si cerca quando serve, non dove si vede sempre.**
- **⚠️⚠️ Un ripiego può essere il difetto peggiore di tutti.** Quando la
  previsione non portava il fuso — e non lo portava su nessuno dei
  telefoni che avevano già l'app — l'ora del posto ripiegava
  sull'**orologio di chi guarda**. Per una destinazione dall'altra parte
  del mondo quella non è un'approssimazione: è il contrario. In Giappone
  erano le dieci del mattino, qui le tre di notte, e l'app disegnava la
  luna. Il ripiego l'avevo scritto io e l'avevo pure commentato come
  «onesto»: non lo era, ed è rimasto invisibile finché la notte valeva
  solo per «oggi». **Quando si scrive un ripiego, si guarda il caso
  peggiore, non quello comodo** — qui il caso peggiore è il mezzo mondo di
  distanza, cioè esattamente il motivo per cui l'app esiste.
  Ora il ripiego è la **longitudine**: ogni quindici gradi un'ora, che è
  l'ora solare del posto. Tokyo 139.8 → UTC+9. Funziona ovunque, senza
  rete e senza aspettare un riscaricamento. Il telefono resta solo per il
  caso in cui non si sappia nemmeno dov'è il posto — e allora il meteo non
  c'è proprio.
  Tre cose insieme, perché una sola non bastava: la previsione **si porta
  dietro le coordinate**, chi disegna il cielo **riceve il posto** dal
  viaggio, e una previsione senza fuso **conta come scaduta** così si
  rifà da sola.
- **Stimare va bene per disegnare, non per scrivere.** La longitudine può
  sbagliare di un'ora dove il fuso politico non segue il sole (Spagna,
  Cina). Basta e avanza per decidere se disegnare il sole o la luna; non
  basta per scrivere «a Tokyo sono le 10:09». `adessoNelPosto` torna due
  bandiere distinte, `delPosto` e `esatto`, e la frase guarda `esatto`.
- **La luce segue adesso, il tempo che fa segue la giornata che guardi.**
  Il cielo disegnato si faceva notturno *solo* sul giorno che lì era oggi:
  su una giornata futura, dicevo, l'ora di adesso non vuol dire niente. Il
  ragionamento filava e il risultato era sbagliato — un viaggio a Parigi
  fra tre giorni, aperto alle due di notte, mostrava un **sole pieno**.
  Chi guarda lo guarda *adesso*, e fuori dalla finestra anche le nuvole di
  giovedì sono scure. Le due metà si decidono separate: la luce dall'ora
  del posto, la pioggia dalla giornata mostrata. Vale ovunque si disegni
  un ambiente attorno a un dato futuro.
- **Una fascia oraria senza la notte.** `homeMood` aveva mattina,
  pomeriggio e sera: alle 02:30, sotto una luna, si leggeva «mattina
  limpida». Quando si divide la giornata in fasce, **la notte è una
  fascia** — e sono due pezzi, prima dell'alba e dopo le dieci di sera.
- **Una versione con la sola data non distingue due pubblicazioni dello
  stesso giorno**, e qui di giri in un giorno se ne fanno tre o quattro.
  `VERSIONE_APP` porta anche l'ora. Se ne pubblichi due nello stesso
  minuto, quella riga torna a mentire: allora cambia anche il minuto.
- **Un cielo disegnato può ripiegare, una frase no.** Senza lo scarto il
  cielo continua a usare l'orologio del telefono — è un'impressione, e
  sbagliarla costa poco. Ma la riga scritta «a Tokyo sono le 02:00» è
  un'affermazione, e senza il fuso vero **non si scrive affatto**. Dove un
  ripiego è accettabile per il disegno non lo è per il testo.
- **Una prova sull'ora non deve dipendere dall'ora.** `prova-fuso` mette
  due posti con lo *stesso* sole e due fusi diversi, scelti perché in uno
  siano le 14:00 e nell'altro le 02:00 *nel momento in cui gira*. Se l'app
  guarda il fuso, i due rispondono diverso; se guarda l'orologio della
  macchina rispondono per forza uguale, qualunque ora sia. La riga è rossa
  sul codice vecchio **sempre**, non a metà delle esecuzioni — che è la
  differenza fra una prova e una monetina.
- **Un dato che non scade è un dato che mente.** Il meteo si scaricava una
  volta e restava lì: una previsione per domani presa una settimana prima
  aveva lo stesso aspetto di una presa adesso. È peggio di un dato mancante,
  perché un buco si vede e un numero vecchio no. Qualunque cosa venga da
  fuori e cambi nel tempo deve portarsi dietro **quando è stata presa**, e
  avere una scadenza proporzionata a quanto in fretta cambia.
- **La freschezza va anche mostrata, non solo gestita.** «Vista 20 min fa»
  accanto al tasto di aggiornamento costa una riga e toglie di mezzo la
  domanda «ma sarà aggiornato?». Se un dato ha una scadenza, chi lo guarda ha
  diritto di sapere a che punto è.

- **Correggere un difetto tirando la leva opposta lo sposta, non lo toglie.**
  La pioggia sembrava una grata perché le gocce erano tutte uguali; l'ho
  rallentata, e sono diventate stelle cadenti. La leva giusta era la varietà,
  non la velocità — e finché non l'ho capito ho fatto due giri in direzioni
  opposte senza avvicinarmi. Quando una correzione peggiora le cose da
  un'altra parte, di solito si sta muovendo la leva sbagliata.
- **Contare quanti valori sono diversi non misura la varietà.** Due controlli
  della pioggia contavano le lunghezze distinte: con numeri interi in un
  intervallo stretto i doppioni sono inevitabili, e il conteggio diceva «poca
  varietà» proprio mentre ce n'era parecchia. Quello che conta è
  l'**ampiezza**: quanto c'è fra il minimo e il massimo.

- **Un paese non è un posto.** Cercando «Giappone», «Francia» o «Spagna», il
  geocodificatore risponde col **centroide del paese** — per il Giappone le
  montagne del Gunma a mille metri. Prendere il meteo da lì dà numeri veri di
  un posto in cui non va nessuno, e sembra che la fonte sia inaffidabile
  mentre è la domanda a essere sbagliata. Prima di usare delle coordinate per
  qualcosa di locale, si guarda **che cosa** è il posto che il
  geocodificatore ha trovato (`addresstype`, `place_rank`), non solo dove sta.
- **Quando non sai, dillo.** La stessa giornata senza tappe adesso non mostra
  un numero preso a caso: dice *«Giappone» è un paese intero, aggiungi una
  tappa o una città*. Un numero sbagliato costa più di un vuoto spiegato,
  perché sul numero uno ci fa la valigia.
- **Il difetto l'ha trovato una persona usandola, non la suite.** È la
  seconda volta (la prima erano le ottanta frasi in italiano). Le prove
  coprono quello che il codice fa; non coprono quello che il codice *chiede*
  a un servizio esterno. La prova nuova infatti guarda **le coordinate che
  l'app manda a Open-Meteo**, non quello che ne torna indietro.
- **Prima di spingere, la suite intera.** Quattro prove rosse in CI (`lingue`,
  `nav`, `piu`, `tasti`) perché avevo girato solo quelle che *credevo*
  toccate. Cambiare la classe di un tasto (`.chip` → `.tt-az`) rompe ogni
  prova che quel tasto lo cercava per classe, e la lista di chi lo cerca non
  sta in testa a nessuno. Cinque minuti di suite valgono un giro di CI rossa.

- **Un'animazione sbagliata quasi sempre è una metafora sbagliata.** La
  pioggia è stata rifatta tre volte, e le prime due erano varianti della
  stessa idea: gocce che cadono davanti agli occhi. Cambiando la domanda —
  *da dove la sta guardando, questa persona?* — la risposta è venuta da sola:
  da dietro un vetro, e su un vetro la pioggia sta quasi ferma. Prima di
  rimettere mano ai numeri di un'animazione, conviene chiedersi se la scena
  è quella giusta.
- **La forma di una cosa disegnata conta più della sua dimensione.** Le gocce
  come puntini pieni sembravano polvere; ingrandite, sembravano bolle di
  sapone. Come anelli — bordo chiaro, centro trasparente — si leggono per
  quello che sono a qualunque misura. E mezzo pixel di sfocatura fa la
  differenza fra «visto attraverso un vetro» e «disegnato col compasso».
- **Quattro tasti in fila non sono sempre un problema di spazio.** Sulla Time
  Table erano quattro inviti in tre stili, e la tentazione era nasconderne
  due a caso. La domanda giusta era «quali si usano CAMMINANDO e quali da
  fermi», e la risposta l'aveva solo chi l'app la usa in viaggio. Due
  restano, due vanno dietro una porta che dice cosa c'è dentro.
- **Un rettangolo bianco dietro un numero invecchia una schermata di
  vent'anni.** Nella Time Table la riga dell'ora attraversava la colonna
  delle ore, e il numero aveva un fondo pieno per «tagliarla». Bastava far
  partire la riga dopo la colonna. Era la cosa più vecchia della pagina, e
  costava una proprietà CSS.
- **Una prova che si schianta dice meno di una che elenca.** `prova-giornata`
  al primo giro moriva con un `TypeError` sul codice vecchio: dimostrava che
  qualcosa mancava, ma non cosa. Con i controlli protetti sui pezzi che
  possono non esserci, adesso stampa venti righe rosse che dicono
  esattamente cosa non c'era — compreso il vecchio colore sabbia,
  `rgb(242, 230, 204)`.
- **Una cosa curata dentro un riquadro resta un riquadro.** Il primo cielo era
  una card da 120×54 in cima alla home: disegnata bene, con l'ombra giusta, e
  brutta lo stesso — perché era un oggetto in più su una schermata già piena.
  La versione buona non aggiunge niente: **ridipinge quello che c'era già**,
  cioè lo sfondo dell'intestazione. Prima di curare un elemento nuovo, conviene
  chiedersi se la cosa può stare dentro un elemento che c'è di già.
- **Un'immagine che finisce di netto si vede che è appiccicata.** Il velo del
  meteo svanisce verso il basso con una maschera: senza, il bordo inferiore
  taglia e l'occhio legge «riquadro» invece di «cielo». Vale anche per il
  colore: la sfumatura dell'intestazione cambia solo la tinta in alto e
  continua a sciogliersi nella carta della pagina esattamente dove si
  scioglieva prima.
- **Una scena disegnata non si scala tutta insieme.** Le misure sono in pixel,
  non in `em`: una goccia di pioggia è una goccia, non diventa otto volte più
  grande perché la finestra è più grande. Con l'`em` il riquadro da 54 px e
  l'intestazione da 430 volevano due densità opposte, e nessuna delle due
  stava bene con l'altra.
- **Un fondo scuro obbliga il testo che ci sta sopra.** Con pioggia, temporale
  o notte l'intestazione prende `cl-buio` e i nomi dei viaggi passano
  all'inchiostro chiaro. Non è estetica: quella è la riga con cui si cambia
  viaggio, e inchiostro tenue su un temporale non si legge.
- **Il valore di una proprietà CSS personalizzata torna com'è scritto.**
  `getPropertyValue('--cl-g')` restituisce `linear-gradient(168deg,#3D8FD8…)`
  con i colori in esadecimale: il browser non li normalizza in `rgb()` come fa
  per le proprietà vere. Una prova che cercava `rgb(` dentro quel valore
  trovava `null`, e `null < 90` è **vero** — quindi il controllo «di notte il
  cielo è scuro» passava senza aver misurato niente. Un confronto con un
  valore che può essere `null` va scritto in modo che `null` lo faccia
  fallire, non passare.
- **`elementFromPoint` sul bordo esatto non è un metro.** Cercare il bersaglio
  di un tasto camminando pixel per pixel dal centro verso fuori dà 41 px per un
  tasto che ne misura 44: l'ultimo pixel cade sul confine e il browser
  risponde col genitore. La misura buona è quella geometrica di
  `prova-tocchi`, che legge gli scarti di `::after` e li taglia sul
  contenitore. È lo stesso inganno che aveva già fatto rossa la CI tre volte —
  se una misura di tocchi esiste già lì, non se ne scrive una seconda.
- **In Playwright vince l'ultima rotta registrata, non la più specifica.**
  Registrare prima `hourly=` e poi il generico `api.open-meteo.com` che
  annulla significa annullare anche le chiamate che volevi far passare. La
  rotta specifica va registrata **dopo** quella generica.
- **Una prova che non fa succedere la cosa, non la prova.** Le parole del
  tempo sono rimaste non tradotte in quattro lingue per mesi con la prova
  sulle lingue verde: il viaggio di prova aveva `weather: {}`, quindi
  «pioggia leggera» e «mattina limpida» non si disegnavano mai. Non era il
  metro a essere rotto — era la scena vuota. Prima di fidarsi di un «non
  resta niente in italiano», si guarda **cosa c'era a schermo** mentre lo
  diceva.
- **Il confronto fra due lingue non vede le frasi mezze tradotte.** «14°
  pioggia · sunset 18:20» in inglese non coincide con la versione italiana,
  quindi passa — anche se «pioggia» è lì in italiano in mezzo. Per questo le
  parole che finiscono **cucite dentro altre frasi** (`wxShort`, `wxDesc`)
  devono uscire già tradotte dalla funzione, invece di aspettare il
  traduttore del DOM: quello arriva solo quando la parola sta da sola dentro
  un elemento suo.
- **`querySelectorAll` non restituisce l'elemento da cui parte**, e una
  `class` aggiunta in un ramo di un `return` non finisce negli altri rami. La
  riga del giorno scelto nel meteo non si segnava perché avevo messo la
  classe nei due rami «senza previsione» e dimenticato quello normale — cioè
  l'unico che si vede quasi sempre.

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
- **Quello che si disegna in ritardo va ricontrollato al momento in cui si
  disegna.** Le mini-mappe dei risultati nascevano 120 ms dopo, e in mezzo la
  schermata poteva essersi rifatta: Leaflet nasceva su un riquadro staccato
  dalla pagina, o su uno già preso da un'altra mappa, e l'errore
  (`_leaflet_pos`) usciva da tutt'altra parte. Solo sul server delle prove,
  che è più lento. Adesso il riquadro si ricontrolla adesso, non 120 ms fa.
- **Un contatore che misura dopo aver cambiato le cose misura il risultato,
  non il lavoro.** Il conto di quanto è tradotta l'app girava *dopo* la
  traduzione, quando le frasi italiane non ci sono più: diceva l'1% con metà
  app tradotta. Preso due volte, perché la seconda versione contava durante il
  giro — ma prendeva l'ultimo, e dal secondo in poi la pagina è già tradotta.
  Vale solo il primo giro. Quando un numero sembra sbagliato, si guarda
  *quando* viene misurato.
- **Prima di togliere una cosa che sembra inutile, si chiede a cosa serve.**
  I nove riquadri pubblicitari vuoti sono stati tolti perché «non fanno
  guadagnare niente e fanno sembrare l'app rotta». Il ragionamento guardava il
  guadagno; quei riquadri invece servivano a **far vedere la differenza fra il
  piano gratuito e il Premium**, che senza di loro sono identici a schermo.
  Nessuno l'aveva scritto da nessuna parte — adesso sì, e c'è una prova che lo
  tiene fermo. Vale in generale: quando una cosa sembra senza motivo, il
  motivo può essere solo non scritto.
- **Una risposta che arriva quando non serve più va buttata, non consegnata.**
  Le tessere della mappa prima si caricavano come immagini e basta; da quando
  passano dalla memoria e dalla rete, la risposta può arrivare molto dopo — e
  in mezzo la schermata si è ridisegnata e la mappa è stata tolta.
  Consegnarla lo stesso rompeva Leaflet dentro, con un errore (`_leaflet_pos`)
  che usciva da tutt'altra parte e **solo sulle macchine lente**, dove le
  tessere ci mettono davvero un po'. Qui non si riproduceva nemmeno
  rallentando la CPU sei volte: la differenza vera era che qui il proxy
  blocca le tessere e non arrivano affatto. Quando un guasto non si riproduce,
  la domanda giusta è *cosa fa quella macchina che qui non succede*.
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
- **Una colonna nuova nel database è un modo nuovo di rompersi.** Fra il
  momento in cui l'app la usa e il momento in cui qualcuno rilancia lo schema
  passa del tempo, e in quel tempo ogni riga che la nomina viene respinta.
  Chi scrive: riprova senza. Chi legge: chiede `*`, non la colonna per nome.
  Vale per `percorso_mini`, varrà per la prossima.
- **Un finto cloud che risponde all'istante nasconde proprio quello che si
  vuole dimostrare.** La prova "si vede subito la miniatura, e la foto vera
  arriva dopo" passava anche senza miniature: il finto scaricamento finiva
  prima di guardare. Ci vuole la lentezza di una rete vera, messa apposta.
- **Il traffico si misura, non si stima.** Il finto magazzino tiene i byte
  veri delle foto caricate e li ridà uguali: così la prova dice "1316 KB
  prima, 34 KB adesso" invece di "adesso è più leggero".
- **Le prove sul database si possono lanciare anche qui, non solo in CI.** Per
  mesi sono state scritte alla cieca e provate solo dopo il push. Il Postgres
  c'è già installato: `pg_ctlcluster 16 main start`, poi si crea un ruolo
  `root` superuser con un database suo, e `PGHOST=/var/run/postgresql npm run
  test:db` gira tutto — compreso il passaggio che conta, lo schema che si posa
  su un database che esiste già.
- **Un valore di partenza non è un limite.** La scadenza di due ore di una
  chiamata a raccolta era un `default`: chi chiama poteva scriverne una che
  dura un anno, e la privacy policy avrebbe detto una cosa falsa. È diventata
  un `check` sulla tabella. Se una promessa è scritta nella policy, deve
  essere una regola del database — non una gentilezza dell'app.
- **Una transizione non parte da `display:none`.** È il difetto più longevo
  trovato finora: la salita dei fogli era scritta nel CSS dal primo giorno,
  sembrava giusta a leggerla, e **non è mai partita**. Passando da `none` a
  `flex` nello stesso momento in cui cambia la posizione, il browser non ha
  nessun "prima" da cui muoversi e mette tutto subito al suo posto. In tutta
  l'app i fogli comparivano già arrivati, e chiudendoli sparivano.
  Non si vedeva leggendo il codice — si vedeva **misurando dove sta il foglio
  fotogramma per fotogramma**, che è quello che fa `prova-movimento.js`.
  La regola generale: *un'animazione che nessuno ha misurato è un'animazione
  che forse non esiste.*
- **Un foglio che scende è ancora grande quanto lo schermo.** Restando nel
  layout per finire la discesa, senza `pointer-events:none` si mangia i tocchi
  per un terzo di secondo dopo essere stato chiuso — e l'app sembra bloccata
  proprio nel momento in cui uno riprende a toccarla.
- **Allargare l'area di un tasto può rubare il tocco a quello accanto**, e il
  risultato è peggio di un tasto piccolo: il dito va nel posto giusto e
  succede la cosa sbagliata. Ogni volta che si allarga un'area invisibile va
  controllato lo spazio fra i vicini — la prova lo fa toccando i quattro
  angoli di ogni area e guardando chi risponde, ed è così che sono venuti
  fuori i quattro tasti della schermata delle spese.
- **Con un foglio aperto, tutto quello che sta dietro è coperto.** Chiedere
  «chi risponde in questo punto?» restituisce il foglio, e sembra un furto di
  tocchi quando è solo un foglio davanti. Una prova che misura i tocchi deve
  guardare dentro il foglio aperto, non dietro.
- **`elementFromPoint` non è un modo affidabile di misurare i tocchi**, e
  questa lezione è costata **tre CI rosse di fila** su un tasto che non aveva
  niente che non andasse.
  La barra in basso è una pillola con gli angoli tondi, e il browser rispetta
  il raggio nel decidere «chi risponde in questo punto»: l'angolo dell'area
  allargata di una voce ci cade *fuori*, e fuori c'è la pagina. Poi la
  risposta cambia con la larghezza dello schermo, con i font (qui quelli di
  Google non si scaricano, in CI sì) e con quanto la barra è scorsa.
  Ho sbagliato diagnosi due volte prima di capirlo: prima ho dato la colpa
  allo schermo stretto, poi ai font. Erano tutte e due vere e nessuna delle
  due era la causa.
  **La correzione non è aggirare il caso: è cambiare domanda.** Quello che
  serve sapere è se due tasti vicini si prendono lo stesso pezzo di schermo —
  ed è una domanda di rettangoli, che dà la stessa risposta ovunque. Adesso
  la prova confronta le aree fra loro e dice anche di quanti pixel si
  sovrappongono.
  La regola: **quando una prova dà risposte diverse in posti diversi, il
  problema è la domanda, non l'ambiente.**
- **Un'area tagliata non è area guadagnata.** Allargare un tasto con
  `::after` dentro una striscia che scorre non serve a niente per la parte che
  sborda: `overflow` la taglia. Una prova che somma gli scostamenti scritti
  nel CSS misura le intenzioni; per misurare la realtà va intersecata con la
  striscia che contiene il tasto.
- **«Si può rilanciare quante volte si vuole» va provato rilanciandolo.**
  In cima a `supabase-schema.sql` c'era scritto da sempre, ed era
  l'istruzione data a chi doveva aggiornare il progetto vero. Non era vero:
  al secondo lancio la pulizia toglieva `is_trip_member` mentre i permessi
  delle foto ci si appoggiavano, e il file si fermava a metà — lasciando il
  database **scoperto**, che è il caso peggiore possibile.
  Nessuna prova lo prendeva, perché tutte partivano da un database dove quel
  file non era ancora passato: si provava il primo lancio e l'aggiornamento
  da una versione vecchia, mai *lo stesso file due volte*. È il difetto più
  facile da non vedere che ci sia — quello nascosto dentro un'istruzione che
  si dà per scontata.
- **Il percorso scritto a mano ritorna, e la guardia va allargata.** Dopo la
  storia dei sei `file:///home/user/...` ne erano rimasti altri due, in un
  posto che nessuno guardava: due prove scrivevano le loro immagini dentro la
  cartella di lavoro di **una sessione** (`/tmp/claude-0/...`). La guardia del
  lanciatore non li vedeva perché cercava solo le cartelle delle persone
  (`/home`, `/Users`). Ora guarda anche `/tmp` e `/var`, e per le immagini
  c'è `cartellaFoto()` in `browser.js`.
- **Un'immagine di contorno non può bocciare una prova.** Fotografare un
  *elemento* fa aspettare a Playwright che stia fermo: la mini-mappa si
  assesta un attimo dopo che arrivano le tessere, e su una macchina lenta
  «element is not stable» ha fatto diventare rossa `pos` **con tutti e 21 i
  controlli passati**. Le immagini che nessuno controlla vanno in un
  try/catch: sono per farsi guardare, non per giudicare.
- **Prima di aggiungere qualcosa a una schermata, si guarda la schermata.**
  Aggiungere un'azione allo stato vuoto delle spese e dei biglietti sembrava
  un miglioramento ovvio; erano due tasti identici uno sopra l'altro, perché
  l'azione su quelle schermate c'era già a un centimetro di distanza. Non si
  vedeva leggendo il codice, si è visto con uno screenshot. Vale per ogni
  modifica all'aspetto: **un'immagine prima e una dopo**, non la memoria.
- **Per far capire che una fila scorre, la fila va DENTRO al contenitore, non
  è il contenitore.** Prima la pillola in basso era essa stessa l'elemento che
  scorre, e questo obbliga a segnalare lo scorrimento con un'ombra interna —
  una maschera avrebbe dissolto anche il vetro e la sua cornice. Con una pista
  (`.nav-track`) che scorre dentro la pillola, la maschera può mangiarsi le
  icone ai bordi lasciando intatto il vetro: le voci **svaniscono sotto il
  bordo** invece di essere tagliate di netto, e si capisce che di là la fila
  continua senza che nessuno lo scriva. Costa un elemento in più nell'HTML e
  ripaga in tutto il resto — fra l'altro la maschera funziona uguale nei due
  temi, mentre l'ombra andava invertita al buio.
- **Al buio le ombre vanno al contrario, e va misurato.** La stessa sfumatura
  scura che in tema chiaro toglie 24 punti di luminosità, in tema scuro su una
  pillola già quasi nera ne toglie **due su 255**: non esiste. Lì serve un
  chiarore — o, meglio, un accorgimento che non dipenda dal colore, come la
  maschera. Un effetto visivo non è fatto finché non se ne è letto il pixel in
  tutti e due i temi.
- **Una lunghezza che una prova deve leggere si scrive in pixel.** La
  dissolvenza era `2.1rem`: `getComputedStyle().getPropertyValue('--sf')`
  restituisce la stringa così com'è, e `parseFloat` dà **2.1**, non 33.6. La
  prova confrontava rem con pixel e diceva di no a una cosa giusta.
- **Un riconoscitore di «sembra italiano» non e' una prova: e' un indovinello.**
  Il primo metro cercava frasi contenenti una parolina italiana (`il`, `che`,
  `non`, `giorni`). «Esci», «Saldi», «Recupero», «Condividi», «Bagagli» non ne
  hanno nessuna: per la prova non esistevano. Ha detto **zero frasi rimaste in
  italiano mentre a schermo ne restavano ottanta** — e non erano casi limite,
  erano i tasti del Profilo e quelli della home. L'ha visto Giacomo aprendo
  l'app, non la suite.
  Il metodo che regge non indovina, **confronta**: la stessa schermata si apre
  in italiano e nella lingua da provare e si raccoglie quello che si legge.
  Una stringa identica in tutt'e due o e' un nome proprio, o non e' tradotta.
  Due accortezze lo rendono esatto invece che rumoroso: fra italiano e
  spagnolo molte parole coincidono per davvero («persona», «hotel»), e la
  differenza la dice il dizionario — se quella stringa e' un **valore** della
  lingua d'arrivo allora e' la traduzione giusta che si dà il caso coincida;
  e le frasi composte, che escono da `tv()` col buco gia' riempito, nel
  dizionario non si trovano piu' e vanno cercate in `GIA_TRADOTTE`.
- **Una prova non deve rincorrere quello che puo' fare lei stessa.** La
  traduzione di cio' che nasce dopo passa da un `requestAnimationFrame`: sulla
  macchina delle prove, carica, la prova sulle lingue fotografava le schermate
  prima che l'osservatore avesse fatto il suo giro, e segnalava in italiano
  frasi tradotte benissimo. Prima e' toccato al portoghese (i tasti della
  home), poi allo spagnolo («Essenziale», «Indicazioni»): allungare le attese
  e' una corsa che si perde a turno.
  La domanda di quella prova e' **«il dizionario e' completo?»**, non
  «l'osservatore ha fatto in tempo?» — che e' un'altra domanda, e ha gia' la
  sua prova. Quindi si chiama `traduciPagina()` e POI si guarda: quello che
  resta in italiano resta perche' NON SI SA tradurre. Quando una prova balla,
  vale la pena chiedersi se sta misurando la cosa che le interessa.
- **Una mappa va fermata prima di toglierla.** Se una zoomata e' ancora in
  corso quando il riquadro sparisce, Leaflet la finisce lo stesso e va a
  cercare un pannello che non c'e' piu': *«Cannot read properties of undefined
  (reading `_leaflet_pos`)»*. Non si vede quasi mai — serve una macchina lenta
  e il momento giusto — ed e' successo una volta in CI con **tutti e 42 i
  controlli passati**, perche' la prova conta anche gli errori di pagina.
  `map.stop()` prima di `map.remove()` **non basta**: ferma lo spostamento, non
  la zoomata, che si chiude da sola con un `transitionend` che arriva dopo.
  Dentro Leaflet quel gestore comincia con «se non sto zoomando, lascia
  perdere», quindi bisogna anche abbassargli la bandierina
  (`m._animatingZoom = false`). E' roba interna della libreria, ed e' scritto
  nel codice perche' si sappia perche'. Vale per tutt'e quattro le mappe.
- **I numeri vanno tolti dal confronto fra due lingue.** «tu €1.200,00» e
  «tu €1200,00» sono la stessa frase con lo stesso «tu» non tradotto, ma come
  stringhe sono diverse — e quanti puntini ci mette l'italiano **dipende dalla
  versione di ICU del browser**: su questa macchina l'italiano scrive
  `1.200,00` e lo spagnolo `1200,00`, sulla macchina delle prove tutt'e due
  `1200,00`. Risultato: il «tu» passava qui e veniva preso in CI. Si sostituisce
  il numero **intero, separatori compresi** — togliendo solo le cifre restano i
  puntini a distinguerle e non serve a niente. E' la seconda volta che la
  stessa stranezza di ICU morde: la prima aveva reso ballerina una
  riga di prova, questa volta ha nascosto un difetto vero.
- **Una prova con un viaggio vuoto guarda senza vedere.** Con un partecipante,
  nessuna tappa e nessuna spesa, meta' delle frasi dell'app non si disegna
  proprio: la prova sulle lingue girava su un viaggio cosi' ed e' il secondo
  motivo per cui ottanta frasi in italiano sono passate. Riempiendolo il
  confronto passa da 763 a 801 frasi per lingua, e sul codice di prima ne
  trova 55 invece di 44. Quando si aggiunge una schermata, si aggiunge anche
  **il dato che la fa comparire**.
- **Un controllo che legge un fotogramma preciso e' un controllo ballerino.**
  «Il foglio arriva al suo posto» leggeva il quarto fotogramma: con la
  macchina occupata da altri browser i fotogrammi arrivano prima che lo stile
  sia ricalcolato, ed e' diventato rosso una volta da solo mentre in CI era
  verde. Le due cose che interessano — che non scivoli e che arrivi — vanno
  misurate in due momenti diversi: i campioni durante, la posizione finale
  dopo.
- **`querySelectorAll` non restituisce mai l'elemento da cui parte.** Il
  traduttore cercava `[title]` fra i *figli* del nodo che gli veniva
  consegnato, e l'osservatore gli consegna proprio i nodi appena nati: un
  tasto con il suo `title` addosso passava liscio ogni volta.
- **Un attributo riscritto a mano non passa da nessuna parte.** L'osservatore
  guarda i figli che nascono (`childList`), non gli attributi che cambiano:
  `b.title = 'Niente da annullare'` restava in italiano per sempre. Quelle
  scritture vanno fatte passare da `tv()` al momento in cui avvengono.
- **Le chiavi del dizionario non si ricopiano a occhio.** L'elenco di cosa
  restava da tradurre veniva stampato troncato a 95 caratteri: una parte delle
  chiavi del primo lotto non corrispondeva a niente e quelle frasi restavano
  in italiano senza che nulla segnalasse l'errore. Si prendono **per indice**
  dal file misurato, così sono esatte al byte.
- **Un riconoscitore di «sembra italiano» prende anche l'inglese.** `\bi\b`
  vale per «i» italiano e per «I» inglese, `\bla\b` e `\bcome\b` lo stesso.
  Prima di chiedersi se una frase sembri italiana bisogna **scartare quello
  che è già una traduzione** (i valori del dizionario, più `GIA_TRADOTTE` per
  le frasi composte): senza quel filtro l'elenco delle cose da fare si riempie
  di roba già fatta.
- **Girare per le schermate non basta: certi cartelli dipendono dalla rete.**
  L'avviso «⚠️ Viaggi solo su questo telefono» esce solo se la libreria di
  Supabase si è scaricata e non c'è una sessione. Qui la libreria non si
  scarica, quindi quel cartello non compariva mai e la prova diceva «non resta
  niente in italiano» — mentre sulla macchina delle prove automatiche, dove la
  rete c'è, era rimasto in italiano per intero, in tutte e quattro le lingue.
  Adesso la prova **forza** i due stati (non connesso, memoria piena) invece
  di sperare che si presentino. La regola generale: uno stato che dipende
  dall'ambiente va messo in scena, non aspettato.
- **`toLocaleString` non raggruppa le migliaia allo stesso modo dappertutto.**
  In italiano e in spagnolo i gruppi partono dalla **quinta** cifra
  (`minimumGroupingDigits` = 2), quindi 2400 si scrive `2400,00` e non
  `2.400,00` — ma dipende anche dalla versione di ICU del browser: la stessa
  prova dava `2.400,00` qui e `2400,00` sulla macchina delle prove. Per
  provare i separatori si usa un numero grosso (1.234.567), che raggruppa in
  ogni lingua e con ogni versione.
- **Aprire una pagina nelle prove costa 13 secondi**, e non è colpa dell'app:
  il foglio di stile di Google Fonts non è raggiungibile da qui e ci mette
  12,7 secondi a fallire, bloccando il `domcontentloaded`. Una prova che apre
  dieci pagine ci mette due minuti solo per quello. Si risolve bloccando
  `fonts.googleapis.com` in `test/browser.js` — non è stato fatto qui perché
  cambia il carattere con cui la pagina viene disegnata, e c'è una prova
  (`prova-tocchi`) che misura i pixel: va provato da solo, non in mezzo ad
  altro. Nel frattempo, **le pagine si riusano**: quello che si può chiedere a
  una pagina già aperta non merita di aprirne un'altra.
- **Una prova che pretende sempre lo stesso diventa rossa quando l'app
  migliora.** La barra in basso aveva più voci di quante ne entrassero, e
  una prova chiedeva «all'avvio l'ombra dice che a destra c'è dell'altro».
  Tolto il Profilo dalla barra, su un telefono largo ci stanno tutte: nessuna
  ombra, giustamente — e la prova è diventata rossa con l'app che si
  comportava bene. Quella prova non descriveva un fatto, descriveva una
  conseguenza di com'era fatta l'app in quel momento. Adesso misura il fatto
  («la fila straborda?») e pretende che l'ombra gli dia ragione, in tutti e
  due i versi. E siccome così su uno schermo largo non proverebbe più niente,
  c'è una riga in fondo che pretende che **almeno uno schermo** l'abbia messa
  alla prova: un controllo che può diventare vuoto va sempre accompagnato da
  uno che se ne accorge.
- **Una riga che dà per scontato un pezzo dell'interfaccia si porta giù tutto
  il resto.** `go()` faceva `document.querySelector('[data-p="..."]')
  .classList.add('active')` senza guardare se quella voce esistesse. Finché
  ogni pagina aveva la sua voce nella barra andava bene; tolto il Profilo
  dalla barra, `go('trips')` si fermava su quella riga — e la riga DOPO, che
  era quella che apriva la pagina, non veniva mai eseguita. Il Profilo
  sarebbe rimasto irraggiungibile, e l'errore non si vedeva da nessuna parte
  se non in console. Quando si toglie un pezzo dall'interfaccia, si cerca
  **chi lo dava per scontato**, non solo chi lo disegnava.
- **La barra in basso è per i posti dove si va camminando.** Ci stavano nove
  voci, poi otto, e ogni volta la risposta era «scorre». Ma una barra che
  scorre è una barra dove metà delle voci non le vede nessuno. Il criterio
  non è quanto sono importanti le sezioni: è **con che frequenza ci si va, e
  in che situazione**. Meteo e Profilo erano lì per importanza — e sono le
  due cose che si aprono da fermi, una ogni tanto. Il Meteo è diventato il
  riquadro del cielo in cima alla home, il Profilo il fondo del cassetto: da
  nove voci a sette, e su un telefono largo adesso la barra non scorre più.
- **⚠️ Centrare una fila che può strabordare la rende irraggiungibile.**
  `justify-content:center` su un contenitore che scorre taglia il contenuto
  dai DUE capi, e il capo di sinistra finisce a coordinate negative: lì non
  si scorre, quindi quella voce non la si raggiunge più. La parola che
  salva è **`safe`** — `justify-content:safe center` — che centra finché ci
  sta tutto e torna ad allineare a sinistra appena straborda. Un browser
  che non la conosce butta via la riga e resta allineato a sinistra, cioè
  comunque raggiungibile. Vale per qualunque fila che scorre, non solo per
  questa barra.
- **⚠️ Quando un pezzo trasloca, le misure che lo circondavano restano lì a
  non fare niente.** È successo tre volte di fila, sempre per la fila dei
  nomi dei viaggi che è andata dietro le tre righine. (1) Il cielo teneva
  `padding-top:4.2rem` — settanta pixel di vuoto — che erano lo spazio
  della fila. (2) I gradi avevano una riga tutta loro, trentasei pixel per
  due cifre, perché prima stavano *accanto* alla fila. (3) Il sole è
  posizionato rispetto a quella fila, e il commento nel CSS lo dice ancora.
  Tutto questo spingeva giù la home e lasciava la mappa tagliata dalla
  barra. **Quando si sposta qualcosa, si cerca chi era misurato a partire
  da lui** — non basta togliere il pezzo.
- **Far galleggiare una cosa nell'angolo funziona finché il testo accanto è
  corto.** Per recuperare la riga dei gradi li avevo messi
  `position:absolute` in alto a destra: perfetto con "Parigi 26", e con
  "Viaggio di nozze in Giappone e Corea 2026" la scritta andava a capo, si
  allargava in giù e finiva addosso al numero. Due colonne di una riga vera
  non possono toccarsi nemmeno volendo, e costano lo stesso spazio. Il
  galleggiamento va bene solo su una cosa che non può crescere.
- **Una regola giusta applicata alla cosa sbagliata da' una risposta
  sbagliata.** `prova-tocchi` dice «nessun tasto ruba il tocco a quello
  accanto», e su due tasti vicini e' la domanda giusta. La barra in basso
  pero' non e' un vicino: e' `position:fixed` e passa SOPRA la pagina,
  apposta. Alzando la home, il tasto «Rimuovi con Premium» e' finito nella
  sua fascia e la prova ha gridato al furto — ma la risposta giusta li' non
  e' «non devono sovrapporsi», e' **«lo si deve poter portare fuori
  scorrendo»**, che e' la promessa dello spazio in fondo a `.scroll` e che
  fino a oggi non controllava nessuno. Adesso la prova distingue i due piani
  e fa tutte e due le domande: e' piu' forte di prima, non piu' debole.
  Quando una prova diventa rossa, prima di cambiare il codice vale la pena
  chiedersi **se sta facendo la domanda giusta a quella cosa li'**.
- **La finestra in cui una cosa finisce sotto la barra dipende da quanto e'
  alta la pagina, quindi dai font.** Qui i caratteri di Google non si
  scaricano e la home e' circa duecento pixel piu' bassa che in CI. Prima
  l'inserzione cadeva SOTTO il bordo dello schermo (invisibile, non
  misurata); alzando la pagina e' entrata nella fascia della barra. Non e'
  un difetto nato adesso: e' una finestra larga un'ottantina di pixel in cui
  qualunque contenuto puo' cadere. Inseguirla spostando i pixel la sposta
  solo su un altro telefono — si risolve garantendo che da li' si esca
  scorrendo.
- **⚠️ Un'interlinea piu' stretta delle lettere fa uscire l'inchiostro dal
  riquadro, e nessun rettangolo lo dice.** Il nome della citta' ha
  `line-height:.88` — e' quello che lo fa sembrare un titolo di giornale —
  ma .88 e' piu' stretto di quanto sia alta una lettera con la coda: la g di
  "Parigi" esce sotto il riquadro e finisce dentro "sera velata", che
  comincia esattamente dove il riquadro finisce. La prova che confronta i
  `getBoundingClientRect` diceva «non si toccano» ed era vera: i riquadri
  non si toccavano davvero. **L'inchiostro si chiede al font**, con
  `measureText().actualBoundingBoxDescent` e la riga di base ricavata
  dall'interlinea. Si e' visto a occhio su una fotografia, che e' il modo
  peggiore di accorgersene.
- **Il font di ripiego misura meno di quello vero.** Qui Fraunces non si
  scarica e la coda del ripiego e' piu' corta: dove la prova legge zero, sul
  telefono si sovrappongono gia'. Per questo la soglia non e' «non si
  toccano» ma «c'e' dell'aria in mezzo» — otto pixel, che coprono la
  differenza fra i due font.
- **⚠️⚠️ Cercare per NOME senza guardare le etichette trova tutt'altro.** La
  rete di sicurezza sul nome prendeva qualunque cosa si CHIAMASSE in un certo
  modo, senza chiedersi cosa fosse. E «stazione» e' una delle parole piu'
  ambigue che esistano: stazione dei carabinieri, di servizio, ecologica,
  meteorologica, sciistica, di ricarica — e in inglese e' peggio, *police
  station*, *fire station*, *gas station*, *power station*, *radio station*.
  Segnalato dal vivo: cercando la stazione dei treni usciva al primo posto,
  con la stellina, la «Stazione Carabinieri» a 195 metri. **Il rimedio non e'
  un elenco di parole da evitare** — quello non finisce mai e cambia con la
  lingua — ma guardare le etichette: la mappa dice gia' `amenity=police`. Le
  etichette di OpenStreetMap sono le stesse in tutto il mondo, le parole no.
  E ci vuole il rovescio: una stazione mappata solo come edificio deve
  passare lo stesso, se no nei paesi dove le etichette scarseggiano non si
  trova piu' niente.
- **⚠️ Una chiamata nuda dentro un ciclo si porta giu' tutto il ciclo.** La
  ricerca allarga il giro a scalini; la chiamata a Overpass stava li' dentro
  senza un `try`. Al primo singhiozzo di rete l'errore saltava fuori dal
  ciclo, e l'app diceva «non riesco a raggiungere la mappa» **senza aver
  provato gli scalini piu' larghi**. Un momento di niente diventava una
  ricerca fallita.
- **Riprovare per ogni scalino moltiplica.** Correggendo il punto qui sopra
  avevo messo tre tentativi su tre server dentro OGNI scalino: con la scala
  del bus fanno **cinquantaquattro richieste** a un servizio tenuto su da
  volontari, ed e' il modo di farsi bloccare. Il singhiozzo lo assorbe la
  riprova; quando finisce anche quella il servizio e' giu' davvero, e si
  smette. L'ha trovato la prova contando le richieste, non un ragionamento.
- **Il telefono non deve arrendersi prima del server.** La domanda concedeva
  a Overpass quindici secondi e il telefono mollava a nove: buttava via una
  risposta in arrivo e diceva «non ci riesco» mentre il server stava ancora
  lavorando per noi. Adesso i due numeri escono dalla stessa costante.
- **`["chiave"]` in Overpass vuol dire «ha quella chiave, con qualunque
  valore»** — compreso `atm=no`, cioe' proprio i posti che dichiarano di NON
  avere il bancomat. Venivano offerti come bancomat. E correggere la domanda
  non basta: la rete sul nome li rimetteva dentro dalla porta di servizio,
  perche' «qui il bancomat non c'e'» e' una cosa che si sa del POSTO, non un
  modo di cercarlo, e va controllata comunque sia arrivato.
- **La stessa fermata sta sulla mappa in cinque modi, e chi mappa ne mette
  uno solo.** `highway=bus_stop`, `amenity=bus_station`,
  `public_transport=platform`, `public_transport=stop_position`,
  `highway=platform`. Chiederne tre su cinque vuol dire non trovare la
  fermata ogni volta che chi ha mappato ha usato una delle altre due — ed e'
  successo con una fermata a cento metri. Vale per il metro allo stesso
  modo: Londra, Parigi e mezza Asia mappano le stazioni come
  `railway=station`+`subway=yes`, senza `station=subway`.
- **⚠️ Un finto servizio che non sa leggere la domanda fa passare prove
  vuote.** Il finto Overpass delle prove guardava la domanda con due
  espressioni regolari e diceva «sì» se UNO qualunque dei filtri combaciava:
  non sapeva che dentro una parentesi i filtri si SOMMANO, e non conosceva
  ne' la presenza di una chiave ne' la negazione. Una prova sul filtro che
  esclude `atm=no` sarebbe passata identica sul codice rotto. Adesso sta in
  `test/overpass-finto.js` e la domanda la legge davvero — comprese le
  parentesi quadre dentro le espressioni regolari (`ban[ckq]`), che una
  regola ingenua taglia a meta'. Le 111 prove di prima passano tutte anche
  col finto fedele: non stavano passando per il motivo sbagliato.
- **Il nome della cache non si scrive nelle prove.** Sta in
  `VICINI_CACHE_CHIAVE` e **cambia apposta** quando si corregge una domanda,
  per far dimenticare ai telefoni le risposte prese con quella vecchia.
  Scritto a mano nelle prove, un rinominamento le lascia a pulire una
  casella che non esiste — e allora ogni caso legge la risposta del caso
  prima. Va chiesto all'app.
- **⚠️⚠️ UNA CACHE PUO' ESSERE L'UNICA COSA CHE FA FUNZIONARE QUALCOSA, e
  buttarla via lo scopre nel modo peggiore.** Dopo aver corretto le domande
  ho cambiato il nome della cache — giusto in teoria, perche' le risposte
  vecchie erano prese con domande sbagliate. Il risultato: «prima i bagni me
  li trovava, adesso neanche quello». La ricerca dei bagni non era cambiata
  di una virgola. Era cambiato che **rispondeva dalla memoria senza toccare
  la rete**, e la rete per quel telefono gia' non andava: la cache stava
  nascondendo il guasto, e togliendola l'ho scoperto tutto insieme. Prima di
  invalidare una cache, chiedersi **cosa smettera' di funzionare quando non
  c'e' piu'**.
- **Quando il servizio non risponde, l'ultima risposta vale mille volte un
  cartello d'errore.** Un bagno non si sposta: saperlo di ieri e' meglio che
  non saperlo. Adesso il ripiego pesca in TUTTA la memoria — qualunque
  raggio, anche le risposte scadute, anche le caselle con i nomi vecchi — e
  lo dice («questo e' quello che avevo trovato tre giorni fa»), senza
  spacciarlo per fresco. Le distanze si ricalcolano, quelle restano giuste.
- **Riprovare di piu' puo' far funzionare di meno.** Overpass limita le
  richieste per indirizzo IP. Tre tentativi su tre server = nove richieste
  per ricerca fallita, e lanciarle tutte e tre in volo insieme e' piu' di
  quante un IP ne abbia concesse: ci si fa 429 da soli, e a quel punto
  fallisce anche quello che prima andava. Meno colpi (2), piu' distanziati
  (1,5 s), al massimo due in volo, e chi risponde 429 va **in castigo** un
  minuto e mezzo invece di essere richiamato subito.
- **`throw new Error('overpass')` cancella l'unica cosa utile.** Il guasto
  vero — 429, timeout, telefono senza rete — si perdeva dietro
  un'etichetta generica, e una segnalazione diventava «non funziona» senza
  un appiglio. Adesso il motivo vero arriva fino al messaggio, scritto
  piccolo in fondo: `dettaglio: 429 da overpass-api.de`. Quando non si puo'
  riprodurre un guasto (qui Overpass non e' raggiungibile), **il messaggio
  d'errore e' lo strumento diagnostico**, e va scritto come tale.
- **⚠️⚠️ «overpass lento» vuol dire che la domanda e' troppo pesante, non
  che il servizio e' rotto.** Ogni `(around:...)` e' una ricerca sulla mappa
  a se', che Overpass esegue una per una. Scrivendo `node[...]`, `way[...]`
  e `relation[...]` per ogni filtro, la domanda del bancomat ne faceva
  **DICIOTTO** su un raggio di un chilometro e mezzo: su un server in coda
  non stanno in dieci secondi. Due parole risolvono: **`nwr`** chiede punti,
  contorni e insiemi in una volta (tre volte meno), e i valori della stessa
  chiave si chiedono insieme con una scelta fra parentesi —
  `railway~"^(station|halt)$"` invece di due filtri. Da 18 a 4.
- **⚠️ La ricerca per NOME e' l'ultima spiaggia, non un contorno.** E' di
  gran lunga la domanda piu' cara delle sei — una parola in venti lingue
  dentro cinque campi, cioe' leggersi le etichette di tutto quello che c'e'
  nel raggio. Partiva ogni volta che si trovavano **meno di tre** cose: in
  un paese, cioe' quasi sempre. Si era gia' trovato il bancomat e si faceva
  aspettare venti secondi per cercarne un terzo che non esiste — e quando il
  servizio arranca quei venti secondi diventano «overpass lento» e si perde
  anche il bancomat che si era trovato. Adesso parte solo a mani
  completamente vuote.
- **Un tetto d'attesa piu' corto del tempo che il server si prende butta via
  le risposte in arrivo.** Overpass e' spesso in coda: il tempo che ci mette
  non e' la domanda lenta, e' il suo turno che tarda. Dieci secondi erano
  pochi. Venti sono tanti da guardare ma molto meno che non avere la
  risposta — e con le domande alleggerite, nel caso normale ne bastano due.
  Col tetto va pero' un **budget su tutta la ricerca**: due tentativi da
  ventun secondi fanno quarantadue, e nessuno aspetta quarantadue secondi.
  Si riprova solo se il giro di prima e' caduto in fretta.
- **⚠️ Una prova che guarda com'e' SCRITTA la domanda diventa rossa quando la
  domanda migliora.** Alleggerendo le domande sono diventate rosse sette
  righe in tre file — `/amenity"="bank"/`, `/way\["amenity"="bank"\]/`,
  `chiamate.length >= 2` — tutte vere prima, tutte inutili: le stesse cose
  venivano trovate esattamente come prima. Descrivevano la forma, non il
  fatto. Si chiede **«la domanda chiede questo valore?»** con una funzione
  che accetta sia `="x"` sia `~"^(x|y)$"`, e dove si puo' si guarda il
  RISULTATO: se la banca e' un contorno e si trova, la domanda chiede i
  contorni — non serve leggere come l'ha scritto.
- **⚠️⚠️ I SERVIZI GRATUITI SU CUI POGGIA L'APP NON REGGONO LO STORE, e non
  e' un problema di ottimizzazione.** Nominatim (**17 punti** nell'app: hotel,
  indirizzi, geocodifica dei viaggi) permette **una richiesta al secondo** e
  sconsiglia esplicitamente l'uso da app; Overpass e' volontari senza
  garanzie; `tile.openstreetmap.org` — lo sfondo della mappa — vieta le app ad
  alto traffico; `router.project-osrm.org` e' dichiarato «non per produzione».
  Alleggerire le domande fa guadagnare tempo ma non cambia il problema: **non
  e' quanto pesa una chiamata, e' quante ne fanno diecimila telefoni.**
- **La risposta e' un ponte con memoria condivisa, non un fornitore diverso.**
  Una funzione su Supabase in mezzo: tiene la risposta **una volta sola per
  tutti** (in una citta' con cento utenti le chiamate verso l'esterno sono
  una, non cento), si presenta a Overpass con **una identita' e un contatto**
  — cosa che da dentro un browser non si puo' nemmeno fare, perche' il
  telefono non puo' scrivere il proprio `User-Agent` — e il giorno che si
  passa a un fornitore a pagamento si riscrive quel file senza pubblicare una
  versione nuova sugli store. Il codice sta in `supabase/functions/vicini/`,
  le istruzioni in `COME-SI-ACCENDE.md`.
- **La griglia serve a DUE cose insieme, ed e' il motivo per cui funziona.**
  Il telefono arrotonda la posizione a ~200 m prima di scrivere la domanda:
  cosi' due persone nello stesso isolato fanno la **stessa identica domanda**
  (e la memoria comune li serve entrambi con una risposta sola) **e** al
  ponte non arriva mai dove sei di preciso. Senza l'arrotondamento la memoria
  condivisa non troverebbe mai niente, perche' ogni domanda sarebbe diversa
  dalle altre. Le distanze restano giuste perche' si ricalcolano dalla
  posizione vera: si arrotonda il centro del giro, non il risultato.
- **Un ponte davanti a un servizio pubblico va difeso, o diventa un servizio
  pubblico anche lui.** Senza controllo sulla domanda, chiunque ci passa una
  richiesta che legge mezzo pianeta e a farsi bloccare siamo noi — con la
  nostra identita', quella messa apposta per essere riconoscibili. Si accetta
  **solo la forma esatta** che l'app produce, consumando la domanda pezzo per
  pezzo: un'espressione regolare che cerca le cose vietate lascia sempre fuori
  quella a cui non si e' pensato.
- **Una regola di sicurezza che non si riesce a provare e' una regola di cui
  non si sa niente.** Qui non c'e' Deno, quindi la Edge Function non si puo'
  lanciare. Il controllo vive in `domanda.mjs`, importato **dalla funzione e
  dalla prova**: una regola sola, usata da tutti e due, che non possono
  divergere.
- **Quando una promessa sulla privacy smette di essere vera, si riscrive lo
  stesso giorno.** `PRIVACY-STORE.md` diceva «sui server di GeppGo non arriva
  e non resta niente». Col ponte una posizione **passa** da un server nostro:
  arrotondata, senza identificativi, in una tabella **senza colonna "chi"** e
  buttata dopo trenta giorni — ma passa, e va scritto. La differenza fra
  «non passa» e «passa cosi'» e' esattamente quello che gli store chiedono di
  dichiarare.
- **⚠️ Nominatim era il piu' esposto, non Overpass.** Diciassette punti
  nell'app — la ricerca degli alberghi, gli indirizzi, la citta' di ogni
  viaggio, la valuta — contro UNA richiesta al secondo e l'uso da app diffuse
  esplicitamente sconsigliato. Sullo store sarebbe stato il primo a chiudersi,
  e con lui se ne andava la ricerca degli hotel. Adesso passa dallo stesso
  ponte (`supabase/functions/geo`).
- **Per gli indirizzi la memoria condivisa vale ancora di piu' che per i
  luoghi vicini.** Una ricerca vicina e' legata a un posto; un indirizzo no:
  «Colosseo, Roma» e' la stessa domanda per chiunque al mondo, oggi e fra un
  mese. La prima persona che lo cerca lo cerca per tutte le altre — e un
  albergo non si sposta, quindi le risposte si tengono trenta giorni invece
  di sette.
- **Ventun chiamate da spostare: si sposta l'INVOLUCRO, non le chiamate.**
  `fetchGeo` si usa esattamente come `fetch`, quindi i ventun punti sono
  rimasti come erano e la sostituzione e' stata meccanica. Rimaneggiarne
  ventuno a mano, ognuno coi suoi parametri, e' il modo di infilare un
  difetto proprio in quello che non si riguarda.
- **Il ponte non si fida del telefono.** L'app arrotonda la posizione prima di
  mandarla; il ponte **ricontrolla** e rifiuta quelle non arrotondate. Se un
  domani qualcuno togliesse l'arrotondamento dall'app, la posizione esatta
  non arriverebbe comunque a Nominatim. Una promessa sulla privacy che sta in
  un posto solo e' una promessa che si puo' perdere senza accorgersene.
- **⚠️⚠️ UN PONTE PIU' LENTO DELLA PAZIENZA DI CHI LO ASPETTA NON E' UN
  PONTE.** Il ponte provava cinque server da venticinque secondi l'uno IN
  FILA - fino a due minuti - mentre il telefono lo aspettava ventuno. Quando
  la mappa arrancava il ponte perdeva **sempre**, per costruzione: il telefono
  lo mollava, lo segnava rotto per un minuto e tornava a chiamare da solo.
  Cioe' non serviva proprio nel caso per cui esiste. I due numeri vivevano in
  due file diversi - uno nell'app, uno nella funzione - e non li confrontava
  nessuno: adesso stanno in `domanda.mjs`, che la prova legge insieme alla
  costante dell'app. **Quando due numeri devono stare in un certo rapporto e
  abitano in file diversi, quel rapporto va scritto in una prova**, se no e'
  solo una speranza.
  Nota che consola: anche quando il telefono molla, la funzione va avanti per
  conto suo e scrive la risposta in memoria. La persona dopo la trova pronta.
- **Due riquadri che si toccano si chiedono ai riquadri, non alle classi.**
  La collisione qui sopra l'ha trovata la prova, non l'occhio: confronta i
  `getBoundingClientRect` di scritta, gradi e sole e dice quali si
  sovrappongono. Con un nome corto tutte le versioni sembravano giuste. Una
  prova di layout che guarda i margini nel CSS non avrebbe visto niente:
  i margini erano scritti bene.
- **Una fila che sborda di quattro pixel è peggio di una che sborda di
  cento.** Con sette voci la barra ci stava quasi: quattro pixel di troppo
  su un telefono da 390, che però accendevano la sfumatura e lasciavano
  scorrere la pillola — cioè promettevano altre voci che non esistevano.
  Sei pixel di padding in meno per voce (da `.7rem` a `.64rem`, tasto da 49
  a 47 di larghezza, sempre sopra i 44 che servono a un dito) e ci sta
  tutto. Quando qualcosa sborda di pochissimo, la risposta giusta di solito
  non è farlo scorrere meglio: è **farcelo stare**.
- **⚠️⚠️ DUE COSE COPRONO TUTTO LO SCHERMO, e tutte e due si mangiano i
  tocchi solo sulla macchina delle prove.** Premere con `elementFromPoint`
  è l'unico modo di sapere cosa tocca un dito vero — e per lo stesso motivo
  è l'unico modo di finirci contro. `.click()` e `go()` le attraversano e
  non se ne accorgono. **Prima di premere qualunque cosa servono tutte e
  due queste righe**, e questa lezione è costata due giri di CI:
  1. `skipAuth: true` nello stato salvato. Senza, l'app apre «accedi o crea
     account» a tutto schermo (`#authGate`). Qui non si vede, perché la
     libreria di Supabase sta su una CDN che da questa macchina non si
     raggiunge e il pannello non si apre proprio; in CI la rete c'è.
  2. `await p.waitForFunction(() => !document.getElementById('bootSplash'))`.
     La schermata d'avvio è `inset:0` con `z-index:99999` e si toglie da sola
     sette decimi **dopo l'avvio**. Aspettare `typeof go === 'function'` non
     è aspettare lei: `go` esiste appena il file è letto, molto prima. In CI
     i caratteri di Google si scaricano davvero, l'avvio arriva più tardi, e
     il dito atterra sulla schermata nera.
  Il punto 1 era già scritto qui sotto e dentro `prova-undo.js`, e ci sono
  ricascato lo stesso: una lezione scritta in prosa si legge dopo aver
  sbagliato. Per questo adesso sono **due righe da copiare**, non un
  racconto.
- **Un messaggio d'errore che dice il tipo e non il nome fa perdere un giro.**
  La riga rossa diceva «sotto il dito c'era: DIV» — vero e inutile, perché
  prendeva `class || tagName` e quel div una classe non ce l'ha. Con l'id il
  messaggio dice «#bootSplash» e il difetto si legge dalla riga. Quando si
  scrive il testo di un fallimento si mette **quello che identifica la cosa**,
  non quello che la descrive.

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
