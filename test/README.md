# Prove sui permessi del cloud

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
