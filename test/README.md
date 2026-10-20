# Le prove di GeppGo

```sh
npm install       # la prima volta
npm test          # tutte
npm run test:app  # solo quelle sull'app
npm run test:db   # solo quelle sul database
```

`npm test` le lancia tutte e in fondo dice come è andata. Girano anche da sole
a ogni modifica: `.github/workflows/prove.yml`.

Prima bisognava ricordarsi quali esistevano e lanciarle una per una. Funziona
finché qualcuno se le ricorda — cioè finché non se le dimentica, che è
esattamente il momento in cui servivano.

## Cosa serve per lanciarle

- **`npm install` deve raggiungere `cdn.sheetjs.com`**: SheetJS (i file di
  Excel) si installa da lì, perché su npm è ferma a una versione con falle
  note. Senza, `prova-importa` e `prova-avvio` non trovano il pacchetto.
- **Node** e **Chromium**. Il browser si prende da `CHROMIUM_PATH` se c'è,
  altrimenti da dove l'ha messo Playwright.
- **Postgres**, solo per le prove sul database: si dice dove sta con le
  variabili di sempre (`PGHOST`, `PGPORT`, `PGUSER`). Se non risponde, quelle
  prove vengono **saltate e dichiarate tali** invece di far finta che sia
  andato tutto bene.

  Averlo è più facile di quanto sembri, e per mesi non lo si è saputo: su una
  Ubuntu con `postgresql` installato bastano `pg_ctlcluster 16 main start`, un
  ruolo superuser con lo stesso nome dell'utente e un database suo, e poi
  `PGHOST=/var/run/postgresql npm run test:db`. Scrivere una prova sui
  permessi senza poterla lanciare vuol dire scoprire in CI, dopo il push, che
  aveva un errore di sintassi.

Le prove sul database ripartono sempre da un database vuoto: una prova che
eredita lo stato di quella prima non dice niente di affidabile.

## Due trappole, imparate a caro prezzo

**Nessun percorso si scrive a mano.** Sei prove avevano dentro
`file:///home/user/GeppGo/Index%202.1.html`: passavano su quella macchina e
fallivano dovunque altro. Si usa `APP` di `browser.js`, e il lanciatore boccia
chi se lo riscrive.

E ne erano rimasti altri due, in un posto che nessuno guardava: due prove
scrivevano le immagini dentro la cartella di lavoro di **una sessione**
(`/tmp/claude-0/...`). La guardia cercava solo `/home` e `/Users` — adesso
guarda anche `/tmp` e `/var`. Per le immagini c'è **`cartellaFoto()`** in
`browser.js`, che dà una cartella temporanea vera.

Quelle immagini, va detto, **non sono controlli**: nessuna prova ci fa sopra
un'asserzione, servono a chi vuole vedere com'era la schermata. Per questo
stanno in un `try/catch` — fotografare un *elemento* fa aspettare a Playwright
che stia fermo, e su una macchina lenta «element is not stable» ha fatto
diventare rossa `pos` con tutti e 21 i controlli passati. Un'immagine di
contorno non può bocciare una prova.

**Nello stato di prova ci va `skipAuth: true`,** se la prova non riguarda
l'account. Senza, l'app apre a tutto schermo il pannello "accedi o crea
account", che si mangia i tocchi: un `page.click` va in scadenza dopo trenta
secondi con un messaggio che non nomina il pannello. Il bello è che *dipende
dalla rete* — dove la CDN di Supabase non si raggiunge il pannello non si apre
e la prova passa, dove si raggiunge no. Una prova che dipende da cosa riesce a
scaricare non è una prova.

**Il foglio «I tuoi viaggi sono solo su questo telefono» nelle prove è già
visto.** Dal 12 ottobre 2026 compare alla prima apertura a chi ha già dei
viaggi senza account — cioè in quasi tutte le prove, che partono proprio
così — e copriva lo schermo: metà della batteria è diventata rossa in un
colpo, con tocchi andati in scadenza. `newPage` di `browser.js` lo segna come
già visto (anche dopo gli `addInitScript` della prova, che di solito
riscrivono localStorage); chi lo vuole vedere apre la pagina con
`newPage({ avvisi: true })`, come fanno `prova-dati` e
`prova-cloud-personale`.


Il cloud di GeppGo si regge su una riga sola. L'app chiede i viaggi così:

```js
sb.from('trips').select('*')
```

Senza nessun filtro: non dice "dammi i miei", dice "dammi tutto" e si fida che
sia il database a consegnare solo quelli a cui hai diritto. Da quando il
progetto Supabase è uno solo per tutti, le regole in `supabase-schema.sql` sono
l'unica parete tra i dati di una persona e quelli di tutte le altre.

Una parete così non si guarda: si prova. Queste due prove ricostruiscono un
Supabase finto dentro un Postgres qualsiasi e mettono tre persone a spingere
contro il muro — Anna che crea il viaggio, Bruno invitato, Carla estranea.

## Come si lanciano

Serve un Postgres (basta quello di sistema, versione 14 o più recente).

```sh
psql -f test/supabase-ambiente-finto.sql    # i due ruoli, auth.users, auth.uid()
psql -f supabase-schema.sql                 # lo schema vero, quello che va su Supabase
psql -f test/supabase-prova-permessi.sql    # le prove
```

L'ultima stampa l'elenco dei controlli e in fondo `45/45 passati`. Se compare
`CI SONO PROVE FALLITE`, c'è un buco: non si tocca il database vero finché non
torna verde.

## Perché esistono

Non sono decorative. Alla prima esecuzione ne fallirono sei, e sotto c'era un
buco vero: un compagno di viaggio poteva mandare un normale aggiornamento
scrivendosi `owner = sé stesso`, diventare proprietario del viaggio degli altri
e da lì cancellarlo a tutti.

Il motivo è sottile. In un UPDATE, `using` guarda la riga vecchia e `with check`
quella nuova — la vecchia, nel `with check`, non è proprio disponibile. Quindi
`with check (owner = auth.uid())` non impedisce affatto di *diventare* il
proprietario: appena te lo scrivi, la condizione è vera. A tenere fermo il
proprietario ci pensa il trigger `trips_campi_bloccati`, che è l'unico posto in
cui il prima e il dopo si vedono insieme.

Rileggendo le policy quel buco non si notava: il commento che le accompagnava
diceva, con sicurezza, l'esatto contrario di quello che facevano.

Lo stesso inganno si ripresenta ovunque un permesso debba proteggere un
*campo* invece di una riga — il ruolo di un membro, la richiesta di
eliminazione — ed è per questo che quei campi hanno tutti un trigger che li
custodisce, e una prova che ci spinge contro.

## Prova sul lato app

```sh
node test/prova-ruoli.js
```

Ventisette controlli su come l'app legge i ruoli: chi conta per il limite del
piano gratuito, chi vede il tasto per eliminare e chi quello per uscire, cosa
compare quando un admin chiede di eliminare un viaggio. Serve `playwright-core`
e il Chromium di sistema.

## Provare l'aggiornamento, non solo lo schema finito

`supabase-com-era.sql` ricostruisce il progetto vero com'era prima di questo
schema: stesse tabelle, stesse colonne, e soprattutto gli stessi permessi
stratificati che ci si era accumulato sopra — quindici, di due generazioni
diverse (`owner delete trips` accanto a `trips_delete_owner`, e così via).

```sh
psql -f test/supabase-ambiente-finto.sql
psql -f test/supabase-com-era.sql        # il progetto com'era
psql -f supabase-schema.sql              # ci si passa sopra
psql -f test/supabase-prova-permessi.sql # 48/48
```

Serve perché uno schema può essere giusto e **posarsi male**. In Postgres i
permessi si sommano: ne basta uno vecchio e dimenticato per riaprire quello
che lo schema chiude. Nel progetto vero restavano due `DELETE` sui viaggi, e
il risultato era che l'eliminazione rispondeva correttamente «in attesa del
secondo admin» — e poi un `DELETE` diretto portava via il viaggio lo stesso.

Gli ultimi tre controlli della prova esistono per questo: verificano che dopo
lo schema i permessi siano **esattamente** sette, con i nomi giusti e nessun
`DELETE` sui viaggi.

## Le foto

```sh
psql -f test/supabase-prova-foto.sql   # 33 controlli sui permessi delle foto
node test/prova-foto.js                # 77 controlli sul comportamento dell'app
```

Le foto sono la cosa più delicata che GeppGo custodisca, e la parte che le
riguarda è fatta più di limiti che di funzioni. Quello che le prove
verificano, in sostanza:

- una foto la vedono **solo** le persone di quel viaggio — un estraneo non la
  raggiunge nemmeno conoscendone l'indirizzo esatto, né la riga nel registro
  né il file;
- non si carica a nome di un altro, né dentro il viaggio di altri;
- il magazzino accetta **solo JPEG fino a 4 MB**: qualunque altra cosa viene
  respinta prima ancora che i permessi entrino in gioco;
- gli indirizzi con cui si scaricano sono firmati e **scadono in un'ora**:
  non sono link che si possano girare;
- chi è nel viaggio può **segnalare**, e la segnalazione non si cancella
  dall'app né si scrive a nome di un altro; chi viene segnalato non lo scopre;
- una foto **bloccata** sparisce dalla vista di tutti ma resta nel registro, e
  la segnalazione ricorda di quale file parlava anche dopo che la foto non c'è
  più;
- l'**admin del viaggio** può togliere la foto di chiunque, e togliere una
  persona dal viaggio.

E quanto si scarica, che qui è una misura e non un'impressione. Il finto
magazzino tiene i byte veri dei file caricati e li ridà uguali, così la prova
può dire il numero: sincronizzando un viaggio scendono **34 KB a foto invece
di 1316** — la copia piccola, non l'intera. La foto vera arriva solo quando
qualcuno la apre davvero, una volta sola, e da lì resta sul telefono; chi la
salva nel rullino se la prende comunque intera. Le prove verificano anche i
due modi in cui questo poteva rompere le cose vecchie: una foto caricata prima
che le miniature esistessero si scarica lo stesso, e un database su cui lo
schema non è stato rilanciato accetta la foto comunque, senza la miniatura.

Il cloud di `prova-foto` è finto (`sb` e `session` scritti a mano). La
libreria vera si ferma, e il finto si mette quando l'avvio ha smesso di
aspettarla (`cloudGiu`): prima, se il «non arriva» capitava col finto già al
suo posto, l'avvio faceva partire la sincronizzazione col finto e la prova
cadeva a caso, qui e sul server delle prove (vedi `DA-FARE.md`, «`prova-ruoli`
rossa a caso»).

## Come si muove l'app

```sh
node test/prova-movimento.js   # 16 controlli su animazioni e movimento ridotto
```

Questa prova nasce da una scoperta scomoda: **la salita dei fogli era scritta
nel foglio di stile dal primo giorno, sembrava giusta a leggerla, e non era
mai partita.** Una transizione non parte da `display:none` — il browser non ha
un "prima" da cui muoversi e mette tutto subito al suo posto. In tutta l'app i
fogli comparivano già arrivati, e chiudendoli sparivano.

Leggendo il codice non si vedeva. Per questo la prova non controlla che
*esista* un'animazione: **guarda dove sta il foglio fotogramma per
fotogramma** e pretende che si muova. Sul codice di prima otto controlli su
sedici diventano rossi, e il primo dice tutto: `0 px di 111`.

Controlla anche che, mentre scende, il foglio **non si mangi i tocchi** — resta
grande quanto lo schermo per un terzo di secondo — e che con «riduci il
movimento» acceso le animazioni diventino **istantanee e non sparite**:
togliendole del tutto, le cose resterebbero dove si trovavano a metà strada.

## Quanto è grande quello che si tocca

```sh
node test/prova-tocchi.js   # 5 controlli su tutti i tasti dell'app
```

Apple indica **44×44** come minimo, e non è un capriccio da linee guida:
GeppGo si usa camminando per una città che non si conosce, con una mano sola,
di fretta. Un tasto da 27 px lo si sbaglia — e sbagliarlo vuol dire aprire la
cosa accanto.

Misurato prima di questa prova: la barra in basso era alta **41 px**, le
scorciatoie della home **27**, il «+» della giornata **26**, la X della
pubblicità **14**. Niente di tutto questo si vedeva leggendo il codice.

La correzione allarga l'area invisibile che risponde al dito (`::after`) senza
toccare l'aspetto, e per questo la prova controlla **due cose insieme**:

1. che ogni tasto arrivi a 44×44;
2. che le aree allargate **non si rubino i tocchi a vicenda**. Un'area
   invisibile che copre il tasto accanto è peggio di un tasto piccolo: il dito
   va nel posto giusto e succede la cosa sbagliata. Si controlla toccando i
   quattro angoli di ogni area e guardando chi risponde.

C'è anche un controllo che sembra strano e non lo è: **che i tasti restino
piccoli a vedersi.** Se un giorno qualcuno «sistemasse» la faccenda mettendo
del padding vero, l'app cambierebbe faccia — ed è esattamente quello che non
si vuole.

**Tre CI rosse per imparare una cosa sola**, e sono il motivo per cui la
verifica delle sovrapposizioni è geometrica e non fatta chiedendo al browser
«chi risponde in questo punto?».

Quella domanda dà risposte diverse in posti diversi: la barra in basso è una
pillola con gli angoli tondi, e il browser rispetta il raggio nel decidere chi
risponde — l'angolo dell'area allargata di una voce ci cade *fuori*, e fuori
c'è la pagina. La risposta cambia anche con la larghezza dello schermo, con i
font (qui quelli di Google non si scaricano, in CI sì) e con quanto la barra è
scorsa. Verde qui per dieci giri, rossa in CI tre volte.

Adesso la prova confronta i rettangoli delle aree fra loro e dice anche di
quanti pixel si sovrappongono (`per 18×45 px`). È la domanda giusta — *due
tasti vicini si prendono lo stesso pezzo di schermo?* — e i rettangoli danno
la stessa risposta ovunque.

Resta il giro su **tre condizioni**: 390 px, 320 px (un iPhone SE, cioè un
telefono vero) e 390 con le voci della barra allargate apposta, che simula i
font che qui non arrivano.

**L'area parte dall'interno del bordo.** Fino al 15 ottobre la prova sommava
l'`inset` del `::after` al riquadro esterno del tasto; ma l'area invisibile si
misura da dentro il bordo, e su un tasto col bordo da 1 px `inset:-3px`
aggiunge 2 px fuori, non 3. I tasti col bordo (GPS, tema, Profilo, «+», le
icone delle intestazioni, la matita) erano da 42 px e la prova li vedeva da
44. Adesso il bordo si conta, e sul codice di prima la prova lo dice
(`gps-pill 42×42`). L'ha scoperto `prova-a-portata`, che tocca davvero.

## A raccolta

```sh
psql -f test/supabase-prova-raccolta.sql   # 17 controlli sui permessi
node test/prova-raccolta.js                # 39 controlli sul comportamento
```

È il tasto con cui chi organizza chiama gli altri, e **l'unico posto dell'app
in cui una posizione esce dal telefono e arriva ad altre persone**. Quattro
cose lo rendono accettabile, e sono tutte scritte nella privacy policy: queste
prove esistono per non farle diventare false.

- è la posizione di **chi chiama**, mai di chi riceve — e nessuno può firmarla
  col nome di un altro;
- è presa in quell'istante e **non si aggiorna mai**: una prova controlla che
  sulla tabella non esista nessun permesso di `update`, perché con quello una
  riga diventerebbe un puntino che segue qualcuno per due ore;
- la può scrivere **solo un admin** del viaggio;
- **scade in due ore**, e passate quelle non la vede più nessuno — nemmeno chi
  l'ha fatta. Il limite è un `check` sulla tabella, non un valore di partenza:
  una prova tenta di scrivere una chiamata che dura un anno e verifica che
  venga respinta.

Sul lato app si controlla anche che nella chiamata non finisca **niente oltre
al minimo dichiarato**: viaggio, chi chiama, il suo nome, il punto e la nota.
Se qualcuno un giorno ci aggiungesse un campo, la prova diventa rossa.

Sono i meccanismi che il DSA (Reg. UE 2022/2065, art. 16) chiede a chi ospita
contenuti altrui e che l'App Store pretende alla linea guida 1.2: poter essere
avvisati, poter rimuovere, poter allontanare, ed essere raggiungibili.

## La cancellazione dell'account

```sh
psql -f test/supabase-prova-account.sql   # 21 controlli sul database
node test/prova-account.js                # 16 controlli sull'app
```

Apple la pretende da ogni app in cui ci si registra, e il GDPR la riconosce a
chiunque. La parte difficile non è cancellare: è **non portarsi via i viaggi
degli altri**. Le tabelle hanno `on delete cascade` sul proprietario, quindi
togliere l'utente e basta cancellerebbe i viaggi che ha creato — anche quelli
dove altre cinque persone stanno ancora viaggiando.

Le prove verificano che chi si cancella si porti via solo le proprie cose: il
viaggio dove era solo se ne va, quello con altri dentro **resta a loro** con
ruolo e proprietà passati a chi c'era, le sue foto spariscono e quelle degli
altri no, e la segnalazione che aveva fatto sopravvive senza più il suo nome.

C'è un caso che sfugge facilmente ed è coperto: **l'unico admin che non è il
proprietario**. Senza trattarlo, il guardiano che vieta all'ultimo admin di
uscire bloccherebbe tutta la cancellazione.

## La privacy

```sh
node test/prova-privacy.js
```

Una privacy policy vale quanto è vera. Queste prove non giudicano il testo:
controllano che **combaci con il codice**.

Il controllo che conta più di tutti confronta l'elenco dei servizi esterni che
l'app chiama davvero (cercando le `fetch` dentro l'HTML) con quelli dichiarati
nella pagina: **se domani si aggiunge un fornitore e ci si dimentica di
scriverlo, la prova fallisce.** È il modo per non ritrovarsi, fra sei mesi, con
un documento che descrive un'app che non esiste più.

Il resto verifica che ci siano le cose che devono esserci — titolare,
contatto, basi giuridiche, tempi, diritti, come cancellare l'account, a chi
reclamare, l'età minima — che la pagina non carichi niente da server esterni
(sarebbe curioso che proprio lei mandasse l'IP di chi la legge a qualcun
altro), che resti raggiungibile sotto `/privacy` prima della regola che
reindirizza tutto, e che dall'app ci si arrivi: alla registrazione e dal
Profilo.

## La cache delle ricerche

```sh
node test/prova-cache.js
```

Overpass sono tre server tenuti su da volontari, gratis e senza garanzie: con
l'app in mano a qualche centinaio di persone, chiedere ogni volta diventa
abuso — e il rischio non è teorico, ti bloccano e la ricerca smette di
funzionare per tutti.

Le prove contano **quante volte l'app chiama davvero Overpass**, che è
esattamente ciò che la cache deve ridurre: la stessa ricerca non si ripete,
venti metri più in là nemmeno, un chilometro più in là sì, e un bagno non
riusa la risposta dei bancomat.

Qui una prova ha bocciato il primo disegno. La cache arrotondava le coordinate
a griglia, e due ricerche a venti metri di distanza finivano in celle diverse
ogni volta che in mezzo cadeva un confine: mancava il colpo proprio nel caso
più comune, la stessa persona ferma nello stesso posto. Ora le risposte si
tengono con la loro posizione vera e si riusano se sono state prese entro 150
metri.

Le ultime due controllano il caso che conta di più: **con la memoria del
telefono piena la cache si toglie di mezzo** invece di rubare spazio ai
viaggi. Una ricerca lenta si rifà, un viaggio perso no.

## Il ricordo del viaggio

```sh
node test/prova-ricordo.js
```

I numeri (giorni, tappe, persone, chilometri, spesa), la cartolina e il
racconto da mandare. Il conto dei chilometri si guarda con attenzione: si
sommano solo *dentro* la giornata, perché fra la sera e la mattina dopo si è
dormito. Il viaggio di prova ha due giornate da un chilometro l'una: se la
notte venisse contata i chilometri sarebbero quattro invece di due, e c'è una
prova apposta che lo dice.

Due controlli valgono più di tutti gli altri, e sono la stessa regola vista da
due lati:

- **aprire il ricordo non chiama nessun server.** Se un giorno diventasse una
  pagina da caricare da qualche parte, quella prova diventerebbe rossa — ed è
  esattamente il momento in cui bisogna fermarsi, perché è la tutela sulle
  foto che regge tutto il resto;
- **il racconto non contiene il codice d'invito.** Un racconto è fatto per
  essere girato, un invito no.

E le foto: nella cartolina **non ci finiscono di suo**. Vanno accese apposta,
con scritto accanto che le foto sono di tutti quelli che erano lì. La prova
guarda i punti rossi dentro l'immagine disegnata: zero prima, tanti dopo.

## Leggere la mail di conferma

```sh
node test/prova-prenotazioni.js
```

È il motivo per cui la gente usa TripIt, e il lettore che c'era funzionava solo
in italiano. Le mail della prova sono scritte come arrivano davvero — con
l'intestazione, il «Gentile cliente», il numero dell'assistenza in mezzo e gli
orari sparsi — perché è su quelle che deve funzionare.

Quanto contava, misurato sul lettore di prima con le stesse mail: la conferma
inglese perdeva la data e prendeva come ora di partenza le **09:00**, che era
l'orario di apertura dell'assistenza clienti; quelle spagnola e francese
finivano «non riconosciute» e si chiamavano *Estimado cliente,* e *Bonjour,*.

Tre controlli meritano di essere letti:

- **andata e ritorno sono due prenotazioni.** Una mail di Trenitalia ne
  contiene due; prima se ne leggeva una e il ritorno andava scritto a mano,
  cioè non veniva scritto. Un soggiorno in albergo invece resta uno solo:
  «arrivo» e «partenza» lì sono il check-in e il check-out.
- **`03/15/2026` è marzo**, non il quindicesimo mese. Quando il primo numero
  non può essere un giorno, l'ordine americano si riconosce da solo.
- **leggere una prenotazione non manda niente a nessuno.** Il testo di una
  conferma contiene il nome, il codice e a volte il documento: farselo leggere
  da un servizio esterno sarebbe la cosa più facile e la più sbagliata, ed è il
  contrario di quello che il pannello promette. La prova conta le chiamate di
  rete e verifica anche che la promessa sia ancora scritta lì.

## La mappa senza rete

```sh
node test/prova-mappa.js
```

Il momento in cui GeppGo serve di più è quello in cui il telefono non ha campo.
Tutto il resto già funzionava offline: l'unica cosa che diventava un rettangolo
grigio era lo sfondo della mappa. Misurato: la stessa zona, guardata con la
rete e riaperta senza, **prima mostrava 0 tessere su 9; ora 9 su 9**.

Il controllo che vale più di tutti è quello che tiene ferma una scelta:
**non esiste uno «scarica tutta la città»**. Scaricare tessere in blocco dai
server di OpenStreetMap è vietato dalle loro condizioni — sono volontari, e ti
bloccano, esattamente come per Overpass. La prova guarda quello che l'app fa
davvero (una schermata deve chiedere una ventina di tessere, non centinaia) e
non cerca parole nel codice: un controllo sulle parole boccerebbe la frase che
spiega la scelta.

Due cose imparate scrivendola, e valgono per tutte le prove:

- **l'app va servita da un indirizzo vero, non da `file://`.** Tenere le
  tessere da parte vuol dire prenderle con `fetch`, e da una pagina aperta come
  file il browser non lo lascia nemmeno partire: la prova direbbe «non le tiene
  da parte» per un motivo che sul telefono non esiste. Quindici righe di server
  valgono la differenza;
- **`'**/tile.openstreetmap.org/**'` non intercetta niente.** Quel modello
  vuole una barra prima di `tile`, e l'indirizzo vero è
  `a.tile.openstreetmap.org`. Le richieste passavano e la prova le guardava
  senza vederle. Si usa un'espressione regolare.

## Le lingue

```sh
node test/prova-lingue.js
```

La chiave del dizionario è **la frase italiana stessa**, non un codice. Su
un'app di dodicimila righe scritta tutta in italiano è la scelta che rende la
cosa fattibile — niente tremila nomi di chiavi da inventare, niente tremila
punti del codice da toccare — e ha una conseguenza che vale più di tutto il
resto: **quello che non è ancora tradotto resta in italiano**, invece di
mostrare `menu.spese.aggiungi` a qualcuno che sta viaggiando.

Metà dei controlli guardano proprio quello: una frase mai tradotta torna
uguale, una frase vuota non fa saltare niente, e una lingua che non sappiamo
dire (tedesco) torna all'italiano invece di lasciare l'interfaccia sfondata.

Gli altri due che contano:

- **resta tradotta dopo un ridisegno.** Le schermate si rifanno da capo con
  `innerHTML` e si portano via la traduzione fatta all'avvio: senza ripassare
  dopo `renderAll()`, l'app tornava in italiano al primo tocco.
- **il Profilo dice quanto è tradotto davvero.** Una persona che vede metà app
  in italiano deve sapere perché: la percentuale è vera, contata sulle frasi
  che stanno nelle schermate.

E il dizionario si controlla da sé: le quattro lingue devono avere le stesse
frasi, nessuna traduzione vuota, e non devono essere l'italiano ricopiato per
far salire il conto.

**Il controllo che conta davvero** è l'ultimo arrivato, e la prima versione
**diceva una bugia**. Cercava frasi contenenti una parolina italiana (`il`,
`che`, `non`, `giorni`): «Esci», «Saldi», «Recupero», «Condividi» non ne hanno
nessuna, quindi per la prova non esistevano. Ha detto *zero frasi rimaste in
italiano* mentre a schermo ne restavano ottanta — i tasti del Profilo e quelli
della home. L'ha visto una persona aprendo l'app, non la suite.

Il metodo di adesso non indovina, **confronta**: la stessa schermata si apre
in italiano e nella lingua da provare, si gira per tutte le pagine e si aprono
tutti i pannelli, e si raccoglie quello che si legge. Una stringa identica in
tutt'e due o è un nome proprio, o non è tradotta.

Due accortezze lo rendono esatto invece che rumoroso:

- fra italiano e spagnolo molte parole coincidono **per davvero**
  («persona», «hotel», «total»), e la differenza la dice il dizionario: se
  quella stringa è un **valore** della lingua d'arrivo, è la traduzione giusta
  che si dà il caso coincida;
- le frasi composte escono da `tv()` col buco già riempito, quindi nel
  dizionario non si trovano più: vanno cercate in `GIA_TRADOTTE`.

I nomi propri stanno in un elenco scritto nel file, dove si vedono e si
discutono, invece che dentro un'espressione regolare. E si scarta anche quello
che coincide per forza: una data scritta bene («dom 15» è l'abbreviazione
giusta sia in italiano sia in spagnolo — *domenica*, *domingo*), le unità
(«88 min · 6.1 km»), e i nomi che ha scritto una persona, presi dal viaggio di
prova e non da un elenco a mano, così una tappa nuova non diventa un falso
allarme.

**Il viaggio di prova è pieno apposta.** Con un viaggio vuoto — un
partecipante, nessuna tappa, nessuna spesa — metà delle frasi non si disegna
mai, e la prova non le vede nemmeno: è esattamente così che ottanta frasi in
italiano sono passate sotto il naso. Riempiendolo (due persone, tappe con
orario, una prenotazione da fare, una spesa, un biglietto) il confronto passa
da 763 a 801 frasi per lingua, e sul codice di prima ne trova 55 invece di 44.
Quando si aggiunge una schermata, **si aggiunge anche il dato che la fa
comparire**, altrimenti la prova la guarda senza vederla.

Poi le **frasi composte**. Erano l'ultimo pezzo rimasto in italiano: «1
TAPPA», «Devi 12,00», «GIAPPONE · GIORNO 1 DI 3». Cucite da pezzi funzionavano
solo in italiano, perché altrove il numero va da un'altra parte e il plurale
non si fa allo stesso modo. Ora la chiave è la frase intera coi buchi `{1}`,
`{2}` e si riempie con `tv()`. La prova controlla che si traducano intere, che
una mai tradotta resti in italiano col buco riempito lo stesso, e che il
conteggio della copertura sappia che sono già tradotte — senza quest'ultimo
pezzo risulterebbero non tradotte *proprio perché* sono tradotte bene.

Infine **date e numeri**: in inglese «Tuesday 1 September» e `¥1,234,567`,
in italiano «martedì 1 settembre» e `1.234.567 ¥` (lo yen non ha decimali, e
il simbolo va dove lo mette la lingua: dal 16 ottobre `fmtMoney` usa
`Intl.NumberFormat`, vedi «Traduzioni al 100%» qui sotto). Erano trentasette
`'it-IT'` scritti a mano. La cifra di prova è un milione e non duemila per un
motivo: in italiano e in spagnolo, per le regole comuni, i gruppi partono
dalla **quinta** cifra, e se 2400 diventi `2400` o `2.400` dipendeva dalla
versione di ICU del browser — la prova diceva cose diverse qui e in CI.
Adesso l'app separa sempre le migliaia (`useGrouping:'always'`), ma la cifra
resta quella.

E un avvertimento che vale oltre le lingue: **certi cartelli dipendono dalla
rete**. «⚠️ Viaggi solo su questo telefono» esce solo se la libreria di
Supabase si è scaricata e non c'è una sessione: dove la rete non c'è, quel
cartello non compare e la prova dice che va tutto bene, mentre in CI era
rimasto in italiano per intero. La prova adesso **mette in scena** i due stati
invece di aspettarli.

Un avvertimento sul tempo: aprire una pagina qui costa **tredici secondi**, e
non è colpa dell'app — il foglio di stile di Google Fonts non è raggiungibile
e ci mette 12,7 secondi a fallire, bloccando il `domcontentloaded`. Per questo
i controlli nuovi riusano le pagine già aperte invece di aprirne una per
domanda.

Un controllo merita una riga a parte: **una lingua si accende da sola solo
all'80% del dizionario**. Sotto quella soglia l'app resta tutta in italiano
anche se il telefono è spagnolo — un'app mezza tradotta è peggio di una tutta
in una lingua sola, chi la apre pensa che sia rotta. La prova verifica tutte e
due le facce: che una lingua svuotata non ci passi, e che riempiendo il
dizionario la lingua si accenda da sola senza toccare una riga di codice.

Questo guasto l'ha trovato la suite completa: le prove girano con la lingua di
sistema inglese, e con la scelta automatica accesa l'intera app era passata
all'inglese al 2%. Due prove che non c'entravano niente sono diventate rosse —
ed era il prodotto a essere sbagliato, non loro.

Da quando il dizionario ha passato l'80%, **le lingue si accendono da sole**:
l'app segue la lingua del telefono. Per questo in `test/browser.js` le pagine
nascono sempre in italiano — ereditare la lingua del computer su cui girano le
prove significherebbe provare l'app in inglese senza averlo deciso, ed è già
successo una volta: due prove che non c'entravano niente sono diventate rosse
perché il server delle prove parla inglese. Chi vuole un'altra lingua la
chiede, e la sua scelta vince.

## L'assistente

```sh
node test/prova-ai.js   # 88 controlli, col ponte dell'assistente finto
```

Le dodici chiamate all'assistente passano da una porta sola, `chiediAI`,
e questa prova la mette alla prova al posto del ponte vero: un ponte finto
risponde quello che decide la prova, quando lo decide, o mai. Così si vedono
a comando i casi che col ponte vero capitano a caso: il modello che non
risponde, il server che inciampa e poi si riprende, la quota finita (con
l'ora del ritorno, nell'ora di Roma), la richiesta troppo grande, il JSON
fra ``` o mezzo rotto, il doppio tocco, «Annulla», la ricerca sul web che
non c'è. E si guarda cosa parte: quante richieste, in che lingua chiedono la
risposta, che nessuna nomini un modello.

La parte che conta di più è la **13**: un viaggio pieno di quello che a una
ricerca sul web non deve arrivare (compagni con nome e cognome, «Cena da
Marco», un telefono, un'email, un numero lungo). Si guarda l'elenco che
l'app manda al ponte, e poi **la stessa richiesta si passa al ponte vero**
(`worker/ponte-ai.js`, caricato in Node) con un modello finto che nella riga
`CERCA` ci mette nome, email e telefono di chi scrive: a Tavily deve
arrivare solo «Torre di Belém Lisbona opening hours 2026-11-03».

Poi: gli orari e i posti da OpenStreetMap senza assistente (con Nominatim
finto), i PDF scansionati che partono come immagini (con un pdf.js finto:
pagine senza testo), la mappa dell'app compatta, la foto di un reel
ridisegnata e senza il blocco Exif col punto GPS.

Due cose imparate scrivendola:

- **`context.setOffline(true)` non ferma le rotte di Playwright.** Una
  richiesta intercettata con `route.fulfill` arriva lo stesso, e sul codice di
  prima l'app «senza rete» trovava i posti. Per dire che non parte niente si
  contano gli eventi `request`, non le risposte.
- **Trenta secondi non si aspettano: si saltano.** Con `page.clock.install()`
  l'orologio della pagina scorre come quello vero finché la prova non lo fa
  saltare avanti (`fastForward`): il tempo massimo e «Annulla» dopo dieci
  secondi si provano in un attimo. Con `{ time }` e `timezoneId` si decide
  anche che ora è, e dove: è così che si prova «torna disponibile domani
  alle 02:00».

Sul codice di prima la prova passa 51 controlli su 88, e quelli che
falliscono falliscono per quello che l'app fa: dove una funzione nuova
manca, la prova guarda la scritta d'attesa che c'era anche prima. La 21 (la
foto senza GPS) passa anche lì: quella protezione c'era già, e la prova la
tiene ferma.

## Il ponte dell'assistente

```sh
node test/prova-ponte-ai.js   # 39 controlli, senza browser
```

`worker/ponte-ai.js` è il Worker che sta su Cloudflare. Qui gira in Node:
si carica da un indirizzo `data:` (è un modulo con `export default`), con un
modello finto al posto del collegamento `AI` di Workers AI e un `fetch` finto
al posto di Tavily. La prova decide cosa rispondono e guarda cosa ricevono:
le origini ammesse (anche nel preflight), i limiti (413 senza toccare il
modello), la traduzione dei formati, il ragionamento tolto e il secondo
tentativo quando ha mangiato i token, la quota finita (429 con l'ora del
ritorno), le ricerche di «serve prenotare?» e della chat — fatte solo di
pezzi dell'elenco, anche se il modello ci mette dei dati personali — e
Tavily senza chiave, con la chiave sbagliata, senza crediti o giù.

Per la controprova si lancia sul ponte di prima con `PONTE_AI=<file>` (il
suo codice stava in `GUIDA-AI.md` fino all'ottobre 2026, si ritrova nella
storia del progetto): lì non ne passa nessuno, 0 su 31 — alcuni gruppi si
fermano prima di arrivare in fondo.

## I dati al sicuro

```sh
node test/prova-dati.js   # 37 controlli, in dieci gruppi
```

Chi usa GeppGo senza account ha i viaggi solo nel telefono. Qui si prova
quello che lo protegge, con un finto supabase-js (servito al posto di quello
della CDN) che tiene un database in memoria, `window.__nuvola`: tabelle,
file caricati e l'elenco di tutto quello che l'app ha chiesto.
`__nuvola.giu` fa fallire ogni scrittura (la rete che cade a metà),
`__nuvola.fotoGiu` solo i caricamenti delle foto, `__nuvola.sessione` dice
se all'apertura si è già dentro. fflate arriva dal pacchetto installato, e
la prova lo usa anche in Node per aprire lo zip che l'app consegna. Il
foglio Condividi si finge (`navigator.share`), perché Chrome in Linux non ce
l'ha: così la prova tiene il file che l'app gli dà.

I gruppi: la memoria persistente chiesta al primo viaggio; il foglio «I tuoi
viaggi sono solo su questo telefono» (dopo il primo viaggio, poi una volta a
settimana, e all'apertura: subito la prima volta, poi non prima di una
settimana); l'account creato da quel foglio, che porta
nel cloud viaggi, foto e valigia senza perdere niente; la spiegazione della
Home in Safari su iPhone e non nell'app installata (`navigator.standalone`
finto); «Avevi già dei viaggi in Safari?», sopra la schermata d'accesso; il
backup aperto byte per byte (dati, valigie, foto piene e miniature, niente
pezzi di mappa) e ripristinato su un profilo vuoto, anche rifatto da un
altro programma, troppo grande, e scaricato dove Condividi non c'è; il
vecchio JSON; «Esci» con modifiche e foto in attesa, coi numeri giusti; lo
stato del cloud nel Profilo; le cinque lingue e gli schermi da 320 a 430 px,
chiaro e scuro.

Sul codice di prima passa 1 controllo su 16 — quello che chiede di non
rompere niente dove `persist()` non esiste — e gli altri gruppi si fermano
presto: i fogli nuovi lì non ci sono.

## Due telefoni, la valigia e le impostazioni

```sh
node test/prova-cloud-personale.js           # 29 controlli, in undici gruppi
psql -f test/supabase-prova-personale.sql    # 18 controlli sui permessi
```

Qui due telefoni dello stesso account e un compagno di viaggio parlano con
lo **stesso** cloud: un cloud finto che vive in Node (`Nuvola`), passato a
ogni pagina con `exposeBinding`, con le regole di chi vede cosa scritte come
nel database vero e il tempo reale che avvisa le altre pagine. Ogni pagina
può restare senza rete (`window.__offline`), ed è così che nascono i
conflitti veri: due telefoni che cambiano lo stesso viaggio senza vedersi.
`Nuvola.assente` fa rispondere `PGRST205` sulla tabella nuova, come un
Supabase dove la migrazione non è ancora stata lanciata.

I gruppi: il backup con le foto di chi lo fa e non quelle dei compagni; il
ripristino con l'account (il viaggio condiviso torna come copia privata e
quello del gruppo nel cloud non si muove, quello solo tuo torna com'era);
l'avviso alla prima apertura dopo l'aggiornamento, e poi non prima di una
settimana; la valigia da un telefono all'altro, e mai al compagno, e due
valigie fatte prima su due telefoni che diventano una sola, senza doppioni;
le
impostazioni che passano e quelle del telefono che restano (e non vanno
nemmeno nel cloud), e una navigazione al volo o i valori di serie di un
telefono appena installato che non passano sopra alla scelta fatta altrove; la tabella che non c'è, senza errori a schermo e senza
riprovare a ogni tocco; il database vero; compagni aggiunti da due telefoni
senza rete, e uno tolto che non ricompare; il nome cambiato su uno e le date
sull'altro; un viaggio del formato di prima, senza le ore dei campi, e un
telefono rimasto all'app di prima che cambia il nome portandosi dietro le
ore vecchie, e la valigia di una volta rimasta dentro il viaggio che non si
perde unendo; i testi nuovi in cinque lingue e niente fuori schermo da 320 a
430 px.

Sul codice di prima passano 3 controlli su 20 (i due del database, che
provano il file della migrazione e non l'app, e quello dello schermo); i
gruppi della valigia, delle impostazioni e della tabella assente si fermano
subito, perché lì le funzioni non ci sono. I cinque controlli aggiunti
dopo (la navigazione al volo, i valori di serie, le ore vecchie, la valigia
doppia, la valigia di una volta) falliscono ognuno rimettendo il suo pezzo
di prima, e solo quello.

Il gruppo 7 crea un database di prova suo, ci mette lo schema **senza** la
parte nuova, ci lancia sopra due volte il file di
`supabase/migrazioni/` — come farà chi lo incolla nel SQL Editor — e poi
`supabase-prova-personale.sql`; controlla anche che il file della
migrazione sia lo stesso testo che sta in fondo allo schema. Senza Postgres
si salta e lo dice (con `PROVE_TUTTE` no).

`supabase-prova-personale.sql` tiene vera una promessa sola: **ognuno legge
e scrive solo le proprie righe.** Bruno, compagno di Anna, non legge, non
cambia, non cancella e non riscrive a nome di lei, nemmeno passando
dall'inserimento; tiene però la sua valigia per lo stesso viaggio. Carla non
attacca una valigia a un viaggio non suo, chi non ha l'account non legge e
non scrive niente, la chiave dice sempre lo stesso viaggio della riga, una
riga non passa i 256 KB, chi è stato tolto dal viaggio non ci riscrive la
valigia, e tutto se ne va col viaggio o con l'account.

## Gli avvisi

```sh
node test/prova-avvisi.js   # 43 controlli, in otto gruppi
```

Su iPhone `new Notification` non funziona: in Safari non esiste, e
nell'app sulla Home iOS vuole la notifica fatta dalla service worker. Qui si
prova che ogni avviso passa da `avvisa()` e da `showNotification`, con
titolo, testo e dove porta il tocco; che il tocco porta davvero li'; che
senza permesso l'avviso e' un banner nell'app; e che i permessi si chiedono
con un foglio solo.

Da `file://` una service worker vera non si registra: la prova finge
`navigator.serviceWorker` (con una registrazione che tiene le notifiche
mostrate), `Notification` col suo permesso (e la risposta che dara'), la
posizione e il suo permesso, e tiene l'elenco delle domande fatte al
telefono e dei fogli aperti, in ordine. Il gestore del tocco e' quello vero
di `sw.js`, caricato in Node con un `self` finto: con l'app aperta la porta
davanti e le manda dove andare, da chiusa la apre con `#avviso=...`.

I gruppi: nessun `new Notification(` nel codice, e una sola chiamata a
`showNotification`; i sette tipi di avviso (tra poco, da prenotare, ora di
partire, in scadenza, tappa vicina, consiglio, A raccolta); il tocco per
ognuno, dal messaggio della service worker e da app chiusa, e una chiamata
scaduta che non si riapre; il banner col permesso negato, senza notifiche e
col «no» dato nell'app; il primo GPS con un foglio solo e poi notifiche e
posizione in quest'ordine, e «Non ora» che non accende niente; Safari
senza Home, che non chiede le notifiche e porta alla guida; la scheda del
Profilo, tradotta, col tasto che riaccende le notifiche; i testi in cinque
lingue e niente fuori schermo da 320 a 430 px, chiaro e scuro.

Sul codice di prima passano 2 controlli su 22 (la tappa vicina con l'app
davanti, che non aveva notifica nemmeno prima, e nessun errore in pagina):
gli altri gruppi si fermano subito, perche' le funzioni non ci sono. I file
(`Index 2.1.html`, `sw.js`) si leggono da dove sta l'app provata, cosi'
anche la controprova con `APP_URL` li legge dalla copia.

## I bagagli a portata di mano

```sh
node test/prova-reperibilita.js   # 36 controlli, in sette gruppi
```

La lista bagagli stava solo dentro la scheda del viaggio, e per trovarla si
e' dovuto chiedere all'assistente. Adesso in Home, sotto l'intestazione del
viaggio, c'e' la fila «🧳 Bagagli · 👥 Compagni · 🔗 Condividi», e nei sette
giorni prima della partenza e il primo giorno la scheda «Prepara la
valigia» col conto delle voci pronte. La regola che ne e' uscita
(«Nessuna funzione nascosta») sta in `CLAUDE.md`.

I gruppi: la fila si vede subito, sotto «Cosa cerchi qui intorno?», e i
tasti aprono i loro fogli (anche in un viaggio senza giorni; dal 15 ottobre
sono quattro, con «✈️ Viaggio» che apre la scheda del viaggio); fila e scheda
da 320 a 430 px, chiaro e scuro, con tasti di almeno 44×44, nessuna parola
spezzata a meta' e niente sopra i tasti (`elementFromPoint` al centro di
ognuno), e la scheda che non sta addosso alla fila ne' a «Fra poco»; quando
c'e' la scheda (da sette giorni prima al primo giorno, non otto giorni
prima, non dal secondo giorno, non in un viaggio concluso), col conto giusto
che segue le spunte e la lista vuota detta; la X che la chiude anche
ridisegnando e riaprendo l'app, e l'orologio portato a domani (`page.clock`)
che la fa tornare con un giorno di meno; la lista che si apre ancora dalla
scheda del viaggio, arrivandoci come una persona (barra → Time Table →
titolo → «🎒 Bagagli») e dal Profilo; `MAPPA_APP` col percorso nuovo, letto
dall'assistente in cinque lingue; le frasi nuove (dieci, e «✈️ Viaggio»)
nel dizionario e a schermo in en, es, fr e pt, intere anche a 320 px.

Sul codice di prima passano 9 controlli su 25: quelli dove la scheda non
deve esserci, la scheda del viaggio (che c'era gia' e deve restare), le tre
misure senza tasti da misurare e nessun errore in pagina. Le prime misure
guardavano solo l'italiano e passavano anche con «Companheir / os» in
portoghese: la controprova su quella versione adesso fallisce, e lo stesso
con «Fra poco» sopra la scheda.

La fila costa 52 px in altezza, e `prova-piega` (la mappa della Home intera
sopra la barra a 390×844) e' caduta: 31 px nascosti. Lo spazio e' venuto
dalla mappa (da 180 a 160 px) e da un po' d'aria fra i pezzi della Home.
Attenzione a misurare: qui i caratteri di Google non arrivano, e coi
caratteri veri (quelli del telefono e della CI) la Home e' 9–10 px piu'
alta — vedi DA-FARE, «Cose scoperte a caro prezzo».

## Tutto a portata

```sh
node test/prova-a-portata.js   # 62 controlli, in otto gruppi (circa 4 minuti)
```

La regola «Nessuna funzione nascosta» (`CLAUDE.md`) provata come la vive chi
ha il telefono in mano. Il controllo del 13 ottobre aveva trovato funzioni a
tre o quattro tocchi, o dietro un'icona sola; la miglioria 9c le ha portate a
portata (l'elenco in DA-FARE, «Nessuna funzione nascosta»).

1. **I percorsi, a tocchi veri.** Trenta funzioni, ognuna col suo percorso
   dalla Home: «Lisbona ▾» › «🔑 Ho un codice», «✈️ Viaggio» › «📖 Il
   ricordo», l'occhiello › «🪄 Autopilota»... Playwright tocca il punto dove
   sta la voce e si rifiuta se lì sopra c'è altro, come farebbe un dito; ogni
   voce deve avere una scritta (l'iniziale del Profilo conta). Quello che
   partirebbe per la sua strada (il PDF, il calendario, la posizione,
   l'assistente) è sostituito da una spia: si guarda che il tocco arrivi. La
   barra in basso conta come un tocco su un'icona: le parole sotto le icone a
   320 px non ci stanno, e come ridurre le voci lo decide Giacomo. «📎 PDF» e
   «✓ Pagato» stanno dietro una scheda della loro pagina, e la prova lo dice:
   2 tocchi da lì, 3 dalla Home.
2. **Le misure**: 12 schermate × 3 larghezze (320, 375, 430) × 5 lingue ×
   chiaro e scuro, 360 in tutto. Niente fuori dallo schermo, niente testo
   troncato (coi puntini o tagliato) o sovrapposto, nessuna parola spezzata
   fra due lettere (sul trattino sì: «l’e-» e sotto «mail»), testi che si
   leggono, e intorno al centro di ogni tasto nove punti (a 21 px sui lati, a
   15 in diagonale, perché gli angoli tondi di un tasto alto 44 non
   rispondono) che cadono su di lui, l'icona del mezzo compresa. Si tocca con
   `elementFromPoint` invece di sommare i numeri del foglio di stile: così
   sono saltati fuori i tasti col bordo da 42 px, il nome della città che si
   prendeva il fondo di «22° · Meteo ›», i messaggi in basso che coprivano
   «＋ Aggiungi» e «↩ Annulla», e «＋ Aggiungi» che scappava dal puntatore.
3. «Lisbona ▾» apre i viaggi con le tre voci a schermo e si richiude
   ritoccandolo; il Profilo si apre con un tocco, e senza un nome il tondo
   dice «Profilo», intero.
4. «✈️ Viaggio» apre la scheda del viaggio, con le nove voci.
5. «📖 Il ricordo» si apre a viaggio in corso, e aprirlo non lo conclude.
6. In portoghese a 320 px «Cosa cerchi» passa alla forma corta, intera, e
   «Toca a reunir» resta dentro il suo tasto; «ADESSO» e «ora» del riquadro
   «Fra poco» sono nella lingua dell'app. L'orologio della pagina sta a
   mezzogiorno (`page.clock`): la tappa delle 11:30 è in corso a qualunque
   ora girino le prove.
7. `MAPPA_APP` coi percorsi nuovi, quelli vecchi spariti, e l'assistente che
   riceve la voce giusta chiedendo in cinque lingue.
8. Le 22 frasi nuove nel dizionario di en, es, fr e pt, e a schermo nessuna
   rimasta in italiano.

Sul codice di prima passano 9 controlli su 58: quelli che restano veri
comunque (niente fuori dallo schermo, nessuna parola spezzata, nessun errore
in pagina...). Le misure sono state rifatte anche coi caratteri veri di
Google, che qui non arrivano e in CI sì: a 430 px la spunta «✦ Su misura»
del «Nuovo viaggio» stava su una riga sola e scendeva a 39 px.

## Traduzioni al 100%

```sh
node test/prova-traduzioni.js       # 33 controlli, in sette gruppi (circa 3 minuti)
node test/prova-traduzioni.js 2 7   # solo il giro delle schermate e le misure
```

La miglioria 10. Le sette domande, una per gruppo:

1. **La copertura si conta da sola.** `FRASI_IN_TUTTO` non è più un numero
   scritto a mano (era 981, poi 1334): è l'unione delle frasi del dizionario.
   La prova lo legge nel codice, lo confronta con l'unione contata da lei, e
   poi aggiunge una frase in una copia dell'app (in una cartella temporanea)
   e guarda il numero salire di uno.
2. **Nessuna schermata di `MAPPA_APP` mostra testi in italiano**, in inglese,
   spagnolo, francese e portoghese. Il giro apre 96 schermate e finestre
   (una per voce della mappa, riempite come le vede chi le usa) e poi, vuote,
   tutte le finestre che nessun passo ha aperto: una finestra nuova entra
   nella prova da sola. Si confronta con l'italiano, come in `prova-lingue`,
   ma **i nomi si coprono invece di scartare la frase**: prima «Spostamento
   verso Nishiki» passava per un dato dell'utente. Per questo i nomi del
   viaggio di prova sono strani (Zelda, Yuri, Ximena, Teamlab): un nome che
   è anche una parola («Museo») coprirebbe le parole dell'app. Dalla
   miglioria 11 dentro c'è anche il Premium.
3. **I testi del passo 2**: Saldi, Condividi (con e senza account, e le frasi
   col grassetto intere), «Spostamento verso», i messaggi d'invio delle
   email, l'anello di «Fra poco» (in francese «en cours», dentro il cerchio a
   320 e a 430 px). E il codice letto con acorn: ogni chiave di `tv()` e
   `tp()` nel dizionario di tutte e quattro le lingue, con gli stessi buchi;
   ogni messaggio scritto per intero tradotto; nessun messaggio cucito col
   `+` o con un template; nessuna `t()` dove `t` è il viaggio.
4. **I plurali con 0, 1, 2 e 5**, scritti per intero in cinque lingue (lo
   zero francese al singolare, «foto» e «attività» con le due forme), e a
   schermo: «La giornata» con 0, 1, 2 e 5 tappe.
5. **Le valute**: «1.234,50 €», «€1,234.50», «1 234,50 €», lo yen senza
   decimali, «A$», e gli spazi dentro l'importo che non vanno a capo. Anche
   nella lista delle spese. Le migliaia come le separa ogni lingua (dalla
   miglioria 11): «1234,50 €» in spagnolo e portoghese, «12.345,50 €» e
   «12 345,50 €» dalla quinta cifra; l'italiano a quattro cifre cambia col
   browser (i dati delle lingue del 2025), e lì vanno bene tutti e due.
6. **La privacy nella lingua dell'app**: il tasto del Profilo e i link sotto
   «Crea account» aprono `privacy-xx.html`; ogni traduzione ha la lingua
   giusta, i link alle altre, il riquadro «vale l'italiano», le stesse
   sezioni dell'originale, i punti fermi (email, 14 anni, 112, regione,
   servizi) e niente preso da fuori; `_redirects` le tiene raggiungibili.
7. **Niente testi troncati o sovrapposti** da 320 a 430 px in cinque lingue:
   il giro intero a 320 e a 430, le schermate principali anche a 360, 375,
   390 e 414. Si guarda solo lo strato che si vede (la finestra più in alto,
   o la pagina) e solo il testo visibile: dentro i contenitori che lo
   tagliano, e scoperto (`elementFromPoint`). I puntini su un nome scritto da
   chi usa l'app sono voluti e si dicono senza bocciare. E la prova mette
   apposta un testo tagliato e uno sovrapposto e controlla di trovarli.

Il giro delle cinque lingue va in parallelo (cinque pagine insieme): così
dura un minuto e mezzo invece di sei.

Sul codice di prima (11c949b) la prova boccia tutte e sette le parti: il
conteggio scritto a mano, 156 testi in italiano per lingua, 720 traduzioni
mancanti e i messaggi cuciti, `tp()` che non esiste, le valute («€1234,50»
in spagnolo, «¥1.234.567,00»), la privacy che non c'è, «Cosa cerchi qui
intorno?» tagliato a 375 px. Restano veri solo i controlli che lo erano
comunque (niente esce di lato, niente si sovrappone, la misura che si
accorge dei difetti messi apposta).

⚠️ Qui i caratteri di Google non arrivano: le misure della parte 7 vanno
rifatte coi caratteri veri prima di fidarsi (vedi DA-FARE, «Cose scoperte a
caro prezzo»). In CI arrivano, e la prova misura con quelli.

## Accessibilità

```sh
node test/prova-accessibilita.js       # 29 controlli, in nove gruppi (circa 5 minuti)
node test/prova-accessibilita.js 2 3   # solo axe e il contrasto
```

La miglioria 11. axe-core sta fra le dipendenze delle prove e non entra
nell'app. Le nove domande:

1. **Il Premium tradotto** in cinque lingue: si portano a schermo tutte le
   sue frasi (il foglio gratis e Premium, il Profilo, i messaggi del cambio
   di piano, «eliminare è del Premium») e si legge quello che si vede. E le
   migliaia: in spagnolo e portoghese «1234 €» senza separatore, «12.345 €»
   e «12 345 €» col loro.
2. **axe-core** su tutte le schermate e le finestre di `MAPPA_APP`, nei due
   temi, sullo strato che si vede; e una volta sul documento intero, perché
   il meta viewport (lo zoom bloccato) sta nella testa della pagina. In più
   quello che axe non vede: ogni tasto ha un nome fatto di parole, ogni div o
   span con `onclick` è un tasto (o ha dentro un tasto vero che fa lo
   stesso), ci sono le zone main e nav. E il giro non deve rompersi da
   nessuna parte: un passo rotto adesso si dice (vedi `schermate.js`).
3. **Il contrasto**: `--ink-faint` e il testo sui tasti oro, nei due temi; e
   ogni testo a schermo, colori composti salendo dai genitori. Sui fondi
   sfumati o con un'immagine (il cielo della Home, i tasti oro) si fotografa
   la schermata col testo reso trasparente e si legge il colore sotto ogni
   riga; chi esce bocciato si riguarda a schermata ferma, perché nel giro un
   foglio può essere ancora a metà della salita.
4. **Il dito**: nove punti intorno al centro di ogni tasto, a 320, 390 e 430
   px, devono rispondere a lui (o a un tasto vicino che fa la stessa cosa).
   Nelle mappe contano i tasti dello zoom; i segnaposto no (ripetono tappe e
   alberghi che hanno i loro tasti negli elenchi), né la parola «Leaflet»
   nella scritta dei diritti. Leaflet arriva in locale col suo foglio di
   stile: senza, qui i controlli non stavano nei loro angoli, e la scritta
   che sul server delle prove copriva il 🧭 non si vedeva.
5. **`lang`** segue la lingua dell'app, anche cambiandola dal Profilo.
6. **Il fuoco nei fogli**, toccando come un dito: entra aprendo, torna al
   tasto di partenza chiudendo con la ✕, con Esc, toccando fuori e
   scegliendo da una tendina; tutti i fogli sono `role="dialog"` con un nome;
   Tab non esce dal foglio; Invio e spazio aprono un riquadro-tasto.
7. **I messaggi in basso**, con l'orologio della pagina: la durata, il tocco
   che chiude, `#annunci` per VoiceOver, i tasti principali scoperti (la
   Home, la giornata col + Aggiungi, un foglio alto quanto lo schermo, una
   conferma), il contrasto nei due temi.
8. **Riduci movimento** (`reducedMotion: 'reduce'` di Playwright): nessuna
   animazione o transizione più lunga di un millesimo di secondo, gli
   scorrimenti senza `smooth`, le mappe senza zoom animato.
9. **Niente testi troncati o sovrapposti** in cinque lingue, tutte le
   schermate a 320 e 430 px, le principali a 375: è la misura di
   `prova-traduzioni` (in `schermate.js`). Un tasto che galleggia sopra la
   pagina (in Time Table «↩ Annulla» e «＋ Aggiungi») copre quello che ci
   scorre sotto, come la barra in basso: non gli si sovrappone.

Mentre si misura, i messaggi in basso non arrivano (`toast` diventa muto in
quella pagina): passano, e la prova 7 guarda loro. Il nome «GeppGo»
accanto al logo resta fuori dal contrasto: è il logo, e WCAG non chiede
contrasto alle scritte di un logo.

`require('./prova-accessibilita').misura(page, {...})` misura una schermata
sola, per chi la sta sistemando.

Sul codice di prima (dab776f) la prova boccia sette gruppi su nove: il
Premium in italiano (11 frasi × 4 lingue) e le migliaia separate in spagnolo
e portoghese; 310 violazioni di axe (contrasto, `aria-label` sui div della
barra, tendine e campi senza nome); `--ink-faint` a 2,7:1, il bianco
sull'oro a 3,2:1 e 1230 testi sotto soglia; i bordi dei campi a 1,3:1;
1261 tasti piccoli; i fogli senza fuoco né nome; i messaggi di durata fissa;
le animazioni fatte da JavaScript. Restano veri solo i controlli che lo erano
già: il giro non si rompe, `lang` segue la lingua (c'era dalla miglioria 10),
niente testi tagliati.

## Installazione e link di Google Maps

```sh
node test/prova-installazione.js       # 35 controlli, in nove gruppi (circa 2 minuti)
node test/prova-installazione.js 3 6   # solo le icone e i link corti
npm run icone                          # rifà icona.svg e i PNG in icone/ dal logo
```

La miglioria 12. Google non si chiama mai: le regole della funzione
`link-mappe` (`supabase/functions/link-mappe/regole.mjs`) girano qui in Node
con un Google finto, che fa i rimandi veri (il link corto, Google Maps, la
pagina dei consensi europei), e la pagina parla con loro al posto della
funzione vera. Le nove domande:

1. **La regola del logo** in `CLAUDE.md`, scritta com'è stata chiesta, e
   niente più verde #006747.
2. **«© OpenStreetMap» su ogni mappa** (Home, viaggio, giornata, anteprima
   di un posto, mappine dei risultati), col link alla pagina dei diritti, a
   320 e 430 px: si vede tutta, e non tocca le aree da 44 px dei tasti sulla
   mappa e intorno (lo stesso dito di `prova-accessibilita`).
3. **Le icone**: quella per iPhone è un PNG 180×180 senza canale alfa;
   quelle del manifest sono PNG delle misure dichiarate; la maskable ha il
   logo tutto dentro il cerchio centrale dell'80%. E sono quelle del logo di
   adesso: la prova le ridisegna dalla testata (`fai-le-icone.js`) e le
   confronta con quelle nel repo, con un margine per i bordi sfumati. E git
   le prende: il `.gitignore` scarta i PNG delle schermate, e un'icona
   scartata sul disco c'è e sul sito no.
4. **Il manifest e i meta**: nome, start_url dentro lo scope, standalone, i
   colori della schermata d'apertura; i meta per iPhone; la barra di stato
   che segue il tema.
5. **Il tasto Condividi**: la mail di un albergo arriva al lettore delle
   prenotazioni; un posto condiviso da Google Maps (come lo manda Android:
   nome e link corto) arriva in Scopri › Cerca col posto; lo stesso col link
   nel campo «url» e col Comando di iPhone (`#testo=`); senza niente, l'app
   si apre normale.
6. **Il link corto con la pagina dei consensi**: il servizio prende
   l'indirizzo vero da «continue» (senza aprire la pagina dei consensi), e
   l'app ne ricava le coordinate giuste nei cinque punti dove si incolla un
   posto: luoghi, ricerca degli hotel, foglio dell'hotel, mail dell'hotel,
   tappe.
7. **Senza coordinate, col nome**: la ricerca di sempre trova il posto, e
   l'app dice che l'ha trovato col nome.
8. **I rifiuti, il tempo, il limite**: undici indirizzi che non sono di
   Google Maps rifiutati; un rimando che esce non viene seguito (la pagina di
   fuori non viene chiesta); Google lento: il servizio si ferma a 8 secondi;
   il limite di 30 richieste in 10 minuti. E nell'app le frasi giuste, mai
   il testo del server.
9. **Le lingue e le misure**: le frasi nuove in cinque lingue, a schermo
   nella lingua giusta, senza uscire dallo schermo da 320 a 430 px.

La ricerca finta risponde sia dal ponte degli indirizzi sia da Nominatim e
Photon diretti: quale delle due strade prende l'app dipende da com'è andata
prima (un ponte caduto si salta per un minuto), e una prova che finge una
strada sola diventa rossa per il motivo sbagliato.

Sul codice di prima (ad43299) la prova passa 13 controlli su 35: restano veri
solo quelli che lo erano già (il verde non c'era, l'SVG come icona della
scheda, git che prende le icone — allora erano SVG —, la mail condivisa,
l'avvio senza niente, il link lungo letto sul telefono, nessun errore in
pagina) e quelli sulle regole della funzione, che la controprova usa come
server. Ci mette una decina di minuti: sul codice vecchio ogni attesa arriva
fino in fondo.

## Tetti di spesa e mappa del viaggio

```sh
node test/prova-budget-mappa.js          # 66 controlli, in dieci gruppi
node test/prova-budget-mappa.js 1 6      # solo il tetto del gruppo e i due telefoni
psql -f test/supabase-prova-tetti.sql    # 17 controlli sul database (li lancia anche tutte.js)
```

La miglioria 13a. I gruppi 1, 2 e 6 girano col cloud finto di
`prova-cloud-personale` (due persone, tre telefoni), che fa anche il
guardiano dei tetti come il database vero: a chi non è admin rimette tetti e
ore della modifica com'erano, e lascia passare il resto. Le dieci domande:

1. **Il tetto del gruppo**: l'admin lo fissa dal foglio e arriva nel Budget
   del compagno; al compagno il foglio lo mostra spento, e forzando il campo
   non cambia niente; un viaggio mandato coi tetti cambiati passa col resto
   (il nome nuovo) ma col tetto di prima, e il telefono del compagno torna
   al tetto giusto (`tettiDalCloud`).
2. **Il tetto personale** va in `dati_personali` a nome di chi lo fissa, non
   sta nel viaggio, il compagno non lo vede, l'altro telefono dello stesso
   account lo riceve.
3. **I conti**: speso, resta, percentuale e quota al giorno per gruppo,
   persona e categoria, con le previste a parte e la spesa in attesa di
   cambio fuori; le stesse cifre a schermo; a viaggio finito niente quota al
   giorno; le cifre scritte a mano («1.500», «1 500», «1500,5»).
4. **Gli avvisi**: all'80% e al 100%, una volta per soglia, per gruppo,
   persona e categoria; le due soglie insieme fanno un avviso solo; un
   tetto nuovo le riarma; il tocco porta al Budget; banner senza permesso,
   notifica col permesso.
5. **La scheda in Home**: non c'è al 79%, c'è all'81% e porta al Budget,
   sparisce tornando sotto.
6. **Due telefoni e un compagno**: un tetto alzato su un telefono, quello
   del Cibo sull'altro, il nome e una spesa dal compagno, tutti senza rete;
   alla fine tutto insieme, uguale nel cloud e sui tre telefoni.
7. **La mappa**: tutte le tappe con la posizione (sciolte o nei tondi) e
   l'albergo; lo sfondo è lo strato che tiene da parte le zone già viste
   (quello di `prova-mappa`), con «© OpenStreetMap»; nel Giorno 1 i numeri 1, 2, 3 nell'ordine della giornata col
   colore del giorno e la linea; il filtro; l'albergo solo nelle notti in cui
   ci si dorme; la scheda del segnaposto, con la crocetta che si chiama
   «Chiudi» e risponde su 44 px, e «Apri la tappa» sulla tappa giusta; un
   tocco sul tondo avvicina la mappa (il tondo sta sopra la casetta
   dell'albergo, che prima lo copriva).
8. **200 tappe**: si apre in meno di 3 secondi, ci sono tutte, i segnaposto
   vicini si raccolgono, zoom e spostamenti senza blocchi da mezzo secondo.
9. **Dove si trova**, a tocchi veri: dalla mappa della Home e da quella della
   giornata (1 tocco), da ✈️ Viaggio (2), dalla riga della Time Table nei
   giorni senza mappa; i tetti da ✈️ Viaggio. «Elenco» ha tutte le tappe,
   anche quella senza posizione, giorno per giorno, e apre la tappa.
10. **Lingue e schermi**: le frasi nuove nelle quattro lingue e tutte nel
    dizionario; cinque schermate in cinque lingue a 320, 390 e 430 px, nei
    due temi: niente italiano rimasto, niente fuori schermo o tagliato (la
    fila dei giorni scorre di lato apposta), axe senza violazioni gravi.

`supabase-prova-tetti.sql` tiene vere due promesse: il tetto di una persona
è suo (un compagno non lo vede e non lo cambia, la chiave deve dire lo stesso
viaggio della riga), e i tetti del gruppo li cambiano solo gli admin, ore
della modifica comprese, senza respingere il resto dell'aggiornamento di un
compagno.

Sul codice di prima (527b5c4) la prova passa 4 controlli su 29 (molti gruppi
si fermano al primo che manca): nessun avviso sotto l'80%, i due controlli
dei due telefoni — i tetti del gruppo viaggiano sui campi del viaggio, che
si univano già campo per campo, ed è voluto — e nessun errore in pagina. Il
controllo «il telefono del compagno torna al tetto giusto» fallisce anche
sul codice nuovo senza `tettiDalCloud`: il compagno resta col tetto suo.

## PDF dell'itinerario e calendario che si aggiorna

```sh
node test/prova-pdf-calendario.js          # 64 controlli, in nove gruppi (5–7 vogliono Postgres)
node test/prova-pdf-calendario.js 2 5      # solo il PDF e la funzione del calendario
psql -f test/supabase-prova-calendario.sql # 20 controlli sul database (li lancia anche tutte.js)
```

La miglioria 13b. Il PDF si apre qui in Node, senza librerie: gli oggetti,
i flussi compressi (zlib), il testo scritto coi caratteri di base (i byte di
WinAnsi tradotti in lettere), i link (`/URI`) e le immagini. Il cloud
dell'app è il cloud finto di `prova-budget-mappa`, con in più la tabella
`calendari` e le sue regole; il database e la funzione invece sono veri: un
database tutto suo (`geppgo_prova_calendario_<pid>`, che alla fine se ne va)
con lo schema di prima e la migrazione lanciata due volte, e le regole della
funzione (`supabase/functions/calendario/regole.mjs`) che leggono da lì con
`calendario_per_codice`, come fa la funzione pubblicata. Le nove domande:

1. **Dalla 13a**: una spesa che passa tre soglie insieme fa un avviso solo,
   che parte dalla più grave e dice le altre («Anche: …»), anche in inglese;
   i colori dei giorni tutti diversi fino al 21 sulla mappa del viaggio, e
   distinguibili (CIEDE2000 almeno 15, numero bianco a 4,5:1); la crocetta
   delle schede sulla mappa della Home e su quella della giornata risponde
   su 44 px e si chiama «Close» in inglese.
2. **Il PDF**: un PDF vero, con la copertina (nome, date, destinazione,
   compagni), i giorni, le tappe con l'ora, l'albergo della notte col
   check-in, gli spostamenti col mezzo e il tempo, i link a Google Maps
   toccabili; le opzioni (costi, note, biglietti) rispettate; i codici dei
   biglietti in nessun punto del file, nemmeno nei flussi compressi; le sole
   immagini sono righe di testo (un QR sarebbe un quadrato).
3. **Accenti e giapponese**: «Caffè Crème brûlée», «Œuvre d’art – 50 €» sono
   testo vero; il nome e l'indirizzo giapponesi sono nel PDF proprio come li
   disegna il telefono (lo stesso JPEG, byte per byte), e gli ideogrammi
   disegnati uno per volta sono pieni e diversi fra loro (un carattere che
   manca diventa un quadratino, uguale per tutti); il PDF pesa decine di KB.
4. **Il foglio Condividi**: «Condividi o salva» lo apre col file dentro il
   tocco (`navigator.userActivation`), il file è «Itinerario -
   Giappone.pdf», «Itinerary - …» in inglese, «Itinéraire - …» in francese;
   un nome con «/», «:» o virgolette diventa un nome di file valido; senza
   foglio Condividi si scarica col nome giusto.
5. **Il calendario**: dalla Home in due tocchi; «Crea il link» (il codice
   lo sceglie il database), «Aggiungi al calendario» è il webcal:// della
   funzione, «Copia il link» copia l'https, «Crea un link nuovo» spegne il
   vecchio, «Disattiva il link» dopo la conferma; il fuso della destinazione
   chiesto una volta e messo nel viaggio; la lingua del calendario che segue
   l'app; senza la tabella nel cloud il foglio lo dice piano e offre l'.ics.
   Poi la funzione col database: 200 e `text/calendar`, il file scritto come
   vuole iCalendar (CRLF, righe di 75 byte, eventi chiusi, UID e DTSTAMP,
   nessun UID doppio), gli eventi giusti, le 09:30 di Tokyo alle 00:30 UTC
   con «Local time» nella descrizione, posto, coordinate, link e
   promemoria, il volo senza ora e il check-in tutto il giorno, niente note e
   niente codici; senza fuso l'ora fluttuante, e il cambio dell'ora legale
   contato giusto; codice sbagliato, storto, spento, di chi è uscito: 404; il
   database giù: 503.
6. **Le modifiche**: la tappa spostata è lo stesso evento alla nuova ora,
   quella tolta sparisce, quella nuova compare una volta, il check-in
   diventato una tappa non resta anche come evento dell'albergo.
7. **Il database**: `supabase-prova-calendario.sql` sopra la migrazione
   lanciata due volte (nessuno legge, crea o cambia i codici di un altro, e
   da fuori la funzione non si chiama), e la migrazione è lo stesso testo
   che sta in fondo allo schema.
8. **Senza account** la voce resta «🗓️ Esporta nel calendario» e scarica
   subito il file .ics di sempre.
9. **Lingue e schermi**: le frasi nuove nelle quattro lingue; nove
   schermate (la scheda del viaggio, i fogli del PDF e del calendario nei
   loro stati) in cinque lingue a 320, 390 e 430 px, nei due temi: niente
   italiano rimasto, niente fuori schermo o tagliato, i tasti nuovi da 44
   px, axe senza violazioni gravi.

`supabase-prova-calendario.sql` tiene vere le promesse del database: il
codice lo sceglie il database, ognuno vede e crea solo i suoi link e solo
per un viaggio di cui fa parte, uno per persona e per viaggio, della riga si
cambia solo la lingua; `calendario_per_codice` risponde solo a un codice
giusto, acceso, di chi è ancora nel viaggio (anche se la riga fosse rimasta),
e con la chiave pubblica non si chiama.

Sul codice di prima (475e8f7) la prova passa 1 controllo su 17 (molti gruppi
si fermano al primo che manca): resta vero solo «nessun errore nelle
pagine». Gli altri cadono per il motivo giusto: tre avvisi per una spesa
sola invece di uno, otto colori (il giorno 9 uguale al giorno 1, CIEDE2000
0), la crocetta «Close popup» che non risponde su 44 px e, nella mappa della
giornata, «ore 09:30» anche in inglese; nessun PDF, nessun foglio del
calendario, nessuna funzione e nessuna migrazione; e nella scheda del
viaggio la voce del calendario che non passa da `apriCalendario`.
