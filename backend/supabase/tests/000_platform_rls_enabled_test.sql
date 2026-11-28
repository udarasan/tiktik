-- M1 · platform guards. Fails the build if any `public` table has RLS off
-- (CLAUDE.md rule 1, plan §8.6 item 5, ADR-05).
begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

-- The guard query: every ordinary or partitioned table in `public` must have RLS on.
create temporary view tables_without_rls as
  select c.relname
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and not c.relrowsecurity;

select is_empty(
  'select relname from tables_without_rls',
  'NFR-SEC: RLS is enabled on every public table'
);

-- Self-test: the guard must catch a table without RLS, then pass once RLS is on.
create table public.__rls_guard_probe (id int);
select is(
  (select array_agg(relname::text order by relname) from tables_without_rls),
  array['__rls_guard_probe']::text[],
  'guard detects a public table with RLS disabled'
);
alter table public.__rls_guard_probe enable row level security;
select is_empty(
  'select relname from tables_without_rls',
  'guard passes once RLS is enabled'
);
drop table public.__rls_guard_probe;

-- private schema exists and is reachable only by signed-in users
select has_schema('private', 'private schema exists');
select ok(
  has_schema_privilege('authenticated', 'private', 'usage'),
  'authenticated can use the private schema'
);
select ok(
  not has_schema_privilege('anon', 'private', 'usage'),
  'anon cannot use the private schema'
);

-- required extensions
select has_extension('extensions', 'pgcrypto', 'pgcrypto installed in extensions');
select has_extension('extensions', 'pg_trgm',  'pg_trgm installed in extensions');
select has_extension('extensions', 'citext',   'citext installed in extensions');
select has_extension('pg_cron', 'pg_cron installed');

select * from finish();
rollback;
