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
create table if not exists public.trip_members (
  trip_id        uuid        not null references public.trips(id) on delete cascade,
  user_id        uuid        not null references auth.users(id)   on delete cascade,
  participant_id bigint,
  member_name    text,
  joined_at      timestamptz not null default now(),
  primary key (trip_id, user_id)
);

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
grant execute on function public.is_trip_member(uuid) to authenticated;
grant execute on function public.is_trip_owner(uuid)  to authenticated;


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

-- CANCELLARE: solo chi l'ha creato. Un compagno che se ne va toglie la
-- propria riga da trip_members, non il viaggio a tutti.
drop policy if exists trips_delete on public.trips;
create policy trips_delete on public.trips
  for delete to authenticated
  using (owner = auth.uid());

-- ── trip_members ────────────────────────────────────────────────────────────

-- LEGGERE: solo le proprie righe. L'app chiede sempre e solo le sue
-- (.eq('user_id', myUid)), quindi non serve di più — e tenerlo stretto
-- evita di far girare l'elenco di chi viaggia con chi.
drop policy if exists members_select on public.trip_members;
create policy members_select on public.trip_members
  for select to authenticated
  using (user_id = auth.uid());

-- ISCRIVERSI DA SÉ: solo al proprio viaggio, quello appena creato.
-- Senza la seconda condizione basterebbe indovinare l'id di un viaggio per
-- infilarcisi dentro: per entrare in quello di qualcun altro esiste
-- join_trip, che pretende il codice invito.
drop policy if exists members_insert on public.trip_members;
create policy members_insert on public.trip_members
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_trip_owner(trip_id));

-- MODIFICARE: si cambia solo la propria riga (serve a dire "nel viaggio io
-- sono questo partecipante qui").
drop policy if exists members_update on public.trip_members;
create policy members_update on public.trip_members
  for update to authenticated
  using      (user_id = auth.uid())
  with check (user_id = auth.uid());

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
