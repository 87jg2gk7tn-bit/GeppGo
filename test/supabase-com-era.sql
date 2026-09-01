create extension if not exists pgcrypto;

-- Il database di Giacomo com'e' OGGI, ricostruito dalla lettura del suo
-- progetto: stesse tabelle, stesse colonne, stessi nomi di permessi, stesse
-- funzioni. I corpi dei permessi non li ho letti, quindi sono scritti come
-- e' ragionevole che siano visto il nome - e nel dubbio larghi, perche' e'
-- il caso peggiore ed e' quello che conta verificare.
--
-- Serve per provare che lo schema nuovo si posi su QUESTO senza lasciare
-- sotto niente di aperto.

create table public.trips (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null references auth.users(id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  invite_code text not null default encode(gen_random_bytes(9),'hex'),
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

create table public.trip_members (
  trip_id        uuid not null references public.trips(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  participant_id bigint,
  member_name    text,
  primary key (trip_id, user_id)
);

create or replace function public.is_trip_member(p_trip uuid)
returns boolean language sql security definer stable set search_path=public as $$
  select exists(select 1 from public.trip_members m
                where m.trip_id=p_trip and m.user_id=auth.uid());
$$;

create or replace function public.is_trip_owner(p_trip uuid)
returns boolean language sql security definer stable set search_path=public as $$
  select exists(select 1 from public.trips t
                where t.id=p_trip and t.owner=auth.uid());
$$;

create or replace function public.join_trip(p_trip uuid, p_code text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists (select 1 from public.trips t
                 where t.id=p_trip and t.invite_code=p_code) then
    raise exception 'codice non valido';
  end if;
  insert into public.trip_members(trip_id,user_id)
  values (p_trip, auth.uid()) on conflict do nothing;
end $$;

grant select, insert, update, delete on public.trips        to authenticated;
grant select, insert, update, delete on public.trip_members to authenticated;
alter table public.trips        enable row level security;
alter table public.trip_members enable row level security;

-- prima generazione (nomi con gli spazi)
create policy "members read trips"   on public.trips for select to authenticated
  using (owner=auth.uid() or public.is_trip_member(id));
create policy "members update trips" on public.trips for update to authenticated
  using (owner=auth.uid() or public.is_trip_member(id));
create policy "owner insert trips"   on public.trips for insert to authenticated
  with check (owner=auth.uid());
create policy "owner delete trips"   on public.trips for delete to authenticated
  using (owner=auth.uid());

create policy "read own memberships"    on public.trip_members for select to authenticated
  using (user_id=auth.uid());
create policy "update own membership"   on public.trip_members for update to authenticated
  using (user_id=auth.uid());
create policy "delete own membership"   on public.trip_members for delete to authenticated
  using (user_id=auth.uid());
create policy "owner self membership"   on public.trip_members for insert to authenticated
  with check (user_id=auth.uid());

-- seconda generazione (nomi con il trattino basso)
create policy trips_select_member on public.trips for select to authenticated
  using (owner=auth.uid() or public.is_trip_member(id));
create policy trips_update_member on public.trips for update to authenticated
  using (owner=auth.uid() or public.is_trip_member(id));
create policy trips_insert_owner  on public.trips for insert to authenticated
  with check (owner=auth.uid());
create policy trips_delete_owner  on public.trips for delete to authenticated
  using (owner=auth.uid());

create policy members_select      on public.trip_members for select to authenticated
  using (user_id=auth.uid());
create policy members_delete      on public.trip_members for delete to authenticated
  using (user_id=auth.uid());
create policy members_insert_self on public.trip_members for insert to authenticated
  with check (user_id=auth.uid());
