-- Guarda com'e' fatto un progetto Supabase, prima di scriverci sopra.
-- Sola lettura: non cambia niente. Si incolla nell'SQL Editor e si lancia.
--
-- La prima versione di questo file era una query lunga con dentro stringhe
-- fatte di soli spazi ('   '), e incollandola si spezzava a meta' di una
-- stringa: "unterminated quoted string". L'avevo provata contro un database
-- vero ma non contro il copia-incolla, che e' la strada da cui passa davvero.
--
-- Questa non ha nessuna virgoletta con spazi dentro (i pezzi si attaccano con
-- '/'), tiene le righe corte, e regge anche schiacciata su una riga sola o
-- con i fine-riga di Windows. Provata in tutti e tre i modi.

select sez, dett from (
select 1 n,'colonna' sez,table_name||'/'||column_name||'/'||data_type dett
from information_schema.columns
where table_schema='public' and table_name in ('trips','trip_members')
union all
select 2,'policy',tablename||'/'||policyname||'/'||cmd
from pg_policies where schemaname='public'
union all
select 3,'funzione',p.proname
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
and not exists (select 1 from pg_depend d where d.objid=p.oid and d.deptype='e')
union all
select 4,'trigger',t.tgname||'/'||c.relname
from pg_trigger t join pg_class c on c.oid=t.tgrelid
where not t.tgisinternal and c.relnamespace='public'::regnamespace
union all
select 5,'rls',relname||'/rls='||relrowsecurity
from pg_class where relnamespace='public'::regnamespace
and relname in ('trips','trip_members')
) x order by n, dett;
