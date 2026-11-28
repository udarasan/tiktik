-- M2 · identity: profiles (plan §8.2, §8.4, §9.3; FR-AUTH-01, FR-AUTH-08, FR-AUTH-09).
-- One row per auth user, created by trigger on sign-up. Self read/update only in M2;
-- teammates' read access is added in M3 once workspaces exist.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null,
  job_title   text,
  avatar_url  text,
  time_zone   text not null default 'UTC',
  theme       text not null default 'system',
  created_at  timestamptz not null default now(),

  constraint profiles_full_name_length check (char_length(btrim(full_name)) between 1 and 100),
  constraint profiles_job_title_length check (job_title is null or char_length(job_title) <= 100),
  constraint profiles_avatar_url_https check (
    avatar_url is null or (avatar_url ~ '^https://' and char_length(avatar_url) <= 2048)
  ),
  constraint profiles_theme_valid check (theme in ('light', 'dark', 'system'))
);

comment on table public.profiles is
  'User profile (1:1 with auth.users). Email lives in auth.users; credentials are managed by Supabase Auth.';
comment on column public.profiles.time_zone is
  'IANA time zone id (FR-AUTH-09); drives due-soon / overdue calculations.';

-- ---------------------------------------------------------------------------
-- Invariants: IANA time zone and trimmed text (BEFORE trigger, plan §7.8).
-- A CHECK constraint can't query pg_timezone_names, so validation lives here and
-- raises check_violation (23514) like a CHECK would → VALIDATION_ERROR in the app.
-- ---------------------------------------------------------------------------
create function private.profiles_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.full_name := btrim(new.full_name);
  new.job_title := nullif(btrim(new.job_title), '');
  new.avatar_url := nullif(btrim(new.avatar_url), '');

  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.time_zone) then
    raise exception 'invalid time zone: %', new.time_zone
      using errcode = 'check_violation', constraint = 'profiles_time_zone_valid';
  end if;

  return new;
end;
$$;

create trigger profiles_before_write
  before insert or update on public.profiles
  for each row execute function private.profiles_before_write();

-- ---------------------------------------------------------------------------
-- Create a profile for every new auth user (plan §7.4: on_auth_user_created).
-- Never blocks sign-up: a missing / invalid name falls back to the email's local part.
-- ---------------------------------------------------------------------------
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(new.raw_user_meta_data ->> 'full_name', ''));
begin
  if v_name = '' then
    v_name := split_part(coalesce(new.email, ''), '@', 1);
  end if;
  if v_name = '' then
    v_name := 'New user';
  end if;

  insert into public.profiles (id, full_name)
  values (new.id, left(v_name, 100));

  return new;
end;
$$;

revoke execute on function private.handle_new_user() from public, anon, authenticated;
revoke execute on function private.profiles_before_write() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Privileges: browser roles may read their row and update only editable columns.
-- Rows are created by the trigger and deleted by the auth.users cascade.
-- ---------------------------------------------------------------------------
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, job_title, avatar_url, time_zone, theme) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- RLS (CLAUDE.md rule 1). Self only in M2; M3 adds "shares a workspace" for select.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy profiles_select_self on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
