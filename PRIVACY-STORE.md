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
| User Content → **Photos or Videos** | Le foto del diario | App Functionality |
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
vengono memorizzati oltre il tempo della richiesta. GeppGo ricade in quel
caso.

**Consiglio: dichiararla lo stesso** come *Precise Location → App
Functionality, linked to the user, not used for tracking*. Dichiarare in più
non costa niente; dichiarare in meno è il motivo per cui le app vengono
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
