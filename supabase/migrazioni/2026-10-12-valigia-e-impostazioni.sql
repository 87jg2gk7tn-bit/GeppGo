-- ============================================================================
--  GeppGo — la valigia e le impostazioni nel cloud (12 ottobre 2026)
-- ============================================================================
--  COME SI USA: Supabase → SQL Editor → New query → incolla tutto questo
--  file → Run. Deve finire con «Success. No rows returned».
--  Si può rilanciare quante volte si vuole: crea solo quello che manca e
--  riscrive le regole sopra a quelle vecchie. Lo stesso testo sta in fondo a
--  supabase-schema.sql, quindi rilanciare tutto lo schema va bene uguale.
--
--  Finché non lo si lancia, l'app tiene valigia e impostazioni sul telefono
--  come prima, e a schermo non dice niente: se ne accorge dalla risposta del
--  cloud («la tabella non c'è») e riprova alla prossima apertura.
-- ============================================================================

-- ════════════════════════════════════════════════════════════════════════════
--  LA VALIGIA E LE IMPOSTAZIONI, PRIVATE
-- ════════════════════════════════════════════════════════════════════════════
--  La valigia è personale: non sta dentro il viaggio, che vedono tutti i
--  compagni. Prima restava su un telefono solo, e cambiando telefono
--  spariva. Qui ognuno tiene la sua, e le impostazioni che sono sue e non
--  del telefono (il navigatore, la qualità delle foto, gli avvisi, il tema,
--  il proprio nome).
--
--  Una riga per cosa: chiave = 'impostazioni', oppure 'valigia:<id del
--  viaggio>'. Dentro, il contenuto con l'ora di ogni modifica: l'app unisce
--  due telefoni voce per voce, e al database non serve conoscerne la forma.
--
--  Fatta così, e non altrimenti:
--  - ogni riga è di una persona sola, e solo lei la legge e la scrive. Non
--    c'è nessuna regola che apra le righe ai compagni di viaggio;
--  - una valigia si lega solo a un viaggio di cui si fa parte;
--  - se ne va da sola: cancellando l'account (on delete cascade dagli
--    utenti, quindi anche da elimina_account) e cancellando il viaggio;
--  - non è un magazzino: una riga non supera i 256 KB.
create table if not exists public.dati_personali (
  user_id       uuid        not null default auth.uid()
                            references auth.users(id) on delete cascade,
  chiave        text        not null,
  trip_id       uuid        references public.trips(id) on delete cascade,
  dati          jsonb       not null default '{}'::jsonb,
  aggiornato_il timestamptz not null default now(),
  primary key (user_id, chiave),
  constraint dati_personali_chiave check (
    (chiave = 'impostazioni' and trip_id is null)
    or (trip_id is not null and chiave = 'valigia:' || trip_id::text)
  ),
  constraint dati_personali_peso check (pg_column_size(dati) <= 262144)
);
create index if not exists dati_personali_trip_idx on public.dati_personali(trip_id);

alter table public.dati_personali enable row level security;
revoke all on public.dati_personali from anon;
grant select, insert, update, delete on public.dati_personali to authenticated;

-- LEGGERE: solo le proprie righe.
drop policy if exists pers_select on public.dati_personali;
create policy pers_select on public.dati_personali
  for select to authenticated
  using (user_id = auth.uid());

-- SCRIVERE: a nome proprio, e la valigia solo di un viaggio in cui si è.
-- Senza la seconda condizione si potrebbe appendere una riga a un viaggio
-- altrui, solo per sapere se quell'id esiste.
drop policy if exists pers_insert on public.dati_personali;
create policy pers_insert on public.dati_personali
  for insert to authenticated
  with check (user_id = auth.uid()
              and (trip_id is null or public.is_trip_member(trip_id)));

drop policy if exists pers_update on public.dati_personali;
create policy pers_update on public.dati_personali
  for update to authenticated
  using      (user_id = auth.uid())
  with check (user_id = auth.uid()
              and (trip_id is null or public.is_trip_member(trip_id)));

drop policy if exists pers_delete on public.dati_personali;
create policy pers_delete on public.dati_personali
  for delete to authenticated
  using (user_id = auth.uid());
