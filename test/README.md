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
