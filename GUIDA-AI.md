# GUIDA — L'intelligenza artificiale dentro GeppGo

Questo file spiega come l'IA è collegata a GeppGo, come rimetterla in piedi se
si rompe, e cosa cambierà il giorno in cui l'app verrà pubblicata davvero.

È scritto per essere letto anche fra sei mesi, da chi non programma.

---

## 1. Come funziona, in tre righe

```
GeppGo (Index 2.1.html)  →  Worker su Cloudflare  →  Google Gemini
                          ←                        ←
```

L'app **non parla direttamente con Google**. Manda le sue richieste a un
programmino ospitato su Cloudflare (il *Worker*), che fa da ponte: traduce la
domanda nel linguaggio di Google, la inoltra, e ritraduce la risposta indietro
nel formato che l'app si aspetta.

**Perché in mezzo c'è un ponte e non una linea diretta?**

Perché per parlare con Google serve una chiave segreta, e `Index 2.1.html` è un
file che chiunque può aprire e leggere. Se la chiave fosse lì dentro, il primo
che apre il sorgente della pagina se la porterebbe via e la spenderebbe a nome
nostro. Dentro il Worker invece nessuno la vede.

**Effetto collaterale utile:** l'app parla il linguaggio di Anthropic (Claude)
anche se dall'altra parte c'è Google. Vuol dire che per cambiare motore basta
cambiare il Worker — l'app non si tocca. Vedi il paragrafo 6.

---

## 2. I pezzi, e dove stanno

| Pezzo | Dove | A cosa serve |
|---|---|---|
| L'app | `Index 2.1.html` | Il file unico di GeppGo |
| L'aggancio | `window.GEPPGO_AI_URL`, nello stesso file, subito prima del blocco `L'ASSISTENTE: UNA PORTA SOLA` | Dice all'app dove sta il ponte |
| Il ponte | Cloudflare → Workers → `geppgo-ai` | Traduce e protegge la chiave |
| La chiave | Cloudflare → `geppgo-ai` → Settings → Variables and Secrets → `GEMINI_KEY` | Le credenziali per Google |
| L'account Google | aistudio.google.com | Dove la chiave è stata creata |

**Indirizzo del ponte:**
`https://geppgo-ai.merati-giacomo94.workers.dev`

**Attenzione all'account Cloudflare:** ce ne sono due sotto la stessa mail. Il
Worker vive in quello chiamato *Merati.giacomo94@gmail.com's Account* (ID che
comincia per `f1552d99`). L'altro è vuoto — se apri il pannello e non vedi
`geppgo-ai`, sei nell'account sbagliato: vai su `dash.cloudflare.com` senza
niente dopo e scegli quello giusto dall'elenco.

**Indirizzi utili per controllare che sia tutto vivo:**

- `…workers.dev/prova` → fa una domanda vera e risponde `FUNZIONA ✅` o
  `NON FUNZIONA ❌` con il motivo scritto
- `…workers.dev/modelli` → elenco dei modelli che la chiave può usare, uno per riga

---

## 3. Dove l'app usa l'IA

Quattordici punti, tutti dentro `Index 2.1.html`, e **tutti passano da una
funzione sola, `chiediAI`** (blocco `L'ASSISTENTE: UNA PORTA SOLA`). Nessuno
fa una `fetch` per conto suo: c'è una `fetch` verso il ponte in tutto il file,
dentro `aiRichiesta`, e `test/prova-ai.js` controlla che resti così.

| Funzione | Chiave | Cosa fa | Cosa manda |
|---|---|---|---|
| `assistenteChiedi` | `chat` | L'assistente, uno solo per la scheda e per la time-table (cerca sul web) | Gli ultimi 14 messaggi, `MAPPA_APP`, il programma del viaggio (tappe, orari, meteo, posizioni arrotondate a ~110 m) |
| `identifyPlace` | `identifica` | "Che posto è questa foto" | La foto ritagliata, ridisegnata (niente dati nascosti), e la destinazione |
| `extractPlaces` | `reel` | Estrae i posti da un reel o uno screenshot | La didascalia e lo screenshot ridisegnato a 1280 px, senza GPS |
| `importTrip` | `itinerario-scritto` | Trasforma un itinerario scritto in un viaggio | Il testo, tolti email, telefoni, carte e IBAN (i nomi restano: diventano i compagni) |
| `doCheckBooking` | `prenotare` | Cerca sul web se serve prenotare | Nome della tappa e destinazione |
| `refreshSuggestions` | `consigli` | Consiglia attrazioni nei dintorni, in sottofondo | Destinazione, gusti, nomi dei posti già scelti |
| `verificaPosti` | `posti` | Controlla sul web nome e indirizzo dei posti incollati | Nomi dei posti e destinazione |
| `verificaOrari` | `orari` | Cerca sul web a che ora aprono e chiudono le tappe | Nomi delle tappe, destinazione, giorno della settimana |
| `chiediMosse` | `mosse` | Propone modifiche al programma già fatto | La richiesta e il programma del viaggio |
| `creaItinerarioIA` | `itinerario` | Costruisce l'itinerario di tutto il viaggio da zero | Destinazione, giorni, meteo, gusti |
| `pianificaDaTesto` | `incollato` | Legge un itinerario scritto da un'altra IA — incollato o allegato in PDF — e lo mette in un giorno | Il testo, tolti email, telefoni, carte, IBAN (e dai PDF i nomi di chi ha prenotato) |
| `categorizzaBagagli` | `bagagli` | Mette in categoria le voci di una lista bagagli incollata | Le voci |
| `bagagliDaTesto` | `bagagli` | Tira fuori le voci da mettere in valigia dal testo di un PDF | Il testo, ripulito come sopra |
| `alloggioDaIA` | `alloggio` | Legge la mail di conferma di un albergo | La mail (al massimo 12.000 caratteri), tolti email, carte, IBAN e nome dell'ospite; i telefoni restano, serve quello dell'albergo |

Tutte usano lo stesso indirizzo, quindi **si accendono e si spengono insieme**.

**Cosa fa `chiediAI`, per tutte:**

- **senza rete non parte**: lo dice subito, senza richiesta;
- **tempo massimo**: 30 secondi, 60 con una foto o il testo di un PDF
  (`AI_TEMPO_TESTO_MS`, `AI_TEMPO_FILE_MS`). Prima non c'era, e col campo
  debole la richiesta restava appesa per sempre col tasto morto;
- **un secondo tentativo, uno solo**, se la rete cade o il ponte risponde con
  un errore 5xx; mai se l'assistente è troppo richiesto (429, o la quota di
  Google finita, che il ponte manda come 502 con il messaggio di Google
  dentro: `aiTipoErrore` lo riconosce dal testo). Insistere allungherebbe solo
  la coda;
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
- **i messaggi a schermo sono frasi da persona**, tradotte; il dettaglio
  tecnico (lo status, il testo del ponte) va in `console.log`.

Il modello non lo sceglie l'app: nella richiesta non c'è nessun `model`, lo
decide il ponte.

**I PDF non passano dal ponte.** Il testo si tira fuori qui nel telefono con
`pdf.js` (scaricato da jsDelivr la prima volta che si allega un PDF), e poi si
manda al modello come se fosse stato incollato a mano, ripulito come sopra.
Quindi non c'è niente da cambiare nel Worker, e il file non esce mai dal
telefono. L'unica cosa che il PDF non può dare è il testo di una scansione: se
le pagine sono fotografie, dentro non c'è nessun testo da leggere, e l'app lo
dice invece di far finta.

**Un punto da tenere aggiornato a mano:** dentro `Index 2.1.html` c'è una
costante `MAPPA_APP` che descrive all'assistente com'è fatta l'app — quali voci
ci sono nella barra in basso, dove sta la lista bagagli, come si chiamano i
tasti della time-table. Serve per rispondere a domande tipo *"dove trovo i
bagagli?"*. Se si sposta o si rinomina qualcosa nell'interfaccia, va aggiornata
lì dentro, altrimenti l'assistente manda le persone in un posto che non esiste
più.

**Le ultime due non scrivono mai nei dati da sole.** `chiediMosse` restituisce un
elenco di mosse che vengono mostrate una per una, spuntabili, con il motivo di
ognuna; `creaItinerarioIA` mostra prima l'anteprima giorno per giorno. In tutti
e due i casi resta la barra **↩ Annulla** per quindici secondi dopo aver
applicato. È una scelta, non una limitazione tecnica: un'app che riordina il
viaggio da sola mentre non guardi perde la fiducia di chi la usa molto più in
fretta di quanta gliene faccia guadagnare un buon consiglio.

---

## 4. Rimettere in piedi tutto da zero

Se un giorno si rompe, o se serve rifarlo su un altro account.

### 4a. La chiave Google

1. `aistudio.google.com` → accedi
2. `aistudio.google.com/apikey` → **Create API key**
3. Se chiede il progetto: *Create API key in new project*
4. Copiala. Oggi Google le emette nel formato `AQ.…` (una volta era `AIza…`:
   vanno bene entrambe, dipende da quando la crei)

Non serve la carta di credito. Non cliccare mai *Enable billing* / *Attiva
fatturazione* se vuoi restare gratis. ⚠️ Ma prima leggi il paragrafo 7a: per
un'app usata in Europa le condizioni di Google sembrano chiedere proprio il
piano a pagamento.

### 4b. Il Worker

1. `dash.cloudflare.com` → account giusto → **Compute (Workers)**
2. **Create application** → **Start with Hello World!** → nome `geppgo-ai` → **Deploy**
3. **Edit code** → cancella tutto → incolla il codice del paragrafo 5 → **Deploy**
4. Scheda **Settings** → **Variables and Secrets** → **Add**
   - Tipo: **Secret** (non "Text", se no la chiave resta leggibile)
   - Nome: `GEMINI_KEY`
   - Valore: la chiave
   - **Deploy**

La prima volta che si crea un Worker su un sottodominio nuovo, il certificato
HTTPS ci mette **da qualche minuto a un quarto d'ora**. Nel frattempo il browser
dice *"non riesce a stabilire una connessione sicura"*: non è un errore, è
Cloudflare che sta ancora emettendo il certificato. Aspetta e riprova.

### 4c. L'aggancio nell'app

In `Index 2.1.html`, prima del blocco `===== ENDPOINT AI =====`:

```js
window.GEPPGO_AI_URL = "https://geppgo-ai.merati-giacomo94.workers.dev";
```

---

## 5. Il codice del Worker

Copia-incolla integrale. Se lo perdi, è tutto qui.

```js
/* Ponte GeppGo → Gemini
   L'app continua a parlare "anthropic": qui si traduce verso Google
   e si ritraduce la risposta indietro. La chiave non sta in questo file. */

/* Google ritira i modelli vecchi senza preavviso, e non tutti sono concessi
   sul piano gratuito: si provano in ordine finché uno risponde, e il primo
   che funziona resta in memoria. Tenere davanti quello che va davvero:
   ogni tentativo fallito è una chiamata sprecata. */
const CANDIDATI = ["gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-2.0-flash", "gemini-3.5-flash", "gemini-3.6-flash"];
let scelto = null;

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, x-api-key, anthropic-version"
};

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    const via = new URL(req.url).pathname;

    /* elenco leggibile dei modelli che la chiave può usare */
    if (via === "/modelli") {
      const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", {
        headers: { "x-goog-api-key": env.GEMINI_KEY }
      });
      const d = await r.json();
      const nomi = (d.models || [])
        .filter(m => (m.supportedGenerationMethods || []).includes("generateContent"))
        .map(m => m.name).join("\n");
      return testo(nomi || JSON.stringify(d, null, 2));
    }

    /* prova completa: una domanda vera che passa dalla traduzione */
    if (via === "/prova") {
      const e = await rispondi({
        max_tokens: 300,
        messages: [{ role: "user", content: "Rispondi in italiano con una frase sola: cosa vale la pena vedere a Tokyo?" }]
      }, env);
      return testo(e.testo
        ? `FUNZIONA ✅\nmodello usato: ${e.modello}\n\n${e.testo}`
        : `NON FUNZIONA ❌\n\n${e.errore}`);
    }

    if (req.method !== "POST") return new Response("Ponte GeppGo attivo", { headers: CORS });

    let a;
    try { a = await req.json(); } catch (e) { return json({ error: { message: "richiesta non leggibile" } }, 400); }

    const e = await rispondi(a, env);
    if (!e.testo) return json({ error: { message: e.errore } }, 502);
    return json({ content: [{ type: "text", text: e.testo }], stop_reason: "end_turn" });
  }
};

async function rispondi(a, env) {
  /* ---- da anthropic a gemini ---- */
  const corpo = {
    contents: (a.messages || []).map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: pezzi(m.content)
    })),
    generationConfig: {
      maxOutputTokens: Math.max(a.max_tokens || 1024, 2048),
      thinkingConfig: { thinkingBudget: 0 }
    }
  };
  if (a.system) corpo.system_instruction = { parts: [{ text: a.system }] };
  if ((a.tools || []).some(t => String(t.type || "").startsWith("web_search")))
    corpo.tools = [{ google_search: {} }];

  const lista = scelto ? [scelto, ...CANDIDATI.filter(m => m !== scelto)] : CANDIDATI;
  const problemi = [];

  for (const modello of lista) {
    let r = await chiama(env, modello, corpo);

    /* alcuni modelli non conoscono thinkingConfig: si riprova senza */
    if (r.status === 400 && /thinking/i.test(await r.clone().text())) {
      const c2 = JSON.parse(JSON.stringify(corpo));
      delete c2.generationConfig.thinkingConfig;
      r = await chiama(env, modello, c2);
    }

    const d = await r.json().catch(() => null);

    if (d && !d.error) {
      /* ---- da gemini ad anthropic ---- */
      const parti = (((d.candidates || [])[0] || {}).content || {}).parts || [];
      const t = parti.map(p => p.text || "").join("").trim();
      if (t) { scelto = modello; return { testo: t, modello }; }
      problemi.push(`${modello} → risposta vuota`);
      continue;
    }
    const m = (d && d.error && d.error.message) || "errore sconosciuto";
    problemi.push(`${modello} → ${m.split("\n")[0].slice(0, 160)}`);
  }
  return { testo: "", errore: problemi.join("\n\n") };
}

function chiama(env, modello, corpo) {
  return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modello}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_KEY },
    body: JSON.stringify(corpo)
  });
}

/* il contenuto di anthropic può essere una stringa o una lista di blocchi (testo + foto) */
function pezzi(c) {
  if (typeof c === "string") return [{ text: c }];
  return (c || []).map(b => {
    if (b.type === "text") return { text: b.text };
    if (b.type === "image") return { inline_data: { mime_type: b.source.media_type, data: b.source.data } };
    return null;
  }).filter(Boolean);
}

function json(o, status) {
  return new Response(JSON.stringify(o), {
    status: status || 200, headers: { ...CORS, "content-type": "application/json" }
  });
}

function testo(s) {
  return new Response(s, { headers: { ...CORS, "content-type": "text/plain; charset=utf-8" } });
}
```

---

## 6. Cambiare motore (Google ↔ Anthropic)

**Si tocca solo il Worker. L'app non si apre nemmeno.**

Per passare ad Anthropic (Claude), tutto il codice qui sopra si riduce a questo:

```js
export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    /* l'app non dice quale modello usare: lo decide il ponte */
    const a = await req.json();
    a.model = env.ANTHROPIC_MODEL;
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env.ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(a)
    });
    return new Response(r.body, { status: r.status, headers: { ...CORS, "content-type": "application/json" } });
  }
};
```

Non serve nessuna traduzione, perché l'app parla già quel linguaggio: si passa
la richiesta com'è, aggiungendo solo il nome del modello (dall'ottobre 2026
l'app non lo manda più: lo sceglie il ponte). Poi si aggiungono il segreto
`ANTHROPIC_KEY` al posto di `GEMINI_KEY` e la variabile `ANTHROPIC_MODEL` con
il nome del modello, e si fa Deploy.

**L'unico pezzo che cambia davvero** è la ricerca sul web, che usano la chat,
`doCheckBooking`, `verificaOrari` e `verificaPosti` (`cercaSulWeb` in
`chiediAI`): Anthropic ha lo strumento `web_search`, Google ha il *grounding*
con la Ricerca Google. Sono due cose diverse — nel codice qui sopra la
traduzione c'è (`tools: [{ google_search: {} }]`), passando ad Anthropic si
può togliere perché l'app manda già il formato giusto.

**Costi a confronto**, per dare un ordine di grandezza (una chiamata di GeppGo
sono circa 2.000 gettoni in entrata e 500 in uscita):

| | costo per chiamata | note |
|---|---|---|
| Gemini Flash, piano gratuito | 0 | pochi al minuto, dati usati per l'addestramento |
| Gemini Flash, piano a pagamento | frazioni di centesimo | serve la carta |
| Claude Opus | ~2 centesimi | qualità migliore sulle scelte di orari e distanze |
| Claude Haiku | ~0,5 centesimi | via di mezzo |

---

## 7. Quando l'app verrà pubblicata

**Questo paragrafo va riletto per intero prima di mettere GeppGo online.**

Finché l'app gira solo sul telefono di chi l'ha fatta, quello che c'è adesso va
benissimo. Nel momento in cui la usano altre persone — a maggior ragione se
pagano — cambiano tre cose.

### 7a. Il piano gratuito di Google non regge un prodotto

- **I limiti sono per chiave, non per utente.** Sono poche richieste al minuto e
  un tetto giornaliero, e li condividono *tutti* gli utenti insieme. Con
  duecento persone, il decimo che schiaccia "autopilota" nello stesso minuto si
  becca un errore.
- **I dati del piano gratuito vengono usati per migliorare i modelli di Google.**
  Su un'app personale è poca cosa; su un'app dove entrano itinerari e nomi di
  altre persone, è un fatto che va scritto nell'informativa privacy — e da
  ottobre 2026 `privacy.html` lo scrive: Google Gemini per nome, l'uso per
  migliorare i prodotti, i revisori, il consiglio di non mandare dati sensibili.
- **Nessuna garanzia di servizio.** Se rallenta o cambia, non c'è appiglio.
- ⚠️ **In Europa il piano gratuito potrebbe non essere consentito affatto.**
  Cercando le condizioni dell'API di Gemini (ottobre 2026; la pagina
  `ai.google.dev/gemini-api/terms` dall'ambiente di lavoro non si apriva,
  quindi va riletta a mano) risultano due cose: fra le restrizioni d'uso, chi
  rende disponibile un'app a persone nello Spazio economico europeo, in
  Svizzera o nel Regno Unito **può usare solo i servizi a pagamento**; e per
  chi sta in quei paesi Google applica anche al piano gratuito le regole sui
  dati del piano a pagamento. Se è così, GeppGo — italiana, per utenti
  italiani — deve attivare la fatturazione prima di essere usata da altri, e
  la frase della privacy sull'uso dei dati per migliorare i prodotti va
  tolta, perché non sarebbe più vera.

Il passaggio è indolore: in Google Cloud si attiva la fatturazione sullo stesso
progetto, la stessa chiave diventa "a pagamento", i limiti si alzano di molto e
i dati non vengono più usati per l'addestramento. **Zero righe di codice
cambiate.** (Le condizioni esatte vanno verificate sul sito nel momento in cui
si fa: sono cose che Google ritocca.) Il giorno che si fa, vanno aggiornati
`privacy.html` (sezione «Quello che chiedi all'assistente») e
`PRIVACY-STORE.md`.

### 7b. Il ponte non può restare aperto a chiunque

Oggi il Worker risponde a chiunque conosca il suo indirizzo. E l'indirizzo è
scritto dentro `Index 2.1.html`, quindi **chiunque apra il sorgente della pagina
lo trova in due secondi**. Finché la quota è gratis il danno è un fastidio; con
la fatturazione attiva, è la carta di chi ha pubblicato l'app.

Serve che il Worker chieda "chi sei" prima di inoltrare. GeppGo ha già Supabase
con le sessioni, quindi la soluzione è: l'app manda il token della sessione, il
Worker lo verifica con Supabase e rifiuta chi non è loggato. Sono una ventina di
righe dentro il Worker, non si tocca l'app.

Vale identico con Google o con Anthropic: non c'entra il fornitore, c'entra il
fatto che il ponte è pubblico.

### 7c. Vale la pena rivedere come si legge la risposta

Le chiamate chiedono al modello *"rispondi SOLO con JSON, niente backtick"* —
in chat si cerca addirittura una riga che comincia per `LUOGHI:`. Era la parte
fragile: bastava che il modello aggiungesse una frase di cortesia, e il pezzo
che legge la risposta andava in errore.

Da ottobre 2026 la lettura sta in un posto solo, `aiLeggiJSON`: toglie i
```, prende il primo oggetto intero anche con del testo intorno (contando le
parentesi fuori dalle virgolette), e se non trova niente `chiediAI` chiede una
volta sola di riscrivere la stessa risposta come JSON. Regge molto meglio, ma
resta un rimedio.

La cura vera sono le **structured outputs**, che entrambi i fornitori offrono:
si dichiara lo schema del JSON nella richiesta e la risposta è garantita in
quella forma. Serve toccare il Worker (per Gemini: `responseSchema` nella
`generationConfig`), quindi non è stato fatto insieme al resto. Non è urgente,
ma è la prossima cosa da sistemare quando l'app smette di essere un giocattolo
personale.

---

## 8. Se qualcosa non va

| Sintomo | Cosa vuol dire | Cosa fare |
|---|---|---|
| *"non riesce a stabilire una connessione sicura"* | Certificato HTTPS non ancora emesso | Aspettare qualche minuto. Usare Chrome, non Safari (Safari si tiene in cache il fallimento) |
| *"Safari non riesce a trovare il server"* | Il nome non è ancora propagato | Aspettare un minuto e ricaricare |
| `/prova` dice `NON FUNZIONA` con *"no longer available to new users"* | Il modello è stato ritirato per gli account nuovi | Aprire `/modelli`, prendere un nome dall'elenco, metterlo davanti in `CANDIDATI` |
| `/prova` dice *"quota exceeded … limit: 0"* | Quel modello non è concesso sul piano gratuito | Idem: provarne un altro dall'elenco di `/modelli` |
| `/prova` dice *"Please retry in N seconds"* | Troppe richieste ravvicinate | Aspettare i secondi indicati. Se capita spesso, mettere una pausa fra una chiamata e l'altra |
| *"API key not valid"* | La chiave nel Secret è sbagliata o revocata | Rifarla su `aistudio.google.com/apikey` e riscrivere il Secret |
| Il pannello Cloudflare non mostra `geppgo-ai` | Si è nell'account sbagliato | `dash.cloudflare.com` senza niente dopo, scegliere l'account giusto |
| L'app dice *"L'assistente non è raggiungibile: controlla la rete e riprova."* | L'app non arriva al Worker (anche dopo il secondo tentativo) | Controllare che la riga `window.GEPPGO_AI_URL` sia in `Index 2.1.html` e che `/prova` risponda |
| L'app dice *"L'assistente è molto richiesto: riprova fra qualche minuto"* | Google ha detto 429, o che la quota è finita (il ponte lo manda come 502) | Aspettare. Se capita spesso, è il segno che il piano gratuito non basta più (7a) |
| L'app dice *"L'assistente non è disponibile in questo momento"* | Chiave rifiutata (401/403) o modello ritirato | `/prova` dice quale dei due; poi come nelle righe qui sopra |
| L'app dice *"L'assistente non ha risposto in tempo"* | Nessuna risposta in 30 secondi (60 con una foto o un PDF) | Di solito è il modello in coda: riprovare. Il dettaglio è in console |

---

## 9. Regole da non dimenticare

1. **La chiave non va mai dentro `Index 2.1.html`**, né in nessun file del
   progetto. Sta solo nei Secret del Worker.
2. **La chiave non va mai incollata in una chat**, nemmeno per farla controllare.
   Se succede, va cancellata e rifatta.
3. **Il tipo del Secret deve essere "Secret", non "Text".** Con "Text" il valore
   resta leggibile nel pannello.
4. **Dopo ogni modifica al Worker serve il Deploy**, sia per il codice che per i
   segreti.
5. **Prima di pubblicare, rileggere il paragrafo 7.**
