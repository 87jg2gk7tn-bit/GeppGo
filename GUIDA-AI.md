# GUIDA — L'assistente dentro GeppGo

Questo file spiega come l'assistente è collegato a GeppGo, come si pubblica il
suo ponte **dal telefono**, come rimetterlo in piedi se si rompe, e cosa
cambierà il giorno in cui l'app crescerà.

È scritto per essere letto anche fra sei mesi, da chi non programma.

---

## 1. Come funziona, in poche righe

```
GeppGo (Index 2.1.html)  →  ponte su Cloudflare  →  Workers AI (modello Gemma 4)
                            (worker/ponte-ai.js)  ↘  Tavily (ricerca sul web, solo quando serve)

Orari di apertura e controllo dei posti:  GeppGo  →  OpenStreetMap  (senza assistente)
```

L'app **non parla direttamente con nessun servizio di intelligenza
artificiale**. Manda le sue richieste a un programmino ospitato su Cloudflare
(il *Worker*, cioè il ponte), che le gira al modello e riporta indietro la
risposta nel formato che l'app si aspetta.

**I servizi, e perché proprio questi** (scelti a ottobre 2026):

- **Il modello è Gemma 4 26B su Cloudflare Workers AI.** È gratis entro una
  quota al giorno (10.000 «Neuron», che bastano per qualche centinaio di
  domande), non chiede la carta e quando la quota finisce **si ferma invece
  di costare**. Le condizioni di Workers AI dicono che Cloudflare non usa
  quello che gli si manda per addestrare modelli né per migliorare i suoi
  servizi. Gira nello stesso account Cloudflare del ponte: niente chiave in
  più da custodire. Legge anche le foto.
- **La ricerca sul web è Tavily**, solo per «serve prenotare?» e per le
  domande in chat che chiedono fatti aggiornati (orari, eventi, chiusure).
  Il piano gratuito dà 1.000 crediti al mese, senza carta. ⚠️ Le sue
  condizioni gli permettono di conservare le ricerche e di usarle per
  migliorare i suoi modelli: per questo **a Tavily vanno solo nomi di posti,
  la destinazione e le date**, mai persone o recapiti, e la privacy lo dice.
- **Orari di apertura e controllo dei posti** di una lista incollata non
  passano più dall'assistente: li dà OpenStreetMap, gratis e senza quota.

Prima l'assistente era un altro servizio, che sul piano gratuito non era
permesso a chi offre un'app a persone in Europa: si sarebbe dovuto pagare.

**Cosa si è perso cambiando**, da sapere per non stupirsi:

1. Gemma 4 è un modello più piccolo: «Su misura» e «sistema la giornata»
   sono un po' meno precisi, e il JSON sbaglia più spesso (lo regge la
   rilettura che l'app fa già, `aiLeggiJSON`).
2. Le ricerche sul web sono circa 33 al giorno in media (1.000 al mese): la
   chat spesso risponde «a memoria» su mezzi e orari, e quando non ha potuto
   cercare **lo dice** in una riga piccola sotto la risposta.
3. Gli orari di apertura ci sono solo dove li ha OpenStreetMap: bene per
   musei e monumenti in Europa, meno per negozi e ristoranti fuori.
4. Nomi e indirizzi dei posti controllati sono quelli di OpenStreetMap.
5. La quota del giorno è **una sola per tutti**: finita quella, l'assistente
   si ferma fino a mezzanotte UTC (**le 2 di notte in Italia con l'ora
   legale, l'1 con l'ora solare**), e l'app dice a che ora torna.

**Perché in mezzo c'è un ponte e non una linea diretta?** Perché la chiave
di Tavily è segreta, e `Index 2.1.html` è un file che chiunque può aprire e
leggere. Dentro il Worker invece nessuno la vede. E il ponte traduce: l'app
parla sempre lo stesso linguaggio (quello di Anthropic/Claude, storico), e
chi c'è dall'altra parte lo decide il Worker. Per cambiare modello o servizio
si tocca il ponte, non l'app.

---

## 2. Pubblicare il ponte dal telefono, passo passo

Tutto si fa da Safari sull'iPhone. Ci vogliono una ventina di minuti.
L'ordine non conta: l'app funziona sia col ponte vecchio sia con quello
nuovo. Ma la privacy descrive già i servizi nuovi, quindi **va fatto
subito**.

### 2a. La chiave di Tavily (5 minuti)

1. Apri **`app.tavily.com`** e tocca **Sign up**. Ci si registra con l'email
   (o con un account Google/GitHub). Il piano gratuito («Researcher») parte
   da solo: 1.000 crediti al mese, **non chiede la carta**. Se una pagina
   chiede la carta, non metterla: vuol dire che sei finito su un piano a
   pagamento, torna indietro.
2. Dopo l'accesso sei nella pagina principale del pannello: c'è il riquadro
   **API Keys** con già una chiave pronta, che comincia con **`tvly-`**.
   Tocca l'icona per copiarla (due quadratini). Se preferisci una chiave
   apposta, tocca **+** e chiamala `geppgo`.
3. Tienila negli appunti e passa subito al 2b. **Non incollarla da
   nessun'altra parte**: né in una chat, né in una nota, né in un file del
   progetto.

### 2b. La chiave nel Worker, come secret

1. Apri **`dash.cloudflare.com`** e accedi. **Attenzione all'account:** ce ne
   sono due sotto la stessa mail; il Worker vive in quello chiamato
   *Merati.giacomo94@gmail.com's Account* (ID che comincia per `f1552d99`).
   Se non vedi `geppgo-ai`, sei nell'altro: torna su `dash.cloudflare.com`
   senza niente dopo e scegli quello giusto.
2. Menu (le tre righe in alto a sinistra) → **Compute (Workers)** →
   **Workers & Pages** → tocca **`geppgo-ai`**.
3. **Settings** → **Variables and Secrets** → **+ Add**.
4. **Type: Secret** (non *Text*: con *Text* la chiave resta leggibile nel
   pannello).
5. **Variable name: `TAVILY_KEY`**.
6. **Value:** incolla la chiave `tvly-…` copiata al punto 2a.
7. **Deploy**.

Il ponte che c'è adesso la ignora: comincia a usarla col codice nuovo.

### 2c. Il codice nuovo

1. Su GitHub (in Safari, `github.com/87jg2gk7tn-bit/GeppGo`) apri il file
   **`worker/ponte-ai.js`**. In cima al file c'è il tasto **Copy raw file**
   (l'icona dei due quadratini): toccalo, e il codice intero è negli
   appunti.
2. Torna su Cloudflare, nella pagina di `geppgo-ai`, e tocca **Edit code**
   (in alto a destra, l'icona `</>`).
3. Nell'editor: tieni premuto dentro il codice → **Seleziona tutto** →
   cancella → tieni premuto → **Incolla**. Controlla che la prima riga sia
   `/* PONTE GEPPGO → ASSISTENTE` e che l'ultima finisca con
   `come l'app. */`: se no, l'incolla si è fermato a metà.
4. Tocca **Deploy** (in alto a destra) e conferma. Torna indietro alla
   pagina di `geppgo-ai` con la freccia in alto a sinistra.

### 2d. Il collegamento al modello

1. Sempre su `geppgo-ai`, apri la scheda **Bindings** (in alcune versioni
   del pannello sta dentro **Settings**).
2. **+ Add binding** (o **Add**) → scegli **Workers AI**.
3. **Variable name: `AI`** — proprio così, due lettere maiuscole. È il nome
   con cui il codice lo cerca.
4. **Add binding**, e se lo chiede **Deploy**.

Il modello non ha bisogno di chiavi: il collegamento basta, perché Workers
AI sta nello stesso account.

### 2e. Togliere la chiave vecchia

Sempre in **Variables and Secrets** c'è ancora il secret con la chiave del
servizio di prima (l'unico oltre a `TAVILY_KEY`): toccalo → icona del
cestino → **Deploy**. Poi su `aistudio.google.com/apikey` cancella quella
chiave: non serve più, e una chiave che non si usa è solo un rischio.

### 2f. Controllare che vada

Apri in Safari questi tre indirizzi:

| Indirizzo | Cosa deve dire |
|---|---|
| `https://geppgo-ai.merati-giacomo94.workers.dev/prova` | `ASSISTENTE: FUNZIONA ✅` con una frase su Lisbona, e `RICERCA WEB: chiave presente ✅` |
| `…/prova?foto=1` | in più `FOTO: FUNZIONA ✅` e una parola: il colore della foto di prova (rosso) |
| `…/prova?ricerca=1` | `RICERCA WEB: FUNZIONA ✅ (n risultati)` — usa un credito di Tavily |

`/prova` dice anche quanti token ha usato la domanda e se il modello
«ragiona prima di rispondere» (vedi §4, «Il ragionamento»). Poi apri GeppGo e fai una domanda
in chat: deve rispondere come prima.

### 2g. Le variabili facoltative

Non servono per partire. Si aggiungono in **Settings → Variables and
Secrets → + Add**, con **Type: Text**, e dopo ognuna **Deploy**.

| Nome | Quando | Valore |
|---|---|---|
| `MODELLO` | Se Cloudflare ritira Gemma 4 o se ne vuole provare un altro | Il nome completo, per esempio `@cf/google/gemma-3-12b-it` o `@cf/mistralai/mistral-small-3.1-24b-instruct`. Va scelto nel catalogo (**AI → Workers AI → Models**) fra quelli che leggono le immagini. ⚠️ Non i Llama che leggono le immagini: la loro licenza esclude chi vive nell'Unione europea |
| `ORIGINI` | Il giorno che l'app ha un dominio suo | Gli indirizzi separati da virgole, per esempio `https://geppgo.app,https://www.geppgo.app` |
| `OPZIONI_MODELLO` | Solo se `/prova` dice che il modello ragiona e le risposte arrivano tagliate o vuote | `{"chat_template_kwargs":{"enable_thinking":false}}`. Poi riaprire `/prova`: se dice `NON FUNZIONA`, cancellare la variabile |

---

## 3. Dove l'app usa l'assistente

Dodici punti, tutti dentro `Index 2.1.html`, e **tutti passano da una
funzione sola, `chiediAI`** (blocco `L'ASSISTENTE: UNA PORTA SOLA`). Nessuno
fa una `fetch` per conto suo: c'è una `fetch` verso il ponte in tutto il file,
dentro `aiRichiesta`, e `test/prova-ai.js` controlla che resti così.

| Funzione | Chiave | Cosa fa | Cosa manda |
|---|---|---|---|
| `assistenteChiedi` | `chat` | L'assistente, uno solo per la scheda e per la time-table; può cercare sul web | Gli ultimi 14 messaggi, la mappa dell'app (compatta, vedi sotto), il programma del viaggio (tappe, orari, meteo, posizioni arrotondate a ~110 m), e l'elenco di cosa si può cercare (`aiRicercaPer`) |
| `identifyPlace` | `identifica` | "Che posto è questa foto" | La foto ritagliata, ridisegnata (niente dati nascosti), e la destinazione |
| `extractPlaces` | `reel` | Estrae i posti da un reel o uno screenshot | La didascalia e lo screenshot ridisegnato a 1280 px, senza GPS |
| `importTrip` | `itinerario-scritto` | Trasforma un itinerario scritto in un viaggio | Il testo, tolti email, telefoni, carte e IBAN (i nomi restano: diventano i compagni) |
| `doCheckBooking` | `prenotare` | Cerca sul web se serve prenotare | Nome della tappa e destinazione; alla ricerca solo il nome della tappa (se è un posto), la destinazione e il giorno |
| `refreshSuggestions` | `consigli` | Consiglia attrazioni nei dintorni, in sottofondo | Destinazione, gusti, nomi dei posti già scelti |
| `chiediMosse` | `mosse` | Propone modifiche al programma già fatto | La richiesta e il programma del viaggio |
| `creaItinerarioIA` | `itinerario` | Costruisce l'itinerario di tutto il viaggio da zero | Destinazione, giorni, meteo, gusti |
| `pianificaDaTesto` | `incollato` | Legge un itinerario scritto da un'altra IA — incollato o allegato in PDF — e lo mette in un giorno | Il testo, tolti email, telefoni, carte, IBAN (e dai PDF i nomi di chi ha prenotato); da un PDF scansionato le prime tre pagine come immagini |
| `categorizzaBagagli` | `bagagli` | Mette in categoria le voci di una lista bagagli incollata | Le voci |
| `bagagliDaTesto` | `bagagli` | Tira fuori le voci da mettere in valigia da un PDF | Il testo, ripulito come sopra; da una scansione le prime pagine come immagini |
| `alloggioDaIA` | `alloggio` | Legge la mail di conferma di un albergo | La mail (al massimo 12.000 caratteri), tolti email, carte, IBAN e nome dell'ospite; i telefoni restano, serve quello dell'albergo. Da un voucher scansionato, le prime pagine come immagini |

Tutte usano lo stesso indirizzo, quindi **si accendono e si spengono insieme**.

**Senza assistente, con OpenStreetMap:**

| Funzione | Cosa fa | Cosa manda |
|---|---|---|
| `verificaOrari` → `orariOsm`, `orariDelGiorno` | Gli orari di apertura delle tappe, prima di «Ordina il giro» | Nome della tappa e città, a Nominatim (`extratags=1`, il campo `opening_hours`) |
| `verificaPosti` | Il nome e la posizione dei posti di una lista incollata | Nome del posto e città, con `geoSearch` |

Passano da `fetchGeo`, quindi dal ponte della mappa su Supabase quando c'è,
e rispettano la fila di una richiesta al secondo di Nominatim. Dove
OpenStreetMap non sa gli orari, la tappa resta senza: un orario inventato è
peggio di uno mancante.

**Cosa fa `chiediAI`, per tutte:**

- **senza rete non parte**: lo dice subito, senza richiesta;
- **tempo massimo**: 30 secondi, 60 con una foto o un PDF
  (`AI_TEMPO_TESTO_MS`, `AI_TEMPO_FILE_MS`);
- **un secondo tentativo, uno solo**, se la rete cade o il ponte risponde con
  un errore 5xx; mai se l'assistente è troppo richiesto o la quota è finita:
  insistere allungherebbe solo la coda;
- **la quota finita si dice con l'ora**: il ponte risponde 429 con
  `quota_finita` e `riprova_alle`, e l'app scrive «L'assistente ha raggiunto
  il limite di oggi: torna disponibile alle …» nell'ora del telefono (o
  «domani alle …»). Col ponte vecchio, che l'ora non la manda, resta «è molto
  richiesto: riprova fra qualche minuto»;
- **una richiesta troppo grande** (413) ha la sua frase: meno testo o meno
  pagine;
- **una richiesta per chiave alla volta**: il tasto che l'ha chiamata resta
  spento finché non finisce, e un secondo tocco non fa partire niente;
- **l'attesa si vede**: la pillola in alto (`#aiAttesa`) compare subito
  quando chi chiama non ha un segno d'attesa suo (`attesa:'globale'`), e in
  ogni caso dopo dieci secondi, con «Annulla», che ferma la richiesta davvero
  (`AbortController`). Le richieste di sottofondo (`attesa:'nessuna'`) non si
  vedono;
- **il JSON si legge anche sporco** (`aiLeggiJSON`): fra ```, con una frase
  prima o dopo, con le graffe dentro le frasi. Se proprio non si legge, lo si
  richiede una volta mostrando al modello quello che ha scritto;
- **la lingua**: a ogni richiesta si aggiunge una riga che chiede la risposta
  nella lingua dell'app (`aiRigaLingua`), con i nomi dei posti lasciati come
  sono e le parole del JSON identiche. Le richieste restano scritte in
  italiano: è la risposta che cambia lingua;
- **meno dati**: `aiSenzaDatiPersonali` toglie dal testo quello che non serve
  (email, IBAN, numeri di carta riconosciuti dalla cifra di controllo,
  telefoni col prefisso internazionale, le righe «Ospite: …»), e
  `aiImmagineLeggera` ridisegna le foto su una tela, che lascia indietro il
  punto GPS e i dati del telefono;
- **la ricerca sul web**: con `cercaSulWeb` la richiesta porta anche il campo
  facoltativo `ricerca` (cosa si può cercare); la risposta porta `ricerca`
  (`fatta`, `non_configurata`, `crediti_finiti`, `non_riuscita`), e quando la
  ricerca non c'è stata l'app lo dice in una riga (`aiNotaRicerca`);
- **i messaggi a schermo sono frasi da persona**, tradotte; il dettaglio
  tecnico (lo status, il testo del ponte) va in `console.log`.

Il modello non lo sceglie l'app: nella richiesta non c'è nessun `model`, lo
decide il ponte.

**I PDF.** Il testo si tira fuori qui nel telefono con `pdf.js` (scaricato
da jsDelivr la prima volta che si allega un PDF), e si manda al modello come
se fosse stato incollato a mano, ripulito come sopra: il file non esce mai
dal telefono. **Se è una scansione** (pagine fotografate, niente testo
dentro), le prime tre pagine si disegnano e partono come immagini JPEG da
1100 px (`leggiPDF`, `aiBlocchiImmagini`): stanno sotto i limiti del ponte.
Da un'immagine nomi e numeri non si possono togliere, e la privacy lo dice.

**La mappa dell'app, `MAPPA_APP`.** È la descrizione di com'è fatta GeppGo
che l'assistente usa per le domande sull'app (*"dove trovo i bagagli?"*).
Intera sono 28 KB: mandarla a ogni messaggio vuol dire consumare la quota
del giorno anche per chiedere dove mangiare. Adesso parte **l'indice** (la
prima frase di ogni voce, 4 KB) e, solo quando la domanda è sull'uso
dell'app, **le voci complete che c'entrano**, scelte con le parole chiave in
cinque lingue di `MAPPA_CHIAVI` (`mappaPerDomanda`). Tutta la mappa parte
solo se la domanda è chiaramente sull'app ma non si capisce su quale parte.
Se si sposta o si rinomina qualcosa nell'interfaccia, va aggiornata la
mappa; se si aggiunge una voce nuova, anche le sue parole chiave.

**Le mosse e l'itinerario non scrivono mai nei dati da soli.** `chiediMosse`
restituisce un elenco di mosse che vengono mostrate una per una, spuntabili,
con il motivo di ognuna; `creaItinerarioIA` mostra prima l'anteprima giorno
per giorno. In tutti e due i casi resta la barra **↩ Annulla** per quindici
secondi dopo aver applicato. È una scelta: un'app che riordina il viaggio da
sola mentre non guardi perde la fiducia di chi la usa.

---

## 4. Il ponte, nel dettaglio

Il codice è **`worker/ponte-ai.js`**, nel progetto. Quello che sta su
Cloudflare è una copia: si cambia prima il file, si prova, poi si incolla.

**Chi può usarlo.** Risponde solo alle pagine di
`https://87jg2gk7tn-bit.github.io` (e di `localhost`, per le prove), più
quelle scritte nella variabile `ORIGINI`. Le altre ricevono 403
(`origine_non_ammessa`). Non è una serratura — un programma scritto apposta
può fingere l'origine — ma tiene fuori le pagine degli altri.

**I limiti.** Sul piano gratuito un Worker ha 10 millesimi di secondo di
calcolo per richiesta, e leggere un corpo enorme se li mangerebbe. Oltre
questi numeri risponde 413 (`troppo_grande`) senza toccare il modello:

| Cosa | Al massimo |
|---|---|
| La richiesta intera | 1,5 MB |
| Immagini per richiesta | 4 |
| Una immagine | 1,1 milioni di caratteri (circa 800 KB) |
| Testo in tutto | 150.000 caratteri |
| Messaggi | 40 |
| Token della risposta | fra 64 e 4096 |

**La traduzione.** Dal formato dell'app (`system`, `messages` con testo e
immagini in base64) a quello di Workers AI (`messages` con un messaggio
`system` e le immagini come `image_url`), e indietro (`content` con un blocco
di testo). Le risposte di Workers AI arrivano in due forme (`response` o
`choices`): si accettano tutte e due, e si toglie il ragionamento ad alta
voce, se c'è.

**La ricerca sul web.**
- **«Serve prenotare?»**: una ricerca, sempre, con il nome della tappa, la
  destinazione, l'argomento e la data; poi una chiamata al modello con i
  risultati davanti.
- **In chat**: il modello riceve l'elenco di posti, destinazione e date
  ammessi, e se gli servono fatti aggiornati risponde con una riga sola,
  `CERCA: argomento | luogo | data`. Solo allora si cerca, e gli si richiede
  la risposta con i risultati. Le domande normali costano una chiamata sola.
- **La domanda per Tavily la compone il ponte**, solo con un luogo
  dell'elenco, la destinazione, un argomento tradotto da una lista fissa
  (`ARGOMENTI`) e una data dell'elenco. Quello che scrive il modello non ci
  entra mai così com'è: anche se ci mettesse un nome o un telefono, a Tavily
  non arriverebbe (`test/prova-ponte-ai.js` lo prova).
- Se Tavily non c'è (manca la chiave), rifiuta la chiave, ha finito i
  crediti o non risponde entro 8 secondi, il modello risponde lo stesso con
  quello che sa, e l'app lo dice.
- Un'app vecchia, che l'elenco non lo manda, non fa partire ricerche.

**La quota.** Workers AI dà 10.000 Neuron al giorno, per tutti gli utenti
insieme. Gemma 4 ne usa circa 9.000 per milione di token in entrata e 27.000
per milione in uscita: una domanda in chat con la mappa compatta sta sui
50-60 Neuron, una con la ricerca il doppio. Finiti i Neuron, Workers AI
risponde con un errore (codice 4006): il ponte lo traduce in 429
`quota_finita` con l'ora del ritorno, la prossima mezzanotte UTC.

**Il ragionamento.** Gemma 4 sa «ragionare» prima di rispondere, e il
ragionamento consuma token e quota. Da qui non si è potuto verificare se su
Workers AI sia acceso di serie. Il ponte si difende: toglie il ragionamento
dal testo e, se la risposta arriva vuota perché i token sono finiti a
ragionare, riprova una volta con il doppio dello spazio. `/prova` dice se il
modello ragiona; se le risposte arrivano spesso tagliate, c'è la variabile
`OPZIONI_MODELLO` (§2g).

---

## 5. Rimettere in piedi tutto da zero

Se un giorno si rompe, o se serve rifarlo su un altro account.

### 5a. Il Worker

1. `dash.cloudflare.com` → account giusto → **Compute (Workers)** →
   **Workers & Pages**
2. **Create application** → **Start with Hello World!** → nome `geppgo-ai` →
   **Deploy**
3. **Edit code** → cancella tutto → incolla `worker/ponte-ai.js` → **Deploy**
4. Il secret `TAVILY_KEY` e il collegamento `AI`, come in §2b e §2d.

La prima volta che si crea un Worker su un sottodominio nuovo, il certificato
HTTPS ci mette **da qualche minuto a un quarto d'ora**. Nel frattempo il browser
dice *"non riesce a stabilire una connessione sicura"*: non è un errore, è
Cloudflare che sta ancora emettendo il certificato. Aspetta e riprova.

### 5b. L'aggancio nell'app

In `Index 2.1.html`, prima del blocco `===== ENDPOINT AI =====`:

```js
window.GEPPGO_AI_URL = "https://geppgo-ai.merati-giacomo94.workers.dev";
```

Se il Worker ha un nome o un account diverso, cambia l'indirizzo qui (e la
versione dell'app, come per ogni modifica).

### 5c. Cambiare modello o servizio

- **Un altro modello di Workers AI**: la variabile `MODELLO` (§2g). Non si
  tocca il codice.
- **Un altro servizio** (un altro fornitore di modelli, un altro motore di
  ricerca): si cambia `worker/ponte-ai.js` — la funzione `modello` per il
  modello, la funzione `cerca` per la ricerca — si aggiorna la sua prova, e
  si aggiornano `privacy.html` e `PRIVACY-STORE.md` con il nome nuovo e
  quello che le sue condizioni dicono dei dati. `test/prova-privacy.js`
  controlla che ogni indirizzo scritto nel ponte sia nella privacy. L'app non
  si tocca: parla sempre lo stesso linguaggio.

---

## 6. Se qualcosa non va

| Sintomo | Cosa vuol dire | Cosa fare |
|---|---|---|
| `/prova`: *manca il collegamento «AI» del Worker* | Il collegamento al modello non c'è | §2d |
| `/prova`: *quota di oggi finita ⏳* | I Neuron del giorno sono finiti | Aspettare la mezzanotte UTC (le 2 in Italia d'estate, l'1 d'inverno) |
| `/prova`: *NON FUNZIONA ❌* con *model* o *not found* nel testo | Il modello è stato ritirato o il nome è sbagliato | Scegliere un modello dal catalogo e scriverlo in `MODELLO` (§2g) |
| `/prova`: *risposta vuota (tagliata: ha finito i token ragionando)* | Il modello ragiona troppo a lungo | `OPZIONI_MODELLO` (§2g) |
| `/prova`: *RICERCA WEB: non configurata* | Manca il secret `TAVILY_KEY` | §2b |
| `/prova?ricerca=1`: *NON FUNZIONA ❌ non_configurata* | Tavily rifiuta la chiave | Ricopiare la chiave da `app.tavily.com` e riscrivere il secret |
| `/prova?ricerca=1`: *crediti_finiti* | I 1.000 crediti del mese sono finiti | Aspettare il mese nuovo: l'assistente intanto risponde senza cercare |
| L'app: *L'assistente ha raggiunto il limite di oggi: torna disponibile alle …* | La quota del giorno è finita | Aspettare l'ora scritta. Se capita spesso, vedi §7a |
| L'app: *La ricerca sul web non è attiva: rispondo con quello che so.* | Manca il secret di Tavily, o la chiave è sbagliata | §2b, poi `/prova?ricerca=1` |
| L'app: *Le ricerche sul web di questo mese sono finite…* | Crediti di Tavily finiti | Niente da fare fino al mese nuovo |
| L'app: *La ricerca sul web non ha risposto…* | Tavily giù o lento (oltre 8 secondi) | Di solito passa da sé |
| L'app: *L'assistente non è disponibile in questo momento* | Il ponte rifiuta l'app (403): di solito l'app è su un indirizzo nuovo | Aggiungerlo in `ORIGINI` (§2g) |
| L'app: *La richiesta è troppo grande per l'assistente…* | Oltre i limiti del ponte (§4) | Meno testo o meno pagine |
| L'app: *L'assistente non ha risposto: riprova fra poco.* | Il modello ha dato errore anche al secondo tentativo | `/prova` dice cosa |
| L'app: *L'assistente non è raggiungibile: controlla la rete e riprova.* | L'app non arriva al Worker | Controllare `window.GEPPGO_AI_URL` (§5b) e che `/prova` risponda |
| L'app: *L'assistente non ha risposto in tempo* | Nessuna risposta in 30 secondi (60 con una foto o un PDF) | Di solito è il modello in coda: riprovare. Il dettaglio è in console |
| *"non riesce a stabilire una connessione sicura"* | Certificato HTTPS non ancora emesso | Aspettare qualche minuto. Usare Chrome, non Safari (Safari si tiene in cache il fallimento) |
| Il pannello Cloudflare non mostra `geppgo-ai` | Si è nell'account sbagliato | `dash.cloudflare.com` senza niente dopo, scegliere l'account giusto |

---

## 7. Quando l'app crescerà

**Questo paragrafo va riletto prima di pubblicare GeppGo sugli store.**

### 7a. La quota è di tutti insieme

10.000 Neuron al giorno bastano per qualche centinaio di domande, divise fra
**tutti** gli utenti. Con molte persone, verso sera l'assistente si fermerà.
Il passo successivo è il piano a pagamento di Workers (pochi dollari al
mese, più i Neuron oltre la quota a consumo: i prezzi vanno verificati sul
sito di Cloudflare nel momento in cui si fa). Zero righe di codice: cambia
solo che oltre la quota si paga invece di fermarsi. Il giorno che si fa,
leggere prima il 7b.

Per Tavily vale lo stesso: 1.000 crediti al mese, poi piani a pagamento.
Finiti i crediti l'assistente non si ferma, risponde senza cercare.

### 7b. Il ponte non è una serratura

Il controllo dell'origine tiene fuori le pagine degli altri, ma non un
programma scritto apposta. Finché tutto è gratis, il danno possibile è che
qualcuno consumi la quota del giorno; con un piano a pagamento, è la carta
di chi ha pubblicato l'app.

Prima di passare a un piano a pagamento serve che il ponte chieda "chi sei":
GeppGo ha già Supabase con le sessioni, quindi l'app manda il token della
sessione e il Worker lo verifica con Supabase, rifiutando chi non è entrato.
Sono una ventina di righe nel Worker e una nell'app.

### 7c. Il JSON garantito

Le chiamate chiedono al modello *"rispondi SOLO con JSON"*, e in chat si
cerca una riga che comincia per `LUOGHI:`. La lettura sta in un posto solo,
`aiLeggiJSON`, e regge bene; la cura vera sarebbe la modalità JSON di Workers
AI, in cui si dichiara lo schema e la risposta arriva per forza in quella
forma. Per Gemma 4 Cloudflare non la dichiara: quando un modello che la
supporta diventerà quello usato, va accesa nel ponte.

---

## 8. Regole da non dimenticare

1. **Nessuna chiave dentro `Index 2.1.html`**, né in nessun file del
   progetto. Stanno solo nei secret del Worker, di tipo **Secret** (con
   *Text* il valore resta leggibile nel pannello).
2. **Una chiave non va mai incollata in una chat**, nemmeno per farla
   controllare. Se succede, va cancellata e rifatta.
3. **Il codice del ponte vive in `worker/ponte-ai.js`.** Si cambia lì, si
   prova (`node test/prova-ponte-ai.js`), e solo dopo si incolla nel pannello
   e si fa **Deploy**. Una modifica fatta solo nel pannello si perde al
   prossimo incolla.
4. **Dopo ogni modifica al Worker serve il Deploy**, sia per il codice sia
   per collegamenti, secret e variabili.
5. **A Tavily solo pezzi dell'elenco**: luoghi, destinazione, argomento,
   data. Mai testo libero di chi usa l'app o del modello. La prova lo
   controlla; non va aggirata.
6. **Se cambia un servizio, cambia la privacy** (`privacy.html` e
   `PRIVACY-STORE.md`), lo stesso giorno, scrivendo solo quello che le sue
   condizioni dicono davvero.
7. **Prima di pubblicare sugli store, rileggere il paragrafo 7.**
