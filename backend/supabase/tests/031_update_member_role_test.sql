-- M3 · update_member_role (FR-WS-08, §5.2, BR-01, BR-02, §5.5).
begin;
select plan(19);
select tests.seed_two_workspaces();

create function pg_temp.role_of(u text) returns text language sql as $$
  select role from public.workspace_members where workspace_id = tests.uid('ws_a') and user_id = tests.uid(u)
$$;
create function pg_temp.call(actor text, target text, new_role text) returns text language plpgsql as $$
begin
  perform tests.authenticate_as(actor);
  perform public.update_member_role(tests.uid('ws_a'), tests.uid(target), new_role);
  perform tests.clear_auth();
  return 'ok';
exception when others then
  perform tests.clear_auth();
  return sqlerrm;
end $$;

-- Owner
select is(pg_temp.call('a_owner', 'a_member', 'ADMIN'), 'ok', 'FR-WS-08 Owner promotes a Member to Admin');
select is(pg_temp.role_of('a_member'), 'ADMIN', '… and the role changed');
select is(pg_temp.call('a_owner', 'a_member', 'MEMBER'), 'ok', 'FR-WS-08 Owner demotes an Admin to Member');
select is(pg_temp.call('a_owner', 'a_owner', 'ADMIN'), 'CANNOT_CHANGE_OWNER', 'BR-01 the Owner cannot change their own role');
select is(pg_temp.call('a_owner', 'a_member', 'OWNER'), 'VALIDATION_ERROR', 'BR-01 nobody is made Owner via role change');
select is(pg_temp.call('a_owner', 'a_member', 'GOD'), 'VALIDATION_ERROR', 'unknown roles are rejected');
select is(pg_temp.call('a_owner', 'outsider', 'ADMIN'), 'NOT_WORKSPACE_MEMBER', 'target must be a member');
select is(pg_temp.call('a_owner', 'a_removed', 'ADMIN'), 'NOT_WORKSPACE_MEMBER', 'removed members cannot be changed');

-- Admin (BR-02)
select is(pg_temp.call('a_admin', 'a_member', 'ADMIN'), 'FORBIDDEN', '§5.2 Admin cannot promote to Admin');
select is(pg_temp.call('a_admin', 'a_owner', 'MEMBER'), 'CANNOT_CHANGE_OWNER', 'BR-02 Admin cannot change the Owner');
select is(pg_temp.call('a_owner', 'shared', 'ADMIN'), 'ok', 'setup: a second Admin');
select is(pg_temp.call('a_admin', 'shared', 'MEMBER'), 'FORBIDDEN', 'BR-02/§5.5 Admin cannot demote another Admin');
select is(pg_temp.role_of('shared'), 'ADMIN', '… and that Admin keeps the role');
select is(pg_temp.call('a_admin', 'a_admin', 'MEMBER'), 'ok', '§5.5 Admin may demote themselves to Member');

-- Member and other workspaces
select is(pg_temp.call('a_member', 'a_admin', 'ADMIN'), 'FORBIDDEN', '§5.2 Members cannot change roles');
select is(pg_temp.call('b_owner', 'a_member', 'ADMIN'), 'NOT_FOUND', 'BR-03/ADR-11 another workspace''s Owner gets NOT_FOUND');
select is(pg_temp.call('a_removed', 'a_member', 'ADMIN'), 'NOT_FOUND', 'a removed member gets NOT_FOUND');

-- Audit + no-op
select is(
  (select count(*)::int from public.audit_events where workspace_id = tests.uid('ws_a') and action = 'ROLE_CHANGED'),
  4, 'every successful change is audited');
select is(pg_temp.call('a_owner', 'a_member', 'MEMBER') ||
  (select count(*)::text from public.audit_events where workspace_id = tests.uid('ws_a') and action = 'ROLE_CHANGED'),
  'ok4', 'setting the same role is a no-op and not audited');

select * from finish();
rollback;
