-- Prove sui tetti di spesa (miglioria 13a).
--
-- Due promesse:
-- - il tetto di spesa di una persona e' suo: sta in dati_personali come la
--   valigia ('tetto:<id del viaggio>'), e un compagno di viaggio non lo vede
--   e non lo tocca;
-- - i tetti del gruppo (dentro il viaggio: «tetto» e «tettoCat_...») li
--   cambiano solo gli admin. Un compagno che manda il viaggio con i tetti
--   cambiati non viene respinto - il resto delle sue modifiche passa - ma i
--   tetti restano com'erano.
--
-- Tre persone. Anna crea il viaggio ed e' admin. Bruno e' un compagno di
-- Anna. Carla e' un'estranea.

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
  v_trip uuid; v_altro uuid; v_code text; v_n int; v_txt text; v_d jsonb;
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

  -- ── il tetto di una persona: suo ─────────────────────────────────────────
  perform pg_temp.sono(anna);
  insert into public.dati_personali(user_id,chiave,trip_id,dati)
    values (anna, 'tetto:'||v_trip, v_trip, '{"v":600,"t":1}');
  select count(*) into v_n from public.dati_personali where chiave = 'tetto:'||v_trip;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('chi e'' nel viaggio salva il suo tetto di spesa', v_n = 1, v_n||' righe');

  perform pg_temp.sono(bruno);
  select count(*) into v_n from public.dati_personali;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('un compagno di viaggio non vede il tetto dell''altro', v_n = 0, v_n||' righe viste');

  perform pg_temp.sono(bruno);
  update public.dati_personali set dati = '{"v":1,"t":9}' where user_id = anna;
  get diagnostics v_n = row_count;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('e non lo cambia', v_n = 0, v_n||' righe cambiate');

  perform pg_temp.sono(bruno);
  insert into public.dati_personali(user_id,chiave,trip_id,dati)
    values (bruno, 'tetto:'||v_trip, v_trip, '{"v":400,"t":2}');
  perform pg_temp.torno_admin();
  perform pg_temp.sono(anna);
  select dati->>'v' into v_txt from public.dati_personali where chiave = 'tetto:'||v_trip;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('ognuno ha il suo per lo stesso viaggio, e Anna rilegge il proprio', v_txt = '600', v_txt);

  perform pg_temp.sono(carla);
  begin
    insert into public.dati_personali(user_id,chiave,trip_id,dati)
      values (carla, 'tetto:'||v_trip, v_trip, '{"v":1,"t":1}');
    v_txt := 'PASSATA';
  exception when others then v_txt := 'respinta'; end;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('non si attacca un tetto al viaggio di altri', v_txt = 'respinta', v_txt);

  perform pg_temp.sono(anna);
  begin
    insert into public.dati_personali(user_id,chiave,trip_id,dati)
      values (anna, 'tetto:'||v_altro, v_trip, '{}');
    v_txt := 'PASSATA';
  exception when others then v_txt := 'respinta'; end;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('la chiave del tetto dice lo stesso viaggio della riga', v_txt = 'respinta', v_txt);

  -- ── i tetti del gruppo: li cambia un admin ───────────────────────────────
  perform pg_temp.sono(anna);
  update public.trips set data = data || '{"tetto":1000,"tettoCat_Cibo":300,"_ct":{"name":100,"tetto":100,"tettoCat_Cibo":100}}'::jsonb where id = v_trip;
  perform pg_temp.torno_admin();
  select data into v_d from public.trips where id = v_trip;
  perform pg_temp.prova('l''admin fissa il tetto del gruppo e quello di una categoria',
    (v_d->>'tetto') = '1000' and (v_d->>'tettoCat_Cibo') = '300', v_d::text);

  -- Bruno manda il viaggio con un nome nuovo (suo diritto) e i tetti cambiati:
  -- il tetto abbassato, quello del Cibo tolto, uno nuovo per i Voli. Con le
  -- ore della modifica, come le scrive l'app: quelle dei tetti, nuove,
  -- vincerebbero sulle modifiche vere di un admin arrivate dopo.
  perform pg_temp.sono(bruno);
  update public.trips
     set data = (data - 'tettoCat_Cibo') || '{"name":"Giappone 2026","tetto":5,"tettoCat_Voli":1,"_ct":{"name":200,"tetto":999,"tettoCat_Voli":999}}'::jsonb
   where id = v_trip;
  get diagnostics v_n = row_count;
  perform pg_temp.torno_admin();
  select data into v_d from public.trips where id = v_trip;
  perform pg_temp.prova('l''aggiornamento di un compagno passa (non e'' respinto per i tetti)', v_n = 1, v_n||' righe');
  perform pg_temp.prova('e il resto delle sue modifiche resta', (v_d->>'name') = 'Giappone 2026', v_d->>'name');
  perform pg_temp.prova('ma il tetto del gruppo resta quello dell''admin', (v_d->>'tetto') = '1000', coalesce(v_d->>'tetto','(niente)'));
  perform pg_temp.prova('e quello del Cibo non si toglie', (v_d->>'tettoCat_Cibo') = '300', coalesce(v_d->>'tettoCat_Cibo','(niente)'));
  perform pg_temp.prova('e uno nuovo non si aggiunge', not (v_d ? 'tettoCat_Voli'), coalesce(v_d->>'tettoCat_Voli','(niente)'));
  perform pg_temp.prova('le ore della modifica dei tetti restano quelle dell''admin',
    (v_d->'_ct'->>'tetto') = '100' and (v_d->'_ct'->>'tettoCat_Cibo') = '100' and not ((v_d->'_ct') ? 'tettoCat_Voli'),
    (v_d->'_ct')::text);
  perform pg_temp.prova('e quella del nome e'' di Bruno, che il nome l''ha cambiato davvero', (v_d->'_ct'->>'name') = '200', v_d->'_ct'->>'name');

  -- Promosso admin, Bruno i tetti li cambia: la regola segue il ruolo.
  perform pg_temp.sono(anna);
  update public.trip_members set ruolo = 'admin' where trip_id = v_trip and user_id = bruno;
  perform pg_temp.torno_admin();
  perform pg_temp.sono(bruno);
  update public.trips set data = data || '{"tetto":1200}'::jsonb where id = v_trip;
  perform pg_temp.torno_admin();
  select data->>'tetto' into v_txt from public.trips where id = v_trip;
  perform pg_temp.prova('promosso admin, il compagno il tetto lo cambia', v_txt = '1200', v_txt);

  -- E un admin il tetto lo puo' anche togliere.
  perform pg_temp.sono(anna);
  update public.trips set data = data - 'tetto' where id = v_trip;
  perform pg_temp.torno_admin();
  select data into v_d from public.trips where id = v_trip;
  perform pg_temp.prova('e un admin lo toglie', not (v_d ? 'tetto'), coalesce(v_d->>'tetto','(niente)'));

  -- ── se ne va col viaggio ─────────────────────────────────────────────────
  delete from public.trips where id = v_trip;
  select count(*) into v_n from public.dati_personali where trip_id = v_trip;
  perform pg_temp.prova('cancellando il viaggio spariscono anche i tetti di ognuno', v_n = 0, v_n||' rimasti');

end $$;

reset role;

select case when ok then '  OK  ' else ' FALLITO ' end || ' ' || n ||
       case when nota <> '' then '  — '||nota else '' end as "risultato"
from esito;
select count(*) filter (where ok) || '/' || count(*) || ' passati' as "totale" from esito;
select 'CI SONO PROVE FALLITE' as "attenzione" where exists(select 1 from esito where not ok);
