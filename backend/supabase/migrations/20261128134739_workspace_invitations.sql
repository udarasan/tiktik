-- M3 · invitations (plan §6.2, §9.5; FR-WS-04, 05, 06; BR-13).
-- Token model (decision 2026-11-28, "strict"): raw tokens are created and returned ONLY by
-- create_invitations / reissue_invitation, which are executable by service_role alone. The Edge
-- Function `send-invitations` calls them with the secret key after verifying the user's JWT and
-- passes the user id as p_actor. They live in `public` only because the Data API exposes no other
-- schema; anon and authenticated cannot execute them. The database stores SHA-256 hashes only.

grant usage on schema private to service_role;

-- ---------------------------------------------------------------------------
-- Token helpers
-- ---------------------------------------------------------------------------
create function private.new_invitation_token()
returns text
language sql
volatile
set search_path = ''
as $$
  -- 32 random bytes, base64url without padding (43 chars, 256 bits).
  select translate(rtrim(encode(extensions.gen_random_bytes(32), 'base64'), '='), '+/', '-_')
$$;

create function private.hash_invitation_token(p_token text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(extensions.digest(convert_to(coalesce(p_token, ''), 'UTF8'), 'sha256'), 'hex')
$$;

-- Marks PENDING invitations past their expiry as EXPIRED. Run by pg_cron and before checks.
create function private.expire_invitations()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  update public.invitations
  set status = 'EXPIRED'
  where status = 'PENDING' and expires_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Actor's ACTIVE role (row-locked) for the private, service-role entry points; NOT_FOUND otherwise.
create function private.require_actor_member(p_ws uuid, p_actor uuid)
returns text
language plpgsql
set search_path = ''
as $$
begin
  if p_actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001', hint = 'Please sign in to continue.';
  end if;
  return private.require_member(p_ws, p_actor);
end;
$$;

-- ---------------------------------------------------------------------------
-- FR-WS-04 create_invitations — SERVICE ROLE ONLY (called by send-invitations)
-- p_invites: [{ "email": "...", "role": "ADMIN" | "MEMBER" }, ...]  (1–20)
-- Returns one result per input, in order:
--   { email, role, status: CREATED | ALREADY_MEMBER_OR_INVITED | ONLY_OWNER_CAN_INVITE_ADMIN |
--     VALIDATION_ERROR, invitation_id?, token? }   token only for CREATED.
-- ---------------------------------------------------------------------------
create function public.create_invitations(p_actor uuid, p_ws_id uuid, p_invites jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role text := private.require_actor_member(p_ws_id, p_actor);
  v_results    jsonb := '[]'::jsonb;
  v_item       jsonb;
  v_email      text;
  v_role       text;
  v_seen       text[] := '{}';
  v_token      text;
  v_id         uuid;
  v_created    int := 0;
begin
  if v_actor_role = 'MEMBER' then
    raise exception 'FORBIDDEN' using errcode = 'P0001', hint = 'Only Owners and Admins can invite people.';
  end if;

  if p_invites is null or jsonb_typeof(p_invites) <> 'array'
     or jsonb_array_length(p_invites) not between 1 and 20 then
    raise exception 'VALIDATION_ERROR' using errcode = 'P0001', hint = 'Invite between 1 and 20 people at a time.';
  end if;

  perform private.expire_invitations();

  for v_item in select value from jsonb_array_elements(p_invites) loop
    v_email := lower(btrim(coalesce(v_item ->> 'email', '')));
    v_role  := upper(btrim(coalesce(v_item ->> 'role', 'MEMBER')));

    if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or char_length(v_email) > 320
       or v_role not in ('ADMIN', 'MEMBER') then
      v_results := v_results || jsonb_build_object('email', v_email, 'role', v_role, 'status', 'VALIDATION_ERROR');
      continue;
    end if;

    if v_role = 'ADMIN' and v_actor_role <> 'OWNER' then
      v_results := v_results || jsonb_build_object('email', v_email, 'role', v_role, 'status', 'ONLY_OWNER_CAN_INVITE_ADMIN');
      continue;
    end if;

    if v_email = any (v_seen)
       or exists (
         select 1 from public.invitations i
         where i.workspace_id = p_ws_id and i.email = v_email::extensions.citext and i.status = 'PENDING')
       or exists (
         select 1 from public.workspace_members wm
         join auth.users u on u.id = wm.user_id
         where wm.workspace_id = p_ws_id and wm.status = 'ACTIVE' and lower(u.email) = v_email) then
      v_results := v_results || jsonb_build_object('email', v_email, 'role', v_role, 'status', 'ALREADY_MEMBER_OR_INVITED');
      v_seen := v_seen || v_email;
      continue;
    end if;

    v_seen := v_seen || v_email;
    v_token := private.new_invitation_token();

    insert into public.invitations (workspace_id, email, role, token_hash, invited_by)
    values (p_ws_id, v_email, v_role, private.hash_invitation_token(v_token), p_actor)
    returning id into v_id;

    v_created := v_created + 1;
    v_results := v_results || jsonb_build_object(
      'email', v_email, 'role', v_role, 'status', 'CREATED', 'invitation_id', v_id, 'token', v_token);
  end loop;

  if v_created > 0 then
    insert into public.audit_events (workspace_id, actor_id, action, details)
    values (p_ws_id, p_actor, 'INVITATIONS_CREATED', jsonb_build_object(
      'count', v_created,
      'invitations', (select jsonb_agg(jsonb_build_object('email', r ->> 'email', 'role', r ->> 'role'))
                      from jsonb_array_elements(v_results) r where r ->> 'status' = 'CREATED')));
  end if;

  return v_results;
end;
$$;

-- ---------------------------------------------------------------------------
-- FR-WS-06 resend: issue a new token for a PENDING invitation (old link stops working),
-- and restart the 7-day expiry. SERVICE ROLE ONLY; returns the email data + new raw token.
-- ---------------------------------------------------------------------------
create function public.reissue_invitation(p_actor uuid, p_invitation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv        public.invitations;
  v_actor_role text;
  v_token      text := private.new_invitation_token();
begin
  select * into v_inv from public.invitations where id = p_invitation_id for update;
  if v_inv.id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001', hint = 'Invitation not found.';
  end if;

  v_actor_role := private.require_actor_member(v_inv.workspace_id, p_actor);
  if v_actor_role = 'MEMBER' then
    raise exception 'NOT_FOUND' using errcode = 'P0001', hint = 'Invitation not found.';
  end if;
  if v_inv.role = 'ADMIN' and v_actor_role <> 'OWNER' then
    raise exception 'ONLY_OWNER_CAN_INVITE_ADMIN' using errcode = 'P0001',
      hint = 'Only the Owner can manage Admin invitations.';
  end if;
  -- An unexpired-by-cron but past-due invitation may still be resent (it gets a fresh expiry).
  if v_inv.status <> 'PENDING' then
    raise exception 'NOT_PENDING' using errcode = 'P0001', hint = 'This invitation is no longer pending.';
  end if;

  update public.invitations
  set token_hash = private.hash_invitation_token(v_token), expires_at = now() + interval '7 days'
  where id = v_inv.id;

  return jsonb_build_object(
    'invitation_id', v_inv.id, 'workspace_id', v_inv.workspace_id,
    'email', v_inv.email::text, 'role', v_inv.role, 'token', v_token);
end;
$$;

-- Email details for send-invitations (workspace name, inviter name). SERVICE ROLE ONLY.
create function public.invitation_email_context(p_ws_id uuid, p_actor uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('workspace_name', w.name, 'inviter_name', p.full_name)
  from public.workspaces w, public.profiles p
  where w.id = p_ws_id and p.id = p_actor
$$;

-- ---------------------------------------------------------------------------
-- FR-WS-06 revoke_invitation(invitation_id) — browser-callable; link stops working at once.
-- ---------------------------------------------------------------------------
create function public.revoke_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid        uuid := private.require_uid();
  v_inv        public.invitations;
  v_role       text;
begin
  select * into v_inv from public.invitations where id = p_invitation_id for update;
  v_role := case when v_inv.id is null then null else private.workspace_role(v_inv.workspace_id) end;

  -- Invisible to non-members and Members (RLS hides invitations from them) → NOT_FOUND (ADR-11).
  if v_role is null or v_role = 'MEMBER' then
    raise exception 'NOT_FOUND' using errcode = 'P0001', hint = 'Invitation not found.';
  end if;
  if v_inv.role = 'ADMIN' and v_role <> 'OWNER' then
    raise exception 'FORBIDDEN' using errcode = 'P0001', hint = 'Only the Owner can manage Admin invitations.';
  end if;
  if v_inv.status <> 'PENDING' then
    raise exception 'NOT_PENDING' using errcode = 'P0001', hint = 'This invitation is no longer pending.';
  end if;

  update public.invitations set status = 'REVOKED' where id = v_inv.id;

  insert into public.audit_events (workspace_id, actor_id, action, details)
  values (v_inv.workspace_id, v_uid, 'INVITATION_REVOKED',
          jsonb_build_object('invitation_id', v_inv.id, 'email', v_inv.email::text, 'role', v_inv.role));
end;
$$;

-- ---------------------------------------------------------------------------
-- FR-WS-05 get_invitation_preview(token) — public; returns only what the landing page needs.
-- ---------------------------------------------------------------------------
create function public.get_invitation_preview(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.invitations;
  v_ws  public.workspaces;
begin
  select * into v_inv from public.invitations
  where token_hash = private.hash_invitation_token(p_token);

  select * into v_ws from public.workspaces where id = v_inv.workspace_id and deleted_at is null;

  if v_inv.id is null or v_ws.id is null or v_inv.status = 'REVOKED' then
    raise exception 'NOT_FOUND' using errcode = 'P0001', hint = 'This invitation link is not valid.';
  end if;
  if v_inv.status = 'ACCEPTED' then
    raise exception 'NOT_PENDING' using errcode = 'P0001', hint = 'This invitation has already been used.';
  end if;
  if v_inv.status = 'EXPIRED' or v_inv.expires_at <= now() then
    raise exception 'INVITATION_EXPIRED' using errcode = 'P0001',
      hint = 'This invitation has expired. Ask for a new one.';
  end if;

  return jsonb_build_object(
    'workspace_name', v_ws.name,
    'inviter_name', (select full_name from public.profiles where id = v_inv.invited_by),
    'email', v_inv.email::text,
    'role', v_inv.role,
    'expires_at', v_inv.expires_at);
end;
$$;

-- ---------------------------------------------------------------------------
-- FR-WS-05 accept_invitation(token) → { workspace_id, slug }. Signed-in user whose confirmed
-- email matches (BR-13). Already a member → invitation marked used, no duplicate (§5.5).
-- ---------------------------------------------------------------------------
create function public.accept_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := private.require_uid();
  v_inv    public.invitations;
  v_ws     public.workspaces;
  v_user   record;
  v_member public.workspace_members;
begin
  select * into v_inv from public.invitations
  where token_hash = private.hash_invitation_token(p_token)
  for update;

  select * into v_ws from public.workspaces where id = v_inv.workspace_id and deleted_at is null;

  if v_inv.id is null or v_ws.id is null or v_inv.status = 'REVOKED' then
    raise exception 'NOT_FOUND' using errcode = 'P0001', hint = 'This invitation link is not valid.';
  end if;
  if v_inv.status = 'ACCEPTED' then
    raise exception 'NOT_PENDING' using errcode = 'P0001', hint = 'This invitation has already been used.';
  end if;
  -- (No status update here: the raise below would roll it back. The hourly job marks it.)
  if v_inv.status = 'EXPIRED' or v_inv.expires_at <= now() then
    raise exception 'INVITATION_EXPIRED' using errcode = 'P0001',
      hint = 'This invitation has expired. Ask for a new one.';
  end if;

  select u.email, u.email_confirmed_at into v_user from auth.users u where u.id = v_uid;
  if v_user.email is null or lower(v_user.email) <> lower(v_inv.email::text) or v_user.email_confirmed_at is null then
    raise exception 'EMAIL_MISMATCH' using errcode = 'P0001',
      hint = 'This invitation was sent to a different email address. Sign in with that address.';
  end if;

  select * into v_member from public.workspace_members
  where workspace_id = v_inv.workspace_id and user_id = v_uid
  for update;

  if v_member.user_id is null then
    insert into public.workspace_members (workspace_id, user_id, role)
    values (v_inv.workspace_id, v_uid, v_inv.role);
  elsif v_member.status = 'REMOVED' then
    update public.workspace_members
    set status = 'ACTIVE', role = v_inv.role, joined_at = now()
    where workspace_id = v_inv.workspace_id and user_id = v_uid;
  end if; -- already ACTIVE: keep the current role, just mark the invitation used

  update public.invitations set status = 'ACCEPTED' where id = v_inv.id;

  insert into public.audit_events (workspace_id, actor_id, action, details)
  values (v_inv.workspace_id, v_uid, 'INVITATION_ACCEPTED',
          jsonb_build_object('invitation_id', v_inv.id, 'role', v_inv.role,
                             'already_member', coalesce(v_member.status = 'ACTIVE', false)));

  return jsonb_build_object('workspace_id', v_ws.id, 'slug', v_ws.slug);
end;
$$;

-- ---------------------------------------------------------------------------
-- Scheduled expiry (plan §7.3): hourly.
-- ---------------------------------------------------------------------------
select cron.schedule('expire-invitations', '0 * * * *', $$select private.expire_invitations()$$);

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke execute on function private.new_invitation_token() from public, anon, authenticated;
revoke execute on function private.hash_invitation_token(text) from public, anon, authenticated;
revoke execute on function private.expire_invitations() from public, anon, authenticated;
revoke execute on function private.require_actor_member(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.create_invitations(uuid, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.reissue_invitation(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.invitation_email_context(uuid, uuid) from public, anon, authenticated;

-- Only the Edge Function (secret key) may mint tokens.
grant execute on function public.create_invitations(uuid, uuid, jsonb) to service_role;
grant execute on function public.reissue_invitation(uuid, uuid) to service_role;
grant execute on function public.invitation_email_context(uuid, uuid) to service_role;

revoke execute on function public.revoke_invitation(uuid) from public, anon;
revoke execute on function public.accept_invitation(text) from public, anon;
revoke execute on function public.get_invitation_preview(text) from public;
grant execute on function public.revoke_invitation(uuid) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
-- Preview is public: a signed-out invitee must see whose invitation it is before signing up.
grant execute on function public.get_invitation_preview(text) to anon, authenticated;
