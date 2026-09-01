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

-- Lo Storage di Supabase, quel tanto che basta per provare i permessi sui
-- file. I file veri stanno altrove, ma i permessi si decidono qui su queste
-- due tabelle: sono le stesse su cui li scrive lo schema.
create schema if not exists storage;

create table if not exists storage.buckets (
  id                 text primary key,
  name               text,
  public             boolean default false,
  file_size_limit    bigint,
  allowed_mime_types text[]
);

create table if not exists storage.objects (
  id        uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name      text,
  owner     uuid,
  created_at timestamptz default now()
);

-- Spezza il percorso e restituisce le cartelle, senza il nome del file:
-- 'abc/def.jpg' -> {abc}. E' cosi' che si legge a quale viaggio appartiene.
create or replace function storage.foldername(name text)
returns text[] language sql immutable as $$
  select (string_to_array(name,'/'))[1:greatest(array_length(string_to_array(name,'/'),1)-1,0)];
$$;

grant usage on schema storage to anon, authenticated;
grant select, insert, update, delete on storage.objects to authenticated;
grant select on storage.buckets to anon, authenticated;
alter table storage.objects enable row level security;
