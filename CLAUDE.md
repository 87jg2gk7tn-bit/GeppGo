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
  `privacy.html`, `index.html`, le funzioni Supabase in `supabase/functions/`,
  le prove in `test/`. Le librerie arrivano da CDN (Leaflet, Sortable, jsQR,
  ZXing, bwip-js, supabase-js).
- **Backend: Supabase** — account, sincronizzazione dei viaggi, foto, la
  funzione `vicini`, «A raccolta». Senza account i dati restano solo sul
  telefono. `supabase-schema.sql` è la verità sul database: si rilancia quante
  volte si vuole senza danni. Prima di modificare un progetto Supabase vero si
  guarda com'è fatto (`test/guarda-il-database.sql`).
- **AI**: passa dal Worker Cloudflare `geppgo-ai`, che tiene la chiave e parla
  con Gemini (`GUIDA-AI.md`). Nell'app non c'è nessuna chiave, e l'utente non
  ne deve inserire.
- **Lingue**: ogni testo nuovo dell'interfaccia va aggiunto in tutte le lingue
  supportate (it, en, es, fr, pt) con il sistema di traduzioni esistente
  (`DIZIONARIO`; `tv()` per i testi con variabili). L'italiano resta la lingua
  di riferimento. La chiave è la frase italiana intera: un testo cucito a pezzi
  (`'Fatto: '+nome`) non si traduce mai.
- **Mobile-first**: ogni modifica deve funzionare bene su iPhone (Safari,
  schermo stretto, tocco).
- **Messaggi per chi usa l'app**: dicono cosa è successo e cosa si può fare
  (riprovare, controllare la rete). Niente guide, passi, file o nomi di
  servizi tecnici (Supabase, Worker, ponte) e niente testo grezzo del server:
  il dettaglio va in `console.log`. Unica eccezione mCloud, il pannello per
  chi ha un Supabase suo, che non ha un tasto (pressione lunga sulla versione
  nel Profilo).
- **Posizione**: mai chiesta all'apertura. La si chiede quando si usa una
  funzione che ne ha bisogno, dopo il foglio che spiega a cosa serve
  (`chiediPosizione`); chi ha già dato il permesso non vede niente di nuovo.
- **Logo**: oro `#C9962C` con tratto `#14110B`, nell'SVG dentro l'HTML. Non si
  cambia senza che sia chiesto. (La variabile `--green` si chiama così per
  storia: vale `#B8863C`, un ocra.)
- **Temi**: chiaro color panna (`--paper:#F6EEDD`) come predefinito, «Tema
  scuro» come dark mode. «Cielo» non è un tema: è la veste della home, con la
  foto del cielo in cima.

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
   locale, come fanno le prove con Leaflet.
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
