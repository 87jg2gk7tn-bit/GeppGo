-- Prove sulle foto: chi le vede, chi le carica, chi le toglie, e cosa
-- succede quando qualcuno segnala.
--
-- Quattro persone. Anna crea il viaggio ed e' admin. Bruno e' un compagno.
-- Carla e' un'estranea con un account come chiunque altro. Dino entra e poi
-- viene tolto dal viaggio.

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
delete from storage.objects;
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
  v_trip uuid; v_code text; v_foto uuid; v_n int; v_txt text; v_perc text;
begin

  -- ── il viaggio, con Bruno e Dino dentro ──────────────────────────────────
  perform pg_temp.sono(anna);
  insert into public.trips(owner, data) values (anna, '{"name":"Giappone"}'::jsonb)
    returning id, invite_code into v_trip, v_code;
  insert into public.trip_members(trip_id,user_id,member_name) values (v_trip, anna, 'Anna');
  perform pg_temp.torno_admin();
  perform pg_temp.sono(bruno); perform public.join_trip(v_trip, v_code); perform pg_temp.torno_admin();
  perform pg_temp.sono(dino);  perform public.join_trip(v_trip, v_code); perform pg_temp.torno_admin();

  -- ── caricare una foto ────────────────────────────────────────────────────
  perform pg_temp.sono(bruno);
  v_foto := gen_random_uuid();
  v_perc := v_trip::text||'/'||v_foto::text||'.jpg';
  insert into public.foto(id,trip_id,caricata_da,giorno,percorso)
    values (v_foto, v_trip, bruno, '2026-09-01', v_perc);
  insert into storage.objects(bucket_id,name,owner) values ('foto-viaggi', v_perc, bruno);
  perform pg_temp.torno_admin();
  perform pg_temp.prova('un compagno puo mettere una foto nel viaggio', true);

  -- a nome di un altro, no
  perform pg_temp.sono(bruno);
  begin
    insert into public.foto(trip_id,caricata_da,percorso)
      values (v_trip, anna, v_trip::text||'/finta.jpg');
    v_txt := 'PASSATA';
  exception when others then v_txt := 'respinta'; end;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('ma non a nome di qualcun altro', v_txt = 'respinta', v_txt);

  -- ── chi la vede ──────────────────────────────────────────────────────────
  perform pg_temp.sono(anna);
  select count(*) into v_n from public.foto;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('la vedono i compagni di viaggio', v_n = 1, v_n||' foto');

  perform pg_temp.sono(carla);
  select count(*) into v_n from public.foto;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('l''estranea non vede nessuna foto', v_n = 0, v_n||' foto');

  perform pg_temp.sono(carla);
  select count(*) into v_n from public.foto where id = v_foto;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('e non la vede nemmeno sapendone l''indirizzo esatto', v_n = 0, v_n||' foto');

  -- ── il file dentro il magazzino ──────────────────────────────────────────
  perform pg_temp.sono(anna);
  select count(*) into v_n from storage.objects where bucket_id='foto-viaggi';
  perform pg_temp.torno_admin();
  perform pg_temp.prova('il file lo raggiungono i compagni', v_n = 1, v_n||' file');

  perform pg_temp.sono(carla);
  select count(*) into v_n from storage.objects where bucket_id='foto-viaggi';
  perform pg_temp.torno_admin();
  perform pg_temp.prova('e l''estranea no, nemmeno il file', v_n = 0, v_n||' file');

  -- caricare un file dentro il viaggio di altri
  perform pg_temp.sono(carla);
  begin
    insert into storage.objects(bucket_id,name,owner)
      values ('foto-viaggi', v_trip::text||'/intrusa.jpg', carla);
    v_txt := 'CARICATA';
  exception when others then v_txt := 'respinta'; end;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('un''estranea non infila file nel viaggio altrui', v_txt = 'respinta', v_txt);

  -- e nemmeno spacciandosi per un altro
  perform pg_temp.sono(bruno);
  begin
    insert into storage.objects(bucket_id,name,owner)
      values ('foto-viaggi', v_trip::text||'/perconto.jpg', anna);
    v_txt := 'CARICATA';
  exception when others then v_txt := 'respinta'; end;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('e non si carica un file a nome di un altro', v_txt = 'respinta', v_txt);

  -- il magazzino accetta solo immagini, e piccole
  perform pg_temp.torno_admin();
  select count(*) into v_n from storage.buckets
   where id='foto-viaggi' and public=false
     and allowed_mime_types = array['image/jpeg'] and file_size_limit = 12582912;
  perform pg_temp.prova('il magazzino e chiuso e accetta solo JPEG fino a 12 MB', v_n = 1);

  -- ── segnalare ────────────────────────────────────────────────────────────
  perform pg_temp.sono(dino);
  insert into public.segnalazioni(foto_id,trip_id,percorso_copia,segnalata_da,motivo,nota)
    values (v_foto, v_trip, v_perc, dino, 'minori', 'contenuto che riguarda un minore');
  select count(*) into v_n from public.segnalazioni;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('chi e nel viaggio puo segnalare una foto', v_n = 1, v_n||' segnalazioni');

  -- non si segnala a nome di un altro
  perform pg_temp.sono(dino);
  begin
    insert into public.segnalazioni(foto_id,segnalata_da,motivo)
      values (v_foto, bruno, 'altro');
    v_txt := 'PASSATA';
  exception when others then v_txt := 'respinta'; end;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('ma non a nome di un altro', v_txt = 'respinta', v_txt);

  -- chi e' segnalato non lo scopre curiosando
  perform pg_temp.sono(bruno);
  select count(*) into v_n from public.segnalazioni;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('chi e stato segnalato non lo vede', v_n = 0, v_n||' segnalazioni viste');

  perform pg_temp.sono(dino);
  select count(*) into v_n from public.segnalazioni;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('chi ha segnalato rivede la sua', v_n = 1, v_n||' segnalazioni');

  -- e non si puo' cancellare la propria segnalazione per far sparire la traccia
  perform pg_temp.sono(dino);
  begin
    delete from public.segnalazioni where segnalata_da = dino;
    v_txt := 'CANCELLATA';
  exception when others then v_txt := 'respinta'; end;
  perform pg_temp.torno_admin();
  select count(*) into v_n from public.segnalazioni;
  perform pg_temp.prova('e una segnalazione non si cancella dall''app', v_n = 1, v_txt);

  -- ── bloccare la foto segnalata ───────────────────────────────────────────
  --  E' un gesto di chi amministra il servizio, non un tasto dentro l'app:
  --  infatti si fa da qui, con i diritti pieni, e nell'app non c'e' modo.
  perform pg_temp.torno_admin();
  update public.foto set bloccata = true, bloccata_il = now() where id = v_foto;

  perform pg_temp.sono(anna);
  select count(*) into v_n from public.foto where id = v_foto;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('una foto bloccata sparisce dalla vista di tutti', v_n = 0, v_n||' foto viste');

  select count(*) into v_n from public.foto where id = v_foto;
  perform pg_temp.prova('ma resta nel registro, con la sua traccia', v_n = 1, v_n||' righe');

  select count(*) into v_n from public.segnalazioni where percorso_copia = v_perc;
  perform pg_temp.prova('e la segnalazione sa ancora di quale file parlava', v_n = 1);

  perform pg_temp.torno_admin();
  update public.foto set bloccata = false where id = v_foto;

  -- ── togliere una foto ────────────────────────────────────────────────────
  perform pg_temp.sono(dino);
  delete from public.foto where id = v_foto;
  get diagnostics v_n = row_count;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('un compagno non cancella le foto degli altri', v_n = 0, v_n||' tolte');

  perform pg_temp.sono(anna);
  delete from public.foto where id = v_foto;
  get diagnostics v_n = row_count;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('l''admin del viaggio si, per dar seguito a una segnalazione', v_n = 1, v_n||' tolte');

  perform pg_temp.sono(anna);
  delete from storage.objects where name = v_perc;
  get diagnostics v_n = row_count;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('e porta via anche il file', v_n = 1, v_n||' file tolti');

  select count(*) into v_n from public.segnalazioni;
  perform pg_temp.prova('la segnalazione resta anche senza piu la foto', v_n = 1);

  -- ── togliere qualcuno dal viaggio ────────────────────────────────────────
  perform pg_temp.sono(carla);
  begin
    perform public.togli_dal_viaggio(v_trip, dino);
    v_txt := 'TOLTO';
  exception when others then v_txt := 'respinta'; end;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('un''estranea non toglie nessuno dal viaggio', v_txt = 'respinta', v_txt);

  perform pg_temp.sono(bruno);
  begin
    perform public.togli_dal_viaggio(v_trip, dino);
    v_txt := 'TOLTO';
  exception when others then v_txt := 'respinta'; end;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('e nemmeno un compagno', v_txt = 'respinta', v_txt);

  perform pg_temp.sono(anna);
  perform public.togli_dal_viaggio(v_trip, dino);
  perform pg_temp.torno_admin();
  select count(*) into v_n from public.trip_members where trip_id=v_trip and user_id=dino;
  perform pg_temp.prova('l''admin puo togliere un compagno', v_n = 0, v_n||' iscrizioni');

  perform pg_temp.sono(dino);
  select count(*) into v_n from public.trips where id = v_trip;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('e da fuori non vede piu il viaggio', v_n = 0, v_n||' viaggi');

  -- un admin non toglie un altro admin
  perform pg_temp.sono(anna);
  update public.trip_members set ruolo='admin' where trip_id=v_trip and user_id=bruno;
  begin
    perform public.togli_dal_viaggio(v_trip, bruno);
    v_txt := 'TOLTO';
  exception when others then v_txt := 'respinta'; end;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('un admin non puo togliere un altro admin', v_txt = 'respinta', v_txt);

  perform pg_temp.sono(anna);
  begin
    perform public.togli_dal_viaggio(v_trip, anna);
    v_txt := 'TOLTA';
  exception when others then v_txt := 'respinta'; end;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('e non toglie se stesso da qui', v_txt = 'respinta', v_txt);

  -- ── chi esce non porta via le foto degli altri ───────────────────────────
  perform pg_temp.sono(anna);
  v_foto := gen_random_uuid();
  v_perc := v_trip::text||'/'||v_foto::text||'.jpg';
  insert into public.foto(id,trip_id,caricata_da,percorso) values (v_foto,v_trip,anna,v_perc);
  insert into storage.objects(bucket_id,name,owner) values ('foto-viaggi',v_perc,anna);
  perform pg_temp.torno_admin();

  perform pg_temp.sono(dino);
  select count(*) into v_n from storage.objects where bucket_id='foto-viaggi';
  perform pg_temp.torno_admin();
  perform pg_temp.prova('chi e stato tolto non raggiunge piu i file', v_n = 0, v_n||' file');

end $$;

reset role;

select case when ok then '  OK  ' else ' FALLITO ' end || ' ' || n ||
       case when nota <> '' then '  — '||nota else '' end as "risultato"
from esito;
select count(*) filter (where ok) || '/' || count(*) || ' passati' as "totale" from esito;
select 'CI SONO PROVE FALLITE' as "attenzione" where exists(select 1 from esito where not ok);
