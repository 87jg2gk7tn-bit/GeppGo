-- ============================================================================
--  GeppGo — il calendario che si aggiorna (20 ottobre 2026, miglioria 13b)
-- ============================================================================
--  COME SI USA: Supabase → SQL Editor → New query → incolla tutto questo
--  file → Run. Deve finire con «Success. No rows returned».
--  Si può rilanciare quante volte si vuole: crea solo quello che manca e
--  riscrive le regole sopra a quelle vecchie. Lo stesso testo sta in fondo a
--  supabase-schema.sql: rilanciare tutto lo schema va bene uguale, ed è la
--  strada più sicura se questo file desse un errore.
--
--  Fa una cosa: la tabella dei link del calendario (un codice per persona e
--  per viaggio) e la funzione che il calendario legge col codice.
--
--  Finché non lo si lancia, l'app funziona lo stesso: nel foglio del
--  calendario dice che per ora non c'è, e offre il file .ics di sempre.
--  Serve anche la funzione «calendario», che si pubblica da sola con
--  .github/workflows/funzioni.yml al primo push su main che la tocca.
-- ============================================================================

-- ════════════════════════════════════════════════════════════════════════════
--  IL CALENDARIO CHE SI AGGIORNA (miglioria 13b)
-- ════════════════════════════════════════════════════════════════════════════
--  Il calendario del telefono si iscrive a un indirizzo e lo riscarica da
--  solo, ogni tanto: le tappe cambiate nel viaggio cambiano anche li'.
--  Quell'indirizzo lo serve la funzione «calendario»
--  (supabase/functions/calendario), e il calendario del telefono non manda
--  nessuna chiave: la protezione e' il codice dentro il link, lungo e a caso.
--  Chi ha il link vede l'itinerario, e l'app lo dice.
--
--  Fatta cosi', e non altrimenti:
--  - un codice per persona e per viaggio: ognuno ha il suo link, e spegnere
--    il proprio non spegne quello degli altri;
--  - il codice lo sceglie il database, mai il telefono (due gen_random_uuid:
--    244 bit a caso), e non si cambia: un link nuovo e' una riga nuova;
--  - ognuno vede, crea e cancella solo le sue righe, e solo per un viaggio di
--    cui fa parte; della riga si cambia solo la lingua del calendario;
--  - uscendo dal viaggio il link smette di funzionare: la funzione che lo
--    legge controlla ogni volta che la persona sia ancora dentro, e in piu'
--    la riga se ne va (calendari_fuori);
--  - se ne va col viaggio e con l'account;
--  - dalla tabella si legge solo per codice, e solo dalla funzione: chi ha la
--    chiave pubblica dell'app non puo' chiamare calendario_per_codice.
create table if not exists public.calendari (
  codice    text        primary key,
  user_id   uuid        not null default auth.uid()
                        references auth.users(id) on delete cascade,
  trip_id   uuid        not null references public.trips(id) on delete cascade,
  lingua    text        not null default 'it'
                        check (lingua in ('it', 'en', 'es', 'fr', 'pt')),
  creato_il timestamptz not null default now(),
  constraint calendari_uno unique (user_id, trip_id)
);
create index if not exists calendari_trip_idx on public.calendari(trip_id);

-- Il codice e l'ora li mette il database, qualunque cosa mandi il telefono:
-- un codice scelto da fuori potrebbe essere corto, o uguale a uno che
-- qualcuno ha visto. La persona invece no: chi ne manda un'altra viene
-- respinto dalla regola qui sotto, invece di ritrovarsi un link suo senza
-- averlo chiesto.
create or replace function public.calendari_codice()
returns trigger
language plpgsql
as $$
begin
  new.codice := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  new.creato_il := now();
  return new;
end;
$$;
drop trigger if exists calendari_codice_trg on public.calendari;
create trigger calendari_codice_trg
  before insert on public.calendari
  for each row execute function public.calendari_codice();

alter table public.calendari enable row level security;
revoke all on public.calendari from anon, authenticated;
grant select, insert, delete on public.calendari to authenticated;
grant update (lingua) on public.calendari to authenticated;

drop policy if exists cal_select on public.calendari;
create policy cal_select on public.calendari
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists cal_insert on public.calendari;
create policy cal_insert on public.calendari
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_trip_member(trip_id));

drop policy if exists cal_update on public.calendari;
create policy cal_update on public.calendari
  for update to authenticated
  using      (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists cal_delete on public.calendari;
create policy cal_delete on public.calendari
  for delete to authenticated
  using (user_id = auth.uid());

-- Chi esce dal viaggio (da solo, o tolto da un admin) perde il suo link.
create or replace function public.calendari_fuori()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.calendari where trip_id = old.trip_id and user_id = old.user_id;
  return old;
end;
$$;
drop trigger if exists calendari_fuori_trg on public.trip_members;
create trigger calendari_fuori_trg
  after delete on public.trip_members
  for each row execute function public.calendari_fuori();

-- Quello che la funzione «calendario» legge: il viaggio di quel codice, se
-- il codice c'e' e chi l'ha fatto e' ancora nel viaggio. Altrimenti niente,
-- e la funzione risponde «non c'e'» (sbagliato, spento o uscito: la
-- risposta e' la stessa, e non dice quale dei tre).
create or replace function public.calendario_per_codice(p_codice text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('trip_id', t.id, 'lingua', c.lingua, 'data', t.data, 'aggiornato_il', t.updated_at)
    from public.calendari c
    join public.trips t on t.id = c.trip_id
   where c.codice = p_codice
     and exists (select 1 from public.trip_members m
                  where m.trip_id = c.trip_id and m.user_id = c.user_id);
$$;
revoke all on function public.calendario_per_codice(text) from public;
do $$ begin
  revoke all on function public.calendario_per_codice(text) from anon, authenticated;
  -- su Supabase la funzione la chiama con la sua chiave di servizio; nel
  -- database delle prove quel ruolo non c'e'
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.calendario_per_codice(text) to service_role;
  end if;
end $$;
