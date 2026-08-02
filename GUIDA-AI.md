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
| L'aggancio | riga ~1524 dello stesso file | Dice all'app dove sta il ponte |
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

Sei punti, tutti dentro `Index 2.1.html`, tutti passano da `AI_URL`:

| Funzione | Riga circa | Cosa fa |
|---|---|---|
| `assistenteChiedi` | 2680 | L'assistente, uno solo per la scheda e per la time-table |
| `identifyPlace` | 4815 | "Che posto è questa foto" |
| `importPlaces` | 4850 | Estrae i posti da un reel o uno screenshot |
| `importTrip` | 5086 | Trasforma un itinerario incollato in un viaggio |
| `doCheckBooking` | 6218 | Cerca sul web se serve prenotare |
| `refreshSuggestions` | 6304 | Consiglia attrazioni nei dintorni |
| `verificaPosti` | 6350 | Controlla sul web nome e indirizzo dei posti incollati |
| `verificaOrari` | 5975 | Cerca sul web a che ora aprono e chiudono le tappe |
| `chiediMosse` | 5810 | Propone modifiche al programma già fatto |
| `creaItinerarioIA` | 5900 | Costruisce l'itinerario di tutto il viaggio da zero |
| `pianificaDaTesto` | 6408 | Legge un itinerario scritto da un'altra IA e lo mette in un giorno |

Tutte usano lo stesso indirizzo, quindi **si accendono e si spengono insieme**.

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
fatturazione* se vuoi restare gratis.

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
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env.ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: await req.text()
    });
    return new Response(r.body, { status: r.status, headers: { ...CORS, "content-type": "application/json" } });
  }
};
```

Non serve nessuna traduzione, perché l'app parla già quel linguaggio: si passa
la richiesta così com'è. Poi si aggiunge il segreto `ANTHROPIC_KEY` al posto di
`GEMINI_KEY` e si fa Deploy.

**L'unico pezzo che cambia davvero** è `doCheckBooking` (la ricerca sul web per
capire se serve prenotare): Anthropic ha lo strumento `web_search`, Google ha il
*grounding* con la Ricerca Google. Sono due cose diverse — nel codice qui sopra
la traduzione c'è (`tools: [{ google_search: {} }]`), passando ad Anthropic si
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
  altre persone, è un fatto che va scritto nell'informativa privacy.
- **Nessuna garanzia di servizio.** Se rallenta o cambia, non c'è appiglio.

Il passaggio è indolore: in Google Cloud si attiva la fatturazione sullo stesso
progetto, la stessa chiave diventa "a pagamento", i limiti si alzano di molto e
i dati non vengono più usati per l'addestramento. **Zero righe di codice
cambiate.** (Le condizioni esatte vanno verificate sul sito nel momento in cui
si fa: sono cose che Google ritocca.)

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

Le sei chiamate di oggi chiedono al modello *"rispondi SOLO con JSON, niente
backtick"* e poi ripuliscono il testo con una regex — in chat si cerca
addirittura una riga che comincia per `LUOGHI:`. È la parte fragile: basta che
il modello aggiunga una frase di cortesia e il pezzo che legge la risposta va in
errore.

Entrambi i fornitori offrono le **structured outputs**: si dichiara lo schema
del JSON nella richiesta e la risposta è garantita in quella forma. Non è
urgente, ma è la prima cosa da sistemare quando l'app smette di essere un
giocattolo personale.

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
| L'app dice *"L'assistente AI non è raggiungibile"* | L'app non arriva al Worker | Controllare che la riga `window.GEPPGO_AI_URL` sia in `Index 2.1.html` e che `/prova` risponda |

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
