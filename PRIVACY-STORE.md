# Cosa rispondere sugli store, sulla privacy

Apple e Google, prima di pubblicare, fanno compilare una scheda su quali dati
l'app raccoglie. Non è un modulo da riempire a memoria: se quello che scrivi
non combacia con quello che l'app fa davvero, l'app viene rifiutata — e se
passa, è peggio.

Questo file è la traduzione, voce per voce, di quello che GeppGo fa davvero.
Ricavato leggendo il codice, non a ricordo.

---

## Prima di tutto: le due cose obbligatorie

- **Indirizzo della privacy policy:** `https://<il-dominio-di-geppgo>/privacy`
  (la pagina è `privacy.html`, e `_redirects` la tiene raggiungibile anche
  sotto `/privacy`).
- **Cancellazione dell'account dentro l'app:** c'è. Profilo → *Elimina il mio
  account*. Apple chiede di indicare dove si trova: è quello il percorso.

---

## App Store — "App Privacy"

### Dati raccolti e collegati all'identità

| Categoria Apple | Cosa | A cosa serve |
|---|---|---|
| Contact Info → **Email Address** | L'email dell'account | App Functionality |
| Identifiers → **User ID** | L'id dell'utente su Supabase | App Functionality |
| User Content → **Photos or Videos** | Le foto del diario, e di ognuna una copia piccola | App Functionality |
| User Content → **Other User Content** | Viaggi, tappe, spese, note, biglietti | App Functionality |
| User Content → **Customer Support** | Le segnalazioni sulle foto | App Functionality |

Per ognuna: **Used for App Functionality**, non per pubblicità, non per
analytics, non per personalizzazione. **Linked to the user**: sì (stanno sotto
il suo account). **Used for tracking**: **NO**.

### Location — la voce da guardare due volte

La posizione **viene usata ma non conservata da noi**: si prende quando serve
(cercare un bagno, un bancomat, il meteo, avvisare che sei vicino a una
tappa), si manda ai servizi che rispondono, e finisce lì. Sui server di GeppGo
non arriva e non resta niente: nessuno storico di dove sei stato.

Una cosa resta **sul telefono e basta**: la cache delle ricerche vicine. Per
non chiedere due volte alla stessa mappa cosa c'è intorno, l'app tiene per un
giorno le ultime sessanta risposte con il punto da cui sono state chieste.
Non esce dal dispositivo, si cancella da sola, e sparisce cancellando i dati
dell'app. Nella lingua degli store questo **non è raccolta**: sia Apple sia
Google contano come raccolti i dati che *escono* dal telefono. Va detto lo
stesso nella privacy policy — ed è detto — perché la promessa "non viene mai
conservata", scritta senza distinguere, sarebbe falsa.

Apple prevede inoltre un'eccezione per i dati che escono dal telefono ma non
vengono memorizzati oltre il tempo della richiesta. GeppGo ricadeva
interamente in quel caso fino ad «A raccolta».

**«A raccolta» è l'unica posizione che GeppGo conserva**, e va dichiarata come
tale: quando chi organizza il viaggio chiama gli altri, il punto in cui si
trova *in quell'istante* finisce in una riga del database, visibile solo ai
compagni di quel viaggio e **solo per due ore** — la scadenza è nella regola
di lettura del database, non nel codice dell'app. È la posizione di chi
chiama, mai di chi riceve; non si aggiorna mai (non esiste una policy di
update, quindi nessuna riga può diventare un puntino che si muove); la può
scrivere solo un admin; si può ritirare subito; e se ne va cancellando
l'account.

Non è tracking nel senso degli store — non segue nessuno, non profila, non
esce dal gruppo di viaggio — ma **è memorizzazione**, quindi l'eccezione
"solo per il tempo della richiesta" qui non vale.

**Da dichiarare** come *Precise Location → App Functionality, linked to the
user, not used for tracking*. Con «A raccolta» non è più un "in più
prudenziale": è dovuto. Dichiarare in meno è il motivo per cui le app vengono
rifiutate.

### Tracking: NO

GeppGo non traccia da un'app all'altra e non usa identificatori pubblicitari.
Quindi **non serve il prompt ATT** (App Tracking Transparency). Se un giorno
entrerà pubblicità vera negli spazi che oggi sono vuoti, **questa risposta
cambia** e va rifatta la scheda.

### Cosa NON dichiarare

Nessun dato finanziario (le spese del viaggio sono contenuto scritto
dall'utente, non transazioni), nessun dato sanitario, nessuna rubrica, nessun
dato di navigazione, nessuna diagnostica.

---

## Google Play — "Sicurezza dei dati"

Stessa sostanza, nomi diversi:

- **Informazioni personali → Indirizzo email**: raccolto, condiviso no,
  obbligatorio no (l'app funziona anche senza account), cifrato in transito
  sì, cancellabile dall'utente sì.
- **Foto e video → Foto**: raccolte, cancellabili.
- **File e documenti**: le foto dei biglietti che l'assistente legge.
- **Posizione → Posizione precisa**: raccolta ma non conservata sui server
  (vedi sopra; quello che resta nel telefono non conta come raccolta).
- **Attività nell'app → Altre azioni**: il contenuto dei viaggi.

Alla domanda *"i dati sono condivisi con terze parti?"*: sì, con i fornitori
elencati nella privacy policy (Supabase, il servizio di IA, i servizi di
mappe e meteo). Sono responsabili del trattamento che lavorano per conto di
GeppGo, non compratori di dati.

Alla domanda *"l'utente può chiedere la cancellazione?"*: sì, dall'app.

---

## Tre cose che restano da fare, e non sono codice

### 1. Dire dove stanno i server (5 minuti)

Nella privacy policy c'è un punto che rimanda alla regione del progetto
Supabase senza nominarla, perché va guardata: pannello Supabase → *Project
Settings → General → Region*.

- Se è in Europa (per esempio `eu-central-1`, Francoforte): si può scrivere
  che i dati restano nello Spazio economico europeo, e il paragrafo sulle
  clausole contrattuali standard si può togliere.
- Se è negli Stati Uniti: va detto chiaramente che i dati escono dall'Europa,
  e su quale base. Il paragrafo che c'è adesso copre il caso, ma è meglio
  nominare il Paese.

### 2. Far leggere il testo a un avvocato

La privacy policy che c'è è **accurata** — descrive quello che l'app fa
davvero, verificato sul codice — ma non è stata scritta da un legale. Prima di
pubblicare sugli store vale la spesa di una revisione, insieme alle condizioni
d'uso e alla procedura da seguire quando arriva una segnalazione (vedi
`DA-FARE.md`).

Da chiedere in particolare:
- l'età minima (qui è indicata in 14 anni, in linea con l'art. 8 GDPR come
  recepito in Italia, ma va confermato);
- se serve un registro dei trattamenti (art. 30) alla scala attuale;
- come è messa la responsabilità sui dati dei compagni di viaggio, che sono
  persone che non hanno accettato niente.

#### Il punto nuovo, e quello su cui serve davvero un parere: «A raccolta»

**Da settembre 2026 c'è un caso, e uno solo, in cui GeppGo conserva una
posizione.** Fino a ieri si poteva dire senza distinguo che la posizione
*viene usata ma non conservata*; adesso non è più vero, ed è la cosa da far
guardare per prima.

Come funziona, in breve — chi organizza un viaggio di gruppo preme un tasto
(«A raccolta») e ai compagni arriva un avviso con il punto in cui si trova,
per ritrovarsi quando ci si è persi in una città.

Quello che finisce nel database, e nient'altro:

| Campo | Cosa contiene |
|---|---|
| `trip_id` | quale viaggio |
| `chiamata_da` | l'id dell'utente che ha chiamato |
| `nome` | il suo nome dentro il viaggio (spesso di fantasia) |
| `lat`, `lng` | il punto in cui si trovava **in quell'istante** |
| `nota` | due parole facoltative («Si parte») |
| `creata_il`, `scade_il` | quando, e fino a quando vale |

Le garanzie, e sono **strutturali** — regole del database, non promesse
dell'app, il che significa che valgono anche se l'app ha un difetto:

1. **È la posizione di chi chiama, mai di chi riceve.** Nessuno viene
   localizzato: una persona dichiara dove si trova, gli altri decidono se
   andarci.
2. **Non si aggiorna mai.** Sulla tabella non esiste alcun permesso di
   `UPDATE`: nessuna riga può diventare un puntino che segue qualcuno. Se il
   punto cambia se ne scrive una nuova.
3. **La può scrivere solo un admin del viaggio, e solo a nome proprio.**
4. **Scade dopo due ore**, e la scadenza è un vincolo `CHECK` sulla tabella
   (`scade_il <= creata_il + 2 ore`) più la regola di lettura: passate quelle,
   il database non la mostra più a nessuno, **nemmeno a chi l'ha scritta**.
5. **Si può ritirare subito**, e sparisce cancellando l'account.
6. La vedono **solo le persone di quel viaggio**.

Le domande da porre al legale, in ordine di importanza:

- **La base giuridica.** È consenso (l'utente preme il tasto sapendo cosa fa,
  e il telefono chiede comunque il permesso di geolocalizzazione) o legittimo
  interesse? E il consenso di chi *riceve* serve, visto che riceve un dato
  altrui e non uno proprio?
- **La conservazione di due ore basta a dirsi proporzionata**, o va motivata
  per iscritto nella policy?
- **È un dato particolare?** Una posizione in un certo momento può rivelare,
  per inferenza, un luogo di culto o una struttura sanitaria. Serve qualcosa
  in più dell'art. 6, o la natura occasionale e la scadenza breve bastano?
- **Serve una valutazione d'impatto (DPIA, art. 35)?** L'orientamento è di no
  — non c'è monitoraggio sistematico, è un gesto puntuale e volontario, e
  scade — ma è esattamente il tipo di conclusione che va confermata da chi ne
  risponde.
- **Minori.** Un viaggio di gruppo può includere quattordicenni: cambia
  qualcosa il fatto che a condividere la posizione sia l'organizzatore adulto
  e non loro?

Il testo già scritto sta in `privacy.html`, sezione **«A raccolta»**: sono
sette righe più un elenco puntato, ed è quello il pezzo da far correggere.
Il codice che lo implementa sta in `supabase-schema.sql` (sezione
`A RACCOLTA`) e in `Index 2.1.html` (blocco `===== A RACCOLTA =====`); le
garanzie qui sopra sono verificate da 17 prove sui permessi del database e 43
sul comportamento dell'app.

### 3. Rifare la scheda quando cambia qualcosa

Ogni volta che l'app inizia a raccogliere un dato nuovo o a parlare con un
servizio nuovo, la scheda va aggiornata **prima** della pubblicazione. Il
punto in cui succederà quasi certamente: il giorno che entra la pubblicità
vera.

---

## L'inventario da cui viene tutto questo

Ricavato cercando nel codice ogni indirizzo esterno, il 1 settembre 2026.

| A chi parla | Cosa gli manda |
|---|---|
| `cyolhqndurgwbivxcssf.supabase.co` | Email, viaggi, foto, segnalazioni |
| `geppgo-ai.merati-giacomo94.workers.dev` (e da lì il modello) | Testo scritto all'assistente, immagini dei biglietti |
| `nominatim.openstreetmap.org` | Indirizzi cercati, coordinate |
| `overpass-api.de`, `overpass.kumi.systems`, `overpass.private.coffee` | Coordinate |
| `photon.komoot.io` | Testo cercato, coordinate |
| `router.project-osrm.org` | Coordinate |
| `api.open-meteo.com` | Coordinate |
| `it.wikipedia.org`, `commons.wikimedia.org`, `www.wikidata.org` | Nomi di luoghi |
| `api.mymemory.translated.net` | Il testo da tradurre |
| `open.er-api.com` | Niente di personale (solo le valute) |
| `cdn.jsdelivr.net`, `unpkg.com` | Indirizzo IP (scarico librerie) |
| `fonts.googleapis.com` | Indirizzo IP (caratteri) |

Google Maps, Google Calendar e i siti esterni si aprono **solo** quando è
l'utente a toccare un tasto: non sono richieste che l'app fa da sola.

> **Una nota su Google Fonts.** I caratteri arrivano dai server di Google, che
> quindi vedono l'indirizzo IP di chiunque apra l'app. È dichiarato nella
> privacy policy. Se un giorno si vuole togliere anche quello, basta
> impacchettare i due caratteri insieme all'app: è mezz'ora di lavoro e
> toglie un fornitore dalla lista.
