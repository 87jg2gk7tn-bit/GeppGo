-- ============================================================================
--  GeppGo — schema e permessi del database
-- ============================================================================
--  Questo file è la verità su com'è fatto il cloud di GeppGo. Prima viveva
--  solo dentro il pannello di Supabase: se quel progetto si perdeva non
--  restava niente per rifarlo, e nessuno poteva controllare se i permessi
--  fossero scritti bene. Ora sta qui, versionato insieme all'app.
--
--  COME SI USA: Supabase → SQL Editor → incolla tutto → Run.
--  Si può rilanciare quante volte si vuole: non distrugge niente e non
--  duplica niente (le tabelle si creano solo se mancano, le regole si
--  riscrivono sopra a quelle vecchie).
--
--  PERCHÉ I PERMESSI SONO LA PARTE IMPORTANTE
--  L'app chiede i viaggi così, senza nessun filtro:
--      sb.from('trips').select('*')
--  Non dice "dammi i miei": dice "dammi tutto", e si fida che sia il
--  database a consegnare solo quelli a cui hai diritto. Finché ogni gruppo
--  aveva il suo progetto separato era una fiducia a basso costo. Da quando
--  il progetto è uno solo per tutti, quelle poche righe di "policy" qui
--  sotto sono l'unica parete tra i dati di una persona e quelli di tutte
--  le altre. Vanno lette con attenzione, non copiate a fiducia.
-- ============================================================================


-- gen_random_uuid() e gen_random_bytes() per gli id e i codici invito
create extension if not exists pgcrypto;


-- ────────────────────────────────────────────────────────────────────────────
--  TABELLE
-- ────────────────────────────────────────────────────────────────────────────

--  Un viaggio. Tutto il contenuto (giorni, attività, spese, biglietti...)
--  sta dentro un unico jsonb: l'app lavora su quell'oggetto in memoria e lo
--  rimanda intero, quindi al database non serve conoscerne la forma. Restano
--  fuori dal json solo i campi che servono a decidere CHI può vederlo.
create table if not exists public.trips (
  id          uuid        primary key default gen_random_uuid(),
  owner       uuid        not null references auth.users(id) on delete cascade,
  data        jsonb       not null default '{}'::jsonb,
  -- Il codice invito lo genera il database, non l'app: così non può essere
  -- scelto da chi crea il viaggio e non è indovinabile. L'app lo rilegge
  -- subito dopo l'insert e lo mostra nel tasto Condividi.
  invite_code text        not null default encode(gen_random_bytes(9), 'hex'),
  updated_at  timestamptz not null default now(),
  updated_by  uuid,
  created_at  timestamptz not null default now()
);

--  Chi partecipa a quale viaggio. Una riga per (viaggio, account).
--
--  participant_id è BIGINT e non text di proposito: gli id dei partecipanti
--  li fa uid() dentro l'app, che restituisce un numero (Date.now() + caso).
--  L'app poi confronta con === per capire quale partecipante sei tu; se
--  questa colonna fosse text, il database restituirebbe "1756..." e il
--  confronto con 1756... sarebbe sempre falso: dopo ogni sincronizzazione
--  l'app non saprebbe più chi sei, e i conti delle spese ne risentirebbero.
--
--  ruolo dice cosa può fare questa persona dentro questo viaggio:
--    'admin'    — chi l'ha creato, e chiunque lui abbia promosso. Può
--                 eliminare il viaggio per tutti (con le cautele più sotto)
--                 e nominare altri admin.
--    'compagno' — costruisce la giornata insieme agli altri, ma non può
--                 far sparire il viaggio dai telefoni di nessuno.
--  Chi entra con un invito parte sempre come compagno.
create table if not exists public.trip_members (
  trip_id        uuid        not null references public.trips(id) on delete cascade,
  user_id        uuid        not null references auth.users(id)   on delete cascade,
  participant_id bigint,
  member_name    text,
  ruolo          text        not null default 'compagno'
                             check (ruolo in ('admin','compagno')),
  joined_at      timestamptz not null default now(),
  primary key (trip_id, user_id)
);

-- Per i database nati prima che i ruoli e la richiesta di eliminazione
-- esistessero: le colonne si aggiungono senza toccare quello che c'è già.
alter table public.trip_members add column if not exists ruolo text not null default 'compagno';
do $$ begin
  alter table public.trip_members add constraint trip_members_ruolo_ck check (ruolo in ('admin','compagno'));
exception when duplicate_object then null; end $$;

-- Chi ha già creato dei viaggi era admin di fatto: lo diventa anche di nome.
update public.trip_members m set ruolo = 'admin'
  from public.trips t
 where t.id = m.trip_id and t.owner = m.user_id and m.ruolo <> 'admin';

--  Eliminare un viaggio per tutti, quando gli admin sono più di uno, non
--  succede al primo tocco: resta in sospeso finché un secondo admin non
--  conferma. Queste due colonne sono quella sospensione.
alter table public.trips add column if not exists canc_chiesta_da uuid;
alter table public.trips add column if not exists canc_chiesta_il timestamptz;

-- Le due domande che l'app fa più spesso: "i membri di questo account" e
-- "i viaggi di cui sono proprietario".
create index if not exists trip_members_user_idx on public.trip_members(user_id);
create index if not exists trips_owner_idx       on public.trips(owner);


-- ────────────────────────────────────────────────────────────────────────────
--  DUE AIUTANTI, PER NON MORDERSI LA CODA
-- ────────────────────────────────────────────────────────────────────────────
--  Il permesso di leggere un viaggio dipende da trip_members; se il permesso
--  su trip_members dipendesse a sua volta da trips, Postgres girerebbe in
--  tondo e fallirebbe ("infinite recursion detected in policy"). È l'errore
--  classico di questo tipo di schema.
--
--  Queste due funzioni sono SECURITY DEFINER: girano con i diritti di chi le
--  ha create, quindi leggono le tabelle senza far scattare di nuovo i
--  permessi, e il cerchio si spezza. Non espongono nulla: rispondono solo
--  sì/no su chi sta chiamando in quel momento (auth.uid()).

create or replace function public.is_trip_member(p_trip uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.trip_members m
    where m.trip_id = p_trip and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_trip_admin(p_trip uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.trip_members m
    where m.trip_id = p_trip and m.user_id = auth.uid() and m.ruolo = 'admin'
  );
$$;

create or replace function public.is_trip_owner(p_trip uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.trips t
    where t.id = p_trip and t.owner = auth.uid()
  );
$$;


-- ────────────────────────────────────────────────────────────────────────────
--  ENTRARE IN UN VIAGGIO CON IL CODICE INVITO
-- ────────────────────────────────────────────────────────────────────────────
--  Chi riceve un invito non può ancora vedere il viaggio: non è membro, e
--  quindi non può nemmeno leggere il codice per confrontarlo. Il controllo
--  deve farlo il database al posto suo — ed è tutto quello che questa
--  funzione concede: se il codice combacia, ti iscrive; altrimenti no.
--  Non restituisce mai il viaggio, così non si può usare per indovinare
--  codici a tentativi leggendo le risposte.
create or replace function public.join_trip(p_trip uuid, p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'serve un account';
  end if;

  if not exists (
    select 1 from public.trips t
    where t.id = p_trip and t.invite_code = p_code
  ) then
    raise exception 'codice non valido';
  end if;

  insert into public.trip_members (trip_id, user_id)
  values (p_trip, auth.uid())
  on conflict (trip_id, user_id) do nothing;
end;
$$;

-- Solo chi ha fatto l'accesso può provare a entrare: a chi non ha un account
-- la funzione non è nemmeno offerta.
revoke all on function public.join_trip(uuid, text) from public, anon;
grant execute on function public.join_trip(uuid, text) to authenticated;

revoke all on function public.is_trip_member(uuid) from public, anon;
revoke all on function public.is_trip_owner(uuid)  from public, anon;
revoke all on function public.is_trip_admin(uuid)  from public, anon;
grant execute on function public.is_trip_member(uuid) to authenticated;
grant execute on function public.is_trip_owner(uuid)  to authenticated;
grant execute on function public.is_trip_admin(uuid)  to authenticated;


-- ────────────────────────────────────────────────────────────────────────────
--  ELIMINARE UN VIAGGIO — a quattro mani quando gli admin sono più di uno
-- ────────────────────────────────────────────────────────────────────────────
--  Non esiste un DELETE diretto sui viaggi: la regola più sotto non lo
--  concede a nessuno. Si passa solo da qui, altrimenti basterebbe una
--  chiamata fatta a mano per saltare la conferma del secondo admin.
--
--  Con un solo admin il viaggio se ne va subito (l'avviso serio lo fa
--  l'app prima di arrivare qui). Con due o più resta in sospeso: chi ha
--  chiesto viene segnato, e serve che un ALTRO admin confermi. Chi ha
--  chiesto non può confermarsi da solo.

create or replace function public.elimina_viaggio(p_trip uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare n_admin int;
begin
  if auth.uid() is null then
    raise exception 'serve un account';
  end if;
  if not public.is_trip_admin(p_trip) then
    raise exception 'solo un admin puo eliminare il viaggio per tutti';
  end if;

  select count(*) into n_admin
    from public.trip_members where trip_id = p_trip and ruolo = 'admin';

  if n_admin <= 1 then
    delete from public.trips where id = p_trip;
    return 'eliminato';
  end if;

  update public.trips
     set canc_chiesta_da = auth.uid(), canc_chiesta_il = now()
   where id = p_trip;
  return 'in-attesa';
end;
$$;

create or replace function public.conferma_eliminazione(p_trip uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare chi uuid;
begin
  if not public.is_trip_admin(p_trip) then
    raise exception 'solo un admin puo confermare';
  end if;

  select canc_chiesta_da into chi from public.trips where id = p_trip;

  if chi is null then
    raise exception 'nessuna eliminazione in corso su questo viaggio';
  end if;
  -- Il senso di tutto il meccanismo: due teste, non una due volte.
  if chi = auth.uid() then
    raise exception 'la conferma deve venire da un altro admin';
  end if;

  delete from public.trips where id = p_trip;
end;
$$;

create or replace function public.annulla_eliminazione(p_trip uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_trip_admin(p_trip) then
    raise exception 'solo un admin puo annullare';
  end if;
  update public.trips
     set canc_chiesta_da = null, canc_chiesta_il = null
   where id = p_trip;
end;
$$;

revoke all on function public.elimina_viaggio(uuid)       from public, anon;
revoke all on function public.conferma_eliminazione(uuid) from public, anon;
revoke all on function public.annulla_eliminazione(uuid)  from public, anon;
grant execute on function public.elimina_viaggio(uuid)       to authenticated;
grant execute on function public.conferma_eliminazione(uuid) to authenticated;
grant execute on function public.annulla_eliminazione(uuid)  to authenticated;


-- ────────────────────────────────────────────────────────────────────────────
--  I PERMESSI (RLS) — la parete
-- ────────────────────────────────────────────────────────────────────────────

alter table public.trips        enable row level security;
alter table public.trip_members enable row level security;

-- Nessuno entra senza account: il ruolo "anon" (chi apre l'app senza aver
-- fatto l'accesso) non ha proprio i diritti sulle tabelle.
revoke all on public.trips        from anon;
revoke all on public.trip_members from anon;
grant select, insert, update, delete on public.trips        to authenticated;
grant select, insert, update, delete on public.trip_members to authenticated;

-- ── trips ───────────────────────────────────────────────────────────────────

-- LEGGERE: il viaggio è tuo, oppure sei stato invitato dentro.
drop policy if exists trips_select on public.trips;
create policy trips_select on public.trips
  for select to authenticated
  using (owner = auth.uid() or public.is_trip_member(id));

-- CREARE: puoi creare viaggi solo a nome tuo. Senza questo controllo si
-- potrebbero creare viaggi intestati ad altri.
drop policy if exists trips_insert on public.trips;
create policy trips_insert on public.trips
  for insert to authenticated
  with check (owner = auth.uid());

-- MODIFICARE: anche i compagni di viaggio, non solo chi l'ha creato — è il
-- senso dell'app: si costruisce la giornata in sei.
--
-- ATTENZIONE a cosa NON fa il "with check" qui sotto. In un UPDATE, "using"
-- guarda la riga vecchia e "with check" quella nuova: la riga vecchia, nel
-- with check, non è proprio disponibile. Quindi questa regola da sola NON
-- impedisce a un compagno di scriversi owner = sé stesso, perché a quel punto
-- "owner = auth.uid()" è vera e lo lascia passare — e da proprietario potrebbe
-- poi cancellare il viaggio a tutti. Le prove automatiche l'hanno beccato.
-- A tenere fermo il proprietario ci pensa il guardiano più sotto
-- (trips_campi_bloccati), che è l'unico posto in cui si può confrontare il
-- prima con il dopo.
drop policy if exists trips_update on public.trips;
create policy trips_update on public.trips
  for update to authenticated
  using      (owner = auth.uid() or public.is_trip_member(id))
  with check (owner = auth.uid() or public.is_trip_member(id));

-- CANCELLARE: nessuno, direttamente. Nemmeno chi l'ha creato.
-- Non è una svista: se il DELETE fosse concesso all'app, la conferma del
-- secondo admin si salterebbe con una chiamata fatta a mano. Si passa da
-- elimina_viaggio() / conferma_eliminazione(), che quella regola la fanno
-- rispettare. Un compagno che vuole togliersi il viaggio non cancella
-- niente: toglie la propria riga da trip_members ed esce.
drop policy if exists trips_delete on public.trips;

-- ── trip_members ────────────────────────────────────────────────────────────

-- LEGGERE: le proprie righe, e quelle dei compagni dei viaggi in cui sei.
-- Servono per mostrare chi è admin nella scheda delle persone. Fuori dai
-- tuoi viaggi non vedi niente: l'elenco di chi viaggia con chi non gira.
drop policy if exists members_select on public.trip_members;
create policy members_select on public.trip_members
  for select to authenticated
  using (user_id = auth.uid() or public.is_trip_member(trip_id));

-- ISCRIVERSI DA SÉ: solo al proprio viaggio, quello appena creato.
-- Senza la seconda condizione basterebbe indovinare l'id di un viaggio per
-- infilarcisi dentro: per entrare in quello di qualcun altro esiste
-- join_trip, che pretende il codice invito.
drop policy if exists members_insert on public.trip_members;
create policy members_insert on public.trip_members
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_trip_owner(trip_id));

-- MODIFICARE: la propria riga (serve a dire "nel viaggio io sono questo
-- partecipante qui"), e — se sei admin — anche quella dei compagni, che è
-- il modo in cui si promuove qualcuno ad admin.
--
-- Da sola questa regola lascerebbe però a chiunque la possibilità di
-- scriversi ruolo = 'admin' sulla PROPRIA riga: è lo stesso inganno del
-- proprietario, che il with check non vede. Chi custodisce il ruolo è il
-- guardiano membri_ruolo_custodito, più sotto.
drop policy if exists members_update on public.trip_members;
create policy members_update on public.trip_members
  for update to authenticated
  using      (user_id = auth.uid() or public.is_trip_admin(trip_id))
  with check (user_id = auth.uid() or public.is_trip_admin(trip_id));

-- USCIRE: si toglie solo sé stessi.
drop policy if exists members_delete on public.trip_members;
create policy members_delete on public.trip_members
  for delete to authenticated
  using (user_id = auth.uid());


-- ────────────────────────────────────────────────────────────────────────────
--  IL GUARDIANO: tre campi che non si cambiano modificando un viaggio
-- ────────────────────────────────────────────────────────────────────────────
--  Le regole qui sopra dicono CHI può modificare un viaggio, ma non possono
--  dire QUALI campi. Questo è l'unico posto in cui si vede la riga com'era
--  prima (old) accanto a com'è diventata (new), e quindi l'unico in cui si
--  può impedire che un compagno di viaggio, con un normale aggiornamento, si
--  scriva proprietario e da lì cancelli il viaggio a tutti.
--
--  L'app non tocca mai questi tre campi: manda solo data, updated_at e
--  updated_by. Se un giorno un aggiornamento fallisce qui, è perché qualcosa
--  sta facendo quello che non dovrebbe.
create or replace function public.trips_campi_bloccati()
returns trigger
language plpgsql
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'l''id di un viaggio non si cambia';
  end if;

  if new.owner is distinct from old.owner then
    raise exception 'il proprietario di un viaggio non si cambia';
  end if;

  -- La richiesta di eliminazione la muovono solo elimina_viaggio(),
  -- conferma_eliminazione() e annulla_eliminazione(). Quelle girano con i
  -- diritti di chi le ha create, quindi qui dentro current_user non è più
  -- "authenticated": è così che si distingue una chiamata regolare da un
  -- aggiornamento mandato a mano dall'app per cancellare la richiesta di
  -- un altro admin.
  if (new.canc_chiesta_da is distinct from old.canc_chiesta_da
      or new.canc_chiesta_il is distinct from old.canc_chiesta_il)
     and current_user in ('authenticated', 'anon') then
    raise exception 'la richiesta di eliminazione si muove solo dalle sue funzioni';
  end if;

  -- Il codice invito può rigenerarlo solo chi ha creato il viaggio: serve per
  -- chiudere fuori qualcuno a cui il codice vecchio è arrivato per sbaglio.
  -- Un compagno no, altrimenti potrebbe tagliare fuori gli altri.
  if new.invite_code is distinct from old.invite_code and auth.uid() <> old.owner then
    raise exception 'solo chi ha creato il viaggio può cambiarne il codice invito';
  end if;

  return new;
end;
$$;

drop trigger if exists trips_campi_bloccati_trg on public.trips;
create trigger trips_campi_bloccati_trg
  before update on public.trips
  for each row execute function public.trips_campi_bloccati();


-- ────────────────────────────────────────────────────────────────────────────
--  IL GUARDIANO DEI RUOLI
-- ────────────────────────────────────────────────────────────────────────────
--  Chi entra: admin se sta creando il proprio viaggio, compagno in tutti gli
--  altri casi. Il ruolo non lo sceglie chi arriva — nemmeno passando per
--  join_trip con un codice valido.
create or replace function public.membri_ruolo_all_ingresso()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.trips t where t.id = new.trip_id and t.owner = new.user_id) then
    new.ruolo := 'admin';
  else
    new.ruolo := 'compagno';
  end if;
  return new;
end;
$$;

drop trigger if exists membri_ruolo_ingresso_trg on public.trip_members;
create trigger membri_ruolo_ingresso_trg
  before insert on public.trip_members
  for each row execute function public.membri_ruolo_all_ingresso();

--  E dopo: il ruolo lo cambia solo un admin di quel viaggio. Senza questo,
--  la regola members_update lascerebbe a chiunque la possibilità di
--  promuoversi da solo scrivendosi sulla propria riga — il with check vede
--  la riga nuova, dove "sono admin" è già vero, e la lascia passare.
--
--  In più: l'ultimo admin non si può togliere il ruolo. Un viaggio senza
--  nessun admin non lo potrebbe più eliminare nessuno, e resterebbe lì per
--  sempre sui telefoni di tutti.
create or replace function public.membri_ruolo_custodito()
returns trigger
language plpgsql
as $$
declare n_admin int;
begin
  if new.trip_id is distinct from old.trip_id or new.user_id is distinct from old.user_id then
    raise exception 'una iscrizione non si sposta su un altro viaggio o un altro account';
  end if;

  if new.ruolo is distinct from old.ruolo then
    if not public.is_trip_admin(old.trip_id) then
      raise exception 'solo un admin del viaggio puo cambiare i ruoli';
    end if;

    if old.ruolo = 'admin' and new.ruolo <> 'admin' then
      select count(*) into n_admin
        from public.trip_members where trip_id = old.trip_id and ruolo = 'admin';
      if n_admin <= 1 then
        raise exception 'un viaggio deve restare con almeno un admin';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists membri_ruolo_custodito_trg on public.trip_members;
create trigger membri_ruolo_custodito_trg
  before update on public.trip_members
  for each row execute function public.membri_ruolo_custodito();

--  Uscire da un viaggio è sempre permesso — tranne all'ultimo admin, che
--  lascerebbe il viaggio orfano sui telefoni degli altri, senza più nessuno
--  in grado di eliminarlo. Prima promuove qualcuno, o lo elimina lui.
create or replace function public.membri_ultimo_admin_non_esce()
returns trigger
language plpgsql
as $$
declare n_admin int;
begin
  -- Quando è il viaggio intero a sparire, le iscrizioni se ne vanno con lui
  -- per forza: qui non c'è niente da difendere. A quel punto la riga in
  -- trips è già stata tolta, ed è così che si riconosce il caso.
  if not exists (select 1 from public.trips where id = old.trip_id) then
    return old;
  end if;

  if old.ruolo = 'admin' then
    select count(*) into n_admin
      from public.trip_members where trip_id = old.trip_id and ruolo = 'admin';
    if n_admin <= 1 then
      raise exception 'sei l''unico admin: prima nomina un altro admin, oppure elimina il viaggio';
    end if;
  end if;

  return old;
end;
$$;

drop trigger if exists membri_ultimo_admin_trg on public.trip_members;
create trigger membri_ultimo_admin_trg
  before delete on public.trip_members
  for each row execute function public.membri_ultimo_admin_non_esce();


-- ────────────────────────────────────────────────────────────────────────────
--  AGGIORNAMENTI IN TEMPO REALE
-- ────────────────────────────────────────────────────────────────────────────
--  L'app resta in ascolto sui viaggi (canale 'trips-rt') per vedere comparire
--  le modifiche dei compagni senza ricaricare. Realtime rispetta le regole
--  qui sopra: ognuno riceve solo gli avvisi sui viaggi che può leggere.
do $$
begin
  alter publication supabase_realtime add table public.trips;
exception
  when duplicate_object then null;  -- già inclusa: va bene così
end;
$$;
