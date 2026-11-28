-- Shared pgTAP helpers and fixtures (CLAUDE.md testing expectations).
-- This file is NOT wrapped in begin/rollback: pg_prove runs files alphabetically, so the
-- helpers below are committed for every later test file. They exist only in local/CI test
-- databases (never in a migration), and each test file still rolls back its own data.
create extension if not exists pgtap with schema extensions;

create schema if not exists tests;
grant usage on schema tests to anon, authenticated, service_role;

-- Deterministic id per fixture name, e.g. tests.uid('a_owner').
create or replace function tests.uid(name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select md5('tickr-test-' || name)::uuid
$$;

-- Creates an auth user (the sign-up trigger creates the profile). Idempotent.
create or replace function tests.create_user(name text, full_name text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := tests.uid(name);
begin
  insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at)
  values (
    v_id,
    name || '@example.test',
    jsonb_build_object('full_name', coalesce(full_name, initcap(replace(name, '_', ' ')))),
    now()
  )
  on conflict (id) do nothing;
  return v_id;
end;
$$;

-- Act as a signed-in user, the way PostgREST does (role + JWT claims), until clear_auth().
create or replace function tests.authenticate_as(name text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', tests.uid(name), 'role', 'authenticated', 'email', name || '@example.test')::text,
    true
  );
  set local role authenticated;
end;
$$;

create or replace function tests.authenticate_as_anon()
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
end;
$$;

create or replace function tests.clear_auth()
returns void
language plpgsql
set search_path = ''
as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Two workspaces with every workspace role, plus an outsider and a removed member (BR-03).
--   ws_a: a_owner (OWNER), a_admin (ADMIN), a_member (MEMBER), a_removed (MEMBER, REMOVED)
--   ws_b: b_owner (OWNER), b_admin (ADMIN), b_member (MEMBER)
--   both: shared (MEMBER of A and B)
--   none: outsider
-- Inserted directly as the owner (RPCs are tested separately). Call inside a transaction.
create or replace function tests.seed_two_workspaces()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  u text;
begin
  foreach u in array array['a_owner', 'a_admin', 'a_member', 'a_removed', 'b_owner', 'b_admin', 'b_member', 'shared', 'outsider'] loop
    perform tests.create_user(u);
  end loop;

  insert into public.workspaces (id, name, slug, owner_id) values
    (tests.uid('ws_a'), 'Workspace A', 'workspace-a', tests.uid('a_owner')),
    (tests.uid('ws_b'), 'Workspace B', 'workspace-b', tests.uid('b_owner'));

  insert into public.workspace_members (workspace_id, user_id, role, status) values
    (tests.uid('ws_a'), tests.uid('a_owner'), 'OWNER', 'ACTIVE'),
    (tests.uid('ws_a'), tests.uid('a_admin'), 'ADMIN', 'ACTIVE'),
    (tests.uid('ws_a'), tests.uid('a_member'), 'MEMBER', 'ACTIVE'),
    (tests.uid('ws_a'), tests.uid('a_removed'), 'MEMBER', 'REMOVED'),
    (tests.uid('ws_a'), tests.uid('shared'), 'MEMBER', 'ACTIVE'),
    (tests.uid('ws_b'), tests.uid('b_owner'), 'OWNER', 'ACTIVE'),
    (tests.uid('ws_b'), tests.uid('b_admin'), 'ADMIN', 'ACTIVE'),
    (tests.uid('ws_b'), tests.uid('b_member'), 'MEMBER', 'ACTIVE'),
    (tests.uid('ws_b'), tests.uid('shared'), 'MEMBER', 'ACTIVE');

  insert into public.invitations (workspace_id, email, role, token_hash, invited_by) values
    (tests.uid('ws_a'), 'invitee.a@example.test', 'MEMBER', 'hash-a', tests.uid('a_owner')),
    (tests.uid('ws_b'), 'invitee.b@example.test', 'MEMBER', 'hash-b', tests.uid('b_owner'));

  insert into public.audit_events (workspace_id, actor_id, action) values
    (tests.uid('ws_a'), tests.uid('a_owner'), 'WORKSPACE_CREATED'),
    (tests.uid('ws_b'), tests.uid('b_owner'), 'WORKSPACE_CREATED');
end;
$$;

grant execute on all functions in schema tests to anon, authenticated, service_role;

select plan(1);
select pass('test helpers installed');
select * from finish();
