-- M3 · remove_workspace_member (FR-WS-09) and leave_workspace (FR-WS-10). §5.2, BR-01, BR-02.
begin;
select plan(18);
select tests.seed_two_workspaces();

create function pg_temp.remove(actor text, target text) returns text language plpgsql as $$
begin
  perform tests.authenticate_as(actor);
  perform public.remove_workspace_member(tests.uid('ws_a'), tests.uid(target));
  perform tests.clear_auth();
  return 'ok';
exception when others then
  perform tests.clear_auth();
  return sqlerrm;
end $$;
create function pg_temp.leave(actor text, ws text default 'ws_a') returns text language plpgsql as $$
begin
  perform tests.authenticate_as(actor);
  perform public.leave_workspace(tests.uid(ws));
  perform tests.clear_auth();
  return 'ok';
exception when others then
  perform tests.clear_auth();
  return sqlerrm;
end $$;
create function pg_temp.status_of(u text) returns text language sql as $$
  select status from public.workspace_members where workspace_id = tests.uid('ws_a') and user_id = tests.uid(u)
$$;

-- Permission matrix (§5.2 "Remove a Member" / "Remove an Admin")
select is(pg_temp.remove('a_member', 'shared'), 'FORBIDDEN', '§5.2 Members cannot remove anyone');
select is(pg_temp.remove('a_admin', 'a_owner'), 'CANNOT_REMOVE_OWNER', 'BR-01 the Owner cannot be removed');
select is(pg_temp.remove('b_owner', 'a_member'), 'NOT_FOUND', 'BR-03 another workspace''s Owner gets NOT_FOUND');
select is(pg_temp.remove('a_owner', 'outsider'), 'NOT_WORKSPACE_MEMBER', 'target must be an active member');
select is(pg_temp.remove('a_owner', 'a_removed'), 'NOT_WORKSPACE_MEMBER', 'already-removed members cannot be removed again');
select is(pg_temp.remove('a_owner', 'a_owner'), 'VALIDATION_ERROR', 'removing yourself is done by leaving');
select is(pg_temp.remove('a_admin', 'a_member'), 'ok', 'FR-WS-09 Admin removes a Member');
select is(pg_temp.status_of('a_member'), 'REMOVED', '… membership is deactivated, not deleted (history keeps the name)');

-- The removed member loses access immediately.
select tests.authenticate_as('a_member');
select is_empty('select 1 from public.workspaces', 'FR-WS-09 a removed member no longer sees the workspace');
select tests.clear_auth();
select tests.authenticate_as('a_owner');
select is((select full_name from public.profiles where id = tests.uid('a_member')), 'A Member',
  'FR-WS-09 teammates can still read the removed member''s name');
select tests.clear_auth();

select is(pg_temp.remove('a_admin', 'shared'), 'ok', 'setup: Admin removes another Member');
update public.workspace_members set role = 'ADMIN', status = 'ACTIVE'
  where workspace_id = tests.uid('ws_a') and user_id = tests.uid('shared');
select is(pg_temp.remove('a_admin', 'shared'), 'FORBIDDEN', 'BR-02 an Admin cannot remove another Admin');
select is(pg_temp.remove('a_owner', 'shared'), 'ok', '§5.2 the Owner removes an Admin');

select is(
  (select count(*)::int from public.audit_events where workspace_id = tests.uid('ws_a') and action = 'MEMBER_REMOVED'),
  3, 'removals are audited');

-- leave_workspace
select is(pg_temp.leave('a_owner'), 'OWNER_CANNOT_LEAVE', 'BR-01/§5.5 the Owner cannot leave');
select is(pg_temp.leave('a_admin'), 'ok', 'FR-WS-10 an Admin can leave');
select is(pg_temp.leave('a_admin'), 'NOT_FOUND', 'leaving twice → NOT_FOUND');
select is(
  (select actor_id from public.audit_events where workspace_id = tests.uid('ws_a') and action = 'MEMBER_LEFT'),
  tests.uid('a_admin'), 'leaving is audited');

select * from finish();
rollback;
