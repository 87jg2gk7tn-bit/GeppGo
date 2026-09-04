-- Prove sulla cancellazione dell'account.
--
-- La domanda a cui rispondono e' una sola: chi si cancella si porta via solo
-- le proprie cose, o anche i viaggi degli altri? Le tabelle hanno
-- "on delete cascade" sul proprietario, quindi il modo sbagliato di fare
-- questa funzione cancellerebbe il viaggio a cinque persone che stanno ancora
-- viaggiando.

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
delete from public.segnalazioni;
delete from storage.objects;
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
  t_gruppo uuid; t_solo uuid; c_gruppo text;
  v_n int; v_txt text; v_uid uuid;
begin

  -- ── un viaggio in tre e uno che Anna fa da sola ──────────────────────────
  perform pg_temp.sono(anna);
  insert into public.trips(owner, data) values (anna, '{"name":"Giappone"}'::jsonb)
    returning id, invite_code into t_gruppo, c_gruppo;
  insert into public.trip_members(trip_id,user_id,member_name) values (t_gruppo, anna, 'Anna');
  insert into public.trips(owner, data) values (anna, '{"name":"Weekend da solo"}'::jsonb)
    returning id into t_solo;
  insert into public.trip_members(trip_id,user_id,member_name) values (t_solo, anna, 'Anna');
  perform pg_temp.torno_admin();

  perform pg_temp.sono(bruno); perform public.join_trip(t_gruppo, c_gruppo); perform pg_temp.torno_admin();
  perform pg_temp.sono(carla); perform public.join_trip(t_gruppo, c_gruppo); perform pg_temp.torno_admin();

  -- una foto di Anna e una di Bruno nel viaggio di gruppo
  perform pg_temp.sono(anna);
  insert into public.foto(trip_id,caricata_da,percorso)
    values (t_gruppo, anna, t_gruppo::text||'/di-anna.jpg');
  perform pg_temp.torno_admin();
  perform pg_temp.sono(bruno);
  insert into public.foto(trip_id,caricata_da,percorso)
    values (t_gruppo, bruno, t_gruppo::text||'/di-bruno.jpg');
  -- e una segnalazione fatta da Anna, che deve sopravviverle
  perform pg_temp.torno_admin();
  perform pg_temp.sono(anna);
  insert into public.segnalazioni(trip_id,percorso_copia,segnalata_da,motivo,nota)
    values (t_gruppo, t_gruppo::text||'/di-bruno.jpg', anna, 'minori', 'da guardare');
  perform pg_temp.torno_admin();

  -- ── chi non ha un account non cancella niente ────────────────────────────
  perform pg_temp.sono(null);
  begin
    perform public.elimina_account();
    v_txt := 'PASSATA';
  exception when others then v_txt := 'respinta'; end;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('senza account non si cancella niente', v_txt = 'respinta', v_txt);

  -- ── Anna cancella il proprio account ─────────────────────────────────────
  perform pg_temp.sono(anna);
  perform public.elimina_account();
  perform pg_temp.torno_admin();

  select count(*) into v_n from auth.users where id = anna;
  perform pg_temp.prova('l''account se ne va davvero', v_n = 0, v_n||' account');

  -- IL PUNTO: il viaggio di gruppo deve restare
  select count(*) into v_n from public.trips where id = t_gruppo;
  perform pg_temp.prova('il viaggio con gli altri dentro RESTA', v_n = 1, v_n||' viaggi');

  select count(*) into v_n from public.trips where id = t_solo;
  perform pg_temp.prova('quello dove era sola se ne va con lei', v_n = 0, v_n||' viaggi');

  -- il viaggio passa a chi c'era
  select owner into v_uid from public.trips where id = t_gruppo;
  perform pg_temp.prova('la proprieta passa a chi resta', v_uid = bruno, coalesce(v_uid::text,'(nessuno)'));

  select ruolo into v_txt from public.trip_members where trip_id=t_gruppo and user_id=bruno;
  perform pg_temp.prova('e quel qualcuno diventa admin', v_txt = 'admin', coalesce(v_txt,'(niente)'));

  select count(*) into v_n from public.trip_members where trip_id=t_gruppo;
  perform pg_temp.prova('restano dentro solo gli altri due', v_n = 2, v_n||' iscritti');

  select count(*) into v_n from public.trip_members where user_id = anna;
  perform pg_temp.prova('e di lei non resta nessuna iscrizione', v_n = 0, v_n||' iscrizioni');

  -- le foto
  select count(*) into v_n from public.foto where caricata_da = anna;
  perform pg_temp.prova('le sue foto se ne vanno', v_n = 0, v_n||' foto');
  select count(*) into v_n from public.foto where caricata_da = bruno;
  perform pg_temp.prova('quelle degli altri restano', v_n = 1, v_n||' foto');

  -- la segnalazione
  select count(*) into v_n from public.segnalazioni;
  perform pg_temp.prova('la segnalazione che aveva fatto RESTA', v_n = 1, v_n||' segnalazioni');
  select segnalata_da into v_uid from public.segnalazioni limit 1;
  perform pg_temp.prova('ma senza piu il suo nome', v_uid is null, coalesce(v_uid::text,'(anonima)'));
  select percorso_copia into v_txt from public.segnalazioni limit 1;
  perform pg_temp.prova('e sa ancora di quale foto parlava', v_txt like '%/di-bruno.jpg', coalesce(v_txt,'(niente)'));

  -- ── il viaggio resta usabile da chi c'e' ancora ──────────────────────────
  perform pg_temp.sono(bruno);
  select count(*) into v_n from public.trips;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('chi resta continua a vedere il viaggio', v_n = 1, v_n||' viaggi');

  perform pg_temp.sono(bruno);
  update public.trips set data = data || '{"nota":"avanti cosi"}'::jsonb where id = t_gruppo;
  get diagnostics v_n = row_count;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('e a modificarlo', v_n = 1, v_n||' righe');

  perform pg_temp.sono(bruno);
  select public.elimina_viaggio(t_gruppo) into v_txt;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('e adesso puo anche eliminarlo, da admin', v_txt = 'eliminato', v_txt);

  -- ── un admin che non e' il proprietario ──────────────────────────────────
  --  Caso che sfugge facilmente: Carla non ha creato il viaggio, ma e' stata
  --  promossa admin ed e' l'unica. Cancellandosi, il guardiano che vieta
  --  all'ultimo admin di uscire bloccherebbe tutta la cancellazione.
  perform pg_temp.torno_admin();
  delete from public.trips;
  insert into auth.users(id,email) values (anna,'anna2@x.it') on conflict do nothing;

  perform pg_temp.sono(bruno);
  insert into public.trips(owner, data) values (bruno, '{"name":"Norvegia"}'::jsonb)
    returning id, invite_code into t_gruppo, c_gruppo;
  insert into public.trip_members(trip_id,user_id,member_name) values (t_gruppo, bruno, 'Bruno');
  perform pg_temp.torno_admin();
  perform pg_temp.sono(carla); perform public.join_trip(t_gruppo, c_gruppo); perform pg_temp.torno_admin();
  -- Bruno promuove Carla e si toglie il ruolo: unica admin, ma non proprietaria
  perform pg_temp.sono(bruno);
  update public.trip_members set ruolo='admin'    where trip_id=t_gruppo and user_id=carla;
  update public.trip_members set ruolo='compagno' where trip_id=t_gruppo and user_id=bruno;
  perform pg_temp.torno_admin();

  perform pg_temp.sono(carla);
  begin
    perform public.elimina_account();
    v_txt := 'fatta';
  exception when others then v_txt := 'BLOCCATA: '||SQLERRM; end;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('si cancella anche l''unico admin che non e proprietario', v_txt = 'fatta', v_txt);

  select count(*) into v_n from public.trips where id = t_gruppo;
  perform pg_temp.prova('e il viaggio resta a chi c''era', v_n = 1, v_n||' viaggi');
  select ruolo into v_txt from public.trip_members where trip_id=t_gruppo and user_id=bruno;
  perform pg_temp.prova('che torna ad avere un admin', v_txt = 'admin', coalesce(v_txt,'(nessuno)'));

  -- ── nessuno puo' cancellare l'account di un altro ────────────────────────
  --  La funzione non prende parametri apposta: lavora solo su chi la chiama.
  perform pg_temp.torno_admin();
  select count(*) into v_n from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='elimina_account' and p.pronargs=0;
  perform pg_temp.prova('la funzione non accetta l''id di un altro', v_n = 1);

  -- ── e il proprietario resta immutabile dall'app ──────────────────────────
  perform pg_temp.sono(bruno);
  begin
    update public.trips set owner = anna where id = t_gruppo;
    v_txt := 'CAMBIATO';
  exception when others then v_txt := 'respinto'; end;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('cambiare proprietario dall''app resta vietato', v_txt = 'respinto', v_txt);

end $$;

reset role;

select case when ok then '  OK  ' else ' FALLITO ' end || ' ' || n ||
       case when nota <> '' then '  — '||nota else '' end as "risultato"
from esito;
select count(*) filter (where ok) || '/' || count(*) || ' passati' as "totale" from esito;
select 'CI SONO PROVE FALLITE' as "attenzione" where exists(select 1 from esito where not ok);
