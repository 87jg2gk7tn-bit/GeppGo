-- ============================================================================
--  GeppGo — i tetti di spesa (19 ottobre 2026, miglioria 13a)
-- ============================================================================
--  COME SI USA: Supabase → SQL Editor → New query → incolla tutto questo
--  file → Run. Deve finire con «Success. No rows returned».
--  Si può rilanciare quante volte si vuole: crea solo quello che manca e
--  riscrive le regole sopra a quelle vecchie. Lo stesso testo sta in
--  supabase-schema.sql: rilanciare tutto lo schema va bene uguale, ed è la
--  strada più sicura se questo file desse un errore.
--
--  Fa due cose:
--  - la tabella dati_personali accetta anche il tetto di spesa di ognuno
--    ('tetto:<id del viaggio>'), privato come la valigia. Dentro c'è la
--    tabella intera, com'è nel file del 12 ottobre: se quello non è mai
--    stato lanciato, basta questo;
--  - un guardiano sui viaggi lascia cambiare i tetti del gruppo solo agli
--    admin: l'aggiornamento di un compagno passa, ma i tetti restano
--    com'erano.
--
--  Finché non lo si lancia, l'app funziona lo stesso: il tuo tetto resta sul
--  telefono (il cloud lo rifiuta, e l'app non lo richiede fino alla
--  prossima apertura), e i tetti del gruppo li cambiano solo gli admin
--  perché solo a loro l'app lo lascia fare.
-- ============================================================================

-- ════════════════════════════════════════════════════════════════════════════
--  LA VALIGIA E LE IMPOSTAZIONI, PRIVATE
-- ════════════════════════════════════════════════════════════════════════════
--  La valigia è personale: non sta dentro il viaggio, che vedono tutti i
--  compagni. Prima restava su un telefono solo, e cambiando telefono
--  spariva. Qui ognuno tiene la sua, e le impostazioni che sono sue e non
--  del telefono (il navigatore, la qualità delle foto, gli avvisi, il tema,
--  il proprio nome).
--
--  Una riga per cosa: chiave = 'impostazioni', oppure 'valigia:<id del
--  viaggio>', oppure 'tetto:<id del viaggio>' (il proprio tetto di spesa,
--  dalla miglioria 13a). Dentro, il contenuto con l'ora di ogni modifica:
--  l'app unisce due telefoni voce per voce, e al database non serve
--  conoscerne la forma.
--
--  Fatta così, e non altrimenti:
--  - ogni riga è di una persona sola, e solo lei la legge e la scrive. Non
--    c'è nessuna regola che apra le righe ai compagni di viaggio;
--  - una valigia si lega solo a un viaggio di cui si fa parte;
--  - se ne va da sola: cancellando l'account (on delete cascade dagli
--    utenti, quindi anche da elimina_account) e cancellando il viaggio;
--  - non è un magazzino: una riga non supera i 256 KB.
create table if not exists public.dati_personali (
  user_id       uuid        not null default auth.uid()
                            references auth.users(id) on delete cascade,
  chiave        text        not null,
  trip_id       uuid        references public.trips(id) on delete cascade,
  dati          jsonb       not null default '{}'::jsonb,
  aggiornato_il timestamptz not null default now(),
  primary key (user_id, chiave),
  constraint dati_personali_chiave check (
    (chiave = 'impostazioni' and trip_id is null)
    or (trip_id is not null and chiave in ('valigia:' || trip_id::text, 'tetto:' || trip_id::text))
  ),
  constraint dati_personali_peso check (pg_column_size(dati) <= 262144)
);
create index if not exists dati_personali_trip_idx on public.dati_personali(trip_id);

-- Dalla miglioria 13a la tabella tiene anche il tetto di spesa di ognuno, uno
-- per viaggio ('tetto:<id del viaggio>'): e' privato come la valigia. Il
-- vincolo si rifa' da capo perche' su un database che la tabella ce l'ha
-- gia', «create table if not exists» qui sopra non lo cambierebbe.
alter table public.dati_personali drop constraint if exists dati_personali_chiave;
alter table public.dati_personali add constraint dati_personali_chiave check (
  (chiave = 'impostazioni' and trip_id is null)
  or (trip_id is not null and chiave in ('valigia:' || trip_id::text, 'tetto:' || trip_id::text))
);

alter table public.dati_personali enable row level security;
revoke all on public.dati_personali from anon;
grant select, insert, update, delete on public.dati_personali to authenticated;

-- LEGGERE: solo le proprie righe.
drop policy if exists pers_select on public.dati_personali;
create policy pers_select on public.dati_personali
  for select to authenticated
  using (user_id = auth.uid());

-- SCRIVERE: a nome proprio, e la valigia solo di un viaggio in cui si è.
-- Senza la seconda condizione si potrebbe appendere una riga a un viaggio
-- altrui, solo per sapere se quell'id esiste.
drop policy if exists pers_insert on public.dati_personali;
create policy pers_insert on public.dati_personali
  for insert to authenticated
  with check (user_id = auth.uid()
              and (trip_id is null or public.is_trip_member(trip_id)));

drop policy if exists pers_update on public.dati_personali;
create policy pers_update on public.dati_personali
  for update to authenticated
  using      (user_id = auth.uid())
  with check (user_id = auth.uid()
              and (trip_id is null or public.is_trip_member(trip_id)));

drop policy if exists pers_delete on public.dati_personali;
create policy pers_delete on public.dati_personali
  for delete to authenticated
  using (user_id = auth.uid());


-- ────────────────────────────────────────────────────────────────────────────
--  I TETTI DI SPESA DEL GRUPPO: li cambiano gli admin (miglioria 13a)
-- ────────────────────────────────────────────────────────────────────────────
--  Stanno dentro data: «tetto» (tutto il viaggio) e «tettoCat_<categoria>».
--  Le regole su trips dicono chi puo' modificare un viaggio - tutti i
--  compagni: spese e tappe le scrivono tutti - ma non quali campi.
--
--  Qui non si rifiuta niente: nello stesso aggiornamento c'e' anche quello
--  che un compagno ha tutto il diritto di mandare (una spesa, una tappa), e
--  rifiutarlo intero lo terrebbe fuori dal viaggio. Si rimettono i tetti
--  com'erano, e il resto passa.
--
--  E' un guardiano a se', separato da quello qui sopra, perche' si possa
--  posare anche da solo (supabase/migrazioni/2026-10-19-tetti-di-spesa.sql)
--  su un database che non ha tutte le colonne di adesso. Per lo stesso
--  motivo, se il controllo degli admin non si puo' fare (un database senza
--  i ruoli), lascia passare: un guardiano che si rompe fermerebbe ogni
--  aggiornamento di ogni viaggio, cioe' la sincronizzazione di tutti.
create or replace function public.trips_tetti_custoditi()
returns trigger
language plpgsql
as $$
declare
  k text;
  admin boolean;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  begin
    admin := public.is_trip_admin(old.id) or old.owner = auth.uid();
  exception when others then
    return new;
  end;
  if admin then
    return new;
  end if;
  for k in
    select c from (
      select jsonb_object_keys(coalesce(old.data, '{}'::jsonb)) as c
      union
      select jsonb_object_keys(coalesce(new.data, '{}'::jsonb))
      union
      select jsonb_object_keys(case when jsonb_typeof(old.data -> '_ct') = 'object' then old.data -> '_ct' else '{}'::jsonb end)
      union
      select jsonb_object_keys(case when jsonb_typeof(new.data -> '_ct') = 'object' then new.data -> '_ct' else '{}'::jsonb end)
    ) chiavi
    where c = 'tetto' or c like 'tettoCat\_%'
  loop
    if coalesce(old.data, '{}'::jsonb) ? k then
      new.data := jsonb_set(coalesce(new.data, '{}'::jsonb), array[k], old.data -> k);
    else
      new.data := coalesce(new.data, '{}'::jsonb) - k;
    end if;
    -- Anche l'ora della modifica (in _ct, vedi I CAMPI DEL VIAGGIO nell'app)
    -- torna quella di prima: un'ora nuova su un tetto rimasto com'era
    -- vincerebbe sulla modifica vera di un admin arrivata dopo, da un
    -- telefono rimasto senza rete.
    if jsonb_typeof(old.data -> '_ct') = 'object' and (old.data -> '_ct') ? k then
      new.data := jsonb_set(new.data, array['_ct'],
        (case when jsonb_typeof(new.data -> '_ct') = 'object' then new.data -> '_ct' else '{}'::jsonb end)
        || jsonb_build_object(k, old.data -> '_ct' -> k));
    elsif jsonb_typeof(new.data -> '_ct') = 'object' then
      new.data := jsonb_set(new.data, array['_ct'], (new.data -> '_ct') - k);
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists trips_tetti_custoditi_trg on public.trips;
create trigger trips_tetti_custoditi_trg
  before update on public.trips
  for each row execute function public.trips_tetti_custoditi();
