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

- **Node** e **Chromium**. Il browser si prende da `CHROMIUM_PATH` se c'è,
  altrimenti da dove l'ha messo Playwright.
- **Postgres**, solo per le prove sul database: si dice dove sta con le
  variabili di sempre (`PGHOST`, `PGPORT`, `PGUSER`). Se non risponde, quelle
  prove vengono **saltate e dichiarate tali** invece di far finta che sia
  andato tutto bene.

Le prove sul database ripartono sempre da un database vuoto: una prova che
eredita lo stato di quella prima non dice niente di affidabile.

## Due trappole, imparate a caro prezzo

**Il percorso del progetto non si scrive a mano.** Sei prove avevano dentro
`file:///home/user/GeppGo/Index%202.1.html`: passavano su quella macchina e
fallivano dovunque altro. Si usa `APP` di `browser.js`, e il lanciatore boccia
chi se lo riscrive.

**Nello stato di prova ci va `skipAuth: true`,** se la prova non riguarda
l'account. Senza, l'app apre a tutto schermo il pannello "accedi o crea
account", che si mangia i tocchi: un `page.click` va in scadenza dopo trenta
secondi con un messaggio che non nomina il pannello. Il bello è che *dipende
dalla rete* — dove la CDN di Supabase non si raggiunge il pannello non si apre
e la prova passa, dove si raggiunge no. Una prova che dipende da cosa riesce a
scaricare non è una prova.


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
psql -f test/supabase-prova-foto.sql   # 29 controlli sui permessi delle foto
node test/prova-foto.js                # 28 controlli sul comportamento dell'app
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
