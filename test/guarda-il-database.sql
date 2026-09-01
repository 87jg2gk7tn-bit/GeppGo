-- Sola lettura: guarda com'e' fatto il database, non cambia niente.
select riga from (
  select 1 ord, '' k, '── COLONNE ──────────────────────────────' riga
  union all
  select 2, table_name||column_name,
         '   '||table_name||'.'||column_name||'  ['||data_type||']'
         ||(case when is_nullable='NO' then ' NOT NULL' else '' end)
         ||coalesce('  def='||column_default,'')
    from information_schema.columns
   where table_schema='public' and table_name in ('trips','trip_members')

  union all select 3,'','' union all
  select 4,'','── RLS ATTIVA ───────────────────────────'
  union all
  select 5, relname, '   '||relname||' -> '||(case when relrowsecurity then 'SI' else 'NO !!' end)
    from pg_class
   where relnamespace='public'::regnamespace and relname in ('trips','trip_members')

  union all select 6,'','' union all
  select 7,'','── REGOLE (POLICY) ──────────────────────'
  union all
  select 8, tablename||policyname, '   '||tablename||' :: '||policyname||'  ('||cmd||')'
    from pg_policies where schemaname='public'

  union all select 9,'','' union all
  select 10,'','── FUNZIONI ─────────────────────────────'
  union all
  select 11, p.proname, '   '||p.proname||'()'
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public'
     -- fuori quelle che arrivano dalle estensioni (pgcrypto e simili): sono
     -- decine e non dicono niente su come e' fatto il progetto
     and not exists (select 1 from pg_depend d where d.objid=p.oid and d.deptype='e')

  union all select 12,'','' union all
  select 13,'','── TRIGGER ──────────────────────────────'
  union all
  select 14, t.tgname, '   '||t.tgname||' su '||c.relname
    from pg_trigger t join pg_class c on c.oid=t.tgrelid
   where not t.tgisinternal and c.relnamespace='public'::regnamespace

  union all select 15,'','' union all
  select 16,'','── QUANTI DATI (stima) ──────────────────'
  union all
  select 17, relname, '   '||relname||': ~'||greatest(reltuples,0)::bigint||' righe'
    from pg_class
   where relnamespace='public'::regnamespace and relname in ('trips','trip_members')
) x order by ord, k;
