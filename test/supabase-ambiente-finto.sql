-- Ricostruisce, in un Postgres nudo, solo quel tanto di Supabase che serve
-- allo schema di GeppGo: i due ruoli, lo schema auth con la sua tabella
-- utenti e auth.uid(), e la pubblicazione del realtime.
-- Serve a provare i permessi per davvero prima di toccare il database vero.

do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end $$;

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique
);

-- Com'è fatta davvero su Supabase: legge il "sub" del token di chi sta
-- chiamando. Qui il token lo simuliamo con una impostazione di sessione.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

grant usage on schema auth to anon, authenticated;
grant usage on schema public to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

do $$ begin
  create publication supabase_realtime;
exception when duplicate_object then null; end $$;
