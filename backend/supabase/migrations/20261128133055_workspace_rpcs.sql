-- M3 · workspace RPCs (plan §5.2, §5.4 BR-01/02/04, §9.4–9.5; CLAUDE.md rules 3 and 6).
-- Every function: security definer, search_path = '', checks the caller via auth.uid() first,
-- raises coded errors (errcode P0001; the hint is user-facing), and audits admin actions (§7.9).
-- A caller who is not an active member gets NOT_FOUND, never FORBIDDEN (ADR-11).

-- ---------------------------------------------------------------------------
-- Internal helpers (not callable from the browser)
-- ---------------------------------------------------------------------------

-- Signed-in user id, or UNAUTHENTICATED.
create function private.require_uid()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001', hint = 'Please sign in to continue.';
  end if;
  return v_uid;
end;
$$;

-- Caller's ACTIVE role in the workspace (row locked), or NOT_FOUND.
create function private.require_member(p_ws uuid, p_uid uuid)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_role text;
begin
  select wm.role into v_role
  from public.workspace_members wm
  join public.workspaces w on w.id = wm.workspace_id and w.deleted_at is null
  where wm.workspace_id = p_ws and wm.user_id = p_uid and wm.status = 'ACTIVE'
  for update of wm;

  if v_role is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001', hint = 'Workspace not found.';
  end if;
  return v_role;
end;
$$;

-- Target's ACTIVE role in the workspace (row locked), or NOT_WORKSPACE_MEMBER.
create function private.require_target_member(p_ws uuid, p_user uuid)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_role text;
begin
  select wm.role into v_role
  from public.workspace_members wm
  where wm.workspace_id = p_ws and wm.user_id = p_user and wm.status = 'ACTIVE'
  for update;

  if v_role is null then
    raise exception 'NOT_WORKSPACE_MEMBER' using errcode = 'P0001',
      hint = 'That person is not an active member of this workspace.';
  end if;
  return v_role;
end;
$$;

-- URL slug from a workspace name; unique, 2–64 chars, ^[a-z0-9]+(-[a-z0-9]+)*$ (FR-WS-01).
create function private.unique_workspace_slug(p_name text)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_base text;
  v_slug text;
begin
  v_base := btrim(regexp_replace(lower(p_name), '[^a-z0-9]+', '-', 'g'), '-');
  v_base := btrim(left(v_base, 48), '-');
  if char_length(v_base) < 2 then
    v_base := 'workspace';
  end if;

  v_slug := v_base;
  while exists (select 1 from public.workspaces where slug = v_slug) loop
    v_slug := v_base || '-' || substr(md5(gen_random_uuid()::text), 1, 6);
  end loop;
  return v_slug;
end;
$$;

-- Called when someone stops being an active member (removed or left).
-- M4 extends it to remove project memberships (BR-04); M5 to unassign open tasks (BR-07).
create function private.handle_member_departure(p_ws uuid, p_user uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  -- Intentionally empty until projects (M4) and tasks (M5) exist.
  perform p_ws, p_user;
end;
$$;

revoke execute on function private.require_uid() from public, anon, authenticated;
revoke execute on function private.require_member(uuid, uuid) from public, anon, authenticated;
revoke execute on function private.require_target_member(uuid, uuid) from public, anon, authenticated;
revoke execute on function private.unique_workspace_slug(text) from public, anon, authenticated;
revoke execute on function private.handle_member_departure(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- FR-WS-01 create_workspace(name) → { id, name, slug }
-- ---------------------------------------------------------------------------
create function public.create_workspace(p_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := private.require_uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_ws   public.workspaces;
begin
  if char_length(v_name) not between 2 and 60 then
    raise exception 'VALIDATION_ERROR' using errcode = 'P0001',
      hint = 'Workspace name must be 2–60 characters.';
  end if;

  insert into public.workspaces (name, slug, owner_id)
  values (v_name, private.unique_workspace_slug(v_name), v_uid)
  returning * into v_ws;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_ws.id, v_uid, 'OWNER');

  insert into public.audit_events (workspace_id, actor_id, action, details)
  values (v_ws.id, v_uid, 'WORKSPACE_CREATED', jsonb_build_object('name', v_ws.name, 'slug', v_ws.slug));

  return jsonb_build_object('id', v_ws.id, 'name', v_ws.name, 'slug', v_ws.slug);
end;
$$;

-- ---------------------------------------------------------------------------
-- FR-WS-08 update_member_role(ws_id, user_id, role)
-- §5.2: Owner changes anyone except themselves; Admin may only demote themselves (§5.5);
-- only the Owner promotes to or demotes from Admin (BR-02); OWNER only via transfer (BR-01).
-- ---------------------------------------------------------------------------
create function public.update_member_role(p_ws_id uuid, p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid         uuid := private.require_uid();
  v_caller_role text := private.require_member(p_ws_id, v_uid);
  v_target_role text;
begin
  if p_role is null or p_role not in ('ADMIN', 'MEMBER') then
    raise exception 'VALIDATION_ERROR' using errcode = 'P0001',
      hint = 'Role must be Admin or Member. Ownership moves only by transfer.';
  end if;

  v_target_role := private.require_target_member(p_ws_id, p_user_id);

  if v_target_role = 'OWNER' then
    raise exception 'CANNOT_CHANGE_OWNER' using errcode = 'P0001',
      hint = 'The Owner''s role can''t be changed. Transfer ownership instead.';
  end if;

  if v_caller_role = 'MEMBER' then
    raise exception 'FORBIDDEN' using errcode = 'P0001', hint = 'Only Owners and Admins can change roles.';
  end if;

  if v_caller_role = 'ADMIN'
     and not (p_user_id = v_uid and p_role = 'MEMBER')
     and (v_target_role = 'ADMIN' or p_role = 'ADMIN') then
    raise exception 'FORBIDDEN' using errcode = 'P0001',
      hint = 'Only the Owner can promote or demote Admins.';
  end if;

  if v_target_role = p_role then
    return; -- no change, nothing to audit
  end if;

  update public.workspace_members
  set role = p_role
  where workspace_id = p_ws_id and user_id = p_user_id;

  insert into public.audit_events (workspace_id, actor_id, action, details)
  values (p_ws_id, v_uid, 'ROLE_CHANGED',
          jsonb_build_object('user_id', p_user_id, 'from', v_target_role, 'to', p_role));
end;
$$;

-- ---------------------------------------------------------------------------
-- FR-WS-09 remove_workspace_member(ws_id, user_id)
-- §5.2: Owner removes Admins and Members; Admin removes Members only (BR-02); Owner never (BR-01).
-- ---------------------------------------------------------------------------
create function public.remove_workspace_member(p_ws_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid         uuid := private.require_uid();
  v_caller_role text := private.require_member(p_ws_id, v_uid);
  v_target_role text;
begin
  if p_user_id = v_uid then
    raise exception 'VALIDATION_ERROR' using errcode = 'P0001',
      hint = 'To remove yourself, leave the workspace instead.';
  end if;

  v_target_role := private.require_target_member(p_ws_id, p_user_id);

  if v_target_role = 'OWNER' then
    raise exception 'CANNOT_REMOVE_OWNER' using errcode = 'P0001',
      hint = 'The Owner can''t be removed. Transfer ownership first.';
  end if;

  if v_caller_role = 'MEMBER' or (v_caller_role = 'ADMIN' and v_target_role = 'ADMIN') then
    raise exception 'FORBIDDEN' using errcode = 'P0001',
      hint = 'Only the Owner can remove Admins; Members can''t remove anyone.';
  end if;

  update public.workspace_members
  set status = 'REMOVED'
  where workspace_id = p_ws_id and user_id = p_user_id;

  perform private.handle_member_departure(p_ws_id, p_user_id);

  insert into public.audit_events (workspace_id, actor_id, action, details)
  values (p_ws_id, v_uid, 'MEMBER_REMOVED', jsonb_build_object('user_id', p_user_id, 'role', v_target_role));
end;
$$;

-- ---------------------------------------------------------------------------
-- FR-WS-10 leave_workspace(ws_id). The Owner must transfer first (BR-01).
-- ---------------------------------------------------------------------------
create function public.leave_workspace(p_ws_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := private.require_uid();
  v_role text := private.require_member(p_ws_id, v_uid);
begin
  if v_role = 'OWNER' then
    raise exception 'OWNER_CANNOT_LEAVE' using errcode = 'P0001',
      hint = 'Transfer ownership to an Admin before leaving.';
  end if;

  update public.workspace_members
  set status = 'REMOVED'
  where workspace_id = p_ws_id and user_id = v_uid;

  perform private.handle_member_departure(p_ws_id, v_uid);

  insert into public.audit_events (workspace_id, actor_id, action, details)
  values (p_ws_id, v_uid, 'MEMBER_LEFT', jsonb_build_object('role', v_role));
end;
$$;

-- ---------------------------------------------------------------------------
-- FR-WS-11 transfer_ownership(ws_id, new_owner_id). Target must be an active Admin;
-- the previous Owner becomes Admin. Password re-entry is done by the UI before calling.
-- ---------------------------------------------------------------------------
create function public.transfer_ownership(p_ws_id uuid, p_new_owner_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid         uuid := private.require_uid();
  v_caller_role text := private.require_member(p_ws_id, v_uid);
  v_target_role text;
begin
  if v_caller_role <> 'OWNER' then
    raise exception 'FORBIDDEN' using errcode = 'P0001', hint = 'Only the Owner can transfer ownership.';
  end if;

  perform 1 from public.workspaces where id = p_ws_id for update;

  select wm.role into v_target_role
  from public.workspace_members wm
  where wm.workspace_id = p_ws_id and wm.user_id = p_new_owner_id and wm.status = 'ACTIVE'
  for update;

  if v_target_role is distinct from 'ADMIN' then
    raise exception 'TARGET_NOT_ADMIN' using errcode = 'P0001',
      hint = 'Ownership can only be transferred to an active Admin.';
  end if;

  -- Demote first: the partial unique index allows one ACTIVE OWNER at a time.
  update public.workspace_members set role = 'ADMIN'
  where workspace_id = p_ws_id and user_id = v_uid;
  update public.workspace_members set role = 'OWNER'
  where workspace_id = p_ws_id and user_id = p_new_owner_id;
  update public.workspaces set owner_id = p_new_owner_id where id = p_ws_id;

  insert into public.audit_events (workspace_id, actor_id, action, details)
  values (p_ws_id, v_uid, 'OWNERSHIP_TRANSFERRED',
          jsonb_build_object('from', v_uid, 'to', p_new_owner_id));
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants: browser-callable RPCs for signed-in users only (CLAUDE.md rule 3).
-- ---------------------------------------------------------------------------
revoke execute on function public.create_workspace(text) from public, anon;
revoke execute on function public.update_member_role(uuid, uuid, text) from public, anon;
revoke execute on function public.remove_workspace_member(uuid, uuid) from public, anon;
revoke execute on function public.leave_workspace(uuid) from public, anon;
revoke execute on function public.transfer_ownership(uuid, uuid) from public, anon;

grant execute on function public.create_workspace(text) to authenticated;
grant execute on function public.update_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.remove_workspace_member(uuid, uuid) to authenticated;
grant execute on function public.leave_workspace(uuid) to authenticated;
grant execute on function public.transfer_ownership(uuid, uuid) to authenticated;
