-- M3 · invitations: create (service role), preview, accept, revoke, resend, expiry.
-- FR-WS-04, FR-WS-05, FR-WS-06, BR-13, §5.5. Strict token model: browsers never get raw tokens.
begin;
select plan(59);
select tests.seed_two_workspaces();
select tests.create_user('newbie', 'New Bie');
select tests.create_user('newadmin', 'New Admin');

-- Unconfirmed account (cannot normally sign in, but guard the RPC anyway).
insert into auth.users (id, email, raw_user_meta_data)
values (tests.uid('unconfirmed'), 'unconfirmed@example.test', '{"full_name":"Not Yet"}');

-- Calls as the Edge Function would: service_role + explicit actor.
create function pg_temp.invite(actor text, ws text, invites jsonb) returns jsonb language plpgsql as $$
declare r jsonb;
begin
  set local role service_role;
  r := public.create_invitations(tests.uid(actor), tests.uid(ws), invites);
  reset role;
  return r;
end $$;
create function pg_temp.invite_err(actor text, ws text, invites jsonb) returns text language plpgsql as $$
begin
  perform pg_temp.invite(actor, ws, invites);
  return 'ok';
exception when others then reset role; return sqlerrm;
end $$;
create function pg_temp.as_user(actor text, sql text) returns text language plpgsql as $$
begin
  if actor = 'anon' then perform tests.authenticate_as_anon(); else perform tests.authenticate_as(actor); end if;
  execute sql;
  perform tests.clear_auth();
  return 'ok';
exception when others then perform tests.clear_auth(); return sqlerrm;
end $$;

-- ---------------------------------------------------------------------------
-- Token minting is server-only (decision 2026-11-28)
-- ---------------------------------------------------------------------------
select ok(not has_function_privilege('authenticated', 'public.create_invitations(uuid,uuid,jsonb)', 'execute'),
  'BR-13 signed-in users cannot call create_invitations (no raw tokens in the browser)');
select ok(not has_function_privilege('anon', 'public.create_invitations(uuid,uuid,jsonb)', 'execute'),
  'anon cannot call create_invitations');
select ok(not has_function_privilege('authenticated', 'public.reissue_invitation(uuid,uuid)', 'execute'),
  'signed-in users cannot call reissue_invitation');
select ok(has_function_privilege('service_role', 'public.create_invitations(uuid,uuid,jsonb)', 'execute'),
  'the Edge Function (service_role) can call create_invitations');

-- ---------------------------------------------------------------------------
-- FR-WS-04 create_invitations
-- ---------------------------------------------------------------------------
create temp table r1 as select pg_temp.invite('a_owner', 'ws_a', jsonb_build_array(
  jsonb_build_object('email', 'Newbie@Example.TEST', 'role', 'member'),
  jsonb_build_object('email', 'newadmin@example.test', 'role', 'ADMIN'),
  jsonb_build_object('email', 'newbie@example.test', 'role', 'MEMBER'),        -- duplicate in request
  jsonb_build_object('email', 'a_member@example.test', 'role', 'MEMBER'),      -- already a member
  jsonb_build_object('email', 'invitee.a@example.test', 'role', 'MEMBER'),     -- already pending (seed)
  jsonb_build_object('email', 'not-an-email', 'role', 'MEMBER'),
  jsonb_build_object('email', 'x@example.test', 'role', 'OWNER'),
  jsonb_build_object('email', 'a_removed@example.test', 'role', 'MEMBER'),     -- removed → can be re-invited
  jsonb_build_object('email', 'unconfirmed@example.test', 'role', 'MEMBER')
)) as res;
-- Temp tables belong to the test owner; let the simulated roles read them.
grant select on r1 to anon, authenticated, service_role;

select is(
  (select array_agg(e ->> 'status' order by ord) from r1, jsonb_array_elements(res) with ordinality as t(e, ord)),
  array['CREATED', 'CREATED', 'ALREADY_MEMBER_OR_INVITED', 'ALREADY_MEMBER_OR_INVITED',
        'ALREADY_MEMBER_OR_INVITED', 'VALIDATION_ERROR', 'VALIDATION_ERROR', 'CREATED', 'CREATED'],
  'FR-WS-04 one result per email, in order (dedupe, members, pending, validation)');
select is((select res -> 0 ->> 'email' from r1), 'newbie@example.test', 'emails are normalised to lower case');
select is((select res -> 0 ->> 'role' from r1), 'MEMBER', 'roles are normalised to upper case');
select ok((select char_length(res -> 0 ->> 'token') = 43 from r1), 'CREATED results carry a 43-char raw token');
select ok((select (res -> 2) ? 'token' = false from r1), 'non-created results carry no token');
select is(
  (select token_hash from public.invitations where id = (select (res -> 0 ->> 'invitation_id')::uuid from r1)),
  (select encode(extensions.digest(res -> 0 ->> 'token', 'sha256'), 'hex') from r1),
  'BR-13 only the SHA-256 hash of the token is stored');
select is(
  (select count(*)::int from public.invitations i, r1
    where i.token_hash = r1.res -> 0 ->> 'token'),
  0, 'BR-13 the raw token is not stored anywhere in invitations');
select is(
  (select (details ->> 'count')::int from public.audit_events
    where workspace_id = tests.uid('ws_a') and action = 'INVITATIONS_CREATED'),
  4, 'creation is audited with the number of invitations');

select is(pg_temp.invite_err('a_admin', 'ws_a', '[{"email":"admin2@example.test","role":"ADMIN"}]')::text, 'ok',
  'setup: Admin call succeeds overall');
select is(
  (select pg_temp.invite('a_admin', 'ws_a', '[{"email":"admin3@example.test","role":"ADMIN"},{"email":"m3@example.test","role":"MEMBER"}]')
     -> 0 ->> 'status'),
  'ONLY_OWNER_CAN_INVITE_ADMIN', 'FR-WS-04 only the Owner may invite Admins (per email)');
select is(pg_temp.invite_err('a_member', 'ws_a', '[{"email":"z@example.test"}]'), 'FORBIDDEN', '§5.2 Members cannot invite');
select is(pg_temp.invite_err('b_owner', 'ws_a', '[{"email":"z@example.test"}]'), 'NOT_FOUND', 'BR-03 other workspace → NOT_FOUND');
select is(pg_temp.invite_err('outsider', 'ws_a', '[{"email":"z@example.test"}]'), 'NOT_FOUND', 'non-member → NOT_FOUND');
select is(pg_temp.invite_err('a_owner', 'ws_a', '[]'), 'VALIDATION_ERROR', 'FR-WS-04 at least one invite');
select is(pg_temp.invite_err('a_owner', 'ws_a',
  (select jsonb_agg(jsonb_build_object('email', 'p' || g || '@example.test')) from generate_series(1, 21) g)),
  'VALIDATION_ERROR', 'FR-WS-04 at most 20 invites per request');
select is(pg_temp.invite_err('a_owner', 'ws_a', '{"email":"x@y.z"}'), 'VALIDATION_ERROR', 'invites must be an array');

-- ---------------------------------------------------------------------------
-- FR-WS-05 preview (public)
-- ---------------------------------------------------------------------------
select tests.authenticate_as_anon();
select is(
  (select public.get_invitation_preview(res -> 0 ->> 'token') - 'expires_at' from r1),
  jsonb_build_object('workspace_name', 'Workspace A', 'inviter_name', 'A Owner',
                     'email', 'newbie@example.test', 'role', 'MEMBER'),
  'FR-WS-05 a signed-out invitee can preview workspace, inviter, email and role');
select tests.clear_auth();
select is(pg_temp.as_user('anon', $$select public.get_invitation_preview('nope')$$), 'NOT_FOUND', 'unknown token → NOT_FOUND');
select is(pg_temp.as_user('anon', $$select public.get_invitation_preview(null)$$), 'NOT_FOUND', 'null token → NOT_FOUND');
select is(pg_temp.as_user('anon', $$select public.accept_invitation('x')$$), 'permission denied for function accept_invitation',
  'anon cannot accept invitations');

-- ---------------------------------------------------------------------------
-- FR-WS-05 accept
-- ---------------------------------------------------------------------------
select is(pg_temp.as_user('a_member', format($$select public.accept_invitation(%L)$$, (select res -> 0 ->> 'token' from r1))),
  'EMAIL_MISMATCH', 'BR-13 another signed-in user cannot accept it');
select is(pg_temp.as_user('unconfirmed', format($$select public.accept_invitation(%L)$$, (select res -> 8 ->> 'token' from r1))),
  'EMAIL_MISMATCH', 'BR-13 an unconfirmed email cannot accept');

select tests.authenticate_as('newbie');
create temp table acc as select public.accept_invitation((select res -> 0 ->> 'token' from r1)) as res;
select tests.clear_auth();
select is((select res from acc), jsonb_build_object('workspace_id', tests.uid('ws_a'), 'slug', 'workspace-a'),
  'FR-WS-05 accepting returns the workspace to open');
select is(
  (select role || '/' || status from public.workspace_members where workspace_id = tests.uid('ws_a') and user_id = tests.uid('newbie')),
  'MEMBER/ACTIVE', 'FR-WS-05 accepting creates an active membership with the invited role');
select is((select status from public.invitations where id = (select (res -> 0 ->> 'invitation_id')::uuid from r1)),
  'ACCEPTED', 'the invitation is marked accepted');
select is(pg_temp.as_user('newbie', format($$select public.accept_invitation(%L)$$, (select res -> 0 ->> 'token' from r1))),
  'NOT_PENDING', 'BR-13 the link is single-use');
select is(pg_temp.as_user('anon', format($$select public.get_invitation_preview(%L)$$, (select res -> 0 ->> 'token' from r1))),
  'NOT_PENDING', 'FR-WS-05 preview of a used link says so');
select tests.authenticate_as('newbie');
select is((select count(*)::int from public.workspaces), 1, 'the new member now sees the workspace');
select tests.clear_auth();

-- Admin invite accepted by the right person → ADMIN
select is(pg_temp.as_user('newadmin', format($$select public.accept_invitation(%L)$$, (select res -> 1 ->> 'token' from r1))),
  'ok', 'an Admin invitation can be accepted');
select is((select role from public.workspace_members where workspace_id = tests.uid('ws_a') and user_id = tests.uid('newadmin')),
  'ADMIN', '… and grants the Admin role');

-- Removed member re-invited → reactivated
select is(pg_temp.as_user('a_removed', format($$select public.accept_invitation(%L)$$, (select res -> 7 ->> 'token' from r1))),
  'ok', 'a removed member can rejoin through a new invitation');
select is(
  (select status from public.workspace_members where workspace_id = tests.uid('ws_a') and user_id = tests.uid('a_removed')),
  'ACTIVE', '… and their membership is reactivated (no duplicate row)');

-- §5.5 invite accepted by someone who is already a member → marked used, no duplicate
create temp table r2 as select pg_temp.invite('b_owner', 'ws_b', '[{"email":"newbie@example.test","role":"MEMBER"}]') as res;
insert into public.workspace_members (workspace_id, user_id, role) values (tests.uid('ws_b'), tests.uid('newbie'), 'ADMIN');
select is(pg_temp.as_user('newbie', format($$select public.accept_invitation(%L)$$, (select res -> 0 ->> 'token' from r2))),
  'ok', '§5.5 accepting while already a member succeeds');
select is(
  (select count(*)::int || '/' || min(role) from public.workspace_members where workspace_id = tests.uid('ws_b') and user_id = tests.uid('newbie')),
  '1/ADMIN', '§5.5 no duplicate membership and the existing role is kept');
select is((select status from public.invitations where id = (select (res -> 0 ->> 'invitation_id')::uuid from r2)),
  'ACCEPTED', '§5.5 the invitation is marked used');

-- ---------------------------------------------------------------------------
-- Expiry (BR-13, 7 days)
-- ---------------------------------------------------------------------------
create temp table r3 as select pg_temp.invite('a_owner', 'ws_a',
  '[{"email":"late@example.test"},{"email":"later@example.test"},{"email":"cron@example.test"}]') as res;
update public.invitations set expires_at = now() - interval '1 minute'
  where email in ('late@example.test', 'later@example.test', 'cron@example.test');
select is(pg_temp.as_user('anon', format($$select public.get_invitation_preview(%L)$$, (select res -> 0 ->> 'token' from r3))),
  'INVITATION_EXPIRED', 'BR-13 preview of an expired link says so');
select tests.create_user('late');
update auth.users set email = 'late@example.test' where id = tests.uid('late');
select is(pg_temp.as_user('late', format($$select public.accept_invitation(%L)$$, (select res -> 0 ->> 'token' from r3))),
  'INVITATION_EXPIRED', 'BR-13 an expired invitation cannot be accepted');
select is(private.expire_invitations(), 3, 'the expiry job marks all overdue pending invitations EXPIRED');
select is((select count(*)::int from public.invitations where status = 'EXPIRED'), 3, 'all three are now EXPIRED (a failed accept does not change status)');
select is(
  (select count(*)::int from cron.job where jobname = 'expire-invitations' and schedule = '0 * * * *'),
  1, 'the expiry job is scheduled hourly with pg_cron');
select is(
  (select pg_temp.invite('a_owner', 'ws_a', '[{"email":"cron@example.test"}]') -> 0 ->> 'status'),
  'CREATED', 'an email whose invitation expired can be invited again');

-- ---------------------------------------------------------------------------
-- FR-WS-06 revoke (browser) and resend (service role)
-- ---------------------------------------------------------------------------
create temp table r4 as select pg_temp.invite('a_owner', 'ws_a',
  '[{"email":"rev@example.test","role":"MEMBER"},{"email":"revadmin@example.test","role":"ADMIN"},{"email":"resend@example.test","role":"MEMBER"}]') as res;
grant select on r4 to service_role;

select is(pg_temp.as_user('a_member', format('select public.revoke_invitation(%L)', (select res -> 0 ->> 'invitation_id' from r4))),
  'NOT_FOUND', 'ADR-11 Members cannot see or revoke invitations');
select is(pg_temp.as_user('b_owner', format('select public.revoke_invitation(%L)', (select res -> 0 ->> 'invitation_id' from r4))),
  'NOT_FOUND', 'BR-03 other workspace → NOT_FOUND');
select is(pg_temp.as_user('a_admin', format('select public.revoke_invitation(%L)', (select res -> 1 ->> 'invitation_id' from r4))),
  'FORBIDDEN', '§5.2 Admins cannot revoke Admin invitations');
select is(pg_temp.as_user('a_admin', format('select public.revoke_invitation(%L)', (select res -> 0 ->> 'invitation_id' from r4))),
  'ok', 'FR-WS-06 an Admin revokes a Member invitation');
select is(pg_temp.as_user('anon', format($$select public.get_invitation_preview(%L)$$, (select res -> 0 ->> 'token' from r4))),
  'NOT_FOUND', 'FR-WS-06 a revoked link stops working immediately');
select is(pg_temp.as_user('a_admin', format('select public.revoke_invitation(%L)', (select res -> 0 ->> 'invitation_id' from r4))),
  'NOT_PENDING', 'revoking twice → NOT_PENDING');
select is(
  (select count(*)::int from public.audit_events where workspace_id = tests.uid('ws_a') and action = 'INVITATION_REVOKED'),
  1, 'revocation is audited');

set local role service_role;
create temp table rs as select public.reissue_invitation(tests.uid('a_owner'), (select (res -> 2 ->> 'invitation_id')::uuid from r4)) as res;
reset role;
select isnt((select res ->> 'token' from rs), (select res -> 2 ->> 'token' from r4), 'FR-WS-06 resend issues a new token');
select is(pg_temp.as_user('anon', format($$select public.get_invitation_preview(%L)$$, (select res -> 2 ->> 'token' from r4))),
  'NOT_FOUND', 'FR-WS-06 the old link stops working after a resend');
select is(pg_temp.as_user('anon', format($$select public.get_invitation_preview(%L)$$, (select res ->> 'token' from rs))),
  'ok', '… and the new link works');

create function pg_temp.reissue_err(actor text, inv uuid) returns text language plpgsql as $$
begin
  set local role service_role;
  perform public.reissue_invitation(tests.uid(actor), inv);
  reset role; return 'ok';
exception when others then reset role; return sqlerrm;
end $$;
select is(pg_temp.reissue_err('a_owner', (select (res -> 0 ->> 'invitation_id')::uuid from r4)), 'NOT_PENDING', 'resending a revoked invitation → NOT_PENDING');
select is(pg_temp.reissue_err('a_admin', (select (res -> 1 ->> 'invitation_id')::uuid from r4)), 'ONLY_OWNER_CAN_INVITE_ADMIN', 'Admins cannot resend Admin invitations');
select is(pg_temp.reissue_err('a_member', (select (res -> 2 ->> 'invitation_id')::uuid from r4)), 'NOT_FOUND', 'Members cannot resend');
select is(pg_temp.reissue_err('a_owner', gen_random_uuid()), 'NOT_FOUND', 'unknown invitation → NOT_FOUND');

select * from finish();
rollback;
