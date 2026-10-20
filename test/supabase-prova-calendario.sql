-- Prove sul calendario che si aggiorna (miglioria 13b).
--
-- Le promesse:
-- - il link del calendario e' di una persona: il codice lo sceglie il
--   database, gli altri non lo vedono e non ne creano a nome suo;
-- - un link si fa solo per un viaggio di cui si fa parte, uno per persona e
--   per viaggio;
-- - la funzione che il calendario chiama (calendario_per_codice) risponde
--   col viaggio solo per un codice giusto, ancora acceso, di una persona
--   ancora nel viaggio; e da fuori, con la chiave pubblica, non si chiama.
--
-- Tre persone. Anna crea il viaggio, Bruno e' un compagno, Carla
-- un'estranea.

\set ON_ERROR_STOP on
\pset pager off

create temp table esito(n text, ok boolean, nota text);
create or replace function pg_temp.prova(p_nome text, p_ok boolean, p_nota text default '')
returns void language sql as $$ insert into esito values (p_nome, p_ok, p_nota); $$;

create or replace function pg_temp.sono(p_uid uuid) returns void
language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text,''), false);
  if p_uid is null then execute 'set role anon'; else execute 'set role authenticated'; end if;
end $$;
create or replace function pg_temp.torno_admin() returns void
language plpgsql as $$ begin execute 'reset role'; end $$;

truncate public.trips cascade;
delete from public.calendari;
delete from auth.users;
insert into auth.users(id,email) values
  ('11111111-1111-1111-1111-111111111111','anna@x.it'),
  ('22222222-2222-2222-2222-222222222222','bruno@x.it'),
  ('33333333-3333-3333-3333-333333333333','carla@x.it');

do $$
declare
  anna  uuid := '11111111-1111-1111-1111-111111111111';
  bruno uuid := '22222222-2222-2222-2222-222222222222';
  carla uuid := '33333333-3333-3333-3333-333333333333';
  v_trip uuid; v_code text; v_n int; v_txt text; v_d jsonb;
  c_anna text; c_bruno text; c_vecchio text;
begin

  -- ── il viaggio di Anna, con Bruno dentro ─────────────────────────────────
  perform pg_temp.sono(anna);
  insert into public.trips(owner, data) values (anna, '{"name":"Giappone","days":[]}'::jsonb)
    returning id, invite_code into v_trip, v_code;
  insert into public.trip_members(trip_id,user_id,member_name) values (v_trip, anna, 'Anna');
  perform pg_temp.torno_admin();
  perform pg_temp.sono(bruno); perform public.join_trip(v_trip, v_code); perform pg_temp.torno_admin();

  -- ── il link di Anna: il codice lo sceglie il database ────────────────────
  perform pg_temp.sono(anna);
  insert into public.calendari(trip_id, codice, lingua)
    values (v_trip, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'en')
    returning codice into c_anna;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('chi e'' nel viaggio crea il suo link del calendario', c_anna is not null, coalesce(length(c_anna)::text,'niente'));
  perform pg_temp.prova('il codice lo sceglie il database (64 caratteri a caso), non il telefono',
    c_anna ~ '^[0-9a-f]{64}$' and c_anna <> repeat('a', 64), c_anna);

  perform pg_temp.sono(anna);
  select count(*) into v_n from public.calendari;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('Anna vede il suo link', v_n = 1, v_n||' righe');

  perform pg_temp.sono(bruno);
  select count(*) into v_n from public.calendari;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('un compagno non vede il link dell''altro', v_n = 0, v_n||' righe viste');

  perform pg_temp.sono(bruno);
  begin
    insert into public.calendari(trip_id, user_id) values (v_trip, anna);
    select user_id::text into v_txt from public.calendari where trip_id = v_trip;
    v_txt := 'a nome di ' || coalesce(v_txt, '?');
  exception when others then v_txt := 'respinta'; end;
  perform pg_temp.torno_admin();
  select count(*) into v_n from public.calendari where user_id = anna;
  perform pg_temp.prova('un compagno non crea un link a nome di un altro', v_n = 1 and v_txt = 'respinta', v_txt);

  perform pg_temp.sono(carla);
  begin
    insert into public.calendari(trip_id) values (v_trip);
    v_txt := 'PASSATA';
  exception when others then v_txt := 'respinta'; end;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('un estraneo non crea un link per un viaggio non suo', v_txt = 'respinta', v_txt);

  perform pg_temp.sono(anna);
  begin
    insert into public.calendari(trip_id) values (v_trip);
    v_txt := 'PASSATA';
  exception when others then v_txt := 'respinta'; end;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('un link solo per persona e per viaggio', v_txt = 'respinta', v_txt);

  -- Bruno, il suo
  perform pg_temp.sono(bruno);
  insert into public.calendari(trip_id) values (v_trip) returning codice into c_bruno;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('il compagno ha il suo link, diverso', c_bruno is not null and c_bruno <> c_anna, coalesce(c_bruno,'niente'));

  -- della riga si cambia solo la lingua
  perform pg_temp.sono(anna);
  update public.calendari set lingua = 'fr' where trip_id = v_trip;
  get diagnostics v_n = row_count;
  begin
    update public.calendari set codice = repeat('b', 64) where trip_id = v_trip;
    v_txt := 'PASSATA';
  exception when others then v_txt := 'respinta'; end;
  perform pg_temp.torno_admin();
  select lingua into v_d from (select to_jsonb(lingua) as lingua from public.calendari where codice = c_anna) x;
  perform pg_temp.prova('si cambia la lingua del proprio calendario, non il codice', v_n = 1 and v_txt = 'respinta' and v_d = '"fr"'::jsonb, v_n||' · '||v_txt||' · '||coalesce(v_d::text,'?'));

  perform pg_temp.sono(bruno);
  update public.calendari set lingua = 'pt' where user_id = anna;
  get diagnostics v_n = row_count;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('e quella del link di un altro no', v_n = 0, v_n||' righe cambiate');

  -- ── la funzione che il calendario chiama ─────────────────────────────────
  select public.calendario_per_codice(c_anna) into v_d;
  perform pg_temp.prova('col codice giusto la funzione da'' il viaggio, con la lingua del link',
    v_d->>'trip_id' = v_trip::text and v_d->'data'->>'name' = 'Giappone' and v_d->>'lingua' = 'fr', coalesce(v_d::text,'niente'));

  select public.calendario_per_codice(repeat('c', 64)) into v_d;
  perform pg_temp.prova('col codice sbagliato niente', v_d is null, coalesce(v_d::text,'niente'));

  perform pg_temp.sono(null);
  begin
    perform public.calendario_per_codice(c_anna);
    v_txt := 'PASSATA';
  exception when others then v_txt := 'respinta'; end;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('con la chiave pubblica la funzione non si chiama', v_txt = 'respinta', v_txt);

  perform pg_temp.sono(bruno);
  begin
    perform public.calendario_per_codice(c_anna);
    v_txt := 'PASSATA';
  exception when others then v_txt := 'respinta'; end;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('e nemmeno da chi ha fatto l''accesso', v_txt = 'respinta', v_txt);

  -- spegnere e rifare il link
  perform pg_temp.sono(anna);
  delete from public.calendari where trip_id = v_trip;
  perform pg_temp.torno_admin();
  select public.calendario_per_codice(c_anna) into v_d;
  perform pg_temp.prova('spento il link, il codice vecchio non da'' piu'' niente', v_d is null, coalesce(v_d::text,'niente'));
  select public.calendario_per_codice(c_bruno) into v_d;
  perform pg_temp.prova('e quello del compagno funziona ancora', v_d is not null, coalesce(v_d->>'trip_id','niente'));

  c_vecchio := c_anna;
  perform pg_temp.sono(anna);
  insert into public.calendari(trip_id) values (v_trip) returning codice into c_anna;
  perform pg_temp.torno_admin();
  select public.calendario_per_codice(c_anna) into v_d;
  perform pg_temp.prova('rifatto il link, il codice nuovo funziona ed e'' un altro', v_d is not null and c_anna <> c_vecchio, c_anna);

  -- chi esce dal viaggio perde il link
  perform pg_temp.sono(bruno);
  delete from public.trip_members where trip_id = v_trip and user_id = bruno;
  perform pg_temp.torno_admin();
  select public.calendario_per_codice(c_bruno) into v_d;
  select count(*) into v_n from public.calendari where user_id = bruno;
  perform pg_temp.prova('uscito dal viaggio, il link del compagno non da'' piu'' niente, e la riga se ne va', v_d is null and v_n = 0, coalesce(v_d::text,'niente')||' · '||v_n||' righe');

  -- e anche se la riga restasse (un database dove il gancio non c'era),
  -- la funzione controlla lo stesso che la persona sia nel viaggio
  alter table public.trip_members disable trigger calendari_fuori_trg;
  perform pg_temp.sono(bruno); perform public.join_trip(v_trip, v_code); perform pg_temp.torno_admin();
  perform pg_temp.sono(bruno);
  insert into public.calendari(trip_id) values (v_trip) returning codice into c_bruno;
  delete from public.trip_members where trip_id = v_trip and user_id = bruno;
  perform pg_temp.torno_admin();
  alter table public.trip_members enable trigger calendari_fuori_trg;
  select public.calendario_per_codice(c_bruno) into v_d;
  select count(*) into v_n from public.calendari where user_id = bruno;
  perform pg_temp.prova('la funzione guarda chi e'' nel viaggio, non solo se la riga c''e''', v_d is null and v_n = 1, coalesce(v_d::text,'niente')||' · '||v_n||' righe');

  -- se ne va col viaggio
  delete from public.trips where id = v_trip;
  select count(*) into v_n from public.calendari where trip_id = v_trip;
  perform pg_temp.prova('cancellando il viaggio spariscono i link di tutti', v_n = 0, v_n||' rimasti');

end $$;

reset role;

select case when ok then '  OK  ' else ' FALLITO ' end || ' ' || n ||
       case when nota <> '' then '  — '||nota else '' end as "risultato"
from esito;
select count(*) filter (where ok) || '/' || count(*) || ' passati' as "totale" from esito;
select 'CI SONO PROVE FALLITE' as "attenzione" where exists(select 1 from esito where not ok);
