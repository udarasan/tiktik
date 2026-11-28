-- M3 · workspace: core tables, RLS helpers, RLS (plan §5.1–5.2, §7.6, §8.2, §8.4–8.6, §9.4–9.5).
-- Writes other than "edit workspace name/description" go through RPCs (next migrations);
-- browser roles get only SELECT plus that one column-level UPDATE.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null,
  description text,
  owner_id    uuid not null references public.profiles (id),
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz,

  constraint workspaces_slug_key unique (slug),
  constraint workspaces_name_length check (char_length(btrim(name)) between 2 and 60),
  constraint workspaces_slug_format check (
    char_length(slug) between 2 and 64 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  constraint workspaces_description_length check (description is null or char_length(description) <= 500)
);

comment on table public.workspaces is 'Tenant root (plan §8.2). owner_id mirrors the single ACTIVE OWNER member.';

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  role         text not null,
  status       text not null default 'ACTIVE',
  joined_at    timestamptz not null default now(),

  primary key (workspace_id, user_id),
  constraint workspace_members_role_valid check (role in ('OWNER', 'ADMIN', 'MEMBER')),
  constraint workspace_members_status_valid check (status in ('ACTIVE', 'REMOVED'))
);

-- BR-01: exactly one active Owner per workspace (plan §8.4).
create unique index workspace_members_one_active_owner
  on public.workspace_members (workspace_id)
  where role = 'OWNER' and status = 'ACTIVE';

-- Workspace switcher and RLS helpers (plan §8.5).
create index workspace_members_user_active
  on public.workspace_members (user_id, workspace_id)
  where status = 'ACTIVE';

create table public.invitations (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email        extensions.citext not null,
  role         text not null,
  token_hash   text not null,
  invited_by   uuid not null references public.profiles (id),
  status       text not null default 'PENDING',
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '7 days',

  constraint invitations_token_hash_key unique (token_hash),
  constraint invitations_role_valid check (role in ('ADMIN', 'MEMBER')),
  constraint invitations_status_valid check (status in ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED')),
  constraint invitations_email_format check (
    char_length(email::text) <= 320 and email::text ~ '^[^@[:space:]]+@[^@[:space:]]+$'
  )
);

comment on column public.invitations.token_hash is
  'SHA-256 of the one-time token (BR-13). The raw token is never stored and never readable by browsers.';

-- FR-WS-04: no duplicate pending invites per email (citext = case-insensitive) (plan §8.4).
create unique index invitations_one_pending_per_email
  on public.invitations (workspace_id, email)
  where status = 'PENDING';

create index invitations_workspace_status on public.invitations (workspace_id, status);

create table public.audit_events (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  actor_id     uuid references public.profiles (id) on delete set null,
  action       text not null,
  details      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),

  constraint audit_events_action_valid check (action in (
    'WORKSPACE_CREATED', 'WORKSPACE_UPDATED', 'ROLE_CHANGED', 'MEMBER_REMOVED', 'MEMBER_LEFT',
    'OWNERSHIP_TRANSFERRED', 'INVITATIONS_CREATED', 'INVITATION_REVOKED', 'INVITATION_ACCEPTED'
  ))
);

comment on table public.audit_events is 'Admin actions (plan §7.9). Append-only; written only by RPCs and triggers.';

create index audit_events_workspace_created on public.audit_events (workspace_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS helpers (CLAUDE.md rule 2): the ONLY place workspace role logic lives.
-- ---------------------------------------------------------------------------
create function private.role_rank(role text)
returns int
language sql
immutable
set search_path = ''
as $$
  select case role when 'MEMBER' then 1 when 'ADMIN' then 2 when 'OWNER' then 3 else 0 end
$$;

-- Workspaces where the caller is an ACTIVE member with at least min_role (MEMBER < ADMIN < OWNER).
create function private.my_workspace_ids(min_role text default 'MEMBER')
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select wm.workspace_id
  from public.workspace_members wm
  join public.workspaces w on w.id = wm.workspace_id and w.deleted_at is null
  where wm.user_id = (select auth.uid())
    and wm.status = 'ACTIVE'
    and private.role_rank(wm.role) >= private.role_rank(min_role)
$$;

-- The caller's ACTIVE role in a workspace, or null.
create function private.workspace_role(ws uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select wm.role
  from public.workspace_members wm
  join public.workspaces w on w.id = wm.workspace_id and w.deleted_at is null
  where wm.workspace_id = ws
    and wm.user_id = (select auth.uid())
    and wm.status = 'ACTIVE'
$$;

-- People who share (or shared) a workspace with the caller, for reading names (plan §9.3).
-- Includes REMOVED members so history keeps their name (FR-WS-09).
create function private.my_teammate_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select distinct wm.user_id
  from public.workspace_members wm
  where wm.workspace_id in (select private.my_workspace_ids())
$$;

revoke execute on function private.role_rank(text) from public, anon;
revoke execute on function private.my_workspace_ids(text) from public, anon;
revoke execute on function private.workspace_role(uuid) from public, anon;
revoke execute on function private.my_teammate_ids() from public, anon;
grant execute on function private.role_rank(text) to authenticated;
grant execute on function private.my_workspace_ids(text) to authenticated;
grant execute on function private.workspace_role(uuid) to authenticated;
grant execute on function private.my_teammate_ids() to authenticated;

-- ---------------------------------------------------------------------------
-- Invariants and audit on direct workspace edits (plan §7.3, §9.4)
-- ---------------------------------------------------------------------------
create function private.workspaces_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := btrim(new.name);
  new.description := nullif(btrim(new.description), '');
  return new;
end;
$$;

create trigger workspaces_before_write
  before insert or update on public.workspaces
  for each row execute function private.workspaces_before_write();

-- FR-WS-02: name/description changes are recorded in the audit log.
create function private.workspaces_audit_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.name is distinct from old.name or new.description is distinct from old.description then
    insert into public.audit_events (workspace_id, actor_id, action, details)
    values (
      new.id,
      (select auth.uid()),
      'WORKSPACE_UPDATED',
      jsonb_build_object(
        'before', jsonb_build_object('name', old.name, 'description', old.description),
        'after', jsonb_build_object('name', new.name, 'description', new.description)
      )
    );
  end if;
  return null;
end;
$$;

create trigger workspaces_audit_update
  after update on public.workspaces
  for each row execute function private.workspaces_audit_update();

revoke execute on function private.workspaces_before_write() from public, anon, authenticated;
revoke execute on function private.workspaces_audit_update() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Privileges: SELECT only, plus FR-WS-02's name/description update.
-- Supabase grants ALL on new public tables by default; reset first.
-- ---------------------------------------------------------------------------
revoke all on public.workspaces, public.workspace_members, public.invitations, public.audit_events
  from anon, authenticated;

grant select on public.workspaces to authenticated;
grant update (name, description) on public.workspaces to authenticated;
grant select on public.workspace_members to authenticated;
-- token_hash is deliberately not selectable (BR-13).
grant select (id, workspace_id, email, role, invited_by, status, created_at, expires_at)
  on public.invitations to authenticated;
grant select on public.audit_events to authenticated;

-- ---------------------------------------------------------------------------
-- RLS (CLAUDE.md rule 1, ADR-05, ADR-11). Helper calls wrapped in (select …) (plan §7.6).
-- ---------------------------------------------------------------------------
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.invitations enable row level security;
alter table public.audit_events enable row level security;

-- §5.2 "View workspace and member list": any active member.
create policy workspaces_select_member on public.workspaces
  for select to authenticated
  using (id in (select private.my_workspace_ids()));

-- §5.2 "Edit workspace name/description": Owner and Admin.
create policy workspaces_update_admin on public.workspaces
  for update to authenticated
  using (id in (select private.my_workspace_ids('ADMIN')))
  with check (id in (select private.my_workspace_ids('ADMIN')));

create policy workspace_members_select_member on public.workspace_members
  for select to authenticated
  using (workspace_id in (select private.my_workspace_ids()));

-- §9.5 "List pending invitations": Owner and Admin only (FR-WS-07).
create policy invitations_select_admin on public.invitations
  for select to authenticated
  using (workspace_id in (select private.my_workspace_ids('ADMIN')));

create policy audit_events_select_admin on public.audit_events
  for select to authenticated
  using (workspace_id in (select private.my_workspace_ids('ADMIN')));

-- §9.3 "See teammates' profiles": self (M2) or anyone who shares a workspace.
-- One policy, not two: multiple permissive policies are evaluated per row (advisor warning).
drop policy profiles_select_self on public.profiles;
create policy profiles_select_self_or_teammate on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or id in (select private.my_teammate_ids())
  );
