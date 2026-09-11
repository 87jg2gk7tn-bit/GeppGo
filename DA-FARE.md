# GeppGo — a che punto siamo

Aggiornato: 11 settembre 2026.

Questo file esiste perché le sessioni di lavoro non si ricordano fra loro.
Chi riprende in mano il progetto — Giacomo o un assistente — legge qui e sa
dov'era rimasto, senza rifare ragionamenti già fatti.

---

## ⚠️ DA FARE SUBITO

~~**Lanciare su Supabase lo schema aggiornato**~~ ✅ **fatto l'11 settembre**:
i sette permessi rispondono tutti `ok`, quindi la colonna `percorso_mini` (le
miniature) e la tabella `raccolte` («A raccolta») ci sono.

Restano due cose, e non sono codice:

- **Guardare in quale regione sta il progetto Supabase** (Project Settings →
  General → Region): serve a completare una frase della privacy policy. Se è
  fuori dall'Europa va detto per nome. Cinque minuti.
- **Far leggere a un avvocato la parte «A raccolta» della privacy policy.** Il
  riassunto pronto da mandargli, con le sei garanzie strutturali e le cinque
  domande, sta in fondo a `PRIVACY-STORE.md`.

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

⚠️ **Con «A raccolta» (punto 13) la privacy policy è cambiata**: adesso c'è un
caso in cui una posizione viene conservata, ed è dichiarato in `privacy.html`
e in `PRIVACY-STORE.md`. Se il testo è già passato da un avvocato, quel pezzo
va rifatto vedere.

### Poi, per crescere

6. ~~**Cinque lingue**~~ ✅ **finito** (italiano, inglese, spagnolo, francese,
   portoghese). **720 frasi per lingua**, e a schermo **non resta più niente
   in italiano**: c'è una prova che gira per tutte le schermate e per tutti e
   cinquantatré i pannelli in ognuna delle quattro lingue e non deve trovare
   una parola italiana. Superata la soglia dell'80%, **le lingue si
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

    **Quello che resta di questo punto:** le attese (oggi l'app dice «Cerco…»
    a parole, che è onesto e leggibile — non serve metterci scheletri sopra
    per forza) e gli altri stati vuoti che sono ancora cartelli senza
    un'azione vicina («Nessun luogo salvato», «Niente in time-table»,
    «Nessuna voce ancora» nei bagagli) — **da guardare uno per uno prima di
    toccarli.** Il passaggio fra una schermata e l'altra è stato misurato ed è
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
