-- Prove su «A raccolta»: chi puo' chiamare, chi vede la chiamata, e per
-- quanto.
--
-- Qui dentro c'e' una posizione, ed e' l'unica cosa dell'app che esce dal
-- telefono di una persona e arriva a quello di altre. Le quattro promesse
-- che la rendono accettabile sono scritte nella privacy policy, e questa
-- prova esiste per tenerle vere:
--   1. e' la posizione di chi chiama, e nessuno puo' firmarla per un altro;
--   2. la puo' fare solo un admin del viaggio;
--   3. non si aggiorna mai - nessuna riga puo' diventare un puntino che si
--      muove dietro a qualcuno;
--   4. dopo due ore non la vede piu' nessuno, e le due ore sono un limite
--      del database, non una gentilezza dell'app.
--
-- Quattro persone, come nelle prove sulle foto. Anna crea il viaggio ed e'
-- admin. Bruno e' un compagno. Carla e' un'estranea. Dino entra e poi viene
-- tolto dal viaggio.

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
delete from auth.users;
insert into auth.users(id,email) values
  ('11111111-1111-1111-1111-111111111111','anna@x.it'),
  ('22222222-2222-2222-2222-222222222222','bruno@x.it'),
  ('33333333-3333-3333-3333-333333333333','carla@x.it'),
  ('44444444-4444-4444-4444-444444444444','dino@x.it');

do $$
declare
  anna  uuid := '11111111-1111-1111-1111-111111111111';
  bruno uuid := '22222222-2222-2222-2222-222222222222';
  carla uuid := '33333333-3333-3333-3333-333333333333';
  dino  uuid := '44444444-4444-4444-4444-444444444444';
  v_trip uuid; v_code text; v_racc uuid; v_n int; v_txt text;
begin

  -- ── il viaggio, con Bruno e Dino dentro ──────────────────────────────────
  perform pg_temp.sono(anna);
  insert into public.trips(owner, data) values (anna, '{"name":"Giappone"}'::jsonb)
    returning id, invite_code into v_trip, v_code;
  insert into public.trip_members(trip_id,user_id,member_name) values (v_trip, anna, 'Anna');
  perform pg_temp.torno_admin();
  perform pg_temp.sono(bruno); perform public.join_trip(v_trip, v_code); perform pg_temp.torno_admin();
  perform pg_temp.sono(dino);  perform public.join_trip(v_trip, v_code); perform pg_temp.torno_admin();

  -- ── chiamare: solo l'admin ───────────────────────────────────────────────
  perform pg_temp.sono(anna);
  v_racc := gen_random_uuid();
  insert into public.raccolte(id,trip_id,chiamata_da,nome,lat,lng,nota)
    values (v_racc, v_trip, anna, 'Anna', 35.6595, 139.7005, 'Si parte');
  perform pg_temp.torno_admin();
  perform pg_temp.prova('l''admin del viaggio puo chiamare a raccolta', true);

  -- un compagno no: non e' un tasto per far correre gli altri
  perform pg_temp.sono(bruno);
  begin
    insert into public.raccolte(trip_id,chiamata_da,lat,lng)
      values (v_trip, bruno, 35.0, 139.0);
    v_txt := 'PASSATA';
  exception when others then v_txt := 'respinta'; end;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('un compagno che non e admin non puo', v_txt = 'respinta', v_txt);

  -- e nessuno la firma per un altro
  perform pg_temp.sono(bruno);
  begin
    insert into public.raccolte(trip_id,chiamata_da,nome,lat,lng)
      values (v_trip, anna, 'Anna', 35.0, 139.0);
    v_txt := 'PASSATA';
  exception when others then v_txt := 'respinta'; end;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('e nessuno la firma col nome di un altro', v_txt = 'respinta', v_txt);

  -- nemmeno un'estranea, nel viaggio degli altri
  perform pg_temp.sono(carla);
  begin
    insert into public.raccolte(trip_id,chiamata_da,lat,lng)
      values (v_trip, carla, 35.0, 139.0);
    v_txt := 'PASSATA';
  exception when others then v_txt := 'respinta'; end;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('un''estranea non chiama nel viaggio altrui', v_txt = 'respinta', v_txt);

  -- ── chi la vede ──────────────────────────────────────────────────────────
  perform pg_temp.sono(bruno);
  select count(*) into v_n from public.raccolte;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('la vedono i compagni di viaggio', v_n = 1, v_n||' chiamate');

  perform pg_temp.sono(carla);
  select count(*) into v_n from public.raccolte;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('l''estranea non vede dove sta nessuno', v_n = 0, v_n||' chiamate');

  perform pg_temp.sono(carla);
  select count(*) into v_n from public.raccolte where id = v_racc;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('nemmeno sapendo l''indirizzo esatto della chiamata', v_n = 0, v_n||' chiamate');

  -- e la posizione c'e' davvero, quella di chi ha chiamato
  perform pg_temp.sono(bruno);
  select round(lat::numeric,3)::text into v_txt from public.raccolte where id = v_racc;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('dentro c''e il punto di chi ha chiamato', v_txt = '35.660', v_txt);

  -- ── la scadenza: e' del database, non dell'app ───────────────────────────
  -- Si sposta indietro nel tempo la chiamata (da amministratore, cioe' da
  -- fuori dalle regole: e' il modo di simulare "sono passate due ore").
  perform pg_temp.torno_admin();
  update public.raccolte set creata_il = now() - interval '3 hours',
                             scade_il  = now() - interval '1 hour'
   where id = v_racc;

  perform pg_temp.sono(bruno);
  select count(*) into v_n from public.raccolte;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('passate due ore non la vede piu nessuno', v_n = 0, v_n||' chiamate');

  perform pg_temp.sono(anna);
  select count(*) into v_n from public.raccolte;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('nemmeno chi l''aveva fatta', v_n = 0, v_n||' chiamate');

  -- e non si puo' chiamare con una scadenza piu' lunga di due ore: senza
  -- questo limite la privacy policy direbbe una cosa falsa.
  perform pg_temp.sono(anna);
  begin
    insert into public.raccolte(trip_id,chiamata_da,lat,lng,scade_il)
      values (v_trip, anna, 35.0, 139.0, now() + interval '1 year');
    v_txt := 'PASSATA';
  exception when others then v_txt := 'respinta'; end;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('e non se ne puo fare una che dura un anno', v_txt = 'respinta', v_txt);

  -- ── non si aggiorna mai ──────────────────────────────────────────────────
  -- E' la promessa piu' importante: se una riga si potesse riscrivere,
  -- diventerebbe un puntino che segue qualcuno per due ore.
  -- Si rimette valida. Vanno spostate tutte e due le date insieme: il vincolo
  -- lega la scadenza al momento della chiamata, e sistemarne una sola viene
  -- respinto - il che e' esattamente quello che deve succedere.
  perform pg_temp.torno_admin();
  update public.raccolte set creata_il = now(), scade_il = now() + interval '2 hours'
   where id = v_racc;

  perform pg_temp.sono(anna);
  begin
    update public.raccolte set lat = 1, lng = 1 where id = v_racc;
    get diagnostics v_n = row_count;
    v_txt := case when v_n > 0 then 'SPOSTATA' else 'ferma' end;
  exception when others then v_txt := 'ferma'; end;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('una chiamata gia fatta non si sposta', v_txt = 'ferma', v_txt);

  select count(*) into v_n from pg_policies
   where schemaname='public' and tablename='raccolte' and cmd='UPDATE';
  perform pg_temp.prova('e non esiste nessun permesso di update', v_n = 0, v_n||' permessi');

  -- ── ritirarla ────────────────────────────────────────────────────────────
  perform pg_temp.sono(bruno);
  delete from public.raccolte where id = v_racc;
  get diagnostics v_n = row_count;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('un compagno non ritira la chiamata di un admin', v_n = 0, v_n||' tolte');

  perform pg_temp.sono(anna);
  delete from public.raccolte where id = v_racc;
  get diagnostics v_n = row_count;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('chi l''ha fatta la ritira subito, senza aspettare due ore', v_n = 1, v_n||' tolte');

  -- ── chi viene tolto dal viaggio ──────────────────────────────────────────
  perform pg_temp.sono(anna);
  insert into public.raccolte(trip_id,chiamata_da,nome,lat,lng)
    values (v_trip, anna, 'Anna', 35.66, 139.70);
  perform public.togli_dal_viaggio(v_trip, dino);
  perform pg_temp.torno_admin();

  perform pg_temp.sono(dino);
  select count(*) into v_n from public.raccolte;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('chi e stato tolto non sa piu dove sono gli altri', v_n = 0, v_n||' chiamate');

  -- ── cancellare l'account ─────────────────────────────────────────────────
  -- Dentro una chiamata c'e' un posto in cui sei stato: se ne va con te.
  perform pg_temp.sono(anna);
  perform public.elimina_account();
  perform pg_temp.torno_admin();
  select count(*) into v_n from public.raccolte where chiamata_da = anna;
  perform pg_temp.prova('cancellando l''account spariscono le proprie chiamate', v_n = 0, v_n||' rimaste');

end $$;

reset role;

select case when ok then '  OK  ' else ' FALLITO ' end || ' ' || n ||
       case when nota <> '' then '  — '||nota else '' end as "risultato"
from esito;
select count(*) filter (where ok) || '/' || count(*) || ' passati' as "totale" from esito;
select 'CI SONO PROVE FALLITE' as "attenzione" where exists(select 1 from esito where not ok);
