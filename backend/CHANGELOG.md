# Changelog — backend

All notable changes to the Tickr backend. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions: SemVer, tags `backend-vX.Y.Z`. See CONTRIBUTING.md.

## [Unreleased]

### Added

- Migration `workspace_core` (M3, plan §8.2, §8.4–8.6):
  - Tables `workspaces` (name 2–60, unique slug, description ≤ 500, `owner_id`, soft delete), `workspace_members` (`OWNER`/`ADMIN`/`MEMBER`, `ACTIVE`/`REMOVED`), `invitations` (citext email, `ADMIN`/`MEMBER`, hashed token, 7-day expiry) and `audit_events`.
  - BR-01: a partial unique index allows exactly one active Owner. FR-WS-04: one pending invitation per email per workspace, case-insensitive. Indexes from §8.5.
  - RLS helpers in `private`: `my_workspace_ids(min_role)`, `workspace_role(ws)`, `my_teammate_ids()`, `role_rank()`.
  - RLS: members see their workspaces and member lists; only Owner/Admin see invitations and audit events; only Owner/Admin may update a workspace's name and description, which is audited by a trigger (FR-WS-02). All other writes are reserved for RPCs. `invitations.token_hash` is not selectable (BR-13).
  - Profiles: a single select policy, "self or teammate" (plan §9.3), replacing `profiles_select_self`.
- pgTAP: shared helpers (`tests` schema, test DB only) with two-workspace fixtures; `020_workspace_rls_test.sql` (78 assertions): a visibility matrix for 9 personas across 5 tables, write privileges, the audit trigger, soft delete and the §8.4 constraints.

## [0.2.0] - 2026-11-28

M2 — authentication and profiles.

### Added

- Email templates `templates/confirmation.html` and `templates/recovery.html`. Links carry `?token_hash=…&type=email|recovery` to `/auth/confirm` and `/reset-password`, so they work when the email is opened on another device (the default PKCE link only works in the browser that signed up).
- Auth redirect URL for the E2E dev server (`http://localhost:5180/**`).
- `profiles` table (migration `identity_profiles`, plan §8.2/§8.4):
  - Columns: `full_name` (1–100 characters, trimmed), `job_title` (≤ 100), `avatar_url` (https only), `time_zone` (IANA id, default `UTC`), `theme` (`light`/`dark`/`system`, default `system`), `created_at`.
  - `on_auth_user_created` trigger creates the profile from the sign-up `full_name`, falling back to the email's local part; it never blocks sign-up (FR-AUTH-01).
  - Browser roles may read their own row and update only the 5 editable columns; no direct insert or delete. RLS restricts reads and updates to self (FR-AUTH-08/09); teammates' read access follows in M3.
- pgTAP `010_identity_profiles_test.sql`: 33 assertions covering the schema, the trigger, privileges, the self-only RLS, validation errors (23514) and the cascade delete.

### Changed

- Local `auth.rate_limit.sign_in_sign_ups` raised from 30 to 300 per 5 minutes for local dev and the E2E suite; production limits are set in the dashboard.
- Auth settings in `config.jsonc` for M2:
  - email confirmation required before sign-in (FR-AUTH-07, decision 2026-11-28);
  - 30-minute JWTs with refresh-token rotation and reuse detection (FR-AUTH-04);
  - passwords of at least 8 characters with letters and digits (FR-AUTH-01);
  - current password required to change it (FR-AUTH-05);
  - reset and confirmation links expire after 30 minutes (FR-AUTH-06);
  - at most one auth email per address per minute;
  - redirect URLs for the Vite dev server;
  - Turnstile CAPTCHA documented and off locally (FR-AUTH-11).
- The Data API exposes only `public`; `graphql_public` is removed (plan §10.3). `@tickr/db-types` regenerated without it.

## [0.1.0] - 2026-11-28

M1 — project setup and architecture.

### Added

- Supabase local project in `backend/supabase` (CLI 3.x, `config.jsonc`, Postgres 17, project id `tickr`).
- Migration `platform_private_schema`: extensions `pgcrypto`, `pg_trgm`, `citext` (in `extensions`) and `pg_cron`; `private` schema usable by `authenticated` only, with no default function execute grants.
- pgTAP guard `000_platform_rls_enabled_test.sql`: fails if any `public` table has RLS disabled (with a self-test), and checks the private schema grants and extensions.
- Empty `seed.sql`.
- CI (`.github/workflows/backend.yml`): local stack, `db reset`, pgTAP, advisors (fail on warnings) and the generated-types drift check on every backend change.
- Staging deploy workflow (`deploy-staging.yml`): links the staging project and runs `db push --remote` and `functions deploy` on pushes to `develop`; skips until staging secrets are configured.

[Unreleased]: https://github.com/udarasan/tiktik/compare/backend-v0.2.0...develop
[0.2.0]: https://github.com/udarasan/tiktik/compare/backend-v0.1.0...backend-v0.2.0
[0.1.0]: https://github.com/udarasan/tiktik/releases/tag/backend-v0.1.0
