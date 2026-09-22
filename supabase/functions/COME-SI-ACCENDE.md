# Come si accende il ponte delle ricerche «qui intorno»

Finché non si fanno questi due passi, il ponte non c'è e l'app continua a
chiamare OpenStreetMap direttamente — come ha sempre fatto. **Non si rompe
niente**: si resta solo senza il cuscinetto che serve quando gli utenti
diventano tanti.

## Perché serve

Overpass e Nominatim li tengono su dei volontari, e le loro regole dicono che
un'app diffusa non deve chiamarli da ogni telefono. Con GeppGo sullo store
sarebbero migliaia di telefoni alla stessa porta, ognuno con la sua identità,
e la porta si chiude — per tutti, non solo per chi ha esagerato.

Col ponte in mezzo cambiano tre cose:

1. **La memoria è di tutti.** La risposta si tiene da parte una volta sola.
   In una città dove l'app la usano in cento, le chiamate verso l'esterno non
   sono cento: sono una.
2. **Verso Overpass siamo uno solo**, con un nome e un contatto
   nell'intestazione — che è quello che le loro regole chiedono, e che da
   dentro un browser non si può nemmeno fare (il telefono non può scrivere il
   proprio `User-Agent`; la funzione sì).
3. **Il giorno che si cambia fornitore si cambia qui.** Se un domani si passa
   a un servizio a pagamento (Geoapify, HERE, Foursquare), si riscrive questo
   file e basta: l'app non se ne accorge e non serve pubblicare una versione
   nuova sugli store.

## 1. La tabella

Rilancia `supabase-schema.sql` sul progetto: in fondo c'è
`public.vicini_cache`, con le regole accese e nessuna politica — cioè da fuori
non ci entra nessuno. Lo schema si rilancia quante volte si vuole senza danni.

## 2. La funzione

Con la CLI di Supabase, dalla radice del progetto:

**Dal telefono, senza terminale** — è il modo consigliato, e si fa una volta
sola:

1. Su **supabase.com** → in alto a destra la tua foto → **Account Tokens** →
   *Generate new token*, chiamalo `GitHub`. Copialo: te lo mostra una volta.
2. Su **github.com**, nel repo → **Settings** → *Secrets and variables* →
   **Actions** → *New repository secret*. Nome: `SUPABASE_ACCESS_TOKEN`,
   valore: il token. Salva.
3. Sempre su GitHub → **Actions** → nella colonna a sinistra **Funzioni** →
   **Run workflow**.

Da quel momento le funzioni si ripubblicano **da sole** ogni volta che si
tocca un file dentro `supabase/functions/`. Il token resta nei segreti di
GitHub: non entra nel codice e non lo vede chi legge il repo.

**Da computer**, se preferisci:

```
supabase functions deploy vicini
supabase functions deploy geo
```

Sono **due** funzioni e condividono la stessa tabella: `vicini` per le
ricerche «qui intorno» (Overpass), `geo` per gli indirizzi (Nominatim e
Photon). La seconda è la più urgente: Nominatim è usato in diciassette punti
dell'app — fra cui la ricerca degli alberghi — e permette una richiesta al
secondo.

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` **ci sono già** dentro le Edge
Functions: non vanno messe a mano da nessuna parte, e soprattutto **non vanno
mai messe dentro l'app**. La chiave di servizio salta tutte le regole del
database: nell'app sarebbe la chiave di casa lasciata nella toppa.

## Come si controlla che stia funzionando

```
curl -s -X POST "https://<progetto>.supabase.co/functions/v1/vicini" \
  -H "apikey: <chiave anon>" -H "Content-Type: application/json" \
  -d '{"q":"[out:json][timeout:20];(nwr[\"amenity\"=\"atm\"](around:1500,45.592,9.228););out center 150;"}' \
  | head -c 300
```

In fondo alla risposta c'è `"da":"overpass"` la prima volta e `"da":"memoria"`
dalla seconda in poi. Se la seconda volta dice ancora `overpass`, la tabella
non c'è o non è raggiungibile.

## Cosa NON fa

- **Non è un Overpass aperto.** Accetta solo la forma esatta di domanda che
  l'app produce: `nwr[...](around:R,lat,lng);`, giro massimo 25 km, al massimo
  dodici ricerche. La regola sta in `domanda.mjs` — in un file a sé apposta,
  perché qui non c'è Deno e una regola di sicurezza che non si riesce a
  provare è una regola di cui non si sa niente. La prova è
  `test/prova-ponte.js`.
- **Non sa dove sei.** Il telefono arrotonda il punto a una griglia di circa
  duecento metri prima di mandare la domanda. Non arriva nessun nome, nessun
  account, nessun identificativo, e non si scrive nessun registro di chi ha
  chiesto cosa.

## Quanto costa

**Niente.** Il ponte non sostituisce i servizi gratuiti con servizi a
pagamento: li rende sostenibili mettendoci davanti una memoria condivisa. Sta
tutto dentro il piano gratuito di Supabase — funzioni e database che ci sono
già.

Il tetto da tenere d'occhio, quando gli utenti cresceranno, è il numero di
**invocazioni delle Edge Functions** (500.000 al mese sul piano gratuito).
Una ricerca = una invocazione, e quasi tutte vengono servite dalla memoria
senza uscire: sono circa sedicimila ricerche al giorno prima di doversene
preoccupare. La tabella pesa pochissimo — sono risposte di mappa, testo — e
si pulisce da sola dopo trenta giorni.

## Quando questo non basterà più

Resta scoperto **`tile.openstreetmap.org`**, lo sfondo della mappa: la loro
politica vieta le app ad alto traffico, e le tessere **non** si possono
mettere in una memoria condivisa come le risposte — sono immagini, tante, e
le si scarica mentre si scorre. Lì la strada è un fornitore di tessere
(Protomaps, MapTiler, Stadia): alcuni hanno un piano gratuito generoso, ma è
l'unico punto dove prima o poi servirà una scelta diversa dal «gratis e
basta».
