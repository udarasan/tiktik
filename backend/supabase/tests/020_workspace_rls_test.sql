-- M3 · workspace tables: RLS matrix across two workspaces (CLAUDE.md testing expectations),
-- column privileges, audit trigger and §8.4 constraints. Writes via RPCs are tested separately.
begin;
select plan(78);

select tests.seed_two_workspaces();

-- ---------------------------------------------------------------------------
-- Visibility matrix: what each persona sees — and does not see — in every table.
-- ---------------------------------------------------------------------------
create function pg_temp.visibility(
  persona text, ws_slugs text[], members int, invites int, audits int, profiles int
) returns setof text language plpgsql as $$
begin
  perform tests.authenticate_as(persona);
  return next is(
    coalesce((select array_agg(slug order by slug) from public.workspaces), '{}'),
    ws_slugs,
    format('BR-03 %s sees workspaces %s', persona, ws_slugs));
  return next is(
    (select count(*)::int from public.workspace_members), members,
    format('FR-WS-07 %s sees %s membership rows', persona, members));
  return next is(
    (select count(*)::int from public.invitations), invites,
    format('FR-WS-07 %s sees %s invitations (Owner/Admin only)', persona, invites));
  return next is(
    (select count(*)::int from public.audit_events), audits,
    format('%s sees %s audit events (Owner/Admin only)', persona, audits));
  return next is(
    (select count(*)::int from public.profiles), profiles,
    format('§9.3 %s sees %s profiles (self + teammates)', persona, profiles));
  perform tests.clear_auth();
end $$;

--                                   persona      workspaces                          members inv audit profiles
select * from pg_temp.visibility('a_owner',   array['workspace-a'],                 5,     1,   1,    5);
select * from pg_temp.visibility('a_admin',   array['workspace-a'],                 5,     1,   1,    5);
select * from pg_temp.visibility('a_member',  array['workspace-a'],                 5,     0,   0,    5);
select * from pg_temp.visibility('b_owner',   array['workspace-b'],                 4,     1,   1,    4);
select * from pg_temp.visibility('b_admin',   array['workspace-b'],                 4,     1,   1,    4);
select * from pg_temp.visibility('b_member',  array['workspace-b'],                 4,     0,   0,    4);
select * from pg_temp.visibility('shared',    array['workspace-a', 'workspace-b'],  9,     0,   0,    8);
select * from pg_temp.visibility('a_removed', array[]::text[],                      0,     0,   0,    1);
select * from pg_temp.visibility('outsider',  array[]::text[],                      0,     0,   0,    1);

-- Cross-workspace: B's admin cannot see A's people or invitations even by id.
select tests.authenticate_as('b_admin');
select is_empty(
  format('select 1 from public.profiles where id = %L', tests.uid('a_owner')),
  'BR-03 b_admin cannot read a profile from workspace A');
select is_empty(
  format('select 1 from public.invitations where workspace_id = %L', tests.uid('ws_a')),
  'BR-03 b_admin cannot read workspace A invitations');
select tests.clear_auth();

-- Anonymous visitors see nothing.
select tests.authenticate_as_anon();
select throws_ok('select * from public.workspaces', '42501', null, 'anon cannot read workspaces');
select throws_ok('select * from public.workspace_members', '42501', null, 'anon cannot read members');
select throws_ok('select * from public.invitations', '42501', null, 'anon cannot read invitations');
select tests.clear_auth();

-- ---------------------------------------------------------------------------
-- FR-WS-02: edit name/description — Owner and Admin only; audited.
-- ---------------------------------------------------------------------------
select tests.authenticate_as('a_admin');
select lives_ok(
  format($$update public.workspaces set name = 'Acme', description = 'Our team' where id = %L$$, tests.uid('ws_a')),
  'FR-WS-02 Admin can edit the workspace name and description');
select tests.clear_auth();

select tests.authenticate_as('a_member');
update public.workspaces set name = 'Hijacked by member' where id = tests.uid('ws_a');
select tests.clear_auth();

select tests.authenticate_as('b_owner');
update public.workspaces set name = 'Hijacked by B' where id = tests.uid('ws_a');
select tests.clear_auth();

select is(
  (select name from public.workspaces where id = tests.uid('ws_a')),
  'Acme',
  'FR-WS-02 Member and other-workspace Owner updates changed nothing (0 rows)');

select results_eq(
  format($$select actor_id, details #>> '{after,name}' from public.audit_events
           where workspace_id = %L and action = 'WORKSPACE_UPDATED'$$, tests.uid('ws_a')),
  format($$values (%L::uuid, 'Acme')$$, tests.uid('a_admin')),
  'FR-WS-02 the edit is recorded in the audit log with the actor');

select tests.authenticate_as('a_owner');
select throws_ok(
  format($$update public.workspaces set slug = 'new-slug' where id = %L$$, tests.uid('ws_a')),
  '42501', null, 'slug is not editable from the browser');
select throws_ok(
  format($$update public.workspaces set owner_id = %L where id = %L$$, tests.uid('a_admin'), tests.uid('ws_a')),
  '42501', null, 'owner_id is not editable from the browser (BR-01: transfer only)');
select throws_ok(
  $$insert into public.workspaces (name, slug, owner_id) values ('X', 'x-ws', auth.uid())$$,
  '42501', null, 'workspaces are created only via create_workspace (RPC)');
select throws_ok(
  format('delete from public.workspaces where id = %L', tests.uid('ws_a')),
  '42501', null, 'workspaces cannot be deleted directly');
select throws_ok(
  format($$insert into public.workspace_members (workspace_id, user_id, role) values (%L, %L, 'ADMIN')$$,
         tests.uid('ws_a'), tests.uid('outsider')),
  '42501', null, 'memberships are written only via RPCs');
select throws_ok(
  format($$update public.workspace_members set role = 'OWNER' where workspace_id = %L$$, tests.uid('ws_a')),
  '42501', null, 'roles are changed only via update_member_role (RPC)');
select throws_ok(
  'select token_hash from public.invitations',
  '42501', null, 'BR-13 invitation token hashes are not readable');
select lives_ok(
  'select id, email, role, status, expires_at from public.invitations',
  'Owner can list invitation details without the token hash');
select throws_ok(
  format($$insert into public.audit_events (workspace_id, action) values (%L, 'ROLE_CHANGED')$$, tests.uid('ws_a')),
  '42501', null, 'audit events cannot be forged');
select tests.clear_auth();

-- Soft-deleted workspaces disappear for everyone (plan §8.2 deleted_at).
update public.workspaces set deleted_at = now() where id = tests.uid('ws_b');
select tests.authenticate_as('b_owner');
select is_empty('select 1 from public.workspaces', 'a soft-deleted workspace is invisible to its Owner');
select is_empty('select 1 from public.workspace_members', 'and so are its memberships');
select tests.clear_auth();
update public.workspaces set deleted_at = null where id = tests.uid('ws_b');

-- ---------------------------------------------------------------------------
-- §8.4 constraints
-- ---------------------------------------------------------------------------
select throws_ok(
  format($$update public.workspace_members set role = 'OWNER' where workspace_id = %L and user_id = %L$$,
         tests.uid('ws_a'), tests.uid('a_admin')),
  '23505', null, 'BR-01 a workspace cannot have two active Owners');
select lives_ok(
  format($$update public.workspace_members set role = 'OWNER', status = 'REMOVED' where workspace_id = %L and user_id = %L$$,
         tests.uid('ws_a'), tests.uid('a_removed')),
  'BR-01 the one-Owner rule only counts ACTIVE members');
select throws_ok(
  format($$update public.workspaces set name = 'x' where id = %L$$, tests.uid('ws_a')),
  '23514', null, 'FR-WS-01 name is at least 2 characters');
select throws_ok(
  format($$update public.workspaces set name = repeat('n', 61) where id = %L$$, tests.uid('ws_a')),
  '23514', null, 'FR-WS-01 name is at most 60 characters');
select throws_ok(
  format($$update public.workspaces set slug = 'Bad Slug' where id = %L$$, tests.uid('ws_a')),
  '23514', null, 'slug must be lowercase letters, digits and single hyphens');
select throws_ok(
  format($$update public.workspaces set slug = 'workspace-b' where id = %L$$, tests.uid('ws_a')),
  '23505', null, 'slugs are unique');
select throws_ok(
  format($$insert into public.invitations (workspace_id, email, role, token_hash, invited_by)
           values (%L, 'INVITEE.A@Example.TEST', 'MEMBER', 'hash-dup', %L)$$, tests.uid('ws_a'), tests.uid('a_owner')),
  '23505', null, 'FR-WS-04 duplicate pending invite is rejected (case-insensitive email)');
select lives_ok(
  format($$insert into public.invitations (workspace_id, email, role, token_hash, invited_by)
           values (%L, 'invitee.a@example.test', 'MEMBER', 'hash-a-b', %L)$$, tests.uid('ws_b'), tests.uid('b_owner')),
  'BR-13 the same email may be invited to a different workspace');
select throws_ok(
  format($$insert into public.invitations (workspace_id, email, role, token_hash, invited_by)
           values (%L, 'boss@example.test', 'OWNER', 'hash-owner', %L)$$, tests.uid('ws_a'), tests.uid('a_owner')),
  '23514', null, 'BR-01 nobody can be invited as Owner');
select throws_ok(
  format($$insert into public.invitations (workspace_id, email, role, token_hash, invited_by)
           values (%L, 'not-an-email', 'MEMBER', 'hash-bad', %L)$$, tests.uid('ws_a'), tests.uid('a_owner')),
  '23514', null, 'invitation email must look like an email');
select is(
  (select expires_at - created_at from public.invitations where token_hash = 'hash-a'),
  interval '7 days',
  'BR-13 invitations expire after 7 days by default');

-- Helpers are not callable anonymously.
select ok(not has_function_privilege('anon', 'private.my_workspace_ids(text)', 'execute'),
  'anon cannot call private.my_workspace_ids');
select ok(not has_function_privilege('anon', 'private.workspace_role(uuid)', 'execute'),
  'anon cannot call private.workspace_role');

-- RLS is on for every new table (the platform guard checks all public tables too).
select ok((select bool_and(relrowsecurity) from pg_class where oid in (
  'public.workspaces'::regclass, 'public.workspace_members'::regclass,
  'public.invitations'::regclass, 'public.audit_events'::regclass)),
  'RLS is enabled on all workspace tables');

select * from finish();
rollback;
