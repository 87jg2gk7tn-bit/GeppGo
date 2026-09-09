-- ============================================================================
--  GeppGo - AGGIORNAMENTO del 9 settembre 2026
-- ============================================================================
--  Da incollare in Supabase: SQL Editor -> New query -> incolla -> Run.
--
--  Contiene SOLO quello che manca rispetto all'ultima volta, cioe' due cose:
--    1. la colonna "percorso_mini", che porta le miniature delle foto
--       (senza, ogni telefono continua a scaricarsi ogni foto intera);
--    2. la tabella "raccolte", che fa funzionare il tasto "A raccolta"
--       (senza, il tasto c'e' ma dice che manca la tabella).
--
--  Si puo' lanciare piu' volte senza danni: se una cosa c'e' gia', viene
--  saltata. Alla fine deve dire "Success". Se compare un errore in rosso,
--  fermati e mandalo: vuol dire che si e' fermato a meta'.
-- ============================================================================


-- -- 1 - Le miniature delle foto ----------------------------------------------------------------------
--  L'indirizzo della copia piccola, accanto a quello della foto piena. Sta
--  fuori dal "create table" apposta: su una tabella che esiste gia', il create
--  non torna indietro ad aggiungere una colonna.
--  Resta vuota per le foto caricate prima di oggi: per quelle l'app continua a
--  scaricare la foto piena, come faceva.
alter table public.foto add column if not exists percorso_mini text;


-- -- 2 - A raccolta ----------------------------------------------------------------------
create table if not exists public.raccolte (
  id          uuid             primary key default gen_random_uuid(),
  trip_id     uuid             not null references public.trips(id) on delete cascade,
  chiamata_da uuid             not null references auth.users(id)   on delete cascade,
  -- Il nome di chi chiama viaggia con la chiamata: chi la riceve deve poter
  -- leggere "Marco chiama a raccolta" anche prima che l'elenco dei compagni
  -- sia arrivato.
  nome        text,
  lat         double precision not null,
  lng         double precision not null,
  nota        text,
  creata_il   timestamptz      not null default now(),
  scade_il    timestamptz      not null default now() + interval '2 hours'
);
create index if not exists raccolte_trip_idx on public.raccolte(trip_id);

--  Le due ore non sono un valore di partenza che si puo' riscrivere: sono un
--  limite. Senza questo, chi chiama potrebbe mettere una scadenza fra un anno
--  e lasciare in giro per un anno il posto dove si trovava - e la privacy
--  policy direbbe una cosa falsa. Sta in un blocco a parte perche' su un
--  database dove la tabella c'e' gia' il create non tornerebbe ad aggiungerlo.
do $$
begin
  alter table public.raccolte
    add constraint raccolte_scadenza check (scade_il <= creata_il + interval '2 hours');
exception
  when duplicate_object then null;  -- c'e' gia': va bene cosi'
end;
$$;

alter table public.raccolte enable row level security;
revoke all on public.raccolte from anon;
grant select, insert, delete on public.raccolte to authenticated;

-- La leggono i compagni di quel viaggio, e solo finche' non e' scaduta. La
-- scadenza sta qui dentro apposta: se un giorno l'app si dimenticasse di
-- controllarla, la posizione resterebbe comunque invisibile.
drop policy if exists racc_select on public.raccolte;
create policy racc_select on public.raccolte
  for select to authenticated
  using (
    scade_il > now()
    and exists (
      select 1 from public.trip_members m
      where m.trip_id = raccolte.trip_id and m.user_id = auth.uid()
    )
  );

-- La fa un admin, a nome proprio. "A nome proprio" non e' un dettaglio:
-- senza, chiunque potrebbe mandare in giro una chiamata firmata da un altro.
drop policy if exists racc_insert on public.raccolte;
create policy racc_insert on public.raccolte
  for insert to authenticated
  with check (
    chiamata_da = auth.uid()
    and exists (
      select 1 from public.trip_members m
      where m.trip_id = raccolte.trip_id and m.user_id = auth.uid()
        and m.ruolo = 'admin'
    )
  );

-- Si annulla: chi l'ha fatta, o un altro admin. Una chiamata partita per
-- sbaglio deve potersi ritirare subito, senza aspettare due ore.
drop policy if exists racc_delete on public.raccolte;
create policy racc_delete on public.raccolte
  for delete to authenticated
  using (
    chiamata_da = auth.uid()
    or exists (
      select 1 from public.trip_members m
      where m.trip_id = raccolte.trip_id and m.user_id = auth.uid()
        and m.ruolo = 'admin'
    )
  );

-- Una chiamata non si riscrive: se il punto cambia, se ne fa un'altra. Cosi'
-- nessuna riga puo' diventare un puntino che si muove.
drop policy if exists racc_update on public.raccolte;


-- -- 3 - Cancellare l'account porta via anche le chiamate ----------------------------------------------------------------------
--  Dentro una chiamata c'e' un posto in cui sei stato: se ne va con te.
create or replace function public.elimina_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  io         uuid := auth.uid();
  v_trip     uuid;
  successore uuid;
begin
  if io is null then
    raise exception 'serve un account';
  end if;

  for v_trip in
      select id from public.trips where owner = io
      union
      select trip_id from public.trip_members where user_id = io
  loop
    -- Chi resta, e a chi tocca: prima un altro admin, se c'e'; altrimenti chi
    -- e' nel viaggio da piu' tempo.
    select m.user_id into successore
      from public.trip_members m
     where m.trip_id = v_trip and m.user_id <> io
     order by (m.ruolo = 'admin') desc, m.joined_at asc
     limit 1;

    if successore is null then
      delete from public.trips where id = v_trip;
    else
      if exists (select 1 from public.trip_members
                  where trip_id = v_trip and user_id = io and ruolo = 'admin') then
        update public.trip_members set ruolo = 'admin'
         where trip_id = v_trip and user_id = successore;
      end if;
      if exists (select 1 from public.trips where id = v_trip and owner = io) then
        update public.trips set owner = successore where id = v_trip;
      end if;
    end if;
  end loop;

  delete from public.foto        where caricata_da = io;
  -- Anche le chiamate a raccolta fatte da te: dentro c'e' un posto in cui sei
  -- stato, e cancellare l'account vuol dire cancellare anche quello.
  delete from public.raccolte    where chiamata_da = io;
  delete from public.trip_members where user_id    = io;
  delete from auth.users         where id          = io;
end;
$$;

-- -- 4 - Il tempo reale sulle chiamate ----------------------------------------------------------------------
--  Senza questo la chiamata arriverebbe al giro di sincronizzazione dopo, e
--  una chiamata in ritardo e' gente che ti aspetta in piazza.
do $$
begin
  alter publication supabase_realtime add table public.raccolte;
exception
  when duplicate_object then null;   -- c'e' gia': va bene cosi'
end;
$$;


-- ============================================================================
--  Finito. Per controllare che sia andata:
--    - aggiungi una foto: sotto deve leggersi
--      "salvata anche nel cloud: la vedono i compagni di viaggio";
--    - in un viaggio condiviso con qualcun altro, da admin, in home deve
--      comparire il tasto "A raccolta".
-- ============================================================================
