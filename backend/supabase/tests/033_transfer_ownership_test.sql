-- M3 · transfer_ownership (FR-WS-11, BR-01).
begin;
select plan(11);
select tests.seed_two_workspaces();

create function pg_temp.transfer(actor text, target text) returns text language plpgsql as $$
begin
  perform tests.authenticate_as(actor);
  perform public.transfer_ownership(tests.uid('ws_a'), tests.uid(target));
  perform tests.clear_auth();
  return 'ok';
exception when others then
  perform tests.clear_auth();
  return sqlerrm;
end $$;
create function pg_temp.role_of(u text) returns text language sql as $$
  select role from public.workspace_members where workspace_id = tests.uid('ws_a') and user_id = tests.uid(u)
$$;

select is(pg_temp.transfer('a_admin', 'a_admin'), 'FORBIDDEN', 'FR-WS-11 only the Owner can transfer');
select is(pg_temp.transfer('a_member', 'a_admin'), 'FORBIDDEN', 'Members cannot transfer');
select is(pg_temp.transfer('b_owner', 'a_admin'), 'NOT_FOUND', 'BR-03 another workspace''s Owner gets NOT_FOUND');
select is(pg_temp.transfer('a_owner', 'a_member'), 'TARGET_NOT_ADMIN', 'FR-WS-11 target must be an Admin');
select is(pg_temp.transfer('a_owner', 'a_removed'), 'TARGET_NOT_ADMIN', 'target must be active');
select is(pg_temp.transfer('a_owner', 'outsider'), 'TARGET_NOT_ADMIN', 'target must be a member');

select is(pg_temp.transfer('a_owner', 'a_admin'), 'ok', 'FR-WS-11 the Owner transfers to an Admin');
select is(pg_temp.role_of('a_admin') || '/' || pg_temp.role_of('a_owner'), 'OWNER/ADMIN',
  'FR-WS-11 the target becomes Owner and the previous Owner becomes Admin');
select is((select owner_id from public.workspaces where id = tests.uid('ws_a')), tests.uid('a_admin'),
  'workspaces.owner_id follows the new Owner');
select is(
  (select details->>'to' from public.audit_events where workspace_id = tests.uid('ws_a') and action = 'OWNERSHIP_TRANSFERRED'),
  tests.uid('a_admin')::text, 'the transfer is audited');

-- The previous Owner (now Admin) can leave; the new Owner can't.
select tests.authenticate_as('a_owner');
select lives_ok(format('select public.leave_workspace(%L)', tests.uid('ws_a')), 'BR-01 the former Owner can now leave');
select tests.clear_auth();

select * from finish();
rollback;
