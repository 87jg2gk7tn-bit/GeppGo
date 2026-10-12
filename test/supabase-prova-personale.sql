-- Prove sulla valigia e sulle impostazioni nel cloud (dati_personali).
--
-- Sono dati di una persona sola: la sua valigia per ogni viaggio, le sue
-- impostazioni. La promessa che queste prove tengono vera e' una: ognuno
-- legge e scrive solo le proprie righe. Un compagno di viaggio, che il
-- viaggio lo vede tutto, la valigia dell'altro non la vede e non la tocca.
--
-- Tre persone. Anna crea il viaggio. Bruno e' un compagno di Anna. Carla e'
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
delete from public.dati_personali;
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
  v_trip uuid; v_altro uuid; v_code text; v_n int; v_txt text;
begin

  -- ── il viaggio di Anna, con Bruno dentro; e uno di Carla ─────────────────
  perform pg_temp.sono(anna);
  insert into public.trips(owner, data) values (anna, '{"name":"Giappone"}'::jsonb)
    returning id, invite_code into v_trip, v_code;
  insert into public.trip_members(trip_id,user_id,member_name) values (v_trip, anna, 'Anna');
  perform pg_temp.torno_admin();
  perform pg_temp.sono(bruno); perform public.join_trip(v_trip, v_code); perform pg_temp.torno_admin();
  perform pg_temp.sono(carla);
  insert into public.trips(owner, data) values (carla, '{"name":"Islanda"}'::jsonb) returning id into v_altro;
  insert into public.trip_members(trip_id,user_id,member_name) values (v_altro, carla, 'Carla');
  perform pg_temp.torno_admin();

  -- ── Anna scrive le sue righe ─────────────────────────────────────────────
  perform pg_temp.sono(anna);
  insert into public.dati_personali(user_id,chiave,dati)
    values (anna, 'impostazioni', '{"v":{"nav":"apple"},"t":{"nav":1}}');
  insert into public.dati_personali(user_id,chiave,trip_id,dati)
    values (anna, 'valigia:'||v_trip, v_trip, '{"voci":[{"id":1,"label":"Passaporto"}],"tolte":{}}');
  select count(*) into v_n from public.dati_personali;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('chi ha l''account scrive e rilegge impostazioni e valigia', v_n = 2, v_n||' righe');

  -- e le aggiorna (e' cosi' che l'app manda le modifiche)
  perform pg_temp.sono(anna);
  insert into public.dati_personali(user_id,chiave,dati)
    values (anna, 'impostazioni', '{"v":{"nav":"google"},"t":{"nav":2}}')
    on conflict (user_id,chiave) do update set dati = excluded.dati, aggiornato_il = now();
  select dati->'v'->>'nav' into v_txt from public.dati_personali where chiave = 'impostazioni';
  perform pg_temp.torno_admin();
  perform pg_temp.prova('e le aggiorna sopra, una riga per cosa', v_txt = 'google', v_txt);

  -- ── Bruno, compagno di viaggio, non vede e non tocca ─────────────────────
  perform pg_temp.sono(bruno);
  select count(*) into v_n from public.dati_personali;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('un compagno di viaggio non legge la valigia ne'' le impostazioni dell''altro', v_n = 0, v_n||' righe viste');

  perform pg_temp.sono(bruno);
  update public.dati_personali set dati = '{"v":{"nav":"rubato"}}' where user_id = anna;
  get diagnostics v_n = row_count;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('non le modifica', v_n = 0, v_n||' righe cambiate');

  perform pg_temp.sono(bruno);
  delete from public.dati_personali where user_id = anna;
  get diagnostics v_n = row_count;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('non le cancella', v_n = 0, v_n||' righe tolte');

  perform pg_temp.sono(bruno);
  begin
    insert into public.dati_personali(user_id,chiave,dati) values (anna, 'impostazioni', '{}')
      on conflict (user_id,chiave) do update set dati = excluded.dati;
    v_txt := 'PASSATA';
  exception when others then v_txt := 'respinta'; end;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('e non le riscrive a nome di Anna, nemmeno passando dall''inserimento', v_txt = 'respinta', v_txt);

  select count(*) into v_n from public.dati_personali
   where user_id = anna and dati->'v'->>'nav' = 'google';
  perform pg_temp.prova('le righe di Anna sono ancora quelle sue', v_n = 1, v_n||'');

  -- la sua, invece, Bruno la tiene: anche la valigia per il viaggio di Anna
  perform pg_temp.sono(bruno);
  insert into public.dati_personali(user_id,chiave,trip_id,dati)
    values (bruno, 'valigia:'||v_trip, v_trip, '{"voci":[{"id":9,"label":"Ombrello"}],"tolte":{}}');
  select count(*) into v_n from public.dati_personali;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('un compagno tiene la sua valigia per lo stesso viaggio', v_n = 1, v_n||' righe sue');

  perform pg_temp.sono(anna);
  select count(*) into v_n from public.dati_personali where chiave = 'valigia:'||v_trip;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('e Anna vede solo la propria', v_n = 1, v_n||' valigie');

  -- ── un'estranea, e chi non ha l'account ──────────────────────────────────
  perform pg_temp.sono(carla);
  begin
    insert into public.dati_personali(user_id,chiave,trip_id,dati)
      values (carla, 'valigia:'||v_trip, v_trip, '{}');
    v_txt := 'PASSATA';
  exception when others then v_txt := 'respinta'; end;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('non si attacca una valigia al viaggio di altri', v_txt = 'respinta', v_txt);

  perform pg_temp.sono(null);
  begin
    perform count(*) from public.dati_personali;
    v_txt := 'PASSATA';
  exception when others then v_txt := 'respinta'; end;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('senza account non si legge niente', v_txt = 'respinta', v_txt);

  perform pg_temp.sono(null);
  begin
    insert into public.dati_personali(user_id,chiave,dati) values (anna, 'impostazioni', '{}');
    v_txt := 'PASSATA';
  exception when others then v_txt := 'respinta'; end;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('e non si scrive niente', v_txt = 'respinta', v_txt);

  -- ── la forma delle righe ─────────────────────────────────────────────────
  perform pg_temp.sono(anna);
  begin
    insert into public.dati_personali(user_id,chiave,trip_id,dati)
      values (anna, 'valigia:'||v_altro, v_trip, '{}');
    v_txt := 'PASSATA';
  exception when others then v_txt := 'respinta'; end;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('la chiave della valigia dice lo stesso viaggio della riga', v_txt = 'respinta', v_txt);

  perform pg_temp.sono(anna);
  begin
    insert into public.dati_personali(user_id,chiave,dati)
      values (anna, 'magazzino', '{}');
    v_txt := 'PASSATA';
  exception when others then v_txt := 'respinta'; end;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('si scrivono solo impostazioni e valigie', v_txt = 'respinta', v_txt);

  perform pg_temp.sono(anna);
  begin
    insert into public.dati_personali(user_id,chiave,trip_id,dati)
      values (anna, 'valigia:'||v_trip, v_trip,
              jsonb_build_object('x', repeat(md5(random()::text), 12000)))
      on conflict (user_id,chiave) do update set dati = excluded.dati;
    v_txt := 'PASSATA';
  exception when others then v_txt := 'respinta'; end;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('una riga non diventa un magazzino (oltre 256 KB no)', v_txt = 'respinta', v_txt);

  -- ── se ne va da sola ─────────────────────────────────────────────────────
  -- Chi viene tolto dal viaggio non puo' piu' attaccarci la valigia.
  perform pg_temp.sono(anna);
  perform public.togli_dal_viaggio(v_trip, bruno);
  perform pg_temp.torno_admin();
  perform pg_temp.sono(bruno);
  begin
    update public.dati_personali set dati = '{"voci":[]}' where chiave = 'valigia:'||v_trip;
    get diagnostics v_n = row_count;
    v_txt := 'PASSATA ' || v_n;
  exception when others then v_txt := 'respinta'; end;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('chi e'' stato tolto dal viaggio non ci riscrive la valigia', v_txt = 'respinta', v_txt);

  -- Cancellando il viaggio le valigie se ne vanno con lui.
  delete from public.trips where id = v_trip;
  select count(*) into v_n from public.dati_personali where trip_id = v_trip;
  perform pg_temp.prova('cancellando il viaggio spariscono le sue valigie', v_n = 0, v_n||' rimaste');

  -- Cancellando l'account se ne va tutto quello che era suo.
  perform pg_temp.sono(anna);
  perform public.elimina_account();
  perform pg_temp.torno_admin();
  select count(*) into v_n from public.dati_personali where user_id = anna;
  perform pg_temp.prova('cancellando l''account spariscono le sue impostazioni', v_n = 0, v_n||' rimaste');

end $$;

reset role;

select case when ok then '  OK  ' else ' FALLITO ' end || ' ' || n ||
       case when nota <> '' then '  — '||nota else '' end as "risultato"
from esito;
select count(*) filter (where ok) || '/' || count(*) || ' passati' as "totale" from esito;
select 'CI SONO PROVE FALLITE' as "attenzione" where exists(select 1 from esito where not ok);
