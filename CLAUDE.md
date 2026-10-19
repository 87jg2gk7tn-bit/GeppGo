# GeppGo — regole di progetto

## Cos'è

PWA per organizzare viaggi di gruppo, in un unico file HTML: **`Index 2.1.html`**
(~19.700 righe; `index.html` rimanda solo lì). JavaScript vanilla, niente
framework, niente build step. Interfaccia scritta in italiano; l'app si traduce
da sola in inglese, spagnolo, francese e portoghese seguendo la lingua del
telefono (i dizionari stanno dentro l'HTML). Sviluppatore singolo che lavora da
iPhone. Hosting statico su GitHub Pages: **ogni push su `main` va online**
(i rami no), quindi su `main` arriva solo codice verificato.

La versione è la costante **`VERSIONE_APP`** in `Index 2.1.html` (data e ora,
`'AAAA-MM-GG HH:MM'`). È l'unico numero di versione che l'utente vede: il
Profilo la mostra nella scheda dell'account («GeppGo · 2026-10-06 12:00») e
nella scheda Versione («Versione del 6 ottobre 2026, 12:00», nella lingua
scelta). Il valore di adesso si legge nel codice, non qui. Non esiste un numero
di build: la vecchia «build rXX» era scritta a mano, non la aggiornava nessuno
ed è stata tolta. La `version` di `package.json` non compare da nessuna parte.

## Leggi prima di tutto

**`DA-FARE.md`** — a che punto è il progetto, cosa manca, e le cose scoperte a
caro prezzo che non conviene riscoprire. Le sessioni non si ricordano fra loro:
quel file è la memoria.

## Com'è fatta (vincoli fissi)

- **L'app sta tutta in `Index 2.1.html`**: niente file JS/CSS separati
  dell'app. Fuori ci sta solo quello che non può stare dentro: `sw.js` (il
  service worker deve essere un file a sé), `manifest.webmanifest`,
  `privacy.html` con le sue traduzioni (`privacy-en/es/fr/pt.html`: l'app
  apre quella della sua lingua, e in caso di dubbio vale l'italiano),
  `index.html`, le icone (`icona.svg` e i PNG in `icone/`, fatti dal logo
  con `npm run icone`, cioè `test/fai-le-icone.js`), le funzioni Supabase
  in `supabase/functions/`, le prove in `test/`. Le librerie arrivano da CDN (Leaflet, supabase-js,
  jsQR, ZXing, bwip-js, SheetJS per i file di Excel, fflate per il file del
  backup; pdf.js per i PDF),
  **mai bloccanti**: stanno in
  `LIBRERIE` dentro l'HTML, ognuna con la versione esatta e un file che esiste
  davvero nel pacchetto, e si caricano con `caricaLibreria` — Leaflet e
  supabase-js all'avvio senza fermarlo, le altre quando servono. La stessa
  lista sta in `sw.js`, che le tiene per l'offline: una prova le confronta.
  SheetJS, che pesa più di tutte le altre insieme, non si scarica in
  sottofondo: ha `alMomento:true` nell'app e sta in `LIBRERIE_AL_MOMENTO` di
  `sw.js`; arriva la prima volta che si apre l'importazione, e da lì resta.
  SheetJS viene da `cdn.sheetjs.com` (il pacchetto «xlsx» su npm è fermo
  alla 0.18.5, con falle note): anche le prove lo installano da lì, quindi
  l'ambiente di lavoro deve poter raggiungere quel dominio.
  I caratteri di Google arrivano con un `<link>` che non ferma la pagina
  (mai un `@import`), e la service worker li tiene da parte.
- **Backend: Supabase** — account, sincronizzazione dei viaggi, foto, le
  funzioni `vicini` e `geo` (il ponte della mappa) e `link-mappe` (apre i
  link corti di Google Maps), «A raccolta», la valigia e le impostazioni.
  Le funzioni si pubblicano da sole con `.github/workflows/funzioni.yml` a
  ogni push su `main` che le tocca: una funzione nuova va aggiunta lì. Senza
  account i dati restano solo sul telefono. `supabase-schema.sql` è la verità
  sul database: si rilancia quante volte si vuole senza danni. Una tabella
  nuova si consegna anche come file a sé in `supabase/migrazioni/`, da
  lanciare a mano nel SQL Editor; finché non c'è, l'app lavora in locale
  senza dire niente. Prima di modificare un progetto Supabase vero si
  guarda com'è fatto (`test/guarda-il-database.sql`).
- **I dati di chi non ha l'account** (blocco I DATI AL SICURO nell'HTML):
  l'app lo dice alla prima apertura a chi ha già viaggi, dopo il primo
  viaggio, e poi al massimo una volta a settimana; spiega la Home a chi usa
  Safari su iPhone, chiede la memoria persistente, e il backup è uno zip con
  dati, valigie e le foto messe dall'utente (fflate; quelle dei compagni no)
  che si consegna col foglio Condividi; il ripristino accetta anche il
  vecchio JSON. Con l'account un viaggio condiviso non si ripristina mai
  sopra quello del gruppo: torna come copia privata, con un id nuovo. Un
  viaggio che arriva nel cloud creando l'account si porta dietro le sue
  foto. «Esci» non lascia indietro modifiche o foto senza dirlo.
- **Due telefoni, nessuna perdita**: un viaggio si unisce lista per lista
  (spese, tappe, alberghi, biglietti, posti, persone: per id, con le lapidi
  `_del*` di quello che è stato tolto) e, per il resto, campo per campo con
  l'ora della modifica (`_ct`, che mette `save()`); i viaggi senza ore si
  uniscono a tre vie con l'ultima copia arrivata al cloud. `syncPush` legge
  il cloud prima di scrivere. La valigia e le impostazioni della persona
  stanno nella tabella `dati_personali`, che ognuno legge e scrive solo per
  sé (i compagni no), unite voce per voce e chiave per chiave. Restano del
  telefono lingua, permessi, piano e memorie di lavoro.
- **Indirizzo pubblico**: la costante `INDIRIZZO_PUBBLICO` (nella
  configurazione, dentro l'HTML) vale
  `https://87jg2gk7tn-bit.github.io/GeppGo/Index%202.1.html`. È dove tornano
  i link delle email di Supabase e da dove partono gli inviti. **Quando l'app
  passerà su un dominio suo va aggiornata**, insieme a Site URL e Redirect
  URLs in Supabase (Authentication › URL Configuration): un indirizzo che non
  sta lì Supabase lo scarta senza dirlo. I link delle email usano il flusso
  «implicit»: si aprono in Safari anche quando la richiesta parte dall'app
  sulla Home, quindi un flusso che pretende la stessa memoria (PKCE) non va.
- **AI**: passa dal Worker Cloudflare `geppgo-ai`, il cui codice è
  **`worker/ponte-ai.js`** (si pubblica a mano dalla dashboard, `GUIDA-AI.md`).
  Il modello è Gemma 4 su **Cloudflare Workers AI** (collegamento `AI` del
  Worker, quota gratuita del giorno); la ricerca sul web è **Tavily** (secret
  `TAVILY_KEY`), solo per «serve prenotare?» e per le domande in chat che
  chiedono fatti aggiornati, e a Tavily vanno solo nomi di posti, destinazione
  e date. Orari di apertura e controllo dei posti sono OpenStreetMap, senza
  modello. Nell'app non c'è nessuna chiave, e l'utente non ne deve inserire;
  le chiavi stanno solo nei secret del Worker. Ogni richiesta passa da
  **`chiediAI`**, e c'è una sola `fetch` verso il ponte: tempo massimo (30 s,
  60 con una foto o un PDF), un secondo tentativo solo per rete e 5xx, una
  richiesta per volta, «Annulla» dopo 10 s, JSON letto anche sporco, risposta
  nella lingua dell'app, dati personali tolti prima di spedire, quota finita
  detta con l'ora del ritorno. Il formato fra app e ponte resta quello di
  sempre: un campo nuovo è facoltativo, così app e ponte si pubblicano in
  qualunque ordine. Una chiamata nuova all'assistente si fa con `chiediAI`,
  mai con un `fetch` suo (`test/prova-ai.js` lo controlla; il ponte lo prova
  `test/prova-ponte-ai.js`).
- **Lingue**: ogni testo nuovo dell'interfaccia va aggiunto in tutte le lingue
  supportate (it, en, es, fr, pt) con il sistema di traduzioni esistente
  (`DIZIONARIO`; `tv()` per i testi con variabili). L'italiano resta la lingua
  di riferimento. La chiave è la frase italiana intera: un testo cucito a pezzi
  (`'Fatto: '+nome`, o un template con `${nome}` dentro) non si traduce mai.
  I plurali passano da `tp(n,'{1} giorno','{1} giorni')`, che sceglie con
  `Intl.PluralRules`: in francese lo zero va col singolare, quindi anche la
  frase al singolare ha il buco `{1}`. Una parola che in italiano non cambia
  («foto», «attività») usa la stessa frase due volte, e la traduzione porta
  le due forme separate da «|». Soldi, numeri ed elenchi di nomi passano da
  `fmtMoney`, `fmtNum` ed `elenco`, date e ore da `loc()`: mai `toFixed` o
  `'it-IT'` a mano. Dentro una funzione con `const t=T()` (il viaggio) la
  traduzione si chiama con `tv()`, non con `t()`. Quello che non si traduce
  (il logo, i nomi propri) ha `translate="no"`. `FRASI_IN_TUTTO` si conta da
  solo. `test/prova-traduzioni.js` gira tutte le schermate di `MAPPA_APP` in
  cinque lingue e boccia l'italiano rimasto, i messaggi cuciti e le frasi
  senza traduzione. Anche le frasi del Premium sono tradotte (dalla
  miglioria 11: «non toccare il Premium» riguarda come funziona, non le
  parole). Le migliaia seguono la regola di ogni lingua (`Intl`, senza
  forzarle): in spagnolo e portoghese «1234 €» e «12.345 €»/«12 345 €».
  Il portoghese dell'app è quello del Portogallo (`pt-PT`, «telemóvel»,
  «ecrã»), anche per chi ha il telefono in portoghese del Brasile.
- **Mobile-first**: ogni modifica deve funzionare bene su iPhone (Safari,
  schermo stretto, tocco).
- **Nessuna funzione nascosta.** Ogni funzione deve essere raggiungibile
  dalla Home o dalla barra in basso in al massimo 2 tocchi, tramite una voce
  con un testo leggibile, non solo un'icona o un gesto. Prima di aggiungere
  o spostare una funzione, verifica dove l'utente la cercherebbe. L'unica
  eccezione voluta è mCloud, nascosto di proposito dietro la pressione lunga
  sulla versione nel Profilo. (I bagagli stavano solo dentro la scheda del
  viaggio, e per trovarli bisognava chiederlo all'assistente: adesso sono in
  Home. A che punto è la regola, e quello che resta da decidere — le parole
  sotto le icone della barra in basso, che a 320 px non ci stanno — sta in
  `DA-FARE.md`, alla voce «Nessuna funzione nascosta». `test/prova-a-portata.js`
  tocca i percorsi come farebbe un dito.) Un tasto è da 44×44 quando lo è
  toccandolo, non sommando i numeri del foglio di stile: l'area invisibile
  (`::after`) parte dall'interno del bordo.
- **Accessibilità** (miglioria 11, `test/prova-accessibilita.js`, axe-core
  solo nelle prove): contrasto WCAG AA nei due temi — 4,5:1 il testo, 3:1 il
  testo grande, i simboli e i bordi dei campi. I colori vengono dai token:
  `--ink-faint` per il testo tenue, `--oro-su` (l'inchiostro del logo) per
  il testo sull'oro, mai bianco; `--bordo-campo` per i bordi dei campi. Un
  div o uno span con `onclick` diventa tasto da solo (`rendiAccessibile`:
  ruolo, tastiera, nome dal `title` per i tasti fatti di un simbolo); una
  scheda con dentro altri tasti no, e allora il suo tocco lo fa anche un
  tasto vero lì dentro. Un campo prende il nome dall'etichetta del suo `.fg`.
  I fogli si aprono e chiudono con `openSheet`/`closeSheet`, che li fanno
  finestre (`role="dialog"`) e portano il fuoco dentro e indietro. I messaggi
  in basso passano da `toast()` (durata in base alla lunghezza, un tocco li
  chiude, VoiceOver li legge, non coprono i tasti principali). Gli
  scorrimenti fatti da JavaScript usano `comeScorrere()`: con «Riduci
  movimento» niente scivola. Lo zoom con due dita non si blocca, e i campi
  stanno a 16 px perché iPhone non ingrandisca da solo.
- **Messaggi per chi usa l'app**: dicono cosa è successo e cosa si può fare
  (riprovare, controllare la rete). Niente guide, passi, file o nomi di
  servizi tecnici (Supabase, Worker, ponte) e niente testo grezzo del server:
  il dettaglio va in `console.log`. Unica eccezione mCloud, il pannello per
  chi ha un Supabase suo, che non ha un tasto (pressione lunga sulla versione
  nel Profilo).
- **Posizione**: mai chiesta all'apertura. La si chiede quando si usa una
  funzione che ne ha bisogno, dopo il foglio che spiega a cosa serve
  (`chiediPosizione`); chi ha già dato il permesso non vede niente di nuovo.
  Quando servono anche le notifiche (il GPS con gli avvisi vicino alle
  tappe) il foglio è uno solo (`chiediPosizioneEAvvisi`), poi le domande del
  telefono una dopo l'altra.
- **Avvisi**: passano tutti da `avvisa()`, mai da `new Notification`. Con
  il sì dentro l'app e il permesso del telefono diventano notifiche della
  service worker (`registration.showNotification`), e il tocco porta nel
  punto giusto (`notificationclick` in `sw.js`, poi `vaiAllAvviso`); senza,
  o con l'app davanti agli occhi, sono un banner nell'app. Arrivano solo con
  GeppGo aperta: ad app chiusa servono le push, cioè l'app nativa, e niente
  nell'app deve promettere di più. In Safari su iPhone senza Home le
  notifiche non si chiedono: si spiega e si rimanda alla guida della Home.
  Il ponte Capacitor (`nNotify`) resta com'è.
- **Logo**: Il logo è oro #C9962C con il tratto #14110B, con la scritta GeppGo: non va modificato.
  Sta nell'SVG dentro l'HTML (`.brand-logo`); `icona.svg` e le icone PNG in
  `icone/` (quella per la Home di iPhone e quelle del manifest) si rifanno da
  lì con `npm run icone`, e `test/prova-installazione.js` boccia le icone
  rimaste indietro. (La variabile `--green` si chiama così per storia: vale
  `#B8863C`, un ocra.)
- **Temi**: chiaro color panna (`--paper:#F6EEDD`) come predefinito, «Tema
  scuro» come dark mode. «Cielo» non è un tema: è la veste della home, con la
  foto del cielo in cima. La barra di stato del telefono (`theme-color`)
  prende il colore della testata del tema scelto (`coloreBarra`); finché c'è
  la schermata d'apertura resta `#14110B`, come `background_color` e
  `theme_color` del manifest. Su iPhone `apple-mobile-web-app-status-bar-style`
  resta `default`: con `black-translucent` le scritte del telefono sono
  bianche e sul panna sparirebbero.
- **Link di Google Maps**: si leggono tutti con `leggiLinkMappa` (Scopri,
  ricerca e foglio degli hotel, mail dell'hotel, indirizzo di una tappa, tasto
  Condividi). Quelli corti li apre la funzione `link-mappe`, che segue i
  rimandi solo dentro Google Maps, legge «continue» dalla pagina dei consensi,
  si ferma a 8 secondi e ha un limite di richieste (le regole in
  `link-mappe/regole.mjs`, provate da `test/prova-installazione.js`). Senza
  coordinate ma col nome, il posto lo cerca la ricerca di sempre. Ogni mappa
  porta «© OpenStreetMap» col link ai diritti (`dirittiMappa`), in un angolo
  senza tasti.

## Due regole che non si toccano

- **Le foto si vedono solo dentro il viaggio.** Niente bacheca, niente
  indirizzi pubblici. È la difesa più solida che il progetto ha, e il motivo
  per cui il resto delle tutele regge. Il perché sta in `DA-FARE.md`.
- **Il limite del piano gratuito conta solo i viaggi creati dall'utente.**
  Essere invitati è libero: l'app si diffonde perché chi organizza invita
  cinque persone, e far pagare loro il pedaggio spegne l'unica crescita che
  c'è.

## A ogni modifica dell'app

1. Aggiorna la versione, sempre in questi due posti e solo in questi:
   - `VERSIONE_APP` in `Index 2.1.html`: data e ora della modifica (ora
     italiana), formato `'AAAA-MM-GG HH:MM'`. L'ora serve: due versioni dello
     stesso giorno devono leggersi diverse;
   - `CACHE_NAME` in `sw.js`: `geppgo-shell-vNN`, con NN alzato di uno. Se
     resta uguale, il telefono continua a usare la copia vecchia dell'app.

   `test/prova-versione.js` controlla il formato e che nessuna «build rNN»
   ricompaia. Le modifiche che non toccano l'app (solo documenti o prove) non
   cambiano versione.
2. Controlla la sintassi degli script inline, uno per uno (insieme darebbero
   errori finti di variabili dichiarate due volte). Non fare commit se fallisce:
   ```sh
   D=$(mktemp -d) && node -e 'const fs=require("fs");let n=0;for(const m of fs.readFileSync(process.argv[1],"utf8").matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g))fs.writeFileSync(process.argv[2]+"/b"+(++n)+".js",m[1])' "Index 2.1.html" "$D" && for f in "$D"/*.js; do node --check "$f" || exit 1; done
   ```
3. Verifica che funzioni, ID ed elementi citati dal codice esistano davvero, e
   che i `div` siano bilanciati (`grep -o '<div\b'` e `grep -o '</div>'`
   devono dare lo stesso numero).
4. Prima di ogni commit verifica con Playwright (`test/browser.js`) le
   funzioni toccate: aprile, toccale come farebbe una persona e guarda che in
   console non compaiano errori. `test/browser.js` blocca la rete, quindi le
   librerie da CDN risultano assenti: quelle che servono vanno servite in
   locale, come fanno le prove con Leaflet. Per l'avvio, la service worker e
   la rete lenta c'è `test/rete-finta.js`: app in http locale, CDN servite
   dai pacchetti npm installati.
5. Lancia **`npm test`** (vedi `test/README.md`; gira anche da solo a ogni
   push). Prima di dire che una modifica funziona, la si prova — e quando si
   corregge un guasto, la prova va fatta fallire sul codice vecchio, altrimenti
   non dimostra niente.
6. Modifiche mirate: non riscrivere né riformattare parti del file che non
   c'entrano.
7. Se cambia l'interfaccia, aggiorna `MAPPA_APP` (dentro l'HTML): è la mappa
   che l'assistente dell'app usa per rispondere all'utente.
8. Se l'app inizia a raccogliere un dato nuovo o a parlare con un servizio
   nuovo, aggiorna `privacy.html` e `PRIVACY-STORE.md`: devono restare **veri**.
   Una prova confronta i servizi chiamati dal codice con quelli dichiarati.
   Le quattro traduzioni (`privacy-en/es/fr/pt.html`) si cambiano insieme
   all'italiano: devono dire la stessa cosa, e una prova controlla almeno che
   abbiano le stesse sezioni.
9. A fine lavoro, riassumi in poche righe cosa hai cambiato e la nuova
   versione.

## Come si lavora

- **Tutto va su `main` senza chiedere.** Ramo di lavoro → PR → squash merge →
  il ramo si riparte da `origin/main` (`git checkout -B <ramo> origin/main`,
  poi force-with-lease), altrimenti le PR successive vanno in conflitto.
- I commenti sono **in italiano** e spiegano *perché* una cosa è fatta così,
  non *cosa* fa. Si scrive come parla l'app: piano, senza gergo.
- Risposte concise e dirette; se una richiesta è ambigua, una sola domanda
  prima di procedere.
- Quando cambia una decisione di progetto, aggiorna questo file.
