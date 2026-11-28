-- M3 · create_workspace (FR-WS-01): success, slug generation, validation, auth.
begin;
select plan(17);
select tests.seed_two_workspaces();

select tests.authenticate_as('outsider');
create temp table created as select public.create_workspace('  Acme Design Studio!  ') as ws;
select tests.clear_auth();

select is((select ws->>'name' from created), 'Acme Design Studio!', 'FR-WS-01 name is trimmed and kept as typed');
select is((select ws->>'slug' from created), 'acme-design-studio', 'FR-WS-01 a URL slug is generated from the name');
select is(
  (select role || '/' || status from public.workspace_members
    where workspace_id = (select (ws->>'id')::uuid from created) and user_id = tests.uid('outsider')),
  'OWNER/ACTIVE', 'FR-WS-01 the creator becomes the active Owner');
select is(
  (select owner_id from public.workspaces where id = (select (ws->>'id')::uuid from created)),
  tests.uid('outsider'), 'FR-WS-01 workspaces.owner_id is the creator');
select is(
  (select count(*)::int from public.audit_events
    where workspace_id = (select (ws->>'id')::uuid from created) and action = 'WORKSPACE_CREATED'
      and actor_id = tests.uid('outsider')),
  1, 'creation is audited');

-- The creator can immediately see it through RLS.
select tests.authenticate_as('outsider');
select is((select count(*)::int from public.workspaces), 1, 'the new workspace is visible to its creator');

-- Slug collisions get a short random suffix; odd names still get a valid slug.
create temp table more as select
  public.create_workspace('Acme Design Studio') as dup,
  public.create_workspace('日本語チーム') as non_ascii,
  public.create_workspace('--  Q  --') as tiny;
select tests.clear_auth();
select matches((select dup->>'slug' from more), '^acme-design-studio-[0-9a-f]{6}$', 'duplicate names get a unique slug');
select is((select non_ascii->>'slug' from more), 'workspace', 'names without ASCII letters fall back to "workspace"');
select matches((select tiny->>'slug' from more), '^workspace(-[0-9a-f]{6})?$', 'one-character slugs fall back too');
select is(
  (select count(*)::int from public.workspaces where slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  (select count(*)::int from public.workspaces), 'every generated slug matches the slug format');

-- Validation and auth
select tests.authenticate_as('outsider');
select throws_ok($$select public.create_workspace('x')$$, 'P0001', 'VALIDATION_ERROR', 'FR-WS-01 name shorter than 2 is rejected');
select throws_ok($$select public.create_workspace('   ')$$, 'P0001', 'VALIDATION_ERROR', 'FR-WS-01 blank name is rejected');
select throws_ok($$select public.create_workspace(repeat('n', 61))$$, 'P0001', 'VALIDATION_ERROR', 'FR-WS-01 name longer than 60 is rejected');
select throws_ok($$select public.create_workspace(null)$$, 'P0001', 'VALIDATION_ERROR', 'null name is rejected');
select tests.clear_auth();

select tests.authenticate_as_anon();
select throws_ok($$select public.create_workspace('Anon Co')$$, '42501', null, 'anon cannot call create_workspace');
select tests.clear_auth();

-- authenticated role without a user id (no sub claim)
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.create_workspace('Ghost Co')$$, 'P0001', 'UNAUTHENTICATED', 'a session without a user is rejected');
select tests.clear_auth();

select ok(not has_function_privilege('anon', 'public.create_workspace(text)', 'execute'), 'anon has no execute grant');

select * from finish();
rollback;
