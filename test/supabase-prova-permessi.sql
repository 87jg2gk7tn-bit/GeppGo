-- Prove sui permessi del database di GeppGo.
-- Tre persone: Anna crea un viaggio, Bruno viene invitato, Carla è un'estranea
-- che ha un account come chiunque altro. Si controlla che ognuna veda e possa
-- toccare esattamente quello che deve, e niente di più.

\set ON_ERROR_STOP on
\pset pager off

create temp table esito(n text, ok boolean, nota text);

create or replace function pg_temp.prova(p_nome text, p_ok boolean, p_nota text default '')
returns void language sql as $$ insert into esito values (p_nome, p_ok, p_nota); $$;

-- Diventa una persona: cambia ruolo e mette il suo "token".
create or replace function pg_temp.sono(p_uid uuid) returns void
language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text,''), false);
  if p_uid is null then execute 'set role anon'; else execute 'set role authenticated'; end if;
end $$;

create or replace function pg_temp.torno_admin() returns void
language plpgsql as $$ begin execute 'reset role'; end $$;

-- ── i tre account ───────────────────────────────────────────────────────────
truncate public.trips cascade;
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
  v_trip uuid; v_code text; v_n int; v_txt text; v_pid bigint;
begin

  -- ── Anna crea il suo viaggio in Giappone ─────────────────────────────────
  perform pg_temp.sono(anna);
  insert into public.trips(owner, data)
    values (anna, '{"name":"Giappone","expenses":[]}'::jsonb)
    returning id, invite_code into v_trip, v_code;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('Anna crea un viaggio', v_trip is not null);
  perform pg_temp.prova('il codice invito lo genera il database', v_code is not null and length(v_code) >= 12, coalesce(v_code,'(nulla)'));

  -- si iscrive da sé al proprio viaggio, come fa cloudCreate()
  perform pg_temp.sono(anna);
  insert into public.trip_members(trip_id,user_id,participant_id,member_name)
    values (v_trip, anna, 1756000000001, 'Anna');
  select count(*) into v_n from public.trips;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('Anna vede il suo viaggio', v_n = 1, v_n||' viaggi');

  -- ── Carla, estranea: è qui che si gioca tutto ────────────────────────────
  perform pg_temp.sono(carla);
  select count(*) into v_n from public.trips;            -- la select('*') dell'app
  perform pg_temp.torno_admin();
  perform pg_temp.prova('l''estranea NON vede niente con select *', v_n = 0, v_n||' viaggi visti');

  perform pg_temp.sono(carla);
  select count(*) into v_n from public.trips where id = v_trip;  -- pur sapendo l'id
  perform pg_temp.torno_admin();
  perform pg_temp.prova('e non lo vede nemmeno sapendo l''id', v_n = 0, v_n||' viaggi visti');

  perform pg_temp.sono(carla);
  select count(*) into v_n from public.trip_members;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('e non vede chi viaggia con chi', v_n = 0, v_n||' righe viste');

  -- provare a infilarsi dentro da sola
  perform pg_temp.sono(carla);
  begin
    insert into public.trip_members(trip_id,user_id) values (v_trip, carla);
    v_txt := 'ENTRATA';
  exception when others then v_txt := 'respinta'; end;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('non può iscriversi da sola a un viaggio altrui', v_txt = 'respinta', v_txt);

  -- provare col codice sbagliato
  perform pg_temp.sono(carla);
  begin
    perform public.join_trip(v_trip, 'codice-inventato');
    v_txt := 'ENTRATA';
  exception when others then v_txt := 'respinta'; end;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('non entra col codice sbagliato', v_txt = 'respinta', v_txt);

  -- provare a modificare il viaggio di Anna
  perform pg_temp.sono(carla);
  update public.trips set data = '{"name":"rubato"}'::jsonb where id = v_trip;
  get diagnostics v_n = row_count;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('non può modificare il viaggio altrui', v_n = 0, v_n||' righe toccate');

  -- provare a cancellarlo
  perform pg_temp.sono(carla);
  delete from public.trips where id = v_trip;
  get diagnostics v_n = row_count;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('non può cancellare il viaggio altrui', v_n = 0, v_n||' righe tolte');

  -- ── chi non ha fatto l'accesso ───────────────────────────────────────────
  perform pg_temp.sono(null);
  begin
    select count(*) into v_n from public.trips;
    v_txt := v_n||' viaggi';
  exception when others then v_txt := 'respinto'; end;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('senza account non si legge niente', v_txt in ('respinto','0 viaggi'), v_txt);

  -- ── Bruno entra con il codice giusto ─────────────────────────────────────
  perform pg_temp.sono(bruno);
  perform public.join_trip(v_trip, v_code);
  select count(*) into v_n from public.trips;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('Bruno entra col codice invito e vede il viaggio', v_n = 1, v_n||' viaggi');

  -- e può costruire la giornata: è il senso dell'app
  perform pg_temp.sono(bruno);
  update public.trips set data = data || '{"note":"aggiunto da Bruno"}'::jsonb where id = v_trip;
  get diagnostics v_n = row_count;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('e può modificare il viaggio, come compagno', v_n = 1, v_n||' righe toccate');

  perform pg_temp.sono(anna);
  select data->>'note' into v_txt from public.trips where id = v_trip;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('e Anna vede la modifica di Bruno', v_txt = 'aggiunto da Bruno', coalesce(v_txt,'(niente)'));

  -- ma non può prendersi il viaggio
  perform pg_temp.sono(bruno);
  begin
    update public.trips set owner = bruno where id = v_trip;
    get diagnostics v_n = row_count;
    v_txt := case when v_n > 0 then 'RUBATO' else 'respinto' end;
  exception when others then v_txt := 'respinto'; end;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('un compagno non può intestarsi il viaggio', v_txt = 'respinto', v_txt);
  -- Se il furto riuscisse, tutte le prove dopo girerebbero su un viaggio già
  -- rubato e fallirebbero per riflesso: si rimette a posto, così ogni prova
  -- dice la verità su sé stessa e non sulla precedente.
  update public.trips set owner = anna where id = v_trip;

  -- né cancellarlo a tutti
  perform pg_temp.sono(bruno);
  delete from public.trips where id = v_trip;
  get diagnostics v_n = row_count;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('né cancellarlo per tutti', v_n = 0, v_n||' righe tolte');

  -- Carla non vede il viaggio nemmeno ora che ci sono due persone dentro
  perform pg_temp.sono(carla);
  select count(*) into v_n from public.trips;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('l''estranea resta fuori anche a viaggio avviato', v_n = 0, v_n||' viaggi');

  -- ── l'id del partecipante torna indietro come numero ─────────────────────
  perform pg_temp.sono(anna);
  select participant_id into v_pid from public.trip_members where trip_id=v_trip and user_id=anna;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('participant_id resta un numero (non diventa testo)',
                        v_pid = 1756000000001, coalesce(v_pid::text,'(nulla)'));

  -- ── Bruno se ne va: toglie sé, non il viaggio ────────────────────────────
  perform pg_temp.sono(bruno);
  delete from public.trip_members where trip_id=v_trip and user_id=bruno;
  get diagnostics v_n = row_count;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('chi se ne va toglie solo sé stesso', v_n = 1, v_n||' righe tolte');

  perform pg_temp.sono(bruno);
  select count(*) into v_n from public.trips;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('e dopo non vede più il viaggio', v_n = 0, v_n||' viaggi');

  perform pg_temp.sono(anna);
  select count(*) into v_n from public.trips;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('mentre ad Anna il viaggio resta', v_n = 1, v_n||' viaggi');

  -- ── Anna cancella il suo viaggio ─────────────────────────────────────────
  perform pg_temp.sono(anna);
  delete from public.trips where id = v_trip;
  get diagnostics v_n = row_count;
  perform pg_temp.torno_admin();
  perform pg_temp.prova('chi l''ha creato può cancellarlo', v_n = 1, v_n||' righe tolte');

  select count(*) into v_n from public.trip_members where trip_id = v_trip;
  perform pg_temp.prova('e le iscrizioni se ne vanno con lui', v_n = 0, v_n||' righe rimaste');

end $$;

reset role;

select case when ok then '  OK  ' else ' FALLITO ' end || ' ' || n ||
       case when nota <> '' then '  — '||nota else '' end as "risultato"
from esito;

select count(*) filter (where ok) || '/' || count(*) || ' passati' as "totale" from esito;
select 'CI SONO PROVE FALLITE' as "attenzione" where exists(select 1 from esito where not ok);
