-- Guarda com'e' fatto un progetto Supabase, prima di scriverci sopra.
-- Sola lettura: non cambia niente.
--
-- Sono quattro domande separate, corte apposta. La prima versione era una
-- sola query lunga con dentro stringhe piene di spazi ('   '), e nel
-- copia-incolla verso l'SQL Editor si spezzava a meta' di una stringa:
-- "unterminated quoted string". Corte e senza spazi dentro le virgolette,
-- non si rompono.
--
-- Nell'SQL Editor si incolla e si lancia UNA per volta: mostra il risultato
-- dell'ultima, quindi lanciandole tutte insieme se ne vedrebbe solo una.


-- 1. Le colonne: sono quelle che l'app si aspetta?
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema='public' and table_name in ('trips','trip_members')
order by table_name, ordinal_position;


-- 2. I permessi che ci sono adesso.
select tablename, policyname, cmd
from pg_policies where schemaname='public'
order by tablename, policyname;


-- 3. Le funzioni scritte a mano (fuori quelle delle estensioni).
select p.proname from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
and not exists (select 1 from pg_depend d where d.objid=p.oid and d.deptype='e')
order by 1;


-- 4. La piu' importante. Se rls esce false, quel database oggi non sta
--    separando i dati di una persona da quelli di tutte le altre: l'app
--    chiede i viaggi con select('*'), senza filtro, e si fida dei permessi.
select relname, relrowsecurity as rls, greatest(reltuples,0)::bigint as righe
from pg_class where relnamespace='public'::regnamespace
and relname in ('trips','trip_members');
