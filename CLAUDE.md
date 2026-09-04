# GeppGo

App di viaggio per gruppi. Un solo file: `Index 2.1.html` (~12.000 righe).

## Leggi prima di tutto

**`DA-FARE.md`** — a che punto è il progetto, cosa manca, e le cose scoperte a
caro prezzo che non conviene riscoprire. Le sessioni non si ricordano fra loro:
quel file è la memoria.

## Come si lavora

- **Tutto va su `main` senza chiedere.** Ramo di lavoro → PR → squash merge →
  il ramo si riparte da `origin/main` (`git checkout -B <ramo> origin/main`,
  poi force-with-lease), altrimenti le PR successive vanno in conflitto.
- I commenti sono **in italiano** e spiegano *perché* una cosa è fatta così,
  non *cosa* fa. Si scrive come parla l'app: piano, senza gergo.
- Le prove stanno in **`test/`** e si lanciano da lì (vedi `test/README.md`).
  Prima di dire che una modifica funziona, la si prova — e quando si corregge
  un guasto, la prova va fatta fallire sul codice vecchio, altrimenti non
  dimostra niente.
- `supabase-schema.sql` è la verità sul database: si rilancia quante volte si
  vuole senza danni. Prima di modificare un progetto Supabase vero, si guarda
  com'è fatto (`test/guarda-il-database.sql`).
- `MAPPA_APP`, dentro l'HTML, è la mappa che l'assistente dell'app usa per
  rispondere all'utente: va aggiornata quando l'interfaccia cambia.
- `privacy.html` deve restare **vera**: se l'app inizia a raccogliere un dato
  nuovo o a parlare con un servizio nuovo, va aggiornata lì e in
  `PRIVACY-STORE.md`. C'è una prova che confronta i servizi chiamati dal
  codice con quelli dichiarati, e fallisce se ne compare uno non dichiarato.

## Due regole che non si toccano

- **Le foto si vedono solo dentro il viaggio.** Niente bacheca, niente
  indirizzi pubblici. È la difesa più solida che il progetto ha, e il motivo
  per cui il resto delle tutele regge. Il perché sta in `DA-FARE.md`.
- **Il limite del piano gratuito conta solo i viaggi creati dall'utente.**
  Essere invitati è libero: l'app si diffonde perché chi organizza invita
  cinque persone, e far pagare loro il pedaggio spegne l'unica crescita che
  c'è.
