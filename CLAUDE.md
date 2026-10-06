# GeppGo — regole di progetto

## Cos'è

PWA per organizzare viaggi di gruppo, in un unico file HTML: **`Index 2.1.html`**
(~19.700 righe; `index.html` rimanda solo lì). JavaScript vanilla, niente
framework, niente build step. Interfaccia scritta in italiano; l'app si traduce
da sola in inglese, spagnolo, francese e portoghese seguendo la lingua del
telefono (i dizionari stanno dentro l'HTML). Sviluppatore singolo che lavora da
iPhone. Hosting statico su GitHub Pages: **ogni push su `main` va online**
(i rami no), quindi su `main` arriva solo codice verificato.

La versione è la costante **`VERSIONE_APP`** (data e ora, `'AAAA-MM-GG HH:MM'`):
il Profilo la mostra come «GeppGo · …» e «Versione del …». Quando è stato
scritto questo file era `2026-09-29 12:00`; quella vera è sempre nel codice.
La vecchia «build rXX» non esiste più: era scritta a mano e non la aggiornava
nessuno.

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
- **Mobile-first**: ogni modifica deve funzionare bene su iPhone (Safari,
  schermo stretto, tocco).
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

1. Alza `VERSIONE_APP` (data e ora di adesso) e il numero di `CACHE_NAME` in
   `sw.js` (`geppgo-shell-vNN`): se resta uguale, il telefono tiene la copia
   vecchia.
2. Controlla la sintassi degli script inline, uno per uno (insieme darebbero
   errori finti di variabili dichiarate due volte). Non fare commit se fallisce:
   ```sh
   D=$(mktemp -d) && node -e 'const fs=require("fs");let n=0;for(const m of fs.readFileSync(process.argv[1],"utf8").matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g))fs.writeFileSync(process.argv[2]+"/b"+(++n)+".js",m[1])' "Index 2.1.html" "$D" && for f in "$D"/*.js; do node --check "$f" || exit 1; done
   ```
3. Verifica che funzioni, ID ed elementi citati dal codice esistano davvero, e
   che i `div` siano bilanciati (`grep -o '<div\b'` e `grep -o '</div>'`
   devono dare lo stesso numero).
4. Lancia **`npm test`** (vedi `test/README.md`; gira anche da solo a ogni
   push). Prima di dire che una modifica funziona, la si prova — e quando si
   corregge un guasto, la prova va fatta fallire sul codice vecchio, altrimenti
   non dimostra niente.
5. Modifiche mirate: non riscrivere né riformattare parti del file che non
   c'entrano.
6. Se cambia l'interfaccia, aggiorna `MAPPA_APP` (dentro l'HTML): è la mappa
   che l'assistente dell'app usa per rispondere all'utente.
7. Se l'app inizia a raccogliere un dato nuovo o a parlare con un servizio
   nuovo, aggiorna `privacy.html` e `PRIVACY-STORE.md`: devono restare **veri**.
   Una prova confronta i servizi chiamati dal codice con quelli dichiarati.
8. A fine lavoro, riassumi in poche righe cosa hai cambiato e la nuova
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
