-- M1 · platform: extensions and the non-exposed `private` schema.
-- Plan §7.6, §8.6; CLAUDE.md rules 2–3. No domain tables yet.

-- ---------------------------------------------------------------------------
-- Extensions (Supabase convention: install into the `extensions` schema)
-- ---------------------------------------------------------------------------
create extension if not exists pgcrypto with schema extensions;  -- token hashing (invitations, M3)
create extension if not exists pg_trgm  with schema extensions;  -- fuzzy search (M6)
create extension if not exists citext   with schema extensions;  -- case-insensitive emails (M3)
create extension if not exists pg_cron;                          -- scheduled jobs; owns the `cron` schema

-- ---------------------------------------------------------------------------
-- private schema: authorization helpers live here (private.my_workspace_ids(),
-- private.my_project_ids(min_role), ...). The Data API does not expose it
-- (not listed in api.schemas), and only signed-in users may use it.
-- ---------------------------------------------------------------------------
create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon;
grant usage on schema private to authenticated;

-- Functions are executable by PUBLIC by default; in `private` they must be
-- granted explicitly, per function, to `authenticated` only.
alter default privileges in schema private revoke execute on functions from public;
alter default privileges in schema private revoke execute on functions from anon;

comment on schema private is
  'Authorization helpers (security definer, search_path = ''''). Not exposed through the Data API.';
